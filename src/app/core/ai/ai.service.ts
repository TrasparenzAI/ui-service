import { of as observableOf, Observable } from 'rxjs';
import { Injectable} from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { CommonService } from '../../common/controller/common.service';
import { ApiMessageService } from '../../core/api-message.service';
import { Router } from '@angular/router';
import { ConfigService } from '../../core/config.service';
import { TranslateService } from '@ngx-translate/core';
import { environment } from '../../../environments/environment';

@Injectable()
export class AIService extends CommonService<any> {

  static PAGE_OFFSET = 24;
  public static API_SERVICE = 'public-sites-service';

  public constructor(protected httpClient: HttpClient,
                     protected apiMessageService: ApiMessageService,
                     protected router: Router,
                     protected translateService: TranslateService,                     
                     protected configService: ConfigService) {
    super(httpClient, apiMessageService, translateService, router, configService);
  }

  protected createNewInstance(): new () => any {
    return Object;
  }

  public getApiService(): string {
    return ``;
  }

  public getRoute(): string {
    return ``;
  }

  public getPageOffset(): number {
    return AIService.PAGE_OFFSET;
  }

  getGateway(): Observable<string> {
    return observableOf(environment.aiApiUrl);
  }

  protected getResultArrays(result: any) {
      return result[`models`];
  }


}
