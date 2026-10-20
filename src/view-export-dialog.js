import { escapeHTML as e } from './data.js';
import { viewExportSections, buildCalendarDownload, OPTIONAL_EXPORT_COLUMNS } from './calendar-export.js';
import { icsExportStats } from './ics-export.js';

export function openViewExport({games,records,committees,title,fileType='xlsx'}) {
  if(!['xlsx','ics'].includes(fileType))throw new Error('Formato di esportazione non valido.');
  const sections=viewExportSections({games,title});
  const ics=fileType==='ics',stats=icsExportStats(sections);
  const dialog=document.createElement('dialog');
  const controller=new AbortController();
  dialog.className='calendar-export';
  dialog.setAttribute('aria-labelledby','view-export-title');
  dialog.innerHTML=`<button type="button" class="close" aria-label="Chiudi">×</button>
    <h2 id="view-export-title">Esporta vista · ${ics?'ICS':'Excel'}</h2>
    <p class="export-subject">${e(title)}</p>
    <p>Solo le partite incluse nella vista, con i filtri attivi al momento dell’apertura.</p>
    ${ics?`<div class="export-fields"><label>Nome calendario<input name="calendar-name" type="text" maxlength="200" required value="${e(title)}"></label>
      <label class="export-check"><input name="include-warmup" type="checkbox">Includi riscaldamento</label>
      <label data-warmup hidden>Riscaldamento (minuti)<input name="warmup-minutes" type="number" min="1" max="1440" step="1" value="60" required disabled></label></div>
      <p class="fine">Durata: due ore dall’inizio della partita. Il riscaldamento anticipa l’inizio dell’evento.</p>
      <p class="fine">${stats.allDay} gare senza orario come eventi giornalieri; ${stats.skipped} gare senza data valida escluse.</p>`:
      `<fieldset class="export-columns"><legend>Colonne opzionali</legend><div>${OPTIONAL_EXPORT_COLUMNS.map(column=>`<label><input type="checkbox" name="optional-column" value="${e(column.id)}"><span>${e(column.label)}</span></label>`).join('')}</div></fieldset>`}
    <p data-status role="status">${sections[0]?.games.length||0} partite incluse${ics?` · ${stats.dated} esportabili`:''}</p>
    <div class="export-actions"><button type="button" data-download>Scarica</button></div>`;
  const field=name=>dialog.querySelector(`[name="${name}"]`);
  const download=dialog.querySelector('[data-download]');
  const status=text=>{dialog.querySelector('[data-status]').textContent=text;};
  const canDownload=sections.length>0&&(!ics||stats.dated>0);
  download.disabled=!canDownload;
  if(ics)field('include-warmup').onchange=()=>{
    const enabled=field('include-warmup').checked;
    dialog.querySelector('[data-warmup]').hidden=!enabled;
    field('warmup-minutes').disabled=!enabled;
  };
  download.onclick=async()=>{
    for(const input of dialog.querySelectorAll('input'))if(!input.reportValidity())return;
    download.disabled=true;status('Creazione file…');
    try{
      const file=await buildCalendarDownload({sections,records,committees,fileType,
        calendarName:ics?field('calendar-name').value:'',
        warmupMinutes:ics&&field('include-warmup').checked?Number(field('warmup-minutes').value):0,
        optionalColumns:[...dialog.querySelectorAll('[name="optional-column"]:checked')].map(input=>input.value),
        signal:controller.signal,
      });
      controller.signal.throwIfAborted();
      const url=URL.createObjectURL(new Blob([file.bytes],{type:file.type}));
      const link=document.createElement('a');
      link.href=url;link.download=file.filename;document.body.append(link);link.click();link.remove();
      setTimeout(()=>URL.revokeObjectURL(url),30000);
      status(`Download pronto: ${file.filename}`);
    }catch(error){if(!controller.signal.aborted)status(`Esportazione non riuscita: ${error.message}`);}
    finally{download.disabled=!canDownload;}
  };
  dialog.querySelector('.close').onclick=()=>dialog.close();
  dialog.addEventListener('close',()=>{controller.abort();dialog.remove();},{once:true});
  document.body.append(dialog);dialog.showModal();
}
