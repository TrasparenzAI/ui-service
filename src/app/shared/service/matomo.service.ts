import { Injectable, inject } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { DOCUMENT } from '@angular/common';
import { filter } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

declare global {
  interface Window {
    _paq: any[];
    Piwik?: any;
    Matomo?: any;
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
    this.loadScriptAndSetupTracking();
    
    this.initialized = true;
  }

  private loadScriptAndSetupTracking() {
    const script = this.document.createElement('script');
    const matomoUrl = environment.matomo.trackerUrl.replace('/matomo.php', '/matomo.js');
    script.src = matomoUrl;
    script.async = true;
    script.defer = true;
    
    script.onload = () => {
      console.log('✅ Matomo script loaded successfully');
      // Attendi un tick per essere sicuri che Matomo sia inizializzato
      setTimeout(() => {
        this.trackNavigations();
      }, 100);
    };
    
    script.onerror = () => {
      console.error('❌ Failed to load Matomo script');
    };
    
    this.document.head.appendChild(script);
  }

  private trackNavigations() {
    console.log('✅ Navigation tracking enabled');
    
    this.router.events
      .pipe(
        filter((event): event is NavigationEnd => event instanceof NavigationEnd)
      )
      .subscribe((event: NavigationEnd) => {
        // Verifica che Matomo sia caricato
        if (!this.document.defaultView?.Piwik && !this.document.defaultView?.Matomo) {
          console.warn('⚠️ Matomo not ready yet');
          return;
        }
        const fullUrl = `/#${event.urlAfterRedirects}`;
        // CHIAVE: Non usare _paq.push per il tracking delle navigazioni
        // Usa direttamente l'API Piwik quando lo script è già caricato
        try {
          const tracker = this.document.defaultView!.Piwik.getAsyncTracker();
          tracker.setCustomUrl(fullUrl);
          tracker.setDocumentTitle(this.document.title);
          tracker.trackPageView();
          
          console.log('✅ Matomo: Tracked page view ->', event.urlAfterRedirects);
        } catch (error) {
          console.error('❌ Matomo tracking error:', error);
          // Fallback a _paq.push se l'API diretta fallisce
          this._paq.push(['setCustomUrl', fullUrl]);
          this._paq.push(['setDocumentTitle', this.document.title]);
          this._paq.push(['trackPageView']);
        }
      });
  }

  // Metodi helper
  trackEvent(category: string, action: string, name?: string, value?: number) {
    if (!environment.matomo.enabled) return;
    
    try {
      if (this.document.defaultView?.Piwik) {
        const tracker = this.document.defaultView.Piwik.getAsyncTracker();
        tracker.trackEvent(category, action, name, value);
      } else {
        const params: any[] = ['trackEvent', category, action];
        if (name) params.push(name);
        if (value !== undefined) params.push(value);
        this._paq.push(params);
      }
      console.log('✅ Matomo: Event tracked ->', category, action);
    } catch (error) {
      console.error('❌ Matomo event tracking error:', error);
    }
  }

  trackSiteSearch(keyword: string, category?: string, resultsCount?: number) {
    if (!environment.matomo.enabled) return;
    
    try {
      if (this.document.defaultView?.Piwik) {
        const tracker = this.document.defaultView.Piwik.getAsyncTracker();
        tracker.trackSiteSearch(keyword, category || false, resultsCount);
      } else {
        this._paq.push(['trackSiteSearch', keyword, category || false, resultsCount]);
      }
    } catch (error) {
      console.error('❌ Matomo site search tracking error:', error);
    }
  }

  setUserId(userId: string) {
    if (!environment.matomo.enabled) return;
    
    try {
      if (this.document.defaultView?.Piwik) {
        const tracker = this.document.defaultView.Piwik.getAsyncTracker();
        tracker.setUserId(userId);
      } else {
        this._paq.push(['setUserId', userId]);
      }
      console.log('✅ Matomo: User ID set ->', userId);
    } catch (error) {
      console.error('❌ Matomo setUserId error:', error);
    }
  }

  resetUserId() {
    if (!environment.matomo.enabled) return;
    
    try {
      if (this.document.defaultView?.Piwik) {
        const tracker = this.document.defaultView.Piwik.getAsyncTracker();
        tracker.resetUserId();
      } else {
        this._paq.push(['resetUserId']);
      }
      console.log('✅ Matomo: User ID reset');
    } catch (error) {
      console.error('❌ Matomo resetUserId error:', error);
    }
  }
}