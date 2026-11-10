import test from 'node:test';
import assert from 'node:assert/strict';
import ICAL from 'ical.js';
import { singleMatchCalendar } from '../src/match-calendar.js';
import { matchICSUID } from '../src/ics-export.js';
import { renderMatchCard } from '../src/match-card.js';

const game = { id: '12', committeeId: '1', groupId: '2', groupTitle: 'Under 19 Femminile - Girone A', date: '25/10/2026', time: '20.30', team1: { title: 'Casa & Volley' }, team2: { title: 'Ospiti + Team' }, stadium: 'Palestra, Via Roma 1' };
const event = calendar => new ICAL.Event(new ICAL.Component(ICAL.parse(calendar.ics)).getFirstSubcomponent('vevent'));

test('singola gara: ICS e link concordano su titolo, luogo, orario italiano e durata', () => {
  const calendar = singleMatchCalendar(game);
  const parsed = event(calendar);
  const google = new URL(calendar.google).searchParams;
  const outlook = new URL(calendar.outlook).searchParams;
  assert.equal(parsed.uid, matchICSUID(game));
  assert.equal(parsed.startDate.toJSDate().toISOString(), '2026-10-25T19:30:00.000Z');
  assert.equal(parsed.duration.toSeconds(), 7200);
  assert.equal(google.get('dates'), '20261025T193000Z/20261025T213000Z');
  assert.equal(google.get('text'), parsed.summary);
  assert.equal(outlook.get('subject'), parsed.summary);
  assert.equal(outlook.get('startdt'), '2026-10-25T19:30:00Z');
  assert.equal(outlook.get('enddt'), '2026-10-25T21:30:00.000Z');
  assert.equal(outlook.get('allday'), 'false');
  for (const params of [google, outlook]) assert.equal(params.get('location'), parsed.location);
  assert.match(calendar.filename, /^[a-z0-9-]+\.ics$/);
  assert.equal(new ICAL.Component(ICAL.parse(calendar.ics)).getAllSubcomponents('vevent').length, 1);
});

test('singola gara: giorno intero e fine esclusiva anche al cambio di anno', () => {
  const calendar = singleMatchCalendar({ ...game, date: '31/12/2026', time: '' });
  assert.equal(event(calendar).startDate.isDate, true);
  assert.equal(new URL(calendar.google).searchParams.get('dates'), '20261231/20270101');
  const outlook = new URL(calendar.outlook).searchParams;
  assert.equal(outlook.get('startdt'), '2026-12-31');
  assert.equal(outlook.get('enddt'), '2027-01-01');
  assert.equal(outlook.get('allday'), 'true');
});

test('schede: azione presente, disabilitata per date mancanti o impossibili', () => {
  const options = { logo: () => '', star: () => '' };
  assert.match(renderMatchCard(game, options), /data-match-calendar="[^"]+" >Salva nel calendario/);
  for (const date of ['', '31/02/2026']) {
    const undated = { ...game, date };
    assert.throws(() => singleMatchCalendar(undated), /data valida/);
    assert.match(renderMatchCard(undated, options), /data-match-calendar="[^"]+" disabled/);
  }
});
