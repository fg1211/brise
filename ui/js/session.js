/* Kleine Brücke zwischen Einstellungen und API-Modul, ohne Kreisimporte. */

let current = { country: 'DE', language: 'de', provider: 'dwd' };

export function setSession(next) {
  current = { ...current, ...next };
}

export function session() {
  return current;
}
