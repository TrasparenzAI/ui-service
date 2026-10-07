import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { filter, take, catchError, switchMap } from 'rxjs/operators';
import { forkJoin, of } from 'rxjs';
import { OidcSecurityService } from 'angular-auth-oidc-client';
import { environment } from '../../../environments/environment';
import { AuthGuard } from '../../auth/auth-guard';
import { CompanyService } from '../company/company.service';
import { ResultService } from '../result/result.service';
import { Company } from '../company/company.model';
import { Workflow } from '../conductor/workflow.model';
import { Result } from '../result/result.model';
import { RpctCountsService, RpctScan, RpctScanOrigin } from './rpct-counts.service';

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

@Component({
  selector: 'app-rpct-detail',
  templateUrl: './rpct-detail.component.html',
  standalone: false,
  providers: [RpctCountsService]
})
export class RpctDetailComponent implements OnInit {

  codiceIpa: string | null = null;
  accessDenied = false;
  isLoading = true;

  company: Company | null = null;
  lastWorkflow: Workflow | null = null;
  hasRunning = false;
  nonConformi: Result[] = [];
  historyRows: HistoryRow[] = [];

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private oidcSecurityService: OidcSecurityService,
    private authGuard: AuthGuard,
    private companyService: CompanyService,
    private resultService: ResultService,
    private rpctCountsService: RpctCountsService
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
        switchMap(globals => this.rpctCountsService.listScans(codiceIpa, globals))
      )
    }).pipe(
      switchMap(({ companies, scans }) => {
        this.company = (companies as Company[])[0] || null;

        // hasRunning solo sulle dedicate: una globale gira ~2 giorni ogni 6 (spec 001 research)
        this.hasRunning = scans.some(s => s.origin === 'dedicata' && s.workflow.isRunning);
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
    });
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
