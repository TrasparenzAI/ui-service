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
    this.configurationService.getAll().subscribe((configurations: Configuration[]) => {
      let servicesURL: string[] = [];
      servicesURL.push(`${environment.apiUrl}${this.configurationService.getApiService()}`);
      configurations.forEach((conf: Configuration) => {
          if (conf.key === ConfigurationService.WORKFLOW_CRON_URL) {
            servicesURL.push(conf.value.replace(/\/api\/workflow$/, ""));
          }
          if (conf.key === ConfigurationService.WORKFLOW_CRON_BODY) {
            let jsonvalue = JSON.parse(conf.value);
            servicesURL.push(jsonvalue.input.result_base_url);
            //this.servicesURL.push(jsonvalue.input.crawler_uri);
            servicesURL.push(jsonvalue.input.rule_base_url);            
            servicesURL.push(jsonvalue.input.public_company_base_url);
            servicesURL.push(jsonvalue.input.result_aggregator_base_url);
            servicesURL.push(jsonvalue.input.task_scheduler_base_url);
          }
      });
      this.services.push(new ServiceInfo(
        `ui-service`, `UI Service`, new Date(packageJson.buildDate), packageJson.version, undefined 
      ));
      servicesURL.forEach((serviceURL: string) => {
        if (serviceURL) {
          this.httpClient.get(`${serviceURL}/actuator/info`).subscribe((result: Build) => {
            this.services.push(result.build);
          });
        }
      });
    });
  }

}
