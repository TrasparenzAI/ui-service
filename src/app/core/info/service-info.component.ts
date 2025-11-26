import { AfterViewInit, Component, ElementRef, OnInit, QueryList, ViewChild, ViewChildren, ViewEncapsulation } from '@angular/core';
import { ConfigurationService } from '../configuration/configuration.service';
import { Configuration } from '../configuration/configuration.model';
import { Bs5UnixCronComponent, CronLocalization, Tab } from '@sbzen/ng-cron';
import { ItAccordionComponent, ItModalComponent, NotificationPosition, SelectControlOption } from 'design-angular-kit';
import { ApiMessageService, MessageType } from '../api-message.service';
import { TranslateService } from '@ngx-translate/core';
import { FormBuilder, FormControl, FormGroup } from '@angular/forms';
import { CodiceCategoria } from '../../common/model/codice-categoria.enum';
import { Rule } from '../rule/rule.model';
import { environment } from '../../../environments/environment';
import { RuleService } from '../rule/rule.service';
import { ConductorService } from '../conductor/conductor.service';
import { Workflow } from '../conductor/workflow.model';
import { DatePipe } from '@angular/common';
import { StatusColor } from '../../common/model/status-color.enum';
import { FormArray } from '@angular/forms';
import { Validators } from '@angular/forms';
import { ResultService } from '../result/result.service';
import { validColorValidator } from 'ngx-colors';
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
    private translateService: TranslateService,
    private configurationService: ConfigurationService,
    private apiMessageService: ApiMessageService
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
