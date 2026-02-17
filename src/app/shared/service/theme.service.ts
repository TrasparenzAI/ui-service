// theme.service.ts
import { Injectable, Inject } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  constructor(@Inject(DOCUMENT) private document: Document) {}

  initTheme() {
    const theme = environment.theme;
    console.log(theme);
    if (theme) {
        const link = this.document.createElement('link');
        link.id = 'app-theme';
        link.rel = 'stylesheet';
        link.href = `${theme}.css`;
        this.document.head.appendChild(link);
    }
  }
}