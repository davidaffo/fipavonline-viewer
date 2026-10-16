import { icsExportStats } from './ics-export.js';
import { favoriteTitle } from './team-label.js';
import { escapeHTML as e } from './data.js';
import { loadExportRecords } from './export-data.js';
import { exportCatalog, exportSections, buildCalendarDownload, OPTIONAL_EXPORT_COLUMNS } from './calendar-export.js';

export function openCalendarExport({ source, committees, committee, favorite, teamKey, cached }) {
  const dialog = document.createElement('dialog');
  dialog.className = 'calendar-export';
  dialog.setAttribute('aria-labelledby', 'xlsx-title');
  const origin = committees.find(item => item.id === (favorite?.committee || committee));
  const contextual = favorite?.type === 'club' || favorite?.type === 'team';
  const regions = [...new Set(committees.map(item => item.region))];
  dialog.innerHTML = `<button type="button" class="close" aria-label="Chiudi">×</button><h2 id="xlsx-title">Esporta calendari</h2>${contextual ? `<p class="export-subject">${e(favoriteTitle(favorite))}</p>` : ''}
    <div class="export-fields"><label>Regione<select name="region">${regions.map(region => `<option>${e(region)}</option>`).join('')}</select></label>
    <label>Comitato<select name="committee"></select></label>
    <label>Calendari<select name="scope"><option value="all">Tutte le società</option><option value="club">Una società</option><option value="team">Una squadra</option></select></label>
    <label data-field="club" hidden>Società<select name="club"></select></label>
    <label data-field="team" hidden>Squadra<select name="team"></select></label>
    <label data-field="grouping">Suddivisione<select name="grouping"><option value="club">Un foglio per società</option><option value="team">Un foglio per squadra</option></select></label>
    <label>Formato<select name="file-type"><option value="xlsx">Excel (.xlsx)</option><option value="ics">Calendario (.ics)</option></select></label><label>Download<select name="format"><option value="single">Un Excel con più fogli</option><option value="separate">Excel separati in uno ZIP</option></select></label></div>
    <p data-overview-note class="fine" hidden>Include anche un calendario completo per società, con campionato e girone.</p><fieldset class="export-columns"><legend>Colonne opzionali</legend><div>${OPTIONAL_EXPORT_COLUMNS.map(column => `<label><input type="checkbox" name="optional-column" value="${e(column.id)}"><span>${e(column.label)}</span></label>`).join('')}</div></fieldset>
    <p class="fine">Calendari completi, indipendenti dalla data e dai filtri della vista.</p>
    <p data-ics-note class="fine" hidden></p><p data-status role="status"></p><p data-issues class="export-issues" hidden></p>
    <div class="export-actions"><button type="button" data-reload class="secondary">Ricarica dati</button><button type="button" data-download disabled>Scarica</button></div>`;
  const field = name => dialog.querySelector(`[name="${name}"]`);
  const status = text => { dialog.querySelector('[data-status]').textContent = text; };
  const download = dialog.querySelector('[data-download]');
  let controller, result, catalog, busy = false, initial = true;
  field('region').value = origin?.region || (regions.includes('Liguria') ? 'Liguria' : regions[0]);
  function committeeOptions() {
    field('committee').innerHTML = '<option value="">Tutta la regione</option>' + committees.filter(item => item.region === field('region').value).map(item => `<option value="${e(item.id)}">${e(item.title)}</option>`).join('');
  }
  committeeOptions();
  if (origin && favorite?.type !== 'club') field('committee').value = origin.id;
  if(contextual){
    field('scope').value=favorite.type;
    if(favorite.type==='club')field('grouping').value='team';
    for(const name of ['region','committee','scope'])field(name).closest('label').hidden=true;
  }
  function sections() {
    return exportSections({ ...result, scope: field('scope').value, clubId: field('club').value, teamKey: field('team').value, grouping: field('grouping').value });
  }
  function selection() {
    const scope = field('scope').value;
    const ics = field('file-type').value === 'ics';
    const note = dialog.querySelector('[data-overview-note]');
    note.hidden = !(scope === 'club' || (scope === 'all' && field('grouping').value === 'club')) || (ics && field('format').value === 'single');
    note.textContent = ics ? 'Nello ZIP è incluso anche il calendario completo della società.' : 'Include anche un calendario completo per società, con campionato e girone.';
    dialog.querySelector('.export-columns legend').textContent = ics ? 'Dati opzionali negli eventi' : 'Colonne opzionali';
    for(const option of field('format').options) option.textContent = option.value === 'single' ? (ics ? 'Un calendario unico' : 'Un Excel con più fogli') : (ics ? 'Calendari separati in uno ZIP' : 'Excel separati in uno ZIP');
    for(const option of field('grouping').options) option.textContent = `${ics ? 'Un calendario' : 'Un foglio'} per ${option.value === 'club' ? 'società' : 'squadra'}`;
    const icsNote = dialog.querySelector('[data-ics-note]');
    icsNote.hidden = !ics;
    icsNote.textContent = 'Il file unico riunisce le partite senza duplicati. Le gare senza orario sono eventi giornalieri; quelle senza data sono escluse.';
    for (const name of ['club', 'team']) dialog.querySelector(`[data-field="${name}"]`).hidden = contextual || scope !== name;
    dialog.querySelector('[data-field="grouping"]').hidden = scope === 'team';
    if (!result || busy) return;
    const list = sections();
    const stats = ics ? icsExportStats(list) : null;
    download.disabled = !list.length || (ics && !stats.dated);
    if(ics) icsNote.textContent = `File unico senza duplicati. ${stats.allDay} gare senza orario come eventi giornalieri; ${stats.skipped} gare senza data escluse.`;
    const count=new Set(list.flatMap(section=>section.games.map(game=>`${game.committeeId}:${game.groupId}:${game.id}`))).size;
    status(`${count} partite · ${list.length} ${list.length === 1 ? 'calendario selezionato' : 'calendari selezionati'}`);
  }
  function setBusy(value) {
    busy = value;
    for (const control of dialog.querySelectorAll('select, input[type=checkbox], [data-reload], [data-download]')) control.disabled = value;
  }
  async function load() {
    controller?.abort(); controller = new AbortController();
    const signal = controller.signal;
    result = null; setBusy(true);
    dialog.querySelector('[data-issues]').hidden = true;
    try {
      const selected = committees.filter(item => item.region === field('region').value && (!field('committee').value || item.id === field('committee').value));
      result = await loadExportRecords({ source, committees: selected, cached: cached(), signal, progress: status });
      catalog = exportCatalog(result.games, result.records);
      for (const name of ['club', 'team']) {
        const previous = field(name).value;
        field(name).innerHTML = (name === 'club' ? catalog.clubs : catalog.teams).map(item => `<option value="${e(item.key)}">${e(item.label || item.title)}${name === 'club' ? ` · ${e(item.id)}` : ''}</option>`).join('');
        if ([...field(name).options].some(option => option.value === previous)) field(name).value = previous;
      }
      if (initial || contextual) {
        if (favorite?.type === 'club') { field('scope').value = 'club'; field('club').value = favorite.id; }
        if (favorite?.type === 'team' || teamKey) { field('scope').value = 'team'; field('team').value = teamKey || `${favorite.committee}:${favorite.id}`; }
        initial = false;
      }
      const warning = dialog.querySelector('[data-issues]');
      warning.hidden = !result.issues.length;
      warning.textContent = `${result.issues.length} sorgenti mancanti o non aggiornate. L’export userà solo i dati disponibili. Dettagli inclusi nel file esportato.`;
      if (result.issues.length) warning.title = result.issues.join('\n');
      setBusy(false); selection();
    } catch (error) {
      if (!signal.aborted) { setBusy(false); download.disabled = true; status(`Caricamento non riuscito: ${error.message}`); }
    }
  }
  field('region').onchange = () => { committeeOptions(); load(); };
  field('committee').onchange = load;
  for (const name of ['scope', 'club', 'team', 'grouping', 'format', 'file-type']) field(name).onchange = selection;
  dialog.querySelector('[data-reload]').onclick = load;
  download.onclick = async () => {
    const list = sections(); setBusy(true); status(field('file-type').value === 'ics' ? 'Creazione calendario…' : 'Creazione Excel…');
    try {
      const file = await buildCalendarDownload({ sections: list, records: result.records, issues: result.issues, committees, format: field('format').value, fileType: field('file-type').value, optionalColumns: [...dialog.querySelectorAll('[name=optional-column]:checked')].map(input => input.value), signal: controller.signal, progress: status });
      controller.signal.throwIfAborted();
      const url = URL.createObjectURL(new Blob([file.bytes], { type: file.type }));
      const link = document.createElement('a'); link.href = url; link.download = file.filename; document.body.append(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 30000);
      status(`Download pronto: ${file.filename}`);
    } catch (error) { if (!controller.signal.aborted) status(`Esportazione non riuscita: ${error.message}`); }
    finally { if (dialog.open) { setBusy(false); download.disabled = !sections().length; } }
  };
  dialog.querySelector('.close').onclick = () => dialog.close();
  dialog.addEventListener('close', () => { controller?.abort(); dialog.remove(); }, { once: true });
  document.body.append(dialog); dialog.showModal(); selection(); load();
}
