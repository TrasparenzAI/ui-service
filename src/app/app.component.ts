import { Component, inject, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { Location, PopStateEvent } from '@angular/common';
import { TranslateService } from '@ngx-translate/core';
import { HttpClient } from '@angular/common/http';
import { OidcSecurityService } from 'angular-auth-oidc-client';
import { environment } from '../environments/environment';
import { MatomoRouteTrackerService } from './shared/service/matomo.service';
import { filter, take } from 'rxjs';

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
      // Alternativa: ascolta solo quando l'utente è autenticato
      this.oidcSecurityService.isAuthenticated$
        .pipe(
          filter(({ isAuthenticated }) => isAuthenticated),
          take(1) // Execute only once when user becomes authenticated
        )
        .subscribe(() => {
          this.isAuthenticated = true;
          if (environment.matomo.trackerUser.enable) {
            this.oidcSecurityService.getUserData().subscribe(userData => {
              const userId = userData?.email || userData?.preferred_username || userData?.sub;            
              if (userId) {
                this.matomoRouteTracker.setUserId(userId);
              }
            });
          }
        });
    }
  }

  ngOnInit() {
    this.location.subscribe((ev: PopStateEvent) => {
      this.lastPoppedUrl = ev.url;
    });    
  }
}