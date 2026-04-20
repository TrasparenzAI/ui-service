import { ChangeDetectionStrategy, ChangeDetectorRef, Component, Input, ViewChild, ViewEncapsulation} from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ConductorService } from '../../../core/conductor/conductor.service';
import { Task, Workflow } from '../../../core/conductor/workflow.model';
import { Rule } from '../../../core/rule/rule.model';

@Component({
    selector: 'app-show-html-page',
    changeDetection: ChangeDetectionStrategy.Default,
    encapsulation: ViewEncapsulation.None,
    styles: `
    ul.nav-tabs {
      position: sticky !important;
      top: 0;
    }
  `,
    template: `
    @if (workflowChildId) {
      <a itButton="outline-success" size="xs" translate class="my-1" (click)="downloadhtml()">
        <it-icon name="files" color="success"></it-icon>it.result.html
      </a>
    }
    @if(workflowChildId) {
      <it-modal #htmlModal="itModal" size="lg" scrollable="true" footerShadow="true">
        <it-icon color="primary" name="info-circle" beforeTitle></it-icon>
        <ng-container modalTitle><span class="text-primary">{{ denominazione }}</span></ng-container>
        <it-tab-container [dark]="true">
          <it-tab-item label="HTML" [icon]="'file'" active="true">
            <div class="e2e-trusted-html" [innerHTML]="safeHtml | highlightedText:searchText"></div>
          </it-tab-item>  
          <it-tab-item label="Sorgente" [icon]="'file'">
            <div>
              {{safeHtml}}
            </div>
          </it-tab-item>  
        </it-tab-container>  
      </it-modal>
    }
  `,
    standalone: false
})
export class ShowHtmlPageComponent {

  constructor(
    protected httpClient: HttpClient,
    private conductorService: ConductorService,
    private changeDetectorRef: ChangeDetectorRef
  ) {
  }
  @Input() workflowChildId: string;
  @Input() denominazione: string;
  @Input() searchText: string = Rule.AMMINISTRAZIONE_TRASPARENTE_TERM;

  @ViewChild('htmlModal') htmlModal: any;
  safeHtml: string = '';
  
  downloadhtml() {
    if (this.workflowChildId) {
      this.conductorService.getById(this.workflowChildId, {'includeTasks': true}, false).subscribe((workflow: Workflow) => {
        workflow?.tasks?.filter(task => task.referenceTaskName == 'crawler_html_source_ref' || task.referenceTaskName == 'crawler_http_stream_ref').forEach((task: Task) => {
          let base64 = task.outputData?.response?.body?.htmlPage;
          if (base64) {
            let result = base64.replace("\'","").replace("b", "").replace("\'","");
            this.safeHtml = atob(result); 
            this.changeDetectorRef.detectChanges();
            this.htmlModal.toggle();  
          }
        });
      });
    }
  }
}
