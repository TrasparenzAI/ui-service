import { throwError as observableThrowError, of as observableOf, Observable, switchMap, map, catchError } from 'rxjs';
import { Injectable} from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { CommonService } from '../../common/controller/common.service';
import { ApiMessageService, MessageType } from '../../core/api-message.service';
import { Router } from '@angular/router';
import { ConfigService } from '../../core/config.service';
import { TranslateService } from '@ngx-translate/core';
import { Company } from './company.model';
import { environment } from '../../../environments/environment';
import { SpringError } from '../../common/model/spring-error.model';

@Injectable()
export class CompanyService extends CommonService<Company> {

  public static ROUTE = 'companies';
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
    return Company;
  }

  public getApiService(): string {
    return ``;
  }

  public getRoute(): string {
    return CompanyService.ROUTE;
  }

  public getPageOffset(): number {
    return CompanyService.PAGE_OFFSET;
  }

  getGateway(): Observable<string> {
    return observableOf(environment.companyApiUrl);
  }
  
  private manageVisibile(id: number, methodName: string): Observable<Company> {
    return this.getApiBase()
      .pipe(
        switchMap((apiBase) => {
          return this.httpClient.post(`${apiBase}${this.getRequestMapping()}/${id}/${methodName}`, {responseType: 'json'})
            .pipe(
              map((result: Company) => {
                return result;
              }),
              catchError((httpErrorResponse: HttpErrorResponse) => {
                const springError = new SpringError(httpErrorResponse, this.translateService);
                this.apiMessageService.sendMessage(MessageType.ERROR, springError.getRestErrorMessage());
                return observableThrowError(springError);
              })
            );
        })
    );
  }

  public setVisibile(id: number): Observable<Company> {
    return this.manageVisibile(id, `setVisibile`);
  }

  public setInvisibile(id: number): Observable<Company> {
    return this.manageVisibile(id, `setInvisible`);
  }


}
