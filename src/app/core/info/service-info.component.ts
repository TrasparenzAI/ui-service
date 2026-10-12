import { Component, OnInit, ViewChild, ViewEncapsulation } from '@angular/core';
import { ConfigurationService } from '../configuration/configuration.service';
import { Configuration } from '../configuration/configuration.model';
import { environment } from '../../../environments/environment';
import { Build, IndicePaUpdateRecord, ServiceInfo } from './service-info.model';
import { HttpClient } from '@angular/common/http';
import { catchError, forkJoin, map, of } from 'rxjs';
import packageJson from '../../../../package.json';
import { ItModalComponent } from 'design-angular-kit';
import { CompanyService } from '../company/company.service';

@Component({
    selector: 'service-info',
    templateUrl: './service-info.component.html',
    encapsulation: ViewEncapsulation.None,
    styles: ``,
    standalone: false
})
export class ServiceInfoComponent implements OnInit {
  protected services: ServiceInfo[] = [];
  // Stato modale
  @ViewChild("lockModal") lockModal!: ItModalComponent;
  protected lockStatus: boolean | null = null;
  protected indicePaHistory: IndicePaUpdateRecord[] = [];
  protected indicePaHistoryLoading = false;
  // Paginazione storico
  protected historyCurrentPage = 0;
  protected historyPageSize = 5;
  protected historyTotalPages = 0;

  constructor(
    private httpClient: HttpClient,
    private configurationService: ConfigurationService,
    private companyService: CompanyService,
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

  openDetails(service: ServiceInfo): void {
    this.lockStatus = null;
    this.indicePaHistory = [];
    this.indicePaHistoryLoading = true;
    this.historyCurrentPage = 0;
    this.historyTotalPages = 0;

    this.companyService.getAny(`/v1/admin/lockStatus`).pipe(
      catchError(() => of(null))
    ).subscribe((locked) => {
      if (locked !== null) {
        this.lockStatus = locked;
      }
    });

    this.loadHistoryPage(0);
    this.lockModal.toggle();
  }

  onHistoryPageChange(page: number): void {
    this.loadHistoryPage(page);
  }

  onHistoryPageSizeChange(size: number): void {
    this.historyPageSize = size;
    this.historyCurrentPage = 0;
    this.loadHistoryPage(0);
  }

  private loadHistoryPage(page: number): void {
    this.indicePaHistoryLoading = true;
    this.companyService.getAny(
      `/v1/admin/indicePaUpdateHistory?sort=updateDate,desc&page=${page}&size=${this.historyPageSize}`
    ).pipe(
      catchError(() => of(null))
    ).subscribe((history) => {
      if (history) {
        this.indicePaHistory = (history.content || []).map((record: any) => ({
          ...record,
          updateDate: record.updateDate ? new Date(record.updateDate) : undefined
        } as IndicePaUpdateRecord));
        this.historyCurrentPage = history.page?.number ?? page;
        this.historyTotalPages = history.page?.totalPages ?? 0;
      }
      this.indicePaHistoryLoading = false;
    });
  }


  onToggleLock(newValue: boolean): void {
    const endpoint = newValue ? 'lock' : 'unlock';
    this.httpClient.post(`${environment.companyApiUrl}/v1/admin/${endpoint}`, null).pipe(
      catchError(() => {
        return of(null);
      })
    ).subscribe((res) => {
      if (res !== null) {
        this.lockStatus = newValue;
      }
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