/* Shelfwatch offline cache. Bump VERSION when you upload a new version of the app. */
const VERSION='shelfwatch-v2';
const SHELL=['./','./index.html','./app.js','./platform.js','./config.js','./manifest.webmanifest','./vendor/supabase.js','./vendor/jszip.min.js','./vendor/xlsx.full.min.js','./icons/icon-192.png','./icons/icon-512.png','./icons/apple-touch-icon.png'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(VERSION).then(c=>c.addAll(SHELL)).then(()=>self.skipWaiting()))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==VERSION).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',e=>{
  const req=e.request;const url=new URL(req.url);
  if(req.method!=='GET'||url.origin!==location.origin)return;
  e.respondWith(caches.match(req,{ignoreSearch:true}).then(hit=>{
    const net=fetch(req).then(r=>{if(r&&r.ok){const copy=r.clone();caches.open(VERSION).then(c=>c.put(req,copy))}return r})
      .catch(()=>hit||(req.mode==='navigate'?caches.match('./index.html'):Response.error()));
    return hit||net;
  }));
});
