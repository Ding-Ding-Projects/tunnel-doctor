import { CATEGORIES, ARTICLES, SETTINGS_ENTRIES, UI, REGEX_TOKENS } from './content.js';

/* ------------------------------------------------------------------ storage */
const store = {
  mem: {},
  get(k) { try { const v = localStorage.getItem(k); return v === null ? (this.mem[k] ?? null) : v; } catch { return this.mem[k] ?? null; } },
  set(k, v) { this.mem[k] = v; try { localStorage.setItem(k, v); } catch { /* storage unavailable: keep in memory */ } },
  del(k) { delete this.mem[k]; try { localStorage.removeItem(k); } catch { /* ignore */ } }
};
const readJson = (k, d) => { try { return { ...d, ...(JSON.parse(store.get(k) || '{}')) }; } catch { return { ...d }; } };

const DEFAULTS = { theme: 'system', accent: null, textSize: 100, motion: 'system', lang: (navigator.language || '').toLowerCase().startsWith('zh') ? 'zh' : 'en', funEn: 5, funZh: 5, emoji: true };
let settings = readJson('td-settings', DEFAULTS);
const SEARCH_DEFAULT = { mode: 'text', q: '', flags: 'i', sample: '' };
let search = readJson('td-search', SEARCH_DEFAULT);
const saveSettings = () => store.set('td-settings', JSON.stringify(settings));
const saveSearch = () => store.set('td-search', JSON.stringify(search));

/* ----------------------------------------------------------------- helpers */
const $ = (s, r = document) => r.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const tone = (lvl) => (lvl <= 2 ? 's' : lvl === 3 ? 'f' : 'p');
const level = (lc) => (lc === 'zh' ? settings.funZh : settings.funEn);
const langs = () => (settings.lang === 'both' ? ['en', 'zh'] : [settings.lang]);
const LANGATTR = { en: 'en', zh: 'yue-Hant-HK' };
const pick = (v, lc) => (v && typeof v === 'object' && 's' in v ? v[tone(level(lc))] : v);
const ui = (key, lc) => pick(UI[lc][key], lc);
// Interface string for the current language mode. Both-mode shows both, separated by a middle dot.
const u = (key) => {
  const ls = langs();
  return ls.map((lc) => `<span lang="${LANGATTR[lc]}">${esc(ui(key, lc))}</span>`).join('<span aria-hidden="true"> · </span>');
};
const uPlain = (key) => langs().map((lc) => ui(key, lc)).join(' · ');
const em = (e) => (settings.emoji && e ? `<span aria-hidden="true">${e}</span> ` : '');
const bi = (render) => {
  const ls = langs();
  if (ls.length === 1) return `<div lang="${LANGATTR[ls[0]]}">${render(ls[0])}</div>`;
  return `<div class="bilingual"><div lang="en">${render('en')}</div><div class="col-zh" lang="yue-Hant-HK">${render('zh')}</div></div>`;
};
const STATUS = { en: { pass: 'Pass', warn: 'Warning', fail: 'Fail', error: 'Error', skip: 'Skipped', info: 'Route' }, zh: { pass: '通過', warn: '警告', fail: '失敗', error: '錯誤', skip: '跳過', info: '路由' } };
const byId = (id) => ARTICLES.find((a) => a.id === id);
const cat = (id) => CATEGORIES.find((c) => c.id === id);
const lt = (obj) => langs().map((lc) => obj[lc]).join(' · ');
const live = (msg) => { const l = $('#live'); if (l) l.textContent = msg; };

/* ------------------------------------------------------------ colour maths */
const hexToRgb = (h) => { const m = /^#?([0-9a-f]{6})$/i.exec(h || ''); if (!m) return null; const n = parseInt(m[1], 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const rgbToHex = (r) => '#' + r.map((x) => Math.round(Math.max(0, Math.min(255, x))).toString(16).padStart(2, '0')).join('');
const lum = (rgb) => { const f = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(rgb[0]) + 0.7152 * f(rgb[1]) + 0.0722 * f(rgb[2]); };
const ratio = (a, b) => { const la = lum(a), lb = lum(b); return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05); };
function rgbToHsl([r, g, b]) { r /= 255; g /= 255; b /= 255; const mx = Math.max(r, g, b), mn = Math.min(r, g, b); let h = 0, s = 0; const l = (mx + mn) / 2; if (mx !== mn) { const d = mx - mn; s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn); h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h /= 6; } return [h, s, l]; }
function hslToRgb([h, s, l]) { if (s === 0) return [l * 255, l * 255, l * 255]; const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q; const f = (t) => { t = (t + 1) % 1; if (t < 1 / 6) return p + (q - p) * 6 * t; if (t < 1 / 2) return q; if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6; return p; }; return [f(h + 1 / 3) * 255, f(h) * 255, f(h - 1 / 3) * 255]; }
const isDark = () => settings.theme === 'dark' || (settings.theme === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
const PAGE_BG = { light: [248, 249, 255], dark: [17, 20, 24] };

function accentInfo() {
  const a = hexToRgb(settings.accent); if (!a) return null;
  const white = [255, 255, 255], dark = [25, 28, 32];
  const onPrimary = ratio(a, white) >= ratio(a, dark) ? white : dark;
  const bg = isDark() ? PAGE_BG.dark : PAGE_BG.light;
  let link = a, hsl = rgbToHsl(a), steps = 0;
  while (ratio(link, bg) < 4.5 && steps < 60) { hsl = [hsl[0], hsl[1], Math.max(0, Math.min(1, hsl[2] + (isDark() ? 0.02 : -0.02)))]; link = hslToRgb(hsl); steps++; }
  return { a, onPrimary, link, buttonRatio: ratio(a, onPrimary), linkRatio: ratio(a, bg), linkFixedRatio: ratio(link, bg) };
}

function applySettings() {
  const d = document.documentElement;
  if (settings.theme === 'light' || settings.theme === 'dark') d.setAttribute('data-theme', settings.theme); else d.removeAttribute('data-theme');
  if (settings.motion === 'reduce' || settings.motion === 'allow') d.setAttribute('data-motion', settings.motion); else d.removeAttribute('data-motion');
  d.style.fontSize = Math.min(200, Math.max(100, Number(settings.textSize) || 100)) + '%';
  d.lang = settings.lang === 'zh' ? 'yue-Hant-HK' : 'en';
  const info = accentInfo();
  for (const v of ['--primary', '--on-primary', '--link']) d.style.removeProperty(v);
  if (info) {
    d.style.setProperty('--primary', rgbToHex(info.a));
    d.style.setProperty('--on-primary', rgbToHex(info.onPrimary));
    d.style.setProperty('--link', rgbToHex(info.link));
  }
}
matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', () => { applySettings(); if (route.name === 'settings') renderSettingsContrast(); });

/* --------------------------------------------------------------- the search */
// Matching runs in a worker so a pathological pattern can be stopped.
function matchJob(job) {
  let re;
  try { re = new RegExp(job.pattern, job.flags.replace(/g/g, '') + 'g'); } catch (e) { return { error: String(e.message) }; }
  const out = [];
  for (const d of job.docs) {
    const text = d.text; re.lastIndex = 0;
    const ms = []; let count = 0, m;
    while ((m = re.exec(text)) !== null) {
      count++;
      ms.push({ i: m.index, l: m[0].length, g: m.slice(1).map((x) => (x === undefined ? null : x.slice(0, 200))), ng: m.groups ? Object.fromEntries(Object.entries(m.groups).map(([k, v]) => [k, v === undefined ? null : v.slice(0, 200)])) : null });
      if (m[0].length === 0) re.lastIndex++;
      if (count >= job.per) break;
    }
    if (count) out.push({ k: d.k, count, ms });
  }
  return { out };
}
let worker = null;
function getWorker() {
  if (worker) return worker;
  try {
    const src = `const matchJob = ${matchJob.toString()}; onmessage = (e) => postMessage({ id: e.data.id, res: matchJob(e.data) });`;
    worker = new Worker(URL.createObjectURL(new Blob([src], { type: 'text/javascript' })));
  } catch { worker = false; }
  return worker;
}
let jobSeq = 0;
function runMatch(job, timeoutMs = 1500) {
  const w = getWorker();
  if (!w) return Promise.resolve(matchJob(job)); // no worker support: run in place (caps still apply)
  return new Promise((resolve) => {
    const id = ++jobSeq;
    const done = (r) => { clearTimeout(t); w.removeEventListener('message', onMsg); resolve(r); };
    const onMsg = (e) => { if (e.data.id === id) done(e.data.res); };
    const t = setTimeout(() => { w.terminate(); worker = null; w.removeEventListener('message', onMsg); resolve({ timeout: true }); }, timeoutMs);
    w.addEventListener('message', onMsg);
    w.postMessage({ ...job, id });
  });
}
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const MAX_TEXT = 20000;

function blockText(b) {
  if (b.t === 'cmd') return b.text;
  if (b.t === 'res') return b.rows.map((r) => r.join(' ')).join('\n');
  return [b.en, b.zh].flat().join('\n');
}
const INDEX = ARTICLES.map((a) => {
  const parts = [a.id, a.title.en, a.title.zh, a.lead.en.s, a.lead.zh.s];
  for (const s of a.sections) parts.push(s.h.en, s.h.zh, ...s.blocks.map(blockText));
  return { id: a.id, text: parts.join('\n').slice(0, MAX_TEXT) };
});

const flagsFor = () => (search.mode === 'regex' ? search.flags : 'i');
const patternFor = () => (search.mode === 'regex' ? search.q : escapeRe(search.q));
function validate() {
  if (search.mode !== 'regex' || !search.q) return { ok: true };
  try { new RegExp(search.q, search.flags); return { ok: true }; } catch (e) { return { ok: false, error: String(e.message) }; }
}

/* ----------------------------------------------------- pattern explanation */
function explainPattern(p) {
  const out = []; let i = 0, lit = '';
  const flush = () => { if (lit) { out.push({ tok: lit, en: `Literal text "${lit}".`, zh: `字面文字「${lit}」。` }); lit = ''; } };
  const push = (tok, en, zh) => { flush(); out.push({ tok, en, zh }); };
  const ESC = { d: ['any digit', '任何數字'], D: ['any character that is not a digit', '任何非數字字元'], w: ['any word character', '任何字詞字元'], W: ['any character that is not a word character', '任何非字詞字元'], s: ['any whitespace character', '任何空白字元'], S: ['any non-whitespace character', '任何非空白字元'], b: ['a word boundary', '字詞邊界'], B: ['a position that is not a word boundary', '非字詞邊界嘅位置'], n: ['a line feed', '換行符'], r: ['a carriage return', '歸位符'], t: ['a tab', '制表符'] };
  while (i < p.length && out.length < 200) {
    const c = p[i];
    if (c === '\\') {
      const n = p[i + 1];
      if (n === undefined) { push('\\', 'A backslash with nothing after it, which is invalid.', '反斜線後面冇嘢，係無效嘅。'); i++; continue; }
      if (ESC[n]) { push('\\' + n, `Matches ${ESC[n][0]}.`, `吻合${ESC[n][1]}。`); i += 2; }
      else if (/[1-9]/.test(n)) { push('\\' + n, `Back-reference to group ${n}.`, `指回第 ${n} 個群組。`); i += 2; }
      else if (n === 'k') { const m = /^\\k<[^>]*>/.exec(p.slice(i)); const t = m ? m[0] : '\\k'; push(t, 'Back-reference to a named group.', '指回一個具名群組。'); i += t.length; }
      else if (n === 'p' || n === 'P') { const m = /^\\[pP]\{[^}]*\}/.exec(p.slice(i)); const t = m ? m[0] : '\\' + n; push(t, 'A Unicode property class (needs the u flag).', 'Unicode 屬性類別（需要 u 旗標）。'); i += t.length; }
      else if (n === 'u' || n === 'x') { const m = (n === 'u' ? /^\\u(\{[0-9a-fA-F]+\}|[0-9a-fA-F]{4})/ : /^\\x[0-9a-fA-F]{2}/).exec(p.slice(i)); const t = m ? m[0] : '\\' + n; push(t, 'A character given by its code.', '用編碼指定嘅字元。'); i += t.length; }
      else { push('\\' + n, `The literal character "${n}".`, `字面字元「${n}」。`); i += 2; }
    } else if (c === '[') {
      let j = i + 1; if (p[j] === '^') j++; if (p[j] === ']') j++;
      while (j < p.length && p[j] !== ']') { if (p[j] === '\\') j++; j++; }
      const t = p.slice(i, Math.min(j + 1, p.length)); const neg = t[1] === '^';
      push(t, neg ? 'Any one character that is not in this set.' : 'Any one character in this set or range.', neg ? '唔喺呢個集合入面嘅任何一個字元。' : '呢個集合或範圍入面嘅任何一個字元。'); i += t.length;
    } else if (c === '(') {
      const rest = p.slice(i);
      const m = /^\(\?(?:<=|<!|=|!|:|<([A-Za-z_$][\w$]*)>)/.exec(rest);
      if (!m) push('(', 'Start of a capturing group.', '擷取群組開始。');
      else if (m[0] === '(?:') push('(?:', 'Start of a group that does not capture.', '唔擷取嘅群組開始。');
      else if (m[0] === '(?=') push('(?=', 'Lookahead: what follows must match, without consuming it.', '前瞻：後面必須吻合，但唔計入吻合內容。');
      else if (m[0] === '(?!') push('(?!', 'Negative lookahead: what follows must not match.', '否定前瞻：後面唔可以吻合。');
      else if (m[0] === '(?<=') push('(?<=', 'Lookbehind: what precedes must match.', '後行斷言：前面必須吻合。');
      else if (m[0] === '(?<!') push('(?<!', 'Negative lookbehind: what precedes must not match.', '否定後行斷言：前面唔可以吻合。');
      else push(m[0], `Start of a capturing group named "${m[1]}".`, `具名擷取群組「${m[1]}」開始。`);
      i += m ? m[0].length : 1;
    } else if (c === ')') { push(')', 'End of a group.', '群組結束。'); i++; }
    else if (c === '|') { push('|', 'Alternation: match what is on the left or on the right.', '或者：吻合左邊或者右邊。'); i++; }
    else if (c === '^') { push('^', 'Start of the text, or of a line with the m flag.', '文字開頭；開咗 m 旗標就係每行開頭。'); i++; }
    else if (c === '$') { push('$', 'End of the text, or of a line with the m flag.', '文字結尾；開咗 m 旗標就係每行結尾。'); i++; }
    else if (c === '.') { push('.', 'Any character except a line break (with the s flag, including line breaks).', '除換行外任何字元（開咗 s 旗標就包括換行）。'); i++; }
    else if (c === '*' || c === '+' || c === '?') {
      const lazy = p[i + 1] === '?' && c !== '?' ? '?' : '';
      const t = c + lazy;
      const base = { '*': ['Zero or more of the previous item', '前一項出現零次或者多次'], '+': ['One or more of the previous item', '前一項出現一次或者多次'], '?': ['Zero or one of the previous item', '前一項出現零次或者一次'] }[c];
      push(t, base[0] + (lazy ? ', as few as possible (lazy).' : '.'), base[1] + (lazy ? '，盡量少（非貪婪）。' : '。')); i += t.length;
    } else if (c === '{') {
      const m = /^\{(\d+)(,(\d*))?\}\??/.exec(p.slice(i));
      if (m) {
        const lazy = m[0].endsWith('?'); const lo = m[1], hi = m[2] === undefined ? lo : m[3];
        const en = hi === '' ? `${lo} or more of the previous item` : lo === hi ? `Exactly ${lo} of the previous item` : `Between ${lo} and ${hi} of the previous item`;
        const zh = hi === '' ? `前一項出現 ${lo} 次或以上` : lo === hi ? `前一項剛好出現 ${lo} 次` : `前一項出現 ${lo} 至 ${hi} 次`;
        push(m[0], en + (lazy ? ', as few as possible (lazy).' : '.'), zh + (lazy ? '，盡量少（非貪婪）。' : '。')); i += m[0].length;
      } else { lit += c; i++; }
    } else { lit += c; i++; }
  }
  flush();
  return out;
}

/* ---------------------------------------------------------------- the page */
const main = $('#main');
let route = { name: 'home' };
let pendingFlash = null;
let pendingSection = null;

const parseRoute = () => {
  const h = location.hash.replace(/^#/, '') || '/';
  const parts = h.split('/').filter(Boolean);
  if (!parts.length) return { name: 'home' };
  if (parts[0] === 'home') return { name: 'home', section: parts[1] };
  if (parts[0] === 'docs') return parts[1] ? { name: 'category', id: parts[1] } : { name: 'docs' };
  if (parts[0] === 'a' && byId(parts[1])) return { name: 'article', id: parts[1], section: parts[2] };
  if (parts[0] === 'search') return { name: 'search' };
  if (parts[0] === 'settings') return { name: 'settings' };
  return { name: 'notfound' };
};

function renderChrome() {
  const nav = $('#site-nav');
  const cur = route.name;
  const items = [['#/home/features', 'navFeatures', cur === 'home'], ['#/docs', 'navDocs', ['docs', 'category', 'article'].includes(cur)], ['#/home/download', 'navDownload', false], ['#/settings', 'navSettings', cur === 'settings']];
  nav.innerHTML = items.map(([href, k, c]) => `<a href="${href}"${c ? ' aria-current="page"' : ''}>${u(k)}</a>`).join('');
  nav.querySelectorAll('a').forEach((a) => a.addEventListener('click', () => { nav.classList.remove('open'); $('#menu-btn').setAttribute('aria-expanded', 'false'); }));
  $('#menu-btn').innerHTML = u('menu');
  $('#q-label').textContent = uPlain('searchLabel');
  $('#q').placeholder = uPlain('searchPh');
  const mb = $('#mode-btn');
  mb.textContent = search.mode === 'regex' ? uPlain('modeRegex') : uPlain('modeText');
  mb.setAttribute('aria-pressed', String(search.mode === 'regex'));
  mb.setAttribute('aria-label', uPlain('mode') + ': ' + (search.mode === 'regex' ? uPlain('modeRegex') : uPlain('modeText')));
  $('#palette-btn').setAttribute('aria-label', uPlain('paletteOpen'));
  const ls = $('#lang-sel'); ls.value = settings.lang; ls.setAttribute('aria-label', uPlain('language'));
  const q = $('#q'); if (document.activeElement !== q) q.value = search.q;
  q.classList.toggle('regex', search.mode === 'regex');
  const v = validate(); q.classList.toggle('bad', !v.ok); q.setAttribute('aria-invalid', String(!v.ok));
  $('#footer').innerHTML = u('footer');
  renderMeta();
}
let buildMeta = undefined;
function renderMeta() {
  const el = $('#meta');
  const parts = (lc) => {
    const ver = buildMeta && buildMeta.version ? buildMeta.version : UI[lc].unavailable;
    let when = UI[lc].unavailable;
    try { if (buildMeta && buildMeta.updated) when = new Date(buildMeta.updated).toLocaleString(lc === 'zh' ? 'zh-HK' : 'en-GB', { dateStyle: 'medium', timeStyle: 'short' }); } catch { /* keep unavailable */ }
    return `${UI[lc].version} ${ver} · ${UI[lc].updated} ${when}`;
  };
  el.textContent = buildMeta === undefined ? '' : langs().map(parts).join('  |  ');
}
fetch('build-meta.json', { cache: 'no-cache' }).then((r) => (r.ok ? r.json() : null)).catch(() => null).then((m) => { buildMeta = m; renderMeta(); });

function pageHome() {
  const checks = ARTICLES.filter((a) => a.cat === 'checks');
  const fixes = ARTICLES.filter((a) => a.cat === 'fixes');
  const runs = ARTICLES.filter((a) => a.cat === 'run');
  const lead = (a, lc) => esc(pick(a.lead[lc], lc));
  const card = (a) => `<article class="card"><h3>${em(a.icon)}${langs().map((lc) => `<span lang="${LANGATTR[lc]}">${esc(a.title[lc])}</span>`).join('<span aria-hidden="true"> · </span>')}</h3>${langs().map((lc) => `<p lang="${LANGATTR[lc]}">${lead(a, lc)}</p>`).join('')}<a class="go" href="#/a/${a.id}">${u('readArticle')}<span class="sr-only">: ${esc(a.title.en)}</span></a></article>`;
  const illus = `<figure class="illus"><div class="head">${u('illusTitle')}</div><div class="body"><span class="mono">ha.example.com CNAME tunnel<br>AAAA fd10:aec2:5dae:: (private)</span><span>${u('illusFix')}</span><span class="fakebtn" aria-hidden="true">${uPlain('illusBtn')}</span></div><figcaption>${u('illustration')}</figcaption></figure>`;
  return `
  <div class="wrap hero">
    <div>
      <h1>${langs().map((lc) => `<span lang="${LANGATTR[lc]}" style="display:block">${esc(pick(UI[lc].heroTitle, lc))}</span>`).join('')}</h1>
      ${langs().map((lc) => `<p class="lead" lang="${LANGATTR[lc]}">${esc(pick(UI[lc].heroText, lc))}</p>`).join('')}
      <div class="actions"><a class="btn filled" href="#/home/download">${u('ctaDownload')}</a><a class="btn outlined" href="#/docs">${u('ctaDocs')}</a></div>
      <p class="small-note">${u('notApp')}</p>
    </div>
    ${illus}
  </div>
  <section class="band" id="features" aria-labelledby="h-features"><div class="wrap"><h2 id="h-features">${u('featuresTitle')}</h2><div class="cards">${checks.map(card).join('')}</div></div></section>
  <section class="section wrap" id="fixes" aria-labelledby="h-fixes"><h2 id="h-fixes">${u('fixesTitle')}</h2><div class="cards">${fixes.map(card).join('')}</div></section>
  <section class="band" id="run" aria-labelledby="h-run"><div class="wrap"><h2 id="h-run">${u('runTitle')}</h2><div class="cards">${runs.map(card).join('')}</div></div></section>
  <section class="section wrap" id="download" aria-labelledby="h-dl"><div class="download"><div><h2 id="h-dl">${u('downloadTitle')}</h2>${langs().map((lc) => `<p lang="${LANGATTR[lc]}">${esc(ui('downloadText', lc))}</p><p lang="${LANGATTR[lc]}">${esc(ui('downloadNone', lc))}</p>`).join('')}</div><a class="btn filled" href="https://github.com/Ding-Ding-Projects/tunnel-doctor/releases/latest" rel="noopener">${u('downloadBtn')}</a></div></section>`;
}

function renderBlock(b, lc) {
  if (b.t === 'p') return `<p>${esc(b[lc])}</p>`;
  if (b.t === 'ul') return `<ul>${b[lc].map((x) => `<li>${esc(x)}</li>`).join('')}</ul>`;
  if (b.t === 'ol') return `<ol>${b[lc].map((x) => `<li>${esc(x)}</li>`).join('')}</ol>`;
  if (b.t === 'cmd') return `<pre tabindex="0"><code>${esc(b.text)}</code></pre>`;
  if (b.t === 'res') {
    const allInfo = b.rows.every((r) => r[1] === 'info');
    const head = allInfo ? `<tr><th scope="col">${lc === 'en' ? 'Route' : '路由'}</th><th scope="col">${esc(UI[lc].meaning)}</th></tr>` : `<tr><th scope="col">${esc(UI[lc].resultCode)}</th><th scope="col">${esc(UI[lc].status)}</th><th scope="col">${esc(UI[lc].meaning)}</th></tr>`;
    const rows = b.rows.map((r) => allInfo ? `<tr><td class="code">${esc(r[0])}</td><td>${esc(lc === 'en' ? r[2] : r[3])}</td></tr>` : `<tr><td class="code">${esc(r[0])}</td><td><span class="badge ${r[1]}">${esc(STATUS[lc][r[1]])}</span></td><td>${esc(lc === 'en' ? r[2] : r[3])}</td></tr>`).join('');
    return `<div class="tblwrap"><table class="tbl"><thead>${head}</thead><tbody>${rows}</tbody></table></div>`;
  }
  return '';
}

function pageArticle(a) {
  const c = cat(a.cat);
  const sections = a.sections.map((s) => `<section class="art-section" id="sec-${s.id}" aria-labelledby="h-${s.id}-${langs()[0]}">${bi((lc) => `<h2 id="h-${s.id}-${lc}">${esc(s.h[lc])}</h2>${s.blocks.map((b) => renderBlock(b, lc)).join('')}`)}</section>`).join('');
  const related = a.related.map((id) => byId(id)).filter(Boolean).map((r) => `<li><a href="#/a/${r.id}">${em(r.icon)}<span>${langs().map((lc) => esc(r.title[lc])).join(' · ')}</span></a></li>`).join('');
  return `<article class="wrap article" aria-labelledby="art-title-${langs()[0]}">
    <nav class="crumbs" aria-label="Breadcrumb"><a href="#/docs">${u('docsTitle')}</a> › <a href="#/docs/${c.id}">${langs().map((lc) => esc(c.title[lc])).join(' · ')}</a></nav>
    <div class="page-head">${bi((lc) => `<h1 id="art-title-${lc}">${em(a.icon)}${esc(a.title[lc])}</h1><p class="lead-text">${esc(pick(a.lead[lc], lc))}</p>`)}</div>
    ${sections}
    <aside class="related" aria-labelledby="rel-h"><h2 id="rel-h" style="font-size:1.2rem">${u('related')}</h2><ul>${related}</ul></aside>
  </article>`;
}

function pageDocs() {
  return `<div class="wrap article"><div class="page-head"><h1>${u('docsTitle')}</h1>${langs().map((lc) => `<p class="lead-text" lang="${LANGATTR[lc]}">${esc(ui('docsIntro', lc))}</p>`).join('')}</div>
  ${CATEGORIES.map((c) => `<section class="art-section" aria-labelledby="c-${c.id}"><h2 id="c-${c.id}"><a href="#/docs/${c.id}">${em(c.icon)}${langs().map((lc) => esc(c.title[lc])).join(' · ')}</a></h2>${langs().map((lc) => `<p lang="${LANGATTR[lc]}">${esc(c.desc[lc])}</p>`).join('')}${articleList(ARTICLES.filter((a) => a.cat === c.id))}</section>`).join('')}</div>`;
}
function articleList(list) {
  return `<ul class="list">${list.map((a) => `<li><a class="row" href="#/a/${a.id}"><span class="icon" aria-hidden="true">${settings.emoji ? a.icon : ''}</span><span><span class="t">${langs().map((lc) => esc(a.title[lc])).join(' · ')}</span><br>${langs().map((lc) => `<span class="d" lang="${LANGATTR[lc]}">${esc(pick(a.lead[lc], lc))}</span>`).join('<br>')}</span></a></li>`).join('')}</ul>`;
}
function pageCategory(c) {
  return `<div class="wrap article"><nav class="crumbs" aria-label="Breadcrumb"><a href="#/docs">${u('docsTitle')}</a></nav><div class="page-head"><h1>${em(c.icon)}${langs().map((lc) => `<span lang="${LANGATTR[lc]}" style="display:block">${esc(c.title[lc])}</span>`).join('')}</h1>${langs().map((lc) => `<p class="lead-text" lang="${LANGATTR[lc]}">${esc(c.desc[lc])}</p>`).join('')}</div>${articleList(ARTICLES.filter((a) => a.cat === c.id))}</div>`;
}

/* ------------------------------------------------------------- search page */
function pageSearch() {
  const flagDefs = [['i', 'flagI'], ['m', 'flagM'], ['s', 'flagS'], ['u', 'flagU']];
  const regex = search.mode === 'regex';
  return `<div class="wrap article"><div class="page-head"><h1>${u('searchTitle')}</h1></div>
  <section class="builder" aria-labelledby="bld-h">
    <h2 id="bld-h">${u('modeRegex')}</h2>
    <div class="row" role="group" aria-label="${esc(uPlain('mode'))}">
      <button class="btn tonal" type="button" id="b-text" aria-pressed="${!regex}">${u('modeText')}</button>
      <button class="btn tonal" type="button" id="b-regex" aria-pressed="${regex}">${u('modeRegex')}</button>
    </div>
    <div class="row"><label for="pat" style="font-weight:600">${u('pattern')}</label><input class="patt" type="text" id="pat" autocomplete="off" spellcheck="false" value="${esc(search.q)}" aria-describedby="pat-err"></div>
    <p class="err" id="pat-err" role="alert"></p>
    <div class="checks" role="group" aria-label="${esc(uPlain('flags'))}">${flagDefs.map(([f, k]) => `<label><input type="checkbox" data-flag="${f}"${search.flags.includes(f) ? ' checked' : ''}${regex ? '' : ' disabled'}> <code>${f}</code> ${u(k)}</label>`).join('')}</div>
    <div><h3 style="margin-bottom:8px">${u('tokens')}</h3><div class="tokens">${REGEX_TOKENS.map((t, n) => `<button type="button" data-tok="${n}" title="${esc(langs().map((lc) => t[lc]).join(' / '))}" aria-label="${esc(t.ins + ': ' + langs().map((lc) => t[lc]).join(' / '))}">${esc(t.ins)}</button>`).join('')}</div></div>
    <div><h3 style="margin-bottom:8px">${u('explain')}</h3><ul class="explain" id="explain"></ul></div>
    <div><label for="sample" style="font-weight:600">${u('testText')}</label><textarea id="sample" spellcheck="false" style="margin-top:6px">${esc(search.sample || UI.en.sample)}</textarea></div>
    <div><h3 style="margin-bottom:8px">${u('matches')}</h3><div class="sample-out" id="sample-out" tabindex="0"></div><div class="tblwrap" id="groups"></div></div>
    <p class="hint">${u('engineNote')}</p><p class="hint">${u('limits')}</p>
  </section>
  <section aria-labelledby="res-h"><h2 id="res-h" style="font-size:1.35rem;margin-bottom:12px">${u('results')}</h2><p class="hint" id="res-count"></p><div id="results"></div></section></div>`;
}

let refreshTimer = 0, refreshSeq = 0;
function scheduleRefresh() { clearTimeout(refreshTimer); refreshTimer = setTimeout(refreshSearch, 120); }
async function refreshSearch() {
  if (route.name !== 'search') return;
  const seq = ++refreshSeq;
  const v = validate();
  const err = $('#pat-err'); err.textContent = v.ok ? '' : `${uPlain('invalid')}: ${v.error}`;
  const pat = $('#pat'); pat.classList.toggle('bad', !v.ok); pat.setAttribute('aria-invalid', String(!v.ok));
  $('#q').classList.toggle('bad', !v.ok);
  // explanation
  const ex = $('#explain');
  if (!search.q) ex.innerHTML = `<li>${u('emptyPattern')}</li>`;
  else if (search.mode === 'text') ex.innerHTML = `<li><code>${esc(search.q.slice(0, 80))}</code><span>${langs().map((lc) => lc === 'en' ? `Plain text, matched without regard to case.` : `純文字，唔分大細楷。`).join(' / ')}</span></li>`;
  else ex.innerHTML = explainPattern(search.q.slice(0, 500)).map((t) => `<li><code>${esc(t.tok)}</code><span>${langs().map((lc) => esc(t[lc])).join(' / ')}</span></li>`).join('');
  if (!v.ok) { $('#results').innerHTML = ''; $('#res-count').textContent = ''; $('#sample-out').textContent = $('#sample').value; $('#groups').innerHTML = ''; return; }

  // tester
  const sample = $('#sample').value.slice(0, MAX_TEXT);
  if (search.q) {
    const t = await runMatch({ pattern: patternFor(), flags: flagsFor(), docs: [{ k: 's', text: sample }], per: 200 });
    if (seq !== refreshSeq) return;
    renderTester(sample, t);
  } else { $('#sample-out').textContent = sample; $('#groups').innerHTML = ''; }

  // results
  const box = $('#results'), cnt = $('#res-count');
  if (!search.q) {
    box.innerHTML = articleList(ARTICLES); cnt.textContent = `${ARTICLES.length} ${uPlain('articles')}`; live(cnt.textContent); return;
  }
  const r = await runMatch({ pattern: patternFor(), flags: flagsFor(), docs: INDEX.map((d) => ({ k: d.id, text: d.text })), per: 5 });
  if (seq !== refreshSeq) return;
  if (r.timeout) { box.innerHTML = ''; cnt.textContent = uPlain('timeout'); live(cnt.textContent); return; }
  if (r.error) { box.innerHTML = ''; cnt.textContent = r.error; return; }
  const hits = r.out;
  if (!hits.length) { box.innerHTML = `<p>${u('noResults')}</p>`; cnt.textContent = `0 ${uPlain('results')}`; live(cnt.textContent); return; }
  const textOf = Object.fromEntries(INDEX.map((d) => [d.id, d.text]));
  box.innerHTML = `<ul class="list">${hits.map((h) => {
    const a = byId(h.k), text = textOf[h.k], m = h.ms[0];
    const s0 = Math.max(0, m.i - 60), e0 = Math.min(text.length, m.i + m.l + 90);
    const snip = (s0 > 0 ? '… ' : '') + esc(text.slice(s0, m.i)).replace(/\n/g, ' ') + (m.l ? `<mark>${esc(text.slice(m.i, m.i + m.l)).replace(/\n/g, ' ')}</mark>` : '') + esc(text.slice(m.i + m.l, e0)).replace(/\n/g, ' ') + (e0 < text.length ? ' …' : '');
    return `<li><a class="row" href="#/a/${a.id}"><span class="icon" aria-hidden="true">${settings.emoji ? a.icon : ''}</span><span><span class="t">${langs().map((lc) => esc(a.title[lc])).join(' · ')}</span> <span class="badge info">${langs().map((lc) => esc(cat(a.cat).title[lc])).join(' · ')}</span><br><span class="d mono">${snip}</span></span></a></li>`;
  }).join('')}</ul>`;
  cnt.textContent = `${hits.length} ${uPlain('results')}`; live(cnt.textContent);
}
function renderTester(sample, t) {
  const out = $('#sample-out'), gr = $('#groups');
  if (t.timeout) { out.textContent = sample; gr.innerHTML = `<p class="err">${esc(uPlain('timeout'))}</p>`; return; }
  if (t.error) { out.textContent = sample; gr.innerHTML = ''; return; }
  const ms = (t.out[0] && t.out[0].ms) || [];
  let html = '', pos = 0;
  for (const m of ms) { if (m.i < pos) continue; html += esc(sample.slice(pos, m.i)) + (m.l ? `<mark>${esc(sample.slice(m.i, m.i + m.l))}</mark>` : '<mark aria-hidden="true">​</mark>'); pos = m.i + m.l; }
  out.innerHTML = html + esc(sample.slice(pos));
  if (!ms.length) { gr.innerHTML = `<p class="hint">${u('noMatches')}</p>`; return; }
  const hasGroups = ms.some((m) => m.g.length);
  gr.innerHTML = `<p class="hint">${ms.length}${ms.length >= 200 ? '+' : ''} ${uPlain('matches')}</p>` + (hasGroups ? `<table class="tbl"><thead><tr><th scope="col">#</th><th scope="col">${u('match')}</th><th scope="col">${u('groups')}</th></tr></thead><tbody>${ms.slice(0, 50).map((m, n) => `<tr><td>${n + 1}</td><td class="code">${esc(sample.slice(m.i, m.i + m.l))}</td><td class="code">${m.g.map((g, k) => `$${k + 1} = ${g === null ? '(no match)' : esc(g)}`).join('<br>')}${m.ng ? '<br>' + Object.entries(m.ng).map(([k, g]) => `${esc(k)} = ${g === null ? '(no match)' : esc(g)}`).join('<br>') : ''}</td></tr>`).join('')}</tbody></table>` : '');
}
function wireSearchPage() {
  $('#pat').addEventListener('input', (e) => setQuery(e.target.value, 'pat'));
  $('#b-text').addEventListener('click', () => setMode('text'));
  $('#b-regex').addEventListener('click', () => setMode('regex'));
  main.querySelectorAll('[data-flag]').forEach((cb) => cb.addEventListener('change', () => {
    const on = [...main.querySelectorAll('[data-flag]')].filter((x) => x.checked).map((x) => x.dataset.flag).join('');
    search.flags = on; saveSearch(); scheduleRefresh();
  }));
  main.querySelectorAll('[data-tok]').forEach((b) => b.addEventListener('click', () => insertToken(REGEX_TOKENS[+b.dataset.tok].ins)));
  $('#sample').addEventListener('input', (e) => { search.sample = e.target.value; saveSearch(); scheduleRefresh(); });
}
function insertToken(tok) {
  if (search.mode !== 'regex') setMode('regex');
  const pat = $('#pat'); pat.focus();
  const s = pat.selectionStart ?? pat.value.length, e = pat.selectionEnd ?? s;
  const v = pat.value.slice(0, s) + tok + pat.value.slice(e);
  const caret = s + (/^[(\[{].+[)\]}]$/.test(tok) || tok === '()' ? tok.length - 1 : tok.length);
  setQuery(v, 'pat'); pat.setSelectionRange(caret, caret);
}
function setQuery(q, source) {
  search.q = q.slice(0, 500); saveSearch();
  const hq = $('#q'); if (hq.value !== search.q) hq.value = search.q;
  const pat = $('#pat'); if (pat && pat.value !== search.q) pat.value = search.q;
  const v = validate(); hq.classList.toggle('bad', !v.ok); hq.setAttribute('aria-invalid', String(!v.ok));
  if (route.name !== 'search') { location.hash = '#/search'; return; }
  scheduleRefresh();
}
function setMode(m) {
  search.mode = m; saveSearch();
  $('#q').classList.toggle('regex', m === 'regex');
  const mb = $('#mode-btn'); mb.textContent = m === 'regex' ? uPlain('modeRegex') : uPlain('modeText'); mb.setAttribute('aria-pressed', String(m === 'regex'));
  mb.setAttribute('aria-label', uPlain('mode') + ': ' + mb.textContent);
  const v = validate(); $('#q').classList.toggle('bad', !v.ok);
  if (route.name === 'search') {
    $('#b-text').setAttribute('aria-pressed', String(m === 'text')); $('#b-regex').setAttribute('aria-pressed', String(m === 'regex'));
    main.querySelectorAll('[data-flag]').forEach((cb) => { cb.disabled = m !== 'regex'; });
    scheduleRefresh();
  }
  live(m === 'regex' ? uPlain('modeRegex') : uPlain('modeText'));
}

/* ---------------------------------------------------------- settings page */
function pageSettings() {
  const radio = (name, val, label, cur) => `<label><input type="radio" name="${name}" value="${val}"${String(cur) === String(val) ? ' checked' : ''}><span>${label}</span></label>`;
  const rst = (key) => `<button type="button" class="btn text small" data-reset="${key}">${u('reset')}</button>`;
  const funPrev = (lc) => `<p class="hint" id="fun-prev-${lc}" lang="${LANGATTR[lc]}">${esc(pick(UI[lc].heroTitle, lc))}</p>`;
  return `<div class="wrap article"><div class="page-head"><h1>${u('settingsTitle')}</h1><p class="lead-text">${u('settingsIntro')}</p></div>
  <div class="field" id="set-theme"><span class="lab" id="l-theme">${u('theme')}</span><div class="row"><div class="seg" role="radiogroup" aria-labelledby="l-theme">${radio('theme', 'system', u('themeSystem'), settings.theme)}${radio('theme', 'light', u('themeLight'), settings.theme)}${radio('theme', 'dark', u('themeDark'), settings.theme)}</div>${rst('theme')}</div></div>
  <div class="field" id="set-accent"><label for="in-accent">${u('accent')}</label><div class="row"><input type="color" id="in-accent" value="${settings.accent || '#36618e'}">${rst('accent')}</div><p class="hint" id="accent-info" aria-live="polite"></p></div>
  <div class="field" id="set-textsize"><label for="in-size">${u('textSize')}: <output id="out-size">${settings.textSize}%</output></label><div class="row"><input type="range" id="in-size" min="100" max="200" step="10" value="${settings.textSize}">${rst('textSize')}</div></div>
  <div class="field" id="set-motion"><span class="lab" id="l-motion">${u('motion')}</span><div class="row"><div class="seg" role="radiogroup" aria-labelledby="l-motion">${radio('motion', 'system', u('motionSystem'), settings.motion)}${radio('motion', 'reduce', u('motionReduce'), settings.motion)}${radio('motion', 'allow', u('motionAllow'), settings.motion)}</div>${rst('motion')}</div></div>
  <div class="field" id="set-lang"><span class="lab" id="l-lang">${u('language')}</span><div class="row"><div class="seg" role="radiogroup" aria-labelledby="l-lang">${radio('lang', 'en', 'English', settings.lang)}${radio('lang', 'zh', '粵語', settings.lang)}${radio('lang', 'both', 'English + 粵語', settings.lang)}</div>${rst('lang')}</div></div>
  <div class="field" id="set-fun-en"><label for="in-fun-en">${esc(UI.en.funEn)}${langs().includes('zh') && settings.lang !== 'en' ? ' · ' + esc(UI.zh.funEn) : ''}: <output id="out-fun-en">${settings.funEn}</output></label><div class="row"><input type="range" id="in-fun-en" min="1" max="5" step="1" value="${settings.funEn}">${rst('funEn')}</div>${funPrev('en')}<p class="hint">${u('funNote')}</p></div>
  <div class="field" id="set-fun-zh"><label for="in-fun-zh">${esc(UI.zh.funZh)} · ${esc(UI.en.funZh)}: <output id="out-fun-zh">${settings.funZh}</output></label><div class="row"><input type="range" id="in-fun-zh" min="1" max="5" step="1" value="${settings.funZh}">${rst('funZh')}</div>${funPrev('zh')}</div>
  <div class="field" id="set-emoji"><div class="row"><label class="opt"><input type="checkbox" id="in-emoji"${settings.emoji ? ' checked' : ''}> <span>${u('emoji')}</span></label>${rst('emoji')}</div></div>
  <div class="field" id="set-reset-all"><div class="row"><button type="button" class="btn outlined" id="reset-all">${u('resetAll')}</button><span id="reset-msg" role="status"></span></div></div></div>`;
}
function renderSettingsContrast() {
  const el = $('#accent-info'); if (!el) return;
  const info = accentInfo();
  if (!info) { el.textContent = ''; return; }
  const f = (n) => n.toFixed(2) + ':1';
  el.innerHTML = langs().map((lc) => `<span lang="${LANGATTR[lc]}" style="display:block">${esc(UI[lc].contrastWhite)}: ${f(info.buttonRatio)}, ${esc(info.buttonRatio >= 4.5 ? UI[lc].pass : UI[lc].fail)}.<br>${esc(UI[lc].contrastBg)}: ${f(info.linkRatio)}, ${esc(info.linkRatio >= 4.5 ? UI[lc].pass : UI[lc].fail)} (${f(info.linkFixedRatio)}).</span>`).join('');
}
function wireSettings() {
  const commit = (rerender) => { saveSettings(); applySettings(); renderChrome(); if (rerender) rerenderKeepFocus(); };
  main.querySelectorAll('input[name="theme"]').forEach((r) => r.addEventListener('change', () => { settings.theme = r.value; commit(false); renderSettingsContrast(); }));
  main.querySelectorAll('input[name="motion"]').forEach((r) => r.addEventListener('change', () => { settings.motion = r.value; commit(false); }));
  main.querySelectorAll('input[name="lang"]').forEach((r) => r.addEventListener('change', () => { settings.lang = r.value; commit(true); }));
  const acc = $('#in-accent');
  acc.addEventListener('input', () => { settings.accent = acc.value; saveSettings(); applySettings(); renderSettingsContrast(); });
  const size = $('#in-size');
  size.addEventListener('input', () => { settings.textSize = +size.value; $('#out-size').textContent = size.value + '%'; saveSettings(); applySettings(); });
  for (const lc of ['en', 'zh']) {
    const key = lc === 'en' ? 'funEn' : 'funZh', el = $('#in-fun-' + lc);
    el.addEventListener('input', () => { settings[key] = +el.value; $('#out-fun-' + lc).textContent = el.value; saveSettings(); const p = $('#fun-prev-' + lc); p.textContent = pick(UI[lc].heroTitle, lc); });
    el.addEventListener('change', () => commit(true));
  }
  $('#in-emoji').addEventListener('change', (e) => { settings.emoji = e.target.checked; commit(true); });
  main.querySelectorAll('[data-reset]').forEach((b) => b.addEventListener('click', () => {
    const k = b.dataset.reset; settings[k] = DEFAULTS[k]; commit(true); live(uPlain('resetDone'));
  }));
  $('#reset-all').addEventListener('click', () => {
    settings = { ...DEFAULTS }; commit(true); $('#reset-msg').textContent = uPlain('resetDone'); live(uPlain('resetDone'));
  });
  renderSettingsContrast();
}
function rerenderKeepFocus() {
  const id = document.activeElement && document.activeElement.id;
  const name = document.activeElement && document.activeElement.name, val = document.activeElement && document.activeElement.value;
  const y = window.scrollY;
  renderPage(false);
  window.scrollTo(0, y);
  let t = id && document.getElementById(id);
  if (!t && name) t = main.querySelector(`[name="${name}"][value="${val}"]`);
  if (t) t.focus({ preventScroll: true });
}

/* -------------------------------------------------------------- the router */
function renderPage(isNav) {
  const r = route;
  let html, title = uPlain('siteName');
  if (r.name === 'home') html = pageHome();
  else if (r.name === 'docs') { html = pageDocs(); title = uPlain('docsTitle'); }
  else if (r.name === 'category') { const c = cat(r.id); if (!c) { route = { name: 'notfound' }; return renderPage(isNav); } html = pageCategory(c); title = c.title[langs()[0]]; }
  else if (r.name === 'article') { const a = byId(r.id); html = pageArticle(a); title = a.title[langs()[0]]; }
  else if (r.name === 'search') { html = pageSearch(); title = uPlain('searchTitle'); }
  else if (r.name === 'settings') { html = pageSettings(); title = uPlain('settingsTitle'); }
  else { html = `<div class="wrap article"><div class="page-head"><h1>${u('notFoundTitle')}</h1>${langs().map((lc) => `<p lang="${LANGATTR[lc]}">${esc(ui('notFoundText', lc))}</p>`).join('')}<p><a class="btn filled" href="#/">${u('goHome')}</a></p></div></div>`; title = uPlain('notFoundTitle'); }
  main.innerHTML = html;
  document.title = r.name === 'home' ? 'Tunnel Doctor' : `${title} - Tunnel Doctor`;
  renderChrome();
  if (r.name === 'search') { wireSearchPage(); refreshSearch(); }
  if (r.name === 'settings') wireSettings();
  if (isNav) {
    live(document.title);
    const sec = r.section && (r.name === 'article' ? document.getElementById('sec-' + r.section) : document.getElementById(r.section));
    if (sec) { sec.scrollIntoView(); sec.classList.add('flash'); }
    else window.scrollTo(0, 0);
    if (!sec && document.activeElement !== $('#q')) main.focus({ preventScroll: true });
    if (pendingFlash) { const el = document.querySelector(pendingFlash); pendingFlash = null; if (el) { el.scrollIntoView(); el.classList.add('flash'); if (el.matches('h1, h2, h3')) { el.setAttribute('tabindex', '-1'); el.focus({ preventScroll: true }); } else { const f = el.querySelector('input, button, select'); if (f) f.focus({ preventScroll: true }); } } }
  }
}
function onRoute() { route = parseRoute(); renderPage(true); }
window.addEventListener('hashchange', onRoute);

/* ----------------------------------------------------------- command palette */
let palOpener = null, palSel = 0, palItems = [], palMode = 'text', palQ = '';
function paletteEntries() {
  const items = [];
  items.push({ kind: 'page', label: langs().map((lc) => UI[lc].navDocs).join(' · '), go: '#/docs' });
  items.push({ kind: 'page', label: uPlain('searchTitle'), go: '#/search' });
  items.push({ kind: 'page', label: uPlain('navDownload'), go: '#/home/download' });
  items.push({ kind: 'page', label: uPlain('navSettings'), go: '#/settings' });
  for (const c of CATEGORIES) items.push({ kind: 'category', label: langs().map((lc) => c.title[lc]).join(' · '), go: '#/docs/' + c.id });
  for (const a of ARTICLES) items.push({ kind: 'article', label: langs().map((lc) => a.title[lc]).join(' · '), extra: a.id + ' ' + a.title.en + ' ' + a.title.zh, go: '#/a/' + a.id, flash: 'h1' });
  for (const s of SETTINGS_ENTRIES) items.push({ kind: 'setting', label: langs().map((lc) => s[lc === 'en' ? 'en' : 'zh']).join(' · '), extra: s.en + ' ' + s.zh, go: '#/settings', flash: '#set-' + s.id });
  return items;
}
function filterPalette() {
  const all = paletteEntries();
  if (!palQ) return all;
  const q = palQ.slice(0, 200);
  if (palMode === 'regex') {
    let re; try { re = new RegExp(q, 'i'); } catch { return null; }
    return all.filter((i) => re.test((i.label + ' ' + (i.extra || '')).slice(0, 300)));
  }
  const ql = q.toLowerCase();
  return all.filter((i) => (i.label + ' ' + (i.extra || '')).toLowerCase().includes(ql));
}
function renderPalette() {
  const p = $('#palette');
  const items = filterPalette();
  palItems = items || [];
  palSel = Math.min(palSel, Math.max(0, palItems.length - 1));
  const kindLabel = { page: 'page', category: 'category', article: 'article', setting: 'setting' };
  p.innerHTML = `<div class="box"><div class="top"><h2 id="pal-title">${u('palette')}</h2><label class="sr-only" for="pal-in">${esc(uPlain('palette'))}</label><input type="text" id="pal-in" autocomplete="off" spellcheck="false" role="combobox" aria-expanded="true" aria-controls="pal-list" aria-autocomplete="list" value="${esc(palQ)}" placeholder="${esc(uPlain('searchPh'))}"><button class="btn tonal" type="button" id="pal-mode" aria-pressed="${palMode === 'regex'}">${esc(uPlain('modeRegex'))}</button><button class="btn text" type="button" id="pal-close">${esc(uPlain('close'))}</button></div>
  <ul id="pal-list" role="listbox" aria-label="${esc(uPlain('palette'))}">${palItems.length ? palItems.map((it, n) => `<li role="option" id="pal-${n}" data-n="${n}" aria-selected="${n === palSel}"><span>${esc(it.label)}</span><span class="kind">${esc(uPlain(it.kind === 'page' ? 'page' : it.kind === 'category' ? 'category' : it.kind === 'article' ? 'article' : 'setting'))}</span></li>`).join('') : `<li aria-disabled="true">${esc(items === null ? uPlain('invalid') : uPlain('paletteNone'))}</li>`}</ul>
  <div class="foot">${esc(uPlain('paletteHint'))}${palMode === 'regex' ? ` <button class="btn text small" type="button" id="pal-builder">${esc(uPlain('paletteOpenBuilder'))}</button>` : ''}</div></div>`;
  const inp = $('#pal-in'); inp.setAttribute('aria-activedescendant', palItems.length ? 'pal-' + palSel : '');
  inp.addEventListener('input', () => { palQ = inp.value; palSel = 0; const pos = inp.selectionStart; renderPalette(); const n = $('#pal-in'); n.focus(); n.setSelectionRange(pos, pos); });
  $('#pal-mode').addEventListener('click', () => { palMode = palMode === 'regex' ? 'text' : 'regex'; palSel = 0; renderPalette(); $('#pal-in').focus(); });
  $('#pal-close').addEventListener('click', closePalette);
  const pb = $('#pal-builder'); if (pb) pb.addEventListener('click', () => { search.mode = 'regex'; search.q = palQ.slice(0, 500); saveSearch(); closePalette(); if (location.hash === '#/search') onRoute(); else location.hash = '#/search'; });
  p.querySelectorAll('li[data-n]').forEach((li) => { li.addEventListener('click', () => chooseItem(+li.dataset.n)); li.addEventListener('mousemove', () => { if (palSel !== +li.dataset.n) { palSel = +li.dataset.n; markSel(); } }); });
  const sel = $('#pal-' + palSel); if (sel) sel.scrollIntoView({ block: 'nearest' });
}
function markSel() { $('#palette').querySelectorAll('li[data-n]').forEach((li) => li.setAttribute('aria-selected', String(+li.dataset.n === palSel))); const inp = $('#pal-in'); if (inp) inp.setAttribute('aria-activedescendant', 'pal-' + palSel); const s = $('#pal-' + palSel); if (s) s.scrollIntoView({ block: 'nearest' }); }
function chooseItem(n) {
  const it = palItems[n]; if (!it) return;
  closePalette(false);
  pendingFlash = it.flash || null;
  if (location.hash === it.go) { route = parseRoute(); renderPage(true); } else location.hash = it.go;
}
function openPalette() {
  const p = $('#palette'); if (!p.hidden) return;
  palOpener = document.activeElement; palQ = ''; palSel = 0; palMode = 'text';
  p.hidden = false; renderPalette(); $('#pal-in').focus();
}
function closePalette(restore = true) {
  const p = $('#palette'); p.hidden = true; p.innerHTML = '';
  if (restore && palOpener && palOpener.focus) palOpener.focus();
}
$('#palette').addEventListener('keydown', (e) => {
  if (e.key === 'Escape') { e.preventDefault(); closePalette(); return; }
  if (e.key === 'ArrowDown') { e.preventDefault(); if (palItems.length) { palSel = (palSel + 1) % palItems.length; markSel(); } }
  else if (e.key === 'ArrowUp') { e.preventDefault(); if (palItems.length) { palSel = (palSel - 1 + palItems.length) % palItems.length; markSel(); } }
  else if (e.key === 'Enter' && e.target.id === 'pal-in') { e.preventDefault(); chooseItem(palSel); }
  else if (e.key === 'Tab') {
    const f = [...$('#palette').querySelectorAll('input, button')].filter((x) => !x.disabled);
    if (!f.length) return;
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }
});
$('#palette').addEventListener('mousedown', (e) => { if (e.target.id === 'palette') closePalette(); });
document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'f') { e.preventDefault(); openPalette(); }
});

/* --------------------------------------------------------------- wire-up */
$('#palette-btn').addEventListener('click', openPalette);
$('#q').addEventListener('input', (e) => setQuery(e.target.value, 'bar'));
$('#q').addEventListener('keydown', (e) => { if (e.key === 'Enter' && route.name !== 'search') location.hash = '#/search'; });
$('#mode-btn').addEventListener('click', () => setMode(search.mode === 'regex' ? 'text' : 'regex'));
$('#menu-btn').addEventListener('click', () => { const n = $('#site-nav'); const o = n.classList.toggle('open'); $('#menu-btn').setAttribute('aria-expanded', String(o)); });
$('#lang-sel').addEventListener('change', (e) => { settings.lang = e.target.value; saveSettings(); applySettings(); renderPage(false); });
$('#skip').addEventListener('click', (e) => { e.preventDefault(); main.focus(); main.scrollIntoView(); });

applySettings();
onRoute();
