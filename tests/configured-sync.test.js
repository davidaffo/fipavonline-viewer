import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { configuredCommittees, syncConfigured } from '../scripts/sync-configured.mjs';
import { syncCommittee } from '../scripts/sync-fipav.mjs';
const available = [{ id: '03008', title: 'Centro', region: 'Liguria' }, { id: '03011', title: 'Ponente', region: 'Liguria' }, { id: '04000', title: 'Lombardia', region: 'Lombardia' }];

test('configurazione regioni/comitati: unione senza duplicati e validazione', () => {
 assert.deepEqual(configuredCommittees({ committees: ['03008'], regions: ['Liguria'] }, available).map(c => c.id), ['03008', '03011']);
 for (const config of [{ committees: [], regions: [] }, { committees: [3008], regions: [] }, { committees: ['999'], regions: [] }, { committees: [], regions: ['inesistente'] }, {}]) assert.throws(() => configuredCommittees(config, available));
});

test('esito parziale e totale: report accurato e prosecuzione sugli altri comitati', async () => {
 const output = await mkdtemp(join(tmpdir(), 'fipav-configured-'));
 try {
  const config = { committees: [], regions: ['Liguria'] };
  const calls = [];
  const report = await syncConfigured(config, { available, output, sync: async id => { calls.push(id); return { saved: id === '03008' ? 2 : 0, failures: ['live: HTTP 404'] }; } });
  assert.deepEqual(calls, ['03008', '03011']); assert.equal(report.status, 'partial'); assert.equal(report.saved, 2);
  assert.deepEqual(JSON.parse(await readFile(join(output, 'sync-status.json'))), report);
  const failed = await syncConfigured(config, { available, output, sync: async () => ({ saved: 0, failures: ['HTTP 503'] }) });
  assert.equal(failed.status, 'failed');
  const ok = await syncConfigured(config, { available, output, sync: async () => ({ saved: 4, failures: [] }) });
  assert.equal(ok.status, 'success');
 } finally { await rm(output, { recursive: true, force: true }); }
});

test('gironi temporaneamente indisponibili: usa elenco precedente e aggiorna ancora calendario e classifica', async () => {
 const output = await mkdtemp(join(tmpdir(), 'fipav-previous-'));
 try {
  await mkdir(join(output, '03008'));
  await writeFile(join(output, '03008/groups.json'), JSON.stringify({ json: { data: [{ id: '12', type: 'Calendar', title: 'Girone A' }] }, at: 100, source: 'snapshot' }));
  const result = await syncCommittee('03008', { output, fetcher: async url => {
   if (url.endsWith('/calendar/0/12')) return Response.json({ data: { id: '12', matches: [] } });
   if (url.endsWith('/tables/12')) return Response.json({ data: { id: '12', teams: [] } });
   return new Response('', { status: 503 });
  } });
  assert.equal(result.saved, 2); assert.equal(result.failures.length, 2);
  assert.equal(JSON.parse(await readFile(join(output, '03008/groups.json'))).at, 100);
 } finally { await rm(output, { recursive: true, force: true }); }
});
