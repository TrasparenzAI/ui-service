import { NgModule, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { ChatComponent } from './chat.component';
import { DesignAngularKitModule } from 'design-angular-kit';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { AIService } from './ai.service';

@NgModule({
  declarations: [ChatComponent],
  providers: [
    AIService
  ],
  imports: [
    BrowserModule,
    FormsModule,        
    ReactiveFormsModule,
    DesignAngularKitModule.forRoot(),
  ],
  schemas: [CUSTOM_ELEMENTS_SCHEMA]   // 👈 aggiungi questo
})
export class ChatModule {}