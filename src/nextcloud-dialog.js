import { escapeHTML as e } from './data.js';
import { createNextcloudClient, readNextcloudSettings, saveNextcloudSettings, forgetNextcloudSettings } from './nextcloud-calendar.js';

export function bindNextcloudForm(dialog, game, calendar) {
  const saved = readNextcloudSettings();
  const area = dialog.querySelector('[data-nextcloud-panel]');
  const form = area.querySelector('form');
  const field = name => form.elements.namedItem(name);
  const status = area.querySelector('[role="status"]');
  const save = area.querySelector('[data-nextcloud-save]');
  const forget = area.querySelector('[data-nextcloud-forget]');
  let calendars = [], controller, busy = false;
  field('server').value = saved.server;
  field('username').value = saved.username;
  const invalidate = () => {
    calendars = [];
    field('calendar').innerHTML = '<option value="">Connetti per caricare i calendari</option>';
    field('calendar').disabled = true;
    save.disabled = true;
  };
  const clearPassword = () => { field('password').value = ''; };
  const setBusy = value => {
    busy = value;
    for (const input of form.querySelectorAll('input,button')) input.disabled = value;
    field('calendar').disabled = value || !calendars.length;
    save.disabled = value || !calendars.length;
    form.setAttribute('aria-busy', String(value));
  };
  const client = () => createNextcloudClient({ server: field('server').value, username: field('username').value.trim(), password: field('password').value, signal: controller.signal });
  for (const name of ['server', 'username', 'password']) field(name).addEventListener('input', () => { invalidate(); status.textContent = ''; });
  dialog.querySelector('[data-nextcloud-open]').onclick = () => {
    area.hidden = !area.hidden;
    dialog.querySelector('[data-nextcloud-open]').setAttribute('aria-expanded', String(!area.hidden));
    if (!area.hidden) (field('server').value ? field('password') : field('server')).focus();
    else { controller?.abort(); clearPassword(); invalidate(); }
  };
  form.onsubmit = async event => {
    event.preventDefault();
    if (busy || !form.reportValidity()) return;
    controller = new AbortController();
    setBusy(true);
    status.textContent = 'Connessione a Nextcloud…';
    try {
      calendars = await client().calendars();
      if (controller.signal.aborted) return;
      field('calendar').innerHTML = calendars.length ? calendars.map(item => `<option value="${e(item.url)}">${e(item.title)}</option>`).join('') : '<option value="">Nessun calendario disponibile</option>';
      if (calendars.some(item => item.url === saved.calendar)) field('calendar').value = saved.calendar;
      status.textContent = calendars.length ? 'Scegli il calendario e salva la partita.' : 'Nessun calendario scrivibile che accetti eventi. Verifica i permessi in Nextcloud.';
      if (!calendars.length) clearPassword();
    } catch (error) {
      if (!controller.signal.aborted) { clearPassword(); invalidate(); status.textContent = error.message; }
    } finally { if (dialog.open) setBusy(false); }
  };
  save.onclick = async () => {
    if (busy || !form.reportValidity()) return;
    const selected = calendars.find(item => item.url === field('calendar').value);
    if (!selected) return;
    controller = new AbortController();
    setBusy(true);
    status.textContent = 'Salvataggio su Nextcloud…';
    try {
      const result = await client().save(selected.url, game, calendar.ics);
      if (controller.signal.aborted) return;
      let remembered = true;
      try { saveNextcloudSettings({ server: field('server').value, username: field('username').value.trim(), calendar: selected.url }); }
      catch { remembered = false; }
      status.textContent = `${result.alreadyExists ? 'La partita è già presente' : 'Partita salvata'} in «${selected.title}».${remembered ? '' : ' Il browser non ha consentito di ricordare le impostazioni.'}`;
    } catch (error) {
      if (!controller.signal.aborted) status.textContent = error.message;
    } finally {
      clearPassword();
      calendars = [];
      if (dialog.open) { setBusy(false); field('calendar').disabled = true; }
    }
  };
  forget.onclick = () => {
    try {
      forgetNextcloudSettings();
      saved.server = saved.username = saved.calendar = '';
      field('server').value = field('username').value = '';
      clearPassword(); invalidate();
      status.textContent = 'Impostazioni Nextcloud dimenticate su questo dispositivo.';
    } catch { status.textContent = 'Il browser non ha consentito di rimuovere le impostazioni.'; }
  };
  dialog.addEventListener('close', () => { controller?.abort(); clearPassword(); calendars = []; }, { once: true });
  invalidate();
}

export const nextcloudForm = `<section id="match-nextcloud-panel" data-nextcloud-panel hidden>
  <h3>Nextcloud</h3>
  <form autocomplete="off" class="export-fields">
    <label>Indirizzo Nextcloud<input name="server" type="url" placeholder="https://cloud.esempio.it" required autocomplete="off" spellcheck="false"></label>
    <label>Nome utente<input name="username" type="text" required autocomplete="off" autocapitalize="none" spellcheck="false"></label>
    <label>Password per app<input name="password" type="password" required autocomplete="off"></label>
    <p class="fine">Trovi le password per app nelle impostazioni personali di Nextcloud → Sicurezza. La password non viene memorizzata dall’app. Server, utente e calendario vengono ricordati su questo dispositivo dopo il salvataggio.</p>
    <button type="submit" data-nextcloud-connect>Connetti e carica calendari</button>
    <label>Calendario<select name="calendar" disabled><option value="">Connetti per caricare i calendari</option></select></label>
    <div class="export-actions"><button type="button" data-nextcloud-forget>Dimentica account</button><button type="button" data-nextcloud-save disabled>Salva su Nextcloud</button></div>
    <p role="status" aria-live="polite"></p>
  </form>
</section>`;
