// Password and session handling for the hosted form.
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

const SESSION_MS = 7 * 24 * 3600 * 1000;
const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILURES = 5;
export const COOKIE = 'td_session';

export function hashPassword(password) {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, 64);
  return { salt: salt.toString('base64'), hash: hash.toString('base64') };
}

export function verifyPassword(password, record) {
  if (!record) return false;
  const expected = Buffer.from(record.hash, 'base64');
  const actual = scryptSync(password, Buffer.from(record.salt, 'base64'), expected.length);
  return timingSafeEqual(expected, actual);
}

export function createAuth(storage, now = () => Date.now()) {
  const sessions = new Map();
  const failures = new Map();

  const record = () => storage.readJson('auth', null);

  return {
    async configured() { return Boolean(await record()); },
    async setup(password) {
      if (await record()) throw Object.assign(new Error('A password is already set.'), { status: 409 });
      if (typeof password !== 'string' || password.length < 10 || password.length > 256) {
        throw Object.assign(new Error('Use a password of at least 10 characters.'), { status: 400 });
      }
      await storage.writeJson('auth', hashPassword(password));
    },
    limited(ip) {
      const list = (failures.get(ip) || []).filter((t) => now() - t < WINDOW_MS);
      failures.set(ip, list);
      return list.length >= MAX_FAILURES;
    },
    async login(password, ip) {
      if (this.limited(ip)) throw Object.assign(new Error('Too many attempts. Try again in a few minutes.'), { status: 429 });
      const ok = typeof password === 'string' && verifyPassword(password, await record());
      if (!ok) {
        failures.get(ip).push(now());
        throw Object.assign(new Error('Wrong password.'), { status: 401 });
      }
      failures.delete(ip);
      return this.createSession();
    },
    createSession() {
      const id = randomBytes(32).toString('hex');
      sessions.set(id, now() + SESSION_MS);
      return id;
    },
    valid(id) {
      const exp = id && sessions.get(id);
      if (!exp) return false;
      if (exp < now()) { sessions.delete(id); return false; }
      return true;
    },
    end(id) { sessions.delete(id); }
  };
}
