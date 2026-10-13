import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { filter, take, catchError } from 'rxjs/operators';
import { forkJoin, of } from 'rxjs';
import { OidcSecurityService } from 'angular-auth-oidc-client';
import { environment } from '../../../environments/environment';
import { AuthGuard } from '../../auth/auth-guard';
import { CompanyService } from '../company/company.service';
import { Company } from '../company/company.model';
import { RpctAtmapService, RpctAtMapState } from './rpct-atmap.service';
import { parseAtMapContent, RpctParsedAtMap } from './rpct-atmap-parser';

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
export class RpctAtmapComponent implements OnInit {

  codiceIpa: string | null = null;
  accessDenied = false;
  isLoading = true;

  company: Company | null = null;
  atMapState: RpctAtMapState | null = null;
  parsed: RpctParsedAtMap | null = null;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private oidcSecurityService: OidcSecurityService,
    private authGuard: AuthGuard,
    private companyService: CompanyService,
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
    forkJoin({
      companies: this.companyService.getAll({ codiceIpa, size: 1 }).pipe(catchError(() => of([]))),
      atMap: this.rpctAtmapService.last(codiceIpa)
    }).subscribe(({ companies, atMap }) => {
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
