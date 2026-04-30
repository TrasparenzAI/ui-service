import { Component, OnInit, ChangeDetectionStrategy, signal } from '@angular/core';
import { FormBuilder, FormGroup, FormControl } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { DatePipe } from '@angular/common';
import { Rule } from '../rule/rule.model';
import { ResultService } from './result.service';
import { Result } from './result.model';
import { ResultGroupingService } from './result-grouping.service';
import { ConfigurationService } from '../configuration/configuration.service';
import { Company } from '../company/company.model';
import { ConductorService } from '../conductor/conductor.service';
import { Workflow } from '../conductor/workflow.model';
import { EChartsOption } from 'echarts';

@Component({
  selector: 'app-history',
  changeDetection: ChangeDetectionStrategy.Default,
  templateUrl: './history.component.html',
  providers: [DatePipe],
  standalone: false
})
export class HistoryComponent implements OnInit {

  protected filterFormSearch: FormGroup;
  protected collapse: boolean = false;
  protected isLoadingCsv: boolean = false;
  protected ruleName: string;
  protected company: Company;

  loadingChart = signal(false);
  protected chartOptions: EChartsOption = {};

  constructor(
    private formBuilder: FormBuilder,
    private resultService: ResultService,
    private resultGroupingService: ResultGroupingService,
    private configurationService: ConfigurationService,
    private conductorService: ConductorService,
    private route: ActivatedRoute,
    private datepipe: DatePipe,
    protected router: Router
  ) {}

  ngOnInit(): void {
    this.route.queryParams.subscribe((queryParams) => {
      this.ruleName = queryParams['ruleName'] == '' ? '' : queryParams['ruleName'] || Rule.AMMINISTRAZIONE_TRASPARENTE;
      this.filterFormSearch = this.formBuilder.group({
        ruleName: new FormControl(this.ruleName),
        codiceIpa: new FormControl(queryParams['codiceIpa']),
        sort: new FormControl(queryParams['sort'] || 'createdAt,desc'),
      });

      this.loadingChart.set(true);

      this.resultService.listWorkflows().subscribe((workflows: Workflow[]) => {
        this.resultService.listWorkflows(queryParams['codiceIpa']).subscribe((ipaWorkflows: Workflow[]) => {
          const workflowsMap: Record<string, string> = {};
          ipaWorkflows.concat(workflows)
            .sort((a, b) => (a.startTime < b.startTime) ? 1 : -1)
            .forEach((workflow: Workflow) => {
              workflowsMap[workflow.workflowId] = this.datepipe.transform(workflow.startTime, 'dd/MM/yyyy');
            });

          this.resultService.getAll({
            codiceIpa: queryParams['codiceIpa'],
            size: 5000
          }).subscribe((results: Result[]) => {
            if (!this.company) this.company = results[0]?.company;

            this.configurationService.getStatusColor().subscribe((statusColor: any) => {
              this.configurationService.getSliceColor().subscribe((colors: any) => {
                const resultGrouped = this.resultGroupingService.groupByWorkflowOnly(results);

                const chartData = Array.from(resultGrouped.entries())
                  .map(([workflowId, count]) => ({
                    date: workflowsMap[workflowId],
                    count: count,
                    color: this.getColorForCount(count, colors.dettagli, statusColor['status_404'])
                  }))
                  .filter(item => item.date != null)
                  .sort((a, b) => {
                    const [dayA, monthA, yearA] = a.date.split('/').map(Number);
                    const [dayB, monthB, yearB] = b.date.split('/').map(Number);
                    return new Date(yearA, monthA - 1, dayA).getTime() - new Date(yearB, monthB - 1, dayB).getTime();
                  });

                this.loadChart(chartData);
                this.loadingChart.set(false);
              });
            });
          });
        });
      });
    });
  }

  getColorForCount(count: number, colors: any[], defaultColor: string): string {
    const colorRange = colors.find((c: any) => count >= c.min && count <= c.max);
    return colorRange?.color || defaultColor;
  }

  private loadChart(chartData: { date: string; count: number; color: string }[]): void {
    this.chartOptions = {
      toolbox: {
        feature: {
          saveAsImage: {
            title: 'Salva immagine',
            name: 'storico_sezioni'
          }
        }
      },
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        formatter: (params: any) => {
          const p = params[0];
          return `${p.axisValue}<br/>Sezioni rilevate: <b>${p.value}</b>`;
        }
      },
      grid: {
        left: '3%',
        right: '3%',
        bottom: '15%',
        containLabel: true
      },
      dataZoom: [
        {
          type: 'inside',
          xAxisIndex: 0,
          filterMode: 'none'
        },
        {
          type: 'slider',
          xAxisIndex: 0,
          bottom: 0,
          height: 20
        }
      ],
      xAxis: {
        type: 'category',
        data: chartData.map(d => d.date),
        axisLabel: {
          rotate: 45,
          fontSize: 11,
          interval: 0,
          overflow: 'truncate',
          width: 70
        },
        axisTick: {
          alignWithLabel: true
        }
      },
      yAxis: {
        type: 'value',
        min: 0,
        max: 60
      },
      series: [
        {
          name: 'Sezioni rilevate',
          type: 'bar',
          data: chartData.map(d => ({
            value: d.count,
            itemStyle: {
              color: d.color,
              borderRadius: [5, 5, 0, 0]
            }
          })),
          animationDuration: 1000,
          animationDelay: 100
        }
      ]
    };
  }
}