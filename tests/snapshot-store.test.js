import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
const script = fileURLToPath(new URL('../scripts/snapshot-store.sh', import.meta.url));

test('branch dati: prima esecuzione, recupero snapshot successivo e indice del codice invariato', async () => {
 const temp = await mkdtemp(join(tmpdir(), 'fipav-store-'));
 const git = (cwd, ...args) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
 const store = (cwd, mode) => execFileSync('bash', [script, mode], { cwd, stdio: ['ignore', 'pipe', 'pipe'] });
 try {
  const remote = join(temp, 'origin.git'); const local = join(temp, 'code');
  await mkdir(local); git(temp, 'init', '--bare', remote); git(local, 'init'); git(local, 'remote', 'add', 'origin', remote);
  await writeFile(join(local, 'README.md'), 'code'); git(local, 'add', 'README.md');
  git(local, '-c', 'user.name=Test', '-c', 'user.email=test@example.com', 'commit', '-m', 'Initial');
  store(local, 'restore');
  await mkdir(join(local, 'public/data'), { recursive: true }); await writeFile(join(local, 'public/data/groups.json'), '{"at":123}');
  const index = git(local, 'write-tree'); store(local, 'save'); assert.equal(git(local, 'write-tree'), index);
  assert.equal(git(temp, '--git-dir', remote, 'ls-tree', '-r', '--name-only', 'data-snapshots'), 'public/data/groups.json');
  await writeFile(join(local, 'public/data/groups.json'), 'overwritten'); store(local, 'restore');
  assert.equal(await readFile(join(local, 'public/data/groups.json'), 'utf8'), '{"at":123}');
  await writeFile(join(local, 'public/data/groups.json'), '{"at":456}'); store(local, 'save');
  assert.equal(git(temp, '--git-dir', remote, 'rev-list', '--count', 'data-snapshots'), '2');
  assert.equal(git(local, 'write-tree'), index);
 } finally { await rm(temp, { recursive: true, force: true }); }
});
