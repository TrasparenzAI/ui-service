import { Component, OnInit, HostListener, ViewChild, ElementRef, ViewEncapsulation, OnDestroy } from '@angular/core';
import { Workflow } from '../conductor/workflow.model';
import { ResultService } from '../result/result.service';
import { Rule } from '../rule/rule.model';
import { TranslateService } from '@ngx-translate/core';
import { DatePipe } from '@angular/common';
import { DurationFormatPipe } from '../../shared/pipes/durationFormat.pipe';
import { Breakpoints, BreakpointObserver } from '@angular/cdk/layout';
import { HttpClient } from '@angular/common/http';
import { ConfigurationService } from '../configuration/configuration.service';

import { EChartsOption } from 'echarts';

import { ItCarouselComponent } from 'design-angular-kit';
import { Router } from '@angular/router';

@Component({
    selector: 'app-home',
    templateUrl: './home.component.html',
    encapsulation: ViewEncapsulation.None,
    providers: [DatePipe, DurationFormatPipe],
    styles: `
  .home-main {
    background: #d1e7ff left center no-repeat;
  }
  .callout-inner {
    padding: 1rem!important;
    margin-bottom: 0px!important;
  }
  .callout-title {
    top: -2rem!important;
  }
  .legend {
    margin: -24px;
  }
  `,
    standalone: false
})
export class HomeComponent implements OnInit {
  workflows!: Workflow[];
  currentWorkflow!: Workflow;

  // options
  isWorkflowLoaded: boolean = false;

  chartDivStyle: string = 'height:75vh !important';

  protected statusColor: any;

  protected chartOptions!: EChartsOption;
  protected onChartEvent!: (params: any) => void;
  protected small: boolean = false;

  @ViewChild('carousel') carousel!: ItCarouselComponent;

  constructor(
    protected httpClient: HttpClient,
    private router: Router,
    private translateService: TranslateService,
    private configurationService: ConfigurationService,
    private responsive: BreakpointObserver,
    private resultService: ResultService) {
  }

  @HostListener("window:resize", [])
  onResize() {
    this.responsive.observe([Breakpoints.Small, Breakpoints.XSmall]).subscribe(result => {
      this.small = result?.matches;
      this.chartDivStyle = `height:${this.small ? '30' : '75'}vh !important`;
    });
  }

  ngOnInit(): void {
    this.onResize();
    this.configurationService.getStatusColor().subscribe((color: any) => {
      this.statusColor = color;
    });

    this.resultService.listWorkflows().subscribe((workflows: Workflow[]) => {
      this.resultService.getWorkflowMap(Rule.AMMINISTRAZIONE_TRASPARENTE, workflows.map(a => a.workflowId)).subscribe((result: any) => {
        this.workflows = workflows;
        workflows.forEach((workflow, i) => {
          if (workflow.isCompleted) {
            if (!this.currentWorkflow) {
              this.currentWorkflow = workflow;
            }
          }
          workflow.resultCount = result[workflow.workflowId] || {};
        });
        this.isWorkflowLoaded = true;
        if (this.currentWorkflow) {
          this.loadChart(this.currentWorkflow.resultCount, this.currentWorkflow.workflowId);
        }
      });
    });
  }

  onChartClick(params: any): void {
    this.onChartEvent(params);
  }

  loadChart(result: any, workflowId: string) {
    let single: any[] = [];
    if (result) {
      Object.keys(result).forEach((key) => {
        const colorHex = this.statusColor[`status_${key}`];
        single.push({
          name: this.translateService.instant(`it.rule.status.${key}.title`),
          value: result[key],
          itemStyle: {
            color: colorHex,
            borderColor: colorHex,
            borderWidth: 2,
          },
          extra: {
            key,
            workflowId,
          }
        });
      });
    }

    const basePieSeries = (name: string, data: any[], radius: string, center: [string, string]): any => ({
      name,
      type: 'pie',
      radius,
      center,
      label: {
        show: true,
        formatter: (params: any) => `${params.percent?.toFixed(2)}%`,
        fontSize: this.small? 12 : 28,
        fontWeight: 'bold',
        color: '#000000',
      },
      emphasis: {
        label: { show: true }
      },
      data,
      animationDuration: 1000,
      animationDelay: 100
    });
    this.chartOptions = undefined as any;

    setTimeout(() => {
      this.chartOptions = {
        toolbox: {
          feature: {
            saveAsImage: {
              title: 'Salva immagine',
              name: `analisi_completa`
            }
          }
        },
        tooltip: {
          trigger: 'item',
          formatter: (params: any) => {
            const value: number = params.value;
            return `${params.name}: ${value.toLocaleString('it-IT')}`;
          }
        },
        series: [
          basePieSeries('main', single, '90%', ['50%', '50%'])
        ]
      };
    }, 500);

    // Click handlers: series index 0 = parent, 1 = child
    this.onChartEvent = (params: any) => {
      const status: string = params.data?.extra?.key;
      const wfId: string = params.data?.extra?.workflowId;
      if (status && wfId) {
        this.router.navigate(['/search'], {
          queryParams: {
            workflowId: wfId,
            ruleName: Rule.AMMINISTRAZIONE_TRASPARENTE,
            status,
          }
        });
      }
    };
  }

  public getBGColor(key: number | string): string {
    return this.statusColor[`status_${key}`] + `!important`;
  }

  onWorkflowRimosso(item: Workflow) {
    this.workflows = this.workflows.filter(i => i !== item);
  }
}