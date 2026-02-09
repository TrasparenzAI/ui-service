import { Component, OnInit, HostListener, ViewChild, ElementRef, ViewEncapsulation, signal } from '@angular/core';
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

import * as am5 from '@amcharts/amcharts5';
import * as am5percent from "@amcharts/amcharts5/percent";
import am5locales_it_IT from "@amcharts/amcharts5/locales/it_IT";
import am5themes_Animated from "@amcharts/amcharts5/themes/Animated";
import { Status } from '../rule/status.enum';

@Component({
    selector: 'app-result-pie-rule',
    templateUrl: './result-pie-rule.component.html',
    encapsulation: ViewEncapsulation.None,
    providers: [DatePipe, DurationFormatPipe],
    styles: ``,
    standalone: false
})
export class ResultPieRuleComponent implements OnInit {

  // options
  isWorkflowLoaded: boolean = false;

  series: any;
  series2: any;
  root;
  chartDivStyle: string = 'height:75vh !important';
  protected isPieLoaded = false;

  protected filterFormSearch: FormGroup;

  protected optionsWorkflow: Array<any> = [];
  protected optionsRule: Array<any>;
  protected rules: SelectRule[];

  protected small: boolean = false;
  protected workflowId: string;
  protected statusColor: any;

  @ViewChild('chartdiv', {static: true}) chartdiv: ElementRef;
  @ViewChild('columnchartdiv', {static: true}) columnchartdiv: ElementRef;
  legend: am5.Legend;
  loadingChart = signal(false);

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
    private resultService: ResultService) {
  }

  @HostListener("window:resize", []) 
  pieChartLabels() {
    this.responsive.observe([Breakpoints.Small, Breakpoints.XSmall]).subscribe(result => {
      if (result?.matches) {
        this.series?.labels.template.setAll({
          fontSize: result?.matches ? 12 : 18,
          fontWeight: result?.matches ? 'normal': 'bold',
          fontFamily: "Monospace",
          text: "N. {value}/{valuePercentTotal.formatNumber('0.00')}%",
        });
        this.legend?.children?.clear();
      }
      this.chartDivStyle = `height:${result?.matches ? '30' : '50'}vh !important`;
    });
  }

  ngOnInit(): void {
    this.configurationService.getStatusColor().subscribe((color: any) => {
      this.statusColor = color;
    }); 
    this.route.queryParams.subscribe((queryParams) => {
      this.workflowId = queryParams.workflowId;
      this.conductorService.getAll({
        includeClosed: true,
        includeTasks: false
      }).subscribe((workflows: Workflow[]) => {        
        this.isWorkflowLoaded = true;
        let lastWorkflowId;
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
              ruleName: workflow.input.root_rule || Rule.AMMINISTRAZIONE_TRASPARENTE
            });
          }
        });
        this.filterFormSearch = this.formBuilder.group({
          workflowId: new FormControl(queryParams.workflowId || lastWorkflowId)
        });
        this.filterFormSearch.valueChanges.pipe(
          debounceTime(500)
        ).subscribe((valueChanges: any) => {
          this.workflowId = valueChanges.workflowId;
          this.loadResult();
        });
        this.root = am5.Root.new(this.chartdiv.nativeElement);
        this.root.locale = am5locales_it_IT;
        this.loadResult();
      });
    });
  }
  
  loadResult() : void {
    setTimeout(() => {
      this.root.container.children.clear();
      this.loadingChart.set(true);
    }, 0);
    this.isPieLoaded = false;
    let wokflowId = this.filterFormSearch.value.workflowId;
    this.resultService.getWorkflowMap(Rule.AMMINISTRAZIONE_TRASPARENTE, [wokflowId], false).subscribe((resultAll: any) => {
      var others = {};
      Object.keys(resultAll[wokflowId])
      .filter((key) => {
        return !(key == String(Status.OK) || key == String(Status.ACCEPTED));
      })
      .forEach((key) => {
        others[key] = resultAll[wokflowId][key];
      });
      this.resultService.countResultsAndGroupByCategoriesWidthWorkflowIdAndStatus(wokflowId).subscribe((result: any) => {
        this.loadChart(result, others);
        setTimeout(() => {
          this.loadingChart.set(false);
        }, 0);
      });
    });
  }
  
  loadChart(result: any, resultAll: any) {
    this.isPieLoaded = true;
    if (this.chartdiv) {
      this.root.setThemes([
        am5themes_Animated.new(this.root)
      ]);
      this.root.container.children.clear();

      this.root.container.set("layout", this.root.verticalLayout);

      // Create container to hold charts
      let chartContainer = this.root.container.children.push(am5.Container.new(this.root, {
        layout: this.small ? this.root.verticalLayout : this.root.horizontalLayout,
        width: am5.p100,
        height: am5.p100
      }));

      let chart = chartContainer.children.push(
        am5percent.PieChart.new(this.root, {
          endAngle: 180,
          paddingTop: this.small ? 80 : 0
        })
      );
      let series = chart.series.push(
        am5percent.PieSeries.new(this.root, {
          valueField: "value",
          categoryField: "name"
        })
      );
      
      series.states.create("hidden", {
        endAngle: -90
      });

      series.labels.template.setAll({
        fontSize: this.small ? 12 : 24,
        fontWeight: this.small ? 'normal': 'bold',
        fontFamily: "Monospace",
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

      
      series.slices.template.adapters.add("tooltipText", (text, target) => {
        const dataItem = target.dataItem;
        if (!dataItem) return text;
        
        const category = dataItem.get("category");
        const value = dataItem.get("value");
        const percent = formatNumber(dataItem.get("valuePercentTotal"), 'it-IT', '0.0-2');
        const extra = dataItem.dataContext.extra;
        if(extra.min && extra.max) {
          let label = `Classe (`;
          if (extra.min == extra.max) {
            label += `${extra.min}`;
          } else {
            label += `${extra.min} - ${extra.max}`;
          }
          label += `)`;
          return `${label} = ${value} - (${percent}%)`;
        } else {
          let label = this.translateService.instant(`it.rule.status.${extra.key}.compliance`); 
          return `${label} = ${value} - (${percent}%)`;
        }
      });

      series.slices.template.events.on("click", function(ev) {
        var status = ev.target.dataItem.dataContext.extra.key;
        if (status) {
          this.router?.navigate(['/search'],  { queryParams: {
            workflowId: this.filterFormSearch.value.workflowId,
            ruleName: Rule.AMMINISTRAZIONE_TRASPARENTE,
            status: status 
          }});
        } else {
          this.router?.navigate(['/result-rule'],  { queryParams: {
            workflowId: this.filterFormSearch.value.workflowId,
            min: ev.target.dataItem.dataContext.extra.min,
            max: ev.target.dataItem.dataContext.extra.max
          }});
        }
      }, this);

      let single = [];
      result.forEach((r) => {
        let label = `Classe (`;
        if (r.category.min == r.category.max) {
          label += `${r.category.min}`;
        } else {
          label += `${r.category.min} - ${r.category.max}`;
        }
        label += `)`;
        single.push({
          name: `${label}`,
          value: r.value,
          sliceSettings: {
            fill: am5.color(r.category.color),
            stroke: am5.color(r.category.color)
          },
          extra: {
            min: r.category.min,
            max: r.category.max
          }
        });
      });
      Object.keys(resultAll).forEach((key) => {
        single.push({
          name: this.translateService.instant(`it.rule.status.${key}.compliance`),
          value: resultAll[key],
          sliceSettings: {
            fill: am5.color(this.statusColor[`status_${key}`]),
            stroke: am5.color(this.statusColor[`status_${key}`])
          },
          extra: {
            key: key
          }
        });
      });

      series.data.setAll(single);
      // Create legend
      let legend = chart.children.push(am5.Legend.new(this.root, {
        centerY: am5.percent(50), // Centra verticalmente
        y: am5.percent(50),       // Posizione Y centrale
        layout: this.root.verticalLayout, // Layout verticale per gli elementi
        marginLeft: 20            // Spazio tra chart e legenda
      }));

      legend.labels.template.adapters.add("text", function(text, target) {
        const dataItem = target.dataItem;
        if (dataItem) {          
          // Cast a any per bypassare il type checking
          const category = (dataItem as any).get?.("category") || 
                          (dataItem as any).category ||
                          (dataItem as any)._settings?.category;
          
          const value = (dataItem as any).get?.("value") || 
                        (dataItem as any).value ||
                        (dataItem as any)._settings?.value;
          if (category) {            
            return `${category} = ${value} -`;
          }
        }
        return text;
      });
      legend.data.setAll(series.dataItems);
      // Calcola il totale dinamicamente
      let total = series.data.values.reduce((sum, item) => sum + item.value, 0);

      // Formatta il totale
      let formattedTotal = this.root.numberFormatter.format(total, "#,###");

      let totalLabel = legend.children.push(
        am5.Label.new(this.root, {
          text: `[bold]Totale PA analizzate: ${formattedTotal}[/]`,
          fontSize: 24,
          paddingTop: 10,
          paddingBottom: 5
        })
      );

      // === FUNZIONE DI AGGIORNAMENTO ===
      const updateTotal = () => {
        let total = 0;
        let visibleCount = 0;
        
        series.dataItems.forEach((dataItem) => {
          // Controlla se lo slice è visibile
          if (!dataItem.isHidden()) {
            total += dataItem.get("value") as number;
            visibleCount++;
          }
        });
        
        // Formatta il totale
        const formattedTotal = this.root.numberFormatter.format(total, "#,###");
        totalLabel.set("text", `[bold]Totale PA analizzate: ${formattedTotal}[/]`);
        
      };

      // Aggiorna al caricamento iniziale
      series.events.on("datavalidated", () => {
        updateTotal();
      });

      // IMPORTANTE: Ascolta l'evento "click" su ogni slice della legenda
      legend.itemContainers.template.on("click", (ev) => {
        // Usa un piccolo delay per aspettare che l'animazione finisca
        setTimeout(() => {
          updateTotal();
        }, 50);
      });

      // ALTERNATIVA: Ascolta l'evento di visibilità dei dataItem
      series.dataItems.forEach((dataItem) => {
        dataItem.on("visible", () => {
          updateTotal();
        });
        
        dataItem.on("hidden", () => {
          updateTotal();
        });
      });

      this.legend = legend;

      series.appear(1000, 100);
      this.series = series;
      this.pieChartLabels();
    }
  }
}
