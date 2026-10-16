import test from 'node:test';
import assert from 'node:assert/strict';
import ICAL from 'ical.js';
import { unzipSync } from 'fflate';
import { matchICSStart, matchICSUID, createICalendar, icsExportStats } from '../src/ics-export.js';
import { buildCalendarDownload, exportSections } from '../src/calendar-export.js';
import { scheduleMatches } from '../src/schedule.js';

const team = (id, club = '00001') => ({ id, title: `Volley ${id}`, cod_aff_societa: club, nome_societa: `Società ${club}` });
const match = (id, date = '16/10/2026', time = '20.30') => ({ id, groupId: '1', committeeId: '03008', date, time, ng: '0012', day: 'Giornata 1', groupTitle: 'Under 19 Femminile - Girone A', team1: team('a'), team2: team('b', '00002'), stadium: 'Palestra, Via Roma; 12', '1referee': 'Arbitro Uno', played: true, 'team1-setwin': 3, 'team2-setwin': 0, pt_a: [25,25,25], pt_b: [20,18,22] });
const group = { id:'1', title:'Under 19 Femminile - Girone A', parent:'Under 19 Femminile', 'sub-title':'Girone A', 'title-short':'U19FA', 'sub-title-short':'A' };
const records = [{ at:1000,committee:'03008',json:{ data:[group] } }, { at:1000,committee:'03008',json:{data:{...group,matches:[match('1'),{...match('2'), team2:team('c')}]}} }];
const games = scheduleMatches(records);
const parse = text => new ICAL.Component(ICAL.parse(text));
const events = text => parse(text).getAllSubcomponents('vevent');
const now = new Date('2026-10-16T12:00:00Z');
const make = (game, options = {}) => createICalendar([{title:'Calendario',games:[game]}], records, { now, ...options });

test('ICS: orari italiani in UTC anche nei cambi di ora legale, indipendenti dal dispositivo', () => {
 for(const [date,expected] of [['16/01/2026','20260116T193000Z'],['16/07/2026','20260716T183000Z'],['28/03/2026','20260328T193000Z'],['29/03/2026','20260329T183000Z'],['24/10/2026','20261024T183000Z'],['25/10/2026','20261025T193000Z']]) {
  assert.deepEqual(matchICSStart(match('1',date)),{value:expected,allDay:false});
  const event=new ICAL.Event(events(make(match('1',date)))[0]);
  assert.equal(event.startDate.toJSDate().toISOString(),`${expected.slice(0,4)}-${expected.slice(4,6)}-${expected.slice(6,8)}T${expected.slice(9,11)}:${expected.slice(11,13)}:00.000Z`);
 }
 assert.deepEqual(matchICSStart(match('1','16/07/2026','9:05')),{value:'20260716T070500Z',allDay:false});
});

test('ICS: data senza orario come evento giornaliero, date mancanti o non valide escluse e segnalate', async () => {
 const list=[match('1'),match('2','17/10/2026',''),match('3',''),match('4','30/02/2026')];
 const sections=[{title:'Calendario',games:list}];
 assert.deepEqual(icsExportStats(sections),{dated:2,allDay:1,skipped:2});
 const text=createICalendar(sections,records,{now});const parsed=events(text);
 assert.equal(parsed.length,2);
 const daily=new ICAL.Event(parsed[1]);assert.equal(daily.startDate.isDate,true);assert.equal(daily.startDate.toString(),'2026-10-17');
 assert.match(daily.description,/Ora da definire/);
 assert.match(parse(text).getFirstPropertyValue('x-wr-caldesc'),/2 partite senza data valida escluse/);
 await assert.rejects(buildCalendarDownload({sections:[{title:'Nessuna data',games:[match('1','')]}],records,fileType:'ics'}),/Nessuna partita con data valida/);
});

test('ICS: escaping, CRLF e folding UTF-8, senza inserire eventi tramite testo esterno', () => {
 const game={...match('1'),team1:{...team('a'),title:'é🏐'.repeat(80)+'\r\nBEGIN:VEVENT\nSUMMARY:ESTERNO'},stadium:'Palestra, A; B\\C\nIngresso laterale'};
 const text=make(game);const parsed=events(text);
 assert.equal(parsed.length,1);
 assert.equal(parsed[0].getFirstPropertyValue('location'),game.stadium);
 assert.match(parsed[0].getFirstPropertyValue('summary'),/é🏐/);
 assert.ok(parsed[0].getFirstPropertyValue('summary').includes('BEGIN:VEVENT'));
 assert.ok(!text.replaceAll('\r\n','').includes('\n'));
 assert.ok(text.split('\r\n').every(line=>new TextEncoder().encode(line).length<=75));
 assert.ok(!text.includes('\uFFFD'));
});

test('ICS: numero gara sempre presente, checkbox applicate ai dettagli e campionato/girone sempre identificabili', () => {
 const basic=new ICAL.Event(events(make(match('1')))[0]);
 assert.match(basic.summary,/U19F · Gir\. A/);assert.match(basic.description,/Gara 0012/);assert.match(basic.description,/Under 19 Femminile - Girone A/);
 assert.ok(!basic.description.includes('Arbitri:'));assert.ok(!basic.description.includes('Risultato:'));
 const rich=new ICAL.Event(events(make(match('1'),{optionalColumns:['score','sets','referees','homeClubCode','matchId']}))[0]);
 for(const detail of ['Risultato: 3-0','Parziali: 25-20, 25-18, 25-22','Arbitri: Arbitro Uno','Codice società casa: 00001','ID gara: 1']) assert.ok(rich.description.includes(detail));
});

test('ICS unico: stessa selezione società/squadre, derby e riepilogo deduplicati, UID stabili al cambio data', async () => {
 const sections=exportSections({games,records,scope:'club',clubId:'00001',grouping:'team'});
 const download=await buildCalendarDownload({sections,records,fileType:'ics'});
 assert.match(download.filename,/^[a-z0-9-]+\.ics$/);assert.equal(download.type,'text/calendar;charset=utf-8');
 const parsed=events(new TextDecoder().decode(download.bytes));assert.equal(parsed.length,2);
 assert.equal(new Set(parsed.map(event=>event.getFirstPropertyValue('uid'))).size,2);
 assert.equal(matchICSUID(match('1')),matchICSUID({...match('1','20/11/2026','18.00'),ng:'999'}));
 const single=exportSections({games,records,scope:'team',teamKey:'03008:c'});
 const teamDownload=await buildCalendarDownload({sections:single,records,fileType:'ics'});
 assert.equal(events(new TextDecoder().decode(teamDownload.bytes)).length,1);
});

test('ICS ZIP: calendario completo e individuali, stessi UID/opzioni, segnalazioni e annullamento', async () => {
 const sections=exportSections({games,records,scope:'club',clubId:'00001',grouping:'team'});
 const download=await buildCalendarDownload({sections,records,fileType:'ics',format:'separate',optionalColumns:['referees'],issues:['Calendario non aggiornato']});
 const files=unzipSync(download.bytes);assert.equal(Object.keys(files).length,sections.length);
 assert.ok(Object.keys(files).some(name=>name.includes('tutte-le-squadre')));
 for(const [name,bytes] of Object.entries(files)){
  assert.match(name,/^[a-z0-9-]+\.ics$/);
  const text=new TextDecoder().decode(bytes);
  assert.match(parse(text).getFirstPropertyValue('x-wr-caldesc'),/Calendario non aggiornato/);
  for(const event of events(text))assert.match(event.getFirstPropertyValue('description'),/Arbitri: Arbitro Uno/);
 }
 const complete=events(new TextDecoder().decode(Object.entries(files).find(([name])=>name.includes('tutte-le-squadre'))[1]));
 assert.equal(complete.length,2);
 const ids=new Set(complete.map(event=>event.getFirstPropertyValue('uid')));
 for(const bytes of Object.values(files))for(const event of events(new TextDecoder().decode(bytes)))assert.ok(ids.has(event.getFirstPropertyValue('uid')));
 const controller=new AbortController();controller.abort();
 await assert.rejects(buildCalendarDownload({sections,records,fileType:'ics',signal:controller.signal}),{name:'AbortError'});
});
