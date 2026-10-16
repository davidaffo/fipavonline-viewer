import { groupInfo, payload } from './data.js';

function categoryAbbreviation(title) {
  return title.trim().replace(/prima divisione/gi, '1D').replace(/seconda divisione/gi, '2D').replace(/terza divisione/gi, '3D')
    .replace(/under\s*(\d+)/gi, 'U$1').replace(/serie\s+/gi, '').replace(/femminile/gi, 'F').replace(/maschile/gi, 'M')
    .replace(/\s+/g, ' ').replace(/^(U\d+|[123]D|[ABCD]\d?)\s+([FM])$/i, '$1$2');
}

export function competitionContext(group) {
  const info = groupInfo(group);
  const fullGroup = String(group['sub-title'] || info.groupTitle).trim();
  const suffix = String(group['sub-title-short'] || fullGroup.replace(/^girone\s*/i, '')).trim();
  const short = String(group['title-short'] || '').trim();
  const category = short && suffix && short.endsWith(suffix) && short.length > suffix.length ? short.slice(0, -suffix.length) : categoryAbbreviation(info.championshipTitle);
  const label = `${category}${fullGroup === 'Girone unico' ? ' · Gir. unico' : ` · Gir. ${suffix}`}`;
  return { groupId: String(group.id || ''), label, title: String(group.title || `${info.championshipTitle} - ${fullGroup}`) };
}

// Ricostruisce il contesto anche per i preferiti salvati prima di questo campo.
export function enrichTeamFavorite(favorite, records) {
  if (favorite.type !== 'team') return favorite;
  const scoped = records.filter(record => record.committee === favorite.committee);
  const metadata = new Map();
  const remember = group => {
    const id = String(group?.id || '');
    if (id) metadata.set(id, { ...metadata.get(id), ...group });
  };
  for (const record of scoped) {
    const data = payload(record.json);
    if (Array.isArray(record.json?.data)) record.json.data.forEach(remember);
    else if (Array.isArray(data?.championship)) data.championship.forEach(remember);
    else if (data?.id) remember(data);
  }
  const contexts = new Map((favorite.contexts || []).map(context => [context.groupId, context]));
  const hasTeam = match => [match.team1, match.team2].some(team => String(team?.id || '') === String(favorite.id));
  const add = group => { const context = competitionContext(metadata.get(String(group.id)) || group); contexts.set(context.groupId, context); };
  for (const record of scoped) {
    const data = payload(record.json);
    if (Array.isArray(data?.matches) && data.matches.some(hasTeam)) add(data);
    if (Array.isArray(data?.teams) && data.teams.some(team => String(team.id) === String(favorite.id))) add(data);
    if (Array.isArray(data?.championship)) for (const group of data.championship) if (group['championship-matches']?.some(hasTeam)) add(group);
  }
  return { ...favorite, contexts: [...contexts.values()].sort((a, b) => a.label.localeCompare(b.label, 'it')) };
}

export function favoriteTitle(favorite) {
  const labels = favorite.type === 'team' ? [...new Set((favorite.contexts || []).map(context => context.label))] : [];
  return `${favorite.title}${labels.length ? ` · ${labels.join(' / ')}` : ''}`;
}
