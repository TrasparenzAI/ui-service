import { Component, OnInit, ViewEncapsulation } from '@angular/core';
import { ConfigurationService } from '../configuration/configuration.service';
import { Configuration } from '../configuration/configuration.model';
import { environment } from '../../../environments/environment';
import { Build, ServiceInfo } from './service-info.model';
import { HttpClient } from '@angular/common/http';
import { catchError, forkJoin, map, of } from 'rxjs';
import packageJson from '../../../../package.json';

@Component({
    selector: 'service-info',
    templateUrl: './service-info.component.html',
    encapsulation: ViewEncapsulation.None,
    styles: ``,
    standalone: false
})
export class ServiceInfoComponent implements OnInit {
  protected services: ServiceInfo[] = [];

  constructor(
    private httpClient: HttpClient,
    private configurationService: ConfigurationService,
  ) {}

  ngOnInit(): void {
    this.configurationService.getAll().subscribe((configurations: Configuration[]) => {
      const serviceUrls = this.collectServiceUrls(configurations);
      const uiService = new ServiceInfo(
        `ui-service`,
        `UI Service`,
        new Date(packageJson.buildDate),
        packageJson.version,
        undefined,
        'UP'
      );
      if (!serviceUrls.length) {
        this.services = [uiService];
        return;
      }
      forkJoin(serviceUrls.map((url) => this.fetchServiceInfo(url))).subscribe((infos: ServiceInfo[]) => {
        this.services = [uiService, ...infos];
      });
    });
  }

  private collectServiceUrls(configurations: Configuration[]): string[] {
    const urls: Set<string> = new Set();
    urls.add(this.normalizeServiceUrl(`${environment.apiUrl}${this.configurationService.getApiService()}`));
    configurations.forEach((conf: Configuration) => {
      if (conf.key === ConfigurationService.WORKFLOW_CRON_URL) {
        urls.add(this.normalizeServiceUrl(conf.value.replace(/\/api\/workflow$/, "")));
      }
      if (conf.key === ConfigurationService.WORKFLOW_CRON_BODY) {
        try {
          const jsonvalue = JSON.parse(conf.value || '{}');
          urls.add(this.normalizeServiceUrl(jsonvalue?.input?.result_base_url));
          urls.add(this.normalizeServiceUrl(jsonvalue?.input?.rule_base_url));
          urls.add(this.normalizeServiceUrl(jsonvalue?.input?.public_company_base_url));
          urls.add(this.normalizeServiceUrl(jsonvalue?.input?.result_aggregator_base_url));
          urls.add(this.normalizeServiceUrl(jsonvalue?.input?.task_scheduler_base_url));
        } catch {
          // Ignore malformed runtime configuration and keep loading other services.
        }
      }
    });
    urls.add(this.normalizeServiceUrl(`${environment.aiApiUrl}`));
    urls.add(this.normalizeServiceUrl(`${environment.mcpApiUrl}`));
    return Array.from(urls).filter((url) => !!url);
  }

  private normalizeServiceUrl(url?: string): string {
    return (url || '').replace(/\/+$/, '');
  }

  private fetchServiceInfo(serviceURL: string) {
    const serviceName = this.extractServiceName(serviceURL);
    return this.httpClient.get<Build>(`${serviceURL}/actuator/info`).pipe(
      map((result: Build) => {
        const build: Partial<ServiceInfo> = result?.build || {};
        return new ServiceInfo(
          build.artifact || serviceName,
          build.name || serviceName,
          build.time ? new Date(build.time) : undefined,
          build.version,
          build.group,
          'UP'
        );
      }),
      catchError(() => {
        return of(
          new ServiceInfo(
            serviceName,
            serviceName,
            undefined,
            undefined,
            undefined,
            'UNREACHABLE'
          )
        );
      })
    );
  }

  private extractServiceName(serviceURL: string): string {
    try {
      const parsedUrl = new URL(serviceURL);
      const pathParts = parsedUrl.pathname.split('/').filter(Boolean);
      if (pathParts.length) {
        return pathParts[pathParts.length - 1];
      }
      return parsedUrl.hostname;
    } catch {
      const clean = serviceURL.replace(/^https?:\/\//, '');
      const segments = clean.split('/').filter(Boolean);
      return segments[segments.length - 1] || serviceURL;
    }
  }

}
