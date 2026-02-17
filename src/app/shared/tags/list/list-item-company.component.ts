import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output, ViewEncapsulation } from '@angular/core';
import { Company } from '../../../core/company/company.model';
import { AuthGuard } from '../../../auth/auth-guard';
import { environment } from '../../../../environments/environment';
import { LoginResponse, OidcSecurityService } from 'angular-auth-oidc-client';
import { RoleEnum } from '../../../auth/role.enum';

@Component({
    selector: 'app-list-item-company',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
    <div *ngIf="item" class="h-100 hover-shadow">
      <div class="card card-bg border-bottom-card h-100">        
        <div class="card-header ps-2 py-2">
          <div class="d-flex align-items-center">
            <svg class="icon icon-primary">
              <use xlink:href="assets/vendor/sprite.svg#it-pa"></use>
            </svg>
            <span class="text-primary text-truncate">{{ item.denominazioneEnte }}</span>
          </div>  
        </div>
        <div class="card-body">
            <ng-content></ng-content>
        </div>
        <div class="card-footer px-1 py-0">
          <div class="d-flex flex-wrap justify-content-around">
            @if (authenticated && (isSuperuser || isAdmin)) {
              <app-show-workflow-history [codiceIpa]="item.codiceIpa"></app-show-workflow-history>
              <a itButton="outline-warning" size="xs" class="mt-1" translate routerLink="/history" [queryParams]="{workflowId: '',codiceIpa: item.codiceIpa, sort: 'createdAt,desc'}">
                <it-icon name="chart-line" color="warning"></it-icon>it.company.history
              </a>
            }
            <a itButton="outline-success" size="xs" class="mt-1" translate routerLink="/company-map" [queryParams]="{codiceIpa: item.codiceIpa}">
              <it-icon name="map-marker-circle" color="success"></it-icon>it.company.map
            </a>
            <a itButton="outline-primary" size="xs" class="mt-1"  translate routerLink="/company-graph" [queryParams]="{codiceIpa: item.codiceIpa}">
              <it-icon name="chart-line" color="primary"></it-icon>it.rule.title
            </a>
          </div>
      </div>
    </div>
  `,
    styles: [
        `
    .card:after { 
      margin-top: 1rem!important;  
    }
    `
    ],
    standalone: false
})
export class ListItemCompanyComponent {
  authenticated = false;
  isAdmin: boolean;
  isSuperuser: boolean;
  userData: any;

  constructor(
    private oidcSecurityService: OidcSecurityService,
    private authGuard: AuthGuard
  ) {
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
              this.isSuperuser = this.authGuard.hasRolesFromUserData([RoleEnum.SUPERUSER], userData);
            });
        });
      } else {
        this.oidcSecurityService.isAuthenticated$.subscribe(({ isAuthenticated }) => {
          this.authenticated = isAuthenticated;
          this.oidcSecurityService.userData$.subscribe(({ userData }) => {
            this.userData = userData;
            this.isAdmin = this.authGuard.hasRolesFromUserData([RoleEnum.ADMIN], userData);
            this.isSuperuser = this.authGuard.hasRolesFromUserData([RoleEnum.SUPERUSER], userData);
          });
        });
      }
    }
  }

  @Input() item: Company = null;

  @Output() onDelete = new EventEmitter();

  @Input() filterForm;

  @Input() page;

}
