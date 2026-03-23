import { AfterViewInit, Component, ElementRef, NgZone, OnInit, ViewChild } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { OidcSecurityService } from 'angular-auth-oidc-client';
import { environment } from '../../../environments/environment';
import { firstValueFrom } from 'rxjs';

import 'deep-chat';
import { AIService } from './ai.service';

@Component({
  selector: 'app-chat',
  template: `
    <div class="container">
      <div class="d-flex mt-2">
        <deep-chat
            #chat
            audio="true"
            microphone="true"
            images="true"
            gifs="true"
            camera="true"
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
    private aiService: AIService, 
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
              content: `<svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor" xmlns="http://www.w3.org/2000/svg" class="group" aria-hidden="true" style="flex-shrink: 0;"><path class="group-hover:-translate-x-[0.5px] transition group-active:translate-x-0" d="M8.99962 2C12.3133 2 14.9996 4.68629 14.9996 8C14.9996 11.3137 12.3133 14 8.99962 14H2.49962C2.30105 13.9998 2.12113 13.8821 2.04161 13.7002C1.96224 13.5181 1.99835 13.3058 2.1334 13.1602L3.93516 11.2178C3.34317 10.2878 2.99962 9.18343 2.99962 8C2.99962 4.68643 5.68609 2.00022 8.99962 2ZM8.99962 3C6.23838 3.00022 3.99961 5.23871 3.99961 8C3.99961 9.11212 4.36265 10.1386 4.97618 10.9688C5.11884 11.1621 5.1035 11.4293 4.94004 11.6055L3.64512 13H8.99962C11.761 13 13.9996 10.7614 13.9996 8C13.9996 5.23858 11.761 3 8.99962 3Z"></path><path class="group-hover:translate-x-[0.5px] transition group-active:translate-x-0" d="M16.5445 9.72754C16.4182 9.53266 16.1678 9.44648 15.943 9.53418C15.7183 9.62215 15.5932 9.85502 15.6324 10.084L15.7369 10.3955C15.9073 10.8986 16.0006 11.438 16.0006 12C16.0006 13.1123 15.6376 14.1386 15.024 14.9687C14.8811 15.1621 14.8956 15.4302 15.0592 15.6064L16.3531 17H11.0006C9.54519 17 8.23527 16.3782 7.32091 15.3848L7.07091 15.1103C6.88996 14.9645 6.62535 14.9606 6.43907 15.1143C6.25267 15.2682 6.20668 15.529 6.31603 15.7344L6.58458 16.0625C7.68048 17.253 9.25377 18 11.0006 18H17.5006C17.6991 17.9998 17.8791 17.8822 17.9586 17.7002C18.038 17.5181 18.0018 17.3058 17.8668 17.1602L16.0631 15.2178C16.6554 14.2876 17.0006 13.1837 17.0006 12C17.0006 11.3271 16.8891 10.6792 16.6842 10.0742L16.5445 9.72754Z"></path></svg>`
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

        if (requestDetails.body instanceof FormData) {
          // ── Con file allegati ─────────────────────────────────────────────
          // Deep Chat invia FormData con:
          //   files    → File nativi del browser
          //   message1 → JSON string '{"role":"user","text":"..."}'
          //   message2 → ...
          const formData = requestDetails.body as FormData;

          // 1. Raccogli i messaggi message1, message2, ...
          const messages: any[] = [];
          let i = 1;
          while (formData.has(`message${i}`)) {
            try { messages.push(JSON.parse(formData.get(`message${i}`) as string)); }
            catch { /* ignora */ }
            i++;
          }

          // 2. Converti i File nativi in base64 data URL
          const rawFiles = formData.getAll('files') as File[];
          const convertedFiles = await Promise.all(rawFiles.map(file =>
            new Promise<any>(resolve => {
              const reader = new FileReader();
              reader.onload = e => resolve({
                name: file.name,
                type: file.type,
                data: e.target!.result as string,
              });
              reader.readAsDataURL(file);
            })
          ));

          // 3. Allega i file all'ultimo messaggio user
          if (convertedFiles.length > 0 && messages.length > 0) {
            const idx = [...messages].map(m => m.role).lastIndexOf('user');
            if (idx >= 0) messages[idx] = { ...messages[idx], files: convertedFiles };
          }

          // 4. Invia come JSON verso /image/stream
          this.requestConfig.url = `${environment.aiApiUrl}/v1/chat/image/stream`;
          requestDetails.body = JSON.stringify({ messages, model: this.selectedModel || undefined });
          requestDetails.headers = {
            ...requestDetails.headers,
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          };

        } else {
          this.requestConfig.url = `${environment.aiApiUrl}/v1/chat/stream`;
          // ── Solo testo, nessun file ───────────────────────────────────────
          // body è già un oggetto JS { messages: [...] } — NON serializzare,
          // Deep Chat lo serializza internamente prima di inviare
          requestDetails.body = {
            ...(requestDetails.body ?? {}),
            model: this.selectedModel || undefined,
          };
          requestDetails.headers = {
            ...requestDetails.headers,
            'Authorization': `Bearer ${token}`,
          };
        }

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
        this.aiService.getAny(`/v1/models`)
      );

      this.availableModels = response.models.map(m => ({
        value: m.model,
        text: m.name.split(':')[0].toUpperCase() + (m.details?.parameter_size ? ` (${m.details.parameter_size})` : ''),
      }));

      if (this.availableModels.length > 0) {
        const defaultExists = this.availableModels.some(m => m.value === response.defaultModel);
        this.selectedModel = defaultExists ? response.defaultModel : this.availableModels[0].value;
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