import { AfterViewInit, Component, ElementRef, NgZone, OnInit, ViewChild } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { OidcSecurityService } from 'angular-auth-oidc-client';
import { environment } from '../../../environments/environment';
import { firstValueFrom } from 'rxjs';

import 'deep-chat';

@Component({
  selector: 'app-chat',
  template: `
    <div class="container">
      <div class="d-flex mt-2">
        <deep-chat
            #chat
            [avatars]="avatars"
            [connect]="requestConfig"
            [stream]="streamConfig"
            [textInput]="textInputConfig"
            [customButtons]="customButtons"
            [auxiliaryStyle]="auxiliaryStyle"
            requestBodyLimits='{"maxMessages": 200}'
            style="height: 60vh; width: 100%"
            class="d-flex w-100 shadow rounded border-primary">
        </deep-chat>
      </div>
    </div>
  `,
  standalone: false
})
export class ChatComponent implements OnInit, AfterViewInit {
  availableModels: any[] = [];

  /** Modello attualmente selezionato — aggiornato dalla <select> iniettata nel shadow DOM */
  selectedModel = '';

  protected requestConfig: any;
  protected streamConfig = { simulation: false };
  private silenceTimer: any = null;
  private readonly SILENCE_THRESHOLD = 300;
  private loadingMessageIndex = -1;

  @ViewChild('chat') private chat?: ElementRef;

  constructor(
    private oidcSecurityService: OidcSecurityService,
    private ngZone: NgZone,
    private http: HttpClient,
  ) {}

  avatars = { ai: { src: '/assets/images/ai.png' } };

  auxiliaryStyle = `
    .dc-dot { display: inline-block; width: 7px; height: 7px; border-radius: 50%; background: #aaa; animation: dc-bounce 1.2s ease-in-out infinite; }
    .dc-dot:nth-child(2) { animation-delay: 0.2s; }
    .dc-dot:nth-child(3) { animation-delay: 0.4s; }
    @keyframes dc-bounce { 0%, 80%, 100% { transform: translateY(0); opacity: 0.4; } 40% { transform: translateY(-5px); opacity: 1; } }

    /* Bootstrap Italia style select wrapper */
    .bi-select-wrapper {
      position: relative;
      display: inline-flex;
      align-items: center;
      min-width: 130px;
      height: 38px;
      width: 30%;
    }
    .model-select {
      appearance: none;
      -webkit-appearance: none;
      width: 100%;
      height: 100%;
      padding: 0 2rem 0 0.75rem;
      font-family: Titillium Web, system-ui, sans-serif;
      font-size: 0.875rem;
      font-weight: 600;
      color: #17324d;
      background: transparent;
      border: none;
      border-radius: 0;
      cursor: pointer;
      outline: none;
      transition: border-color 0.2s;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .model-select:hover { border-bottom-color: #17324d; }
    .model-select:focus { border-bottom-color: #0073e6; }
    .bi-select-arrow {
      position: absolute;
      right: 0.25rem;
      top: 50%;
      transform: translateY(-50%);
      pointer-events: none;
      color: #5c6f82;
    }
    .model-select:focus + .bi-select-arrow { color: #0073e6; }
    .avatar {
      width: 3em;
      height: 3em;
    }
  `;

  customButtons = [
    {
      position: 'inside-left',
      styles: {
        button: {
          default: {
            container: { default: { border: '1px solid #e2e2e2', borderRadius: '10px' } },
            svg: {
              content: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-0.5 0 25 25" fill="none">
                <path d="M12 22.3201C17.5228 22.3201 22 17.8429 22 12.3201C22 6.79722 17.5228 2.32007 12 2.32007C6.47715 2.32007 2 6.79722 2 12.3201C2 17.8429 6.47715 22.3201 12 22.3201Z" stroke="#000000" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                <line x1="12" y1="7.32007" x2="12" y2="17.3201" stroke="#000000" stroke-width="1.5" stroke-linecap="round"/>
                <line x1="7" y1="12.3201" x2="17" y2="12.3201" stroke="#000000" stroke-width="1.5" stroke-linecap="round"/>
              </svg>`
            },
            text: { content: 'Nuova chat' }
          }
        }
      },
      onClick: () => this.newChat(),
    },
  ];

  textInputConfig = {
    placeholder: { text: 'Benvenuto! Sono Chiara, l\'assistente virtuale di TrasparenzAI' },
    styles: { container: { paddingBottom: '30px' }, text: { padding: '0.5rem 0.7rem' } },
  };

  async ngOnInit() {
    await this.fetchModels();

    this.requestConfig = {
      url: `${environment.aiApiUrl}/v1/chat/stream`,
      method: 'POST',
      stream: true,
      headers: { 'Content-Type': 'application/json' },
    };

    setTimeout(() => {
      const el = this.chat?.nativeElement;
      if (!el) return;

      this.injectModelSelect(el);

      // Aspetta che deep-chat abbia finito il rendering
      el.onComponentRender = () => {
        this.focusInput();
        this.injectModelSelect(el); // ← inietta SOLO dopo il render completo
      };

      el.requestInterceptor = async (requestDetails: any) => {
        this.clearSilenceTimer();
        this.removeLoadingMessage();

        const token = await firstValueFrom(this.oidcSecurityService.getAccessToken());

        requestDetails.body = {
          ...requestDetails.body,
          model: this.selectedModel || undefined,
        };

        requestDetails.headers = {
          ...requestDetails.headers,
          Authorization: `Bearer ${token}`,
        };
        return requestDetails;
      };

      el.responseInterceptor = (responseDetails: any) => {
        if (responseDetails?.text) {
          this.clearSilenceTimer();
          this.removeLoadingMessage();
          this.silenceTimer = setTimeout(() => this.addLoadingMessage(), this.SILENCE_THRESHOLD);
        }
        return responseDetails;
      };

      el.onMessage = ({ isHistory }: any) => {
        if (!isHistory) { this.clearSilenceTimer(); this.removeLoadingMessage(); }
      };
    });
  }

  /**
   * Inietta una <select> nativa nel pannello input di deep-chat (shadow DOM).
   * Posizionata in basso a destra nell'area di testo, prima del pulsante invio.
   */
  private injectModelSelect(el: any): void {
    const shadow = el.shadowRoot;
    if (!shadow) return;

    const inject = () => {
      if (shadow.querySelector('#model-selector-wrapper')) return; // già presente

      const textInputContainer = shadow.querySelector('#text-input-container');
      if (!textInputContainer) return;

      // Wrapper Bootstrap Italia style
      const wrapper = document.createElement('div');
      wrapper.id = 'model-selector-wrapper';
      wrapper.className = 'bi-select-wrapper';

      const select = document.createElement('select');
      select.id = 'model-selector';
      select.className = 'model-select';
      select.title = 'Seleziona modello AI';

      this.availableModels.forEach(m => {
        const opt = document.createElement('option');
        opt.value = m.value;
        opt.textContent = m.text;
        if (m.value === this.selectedModel) opt.selected = true;
        select.appendChild(opt);
      });

      select.addEventListener('change', (e: Event) => {
        this.selectedModel = (e.target as HTMLSelectElement).value;
      });

      // Freccia SVG Bootstrap Italia
      const arrow = document.createElement('span');
      arrow.className = 'bi-select-arrow';
      arrow.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M6 9L12 15L18 9" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>`;

      wrapper.appendChild(select);
      wrapper.appendChild(arrow);

      (textInputContainer as HTMLElement).style.alignItems = 'center';
      (textInputContainer as HTMLElement).style.gap = '8px';
      textInputContainer.appendChild(wrapper);
    };

    // Prima iniezione
    inject();

    // Re-inietta ogni volta che deep-chat ricostruisce il DOM
    const observer = new MutationObserver(() => inject());
    observer.observe(shadow, { childList: true, subtree: true });
  }
  
  private async fetchModels() {
    try {
      const token = await firstValueFrom(this.oidcSecurityService.getAccessToken());
      const headers = new HttpHeaders().set('Authorization', `Bearer ${token}`);

      const response: any = await firstValueFrom(
        this.http.get<any[]>(`${environment.aiApiUrl}/v1/models`, { headers })
      );

      this.availableModels = response.models.map(m => ({
        value: m.model,
        text: m.name.split(':')[0].toUpperCase() + (m.details?.parameter_size ? ` (${m.details.parameter_size})` : ''),
      }));

      if (this.availableModels.length > 0) {
        this.selectedModel = response.defaultModel || this.availableModels[0].value;
      }
    } catch (error) {
      console.error('Errore nel recupero dei modelli:', error);
    }
  }

  ngAfterViewInit(): void {
    const el = this.chat?.nativeElement;
    if (el) {
      el.onComponentRender = () => {
        this.focusInput();
        this.injectModelSelect(el);
      };
    }  
  }

  newChat() {
    const el = this.chat?.nativeElement;
    if (!el) return;
    this.clearSilenceTimer();
    this.removeLoadingMessage();
    el.clearMessages();
    el.onComponentRender = () => this.focusInput();
  }

  private addLoadingMessage(): void {
    const el = this.chat?.nativeElement;
    if (!el) return;
    const messages = el.getMessages();
    this.loadingMessageIndex = messages.length;
    el.addMessage({ role: 'ai', html: `<div style="display:flex; gap:5px; align-items:center; padding: 2px 0"><span class="dc-dot"></span><span class="dc-dot"></span><span class="dc-dot"></span></div>`, sendUpdate: false });
  }

  private removeLoadingMessage(): void {
    const el = this.chat?.nativeElement;
    if (!el || this.loadingMessageIndex < 0) return;
    el.updateMessage({ html: '', sendUpdate: false }, this.loadingMessageIndex);
    this.loadingMessageIndex = -1;
  }

  private clearSilenceTimer(): void {
    if (this.silenceTimer) { clearTimeout(this.silenceTimer); this.silenceTimer = null; }
  }

  private focusInput(): void {
    const el = this.chat?.nativeElement;
    if (!el) return;
    this.ngZone.runOutsideAngular(() => {
      const doFocus = () => {
        const input = el.shadowRoot?.querySelector('#text-input[contenteditable]') as HTMLElement;
        input?.focus();
      };
      if ('requestIdleCallback' in window) { requestIdleCallback(() => requestAnimationFrame(doFocus)); }
      else { setTimeout(doFocus, 500); }
    });
  }
}