import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { ConductorService } from '../conductor/conductor.service';
import { Workflow } from '../conductor/workflow.model';
import { environment } from '../../../environments/environment';

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
   * Avvia la scansione per la PA; restituisce il workflowId.
   * Il task-scheduler verifica ruolo e rpct_ipas e costruisce la richiesta dalla configurazione (root_rule compresa).
   */
  start(codiceIpa: string): Observable<string> {
    return this.httpClient.post(
      `${environment.taskSchedulerApiUrl}/v1/scans/${encodeURIComponent(codiceIpa)}`, null, { responseType: 'text' }
    );
  }

  /** Stato del workflow (GET /api/workflow/{id}?includeTasks=false); null se la chiamata fallisce. */
  status(workflowId: string): Observable<Workflow | null> {
    return this.conductorService.getById(workflowId, { includeTasks: false }, false, false).pipe(
      catchError(() => of(null))
    );
  }

  /** Spec 009: messaggio per il rifiuto dell'avvio; alreadyRunning = 409 (scansione della PA già in corso). */
  startErrorMessage(error: HttpErrorResponse, codiceIpa: string): { message: string; alreadyRunning: boolean } {
    switch (error?.status) {
      case 409: return { message: `È già in corso una scansione per ${codiceIpa}.`, alreadyRunning: true };
      case 403: return { message: `Non sei autorizzato ad avviare una scansione per ${codiceIpa}.`, alreadyRunning: false };
      case 401: return { message: 'Sessione scaduta: effettua di nuovo l\'accesso.', alreadyRunning: false };
      case 400: return { message: 'Codice IPA non valido.', alreadyRunning: false };
      default: return { message: `Impossibile avviare la scansione (errore ${error?.status ?? 'sconosciuto'}).`, alreadyRunning: false };
    }
  }
}
