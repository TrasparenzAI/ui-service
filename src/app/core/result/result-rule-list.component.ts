import { ChangeDetectorRef, Component, OnInit, Input, ViewEncapsulation } from '@angular/core';
import { CommonListComponent } from '../../common/controller/common-list.component';
import { ActivatedRoute, Router } from '@angular/router';
import { FormBuilder, FormControl, FormGroup, Validators } from '@angular/forms';
import { NavigationService } from '../navigation.service';
import { TranslateService } from '@ngx-translate/core';
import { animate, keyframes, style, transition, trigger } from '@angular/animations';
import { Result } from './result.model';
import { ResultService } from './result.service';
import * as _ from "lodash";
import { ConfigurationService } from '../configuration/configuration.service';
import { map, Observable, of, switchMap } from 'rxjs';
import { ConductorService } from '../conductor/conductor.service';
import { Workflow } from '../conductor/workflow.model';
import { Rule } from '../rule/rule.model';
import { DatePipe } from '@angular/common';
import { RuleService } from '../rule/rule.service';
import { Status } from '../rule/status.enum';
import { CodiceCategoria } from '../../common/model/codice-categoria.enum';

@Component({
    selector: 'result-rule-list',
    providers: [DatePipe],
    template: `
    <app-layout-title [title]="'it.search.title'" [titleClass]="'main-title'" [collapsediv]="collapse" [isCollapsable]="'true'" (collapseEvent)="collapse = $event"></app-layout-title>
    <app-list-header-layout>
      @if (filterForm) {
        <form class="clearfix" [formGroup]="filterForm" [ngClass]="{'d-none': collapse, 'd-block': !collapse}">
          <div class="row col-md-12">
            @if(optionsWorkflow && optionsWorkflow.length != 0) {
              <div class="form-group col-md-3">
                <ng-select 
                  [items]="optionsWorkflow" 
                  [clearable]=false
                  bindLabel="text" 
                  bindValue="value"  
                  formControlName="workflowId"  
                  [placeholder]="'it.workflow.id'| translate">
                </ng-select>
              </div>
            }
            <div class="form-group col-md-3">
              <it-range [min]="1" [max]="maxNumberOfRules" [step]="1" formControlName="minNumberOfRules">
                {{'it.result.minNumberOfRules'| translate: {number: filterForm.controls.minNumberOfRules.value} }}
              </it-range>
            </div>
            <div class="form-check col-md-3 ps-3">
              <it-range [min]="1" [max]="maxNumberOfRules" [step]="1" formControlName="maxNumberOfRules">
                {{'it.result.maxNumberOfRules'| translate: {number: filterForm.controls.maxNumberOfRules.value} }}
              </it-range>
            </div>
            <div class="form-group col-md-3">
              <ng-select formControlName="codiceCategoria"  [placeholder]="'it.company.codiceCategoria'| translate">
                @for (categoria of optionsCategoria; track categoria.value) {
                  <ng-option [value]="categoria.value">{{categoria.text}}</ng-option>
                }
              </ng-select>
            </div>
          </div>
        </form>
      }
      <!-- List -->
      <app-grid-layout
        [loading]="loading"
        [items]="items"
        [noItem]="'message.no_item'"
        [showPage]="showPage"
        [infiniteScroll]="infiniteScroll"
        [page]="getPage()"
        [showPageOnTop]="showPageOnTop"
        [showTotalOnTop]="showTotalOnTop"
        [count]="count"
        (onChangePage)="onChangePage($event)"
        [page_offset]="pageOffset">
        @if (items) {
          <div class="row row-eq-height w-100"
            infiniteScroll
            [infiniteScrollThrottle]="300"
            [infiniteScrollDistance]="1"
            (scrolled)="onScroll()">
            @for (item of items; track item) {
              <div class="col-sm-12 px-md-2 pb-2" @scale [ngClass]="classForDisplayCard()">
              <app-list-item-company [item]="item.company" [filterForm]="filterForm">
                <div class="col-sm-12">
                  <app-show-text [label]="'it.company.codiceIpa'" [value]="item.company.codiceIpa"></app-show-text>
                  <app-show-text class="pull-right" [label]="'it.company.acronimo'" [value]="item.company.acronimo"></app-show-text>
                </div>
                <div class="col-sm-12">
                  <app-show-text [label]="'it.company.codiceFiscaleEnte'" [value]="item.company.codiceFiscaleEnte"></app-show-text>
                </div>
                <div class="col-sm-12">
                  <app-show-text [label]="'it.company.codiceCategoria'" [value]="item.company.codiceCategoria"></app-show-text>
                  <app-show-text class="pull-right" [label]="'it.company.codiceNatura'" [value]="item.company.codiceNatura"></app-show-text>
                </div>
                <div class="col-sm-12">
                  <app-show-text [label]="'it.company.tipologia'" [value]="item.company.tipologia"></app-show-text>
                </div>
                <div class="col-sm-12">
                  <app-show-url [label]="'it.company.sitoIstituzionale'" [value]="item.company.sitoIstituzionale"></app-show-url>
                </div>
              </app-list-item-company>
              </div>
            }
          </div>
        }
      </app-grid-layout>
    </app-list-header-layout>  
    `,
    styles: [        ` 
      .callout { max-width: unset!important; }
    `
    ],
    host: {
        '[class.callout.success.callout-title]': '0.9 * height',
    },
    encapsulation: ViewEncapsulation.None,
    animations: [
        trigger('scale', [
            transition('void => *', animate('500ms ease-in-out', keyframes([
                style({ transform: 'scale(0.3)' }),
                style({ transform: 'scale(1)' })
            ])))
        ])
    ],
    standalone: false
})
export class ResultRuleListComponent extends CommonListComponent<Result> implements OnInit {

  public items: Result[];
  @Input() showTotalOnTop: boolean = true;
  @Input() showPageOnTop: boolean = false;
  @Input() showPage: boolean = false;
  @Input() infiniteScroll: boolean = true;  
  protected statusColor: any;
  optionsWorkflow: Array<any> = [];
  maxNumberOfRules: number = 52;
  protected collapse: boolean = false;
  optionsCategoria: Array<any> = [{ value: '', text: '*', selected: true }];

  pageOffset = ResultService.PAGE_OFFSET;
  public constructor(public service: ResultService,
                     private formBuilder: FormBuilder,
                     private conductorService: ConductorService,
                     private datepipe: DatePipe,
                     private ruleService: RuleService,
                     protected route: ActivatedRoute,
                     protected router: Router,
                     protected changeDetector: ChangeDetectorRef,
                     protected configurationService: ConfigurationService,
                     protected navigationService: NavigationService,
                     protected translateService: TranslateService) {
    super(service, route, router, changeDetector, navigationService);
    this.configurationService.getStatusColor().subscribe((color: any) => {
      this.statusColor = color;
    });
  }
  
  public beforeOnInit(): Observable<any> {
    Object.keys(CodiceCategoria).forEach((key) => {
      this.optionsCategoria.push({ value: key, text: CodiceCategoria[key]});
    });    
    return this.route.queryParams.pipe(switchMap((queryParams) => {
      let workflowId = queryParams.workflowId;
      if (this.filterForm) {
        this.filterForm.controls['workflowId'].patchValue(workflowId);
      } else {
        this.filterForm = this.formBuilder.group({
          workflowId: new FormControl(workflowId),
          status: [[Status.OK, Status.ACCEPTED]],
          minNumberOfRules: new FormControl(queryParams.min || 1),
          maxNumberOfRules: new FormControl(queryParams.max || this.maxNumberOfRules),
          codiceCategoria: new FormControl(),
        });
      }
      return this.conductorService.getAll({
        includeClosed: true,
        includeTasks: false
      }).pipe(map((workflows: Workflow[]) => {
        workflows.forEach((workflow: Workflow) => {
          this.optionsWorkflow.push({
            value: workflow.workflowId,
            text: this.translateService.instant('it.workflow.text', {
              startTime: this.datepipe.transform(workflow.startTime, 'dd/MM/yyyy HH:mm:ss'),
              status: this.translateService.instant(`it.workflow.status.${workflow.status}`)
            }),
            ruleName: workflow.input.root_rule || Rule.AMMINISTRAZIONE_TRASPARENTE
          });
        });
        if (workflowId == undefined) {
          workflowId = workflows[0].workflowId;
          this.optionsWorkflow[0].selected = true;
          this.filterForm.controls['workflowId'].patchValue(workflowId);
        }
        let workflow = this.optionsWorkflow.filter((value: any) => {
          if (value.value == workflowId) {
            return value;
          }
        })[0];
        this.loadNumberOfRules(workflow?.ruleName || Rule.AMMINISTRAZIONE_TRASPARENTE);
      }));
    }));
  }

  loadNumberOfRules(rootRuleName: string) {
    this.ruleService.getRules().subscribe((resultRules: Map<String, Rule>) => {
      resultRules.forEach((index, name: string) => {
        if (rootRuleName == name) {
          this.maxNumberOfRules = resultRules.get(name)
            .getKeys(undefined, undefined, Rule.AMMINISTRAZIONE_TRASPARENTE, [], -1)
            .length;
        }
      });
    });
  }

  protected get codiceIpa() {
    return this.filterForm?.value?.codiceIpa;
  }

  public setItems(items: Result[]) {
    this.items = items;
  }

  public getItems(): Result[] {
    return this.items;
  }

  public buildFilterForm(): FormGroup {
    return this.filterForm;
  }

  protected get pageAppendURI(): string {
    return `/companiesByWorkflowAndStatus`;  
  }

  public classForDisplayCard() {    
    return {
      'col-md-12': this.count <= 1,
      'col-lg-4': this.count > 1
    };
  }

  onScroll() {
    if (this.infiniteScroll) {
      setTimeout(() => {
        this.loadMoreItems();
      }, 100);
    }
  }

  protected isScrollTopOnPageChange(): boolean {
    return true;
  }
  
  public getColor(key) {
    if (this.statusColor) {
      return this.statusColor[`status_${key}`] + `!important`;      
    }
  }
}
