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
    .it-header-slim-wrapper .it-header-slim-wrapper-content .nav-mobile ul.link-list li.slim-menu-dropdown .dropdown-toggle.nav-link {
      color: #fff !important;
      padding-top: 7px !important;
      padding-bottom: 7px !important;
      font-size: 1rem !important;
      line-height: 2rem;
      display: block;
      text-transform: none !important;
      text-decoration: none !important;
    }
    .it-header-slim-wrapper .it-header-slim-wrapper-content .nav-mobile ul.link-list li.slim-menu-dropdown .dropdown-toggle.nav-link .icon {
      vertical-align: middle;
    }
    @media (min-width: 992px) {
      .it-header-slim-wrapper .it-header-slim-wrapper-content .nav-mobile ul.link-list li.slim-menu-dropdown .dropdown-toggle.nav-link {
        position: relative;
        top: 0;
      }
    }
    .it-header-slim-wrapper .it-header-slim-wrapper-content .nav-mobile ul.link-list li.slim-menu-dropdown .dropdown-toggle.nav-link span {
      color: #fff !important;
    }
    .it-header-slim-wrapper .it-header-slim-wrapper-content .nav-mobile ul.link-list li.slim-menu-dropdown .dropdown-toggle.nav-link .icon {
      fill: #fff !important;
    }
    .it-header-slim-wrapper.theme-light .it-header-slim-wrapper-content .nav-mobile ul.link-list li.slim-menu-dropdown .dropdown-toggle.nav-link {
      color: #06c !important;
    }
    .it-header-slim-wrapper.theme-light .it-header-slim-wrapper-content .nav-mobile ul.link-list li.slim-menu-dropdown .dropdown-toggle.nav-link span {
      color: #06c !important;
    }
    .it-header-slim-wrapper.theme-light .it-header-slim-wrapper-content .nav-mobile ul.link-list li.slim-menu-dropdown .dropdown-toggle.nav-link .icon {
      fill: #06c !important;
    }
    .it-header-slim-wrapper .it-header-slim-wrapper-content .nav-mobile ul.link-list li.slim-menu-dropdown .dropdown-menu .link-list {
      display: flex;
      flex-direction: column;
      margin: 0;
      padding: 0;
      border: 0;
      height: auto;
    }
    .it-header-slim-wrapper .it-header-slim-wrapper-content .nav-mobile ul.link-list li.slim-menu-dropdown .dropdown-menu .link-list li {
      display: block;
      width: 100%;
    }
    .it-header-slim-wrapper .it-header-slim-wrapper-content .nav-mobile ul.link-list li.slim-menu-dropdown .dropdown-menu .link-list li a {
      line-height: 1.25rem;
      padding-top: 8px;
      padding-bottom: 8px;
      white-space: nowrap;
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
      const links = Array.isArray(menu?.dettagli) ? menu.dettagli : [];
      this.menuLinks = links;
    });
    if (this.authGuard.isDevAuthBypassEnabled()) {
      this.authenticated = true;
      this.isAdmin = true;
      this.userData = this.authGuard.getDevBypassUserData();
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

  isDropdownMenu(menuLink: any): boolean {
    return this.getMenuChildren(menuLink).length > 0 || menuLink?.type === 'dropdown';
  }

  getMenuChildren(menuLink: any): any[] {
    if (Array.isArray(menuLink?.children)) {
      return menuLink.children;
    }
    return [];
  }

  getMenuLabel(menuItem: any): string {
    return menuItem?.label || menuItem?.value || menuItem?.url || '';
  }

  getMenuHref(menuItem: any): string {
    const value = menuItem?.value || menuItem?.url || '#';
    const type = this.getMenuItemType(menuItem);
    if (type === 'email') {
      return value.startsWith('mailto:') ? value : `mailto:${value}`;
    }
    if (type === 'phone') {
      return value.startsWith('tel:') ? value : `tel:${value}`;
    }
    return value;
  }

  getMenuIcon(menuItem: any): string {
    const type = this.getMenuItemType(menuItem);
    switch(type) {
      case `email`: return 'mail';
      case `phone`: return 'telephone';
      default: return `link`;
    }    
  }

  getMenuTarget(menuItem: any): string {
    const type = this.getMenuItemType(menuItem);
    if (type === 'email' || type === 'phone') {
      return '_self';
    }
    return menuItem?.target || undefined;
  }

  isExternalMenuItem(menuItem: any): boolean {
    const href = this.getMenuHref(menuItem);
    if (!href) {
      return false;
    }
    return this.getMenuTarget(menuItem) === '_blank'
      || href === '#'
      || href.startsWith('http://')
      || href.startsWith('https://')
      || href.startsWith('//')
      || href.startsWith('mailto:')
      || href.startsWith('tel:');
  }

  onDropdownMenuItemClick(event: Event, menuItem: any): void {
    const href = this.getMenuHref(menuItem);
    if (!href || href === '#') {
      event.preventDefault();
      return;
    }
    if (this.getMenuTarget(menuItem) === '_blank') {
      event.preventDefault();
      window.open(href, '_blank', 'noopener');
    }
  }

  private getMenuItemType(menuItem: any): 'link' | 'email' | 'phone' {
    const type = menuItem?.type;
    if (type === 'email' || type === 'phone' || type === 'link') {
      return type;
    }
    const value = menuItem?.value || menuItem?.url || '';
    if (typeof value === 'string' && value.startsWith('mailto:')) {
      return 'email';
    }
    if (typeof value === 'string' && value.startsWith('tel:')) {
      return 'phone';
    }
    return 'link';
  }

  logout() {
    this.oidcSecurityService.logoffAndRevokeTokens().subscribe(() => {
      console.log('logout');
    });
  }

}
