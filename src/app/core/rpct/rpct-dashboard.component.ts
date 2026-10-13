import { Component, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { forkJoin, of, Subject } from 'rxjs';
import { catchError, filter, switchMap, take, takeUntil } from 'rxjs/operators';
import { OidcSecurityService } from 'angular-auth-oidc-client';
import { CompanyService } from '../company/company.service';
import { Company } from '../company/company.model';
import { Workflow } from '../conductor/workflow.model';
import { environment } from '../../../environments/environment';
import { AuthGuard } from '../../auth/auth-guard';
import { RpctCountsService, RpctScan, RpctScanOrigin } from './rpct-counts.service';
import { isRunningStatus } from './rpct-status';
import { RpctAtmapService, RpctAtMapStatus } from './rpct-atmap.service';
import { RPCT_TOOLTIPS } from './rpct-tooltips';
import { rpctIpas } from './rpct-user';

interface RpctTableRow {
  codiceIpa: string;
  denominazioneEnte: string;
  lastScanDate: Date | null;
  workflowId: string | null;
  origin: RpctScanOrigin | null;
  sezioniOk: number | null;
  // Spec 011: sezioni della regola (es. 52) e non conformi = sezioni senza esito OK
  total: number | null;
  sezioniNonRegolari: number | null;
  loading: boolean;
  // Spec 005/011: scansione in corso per la PA (la dedicata prevale sulla globale)
  running: RpctScanOrigin | null;
  // Spec 008: AT map dell'ultima scansione completata ('loading' finché la chiamata non risponde)
  atmap: RpctAtMapStatus | 'loading';
}

const PAGE_SIZE = 5;

@Component({
  selector: 'app-rpct-dashboard',
  templateUrl: './rpct-dashboard.component.html',
  standalone: false,
  styleUrls: ['./rpct-spinner.css', './rpct-dashboard.component.css'],
  providers: [RpctCountsService, RpctAtmapService]
})
export class RpctDashboardComponent implements OnInit, OnDestroy {

  readonly t = RPCT_TOOLTIPS;
  readonly pageSize = PAGE_SIZE;

  rows: RpctTableRow[] = [];
  userName: string = '';
  isLoading = true;

  // Spec 011: ricerca per nome o codice IPA e paginazione lato client (5 per pagina)
  search = '';
  page = 1;

  // Spec 010 (F1): chiude tutte le chiamate quando si lascia la pagina
  private destroy$ = new Subject<void>();

  constructor(
    private oidcSecurityService: OidcSecurityService,
    private companyService: CompanyService,
    private rpctCountsService: RpctCountsService,
    private authGuard: AuthGuard,
    private router: Router,
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

    // Spec 010 (F2): aspetta i dati utente e decide anche se rpct_ipas manca o è vuoto
    this.oidcSecurityService.userData$.pipe(
      filter(({ userData }) => !!userData),
      take(1),
      takeUntil(this.destroy$)
    ).subscribe(({ userData }) => {
      this.loadData(userData);
    });
  }

  private loadData(userData: any): void {
    this.userName = userData?.name || '';
    const ipas: string[] = rpctIpas(userData);

    if (ipas.length === 0) {
      this.isLoading = false;
      return;
    }

    this.rows = ipas.map(ipa => ({
      codiceIpa: ipa,
      denominazioneEnte: ipa,
      lastScanDate: null,
      workflowId: null,
      origin: null,
      sezioniOk: null,
      total: null,
      sezioniNonRegolari: null,
      loading: true,
      running: null,
      atmap: 'loading'
    }));

    // Spec 008: stato AT map per PA, indipendente dal resto della tabella
    this.rows.forEach(row => this.rpctAtmapService.last(row.codiceIpa).pipe(takeUntil(this.destroy$))
      .subscribe(res => row.atmap = res.state));

    // Spec 001: ultima scansione completata tra dedicate + globali, conteggi filtrati per codiceIpa
    this.rpctCountsService.listGlobalScans(true).pipe(
      switchMap(globals => forkJoin(ipas.map(ipa =>
        forkJoin({
          companies: this.companyService.getAll({ codiceIpa: ipa, size: 1 }).pipe(catchError(() => of([]))),
          // Spec 010 (F8): dedicate in corso confermate dal Conductor, come nel dettaglio
          scans: this.rpctCountsService.listScans(ipa, globals, true)
        })
      ))),
      takeUntil(this.destroy$)
    ).subscribe(results => {
      results.forEach((res, i) => {
        const row = this.rows[i];
        const company: Company = res.companies?.[0];
        if (company) row.denominazioneEnte = company.denominazioneEnte;
        const running = res.scans.filter(scan => isRunningStatus(scan.workflow.status));
        row.running = running.some(s => s.origin === 'dedicata') ? 'dedicata' : running.length ? 'globale' : null;

        const last: RpctScan | undefined = res.scans.find(scan => scan.workflow.isCompleted);
        if (!last) {
          row.loading = false;
          return;
        }
        const workflow: Workflow = last.workflow;
        row.workflowId = workflow.workflowId;
        row.lastScanDate = workflow.startTime;
        row.origin = last.origin;

        this.rpctCountsService.countFor(row.codiceIpa, workflow.workflowId, workflow.root_rule).pipe(
          takeUntil(this.destroy$)
        ).subscribe(counts => {
          // Spec 011: senza risultati per la PA i conteggi restano "—" (mai uno 0 conforme)
          const valid = counts && counts.hasResults ? counts : null;
          row.sezioniOk = valid ? valid.sezioniOk : null;
          row.total = valid ? valid.total : null;
          row.sezioniNonRegolari = valid ? valid.sezioniNonRegolari : null;
          row.loading = false;
        });
      });
      this.isLoading = false;
    });
  }

  /** Spec 011: righe filtrate dalla ricerca (nome o codice IPA). */
  get filtered(): RpctTableRow[] {
    const q = this.search.trim().toLowerCase();
    if (!q) return this.rows;
    return this.rows.filter(r => r.denominazioneEnte.toLowerCase().includes(q) || r.codiceIpa.toLowerCase().includes(q));
  }

  get pages(): number {
    return Math.max(1, Math.ceil(this.filtered.length / this.pageSize));
  }

  get pageRows(): RpctTableRow[] {
    const start = (Math.min(this.page, this.pages) - 1) * this.pageSize;
    return this.filtered.slice(start, start + this.pageSize);
  }

  /** Spec 011: "1–5 di 12". */
  get rangeLabel(): string {
    const total = this.filtered.length;
    const start = (Math.min(this.page, this.pages) - 1) * this.pageSize;
    return `${total ? start + 1 : 0}–${Math.min(total, start + this.pageSize)} di ${total}`;
  }

  /** Spec 011: riepilogo — amministrazioni con almeno una sezione non conforme nell'ultima scansione. */
  get adminConNonConformita(): number {
    return this.rows.filter(r => (r.sezioniNonRegolari || 0) > 0).length;
  }

  /** Spec 011: riepilogo — scansione più recente tra le ultime completate. */
  get ultimaScansione(): Date | null {
    const dates = this.rows.map(r => r.lastScanDate).filter((d): d is Date => !!d);
    return dates.length ? new Date(Math.max(...dates.map(d => d.getTime()))) : null;
  }

  /** Spec 011: percentuale per la barra "sezioni OK". */
  okPercent(row: RpctTableRow): number {
    return row.total ? Math.round((row.sezioniOk || 0) / row.total * 100) : 0;
  }

  onSearch(): void {
    this.page = 1;
  }

  goTo(page: number): void {
    this.page = Math.min(Math.max(1, page), this.pages);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  goToDetail(codiceIpa: string): void {
    this.router.navigate(['/dashboard', codiceIpa]);
  }
}
