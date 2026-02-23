import { Injectable } from "@angular/core";
import { CanActivate, Router } from "@angular/router";
import { OidcSecurityService } from "angular-auth-oidc-client";
import { environment } from '../environments/environment';

@Injectable({ providedIn: 'root' })
export class AuthRedirectGuard implements CanActivate {
  constructor(private auth: OidcSecurityService, private router: Router) {}

  canActivate(): boolean {
    if (environment.devBypassAdminAuth && !environment.production) {
        return true;
    }
    if (environment.oidc.enable && !environment.oidc.force) {
        this.auth.checkAuth().subscribe(({ isAuthenticated }) => {
            if (isAuthenticated) {
                this.router.navigate(['/home']);
            } else {
                this.router.navigate(['/company-search']);
            }
        });
    }
    return true; // impedisce accesso alla route "/"
  }
}
