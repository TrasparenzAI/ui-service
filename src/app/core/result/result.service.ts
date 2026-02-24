import { forkJoin, of, throwError } from 'rxjs';
import { switchMap, catchError } from 'rxjs/operators';
import { of as observableOf, throwError as observableThrowError, Observable, map} from 'rxjs';
import { Injectable} from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { CommonService} from '../../common/controller/common.service';
import { ApiMessageService, MessageType} from '../api-message.service';
import { Router} from '@angular/router';
import { ConfigService} from '../config.service';
import { TranslateService } from '@ngx-translate/core';
import { Result } from './result.model';
import { SpringError } from '../../common/model/spring-error.model';
import { environment } from '../../../environments/environment';
import { Status } from '../rule/status.enum';
import { Workflow } from '../conductor/workflow.model';
import { ConductorService } from '../conductor/conductor.service';

@Injectable()
export class ResultService extends CommonService<Result> {

  public static ROUTE = 'results';
  static PAGE_OFFSET = 12;

  public constructor(protected httpClient: HttpClient,
                     protected apiMessageService: ApiMessageService,
                     protected conductorService: ConductorService,
                     protected router: Router,
                     protected translateService: TranslateService,
                     protected configService: ConfigService) {
    super(httpClient, apiMessageService, translateService, router, configService);
  }

  protected createNewInstance(): new () => any {
    return Result;
  }

  public getApiService(): string {
    return ``;
  }

  public getRoute(): string {
    return ResultService.ROUTE;
  }

  public getPageOffset(): number {
    return ResultService.PAGE_OFFSET;
  }

  getGateway(): Observable<string> {
    return observableOf(environment.resultApiUrl);
  }

  public getCSVUrl(workflowId: string, sort: string, terse: boolean): Observable<string> {
    return this.getApiBase()
    .pipe(
      switchMap((apiBase) => {
        return observableOf(apiBase + this.getRequestMapping() + `/csv?workflowId=${workflowId}&terse=${terse}&sort=${sort}`);
      }));
  }

  public downloadCSV(params: HttpParams): Observable<any> {
    return this.getApiBase()
      .pipe(
        switchMap((apiBase) => {
          return this.httpClient.get( apiBase + this.getRequestMapping() + `/csv`, {params: params, responseType: `blob`}).pipe(
              map((result) => {
                return result;
              }),
              catchError( (httpErrorResponse: HttpErrorResponse) => {
                const springError = new SpringError(httpErrorResponse, this.translateService);
                this.apiMessageService.sendMessage(MessageType.ERROR,  springError.getRestErrorMessage());
                return observableThrowError(springError);
              })
            );
        })
      );
  }

  public refresh(): Observable<any> {
    return this.getApiBase()
      .pipe(
        switchMap((apiBase) => {
          return this.httpClient.post( apiBase + `/actuator/refresh`,{}).pipe(
              map((result) => {
                return result;
              }),
              catchError( (httpErrorResponse: HttpErrorResponse) => {
                const springError = new SpringError(httpErrorResponse, this.translateService);
                this.apiMessageService.sendMessage(MessageType.ERROR,  springError.getRestErrorMessage());
                return observableThrowError(springError);
              })
            );
        })
      );
  }

  public getWorkflowMap(ruleName?: string, workflowIds?: string[], noCache?: boolean): Observable<any> {
    let params = new HttpParams();
    if(ruleName) {
      params = params.set('ruleName', ruleName);
    }
    if (workflowIds) {
      params = params.set('workflowIds', workflowIds.join(','));
    }
    if (noCache) {
      params = params.set('noCache', noCache);
    }
    return this.getApiBase().pipe(
      switchMap((apiBase) => {
        return this.httpClient.get<any>( apiBase + this.getRequestMapping() + `/countAndGroupByWorkflowIdAndStatus`, {params: params})
        .pipe(
          map((result) => {
            try {
              return result;
            } catch (ex) {
              console.log(ex);
              this.apiMessageService.sendMessage(MessageType.ERROR, ex.message);
              observableThrowError(ex);
            }
          }),
          catchError( (httpErrorResponse: HttpErrorResponse) => {
            const springError = new SpringError(httpErrorResponse, this.translateService);
            this.apiMessageService.sendMessage(MessageType.ERROR,  springError.getRestErrorMessage());
            return observableThrowError(springError);
          })
        );
    }));    
  }

  public countResultsAndGroupByCategoriesWidthWorkflowIdAndStatus(workflowId: string): Observable<any> {
    let params = new HttpParams();
    if (workflowId) {
      params = params.set('workflowId', workflowId);
    }
    params = params.set('status', `${Status.OK},${Status.ACCEPTED}`);
    return this.getApiBase().pipe(
      switchMap((apiBase) => {
        return this.httpClient.get<any>( apiBase + this.getRequestMapping() + `/countResultsAndGroupByCategoriesWidthWorkflowIdAndStatus`, {params: params})
        .pipe(
          map((result) => {
            try {
              return result;
            } catch (ex) {
              console.log(ex);
              this.apiMessageService.sendMessage(MessageType.ERROR, ex.message);
              observableThrowError(ex);
            }
          }),
          catchError( (httpErrorResponse: HttpErrorResponse) => {
            const springError = new SpringError(httpErrorResponse, this.translateService);
            this.apiMessageService.sendMessage(MessageType.ERROR,  springError.getRestErrorMessage());
            return observableThrowError(springError);
          })
        );
    }));    
  }

  public listWorkflows(codiceIpa?: string, invokeConductor :boolean = true): Observable<Workflow[]> {
    let params = new HttpParams();
    if (codiceIpa) {
      params = params.set('codiceIpa', codiceIpa);
    }

    return this.getApiBase().pipe(
      switchMap((apiBase) => {
        return this.httpClient.get<any[]>(
          `${apiBase}/v1/workflows/listConductorLike`,
          { params }
        ).pipe(
          switchMap((result: any[]) => {
            try {
              const items: Array<Observable<Workflow>> = result.map((item) => {
                const instance: Workflow = this.buildGenericInstance(item, Workflow);
                if (instance.isRunning && invokeConductor) {
                    return this.conductorService.getById(
                      instance.getId(), 
                      { includeClosed: true, includeTasks: false }, 
                      false, 
                      false, 
                      instance
                    );
                }
                return of(instance);
              });
              return forkJoin(items);
            } catch (ex) {
              this.apiMessageService.sendMessage(MessageType.ERROR, ex.message);
              return throwError(() => ex);
            }
          }),
          catchError((httpErrorResponse: HttpErrorResponse) => {
            const springError = new SpringError(httpErrorResponse, this.translateService);
            this.apiMessageService.sendMessage(MessageType.ERROR, springError.getRestErrorMessage());
            return throwError(() => springError);
          })
        );
      })
    );
  }

  public lastWorflowCompleted(codiceIpa?: string, invokeConductor? :boolean): Observable<Workflow> {
    return this.listWorkflows(codiceIpa, invokeConductor).pipe(switchMap((workflows: Workflow[]) => {      
      return observableOf(workflows.filter((workflow: Workflow) => {
        return workflow.isCompleted;
      })[0]);
    }));
  }

  public lastWorflow(codiceIpa?: string): Observable<Workflow> {
    return this.listWorkflows(codiceIpa).pipe(switchMap((workflows: Workflow[]) => {      
      return observableOf(workflows[0]);
    }));
  }

}
