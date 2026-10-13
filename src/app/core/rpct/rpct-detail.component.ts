import { Component, OnDestroy, OnInit } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, Router } from '@angular/router';
import { filter, take, catchError, switchMap, map } from 'rxjs/operators';
import { forkJoin, of, Subscription, timer } from 'rxjs';
import { OidcSecurityService } from 'angular-auth-oidc-client';
import { environment } from '../../../environments/environment';
import { AuthGuard } from '../../auth/auth-guard';
import { CompanyService } from '../company/company.service';
import { ResultService } from '../result/result.service';
import { Company } from '../company/company.model';
import { Workflow, Status } from '../conductor/workflow.model';
import { Result } from '../result/result.model';
import { RpctCountsService, RpctScan, RpctScanOrigin } from './rpct-counts.service';
import { RpctScanService } from './rpct-scan.service';
import { ApiMessageService, MessageType } from '../api-message.service';
import { TranslateService } from '@ngx-translate/core';
import { isRunningStatus, rpctStatusLabel, RPCT_RUNNING_ROW_CLASS } from './rpct-status';

interface HistoryRow {
  workflowId: string;
  startTime: Date;
  status: string;
  badge: string;
  sezioniOk: number | null;
  sezioniNonRegolari: number | null;
  origin: RpctScanOrigin;
}

const HISTORY_SIZE = 10;
const POLLING_MS = 30000;

@Component({
  selector: 'app-rpct-detail',
  templateUrl: './rpct-detail.component.html',
  standalone: false,
  styleUrls: ['./rpct-spinner.css'],
  providers: [RpctCountsService, RpctScanService]
})
export class RpctDetailComponent implements OnInit, OnDestroy {

  codiceIpa: string | null = null;
  accessDenied = false;
  isLoading = true;

  company: Company | null = null;
  lastWorkflow: Workflow | null = null;
  hasRunning = false;
  nonConformi: Result[] = [];
  historyRows: HistoryRow[] = [];
  isStartingScan = false;

  // Spec 005: riga verde chiaro per le scansioni in corso
  readonly runningRowClass = RPCT_RUNNING_ROW_CLASS;

  // Spec 003: workflowId delle scansioni dedicate in corso, seguite con polling
  private runningIds = new Set<string>();
  private pollingSub: Subscription | null = null;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private oidcSecurityService: OidcSecurityService,
    private authGuard: AuthGuard,
    private companyService: CompanyService,
    private resultService: ResultService,
    private rpctCountsService: RpctCountsService,
    private rpctScanService: RpctScanService,
    private apiMessageService: ApiMessageService,
    private translateService: TranslateService
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
    // Spec 001: scansioni = dedicate + globali; conteggi sempre filtrati per codiceIpa
    forkJoin({
      companies: this.companyService.getAll({ codiceIpa, size: 1 }).pipe(catchError(() => of([]))),
      scans: this.rpctCountsService.listGlobalScans().pipe(
        switchMap(globals => this.rpctCountsService.listScans(codiceIpa, globals, true))
      )
    }).pipe(
      switchMap(({ companies, scans }) => {
        this.company = (companies as Company[])[0] || null;

        // hasRunning solo sulle dedicate: una globale gira ~2 giorni ogni 6 (spec 001 research)
        const running = scans.filter(s => s.origin === 'dedicata' && s.workflow.isRunning);
        this.hasRunning = running.length > 0;
        this.runningIds = new Set(running.map(s => s.workflow.workflowId));
        this.lastWorkflow = scans.find(s => s.workflow.isCompleted)?.workflow || null;

        const history: RpctScan[] = scans.slice(0, HISTORY_SIZE);

        const nonConformiCall = this.lastWorkflow
          ? this.resultService.getAll(
              { codiceIpa, workflowId: this.lastWorkflow.workflowId, size: 500 },
              '/codiceipa/byWorkflow'
            ).pipe(catchError(() => of([])))
          : of([]);

        const countsCall = history.length
          ? forkJoin(history.map(s => this.rpctCountsService.countFor(codiceIpa, s.workflow.workflowId)))
          : of([]);

        return forkJoin({ nonConformi: nonConformiCall, counts: countsCall }).pipe(
          switchMap(({ nonConformi, counts }) => of({ history, nonConformi, counts }))
        );
      })
    ).subscribe(({ history, nonConformi, counts }) => {
      this.nonConformi = (nonConformi as Result[]).filter(
        r => r.status !== 200 && r.status !== 202
      );

      this.historyRows = history.map((scan, i) => {
        const w = scan.workflow;
        const c = counts[i];
        return {
          workflowId: w.workflowId,
          startTime: w.startTime,
          status: w.status,
          badge: w.badge,
          sezioniOk: c ? c.sezioniOk : null,
          sezioniNonRegolari: c ? c.sezioniNonRegolari : null,
          origin: scan.origin
        };
      });

      this.isLoading = false;
      this.syncPolling();
    });
  }

  /** Spec 003: avvia la scansione e la mostra subito nello storico come RUNNING. */
  startScan(): void {
    if (!this.codiceIpa || this.hasRunning || this.isStartingScan) return;
    const codiceIpa = this.codiceIpa;
    this.isStartingScan = true;
    this.rpctScanService.start(codiceIpa).subscribe({
      next: workflowId => {
        this.isStartingScan = false;
        this.apiMessageService.sendMessage(MessageType.SUCCESS, `Scansione avviata per ${codiceIpa}.`);
        this.historyRows = [{
          workflowId,
          startTime: new Date(),
          status: Status.RUNNING,
          badge: 'primary',
          sezioniOk: null,
          sezioniNonRegolari: null,
          origin: 'dedicata' as RpctScanOrigin
        }, ...this.historyRows].slice(0, HISTORY_SIZE);
        this.hasRunning = true;
        this.runningIds.add(workflowId);
        this.syncPolling();
      },
      error: (error: HttpErrorResponse) => {
        this.isStartingScan = false;
        const message = this.rpctScanService.isForbidden(error)
          ? `Non sei autorizzato ad avviare una scansione per ${codiceIpa}.`
          : `Impossibile avviare la scansione (errore ${error?.status ?? 'sconosciuto'}).`;
        this.apiMessageService.sendMessage(MessageType.ERROR, message);
      }
    });
  }

  /** Polling ogni 30s dello stato delle scansioni in corso; a fine scansione ricarica i dati. */
  private syncPolling(): void {
    if (this.runningIds.size === 0) {
      this.stopPolling();
      return;
    }
    if (this.pollingSub) return;
    this.pollingSub = timer(POLLING_MS, POLLING_MS).pipe(
      switchMap(() => forkJoin([...this.runningIds].map(id =>
        this.rpctScanService.status(id).pipe(map(workflow => ({ id, workflow })))
      )))
    ).subscribe(results => {
      results.forEach(({ id, workflow }) => {
        if (!workflow) return;
        const row = this.historyRows.find(r => r.workflowId === id);
        if (row) {
          row.status = workflow.status;
          row.badge = workflow.badge;
        }
        if (!workflow.isRunning) this.runningIds.delete(id);
      });
      if (this.runningIds.size === 0 && this.codiceIpa) {
        this.stopPolling();
        this.hasRunning = false;
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

  /** Spec 005: etichetta italiana dello stato (chiavi esistenti it.workflow.status.*). */
  statusLabel(status: string | null | undefined): string {
    return rpctStatusLabel(this.translateService, status);
  }

  goToSearch(workflowId?: string): void {
    const params: any = { codiceIpa: this.codiceIpa };
    if (workflowId) params.workflowId = workflowId;
    this.router.navigate(['/search'], { queryParams: params });
  }

  goBack(): void {
    this.router.navigate(['/dashboard']);
  }
}
