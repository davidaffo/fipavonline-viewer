import { matches, dateISO, payload } from './data.js';

const identityFields = ['title', 'logo', 'cod_aff_societa', 'nome_societa'];
const matchMetadata = ['stadium', 'date', 'time', 'day', 'ng', '1referee', '2referee', 'lat-stadium', 'lng-stadium', 'ts_gara'];
const present = value => value !== undefined && value !== null && String(value).trim() !== '';

function mergeTeam(previous = {}, next = {}) {
  const team = { ...previous, ...next };
  for (const field of identityFields) if (!present(next[field]) && present(previous[field])) team[field] = previous[field];
  return team;
}
function mergeMatch(previous, next) {
  if (!previous) return { ...next };
  const match = { ...previous, ...next, team1: mergeTeam(previous.team1, next.team1), team2: mergeTeam(previous.team2, next.team2) };
  for (const field of matchMetadata) if (!present(next[field]) && present(previous[field])) match[field] = previous[field];
  return match;
}

// Un solo percorso per calendario, giornata, società e viste dei preferiti.
// I risultati più recenti aggiornano la gara; i metadati vuoti del live non cancellano quelli noti.
export function scheduleMatches(records, { day = '' } = {}) {
  const ordered = [...records].sort((a, b) => (a.at || 0) - (b.at || 0));
  const teams = new Map(), clubs = new Map(), unique = new Map();
  const entries = [];
  const remember = (team, committee) => {
    if (!team) return;
    if (team.id) { const key = `${committee}:${team.id}`; teams.set(key, mergeTeam(teams.get(key), team)); }
    const code = String(team.cod_aff_societa || '').trim();
    if (code) clubs.set(code, mergeTeam(clubs.get(code), team));
  };
  for (const record of ordered) {
    const data = payload(record.json);
    const committee = record.committee || data?.['commettee-id'] || '';
    for (const team of data?.teams || []) remember(team, committee);
    for (const match of matches(record.json)) {
      const entry = { ...match, committeeId: match.committeeId || committee, committeeTitle: record.committeeTitle || match.committeeTitle || data?.['commettee-short'] || data?.commettee || '' };
      remember(entry.team1, entry.committeeId); remember(entry.team2, entry.committeeId);
      entries.push(entry);
    }
  }
  const resolveTeam = (team, committee) => {
    if (!team) return team;
    const resolved = mergeTeam(teams.get(`${committee}:${team.id}`), team);
    const club = clubs.get(String(resolved.cod_aff_societa || '').trim());
    if (club) {
      if (present(club.nome_societa)) resolved.nome_societa = club.nome_societa;
      if (!present(resolved.logo) && present(club.logo)) resolved.logo = club.logo;
    }
    return resolved;
  };
  for (const entry of entries) {
    const match = { ...entry, team1: resolveTeam(entry.team1, entry.committeeId), team2: resolveTeam(entry.team2, entry.committeeId) };
    const key = `${match.committeeId}:${match.groupId}:${match.id || `${dateISO(match)}:${match.time}:${match.team1?.id || match.team1?.title}:${match.team2?.id || match.team2?.title}`}`;
    unique.set(key, mergeMatch(unique.get(key), match));
  }
  return [...unique.values()].filter(match => !day || dateISO(match) === day)
    .sort((a, b) => `${dateISO(a)} ${a.time || ''}`.localeCompare(`${dateISO(b)} ${b.time || ''}`));
}

export function combinedRecord(records) {
  return {
    at: Math.min(...records.map(record => record.at)), source: 'schedule',
    json: { data: { championship: scheduleMatches(records).reduce((groups, match) => {
      let group = groups.find(group => group.id === match.groupId);
      if (!group) { group = { id: match.groupId, title: match.groupTitle, 'championship-matches': [] }; groups.push(group); }
      group['championship-matches'].push(match);
      return groups;
    }, []) } },
  };
}
