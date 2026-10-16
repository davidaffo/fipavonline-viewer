import test from 'node:test';
import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
import { unzipSync } from 'fflate';
import { scheduleMatches } from '../src/schedule.js';
import { exportSections, exportCatalog, buildCalendarDownload, OPTIONAL_EXPORT_COLUMNS } from '../src/calendar-export.js';
import { loadExportRecords } from '../src/export-data.js';

const team = (id, club = '00001') => ({ id, title: '=VOLLEY', cod_aff_societa: club, nome_societa: club === '00001' ? 'Società / Uno' : 'Società : Due' });
const game = (id, a, b) => ({ id, date: '16/10/2026', time: '20.30', team1: a, team2: b, day: 'Giornata 1', ng: '0012', played: true, 'team1-setwin': 3, 'team2-setwin': 0, pt_a: [25,25,25], pt_b: [20,22,15], '1referee': 'Arbitro Uno', '2referee': 'Arbitro Due', stadium: 'Palestra' });
const calendar = (id, games) => ({ at: 1000, committee: '03008', kind: 'calendar', group: id, json: { data: { id, title: 'Under 19 Femminile - Girone A', matches: games } } });
const records = [
 { at: 1000, committee: '03008', kind: 'groups', group: '', json: { data: [{ id: '1', title: 'Under 19 Femminile - Girone A', parent: 'Under 19 Femminile', 'sub-title': 'Girone A', 'title-short': 'U19FA', 'sub-title-short': 'A' }, { id:'2', title:'Prima Divisione Femminile - Girone B', parent:'Prima Divisione Femminile', 'sub-title':'Girone B', 'title-short':'1DFB', 'sub-title-short':'B' }] } },
 calendar('1', [game('1', team('a'), team('b', '00002')), game('2', team('a'), team('c'))]),
 calendar('2', [game('3', team('d'), team('e', '00002'))]),
];
const games = scheduleMatches(records);

test('export: società, squadre omonime e derby senza duplicazioni nel foglio', () => {
 const catalog = exportCatalog(games, records);
 assert.equal(catalog.clubs.length, 2);
 assert.equal(catalog.teams.length, 5);
 assert.match(catalog.teams.find(t=>t.id==='a').label, /U19F · Gir. A/);
 assert.match(catalog.teams.find(t=>t.id==='d').label, /1DF · Gir. B/);
 const clubs = exportSections({games, records}).filter(section=>!section.combined);
 assert.equal(clubs[0].games.length, 2);
 assert.equal(clubs[1].games.length, 3);
 assert.equal(exportSections({games, records, scope:'club', clubId:'00001', grouping:'team'}).length, 4);
 assert.deepEqual(exportSections({games, records, scope:'team', teamKey:'03008:a'})[0].games.map(g=>g.id), ['1','2']);
 assert.equal(exportSections({games, records, scope:'team', teamKey:'03011:a'}).length, 0);
});

test('XLSX leggibile: nomi fogli validi/univoci, colonne essenziali, date, arbitri e formula come testo', async () => {
 const section = exportSections({games, records, scope:'team', teamKey:'03008:a'})[0];
 const titles = ['A'.repeat(40)+'/', 'A'.repeat(40)+':', 'Informazioni'];
 const download = await buildCalendarDownload({sections:titles.map(title=>({...section,title})), records, issues:['Girone mancante']});
 const book = new ExcelJS.Workbook(); await book.xlsx.load(download.bytes);
 assert.equal(book.worksheets.length, 4);
 assert.equal(new Set(book.worksheets.map(s=>s.name)).size, 4);
 for (const sheet of book.worksheets) assert.ok(sheet.name.length <= 31 && !/[\\/?:*\[\]]/.test(sheet.name));
 const sheet = book.worksheets[0];
 assert.deepEqual(sheet.getRow(3).values.slice(1), ['Giornata','N. gara','Data','Ora','Squadra casa','Squadra ospite','Impianto']);
 assert.equal(sheet.columnCount, 7);
 assert.equal(sheet.getCell('A1').value, titles[0]);
 assert.equal(sheet.getCell('A2').value, 'Under 19 Femminile - Girone A');
 assert.equal(sheet.getCell('B4').value,'0012');
 assert.equal(sheet.getCell('C4').value.toISOString(), '2026-10-16T00:00:00.000Z');
 assert.equal(sheet.getCell('D4').value, '20:30');
 assert.equal(sheet.getCell('E4').value, '=VOLLEY');
 assert.equal(sheet.getCell('E4').type, ExcelJS.ValueType.String);
 assert.equal(sheet.getCell('G4').value, 'Palestra');
 assert.match(JSON.stringify(book.worksheets.at(-1).getSheetValues()), /Girone mancante/);
});

test('ZIP: ogni file è un Excel apribile, con nomi distinti anche per società omonime', async () => {
 const sections = exportSections({games, records}).filter(section=>!section.combined).map(section=>({...section,title:'Società · Uno / U19F — Gir. A'}));
 const download = await buildCalendarDownload({sections, records, format:'separate'});
 const files = unzipSync(download.bytes);
 assert.deepEqual(Object.keys(files), ['calendario-societa-uno-u19f-gir-a.xlsx','calendario-societa-uno-u19f-gir-a-2.xlsx']);
 assert.ok(Object.keys(files).every(name => /^[a-z0-9-]+\.xlsx$/.test(name)));
 for (const bytes of Object.values(files)) { const book = new ExcelJS.Workbook(); await book.xlsx.load(bytes); assert.equal(book.worksheets.length,2); assert.ok(book.worksheets[0].rowCount > 1); }
});

test('caricamento export: trasporto condiviso, fallback dichiarato e annullamento', async () => {
 const source = {get:async(kind,{group})=>{ if(kind==='groups') return records[0]; throw new Error(`manca ${group}`); }};
 const result = await loadExportRecords({source,committees:[{id:'03008',title:'Centro'}],cached:records});
 assert.equal(result.games.length,3);
 assert.equal(result.issues.length,2);
 assert.ok(result.issues.every(issue=>issue.includes('copia salvata')));
 const controller = new AbortController(); controller.abort();
 await assert.rejects(loadExportRecords({source,committees:[{id:'03008'}],signal:controller.signal}), {name:'AbortError'});
});


test('nome download squadra: nome e categoria senza simboli o codice comitato', async () => {
 const sections = exportSections({games, records, scope:'team',teamKey:'03008:a'});
 const download = await buildCalendarDownload({sections,records});
 assert.equal(download.filename,'calendario-volley-u19f-gir-a.xlsx');
 const future = {...games[0],played:false,'team1-setwin':0,'team2-setwin':0,pt_a:[],pt_b:[], '1referee':'', '2referee':''};
 const pending = await buildCalendarDownload({sections:[{title:'Futura',games:[future]}],records});
 const book=new ExcelJS.Workbook();await book.xlsx.load(pending.bytes);
 assert.ok(!book.worksheets[0].getRow(3).values.includes('Arbitri'));
});


test('società con più gironi: titolo una volta per sezione e tabelle separate senza colonne ripetute', async () => {
 const sections=exportSections({games,records,scope:'club',clubId:'00001'}).filter(section=>!section.combined);
 const download=await buildCalendarDownload({sections,records});
 const book=new ExcelJS.Workbook();await book.xlsx.load(download.bytes);
 const sheet=book.worksheets[0];
 const values=sheet.getColumn(1).values;
 assert.equal(values.filter(value=>value==='Under 19 Femminile - Girone A').length,1);
 assert.equal(values.filter(value=>value==='Prima Divisione Femminile - Girone B').length,1);
 assert.ok(!values.includes('Campionato'));assert.ok(!values.includes('Girone'));
 assert.equal(sheet.getTables().length,2);
 assert.equal(values.filter(value=>value==='Giornata 1').length,3);
 assert.equal(sheet.columnCount,7);
});


test('checkbox colonne: numero gara obbligatorio, metadati solo nel titolo, valori e data corretti', async () => {
 const sections=exportSections({games,records,scope:'team',teamKey:'03008:a'});
 const optionalColumns=OPTIONAL_EXPORT_COLUMNS.map(column=>column.id);
 assert.equal(optionalColumns.length,11);
 const download=await buildCalendarDownload({sections,records,optionalColumns,committees:[{id:'03008',title:'Centro'}]});
 const book=new ExcelJS.Workbook();await book.xlsx.load(download.bytes);
 const sheet=book.worksheets[0];
 assert.equal(sheet.columnCount,18);
 const headers=sheet.getRow(3).values.slice(1);
 const cell=name=>sheet.getRow(4).getCell(headers.indexOf(name)+1);
 assert.ok(!headers.includes('Comitato')&&!headers.includes('Campionato')&&!headers.includes('Girone'));
 assert.equal(sheet.getCell('A2').value,'Under 19 Femminile - Girone A · Centro');
 assert.ok(!OPTIONAL_EXPORT_COLUMNS.some(column=>['committee','championship','group','matchNumber'].includes(column.id)));
 assert.equal(cell('N. gara').value,'0012');
 assert.equal(cell('Arbitri').value,'Arbitro Uno, Arbitro Due');
 assert.equal(cell('Società casa').value,'Società / Uno');
 assert.equal(cell('Codice società casa').value,'00001');
 assert.equal(cell('Società ospite').value,'Società : Due');
 assert.equal(cell('Codice società ospite').value,'00002');
 assert.equal(cell('Stato').value,'Terminata');
 assert.equal(cell('Risultato').value,'3-0');
 assert.equal(cell('Parziali').value,'25-20, 25-22, 25-15');
 assert.equal(cell('ID gara').value,'1');
 assert.equal(cell('ID girone').value,'1');
 assert.equal(cell('Data').value.toISOString(),'2026-10-16T00:00:00.000Z');
 assert.equal(cell('Data').numFmt,'dd/mm/yyyy');
});

test('checkbox selettive: risultato e parziali anche in tutti i file dello ZIP, senza altre colonne opzionali', async () => {
 const sections=exportSections({games,records}).filter(section=>!section.combined);
 const download=await buildCalendarDownload({sections,records,format:'separate',optionalColumns:['score','sets','unknown','committee','championship','group']});
 for(const bytes of Object.values(unzipSync(download.bytes))){
  const book=new ExcelJS.Workbook();await book.xlsx.load(bytes);
  const sheet=book.worksheets[0],headers=sheet.getRow(3).values.slice(1);
  assert.equal(sheet.columnCount,9);
  assert.ok(headers.includes('Risultato')&&headers.includes('Parziali'));
  assert.ok(!headers.includes('Campionato')&&!headers.includes('ID gara'));
  assert.equal(sheet.getCell('C4').numFmt,'dd/mm/yyyy');
 }
});


test('società: calendario complessivo aggiuntivo, cronologico e senza derby duplicati, con campionato e girone per riga', async () => {
 const chronological=games.map((game,index)=>({...game,date:['20/10/2026','21/10/2026','19/10/2026'][index]}));
 const sections=exportSections({games:chronological,records,scope:'club',clubId:'00001',grouping:'team'});
 assert.equal(sections.length,4);
 assert.equal(sections[0].combined,true);
 assert.deepEqual(sections[0].games.map(game=>game.id),['3','1','2']);
 const download=await buildCalendarDownload({sections,records,optionalColumns:['score']});
 const book=new ExcelJS.Workbook();await book.xlsx.load(download.bytes);
 const overview=book.worksheets[0];
 assert.equal(overview.getTables().length,1);
 const headers=overview.getRow(3).values.slice(1);
 assert.deepEqual(headers.slice(0,2),['Campionato','Girone']);
 const row=(r,name)=>overview.getRow(r).getCell(headers.indexOf(name)+1).value;
 assert.equal(row(4,'Campionato'),'Prima Divisione Femminile');
 assert.equal(row(4,'Girone'),'Girone B');
 assert.equal(row(5,'Campionato'),'Under 19 Femminile');
 assert.equal(row(5,'Girone'),'Girone A');
 assert.equal(row(4,'Data').toISOString(),'2026-10-19T00:00:00.000Z');
 assert.equal(overview.rowCount,6);
 assert.equal(row(4,'N. gara'),'0012');assert.equal(row(4,'Risultato'),'3-0');
 for(const sheet of book.worksheets.slice(1,-1))assert.ok(!sheet.getRow(3).values.includes('Campionato'));
 const zip=await buildCalendarDownload({sections,records,format:'separate'});
 const files=unzipSync(zip.bytes);
 assert.equal(Object.keys(files).length,4);
 const [name,bytes]=Object.entries(files).find(([name])=>name.includes('tutte-le-squadre'));
 assert.match(name,/^[a-z0-9-]+\.xlsx$/);
 const summary=new ExcelJS.Workbook();await summary.xlsx.load(bytes);
 assert.equal(summary.worksheets[0].getTables().length,1);
 assert.equal(summary.worksheets[0].rowCount,6);
});

test('export per società: un riepilogo per ciascuna società; la singola squadra resta senza riepilogo', () => {
 const sections=exportSections({games,records,grouping:'club'});
 assert.equal(sections.filter(section=>section.combined).length,2);
 const standalone=exportSections({games,records,scope:'team',teamKey:'03008:a'});
 assert.equal(standalone.length,1);assert.ok(!standalone[0].combined);
});
