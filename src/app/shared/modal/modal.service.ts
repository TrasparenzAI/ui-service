import { ApplicationRef, ComponentRef, EnvironmentInjector, Injectable, createComponent } from '@angular/core';
import { ReusableModalComponent } from './reusable-modal.component';

@Injectable({ providedIn: 'root' })
export class ModalService {
  private modalRef?: ComponentRef<ReusableModalComponent>;

  constructor(
    private appRef: ApplicationRef,
    private injector: EnvironmentInjector
  ) {}

  open(options: { title?: string; message?: string; onConfirm?: () => void; onClose?: () => void }) {
    if (this.modalRef) {
      this.close(); // chiudi eventuale modal aperto
    }

    // crea dinamicamente il componente
    this.modalRef = createComponent(ReusableModalComponent, {
      environmentInjector: this.injector
    });

    // assegna le proprietà
    if (options.title) this.modalRef.instance.title = options.title;
    if (options.message) this.modalRef.instance.message = options.message;

    // gestisci eventi
    this.modalRef.instance.closed.subscribe(() => {
      options.onClose?.();
      this.close();
    });

    this.modalRef.instance.confirmed.subscribe(() => {
      options.onConfirm?.();
      this.close();
    });

    // monta nel DOM
    this.appRef.attachView(this.modalRef.hostView);
    document.body.appendChild(this.modalRef.location.nativeElement);
  }

  close() {
    if (this.modalRef) {
      this.appRef.detachView(this.modalRef.hostView);
      this.modalRef.destroy();
      this.modalRef = undefined;
    }
  }
}
