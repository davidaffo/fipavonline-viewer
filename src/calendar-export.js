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
export function exportSections({ games, records, scope = 'all', clubId = '', teamKey = '', grouping = 'club', hidePlayed = false }) {
  games = filterPlayedMatches(games, hidePlayed);
  const catalog = exportCatalog(games, records);
  if (scope === 'team') {
    const team = catalog.teams.find(team => team.key === teamKey);
    return team ? [{ key: team.key, title: team.label, fileTitle: `${team.title} ${[...team.contexts].join(' ')}`, games: games.filter(game => [game.team1, game.team2].some(item => teamExportKey(game.committeeId, item?.id) === teamKey)) }] : [];
  }
  const selected = scope === 'club' ? games.filter(game => [game.team1, game.team2].some(team => clubInfo(team)?.id === clubId)) : games;
  const overview = club => ({
    key: `club:${club.id}:all`, sheetTitle: `Completo - ${club.title}`, title: `${club.title} - Tutte le squadre`, fileTitle: `${club.title} tutte le squadre`, combined: true,
    games: selected.filter(game => [game.team1, game.team2].some(team => clubInfo(team)?.id === club.id))
      .sort((a, b) => `${dateISO(a) || '9999'} ${String(a.time || '99:99').replace('.', ':').padStart(5, '0')}`.localeCompare(`${dateISO(b) || '9999'} ${String(b.time || '99:99').replace('.', ':').padStart(5, '0')}`)),
  });
  if (grouping === 'team') {
    const teams = catalog.teams.filter(team => scope !== 'club' || team.clubId === clubId).map(team => ({ key: team.key, title: team.label, fileTitle: `${team.title} ${[...team.contexts].join(' ')}`, games: selected.filter(game => [game.team1, game.team2].some(item => teamExportKey(game.committeeId, item?.id) === team.key)) })).filter(section => section.games.length);
    const club = scope === 'club' ? catalog.clubs.find(club => club.id === clubId) : null;
    return club ? [overview(club), ...teams] : teams;
  }
  return catalog.clubs.filter(club => scope !== 'club' || club.id === clubId).flatMap(club => [overview(club), { key: club.id, title: club.title, games: selected.filter(game => [game.team1, game.team2].some(team => clubInfo(team)?.id === club.id)) }]);
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
  const baseColumns = columns.filter(([id, , , optional]) => !optional || enabled.has(id));
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'FIPAVonline Viewer';
  const metadata = exportGroupMetadata(records), names = new Set();
  for (const section of sections) {
    const selectedColumns = section.combined ? [['championship', 'Campionato', 28], ['group', 'Girone', 22], ...baseColumns] : baseColumns;
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
      heading(section.combined ? 'Calendario completo - Tutte le squadre' : [`${info.championshipTitle} - ${info.groupTitle}`, committeeTitle].filter(Boolean).join(' · '));
      const rows = games.map(game => {
        const values = exportMatchValues(game, metadata);
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
    return buildICSDownload({ sections, records, committees, format, calendarName, warmupMinutes, optionalColumns, issues, progress, signal });
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
