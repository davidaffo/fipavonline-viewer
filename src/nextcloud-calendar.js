import { matchICSUID } from './ics-export.js';

const DAV = 'DAV:', CALDAV = 'urn:ietf:params:xml:ns:caldav';
const settingsKey = 'vl-nextcloud-calendar';
const nodes = (node, ns, name) => [...Array.from(node.getElementsByTagNameNS(ns, name))];
const text = (node, ns, name) => nodes(node, ns, name)[0]?.textContent?.trim() || '';

export function nextcloudServer(value) {
  const url = new URL(String(value).trim());
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) throw new Error('Inserisci un indirizzo HTTPS Nextcloud senza credenziali o parametri.');
  url.pathname = url.pathname.replace(/\/remote\.php\/dav(?:\/.*)?$/, '').replace(/\/+$/, '') + '/';
  return url.href;
}

export function trustedDAVURL(href, base) {
  const url = new URL(href, base);
  if (url.origin !== new URL(base).origin || url.username || url.password || url.search || url.hash) throw new Error('Il server ha restituito un indirizzo CalDAV non valido.');
  return url.href;
}

export function readNextcloudSettings(storage) {
  try {
    storage ||= globalThis.localStorage;
    const saved = JSON.parse(storage.getItem(settingsKey));
    return { server: nextcloudServer(saved.server), username: String(saved.username || ''), calendar: saved.calendar ? trustedDAVURL(saved.calendar, saved.server) : '' };
  } catch { return { server: '', username: '', calendar: '' }; }
}

export function saveNextcloudSettings(settings, storage = localStorage) {
  const server = nextcloudServer(settings.server);
  // Whitelist esplicita: nessuna password o intestazione di autenticazione.
  storage.setItem(settingsKey, JSON.stringify({ server, username: String(settings.username), calendar: trustedDAVURL(settings.calendar, server) }));
}

export function forgetNextcloudSettings(storage = localStorage) { storage.removeItem(settingsKey); }

function successfulProps(response) {
  return nodes(response, DAV, 'propstat').filter(item => /\s200(?:\s|$)/.test(text(item, DAV, 'status'))).flatMap(item => nodes(item, DAV, 'prop'));
}

export function parseDAVResponse(xml, Parser = DOMParser) {
  const doc = new Parser().parseFromString(xml, 'application/xml');
  if (doc.getElementsByTagName('parsererror').length || doc.documentElement?.namespaceURI !== DAV || doc.documentElement?.localName !== 'multistatus') throw new Error('Risposta CalDAV non valida.');
  return nodes(doc, DAV, 'response').map(response => ({ href: text(response, DAV, 'href'), props: successfulProps(response) }));
}

export function calendarCollections(responses, base) {
  return responses.flatMap(({ href, props }) => {
    const has = (ns, name) => props.some(prop => nodes(prop, ns, name).length);
    if (!has(CALDAV, 'calendar')) return [];
    const components = props.flatMap(prop => nodes(prop, CALDAV, 'comp'));
    if (components.length && !components.some(comp => comp.getAttribute('name') === 'VEVENT')) return [];
    if (has(DAV, 'current-user-privilege-set') && !['write', 'write-content', 'all'].some(name => has(DAV, name))) return [];
    if (!href) return [];
    const url = trustedDAVURL(href, base);
    return [{ url: url.endsWith('/') ? url : `${url}/`, title: props.map(prop => text(prop, DAV, 'displayname')).find(Boolean) || decodeURIComponent(new URL(url).pathname.split('/').filter(Boolean).at(-1)) }];
  });
}

export function createNextcloudClient({ server, username, password, signal, fetchImpl = fetch, Parser }) {
  const base = nextcloudServer(server);
  if (!username || username.includes(':') || !password) throw new Error('Inserisci nome utente e password per app Nextcloud.');
  const authorization = `Basic ${btoa(Array.from(new TextEncoder().encode(`${username}:${password}`), byte => String.fromCharCode(byte)).join(''))}`;
  async function request(url, options) {
    let response;
    try {
      response = await fetchImpl(trustedDAVURL(url, base), { ...options, headers: { ...options.headers, Authorization: authorization }, credentials: 'omit', cache: 'no-store', redirect: 'error', referrerPolicy: 'no-referrer', signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(20000)]) : AbortSignal.timeout(20000) });
    } catch (error) {
      if (signal?.aborted) throw error;
      throw new Error('Connessione Nextcloud non riuscita. Verifica indirizzo, rete e accesso CORS dal dominio di questa app.');
    }
    if (response.status === 401) throw new Error('Accesso rifiutato: verifica utente e password per app Nextcloud.');
    if (response.status === 403) throw new Error('Non hai il permesso di accedere o scrivere in questo calendario.');
    if (!response.ok && response.status !== 412) throw new Error(`Nextcloud ha risposto con errore ${response.status}.`);
    return response;
  }
  async function propfind(url, properties, depth = '0') {
    const response = await request(url, { method: 'PROPFIND', headers: { Depth: depth, 'Content-Type': 'application/xml;charset=utf-8' }, body: `<?xml version="1.0"?><d:propfind xmlns:d="DAV:" xmlns:c="${CALDAV}"><d:prop>${properties}</d:prop></d:propfind>` });
    if (response.status !== 207) throw new Error('Risposta CalDAV non valida.');
    return parseDAVResponse(await response.text(), Parser);
  }
  const hrefProperty = (responses, ns, name, relativeTo) => {
    for (const { props } of responses) for (const prop of props) {
      const element = nodes(prop, ns, name)[0];
      const href = element && text(element, DAV, 'href');
      if (href) return trustedDAVURL(href, relativeTo);
    }
    throw new Error('Il server non ha indicato un calendario CalDAV per questo account.');
  };
  return {
    async calendars() {
      const root = new URL('remote.php/dav/', base).href;
      const principal = hrefProperty(await propfind(root, '<d:current-user-principal/>'), DAV, 'current-user-principal', root);
      const home = hrefProperty(await propfind(principal, '<c:calendar-home-set/>'), CALDAV, 'calendar-home-set', principal);
      const responses = await propfind(home, '<d:resourcetype/><d:displayname/><d:current-user-privilege-set/><c:supported-calendar-component-set/>', '1');
      return calendarCollections(responses, home);
    },
    async save(calendar, game, ics) {
      const collection = trustedDAVURL(calendar, base);
      const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(matchICSUID(game)));
      const id = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
      const url = new URL(`fipav-${id}.ics`, collection.endsWith('/') ? collection : `${collection}/`).href;
      const response = await request(url, { method: 'PUT', headers: { 'Content-Type': 'text/calendar;charset=utf-8', 'If-None-Match': '*' }, body: ics });
      return { alreadyExists: response.status === 412 };
    },
  };
}
