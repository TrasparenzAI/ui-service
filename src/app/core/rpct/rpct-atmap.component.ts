import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { filter, take, catchError, map, distinctUntilChanged, switchMap, takeUntil } from 'rxjs/operators';
import { forkJoin, Observable, of, Subject } from 'rxjs';
import { OidcSecurityService } from 'angular-auth-oidc-client';
import { environment } from '../../../environments/environment';
import { AuthGuard } from '../../auth/auth-guard';
import { CompanyService } from '../company/company.service';
import { Company } from '../company/company.model';
import { RpctAtmapService, RpctAtMapState } from './rpct-atmap.service';
import { parseAtMapContent, RpctParsedAtMap } from './rpct-atmap-parser';
import { rpctIpas } from './rpct-user';

/**
 * Spec 008: AT map di una PA (/dashboard/:codiceIpa/atmap), tabella "sezione | link".
 * Stesso controllo di accesso del dettaglio: codiceIpa deve essere in rpct_ipas.
 */
@Component({
  selector: 'app-rpct-atmap',
  templateUrl: './rpct-atmap.component.html',
  standalone: false,
  styleUrls: ['./rpct-spinner.css'],
  providers: [RpctAtmapService]
})
export class RpctAtmapComponent implements OnInit, OnDestroy {

  codiceIpa: string | null = null;
  accessDenied = false;
  isLoading = true;

  company: Company | null = null;
  atMapState: RpctAtMapState | null = null;
  parsed: RpctParsedAtMap | null = null;

  // Spec 010 (F1): chiude le chiamate quando si lascia la pagina
  private destroy$ = new Subject<void>();

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private oidcSecurityService: OidcSecurityService,
    private authGuard: AuthGuard,
    private companyService: CompanyService,
    private rpctAtmapService: RpctAtmapService
  ) {}

  ngOnInit(): void {
    // Spec 010 (F11c): segue il codice nell'URL e rifà il controllo di accesso a ogni cambio
    this.route.paramMap.pipe(
      map(params => params.get('codiceIpa') || ''),
      distinctUntilChanged(),
      switchMap(codiceIpa => this.isAllowed(codiceIpa).pipe(map(allowed => ({ codiceIpa, allowed })))),
      takeUntil(this.destroy$)
    ).subscribe(({ codiceIpa, allowed }) => {
      this.company = null;
      this.atMapState = null;
      this.parsed = null;
      this.codiceIpa = allowed ? codiceIpa : null;
      this.accessDenied = !allowed;
      this.isLoading = allowed;
      if (allowed) this.loadData(codiceIpa);
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

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private loadData(codiceIpa: string): void {
    forkJoin({
      companies: this.companyService.getAll({ codiceIpa, size: 1 }).pipe(catchError(() => of([]))),
      atMap: this.rpctAtmapService.last(codiceIpa)
    }).pipe(takeUntil(this.destroy$)).subscribe(({ companies, atMap }) => {
      if (codiceIpa !== this.codiceIpa) return;
      this.company = (companies as Company[])[0] || null;
      this.atMapState = atMap;
      this.parsed = atMap.state === 'present' && atMap.atMap
        ? parseAtMapContent(atMap.atMap.content, atMap.atMap.format)
        : null;
      this.isLoading = false;
    });
  }

  get discoveredByLabel(): string {
    switch (this.atMapState?.atMap?.discoveredBy) {
      case 'ROBOTS_TXT': return 'robots.txt';
      case 'WELL_KNOWN_URL': return 'indirizzo standard';
      default: return '—';
    }
  }

  get validityLabel(): string {
    const valid = this.atMapState?.atMap?.valid;
    return valid === true ? 'Valida' : valid === false ? 'Non valida' : 'Non verificata';
  }

  goBack(): void {
    if (this.codiceIpa && !this.accessDenied) {
      this.router.navigate(['/dashboard', this.codiceIpa]);
    } else {
      this.router.navigate(['/dashboard']);
    }
  }
}
