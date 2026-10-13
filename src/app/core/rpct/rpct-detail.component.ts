import { Component, OnDestroy, OnInit } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, Router } from '@angular/router';
import { filter, take, catchError, switchMap, map } from 'rxjs/operators';
import { forkJoin, of, Subscription, timer } from 'rxjs';
import { OidcSecurityService } from 'angular-auth-oidc-client';
import { environment } from '../../../environments/environment';
import { AuthGuard } from '../../auth/auth-guard';
import { CompanyService } from '../company/company.service';
import { Company } from '../company/company.model';
import { Workflow, Status } from '../conductor/workflow.model';
import { RpctCounts, RpctCountsService, RpctNonConforme, RpctScan, RpctScanOrigin } from './rpct-counts.service';
import { RpctScanService } from './rpct-scan.service';
import { ApiMessageService, MessageType } from '../api-message.service';
import { isRunningStatus, rpctStateClass, rpctStateLabel } from './rpct-status';
import { RpctAtmapService, RpctAtMapState } from './rpct-atmap.service';
import { RPCT_TOOLTIPS } from './rpct-tooltips';

interface HistoryRow {
  workflowId: string;
  startTime: Date;
  status: string;
  badge: string;
  origin: RpctScanOrigin;
  rootRule: string | null;
  // Spec 011: undefined = da caricare, null = non disponibili (errore o nessun risultato)
  counts?: RpctCounts | null;
}

const PAGE_SIZE = 5;
const KO_LIMIT = 5;
const POLLING_MS = 30000;

@Component({
  selector: 'app-rpct-detail',
  templateUrl: './rpct-detail.component.html',
  standalone: false,
  styleUrls: ['./rpct-spinner.css', './rpct-detail.component.css'],
  providers: [RpctCountsService, RpctScanService, RpctAtmapService]
})
export class RpctDetailComponent implements OnInit, OnDestroy {

  readonly t = RPCT_TOOLTIPS;
  readonly pageSize = PAGE_SIZE;
  readonly koLimit = KO_LIMIT;

  codiceIpa: string | null = null;
  accessDenied = false;
  isLoading = true;

  company: Company | null = null;
  lastWorkflow: Workflow | null = null;
  lastOrigin: RpctScanOrigin | null = null;
  // Spec 011: conteggi dell'ultima scansione completata (sezioni della regola, come il gauge)
  lastCounts: RpctCounts | null = null;
  hasRunning = false;
  nonConformi: RpctNonConforme[] = [];
  koExpanded = false;
  isStartingScan = false;

  // Spec 011: storico completo (dedicate + globali), 5 per pagina, conteggi solo per la pagina visibile
  historyRows: HistoryRow[] = [];
  historyPage = 1;
  private countsCache = new Map<string, RpctCounts | null>();
  private pendingCounts = new Set<string>();

  // Spec 008: ultima AT map della PA (null = in caricamento)
  atMapState: RpctAtMapState | null = null;

  // Spec 006: scansione globale in corso (confermata dal Conductor), blocca l'avvio manuale
  hasGlobalRunning = false;

  // Spec 003: workflowId delle scansioni dedicate in corso, seguite con polling
  private runningIds = new Set<string>();
  // Spec 006: workflowId delle scansioni globali in corso, seguite con lo stesso polling
  private globalRunningIds = new Set<string>();
  private pollingSub: Subscription | null = null;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private oidcSecurityService: OidcSecurityService,
    private authGuard: AuthGuard,
    private companyService: CompanyService,
    private rpctCountsService: RpctCountsService,
    private rpctScanService: RpctScanService,
    private apiMessageService: ApiMessageService,
    private rpctAtmapService: RpctAtmapService
  ) {}

  ngOnInit(): void {
    const ipaFromUrl = this.route.snapshot.params['codiceIpa'];

    if (this.authGuard.isDevAuthBypassEnabled()) {
      this.codiceIpa = ipaFromUrl;
      this.loadData(ipaFromUrl);
      return;
    }

    if (!environment.oidc.enable) {
      this.accessDenied = true;
      this.isLoading = false;
      return;
    }

    this.oidcSecurityService.userData$.pipe(
      filter(({ userData }) => !!userData?.rpct_ipas?.length),
      take(1)
    ).subscribe(({ userData }) => {
      const allowedIpas: string[] = userData?.rpct_ipas || [];
      if (allowedIpas.includes(ipaFromUrl)) {
        this.codiceIpa = ipaFromUrl;
        this.loadData(ipaFromUrl);
      } else {
        this.accessDenied = true;
        this.isLoading = false;
      }
    });
  }

  private loadData(codiceIpa: string): void {
    // Spec 008: AT map caricata a parte, non blocca la pagina
    this.rpctAtmapService.last(codiceIpa).subscribe(state => this.atMapState = state);

    // Spec 001: scansioni = dedicate + globali; conteggi sempre filtrati per codiceIpa
    forkJoin({
      companies: this.companyService.getAll({ codiceIpa, size: 1 }).pipe(catchError(() => of([]))),
      scans: this.rpctCountsService.listGlobalScans(true).pipe(
        switchMap(globals => this.rpctCountsService.listScans(codiceIpa, globals, true))
      )
    }).pipe(
      switchMap(({ companies, scans }) => {
        this.company = (companies as Company[])[0] || null;

        // hasRunning = dedicate; hasGlobalRunning = globali confermate dal Conductor (spec 006)
        const running = scans.filter(s => s.origin === 'dedicata' && s.workflow.isRunning);
        this.hasRunning = running.length > 0;
        this.runningIds = new Set(running.map(s => s.workflow.workflowId));
        this.setGlobalRunning(scans);
        const last = scans.find(s => s.workflow.isCompleted);
        this.lastWorkflow = last?.workflow || null;
        this.lastOrigin = last?.origin || null;

        // Spec 011: report e sezioni non conformi dalla stessa fonte dei conteggi (sezioni della regola)
        const lastCountsCall = this.lastWorkflow
          ? this.rpctCountsService.countFor(codiceIpa, this.lastWorkflow.workflowId, this.lastWorkflow.root_rule)
          : of(null);

        return lastCountsCall.pipe(map(lastCounts => ({ scans, lastCounts })));
      })
    ).subscribe(({ scans, lastCounts }) => {
      this.lastCounts = lastCounts && lastCounts.hasResults ? lastCounts : null;
      this.nonConformi = this.lastCounts?.nonConformi || [];
      if (this.lastWorkflow && lastCounts) this.countsCache.set(this.lastWorkflow.workflowId, lastCounts);

      this.historyRows = scans.map((scan: RpctScan) => this.toHistoryRow(scan));
      this.historyPage = Math.min(this.historyPage, this.historyPages);

      this.isLoading = false;
      this.loadPageCounts();
      this.syncPolling();
    });
  }

  private toHistoryRow(scan: RpctScan): HistoryRow {
    const w = scan.workflow;
    const row: HistoryRow = {
      workflowId: w.workflowId,
      startTime: w.startTime,
      status: w.status,
      badge: w.badge,
      origin: scan.origin,
      rootRule: w.root_rule || null
    };
    if (!w.isRunning && this.countsCache.has(w.workflowId)) row.counts = this.countsCache.get(w.workflowId);
    return row;
  }

  /** Spec 011: conteggi per le righe della pagina visibile; quelli delle scansioni terminate restano in cache. */
  private loadPageCounts(): void {
    if (!this.codiceIpa) return;
    const codiceIpa = this.codiceIpa;
    this.historyItems
      .filter(row => row.counts === undefined && !this.isRunning(row.status) && !this.pendingCounts.has(row.workflowId))
      .forEach(row => {
        this.pendingCounts.add(row.workflowId);
        this.rpctCountsService.countFor(codiceIpa, row.workflowId, row.rootRule).subscribe(counts => {
          this.pendingCounts.delete(row.workflowId);
          this.countsCache.set(row.workflowId, counts);
          row.counts = counts;
        });
      });
  }

  /** Spec 006: globali in corso (origin 'globale', già confermate dal Conductor). */
  private setGlobalRunning(scans: RpctScan[]): void {
    this.globalRunningIds = new Set(
      scans.filter(s => s.origin === 'globale' && s.workflow.isRunning).map(s => s.workflow.workflowId)
    );
    this.hasGlobalRunning = this.globalRunningIds.size > 0;
  }

  /**
   * Spec 003: avvia la scansione e la mostra subito nello storico come RUNNING.
   * Spec 006: prima ricontrolla le globali; se una è in corso non avvia e blocca il pulsante.
   */
  startScan(): void {
    if (!this.codiceIpa || this.hasRunning || this.hasGlobalRunning || this.isStartingScan) return;
    const codiceIpa = this.codiceIpa;
    this.isStartingScan = true;
    this.rpctCountsService.listGlobalScans(true).subscribe(globals => {
      if (globals.some(s => s.workflow.isRunning)) {
        this.setGlobalRunning(globals);
        this.isStartingScan = false;
        this.apiMessageService.sendMessage(
          MessageType.WARNING,
          'È in corso una scansione globale: la scansione manuale potrà essere avviata al termine.'
        );
        this.syncPolling();
        return;
      }
      this.startDedicatedScan(codiceIpa);
    });
  }

  /** Spec 003: avvio effettivo (invariato), dopo il ricontrollo delle globali. */
  private startDedicatedScan(codiceIpa: string): void {
    this.rpctScanService.start(codiceIpa).subscribe({
      next: workflowId => {
        this.isStartingScan = false;
        this.apiMessageService.sendMessage(MessageType.SUCCESS, `Scansione avviata per ${codiceIpa}.`);
        this.historyRows = [{
          workflowId,
          startTime: new Date(),
          status: Status.RUNNING,
          badge: 'primary',
          origin: 'dedicata' as RpctScanOrigin,
          rootRule: null
        }, ...this.historyRows];
        // Spec 011: torna alla prima pagina per mostrare la riga in corso
        this.historyPage = 1;
        this.hasRunning = true;
        this.runningIds.add(workflowId);
        this.syncPolling();
      },
      error: (error: HttpErrorResponse) => {
        this.isStartingScan = false;
        // Spec 009: 409 = scansione della PA già in corso → ricarica per mostrare riga e blocco
        const { message, alreadyRunning } = this.rpctScanService.startErrorMessage(error, codiceIpa);
        this.apiMessageService.sendMessage(alreadyRunning ? MessageType.WARNING : MessageType.ERROR, message);
        if (alreadyRunning) this.loadData(codiceIpa);
      }
    });
  }

  /**
   * Polling ogni 30s dello stato delle scansioni in corso, dedicate e globali (spec 003, 006).
   * Quando una termina ricarica i dati: loadData() ricalcola i blocchi e riavvia il polling se serve.
   */
  private syncPolling(): void {
    const ids = [...this.runningIds, ...this.globalRunningIds];
    if (ids.length === 0) {
      this.stopPolling();
      return;
    }
    if (this.pollingSub) return;
    this.pollingSub = timer(POLLING_MS, POLLING_MS).pipe(
      switchMap(() => forkJoin([...this.runningIds, ...this.globalRunningIds].map(id =>
        this.rpctScanService.status(id).pipe(map(workflow => ({ id, workflow })))
      )))
    ).subscribe(results => {
      let ended = false;
      results.forEach(({ id, workflow }) => {
        // null = Conductor non raggiungibile: nessun cambiamento (resta in corso)
        if (!workflow) return;
        const row = this.historyRows.find(r => r.workflowId === id);
        if (row) {
          row.status = workflow.status;
          row.badge = workflow.badge;
        }
        if (!workflow.isRunning) {
          this.runningIds.delete(id);
          this.globalRunningIds.delete(id);
          ended = true;
        }
      });
      if (ended && this.codiceIpa) {
        this.stopPolling();
        this.hasRunning = this.runningIds.size > 0;
        this.hasGlobalRunning = this.globalRunningIds.size > 0;
        this.loadData(this.codiceIpa);
      }
    });
  }

  private stopPolling(): void {
    this.pollingSub?.unsubscribe();
    this.pollingSub = null;
  }

  ngOnDestroy(): void {
    this.stopPolling();
  }

  /** Spec 005: scansione in corso (riga evidenziata + spinner). */
  isRunning(status: string | null | undefined): boolean {
    return isRunningStatus(status);
  }

  /** Spec 011: etichetta e colore dello stato con la dicitura del design. */
  stateLabel(status: string | null | undefined): string {
    return rpctStateLabel(status);
  }

  stateClass(status: string | null | undefined): string {
    return rpctStateClass(status);
  }

  /** Spec 011: scansione in corso mostrata nella card Scansione (la dedicata prevale sulla globale). */
  get runningKind(): RpctScanOrigin | null {
    return this.hasRunning ? 'dedicata' : this.hasGlobalRunning ? 'globale' : null;
  }

  get runningStartedAt(): Date | null {
    const kind = this.runningKind;
    return this.historyRows.find(r => r.origin === kind && this.isRunning(r.status))?.startTime || null;
  }

  /** Spec 011: sezioni non conformi, al massimo 5 se la lista non è espansa. */
  get visibleKo(): RpctNonConforme[] {
    return this.koExpanded ? this.nonConformi : this.nonConformi.slice(0, this.koLimit);
  }

  get historyPages(): number {
    return Math.max(1, Math.ceil(this.historyRows.length / this.pageSize));
  }

  get historyItems(): HistoryRow[] {
    const start = (this.historyPage - 1) * this.pageSize;
    return this.historyRows.slice(start, start + this.pageSize);
  }

  /** Spec 011: "1–5 di 12". */
  get historyRange(): string {
    const total = this.historyRows.length;
    const start = (this.historyPage - 1) * this.pageSize;
    return `${total ? start + 1 : 0}–${Math.min(total, start + this.pageSize)} di ${total}`;
  }

  goToHistoryPage(page: number): void {
    this.historyPage = Math.min(Math.max(1, page), this.historyPages);
    this.loadPageCounts();
  }

  goToSearch(workflowId?: string): void {
    const params: any = { codiceIpa: this.codiceIpa };
    if (workflowId) params.workflowId = workflowId;
    this.router.navigate(['/search'], { queryParams: params });
  }

  /** Spec 008: pagina AT map della PA. */
  goToAtmap(): void {
    this.router.navigate(['/dashboard', this.codiceIpa, 'atmap']);
  }

  goBack(): void {
    this.router.navigate(['/dashboard']);
  }
}
