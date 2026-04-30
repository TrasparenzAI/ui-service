import { Component, OnInit, OnDestroy, HostListener, ViewEncapsulation } from '@angular/core';
import { Workflow } from '../conductor/workflow.model';
import { ResultService } from './result.service';
import { Rule, SelectRule } from '../rule/rule.model';
import { TranslateService } from '@ngx-translate/core';
import { DatePipe } from '@angular/common';
import { FormBuilder, FormControl, FormGroup } from '@angular/forms';
import { debounceTime } from 'rxjs';
import { DurationFormatPipe } from '../../shared/pipes/durationFormat.pipe';
import { Breakpoints, BreakpointObserver } from '@angular/cdk/layout';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute, Router } from '@angular/router';
import { RuleService } from '../rule/rule.service';
import { EChartsOption } from 'echarts';
import { ConfigurationService } from '../configuration/configuration.service';

@Component({
  selector: 'app-result-pie',
  templateUrl: './result-pie.component.html',
  encapsulation: ViewEncapsulation.None,
  providers: [DatePipe, DurationFormatPipe],
  styles: ``,
  standalone: false
})
export class ResultPieComponent implements OnInit, OnDestroy {

  isWorkflowLoaded: boolean = false;
  chartDivStyle: string = 'height:75vh !important';
  protected isPieLoaded = false;
  protected ruleName: string;

  protected filterFormSearch: FormGroup;

  protected optionsWorkflow: Array<any> = [];
  protected optionsRule: Array<any>;
  protected rules: SelectRule[];

  protected small: boolean = false;
  protected workflowId: string;
  protected statusColor: any;

  // ECharts options (one per chart slot, or combined)
  protected chartOptions: EChartsOption = {};

  // Click handlers bound to chart via echarts events
  protected onChartEventParent: (params: any) => void;
  protected onChartEventChild: (params: any) => void;

  // Internal state for double-pie navigation
  private _parentKey: string | undefined;

  constructor(
    protected httpClient: HttpClient,
    private route: ActivatedRoute,
    private formBuilder: FormBuilder,
    private ruleService: RuleService,
    private translateService: TranslateService,
    private responsive: BreakpointObserver,
    private router: Router,
    private datepipe: DatePipe,
    private durationFormatPipe: DurationFormatPipe,
    private configurationService: ConfigurationService,
    private resultService: ResultService
  ) {}

  @HostListener('window:resize', [])
  pieChartLabels() {
    this.responsive.observe([Breakpoints.Small, Breakpoints.XSmall]).subscribe(result => {
      this.small = result?.matches;
      this.chartDivStyle = `height:${result?.matches ? '40' : '75'}vh !important`;
    });
  }

  ngOnInit(): void {
    this.pieChartLabels();

    this.configurationService.getStatusColor().subscribe((color: any) => {
      this.statusColor = color;
    });

    this.route.queryParams.subscribe((queryParams) => {
      this.ruleName = queryParams['ruleName'] || Rule.AMMINISTRAZIONE_TRASPARENTE;
      this.workflowId = queryParams['workflowId'];

      this.resultService.listWorkflows().subscribe((workflows: Workflow[]) => {
        this.isWorkflowLoaded = true;
        let lastWorkflowId!: string;

        workflows.forEach((workflow: Workflow) => {
          if (workflow.isCompleted) {
            if (!lastWorkflowId) {
              lastWorkflowId = workflow.workflowId;
            }
            this.optionsWorkflow.push({
              value: workflow.workflowId,
              text: this.translateService.instant('it.workflow.textfull', {
                startTime: this.datepipe.transform(workflow.startTime, 'dd/MM/yyyy'),
                duration: this.durationFormatPipe.transform(workflow.executionTime)
              }),
              ruleName: workflow.root_rule || Rule.AMMINISTRAZIONE_TRASPARENTE
            });
          }
        });

        this.filterFormSearch = this.formBuilder.group({
          workflowId: new FormControl(queryParams['workflowId'] || lastWorkflowId)
        });

        this.filterFormSearch.valueChanges.pipe(debounceTime(500)).subscribe((valueChanges: any) => {
          this.workflowId = valueChanges.workflowId;
          this.loadRules(this.workflowId || lastWorkflowId);
        });
      });
    });
  }

  ngOnDestroy(): void {}

  /** Dispatches ECharts click events to the correct handler based on series index */
  onChartClick(params: any): void {
    if (params.seriesIndex === 0 && this.onChartEventParent) {
      this.onChartEventParent(params);
    } else if (params.seriesIndex === 1 && this.onChartEventChild) {
      this.onChartEventChild(params);
    }
  }

  loadRules(workflowId: string): void {
    this.ruleService.getRules().subscribe((resultRules: Map<String, Rule>) => {
      this.optionsRule = [];
      const rule = resultRules.get(this.workflowRuleName(workflowId));
      const rules: SelectRule[] = rule.getKeys(undefined, undefined, Rule.AMMINISTRAZIONE_TRASPARENTE, [], -1);

      Object.keys(rules).forEach((index) => {
        this.optionsRule.push({
          value: rules[index].key,
          text: rules[index].text,
          level: rules[index].level,
          class: `ps-${rules[index].level} fs-${rules[index].level + 3}`
        });
      });
      this.rules = rules;
      this.loadResult();
    });
  }

  workflowRuleName(workflowId: string): string {
    if (this.optionsWorkflow) {
      const workflows: any[] = this.optionsWorkflow.filter((value: any) => value.value == workflowId);
      if (workflows.length === 1) {
        return workflows[0].ruleName;
      }
    }
    return Rule.AMMINISTRAZIONE_TRASPARENTE;
  }

  loadResult(): void {
    this.isPieLoaded = false;

    const workflowId = this.filterFormSearch.value.workflowId;
    const selectedRuleName = this.filterFormSearch.value.ruleName;

    const matchedRule = this.rules.find((rule: SelectRule) => rule.key === selectedRuleName);
    const parentKey = matchedRule?.parentKey;
    const title = matchedRule?.text;

    this.resultService.getWorkflowMap(selectedRuleName, [workflowId]).subscribe((result: any) => {
      if (!result[workflowId]) {
        this.router.navigate(['error/not-found']);
        return;
      }

      const chart = result[workflowId];

      if (parentKey) {
        if (this.small) {
          this.chartDivStyle = `height:75vh !important`;
        }
        const titleParent = this.rules.find((rule: SelectRule) => rule.key === parentKey)?.text;

        this.resultService.getWorkflowMap(parentKey, [workflowId]).subscribe((result2: any) => {
          const total = Number(result2[workflowId][200] || 0) + Number(result2[workflowId][202] || 0);
          chart[501] = total - Number(Object.values(chart).reduce((a: number, b: number) => a + b, 0));
          this.loadChart(result2[workflowId], true, chart, titleParent, title, parentKey);
        });
      } else {
        this.loadChart(chart, false);
      }
    });
  }

  loadChart(result: any, double: boolean, result2?: any, titleParent?: string, title?: string, parentKey?: string): void {
    this.isPieLoaded = true;
    this._parentKey = parentKey;

    const buildSeriesData = (dataMap: any) =>
      Object.keys(dataMap).map((key) => ({
        name: this.translateService.instant(`it.rule.status.${key}.ruletitle`),
        value: dataMap[key],
        itemStyle: {
          color: this.statusColor[`status_${key}`],
          borderColor: this.statusColor[`status_${key}`],
          borderWidth: 2
        },
        extra: { key }
      }));

    const labelFontSize = this.small ? 12 : 20;
    const labelFontWeight = this.small ? 'normal' : 'bold';

    const basePieSeries = (name: string, data: any[], radius: string, center: [string, string]): any => ({
      name,
      type: 'pie',
      radius,
      center,
      label: {
        show: true,
        formatter: (params: any) => `${params.percent?.toFixed(2)}%`,
        fontSize: labelFontSize,
        fontWeight: labelFontWeight,
        color: '#000000',
      },
      emphasis: {
        label: { show: true }
      },
      data,
      animationDuration: 1000,
      animationDelay: 100
    });

    if (double) {
      // Two half-pie charts side by side (or stacked on small screens)
      const parentData = buildSeriesData(result);
      const childData = buildSeriesData(result2);

      const [parentCenter, childCenter]: [[string, string], [string, string]] = this.small
        ? [['50%', '25%'], ['50%', '75%']]
        : [['25%', '60%'], ['75%', '60%']];

      const totalParent = parentData.reduce((sum, item) => sum + item.value, 0);
      const totalChild = childData.reduce((sum, item) => sum + item.value, 0);

      this.chartOptions = {
        toolbox: {
          feature: {
            saveAsImage: {
              title: 'Salva immagine',
              name: 'sezioni_confronto'
            }
          }
        },
        tooltip: {
          trigger: 'item',
          formatter: (params: any) =>
            `${params.name}: ${Number(params.value).toLocaleString('it-IT')}`
        },
        title: [
          {
            text: titleParent,
            subtext: `${Number(totalParent).toLocaleString('it-IT')}`,
            left: this.small ? '50%' : '25%',
            top: this.small ? '0%' : '10%',
            textAlign: 'center',
            textStyle: { fontSize: this.small ? 14 : 20, fontWeight: 'bold' },
            subtextStyle: { fontSize: this.small ? 14 : 20, fontWeight: 'bold', color: '#000' },
          },
          {
            text: title,
            subtext: `${Number(totalChild).toLocaleString('it-IT')}`,
            left: this.small ? '50%' : '75%',
            top: this.small ? '50%' : '10%',
            textAlign: 'center',
            textStyle: { fontSize: this.small ? 14 : 20, fontWeight: 'bold' },
            subtextStyle: { fontSize: this.small ? 14 : 20, fontWeight: 'bold', color: '#000' },
          }
        ],
        series: [
          basePieSeries('parent', parentData, this.small ? '50%': '75%', parentCenter),
          basePieSeries('child', childData, this.small ? '50%': '75%', childCenter)
        ]
      };

      // Click handlers: series index 0 = parent, 1 = child
      this.onChartEventParent = (params: any) => {
        const key = params?.data?.extra?.key;
        if (!key) return;
        if (key != 501) {
          this.router.navigate(['/search'], {
            queryParams: {
              workflowId: this.filterFormSearch.value.workflowId,
              ruleName: parentKey || this.filterFormSearch.value.ruleName,
              status: key
            }
          });
        } else {
          this.router.navigate(['/search'], {
            queryParams: {
              workflowId: this.filterFormSearch.value.workflowId,
              ruleName: parentKey || this.filterFormSearch.value.ruleName,
              child: true
            }
          });
        }
      };

      this.onChartEventChild = (params: any) => {
        const key = params?.data?.extra?.key;
        if (!key) return;
        if (key != 501) {
          this.router.navigate(['/search'], {
            queryParams: {
              workflowId: this.filterFormSearch.value.workflowId,
              ruleName: this.filterFormSearch.value.ruleName,
              status: key
            }
          });
        } else {
          this.router.navigate(['/search'], {
            queryParams: {
              workflowId: this.filterFormSearch.value.workflowId,
              ruleName: parentKey || this.filterFormSearch.value.ruleName,
              child: true
            }
          });
        }
      };

    } else {
      // Single half-pie chart
      const singleData = buildSeriesData(result);

      this.chartOptions = {
        toolbox: {
          feature: {
            saveAsImage: {
              title: 'Salva immagine',
              name: 'sezioni'
            }
          }
        },
        tooltip: {
          trigger: 'item',
          formatter: (params: any) =>
            `${params.name}: ${Number(params.value).toLocaleString('it-IT')}`
        },
        series: [
          basePieSeries('main', singleData, '90%', ['50%', '50%'])
        ]
      };

      this.onChartEventParent = (params: any) => {
        const key = params?.data?.extra?.key;
        if (!key) return;
        if (key != 501) {
          this.router.navigate(['/search'], {
            queryParams: {
              workflowId: this.filterFormSearch.value.workflowId,
              ruleName: this.filterFormSearch.value.ruleName,
              status: key
            }
          });
        } else {
          this.router.navigate(['/search'], {
            queryParams: {
              workflowId: this.filterFormSearch.value.workflowId,
              ruleName: this.filterFormSearch.value.ruleName,
              child: true
            }
          });
        }
      };

      this.onChartEventChild = null;
    }
  }
}