import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { ConductorService } from '../conductor/conductor.service';
import { Workflow } from '../conductor/workflow.model';
import { environment } from '../../../environments/environment';

/** Spec 009/010: esito di un avvio rifiutato. */
export interface RpctStartError {
  message: string;
  // 409: scansione della PA già in corso
  alreadyRunning: boolean;
  // Spec 010 (F5): 401 = sessione scaduta, serve un nuovo accesso
  sessionExpired: boolean;
}

/**
 * Avvio scansione RPCT (spec 009, task-scheduler) e stato del workflow (spec 003).
 * Fornito a livello di componente (providers), richiama ConductorService senza modificarlo.
 */
@Injectable()
export class RpctScanService {

  constructor(
    private httpClient: HttpClient,
    private conductorService: ConductorService
  ) {}

  /**
   * Avvia la scansione per la PA; restituisce il workflowId (spec 010 F9: senza spazi, '' se assente).
   * Il task-scheduler verifica ruolo e rpct_ipas e costruisce la richiesta dalla configurazione (root_rule compresa).
   */
  start(codiceIpa: string): Observable<string> {
    return this.httpClient.post(
      `${environment.taskSchedulerApiUrl}/v1/scans/${encodeURIComponent(codiceIpa)}`, null, { responseType: 'text' }
    ).pipe(map(workflowId => (workflowId || '').trim()));
  }

  /** Stato del workflow (GET /api/workflow/{id}?includeTasks=false); null se la chiamata fallisce. */
  status(workflowId: string): Observable<Workflow | null> {
    return this.conductorService.getById(workflowId, { includeTasks: false }, false, false).pipe(
      catchError(() => of(null))
    );
  }

  /**
   * Spec 009: messaggio per il rifiuto dell'avvio.
   * Spec 010 (F5): status assente o 0 = richiesta non arrivata al server; authenticated dice se la sessione è ancora valida.
   */
  startErrorMessage(error: HttpErrorResponse, codiceIpa: string, authenticated = true): RpctStartError {
    const result = (message: string, alreadyRunning = false, sessionExpired = false) => ({ message, alreadyRunning, sessionExpired });
    switch (error?.status) {
      case 409: return result(`È già in corso una scansione per ${codiceIpa}.`, true);
      case 403: return result(`Non sei autorizzato ad avviare una scansione per ${codiceIpa}.`);
      case 401: return result('Sessione scaduta: effettua di nuovo l\'accesso.', false, true);
      case 400: return result('Codice IPA non valido.');
      case 0:
      case undefined:
      case null:
        return authenticated
          ? result('Servizio di avvio non raggiungibile: riprova più tardi.')
          : result('Sessione scaduta: effettua di nuovo l\'accesso.', false, true);
      default: return result(`Impossibile avviare la scansione (errore ${error.status}).`);
    }
  }
}
