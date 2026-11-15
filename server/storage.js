// File-backed storage for the hosted form. JSON files are written atomically;
// the Cloudflare API token is encrypted with AES-256-GCM.
import { promises as fs, readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto';
import path from 'node:path';

const NAME_RE = /^[a-z0-9-]+$/;

export function resolveSecretKey({ dataDir, secretKey, env = process.env, log = console.warn }) {
  if (secretKey) return String(secretKey);
  if (env.TD_SECRET_KEY) return env.TD_SECRET_KEY;
  if (env.TD_SECRET_KEY_FILE && existsSync(env.TD_SECRET_KEY_FILE)) return readFileSync(env.TD_SECRET_KEY_FILE, 'utf8').trim();
  const keyPath = path.join(dataDir, '.key');
  if (existsSync(keyPath)) return readFileSync(keyPath, 'utf8').trim();
  mkdirSync(dataDir, { recursive: true });
  const generated = randomBytes(32).toString('hex');
  writeFileSync(keyPath, generated, { mode: 0o600 });
  log('Tunnel Doctor: generated an encryption key inside the data volume. Set TD_SECRET_KEY or TD_SECRET_KEY_FILE so the key lives outside the volume.');
  return generated;
}

export function createFileStorage({ dataDir, secretKey }) {
  const key = scryptSync(secretKey, 'tunnel-doctor-secret-v1', 32);
  const file = (name) => {
    if (!NAME_RE.test(name)) throw new Error('Bad storage name.');
    return path.join(dataDir, `${name}.json`);
  };

  async function writeAtomic(target, text) {
    await fs.mkdir(dataDir, { recursive: true });
    const tmp = `${target}.${randomBytes(6).toString('hex')}.tmp`;
    await fs.writeFile(tmp, text, { mode: 0o600 });
    await fs.rename(tmp, target);
  }

  async function readJson(name, fallback) {
    try {
      return JSON.parse(await fs.readFile(file(name), 'utf8'));
    } catch (e) {
      if (e.code === 'ENOENT') return fallback;
      throw e;
    }
  }

  return {
    readJson,
    writeJson: (name, value) => writeAtomic(file(name), JSON.stringify(value, null, 2)),
    async readSecret() {
      const box = await readJson('secret', null);
      if (!box) return null;
      const d = createDecipheriv('aes-256-gcm', key, Buffer.from(box.iv, 'base64'));
      d.setAuthTag(Buffer.from(box.tag, 'base64'));
      return Buffer.concat([d.update(Buffer.from(box.data, 'base64')), d.final()]).toString('utf8');
    },
    async writeSecret(value) {
      const iv = randomBytes(12);
      const c = createCipheriv('aes-256-gcm', key, iv);
      const data = Buffer.concat([c.update(value, 'utf8'), c.final()]);
      await writeAtomic(file('secret'), JSON.stringify({ v: 1, iv: iv.toString('base64'), tag: c.getAuthTag().toString('base64'), data: data.toString('base64') }));
    },
    async clearSecret() {
      await fs.rm(file('secret'), { force: true });
    }
  };
}
