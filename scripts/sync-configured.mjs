import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { syncCommittee } from './sync-fipav.mjs';

export function configuredCommittees(config, available) {
  if (!Array.isArray(config.committees) || !Array.isArray(config.regions)) throw new Error('Configura gli elenchi committees e regions.');
  const regions = new Set(available.map(c => c.region));
  for (const id of config.committees) if (typeof id !== 'string' || !available.some(c => c.id === id)) throw new Error(`Comitato non valido: ${id}`);
  for (const region of config.regions) if (!regions.has(region)) throw new Error(`Regione non valida: ${region}`);
  const targets = available.filter(c => config.committees.includes(c.id) || config.regions.includes(c.region));
  if (!targets.length) throw new Error('Seleziona almeno un comitato o una regione in config/sync.json.');
  return targets;
}

export async function syncConfigured(config, { available, output = resolve('public/data'), sync = syncCommittee } = {}) {
  const targets = configuredCommittees(config, available);
  const startedAt = Date.now();
  const results = [];
  for (const target of targets) {
    const result = await sync(target.id, { output });
    results.push({ committee: target.id, title: target.title, ...result });
  }
  const saved = results.reduce((count, result) => count + result.saved, 0);
  const failures = results.reduce((count, result) => count + result.failures.length, 0);
  const report = { startedAt, finishedAt: Date.now(), status: saved === 0 ? 'failed' : failures ? 'partial' : 'success', saved, results };
  await mkdir(output, { recursive: true });
  const target = resolve(output, 'sync-status.json');
  await writeFile(`${target}.tmp`, JSON.stringify(report, null, 2));
  await rename(`${target}.tmp`, target);
  return report;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    await rm(resolve('public/data/sync-status.json'), { force: true });
    const config = JSON.parse(await readFile(resolve(process.argv[2] || 'config/sync.json'), 'utf8'));
    const available = JSON.parse(await readFile(new URL('../public/committees.json', import.meta.url), 'utf8'));
    const report = await syncConfigured(config, { available });
    for (const result of report.results) {
      console.log(`${result.committee} ${result.title}: ${result.saved} file aggiornati.`);
      for (const failure of result.failures) console.error(`${result.committee}: ${failure}`);
    }
    console.log(`Sincronizzazione ${report.status}: ${report.saved} file aggiornati.`);
    // Un errore parziale non blocca gli altri aggiornamenti; nessun download sì.
    if (report.status === 'failed') process.exitCode = 1;
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
