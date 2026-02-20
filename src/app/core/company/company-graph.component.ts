import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, ElementRef, HostListener, OnChanges, OnDestroy, OnInit, ViewChild, ViewEncapsulation } from '@angular/core';
import { FormBuilder, FormControl, FormGroup, NgForm } from '@angular/forms';
import { ActivatedRoute, Params, Router } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { LoginResponse, OidcSecurityService } from 'angular-auth-oidc-client';
import { OrgChart } from "d3-org-chart";
import { ItModalComponent, ItTabContainerComponent, ItTabItemComponent, NotificationPosition, SelectControlOption } from 'design-angular-kit';
import { jsPDF } from "jspdf";
import { Observable, map, of as observableOf, of, switchMap, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthGuard } from '../../auth/auth-guard';
import { RoleEnum } from '../../auth/role.enum';
import { Helpers } from '../../common/helpers/helpers';
import { CodiceCategoria } from '../../common/model/codice-categoria.enum';
import { ApiMessageService, MessageType } from '../api-message.service';
import { ConductorService } from '../conductor/conductor.service';
import { Workflow } from '../conductor/workflow.model';
import { Configuration } from '../configuration/configuration.model';
import { ConfigurationService } from '../configuration/configuration.service';
import { Result } from '../result/result.model';
import { ResultService } from '../result/result.service';
import { Rule, RuleChart, Term } from '../rule/rule.model';
import { RuleService } from '../rule/rule.service';
import { Company } from './company.model';
import { CompanyService } from './company.service';
import * as _ from "lodash";

@Component({
    selector: 'company-graph',
    changeDetection: ChangeDetectionStrategy.Default,
    templateUrl: './company-graph.component.html',
    encapsulation: ViewEncapsulation.None,
    providers: [DatePipe],
    styles: `
    #chartContainer {
      min-height: 40vh;
      height: 100%;
    }  

    @media screen and (min-width: 992px) {
      #chartContainer {
        min-height: 60vh;
      }  
    }

    .select-wrapper {
      margin-bottom: 1rem !important;
    }
 
    .ng-select .ng-arrow-wrapper {
        display: none !important;
    }
   
    .btn-icon .icon.icon-lg {
      width: 48px!important;
      height: 48px!important;
    }
    
    .list-item .it-right-zone {
      margin-right: 0 !important;
      margin-left: 0 !important;
    }
    
    .card {
      position: unset !important;
    }
  `,
    standalone: false
})
export class CompanyGraphComponent implements OnInit, OnDestroy, OnChanges{
  
  index: number = 3;
  compact: number = 0;
  rating: number;
  data: any[];
  rulesOK: number;
  currentNode: any;
  editNode: any;
  @ViewChild("chartContainer") chartContainer: ElementRef;
  chart;

  protected codiceIpa: string;
  protected company: Company;
  protected fromMap: boolean;
  protected zoom: number;
  protected paramsWorkflowId: string;
  protected rules: Map<String, Rule>;
  protected ruleConfigurationId: number;
  protected isSuperuser: boolean;

  tabPAActive: boolean;
  tabRuleActive: boolean;
  tabFailedActive: boolean;
  protected ruleStatus = {};
  @ViewChild("tab") tab: ItTabContainerComponent;
  @ViewChild("tabPA") tabPA: ItTabItemComponent;
  @ViewChild("tabRule") tabRule: ItTabItemComponent;
  @ViewChild("tabFailed") tabFailed: ItTabItemComponent;
  protected filterFormSearch: FormGroup;
  optionsWorkflow: Array<any>;
  optionsRule: Array<SelectControlOption> = [];
  rulesFailed: Array<RuleChart> = [];


  @ViewChild("editModal") editModal: ItModalComponent;
  @ViewChild("newModal") newModal: ItModalComponent;
  optionsCategoria: Array<SelectControlOption> = [];
  protected newRuleForm: FormGroup;
  optionsRuleDetail: RuleChart[];
  protected statusColor: any;

  authenticated = false;
  isAdmin: boolean;
  userData: any;

  protected childRuleName: string;
  protected childResults: Result[];
  protected childRules: Map<String, Rule>;

  constructor(private formBuilder: FormBuilder,
              private route: ActivatedRoute,
              protected apiMessageService: ApiMessageService,
              private ruleService: RuleService,
              private resultService: ResultService,
              private configurationService: ConfigurationService,
              private conductorService: ConductorService,
              private authGuard: AuthGuard,
              private companyService: CompanyService,
              private translateService: TranslateService,
              private oidcSecurityService: OidcSecurityService,
              private datepipe: DatePipe,
              protected router: Router) {}

  ngOnInit(): void {
    if (environment.oidc.enable) { 
      if (!environment.oidc.force) {
        this.oidcSecurityService
        .checkAuth()
        .subscribe((loginResponse: LoginResponse) => {
          const { isAuthenticated, userData, accessToken, idToken, configId } =
            loginResponse;
            this.authenticated = isAuthenticated;
            this.oidcSecurityService.userData$.subscribe(({ userData }) => {
              this.userData = userData;
              this.isAdmin = this.authGuard.hasRolesFromUserData([RoleEnum.ADMIN], userData);
            });
        });
      } else {
        this.oidcSecurityService.isAuthenticated$.subscribe(({ isAuthenticated }) => {
          this.authenticated = isAuthenticated;
          this.oidcSecurityService.userData$.subscribe(({ userData }) => {
            this.userData = userData;
            this.isAdmin = this.authGuard.hasRolesFromUserData([RoleEnum.ADMIN], userData);
          });
        });
      }
    }
    this.configurationService.getStatusColor().subscribe((color: any) => {
      this.statusColor = color;
    });
    Object.keys(CodiceCategoria).forEach((key) => {
      this.optionsCategoria.push({ value: key, text: CodiceCategoria[key]});
    });    
    this.authGuard.hasRole([RoleEnum.ADMIN, RoleEnum.SUPERUSER]).subscribe((hasRole: boolean) => {
      this.isSuperuser = hasRole;
    });
    this.translateService.get(`it.rule.status`).subscribe((status) => {
      this.ruleStatus = status;
    });
    this.filterFormSearch = this.formBuilder.group({
      workflowId: new FormControl(),
      rootRule: new FormControl(),
    });
    this.newRuleForm = this.formBuilder.group({
      key: new FormControl(),
      copyFrom: new FormControl(),
      keytype: new FormControl(true)
    });
    this.route.queryParams.subscribe((queryParams: Params) => {
      this.codiceIpa = queryParams.codiceIpa;
      if (!this.codiceIpa && this.company) {
        this.codiceIpa = this.company.codiceIpa;
      }
      this.fromMap = queryParams.fromMap;
      this.zoom = queryParams.zoom;
      this.paramsWorkflowId = queryParams.workflowId;
      if (this.codiceIpa) {
        this.companyService.getAll({
          codiceIpa: this.codiceIpa,
          size: 1
        }).subscribe((company: Company[]) => {
          this.company = company[0];
          this.tabRuleActive = true;
          this.tabPAActive = false;
          this.tabFailedActive = false;
          if (!this.company) {
            this.apiMessageService.sendMessage(MessageType.ERROR,  `PA non presente!`);
            this.router.navigate(['error/not-found-no-back']);
          }
        });
        if (this.userData) {
          this.getWorkflow(queryParams).subscribe((workflowId: string) => {
            this.filterFormSearch.controls.workflowId.patchValue(workflowId);
            this.filterFormSearch.valueChanges.subscribe((value: any) => {            
              this.manageChart(value.workflowId);
            });          
            this.conductorService.getAll({
              includeClosed: true,
              includeTasks: false
            }).subscribe((workflows: Workflow[]) => {
              this.optionsWorkflow = [];
              this.conductorService.getAll({
                includeClosed: true,
                includeTasks: false
              },`/${ConductorService.AMMINISTRAZIONE_TRASPARENTE_FLOW}/correlated/${this.codiceIpa}`).subscribe((ipaWorkflows: Workflow[]) => {
                ipaWorkflows.concat(workflows).sort((a,b) => (a.startTime < b.startTime)? 1 : -1).forEach((workflow: Workflow) => {
                  this.optionsWorkflow.push({
                    value: workflow.workflowId,
                    text: this.translateService.instant('it.workflow.text', {
                      startTime: this.datepipe.transform(workflow.startTime, 'dd/MM/yyyy HH:mm:ss'),
                      status: this.translateService.instant(`it.workflow.status.${workflow.status}`)
                    }),
                    selected: workflow.workflowId === queryParams['workflowId'],
                    ruleName: workflow.input.root_rule || Rule.AMMINISTRAZIONE_TRASPARENTE
                  });
                });  
                this.manageChart(workflowId);
              });      
            });
          });          
        } else {
          this.manageChart();
        }
      } else {
        this.configurationService.getAll().subscribe((configurations: Configuration[]) => {
          configurations.forEach((conf: Configuration) => {
            if (conf.key === ConfigurationService.JSONRULES_KEY) {
              this.ruleConfigurationId = conf.id;
              this.rules = new Map();
              let value = JSON.parse(conf.value);
              Object.keys(value).forEach((key: string) => {
                this.rules.set(key, this.ruleService.buildInstance(value[key]));
              });
            }            
          });
          if (this.rules) {
            this.loadSelectRules();
            this.filterFormSearch.controls.rootRule.patchValue(Rule.AMMINISTRAZIONE_TRASPARENTE);
            this.filterFormSearch.valueChanges.subscribe((value: any) => {
              if (value.rootRule) {
                this.loadRuleData(value.rootRule, this.rules.get(value.rootRule));
              }
            });
            this.loadRuleData(Rule.AMMINISTRAZIONE_TRASPARENTE, this.rules.get(Rule.AMMINISTRAZIONE_TRASPARENTE));
          } else {
            this.data = [];
          }
        });    
      }
    });
  }

  get companyRuleWorkflowId() {
    return this.filterFormSearch?.controls?.workflowId?.value;
  }

  workflowRuleName(workflowId: string): Observable<string> {
    if (this.optionsWorkflow) {
      let workflows: any[] = this.optionsWorkflow.filter((value: any) => {
        if (value.value == workflowId) {
          return value;
        }
      });
      if (workflows.length == 1) {
        return of(workflows[0].ruleName);  
      }
    }
    if (!workflowId) {
      return this.configurationService.getAll().pipe(switchMap((configurations: Configuration[]) => {
        return configurations.filter((configuration: Configuration) => {
          return configuration.key === ConfigurationService.WORKFLOW_CRON_BODY;
        }).map((configuration: Configuration) => {
          let jsonvalue = JSON.parse(configuration.value);
          return String(jsonvalue.input.root_rule);
        });
      }));
    }
    return of(Rule.AMMINISTRAZIONE_TRASPARENTE);
  }

  loadSelectRules() {
    this.optionsRule = [];
    this.rules.forEach((value: Rule, key: String) => {
      let text = value.term.filter(key => key.code == 200)[0].key;
      this.optionsRule.push({
        value: key,
        text: `${key} - ${text} - Regole totali: ${value.getCharts(undefined, undefined, []).length + 1}`
      });
    });
  }

  loadRuleData(key: string, rule: Rule) {
    this.data = rule.getCharts(undefined, key, []);
    this.optionsRuleDetail = [];
    this.data.forEach((ruleChart: RuleChart) => {
      this.optionsRuleDetail.push(ruleChart);
      if (ruleChart.nodeId === key) {
        this.currentNode = {
          data: ruleChart
        };
        this.tabRuleActive = true;
        this.tabFailedActive = false;
      }
    });
    this.updateChart();
  }

  manageChart(workflowId?: string) {
    this.workflowRuleName(workflowId).subscribe((ruleName: string) => {
      this.resultService.getAll({
        workflowId: workflowId,
        codiceIpa: this.codiceIpa,
        size: 500,
        noCache: true
      }, this.userData ? "/codiceipa/byWorkflow" : "/codiceipa").subscribe((results: Result[]) => {
        if (results.length === 0) {
          this.apiMessageService.sendMessage(MessageType.WARNING, `Risultati non presenti per la PA: ${this.company?.denominazioneEnte}!`);
        }
        this.childRuleName = ruleName;
        this.childResults = results;

        this.rulesOK = results.filter(result => result.status == 200 || result.status == 202).length;
        this.rulesFailed = [];
        this.optionsRuleDetail = [];
        this.ruleService.getRules().subscribe((rules: Map<String, Rule>) => {
          this.childRules = rules;

          let rule = rules.get(ruleName);
          this.data = rule.getCharts(undefined, ruleName, []);
          this.rating = Math.trunc((this.rulesOK * 100 / this.data.length) / 20);
          this.data.forEach((ruleChart: RuleChart) => {
            this.optionsRuleDetail.push(ruleChart);
            let nodeId = (ruleName == ruleChart.nodeId) ? Rule.AMMINISTRAZIONE_TRASPARENTE : ruleChart.nodeId;
            let childStatus : Number[] = [];
            this.data.filter(result => result.parentNodeId == ruleChart.nodeId).forEach((childRule: RuleChart) => {
              let child = results.filter(result => result.ruleName == childRule.nodeId);
              if (child && child.length == 1) {
                childStatus.push(child[0].status);
              }
            });
            let result = results.filter(result => result.ruleName == nodeId)[0];
            if (ruleChart.nodeId === ruleName) {
              this.currentNode = {
                data: ruleChart
              };
            }
            ruleChart.ruleStatus = this.ruleStatus;
            if (result) {
              ruleChart.status = result.status;
              ruleChart.dynamicColor = this.getDynamicColor(result.status);
              ruleChart.destinationUrl = result.destinationUrl;
              ruleChart.color = result.color;
              ruleChart.childStatus = childStatus;
              ruleChart.updatedAt = result.updatedAt; 
              ruleChart.score = result.score;
              ruleChart.storageData = result.storageData;
              ruleChart.workflowChildId = result.workflowChildId;
              ruleChart.content = result.content;
              ruleChart.buttonColor = 'danger';  
              if (childStatus && childStatus.length > 0) {
                let successCount = childStatus.filter(result => result == 200 || result == 202).length;
                //console.log(`${result.ruleName} width total:${childStatus.length} and success: ${successCount}`);
                if (successCount == 0) {
                  ruleChart.buttonColor = 'danger';  
                } else if (successCount < childStatus.length) {
                  ruleChart.buttonColor = 'warning';  
                } else {
                  ruleChart.buttonColor = 'success';  
                }
              }
              if (result.status !== 200 && result.status !== 202 ) {
                this.rulesFailed.push(ruleChart);
              }
            } else {
              ruleChart.status = 404;
              ruleChart.dynamicColor = this.getDynamicColor(404);
              ruleChart.color = 'danger';
              ruleChart.buttonColor = 'danger';
              this.rulesFailed.push(ruleChart);
            }
          });
          this.updateChart();
        });  
      });

    });  
  }

  public getDynamicColor(key) {
    return this.statusColor[`status_${key}`] + `!important`; 
  }

  getWorkflow(queryParams: Params): Observable<string> {
    if (queryParams.workflowId) {
      return observableOf(queryParams.workflowId);
    }
    return this.conductorService.lastWorflow().pipe(map((workflow: Workflow) => {
      return workflow.workflowId;
    }));
  }

  tabSelected(tab: ItTabItemComponent) {
    setTimeout(() => {
      this.chart?.svgHeight(this.chartContainer.nativeElement.offsetHeight).render();
    }, 1000);
    if (tab.id === this.tabPA?.id) {
      this.tabRuleActive = false;
      this.tabPAActive = true;
      this.tabFailedActive = false;
    }
    if (tab.id === this.tabRule?.id) {
      this.tabRuleActive = true;
      this.tabPAActive = false;
      this.tabFailedActive = false;
    }
    if (tab.id === this.tabFailed?.id) {
      this.tabRuleActive = false;
      this.tabPAActive = false;
      this.tabFailedActive = true;
    }    
  }

  ngAfterViewInit() {
    if (!this.chart) {
      this.chart = new OrgChart(); // Zoom ridotto per iPad;
    }
    this.updateChart();
    setTimeout(() => {
      this.chart?.svgHeight(this.chartContainer.nativeElement.offsetHeight).render();
    }, 1000);
  }

  ngOnChanges() {
    this.updateChart();
  }

  updateChart() {
    if (!this.data) {
      return; 
    }
    if (!this.chart) {
      return; 
    }
    if (!this.chartContainer) {
      return;
    }
    this.chart
      .container(this.chartContainer.nativeElement)
      .imageName(this.codiceIpa || Rule.AMMINISTRAZIONE_TRASPARENTE)
      .svgHeight(this.chartContainer.nativeElement.offsetHeight)  
      .data(this.data)
      .layout('left')
      .onNodeClick(d => {
        this.currentNode = d;
        this.tabRuleActive = true;
        this.tabPAActive = false;
        this.tabFailedActive = false;
      })
      .buttonContent(({ node, state }) => {
        return `<div class="w-100 h-100 border rounded bg-${node.data.buttonColor}">
        <div class="d-flex">
          <span class="h5 text-white">${node.data._directSubordinates}</span>
          <svg class="icon-light icon align-middle">${
          node.children
            ? `<use href="./bootstrap-italia/dist/svg/sprites.svg#it-minus-circle"></use>`
            : `<use href="./bootstrap-italia/dist/svg/sprites.svg#it-plus-circle"></use>`
        }</svg></div></div>`;
      })
      .nodeContent(function (d, i, arr, state) {
          let isTermLarge = d?.data?.term?.length > 60,
            isTermUltraLarge = d?.data?.term?.length > 200,
            classBox = !isTermLarge ? `h6`: `fw-bolder`,
            border = d?.data?.dynamicColor || `border-primary`,
            ultraLarge = isTermUltraLarge? `pt-0 px-1` : ``; 
          return `
          <div class="card-wrapper card-space hmin-100">
            <div class="card card-bg shadow-lg border border-5 ${border}" style="border-color: ${border}">
              <div class="card-body pb-0 ${ultraLarge}">
                <span class="text-break d-flex ${classBox}">${d.data.term}</span>
                ${
                  d.data.status
                    ? `<span class="fst-italic" style="color: ${d.data.dynamicColor}">${d.data.ruleStatus[d.data.status].ruletitle}</span>`
                    : ``
                }
                </div>
            </div>
          </div>
          `
      })
      .render();
  }

  zoomOut() {
    this.chart.zoomOut();
    return false;
  }

  zoomIn() {
    this.chart.zoomIn();
    return false;
  }

  exportImg(full: boolean) {
    Helpers.computedStyleToInlineStyle(
      this.chartContainer.nativeElement, { 
        recursive: true, 
        properties: ['color','height','width','box-sizing','background','border',
                    'font-size','margin-top','margin-bottom','padding','border-bottom'] 
      }
    );
    this.chart.exportImg({
      full: full,
      scale: 10,
      backgroundColor: "#5d7083" 
    });
    return false;
  }

  exportPdf() {
    Helpers.computedStyleToInlineStyle(
      this.chartContainer.nativeElement, { 
        recursive: true, 
        properties: ['color','height','width','box-sizing','background','border',
                    'font-size','margin-top','margin-bottom','padding','border-bottom'] 
      }
    );
    let filename = this.company.codiceIpa || Rule.AMMINISTRAZIONE_TRASPARENTE;
    this.chart.exportImg({
      save: false,
      scale: 10,
      backgroundColor: "#5d7083",
      onLoad: (base64) => {
        var pdf = new jsPDF({
          orientation: "landscape",
          format: 'a4'
        });
        var img = new Image();
        img.src = base64;
        img.onload = function () {
          pdf.addImage(
            img,
            'JPEG',
            0,
            0,
            pdf.internal.pageSize.getWidth(),
            pdf.internal.pageSize.getHeight(),
            undefined,
            "FAST"
          );
          pdf.save(`${filename}.pdf`);
        };
      },
    });
    return false;
  }

  swap() {
    this.chart.layout(["right","bottom","left","top"][this.index++%4]).render().fit();
    return false;
  }

  compactGraph() {
    this.chart.compact(!!(this.compact++%2)).render().fit();
    return false;
  }

  fit() {
    this.chart.fit();
    return false;
  }

  expandAll() {
    this.chart.expandAll();
    return false;
  }

  collapseAll() {
    this.chart.collapseAll();
    return false;
  }

  center() {        
    this.chart.setCentered(Rule.AMMINISTRAZIONE_TRASPARENTE).render();
    return false;
  }

  centerNode(node) {
    if (node) {
      this.chart.setCentered(node.nodeId).render();    
      const attrs = this.chart.getChartState();
      const root = attrs.generateRoot(attrs.data)
      const descendants = root.descendants();
      this.currentNode = descendants.filter(({ data }) => attrs.nodeId(data) == node.nodeId)[0];
  
    }
    return false;
  }

  showErrorMessage(ruleName: string) {
    this.resultService.getAll({
      workflowId: this.filterFormSearch.value.workflowId,
      codiceIpa: this.company.codiceIpa,
      ruleName: `${ruleName}/child`, 
      size: 1,
      noCache: true
    }).subscribe((results: Result[]) => {
      if (results.length == 1 && results[0].errorMessage) {
        this.apiMessageService.sendMessage(MessageType.ERROR, results[0].errorMessage, NotificationPosition.Right);
      } else {
        this.apiMessageService.sendMessage(MessageType.ERROR, `it.result.errorNotFound`, NotificationPosition.Right);
      }
    });
  }

  @HostListener('window:popstate', ['$event'])
  onPopState(event) {
    let dest = `/company-map?zoom=${this.zoom}&codiceIpa=${this.codiceIpa}`;
    if (this.fromMap) {
      if (this.paramsWorkflowId) {
        dest += `&workflowId=${this.paramsWorkflowId}`;
      }
      event.stopPropagation();
      this.router.navigateByUrl(dest, { onSameUrlNavigation: 'reload', replaceUrl: true });
    }
    return false;
  }

  replacer(key, value) {
    if(value instanceof Map) {
      return Object.fromEntries(value);
    } else {
      return value;
    }
  }

  saveRules(): boolean {
    let conf: Configuration = new Configuration();
    conf.id = this.ruleConfigurationId ? this.ruleConfigurationId: undefined;
    conf.application = `rule-service`;
    conf.profile = `default`;
    conf.key = ConfigurationService.JSONRULES_KEY;
    conf.value = JSON.stringify(this.rules, this.replacer);
    this.configurationService.save(conf).subscribe((result: any) => {
      this.ruleConfigurationId = result.id;
      this.rules = new Map();
      let value = JSON.parse(result.value);
      Object.keys(value).forEach((key: string) => {
        this.rules.set(key, this.ruleService.buildInstance(value[key]));
      });
    });
    return false;
  }

  openEditModal() {
    this.editNode = {
      nodeId: this.currentNode?.data?.nodeId,
      term: this.currentNode?.data?.term,
      alternativeTerm: Object.assign([], this.currentNode?.data?.alternativeTerm),
      create: false
    };
    this.editModal.toggle();
  }

  openCreateModal() {
    this.editNode = {
      nodeId: undefined,
      term: undefined,
      create: true,
      alternativeTerm: []
    };
    this.editModal.toggle();
  }

  new() {
    let keyValue = this.newRuleForm.controls.key.value;
    if (this.rules.get(keyValue)) {
      this.apiMessageService.sendMessage(
        MessageType.ERROR, 
        this.translateService.instant('it.configuration.rule.new.error'), 
        NotificationPosition.Top
      );
      return;
    }
    let newRule: Rule = _.cloneDeep(this.rules.get(this.newRuleForm.controls.copyFrom.value));
    this.rules.set(keyValue, newRule);
    this.loadSelectRules();
    this.filterFormSearch.controls.rootRule.patchValue(keyValue);
    this.newModal.toggle();
    this.saveRules();    
    return false;
  }

  edit(ngForm: NgForm) {
    if (this.editNode.create) {
      let parentRule = this.findCurrentRule();
      if (parentRule.childs) {
        if (Object.keys(parentRule.childs)
              .filter((childkey) => childkey === this.editNode.nodeId).length !== 0) {
          this.apiMessageService.sendMessage(
            MessageType.ERROR, 
            this.translateService.instant('it.configuration.rule.new.error'), 
            NotificationPosition.Top
          );
          return;
        }
      }      
      this.chart.addNode({
        id: this.editNode.nodeId,
        nodeId: this.editNode.nodeId,
        color: 'primary',
        buttonColor: 'primary',
        parentId: this.currentNode.data.nodeId,
        term: this.editNode.term,
        alternativeTerm: this.editNode.alternativeTerm
      });
      this.chart.setCentered(this.editNode.nodeId).render();
      let rule: Rule = new Rule();
      rule.term = [];
      rule.term.push(new Term(this.editNode.term, 200));
      this.editNode.alternativeTerm.forEach((alternativeTerm: string) => {
        rule.term.push(new Term(alternativeTerm, 202));
      });
      if (!parentRule.childs) {
        parentRule.childs = {};
      }
      parentRule.childs[this.editNode.nodeId] = rule;
      this.loadSelectRules();
      this.editModal.toggle();
    } else {
      this.currentNode.data.nodeId = this.editNode.nodeId;
      this.currentNode.data.term = this.editNode.term;
      this.currentNode.data.alternativeTerm = this.editNode.alternativeTerm;      
      this.chart.render();
      let rule = this.findCurrentRule();
      rule.term = [];
      rule.term.push(new Term(this.editNode.term, 200));
      this.editNode.alternativeTerm.forEach((alternativeTerm: string) => {
        rule.term.push(new Term(alternativeTerm, 202));
      });
      this.editModal.toggle();
    }
    this.saveRules();
  }

  delete() {
    let currentNode = this.currentNode;
    if (currentNode) {      
      let rule: Rule = this.rules.get(this.filterFormSearch.controls.rootRule.value);
      if (currentNode.parent) {
        let parentRule: Rule;
        if (currentNode.parent.id === this.filterFormSearch.controls.rootRule.value) {
          parentRule = rule;
        } else {
          parentRule = this.findRule(rule.childs, currentNode.parent.id);
        }
        if (parentRule) {
          delete parentRule.childs[currentNode.id];
        }
        this.chart.removeNode(currentNode.data.nodeId);
        this.currentNode = undefined;
        this.saveRules();
        this.loadSelectRules();
      } else {
        this.conductorService.getAll({
          includeClosed: true,
          includeTasks: false
        }).subscribe((workflows: Workflow[]) => {
          let numero = workflows.filter((workflow: Workflow) => workflow.input.root_rule == currentNode.data.nodeId).length;
          if (numero > 0) {
            this.apiMessageService.sendMessage(
              MessageType.ERROR, 
              this.translateService.instant(
                'it.configuration.rule.delete.error',
                {
                  'name': currentNode.data.nodeId,
                  'numero': numero
                }
              ), 
              NotificationPosition.Top
            );  
          } else {
            this.rules.delete(currentNode.data.nodeId);
            this.filterFormSearch.controls.rootRule.patchValue(undefined);    
            this.chart.removeNode(currentNode.data.nodeId);
            this.currentNode = undefined;
            this.saveRules();
            this.loadSelectRules();    
          }
        });
      }
    }
  }

  findCurrentRule(): Rule {
    let rule: Rule = this.rules.get(this.filterFormSearch.controls.rootRule.value);
    if (this.currentNode.data.nodeId === this.filterFormSearch.controls.rootRule.value) {
      return rule;
    }
    return this.findRule(rule.childs, this.currentNode.data.nodeId);
  }

  findRule(childs: Map<String, Rule>, id: string) {
    let result;
    if (childs) {
      let filter = Object.keys(childs).filter((childkey) => childkey === id);
      if (filter.length === 1) {
        result = childs[id];
      } else {
        Object.keys(childs).forEach((childkey) => {          
          let childResult = this.findRule(childs[childkey].childs, id);
          if(childResult) {
            result = childResult;
          }
        });
      }
    }
    return result;
  }

  searchRuleFn(term: string, item: RuleChart) {
		term = term.toLowerCase();
		let result = item.term.toLowerCase().indexOf(term) > -1 || 
      item.alternativeTerm?.filter((alternativeterm) => {
        return alternativeterm.toLowerCase().indexOf(term) > -1
      }).length > 0;
    return result;
  }

  optionsRuleSelected(item?: RuleChart) {
    console.log('1');
    this.centerNode(item);
  }

  // -------------------------------
  // On Destroy.
  // -------------------------------

  public ngOnDestroy() {
    this.chart = undefined;
  }

}
