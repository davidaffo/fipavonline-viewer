import { scheduleMatches } from './schedule.js';
import { payload } from './data.js';

// Usa lo stesso trasporto statico/API delle viste. Nessun accesso diretto a FIPAV.
export async function loadExportRecords({ source, committees, cached = [], signal, progress = () => {} }) {
  const records = [], issues = [];
  const get = async (kind, committee, group = '') => {
    signal?.throwIfAborted();
    try {
      const record = await source.get(kind, { committee, group, signal });
      return { ...record, committee, kind, group };
    } catch (error) {
      signal?.throwIfAborted();
      const fallback = cached.find(record => record.committee === committee && record.kind === kind && String(record.group || '') === group);
      if (kind !== 'live') issues.push(`${committee}/${kind}${group ? `/${group}` : ''}${fallback ? ' (copia salvata)' : ' (non disponibile)'}`);
      return fallback;
    }
  };
  for (const committee of committees) {
    progress(`Caricamento ${committee.title}…`);
    const groups = await get('groups', committee.id);
    if (groups) records.push(groups);
    const ids = new Set((groups?.json?.data || []).map(group => String(group.id)));
    // Conserva anche i calendari importati o salvati se l'elenco gironi non è disponibile.
    for (const record of cached) if (record.committee === committee.id && record.kind === 'calendar' && record.group) ids.add(String(record.group));
    let index = 0, completed = 0;
    const list = [...ids];
    await Promise.all(Array.from({ length: Math.min(4, list.length) }, async () => {
      while (index < list.length) {
        const record = await get('calendar', committee.id, list[index++]);
        if (record) records.push(record);
        progress(`${committee.title}: ${++completed}/${list.length} calendari`);
      }
    }));
    const live = await get('live', committee.id);
    if (live) records.push(live);
  }
  signal?.throwIfAborted();
  return { records, issues, games: scheduleMatches(records) };
}

export function exportGroupMetadata(records) {
  const groups = new Map();
  for (const record of records) {
    const data = payload(record.json);
    const list = Array.isArray(record.json?.data) ? record.json.data : data?.championship || (data?.id ? [data] : []);
    for (const group of list) {
      const key = `${record.committee}:${group.id}`;
      groups.set(key, { ...groups.get(key), ...group });
    }
  }
  return groups;
}
