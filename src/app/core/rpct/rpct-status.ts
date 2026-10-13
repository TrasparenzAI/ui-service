import { TranslateService } from '@ngx-translate/core';
import { Status } from '../conductor/workflow.model';

/** Spec 005: classe Bootstrap Italia (verde chiaro) per le righe delle scansioni in corso. */
export const RPCT_RUNNING_ROW_CLASS = 'table-success';

/** Spec 005: true solo per le scansioni in corso. */
export function isRunningStatus(status: string | null | undefined): boolean {
  return status === Status.RUNNING;
}

/**
 * Spec 005: etichetta dello stato con le traduzioni esistenti dei colleghi (it.workflow.status.*).
 * Se la chiave manca (es. TIMED_OUT) instant() restituisce la chiave stessa: si mostra il codice.
 */
export function rpctStatusLabel(translate: TranslateService, status: string | null | undefined): string {
  if (!status) return '';
  const key = `it.workflow.status.${status}`;
  const label = translate.instant(key);
  return label && label !== key ? label : status;
}
