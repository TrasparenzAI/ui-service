import { Injectable } from "@angular/core";
import { CanActivate, Router } from "@angular/router";
import { OidcSecurityService } from "angular-auth-oidc-client";
import { environment } from '../environments/environment';
import { RoleEnum } from './auth/role.enum';

@Injectable({ providedIn: 'root' })
export class AuthRedirectGuard implements CanActivate {
  constructor(private auth: OidcSecurityService, private router: Router) {}

  canActivate(): boolean {
    if (environment.devBypassAdminAuth && !environment.production) {
        return true;
    }
    if (environment.oidc.enable && !environment.oidc.force) {
        this.auth.checkAuth().subscribe(({ isAuthenticated, userData }) => {
            if (isAuthenticated) {
                if (this.isOnlyRpct(userData)) {
                    // Utente con il solo ruolo RPCT: la sua pagina è la dashboard RPCT
                    this.router.navigate(['/dashboard']);
                } else {
                    this.router.navigate(['/home']);
                }
            } else {
                this.router.navigate(['/company-search']);
            }
        });
    }
    return true; // impedisce accesso alla route "/"
  }

  /** Solo ROLE_RPCT, senza i ruoli che danno accesso alla Home (ADMIN, SUPERUSER, USER). */
  private isOnlyRpct(userData: any): boolean {
    const roles: string[] = userData?.realm_access?.roles || [];
    return roles.includes(RoleEnum.RPCT)
      && ![RoleEnum.ADMIN, RoleEnum.SUPERUSER, RoleEnum.ROLE_USER].some(role => roles.includes(role));
  }
}
