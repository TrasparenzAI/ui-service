import { of as observableOf, Observable } from 'rxjs';
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { CommonService } from '../../common/controller/common.service';
import { ApiMessageService } from '../api-message.service';
import { Router } from '@angular/router';
import { ConfigService } from '../config.service';
import { TranslateService } from '@ngx-translate/core';
import { environment } from '../../../environments/environment';
import { Configuration } from './configuration.model';
import { map } from 'rxjs/operators';
import { StatusColor } from '../../common/model/status-color.enum';

@Injectable()
export class ConfigurationService extends CommonService<Configuration> {

  public static ROUTE = 'config-service';
  static PAGE_OFFSET = 12;

  public static readonly WORKFLOW_CRON_EXPRESSION = `workflow.cron.expression`;
  public static readonly WORKFLOW_CRON_URL = `workflow.cron.url`;
  public static readonly WORKFLOW_CRON_BODY = `workflow.cron.body`;
  public static readonly WORKFLOW_NUMBER_PRESERVE = `workflow.number.preserve`;
  public static readonly WORKFLOW_ID_PRESERVE = `workflow.id.preserve`;
  public static readonly JSONRULES_KEY = `jsonrules`;
  public static readonly COLOR = `color`;
  public static readonly MENU = `menu`;
  public static readonly SLICE = `slice`;

  private cachedStatusColor: any;
  private cachedSliceColor: any;
  private cachedMenuLink: any;

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
      return result[`_embedded`]?.properties;
  }

  protected getCreateURL(gateway: string): string {
    return this.getSaveURL(gateway, undefined);
  }

  protected getSaveURL(gateway: string, entity: Configuration): string {
    return gateway + ConfigService.API_BASE + this.getRequestMapping() + (entity?.id ? `\\${entity.id}`:``);
  }

  public setCachedStatusColor(color: any) {
    this.cachedStatusColor = color;
  }

  public getStatusColor(): Observable<any> {
    if (this.cachedStatusColor) {
      return observableOf(this.cachedStatusColor);
    }
    return this.getAll().pipe(
        map((configurations: Configuration[]) => {
          let colors = configurations.filter((conf: Configuration) => conf.key === ConfigurationService.COLOR);
          if (colors && colors.length === 1) {
            this.cachedStatusColor = JSON.parse(colors[0].value);
            return this.cachedStatusColor;
          }
          return StatusColor;
        })
    );
  }

  public getSliceColor(): Observable<any> {
    if (this.cachedSliceColor) {
      return observableOf(this.cachedSliceColor);
    }
    return this.getAll().pipe(
        map((configurations: Configuration[]) => {
          let colors = configurations.filter((conf: Configuration) => conf.key === ConfigurationService.SLICE);
          if (colors && colors.length === 1) {
            this.cachedSliceColor = JSON.parse(colors[0].value);
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
    return this.getAll().pipe(
        map((configurations: Configuration[]) => {
          let menuLinks = configurations.filter((conf: Configuration) => conf.key === ConfigurationService.MENU);
          if (menuLinks && menuLinks.length === 1) {
            this.cachedMenuLink = JSON.parse(menuLinks[0].value);
            return this.cachedMenuLink;
          }
        })
    );
  }

}
