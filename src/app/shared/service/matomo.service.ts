import { Injectable, inject } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { DOCUMENT } from '@angular/common';
import { filter } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

declare global {
  interface Window {
    _paq: any[];
  }
}

@Injectable({
  providedIn: 'root'
})
export class MatomoRouteTrackerService {
  private router = inject(Router);
  private document = inject(DOCUMENT);
  private _paq: any[] = [];
  private initialized = false;

  init() {
    if (!environment.matomo.enabled || this.initialized) return;

    // Inizializza _paq
    this.document.defaultView!._paq = this.document.defaultView!._paq || [];
    this._paq = this.document.defaultView!._paq;

    // Configurazione Matomo
    this._paq.push(['enableLinkTracking']);
    this._paq.push(['setTrackerUrl', environment.matomo.trackerUrl]);
    this._paq.push(['setSiteId', environment.matomo.siteId]);
    
    // Prima pageview
    this._paq.push(['trackPageView']);

    // Carica lo script
    this.loadScript();

    // Traccia le navigazioni successive
    this.trackNavigations();
    
    this.initialized = true;
  }

  private loadScript() {
    const script = this.document.createElement('script');
    const matomoUrl = environment.matomo.trackerUrl.replace('/matomo.php', '/matomo.js');
    script.src = matomoUrl;
    script.async = true;
    script.defer = true;
    this.document.head.appendChild(script);
  }

  private trackNavigations() {
    this.router.events
      .pipe(
        filter((event): event is NavigationEnd => event instanceof NavigationEnd)
      )
      .subscribe((event: NavigationEnd) => {
        // Usa l'URL completo dal browser che include automaticamente il fragment
        const fullUrl = `/#${event.urlAfterRedirects}`;      
        // Traccia ogni cambio di pagina
        this._paq.push(['setCustomUrl', fullUrl]);
        this._paq.push(['setDocumentTitle', this.document.title]);
        this._paq.push(['trackPageView']);
        
        console.log('Matomo: Tracked page view ->', fullUrl);
      });
  }

  // Metodi helper
  trackEvent(category: string, action: string, name?: string, value?: number) {
    if (!environment.matomo.enabled) return;
    
    const params: any[] = ['trackEvent', category, action];
    if (name) params.push(name);
    if (value !== undefined) params.push(value);
    
    this._paq.push(params);
    console.log('Matomo: Tracked event ->', params);
  }

  trackSiteSearch(keyword: string, category?: string, resultsCount?: number) {
    if (!environment.matomo.enabled) return;
    this._paq.push(['trackSiteSearch', keyword, category || false, resultsCount]);
  }

  setUserId(userId: string) {
    if (!environment.matomo.enabled) return;
    this._paq.push(['setUserId', userId]);
  }

  resetUserId() {
    if (!environment.matomo.enabled) return;
    this._paq.push(['resetUserId']);
  }
}