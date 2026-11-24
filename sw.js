/* 說說字典離線快取
   - 網頁本體與教育部字典資料：安裝時就存好，沒網路也能查
   - 遊戲語音模型：第一次玩遊戲時下載，之後一直留著（版本更新也不用重新下載）
   - 字型、筆順資料等外部檔案：用過一次就存起來 */
const VERSION = '20261124204837';
const CORE = 'ssd-core-' + VERSION;
const MODELS = 'ssd-models-1';
const RUNTIME = 'ssd-runtime-1';
const CORE_FILES = ['index.html', 'hanzi-writer.min.js', 'dict.json', 'idioms.json', 'ts.json',
  'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png'];
// 這些網址每次查都要最新的結果（英文字典、翻譯、例句），有網路就用網路，沒網路才用存過的
const LIVE = ['api.dictionaryapi.dev', 'api.mymemory.translated.net', 'api.tatoeba.org'];

self.addEventListener('install', e => {
  // cache:'reload'：一定向網站拿最新的檔案，不用瀏覽器暫存的舊檔（GitHub 會讓瀏覽器暫存 10 分鐘）
  e.waitUntil(caches.open(CORE)
    .then(c => c.addAll(CORE_FILES.map(f => new Request(f, {cache: 'reload'}))))
    .then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys
    .filter(k => k.startsWith('ssd-core-') && k !== CORE)
    .map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

async function cacheFirst(req, name){
  const hit = await caches.match(req, {ignoreSearch: true});
  if (hit) return hit;
  const res = await fetch(req);
  if (res && (res.ok || res.type === 'opaque')) { const c = await caches.open(name); c.put(req, res.clone()); }
  return res;
}
async function networkFirst(req, name){
  try {
    const res = await fetch(req);
    if (res && res.ok) { const c = await caches.open(name); c.put(req, res.clone()); }
    return res;
  } catch (err) {
    const hit = await caches.match(req);
    if (hit) return hit;
    throw err;
  }
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin === location.origin){
    if (req.mode === 'navigate'){
      e.respondWith(caches.match('index.html').then(r => r || fetch(req)));
      return;
    }
    const p = url.pathname;
    // 語音模型（放在 models/ 或最外層都算）與函式庫：存一次就一直留著
    if (p.includes('/models/') || p.includes('/lib/') || p.includes('.tar.gz.') || p.endsWith('/models.json')) { e.respondWith(cacheFirst(req, MODELS)); return; }
    e.respondWith(cacheFirst(req, CORE));
    return;
  }
  if (LIVE.includes(url.hostname)) { e.respondWith(networkFirst(req, RUNTIME)); return; }
  e.respondWith(cacheFirst(req, RUNTIME));
});
