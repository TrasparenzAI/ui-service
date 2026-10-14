import { RoleEnum } from '../../auth/role.enum';

/** Ruoli con accesso alle pagine generali: Home e risultati per scansione di qualsiasi ente. */
const GENERAL_ACCESS_ROLES: string[] = [RoleEnum.ADMIN, RoleEnum.SUPERUSER, RoleEnum.ROLE_USER];

/**
 * Spec 010 (F3): codici IPA autorizzati dal claim rpct_ipas, come lista di codici esatti senza duplicati.
 * Qualsiasi forma diversa da un array di stringhe (es. stringa singola) vale "nessun ente":
 * evita confronti per sottostringa e errori sulla lista.
 */
export function rpctIpas(userData: any): string[] {
  const claim = userData?.rpct_ipas;
  if (!Array.isArray(claim)) return [];
  const codes = claim
    .filter((code: unknown): code is string => typeof code === 'string')
    .map(code => code.trim())
    .filter(code => code.length > 0);
  return [...new Set(codes)];
}

/** True se l'utente ha il ruolo RPCT e nessuno dei ruoli con accesso generale. */
export function isOnlyRpct(userData: any): boolean {
  const roles: string[] = userData?.realm_access?.roles || [];
  if (!roles.includes(RoleEnum.RPCT)) {
    return false;
  }
  for (const role of GENERAL_ACCESS_ROLES) {
    if (roles.includes(role)) {
      return false;
    }
  }
  return true;
}

/**
 * True se l'utente autenticato può leggere i risultati per scansione dell'ente indicato.
 * Senza utente si usano i dati pubblici; un utente con il solo ruolo RPCT legge solo gli enti in rpct_ipas.
 */
export function canReadScanResults(userData: any, codiceIpa: string): boolean {
  if (!userData) {
    return false;
  }
  if (!isOnlyRpct(userData)) {
    return true;
  }
  return rpctIpas(userData).includes(codiceIpa);
}
