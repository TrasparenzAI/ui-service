import {Component, Input} from '@angular/core';

@Component({
    selector: 'app-show-list-text',
    template: `
    @if (value) {
      <li itListItem>
        @if (url) {
          <app-show-url [label]="label" [value]="value"></app-show-url>
        }
        @if (!url) {
          <app-show-text [label]="label" [value]="value"></app-show-text>
        }
      </li>
    }
    `,
    standalone: false
})
export class ShowListTextComponent {

  @Input() label!: string;
  @Input() url: boolean = false;
  @Input() value!: string;
  @Input() strong = true;
}
