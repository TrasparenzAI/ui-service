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

interface HistoryRow {
  workflowId: string;
  startTime: Date;
  status: string;
  badge: string;
  sezioniOk: number;
  sezioniNonRegolari: number;
}

@Component({
  selector: 'app-rpct-detail',
  templateUrl: './rpct-detail.component.html',
  standalone: false
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
    private resultService: ResultService
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
    forkJoin({
      companies: this.companyService.getAll({ codiceIpa, size: 1 }).pipe(catchError(() => of([]))),
      workflows: this.resultService.listWorkflows(codiceIpa, false).pipe(catchError(() => of([])))
    }).pipe(
      switchMap(({ companies, workflows }) => {
        this.company = (companies as Company[])[0] || null;

        const allWorkflows = workflows as Workflow[];
        this.hasRunning = allWorkflows.some(w => w.isRunning);
        const completed = allWorkflows.filter(w => w.isCompleted);
        this.lastWorkflow = completed[0] || null;

        const workflowIds = allWorkflows.map(w => w.workflowId).filter(Boolean);

        const nonConformiCall = this.lastWorkflow
          ? this.resultService.getAll(
              { codiceIpa, workflowId: this.lastWorkflow.workflowId, size: 500 },
              '/codiceipa/byWorkflow'
            ).pipe(catchError(() => of([])))
          : of([]);

        const countsCall = workflowIds.length
          ? this.resultService.getWorkflowMap(undefined, workflowIds).pipe(catchError(() => of(null)))
          : of(null);

        return forkJoin({ nonConformi: nonConformiCall, counts: countsCall }).pipe(
          switchMap(({ nonConformi, counts }) => of({ allWorkflows, nonConformi, counts }))
        );
      })
    ).subscribe(({ allWorkflows, nonConformi, counts }) => {
      this.nonConformi = (nonConformi as Result[]).filter(
        r => r.status !== 200 && r.status !== 202
      );

      this.historyRows = (allWorkflows as Workflow[]).map(w => {
        const c = counts?.[w.workflowId] || {};
        return {
          workflowId: w.workflowId,
          startTime: w.startTime,
          status: w.status,
          badge: w.badge,
          sezioniOk: (c[200] || 0) + (c[202] || 0),
          sezioniNonRegolari: (c[404] || 0) + (c[400] || 0) + (c[500] || 0)
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
