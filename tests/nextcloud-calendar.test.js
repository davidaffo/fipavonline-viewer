import test from 'node:test';
import assert from 'node:assert/strict';
import { DOMParser } from '@xmldom/xmldom';
import { nextcloudServer, trustedDAVURL, readNextcloudSettings, saveNextcloudSettings, forgetNextcloudSettings, parseDAVResponse, calendarCollections, createNextcloudClient } from '../src/nextcloud-calendar.js';

const server = 'https://cloud.example/nextcloud/';
const root = `${server}remote.php/dav/`;
const game = { id: '123', committeeId: '1', groupId: '2' };
const response = (href, properties, status = '200 OK') => `<d:response><d:href>${href}</d:href><d:propstat><d:prop>${properties}</d:prop><d:status>HTTP/1.1 ${status}</d:status></d:propstat></d:response>`;
const xml = (...items) => `<d:multistatus xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav">${items.join('')}</d:multistatus>`;
const calendar = (name = 'Partite', permissions = '<d:write/>', component = 'VEVENT') => `<d:displayname>${name}</d:displayname><d:resourcetype><d:collection/><c:calendar/></d:resourcetype><d:current-user-privilege-set><d:privilege>${permissions}</d:privilege></d:current-user-privilege-set><c:supported-calendar-component-set><c:comp name="${component}"/></c:supported-calendar-component-set>`;
const options = { server, username: 'davide', password: 'app-secret', Parser: DOMParser };

test('Nextcloud: normalizza sottopercorso e URL DAV, rifiuta HTTP e credenziali negli URL', () => {
  assert.equal(nextcloudServer(' https://cloud.example/nextcloud '), server);
  assert.equal(nextcloudServer(`${root}calendars/davide/personal/`), server);
  assert.equal(trustedDAVURL('/nextcloud/remote.php/dav/', root), root);
  for (const value of ['http://cloud.example', 'https://user:secret@cloud.example', 'https://cloud.example/?password=secret', 'javascript:alert(1)']) assert.throws(() => nextcloudServer(value));
  assert.throws(() => trustedDAVURL('https://evil.example/calendar/', root));
  assert.throws(() => trustedDAVURL('https://user:secret@cloud.example/', root));
});

test('Nextcloud: persistenza limitata a server, utente e calendario, senza password', () => {
  const values = new Map();
  const storage = { getItem: key => values.get(key), setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) };
  assert.deepEqual(readNextcloudSettings(storage), { server: '', username: '', calendar: '' });
  const settings = { server, username: 'davide', calendar: `${root}calendars/davide/personal/`, password: 'NEVER STORE', authorization: 'Basic secret' };
  saveNextcloudSettings(settings, storage);
  assert.equal(values.size, 1);
  assert.deepEqual(JSON.parse([...values.values()][0]), { server, username: settings.username, calendar: settings.calendar });
  assert.deepEqual(readNextcloudSettings(storage), { server, username: settings.username, calendar: settings.calendar });
  forgetNextcloudSettings(storage);
  assert.equal(values.size, 0);
  assert.throws(() => saveNextcloudSettings({ ...settings, calendar: 'https://evil.example/' }, storage));
});

test('Nextcloud: interpreta namespace DAV, ignora proprietà fallite e calendari di sola lettura o attività', () => {
  const body = xml(
    response('/nextcloud/remote.php/dav/calendars/davide/partite/', calendar('Partite &amp; Volley')),
    response('readonly/', calendar('Sola lettura', '<d:read/>')),
    response('tasks/', calendar('Attività', '<d:write/>', 'VTODO')),
    response('missing/', calendar(), '404 Not Found'),
    response('folder/', '<d:resourcetype><d:collection/></d:resourcetype>'),
  );
  assert.deepEqual(calendarCollections(parseDAVResponse(body, DOMParser), root), [{ url: `${root}calendars/davide/partite/`, title: 'Partite & Volley' }]);
  assert.throws(() => parseDAVResponse('<html>Login</html>', DOMParser), /non valida/);
  assert.throws(() => calendarCollections(parseDAVResponse(xml(response('https://evil.example/calendar/', calendar())), DOMParser), root), /non valido/);
});

test('Nextcloud: discovery principal e home reale, autenticazione solo negli header e nessuna cache', async () => {
  const calls = [];
  const replies = [
    xml(response(root, '<d:current-user-principal><d:href>/nextcloud/remote.php/dav/principals/users/real-id/</d:href></d:current-user-principal>')),
    xml(response('ignored', '<c:calendar-home-set><d:href>/nextcloud/remote.php/dav/calendars/real-id/</d:href></c:calendar-home-set>')),
    xml(response('/nextcloud/remote.php/dav/calendars/real-id/partite/', calendar())),
  ];
  const client = createNextcloudClient({ ...options, fetchImpl: async (url, init) => { calls.push({ url, init }); return new Response(replies.shift(), { status: 207 }); } });
  const calendars = await client.calendars();
  assert.equal(calendars[0].url, `${root}calendars/real-id/partite/`);
  assert.deepEqual(calls.map(call => call.url), [root, `${root}principals/users/real-id/`, `${root}calendars/real-id/`]);
  assert.deepEqual(calls.map(call => call.init.headers.Depth), ['0', '0', '1']);
  for (const { url, init } of calls) {
    assert.equal(init.method, 'PROPFIND');
    assert.equal(init.headers.Authorization, `Basic ${btoa('davide:app-secret')}`);
    assert.equal(init.redirect, 'error');
    assert.equal(init.credentials, 'omit');
    assert.equal(init.cache, 'no-store');
    assert.ok(!url.includes('app-secret'));
    assert.ok(!init.body.includes('app-secret'));
  }
});

test('Nextcloud: salva ICS con PUT condizionale, nome stabile e rifiuto duplicati senza sovrascrivere', async () => {
  const calls = [];
  let status = 201;
  const client = createNextcloudClient({ ...options, fetchImpl: async (url, init) => { calls.push({ url, init }); return new Response(null, { status }); } });
  const url = `${root}calendars/davide/partite/`;
  assert.deepEqual(await client.save(url, game, 'BEGIN:VCALENDAR\r\nEND:VCALENDAR\r\n'), { alreadyExists: false });
  status = 412;
  assert.deepEqual(await client.save(url, game, 'updated'), { alreadyExists: true });
  assert.equal(calls[0].url, calls[1].url);
  assert.match(calls[0].url, /\/fipav-[a-f0-9]{64}\.ics$/);
  assert.equal(calls[0].init.method, 'PUT');
  assert.equal(calls[0].init.headers['If-None-Match'], '*');
  assert.equal(calls[0].init.body, 'BEGIN:VCALENDAR\r\nEND:VCALENDAR\r\n');
  await assert.rejects(client.save('https://evil.example/', game, ''), /non valido/);
  assert.equal(calls.length, 2);
});

test('Nextcloud: messaggi per autenticazione, permessi, rete/CORS e risposta non DAV', async () => {
  for (const [status, pattern] of [[401, /Accesso rifiutato/], [403, /permesso/], [500, /500/], [200, /non valida/]]) {
    const client = createNextcloudClient({ ...options, fetchImpl: async () => new Response('<html>Login</html>', { status }) });
    await assert.rejects(client.calendars(), pattern);
  }
  const client = createNextcloudClient({ ...options, fetchImpl: async () => { throw new TypeError('Failed to fetch'); } });
  await assert.rejects(client.calendars(), /CORS/);
  assert.throws(() => createNextcloudClient({ ...options, username: 'bad:name' }), /nome utente/);
  assert.throws(() => createNextcloudClient({ ...options, password: '' }), /password/);
});
