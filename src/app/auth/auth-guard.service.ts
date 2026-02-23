import { ActivatedRouteSnapshot, RouterStateSnapshot, Router, UrlSegment } from '@angular/router';
import { Injectable, Injector} from '@angular/core';
import { ApiMessageService } from '../core/api-message.service';
import { CommonService } from '../common/controller/common.service';
import { environment } from '../../environments/environment';

import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

@Injectable()
export class AuthGuardService  {

  constructor(private router: Router,
              protected injector: Injector,
              protected apiMessageService: ApiMessageService) {}

  canActivate(route: ActivatedRouteSnapshot, { url }: RouterStateSnapshot): Observable<boolean> {

    const service: CommonService<any> = this.injector.get(route.data['service']);
    const pCheck = route.data['function'] ? route.data['function'] : 'pCheck';

    console.info('Check url:' + url);
    localStorage.setItem('redirectUrl', url);
    return service[pCheck]().pipe(map((result) => {
      if (result) {
        return true;
      }
      const shouldEnforceOidc = environment.oidc.enable && !(environment.devBypassAdminAuth && !environment.production);
      if (shouldEnforceOidc) {
        this.router.navigateByUrl('/auth/signin', { state: { redirect: url } });
      } else {
        this.router.navigate(['error/unauthorized']);
      }
    }));
  }

}
