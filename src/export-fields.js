import { matchPresentation } from './match-card.js';
import { dateISO, groupInfo } from './data.js';

export const EXPORT_FIELDS = [
  ['day', 'Giornata', 20], ['matchNumber', 'N. gara', 12], ['date', 'Data', 13], ['time', 'Ora', 10],
  ['home', 'Squadra casa', 34], ['homeClub', 'Società casa', 34, true], ['homeClubCode', 'Codice società casa', 22, true],
  ['away', 'Squadra ospite', 34], ['awayClub', 'Società ospite', 34, true], ['awayClubCode', 'Codice società ospite', 22, true],
  ['status', 'Stato', 20, true], ['score', 'Risultato', 12, true], ['sets', 'Parziali', 35, true], ['official', 'Omologazione', 24, true],
  ['venue', 'Impianto', 55], ['referees', 'Arbitri', 40, true], ['matchId', 'ID gara', 16, true], ['groupId', 'ID girone', 16, true],
];
export const OPTIONAL_EXPORT_COLUMNS = EXPORT_FIELDS.filter(([, , , optional]) => optional).map(([id, label]) => ({ id, label }));

// Valori delle colonne Excel, comprese quelle opzionali.
export function exportMatchValues(game, metadata) {
  const competition = groupInfo(metadata.get(`${game.committeeId}:${game.groupId}`) || { title: game.groupTitle });
  const iso = dateISO(game);
  const date = /^\d{4}-\d{2}-\d{2}$/.test(iso) ? new Date(`${iso}T00:00:00Z`) : String(game.date || '');
  const state = matchPresentation(game);
  return {
    championship: competition.championshipTitle, group: competition.groupTitle,
    day: String(game.day || ''), matchNumber: String(game.ng || ''), date,
    time: String(game.time || '').replace(/^(\d{1,2})\.(\d{2})$/, '$1:$2'),
    home: String(game.team1?.title || ''), homeClub: String(game.team1?.nome_societa || ''), homeClubCode: String(game.team1?.cod_aff_societa || ''),
    away: String(game.team2?.title || ''), awayClub: String(game.team2?.nome_societa || ''), awayClubCode: String(game.team2?.cod_aff_societa || ''),
    status: state.status, score: state.hasScore ? `${game['team1-setwin'] ?? '–'}-${game['team2-setwin'] ?? '–'}` : '',
    sets: state.sets.map(set => set.join('-')).join(', '), official: state.official,
    venue: String(game.stadium || ''), referees: [game['1referee'], game['2referee']].map(value => String(value || '').trim()).filter(Boolean).join(', '),
    matchId: String(game.id || ''), groupId: String(game.groupId || ''),
  };
}
