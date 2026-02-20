import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'app-reusable-modal',
  template: `
  <div class="modal fade show d-block" tabindex="-1" role="dialog">
    <div class="modal-dialog modal-md" role="document">
      <div class="modal-content">
        <div class="modal-header">
          <h5 class="modal-title">{{ title }}</h5>
          <button type="button" class="btn-close" aria-label="Chiudi" (click)="close()"></button>
        </div>
        <div class="modal-body">
          <ng-content></ng-content>
          <p>{{ message }}</p>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-outline-secondary" (click)="close()">Chiudi</button>
          <button type="button" class="btn btn-primary" (click)="confirm()">Conferma</button>
        </div>
      </div>
    </div>
  </div>
  `
})
export class ReusableModalComponent {
  @Input() title: string = 'Titolo';
  @Input() message: string = '';
  @Output() closed = new EventEmitter<void>();
  @Output() confirmed = new EventEmitter<void>();

  close() {
    this.closed.emit();
  }

  confirm() {
    this.confirmed.emit();
  }
}
