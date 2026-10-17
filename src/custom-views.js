import { escapeHTML as e, favoriteKey } from './data.js';
import { scheduleMatches } from './schedule.js';
import { clubInfo } from './clubs.js';
import { exportGroupMetadata } from './export-data.js';
import { competitionContext, favoriteTitle } from './team-label.js';

export function viewItems(items) {
  const unique = new Map();
  for (const item of items || []) {
    if (!item || !['team', 'club'].includes(item.type) || !String(item.id || '').trim() || !/^\d+$/.test(String(item.committee || ''))) continue;
    const entry = { ...item, id: String(item.id), committee: String(item.committee) };
    unique.set(favoriteKey(entry.type, entry.id, entry.committee), entry);
  }
  return [...unique.values()];
}

export function customView(name, items, id = crypto.randomUUID()) {
  const title = String(name || '').trim();
  const selected = viewItems(items);
  if (!title || title.length > 80) throw new Error('Inserisci un nome di massimo 80 caratteri.');
  if (!selected.length) throw new Error('Seleziona almeno una squadra o società.');
  return { id, title, items: selected };
}

// Stesso parser e stessi contesti di calendario ed esportazione.
export function viewCatalog(records) {
  const metadata = exportGroupMetadata(records), entries = new Map();
  for (const match of scheduleMatches(records)) for (const team of [match.team1, match.team2]) {
    const committee = match.committeeId;
    const club = clubInfo(team);
    if (club) entries.set(favoriteKey('club', club.id, committee), { ...club, type: 'club', committee });
    if (!team?.id) continue;
    const key = favoriteKey('team', team.id, committee);
    if (!entries.has(key)) entries.set(key, { ...team, id: String(team.id), type: 'team', committee, contexts: [] });
    const item = entries.get(key);
    const context = competitionContext(metadata.get(`${committee}:${match.groupId}`) || { id: match.groupId, title: match.groupTitle });
    if (!item.contexts.some(value => value.groupId === context.groupId)) item.contexts.push(context);
  }
  return viewItems([...entries.values()]);
}

export function openCustomViewDialog({ view, items, onSave, committees = [], committee = '', loadItems }) {
  const keyOf = item => favoriteKey(item.type, item.id, item.committee);
  const options = new Map(viewItems([...(view?.items || []), ...items]).map(item => [keyOf(item), item]));
  const checked = new Set(viewItems(view?.items || []).map(keyOf));
  const dialog = document.createElement('dialog');
  dialog.className = 'custom-view-dialog';
  dialog.setAttribute('aria-labelledby', 'custom-view-title');
  dialog.innerHTML = `<form><button type="button" class="close" aria-label="Chiudi">×</button><h2 id="custom-view-title">${view?.id ? 'Modifica vista' : 'Crea vista'}</h2>
    <label class="view-name">Nome<input name="view-name" required maxlength="80" value="${e(view?.title || '')}" autocomplete="off"></label>
    ${loadItems ? `<label class="view-name">Comitato<select name="view-committee">${[...new Set(committees.map(item => item.region))].map(region => `<optgroup label="${e(region)}">${committees.filter(item => item.region === region).map(item => `<option value="${e(item.id)}">${e(item.title)}</option>`).join('')}</optgroup>`).join('')}</select></label>` : ''}
    <input class="view-search" type="search" name="view-search" placeholder="Cerca società, squadra o categoria" aria-label="Cerca società, squadra o categoria">
    <p data-view-status class="fine" role="status"></p>
    <fieldset class="view-items"><legend>Squadre e società</legend><div data-view-options></div></fieldset>
    <p data-view-error role="alert" hidden></p><div class="export-actions"><button type="button" data-cancel>Annulla</button><button type="submit" class="${view?.id ? '' : 'action-add'}">Salva vista</button></div></form>`;
  const status = dialog.querySelector('[data-view-status]');
  const search = dialog.querySelector('[name=view-search]');
  let controller;
  function filterOptions() {
    const query = search.value.trim().toLocaleLowerCase('it');
    for (const label of dialog.querySelectorAll('[data-view-options] label')) label.hidden = !label.dataset.search.includes(query);
  }
  function renderOptions() {
    const ordered = [...options.values()].sort((a, b) => Number(checked.has(keyOf(b))) - Number(checked.has(keyOf(a))) || a.type.localeCompare(b.type) || favoriteTitle(a).localeCompare(favoriteTitle(b), 'it'));
    dialog.querySelector('[data-view-options]').innerHTML = ordered.length ? ordered.map(item => {
      const title = favoriteTitle(item);
      const committeeTitle = committees.find(committee => committee.id === item.committee)?.title || '';
      return `<label data-search="${e(`${title} ${committeeTitle}`.toLocaleLowerCase('it'))}"><input type="checkbox" name="view-item" value="${e(keyOf(item))}" ${checked.has(keyOf(item)) ? 'checked' : ''}><span><small>${e([item.type === 'club' ? 'Società' : 'Squadra', committeeTitle].filter(Boolean).join(' · '))}</small>${e(title)}</span></label>`;
    }).join('') : '<p class="fine">Nessuna squadra o società disponibile.</p>';
    filterOptions();
  }
  dialog.querySelector('[data-view-options]').onchange = event => {
    const input = event.target.closest('[name=view-item]'); if (!input) return;
    if (input.checked) checked.add(input.value); else checked.delete(input.value);
  };
  search.oninput = filterOptions;
  async function load() {
    controller?.abort(); controller = new AbortController(); const signal = controller.signal;
    status.textContent = 'Caricamento società e squadre…';
    try {
      const result = await loadItems(dialog.querySelector('[name=view-committee]').value, signal);
      if (signal.aborted) return;
      for (const item of viewItems(result.items)) options.set(keyOf(item), item);
      renderOptions();
      status.textContent = result.issues?.length ? 'Alcuni calendari non sono disponibili: sono mostrate le voci recuperate e salvate.' : `${result.items.length} società e squadre nel comitato.`;
    } catch (error) {
      if (!signal.aborted) status.textContent = `Caricamento non riuscito: ${error.message}`;
    }
  }
  dialog.querySelector('form').onsubmit = async event => {
    event.preventDefault();
    const submit = dialog.querySelector('[type=submit]'); submit.disabled = true;
    try {
      await onSave(customView(dialog.querySelector('[name=view-name]').value, [...checked].map(key => options.get(key)), view?.id));
      dialog.close();
    } catch (error) {
      const status = dialog.querySelector('[data-view-error]');
      status.textContent = error.message; status.hidden = false;
    } finally { submit.disabled = false; }
  };
  for (const button of dialog.querySelectorAll('.close,[data-cancel]')) button.onclick = () => dialog.close();
  dialog.addEventListener('close', () => { controller?.abort(); dialog.remove(); }, { once: true });
  renderOptions();
  if (loadItems && committees.length) {
    const select = dialog.querySelector('[name=view-committee]');
    select.value = committees.some(item => item.id === committee) ? committee : committees.find(item => item.region === 'Liguria')?.id || committees[0].id;
    select.onchange = load; load();
  }
  document.body.append(dialog); dialog.showModal(); dialog.querySelector('[name=view-name]').focus();
}
