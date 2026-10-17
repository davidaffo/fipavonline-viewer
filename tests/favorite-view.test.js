import test from 'node:test';
import assert from 'node:assert/strict';
import { favoriteCommittees, favoriteMatches, favoriteTeams } from '../src/favorite-view.js';
const committees = [{ id: '03008', title: 'Centro', region: 'Liguria' }, { id: '03000', title: 'Regionale', region: 'Liguria' }, { id: '04000', title: 'Lombardia', region: 'Lombardia' }];
const team = (id, code = '030080168') => ({ id, title: `Squadra ${id}`, cod_aff_societa: code, nome_societa: 'Società' });
const record = (committee, id, date, a, b, group = '12') => ({ committee, committeeTitle: committee, at: 100, json: { data: { id: group, title: `Girone ${group}`, matches: [{ id, date, team1: a, team2: b }] } } });
const club = { type: 'club', id: '030080168', committee: '03008' };

test('vista società: tutti i comitati della regione, vista squadra: comitato di origine', () => {
 assert.deepEqual(favoriteCommittees(club, committees).map(c => c.id), ['03008', '03000']);
 assert.deepEqual(favoriteCommittees({ ...club, type: 'team' }, committees).map(c => c.id), ['03008']);
 assert.equal(favoriteCommittees({ ...club, committee: '99999' }, committees)[0].id, '99999');
});
test('vista dedicata: tutte le date e squadre della società, senza includere gli avversari', () => {
 const records = [record('03008', '1', '16/10/2026', team('1'), team('3', '999')), record('03000', '2', '10/10/2026', team('3', '999'), team('2'), '13'), record('03008', '3', '20/10/2026', team('4', '999'), team('3', '999'))];
 const games = favoriteMatches(records, club);
 assert.deepEqual(games.map(game => game.id), ['2', '1']);
 assert.deepEqual(favoriteTeams(games, club).map(team => team.id), ['1', '2']);
 const favorite = { type: 'team', id: '1', committee: '03008' };
 assert.deepEqual(favoriteMatches([...records, record('03000', '4', '21/10/2026', team('1'), team('9'))], favorite).map(game => game.id), ['1']);
});
test('dati ripetuti: un incontro solo con dati aggiornati e identità della società conservata', () => {
 const before = record('03008', '1', '16/10/2026', team('1'), team('3', '999'));
 const after = structuredClone(before); after.json.data.matches[0]['team1-setwin'] = 3;
 const games = favoriteMatches([before, after], club);
 assert.equal(games.length, 1);assert.equal(games[0]['team1-setwin'], 3);
 assert.equal(games[0].team1.cod_aff_societa, club.id);
 assert.equal(favoriteTeams(games, club).length, 1);
});


test('live più recente senza metadati società: aggiorna il risultato senza perdere affiliazione', () => {
 const calendar=record('03008','1','16/10/2026',team('1'),team('3','999'));
 const live=structuredClone(calendar);live.at=200;live.json.data.matches[0].team1={id:'1',title:'Squadra 1'};live.json.data.matches[0]['team1-setwin']=2;
 const games=favoriteMatches([live,calendar],club);
 assert.equal(games.length,1);assert.equal(games[0]['team1-setwin'],2);assert.equal(games[0].team1.cod_aff_societa,club.id);
});

test('squadre preferite: unione dei comitati senza richieste duplicate', () => {
 const favorites=[{type:'team',id:'1',committee:'03008'},{type:'team',id:'2',committee:'03008'},{type:'team',id:'1',committee:'03000'}];
 assert.deepEqual(favoriteCommittees(favorites,committees).map(item=>item.id),['03008','03000']);
 assert.deepEqual(favoriteCommittees([],committees),[]);
});

test('partite aggregate: derby una volta, date ordinate e ID uguali in comitati distinti', () => {
 const favorites=[{type:'team',id:'1',committee:'03008'},{type:'team',id:'2',committee:'03008'},{type:'team',id:'1',committee:'03000'}];
 const records=[
  record('03008','1','20/10/2026',team('1'),team('2')),
  record('03000','1','18/10/2026',team('1'),team('9')),
  record('03008','3','19/10/2026',team('8'),team('9')),
  record('04000','4','21/10/2026',team('1'),team('2')),
 ];
 const games=favoriteMatches(records,favorites);
 assert.deepEqual(games.map(game=>`${game.committeeId}:${game.id}`),['03000:1','03008:1']);
 assert.deepEqual(favoriteMatches(records,[]),[]);
});
