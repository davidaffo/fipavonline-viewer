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
 assert.equal(parsed[1].hasProperty('description'),false);
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

test('ICS: titolo compatto con campionato e girone prima delle squadre, luogo dedicato e nessuna descrizione', () => {
 const basic=events(make(match('1')))[0];
 assert.equal(basic.getFirstPropertyValue('summary'),'U19FA-Volley a-Volley b');
 assert.equal(basic.getFirstPropertyValue('location'),'Palestra, Via Roma; 12');
 assert.equal(basic.hasProperty('description'),false);
 const extra=events(make(match('1'),{optionalColumns:['score','sets','referees','homeClubCode','matchId']}))[0];
 assert.equal(extra.hasProperty('description'),false);
 assert.deepEqual(extra.getAllProperties().map(property=>property.name).sort(),['dtstamp','dtstart','duration','location','summary','uid']);
 const noVenue=events(make({...match('1'),stadium:''}))[0];
 assert.equal(noVenue.hasProperty('location'),false);
});

test('ICS: esempio richiesto e abbreviazione ricostruita quando manca quella ufficiale', () => {
 const second={...group,parent:'Seconda Divisione Femminile',title:'Seconda Divisione Femminile - Girone A','title-short':'2DFA'};
 const game={...match('1'),team1:{title:'PGS Auxilium'},team2:{title:'Normac AVB'},stadium:'PALESTRA ISEF - VIA COSTANZI - GENOVA - ISEF'};
 const data=[{at:1000,committee:'03008',json:{data:[second]}}];
 const text=createICalendar([{title:'Calendario',games:[game]}],data,{now});
 const event=events(text)[0];
 assert.equal(event.getFirstPropertyValue('summary'),'2DFA-PGS Auxilium-Normac AVB');
 assert.equal(event.getFirstPropertyValue('location'),game.stadium);
 const fallback=createICalendar([{title:'Calendario',games:[{...game,groupTitle:second.title}]}],[],{now});
 assert.equal(events(fallback)[0].getFirstPropertyValue('summary'),'2DFA-PGS Auxilium-Normac AVB');
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

test('ICS ZIP: calendario completo e individuali, titoli, luoghi, stessi UID, segnalazioni e annullamento', async () => {
 const sections=exportSections({games,records,scope:'club',clubId:'00001',grouping:'team'});
 const download=await buildCalendarDownload({sections,records,fileType:'ics',format:'separate',optionalColumns:['referees'],issues:['Calendario non aggiornato']});
 const files=unzipSync(download.bytes);assert.equal(Object.keys(files).length,sections.length);
 assert.ok(Object.keys(files).some(name=>name.includes('tutte-le-squadre')));
 for(const [name,bytes] of Object.entries(files)){
  assert.match(name,/^[a-z0-9-]+\.ics$/);
  const text=new TextDecoder().decode(bytes);
  assert.match(parse(text).getFirstPropertyValue('x-wr-caldesc'),/Calendario non aggiornato/);
  for(const event of events(text)){assert.match(event.getFirstPropertyValue('summary'),/^U19FA-/);assert.equal(event.getFirstPropertyValue('location'),match('1').stadium);assert.equal(event.hasProperty('description'),false);}
 }
 const complete=events(new TextDecoder().decode(Object.entries(files).find(([name])=>name.includes('tutte-le-squadre'))[1]));
 assert.equal(complete.length,2);
 const ids=new Set(complete.map(event=>event.getFirstPropertyValue('uid')));
 for(const bytes of Object.values(files))for(const event of events(new TextDecoder().decode(bytes)))assert.ok(ids.has(event.getFirstPropertyValue('uid')));
 const controller=new AbortController();controller.abort();
 await assert.rejects(buildCalendarDownload({sections,records,fileType:'ics',signal:controller.signal}),{name:'AbortError'});
});

test('ICS: durata base di due ore; il riscaldamento anticipa l’inizio senza spostare fine o UID', () => {
 for (const game of [match('1'), match('1','17/10/2026','00.30'), match('1','29/03/2026','03.30'), match('1','25/10/2026','03.30')]) {
  const basic = new ICAL.Event(events(make(game))[0]);
  const warm = new ICAL.Event(events(make(game,{warmupMinutes:60}))[0]);
  assert.equal(basic.duration.toSeconds(),7200);
  assert.equal(warm.duration.toSeconds(),10800);
  assert.equal(basic.startDate.toUnixTime()-warm.startDate.toUnixTime(),3600);
  assert.equal(warm.endDate.toUnixTime(),basic.endDate.toUnixTime());
  assert.equal(basic.uid,warm.uid);
  assert.equal(warm.description,null);
 }
 const short = new ICAL.Event(events(make(match('1'),{warmupMinutes:30}))[0]);
 assert.equal(short.duration.toSeconds(),9000);
 const allDay = events(make(match('1','17/10/2026',''),{warmupMinutes:60}))[0];
 assert.equal(allDay.hasProperty('duration'),false);
 for (const minutes of [-1,Infinity,NaN,1.5,1441]) assert.throws(()=>make(match('1'),{warmupMinutes:minutes}),/Riscaldamento|riscaldamento/);
});

test('ICS: nome personalizzato nel calendario e nel download, senza modificare gli identificativi', async () => {
 const sections = exportSections({games,records,scope:'team',teamKey:'03008:a'});
 const calendarName='La mia squadra, stagione 2026/27';
 const file=await buildCalendarDownload({sections,records,fileType:'ics',calendarName,warmupMinutes:60});
 assert.equal(file.filename,'calendario-la-mia-squadra-stagione-2026-27.ics');
 const component=parse(new TextDecoder().decode(file.bytes));
 assert.equal(component.getFirstPropertyValue('x-wr-calname'),calendarName);
 for (const item of component.getAllSubcomponents('vevent')) {
  const event=new ICAL.Event(item);assert.equal(event.duration.toSeconds(),10800);
  const game=games.find(game=>matchICSUID(game)===event.uid);
  const original=new ICAL.Event(events(make(game))[0]);
  assert.equal(original.startDate.toUnixTime()-event.startDate.toUnixTime(),3600);
  assert.equal(original.endDate.toUnixTime(),event.endDate.toUnixTime());
 }
 const basic=await buildCalendarDownload({sections,records,fileType:'ics'});
 assert.deepEqual(events(new TextDecoder().decode(basic.bytes)).map(item=>item.getFirstPropertyValue('uid')),component.getAllSubcomponents('vevent').map(item=>item.getFirstPropertyValue('uid')));
});

test('ICS ZIP: prefisso personalizzato, calendari distinguibili e durata applicata a tutti i file', async () => {
 const sections=exportSections({games,records,scope:'club',clubId:'00001',grouping:'team'});
 const file=await buildCalendarDownload({sections,records,fileType:'ics',format:'separate',calendarName:'Il mio club',warmupMinutes:45});
 assert.equal(file.filename,'calendario-il-mio-club.zip');
 const files=unzipSync(file.bytes),names=[];
 assert.equal(Object.keys(files).length,sections.length);
 for(const [filename,bytes] of Object.entries(files)){
  assert.match(filename,/^calendario-il-mio-club-[a-z0-9-]+\.ics$/);
  const component=parse(new TextDecoder().decode(bytes));
  const name=component.getFirstPropertyValue('x-wr-calname');
  assert.ok(name.startsWith('Il mio club - '));names.push(name);
  for (const item of component.getAllSubcomponents('vevent')) {
   const event=new ICAL.Event(item);assert.equal(event.duration.toSeconds(),9900);
   const game=games.find(game=>matchICSUID(game)===event.uid);
   const original=new ICAL.Event(events(make(game))[0]);
   assert.equal(original.startDate.toUnixTime()-event.startDate.toUnixTime(),2700);
   assert.equal(original.endDate.toUnixTime(),event.endDate.toUnixTime());
  }
 }
 assert.equal(new Set(names).size,names.length);
});

test('ICS: stesso filtro delle partite svolte per file unico e calendari nello ZIP',async()=>{
 const mixed=games.map((game,index)=>({...game,played:index===0,is_live:'0'}));
 const all=exportSections({games:mixed,records,scope:'club',clubId:'00001',grouping:'team'});
 assert.equal(icsExportStats(all).dated,2);
 const sections=exportSections({games:mixed,records,scope:'club',clubId:'00001',grouping:'team',hidePlayed:true});
 const single=await buildCalendarDownload({sections,records,fileType:'ics'});
 const remaining=events(new TextDecoder().decode(single.bytes));
 assert.equal(remaining.length,1);
 assert.equal(remaining[0].getFirstPropertyValue('uid'),matchICSUID(mixed[1]));
 const zip=await buildCalendarDownload({sections,records,fileType:'ics',format:'separate'});
 for(const bytes of Object.values(unzipSync(zip.bytes))){
  const rows=events(new TextDecoder().decode(bytes));assert.equal(rows.length,1);
  assert.equal(rows[0].getFirstPropertyValue('uid'),matchICSUID(mixed[1]));
 }
});

test('ICS: squadre selezionate con checkbox, file unico deduplicato e file separati per selezione',async()=>{
 const sections=exportSections({games,records,scope:'team',teamKeys:['03008:a','03008:c']});
 assert.equal(sections.length,2);
 const file=await buildCalendarDownload({sections,records,fileType:'ics'});
 assert.equal(events(new TextDecoder().decode(file.bytes)).length,2);
 const zip=await buildCalendarDownload({sections,records,fileType:'ics',format:'separate'});
 const files=unzipSync(zip.bytes);assert.equal(Object.keys(files).length,2);
 const counts=Object.values(files).map(bytes=>events(new TextDecoder().decode(bytes)).length).sort();
 assert.deepEqual(counts,[1,2]);
});
