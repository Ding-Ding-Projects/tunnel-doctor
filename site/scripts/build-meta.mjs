// Writes site/build-meta.json: the app version (from package.json) and the
// time of the latest commit. The site shows "unavailable" for any missing value.
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', '..');
const meta = { version: null, updated: null, commit: null };

try { meta.version = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).version || null; } catch { /* leave null */ }
try { meta.updated = execFileSync('git', ['log', '-1', '--format=%cI'], { cwd: root, encoding: 'utf8' }).trim() || null; } catch { /* leave null */ }
try { meta.commit = execFileSync('git', ['log', '-1', '--format=%h'], { cwd: root, encoding: 'utf8' }).trim() || null; } catch { /* leave null */ }

writeFileSync(join(here, '..', 'build-meta.json'), JSON.stringify(meta, null, 2) + '\n');
console.log('build-meta.json', meta);
