import test from 'node:test';
import assert from 'node:assert/strict';
import {classify,matches,payload,dateISO,urls,escapeHTML,favoriteKey} from '../dist/data.js';
test('risultati live: conserva girone e squadre',()=>{const j={data:{championship:[{id:'12',title:'Serie C', 'championship-matches':[{id:'34',team1:{id:'5',title:'Volley'}}]}]}};assert.equal(classify(j),'live');assert.equal(matches(j)[0].groupId,'12');assert.equal(matches(j)[0].team1.title,'Volley')});
test('calendario e classifica nei due formati FIPAV',()=>{assert.equal(classify({data:{id:'1',matches:[]}}),'calendar');const j=[{data:{id:'1',teams:[]}}];assert.equal(classify(j),'standings');assert.deepEqual(payload(j).teams,[])});
test('rifiuta file estranei e HTML',()=>{for(const j of [{},'<html>',{data:[{id:'4'}]}])assert.throws(()=>classify(j));assert.equal(classify({data:[]}),'groups')});
test('data italiana e URL senza perdere zeri nel comitato',()=>{assert.equal(dateISO({date:'16/10/2026'}),'2026-10-16');assert.ok(urls('live','04000','')[0].endsWith('_04000.json'));assert.equal(urls('calendar','04000','35608').length,2)});
test('contenuti esterni vengono neutralizzati e preferiti isolati per comitato',()=>{assert.equal(escapeHTML('<script>"&'),'&lt;script&gt;&quot;&amp;');assert.notEqual(favoriteKey('team','1','04000'),favoriteKey('team','1','01000'))});
