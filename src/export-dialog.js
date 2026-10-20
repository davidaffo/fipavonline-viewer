import { icsExportStats } from './ics-export.js';
import { favoriteTitle } from './team-label.js';
import { escapeHTML as e } from './data.js';
import { loadExportRecords } from './export-data.js';
import { exportCatalog, exportSections, selectedExportSections, buildCalendarDownload, OPTIONAL_EXPORT_COLUMNS } from './calendar-export.js';

export function openCalendarExport({ source, committees, committee, favorite, teamKey, cached, selection: selectedItems = null, fileType = 'xlsx', dateRange = {}, hidePlayed = false }) {
  if (!['xlsx', 'ics'].includes(fileType)) throw new Error('Formato di esportazione non valido.');
  const ics = fileType === 'ics';
  const dialog = document.createElement('dialog');
  dialog.className = 'calendar-export';
  dialog.setAttribute('aria-labelledby', 'export-title');
  const origin = committees.find(item => item.id === (favorite?.committee || committee));
  const contextual = favorite?.type === 'club' || favorite?.type === 'team';
  const fixedSelection=selectedItems?.length?selectedItems:null;
  const regions = [...new Set(committees.map(item => item.region))];
  dialog.innerHTML = `<button type="button" class="close" aria-label="Chiudi">×</button><h2 id="export-title">${ics ? 'Esporta ICS' : 'Esporta Excel'}</h2>${fixedSelection ? `<p class="export-subject">${fixedSelection.length} ${fixedSelection.length===1?'selezionata':'selezionate'}: ${e(fixedSelection.map(item=>item.title).join(', '))}</p>` : contextual ? `<p class="export-subject">${e(favoriteTitle(favorite))}</p>` : ''}
    <div class="export-fields"><label>Regione<select name="region">${regions.map(region => `<option>${e(region)}</option>`).join('')}</select></label>
    <label>Comitato<select name="committee"></select></label>
    <label>Calendari<select name="scope"><option value="all">Tutte le società</option><option value="club">Una società</option><option value="team" hidden>Squadra selezionata</option></select></label>
    <label data-field="club" hidden>Società<select name="club"></select></label>

    <label data-field="grouping">Suddivisione<select name="grouping"><option value="club">Un foglio per società</option><option value="team">Un foglio per squadra</option></select></label>
    ${ics ? '' : '<label class="export-check" data-field="combined"><input name="include-combined" type="checkbox">Includi foglio complessivo con campionato e girone</label>'}
    ${ics ? '' : '<label class="export-check" data-field="unified" hidden><input name="include-unified" type="checkbox">Includi un foglio unico per tutte le società selezionate</label>'}
    <label>Dal<input name="date-from" type="date"></label>
    <label>Al<input name="date-to" type="date"></label>
    <label class="export-check"><input name="hide-played" type="checkbox">Nascondi partite già svolte</label>
    <label data-field="format" hidden>Download<select name="format"><option value="single">Un Excel con più fogli</option><option value="separate">Excel separati in uno ZIP</option></select></label>
    ${ics ? `<label>Nome calendario<input name="calendar-name" type="text" maxlength="200" required></label>
    <label class="export-check"><input name="include-warmup" type="checkbox">Includi riscaldamento</label>
    <label data-warmup-minutes hidden>Riscaldamento (minuti)<input name="warmup-minutes" type="number" min="1" max="1440" step="1" value="60" required disabled></label>
    <p data-duration class="fine"></p>` : ''}</div>
    <p data-overview-note class="fine" hidden>Include anche un calendario completo per società, con campionato e girone.</p>${ics ? '' : `<fieldset class="export-columns"><legend>Colonne opzionali</legend><div>${OPTIONAL_EXPORT_COLUMNS.map(column => `<label><input type="checkbox" name="optional-column" value="${e(column.id)}"><span>${e(column.label)}</span></label>`).join('')}</div></fieldset>`}
    <p class="fine">Il periodo include le date Dal e Al. Lascia vuoti i campi per esportare tutte le date; con un limite attivo le gare senza data sono escluse.</p>
    <p data-ics-note class="fine" hidden></p><p data-status role="status"></p><p data-issues class="export-issues" hidden></p>
    <div class="export-actions"><button type="button" data-reload class="secondary">Ricarica dati</button><button type="button" data-download disabled>Scarica</button></div>`;
  const field = name => dialog.querySelector(`[name="${name}"]`);
  const status = text => { dialog.querySelector('[data-status]').textContent = text; };
  const download = dialog.querySelector('[data-download]');
  field('date-from').value = dateRange.dateFrom || '';
  field('date-to').value = dateRange.dateTo || '';
  field('hide-played').checked = hidePlayed;
  let controller, result, catalog, busy = false, initial = true, nameEdited = false;
  if(!ics)field('include-combined').checked=fixedSelection?fixedSelection.some(item=>item.type==='club'):favorite?.type!=='team'&&!teamKey;
  const preferredTeam=teamKey||(favorite?.type==='team'?`${favorite.committee}:${favorite.id}`:'');
  field('region').value = origin?.region || (regions.includes('Liguria') ? 'Liguria' : regions[0]);
  function committeeOptions() {
    field('committee').innerHTML = '<option value="">Tutta la regione</option>' + committees.filter(item => item.region === field('region').value).map(item => `<option value="${e(item.id)}">${e(item.title)}</option>`).join('');
  }
  committeeOptions();
  if (origin && favorite?.type !== 'club') field('committee').value = origin.id;
  if(contextual||fixedSelection){
    field('scope').value=favorite?.type||'team';
    if(favorite?.type==='club'||fixedSelection)field('grouping').value='team';
    for(const name of ['region','committee','scope'])field(name).closest('label').hidden=true;
  }
  function sections() {
    const options={...result,dateFrom:field('date-from').value,dateTo:field('date-to').value,grouping:field('grouping').value,hidePlayed:field('hide-played').checked,...(!ics?{includeCombined:field('include-combined').checked,includeUnified:field('include-unified').checked}:{})};
    if(fixedSelection)return selectedExportSections({...options,selection:fixedSelection});
    return exportSections({...options,scope:field('scope').value,clubId:field('club').value,teamKey:preferredTeam});
  }
  function canIncludeCombined(){
    if(fixedSelection?.some(item=>item.type==='club')||field('scope').value==='club'||field('scope').value==='all')return true;
    return fixedSelection?.filter(item=>item.type==='team').length>1;
  }
  function selection() {
    const scope = field('scope').value;
    field('date-from').max = field('date-to').value;
    field('date-to').min = field('date-from').value;
    const chosen=catalog?.teams.filter(team=>team.key===preferredTeam)||[];
    if (ics) {
      const includeWarmup = field('include-warmup').checked;
      dialog.querySelector('[data-warmup-minutes]').hidden = !includeWarmup;
      field('warmup-minutes').disabled = busy || !includeWarmup;
      const minutes = includeWarmup ? Number(field('warmup-minutes').value) : 0;
      const duration = 120 + (Number.isFinite(minutes) ? minutes : 0);
      dialog.querySelector('[data-duration]').textContent = `Durata evento: ${Math.floor(duration / 60)} ore${duration % 60 ? ` e ${duration % 60} minuti` : ''}. ${includeWarmup ? `Inizio ${minutes} minuti prima della partita.` : 'Inizio all’orario della partita.'}`;
      if (!nameEdited) field('calendar-name').value = fixedSelection ? (fixedSelection.length===1?fixedSelection[0].title:'Calendari selezionati') : ['team','club'].includes(scope)&&chosen.length===1 ? chosen[0].label : scope==='club' ? catalog?.clubs.find(club=>club.key===field('club').value)?.title||favorite?.title||'Calendario società' : scope==='team' ? 'Squadre selezionate' : committees.find(item=>item.id===field('committee').value)?.title||field('region').value;
    }
    const note = dialog.querySelector('[data-overview-note]');
    note.hidden = !(scope === 'club' || (scope === 'all' && field('grouping').value === 'club')) || (ics && field('format').value === 'single');
    note.textContent = ics ? 'Nello ZIP è incluso anche il calendario completo della società.' : 'Include anche un calendario completo per società, con campionato e girone.';
    for(const option of field('format').options) option.textContent = option.value === 'single' ? (ics ? 'Un calendario unico' : 'Un Excel con più fogli') : (ics ? 'Calendari separati in uno ZIP' : 'Excel separati in uno ZIP');
    for(const option of field('grouping').options) option.textContent = `${ics ? 'Un calendario' : 'Un foglio'} per ${option.value === 'club' ? 'società' : 'squadra'}`;
    const icsNote = dialog.querySelector('[data-ics-note]');
    icsNote.hidden = !ics;
    icsNote.textContent = 'Il file unico riunisce le partite senza duplicati. Le gare senza orario sono eventi giornalieri; quelle senza data sono escluse.';
    dialog.querySelector('[data-field="club"]').hidden = contextual || !!fixedSelection || scope !== 'club';
    dialog.querySelector('[data-field="grouping"]').hidden = scope === 'team'&&(!fixedSelection||fixedSelection.every(item=>item.type==='team'));
    if (!result || busy) return;
    const list = sections();
    if(!ics){
      dialog.querySelector('[data-field=combined]').hidden=!canIncludeCombined();
      dialog.querySelector('[data-field=unified]').hidden=!fixedSelection||new Set(fixedSelection.filter(item=>item.type==='club').map(item=>item.id)).size<2;
      note.hidden=!list.some(section=>section.combined);
      note.textContent='Il foglio complessivo riunisce le partite senza duplicati, con campionato e girone. Nello ZIP è un Excel aggiuntivo.';
    }
    const multiple=list.length>1;
    dialog.querySelector('[data-field="format"]').hidden=!multiple;
    if(!multiple){field('format').value='single';dialog.querySelector('[data-field="grouping"]').hidden=true;}
    note.hidden=note.hidden||list.length<2;
    if(ics&&scope==='club')note.textContent=ics?'Nello ZIP è incluso anche il calendario completo delle squadre selezionate.':'Include anche il calendario completo delle squadre selezionate.';
    if(contextual&&!fixedSelection&&scope==='team')dialog.querySelector('.export-subject').textContent=chosen.length===1?chosen[0].label:`${chosen.length} squadre selezionate`;
    const stats = ics ? icsExportStats(list) : null;
    download.disabled = !field('date-from').validity.valid || !field('date-to').validity.valid || !list.length || (ics && !stats.dated);
    if(ics) icsNote.textContent = `File unico senza duplicati. ${stats.allDay} gare senza orario come eventi giornalieri; ${stats.skipped} gare senza data escluse.`;
    const count=new Set(list.flatMap(section=>section.games.map(game=>`${game.committeeId}:${game.groupId}:${game.id}`))).size;
    status(`${count} partite · ${list.length} ${list.length === 1 ? 'calendario selezionato' : 'calendari selezionati'}`);
  }
  function setBusy(value) {
    busy = value;
    for (const control of dialog.querySelectorAll('select, input, [data-reload], [data-download]')) control.disabled = value;
    if (ics) field('warmup-minutes').disabled = value || !field('include-warmup').checked;
  }
  async function load() {
    controller?.abort(); controller = new AbortController();
    const signal = controller.signal;
    result = null; setBusy(true);
    dialog.querySelector('[data-issues]').hidden = true;
    try {
      const selected = committees.filter(item => fixedSelection ? fixedSelection.some(chosen=>chosen.type==='club' ? item.region===(committees.find(origin=>origin.id===chosen.committee)?.region||field('region').value) : item.id===chosen.committee) : item.region === field('region').value && (!field('committee').value || item.id === field('committee').value));
      result = await loadExportRecords({ source, committees: selected, cached: cached(), signal, progress: status });
      catalog = exportCatalog(result.games, result.records);
      const previousClub=field('club').value;
      field('club').innerHTML=catalog.clubs.map(club=>`<option value="${e(club.key)}">${e(club.title)} · ${e(club.id)}</option>`).join('');
      if(catalog.clubs.some(club=>club.key===previousClub))field('club').value=previousClub;
      if (initial) {
        if (favorite?.type === 'club') { field('scope').value = 'club'; field('club').value = favorite.id; }
        if (favorite?.type === 'team' || teamKey) field('scope').value = 'team';
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
  field('region').onchange = () => { committeeOptions();load(); };
  field('committee').onchange = () => load();
  for (const name of ['club', 'grouping', 'format']) field(name).onchange = selection;
  field('scope').onchange=()=>{if(!ics)field('include-combined').checked=field('scope').value!=='team';selection();};
  if (ics) {
    field('calendar-name').oninput = () => { nameEdited = true; };
    field('include-warmup').onchange = selection;
    field('warmup-minutes').oninput = selection;
  }
  field('hide-played').onchange = selection;
  for (const name of ['date-from', 'date-to']) field(name).onchange = selection;
  if(!ics)for(const name of ['include-combined','include-unified'])field(name).onchange=selection;
  dialog.querySelector('[data-reload]').onclick = load;
  download.onclick = async () => {
    for (const control of dialog.querySelectorAll('input, select')) if (!control.reportValidity()) return;
    const list = sections(); setBusy(true); status(ics ? 'Creazione calendario…' : 'Creazione Excel…');
    try {
      const file = await buildCalendarDownload({ sections: list, records: result.records, issues: result.issues, committees, format: list.length>1?field('format').value:'single', fileType, calendarName: ics ? field('calendar-name').value : '', warmupMinutes: ics && field('include-warmup').checked ? Number(field('warmup-minutes').value) : 0, optionalColumns: [...dialog.querySelectorAll('[name=optional-column]:checked')].map(input => input.value), signal: controller.signal, progress: status });
      controller.signal.throwIfAborted();
      const url = URL.createObjectURL(new Blob([file.bytes], { type: file.type }));
      const link = document.createElement('a'); link.href = url; link.download = file.filename; document.body.append(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 30000);
      status(`Download pronto: ${file.filename}`);
    } catch (error) { if (!controller.signal.aborted) status(`Esportazione non riuscita: ${error.message}`); }
    finally { if (dialog.open) { setBusy(false); const list=sections(); download.disabled=!field('date-from').validity.valid||!field('date-to').validity.valid||!list.length||(ics&&!icsExportStats(list).dated); } }
  };
  dialog.querySelector('.close').onclick = () => dialog.close();
  dialog.addEventListener('close', () => { controller?.abort(); dialog.remove(); }, { once: true });
  document.body.append(dialog); dialog.showModal(); selection(); load();
}
