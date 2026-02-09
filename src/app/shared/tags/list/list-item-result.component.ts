import {ChangeDetectionStrategy, Component, EventEmitter, Input, Output, ViewChild} from '@angular/core';
import {ActivatedRoute, Router} from '@angular/router';
import { Result } from '../../../core/result/result.model';
import { environment } from '../../../../environments/environment';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { HttpClient } from '@angular/common/http';

@Component({
    selector: 'app-list-item-result',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
    @if (item) {
      <div class="h-100 hover-shadow">
        <div class="card card-bg h-100">
          <div class="card-body">
            <ng-content></ng-content>
          </div>
          <div class="card-footer px-1">
            <div class="d-flex justify-content-evenly flex-wrap">
              <app-show-workflow-history [codiceIpa]="item.company.codiceIpa"></app-show-workflow-history>
              <button itButton="outline-primary" class="my-1" size="xs" translate routerLink="/company-graph" [queryParams]="{codiceIpa: item.company.codiceIpa, workflowId: item.workflowId}">
                <it-icon name="chart-line" color="primary"></it-icon>it.rule.title
              </button>
              @if (!codiceIpa) {
                <button itButton="outline-warning" size="xs" class="my-1" translate routerLink="/history" [queryParams]="{codiceIpa: item?.company?.codiceIpa, sort: 'createdAt,desc'}">
                  <it-icon name="chart-line" color="warning"></it-icon>it.company.history
                </button>
              }
              @if (!item?.storageData?.objectId && item.status != 407 && item.status != 500 && item.workflowChildId) {
                <app-show-html-page
                  [workflowChildId]="item.workflowChildId"
                  [denominazione]="item.company.denominazioneEnte"
                  [searchText]="item.term">
                </app-show-html-page>
              }
              @if (item?.storageData?.screenshotId) {
                <app-show-storage-result
                  [screenshot]="true"
                  [storageData]="item.storageData"
                  [denominazione]="item.company.denominazioneEnte"
                  [ruleName]="item.ruleName">
                </app-show-storage-result>
              }
              @if (item?.storageData?.objectId) {
                <app-show-storage-result
                  [html]="true"
                  [storageData]="item.storageData"
                  [denominazione]="item.company.denominazioneEnte">
                </app-show-storage-result>
              }
            </div>
          </div>
        </div>
      </div>
    }
    `,
    styles: [
        `
    .card::after { 
      margin-top: unset!important; 
    }
    `
    ],
    standalone: false
})
export class ListItemResultComponent {

  constructor(
    protected httpClient: HttpClient,
    private router: Router, 
    private route: ActivatedRoute,
    private _sanitizer: DomSanitizer
  ) {
  }

  @Input() item: Result = null;

  @Input() codiceIpa: string;

  @Output() onDelete = new EventEmitter();

  @Input() filterForm;

  @Input() page;

  @ViewChild('htmlModal') htmlModal: any;

  safeHtml: string = '';

  get imagesrc(): string {
    return `${environment.apiUrl}/${this.item?.storageData?.screenshotBucket}/${this.item?.storageData?.screenshotId}`;
  }

  downloadhtml() {
    if (this.item?.storageData?.objectBucket && this.item?.storageData?.objectId) {
      this.httpClient.get(`${environment.apiUrl}/${this.item.storageData.objectBucket}/${this.item.storageData.objectId}`, {
        responseType: 'text'
      }).subscribe((base64: string) => {
        let result = base64.replace("\'","").replace("b", "").replace("\'","");
        this.safeHtml = atob(result); 
        this.htmlModal.toggle();
      });
    }
  }
}
