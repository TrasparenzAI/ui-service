import { Component, OnInit, HostListener, ViewChild, ElementRef, ViewEncapsulation } from '@angular/core';
import { ConductorService } from '../conductor/conductor.service';
import { Workflow } from '../conductor/workflow.model';
import { ResultService } from '../result/result.service';
import { Rule } from '../rule/rule.model';
import { TranslateService } from '@ngx-translate/core';
import { DatePipe } from '@angular/common';
import { FormBuilder, FormControl, FormGroup } from '@angular/forms';
import { debounceTime } from 'rxjs';
import { DurationFormatPipe } from '../../shared/pipes/durationFormat.pipe';
import { Breakpoints, BreakpointObserver } from '@angular/cdk/layout';
import { HttpClient } from '@angular/common/http';
import { ConfigurationService } from '../configuration/configuration.service';

import * as am5 from '@amcharts/amcharts5';
import * as am5percent from "@amcharts/amcharts5/percent";
import am5locales_it_IT from "@amcharts/amcharts5/locales/it_IT";

import am5themes_Animated from "@amcharts/amcharts5/themes/Animated";
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
  workflows: Workflow[];
  currentWorkflow: Workflow;

  single = undefined;

  // options
  isWorkflowLoaded: boolean = false;

  series: any;
  chartDivStyle: string = 'height:75vh !important';

  public filterFormSearch: FormGroup;
  protected statusColor: any;

  @ViewChild('chartdiv', {static: true}) chartdiv: ElementRef;
  @ViewChild('columnchartdiv', {static: true}) columnchartdiv: ElementRef;
  @ViewChild('carousel') carousel: ItCarouselComponent;

  constructor(
    protected httpClient: HttpClient,
    private router: Router,
    private formBuilder: FormBuilder,
    private conductorService: ConductorService,
    private translateService: TranslateService,
    private configurationService: ConfigurationService,
    private responsive: BreakpointObserver,
    private resultService: ResultService) {
  }

  @HostListener("window:resize", []) 
  pieChartLabels() {
    this.responsive.observe([Breakpoints.Small, Breakpoints.XSmall]).subscribe(result => {
      this.series?.labels.template.setAll({
        fontSize: result?.matches ? 12 : 28,
        fontWeight: result?.matches ? 'normal': 'bold',
        text: "{valuePercentTotal.formatNumber('0.00')}%",
      });
      this.chartDivStyle = `height:${result?.matches ? '30' : '75'}vh !important`;
    });
  }

  ngOnInit(): void {
    this.configurationService.getStatusColor().subscribe((color: any) => {
      this.statusColor = color;
    });
    this.filterFormSearch = this.formBuilder.group({
      workflowId: new FormControl(''),
    });
    this.filterFormSearch.valueChanges.pipe(
      debounceTime(500)
    ).subscribe(() => {
      let workflowId = this.filterFormSearch.value['workflowId'];
      let wokflow = this.workflows.filter((workflow: Workflow) => {
        return workflow.workflowId === workflowId
      })[0];
      this.loadChart(wokflow.resultCount, workflowId);
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
          workflow.resultCount = result[workflow.workflowId];
          if (this.currentWorkflow && !this.series){
            this.loadChart(workflow.resultCount, workflow.workflowId);
          }
        });
        this.isWorkflowLoaded = true;
      });
    });
  }

  loadChart(result: any, workflowId: string) {
    if (this.chartdiv) {
      let chartDiv: HTMLElement = this.chartdiv.nativeElement;
      let root = am5.Root.new(chartDiv);
      root.locale = am5locales_it_IT;
      root.setThemes([
        am5themes_Animated.new(root)
      ]);
      let chart = root.container.children.push(
        am5percent.PieChart.new(root, {
          endAngle: 180        
        })
      );
      let series = chart.series.push(
        am5percent.PieSeries.new(root, {
          valueField: "value",
          categoryField: "name",
        })
      );
      series.states.create("hidden", {
        endAngle: -90
      });

      series.labels.template.setAll({
        fontSize: 28,
        fontWeight: 'bold',
        text: "{valuePercentTotal.formatNumber('0.00')}%",
      });      
      series.ticks.template.setAll({
        strokeWidth: 2,
        fill: am5.color('#000000'),
        strokeOpacity: 1
      })
      series.slices.template.setAll({
        templateField: "sliceSettings"
      });

      series.slices.template.setAll({
        strokeWidth: 2,
        tooltipText:
          "{category}: {value.formatNumber(',000')}"
      });

      this.single = [];
      if (result) {
        Object.keys(result).forEach((key) => {
          this.single.push({
            name: this.translateService.instant(`it.rule.status.${key}.title`),
            value: result[key],
            sliceSettings: {
              fill: am5.color(this.statusColor[`status_${key}`]),
              stroke: am5.color(this.statusColor[`status_${key}`])
            },
            extra: {
              key: key,
              workflowId: workflowId  
            }
          });
        });  
      }
      series.slices.template.events.on("click", function(ev) {
        var status = ev.target.dataItem.dataContext['extra'].key;
        this.router.navigate(['/search'],  { queryParams: {
          workflowId: workflowId,
          ruleName: Rule.AMMINISTRAZIONE_TRASPARENTE,
          status: status 
        }});
      }, this);
      series.data.setAll(this.single);
      series.appear(1000, 100);
      this.series = series;
      this.pieChartLabels();      
    }
  }

  public getBGColor(key) {
    return this.statusColor[`status_${key}`] + `!important`; 
  }
}
