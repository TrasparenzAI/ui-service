import { ChangeDetectionStrategy, ChangeDetectorRef, Component, Input, OnInit, ViewChild} from '@angular/core';
import { Observable, interval } from 'rxjs';
import { map, takeWhile } from 'rxjs/operators';
import { ConductorService } from '../../../core/conductor/conductor.service';
import { ConfigurationService } from '../../../core/configuration/configuration.service';
import { Configuration } from '../../../core/configuration/configuration.model';
import { Rule } from '../../../core/rule/rule.model';
import { RuleService } from '../../../core/rule/rule.service';
import { ApiMessageService, MessageType } from '../../../core/api-message.service';
import { TranslateService } from '@ngx-translate/core';
import { ItModalComponent, SelectControlOption } from 'design-angular-kit';
import { Status, Workflow } from '../../../core/conductor/workflow.model';
import { HttpParams } from '@angular/common/http';
import { ResultService } from '../../../core/result/result.service';
import { AuthGuard } from '../../../auth/auth-guard';
import { RoleEnum } from '../../../auth/role.enum';

import saveAs from 'file-saver';


@Component({
  selector: 'app-show-workflow-history',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template:
  `
    <a itButton="outline-primary" size="xs" translate class="mt-1" (click)="workflowModal.toggle()">
      <it-icon name="presentation" color="primary"></it-icon>it.workflow.list
    </a>
    <it-modal #workflowModal="itModal" alignment="left" scrollable="true" footerShadow="true" (showEvent)="openWorkflowList()">
      <it-icon color="primary" name="presentation" beforeTitle></it-icon>
      <ng-container modalTitle>
        <div innerHtml="{{ 'it.workflow.modal-list' | translate: {codiceIpa: codiceIpa} }}"></div>
      </ng-container>
      <it-list>
        @for (workflow of workflows; track workflow) {
          <it-list-item>
            <div class="d-flex justify-content-start w-100">
              <div class="d-flex">
                <span class="text-monospace">
                  @if (!workflow.isRunning) {
                    {{'it.workflow.full_label' | translate: { startTime: workflow.startTime | date:'dd/MM/yyyy', endTime: workflow.endTime | date:'dd/MM/yyyy HH:mm:ss', executionTime: workflow.executionTime | durationFormat} }}                  
                  }
                  @if (workflow.isRunning){
                    {{'it.workflow.label' | translate: { startTime: workflow.startTime | date:'dd/MM/yyyy'} }}                                    
                  }
                </span>
              </div>
              <div class="w-100 ms-auto">
                @if (!workflow.isRunning) {
                  <a 
                      (click)="workflowModal.toggle()" 
                      [routerLink]="['/company-graph']" 
                      [queryParams]="{codiceIpa: codiceIpa, workflowId: workflow.workflowId, ruleName: 'amministrazione-trasparente'}"
                      [itBadge]="workflow.badge" 
                      class="h6 align-top pull-right">
                      <div class="d-flex">
                      <div>{{'it.workflow.status.'+ workflow.status | translate}}</div>
                      </div>
                  </a>
                  @if (workflow.isCompleted && isCSVVisible) {
                    <a href="" (click)="downloadCsv(workflow, codiceIpa)" class="align-top me-1 pull-right">
                      <it-icon *ngIf="!workflow.isLoadingCsv" name="file-csv" class="bg-light" color="success"></it-icon>
                      <it-spinner *ngIf="workflow.isLoadingCsv" small="true" double="true"></it-spinner>
                    </a>
                  }
                } 
                @if (workflow.isRunning){
                  <a 
                      (click)="refresh(workflow)"
                      itButton="primary"
                      size="sm" 
                      class="h6 align-top pull-right p-2">
                      <div class="d-flex">
                      <div>{{'it.workflow.status.'+ workflow.status | translate}}</div>
                      </div>
                  </a>
                  @if (isRefreshing) {
                    <a href="" class="align-top me-1 pull-right">
                      <it-spinner small="true" double="true"></it-spinner>
                    </a>
                  }
                }
              </div>
            </div> 
          </it-list-item>
        }
      </it-list>
      @if (isAbleToStartWorkflow) {
        <ng-container footer>
          <it-dropdown
            [color]="'primary'"
            [dark]="false">
            <span button translate>it.workflow.new</span>
            <span listHeading translate>it.rule.name</span>

            <ng-container list>
              <it-dropdown-item divider="true"></it-dropdown-item>

              <it-dropdown-item
                *ngFor="let item of optionsRule"
                (click)="startMainWorkflow(item.value)"
                externalLink="true"
                [large]="true">
                {{ item.text }}
              </it-dropdown-item>
            </ng-container>
          </it-dropdown>
        </ng-container>
      }
    </it-modal>

    `
})
export class ShowWorkflowHistoryComponent implements OnInit{

  constructor(
    protected apiMessageService: ApiMessageService, 
    protected translateService: TranslateService,                    
    private conductorService: ConductorService,
    private configurationService: ConfigurationService,
    private ruleService: RuleService,
    private resultService: ResultService,
    private changeDetectorRef: ChangeDetectorRef,
    private authGuard: AuthGuard
  ) {
  }
  @Input() codiceIpa: string;

  @ViewChild(`workflowModal`) workflowModal: ItModalComponent;
  workflows: Workflow[];
  isRefreshing: boolean = false;
  isAbleToStartWorkflow: boolean = false;
  isCSVVisible: boolean = false;
  protected optionsRule: Array<SelectControlOption> = [];

  ngOnInit(): void {
    this.authGuard.hasRole([RoleEnum.ADMIN, RoleEnum.SUPERUSER]).subscribe((hasRole: boolean) => {
      this.isAbleToStartWorkflow = hasRole;
      this.isCSVVisible = hasRole;
    });
  }

  openWorkflowList() {
    this.configurationService.getAll().subscribe((configurations: Configuration[]) => {
      configurations.forEach((conf: Configuration) => {
          if (conf.key === ConfigurationService.JSONRULES_KEY) {
            let resultRules = new Map();
            let value = JSON.parse(conf.value);
            Object.keys(value).forEach((key: string) => {
              resultRules.set(key, this.ruleService.buildInstance(value[key]));
            });
            this.optionsRule = [];
            resultRules.forEach((value: Rule, key: String) => {
              let text = value.term.filter(key => key.code == 200)[0].key;
              this.optionsRule.push({
                value: key,
                text: `${key} - ${text}`
              });
            });
          }      
      });
    });
    this.conductorService.getAll({
      includeClosed: true,
      includeTasks: false
    }).subscribe((workflows: Workflow[]) => {
      this.conductorService.getAll({
        includeClosed: true,
        includeTasks: false
      },`/${ConductorService.AMMINISTRAZIONE_TRASPARENTE_FLOW}/correlated/${this.codiceIpa}`).subscribe((ipaWorkflows: Workflow[]) => {
        this.workflows = ipaWorkflows.concat(workflows).sort((a,b) => (a.startTime < b.startTime)? 1 : -1);
        this.changeDetectorRef.detectChanges();
      });
    });
  }

  startMainWorkflow(ruleName?: string) {
    this.conductorService.startMainWorkflow(this.codiceIpa, ruleName).subscribe((workflowId: string) => {
      this.apiMessageService.sendMessage(MessageType.SUCCESS, `it.workflow.message.new`);
      this.conductorService.getById(workflowId).subscribe((result: Workflow) => {
        this.workflows.unshift(result);
        this.changeDetectorRef.detectChanges();
        let status = Status.RUNNING
        interval(5000)
          .pipe(takeWhile(() => status == Status.RUNNING))
          .subscribe(() => {
            this.isRefreshing = true;
            this.changeDetectorRef.detectChanges();
            this.refreshFn(result).subscribe((w: Workflow) => {
              status = w.status;
              this.isRefreshing = false;
              this.changeDetectorRef.detectChanges();
            });
          });
      });
    });
  }

  downloadCsv(workflow: Workflow, codiceIpa: string) {
    workflow.isLoadingCsv = true;
    let httpParams = new HttpParams();
    httpParams = httpParams.append(`workflowId`, workflow.workflowId);
    httpParams = httpParams.append(`codiceIpa`, codiceIpa);
    httpParams = httpParams.append(`terse`, true);
    httpParams = httpParams.append(`sort`, `company.codiceIpa,id`);
    this.resultService.downloadCSV(httpParams).subscribe( (response: any) => {
      saveAs(response, `${codiceIpa}.csv`);
      workflow.isLoadingCsv = false;
      this.changeDetectorRef.detectChanges();
    });
    return false;
  }

  public refresh(workflow: Workflow): void {
    this.refreshFn(workflow).subscribe((result: Workflow) => {
      console.log(`STATO: ${workflow.status}`);
    });
  }

  public refreshFn(workflow: Workflow): Observable<Workflow> {
    this.isRefreshing = true;
    return this.conductorService.getById(workflow.workflowId).pipe(map((result: Workflow) => {
        if (workflow.status != result.status) {
          this.workflows.shift();
          this.workflows.unshift(result);  
        }
        this.isRefreshing = false;
        this.changeDetectorRef.detectChanges();
        return result;
    }));
  }
 
}
