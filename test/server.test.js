import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile, readdir } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createServer } from '../server/index.js';

const TOKEN = 'cf_test_token_0123456789_abcdefghij';
const PASSWORD = 'correct horse battery';

function fakeFetch(url, init) {
  const reply = (result, status = 200) => ({ ok: status < 400, status, json: async () => ({ success: status < 400, result, errors: status < 400 ? [] : [{ code: 1, message: 'nope' }] }) });
  if (url.endsWith('/user/tokens/verify')) return reply({ status: init.headers.authorization === `Bearer ${TOKEN}` ? 'active' : 'disabled' });
  if (url.includes('/zones')) return reply([{ id: 'z1', name: 'example.com', status: 'active' }]);
  return reply(null, 404);
}

async function boot() {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'td-'));
  const server = createServer({ dataDir: dir, fetchImpl: fakeFetch, secretKey: 'unit-test-key' });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  let cookie = '';
  async function api(method, route, body, { header = true, raw } = {}) {
    const headers = { 'content-type': 'application/json' };
    if (header) headers['x-tunnel-doctor'] = '1';
    if (cookie) headers.cookie = cookie;
    const res = await fetch(base + route, { method, headers, body: raw ?? (body === undefined ? undefined : JSON.stringify(body)) });
    const set = res.headers.get('set-cookie');
    if (set) cookie = set.split(';')[0];
    const text = await res.text();
    let json = null;
    try { json = JSON.parse(text); } catch { /* not JSON */ }
    return { status: res.status, json, text, headers: res.headers };
  }
  return { api, dir, close: async () => { server.close(); server.closeAllConnections(); await rm(dir, { recursive: true, force: true }); } };
}

test('health is public and reports the version', async () => {
  const t = await boot();
  try {
    const r = await t.api('GET', '/api/health');
    assert.equal(r.status, 200);
    assert.equal(r.json.ok, true);
    assert.match(r.json.version, /^\d+\.\d+\.\d+/);
  } finally { await t.close(); }
});

test('first-run setup, logout and login', async () => {
  const t = await boot();
  try {
    assert.deepEqual((await t.api('GET', '/api/auth/state')).json, { configured: false, signedIn: false });
    assert.equal((await t.api('POST', '/api/auth/setup', { password: 'short' })).status, 400);
    const setup = await t.api('POST', '/api/auth/setup', { password: PASSWORD });
    assert.equal(setup.status, 200);
    assert.match(setup.headers.get('set-cookie'), /HttpOnly/);
    assert.match(setup.headers.get('set-cookie'), /SameSite=Strict/);
    assert.deepEqual((await t.api('GET', '/api/auth/state')).json, { configured: true, signedIn: true });
    assert.equal((await t.api('POST', '/api/auth/setup', { password: PASSWORD })).status, 409);
    await t.api('POST', '/api/auth/logout');
    assert.equal((await t.api('GET', '/api/settings')).status, 401);
    assert.equal((await t.api('POST', '/api/auth/login', { password: 'wrong password!' })).status, 401);
    assert.equal((await t.api('POST', '/api/auth/login', { password: PASSWORD })).status, 200);
    assert.equal((await t.api('GET', '/api/settings')).status, 200);
  } finally { await t.close(); }
});

test('signed-out requests get 401 and state changes need the header', async () => {
  const t = await boot();
  try {
    assert.equal((await t.api('GET', '/api/capabilities')).status, 401);
    assert.equal((await t.api('POST', '/api/auth/login', { password: 'x' }, { header: false })).status, 403);
    await t.api('POST', '/api/auth/setup', { password: PASSWORD });
    assert.equal((await t.api('PATCH', '/api/settings', { funnyEn: 3 }, { header: false })).status, 403);
    assert.equal((await t.api('PATCH', '/api/settings', { funnyEn: 3 })).status, 200);
  } finally { await t.close(); }
});

test('settings round trip and validation', async () => {
  const t = await boot();
  try {
    await t.api('POST', '/api/auth/setup', { password: PASSWORD });
    const patched = await t.api('PATCH', '/api/settings', { funnyEn: 2, language: 'en' });
    assert.equal(patched.json.funnyEn, 2);
    assert.equal((await t.api('GET', '/api/settings')).json.language, 'en');
    assert.equal((await t.api('PATCH', '/api/settings', { funnyEn: 9 })).status, 400);
    const reset = await t.api('POST', '/api/settings/reset', { keys: ['funnyEn'] });
    assert.equal(reset.json.funnyEn, 5);
    assert.equal(reset.json.language, 'en');
    assert.equal((await t.api('GET', '/api/capabilities')).json.form, 'hosted');
  } finally { await t.close(); }
});

test('the token is stored encrypted and never returned', async () => {
  const t = await boot();
  try {
    await t.api('POST', '/api/auth/setup', { password: PASSWORD });
    assert.deepEqual((await t.api('GET', '/api/token')).json, { saved: false });
    const bad = await t.api('PUT', '/api/token', { token: 'cf_wrong_token_0123456789_abcdefghij' });
    assert.equal(bad.status, 400);
    assert.ok(!bad.text.includes('cf_wrong_token'));
    const saved = await t.api('PUT', '/api/token', { token: TOKEN });
    assert.deepEqual(saved.json, { saved: true, zones: ['example.com'] });
    const status = await t.api('GET', '/api/token');
    assert.deepEqual(status.json, { saved: true });
    assert.ok(!status.text.includes(TOKEN));
    assert.deepEqual((await t.api('GET', '/api/zones')).json, [{ id: 'z1', name: 'example.com', status: 'active' }]);
    for (const f of await readdir(t.dir)) {
      if (f.endsWith('.json')) assert.ok(!(await readFile(path.join(t.dir, f), 'utf8')).includes(TOKEN), `${f} holds the token in plain text`);
    }
    assert.deepEqual((await t.api('DELETE', '/api/token')).json, { saved: false });
    assert.deepEqual((await t.api('GET', '/api/token')).json, { saved: false });
  } finally { await t.close(); }
});

test('path traversal is blocked and unknown routes 404', async () => {
  const t = await boot();
  try {
    for (const p of ['/..%2f..%2fpackage.json', '/%2e%2e/package.json', '/..%2fcore%2fservice.js', '/%00']) {
      const r = await t.api('GET', p);
      assert.ok([400, 404].includes(r.status), `${p} returned ${r.status}`);
      assert.ok(!r.text.includes('"name": "tunnel-doctor"'));
    }
    await t.api('POST', '/api/auth/setup', { password: PASSWORD });
    assert.equal((await t.api('GET', '/api/nope')).status, 404);
  } finally { await t.close(); }
});

test('request bodies over 64 KiB are rejected', async () => {
  const t = await boot();
  try {
    const r = await t.api('POST', '/api/auth/login', undefined, { raw: JSON.stringify({ password: 'x'.repeat(70 * 1024) }) });
    assert.equal(r.status, 413);
  } finally { await t.close(); }
});

test('sign-in is rate limited after five failures', async () => {
  const t = await boot();
  try {
    await t.api('POST', '/api/auth/setup', { password: PASSWORD });
    await t.api('POST', '/api/auth/logout');
    for (let i = 0; i < 5; i++) assert.equal((await t.api('POST', '/api/auth/login', { password: 'wrong password!' })).status, 401);
    assert.equal((await t.api('POST', '/api/auth/login', { password: PASSWORD })).status, 429);
  } finally { await t.close(); }
});
