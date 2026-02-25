import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { SigninComponent } from './signin/signin.component';
import { FormsModule } from '@angular/forms';
import { environment } from '../../environments/environment';
import { AutoLoginAllRoutesGuard } from 'angular-auth-oidc-client';

const shouldEnforceOidc = environment.oidc.enable && !(environment.devBypassAdminAuth && !environment.production);

const authRoutes: Routes = [
  { 
    path: 'auth/signin', 
    canActivate: shouldEnforceOidc ? [AutoLoginAllRoutesGuard] : [], 
    component: SigninComponent 
  }
];

@NgModule({
  imports: [
    FormsModule,
    RouterModule.forChild(authRoutes)
  ],
  exports: [RouterModule]
})
export class AuthRoutingModule {}
