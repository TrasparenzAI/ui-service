import { Injectable } from '@angular/core';
import { forkJoin, Observable, of } from 'rxjs';
import { catchError, map, shareReplay } from 'rxjs/operators';
import { ResultService } from '../result/result.service';
import { RuleService } from '../rule/rule.service';
import { Rule } from '../rule/rule.model';
import { Workflow } from '../conductor/workflow.model';
import { Result } from '../result/result.model';

export type RpctScanOrigin = 'globale' | 'dedicata';

/** Una scansione della PA: workflow dedicato (solo quella PA) o globale (tutte le PA). */
export interface RpctScan {
  workflow: Workflow;
  origin: RpctScanOrigin;
}

/** Spec 011: sezione non conforme (slug della regola) con l'eventuale pagina trovata. */
export interface RpctNonConforme {
  sezione: string;
  url: string | null;
}

export interface RpctCounts {
  sezioniOk: number;
  sezioniNonRegolari: number;
  // Spec 011: sezioni della regola usata dalla scansione (come il gauge); senza regola = risultati ricevuti
  total: number;
  nonConformi: RpctNonConforme[];
  // Spec 011: non conformi senza un nome individuabile (es. nessun risultato per la pagina principale)
  senzaEsito: number;
  // Spec 011: false se la scansione non ha risultati per la PA (i conteggi non vanno mostrati come conformi)
  hasResults: boolean;
}

const COUNT_PAGE_SIZE = 500;

/**
 * Conteggi RPCT filtrati per PA (spec 001, pattern company-graph).
 * Spec 011: totale e non conformi calcolati sulle sezioni della regola, come il gauge company-rule.
 * Fornito a livello di componente (providers), richiama ResultService e RuleService senza modificarli.
 */
@Injectable()
export class RpctCountsService {

  private rules$: Observable<Map<String, Rule> | null> | null = null;

  constructor(
    private resultService: ResultService,
    private ruleService: RuleService
  ) {}

  /**
   * Workflow globali (tutte le PA): da caricare una volta e passare a listScans().
   * refreshRunning: conferma dal Conductor lo stato delle globali in RUNNING (spec 006);
   * se il Conductor non risponde resta lo stato del result-service.
   */
  listGlobalScans(refreshRunning = false): Observable<RpctScan[]> {
    return this.resultService.listWorkflows(undefined, refreshRunning).pipe(
      map(workflows => (workflows || []).map(workflow => ({ workflow, origin: 'globale' as RpctScanOrigin }))),
      catchError(() => of([]))
    );
  }

  /**
   * Scansioni della PA: dedicate + globali, dalla più recente.
   * refreshRunning: aggiorna dal Conductor lo stato delle dedicate in RUNNING (spec 003).
   */
  listScans(codiceIpa: string, globals: RpctScan[], refreshRunning = false): Observable<RpctScan[]> {
    return this.resultService.listWorkflows(codiceIpa, refreshRunning).pipe(
      map(workflows => (workflows || []).map(workflow => ({ workflow, origin: 'dedicata' as RpctScanOrigin }))),
      catchError(() => of([] as RpctScan[])),
      map(dedicated => [...dedicated, ...globals].sort(
        (a, b) => (b.workflow.startTime?.getTime() || 0) - (a.workflow.startTime?.getTime() || 0)
      ))
    );
  }

  /** Spec 011: sezioni della regola (stesso calcolo del gauge); null se la regola non è disponibile. */
  ruleSections(ruleName: string | null | undefined): Observable<string[] | null> {
    if (!ruleName) return of(null);
    if (!this.rules$) {
      this.rules$ = this.ruleService.getRules().pipe(
        catchError(() => of(null)),
        shareReplay(1)
      );
    }
    return this.rules$.pipe(
      map(rules => {
        const rule = rules?.get(ruleName);
        return rule ? rule.getCharts(undefined, ruleName, []).map(chart => chart.nodeId) : null;
      })
    );
  }

  /** Conteggi della PA per un workflow; ruleName = root_rule della scansione; null se la chiamata fallisce. */
  countFor(codiceIpa: string, workflowId: string, ruleName?: string | null): Observable<RpctCounts | null> {
    const results$ = this.resultService.getAll(
      { codiceIpa, workflowId, size: COUNT_PAGE_SIZE, noCache: true },
      '/codiceipa/byWorkflow'
    );
    return forkJoin({ rows: results$, sections: this.ruleSections(ruleName) }).pipe(
      map(({ rows, sections }) => {
        const results: Result[] = rows || [];
        if (results.length >= COUNT_PAGE_SIZE) {
          console.warn(`RPCT: ${results.length} risultati per ${codiceIpa}/${workflowId}, conteggi forse troncati`);
        }
        const isOk = (r: Result) => r.status == 200 || r.status == 202;
        const sezioniOk = results.filter(isOk).length;
        // Sezioni con esito KO: nome e pagina dal risultato stesso, nessuna corrispondenza con l'albero
        const koResults: RpctNonConforme[] = results.filter(r => !isOk(r))
          .map(r => ({ sezione: r.ruleName, url: r.destinationUrl || null }));
        if (!sections) {
          return {
            sezioniOk, sezioniNonRegolari: koResults.length, total: results.length,
            nonConformi: koResults, senzaEsito: 0, hasResults: results.length > 0
          };
        }
        // Numeri come il gauge: totale = sezioni della regola, non conformi = totale − OK
        const total = sections.length;
        const sezioniNonRegolari = Math.max(0, total - sezioniOk);
        // Sezioni figlie senza alcun risultato (la radice non entra nel confronto per nome)
        const resultNames = new Set(results.map(r => r.ruleName));
        const missing: RpctNonConforme[] = sections
          .filter(name => name !== ruleName && !resultNames.has(name))
          .map(name => ({ sezione: name, url: null }));
        const nonConformi = [...koResults, ...missing];
        return {
          sezioniOk, sezioniNonRegolari, total, nonConformi,
          senzaEsito: Math.max(0, sezioniNonRegolari - nonConformi.length),
          hasResults: results.length > 0
        };
      }),
      catchError(() => of(null))
    );
  }
}
