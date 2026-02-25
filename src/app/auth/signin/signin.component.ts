import { Component, OnInit } from '@angular/core';
import { FormGroup, FormBuilder, Validators } from '@angular/forms';
import { OidcSecurityService } from 'angular-auth-oidc-client';

import { Router } from '@angular/router';
import { ConfigService } from '../../core/config.service';
import { environment } from '../../../environments/environment';

@Component({
    selector: 'app-signin',
    templateUrl: './signin.component.html',
    standalone: false
})
export class SigninComponent implements OnInit {

    ngForm: FormGroup;
    submitted = false;
    private shouldEnforceOidc = environment.oidc.enable && !(environment.devBypassAdminAuth && !environment.production);
    oidcEnable = this.shouldEnforceOidc;
    oidcForce = environment.oidc.force;
    authenticated = false;
    
    constructor(private formBuilder: FormBuilder,
                private router: Router,
                protected configService: ConfigService,
                private oidcSecurityService: OidcSecurityService) { }

    ngOnInit() {
        this.ngForm = this.formBuilder.group({
            username: ['', Validators.required],
            password: ['', Validators.required]
        });
        if (this.shouldEnforceOidc) {
            this.authenticated = true;
            this.oidcSecurityService.checkAuth().subscribe(({ isAuthenticated, userData, accessToken, idToken }) => {
                this.authenticated = isAuthenticated;
                const redirectUrl = sessionStorage.getItem('redirect') || '/';
                sessionStorage.removeItem('redirect');                
                this.router.navigateByUrl(redirectUrl);
            });
        }
    }
    
    // convenience getter for easy access to form fields
    get f() { return this.ngForm.controls; }

    onSigninSSO() {
        if (!this.shouldEnforceOidc) {
            return;
        }
        this.oidcSecurityService.authorize();
    }
    
    onSignin() {
        this.submitted = true;

        // stop here if form is invalid
        if (this.ngForm.invalid) {
            return;
        }
        const username = this.ngForm.value.username;
        const password = this.ngForm.value.password;
    }

}
