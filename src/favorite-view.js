import { scheduleMatches } from './schedule.js';
import { clubInfo } from './clubs.js';

export function favoriteCommittees(favorite, committees) {
  const favorites=Array.isArray(favorite)?favorite:[favorite];
  const targets=new Map();
  for(const item of favorites){
    const origin=committees.find(committee=>committee.id===item.committee);
    const scoped=item.type==='club'&&origin?committees.filter(committee=>committee.region===origin.region):[{id:item.committee,title:origin?.title||`Comitato ${item.committee}`}];
    for(const committee of scoped)targets.set(committee.id,committee);
  }
  return [...targets.values()];
}

export function favoriteMatches(records, favorite) {
  const favorites=Array.isArray(favorite)?favorite:[favorite];
  return scheduleMatches(records).filter(match=>favorites.some(item=>
    (item.type==='club'||match.committeeId===item.committee)&&
    [match.team1,match.team2].some(team=>item.type==='club'?clubInfo(team)?.id===item.id:String(team?.id||'')===item.id)
  ));
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
