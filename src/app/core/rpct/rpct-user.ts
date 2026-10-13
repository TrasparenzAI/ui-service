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
