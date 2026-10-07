import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { ResultService } from '../result/result.service';
import { Workflow } from '../conductor/workflow.model';
import { Result } from '../result/result.model';

export type RpctScanOrigin = 'globale' | 'dedicata';

/** Una scansione della PA: workflow dedicato (solo quella PA) o globale (tutte le PA). */
export interface RpctScan {
  workflow: Workflow;
  origin: RpctScanOrigin;
}

export interface RpctCounts {
  sezioniOk: number;
  sezioniNonRegolari: number;
  total: number;
}

const COUNT_PAGE_SIZE = 500;

/**
 * Conteggi RPCT filtrati per PA (spec 001, pattern company-graph).
 * Fornito a livello di componente (providers), richiama ResultService senza modificarlo.
 */
@Injectable()
export class RpctCountsService {

  constructor(private resultService: ResultService) {}

  /** Workflow globali (tutte le PA): da caricare una volta e passare a listScans(). */
  listGlobalScans(): Observable<RpctScan[]> {
    return this.resultService.listWorkflows(undefined, false).pipe(
      map(workflows => (workflows || []).map(workflow => ({ workflow, origin: 'globale' as RpctScanOrigin }))),
      catchError(() => of([]))
    );
  }

  /** Scansioni della PA: dedicate + globali, dalla più recente. */
  listScans(codiceIpa: string, globals: RpctScan[]): Observable<RpctScan[]> {
    return this.resultService.listWorkflows(codiceIpa, false).pipe(
      map(workflows => (workflows || []).map(workflow => ({ workflow, origin: 'dedicata' as RpctScanOrigin }))),
      catchError(() => of([] as RpctScan[])),
      map(dedicated => [...dedicated, ...globals].sort(
        (a, b) => (b.workflow.startTime?.getTime() || 0) - (a.workflow.startTime?.getTime() || 0)
      ))
    );
  }

  /** Conteggi della PA per un workflow; null se la chiamata fallisce. */
  countFor(codiceIpa: string, workflowId: string): Observable<RpctCounts | null> {
    return this.resultService.getAll(
      { codiceIpa, workflowId, size: COUNT_PAGE_SIZE, noCache: true },
      '/codiceipa/byWorkflow'
    ).pipe(
      map((rows: Result[]) => {
        const results = rows || [];
        if (results.length >= COUNT_PAGE_SIZE) {
          console.warn(`RPCT: ${results.length} risultati per ${codiceIpa}/${workflowId}, conteggi forse troncati`);
        }
        const sezioniOk = results.filter(r => r.status == 200 || r.status == 202).length;
        return { sezioniOk, sezioniNonRegolari: results.length - sezioniOk, total: results.length };
      }),
      catchError(() => of(null))
    );
  }
}
