import test from 'node:test';
import assert from 'node:assert/strict';
import { competitionContext, enrichTeamFavorite, favoriteTitle } from '../src/team-label.js';
const group = (id, suffix = 'A') => ({ type: 'Calendar', id, title: `Under 19 Femminile - Girone ${suffix}`, parent: 'Under 19 Femminile', 'title-short': `U19F${suffix}`, 'sub-title': `Girone ${suffix}`, 'sub-title-short': suffix });
const favorite = { type: 'team', id: '1', title: 'VOLLEY GENOVA', committee: '03008', key: '03008:team:1' };

test('abbreviazioni ufficiali: categoria separata dal girone, comprese le fasi', () => {
 assert.equal(competitionContext(group('12')).label, 'U19F · Gir. A');
 assert.equal(competitionContext(group('12')).code, 'U19FA');
 assert.equal(competitionContext({id:'12',title:'Seconda Divisione Femminile - Girone A'}).code,'2DFA');
 assert.equal(competitionContext({ ...group('12'), parent:'Prima Divisione Femminile', 'title-short':'1DFA' }).label, '1DF · Gir. A');
 assert.equal(competitionContext({ id:'12', title:'Serie C Maschile - Girone B' }).label, 'CM · Gir. B');
 assert.equal(competitionContext({ ...group('12','PO1FAS'), parent:'Serie C Maschile', 'title-short':'CMPO1FAS' }).label, 'CM · Gir. PO1FAS');
});
test('preferiti precedenti: categoria ricostruita da calendari/classifiche, senza cambiare nome o chiave', () => {
 const records = [
  { committee:'03008', json:{ data:[group('12'),group('13','B')] } },
  { committee:'03008', json:{ data:{id:'12',title:group('12').title,matches:[{team1:{id:'1'},team2:{id:'2'}}]} } },
  { committee:'03008', json:[{data:{id:'13',title:group('13','B').title,teams:[{id:'1'}]}}] },
  { committee:'03000', json:{data:{id:'99',title:'Serie C Maschile - Girone C',matches:[{team1:{id:'1'}}]}} },
 ];
 const enriched=enrichTeamFavorite(favorite,records);
 assert.equal(enriched.title,favorite.title);assert.equal(enriched.key,favorite.key);
 assert.deepEqual(enriched.contexts.map(context=>context.label),['U19F · Gir. A','U19F · Gir. B']);
 assert.equal(favoriteTitle(enriched),'VOLLEY GENOVA · U19F · Gir. A / U19F · Gir. B');
 assert.deepEqual(enrichTeamFavorite(enriched,[]).contexts,enriched.contexts);
});
test('due squadre con lo stesso nome conservano categorie e gironi distinti', () => {
 const records=[{committee:'03008',json:{data:{...group('12'),matches:[{team1:{id:'1'}}]}}},{committee:'03008',json:{data:{id:'13',title:'Serie D Femminile - Girone B',matches:[{team2:{id:'2'}}]}}}];
 assert.match(favoriteTitle(enrichTeamFavorite(favorite,records)),/U19F.*Gir\. A/);
 assert.match(favoriteTitle(enrichTeamFavorite({...favorite,id:'2'},records)),/DF.*Gir\. B/);
});
