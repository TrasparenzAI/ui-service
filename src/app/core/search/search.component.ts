import { Component, OnInit, ChangeDetectionStrategy, ViewEncapsulation, ChangeDetectorRef, AfterViewInit } from '@angular/core';
import { FormBuilder, FormGroup, FormControl } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { ConductorService } from '../conductor/conductor.service';
import { Workflow } from '../conductor/workflow.model';
import { DatePipe } from '@angular/common';
import { Status } from '../rule/status.enum';
import { RuleService } from '../rule/rule.service';
import { Rule, SelectRule } from '../rule/rule.model';
import { HttpParams } from '@angular/common/http';
import { ResultService } from '../result/result.service';
import { CodiceCategoria } from '../../common/model/codice-categoria.enum';
import { AuthGuard } from '../../auth/auth-guard';
import { RoleEnum } from '../../auth/role.enum';
import saveAs from 'file-saver';

@Component({
    selector: 'app-search',
    changeDetection: ChangeDetectionStrategy.Default,
    templateUrl: './search.component.html',
    providers: [DatePipe],
    standalone: false
})
export class SearchComponent implements OnInit {
  
  protected filterFormSearch: FormGroup;
  protected collapse: boolean = false;
  protected isLoadingCsv: boolean = false;
  protected ruleName: string;
  options: Array<any> = [];
  optionsWorkflow: Array<any> = [];
  optionsStatus: Array<any> = [];
  optionsRule: Array<any>;
  optionsCategoria: Array<any> = [];
  isCSVVisible: boolean = false;

  constructor(private formBuilder: FormBuilder,
              private route: ActivatedRoute,
              private conductorService: ConductorService,
              private ruleService: RuleService,
              private resultService: ResultService,
              private translateService: TranslateService,
              private changeDetectorRef: ChangeDetectorRef,
              private authGuard: AuthGuard,
              private datepipe: DatePipe,
              protected router: Router) {
  }

  isStatusDisabled(status: number, ruleName: string): boolean {
    if (ruleName === Rule.AMMINISTRAZIONE_TRASPARENTE) {
      return status == 404;
    } 
    return false;
  }

  manageOptionStatus(ruleName: string) {
    this.optionsStatus.forEach((option: any) => {
      option.disabled = this.isStatusDisabled(option.value, ruleName);
    });    
    this.changeDetectorRef.detectChanges();
  }

  ngOnInit(): void {
    this.translateService.get('it').subscribe((labels: any) => {
      this.options.push({ value: 'company.codiceIpa', text: labels?.company?.codiceIpa });
      this.options.push({ value: 'company.denominazioneEnte', text: labels?.company?.denominazioneEnte });
      this.options.push({ value: 'createdAt,desc', text: labels?.order?.createdAt?.desc });
      this.optionsStatus.push({value: '', text: '*', disabled: false});
      this.optionsCategoria.push({ value: '', text: '*', selected: true});
    });
    Object.keys(CodiceCategoria).forEach((key) => {
      this.optionsCategoria.push({ value: key, text: CodiceCategoria[key]});
    });
    this.authGuard.hasRole([RoleEnum.ADMIN, RoleEnum.SUPERUSER]).subscribe((hasRole: boolean) => {
      this.isCSVVisible = hasRole;
    });
    this.route.queryParams.subscribe((queryParams) => {
      this.ruleName = queryParams.ruleName == '' ? '': queryParams.ruleName||Rule.AMMINISTRAZIONE_TRASPARENTE;
      let workflowId = queryParams.workflowId;

      Object.values(Status).filter(key => !isNaN(Number(key))).forEach((key: number) => {
        let status = String(key);
        this.translateService.get(`it.rule.status.${status}`).subscribe((label: any) => {
          this.optionsStatus.push({
            value: status,
            text: label.ruletitle,
            disabled: this.isStatusDisabled(key, this.ruleName)
          });
        });
      });      
      this.resultService.listWorkflows().subscribe((workflows: Workflow[]) => {
        this.optionsWorkflow.push({value: '', text: '*', selected: false});
        workflows.forEach((workflow: Workflow) => {
          this.optionsWorkflow.push({
            value: workflow.workflowId,
            text: this.translateService.instant('it.workflow.text', {
              startTime: this.datepipe.transform(workflow.startTime, 'dd/MM/yyyy HH:mm:ss'),
              status: this.translateService.instant(`it.workflow.status.${workflow.status}`)
            }),
            ruleName: workflow.root_rule || Rule.AMMINISTRAZIONE_TRASPARENTE,
            selected: workflow.workflowId === queryParams['workflowId']
          });
        });
        if (this.filterFormSearch) {
          this.filterFormSearch.controls['workflowId'].patchValue(workflowId);
          this.filterFormSearch.controls['ruleName'].patchValue(this.ruleName);
          this.filterFormSearch.controls['child'].patchValue(queryParams.child);
          this.filterFormSearch.controls['codiceIpa'].patchValue(queryParams.codiceIpa);
          this.filterFormSearch.controls['status'].patchValue(queryParams.status||'');
          this.filterFormSearch.controls['sort'].patchValue(queryParams.sort);
        } else {
          this.filterFormSearch = this.formBuilder.group({
            workflowId: new FormControl(workflowId),
            child: new FormControl(queryParams.child),
            status: new FormControl(queryParams.status||''),
            denominazioneEnte: new FormControl(),
            codiceFiscaleEnte: new FormControl(),
            codiceIpa: new FormControl(queryParams.codiceIpa),
            codiceCategoria: new FormControl(),
            sort: new FormControl(queryParams.sort),
          });
        }
        if (workflowId == undefined) {
          workflowId = workflows[0].workflowId;
          this.optionsWorkflow[0].selected = true;
          this.filterFormSearch.controls['workflowId'].patchValue(workflowId);
        }
        this.loadRules(workflowId);
        this.filterFormSearch.valueChanges.subscribe((value: any) => {
          if (this.filterFormSearch.controls.ruleName.touched) {
            this.manageOptionStatus(value.ruleName);
          }
          this.loadRules(value.workflowId);
        });
      });
    });
  }

  loadRules(workflowId: string) {
    this.ruleService.getRules().subscribe((resultRules: Map<String, Rule>) => {
      this.optionsRule = [];
      if (workflowId) {
        let name = this.workflowRuleName(workflowId);
        this.loadFromRule(name, resultRules.get(name));
      } else {
        resultRules.forEach((index, name: string) => {
          this.loadFromRule(name, resultRules.get(name));
        });
      }
    });
  }

  loadFromRule(name: string, rule: any) {
    let rules: SelectRule[] = rule.getKeys(undefined, undefined, Rule.AMMINISTRAZIONE_TRASPARENTE, [], -1);
    this.optionsRule.push({
      value: '',
      text: '*',
      level: 0,
      name: name
    });
    Object.keys(rules).forEach((index) => {
      this.optionsRule.push({
        value: rules[index].key,
        text: rules[index].text,
        level: rules[index].level,
        name: name,
        class: `ps-${rules[index].level} fs-${rules[index].level + 3}`
      });
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

  downloadCsv() {
    this.isLoadingCsv = true;
    let httpParams = new HttpParams();
    const formValue = this.filterFormSearch.value;
    const fileName = this.filterFormSearch.value['ruleName'] || Rule.AMMINISTRAZIONE_TRASPARENTE;
    for (const key in formValue) {
      if (formValue[key] && formValue[key] !== null) {
        httpParams = httpParams.append(key, formValue[key]);
      }
    }
    httpParams = httpParams.append(`terse`, true);
    httpParams = httpParams.append(`sort`, this.filterFormSearch.value['sort']||`company.codiceIpa,id`);
    this.resultService.downloadCSV(httpParams).subscribe( (response: any) => {
      saveAs(response, `${fileName}.csv`);
      this.isLoadingCsv = false;
    });
    return false;
  }
}
