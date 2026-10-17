import { viewItems, viewCatalog, openCustomViewDialog } from './custom-views.js';
import { renderClubCard } from './club-card.js';
import { competitionContext, enrichTeamFavorite, favoriteTitle } from './team-label.js';
import { favoriteCommittees, favoriteMatches, favoriteTeams } from './favorite-view.js';
import { calendarTeams, initialMonth, monthLabel, renderMonth, shiftMonth, fitMonthGrid } from './calendar.js';
import { collectClubs, matchIsFavorite } from './clubs.js';
import { renderMatchCard } from './match-card.js';
import { filterSchedule, filterPlayedMatches, isPlayedMatch } from './schedule-filters.js';
import { scheduleMatches, combinedRecord } from './schedule.js';
import { registerSW } from 'virtual:pwa-register';
import { createDataSource } from './data-source.js';
const dataSource=createDataSource({mode:import.meta.env.VITE_DATA_SOURCE||'static',base:import.meta.env.BASE_URL,apiBase:import.meta.env.VITE_API_BASE_URL||'/api/v1/'});
import {escapeHTML as e,payload,classify,urls,dateISO,localDate,favoriteKey,groupInfo,championships,championshipGroups,teamLogo} from './data.js';
const $=s=>document.querySelector(s);
const read=(k,f)=>{try{return JSON.parse(localStorage.getItem(k))??f}catch{return f}};
const write=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v));return true}catch{return false}};
let prefs=read('vl-prefs',{committee:'',group:'',favorites:[]});
if(!Array.isArray(prefs.favorites))prefs.favorites=[];
prefs.views=Array.isArray(prefs.views)?prefs.views.filter(view=>view&&typeof view.id==='string'&&typeof view.title==='string').map(view=>({...view,items:viewItems(view.items)})):[];
let tab='calendar',filter='all',query='',date=localDate(),groups=[],record=null,loading=false,request=0,controller;
let standingsReturn=null,hidePlayed=false;
let committeeList=[],selectedFavorite=null,detailRecords=[],profileTeamsOpen=true;
const clubExpansions=new Map();
const exportSelection=new Map();
let teamFilter='',calendarMonth='',selectedCalendarDay='',calendarView='list';
let dateScope=read('vl-date-scope',calendarView==='list'?'all':'day');
if(!['all','day'].includes(dateScope))dateScope='day';
const cacheKey=(kind,c=prefs.committee,g=prefs.group)=>`vl-data:${c}:${kind}:${kind==='live'||kind==='groups'?'':g}`;
const savePrefs=()=>write('vl-prefs',prefs);
const empty=(title,text,button='')=>`<div class="empty"><h3>${e(title)}</h3><p>${e(text)}</p>${button}</div>`;
const message=(text,help=false)=>{$('#notice').innerHTML=text?`<div class="notice">${e(text)} ${help?'<button id="notice-help">Apri dati e importazione ↗</button>':''}</div>`:'';$('#notice-help')?.addEventListener('click',openHelp)};
const activeCustomView=()=>prefs.views.find(view=>tab===`view:${view.id}`);
const isAggregateView=()=>tab==='favorite-matches'||tab.startsWith('view:');
const aggregateItems=()=>activeCustomView()?.items||prefs.favorites.filter(favorite=>favorite.type==='team');
function updateNavigation(){
 const current=tab==='favorite-detail'?'favorites':tab;
 document.querySelectorAll('nav [data-tab]').forEach(button=>{button.classList.toggle('active',button.dataset.tab===current);button.setAttribute('aria-current',button.dataset.tab===current?'page':'false')});
}
function renderCustomNavigation(){
 $('#custom-views').innerHTML=prefs.views.map(view=>`<button data-tab="${e(`view:${view.id}`)}" title="${e(view.title)}"><span aria-hidden="true">▦</span><span class="nav-label">${e(view.title)}</span></button>`).join('');
 updateNavigation();
}
function editCustomView(view=null,{emptySelection=false}={}){
 const selected=view?.items||(emptySelection?[]:[...exportSelection.values()]);
 const records=favoriteContextRecords();
 openCustomViewDialog({view:view||{title:'',items:selected},items:viewItems([...viewCatalog(records),...prefs.favorites,...selected]).map(item=>enrichTeamFavorite(item,records)),committees:committeeList,committee:prefs.committee,loadItems:async(committee,signal)=>{
  const {loadExportRecords}=await import('./export-data.js');
  const result=await loadExportRecords({source:dataSource,committees:committeeList.filter(item=>item.id===committee),cached:cachedScheduleRecords(),signal});
  return {items:viewCatalog(result.records),issues:result.issues};
 },onSave:saved=>{
  const previous=prefs.views;
  prefs.views=view?prefs.views.map(item=>item.id===view.id?saved:item):[...prefs.views,saved];
  if(!savePrefs()){prefs.views=previous;throw new Error('Memoria locale piena: impossibile salvare la vista.');}
  renderCustomNavigation();switchTab(`view:${saved.id}`);
 }});
}
$('#save-custom-view').onclick=()=>editCustomView();
$('#create-custom-view').onclick=()=>editCustomView(null,{emptySelection:true});
$('#edit-custom-view').onclick=()=>{const view=activeCustomView();if(view)editCustomView(view)};
$('#delete-custom-view').onclick=()=>{
 const view=activeCustomView();if(!view)return;
 const previous=prefs.views;prefs.views=prefs.views.filter(item=>item.id!==view.id);
 if(!savePrefs()){prefs.views=previous;message('Impossibile eliminare la vista dalla memoria locale.');return;}
 renderCustomNavigation();switchTab('favorites');
};
function setConnection(){$('#connection').textContent=navigator.onLine?'Online':'Offline';$('#connection').classList.toggle('offline',!navigator.onLine)}

function updateGroups(){
 const selected=groups.find(group=>String(group.id)===prefs.group);
 if(selected)prefs.championship=groupInfo(selected).championshipId;
 const options=championships(groups);
 if(!options.some(option=>option.id===prefs.championship))prefs.championship='';
 const championship=$('#championship');
 championship.innerHTML=(tab==='calendar'?'<option value="">Tutti i campionati</option>':'<option value="">Scegli un campionato</option>')+options.map(option=>`<option value="${e(option.id)}">${e(option.title)}</option>`).join('');
 championship.value=prefs.championship;
 const available=prefs.championship?championshipGroups(groups,prefs.championship):groups;
 const select=$('#group');
 select.innerHTML=(tab==='calendar'?'<option value="">Tutti i gironi</option>':'<option value="">Scegli un girone</option>')+available.map(group=>`<option value="${e(group.id)}">${e(!prefs.championship?`${groupInfo(group).championshipTitle} · ${groupInfo(group).groupTitle}`:groupInfo(group).groupTitle)}</option>`).join('');
 select.disabled=tab==='standings'&&!prefs.championship;select.value=prefs.group;savePrefs();
}
function fetchData(kind,signal,group=prefs.group){return dataSource.get(kind,{committee:prefs.committee,group,signal})}
async function loadGroups(signal){try{const rec=await fetchData('groups',signal);if(signal.aborted)return;groups=rec.json.data;write(cacheKey('groups'),rec);updateGroups()}catch{if(signal.aborted)return;groups=read(cacheKey('groups'),null)?.json?.data||[];updateGroups()}}

async function loadSchedule(signal,seq){
 loading=true;$('#refresh').disabled=true;
 groups=read(cacheKey('groups'),null)?.json?.data||[];updateGroups();
 let records=[];
 // Mostra subito anche i calendari importati e quelli già consultati offline.
 for(let i=0;i<localStorage.length;i++){const key=localStorage.key(i);if(key.startsWith(`vl-data:${prefs.committee}:calendar:`)){const rec=read(key,null);if(rec)records.push(rec)}}
 const live=read(cacheKey('live'),null);if(live)records.push(live);
 if(records.length){record=combinedRecord(records);render()}else $('#results').innerHTML=empty('Caricamento','Recupero delle partite.');
 try{
  await loadGroups(signal);if(signal.aborted)return;
  let missing=0,index=0;
  const calendars=[];
  await Promise.all(Array.from({length:Math.min(4,groups.length)},async()=>{
   while(index<groups.length&&!signal.aborted){const group=groups[index++];try{const rec=await fetchData('calendar',signal,String(group.id));if(signal.aborted)return;calendars.push(rec);write(cacheKey('calendar',prefs.committee,String(group.id)),rec)}catch{missing++}}
  }));
  if(signal.aborted)return;
  const refreshed=new Set(calendars.map(rec=>String(payload(rec.json)?.id)));
  records=records.filter(rec=>!refreshed.has(String(payload(rec.json)?.id)));
  records.push(...calendars);
  try{const rec=await fetchData('live',signal);if(signal.aborted)return;records=records.filter(rec=>!Array.isArray(payload(rec.json)?.championship));records.push(rec);write(cacheKey('live'),rec)}catch{}
  if(seq!==request||signal.aborted)return;
  record=records.length?combinedRecord(records):null;
  if(missing)message(`${missing} gironi senza calendario aggiornato. Le partite mostrate provengono dai dati disponibili.`,true);
  else if(!groups.length)message('Elenco gironi non disponibile. Le partite mostrate provengono dai dati salvati.',true);
 }finally{if(seq===request){loading=false;$('#refresh').disabled=false;render()}}
}

async function load(){
 controller?.abort();controller=new AbortController();const signal=controller.signal,seq=++request;loading=false;$('#refresh').disabled=false;
 record=null;message('');$('#selection-tools').hidden=true;
 $('#content').dataset.view=tab.startsWith('view:')?'custom-view':tab;
 $('#custom-view-actions').hidden=!activeCustomView();

 $('#calendar-tools').hidden=true;$('#team-wrap').hidden=tab!=='calendar';$('.search').hidden=tab!=='clubs';
 if(tab==='calendar')updateTeamOptions([]);
 $('#championship-wrap').hidden=!['calendar','standings'].includes(tab);$('#group-wrap').hidden=!['calendar','standings'].includes(tab);$('.segmented').hidden=tab!=='calendar';
 $('#standings-back').hidden=tab!=='standings'||!standingsReturn;
 $('#favorite-back').hidden=tab!=='favorite-detail';
 const titles={calendar:['Calendario','Partite del comitato selezionato.','Partite'],standings:['Classifica','Classifica del girone selezionato.','Classifica'],clubs:['Società','Società presenti nei calendari del comitato.','Società'],favorites:['Preferiti','Società, squadre e gironi salvati.','Preferiti'],'favorite-matches':['Partite preferiti','Tutte le date e i comitati delle squadre salvate.','Partite']};
 const t=activeCustomView()?[activeCustomView().title,'Partite delle squadre e società selezionate.','Partite']:tab==='favorite-detail'?[selectedFavorite?.title||'Preferito',selectedFavorite?.type==='club'?'Società · Tutte le squadre e i comitati della regione.':'Squadra · Tutte le partite disponibili.','Partite']:titles[tab];$('#page-title').textContent=t[0];$('#subtitle').textContent=t[1];$('#list-title').textContent=t[2];
 if(tab==='favorites'){render();return}
 if(tab==='favorite-detail'){if(!selectedFavorite){switchTab('favorites');return}await loadFavoriteSchedule(signal,seq,[selectedFavorite]);return}
 if(isAggregateView()){if(tab.startsWith('view:')&&!activeCustomView()){switchTab('favorites');return}await loadFavoriteSchedule(signal,seq,aggregateItems());return}
 if(!prefs.committee){render();return}
 if(tab==='calendar'||tab==='clubs'){await loadSchedule(signal,seq);return}
 if(tab==='standings'){
  groups=read(cacheKey('groups'),null)?.json?.data||[];updateGroups();
  if(!groups.length){await loadGroups(signal);if(seq!==request||signal.aborted)return}
  if(!prefs.group){$('#results').innerHTML=empty(prefs.championship?'Seleziona un girone':'Seleziona un campionato','Scegli campionato e girone per vedere la classifica.');$('#updated').textContent='';loading=true;$('#refresh').disabled=true;await loadGroups(signal);if(seq===request){loading=false;$('#refresh').disabled=false;if(!groups.length)message('Elenco gironi non raggiungibile. Puoi importare il JSON dei gironi FIPAV.',true)}return}
 }
 loading=true;$('#refresh').disabled=true;record=read(cacheKey(tab),null);if(record)record={...record,fromCache:true};render();if(!record)$('#results').innerHTML=empty('Caricamento','Recupero dei dati FIPAV.');
 const timeout=setTimeout(()=>controller?.signal===signal&&controller.abort(),18000);
 try{const rec=await fetchData(tab,signal);if(seq!==request)return;record=rec;if(!write(cacheKey(tab),record))message('Memoria locale piena: i dati sono visibili ma non verranno conservati offline.');}
 catch(err){if(seq!==request)return;message(navigator.onLine?'Aggiornamento non riuscito. Riprova più tardi o importa un file JSON FIPAV.':'Offline. Sono disponibili i dati salvati.',true)}
 finally{clearTimeout(timeout);if(seq===request){loading=false;$('#refresh').disabled=false;render()}}
}
function isFavorite(type,id,committee=prefs.committee){return prefs.favorites.some(x=>x.key===favoriteKey(type,id,committee))}
function star(type,id,title,logo='',committee=prefs.committee){if(!id)return '';return `<button class="star ${isFavorite(type,id,committee)?'selected':''}" data-fav-type="${e(type)}" data-fav-id="${e(id)}" data-fav-title="${e(title)}" data-fav-logo="${e(logo)}" data-fav-committee="${e(committee)}" aria-pressed="${isFavorite(type,id,committee)}" aria-label="${type==='club'?'Società preferita':'Preferito'}: ${e(title)}">${isFavorite(type,id,committee)?'★':'☆'}</button>`}
const fallbackLogo=`${import.meta.env.BASE_URL}club.svg`;
function clubLogo(team){return `<img class="team-logo" src="${e(teamLogo(team)||fallbackLogo)}" alt="" width="32" height="32" loading="lazy" decoding="async" referrerpolicy="no-referrer">`}
document.addEventListener('error',event=>{const img=event.target;if(img instanceof HTMLImageElement&&img.classList.contains('team-logo')&&!img.dataset.fallback){img.dataset.fallback='true';img.src=fallbackLogo}},true);
function matchCard(match){return renderMatchCard({...match,committeeId:match.committeeId||prefs.committee},{logo:clubLogo,star:(type,id,title,logo)=>star(type,id,title,logo,match.committeeId||prefs.committee)})}
function favoriteContextRecords(){
 const records=[...detailRecords];
 for(let i=0;i<localStorage.length;i++){const key=localStorage.key(i);if(key.startsWith('vl-data:')){const rec=read(key,null);if(rec)records.push({...rec,committee:key.split(':')[1]})}}
 if(record&&prefs.committee&&tab!=='favorite-detail'&&!isAggregateView())records.push({...record,committee:prefs.committee});
 return records;
}
function contextBadges(favorite){return (favorite.contexts||[]).map(context=>`<span class="team-context-label" title="${e(context.title)}">${e(context.label)}</span>`).join('')}
function teamName(team,committee,records){
 const favorite=enrichTeamFavorite({type:'team',id:String(team.id),title:team.title,committee,contexts:team.contexts||[]},records);
 return `${e(team.title)} ${contextBadges(favorite)}`;
}

function societyCard(club,records){
 return renderClubCard(club,{
  open:clubExpansions.get(favoriteKey('club',club.id,club.committee))!==false,
  logo:clubLogo,star,selectionAction:selectionCheckbox,
  teamName:(team,committee)=>teamName(team,committee,records),
  committeeTitle:id=>committeeList.find(committee=>committee.id===id)?.title||'',
 });
}
function savedClub(favorite,records){
 return societyCard({...favorite,teams:favoriteTeams(favoriteMatches(records,favorite),favorite)},records);
}

function render(){
 $('#fav-count').textContent=prefs.favorites.length;
 $('#hide-played-wrap').hidden=!['calendar','favorite-detail'].includes(tab)&&!isAggregateView();
 $('#hide-played').checked=hidePlayed;
 const exportable=Boolean((isAggregateView()&&aggregateItems().length)||prefs.committee&&(tab==='favorite-detail'||(tab==='calendar'&&teamFilter.startsWith('id:'))));
 $('#view-export').hidden=!exportable;
 $('#calendar-tools').hidden=tab!=='calendar'||!record;
 if(tab==='favorites'){
 const contextRecords=favoriteContextRecords();
 const knownClubs=new Map(collectClubs(scheduleMatches(contextRecords)).map(club=>[club.id,club]));
 const enriched=prefs.favorites.map(f=>{const club=f.type==='club'?knownClubs.get(f.id):null;return club&&club.title!=='Società non indicata'?{...f,title:club.title,logo:club.logo||f.logo}:enrichTeamFavorite(f,contextRecords)});
 if(JSON.stringify(enriched)!==JSON.stringify(prefs.favorites)){prefs.favorites=enriched;savePrefs()}
 const favoriteOrder={team:0,club:1,group:2};
 const favs=prefs.favorites.filter(f=>f.type==='club'||!prefs.committee||f.committee===prefs.committee)
  .sort((a,b)=>(favoriteOrder[a.type]??3)-(favoriteOrder[b.type]??3));
 $('#updated').textContent='Salvati su questo dispositivo';
 $('#results').innerHTML=favs.length?favs.map(f=>f.type==='club'?savedClub(f,contextRecords):`<article class="saved">${f.type==='team'?selectionCheckbox('team',f.id,f.title,f.committee):''}<button class="saved-open" data-open-favorite="${e(f.key)}" aria-label="Apri ${e(favoriteTitle(f))}"><span><small>${f.type==='team'?'SQUADRA':'GIRONE'}</small><strong>${e(f.title)} ${contextBadges(f)}</strong></span><span aria-hidden="true">↗</span></button><button class="action-delete" data-remove="${e(f.key)}" aria-label="Rimuovi ${e(f.title)}">×</button></article>`).join(''):empty('Nessun preferito','Usa la stella accanto a una società, squadra o girone per salvarli.');
 bindCards();return;
 }
 if(tab==='favorite-detail'||isAggregateView()){
  $('#updated').textContent=record?`Dati dal · ${new Date(record.at).toLocaleString('it-IT',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})}`:'';
  if(isAggregateView())renderFavoriteMatches();else renderFavoriteDetail();return;
 }
 if(!prefs.committee){$('#updated').textContent='';$('#results').innerHTML=empty('Seleziona un comitato','Scegli il comitato dal menu.');return}
 $('#updated').textContent=record?`${record.source==='schedule'?'Dati dal':record.source==='snapshot'?'Scaricati da FIPAV':record.source==='import'?'Importati':record.source==='network'&&!record.fromCache?'Ricevuti':'Salvati'} · ${new Date(record.at).toLocaleString('it-IT',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})}`:'';
 if(!record){$('#results').innerHTML=empty('Nessun dato disponibile','Aggiorna oppure importa un file JSON FIPAV.','<button id="empty-import">Importa dati</button>');$('#empty-import').onclick=openHelp;return}
 if(tab==='clubs'){renderClubs();return}
 if(tab==='standings'){
 const d=payload(record.json),teams=d?.teams||[];const rows=teams;$('#results').innerHTML=teams.length?`${groupHeading(prefs.group,d.title||d.descrizione||'Classifica')}<div class="table-scroll"><table><caption class="skip">Classifica del girone</caption><thead><tr>${['Pos.','Squadra','Punti','G','V','P','SV','SP'].map(h=>`<th scope="col">${h}</th>`).join('')}</tr></thead><tbody>${rows.map((t,i)=>`<tr><td>${e(t.pos??i+1)}</td><td><div class="standing-team">${clubLogo(t)}<span>${e(t.title||t.squadra||t.nome_squadra)}</span>${star('team',t.id,t.title||t.squadra||t.nome_squadra)}</div></td>${['p','g','gv','gp','sv','sp'].map(k=>`<td>${e(t[k]??0)}</td>`).join('')}</tr>`).join('')}</tbody></table></div><p class="fine">G: gare · V: vinte · P: perse · SV / SP: set vinti / persi</p>`:empty('Classifica non pubblicata','Non ci sono squadre nella risposta ricevuta.');bindCards();return}
 const scoped=filterSchedule(scheduleMatches([record]),{groups,championship:prefs.championship,group:prefs.group});
 updateTeamOptions(scoped);
 const all=filterSchedule(scoped,{team:teamFilter,day:calendarView==='list'&&dateScope==='day'?date:'',hidePlayed});
 const list=all.filter(m=>(filter!=='live'||Number(m.is_live)===1)&&(filter!=='favorites'||matchIsFavorite(m,prefs.favorites,prefs.committee)));
 $('#list-title').textContent=`${list.length} ${list.length===1?'partita':'partite'}`;
 $('#view-export').hidden=!teamFilter.startsWith('id:');
 updateCalendarTools();
 if(calendarView==='month'){renderCalendarGrid(list);return}
 $('#results').innerHTML=list.length?(prefs.group?groupHeading(prefs.group,'Girone '+prefs.group):'')+datedMatches(list):empty('Nessuna gara trovata','Modifica la data o i filtri.');bindCards();
}

function updateTeamOptions(games){
 const contexts=new Map();
 for(const game of games){
  const context=competitionContext(groups.find(group=>String(group.id)===game.groupId)||{id:game.groupId,title:game.groupTitle}).label;
  for(const team of [game.team1,game.team2])if(team?.id){const key=`id:${team.id}`;if(!contexts.has(key))contexts.set(key,new Set());contexts.get(key).add(context)}
 }
 const options=calendarTeams(games);const select=$('#team');
 // Durante il caricamento non si perde il filtro selezionato.
 if(games.length&&!options.some(team=>team.id===teamFilter))teamFilter='';
 select.innerHTML='<option value="">Tutte le squadre</option>'+options.map(team=>`<option value="${e(team.id)}">${e(`${team.title} · ${[...(contexts.get(team.id)||[])].join(' / ')}`)}</option>`).join('');
 select.value=teamFilter;select.disabled=!options.length;
}
function updateCalendarTools(){
 $('#calendar-tools').hidden=false;$('#month-navigation').hidden=calendarView!=='month';$('#list-navigation').hidden=calendarView!=='list';$('#day-navigation').hidden=dateScope!=='day';
 document.querySelectorAll('[data-date-scope]').forEach(button=>{const selected=button.dataset.dateScope===dateScope;button.classList.toggle('active',selected);button.setAttribute('aria-pressed',String(selected))});
 document.querySelectorAll('[data-calendar-view]').forEach(button=>{const selected=button.dataset.calendarView===calendarView;button.classList.toggle('active',selected);button.setAttribute('aria-pressed',String(selected))});
}
function renderCalendarGrid(games){
 if(!calendarMonth)calendarMonth=initialMonth(games);
 $('#month-title').textContent=monthLabel(calendarMonth);
 const inMonth=games.filter(game=>dateISO(game).startsWith(calendarMonth));
 if(!selectedCalendarDay.startsWith(calendarMonth))selectedCalendarDay=dateISO(inMonth.find(game=>dateISO(game)>=localDate())||inMonth[0]||{});
 const selected=games.filter(game=>dateISO(game)===selectedCalendarDay);
 const undated=games.filter(game=>!/^\d{4}-\d{2}-\d{2}$/.test(dateISO(game)));
 $('#list-title').textContent=`${inMonth.length} ${inMonth.length===1?'partita':'partite'} nel mese · ${games.length} totali`;
 $('#results').innerHTML=(prefs.group?groupHeading(prefs.group,'Girone '+prefs.group):'')+renderMonth(games,{month:calendarMonth,selectedDay:selectedCalendarDay})+
 (selectedCalendarDay?`<section id="calendar-day-detail" class="calendar-day-detail"><h3 class="date-heading">${e(new Date(selectedCalendarDay+'T12:00:00').toLocaleDateString('it-IT',{weekday:'long',day:'numeric',month:'long'}))}</h3>${selected.length?selected.map(matchCard).join(''):empty('Nessuna partita','Nessuna gara per questo giorno e per i filtri selezionati.')}</section>`:empty('Nessuna partita nel mese','Cambia mese o filtro squadra.'))+
 (undated.length?`<h3 class="date-heading">Data da definire</h3>${undated.map(matchCard).join('')}`:'');
 fitMonthGrid($('.month-grid'));
 document.querySelectorAll('[data-calendar-day]').forEach(button=>button.onclick=()=>{selectedCalendarDay=button.dataset.calendarDay;date=selectedCalendarDay;dateScope='day';write('vl-date-scope',dateScope);$('#date').value=date;render();$('#calendar-day-detail')?.scrollIntoView({behavior:'smooth',block:'start'})});
 bindCards();
}
$('#hide-played').onchange=()=>{hidePlayed=$('#hide-played').checked;render()};
for(const button of document.querySelectorAll('[data-date-scope]'))button.onclick=()=>{dateScope=button.dataset.dateScope;write('vl-date-scope',dateScope);render()};
$('#team').onchange=()=>{teamFilter=$('#team').value;selectedCalendarDay='';render()};
for(const button of document.querySelectorAll('[data-calendar-view]'))button.onclick=()=>{calendarView=button.dataset.calendarView;if(calendarView==='month'){calendarMonth=date.slice(0,7);selectedCalendarDay=date}render()};
for(const [id,step] of [['month-prev',-1],['month-next',1]])$('#'+id).onclick=()=>{calendarMonth=shiftMonth(calendarMonth||initialMonth([]),step);selectedCalendarDay='';render()};
window.addEventListener('resize',()=>requestAnimationFrame(()=>fitMonthGrid($('.month-grid'))));
$('#month-current').onclick=()=>{calendarMonth=localDate().slice(0,7);selectedCalendarDay='';render()};

function renderClubs(){
 const contextRecords=favoriteContextRecords();
 const clubs=collectClubs(scheduleMatches([record])).filter(club=>`${club.title} ${club.id} ${club.teams.map(team=>team.title).join(' ')}`.toLocaleLowerCase('it').includes(query));
 $('#list-title').textContent=`${clubs.length} società`;
 $('#results').innerHTML=clubs.length?clubs.map(club=>societyCard({...club,committee:prefs.committee,teams:club.teams.map(team=>({...team,committee:prefs.committee}))},contextRecords)).join(''):empty('Nessuna società trovata','Le società sono ricavate dai calendari disponibili. Modifica la ricerca o il comitato.');
 bindCards();
}

function groupHeading(id,title){
 const group=groups.find(group=>String(group.id)===String(id));
 if(!group)return `<div class="group-heading">${e(title)}${star('group',id,title)}</div>`;
 const info=groupInfo(group);
 return `<div class="group-heading"><div><span class="championship-name">${e(info.championshipTitle)}</span><strong>${e(info.groupTitle)}</strong></div>${star('group',id,`${info.championshipTitle} - ${info.groupTitle}`)}</div>`;
}
function bindCards(){
 updateExportSelection();
 document.querySelectorAll('[data-match-standings]').forEach(button=>button.onclick=()=>{
  standingsReturn={tab,committee:prefs.committee,group:prefs.group,championship:prefs.championship,filter,teamFilter,calendarMonth,selectedCalendarDay,date,calendarView,dateScope};
  prefs.committee=button.dataset.committee;prefs.group=button.dataset.matchStandings;prefs.championship='';
  $('#committee').value=prefs.committee;savePrefs();switchTab('standings',{fromMatch:true});
  $('#page-title').scrollIntoView({block:'start'});
 });
 document.querySelectorAll('[data-club-expansion]').forEach(details=>details.ontoggle=()=>clubExpansions.set(details.dataset.clubExpansion,details.open));
 document.querySelectorAll('[data-open-club]').forEach(button=>button.onclick=()=>openFavorite({type:'club',id:button.dataset.openClub,title:button.dataset.clubTitle,logo:button.dataset.clubLogo||'',committee:button.dataset.clubCommittee}));
 document.querySelectorAll('[data-fav-id]').forEach(button=>button.onclick=()=>{
  const committee=button.dataset.favCommittee||prefs.committee;
  const key=favoriteKey(button.dataset.favType,button.dataset.favId,committee);
  if(isFavorite(button.dataset.favType,button.dataset.favId,committee))prefs.favorites=prefs.favorites.filter(f=>f.key!==key);
  else prefs.favorites.push(enrichTeamFavorite({key,type:button.dataset.favType,id:button.dataset.favId,title:button.dataset.favTitle,committee,logo:button.dataset.favLogo||''},favoriteContextRecords()));
  savePrefs();render();
 });
 document.querySelectorAll('[data-remove]').forEach(button=>button.onclick=()=>{prefs.favorites=prefs.favorites.filter(f=>f.key!==button.dataset.remove);savePrefs();render()});
 document.querySelectorAll('[data-open-team]').forEach(button=>button.onclick=()=>openFavorite({type:'team',id:button.dataset.openTeam,title:button.dataset.teamTitle,logo:button.dataset.teamLogo||'',committee:button.dataset.teamCommittee}));
 document.querySelectorAll('[data-open-favorite]').forEach(button=>button.onclick=()=>{const favorite=prefs.favorites.find(f=>f.key===button.dataset.openFavorite);if(favorite)openFavorite(favorite)});
}
function openFavorite(favorite){
 if(favorite.type==='group'){prefs.committee=favorite.committee;prefs.group=favorite.id;$('#committee').value=prefs.committee;savePrefs();calendarView='list';dateScope='all';write('vl-date-scope',dateScope);switchTab('calendar');return}
 selectedFavorite=enrichTeamFavorite({...favorite},favoriteContextRecords());detailRecords=[];profileTeamsOpen=true;switchTab('favorite-detail');
 $('#page-title').scrollIntoView({block:'start'});
}
$('#favorite-back').onclick=()=>switchTab('favorites');
$('#standings-back').onclick=()=>{
 if(!standingsReturn)return;
 const previous=standingsReturn;Object.assign(prefs,{committee:previous.committee,group:previous.group,championship:previous.championship});
 teamFilter=previous.teamFilter;calendarMonth=previous.calendarMonth;selectedCalendarDay=previous.selectedCalendarDay;date=previous.date;calendarView=previous.calendarView;dateScope=previous.dateScope;filter=previous.filter;
 $('#date').value=date;document.querySelectorAll('[data-filter]').forEach(button=>button.classList.toggle('active',button.dataset.filter===filter));
 $('#committee').value=prefs.committee;savePrefs();switchTab(previous.tab,{preserveFilter:true});
};
async function loadFavoriteSchedule(signal,seq,favorites){
 const targets=favoriteCommittees(favorites,committeeList);const targetIds=new Set(targets.map(target=>target.id));
 const records=new Map();let missing=0;
 const cacheRecord=(key,rec,committee,title)=>{if(rec)records.set(key,{...rec,committee,committeeTitle:title})};
 for(let i=0;i<localStorage.length;i++){
  const key=localStorage.key(i);const parts=key.split(':');
  if(parts[0]==='vl-data'&&targetIds.has(parts[1])&&['calendar','live'].includes(parts[2]))cacheRecord(key,read(key,null),parts[1],targets.find(target=>target.id===parts[1])?.title);
 }
 const show=()=>{detailRecords=[...records.values()];record=detailRecords.length?combinedRecord(detailRecords):null;render()};
 loading=true;$('#refresh').disabled=true;show();
 try{
  for(const target of targets){
   if(signal.aborted||seq!==request)return;
   let list=read(cacheKey('groups',target.id),null)?.json?.data||[];
   try{const rec=await dataSource.get('groups',{committee:target.id,signal});if(signal.aborted)return;list=rec.json.data;write(cacheKey('groups',target.id),rec)}catch{if(signal.aborted)return;missing++}
   let index=0;
   await Promise.all(Array.from({length:Math.min(4,list.length)},async()=>{
    while(index<list.length&&!signal.aborted){const group=list[index++];try{const rec=await dataSource.get('calendar',{committee:target.id,group:String(group.id),signal});if(signal.aborted)return;const key=cacheKey('calendar',target.id,String(group.id));cacheRecord(key,rec,target.id,target.title);write(key,rec)}catch{if(!signal.aborted)missing++}}
   }));
   try{const rec=await dataSource.get('live',{committee:target.id,signal});if(signal.aborted)return;const key=cacheKey('live',target.id);cacheRecord(key,rec,target.id,target.title);write(key,rec)}catch{}
   if(seq===request&&!signal.aborted)show();
  }
  if(missing&&seq===request)message('Alcuni calendari non sono disponibili. La vista include le partite recuperate e quelle salvate.',true);
 }finally{if(seq===request){loading=false;$('#refresh').disabled=false;render()}}
}
function datedMatches(games){
 const dates=new Map();
 for(const game of games){const day=dateISO(game)||'da-definire';if(!dates.has(day))dates.set(day,[]);dates.get(day).push(game)}
 return [...dates].map(([day,list])=>`<h3 class="date-heading">${e(day==='da-definire'?'Data da definire':new Date(day+'T12:00:00').toLocaleDateString('it-IT',{weekday:'long',day:'numeric',month:'long',year:'numeric'}))}</h3>${list.map(matchCard).join('')}`).join('');
}
function renderFavoriteMatches(){
 const favorites=aggregateItems();
 const games=filterPlayedMatches(favoriteMatches(detailRecords,favorites),hidePlayed);
 $('#list-title').textContent=`${games.length} ${games.length===1?'partita':'partite'} · ${favorites.length} ${activeCustomView()?'voci':favorites.length===1?'squadra':'squadre'}`;
 $('#results').innerHTML=games.length?datedMatches(games):empty(!favorites.length?'Nessuna squadra preferita':loading?'Caricamento':'Nessuna partita disponibile',!favorites.length?'Salva le squadre usando la stella accanto al nome.':loading?'Recupero dei calendari.':hidePlayed?'Nessuna partita da mostrare con il filtro attivo.':'Non sono presenti partite per la selezione nei calendari disponibili.');
 bindCards();
}
function renderFavoriteDetail(){
 if(!selectedFavorite)return;
 const contextRecords=favoriteContextRecords();
 selectedFavorite=enrichTeamFavorite(selectedFavorite,contextRecords);
 $('#page-title').textContent=favoriteTitle(selectedFavorite);
 const allGames=favoriteMatches(detailRecords,selectedFavorite);const teams=favoriteTeams(allGames,selectedFavorite);
 const games=filterPlayedMatches(allGames,hidePlayed);
 const played=allGames.filter(isPlayedMatch).length;
 $('#list-title').textContent=`${games.length} ${games.length===1?'partita':'partite'}`;
 const team=teams[0];const logo=selectedFavorite.logo||team?.logo||'';
 const header=`<div class="favorite-profile"><div class="favorite-profile-heading">${clubLogo({logo})}<div><span>${selectedFavorite.type==='club'?'Società':'Squadra'}</span><strong>${e(selectedFavorite.title)} ${contextBadges(selectedFavorite)}</strong>${selectedFavorite.type==='club'?`<small>Codice società: ${e(selectedFavorite.id)}</small>`:''}</div>${star(selectedFavorite.type,selectedFavorite.id,selectedFavorite.title,logo,selectedFavorite.committee)}</div><div class="favorite-stats"><span><strong>${allGames.length}</strong> partite</span><span><strong>${played}</strong> terminate</span><span><strong>${allGames.length-played}</strong> da completare</span></div></div>`;
 const teamList=selectedFavorite.type==='club'&&teams.length?`<details class="favorite-team-list profile-team-expansion" ${profileTeamsOpen?'open':''}><summary>Squadre (${teams.length})</summary>${teams.map((item,index)=>`<div class="favorite-team-row">${selectionCheckbox('team',String(item.id),item.title,item.committee)}<button class="favorite-team-open" data-profile-team="${index}">${clubLogo(item)}<span><strong>${teamName(item,item.committee,contextRecords)}</strong><small>${e(committeeList.find(committee=>committee.id===item.committee)?.title||'')}</small></span><span aria-hidden="true">↗</span></button>${star('team',String(item.id),item.title,item.logo||'',item.committee)}</div>`).join('')}</details>`:'';
 $('#results').innerHTML=header+teamList+(games.length?datedMatches(games):empty(loading?'Caricamento':'Nessuna partita disponibile',loading?'Recupero dei calendari.':hidePlayed?'Nessuna partita da mostrare con il filtro attivo.':'Non sono presenti partite per questo preferito nei calendari disponibili.'));
 const expansion=$('.profile-team-expansion');if(expansion)expansion.ontoggle=()=>{profileTeamsOpen=expansion.open};
 document.querySelectorAll('[data-profile-team]').forEach(button=>button.onclick=()=>{const item=teams[Number(button.dataset.profileTeam)];openFavorite({type:'team',id:String(item.id),title:item.title,logo:item.logo||'',committee:item.committee})});
 bindCards();
}
function switchTab(next,{fromMatch=false,preserveFilter=false}={}){if(tab!==next)exportSelection.clear();if(!fromMatch)standingsReturn=null;if(tab!==next&&!preserveFilter){query='';$('#search').value='';filter='all';document.querySelectorAll('[data-filter]').forEach(b=>b.classList.toggle('active',b.dataset.filter==='all'))}tab=next;updateNavigation();load()}
function openHelp(){const kinds=prefs.group?['live','groups','calendar','standings']:['live','groups'];$('#source-links').innerHTML=prefs.committee?kinds.flatMap(k=>urls(k,prefs.committee,prefs.group).map((url,i)=>`<a href="${e(url)}" target="_blank" rel="noopener">Apri JSON ${e({live:'risultati',groups:'gironi',calendar:'calendario',standings:'classifica'}[k])}${i?' (API)':''} ↗</a>`)).join(''):'<p>Seleziona un comitato per aprire le sorgenti JSON.</p>';$('#help').showModal()}
$('#committee').onchange=()=>{exportSelection.clear();prefs.committee=$('#committee').value;prefs.group='';prefs.championship='';groups=[];teamFilter='';calendarMonth='';selectedCalendarDay='';savePrefs();load()};$('#championship').onchange=()=>{prefs.championship=$('#championship').value;prefs.group='';teamFilter='';calendarMonth='';selectedCalendarDay='';updateGroups();savePrefs();if(tab==='calendar')render();else load()};$('#group').onchange=()=>{prefs.group=$('#group').value;teamFilter='';calendarMonth='';selectedCalendarDay='';updateGroups();savePrefs();if(tab==='calendar')render();else load()};
$('#refresh').onclick=load;$('#info').onclick=openHelp;$('#search').oninput=ev=>{query=ev.target.value.toLocaleLowerCase('it').trim();render()};$('#date').value=date;$('#date').onchange=ev=>{date=ev.target.value||localDate();$('#date').value=date;render()};$('#today-button').onclick=()=>{date=localDate();$('#date').value=date;render()};
for(const [id,step] of [['day-prev',-1],['day-next',1]])$('#'+id).onclick=()=>{const d=new Date(date+'T12:00:00');d.setDate(d.getDate()+step);date=localDate(d);$('#date').value=date;render()};
$('nav').onclick=event=>{const button=event.target.closest('[data-tab]');if(button)switchTab(button.dataset.tab)};
for(const b of document.querySelectorAll('[data-filter]'))b.onclick=()=>{filter=b.dataset.filter;document.querySelectorAll('[data-filter]').forEach(x=>x.classList.toggle('active',x===b));render()};
$('#import').onchange=async ev=>{const file=ev.target.files[0];if(!file)return;try{if(file.size>8*1024*1024)throw new Error('Il file supera il limite di 8 MB.');if(!prefs.committee)throw new Error('Seleziona prima il comitato.');const json=JSON.parse(await file.text());const kind=classify(json);const d=payload(json);const cid=d?.['commettee-id']||d?.commettees?.['my-commettee']?.id;if(cid&&String(cid)!==prefs.committee)throw new Error('Il file appartiene a un altro comitato. Seleziona il comitato corretto prima di importare.');if(kind==='calendar'||kind==='standings'){const id=String(d.id||prefs.group||'');if(!/^\d+$/.test(id))throw new Error('Seleziona il girone prima di importare questo file.');prefs.group=id;const saved=read(cacheKey('groups'),null)?.json?.data||[];if(!saved.some(g=>String(g.id)===id)){saved.push({type:'Calendar',id,title:d.title||d.descrizione||`Girone ${id}`});write(cacheKey('groups'),{json:{data:saved},at:Date.now(),source:'import'})}}
 const rec={json,at:Date.now(),source:'import'};if(!write(cacheKey(kind),rec))throw new Error('Memoria locale insufficiente.');savePrefs();$('#import-status').textContent='Dati importati e salvati sul dispositivo.';if(kind==='groups'){groups=json.data;updateGroups();if(!prefs.group&&groups[0]){prefs.group=String(groups[0].id);savePrefs()}switchTab('calendar')}else{switchTab(kind==='live'?'calendar':kind)}$('#help').close();}catch(err){$('#import-status').textContent=err.message}finally{ev.target.value=''}};
$('#export').onclick=()=>{const data={preferences:prefs,cache:{}};for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(k.startsWith('vl-data:'))data.cache[k]=read(k,null)}const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='fipavonline-viewer-backup.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)};
let installEvent;window.addEventListener('beforeinstallprompt',ev=>{ev.preventDefault();installEvent=ev;$('#install').hidden=false});$('#install').onclick=async()=>{if(installEvent){await installEvent.prompt();installEvent=null;$('#install').hidden=true}};window.addEventListener('appinstalled',()=>$('#install').hidden=true);
window.addEventListener('online',()=>{setConnection();load()});window.addEventListener('offline',setConnection);document.addEventListener('visibilitychange',()=>{if(!document.hidden)load()});setInterval(()=>{if(!document.hidden&&!loading&&tab!=='favorites'&&prefs.committee)load()},60000);
renderCustomNavigation();
$('#today').textContent=new Intl.DateTimeFormat('it-IT',{weekday:'long',day:'numeric',month:'long',year:'numeric'}).format(new Date()).toUpperCase();setConnection();
try{const r=await fetch(`${import.meta.env.BASE_URL}committees.json`);if(!r.ok)throw Error();const list=await r.json();committeeList=list;const regions=[...new Set(list.map(c=>c.region))];$('#committee').innerHTML='<option value="">Scegli un comitato</option>'+regions.map(region=>`<optgroup label="${e(region)}">${list.filter(c=>c.region===region).map(c=>`<option value="${e(c.id)}">${e(c.title)}</option>`).join('')}</optgroup>`).join('');$('#committee').value=prefs.committee}catch{message('Elenco comitati non disponibile. Riapri l’app quando sei online.')}load();
if (import.meta.env.PROD) {
 registerSW({ immediate: true, onRegisterError() { message('Il salvataggio offline dell’app non è disponibile in questo browser.'); } });
} else if ('serviceWorker' in navigator) {
 // Evita che la cache di una vecchia build interferisca con Vite e HMR.
 navigator.serviceWorker.getRegistrations().then(registrations => Promise.all(
  registrations.filter(registration => registration.scope === new URL(import.meta.env.BASE_URL, location.origin).href).map(registration => registration.unregister())
 )).catch(() => {});
}

function selectionCheckbox(type,id,title,committee){
 const key=type==='club'?`club:${id}`:`team:${committee}:${id}`;
 return `<label class="selection-checkbox" title="Seleziona ${e(title)}"><input type="checkbox" data-select-export="${e(key)}" data-type="${type}" data-id="${e(id)}" data-title="${e(title)}" data-committee="${e(committee)}" aria-label="Seleziona ${e(title)}" ${exportSelection.has(key)?'checked':''}></label>`;
}
function updateExportSelection(){
 const inputs=[...document.querySelectorAll('#results [data-select-export]')];
 $('#selection-tools').hidden=!inputs.length;
 const count=exportSelection.size;
 $('#save-custom-view').hidden=tab!=='favorites';
 $('#save-custom-view').disabled=!count;
 $('#selection-count').textContent=`${count} ${count===1?'selezionata':'selezionate'}`;
 $('#selection-export').hidden=!count;
 $('#clear-selection').hidden=!count;
 $('#select-all').checked=!!inputs.length&&inputs.every(input=>input.checked);
 $('#select-all').indeterminate=inputs.some(input=>input.checked)&&!$('#select-all').checked;
}
document.addEventListener('change',event=>{
 const input=event.target.closest('[data-select-export]');if(!input)return;
 const {selectExport:key,type,id,title,committee}=input.dataset;
 if(input.checked)exportSelection.set(key,{type,id,title,committee});else exportSelection.delete(key);
 for(const other of document.querySelectorAll('[data-select-export]'))if(other.dataset.selectExport===key)other.checked=input.checked;
 updateExportSelection();
});
$('#select-all').onchange=event=>{
 const checked=event.target.checked;
 for(const input of document.querySelectorAll('#results [data-select-export]')){
  input.checked=checked;input.dispatchEvent(new Event('change',{bubbles:true}));
 }
};
$('#clear-selection').onclick=()=>{
 exportSelection.clear();
 for(const input of document.querySelectorAll('[data-select-export]'))input.checked=false;
 updateExportSelection();
};
$('#selection-export').onclick=event=>{
 const button=event.target.closest('[data-selection-format]');if(button)startCalendarExport(button,null,button.dataset.selectionFormat,[...exportSelection.values()]);
};
function cachedScheduleRecords(){
 const records=[];
 for(let i=0;i<localStorage.length;i++){
  const key=localStorage.key(i);if(!key.startsWith('vl-data:'))continue;
  const [,committee,kind,group]=key.split(':');const rec=read(key,null);
  if(rec)records.push({...rec,committee,kind,group});
 }
 return records;
}
async function startCalendarExport(button,favorite=null,fileType='xlsx',selection=null){
 button.disabled=true;
 try{
  const {openCalendarExport}=await import('./export-dialog.js');
  openCalendarExport({source:dataSource,committees:committeeList,committee:prefs.committee,fileType,selection,
   favorite:favorite?enrichTeamFavorite(favorite,favoriteContextRecords()):null,
   cached:cachedScheduleRecords
  });
 }catch(error){message(`Esportazione non disponibile: ${error.message}`)}finally{button.disabled=false}
}
$('#view-export').onclick=event=>{
 const button=event.target.closest('[data-view-export]');if(!button)return;
 let favorite=tab==='favorite-detail'?selectedFavorite:null;
 if(tab==='calendar'&&teamFilter.startsWith('id:'))favorite={type:'team',id:teamFilter.slice(3),title:calendarTeams(scheduleMatches(record?[record]:[])).find(team=>team.id===teamFilter)?.title||'Squadra',committee:prefs.committee};
 startCalendarExport(button,favorite,button.dataset.viewExport,isAggregateView()?aggregateItems():null);
};
