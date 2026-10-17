import test from 'node:test';
import assert from 'node:assert/strict';
import { customView, viewItems, viewCatalog } from '../src/custom-views.js';
import { favoriteCommittees, favoriteMatches } from '../src/favorite-view.js';

const team={type:'team',id:'1',committee:'03008',title:'Squadra uno'};
const club={type:'club',id:'00001',committee:'03008',title:'Società uno'};

test('viste personalizzate: normalizza selezioni, società condivise e squadre omonime',()=>{
 assert.deepEqual(viewItems([team,team,{...team,committee:'03000'},club,{...club,committee:'03000'},{type:'group',id:'10'},null]).map(item=>`${item.type}:${item.committee}:${item.id}`),['team:03008:1','team:03000:1','club:03000:00001']);
 assert.deepEqual(viewItems([{...team,committee:''},{...team,id:''}]),[]);
 const view=customView('  Le nostre gare  ',[team,club],'saved-id');
 assert.equal(view.id,'saved-id');assert.equal(view.title,'Le nostre gare');
 const persisted=JSON.parse(JSON.stringify(view));
 assert.deepEqual(persisted.items,[team,club]);
 // Le voci salvate restano utilizzabili anche se vengono tolte dai preferiti.
 const updated=customView('Nuovo nome',[club],persisted.id);
 assert.equal(updated.id,view.id);assert.deepEqual(updated.items,[club]);
 assert.throws(()=>customView('   ',[team]),/nome/);
 assert.throws(()=>customView('A'.repeat(81),[team]),/80/);
 assert.throws(()=>customView('Vuota',[]),/Seleziona/);
});

test('viste personalizzate: riutilizza filtri e deduplica gare di squadre e società',()=>{
 const committees=[{id:'03008',region:'Liguria'},{id:'03000',region:'Liguria'},{id:'04000',region:'Lombardia'}];
 const view=customView('Club e squadra',[club,team]);
 assert.deepEqual(favoriteCommittees(view.items,committees).map(item=>item.id),['03008','03000']);
 const record=(committee,id,a,b)=>({committee,json:{data:{id:'10',title:'Girone A',matches:[{id,date:'20/10/2026',team1:a,team2:b}]}}});
 const a={id:'1',title:'Uno',cod_aff_societa:'00001'};
 const b={id:'2',title:'Due',cod_aff_societa:'00002'};
 const records=[record('03008','1',a,b),record('03000','2',{...a,id:'3'},b),record('04000','3',b,b)];
 assert.deepEqual(favoriteMatches(records,view.items).map(game=>game.id),['1','2']);
});

test('catalogo viste: tutte le squadre e società disponibili, con categoria e comitato',()=>{
 const group={id:'10',type:'Calendar',title:'Under 19 Femminile - Girone A',parent:'Under 19 Femminile','sub-title':'Girone A','title-short':'U19FA','sub-title-short':'A'};
 const match={id:'1',date:'20/10/2026',team1:{id:'a',title:'Stesso nome',cod_aff_societa:'00001',nome_societa:'Società uno'},team2:{id:'b',title:'Altra squadra',cod_aff_societa:'00002',nome_societa:'Società due'}};
 const records=[{committee:'03008',json:{data:[group]}},{committee:'03008',json:{data:{...group,matches:[match]}}},{committee:'03000',json:{data:{...group,matches:[match]}}}];
 const catalog=viewCatalog(records);
 assert.equal(catalog.filter(item=>item.type==='club').length,2);
 assert.equal(catalog.filter(item=>item.type==='team').length,4);
 assert.deepEqual(catalog.filter(item=>item.type==='team'&&item.id==='a').map(item=>item.committee),['03008','03000']);
 assert.equal(catalog.find(item=>item.type==='team').contexts[0].label,'U19F · Gir. A');
 assert.deepEqual(viewCatalog([]),[]);
});
