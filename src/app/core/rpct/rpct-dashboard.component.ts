import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { catchError, filter, switchMap, take } from 'rxjs/operators';
import { OidcSecurityService } from 'angular-auth-oidc-client';
import { CompanyService } from '../company/company.service';
import { Company } from '../company/company.model';
import { Workflow, Status } from '../conductor/workflow.model';
import { environment } from '../../../environments/environment';
import { AuthGuard } from '../../auth/auth-guard';
import { RpctCountsService, RpctScan, RpctScanOrigin } from './rpct-counts.service';
import { TranslateService } from '@ngx-translate/core';
import { isRunningStatus, rpctStatusLabel, RPCT_RUNNING_ROW_CLASS } from './rpct-status';
import { RpctAtmapService, RpctAtMapStatus } from './rpct-atmap.service';

interface RpctTableRow {
  codiceIpa: string;
  denominazioneEnte: string;
  lastScanDate: Date | null;
  status: Status | null;
  badge: string;
  sezioniOk: number | null;
  sezioniNonRegolari: number | null;
  workflowId: string | null;
  origin: RpctScanOrigin | null;
  loading: boolean;
  // Spec 005: la PA ha almeno una scansione in corso (dedicata o globale confermata dal Conductor)
  running: boolean;
  // Spec 008: AT map dell'ultima scansione completata ('loading' finché la chiamata non risponde)
  atmap: RpctAtMapStatus | 'loading';
}

@Component({
  selector: 'app-rpct-dashboard',
  templateUrl: './rpct-dashboard.component.html',
  standalone: false,
  styleUrls: ['./rpct-spinner.css'],
  providers: [RpctCountsService, RpctAtmapService]
})
export class RpctDashboardComponent implements OnInit {

  rows: RpctTableRow[] = [];
  userName: string = '';
  isLoading = true;

  // Spec 005: riga verde chiaro per le PA con scansione in corso
  readonly runningRowClass = RPCT_RUNNING_ROW_CLASS;
  readonly runningStatus = Status.RUNNING;

  constructor(
    private oidcSecurityService: OidcSecurityService,
    private companyService: CompanyService,
    private rpctCountsService: RpctCountsService,
    private authGuard: AuthGuard,
    private router: Router,
    private translateService: TranslateService,
    private rpctAtmapService: RpctAtmapService
  ) {}

  ngOnInit(): void {
    if (this.authGuard.isDevAuthBypassEnabled()) {
      this.loadData(this.authGuard.getDevBypassUserData());
      return;
    }
    if (!environment.oidc.enable) {
      this.isLoading = false;
      return;
    }

    // Aspetta userData con rpct_ipas popolato, prende solo la prima emissione valida
    this.oidcSecurityService.userData$.pipe(
      filter(({ userData }) => !!userData?.rpct_ipas?.length),
      take(1)
    ).subscribe(({ userData }) => {
      this.loadData(userData);
    });
  }

  private loadData(userData: any): void {
    this.userName = userData?.name || '';
    const ipas: string[] = userData?.rpct_ipas || [];

    if (ipas.length === 0) {
      this.isLoading = false;
      return;
    }

    this.rows = ipas.map(ipa => ({
      codiceIpa: ipa,
      denominazioneEnte: ipa,
      lastScanDate: null,
      status: null,
      badge: 'secondary',
      sezioniOk: null,
      sezioniNonRegolari: null,
      workflowId: null,
      origin: null,
      loading: true,
      running: false,
      atmap: 'loading'
    }));

    // Spec 008: stato AT map per PA, indipendente dal resto della tabella
    this.rows.forEach(row => this.rpctAtmapService.last(row.codiceIpa).subscribe(res => row.atmap = res.state));

    // Spec 001: ultima scansione completata tra dedicate + globali, conteggi filtrati per codiceIpa
    this.rpctCountsService.listGlobalScans(true).pipe(
      switchMap(globals => forkJoin(ipas.map(ipa =>
        forkJoin({
          companies: this.companyService.getAll({ codiceIpa: ipa, size: 1 }).pipe(catchError(() => of([]))),
          scans: this.rpctCountsService.listScans(ipa, globals)
        })
      )))
    ).subscribe(results => {
      results.forEach((res, i) => {
        const row = this.rows[i];
        const company: Company = res.companies?.[0];
        if (company) row.denominazioneEnte = company.denominazioneEnte;
        row.running = res.scans.some(scan => isRunningStatus(scan.workflow.status));

        const last: RpctScan | undefined = res.scans.find(scan => scan.workflow.isCompleted);
        if (!last) {
          row.loading = false;
          return;
        }
        const workflow: Workflow = last.workflow;
        row.workflowId = workflow.workflowId;
        row.lastScanDate = workflow.startTime;
        row.status = workflow.status;
        row.badge = workflow.badge;
        row.origin = last.origin;

        this.rpctCountsService.countFor(row.codiceIpa, workflow.workflowId).subscribe(counts => {
          row.sezioniOk = counts ? counts.sezioniOk : null;
          row.sezioniNonRegolari = counts ? counts.sezioniNonRegolari : null;
          row.loading = false;
        });
      });
      this.isLoading = false;
    });
  }

  /** Spec 005: etichetta italiana dello stato (chiavi esistenti it.workflow.status.*). */
  statusLabel(status: string | null | undefined): string {
    return rpctStatusLabel(this.translateService, status);
  }

  goToDetail(codiceIpa: string): void {
    this.router.navigate(['/dashboard', codiceIpa]);
  }
}
