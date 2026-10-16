import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { syncCommittee, selectCommittees } from '../scripts/sync-fipav.mjs';
import { snapshotURL, validateSnapshot } from '../src/snapshot.js';

test('selezione regione: include tutti i comitati oppure solo quello scelto, ripete input non validi', async () => {
  const committees = [
    { id: '04000', title: 'C.R. Lombardia', region: 'Lombardia' },
    { id: '01000', title: 'C.R. Piemonte', region: 'Piemonte' },
    { id: '04012', title: 'C.T. Bergamo', region: 'Lombardia' },
  ];
  const answers = ['', '9', 'Lombardia', '1', '-1', '0'];
  const messages = [];
  const all = await selectCommittees(committees, async () => answers.shift(), message => messages.push(message));
  assert.deepEqual(all.map(c => c.id), ['04000', '04012']);
  assert.ok(messages.includes('Inserisci un numero da 1 a 2.'));
  const singleAnswers = ['1', '2'];
  const single = await selectCommittees(committees, async () => singleAnswers.shift(), () => {});
  assert.deepEqual(single.map(c => c.id), ['04012']);
});

test('scarica i gironi, usa il fallback, conserva payload e data senza sovrascrivere su errore', async () => {
  const output = await mkdtemp(join(tmpdir(), 'fipav-sync-'));
  const calls = [];
  const fetcher = async url => {
    calls.push(url);
    if (url.includes('/public/')) return Response.json({ data: { championship: [] } });
    if (url.includes('data.fipavonline.it')) return new Response('', { status: 404 });
    if (url.endsWith('/calendar/04000/0')) return Response.json({ data: [{ type: 'Calendar', id: '12', title: 'Serie C' }] });
    if (url.endsWith('/calendar/0/12')) return Response.json({ data: { id: '12', matches: [] } });
    return Response.json([{ data: { id: '12', teams: [] } }]);
  };
  try {
    assert.deepEqual(await syncCommittee('04000', { output, fetcher }), { saved: 4, failures: [] });
    assert.ok(calls.some(url => url.includes('app.fipavonline.it')));
    const target = join(output, '04000/calendar-12.json');
    const original = await readFile(target, 'utf8');
    const record = validateSnapshot(JSON.parse(original), 'calendar');
    assert.equal(record.json.data.id, '12');
    assert.ok(record.at <= Date.now());
    const result = await syncCommittee('04000', { output, groups: ['12'], fetcher: async () => Response.json({ error: 'indisponibile' }) });
    assert.equal(result.saved, 0);
    assert.equal(result.failures.length, 4);
    assert.equal(await readFile(target, 'utf8'), original);
  } finally { await rm(output, { recursive: true, force: true }); }
});

test('URL compatibile con sottopercorsi e rifiuto snapshot errati', () => {
  assert.equal(snapshotURL('/volley/', 'calendar', '04000', '12'), '/volley/data/04000/calendar-12.json');
  assert.throws(() => validateSnapshot({ source: 'snapshot', at: 0, json: {} }, 'live'));
  assert.throws(() => validateSnapshot({ source: 'snapshot', at: Date.now(), json: { data: { teams: [] } } }, 'calendar'));
});
