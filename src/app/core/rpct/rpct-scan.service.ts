import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, switchMap } from 'rxjs/operators';
import { ConductorService } from '../conductor/conductor.service';
import { ConfigurationService } from '../configuration/configuration.service';
import { Workflow } from '../conductor/workflow.model';
import { environment } from '../../../environments/environment';

/**
 * Avvio scansione RPCT e stato del workflow (spec 003).
 * Fornito a livello di componente (providers), richiama ConductorService senza modificarlo.
 */
@Injectable()
export class RpctScanService {

  constructor(
    private httpClient: HttpClient,
    private conductorService: ConductorService,
    private configurationService: ConfigurationService
  ) {}

  /**
   * Avvia la scansione per la PA; restituisce il workflowId. Il backend autorizza su input.codice_ipa.
   * root_rule = quella delle scansioni automatiche (workflow.cron.body), altrimenti inputParamter
   * userebbe la regola predefinita 'amministrazione-trasparente' (risultati non confrontabili).
   */
  start(codiceIpa: string): Observable<string> {
    return this.configurationService.getWorkflowBody().pipe(
      catchError(() => of(null)),
      switchMap(body => this.conductorService.inputParamter(codiceIpa, body?.input?.root_rule)),
      switchMap(body => this.httpClient.post(
        `${environment.conductorApiUrl}/api/transparency/start`, body, { responseType: 'text' }
      ))
    );
  }

  /** Stato del workflow (GET /api/workflow/{id}?includeTasks=false); null se la chiamata fallisce. */
  status(workflowId: string): Observable<Workflow | null> {
    return this.conductorService.getById(workflowId, { includeTasks: false }, false, false).pipe(
      catchError(() => of(null))
    );
  }

  /** Il backend risponde 500 con "403 FORBIDDEN" nel message quando l'IPA non è autorizzato. */
  isForbidden(error: HttpErrorResponse): boolean {
    if (error?.status === 403) return true;
    const message = typeof error?.error === 'string' ? error.error : error?.error?.message;
    return error?.status === 500 && String(message || '').includes('403');
  }
}
