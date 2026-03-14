import { AfterViewInit, Component, ElementRef, NgZone, OnInit, ViewChild } from '@angular/core';
import { OidcSecurityService } from 'angular-auth-oidc-client';
import { environment } from '../../../environments/environment';

import 'deep-chat';

@Component({
  selector: 'app-chat',
  template: `
    <div class="container">
      <div class="d-flex">
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
            class="d-flex w-100 mt-2 shadow rounded border-primary">
        </deep-chat>
      </div>
    </div>
  `,
  standalone: false
})
export class ChatComponent implements OnInit, AfterViewInit {
  protected requestConfig: any;
  protected streamConfig = { simulation: false };

  private silenceTimer: any = null;
  private readonly SILENCE_THRESHOLD = 300;
  private loadingMessageIndex = -1;

  @ViewChild('chat') private chat?: ElementRef;

  constructor(
    private oidcSecurityService: OidcSecurityService,
    private ngZone: NgZone
  ) {}

  avatars = { ai: { src: '/assets/images/ai.png' } };

  auxiliaryStyle = `
    .dc-dot {
      display: inline-block;
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: #aaa;
      animation: dc-bounce 1.2s ease-in-out infinite;
    }
    .dc-dot:nth-child(2) { animation-delay: 0.2s; }
    .dc-dot:nth-child(3) { animation-delay: 0.4s; }
    @keyframes dc-bounce {
      0%, 80%, 100% { transform: translateY(0); opacity: 0.4; }
      40%            { transform: translateY(-5px); opacity: 1; }
    }
  `;

  customButtons = [
    {
      position: 'inside-start',
      styles: {
        button: {
          default: {
            container: {
              default: {
                border: '1px solid #e2e2e2',
                borderRadius: '10px',
              },
            },
            svg: {
              content: `
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="-0.5 0 25 25" fill="none">
                  <path d="M12 22.3201C17.5228 22.3201 22 17.8429 22 12.3201C22 6.79722 17.5228 2.32007 12 2.32007C6.47715 2.32007 2 6.79722 2 12.3201C2 17.8429 6.47715 22.3201 12 22.3201Z" stroke="#000000" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                  <line x1="12" y1="7.32007" x2="12" y2="17.3201" stroke="#000000" stroke-width="1.5" stroke-linecap="round"/>
                  <line x1="7" y1="12.3201" x2="17" y2="12.3201" stroke="#000000" stroke-width="1.5" stroke-linecap="round"/>
                </svg>
              `,
            },
            text: { content: 'Nuova chat' },
          },
        },
      },
      onClick: () => this.newChat(),
    },
  ];

  textInputConfig = {
    placeholder: { text: 'Benvenuto! Sono Chiara, l\'assistente virtuale di TrasparenzAI' },
    styles: {
      container: { paddingBottom: '30px' },
      text: { padding: '0.5rem 0.7rem' },
    },
  };

  ngOnInit() {
    this.requestConfig = {
      url: `${environment.apiUrl}/ai-integration-service/v1/chat/stream`,
      method: 'POST',
      stream: true,
      headers: { 'Content-Type': 'application/json' },
    };

    setTimeout(() => {
      const el = this.chat?.nativeElement;
      if (!el) return;

      el.requestInterceptor = async (requestDetails: any) => {
        // reset completo ad ogni nuova richiesta
        this.clearSilenceTimer();
        this.removeLoadingMessage();

        const token = await this.oidcSecurityService.getAccessToken().toPromise();
        requestDetails.headers = {
          ...requestDetails.headers,
          Authorization: `Bearer ${token}`,
        };
        return requestDetails;
      };

      el.responseInterceptor = (responseDetails: any) => {
        const text = responseDetails?.text ?? '';

        if (text) {
          // arriva un chunk: resetta il timer e rimuovi eventuale loading
          this.clearSilenceTimer();
          this.removeLoadingMessage();

          // se non arriva nulla per SILENCE_THRESHOLD ms → mostra loading
          this.silenceTimer = setTimeout(() => {
            this.addLoadingMessage();
          }, this.SILENCE_THRESHOLD);
        }

        return responseDetails;
      };

      el.onMessage = ({ isHistory }: { message: any; isHistory: boolean }) => {
        if (!isHistory) {
          // stream chiuso definitivamente: rimuovi loading e reset
          this.clearSilenceTimer();
          this.removeLoadingMessage();
        }
      };
    });
  }

  ngAfterViewInit(): void {
    const el = this.chat?.nativeElement;
    if (!el) return;

    el.onComponentRender = () => {
      this.focusInput();
    };
  }

  newChat() {
    const el = this.chat?.nativeElement;
    if (!el) return;

    this.clearSilenceTimer();
    this.removeLoadingMessage();
    el.clearMessages();

    el.onComponentRender = () => {
      this.focusInput();
    };
  }

  // ─── private ────────────────────────────────────────────────

  private addLoadingMessage(): void {
    const el = this.chat?.nativeElement;
    if (!el) return;

    const messages = el.getMessages();
    this.loadingMessageIndex = messages.length;

    el.addMessage({
      role: 'ai',
      html: `
        <div style="display:flex; gap:5px; align-items:center; padding: 2px 0">
          <span class="dc-dot"></span>
          <span class="dc-dot"></span>
          <span class="dc-dot"></span>
        </div>
      `,
      sendUpdate: false,
    });
  }

  private removeLoadingMessage(): void {
    const el = this.chat?.nativeElement;
    if (!el || this.loadingMessageIndex < 0) return;

    el.updateMessage(
      { html: '', sendUpdate: false },
      this.loadingMessageIndex
    );
    this.loadingMessageIndex = -1;
  }

  private clearSilenceTimer(): void {
    if (this.silenceTimer) {
      clearTimeout(this.silenceTimer);
      this.silenceTimer = null;
    }
  }

  private focusInput(): void {
    const el = this.chat?.nativeElement;
    if (!el) return;

    this.ngZone.runOutsideAngular(() => {
      const doFocus = () => {
        const input = el.shadowRoot
          ?.querySelector('#text-input[contenteditable]') as HTMLElement;
        input?.focus();
      };

      if ('requestIdleCallback' in window) {
        requestIdleCallback(() => requestAnimationFrame(doFocus));
      } else {
        setTimeout(doFocus, 500); // fallback Safari
      }
    });
  }
}