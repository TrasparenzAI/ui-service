import { ErrorHandler, Injectable} from '@angular/core';
import { Router } from '@angular/router';
import { SpringError } from '../common/model/spring-error.model';
import { environment } from '../../environments/environment';
import { ApiMessageService, MessageType } from './api-message.service';

@Injectable()
export class GlobalErrorHandler implements ErrorHandler {

  constructor(
    protected apiMessageService: ApiMessageService,
    private router: Router
  ) { }

  handleError(error: any) {
    const shouldEnforceOidc = environment.oidc.enable && !(environment.devBypassAdminAuth && !environment.production);
    if ((error instanceof SpringError && error?.redirectOnError) || !(error instanceof SpringError)) {
      if (error?.httpErrorResponse?.status === 401) {
        if (shouldEnforceOidc) {
          sessionStorage.setItem('redirect', this.router.url);
          this.router.navigateByUrl('/auth/signin', { state: { redirect: this.router.url } });
        } else {
          this.router.navigate(['error/unauthorized']);
        }
      } else {
        this.apiMessageService.sendMessage(MessageType.ERROR,  error.message);
        this.router.navigate(['error/server-error']);
      }
    }
    throw error;
  }

}
