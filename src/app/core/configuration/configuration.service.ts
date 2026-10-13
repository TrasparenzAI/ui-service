import { of as observableOf, Observable, throwError } from 'rxjs';
import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { CommonService } from '../../common/controller/common.service';
import { ApiMessageService, MessageType } from '../api-message.service';
import { Router } from '@angular/router';
import { ConfigService } from '../config.service';
import { TranslateService } from '@ngx-translate/core';
import { environment } from '../../../environments/environment';
import { Configuration } from './configuration.model';
import { catchError, map, switchMap } from 'rxjs/operators';
import { StatusColor } from '../../common/model/status-color.enum';
import { SpringError } from '../../common/model/spring-error.model';

/**
 * Servizio per le proprietà del config-service (Spring Data REST).
 *
 *  GET    /config-service/properties
 *  POST   /config-service/properties
 *  PUT    /config-service/properties/{id}
 *  DELETE /config-service/properties/{id}
 *  GET    /config-service/properties/search/findByKey?key=
 *  GET    /config-service/properties/search/findByApplicationAndProfileAndKey?application=&profile=&key=
 */
@Injectable()
export class ConfigurationService extends CommonService<Configuration> {

  public static ROUTE = 'config-service';
  static PAGE_OFFSET = 12;

  public static readonly DEFAULT_PROFILE = `default`;

  // Applicazioni a cui sono associate le proprietà
  public static readonly APP_SCHEDULER = `task-scheduler-service`;
  public static readonly APP_UI = `ui-service`;
  public static readonly APP_RESULT = `result-service`;
  public static readonly APP_AI = `ai-integration-service`;
  public static readonly APP_RULE = `rule-service`;

  // Chiavi
  public static readonly WORKFLOW_CRON_EXPRESSION = `workflow.cron.expression`;
  public static readonly WORKFLOW_CRON_URL = `workflow.cron.url`;
  public static readonly WORKFLOW_CRON_BODY = `workflow.cron.body`;
  public static readonly WORKFLOW_CRON_ROOT_RULE = `workflow.cron.root_rule`;
  public static readonly WORKFLOW_NUMBER_PRESERVE = `workflow.number.preserve`;
  public static readonly WORKFLOW_ID_PRESERVE = `workflow.id.preserve`;
  public static readonly JSONRULES_KEY = `jsonrules`;
  public static readonly COLOR = `color`;
  public static readonly MENU = `menu`;
  public static readonly SLICE = `slice`;
  public static readonly AI_DEFAULT_MODEL = `spring.ai.ollama.chat.options.model`;
  public static readonly AI_SYSTEM_PROMPT = `ai.systemPrompt`;
  public static readonly AI_INITIAL_MESSAGE = `ai.initialMessage`;
  public static readonly AI_TEXT_TO_SPEECH = `ai.text-to-speech.enable`;
  public static readonly AI_NUM_CTX = `spring.ai.ollama.chat.options.num_ctx`;

  private cachedStatusColor: any;
  private cachedSliceColor: any;
  private cachedMenuLink: any;
  private cachedAIInitialMessage!: string;

  public constructor(protected httpClient: HttpClient,
                     protected apiMessageService: ApiMessageService,
                     protected router: Router,
                     protected translateService: TranslateService,
                     protected configService: ConfigService) {
    super(httpClient, apiMessageService, translateService, router, configService);
  }

  protected createNewInstance(): new () => any {
    return Configuration;
  }

  public getApiService(): string {
    return `/${ConfigurationService.ROUTE}`;
  }

  public getApiPath(): string {
    return `/properties`;
  }

  public getRoute(): string {
    return ConfigurationService.ROUTE;
  }

  public getPageOffset(): number {
    return ConfigurationService.PAGE_OFFSET;
  }

  getGateway(): Observable<string> {
    return observableOf(environment.apiUrl);
  }

  protected getResultArrays(result: any) {
    return result?.[`_embedded`]?.properties ?? [];
  }

  protected getCreateURL(gateway: string): string {
    return this.getSaveURL(gateway, undefined);
  }

  protected getSaveURL(gateway: string, entity: Configuration): string {
    // POST /properties (create) - PUT /properties/{id} (update)
    return gateway + ConfigService.API_BASE + this.getRequestMapping() + (entity?.id ? `/${entity.id}` : ``);
  }

  // ---------------------------------------------------------------------------
  // Ricerche (property-search-controller)
  // ---------------------------------------------------------------------------

  private search(endpoint: string, filter: { [param: string]: string }): Observable<Configuration[]> {
    const params: HttpParams = this.appendToImmutableHttpParams(filter, new HttpParams());
    return this.getApiBase().pipe(
      switchMap((apiBase) =>
        this.httpClient.get<any>(`${apiBase}${this.getRequestMapping()}/search/${endpoint}`, { params }).pipe(
          map((result: any) => this.getResultArrays(result).map((item: any) => this._buildInstance(item))),
          catchError((httpErrorResponse: HttpErrorResponse) => {
            if (httpErrorResponse.status === 404) {
              return observableOf([] as Configuration[]);
            }
            const springError = new SpringError(httpErrorResponse, this.translateService);
            this.apiMessageService.sendMessage(MessageType.ERROR, springError.getRestErrorMessage());
            return throwError(() => springError);
          })
        )
      )
    );
  }

  /**
   * GET /properties/search/findByKey?key=
   */
  public findByKey(key: string): Observable<Configuration[]> {
    return this.search(`findByKey`, { key });
  }

  /**
   * GET /properties/search/findByApplicationAndProfileAndKey?application=&profile=&key=
   */
  public findByApplicationAndProfileAndKey(application: string, profile: string, key: string): Observable<Configuration[]> {
    return this.search(`findByApplicationAndProfileAndKey`, { application, profile, key });
  }

  /**
   * Restituisce la singola proprietà (application + profile + key) oppure undefined se non esiste.
   */
  public findOne(application: string, key: string, profile: string = ConfigurationService.DEFAULT_PROFILE): Observable<Configuration | undefined> {
    return this.findByApplicationAndProfileAndKey(application, profile, key).pipe(
      map((configurations: Configuration[]) => configurations.length ? configurations[0] : undefined)
    );
  }

  private findValue(application: string, key: string): Observable<string | undefined> {
    return this.findOne(application, key).pipe(map((conf: Configuration | undefined) => conf?.value));
  }

  // ---------------------------------------------------------------------------
  // Valori in cache
  // ---------------------------------------------------------------------------

  public setCachedStatusColor(color: any) {
    this.cachedStatusColor = color;
  }

  public getStatusColor(): Observable<any> {
    if (this.cachedStatusColor) {
      return observableOf(this.cachedStatusColor);
    }
    return this.findValue(ConfigurationService.APP_SCHEDULER, ConfigurationService.COLOR).pipe(
      map((value: string | undefined) => {
        if (value) {
          this.cachedStatusColor = JSON.parse(value);
          return this.cachedStatusColor;
        }
        return StatusColor;
      })
    );
  }

  public setCachedSliceColor(slice: any) {
    this.cachedSliceColor = slice;
  }

  public getSliceColor(): Observable<any> {
    if (this.cachedSliceColor) {
      return observableOf(this.cachedSliceColor);
    }
    return this.findValue(ConfigurationService.APP_RESULT, ConfigurationService.SLICE).pipe(
      map((value: string | undefined) => {
        if (value) {
          this.cachedSliceColor = JSON.parse(value);
          return this.cachedSliceColor;
        }
        return {};
      })
    );
  }

  public setCachedMenuLink(menu: any) {
    this.cachedMenuLink = menu;
  }

  public getMenuLink(): Observable<any> {
    if (this.cachedMenuLink) {
      return observableOf(this.cachedMenuLink);
    }
    return this.findValue(ConfigurationService.APP_UI, ConfigurationService.MENU).pipe(
      map((value: string | undefined) => {
        if (value) {
          this.cachedMenuLink = JSON.parse(value);
          return this.cachedMenuLink;
        }
        return undefined;
      })
    );
  }

  public setCachedAIInitialMessage(result: any) {
    this.cachedAIInitialMessage = result;
  }

  public getAIInitialMessage(): Observable<string> {
    if (this.cachedAIInitialMessage) {
      return observableOf(this.cachedAIInitialMessage);
    }
    return this.findValue(ConfigurationService.APP_AI, ConfigurationService.AI_INITIAL_MESSAGE).pipe(
      map((value: string | undefined) => {
        if (value) {
          this.cachedAIInitialMessage = value;
          return this.cachedAIInitialMessage;
        }
        return undefined;
      })
    );
  }

  public getWorkflowBody(): Observable<any> {
    return this.findValue(ConfigurationService.APP_SCHEDULER, ConfigurationService.WORKFLOW_CRON_BODY).pipe(
      map((value: string | undefined) => value ? JSON.parse(value) : undefined)
    );
  }
}