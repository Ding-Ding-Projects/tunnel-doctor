// Interface text in English and Hong Kong Cantonese.
// Facts (check results, errors, commands) are identical at every funny level.
// Only interface voice strings have levels: [serious (1-2), friendly (3), playful (4-5)].

const T = {
  appName: { en: 'Tunnel Doctor', yue: '隧道醫生' },
  run: { en: 'Run all checks', yue: '全部檢查' },
  running: { en: ['Running checks…', 'Checking the whole path…', 'Poking every hop…'], yue: ['檢查緊…', '成條路逐段睇緊…', '逐個站篤緊…'] },
  hostname: { en: 'Hostname to check', yue: '要檢查嘅主機名' },
  origin: { en: 'Origin address (optional)', yue: '源站地址（可以唔填）' },
  originHelp: { en: 'Where the tunnel sends traffic, such as http://homeassistant.local:8123', yue: '隧道將流量送去邊度，例如 http://homeassistant.local:8123' },
  allClear: { en: ['No problems found.', 'Everything checks out.', 'Clean bill of health.'], yue: ['冇發現問題。', '全部都正常。', '健康到不得了。'] },
  problems: { en: (n) => `${n} problem${n === 1 ? '' : 's'} found.`, yue: (n) => `搵到 ${n} 個問題。` },
  warnings: { en: (n) => `${n} warning${n === 1 ? '' : 's'}.`, yue: (n) => `${n} 個警告。` },
  noReport: { en: ['No checks run yet. Enter a hostname and run the checks.', 'Nothing checked yet. Pick a hostname to start.', 'Quiet in here. Give me a hostname to examine.'], yue: ['未有檢查。輸入主機名再開始。', '仲未檢查過，揀個主機名開始啦。', '好靜呀，俾個主機名我睇吓。'] },
  selected: { en: 'Selected check', yue: '已選檢查' },
  evidence: { en: 'Evidence', yue: '證據' },
  suggestedFix: { en: 'Suggested fix', yue: '建議修正' },
  previewFix: { en: 'Preview fix', yue: '預覽修正' },
  fixAvailable: { en: 'Fix available', yue: '可以修正' },
  status: { pass: { en: 'Pass', yue: '通過' }, warn: { en: 'Warn', yue: '警告' }, fail: { en: 'Fail', yue: '失敗' }, skip: { en: 'Skipped', yue: '略過' }, error: { en: 'Error', yue: '出錯' } },
  confirmTitle: { en: 'Confirm with two keys', yue: '兩下確認' },
  confirmAck: { en: 'I understand this changes live configuration', yue: '我明白呢個會改動正在運作嘅設定' },
  confirmType: { en: (t) => `Type ${t} to confirm`, yue: (t) => `輸入 ${t} 確認` },
  apply: { en: 'Apply fix', yue: '套用修正' },
  cancel: { en: 'Cancel', yue: '取消' },
  applied: { en: ['Fix applied. Run the checks again to confirm.', 'Done. Re-run the checks to see it land.', 'Patched! Re-run to watch it go green.'], yue: ['已套用，再檢查一次確認。', '搞掂，再跑一次睇吓。', '補好咗！再跑一次睇佢轉綠。'] },
  undo: { en: 'Undo', yue: '還原' },
  undone: { en: 'Change undone.', yue: '已還原。' },
  history: { en: 'History', yue: '歷史' },
  noHistory: { en: 'No fixes applied yet.', yue: '未套用過修正。' },
  diagnose: { en: 'Diagnose', yue: '診斷' },
  settings: { en: 'Settings', yue: '設定' },
  docs: { en: 'Help', yue: '說明' },
  search: { en: 'Search checks, fixes and settings', yue: '搜尋檢查、修正同設定' },
  regexBuilder: { en: 'Regex builder', yue: '正則表達式工具' },
  newTab: { en: 'New tab', yue: '新分頁' },
  version: { en: 'Version', yue: '版本' },
  updated: { en: 'Updated', yue: '更新於' },
  unavailable: { en: 'unavailable', yue: '未能提供' },
  signIn: { en: 'Sign in', yue: '登入' },
  setPassword: { en: 'Create a password', yue: '設定密碼' },
  password: { en: 'Password', yue: '密碼' },
  signOut: { en: 'Sign out', yue: '登出' },
  reset: { en: 'Reset', yue: '重設' },
  resetAll: { en: 'Reset all settings', yue: '全部重設' },
  back: { en: 'Back', yue: '上一步' },
  next: { en: 'Next', yue: '下一步' },
  skip: { en: 'Skip this step', yue: '略過呢步' },
  finishLater: { en: 'Save and finish later', yue: '儲存，遲啲再做' },
  finish: { en: 'Run checks and finish', yue: '檢查並完成' },
  wordingApplied: { en: 'Personal wording applied', yue: '已套用個人用語' },
  wordingInvalid: { en: 'That file is not a valid personal wording file. Nothing changed.', yue: '呢個唔係有效嘅個人用語檔案，乜都冇改。' },
  desktopOnly: { en: 'Desktop app only', yue: '只限桌面版' }
};

// Result codes from core/checks.js. Plain at every level.
const R = {
  'dns.ok': { en: (p) => `Resolves publicly to ${p.addresses || 'the edge'}`, yue: (p) => `公共解析到 ${p.addresses || '邊緣'}` },
  'dns.nxdomain': { en: (p) => `${p.hostname} does not exist in public DNS`, yue: (p) => `公共 DNS 搵唔到 ${p.hostname}` },
  'dns.no-records': { en: (p) => `${p.hostname} exists in DNS but has no address records`, yue: (p) => `${p.hostname} 喺 DNS 存在，但冇任何地址紀錄` },
  'dns.unproxied-tunnel': { en: (p) => `Public DNS (${p.resolver}) hands out a private tunnel address that browsers cannot reach`, yue: (p) => `公共 DNS（${p.resolver}）派出私人隧道地址，瀏覽器去唔到` },
  'dns.resolvers-disagree': { en: () => 'Public resolvers give different answers; a change may still be spreading', yue: () => '唔同公共解析器答案唔同，可能改動仲未傳開' },
  'zone.ok': { en: (p) => `${p.type} record present, proxied: ${p.proxied}`, yue: (p) => `有 ${p.type} 紀錄，proxy：${p.proxied}` },
  'zone.not-in-account': { en: (p) => `No zone in this account covers ${p.hostname}`, yue: (p) => `呢個帳戶冇 zone 包到 ${p.hostname}` },
  'zone.missing-record': { en: (p) => `${p.zone} has no record for ${p.hostname}`, yue: (p) => `${p.zone} 冇 ${p.hostname} 嘅紀錄` },
  'zone.unproxied': { en: (p) => `${p.name} points at the tunnel with the proxy switched off`, yue: (p) => `${p.name} 指向隧道但 proxy 冇開` },
  'zone.wildcard-only': { en: (p) => `Only the wildcard ${p.name} covers this hostname`, yue: (p) => `只係靠萬用紀錄 ${p.name} 包住` },
  'ssl.ok': { en: (p) => `SSL mode is ${p.mode}`, yue: (p) => `SSL 模式係 ${p.mode}` },
  'ssl.off': { en: () => 'SSL is off for the whole zone', yue: () => '成個 zone 嘅 SSL 關咗' },
  'ssl.flexible-https-origin': { en: () => 'SSL mode is Flexible but the origin uses HTTPS, which can cause redirect loops', yue: () => 'SSL 係 Flexible 但源站用 HTTPS，可能會無限轉址' },
  'tunnel.healthy': { en: (p) => `Tunnel ${p.name} is healthy with ${p.connections} connections`, yue: (p) => `隧道 ${p.name} 正常，${p.connections} 條連線` },
  'tunnel.degraded': { en: (p) => `Tunnel ${p.name} is degraded (${p.connections} connections)`, yue: (p) => `隧道 ${p.name} 狀態轉差（${p.connections} 條連線）` },
  'tunnel.down': { en: (p) => `Tunnel ${p.name} is ${p.status}; its connector is not running`, yue: (p) => `隧道 ${p.name} 係 ${p.status}，連接器冇運行` },
  'route.ok': { en: (p) => `Routes to ${p.service}`, yue: (p) => `路由去 ${p.service}` },
  'route.missing': { en: (p) => `The tunnel has no public hostname route for ${p.hostname}`, yue: (p) => `隧道冇 ${p.hostname} 嘅公開主機名路由` },
  'route.locally-managed': { en: () => 'The tunnel is configured by a local config file, so its routes cannot be read', yue: () => '隧道用本機設定檔，讀唔到路由' },
  'edge.ok': { en: (p) => `HTTP ${p.status} in ${p.ms} ms`, yue: (p) => `HTTP ${p.status}，${p.ms} 毫秒` },
  'edge.1033': { en: () => 'Error 1033: the edge cannot reach a running tunnel connector', yue: () => '錯誤 1033：邊緣搵唔到運行緊嘅隧道連接器' },
  'edge.bad-gateway': { en: (p) => `HTTP ${p.status}: the tunnel is up but the origin is not answering`, yue: (p) => `HTTP ${p.status}：隧道正常但源站冇回應` },
  'edge.5xx': { en: (p) => `HTTP ${p.status} from the edge`, yue: (p) => `邊緣回應 HTTP ${p.status}` },
  'edge.400': { en: () => 'HTTP 400: the service rejected the forwarded request', yue: () => 'HTTP 400：服務拒絕咗轉發請求' },
  'edge.dns': { en: () => 'Could not resolve the hostname from here', yue: () => '呢度解析唔到主機名' },
  'edge.refused': { en: () => 'Connection refused', yue: () => '連線被拒' },
  'edge.unreachable': { en: () => 'Network unreachable', yue: () => '網絡去唔到' },
  'edge.timeout': { en: () => 'Timed out', yue: () => '超時' },
  'edge.tls': { en: () => 'TLS handshake failed', yue: () => 'TLS 握手失敗' },
  'edge.other': { en: () => 'Request failed', yue: () => '請求失敗' },
  'origin.ok': { en: (p) => `HTTP ${p.status} in ${p.ms} ms`, yue: (p) => `HTTP ${p.status}，${p.ms} 毫秒` },
  'origin.5xx': { en: (p) => `The origin answered HTTP ${p.status}`, yue: (p) => `源站回應 HTTP ${p.status}` },
  'origin.refused': { en: () => 'Connection refused: the service is not listening (stopped or restarting)', yue: () => '連線被拒：服務冇開或者重啟緊' },
  'origin.unreachable': { en: () => 'Host unreachable: the machine is off or on another network', yue: () => '去唔到主機：部機熄咗或者喺另一個網絡' },
  'origin.timeout': { en: () => 'Timed out waiting for the origin', yue: () => '等源站等到超時' },
  'origin.dns': { en: () => 'The origin name does not resolve', yue: () => '源站名稱解析唔到' },
  'origin.tls': { en: () => 'TLS handshake with the origin failed', yue: () => '同源站 TLS 握手失敗' },
  'origin.other': { en: () => 'Request to the origin failed', yue: () => '請求源站失敗' },
  'ha.ok': { en: () => 'Forwarded requests are accepted', yue: () => '轉發請求接受' },
  'ha.untrusted-here': { en: () => 'The public path works. Home Assistant rejects forwarded requests from this computer only because it is not a trusted proxy, which is correct.', yue: () => '公開路徑正常。Home Assistant 拒絕呢部電腦嘅轉發請求，只係因為佢唔係受信任代理，咁係啱嘅。' },
  'ha.forwarded-rejected-unconfirmed': { en: () => 'Home Assistant rejects forwarded requests from this computer. Check that trusted_proxies lists the tunnel connector’s address.', yue: () => 'Home Assistant 拒絕呢部電腦嘅轉發請求。睇吓 trusted_proxies 有冇包隧道連接器嘅地址。' },
  'ha.forwarded-rejected': { en: () => 'Home Assistant rejects forwarded requests: set use_x_forwarded_for and trusted_proxies', yue: () => 'Home Assistant 拒絕轉發請求：要設定 use_x_forwarded_for 同 trusted_proxies' },
  'local.ok': { en: () => 'This computer resolves it the same as public DNS', yue: () => '呢部電腦解析結果同公共 DNS 一樣' },
  'local.stale': { en: () => 'This computer still holds an old answer in its DNS cache', yue: () => '呢部電腦 DNS 快取仲係舊答案' },
  'local.no-answer': { en: () => 'This computer cannot resolve it either', yue: () => '呢部電腦都解析唔到' },
  'token.ok': { en: () => 'No tunnel token visible in process command lines', yue: () => '程序指令列見唔到隧道 token' },
  'token.cmdline': { en: (p) => `${p.count} tunnel connector process${p.count === 1 ? '' : 'es'} show the token in the command line`, yue: (p) => `${p.count} 個隧道連接器程序喺指令列露咗 token` },
  'skip.no-token': { en: () => 'Needs a Cloudflare API token (Settings)', yue: () => '要 Cloudflare API token（設定）' },
  'skip.no-tunnel': { en: () => 'No tunnel found for this hostname', yue: () => '搵唔到呢個主機名嘅隧道' },
  'skip.no-origin': { en: () => 'Add the origin address to run this check', yue: () => '填源站地址先做到呢個檢查' },
  'skip.origin-down': { en: () => 'Skipped because the origin is not answering', yue: () => '源站冇回應，所以略過' },
  'skip.not-ha': { en: () => 'The origin is not Home Assistant', yue: () => '源站唔係 Home Assistant' },
  'skip.desktop-only': { en: () => 'Only the desktop app can read this computer’s DNS cache and process list', yue: () => '只有桌面版先讀到呢部電腦嘅 DNS 快取同程序列表' },
  'check.error': { en: (p) => `Check failed: ${p.message}`, yue: (p) => `檢查出錯：${p.message}` }
};

const NAMES = {
  'public-dns': { en: 'Public DNS answer', yue: '公共 DNS 答案' },
  'zone-record': { en: 'Record in the zone', yue: 'Zone 紀錄' },
  'tunnel-health': { en: 'Tunnel connector', yue: '隧道連接器' },
  'tunnel-route': { en: 'Public hostname route', yue: '公開主機名路由' },
  'edge-http': { en: 'Cloudflare edge', yue: 'Cloudflare 邊緣' },
  origin: { en: 'Origin reachable', yue: '源站可達' },
  'ha-proxy': { en: 'Home Assistant reverse proxy', yue: 'Home Assistant 反向代理' },
  'ssl-mode': { en: 'SSL mode', yue: 'SSL 模式' },
  'local-cache': { en: 'This computer’s DNS cache', yue: '呢部電腦嘅 DNS 快取' },
  'token-exposure': { en: 'Tunnel token exposure', yue: '隧道 token 外露' }
};

const FIX_NAMES = {
  'set-proxied': { en: 'Turn on the proxy for this record', yue: '開啟呢條紀錄嘅 proxy' },
  'create-record': { en: 'Create a proxied CNAME to the tunnel', yue: '建立指向隧道嘅 proxied CNAME' },
  'add-route': { en: 'Add a public hostname route to the tunnel', yue: '幫隧道加公開主機名路由' },
  'flush-dns': { en: 'Flush this computer’s DNS cache', yue: '清除呢部電腦嘅 DNS 快取' }
};

let overrides = null; // personal wording: { "<english phrase>": "<replacement>" }

export function setWordingOverrides(map) { overrides = map; }

function wordify(s) {
  if (!overrides || typeof s !== 'string') return s;
  let out = s;
  for (const [from, to] of overrides) out = out.split(from).join(to);
  return out;
}

function tier(level) { return level <= 2 ? 0 : level === 3 ? 1 : 2; }

function pick(entry, lang, level, arg) {
  const v = entry[lang];
  if (typeof v === 'function') return v(arg);
  if (Array.isArray(v)) return v[tier(level)];
  return v;
}

// Returns { en, yue } for the key, already levelled.
export function both(key, settings, arg) {
  const entry = key.split('.').reduce((o, k) => o?.[k], T);
  if (!entry) return { en: key, yue: key };
  return { en: wordify(pick(entry, 'en', settings.funnyEn, arg)), yue: pick(entry, 'yue', settings.funnyYue, arg) };
}

export function resultText(code, params) {
  const e = R[code] || { en: () => code, yue: () => code };
  return { en: wordify(e.en(params || {})), yue: e.yue(params || {}) };
}

export function checkName(id) { const n = NAMES[id] || { en: id, yue: id }; return { en: wordify(n.en), yue: n.yue }; }
export function fixName(id) { const n = FIX_NAMES[id] || { en: id, yue: id }; return { en: wordify(n.en), yue: n.yue }; }

export const RESULT_CODES = Object.keys(R);
export const CHECK_NAME_IDS = Object.keys(NAMES);
export const FIX_NAME_IDS = Object.keys(FIX_NAMES);
