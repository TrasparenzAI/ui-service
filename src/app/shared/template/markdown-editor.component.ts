import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
import {
  Component,
  OnDestroy,
  AfterViewInit,
  ElementRef,
  ViewChild,
  forwardRef,
  Input,
  NgZone,
  OnChanges,
  SimpleChanges,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

// npm install easymde marked highlight.js
// npm install --save-dev @types/marked @types/highlight.js
declare const EasyMDE: any;
declare const marked: any;
declare const hljs: any;

@Component({
  selector: 'app-markdown-editor',
  standalone: true,
  template: `
    <div class="mde-wrapper">
      <textarea #editorEl></textarea>
    </div>
  `,
  styleUrl: './markdown-editor.component.scss',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => MarkdownEditorComponent),
      multi: true,
    },
  ],
})
export class MarkdownEditorComponent
  implements ControlValueAccessor, AfterViewInit, OnDestroy, OnChanges
{
  @ViewChild('editorEl') editorEl!: ElementRef<HTMLTextAreaElement>;

  /** Placeholder del textarea */
  @Input() placeholder = 'Scrivi qui il tuo markdown…';

  /** Altezza minima dell'area editor (px) */
  @Input() minHeight = 300;

  /** Altezza massima dell'area editor (px). null = nessun limite */
  @Input() maxHeight: number | null = null;

  /**
   * Passa `true` quando il pannello/accordion che contiene l'editor
   * diventa visibile. EasyMDE viene inizializzato solo in quel momento,
   * evitando il layout a zero-dimensioni causato da display:none.
   *
   * Nel template del padre:
   *   [visible]="accordionAiIsOpen"
   * e nel TS del padre impostare accordionAiIsOpen = true
   * nella callback (showEvent) dell'accordion.
   */
  @Input() visible = false;

  private easyMde: any = null;
  private _value = '';
  private _disabled = false;
  private _suppressChange = false;

  // CVA callbacks
  private onChange: (v: string) => void = () => {};
  private onTouched: () => void = () => {};

  constructor(
    private ngZone: NgZone,     
    private responsive: BreakpointObserver,
  ) {}

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  ngAfterViewInit(): void {
    // Se visible è già true al momento del rendering (accordion aperto
    // di default o componente non dentro un accordion) inizializziamo subito.
    if (this.visible) {
      this.initEditor();
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['visible'] && changes['visible'].currentValue === true) {
      if (!this.easyMde && this.editorEl) {
        // Il pannello è appena diventato visibile: inizializza ora
        this.initEditor();
      } else if (this.easyMde) {
        // L'editor c'è già: forza il refresh del layout di CodeMirror
        // (necessario se il pannello era nascosto e ora è visibile)
        this.ngZone.runOutsideAngular(() => {
          this.easyMde.codemirror.refresh();
        });
      }
    }
  }

  ngOnDestroy(): void {
    if (this.easyMde) {
      this.easyMde.toTextArea();
      this.easyMde = null;
    }
  }

  // ── Init EasyMDE ──────────────────────────────────────────────────────────

  private initEditor(): void {
    this.ngZone.runOutsideAngular(() => {
      this.easyMde = new EasyMDE({
        element: this.editorEl.nativeElement,
        placeholder: this.placeholder,
        spellChecker: false,
        autofocus: false,
        status: ['lines', 'words', 'cursor'],
        minHeight: `${this.minHeight}px`,
        maxHeight: `${this.maxHeight}px`,
        sideBySideFullscreen: false,

        previewRender: (plainText: string) => {
          return marked.parse(plainText, {
            highlight: (code: string, lang: string) => {
              if (lang && hljs.getLanguage(lang)) {
                return hljs.highlight(code, { language: lang }).value;
              }
              return hljs.highlightAuto(code).value;
            },
          });
        },

        toolbar: [
          'bold', 'italic', 'strikethrough', '|',
          'heading-1', 'heading-2', 'heading-3', '|',
          'unordered-list', 'ordered-list', '|',
          'code', 'link', 'image', '|',
          'quote', 'horizontal-rule', '|',
          'preview', 'side-by-side', 'fullscreen', '|',
          'guide',
        ],
      });

      // Applica il valore bufferizzato da writeValue (arrivato prima dell'init)
      // PRIMA di attaccare il listener 'change' per non sporcare il form.
      if (this._value) {
        this.easyMde.value(this._value);
      }

      // Attiva la modalità split-pane
      this.responsive.observe([Breakpoints.Small, Breakpoints.XSmall]).subscribe(result => {
        if (!result.matches) {
          EasyMDE.toggleSideBySide(this.easyMde);
        }
      });


      // Sincronizza verso Angular
      this.easyMde.codemirror.on('change', () => {
        if (this._suppressChange) return;
        const val = this.easyMde.value();
        this._value = val;
        this.ngZone.run(() => this.onChange(val));
      });

      this.easyMde.codemirror.on('blur', () => {
        this.ngZone.run(() => this.onTouched());
      });

      if (this._disabled) {
        this.easyMde.codemirror.setOption('readOnly', 'nocursor');
      }
    });
  }

  // ── ControlValueAccessor ──────────────────────────────────────────────────

  writeValue(value: string | null): void {
    this._value = value ?? '';

    if (!this.easyMde) {
      // EasyMDE non ancora pronto: _value verrà applicato in initEditor()
      return;
    }

    if (this.easyMde.value() !== this._value) {
      this._suppressChange = true;
      this.easyMde.value(this._value);
      this._suppressChange = false;
    }
  }

  registerOnChange(fn: (v: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this._disabled = isDisabled;
    if (this.easyMde) {
      this.easyMde.codemirror.setOption('readOnly', isDisabled ? 'nocursor' : false);
      // Scopo il selettore al wrapper del componente per non colpire
      // altre toolbar nella pagina
      const wrapper = (this.editorEl.nativeElement as HTMLElement)
        .closest('.EasyMDEContainer')
        ?.querySelector('.editor-toolbar') as HTMLElement | null;
      if (wrapper) {
        wrapper.style.pointerEvents = isDisabled ? 'none' : 'auto';
        wrapper.style.opacity = isDisabled ? '0.5' : '1';
      }
    }
  }

  // ── API pubblica ──────────────────────────────────────────────────────────

  getHtml(): string {
    return this.easyMde ? this.easyMde.options.previewRender(this._value) : '';
  }

  clear(): void {
    this.writeValue('');
    this.onChange('');
  }
}