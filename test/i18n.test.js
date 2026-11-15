import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { RESULT_CODES, CHECK_NAME_IDS, FIX_NAME_IDS, resultText } from '../web/i18n.js';
import { CHECK_IDS } from '../core/checks.js';
import { FIXES } from '../core/fixes.js';

// Every result code the engine can emit must have English and Cantonese text.
test('every result code has text in both languages', () => {
  const src = readFileSync(new URL('../core/checks.js', import.meta.url), 'utf8');
  const literal = [...src.matchAll(/'((?:dns|zone|ssl|tunnel|route|edge|origin|ha|local|token|skip|check)\.[a-z0-9-]+)'/g)].map((m) => m[1]);
  const templated = ['edge', 'origin'].flatMap((p) => ['refused', 'unreachable', 'timeout', 'dns', 'tls', 'other'].map((k) => `${p}.${k}`));
  const needed = new Set([...literal, ...templated]);
  const missing = [...needed].filter((c) => !RESULT_CODES.includes(c));
  assert.deepEqual(missing, []);
  for (const c of needed) {
    const t = resultText(c, { hostname: 'h', resolver: 'r', addresses: 'a', zone: 'z', name: 'n', type: 'CNAME', proxied: 'true', mode: 'full', connections: 1, status: 502, service: 's', ms: 1, url: 'u', count: 1, message: 'm' });
    assert.ok(t.en && t.yue && t.en !== c, `text for ${c}`);
  }
});

test('every check and fix has a name', () => {
  assert.deepEqual(CHECK_IDS.filter((id) => !CHECK_NAME_IDS.includes(id)), []);
  assert.deepEqual(Object.keys(FIXES).filter((id) => !FIX_NAME_IDS.includes(id)), []);
});
