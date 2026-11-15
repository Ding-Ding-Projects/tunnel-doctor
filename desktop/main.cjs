// Desktop shell. Loads the shared interface from web/ over a private app://
// scheme and serves the shared service over IPC. Only this form gets the
// platform hooks that read this computer's DNS cache and process list.

const { app, BrowserWindow, ipcMain, protocol, net, safeStorage, shell, Menu } = require('electron');
const path = require('node:path');
const fs = require('node:fs/promises');
const { pathToFileURL } = require('node:url');
const { execFile } = require('node:child_process');
const dns = require('node:dns').promises;

protocol.registerSchemesAsPrivileged([{ scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true } }]);

const WEB_ROOT = path.join(__dirname, '..', 'web');
let service;

function run(file, args) {
  return new Promise((resolve, reject) => execFile(file, args, { windowsHide: true, timeout: 20000, maxBuffer: 8 * 1024 * 1024 }, (err, stdout) => (err ? reject(err) : resolve(stdout))));
}

const platform = {
  systemLookup: async (host) => (await dns.lookup(host, { all: true, family: 4 })).map((x) => x.address),
  listProcesses: async () => {
    if (process.platform !== 'win32') return [];
    const out = await run('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command',
      "Get-CimInstance Win32_Process -Filter \"Name LIKE '%cloudflared%'\" | Select-Object ProcessId,Name,CommandLine | ConvertTo-Json -Compress"]);
    if (!out.trim()) return [];
    const list = [].concat(JSON.parse(out));
    return list.map((p) => ({ pid: p.ProcessId, name: p.Name, command: p.CommandLine || '' }));
  },
  flushDns: async () => {
    if (process.platform !== 'win32') throw new Error('Flushing the DNS cache is implemented for Windows only.');
    await run('ipconfig.exe', ['/flushdns']);
  }
};

function storage(dir) {
  const file = (n) => path.join(dir, `${n}.json`);
  const secretFile = path.join(dir, 'token.bin');
  async function writeAtomic(target, data) {
    const tmp = `${target}.${process.pid}.tmp`;
    await fs.writeFile(tmp, data);
    await fs.rename(tmp, target);
  }
  return {
    async readJson(n, fallback) { try { return JSON.parse(await fs.readFile(file(n), 'utf8')); } catch { return fallback; } },
    async writeJson(n, v) { await fs.mkdir(dir, { recursive: true }); await writeAtomic(file(n), JSON.stringify(v, null, 2)); },
    async readSecret() {
      try { return safeStorage.decryptString(await fs.readFile(secretFile)); } catch { return null; }
    },
    async writeSecret(v) {
      if (!safeStorage.isEncryptionAvailable()) throw new Error('Windows data protection is not available, so the token cannot be stored safely.');
      await fs.mkdir(dir, { recursive: true });
      await writeAtomic(secretFile, safeStorage.encryptString(v));
    },
    async clearSecret() { await fs.rm(secretFile, { force: true }); }
  };
}

async function buildMeta() {
  try { return JSON.parse(await fs.readFile(path.join(WEB_ROOT, 'build-meta.json'), 'utf8')); } catch { return { version: app.getVersion(), updatedAt: null }; }
}

async function createWindow() {
  const win = new BrowserWindow({
    width: 1280, height: 860, minWidth: 360, minHeight: 520,
    title: 'Tunnel Doctor',
    backgroundColor: '#f8f9ff',
    webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, sandbox: true, nodeIntegration: false }
  });
  win.webContents.setWindowOpenHandler(({ url }) => { if (/^https:\/\//.test(url)) shell.openExternal(url); return { action: 'deny' }; });
  win.webContents.on('will-navigate', (e, url) => { if (!url.startsWith('app://tunnel-doctor/')) e.preventDefault(); });
  await win.loadURL('app://tunnel-doctor/index.html');
}

app.whenReady().then(async () => {
  Menu.setApplicationMenu(null);
  protocol.handle('app', (req) => {
    const rel = decodeURIComponent(new URL(req.url).pathname).replace(/^\/+/, '') || 'index.html';
    const target = path.normalize(path.join(WEB_ROOT, rel));
    if (!target.startsWith(WEB_ROOT + path.sep)) return new Response('Not found', { status: 404 });
    return net.fetch(pathToFileURL(target).toString());
  });

  const { createService } = await import(pathToFileURL(path.join(__dirname, '..', 'core', 'service.js')).toString());
  const meta = await buildMeta();
  service = createService({ storage: storage(path.join(app.getPath('userData'), 'data')), platform, form: 'desktop', version: meta.version, updatedAt: meta.updatedAt });

  const allowed = new Set(['capabilities', 'getSettings', 'updateSettings', 'resetSettings', 'tokenStatus', 'saveToken', 'clearToken', 'zones', 'runChecks', 'lastReport', 'planFix', 'applyFix', 'undo', 'history']);
  ipcMain.handle('td:call', async (event, method, args) => {
    if (!event.senderFrame || !event.senderFrame.url.startsWith('app://tunnel-doctor/')) throw new Error('Refused: unknown sender.');
    if (!allowed.has(method)) throw new Error(`Unknown method: ${method}`);
    try {
      return { ok: true, value: await service[method](...(Array.isArray(args) ? args : [])) };
    } catch (err) {
      return { ok: false, error: String(err?.message || err) };
    }
  });

  await createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
