import { classify } from './data.js';
import { snapshotURL, validateSnapshot } from './snapshot.js';

// Questo è l'unico modulo che conosce il trasporto dei dati.
export function createDataSource({ mode = 'static', base = './', apiBase = '/api/v1/', fetcher = fetch } = {}) {
  if (!['static', 'api'].includes(mode)) throw new Error(`Sorgente dati sconosciuta: ${mode}`);
  const prefix = apiBase.replace(/\/*$/, '/');
  return {
    async get(kind, { committee, group = '', signal } = {}) {
      if (!['live', 'groups', 'calendar', 'standings'].includes(kind)) throw new Error('Tipo dati non valido');
      if (!/^\d+$/.test(committee) || (['calendar', 'standings'].includes(kind) && !/^\d+$/.test(group))) throw new Error('Comitato o girone non valido');
      const suffix = `${kind}${['calendar', 'standings'].includes(kind) ? `/${encodeURIComponent(group)}` : ''}`;
      const url = mode === 'static' ? snapshotURL(base, kind, committee, group) : `${prefix}committees/${encodeURIComponent(committee)}/${suffix}`;
      const response = await fetcher(url, { cache: 'no-store', credentials: 'omit', headers: { Accept: 'application/json' }, signal });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const record = await response.json();
      if (mode === 'static') return validateSnapshot(record, kind);
      if (!Number.isFinite(record?.at) || record.at <= 0 || classify(record.json) !== kind) throw new Error('Risposta API non valida');
      return { ...record, source: 'network' };
    },
  };
}
