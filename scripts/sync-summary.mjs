import { appendFile, readFile } from 'node:fs/promises';
try {
  const report = JSON.parse(await readFile('public/data/sync-status.json', 'utf8'));
  const lines = [`## Sincronizzazione FIPAV: ${report.status}`, '', `${report.saved} file aggiornati.`, ''];
  for (const result of report.results) {
    lines.push(`- ${result.committee} ${result.title}: ${result.saved} aggiornati, ${result.failures.length} errori.`);
    for (const failure of result.failures) lines.push(`  - ${failure}`);
  }
  if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, lines.join('\n') + '\n');
  else console.log(lines.join('\n'));
  if (report.status === 'partial') console.log('::warning::Alcuni endpoint FIPAV non disponibili. Conservati gli ultimi file validi; dettagli nel riepilogo.');
} catch (error) {
  console.error(`Riepilogo non disponibile: ${error.message}`);
}
