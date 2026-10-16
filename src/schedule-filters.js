import { dateISO, groupInfo } from './data.js';
import { filterByTeam } from './calendar.js';

// Le tre viste condividono gli stessi filtri; solo Giorno limita la data.
export function filterSchedule(games,{groups=[],championship='',group='',team='',day=''}={}) {
 const allowed=championship?new Set(groups.filter(item=>groupInfo(item).championshipId===championship).map(item=>String(item.id))):null;
 return filterByTeam(games,team).filter(game=>(!group||game.groupId===group)&&(!allowed||allowed.has(game.groupId))&&(!day||dateISO(game)===day));
}
