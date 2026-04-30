/*
 * Copyright (C) 2025 Consiglio Nazionale delle Ricerche
 *
 *     This program is free software: you can redistribute it and/or modify
 *     it under the terms of the GNU Affero General Public License as
 *     published by the Free Software Foundation, either version 3 of the
 *     License, or (at your option) any later version.
 *
 *     This program is distributed in the hope that it will be useful,
 *     but WITHOUT ANY WARRANTY; without even the implied warranty of
 *     MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 *     GNU Affero General Public License for more details.
 *
 *     You should have received a copy of the GNU Affero General Public License
 *     along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */
import { AfterViewInit, Component, ElementRef, NgZone, OnInit, ViewChild } from '@angular/core';
import { OidcSecurityService } from 'angular-auth-oidc-client';
import { environment } from '../../../environments/environment';
import { firstValueFrom } from 'rxjs';
import { ConfigurationService } from '../configuration/configuration.service';
import { AIService } from './ai.service';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import 'deep-chat-dev';
import * as echarts from 'echarts';

/** Regex per estrarre il blocco TOOL_RESULTS dalla risposta del backend */
const TOOL_RESULTS_RE = /<!--TOOL_RESULTS:([\s\S]*?)-->/;

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

  protected streamConfig = { simulation: false };
  private silenceTimer: any = null;
  private readonly SILENCE_THRESHOLD = 800;
  private loadingMessageIndex = -1;

  @ViewChild('chat') private chat?: ElementRef;

  constructor(
    private oidcSecurityService: OidcSecurityService,
    private aiService: AIService,
    private ngZone: NgZone,
    private configurationService: ConfigurationService,
  ) {}

  avatars = { ai: { src: '/assets/images/ai.png' } };

  auxiliaryStyle = `
    .dc-dot { display: inline-block; width: 7px; height: 7px; border-radius: 50%; background: #aaa; animation: dc-bounce 1.2s ease-in-out infinite; }
    .dc-dot:nth-child(2) { animation-delay: 0.2s; }
    .dc-dot:nth-child(3) { animation-delay: 0.4s; }
    @keyframes dc-bounce { 0%, 80%, 100% { transform: translateY(0); opacity: 0.4; } 40% { transform: translateY(-5px); opacity: 1; } }

    /* rimuove il bubble grigio di Deep Chat quando contiene la nuvoletta thinking */
    .deep-chat-message-ai-outer:has(.thinking-bubble-wrap),
    .deep-chat-message-ai:has(.thinking-bubble-wrap),
    .deep-chat-message:has(.thinking-bubble-wrap),
    .message-bubble:has(.thinking-bubble-wrap) {
      background: transparent !important;
      border: none !important;
      box-shadow: none !important;
      padding: 0 !important;
    }

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

    .thinking-bubble-wrap {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      margin-bottom: 18px;
      max-width: 60vw;
    }
    .thinking-row {
      font-size: 0.85rem;
      color: #0056b3;
      background: #eef5ff;
      padding: 10px 16px;
      border-radius: 18px 18px 18px 4px;
      box-shadow: 0 1px 4px rgba(0,80,180,0.10), inset 0 0 0 1.5px #c5dcff;
      max-height: 120px;
      overflow: hidden;
      position: relative;
      width: fit-content;
      min-width: 80px;
    }
    .thinking-row::before {
      content: '';
      position: absolute;
      top: 0; left: 0; right: 0;
      height: 28px;
      background: linear-gradient(to bottom, #eef5ff 40%, transparent);
      pointer-events: none;
      z-index: 1;
      border-radius: 18px 18px 0 0;
    }
    /* pallini della nuvoletta in basso a sinistra */
    .thinking-dots-tail {
      display: flex;
      align-items: center;
      gap: 4px;
      margin-top: 5px;
      padding-left: 6px;
    }
    .thinking-dots-tail span {
      display: block;
      background: #c5dcff;
      border-radius: 50%;
      flex-shrink: 0;
    }
    .thinking-dots-tail span:nth-child(1) { width: 10px; height: 10px; }
    .thinking-dots-tail span:nth-child(2) { width: 6px;  height: 6px;  }
    .thinking-dots-tail span:nth-child(3) { width: 3px;  height: 3px;  }
    .thinking-scroll {
      overflow-y: auto;
      max-height: 100px;
      width: 100%;
      scrollbar-width: none;
      position: relative;
      z-index: 0;
    }
    .thinking-scroll::-webkit-scrollbar { display: none; }
    /* pulsazione leggera della nuvoletta mentre pensa */
    @keyframes cloud-breathe {
      0%, 100% { box-shadow: 0 1px 4px rgba(0,80,180,0.10), inset 0 0 0 1.5px #c5dcff; }
      50%       { box-shadow: 0 2px 10px rgba(0,100,220,0.18), inset 0 0 0 1.5px #90bcff; }
    }
    .thinking-row { animation: cloud-breathe 2.4s ease-in-out infinite; }

    .spinner {
      width: 10px;
      height: 10px;
      border: 2px solid #0073e6;
      border-top: 2px solid transparent;
      border-radius: 50%;
      animation: spin 1s linear infinite;
      flex-shrink: 0;
    }

    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
    .deep-chat-message-text {
      transition: opacity 0.3s ease-in;
    }
    .final-text {
      white-space: normal;
      line-height: 1.55;
      animation: fadeIn 0.2s ease;
    }

    .final-text pre {
      background: #0f172a;
      color: #e5e7eb;
      padding: 12px;
      border-radius: 8px;
      overflow-x: auto;
    }

    .final-text code {
      font-family: monospace;
    }

    .final-text p {
      margin: 0.4rem 0;
    }

    @keyframes fadeIn {
      from { opacity: 0.4; }
      to { opacity: 1; }
    }

    /* player audio iniettato post-stream */
    .ai-audio-player {
      margin-top: 10px;
    }
    .ai-audio-player audio {
      width: 100%;
      max-width: 380px;
      height: 36px;
      border-radius: 8px;
    }
    `;

  customButtons = [
    {
      position: 'inside-start',
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
    {
      position: 'dropup-menu',
      styles: {
        button: {
          default: {
            container: { default: { border: '1px solid #e2e2e2', borderRadius: '10px' } },
            svg: {
              content: `<svg viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><g id="SVGRepo_bgCarrier" stroke-width="0"></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g><g id="SVGRepo_iconCarrier"> <path fill-rule="evenodd" clip-rule="evenodd" d="M15 1H1V15H15V1ZM3 3V7H5V5H7V11H5V13H11V11H9V5H11V7H13V3H3Z" fill="#000000"></path> </g></svg>`
            },
            text: { content: 'Esporta Testo' }
          }
        }
      },
      onClick: () => this.exportChat('txt'),
    },
    {
      position: 'dropup-menu',
      styles: {
        button: {
          default: {
            container: { default: { border: '1px solid #e2e2e2', borderRadius: '10px' } },
            svg: {
              content: `<svg fill="#000000" height="200px" width="200px" id="Layer_1" data-name="Layer 1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><g id="SVGRepo_bgCarrier" stroke-width="0"></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g><g id="SVGRepo_iconCarrier"> <path class="cls-1" d="M14.25,3H1.75A.74027.74027,0,0,0,1,3.73016v8.53968A.74029.74029,0,0,0,1.75,13h12.5a.74029.74029,0,0,0,.75-.73016V3.73016A.74027.74027,0,0,0,14.25,3ZM7.965,10.059H6.97374V7.77311L5.9825,9.34956,4.99125,7.77311V10.059H4V5.934h.91L5.9825,7.51038,7.055,5.934h.91Zm2.45884.0071L8.84766,7.94479H9.94749V5.934h.99124V7.94479H12Z"></path> </g></svg>`
            },
            text: { content: 'Esporta Markdown' }
          }
        }
      },
      onClick: () => this.exportChat('md'),
    },
  ];

  textInputConfig = {
    placeholder: { text: 'Come posso aiutarti oggi?' },
    styles: { container: { paddingBottom: '30px' }, text: { padding: '0.5rem 0.7rem' } },
  };

  protected requestConfig: any = {
    url: `${environment.aiApiUrl}/v1/chat/stream`,
    method: 'POST',
    stream: this.streamConfig,
    headers: { 'Content-Type': 'application/json' },
  };

  // ─── Stream state ─────────────────────────────────────────────────────────────
  private thinkingText = '';
  private aiBuffer = '';
  private isStreaming = false;
  private chartInstances = new Map<HTMLElement, echarts.ECharts>();
  private toolResultsMap = new Map<number, any[]>();

  /**
   * Audio base64 ricevuto dall'evento SSE "audio" durante lo stream.
   * Non viene iniettato subito — viene tenuto qui e iniettato nel DOM
   * solo dopo l'evento "done", quando il bubble è finalizzato da Deep Chat.
   */
  private pendingAudio: string | null = null;

  // ─── Lifecycle ───────────────────────────────────────────────────────────────

  async ngOnInit() {
    await this.fetchModels();

    setTimeout(() => {
      const el = this.chat?.nativeElement;
      if (!el) return;
      this.setupRequestInterceptor(el);
      this.setupResponseInterceptor(el);
      this.setupOnMessage(el);
    });
  }

  ngAfterViewInit(): void {
    const el = this.chat?.nativeElement;
    if (el) {
      el.onComponentRender = () => this.focusAndAddInitialMessage();
    }
    setTimeout(() => this.setupKeyBindings(), 500);
  }

  private setupKeyBindings() {
    const el = this.chat?.nativeElement;
    if (!el) return;
    const textarea = el.shadowRoot?.querySelector('textarea');
    if (!textarea) return;

    textarea.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key !== 'Enter') return;

      if (e.ctrlKey) {
        // CTRL+ENTER → newline
        e.stopImmediatePropagation();
        e.preventDefault();
        const pos = textarea.selectionStart;
        const val = textarea.value;
        textarea.value = val.slice(0, pos) + '\n' + val.slice(pos);
        textarea.selectionStart = textarea.selectionEnd = pos + 1;
        textarea.dispatchEvent(new Event('input', { bubbles: true }));
      }
      // ENTER senza Ctrl: lascia fare a deep-chat (invia)
    }, true);
  }
  // ─── Interceptors ────────────────────────────────────────────────────────────

  private setupRequestInterceptor(el: any): void {
    el.requestInterceptor = async (requestDetails: any) => {
      this.aiBuffer = '';
      this.pendingAudio = null;
      this.clearSilenceTimer();
      this.removeLoadingMessage();

      const token = await firstValueFrom(this.oidcSecurityService.getAccessToken());

      if (requestDetails.body instanceof FormData) {
        await this.handleFormDataRequest(requestDetails, token);
      } else {
        this.handleJsonRequest(requestDetails, token);
      }

      return requestDetails;
    };
  }

  private async handleFormDataRequest(requestDetails: any, token: string): Promise<void> {
    const formData = requestDetails.body as FormData;

    // Raccogli i messaggi message1, message2, ...
    const messages: any[] = [];
    let i = 1;
    while (formData.has(`message${i}`)) {
      try { messages.push(JSON.parse(formData.get(`message${i}`) as string)); }
      catch { /* ignora */ }
      i++;
    }

    // Converti i File nativi in base64 data URL
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

    // Allega i file all'ultimo messaggio user
    if (convertedFiles.length > 0 && messages.length > 0) {
      const idx = [...messages].map(m => m.role).lastIndexOf('user');
      if (idx >= 0) messages[idx] = { ...messages[idx], files: convertedFiles };
    }
    this.injectToolResultsIntoMessages(messages);

    this.requestConfig.url = `${environment.aiApiUrl}/v1/chat/image/stream`;
    requestDetails.body = JSON.stringify({ messages, model: this.selectedModel || undefined });
    requestDetails.headers = {
      ...requestDetails.headers,
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    };
  }

  private handleJsonRequest(requestDetails: any, token: string): void {
    this.requestConfig.url = `${environment.aiApiUrl}/v1/chat/stream`;

    const body = requestDetails.body ?? {};
    const messages: any[] = [...(body.messages ?? [])];
    this.injectToolResultsIntoMessages(messages);
    requestDetails.body = {
      ...body,
      messages,
      model: this.selectedModel || undefined,
    };
    requestDetails.headers = {
      ...requestDetails.headers,
      'Authorization': `Bearer ${token}`,
    };
  }

  private injectToolResultsIntoMessages(messages: any[]): void {
    if (this.toolResultsMap.size === 0) return;

    for (let i = 0; i < messages.length; i++) {
      const toolResults = this.toolResultsMap.get(i + 1);
      if (!toolResults) continue;
      messages[i] = { ...messages[i], toolResults };
    }
  }

  private setupResponseInterceptor(el: any): void {
    el.responseInterceptor = (responseDetails: any) => {
      console.log('[interceptor] responseDetails keys:', Object.keys(responseDetails ?? {}));
      console.log('[interceptor] responseDetails:', JSON.stringify(responseDetails));
      // ── THINKING STREAM ──────────────────────────────────────────────────────
      if (responseDetails?.thinking) {
        this.aiBuffer = '';
        this.isStreaming = true;
        this.thinkingText += responseDetails.thinking;

        this.ngZone.runOutsideAngular(() => {
          requestAnimationFrame(() => {
            const chatEl = this.chat?.nativeElement;
            const root = chatEl?.shadowRoot ?? document;
            const scroller = root.querySelector('.thinking-scroll') as HTMLElement;
            if (scroller) scroller.scrollTop = scroller.scrollHeight;
          });
        });

        return {
          html: `
            <div style="background:transparent!important;padding:0!important;margin:0!important">
              <div class="thinking-bubble-wrap">
                <div class="thinking-row">
                  <div class="thinking-scroll">🤔 ${this.renderMarkdown(this.thinkingText)}</div>
                </div>
                <div class="thinking-dots-tail">
                  <span></span><span></span><span></span>
                </div>
              </div>
            </div>
          `,
          overwrite: true
        };
      }

      // ── TEXT STREAM ──────────────────────────────────────────────────────────
      if (responseDetails?.text) {
        this.thinkingText = '';
        if (!this.isStreaming) {
          this.aiBuffer = '';
          this.isStreaming = true;
        }

        this.clearSilenceTimer();
        this.removeLoadingMessage();
        this.silenceTimer = setTimeout(() => this.addLoadingMessage(), this.SILENCE_THRESHOLD);

        this.aiBuffer += responseDetails.text;

        const toolMatch = this.aiBuffer.match(TOOL_RESULTS_RE);
        if (toolMatch) {
          try {
            const currentIndex = this.chat?.nativeElement?.getMessages()?.length ?? 0;
            this.toolResultsMap.set(currentIndex, JSON.parse(toolMatch[1]));
          } catch (e) {
            console.warn('[tool-results] JSON non valido:', e);
          }
          this.aiBuffer = this.aiBuffer.replace(TOOL_RESULTS_RE, '').trim();
        }

        return {
          html: `<div class="final-text">${this.renderMarkdown(this.aiBuffer)}</div>`,
          overwrite: true
        };
      }

      // ── AUDIO — salva in attesa del done ─────────────────────────────────────
      // L'audio non viene iniettato subito perché Deep Chat potrebbe sovrascrivere
      // il bubble con un ultimo flush. Viene tenuto in pendingAudio e iniettato
      // nel DOM solo dopo che l'evento "done" ha finalizzato il messaggio.
      if (responseDetails?.audio) {
        this.pendingAudio = responseDetails.audio;
        return; // non restituisce nulla a Deep Chat
      }

      // ── STREAM END ───────────────────────────────────────────────────────────
      // Deep Chat emette un oggetto vuoto {} come segnale di fine stream
      const isDone = responseDetails?.done ||
                    (responseDetails && Object.keys(responseDetails).length === 0);
      if (isDone) {
        this.resetStreamState();

        if (this.pendingAudio) {
          const audio = this.pendingAudio;
          this.pendingAudio = null;
          this.ngZone.runOutsideAngular(() => {
            requestAnimationFrame(() => this.injectAudioIntoLastMessage(audio));
          });
        }
      }
    };
  }

  private setupOnMessage(el: any): void {
    el.onMessage = ({ message, isHistory }: any) => {
      if (!isHistory) { this.clearSilenceTimer(); this.removeLoadingMessage(); }
      if (isHistory) return;
      if (message.role !== 'ai') return;

      const html = message.html ?? '';
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');

      // Deep Chat converte ```chart in <code class="language-chart">
      const codeEl = doc.querySelector('code.language-chart');
      if (!codeEl) return;

      let cfg;
      try {
        cfg = JSON.parse(codeEl.textContent!.trim());
      } catch (e) {
        console.error('[chart] JSON non valido:', e);
        return;
      }
      this.ngZone.runOutsideAngular(() => this.injectChart(cfg));
    };
  }

  // ─── Audio ───────────────────────────────────────────────────────────────────

  /**
   * Inietta il player audio HTML5 nell'ultimo messaggio AI già renderizzato.
   * Viene chiamato dopo l'evento "done" tramite requestAnimationFrame,
   * quando il bubble è stabile e non verrà più sovrascritto da Deep Chat.
   */
  private injectAudioIntoLastMessage(audioBase64: string): void {
    const el = this.chat?.nativeElement;
    if (!el) return;

    // Invece di updateMessage (che usa indici instabili),
    // inietta direttamente nel DOM del shadow root
    const root = el.shadowRoot ?? document;
    const bubbles = root.querySelectorAll('.final-text');
    if (!bubbles.length) return;

    const last = bubbles[bubbles.length - 1] as HTMLElement;

    // Evita doppia iniezione
    if (last.querySelector('.ai-audio-player')) return;

    const audioDiv = document.createElement('div');
    audioDiv.className = 'ai-audio-player';
    audioDiv.innerHTML = `
      <audio controls autoplay style="width:100%;max-width:380px;height:36px;border-radius:8px;">
        <source src="data:audio/mp3;base64,${audioBase64}" type="audio/mp3">
      </audio>
    `;
    last.appendChild(audioDiv);
  }

  // ─── Chat management ─────────────────────────────────────────────────────────

  newChat(): void {
    const el = this.chat?.nativeElement;
    if (!el) return;
    this.toolResultsMap.clear();
    this.pendingAudio = null;
    this.clearSilenceTimer();
    this.removeLoadingMessage();
    el.clearMessages();
    this.setPlaceholder('Come posso aiutarti oggi?');
    this.focusAndAddInitialMessage();
  }

  private focusAndAddInitialMessage(): void {
    const el = this.chat?.nativeElement;
    if (!el) return;
    this.focusInput();
    this.injectModelSelect(el);
    setTimeout(() => {
      this.configurationService.getAIInitialMessage().subscribe((message: string) => {
        el.addMessage({ role: 'ai', text: message, sendUpdate: true });
      });
    }, 500);
  }

  // ─── Loading message ─────────────────────────────────────────────────────────

  private addLoadingMessage(): void {
    const el = this.chat?.nativeElement;
    if (!el) return;
    const messages = el.getMessages();
    this.loadingMessageIndex = messages.length;
    el.addMessage({
      role: 'ai',
      html: `<div style="display:flex; gap:5px; align-items:center; padding: 2px 0"><span class="dc-dot"></span><span class="dc-dot"></span><span class="dc-dot"></span></div>`,
      sendUpdate: false
    });
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

  // ─── Model select ────────────────────────────────────────────────────────────

  private async fetchModels(): Promise<void> {
    try {
      const response: any = await firstValueFrom(this.aiService.getAny(`/v1/models`));

      this.availableModels = response.models.map((m: any) => ({
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

  private injectModelSelect(el: any): void {
    const shadow = el.shadowRoot;
    if (!shadow) return;

    const inject = () => {
      if (shadow.querySelector('#model-selector-wrapper')) return;

      const textInputContainer = shadow.querySelector('#text-input-container');
      if (!textInputContainer) return;

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

    inject();
    const observer = new MutationObserver(() => inject());
    observer.observe(shadow, { childList: true, subtree: true });
  }

  // ─── Focus ───────────────────────────────────────────────────────────────────

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

  private setPlaceholder(text: string): void {
    const el = this.chat?.nativeElement;
    if (!el) return;
    const input = el.shadowRoot?.querySelector('#text-input') as HTMLElement;
    if (input) input.setAttribute('deep-chat-placeholder-text', text);
  }

  // ─── Export ──────────────────────────────────────────────────────────────────

  exportChat(format: 'txt' | 'json' | 'md' = 'md'): void {
    const el = this.chat?.nativeElement;
    if (!el) return;

    const messages: { role: string; text?: string; html?: string }[] = el.getMessages();
    if (!messages?.length) return;

    let content: string;
    let mimeType: string;
    let filename: string;
    const timestamp = new Date().toISOString().slice(0, 16).replace('T', '_').replace(':', '-');

    if (format === 'json') {
      content = JSON.stringify(messages, null, 2);
      mimeType = 'application/json';
      filename = `chat_${timestamp}.json`;

    } else if (format === 'txt') {
      content = messages.map(m => {
        const role = m.role === 'ai' ? 'Clara' : 'Tu';
        const text = m.text ?? this.htmlToPlainText(m.html ?? '');
        return `[${role}]\n${text}`;
      }).join('\n\n');
      mimeType = 'text/plain';
      filename = `chat_${timestamp}.txt`;

    } else {
      content = messages.map(m => {
        const role = m.role === 'ai' ? '🤖 **Clara**' : '👤 **Tu**';
        const text = m.text ?? this.htmlToPlainText(m.html ?? '');
        return `${role}\n\n${text}`;
      }).join('\n\n---\n\n');
      mimeType = 'text/markdown';
      filename = `chat_${timestamp}.md`;
    }

    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ─── Utils ───────────────────────────────────────────────────────────────────

  private htmlToPlainText(html: string): string {
    const div = document.createElement('div');
    div.innerHTML = html;
    return div.textContent ?? div.innerText ?? '';
  }

  private renderMarkdown(md: string): string {
    const raw = marked.parse(md, { gfm: true, breaks: true }) as string;
    return DOMPurify.sanitize(raw);
  }

  private resetStreamState(): void {
    this.aiBuffer = '';
    this.thinkingText = '';
    this.isStreaming = false;
    // pendingAudio NON viene resettato qui — serve ancora nel done handler
  }

  private waitForElement(id: string, timeout = 3000): Promise<Element> {
    return new Promise((resolve, reject) => {
      const el = document.getElementById(id);
      if (el) { resolve(el); return; }

      const observer = new MutationObserver(() => {
        const el = document.getElementById(id);
        if (el) { observer.disconnect(); resolve(el); }
      });

      observer.observe(document.body, { childList: true, subtree: true });
      setTimeout(() => { observer.disconnect(); reject(new Error(`Elemento #${id} non trovato`)); }, timeout);
    });
  }

  // ─── Chart ───────────────────────────────────────────────────────────────────

  async injectChart(cfg: any): Promise<void> {
    const chat = this.chat?.nativeElement;
    if (!chat) return;

    const root = chat.shadowRoot ?? document;
    const bubbles = root.querySelectorAll('.final-text');
    if (!bubbles.length) return;
    const last = bubbles[bubbles.length - 1];

    last.querySelector('code.language-chart')?.closest('pre')?.remove();

    const outer = document.createElement('div');
    outer.style.cssText = 'width:100%;margin-bottom:12px';

    if (cfg.title) {
      const titleEl = document.createElement('div');
      titleEl.textContent = cfg.title;
      titleEl.style.cssText = 'font-size:0.9rem;font-weight:600;color:#17324d;margin-bottom:6px;padding-left:4px';
      outer.appendChild(titleEl);
    }

    const wrap = document.createElement('div');
    wrap.style.cssText = 'width:100%;height:280px;border-radius:8px;overflow:hidden';
    outer.appendChild(wrap);
    last.prepend(outer);

    try {
      this.renderChart(wrap, cfg);
    } catch (e) {
      console.error('[chart] container non montato:', e);
    }
  }

  cleanChartBlock(bubble: any): void {
    const selectors = [
      '.deep-chat-message-text',
      '.deep-chat-ai-message-text',
      '[class*="message-text"]',
      'p', 'span'
    ];

    for (const sel of selectors) {
      const node = bubble.querySelector(sel);
      if (!node) continue;
      node.innerHTML = node.innerHTML
        .replace(/```chart[\s\S]*?```/g, '')
        .replace(/<code[^>]*>[\s\S]*?chart[\s\S]*?<\/code>/g, '')
        .trim();
      break;
    }
  }

  renderChart(wrap: HTMLElement, cfg: any): void {
    // Dispose previous instance on same element if any
    const existing = this.chartInstances.get(wrap);
    if (existing) { existing.dispose(); }

    const instance = echarts.init(wrap);
    this.chartInstances.set(wrap, instance);

    const option = cfg.type === 'pie' || cfg.type === 'donut'
      ? this.buildPieOption(cfg)
      : this.buildXYOption(cfg);

    instance.setOption(option);
  }

  private buildXYOption(cfg: any): echarts.EChartsOption {
    const seriesList = cfg.series ?? [{ name: cfg.title, data: cfg.data }];
    const categories = (cfg.data ?? cfg.series[0].data).map((d: any) => d.category);

    const series: any[] = seriesList.map((s: any) => {
      const isLine = cfg.type === 'line';
      return {
        name: s.name,
        type: isLine ? 'line' : 'bar',
        data: s.data.map((d: any) => d.value),
        ...(isLine ? {
          symbol: 'circle',
          symbolSize: 8,
          lineStyle: { width: 2 }
        } : {
          barMaxWidth: '70%',
          itemStyle: { borderRadius: [4, 4, 0, 0] }
        }),
        animationDuration: 1000
      };
    });

    return {
      toolbox: {
        feature: {
          saveAsImage: {
            title: 'Salva immagine',
            name: 'grafico'
          }
        }
      },
      tooltip: { trigger: 'axis' },
      legend: seriesList.length > 1 ? { bottom: 0 } : { show: false },
      grid: { left: '3%', right: '4%', bottom: seriesList.length > 1 ? '15%' : '5%', containLabel: true },
      xAxis: {
        type: 'category',
        data: categories,
        axisLabel: { rotate: categories.length > 6 ? 30 : 0 }
      },
      yAxis: { type: 'value' },
      series
    };
  }

  private buildPieOption(cfg: any): echarts.EChartsOption {
    return {
      toolbox: {
        feature: {
          saveAsImage: {
            title: 'Salva immagine',
            name: 'grafico'
          }
        }
      },
      tooltip: {
        trigger: 'item',
        formatter: '{b}: {c} ({d}%)'
      },
      legend: { orient: 'vertical', right: '5%', top: 'middle' },
      series: [
        {
          type: 'pie',
          radius: cfg.type === 'donut' ? ['40%', '70%'] : '65%',
          center: ['40%', '50%'],
          data: cfg.data.map((d: any) => ({ name: d.category, value: d.value })),
          label: { formatter: '{b}: {d}%' },
          animationDuration: 1000
        }
      ]
    };
  }
}