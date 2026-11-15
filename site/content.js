// Site content. Facts (commands, result codes, settings, steps) are identical at
// every funny level. Only the `lead` lines and a few interface strings vary by
// tone: s = serious (levels 1-2), f = friendly (3), p = playful (4-5).

const P = (en, zh) => ({ t: 'p', en, zh });
const UL = (en, zh) => ({ t: 'ul', en, zh });
const OL = (en, zh) => ({ t: 'ol', en, zh });
const CMD = (text) => ({ t: 'cmd', text });
const RES = (rows) => ({ t: 'res', rows }); // [code, status, en, zh]
const S = (id, en, zh, ...blocks) => ({ id, h: { en, zh }, blocks });
const L = (en, zh) => ({ en, zh }); // lead: each is {s,f,p}

export const CATEGORIES = [
  { id: 'checks', icon: '🩺', title: { en: 'Checks', zh: '檢查項目' },
    desc: { en: 'Each check looks at one stop on the path a visitor takes, and reports a result code you can look up here.', zh: '每個檢查睇訪客行過嘅其中一站，然後俾你一個結果代碼，喺呢度查到解釋。' } },
  { id: 'fixes', icon: '🛠️', title: { en: 'Fixes', zh: '修復' },
    desc: { en: 'Fixes always show a preview first, ask for two confirmations, and record how to undo themselves.', zh: '修復一定先俾你預覽，要兩重確認，而且會記低點樣還原。' } },
  { id: 'run', icon: '🚀', title: { en: 'Run it', zh: '點樣運行' },
    desc: { en: 'Three ways to run Tunnel Doctor: a desktop app, a Docker-hosted web app, or an appliance OS image.', zh: '三種運行方式：桌面程式、Docker 網頁版，或者專用系統映像。' } },
  { id: 'reference', icon: '📚', title: { en: 'Reference', zh: '參考資料' },
    desc: { en: 'The HTTP API of the hosted forms, and a troubleshooting guide for when the tool itself misbehaves.', zh: '網頁版嘅 HTTP API，同工具本身出問題時嘅排解指引。' } }
];

const TOKEN_NOTE_EN = 'The Cloudflare API token is only needed for checks that read your account. Create a token with the smallest permissions that cover the check, and keep it out of command lines.';
const TOKEN_NOTE_ZH = 'Cloudflare API 權杖只係用嚟讀取你帳戶嘅檢查。建立權杖時只開需要嘅最少權限，亦唔好放喺命令列入面。';

export const ARTICLES = [
  // ---------------------------------------------------------------- checks
  { id: 'public-dns', category: 'checks', icon: '🌐',
    title: { en: 'Public DNS answer', zh: '公開 DNS 回應' },
    lead: L(
      { s: 'Asks public resolvers what your hostname resolves to and compares their answers.', f: 'Asks a couple of public DNS resolvers where your hostname points, and checks they agree.', p: 'Asks the whole internet\'s phone book where your hostname lives, and checks nobody is lying.' },
      { s: '向公開解析器查詢你嘅主機名稱，再比較佢哋嘅答案。', f: '問幾個公開 DNS 解析器你個主機名稱指去邊，睇下佢哋啱唔啱。', p: '問晒全世界本電話簿你個主機名稱住邊，順便睇下有冇人講大話。' }),
    sections: [
      S('what', 'What it checks', '檢查啲乜', P(
        'Tunnel Doctor sends a DNS-over-HTTPS query for the hostname to two public resolvers, 1.1.1.1 (Cloudflare) and 8.8.8.8 (Google). It reads the answers the same way a browser on the open internet would, then compares them with each other and with the shape of a tunnel record.',
        'Tunnel Doctor 用 DNS-over-HTTPS 向兩個公開解析器查詢呢個主機名稱：1.1.1.1（Cloudflare）同 8.8.8.8（Google）。佢讀到嘅答案同開放網絡上嘅瀏覽器睇到嘅一樣，然後互相比較，再同隧道記錄嘅特徵對照。')),
      S('results', 'What each result means', '各個結果代表乜', RES([
        ['dns.ok', 'pass', 'The resolvers agree and return public addresses.', '解析器答案一致，而且係公開地址。'],
        ['dns.nxdomain', 'fail', 'Every resolver says the name does not exist. There is no DNS record for it.', '所有解析器都話呢個名稱唔存在，即係冇 DNS 記錄。'],
        ['dns.unproxied-tunnel', 'fail', 'A resolver returned a tunnel record that is not proxied, so visitors are handed a private fd10:: address they cannot reach. This is the most common cause of "could not resolve host".', '有解析器回傳一條冇開代理嘅隧道記錄，訪客會攞到一個連唔到嘅私有 fd10:: 地址。呢個係「搵唔到主機」最常見嘅原因。'],
        ['dns.resolvers-disagree', 'warn', 'The two resolvers returned different answers. Usually a recent change is still spreading, or one resolver holds an old answer.', '兩個解析器答案唔同。通常係最近改過設定仲未傳開，或者其中一個仲記住舊答案。'],
        ['check.error', 'error', 'The check could not run, for example because this computer has no internet access.', '檢查冇辦法行，例如部電腦上唔到網。']])),
      S('manual', 'How to fix it by hand', '手動點修', OL(
        ['Open the Cloudflare dashboard, choose the domain, then DNS, then Records.', 'Find the hostname. If it is a CNAME to a cfargotunnel.com name, make sure the proxy status is on (the orange cloud).', 'If no record exists, create a proxied CNAME that points to your tunnel\'s cfargotunnel.com name.', 'Wait a minute, then query again.'],
        ['打開 Cloudflare 控制台，揀個網域，再入 DNS，再入 Records。', '搵到個主機名稱。如果係指去 cfargotunnel.com 嘅 CNAME，確保代理狀態係開咗（橙色雲）。', '如果冇記錄，就建立一條有代理、指去你隧道 cfargotunnel.com 名稱嘅 CNAME。', '等一分鐘，再查多次。']),
        CMD('nslookup ha.example.com 1.1.1.1')),
      S('app', 'How the app fixes it', 'App 點樣修', P(
        'For dns.unproxied-tunnel the app offers the "Turn on the proxy" fix. For dns.nxdomain it offers "Create the record" when it can find the matching tunnel route. Both show a preview first.',
        '遇到 dns.unproxied-tunnel，App 會提供「開啟代理」修復；遇到 dns.nxdomain，如果搵到對應嘅隧道路由，會提供「建立記錄」。兩個都會先俾你預覽。')),
      S('security', 'Security notes', '安全注意', P(
        'This check sends only the hostname to the two public resolvers. It does not use your API token and reads nothing from your account.',
        '呢個檢查只會將主機名稱傳俾兩個公開解析器，唔使用你嘅 API 權杖，亦唔會讀你帳戶入面嘅嘢。'))
    ],
    related: ['zone-record', 'set-proxied', 'local-cache'] },

  { id: 'zone-record', category: 'checks', icon: '📒',
    title: { en: 'DNS record in your zone', zh: '區域內嘅 DNS 記錄' },
    lead: L(
      { s: 'Reads the record for the hostname in your Cloudflare zone and checks it is present and proxied.', f: 'Looks in your Cloudflare zone for the hostname\'s record and checks it exists and is proxied.', p: 'Rummages through your Cloudflare zone for the hostname\'s record, and tuts if the orange cloud is off.' },
      { s: '讀取你 Cloudflare 區域內呢個主機名稱嘅記錄，確認佢存在而且有開代理。', f: '喺你嘅 Cloudflare 區域搵呢個主機名稱嘅記錄，睇下有冇、有冇開代理。', p: '喺你嘅 Cloudflare 區域翻箱倒櫃搵條記錄，橙色雲冇開就會嘖一聲。' }),
    sections: [
      S('what', 'What it checks', '檢查啲乜', P(
        'With an API token, Tunnel Doctor lists your zones, finds the zone that owns the hostname, and reads the DNS records that answer for it. It checks that a record exists, that a tunnel CNAME is proxied, and whether only a wildcard record covers the name.',
        '用 API 權杖，Tunnel Doctor 會列出你嘅區域，搵返擁有呢個主機名稱嘅區域，再讀取負責回答嘅 DNS 記錄。佢會睇記錄存唔存在、隧道 CNAME 有冇開代理，以及係咪淨係靠萬用字元記錄覆蓋。'),
        P('Without a token the check is skipped with the code skip.no-token.', '冇權杖嘅話，呢個檢查會跳過，代碼係 skip.no-token。')),
      S('results', 'What each result means', '各個結果代表乜', RES([
        ['zone.ok', 'pass', 'A record exists and, for a tunnel CNAME, the proxy is on.', '記錄存在，而隧道 CNAME 有開代理。'],
        ['zone.not-in-account', 'fail', 'The hostname does not belong to any zone this token can see. Check the token and the account.', '呢個主機名稱唔屬於呢個權杖睇到嘅任何區域，請檢查權杖同帳戶。'],
        ['zone.missing-record', 'fail', 'The zone exists but has no record for the hostname. Offers "Create the record".', '區域存在，但冇呢個主機名稱嘅記錄。會提供「建立記錄」。'],
        ['zone.unproxied', 'fail', 'The record exists but the proxy is off. Offers "Turn on the proxy".', '記錄存在，但冇開代理。會提供「開啟代理」。'],
        ['zone.wildcard-only', 'warn', 'Only a wildcard record matches. It may work, but an exact record is safer and clearer.', '淨係萬用字元記錄吻合。可能行到，但建立精確記錄更穩陣更清楚。'],
        ['skip.no-token', 'skip', 'No API token was provided, so this check did not run.', '冇提供 API 權杖，所以呢個檢查冇行。']])),
      S('manual', 'How to fix it by hand', '手動點修', OL(
        ['In the Cloudflare dashboard open DNS, then Records for the zone.', 'Search for the hostname. For a tunnel, the record type is CNAME and the target is <tunnel-id>.cfargotunnel.com.', 'Turn the proxy status on, or add the record if it is missing.'],
        ['喺 Cloudflare 控制台打開該區域嘅 DNS，再入 Records。', '搜尋主機名稱。隧道嘅記錄類型係 CNAME，目標係 <tunnel-id>.cfargotunnel.com。', '開啟代理狀態，或者冇嘅話就新增記錄。'])),
      S('app', 'How the app fixes it', 'App 點樣修', P(
        'The app uses the "Turn on the proxy" and "Create the record" fixes. Both change one record only, and both can be undone from the history list.',
        'App 用「開啟代理」同「建立記錄」兩個修復。兩個都只會改一條記錄，亦都可以喺歷史清單還原。')),
      S('security', 'Security notes', '安全注意', P(TOKEN_NOTE_EN + ' Reading needs read access to zones and DNS; the two fixes above need DNS edit access.', TOKEN_NOTE_ZH + '讀取需要區域同 DNS 嘅讀取權限；上面兩個修復需要 DNS 編輯權限。'))
    ],
    related: ['public-dns', 'set-proxied', 'create-record'] },

  { id: 'tunnel-health', category: 'checks', icon: '❤️',
    title: { en: 'Tunnel health', zh: '隧道健康狀況' },
    lead: L(
      { s: 'Reads the tunnel\'s status and how many connector connections are live.', f: 'Checks whether your tunnel is up and how many connections it has to Cloudflare.', p: 'Takes the tunnel\'s pulse and counts how many connections it is holding on to.' },
      { s: '讀取隧道狀態同有幾多條連接器連線運作緊。', f: '睇下你條隧道有冇開、同 Cloudflare 有幾多條連線。', p: '幫條隧道探脈搏，數下佢攬住幾多條連線。' }),
    sections: [
      S('what', 'What it checks', '檢查啲乜', P(
        'Tunnel Doctor reads the tunnel from your account and counts the active connector connections, ignoring ones that are pending a reconnect. A healthy tunnel has live connections and a healthy status.',
        'Tunnel Doctor 由你帳戶讀取隧道，數有幾多條運作中嘅連接器連線（唔計等緊重連嘅）。健康嘅隧道有活躍連線同健康狀態。')),
      S('results', 'What each result means', '各個結果代表乜', RES([
        ['tunnel.healthy', 'pass', 'The tunnel reports healthy and has live connections.', '隧道回報健康，而且有運作中嘅連線。'],
        ['tunnel.degraded', 'warn', 'The tunnel is up but some connections are missing. It still serves traffic; check the connector host.', '隧道係開咗，但缺少部分連線。仍然可以服務，不過要睇下連接器主機。'],
        ['tunnel.down', 'fail', 'The tunnel is not connected. No traffic can pass. Typical edge symptom: error 1033.', '隧道冇連線，流量過唔到。邊緣常見症狀係錯誤 1033。'],
        ['skip.no-tunnel', 'skip', 'No tunnel was identified for this hostname, so the check did not run.', '搵唔到呢個主機名稱對應嘅隧道，所以冇行。']])),
      S('manual', 'How to fix it by hand', '手動點修', OL(
        ['On the machine that runs the connector, check that the cloudflared service or container is running.', 'Read its log for authentication or network errors.', 'Restart it, then refresh the tunnel page in the Cloudflare dashboard.'],
        ['喺行連接器嘅機器，確認 cloudflared 服務或者容器有行。', '睇日誌有冇驗證或網絡錯誤。', '重新啟動，再喺 Cloudflare 控制台重新整理隧道頁面。']),
        CMD('docker logs cloudflared --tail 50')),
      S('app', 'How the app fixes it', 'App 點樣修', P(
        'There is no automatic fix: the connector runs on your own machine, and Tunnel Doctor does not reach into it. The app explains the state and what to look at.',
        '呢個冇自動修復：連接器行喺你自己部機，Tunnel Doctor 唔會伸手入去。App 會解釋狀態同應該睇邊度。')),
      S('security', 'Security notes', '安全注意', P(TOKEN_NOTE_EN + ' This check needs read access to Cloudflare Tunnel.', TOKEN_NOTE_ZH + '呢個檢查需要 Cloudflare Tunnel 嘅讀取權限。'))
    ],
    related: ['edge-http', 'tunnel-route', 'token-exposure'] },

  { id: 'tunnel-route', category: 'checks', icon: '🧭',
    title: { en: 'Tunnel route', zh: '隧道路由' },
    lead: L(
      { s: 'Checks that the tunnel has a public hostname rule that sends this hostname to a service.', f: 'Checks the tunnel knows about this hostname and where to send it.', p: 'Checks the tunnel actually has directions for this hostname, instead of shrugging.' },
      { s: '確認隧道有一條公開主機名稱規則，將呢個主機名稱指去一個服務。', f: '睇下條隧道識唔識呢個主機名稱，同要送去邊。', p: '睇下條隧道有冇呢個主機名稱嘅路線圖，定係淨係聳聳肩。' }),
    sections: [
      S('what', 'What it checks', '檢查啲乜', P(
        'Tunnel Doctor reads the tunnel configuration and looks for an ingress rule whose hostname matches. The rule\'s service (for example http://192.0.2.10:8123) is what the connector forwards requests to.',
        'Tunnel Doctor 讀取隧道設定，搵有冇一條主機名稱吻合嘅 ingress 規則。規則入面嘅服務（例如 http://192.0.2.10:8123）就係連接器轉發請求去嘅地方。')),
      S('results', 'What each result means', '各個結果代表乜', RES([
        ['route.ok', 'pass', 'A rule matches the hostname and names a service.', '有規則吻合主機名稱，而且指明咗服務。'],
        ['route.missing', 'fail', 'The tunnel is remotely managed but has no rule for this hostname, so the edge answers with an error. Offers "Add the route".', '隧道係遠端管理，但冇呢個主機名稱嘅規則，所以邊緣會回錯誤。會提供「新增路由」。'],
        ['route.locally-managed', 'warn', 'The tunnel is configured by a local config file, so Cloudflare does not hold its routes and the app cannot read or change them.', '隧道由本機設定檔管理，Cloudflare 冇保存路由，App 讀唔到亦改唔到。'],
        ['skip.no-tunnel', 'skip', 'No tunnel was identified, so the check did not run.', '搵唔到隧道，所以冇行。']])),
      S('manual', 'How to fix it by hand', '手動點修', OL(
        ['In the Cloudflare dashboard open Networks, then Tunnels, choose the tunnel, and open its public hostnames.', 'Add a public hostname with your hostname and the service URL of the app behind it.', 'For a locally managed tunnel, add the rule to the config file\'s ingress list (before the final catch-all rule) and restart cloudflared.'],
        ['喺 Cloudflare 控制台打開 Networks，再入 Tunnels，揀條隧道，打開公開主機名稱。', '新增一個公開主機名稱，填你嘅主機名稱同後面應用程式嘅服務網址。', '本機管理嘅隧道，就將規則加入設定檔嘅 ingress 清單（喺最尾嘅全收規則之前），再重啟 cloudflared。'])),
      S('app', 'How the app fixes it', 'App 點樣修', P(
        'The "Add the route" fix reads the current configuration, inserts one rule before the catch-all rule, and saves the whole previous configuration so the change can be undone.',
        '「新增路由」修復會讀取現時設定，喺全收規則之前插入一條規則，並保存成份舊設定，令修改可以還原。')),
      S('security', 'Security notes', '安全注意', P(TOKEN_NOTE_EN + ' Reading and the route fix need Cloudflare Tunnel read and edit access.', TOKEN_NOTE_ZH + '讀取同新增路由需要 Cloudflare Tunnel 嘅讀取同編輯權限。'))
    ],
    related: ['tunnel-health', 'add-route', 'origin'] },

  { id: 'edge-http', category: 'checks', icon: '🛰️',
    title: { en: 'Cloudflare edge response', zh: 'Cloudflare 邊緣回應' },
    lead: L(
      { s: 'Requests the hostname over HTTPS and interprets what the Cloudflare edge answers.', f: 'Visits your hostname the way a browser would and reads what the edge says back.', p: 'Knocks on your front door from the outside and listens to who answers.' },
      { s: '用 HTTPS 請求主機名稱，再解讀 Cloudflare 邊緣嘅回應。', f: '好似瀏覽器咁訪問你個主機名稱，睇下邊緣回咗啲乜。', p: '喺門外敲你道大門，聽下邊個應門。' }),
    sections: [
      S('what', 'What it checks', '檢查啲乜', P(
        'Tunnel Doctor makes an HTTPS request to https://<hostname>/ without following redirects, reads the status code, the server header, and any Cloudflare error code in the page, and classifies the result.',
        'Tunnel Doctor 向 https://<主機名稱>/ 發出 HTTPS 請求（唔跟隨重新導向），讀取狀態碼、server 標頭同頁面入面嘅 Cloudflare 錯誤碼，再分類。')),
      S('results', 'What each result means', '各個結果代表乜', RES([
        ['edge.ok', 'pass', 'The edge answered with a normal status.', '邊緣回應咗正常狀態。'],
        ['edge.1033', 'fail', 'Cloudflare error 1033: the tunnel connector is not running or not connected.', 'Cloudflare 錯誤 1033：隧道連接器冇行或者冇連線。'],
        ['edge.bad-gateway', 'fail', 'HTTP 502 or 530: the edge reached the tunnel but the origin did not answer correctly.', 'HTTP 502 或 530：邊緣連到隧道，但來源冇正確回應。'],
        ['edge.5xx', 'fail', 'Another server error from the edge or origin.', '邊緣或來源回咗其他伺服器錯誤。'],
        ['edge.400', 'fail', 'HTTP 400. For Home Assistant behind a proxy this usually means the trusted proxy settings are missing; see the Home Assistant article.', 'HTTP 400。Home Assistant 放喺代理後面，通常係冇設定信任代理；請睇 Home Assistant 嗰篇。'],
        ['edge.refused / unreachable / timeout / dns / tls / other', 'fail', 'The request itself failed: connection refused, network unreachable, timed out, the name did not resolve, a certificate problem, or something else. The evidence line has the raw reason.', '請求本身失敗：連線被拒、網絡到唔到、逾時、名稱解析唔到、憑證問題或者其他。證據一行有原始原因。']])),
      S('manual', 'How to fix it by hand', '手動點修', OL(
        ['Open the hostname in a browser, and in a private window, to rule out a cached answer.', 'Read the error code on the page. 1033 points at the connector; 502 and 530 point at the origin.', 'Work backwards: tunnel health, tunnel route, then origin.'],
        ['用瀏覽器同無痕視窗打開主機名稱，排除緩存答案。', '睇頁面上嘅錯誤碼。1033 指向連接器；502 同 530 指向來源。', '由後面倒推：隧道健康、隧道路由、再到來源。']),
        CMD('curl -sSI https://ha.example.com/')),
      S('app', 'How the app fixes it', 'App 點樣修', P(
        'The edge check has no fix of its own. It points to the check that explains the cause and the fix that goes with it.',
        '邊緣檢查本身冇修復。佢會指你去解釋成因嘅檢查同對應嘅修復。')),
      S('security', 'Security notes', '安全注意', P(
        'This check makes one ordinary request to your public hostname, the same as visiting it. It sends no token and no credentials.',
        '呢個檢查向你嘅公開主機名稱發出一個普通請求，等同訪問一次。唔會傳送權杖或者憑證。'))
    ],
    related: ['tunnel-health', 'origin', 'ha-proxy'] },

  { id: 'origin', category: 'checks', icon: '🏠',
    title: { en: 'Origin service', zh: '來源服務' },
    lead: L(
      { s: 'Requests the service behind the tunnel directly and tells refused, unreachable and timed-out apart.', f: 'Talks to the service behind the tunnel directly, and tells you whether it is off, unreachable or just slow.', p: 'Rings the service at home directly: is it off, out of range, or just ignoring you?' },
      { s: '直接請求隧道後面嘅服務，分辨被拒、到唔到同逾時。', f: '直接同隧道後面嘅服務講嘢，睇下係冇開、到唔到定係太慢。', p: '直接打俾屋企嗰個服務：係冇開機、搵唔到，定係懶得理你？' }),
    sections: [
      S('what', 'What it checks', '檢查啲乜', P(
        'Tunnel Doctor requests the origin URL, either one you entered or the service found in the tunnel route. This only works when the machine running Tunnel Doctor can reach the origin, which is why it is best run on the same network.',
        'Tunnel Doctor 請求來源網址，可以係你輸入嘅，或者由隧道路由搵到嘅服務。只有行 Tunnel Doctor 嘅機器連到來源先有用，所以最好喺同一個網絡行。')),
      S('results', 'What each result means', '各個結果代表乜', RES([
        ['origin.ok', 'pass', 'The origin answered with a status below 500.', '來源回應咗低於 500 嘅狀態。'],
        ['origin.5xx', 'fail', 'The origin answered with a server error. The application behind it is failing.', '來源回咗伺服器錯誤，後面嘅應用程式出問題。'],
        ['origin.refused', 'fail', 'Connection refused: the host is reachable but nothing listens on that port.', '連線被拒：主機連到，但個埠冇程式監聽。'],
        ['origin.unreachable', 'fail', 'No route to the host: wrong address, wrong network, or the machine is off.', '搵唔到去主機嘅路：地址錯、網絡錯，或者部機未開。'],
        ['origin.timeout', 'fail', 'No answer in time: a firewall dropping traffic, or an overloaded service.', '時間內冇回應：可能防火牆擋咗，或者服務太忙。'],
        ['skip.no-origin', 'skip', 'No origin URL was known, so the check did not run.', '唔知來源網址，所以冇行。']])),
      S('manual', 'How to fix it by hand', '手動點修', OL(
        ['From a machine on the same network as the connector, request the origin URL.', 'Refused means start the service or fix the port. Unreachable means fix the address or the network. Timeout means check firewalls.', 'Update the tunnel route if the address or port changed.'],
        ['喺連接器同一個網絡嘅機器，請求來源網址。', '被拒即係要開服務或者改正個埠。到唔到即係要改正地址或網絡。逾時就要查防火牆。', '如果地址或埠變咗，更新隧道路由。']),
        CMD('curl -sSI http://192.0.2.10:8123/')),
      S('app', 'How the app fixes it', 'App 點樣修', P(
        'No automatic fix: the origin is your own service. The app tells refused, unreachable and timeout apart so you know where to look.',
        '冇自動修復：來源係你自己嘅服務。App 會分清被拒、到唔到同逾時，等你知道睇邊度。')),
      S('security', 'Security notes', '安全注意', P(
        'The request goes from the machine running Tunnel Doctor to your origin and carries no credentials. Do not point it at an address you do not own.',
        '請求由行 Tunnel Doctor 嘅機器發去你嘅來源，唔帶任何憑證。唔好將佢指向你冇擁有嘅地址。'))
    ],
    related: ['tunnel-route', 'ha-proxy', 'edge-http'] },

  { id: 'ha-proxy', category: 'checks', icon: '🏡',
    title: { en: 'Home Assistant reverse proxy', zh: 'Home Assistant 反向代理' },
    lead: L(
      { s: 'Detects Home Assistant rejecting proxied requests and shows the exact settings that fix it.', f: 'If the origin is Home Assistant, checks whether it accepts requests that come through a proxy.', p: 'If the origin is Home Assistant, checks whether it is happy to meet visitors who arrive via a proxy.' },
      { s: '偵測 Home Assistant 拒絕代理請求，並顯示準確嘅修正設定。', f: '如果來源係 Home Assistant，睇下佢接唔接受經代理嚟嘅請求。', p: '如果來源係 Home Assistant，睇下佢肯唔肯見經代理嚟嘅訪客。' }),
    sections: [
      S('what', 'What it checks', '檢查啲乜', P(
        'When the origin\'s page title is Home Assistant, Tunnel Doctor sends a second request carrying X-Forwarded-For, X-Forwarded-Proto and X-Forwarded-Host headers, as a reverse proxy would. Home Assistant answers HTTP 400 to such a request when it has not been told to trust the proxy.',
        '當來源頁面標題係 Home Assistant，Tunnel Doctor 會再發一個請求，帶住 X-Forwarded-For、X-Forwarded-Proto 同 X-Forwarded-Host 標頭，就好似反向代理咁。如果 Home Assistant 未被設定信任代理，會回 HTTP 400。')),
      S('results', 'What each result means', '各個結果代表乜', RES([
        ['ha.ok', 'pass', 'Home Assistant accepts forwarded requests.', 'Home Assistant 接受轉發請求。'],
        ['ha.forwarded-rejected', 'fail', 'Home Assistant answers 400 to forwarded requests. Its HTTP settings do not trust the proxy.', 'Home Assistant 對轉發請求回 400，佢嘅 HTTP 設定冇信任代理。'],
        ['skip.not-ha', 'skip', 'The origin is not Home Assistant, so the check does not apply.', '來源唔係 Home Assistant，呢個檢查唔適用。'],
        ['skip.origin-down', 'skip', 'The origin did not answer, so this check could not run. Fix the origin first.', '來源冇回應，所以呢個檢查冇行。請先修好來源。'],
        ['skip.no-origin', 'skip', 'No origin URL was known.', '唔知來源網址。']])),
      S('manual', 'How to fix it by hand', '手動點修', OL(
        ['Edit Home Assistant\'s configuration.yaml and add the http section below. Use the address of the machine that runs cloudflared as the trusted proxy.', 'Restart Home Assistant, then run the check again.'],
        ['編輯 Home Assistant 嘅 configuration.yaml，加入下面嘅 http 設定。信任代理要填行 cloudflared 嗰部機嘅地址。', '重新啟動 Home Assistant，再行一次檢查。']),
        CMD('http:\n  use_x_forwarded_for: true\n  trusted_proxies:\n    - 192.0.2.5')),
      S('app', 'How the app fixes it', 'App 點樣修', P(
        'The app does not edit Home Assistant. It shows the settings above with your own values filled in, for you to paste.',
        'App 唔會改 Home Assistant。佢會顯示上面嘅設定，並填好你嘅數值，等你貼入去。')),
      S('security', 'Security notes', '安全注意', P(
        'Only trust the address of your own connector in trusted_proxies. A wide range such as a whole subnet lets any device in it claim to be someone else.',
        'trusted_proxies 只信任你自己連接器嘅地址。如果填成個網段咁闊，網段入面任何裝置都可以冒認其他人。'))
    ],
    related: ['origin', 'edge-http', 'run-docker'] },

  { id: 'ssl-mode', category: 'checks', icon: '🔒',
    title: { en: 'Zone SSL mode', zh: '區域 SSL 模式' },
    lead: L(
      { s: 'Reads the zone SSL mode and warns about settings that cause redirect loops or certificate errors.', f: 'Reads your zone\'s SSL mode and warns when it can cause redirect loops or error 525.', p: 'Peeks at your SSL mode and warns when it is about to send visitors round in circles.' },
      { s: '讀取區域 SSL 模式，並對會引致重新導向循環或憑證錯誤嘅設定發出警告。', f: '讀取你區域嘅 SSL 模式，如果可能引致重新導向循環或 525 錯誤就提醒你。', p: '偷睇你嘅 SSL 模式，如果會令訪客團團轉就出聲提醒。' }),
    sections: [
      S('what', 'What it checks', '檢查啲乜', P(
        'Tunnel Doctor reads the zone\'s SSL setting. A tunnel carries traffic to the origin on its own, but the zone SSL mode still affects redirects and certificate handling when an origin uses HTTPS.',
        'Tunnel Doctor 讀取區域嘅 SSL 設定。隧道自己會將流量帶去來源，但如果來源用 HTTPS，區域 SSL 模式仍然會影響重新導向同憑證處理。')),
      S('results', 'What each result means', '各個結果代表乜', RES([
        ['ssl.ok', 'pass', 'The SSL mode suits the origin.', 'SSL 模式配合來源。'],
        ['ssl.flexible-https-origin', 'warn', 'The mode is Flexible but the origin uses HTTPS. Cloudflare talks to the origin over HTTP, which commonly causes redirect loops.', '模式係 Flexible，但來源用 HTTPS。Cloudflare 用 HTTP 同來源溝通，常常引致重新導向循環。'],
        ['ssl.off', 'warn', 'The mode is Off. Visitors are not encrypted to Cloudflare.', '模式係 Off，訪客到 Cloudflare 之間冇加密。'],
        ['skip.no-token', 'skip', 'No API token was provided.', '冇提供 API 權杖。']])),
      S('manual', 'How to fix it by hand', '手動點修', OL(
        ['In the Cloudflare dashboard open SSL/TLS, then Overview for the zone.', 'Choose Full or Full (strict) when the origin serves HTTPS; keep the origin certificate valid for strict mode.'],
        ['喺 Cloudflare 控制台打開該區域嘅 SSL/TLS，再入 Overview。', '來源用 HTTPS 就揀 Full 或者 Full (strict)；用 strict 模式嘅話，來源憑證要有效。'])),
      S('app', 'How the app fixes it', 'App 點樣修', P(
        'No automatic fix: changing the SSL mode affects every hostname in the zone, which is too wide for a one-click change.',
        '冇自動修復：更改 SSL 模式會影響區域入面所有主機名稱，範圍太闊，唔適合一鍵修改。')),
      S('security', 'Security notes', '安全注意', P(TOKEN_NOTE_EN + ' This check needs read access to zone settings.', TOKEN_NOTE_ZH + '呢個檢查需要區域設定嘅讀取權限。'))
    ],
    related: ['edge-http', 'origin', 'zone-record'] },

  { id: 'local-cache', category: 'checks', icon: '💾',
    title: { en: 'This computer\'s DNS cache', zh: '本機 DNS 緩存' },
    lead: L(
      { s: 'Compares what this computer resolves with what public resolvers return.', f: 'Checks whether this computer remembers an old answer that differs from the public one.', p: 'Checks whether your computer is still living in the past with an old DNS answer.' },
      { s: '比較本機解析結果同公開解析器嘅結果。', f: '睇下呢部電腦有冇記住同公開答案唔同嘅舊答案。', p: '睇下你部電腦係咪仲活喺舊 DNS 答案嘅過去。' }),
    sections: [
      S('what', 'What it checks', '檢查啲乜', P(
        'The desktop app asks this computer\'s own resolver for the hostname and compares its addresses with the public answer. A mismatch means the local cache still holds an old answer. This is why a site can work on one device and not another.',
        '桌面版 App 向本機自己嘅解析器查詢主機名稱，再將地址同公開答案比較。唔一致代表本機緩存仲記住舊答案。呢個就係點解同一個網站喺一部裝置得、另一部唔得。')),
      S('results', 'What each result means', '各個結果代表乜', RES([
        ['local.ok', 'pass', 'This computer agrees with the public answer.', '本機同公開答案一致。'],
        ['local.stale', 'fail', 'This computer returns an address that the public resolvers do not. Offers "Flush the DNS cache".', '本機回傳公開解析器冇嘅地址。會提供「清除 DNS 緩存」。'],
        ['local.no-answer', 'warn', 'This computer could not resolve the name at all, and the public answer is empty too.', '本機完全解析唔到，而公開答案亦係空嘅。'],
        ['skip.desktop-only', 'skip', 'Only the desktop app can read this computer\'s resolver, so this form skipped the check.', '只有桌面版 App 先讀到本機解析器，所以呢個版本跳過咗。']])),
      S('manual', 'How to fix it by hand', '手動點修', OL(
        ['On Windows, open a terminal and clear the cache.', 'Reload the page. A browser keeps its own cache too; a private window avoids it.'],
        ['喺 Windows 開終端機，清除緩存。', '重新載入頁面。瀏覽器亦有自己嘅緩存；用無痕視窗可以避開。']),
        CMD('ipconfig /flushdns')),
      S('app', 'How the app fixes it', 'App 點樣修', P(
        'The "Flush the DNS cache" fix runs the same command for you after a preview. It only exists in the desktop app.',
        '「清除 DNS 緩存」修復會經預覽後幫你行同一條命令。只有桌面版 App 先有。')),
      S('security', 'Security notes', '安全注意', P(
        'Flushing the cache only forgets old answers; it changes no setting and removes no data. The check never leaves this computer except for the public queries.',
        '清除緩存只係忘記舊答案，唔會改任何設定亦唔會刪資料。除咗公開查詢，呢個檢查唔會離開呢部電腦。'))
    ],
    related: ['public-dns', 'flush-dns', 'run-desktop'] },

  { id: 'token-exposure', category: 'checks', icon: '🙈',
    title: { en: 'Tunnel token exposure', zh: '隧道權杖外洩風險' },
    lead: L(
      { s: 'Warns when a tunnel token is visible in a process command line.', f: 'Warns if your tunnel token can be read from a running process\'s command line.', p: 'Warns if your tunnel token is shouting its secret in the process list.' },
      { s: '當隧道權杖喺程序命令列可見時發出警告。', f: '如果隧道權杖喺執行緊嘅程序命令列睇到，就提醒你。', p: '如果隧道權杖喺程序清單入面大聲講晒秘密，就出聲警告。' }),
    sections: [
      S('what', 'What it checks', '檢查啲乜', P(
        'The desktop app lists running processes and looks for cloudflared started with --token on the command line. Other users and programs on the same machine can read command lines, so a token there is exposed. The token value is never displayed or stored; the evidence shows it redacted.',
        '桌面版 App 列出執行緊嘅程序，睇有冇 cloudflared 係用 --token 喺命令列啟動。同一部機嘅其他用戶同程式都睇到命令列，所以權杖放喺嗰度會外洩。權杖數值唔會顯示或者儲存；證據一行會遮住佢。')),
      S('results', 'What each result means', '各個結果代表乜', RES([
        ['token.ok', 'pass', 'No cloudflared process shows a token on its command line.', '冇 cloudflared 程序喺命令列顯示權杖。'],
        ['token.cmdline', 'warn', 'One or more cloudflared processes carry --token on the command line. The count and process ids are shown, never the token.', '一個或多個 cloudflared 程序喺命令列帶住 --token。會顯示數量同程序編號，唔會顯示權杖。'],
        ['skip.desktop-only', 'skip', 'Only the desktop app can list processes, so this form skipped the check.', '只有桌面版 App 先列到程序，所以呢個版本跳過咗。']])),
      S('manual', 'How to fix it by hand', '手動點修', OL(
        ['Store the token in the TUNNEL_TOKEN environment variable, or in a file the service account alone can read.', 'Start cloudflared without --token on the command line.', 'If the token may have been seen by others, rotate it in the Cloudflare dashboard and update the connector.'],
        ['將權杖放入 TUNNEL_TOKEN 環境變數，或者只有服務帳戶讀到嘅檔案。', '啟動 cloudflared 時，命令列唔好帶 --token。', '如果權杖可能俾其他人睇過，就喺 Cloudflare 控制台重新產生，並更新連接器。']),
        CMD('docker run -d --name cloudflared -e TUNNEL_TOKEN cloudflare/cloudflared:latest tunnel --no-autoupdate run')),
      S('app', 'How the app fixes it', 'App 點樣修', P(
        'No automatic fix: moving a token is a change to how your connector starts, which only you can do safely. The app explains the safer setup.',
        '冇自動修復：搬走權杖會改變連接器嘅啟動方式，只有你先安全做到。App 會解釋較安全嘅設定。')),
      S('security', 'Security notes', '安全注意', P(
        'The scan reads process names and command lines on this computer only. Nothing is sent anywhere, and tokens are redacted before they reach the result.',
        '掃描只讀取呢部電腦嘅程序名稱同命令列。冇嘢會傳出去，權杖喺入結果之前已經遮住。'))
    ],
    related: ['tunnel-health', 'run-desktop', 'troubleshooting'] },

  // ----------------------------------------------------------------- fixes
  { id: 'set-proxied', category: 'fixes', icon: '🟠',
    title: { en: 'Fix: turn on the proxy', zh: '修復：開啟代理' },
    lead: L(
      { s: 'Sets proxied to true on one DNS record so the hostname answers with Cloudflare addresses.', f: 'Switches the proxy on for one DNS record, so visitors get a Cloudflare address.', p: 'Flips the orange cloud on for one record. One flip, fully undoable.' },
      { s: '將一條 DNS 記錄嘅 proxied 設為 true，令主機名稱回傳 Cloudflare 地址。', f: '為一條 DNS 記錄開啟代理，訪客就會攞到 Cloudflare 地址。', p: '為一條記錄開返橙色雲。撥一下，隨時還原。' }),
    sections: [
      S('what', 'What it changes', '改啲乜', P(
        'It sends one request, PATCH /zones/<zone>/dns_records/<record>, that sets proxied to true on the record you chose. Nothing else on the record changes.',
        '佢發出一個請求 PATCH /zones/<zone>/dns_records/<record>，將你揀嘅記錄 proxied 設為 true。記錄其他部分唔會改。')),
      S('preview', 'Preview and confirmation', '預覽同確認', UL(
        ['The preview shows the record name and proxied changing from false to true.', 'You must tick that you understand the change, and type the record name.', 'Only then does the app send the request.'],
        ['預覽顯示記錄名稱，同 proxied 由 false 變 true。', '你要剔選明白呢個改動，並輸入記錄名稱。', '之後 App 先會發出請求。'])),
      S('undo', 'Undo', '還原', P(
        'The app records the previous proxied value. Undo from the history list puts it back.',
        'App 會記低之前 proxied 嘅數值。喺歷史清單按還原就會放返原樣。')),
      S('manual', 'The same change by hand', '手動做同一個改動', P(
        'In the Cloudflare dashboard open DNS, then Records, edit the record and switch Proxy status on.',
        '喺 Cloudflare 控制台打開 DNS，再入 Records，編輯該記錄，將代理狀態開咗。')),
      S('security', 'Security notes', '安全注意', P(
        'Needs a token with DNS edit access for that zone. Turning the proxy on hides the origin address behind Cloudflare, which is normally what you want for a tunnel.',
        '需要有該區域 DNS 編輯權限嘅權杖。開啟代理會將來源地址收埋喺 Cloudflare 後面，隧道通常正正需要咁。'))
    ],
    related: ['public-dns', 'zone-record', 'create-record'] },

  { id: 'create-record', category: 'fixes', icon: '➕',
    title: { en: 'Fix: create the record', zh: '修復：建立記錄' },
    lead: L(
      { s: 'Creates a proxied CNAME from the hostname to the tunnel.', f: 'Creates the missing DNS record that points your hostname at the tunnel.', p: 'Writes the missing line in the phone book so your hostname finally has an address.' },
      { s: '建立一條由主機名稱指去隧道、有開代理嘅 CNAME。', f: '建立缺少嘅 DNS 記錄，將你嘅主機名稱指去隧道。', p: '喺電話簿補返缺失嗰一行，等你個主機名稱終於有地址。' }),
    sections: [
      S('what', 'What it changes', '改啲乜', P(
        'It sends POST /zones/<zone>/dns_records with a CNAME named after your hostname, pointing at <tunnel-id>.cfargotunnel.com, with the proxy on, automatic TTL and the comment "Created by Tunnel Doctor".',
        '佢發出 POST /zones/<zone>/dns_records，建立一條以你主機名稱命名嘅 CNAME，指去 <tunnel-id>.cfargotunnel.com，開代理、自動 TTL，備註係「Created by Tunnel Doctor」。')),
      S('preview', 'Preview and confirmation', '預覽同確認', UL(
        ['The preview lists the four fields that will be created: type, name, content and proxied.', 'You must tick that you understand, and type the hostname.'],
        ['預覽會列出將要建立嘅四個欄位：類型、名稱、內容同代理。', '你要剔選明白，並輸入主機名稱。'])),
      S('undo', 'Undo', '還原', P(
        'The app records the new record\'s id. Undo deletes exactly that record and nothing else.',
        'App 會記低新記錄嘅編號。還原只會刪除呢條記錄，其他嘢都唔會郁。')),
      S('manual', 'The same change by hand', '手動做同一個改動', P(
        'In the Cloudflare dashboard open DNS, then Records, add a CNAME with the hostname as name and <tunnel-id>.cfargotunnel.com as target, and leave Proxy status on.',
        '喺 Cloudflare 控制台打開 DNS，再入 Records，新增一條 CNAME，名稱填主機名稱，目標填 <tunnel-id>.cfargotunnel.com，代理狀態保持開啟。')),
      S('security', 'Security notes', '安全注意', P(
        'Needs a token with DNS edit access. The app refuses to create a record when the hostname already has one.',
        '需要有 DNS 編輯權限嘅權杖。如果主機名稱已經有記錄，App 會拒絕再建立。'))
    ],
    related: ['zone-record', 'public-dns', 'add-route'] },

  { id: 'add-route', category: 'fixes', icon: '🛤️',
    title: { en: 'Fix: add the tunnel route', zh: '修復：新增隧道路由' },
    lead: L(
      { s: 'Adds one public hostname rule to a remotely managed tunnel.', f: 'Adds a rule so the tunnel knows where to send your hostname.', p: 'Draws the missing arrow from your hostname to your service on the tunnel\'s map.' },
      { s: '為遠端管理嘅隧道新增一條公開主機名稱規則。', f: '新增一條規則，令隧道知道將你嘅主機名稱送去邊。', p: '喺隧道地圖上補返由你主機名稱指去服務嗰支箭咀。' }),
    sections: [
      S('what', 'What it changes', '改啲乜', P(
        'It reads the tunnel configuration, inserts one ingress rule for the hostname before the final catch-all rule (adding a catch-all returning 404 if there is none), and writes the configuration back with PUT /accounts/<account>/cfd_tunnel/<tunnel>/configurations. If a rule for the hostname already exists, it stops.',
        '佢讀取隧道設定，喺最尾嘅全收規則之前插入一條主機名稱 ingress 規則（如果冇全收規則就加一條回 404 嘅），再用 PUT /accounts/<account>/cfd_tunnel/<tunnel>/configurations 寫返。如果該主機名稱已經有規則，就會停低。')),
      S('preview', 'Preview and confirmation', '預覽同確認', UL(
        ['The preview shows the number of ingress rules before and after, and the new rule\'s hostname and service.', 'You must tick that you understand, and type the hostname.'],
        ['預覽顯示前後嘅 ingress 規則數量，同新規則嘅主機名稱同服務。', '你要剔選明白，並輸入主機名稱。'])),
      S('undo', 'Undo', '還原', P(
        'The app saves the whole previous configuration. Undo writes it back unchanged.',
        'App 會保存成份舊設定。還原會原封不動寫返。')),
      S('manual', 'The same change by hand', '手動做同一個改動', P(
        'In the Cloudflare dashboard open Networks, then Tunnels, choose the tunnel and add a public hostname with your hostname and the service URL.',
        '喺 Cloudflare 控制台打開 Networks，再入 Tunnels，揀條隧道，新增一個公開主機名稱，填你嘅主機名稱同服務網址。')),
      S('security', 'Security notes', '安全注意', P(
        'Needs a token with Cloudflare Tunnel edit access. A wrong rule can send a hostname to the wrong service, which is why the preview and the typed confirmation exist.',
        '需要有 Cloudflare Tunnel 編輯權限嘅權杖。錯嘅規則可能將主機名稱送去錯嘅服務，所以先有預覽同輸入確認。'))
    ],
    related: ['tunnel-route', 'create-record', 'origin'] },

  { id: 'flush-dns', category: 'fixes', icon: '🧽',
    title: { en: 'Fix: flush the DNS cache', zh: '修復：清除 DNS 緩存' },
    lead: L(
      { s: 'Clears this computer\'s DNS resolver cache. Desktop app only.', f: 'Makes this computer forget old DNS answers. Desktop app only.', p: 'Gives this computer a gentle bump on the head so it forgets old DNS answers. Desktop app only.' },
      { s: '清除本機 DNS 解析器緩存。只限桌面版 App。', f: '令呢部電腦忘記舊嘅 DNS 答案。只限桌面版 App。', p: '輕輕拍一下部電腦個頭，等佢忘記舊 DNS 答案。只限桌面版 App。' }),
    sections: [
      S('what', 'What it changes', '改啲乜', P(
        'It runs ipconfig /flushdns on this computer. The DNS client cache goes from holding entries to empty; the entries come back as the computer asks again.',
        '佢喺呢部電腦行 ipconfig /flushdns。DNS 客戶端緩存由有紀錄變成空；電腦再查詢時紀錄會慢慢返嚟。'), CMD('ipconfig /flushdns')),
      S('preview', 'Preview and confirmation', '預覽同確認', P(
        'The preview shows the command and the before and after state. Because it affects only this computer and loses nothing, it needs the acknowledgement but no typed confirmation.',
        '預覽會顯示命令同前後狀態。因為只影響呢部電腦而且唔會失去嘢，所以只需要剔選明白，唔使輸入確認。')),
      S('undo', 'Undo', '還原', P(
        'There is nothing to restore: the cache refills by itself. The history list records that the fix ran.',
        '冇嘢需要還原：緩存會自己重新填返。歷史清單會記低呢個修復有行過。')),
      S('security', 'Security notes', '安全注意', P(
        'Only the desktop app can run it; the web app and appliance forms refuse, because a server flushing its own cache would not help your computer.',
        '只有桌面版 App 行到；網頁版同專用系統映像會拒絕，因為伺服器清自己嘅緩存對你部電腦冇幫助。'))
    ],
    related: ['local-cache', 'run-desktop', 'public-dns'] },

  // ------------------------------------------------------------------- run
  { id: 'run-desktop', category: 'run', icon: '🖥️',
    title: { en: 'Run the desktop app', zh: '運行桌面版 App' },
    lead: L(
      { s: 'The Windows desktop app runs every check, including this computer\'s DNS cache and process scan.', f: 'The desktop app is the full version: every check, including the ones that look at this computer.', p: 'The desktop app is the full-fat version: it can even look at the computer it lives on.' },
      { s: 'Windows 桌面版 App 行晒所有檢查，包括本機 DNS 緩存同程序掃描。', f: '桌面版係完整版：所有檢查都有，包括睇本機嘅檢查。', p: '桌面版係全餐：連佢自己住緊嗰部電腦都睇得到。' }),
    sections: [
      S('what', 'What you get', '你會得到啲乜', UL(
        ['All ten checks, including the local DNS cache check and the token exposure scan.', 'All four fixes, including flushing the DNS cache.', 'Your API token stays on this computer, stored encrypted by the operating system.'],
        ['全部十個檢查，包括本機 DNS 緩存檢查同權杖外洩掃描。', '全部四個修復，包括清除 DNS 緩存。', '你嘅 API 權杖留喺呢部電腦，由作業系統加密保存。'])),
      S('install', 'Install', '安裝', OL(
        ['Download the Windows installer from the download section on the home page.', 'Run it. The installer is not code-signed, so Windows shows an unknown-publisher warning the first time; choose to run it anyway only if you downloaded it from this project\'s releases page.', 'Open Tunnel Doctor from the Start menu. A setup wizard asks for the API token and a first hostname.'],
        ['喺主頁嘅下載部分下載 Windows 安裝程式。', '執行佢。安裝程式冇做程式碼簽署，所以 Windows 第一次會顯示「未知發行者」警告；只有喺本專案發佈頁下載嘅先好揀仍然執行。', '由開始功能表打開 Tunnel Doctor。設定精靈會問 API 權杖同第一個主機名稱。'])),
      S('security', 'Security notes', '安全注意', P(
        'The installer being unsigned means Windows cannot confirm who published it. Download only from the official releases page, and compare it with what the release page lists.',
        '安裝程式未簽署，代表 Windows 確認唔到發佈者係邊個。只可以喺官方發佈頁下載，並同發佈頁列出嘅資料核對。'))
    ],
    related: ['run-docker', 'run-appliance', 'local-cache'] },

  { id: 'run-docker', category: 'run', icon: '🐳',
    title: { en: 'Run the Docker-hosted web app', zh: '運行 Docker 網頁版' },
    lead: L(
      { s: 'A web app in a Docker container, reachable from any browser on your network.', f: 'Runs in a container on a computer that is always on, and you open it from any browser on your network.', p: 'Lives in a container on the always-on box, and waves at every browser on your network.' },
      { s: '放喺 Docker 容器入面嘅網頁版，網絡上任何瀏覽器都連到。', f: '喺長開嘅電腦用容器行，你用網絡上任何瀏覽器就開到。', p: '住喺長開嗰部機嘅容器入面，向網絡上每個瀏覽器揮手。' }),
    sections: [
      S('what', 'What you get', '你會得到啲乜', UL(
        ['The same interface as the desktop app, with the same checks that do not need this computer\'s own resolver.', 'The local DNS cache check, the process scan and the DNS flush fix are skipped and say so.', 'Sign-in with a password you create the first time you open it.'],
        ['同桌面版一樣嘅介面，同樣嘅檢查，唔使用本機解析器嗰啲。', '本機 DNS 緩存檢查、程序掃描同清除 DNS 修復會跳過，並會註明。', '用你第一次打開時建立嘅密碼登入。'])),
      S('start', 'Start it', '啟動', P(
        'Use the published image and the Compose file in the repository, then open the address the host script prints for your network.',
        '用已發佈嘅映像同儲存庫入面嘅 Compose 檔案，再打開主機腳本為你網絡顯示嘅地址。'),
        CMD('docker compose up -d')),
      S('security', 'Security notes', '安全注意', UL(
        ['It binds to your local network and is not meant to be exposed to the Internet.', 'The API token is stored encrypted at rest under a key derived from a server secret kept outside the data volume.', 'State-changing requests need a custom header a cross-site form cannot send, and sign-in attempts are rate limited.'],
        ['佢綁定你嘅區域網絡，唔係設計來暴露喺互聯網。', 'API 權杖加密保存，密鑰源自一個放喺資料卷以外嘅伺服器秘密。', '更改狀態嘅請求需要跨站表單送唔到嘅自訂標頭，而登入嘗試有次數限制。']))
    ],
    related: ['http-api', 'run-desktop', 'run-appliance'] },

  { id: 'run-appliance', category: 'run', icon: '📀',
    title: { en: 'Run the appliance image', zh: '運行專用系統映像' },
    lead: L(
      { s: 'A small operating system image that boots straight into Tunnel Doctor.', f: 'A tiny dedicated system for a small machine or virtual machine that starts Tunnel Doctor when it boots.', p: 'A tiny system whose entire personality is Tunnel Doctor. Boot it and walk away.' },
      { s: '一個開機後直接進入 Tunnel Doctor 嘅細型作業系統映像。', f: '一個專用嘅細型系統，用喺細機或者虛擬機，開機就行 Tunnel Doctor。', p: '一個成個性格都係 Tunnel Doctor 嘅細系統。開機，然後可以走開。' }),
    sections: [
      S('what', 'What you get', '你會得到啲乜', UL(
        ['The same hosted web app as the Docker form, on a machine that does nothing else.', 'It is meant for a spare machine or a virtual machine on your network.'],
        ['同 Docker 版一樣嘅網頁版，但部機專用，冇其他用途。', '設計畀網絡上嘅閒置機器或者虛擬機用。'])),
      S('status', 'Status', '狀態', P(
        'The appliance image is in progress and has not been released. This page will describe how to write it to a disk or import it into a virtual machine when a release exists.',
        '專用系統映像仍然開發中，未發佈。有正式發佈之後，呢頁會說明點樣寫入磁碟或者匯入虛擬機。')),
      S('security', 'Security notes', '安全注意', P(
        'Like the Docker form, it belongs on your local network only. Do not forward a port from the Internet to it.',
        '同 Docker 版一樣，只應該放喺你嘅區域網絡。唔好由互聯網轉發埠去佢。'))
    ],
    related: ['run-docker', 'run-desktop', 'http-api'] },

  // ------------------------------------------------------------- reference
  { id: 'http-api', category: 'reference', icon: '🔌',
    title: { en: 'HTTP API', zh: 'HTTP API' },
    lead: L(
      { s: 'The routes the Docker-hosted web app and the appliance image expose.', f: 'The routes behind the hosted forms, for the curious and for scripts.', p: 'The doors behind the hosted forms. Knock politely, with the right header.' },
      { s: 'Docker 網頁版同專用系統映像提供嘅路由。', f: '網頁版背後嘅路由，畀好奇嘅人同腳本用。', p: '網頁版背後嘅門。有禮貌咁敲門，記得帶啱標頭。' }),
    sections: [
      S('overview', 'Overview', '概覽', P(
        'The hosted forms expose the shared service over HTTP. All routes are under /api, take and return JSON, and require a signed-in session cookie, except GET /api/health, GET /api/auth/state, POST /api/auth/setup (only while no password exists) and POST /api/auth/login. The desktop app uses the same operations over IPC with the same names.',
        '網頁版透過 HTTP 提供共用服務。所有路由都喺 /api 之下，收發 JSON，並需要已登入嘅會話 cookie，除咗 GET /api/health、GET /api/auth/state、POST /api/auth/setup（只限未有密碼時）同 POST /api/auth/login。桌面版用同名稱嘅操作，經 IPC 傳送。')),
      S('routes', 'Routes', '路由', RES([
        ['GET /api/health', 'info', 'Returns { ok: true, version }.', '回傳 { ok: true, version }。'],
        ['GET /api/auth/state', 'info', 'Returns { configured, signedIn }.', '回傳 { configured, signedIn }。'],
        ['POST /api/auth/setup', 'info', 'Body { password }. Creates the first password and signs in.', '內容 { password }。建立第一個密碼並登入。'],
        ['POST /api/auth/login', 'info', 'Body { password }. Signs in.', '內容 { password }。登入。'],
        ['POST /api/auth/logout', 'info', 'Signs out.', '登出。'],
        ['GET /api/capabilities', 'info', 'Returns what this form can do.', '回傳呢個版本做到啲乜。'],
        ['GET, PATCH /api/settings', 'info', 'Reads, or partially updates, the settings.', '讀取或者局部更新設定。'],
        ['POST /api/settings/reset', 'info', 'Body { keys? }. Resets some or all settings.', '內容 { keys? }。重設部分或者全部設定。'],
        ['GET, PUT, DELETE /api/token', 'info', 'Reports, saves or clears the API token. The token is never returned.', '查看、保存或者清除 API 權杖。權杖永遠唔會回傳。'],
        ['GET /api/zones', 'info', 'Lists the zones the token can see.', '列出權杖睇到嘅區域。'],
        ['POST /api/checks', 'info', 'Body { hostname, originUrl? }. Runs the checks and returns a report.', '內容 { hostname, originUrl? }。執行檢查並回傳報告。'],
        ['GET /api/checks/last', 'info', 'Returns the last report, or null.', '回傳最近一份報告，或者 null。'],
        ['POST /api/fixes/plan', 'info', 'Body { fixId, params }. Returns a preview.', '內容 { fixId, params }。回傳預覽。'],
        ['POST /api/fixes/apply', 'info', 'Body { fixId, params, confirmation: { acknowledged, typed } }. Applies the fix.', '內容 { fixId, params, confirmation: { acknowledged, typed } }。執行修復。'],
        ['POST /api/fixes/undo', 'info', 'Body { historyId }. Undoes a fix.', '內容 { historyId }。還原一個修復。'],
        ['GET /api/history', 'info', 'Lists applied fixes and their undo state.', '列出已執行嘅修復同還原狀態。']])),
      S('errors', 'Errors', '錯誤', P(
        'Errors return { "error": "<message>" } with status 400 for invalid input, 401 when signed out, 403 for a missing CSRF header, and 502 when Cloudflare refuses a call.',
        '錯誤會回傳 { "error": "<訊息>" }：輸入無效係 400，未登入係 401，缺少 CSRF 標頭係 403，Cloudflare 拒絕呼叫就係 502。')),
      S('security', 'Security notes', '安全注意', UL(
        ['The API token is never returned by any route.', 'Every state-changing request needs the header x-tunnel-doctor: 1, which a cross-site form cannot send.', 'Passwords are hashed with scrypt, and sign-in attempts are rate limited.', 'The service binds to the LAN and is not meant to be exposed to the Internet.'],
        ['冇任何路由會回傳 API 權杖。', '每個更改狀態嘅請求都需要標頭 x-tunnel-doctor: 1，跨站表單送唔到。', '密碼用 scrypt 雜湊，登入嘗試有次數限制。', '服務綁定區域網絡，唔係設計來暴露喺互聯網。'])),
      S('example', 'Example', '例子', CMD('curl -sS -X POST http://192.0.2.20:8080/api/checks \\\n  -H "content-type: application/json" \\\n  -H "x-tunnel-doctor: 1" \\\n  -b cookies.txt \\\n  -d \'{"hostname":"ha.example.com"}\''))
    ],
    related: ['run-docker', 'run-appliance', 'troubleshooting'] },

  { id: 'troubleshooting', category: 'reference', icon: '🧯',
    title: { en: 'Troubleshooting', zh: '排解問題' },
    lead: L(
      { s: 'What to do when Tunnel Doctor itself reports something unexpected.', f: 'What to do when Tunnel Doctor itself gives you a surprise.', p: 'Even doctors need a doctor sometimes. Start here.' },
      { s: 'Tunnel Doctor 本身回報異常時嘅處理方法。', f: 'Tunnel Doctor 自己出意外時點算。', p: '醫生有時都要睇醫生。由呢度開始。' }),
    sections: [
      S('skipped', 'A check says it was skipped', '某個檢查顯示跳過咗', UL(
        ['skip.no-token: add an API token in Settings. Without one, only the public checks run.', 'skip.no-tunnel: the tunnel could not be identified; pick it manually or check the token can read tunnels.', 'skip.no-origin: enter the origin URL, or add the tunnel route first.', 'skip.desktop-only: the web app and appliance cannot read this computer; use the desktop app for those checks.'],
        ['skip.no-token：喺設定加入 API 權杖。冇權杖就只會行公開檢查。', 'skip.no-tunnel：認唔到隧道；手動揀，或者確認權杖讀到隧道。', 'skip.no-origin：輸入來源網址，或者先新增隧道路由。', 'skip.desktop-only：網頁版同專用系統映像讀唔到呢部電腦；呢啲檢查請用桌面版。'])),
      S('token', 'The token is rejected', '權杖被拒絕', P(
        'A 502 from the API means Cloudflare refused a call, usually because the token is missing a permission or has expired. Create a new token with the permissions listed in each check\'s security notes.',
        'API 回 502 代表 Cloudflare 拒絕咗一個呼叫，通常係權杖欠缺權限或者過期。請按各個檢查嘅安全注意，建立有齊權限嘅新權杖。')),
      S('fixfail', 'A fix will not apply', '修復套用唔到', UL(
        ['"Confirm that you understand the change first": tick the acknowledgement box.', '"The typed confirmation does not match": type the exact record or hostname shown in the preview.', '"The DNS record no longer exists": run the checks again; the zone changed since the preview.', '"This fix needs a Cloudflare API token": add one in Settings.'],
        ['「Confirm that you understand the change first」：剔選明白嘅方格。', '「The typed confirmation does not match」：輸入預覽顯示嘅準確記錄或主機名稱。', '「The DNS record no longer exists」：重新行檢查；預覽之後區域已經變咗。', '「This fix needs a Cloudflare API token」：喺設定加入權杖。'])),
      S('web', 'The hosted app does not load', '網頁版打唔開', OL(
        ['Check the container is running and its port is published.', 'Open the address from a machine on the same network, not from outside it.', 'Read the container log for the start-up error.'],
        ['確認容器有行，而且埠有發佈。', '用同一個網絡嘅機器打開地址，唔好由外面。', '睇容器日誌嘅啟動錯誤。']),
        CMD('docker compose logs --tail 50')),
      S('report', 'Report a problem', '回報問題', P(
        'Open an issue on the project\'s GitHub page. Include the check result codes and evidence lines. Never include your API token or a tunnel token.',
        '喺專案嘅 GitHub 頁面開一個 issue。請附上檢查結果代碼同證據行。千祈唔好附上 API 權杖或者隧道權杖。'))
    ],
    related: ['http-api', 'token-exposure', 'run-desktop'] }
];

export const SETTINGS_ENTRIES = [
  { id: 'theme', en: 'Theme', zh: '主題' },
  { id: 'accent', en: 'Accent colour', zh: '強調色' },
  { id: 'textsize', en: 'Text size', zh: '文字大小' },
  { id: 'motion', en: 'Reduced motion', zh: '減少動態' },
  { id: 'lang', en: 'Language', zh: '語言' },
  { id: 'fun-en', en: 'English funny level', zh: '英文趣味程度' },
  { id: 'fun-zh', en: 'Cantonese funny level', zh: '粵語趣味程度' },
  { id: 'emoji', en: 'Emoji', zh: '表情符號' },
  { id: 'reset-all', en: 'Reset all settings', zh: '重設所有設定' }
];

// Interface strings. A string is either a plain string or {s,f,p} (tone variants).
export const UI = {
  en: {
    siteName: 'Tunnel Doctor',
    skip: 'Skip to content',
    menu: 'Menu', navFeatures: 'Features', navDocs: 'Documentation', navDownload: 'Download', navSettings: 'Site settings',
    searchLabel: 'Search the documentation', searchPh: 'Search articles, result codes, commands',
    heroTitle: { s: 'Find out why your tunnel hostname is down, then fix it.', f: 'Find out why your tunnel hostname is down, then fix it.', p: 'Find out why your tunnel hostname is down, then fix it before dinner gets cold.' },
    heroText: { s: 'Tunnel Doctor checks public DNS, your Cloudflare zone, the tunnel route and the service behind it, names the one thing that is wrong, and offers a fix you preview and confirm before anything changes.', f: 'Tunnel Doctor checks the whole path a visitor takes, tells you the one thing that is wrong, and offers a fix you preview and confirm before anything changes.', p: 'Tunnel Doctor walks the whole path a visitor takes, points at the one thing that is broken, and offers a fix you preview and confirm before anything changes. No surprises, no surgery without consent.' },
    ctaDownload: 'Download', ctaDocs: 'Read the documentation',
    notApp: 'This site describes and downloads the app. It is not the app itself.',
    illustration: 'Illustration. It is not a screenshot of the real app.',
    illusTitle: 'Public DNS answer · Fail', illusFix: 'Turn on the proxy for this record.', illusBtn: 'Preview fix',
    featuresTitle: 'What it checks and fixes', readArticle: 'Read the article',
    fixesTitle: 'Fixes you can preview and undo',
    runTitle: 'Three ways to run it',
    downloadTitle: 'Download',
    downloadText: 'Windows 10 and 11, 64-bit. The installer is not code-signed, so Windows shows an unknown-publisher warning the first time.',
    downloadNone: 'No release has been published yet. The button below opens the releases page, which shows any release as soon as one exists.',
    downloadBtn: 'Open the releases page',
    version: 'Version', updated: 'Last updated', unavailable: 'unavailable',
    docsTitle: 'Documentation', docsIntro: 'Every article is here on the site, written for the whole path from symptom to fix.',
    articles: 'articles', related: 'Related articles', backToDocs: 'All documentation',
    resultCode: 'Result code', status: 'Status', meaning: 'Meaning',
    searchTitle: 'Search', noResults: 'No articles match.', results: 'results', resultsLimited: 'Showing the first',
    modeText: 'Plain text', modeRegex: 'Regular expression', mode: 'Search mode',
    pattern: 'Pattern', flags: 'Flags', tokens: 'Insert a token', explain: 'What the pattern means', testText: 'Test text', matches: 'Matches', groups: 'Capture groups',
    group: 'Group', value: 'Value', match: 'Match', noMatches: 'No matches.', emptyPattern: 'Type a pattern to see its explanation.',
    invalid: 'Invalid pattern', timeout: 'The search was stopped after taking too long.', engineNote: 'This builder uses your browser\'s JavaScript regular expression engine. Syntax such as lookbehind and named groups depends on the browser; other engines may differ.',
    limits: 'Limits: each article is searched up to 20,000 characters, up to 5 matches are listed per article, up to 200 matches are shown in the test text, and a search that runs longer than 1.5 seconds is stopped.',
    flagI: 'Ignore case', flagM: 'Multiline', flagS: 'Dot matches newline', flagU: 'Unicode',
    settingsTitle: 'Site settings', settingsIntro: 'These settings are stored in this browser only.',
    theme: 'Theme', themeSystem: 'Follow the system', themeLight: 'Light', themeDark: 'Dark',
    accent: 'Accent colour', contrastWhite: 'Contrast with button text', contrastBg: 'Contrast of links with the page', pass: 'passes 4.5:1', fail: 'below 4.5:1, a readable shade is used',
    textSize: 'Text size', motion: 'Motion', motionSystem: 'Follow the system', motionReduce: 'Reduce motion', motionAllow: 'Allow motion',
    language: 'Language', langEn: 'English', langZh: 'Cantonese', langBoth: 'Both',
    funEn: 'English funny level', funZh: 'Cantonese funny level', funNote: 'Changes the tone of introductions and headlines only. Facts, commands and error text are the same at every level.',
    emoji: 'Show emoji', on: 'On', off: 'Off', reset: 'Reset', resetAll: 'Reset all settings', resetDone: 'Reset.',
    palette: 'Command palette', paletteHint: 'Type to filter. Up and Down choose, Enter opens, Escape closes.', paletteOpen: 'Open the command palette (Ctrl+Shift+F)', paletteNone: 'Nothing matches.', paletteOpenBuilder: 'Open the full regex builder',
    article: 'Article', setting: 'Setting', page: 'Page', category: 'Category', close: 'Close',
    notFoundTitle: 'Page not found', notFoundText: 'That page does not exist.', goHome: 'Go to the home page',
    footer: 'Not affiliated with Cloudflare or Home Assistant. MIT licence.',
    sample: 'ha.example.com CNAME abcd1234.cfargotunnel.com\nAAAA fd10:aec2:5dae::\nHTTP 502 Bad Gateway\nerror code: 1033',
    levelWord: 'Level'
  },
  zh: {
    siteName: 'Tunnel Doctor',
    skip: '跳到內容',
    menu: '選單', navFeatures: '功能', navDocs: '說明文件', navDownload: '下載', navSettings: '網站設定',
    searchLabel: '搜尋說明文件', searchPh: '搜尋文章、結果代碼、命令',
    heroTitle: { s: '搵出你嘅隧道主機名稱點解連唔到，再修好佢。', f: '搵出你嘅隧道主機名稱點解連唔到，再修好佢。', p: '搵出你嘅隧道主機名稱點解連唔到，趕及夠鐘食飯前修好佢。' },
    heroText: { s: 'Tunnel Doctor 檢查公開 DNS、你嘅 Cloudflare 區域、隧道路由同後面嘅服務，指出唯一出問題嘅地方，並提供一個修復，改動之前一定俾你預覽同確認。', f: 'Tunnel Doctor 檢查訪客行過嘅成條路，話你知邊度出問題，再提供一個修復，改動之前一定俾你預覽同確認。', p: 'Tunnel Doctor 幫你行晒訪客嗰條路，指住唔妥嗰度，再提供一個修復，改動之前一定俾你預覽同確認。冇驚喜，冇你點頭都唔會郁刀。' },
    ctaDownload: '下載', ctaDocs: '睇說明文件',
    notApp: '呢個網站係介紹同提供下載，本身唔係個 App。',
    illustration: '示意圖，唔係真實 App 嘅截圖。',
    illusTitle: '公開 DNS 回應 · 失敗', illusFix: '為呢條記錄開啟代理。', illusBtn: '預覽修復',
    featuresTitle: '檢查同修復啲乜', readArticle: '睇文章',
    fixesTitle: '可以預覽、可以還原嘅修復',
    runTitle: '三種運行方式',
    downloadTitle: '下載',
    downloadText: '適用於 Windows 10 同 11（64 位元）。安裝程式冇做程式碼簽署，所以 Windows 第一次會顯示「未知發行者」警告。',
    downloadNone: '暫時未有發佈任何版本。下面個掣會打開發佈頁，一有版本就會喺嗰度睇到。',
    downloadBtn: '打開發佈頁',
    version: '版本', updated: '最後更新', unavailable: '未能取得',
    docsTitle: '說明文件', docsIntro: '所有文章都喺呢個網站入面，由徵狀到修復成條路都寫齊。',
    articles: '篇文章', related: '相關文章', backToDocs: '所有說明文件',
    resultCode: '結果代碼', status: '狀態', meaning: '意思',
    searchTitle: '搜尋', noResults: '冇文章吻合。', results: '個結果', resultsLimited: '只顯示頭',
    modeText: '純文字', modeRegex: '正規表示式', mode: '搜尋模式',
    pattern: '模式', flags: '旗標', tokens: '插入符號', explain: '模式嘅意思', testText: '測試文字', matches: '吻合', groups: '擷取群組',
    group: '群組', value: '內容', match: '吻合', noMatches: '冇吻合。', emptyPattern: '輸入模式就會見到解釋。',
    invalid: '模式無效', timeout: '搜尋用咗太長時間，已經停止。', engineNote: '呢個建構器用你瀏覽器嘅 JavaScript 正規表示式引擎。後行斷言同具名群組等語法視乎瀏覽器；其他引擎可能唔同。',
    limits: '限制：每篇文章最多搜尋 20,000 個字元，每篇最多列出 5 個吻合，測試文字最多顯示 200 個吻合，搜尋超過 1.5 秒就會停止。',
    flagI: '忽略大細楷', flagM: '多行', flagS: '點號包括換行', flagU: 'Unicode',
    settingsTitle: '網站設定', settingsIntro: '呢啲設定只會儲存喺呢個瀏覽器。',
    theme: '主題', themeSystem: '跟隨系統', themeLight: '淺色', themeDark: '深色',
    accent: '強調色', contrastWhite: '同按鈕文字嘅對比', contrastBg: '連結同頁面嘅對比', pass: '達到 4.5:1', fail: '低於 4.5:1，會改用易讀嘅色調',
    textSize: '文字大小', motion: '動態', motionSystem: '跟隨系統', motionReduce: '減少動態', motionAllow: '允許動態',
    language: '語言', langEn: '英文', langZh: '粵語', langBoth: '雙語',
    funEn: '英文趣味程度', funZh: '粵語趣味程度', funNote: '只會改變簡介同標題嘅語氣。事實、命令同錯誤文字喺每個程度都一樣。',
    emoji: '顯示表情符號', on: '開', off: '關', reset: '重設', resetAll: '重設所有設定', resetDone: '已重設。',
    palette: '命令面板', paletteHint: '輸入篩選。上下鍵揀，Enter 打開，Esc 關閉。', paletteOpen: '打開命令面板（Ctrl+Shift+F）', paletteNone: '冇吻合嘅項目。', paletteOpenBuilder: '打開完整正規表示式建構器',
    article: '文章', setting: '設定', page: '頁面', category: '分類', close: '關閉',
    notFoundTitle: '搵唔到呢頁', notFoundText: '呢頁唔存在。', goHome: '返去主頁',
    footer: '同 Cloudflare 或 Home Assistant 冇關係。MIT 授權。',
    sample: 'ha.example.com CNAME abcd1234.cfargotunnel.com\nAAAA fd10:aec2:5dae::\nHTTP 502 Bad Gateway\nerror code: 1033',
    levelWord: '程度'
  }
};

export const REGEX_TOKENS = [
  { ins: '\\d', en: 'A digit, 0 to 9.', zh: '一個數字，0 至 9。' },
  { ins: '\\w', en: 'A word character: letter, digit or underscore.', zh: '一個字詞字元：字母、數字或者底線。' },
  { ins: '\\s', en: 'A whitespace character.', zh: '一個空白字元。' },
  { ins: '.', en: 'Any character except a line break (unless the s flag is on).', zh: '除換行外任何字元（開咗 s 旗標就包括換行）。' },
  { ins: '^', en: 'The start of the text, or of a line with the m flag.', zh: '文字開頭；開咗 m 旗標就係每行開頭。' },
  { ins: '$', en: 'The end of the text, or of a line with the m flag.', zh: '文字結尾；開咗 m 旗標就係每行結尾。' },
  { ins: '()', en: 'A capturing group.', zh: '擷取群組。' },
  { ins: '(?:)', en: 'A group that does not capture.', zh: '唔擷取嘅群組。' },
  { ins: '|', en: 'Alternation: match what is on the left or the right.', zh: '或者：吻合左邊或者右邊。' },
  { ins: '*', en: 'Zero or more of the previous item.', zh: '前一項出現零次或者多次。' },
  { ins: '+', en: 'One or more of the previous item.', zh: '前一項出現一次或者多次。' },
  { ins: '?', en: 'Zero or one of the previous item; after another quantifier it makes it lazy.', zh: '前一項出現零次或者一次；放喺其他數量符號後面就變成非貪婪。' },
  { ins: '{2,4}', en: 'Between 2 and 4 of the previous item.', zh: '前一項出現 2 至 4 次。' },
  { ins: '[a-z]', en: 'One character from a set or range.', zh: '集合或範圍入面其中一個字元。' },
  { ins: '\\b', en: 'A word boundary.', zh: '字詞邊界。' }
];
