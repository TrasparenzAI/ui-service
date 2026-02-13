import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { OidcSecurityService } from 'angular-auth-oidc-client';
import { environment } from '../../../environments/environment';

import 'deep-chat';
@Component({
  selector: 'app-chat',
  template: `
    <div class="container">
      <div class="d-flex">
        <div class="col-md-1">
          <button itButton="outline-primary" class="btn mt-2 me-1 px-3" (click)="newChat()">
            <it-icon color="primary" size="lg" name="pencil"></it-icon>
            <span class="d-none d-xl-block" translate>Nuova Chat</span>
          </button>
        </div>
        <div class="col-md-11">
          <deep-chat
              #chat
              avatars="true"
              [request]="requestConfig"
              [stream]="streamConfig"
              textInput='{"placeholder":{"text": "Benvenuto nella chat di TrasparenzAI ... come posso aiutarti oggi?"}}'
              requestBodyLimits='{
                "maxMessages": 200
              }'
              style="height: 60vh"
              class="d-flex w-100 mt-2 shadow rounded border-primary">
          </deep-chat>
        </div>  
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
