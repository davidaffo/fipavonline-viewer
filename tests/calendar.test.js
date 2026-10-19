import test from 'node:test';
import assert from 'node:assert/strict';
import { calendarTeams, filterByTeam, monthCells, shiftMonth, initialMonth, renderMonth } from '../src/calendar.js';
const a = { id: '01', title: 'Volley A' }, b = { id: '02', title: 'Volley B' }, c = { id: '03', title: 'Volley A' };
const games = [{ date: '16/10/2026', team1: a, team2: b }, { date: '20/11/2026', team1: b, team2: a }, { date: '21/11/2026', team1: c, team2: b }];

test('squadre: deduplicazione per ID, partite in casa e fuori, ritorno al calendario completo', () => {
 assert.equal(calendarTeams(games).length, 3);
 assert.equal(filterByTeam(games, 'id:01').length, 2);
 assert.equal(filterByTeam(games, 'id:03').length, 1);
 assert.equal(filterByTeam(games, '').length, 3);
 assert.equal(filterByTeam(games, 'id:missing').length, 0);
});
test('griglia: settimane da lunedì, anno bisestile, mesi e cambio anno', () => {
 const february = monthCells('2024-02');
 assert.equal(february[0], '2024-01-29'); assert.equal(february[3], '2024-02-01');
 assert.equal(february.filter(date=>date.startsWith('2024-02')).length, 29); assert.equal(february.length % 7, 0);
 assert.equal(february.at(-1), '2024-03-03');
 assert.equal(monthCells('2026-06')[0], '2026-06-01');
 assert.equal(monthCells('2026-02').filter(date=>date.startsWith('2026-02')).length, 28);
 assert.equal(monthCells('2027-01')[0], '2026-12-28');
 assert.equal(monthCells('2026-12').at(-1), '2027-01-03');
 assert.equal(shiftMonth('2026-12', 1), '2027-01');assert.equal(shiftMonth('2026-01', -1), '2025-12');
});
test('griglia: partite e selezione nei mesi adiacenti, categoria insieme all’orario', () => {
 const html = renderMonth([
  { date: '28/09/2026', time: '18.30', groupTitle: 'Under 18 Femminile - Girone A', team1: a, team2: b },
  { date: '01/11/2026', time: '20.00', groupTitle: 'Serie C <Maschile>', team1: c, team2: b },
 ], { month: '2026-10', selectedDay: '2026-09-28' });
 assert.equal((html.match(/data-calendar-day=/g) || []).length, 35);
 assert.match(html, /is-outside-month\s+is-selected[^>]*data-calendar-day="2026-09-28" aria-pressed="true"/);
 assert.match(html, /settembre \(altro mese\)/);
 assert.match(html, /month-day-month">set/);
 assert.match(html, /18:30 · Under 18 Femminile/);
 assert.match(html, /data-calendar-day="2026-11-01"/);
 assert.match(html, /20:00 · Serie C &lt;Maschile&gt;/);
 assert.equal((html.match(/class="calendar-event /g) || []).length, 2);
});
test('mese iniziale: mese corrente se disponibile, futuro più vicino o ultimo mese della stagione', () => {
 assert.equal(initialMonth(games, '2026-10-01'), '2026-10');
 assert.equal(initialMonth(games, '2026-09-01'), '2026-10');
 assert.equal(initialMonth(games, '2027-01-01'), '2026-11');
 assert.equal(initialMonth([], '2026-10-16'), '2026-10');
});
