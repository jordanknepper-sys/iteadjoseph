const SHELL = "iaj-shell-v1", AUDIO = "iaj-audio-v1";
const FILES = ["./", "index.html", "app.js", "styles.css", "content.json", "manifest.webmanifest", "icons/icon-192.png", "icons/icon-512.png", "icons/apple-touch-icon.png"];
self.addEventListener("install", e => { e.waitUntil(caches.open(SHELL).then(c => c.addAll(FILES))); self.skipWaiting(); });
self.addEventListener("activate", e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => ![SHELL, AUDIO].includes(k)).map(k => caches.delete(k))))); self.clients.claim(); });
self.addEventListener("fetch", e => {
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return;
  if (url.pathname.includes("/audio/")) {
    // Audio: serve from cache if downloaded, else network (range requests pass through).
    e.respondWith(caches.open(AUDIO).then(c => c.match(url.pathname.split("/").slice(-2).join("/"), {ignoreSearch: true}).then(hit => {
      if (hit && !e.request.headers.get("range")) return hit;
      if (hit) return rangeFrom(hit, e.request.headers.get("range"));
      return fetch(e.request);
    })));
    return;
  }
  // App shell: network first so updates arrive, cache fallback offline.
  e.respondWith(fetch(e.request).then(r => { const copy = r.clone(); caches.open(SHELL).then(c => c.put(e.request, copy)); return r; }).catch(() => caches.match(e.request).then(r => r || caches.match("index.html"))));
});
async function rangeFrom(resp, range) {
  const buf = await resp.arrayBuffer(); const m = /bytes=(\d+)-(\d*)/.exec(range);
  const start = +m[1], end = m[2] ? +m[2] : buf.byteLength - 1;
  return new Response(buf.slice(start, end + 1), { status: 206, headers: {
    "Content-Type": "audio/mp4", "Content-Range": `bytes ${start}-${end}/${buf.byteLength}`, "Content-Length": String(end - start + 1), "Accept-Ranges": "bytes" } });
}
