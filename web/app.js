import { api, isDesktop } from './api.js';
import { both, resultText, checkName, fixName, setWordingOverrides } from './i18n.js';
import { TOKENS, FLAGS, compile, explain, testMatches, makeMatcher } from './regex.js';
import { parseWordingFile, loadSavedWording, saveWording, clearWording } from './wording.js';

const S = {
  caps: null, settings: null, auth: null,
  view: 'diagnose', settingsGroup: 'lang',
  tabs: [], activeTab: null, reports: {}, selected: {},
  history: [], tokenSaved: false, busy: false,
  search: { query: '', mode: 'plain', pattern: '', flags: 'i', sample: '', open: false },
  settingsSearch: { query: '', mode: 'plain', pattern: '', flags: 'i', sample: '', open: false },
  dialog: null, palette: null, ctx: null, toasts: [], wording: null
};
const root = document.getElementById('app');

// ---------- helpers ----------
const SVG_NS = 'http://www.w3.org/2000/svg';
function h(tag, attrs, ...kids) {
  const el = tag === 'svg' ? document.createElementNS(SVG_NS, 'svg') : document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === false || v == null) continue;
    if (k.startsWith('on')) el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'class') el.className = v;
    else if (k === 'html') el.innerHTML = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of kids.flat(Infinity)) if (kid != null && kid !== false) el.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
  return el;
}
const lang = () => S.settings?.language || 'both';
function bi(pair) {
  if (lang() === 'en') return pair.en;
  if (lang() === 'yue') return pair.yue;
  return h('span', {}, pair.en, h('span', { class: 'yue', lang: 'zh-HK' }, pair.yue));
}
const plain = (pair) => (lang() === 'yue' ? pair.yue : pair.en);
const L = (key, arg) => bi(both(key, S.settings || { funnyEn: 5, funnyYue: 5 }, arg));
const P = (key, arg) => plain(both(key, S.settings || { funnyEn: 5, funnyYue: 5 }, arg));
const icon = (d) => h('svg', { width: 22, height: 22, viewBox: '0 0 24 24', 'aria-hidden': 'true', html: `<path d="${d}" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>` });

function toast(text, kind = 'info') {
  const id = Math.random().toString(36).slice(2);
  S.toasts.push({ id, text, kind });
  renderToasts();
  if (S.settings?.sounds) playSound(kind);
  setTimeout(() => { S.toasts = S.toasts.filter((t) => t.id !== id); renderToasts(); }, kind === 'error' ? 9000 : 5000);
}
let audio;
function playSound(kind) {
  try {
    audio = audio || new AudioContext();
    const o = audio.createOscillator(); const g = audio.createGain();
    o.frequency.value = kind === 'error' ? 220 : 660; g.gain.value = 0.04;
    o.connect(g).connect(audio.destination); o.start();
    g.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + 0.18); o.stop(audio.currentTime + 0.2);
  } catch { /* audio is optional; the visible toast carries the result */ }
}

function applyTheme() {
  const s = S.settings;
  const dark = s.theme === 'dark' || (s.theme === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  document.documentElement.dataset.motion = s.reducedMotion === 'always' ? 'reduce' : '';
  document.documentElement.style.setProperty('--scale', String(s.textScale / 100));
  if (/^#[0-9a-f]{6}$/i.test(s.accent) && !dark) document.documentElement.style.setProperty('--primary', s.accent);
  else document.documentElement.style.removeProperty('--primary');
  document.documentElement.lang = s.language === 'yue' ? 'zh-HK' : 'en';
}

async function guarded(fn) {
  try { return await fn(); } catch (e) {
    if (e.status === 401) { S.auth = { configured: true, signedIn: false }; render(); return; }
    toast(e.message || String(e), 'error');
  }
}

// ---------- boot ----------
async function boot() {
  S.wording = loadSavedWording();
  if (S.wording) setWordingOverrides(S.wording.pairs);
  S.auth = await api.authState().catch(() => ({ configured: false, signedIn: false }));
  if (!S.auth.signedIn) { S.settings = { language: 'both', funnyEn: 5, funnyYue: 5 }; return render(); }
  await loadAll();
}
async function loadAll() {
  S.caps = await api.capabilities();
  S.settings = await api.getSettings();
  S.tokenSaved = (await api.tokenStatus()).saved;
  S.history = await api.history();
  S.tabs = S.settings.profiles.length ? S.settings.profiles : [];
  S.activeTab = S.tabs[0]?.id || null;
  const last = await api.lastReport();
  if (last && S.activeTab && S.tabs[0].hostname === last.hostname) S.reports[S.activeTab] = last;
  applyTheme();
  render();
}

// ---------- shell ----------
function render() {
  const keepFocus = document.activeElement?.id;
  const sel = document.activeElement && 'selectionStart' in document.activeElement ? [document.activeElement.selectionStart, document.activeElement.selectionEnd] : null;
  root.replaceChildren();
  if (!S.auth?.signedIn) root.append(authView());
  else if (!S.settings.onboardingDone) root.append(onboardingView());
  else root.append(shell());
  renderOverlays();
  if (keepFocus) {
    const el = document.getElementById(keepFocus);
    if (el) { el.focus(); if (sel && 'setSelectionRange' in el) try { el.setSelectionRange(...sel); } catch { /* not a text field */ } }
  }
}

function provenance() {
  const c = S.caps || {};
  const when = c.updatedAt ? new Date(c.updatedAt) : null;
  const fmt = when && !Number.isNaN(when.getTime())
    ? `${when.toLocaleString(undefined, { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })} (${Intl.DateTimeFormat().resolvedOptions().timeZone})`
    : P('unavailable');
  return h('div', { class: 'provenance', id: 'provenance' },
    h('span', {}, `${P('version')} ${c.version || P('unavailable')}`),
    h('span', {}, `${P('updated')} ${fmt}`));
}

function searchBox(state, id, labelKey, onChange) {
  const box = h('div', { class: 'search', role: 'search' },
    icon('M11 17.5a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13zM16 16l4 4'),
    h('label', { for: id, class: 'sr-only' }, P(labelKey)),
    h('input', { id, type: 'search', placeholder: P(labelKey), value: state.mode === 'regex' ? state.pattern : state.query,
      onInput: (e) => { if (state.mode === 'regex') state.pattern = e.target.value; else state.query = e.target.value; onChange(); } }),
    h('button', { class: 'regex-toggle', type: 'button', 'aria-pressed': String(state.open), 'aria-label': P('regexBuilder'), 'aria-controls': `${id}-rx`,
      onClick: () => { state.open = !state.open; render(); } }, '.*'));
  return h('div', { class: 'search-wrap' }, box, state.open ? regexBuilder(state, `${id}-rx`, onChange) : null);
}

function regexBuilder(state, id, onChange) {
  const c = compile(state.pattern, state.flags);
  const test = c.ok && state.sample ? testMatches(c.re, state.sample) : null;
  const ex = state.pattern ? explain(state.pattern) : [];
  const insert = (t) => { state.pattern += t.replace('…', ''); state.mode = 'regex'; onChange(); render(); };
  return h('section', { class: 'rx', id, 'aria-label': P('regexBuilder') },
    h('div', { class: 'row-wrap' },
      h('label', {}, h('input', { type: 'radio', name: `${id}-m`, checked: state.mode === 'plain', onChange: () => { state.mode = 'plain'; onChange(); render(); } }), ' Plain text'),
      h('label', {}, h('input', { type: 'radio', name: `${id}-m`, checked: state.mode === 'regex', onChange: () => { state.mode = 'regex'; onChange(); render(); } }), ' Regular expression'),
      ...FLAGS.map((f) => h('label', { title: f.en }, h('input', { type: 'checkbox', checked: state.flags.includes(f.flag), onChange: (e) => { state.flags = e.target.checked ? state.flags + f.flag : state.flags.replace(f.flag, ''); onChange(); render(); } }), ` ${f.flag} ${f.en}`))),
    h('div', { class: 'field' }, h('label', { for: `${id}-p` }, 'Pattern'),
      h('input', { id: `${id}-p`, class: 'mono', value: state.pattern, onInput: (e) => { state.pattern = e.target.value; state.mode = 'regex'; onChange(); render(); } })),
    c.error ? h('div', { class: 'err', role: 'alert' }, c.error) : null,
    h('div', { class: 'tokens', role: 'group', 'aria-label': 'Insert a token' }, TOKENS.map((t) => h('button', { type: 'button', title: lang() === 'yue' ? t.yue : t.en, onClick: () => insert(t.insert) }, t.insert))),
    ex.length ? h('ol', { style: 'margin:0;padding-left:20px;font-size:.8125rem' }, ex.map((e) => h('li', {}, h('code', {}, e.text), ' — ', lang() === 'yue' ? e.yue : e.en))) : null,
    h('div', { class: 'field' }, h('label', { for: `${id}-s` }, 'Test text'),
      h('textarea', { id: `${id}-s`, rows: 3, style: 'padding:8px;border-radius:8px;border:1px solid var(--outline)', onInput: (e) => { state.sample = e.target.value; render(); } }, state.sample)),
    test ? h('div', {}, h('div', { 'aria-live': 'polite' }, `${test.matches.length} match${test.matches.length === 1 ? '' : 'es'}${test.truncated ? ' (stopped early to stay responsive)' : ''}`),
      test.matches.length ? h('table', {}, h('tr', {}, h('th', {}, '#'), h('th', {}, 'At'), h('th', {}, 'Match'), h('th', {}, 'Groups')),
        test.matches.slice(0, 50).map((m, i) => h('tr', {}, h('td', {}, i + 1), h('td', {}, m.index), h('td', {}, h('mark', {}, m.text)), h('td', {}, m.groups.map((g) => g ?? '∅').join(' | '))))) : null) : null,
    h('p', { style: 'margin:0;font-size:.75rem;color:var(--on-surface-variant)' }, 'Uses the JavaScript regular expression engine built into this app.'));
}

function shell() {
  const nav = [
    ['diagnose', 'M4 12h4l2-6 4 12 2-6h4'],
    ['history', 'M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16zM12 8v4l3 2'],
    ['settings', 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM12 3v3M12 18v3M3 12h3M18 12h3'],
    ['docs', 'M6 4h9l3 3v13H6zM9 10h6M9 14h6']
  ];
  return h('div', { class: 'app' },
    h('a', { href: '#main', class: 'sr-only' }, 'Skip to content'),
    h('header', { class: 'topbar' },
      h('div', { class: 'brand' }, h('svg', { width: 28, height: 28, viewBox: '0 0 28 28', 'aria-hidden': 'true', html: '<rect x="2" y="2" width="24" height="24" rx="7" fill="var(--primary)"/><path d="M8 17c2-6 10-6 12 0" stroke="var(--on-primary)" stroke-width="2.4" fill="none" stroke-linecap="round"/><circle cx="14" cy="17" r="2" fill="var(--on-primary)"/>' }), P('appName')),
      searchBox(S.search, 'global-search', 'search', () => render()),
      provenance(),
      !isDesktop ? h('button', { class: 'btn text', onClick: () => guarded(async () => { await api.logout(); S.auth = { configured: true, signedIn: false }; render(); }) }, L('signOut')) : null),
    S.search.query || (S.search.mode === 'regex' && S.search.pattern) ? searchResults() : null,
    tabStrip(),
    h('div', { class: 'body' },
      h('nav', { class: 'rail', 'aria-label': 'Main' }, nav.map(([v, d]) => h('button', { 'aria-current': S.view === v ? 'page' : null, onClick: () => { S.view = v; render(); } }, h('span', { class: 'pill' }, icon(d)), P(v)))),
      h('main', { class: 'view', id: 'main', tabindex: '-1' }, S.view === 'diagnose' ? diagnoseView() : S.view === 'history' ? historyView() : S.view === 'settings' ? settingsView() : docsView())));
}

function searchIndex() {
  const items = [];
  for (const [id] of Object.entries(CHECK_DOCS)) items.push({ label: plain(checkName(id)), go: () => { S.view = 'docs'; S.docFocus = id; render(); } });
  for (const g of settingsGroups()) for (const row of g.rows) items.push({ label: `${plain(g.name)} › ${row.label}`, go: () => { S.view = 'settings'; S.settingsGroup = g.id; render(); setTimeout(() => flash(row.id), 0); } });
  items.push({ label: P('history'), go: () => { S.view = 'history'; render(); } });
  items.push({ label: P('run'), go: () => { S.view = 'diagnose'; render(); setTimeout(() => document.getElementById('run-btn')?.click(), 0); } });
  return items;
}
function searchResults() {
  const match = makeMatcher(S.search);
  const hits = searchIndex().filter((i) => match(i.label)).slice(0, 12);
  return h('div', { role: 'region', 'aria-label': 'Search results', 'aria-live': 'polite', style: 'padding:8px 20px;display:flex;flex-wrap:wrap;gap:8px;border-bottom:1px solid var(--divider)' },
    hits.length ? hits.map((i) => h('button', { class: 'btn outlined', onClick: () => { S.search.query = ''; S.search.pattern = ''; i.go(); } }, i.label)) : h('span', {}, 'No matches.'));
}
function flash(id) { const el = document.getElementById(id); if (!el) return; el.scrollIntoView({ block: 'center' }); el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash'); el.querySelector('input,select,button')?.focus(); }

// ---------- tabs ----------
function tabStrip() {
  return h('div', { class: 'tabs', role: 'tablist', 'aria-label': 'Hostnames' },
    S.tabs.map((t) => {
      const rep = S.reports[t.id];
      const tone = rep ? (rep.summary.fail ? 'fail' : rep.summary.warn ? 'warn' : 'pass') : '';
      return h('div', { style: 'display:flex' },
        h('button', { class: 'tab', role: 'tab', 'aria-selected': String(S.activeTab === t.id), onClick: () => { S.activeTab = t.id; S.view = 'diagnose'; render(); },
          onContextmenu: (e) => openCtx(e, [{ label: 'Close tab', run: () => closeTab(t.id) }, { label: 'Copy hostname', run: () => navigator.clipboard.writeText(t.hostname) }]) },
          h('span', { class: `dot ${tone}` }), t.label || t.hostname),
        h('button', { class: 'icon-btn', 'aria-label': `Close ${t.hostname}`, onClick: () => closeTab(t.id) }, '×'));
    }),
    h('button', { class: 'icon-btn', 'aria-label': P('newTab'), title: P('newTab'), onClick: () => { S.dialog = { kind: 'newtab', filter: '' }; renderOverlays(); } }, '+'));
}
async function persistTabs() { S.settings = await api.updateSettings({ profiles: S.tabs }); }
function closeTab(id) {
  S.tabs = S.tabs.filter((t) => t.id !== id); delete S.reports[id];
  if (S.activeTab === id) S.activeTab = S.tabs[0]?.id || null;
  guarded(persistTabs).then(render);
}
async function openHostnameTab(hostname, originUrl = '') {
  const existing = S.tabs.find((t) => t.hostname === hostname);
  if (existing) { existing.originUrl = originUrl || existing.originUrl; S.activeTab = existing.id; S.view = 'diagnose'; render(); return existing; }
  const t = { id: crypto.randomUUID(), label: hostname, hostname, originUrl };
  S.tabs.push(t); S.activeTab = t.id; S.view = 'diagnose';
  await guarded(persistTabs);
  render();
  return t;
}

// ---------- diagnose ----------
const CHECK_DOCS = { 'public-dns': 1, 'zone-record': 1, 'tunnel-health': 1, 'tunnel-route': 1, 'edge-http': 1, origin: 1, 'ha-proxy': 1, 'ssl-mode': 1, 'local-cache': 1, 'token-exposure': 1 };

function diagnoseView() {
  const tab = S.tabs.find((t) => t.id === S.activeTab);
  const rep = tab && S.reports[tab.id];
  const form = h('form', { class: 'form-row', onSubmit: (e) => { e.preventDefault(); runChecks(); } },
    // The fields below are read by runChecks() when it is called without arguments.
    h('div', { class: 'field' }, h('label', { for: 'host' }, P('hostname')), h('input', { id: 'host', class: 'mono', required: true, value: tab?.hostname || '', placeholder: 'ha.example.com', autocomplete: 'off' })),
    h('div', { class: 'field' }, h('label', { for: 'origin' }, P('origin')), h('input', { id: 'origin', class: 'mono', value: tab?.originUrl || '', placeholder: 'http://ha.local:8123' }), h('span', { class: 'help' }, P('originHelp'))),
    h('button', { id: 'run-btn', class: 'btn filled', type: 'submit', disabled: S.busy }, S.busy ? L('running') : L('run')));
  if (!rep) return [form, h('div', { class: 'banner info', role: 'status' }, L('noReport'))];
  const selId = S.selected[tab.id] || (rep.results.find((r) => r.status === 'fail') || rep.results[0]).id;
  const sel = rep.results.find((r) => r.id === selId);
  const { fail, warn } = rep.summary;
  return h('div', { class: 'cols' },
    h('section', { class: 'col-main' }, form,
      h('div', { class: `banner ${fail ? 'fail' : 'pass'}`, role: 'status' }, fail ? [L('problems', fail), ' ', warn ? L('warnings', warn) : ''] : L('allClear')),
      h('ul', { class: 'results', 'aria-label': 'Check results' }, rep.results.map((r) => h('li', {},
        h('button', { 'aria-pressed': String(r.id === selId), onClick: () => { S.selected[tab.id] = r.id; render(); },
          onContextmenu: (e) => openCtx(e, [{ label: 'Copy result', run: () => navigator.clipboard.writeText(`${plain(checkName(r.id))}: ${plain(resultText(r.code, r.params))}\n${r.evidence.join('\n')}`) }, r.fix ? { label: P('previewFix'), run: () => openFix(r.fix) } : null].filter(Boolean)) },
          h('span', { class: `badge ${r.status}` }, P(`status.${r.status}`)),
          h('span', { style: 'flex:1;min-width:0;display:flex;flex-direction:column;gap:2px' }, h('span', { class: 'r-title' }, bi(checkName(r.id))), h('span', { class: 'r-sub' }, bi(resultText(r.code, r.params)))),
          r.fix ? h('span', { class: 'chip' }, P('fixAvailable')) : null))))),
    h('aside', { class: 'col-side', 'aria-label': P('selected') },
      h('span', { style: 'font-size:.75rem;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:var(--on-surface-variant)' }, P('selected')),
      h('h2', { style: 'margin:0;font-size:1.375rem;font-weight:500' }, bi(checkName(sel.id))),
      h('p', { style: 'margin:0' }, bi(resultText(sel.code, sel.params))),
      sel.evidence.length ? h('div', { class: 'field' }, h('span', { style: 'font-size:.8125rem;font-weight:500;color:var(--on-surface-variant)' }, P('evidence')), h('pre', { class: 'evidence' }, sel.evidence.join('\n'))) : null,
      sel.code === 'ha.forwarded-rejected' ? h('pre', { class: 'evidence' }, 'http:\n  use_x_forwarded_for: true\n  trusted_proxies:\n    - <address of the tunnel connector or proxy>') : null,
      sel.fix ? h('div', { class: 'card' }, h('span', { style: 'font-size:.8125rem;font-weight:500;color:var(--on-surface-variant)' }, P('suggestedFix')), bi(fixName(sel.fix.id)),
        h('div', { class: 'row-wrap' }, h('button', { class: 'btn filled', onClick: () => openFix(sel.fix), disabled: sel.fix.id === 'flush-dns' && !S.caps.localDns }, L('previewFix')))) : null));
}

async function runChecks(hostArg, originArg) {
  const hostname = (hostArg ?? document.getElementById('host')?.value ?? '').trim().toLowerCase();
  const originUrl = (originArg ?? document.getElementById('origin')?.value ?? '').trim();
  if (!hostname) return;
  let tab = S.tabs.find((t) => t.id === S.activeTab);
  if (!tab || tab.hostname !== hostname) tab = await openHostnameTab(hostname, originUrl);
  tab.originUrl = originUrl;
  S.busy = true; render();
  await guarded(async () => {
    await persistTabs();
    S.reports[tab.id] = await api.runChecks({ hostname, originUrl: originUrl || undefined });
    S.selected[tab.id] = null;
    const sum = S.reports[tab.id].summary;
    if (S.settings.notifications) toast(sum.fail ? P('problems', sum.fail) : P('allClear'), sum.fail ? 'error' : 'info');
  });
  S.busy = false; render();
}

// ---------- fixes ----------
async function openFix(fix) {
  await guarded(async () => {
    const plan = await api.planFix(fix.id, fix.params);
    S.dialog = { kind: 'fix', fix, plan, ack: false, typed: '' };
    renderOverlays();
  });
}
function fixDialog(d) {
  const ready = d.ack && (!d.plan.confirmText || d.typed.trim().toLowerCase() === d.plan.confirmText.toLowerCase());
  return h('div', { class: 'dialog', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'fix-title' },
    h('h2', { id: 'fix-title' }, bi(fixName(d.fix.id))),
    h('p', { style: 'margin:0', class: 'mono' }, d.plan.request),
    h('div', { class: 'diff' }, h('span', { class: 'h' }, 'Field'), h('span', { class: 'h' }, 'Now'), h('span', { class: 'h' }, 'After'),
      d.plan.changes.map((c) => [h('span', {}, c.field), h('span', { class: 'before' }, c.before || '—'), h('span', { class: 'after' }, c.after)])),
    h('div', { class: 'card', style: 'background:var(--surface-container)' },
      h('strong', {}, L('confirmTitle')),
      h('label', { style: 'display:flex;gap:10px;align-items:center;min-height:44px' }, h('input', { type: 'checkbox', id: 'fix-ack', checked: d.ack, style: 'width:20px;height:20px', onChange: (e) => { d.ack = e.target.checked; renderOverlays(); } }), L('confirmAck')),
      d.plan.confirmText ? h('div', { class: 'field' }, h('label', { for: 'fix-typed' }, P('confirmType', d.plan.confirmText)),
        h('input', { id: 'fix-typed', class: 'mono', value: d.typed, autocomplete: 'off', onInput: (e) => { d.typed = e.target.value; const b = document.getElementById('fix-apply'); const ok = d.ack && d.typed.trim().toLowerCase() === d.plan.confirmText.toLowerCase(); b.disabled = !ok; } })) : null),
    h('div', { class: 'row-wrap', style: 'justify-content:flex-end' },
      h('button', { class: 'btn text', onClick: closeDialog }, L('cancel')),
      h('button', { id: 'fix-apply', class: 'btn filled', disabled: !ready, onClick: () => guarded(async () => {
        await api.applyFix(d.fix.id, d.fix.params, { acknowledged: d.ack, typed: d.typed });
        closeDialog(); toast(P('applied'));
        S.history = await api.history(); render();
      }) }, L('apply'))));
}
function closeDialog() { S.dialog = null; renderOverlays(); }

function newTabDialog(d) {
  const match = makeMatcher({ query: d.filter, mode: 'plain' });
  const entries = [
    { label: 'Check a hostname', sub: 'Open a new hostname tab', run: () => { closeDialog(); S.view = 'diagnose'; S.activeTab = null; render(); setTimeout(() => document.getElementById('host')?.focus(), 0); } },
    { label: P('history'), sub: 'Applied fixes and undo', run: () => { closeDialog(); S.view = 'history'; render(); } },
    ...settingsGroups().map((g) => ({ label: `${P('settings')} › ${plain(g.name)}`, sub: g.rows.map((r) => r.label).join(', '), run: () => { closeDialog(); S.view = 'settings'; S.settingsGroup = g.id; render(); } })),
    { label: P('docs'), sub: 'What every check means', run: () => { closeDialog(); S.view = 'docs'; render(); } },
    ...(d.zones || []).map((z) => ({ label: `Zone ${z.name}`, sub: 'Check a hostname in this zone', run: () => { closeDialog(); S.view = 'diagnose'; S.activeTab = null; render(); setTimeout(() => { const el = document.getElementById('host'); el.value = `.${z.name}`; el.focus(); el.setSelectionRange(0, 0); }, 0); } }))
  ].filter((e) => match(`${e.label} ${e.sub}`));
  if (!d.zonesLoaded) { d.zonesLoaded = true; if (S.tokenSaved) api.zones().then((z) => { d.zones = z; if (S.dialog === d) renderOverlays(); }).catch(() => {}); }
  return h('div', { class: 'dialog', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'nt-title' },
    h('h2', { id: 'nt-title' }, L('newTab')),
    h('div', { class: 'field' }, h('label', { for: 'nt-filter' }, 'Filter'), h('input', { id: 'nt-filter', value: d.filter, onInput: (e) => { d.filter = e.target.value; renderOverlays(); document.getElementById('nt-filter').focus(); } })),
    h('ul', { style: 'list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:6px' }, entries.map((e) => h('li', {}, h('button', { class: 'btn outlined', style: 'width:100%;justify-content:flex-start;flex-direction:column;align-items:flex-start;padding:10px 16px;min-height:56px;border-radius:12px', onClick: e.run }, h('strong', {}, e.label), h('span', { class: 'r-sub' }, e.sub))))),
    h('div', { class: 'row-wrap', style: 'justify-content:flex-end' }, h('button', { class: 'btn text', onClick: closeDialog }, L('cancel'))));
}

// ---------- history ----------
function historyView() {
  return [h('h1', { style: 'margin:0;font-size:1.5rem;font-weight:500' }, L('history')),
    S.history.length ? h('ul', { class: 'history-list' }, S.history.map((x) => h('li', {},
      h('div', { style: 'flex:1 1 260px;min-width:0' }, h('div', { class: 'r-title' }, `${x.kind === 'undo' ? `${P('undo')}: ` : ''}`, bi(fixName(x.fixId)), ` — ${x.target}`),
        h('div', { class: 'r-sub' }, `${new Date(x.at).toLocaleString()} · ${x.changes.map((c) => `${c.field}: ${c.before || '—'} → ${c.after}`).join('; ')}`)),
      x.canUndo ? h('button', { class: 'btn outlined', onClick: () => guarded(async () => { await api.undo(x.id); toast(P('undone')); S.history = await api.history(); render(); }) }, L('undo')) : null)))
      : h('div', { class: 'banner info' }, L('noHistory')),
    h('div', { class: 'row-wrap' },
      h('button', { class: 'btn outlined', onClick: () => download('tunnel-doctor-history.json', JSON.stringify(S.history, null, 2), 'application/json') }, 'Export JSON'),
      h('button', { class: 'btn outlined', onClick: () => download('tunnel-doctor-history.csv', toCsv(S.history), 'text/csv') }, 'Export CSV'),
      S.reports[S.activeTab] ? h('button', { class: 'btn outlined', onClick: () => download('tunnel-doctor-report.md', reportMarkdown(S.reports[S.activeTab]), 'text/markdown') }, 'Export current report (Markdown)') : null)];
}
function download(name, text, type) {
  const a = h('a', { href: URL.createObjectURL(new Blob([text], { type })), download: name });
  document.body.append(a); a.click(); a.remove();
}
const csvCell = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
function toCsv(list) {
  return ['at,kind,fix,target,changes', ...list.map((x) => [x.at, x.kind, x.fixId, x.target, x.changes.map((c) => `${c.field}:${c.before}->${c.after}`).join('; ')].map(csvCell).join(','))].join('\n');
}
function reportMarkdown(rep) {
  return [`# Tunnel Doctor report for ${rep.hostname}`, '', `Run at ${rep.at}`, '', '| Check | Status | Result |', '| --- | --- | --- |',
    ...rep.results.map((r) => `| ${checkName(r.id).en} | ${r.status} | ${resultText(r.code, r.params).en.replace(/\|/g, '\\|')} |`)].join('\n');
}

// ---------- settings ----------
function settingsGroups() {
  const s = S.settings || {};
  return [
    { id: 'lang', name: { en: 'Language and voice', yue: '語言同語氣' }, rows: [
      { id: 'set-language', label: 'Language', help: 'English, Cantonese, or both side by side.', control: () => select('language', [['en', 'English'], ['yue', '廣東話'], ['both', 'Both / 兩樣都要']]) },
      { id: 'set-funnyEn', label: 'English funny level', help: '1 is fully serious, 5 is most playful. Results and errors stay plain at every level.', control: () => range('funnyEn', 1, 5) },
      { id: 'set-funnyYue', label: 'Cantonese funny level', help: 'Set separately from English.', control: () => range('funnyYue', 1, 5) },
      { id: 'set-wording', label: 'Personal wording file', help: 'Load a local JSON file to rename words in the interface, or drop it anywhere on the window. It never leaves this device. Clear it to restore the original wording.', control: wordingControl }] },
    { id: 'look', name: { en: 'Appearance', yue: '外觀' }, rows: [
      { id: 'set-theme', label: 'Theme', help: 'Light, dark, or follow the system.', control: () => select('theme', [['system', 'System'], ['light', 'Light'], ['dark', 'Dark']]) },
      { id: 'set-accent', label: 'Accent colour', help: 'Used in light theme. Dark theme keeps a contrast-checked accent.', control: () => h('input', { type: 'color', id: 'accent', 'aria-label': 'Accent colour', value: s.accent, onChange: (e) => save({ accent: e.target.value }) }) },
      { id: 'set-textScale', label: 'Text size', help: '100% to 200%. The layout reflows instead of clipping.', control: () => range('textScale', 100, 200, 10, '%') },
      { id: 'set-reducedMotion', label: 'Reduced motion', help: 'Follow the system, or always reduce.', control: () => select('reducedMotion', [['system', 'Follow system'], ['always', 'Always reduce']]) }] },
    { id: 'acct', name: { en: 'Cloudflare account', yue: 'Cloudflare 帳戶' }, rows: [
      { id: 'set-token', label: 'API token', help: isDesktop ? 'Stored encrypted with Windows data protection for your user account. Needs Zone · DNS · Edit and Account · Cloudflare Tunnel · Edit (Read is enough for checks only).' : 'Stored encrypted on the server. It is never sent back to the browser.', control: tokenControl }] },
    { id: 'checks', name: { en: 'Checks', yue: '檢查' }, rows: [
      { id: 'set-originTimeoutMs', label: 'Origin timeout', help: 'How long to wait for each network request.', control: () => range('originTimeoutMs', 1000, 30000, 1000, ' ms') }] },
    { id: 'sound', name: { en: 'Sound and notifications', yue: '聲音同通知' }, rows: [
      { id: 'set-sounds', label: 'Action sounds', help: 'A short tone when checks finish or a fix is applied.', control: () => toggle('sounds') },
      { id: 'set-notifications', label: 'Notifications', help: 'Non-blocking messages in the corner of the window.', control: () => toggle('notifications') }] },
    { id: 'data', name: { en: 'History and data', yue: '歷史同資料' }, rows: [
      { id: 'set-historyLimit', label: 'History size', help: 'How many applied fixes to keep.', control: () => range('historyLimit', 10, 2000, 10) },
      { id: 'set-onboarding', label: 'Setup wizard', help: 'Run the first-run setup again.', control: () => h('button', { class: 'btn outlined', onClick: () => save({ onboardingDone: false, onboardingStep: 1 }) }, 'Run setup again') },
      { id: 'set-resetall', label: P('resetAll'), help: 'Returns every setting to its default. Hostname tabs and the token are kept.', control: () => h('button', { class: 'btn outlined', onClick: () => guarded(async () => { S.settings = await api.resetSettings(); applyTheme(); render(); }) }, L('resetAll')) }] },
    { id: 'about', name: { en: 'About', yue: '關於' }, rows: [
      { id: 'set-version', label: 'Version', help: 'Read from the build that is running.', control: () => h('span', { class: 'mono' }, S.caps?.version || P('unavailable')) },
      { id: 'set-form', label: 'Edition', help: S.caps?.localDns ? 'Desktop app: every check is available.' : 'Hosted edition: checks of the local DNS cache and process list are only in the desktop app, because here they would describe the server, not your computer.', control: () => h('span', {}, S.caps?.form) }] }
  ];
}
async function save(patch) { await guarded(async () => { S.settings = await api.updateSettings(patch); applyTheme(); render(); }); }
const resetBtn = (key) => h('button', { class: 'btn text', 'aria-label': `${P('reset')} ${key}`, onClick: () => guarded(async () => { S.settings = await api.resetSettings([key]); applyTheme(); render(); }) }, L('reset'));
function select(key, opts) { return [h('select', { id: `in-${key}`, 'aria-label': key, onChange: (e) => save({ [key]: e.target.value }) }, opts.map(([v, l]) => h('option', { value: v, selected: S.settings[key] === v }, l))), resetBtn(key)]; }
function range(key, min, max, step = 1, unit = '') { return [h('input', { type: 'range', id: `in-${key}`, 'aria-label': key, min, max, step, value: S.settings[key], onChange: (e) => save({ [key]: Number(e.target.value) }) }), h('output', { for: `in-${key}`, class: 'mono' }, `${S.settings[key]}${unit}`), resetBtn(key)]; }
function toggle(key) { return [h('input', { type: 'checkbox', id: `in-${key}`, role: 'switch', 'aria-label': key, checked: S.settings[key], style: 'width:22px;height:22px', onChange: (e) => save({ [key]: e.target.checked }) }), resetBtn(key)]; }
function tokenControl() {
  return h('form', { class: 'row-wrap', onSubmit: (e) => { e.preventDefault(); const v = e.target.querySelector('input').value; guarded(async () => { const r = await api.saveToken(v); S.tokenSaved = true; toast(`Token works. Zones: ${r.zones.join(', ') || 'none'}`); render(); }); } },
    h('input', { type: 'password', autocomplete: 'off', 'aria-label': 'API token', placeholder: S.tokenSaved ? 'Saved. Paste to replace.' : 'Paste API token' }),
    h('button', { class: 'btn filled', type: 'submit' }, S.tokenSaved ? 'Replace' : 'Save'),
    S.tokenSaved ? h('button', { class: 'btn text', type: 'button', onClick: () => guarded(async () => { await api.clearToken(); S.tokenSaved = false; render(); }) }, 'Remove') : null);
}
function wordingControl() {
  const state = S.wording ? `Loaded: ${S.wording.count} replacements` : 'No file loaded';
  return [h('span', { 'aria-live': 'polite' }, state),
    h('label', { class: 'btn outlined', style: 'cursor:pointer' }, S.wording ? 'Replace file' : 'Choose file', h('input', { type: 'file', accept: '.json,application/json', class: 'sr-only', onChange: (e) => e.target.files[0] && importWording(e.target.files[0]) })),
    S.wording ? h('button', { class: 'btn text', onClick: () => { clearWording(); S.wording = null; setWordingOverrides(null); render(); } }, 'Clear') : null];
}
function settingsView() {
  const match = makeMatcher(S.settingsSearch);
  const groups = settingsGroups();
  const filtering = S.settingsSearch.query || (S.settingsSearch.mode === 'regex' && S.settingsSearch.pattern);
  const shown = filtering ? groups.flatMap((g) => g.rows.filter((r) => match(`${r.label} ${r.help}`))) : groups.find((g) => g.id === S.settingsGroup).rows;
  return [h('h1', { style: 'margin:0;font-size:1.5rem;font-weight:500' }, L('settings')),
    searchBox(S.settingsSearch, 'settings-search', 'search', () => render()),
    h('div', { class: 'settings-layout' },
      h('nav', { class: 'settings-nav', 'aria-label': 'Settings groups' }, groups.map((g) => h('button', { 'aria-current': String(!filtering && S.settingsGroup === g.id), onClick: () => { S.settingsGroup = g.id; S.settingsSearch.query = ''; S.settingsSearch.pattern = ''; render(); } }, bi(g.name)))),
      h('div', { class: 'settings-main' }, shown.length ? shown.map((r) => h('div', { class: 'setting', id: r.id },
        h('div', { class: 'txt' }, h('div', { class: 'r-title' }, r.label), h('div', { class: 'r-sub' }, r.help)),
        h('div', { class: 'control' }, r.control()))) : h('div', { class: 'banner info' }, 'No settings match.')))];
}

// ---------- docs ----------
function docsView() {
  const docs = {
    'public-dns': 'Queries 1.1.1.1 and 8.8.8.8 over HTTPS. A tunnel CNAME with the proxy switched off resolves to a private fd10:: address, so browsers cannot connect. Resolvers that disagree usually mean a change is still spreading; wait for the record’s TTL.',
    'zone-record': 'Looks up the record that answers for the hostname in your zone. A missing record, a wildcard-only answer, or an unproxied tunnel CNAME are reported, with a fix.',
    'tunnel-health': 'Reads the tunnel status. Healthy means at least one connector is connected. Down or inactive means the cloudflared connector is not running.',
    'tunnel-route': 'Finds the public hostname rule in a remotely managed tunnel. Locally managed tunnels keep routes in a config file that the API cannot read.',
    'edge-http': 'Requests the hostname through the edge. Error 1033 means no connector; 502 and 530 mean the connector cannot reach the origin.',
    origin: 'Requests the origin directly. Refused means nothing is listening, unreachable means the machine or network is down, timeout means a firewall or an overloaded service.',
    'ha-proxy': 'Sends a request with X-Forwarded-For. Home Assistant answers 400 unless http.use_x_forwarded_for is true and trusted_proxies lists the proxy’s address.',
    'ssl-mode': 'Flexible SSL with an HTTPS origin can loop; Off leaves the zone without HTTPS.',
    'local-cache': 'Compares this computer’s resolver with public DNS. A stale cache is cleared with ipconfig /flushdns. Desktop app only.',
    'token-exposure': 'Looks for cloudflared started with --token, which shows the token to every local user in the process list. Prefer a credentials file or the TUNNEL_TOKEN environment variable. Desktop app only.'
  };
  const focus = S.docFocus; S.docFocus = null;
  if (focus) setTimeout(() => flash(`doc-${focus}`), 0);
  return [h('h1', { style: 'margin:0;font-size:1.5rem;font-weight:500' }, L('docs')),
    ...Object.entries(docs).map(([id, text]) => h('section', { class: 'card', id: `doc-${id}` }, h('h2', { style: 'margin:0;font-size:1.125rem' }, bi(checkName(id))), h('p', { style: 'margin:0' }, text)))];
}

// ---------- onboarding ----------
const STEPS = [
  { en: 'Language and voice', yue: '語言同語氣' },
  { en: 'Connect your Cloudflare account', yue: '連接 Cloudflare 帳戶' },
  { en: 'Choose a hostname', yue: '揀主機名' },
  { en: 'Add the origin service', yue: '加源站服務' },
  { en: 'Run the first check', yue: '做第一次檢查' }
];
function onboardingView() {
  const at = S.settings.onboardingStep;
  const go = (n) => save({ onboardingStep: Math.max(1, Math.min(5, n)) });
  S.ob = S.ob || { hostname: S.tabs[0]?.hostname || '', originUrl: '' };
  const body = [
    () => [h('p', {}, 'Choose the language for the interface and how playful its wording is. Results and errors always stay plain.'), ...settingsGroups()[0].rows.slice(0, 3).map((r) => h('div', { class: 'setting', id: r.id }, h('div', { class: 'txt' }, h('div', { class: 'r-title' }, r.label), h('div', { class: 'r-sub' }, r.help)), h('div', { class: 'control' }, r.control())))],
    () => [h('p', {}, 'Paste a Cloudflare API token so the app can read your zones and tunnels and apply fixes you confirm. You can skip this; DNS, edge and origin checks still work.'), h('div', { class: 'setting', id: 'set-token' }, h('div', { class: 'control' }, tokenControl())), S.tokenSaved ? h('div', { class: 'banner pass', role: 'status' }, 'Token saved and verified.') : null],
    () => [h('div', { class: 'field' }, h('label', { for: 'ob-host' }, P('hostname')), h('input', { id: 'ob-host', class: 'mono', value: S.ob.hostname, placeholder: 'ha.example.com', onInput: (e) => { S.ob.hostname = e.target.value.trim(); } }))],
    () => [h('div', { class: 'field' }, h('label', { for: 'ob-origin' }, P('origin')), h('input', { id: 'ob-origin', class: 'mono', value: S.ob.originUrl, placeholder: 'http://homeassistant.local:8123', onInput: (e) => { S.ob.originUrl = e.target.value.trim(); } }), h('span', { class: 'help' }, P('originHelp')))],
    () => [h('p', {}, S.ob.hostname ? `Ready to check ${S.ob.hostname}.` : 'No hostname chosen. You can still finish and add one later.')]
  ][at - 1]();
  const finish = () => guarded(async () => {
    S.settings = await api.updateSettings({ onboardingDone: true });
    if (S.ob.hostname) { await openHostnameTab(S.ob.hostname, S.ob.originUrl); await runChecks(S.ob.hostname, S.ob.originUrl); } else render();
  });
  return h('div', { class: 'wizard' },
    h('nav', { 'aria-label': 'Setup steps' }, h('h1', { style: 'margin:0 0 20px;font-size:1.375rem' }, 'Set up Tunnel Doctor'),
      STEPS.map((s, i) => h('button', { class: i + 1 < at ? 'done' : '', 'aria-current': i + 1 === at ? 'step' : null, onClick: () => go(i + 1) }, h('span', { class: 'step-dot' }, i + 1 < at ? '✓' : i + 1), bi(s)))),
    h('main', {}, h('span', { class: 'r-sub' }, `Step ${at} of 5`), h('h2', { style: 'margin:0;font-size:1.75rem;font-weight:500' }, bi(STEPS[at - 1])), body,
      h('div', { class: 'actions' },
        h('button', { class: 'btn outlined', disabled: at === 1, onClick: () => go(at - 1) }, L('back')),
        at < 5 ? h('button', { class: 'btn filled', onClick: () => go(at + 1) }, L('next')) : h('button', { class: 'btn filled', onClick: finish }, L('finish')),
        at < 5 ? h('button', { class: 'btn text', onClick: () => go(at + 1) }, L('skip')) : null,
        h('span', { style: 'flex:1' }),
        h('button', { class: 'btn text', onClick: finish }, L('finishLater')))));
}

// ---------- auth (hosted forms) ----------
function authView() {
  const setup = !S.auth.configured;
  return h('div', { class: 'auth' }, h('form', { onSubmit: (e) => { e.preventDefault(); const pw = e.target.querySelector('input').value; guarded(async () => { S.auth = setup ? await api.setup(pw) : await api.login(pw); S.auth.configured = true; await loadAll(); }); } },
    h('h1', { style: 'margin:0;font-size:1.5rem' }, 'Tunnel Doctor'),
    h('p', { style: 'margin:0' }, setup ? 'Create the password that protects this instance. Use at least 10 characters.' : 'Sign in to continue.'),
    h('div', { class: 'field' }, h('label', { for: 'pw' }, setup ? 'New password' : 'Password'), h('input', { id: 'pw', type: 'password', required: true, minlength: setup ? 10 : 1, autocomplete: setup ? 'new-password' : 'current-password' })),
    h('button', { class: 'btn filled', type: 'submit' }, setup ? 'Create password' : 'Sign in')));
}

// ---------- overlays: dialogs, palette, context menu, toasts ----------
let overlayHost;
function renderOverlays() {
  overlayHost = overlayHost || document.getElementById('overlays');
  overlayHost.replaceChildren();
  const prev = document.activeElement?.id;
  if (S.dialog) overlayHost.append(h('div', { class: 'scrim', onClick: (e) => { if (e.target === e.currentTarget) closeDialog(); } }, S.dialog.kind === 'fix' ? fixDialog(S.dialog) : newTabDialog(S.dialog)));
  if (S.palette) overlayHost.append(paletteView());
  if (S.ctx) overlayHost.append(ctxView());
  const el = prev && document.getElementById(prev);
  if (el && overlayHost.contains(el)) el.focus();
  else if (S.dialog || S.palette) overlayHost.querySelector('input, button')?.focus();
}
function renderToasts() {
  const host = document.getElementById('toasts');
  host.replaceChildren(...S.toasts.map((t) => h('div', { class: `toast ${t.kind === 'error' ? 'error' : ''}`, role: t.kind === 'error' ? 'alert' : 'status' }, h('span', { style: 'flex:1' }, t.text), h('button', { class: 'icon-btn', 'aria-label': 'Dismiss', onClick: () => { S.toasts = S.toasts.filter((x) => x.id !== t.id); renderToasts(); } }, '×'))));
}

function paletteView() {
  const p = S.palette;
  const match = makeMatcher({ query: p.query, mode: 'plain' });
  const items = searchIndex().filter((i) => match(i.label));
  p.index = Math.min(p.index, Math.max(0, items.length - 1));
  const run = (i) => { S.palette = null; renderOverlays(); i.go(); };
  return h('div', { class: 'scrim', onClick: (e) => { if (e.target === e.currentTarget) { S.palette = null; renderOverlays(); } } },
    h('div', { class: 'palette', role: 'dialog', 'aria-label': 'Command palette' },
      h('input', { id: 'palette-input', 'aria-label': 'Type a command or setting', placeholder: 'Type a command or setting', value: p.query, 'aria-controls': 'palette-list',
        onInput: (e) => { p.query = e.target.value; p.index = 0; renderOverlays(); },
        onKeydown: (e) => {
          if (e.key === 'ArrowDown') { p.index++; renderOverlays(); e.preventDefault(); }
          if (e.key === 'ArrowUp') { p.index = Math.max(0, p.index - 1); renderOverlays(); e.preventDefault(); }
          if (e.key === 'Enter' && items[p.index]) run(items[p.index]);
        } }),
      h('ul', { id: 'palette-list', role: 'listbox' }, items.map((i, n) => h('li', {}, h('button', { role: 'option', 'aria-selected': String(n === p.index), onClick: () => run(i) }, i.label))))));
}

function openCtx(e, actions) {
  e.preventDefault();
  const text = window.getSelection().toString() || e.currentTarget.innerText;
  S.ctx = { x: e.clientX, y: e.clientY, filter: '', actions: [...actions, { label: 'Copy text', key: 'Ctrl+C', run: () => navigator.clipboard.writeText(text) }, { label: 'Open command palette', key: 'Ctrl+Shift+F', run: () => { S.palette = { query: '', index: 0 }; renderOverlays(); } }] };
  renderOverlays();
}
function ctxView() {
  const c = S.ctx;
  const match = makeMatcher({ query: c.filter, mode: 'plain' });
  const close = () => { S.ctx = null; renderOverlays(); };
  const menu = h('div', { class: 'ctxmenu', role: 'menu', style: `left:${Math.min(c.x, innerWidth - 330)}px;top:${Math.min(c.y, innerHeight - 260)}px`, onKeydown: (e) => { if (e.key === 'Escape') close(); } },
    h('input', { id: 'ctx-filter', 'aria-label': 'Filter menu', placeholder: 'Filter', value: c.filter, onInput: (e) => { c.filter = e.target.value; renderOverlays(); } }),
    c.actions.filter((a) => match(a.label)).map((a) => h('button', { role: 'menuitem', onClick: () => { close(); a.run(); } }, h('span', {}, a.label), a.key ? h('kbd', {}, a.key) : null)));
  setTimeout(() => document.addEventListener('click', function off(ev) { if (!menu.contains(ev.target)) { close(); } document.removeEventListener('click', off); }), 0);
  return menu;
}

// ---------- personal wording ----------
async function importWording(file) {
  try {
    const parsed = parseWordingFile(await file.text(), file.size);
    saveWording(parsed);
    S.wording = parsed;
    setWordingOverrides(parsed.pairs);
    if (S.settings?.sounds) playSound('info');
    celebrate(parsed.headline || P('wordingApplied'));
    render();
  } catch {
    if (S.settings?.sounds) playSound('error');
    toast(P('wordingInvalid'), 'error');
  }
}
function celebrate(text) {
  const live = document.getElementById('live');
  live.textContent = text;
  const el = h('div', { class: 'celebrate', 'aria-hidden': 'true' }, h('span', {}, text));
  document.body.append(el);
  setTimeout(() => el.remove(), 3700);
}
let dragDepth = 0;
window.addEventListener('dragenter', (e) => { if ([...(e.dataTransfer?.types || [])].includes('Files')) { dragDepth++; document.getElementById('drop-hint').hidden = false; } });
window.addEventListener('dragleave', () => { dragDepth = Math.max(0, dragDepth - 1); if (!dragDepth) document.getElementById('drop-hint').hidden = true; });
window.addEventListener('dragover', (e) => e.preventDefault());
window.addEventListener('drop', (e) => {
  e.preventDefault(); dragDepth = 0; document.getElementById('drop-hint').hidden = true;
  const f = e.dataTransfer?.files?.[0];
  if (f) importWording(f);
});

// ---------- keyboard ----------
window.addEventListener('keydown', (e) => {
  if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'f') { e.preventDefault(); S.palette = { query: '', index: 0 }; renderOverlays(); }
  else if (e.key === 'Escape') { if (S.ctx) S.ctx = null; else if (S.palette) S.palette = null; else if (S.dialog) S.dialog = null; renderOverlays(); }
});
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => S.settings && applyTheme());

boot().catch((e) => { root.textContent = `Tunnel Doctor could not start: ${e.message}`; });
