import { DatePipe } from '@angular/common';
import { Input, ChangeDetectionStrategy, Component, OnInit, ViewEncapsulation, SimpleChanges, OnChanges, OnDestroy, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, catchError, map, switchMap } from 'rxjs';
import { ApiMessageService, MessageType } from '../api-message.service';
import { Workflow } from '../conductor/workflow.model';
import { Configuration } from '../configuration/configuration.model';
import { ConfigurationService } from '../configuration/configuration.service';
import { Result } from '../result/result.model';
import { ResultService } from '../result/result.service';
import { Rule } from '../rule/rule.model';
import { RuleService } from '../rule/rule.service';
import { Company } from './company.model';
import { EChartsOption } from 'echarts';
import { buildGaugeOption, GaugeData, toPercent } from '../../../../shared/gauge-options';

@Component({
  selector: 'company-rule',
  changeDetection: ChangeDetectionStrategy.Default,
  templateUrl: './company-rule.component.html',
  encapsulation: ViewEncapsulation.None,
  providers: [DatePipe],
  standalone: false
})
export class CompanyRuleComponent implements OnInit, OnChanges, OnDestroy,AfterViewInit {

  @Input() isAuthenticated: boolean = false;
  @Input() showGaugeTitle: boolean = false;
  @Input() company!: Company;
  @Input() workflowId!: string;

  @Input() ruleName!: string;
  @Input() results!: Result[];
  @Input() rules!: Map<String, Rule>;

  protected data!: any[]|undefined;
  protected rulesOK!: number;

  @Input() chartDivStyle: string = 'width: 100% !important; height: 100% !important; aspect-ratio: 12/9;';
  @ViewChild("gaugeContainer", {static: false}) gaugeContainer!: ElementRef;

  protected chartOptions: any = {};
  
  private viewInitialized = false;
  private pendingChartData: { data: any[]|undefined, rulesOK: number, company?: Company } | null = null;

  constructor(
    protected apiMessageService: ApiMessageService,
    private ruleService: RuleService,
    private resultService: ResultService,
    private configurationService: ConfigurationService,
    protected router: Router
  ) {}

  ngOnInit(): void {}

  ngOnDestroy(): void {}
  
  ngAfterViewInit(): void {
    this.viewInitialized = true;
    // Se loadChart era stato chiamato prima che la view fosse pronta, eseguilo ora
    if (this.pendingChartData) {
      const { data, rulesOK, company } = this.pendingChartData;
      this.pendingChartData = null;
      this.loadChart(data, rulesOK, company);
    }
  }


  ngOnChanges(changes: SimpleChanges) {
    if (changes['workflowId']) {
      this.manageChart(this.workflowId);
    }
    if (changes['results']) {
      this.manageResults(this.ruleName, this.results);
    }
  }

  workflowRuleName(workflowId: string): Observable<string> {
    return this.resultService.getWorkflow(workflowId).pipe(
      map((result: Workflow) => result.root_rule),
      catchError(() => this.ruleFromConfiguration())
    );
  }

  ruleFromConfiguration(): Observable<string> {
    return this.configurationService.getAll().pipe(
      switchMap((configurations: Configuration[]) => {
        return configurations
          .filter((c: Configuration) => c.key === ConfigurationService.WORKFLOW_CRON_BODY)
          .map((c: Configuration) => String(JSON.parse(c.value).root_rule));
      })
    );
  }

  manageChart(workflowId: string) {
    this.workflowRuleName(workflowId).subscribe((ruleName: string) => {
      this.resultService.getAll({
        workflowId: workflowId,
        codiceIpa: this.company.codiceIpa,
        size: 500,
        noCache: true
      }, this.isAuthenticated ? '/codiceipa/byWorkflow' : '/codiceipa').subscribe((results: Result[]) => {
        this.manageResults(ruleName, results);
      });
    });
  }

  manageResults(ruleName: string, results: Result[]) {
    if (results.length === 0) {
      this.apiMessageService.sendMessage(MessageType.WARNING, `Risultati non presenti per la PA: ${this.company?.denominazioneEnte}!`);
    }
    this.rulesOK = results.filter(r => r.status == 200 || r.status == 202).length;
    let company = this.company || results[0]?.company;
    if (this.rules) {
      const rule = this.rules.get(ruleName);
      this.data = rule?.getCharts(undefined, ruleName, []);
      this.loadChart(this.data, this.rulesOK, company);
    } else {
      this.ruleService.getRules().subscribe((rules: Map<String, Rule>) => {
        const rule = rules.get(ruleName);
        this.data = rule?.getCharts(undefined, ruleName, []);
        this.loadChart(this.data, this.rulesOK, company);
      });
    }
  }

  private get containerWidth(): number {
    return this.gaugeContainer?.nativeElement?.offsetWidth || 350;
  }

  loadChart(data: any[] | undefined, rulesOK: number, company?: Company) {
    setTimeout(() => {
      const gaugeData: GaugeData = {
        rulesOK,
        total: data?.length ?? 0,
        denominazioneEnte: company?.denominazioneEnte ?? '',
        codiceIpa: company?.codiceIpa ?? ''
      };

      this.chartOptions = buildGaugeOption(gaugeData, {
        showTitle: this.showGaugeTitle,
        containerWidth: this.containerWidth,
        showToolbox: true
      });
    });
  }

}