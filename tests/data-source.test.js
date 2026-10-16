import test from 'node:test';
import assert from 'node:assert/strict';
import { createDataSource } from '../src/data-source.js';

for (const mode of ['static', 'api']) {
  test(`${mode}: conserva dati e timestamp, costruisce URL e trasmette annullamento`, async () => {
    const calls = [];
    const controller = new AbortController();
    const json = { data: { id: '12', matches: [] } };
    const provider = createDataSource({ mode, base: '/viewer/', apiBase: 'https://api.example.com/v1', fetcher: async (url, options) => {
      calls.push({ url, options });
      return Response.json({ json, at: 123, source: 'snapshot' });
    } });
    const record = await provider.get('calendar', { committee: '03008', group: '12', signal: controller.signal });
    assert.equal(record.at, 123);
    assert.deepEqual(record.json, json);
    assert.equal(record.source, mode === 'api' ? 'network' : 'snapshot');
    assert.equal(calls[0].url, mode === 'static' ? '/viewer/data/03008/calendar-12.json' : 'https://api.example.com/v1/committees/03008/calendar/12');
    assert.equal(calls[0].options.signal, controller.signal);
    assert.equal(calls[0].options.cache, 'no-store');
    await assert.rejects(provider.get('calendar', { committee: '03008', group: '../x' }));
  });
  test(`${mode}: errore HTTP o formato errato senza richieste dirette a FIPAV`, async () => {
    let calls = 0;
    const provider = createDataSource({ mode, fetcher: async () => { calls++; return new Response('', { status: 404 }); } });
    await assert.rejects(provider.get('groups', { committee: '03008' }), /HTTP 404/);
    assert.equal(calls, 1);
    const invalid = createDataSource({ mode, fetcher: async () => Response.json({ at: 123, source: 'snapshot', json: { data: { teams: [] } } }) });
    await assert.rejects(invalid.get('calendar', { committee: '03008', group: '12' }));
  });
}

test('API: percorsi di tutti i tipi e annullamento senza fallback statico', async () => {
  const calls = [];
  const provider = createDataSource({ mode: 'api', fetcher: async (url, options) => {
    calls.push(url);
    options.signal?.throwIfAborted();
    if (url.endsWith('/groups')) return Response.json({ at: 123, json: { data: [] } });
    if (url.endsWith('/live')) return Response.json({ at: 123, json: { data: { championship: [] } } });
    return Response.json({ at: 123, json: { data: { teams: [] } } });
  } });
  for (const kind of ['groups', 'live', 'standings']) await provider.get(kind, { committee: '03008', group: '12' });
  assert.deepEqual(calls, ['/api/v1/committees/03008/groups', '/api/v1/committees/03008/live', '/api/v1/committees/03008/standings/12']);
  const controller = new AbortController(); controller.abort();
  await assert.rejects(provider.get('live', { committee: '03008', signal: controller.signal }), { name: 'AbortError' });
  assert.throws(() => createDataSource({ mode: 'unknown' }));
});
