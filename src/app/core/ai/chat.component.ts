import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
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
            avatars="true"
            [request]="requestConfig"
            [stream]="streamConfig"
            [textInput]="textInputConfig"
            [customButtons]="customButtons"
            requestBodyLimits='{
              "maxMessages": 200
            }'
            style="height: 60vh; width: 100%"
            class="d-flex w-100 mt-2 shadow rounded border-primary">
        </deep-chat>
    </div>
  `,
  standalone: false
})
export class ChatComponent implements OnInit {
  protected requestConfig: any;
  protected streamConfig = {
    simulation: false
  };
  @ViewChild("chat") private chat?: ElementRef;

  constructor(private oidcSecurityService: OidcSecurityService) {}

  customButtons = [
      {
        position: 'inside-left', // oppure 'outside-right', 'inside-left', 'inside-right'
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
              text: {
                content: 'Nuova chat',
              },
            },
          },
        },        
        onClick: () => this.newChat()
      }
    ];
  textInputConfig = {
    placeholder: { text: 'Benvenuto nella chat di TrasparenzAI ... come posso aiutarti oggi?' },
    styles: {
        container: {
          paddingBottom: '30px',
        },
        text: {
          padding: '0.5rem 0.7rem',
        },
    },
  };
  ngOnInit() {
    this.requestConfig = {
      url: `${environment.apiUrl}/ai-integration-service/v1/chat/stream`,
      method: 'POST',
      stream: true,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    // Aggiungi l'interceptor dopo l'inizializzazione
    setTimeout(() => {
      if (this.chat?.nativeElement) {
        this.chat.nativeElement.requestInterceptor = async (requestDetails: any) => {
          const token = await this.oidcSecurityService.getAccessToken().toPromise();
          requestDetails.headers = {
            ...requestDetails.headers,
            'Authorization': `Bearer ${token}`
          };
          return requestDetails;
        };
      }
    });
  }

  newChat() {
    this.chat?.nativeElement?.clearMessages();
  }
  
}
