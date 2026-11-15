// Personal wording files: { "schemaVersion": 1, "entries": { "<original>": "<replacement>" } }
// Parsed and stored only on this device. Nothing here is sent anywhere.

export const LIMITS = { bytes: 1024 * 1024, entries: 5000, keyLength: 200, valueLength: 200 };
const STORE = 'tunnel-doctor.wording.v1';
const HEADLINE_KEY = 'private vocabulary';

export function parseWordingFile(text, size = text.length) {
  if (size > LIMITS.bytes) throw new Error('too large');
  const data = JSON.parse(text);
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('not an object');
  if (!Number.isInteger(data.schemaVersion) || data.schemaVersion < 1 || data.schemaVersion > 99) throw new Error('bad schemaVersion');
  const entries = data.entries;
  if (!entries || typeof entries !== 'object' || Array.isArray(entries)) throw new Error('bad entries');
  const pairs = [];
  for (const [k, v] of Object.entries(entries)) {
    if (typeof v !== 'string' || !k || k.length > LIMITS.keyLength || v.length > LIMITS.valueLength) throw new Error('bad entry');
    pairs.push([k, v]);
  }
  if (!pairs.length || pairs.length > LIMITS.entries) throw new Error('bad entry count');
  // Longest originals first so longer phrases win over their parts.
  pairs.sort((a, b) => b[0].length - a[0].length);
  const headline = typeof entries[HEADLINE_KEY] === 'string' ? entries[HEADLINE_KEY] : null;
  return { pairs, count: pairs.length, headline };
}

export function saveWording(parsed) {
  try { localStorage.setItem(STORE, JSON.stringify({ pairs: parsed.pairs, headline: parsed.headline })); } catch { /* storage may be unavailable; the wording still applies for this session */ }
}

export function loadSavedWording() {
  try {
    const raw = localStorage.getItem(STORE);
    if (!raw) return null;
    const v = JSON.parse(raw);
    if (!Array.isArray(v.pairs)) return null;
    return { pairs: v.pairs, count: v.pairs.length, headline: v.headline || null };
  } catch { return null; }
}

export function clearWording() {
  try { localStorage.removeItem(STORE); } catch { /* nothing stored */ }
}
