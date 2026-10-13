import { Status } from '../conductor/workflow.model';

/** Spec 005: true solo per le scansioni in corso. */
export function isRunningStatus(status: string | null | undefined): boolean {
  return status === Status.RUNNING;
}

/** Spec 011: etichetta dello stato con la dicitura del design ("Completata", "In corso"). */
export function rpctStateLabel(status: string | null | undefined): string {
  switch (status) {
    case Status.COMPLETED: return 'Completata';
    case Status.RUNNING: return 'In corso';
    case Status.FAILED: return 'Fallita';
    case Status.TERMINATED: return 'Interrotta';
    case Status.PAUSED: return 'In pausa';
    default: return status || '—';
  }
}

/** Spec 011: colore del testo di stato nello storico. */
export function rpctStateClass(status: string | null | undefined): string {
  switch (status) {
    case Status.COMPLETED: return 'text-success';
    case Status.FAILED:
    case Status.TERMINATED: return 'text-danger';
    case Status.PAUSED: return 'text-warning';
    default: return 'text-secondary';
  }
}
