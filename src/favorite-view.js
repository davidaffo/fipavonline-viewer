import { scheduleMatches } from './schedule.js';
import { clubInfo } from './clubs.js';

export function favoriteCommittees(favorite, committees) {
  const origin = committees.find(committee => committee.id === favorite.committee);
  if (favorite.type === 'club' && origin) return committees.filter(committee => committee.region === origin.region);
  return [{ id: favorite.committee, title: origin?.title || `Comitato ${favorite.committee}` }];
}

export function favoriteMatches(records, favorite) {
  const scoped = favorite.type === 'team' ? records.filter(record => record.committee === favorite.committee) : records;
  return scheduleMatches(scoped).filter(match => [match.team1, match.team2].some(team => favorite.type === 'club' ? clubInfo(team)?.id === favorite.id : String(team?.id || '') === favorite.id));
}

export function favoriteTeams(games, favorite) {
  const teams = new Map();
  for (const game of games) for (const team of [game.team1, game.team2]) {
    if (!team?.id || (favorite.type === 'club' ? clubInfo(team)?.id !== favorite.id : String(team.id) !== favorite.id)) continue;
    const key = `${game.committeeId}:${team.id}`;
    if (!teams.has(key)) teams.set(key, { ...team, committee: game.committeeId, groups: new Set() });
    if (game.groupTitle) teams.get(key).groups.add(game.groupTitle);
  }
  return [...teams.values()].map(team => ({ ...team, groups: [...team.groups] })).sort((a, b) => a.title.localeCompare(b.title, 'it'));
}
