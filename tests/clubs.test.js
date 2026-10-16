import test from 'node:test';
import assert from 'node:assert/strict';
import { clubInfo, collectClubs, matchIsFavorite } from '../src/clubs.js';
import { favoriteKey } from '../src/data.js';

const first = { id: '1', title: 'Under 16', cod_aff_societa: '030080168', nome_societa: 'NUOVA OREGINA PALLAVOLO' };
const second = { ...first, id: '2', title: 'Serie D' };
const other = { id: '3', title: 'Ospiti', cod_aff_societa: '030080999', nome_societa: 'Altra società' };

test('società distinta dalle squadre: codice con zeri, squadre raggruppate e gironi senza duplicati', () => {
 const games = [
  { groupId: 'a', groupTitle: 'Under 16 - Girone A', team1: first, team2: other },
  { groupId: 'a', groupTitle: 'Under 16 - Girone A', team1: other, team2: first },
  { groupId: 'b', groupTitle: 'Serie D - Girone B', team1: second, team2: other },
  { groupId: 'c', groupTitle: 'Under 16 - Finale', team1: first },
 ];
 const clubs = collectClubs(games);
 assert.equal(clubs.length, 2);
 const club = clubs.find(club => club.id === '030080168');
 assert.equal(club.title, 'NUOVA OREGINA PALLAVOLO');assert.equal(club.teams.length, 2);
 assert.deepEqual(club.teams.find(team => team.id === '1').groups, ['Under 16 - Girone A', 'Under 16 - Finale']);
 assert.equal(clubInfo({ title: 'Una squadra senza codice' }), null);
 assert.equal(clubInfo({ cod_aff_societa: '030080168' }).title, 'Società non indicata');
});

test('preferito società segue tutte le squadre nei vari comitati senza confondere nomi e società', () => {
 const saved = [{ key: favoriteKey('club', '030080168', '03008') }];
 for (const committee of ['03008', '03000']) {
  assert.equal(matchIsFavorite({ team1: first }, saved, committee), true);
  assert.equal(matchIsFavorite({ team2: second }, saved, committee), true);
 }
 assert.equal(matchIsFavorite({ team1: { ...first, cod_aff_societa: '030080999' } }, saved, '03008'), false);
 assert.equal(matchIsFavorite({ team1: { id: 'other', title: first.title } }, saved, '03008'), false);
 const teamFavorite = [{ key: favoriteKey('team', '1', '03008') }];
 assert.equal(matchIsFavorite({ team1: first }, teamFavorite, '03008'), true);
 assert.equal(matchIsFavorite({ team1: first }, teamFavorite, '03000'), false);
 assert.equal(matchIsFavorite({ team1: second }, teamFavorite, '03008'), false);
 assert.equal(matchIsFavorite({ groupId: '12' }, [{ key: favoriteKey('group', '12', '03008') }], '03008'), true);
});
