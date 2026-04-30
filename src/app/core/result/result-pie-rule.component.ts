import { Component, OnInit, OnDestroy, HostListener, ViewEncapsulation, signal } from '@angular/core';
import { ConductorService } from '../conductor/conductor.service';
import { Workflow } from '../conductor/workflow.model';
import { ResultService } from './result.service';
import { Rule, SelectRule } from '../rule/rule.model';
import { TranslateService } from '@ngx-translate/core';
import { DatePipe, formatNumber } from '@angular/common';
import { FormBuilder, FormControl, FormGroup } from '@angular/forms';
import { debounceTime } from 'rxjs';
import { DurationFormatPipe } from '../../shared/pipes/durationFormat.pipe';
import { Breakpoints, BreakpointObserver } from '@angular/cdk/layout';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute, Router } from '@angular/router';
import { ConfigurationService } from '../configuration/configuration.service';
import { Status } from '../rule/status.enum';
import { EChartsOption } from 'echarts';

@Component({
  selector: 'app-result-pie-rule',
  templateUrl: './result-pie-rule.component.html',
  encapsulation: ViewEncapsulation.None,
  providers: [DatePipe, DurationFormatPipe],
  styles: ``,
  standalone: false
})
export class ResultPieRuleComponent implements OnInit, OnDestroy {

  isWorkflowLoaded: boolean = false;
  chartDivStyle: string = 'height:50vh !important';
  protected isPieLoaded = false;

  protected filterFormSearch: FormGroup;

  protected optionsWorkflow: Array<any> = [];
  protected optionsRule: Array<any>;
  protected rules: SelectRule[];

  protected small: boolean = false;
  protected workflowId: string;
  protected statusColor: any;

  loadingChart = signal(false);

  // ECharts
  protected chartOptions: EChartsOption = {};
  // Keep raw series data for click resolution
  private _seriesData: Array<{ extra: { key?: string; min?: number; max?: number } }> = [];

  constructor(
    protected httpClient: HttpClient,
    private router: Router,
    private route: ActivatedRoute,
    private formBuilder: FormBuilder,
    private conductorService: ConductorService,
    private translateService: TranslateService,
    private responsive: BreakpointObserver,
    private datepipe: DatePipe,
    private durationFormatPipe: DurationFormatPipe,
    private configurationService: ConfigurationService,
    private resultService: ResultService
  ) {}

  @HostListener('window:resize', [])
  pieChartLabels() {
    this.responsive.observe([Breakpoints.Small, Breakpoints.XSmall]).subscribe(result => {
      this.small = result?.matches;
      this.chartDivStyle = `height:${result?.matches ? '30' : '50'}vh !important`;
    });
  }

  ngOnInit(): void {
    this.pieChartLabels();
    this.configurationService.getStatusColor().subscribe((color: any) => {
      this.statusColor = color;
    });
    this.route.queryParams.subscribe((queryParams) => {
      this.workflowId = queryParams['workflowId'];
      this.resultService.listWorkflows().subscribe((workflows: Workflow[]) => {
        this.isWorkflowLoaded = true;
        let lastWorkflowId: string;
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
          this.loadResult();
        });
        this.loadResult();
      });
    });
  }

  ngOnDestroy(): void {}

  loadResult(): void {
    this.loadingChart.set(true);
    this.isPieLoaded = false;

    const workflowId = this.filterFormSearch.value.workflowId;

    this.resultService.getWorkflowMap(Rule.AMMINISTRAZIONE_TRASPARENTE, [workflowId], false).subscribe((resultAll: any) => {
      const others: any = {};
      Object.keys(resultAll[workflowId])
        .filter(key => !(key === String(Status.OK) || key === String(Status.ACCEPTED)))
        .forEach(key => { others[key] = resultAll[workflowId][key]; });

      this.resultService.countResultsAndGroupByCategoriesWidthWorkflowIdAndStatus(workflowId).subscribe((result: any) => {
        this.loadChart(result, others);
        this.loadingChart.set(false);
      });
    });
  }

  loadChart(result: any, resultAll: any): void {
    this.isPieLoaded = true;

    // Build unified series data array (same order used for click resolution)
    const seriesData: any[] = [];
    this._seriesData = [];

    // Category slices (Classe)
    result.forEach((r: any) => {
      let label = `Classe (`;
      if (r.category.min === r.category.max) {
        label += `${r.category.min}`;
      } else {
        label += `${r.category.min} - ${r.category.max}`;
      }
      label += `)`;

      seriesData.push({
        name: label,
        value: r.value,
        itemStyle: {
          color: r.category.color,
          borderColor: r.category.color,
          borderWidth: 2
        }
      });

      this._seriesData.push({ extra: { min: r.category.min, max: r.category.max } });
    });

    // Status slices
    Object.keys(resultAll).forEach(key => {
      seriesData.push({
        name: this.translateService.instant(`it.rule.status.${key}.compliance`),
        value: resultAll[key],
        itemStyle: {
          color: this.statusColor[`status_${key}`],
          borderColor: this.statusColor[`status_${key}`],
          borderWidth: 2
        }
      });
      this._seriesData.push({ extra: { key } });
    });

    // Total for legend footer
    const total = seriesData.reduce((sum, item) => sum + item.value, 0);
    const formattedTotal = total.toLocaleString('it-IT');

    const labelFontSize = this.small ? 12 : 20;

    this.chartOptions = {
      toolbox: {
        feature: {
          saveAsImage: {
            title: 'Salva immagine',
            name: 'compliance_per_classi'
          }
        }
      },
      tooltip: {
        trigger: 'item',
        formatter: (params: any) => {
          const extra = this._seriesData[params.dataIndex]?.extra;
          const pct = formatNumber(params.percent, 'it-IT', '0.0-2');
          if (extra?.min !== undefined && extra?.max !== undefined) {
            let label = `Classe (`;
            label += extra.min === extra.max ? `${extra.min}` : `${extra.min} - ${extra.max}`;
            label += `)`;
            return `${label} = ${params.value} - (${pct}%)`;
          } else {
            const label = this.translateService.instant(`it.rule.status.${extra?.key}.compliance`);
            return `${label} = ${params.value} - (${pct}%)`;
          }
        }
      },
      legend: {
        show: !this.small,
        orient: 'vertical',
        left: '0',
        top: 'middle',
        textStyle: {
          fontSize: this.small ? 12 : 16,
        },
        formatter: (name: string) => {
          const item = seriesData.find(d => d.name === name);
          if (!item) return name;
          const pct = total > 0 ? formatNumber((item.value / total) * 100, 'it-IT', '0.0-2') : '0';
          return `${name} = ${item.value} - ${pct}%`;
        },
      },
      graphic: [
        {
          type: 'text',
          left: this.small ? 'center' : '10px',
          bottom: this.small ? 0 : 50,
          style: {
            text: `Totale PA analizzate: ${formattedTotal}`,
            fontSize: this.small ? 14 : 28,
            fontWeight: 'bold',
            fill: '#333'
          }
        }
      ],
      series: [
        {
          type: 'pie',
          radius: ['0%', '90%'],
          center: ['50%', '50%'],
          label: {
            show: true,
            formatter: (params: any) => `${params.percent?.toFixed(2)}%`,
            fontSize: labelFontSize,
            fontWeight: this.small ? 'normal' : 'bold',
            fontFamily: 'Monospace'
          },
          emphasis: {
            label: { show: true }
          },
          data: seriesData,
          animationDuration: 1000,
          animationDelay: 100
        }
      ]
    };
  }

  onChartClick(params: any): void {
    const extra = this._seriesData[params.dataIndex]?.extra;
    if (!extra) return;

    if (extra.key) {
      this.router.navigate(['/search'], {
        queryParams: {
          workflowId: this.filterFormSearch.value.workflowId,
          ruleName: Rule.AMMINISTRAZIONE_TRASPARENTE,
          status: extra.key
        }
      });
    } else {
      this.router.navigate(['/result-rule'], {
        queryParams: {
          workflowId: this.filterFormSearch.value.workflowId,
          min: extra.min,
          max: extra.max
        }
      });
    }
  }
}