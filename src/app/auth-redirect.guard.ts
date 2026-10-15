import { Injectable } from "@angular/core";
import { CanActivate, Router } from "@angular/router";
import { OidcSecurityService } from "angular-auth-oidc-client";
import { environment } from '../environments/environment';
import { isOnlyRpct } from './core/rpct/rpct-user';

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
                if (isOnlyRpct(userData)) {
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
}
