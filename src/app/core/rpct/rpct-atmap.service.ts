import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

/** Spec 008: AT map registrata dal result-service per una PA (AtMapContentShowDto, v0.3.6). */
export interface RpctAtMap {
  id: number;
  idIpa: number | null;
  codiceIpa: string;
  workflowId: string | null;
  url: string | null;
  found: boolean;
  status: number | null;
  format: 'XML' | 'JSON' | null;
  discoveredBy: 'ROBOTS_TXT' | 'WELL_KNOWN_URL' | null;
  valid: boolean | null;
  errorMessage: string | null;
  content: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export type RpctAtMapStatus = 'present' | 'absent' | 'unavailable';

export interface RpctAtMapState {
  state: RpctAtMapStatus;
  atMap: RpctAtMap | null;
}

/**
 * Spec 008: ultima AT map della PA (solo scansioni completate).
 * Qualsiasi errore (servizio non ancora pubblicato, nessuna AT map, rete) = 'unavailable', senza messaggi.
 * Fornito a livello di componente (providers).
 */
@Injectable()
export class RpctAtmapService {

  constructor(private httpClient: HttpClient) {}

  last(codiceIpa: string): Observable<RpctAtMapState> {
    const params = new HttpParams().set('codiceIpa', codiceIpa);
    return this.httpClient.get<RpctAtMap>(`${environment.resultApiUrl}/v1/atmaps/codiceipa/last`, { params }).pipe(
      map(atMap => atMap
        ? { state: (atMap.found ? 'present' : 'absent') as RpctAtMapStatus, atMap }
        : { state: 'unavailable' as RpctAtMapStatus, atMap: null }),
      catchError(() => of({ state: 'unavailable' as RpctAtMapStatus, atMap: null }))
    );
  }
}
