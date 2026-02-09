import { DatePipe } from '@angular/common';
import { Input, ChangeDetectionStrategy, Component, ElementRef, OnInit, ViewChild, ViewEncapsulation, SimpleChanges, OnChanges, HostListener, ChangeDetectorRef } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, catchError, map, of, switchMap } from 'rxjs';
import { ApiMessageService, MessageType } from '../api-message.service';
import { ConductorService } from '../conductor/conductor.service';
import { Workflow } from '../conductor/workflow.model';
import { Configuration } from '../configuration/configuration.model';
import { ConfigurationService } from '../configuration/configuration.service';
import { Result } from '../result/result.model';
import { ResultService } from '../result/result.service';
import { Rule } from '../rule/rule.model';
import { RuleService } from '../rule/rule.service';
import { Company } from './company.model';

import * as am5 from '@amcharts/amcharts5';
import * as am5radar from "@amcharts/amcharts5/radar";
import am5themes_Animated from "@amcharts/amcharts5/themes/Animated";
import * as am5xy from "@amcharts/amcharts5/xy";
import * as _ from "lodash";

@Component({
    selector: 'company-rule',
    changeDetection: ChangeDetectionStrategy.Default,
    templateUrl: './company-rule.component.html',
    encapsulation: ViewEncapsulation.None,
    providers: [DatePipe],
    standalone: false
})
export class CompanyRuleComponent implements OnInit, OnChanges {

  @Input() isAuthenticated: boolean = false;
  @Input() company: Company;
  @Input() workflowId: string;

  @Input() ruleName: string;
  @Input() results: Result[];
  @Input() rules: Map<String, Rule>;

  protected data: any[];
  protected rulesOK: number;

  @Input() chartDivStyle: string = 'width: 100% !important;height:100% !important; aspect-ratio: 12/9;';
  @ViewChild('chartdiv', {static: true}) chartdiv: ElementRef;
  protected root;
  protected chartGauge;

  constructor(protected apiMessageService: ApiMessageService,
              private ruleService: RuleService,
              private resultService: ResultService,
              private configurationService: ConfigurationService,
              private conductorService: ConductorService,
              private cdr: ChangeDetectorRef,
              protected router: Router) {}

  ngOnInit(): void {

  }

  ngAfterViewInit() {
    setTimeout(() => {
      this.adjustAspectRatio();
    }, 500);
  }

  @HostListener('window:resize')
  onResize() {
    this.adjustAspectRatio();
  }

  adjustAspectRatio() {
    const container = this.chartdiv.nativeElement.parentElement;
    if (container && container.clientWidth > 0 && container.clientHeight > 0) {
      const width = container.clientWidth;
      const height = container.clientHeight;
      const ratio = (width / height).toFixed(2);
      this.chartDivStyle = `width: ${width}px !important;height:${height}px !important; aspect-ratio: ${ratio};`;
      this.cdr.detectChanges();
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
    if (this.isAuthenticated) {
      return this.conductorService.getById(workflowId, {'includeTasks': false}, false, false).pipe(
        map((result: Workflow) => {
          return result.input.root_rule;
        }),
        catchError((error) => {
          return this.ruleFromConfiguration();
        })
      );      
    } else {
      return this.ruleFromConfiguration();
    }
  }

  ruleFromConfiguration(): Observable<string> {
    return this.configurationService.getAll().pipe(switchMap((configurations: Configuration[]) => {
      return configurations.filter((configuration: Configuration) => {
        return configuration.key === ConfigurationService.WORKFLOW_CRON_BODY;
      }).map((configuration: Configuration) => {
        let jsonvalue = JSON.parse(configuration.value);
        return String(jsonvalue.input.root_rule);
      });
    }));
  }

  manageChart(workflowId: string) {
    this.workflowRuleName(workflowId).subscribe((ruleName: string) => {
      this.resultService.getAll({
        workflowId: workflowId,
        codiceIpa: this.company.codiceIpa,
        size: 500,
        noCache: true
      }, this.isAuthenticated ? "/codiceipa/byWorkflow" : "/codiceipa").subscribe((results: Result[]) => {
        this.manageResults(ruleName, results);
      });
    });  
  }

  manageResults(ruleName: string, results: Result[]) {
    if (results.length === 0) {
      this.apiMessageService.sendMessage(MessageType.WARNING, `Risultati non presenti per la PA: ${this.company.denominazioneEnte}!`);
    }
    this.rulesOK = results.filter(result => result.status == 200 || result.status == 202).length;
    if (this.rules) {
      let rule = this.rules.get(ruleName);
      this.data = rule.getCharts(undefined, ruleName, []);
      this.loadChart(this.data, this.rulesOK);
    } else {
      this.ruleService.getRules().subscribe((rules: Map<String, Rule>) => {
        let rule = rules.get(ruleName);
        this.data = rule.getCharts(undefined, ruleName, []);
        this.loadChart(this.data, this.rulesOK);
      });
    }
  }

  loadChart(data, rulesOK) {
    if(this.chartdiv?.nativeElement && !this.root) {
      this.root = am5.Root.new(this.chartdiv?.nativeElement);
    }
    this.root.setThemes([
      am5themes_Animated.new(this.root)
    ]);
    this.root.container.children.clear();
    this.root.container.set("layout", this.root.verticalLayout);
    
    this.chartGauge = this.root.container.children.push(am5radar.RadarChart.new(this.root, {
      startAngle: 160,
      endAngle: 380,
      radius: am5.percent(100), // usa percentuale invece di pixel
      innerRadius: am5.percent(70)
    }));
    let axisRenderer = am5radar.AxisRendererCircular.new(this.root, {
      innerRadius: -40,
      minGridDistance: 50
    });    
    axisRenderer.grid.template.setAll({
      stroke: this.root.interfaceColors.get("background"),
      visible: true,
      strokeOpacity: 0.8
    });
    axisRenderer.ticks.template.setAll({
      visible: true,
      strokeOpacity: 1,
    });

    axisRenderer.labels.template.setAll({
      fontSize: 15,
      visible: true
    });

    let xAxis = this.chartGauge.xAxes.push(am5xy.ValueAxis.new(this.root, {
      maxDeviation: 0,
      min: 0,
      max: data?.length,
      strictMinMax: true,
      renderer: axisRenderer
    }));    
    // Add clock hand
    // https://www.amcharts.com/docs/v5/charts/radar-chart/gauge-charts/#Clock_hands
    let axisDataItem = xAxis.makeDataItem({});

    let clockHand = am5radar.ClockHand.new(this.root, {
      pinRadius: am5.percent(20),
      radius: am5.percent(100),
      bottomWidth: 40
    })

    let bullet = axisDataItem.set("bullet", am5xy.AxisBullet.new(this.root, {
      sprite: clockHand
    }));

    xAxis.createAxisRange(axisDataItem);

    let label = this.chartGauge.radarContainer.children.push(am5.Label.new(this.root, {
      fill: am5.color(0xffffff),
      centerX: am5.percent(50),
      textAlign: "center",
      centerY: am5.percent(50),
      fontSize: "1.5em"
    }));
    
    axisDataItem.set("value", 0);
    bullet.get("sprite").on("rotation", function () {
      let value = axisDataItem.get("value");
      let text = Math.round(axisDataItem.get("value")).toString();
      let fill = am5.color(0x000000);
      xAxis.axisRanges.each(function (axisRange) {
        if (value >= axisRange.get("value") && value <= axisRange.get("endValue")) {
          fill = axisRange.get("axisFill").get("fill");
        }
      })

      label.set("text", Math.round(value).toString());

      clockHand.pin.animate({ key: "fill", to: fill, duration: 500, easing: am5.ease.out(am5.ease.cubic) })
      clockHand.hand.animate({ key: "fill", to: fill, duration: 500, easing: am5.ease.out(am5.ease.cubic) })
    });
    this.chartGauge.bulletsContainer.set("mask", undefined);
    // Create axis ranges bands
    // https://www.amcharts.com/docs/v5/charts/radar-chart/gauge-charts/#Bands
    let bandsData = [{
      color: "#ee1f25",
      lowScore: 0,
      highScore: data?.length / 6.3
    }, {
      color: "#f04922",
      lowScore: data?.length / 6.3,
      highScore: data?.length / (6.3 / 2)
    }, {
      color: "#fdae19",
      lowScore: data?.length / (6.3 / 2),
      highScore: data?.length / (6.3 / 3)
    }, {
      color: "#b0d136",
      lowScore: data?.length / (6.3 / 3),
      highScore: data?.length / (6.3 / 4)
    }, {
      color: "#54b947",
      lowScore: data?.length / (6.3 / 4),
      highScore: data?.length / (6.3 / 5)
    }, {
      color: "#0f9747",
      lowScore: data?.length / (6.3 / 5),
      highScore: data?.length
    }];

    am5.array.each(bandsData, function (data) {
      let axisRange = xAxis.createAxisRange(xAxis.makeDataItem({}));

      axisRange.setAll({
        value: data.lowScore,
        endValue: data.highScore
      });

      axisRange.get("axisFill").setAll({
        visible: true,
        fill: am5.color(data.color),
        fillOpacity: 0.8
      });

    });
    axisDataItem.animate({
        key: "value",
        to: rulesOK,
        duration: 1500,
        easing: am5.ease.inOut(am5.ease.cubic)
    });

    // Make stuff animate on load
    this.chartGauge.appear(1000, 100);
  }

}
