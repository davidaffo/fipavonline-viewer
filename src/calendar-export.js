import { EXPORT_FIELDS as columns, exportMatchValues } from './export-fields.js';
import { uniqueFilename, calendarDownloadName } from './export-filenames.js';
export { OPTIONAL_EXPORT_COLUMNS } from './export-fields.js';
import ExcelJS from 'exceljs';
import { zipSync } from 'fflate';
import { clubInfo } from './clubs.js';
import { dateISO, groupInfo } from './data.js';
import { competitionContext } from './team-label.js';
import { exportGroupMetadata } from './export-data.js';
import { filterPlayedMatches } from './schedule-filters.js';

export const teamExportKey = (committee, id) => `${committee}:${id}`;
const sort = (a, b) => a.title.localeCompare(b.title, 'it') || a.key.localeCompare(b.key);
export function exportCatalog(games, records) {
  const clubs = new Map(), teams = new Map(), metadata = exportGroupMetadata(records);
  for (const game of games) for (const team of [game.team1, game.team2]) {
    const club = clubInfo(team);
    if (club && !clubs.has(club.id)) clubs.set(club.id, { ...club, key: club.id });
    if (!team?.id) continue;
    const key = teamExportKey(game.committeeId, team.id);
    if (!teams.has(key)) teams.set(key, { key, id: String(team.id), title: team.title || 'Squadra', clubId: club?.id || '', committee: game.committeeId, contexts: new Set() });
    const context = competitionContext(metadata.get(`${game.committeeId}:${game.groupId}`) || { id: game.groupId, title: game.groupTitle });
    teams.get(key).contexts.add(context.label);
  }
  return { clubs: [...clubs.values()].sort(sort), teams: [...teams.values()].map(team => ({ ...team, label: `${team.title} · ${[...team.contexts].join(' / ')} · ${team.committee}` })).sort(sort) };
}
function combinedSection({key,title,games,label='Squadre selezionate'}) {
  const unique=new Map();
  for(const game of games){
    const identity=game.id||`${dateISO(game)}:${game.time}:${game.team1?.id}:${game.team2?.id}`;
    unique.set(`${game.committeeId}:${game.groupId}:${identity}`,game);
  }
  return {key,sheetTitle:`Completo - ${title}`,title:`${title} - ${label}`,fileTitle:`${title} ${label}`,combined:true,combinedLabel:label,
    games:[...unique.values()].sort((a,b)=>`${dateISO(a)||'9999'} ${String(a.time||'99:99').replace('.',':').padStart(5,'0')}`.localeCompare(`${dateISO(b)||'9999'} ${String(b.time||'99:99').replace('.',':').padStart(5,'0')}`)),
  };
}
export function exportSections({ games, records, scope = 'all', clubId = '', teamKey = '', teamKeys, grouping = 'club', hidePlayed = false, includeCombined = scope !== 'team' }) {
  games = filterPlayedMatches(games, hidePlayed);
  const catalog = exportCatalog(games, records);
  const keys = new Set(Array.isArray(teamKeys) ? teamKeys : teamKey ? [teamKey] : []);
  const teamSection = team => ({ key: team.key, title: team.label, fileTitle: `${team.title} ${[...team.contexts].join(' ')}`, games: games.filter(game => [game.team1, game.team2].some(item => teamExportKey(game.committeeId, item?.id) === team.key)) });
  if (scope === 'team') {
    const teams=catalog.teams.filter(team => keys.has(team.key)).map(teamSection);
    return includeCombined&&teams.length>1?[combinedSection({key:'teams:all',title:'Squadre selezionate',games:teams.flatMap(section=>section.games)}),...teams]:teams;
  }
  const clubTeams = scope === 'club' ? catalog.teams.filter(team => team.clubId === clubId && (!Array.isArray(teamKeys) || keys.has(team.key))) : [];
  if (scope === 'club' && Array.isArray(teamKeys) && clubTeams.length < 2) return clubTeams.map(teamSection);
  const clubKeys = new Set(clubTeams.map(team => team.key));
  const selected = scope === 'club' ? games.filter(game => [game.team1, game.team2].some(team => clubInfo(team)?.id === clubId && (!Array.isArray(teamKeys) || clubKeys.has(teamExportKey(game.committeeId, team?.id))))) : games;
  const subset = scope === 'club' && Array.isArray(teamKeys) && clubTeams.length < catalog.teams.filter(team => team.clubId === clubId).length;
  const overview=club=>combinedSection({key:`club:${club.id}:all`,title:club.title,label:subset?'Squadre selezionate':'Tutte le squadre',games:selected.filter(game=>[game.team1,game.team2].some(team=>clubInfo(team)?.id===club.id))});
  if (grouping === 'team') {
    const teams = catalog.teams.filter(team => scope !== 'club' || clubKeys.has(team.key)).map(teamSection).filter(section => section.games.length);
    const club = scope === 'club' ? catalog.clubs.find(club => club.id === clubId) : null;
    return club&&includeCombined ? [overview(club), ...teams] : teams;
  }
  return catalog.clubs.filter(club => scope !== 'club' || club.id === clubId).flatMap(club => [...(includeCombined?[overview(club)]:[]), { key: club.id, title: club.title, games: selected.filter(game => [game.team1, game.team2].some(team => clubInfo(team)?.id === club.id)) }]);
}
// Il riepilogo è predefinito per le società e facoltativo per le squadre.
export function selectedExportSections({selection, includeCombined=selection.some(item=>item.type==='club'), includeUnified=false, ...options}) {
  if(!includeUnified&&selection.length&&selection.every(item=>item.type==='team'))return exportSections({...options,scope:'team',teamKeys:selection.map(item=>teamExportKey(item.committee,item.id)),includeCombined});
  const sections=new Map();
  for(const item of selection){
    const list=exportSections({...options,includeCombined,scope:item.type,clubId:item.type==='club'?item.id:'',teamKey:item.type==='team'?teamExportKey(item.committee,item.id):''});
    for(const section of list)sections.set(section.key,section);
  }
  const list=[...sections.values()];
  if(!includeUnified||selection.length<2||!list.length)return list;
  const catalog=exportCatalog(options.games,options.records);
  const selectedClubs=[...new Map(selection.filter(item=>item.type==='club').map(item=>[item.id,{id:item.id,title:item.title||catalog.clubs.find(club=>club.id===item.id)?.title||item.id}])).values()];
  return [{...combinedSection({key:'selection:all',title:'Selezione completa',label:'Società e squadre selezionate',games:list.flatMap(section=>section.games)}),selectedClubs},...list];
}
function uniqueName(title, used, limit = 31) {
  const base = String(title).replace(/[\\/?:*\[\]<>|"\x00-\x1f]/g, ' ').replace(/\s+/g, ' ').trim().replace(/^'+|'+$/g, '') || 'Calendario';
  let name = base.slice(0, limit), number = 1;
  while (used.has(name.toLocaleLowerCase('it'))) { const suffix = ` (${++number})`; name = base.slice(0, limit - suffix.length) + suffix; }
  used.add(name.toLocaleLowerCase('it'));
  return name;
}
export function createCalendarWorkbook(sections, records, committees = [], optionalColumns = []) {
  const enabled = new Set(optionalColumns);
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'FIPAVonline Viewer';
  const metadata = exportGroupMetadata(records), names = new Set();
  for (const section of sections) {
    const baseColumns = columns.filter(([id, , , optional]) => !optional || enabled.has(id));
    const selectedColumns = [...(section.selectedClubs?.length>1?[['selectedClub','Società',34]]:[]),...(section.combined ? [['championship', 'Campionato', 28], ['group', 'Girone', 22], ...baseColumns] : baseColumns)];
    const sheet = workbook.addWorksheet(uniqueName(section.sheetTitle || section.title, names));
    sheet.columns = selectedColumns.map(([, , width]) => ({ width }));
    const heading = (text, size = 12) => {
      const row = sheet.addRow([text]);
      sheet.mergeCells(row.number, 1, row.number, selectedColumns.length);
      row.font = { bold: true, size };
      row.alignment = { vertical: 'middle', wrapText: true };
      row.height = size === 16 ? 34 : 30;
    };
    heading(section.title, 16);
    const groups = new Map();
    for (const game of section.games) {
      const key = section.combined ? 'all' : `${game.committeeId}:${game.groupId}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(game);
    }
    let index = 0;
    for (const games of groups.values()) {
      if (index) sheet.addRow([]);
      const first = games[0];
      const info = groupInfo(metadata.get(`${first.committeeId}:${first.groupId}`) || { title: first.groupTitle });
      const committeeTitle = committees.find(committee => committee.id === first.committeeId)?.title || first.committeeTitle || '';
      heading(section.combined ? `Calendario completo - ${section.combinedLabel || 'Tutte le squadre'}` : [`${info.championshipTitle} - ${info.groupTitle}`, committeeTitle].filter(Boolean).join(' · '));
      const rows = games.map(game => {
        const values = exportMatchValues(game, metadata);
        if(section.selectedClubs)values.selectedClub=section.selectedClubs.filter(club=>[game.team1,game.team2].some(team=>clubInfo(team)?.id===club.id)).map(club=>club.title).join(' / ');
        return selectedColumns.map(([key]) => values[key]);
      });
      const headerRow = sheet.rowCount + 1;
      sheet.addTable({
        name: `Calendario${sheet.id}Girone${++index}`, ref: `A${headerRow}`,
        headerRow: true, totalsRow: false,
        style: { theme: 'TableStyleMedium2', showRowStripes: true },
        columns: selectedColumns.map(([, name]) => ({ name, filterButton: true })), rows,
      });
      sheet.getRow(headerRow).height = 24;
    }
    sheet.getColumn(selectedColumns.findIndex(([key]) => key === 'date') + 1).numFmt = 'dd/mm/yyyy';
    sheet.views = [{ state: 'frozen', ySplit: 3 }];
  }
  const info = workbook.addWorksheet(uniqueName('Informazioni', names));
  info.columns = [{ width: 28 }, { width: 100 }];
  info.addRows([['Fonte', 'FIPAV Online'], ['Esportato il', new Date()], ['Dati dal', new Date(Math.min(...records.map(record => record.at).filter(Number.isFinite)))], ['Fogli calendario', sections.length], ...sections.map(section => ['Calendario', section.title])]);
  info.getCell('B2').numFmt = info.getCell('B3').numFmt = 'dd/mm/yyyy hh:mm';
  return workbook;
}
export async function buildCalendarDownload({ sections, records, committees, format = 'single', fileType = 'xlsx', calendarName = '', warmupMinutes = 0, optionalColumns = [], issues = [], progress = () => {}, signal }) {
  if (!sections.length) throw new Error('Nessun calendario da esportare.');
  if (fileType === 'ics') {
    const { buildICSDownload } = await import('./ics-export.js');
    return buildICSDownload({ sections, records, format, calendarName, warmupMinutes, issues, progress, signal });
  }
  if (fileType !== 'xlsx') throw new Error('Formato di esportazione non valido.');
  const filename = calendarDownloadName(sections);
  const write = async list => {
    signal?.throwIfAborted();
    const workbook = createCalendarWorkbook(list, records, committees, optionalColumns);
    if (issues.length) workbook.worksheets.at(-1).addRows([['Dati non aggiornati', 'Esportazione incompleta o da copie salvate'], ...issues.map(issue => ['Dettaglio', issue])]);
    return new Uint8Array(await workbook.xlsx.writeBuffer());
  };
  if (format === 'single') return { bytes: await write(sections), filename: `${filename}.xlsx`, type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' };
  const files = {}, names = new Set();
  for (const [index, section] of sections.entries()) {
    progress(`Creazione file ${index + 1}/${sections.length}…`);
    files[`${uniqueFilename(section.fileTitle || section.title, names)}.xlsx`] = await write([section]);
    await new Promise(resolve => setTimeout(resolve, 0));
  }
  signal?.throwIfAborted();
  return { bytes: zipSync(files, { level: 0 }), filename: `${filename}.zip`, type: 'application/zip' };
}
