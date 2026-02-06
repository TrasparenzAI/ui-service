import { Component, inject, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { Location, PopStateEvent } from '@angular/common';
import { TranslateService } from '@ngx-translate/core';
import { HttpClient } from '@angular/common/http';
import { OidcSecurityService } from 'angular-auth-oidc-client';
import { environment } from '../environments/environment';
import { MatomoRouteTrackerService } from './shared/service/matomo.service';

@Component({
    selector: 'app-root',
    templateUrl: './app.component.html',
    styleUrls: ['./app.component.css'],
    standalone: false
})
export class AppComponent implements OnInit {

  private lastPoppedUrl: string;
  private matomoRouteTracker = inject(MatomoRouteTrackerService);
  isAuthenticated = false;

  constructor(private router: Router,
              private location: Location,
              protected httpClient: HttpClient,
              private oidcSecurityService: OidcSecurityService,
              public translate: TranslateService) {
    translate.addLangs(['it', 'en']);
    translate.getLangs().forEach((lang: string) => {
      translate.reloadLang(lang).subscribe((res) => {
        httpClient.get('assets/i18n/custom_' + lang + '.json').subscribe((data) => {
          if (data) {
            translate.setTranslation(lang, data, true);
          }
        });
      });
    });
    if (environment.oidc.enable) {
      this.oidcSecurityService.isAuthenticated$.subscribe(
        (auth) => (this.isAuthenticated = auth.isAuthenticated)
      );
    }
  }

  ngOnInit() {
    this.matomoRouteTracker.init();
    this.location.subscribe((ev: PopStateEvent) => {
      this.lastPoppedUrl = ev.url;
    });    
  }
}
