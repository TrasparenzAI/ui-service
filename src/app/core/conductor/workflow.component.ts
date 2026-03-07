import { ChangeDetectorRef, Component, EventEmitter, Input, OnChanges, OnInit, Output, SimpleChanges, ViewChild, viewChild, ViewEncapsulation } from '@angular/core';
import { Workflow } from './workflow.model';
import { HttpParams } from '@angular/common/http';
import { animate, keyframes, style, transition, trigger } from '@angular/animations';
import { Rule } from '../rule/rule.model';
import { ResultService } from '../result/result.service';
import { AuthGuard } from '../../auth/auth-guard';
import { RoleEnum } from '../../auth/role.enum';
import { ConfigurationService } from '../configuration/configuration.service';
import { ConductorService } from './conductor.service';
import { ApiMessageService, MessageType } from '../api-message.service';
import { NotificationPosition } from 'design-angular-kit';
import { TranslateService } from '@ngx-translate/core';
import saveAs from 'file-saver';

@Component({
    selector: 'app-workflow-card',
    template: `
    @if(workflow) {
      <it-card space="true" background="true" fullHeight="true">
        @if (!title) {
          <div class="d-flex bg-dark text-white h3 mb-2 justify-content-center text-center">
            <span>{{'it.workflow.label' | translate: { startTime: workflow.startTime | date:'dd/MM/yyyy'} }}</span>
          </div>
        }
        <div class="category-top">
          <div class="d-flex justify-content-end flex-column flex-xl-row">
            @if (title) {
              <div class="d-flex ps-2 pt-2">
                <a class="category text-uppercase h6" [routerLink]="['/search']" [queryParams]="{workflowId: workflow.workflowId, ruleName: 'amministrazione-trasparente'}">{{'it.workflow.label' | translate: { startTime: workflow.startTime | date:'dd/MM/yyyy'} }}</a>
                @if (!workflow.isTotalCompleted()) {<div class="ps-2"><it-spinner small="true"></it-spinner></div>}
              </div>
            }
            @if (!workflow.isRunning) {
              <div class="ms-auto d-flex p-2">
                @if (workflow.isCompleted && isCSVVisible) {
                  <a href="" (click)="downloadCsv(workflow.workflowId)" class="align-top me-1">
                    @if (!isLoadingCsv) {
                      <it-icon name="file-csv" class="bg-light" color="success"></it-icon>
                    }
                    @if (isLoadingCsv) {
                      <it-spinner small="true" double="true"></it-spinner>
                    }
                  </a>
                }
                @if (isAdmin) {
                  <it-dropdown
                    [color]="workflow.badge"
                    [dark]="true">
                    <span
                      itPopover="Concluso il {{workflow.endTime | date:'dd/MM/yyyy HH:mm:ss'}} in {{workflow.executionTime | durationFormat}}"
                      popoverPlacement="top"
                      [popoverTrigger]="workflow.isCompleted ? 'hover' : 'manual'"
                      button
                    translate>{{'it.workflow.status.'+ workflow.status | translate}}</span>
                    <ng-container list>
                      @if (workflow.isFailed || workflow.isPaused || workflow.isTerminated) {
                        @if (!workflow.isPaused) {
                          <it-dropdown-item iconPosition="left" externalLink="true" (click)="retryWorkflow()" iconName="restore">
                            <span class="ms-1" translate>it.workflow.retry</span>
                          </it-dropdown-item>
                        }
                        @if (workflow.isPaused) {
                          <it-dropdown-item iconPosition="left" externalLink="true" (click)="resumeWorkflow()" iconName="refresh">
                            <span class="ms-1" translate>it.workflow.resume</span>
                          </it-dropdown-item>
                        }
                        @if (!workflow.isPaused) {
                          <it-dropdown-item iconPosition="left" externalLink="true" (click)="restartWorkflow();" iconName="exchange-circle">
                            <span class="ms-1" translate>it.workflow.restart</span>
                          </it-dropdown-item>
                        }
                      }
                      <it-dropdown-item iconPosition="left" externalLink="true" (click)="removeWorkflow();" iconName="delete">
                        <span class="ms-1" translate>it.workflow.remove</span>
                      </it-dropdown-item>
                    </ng-container>
                  </it-dropdown>
                } @else {
                  <span
                    itPopover="Concluso il {{workflow.endTime | date:'dd/MM/yyyy HH:mm:ss'}} in {{workflow.executionTime | durationFormat}}"
                    popoverPlacement="top"
                    [popoverTrigger]="workflow.isCompleted ? 'hover' : 'manual'"
                    [itBadge]="workflow.badge">
                    <div class="d-flex h6 align-middle my-1 px-2">
                      <div>{{'it.workflow.status.'+ workflow.status | translate}}</div>
                    </div>
                  </span>
                }
              </div>
            }
            @if (workflow.isRunning){
              <div class="ms-auto d-flex">
                <button
                  itPopover="Aggiorna i dati"
                  popoverPlacement="top"
                  popoverTrigger="hover"
                  itButton="outline-primary"
                  size="xs"
                  class="ms-auto align-top me-1"
                  (click)="refreshWorkflow()">
                  <it-icon name="refresh" color="primary" class="me-2"></it-icon>
                  <span class="visually-hidden">Aggiorna i dati</span>
                </button>
                @if (isAdmin) {
                  <it-dropdown
                    [color]="workflow.badge"
                    [dark]="true">
                    <span
                      button
                    translate>{{'it.workflow.status.'+ workflow.status | translate}}</span>
                    <ng-container list>
                      <it-dropdown-item iconPosition="left" externalLink="true" (click)="pauseWorkflow();" iconName="locked">
                        <span class="ms-1" translate>it.workflow.pause</span>
                      </it-dropdown-item>
                      <it-dropdown-item iconPosition="left" externalLink="true" (click)="terminateWorkflow();" iconName="delete">
                        <span class="ms-1" translate>it.workflow.terminate</span>
                      </it-dropdown-item>
                    </ng-container>
                  </it-dropdown>
                }
              </div>
            }
          </div>
        </div>
        <div class="it-card-body px-2">
          <it-list>
            @if (statusColor){
              <it-list-item [routerLink]="['/search']" [queryParams]="{workflowId: workflow.workflowId, ruleName: 'amministrazione-trasparente'}" href="." iconLeft="true">
                <span class="fst-italic card-text">{{'it.rule.status.all' | translate}}</span>
                <ng-container multiple>
                  <span @scale [itBadge]="'primary'" [rounded]="true" class="text-sm-left">{{ workflow.totalResult| number: undefined : 'it-IT' }}</span>
                </ng-container>
              </it-list-item>
              <it-list-item [routerLink]="['/search']" [queryParams]="{workflowId: workflow.workflowId, ruleName: 'amministrazione-trasparente', status: 200}" href="." iconLeft="true">
                <span class="fst-italic card-text">{{'it.rule.status.200.title' | translate}}</span>
                <ng-container multiple>
                  <span @scale [itBadge] [style.background]="getBGColor(200)" [rounded]="true" class="text-sm-left">{{ workflow.getResultFromStatus('200') | number: undefined : 'it-IT' }}</span>
                </ng-container>
              </it-list-item>
              <it-list-item [routerLink]="['/search']" [queryParams]="{workflowId: workflow.workflowId, ruleName: 'amministrazione-trasparente', status: 202}" href="." iconLeft="true">
                <span class="fst-italic card-text">{{'it.rule.status.202.title' | translate}}</span>
                <ng-container multiple>
                  <span @scale [itBadge] [style.background]="getBGColor(202)" [rounded]="true" class="text-sm-left">{{ workflow.getResultFromStatus('202') | number: undefined : 'it-IT' }}</span>
                </ng-container>
              </it-list-item>
              <it-list-item [routerLink]="['/search']" [queryParams]="{workflowId: workflow.workflowId, ruleName: 'amministrazione-trasparente', status: 400}" href="." iconLeft="true">
                <span class="fst-italic card-text">{{'it.rule.status.400.title' | translate}}</span>
                <ng-container multiple>
                  <span @scale [itBadge] [style.background]="getBGColor(400)" [rounded]="true" class="text-sm-left">{{ workflow.getResultFromStatus('400') | number: undefined : 'it-IT' }}</span>
                </ng-container>
              </it-list-item>
              <it-list-item [routerLink]="['/search']" [queryParams]="{workflowId: workflow.workflowId, ruleName: 'amministrazione-trasparente', status: 407}" href="." iconLeft="true">
                <span class="fst-italic card-text">{{'it.rule.status.407.title' | translate}}</span>
                <ng-container multiple>
                  <span @scale [itBadge] [style.background]="getBGColor(407)" [rounded]="true">{{ workflow.getResultFromStatus('407') | number: undefined : 'it-IT' }}</span>
                </ng-container>
              </it-list-item>
              <it-list-item [routerLink]="['/search']" [queryParams]="{workflowId: workflow.workflowId, ruleName: 'amministrazione-trasparente', status: 500}" href="." iconLeft="true">
                <span class="fst-italic card-text">{{'it.rule.status.500.title' | translate}}</span>
                <ng-container multiple>
                  <span @scale [itBadge] [style.background]="getBGColor(500)" [rounded]="true">{{ workflow.getResultFromStatus('500') | number: undefined : 'it-IT' }}</span>
                </ng-container>
              </it-list-item>
            }
          </it-list>
        </div>
        @if (!workflow.isRunning) {
          <a class="read-more ps-2" [routerLink]="['/company-map']" [queryParams]="{workflowId: workflow.workflowId, ruleName:'amministrazione-trasparente', zoom: 5, nolocation: true, filter: true}">
            <span class="text">Leggi di più <span class="visually-hidden">Leggi di più ....</span></span>
            <it-icon name="arrow-right"></it-icon>
          </a>
        }
      </it-card>
    }
    `,
    animations: [
        trigger('scale', [
            transition('void => *', animate('500ms ease-in-out', keyframes([
                style({ transform: 'scale(0.3)' }),
                style({ transform: 'scale(1)' })
            ])))
        ])
    ],
    encapsulation: ViewEncapsulation.None,
    styles: `
  `,
    standalone: false
})
export class WorkflowCardComponent implements OnInit{

  constructor(
    private resultService: ResultService,
    protected apiMessageService: ApiMessageService,
    private authGuard: AuthGuard,
    private changeDetectorRef: ChangeDetectorRef,
    private configurationService: ConfigurationService,
    private translateService: TranslateService,
    private conductorService: ConductorService
  ) {}
  isLoadingCsv: boolean = false;
  isCSVVisible: boolean = false;
  isAdmin: boolean = false;
  protected statusColor: any;

  @Input() workflow: Workflow;
  @Input() title: boolean = true;
  @Output() workflowRimosso = new EventEmitter<Workflow>();

  ngOnInit(): void {
    this.authGuard.getRoles().subscribe((roles: string[]) => {
      this.isCSVVisible = roles.filter(role => roles.indexOf(RoleEnum.ADMIN) != -1 || roles.indexOf(RoleEnum.SUPERUSER) != -1).length != 0;
      this.isAdmin = roles.filter(role => roles.indexOf(RoleEnum.ADMIN) != -1).length != 0;
    });
    this.configurationService.getStatusColor().subscribe((color: any) => {
      this.statusColor = color;
    });
  }

  private refreshWorkflow() {
    this.workflow.resultCount = undefined;
    this.detectWorkflow();
  }

  private detectWorkflow() {
    this.conductorService.getById(this.workflow.workflowId, { includeClosed: true, includeTasks: false }).subscribe((workflow: Workflow) => {
      this.workflow = workflow;
      this.workflowTotalElements(workflow);
    })
  }

  public removeWorkflow() {
    this.translateService.get('it.workflow.message.delete').subscribe((label) => {
      if(confirm(label)) {
        return this.conductorService.removeAllDataFromWorkflow(this.workflow.workflowId).subscribe((result: any) => {
          this.apiMessageService.sendMessage(
            MessageType.SUCCESS, 
            this.translateService.instant('it.workflow.message.new'), 
            NotificationPosition.Top
          );
          this.workflowRimosso.emit(this.workflow);
          this.changeDetectorRef.detectChanges();
        });  
      }  
    })
  }

  public pauseWorkflow() {
    this.translateService.get('it.workflow.message.pause').subscribe((label) => {
      if(confirm(label)) {
        return this.conductorService.pauseWorkflow(this.workflow.workflowId).subscribe((result: any) => {
          this.apiMessageService.sendMessage(
            MessageType.SUCCESS, 
            this.translateService.instant('it.workflow.message.new'), 
            NotificationPosition.Top
          );
          this.detectWorkflow();
          this.changeDetectorRef.detectChanges();
        });
      }
    })
  }

  public terminateWorkflow() {
    this.translateService.get('it.workflow.message.terminate').subscribe((label) => {
      if(confirm(label)) {
        return this.conductorService.terminateWorkflow(this.workflow.workflowId).subscribe((result: any) => {
          this.apiMessageService.sendMessage(
            MessageType.SUCCESS, 
            this.translateService.instant('it.workflow.message.new'), 
            NotificationPosition.Top
          );
          this.detectWorkflow();
          this.changeDetectorRef.detectChanges();
        });
      }
    })
  }

  public restartWorkflow() {
    this.translateService.get('it.workflow.message.restart').subscribe((label) => {
      if(confirm(label)) {
        return this.conductorService.restartWorkflow(this.workflow.workflowId).subscribe((result: any) => {
          this.apiMessageService.sendMessage(
            MessageType.SUCCESS, 
            this.translateService.instant('it.workflow.message.new'), 
            NotificationPosition.Top
          );
          this.detectWorkflow();
          this.changeDetectorRef.detectChanges();
        });
      }
    })
  }

  public retryWorkflow() {
    return this.conductorService.retryWorkflow(this.workflow.workflowId).subscribe((result: any) => {
      this.apiMessageService.sendMessage(
        MessageType.SUCCESS, 
        this.translateService.instant('it.workflow.message.new'), 
        NotificationPosition.Top
      );
      this.detectWorkflow();
      this.changeDetectorRef.detectChanges();
    });
  }

  public resumeWorkflow() {
    return this.conductorService.resumeWorkflow(this.workflow.workflowId).subscribe((result: any) => {
      this.apiMessageService.sendMessage(
        MessageType.SUCCESS, 
        this.translateService.instant('it.workflow.message.new'), 
        NotificationPosition.Top
      );
      this.detectWorkflow();
      this.changeDetectorRef.detectChanges();
    });
  }
  
  downloadCsv(workflowId: string) {
    this.isLoadingCsv = true;
    let httpParams = new HttpParams();
    httpParams = httpParams.append(`workflowId`, workflowId);
    httpParams = httpParams.append(`terse`, true);
    httpParams = httpParams.append(`sort`, `company.codiceIpa,id`);
    this.resultService.downloadCSV(httpParams).subscribe( (response: any) => {
      saveAs(response, `${Rule.AMMINISTRAZIONE_TRASPARENTE}.csv`);
      this.isLoadingCsv = false;
    });
    return false;
  }


  public workflowTotalElements(workflow: Workflow) {
    if (workflow) {
      workflow.resultCount = undefined;
      this.resultService.getWorkflowMap(Rule.AMMINISTRAZIONE_TRASPARENTE, [workflow.workflowId], true).subscribe((result: any) => {
          workflow.resultCount = result[workflow.workflowId]||{};
      });
    }
  }

  public getBGColor(key) {
    return this.statusColor[`status_${key}`] + `!important`; 
  }

}
