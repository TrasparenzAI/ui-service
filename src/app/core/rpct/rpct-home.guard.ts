import { Injectable } from '@angular/core';
import { CanMatch, Router, UrlTree } from '@angular/router';
import { Observable, of } from 'rxjs';
import { map } from 'rxjs/operators';
import { OidcSecurityService } from 'angular-auth-oidc-client';
import { environment } from '../../../environments/environment';
import { AuthGuard } from '../../auth/auth-guard';
import { isOnlyRpct } from './rpct-user';

/**
 * Rotta "home" per gli utenti con il solo ruolo RPCT: li porta sulla dashboard RPCT, perché la Home
 * mostra dati aggregati riservati ai ruoli con accesso generale.
 * Per tutti gli altri utenti questa rotta non si applica e il router usa la rotta "home" esistente.
 */
@Injectable({ providedIn: 'root' })
export class RpctHomeGuard implements CanMatch {

  constructor(
    private oidcSecurityService: OidcSecurityService,
    private authGuard: AuthGuard,
    private router: Router
  ) {}

  canMatch(): Observable<boolean | UrlTree> {
    if (this.authGuard.isDevAuthBypassEnabled()) {
      return of(false);
    }
    if (!environment.oidc.enable) {
      return of(false);
    }
    return this.oidcSecurityService.getUserData().pipe(
      map(userData => this.destinationFor(userData))
    );
  }

  /** Dashboard RPCT per l'utente con il solo ruolo RPCT; false per gli altri (si usa la rotta "home" esistente). */
  private destinationFor(userData: any): boolean | UrlTree {
    if (isOnlyRpct(userData)) {
      return this.router.createUrlTree(['/dashboard']);
    }
    return false;
  }
}
