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
}

@Component({
  selector: 'app-rpct-dashboard',
  templateUrl: './rpct-dashboard.component.html',
  standalone: false,
  providers: [RpctCountsService]
})
export class RpctDashboardComponent implements OnInit {

  rows: RpctTableRow[] = [];
  userName: string = '';
  isLoading = true;

  constructor(
    private oidcSecurityService: OidcSecurityService,
    private companyService: CompanyService,
    private rpctCountsService: RpctCountsService,
    private authGuard: AuthGuard,
    private router: Router
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
      loading: true
    }));

    // Spec 001: ultima scansione completata tra dedicate + globali, conteggi filtrati per codiceIpa
    this.rpctCountsService.listGlobalScans().pipe(
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

  goToDetail(codiceIpa: string): void {
    this.router.navigate(['/dashboard', codiceIpa]);
  }
}
