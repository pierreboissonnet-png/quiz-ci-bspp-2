const V="quiz-ci-5.0.2";const SHELL=["./","index.html","style.css","app.js","boot.js","logo-bspp.png","logo-crf.png","manifest.webmanifest","casque-180.png","casque-192.png","casque-512.png","pdfjs/pdf.min.js","pdfjs/pdf.worker.min.js","leaflet/leaflet.js","leaflet/leaflet.css"];
// contenus protégés (après connexion) : récupérés à l'installation, sinon repris de l'ancienne version pour rester utilisable hors réseau
const DATA=["data.js","simple.js","secteurs.json","search.json"];
self.addEventListener("install",e=>{e.waitUntil((async()=>{const c=await caches.open(V);await c.addAll(SHELL);
 for(const u of DATA){try{const r=await fetch(u,{credentials:"same-origin",cache:"no-store"});if(r.ok){await c.put(u,r);continue}try{await r.body.cancel()}catch(x){}}catch(err){}const m=await caches.match(u,{ignoreSearch:true});if(m)await c.put(u,m)}})());self.skipWaiting()});
self.addEventListener("activate",e=>{e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==V&&x!=="quiz-ci-docs").map(x=>caches.delete(x)))));self.clients.claim()});
self.addEventListener("fetch",e=>{const r=e.request;if(r.method!=="GET"||r.headers.has("range"))return;const u=new URL(r.url);if(u.origin!==location.origin||u.pathname.includes("/api/"))return;
 if(u.pathname.includes("/pdf/")){e.respondWith(caches.open("quiz-ci-docs").then(c=>c.match(r).then(m=>m||fetch(r))));return}
 e.respondWith(caches.match(r,{ignoreSearch:true}).then(m=>{const net=fetch(r).then(res=>{if(res.ok){const cp=res.clone();caches.open(V).then(c=>c.put(r,cp))}return res}).catch(()=>m||caches.match("index.html"));return m||net}))});
// 3.4.0 : notifications de duel uniquement
self.addEventListener("push",e=>{let d={};try{d=e.data.json()}catch(x){d={title:"Quiz CI BSPP",body:e.data?e.data.text():""}}
 e.waitUntil(self.registration.showNotification(d.title||"Quiz CI BSPP",{body:d.body||"",tag:d.tag||"duel",icon:"casque-192.png",badge:"casque-192.png",data:{url:"./",ev:d.ev||null}}))});
self.addEventListener("notificationclick",e=>{e.notification.close();const ev=e.notification.data&&e.notification.data.ev;e.waitUntil(self.clients.matchAll({type:"window",includeUncontrolled:true}).then(cs=>{for(const c of cs){if("focus" in c){if(ev)c.postMessage({openEv:ev});return c.focus()}}return self.clients.openWindow(ev?"./#ev="+encodeURIComponent(ev):"./")}))});
