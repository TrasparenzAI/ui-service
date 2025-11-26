import { AfterViewInit, Component, ElementRef, OnInit, QueryList, ViewChild, ViewChildren, ViewEncapsulation } from '@angular/core';
import { ConfigurationService } from './configuration.service';
import { Configuration } from './configuration.model';
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

import * as parser from 'cron-parser';

@Component({
    selector: 'app-main-conf',
    templateUrl: './main-conf.component.html',
    encapsulation: ViewEncapsulation.None,
    styles: `
    .callout-highlight {
      overflow: unset !important;
    }
    label {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }  
  `,
    providers: [DatePipe],
    standalone: false
})
export class MainConfigurationComponent implements OnInit, AfterViewInit {
  @ViewChild('cron') cronComponent: Bs5UnixCronComponent;
  @ViewChild('headerPopconfirmModal') headerPopconfirmModal: ItModalComponent;
  @ViewChildren(ItAccordionComponent) accordions!: QueryList<ItAccordionComponent>;

  readonly activeTab = Tab.HOURS;
  readonly tabs = [Tab.HOURS, Tab.DAY, Tab.MONTH];

  protected labels: any;
  protected cronValue: string;
  protected cronConfiguration: Configuration;
  protected workflowURL: string;
  protected workflowURLid: number;

  protected workflowBODYForm: FormGroup;
  protected workflowBODYid: number;
  protected colorid: number;
  protected menuid: number;
  protected sliceid: number;
  protected optionsCategoria: Array<SelectControlOption> = [];
  protected optionsRule: Array<SelectControlOption> = [];

  protected optionsWorkflow: Array<SelectControlOption> = [];

  protected number_workflows_preserve_id: number;
  protected workflow_id_preserve_id: number;

  protected colorForm: FormGroup;
  protected menuForm: FormGroup;
  protected sliceForm: FormGroup;

  readonly localization: CronLocalization = {
    common: {
      month: {
        january: 'Gennaio',
        february: 'Febbraio',
        march: 'Marzo',
        april: 'Aprile',
        may: 'Maggio',
        june: 'Giugno',
        july: 'Luglio',
        august: 'Agosto',
        september: 'Settembre',
        october: 'Ottobre',
        november: 'Novembre',
        december: 'Dicembre'
      },
      dayOfWeek: {
        sunday: 'Domenica',
        monday: 'Lunedì',
        tuesday: 'Martedì',
        wednesday: 'Mercoledì',
        thursday: 'Giovedì',
        friday: 'Venerdi',
        saturday: 'Sabato'
      },
      dayOfMonth: {
        '1st': '1°',
        '2nd': '2°',
        '3rd': '3°',
        '4th': '4°',
        '5th': '5°',
        '6th': '6°',
        '7th': '7°',
        '8th': '8°',
        '9th': '9°',
        '10th': '10°',
        '11th': '11°',
        '12th': '12°',
        '13th': '13°',
        '14th': '14°',
        '15th': '15°',
        '16th': '16°',
        '17th': '17°',
        '18th': '18°',
        '19th': '19°',
        '20th': '20°',
        '21st': '21°',
        '22nd': '22°',
        '23rd': '23°',
        '24th': '24°',
        '25th': '25°',
        '26th': '26°',
        '27th': '27°',
        '28th': '28°',
        '29th': '29°',
        '30th': '30°',
        '31st': '31°'
      }      
    },
    tabs: {
      hours: 'Ore',
      day: 'Giorni',
      month: 'Mesi'
    },
    unix: {
      day: {
        every: {
          label: 'Ogni giorno'
        },
        dayOfWeekIncrement: {
          label1: 'Ogni',
          label2: 'giorno/i da'
        },
        dayOfMonthIncrement: {
          label1: 'Ogni',
          label2: 'giorno/i del mese'
        },
        dayOfWeekAnd: {
          label: 'Giorno specifico della settimana (scegli uno o più)'
        },
        dayOfMonthAnd: {
          label: 'Giorno specifico del mese (scegli uno o più)'
        },
      },
      month: {
        every: {
          label: 'Ogni mese'
        },
        increment: {
          label1: 'Ogni',
          label2: 'mese/i',
        },
        and: {
          label: 'Mese specifico (scegli uno o più)'
        },
        range: {
          label1: 'Ogni mese tra il mese',
          label2: 'e mese'
        }
      },
      hour: {
        every: {
          label: 'Ogni ora'
        },
        increment: {
          label1: 'Ogni',
          label2: 'ora/e a partire dalle ore',
        },
        and: {
          label: 'Ora specifica (sceglierne una)'
        },
        range: {
          label1: 'Ogni ora tra le ore',
          label2: 'e ora'
        }
      }
    }
  };

  constructor(
    private formBuilder: FormBuilder,
    private translateService: TranslateService,
    private configurationService: ConfigurationService,
    private apiMessageService: ApiMessageService,
    private ruleService: RuleService,
    private resultService: ResultService,
    private conductorService: ConductorService,
    private datepipe: DatePipe,
    private elementRef: ElementRef                  
  ) {}

  private colorChanges(form: FormGroup, input: string, inputColor: string) {
    form.controls[input].valueChanges.subscribe((color) => {
      if (form.controls[input].valid) {
        form.controls[inputColor].setValue(color, {
          emitEvent: false,
        });
      }
    });
    form.controls[inputColor].valueChanges.subscribe((color) =>
      form.controls[input].setValue(color, {
        emitEvent: false,
      })
    );
  }

  showAccordion(event: any, item: any) {
    console.log('Accordion aperto:', item);
    this.accordions.forEach((accordion: ItAccordionComponent) => {
      if (accordion.id !== item.id) {
        if (accordion.isOpen()) accordion.hide();
      }
    });

  }

  ngOnInit(): void {
    this.translateService.get('it.configuration').subscribe((labels: any) => {
      this.labels = labels;
    });
    Object.keys(CodiceCategoria).forEach((key) => {
      this.optionsCategoria.push({ value: key, text: CodiceCategoria[key]});
    });
    this.conductorService.getAll({
      includeClosed: true,
      includeTasks: false
    }).subscribe((workflows: Workflow[]) => {
      workflows.forEach((workflow: Workflow) => {
        this.optionsWorkflow.push({
          value: workflow.workflowId,
          text: this.translateService.instant('it.workflow.text', {
            startTime: this.datepipe.transform(workflow.startTime, 'dd/MM/yyyy HH:mm:ss'),
            status: this.translateService.instant(`it.workflow.status.${workflow.status}`)
          })
        });
      });
    });
    
    this.menuForm = this.formBuilder.group({
       dettagli: this.formBuilder.array([])
    });

    this.sliceForm = this.formBuilder.group({
       dettagli: this.formBuilder.array([])
    });

    this.colorForm = this.formBuilder.group({
      ngx_status_200: new FormControl(StatusColor.status_200,[Validators.required, validColorValidator()]),
      status_200: new FormControl(StatusColor.status_200,[Validators.required, validColorValidator()]),
      ngx_status_202: new FormControl(StatusColor.status_202,[Validators.required, validColorValidator()]),
      status_202: new FormControl(StatusColor.status_202,[Validators.required, validColorValidator()]),
      ngx_status_400: new FormControl(StatusColor.status_400,[Validators.required, validColorValidator()]),
      status_400: new FormControl(StatusColor.status_400,[Validators.required, validColorValidator()]),
      ngx_status_407: new FormControl(StatusColor.status_407,[Validators.required, validColorValidator()]),
      status_407: new FormControl(StatusColor.status_407,[Validators.required, validColorValidator()]),
      ngx_status_500: new FormControl(StatusColor.status_500,[Validators.required, validColorValidator()]),
      status_500: new FormControl(StatusColor.status_500,[Validators.required, validColorValidator()]),
      ngx_status_501: new FormControl(StatusColor.status_501,[Validators.required, validColorValidator()]),
      status_501: new FormControl(StatusColor.status_501,[Validators.required, validColorValidator()]),
    });
    
    this.colorChanges(this.colorForm, "status_200", "ngx_status_200");
    this.colorChanges(this.colorForm, "status_202", "ngx_status_202");
    this.colorChanges(this.colorForm, "status_400", "ngx_status_400");
    this.colorChanges(this.colorForm, "status_407", "ngx_status_407");
    this.colorChanges(this.colorForm, "status_500", "ngx_status_500");
    this.colorChanges(this.colorForm, "status_501", "ngx_status_501");

    this.workflowBODYForm = this.formBuilder.group({
      page_size: new FormControl(1000),
      codice_categoria: new FormControl(''),
      codice_ipa: new FormControl(''),
      id_ipa_from: new FormControl(0),
      parent_workflow_id: new FormControl(''),
      execute_child: new FormControl(true),
      force_jsoup: new FormControl(false),
      crawler_save_object: new FormControl(false),
      crawler_save_screenshot: new FormControl(false),
      rule_name: new FormControl(Rule.AMMINISTRAZIONE_TRASPARENTE),
      connection_timeout: new FormControl(30000),
      read_timeout: new FormControl(30000),
      connection_timeout_max: new FormControl(60000),
      read_timeout_max: new FormControl(60000),
      crawler_child_type: new FormControl(`START_WORKFLOW`),
      crawling_mode: new FormControl(`httpStream`),
      result_base_url: new FormControl(environment.resultApiUrl),
      crawler_uri: new FormControl(environment.crawlerApiUrl),
      rule_base_url: new FormControl(environment.ruleApiUrl),
      public_company_base_url: new FormControl(environment.companyApiUrl),
      result_aggregator_base_url: new FormControl(environment.resultAggregatorapiUrl),
      task_scheduler_base_url: new FormControl(''),
      number_workflows_preserve: new FormControl(3),
      workflow_id_preserve: new FormControl('')
    });
    this.configurationService.getAll().subscribe((configurations: Configuration[]) => {
      configurations.forEach((conf: Configuration) => {
          if (conf.key === ConfigurationService.WORKFLOW_CRON_EXPRESSION) {
            this.cronConfiguration = conf;
            this.cronValue = conf.value;
          }
          if (conf.key === ConfigurationService.WORKFLOW_CRON_URL) {
            this.workflowURL = conf.value;
            this.workflowURLid = conf.id;
          }
          if (conf.key === ConfigurationService.WORKFLOW_NUMBER_PRESERVE) {
            this.workflowBODYForm.controls.number_workflows_preserve.patchValue(Number(conf.value));
            this.number_workflows_preserve_id = conf.id;
          }
          if (conf.key === ConfigurationService.WORKFLOW_ID_PRESERVE) {
            this.workflowBODYForm.controls.workflow_id_preserve.patchValue(conf.value.split(","));
            this.workflow_id_preserve_id = conf.id;
          }
          if (conf.key === ConfigurationService.MENU) {
            this.menuid = conf.id;
            let jsonvalue = JSON.parse(conf.value);
            jsonvalue?.dettagli.forEach((result: any) => {
              this.dettagliArray.push(this.createDettaglioMenuFormGroup(result));
            });
          }
          if (conf.key === ConfigurationService.SLICE) {
            this.sliceid = conf.id;
            let jsonvalue = JSON.parse(conf.value);
            jsonvalue?.dettagli.forEach((result: any) => {
              this.dettagliSliceArray.push(this.createDettaglioSliceFormGroup(result));
            });
          }
          if (conf.key === ConfigurationService.COLOR) {
            this.colorid = conf.id;
            let jsonvalue = JSON.parse(conf.value);
            this.colorForm.controls.status_200.patchValue(jsonvalue.status_200);
            this.colorForm.controls.status_202.patchValue(jsonvalue.status_202);
            this.colorForm.controls.status_400.patchValue(jsonvalue.status_400);
            this.colorForm.controls.status_407.patchValue(jsonvalue.status_407);
            this.colorForm.controls.status_500.patchValue(jsonvalue.status_500);
            this.colorForm.controls.status_501.patchValue(jsonvalue.status_501);
          }
          if (conf.key === ConfigurationService.WORKFLOW_CRON_BODY) {
            this.workflowBODYid = conf.id;
            let jsonvalue = JSON.parse(conf.value);
            this.workflowBODYForm.controls.page_size.patchValue(jsonvalue.input.page_size);
            this.workflowBODYForm.controls.codice_categoria.patchValue(jsonvalue.input.codice_categoria);
            this.workflowBODYForm.controls.codice_ipa.patchValue(jsonvalue.input.codice_ipa);
            this.workflowBODYForm.controls.id_ipa_from.patchValue(jsonvalue.input.id_ipa_from);
            this.workflowBODYForm.controls.parent_workflow_id.patchValue(jsonvalue.input.parent_workflow_id);
            this.workflowBODYForm.controls.execute_child.patchValue(jsonvalue.input.execute_child);
            this.workflowBODYForm.controls.crawler_save_object.patchValue(jsonvalue.input.crawler_save_object);
            this.workflowBODYForm.controls.crawler_save_screenshot.patchValue(jsonvalue.input.crawler_save_screenshot);
            this.workflowBODYForm.controls.rule_name.patchValue(jsonvalue.input.root_rule);
            this.workflowBODYForm.controls.connection_timeout.patchValue(jsonvalue.input.connection_timeout);
            this.workflowBODYForm.controls.read_timeout.patchValue(jsonvalue.input.read_timeout);
            this.workflowBODYForm.controls.connection_timeout_max.patchValue(jsonvalue.input.connection_timeout_max);
            this.workflowBODYForm.controls.read_timeout_max.patchValue(jsonvalue.input.read_timeout_max);
            this.workflowBODYForm.controls.crawler_child_type.patchValue(jsonvalue.input.crawler_child_type);
            this.workflowBODYForm.controls.crawling_mode.patchValue(jsonvalue.input.crawling_mode);
            this.workflowBODYForm.controls.result_base_url.patchValue(jsonvalue.input.result_base_url);
            this.workflowBODYForm.controls.crawler_uri.patchValue(jsonvalue.input.crawler_uri);
            this.workflowBODYForm.controls.rule_base_url.patchValue(jsonvalue.input.rule_base_url);            
            this.workflowBODYForm.controls.public_company_base_url.patchValue(jsonvalue.input.public_company_base_url);
            this.workflowBODYForm.controls.result_aggregator_base_url.patchValue(jsonvalue.input.result_aggregator_base_url);
            this.workflowBODYForm.controls.task_scheduler_base_url.patchValue(jsonvalue.input.task_scheduler_base_url);
            this.workflowBODYForm.controls.force_jsoup.patchValue(jsonvalue.input.force_jsoup);
          }
          if (conf.key === ConfigurationService.JSONRULES_KEY) {
            let resultRules = new Map();
            let value = JSON.parse(conf.value);
            Object.keys(value).forEach((key: string) => {
              resultRules.set(key, this.ruleService.buildInstance(value[key]));
            });
            this.optionsRule = [];
            resultRules.forEach((value: Rule, key: String) => {
              let text = value.term.filter(key => key.code == 200)[0].key;
              this.optionsRule.push({
                value: key,
                text: `${key} - ${text}`
              });
            });
          }
      });
    });
  }

  removeDettaglioMenu(index: number) {
    this.dettagliArray.removeAt(index);
  }

  addDettaglioMenu() {
    this.dettagliArray.push(this.createDettaglioMenuFormGroup());
  }

  createDettaglioMenuFormGroup(dettaglio?: any): FormGroup {
    let formGroup = this.formBuilder.group({
      label: [dettaglio?.label || null, Validators.required],
      url: [dettaglio?.url || undefined, Validators.required],
      target: [dettaglio?.target || undefined],
    });
    return formGroup;
  }

  get dettagliArray(): FormArray {
    return this.menuForm.get('dettagli') as FormArray;
  }

  removeDettaglioSlice(index: number) {
    this.dettagliSliceArray.removeAt(index);
  }

  addDettaglioSlice() {
    this.dettagliSliceArray.push(this.createDettaglioSliceFormGroup());
  }

  createDettaglioSliceFormGroup(dettaglio?: any): FormGroup {
    let formGroup = this.formBuilder.group({
      ngxcolor: [dettaglio?.color || '#FFFFFF', validColorValidator()],
      color: [dettaglio?.color || '#FFFFFF', [Validators.required, validColorValidator()]],
      min: [dettaglio?.min || 1, Validators.required],
      max: [dettaglio?.max || 1, Validators.required],
    });
    formGroup.controls["color"].valueChanges.subscribe((color) => {
      if (formGroup.controls["color"].valid) {
        formGroup.controls["ngxcolor"].setValue(color, {
          emitEvent: false,
        });
      }
    });
    formGroup.controls["ngxcolor"].valueChanges.subscribe((color) =>
      formGroup.controls["color"].setValue(color, {
        emitEvent: false,
      })
    );
    return formGroup;
  }

  get dettagliSliceArray(): FormArray {
    return this.sliceForm.get('dettagli') as FormArray;
  }

  cronConfirm(): void {
    let cronExpression = parser.parseExpression(this.cronValue);
    if (cronExpression.fields.hour.length > 1) {
      this.apiMessageService.sendMessage(MessageType.ERROR, this.labels.cron.error, NotificationPosition.Top);
    } else {
      this.headerPopconfirmModal.toggle();  
    }
  }

  get nextDate(): Date {
    if (this.cronValue) {
      let cronExpression = parser.parseExpression(this.cronValue);
      return cronExpression.next().toDate();  
    }
    return undefined;
  }

  get nextNextDate(): Date {
    if (this.cronValue) {
      let cronExpression = parser.parseExpression(this.cronValue);
      cronExpression.next();
      return cronExpression.next().toDate();  
    }
    return undefined;
  }

  cronSave(): void {
    let conf: Configuration = new Configuration();
    conf.id = this.cronConfiguration ? this.cronConfiguration.id: undefined;
    conf.application = `task-scheduler-service`;
    conf.profile = `default`;
    conf.key = ConfigurationService.WORKFLOW_CRON_EXPRESSION;
    conf.value = this.cronValue;
    this.configurationService.save(conf).subscribe((result: any) => {
      this.cronConfiguration = result;
    });    
  }

  cronConfirmWorkflowURL(): void {
    let conf: Configuration = new Configuration();
    conf.id = this.workflowURLid;
    conf.application = `task-scheduler-service`;
    conf.profile = `default`;
    conf.key = ConfigurationService.WORKFLOW_CRON_URL;
    conf.value = this.workflowURL;
    this.configurationService.save(conf).subscribe((result: any) => {
      this.workflowURLid = result.id;
      this.workflowURL = result.value;
    });
  }

  confirmMenu(): void {
    let conf: Configuration = new Configuration();
    conf.id = this.menuid;
    conf.application = `ui-service`;
    conf.profile = `default`;
    conf.key = ConfigurationService.MENU;
    conf.value = JSON.stringify(this.menuForm.value);
    this.configurationService.save(conf).subscribe((result: any) => {
      this.menuid = result.id;
      this.configurationService.setCachedMenuLink(JSON.parse(conf.value));
    });
  }

  confirmSlice(): void {
    let conf: Configuration = new Configuration();
    conf.id = this.sliceid;
    conf.application = `result-service`;
    conf.profile = `default`;
    conf.key = ConfigurationService.SLICE;
    conf.value = JSON.stringify(this.sliceForm.value);
    this.configurationService.save(conf).subscribe((result: any) => {
      this.sliceid = result.id;
      this.resultService.refresh().subscribe((rs) => {
        console.log('Configurazione aggiornata correttamente.');
      });
    });
  }

  confirmColor(): void {
    let conf: Configuration = new Configuration();
    conf.id = this.colorid;
    conf.application = `task-scheduler-service`;
    conf.profile = `default`;
    conf.key = ConfigurationService.COLOR;
    conf.value = JSON.stringify({
      status_200: this.colorForm.controls.status_200.value,
      status_202: this.colorForm.controls.status_202.value,
      status_400: this.colorForm.controls.status_400.value,
      status_404: this.colorForm.controls.status_400.value,
      status_407: this.colorForm.controls.status_407.value,
      status_408: this.colorForm.controls.status_407.value,
      status_500: this.colorForm.controls.status_500.value,
      status_501: this.colorForm.controls.status_501.value,
    });
    this.configurationService.save(conf).subscribe((result: any) => {
      this.colorid = result.id;
      this.configurationService.setCachedStatusColor(JSON.parse(conf.value));
    });

  }

  startWorkflowNow(): void {
    let input = {
      name: ConductorService.AMMINISTRAZIONE_TRASPARENTE_FLOW,
      correlationId: ConductorService.AMMINISTRAZIONE_TRASPARENTE_FLOW,
      version: 1,
      input: {
        page_size: this.workflowBODYForm.controls.page_size.value,
        codice_categoria: this.workflowBODYForm.controls.codice_categoria.value||'',
        codice_ipa: "",
        id_ipa_from: 0,
        parent_workflow_id: "",
        execute_child: this.workflowBODYForm.controls.execute_child.value,
        crawler_save_object: this.workflowBODYForm.controls.crawler_save_object.value,
        crawler_save_screenshot: this.workflowBODYForm.controls.crawler_save_screenshot.value,
        rule_name: Rule.AMMINISTRAZIONE_TRASPARENTE,
        force_jsoup: this.workflowBODYForm.controls.force_jsoup.value, 
        root_rule: this.workflowBODYForm.controls.rule_name.value,
        connection_timeout: this.workflowBODYForm.controls.connection_timeout.value,
        read_timeout: this.workflowBODYForm.controls.read_timeout.value,
        connection_timeout_max: this.workflowBODYForm.controls.connection_timeout_max.value,
        read_timeout_max: this.workflowBODYForm.controls.read_timeout_max.value,
        crawler_child_type: this.workflowBODYForm.controls.crawler_child_type.value,
        crawling_mode: this.workflowBODYForm.controls.crawling_mode.value,
        result_base_url: this.workflowBODYForm.controls.result_base_url.value,
        crawler_uri: this.workflowBODYForm.controls.crawler_uri.value,
        rule_base_url: this.workflowBODYForm.controls.rule_base_url.value,
        public_company_base_url: this.workflowBODYForm.controls.public_company_base_url.value,
        result_aggregator_base_url: this.workflowBODYForm.controls.result_aggregator_base_url.value,
        task_scheduler_base_url: this.workflowBODYForm.controls.task_scheduler_base_url.value
      }   
    };
    if(confirm(this.labels?.workflow?.startnow)) {
      this.conductorService.isWorflowRunning().subscribe((running: boolean) => {      
        if (running) {
          this.apiMessageService.sendMessage(MessageType.ERROR, this.labels?.workflow?.running, NotificationPosition.Top);
        } else {
          this.conductorService.startMainWorkflowNow(input).subscribe((result) => {
            this.apiMessageService.sendMessage(MessageType.SUCCESS, this.labels?.workflow?.started, NotificationPosition.Top);
          });
        }
      });    
    }
  }

  cronConfirmWorkflowBODY(): void {
    let conf: Configuration = new Configuration();
    conf.id = this.workflowBODYid;
    conf.application = `task-scheduler-service`;
    conf.profile = `default`;
    conf.key = ConfigurationService.WORKFLOW_CRON_BODY;
    conf.value = JSON.stringify({
      name: ConductorService.AMMINISTRAZIONE_TRASPARENTE_FLOW,
      correlationId: ConductorService.AMMINISTRAZIONE_TRASPARENTE_FLOW,
      version: 1,
      input: {
        page_size: this.workflowBODYForm.controls.page_size.value,
        codice_categoria: this.workflowBODYForm.controls.codice_categoria.value||'',
        codice_ipa: "",
        id_ipa_from: 0,
        parent_workflow_id: "",
        execute_child: this.workflowBODYForm.controls.execute_child.value,
        crawler_save_object: this.workflowBODYForm.controls.crawler_save_object.value,
        crawler_save_screenshot: this.workflowBODYForm.controls.crawler_save_screenshot.value,
        rule_name: Rule.AMMINISTRAZIONE_TRASPARENTE,
        root_rule: this.workflowBODYForm.controls.rule_name.value,
        connection_timeout: this.workflowBODYForm.controls.connection_timeout.value,
        read_timeout: this.workflowBODYForm.controls.read_timeout.value,
        connection_timeout_max: this.workflowBODYForm.controls.connection_timeout_max.value,
        read_timeout_max: this.workflowBODYForm.controls.read_timeout_max.value,
        crawler_child_type: this.workflowBODYForm.controls.crawler_child_type.value,
        crawling_mode: this.workflowBODYForm.controls.crawling_mode.value,
        result_base_url: this.workflowBODYForm.controls.result_base_url.value,
        crawler_uri: this.workflowBODYForm.controls.crawler_uri.value,
        rule_base_url: this.workflowBODYForm.controls.rule_base_url.value,
        force_jsoup: this.workflowBODYForm.controls.force_jsoup.value,        
        public_company_base_url: this.workflowBODYForm.controls.public_company_base_url.value,
        result_aggregator_base_url: this.workflowBODYForm.controls.result_aggregator_base_url.value,
        task_scheduler_base_url: this.workflowBODYForm.controls.task_scheduler_base_url.value
      }   
    });
    this.configurationService.save(conf, true).subscribe((result: any) => {
      this.workflowBODYid = result.id;
      // Comunico il numero di flussi da conservare
      conf.id = this.number_workflows_preserve_id;
      conf.key = ConfigurationService.WORKFLOW_NUMBER_PRESERVE;
      conf.value = this.workflowBODYForm.controls.number_workflows_preserve.value;
      this.configurationService.save(conf, true).subscribe((result: any) => {
        console.log(result);
        // Comunico l'id dell'eventuale flusso da conservare
        conf.id = this.workflow_id_preserve_id;
        conf.key = ConfigurationService.WORKFLOW_ID_PRESERVE;
        conf.value = this.workflowBODYForm.controls.workflow_id_preserve.value.join(",");
        this.configurationService.save(conf).subscribe((result: any) => {
          console.log(result);
        });
      });
    });
  }

  ngAfterViewInit(): void {
    this.onTabChanged(Tab.HOURS);
  }

  onTabChanged(tab: Tab): void {
    if (tab === Tab.HOURS) {
      ['c-every-option','c-increment-option','c-range-option'].forEach((className: string) => {
        let everyOption: any[] = this.elementRef.nativeElement.getElementsByClassName(className);
        if (everyOption.length !== 0) {
          everyOption[0].setAttribute('disabled', true);
        }  
      });
    }
  }


}
