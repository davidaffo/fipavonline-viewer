export const R2 = 'https://data.fipavonline.it';
export const API = 'https://app.fipavonline.it';
export const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function payload(json) { return Array.isArray(json) ? json[0]?.data : json?.data; }
export function matches(json) {
 const d=payload(json);
 if(Array.isArray(d?.championship)) return d.championship.flatMap(g=>(g['championship-matches']||[]).map(m=>({...m,groupId:String(g.id),groupTitle:g.title,committeeId:m.committeeId||g['commettee-id']||d['commettee-id']||'',committeeTitle:m.committeeTitle||g['commettee-short']||g.commettee||''})));
 if(Array.isArray(d?.matches)) return d.matches.map(m=>({...m,groupId:String(d.id||''),groupTitle:d.title,committeeId:m.committeeId||d['commettee-id']||'',committeeTitle:m.committeeTitle||d['commettee-short']||d.commettee||''}));
 return [];
}
export function classify(json) {
 const d=payload(json);
 if(d && Array.isArray(d.championship)) return 'live';
 if(d && Array.isArray(d.matches)) return 'calendar';
 if(d && Array.isArray(d.teams)) return 'standings';
 if(Array.isArray(json?.data) && json.data.every(g=>g.type==='Calendar' && g.id && g.title)) return 'groups';
 throw new Error('Formato non riconosciuto. Importa un JSON FIPAV di risultati, calendario, gironi o classifica.');
}
export function urls(kind,committee,group) {
 const c=encodeURIComponent(committee),g=encodeURIComponent(group);
 if(kind==='live') return [`${R2}/public/cache/getGironiComiOggiv2_${c}.json`];
 const path=kind==='groups'?`calendar/${c}/0`:kind==='calendar'?`calendar/0/${g}`:`tables/${g}`;
 return [`${R2}/api/v2/${path}`,`${API}/api/v2/${path}`];
}
export function dateISO(match) {
 const m=/^(\d{2})\/(\d{2})\/(\d{4})$/.exec(match.date||'');
 if(m) return `${m[3]}-${m[2]}-${m[1]}`;
 if(match.ts_gara){const d=new Date(Number(match.ts_gara)*1000);return localDate(d);}
 return String(match.date||'').slice(0,10);
}
export function localDate(d=new Date()){return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;}
export function favoriteKey(type,id,committee){return type==='club'?`club:${id}`:`${committee}:${type}:${id}`;}

// FIPAV distingue il campionato (parent-id) dal singolo girone (id).
export function groupInfo(group) {
 const parts=String(group.title||'').split(/\s+-\s+/);
 const championshipTitle=String(group.parent||parts[0]||'Campionato');
 const groupTitle=String(group['sub-title']||(group['sub-title-short']?`Girone ${group['sub-title-short']}`:parts.slice(1).join(' - '))||'Girone unico');
 return {championshipId:String(group['parent-id']||`name:${championshipTitle}`),championshipTitle,groupTitle};
}
export function championships(groups) {
 const result=new Map();
 for(const group of groups){const info=groupInfo(group);if(!result.has(info.championshipId))result.set(info.championshipId,{id:info.championshipId,title:info.championshipTitle})}
 return [...result.values()];
}
export function championshipGroups(groups,id) {return groups.filter(group=>groupInfo(group).championshipId===id)}

export function teamLogo(team) {
 if(typeof team?.logo!=='string'||!team.logo.trim())return '';
 try{const url=new URL(team.logo,API);return url.protocol==='https:'&&(url.hostname==='fipavonline.it'||url.hostname.endsWith('.fipavonline.it'))?url.href:''}catch{return ''}
}
