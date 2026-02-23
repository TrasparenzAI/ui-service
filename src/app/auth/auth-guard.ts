import { Injectable } from "@angular/core";
import { ActivatedRouteSnapshot, CanActivate, CanActivateChild, CanDeactivate, CanMatch, GuardResult, MaybeAsync, Route, Router, RouterStateSnapshot, UrlSegment } from "@angular/router";
import { environment } from '../../environments/environment';
import { OidcSecurityService } from "angular-auth-oidc-client";
import { RoleEnum } from "./role.enum";
import { Observable, of } from "rxjs";
import { map } from 'rxjs/operators';

@Injectable({
    providedIn: 'root'
})
export class AuthGuard implements CanActivate, CanActivateChild, CanDeactivate<unknown>, CanMatch {
  
    constructor(
        private oidcSecurityService: OidcSecurityService, 
        private router: Router
    ) {}

    canMatch(route: Route, segments: UrlSegment[]): MaybeAsync<GuardResult> {
        return true;
    }

    canDeactivate(component: unknown, currentRoute: ActivatedRouteSnapshot, currentState: RouterStateSnapshot, nextState: RouterStateSnapshot): MaybeAsync<GuardResult> {
        return true;
    }

    canActivateChild(childRoute: ActivatedRouteSnapshot, state: RouterStateSnapshot): MaybeAsync<GuardResult> {
        return this.canActivate(childRoute, state);
    }

    canActivate(route: ActivatedRouteSnapshot, state: RouterStateSnapshot): MaybeAsync<GuardResult> {
        return this.checkUserAuthorized(route);
    }

    checkUserAuthorized(route: ActivatedRouteSnapshot, r?: RoleEnum): Observable<boolean> | Promise<boolean> | boolean {
        if (this.isDevAuthBypassEnabled()) {
            return true;
        }
        if (environment.oidc.enable) {
            return this.hasRole(r || route?.data?.role);    
        }
        return true;
    }

    hasRolesFromUserData(roles: RoleEnum[], userData: any): boolean {
        if (this.isDevAuthBypassEnabled()) {
            return true;
        }
        let myRoles =  userData?.realm_access?.roles || [];
        return myRoles.filter(role => roles.indexOf(role) != -1).length != 0;
    }
    
    hasRole(roles: RoleEnum[]): Observable<boolean> {
        if (this.isDevAuthBypassEnabled()) {
            return of(true);
        }
        return this.oidcSecurityService.getUserData().pipe(map((userData: any) => {
            return this.hasRolesFromUserData(roles, userData);
        }));
    }

    getRoles(): Observable<string[]> {
        if (this.isDevAuthBypassEnabled()) {
            return of(this.getDevBypassUserData().realm_access.roles);
        }
        return this.oidcSecurityService.getUserData().pipe(map((userData: any) => {
            return userData?.realm_access?.roles || [];
        }));
    }

    isDevAuthBypassEnabled(): boolean {
        return !environment.production && !!environment.devBypassAdminAuth;
    }

    getDevBypassUserData() {
        return {
            sub: 'dev-bypass-admin',
            preferred_username: 'dev.admin',
            given_name: 'Dev',
            family_name: 'Admin',
            name: 'Dev Admin',
            email: 'dev.admin@localhost',
            realm_access: {
                roles: [RoleEnum.ADMIN, RoleEnum.SUPERUSER, RoleEnum.ROLE_USER]
            }
        };
    }


}
  
