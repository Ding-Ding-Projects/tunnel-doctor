// Tunnel Doctor hosted form: HTTP server over the shared service.
// Node built-ins only, no npm dependencies.
import http from 'node:http';
import { promises as fs, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createService } from '../core/service.js';
import { CloudflareError } from '../core/cloudflare.js';
import { createFileStorage, resolveSecretKey } from './storage.js';
import { createAuth, COOKIE } from './auth.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const WEB_DIR = path.resolve(here, '..', 'web');
const BODY_LIMIT = 64 * 1024;
const PUBLIC_ROUTES = new Set(['GET /api/health', 'GET /api/auth/state', 'POST /api/auth/setup', 'POST /api/auth/login', 'POST /api/auth/logout']);
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json', '.txt': 'text/plain; charset=utf-8'
};

const version = JSON.parse(readFileSync(path.resolve(here, '..', 'package.json'), 'utf8')).version;

class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

function send(res, status, body, headers = {}) {
  const text = body === undefined ? '' : JSON.stringify(body);
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers });
  res.end(text);
}

async function readBody(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > BODY_LIMIT) throw new HttpError(413, 'Request body is too large.');
    chunks.push(chunk);
  }
  if (!size) return {};
  try {
    const value = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    return value && typeof value === 'object' ? value : {};
  } catch {
    throw new HttpError(400, 'Request body is not valid JSON.');
  }
}

function parseCookies(header = '') {
  const out = {};
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = part.slice(i + 1).trim();
  }
  return out;
}

async function serveStatic(req, res, pathname) {
  let rel;
  try {
    rel = pathname === '/' ? 'index.html' : decodeURIComponent(pathname).replace(/^\/+/, '');
  } catch {
    return send(res, 400, { error: 'Bad path.' });
  }
  if (rel.includes('\0')) return send(res, 400, { error: 'Bad path.' });
  const target = path.resolve(WEB_DIR, rel);
  if (target !== WEB_DIR && !target.startsWith(WEB_DIR + path.sep)) return send(res, 404, { error: 'Not found.' });
  try {
    const stat = await fs.stat(target);
    if (!stat.isFile()) return send(res, 404, { error: 'Not found.' });
    const body = await fs.readFile(target);
    res.writeHead(200, {
      'content-type': MIME[path.extname(target).toLowerCase()] || 'application/octet-stream',
      'cache-control': 'no-cache',
      'x-content-type-options': 'nosniff'
    });
    res.end(req.method === 'HEAD' ? undefined : body);
  } catch {
    send(res, 404, { error: 'Not found.' });
  }
}

export function createServer({ dataDir = process.env.TD_DATA_DIR || '/data', fetchImpl, secretKey, buildTime = process.env.TD_BUILD_TIME || null } = {}) {
  const storage = createFileStorage({ dataDir, secretKey: resolveSecretKey({ dataDir, secretKey }) });
  const service = createService({ storage, form: 'hosted', version, updatedAt: buildTime, fetchImpl });
  const auth = createAuth(storage);

  async function route(req, res, url) {
    const key = `${req.method} ${url.pathname}`;
    const ip = req.socket.remoteAddress || 'unknown';
    const sid = parseCookies(req.headers.cookie)[COOKIE];
    const secure = req.headers['x-forwarded-proto'] === 'https' || Boolean(req.socket.encrypted);
    const cookie = (value, maxAge) => `${COOKIE}=${value}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${maxAge}${secure ? '; Secure' : ''}`;

    if (req.method !== 'GET' && req.headers['x-tunnel-doctor'] !== '1') throw new HttpError(403, 'Missing x-tunnel-doctor header.');
    if (!PUBLIC_ROUTES.has(key) && !auth.valid(sid)) throw new HttpError(401, 'Sign in first.');

    switch (key) {
      case 'GET /api/health': return send(res, 200, { ok: true, version });
      case 'GET /api/auth/state': return send(res, 200, { configured: await auth.configured(), signedIn: auth.valid(sid) });
      case 'POST /api/auth/setup': {
        const { password } = await readBody(req);
        await auth.setup(password);
        const id = await auth.login(password, ip);
        return send(res, 200, { signedIn: true }, { 'set-cookie': cookie(id, 7 * 24 * 3600) });
      }
      case 'POST /api/auth/login': {
        const { password } = await readBody(req);
        const id = await auth.login(password, ip);
        return send(res, 200, { signedIn: true }, { 'set-cookie': cookie(id, 7 * 24 * 3600) });
      }
      case 'POST /api/auth/logout':
        auth.end(sid);
        return send(res, 200, { signedIn: false }, { 'set-cookie': cookie('', 0) });
      case 'GET /api/capabilities': return send(res, 200, service.capabilities());
      case 'GET /api/settings': return send(res, 200, await service.getSettings());
      case 'PATCH /api/settings': return send(res, 200, await service.updateSettings(await readBody(req)));
      case 'POST /api/settings/reset': {
        const { keys } = await readBody(req);
        if (keys !== undefined && (!Array.isArray(keys) || !keys.every((k) => typeof k === 'string'))) throw new HttpError(400, 'keys must be a list of strings.');
        return send(res, 200, await service.resetSettings(keys));
      }
      case 'GET /api/token': return send(res, 200, await service.tokenStatus());
      case 'PUT /api/token': return send(res, 200, await service.saveToken((await readBody(req)).token));
      case 'DELETE /api/token': return send(res, 200, await service.clearToken());
      case 'GET /api/zones': return send(res, 200, await service.zones());
      case 'POST /api/checks': return send(res, 200, await service.runChecks(await readBody(req)));
      case 'GET /api/checks/last': return send(res, 200, await service.lastReport());
      case 'POST /api/fixes/plan': {
        const { fixId, params } = await readBody(req);
        return send(res, 200, await service.planFix(fixId, params || {}));
      }
      case 'POST /api/fixes/apply': {
        const { fixId, params, confirmation } = await readBody(req);
        return send(res, 200, await service.applyFix(fixId, params || {}, confirmation || {}));
      }
      case 'POST /api/fixes/undo': return send(res, 200, await service.undo((await readBody(req)).historyId));
      case 'GET /api/history': return send(res, 200, await service.history());
      default:
        throw new HttpError(404, 'Unknown route.');
    }
  }

  return http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://localhost');
      if (!url.pathname.startsWith('/api/') && (req.method === 'GET' || req.method === 'HEAD')) return await serveStatic(req, res, url.pathname);
      await route(req, res, url);
    } catch (e) {
      if (res.headersSent) return res.end();
      if (e instanceof CloudflareError) return send(res, 502, { error: e.message });
      if (e.status) return send(res, e.status, { error: e.message });
      // Validation errors thrown by the shared service are plain Errors.
      send(res, 400, { error: e.message || 'Bad request.' });
    }
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const host = process.env.TD_HOST || '0.0.0.0';
  const port = Number(process.env.TD_PORT || 8080);
  createServer().listen(port, host, () => console.log(`Tunnel Doctor ${version} listening on http://${host}:${port}/`));
}
