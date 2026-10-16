import test from 'node:test';
import assert from 'node:assert/strict';
import {classify,matches,payload,dateISO,urls,escapeHTML,favoriteKey} from '../src/data.js';
test('risultati live: conserva girone e squadre',()=>{const j={data:{championship:[{id:'12',title:'Serie C', 'championship-matches':[{id:'34',team1:{id:'5',title:'Volley'}}]}]}};assert.equal(classify(j),'live');assert.equal(matches(j)[0].groupId,'12');assert.equal(matches(j)[0].team1.title,'Volley')});
test('calendario e classifica nei due formati FIPAV',()=>{assert.equal(classify({data:{id:'1',matches:[]}}),'calendar');const j=[{data:{id:'1',teams:[]}}];assert.equal(classify(j),'standings');assert.deepEqual(payload(j).teams,[])});
test('rifiuta file estranei e HTML',()=>{for(const j of [{},'<html>',{data:[{id:'4'}]}])assert.throws(()=>classify(j));assert.equal(classify({data:[]}),'groups')});
test('data italiana e URL senza perdere zeri nel comitato',()=>{assert.equal(dateISO({date:'16/10/2026'}),'2026-10-16');assert.ok(urls('live','04000','')[0].endsWith('_04000.json'));assert.equal(urls('calendar','04000','35608').length,2)});
test('contenuti esterni vengono neutralizzati e preferiti isolati per comitato',()=>{assert.equal(escapeHTML('<script>"&'),'&lt;script&gt;&quot;&amp;');assert.notEqual(favoriteKey('team','1','04000'),favoriteKey('team','1','01000'))});


test('campionati separati dai gironi tramite parent-id, con fallback per importazioni',async()=>{
 const {groupInfo,championships,championshipGroups}=await import('../src/data.js');
 const groups=[
  {id:'63840',title:'Prima Divisione Femminile - Girone A',parent:'Prima Divisione Femminile','parent-id':'15527','sub-title':'Girone A'},
  {id:'63841',title:'Prima Divisione Femminile - Girone B',parent:'Prima Divisione Femminile','parent-id':'15527','sub-title':'Girone B'},
  {id:'63842',title:'Seconda Divisione Femminile - Girone A',parent:'Seconda Divisione Femminile','parent-id':'15529','sub-title':'Girone A'}
 ];
 assert.deepEqual(championships(groups),[{id:'15527',title:'Prima Divisione Femminile'},{id:'15529',title:'Seconda Divisione Femminile'}]);
 assert.deepEqual(championshipGroups(groups,'15527').map(g=>g.id),['63840','63841']);
 assert.equal(groupInfo(groups[1]).groupTitle,'Girone B');
 assert.equal(groupInfo({id:'1',title:'Serie C  - Girone A'}).championshipTitle,'Serie C');
 assert.equal(groupInfo({id:'1',title:'Serie C  - Girone A'}).groupTitle,'Girone A');
 assert.equal(groupInfo({id:'1',title:'Serie C'}).groupTitle,'Girone unico');
});


test('loghi società: URL FIPAV assoluti e relativi, fallback per valori mancanti o estranei',async()=>{
 const {teamLogo}=await import('../src/data.js');
 const logo='https://app.fipavonline.it/img/loghi_societa/030080168/logo.jpg?v=1553877387';
 assert.equal(teamLogo({logo}),logo);
 assert.equal(teamLogo({logo:'/img/loghi_societa/1/logo.png'}),'https://app.fipavonline.it/img/loghi_societa/1/logo.png');
 for(const logo of ['',null,42,'javascript:alert(1)','https://example.com/logo.png'])assert.equal(teamLogo({logo}),'');
 assert.equal(teamLogo(null),'');
});
