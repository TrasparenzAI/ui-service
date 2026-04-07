import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CapitalizeFirstPipe} from './pipes/capitalizefirst.pipe';
import { FirstLetterPipe } from './pipes/firstletter.pipe';
import { SafeHtmlPipe } from './pipes/safehtml.pipe';
import { DurationFormatPipe } from './pipes/durationFormat.pipe';
import { HighlightedTextPipe } from './pipes/highlighted-text.pipe';
import { MarkdownEditorComponent } from './template/markdown-editor.component';

@NgModule({
  imports: [
    MarkdownEditorComponent
  ],
  declarations: [
    // DropdownDirective
    CapitalizeFirstPipe,
    FirstLetterPipe,
    SafeHtmlPipe,
    DurationFormatPipe,
    HighlightedTextPipe
  ],
  exports: [
    CommonModule,
    // DropdownDirective
    CapitalizeFirstPipe,
    FirstLetterPipe,
    SafeHtmlPipe,
    DurationFormatPipe,
    HighlightedTextPipe,
    MarkdownEditorComponent
  ],
  providers: [
  ]
})
export class SharedModule {}
