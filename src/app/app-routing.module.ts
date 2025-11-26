import { NgModule} from '@angular/core';
import { Routes, RouterModule} from '@angular/router';
import { HomeComponent} from './core/home/home.component';
import { SearchComponent } from './core/search/search.component';
import { CompanySearchComponent } from './core/company/company-search.component';
import { CompanyMapComponent } from './core/company/company-map.component';
import { CompanyGraphComponent } from './core/company/company-graph.component';
import { CreditsComponent } from './core/credits/credits.component';
import { ItErrorPageComponent } from 'design-angular-kit';
import { PrivacyPolicyComponent } from './core/privacy-policy/privacy-policy.component';
import { NoteLegaliComponent } from './core/note-legali/note-legali.component';
import { ResultPieComponent } from './core/result/result-pie.component';
import { environment } from '../environments/environment';
import { AutoLoginAllRoutesGuard } from 'angular-auth-oidc-client';
import { MainConfigurationComponent } from './core/configuration/main-conf.component';
import { AuthGuard } from './auth/auth-guard';
import { RoleEnum } from './auth/role.enum';
import { AuthRedirectGuard } from './auth-redirect.guard';
import { ResultRuleListComponent } from './core/result/result-rule-list.component';
import { ResultPieRuleComponent } from './core/result/result-pie-rule.component';
import { ServiceInfoComponent } from './core/info/service-info.component';

const appRoutes: Routes = [
  {path: '', canActivateChild:(environment.oidc.enable && environment.oidc.force)?[AutoLoginAllRoutesGuard]:[], children: [
    { path: '', canActivate: [AuthRedirectGuard], component: HomeComponent },
    { path: 'home', component: HomeComponent },
    { path: 'search', component: SearchComponent },
    { path: 'company-search', component: CompanySearchComponent },
    { path: 'company-map', component: CompanyMapComponent },
    { path: 'company-graph', component: CompanyGraphComponent },
    { path: 'result-pie', component: ResultPieComponent },
    { path: 'result-pie-rule', component: ResultPieRuleComponent },
    { path: 'result-rule', component: ResultRuleListComponent },
    { path: 'credits', component: CreditsComponent },
    { path: 'configuration', component: MainConfigurationComponent, canActivate: [AuthGuard], data: {role: RoleEnum.ADMIN}},
    { path: 'service-info', component: ServiceInfoComponent, canActivate: [AuthGuard], data: {role: RoleEnum.ADMIN}},
  ]},
  { path: 'privacy-policy', component: PrivacyPolicyComponent },
  { path: 'note-legali', component: NoteLegaliComponent },
  { path: 'error/unauthorized', 
    component: ItErrorPageComponent, 
    data: { 
      errorCode: 401,
      errorTitle: "Accesso negato",
      errorDescription: "L'accesso alla risorsa richiesta richiede una autenticazione che non è stata fornita!" 
    } 
  },
  { path: 'error/not-found', component: ItErrorPageComponent, data: { errorCode: 404 } },
  { path: 'error/forbidden', component: ItErrorPageComponent, data: { errorCode: 403 } },
  { path: 'error/server-error', component: ItErrorPageComponent, data: { errorCode: 500 } },
  { path: 'error/not-found-no-back', component: ItErrorPageComponent, data: { errorCode: 404, showBackButton: false } }
];

@NgModule({
  imports: [
    RouterModule.forRoot(appRoutes, {
      useHash: true, scrollPositionRestoration: 'enabled' 
    })
  ],
  exports: [RouterModule]
})
export class AppRoutingModule {

}
