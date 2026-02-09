import { ChangeDetectorRef, Component, OnInit, Input, ViewEncapsulation } from '@angular/core';
import { CommonListComponent } from '../../common/controller/common-list.component';
import { ActivatedRoute, Router } from '@angular/router';
import { FormGroup } from '@angular/forms';
import { NavigationService } from '../navigation.service';
import { TranslateService } from '@ngx-translate/core';
import { animate, keyframes, style, transition, trigger } from '@angular/animations';
import { Result } from './result.model';
import { ResultService } from './result.service';
import * as _ from "lodash";
import { ConfigurationService } from '../configuration/configuration.service';
import { Rule } from '../rule/rule.model';

@Component({
    selector: 'result-list',
    template: `
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
              <app-list-item-result [item]="item" [codiceIpa]="codiceIpa" [filterForm]="filterForm">
                <div [ngClass]="{'row': showGaugeBands}">
                  <div [ngClass]="{'col-md-6': showGaugeBands}" class="callout callout-highlight" [style.color]="getColor(item.status)" [style.border-color]="getColor(item.status)">
                    <div class="callout-title mb-1" [style.color]="getColor(item.status)">
                      <svg class="icon" [style.fill]="getColor(item.status)"><use href="/bootstrap-italia/dist/svg/sprites.svg#it-pa"></use></svg>{{item.company.denominazioneEnte}}
                    </div>
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
                      <app-show-url [fill]="getColor(item.status)" [label]="'it.company.sitoIstituzionale'" [value]="item.company.sitoIstituzionale"></app-show-url>
                    </div>
                  </div>
                  @if(showGaugeBands) {
                    <div class="col-md-6">
                      <company-rule
                        [isAuthenticated]="true" 
                        [company]="item.company"
                        [workflowId]="item.workflowId">
                      </company-rule>
                    </div>
                  }
                </div>
                <div class="col-sm-12">
                  @if (item.errorMessage) {
                    <app-show-text-popover
                      [label]="'it.rule.status-label'"
                      [value]="'it.rule.status.' + item.status + '.ruletitle'| translate"
                      [icon]="'error'"
                      [color]="'danger'"
                      [popover_title]="'it.result.errorMessage'|translate"
                      [popover_text]="item.errorMessage">
                    </app-show-text-popover>
                  }
                  @if (!item.errorMessage) {
                    <app-show-text [label]="statusLabel(item)" [value]="'it.rule.status.' + item.status + '.ruletitle'| translate"></app-show-text>
                  }
                </div>
                <div class="col-sm-12">
                  <app-show-text [label]="'it.result.updatedAt'" [value]="item.updatedAt| date: 'dd/MM/yyyy HH:mm:ss'"></app-show-text>
                </div>
                <div class="col-sm-12">
                  <app-show-text [label]="'it.rule.name'" [value]="item.ruleName"></app-show-text>
                </div>
                <div class="col-sm-12">
                  <app-show-text-popover [label]="'it.rule.term'" [value]="item.term" [popover_title]="'it.result.content'|translate" [popover_text]="item.content"></app-show-text-popover>
                </div>
                <div class="col-sm-12">
                  <app-show-url [label]="'it.result.destinationUrl'" [value]="item.destinationUrl"></app-show-url>
                </div>
              </app-list-item-result>
            </div>
          }
        </div>
      }
    </app-grid-layout>
    `,
    styles: [
        ` 
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
export class ResultListComponent extends CommonListComponent<Result> implements OnInit {

  public items: Result[];
  @Input() showTotalOnTop: boolean = true;
  @Input() showPageOnTop: boolean = false;
  @Input() showPage: boolean = false;
  @Input() infiniteScroll: boolean = true;
  @Input() showGaugeBands: boolean = false;

  protected statusColor: any;

  pageOffset = ResultService.PAGE_OFFSET;
  public constructor(public service: ResultService,
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

  public classForDisplayCard() {
    if (this.showGaugeBands) {
      return {
        'col-md-12': this.count <= 1,
        'col-lg-6': this.count > 1
      };
    } else {
      return {
        'col-md-12': this.count <= 1,
        'col-lg-4': this.count > 1
      };
    }   
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

  public filterFormValue() {
    if (this.filterForm) {
      if (this.filterForm?.controls?.child?.value) {
        let filter = _.cloneDeep(this.filterForm.value);
        filter.ruleName = `${filter.ruleName}/child`;
        return filter;
      }
      return this.filterForm.value;
    }
    return undefined;
  }
  
  public getColor(key) {
    if (this.statusColor) {
      return this.statusColor[`status_${key}`] + `!important`;      
    }
  }

  statusLabel(item: Result) {
    if (item.ruleName === Rule.AMMINISTRAZIONE_TRASPARENTE) return 'it.rule.status-AT';
    return 'it.rule.status-label';
  }
}
