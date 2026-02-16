import { Component, OnInit, ViewEncapsulation } from '@angular/core';
import { ConfigurationService } from '../configuration/configuration.service';
import { Configuration } from '../configuration/configuration.model';
import { environment } from '../../../environments/environment';
import { DatePipe } from '@angular/common';
import { Build, ServiceInfo } from './service-info.model';
import { HttpClient } from '@angular/common/http';
import packageJson from '../../../../package.json';

@Component({
    selector: 'service-info',
    templateUrl: './service-info.component.html',
    encapsulation: ViewEncapsulation.None,
    styles: ``,
    providers: [DatePipe],
    standalone: false
})
export class ServiceInfoComponent implements OnInit {
  protected services: ServiceInfo[] = [];

  constructor(
    private httpClient: HttpClient,
    private configurationService: ConfigurationService,
  ) {}

  ngOnInit(): void {
    this.services.push(new ServiceInfo(
      `ui-service`,
      `UI Service`,
      new Date(packageJson.buildDate),
      packageJson.version,
      undefined
    ));

    this.configurationService.getAll().subscribe({
      next: (configurations: Configuration[]) => {
        this.buildServicesURL(configurations).forEach((serviceURL: string) => {
          this.loadServiceInfo(serviceURL);
        });
      },
      error: () => {
        // Keep the table visible with available data when configuration lookup fails.
      }
    });
  }

  private buildServicesURL(configurations: Configuration[]): string[] {
    const servicesURL: Set<string> = new Set<string>();
    servicesURL.add(`${environment.apiUrl}${this.configurationService.getApiService()}`);

    configurations.forEach((conf: Configuration) => {
      if (conf.key === ConfigurationService.WORKFLOW_CRON_URL) {
        servicesURL.add(conf.value?.replace(/\/api\/workflow$/, ""));
      }

      if (conf.key === ConfigurationService.WORKFLOW_CRON_BODY) {
        try {
          const jsonvalue = JSON.parse(conf.value);
          servicesURL.add(jsonvalue.input.result_base_url);
          // servicesURL.add(jsonvalue.input.crawler_uri);
          servicesURL.add(jsonvalue.input.rule_base_url);
          servicesURL.add(jsonvalue.input.public_company_base_url);
          servicesURL.add(jsonvalue.input.result_aggregator_base_url);
          servicesURL.add(jsonvalue.input.task_scheduler_base_url);
        } catch (error) {
          // Ignore malformed configuration and continue with the remaining services.
        }
      }
    });

    return Array.from(servicesURL).filter((url: string) => !!url);
  }

  private loadServiceInfo(serviceURL: string): void {
    const serviceRow = this.createUnavailableServiceRow(serviceURL);
    this.services.push(serviceRow);

    const normalizedUrl = serviceURL.replace(/\/+$/, "");
    this.httpClient.get<Build>(`${normalizedUrl}/actuator/info`).subscribe({
      next: (result: Build) => {
        if (!result?.build) {
          return;
        }
        serviceRow.artifact = result.build.artifact || serviceRow.artifact;
        serviceRow.name = result.build.name || serviceRow.name;
        serviceRow.time = result.build.time;
        serviceRow.version = result.build.version;
        serviceRow.group = result.build.group;
        serviceRow.connectionError = false;
      },
      error: () => {
        serviceRow.connectionError = true;
      }
    });
  }

  private createUnavailableServiceRow(serviceURL: string): ServiceInfo {
    const serviceLabel = this.extractServiceLabel(serviceURL);
    return new ServiceInfo(serviceLabel, serviceLabel, undefined, undefined, undefined, true);
  }

  private extractServiceLabel(serviceURL: string): string {
    try {
      const url = new URL(serviceURL);
      const [firstPathPart] = url.pathname.split(`/`).filter((segment: string) => !!segment);
      return firstPathPart || url.hostname || serviceURL;
    } catch (error) {
      return serviceURL;
    }
  }

}
