// Regex builder model: explanation, validation and bounded matching for one
// search field. Uses the JavaScript regex engine of the running browser.

export const TOKENS = [
  { insert: '\\d', en: 'Any digit 0-9', yue: '任何數字 0-9' },
  { insert: '\\w', en: 'Letter, digit or underscore', yue: '字母、數字或底線' },
  { insert: '\\s', en: 'Whitespace', yue: '空白' },
  { insert: '.', en: 'Any character', yue: '任何字元' },
  { insert: '^', en: 'Start of line', yue: '行頭' },
  { insert: '$', en: 'End of line', yue: '行尾' },
  { insert: '\\b', en: 'Word boundary', yue: '字邊界' },
  { insert: '(…)', en: 'Capture group', yue: '捕獲組' },
  { insert: '(?:…)', en: 'Group without capture', yue: '唔捕獲嘅組' },
  { insert: '(?<name>…)', en: 'Named group', yue: '具名組' },
  { insert: '|', en: 'Either side', yue: '其中一邊' },
  { insert: '[…]', en: 'One of these characters', yue: '其中一個字元' },
  { insert: '[^…]', en: 'None of these characters', yue: '唔係呢啲字元' },
  { insert: '*', en: 'Zero or more', yue: '零個或以上' },
  { insert: '+', en: 'One or more', yue: '一個或以上' },
  { insert: '?', en: 'Optional', yue: '可有可無' },
  { insert: '{2,4}', en: 'Between 2 and 4 times', yue: '2 至 4 次' },
  { insert: '(?=…)', en: 'Followed by (lookahead)', yue: '後面跟住（前瞻）' },
  { insert: '(?<=…)', en: 'Preceded by (lookbehind)', yue: '前面係（後顧）' }
];

export const FLAGS = [
  { flag: 'i', en: 'Ignore case', yue: '唔理大細楷' },
  { flag: 'm', en: '^ and $ match each line', yue: '^ 同 $ 逐行對' },
  { flag: 's', en: '. also matches newlines', yue: '. 都對到換行' },
  { flag: 'u', en: 'Unicode', yue: 'Unicode' }
];

const MAX_INPUT = 20000;
const MAX_MATCHES = 500;

export function compile(pattern, flags) {
  if (!pattern) return { ok: false, empty: true };
  if (pattern.length > 1000) return { ok: false, error: 'Pattern is longer than 1000 characters.' };
  try {
    return { ok: true, re: new RegExp(pattern, [...new Set((flags || '').replace(/[^imsu]/g, ''))].join('') + 'g') };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

// Explain a pattern token by token (a readable walk, not a full parser).
export function explain(pattern) {
  const out = [];
  let i = 0;
  const push = (text, en, yue) => out.push({ text, en, yue });
  while (i < pattern.length && out.length < 200) {
    const c = pattern[i];
    if (c === '\\' && i + 1 < pattern.length) {
      const t = pattern.slice(i, i + 2);
      const k = TOKENS.find((x) => x.insert === t);
      push(t, k ? k.en : `Literal ${pattern[i + 1]}`, k ? k.yue : `字面 ${pattern[i + 1]}`);
      i += 2; continue;
    }
    if (c === '[') {
      const end = pattern.indexOf(']', i + 1);
      const t = end === -1 ? pattern.slice(i) : pattern.slice(i, end + 1);
      push(t, t.startsWith('[^') ? 'None of these characters' : 'One of these characters', t.startsWith('[^') ? '唔係呢啲字元' : '其中一個字元');
      i += t.length; continue;
    }
    if (c === '{') {
      const end = pattern.indexOf('}', i);
      const t = end === -1 ? c : pattern.slice(i, end + 1);
      push(t, `Repeat ${t.slice(1, -1).replace(',', ' to ')} times`, `重複 ${t.slice(1, -1).replace(',', ' 至 ')} 次`);
      i += t.length; continue;
    }
    if (c === '(') {
      const m = /^\((\?:|\?=|\?!|\?<=|\?<!|\?<[A-Za-z]\w*>)?/.exec(pattern.slice(i))[0];
      const map = { '(': ['Start capture group', '開始捕獲組'], '(?:': ['Start group without capture', '開始唔捕獲嘅組'], '(?=': ['Start lookahead', '開始前瞻'], '(?!': ['Start negative lookahead', '開始否定前瞻'], '(?<=': ['Start lookbehind', '開始後顧'], '(?<!': ['Start negative lookbehind', '開始否定後顧'] };
      const v = map[m] || ['Start named group', '開始具名組'];
      push(m, v[0], v[1]); i += m.length; continue;
    }
    const simple = { ')': ['End group', '組結束'], '.': ['Any character', '任何字元'], '^': ['Start of line', '行頭'], '$': ['End of line', '行尾'], '|': ['Or', '或者'], '*': ['Zero or more', '零個或以上'], '+': ['One or more', '一個或以上'], '?': ['Optional', '可有可無'] };
    if (simple[c]) { push(c, simple[c][0], simple[c][1]); i++; continue; }
    let j = i;
    while (j < pattern.length && !'\\[{()|.^$*+?'.includes(pattern[j])) j++;
    const lit = pattern.slice(i, Math.max(j, i + 1));
    push(lit, `Literal text "${lit}"`, `字面文字「${lit}」`);
    i += lit.length;
  }
  return out;
}

export function testMatches(re, text) {
  const input = String(text || '').slice(0, MAX_INPUT);
  const matches = [];
  re.lastIndex = 0;
  let m;
  const started = Date.now();
  while ((m = re.exec(input)) && matches.length < MAX_MATCHES) {
    matches.push({ index: m.index, text: m[0], groups: m.slice(1), named: m.groups || null });
    if (m[0] === '') re.lastIndex++;
    if (Date.now() - started > 200) return { matches, truncated: true, reason: 'time' };
  }
  return { matches, truncated: matches.length >= MAX_MATCHES, reason: matches.length >= MAX_MATCHES ? 'count' : null, inputTruncated: String(text || '').length > MAX_INPUT };
}

// Filter helper used by every search field: plain text unless regex mode is on.
export function makeMatcher(state) {
  if (state.mode === 'regex') {
    const c = compile(state.pattern, state.flags);
    if (!c.ok) return () => true;
    return (s) => { c.re.lastIndex = 0; return c.re.test(s); };
  }
  const q = (state.query || '').trim().toLowerCase();
  return (s) => !q || String(s).toLowerCase().includes(q);
}
