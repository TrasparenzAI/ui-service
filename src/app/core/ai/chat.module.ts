import { NgModule, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { ChatComponent } from './chat.component';
import { DesignAngularKitModule } from 'design-angular-kit';

@NgModule({
  declarations: [ChatComponent],
  imports: [
    BrowserModule,
    DesignAngularKitModule.forRoot(),
  ],
  schemas: [CUSTOM_ELEMENTS_SCHEMA]   // 👈 aggiungi questo
})
export class ChatModule {}