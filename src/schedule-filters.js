import { dateISO, groupInfo } from './data.js';
import { filterByTeam } from './calendar.js';
import { matchPresentation } from './match-card.js';

export function isPlayedMatch(game) {
 return matchPresentation(game).status==='Terminata';
}

export function filterPlayedMatches(games,hidePlayed=false) {
 return hidePlayed?games.filter(game=>!isPlayedMatch(game)):games;
}

// Lista, griglia ed esportazioni condividono lo stato delle partite.
export function filterSchedule(games,{groups=[],championship='',group='',team='',day='',dateFrom='',dateTo='',hidePlayed=false}={}) {
 const allowed=championship?new Set(groups.filter(item=>groupInfo(item).championshipId===championship).map(item=>String(item.id))):null;
 return filterPlayedMatches(filterByTeam(games,team),hidePlayed).filter(game=>{
  const date=dateISO(game);
  const inRange=!(dateFrom||dateTo)||(/^\d{4}-\d{2}-\d{2}$/.test(date)&&(!dateFrom||date>=dateFrom)&&(!dateTo||date<=dateTo));
  return (!group||game.groupId===group)&&(!allowed||allowed.has(game.groupId))&&(!day||date===day)&&inRange;
 });
}
