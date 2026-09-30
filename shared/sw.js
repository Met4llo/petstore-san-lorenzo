'use strict';
const CACHE='san-lorenzo-shell-v1';
const ASSETS=['./','./index.html','./styles.css','./la-malfa.css','./sheet-overlay.css','./logo-petstore.png','./core.js','./app.js','./manifest.json','./icon.svg','./products.json','./accessory-eans.json','./supplier-conditions.json','./suppliers.json'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS))));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('san-lorenzo-shell-')&&key!==CACHE).map(key=>caches.delete(key))))));
self.addEventListener('fetch',event=>{
  const url=new URL(event.request.url);
  // Auth/API, configurazione e richieste di scrittura non vengono messe in cache.
  if(event.request.method!=='GET'||url.origin!==self.location.origin||url.pathname.endsWith('/config.js'))return;
  const allowed=ASSETS.some(asset=>new URL(asset,self.registration.scope).pathname===url.pathname);
  if(!allowed)return;
  event.respondWith(fetch(event.request).then(response=>{if(response.ok){const copy=response.clone();event.waitUntil(caches.open(CACHE).then(cache=>cache.put(event.request,copy)));}return response;}).catch(()=>caches.match(event.request).then(cached=>cached||Response.error())));
});
