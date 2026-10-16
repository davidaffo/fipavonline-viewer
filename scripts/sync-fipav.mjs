import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createInterface } from 'node:readline/promises';
import { classify, urls } from '../src/data.js';

export async function selectCommittees(committees, ask, print = console.log) {
  const regions = [...new Set(committees.map(c => c.region))].sort((a, b) => a.localeCompare(b, 'it'));
  async function choose(prompt, max, min = 1) {
    while (true) {
      const answer = (await ask(prompt)).trim();
      if (/^\d+$/.test(answer) && Number(answer) >= min && Number(answer) <= max) return Number(answer);
      print(`Inserisci un numero da ${min} a ${max}.`);
    }
  }
  print('Quale regione vuoi scaricare?');
  regions.forEach((region, i) => print(`${i + 1}. ${region}`));
  const region = regions[await choose('Regione: ', regions.length) - 1];
  const available = committees.filter(c => c.region === region);
  print(`\nComitati di ${region}:`);
  print('0. Tutti i comitati della regione');
  available.forEach((committee, i) => print(`${i + 1}. ${committee.title} (${committee.id})`));
  const index = await choose('Comitato: ', available.length, 0);
  return index === 0 ? available : [available[index - 1]];
}

// Mantiene il payload originale: il parser dell'app gestisce le varianti FIPAV.
export async function syncCommittee(committee, { groups, output = resolve('public/data'), fetcher = fetch } = {}) {
  if (!/^\d+$/.test(committee)) throw new Error('ID comitato non valido.');
  if (groups?.some(id => !/^\d+$/.test(id))) throw new Error('ID girone non valido.');
  const failures = [];
  let saved = 0;
  async function download(kind, group = '') {
    let last;
    for (const url of urls(kind, committee, group)) {
      try {
        const response = await fetcher(url, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(20000) });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const json = await response.json();
        if (classify(json) !== kind) throw new Error('Formato dati inatteso');
        const record = { json, at: Date.now(), source: 'snapshot', origin: url };
        const target = resolve(output, committee, `${kind}${group ? `-${group}` : ''}.json`);
        await mkdir(dirname(target), { recursive: true });
        await writeFile(`${target}.tmp`, JSON.stringify(record));
        await rename(`${target}.tmp`, target);
        saved++;
        return json;
      } catch (error) { last = error; }
    }
    failures.push(`${kind}${group ? ` ${group}` : ''}: ${last.message}`);
    return null;
  }
  await download('live');
  let list = await download('groups');
  if (!list) {
    try { const previous = JSON.parse(await readFile(resolve(output, committee, 'groups.json'), 'utf8')); if (classify(previous.json) === 'groups') list = previous.json; } catch {}
  }
  const ids = groups ?? list?.data.map(g => String(g.id)) ?? [];
  // Sequenziale per non sovraccaricare il servizio pubblico.
  for (const id of new Set(ids)) {
    if (!/^\d+$/.test(id)) { failures.push(`ID girone non valido: ${id}`); continue; }
    await download('calendar', id);
    await download('standings', id);
  }
  return { saved, failures };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const [committee, ...selected] = process.argv.slice(2);
    const committees = JSON.parse(await readFile(new URL('../public/committees.json', import.meta.url), 'utf8'));
    let targets;
    if (committee) {
      targets = committees.filter(c => c.id === committee);
      if (!targets.length) throw new Error('Comitato non valido. Avvia npm run sync:fipav per scegliere la regione, oppure usa: npm run sync:fipav -- ID_COMITATO [ID_GIRONE ...].');
    } else {
      if (!process.stdin.isTTY) throw new Error('Per scegliere la regione avvia npm run sync:fipav in un terminale interattivo. In automazione specifica ID_COMITATO [ID_GIRONE ...].');
      const terminal = createInterface({ input: process.stdin, output: process.stdout });
      try { targets = await selectCommittees(committees, prompt => terminal.question(prompt)); }
      finally { terminal.close(); }
    }
    for (const target of targets) {
      console.log(`\nDownload ${target.title} (${target.id}) — tutti i gironi selezionati; l'operazione può richiedere diversi minuti.`);
      const result = await syncCommittee(target.id, { groups: selected.length ? selected : undefined });
      console.log(`${result.saved} file aggiornati in public/data/${target.id}.`);
      for (const failure of result.failures) console.error(`${target.id}: ${failure}`);
      if (result.failures.length) process.exitCode = 1;
    }
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
