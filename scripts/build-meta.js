// Writes web/build-meta.json with the version and the commit time of the source
// being built, so every form shows provenance that belongs to the running build.
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
let updatedAt = null;
let commit = null;
try {
  updatedAt = execFileSync('git', ['log', '-1', '--format=%cI'], { encoding: 'utf8' }).trim() || null;
  commit = execFileSync('git', ['rev-parse', '--short', 'HEAD'], { encoding: 'utf8' }).trim() || null;
} catch { /* not a git checkout: provenance stays unavailable */ }
const meta = { version: pkg.version, updatedAt, commit };
writeFileSync(new URL('../web/build-meta.json', import.meta.url), JSON.stringify(meta, null, 2) + '\n');
console.log(`build-meta: ${meta.version} ${meta.commit || 'no commit'} ${meta.updatedAt || 'no time'}`);
