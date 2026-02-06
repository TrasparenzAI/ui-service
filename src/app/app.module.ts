import { ErrorHandler, NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';

import { HTTP_INTERCEPTORS, provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { AppComponent } from './app.component';
import { AuthInterceptor } from './auth/auth.interceptor';

import { CoreModule } from './core/core.module';

import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { AppRoutingModule } from './app-routing.module';
import { GlobalErrorHandler } from './core/global-error-handler.service';

// import ngx-translate and the http loader
import { APP_BASE_HREF, registerLocaleData } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { TranslateCompiler, TranslateLoader, TranslateModule } from '@ngx-translate/core';
import { AuthModule, LogLevel } from 'angular-auth-oidc-client';
import { environment } from '../environments/environment';
import { AppRoutingEndModule } from './app-routing-end.module';
import { LoadingInterceptor } from './auth/loading.interceptor';
import { CustomTranslationCompiler } from './common/helpers/translation-compiler';
import { ConfigService } from './core/config.service';

import localeIt from '@angular/common/locales/it';

import { APP_INITIALIZER } from '@angular/core';
import { OidcSecurityService } from 'angular-auth-oidc-client';
import { NgxMatomoTrackerModule } from '@ngx-matomo/tracker';

export function appInitializerFactory(oidcSecurityService: OidcSecurityService) {
  return () => oidcSecurityService.checkAuth().toPromise();
}

@NgModule({ declarations: [
        AppComponent
    ],
    bootstrap: [AppComponent], 
    imports: [      
        BrowserModule,
        BrowserAnimationsModule,
        AuthModule.forRoot({
            config: {
                authority: environment.oidc.authority || window.location.origin,
                redirectUrl: environment.oidc.redirectUrl || window.location.origin,
                postLogoutRedirectUri: environment.oidc.postLogoutRedirectUri || window.location.origin,
                clientId: environment.oidc.clientId || 'clientId',
                scope: 'openid profile roles email offline_access',
                responseType: 'code',
                renewTimeBeforeTokenExpiresInSeconds: 10,
                tokenRefreshInSeconds: 10,
                silentRenew: true,
                useRefreshToken: true,
                ignoreNonceAfterRefresh: true,
                autoUserInfo: true,
                maxIdTokenIatOffsetAllowedInSeconds: 300,
                logLevel: LogLevel.None,
            },
        }),
        TranslateModule.forRoot({
            compiler: { provide: TranslateCompiler, useClass: CustomTranslationCompiler },
            loader: {
                provide: TranslateLoader,
                useFactory: CustomHttpLoaderFactory,
                deps: [HttpClient]
            }
        }),
        AppRoutingModule, // Routing
        CoreModule, // Componenti moduli e servizi non Lazy
        AppRoutingEndModule,
        NgxMatomoTrackerModule.forRoot({
          disabled: environment.matomo.enabled,
          trackerUrl: environment.matomo.trackerUrl,
          siteId: environment.matomo.siteId,
        })
      ], 
      providers: [
        { provide: HTTP_INTERCEPTORS, useClass: AuthInterceptor, multi: true },
        { provide: HTTP_INTERCEPTORS, useClass: LoadingInterceptor, multi: true },
        { provide: APP_BASE_HREF, useValue: environment.baseHref },
        { provide: ErrorHandler, useClass: GlobalErrorHandler },
        {
          provide: APP_INITIALIZER,
          useFactory: appInitializerFactory,
          deps: [OidcSecurityService],
          multi: true
        },
        provideHttpClient(withInterceptorsFromDi())
      ] 
    })
export class AppModule { 
  constructor() {
    registerLocaleData(localeIt, 'it-IT', localeIt);
  }
}

// required for AOT compilation
export function CustomHttpLoaderFactory(http: HttpClient) {
  return new ConfigService(http);
}
