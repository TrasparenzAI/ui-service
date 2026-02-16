import { ChangeDetectorRef, Component, OnInit, Input, ViewChild } from '@angular/core';
import { CommonListComponent } from '../../common/controller/common-list.component';
import { ActivatedRoute, Router } from '@angular/router';
import { FormGroup } from '@angular/forms';
import { NavigationService } from '../navigation.service';
import { TranslateService } from '@ngx-translate/core';
import { animate, keyframes, style, transition, trigger } from '@angular/animations';
import { Company } from './company.model';
import { CompanyService } from './company.service';
import { InfiniteScrollDirective } from 'ngx-infinite-scroll';
import { CompanyCardDisplaySettings, ConfigurationService } from '../configuration/configuration.service';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

@Component({
    selector: 'company-list',
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
              <app-list-item-company [item]="item" [filterForm]="filterForm" (onDelete)="onDelete(item.getId())">
                @if (companyCardDisplay?.codiceIpa || companyCardDisplay?.acronimo) {
                  <div class="col-sm-12">
                    @if (companyCardDisplay?.codiceIpa) {
                      <app-show-text [label]="'it.company.codiceIpa'" [value]="item.codiceIpa"></app-show-text>
                    }
                    @if (companyCardDisplay?.acronimo) {
                      <app-show-text class="pull-right" [label]="'it.company.acronimo'" [value]="item.acronimo"></app-show-text>
                    }
                  </div>
                }
                @if (companyCardDisplay?.codiceFiscaleEnte) {
                  <div class="col-sm-12">
                    <app-show-text [label]="'it.company.codiceFiscaleEnte'" [value]="item.codiceFiscaleEnte"></app-show-text>
                  </div>
                }
                @if (companyCardDisplay?.codiceCategoria || companyCardDisplay?.codiceNatura) {
                  <div class="col-sm-12">
                    @if (companyCardDisplay?.codiceCategoria) {
                      <app-show-text [label]="'it.company.codiceCategoria'" [value]="item.codiceCategoria"></app-show-text>
                    }
                    @if (companyCardDisplay?.codiceNatura) {
                      <app-show-text class="pull-right" [label]="'it.company.codiceNatura'" [value]="item.codiceNatura"></app-show-text>
                    }
                  </div>
                }
                @if (companyCardDisplay?.tipologia) {
                  <div class="col-sm-12">
                    <app-show-text [label]="'it.company.tipologia'" [value]="item.tipologia"></app-show-text>
                  </div>
                }
                @if (companyCardDisplay?.sitoIstituzionale) {
                  <div class="col-sm-12">
                    <app-show-url [label]="'it.company.sitoIstituzionale'" [value]="item.sitoIstituzionale"></app-show-url>
                  </div>
                }
                @if (companyCardDisplay?.indirizzo) {
                  <div class="col-sm-12">
                    <app-show-text [label]="'it.company.indirizzo'" [value]="item.fullIndirizzo"></app-show-text>
                  </div>
                }
                @if (companyCardDisplay?.regione) {
                  <div class="col-sm-12">
                    <app-show-text [label]="'it.company.regione'" [value]="item.denominazioneRegione"></app-show-text>
                  </div>
                }
                @if (companyCardDisplay?.responsabile) {
                  <div class="col-sm-12">
                    <app-show-text [label]="item.titoloResponsabile" [value]="item.responsabile"></app-show-text>
                  </div>
                }
                @if (companyCardDisplay?.mail1) {
                  <div class="col-sm-12">
                    <app-show-email [label]="item.tipoMail1" [value]="item.mail1"></app-show-email>
                  </div>
                }
                @if (companyCardDisplay?.mail2) {
                  <div class="col-sm-12">
                    <app-show-email [label]="item.tipoMail2" [value]="item.mail2"></app-show-email>
                  </div>
                }
                @if (companyCardDisplay?.mail3) {
                  <div class="col-sm-12">
                    <app-show-email [label]="item.tipoMail3" [value]="item.mail3"></app-show-email>
                  </div>
                }
                @if (companyCardDisplay?.mail4) {
                  <div class="col-sm-12">
                    <app-show-email [label]="item.tipoMail4" [value]="item.mail4"></app-show-email>
                  </div>
                }
                @if (companyCardDisplay?.mail5) {
                  <div class="col-sm-12">
                    <app-show-email [label]="item.tipoMail5" [value]="item.mail5"></app-show-email>
                  </div>
                }
              </app-list-item-company>
            </div>
          }
        </div>
      }
    </app-grid-layout>
    `,
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
export class CompanyListComponent extends CommonListComponent<Company> implements OnInit {

  public items: Company[];
  @Input() showTotalOnTop: boolean = true;
  @Input() showPageOnTop: boolean = false;
  @Input() showPage: boolean = false;
  @Input() infiniteScroll: boolean = true;

  @ViewChild(InfiniteScrollDirective) infiniteScrollDirective;

  pageOffset = CompanyService.PAGE_OFFSET;
  public companyCardDisplay: CompanyCardDisplaySettings;
  private excludedCodiciIpa = new Set<string>();
  public constructor(public service: CompanyService,
                     protected route: ActivatedRoute,
                     protected router: Router,
                     protected changeDetector: ChangeDetectorRef,
                     protected navigationService: NavigationService,
                     protected translateService: TranslateService,
                     protected configurationService: ConfigurationService) {
    super(service, route, router, changeDetector, navigationService);
    this.companyCardDisplay = this.configurationService.getDefaultCompanyCardDisplay();
  }

  public beforeOnInit(): Observable<any> {
    return this.configurationService.getCompanyCardDisplay().pipe(
      map((companyCardDisplay: CompanyCardDisplaySettings) => {
        this.companyCardDisplay = companyCardDisplay;
        this.excludedCodiciIpa = new Set((companyCardDisplay?.excludedCodiciIpa || []).map((codiceIpa: string) => (codiceIpa || '').trim().toUpperCase()));
        return companyCardDisplay;
      })
    );
  }
  
  public setItems(items: Company[]) {
    this.items = (items || []).filter((item: Company) => {
      const codiceIpa = (item?.codiceIpa || '').trim().toUpperCase();
      return !codiceIpa || !this.excludedCodiciIpa.has(codiceIpa);
    });
  }

  public getItems(): Company[] {
    return this.items;
  }

  public buildFilterForm(): FormGroup {
    return this.filterForm;
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

}
