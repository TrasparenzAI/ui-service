import { Component, OnInit, ChangeDetectionStrategy, OnDestroy, ViewEncapsulation } from '@angular/core';
import { FormBuilder, FormGroup, FormControl } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { SelectControlOption } from 'design-angular-kit';
import { TranslateService } from '@ngx-translate/core';
import { CodiceCategoria } from '../../common/model/codice-categoria.enum';
import { Regione } from '../../common/model/regione.enum';
import { LoginResponse, OidcSecurityService } from 'angular-auth-oidc-client';
import { environment } from '../../../environments/environment';
import { RoleEnum } from '../../auth/role.enum';
import { AuthGuard } from '../../auth/auth-guard';
import { debounceTime } from 'rxjs';

@Component({
    selector: 'company-search',
    changeDetection: ChangeDetectionStrategy.OnPush,
    encapsulation: ViewEncapsulation.None,
    templateUrl: './company-search.component.html',
    styles: ` 
    @media (max-width: 425px) {
      .btn-xs {
        padding-right: 6px;
        padding-left: 6px;
      }
    }
  `,
    standalone: false
})
export class CompanySearchComponent implements OnInit, OnDestroy{
  
  public filterFormSearch!: FormGroup;
  public collapse: boolean = false;
  options: Array<SelectControlOption> = [];
  optionsCategoria: Array<SelectControlOption> = [{ value: '', text: '*', selected: true }];
  optionsRegione: Array<SelectControlOption> = [{ value: '', text: '*', selected: true }];
  isAdmin: boolean = false;

  constructor(private formBuilder: FormBuilder,
              private route: ActivatedRoute,
              private translateService: TranslateService,
              private oidcSecurityService: OidcSecurityService,
              private authGuard: AuthGuard,
              protected router: Router) {
  }

  ngOnInit(): void {
    if (this.authGuard.isDevAuthBypassEnabled()) {
      this.isAdmin = true;
    } else if (environment.oidc.enable) { 
      if (!environment.oidc.force) {
        this.oidcSecurityService
        .checkAuth()
        .subscribe((loginResponse: LoginResponse) => {
          const { isAuthenticated, userData, accessToken, idToken, configId } =
            loginResponse;
            this.oidcSecurityService.userData$.subscribe(({ userData }) => {
              this.isAdmin = this.authGuard.hasRolesFromUserData([RoleEnum.ADMIN], userData);
            });
        });
      } else {
        this.oidcSecurityService.isAuthenticated$.subscribe(({ isAuthenticated }) => {
          this.oidcSecurityService.userData$.subscribe(({ userData }) => {
            this.isAdmin = this.authGuard.hasRolesFromUserData([RoleEnum.ADMIN], userData);
          });
        });
      }
    }

    this.translateService.get(`it`).subscribe((labels: any) => {
      this.options.push({ value: 'codiceIpa', text: labels?.company?.codiceIpa });
      this.options.push({ value: 'denominazioneEnte', text: labels?.company?.denominazioneEnte });
      this.options.push({ value: 'createdAt,desc', text: labels?.order?.createdAt?.desc });
    });
    Object.keys(CodiceCategoria).forEach((key) => {
      this.optionsCategoria.push({ value: key, text: `${key} - ${CodiceCategoria[key]}`});
    });
    Object.keys(Regione).forEach((key) => {
      this.optionsRegione.push({ value: Regione[key], text: Regione[key]});
    });

    this.route.queryParams.subscribe((queryParams) => {
      if (this.filterFormSearch) {
        this.filterFormSearch.patchValue({
          denominazioneEnte: queryParams.denominazioneEnte,
          codiceFiscaleEnte: queryParams.codiceFiscaleEnte,
          codiceIpa: queryParams.codiceIpa,
          codiceCategoria: queryParams.codiceCategoria,
          indirizzo: queryParams.indirizzo,
          regione: queryParams.regione,
          provincia: queryParams.provincia,
          comune: queryParams.comune,
          sort: queryParams.sort || 'denominazioneEnte'
        }, { emitEvent: false });
      } else {
        this.filterFormSearch = this.formBuilder.group({
          denominazioneEnte: new FormControl(queryParams.denominazioneEnte),
          codiceFiscaleEnte: new FormControl(queryParams.codiceFiscaleEnte),
          codiceIpa: new FormControl(queryParams.codiceIpa),
          codiceCategoria: new FormControl(queryParams.codiceCategoria),
          indirizzo: new FormControl(queryParams.indirizzo),
          regione: new FormControl(queryParams.regione),
          provincia: new FormControl(queryParams.provincia),
          comune: new FormControl(queryParams.comune),
          sort: new FormControl(queryParams.sort || 'denominazioneEnte'),
          visibile: new FormControl(true)
        });
        this.filterFormSearch.valueChanges.pipe(debounceTime(300)).subscribe((value: any) => {
          this.updateQueryParams(value);
        });
      }
    });
  }

  private updateQueryParams(value: any): void {
    const queryParams: any = {};
    Object.keys(value).forEach((key) => {
      if (value[key] !== null && value[key] !== undefined && value[key] !== '') {
        queryParams[key] = value[key];
      }
    });
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams,
      replaceUrl: true
    });
  }

  // -------------------------------
  // On Destroy.
  // -------------------------------

  public ngOnDestroy() {
  }

}