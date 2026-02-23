import { Observable } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { Injectable } from '@angular/core';
import { HttpEvent, HttpHandler, HttpInterceptor, HttpRequest } from '@angular/common/http';
import { ConfigService} from '../core/config.service';
import { OidcSecurityService } from 'angular-auth-oidc-client';
import { environment } from '../../environments/environment';
import { ConfigurationService } from '../core/configuration/configuration.service';

@Injectable()
export class AuthInterceptor implements HttpInterceptor {

  constructor(
    private oidcSecurityService: OidcSecurityService
  ) {}

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    if (environment.devBypassAdminAuth && !environment.production) {
      return next.handle(req);
    }
    if (environment.oidc.enable) {
      if (req.url.indexOf(environment.companyApiUrl) != -1 || 
          req.url.indexOf(environment.conductorApiUrl) != -1 ||
          req.url.indexOf(environment.resultAggregatorapiUrl) != -1 ||
          req.url.indexOf(environment.resultApiUrl) != -1 ||
          req.url.indexOf(environment.ruleApiUrl) != -1 ||
          req.url.indexOf(environment.taskSchedulerApiUrl) != -1 ||
          req.url.indexOf(ConfigurationService.ROUTE) != -1) {
        return this.oidcSecurityService.checkAuth().pipe(          
          switchMap((isAuthenticated) => {
            if(!isAuthenticated) {
              return this.oidcSecurityService.forceRefreshSession().pipe(
                switchMap(({accessToken}) => {
                  const copiedReq = req.clone({
                    headers: req.headers
                      .set(`Authorization`, `Bearer ${accessToken}`)
                  });
                  return next.handle(accessToken ? copiedReq : req);
                })
              );
            } else {
              return this.oidcSecurityService.getAccessToken().pipe(
                switchMap((accessToken) => {
                  const copiedReq = req.clone({
                    headers: req.headers
                      .set(`Authorization`, `Bearer ${accessToken}`)
                  });
                  return next.handle(accessToken ? copiedReq : req);
                })
              );
            }
          })
        );  
      } else {
        return next.handle(req);
      }
    } else {
      // Le richieste di config non devono essere intercettate
      if (req.url.indexOf(ConfigService.CONFIG_URL) >= 0) {
        return next.handle(req);
      }

      // Le richieste di token / refresh token non devono essere intercettate
      if (req.url.indexOf(ConfigService.URL_OAUTH_LOGIN) >= 0) {
        return next.handle(req);
      }
      return next.handle(req);
    }
  }
}
