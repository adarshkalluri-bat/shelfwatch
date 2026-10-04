/* Shelfwatch offline cache. Bump VERSION when you upload a new version of the app. */
const VERSION='shelfwatch-v4';
const SHELL=['./','./index.html','./app.js','./platform.js','./config.js','./manifest.webmanifest','./vendor/supabase.js','./vendor/jszip.min.js','./vendor/xlsx.full.min.js','./icons/icon-192.png','./icons/icon-512.png','./icons/apple-touch-icon.png'];
const isCode=u=>/\/$|\.html$|\.js$/.test(new URL(u).pathname);
self.addEventListener('install',e=>{
  // fetch fresh copies, skipping the browser's own short-term cache
  e.waitUntil(caches.open(VERSION).then(c=>Promise.all(SHELL.map(u=>fetch(new Request(u,{cache:'reload'})).then(r=>{if(r.ok)return c.put(u,r)})))).then(()=>self.skipWaiting()));
});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==VERSION).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
async function refresh(req,hit){
  const r=await fetch(req.url,{cache:'no-cache'});
  if(!r||!r.ok)return r;
  let changed=false;
  if(hit&&isCode(req.url)){try{const [a,b]=await Promise.all([hit.text(),r.clone().text()]);changed=a!==b}catch(e){}}
  const c=await caches.open(VERSION);await c.put(req,r.clone());
  if(changed){const cs=await self.clients.matchAll({includeUncontrolled:true});cs.forEach(x=>x.postMessage({type:'update'}))}
  return r;
}
self.addEventListener('fetch',e=>{
  const req=e.request;const url=new URL(req.url);
  if(req.method!=='GET'||url.origin!==location.origin)return;
  e.respondWith(caches.match(req,{ignoreSearch:true}).then(hit=>{
    const net=refresh(req,hit?hit.clone():null).catch(()=>hit||(req.mode==='navigate'?caches.match('./index.html'):Response.error()));
    if(hit){e.waitUntil(net.catch(()=>{}));return hit}
    return net;
  }));
});
