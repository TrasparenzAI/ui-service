import { throwError as observableThrowError, of as observableOf, Observable, switchMap, map, catchError} from 'rxjs';
import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { CommonService } from '../../common/controller/common.service';
import { ApiMessageService, MessageType } from '../../core/api-message.service';
import { Router } from '@angular/router';
import { ConfigService } from '../config.service';
import { TranslateService } from '@ngx-translate/core';
import { Workflow } from './workflow.model';
import { Rule } from '../rule/rule.model';
import { SpringError } from '../../common/model/spring-error.model';
import { environment } from '../../../environments/environment';
import { AuthGuard } from '../../auth/auth-guard';
import { RoleEnum } from '../../auth/role.enum';
import { ConfigurationService } from '../configuration/configuration.service';

@Injectable()
export class ConductorService extends CommonService<Workflow> {

  public constructor(protected httpClient: HttpClient,
                     protected apiMessageService: ApiMessageService,
                     protected configurationService: ConfigurationService,
                     protected router: Router,
                     protected translateService: TranslateService,
                     private authGuard: AuthGuard,
                     protected configService: ConfigService) {
    super(httpClient, apiMessageService, translateService, router, configService);
  }
  public static AMMINISTRAZIONE_TRASPARENTE_FLOW: string = 'crawler_amministrazione_trasparente';
  public static AMMINISTRAZIONE_TRASPARENTE_CORRELATION: string = 'crawler_amministrazione_trasparente';
  public static API_SERVICE = `conductor-server`;

  protected createNewInstance(): new () => any {
    return Workflow;
  }

  public getApiService(): string {
    return ``;
  }
  
  public getRoute(): string {
    return ``;
  }

  public getApiPath(): string {
    return `/api/workflow`;
  }

  getGateway(): Observable<string> {
    return observableOf(environment.conductorApiUrl);
  }
  
  protected get nameOfResults(): string {
    return undefined;
  }
  
  public getAll(filter?: {}, path?: string): Observable<Workflow[]> {
    if (!path) {
      path = `/${ConductorService.AMMINISTRAZIONE_TRASPARENTE_FLOW}/correlated/${ConductorService.AMMINISTRAZIONE_TRASPARENTE_CORRELATION}`;
    }
    return this.authGuard.hasRole([RoleEnum.ADMIN, RoleEnum.SUPERUSER]).pipe(switchMap((hasRole: boolean) => {
      return super.getAll(filter, path).pipe(switchMap((workflows: Workflow[]) => {
        return observableOf(
          workflows
            .filter((workflow: Workflow) => {       
              if (!hasRole) {
                return workflow.isCompleted;
              }
              return true;
            })
            .sort((a,b) => (a.startTime < b.startTime)? 1 : -1)
        );
      }));  
    }));
  }

  public isWorflowRunning(): Observable<boolean> {
    return this.getAll({
      includeClosed: false,
      includeTasks: false
    }).pipe(switchMap((workflows: Workflow[]) => {      
      return observableOf(workflows.length !== 0);
    }));
  }

  public lastWorflow(): Observable<Workflow> {
    return this.getAll({
      includeClosed: true,
      includeTasks: false
    }).pipe(switchMap((workflows: Workflow[]) => {      
      return observableOf(workflows[0]);
    }));
  }

  public lastWorflowCompleted(): Observable<Workflow> {
    return this.getAll({
      includeClosed: true,
      includeTasks: false
    }).pipe(switchMap((workflows: Workflow[]) => {      
      return observableOf(workflows.filter((workflow: Workflow) => {
        return workflow.isCompleted;
      })[0]);
    }));
  }

  public removeAllDataFromWorkflow(workflowId: string): Observable<string> {
    return this.httpClient.delete(`${environment.taskSchedulerApiUrl}/tasks/deleteWorkflow?workflowId=${workflowId}`, {responseType: 'json'})
      .pipe(
        map((result: string) => {
          return result;
        }),
        catchError((httpErrorResponse: HttpErrorResponse) => {
          const springError = new SpringError(httpErrorResponse, this.translateService);
          this.apiMessageService.sendMessage(MessageType.ERROR, springError.getRestErrorMessage());
          return observableThrowError(springError);
        })
      );
  }

  public removeWorkflow(workflowId: string): Observable<string> {
    return this.getGateway()
      .pipe(
        switchMap((gateway) => {
          return this.httpClient.delete(`${gateway}${this.getApiService()}/api/workflow/${workflowId}/remove`, {responseType: 'json'})
            .pipe(
              map((result: string) => {
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


  public retryWorkflow(workflowId: string): Observable<string> {
    return this.getGateway()
      .pipe(
        switchMap((gateway) => {
          return this.httpClient.post(`${gateway}${this.getApiService()}/api/workflow/${workflowId}/retry?resumeSubworkflowTasks=true`, {responseType: 'json'})
            .pipe(
              map((result: string) => {
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

  public resumeWorkflow(workflowId: string): Observable<string> {
    return this.getGateway()
      .pipe(
        switchMap((gateway) => {
          return this.httpClient.put(`${gateway}${this.getApiService()}/api/workflow/${workflowId}/resume`, {responseType: 'json'})
            .pipe(
              map((result: string) => {
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

  public restartWorkflow(workflowId: string): Observable<string> {
    return this.getGateway()
      .pipe(
        switchMap((gateway) => {
          return this.httpClient.post(`${gateway}${this.getApiService()}/api/workflow/${workflowId}/restart`, {responseType: 'json'})
            .pipe(
              map((result: string) => {
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

  public pauseWorkflow(workflowId: string): Observable<string> {
    return this.getGateway()
      .pipe(
        switchMap((gateway) => {
          return this.httpClient.put(`${gateway}${this.getApiService()}/api/workflow/${workflowId}/pause`, {responseType: 'json'})
            .pipe(
              map((result: string) => {
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

  public terminateWorkflow(workflowId: string): Observable<string> {
    return this.getGateway()
      .pipe(
        switchMap((gateway) => {
          return this.httpClient.delete(`${gateway}${this.getApiService()}/api/workflow/${workflowId}`, {responseType: 'json'})
            .pipe(
              map((result: string) => {
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

  public startMainWorkflowNow(input: any): Observable<string> {
    return this.getGateway()
      .pipe(
        switchMap((gateway) => {
          return this.httpClient.post(`${gateway}${this.getApiService()}/api/workflow`, input, {responseType: 'text'})
            .pipe(
              map((result: string) => {
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


  public startMainWorkflow(codiceIpa?: string, ruleName?: string): Observable<string> {
    return this.inputParamter(codiceIpa, ruleName).pipe(
      switchMap((params) => this.startMainWorkflowNow(params))
    );
  }

  public inputParamter(codiceIpa?: string, ruleName?: string): Observable<any> {
    return this.configurationService.getWorkflowBody().pipe(map((body: any) => {
      return {
        name: ConductorService.AMMINISTRAZIONE_TRASPARENTE_FLOW,
        version: body.version,
        correlationId: codiceIpa || ConductorService.AMMINISTRAZIONE_TRASPARENTE_FLOW,
        input: {
          page_size: 1,
          codice_categoria: ``,
          codice_ipa: codiceIpa,
          id_ipa_from: 0,
          parent_workflow_id: ``,
          execute_child: body.input.execute_child || true,
          force_jsoup: body.input.force_jsoup || true,
          crawling_mode: body.input.crawling_mode || `htmlSource`,
          crawler_save_object: true,
          crawler_save_screenshot: true,
          root_rule: ruleName || Rule.AMMINISTRAZIONE_TRASPARENTE,
          rule_name: body.input.rule_name || Rule.AMMINISTRAZIONE_TRASPARENTE,
          connection_timeout: body.input.connection_timeout || 60000,
          read_timeout: body.input.read_timeout || 60000,
          connection_timeout_max: body.input.connection_timeout_max || 120000,
          read_timeout_max: body.input.read_timeout_max || 120000,
          crawler_child_type: `SUB_WORKFLOW`,
          crawler_uri: body.input.crawler_uri || environment.crawlerApiUrl,
          result_base_url: body.input.result_base_url || environment.resultApiUrl,
          rule_base_url: body.input.rule_base_url || environment.ruleApiUrl,
          public_company_base_url: body.input.public_company_base_url || environment.companyApiUrl,
          result_aggregator_base_url: body.input.result_aggregator_base_url || environment.resultAggregatorapiUrl
        }
      }
    }));
  }
}
