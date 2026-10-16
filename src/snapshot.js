import { classify } from './data.js';

export function snapshotURL(base, kind, committee, group) {
  return `${base}data/${encodeURIComponent(committee)}/${kind}${['calendar', 'standings'].includes(kind) ? `-${encodeURIComponent(group)}` : ''}.json`;
}

export function validateSnapshot(record, kind) {
  if (record?.source !== 'snapshot' || !Number.isFinite(record.at) || record.at <= 0 || classify(record.json) !== kind) {
    throw new Error('Snapshot non valido');
  }
  return record;
}
