import { Component, OnInit, HostListener, ViewChild, ElementRef, ViewEncapsulation } from '@angular/core';
import { ConductorService } from '../conductor/conductor.service';
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
import { StatusColor } from '../../common/model/status-color.enum';

import * as am5 from '@amcharts/amcharts5';
import * as am5percent from "@amcharts/amcharts5/percent";
import am5locales_it_IT from "@amcharts/amcharts5/locales/it_IT";
import am5themes_Animated from "@amcharts/amcharts5/themes/Animated";
import { ConfigurationService } from '../configuration/configuration.service';

@Component({
    selector: 'app-result-pie',
    templateUrl: './result-pie.component.html',
    encapsulation: ViewEncapsulation.None,
    providers: [DatePipe, DurationFormatPipe],
    styles: ``,
    standalone: false
})
export class ResultPieComponent implements OnInit {

  // options
  isWorkflowLoaded: boolean = false;

  series: any;
  series2: any;
  root;
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

  @ViewChild('chartdiv', {static: true}) chartdiv: ElementRef;
  @ViewChild('columnchartdiv', {static: true}) columnchartdiv: ElementRef;

  constructor(
    protected httpClient: HttpClient,
    private route: ActivatedRoute,
    private formBuilder: FormBuilder,
    private ruleService: RuleService,
    private conductorService: ConductorService,
    private translateService: TranslateService,
    private responsive: BreakpointObserver,
    private router: Router,
    private datepipe: DatePipe,
    private durationFormatPipe: DurationFormatPipe,
    private configurationService: ConfigurationService,
    private resultService: ResultService) {
  }

  @HostListener("window:resize", []) 
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
      this.ruleName = queryParams.ruleName || Rule.AMMINISTRAZIONE_TRASPARENTE;
      this.workflowId = queryParams.workflowId;
      this.resultService.listWorkflows().subscribe((workflows: Workflow[]) => {        
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
              ruleName: workflow.root_rule || Rule.AMMINISTRAZIONE_TRASPARENTE
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
          this.loadRules(this.workflowId || lastWorkflowId);
        });
        this.root = am5.Root.new(this.chartdiv.nativeElement);
        this.root.locale = am5locales_it_IT;
      });
    });
  }

  loadRules(workflowId: string) {
    this.ruleService.getRules().subscribe((resultRules: Map<String, Rule>) => {
      this.optionsRule = [];
      let rule = resultRules.get(this.workflowRuleName(workflowId));
      let rules: SelectRule[] = rule.getKeys(undefined, undefined, Rule.AMMINISTRAZIONE_TRASPARENTE, [], -1);
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
      let workflows: any[] = this.optionsWorkflow.filter((value: any) => {
        if (value.value == workflowId) {
          return value;
        }
      });
      if (workflows.length == 1) {
        return workflows[0].ruleName;  
      }
    }
    return Rule.AMMINISTRAZIONE_TRASPARENTE;
  }  
  
  loadResult() : void {
    this.isPieLoaded = false;
    let wokflowId = this.filterFormSearch.value.workflowId;
    let parentKey = this.rules.filter((rule: SelectRule) => {
      return rule.key === this.filterFormSearch.value.ruleName
    })[0].parentKey;
    let title = this.rules.filter((rule: SelectRule) => {
      return rule.key === this.filterFormSearch.value.ruleName
    })[0].text;
    
    this.resultService.getWorkflowMap(this.filterFormSearch.value.ruleName, [wokflowId]).subscribe((result: any) => {
      if (!result[wokflowId]) {
        this.router.navigate(['error/not-found']);
      }
      let chart = result[wokflowId];
      if (parentKey) {
        if (this.small) {
          this.chartDivStyle = `height:75vh !important`;
        }
        let titleParent = this.rules.filter((rule: SelectRule) => {
          return rule.key === parentKey
        })[0].text;
        this.resultService.getWorkflowMap(parentKey, [wokflowId]).subscribe((result: any) => {
          let total = Number(result[wokflowId][200]||0) + Number(result[wokflowId][202]||0); 
          chart[501] = total - Number(Object.values(chart).reduce((a: number, b: number) => a + b, 0)); 
          this.loadChart(result[wokflowId], true, chart, titleParent, title, parentKey);
        });
      } else {        
        this.loadChart(chart, false);
      }
    }); 
  }
  
  loadChart(result: any, double: boolean, result2?: any, titleParent?: string, title?: string, parentKey?: string) {
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
      
      if (double) {

        chart.children.push(am5.Label.new(this.root, {
          centerX: am5.percent(50),
          x: am5.percent(50),
          y: am5.percent(this.small? -30 : 0),
          fontWeight: 'bold',
          maxChars: 40,
          text: titleParent,
          populateText: true,
          fontSize: this.small? "1em": "1.5em"
        }));

        series.children.push(am5.Label.new(this.root, {
          centerX: am5.percent(50),
          y: am5.percent(this.small? -65 : -45),
          fontWeight: 'bold',
          text: "{valueSum}",
          populateText: true,
          fontSize: this.small? "1em": "1.5em"
        }));


        let chart2 = chartContainer.children.push(
          am5percent.PieChart.new(this.root, {
            radius: am5.percent(70),
            endAngle: 180
          })
        );
        let series2 = chart2.series.push(
          am5percent.PieSeries.new(this.root, {
            valueField: "value",
            categoryField: "name"
          })
        );
        series2.states.create("hidden", {
          endAngle: -90
        });
  
        series2.labels.template.setAll({
          fontSize: this.small ? 12 : 24,
          fontWeight: this.small ? 'normal': 'bold',
          text: "{valuePercentTotal.formatNumber('0.00')}%",
        });
        series2.ticks.template.setAll({
          strokeWidth: 2,
          fill: am5.color('#000000'),
          strokeOpacity: 1
        })
  
        series2.slices.template.setAll({
          templateField: "sliceSettings"
        });
  
        series2.slices.template.setAll({
          strokeWidth: 2,
          tooltipText:
            "{category}: {value.formatNumber(',000')}"
        });

        chart2.children.push(am5.Label.new(this.root, {
          centerX: am5.percent(50),
          x: am5.percent(50),
          y: am5.percent(this.small? -10 : 0),
          fontWeight: 'bold',
          maxChars: 40,
          text: title,
          populateText: true,
          fontSize: this.small? "1em": "1.5em"
        }));

        series2.children.push(am5.Label.new(this.root, {
          centerX: am5.percent(50),
          y: am5.percent(this.small? -50 : -45),
          fontWeight: 'bold',
          text: "{valueSum}",
          populateText: true,
          fontSize: this.small? "1em": "1.5em"
        }));


        let single = [];
        Object.keys(result2).forEach((key) => {
          single.push({
            name: this.translateService.instant(`it.rule.status.${key}.ruletitle`),
            value: result2[key],
            sliceSettings: {
              fill: am5.color(this.statusColor[`status_${key}`]),
              stroke: am5.color(this.statusColor[`status_${key}`])
            },
            extra: {
              key: key  
            }
          });
        });
        
        series2.slices.template.events.on("click", function(ev) {
          var status = ev.target.dataItem.dataContext.extra.key;
          if (status != 501) {
            this.router.navigate(['/search'],  { queryParams: {
              workflowId: this.filterFormSearch.value.workflowId,
              ruleName: this.filterFormSearch.value.ruleName,
              status: status 
            }});  
          } else {
            this.router.navigate(['/search'],  { queryParams: {
              workflowId: this.filterFormSearch.value.workflowId,
              ruleName: parentKey || this.filterFormSearch.value.ruleName,
              child: true 
            }});
          }
        }, this);
  
        series2.data.setAll(single);
        series2.appear(1000, 100);
        this.series2 = series2;
      }

      series.slices.template.events.on("click", function(ev) {
        var status = ev.target.dataItem.dataContext.extra.key;
        if (status != 501) {
          this.router.navigate(['/search'],  { queryParams: {
            workflowId: this.filterFormSearch.value.workflowId,
            ruleName: parentKey || this.filterFormSearch.value.ruleName,
            status: status 
          }});  
        } else {
          this.router.navigate(['/search'],  { queryParams: {
            workflowId: this.filterFormSearch.value.workflowId,
            ruleName: parentKey || this.filterFormSearch.value.ruleName,
            child: true 
          }});
        }
      }, this);

      let single = [];
      Object.keys(result).forEach((key) => {
        single.push({
          name: this.translateService.instant(`it.rule.status.${key}.ruletitle`),
          value: result[key],
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
      series.appear(1000, 100);
      this.series = series;
    }
  }
}
