import { DatePipe } from '@angular/common';
import { Input, ChangeDetectionStrategy, Component, OnInit, ViewEncapsulation, SimpleChanges, OnChanges, OnDestroy, HostListener } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, catchError, map, of, switchMap } from 'rxjs';
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

@Component({
  selector: 'company-rule',
  changeDetection: ChangeDetectionStrategy.Default,
  templateUrl: './company-rule.component.html',
  encapsulation: ViewEncapsulation.None,
  providers: [DatePipe],
  standalone: false
})
export class CompanyRuleComponent implements OnInit, OnChanges, OnDestroy {

  @Input() isAuthenticated: boolean = false;
  @Input() company!: Company;
  @Input() workflowId!: string;

  @Input() ruleName!: string;
  @Input() results!: Result[];
  @Input() rules!: Map<String, Rule>;

  protected data!: any[]|undefined;
  protected rulesOK!: number;

  @Input() chartDivStyle: string = 'width: 100% !important; height: 100% !important; aspect-ratio: 12/9;';

  protected chartOptions: EChartsOption = {};

  constructor(
    protected apiMessageService: ApiMessageService,
    private ruleService: RuleService,
    private resultService: ResultService,
    private configurationService: ConfigurationService,
    protected router: Router
  ) {}

  ngOnInit(): void {}

  ngOnDestroy(): void {}

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
      return this.resultService.getWorkflow(workflowId).pipe(
        map((result: Workflow) => result.root_rule),
        catchError(() => this.ruleFromConfiguration())
      );
    } else {
      return this.ruleFromConfiguration();
    }
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
    if (this.rules) {
      const rule = this.rules.get(ruleName);
      this.data = rule?.getCharts(undefined, ruleName, []);
      this.loadChart(this.data, this.rulesOK);
    } else {
      this.ruleService.getRules().subscribe((rules: Map<String, Rule>) => {
        const rule = rules.get(ruleName);
        this.data = rule?.getCharts(undefined, ruleName, []);
        this.loadChart(this.data, this.rulesOK);
      });
    }
  }

  loadChart(data: any[]|undefined, rulesOK: number) {
    const max = data?.length ?? 0;

    // Mirror the 6 bands from the original am5 component
    const bands = [
      { color: '#ee1f25', min: 0,                         max: max / 6.3 },
      { color: '#f04922', min: max / 6.3,                 max: max / (6.3 / 2) },
      { color: '#fdae19', min: max / (6.3 / 2),           max: max / (6.3 / 3) },
      { color: '#b0d136', min: max / (6.3 / 3),           max: max / (6.3 / 4) },
      { color: '#54b947', min: max / (6.3 / 4),           max: max / (6.3 / 5) },
      { color: '#0f9747', min: max / (6.3 / 5),           max: max }
    ];

    // ECharts gauge uses 0-100 scale internally; map our value accordingly
    const toPercent = (v: number) => max > 0 ? (v / max) * 100 : 0;

    const axisLineSegments = bands.map(b => [toPercent(b.max) / 100, b.color]);

    this.chartOptions = {
      toolbox: {
        feature: {
          saveAsImage: {
            title: 'Salva immagine',
            name: `indicatori`
          }
        }
      },
      series: [
        {
          type: 'gauge',
          startAngle: 200,   // mirrors am5 startAngle: 160 (ECharts uses clockwise from 3 o'clock)
          endAngle: -20,     // mirrors am5 endAngle: 380
          min: 0,
          max: 100,          // internal percentage scale
          splitNumber: 6,
          radius: '120%',
          center: ['50%', '65%'],
          axisLine: {
            lineStyle: {
              width: 40,
              color: axisLineSegments as any
            }
          },
          pointer: {
            length: '70%',
            width: 12,
            itemStyle: {
              color: 'auto'
            }
          },
          axisTick: {
            distance: 8,
            length: 8,
            lineStyle: {
              color: '#fff',
              width: 2
            }
          },
          splitLine: {
            distance: 8,
            length: 14,
            lineStyle: {
              color: '#fff',
              width: 3
            }
          },
          axisLabel: {
            color: '#000',
            fontSize: 18,
            distance: 50,
            formatter: (value: number) => {
              const real = Math.round((value / 100) * max);
              // Show only every other band boundary to avoid crowding
              return String(real);
            }
          },
          anchor: {
            show: true,
            showAbove: true,
            size: 25,
            itemStyle: {
              color: '#4e6fce',
              borderColor: '#fff',
              borderWidth: 3
            }
          },
          title: {
            show: false
          },
          detail: {
            valueAnimation: true,
            color: 'auto',
            fontSize: 38,
            fontWeight: 'bold',
            // Centered inside the gauge arc, above the anchor
            offsetCenter: [0, '-20%'],
            formatter: (value: number) => String(Math.round((value / 100) * max))
          },
          data: [
            {
              value: toPercent(rulesOK),
              name: ''
            }
          ],
          animationDuration: 1500,
          animationEasing: 'cubicInOut'
        }
      ]
    };
  }
}