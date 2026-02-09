import { Component, OnInit, ChangeDetectionStrategy, ViewChild, ElementRef, signal } from '@angular/core';
import { FormBuilder, FormGroup, FormControl } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { DatePipe } from '@angular/common';
import { Rule } from '../rule/rule.model';
import { ResultService } from './result.service';
import { Result } from './result.model';
import { ResultGroupingService } from './result-grouping.service';
import { ConfigurationService } from '../configuration/configuration.service';
import { Company } from '../company/company.model';

import * as am5 from '@amcharts/amcharts5';
import * as am5xy from "@amcharts/amcharts5/xy";
import am5themes_Animated from "@amcharts/amcharts5/themes/Animated";
import am5locales_it_IT from "@amcharts/amcharts5/locales/it_IT";
import { ConductorService } from '../conductor/conductor.service';
import { Workflow } from '../conductor/workflow.model';

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

  @ViewChild('chartdiv', { static: true }) chartdiv: ElementRef;    
  root: am5.Root;
  loadingChart = signal(false);
  protected statusColor: any;

  constructor(private formBuilder: FormBuilder,
              private resultService: ResultService,
              private resultGroupingService: ResultGroupingService,
              private configurationService: ConfigurationService,
              private conductorService: ConductorService,                  
              private route: ActivatedRoute,
              private datepipe: DatePipe,
              protected router: Router) {
  }

  ngOnInit(): void {
    this.route.queryParams.subscribe((queryParams) => {
      this.ruleName = queryParams.ruleName == '' ? '': queryParams.ruleName||Rule.AMMINISTRAZIONE_TRASPARENTE;
      this.filterFormSearch = this.formBuilder.group({
        ruleName: new FormControl(this.ruleName),
        codiceIpa: new FormControl(queryParams.codiceIpa),
        sort: new FormControl(queryParams.sort || 'createdAt,desc'),
      });
      setTimeout(() => {
          this.root?.container?.children?.clear();
          this.loadingChart.set(true);
      }, 0);
      this.conductorService.getAll({
        includeClosed: true,
        includeTasks: false
      }).subscribe((workflows: Workflow[]) => {
        this.conductorService.getAll({
          includeClosed: true,
          includeTasks: false
        },`/${ConductorService.AMMINISTRAZIONE_TRASPARENTE_FLOW}/correlated/${queryParams.codiceIpa}`).subscribe((ipaWorkflows: Workflow[]) => {
          let workflowsMap = {};
          ipaWorkflows.concat(workflows).sort((a,b) => (a.startTime < b.startTime)? 1 : -1).forEach((workflow: Workflow) => {
            workflowsMap[workflow.workflowId] = this.datepipe.transform(workflow.startTime, 'dd/MM/yyyy');
          });
          this.resultService.getAll({
            codiceIpa: queryParams.codiceIpa,
            size: 5000
          }).subscribe((results: Result[]) => {
            if (!this.company) this.company = results[0]?.company;
            this.configurationService.getStatusColor().subscribe((statusColor: any) => {
              this.configurationService.getSliceColor().subscribe((colors: any) => {
                let resultGrouped = this.resultGroupingService.groupByWorkflowOnly(results);                
                this.loadChart(
                  this.initializeRoot(), 
                  Array.from(resultGrouped.entries()).map(([workflowId, count]) => ({
                    date: workflowsMap[workflowId],
                    count: count,
                    color: this.getColorForCount(count, colors.dettagli, statusColor['status_404'])
                  }))
                  .filter(item => item.date != null)
                  .sort((a, b) => {
                    const [dayA, monthA, yearA] = a.date.split('/').map(Number);
                    const [dayB, monthB, yearB] = b.date.split('/').map(Number);
                    
                    const dateA = new Date(yearA, monthA - 1, dayA);
                    const dateB = new Date(yearB, monthB - 1, dayB);
                    
                    return dateA.getTime() - dateB.getTime();
                  })
                );
                setTimeout(() => {
                    this.loadingChart.set(false);
                }, 0);
              });
            })
          });
        });      
      });
    });
  }

  formatDate(dateString: string): string {
    const parts = dateString.split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return dateString;
  }

  getColorForCount(count: number, colors: any[], defaultColor: string): string | undefined {
    const colorRange = colors.find(c => count >= c.min && count <= c.max);
    return colorRange?.color || defaultColor;
  }

  private initializeRoot(): am5.Root {
      if (this.root) {
          this.root.dispose();
      }
      this.root = am5.Root.new(this.chartdiv.nativeElement); 
      return this.root;
  }

  private loadChart(root: am5.Root, chartData: any): void {
      console.log('Caricamento grafico con valore:', chartData);

      root.setThemes([
          am5themes_Animated.new(root)
      ]);
      root.locale = am5locales_it_IT;

      let chart = root.container.children.push(am5xy.XYChart.new(root, {
        panX: true,
        panY: true,
        wheelX: "panX",
        wheelY: "zoomX",
        pinchZoomX: true,
        paddingLeft:0,
        paddingRight:1
      }));

      let cursor = chart.set("cursor", am5xy.XYCursor.new(root, {}));
      cursor.lineY.set("visible", false);

      let xRenderer = am5xy.AxisRendererX.new(root, { 
        minGridDistance: 30, 
        minorGridEnabled: true
      });

      xRenderer.labels.template.setAll({
        rotation: -60,
        centerY: am5.p50,
        centerX: am5.p100,
        paddingRight: 15
      });

      xRenderer.grid.template.setAll({
        location: 1
      })

      let xAxis = chart.xAxes.push(am5xy.CategoryAxis.new(root, {
        maxDeviation: 0.3,
        categoryField: "date",
        renderer: xRenderer,
        tooltip: am5.Tooltip.new(root, {})
      }));

      let yRenderer = am5xy.AxisRendererY.new(root, {
        strokeOpacity: 0.1
      })

      let yAxis = chart.yAxes.push(am5xy.ValueAxis.new(root, {
        maxDeviation: 0.3,
        renderer: yRenderer,
        min: 0,
        max: 60,
        strictMinMax: true
      }));

      let series = chart.series.push(am5xy.ColumnSeries.new(root, {
        name: "Series 1",
        xAxis: xAxis,
        yAxis: yAxis,
        valueYField: "count",
        sequencedInterpolation: true,
        categoryXField: "date",
        tooltip: am5.Tooltip.new(root, {
          labelText: "Sezioni rilevate: {valueY}"
        })
      }));

      series.columns.template.setAll({ 
        cornerRadiusTL: 5, 
        cornerRadiusTR: 5, 
        strokeOpacity: 0,
      });

      series.columns.template.adapters.add("fill", (fill, target) => {
        const dataItem = target.dataItem as any;
        if (dataItem && dataItem.dataContext && dataItem.dataContext.color) {
          return am5.color(dataItem.dataContext.color);
        }
        return fill;
      });

      xAxis.data.setAll(chartData);
      series.data.setAll(chartData);

      series.appear(1000);
      chart.appear(1000, 100);
    }  

}
