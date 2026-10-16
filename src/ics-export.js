import { zipSync } from 'fflate';
import { dateISO } from './data.js';
import { competitionContext } from './team-label.js';
import { exportGroupMetadata } from './export-data.js';
import { OPTIONAL_EXPORT_COLUMNS, exportMatchValues } from './export-fields.js';
import { uniqueFilename, calendarDownloadName } from './export-filenames.js';

const encoder = new TextEncoder();
const rome = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Rome', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' });
const utcStamp = date => date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
function validDate(game) {
  const iso = dateISO(game);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso) || Number(iso.slice(0, 4)) < 1900) return '';
  const date = new Date(`${iso}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === iso ? iso : '';
}
function localParts(timestamp) {
  return Object.fromEntries(rome.formatToParts(timestamp).filter(part => part.type !== 'literal').map(part => [part.type, Number(part.value)]));
}
function asUTC(parts) { return Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second); }
export function matchICSStart(game) {
  const iso = validDate(game);
  if (!iso) return null;
  const time = /^(\d{1,2})[:.](\d{2})(?::(\d{2}))?$/.exec(String(game.time || '').trim());
  const allDay = { value: iso.replaceAll('-', ''), allDay: true };
  if (!time || Number(time[1]) > 23 || Number(time[2]) > 59 || Number(time[3] || 0) > 59) return allDay;
  const target = { year: Number(iso.slice(0, 4)), month: Number(iso.slice(5, 7)), day: Number(iso.slice(8, 10)), hour: Number(time[1]), minute: Number(time[2]), second: Number(time[3] || 0) };
  const wall = asUTC(target);
  // Campiona i due lati del cambio d'ora; non dipende dal fuso del dispositivo.
  const offsets = new Set([-86400000, 0, 86400000].map(delta => asUTC(localParts(wall + delta)) - (wall + delta)));
  const candidates = [...offsets].map(offset => wall - offset).filter(timestamp => asUTC(localParts(timestamp)) === wall).sort((a, b) => a - b);
  return candidates.length ? { value: utcStamp(new Date(candidates[0])), allDay: false } : allDay;
}
export function matchICSUID(game) {
  const identity = game.id || game.ng || `${game.team1?.id || game.team1?.title}-${game.team2?.id || game.team2?.title}-${dateISO(game)}`;
  return `urn:fipavonline-viewer:match:${[game.committeeId || '', game.groupId || '', identity].map(value => encodeURIComponent(String(value))).join(':')}`;
}
function uniqueGames(sections) {
  const games = new Map();
  for (const section of sections) for (const game of section.games) games.set(matchICSUID(game), game);
  return [...games.values()].sort((a, b) => `${dateISO(a)} ${a.time || ''}`.localeCompare(`${dateISO(b)} ${b.time || ''}`));
}
export function icsExportStats(sections) {
  let dated = 0, allDay = 0, skipped = 0;
  for (const game of uniqueGames(sections)) {
    const start = matchICSStart(game);
    if (!start) skipped++;
    else { dated++; if (start.allDay) allDay++; }
  }
  return { dated, allDay, skipped };
}
function escapeText(value) {
  return String(value ?? '').replace(/\r\n|\r/g, '\n').replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, '').replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/;/g, '\\;').replace(/,/g, '\\,');
}
function fold(line) {
  const lines = []; let part = '', length = 0;
  for (const char of line) {
    const size = encoder.encode(char).length;
    if (length + size > 75) { lines.push(part); part = ' '; length = 1; }
    part += char; length += size;
  }
  lines.push(part);
  return lines.join('\r\n');
}
export function createICalendar(sections, records, { optionalColumns = [], issues = [], now = new Date() } = {}) {
  const metadata = exportGroupMetadata(records);
  const enabled = new Set(optionalColumns);
  const games = uniqueGames(sections);
  const stats = icsExportStats(sections);
  const at = Math.min(...records.map(record => record.at).filter(value => Number.isFinite(value) && value > 0));
  const notes = ['Fonte: FIPAV Online', Number.isFinite(at) ? `Dati dal: ${new Date(at).toISOString()}` : '', stats.skipped ? `${stats.skipped} partite senza data valida escluse` : '', ...issues].filter(Boolean);
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//FIPAVonline Viewer//Calendari//IT', 'CALSCALE:GREGORIAN', `X-WR-CALNAME:${escapeText(sections.length === 1 ? sections[0].title : 'FIPAVonline - Calendari')}`, 'X-WR-TIMEZONE:Europe/Rome', `X-WR-CALDESC:${escapeText(notes.join('\n'))}`];
  for (const game of games) {
    const start = matchICSStart(game);
    if (!start) continue;
    const values = exportMatchValues(game, metadata);
    const context = competitionContext(metadata.get(`${game.committeeId}:${game.groupId}`) || { id: game.groupId, title: game.groupTitle });
    const description = [`${values.championship} - ${values.group}`, values.day, `Gara ${values.matchNumber || 'da definire'}`, start.allDay ? 'Ora da definire' : '', ...OPTIONAL_EXPORT_COLUMNS.filter(column => enabled.has(column.id) && values[column.id]).map(column => `${column.label}: ${values[column.id]}`)].filter(Boolean);
    lines.push('BEGIN:VEVENT', `UID:${matchICSUID(game)}`, `DTSTAMP:${utcStamp(now)}`, `${start.allDay ? 'DTSTART;VALUE=DATE' : 'DTSTART'}:${start.value}`, `SUMMARY:${escapeText(`${values.home || 'Da definire'} - ${values.away || 'Da definire'} · ${context.label}`)}`, `DESCRIPTION:${escapeText(description.join('\n'))}`);
    if (values.venue) lines.push(`LOCATION:${escapeText(values.venue)}`);
    lines.push('END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return lines.map(fold).join('\r\n') + '\r\n';
}
export async function buildICSDownload({ sections, records, optionalColumns = [], format = 'single', issues = [], progress = () => {}, signal }) {
  signal?.throwIfAborted();
  if (!icsExportStats(sections).dated) throw new Error('Nessuna partita con data valida da esportare.');
  const name = calendarDownloadName(sections);
  if (format === 'single') return { bytes: encoder.encode(createICalendar(sections, records, { optionalColumns, issues })), filename: `${name}.ics`, type: 'text/calendar;charset=utf-8' };
  const files = {}, names = new Set();
  for (const [index, section] of sections.entries()) {
    signal?.throwIfAborted();
    progress(`Creazione calendario ${index + 1}/${sections.length}…`);
    if (icsExportStats([section]).dated) files[`${uniqueFilename(section.fileTitle || section.title, names)}.ics`] = encoder.encode(createICalendar([section], records, { optionalColumns, issues }));
    await new Promise(resolve => setTimeout(resolve, 0));
  }
  signal?.throwIfAborted();
  return { bytes: zipSync(files, { level: 0 }), filename: `${name}.zip`, type: 'application/zip' };
}
