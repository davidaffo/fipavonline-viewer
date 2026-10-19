import { dateISO, escapeHTML as e, localDate, groupInfo } from './data.js';
import { matchPresentation } from './match-card.js';

export function teamKey(team) { return team?.id ? `id:${team.id}` : team?.title ? `name:${team.title}` : ''; }
export function calendarTeams(matches) {
  const teams = new Map();
  for (const match of matches) for (const team of [match.team1, match.team2]) {
    const id = teamKey(team);
    if (id && !teams.has(id)) teams.set(id, { id, title: team.title || 'Squadra' });
  }
  return [...teams.values()].sort((a, b) => a.title.localeCompare(b.title, 'it'));
}
export function filterByTeam(matches, id) { return id ? matches.filter(match => [match.team1, match.team2].some(team => teamKey(team) === id)) : matches; }
export function shiftMonth(month, step) {
  const [year, number] = month.split('-').map(Number);
  return localDate(new Date(year, number - 1 + step, 1, 12)).slice(0, 7);
}
export function monthCells(month) {
  const [year, number] = month.split('-').map(Number);
  const first = new Date(year, number - 1, 1, 12);
  const offset = (first.getDay() + 6) % 7;
  const days = new Date(year, number, 0, 12).getDate();
  return Array.from({ length: Math.ceil((offset + days) / 7) * 7 }, (_, index) => {
    const day = index - offset + 1;
    return localDate(new Date(year, number - 1, day, 12));
  });
}
export function initialMonth(matches, today = localDate()) {
  const dates = matches.map(dateISO).filter(date => /^\d{4}-\d{2}-\d{2}$/.test(date)).sort();
  return (dates.find(date => date.slice(0, 7) === today.slice(0, 7)) || dates.find(date => date >= today) || dates.at(-1) || today).slice(0, 7);
}
export function monthLabel(month) { return new Date(`${month}-01T12:00:00`).toLocaleDateString('it-IT', { month: 'long', year: 'numeric' }); }
export function renderMonth(matches, { month, selectedDay }) {
  const byDate = new Map();
  for (const match of matches) { const date = dateISO(match); if (!byDate.has(date)) byDate.set(date, []); byDate.get(date).push(match); }
  const today = localDate();
  return `<div class="month-grid" role="group" aria-label="${e(monthLabel(month))}">
    ${['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'].map(day => `<div class="month-weekday" aria-hidden="true">${day}</div>`).join('')}
    ${monthCells(month).map(date => {
      const outside = !date.startsWith(month);
      const shortMonth = new Date(`${date}T12:00:00`).toLocaleDateString('it-IT', { month: 'short' });
      const games = byDate.get(date) || [];
      const label = new Date(`${date}T12:00:00`).toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' });
      return `<button type="button" class="month-day ${outside ? 'is-outside-month' : ''} ${date === today ? 'is-today' : ''} ${date === selectedDay ? 'is-selected' : ''}" data-calendar-day="${date}" aria-pressed="${date === selectedDay}" aria-label="${e(label)}${outside ? ' (altro mese)' : ''}: ${games.length} partite">
        <span class="month-day-number">${Number(date.slice(-2))}${outside ? `<span class="month-day-month">${e(shortMonth)}</span>` : ''}</span>
        ${games.length ? `<span class="month-day-count">${games.length} ${games.length === 1 ? 'gara' : 'gare'}</span>` : ''}
        <span class="month-events">${games.map(match => {
          const state = matchPresentation(match);
          const title = `${match.team1?.title || 'Da definire'} - ${match.team2?.title || 'Da definire'}`;
          const category = match.groupTitle ? groupInfo({ title: match.groupTitle }).championshipTitle : '';
          const meta = [String(match.time || '').replace(/^(\d{1,2})\.(\d{2})$/, '$1:$2'), category].filter(Boolean).join(' · ');
          return `<span class="calendar-event ${state.live ? 'event-live' : ''}" title="${e([meta, title].filter(Boolean).join(' · '))}" aria-label="${e(`${meta} ${title}`)}"><span class="event-time"><span class="event-meta">${e(meta)}</span>${state.hasScore ? `<strong>${e(match['team1-setwin'] ?? '–')}-${e(match['team2-setwin'] ?? '–')}</strong>` : ''}</span><span>${e(match.team1?.title || 'Da definire')}</span><span>${e(match.team2?.title || 'Da definire')}</span></span>`;
        }).join('')}<span class="month-more" hidden></span></span>
      </button>`;
    }).join('')}
  </div>`;
}

// Adatta le settimane allo spazio disponibile e mostra solo anteprime intere.
export function fitMonthGrid(grid) {
  if (!grid) return;
  const mobile = window.matchMedia('(max-width: 640px)').matches;
  const days = [...grid.querySelectorAll('.month-day')];
  const weeks = (days.length + grid.querySelectorAll('.month-blank').length) / 7;
  const weekday = grid.querySelector('.month-weekday')?.getBoundingClientRect().height || 24;
  const nav = document.querySelector('nav');
  const navHeight = nav && getComputedStyle(nav).position === 'fixed' ? nav.getBoundingClientRect().height : 0;
  const available = window.innerHeight - navHeight - 10 - (grid.getBoundingClientRect().top + window.scrollY) - weekday;
  const height = Math.max(mobile ? 44 : 54, Math.min(mobile ? 64 : 100, Math.floor(available / weeks)));
  grid.style.setProperty('--month-row-height', `${height}px`);
  for (const day of days) {
    const events = [...day.querySelectorAll('.calendar-event')];
    const more = day.querySelector('.month-more');
    if (!more) continue;
    const header = day.querySelector('.month-day-number').getBoundingClientRect().height;
    const room = height - header - 8;
    let visible = mobile ? 0 : Math.max(0, Math.floor((room + 2) / 34));
    events.forEach((event, index) => { event.hidden = index >= visible; });
    const remaining = events.length - Math.min(visible, events.length);
    more.hidden = mobile || remaining === 0;
    more.textContent = visible === 0 ? `${remaining} ${remaining === 1 ? 'gara' : 'gare'}` : `+${remaining} ${remaining === 1 ? 'gara' : 'gare'}`;
  }
}
