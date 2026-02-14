import { Injectable, inject } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { filter } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class MatomoRouteTrackerService {
  private router = inject(Router);
  private http = inject(HttpClient);
  private userId: string;

  init() {
    if (!environment.matomo.enabled) {
      console.log('Matomo disabled');
      return;
    }

    console.log('Matomo init - Self-hosted mode');
    console.log('Tracker URL:', environment.matomo.trackerUrl);
    console.log('Site ID:', environment.matomo.siteId);

    // Traccia pagina iniziale
    this.trackPageView();

    // Traccia navigazioni
    this.trackNavigations();
  }

  private trackNavigations() {
    this.router.events
      .pipe(
        filter((event): event is NavigationEnd => event instanceof NavigationEnd)
      )
      .subscribe(() => {
        setTimeout(() => this.trackPageView(), 100);
      });
  }

  private trackPageView() {
    const url = window.location.href;
    const title = document.title;

    console.log('Tracking page view:', url);

    const params = new URLSearchParams({
      idsite: environment.matomo.siteId.toString(),
      rec: '1',
      action_name: title,
      uid: this.userId,
      url: url,
      rand: Math.random().toString(36).substring(7),
      apiv: '1',
      send_image: '0'
    });

    const trackingUrl = `${environment.matomo.trackerUrl}?${params.toString()}`;

    // Usa HttpClient per gestire meglio CORS
    this.http.get(trackingUrl, { 
      responseType: 'text',
      headers: new HttpHeaders({
        'Content-Type': 'application/x-www-form-urlencoded'
      })
    }).subscribe({
      next: () => console.log('✓ Page tracked successfully'),
      error: (error) => {
        console.error('✗ Tracking failed:', error);
        console.error('Check CORS configuration on Matomo server');
      }
    });
  }

  trackEvent(category: string, action: string, name?: string, value?: number) {
    if (!environment.matomo.enabled) return;

    const params = new URLSearchParams({
      idsite: environment.matomo.siteId.toString(),
      rec: '1',
      uid: this.userId,
      e_c: category,
      e_a: action,
      ...(name && { e_n: name }),
      ...(value !== undefined && { e_v: value.toString() }),
      rand: Math.random().toString(36).substring(7),
      apiv: '1'
    });

    const trackingUrl = `${environment.matomo.trackerUrl}?${params.toString()}`;

    this.http.get(trackingUrl, { responseType: 'text' }).subscribe({
      next: () => console.log('✓ Event tracked:', category, action),
      error: (error) => console.error('✗ Event tracking failed:', error)
    });
  }

  setUserId(userId: string) {
    if (!environment.matomo.enabled) return;
    this.userId = userId;
  }

  resetUserId() {
    if (!environment.matomo.enabled) return;
    console.log('User ID reset');
    this.userId = undefined;
  }
}