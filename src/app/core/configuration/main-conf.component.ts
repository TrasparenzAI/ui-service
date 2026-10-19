import { AfterViewInit, Component, ElementRef, OnInit, QueryList, ViewChild, ViewChildren, ViewEncapsulation } from '@angular/core';
import { ConfigurationService } from './configuration.service';
import { Configuration } from './configuration.model';
import { Bs5UnixCronComponent, CronLocalization, Tab } from '@sbzen/ng-cron';
import { ItAccordionComponent, ItModalComponent, NotificationPosition, SelectControlOption } from 'design-angular-kit';
import { ApiMessageService, MessageType } from '../api-message.service';
import { TranslateService } from '@ngx-translate/core';
import { AbstractControl, FormBuilder, FormControl, FormGroup } from '@angular/forms';
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
import { AIService } from '../ai/ai.service';
import { catchError, forkJoin, map, Observable, of, switchMap, tap } from 'rxjs';

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
  protected workflowURL: string;

  /**
   * Proprietà lette dal config-service, indicizzate per chiave.
   * Conservano id e version, necessari per aggiornare (PUT) la riga esistente
   * senza perdere label e senza creare duplicati.
   */
  private readonly confs = new Map<string, Configuration>();

  protected workflowBODYForm: FormGroup;

  protected optionsCategoria: Array<SelectControlOption> = [];
  protected optionsRule: Array<SelectControlOption> = [];

  protected optionsWorkflow: Array<SelectControlOption> = [];
  protected menuEntryTypes: Array<SelectControlOption> = [
    { value: 'link', text: 'Link' },
    { value: 'dropdown', text: 'Menu a tendina' }
  ];
  protected menuChildTypes: Array<SelectControlOption> = [
    { value: 'link', text: 'Link' },
    { value: 'email', text: 'Email' },
    { value: 'phone', text: 'Telefono' }
  ];

  protected availableModels: any[];

  protected colorForm: FormGroup;
  protected menuForm: FormGroup;
  protected sliceForm: FormGroup;
  protected aiForm: FormGroup;
  
  protected aiAccordionVisible = false;

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
  readonly numCtxValues = Array.from({ length: 10 }, (_, i) => 1 << (11 + i));

  constructor(
    private formBuilder: FormBuilder,
    private translateService: TranslateService,
    private configurationService: ConfigurationService,
    private apiMessageService: ApiMessageService,
    private ruleService: RuleService,
    private resultService: ResultService,
    private conductorService: ConductorService,
    private aiService: AIService,
    private datepipe: DatePipe,
    private elementRef: ElementRef                  
  ) {}

  get numCtx(): number {
    const idx = this.aiForm.get('num_ctx_index')?.value ?? 4;
    return this.numCtxValues[idx];
  }

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
    this.accordions.forEach((accordion: ItAccordionComponent) => {
      if (accordion.id !== item.id) {
        if (accordion.isOpen()) accordion.hide();
      }
    });

  }

  // ---------------------------------------------------------------------------
  // Inizializzazione
  // ---------------------------------------------------------------------------

  ngOnInit(): void {
    this.translateService.get('it.configuration').subscribe((labels: any) => {
      this.labels = labels;
    });

    Object.keys(CodiceCategoria).forEach((key) => {
      this.optionsCategoria.push({ value: key, text: `${key} - ${CodiceCategoria[key]}`});
    });
    this.loadWorkflows();
    this.initForms();
    this.loadModels();
    this.loadConfigurations();
  }

  private loadWorkflows(): void {
    this.resultService.listWorkflows().subscribe((workflows: Workflow[]) => {
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
  }

  private initForms(): void {
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
      version: new FormControl(1),
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
      workflow_id_preserve: new FormControl([])
    });

    this.aiForm = this.formBuilder.group({
      defaultModel: new FormControl(),
      initialMessage: new FormControl(),
      textToSpeech: new FormControl(),
      mcpDvnsEnabled: new FormControl(false),
      num_ctx_index: new FormControl(6),
      systemPrompt: new FormControl()
    });
  }

  private loadModels(): void {
    this.aiService.getAny(`/v1/models`, undefined, false).pipe(
      map((result: any) => {
        return result.models.map(m => ({
          value: m.model,
          text: m.name.split(':')[0].toUpperCase() + (m.details?.parameter_size ? ` (${m.details.parameter_size})` : ''),
        }));
      }),
      catchError((error) => {
        console.error(error);
        return of([]);
      })
    ).subscribe((result: any[]) => {
      this.availableModels = result;
    });
  }

  /**
   * Carica le proprietà con le ricerche del config-service:
   *  - findByApplicationAndProfileAndKey per quelle di cui è nota l'applicazione
   *  - findByKey per le regole (jsonrules)
   * Ogni richiesta è indipendente: un errore o un JSON malformato non blocca le altre sezioni.
   */
  private loadConfigurations(): void {
    const S = ConfigurationService;
    const loaders: Array<[string, string, (conf: Configuration) => void]> = [
      [S.APP_SCHEDULER, S.WORKFLOW_CRON_EXPRESSION, (conf) => { this.cronValue = conf.value; }],
      [S.APP_SCHEDULER, S.WORKFLOW_CRON_URL, (conf) => { this.workflowURL = conf.value; }],
      [S.APP_SCHEDULER, S.WORKFLOW_NUMBER_PRESERVE, (conf) => {
        this.workflowBODYForm.controls.number_workflows_preserve.patchValue(Number(conf.value));
      }],
      [S.APP_SCHEDULER, S.WORKFLOW_ID_PRESERVE, (conf) => {
        this.workflowBODYForm.controls.workflow_id_preserve.patchValue(conf.value ? String(conf.value).split(',').filter(Boolean) : []);
      }],
      [S.APP_SCHEDULER, S.WORKFLOW_CRON_BODY, (conf) => this.applyWorkflowBody(JSON.parse(conf.value))],
      // La root rule del form si legge dal body: qui serve solo a registrare id e version della riga, per aggiornarla (PUT) invece di duplicarla
      [S.APP_SCHEDULER, S.WORKFLOW_CRON_ROOT_RULE, () => { /* nessun campo da valorizzare */ }],
      [S.APP_SCHEDULER, S.COLOR, (conf) => this.applyColor(JSON.parse(conf.value))],
      [S.APP_UI, S.MENU, (conf) => this.applyMenu(conf)],
      [S.APP_RESULT, S.SLICE, (conf) => this.applySlice(JSON.parse(conf.value))],
      [S.APP_AI, S.AI_DEFAULT_MODEL, (conf) => this.aiForm.controls.defaultModel.patchValue(conf.value)],
      [S.APP_AI, S.AI_TEXT_TO_SPEECH, (conf) => this.aiForm.controls.textToSpeech.patchValue(String(conf.value) === 'true')],
      [S.APP_AI, S.AI_MCP_DVNS_ENABLED, (conf) => this.aiForm.controls.mcpDvnsEnabled.patchValue(String(conf.value) === 'true')],
      [S.APP_AI, S.AI_NUM_CTX, (conf) => this.aiForm.controls.num_ctx_index.patchValue(this.numCtxValues.indexOf(Number(conf.value)))],
      [S.APP_AI, S.AI_INITIAL_MESSAGE, (conf) => this.aiForm.controls.initialMessage.patchValue(conf.value)],
      [S.APP_AI, S.AI_SYSTEM_PROMPT, (conf) => this.aiForm.controls.systemPrompt.patchValue(conf.value)],
    ];

    loaders.forEach(([application, key, apply]) => {
      this.configurationService.findOne(application, key).subscribe({
        next: (conf: Configuration | undefined) => {
          if (!conf) {
            return;
          }
          this.confs.set(key, conf);
          try {
            apply(conf);
          } catch (ex) {
            console.error(`Configurazione "${key}" non valida`, ex);
          }
        },
        error: () => { /* già notificato dal servizio */ }
      });
    });

    this.configurationService.findByKey(S.JSONRULES_KEY).subscribe({
      next: (confs: Configuration[]) => {
        confs.forEach((conf: Configuration) => {
          try {
            this.applyRules(conf);
          } catch (ex) {
            console.error(`Configurazione "${S.JSONRULES_KEY}" non valida`, ex);
          }
        });
      },
      error: () => { /* già notificato dal servizio */ }
    });
  }

  private applyWorkflowBody(json: any): void {
    const input = json?.input ?? {};
    const values = {
      version: json?.version || 1,
      page_size: input.page_size,
      codice_categoria: input.codice_categoria,
      codice_ipa: input.codice_ipa,
      id_ipa_from: input.id_ipa_from,
      parent_workflow_id: input.parent_workflow_id,
      execute_child: input.execute_child,
      crawler_save_object: input.crawler_save_object,
      crawler_save_screenshot: input.crawler_save_screenshot,
      rule_name: input.root_rule,
      connection_timeout: input.connection_timeout,
      read_timeout: input.read_timeout,
      connection_timeout_max: input.connection_timeout_max,
      read_timeout_max: input.read_timeout_max,
      crawler_child_type: input.crawler_child_type,
      crawling_mode: input.crawling_mode,
      result_base_url: input.result_base_url,
      crawler_uri: input.crawler_uri,
      rule_base_url: input.rule_base_url,
      public_company_base_url: input.public_company_base_url,
      result_aggregator_base_url: input.result_aggregator_base_url,
      task_scheduler_base_url: input.task_scheduler_base_url,
      force_jsoup: input.force_jsoup
    };
    // Non sovrascrivo i valori di default con undefined
    Object.keys(values).forEach((key) => {
      if (values[key] !== undefined) {
        this.workflowBODYForm.controls[key].patchValue(values[key]);
      }
    });
  }

  private applyColor(json: any): void {
    ['status_200', 'status_202', 'status_400', 'status_407', 'status_500', 'status_501'].forEach((key) => {
      this.colorForm.controls[key].patchValue(json[key]);
    });
  }

  private applyMenu(conf: Configuration): void {
    const json = JSON.parse(conf.value || '{}');
    json?.dettagli?.forEach((result: any) => {
      this.dettagliArray.push(this.createDettaglioMenuFormGroup(result));
    });
  }

  private applySlice(json: any): void {
    json?.dettagli?.forEach((result: any) => {
      this.dettagliSliceArray.push(this.createDettaglioSliceFormGroup(result));
    });
  }

  private applyRules(conf: Configuration): void {
    const value = JSON.parse(conf.value);
    this.optionsRule = Object.keys(value).map((key: string) => {
      const rule: Rule = this.ruleService.buildInstance(value[key]);
      const text = rule.term.filter(term => term.code == 200)[0]?.key;
      return { value: key, text: `${key} - ${text}` };
    });
  }

  // ---------------------------------------------------------------------------
  // Salvataggio
  // ---------------------------------------------------------------------------

  /**
   * Costruisce la proprietà da salvare riusando id, version e label di quella letta dal server.
   * Il value viaggia sempre come stringa (PropertyRequestBody.value è string).
   */
  private buildConf(application: string, key: string, value: any): Configuration {
    const existing = this.confs.get(key);
    const conf = new Configuration();
    conf.id = existing?.id;
    conf.version = existing?.version;
    conf.label = existing?.label;
    conf.application = application;
    conf.profile = ConfigurationService.DEFAULT_PROFILE;
    conf.key = key;
    conf.value = value === undefined || value === null ? '' : String(value);
    return conf;
  }

  /**
   * POST /properties se la proprietà non esiste, PUT /properties/{id} altrimenti.
   * Aggiorna la copia locale (id/version). Se il server risponde 204 senza body rilegge la proprietà.
   */
  private persist(conf: Configuration, nomessage?: boolean): Observable<Configuration> {
    return this.configurationService.save(conf, nomessage).pipe(
      switchMap((saved: Configuration) => saved
        ? of(saved)
        : this.configurationService.findOne(conf.application, conf.key, conf.profile)),
      tap((saved: Configuration | undefined) => {
        if (saved) {
          this.confs.set(saved.key, saved);
        }
      })
    );
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
    this.persist(
      this.buildConf(ConfigurationService.APP_SCHEDULER, ConfigurationService.WORKFLOW_CRON_EXPRESSION, this.cronValue)
    ).subscribe();
  }

  cronConfirmWorkflowURL(): void {
    this.persist(
      this.buildConf(ConfigurationService.APP_SCHEDULER, ConfigurationService.WORKFLOW_CRON_URL, this.workflowURL)
    ).subscribe((saved: Configuration) => {
      this.workflowURL = saved.value;
    });
  }

  confirmMenu(): void {
    const value = JSON.stringify(this.menuForm.value);
    this.persist(
      this.buildConf(ConfigurationService.APP_UI, ConfigurationService.MENU, value)
    ).subscribe(() => {
      this.configurationService.setCachedMenuLink(JSON.parse(value));
    });
  }

  confirmSlice(): void {
    const value = JSON.stringify(this.sliceForm.value);
    this.persist(
      this.buildConf(ConfigurationService.APP_RESULT, ConfigurationService.SLICE, value)
    ).pipe(
      tap(() => this.configurationService.setCachedSliceColor(JSON.parse(value))),
      switchMap(() => this.resultService.refresh())
    ).subscribe(() => {
      console.log('Configurazione aggiornata correttamente.');
    });
  }

  confirmColor(): void {
    const value = JSON.stringify({
      status_200: this.colorForm.controls.status_200.value,
      status_202: this.colorForm.controls.status_202.value,
      status_400: this.colorForm.controls.status_400.value,
      status_404: this.colorForm.controls.status_400.value,
      status_407: this.colorForm.controls.status_407.value,
      status_408: this.colorForm.controls.status_407.value,
      status_500: this.colorForm.controls.status_500.value,
      status_501: this.colorForm.controls.status_501.value,
    });
    this.persist(
      this.buildConf(ConfigurationService.APP_SCHEDULER, ConfigurationService.COLOR, value)
    ).subscribe(() => {
      this.configurationService.setCachedStatusColor(JSON.parse(value));
    });
  }

  confirmAI(): void {
    const S = ConfigurationService;
    const { defaultModel, systemPrompt, initialMessage, textToSpeech, mcpDvnsEnabled, num_ctx_index } = this.aiForm.controls;

    // Le singole proprietà sono salvate in silenzio: la notifica arriva dal refresh finale
    forkJoin([
      this.persist(this.buildConf(S.APP_AI, S.AI_DEFAULT_MODEL, defaultModel.value), true),
      this.persist(this.buildConf(S.APP_AI, S.AI_TEXT_TO_SPEECH, textToSpeech.value), true),
      this.persist(this.buildConf(S.APP_AI, S.AI_MCP_DVNS_ENABLED, !!mcpDvnsEnabled.value), true),
      this.persist(this.buildConf(S.APP_AI, S.AI_NUM_CTX, this.numCtxValues[num_ctx_index.value]), true),
      this.persist(this.buildConf(S.APP_AI, S.AI_SYSTEM_PROMPT, systemPrompt.value), true),
      this.persist(this.buildConf(S.APP_AI, S.AI_INITIAL_MESSAGE, initialMessage.value), true)
    ]).pipe(
      switchMap(() => {
        this.configurationService.setCachedAIInitialMessage(undefined);
        return this.aiService.postObject('actuator/refresh');
      })
    ).subscribe({
      error: (err) => {
        console.error('Errore salvataggio configurazione AI:', err);
        this.apiMessageService.sendMessage(
          MessageType.ERROR,
          this.labels?.ai?.error ?? 'Errore durante il salvataggio',
          NotificationPosition.Top
        );
      }
    });
  }

  // ---------------------------------------------------------------------------
  // Workflow
  // ---------------------------------------------------------------------------

  /** Body del workflow, usato sia per l'avvio immediato sia per la configurazione schedulata. */
  private buildWorkflowBody(): any {
    const controls = this.workflowBODYForm.controls;
    return {
      name: ConductorService.AMMINISTRAZIONE_TRASPARENTE_FLOW,
      correlationId: ConductorService.AMMINISTRAZIONE_TRASPARENTE_FLOW,
      version: controls.version.value,
      input: {
        page_size: controls.page_size.value,
        codice_categoria: controls.codice_categoria.value || '',
        codice_ipa: "",
        id_ipa_from: 0,
        parent_workflow_id: "",
        execute_child: controls.execute_child.value,
        crawler_save_object: controls.crawler_save_object.value,
        crawler_save_screenshot: controls.crawler_save_screenshot.value,
        rule_name: Rule.AMMINISTRAZIONE_TRASPARENTE,
        force_jsoup: controls.force_jsoup.value,
        root_rule: controls.rule_name.value,
        connection_timeout: controls.connection_timeout.value,
        read_timeout: controls.read_timeout.value,
        connection_timeout_max: controls.connection_timeout_max.value,
        read_timeout_max: controls.read_timeout_max.value,
        crawler_child_type: controls.crawler_child_type.value,
        crawling_mode: controls.crawling_mode.value,
        result_base_url: controls.result_base_url.value,
        crawler_uri: controls.crawler_uri.value,
        rule_base_url: controls.rule_base_url.value,
        public_company_base_url: controls.public_company_base_url.value,
        result_aggregator_base_url: controls.result_aggregator_base_url.value,
        task_scheduler_base_url: controls.task_scheduler_base_url.value
      }
    };
  }

  startWorkflowNow(): void {
    const input = this.buildWorkflowBody();
    if (confirm(this.labels?.workflow?.startnow)) {
      this.conductorService.isWorflowRunning().subscribe((running: boolean) => {      
        if (running) {
          this.apiMessageService.sendMessage(MessageType.ERROR, this.labels?.workflow?.running, NotificationPosition.Top);
        } else {
          this.conductorService.startMainWorkflowNow(input).subscribe(() => {
            this.apiMessageService.sendMessage(MessageType.SUCCESS, this.labels?.workflow?.started, NotificationPosition.Top);
          });
        }
      });    
    }
  }

  cronConfirmWorkflowBODY(): void {
    const S = ConfigurationService;
    const controls = this.workflowBODYForm.controls;
    const body = JSON.stringify(this.buildWorkflowBody());
    const idsPreserve: string[] = controls.workflow_id_preserve.value ?? [];

    // Body, root rule e numero di flussi da conservare in silenzio, l'elenco degli id mostra la notifica
    forkJoin([
      this.persist(this.buildConf(S.APP_SCHEDULER, S.WORKFLOW_CRON_BODY, body), true),
      this.persist(this.buildConf(S.APP_SCHEDULER, S.WORKFLOW_CRON_ROOT_RULE, controls.rule_name.value), true),
      this.persist(this.buildConf(S.APP_SCHEDULER, S.WORKFLOW_NUMBER_PRESERVE, controls.number_workflows_preserve.value), true),
      this.persist(this.buildConf(S.APP_SCHEDULER, S.WORKFLOW_ID_PRESERVE, idsPreserve.join(',')))
    ]).subscribe();
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

  // ---------------------------------------------------------------------------
  // Menu
  // ---------------------------------------------------------------------------

  removeDettaglioMenu(index: number) {
    this.dettagliArray.removeAt(index);
  }

  addDettaglioMenu(type: 'link' | 'dropdown' = 'link') {
    this.dettagliArray.push(this.createDettaglioMenuFormGroup({ type }));
  }

  createDettaglioMenuFormGroup(dettaglio?: any): FormGroup {
    const children = new FormArray([]);
    const type = this.normalizeMenuEntryType(dettaglio);
    const childEntries = this.extractMenuChildren(dettaglio);

    let formGroup = this.formBuilder.group({
      type: [type, Validators.required],
      label: [dettaglio?.label || null, Validators.required],
      url: [dettaglio?.url || dettaglio?.value || undefined],
      target: [dettaglio?.target || undefined],
      children: children
    });

    childEntries.forEach((child: any) => {
      children.push(this.createDettaglioMenuChildFormGroup(child));
    });
    if (type === 'dropdown' && children.length === 0) {
      children.push(this.createDettaglioMenuChildFormGroup());
    }
    this.applyMenuEntryValidators(formGroup);
    formGroup.get('type').valueChanges.subscribe((value: 'link' | 'dropdown') => {
      if (value === 'dropdown' && children.length === 0) {
        children.push(this.createDettaglioMenuChildFormGroup());
      }
      this.applyMenuEntryValidators(formGroup);
    });
    return formGroup;
  }

  get dettagliArray(): FormArray {
    return this.menuForm.get('dettagli') as FormArray;
  }

  getDettaglioMenuChildren(index: number): FormArray {
    return this.dettagliArray.at(index).get('children') as FormArray;
  }

  removeDettaglioMenuChild(menuIndex: number, childIndex: number) {
    const children = this.getDettaglioMenuChildren(menuIndex);
    children.removeAt(childIndex);
    this.applyMenuEntryValidators(this.dettagliArray.at(menuIndex) as FormGroup);
  }

  addDettaglioMenuChild(menuIndex: number) {
    const children = this.getDettaglioMenuChildren(menuIndex);
    children.push(this.createDettaglioMenuChildFormGroup());
    this.applyMenuEntryValidators(this.dettagliArray.at(menuIndex) as FormGroup);
  }

  createDettaglioMenuChildFormGroup(dettaglio?: any): FormGroup {
    const type = this.normalizeMenuChildType(dettaglio);
    const value = dettaglio?.value || dettaglio?.url || undefined;
    const formGroup = this.formBuilder.group({
      type: [type, Validators.required],
      label: [dettaglio?.label || null, Validators.required],
      value: [value, Validators.required],
      target: [dettaglio?.target || undefined],
    });
    this.applyMenuChildValidators(formGroup);
    formGroup.get('type').valueChanges.subscribe(() => this.applyMenuChildValidators(formGroup));
    return formGroup;
  }

  private extractMenuChildren(dettaglio?: any): any[] {
    if (Array.isArray(dettaglio?.children)) {
      return dettaglio.children;
    }
    return [];
  }

  private normalizeMenuEntryType(dettaglio?: any): 'link' | 'dropdown' {
    if (dettaglio?.type === 'dropdown') {
      return 'dropdown';
    }
    if (Array.isArray(dettaglio?.children) && dettaglio.children.length > 0) {
      return 'dropdown';
    }
    return 'link';
  }

  private normalizeMenuChildType(dettaglio?: any): 'link' | 'email' | 'phone' {
    const type = dettaglio?.type;
    if (type === 'email' || type === 'phone' || type === 'link') {
      return type;
    }
    return 'link';
  }

  private applyMenuEntryValidators(formGroup: FormGroup): void {
    const type = formGroup.get('type')?.value;
    const urlControl = formGroup.get('url');
    const children = formGroup.get('children') as FormArray;
    if (type === 'dropdown') {
      urlControl.clearValidators();
      children.setValidators([Validators.minLength(1)]);
    } else {
      urlControl.setValidators([Validators.required]);
      children.clearValidators();
    }
    urlControl.updateValueAndValidity({ emitEvent: false });
    children.updateValueAndValidity({ emitEvent: false });
  }

  private applyMenuChildValidators(formGroup: FormGroup): void {
    const type = formGroup.get('type')?.value;
    const valueControl = formGroup.get('value');
    const targetControl = formGroup.get('target');
    if (type === 'email') {
      valueControl.setValidators([Validators.required, Validators.pattern(/^(mailto:)?[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/i)]);
      targetControl.clearValidators();
    } else if (type === 'phone') {
      valueControl.setValidators([Validators.required, Validators.pattern(/^(tel:)?[\s\-()+]*(?:[0-9][\s\-()+]*){4,}$/)]);
      targetControl.clearValidators();
    } else {
      valueControl.setValidators([Validators.required]);
      targetControl.clearValidators();
    }
    valueControl.updateValueAndValidity({ emitEvent: false });
    targetControl.updateValueAndValidity({ emitEvent: false });
  }

  getValueErrorMessage(control: AbstractControl): string {    
    const valueControl = control.get('value');
    const type = control.get('type')?.value;
    let message = '';
    if (valueControl?.hasError('pattern')) {
      if (type === 'email') {
        message = this.translateService.instant('it.errors.pattern-email');
      } else if (type === 'phone') {
        message = this.translateService.instant('it.errors.pattern-phone');
      } else {
        message = this.translateService.instant('it.errors.pattern-invalid'); 
      }
    }
    return message;
  }

  // ---------------------------------------------------------------------------
  // Slice
  // ---------------------------------------------------------------------------

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

  onAiAccordionShow(): void {
    this.aiAccordionVisible = true;
  }  
}