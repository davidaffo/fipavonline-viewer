import test from 'node:test';
import assert from 'node:assert/strict';
import { scheduleMatches, combinedRecord } from '../src/schedule.js';
const calendar = (id, games) => ({ at: 100, source: 'snapshot', json: { data: { id, title: `Girone ${id}`, matches: games } } });
const game = (id, date, time = '20:00') => ({ id, date, time, team1: { id: '1' }, team2: { id: '2' } });

test('calendario completo ordinato, giornata su tutti i gironi e senza duplicati', () => {
 const records = [calendar('a', [game('2', '20/10/2026'), game('1', '16/10/2026')]), calendar('b', [game('1', '16/10/2026', '18:00')])];
 assert.deepEqual(scheduleMatches(records).map(m => m.date), ['16/10/2026', '16/10/2026', '20/10/2026']);
 assert.deepEqual(scheduleMatches(records, { day: '2026-10-16' }).map(m => m.groupId), ['b', 'a']);
 assert.equal(scheduleMatches(records, { day: '2026-10-17' }).length, 0);
 const live = { at: 200, json: { data: { championship: [{ id: 'a', title: 'Girone a', 'championship-matches': [{ ...game('1', '16/10/2026'), is_live: 1 }] }] } } };
 const combined = combinedRecord([...records, live]);
 assert.equal(scheduleMatches([combined]).length, 3);
 assert.equal(scheduleMatches([combined], { day: '2026-10-16' }).find(m => m.groupId === 'a').is_live, 1);
 assert.equal(combined.at, 100);
});


test('live FIPAV con nome società vuoto: conserva nomi, loghi e arbitri del calendario e aggiorna il punteggio', () => {
 const calendarRecord={at:100,json:{data:{id:'12','commettee-id':'03008',title:'Under 19 Femminile - Girone A',matches:[{id:'1',date:'16/10/2026',time:'20:30','1referee':'Arbitro Uno',team1:{id:'1',title:'VOLLEY',cod_aff_societa:'030080168',nome_societa:'NUOVA OREGINA PALLAVOLO',logo:'https://app.fipavonline.it/img/loghi_societa/030080168/logo.png'},team2:{id:'2',cod_aff_societa:'030080999',nome_societa:'OSPITI'},'team1-setwin':0,'team2-setwin':0}]}}};
 const live={at:200,json:{data:{championship:[{id:'12','commettee-id':'03008',title:'Under 19 Femminile - Girone A','championship-matches':[{id:'1',date:'16/10/2026',time:'20:30','1referee':'',team1:{id:'1',title:'VOLLEY',cod_aff_societa:'030080168',nome_societa:'',logo:''},team2:{id:'2',cod_aff_societa:'030080999',nome_societa:''},is_live:'1','team1-setwin':2,'team2-setwin':1}]}]}}};
 const [game]=scheduleMatches([live,calendarRecord]);
 assert.equal(game.team1.nome_societa,'NUOVA OREGINA PALLAVOLO');assert.equal(game.team2.nome_societa,'OSPITI');
 assert.match(game.team1.logo,/logo.png$/);assert.equal(game['1referee'],'Arbitro Uno');assert.equal(game['team1-setwin'],2);assert.equal(game.is_live,'1');
 assert.deepEqual(scheduleMatches([combinedRecord([live,calendarRecord])])[0],game);
 assert.equal(calendarRecord.json.data.matches[0]['team1-setwin'],0);
});

test('nome società risolto tramite codice affiliazione anche per una gara presente soltanto nel live', () => {
 const calendars=calendar('12',[{...game('1','16/10/2026'),team1:{id:'1',cod_aff_societa:'030080168',nome_societa:'NOME SOCIETÀ'}}]);
 const live={at:200,json:{data:{championship:[{id:'13',title:'Altro girone','championship-matches':[{id:'2',date:'16/10/2026',team1:{id:'9',cod_aff_societa:'030080168',nome_societa:''}}]}]}}};
 assert.equal(scheduleMatches([calendars,live]).find(match=>match.id==='2').team1.nome_societa,'NOME SOCIETÀ');
});
