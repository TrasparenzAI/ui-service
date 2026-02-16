import { Component, HostListener, OnDestroy, OnInit, ViewChild, ViewEncapsulation } from '@angular/core';
import { Subscription } from 'rxjs';
import { ApiMessage, ApiMessageService, MessageType} from '../api-message.service';
import { TranslateService, LangChangeEvent} from '@ngx-translate/core';
import { Title } from '@angular/platform-browser';
import { Router } from '@angular/router';
import { ItHeaderComponent, ItNotificationService, NotificationPosition } from 'design-angular-kit';
import { Breakpoints, BreakpointObserver } from '@angular/cdk/layout';
import { environment } from '../../../environments/environment';
import { LoginResponse, OidcSecurityService } from 'angular-auth-oidc-client';
import { AuthGuard } from '../../auth/auth-guard';
import { RoleEnum } from '../../auth/role.enum';
import { ConfigurationService } from '../configuration/configuration.service';

@Component({
    selector: 'app-header1',
    templateUrl: './header.component.html',
    encapsulation: ViewEncapsulation.None,
    styles: `
    .border-thin {
      border-color: rgba(255, 255, 255, 0.2) !important;
    }
    .user-icon .icon{
      width: 24px!important;
      height: 24px!important;
    }
  `,
    standalone: false
})
export class HeaderComponent implements OnInit, OnDestroy {

  @ViewChild(ItHeaderComponent) private itHeaderComponent?: ItHeaderComponent;

  public onUserActivated: Subscription = new Subscription();
  public onLoad: Subscription = new Subscription();
  public onNavbarEvaluated: Subscription = new Subscription();

  public spinner = false;
  
  public lang: string;

  light = false;
  sticky = true;
  search = false;

  iconColor = 'white';
  searchHREF: string;
  companylabel: string = 'header.company.title';

  authenticated = false;
  isAdmin: boolean;
  userData: any;
  menuLinks: any[];
  devAdminBypass = !environment.production && environment.devBypassAdminAuth;

  constructor(private apiMessageService: ApiMessageService,
              private translateService: TranslateService,
              private titleService: Title,
              private router: Router,
              private authGuard: AuthGuard,
              private responsive: BreakpointObserver,
              private oidcSecurityService: OidcSecurityService,
              private configurationService: ConfigurationService, 
              private notificationService: ItNotificationService) {
    this.searchHREF = `${environment.baseHref}#/company-search`;
  }

  public ngOnInit() {        
    this.translateService.setDefaultLang('it');    
    if (!localStorage.getItem('lang')) {
      localStorage.setItem('lang', this.translateService.getBrowserLang());
    }
    this.language(this.lang || localStorage.getItem('lang'), false);
    this.apiMessageService.onApiMessage.subscribe(
      (message: ApiMessage) => {
        this.showNotification(message.type, message.message, message.position);
      }
    );
    this.apiMessageService.onLoad.subscribe((value) => {
      this.spinner = value;
    });
    this.translateService.onLangChange.subscribe((event: LangChangeEvent) => {
      this.translateService.get('it.home.title').subscribe((title: string) => {
        this.titleService.setTitle(title);
      });
    });
    this.configurationService.getMenuLink().subscribe((menu: any) => {
      this.menuLinks = menu?.dettagli;
    });
    if (this.devAdminBypass) {
      this.authenticated = true;
      this.isAdmin = true;
      this.userData = {
        name: 'Dev Admin',
        given_name: 'Dev',
        family_name: 'Admin'
      };
      this.responsiveFn();
      return;
    }
    if (environment.oidc.enable) { 
      if (!environment.oidc.force) {
        this.oidcSecurityService
        .checkAuth()
        .subscribe((loginResponse: LoginResponse) => {
          const { isAuthenticated, userData, accessToken, idToken, configId } =
            loginResponse;
            this.authenticated = isAuthenticated;
            this.oidcSecurityService.userData$.subscribe(({ userData }) => {
              this.userData = userData;
              this.isAdmin = this.authGuard.hasRolesFromUserData([RoleEnum.ADMIN], userData);
            });
        });
      } else {
        this.oidcSecurityService.isAuthenticated$.subscribe(({ isAuthenticated }) => {
          this.authenticated = isAuthenticated;
          this.oidcSecurityService.userData$.subscribe(({ userData }) => {
            this.userData = userData;
            this.isAdmin = this.authGuard.hasRolesFromUserData([RoleEnum.ADMIN], userData);
          });    
        });
      }    
    }
    this.responsiveFn();
  }

  @HostListener("window:resize", []) 
  responsiveFn() {
    this.responsive.observe([Breakpoints.Small, Breakpoints.XSmall]).subscribe(result => {
      if (result?.matches) {
        this.companylabel = 'header.company.acronym';
        this.iconColor = 'primary';
      } else {
        this.companylabel = 'header.company.title';
        this.iconColor = 'white';
      }
    });
  }

  public language(lang: string, change: boolean) {
    if (change)
      this.lang = lang;
    if (lang == 'it') {
      this.translateService.use('it').subscribe((lang) =>{
        localStorage.setItem('lang', 'it');  
      });
    } else {
      this.translateService.use('en').subscribe((lang) =>{
        localStorage.setItem('lang', 'en');
      });
    }
    return false;
  }

  public loginPage() {
    this.router.navigate(['auth/signin']);
  }

  public ngOnDestroy() {
      this.onUserActivated.unsubscribe();
      this.onLoad.unsubscribe();
      this.onNavbarEvaluated.unsubscribe();
  }

  private showNotification(messageType: MessageType, message: string, position?: NotificationPosition) {
    if (messageType === MessageType.SUCCESS) {
      this.notificationService.info('Informazione', message, true, 5000, position);
    } else if (messageType === MessageType.ERROR) {
      this.notificationService.error('Errore!', message, true , 50000, position);
    } else if (messageType === MessageType.WARNING) {
      this.notificationService.warning('Avvertimento!', message, true, 5000, position);
    }
  }

  onSearch(searchData?) {
    this.router.navigate(['/search'],  { queryParams: searchData });
    return false;
  }

  toggleCollapse() {
    this.responsive.observe([Breakpoints.Small, Breakpoints.XSmall]).subscribe(result => {
      if (result?.matches) {
        this.itHeaderComponent?.toggleCollapse();
      }
    });
  }

  logout() {
    if (this.devAdminBypass) {
      return;
    }
    this.oidcSecurityService.logoffAndRevokeTokens().subscribe(() => {
      console.log('logout');
    });
  }

}
