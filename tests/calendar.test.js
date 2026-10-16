import test from 'node:test';
import assert from 'node:assert/strict';
import { calendarTeams, filterByTeam, monthCells, shiftMonth, initialMonth } from '../src/calendar.js';
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
 assert.equal(february[0], null); assert.equal(february[3], '2024-02-01');
 assert.equal(february.filter(Boolean).length, 29); assert.equal(february.length % 7, 0);
 assert.equal(monthCells('2026-06')[0], '2026-06-01');
 assert.equal(monthCells('2026-02').filter(Boolean).length, 28);
 assert.equal(shiftMonth('2026-12', 1), '2027-01');assert.equal(shiftMonth('2026-01', -1), '2025-12');
});
test('mese iniziale: mese corrente se disponibile, futuro più vicino o ultimo mese della stagione', () => {
 assert.equal(initialMonth(games, '2026-10-01'), '2026-10');
 assert.equal(initialMonth(games, '2026-09-01'), '2026-10');
 assert.equal(initialMonth(games, '2027-01-01'), '2026-11');
 assert.equal(initialMonth([], '2026-10-16'), '2026-10');
});
