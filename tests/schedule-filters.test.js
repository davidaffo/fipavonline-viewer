import test from 'node:test';
import assert from 'node:assert/strict';
import { filterSchedule } from '../src/schedule-filters.js';
import { renderMatchCard } from '../src/match-card.js';
const groups=[{id:'1','parent-id':'100'},{id:'2','parent-id':'100'},{id:'3','parent-id':'200'}];
const games=[{id:'a',groupId:'1',date:'16/10/2026',team1:{id:'1'}},{id:'b',groupId:'2',date:'17/10/2026',team2:{id:'1'}},{id:'c',groupId:'3',date:'16/10/2026',team1:{id:'2'}}];
test('viste unificate: stessi filtri per campionato, girone e squadra; solo Giorno limita la data',()=>{
 const scoped=filterSchedule(games,{groups,championship:'100',team:'id:1'});
 assert.deepEqual(scoped.map(g=>g.id),['a','b']);
 assert.deepEqual(filterSchedule(games,{groups,championship:'100',team:'id:1',day:'2026-10-16'}).map(g=>g.id),['a']);
 assert.deepEqual(filterSchedule(games,{group:'2'}).map(g=>g.id),['b']);
 assert.equal(filterSchedule(games).length,3);
 assert.equal(filterSchedule(games,{groups,championship:'200',group:'1'}).length,0);
});
test('scheda condivisa: la classifica conserva girone e comitato della partita, con escape HTML',()=>{
 const html=renderMatchCard({groupId:'123',committeeId:'03011',groupTitle:'U19F < A'}, {logo:()=>'',star:()=>''});
 assert.match(html,/data-match-standings="123" data-committee="03011"/);
 assert.match(html,/Classifica: U19F &lt; A/);
 assert.ok(!html.includes('U19F < A'));
 const noContext=renderMatchCard({}, {logo:()=>'',star:()=>''});
 assert.ok(!noContext.includes('data-match-standings'));
});

test('nascondi svolte: solo terminate escluse quando il filtro è attivo, mantenendo live e gare senza risultato',()=>{
 const list=[{...games[0],played:'1',is_live:'0'},{...games[1],played:true,is_live:'1'},{...games[2],played:false,'team1-setwin':2}];
 assert.equal(filterSchedule(list).length,3);
 assert.deepEqual(filterSchedule(list,{hidePlayed:true}).map(game=>game.id),['b','c']);
 assert.deepEqual(filterSchedule(list,{hidePlayed:true,group:'1'}),[]);
 assert.equal(list.length,3);
});


test('intervallo inclusivo, limiti aperti, date mancanti e filtri combinati',()=>{
 const list=[...games,{id:'d',date:'18/10/2026',groupId:'1'},{id:'missing'},{id:'unknown',date:'Da definire'}];
 assert.deepEqual(filterSchedule(list,{dateFrom:'2026-10-16',dateTo:'2026-10-17'}).map(g=>g.id),['a','b','c']);
 assert.deepEqual(filterSchedule(list,{dateFrom:'2026-10-17'}).map(g=>g.id),['b','d']);
 assert.deepEqual(filterSchedule(list,{dateTo:'2026-10-16'}).map(g=>g.id),['a','c']);
 assert.deepEqual(filterSchedule(list,{dateFrom:'2026-10-17',dateTo:'2026-10-17',groups,championship:'100',team:'id:1'}).map(g=>g.id),['b']);
 assert.deepEqual(filterSchedule(list,{dateFrom:'2026-10-18',dateTo:'2026-10-16'}),[]);
 assert.deepEqual(filterSchedule(list,{dateFrom:'2027-01-01'}),[]);
 assert.equal(filterSchedule(list).length,list.length);
});
