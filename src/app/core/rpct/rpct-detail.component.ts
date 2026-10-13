import { Component, OnDestroy, OnInit } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, Router } from '@angular/router';
import { filter, take, catchError, switchMap, map, distinctUntilChanged, takeUntil, tap } from 'rxjs/operators';
import { forkJoin, Observable, of, Subject, Subscription, timer } from 'rxjs';
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
import { rpctIpas } from './rpct-user';

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

/** Spec 010: dati di un caricamento completo della pagina (solo l'ultimo richiesto viene applicato). */
interface DetailData {
  codiceIpa: string;
  company: Company | null;
  scans: RpctScan[];
  globalsFailed: boolean;
  last: RpctScan | null;
  lastCounts: RpctCounts | null;
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
  // Spec 010 (F4): elenco delle globali non leggibile: avvio bloccato finché la verifica non riesce
  globalCheckFailed = false;
  // Spec 010 (F5): sessione scaduta durante l'avvio
  sessionExpired = false;

  // Spec 003: workflowId delle scansioni dedicate in corso, seguite con polling
  private runningIds = new Set<string>();
  // Spec 006: workflowId delle scansioni globali in corso, seguite con lo stesso polling
  private globalRunningIds = new Set<string>();
  // Spec 010 (F10): scansioni avviate dalla pagina non ancora elencate dal backend
  private pendingStarts = new Map<string, HistoryRow>();
  private pollingSub: Subscription | null = null;
  private atmapSub: Subscription | null = null;

  // Spec 010 (F1, F10): ricaricamenti in coda (vince l'ultimo) e chiusura di tutto all'uscita
  private reload$ = new Subject<string>();
  private destroy$ = new Subject<void>();
  private destroyed = false;

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
    this.reload$.pipe(
      tap(codiceIpa => this.loadAtmap(codiceIpa)),
      switchMap(codiceIpa => this.load(codiceIpa)),
      takeUntil(this.destroy$)
    ).subscribe(data => this.apply(data));

    // Spec 010 (F11c): la pagina segue il codice nell'URL e rifà il controllo di accesso a ogni cambio
    this.route.paramMap.pipe(
      map(params => params.get('codiceIpa') || ''),
      distinctUntilChanged(),
      switchMap(codiceIpa => this.isAllowed(codiceIpa).pipe(map(allowed => ({ codiceIpa, allowed })))),
      takeUntil(this.destroy$)
    ).subscribe(({ codiceIpa, allowed }) => {
      this.reset();
      if (allowed) {
        this.codiceIpa = codiceIpa;
        this.reload();
      } else {
        this.accessDenied = true;
        this.isLoading = false;
      }
    });
  }

  /** Spec 010 (F2, F3): attende i dati utente e confronta il codice con rpct_ipas normalizzato. */
  private isAllowed(codiceIpa: string): Observable<boolean> {
    if (this.authGuard.isDevAuthBypassEnabled()) return of(true);
    if (!environment.oidc.enable) return of(false);
    return this.oidcSecurityService.userData$.pipe(
      filter(({ userData }) => !!userData),
      take(1),
      map(({ userData }) => rpctIpas(userData).includes(codiceIpa))
    );
  }

  /** Spec 010 (F11c): stato iniziale per un nuovo codice IPA. */
  private reset(): void {
    this.stopPolling();
    this.atmapSub?.unsubscribe();
    this.codiceIpa = null;
    this.accessDenied = false;
    this.isLoading = true;
    this.company = null;
    this.lastWorkflow = null;
    this.lastOrigin = null;
    this.lastCounts = null;
    this.nonConformi = [];
    this.koExpanded = false;
    this.isStartingScan = false;
    this.historyRows = [];
    this.historyPage = 1;
    this.countsCache.clear();
    this.pendingCounts.clear();
    this.pendingStarts.clear();
    this.atMapState = null;
    this.hasRunning = false;
    this.hasGlobalRunning = false;
    this.globalCheckFailed = false;
    this.sessionExpired = false;
    this.runningIds.clear();
    this.globalRunningIds.clear();
  }

  /** Richiede un nuovo caricamento della PA corrente (spec 010 F10: annulla quello in corso). */
  reload(): void {
    if (this.codiceIpa && !this.destroyed) this.reload$.next(this.codiceIpa);
  }

  /** Spec 008: AT map caricata a parte, non blocca la pagina. */
  private loadAtmap(codiceIpa: string): void {
    this.atmapSub?.unsubscribe();
    this.atmapSub = this.rpctAtmapService.last(codiceIpa).pipe(takeUntil(this.destroy$))
      .subscribe(state => this.atMapState = state);
  }

  /** Spec 001/006/011: azienda, scansioni (dedicate + globali) e conteggi dell'ultima completata. */
  private load(codiceIpa: string): Observable<DetailData> {
    // Spec 010 (F4): distingue "nessuna globale" da "globali non leggibili"
    const globals$ = this.rpctCountsService.globalScans(true).pipe(
      map(globals => ({ globals, failed: false })),
      catchError(() => of({ globals: [] as RpctScan[], failed: true }))
    );
    return forkJoin({
      companies: this.companyService.getAll({ codiceIpa, size: 1 }).pipe(catchError(() => of([]))),
      globals: globals$
    }).pipe(
      switchMap(({ companies, globals }) => this.rpctCountsService.listScans(codiceIpa, globals.globals, true).pipe(
        switchMap(scans => {
          const last = scans.find(s => s.workflow.isCompleted) || null;
          const lastCounts$ = last
            ? this.rpctCountsService.countFor(codiceIpa, last.workflow.workflowId, last.workflow.root_rule)
            : of(null);
          return lastCounts$.pipe(map(lastCounts => ({
            codiceIpa,
            company: (companies as Company[])[0] || null,
            scans,
            globalsFailed: globals.failed,
            last,
            lastCounts
          })));
        })
      ))
    );
  }

  private apply(data: DetailData): void {
    if (data.codiceIpa !== this.codiceIpa) return;
    this.company = data.company;
    this.globalCheckFailed = data.globalsFailed;

    // Spec 010 (F10): le scansioni appena avviate restano finché il backend non le elenca
    const listed = new Set(data.scans.map(s => s.workflow.workflowId));
    [...this.pendingStarts.keys()].filter(id => listed.has(id)).forEach(id => this.pendingStarts.delete(id));

    // hasRunning = dedicate; hasGlobalRunning = globali confermate dal Conductor (spec 006)
    const running = data.scans.filter(s => s.origin === 'dedicata' && s.workflow.isRunning);
    this.runningIds = new Set([...running.map(s => s.workflow.workflowId), ...this.pendingStarts.keys()]);
    this.hasRunning = this.runningIds.size > 0;
    this.setGlobalRunning(data.scans);

    this.lastWorkflow = data.last?.workflow || null;
    this.lastOrigin = data.last?.origin || null;
    // Spec 011: report e sezioni non conformi dalla stessa fonte dei conteggi (sezioni della regola)
    this.lastCounts = data.lastCounts && data.lastCounts.hasResults ? data.lastCounts : null;
    this.nonConformi = this.lastCounts?.nonConformi || [];
    if (this.lastWorkflow && data.lastCounts) this.countsCache.set(this.lastWorkflow.workflowId, data.lastCounts);

    this.historyRows = [...this.pendingStarts.values(), ...data.scans.map(scan => this.toHistoryRow(scan))];
    this.historyPage = Math.min(this.historyPage, this.historyPages);

    this.isLoading = false;
    this.loadPageCounts();
    this.syncPolling();
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
        this.rpctCountsService.countFor(codiceIpa, row.workflowId, row.rootRule).pipe(
          takeUntil(this.destroy$)
        ).subscribe(counts => {
          // I conteggi sono per PA: una risposta arrivata dopo un cambio di codice si scarta
          if (codiceIpa !== this.codiceIpa) return;
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

  /** Spec 003/006/010: pulsante disabilitato se una scansione è in corso o la verifica non è possibile. */
  get startDisabled(): boolean {
    return this.hasRunning || this.hasGlobalRunning || this.globalCheckFailed || this.isLoading || this.isStartingScan;
  }

  /**
   * Spec 003: avvia la scansione e la mostra subito nello storico come RUNNING.
   * Spec 006: prima ricontrolla le globali; se una è in corso non avvia e blocca il pulsante.
   * Spec 010 (F4): se le globali non si possono leggere non avvia.
   */
  startScan(): void {
    if (!this.codiceIpa || this.startDisabled) return;
    const codiceIpa = this.codiceIpa;
    this.isStartingScan = true;
    this.sessionExpired = false;
    this.rpctCountsService.globalScans(true).pipe(takeUntil(this.destroy$)).subscribe({
      next: globals => {
        if (codiceIpa !== this.codiceIpa) return;
        this.globalCheckFailed = false;
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
      },
      error: () => {
        if (codiceIpa !== this.codiceIpa) return;
        this.isStartingScan = false;
        this.globalCheckFailed = true;
        this.apiMessageService.sendMessage(
          MessageType.WARNING,
          'Impossibile verificare se è in corso una scansione globale: la scansione non è stata avviata. Riprova più tardi.'
        );
      }
    });
  }

  /** Spec 003: avvio effettivo, dopo il ricontrollo delle globali. */
  private startDedicatedScan(codiceIpa: string): void {
    this.rpctScanService.start(codiceIpa).pipe(takeUntil(this.destroy$)).subscribe({
      next: workflowId => {
        if (codiceIpa !== this.codiceIpa) return;
        this.isStartingScan = false;
        this.apiMessageService.sendMessage(MessageType.SUCCESS, `Scansione avviata per ${codiceIpa}.`);
        // Spec 010 (F9): senza id non si può seguire la scansione → si ricarica dal backend
        if (!workflowId) {
          this.reload();
          return;
        }
        const row: HistoryRow = {
          workflowId,
          startTime: new Date(),
          status: Status.RUNNING,
          badge: 'primary',
          origin: 'dedicata',
          rootRule: null
        };
        this.pendingStarts.set(workflowId, row);
        this.historyRows = [row, ...this.historyRows];
        // Spec 011: torna alla prima pagina per mostrare la riga in corso
        this.historyPage = 1;
        this.hasRunning = true;
        this.runningIds.add(workflowId);
        this.syncPolling();
      },
      error: (error: HttpErrorResponse) => {
        this.isAuthenticated().subscribe(authenticated => {
          if (codiceIpa !== this.codiceIpa) return;
          this.isStartingScan = false;
          // Spec 009: 409 = scansione della PA già in corso → ricarica per mostrare riga e blocco
          // Spec 010 (F5): 401 o sessione non più valida → invito a rifare l'accesso
          const { message, alreadyRunning, sessionExpired } =
            this.rpctScanService.startErrorMessage(error, codiceIpa, authenticated);
          this.sessionExpired = sessionExpired;
          this.apiMessageService.sendMessage(alreadyRunning ? MessageType.WARNING : MessageType.ERROR, message);
          if (alreadyRunning) this.reload();
        });
      }
    });
  }

  private isAuthenticated(): Observable<boolean> {
    if (this.authGuard.isDevAuthBypassEnabled() || !environment.oidc.enable) return of(true);
    return this.oidcSecurityService.isAuthenticated$.pipe(
      take(1),
      map(result => !!result?.isAuthenticated),
      catchError(() => of(false)),
      takeUntil(this.destroy$)
    );
  }

  /**
   * Spec 010 (F5): chiude la sessione locale e ricarica: la guard OIDC esistente porta al login
   * e, dopo l'accesso, riporta a questa pagina (flusso "Login OIDC + redirect post-login").
   */
  relogin(): void {
    this.oidcSecurityService.logoffLocal();
    window.location.reload();
  }

  /**
   * Polling ogni 30s dello stato delle scansioni in corso, dedicate e globali (spec 003, 006).
   * Quando una termina ricarica i dati: apply() ricalcola i blocchi e riavvia il polling se serve.
   * Spec 010 (F1): mai dopo l'uscita dalla pagina.
   */
  private syncPolling(): void {
    if (this.destroyed) return;
    const ids = [...this.runningIds, ...this.globalRunningIds];
    if (ids.length === 0) {
      this.stopPolling();
      return;
    }
    if (this.pollingSub) return;
    this.pollingSub = timer(POLLING_MS, POLLING_MS).pipe(
      switchMap(() => forkJoin([...this.runningIds, ...this.globalRunningIds].map(id =>
        this.rpctScanService.status(id).pipe(map(workflow => ({ id, workflow })))
      ))),
      takeUntil(this.destroy$)
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
          this.pendingStarts.delete(id);
          ended = true;
        }
      });
      if (ended) {
        this.stopPolling();
        this.hasRunning = this.runningIds.size > 0;
        this.hasGlobalRunning = this.globalRunningIds.size > 0;
        this.reload();
      }
    });
  }

  private stopPolling(): void {
    this.pollingSub?.unsubscribe();
    this.pollingSub = null;
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    this.stopPolling();
    this.destroy$.next();
    this.destroy$.complete();
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
