/** Spec 008: una sezione della AT map (chiave ANAC → link). */
export interface RpctAtMapEntry {
  key: string;
  value: string;
  isLink: boolean;
}

/** Spec 008: AT map letta dal file (schema ANAC at_map v2.0, XML o JSON). */
export interface RpctParsedAtMap {
  lastModified: string | null;
  entries: RpctAtMapEntry[];
  error: string | null;
}

// Metadati del file, non sezioni
const LAST_MODIFIED_KEY = 'data_ultima_modifica';
const SCHEMA_KEY = '$schema';

function toEntry(key: string, value: unknown): RpctAtMapEntry {
  const text = String(value ?? '').trim();
  return { key, value: text, isLink: /^https?:\/\//i.test(text) };
}

/**
 * Come per l'XML, scende fino alle foglie: nello schema ANAC le sezioni stanno dentro un contenitore
 * (es. { "at_art2_bis_c1": { "personale": "https://..." } }, in XML map/at_art2_bis_c1), quindi leggere
 * solo il primo livello darebbe una riga "at_art2_bis_c1 | [object Object]".
 * Un array ripete la chiave del genitore per ogni elemento.
 */
function collectJsonLeaves(
  value: unknown,
  key: string,
  out: { lastModified: string | null; entries: RpctAtMapEntry[] }
): void {
  if (key === SCHEMA_KEY) return;
  if (Array.isArray(value)) {
    value.forEach(item => collectJsonLeaves(item, key, out));
    return;
  }
  if (value !== null && typeof value === 'object') {
    Object.entries(value as Record<string, unknown>)
      .forEach(([childKey, childValue]) => collectJsonLeaves(childValue, childKey, out));
    return;
  }
  if (key === LAST_MODIFIED_KEY) {
    out.lastModified = String(value ?? '').trim() || null;
  } else {
    out.entries.push(toEntry(key, value));
  }
}

function parseJson(content: string): RpctParsedAtMap {
  const data = JSON.parse(content);
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return { lastModified: null, entries: [], error: 'Contenuto JSON non riconosciuto.' };
  }
  const out: { lastModified: string | null; entries: RpctAtMapEntry[] } = { lastModified: null, entries: [] };
  collectJsonLeaves(data, '', out);
  return { lastModified: out.lastModified, entries: out.entries, error: null };
}

function parseXml(content: string, domParser: DOMParser): RpctParsedAtMap {
  const doc = domParser.parseFromString(content, 'application/xml');
  if (doc.getElementsByTagName('parsererror').length) {
    return { lastModified: null, entries: [], error: 'Contenuto XML non valido.' };
  }
  let lastModified: string | null = null;
  const entries: RpctAtMapEntry[] = [];
  // Tutti gli elementi foglia in ordine di documento: funziona per ogni contenitore di categoria
  // (amm_pubbliche, enti_societa_c2, enti_societa_c3, ordini_collegi).
  const all = doc.getElementsByTagName('*');
  for (let i = 0; i < all.length; i++) {
    const element = all[i];
    if (element.getElementsByTagName('*').length > 0) continue;
    const key = element.localName || element.nodeName;
    if (key === LAST_MODIFIED_KEY) {
      lastModified = (element.textContent || '').trim() || null;
    } else {
      entries.push(toEntry(key, element.textContent));
    }
  }
  return { lastModified, entries, error: null };
}

/**
 * Spec 008: trasforma il file AT map in righe "chiave | link".
 * format: 'XML' | 'JSON' dal result-service; se manca, '<' iniziale = XML.
 * domParser iniettabile per la verifica fuori dal browser.
 */
export function parseAtMapContent(
  content: string | null | undefined,
  format?: string | null,
  domParser?: DOMParser
): RpctParsedAtMap {
  const text = (content || '').replace(/^﻿/, '').trim();
  if (!text) {
    return { lastModified: null, entries: [], error: 'File AT map vuoto.' };
  }
  const isXml = format ? format.toUpperCase() === 'XML' : text.startsWith('<');
  try {
    const parsed = isXml ? parseXml(text, domParser || new DOMParser()) : parseJson(text);
    if (!parsed.error && parsed.entries.length === 0) {
      return { ...parsed, error: 'Nessuna sezione trovata nel file AT map.' };
    }
    return parsed;
  } catch {
    return { lastModified: null, entries: [], error: `Impossibile leggere il file AT map (${isXml ? 'XML' : 'JSON'}).` };
  }
}