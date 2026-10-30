const V="quiz-ci-5.3.2";const SHELL=["./","index.html","style.css","app.js","boot.js","logo-bspp.png","logo-crf.png","manifest.webmanifest","casque-180.png","casque-192.png","casque-512.png","pdfjs/pdf.min.js","pdfjs/pdf.worker.min.js","leaflet/leaflet.js","leaflet/leaflet.css"];
// contenus protégés (après connexion) : récupérés à l'installation, sinon repris de l'ancienne version pour rester utilisable hors réseau
const DATA=["data.js","simple.js","secteurs.json","search.json"];
self.addEventListener("install",e=>{e.waitUntil((async()=>{const c=await caches.open(V);await c.addAll(SHELL);
 for(const u of DATA){try{const r=await fetch(u,{credentials:"same-origin",cache:"no-store"});if(r.ok){await c.put(u,r);continue}try{await r.body.cancel()}catch(x){}}catch(err){}const m=await caches.match(u,{ignoreSearch:true});if(m)await c.put(u,m)}})());self.skipWaiting()});
self.addEventListener("activate",e=>{e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==V&&x!=="quiz-ci-docs").map(x=>caches.delete(x)))));self.clients.claim()});
self.addEventListener("fetch",e=>{const r=e.request;if(r.method!=="GET"||r.headers.has("range"))return;const u=new URL(r.url);if(u.origin!==location.origin||u.pathname.includes("/api/"))return;
 if(u.pathname.includes("/pdf/")){e.respondWith(caches.open("quiz-ci-docs").then(c=>c.match(r).then(m=>m||fetch(r))));return}
 e.respondWith(caches.match(r,{ignoreSearch:true}).then(m=>{const net=fetch(r).then(res=>{if(res.ok){const cp=res.clone();caches.open(V).then(c=>c.put(r,cp))}return res}).catch(()=>m||caches.match("index.html"));return m||net}))});
// notifications : duels, évaluations, mises à jour. 5.2.0 : le clic ouvre l'appli sur le bon écran
self.addEventListener("push",e=>{let d={};try{d=e.data.json()}catch(x){d={title:"Quiz CI BSPP",body:e.data?e.data.text():""}}
 e.waitUntil(self.registration.showNotification(d.title||"Quiz CI BSPP",{body:d.body||"",tag:d.tag||"duel",icon:"casque-192.png",badge:"casque-192.png",data:{nav:d.nav||(d.ev?"ev:"+d.ev:"")}}))});
self.addEventListener("notificationclick",e=>{e.notification.close();const d=e.notification.data||{};const nav=d.nav||(d.ev?"ev:"+d.ev:"");
 const url=new URL("./"+(nav?"#go="+encodeURIComponent(nav):""),self.registration.scope).href;
 e.waitUntil((async()=>{let cs=[];try{cs=await self.clients.matchAll({type:"window",includeUncontrolled:true})}catch(x){}
  for(const c of cs){try{if(nav)c.postMessage({go:nav});if("focus" in c){await c.focus();return}}catch(x){}}
  try{if(await self.clients.openWindow(url))return}catch(x){}
  for(const c of cs){try{if("navigate" in c){await c.navigate(url);return}}catch(x){}}})())});
