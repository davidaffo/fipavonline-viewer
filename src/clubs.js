import { favoriteKey, teamLogo } from './data.js';

export function clubInfo(team) {
  const id = String(team?.cod_aff_societa ?? '').trim();
  if (!/^\d+$/.test(id)) return null;
  return { id, title: String(team.nome_societa || '').trim() || 'Società non indicata', logo: teamLogo(team) };
}

export function collectClubs(matches) {
  const clubs = new Map();
  for (const match of matches) for (const team of [match.team1, match.team2]) {
    const info = clubInfo(team);
    if (!info) continue;
    if (!clubs.has(info.id)) clubs.set(info.id, { ...info, teams: new Map() });
    const club = clubs.get(info.id);
    if (String(team.nome_societa || '').trim()) club.title = info.title;
    if (info.logo) club.logo = info.logo;
    const id = String(team.id || team.title || '');
    if (!club.teams.has(id)) club.teams.set(id, { id, title: team.title || 'Squadra', logo: teamLogo(team), groups: new Set() });
    if (match.groupTitle) club.teams.get(id).groups.add(match.groupTitle);
  }
  return [...clubs.values()].map(club => ({ ...club, teams: [...club.teams.values()].map(team => ({ ...team, groups: [...team.groups] })) }))
    .sort((a, b) => a.title.localeCompare(b.title, 'it'));
}

export function matchIsFavorite(match, favorites, committee) {
  const keys = new Set(favorites.map(favorite => favorite.key));
  if (keys.has(favoriteKey('group', match.groupId, committee))) return true;
  return [match.team1, match.team2].some(team => {
    const club = clubInfo(team);
    return (team?.id && keys.has(favoriteKey('team', team.id, committee))) || (club && keys.has(favoriteKey('club', club.id, committee)));
  });
}
