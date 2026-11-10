import { escapeHTML as e } from './data.js';
import { createICalendar, matchICSStart } from './ics-export.js';
import { uniqueFilename } from './export-filenames.js';
import { competitionContext } from './team-label.js';
import { exportGroupMetadata } from './export-data.js';
import { bindNextcloudForm, nextcloudForm } from './nextcloud-dialog.js';

const compact = date => date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');

export function singleMatchCalendar(game, records = []) {
  const start = matchICSStart(game);
  if (!start) throw new Error('La partita non ha ancora una data valida.');
  const home = String(game.team1?.title || '').trim() || 'Da definire';
  const away = String(game.team2?.title || '').trim() || 'Da definire';
  const title = `${home} - ${away}`;
  const context = competitionContext(exportGroupMetadata(records).get(`${game.committeeId}:${game.groupId}`) || { id: game.groupId, title: game.groupTitle });
  const summary = `${context.code}-${home}-${away}`;
  const iso = start.value.replace(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})Z)?$/, (_, y, m, d, h, min, s) => `${y}-${m}-${d}${h ? `T${h}:${min}:${s}Z` : 'T00:00:00Z'}`);
  const end = new Date(new Date(iso).getTime() + (start.allDay ? 24 : 2) * 3600000);
  const endValue = start.allDay ? compact(end).slice(0, 8) : compact(end);
  const location = String(game.stadium || '').trim();
  const google = new URL('https://calendar.google.com/calendar/render');
  google.search = new URLSearchParams({ action: 'TEMPLATE', text: summary, dates: `${start.value}/${endValue}`, location, ctz: 'Europe/Rome' });
  const outlook = new URL('https://outlook.live.com/calendar/0/deeplink/compose');
  outlook.search = new URLSearchParams({ path: '/calendar/action/compose', rru: 'addevent', subject: summary, startdt: start.allDay ? iso.slice(0, 10) : iso, enddt: start.allDay ? end.toISOString().slice(0, 10) : end.toISOString(), allday: String(start.allDay), location });
  return { title, allDay: start.allDay, google: google.href, outlook: outlook.href,
    filename: `${uniqueFilename(`${title} ${start.value.slice(0, 8)}`, new Set())}.ics`,
    ics: createICalendar([{ title, games: [game] }], records, { calendarName: title }),
  };
}

export function openMatchCalendar(game, records) {
  const calendar = singleMatchCalendar(game, records);
  const url = URL.createObjectURL(new Blob([calendar.ics], { type: 'text/calendar;charset=utf-8' }));
  const dialog = document.createElement('dialog');
  dialog.className = 'calendar-export';
  dialog.setAttribute('aria-labelledby', 'match-calendar-title');
  dialog.innerHTML = `<button type="button" class="close" aria-label="Chiudi">×</button>
    <h2 id="match-calendar-title">Salva nel calendario</h2>
    <p>${e(calendar.title)}</p>
    <div class="match-calendar-options">
      <a href="${e(calendar.google)}" target="_blank" rel="noopener noreferrer">Google Calendar ↗</a>
      <a href="${e(calendar.outlook)}" target="_blank" rel="noopener noreferrer">Outlook ↗</a>
      <button type="button" data-nextcloud-open aria-expanded="false" aria-controls="match-nextcloud-panel">Nextcloud</button>
      <a href="${e(url)}" download="${e(calendar.filename)}">Scarica file ICS</a>
    </div>
    ${nextcloudForm}
    <p class="fine">Per Apple Calendario e altre app, apri o importa il file ICS scaricato. Da telefono puoi usare Google Calendar o Outlook anche nel browser.</p>
    <p class="fine">${calendar.allDay ? 'Orario da definire: evento giornaliero.' : 'Durata prevista: 2 ore. Orario italiano.'} Conferma il salvataggio nel calendario scelto. La partita salvata non si aggiorna automaticamente.</p>`;
  dialog.querySelector('.close').onclick = () => dialog.close();
  dialog.addEventListener('close', () => {
    dialog.remove();
    // Lascia terminare eventuali download avviati prima della chiusura.
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }, { once: true });
  document.body.append(dialog);
  bindNextcloudForm(dialog, game, calendar);
  dialog.showModal();
}
