"use strict";
/* ============ Données & état ============ */
const {themes:DATA,fiches:FICHES,docs:DOCS}=window.QDATA;
const DOC=Object.fromEntries(DOCS.map((d,i)=>[d.id,{...d,i}]));
const FICHE=Object.fromEntries(FICHES.map(f=>[f.id,f]));
const LETTERS="ABCD";
const store={get(k,d){try{const v=localStorage.getItem("cq_"+k);return v?JSON.parse(v):d}catch(e){return d}},set(k,v){try{localStorage.setItem("cq_"+k,JSON.stringify(v))}catch(e){}},del(k){try{localStorage.removeItem("cq_"+k)}catch(e){}}};
/* ---- journal d'activité : actions et erreurs, envoyées par lots au serveur (conservées 30 jours, visibles des admins) ---- */
const APP_VER="3.3.1";const LOG_S=Math.random().toString(36).slice(2,10);
let logBuf=store.get("logBuf",[]);let logT=null;
// contexte joint à chaque évènement : écran, jeu en cours, niveau, mode, ambiance, réseau
let curGame=null,lastPick=null,qShownAt=0,lastEcran="";
function tabName(t){try{const x=TABS.find(x=>x[0]===t);return x?x[1]:(t==="profile"?"Profil":t||"?")}catch(e){return t||"?"}}
function logCtx(){try{const g=curGame?curGame.title:"";return [typeof tab!=="undefined"?"onglet "+tabName(tab):"",g?"écran « "+g+" »":"",typeof level!=="undefined"?(level==="expert"?"Officier":"Sapeur"):"",typeof usage!=="undefined"?usage:"",typeof fxMode!=="undefined"&&fxMode!=="off"?"amb="+fxMode:"",navigator.onLine===false?"hors-ligne":""].filter(Boolean).join(" · ")}catch(e){return ""}}
function alog(k,v,d){try{logBuf.push({t:Date.now(),k:String(k).slice(0,16),v:String(v==null?"":v).slice(0,100),d:d==null?"":(typeof d==="string"?d:JSON.stringify(d)).slice(0,800),c:logCtx().slice(0,140)});if(logBuf.length>400)logBuf=logBuf.slice(-400);store.set("logBuf",logBuf);
 clearTimeout(logT);logT=setTimeout(logFlush,logBuf.length>=50?500:20000)}catch(e){}}
async function logFlush(final){const m=store.get("me",null);if(!logBuf.length||!m||!m.token||m.expired||navigator.onLine===false)return;const evs=logBuf.slice(0,300);
 try{const r=await fetch("api/log",{method:"POST",keepalive:!!final,headers:{"content-type":"application/json","authorization":"Bearer "+m.id+":"+m.token,"x-id":m.id,"x-token":m.token},body:JSON.stringify({id:m.id,token:m.token,s:LOG_S,ver:APP_VER,events:evs}),credentials:"same-origin"});
  if(r.ok){logBuf=logBuf.slice(evs.length);store.set("logBuf",logBuf);if(logBuf.length)logT=setTimeout(logFlush,1500)}}catch(e){}}
let hiddenAt=0;document.addEventListener("visibilitychange",()=>{if(document.hidden){hiddenAt=Date.now();alog("app","mise en arrière-plan","");logFlush(true)}else alog("app","retour au premier plan",hiddenAt?"absent "+Math.round((Date.now()-hiddenAt)/1000)+" s":"")});
window.addEventListener("online",()=>alog("app","réseau retrouvé",""));window.addEventListener("offline",()=>alog("app","réseau perdu",""));
window.addEventListener("pagehide",()=>logFlush(true));
// erreurs : message, explication en clair, fonction et ligne concernées
function errExplain(m){m=String(m||"");if(/null is not an object|undefined is not an object|Cannot read propert|Cannot set propert|of null|of undefined/i.test(m))return "Un élément de l'écran était introuvable : l'écran a sans doute changé (retour, navigation) avant la fin d'un chargement.";
 if(/is not a function/i.test(m))return "Une fonction attendue n'existe pas : souvent un mélange d'ancienne et de nouvelle version de l'appli (mise à jour en cours).";
 if(/is not defined|Can't find variable/i.test(m))return "Une variable attendue n'existe pas : souvent un mélange de versions, ou un fichier non chargé.";
 if(/Load failed|Failed to fetch|NetworkError|network/i.test(m))return "Problème de réseau pendant un chargement.";
 if(/QuotaExceeded|quota/i.test(m))return "La mémoire du navigateur est pleine.";
 if(/JSON/i.test(m))return "Réponse du serveur illisible (souvent une coupure réseau ou une erreur serveur).";return ""}
function errWhere(stack){const L=String(stack||"").split("\n").map(x=>x.trim()).filter(Boolean);const f=L.find(x=>/app\.js|boot\.js|data\.js/.test(x))||L[0]||"";const m=f.match(/^(?:at\s+)?([^@(\s]*)[@(\s]*.*?([a-z]+\.js):(\d+):(\d+)/i);return m?{fonction:m[1]||"(anonyme)",fichier:m[2],ligne:m[3]+":"+m[4]}:{}}
function logErr(kind,msg,stack){msg=String(msg||"Erreur inconnue");if(!/^[A-Z][a-zA-Z]*Error/.test(msg)&&!stack)msg=msg;const w=errWhere(stack);alog("erreur",msg.slice(0,100),{explication:errExplain(msg),type:kind,...w,pile:String(stack||"").split("\n").slice(0,4).join(" ← ").slice(0,300)})}
window.addEventListener("error",e=>logErr("erreur JavaScript",(e.error&&e.error.message)||e.message,(e.error&&e.error.stack)||`${(e.filename||"").split("/").pop()}:${e.lineno||""}:${e.colno||""}`));
window.addEventListener("unhandledrejection",e=>{const r=e.reason;if(r&&r.offline)return;const msg=r&&(r.message||r.error)?String(r.message||r.error):(typeof r==="string"?r:JSON.stringify(r||""));logErr("erreur asynchrone (chargement)",(r&&r.name&&r.message?r.name+": ":"")+msg,r&&r.stack)});
const LOG_ATTR=["tab","m","sm","rb","ci","lvl","usage","pt","rt","ct","cq","gq","g","k","fiche","cs","mk","od","ci","cf","st","t","pf","sc","teams","join"];
document.addEventListener("click",e=>{try{const el=e.target.closest&&e.target.closest("button,a,[role=button],summary,.tile,.row,.chip,.acr");if(!el)return;
 const attrs=LOG_ATTR.filter(a=>el.dataset&&el.dataset[a]!=null).map(a=>a+"="+el.dataset[a]).join(" ");
 if(el.classList.contains("opt"))lastPick={txt:(el.textContent||"").replace(/\s+/g," ").trim().replace(/^[A-D]\s+/,""),t:Date.now()};const bt=el.querySelector&&el.querySelector("b");const lab=el.classList.contains("opt")?"réponse "+(el.dataset.k||""):(el.getAttribute("aria-label")||(bt&&bt.textContent)||el.textContent||"").replace(/\s+/g," ").trim().slice(0,50);
 alog("clic",lab||(el.id?"#"+el.id:"(sans libellé)"),attrs?{"détails":attrs+(el.id?" · id="+el.id:"")}:(el.id?{id:el.id}:""))}catch(err){}},true);
let selected=new Set(store.get("themes",DATA.filter(t=>t.id!=="pse").map(t=>t.id)));
let review=new Set(store.get("review",[]));
let best=store.get("best",{});
let hist=store.get("hist",{});          // id -> [1,0,1…] (5 derniers résultats)
let days=store.get("days",[]);          // jours joués (AAAA-MM-JJ)
let defiDone=store.get("defi",{});      // semaine -> {score,ms}
const $=s=>document.querySelector(s);
const app=$("#app");
const esc=s=>String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const shuffle=a=>{a=a.slice();for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a};
const SHORT={guide:"Métier de CI",ssuap:"Bilans & SSUAP",acr:"ACR · DAE · chaleur",efibi:"eFiBi & procédures",ops:"Opérations BSP 115",orga:"Organisation · NRBC",pse:"Bonus PSE"};
const short=t=>SHORT[t.id]||t.theme;
const ALL=[];DATA.forEach(t=>["qcm","vf","flashcards","ordre","cas"].forEach(k=>t[k].forEach((it,i)=>ALL.push(Object.assign(it,{_t:t,_k:k,_id:t.id+":"+k+":"+i,type:k})))));
const BYID=Object.fromEntries(ALL.map(x=>[x._id,x]));
const SCORED=new Set(["qcm","vf","flashcards","ordre"]);
function pool(kind){return ALL.filter(x=>x._k===kind&&selected.has(x._t.id))}
const today=()=>new Date().toISOString().slice(0,10);
/* progression : sauvegardée sur le téléphone ET sur le compte (fusion entre appareils) */
let histT=store.get("histT",{});        // id -> date de la dernière réponse
let progReset=store.get("progReset",0);  // date de la dernière remise à zéro connue
const DEV=store.get("dev",null)||(()=>{const d="d"+Math.random().toString(36).slice(2,10);store.set("dev",d);return d})();
let cntDev=store.get("cntDev",null);
if(!cntDev){cntDev={};cntDev[DEV]=store.get("cnt",{points:0,answered:0,correct:0});store.set("cntDev",cntDev)}
if(!cntDev[DEV])cntDev[DEV]={points:0,answered:0,correct:0};
let cnt=cntDev[DEV];
// points de la semaine (remis à zéro chaque lundi) : compteurs par appareil pour la semaine en cours
let wkDev=store.get("wkDev",null)||{w:"",d:{}};
let dayPts=store.get("dayPts",{});
function dpAdd(pt,ok){const d=today();const o=dayPts[d]||(dayPts[d]={});const c=o[DEV]||(o[DEV]=[0,0,0]);c[0]+=pt;c[1]++;if(ok)c[2]++;const ks=Object.keys(dayPts).sort();if(ks.length>400)ks.slice(0,ks.length-400).forEach(k=>delete dayPts[k]);store.set("dayPts",dayPts)}
const dayTotal=d=>{const o=dayPts[d];return o?Object.values(o).reduce((a,c)=>a+(c[0]||0),0):0};
function isoWeekOf(ds){return isoWeek(new Date(ds+"T12:00:00"))}
function lastWeeks(n){const out=[];const d=new Date();for(let i=n-1;i>=0;i--){const x=new Date(d);x.setDate(d.getDate()-7*i);out.push(isoWeek(x))}return [...new Set(out)]}
function lastMonths(n){const out=[];const d=new Date();for(let i=n-1;i>=0;i--){const x=new Date(d.getFullYear(),d.getMonth()-i,15);out.push(x.getFullYear()+"-"+String(x.getMonth()+1).padStart(2,"0"))}return out}
function myHist(){const hw={},hm={};Object.keys(dayPts).forEach(d=>{const p=dayTotal(d);if(!p)return;const w=isoWeekOf(d),m=d.slice(0,7);hw[w]=(hw[w]||0)+p;hm[m]=(hm[m]||0)+p});
 const cw=isoWeek(),W=wkTotal().points;if(W>(hw[cw]||0))hw[cw]=W;const cm=today().slice(0,7);if((hw[cw]||0)>(hm[cm]||0))hm[cm]=hw[cw];
 const keep=(o,keys)=>Object.fromEntries(keys.filter(k=>o[k]).map(k=>[k,o[k]]));return {hw:keep(hw,lastWeeks(12)),hm:keep(hm,lastMonths(12))}}
function wkCur(){const w=isoWeek();if(wkDev.w!==w){wkDev={w,d:{}};store.set("wkDev",wkDev)}if(!wkDev.d[DEV])wkDev.d[DEV]={points:0,answered:0,correct:0};return wkDev.d[DEV]}
function wkTotal(){const t={points:0,answered:0,correct:0};if(wkDev.w===isoWeek())Object.values(wkDev.d).forEach(c=>{t.points+=c.points||0;t.answered+=c.answered||0;t.correct+=c.correct||0});return t}
const wpts=p=>p&&p.stats&&p.stats.week===isoWeek()?(p.stats.points||0):0;
function cntTotal(){const t={points:0,answered:0,correct:0};Object.values(cntDev).forEach(c=>{t.points+=c.points||0;t.answered+=c.answered||0;t.correct+=c.correct||0});return t}
// barème : questions simples ×0,5 (5 pts), questions expert ×2 (20 pts), radio et carte ×1 (10 pts)
const ptsMult=id=>/^(s|doc):/.test(id)?.5:/^(radio|carte):/.test(id)?1:2;
function repDetail(id,ok){try{const it=(typeof BYID!=="undefined"&&BYID[id])||null;const q=($(".qtext")&&$(".qtext").textContent)||(it&&(it.q||it.recto||it.titre))||"";
 let att="";if(it){if(it._k==="qcm"&&it.choices)att=it.choices[it.answer];else if(it._k==="vf")att=it.answer?"VRAI":"FAUX"}else{const g=$(".opt.good");if(g)att=g.textContent}
 const ch=lastPick&&Date.now()-lastPick.t<4000?lastPick.txt:"";const ms=qShownAt?Date.now()-qShownAt:0;
 return {"résultat":ok?"juste":"faux","question":q.replace(/\s+/g," ").trim().slice(0,160),"réponse donnée":ch.slice(0,100),"bonne réponse":String(att).replace(/\s+/g," ").trim().slice(0,100),"temps de réponse":ms?Math.round(ms/100)/10+" s":""}}catch(e){return ok?"juste":"faux"}}
function record(id,ok,bonus){if(curGame&&!curGame.n){curGame.t0=Date.now();alog("jeu","début · "+curGame.title,"")}alog("rep",(ok?"✓ ":"✗ ")+id,repDetail(id,ok));if(curGame){curGame.n++;if(ok)curGame.ok++;if(ptsMult(id)>=2)curGame.nL++;else curGame.nS++}if(typeof syncSoon==="function")syncSoon(6000);cnt.answered++;const wc=wkCur();wc.answered++;let pt=0;if(ok){pt=Math.round((10+(bonus||0))*ptsMult(id));cnt.correct++;cnt.points+=pt;wc.correct++;wc.points+=pt}store.set("wkDev",wkDev);dpAdd(pt,ok);store.set("cntDev",cntDev);const h=(hist[id]||[]).concat(ok?1:0).slice(-5);hist[id]=h;histT[id]=Date.now();store.set("hist",hist);store.set("histT",histT);
  if(ok){if(review.delete(id))store.set("review",[...review])}else if(BYID[id]&&!/^(s|doc):/.test(id)){review.add(id);store.set("review",[...review])}
  const d=today();if(days[days.length-1]!==d){days.push(d);days=days.slice(-400);store.set("days",days)}}
// tirage varié : d'abord les questions jamais vues, puis les moins récentes, avec du hasard pour ne jamais avoir la même série
// tirage : jamais vues d'abord (au hasard), puis les plus anciennement vues ; le hasard est proportionnel à l'ancienneté pour qu'une question vue il y a une heure ne repasse pas devant une question vue il y a deux jours
function fresh(list){const now=Date.now();return list.map(x=>{const t=histT[x._id]||0;return [t?t+Math.random()*Math.min((now-t)*.3,5*864e5):-1-Math.random(),x]}).sort((a,b)=>a[0]-b[0]).map(x=>x[1])}
// pour les jeux générés (grades, hôpitaux, carte) : on fabrique plusieurs lots et on garde les questions les moins récemment vues
function freshGen(build,pre,n){const pool=[],ids=new Set();for(let k=0;k<4;k++)for(const q of build()||[])if(q&&!ids.has(q.id)){ids.add(q.id);pool.push(q)}
 const now=Date.now();return shuffle(pool.map(q=>{const t=histT[pre+q.id]||0;return [t?t+Math.random()*Math.min((now-t)*.3,5*864e5):-1-Math.random(),q]}).sort((a,b)=>a[0]-b[0]).slice(0,n).map(x=>x[1]))}
function markSeen(id){histT[id]=Date.now();store.set("histT",histT);if(typeof syncSoon==="function")syncSoon(8000)}
// mélange l'ordre des réponses d'un QCM (la bonne réponse ne reste pas toujours à la même place)
function mixQ(q){if(!q||q._k!=="qcm"||!Array.isArray(q.choices))return q;const o=shuffle(q.choices.map((t,k)=>({t,k})));return {...q,choices:o.map(x=>x.t),answer:o.findIndex(x=>x.k===q.answer)}}
// affichage d'une question ; pour un vrai/faux tiré d'un QCM : la question, puis la réponse proposée à juger
function qHtml(q){return esc(q.q)+(q.prop?`<span class="vfprop"><small>Réponse proposée</small>${esc(q.prop)}</span>`:"")}
// vrai/faux tirés des QCM : « question → réponse proposée » (bonne réponse ou piège), une variante par question
function vfFromQcm(list){return list.filter(q=>q._k==="qcm").map(q=>{const good=Math.random()<.5;const k=good?q.answer:pick(q.choices.map((_,i)=>i).filter(i=>i!==q.answer));
 return {...q,_k:"vf",_der:1,prop:q.choices[k],answer:good,explication:(good?"":`Non : la bonne réponse est « ${q.choices[q.answer]} ». `)+(q.explication||"")}})}
function setBest(mode,val){if(typeof best[mode]!=="number"||val>best[mode]){best[mode]=val;store.set("best",best)}}
function known(id){const h=hist[id];if(!h||!h.length)return null;const l=h.slice(-2);return l.every(x=>x===1)||(h.length===1&&h[0]===1)}
function streak(){let s=0;const set=new Set(days);let d=new Date();if(!set.has(today()))d.setDate(d.getDate()-1);
  while(set.has(d.toISOString().slice(0,10))){s++;d.setDate(d.getDate()-1)}return s}

/* ============ Icônes ============ */
const I={
 refresh:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 4v7h-7"/></svg>',
 home:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/></svg>',
 cards:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="6" width="14" height="15" rx="2.5"/><path d="M7 3h11.5A2.5 2.5 0 0 1 21 5.5V17"/></svg>',
 chat:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20.5l1.4-4.6A8 8 0 1 1 21 12z"/><path d="M8.5 11h.01M12 11h.01M15.5 11h.01" stroke-width="2.6"/></svg>',
 book:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z"/><path d="M4 20.5A2.5 2.5 0 0 0 6.5 23H20v-5"/></svg>',
 user:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>',
 quiz:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.6 2.6 0 0 1 5 .9c0 1.7-2.5 2.3-2.5 3.6M12 17h.01"/></svg>',
 bolt:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2 4 14h7l-1 8 9-12h-7z"/></svg>',
 list:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01"/></svg>',
 siren:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 18v-6a6 6 0 0 1 12 0v6"/><path d="M3 21h18M12 3V1M4.2 5.2 3 4M19.8 5.2 21 4"/></svg>',
 exam:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6M8 14l2.5 2.5L16 11"/></svg>',
 redo:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/></svg>',
 doc:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6M8 13h8M8 17h5"/></svg>',
 share:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v13M7 8l5-5 5 5"/><path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7"/></svg>',
 plus:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="3" width="18" height="18" rx="4"/><path d="M12 8v8M8 12h8"/></svg>',
 send:'<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5M5 12l7-7 7 7"/></svg>',
 chev:'<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 6 6 6-6 6"/></svg>',
 back:'<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m15 6-6 6 6 6"/></svg>',
};

/* ============ Marqueurs ============ */
let marksLog=store.get("marksLog",null); // id -> {on, t}
if(!marksLog){marksLog={};Object.entries(store.get("marks",{})).forEach(([id,t])=>marksLog[id]={on:true,t});store.set("marksLog",marksLog)}
let marks={};function rebuildMarks(){marks={};Object.entries(marksLog).forEach(([id,m])=>{if(m.on)marks[id]=m.t})}rebuildMarks();
const FLAG='<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M5 21V4"/><path d="M5 4h11l-2 4 2 4H5"/></svg>';
function markBtn(id,label){const on=!!marks[id];return `<button type="button" class="mk ${on?"on":""}" data-mk="${esc(id)}" aria-pressed="${on}" title="Marquer pour revoir">${FLAG}${label===false?"":`<span>${on?"Marquée":"Marquer"}</span>`}</button>`}
function setMark(id,on){marksLog[id]={on,t:Date.now()};store.set("marksLog",marksLog);rebuildMarks();if(typeof syncSoon==="function")syncSoon(3000);
  document.querySelectorAll(`[data-mk="${CSS.escape(id)}"]`).forEach(b=>{b.classList.toggle("on",on);b.setAttribute("aria-pressed",on);const s=b.querySelector("span");if(s)s.textContent=on?"Marquée":"Marquer"});
  if(typeof toast==="function")toast(on?"Marquée : à retrouver dans Réviser › Marquées.":"Marqueur retiré.")}
document.addEventListener("click",e=>{const b=e.target.closest("[data-mk]");if(!b)return;e.stopPropagation();e.preventDefault();setMark(b.dataset.mk,!marks[b.dataset.mk])},true);
document.addEventListener("click",e=>{const b=e.target.closest("[data-unmk]");if(!b)return;setMark(b.dataset.unmk,false);const c=b.closest(".mkcard");if(c)c.remove();const n=$("#mkcount");if(n)n.textContent=Object.keys(marks).length;if(!document.querySelector(".mkcard")&&$("#rl")&&revTab==="marks")viewRevise()});
const qhead=(q,extra="")=>`<div class="qhead"><span class="qtag">${esc(short(q._t))}${extra}</span>${markBtn(q._id)}</div>`;

/* ============ Navigation ============ */
const RADIO_IC_T='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="8" width="12" height="13" rx="2.5"/><path d="M9 8 7 3"/><path d="M9.5 12h5M9.5 15h5"/></svg>',MAP_IC_T='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M9 4 3 6.5v13.5l6-2.5 6 2.5 6-2.5V4l-6 2.5z"/><path d="M9 4v13.5M15 6.5V20"/></svg>';
const GRADE_IC_T='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="16" height="16" rx="2.5"/><path d="M7 10h10M7 14h10"/></svg>';
const LEX_IC_T='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3z"/><path d="M5 17a3 3 0 0 1 3-3h11"/><path d="M9 8h6"/></svg>';
const STATS_IC='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></svg>';
const TABS=[["home","Accueil",I.home],["revise","Réviser",I.cards],["chat","Assistant",I.chat],["cri","Codes CRI",'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="3"/><path d="M7 9h4M7 13h10M7 17h6"/><circle cx="16.5" cy="9" r="1.5"/></svg>'],["radio","Messages radio",RADIO_IC_T],["carte","Carte des secteurs",MAP_IC_T],["grades","Grades",GRADE_IC_T],["lexique","Lexique",LEX_IC_T],["docs","Documents",I.book],["stats","Statistiques",STATS_IC],["profile","Profil",I.user]];
// mode d'utilisation : « apprenti » (tout l'entraînement) ou « ci » (CI BSPP en poste : défi hebdo + outils de garde)
let usageObj=store.get("usageObj",null)||{v:store.get("usage","apprenti"),t:0};let usage=usageObj.v;
function setUsage(v){usage=v;usageObj={v,t:Date.now()};store.set("usageObj",usageObj);store.set("usage",v);if(typeof syncSoon==="function")syncSoon(1500)}
const CI_TABS=["home","cri","radio","carte","grades","lexique","docs","stats","profile"];
const visTabs=()=>usage==="ci"?TABS.filter(t=>CI_TABS.includes(t[0])):TABS;
let tab=store.get("tab","home");if(!visTabs().some(t=>t[0]===tab))tab="home";
let cleanup=null;
const MENU_IC='<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M4 7h16M4 12h16M4 17h16"/></svg>';
function renderTabs(){const cur=TABS.find(t=>t[0]===tab);const TABS_V=visTabs();
  $("#tabbar").innerHTML=`<button class="menubtn" id="menuBtn" aria-label="Menu" aria-expanded="false" aria-controls="menuPanel">${cur?cur[2]:""}<span>${cur?esc(cur[1]):""}</span>${MENU_IC}</button>
   <div class="menupanel" id="menuPanel" hidden>${TABS_V.map(([k,l,ic])=>`<button data-tab="${k}" ${k===tab?'aria-current="page"':""}>${ic}<span>${l}</span></button>`).join("")}</div>`;
  const btn=$("#menuBtn"),pan=$("#menuPanel");
  const close=()=>{pan.hidden=true;btn.setAttribute("aria-expanded","false")};
  btn.onclick=e=>{e.stopPropagation();pan.hidden=!pan.hidden;btn.setAttribute("aria-expanded",String(!pan.hidden))};
  pan.querySelectorAll("button").forEach(b=>b.onclick=()=>{close();go(b.dataset.tab)});
  if(!renderTabs.bound){renderTabs.bound=true;document.addEventListener("click",e=>{const p=$("#menuPanel");if(p&&!p.hidden&&!e.target.closest("#tabbar")){p.hidden=true;const b=$("#menuBtn");if(b)b.setAttribute("aria-expanded","false")}});
    document.addEventListener("keydown",e=>{if(e.key==="Escape"){const p=$("#menuPanel");if(p)p.hidden=true}})}}
let navStack=[];
function go(t,fromBack){if(cleanup){cleanup();cleanup=null}if(!visTabs().some(x=>x[0]===t))t="home";alog("nav",tabName(tab)+" → "+tabName(t),fromBack?"par le bouton Retour":"");if(curGame){if(curGame.n)alog("jeu","abandon · "+curGame.title,{"réponses":curGame.n,justes:curGame.ok,"durée":Math.round((Date.now()-curGame.t0)/1000)+" s"});curGame=null}lastEcran="";if(!fromBack&&t!==tab&&!document.body.classList.contains("pushed")){navStack.push(tab);navStack=navStack.slice(-20)}if(!fromBack&&t!==tab)history.pushState({app:1},"");tab=t;store.set("tab",t);document.body.classList.remove("pushed");$("#composer").hidden=t!=="chat";renderTabs();
  app.className="view";({home:viewHome,revise:viewRevise,chat:viewChat,cri:viewCri,radio:viewRadio,carte:viewCarte,grades:()=>viewGrades(level==="expert",true),lexique:()=>viewLexique(true),docs:viewDocs,stats:viewStatsTab,profile:viewProfile})[t]();bindTabBack();window.scrollTo(0,0)}
/* 3.3.1 : après une réponse, faire apparaître la correction sans avoir à faire défiler (le bouton suivant reste collé en bas) */
let lastFb=null;
new MutationObserver(()=>{if(!document.body.classList.contains("pushed"))return;const fb=app.querySelector(".fb");if(!fb||fb===lastFb)return;lastFb=fb;
 requestAnimationFrame(()=>{const nx=app.querySelector("#next");const bar=nx?nx.closest(".actions"):null;const barH=bar?bar.offsetHeight:0;const r=fb.getBoundingClientRect();const over=r.bottom-(innerHeight-barH);
  if(over>0){const up=Math.min(over,Math.max(0,r.top-90));if(up>0)window.scrollBy({top:up,behavior:"smooth"})}})}).observe(app,{childList:true,subtree:true});
function goBack(){const prev=navStack.pop();if(prev)go(prev,true);else go("home",true)}
function backLink(){return tab!=="home"?`<button class="tback" id="tback">${I.back}${esc((TABS.find(x=>x[0]===(navStack[navStack.length-1]||"home"))||[])[1]||"Accueil")}</button>`:""}
function bindTabBack(){const b=$("#tback");if(b)b.onclick=()=>goBack()}
window.addEventListener("popstate",()=>{const v=$("#viewer");if(v){v.querySelector("#vclose").click();return}if($("#sheet")){closeSheet();return}const bk=$("#back");if(bk){bk.click();return}if(tab!=="home")goBack()});
function gameLog(title){try{qShownAt=Date.now();if(title==="Résultat"){if(curGame&&curGame.n){const g=curGame;curGame=null;setTimeout(()=>{const ev=typeof rankOnGameEnd==="function"?rankOnGameEnd(g):null;if(ev){if(ev.type==="down")setTimeout(()=>rankPopup("down",ev.to),400);else rankResultNote(ev)}const sc=$(".result .score"),gr=$(".result .grade");alog("jeu","fin · "+g.title,{score:sc?sc.textContent.trim():"","réponses":g.n,justes:g.ok,"durée":Math.round((Date.now()-g.t0)/1000)+" s",commentaire:gr?gr.textContent.trim().slice(0,120):""})},30)}return}
 if(!curGame||curGame.title!==title){if(curGame&&curGame.n)alog("jeu","abandon · "+curGame.title,{"réponses":curGame.n,justes:curGame.ok,"durée":Math.round((Date.now()-curGame.t0)/1000)+" s"});curGame={title,t0:Date.now(),n:0,ok:0,nL:0,nS:0}}}catch(e){}}
function push(title,right,onBack){if(title!==lastEcran){alog("ecran",title,right||"");lastEcran=title}gameLog(title);if(!document.body.classList.contains("pushed"))history.pushState({app:1},"");if(cleanup){cleanup();cleanup=null}document.body.classList.add("pushed");$("#composer").hidden=true;app.className="view push";
  return `<div class="nav"><button class="back" id="back">${I.back}Retour</button><div class="ttl">${esc(title)}</div><div class="right" id="navr">${right||""}</div></div>`}
function bindBack(fn){const b=$("#back");if(b)b.onclick=()=>{if(cleanup){cleanup();cleanup=null}fn?fn():go(tab)}}
function setRight(t){const r=$("#navr");if(r)r.textContent=t}

/* ============ Installation ============ */
let deferredPrompt=null;
window.addEventListener("beforeinstallprompt",e=>{e.preventDefault();deferredPrompt=e;if(tab==="home"&&!document.body.classList.contains("pushed"))viewHome()});
const isStandalone=()=>window.matchMedia("(display-mode: standalone)").matches||navigator.standalone===true;
const isIOS=()=>/iphone|ipad|ipod/i.test(navigator.userAgent)||(navigator.platform==="MacIntel"&&navigator.maxTouchPoints>1);
function installBanner(){if(isStandalone()||store.get("hideInstall",false))return"";
  return `<div class="install"><img src="casque-180.png" alt=""><div><b>Installer l'appli</b><span>Ajoute le quiz à ton écran d'accueil pour l'ouvrir en plein écran, même hors réseau.</span></div><button class="btn small" id="installBtn">Ajouter</button></div>`}
function bindInstall(){const b=$("#installBtn");if(!b)return;b.onclick=async()=>{
  if(deferredPrompt){deferredPrompt.prompt();const r=await deferredPrompt.userChoice.catch(()=>null);deferredPrompt=null;if(r&&r.outcome==="accepted")viewProfile();return}
  const ios=isIOS();const safari=ios&&!/crios|fxios|edgios|gsa|fban|fbav|instagram/i.test(navigator.userAgent);
  sheet(`<h2>Ajouter à l'écran d'accueil</h2>
   ${ios&&!safari?`<p class="small">Cette page est ouverte dans une autre appli. Ouvre-la d'abord dans <b>Safari</b> (menu ••• puis « Ouvrir dans Safari »).</p>`:""}
   <ol class="steps">
    <li><span class="n">1</span><div>${ios?`Touche le bouton <b>Partager</b> ${I.share} en bas de Safari (ou en haut sur iPad).`:`Ouvre le menu du navigateur (⋮ ou •••).`}</div></li>
    <li><span class="n">2</span><div>Fais défiler et choisis <b>${ios?"Sur l'écran d'accueil":"Installer l'application / Ajouter à l'écran d'accueil"}</b> ${I.plus}</div></li>
    <li><span class="n">3</span><div>Touche <b>Ajouter</b>. L'icône « Quiz CI » apparaît sur ton écran d'accueil.</div></li>
   </ol>
   <p class="small">Ouvre ensuite l'appli depuis l'icône : elle fonctionne hors réseau et garde ta progression sur ce téléphone.</p>
   <div class="actions"><button class="btn full" data-close>J'ai compris</button></div>`)}}
function sheet(html){closeSheet();const bg=document.createElement("div");bg.className="sheet-bg";bg.id="sheet";bg.innerHTML=`<div class="sheet" role="dialog" aria-modal="true"><div class="grab"></div>${html}</div>`;
  bg.onclick=e=>{if(e.target===bg||e.target.closest("[data-close]"))closeSheet()};document.body.appendChild(bg);return bg}
function closeSheet(){const s=$("#sheet");if(s)s.remove()}

/* ============ Défi de la semaine ============ */
const NON_PSE=DATA.filter(t=>t.id!=="pse");
function isoWeek(d=new Date()){const x=new Date(Date.UTC(d.getFullYear(),d.getMonth(),d.getDate()));const day=x.getUTCDay()||7;x.setUTCDate(x.getUTCDate()+4-day);const y=new Date(Date.UTC(x.getUTCFullYear(),0,1));return x.getUTCFullYear()+"-S"+String(Math.ceil(((x-y)/864e5+1)/7)).padStart(2,"0")}
function rng(seed){let h=1779033703^seed.length;for(let i=0;i<seed.length;i++){h=Math.imul(h^seed.charCodeAt(i),3432918353);h=h<<13|h>>>19}return()=>{h=Math.imul(h^h>>>16,2246822507);h=Math.imul(h^h>>>13,3266489909);h^=h>>>16;return(h>>>0)/4294967296}}
function sshuffle(a,r){a=a.slice();for(let i=a.length-1;i>0;i--){const j=Math.floor(r()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a}
function defiQuestions(){const r=rng("defi-"+isoWeek());const all=ALL.filter(q=>(q._k==="qcm"||q._k==="vf")&&q._t.id!=="pse");const picked=[];
  NON_PSE.forEach(t=>picked.push(...sshuffle(all.filter(q=>q._t===t),r).slice(0,3)));
  picked.push(...sshuffle(all.filter(q=>!picked.includes(q)),r).slice(0,20-picked.length));return sshuffle(picked,r)}
const fmtTime=ms=>{const s=Math.round(ms/1000);return Math.floor(s/60)+" min "+String(s%60).padStart(2,"0")+" s"};
async function shareText(txt,msgEl){try{if(navigator.share){await navigator.share({text:txt});return}}catch(e){if(e&&e.name==="AbortError")return}
  try{await navigator.clipboard.writeText(txt);if(msgEl)msgEl.textContent="Résultat copié : colle-le dans la conversation du groupe."}catch(e){if(msgEl)msgEl.textContent=txt}}

/* ============ Maîtrise par fiche ============ */
function ficheStats(fid){const items=ALL.filter(x=>x.f===fid&&SCORED.has(x._k));let seen=0,ok=0,ko=0;
  items.forEach(x=>{const k=known(x._id);if(k===null)return;seen++;k?ok++:ko++});
  const n=items.length;let st="none";if(seen){const acc=ok/seen;st=(ok/n>=.8)?"ok":(acc<.6?"ko":"warn")}
  return {n,seen,ok,ko,st,items}}
const ST={ok:["Acquise","ok"],warn:["En cours","warn"],ko:["À travailler","ko"],none:["Pas encore vue","none"]};
function globalStats(){let n=0,ok=0;const by={ok:0,warn:0,ko:0,none:0};FICHES.forEach(f=>{const s=ficheStats(f.id);n+=s.n;ok+=s.ok;by[s.st]++});return{n,ok,by}}

/* ============ Accueil ============ */
function viewHome(){if(typeof loadDuels==="function"&&me&&!me.expired)setTimeout(()=>loadDuels(),300);document.title=usage==="ci"?"Assistant CI BSPP":"Quiz CI BSPP";if(usage==="ci")return viewHomeCI();if(level==="simple")return viewHomeSimple();
  const g=globalStats();const pct=g.n?Math.round(g.ok/g.n*100):0;const C=2*Math.PI*36;
  const w=isoWeek();const dd=defiDone[w];
  const todo=FICHES.map(f=>({f,s:ficheStats(f.id)})).filter(x=>x.s.st==="ko").sort((a,b)=>b.s.ko-a.s.ko)[0];
  const chips=DATA.map(t=>`<button class="chip" data-t="${t.id}" aria-pressed="${selected.has(t.id)}">${esc(short(t))}</button>`).join("");
  const b=m=>typeof best[m]==="number"?` · record ${best[m]}${m==="chrono"?" pts":" %"}`:"";
  const tile=(m,ic,col,t,s)=>`<button class="tile" data-m="${m}"><span class="ic" style="background:${col}">${ic}</span><b>${t}</b><span>${s}</span></button>`;
  app.innerHTML=`
   <div class="hello">${LOGOS}</div>
   <h1 class="big">Quiz CI BSPP</h1><p class="sub">Parcours Chef d'Intervention en réseau de secours BSPP.</p>${levelSwitch()}
   <div class="card summary"><div class="ring"><svg viewBox="0 0 84 84"><circle cx="42" cy="42" r="36" fill="none" stroke="var(--card2)" stroke-width="9"/><circle cx="42" cy="42" r="36" fill="none" stroke="var(--ok)" stroke-width="9" stroke-linecap="round" stroke-dasharray="${C}" stroke-dashoffset="${C*(1-pct/100)}"/></svg><b>${pct}%</b></div>
     <div><div style="font-weight:600;margin-bottom:8px">Connaissances acquises</div><div class="kpis"><div class="kpi"><b>${streak()}</b><span>jours de suite</span></div><div class="kpi"><b>${g.by.ko}</b><span>fiches à travailler</span></div><div class="kpi"><b>${review.size}</b><span>à revoir</span></div></div></div></div>
   ${todo?`<div class="sect">Suggestion</div><div class="list"><button class="row" data-fiche="${esc(todo.f.id)}"><span class="ic" style="background:var(--ko)">${I.redo}</span><span class="tx"><b>${esc(todo.f.label)}</b><span>${todo.s.ko} question(s) ratée(s) · fiche à travailler</span></span><span class="chev">${I.chev}</span></button></div>`:""}
   <div class="sect">S'entraîner · thèmes</div>
   <div class="chips">${chips}</div>
   <div class="tiles" style="margin-top:10px">
    ${tile("qcm",I.quiz,"#0a84ff","Quiz","10 questions, correction immédiate"+b("qcm"))}
    ${tile("chrono",I.bolt,"#ff9f0a","Vrai ou faux 60 s","Un max de bonnes réponses"+b("chrono"))}
    ${tile("flash",I.cards,"#5e5ce6","Flashcards","Sigles, chiffres clés, définitions")}
    ${tile("ordre",I.list,"#30b0c7","Remets dans l'ordre","Messages, gestes, procédures")}
    ${tile("cas",I.siren,"#e3051b","Cas pratiques","Situations d'intervention")}
    ${tile("exam",I.exam,"#34c759","Examen blanc","30 questions, corrigé à la fin"+b("exam"))}
    <button class="tile" data-m="radio"><span class="ic" style="background:#0f1d36">${RADIO_IC_T}</span><b>Messages radio</b><span>Constructeur et simulateur phonie</span></button>
    <button class="tile" data-m="carte"><span class="ic" style="background:#1f9d55">${MAP_IC_T}</span><b>Carte des secteurs</b><span>CS, Golf, voisins, quiz carte</span></button>
    ${duelTile()}
    <button class="tile wide" data-m="hosp"><span class="ic" style="background:#d92d20">${H_IC}</span><div><b>Les hôpitaux</b><br><span>Urgences spécialisées, SAU, hôpital le plus proche d'un CS</span></div></button>
    <button class="tile wide" data-m="grades"><span class="ic gic">${gradeSvg("CNE","")}</span><div><b>Les grades</b><br><span>Galons, abréviations, hiérarchie et services</span></div></button>
    <button class="tile wide" data-m="marks"><span class="ic" style="background:#5e5ce6">${FLAG}</span><div><b>Questions marquées (${Object.keys(marks).length})</b><br><span>Revois la réponse et le référentiel des points à éclaircir.</span></div></button>
    <button class="tile wide" data-m="review" ${review.size?"":"disabled"}><span class="ic" style="background:var(--warn)">${I.redo}</span><div><b>À revoir (${review.size})</b><br><span>Rejoue uniquement tes erreurs.</span></div></button>
   </div>
   <div class="sect">Cette semaine</div>
   <div class="defi"><div class="wk">DÉFI ${w}</div><h2>Défi de la semaine</h2>
     <p>Les mêmes 20 questions pour toute l'équipe. Joue, puis partage ton score dans le groupe.</p>
     ${dd?`<p class="done">Ton premier essai : <b>${dd.score}/20</b> en ${fmtTime(dd.ms)}</p>`:""}
     <div class="actions" style="margin-top:0"><button class="btn" id="defiGo">${dd?"Rejouer":"Relever le défi"}</button>${dd?`<button class="btn sec" id="defiShare">Partager</button>`:""}</div><p class="small" id="defiMsg" style="color:#fff;opacity:.8"></p></div>
   ${homeBoard()}
   <footer class="note">Questions tirées des référentiels du parcours CI BSPP (Guide pratique CI, BSP 112/115/118/200.2/200.20/300.16, MACA 2025-2026, eFiBi…) et, en bonus, du guide PSE CRF. En cas de doute, le référentiel en vigueur fait foi.</footer>
   <footer class="note" style="margin-top:10px"><b>Application non officielle.</b> Elle n'est ni éditée ni validée par la BSPP ni par la Croix-Rouge française et sert uniquement à s'entraîner et à réviser. Développée par l'Unité Locale de Paris XVIII de la Croix-Rouge française.</footer>`;
  bindLevel();app.querySelectorAll(".chip[data-t]").forEach(c=>c.onclick=()=>{const id=c.dataset.t;selected.has(id)?selected.delete(id):selected.add(id);if(!selected.size)selected.add(id);store.set("themes",[...selected]);c.setAttribute("aria-pressed",selected.has(id))});
  $("#defiGo").onclick=()=>runQuiz(defiQuestions(),"defi",false);
  const ds=$("#defiShare");if(ds)ds.onclick=()=>shareText(`Défi CI BSPP ${w} : ${dd.score}/20 en ${fmtTime(dd.ms)}. À toi de jouer !`,$("#defiMsg"));
  app.querySelectorAll("[data-fiche]").forEach(b=>b.onclick=()=>reviseFiche(b.dataset.fiche));
  app.querySelectorAll(".tile[data-m]").forEach(m=>m.onclick=()=>({qcm:()=>runQuiz(fresh(pool("qcm")).slice(0,10),"qcm",true),chrono:runChrono,flash:()=>runFlash(fresh(pool("flashcards"))),ordre:()=>runOrdre(fresh(pool("ordre"))),cas:()=>runCas(fresh(pool("cas"))),
    exam:()=>runQuiz(fresh([...pool("qcm"),...pool("vf")]).slice(0,30),"exam",false),review:runReview,radio:()=>go("radio"),carte:()=>go("carte"),grades:()=>viewGrades(true),hosp:()=>runHospQuiz(true),marks:()=>{revTab="marks";go("revise")}})[m.dataset.m]());
}

/* ============ Jeux ============ */
/* Encouragements adaptés au niveau : plus chaleureux pour qui débute ou se trompe souvent, plus sobres pour qui est à l'aise */
function learnerTier(){const ids=Object.keys(hist);const answered=Object.values(hist).reduce((a,h)=>a+h.length,0);
 const recent=ids.sort((a,b)=>(histT[b]||0)-(histT[a]||0)).slice(0,40).map(id=>hist[id][hist[id].length-1]);
 const rate=recent.length?recent.reduce((a,b)=>a+b,0)/recent.length:0;
 if(answered<30||rate<.55)return "debut";if(answered>=60&&rate>=.8)return "aise";return "mid"}
const FB={
 debut:{
  ok:["Bravo, c'est exactement ça !","Super, tu progresses !","Bien vu, continue comme ça !","Excellent réflexe !","Oui ! Tu as le bon raisonnement.","Génial, une de plus dans la poche !",
   "Parfait, tu apprends vite !","Bonne réponse, tu prends de l'assurance !","Yes ! Tu es sur la bonne voie.","Très bien, ça rentre !","Impeccable, continue sur ta lancée !",
   "Bien joué, le futur CI se dessine !","C'est juste ! Tu vois, tu en sais déjà plus que tu ne crois.","Top ! Ton équipage serait fier de toi.","Exactement, bravo pour ta réflexion !",
   "Bonne pioche, et pas par hasard !","Réponse validée, tu avances bien !","Bravo, tu viens de marquer des points !","Super réflexe, on sent que tu as compris.","Juste ! Garde ce rythme."],
  ko:["Pas grave, c'est en se trompant qu'on apprend.","Presque ! Lis l'explication, tu l'auras la prochaine fois.","Normal de ne pas tout savoir au début, tu avances bien.","Ce n'est pas ça, mais cette explication va t'aider.",
   "Pas cette fois, mais maintenant tu sais !","Raté, mais tu viens d'apprendre quelque chose d'utile.","Ce n'était pas évident, celle-là !","Pas de souci : même les chefs d'agrès ont commencé par là.",
   "Erreur de débutant, et c'est très bien : on est là pour apprendre.","Tu y étais presque ! Jette un œil à l'explication.","Une erreur aujourd'hui, une bonne réponse en garde demain.","Pas grave du tout : retiens juste l'idée principale.",
   "Ce n'est pas la bonne, mais tu as eu raison d'essayer.","On ne naît pas CI, on le devient : continue !","Pas tout à fait, mais tu progresses à chaque question.","C'est noté pour la prochaine fois : tu vas la réussir."],
  ko2:["Courage ! Prends le temps de lire l'explication et la page du référentiel : ça aide énormément.","On s'accroche ! Tout le monde est passé par là, chaque erreur te fait progresser.",
   "Petite série difficile : respire, relis l'explication, et ça va revenir.","Ne lâche rien ! Les questions difficiles sont celles qui t'apprennent le plus.","Tu as le droit de trébucher : l'important, c'est de continuer.",
   "Ça arrive à tout le monde ! Le référentiel est à un clic pour t'aider.","Tiens bon, la prochaine sera la bonne !","C'est en forgeant qu'on devient forgeron : tu es en plein apprentissage.",
   "Pas de panique : un CI garde son calme, même dans une série compliquée.","Ces erreurs-là, tu ne les referas plus. Continue !"],
  back:["Et voilà, tu te reprends bien !","Bien joué, c'est reparti !","Le voilà, ce retour en force !","Tu vois ? Il suffisait d'y croire !","Superbe rebond, bravo !","Ah, ça fait du bien ! Continue comme ça.","Retour gagnant, tu remontes la pente !","Bravo, tu t'es accroché et ça paie !"]},
 mid:{
  ok:["Exact !","Bien joué !","Bonne réponse.","C'est ça !","Très bien.","Bien vu.","Juste !","Parfait.","Dans le mille !","Correct, bravo.","Bonne lecture du référentiel.","Réponse validée.","Tu maîtrises.","Nickel.","Bien raisonné."],
  ko:["Raté, retiens bien l'explication.","Pas tout à fait.","Non, mais tu étais proche.","Pas cette fois.","Erreur : relis la page citée.","Ce n'est pas ça.","Presque, mais non.","Pas la bonne réponse.","À revoir.","Raté, celle-là méritait réflexion.","Non, regarde bien la nuance.","Pas ça : note-le pour la suite."],
  ko2:["Deux de suite : relis bien l'explication.","Petite baisse de régime : prends ton temps.","Deux erreurs : le référentiel peut t'aider.","Concentre-toi, tu connais la réponse.","Ralentis un peu et lis bien chaque choix.","Série compliquée, reste attentif."],
  back:["Exact, tu te reprends !","C'est reparti.","Bien rattrapé.","Voilà qui est mieux.","Bonne réponse, bien rebondi.","Retour dans le bon sens."]},
 aise:{
  ok:["Correct.","Exact.","Juste.","Imparable.","Validé.","Sans hésitation.","Précis.","Nickel.","Évidemment.","Du travail de pro.","Rien à redire.","Propre."],
  ko:["Erreur : à revoir.","Raté.","Piège classique, celui-là.","Inattendu de ta part.","Non.","Faux : vérifie la source.","Raté, ça arrive aux meilleurs.","Pas cette fois.","Erreur notée.","Point de vigilance pour toi."],
  ko2:["Attention, deux erreurs d'affilée.","Deux de suite : reste concentré.","Inhabituel : relis bien les énoncés.","Vigilance, la série se complique.","Deux ratés : un retour au référentiel s'impose."],
  back:["Correct.","Retour à la normale.","Rétabli.","Voilà.","Bien rattrapé."]}};
// tirage sans répéter les messages récents
const fbRecent=[];
function pickFresh(list){const avail=list.filter(m=>!fbRecent.includes(m));const m=pick(avail.length?avail:list);fbRecent.push(m);if(fbRecent.length>Math.min(12,Math.max(3,Math.floor(list.length*.6))))fbRecent.shift();return m}
let fbStreak=0;
function sgtLine(ok){const rate=cnt.answered>=20?cnt.correct/cnt.answered:.6;const cocky=fbStreak>=3||rate>=.85;
 if(ok){if(fbStreak<=-2)return pickFresh(SGT.oklate);if(fbStreak>=3||(rate>=.85&&Math.random()<.6))return pickFresh(SGT.okcocky);return pickFresh(FIRE_OK)}
 if(cocky&&fbStreak>=0)return pickFresh(SGT.kococky);if(fbStreak<=-2||(rate<.5&&fbStreak<=-1))return pickFresh(SGT.ko3);if(fbStreak===-1)return pickFresh(SGT.ko2);return pickFresh(FIRE_KO)}
function cheer(ok){if(typeof fxMode!=="undefined"&&fxMode!=="off"){const r=sgtLine(ok);if(ok)fbStreak=fbStreak>0?fbStreak+1:1;else fbStreak=fbStreak<0?fbStreak-1:-1;fireFx(ok);return r}
const t=FB[learnerTier()];let m;
 if(ok){m=pickFresh(fbStreak<=-2?t.back:t.ok);fbStreak=fbStreak>0?fbStreak+1:1}
 else{fbStreak=fbStreak<0?fbStreak-1:-1;m=pickFresh(fbStreak<=-2?t.ko2:t.ko)}
 return m}
const ENDMSG={
 debut:[["Formidable, tu es prêt pour la suite !","Quel score ! Tu peux être fier de toi.","Impressionnant pour un début, bravo !","Superbe partie, tu as tout compris !"],
  ["Très beau résultat, continue !","Belle partie, tu progresses vraiment !","Bravo, c'est un très bon score !","Tu montes en compétence, ça se voit !"],
  ["Bon travail, tu progresses à chaque partie !","La moitié est acquise, la suite viendra vite !","Pas mal du tout, continue à t'entraîner !","Tu poses de bonnes bases, bravo !"],
  ["Bravo d'avoir joué : relis le corrigé, la prochaine sera meilleure !","Chaque partie te rapproche du but, continue !","Le plus dur, c'est de commencer : c'est fait !","Relis les explications tranquillement, puis retente : tu verras la différence."]],
 mid:[["Prêt pour la garde","Excellent score","Très solide, bravo"],["Solide, encore un effort","Bon niveau, continue","Bien, tu y es presque"],["À consolider","Moyen, mais en progrès","Encore quelques révisions"],["Relis le corrigé et retente ta chance","Partie difficile : retour aux explications","Retente après une petite révision"]],
 aise:[["Prêt pour la garde.","Sans faute ou presque.","Niveau confirmé."],["Solide.","Bon niveau.","Quelques points à affiner."],["À consolider.","En dessous de ton niveau habituel.","Révision conseillée."],["Retour au référentiel.","Partie ratée : on révise.","À reprendre à tête reposée."]]};
const FIRE_END=[["IMPECCABLE ! Je n'ai rien à redire. Ça m'énerve.","Score de chef ! Rompez !"],["Correct. Mais je veux mieux la prochaine fois, c'est clair ?!","Pas mal. PAS MAL N'EST PAS ASSEZ !"],["Moyen ! On recommence, et cette fois avec le cerveau branché !","La moitié ? On ne sauve pas la moitié d'une victime !"],["Catastrophe ! Retour au référentiel, au pas de course !","J'ai vu des extincteurs vides plus performants ! On recommence !"]];
function grade(p){if(typeof fxMode!=="undefined"&&fxMode!=="off"){if(p<40&&Math.random()<.6)return pick(SGT.endbad);if(p>=100&&Math.random()<.6)return pick(SGT.endcocky);return pick(FIRE_END[p>=90?0:p>=70?1:p>=50?2:3])}const L=ENDMSG[learnerTier()];return pick(L[p>=90?0:p>=70?1:p>=50?2:3])}
function srcBtn(it){if(!it.ref||!DOC[it.ref.d])return `<span class="src">Source : ${esc(it.source)}</span>`;
  return `<button class="srcbtn" data-src="${esc(it._id)}">${I.doc}<span>Voir dans le référentiel · ${esc(DOC[it.ref.d].t)}, p. ${it.ref.p}</span></button>`}
function bindSrc(root=app){root.querySelectorAll("[data-src]").forEach(b=>b.onclick=()=>{const it=BYID[b.dataset.src];openDoc(it.ref.d,it.ref.p,termsFor(it))})}
function termsFor(it){const txt=it._k==="qcm"?it.choices[it.answer]+" "+it.explication:it._k==="vf"?it.q:it._k==="flashcards"?it.verso:it.titre;return tokens(txt).slice(0,8)}
const MODE_T={exam:"Examen blanc",review:"À revoir",defi:"Défi de la semaine",qcm:"Quiz",fiche:"Révision de fiche"};
function runQuiz(qs,mode,instant,back){qs=(qs||[]).map(mixQ);
  if(!qs.length){app.innerHTML=push("Quiz")+`<p class="sub" style="margin-top:20px">Aucune question pour ces thèmes.</p>`;bindBack(back);return}
  let i=0,score=0;const answers=[];const t0=Date.now();
  const show=()=>{const q=qs[i];
    const choices=q._k==="qcm"?`<div class="opts">${q.choices.map((c,k)=>`<button class="opt" data-k="${k}"><span class="k">${LETTERS[k]}</span><span>${esc(c)}</span></button>`).join("")}</div>`
      :`<div class="vf"><button class="opt" data-k="1">VRAI</button><button class="opt" data-k="0">FAUX</button></div>`;
    app.innerHTML=push(MODE_T[mode]||"Quiz",`${i+1}/${qs.length}`)+`<div class="bar"><i style="width:${i/qs.length*100}%"></i></div>
      ${qhead(q,q._k==="vf"?" · vrai ou faux":"")}<p class="qtext">${esc(q.q)}</p>${choices}<div id="after"></div>`;
    bindBack(back);
    app.querySelectorAll(".opt").forEach(b=>b.onclick=()=>{
      const k=+b.dataset.k;const correct=q._k==="qcm"?q.answer:(q.answer?1:0);const ok=k===correct;
      if(ok)score++;if(mode!=="defi"||!defiDone[isoWeek()])record(q._id,ok,mode==="defi"?5:0);answers.push({q,ok});
      if(navigator.vibrate)navigator.vibrate(ok?15:[30,40,30]);
      if(instant){app.querySelectorAll(".opt").forEach(o=>{o.disabled=true;if(+o.dataset.k===correct)o.classList.add("good");else if(o===b)o.classList.add("bad")});
        $("#after").innerHTML=`<div class="fb ${ok?"good":"bad"}"><b>${cheer(ok)}</b>${esc(q.explication)}${srcBtn(q)}</div><div class="actions"><button class="btn full" id="next">${i+1<qs.length?"Question suivante":"Voir le score"}</button></div>`;
        bindSrc();const n=$("#next");n.onclick=()=>{i++;i<qs.length?show():end()};n.scrollIntoView({behavior:"smooth",block:"nearest"});
      }else{i++;i<qs.length?show():end()}});
  };
  const end=()=>{const ms=Date.now()-t0;const p=Math.round(score/qs.length*100);
    if(["qcm","exam"].includes(mode))setBest(mode,p);setTimeout(syncSoon,50);
    const w=isoWeek();let first=false;if(mode==="defi"&&!defiDone[w]){defiDone[w]={score,ms};store.set("defi",defiDone);first=true}
    const recap=answers.filter(a=>!a.ok).map(({q})=>`<div class="card"><div class="qhead"><b>${esc(q.q)}</b>${markBtn(q._id,false)}</div><div class="a">${esc(q._k==="qcm"?q.choices[q.answer]:(q.answer?"Vrai":"Faux"))}</div><div class="e">${esc(q.explication)}</div>${srcBtn(q)}</div>`).join("");
    app.innerHTML=push("Résultat")+`<div class="result"><div class="score">${score}/${qs.length}</div><div class="grade">${grade(p)}</div>${p<50&&level==="expert"&&learnerTier()==="debut"?`<p class="small">Astuce : le niveau Sapeur propose des questions de découverte, idéales pour démarrer. Tu peux le choisir en haut de l'accueil.</p>`:""}<p class="small">${p} % de bonnes réponses${mode==="defi"?` en ${fmtTime(ms)}${first?"":" (hors premier essai)"}`:""}.</p></div>
      <div class="actions"><button class="btn" id="again">Rejouer</button>${mode==="defi"||mode==="exam"?`<button class="btn sec" id="shareRes">${I.share.replace('<svg','<svg width="18" height="18"')} Partager</button>`:""}</div><p class="small" id="shareMsg"></p>
      ${recap?`<div class="sect">Corrigé de tes erreurs</div><div class="recap">${recap}</div>`:`<p class="sub" style="text-align:center">Sans faute, bravo.</p>`}`;
    bindBack(back);bindSrc();
    const sh=$("#shareRes");if(sh)sh.onclick=()=>shareText(mode==="defi"?`Défi CI BSPP ${w} : ${score}/${qs.length} en ${fmtTime(ms)}. À toi de jouer !`:`Examen blanc CI BSPP : ${score}/${qs.length} (${p} %).`,$("#shareMsg"));
    $("#again").onclick=()=>mode==="defi"?runQuiz(defiQuestions(),"defi",false):runQuiz(shuffle(qs),mode,instant,back);
    window.scrollTo(0,0)};
  show();
}
function runChrono(){
  const qs=fresh(pool("vf"));if(!qs.length)return;
  let i=0,score=0,errs=0,timer,over=false;const missed=[];let deadline=Date.now()+60000;
  const left=()=>Math.max(0,Math.ceil((deadline-Date.now())/1000));
  const stop=()=>clearInterval(timer);
  const show=()=>{const q=qs[i%qs.length];
    cleanup=null; // ne pas arrêter le chrono en changeant de question
    app.innerHTML=push("Vrai ou faux 60 s",`${score} pts`)+`<div style="display:flex;justify-content:space-between;align-items:center;margin-top:16px"><span class="qtag">${esc(short(q._t))}</span><span class="timer" id="tm">${left()} s</span></div><p class="qtext">${qHtml(q)}</p><div class="vf"><button class="opt" data-k="1">VRAI</button><button class="opt" data-k="0">FAUX</button></div>`;
    cleanup=stop;bindBack();app.querySelectorAll(".opt").forEach(b=>b.onclick=()=>answer(+b.dataset.k))};
  const answer=k=>{if(over)return;const q=qs[i%qs.length];const ok=(k===1)===q.answer;record(q._id,ok);if(ok)score++;else{errs++;deadline-=3000;missed.push(q)}if(navigator.vibrate)navigator.vibrate(ok?12:[30,40,30]);i++;left()>0?show():end()};
  const end=()=>{if(over)return;over=true;stop();cleanup=null;setBest("chrono",score);setTimeout(syncSoon,50);
    app.innerHTML=push("Résultat")+`<div class="result"><div class="score">${score}</div><div class="grade">bonnes réponses en 60 s</div><p class="small">${errs} erreur(s) · chaque erreur coûte 3 s</p></div><div class="actions"><button class="btn full" id="again">Rejouer</button></div>
     ${missed.length?`<div class="sect">Ce que tu as raté</div><div class="recap">${missed.map(q=>`<div class="card"><div class="qhead"><b>${qHtml(q)}</b>${markBtn(q._id,false)}</div><div class="a">${q.answer?"VRAI":"FAUX"}</div><div class="e">${esc(q.explication)}</div>${srcBtn(q)}</div>`).join("")}</div>`:""}`;
    bindBack();bindSrc();$("#again").onclick=runChrono};
  timer=setInterval(()=>{const t=left();const el=$("#tm");if(el)el.textContent=t+" s";if(t<=0)end()},250);
  show();
}
function runFlash(cards,back){
  let i=0,kn=0;const again=[];
  const show=()=>{if(i>=cards.length){
      app.innerHTML=push("Flashcards")+`<div class="result"><div class="score">${kn}/${cards.length}</div><div class="grade">cartes connues</div></div><div class="actions">${again.length?`<button class="btn full" id="redo">Revoir les ${again.length} cartes ratées</button>`:""}<button class="btn sec full" id="all2">Tout reprendre</button></div>`;
      bindBack(back);const r=$("#redo");if(r)r.onclick=()=>runFlash(shuffle(again),back);$("#all2").onclick=()=>runFlash(shuffle(cards),back);return}
    const c=cards[i];
    app.innerHTML=push("Flashcards",`${i+1}/${cards.length}`)+`<div class="bar"><i style="width:${i/cards.length*100}%"></i></div>
      <div class="fcard" id="card" tabindex="0" role="button" aria-label="Retourner la carte"><div class="fin">
       <div class="face"><span class="qtag">${esc(short(c._t))}</span><div class="t">${esc(c.recto)}</div><span class="h">Touche pour retourner</span></div>
       <div class="face back"><div style="font-size:17px">${esc(c.verso)}</div>${srcBtn(c)}${markBtn(c._id)}<span class="h">Glisse → si tu savais, ← à revoir</span></div></div></div>
      <div class="actions" id="eval" style="visibility:hidden"><button class="btn sec" style="flex:1" id="no">À revoir</button><button class="btn" style="flex:1" id="yes">Je savais</button></div>`;
    bindBack(back);bindSrc();const card=$("#card");
    const flip=e=>{if(e&&e.target.closest("[data-src],[data-mk]"))return;card.classList.toggle("flip");$("#eval").style.visibility="visible"};
    card.onclick=flip;card.onkeydown=e=>{if(e.key===" "||e.key==="Enter"){e.preventDefault();flip()}};
    let sx=null;card.addEventListener("touchstart",e=>{sx=e.touches[0].clientX},{passive:true});
    card.addEventListener("touchend",e=>{if(sx==null)return;const dx=e.changedTouches[0].clientX-sx;sx=null;if(!card.classList.contains("flip")||Math.abs(dx)<60)return;e.preventDefault();$(dx>0?"#yes":"#no").click()});
    $("#yes").onclick=()=>{kn++;record(c._id,true);i++;show()};$("#no").onclick=()=>{again.push(c);record(c._id,false);i++;show()};
  };show();
}
function runOrdre(items,back){let i=0;
  const show=()=>{if(i>=items.length){back?back():go(tab);return}
    const it=items[i];markSeen(it._id);let cur=shuffle(it.etapes.map((s,k)=>({s,k})));if(cur.length>1&&cur.every((c,k)=>c.k===k))cur.reverse();
    const draw=checked=>{
      app.innerHTML=push("Remets dans l'ordre",`${i+1}/${items.length}`)+`<div style="margin-top:16px">${qhead(it)}</div><p class="qtext" style="margin-top:4px">${esc(it.titre.replace(/^Remets dans l'ordre\s*:\s*/i,""))}</p>
       <ol class="olist">${cur.map((c,k)=>`<li class="oitem ${checked?(c.k===k?"good":"bad"):""}"><span class="n">${k+1}</span><span class="t">${esc(c.s)}</span>${checked?"":`<span class="mv"><button data-u="${k}" aria-label="Monter">▲</button><button data-d="${k}" aria-label="Descendre">▼</button></span>`}</li>`).join("")}</ol>
       <div id="after"></div><div class="actions">${checked?`<button class="btn full" id="next">${i+1<items.length?"Séquence suivante":"Terminer"}</button>`:`<button class="btn full" id="check">Vérifier</button>`}</div>`;
      bindBack(back);
      app.querySelectorAll("[data-u]").forEach(b=>b.onclick=()=>{const k=+b.dataset.u;if(k>0){[cur[k-1],cur[k]]=[cur[k],cur[k-1]];draw(false)}});
      app.querySelectorAll("[data-d]").forEach(b=>b.onclick=()=>{const k=+b.dataset.d;if(k<cur.length-1){[cur[k+1],cur[k]]=[cur[k],cur[k+1]];draw(false)}});
      if(checked){const ok=cur.every((c,k)=>c.k===k);record(it._id,ok);
        $("#after").innerHTML=`<div class="fb ${ok?"good":"bad"}"><b>${ok?"Séquence parfaite":"Pas tout à fait"}</b>${ok?"":`<ol style="margin:4px 0 6px;padding-left:20px">${it.etapes.map(s=>`<li>${esc(s)}</li>`).join("")}</ol>`}${esc(it.explication||"")}${srcBtn(it)}</div>`;bindSrc();
        $("#next").onclick=()=>{i++;show()}}else $("#check").onclick=()=>draw(true)};
    draw(false)};show()}
function runCas(items,back){let i=0;
  const show=()=>{if(i>=items.length){back?back():go(tab);return}const c=items[i];markSeen(c._id); // un cas affiché compte comme vu : il ne reviendra qu'après les autres
    app.innerHTML=push("Cas pratique",`${i+1}/${items.length}`)+`<div style="margin-top:16px">${qhead(c)}</div><h2 style="font-size:24px;margin:4px 0">${esc(c.titre)}</h2>
      <div class="situ">${esc(c.situation)}</div>
      ${c.questions.map((q,k)=>`<div class="cq"><p>${k+1}. ${esc(q.q)}</p><div id="r${k}"><button class="btn sec small" data-r="${k}">Voir la réponse</button></div></div>`).join("")}
      ${srcBtn(c)}<div class="actions"><button class="btn full" id="next">${i+1<items.length?"Cas suivant":"Terminer"}</button></div>`;
    bindBack(back);bindSrc();
    app.querySelectorAll("[data-r]").forEach(b=>b.onclick=()=>{const k=+b.dataset.r;$("#r"+k).innerHTML=`<div class="reveal">${esc(c.questions[k].reponse)}</div>`});
    $("#next").onclick=()=>{i++;show();window.scrollTo(0,0)}};show()}
function runReview(){const all=[...review].map(id=>BYID[id]).filter(x=>x&&(x._k==="qcm"||x._k==="vf"));
  const fl=[...review].map(id=>BYID[id]).filter(x=>x&&x._k==="flashcards");
  if(all.length)runQuiz(shuffle(all).slice(0,15),"review",true);else if(fl.length)runFlash(shuffle(fl));}

/* ============ Réviser (corrigés) ============ */
let revTab="qcm",revQ="";
function viewRevise(){
  const lab={marks:`Marquées (<span id="mkcount">${Object.keys(marks).length}</span>)`,qcm:"QCM",vf:"Vrai/faux",flashcards:"Mémo",ordre:"Séquences",cas:"Cas"};
  app.innerHTML=`${backLink()}<h1 class="big">Réviser</h1><p class="sub">Toutes les questions avec leur réponse et le lien vers le référentiel.</p>
   <input class="search" id="rq" type="search" placeholder="Rechercher : VSAV, 4C-N, plan rouge…" value="${esc(revQ)}">
   <div class="seg" style="margin:12px 0">${Object.keys(lab).map(k=>`<button data-rt="${k}" aria-pressed="${k===revTab}">${lab[k]}</button>`).join("")}</div><div id="rl"></div>`;
  const draw=()=>{const qn=norm(revQ);const list=(revTab==="marks"?Object.keys(marks).map(id=>BYID[id]).filter(Boolean):ALL.filter(x=>x._k===revTab)).filter(x=>(!qn||norm(JSON.stringify([x.q,x.choices,x.explication,x.recto,x.verso,x.titre,x.etapes,x.situation,x.questions])).includes(qn))).slice(0,150);if(revTab==="marks")list.sort((a,b)=>marks[b._id]-marks[a._id]);
    $("#rl").innerHTML=(revTab==="marks"&&list.length?`<p class="small" style="margin:0 4px 10px">Les éléments que tu as marqués pendant les quiz, avec la réponse et le référentiel. Touche « J'ai compris » pour retirer le marqueur.</p>`:"")+list.map(it=>{let body="";
      const KL={qcm:"QCM",vf:"Vrai/faux",flashcards:"Mémo",ordre:"Séquence",cas:"Cas pratique"};
      if(it._k==="qcm")body=`<b>${esc(it.q)}</b><div class="a">${LETTERS[it.answer]}. ${esc(it.choices[it.answer])}</div><div class="e">${esc(it.explication)}</div>`;
      else if(it._k==="vf")body=`<b>${esc(it.q)}</b><div class="a">${it.answer?"VRAI":"FAUX"}</div><div class="e">${esc(it.explication)}</div>`;
      else if(it._k==="flashcards")body=`<b>${esc(it.recto)}</b><div class="e" style="color:var(--ink)">${esc(it.verso)}</div>`;
      else if(it._k==="ordre")body=`<b>${esc(it.titre)}</b><ol style="margin:6px 0;padding-left:20px">${it.etapes.map(s=>`<li>${esc(s)}</li>`).join("")}</ol>`;
      else body=`<b>${esc(it.titre)}</b><div class="e">${esc(it.situation)}</div>${it.questions.map(q=>`<div style="margin-top:8px"><i>${esc(q.q)}</i><div class="a">${esc(q.reponse)}</div></div>`).join("")}`;
      if(revTab==="marks")return `<div class="card recap mkcard" style="margin-bottom:10px;display:block"><div class="qhead" style="margin-bottom:4px"><span class="qtag">${esc(KL[it._k])} · ${esc(short(it._t))}</span><span class="small">${new Date(marks[it._id]).toLocaleDateString("fr-FR")}</span></div>${body}${srcBtn(it)}<div class="actions" style="margin-top:12px"><button class="btn small" data-unmk="${esc(it._id)}">J'ai compris</button>${it._k==="qcm"||it._k==="vf"?`<button class="btn sec small" data-retry="${esc(it._id)}">Me réinterroger</button>`:""}</div></div>`;
      return `<div class="card recap" style="margin-bottom:10px;display:block"><div class="qhead">${body.match(/^<b>.*?<\/b>/)[0]}${markBtn(it._id,false)}</div>${body.replace(/^<b>.*?<\/b>/,"")}${srcBtn(it)}</div>`}).join("")||`<p class="sub">${revTab==="marks"?"Aucune question marquée. Pendant un quiz, touche le drapeau « Marquer » sur une question que tu veux revoir plus tard.":"Aucun résultat."}</p>`;bindSrc();
    $("#rl").querySelectorAll("[data-retry]").forEach(b=>b.onclick=()=>runQuiz([BYID[b.dataset.retry]],"review",true,()=>{go("revise")}))};
  draw();
  // les questions marquées au niveau Sapeur ne sont connues qu'une fois ses questions chargées
  if(Object.keys(marks).some(id=>!BYID[id])&&typeof loadSimple==="function")loadSimple().then(()=>{if(tab==="revise"&&$("#rl"))draw()}).catch(()=>{});
  app.querySelectorAll("[data-rt]").forEach(b=>b.onclick=()=>{revTab=b.dataset.rt;app.querySelectorAll("[data-rt]").forEach(x=>x.setAttribute("aria-pressed",x===b));draw()});
  let to;$("#rq").oninput=e=>{revQ=e.target.value;clearTimeout(to);to=setTimeout(draw,180)};
}

/* ============ Recherche plein texte (assistant + documents) ============ */
const STOP=new Set("le la les un une des de du d l et ou a au aux en dans par pour sur avec sans ce cette ces qui que quoi dont est sont etre il elle ils elles on se sa son ses leur leurs pas ne plus tres tout tous toute toutes y lors entre faire fait doit doivent peut quel quelle quels quelles comment quand si ni mais car donc the of to and in is afin apres avant aussi selon via vers chez sous ainsi alors ete avoir je tu nous vous me te mon ma mes ton ta tes faut quoi comment dois passer".split(" "));
const norm=s=>String(s||"").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g,"");
function stem(w){return w.length>3&&/[sx]$/.test(w)?w.slice(0,-1):w}
function tokens(s){return (norm(s).match(/[a-z0-9]+/g)||[]).filter(w=>w.length>1&&!STOP.has(w)).map(stem)}
const SYN={acr:["arret","cardiaque","cardio"],arret:["acr"],dsa:["defibrillateur","dae"],dae:["defibrillateur","dsa"],cat:["conduite","tenir"],radio:["message"],demande:["moyen"],renfort:["moyen","demande"],deces:["decede","mort"],decede:["deces"],sp:["sapeur","pompier"],ca:["chef","agre"],ci:["chef","intervention"],cos:["commandant"],uv:["urgence","vitale"],ua:["urgence","absolue"],nnn:["nouveau","ne"],efibi:["fiche","bilan"],hemorragie:["saignement"],avp:["accident","circulation"]};
let IDX=null,IDXp=null;
function loadIndex(){if(IDX)return Promise.resolve(IDX);if(IDXp)return IDXp;
  IDXp=fetch("search.json").then(r=>{if(!r.ok)throw new Error("search");return r.json()}).then(j=>{
    const docsTf=[],df=new Map();let tot=0;
    j.chunks.forEach(c=>{const tk=tokens(c[2]);const tf=new Map();tk.forEach(w=>tf.set(w,(tf.get(w)||0)+1));docsTf.push([tf,tk.length]);tot+=tk.length;tf.forEach((v,w)=>df.set(w,(df.get(w)||0)+1))});
    const N=j.chunks.length,idf=new Map();df.forEach((n,w)=>idf.set(w,Math.log(1+(N-n+.5)/(n+.5))));
    IDX={chunks:j.chunks,tf:docsTf,idf,avg:tot/N};return IDX}).catch(e=>{IDXp=null;throw e});return IDXp}
const WEIGHT={guide:1.35,bilan:1.15,acr72:1.15,b2002:.95,pse:.7,b30016:.85,b118:.9};
function searchChunks(q,lim=5,docFilter){const ix=IDX;let qt=[...new Set(tokens(q))];const exp=[];qt.forEach(w=>(SYN[w]||[]).forEach(s=>exp.push(stem(s))));
  const res=[];for(let i=0;i<ix.chunks.length;i++){const c=ix.chunks[i];if(docFilter&&DOCS[c[0]].id!==docFilter)continue;const [tf,L]=ix.tf[i];let s=0,hit=0;
    for(const w of qt){const f=tf.get(w);if(f){hit++;s+=ix.idf.get(w)*f*2.2/(f+1.2*(.25+.75*L/ix.avg))}}
    for(const w of exp){const f=tf.get(w);if(f)s+=.4*ix.idf.get(w)*f*2.2/(f+1.2*(.25+.75*L/ix.avg))}
    if(!s)continue;s*=(.6+.4*hit/qt.length)*(WEIGHT[DOCS[c[0]].id]||1);res.push([s,i])}
  res.sort((a,b)=>b[0]-a[0]);const out=[],seen=new Set();
  for(const [s,i] of res){const c=ix.chunks[i];const key=c[0]+":"+c[1];if(seen.has(key))continue;seen.add(key);out.push({s,doc:DOCS[c[0]],p:c[1],text:c[2],terms:qt});if(out.length>=lim)break}return out}
function excerpt(text,terms,len=360){const n=norm(text);let pos=-1,bestN=-1;
  for(let i=0;i<n.length;i+=40){const win=n.slice(i,i+len);let k=0;terms.forEach(t=>{if(win.includes(t))k++});if(k>bestN){bestN=k;pos=i}}
  let start=Math.max(0,pos-20);let s=text.slice(start,start+len);if(start>0)s="… "+s;if(start+len<text.length)s+=" …";return highlight(s,terms)}
function highlight(s,terms){s=String(s||"");if(!terms||!terms.length)return esc(s);const n=norm(s);if(n.length!==s.length)return esc(s);const marks=[];
  terms.filter(t=>t.length>2).forEach(t=>{let i=0;while((i=n.indexOf(t,i))>=0){let b=i;while(b>0&&/[a-z0-9]/.test(n[b-1]))b--;let e=i+t.length;while(e<n.length&&/[a-z0-9]/.test(n[e]))e++;if(b===i)marks.push([b,e]);i=e}});
  if(!marks.length)return esc(s);marks.sort((a,b)=>a[0]-b[0]);const m=[];marks.forEach(x=>{if(m.length&&x[0]<=m[m.length-1][1])m[m.length-1][1]=Math.max(m[m.length-1][1],x[1]);else m.push(x)});
  let out="",last=0;m.forEach(([b,e])=>{out+=esc(s.slice(last,b))+"<mark>"+esc(s.slice(b,e))+"</mark>";last=e});return out+esc(s.slice(last))}
function memoFor(q){const qt=[...new Set(tokens(q))];if(!qt.length)return [];
  return ALL.filter(x=>x._k==="flashcards"||x._k==="qcm"||x._k==="ordre").map(x=>{const txt=x._k==="flashcards"?x.recto+" "+x.verso:x._k==="qcm"?x.q+" "+x.choices[x.answer]:x.titre+" "+x.etapes.join(" ");
    const tk=new Set(tokens(txt));let k=0;qt.forEach(w=>{if(tk.has(w))k++});return[k/qt.length+(x._k==="flashcards"?.05:0),x]}).filter(a=>a[0]>=.6).sort((a,b)=>b[0]-a[0]).slice(0,2).map(a=>a[1])}

/* ============ Assistant ============ */
let chatLog=[];
const SUGG=["Message de demande de moyens","Conduite à tenir devant un ACR","Victime décédée : que faire ?","Cas de non contact","Équipage en danger","Statuts radio ANTARES","Relevé positif du détecteur de CO","Délai d'attente à l'hôpital"];
function viewChat(){
  app.innerHTML=`${backLink()}<h1 class="big">Assistant</h1><p class="sub">Pose une question sur une conduite à tenir, une procédure ou un message radio. Je retrouve les passages des référentiels, hors réseau.</p><div class="chat" id="chat"></div>`;
  $("#composer").hidden=false;renderChat();
  $("#cform").onsubmit=e=>{e.preventDefault();const v=$("#cin").value.trim();if(!v)return;$("#cin").value="";ask(v)};
}
function renderChat(){const c=$("#chat");if(!c)return;
  c.innerHTML=(chatLog.length?"":`<div class="msg bot">Bonjour ! Exemples de questions :<div class="sugg" style="margin-top:10px">${SUGG.map(s=>`<button data-sg="${esc(s)}">${esc(s)}</button>`).join("")}</div></div>`)+chatLog.map(m=>m.me?`<div class="msg me">${esc(m.text)}</div>`:`<div class="msg bot">${m.html}</div>`).join("");
  c.querySelectorAll("[data-sg]").forEach(b=>b.onclick=()=>ask(b.dataset.sg));
  c.querySelectorAll("[data-open]").forEach(b=>b.onclick=()=>{const [d,p,t]=b.dataset.open.split("|");openDoc(d,+p,t?t.split(","):[])});
  bindSrc(c);window.scrollTo(0,document.body.scrollHeight)}
async function ask(q){chatLog.push({me:1,text:q});const wait={html:`<span class="typing"><i></i><i></i><i></i></span> ${IDX?"":"Chargement des référentiels…"}`};chatLog.push(wait);renderChat();
  try{await loadIndex()}catch(e){wait.html="Je n'arrive pas à charger les référentiels. Ouvre l'appli une fois avec du réseau pour les télécharger.";renderChat();return}
  await new Promise(r=>setTimeout(r,30));
  const hits=searchChunks(q,4);const memos=memoFor(q);
  if(!hits.length&&!memos.length){wait.html="Je n'ai rien trouvé dans les référentiels. Essaie avec d'autres mots-clés (ex. « demande de moyens », « ACR », « non contact »).";renderChat();return}
  let h="";
  if(memos.length)h+=memos.map(x=>`<div class="memo"><b>À retenir</b>${x._k==="flashcards"?`<i>${esc(x.recto)}</i> : ${esc(x.verso)}`:x._k==="qcm"?`${esc(x.q)} <b style="display:inline;text-transform:none;letter-spacing:0;font-size:inherit">→ ${esc(x.choices[x.answer])}</b>`:`${esc(x.titre)}<ol style="margin:4px 0 0;padding-left:18px">${x.etapes.map(s=>`<li>${esc(s)}</li>`).join("")}</ol>`}${srcBtn(x)}</div>`).join("");
  h+=`<div style="margin-top:${memos.length?10:0}px">${hits.length?"Dans les référentiels :":""}</div>`+hits.map(r=>`<button class="hit" data-open="${r.doc.id}|${r.p}|${r.terms.join(",")}"><span class="d">${esc(r.doc.t)} · p. ${r.p}</span><p>${excerpt(r.text,r.terms)}</p></button>`).join("");
  wait.html=h;renderChat()}

/* ============ Recherche de CRI (Codes Retour Intervention) ============ */
// Source : Guide pratique CI BSPP, annexe « Les codes retours intervention » (p. 51-52) et exemples p. 36 et 50 ; BSP 200.2 « Définition de la victime » pour 451/452.
const CRI_FAM={"0":"Fausses alertes","2":"Circulation","3":"Secours à victimes","4":"Assistance à personne","9":"Reconnaissances et recherches","S":"Message secondaire"};
const CRI=[
 ["001","Fausse alerte erreur","fausse alerte erreur adresse personne introuvable rien"],
 ["004","Intervention annulée par le CO","annulation annule depart arrete centre operationnel contre ordre","Préciser l'auteur de l'annulation (ex. « annulé par le CO »)."],
 ["009","Autres fausses alertes","fausse alerte malveillant canular"],
 ["200","Accident de circulation traité avant notre arrivée","accident circulation avp deja traite parti"],
 ["201","Accident de circulation pris en charge par un service public","accident circulation avp police samu autre service public"],
 ["202","Accident de circulation du ressort d'un organisme privé ou d'un tiers","accident circulation avp prive ambulance privee tiers depanneuse"],
 ["220","Piéton victime d'un accident de la circulation","pieton renverse accident circulation avp percute voiture"],
 ["221","Accident d'un deux-roues sur voie rapide","deux roues moto scooter velo trottinette voie rapide periph autoroute accident avp"],
 ["222","Accident d'un véhicule de tourisme sur voie rapide","voiture vl vehicule leger voie rapide periph autoroute accident avp"],
 ["223","Accident d'un poids lourd sur voie rapide","poids lourd camion pl bus voie rapide periph autoroute accident avp"],
 ["224","Accident d'un deux-roues sur d'autres voies","deux roues moto scooter velo trottinette rue route accident avp chute"],
 ["225","Accident d'un véhicule de tourisme sur d'autres voies","voiture vl vehicule leger rue route accident avp"],
 ["226","Accident d'un poids lourd sur d'autres voies","poids lourd camion pl bus rue route accident avp"],
 ["227","Accident entre véhicules différents (VL/VL, PL/PL, VL/PL…) sur voie rapide","collision plusieurs vehicules voie rapide periph autoroute accident avp"],
 ["228","Accident entre véhicules différents (VL/VL, PL/PL, VL/PL…) sur d'autres voies","collision plusieurs vehicules rue route accident avp"],
 ["229","Autre secours routier sans désincarcération","secours routier accident avp autre"],
 ["290","Autre intervention concernant la circulation","circulation route autre"],
 ["300","Secours à victime traité avant notre arrivée","deja traite parti avant arrivee victime"],
 ["301","Secours à victime traité ou du ressort d'un service public","samu smur police autre service public pris en charge"],
 ["302","Secours à victime traité ou du ressort d'un organisme privé (ou d'un tiers)","ambulance privee medecin sos medecin tiers pris en charge"],
 ["310","Intoxication","intoxication alcool ivresse ebriete alcoolisation drogue stupefiant overdose medicament ingestion monoxyde co fumee","CRI courant (Guide p. 36). Exemple de message de rentrée : victime inconnue en état d'ébriété (Guide p. 50)."],
 ["320","Affection médicale (malaise, maladie)","malaise maladie affection medicale douleur thoracique avc diabete hypoglycemie convulsion epilepsie fievre detresse respiratoire asthme acr arret cardiaque psychiatrie accouchement femme enceinte","CRI courant « Maladie » (Guide p. 36)."],
 ["336","Victime tombée sur la voie (métro)","metro voie rame chute sur les voies personne sous metro"],
 ["337","Victime tombée sur la voie (RER et autre réseau ferré)","rer train sncf voie ferree chute sur les voies"],
 ["338","Victime tombée sur la voie (tramway)","tramway tram voie chute"],
 ["340","Transport de victime(s)","transport evacuation"],
 ["341","Brancardage de victime(s)","brancardage brancard escaliers renfort"],
 ["342","Transport et brancardage de victime(s)","transport brancardage brancard"],
 ["343","Relevage de personne impotente","relevage personne agee tombee au sol impotente ne peut pas se relever sans blessure chute de sa hauteur domicile","CRI courant (Guide p. 36)."],
 ["344","Relevage et brancardage de patient « grand obèse » (> 150 kg)","obese forte corpulence grand obese 150 kg relevage brancardage vtba"],
 ["350","Blessé par explosion","explosion blast"],
 ["351","Blessé par effondrement, éboulement…","effondrement eboulement chute de materiaux"],
 ["352","Blessé par arme à feu (hors suspicion d'agression)","arme a feu balle tir accident chasse"],
 ["353","Blessé par arme blanche (hors suspicion d'agression)","arme blanche couteau accident"],
 ["354","Blessé par piqûre ou morsure d'animal","morsure chien piqure guepe abeille animal serpent"],
 ["355","Blessé par brûlure (hors incendie)","brulure eau bouillante chimique"],
 ["356","Blessé par chute","chute tombe tombee personne agee trauma traumatisme fracture plaie tete escalier blesse","CRI courant (Guide p. 36)."],
 ["357","Blessé par pièce d'artifice ou pétard","artifice petard feu d'artifice"],
 ["358","Blessé par coupure (hors arme blanche)","coupure plaie verre outil"],
 ["359","Autre secours à victime blessée","blesse traumatisme autre"],
 ["360","Pendaison, strangulation, suffocation","pendaison strangulation suffocation etouffement"],
 ["361","Noyade, submersion","noyade submersion eau seine piscine"],
 ["362","Électrocution, électrisation","electrocution electrisation courant electrique"],
 ["363","Foudroiement","foudre orage"],
 ["364","Écrasement, compression par masses importantes","ecrasement compression incarceration charge lourde"],
 ["369","Autre suffocation mécanique, submersion, électrocution…","suffocation submersion electrocution autre"],
 ["380","Personne décédée, constat sans autre indication","deces decede mort dcd constat signes de mort"],
 ["390","Blessé par arme à feu avec suspicion d'agression","agression arme a feu balle tir"],
 ["391","Blessé par arme blanche avec suspicion d'agression","agression couteau arme blanche poignarde rixe"],
 ["399","Autre secours à victime(s)","autre secours a victime agression coups rixe violence","CRI courant (Guide p. 36)."],
 ["400","Assistance à personne effectuée avant notre arrivée","assistance deja effectuee"],
 ["401","Assistance à personne effectuée par un service public","assistance police service public"],
 ["402","Assistance à personne effectuée par un tiers","assistance tiers famille voisin"],
 ["451","Pas une victime, avec notion de vulnérabilité (bilan réalisé)","pas une victime non victime sdf sans abri personne agee sourde dehors chaleur froid etrangere vulnerable doute","Vulnérabilité identifiée ou doute : réaliser un bilan et une fiche bilan avant de conclure. Pas de contact avec la coordination médicale (BSP 200.2, définition de la victime)."],
 ["452","Pas une victime, sans notion de vulnérabilité","pas une victime non victime dormait vol sans agression va bien refus personne endormie","Personne ne présentant aucune caractéristique de victime (ex. victime d'un vol sans agression, personne qui dormait). Pas de contact avec la coordination médicale (BSP 200.2)."],
 ["490","Autre forme d'assistance à personne","assistance autre ouverture porte"],
 ["919","Pas de victime trouvée (recherche)","pas de victime trouvee personne introuvable recherche confirmation adresse","Exemple de message de rentrée : « 1/ Recherche – 5/ Néant », sans remplir de fiche bilan (Guide p. 50)."],
 ["939","Autre recherche ou reconnaissance","recherche reconnaissance"],
 ["SEC","Message de rentrée secondaire (renfort, ex. brancardage)","secondaire renfort brancardage deuxieme engin","Exemple : « 1/ Brancardage – 2/ Néant – CRI : SEC » (Guide p. 50)."],
];
let criQ="",criFam="all";
function criScore(c,q){const qt=[...new Set(tokens(q))];if(!qt.length)return 1;const hay=new Set(tokens(c[0]+" "+c[1]+" "+(c[2]||"")+" "+(c[3]||"")));const code=q.replace(/\D/g,"");let s=0;
  if(code&&c[0].startsWith(code))s+=5;qt.forEach(w=>{if(hay.has(w))s+=2;else if([...hay].some(h=>h.startsWith(w)&&w.length>=3))s+=1});return s}
function viewCri(){
  app.innerHTML=`${backLink()}<h1 class="big">Codes CRI</h1><p class="sub">Trouve le code retour intervention à indiquer à la fin du message de rentrée. Décris l'intervention ou tape un code.</p>
   <input class="search" id="cq" type="search" placeholder="ex. personne âgée tombée, ivresse, pas une victime, 343…" value="${esc(criQ)}">
   <div class="chips" style="margin-top:12px">${[["all","Tous"],["C","Les plus courants"],...Object.entries(CRI_FAM)].map(([k,l])=>`<button class="chip" data-cf="${k}" aria-pressed="${k===criFam}">${esc(l)}</button>`).join("")}</div>
   <div id="clist" style="margin-top:12px"></div>
   <footer class="note">Liste issue de l'annexe du Guide pratique CI (p. 51-52) : elle n'est pas exhaustive. La liste complète est disponible au PVO ; en cas de doute, demande conseil au PVO ou au sergent de jour. Les pratiques peuvent varier selon les groupements.</footer>`;
  const COMMON=["310","356","320","399","343"];
  const draw=()=>{let list=CRI.filter(c=>criFam==="all"||(criFam==="C"?COMMON.includes(c[0])||c[0].startsWith("22"):c[0][0]===criFam));
    if(criQ.trim()){const sc=list.map(c=>[criScore(c,criQ),c]).filter(x=>x[0]>0).sort((a,b)=>b[0]-a[0]);const top=sc.length?sc[0][0]:0;list=sc.filter(x=>x[0]>=Math.max(2,top*0.5)).map(x=>x[1])}
    $("#clist").innerHTML=list.length?`<div class="list">${list.map(c=>`<details class="cri"><summary class="row"><span class="crc">${esc(c[0])}</span><span class="tx"><b>${esc(c[1])}</b><span>${esc(CRI_FAM[c[0][0]]||"")}${COMMON.includes(c[0])?" · courant":""}</span></span></summary>${c[3]?`<div class="crinote">${esc(c[3])}</div>`:""}<div class="crinote"><button class="srcbtn" data-crisrc="${["451","452"].includes(c[0])?"victime|1":"guide|"+(["919","SEC"].includes(c[0])?50:c[0]>="340"?52:51)}">${I.doc}<span>Voir dans le référentiel</span></button></div></details>`).join("")}</div>`
      :`<p class="sub">Aucun code trouvé. Essaie d'autres mots (ex. « chute », « malaise », « intoxication ») ou consulte la liste complète au PVO.</p>`;
    $("#clist").querySelectorAll("[data-crisrc]").forEach(b=>b.onclick=e=>{e.preventDefault();const [d,p]=b.dataset.crisrc.split("|");openDoc(d,+p,tokens(criQ))})};
  draw();
  app.querySelectorAll("[data-cf]").forEach(b=>b.onclick=()=>{criFam=b.dataset.cf;app.querySelectorAll("[data-cf]").forEach(x=>x.setAttribute("aria-pressed",x===b));draw()});
  let to;$("#cq").oninput=e=>{criQ=e.target.value;clearTimeout(to);to=setTimeout(draw,150)};
}

/* ============ Mode simple (découverte) ============ */
let level=store.get("level","expert");
const SPARK='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z"/></svg>';
const SEARCH_IC='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>';
const LTN_HELM='<svg class="lhelm" viewBox="22 6 156 186" aria-hidden="true"> <defs> <linearGradient id="lhsh" x1="0" x2="1" y1="0" y2="0"> <stop offset="0" stop-color="#6f7782"/><stop offset=".18" stop-color="#c9ced6"/><stop offset=".38" stop-color="#ffffff"/> <stop offset=".55" stop-color="#dfe3e8"/><stop offset=".78" stop-color="#9aa1ab"/><stop offset="1" stop-color="#59606a"/> </linearGradient> <linearGradient id="lhshv" x1="0" x2="0" y1="0" y2="1"> <stop offset="0" stop-color="#fff" stop-opacity=".55"/><stop offset=".5" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#2b3038" stop-opacity=".35"/> </linearGradient> <linearGradient id="lhcrest" x1="0" x2="1"> <stop offset="0" stop-color="#8d949e"/><stop offset=".45" stop-color="#ffffff"/><stop offset="1" stop-color="#7c838d"/> </linearGradient> <linearGradient id="lhgold" x1="0" x2="0" y1="0" y2="1"> <stop offset="0" stop-color="#5a3a08"/><stop offset=".35" stop-color="#b98a2c"/><stop offset=".7" stop-color="#e9c46a"/><stop offset="1" stop-color="#a87418"/> </linearGradient> <linearGradient id="lhgoldh" x1="0" x2="1"> <stop offset="0" stop-color="#000" stop-opacity=".35"/><stop offset=".3" stop-color="#000" stop-opacity="0"/><stop offset=".7" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".35"/> </linearGradient> <linearGradient id="lhplate" x1="0" x2="1" y1="0" y2="1"> <stop offset="0" stop-color="#f5e2a8"/><stop offset=".5" stop-color="#c9a24a"/><stop offset="1" stop-color="#8a6420"/> </linearGradient> <linearGradient id="lhblk" x1="0" x2="0" y1="0" y2="1"> <stop offset="0" stop-color="#3a3f47"/><stop offset="1" stop-color="#121418"/> </linearGradient> <clipPath id="lhvis"><path d="M48 84 C68 70 132 70 152 84 C160 104 152 124 138 131 Q100 140 62 131 C48 124 40 104 48 84 Z"/></clipPath> </defs> <path d="M46 118 L154 118 L162 178 Q100 188 38 178 Z" fill="#33373e"/><path d="M46 118 L154 118 L162 178 Q100 188 38 178 Z" fill="url(#lhshv)" opacity=".5"/> <path d="M48 150 Q100 158 152 150" stroke="#000" stroke-opacity=".3" fill="none"/> <rect x="24" y="92" width="18" height="44" rx="7" fill="url(#lhblk)"/> <rect x="158" y="92" width="18" height="44" rx="7" fill="url(#lhblk)"/> <circle cx="33" cy="104" r="4.5" fill="#22262c" stroke="#555b64"/><circle cx="167" cy="104" r="4.5" fill="#22262c" stroke="#555b64"/> <path d="M34 118 C28 56 60 12 100 10 C140 12 172 56 166 118 Q160 124 150 122 L50 122 Q40 124 34 118 Z" fill="url(#lhsh)"/> <path d="M34 118 C28 56 60 12 100 10 C140 12 172 56 166 118 Q160 124 150 122 L50 122 Q40 124 34 118 Z" fill="url(#lhshv)"/> <path d="M33 92 Q36 82 42 76 L54 80 Q48 88 46 98 Z" fill="#e1141c"/> <path d="M33 104 Q33 97 34 92 L46 98 Q45 104 45 110 Z" fill="#e8ff2a"/> <path d="M167 92 Q164 82 158 76 L146 80 Q152 88 154 98 Z" fill="#e1141c"/> <path d="M167 104 Q167 97 166 92 L154 98 Q155 104 155 110 Z" fill="#e8ff2a"/> <path d="M92 14 Q100 8 108 14 L106 54 L94 54 Z" fill="url(#lhcrest)"/> <path d="M100 10 L100 54" stroke="#fff" stroke-width="1.4" stroke-opacity=".9"/> <path d="M58 44 Q72 28 90 24 Q74 36 66 56 Z" fill="#fff" opacity=".75"/> <path d="M140 40 Q150 52 154 70 Q146 58 136 50 Z" fill="#fff" opacity=".35"/> <path d="M100 40 L121 72 Q100 77 79 72 Z" fill="url(#lhplate)" stroke="#7a5716" stroke-width="1"/> <path d="M100 52 C95 58 94 63 97 67 C98 64 100 62 100 59 C101 63 104 64 103 68 C107 64 106 58 100 52 Z" fill="#7a5716" opacity=".75"/> <path d="M44 86 C64 66 136 66 156 86" fill="none" stroke="#3a3f47" stroke-width="5" stroke-linecap="round"/> <path d="M44 84 C64 64 136 64 156 84" fill="none" stroke="#e9edf2" stroke-width="1.4" stroke-linecap="round" opacity=".8"/> <path d="M48 84 C68 70 132 70 152 84 C160 104 152 124 138 131 Q100 140 62 131 C48 124 40 104 48 84 Z" fill="url(#lhgold)" stroke="#6b4a10" stroke-width="1.5"/> <g clip-path="url(#lhvis)"> <rect x="40" y="70" width="120" height="80" fill="url(#lhgoldh)"/> <path d="M44 132 L44 122 L52 122 L52 118 L60 118 L60 124 L68 124 L68 116 L74 116 L74 120 L82 120 L82 126 L90 126 L95 112 L96.6 112 L97.6 100 L99 88 L99.6 80 L100.4 80 L101 88 L102.4 100 L103.4 112 L105 112 L109 126 L116 126 L116 119 L124 119 L124 114 L130 114 L130 121 L138 121 L138 117 L146 117 L146 124 L158 124 L158 150 L44 150 Z" fill="#3b2504" opacity=".55"/> <path d="M56 86 Q90 76 126 80 Q88 86 60 104 Z" fill="#fff" opacity=".38"/><path d="M134 90 Q146 96 148 110 Q142 100 132 96 Z" fill="#fff" opacity=".3"/> </g> <path d="M62 131 Q100 140 138 131" fill="none" stroke="#f3d27a" stroke-width="2.4"/> <path d="M58 132 Q100 145 142 132 L134 152 L110 168 L90 168 L66 152 Z" fill="#15171b" stroke="#000" stroke-opacity=".5"/> <path d="M70 140 Q100 150 130 140 L127 147 Q100 156 73 147 Z" fill="#fff" opacity=".12"/> <path d="M64 134 Q100 146 136 134" fill="none" stroke="#c9a24a" stroke-width="2.2"/> <path d="M84 152 L100 160 L116 152" fill="none" stroke="#5a616b" stroke-width="2"/> </svg> ';
function levelSwitch(){return `<div class="lvl"><div class="seg"><button data-lvl="simple" aria-pressed="${level==="simple"}" title="Niveau Sapeur : questions de découverte">${gradeSvg("1CL","grade")}<span>Sapeur</span></button><button data-lvl="expert" aria-pressed="${level==="expert"}" title="Niveau Officier : questions expertes">${LTN_HELM}<span>Officier</span></button></div></div>`}
function bindLevel(){app.querySelectorAll("[data-lvl]").forEach(b=>b.onclick=()=>{if(level===b.dataset.lvl)return;level=b.dataset.lvl;store.set("level",level);viewHome();window.scrollTo(0,0)})}
let SIMPLE=null,simpleP=null;
function loadSimple(){if(SIMPLE)return Promise.resolve(SIMPLE);if(simpleP)return simpleP;
 simpleP=new Promise((res,rej)=>{const sc=document.createElement("script");sc.src="simple.js";sc.onload=()=>{const Q=window.QSIMPLE;
   Q.items.forEach(it=>{it._id=it.id;it._k=it.k;it._t={id:"s-"+it.g,theme:Q.themes[it.g]};SHORT["s-"+it.g]=Q.themes[it.g];BYID[it.id]=it});SIMPLE=Q;res(Q)};
  sc.onerror=()=>{simpleP=null;rej()};document.body.appendChild(sc)});return simpleP}
let sSel=new Set(store.get("sThemes",["guide","ssuap","acr","efibi","bsp"]));
// documents découverts : une bonne réponse sur une question simple qui s'y rapporte
function discovered(){const set=new Set();if(!SIMPLE)return set;Object.entries(hist).forEach(([id,h])=>{if(!h.includes(1))return;
  if(id.startsWith("doc:"))set.add(id.split(":")[1]);else if(id.startsWith("s:")&&BYID[id])set.add(BYID[id].ref.d)});return set}
function docQuestions(n){const Q=SIMPLE;const docs=DOCS.filter(d=>Q.fam[d.id]);
 return fresh(Q.docq.map(x=>({...x,_id:"doc:"+x.d}))).slice(0,n).map(x=>{const fam=Q.fam[x.d];const others=shuffle(docs.filter(d=>d.id!==x.d&&Q.fam[d.id]!==fam)).slice(0,2);
  const opts=shuffle([x.d,...others.map(d=>d.id)]);const D=DOC[x.d];
  return {_id:"doc:"+x.d,_k:"qcm",_t:{id:"s-doc",theme:"Devine le document"},q:x.q+" Quel document ouvres-tu ?",choices:opts.map(id=>DOC[id].t),answer:opts.indexOf(x.d),
   explication:`C'est « ${D.t} »${D.n>1?` (${D.n} pages)`:""}. Touche « Voir dans le référentiel » pour le feuilleter.`,ref:{d:x.d,p:x.p}}})}
const CHEERS=["Bien joué !","Exact !","Bravo !","Dans le mille !","Parfait !","Yes !"],OOPS=["Pas tout à fait…","Raté, mais tu viens d'apprendre quelque chose.","Presque !","Non, mais retiens bien celle-là."];
function viewHomeSimple(){
 app.innerHTML=`<div class="hello">${LOGOS}</div><h1 class="big">Quiz CI BSPP</h1><p class="sub">Découvre les documents du parcours CI en t'amusant.</p>${levelSwitch()}<div id="sbody"><div class="loading">Chargement…</div></div>`;
 bindLevel();
 loadSimple().then(Q=>{if(tab!=="home"||level!=="simple"||!$("#sbody"))return;const disc=discovered();const tot=DOCS.filter(d=>Q.fam[d.id]).length;const nd=[...disc].filter(d=>Q.fam[d]).length;
  const sv=Object.keys(hist).filter(id=>/^(s|doc):/.test(id));const sok=sv.filter(id=>hist[id][hist[id].length-1]===1).length;
  const w=isoWeek(),dd=defiDone[w];
  $("#sbody").innerHTML=`<div class="card disc"><div style="display:flex;justify-content:space-between;align-items:baseline;gap:8px"><b>Documents découverts</b><span class="dnum">${nd}<small>/${tot}</small></span></div>
    <div class="prog" style="height:10px;margin-top:10px"><i class="p1" style="width:${nd/tot*100}%"></i></div>
    <p class="small" style="margin:8px 0 0">${nd?`Encore ${tot-nd} à découvrir. `:""}Un document est découvert dès que tu réussis une question qui s'y rapporte. ${sv.length?`${sok}/${sv.length} questions réussies.`:""}</p></div>
   <div class="sect">Jouer</div>
   <div class="tiles">
    <button class="tile" data-sm="quiz"><span class="ic" style="background:#34c759">${SPARK}</span><b>Quiz découverte</b><span>10 questions faciles, 3 choix</span></button>
    <button class="tile" data-sm="vf"><span class="ic" style="background:#ff9f0a">${I.bolt}</span><b>Vrai ou faux ?</b><span>10 affirmations à trancher</span></button>
    <button class="tile" data-sm="doc"><span class="ic" style="background:#5e5ce6">${SEARCH_IC}</span><b>Devine le document</b><span>Quel document ouvrir pour…</span></button>
    <button class="tile" data-sm="mix"><span class="ic" style="background:#0a84ff">${I.cards}</span><b>Grand mélange</b><span>20 questions de tous les thèmes</span></button>
    <button class="tile" data-sm="rbuild"><span class="ic" style="background:#ff375f">${RADIO_IC_T}</span><b>Jeu radio</b><span>Remets le message dans l'ordre</span></button>
    <button class="tile" data-sm="radio"><span class="ic" style="background:#0f1d36">${RADIO_IC_T}</span><b>Messages radio</b><span>Construis tes messages pas à pas</span></button>
    <button class="tile" data-sm="carte"><span class="ic" style="background:#1f9d55">${MAP_IC_T}</span><b>Carte des secteurs</b><span>Les CS, leurs adresses, leur Golf</span></button>
    <button class="tile" data-sm="grades"><span class="ic gic">${gradeSvg("CNE","")}</span><b>Les grades</b><span>Reconnais les galons</span></button>
    ${duelTile()}
    <button class="tile wide" data-sm="hosp"><span class="ic" style="background:#d92d20">${H_IC}</span><div><b>Les hôpitaux</b><br><span>Qui fait quoi : SAU, maternité, SOS Mains, ophtalmo…</span></div></button>
   </div>
   <div class="sect">Thèmes du quiz</div><div class="chips">${Object.entries(Q.themes).map(([k,l])=>`<button class="chip" data-st="${k}" aria-pressed="${sSel.has(k)}">${esc(l)}</button>`).join("")}</div>
   <div class="sect">Cette semaine</div>
   <div class="defi"><div class="wk">DÉFI ${w}</div><h2>Défi de la semaine</h2><p>Le défi est au niveau Officier (×2) : tente-le quand tu te sens prêt.</p>${dd?`<p class="done">Ton premier essai : <b>${dd.score}/20</b></p>`:""}<div class="actions" style="margin-top:0"><button class="btn" id="defiGo">${dd?"Rejouer":"Relever le défi"}</button></div></div>
   ${homeBoard()}
   <div class="card" style="margin-top:14px"><b>Comment ça marche ?</b><p class="small" style="margin:6px 0 0">Au niveau Sapeur, chaque bonne réponse rapporte 5 points (×0,5). Au niveau Officier, 20 points (×2). Après chaque question, « Voir dans le référentiel » t'ouvre la bonne page du document : c'est le meilleur moyen de les découvrir.</p></div>
   <footer class="note" style="margin-top:10px"><b>Application non officielle.</b> Elle n'est ni éditée ni validée par la BSPP ni par la Croix-Rouge française et sert uniquement à s'entraîner et à réviser. Développée par l'Unité Locale de Paris XVIII de la Croix-Rouge française.</footer>`;
  const pool=k=>Q.items.filter(x=>sSel.has(x.g)&&(!k||x.k===k));
  app.querySelectorAll("[data-st]").forEach(c=>c.onclick=()=>{const k=c.dataset.st;sSel.has(k)?sSel.delete(k):sSel.add(k);if(!sSel.size)sSel.add(k);store.set("sThemes",[...sSel]);c.setAttribute("aria-pressed",sSel.has(k))});
  const back=()=>go("home");
  app.querySelectorAll("[data-sm]").forEach(b=>b.onclick=()=>({quiz:()=>runSimple(fresh(pool()).slice(0,10),"Quiz découverte"),vf:()=>runSimple(fresh(pool("vf")).slice(0,10),"Vrai ou faux ?"),
   doc:()=>runSimple(docQuestions(10),"Devine le document"),mix:()=>runSimple(fresh(Q.items).slice(0,16).concat(docQuestions(4)).sort(()=>Math.random()-.5),"Grand mélange"),
   radio:()=>go("radio"),carte:()=>go("carte"),grades:()=>viewGrades(false),hosp:()=>runHospQuiz(false),rbuild:()=>runRadioBuild(()=>go("home"))})[b.dataset.sm]());
  $("#defiGo").onclick=()=>runQuiz(defiQuestions(),"defi",false);
 }).catch(()=>{const b=$("#sbody");if(b)b.innerHTML=`<div class="card"><p style="margin:0">Impossible de charger les questions du niveau Sapeur. Vérifie ta connexion.</p><button class="btn sec full" style="margin-top:12px" id="sRetry">Réessayer</button></div>`;const r=$("#sRetry");if(r)r.onclick=viewHomeSimple})}
function runSimple(qs,title){if(!qs.length)return;qs=qs.map(mixQ);let i=0,score=0,combo=0,bestCombo=0;const missed=[];const back=()=>go("home");const before=discovered();
 const show=()=>{const q=qs[i];
  const choices=q._k==="qcm"?`<div class="opts">${q.choices.map((c,k)=>`<button class="opt" data-k="${k}"><span class="k">${LETTERS[k]}</span><span>${esc(c)}</span></button>`).join("")}</div>`
   :`<div class="vf"><button class="opt" data-k="1">VRAI</button><button class="opt" data-k="0">FAUX</button></div>`;
  app.innerHTML=push(title,`${i+1}/${qs.length}`)+`<div class="bar"><i style="width:${i/qs.length*100}%"></i></div>
   <div class="qhead"><span class="qtag">${esc(q._t.theme)}${q._k==="vf"?" · vrai ou faux":""}${combo>=2?` · <span class="combo">série ×${combo}</span>`:""}</span>${q._id.startsWith("doc:")?"":markBtn(q._id)}</div><p class="qtext">${qHtml(q)}</p>${choices}<div id="after"></div>`;
  bindBack(back);
  app.querySelectorAll(".opt").forEach(b=>b.onclick=()=>{const k=+b.dataset.k;const correct=q._k==="qcm"?q.answer:(q.answer?1:0);const ok=k===correct;
   if(ok){score++;combo++;bestCombo=Math.max(bestCombo,combo)}else{combo=0;missed.push(q)}record(q._id,ok);if(navigator.vibrate)navigator.vibrate(ok?15:[30,40,30]);
   app.querySelectorAll(".opt").forEach(o=>{o.disabled=true;if(+o.dataset.k===correct)o.classList.add("good");else if(o===b)o.classList.add("bad")});
   const D=DOC[q.ref.d];
   $("#after").innerHTML=`<div class="fb ${ok?"good":"bad"}"><b>${cheer(ok)}${ok&&combo>=3?` Série de ${combo} !`:""}</b>${esc(q.explication)}
     ${D?`<button class="srcbtn" id="sSrc">${I.doc}<span>Voir dans le référentiel : ${esc(D.t)}, p. ${q.ref.p}</span></button>`:""}</div>
     <div class="actions"><button class="btn full" id="next">${i+1<qs.length?"Question suivante":"Voir le score"}</button></div>`;
   const sb=$("#sSrc");if(sb)sb.onclick=()=>openDoc(q.ref.d,q.ref.p,tokens(q.q).slice(0,6));
   const n=$("#next");n.onclick=()=>{i++;i<qs.length?show():end()};n.scrollIntoView({behavior:"smooth",block:"nearest"})})};
 const end=()=>{setTimeout(syncSoon,50);const after=discovered();const nw=[...after].filter(d=>!before.has(d)&&DOC[d]);const p=Math.round(score/qs.length*100);
  app.innerHTML=push("Résultat")+`<div class="result"><div class="score">${score}/${qs.length}</div><div class="grade">${p>=90?"Excellent, tente le niveau Officier !":grade(p)}</div>
    <p class="small">+${score*5} points${bestCombo>=3?` · meilleure série : ${bestCombo}`:""}</p></div>
   ${nw.length?`<div class="card"><b>Nouveaux documents découverts</b><div class="list" style="margin-top:8px">${nw.map(d=>`<button class="row" data-od="${d}"><span class="ic" style="background:var(--navy2)">${I.book}</span><span class="tx"><b>${esc(DOC[d].t)}</b><span>${DOC[d].n} page${DOC[d].n>1?"s":""} · ouvrir</span></span><span class="chev">${I.chev}</span></button>`).join("")}</div></div>`:""}
   <div class="actions"><button class="btn" id="again">Rejouer</button><button class="btn sec" id="home2">Accueil</button></div>
   ${missed.length?`<div class="sect">À retenir</div><div class="recap">${missed.map(q=>`<div class="card"><b>${qHtml(q)}</b><div class="a">${esc(q._k==="qcm"?q.choices[q.answer]:(q.answer?"Vrai":"Faux"))}</div><div class="e">${esc(q.explication)}</div></div>`).join("")}</div>`:""}`;
  bindBack(back);$("#again").onclick=()=>runSimple(title==="Devine le document"?docQuestions(qs.length):shuffle(qs),title);$("#home2").onclick=back;
  app.querySelectorAll("[data-od]").forEach(b=>b.onclick=()=>openDoc(b.dataset.od,1,[]));window.scrollTo(0,0)};
 show()}

/* ============ Grades ============ */
// d'après la planche des grades fournie : fond sombre, galons rouges (militaires du rang), jaunes/rouges (sous-officiers), barrettes dorées (officiers)
const GR=[
 ["SAP","Sapeur de 2e classe","rang",[]],["1CL","Sapeur de 1re classe","rang",["r"]],["CPL","Caporal","rang",["r","r"]],["CCH","Caporal-chef","rang",["r","r","r"]],
 ["1CL15","Sapeur de 1re classe (+15 ans)","rang15",["y","r"]],["CPL15","Caporal (+15 ans)","rang15",["y","r","r"]],["CCH15","Caporal-chef (+15 ans)","rang15",["y","r","r","r"]],
 ["SGT","Sergent","so",["ye"]],["SGTC","Sergent de carrière","so",["ye","ye"]],["SCH","Sergent-chef","so",["ye","ye","ye"]],
 ["ADJ","Adjudant","so",{h:["w"]}],["ADC","Adjudant-chef","so",{h:["y"]}],["MAJ","Major","so",{h:["y","y"]}],
 ["ASP","Aspirant","off",{b:["asp"]}],["SLT","Sous-lieutenant","off",{b:["g"]}],["LTN","Lieutenant","off",{b:["g","g"]}],["CNE","Capitaine","off",{b:["g","g","g"]}],
 ["CDT","Commandant","sup",{b:["g","g","g","g"]}],["LCL","Lieutenant-colonel","sup",{b:["g","s","g","s","g"]}],["COL","Colonel","sup",{b:["g","g","g","g","g"]}],
 ["GBR","Général de brigade","gen",{st:2}],["GDI","Général de division","gen",{st:3}]];
const GRC={rang:"Militaires du rang",rang15:"Militaires du rang (+15 ans de service)",so:"Sous-officiers",off:"Officiers subalternes",sup:"Officiers supérieurs",gen:"Officiers généraux"};
const GRA={"1CL15":"1CL +15 ans","CPL15":"CPL +15 ans","CCH15":"CCH +15 ans","SGTC":"SGT"};
const GRORD=["SAP","1CL","CPL","CCH","SGT","SCH","ADJ","ADC","MAJ","SLT","LTN","CNE","CDT","LCL","COL","GBR","GDI"];
const SERV=[["med","Médecin","#8b1a1a","MED"],["ph","Pharmacien","#2e8b2e","PH"],["vet","Vétérinaire","#c2185b","VEC"],["com","Commissaire","#a0521d","CRC"],["ing","Ingénieur","#111","IMI"]];
const GBY=Object.fromEntries(GR.map(g=>[g[0],g]));
function gradeSvg(code,cls,serv){const g=GBY[code];const W=60,H=52;let inner="";const col={r:"#d0412b",y:"#e2d97f",w:"#ffffff",g:"#e2d97f",s:"#f4f4f4"};
 if(serv){const sv=SERV.find(x=>x[0]===serv[0]);const n=serv[1];inner+=`<rect x="0" y="4" width="${W}" height="6" fill="${sv[2]}"/><rect x="0" y="${H-10}" width="${W}" height="6" fill="${sv[2]}"/>`;
  const top=13,bot=H-13,h=(bot-top-(n-1)*2)/n;for(let i=0;i<n;i++)inner+=`<rect x="4" y="${top+i*(h+2)}" width="${W-8}" height="${h}" fill="${col.g}"/>`}
 else if(Array.isArray(g[3])){const L=g[3];const sw=L.length>=4?7:8,gap=L.length>=4?3:4,tot=L.length*sw+(L.length-1)*gap,x0=(W-tot-14)/2; // centré : le galon penche de 14 px
  L.forEach((c,i)=>{const x=x0+i*(sw+gap);const pts=`${x},${H-6} ${x+sw},${H-6} ${x+sw+14},6 ${x+14},6`;
   if(c==="ye")inner+=`<polygon points="${pts}" fill="#d0412b"/><polygon points="${x+2},${H-6} ${x+sw-2},${H-6} ${x+sw+12},6 ${x+16},6" fill="#e2d97f"/>`;else inner+=`<polygon points="${pts}" fill="${col[c]}"/>`})}
 else if(g[3].h){const L=g[3].h;const hh=L.length===1?10:8,tot=L.length*hh+(L.length-1)*2,y0=(H-tot)/2;
  L.forEach((c,i)=>{const y=y0+i*(hh+2);inner+=`<rect x="4" y="${y}" width="${W-8}" height="${hh}" fill="${col[c]}"/><rect x="4" y="${y+hh/2-1.2}" width="${W-8}" height="2.4" fill="#d0412b"/>`})}
 else if(g[3].b){const L=g[3].b;if(L[0]==="asp"){const y=H/2-4;inner+=`<rect x="4" y="${y}" width="5" height="8" fill="${col.g}"/><rect x="12" y="${y}" width="${W-24}" height="8" fill="${col.g}"/><rect x="${W-9}" y="${y}" width="5" height="8" fill="${col.g}"/>`}
  else{const n=L.length,hh=n>=4?6:8,gap=n>=4?2.5:4,tot=n*hh+(n-1)*gap,y0=(H-tot)/2;L.forEach((c,i)=>inner+=`<rect x="4" y="${y0+i*(hh+gap)}" width="${W-8}" height="${hh}" fill="${col[c]}"/>`)}}
 else if(g[3].st){const n=g[3].st;const star=(cx,cy)=>{let p="";for(let k=0;k<10;k++){const r=k%2?3.4:8,a=Math.PI/2+k*Math.PI/5;p+=`${(cx+r*Math.cos(a)).toFixed(1)},${(cy-r*Math.sin(a)).toFixed(1)} `}return `<polygon points="${p}" fill="#c9ccd3"/>`};
  inner+=n===2?star(19,27)+star(41,27):star(30,17)+star(17,34)+star(43,34)}
 return `<svg class="${cls||""}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(serv?"":g[1])}"><rect width="${W}" height="${H}" rx="3" fill="#2b2b2b"/>${inner}</svg>`}
function viewGrades(expert,asTab){app.innerHTML=(asTab?`${backLink()}<h1 class="big">Grades</h1>`:push("Les grades"))+`<p class="sub" style="margin-top:12px">Les galons portés par les sapeurs-pompiers de Paris. Touche un grade pour l'agrandir.</p>
  ${usage==="ci"?"":`<div class="gqbtns"><button class="btn" data-gq="0">${gradeSvg("1CL","grade")} Quiz niveau Sapeur</button><button class="btn dark" data-gq="1">${gradeSvg("LTN","grade")} Quiz niveau Officier</button></div>`}
  ${Object.entries(GRC).map(([k,l])=>`<div class="sect">${esc(l)}</div><div class="gplanche">${GR.filter(g=>g[2]===k).map(g=>`<button class="gcell" data-g="${g[0]}">${gradeSvg(g[0])}<b>${esc(g[1])}</b><span>${esc(GRA[g[0]]||g[0])}</span></button>`).join("")}</div>`).join("")}
  <div class="sect">Services (médecins, pharmaciens…)</div><p class="small" style="margin:0 4px 8px">La couleur du velours entre les galons indique le service ; le nombre de galons, le niveau (3 : grade de base, 4 : principal, 5 : en chef).</p>
  <div class="gplanche">${SERV.map(sv=>`<div class="gcell">${gradeSvg("CNE","",[sv[0],3])}<b>${esc(sv[1])}</b><span>velours ${esc({med:"bordeaux",ph:"vert",vet:"rose framboise",com:"marron",ing:"noir"}[sv[0]])}</span></div>`).join("")}</div>
  <p class="small" style="margin:14px 4px 0">Planche simplifiée d'après la planche des grades transmise par l'UL. En cas de doute, renseigne-toi auprès du PVO.</p>`;
 if(asTab)bindTabBack();else bindBack(()=>go("home"));app.querySelectorAll("[data-gq]").forEach(b=>b.onclick=()=>runGradeQuiz(b.dataset.gq==="1"));
 app.querySelectorAll("[data-g]").forEach(b=>b.onclick=()=>{const g=GBY[b.dataset.g];sheet(`<div style="text-align:center">${gradeSvg(g[0],"gbig")}<h2 style="margin:12px 0 4px">${esc(g[1])}</h2><p class="small" style="margin:0">${esc(GRA[g[0]]||g[0])} · ${esc(GRC[g[2]])}</p></div><button class="btn sec full" style="margin-top:16px" onclick="closeSheet()">Fermer</button>`)})}
function gradeQuestions(expert){const n=expert?4:3;const pickO=(good,pool)=>{const o=shuffle([good,...shuffle(pool.filter(x=>x!==good)).slice(0,n-1)]);return o};const Q=[];
 const base=GR.filter(g=>!g[0].endsWith("15")&&g[0]!=="SGTC");
 const gens=[
  ()=>{const g=pick(expert?GR:base);const pool=(expert?GR:base).filter(x=>expert?true:x[2]===g[2]||Math.random()<.5);const o=pickO(g,pool);
   return {id:"img:"+g[0],img:gradeSvg(g[0],"gq"),q:"Quel est ce grade ?",choices:o.map(x=>x[1]),answer:o.indexOf(g),e:`${g[1]} (${GRA[g[0]]||g[0]}) : ${GRC[g[2]].toLowerCase()}.`}},
  ()=>{const g=pick(base);const o=pickO(g,base);return {id:"rev:"+g[0],q:`Quels galons porte un ${g[1].toLowerCase()} ?`,imgChoices:o.map(x=>gradeSvg(x[0],"gq")),choices:o.map(x=>x[1]),answer:o.indexOf(g),e:`Le ${g[1].toLowerCase()} appartient aux ${GRC[g[2]].toLowerCase()}.`}},
  ()=>{const g=pick(base);const o=pickO(g,base);return {id:"abr:"+g[0],q:`Que signifie l'abréviation ${g[0]} ?`,choices:o.map(x=>x[1]),answer:o.indexOf(g),e:`${g[0]} = ${g[1]}.`}},
  ()=>{const a=pick(GRORD),b=pick(GRORD.filter(x=>Math.abs(GRORD.indexOf(x)-GRORD.indexOf(a))>=(expert?1:3)&&!["MAJ","SLT"].every(y=>[a,x].includes(y))));if(!b)return null;const hi=GRORD.indexOf(a)>GRORD.indexOf(b)?a:b;const o=shuffle([a,b]);
   return {id:"cmp:"+[a,b].sort().join("-"),q:"Lequel de ces deux grades est le plus élevé ?",imgChoices:o.map(c=>gradeSvg(c,"gq")),choices:o.map(c=>GBY[c][1]),answer:o.indexOf(hi),e:`${GBY[hi][1]} est au-dessus de ${GBY[hi===a?b:a][1].toLowerCase()}.`}},
  ()=>{const g=pick(GR.filter(x=>x[2]!=="rang15"&&x[0]!=="SGTC"));const cats=Object.keys(GRC).filter(c=>c!=="rang15");const o=shuffle([g[2],...shuffle(cats.filter(c=>c!==g[2])).slice(0,n-1)]);
   return {id:"cat:"+g[0],img:gradeSvg(g[0],"gq"),q:`À quelle catégorie appartient ce grade (${g[1].toLowerCase()}) ?`,choices:o.map(c=>GRC[c]),answer:o.indexOf(g[2]),e:`${g[1]} : ${GRC[g[2]].toLowerCase()}.`}},
 ];
 if(expert){gens.push(
  ()=>{const sv=pick(SERV);const o=shuffle([sv,...shuffle(SERV.filter(x=>x!==sv)).slice(0,n-1)]);return {id:"srv:"+sv[0],img:gradeSvg("CNE","gq",[sv[0],3]),q:"Le velours de couleur entre les galons indique un service. Lequel ?",choices:o.map(x=>x[1]),answer:o.indexOf(sv),e:`Velours ${({med:"bordeaux",ph:"vert",vet:"rose framboise",com:"marron",ing:"noir"})[sv[0]]} : ${sv[1].toLowerCase()}.`}},
  ()=>{const k=pick([3,4,5]);const sv=pick(SERV.filter(x=>k===5||x[0]!=="vet"));const lab={3:sv[1],4:sv[1]+" principal",5:sv[1]+" en chef"};const o=shuffle([3,4,5]);
   return {id:"srvn:"+sv[0]+k,img:gradeSvg("CNE","gq",[sv[0],k]),q:`Ce ${sv[1].toLowerCase()} porte ${k} galons. Quel est son grade ?`,choices:o.map(x=>lab[x]),answer:o.indexOf(k),e:"3 galons : grade de base, 4 : principal, 5 : en chef."}},
  ()=>{const g=pick(["1CL15","CPL15","CCH15"]);return {id:"ans:"+g,img:gradeSvg(g,"gq"),q:"Que signifie le galon jaune ajouté aux galons rouges ?",choices:shuffle(["Plus de 15 ans de service","Une citation à l'ordre de la brigade","Le brevet de secouriste","Un grade d'officier"]).slice(0,0).concat(["Plus de 15 ans de service","Une citation à l'ordre de la brigade","Le brevet de chef d'agrès","Un grade de sous-officier"]),answer:0,e:`Le galon jaune en biais signale plus de 15 ans de service (${GBY[g][1]}).`}});}
 const seen=new Set();let guard=0;while(Q.length<10&&guard++<300){const q=pick(gens)();if(!q||seen.has(q.id))continue;seen.add(q.id);
  if(q.id.startsWith("ans:")){const o=shuffle(q.choices.map((t,i)=>({t,ok:i===0})));q.choices=o.map(x=>x.t);q.answer=o.findIndex(x=>x.ok)}Q.push(q)}
 return Q}
function runGradeQuiz(expert){const qs=freshGen(()=>gradeQuestions(expert),expert?"grade:":"s:grade:",10);let i=0,score=0,combo=0;const pre=expert?"grade:":"s:grade:";
 const show=()=>{const q=qs[i];
  app.innerHTML=push("Quiz des grades",`${i+1}/${qs.length}`)+`<div class="bar"><i style="width:${i/qs.length*100}%"></i></div><div class="qhead"><span class="qtag">Grades · niveau ${expert?"Officier":"Sapeur"}${combo>=2?` · <span class="combo">série ×${combo}</span>`:""}</span></div>
   ${q.img?`<div class="gqbox">${q.img}</div>`:""}<p class="qtext">${esc(q.q)}</p>
   <div class="opts ${q.imgChoices?"gopts":""}">${q.choices.map((c,k)=>`<button class="opt" data-k="${k}">${q.imgChoices?q.imgChoices[k]:`<span class="k">${LETTERS[k]}</span>`}<span>${q.imgChoices?"":esc(c)}</span></button>`).join("")}</div><div id="after"></div>`;
  bindBack(()=>tab==="grades"?go("grades"):viewGrades(expert));
  app.querySelectorAll(".opt").forEach(b=>b.onclick=()=>{const ok=+b.dataset.k===q.answer;if(ok){score++;combo++}else combo=0;record(pre+q.id,ok);if(navigator.vibrate)navigator.vibrate(ok?15:[30,40,30]);
   app.querySelectorAll(".opt").forEach(o=>{o.disabled=true;if(+o.dataset.k===q.answer)o.classList.add("good");else if(o===b)o.classList.add("bad")});
   $("#after").innerHTML=`<div class="fb ${ok?"good":"bad"}"><b>${cheer(ok)}</b>${esc(q.imgChoices?"Réponse : "+q.choices[q.answer]+". ":"")}${esc(q.e)}</div><div class="actions"><button class="btn full" id="next">${i+1<qs.length?"Question suivante":"Voir le score"}</button></div>`;
   const n=$("#next");n.onclick=()=>{i++;i<qs.length?show():end()};n.scrollIntoView({behavior:"smooth",block:"nearest"})})};
 const end=()=>{setTimeout(syncSoon,50);app.innerHTML=push("Résultat")+`<div class="result"><div class="score">${score}/${qs.length}</div><div class="grade">${score>=9?"Tu reconnais les galons comme un chef !":grade(score*10)}${score<6?" Repasse par la planche des grades.":""}</div><p class="small">+${score*(expert?20:5)} points</p></div>
  <div class="actions"><button class="btn" id="again">Rejouer</button><button class="btn sec" id="planche">Planche des grades</button></div>`;
  bindBack(()=>go(tab==="grades"?"grades":"home"));$("#again").onclick=()=>runGradeQuiz(expert);$("#planche").onclick=()=>tab==="grades"?go("grades"):viewGrades(expert);window.scrollTo(0,0)};
 show()}

/* ============ Grade de progression (examens de passage) ============ */
// Règles : un exercice compte s'il a au moins 5 réponses. Exercice « réussi » si ≥ 50 % de bonnes réponses.
// Après N exercices réussis au grade actuel, l'examen de passage au grade suivant se débloque (15 questions, 80 % requis).
// Échec à l'examen : nouvel essai après 3 exercices réussis. 3 exercices d'affilée sous 50 % : rétrogradation d'un grade.
// Au-delà de Sergent-chef, seuls les exercices du niveau Officier font progresser.
const RANK_Q=15,RANK_PASS=12,RANK_CAP=GRORD.indexOf("SCH");
let rankObj=(r=>r&&typeof r==="object"?r:{})(store.get("rank",null));
function rankFix(r){r=r&&typeof r==="object"?r:{};return {g:Math.max(0,Math.min(GRORD.length-1,+r.g||0)),ex:Math.max(0,+r.ex||0),bad:Math.max(0,+r.bad||0),wait:Math.max(0,+r.wait||0),t:+r.t||0,h:Array.isArray(r.h)?r.h.slice(-30):[]}}
rankObj=rankFix(rankObj);
const rankNeed=g=>3+Math.floor(g/2);
const rankCode=g=>GRORD[Math.max(0,Math.min(GRORD.length-1,g))];
const rankName=g=>(GBY[rankCode(g)]||[,"?"])[1];
const rankTop=()=>rankObj.g>=GRORD.length-1;
function rankSave(){rankObj.t=Date.now();store.set("rank",rankObj);if(typeof syncSoon==="function")syncSoon(3000)}
function rankReady(){return !rankTop()&&rankObj.ex>=rankNeed(rankObj.g)&&rankObj.wait<=0}
function rankLevelOk(g){return g.nL>=g.nS} // partie majoritairement au niveau Officier
// appelé à la fin de chaque exercice (hors examen de grade)
function rankOnGameEnd(g){try{if(!g||g.n<5||/^Examen de passage/.test(g.title))return null;const pct=g.ok/g.n;let ev=null;
 if(pct<.5){rankObj.bad++;if(rankObj.bad>=3&&rankObj.g>0){const from=rankObj.g;rankObj.g--;rankObj.ex=0;rankObj.bad=0;rankObj.wait=0;rankObj.h.push({g:rankObj.g,t:Date.now(),d:-1});ev={type:"down",from,to:rankObj.g};alog("grade","rétrogradation",{de:rankName(from),vers:rankName(rankObj.g)})}
  else if(rankObj.bad>=2&&rankObj.g>0)ev={type:"warn"}}
 else{rankObj.bad=0;if(rankObj.g>=RANK_CAP&&!rankLevelOk(g))ev={type:"cap"};else{const was=rankReady();rankObj.ex++;if(rankObj.wait>0)rankObj.wait--;if(rankReady()&&!was)ev={type:"exam"}}}
 rankSave();return ev}catch(e){return null}}
// message sous le résultat d'un exercice
function rankResultNote(ev){const n=$(".result");if(!n||!ev)return;const d=document.createElement("div");d.className="card rknote";
 if(ev.type==="exam"){d.innerHTML=`<div class="rkrow">${gradeSvg(rankCode(rankObj.g+1),"rkmini")}<div><b>Examen de passage disponible !</b><span class="small">Tu peux tenter le grade de ${esc(rankName(rankObj.g+1))} : ${RANK_Q} questions, ${RANK_PASS} bonnes réponses requises.</span></div></div><button class="btn full" data-rkexam>Passer l'examen</button>`}
 else if(ev.type==="warn")d.innerHTML=`<div class="rkrow">${gradeSvg(rankCode(rankObj.g),"rkmini")}<div><b>Attention, ton grade est menacé</b><span class="small">Encore un exercice sous 50 % et tu redescends au grade de ${esc(rankName(rankObj.g-1))}.</span></div></div>`;
 else if(ev.type==="cap")d.innerHTML=`<div class="rkrow">${gradeSvg(rankCode(rankObj.g),"rkmini")}<div><b>Passe au niveau Officier pour monter en grade</b><span class="small">Au-delà de ${esc(rankName(RANK_CAP))}, seuls les exercices du niveau Officier comptent pour ta progression.</span></div></div>`;
 else return;
 n.after(d);const b=d.querySelector("[data-rkexam]");if(b)b.onclick=()=>runRankExam()}
// carte du profil
function rankCard(compact){const g=rankObj.g,need=rankNeed(g),top=rankTop();const ex=Math.min(rankObj.ex,need);
 const st=top?`Tu as atteint le grade le plus élevé. Garde la main : 3 exercices d'affilée sous 50 % te feraient redescendre.`
  :rankReady()?`L'examen de passage au grade de <b>${esc(rankName(g+1))}</b> est disponible.`
  :rankObj.wait>0?`Examen raté : nouvel essai après encore <b>${rankObj.wait}</b> exercice${rankObj.wait>1?"s":""} réussi${rankObj.wait>1?"s":""}.`
  :`Encore <b>${need-ex}</b> exercice${need-ex>1?"s":""} réussi${need-ex>1?"s":""} (≥ 50 %) avant l'examen de passage au grade de ${esc(rankName(g+1))}.`;
 return `<div class="card rkcard"><div class="rkrow">${gradeSvg(rankCode(g),"rkbadge")}<div style="flex:1;min-width:0"><span class="small">Mon grade de progression</span><b class="rkname">${esc(rankName(g))}</b></div></div>
  ${top?"":`<div class="rkbar"><i style="width:${Math.round(ex/need*100)}%"></i></div><div class="small rkcount">${ex}/${need} exercices réussis</div>`}
  <p class="small" style="margin:8px 0 0">${st}${rankObj.bad>0&&g>0?` <span class="rkwarn">${rankObj.bad}/3 exercice${rankObj.bad>1?"s":""} raté${rankObj.bad>1?"s":""} d'affilée.</span>`:""}</p>
  ${rankReady()?`<button class="btn full" data-rkexam style="margin-top:10px">Passer l'examen de ${esc(rankName(g+1))}</button>`:""}
  ${compact?"":`<details class="rkhow"><summary>Comment monter en grade ?</summary><ul><li>Chaque exercice d'au moins 5 questions réussi à 50 % ou plus compte pour ton avancement.</li><li>Après assez d'exercices réussis, un <b>examen de passage</b> se débloque : ${RANK_Q} questions, ${RANK_PASS} bonnes réponses pour être promu.</li><li>Examen raté : nouvel essai après 3 exercices réussis.</li><li><b>3 exercices d'affilée sous 50 %</b> : tu redescends d'un grade.</li><li>Au-delà de ${esc(rankName(RANK_CAP))}, seuls les exercices du niveau Officier comptent.</li></ul></details>`}</div>`}
function bindRank(root=app){root.querySelectorAll("[data-rkexam]").forEach(b=>b.onclick=()=>runRankExam())}
// examen de passage
function rankExamPool(target){const L=ALL.filter(x=>x._k==="qcm"||x._k==="vf");const S=(SIMPLE&&SIMPLE.items||[]).filter(x=>x._k==="qcm"||x._k==="vf");
 if(target<=3)return fresh(S).slice(0,RANK_Q);
 if(target<=RANK_CAP)return shuffle([...fresh(S).slice(0,7),...fresh(L).slice(0,RANK_Q-7)]);
 return fresh(L).slice(0,RANK_Q)}
function runRankExam(){if(!rankReady()){toast("L'examen n'est pas encore disponible.");return}const target=rankObj.g+1;
 loadSimple().catch(()=>null).then(()=>{const qs=rankExamPool(target).map(mixQ);if(qs.length<RANK_Q){toast("Pas assez de questions disponibles.");return}
  let i=0,score=0;const answers=[];const T=`Examen de passage · ${rankName(target)}`;alog("grade","examen commencé",{vers:rankName(target)});
  const show=()=>{const q=qs[i];
   app.innerHTML=push(T,`${i+1}/${qs.length}`)+`<div class="bar"><i style="width:${i/qs.length*100}%"></i></div>
    <div class="qhead"><span class="qtag">Examen · ${RANK_PASS}/${RANK_Q} requis</span></div><p class="qtext">${esc(q.q)}</p>
    ${q._k==="qcm"?`<div class="opts">${q.choices.map((c,k)=>`<button class="opt" data-k="${k}"><span class="k">${LETTERS[k]}</span><span>${esc(c)}</span></button>`).join("")}</div>`:`<div class="vf"><button class="opt" data-k="1">VRAI</button><button class="opt" data-k="0">FAUX</button></div>`}`;
   bindBack(()=>{alog("grade","examen abandonné",{vers:rankName(target),question:i+1});go("profile")});
   app.querySelectorAll(".opt").forEach(b=>b.onclick=()=>{const k=+b.dataset.k;const ok=k===(q._k==="qcm"?q.answer:(q.answer?1:0));if(ok)score++;answers.push({q,ok,k});record(q._id,ok);i++;i<qs.length?show():end()})};
  const end=()=>{const pass=score>=RANK_PASS;setTimeout(syncSoon,50);
   if(pass){const from=rankObj.g;rankObj.g=target;rankObj.ex=0;rankObj.bad=0;rankObj.wait=0;rankObj.h.push({g:target,t:Date.now(),d:1});rankSave();alog("grade","promotion",{de:rankName(from),vers:rankName(target),score:score+"/"+qs.length})}
   else{rankObj.wait=3;rankSave();alog("grade","examen raté",{vers:rankName(target),score:score+"/"+qs.length})}
   app.innerHTML=push("Résultat de l'examen")+`<div class="result"><div class="score">${score}/${qs.length}</div><div class="grade">${pass?`Reçu ! Te voilà ${esc(rankName(target))}.`:`Ajourné : il fallait ${RANK_PASS} bonnes réponses.`}</div><p class="small">${pass?"":"Nouvel essai après 3 exercices réussis. Relis tes erreurs, tu y es presque."}</p></div>
    <div class="actions"><button class="btn" id="rkProf">Mon profil</button></div>
    ${(()=>{const bad=answers.filter(a=>!a.ok);const mine=a=>a.q._k==="qcm"?(a.q.choices[a.k]||""):(a.k?"Vrai":"Faux");
     return bad.length?`<div class="sect">Corrigé de tes erreurs (${bad.length})</div><div class="recap">${bad.map(a=>`<div class="card"><div class="qhead"><b>${esc(a.q.q)}</b>${markBtn(a.q._id,false)}</div><div class="small" style="margin:6px 0 2px">Ta réponse : ${esc(mine(a))}</div><div class="a">${esc(a.q._k==="qcm"?a.q.choices[a.q.answer]:(a.q.answer?"Vrai":"Faux"))}</div><div class="e">${esc(a.q.explication||"")}</div>${srcBtn(a.q)}</div>`).join("")}</div>`:`<p class="sub" style="text-align:center">Sans faute, bravo.</p>`})()}`;
   bindSrc();bindBack(()=>go("profile"));$("#rkProf").onclick=()=>go("profile");window.scrollTo(0,0);
   if(pass)setTimeout(()=>rankPopup("up",target),250)};
  show()})}
// popup de promotion (feux d'artifice) ou de rétrogradation
function rankPopup(kind,g){const up=kind==="up";const el=document.createElement("div");el.className="rkpop"+(up?" up":" down");el.setAttribute("role","dialog");el.setAttribute("aria-modal","true");
 const sg=typeof fxMode!=="undefined"&&fxMode!=="off";
 const line=up?(sg?pick(["Promu ? Ne vous habituez pas aux galons, ils se perdent vite !","Félicitations. Maintenant on attend de vous deux fois plus. ROMPEZ !","Un galon de plus. Ça ne vous dispense pas de relire le référentiel !"]):pick(["Bravo, ce galon, tu l'as bien mérité !","Belle progression, continue comme ça !","Promotion méritée : l'équipage est fier de toi !"]))
  :(sg?pick(["Rétrogradé ! Les galons, ça se mérite TOUS LES JOURS !","On vous retire un galon. Au référentiel, et que ça saute !"]):"Pas de panique : quelques exercices réussis et tu retrouves ton grade.");
 el.innerHTML=`<canvas class="rkfx"></canvas><div class="rkbox"><div class="rkt">${up?"Promotion !":"Rétrogradation"}</div><div class="rkimg">${gradeSvg(rankCode(g),"rkbig")}</div>
  <div class="rkn">${up?"Tu es promu au grade de":"Tu redescends au grade de"}<b>${esc(rankName(g))}</b></div><p class="small">${esc(line)}</p><button class="btn full" id="rkOk">${up?"Garde-à-vous !":"Compris"}</button></div>`;
 document.body.appendChild(el);if(navigator.vibrate)navigator.vibrate(up?[40,60,40,60,120]:[200]);
 let stop=false;const close=()=>{stop=true;el.remove()};el.querySelector("#rkOk").onclick=close;el.addEventListener("click",e=>{if(e.target===el)close()});
 if(up&&!matchMedia("(prefers-reduced-motion: reduce)").matches){const cv=el.querySelector("canvas"),cx=cv.getContext("2d");const fit=()=>{cv.width=innerWidth*devicePixelRatio;cv.height=innerHeight*devicePixelRatio};fit();
  const P=[];const COL=["#ffd60a","#ff375f","#0a84ff","#34c759","#ff9f0a","#ffffff","#e1141c"];
  const burst=()=>{const x=(.15+Math.random()*.7)*cv.width,y=(.12+Math.random()*.4)*cv.height,c=pick(COL),n=60+Math.random()*40;for(let k=0;k<n;k++){const a=Math.random()*Math.PI*2,v=(1.5+Math.random()*4.5)*devicePixelRatio;P.push({x,y,vx:Math.cos(a)*v,vy:Math.sin(a)*v,l:60+Math.random()*40,c})}};
  let f=0;const tick=()=>{if(stop)return;f++;if(f%28===1&&f<260)burst();cx.globalCompositeOperation="destination-out";cx.fillStyle="rgba(0,0,0,.18)";cx.fillRect(0,0,cv.width,cv.height);cx.globalCompositeOperation="lighter";
   for(let k=P.length-1;k>=0;k--){const p=P[k];p.x+=p.vx;p.y+=p.vy;p.vy+=.05*devicePixelRatio;p.vx*=.985;p.vy*=.985;p.l--;if(p.l<=0){P.splice(k,1);continue}cx.fillStyle=p.c;cx.globalAlpha=Math.min(1,p.l/40);cx.beginPath();cx.arc(p.x,p.y,2.2*devicePixelRatio,0,7);cx.fill()}
   cx.globalAlpha=1;if(f<420||P.length)requestAnimationFrame(tick)};tick()}}

/* ============ Duels entre membres ============ */
// Asynchrone : le défieur joue ses 10 questions, l'adversaire a 48 h pour jouer les mêmes. Points pondérés par la rapidité.
// Décorations (1 h) : médaille au gagnant, pompier au balai au perdant, pompier qui se défile en cas de refus ou de forfait.
const DECO_IC={medal:"<svg viewBox=\"0 0 32 40\"><path d=\"M8 1h7l3 12h-7z\" fill=\"#1f4fbf\"/><path d=\"M11 1h3l3 12h-3z\" fill=\"#fff\"/><path d=\"M17 1h7l-3 12h-7z\" fill=\"#e1141c\"/><path d=\"M18 1h3l-3 12h-3z\" fill=\"#fff\" opacity=\".9\"/><circle cx=\"16\" cy=\"25\" r=\"11\" fill=\"#c9962b\"/><circle cx=\"16\" cy=\"25\" r=\"9\" fill=\"url(#mg)\"/><path d=\"M16 18.5l1.9 3.9 4.3.6-3.1 3 .7 4.3-3.8-2-3.8 2 .7-4.3-3.1-3 4.3-.6z\" fill=\"#fff4c2\" stroke=\"#9a6f17\" stroke-width=\".6\"/><defs><radialGradient id=\"mg\" cx=\".35\" cy=\".3\"><stop offset=\"0\" stop-color=\"#fff2b0\"/><stop offset=\".55\" stop-color=\"#f2c94c\"/><stop offset=\"1\" stop-color=\"#b8831f\"/></radialGradient></defs></svg>",broom:"<svg viewBox=\"0 0 40 48\"><path d=\"M13 22 h14 l2 16 h-18z\" fill=\"#1d2b4f\"/><path d=\"M12.4 29 h15.2 v2.4 h-15.2z\" fill=\"#e8ff2a\"/><path d=\"M12.6 31.4 h14.8 v1.2 h-14.8z\" fill=\"#e1141c\"/>\n <path d=\"M14 38 h5 v8 h-5z M21 38 h5 v8 h-5z\" fill=\"#1d2b4f\"/><circle cx=\"20\" cy=\"15\" r=\"7\" fill=\"#f2c9a0\" stroke=\"#c99a74\" stroke-width=\".7\"/>\n <g transform=\"translate(20 11) scale(1.35)\"><path d=\"M-6 0 C-6 -6 6 -6 6 0 Z\" fill=\"#dfe3e8\" stroke=\"#6b737d\" stroke-width=\".7\"/><path d=\"M-.6 -5.2 h1.2 v5 h-1.2z\" fill=\"#fff\"/><path d=\"M-6.4 0 h12.8\" stroke=\"#3a3f47\" stroke-width=\"1.2\"/><path d=\"M-4.5 .4 q4.5 3 9 0 v1.4 q-4.5 2.4 -9 0z\" fill=\"#e9b949\"/></g><circle cx=\"17.5\" cy=\"15.5\" r=\".9\" fill=\"#3b2f22\"/><circle cx=\"22.5\" cy=\"15.5\" r=\".9\" fill=\"#3b2f22\"/><path d=\"M17.5 19.2 q2.5 -1.6 5 0\" stroke=\"#3b2f22\" stroke-width=\".9\" fill=\"none\" stroke-linecap=\"round\"/><path d=\"M25.5 14 q1.6 2.6 0 3.8\" stroke=\"#5ac8fa\" stroke-width=\"1.2\" fill=\"none\" stroke-linecap=\"round\"/>\n <line x1=\"31\" y1=\"8\" x2=\"31\" y2=\"40\" stroke=\"#a0703c\" stroke-width=\"1.6\" stroke-linecap=\"round\"/><path d=\"M27 39 h8 l1 6 h-10z\" fill=\"#d9a441\" stroke=\"#9c6f24\" stroke-width=\".6\"/><path d=\"M27 25 q2 -1 4 0\" stroke=\"#1d2b4f\" stroke-width=\"3\" stroke-linecap=\"round\"/></svg>",run:"<svg viewBox=\"0 0 40 48\"><rect x=\"27\" y=\"10\" width=\"11\" height=\"34\" rx=\"1\" fill=\"#2f9e44\" stroke=\"#1d6b2d\" stroke-width=\".8\"/><rect x=\"28.5\" y=\"12\" width=\"8\" height=\"30\" fill=\"#1b1f24\"/><path d=\"M28.5 12 l6 2.5 v30 l-6 -2.5z\" fill=\"#3fbf5a\" stroke=\"#1d6b2d\" stroke-width=\".5\"/><rect x=\"27\" y=\"5\" width=\"11\" height=\"4\" rx=\"1\" fill=\"#2f9e44\"/><text x=\"32.5\" y=\"8.2\" text-anchor=\"middle\" font-family=\"system-ui\" font-weight=\"900\" font-size=\"2.9\" fill=\"#fff\">SORTIE</text><g transform=\"translate(0 0)\"><path d=\"M10 22 l9 2 l-1 9 l-9 -2z\" fill=\"#1d2b4f\"/><path d=\"M9.6 26 l9 2 l-.3 2 l-9 -2z\" fill=\"#e8ff2a\"/><path d=\"M11 31 l-5 6 l-3 -1 M16 32 l2 8 h4\" stroke=\"#1d2b4f\" stroke-width=\"3\" stroke-linecap=\"round\" fill=\"none\"/><path d=\"M18 25 l5 3 l3 -2 M11 24 l-5 2\" stroke=\"#1d2b4f\" stroke-width=\"2.6\" stroke-linecap=\"round\" fill=\"none\"/><circle cx=\"17\" cy=\"17.5\" r=\"4.6\" fill=\"#f2c9a0\" stroke=\"#c99a74\" stroke-width=\".6\"/><g transform=\"translate(17 15) scale(1)\"><path d=\"M-6 0 C-6 -6 6 -6 6 0 Z\" fill=\"#dfe3e8\" stroke=\"#6b737d\" stroke-width=\".7\"/><path d=\"M-.6 -5.2 h1.2 v5 h-1.2z\" fill=\"#fff\"/><path d=\"M-6.4 0 h12.8\" stroke=\"#3a3f47\" stroke-width=\"1.2\"/><path d=\"M-4.5 .4 q4.5 3 9 0 v1.4 q-4.5 2.4 -9 0z\" fill=\"#e9b949\"/></g><path d=\"M20.5 16.5 q1.4 2 0 3\" stroke=\"#5ac8fa\" stroke-width=\"1\" fill=\"none\" stroke-linecap=\"round\"/></g><g stroke=\"#9aa1ab\" stroke-width=\"1\" stroke-linecap=\"round\"><path d=\"M1 20h5\"/><path d=\"M0 25h4\"/><path d=\"M2 30h4\"/></g><ellipse cx=\"18\" cy=\"45\" rx=\"9\" ry=\"1.6\" fill=\"#000\" opacity=\".12\"/></svg>"};
const DECO_TXT={medal:"Médaille",broom:"Corvée de balai",run:"Pompier qui se défile"};
let duels=store.get("duels",[]),duelsAt=0,duelPopShown=new Set();
const DUEL_Q=10,duelPts=s=>Math.max(30,100-5*Math.floor(s));
const NICK_IDEAS=["Pompier du dimanche","Roi du balai","Extincteur vide","Gyrophare en panne","Sirène enrouée","Stagiaire éternel","Planqué de la remise","Lance percée","Recrue du mois","Pin-pon raté","Tuyau percé","Casque de travers"];
function nickOf(p){const n=p&&p.nick;return n&&n.u>Date.now()?n:null}
function nickHtml(p){const n=nickOf(p);return n?` <button type="button" class="nick" data-nick="${esc(p.id)}">« ${esc(n.n)} »</button>`:""}
document.addEventListener("click",e=>{const b=e.target.closest("[data-nick]");if(!b)return;e.stopPropagation();e.preventDefault();const p=(board&&board.profiles||[]).find(x=>x.id===b.dataset.nick);const n=nickOf(p);if(n)toast(`Surnom donné par ${n.by} après sa victoire en duel · encore ${Math.max(1,Math.round((n.u-Date.now())/6e4))} min`)},true);
const canNick=d=>d&&d.status==="done"&&d.winner===me.id&&!d.nick&&Date.now()<(d.done||0)+36e5;
function nickSheet(d,after){const o=duelOther(d);const sh=sheet(`<h2>Choisis un surnom pour ${esc(o.n)}</h2><p class="small">Il s'affichera à côté de son nom pendant 1 heure, dans tous les classements. Reste dans l'esprit pompier : taquin, jamais blessant.</p>
  <div class="chips wrap" style="margin:10px 0">${shuffle(NICK_IDEAS).slice(0,8).map(n=>`<button class="chip" data-ni="${esc(n)}">${esc(n)}</button>`).join("")}</div>
  <form class="form" id="nkF"><label for="nkI">Ou invente le tien (28 caractères max.)</label><input id="nkI" maxlength="28" placeholder="ex. Sapeur Pas-de-bol"><button class="btn" type="submit">Valider le surnom</button></form><p class="small" id="nkM" style="margin:8px 0 0"></p>`);
 sh.querySelectorAll("[data-ni]").forEach(b=>b.onclick=()=>{sh.querySelector("#nkI").value=b.dataset.ni});
 sh.querySelector("#nkF").onsubmit=async e=>{e.preventDefault();const v=sh.querySelector("#nkI").value.trim();if(v.length<3){sh.querySelector("#nkM").textContent="Choisis ou écris un surnom (3 caractères minimum).";return}
  try{await api("duel/nick","POST",{did:d.id,nick:v});d.nick=v;alog("duel","surnom donné",{a:o.n,surnom:v});closeSheet();toast(`${o.n} devient « ${v} » pendant 1 heure !`);await loadDuels(true);await loadBoard(true);if(after)after()}catch(err){sh.querySelector("#nkM").textContent=err.error||"Erreur."}}}
function decoOf(p){const d=p&&p.deco;return d&&d.u>Date.now()?d:null}
function decoHtml(p,cls="deco"){const d=decoOf(p);if(!d)return "";return `<button type="button" class="${cls}" data-deco="${esc(p.id)}" aria-label="${esc(DECO_TXT[d.t]||"")}">${(DECO_IC[d.t]||"").replace("<svg","<svg aria-hidden=\"true\"")}</button>`}
function decoText(p){const d=decoOf(p);if(!d)return "";const min=Math.max(1,Math.round((d.u-Date.now())/6e4));const n=p.pseudo;
 const t=d.t==="medal"?`${n} a battu ${d.vs} en duel « ${d.th} »${d.sc?` (${d.sc} pts)`:""}`:d.t==="broom"?`${n} a perdu son duel « ${d.th} » contre ${d.vs}${d.sc?` (${d.sc} pts)`:""} : corvée de balai !`:`${n} a ${d.why==="expired"?"laissé filer":"refusé"} le duel de ${d.vs} : pompier qui se défile !`;
 return `${t} · encore ${min} min`}
document.addEventListener("click",e=>{const b=e.target.closest("[data-deco]");if(!b)return;e.stopPropagation();e.preventDefault();const p=(board&&board.profiles||[]).find(x=>x.id===b.dataset.deco);if(p)toast(decoText(p))},true);
const duelOther=d=>d.from===me.id?{id:d.to,n:d.toN}:{id:d.from,n:d.fromN};
const duelLvl=d=>d.level==="simple"?"Sapeur":"Officier";
async function loadDuels(force){if(!me||me.expired)return duels;if(!force&&Date.now()-duelsAt<20000)return duels;
 try{const j=await api("duel/list");duels=j.duels||[];duelsAt=Date.now();store.set("duels",duels);duelCredit();const t=document.querySelector("[data-duels]");if(t)t.outerHTML=duelTile();duelNotify()}catch(e){}return duels}
// points de classement : +30 victoire, +15 nul, +10 défaite (une seule fois par duel, mémorisé dans la progression)
let duelCr=store.get("duelCr",{});
function duelCredit(){let ch=false;for(const d of duels){if(d.status!=="done"||duelCr[d.id]||!d.mine)continue;const n=!d.winner?15:d.winner===me.id?30:10;
  cnt.points+=n;const wc=wkCur();wc.points+=n;const day=today();const o=dayPts[day]||(dayPts[day]={});const c=o[DEV]||(o[DEV]=[0,0,0]);c[0]+=n;
  duelCr[d.id]=n;ch=true;alog("duel","points de duel",{"+":n,contre:duelOther(d).n})}
 if(ch){store.set("duelCr",duelCr);store.set("cntDev",cntDev);store.set("wkDev",wkDev);store.set("dayPts",dayPts);syncSoon(3000)}}
const duelIncoming=()=>duels.filter(d=>d.to===me.id&&d.status==="pending"&&!d.mine&&d.exp>Date.now());
// à l'ouverture : défi reçu, ou résultat d'un duel lancé
function duelNotify(){if(document.body.classList.contains("pushed")||$("#sheet")||document.querySelector(".tuto,.rkpop,.dlpop"))return;
 const inc=duelIncoming().find(d=>!duelPopShown.has(d.id));if(inc){duelPopShown.add(inc.id);duelChallengePop(inc);return}
 const seen=store.get("duelSeen",{});const res=duels.find(d=>d.from===me.id&&["done","declined","expired"].includes(d.status)&&!seen[d.id]&&d.done&&Date.now()-d.done<7*864e5);
 if(res){seen[res.id]=1;store.set("duelSeen",seen);duelResultPop(res)}}
function dlLeft(d){const m=Math.max(0,Math.round((d.exp-Date.now())/6e4));return m>=60?`${Math.floor(m/60)} h ${String(m%60).padStart(2,"0")}`:`${m} min`}
function duelChallengePop(d){const el=document.createElement("div");el.className="dlpop";el.setAttribute("role","dialog");el.setAttribute("aria-modal","true");
 const op=(board&&board.profiles||[]).find(p=>p.id===d.from)||{pseudo:d.fromN,id:d.from};
 el.innerHTML=`<div class="dlbox"><div class="dltag">⚔ NOUVEAU DÉFI</div><h3>${esc(d.fromN)} te défie !</h3>
  <div class="dlvs">${avatar(op,46)}<span>VS</span>${avatar((board&&board.profiles||[]).find(p=>p.id===me.id)||me,46)}</div>
  <div class="dlinfo"><div><span>Thème</span><b>${esc(d.themeN)}</b></div><div><span>Niveau</span><b>${duelLvl(d)}</b></div><div><span>Questions</span><b>${DUEL_Q}, chronométrées</b></div><div><span>Son score</span><b>caché jusqu'à la fin</b></div><div><span>Temps restant</span><b>${dlLeft(d)}</b></div></div>
  <div class="dlwarn">${DECO_IC.run}<span>Refuser, c'est porter le <b>pompier qui se défile</b> à côté de ton nom pendant 1 heure.</span></div>
  <button class="btn full" data-dgo>Relever le défi</button><div class="actions" style="margin:8px 0 0"><button class="btn sec" style="flex:1" data-dlater>Plus tard</button><button class="btn sec" style="flex:1;color:var(--ko)" data-dno>Refuser</button></div></div>`;
 document.body.appendChild(el);const close=()=>el.remove();alog("duel","défi reçu affiché",{de:d.fromN,theme:d.themeN});
 el.querySelector("[data-dlater]").onclick=close;el.querySelector("[data-dgo]").onclick=()=>{close();runDuel(d)};
 el.querySelector("[data-dno]").onclick=async e=>{const b=e.currentTarget;if(!b.dataset.c){b.dataset.c="1";b.textContent="Confirmer le refus";return}b.disabled=true;
  try{await api("duel/decline","POST",{did:d.id});alog("duel","défi refusé",{de:d.fromN});close();await loadDuels(true);await loadBoard(true);toast("Défi refusé… Te voilà pompier qui se défile pendant 1 heure !");refreshDuelViews()}catch(err){b.disabled=false;toast(err.error||"Erreur.")}}}
function duelResultPop(d){const el=document.createElement("div");el.className="dlpop";const o=duelOther(d);
 let h,ic,txt;if(d.status==="declined"||d.status==="expired"){h="Défi refusé";ic=DECO_IC.run;txt=`${esc(o.n)} a ${d.status==="expired"?"laissé passer le délai":"refusé ton défi"} « ${esc(d.themeN)} » : il porte le pompier qui se défile pendant 1 heure.`}
 else{const win=d.winner===me.id,draw=!d.winner;h=draw?"Match nul":win?"Victoire !":"Défaite…";ic=draw?"":win?DECO_IC.medal:DECO_IC.broom;txt=duelScoreHtml(d)+`<p class="small">${draw?"Égalité parfaite : pas de décoration. +15 points.":win?"Ta médaille brille à côté de ton nom pendant 1 heure. +30 points.":"Corvée de balai pendant 1 heure… +10 points pour avoir joué."}</p>`}
 el.innerHTML=`<div class="dlbox"><div class="dltag">RÉSULTAT DU DUEL</div><h3 class="${d.winner===me.id?"win":""}">${h}</h3>${ic?`<div class="dlbig">${ic}</div>`:""}${d.status==="done"?txt:`<p class="small">${txt}</p>`}
  ${canNick(d)?`<button class="btn full" data-dnick style="margin-top:10px">✍ Choisir un surnom pour ${esc(o.n)}</button>`:""}<div class="actions" style="margin:12px 0 0">${d.status==="done"?`<button class="btn sec" style="flex:1" data-dok>Fermer</button><button class="btn" style="flex:1" data-drev>${d.winner===me.id?"Rejouer":"Revanche"}</button>`:`<button class="btn full" data-dok>Compris</button>`}</div></div>`;
 document.body.appendChild(el);if(d.winner===me.id)confetti(el);el.querySelector("[data-dok]").onclick=()=>el.remove();const rv=el.querySelector("[data-drev]");if(rv)rv.onclick=()=>{el.remove();duelSheet(o.id,d.level,d.theme)};const nk=el.querySelector("[data-dnick]");if(nk)nk.onclick=()=>{el.remove();nickSheet(d)}}
function duelScoreHtml(d){const o=duelOther(d),A=d.mine||{},B=d.other||{};const t=ms=>{const s=Math.round((ms||0)/1000);return s>=60?`${Math.floor(s/60)} min ${String(s%60).padStart(2,"0")}`:`${s} s`};
 return `<div class="dlscore"><div class="${d.winner===me.id?"w":""}">Toi<b>${A.pts??"—"}</b><span class="small">${A.ok??0}/10 · ${t(A.ms)}</span></div><div class="${d.winner===o.id?"w":""}">${esc(o.n)}<b>${B.pts??"—"}</b><span class="small">${B.ok??0}/10 · ${t(B.ms)}</span></div></div>`}
function confetti(host){if(matchMedia("(prefers-reduced-motion: reduce)").matches)return;const C=["#ffd60a","#e3051b","#0a84ff","#34c759","#ff9f0a"];for(let i=0;i<40;i++){const s=document.createElement("i");s.className="cft";s.style.left=Math.random()*100+"%";s.style.background=pick(C);s.style.animationDelay=Math.random()*.6+"s";s.style.transform=`rotate(${Math.random()*360}deg)`;host.appendChild(s);setTimeout(()=>s.remove(),3200)}}
// choix de l'adversaire, du niveau et du thème
function duelThemes(lvl){return lvl==="simple"?[["all","Tous les thèmes"],...Object.entries((SIMPLE&&SIMPLE.themes)||{})]:[["all","Tous les thèmes"],...DATA.map(t=>[t.id,short(t)])]}
async function duelSheet(toId,lvl,theme){if(!me||me.expired){toast("Connecte-toi pour défier un membre.");return}
 await loadSimple().catch(()=>null);if(!board)await loadBoard(true);
 let L=lvl||(level==="simple"?"simple":"expert"),T=theme||"all",to=toId||"",q="";
 const people=()=>(board&&board.profiles||[]).filter(p=>p.id!==me.id).sort((a,b)=>((b.team===myTeamId())-(a.team===myTeamId()))||a.pseudo.localeCompare(b.pseudo));
 const draw=()=>{const P=people().filter(p=>!q||norm(p.pseudo+" "+(p.unite||"")).includes(norm(q)));const tm=myTeamId();
  const sh=sheet(`<h2>Lancer un duel</h2><p class="small">10 questions chronométrées : plus tu réponds vite, plus tu marques. Ton adversaire a 48 h pour jouer les mêmes.</p>
   <div class="sect">Adversaire</div><input class="search" id="dlQ" type="search" placeholder="Chercher un membre" value="${esc(q)}">
   <div class="list dlpeople">${P.slice(0,40).map(p=>`<button class="row ${p.id===to?"sel":""}" data-dto="${esc(p.id)}">${avatar(p,32)}<span class="tx"><b>${gradeSvg(rankCode((p.stats&&p.stats.rank)||0),"rkmini")}${esc(p.pseudo)}${decoHtml(p).replace(/^<button type="button"/,"<span").replace(/<\/button>$/,"</span>")}</b><span>${p.team&&p.team===tm?"Mon équipe":esc(p.unite||"")}</span></span>${p.id===to?'<span class="pill ok">Choisi</span>':""}</button>`).join("")||`<p class="small" style="padding:10px">Aucun membre trouvé.</p>`}</div>
   <div class="sect">Niveau</div><div class="seg"><button data-dl="simple" aria-pressed="${L==="simple"}">Sapeur</button><button data-dl="expert" aria-pressed="${L==="expert"}">Officier</button></div>
   <div class="sect">Thème</div><div class="chips wrap">${duelThemes(L).map(([k,l])=>`<button class="chip" data-dt="${esc(k)}" aria-pressed="${k===T}">${esc(l)}</button>`).join("")}</div>
   <button class="btn full" id="dlGo" style="margin-top:16px" ${to?"":"disabled"}>${to?`Défier ${esc(people().find(p=>p.id===to)?.pseudo||"")}`:"Choisis un adversaire"}</button><p class="small" id="dlMsg" style="margin:8px 0 0"></p>`);
  const qi=sh.querySelector("#dlQ");qi.oninput=()=>{q=qi.value;clearTimeout(qi._t);qi._t=setTimeout(()=>{draw();const n=$("#dlQ");if(n){n.focus();n.setSelectionRange(n.value.length,n.value.length)}},250)};
  sh.querySelectorAll("[data-dto]").forEach(b=>b.onclick=()=>{to=b.dataset.dto;draw()});
  sh.querySelectorAll("[data-dl]").forEach(b=>b.onclick=()=>{L=b.dataset.dl;T="all";draw()});
  sh.querySelectorAll("[data-dt]").forEach(b=>b.onclick=()=>{T=b.dataset.dt;draw()});
  sh.querySelector("#dlGo").onclick=async e=>{const b=e.currentTarget;b.disabled=true;b.textContent="Préparation…";
   const pool=L==="simple"?(SIMPLE&&SIMPLE.items||[]).filter(x=>(T==="all"||x.g===T)&&(x._k==="qcm"||x._k==="vf")):ALL.filter(x=>(T==="all"||x._t.id===T)&&(x._k==="qcm"||x._k==="vf"));
   const cands=fresh(pool).slice(0,80).map(x=>x._id);const tn=(duelThemes(L).find(x=>x[0]===T)||[,"Tous les thèmes"])[1];
   try{const j=await api("duel/new","POST",{to,level:L,theme:T,themeN:tn,cands});closeSheet();alog("duel","défi lancé",{contre:j.duel.toN,theme:tn,niveau:L});runDuel(j.duel)}
   catch(err){b.disabled=false;b.textContent="Réessayer";$("#dlMsg").textContent=err.error||"Erreur."}}};
 draw()}
// partie de duel
function runDuel(d){const wantSimple=d.level==="simple";(wantSimple?loadSimple():Promise.resolve()).catch(()=>null).then(()=>{
 const qs=d.qids.map(id=>BYID[id]).filter(Boolean).map(mixQ);if(qs.length<5){toast("Questions introuvables : mets l'appli à jour.");return}
 let i=0,pts=0,ok=0,t0=0,tAll=0,done=false;const ans=[];let tick=null;const o=duelOther(d);
 const stop=()=>{clearInterval(tick);tick=null};
 const show=()=>{const q=qs[i];t0=Date.now();
  app.innerHTML=push(`Duel · ${o.n}`,`${i+1}/${qs.length}`)+`<div class="bar"><i style="width:${i/qs.length*100}%"></i></div>
   <div class="dlhud"><span class="qtag">${esc(d.themeN)} · ${duelLvl(d)}</span><span class="dlpts"><b id="dlP">${pts}</b> pts</span><span class="dlclock" id="dlC">100</span></div>
   <p class="qtext">${esc(q.q)}</p>${q._k==="qcm"?`<div class="opts">${q.choices.map((c,k)=>`<button class="opt" data-k="${k}"><span class="k">${LETTERS[k]}</span><span>${esc(c)}</span></button>`).join("")}</div>`:`<div class="vf"><button class="opt" data-k="1">VRAI</button><button class="opt" data-k="0">FAUX</button></div>`}<div id="after"></div>`;
  cleanup=stop;bindBack(()=>{if(done)return;if(!confirm("Quitter le duel ? Les questions restantes seront comptées fausses.")){return}finish()});
  stop();tick=setInterval(()=>{const c=$("#dlC");if(c)c.textContent=duelPts((Date.now()-t0)/1000)},250);
  app.querySelectorAll(".opt").forEach(b=>b.onclick=()=>{if(b.disabled)return;stop();const s=(Date.now()-t0)/1000;tAll+=Date.now()-t0;const k=+b.dataset.k;const corr=q._k==="qcm"?q.answer:(q.answer?1:0);const good=k===corr;
   const g=good?duelPts(s):0;if(good){ok++;pts+=g}ans.push({q,good,k});record(q._id,good);if(navigator.vibrate)navigator.vibrate(good?15:[30,40,30]);
   app.querySelectorAll(".opt").forEach(x=>{x.disabled=true;if(+x.dataset.k===corr)x.classList.add("good");else if(x===b)x.classList.add("bad")});
   $("#dlP").textContent=pts;$("#after").innerHTML=`<div class="dlgain ${good?"good":"bad"}">${good?`+${g} pts`:"0 pt"}</div>`;
   setTimeout(()=>{i++;i<qs.length?show():finish()},good?650:1100)})};
 const finish=async()=>{if(done)return;done=true;stop();cleanup=null;for(let k=ans.length;k<qs.length;k++)ans.push({q:qs[k],good:false,k:-1});
  app.innerHTML=push("Duel")+`<div class="loading">Envoi du résultat…</div>`;let r=null;
  for(let tries=0;tries<3&&!r;tries++){try{r=(await api("duel/play","POST",{did:d.id,pts,ok,ms:tAll})).duel}catch(e){if(e.error&&!e.offline){toast(e.error);break}await new Promise(z=>setTimeout(z,1500))}}
  alog("duel","duel joué",{contre:o.n,points:pts,justes:ok+"/"+qs.length});await loadDuels(true);
  const res=r||{...d,mine:{pts,ok,ms:tAll},status:d.from===me.id?"pending":"pending"};
  const bad=ans.filter(a=>!a.good);const recap=bad.length?`<div class="sect">Corrigé (${bad.length})</div><div class="recap">${bad.map(a=>`<div class="card"><div class="qhead"><b>${esc(a.q.q)}</b>${markBtn(a.q._id,false)}</div><div class="a">${esc(a.q._k==="qcm"?a.q.choices[a.q.answer]:(a.q.answer?"Vrai":"Faux"))}</div><div class="e">${esc(a.q.explication||"")}</div>${srcBtn(a.q)}</div>`).join("")}</div>`:`<p class="sub" style="text-align:center">Sans faute !</p>`;
  if(res.status==="done"){app.innerHTML=push("Résultat du duel")+`<div class="result"><div class="dlbig sm">${!res.winner?"":res.winner===me.id?DECO_IC.medal:DECO_IC.broom}</div><div class="grade">${!res.winner?"Match nul !":res.winner===me.id?"Victoire !":"Défaite…"}</div>${duelScoreHtml(res)}<p class="small">${!res.winner?"Égalité parfaite. +15 points.":res.winner===me.id?"Médaille affichée pendant 1 heure. +30 points.":"Corvée de balai pendant 1 heure. +10 points."}</p></div>${canNick(res)?`<button class="btn full" id="dNick" style="margin-top:6px">✍ Choisir un surnom pour ${esc(o.n)}</button>`:""}<div class="actions"><button class="btn${canNick(res)?" sec":""}" id="dRev">${res.winner===me.id?"Rejouer":"Revanche"}</button><button class="btn sec" id="dHub">Mes duels</button></div>${recap}`;
   const seen=store.get("duelSeen",{});seen[res.id]=1;store.set("duelSeen",seen);if(res.winner===me.id)confetti(app);loadBoard(true);duelCredit()}
  else app.innerHTML=push("Duel envoyé")+`<div class="result"><div class="score">${pts}</div><div class="grade">points · ${ok}/${qs.length} bonnes réponses</div><p class="small">Défi envoyé à <b>${esc(o.n)}</b>. Il a 48 h pour jouer les mêmes questions ; tu verras le résultat dès qu'il aura joué.</p></div><div class="actions"><button class="btn" id="dHub">Mes duels</button><button class="btn sec" id="dRev">Défier quelqu'un d'autre</button></div>${recap}`;
  bindBack(()=>go("home"));bindSrc();const h=$("#dHub");if(h)h.onclick=viewDuels;const nk=$("#dNick");if(nk)nk.onclick=()=>nickSheet(res,()=>{nk.remove()});const rv=$("#dRev");if(rv)rv.onclick=()=>duelSheet(res.status==="done"?o.id:"",d.level,d.theme);window.scrollTo(0,0)};
 show()})}
// écran « Mes duels »
function viewDuels(){app.innerHTML=push("Mes duels")+`<div id="dlBody"><div class="loading">Chargement…</div></div>`;bindBack(()=>go("home"));
 const draw=()=>{const el=$("#dlBody");if(!el)return;const inc=duelIncoming(),wait=duels.filter(d=>d.from===me.id&&d.status==="pending"),fin=duels.filter(d=>["done","declined","expired"].includes(d.status)).slice(0,15);
  const row=(d,right,act)=>{const o=duelOther(d);const op=(board&&board.profiles||[]).find(p=>p.id===o.id)||{pseudo:o.n,id:o.id};return `<div class="row dlrow">${avatar(op,36)}<span class="tx"><b>${esc(o.n)}${decoHtml(op)}</b><span>${esc(d.themeN)} · ${duelLvl(d)}</span></span>${right}${act||""}</div>`};
  const res=d=>d.status==="declined"?'<span class="pill none">Refusé</span>':d.status==="expired"?'<span class="pill none">Forfait</span>':!d.winner?'<span class="pill warn">Nul</span>':d.winner===me.id?`<span class="pill ok">Gagné ${d.mine?.pts??""}</span>`:`<span class="pill ko">Perdu ${d.mine?.pts??""}</span>`;
  el.innerHTML=`<button class="btn full" id="dlNew" style="margin-top:12px">⚔ Lancer un duel</button>
   <div class="sect">À jouer (${inc.length})</div><div class="list">${inc.map(d=>row(d,`<span class="small">${dlLeft(d)}</span>`,`<button class="btn small" data-dplay="${d.id}">Jouer</button>`)).join("")||'<div class="row"><span class="tx"><span>Aucun défi reçu pour l\'instant.</span></span></div>'}</div>
   <div class="sect">En attente de l'adversaire (${wait.length})</div><div class="list">${wait.map(d=>row(d,`<span class="small">ton score ${d.mine?.pts??"—"} · ${dlLeft(d)}</span>`)).join("")||'<div class="row"><span class="tx"><span>Aucun défi en attente.</span></span></div>'}</div>
   <div class="sect">Derniers résultats</div><div class="list">${fin.map(d=>`<button class="row dlrow" data-dres="${d.id}">${(()=>{const o=duelOther(d);const op=(board&&board.profiles||[]).find(p=>p.id===o.id)||{pseudo:o.n,id:o.id};return `${avatar(op,36)}<span class="tx"><b>${esc(o.n)}</b><span>${esc(d.themeN)} · ${new Date(d.done||d.created).toLocaleDateString("fr-FR",{day:"numeric",month:"short"})}${d.nick?` · surnom « ${esc(d.nick)} »`:""}${canNick(d)?' · <b style="color:var(--ko)">surnom à choisir !</b>':""}</span></span>`})()}${res(d)}</button>`).join("")||'<div class="row"><span class="tx"><span>Pas encore de duel terminé.</span></span></div>'}</div>
   <p class="small" style="margin:12px 4px 0">Barème : bonne réponse = 100 points moins 5 par seconde (30 minimum). Le meilleur total gagne. Victoire +30, nul +15, défaite +10 points au classement de la semaine. Médaille, corvée de balai ou pompier qui se défile : 1 heure à côté du nom. Le gagnant choisit aussi un surnom au perdant pour 1 heure. 3 défis lancés en même temps au maximum.</p>`;
  $("#dlNew").onclick=()=>duelSheet();el.querySelectorAll("[data-dplay]").forEach(b=>b.onclick=()=>runDuel(duels.find(d=>d.id===b.dataset.dplay)));
  el.querySelectorAll("[data-dres]").forEach(b=>b.onclick=()=>{const d=duels.find(x=>x.id===b.dataset.dres);if(d){if(canNick(d))nickSheet(d,draw);else duelResultPop(d)}})};
 draw();loadDuels(true).then(()=>{if($("#dlBody"))draw()})}
function refreshDuelViews(){if($("#dlBody"))viewDuels();else if(tab==="home"&&!document.body.classList.contains("pushed"))viewHome()}
function duelTile(){const n=me&&!me.expired?duelIncoming().length:0;return `<button class="tile wide dltile" data-duels><span class="ic" style="background:#e3051b">⚔</span><div><b>Duels${n?` <span class="dlbadge">${n}</span>`:""}</b><br><span>${n?`${n} défi${n>1?"s":""} à relever !`:"Défie un membre sur 10 questions"}</span></div></button>`}
document.addEventListener("click",e=>{const b=e.target.closest("[data-duels]");if(b){e.preventDefault();viewDuels()}const c=e.target.closest("[data-duelp]");if(c){e.preventDefault();e.stopPropagation();duelSheet(c.dataset.duelp)}});

/* ============ Accueil mode CI BSPP ============ */
function viewHomeCI(){const w=isoWeek(),dd=defiDone[w];
 const t=(k,ic,col,ti,su)=>`<button class="tile" data-ci="${k}"><span class="ic" style="background:${col}">${ic}</span><b>${ti}</b><span>${su}</span></button>`;
 app.innerHTML=`<div class="hello">${LOGOS}</div><h1 class="big">Assistant CI BSPP</h1><p class="sub">Tes outils de garde.</p>
  <div class="tiles">
   ${t("radio",RADIO_IC_T,"#0f1d36","Messages radio","Construis ton message, statuts")}
   ${t("cri",'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="3"/><path d="M7 9h4M7 13h10M7 17h6"/></svg>',"#e3051b","Codes CRI","Trouver le code retour")}
   ${t("carte",MAP_IC_T,"#1f9d55","Carte des secteurs","CS, adresses, PVO, Golf")}
   ${t("docs",I.book,"#5e5ce6","Documents","Tous les référentiels")}
   <button class="tile wide hosptile" data-ci="hospnear"><span class="ic" style="background:#d92d20">${H_IC}</span><div><b>Hôpital le plus proche</b><br><span>Localise-toi et filtre par spécialité (SAU, maternité, SOS Mains…)</span></div></button>
   <button class="tile wide" data-ci="grades"><span class="ic gic">${gradeSvg("CNE","")}</span><div><b>Grades</b><br><span>La planche des galons BSPP</span></div></button>
  </div>
  <div class="defimini"><div><span class="wk">DÉFI ${w}</span><b>Défi de la semaine</b><span class="small">${dd?`Ton score : ${dd.score}/20`:"20 questions pour garder la main"}</span></div><button class="btn small" id="defiGo">${dd?"Rejouer":"Jouer"}</button></div>
  <p class="small" style="margin:14px 4px 0">Envie de réviser ? Repasse en mode Apprenti depuis ton profil.</p>
  <footer class="note" style="margin-top:10px"><b>Application non officielle.</b> Elle n'est ni éditée ni validée par la BSPP ni par la Croix-Rouge française et sert uniquement à s'entraîner et à réviser. Développée par l'Unité Locale de Paris XVIII de la Croix-Rouge française.</footer>`;
 $("#defiGo").onclick=()=>runQuiz(defiQuestions(),"defi",false);
 app.querySelectorAll("[data-ci]").forEach(b=>b.onclick=()=>b.dataset.ci==="hospnear"?openHospNear():go(b.dataset.ci))}

/* ============ Tutoriel / présentation ============ */
const TUTO_IC='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M9.5 9.2a2.6 2.6 0 0 1 5 .9c0 1.7-2.5 2.3-2.5 3.9"/><circle cx="12" cy="17" r=".6" fill="currentColor"/></svg>';
function tutoSlides(){const ic=(svg,bg)=>`<span class="tic" style="background:${bg}">${svg}</span>`;return [
 {art:`<div class="tlogos">${LOGOS}</div>`,t:"Bienvenue dans le Quiz CI BSPP",p:"L'appli pour se former au parcours Chef d'Intervention en réseau de secours BSPP, et garder la main une fois en poste. En quelques écrans, voici comment elle fonctionne.",n:"Application non officielle, développée par l'Unité Locale de Paris XVIII de la Croix-Rouge française."},
 {art:`<div class="tpair"><div>${CROSS_IC}<b>Apprenti</b></div><div>${HELMET_IC}<b>CI BSPP</b></div></div>`,t:"Deux modes d'utilisation",p:"<b>Apprenti</b> : tout l'entraînement pour préparer le parcours. <b>CI BSPP</b> : une fois formé, l'appli devient ton assistant de garde, avec le défi de la semaine et tes outils.",n:"Tu changes de mode quand tu veux dans Profil › Moi. Ton choix suit ton compte."},
 {art:`<div class="tpair"><div>${gradeSvg("1CL","tgr")}<b>Sapeur</b></div><div><span class="tgr">${LTN_HELM}</span><b>Officier</b></div></div>`,t:"Deux niveaux de questions",p:"<b>Sapeur</b> : des questions faciles pour découvrir les documents (5 points). <b>Officier</b> : des questions expertes, tirées des référentiels (20 points).",n:"Le niveau se choisit en haut de l'accueil, en mode Apprenti."},
 {art:ic(I.quiz,"#0a84ff"),t:"Des jeux pour réviser",p:"Quiz, vrai ou faux en 60 secondes, flashcards, séquences à remettre dans l'ordre, cas pratiques, examen blanc… et chaque semaine un <b>défi</b> : les mêmes 20 questions pour tout le monde.",n:"Les questions changent à chaque partie : celles que tu n'as jamais vues passent en premier."},
 {art:ic(I.book,"#5e5ce6"),t:"Le référentiel à portée de main",p:"Après chaque question, <b>Voir dans le référentiel</b> ouvre la bonne page du document. Le drapeau <b>Marquer</b> garde une question de côté pour la revoir dans Réviser.",n:"Tous les documents sont aussi dans le menu Documents, avec une recherche."},
 {art:`<div class="tpair">${ic(RADIO_IC_T,"#0f1d36")}${ic(MAP_IC_T,"#1f9d55")}</div>`,t:"Tes outils de garde",p:"<b>Messages radio</b> : construis ton message pas à pas avec ton indicatif. <b>Codes CRI</b>, <b>Carte des secteurs</b> (adresses des CS et téléphones des PVO), <b>Hôpitaux</b> (le plus proche, filtré par spécialité), <b>Grades</b> et <b>Documents</b>.",n:"Tout est accessible depuis le menu en haut à droite."},
 {art:ic(I.user,"#ff9f0a"),t:"Classements et équipes",p:"Rejoins ou crée ton équipe dans Profil › Équipe. Touche une <b>équipe</b> pour voir ses membres (Points, Défi, Fiches, Duels), puis un <b>membre</b> pour voir sa fiche et le défier. Les points de la semaine repartent de zéro chaque lundi.",n:"Le menu Statistiques montre ton total depuis ton arrivée, tes courbes semaine par semaine et ton évaluation par fiche."},
 {id:"duel",art:`<div class="tpair"><div><span class="tdeco">${DECO_IC.medal}</span><b>Gagnant</b></div><div><span class="tdeco">${DECO_IC.broom}</span><b>Perdant</b></div><div><span class="tdeco">${DECO_IC.run}</span><b>Refus</b></div></div>`,t:"Les duels",p:"Défie un membre sur <b>10 questions chronométrées</b>, au thème et au niveau de ton choix : tuile <b>Duels</b> de l'accueil ou bouton ⚔ dans les classements. Ton adversaire a 48 h pour jouer les mêmes questions ; plus on répond vite, plus on marque. Le gagnant porte la <b>médaille</b> et choisit un <b>surnom</b> au perdant, qui passe <b>le balai</b>. Refuser ? Tu deviens le <b>pompier qui se défile</b> !",n:"Décorations et surnom s'affichent 1 heure à côté du nom, dans tous les classements. Victoire +30 points, nul +15, défaite +10."},
 {id:"rank",art:`<div class="tpair"><div>${gradeSvg("SAP","tgr")}<b>Sapeur 2e cl.</b></div><div>${gradeSvg("1CL","tgr")}<b>1re classe</b></div><div>${gradeSvg("CPL","tgr")}<b>Caporal</b></div></div>`,t:"Monte en grade",p:"Tu débutes <b>Sapeur de 2e classe</b>. Chaque exercice d'au moins 5 questions réussi à <b>50 % ou plus</b> fait avancer ta barre de progression. Une fois la barre pleine, l'<b>examen de passage</b> se débloque : 15 questions, <b>12 bonnes réponses</b> pour être promu, avec feu d'artifice et ton nouveau galon.",n:"Il faut 3 exercices réussis pour les premiers grades, un peu plus à mesure que tu montes. Examen raté : nouvel essai après 3 exercices réussis."},
 {art:`<div class="tpair"><div>${gradeSvg("SCH","tgr")}<b>Sergent-chef</b></div><div><span class="tgr">${LTN_HELM}</span><b>Niveau Officier</b></div></div>`,t:"Garde tes galons",p:"<b>3 exercices d'affilée sous 50 %</b> et tu redescends d'un grade : l'appli te prévient dès le 2e. Au-delà de <b>Sergent-chef</b>, seuls les exercices du <b>niveau Officier</b> font progresser : pour viser Adjudant, Lieutenant ou Général, il faut maîtriser les questions expertes.",n:"Ton grade, ta barre de progression et le bouton de l'examen sont dans Profil › Moi et en haut du menu Statistiques. Ton galon s'affiche aussi devant ton pseudo dans les classements."},
 {art:`<div class="tpair">${ic(FLAME_IC,"#ff6a00")}${ic(I.refresh,"#0f1d36")}</div>`,t:"Ton profil, tes réglages",p:"Dans Profil › Moi : choisis ton ambiance : <b>Normal</b>, <b>Braise</b> (messages de sergent-chef énervé, sans effets) ou <b>On Fire</b> (en plus, thème enflammé et animations). Et si l'appli semble ancienne, touche <b>Forcer la mise à jour</b> pour charger la dernière version.",n:"Ta version et la dernière version en ligne y sont affichées. Ta progression est conservée."},
 {art:ic(I.plus,"#e3051b"),t:"À toi de jouer !",p:"Sur iPhone, ajoute l'appli à ton écran d'accueil : bouton <b>Partager</b> puis <b>Sur l'écran d'accueil</b>. Le menu se trouve en haut à droite de chaque page.",n:"Tu pourras revoir cette présentation à tout moment dans Profil › Moi › Tutoriel."}]}
const NEWS={rank:{n:2,t:"Nouveau dans la version 3.2",p:"Deux nouveautés : un <b>grade de progression</b> qui évolue avec tes résultats, et un menu <b>Statistiques</b> à part. Voici comment ça marche."},
 duel:{n:1,t:"Nouveau dans la version 3.3",p:"Les <b>duels</b> arrivent : défie tes collègues, gagne la médaille… ou passe le balai. Et le menu <b>Statistiques</b> a été refait, avec ses onglets Résumé, Évolution et Fiches."}};
function openTuto(onDone,from){let S=tutoSlides();if(from&&NEWS[from]){const k=S.findIndex(x=>x.id===from);const N=NEWS[from];if(k>0)S=[{art:`<div class="tlogos">${LOGOS}</div>`,t:N.t,p:N.p,n:"Tu pourras revoir tout le tutoriel dans Profil › Moi › Tutoriel."},...S.slice(k,k+N.n)]}let i=0;const el=document.createElement("div");el.className="tuto";el.setAttribute("role","dialog");el.setAttribute("aria-modal","true");document.body.appendChild(el);
 const close=()=>{el.remove();document.removeEventListener("keydown",key);if(onDone)onDone()};
 const draw=()=>{const s=S[i];el.innerHTML=`<div class="tbox"><button class="tskip" id="tSkip">${i<S.length-1?"Passer":"Fermer"}</button>
   <div class="tslide" key="${i}"><div class="tart">${s.art}</div><h2>${esc(s.t)}</h2><p>${s.p}</p>${s.n?`<p class="small">${esc(s.n)}</p>`:""}</div>
   <div class="tdots">${S.map((_,k)=>`<i class="${k===i?"on":""}"></i>`).join("")}</div>
   <div class="actions" style="margin:0">${i?`<button class="btn sec" id="tPrev">Précédent</button>`:""}<button class="btn ${i?"":"full"}" id="tNext" style="flex:1">${i<S.length-1?"Suivant":"C'est parti !"}</button></div></div>`;
  $("#tSkip").onclick=close;$("#tNext").onclick=()=>{if(i<S.length-1){i++;draw()}else close()};const pv=$("#tPrev");if(pv)pv.onclick=()=>{i--;draw()}};
 const key=e=>{if(e.key==="ArrowRight"&&i<S.length-1){i++;draw()}else if(e.key==="ArrowLeft"&&i>0){i--;draw()}else if(e.key==="Escape")close()};document.addEventListener("keydown",key);
 let x0=null;el.addEventListener("touchstart",e=>{x0=e.touches[0].clientX},{passive:true});el.addEventListener("touchend",e=>{if(x0==null)return;const dx=e.changedTouches[0].clientX-x0;x0=null;if(dx<-50&&i<S.length-1){i++;draw()}else if(dx>50&&i>0){i--;draw()}});
 draw()}

/* ============ Lexique des acronymes ============ */
const LEX={"CPOA":{"d":"Centre psychiatrique d'orientation et d'accueil","x":"Accueil psychiatrique d'urgence 24 h/24, à l'hôpital Sainte-Anne (Paris 14e)."},"ORL":{"d":"Oto-rhino-laryngologie","x":"Spécialité de l'oreille, du nez et de la gorge."},"AP-HP":{"d":"Assistance publique – Hôpitaux de Paris","x":"CHU d'Île-de-France, qui regroupe la plupart des hôpitaux publics de Paris et de la petite couronne."},"HEGP":{"d":"Hôpital européen Georges-Pompidou","x":"Hôpital AP-HP du 15e arrondissement (SAU, SOS Mains adultes)."},"BSPP":{"d":"Brigade de sapeurs-pompiers de Paris","x":"Unité militaire chargée des secours à Paris et dans la petite couronne (92, 93, 94)."},"ACR":{"d":"Arrêt cardio-respiratoire","x":"Victime sans pouls carotidien, ou qui ne respire pas, ou qui présente des gasps."},"PVO":{"d":"Poste de veille opérationnelle","x":"Poste du centre de secours tenu par le stationnaire : il fait partir les moyens et suit leur état."},"CSO":{"d":"Centre de suivi opérationnel","x":"Station directrice du groupement (indicatif « Golf »), interlocuteur radio principal des engins."},"COS":{"d":"Commandant des opérations de secours","x":"Chef sur le terrain : il commande l'intervention, demande les moyens et rédige le message de rentrée."},"RCP":{"d":"Réanimation cardio-pulmonaire","x":"Association du massage cardiaque et des insufflations sur une victime en arrêt cardiaque."},"VSAV":{"d":"Véhicule de secours et d'assistance aux victimes","x":"Ambulance des sapeurs-pompiers : secours à victime et transport à l'hôpital."},"DSA":{"d":"Défibrillateur semi-automatique","x":"Appareil qui analyse le rythme cardiaque et délivre un choc électrique si nécessaire."},"DAE":{"d":"Défibrillateur automatisé externe","x":"Défibrillateur, souvent public (civil), pouvant être utilisé par tout témoin."},"CO":{"d":"Centre opérationnel","x":"Station directrice principale de la BSPP (salle 18/112), à Champerret. En médecine, CO = monoxyde de carbone."},"ADAGIO":{"d":"Application diffusion alerte et gestion informatisée des opérations","x":"Logiciel de gestion des interventions et des moyens de la BSPP."},"BSP":{"d":"Règlement de la Brigade de sapeurs-pompiers de Paris","x":"Préfixe des règlements de la BSPP, ex. BSP 200.2 (secours à victimes)."},"CA":{"d":"Chef d'agrès","x":"Responsable d'un engin et de son équipage en intervention."},"UA":{"d":"Urgence absolue","x":"Victime avec risque vital ou fonctionnel immédiat, nécessitant des soins sans délai."},"ECG":{"d":"Électrocardiogramme","x":"Enregistrement de l'activité électrique du cœur, transmissible à la coordination médicale."},"CS":{"d":"Centre de secours","x":"Caserne de sapeurs-pompiers d'où partent les engins."},"PLS":{"d":"Position latérale de sécurité","x":"Position sur le côté d'une victime inconsciente qui respire, pour protéger ses voies aériennes."},"DGT7":{"d":"Defigard Touch 7 (Schiller)","x":"Moniteur multiparamétrique avec DSA intégré, apparié en Bluetooth à la tablette eFiBi."},"DGT-7":{"d":"Defigard Touch 7 (Schiller)","x":"Moniteur multiparamétrique avec DSA intégré, apparié en Bluetooth à la tablette eFiBi."},"CEE":{"d":"Choc électrique externe","x":"Choc délivré par le défibrillateur pour tenter de rétablir un rythme cardiaque efficace."},"FC":{"d":"Fréquence cardiaque","x":"Nombre de battements du cœur par minute."},"MD":{"d":"Mode dégradé","x":"Fonctionnement de secours quand ADAGIO ou ANTARES est en panne (MD 1, 2, 3, 5…)."},"AASC":{"d":"Association agréée de sécurité civile","x":"Association de secours agréée par l'État, comme la Croix-Rouge française."},"NRBC":{"d":"Nucléaire, radiologique, biologique et chimique","x":"Désigne les risques et interventions liés à ces agents dangereux."},"VPSP":{"d":"Véhicule de premiers secours à personnes","x":"Ambulance de secours des associations agréées (AASC), équivalent associatif du VSAV."},"CM":{"d":"Coordination médicale","x":"Médecins de la BSPP joints par le chef d'agrès pour valider la conduite à tenir."},"SSUAP":{"d":"Secours et soins d'urgence aux personnes","x":"Désigne les missions de secours à victime de la BSPP."},"GRIMP":{"d":"Groupe de reconnaissance et d'intervention en milieux périlleux","x":"Équipe spécialisée pour les sauvetages et brancardages difficiles (hauteur, toits, sous-sols)."},"SINUS":{"d":"Système d'information numérique standardisé","x":"Système de suivi et d'identification des victimes lors d'événements à nombreuses victimes."},"O2":{"d":"Oxygène","x":"Gaz administré aux victimes au masque, selon la saturation (SpO2)."},"UR":{"d":"Urgence relative","x":"Victime sans risque vital ou fonctionnel immédiat."},"PAS":{"d":"Pression artérielle systolique","x":"Valeur haute de la tension ; sous 90 mmHg, signe de détresse circulatoire."},"TC":{"d":"Territorialement compétent","x":"Ex. CSO TC : le CSO dont dépend le secteur. En médecine, TC = traumatisme crânien."},"AVC":{"d":"Accident vasculaire cérébral","x":"Atteinte brutale d'une zone du cerveau ; noter l'heure de début des signes."},"CRI":{"d":"Code retour intervention","x":"Code chiffré donné à la fin du message de rentrée pour indiquer la nature de l'intervention (ex. 320 maladie)."},"UMH":{"d":"Unité mobile hospitalière","x":"Équipe médicale du SAMU/SMUR envoyée sur intervention."},"IRCS":{"d":"Intervention revêtant un caractère social","x":"Signalement depuis eFiBi d'une situation sociale vers les partenaires (CRIP, SIAO, ARS…)."},"PC":{"d":"Poste de commandement","x":"Ex. PC de compagnie. En médecine, PC = perte de connaissance."},"ANTARES":{"d":"Adaptation nationale des transmissions aux risques et aux secours","x":"Réseau radio numérique national des services de secours."},"FV":{"d":"Fibrillation ventriculaire","x":"Contractions anarchiques du cœur, sans pompage efficace ; traitée par le choc du DSA."},"CMA":{"d":"Code motif d'alerte","x":"Code chiffré du motif de départ, en haut de l'ordre de départ (ex. 321)."},"SAMU":{"d":"Service d'aide médicale urgente","x":"Service hospitalier de régulation médicale (centre 15) et des équipes SMUR."},"MEA":{"d":"Moyen élévateur aérien","x":"Échelle ou bras élévateur permettant d'atteindre les étages."},"MCE":{"d":"Massage cardiaque externe","x":"Compressions thoraciques réalisées sur une victime en arrêt cardiaque."},"PA":{"d":"Pression artérielle","x":"Tension mesurée au brassard (systolique / diastolique)."},"TPH":{"d":"Terminal portatif hertzien","x":"Radio portative ; le TPH 700 remplace le GP360."},"VTBA":{"d":"Véhicule de transport bariatrique","x":"Véhicule pour transporter une personne de 185 à 300 kg."},"CI":{"d":"Chef d'intervention","x":"Responsable Croix-Rouge de l'équipage et de l'intervention."},"OGC":{"d":"Officier de garde compagnie","x":"Officier de permanence de la compagnie, premier niveau de commandement."},"MCO":{"d":"Main courante opérationnelle","x":"Registre où sont consignés les événements et informations d'une intervention."},"MD5":{"d":"Mode dégradé 5","x":"ADAGIO indisponible pour le CO, les CSO et les PVO : tout passe en phonie."},"EP":{"d":"Engin-pompe","x":"Engin d'incendie (FPT, PSE…) équipé d'une pompe."},"PSE":{"d":"Premier-secours évacuation","x":"Engin-pompe polyvalent de premier départ avec cellule sanitaire. Ailleurs : PSE1/PSE2 = diplômes de secourisme."},"IAO":{"d":"Infirmier(ère) d'accueil et d'orientation","x":"Soignant des urgences de l'hôpital à qui l'on transmet la victime."},"CAI":{"d":"Centre d'accueil des impliqués","x":"Lieu d'accueil des personnes impliquées non blessées lors d'un plan rouge."},"ARI":{"d":"Appareil respiratoire isolant","x":"Appareil à bouteille d'air, indispensable en espace confiné ou en atmosphère toxique."},"APRF":{"d":"Appareil de protection respiratoire filtrant","x":"Masque à cartouche filtrante, utilisable uniquement à l'air libre."},"AR":{"d":"Ambulance de réanimation","x":"Moyen médicalisé de la BSPP (médecin, infirmier, conducteur) pour les détresses vitales."},"GIS":{"d":"Groupement d'incendie et de secours","x":"Une des 3 grandes divisions territoriales de la BSPP (G1, G2, G3)."},"VRA":{"d":"Véhicule risque animalier","x":"Engin armé par le groupe risque animalier (G. RANI)."},"PMA":{"d":"Poste médical avancé","x":"Structure de soins et de tri des victimes installée près d'un lieu de catastrophe."},"MHTA":{"d":"Maladies, hospitalisations, traitements, allergies","x":"Moyen mnémotechnique pour recueillir les antécédents de la victime."},"SAM":{"d":"Service, adresse, motif","x":"Ordre des éléments d'un message radio de demande de moyens."},"EVS":{"d":"Échelle verbale simple","x":"Échelle de la douleur de 0 à 4 donnée par la victime avec des mots."},"PRV":{"d":"Point de regroupement des victimes","x":"Lieu où sont rassemblées les victimes ; il devient PMA à l'arrivée d'un médecin."},"ECMO":{"d":"Extracorporeal membrane oxygenation (oxygénation par membrane extracorporelle)","x":"Circulation extracorporelle posée par une équipe spécialisée sur certains ACR."},"CSTC":{"d":"Centre de secours territorialement compétent","x":"Centre de secours dont dépend le secteur de l'intervention."},"MTNM":{"d":"Moyen de transport non médicalisé","x":"Engin de transport de victimes sans médecin, ex. VSAV ou VPSP."},"SAV":{"d":"Secours à victime","x":"Mission de prise en charge des victimes ; « UV SAV » : formation requise pour être chef d'agrès VSAV."},"CRS":{"d":"Compagnie républicaine de sécurité","x":"Police compétente notamment sur les autoroutes."},"GST":{"d":"Groupe soutien télécommunications","x":"Groupe d'appui (VAC + VSTI) pour les transmissions."},"MMA":{"d":"Moyen mobile autonome","x":"Engin avec son équipage et ses matériels."},"VLR":{"d":"Véhicule de liaison radio","x":"Véhicule de commandement des officiers (ex. VLR OGC, VLR CDG)."},"FPT":{"d":"Fourgon pompe tonne","x":"Engin-pompe d'incendie puissant."},"KDUR":{"d":"Kit de décontamination d'urgence et de rhabillage","x":"Kit pour déshabiller, décontaminer et rhabiller une victime en NRBC."},"TRC":{"d":"Temps de recoloration cutanée","x":"Temps de retour de la couleur après pression du doigt ; > 2 s = détresse circulatoire."},"CRF":{"d":"Croix-Rouge française","x":"Association agréée de sécurité civile."},"RANI":{"d":"Risque animalier","x":"G. RANI : groupe risque animalier, qui arme le VRA."},"RETEX":{"d":"Retour d'expérience","x":"Analyse d'une intervention passée pour en tirer des enseignements."},"EM":{"d":"Équipe médicale","x":"Médecin et infirmier envoyés en renfort (AR ou UMH). Ailleurs, EM = état-major."},"P1":{"d":"Priorité 1","x":"Coup de chaleur : P1 = refroidir en urgence."},"P2":{"d":"Priorité 2","x":"Coup de chaleur : P2 = évacuer quand la température est < 38,5 °C."},"VPMA":{"d":"Véhicule poste médical avancé","x":"Engin transportant le matériel pour installer un PMA."},"H24":{"d":"24 heures sur 24","x":"Disponible jour et nuit."},"SDF":{"d":"Sans domicile fixe","x":""},"ARS":{"d":"Agence régionale de santé","x":"Partenaire IRCS pour l'habitat indigne."},"CRIP":{"d":"Cellule de recueil des informations préoccupantes","x":"Partenaire IRCS chargé de la protection de l'enfance."},"SIAO":{"d":"Service intégré d'accueil et d'orientation","x":"Partenaire IRCS pour les personnes sans domicile fixe."},"DSPAP":{"d":"Direction de la sécurité de proximité de l'agglomération parisienne","x":"Direction de la police chargée de la sécurité de proximité à Paris et petite couronne."},"HMB":{"d":"Hors missions Brigade","x":"Intervention ne relevant pas des missions de la BSPP (ex. procédure verte)."},"CIC":{"d":"Centre d'information et de commandement","x":"Salle de commandement de la police, contactée par le CSO pour les demandes police."},"CDG":{"d":"Chef de garde","x":"Sous-officier ou officier responsable de la garde du centre de secours."},"EVAC":{"d":"Évacuation","x":"G.EVAC : groupe évacuation du plan rouge."},"ZDI":{"d":"Zone de déploiement initial","x":"Point de regroupement des moyens avant leur engagement."},"ODE":{"d":"Ordre de départ","x":"Ordre immédiatement exécutable d'envoi des moyens sur une intervention."},"DOS":{"d":"Directeur des opérations de secours","x":"Autorité administrative (préfet de police) qui dirige les secours."},"ROFSIS":{"d":"Règlement sur l'organisation et le fonctionnement du service d'incendie et de secours","x":"Règlement BSP 118 de la BSPP."},"VID":{"d":"Véhicule d'interventions diverses","x":"Engin pour les interventions non urgentes (animaux, fuites, etc.)."},"EPI":{"d":"Équipement de protection individuelle","x":"Tenue et matériel protégeant l'intervenant (gants, masque, combinaison…)."},"AC":{"d":"Arrêt cardiaque","x":"Le cœur ne pompe plus : perte de connaissance et absence de respiration normale."},"MHC":{"d":"Masque à haute concentration","x":"Masque à oxygène avec réservoir, utilisé à 8-15 l/min."},"G3":{"d":"3e groupement d'incendie et de secours","x":"Groupement de Champerret."},"FT":{"d":"Fiche technique","x":"Fiche décrivant un geste ou une procédure dans le BSP 200.2 (ex. FT 14.1)."},"MAJ":{"d":"Mise à jour","x":""},"SAU":{"d":"Service d'accueil des urgences","x":"Service des urgences d'un hôpital."},"DAI":{"d":"Défibrillateur automatisé interne","x":"Défibrillateur implanté sous la peau du patient, qui peut délivrer des chocs."},"NNN":{"d":"Nouveau-né à la naissance","x":""},"DAP":{"d":"Détachement à pied","x":"Personnel engagé sans engin (au moins un binôme et du matériel)."},"DCD":{"d":"Décédé(e)","x":"Catégorie de victime dans les bilans (avec UA et UR)."},"MED":{"d":"Médical(e)","x":"Ex. Éq. MED : équipe médicale."},"IGH":{"d":"Immeuble de grande hauteur","x":""},"GAA":{"d":"Gilet anti-agression","x":"Gilet de protection porté sur les interventions à risque d'agression."},"UV":{"d":"Unité de valeur","x":"Module de formation validé (ex. UV SAV)."},"PDF1":{"d":"Papier de détection modèle F1","x":"Papier qui change de couleur au contact de certains toxiques de guerre liquides."},"C1":{"d":"1er cercle","x":"Personnes en contact direct avec la substance ou présentant des symptômes (C2 : à proximité)."},"FFP2":{"d":"Filtering Facepiece Particles, classe 2","x":"Masque filtrant qui protège celui qui le porte (risque infectieux, poussières)."},"FFP3":{"d":"Filtering Facepiece Particles, classe 3","x":"Masque filtrant de plus haute efficacité, utilisé notamment en risque NRBC."},"COMAT":{"d":"Combinaison d'intervention NRBC","x":"Tenue de protection NRBC portée sur le SVI avec APRF ou ARI et gants butyle."},"VEN":{"d":"Ventilation","x":"Le G.VEN est le groupe ventilation (ventilateur maître + ventilateur auxiliaire relais)."},"DN":{"d":"Départ normal","x":"Réponse initiale à tout feu : 2 engins-pompes, 1 moyen élévateur aérien et 1 ventilateur."},"OPJ":{"d":"Officier de police judiciaire","x":""},"UNV":{"d":"Unité neuro-vasculaire","x":"Service hospitalier spécialisé dans la prise en charge rapide des AVC."},"PSE2":{"d":"Premiers secours en équipe de niveau 2","x":"Diplôme de secouriste équipier requis pour armer un VPSP."},"PK":{"d":"Point kilométrique","x":"Repère de localisation sur le périphérique (préciser intérieur ou extérieur)."},"G2":{"d":"2e groupement d'incendie et de secours (GIS)","x":"État-major à Masséna (CSO MASS)."},"VP":{"d":"Voie publique","x":""},"AVP":{"d":"Accident sur la voie publique","x":"Terme courant à la Croix-Rouge ; à la radio BSPP on dit « accident de circulation »."},"OAP":{"d":"Œdème aigu du poumon","x":"Détresse respiratoire le plus souvent d'origine cardiaque."},"CAT":{"d":"Conduite à tenir","x":""},"PCI":{"d":"Perte de connaissance initiale","x":"Perte de connaissance brève juste après un choc, puis reprise de conscience."},"GCS":{"d":"Glasgow Coma Scale (score de Glasgow)","x":"Score de conscience de 3 à 15 (yeux, verbal, moteur)."},"SGAP-COORD":{"d":"Canal radio de coordination SGAP","x":"SGAP : secrétariat général pour l'administration de la police (canaux radio)."},"VAS":{"d":"Véhicule d'accompagnement santé","x":"Moyen santé BSPP, équipé notamment d'un brancard baignoire."},"VRCP":{"d":"Véhicule de remise en condition du personnel","x":""},"BMU":{"d":"Bureau médical d'urgence","x":"Bureau BSPP en charge de la médecine d'urgence (dont la cellule ACR et eFiBi)."},"NOVI":{"d":"Nombreuses victimes","x":"Situation où un événement fait plusieurs victimes simultanément."},"OGCO":{"d":"Officier de garde CO","x":"Officier de permanence au centre opérationnel de la BSPP."},"VL":{"d":"Véhicule léger","x":""},"SMG":{"d":"Structure modulaire gonflable","x":"Tente gonflable utilisée notamment pour un centre d'accueil."},"PRA":{"d":"Plan rouge alpha","x":"Modalité du plan rouge liée à l'attentat : extraire et évacuer au plus vite."},"CRRA":{"d":"Centre de réception et de régulation des appels","x":"Centre d'appels du SAMU (15)."},"ACEL":{"d":"Accident catastrophique à effets limités","x":"Événement unique faisant de nombreuses victimes ; peut justifier un plan rouge."},"LSO":{"d":"Lieu de stationnement opérationnel","x":"Lieu où un engin est affecté et stationne habituellement."},"SP":{"d":"Sapeur-pompier","x":""},"EPA":{"d":"Échelle pivotante automatique","x":"Moyen élévateur aérien pour sauvetages et reconnaissances en étages."},"DUST-DAHO":{"d":"Décontamination d'urgence, Symptômes, Traitement, Décontamination approfondie, HOpital","x":"Chaîne de survie des victimes NRBC."},"DA":{"d":"Décontamination approfondie","x":"Maillon de la chaîne NRBC DUST-DAHO."},"C2":{"d":"Second cercle","x":"Personnes à proximité, sans contact avec le produit (C1 : au contact)."},"SVI":{"d":"Sous-vêtement d'intervention","x":"Tenue de base sur laquelle se portent les tenues NRBC."},"RAD":{"d":"Radiologique","x":"Le groupe RAD intervient sur le risque radiologique."},"CHIM":{"d":"Chimique","x":"Le groupe CHIM intervient sur le risque chimique."},"BIO":{"d":"Biologique","x":"Le groupe BIO intervient sur le risque biologique."},"DTSP":{"d":"Direction territoriale de sécurité de proximité","x":"Direction de police d'un département de petite couronne (92, 93, 94)."},"SIC":{"d":"Salle d'information et de commandement","x":"Ici, salle de police de la DSPAP pour Paris."},"LVA":{"d":"Libération des voies aériennes","x":""},"FAST":{"d":"Face, Arm, Speech, Time","x":"Test de repérage de l'AVC : visage, bras, parole, heure de début."},"VM":{"d":"Ventilateur maître","x":""},"EPSA":{"d":"Échelle pivotante semi-automatique","x":"Moyen élévateur aérien (MEA)."},"PSE1":{"d":"Premiers secours en équipe de niveau 1","x":"Premier niveau de diplôme de secouriste en équipe."},"VAC":{"d":"Véhicule d'appui aux communications","x":""},"VSTI":{"d":"Véhicule STI","x":"Véhicule du groupe soutien télécommunications (GST)."},"EPAN":{"d":"Échelle pivotante automatique à nacelle","x":"Moyen élévateur aérien permettant le brancardage."},"BEA":{"d":"Bras élévateur aérien","x":"Moyen élévateur aérien, aussi utilisé pour le brancardage."},"G1":{"d":"1er groupement d'incendie et de secours (GIS)","x":"État-major à Montmartre (CSO MTMA)."},"SDIS":{"d":"Service départemental d'incendie et de secours","x":""},"IML":{"d":"Institut médico-légal","x":""},"RSS":{"d":"Rapport de sortie de secours","x":""},"AA":{"d":"Air ambiant","x":"SpO2 AA : saturation mesurée sans oxygène."},"USINV":{"d":"Unité de soins intensifs neuro-vasculaires","x":""},"PAD":{"d":"Pression artérielle diastolique","x":""},"BAVU":{"d":"Ballon autoremplisseur à valve unidirectionnelle","x":"Insufflateur manuel pour ventiler une victime."},"CTA":{"d":"Centre de traitement de l'alerte","x":"Centre d'appels des sapeurs-pompiers (18/112)."},"CCE":{"d":"Coup de chaleur d'exercice","x":"Hyperthermie grave après effort (T > 40 °C, troubles neurologiques)."},"SMUR":{"d":"Service mobile d'urgence et de réanimation","x":"Équipe médicale mobile hospitalière."},"BOPO":{"d":"Bureau opérations - préparation opérationnelle","x":""},"OSG":{"d":"Officier supérieur de garde groupement","x":""},"CEMO":{"d":"Chef d'état-major opérationnel","x":"Fonction tenue par le colonel de garde."},"SIM":{"d":"Subscriber Identity Module","x":"Carte qui identifie l'abonné sur le réseau mobile."},"EDP":{"d":"Engin de déplacement personnel","x":"Trottinette, gyroroue… (motorisé ou non)."},"MRZ":{"d":"Machine Readable Zone","x":"Bande lisible par machine de la pièce d'identité, scannable dans eFiBi."},"IOA":{"d":"Infirmier organisateur de l'accueil","x":"Infirmier des urgences à qui l'on transmet la victime (aussi IAO)."},"GAS":{"d":"Groupement d'appui et de secours","x":"Groupement BSPP regroupant les moyens d'appui et spécialisés."},"PFAU":{"d":"Plateforme des appels d'urgence 17-18-112","x":"Centre de réception et distribution des appels d'urgence de l'agglomération."},"DSM":{"d":"Directeur des secours médicaux","x":""},"CTAR":{"d":"CTA Roissy","x":"Centre de traitement de l'alerte de l'aéroport de Roissy."},"MIB":{"d":"Mission Brigade","x":"Intervention relevant des missions de la BSPP (avec ordre de départ)."},"INU":{"d":"Intervention non urgente","x":""},"PRI":{"d":"Point de regroupement des impliqués","x":""},"ACEM":{"d":"Accident catastrophique à effets majeurs","x":""},"CNR":{"d":"Centre national de relais","x":"Centre relais des appels d'urgence (114) pour personnes sourdes ou malentendantes."},"CHU":{"d":"Centre hospitalier universitaire","x":""},"PS":{"d":"Premier-secours","x":"Engin-pompe de la BSPP."},"PL":{"d":"Poids lourd","x":""},"PST":{"d":"Premier-secours tonne","x":""},"CO2":{"d":"Dioxyde de carbone","x":""},"MCB2":{"d":"Multi-contaminamètre bêta version 2","x":"Appareil de détection de la radioactivité."},"DU":{"d":"Décontamination d'urgence","x":"Premier maillon de la chaîne DUST-DAHO."},"HO":{"d":"Transfert à l'hôpital","x":"Dernier maillon de la chaîne NRBC DUST-DAHO."},"RH":{"d":"Ressources humaines","x":""},"ZEX":{"d":"Zone d'exclusion","x":"Zone rouge, la plus proche du danger."},"ZC":{"d":"Zone contrôlée","x":"Zone orange, entre exclusion et soutien."},"ZS":{"d":"Zone de soutien","x":"Zone verte, où sont notamment le PMA et les moyens."},"ZP":{"d":"Zone publique","x":"Zone ouverte au public, hors périmètre de sécurité."},"MGO":{"d":"Marche générale des opérations","x":"Enchaînement des phases d'une intervention."},"BUMD":{"d":"Berce unité mobile de décontamination","x":"Douches de décontamination NRBC."},"LCPP":{"d":"Laboratoire central de la préfecture de police","x":""},"PQRST":{"d":"Provoqué – Qualité – Région – Sévérité – Temps","x":"Méthode d'analyse de la plainte de la victime."},"EVDA":{"d":"Éveillé – Voix – Douleur – Aréactif","x":"Échelle rapide du niveau de conscience."},"OVA":{"d":"Obstruction des voies aériennes","x":""},"SNV":{"d":"Situation à nombreuses victimes","x":""},"AIT":{"d":"Accident ischémique transitoire","x":"Signes d'AVC qui régressent ; conduite à tenir identique à l'AVC."},"VAR":{"d":"Ventilateur auxiliaire relais","x":""},"VO":{"d":"Ventilateur opérationnel","x":"Engin de ventilation inclus dans le départ normal."},"CSO-PVO":{"d":"Liaison CSO – PVO","x":"Liaison entre le centre de suivi opérationnel et le poste de veille opérationnelle des centres de secours."},"HS":{"d":"Hors service","x":""},"BOPE":{"d":"Imprimé opérationnel de la BSPP","x":"Référence des imprimés BSPP, numérotés (ex. BOPE 13 : papillon jaune, BOPE 24 : ambassade)."},"RETENIS":{"d":"Réseau téléphonique interne de la BSPP","x":"Autocommutateur administratif de la Brigade (téléphone interne)."},"CIR":{"d":"Chef d'intervention en réseau de secours","x":"Le chef d'intervention Croix-Rouge engagé dans le réseau de secours BSPP."},"FMA":{"d":"Formation de maintien des acquis","x":"Formation annuelle des chefs d'agrès BSPP (ex. FMA 2025-2026 : traumatologie, ACR, chutes, eFiBi)."},"MACA":{"d":"Maintien des acquis des chefs d'agrès","x":"Nom de la formation annuelle des chefs d'agrès VSAV (supports MACA 2025-2026)."},"BOI":{"d":"Bureau opérations instruction","x":"Bureau d'un groupement (GIS) qui suit l'activité opérationnelle et rend compte au CO."},"BPIB":{"d":"Bureau pharmacie et ingénierie biomédicale","x":"Bureau de la division santé de la BSPP (matériel biomédical, défibrillateurs, pharmacie)."},"CT1SP":{"d":"Certificat technique du 1er degré, filière sapeur-pompier","x":"Qualification permettant notamment à un caporal-chef d'être chef d'agrès."},"EPM":{"d":"Engin-pompe modulaire","x":"Engin-pompe pouvant être « déclassé » en VSAV pour le secours à victime."},"CS1":{"d":"Centre de secours de 1er appel","x":"Centre voisin du CSTC, désigné par ADAGIO, sollicité en premier si le CSTC n'a plus de moyen."},"CS2":{"d":"Centre de secours de 2e appel","x":"Centre voisin sollicité après le CS1, désigné par ADAGIO."},"ADAGIO-GDO":{"d":"ADAGIO – Gestion des opérations","x":"Module d'ADAGIO qui gère les interventions et la situation des engins."},"GDO":{"d":"Gestion des opérations","x":"Module d'ADAGIO (ADAGIO-GDO)."},"IMP":{"d":"Imprimé","x":"Ex. IMP/BOPE 23. Dans les règlements BSPP, IMP désigne aussi l'intervention en milieu périlleux."},"PEGASE":{"d":"Fiche police PEGASE","x":"Logiciel de la police nationale dans lequel sont rédigées les fiches d'intervention."},"DT7":{"d":"Defigard Touch 7 (Schiller)","x":"Moniteur multiparamétrique avec DSA intégré, aussi appelé DGT7."},"GP360":{"d":"Radio portative Motorola GP360","x":"Ancienne radio portative, remplacée par le TPH 700."},"T0":{"d":"Temps zéro","x":"Instant de départ d'une procédure (ex. T0 : le COS demande la police)."},"VX":{"d":"Agent VX","x":"Neurotoxique de guerre de la famille des agents V (détecté en noir par le papier PDF1)."},"MTMA":{"d":"Montmartre","x":"Code du centre de secours de Montmartre, siège du CSO du 1er groupement."},"MASS":{"d":"Masséna","x":"Code du centre de secours de Masséna, siège du CSO du 2e groupement."},"STA":{"d":"Salle de traitement des appels","x":"Salle du CO (NIV 2) qui traite les appels transférés par la SRA et décide de l'engagement des moyens."},"SRA":{"d":"Salle de réception des appels","x":"Salle de la PFAU (NIV 1) qui décroche les appels 18/112/17, détermine en moins de 30 s le degré d'urgence et oriente."},"PCA":{"d":"Plan de continuité de l'activité","x":"Organisation de repli (modes dégradés) qui maintient la réception des appels et l'engagement des secours en cas de panne de la PFAU ou du SIOC."},"AP4C":{"d":"Appareil portatif de contrôle de contamination","x":"Détecteur chimique NRBC des équipes spécialisées, utilisable en atmosphère explosive."},"TAC":{"d":"Tactique","x":"Qualifie le niveau de commandement sur le terrain : le PC TAC (poste de commandement tactique) coordonne les secteurs sur une intervention importante."},"CRO":{"d":"Camionnette de réserve oxygène","x":"Engin santé BSPP qui achemine immédiatement une réserve d'oxygène sur une intervention à nombreuses victimes."},"EVT":{"d":"Événement","x":"Degré de priorité d'appel (entre TU et U) : plusieurs appels pour un même événement déjà connu, transférés selon une procédure dédiée."},"NIV":{"d":"Niveau","x":"Désigne les niveaux de traitement de la PFAU : NIV 1 = SRA (réception), NIV 2 = STA (traitement)."},"SIS":{"d":"Spécialistes intervention subaquatique","x":"Plongeurs sapeurs-pompiers engagés pour les recherches et sauvetages sous l'eau."},"VRB":{"d":"Véhicule renfort brancards","x":"Engin santé qui projette brancards catastrophe, KDUR, lots EVATOX et SINUS pour les nombreuses victimes."},"V2S":{"d":"Véhicule de soutien sanitaire","x":"Engin santé BSPP de soutien sanitaire (remplace l'ancien VES), qui ne transporte une victime qu'en situation exceptionnelle."},"ESAV":{"d":"Embarcation de secours et d'assistance aux victimes","x":"Embarcation de la BSPP pour le secours sur la Seine et les canaux."},"RSMG":{"d":"Remorque structure modulaire gonflable","x":"Remorque portant une tente gonflable servant d'abri (PMA, accueil d'impliqués) sur intervention."},"VPS":{"d":"Véhicule de protection et de signalisation","x":"Engin qui protège les secours sur voies rapides et autoroutes, sans remplacer le balisage des CRS ou de la DIRIF."},"SDE":{"d":"Sauvetage déblaiement","x":"Spécialité de sauvetage dans les effondrements ; SDE 1, 2 et 3 sont les niveaux de qualification (le SDE 2 conseille le COS)."},"TU":{"d":"Très urgent","x":"Plus haut degré de priorité attribué à un appel par la SRA avant transfert à la STA."},"SOGCO":{"d":"Sous-officier de garde CO","x":"Sous-officier de garde au centre opérationnel, qui encadre la salle avec le chef de salle."},"ENEDIS":{"d":"Enedis (ex-ERDF)","x":"Gestionnaire du réseau de distribution d'électricité, demandé par le CSO pour couper ou sécuriser une installation."},"COORD":{"d":"Coordination","x":"Abréviation de coordination : canal radio COORD, bannette « COORD MED » de la coordination médicale."},"VLI":{"d":"Véhicule léger infirmier","x":"Véhicule de la BSPP armé par un infirmier sapeur-pompier pour renforcer la prise en charge médicale."},"OPC":{"d":"Officier poste de commandement","x":"Officier qui arme le VLR OPC et dirige le fonctionnement du PC de colonne aux côtés du COS."},"VPC":{"d":"Véhicule poste de commandement","x":"Engin qui sert de PC tactique de niveau 2, indissociable du VLR OPC."},"H2S":{"d":"Sulfure d'hydrogène","x":"Gaz toxique à odeur d'œuf pourri qui paralyse l'odorat à forte concentration : l'odeur n'est pas un indicateur fiable."},"SGAP":{"d":"Secrétariat général pour l'administration de la police","x":"Nom des canaux radio ANTARES (SGAP OPS, SGAP COORD) utilisés en garde BSPP."},"OPS":{"d":"Opérations","x":"Abréviation d'opérations ; SGAP OPS est le canal radio opérationnel du groupement."},"LED":{"d":"Light-emitting diode (diode électroluminescente)","x":"Voyant lumineux d'un appareil (ex. LED verte d'allumage du TPH)."},"CUMP":{"d":"Cellule d'urgence médico-psychologique","x":"Équipe de psychiatres et psychologues déclenchée par le SAMU pour la prise en charge psychologique des impliqués."},"ETARE":{"d":"Établissement répertorié","x":"Site à risque disposant d'un plan d'intervention préétabli ; un feu dans un ETARE déclenche une réponse renforcée."},"CTI":{"d":"Compagnie des transmissions et de l'informatique","x":"Unité BSPP chargée des télécommunications et de l'informatique : elle peut ordonner le dispositif de secours téléphonique d'un CS et traite les pannes (ADAGIO, téléphonie 18/112)."},"RSMU":{"d":"Recherche et sauvetage en milieu urbain","x":"Spécialité de recherche de victimes dans les effondrements de structures."},"PCC":{"d":"Poste de commandement de coordination","x":"PC mobile de la Ville de Paris, relais local du CVO, qui se déplace sur les lieux d'un événement."},"CPRP":{"d":"Chargé de prévention des risques professionnels","x":"Interlocuteur BSPP pour la prévention des risques professionnels, y compris harcèlement et discriminations."},"CMO":{"d":"Centre de mise en œuvre","x":"Structure d'aide au commandement (PC appui) qui gère une fonction spécialisée, par ex. CMO SAN pour la santé."},"SAN":{"d":"Santé","x":"Abréviation de santé (CMO SAN, plan de rappel SAN)."},"TIB":{"d":"Nom du constructeur du VSAV « TIB »","x":"Ce n'est pas un sigle : le VSAV « TIB » est un VSAV à cellule transférable qui prend en charge au moins 2 victimes successives sans se réarmer."},"AED":{"d":"Automated external defibrillator (AED MAP : application « bon samaritain »)","x":"AED MAP permet à l'opérateur de trouver un secouriste bénévole et un DAE public à proximité d'un ACR."},"MAP":{"d":"Map (carte) – AED MAP","x":"Partie du nom de l'application AED MAP de géolocalisation des DAE et des secouristes « bon samaritain »."},"PIN":{"d":"Personal identification number (code PIN)","x":"Code personnel de déverrouillage de la carte SIM de la tablette ou du terminal."},"GDR":{"d":"Gestion des rapports","x":"Application BSPP où sont rédigés les rapports d'intervention."},"CCR":{"d":"Camion citerne rural","x":"Engin feux de forêts/espaces naturels (BSPP) ; à ne pas confondre avec le coffret à coupure rapide (électricité)."},"CCAI":{"d":"Chef du centre d'accueil des impliqués","x":"Responsable désigné du lieu où sont regroupés et recensés les impliqués non blessés."},"EVATOX":{"d":"EVATOX (cagoule d'évacuation)","x":"Cagoules filtrantes d'évacuation (adulte, enfant, bébé) embarquées par le VAS et le VRB pour les victimes en ambiance toxique."},"DIRIF":{"d":"Direction des routes d'Île-de-France","x":"Gestionnaire des voies rapides et autoroutes non concédées d'Île-de-France, qui pose le balisage réglementaire."},"ELD":{"d":"Exploration longue durée","x":"Spécialité d'exploration sous ARI de longue durée (souterrains, grands volumes)."},"VPCM":{"d":"Véhicule poste de commandement médical","x":"PC de la chaîne médicale BSPP sur intervention à nombreuses victimes, accompagné du VAS."},"ATEX":{"d":"Atmosphères explosives","x":"Certification d'un appareil utilisable sans risque d'inflammation en atmosphère explosive."},"GSM":{"d":"Global System for Mobile communications","x":"Réseau de téléphonie mobile, moyen de secours en cas de défaillance des lignes."},"EPS":{"d":"Éducation physique et sportive","x":"Cours de sport à l'école ; contexte fréquent de traumatisme chez un élève mineur."},"CRAC":{"d":"Camionnette de réserve d'air comprimé","x":"Engin qui réalimente les bouteilles d'ARI sur les interventions longues."},"ITT":{"d":"Indisponible en transit","x":"État d'un engin qui rejoint un lieu sans pouvoir être engagé ; en médecine légale, ITT = incapacité totale de travail."},"CIE":{"d":"Compagnie","x":"Échelon BSPP regroupant plusieurs centres de secours (PC de compagnie, PVO CIE)."},"PCO":{"d":"Plan de couverture opérationnelle","x":"Règle de positionnement/réservation d'engins rares (BEA, VPMA…) pour garantir la couverture du secteur."},"GRDF":{"d":"Gaz réseau distribution France","x":"Gestionnaire du réseau de distribution de gaz, demandé pour les fuites et coupures de gaz."},"SITREP":{"d":"Situation report","x":"Point de situation à un moment donné transmis à l'échelon supérieur."},"ASSESSREP":{"d":"Assessment report","x":"Appréciation de situation conduisant à des décisions de conduite ou à des demandes de moyens."},"CDS":{"d":"Chef de salle (salles du CO) ; ailleurs chef de section","x":"Dans les salles opérationnelles, responsable d'une salle (CDS NIV 1, NIV 2, police)."},"GCD":{"d":"Groupe chaîne de décontamination","x":"Groupe NRBC qui met en œuvre la décontamination des victimes et impliqués."},"SIA":{"d":"Spécialistes interventions aquatiques","x":"Sauveteurs aquatiques de surface, engagés notamment en secteur CAS M à la place des SIS."},"CT":{"d":"Conseiller technique","x":"Spécialiste référent d'une spécialité (CT IMP, CT SIS) qui conseille le COS."},"CVO":{"d":"Centre de veille opérationnelle","x":"Centre de veille de la Ville de Paris, qui s'appuie sur le PCC mobile."},"DPP":{"d":"Direction de la prévention et de la protection","x":"Direction de la Ville de Paris dont un agent est responsable du PCC mobile."},"LVV":{"d":"Limeil-Brévannes – Valenton – Villeneuve-Saint-Georges","x":"Grand pôle de formation de la BSPP dans le Val-de-Marne, à cheval sur ces trois communes ; il abrite aussi une base logistique (stock de renforcement en oxygène)."},"DEF":{"d":"Défaut","x":"Affichage « DEF CAPT » du MCB2 : défaut capteur."},"CAPT":{"d":"Capteur","x":"Affichage « DEF CAPT » du MCB2 : défaut capteur."},"BSN":{"d":"Berce de soutien NRBC","x":"Caisson (berce) de matériel NRBC déployé sur plan jaune ou sur demande."},"VRM":{"d":"Véhicule rapide médicalisé","x":"Ambulance de réanimation banalisée optimisée pour la prise en charge de personnalités."},"SR":{"d":"Secours routier","x":"Interventions sur accidents de la circulation (MGO SR : marche générale des opérations de secours routier)."},"SMS":{"d":"Short Message Service","x":"Message texte envoyé par téléphone mobile."},"SITAC":{"d":"Situation tactique","x":"Représentation cartographique de l'intervention (zonage, moyens, secteurs) tenue au PC."},"SAP":{"d":"Secours à personne","x":"Mission de secours aux victimes (malaises, blessés…), majoritaire dans l'activité BSPP."},"EMF":{"d":"Embarcation multifonctions","x":"Embarcation BSPP tractée par le véhicule SPTT, polyvalente pour le secours nautique."},"VEC":{"d":"Véhicule équipe cynotechnique","x":"Engin de l'équipe cynotechnique (chiens de recherche)."},"GHV":{"d":"Gilet haute visibilité","x":"Gilet réfléchissant porté par l'ensemble du personnel pour être vu sur la voie publique."},"LSP":{"d":"Laissé sur place","x":"Décision de ne pas transporter la victime, validée par le médecin coordinateur, avec décharge le cas échéant."},"PEGASS":{"d":"Outil de planning de la Croix-Rouge française","x":"C'est là que le CI et son équipage s'inscrivent et retrouvent leurs gardes et missions."},"DLUS":{"d":"Directeur (ou direction) local de l'urgence et du secourisme","x":"Responsable des activités d'urgence et de secourisme de l'unité locale Croix-Rouge, destinataire des retours du CI sur ses équipiers."},"SPDT":{"d":"Soins psychiatriques à la demande d'un tiers","x":"Hospitalisation sous contrainte demandée par un tiers, nécessitant des documents (demande, certificats) avant le transport."},"SGAPCOORD":{"d":"Canal SGAP COORD (coordination médicale)","x":"Canal radio de la coordination médicale BSPP, utilisé par exemple pour signaler un ACR découvert."},"MURG":{"d":"Moins urgent","x":"Degré de priorité le plus bas attribué à un appel par la SRA (aussi noté MU)."},"RTE":{"d":"Réseau de transport d'électricité","x":"Gestionnaire du réseau de lignes électriques à haute et très haute tension."},"FA":{"d":"Fourgon d'appui","x":"Engin incendie BSPP d'appui (matériel, éclairage, ventilation)."},"MU":{"d":"Moins urgent","x":"Degré de priorité le plus bas d'un appel (synonyme de MURG)."},"SAI":{"d":"Solution d'alerte incomplète","x":"Proposition d'engagement d'ADAGIO à laquelle il manque des moyens faute de disponibilité."},"EMO":{"d":"État-major opérationnel","x":"Niveau de commandement BSPP au CO ; en mode dégradé, l'EMO MD conserve les opérations importantes."},"DEVO":{"d":"Dévolution (CTA de dévolution)","x":"CTA de repli qui reprend le traitement des appels quand le CTA principal est indisponible."},"GT":{"d":"Groupe de traitement (opérateurs)","x":"Groupe d'opérateurs dédié à un type d'appels ou à un événement (GT EVT, GT MURG)."},"POL":{"d":"Police","x":"Abréviation de police (ex. CDS NIV 1 POL : chef de salle police de la PFAU)."},"SAR":{"d":"Solution d'alerte retenue","x":"Proposition d'engins retenue par ADAGIO pour un départ ; un engin en « présentation spontanée » n'y est pas sélectionné."},"DGSNV":{"d":"Disposition générale secours à nombreuses victimes","x":"Volet du dispositif ORSEC qui organise la prise en charge de nombreuses victimes."},"CMOA":{"d":"Centre de mise en œuvre « appui »","x":"PC appui (VCMOA + VLR OCA) qui gère les fonctions spécialisées (NRBC, nautique, IMP, RSMU…)."},"CGI":{"d":"Chef de garde incendie","x":"Officier de garde d'un centre de secours engagé sur les feux (VLR CGI)."},"FMOGP":{"d":"Fourgon mousse grande puissance","x":"Engin de production de mousse en grande quantité pour les feux d'hydrocarbures et infrastructures spécifiques."},"COGIC":{"d":"Centre opérationnel de gestion interministérielle des crises","x":"Centre national de la Sécurité civile qui peut ordonner certains engagements (ex. BSN)."},"TYCHEM":{"d":"Tychem® (marque)","x":"Combinaison de protection chimique étanche portée avec le masque (tenue NRBC)."},"GIR":{"d":"Groupe d'intervention radiologique","x":"Groupe spécialisé NRBC pour la détection et la mesure de la radioactivité."},"ZRCP":{"d":"Zone de remise en condition du personnel","x":"Zone à l'abri où le personnel relevé se repose, s'hydrate et se restaure."},"BLEVE":{"d":"Boiling Liquid Expanding Vapor Explosion","x":"Explosion d'un réservoir de gaz liquéfié chauffé (ex. GPL) avec boule de feu, onde de choc et projections."},"GPL":{"d":"Gaz de pétrole liquéfié","x":"Mélange butane/propane stocké liquide sous pression (bouteilles, réservoirs, carburant GPL-c)."},"DIMPET":{"d":"Détecter, identifier, mesurer, prélever, évaluer, transmettre","x":"Les 6 actions NRBC de la BSPP face à une matière dangereuse."},"S4PE":{"d":"Système portatif de prélèvement des produits persistants par évaporation","x":"Accessoire de l'AP4C qui chauffe un produit pour en analyser la vapeur."},"SOA":{"d":"Sous-officier administratif","x":"Sous-officier chargé de l'administration du personnel de l'unité (CS ou compagnie)."},"BRI-PP":{"d":"Brigade de recherche et d'intervention de la Préfecture de police","x":"Unité de police d'intervention de Paris, qui fournit des négociateurs spécialisés."},"RAID":{"d":"Recherche, assistance, intervention, dissuasion","x":"Unité d'élite de la Police nationale, compétente hors Paris intra-muros pour la négociation et l'intervention."},"DASRI":{"d":"Déchets d'activités de soins à risques infectieux","x":"Déchets souillés (aiguilles, compresses…) éliminés dans des collecteurs dédiés."},"UU":{"d":"Usage unique","x":"Matériel à jeter après emploi (drap UU, gants UU)."},"EHPAD":{"d":"Établissement d'hébergement pour personnes âgées dépendantes","x":"Maison de retraite médicalisée accueillant des personnes âgées dépendantes."},"SRAS":{"d":"Syndrome respiratoire aigu sévère","x":"Maladie respiratoire virale contagieuse nécessitant une tenue de protection biologique renforcée."},"CODIS":{"d":"Centre opérationnel départemental d'incendie et de secours","x":"Centre de coordination opérationnelle d'un SDIS (département hors secteur BSPP)."}};
const LEX_NOAUTO=new Set([]); // tous les sigles sont soulignés
const LEX_RE=(()=>{const keys=Object.keys(LEX).filter(k=>!LEX_NOAUTO.has(k)).sort((a,b)=>b.length-a.length).map(k=>k.replace(/[.*+?^${}()|[\]\\-]/g,"\\$&"));
 return new RegExp("(^|[^A-Za-zÀ-ÿ0-9\\-])("+keys.join("|")+")(?=[^A-Za-zÀ-ÿ0-9\\-]|$)","g")})();
const ACR_SEL=".qtext,.opt,.fb,.face,.situ,.cq,.oitem,.recap .card,.crinote,.rnotes,.phon p,.reveal,.flip-back,.e,.a";
function acrify(root){root.querySelectorAll(ACR_SEL).forEach(el=>{if(el.dataset.acr)return;el.dataset.acr="1";
 const w=document.createTreeWalker(el,NodeFilter.SHOW_TEXT,{acceptNode:n=>n.parentElement.closest(".acr,.k,script,style,input,textarea,svg")?NodeFilter.FILTER_REJECT:NodeFilter.FILTER_ACCEPT});
 const nodes=[];while(w.nextNode())nodes.push(w.currentNode);
 nodes.forEach(n=>{const t=n.nodeValue;LEX_RE.lastIndex=0;if(!LEX_RE.test(t))return;LEX_RE.lastIndex=0;const f=document.createDocumentFragment();let last=0,m;
  while((m=LEX_RE.exec(t))){const st=m.index+m[1].length;if(st>last)f.appendChild(document.createTextNode(t.slice(last,st)));const sp=document.createElement("span");sp.className="acr";sp.dataset.lex=m[2];sp.setAttribute("role","button");sp.tabIndex=0;sp.textContent=m[2];f.appendChild(sp);last=st+m[2].length}
  if(last<t.length)f.appendChild(document.createTextNode(t.slice(last)));n.parentNode.replaceChild(f,n)})})}
let acrRaf=0;new MutationObserver(()=>{if(acrRaf)return;acrRaf=requestAnimationFrame(()=>{acrRaf=0;acrify(app)})}).observe(app,{childList:true,subtree:true});
function closeAcr(){const p=document.getElementById("acrpop");if(p)p.remove()}
function showAcr(el){closeAcr();const k=el.dataset.lex,L=LEX[k];if(!L)return;const p=document.createElement("div");p.id="acrpop";p.className="acrpop";p.setAttribute("role","dialog");
 p.innerHTML=`<b>${esc(k)}</b><div class="ad">${esc(L.d)}</div>${L.x?`<div class="ax">${esc(L.x)}</div>`:""}<button class="alex" type="button">Ouvrir le lexique</button>`;document.body.appendChild(p);
 const r=el.getBoundingClientRect(),pw=Math.min(320,window.innerWidth-24);p.style.width=pw+"px";let x=Math.max(12,Math.min(window.innerWidth-pw-12,r.left+r.width/2-pw/2));p.style.left=x+"px";
 const h=p.offsetHeight;let y=r.bottom+8;if(y+h>window.innerHeight-12)y=Math.max(12,r.top-h-8);p.style.top=y+"px";
 p.querySelector(".alex").onclick=e=>{e.stopPropagation();closeAcr();lexQ=k;openLexique()}}
document.addEventListener("click",e=>{const a=e.target.closest&&e.target.closest(".acr");if(a){e.preventDefault();e.stopPropagation();showAcr(a);return}if(!(e.target.closest&&e.target.closest("#acrpop")))closeAcr()},true);
document.addEventListener("keydown",e=>{if(e.key==="Escape")closeAcr();if(e.key==="Enter"&&e.target.classList&&e.target.classList.contains("acr")){e.preventDefault();showAcr(e.target)}},true);
window.addEventListener("scroll",closeAcr,{passive:true});
let lexQ="";
function lexList(){const q=norm(lexQ.trim());return Object.entries(LEX).filter(([k,v])=>!q||norm(k).includes(q)||norm(v.d).includes(q)||norm(v.x).includes(q)).sort((a,b)=>{const ea=norm(a[0])===q?0:1,eb=norm(b[0])===q?0:1;return ea-eb||a[0].localeCompare(b[0],"fr")})}
function lexHtml(){const L=lexList();let cur="";return L.length?L.map(([k,v])=>{const l=k[0];const h=l!==cur?`<div class="sect lexl">${cur=l}</div>`:"";return h+`<div class="lexrow"><b>${esc(k)}</b><div><div class="ad">${esc(v.d)}</div>${v.x?`<div class="ax">${esc(v.x)}</div>`:""}</div></div>`}).join(""):`<p class="sub">Aucun sigle trouvé.</p>`}
function viewLexique(asTab){const body=`<p class="sub" style="margin-top:8px">${Object.keys(LEX).length} sigles et acronymes du parcours. Dans les questions, touche un sigle souligné en pointillé pour voir sa signification.</p>
  <input class="search" id="lq" type="search" placeholder="Rechercher un sigle ou un mot (ex. PVO, défibrillateur)" value="${esc(lexQ)}"><div id="lexl" style="margin-top:6px">${lexHtml()}</div>`;
 app.innerHTML=(asTab?`${backLink()}<h1 class="big">Lexique</h1>`:push("Lexique"))+body;if(asTab)bindTabBack();else bindBack();
 let to;$("#lq").oninput=e=>{lexQ=e.target.value;clearTimeout(to);to=setTimeout(()=>{$("#lexl").innerHTML=lexHtml()},120)}}
// depuis une question : le lexique s'ouvre par-dessus, sans quitter la question
function openLexique(){const sh=sheet(`<h2>Lexique</h2><input class="search" id="lq2" type="search" placeholder="Rechercher un sigle" value="${esc(lexQ)}"><div id="lexl2" class="lexsheet">${lexHtml()}</div>`);
 let to;$("#lq2").oninput=e=>{lexQ=e.target.value;clearTimeout(to);to=setTimeout(()=>{$("#lexl2").innerHTML=lexHtml()},120)}}

/* ============ Journaux (administration) ============ */
let logDay=new Date().toISOString().slice(0,10),logUser="",logKind="all",logData=null;
const LOGK={all:"Tout",erreur:"Erreurs",api:"API",jeu:"Parties",rep:"Réponses",nav:"Navigation",ecran:"Écrans",clic:"Clics",sync:"Synchro",app:"Appli",demarrage:"Démarrages",fire:"Ambiance",gag:"Gags",hopital:"Hôpitaux",maj:"Mises à jour"};
function lgDetail(d){try{const o=JSON.parse(d);if(o&&typeof o==="object")return Object.entries(o).filter(([k,v])=>v!==""&&v!=null).map(([k,v])=>`<b>${esc(k)}</b> ${esc(typeof v==="object"?JSON.stringify(v):v)}`).join(" · ")}catch(e){}return esc(d)}
function uaShort(u){u=u||"";const ios=u.match(/(iPhone|iPad)[^)]*OS (\d+)_(\d+)/);if(ios)return `${ios[1]} iOS ${ios[2]}.${ios[3]}`;const and=u.match(/Android (\d+(?:\.\d+)?)/);if(and)return "Android "+and[1];if(/Windows/.test(u))return "Windows";if(/Mac OS X/.test(u))return "Mac";if(/Linux/.test(u))return "Linux";return u.slice(0,40)}
async function viewLogs(){app.innerHTML=push("Journaux d'activité")+`<div class="form" style="margin-top:12px"><label for="lgDay">Jour</label><input id="lgDay" type="date" value="${logDay}" max="${new Date().toISOString().slice(0,10)}">
  <label for="lgUser">Membre</label><select id="lgUser" class="lgsel"><option value="">Tous les membres</option>${(adminData&&adminData.members||[]).sort((a,b)=>a.pseudo.localeCompare(b.pseudo)).map(m=>`<option value="${esc(m.id)}" ${m.id===logUser?"selected":""}>${esc(m.pseudo)}${m.email?" · "+esc(m.email):""}</option>`).join("")}</select></div>
  <div class="chips" style="margin-top:10px">${Object.entries(LOGK).map(([k,l])=>`<button class="chip" data-lk="${k}" aria-pressed="${k===logKind}">${l}</button>`).join("")}</div>
  <input class="search" id="lgQ" type="search" placeholder="Filtrer : texte, question, erreur, écran…" style="margin-top:10px"><div class="actions" style="margin:10px 0"><button class="btn sec" id="lgReload">Actualiser</button><button class="btn sec" id="lgExport">Exporter (JSON)</button></div><div id="lgList"><div class="loading">Chargement…</div></div>
  <p class="small" style="margin:12px 4px 0">Lecture d'une ligne : l'heure, le membre, le type d'évènement et ce qui s'est passé. En bleu, où il se trouvait (onglet, écran, niveau, mode). En gris, les détails : pour une erreur, l'explication en clair et l'endroit du code. Les numéros de session distinguent deux appareils ou deux onglets ouverts en même temps. Heures au fuseau du téléphone. Les journaux sont conservés 30 jours (20 000 évènements par jour au maximum).</p>`;
 bindBack(()=>viewAdmin());
 const load=async()=>{$("#lgList").innerHTML=`<div class="loading">Chargement…</div>`;try{logData=await api("admin/logs?day="+logDay+"&n=5000")}catch(e){$("#lgList").innerHTML=`<p class="small">${esc(e.error||"Erreur.")}</p>`;return}draw()};
 const draw=()=>{const lq=norm(($("#lgQ")&&$("#lgQ").value)||"");const L=(logData&&logData.logs||[]).filter(x=>(!logUser||x.u===logUser)&&(logKind==="all"||x.k===logKind)&&(!lq||norm([x.v,x.d,x.c,x.p].join(" ")).includes(lq))).sort((a,b)=>b.t-a.t);
  const sessions=new Set(L.map(x=>x.u+x.s)).size;
  $("#lgList").innerHTML=`<p class="small" style="margin:0 4px 8px">${L.length} évènement(s) · ${new Set(L.map(x=>x.u)).size} membre(s) · ${sessions} session(s)${L.length>600?" · 600 plus récents affichés":""}</p>`+(L.length?`<div class="list lglist">${L.slice(0,600).map(x=>`<div class="lgrow k-${esc(x.k)}"><span class="lgt">${new Date(x.t).toLocaleTimeString("fr-FR")}</span><span class="lgb"><button class="lgu" data-lu="${esc(x.u)}" title="Voir uniquement ce membre">${esc(x.p)}</button> <span class="pill ${x.k==="erreur"||x.k==="api"?"ko":x.k==="rep"?"ok":"none"}">${esc(LOGK[x.k]||x.k)}</span> ${esc(x.v)}${x.c?`<span class="lgd lgc">${esc(x.c)}</span>`:""}${x.d?`<span class="lgd">${lgDetail(x.d)}</span>`:""}<span class="lgd">${esc(x.ver||"")} · session ${esc(x.s||"")} · ${esc(uaShort(x.ua))}</span></span></div>`).join("")}</div>`:`<p class="sub">Aucun évènement.</p>`)};
 $("#lgList").addEventListener("click",e=>{const b=e.target.closest("[data-lu]");if(!b)return;logUser=logUser===b.dataset.lu?"":b.dataset.lu;$("#lgUser").value=logUser;if($("#lgUser").value!==logUser){const o=document.createElement("option");o.value=logUser;o.textContent=b.textContent;$("#lgUser").appendChild(o);$("#lgUser").value=logUser}draw()});
 $("#lgDay").onchange=e=>{logDay=e.target.value||logDay;load()};let lqT;$("#lgQ").oninput=()=>{clearTimeout(lqT);lqT=setTimeout(draw,200)};$("#lgUser").onchange=e=>{logUser=e.target.value;draw()};
 app.querySelectorAll("[data-lk]").forEach(b=>b.onclick=()=>{logKind=b.dataset.lk;app.querySelectorAll("[data-lk]").forEach(x=>x.setAttribute("aria-pressed",x===b));draw()});
 $("#lgReload").onclick=async()=>{await logFlush();load()};
 $("#lgExport").onclick=()=>{const L=(logData&&logData.logs||[]).filter(x=>!logUser||x.u===logUser);const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([JSON.stringify(L,null,1)],{type:"application/json"}));a.download=`journaux-quiz-ci-${logDay}${logUser?"-"+logUser:""}.json`;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},500)};
 await logFlush();load()}

/* ============ Mode « On Fire » (activé par un administrateur) ============ */
const FLAME_IC='<svg class="flic" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2c1 3.6-1.6 5.3-1.6 8.1 0 1.4.9 2.4 2 2.4 1.8 0 2.4-2 1.9-4 2.6 1.6 4.2 4.4 4.2 7.2A6.5 6.5 0 0 1 12 22a6.5 6.5 0 0 1-6.5-6.3c0-4.6 4.5-6.8 6.5-13.7z" fill="#ff7a00"/><path d="M12 22a3.7 3.7 0 0 1-3.7-3.6c0-2.6 2.3-3.6 3.2-6.1 1.9 1.5 4.2 3.2 4.2 6.1A3.7 3.7 0 0 1 12 22z" fill="#ffd23f"/></svg>';
// encouragements « sergent-chef très remonté » (mode On Fire) : rugueux mais jamais blessants
// Sergent-chef : la méchanceté monte avec les erreurs en série et avec l'excès de confiance
const SGT={
 ko2:["ENCORE ?! Deux d'affilée ! Vous le faites exprès ou c'est un don ?!","Deuxième erreur. Je commence à comprendre pourquoi on ne vous laisse pas le volant.","Et de deux ! Vous collectionnez les erreurs comme d'autres les pin's !","Re-FAUX ! Le référentiel, c'est pas un roman de gare, ça se lit EN ENTIER !","Deux fois ! Même le parcellaire est plus fiable que vous !","Vous repassez par la même erreur comme un VSAV qui tourne autour du pâté de maisons !","Je vous regarde et je vois un plan rouge à vous tout seul.","Deuxième faute ! À ce rythme-là, la victime va se soigner toute seule en vous attendant !","Vous êtes en train de battre un record. Pas le bon.","Encore raté ! Vous voulez que j'appelle la coordination médicale pour votre cerveau ?!"],
 ko3:["TROIS ! TROIS ERREURS ! Je n'ai plus de mots, alors je vais crier : RÉ-FÉ-REN-TIEL !","C'est une hécatombe ! Je demande le plan rouge pour votre culture générale !","Vous ne réfléchissez pas, vous jouez à pile ou face ! Et vous perdez même à pile ou face !","Je vais demander à la BSPP de vous réformer pour inaptitude au QCM !","Même un extincteur vide aurait plus de répondant que vous !","Arrêtez tout. Respirez. Relisez l'explication. Et cette fois, avec les yeux OUVERTS !","Si vous étiez un engin, on vous aurait déjà mis en indisponibilité définitive !","J'ai connu des mannequins de secourisme plus vifs que vous, et eux, au moins, ils ne parlent pas !","Votre série d'erreurs est plus longue que la file d'attente aux urgences un samedi soir !","On ne vous demande pas d'avoir du génie, juste de LIRE ! C'est au-dessus de vos moyens ?!","Bravo, vous venez d'inventer le mode dégradé humain !","Je vais faire graver votre score sur la porte de la remise. Pour l'exemple."],
 kococky:["AH ! Monsieur Je-Sais-Tout se prend les pieds dans le tapis ! Ça fait du bien !","On faisait moins le malin, hein ?! La grosse tête, ça rentre plus dans le casque !","Tiens tiens ! La star de la caserne vient de se ramasser en direct !","Vous étiez trop sûr de vous. Le référentiel, lui, n'a jamais pris la grosse tête.","Ça, c'est le prix de l'arrogance ! Redescendez sur terre, recrue !","Vous vous croyiez chef d'agrès ? Retour équipier, et que ça saute !","Ha ! J'attendais ce moment avec impatience. Savourons-le ensemble.","La série est finie, Einstein ! On range l'ego et on relit !","Trop rapide, trop sûr, trop FAUX ! La précipitation tue, et là elle vient de tuer votre série !","Le champion vient de tomber ! Quelqu'un a un brancard pour son orgueil ?!"],
 okcocky:["Juste. Et alors ? Vous voulez une médaille ? Le ruban est en rupture de stock.","Encore juste. Ne prenez pas la grosse tête, elle ne passera plus la porte de la remise.","Bon. Vous avez révisé. C'est le MINIMUM, pas un exploit !","Juste, mais je vous surveille. Les petits malins finissent toujours par se planter.","Ça va, ça va, on a compris que vous aviez lu. Suivante, et sans fanfaronner !","Correct. Profitez-en, la chute n'en sera que plus belle.","Juste. Mais un vrai CI ne se regarde pas répondre, il avance !","Encore une ? Vous allez finir par vous croire indispensable. Vous ne l'êtes PAS.","Bonne réponse. Votre ego vient de gagner deux tailles, ça m'inquiète.","Juste. Je ne vous félicite pas, je constate."],
 oklate:["ENFIN ! Il était temps, je commençais à rédiger votre avis de décès pédagogique !","Une bonne réponse ! Notez la date, ça ne se reproduira peut-être pas !","Miracle à la caserne ! Quelqu'un prévient l'aumônier !","Bon. Même une horloge arrêtée a l'heure juste deux fois par jour.","Juste ! Vous voyez que ce n'était pas si compliqué, bon sang !","Ah, quand même ! J'allais demander un renfort pour vous.","Enfin un coup au but ! Ne vous emballez pas, on part de très bas.","Bonne réponse. Le hasard fait parfois bien les choses, hein ?"],
 endbad:["Score de sinistré ! Vous allez relire TOUT le référentiel, et je vérifierai !","Pitoyable ! Je n'ai pas vu ça depuis la dernière fois que le distributeur de café a pris feu !","Désastre complet ! Votre fiche bilan à vous, c'est : URGENCE ABSOLUE !","Avec ce score, même le ronfleur refuse de sonner pour vous !"],
 endcocky:["Sans faute ? Bien. Ne vous y habituez pas, la prochaine sera plus dure. Rompez !","Parfait. Et maintenant, descendez de votre piédestal, on a du travail !","Impeccable. Je cherche encore ce que je pourrais vous reprocher. Ça m'agace profondément."]};
const FIRE_OK=["C'EST ÇA ! Enfin un éclair de génie dans ce crâne !","Bonne réponse. Ne prenez pas la grosse tête, ça bloque la porte du VSAV !","Correct ! Votre mère serait fière, moi je réserve mon jugement !","JUSTE ! Continuez comme ça et je ne vous colle pas de corvée de plonge !","Pas mal, recrue ! Pas mal du tout ! Mais je vous ai à l'œil !","BINGO ! Même un caporal-chef n'aurait pas mieux répondu. Presque.","Correct ! Vous voyez qu'il y a quelque chose sous le casque !","Ça, c'est du sérieux ! Rompez… non, continuez !","JE VEUX ENTENDRE ÇA À CHAQUE QUESTION ! Compris ?!","Exact ! J'en ai la larme à l'œil. Non. C'est la fumée.","Réponse validée. Ne souriez pas, vous n'êtes pas en vacances !","EXCELLENT ! Vous avez le droit de respirer. Deux secondes.","Juste ! Le référentiel, vous l'avez mangé au petit-déjeuner ou quoi ?!","Affirmatif ! Voilà un futur CI qui ne me fera pas honte !","Bonne réponse ! Pompes de félicitations : zéro. On n'est pas là pour s'amuser !"];
const FIRE_KO=["NÉGATIF ! Vous avez lu le référentiel ou vous l'avez utilisé comme dessous de verre ?!","FAUX ! Même le distributeur de café de la remise connaît la réponse !","Non mais j'hallucine ! Vous voulez que je vous fasse un dessin au tableau blanc ?!","ERREUR ! Vingt pompes, mentalement, tout de suite !","Faux ! Le PVO en pleure dans sa tasse !","Je rêve ! Retour au paquetage, recrue, et on relit l'explication !","NON ! Là, même le ronfleur aurait mieux répondu !","Mauvaise réponse ! Vous êtes en mode dégradé ou quoi ?!","Raté ! Vous me faites un CRI 001 : fausse alerte entre les deux oreilles !","FAUX ! Je ne veux plus jamais voir ça sur MON quiz, c'est clair ?!","Erreur ! Corvée de lavage d'engin… on en reparle à la fin de la série !","NÉGATIF ! Prenez l'explication, apprenez-la par cœur, et récitez-la au garde remise !","Faux ! Même le chien guide d'aveugle aurait trouvé la bonne porte !","Mais qu'est-ce que c'est que ce travail ?! Lisez, comprenez, recommencez !","Raté ! Je ne suis pas en colère. Je suis DÉÇU. Et en colère.","Vous appelez ça une réponse ? Moi j'appelle ça un départ de feu dans la caserne !","FAUX ! Si on donnait des points pour la confiance en soi, vous seriez premier !","Bravo, vous venez d'inventer une procédure qui n'existe dans AUCUN BSP !","Négatif ! À ce rythme, c'est la victime qui va vous faire le bilan !","Raté ! Même en cochant au hasard, les statistiques étaient de votre côté !","Erreur ! Rangez ce sourire, ce n'est pas le moment, recrue !"];
// ambiance : "off" (normal), "sgt" (Braise : messages musclés, pas de thème), "fire" (On Fire : thème + messages)
let fxMode=(m=>["off","sgt","fire"].includes(m)?m:(store.get("onFire",false)?"fire":"off"))(store.get("fxMode",""));
let onFire=fxMode==="fire";const sgtOn=()=>fxMode!=="off";
const FXLBL={off:"Normal",sgt:"Braise",fire:"On Fire"};
function setFx(m,self){if(!["off","sgt","fire"].includes(m))m="off";if(m===fxMode){applyFire();return}const was=fxMode;fxMode=m;onFire=m==="fire";store.set("fxMode",m);store.set("onFire",onFire);applyFire();
 if(!self&&m!=="off"&&m!==was)setTimeout(()=>toast(m==="fire"?"Un administrateur t'a mis en mode On Fire ! Ça va chauffer.":"Un administrateur t'a mis en mode Braise ! Ça couve…"),600)}
const fxFrom=p=>p&&(p.fx||(p.fire?"fire":"off"));
function setFire(v,self){setFx(v?"fire":"off",self)}
function applyFire(){document.body.classList.toggle("onfire",onFire);let fx=document.getElementById("firefx");
 if(!onFire){if(fx)fx.remove();stopGags();return}startGags();
 if(fx)return;fx=document.createElement("div");fx.id="firefx";fx.setAttribute("aria-hidden","true");
 const fl=[...Array(9)].map((_,i)=>`<span class="fl" style="left:${3+i*11.5}%;--s:${.7+((i*37)%5)/10};--d:${(i*.23)%1.4}s">${FLAME_IC}</span>`).join("");
 const em=[...Array(14)].map((_,i)=>`<i class="em" style="left:${(i*71)%100}%;--d:${(i*.61)%6}s;--t:${5+(i*13)%5}s;--x:${((i*29)%40)-20}px"></i>`).join("");
 fx.innerHTML=`<div class="flames">${fl}</div>${em}<div class="firetag">${FLAME_IC}<span>ON FIRE</span></div>`;document.body.appendChild(fx)}
function fireFx(ok){if(!onFire||matchMedia("(prefers-reduced-motion: reduce)").matches)return;const b=document.querySelector(".opt.good")||document.querySelector(".opt");if(!b)return;const r=b.getBoundingClientRect();
 const box=document.createElement("div");box.className="burst "+(ok?"ok":"ko");box.style.left=(r.left+r.width/2)+"px";box.style.top=(r.top+r.height/2)+"px";
 box.innerHTML=ok?[...Array(7)].map((_,i)=>`<span style="--a:${i*51}deg;--dl:${i*25}ms">${FLAME_IC}</span>`).join(""):`<span class="puff">Pschhht !</span>`;document.body.appendChild(box);setTimeout(()=>box.remove(),1300)}
/* ---- gags animés aléatoires sur le thème du secours (en plus du feu) ---- */
const G_AMB='<svg viewBox="0 0 120 64"><rect x="4" y="14" width="78" height="36" rx="5" fill="#fff" stroke="#c5ccd6" stroke-width="2"/><path d="M82 24h18l14 14v12H82z" fill="#fff" stroke="#c5ccd6" stroke-width="2"/><path d="M88 28h11l9 9H88z" fill="#9fd3ff"/><rect x="4" y="34" width="110" height="5" fill="#e3051b"/><path d="M34 21h8v7h7v8h-7v7h-8v-7h-7v-8h7z" fill="#e3051b"/><rect x="58" y="8" width="12" height="6" rx="2" class="gyro"/><circle cx="26" cy="52" r="8" fill="#2a2f37"/><circle cx="26" cy="52" r="3.5" fill="#aab1bc"/><circle cx="96" cy="52" r="8" fill="#2a2f37"/><circle cx="96" cy="52" r="3.5" fill="#aab1bc"/></svg>';
const G_BRANC='<svg viewBox="0 0 120 60"><rect x="10" y="26" width="96" height="7" rx="3" fill="#ff7a00"/><circle cx="24" cy="18" r="7" fill="#f2c9a0" stroke="#2a2f37" stroke-width="1.5"/><path d="M31 22c10-5 40-6 66-2l4 6H31z" fill="#5e9cff"/><path d="M60 21c6-1 18-1 30 0" stroke="#fff" stroke-width="2" fill="none"/><path d="M20 33v14M96 33v14" stroke="#555" stroke-width="3"/><circle cx="20" cy="51" r="5" fill="#2a2f37"/><circle cx="96" cy="51" r="5" fill="#2a2f37"/><path d="M18 14c2-4 8-4 10 0" stroke="#2a2f37" stroke-width="1.5" fill="none"/></svg>';
const G_ITEMS=['<svg viewBox="0 0 40 16"><rect x="1" y="2" width="38" height="12" rx="6" fill="#f0c9a0" stroke="#c99a6a"/><rect x="13" y="3.5" width="14" height="9" rx="2" fill="#fbe6d0"/><circle cx="17" cy="6" r=".8" fill="#c99a6a"/><circle cx="23" cy="10" r=".8" fill="#c99a6a"/><circle cx="23" cy="6" r=".8" fill="#c99a6a"/><circle cx="17" cy="10" r=".8" fill="#c99a6a"/></svg>',
 '<svg viewBox="0 0 48 14"><rect x="10" y="3" width="24" height="8" rx="1.5" fill="#dff3ff" stroke="#7a8b9c"/><rect x="12" y="4.5" width="12" height="5" fill="#ff8aa0" opacity=".8"/><path d="M34 5h8v4h-8zM2 7h8" stroke="#7a8b9c" stroke-width="2"/><path d="M42 7h5" stroke="#9aa6b2" stroke-width="1"/></svg>',
 '<svg viewBox="0 0 30 30"><path d="M11 2h8v9h9v8h-9v9h-8v-9H2v-8h9z" fill="#e3051b"/></svg>',
 '<svg viewBox="0 0 16 44"><rect x="5" y="2" width="6" height="32" rx="3" fill="#fff" stroke="#9aa6b2"/><rect x="7" y="12" width="2" height="22" fill="#e3051b"/><circle cx="8" cy="37" r="5" fill="#e3051b"/></svg>',
 '<svg viewBox="0 0 30 36"><rect x="3" y="8" width="24" height="26" rx="4" fill="#fff" stroke="#9aa6b2"/><rect x="9" y="3" width="12" height="7" rx="2" fill="#9aa6b2"/><path d="M12 16h6v4h4v6h-4v4h-6v-4H8v-6h4z" fill="#1f9d55"/></svg>'];
const G_EXT='<svg viewBox="0 0 40 60"><rect x="10" y="14" width="18" height="40" rx="8" fill="#e3051b"/><rect x="14" y="8" width="10" height="8" rx="2" fill="#2a2f37"/><path d="M24 10h10l-2 5" stroke="#2a2f37" stroke-width="3" fill="none"/><rect x="12" y="26" width="14" height="10" rx="2" fill="#fff"/><circle cx="16" cy="22" r="1.6" fill="#fff"/><circle cx="22" cy="22" r="1.6" fill="#fff"/></svg>';
let gagT=null;
function startGags(){if(gagT||matchMedia("(prefers-reduced-motion: reduce)").matches)return;const next=d=>{gagT=setTimeout(()=>{if(!onFire){gagT=null;return}if(!document.hidden&&!$("#sheet")&&!document.querySelector(".tuto"))playGag();next(18000+Math.random()*27000)},d)};next(5000+Math.random()*4000)}
function stopGags(){clearTimeout(gagT);gagT=null;document.querySelectorAll(".gag").forEach(x=>x.remove())}
function playGag(kind){const k=kind||pick(["amb","amb","branc","rain","rain","ext","gyro"]);const el=document.createElement("div");el.className="gag gag-"+k;el.setAttribute("aria-hidden","true");let life=7000;
 if(k==="amb"){const ltr=Math.random()<.5;el.classList.add(ltr?"ltr":"rtl");el.style.top=(25+Math.random()*45)+"vh";el.innerHTML=`<div class="veh">${G_AMB}</div><span class="bub">${pick(["Pin-pon !","Pin-pon, pin-pon !","On arrive !","Départ immédiat !","Statut 1 !"])}</span>`;life=6200}
 else if(k==="branc"){el.style.top=(30+Math.random()*40)+"vh";el.innerHTML=`<div class="veh">${G_BRANC}</div><span class="bub">${pick(["Brancardage en cours…","On ne court pas, on se presse !","Attention la marche !","Il faut un renfort brancardage !"])}</span>`;life=7500}
 else if(k==="rain"){el.innerHTML=[...Array(16)].map((_,i)=>`<span class="drop" style="left:${(i*6.3+Math.random()*4)%98}%;--d:${(Math.random()*2.2).toFixed(2)}s;--t:${(3+Math.random()*2.5).toFixed(2)}s;--r:${Math.round(Math.random()*720-360)}deg;--w:${Math.round(22+Math.random()*18)}px">${pick(G_ITEMS)}</span>`).join("");life=7600}
 else if(k==="ext"){el.innerHTML=`<div class="hop">${G_EXT}</div><span class="bub">${pick(["Pschhht !","Feu maîtrisé ?","Classe ABC, pas de panique !"])}</span>`;life=6500}
 else if(k==="gyro"){el.innerHTML=`<div class="flash"></div>`;life=2600}
 document.body.appendChild(el);setTimeout(()=>el.remove(),life);alog("gag",k)}
applyFire();

/* ============ Messages radio ============ */
const RADIO_IC='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="8" width="12" height="13" rx="2.5"/><path d="M9 8 7 3"/><path d="M9.5 12h5M9.5 15h5"/><circle cx="12" cy="18.2" r=".6" fill="currentColor"/></svg>';
let radioId=store.get("radioId",{num:"",cs:"",golf:"",t:0});
function saveRadioId(v){radioId={num:String(v.num||"").trim().slice(0,6),cs:String(v.cs||"").trim().slice(0,40),golf:String(v.golf||"").trim().slice(0,3),t:Date.now()};store.set("radioId",radioId);if(typeof syncSoon==="function")syncSoon(2000)}
const rMe=()=>`Croix-Rouge française ${radioId.num||"XXX"} de ${radioId.cs||"(centre de secours)"}`;
const rGolf=()=>`Golf ${radioId.golf||"X"}`;
const rPf=()=>`Poste fixe de ${radioId.cs||"(centre de secours)"}`;
const rHour=()=>{const d=new Date();return String(d.getHours()).padStart(2,"0")+String(d.getMinutes()).padStart(2,"0")}; // format BSPP : 1634
const rv=(s,ph)=>String(s||"").trim()||ph;               // valeur saisie ou repère entre parenthèses
const joinFr=a=>a.length<2?a.join(""):a.slice(0,-1).join(", ")+" et "+a[a.length-1];
const cap=s=>s?s[0].toUpperCase()+s.slice(1):s;

// Moyens : du plus gros au plus petit pour la BSPP, puis services publics (Guide pratique CI p. 10-12)
const MOYENS=[
 {k:"ep",l:"un engin pompe",c:"Engin pompe",bspp:1,m:["ouverture de porte","reconnaissance d'appartement","renfort brancardage (6 personnels)","aide au commandement"],w:"En cas de doute sur l'engin le plus approprié, appelle d'abord le chef de garde (via le PVO)."},
 {k:"desinc",l:"un camion de désincarcération",c:"Désincarcération",bspp:1,m:["accident de la circulation avec victime incarcérée"]},
 {k:"mea",l:"un moyen élévateur aérien",c:"Moyen élévateur aérien",bspp:1,m:["brancardage","reconnaissance d'appartement"],w:"Toujours confirmer avec le chef de garde d'abord (hauteur, accès, poids, compatibilité brancard / nacelle)."},
 {k:"grimp",l:"un groupe de recherche et d'intervention en milieu périlleux",c:"GRIMP",bspp:1,m:["brancardage"],w:"Après conseil du chef de garde. Un engin pompe sera demandé en renfort."},
 {k:"gic",l:"un groupe d'intervention chimique",c:"Groupe chimique",bspp:1,m:["levée de doute","accident de la voie publique impliquant un véhicule hybride"],w:"Toujours contacter le chef de garde avant de demander ce type de moyen."},
 {k:"gir",l:"un groupe d'intervention radiologique",c:"Groupe radiologique",bspp:1,m:["levée de doute"],w:"Toujours contacter le chef de garde avant de demander ce type de moyen."},
 {k:"vtba",l:"le véhicule de transport bariatrique pour le transport d'une personne à forte corpulence",c:"VTBA (> 185 kg)",bspp:1,m:["transport d'une personne de plus de 185 kg"],w:"Sonné après passage du bilan à la coordination médicale. Prévoir du délai ; l'équipage suit le VTBA jusqu'à l'hôpital.",noMotif:1},
 {k:"vsav",l:"un véhicule de secours à victimes",c:"VSAV",bspp:1,m:["accident de la circulation","victimes multiples"]},
 {k:"eps",l:"un engin de prompt secours",c:"Engin de prompt secours",bspp:1,m:["renfort brancardage (3 personnels)","renfort massage"]},
 {k:"mtnm",l:"un moyen de transport non médicalisé",c:"Transport non médicalisé",bspp:1,m:["transport d'une deuxième victime"]},
 {k:"em",l:"une équipe médicale",c:"Équipe médicale (coordination non contactée)",bspp:1,m:["cas urgent, coordination médicale non contactée"],w:"Demande sèche, en situation très exceptionnelle uniquement (cas urgent ou coordination injoignable).",suf:"coordination médicale non contactée"},
 {k:"comp",l:"un complément de départ",c:"Complément de départ",bspp:1,m:["intervention complexe"],w:"Si tu n'es pas certain des moyens nécessaires : le motif doit être assez explicite pour que les bons renforts soient envoyés."},
 {k:"polu",l:"Police d'urgence",c:"Police d'urgence",m:["agression envers les équipes de secours"],w:"Il doit y avoir un véritable danger imminent pour l'équipe."},
 {k:"pol",l:"Police",c:"Police",m:["personne agressive envers les secours","personne en état d'ébriété sur la voie publique","décès suspect","arrêt cardio-respiratoire sur la voie publique","accident de la circulation","reconnaissance d'appartement","rixe","différend familial","personne nue sur la voie publique","accident du travail"]},
 {k:"esc",l:"une escorte motorisée",c:"Escorte motorisée",m:["transport vers l'hôpital"],w:"Systématiquement à la demande du médecin."},
];
const MOY=Object.fromEntries(MOYENS.map(m=>[m.k,m]));
const NATURES=["secours à un homme malade","secours à une femme malade","secours à un homme blessé","secours à une femme blessée","secours à un homme en arrêt cardio-respiratoire","secours à une parturiente","décès certain","intoxication au monoxyde de carbone","personne menaçant de se jeter dans le vide","secours à un policier","secours à un militaire","secours à un sapeur-pompier de Paris"];
const PRES=[["pol","La police","Police","f"],["crs","Compagnie républicaine de sécurité","Compagnie républicaine de sécurité","f"],["opj","Officier de police judiciaire","Officier de police judiciaire","m"],["em","Équipe médicale","Équipe médicale","f"]];
const ROUT={
 "1":{l:"Départ en intervention",ph:()=>`${rGolf()}, la ${rMe()} partie {motif}, {adresse}.`,q:"Tu quittes le centre de secours pour te rendre sur l'intervention."},
 "2":{l:"Se présente sur les lieux",ph:()=>`${rGolf()}, la ${rMe()} se présente.`,r:()=>`${rPf()} reçu.`,q:"Tu arrives sur les lieux de l'intervention."},
 "5":{l:"Transport hôpital",ph:()=>`${rGolf()}, la ${rMe()} se dirige vers l'hôpital {hopital}.`,q:"Tu pars vers l'hôpital avec la victime."},
 "6":{l:"Arrivée à l'hôpital",ph:()=>`${rGolf()}, la ${rMe()} se présente à l'hôpital {hopital}.`,q:"Tu arrives à l'hôpital."},
 "25":{l:"Quitte l'hôpital",ph:()=>`${rGolf()}, la ${rMe()} quitte l'hôpital {hopital}.`,q:"Tu sors de l'enceinte de l'hôpital."},
 "7":{l:"Disponible",ph:()=>`${rGolf()}, la ${rMe()} est disponible.`,r:()=>`${rPf()} reçu.`,q:"Tu es de nouveau disponible pour un départ."},
 "9":{l:"Rentré",ph:()=>"",q:"Tu es rentré au centre de secours."},
};
const STATUTS=[["1","Parti","Départ en intervention"],["2","Sur les lieux","Présentation sur les lieux"],["3","Message","Inusité"],["4","Message urgent","Inusité"],["5","Transport hôpital","Départ vers l'hôpital avec la victime"],["6","Arrivée hôpital","Présentation à l'hôpital"],["25","Quitte l'hôpital","Sortie de l'enceinte de l'hôpital, puis 7"],["7","Disponible","Après le 25 (hors secteur : une fois revenu sur le secteur)"],["8","Indisponible","Engin indisponible"],["9","Rentré","Retour au centre de secours, pas de phonie"],["41","Demande de confirmation","Demande de confirmation"],["47","Présentation spontanée","Présentation spontanée"]];
const MATERIEL=["DSA","MCE","RCP","Aspiration","Insufflation","Oxygénothérapie","ECG","Immobilisation générale","Attelle","Relevage"];

/* Modèles : champs du formulaire + construction du dialogue. f = valeurs saisies. */
const RB={
 routine:{t:"Statuts du quotidien",s:"Départ, présentation, hôpital, disponible",c:"#0a84ff",p:9,
  fields:[{k:"st",t:"seg",l:"Étape",o:Object.entries(ROUT).map(([k,v])=>[k,k]),d:"1"},
   {k:"motif",l:"Motif",ph:"ex. personne blessée lieu public",show:f=>f.st==="1"},{k:"adresse",l:"Adresse",ph:"ex. 12 rue Ordener",show:f=>f.st==="1"},
   {k:"hopital",l:"Hôpital",ph:"ex. Lariboisière",show:f=>["5","6","25"].includes(f.st)}],
  build:f=>{const R=ROUT[f.st]||ROUT["1"];const txt=R.ph().replace("{motif}",rv(f.motif,"(tel motif)")).replace("{adresse}",rv(f.adresse,"(telle adresse)")).replace("{hopital}",rv(f.hopital,"(nom de l'hôpital)"));
   const notes=[`Normalement passé en <b>statut ${f.st}</b> (${esc(R.l)}) sur la radio. La phonie sert en mode dégradé, sur demande du CO ou du CSO.`];
   if(f.st==="25")notes.push("Hôpital sur ton secteur : passe 25 puis 7 dans la foulée. Hôpital hors secteur : passe 25, puis 7 une fois revenu sur ton secteur. Les deux statuts sont toujours passés.");
   if(f.st==="9")return{lines:[],notes:["Statut 9 « Rentré » : pas de message en phonie. Remets la radio en charge puis passe le message de rentrée au PVO."],big:f.st};
   return{lines:[["CRF",txt]].concat(R.r?[["PVO",R.r()]]:[]),notes,big:f.st}}},
 moyens:{t:"Demande de moyens",s:"Règle SAM : Service, Adresse, Motif",c:"#e3051b",p:10,
  fields:[{k:"moy",t:"multi",l:"Moyens demandés",o:MOYENS.map(m=>[m.k,m.c]),d:["pol"]},{k:"materiel",l:"Matériel particulier (facultatif)",ph:"ex. un détecteur multigaz"},
   {k:"adresse",l:"Adresse",ph:"ex. 30 quai de la Rapée"},{k:"lieu",l:"Précision",ph:"ex. voie publique, 4e étage sur cour"},
   {k:"motif",l:"Motif",ph:"ex. personne en état d'ébriété sur la voie publique",sugg:f=>[].concat(...(f.moy||[]).map(k=>MOY[k].m))},
   {k:"urg",t:"seg",l:"Urgence",o:[["","—"],["urgence absolue","UA"],["urgence relative","UR"]],d:""},
   {k:"differe",l:"Mise à disposition différée (facultatif)",ph:"ex. 15 h 30"},
   {k:"em",t:"toggle",l:"Et attendons équipe médicale"},{k:"urgent",t:"toggle",l:"Message URGENT (exceptionnel)"}],
  build:f=>samBuild(f,true)},
 rens:{t:"Message de renseignement",s:"Seul, avec demande de moyens, dénombrement terrain",c:"#ff9f0a",p:13,
  fields:[{k:"nature",l:"Nature",ph:"ex. secours à un homme malade",sugg:()=>NATURES},
   {k:"urg",t:"seg",l:"Urgence",o:[["","—"],["urgence absolue","UA"],["urgence relative","UR"]],d:"urgence absolue"},
   {k:"adresse",l:"Adresse",ph:"ex. 4 rue Edmond Rousse"},{k:"lieu",l:"Précision",ph:"ex. escalier 120, 4e étage"},
   {k:"moy",t:"multi",l:"Coupler une demande de moyens (facultatif)",o:MOYENS.map(m=>[m.k,m.c]),d:[]},
   {k:"den",t:"seg",l:"Dénombrement terrain",o:[["","Aucun"],["provisoire","Provisoire"],["définitif","Définitif"]],d:""},
   {k:"nua",t:"num",l:"Victimes UA",show:f=>!!f.den},{k:"nur",t:"num",l:"Victimes UR",show:f=>!!f.den},
   {k:"em",t:"toggle",l:"Et attendons équipe médicale",d:true}],
  build:f=>samBuild(f,false)},
 pres:{t:"Présentation des moyens",s:"Refermer le tiroir ouvert par une demande",c:"#34c759",p:12,
  fields:[{k:"opt",t:"seg",l:"Option",o:[["1","1 · dès l'arrivée"],["2","2 · en fin d'intervention"]],d:"1"},
   {k:"who",t:"multi",l:"Moyens non BSPP",o:PRES.map(p=>[p[0],p[2]]),d:["pol"]},{k:"hosp",l:"Équipe médicale de",ph:"ex. Necker",show:f=>(f.who||[]).includes("em")},
   ...PRES.map(p=>({k:"h_"+p[0],l:"Heure — "+p[2],ph:"ex. 1405",show:f=>f.opt==="2"&&(f.who||[]).includes(p[0])}))],
  build:f=>{const w=(f.who||[]);const items=PRES.filter(p=>w.includes(p[0])).map(p=>{const n=p[0]==="em"?`Équipe médicale ${rv(f.hosp,"(hôpital)")}`:p[1];
    return f.opt==="2"?`${n} présenté${p[3]==="f"?"e":""} à ${rv(f["h_"+p[0]],"(telle heure)")}`:`${n} se présente`});
   return{lines:[["CRF",`${rGolf()} ici la ${rMe()}, parlez.`],["CSO",`${rMe()} ici ${rGolf()}, parlez.`],["CRF",`De la ${rMe()} : ${items.length?items.join(". "):"(moyen) se présente"}. ${rGolf()} parlez.`]],
    notes:["Principe du « tiroir » : tout moyen demandé doit être présenté. Les engins BSPP se présentent eux-mêmes.","Option 1 : pratique quand tu n'attends qu'un seul moyen. Option 2 : mieux quand plusieurs moyens sont attendus."]}}},
 clot:{t:"Clôture du renseignement",s:"Dénombrement définitif, suite donnée, heures",c:"#30b0c7",p:14,
  fields:[{k:"nua",t:"num",l:"UA"},{k:"uaBy",l:"UA transportée(s) par",ph:"ex. équipe médicale"},{k:"nur",t:"num",l:"UR"},{k:"urBy",l:"UR transportée(s) par",ph:"ex. moyens de transport non médicalisés"},
   {k:"who",t:"multi",l:"Moyens non BSPP présentés",o:PRES.map(p=>[p[0],p[2]]),d:["pol"]},...PRES.map(p=>({k:"h_"+p[0],l:"Heure — "+p[2],ph:"ex. 1405",show:f=>(f.who||[]).includes(p[0])}))],
  build:f=>{const parts=[];const ua=+f.nua||0,ur=+f.nur||0;
   if(ua)parts.push(`${ua} urgence${ua>1?"s":""} absolue${ua>1?"s":""} transportée${ua>1?"s":""} par ${rv(f.uaBy,"(vecteur)")}`);
   if(ur)parts.push(`${ur} urgence${ur>1?"s":""} relative${ur>1?"s":""} transportée${ur>1?"s":""} par ${rv(f.urBy,"(vecteur)")}`);
   PRES.filter(p=>(f.who||[]).includes(p[0])).forEach(p=>parts.push(`${p[2]} présenté${p[3]==="f"?"e":""} à ${rv(f["h_"+p[0]],"(telle heure)")}`));
   return{lines:[["CRF",`De la ${rMe()}, ${ua||ur?"dénombrement terrain définitif : ":""}${parts.join(", ")||"(police présentée à telle heure)"}, ${rGolf()} parlez.`]],
    notes:["Tout message de renseignement appelle un autre message de renseignement en fin d'intervention (« fermer le tiroir »).","Message riche = intervention complexe = des chefs d'agrès BSPP avec toi : n'hésite pas à leur demander conseil."]}}},
 danger:{t:"Équipage en danger",s:"Les mots choisis fixent les effectifs envoyés",c:"#ff375f",p:15,
  fields:[{k:"type",t:"seg",l:"Situation",o:[["agr","Personne agressive"],["foule","Pris à partie par la foule"]],d:"agr"},
   {k:"pol",t:"seg",l:"Service",o:[["pol","Police"],["polu","Police d'urgence"]],d:"pol"},{k:"ep",t:"toggle",l:"Ajouter un engin pompe"},
   {k:"adresse",l:"Adresse",ph:"ex. 2 boulevard Barbès"},{k:"lieu",l:"Précision",ph:"ex. voie publique"},{k:"urgent",t:"toggle",l:"Message URGENT"}],
  build:f=>{const mot=f.type==="foule"?"équipage pris à partie par la foule":"personne agressive envers les secours";
   return samBuild({moy:[...(f.ep?["ep"]:[]),f.pol||"pol"],adresse:f.adresse,lieu:f.lieu,motif:mot,urgent:f.urgent},true,["Une « personne agressive envers les secours » déclenche par défaut une patrouille (3 policiers). « Équipage pris à partie par la foule » déclenche plusieurs patrouilles équipées pour disperser une foule.","L'engin pompe arrive souvent avant la police : six sapeurs-pompiers en tenue de feu sécurisent l'équipage en attendant.","Le bouton rouge du portatif n'est pas utilisé dans les procédures actuelles."])}},
 trafic:{t:"Bloqué dans la circulation",s:"Faire partir un autre engin",c:"#8e8e93",p:20,
  fields:[{k:"adresse",l:"Adresse de l'intervention",ph:"ex. 40 rue Marcadet"},{k:"motif",l:"Motif",ph:"ex. personne malaise"},{k:"pos",l:"Où es-tu bloqué ?",ph:"ex. place de Clichy"},{k:"evite",l:"Secteur à éviter (facultatif)",ph:"ex. boulevard de Rochechouart"}],
  build:f=>{const h=rHour();const core=`faites partir un autre engin ${rv(f.adresse,"(telle adresse)")} pour ${rv(f.motif,"(tel motif)")} ; ${rMe()} bloquée dans la circulation ${rv(f.pos,"(telle adresse)")}${f.evite?`, éviter secteur ${f.evite}`:""}`;
   return{lines:[["CRF",`${rGolf()}, ici la ${rMe()}, parlez.`],["CSO",`${rMe()}, ici ${rGolf()} parlez.`],["CRF",`De la ${rMe()} : ${core}, ${rGolf()} parlez.`],["CSO",`De la ${rMe()} : ${core}, message reçu à ${h}.`],["CRF",`${h}, correct, terminé.`]],
    notes:["La mission reste en cours : tu dois toujours t'y rendre. Sur place, les deux engins décident qui poursuit et qui se replace disponible."]}}},
 corr:{t:"Annuler, corriger, additif",s:"Formules pour rectifier un message",c:"#5e5ce6",p:15,
  fields:[{k:"cas",t:"seg",l:"Cas",o:[["ann","Annuler"],["cor","Je me trompe"],["col","Le CSO se trompe"],["add","Additif"]],d:"cor"},
   {k:"faux",l:"Élément erroné",ph:"ex. 1 quai de la Rapée",show:f=>f.cas==="cor"},{k:"juste",l:"Élément correct",ph:"ex. 30 quai de la Rapée",show:f=>f.cas==="cor"||f.cas==="col"},
   {k:"hm",l:"Heure du message concerné",ph:"ex. 1412",show:f=>f.cas==="add"},{k:"add",l:"Ajout ou modification",ph:"ex. victime transportée par équipe médicale",show:f=>f.cas==="add"}],
  build:f=>{const h=rHour();
   if(f.cas==="ann")return{lines:[["CRF",`${rGolf()}, annulez la transmission.`]],notes:["Pour interrompre un message devenu inutile (ex. tu commences une demande police et la police se présente)."]};
   if(f.cas==="cor")return{lines:[["CRF",`De la ${rMe()}, je demande police, ${rv(f.faux,"(élément erroné)")}… Correction, lire ${rv(f.juste,"(élément correct)")}, pour (tel motif), ${rGolf()} parlez.`]],notes:["Corrige immédiatement avec « Correction, lire… »."]};
   if(f.cas==="col")return{lines:[["CSO",`De la ${rMe()}, … message reçu à ${h}.`],["CRF",`Négatif, lire ${rv(f.juste,"(élément correct)")}, ${rGolf()} parlez.`],["CSO",`${rv(f.juste,"(élément correct)")}, message reçu à ${h}.`],["CRF",`${h}, correct et attendons.`]],notes:["Vérifie toujours la collation du CSO : il doit détenir la bonne information."]};
   return{lines:[["CRF",`Additif au message de ${rv(f.hm,"(heure du message)")}, ${rv(f.add,"(contenu de l'ajout)")}, ${rGolf()} parlez.`]],notes:["« Modification au message de (heure) » pour changer un élément déjà transmis.","Tu peux aussi faire corriger un message après l'intervention par un appel du PVO au CSO, avant la clôture."]}}},
 rentree:{t:"Message de rentrée + CRI",s:"Au PVO, au retour d'intervention",c:"#0f1d36",p:35,
  fields:[{k:"act",t:"seg",l:"1 · Action",o:[["Bilan","Bilan"],["Recherche","Recherche"],["Brancardage","Brancardage"],["Néant","Néant"]],d:"Bilan"},
   {k:"mat",t:"multi",l:"Matériel / technique",o:MATERIEL.map(m=>[m,m]),d:[],show:f=>f.act!=="Néant"},
   {k:"contact",t:"seg",l:"Contact coordination",o:[["","Aucun"],["opérateur coordination","Opérateur"],["infirmier coordination","Infirmier"],["médecin coordinateur","Médecin"]],d:"",show:f=>f.act!=="Néant"},
   {k:"dech",t:"toggle",l:"Décharge",show:f=>f.act!=="Néant"},
   {k:"nv",t:"seg",l:"2 · Victimes",o:[["0","Aucune"],["1","1"],["2","2"],["3","3"]],d:"1"},
   ...[1,2,3].flatMap(i=>[{k:"v"+i+"s",t:"seg",l:`Victime ${i}`,o:[["un homme","Homme"],["une femme","Femme"],["un enfant","Enfant"]],d:"un homme",show:f=>+f.nv>=i},
    {k:"v"+i+"id",l:"Nom, prénom (vide = identité inconnue)",ph:"ex. Martin Paul",show:f=>+f.nv>=i},{k:"v"+i+"a",l:"Âge",ph:"ex. 45 ans",show:f=>+f.nv>=i},
    {k:"v"+i+"e",t:"seg",l:"État",o:[["UR","UR"],["UA","UA"],["DCD","DCD"]],d:"UR",show:f=>+f.nv>=i},
    {k:"v"+i+"mil",l:"Si militaire / policier : grade, matricule, corps, affectation, fonction",ph:"facultatif",show:f=>+f.nv>=i},
    {k:"v"+i+"d",t:"seg",l:"Devenir",o:[["crf","Transport CRF"],["em","Équipe médicale"],["mtnm","Autre vecteur"],["lsp","LSP"]],d:"crf",show:f=>+f.nv>=i&&f["v"+i+"e"]!=="DCD"},
    {k:"v"+i+"h",l:"Hôpital (et service)",ph:"ex. SAU Bichat",show:f=>+f.nv>=i&&f["v"+i+"e"]!=="DCD"&&f["v"+i+"d"]!=="lsp"}]),
   {k:"dae",t:"toggle",l:"3 · Défibrillateur public utilisé"},{k:"degats",l:"5 · Dégâts provoqués par les secours",ph:"Néant"},
   {k:"serv",l:"7 · Services à prévenir (facultatif)",ph:"ex. EDF"},{k:"cri",t:"cri",l:"Code CRI"}],
  build:f=>{const L=[];
   if(f.act==="Néant")L.push("1/ Néant");else L.push("1/ "+[f.act,...(f.mat||[]),f.contact?"contact "+f.contact:"",f.dech?"décharge":""].filter(Boolean).join(", "));
   const nv=+f.nv||0;if(f.act==="Brancardage"&&!nv)L.push("2/ Néant");
   for(let i=1;i<=nv;i++){const g=k=>f["v"+i+k];const id=String(g("id")||"").trim();const st=g("e")||"UR";
    const sx=cap(g("s")||"un homme"),ag=String(g("a")||"").trim();
    let s=id?`${sx}, ${id}${ag?", "+ag:""}`:ag?`${sx} de ${ag}, d'identité inconnue`:`${sx} d'âge et d'identité inconnus`;
    if(g("mil"))s+=", "+g("mil");s+=", "+st;
    if(st!=="DCD"){const d=g("d")||"crf";s+=d==="lsp"?", laissé sur place":d==="em"?`, évacué par équipe médicale vers ${rv(g("h"),"(hôpital)")}`:d==="mtnm"?`, transporté par (vecteur) vers ${rv(g("h"),"(hôpital)")}`:`, transporté par CRF ${radioId.num||"XXX"} vers ${rv(g("h"),"(hôpital)")}`}
    L.push((i===1?"2/ ":"     ")+s)}
   if(f.dae)L.push("3/ Utilisation d'un défibrillateur public");
   L.push("5/ "+rv(f.degats,"Néant"));if(f.serv)L.push("7/ "+f.serv);
   const c=f.cri?CRI.find(x=>x[0]===f.cri):null;L.push(c?`CRI ${c[0]} (${c[1]})`:"CRI (à choisir)");
   const notes=["Points 1 et 5 toujours remplis ; point 2 si une victime est prise en charge ; 3, 6 et 7 parfois. Énonce-les dans l'ordre en donnant le chiffre.","Les pratiques varient selon les groupements : demande les consignes au PVO en début de vacation."];
   for(let i=1;i<=nv;i++)if(f["v"+i+"mil"]){notes.unshift("Victime militaire ou policier : rends-en compte immédiatement au PVO pour que l'officier de garde soit avisé.");break}
   if(f.dech)notes.push("Une victime UA évacuée par équipe médicale ou médicalisée dans le VPSP est notée UA.");
   return{lines:[["CRF",L.join("\n")]],notes,pvo:1}}},
};
// demande de moyens et / ou renseignement (Guide p. 10-14)
function samBuild(f,needMoy,extra){const h=rHour();const sel=MOYENS.filter(m=>(f.moy||[]).includes(m.k));const list=sel.map(m=>m.l);if(f.materiel)list.push(f.materiel.trim());
 const lieu=f.lieu?", "+f.lieu.trim():"";const adr=rv(f.adresse,"(telle adresse)")+lieu;
 const em=f.em?", et attendons équipe médicale":"";const urg=f.urg?", "+f.urg:"";
 const den=f.den&&(+f.nua||+f.nur)?`, dénombrement terrain ${f.den} ${[+f.nua?`${+f.nua} victime${+f.nua>1?"s":""} urgence${+f.nua>1?"s":""} absolue${+f.nua>1?"s":""}`:"",+f.nur?`${+f.nur} victime${+f.nur>1?"s":""} urgence${+f.nur>1?"s":""} relative${+f.nur>1?"s":""}`:""].filter(Boolean).join(", ")}`:"";
 const suf=sel.find(m=>m.suf);let body;
 if(list.length){const motif=sel.some(m=>m.noMotif)&&!f.motif&&!f.nature?"":", "+rv(f.motif||f.nature,"(tel motif)");
  body=`je demande ${joinFr(list)}${f.differe?` rendu pour ${f.differe}`:""}, ${adr}${motif}${urg}${suf?", "+suf.suf:""}${den}${em}`}
 else body=`${rv(f.nature,"(nature de l'intervention)")}${urg}, ${adr}${den}${em}`;
 const call=`${f.urgent?"URGENT, URGENT, URGENT, ":""}${rGolf()} ici la ${rMe()}, parlez.`;
 const lines=[["CRF",call],["CSO",`${rMe()} ici ${rGolf()}, parlez.`],["CRF",`De la ${rMe()}, ${body}, ${rGolf()} parlez.`],["CSO",`${rMe()}, ${list.length?body.replace(/^je demande/,"vous demandez"):body}, message reçu à ${h}.`]];
 if(sel.some(m=>m.bspp)){lines.push(["CSO","Je vous rends compte que (tel engin) de (tel CS) a été sonné."]);lines.push(["CRF","Reçu, et attendons."])}else lines.push(["CRF",`${h}, correct, et attendons.`]);
 const notes=[];if(needMoy&&!list.length)notes.push("Choisis au moins un moyen.");
 if(sel.length>1)notes.push("Les moyens BSPP sont toujours demandés en premier, puis les services publics, du plus gros au plus petit : l'ordre est appliqué automatiquement.");
 sel.forEach(m=>{if(m.w)notes.push(`<b>${esc(m.c)}</b> : ${esc(m.w)}`)});
 if(f.urgent)notes.push("« URGENT » est réservé à un message urgent et prioritaire : situation purement exceptionnelle pour un équipage CRf.");
 if(needMoy)notes.push("Idéalement dans les 5 minutes suivant la présentation, après la reconnaissance de sécurité. Prioritaire sur les autres messages.");
 else notes.push("À passer pour : interventions médicalisées (ACR, parturiente), décès certain, accident de circulation, victimes multiples, menace de se jeter dans le vide, intoxication au CO, victime au statut particulier. Pense à la clôture en fin d'intervention.");
 if(list.some(x=>!/^(Police|une escorte)/.test(x)))notes.push("N'oublie pas de présenter les moyens non BSPP à leur arrivée (« tiroir »).");
 (extra||[]).forEach(x=>notes.push(esc(x)));
 return{lines,notes}}

/* ---- Lecture à voix haute ---- */
let rVoice=null;
function speak(text){if(!("speechSynthesis" in window)){toast("Lecture vocale non disponible sur cet appareil.");return}
 const ss=window.speechSynthesis;if(ss.speaking){ss.cancel();return}
 if(!rVoice){const vs=ss.getVoices();rVoice=vs.find(v=>/^fr(-|_)FR/i.test(v.lang)&&/(Thomas|Amélie|Audrey|Google)/i.test(v.name))||vs.find(v=>/^fr/i.test(v.lang))||null}
 const t=String(text).replace(/\(([^)]*)\)/g,"$1").replace(/\bCRF\b/g,"C R F").replace(/\bUA\b/g,"U A").replace(/\bUR\b/g,"U R").replace(/\bSAU\b/g,"SAU").replace(/(\d+) h (\d+)/g,"$1 heures $2").replace(/\n/g,". ");
 const u=new SpeechSynthesisUtterance(t);u.lang="fr-FR";u.rate=.98;if(rVoice)u.voice=rVoice;ss.cancel();ss.speak(u)}
function stopSpeak(){try{window.speechSynthesis&&window.speechSynthesis.cancel()}catch(e){}}

/* ---- Écran principal ---- */
let radioTab=store.get("radioTab","build");
function indicCard(){const ok=radioId.num&&radioId.cs;
 return `<div class="card rid"><div><div class="small">Mon indicatif</div><b>${ok?esc(rMe()):"Non renseigné"}</b><div class="small">${radioId.golf?`Interlocuteur : ${esc(rGolf())} · `:""}${ok?esc(rPf()):"Il sera prérempli dans tous les messages."}</div></div><button class="btn small sec" id="ridEdit">${ok?"Modifier":"Renseigner"}</button></div>`}
function indicSheet(after){sheet(`<h2>Mon indicatif radio</h2><p class="small">Prérempli dans tous les messages. Exemple : Croix-Rouge française <b>321</b> de <b>Plaisance</b>, interlocuteur <b>Golf 3</b>.</p>
  <form class="form" id="ridF"><label for="ridN">Numéro de l'engin CRF</label><input id="ridN" inputmode="numeric" maxlength="6" placeholder="ex. 321" value="${esc(radioId.num)}">
  <label for="ridC">Centre de secours</label><input id="ridC" maxlength="40" placeholder="ex. Plaisance" value="${esc(radioId.cs)}">
  <label for="ridG">Numéro du Golf (groupement)</label><input id="ridG" inputmode="numeric" maxlength="3" placeholder="ex. 3" value="${esc(radioId.golf)}">
  <button class="btn full" type="submit" style="margin-top:14px">Enregistrer</button></form><p class="small">Golf 1, 2 ou 3 selon le groupement du centre de secours où tu es de garde (rempli automatiquement si tu choisis un CS de la liste, ou depuis la carte des secteurs). L'indicatif est enregistré sur ton compte.</p>`);
 loadSect().then(()=>{const ci=$("#ridC");if(!ci)return;const dl=document.createElement("datalist");dl.id="dlCS";dl.innerHTML=SECT.sect.map(s=>`<option value="${esc(s.name)}">`).join("");ci.after(dl);ci.setAttribute("list","dlCS");
   ci.addEventListener("input",()=>{const s=SECT.sect.find(x=>norm(x.name)===norm(ci.value.trim()));if(s)$("#ridG").value=s.golf})}).catch(()=>{});
 $("#ridF").onsubmit=e=>{e.preventDefault();saveRadioId({num:$("#ridN").value,cs:$("#ridC").value,golf:$("#ridG").value});closeSheet();(after||viewRadio)()}}
function viewRadio(){if(usage==="ci"&&radioTab==="train")radioTab="build";
 const head=`${backLink()}<h1 class="big">Messages radio</h1><p class="sub">Construis tes messages phonie BSPP, entraîne-toi au dialogue avec le CSO et révise les statuts.</p>${indicCard()}
  <div class="seg" style="margin:14px 0">${[["build","Construire"],["train","S'entraîner"],["statuts","Statuts"]].filter(x=>usage!=="ci"||x[0]!=="train").map(([k,l])=>`<button data-rt="${k}" aria-pressed="${k===radioTab}">${l}</button>`).join("")}</div>`;
 let body="";
 if(radioTab==="build")body=`<div class="list">${Object.entries(RB).map(([k,b])=>`<button class="row" data-rb="${k}"><span class="ic" style="background:${b.c}">${k==="rentree"?I.doc:k==="danger"?I.siren:RADIO_IC}</span><span class="tx"><b>${esc(b.t)}</b><span>${esc(b.s)}</span></span><span class="chev">${I.chev}</span></button>`).join("")}</div>
   <div class="card" style="margin-top:14px"><b>Règles d'or</b><ul class="rrules"><li>Fréquence <b>SGAP-OPS</b> du groupement où tu te trouves.</li><li>Vérifie qu'aucun échange n'est en cours avant de transmettre.</li><li>Appuie sur la pédale, attends environ <b>3 secondes</b> (relais) puis parle.</li><li>Interlocuteur principal : le CSO (« Golf »). Radio en panne : téléphone au CSO, à défaut au PVO.</li><li>La victime d'abord : mieux vaut un message imparfait qu'une victime délaissée.</li></ul><button class="srcbtn" data-gp="8">${I.doc}<span>Guide pratique CI, p. 8-16</span></button></div>`;
 else if(radioTab==="train"){const st=store.get("radioBest",null);
  const bb=store.get("radioBuildBest",null);
  body=`<div class="card"><h2 style="font-size:20px;margin:0 0 6px">Construis le message</h2><p class="small" style="margin:0 0 12px">Remets les morceaux du message radio dans le bon ordre : appel, demande de moyens, renseignement, statuts, message de rentrée… Idéal pour débuter.</p>
   ${bb!=null?`<p class="small" style="margin:0 0 12px">Ton record : <b>${bb}/8</b></p>`:""}<button class="btn full" id="buildGo">Jouer</button></div>
   <div class="card" style="margin-top:12px"><h2 style="font-size:20px;margin:0 0 6px">Simulateur radio</h2><p class="small" style="margin:0 0 12px">10 situations tirées au hasard : statut à passer, moyen à demander, bon message à transmettre, réponse au CSO, CRI… Chaque bonne réponse rapporte des points au classement.</p>
   ${st!=null?`<p class="small" style="margin:0 0 12px">Ton record : <b>${st}/10</b></p>`:""}<button class="btn full" id="simGo">Commencer</button></div>
   <div class="card" style="margin-top:12px"><b>Écouter les messages</b><p class="small" style="margin:6px 0 0">Dans le constructeur et le simulateur, le bouton « Écouter » lit le message à voix haute : pratique pour s'habituer au rythme de la phonie.</p></div>`}
 else body=`<div class="list">${STATUTS.map(s=>`<div class="row"><span class="stc ${["3","4"].includes(s[0])?"off":""}">${s[0]}</span><span class="tx"><b>${esc(s[1])}</b><span>${esc(s[2])}</span></span></div>`).join("")}</div>
   <div class="sect">Équivalents en phonie</div><div class="list">${Object.entries(ROUT).map(([k,R])=>`<div class="row"><span class="stc">${k}</span><span class="tx"><b>${esc(R.l)}</b><span>${k==="9"?"Pas de message en phonie.":esc(R.ph().replace("{motif}","(tel motif)").replace("{adresse}","(telle adresse)").replace("{hopital}","(nom de l'hôpital)"))}${R.r?"<br>PVO : « "+esc(R.r())+" »":""}</span></span></div>`).join("")}</div>
   <p class="small" style="margin:8px 4px 0">Statut 25 puis 7 toujours passés. Hors secteur : le 7 une fois revenu sur le secteur.</p>
   <div style="display:flex;gap:14px;flex-wrap:wrap"><button class="srcbtn" data-gp="9">${I.doc}<span>Routine, p. 9-10</span></button><button class="srcbtn" data-gp="49">${I.doc}<span>Annexe statuts ANTARES, p. 49</span></button></div>`;
 app.innerHTML=head+body+`<footer class="note">Modèles issus du Guide pratique CI (p. 8-20, 35-36, 49-50). Les pratiques varient selon les groupements : en cas de doute, demande au PVO ou au sergent de jour. Le référentiel en vigueur fait foi.</footer>`;
 bindTabBack();$("#ridEdit").onclick=()=>indicSheet();
 app.querySelectorAll("[data-rt]").forEach(b=>b.onclick=()=>{radioTab=b.dataset.rt;store.set("radioTab",radioTab);viewRadio()});
 app.querySelectorAll("[data-rb]").forEach(b=>b.onclick=()=>runBuilder(b.dataset.rb));
 app.querySelectorAll("[data-gp]").forEach(b=>b.onclick=()=>openDoc("guide",+b.dataset.gp,["message","radio"]));
 const sg=$("#simGo");if(sg)sg.onclick=runRadioSim;const bg=$("#buildGo");if(bg)bg.onclick=()=>runRadioBuild();
 if(!radioId.num&&!store.get("ridAsked",false)){store.set("ridAsked",true);indicSheet()}
}
function phonieHtml(r,pvo){if(!r.lines.length)return "";
 return `<div class="phon">${r.lines.map(([w,t])=>`<div class="ln ${w==="CRF"?"me":"them"}"><span class="who">${w==="CRF"?(pvo?"Toi → PVO":"Toi"):w==="CSO"?esc(rGolf())+" (CSO)":"PVO"}</span><p>${esc(t).replace(/\n/g,"<br>")}</p></div>`).join("")}</div>`}
const rTextOf=r=>r.lines.filter(l=>l[0]==="CRF").map(l=>l[1]).join("\n");
function runBuilder(key){const B=RB[key];const saved=store.get("rb_"+key,{});const f={};B.fields.forEach(x=>{f[x.k]=saved[x.k]!==undefined?saved[x.k]:x.d!==undefined?(Array.isArray(x.d)?x.d.slice():x.d):""});
 cleanup=stopSpeak;
 const save=()=>{const o={};B.fields.forEach(x=>{if(x.t!=="cri"&&!/adresse|lieu|id$|a$|mil$/.test(x.k))o[x.k]=f[x.k]});o.cri=f.cri;store.set("rb_"+key,o)};
 const out=()=>{const r=B.build(f);const el=$("#rbOut");if(!el)return;
  el.innerHTML=`${r.big?`<div class="stbig"><span class="stc">${esc(r.big)}</span><span>Statut ${esc(r.big)} · ${esc((ROUT[r.big]||{}).l||"")}</span></div>`:""}${phonieHtml(r,r.pvo)}
   ${r.lines.length?`<div class="actions"><button class="btn" id="rbSpeak">${SPK} Écouter</button><button class="btn sec" id="rbCopy">Copier</button></div>`:""}
   ${r.notes.length?`<div class="rnotes">${r.notes.map(n=>`<p>${n}</p>`).join("")}</div>`:""}<button class="srcbtn" id="rbSrc">${I.doc}<span>Guide pratique CI, p. ${B.p}</span></button>`;
  const sp=$("#rbSpeak");if(sp)sp.onclick=()=>speak(rTextOf(r));
  const cp=$("#rbCopy");if(cp)cp.onclick=async()=>{try{await navigator.clipboard.writeText(r.lines.map(l=>l[0]+" : "+l[1]).join("\n"));toast("Message copié.")}catch(e){toast("Copie impossible.")}};
  $("#rbSrc").onclick=()=>openDoc("guide",B.p,["message"])};
 const draw=()=>{const fh=B.fields.filter(x=>!x.show||x.show(f)).map(x=>{const id="rf_"+x.k;
   if(x.t==="seg")return `<label>${esc(x.l)}</label><div class="seg rseg">${x.o.map(([v,l])=>`<button type="button" data-fs="${x.k}" data-v="${esc(v)}" aria-pressed="${f[x.k]===v}">${esc(l)}</button>`).join("")}</div>`;
   if(x.t==="multi")return `<label>${esc(x.l)}</label><div class="chips wrap">${x.o.map(([v,l])=>`<button type="button" class="chip" data-fm="${x.k}" data-v="${esc(v)}" aria-pressed="${(f[x.k]||[]).includes(v)}">${esc(l)}</button>`).join("")}</div>`;
   if(x.t==="toggle")return `<label class="tg"><input type="checkbox" data-ft="${x.k}" ${f[x.k]?"checked":""}><span>${esc(x.l)}</span></label>`;
   if(x.t==="cri"){const c=f.cri?CRI.find(z=>z[0]===f.cri):null;return `<label>${esc(x.l)}</label><button type="button" class="row crisel" id="criPick"><span class="crc">${c?esc(c[0]):"CRI"}</span><span class="tx"><b>${c?esc(c[1]):"Choisir le code retour intervention"}</b><span>Recherche par mots-clés, comme dans « Codes CRI »</span></span><span class="chev">${I.chev}</span></button>`}
   const sg=x.sugg?x.sugg(f):null;
   return `<label for="${id}">${esc(x.l)}</label><input id="${id}" data-fi="${x.k}" ${x.t==="num"?'inputmode="numeric" type="number" min="0" max="99"':""} placeholder="${esc(x.ph||"")}" value="${esc(f[x.k]||"")}" ${sg&&sg.length?`list="dl_${x.k}"`:""} autocomplete="off">${sg&&sg.length?`<datalist id="dl_${x.k}">${[...new Set(sg)].map(s=>`<option value="${esc(s)}">`).join("")}</datalist><div class="chips sug">${[...new Set(sg)].slice(0,8).map(s=>`<button type="button" class="chip" data-fsg="${x.k}">${esc(s)}</button>`).join("")}</div>`:""}`}).join("");
  app.innerHTML=push(B.t)+`${radioId.num?"":`<div class="card rid"><span class="small">Renseigne ton indicatif pour préremplir les messages.</span><button class="btn small sec" id="ridEdit">Renseigner</button></div>`}
   <form class="form rform" id="rbF" onsubmit="return false">${fh}</form><div class="sect">Message</div><div id="rbOut"></div>`;
  bindBack(()=>{stopSpeak();go("radio")});out();
  const re=$("#ridEdit");if(re)re.onclick=()=>indicSheet(draw);
  app.querySelectorAll("[data-fs]").forEach(b=>b.onclick=()=>{f[b.dataset.fs]=b.dataset.v;save();keep(draw)});
  app.querySelectorAll("[data-fm]").forEach(b=>b.onclick=()=>{const k=b.dataset.fm,v=b.dataset.v;const a=f[k]||[];f[k]=a.includes(v)?a.filter(z=>z!==v):[...a,v];save();keep(draw)});
  app.querySelectorAll("[data-ft]").forEach(b=>b.onchange=()=>{f[b.dataset.ft]=b.checked;save();keep(draw)});
  app.querySelectorAll("[data-fi]").forEach(b=>b.oninput=()=>{f[b.dataset.fi]=b.value;save();out()});
  app.querySelectorAll("[data-fsg]").forEach(b=>b.onclick=()=>{f[b.dataset.fsg]=b.textContent;save();keep(draw)});
  const cpk=$("#criPick");if(cpk)cpk.onclick=()=>criPicker(c=>{f.cri=c;save();keep(draw)})};
 const keep=fn=>{const y=window.scrollY;fn();window.scrollTo(0,y)};
 draw();window.scrollTo(0,0)}
const SPK='<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5 6 9H3v6h3l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13"/></svg>';
function criPicker(cb){let q="";sheet(`<h2>Code CRI</h2><input class="search" id="cpq" type="search" placeholder="ex. chute, malaise, ivresse, annulée, 356…"><div id="cpl" style="margin-top:10px;max-height:52vh;overflow:auto"></div>`);
 const draw=()=>{let list=CRI;if(q.trim()){const sc=CRI.map(c=>[criScore(c,q),c]).filter(x=>x[0]>0).sort((a,b)=>b[0]-a[0]);const top=sc.length?sc[0][0]:0;list=sc.filter(x=>x[0]>=Math.max(2,top*.5)).map(x=>x[1])}
  else{const C=["310","356","320","399","343","004","919","SEC"];list=C.map(k=>CRI.find(c=>c[0]===k)).filter(Boolean).concat(CRI.filter(c=>!C.includes(c[0])))}
  $("#cpl").innerHTML=`<div class="list">${list.slice(0,60).map(c=>`<button class="row" data-cp="${esc(c[0])}"><span class="crc">${esc(c[0])}</span><span class="tx"><b>${esc(c[1])}</b>${c[3]?`<span>${esc(c[3])}</span>`:""}</span></button>`).join("")||`<div class="row"><span class="tx"><span>Aucun code trouvé.</span></span></div>`}</div>`;
  $("#cpl").querySelectorAll("[data-cp]").forEach(b=>b.onclick=()=>{closeSheet();cb(b.dataset.cp)})};
 draw();let to;$("#cpq").oninput=e=>{q=e.target.value;clearTimeout(to);to=setTimeout(draw,120)}}

/* ---- Jeu « Construis le message » : remettre les morceaux d'un message radio dans l'ordre ---- */
// indicatif utilisé dans le jeu : le tien s'il est renseigné, sinon un indicatif d'exemple complet (jamais de « XXX »)
function gameRid(){const ex=!radioId.num||!radioId.cs;let golf=radioId.golf;if(!golf&&radioId.cs&&typeof SECT!=="undefined"&&SECT){const s=SECT.sect.find(x=>norm(x.name)===norm(radioId.cs));if(s)golf=s.golf}
 return ex?{num:radioId.num||"321",cs:radioId.cs||"Plaisance",golf:golf||(radioId.cs?"X":"3"),ex:true}:{num:radioId.num,cs:radioId.cs,golf:golf||"X",ex:false}}
let rbAsked=false;
function buildScenarios(){const R=gameRid();const me_=`Croix-Rouge française ${R.num} de ${R.cs}`,g=`Golf ${R.golf}`,h=rHour(),num=R.num;const A=pick(R_ADR),H=pick(R_HOP);
 return [
 {id:"appel",sit:`Tu veux appeler le CSO de ton groupement (${g}).`,parts:[g,`ici la ${me_},`,"parlez."],e:"On appelle d'abord son interlocuteur (le Golf), on s'annonce, puis « parlez » pour lui donner la parole.",p:10},
 {id:"depart",sit:`Mode dégradé : tu dois annoncer ton départ pour un malaise au ${A}.`,parts:[`${g},`,`la ${me_}`,"partie","pour malaise,",`${A}.`],e:"Statut 1 en phonie : Golf, indicatif, « partie », le motif puis l'adresse.",p:9},
 {id:"presente",sit:"Mode dégradé : tu arrives sur les lieux.",parts:[`${g},`,`la ${me_}`,"se présente."],e:"Statut 2 en phonie : Golf, ton indicatif, « se présente ».",p:9},
 {id:"hopital",sit:`Tu pars vers l'hôpital ${H} avec la victime (mode dégradé).`,parts:[`${g},`,`la ${me_}`,"se dirige vers l'hôpital",`${H}.`],e:"Statut 5 en phonie : « se dirige vers l'hôpital » + nom de l'hôpital.",p:9},
 {id:"police",sit:`Une personne en état d'ébriété sur la voie publique au ${A} : tu demandes la police.`,parts:[`De la ${me_},`,"je demande Police,",`${A},`,"voie publique,","personne en état d'ébriété,",`${g} parlez.`],e:"Règle SAM : Service (Police), Adresse, Motif, puis « Golf, parlez ».",p:10},
 {id:"ep",sit:`Porte fermée, victime qui ne répond pas au ${A} : tu demandes un engin pompe et la police.`,parts:[`De la ${me_},`,"je demande un engin pompe","et Police,",`${A},`,"ouverture de porte,",`${g} parlez.`],e:"Les moyens BSPP passent avant les services publics, puis l'adresse et le motif.",p:10},
 {id:"rens",sit:`Homme en arrêt cardio-respiratoire au ${A}, tu attends l'équipe médicale.`,parts:[`De la ${me_},`,"secours à un homme en arrêt cardio-respiratoire,","urgence absolue,",`${A},`,"et attendons équipe médicale,",`${g} parlez.`],e:"Message de renseignement : nature, urgence, adresse, puis « et attendons équipe médicale ».",p:13},
 {id:"pres",sit:"La police que tu avais demandée arrive sur place.",parts:[`De la ${me_} :`,"la police se présente.",`${g} parlez.`],e:"Principe du tiroir : on présente le moyen non BSPP qu'on avait demandé.",p:12},
 {id:"trafic",sit:`Tu es bloqué dans la circulation place de Clichy et ne pourras pas arriver à temps au ${A}.`,parts:[`De la ${me_} :`,"faites partir un autre engin",`${A}`,"pour malaise ;",`${me_} bloquée dans la circulation`,"place de Clichy,",`${g} parlez.`],e:"On demande un autre engin pour l'intervention, puis on signale où l'on est bloqué.",p:20},
 {id:"collation",sit:`Le CSO collationne ta demande de police : « … message reçu à ${h} ». Que réponds-tu ?`,parts:[`${h},`,"correct,","et attendons."],e:"Service public seul : on confirme l'heure, « correct », « et attendons ».",p:10},
 {id:"rentree",sit:`Message de rentrée au PVO : bilan avec contact médecin, homme de 45 ans UR transporté au SAU ${H.replace(/^Hôpital /,"")}, pas de dégâts, maladie.`,parts:["1/ Bilan, contact médecin coordinateur",`2/ Un homme de 45 ans, UR, transporté par CRF ${num} vers SAU ${H.replace(/^Hôpital /,"")}`,"5/ Néant","CRI 320"],e:"Les points dans l'ordre (1 actions, 2 victimes, 5 dégâts), puis le CRI.",p:35},
 {id:"danger",sit:"Une personne seule devient agressive envers ton équipage : tu demandes la police.",parts:[`De la ${me_},`,"je demande Police,",`${A},`,"personne agressive envers les secours,",`${g} parlez.`],e:"Les mots choisis comptent : « personne agressive envers les secours » déclenche une patrouille.",p:15}]}
function runRadioBuild(back){back=back||(()=>{radioTab="train";store.set("radioTab","train");go("radio")});
 if((!radioId.num||!radioId.cs)&&!rbAsked){rbAsked=true;indicSheet(()=>runRadioBuild(back));const f=$("#ridF");if(f){const t=document.createElement("p");t.className="small";t.style.margin="4px 0 0";t.textContent="Renseigne ton indicatif : le jeu l'utilisera dans tous les messages.";f.prepend(t);const b=document.createElement("button");b.type="button";b.className="btn sec full";b.textContent="Plus tard : jouer avec l'indicatif d'exemple";b.onclick=()=>{closeSheet();runRadioBuild(back)};f.appendChild(b)}return}
 const all=buildScenarios();const qs=fresh(all.map(x=>({...x,_id:"s:rb:"+x.id}))).slice(0,8);let i=0,score=0;cleanup=stopSpeak;
 const show=()=>{const q=qs[i];const pool=shuffle(q.parts.map((t,k)=>({t,k})));const chosen=[];let done=false;
  const draw=()=>{app.innerHTML=push("Construis le message",`${i+1}/${qs.length}`)+`<div class="bar"><i style="width:${i/qs.length*100}%"></i></div>
    <div class="qhead"><span class="qtag">Jeu radio${gameRid().ex?" · indicatif d'exemple":""}</span></div><p class="qtext rbsit">${esc(q.sit)}</p>
    <div class="sect" style="margin-top:6px">Ton message</div><div class="rbmsg ${done?(chosen.map(c=>c.t).join("|")===q.parts.join("|")?"good":"bad"):""}">${chosen.length?chosen.map((c,j)=>`<button class="rbp in" data-out="${j}" ${done?"disabled":""}>${esc(c.t)}</button>`).join(""):`<span class="small">Touche les morceaux ci-dessous dans le bon ordre.</span>`}</div>
    ${done?"":`<div class="sect">Morceaux</div><div class="rbpool">${pool.map((p,j)=>chosen.includes(p)?"":`<button class="rbp" data-in="${j}">${esc(p.t)}</button>`).join("")}</div>
    <div class="actions"><button class="btn sec" id="rbHint">Indice</button><button class="btn" id="rbOk" ${chosen.length===q.parts.length?"":"disabled"} style="flex:1">Valider</button></div>`}<div id="after"></div>`;
   bindBack(()=>{stopSpeak();back()});
   app.querySelectorAll("[data-in]").forEach(b=>b.onclick=()=>{chosen.push(pool[+b.dataset.in]);draw()});
   app.querySelectorAll("[data-out]").forEach(b=>b.onclick=()=>{chosen.splice(+b.dataset.out,1);draw()});
   const hi=$("#rbHint");if(hi)hi.onclick=()=>{let n=0;while(n<chosen.length&&chosen[n].k===n)n++;chosen.length=n;const nx=pool.find(p=>p.k===n);if(nx)chosen.push(nx);toast("Le morceau suivant est placé.");draw()};
   const ok=$("#rbOk");if(ok)ok.onclick=()=>{done=true;const good=chosen.map(c=>c.t).join("|")===q.parts.join("|");if(good)score++;record(q._id,good);draw();
    const full=q.parts.join(" ");$("#after").innerHTML=`<div class="fb ${good?"good":"bad"}"><b>${cheer(good)}</b>${good?"":`<div class="rbright">${esc(full)}</div>`}${esc(q.e)}
     <div style="display:flex;gap:14px;flex-wrap:wrap"><button class="srcbtn" id="say">${SPK}<span>Écouter</span></button><button class="srcbtn" id="gsrc">${I.doc}<span>Guide pratique CI, p. ${q.p}</span></button></div></div>
     <div class="actions"><button class="btn full" id="next">${i+1<qs.length?"Message suivant":"Voir le score"}</button></div>`;
    $("#say").onclick=()=>speak(full);$("#gsrc").onclick=()=>openDoc("guide",q.p,["message"]);
    const n=$("#next");n.onclick=()=>{stopSpeak();i++;i<qs.length?show():end()};n.scrollIntoView({behavior:"smooth",block:"nearest"})}};
  draw()};
 const end=()=>{const b=store.get("radioBuildBest",null);if(b==null||score>b)store.set("radioBuildBest",score);setTimeout(syncSoon,50);
  app.innerHTML=push("Résultat")+`<div class="result"><div class="score">${score}/${qs.length}</div><div class="grade">${grade(score/qs.length*100)}</div><p class="small">messages parfaitement construits · +${score*5} points</p></div>
   <div class="actions"><button class="btn" id="again">Rejouer</button><button class="btn sec" id="toB">Constructeur</button></div>`;
  bindBack(back);$("#again").onclick=()=>runRadioBuild(back);$("#toB").onclick=()=>{radioTab="build";store.set("radioTab","build");go("radio")};window.scrollTo(0,0)};
 show()}

/* ---- Simulateur ---- */
const R_ADR=["12 rue Ordener","4 rue Edmond Rousse","30 quai de la Rapée","2 boulevard Barbès","15 avenue de Clichy","8 place de la Nation","40 rue Marcadet","1 rue de Rivoli"];
const R_HOP=["Lariboisière","Bichat","Pitié-Salpêtrière","Saint-Antoine","Cochin","Hôpital européen Georges-Pompidou"];
const pick=a=>a[Math.floor(Math.random()*a.length)];
function radioQuestions(){const Q=[];const me=rMe(),g=rGolf();
 // 1. statut à passer
 const sk=pick(["1","2","5","6","25","7","9"]);Q.push({id:"st"+sk,q:`Situation : ${ROUT[sk].q} Quel statut passes-tu ?`,o:[sk,...shuffle(["1","2","5","6","25","7","9","8"].filter(x=>x!==sk)).slice(0,3)].map(x=>`Statut ${x}`),a:0,e:`Statut ${sk} : ${ROUT[sk].l}.${sk==="25"?" Puis 7 (sur ton secteur) ou une fois revenu sur le secteur.":""}`,p:sk==="9"?49:9,say:ROUT[sk].ph().replace("{motif}","malaise").replace("{adresse}",pick(R_ADR)).replace("{hopital}",pick(R_HOP))});
 // 2. hors secteur
 Q.push({id:"st25hs",q:"Tu sors d'un hôpital qui n'est pas sur ton secteur. Que passes-tu ?",o:["25 en sortant, puis 7 une fois revenu sur ton secteur","7 directement en sortant","25 puis 7 dans la foulée","Aucun statut jusqu'au retour au CS"],a:0,e:"Hors secteur : 25 pour indiquer que tu rentres, 7 une fois revenu sur le secteur. Les deux statuts sont toujours passés.",p:10});
 // 3. moyen à demander
 const pool2=MOYENS.filter(m=>!["vsav","desinc","comp","gir"].includes(m.k));const mm=pick(pool2);const mot=pick(mm.m);
 Q.push({id:"moy"+mm.k,q:`Motif : « ${mot} ». Quel moyen demandes-tu ?`,o:[mm.c,...shuffle(pool2.filter(x=>x.k!==mm.k&&!x.m.includes(mot))).slice(0,3).map(x=>x.c)],a:0,e:`${mm.c}${mm.w?" : "+mm.w:"."}`,p:mm.k==="gic"||mm.k==="vtba"||mm.k==="em"||mm.k==="comp"?12:11});
 // 4. bon message SAM
 const adr=pick(R_ADR);const ok=`De la ${me}, je demande un engin pompe et Police, ${adr}, voie publique, accident de la circulation, ${g} parlez.`;
 Q.push({id:"sam1",q:"Accident de la circulation sur la voie publique : tu veux un engin pompe et la police. Quel message transmets-tu ?",o:[ok,`De la ${me}, je demande Police et un engin pompe, ${adr}, voie publique, accident de la circulation, ${g} parlez.`,`De la ${me}, accident de la circulation, je demande un engin pompe et Police, ${g} terminé.`,`URGENT, ${g}, ici la ${me}, envoyez un engin pompe et la Police, ${adr}.`],a:0,e:"Règle SAM (Service, Adresse, Motif). Les moyens BSPP en premier, puis les services publics. On termine par « Golf, parlez ».",p:10,say:ok});
 // 5. réponse au CSO
 const hh=rHour();const c5=pick([{cso:`${me}, vous demandez Police, ${adr}, personne en état d'ébriété sur la voie publique, message reçu à ${hh}.`,a:`${hh}, correct, et attendons.`,e:"Service public seul : tu confirmes l'heure et « correct, et attendons »."},{cso:"Je vous rends compte que l'engin pompe de Montmartre a été sonné.",a:"Reçu, et attendons.",e:"Pour un engin BSPP, le CSO rend compte de l'engin sonné : « Reçu, et attendons »."}]);
 Q.push({id:"cso"+(c5.a.startsWith("Reçu")?"b":"p"),q:`Le CSO te répond : « ${c5.cso} » Que réponds-tu ?`,o:[c5.a,...shuffle([`${g}, bien reçu, terminé.`,"Négatif, parlez.","Transmettez.",c5.a.startsWith("Reçu")?`${hh}, correct, et attendons.`:"Reçu, et attendons."].filter(x=>x!==c5.a)).slice(0,3)],a:0,e:c5.e,p:10,say:c5.a});
 // 6. équipage en danger
 const fo=Math.random()<.5;Q.push({id:"dg"+(fo?"f":"a"),q:fo?"Un attroupement hostile, plus nombreux que l'équipage, vous menace. Quels mots emploies-tu ?":"Une personne seule devient agressive envers l'équipage. Quels mots emploies-tu ?",o:fo?["Équipage pris à partie par la foule","Personne agressive envers les secours","Rixe sur la voie publique","Troubles de l'ordre public"]:["Personne agressive envers les secours","Équipage pris à partie par la foule","Agression envers une victime","Différend familial"],a:0,e:"Les termes fixent les effectifs : « personne agressive » = une patrouille (3 policiers) ; « pris à partie par la foule » = plusieurs patrouilles équipées. Un engin pompe peut être ajouté.",p:15});
 // 7. tiroir
 Q.push({id:"tiroir",q:"Tu as demandé la police, elle arrive sur les lieux. Que dois-tu faire ?",o:["La présenter au CSO (« La police se présente »)","Rien, la police se présente elle-même","Passer le statut 2","Le signaler uniquement dans le message de rentrée"],a:0,e:"Principe du tiroir : un moyen non BSPP demandé doit être présenté (dès son arrivée ou en fin d'intervention). Les engins BSPP se présentent eux-mêmes.",p:12,say:`De la ${me} : la police se présente. ${g} parlez.`});
 // 8. CRI
 const cr=pick([["Intervention annulée par le centre opérationnel","004"],["Pas de victime trouvée malgré la confirmation d'appel et d'adresse","919"],["Renfort brancardage pour un autre engin","SEC"],["Personne âgée tombée chez elle, transportée","356"],["Malaise d'un homme dans la rue, transporté","320"],["Homme en état d'ivresse sur la voie publique","310"]]);
 Q.push({id:"cri"+cr[1],q:`Message de rentrée — « ${cr[0]} ». Quel CRI ?`,o:[cr[1],...shuffle(["004","919","SEC","356","320","310","399","343"].filter(x=>x!==cr[1])).slice(0,3)].map(x=>"CRI "+x),a:0,e:`CRI ${cr[1]} : ${(CRI.find(c=>c[0]===cr[1])||[0,""])[1]}.`,p:cr[1]==="356"||cr[1]==="320"?36:50});
 // 9. points du message de rentrée
 Q.push({id:"rentree15",q:"Pour un moyen associatif, quels points du message de rentrée sont systématiquement remplis ?",o:["1 et 5","1 et 2","1, 2 et 3","2 et 5"],a:0,e:"Points 1 (actions) et 5 (dégâts) systématiques ; 2 si victime prise en charge ; 3, 6 et 7 parfois.",p:35});
 // 10. URGENT / divers
 Q.push(pick([{id:"relais",q:"Après avoir appuyé sur la pédale d'émission, quand commences-tu à parler ?",o:["Après environ 3 secondes (déclenchement du relais)","Immédiatement","Après le bip du CSO","Après 10 secondes"],a:0,e:"Attends le déclenchement du relais (environ 3 s), sinon le début du message est tronqué.",p:8},
  {id:"annul",q:"Tu commences une demande de police mais elle se présente à l'instant. Que dis-tu ?",o:[`${g}, annulez la transmission.`,"Correction, lire néant.",`${g}, terminé.`,"Négatif, parlez."],a:0,e:"« Golf X, annulez la transmission » interrompt un message devenu inutile.",p:15},
  {id:"urgent",q:"Quand un équipage CRf utilise-t-il « URGENT, URGENT, URGENT » ?",o:["Situation purement exceptionnelle : message urgent et prioritaire","Pour toute demande de moyens","Pour chaque ACR","Jamais, c'est réservé au CSO"],a:0,e:"Le message urgent permet de transmettre alors qu'un échange est en cours ; pour un équipage CRf c'est purement exceptionnel.",p:8},
  {id:"bloque",q:"Tu es bloqué dans la circulation et ne pourras pas arriver dans les délais. Que fais-tu ?",o:["Je demande au CSO de faire partir un autre engin et je continue vers l'intervention","Je passe le statut 7","Je fais demi-tour vers le CS","J'attends que le PVO m'appelle"],a:0,e:"« Faites partir un autre engin… bloquée dans la circulation » : la mission reste en cours, tu dois t'y rendre.",p:20}]));
 return shuffle(Q).map(q=>{const o=q.o.map((t,i)=>({t,ok:i===q.a}));const s=shuffle(o);return{...q,o:s.map(x=>x.t),a:s.findIndex(x=>x.ok)}})}
function runRadioSim(){const qs=radioQuestions();let i=0,score=0;cleanup=stopSpeak;
 const show=()=>{const q=qs[i];
  app.innerHTML=push("Simulateur radio",`${i+1}/${qs.length}`)+`<div class="bar"><i style="width:${i/qs.length*100}%"></i></div><div class="qhead"><span class="qtag">Messages radio</span></div><p class="qtext">${esc(q.q)}</p>
   <div class="opts">${q.o.map((c,k)=>`<button class="opt" data-k="${k}"><span class="k">${LETTERS[k]}</span><span>${esc(c)}</span></button>`).join("")}</div><div id="after"></div>`;
  bindBack(()=>{stopSpeak();go("radio")});
  app.querySelectorAll(".opt").forEach(b=>b.onclick=()=>{const k=+b.dataset.k,ok=k===q.a;if(ok)score++;record("radio:"+q.id,ok);if(navigator.vibrate)navigator.vibrate(ok?15:[30,40,30]);
   app.querySelectorAll(".opt").forEach(o=>{o.disabled=true;if(+o.dataset.k===q.a)o.classList.add("good");else if(o===b)o.classList.add("bad")});
   const say=q.say||(q.o[q.a].length>40?q.o[q.a]:"");
   $("#after").innerHTML=`<div class="fb ${ok?"good":"bad"}"><b>${cheer(ok)}</b>${esc(q.e)}<div style="display:flex;gap:14px;flex-wrap:wrap">${say?`<button class="srcbtn" id="say">${SPK}<span>Écouter</span></button>`:""}<button class="srcbtn" id="gsrc">${I.doc}<span>Guide pratique CI, p. ${q.p}</span></button></div></div><div class="actions"><button class="btn full" id="next">${i+1<qs.length?"Situation suivante":"Voir le score"}</button></div>`;
   const sy=$("#say");if(sy)sy.onclick=()=>speak(say);$("#gsrc").onclick=()=>openDoc("guide",q.p,["message"]);
   const n=$("#next");n.onclick=()=>{stopSpeak();i++;i<qs.length?show():end()};n.scrollIntoView({behavior:"smooth",block:"nearest"})})};
 const end=()=>{const b=store.get("radioBest",null);if(b==null||score>b)store.set("radioBest",score);setTimeout(syncSoon,50);
  app.innerHTML=push("Résultat")+`<div class="result"><div class="score">${score}/${qs.length}</div><div class="grade">${grade(score*10)}</div><p class="small">Situations radio réussies.</p></div><div class="actions"><button class="btn" id="again">Nouvelle série</button><button class="btn sec" id="toB">Constructeur</button></div>`;
  bindBack(()=>go("radio"));$("#again").onclick=runRadioSim;$("#toB").onclick=()=>{radioTab="build";store.set("radioTab","build");go("radio")};window.scrollTo(0,0)};
 show()}

/* ============ Carte des CS et secteurs ============ */
const MAP_IC='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M9 4 3 6.5v13.5l6-2.5 6 2.5 6-2.5V4l-6 2.5z"/><path d="M9 4v13.5M15 6.5V20"/></svg>';
const GCOL={"1":"#e3051b","2":"#0a84ff","3":"#1f9d55"};
let SECT=null,SECTp=null,leafP=null,cartMap=null,carteTab=store.get("carteTab","map"),carteG="all",carteSel=null;
function loadSect(){if(SECT)return Promise.resolve(SECT);if(SECTp)return SECTp;SECTp=fetch("secteurs.json").then(r=>{if(!r.ok)throw 0;return r.json()}).then(j=>{SECT=j;SECT.by=Object.fromEntries(j.sect.map(s=>[s.code,s]));return SECT}).catch(e=>{SECTp=null;throw e});return SECTp}
function loadLeaflet(){if(window.L)return Promise.resolve(window.L);if(leafP)return leafP;
 leafP=new Promise((res,rej)=>{const l=document.createElement("link");l.rel="stylesheet";l.href="leaflet/leaflet.css";document.head.appendChild(l);
  const s=document.createElement("script");s.src="leaflet/leaflet.js";s.onload=()=>res(window.L);s.onerror=()=>{leafP=null;rej()};document.head.appendChild(s)});return leafP}
function inPoly(ll,ring){let x=ll[1],y=ll[0],ins=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){const xi=ring[i][1],yi=ring[i][0],xj=ring[j][1],yj=ring[j][0];if(((yi>y)!==(yj>y))&&(x<(xj-xi)*(y-yi)/(yj-yi)+xi))ins=!ins}return ins}
const sectAt=ll=>SECT.sect.find(s=>inPoly(ll,s.poly))||null;
const csName=s=>`${s.name} (${s.code})`;
const mapsUrl=a=>(isIOS()?"https://maps.apple.com/?q=":"https://www.google.com/maps/search/?api=1&query=")+encodeURIComponent(a);
const PIN='<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/></svg>';
const PHONE='<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z"/></svg>';
const telHtml=x=>x.tel?`<a class="cadr" href="tel:${x.tel.replace(/\s/g,"")}">${PHONE}<span>PVO ${esc(x.code)} · ${esc(x.tel)}<small>Appeler</small></span></a>`:"";
const adrHtml=x=>x.adr?`<a class="cadr" href="${mapsUrl(x.adr)}" target="_blank" rel="noopener">${PIN}<span>${esc(x.adr)}<small>Itinéraire</small></span></a>`:"";
function makeMap(el,opts={}){const L=window.L;const dark=window.matchMedia("(prefers-color-scheme: dark)").matches;
 const m=L.map(el,{zoomControl:false,attributionControl:true,minZoom:11,maxZoom:18}).setView([48.858,2.345],12);
 // fonds de carte : OpenStreetMap, puis Esri si les tuiles ne se chargent pas (CARTO exige désormais une clé)
 const OSM='© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';
 const BASES=[["https://tile.openstreetmap.org/{z}/{x}/{y}.png",{attribution:OSM,className:dark?"tiles-dark":""}],
  ["https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}",{attribution:"Fond © Esri",className:dark?"tiles-dark":""}]];
 let bi=Math.max(0,Math.min(BASES.length-1,+(store.get("mapBase2",0))||0)),base=null;
 const useBase=i=>{if(base)m.removeLayer(base);let ok=0,ko=0;const[u,o]=BASES[i];base=L.tileLayer(u,{maxZoom:19,...o,attribution:o.attribution+" · secteurs : uMap"}).addTo(m);base.bringToBack();
  base.on("tileload",()=>{if(!ok++)store.set("mapBase2",i)});
  base.on("tileerror",()=>{ko++;if(!ok&&ko>=3){if(i+1<BASES.length)useBase(i+1);else{store.del("mapBase2");toast("Fond de carte indisponible : vérifie ta connexion ou désactive le bloqueur de contenu.")}}})};
 useBase(bi);
 L.control.zoom({position:"bottomright"}).addTo(m);
 const layers={};
 SECT.sect.forEach(s=>{const col=GCOL[s.golf]||"#8e8e93";
  const pg=L.polygon(s.poly,{color:col,weight:1.6,fillColor:col,fillOpacity:opts.quiz?.08:.13}).addTo(m);
  if(!opts.quiz){pg.bindTooltip(s.code,{permanent:true,direction:"center",className:"sectlbl"});
   L.circleMarker(s.ll,{radius:5,color:"#fff",weight:2,fillColor:col,fillOpacity:1}).addTo(m).on("click",()=>opts.onPick&&opts.onPick(s))}
  pg.on("click",e=>opts.onPick&&opts.onPick(s,e));layers[s.code]=pg});
 if(!opts.quiz)(SECT.extra||[]).forEach(x=>L.circleMarker(x.ll,{radius:5,color:"#fff",weight:2,fillColor:GCOL[x.golf]||"#8e8e93",fillOpacity:1}).addTo(m).on("click",()=>opts.onPick&&opts.onPick(x)));
 m.fitBounds(L.featureGroup(Object.values(layers)).getBounds(),{padding:[8,8]});
 return{m,layers}}
function styleSect(layers,fn){Object.entries(layers).forEach(([c,l])=>{const s=SECT.by[c];const col=GCOL[s.golf];l.setStyle(fn(s,col))})}

function viewCarte(){if(usage==="ci"&&carteTab==="quiz")carteTab="map";
 const head=`${backLink()}<h1 class="big">${carteTab==="hosp"?"Hôpitaux":"Carte des secteurs"}</h1><p class="sub">${carteTab==="hosp"?"Urgences et spécialités, l'hôpital le plus proche.":`Les ${SECT?SECT.sect.length:26} centres de secours et leurs secteurs, par groupement (Golf).`}</p>
  <div class="seg" style="margin:0 0 12px">${[["map","Carte"],["list","Liste"],["hosp","Hôpitaux"],["quiz","Quiz"]].filter(x=>usage!=="ci"||x[0]!=="quiz").map(([k,l])=>`<button data-ct="${k}" aria-pressed="${k===carteTab}">${l}</button>`).join("")}</div>`;
 app.innerHTML=head+`<div id="cbody"><div class="loading">Chargement de la carte…</div></div>`;bindTabBack();
 app.querySelectorAll("[data-ct]").forEach(b=>b.onclick=()=>{carteTab=b.dataset.ct;store.set("carteTab",carteTab);if(cleanup){cleanup();cleanup=null}viewCarte()});
 const need=carteTab==="map"||carteTab==="hosp"?Promise.all([loadSect(),loadLeaflet()]):loadSect();
 need.then(()=>{if(tab!=="carte"||!$("#cbody"))return;({map:carteMapView,list:carteListView,hosp:carteHospView,quiz:carteQuizView}[carteTab]||carteMapView)()})
  .catch(()=>{const b=$("#cbody");if(b)b.innerHTML=`<div class="card"><p style="margin:0">Impossible de charger la carte. Vérifie ta connexion puis réessaie.</p><button class="btn sec full" style="margin-top:12px" id="cRetry">Réessayer</button></div>`;const r=$("#cRetry");if(r)r.onclick=viewCarte})}
function carteMapView(){const b=$("#cbody");
 b.innerHTML=`<div class="chips" style="margin-bottom:10px">${[["all","Tous"],["1","Golf 1"],["2","Golf 2"],["3","Golf 3"]].map(([k,l])=>`<button class="chip" data-cg="${k}" aria-pressed="${k===carteG}">${k!=="all"?`<i class="gdot" style="background:${GCOL[k]}"></i>`:""}${l}</button>`).join("")}<button class="chip" id="cLoc">Me localiser</button></div>
  <div class="mapbox"><div id="map"></div></div><div id="cinfo"></div>
  <p class="small" style="margin:10px 4px 0">Données : carte uMap « CS et secteurs BSPP ». Tracés indicatifs : en cas de doute, le parcellaire du PVO fait foi.</p>`;
 const {m,layers}=makeMap($("#map"),{onPick:s=>select(s)});cartMap=m;cleanup=()=>{try{m.remove()}catch(e){}cartMap=null};
 const restyle=()=>styleSect(layers,(s,col)=>{const on=carteG==="all"||s.golf===carteG;const sel=carteSel===s.code;return{color:col,weight:sel?3.5:1.6,opacity:on?1:.25,fillOpacity:sel?.32:on?.13:.03}});
 const select=(s,fit)=>{carteSel=s.code;restyle();if(fit){if(layers[s.code])m.fitBounds(layers[s.code].getBounds(),{padding:[30,30]});else m.setView(s.ll,15)}
  $("#cinfo").innerHTML=`<div class="card sectcard"><div style="display:flex;gap:12px;align-items:center"><span class="sectcode" style="background:${GCOL[s.golf]}">${esc(s.code)}</span><div style="flex:1;min-width:0"><b style="font-size:18px">CS ${esc(s.name)}</b><div class="small">Groupement ${esc(s.golf)} · interlocuteur radio « Golf ${esc(s.golf)} »${s.area?` · ${String(s.area).replace(".",",")} km²`:""}</div></div></div>
   ${s.adr||s.tel?`<div class="cadrs">${adrHtml(s)}${telHtml(s)}</div>`:""}
   ${s.nb?`<div class="small" style="margin:12px 0 6px">Secteurs limitrophes (« carré des neuf »)</div>`:`<p class="small" style="margin:12px 0 0">Pas de secteur tracé pour ce centre sur la carte.</p>`}<div class="chips wrap">${(s.nb||[]).map(c=>`<button class="chip" data-nb="${c}"><i class="gdot" style="background:${GCOL[SECT.by[c].golf]}"></i>${esc(SECT.by[c].name)}</button>`).join("")}</div>
   <div class="actions"><button class="btn sec" id="cMine">${radioId.cs===s.name?"Mon CS de garde ✓":"C'est mon CS de garde"}</button></div><p class="small" id="cMineMsg" style="margin:0"></p></div>`;
  $("#cinfo").querySelectorAll("[data-nb]").forEach(x=>x.onclick=()=>select(SECT.by[x.dataset.nb],true));
  $("#cMine").onclick=()=>{saveRadioId({...radioId,cs:s.name,golf:s.golf});$("#cMine").textContent="Mon CS de garde ✓";$("#cMineMsg").textContent=`Indicatif radio mis à jour : ${rMe()}, interlocuteur ${rGolf()}.`}};
 b.querySelectorAll("[data-cg]").forEach(x=>x.onclick=()=>{carteG=x.dataset.cg;b.querySelectorAll("[data-cg]").forEach(y=>y.setAttribute("aria-pressed",y===x));restyle();
  if(carteG!=="all")m.fitBounds(window.L.featureGroup(SECT.sect.filter(s=>s.golf===carteG).map(s=>layers[s.code])).getBounds(),{padding:[10,10]})});
 $("#cLoc").onclick=()=>{if(!navigator.geolocation){toast("Localisation indisponible.");return}toast("Localisation en cours…");
  navigator.geolocation.getCurrentPosition(p=>{const ll=[p.coords.latitude,p.coords.longitude];if(cartMap!==m)return;
   if(m._me)m.removeLayer(m._me);m._me=window.L.circleMarker(ll,{radius:8,color:"#fff",weight:3,fillColor:"#0a84ff",fillOpacity:1}).addTo(m);
   const s=sectAt(ll);if(s){select(s);m.setView(ll,15);toast(`Tu es dans le secteur de ${s.name} (Golf ${s.golf}).`)}else{m.setView(ll,13);toast("Tu es hors des secteurs de cette carte.")}},
   ()=>toast("Localisation refusée ou impossible."),{enableHighAccuracy:true,timeout:12000})};
 restyle();const selObj=carteSel&&(SECT.by[carteSel]||(SECT.extra||[]).find(x=>x.code===carteSel));if(selObj)select(selObj,true);
 setTimeout(()=>m.invalidateSize(),60)}
function carteListView(){const b=$("#cbody");
 b.innerHTML=["1","2","3"].map(g=>`<div class="sect"><i class="gdot" style="background:${GCOL[g]}"></i> Groupement ${g} · Golf ${g}</div><div class="list">${SECT.sect.concat(SECT.extra||[]).filter(s=>s.golf===g).sort((a,c)=>a.name.localeCompare(c.name)).map(s=>`<button class="row" data-cs="${s.code}"><span class="sectcode" style="background:${GCOL[g]}">${s.code}</span><span class="tx"><b>${esc(s.name)}</b><span>${s.adr?esc(s.adr):""}</span>${s.tel?`<span>PVO ${esc(s.tel)}</span>`:""}${s.nb?`<span>Voisins : ${s.nb.map(c=>esc(SECT.by[c].name)).join(", ")}</span>`:""}</span>${s.tel?`<a class="callbtn" href="tel:${s.tel.replace(/\s/g,"")}" aria-label="Appeler le PVO ${esc(s.name)}" data-call="1">${PHONE}</a>`:`<span class="chev">${I.chev}</span>`}</button>`).join("")}</div>`).join("")
  +`<p class="small" style="margin:10px 4px 0">Touche un centre pour le voir sur la carte, ou le combiné pour appeler son PVO. Numéros : annuaire CIS pour AASC (version du 03/12/2025).${(SECT.extra||[]).length?` ${SECT.extra.map(x=>"CS "+esc(x.name)).join(", ")} : pas de secteur tracé.`:""}</p>`;
 b.querySelectorAll("[data-cs]").forEach(x=>x.onclick=e=>{if(e.target.closest("[data-call]"))return;carteSel=x.dataset.cs;carteTab="map";store.set("carteTab","map");viewCarte()})}
function carteQuizView(){const b=$("#cbody");const bq=store.get("carteBest",{});
 b.innerHTML=`<div class="tiles">
  <button class="tile" data-cq="qcm"><span class="ic" style="background:#0a84ff">${I.quiz}</span><b>Quiz secteurs</b><span>Codes, groupements, voisins, lieux${bq.qcm!=null?` · record ${bq.qcm}/10`:""}</span></button>
  <button class="tile" data-cq="tap"><span class="ic" style="background:#e3051b">${MAP_IC}</span><b>Situe le secteur</b><span>Touche le bon secteur sur la carte${bq.tap!=null?` · record ${bq.tap}/10`:""}</span></button>
  <button class="tile wide" data-cq="hosp"><span class="ic" style="background:#d92d20">${H_IC}</span><div><b>Quiz des hôpitaux</b><br><span>Urgences, spécialités, hôpital le plus proche (niveau ${level==="expert"?"Officier":"Sapeur"})</span></div></button></div>
  <div class="card" style="margin-top:12px"><b>Pourquoi c'est utile ?</b><p class="small" style="margin:6px 0 0">Connaître le code 4 lettres du CS (ex. PLAI pour la saisie GDR), son groupement pour savoir quel Golf appeler, et les secteurs limitrophes (« carré des neuf ») pour les départs hors secteur et les renforts.</p></div>`;
 b.querySelectorAll("[data-cq]").forEach(x=>x.onclick=()=>x.dataset.cq==="hosp"?runHospQuiz(level==="expert",()=>go("carte")):x.dataset.cq==="qcm"?runCarteQuiz():Promise.all([loadSect(),loadLeaflet()]).then(runCarteTap).catch(()=>toast("Carte indisponible hors connexion.")))}
function carteQuestions(){const S=SECT.sect;const P=()=>pick(S);const other=(s,n,f)=>shuffle(S.filter(x=>x!==s&&(!f||f(x)))).slice(0,n);const Q=[];
 const gens=[
  ()=>{const s=P();return{id:"code:"+s.code,q:`Quel est le code du CS ${s.name} ?`,o:[s.code,...other(s,3).map(x=>x.code)],e:`${s.name} = ${s.code} (code utilisé notamment pour la saisie GDR).`}},
  ()=>{const s=P();return{id:"nom:"+s.code,q:`Quel centre de secours a le code ${s.code} ?`,o:[s.name,...other(s,3).map(x=>x.name)],e:`${s.code} = CS ${s.name}, groupement ${s.golf}.`}},
  ()=>{const s=P();return{id:"golf:"+s.code,q:`Tu es de garde au CS ${s.name}. Quel est ton interlocuteur radio ?`,o:["Golf 1","Golf 2","Golf 3"],a:+s.golf-1,e:`${s.name} appartient au groupement ${s.golf} : le CSO s'appelle « Golf ${s.golf} ».`}},
  ()=>{const s=P();if(!s.nb.length)return null;const n=SECT.by[pick(s.nb)];return{id:"nb:"+s.code,q:`Lequel de ces secteurs est limitrophe de ${s.name} ?`,o:[n.name,...other(s,3,x=>!s.nb.includes(x.code)).map(x=>x.name)],e:`Secteurs voisins de ${s.name} : ${s.nb.map(c=>SECT.by[c].name).join(", ")}.`}},
  ()=>{const l=pick(SECT.lm);const s=SECT.by[l.s];return{id:"lm:"+l.n.slice(0,30),q:`Dans quel secteur se trouve ${l.n} ?`,o:[s.name,...other(s,3,x=>s.nb.includes(x.code)).concat(other(s,3)).filter((x,i,a)=>a.indexOf(x)===i).slice(0,3).map(x=>x.name)],e:`${cap(l.n)} est dans le secteur de ${s.name} (${s.code}, Golf ${s.golf}).`}},
  ()=>{const s=pick(S.filter(x=>x.adr));const strip=a=>a.replace(/, 750\d\d Paris$/,"");return{id:"adr:"+s.code,q:`Quelle est l'adresse du CS ${s.name} ?`,o:[strip(s.adr),...other(s,3,x=>x.adr).map(x=>strip(x.adr))],e:`CS ${s.name} : ${s.adr}.`}},
  ()=>{const g=pick(["1","2","3"]);const s=pick(S.filter(x=>x.golf===g));return{id:"grp:"+s.code,q:`Lequel de ces CS appartient au groupement ${g} ?`,o:[s.name,...shuffle(S.filter(x=>x.golf!==g)).slice(0,3).map(x=>x.name)],e:`Groupement ${g} : ${S.filter(x=>x.golf===g).map(x=>x.name).join(", ")}.`}},
 ];
 let guard=0;const seen=new Set();while(Q.length<10&&guard++<200){const q=gens[Math.floor(Math.random()*gens.length)]();if(!q||seen.has(q.id))continue;seen.add(q.id);
  if(q.a!=null){Q.push(q);continue}const sh=shuffle(q.o.map((t,i)=>({t,ok:i===0})));Q.push({...q,o:sh.map(x=>x.t),a:sh.findIndex(x=>x.ok)})}
 return Q}
function runCarteQuiz(){loadSect().then(()=>{const qs=freshGen(carteQuestions,"carte:",10);let i=0,score=0;
 const show=()=>{const q=qs[i];app.innerHTML=push("Quiz secteurs",`${i+1}/${qs.length}`)+`<div class="bar"><i style="width:${i/qs.length*100}%"></i></div><div class="qhead"><span class="qtag">Carte des secteurs</span></div><p class="qtext">${esc(q.q)}</p>
  <div class="opts">${q.o.map((c,k)=>`<button class="opt" data-k="${k}"><span class="k">${LETTERS[k]}</span><span>${esc(c)}</span></button>`).join("")}</div><div id="after"></div>`;
  bindBack(()=>go("carte"));
  app.querySelectorAll(".opt").forEach(b=>b.onclick=()=>{const ok=+b.dataset.k===q.a;if(ok)score++;record("carte:"+q.id,ok);if(navigator.vibrate)navigator.vibrate(ok?15:[30,40,30]);
   app.querySelectorAll(".opt").forEach(o=>{o.disabled=true;if(+o.dataset.k===q.a)o.classList.add("good");else if(o===b)o.classList.add("bad")});
   $("#after").innerHTML=`<div class="fb ${ok?"good":"bad"}"><b>${cheer(ok)}</b>${esc(q.e)}</div><div class="actions"><button class="btn full" id="next">${i+1<qs.length?"Question suivante":"Voir le score"}</button></div>`;
   const n=$("#next");n.onclick=()=>{i++;i<qs.length?show():end()};n.scrollIntoView({behavior:"smooth",block:"nearest"})})};
 const end=()=>{const bq=store.get("carteBest",{});if(bq.qcm==null||score>bq.qcm){bq.qcm=score;store.set("carteBest",bq)}setTimeout(syncSoon,50);
  app.innerHTML=push("Résultat")+`<div class="result"><div class="score">${score}/${qs.length}</div><div class="grade">${grade(score*10)}</div></div><div class="actions"><button class="btn" id="again">Rejouer</button><button class="btn sec" id="toMap">Voir la carte</button></div>`;
  bindBack(()=>go("carte"));$("#again").onclick=runCarteQuiz;$("#toMap").onclick=()=>{carteTab="map";store.set("carteTab","map");go("carte")};window.scrollTo(0,0)};
 show()}).catch(()=>toast("Carte indisponible."))}
function runCarteTap(){const targets=shuffle(SECT.sect).slice(0,10);let i=0,score=0,locked=false;
 app.innerHTML=push("Situe le secteur",`1/10`)+`<p class="qtext" id="tapQ" style="margin:12px 0"></p><div class="mapbox tall"><div id="map"></div></div><div id="after"></div>`;
 bindBack(()=>go("carte"));
 const {m,layers}=makeMap($("#map"),{quiz:1,onPick:s=>pickS(s)});cleanup=()=>{try{m.remove()}catch(e){}};
 const base=()=>styleSect(layers,(s,col)=>({color:"#8e8e93",weight:1.4,opacity:.9,fillColor:"#8e8e93",fillOpacity:.08}));
 const ask=()=>{locked=false;base();const t=targets[i];setRight(`${i+1}/10`);$("#tapQ").innerHTML=`Touche le secteur de <b>${esc(t.name)}</b>`;$("#after").innerHTML=""};
 const pickS=s=>{if(locked)return;locked=true;const t=targets[i];const ok=s.code===t.code;if(ok)score++;record("carte:tap:"+t.code,ok);if(navigator.vibrate)navigator.vibrate(ok?15:[30,40,30]);
  layers[t.code].setStyle({color:"#1f9d55",weight:3,fillColor:"#1f9d55",fillOpacity:.45});if(!ok)layers[s.code].setStyle({color:"#d92d20",weight:3,fillColor:"#d92d20",fillOpacity:.35});
  $("#after").innerHTML=`<div class="fb ${ok?"good":"bad"}"><b>${cheer(ok)}</b>${ok?"":`Tu as touché ${esc(s.name)}. `}${esc(t.name)} (${t.code}) · Golf ${t.golf}.</div><div class="actions"><button class="btn full" id="next">${i+1<10?"Secteur suivant":"Voir le score"}</button></div>`;
  $("#next").onclick=()=>{i++;if(i<10)ask();else end()};const nb=$("#next");const r=nb.getBoundingClientRect();if(r.bottom>innerHeight-8)nb.scrollIntoView({block:"end",behavior:"smooth"})};
 const end=()=>{const bq=store.get("carteBest",{});if(bq.tap==null||score>bq.tap){bq.tap=score;store.set("carteBest",bq)}setTimeout(syncSoon,50);if(cleanup){cleanup();cleanup=null}
  app.innerHTML=push("Résultat")+`<div class="result"><div class="score">${score}/10</div><div class="grade">${grade(score*10)}</div><p class="small">secteurs situés du premier coup</p></div><div class="actions"><button class="btn" id="again">Rejouer</button></div>`;
  bindBack(()=>go("carte"));$("#again").onclick=runCarteTap};
 ask();setTimeout(()=>m.invalidateSize(),60)}

/* ============ Hôpitaux ============ */
// Sources : AP-HP « Adressez un patient aux urgences spécialisées » (06/2025), liste Agate (F.-X. Coudert), géocodage Base Adresse Nationale.
const HSP={sau:"SAU adultes",saup:"SAU pédiatrique",mater:"Gynéco / maternité",trauma:"Traumato / polytrauma",neuro:"Neuro (AVC)",main:"SOS Mains",ophtalmo:"Ophtalmologie",orl:"ORL",dentaire:"Dentaire",dermato:"Dermatologie",cephal:"Céphalées",psy:"Psychiatrie"};
const HCOL={sau:"#d92d20",saup:"#ff9f0a",mater:"#ff375f",trauma:"#8e2de2",neuro:"#5e5ce6",main:"#0a84ff",ophtalmo:"#30b0c7",orl:"#34c759",dentaire:"#a2845e",dermato:"#bf5af2",cephal:"#64d2ff",psy:"#1f9d55"};
const HOSP=[
 {n:"Quinze-Vingts",adr:"28 rue de Charenton, 75012 Paris",ll:[48.85126,2.37222],sp:["ophtalmo"],nt:{ophtalmo:"Centre hospitalier national d'ophtalmologie"}},
 {n:"Ambroise-Paré",adr:"9 avenue Charles de Gaulle, 92100 Boulogne-Billancourt",ll:[48.84903,2.23728],sp:["sau","saup"]},
 {n:"André-Grégoire",adr:"56 boulevard de la Boissière, 93100 Montreuil",ll:[48.87837,2.45328],sp:["sau"]},
 {n:"Antoine-Béclère",adr:"157 rue de la Porte de Trivaux, 92140 Clamart",ll:[48.78991,2.25379],sp:["saup","mater"]},
 {n:"Armand-Trousseau",adr:"26 avenue du Dr Arnold Netter, 75012 Paris",ll:[48.84275,2.40536],sp:["saup","mater"]},
 {n:"Beaujon",adr:"100 boulevard du Général Leclerc, 92110 Clichy",ll:[48.90851,2.30778],sp:["sau","mater","trauma"]},
 {n:"Bichat",adr:"46 rue Henri Huchard, 75018 Paris",ll:[48.89912,2.33092],sp:["sau","neuro","mater"]},
 {n:"Cochin",adr:"27 rue du Faubourg Saint-Jacques, 75014 Paris",ll:[48.83734,2.33884],sp:["sau","ophtalmo","trauma"],nt:{ophtalmo:"Ophtalmopole AP-HP : après-midi, nuits, dimanches et fériés, et toute la journée pour les patients non suivis"}},
 {n:"Port-Royal (maternité Cochin)",adr:"123 boulevard de Port-Royal, 75014 Paris",ll:[48.83913,2.33793],sp:["mater"]},
 {n:"Georges-Pompidou (HEGP)",adr:"20 rue Leblanc, 75015 Paris",ll:[48.83964,2.27376],sp:["sau","main","trauma"],nt:{main:"SOS Mains adultes, 24 h/24"}},
 {n:"Henri-Mondor",adr:"51 avenue du Maréchal de Lattre de Tassigny, 94000 Créteil",ll:[48.79846,2.45458],sp:["sau","trauma","dermato","dentaire"],nt:{dermato:"Seules urgences dermato de l'AP-HP : du lundi au vendredi, 8 h 45-12 h 30 et 13 h 30-15 h 45"}},
 {n:"Intercommunal de Créteil",adr:"40 avenue de Verdun, 94000 Créteil",ll:[48.7977,2.46454],sp:["sau"]},
 {n:"Bicêtre",adr:"78 rue du Général Leclerc, 94270 Le Kremlin-Bicêtre",ll:[48.81005,2.3579],sp:["sau","saup","neuro","mater","trauma"]},
 {n:"Pitié-Salpêtrière",adr:"83 boulevard de l'Hôpital, 75013 Paris",ll:[48.83861,2.36117],sp:["sau","neuro","mater","trauma","dentaire"],nt:{neuro:"Urgences cérébro-vasculaires"}},
 {n:"Lariboisière",adr:"2 rue Ambroise Paré, 75010 Paris",ll:[48.8819,2.35376],sp:["sau","orl","cephal"],nt:{orl:"ORL adultes : nuits dès 18 h 30, samedi dès 13 h, dimanches et fériés (avis médical préalable)",cephal:"Centre d'urgence des céphalées : du lundi au samedi, 8 h-17 h"}},
 {n:"Lariboisière (maternité)",adr:"41 boulevard de la Chapelle, 75010 Paris",ll:[48.88381,2.35326],sp:["mater"]},
 {n:"Louis-Mourier",adr:"178 rue des Renouillers, 92700 Colombes",ll:[48.92345,2.23602],sp:["mater","dentaire"]},
 {n:"Necker-Enfants malades",adr:"149 rue de Sèvres, 75015 Paris",ll:[48.84635,2.31543],sp:["saup","mater","orl","neuro"],nt:{orl:"ORL enfants : après-midi, nuits, dimanches et fériés",neuro:"Neurologie pédiatrique"}},
 {n:"Robert-Debré",adr:"48 boulevard Sérurier, 75019 Paris",ll:[48.87864,2.40257],sp:["saup","mater","main","dentaire"],nt:{main:"SOS Mains enfants, 24 h/24",dentaire:"Stomatologie et chirurgie maxillo-faciale"}},
 {n:"Fondation Rothschild",adr:"29 rue Manin, 75019 Paris",ll:[48.87863,2.37817],sp:["ophtalmo","neuro","dentaire"]},
 {n:"Sainte-Anne (GHU Paris)",adr:"1 rue Cabanis, 75014 Paris",ll:[48.83023,2.34045],sp:["psy","neuro"],nt:{psy:"CPOA : accueil psychiatrique 24 h/24"}},
 {n:"Saint-Antoine",adr:"34 rue Crozatier, 75012 Paris",ll:[48.84754,2.3813],sp:["sau","main"],nt:{main:"SOS Mains adultes, 24 h/24"}},
 {n:"Saint-Joseph",adr:"187 rue Raymond Losserand, 75014 Paris",ll:[48.82972,2.30992],sp:["sau","mater"]},
 {n:"Tenon",adr:"53 rue Pelleport, 75020 Paris",ll:[48.86668,2.40254],sp:["sau"]},
 {n:"Tenon (maternité)",adr:"4 rue de la Chine, 75020 Paris",ll:[48.86572,2.40076],sp:["mater"]}];
const H_IC='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><rect x="3.5" y="3.5" width="17" height="17" rx="4"/><path d="M9 8v8M15 8v8M9 12h6"/></svg>';
let hospF=store.get("hospF","all"),hospMe=null,hospSel=null,hospAuto=false;
function kmTo(a,b){const R=6371,r=Math.PI/180,dl=(b[0]-a[0])*r,dg=(b[1]-a[1])*r;const x=Math.sin(dl/2)**2+Math.cos(a[0]*r)*Math.cos(b[0]*r)*Math.sin(dg/2)**2;return 2*R*Math.asin(Math.sqrt(x))}
const fmtKm=d=>d<1?Math.round(d*1000)+" m":d.toFixed(1).replace(".",",")+" km";
const hDept=h=>(h.adr.match(/(\d{2})\d{3}/)||[])[1];
const hBadges=(h,big)=>h.sp.map(k=>`<span class="hb${k===hospF?" on":""}" style="--c:${HCOL[k]}">${esc(HSP[k])}</span>`).join("");
function hospList(){let L=HOSP.filter(h=>hospF==="all"||h.sp.includes(hospF)).map(h=>({h,d:hospMe?kmTo(hospMe,h.ll):null}));
 if(hospMe)L.sort((a,b)=>a.d-b.d);else L.sort((a,b)=>a.h.n.localeCompare(b.h.n));return L}
function hospCard(h){const d=hospMe?kmTo(hospMe,h.ll):null;
 return `<div class="card hospcard"><div style="display:flex;gap:12px;align-items:center"><span class="hic">${H_IC}</span><div style="flex:1;min-width:0"><b style="font-size:18px">${esc(h.n)}</b><div class="small">${d!=null?`à ${fmtKm(d)} à vol d'oiseau`:"Touche « Le plus proche » pour la distance"}</div></div></div>
  <div class="cadrs">${adrHtml(h)}</div><div class="hbs" style="margin-top:10px">${hBadges(h)}</div>
  ${h.nt?`<ul class="hnotes">${Object.entries(h.nt).map(([k,v])=>`<li><b>${esc(HSP[k])}</b> : ${esc(v)}</li>`).join("")}</ul>`:""}</div>`}
function carteHospView(){const b=$("#cbody");
 b.innerHTML=`<div class="chips" style="margin-bottom:10px"><button class="chip" id="hNear">${PIN} Le plus proche</button>${[["all","Tous"],...Object.entries(HSP)].map(([k,l])=>`<button class="chip" data-hf="${k}" aria-pressed="${k===hospF}">${k!=="all"?`<i class="gdot" style="background:${HCOL[k]}"></i>`:""}${esc(l)}</button>`).join("")}</div>
  <div class="mapbox"><div id="map"></div></div><div id="hinfo"></div><div id="hlist"></div>
  <p class="small" style="margin:10px 4px 0">Liste indicative : l'orientation de la victime est décidée par la régulation, pas par l'équipage. Distances à vol d'oiseau. Sources : AP-HP, urgences spécialisées (juin 2025) ; liste de l'appli Agate (F.-X. Coudert) ; Base Adresse Nationale.</p>`;
 const L=window.L;const {m,layers}=makeMap($("#map"),{quiz:1});cartMap=m;cleanup=()=>{try{m.remove()}catch(e){}cartMap=null};
 styleSect(layers,()=>({color:"#8e8e93",weight:1,opacity:.5,fillColor:"#8e8e93",fillOpacity:.04}));
 const mk={};let meMk=null;
 const icon=(h,on)=>L.divIcon({className:"",html:`<span class="hpin${on?" on":""}${hospF!=="all"&&!h.sp.includes(hospF)?" off":""}">H</span>`,iconSize:[26,26],iconAnchor:[13,13]});
 HOSP.forEach(h=>{mk[h.n]=L.marker(h.ll,{icon:icon(h,false),title:h.n}).addTo(m).on("click",()=>select(h))});
 const draw=()=>{HOSP.forEach(h=>mk[h.n].setIcon(icon(h,hospSel===h.n)));const li=hospList();
  $("#hlist").innerHTML=`<div class="sect">${hospF==="all"?"Tous les hôpitaux":esc(HSP[hospF])}${hospMe?" · du plus proche au plus loin":""}</div><div class="list">${li.map(({h,d})=>`<button class="row" data-h="${esc(h.n)}"><span class="hic sm">${H_IC}</span><span class="tx"><b>${esc(h.n)}${d!=null?` · ${fmtKm(d)}`:""}</b><span>${esc(h.adr)}</span><span class="hbs">${hBadges(h)}</span></span><span class="chev">${I.chev}</span></button>`).join("")||`<p class="small" style="padding:12px">Aucun hôpital pour ce filtre.</p>`}</div>`;
  $("#hlist").querySelectorAll("[data-h]").forEach(x=>x.onclick=()=>{select(HOSP.find(h=>h.n===x.dataset.h),true);$("#map").scrollIntoView({behavior:"smooth",block:"start"})})};
 const select=(h,fit)=>{hospSel=h.n;draw();$("#hinfo").innerHTML=hospCard(h);if(fit)m.setView(h.ll,15);alog("hopital",h.n)};
 const fitAll=()=>{const pts=hospList().map(x=>x.h.ll);if(hospMe)pts.push(hospMe);if(pts.length)m.fitBounds(L.latLngBounds(pts),{padding:[24,24],maxZoom:15})};
 b.querySelectorAll("[data-hf]").forEach(x=>x.onclick=()=>{hospF=x.dataset.hf;store.set("hospF",hospF);b.querySelectorAll("[data-hf]").forEach(y=>y.setAttribute("aria-pressed",y===x));draw();
  if(hospMe){const n=hospList()[0];if(n){select(n.h);m.fitBounds(L.latLngBounds([hospMe,n.h.ll]),{padding:[40,40],maxZoom:15})}}else fitAll()});
 const near=()=>{if(!navigator.geolocation){toast("Localisation indisponible.");return}toast("Localisation en cours…");
  navigator.geolocation.getCurrentPosition(p=>{if(cartMap!==m)return;hospMe=[p.coords.latitude,p.coords.longitude];
   if(meMk)m.removeLayer(meMk);meMk=L.circleMarker(hospMe,{radius:8,color:"#fff",weight:3,fillColor:"#0a84ff",fillOpacity:1}).addTo(m);
   const n=hospList()[0];if(!n){draw();toast("Aucun hôpital pour ce filtre.");return}select(n.h);m.fitBounds(L.latLngBounds([hospMe,n.h.ll]),{padding:[40,40],maxZoom:15});
   toast(`Le plus proche${hospF!=="all"?` (${HSP[hospF]})`:""} : ${n.h.n}, ${fmtKm(n.d)}.`)},
   ()=>toast("Localisation refusée ou impossible."),{enableHighAccuracy:true,timeout:12000})};
 $("#hNear").onclick=near;draw();const s=hospSel&&HOSP.find(h=>h.n===hospSel);if(s)select(s,true);else fitAll();
 if(hospAuto){hospAuto=false;near()}
 setTimeout(()=>m.invalidateSize(),60)}
function openHospNear(){carteTab="hosp";store.set("carteTab","hosp");hospAuto=true;go("carte")}

/* ---- Quiz hôpitaux (Sapeur ×0,5 / Lieutenant ×2) ---- */
function hospQuestions(expert){const n=expert?4:3;const Q=[];const P=()=>pick(HOSP);
 const opts=(good,bad)=>{const o=shuffle([good,...shuffle(bad.filter(x=>x!==good)).slice(0,n-1)]);return o};
 const withS=k=>HOSP.filter(h=>h.sp.includes(k)),without=k=>HOSP.filter(h=>!h.sp.includes(k));
 const dep={"75":"Paris (75)","92":"Hauts-de-Seine (92)","93":"Seine-Saint-Denis (93)","94":"Val-de-Marne (94)"};
 const gens=[
  ()=>{const k=pick(Object.keys(HSP).filter(k=>withS(k).length&&(expert||!["trauma","neuro","dentaire"].includes(k))));const h=pick(withS(k));const o=opts(h,without(k));
   return{id:"sp2h:"+k+":"+h.n,q:`Lequel de ces hôpitaux propose : ${HSP[k].toLowerCase()} ?`,choices:o.map(x=>x.n),answer:o.indexOf(h),e:`${HSP[k]} : ${withS(k).map(x=>x.n).join(", ")}.`}},
  ()=>{const h=pick(HOSP.filter(x=>x.sp.some(k=>!["sau","saup"].includes(k))));const k=pick(h.sp);const o=opts(k,Object.keys(HSP).filter(x=>!h.sp.includes(x)));
   return{id:"h2sp:"+h.n,q:`Que trouve-t-on à l'hôpital ${h.n} ?`,choices:o.map(x=>HSP[x]),answer:o.indexOf(k),e:`${h.n} : ${h.sp.map(x=>HSP[x]).join(", ")}.`}},
  ()=>{const h=pick(withS("saup").filter(x=>!x.sp.includes("sau")));const o=opts(h,withS("sau"));
   return{id:"pedia:"+h.n,q:"Lequel de ces hôpitaux a des urgences pédiatriques mais pas d'urgences adultes ?",choices:o.map(x=>x.n),answer:o.indexOf(h),e:`${h.n} : ${h.sp.map(x=>HSP[x]).join(", ")}.`}},
  ()=>{const h=pick(HOSP.filter(x=>dep[hDept(x)]));const d=hDept(h);const o=opts(dep[d],Object.values(dep));
   return{id:"dep:"+h.n,q:`Dans quel département se trouve l'hôpital ${h.n} ?`,choices:o,answer:o.indexOf(dep[d]),e:`${h.n} : ${h.adr}.`}},
  ()=>({id:"sossau",q:"Que signifie SAU ?",choices:shuffle(["Service d'accueil des urgences","Service d'aide urgente","Secteur d'accueil unifié","Service ambulancier d'urgence"]).slice(0,n),fix:"Service d'accueil des urgences",e:"SAU = Service d'accueil des urgences : les urgences générales d'un hôpital. SAU pédiatrique = urgences des enfants."}),
  ()=>{const h=pick(withS("main").filter(x=>!x.sp.includes("saup")));const o=opts(h,without("main"));
   return{id:"main:"+h.n,q:"Une victime adulte a une plaie grave de la main. Lequel de ces hôpitaux a un centre SOS Mains ?",choices:o.map(x=>x.n),answer:o.indexOf(h),e:"SOS Mains adultes : Saint-Antoine et Georges-Pompidou (HEGP). Enfants : Robert-Debré."}},
  ()=>({id:"psy",q:"Quel hôpital est connu pour l'accueil psychiatrique d'urgence 24 h/24 (CPOA) ?",choices:shuffle(["Sainte-Anne (GHU Paris)",...shuffle(["Quinze-Vingts","Saint-Antoine","Beaujon","Tenon"]).slice(0,n-1)]),fix:"Sainte-Anne (GHU Paris)",e:"Le CPOA (Centre psychiatrique d'orientation et d'accueil) est à Sainte-Anne, 1 rue Cabanis (14e)."}),
  ()=>({id:"1520",q:"Pour quelle spécialité l'hôpital des Quinze-Vingts est-il connu ?",choices:shuffle(["Ophtalmologie",...shuffle(["Dermatologie","ORL","Dentaire","Psychiatrie"]).slice(0,n-1)]),fix:"Ophtalmologie",e:"Les Quinze-Vingts (12e) : centre hospitalier national d'ophtalmologie."})];
 if(expert)gens.push(
  ()=>({id:"orlnuit",q:"Urgence ORL chez un adulte, un samedi à 20 h. Quel hôpital AP-HP assure les urgences ORL à ces horaires ?",choices:shuffle(["Lariboisière","Necker-Enfants malades","Cochin","Pitié-Salpêtrière"]),fix:"Lariboisière",e:"ORL adultes : Lariboisière (nuits dès 18 h 30, samedi dès 13 h, dimanches et fériés). ORL enfants : Necker."}),
  ()=>({id:"ophnuit",q:"Urgence ophtalmologique un dimanche, patient non suivi à l'AP-HP. Vers quel hôpital AP-HP ?",choices:shuffle(["Cochin (Ophtalmopole)","Lariboisière","Bichat","Saint-Antoine"]),fix:"Cochin (Ophtalmopole)",e:"L'Ophtalmopole de Cochin prend les urgences ophtalmo l'après-midi, la nuit, le dimanche et les jours fériés, et toute la journée pour les patients non suivis."}),
  ()=>({id:"dermah",q:"Les urgences dermatologiques de l'AP-HP (Henri-Mondor) sont ouvertes…",choices:shuffle(["En semaine, aux heures ouvrées","24 h/24, 7 j/7","Uniquement la nuit","Le week-end seulement"]),fix:"En semaine, aux heures ouvrées",e:"Henri-Mondor : du lundi au vendredi, 8 h 45-12 h 30 et 13 h 30-15 h 45, fermé le week-end."}),
  ()=>({id:"cephh",q:"Où se trouve le centre d'urgence des céphalées de l'AP-HP ?",choices:shuffle(["Lariboisière","Sainte-Anne","Bicêtre","Rothschild"]),fix:"Lariboisière",e:"Centre d'urgence des céphalées : Lariboisière, du lundi au samedi de 8 h à 17 h."}),
  ()=>({id:"mainenf",q:"Plaie grave de la main chez un enfant : quel centre SOS Mains pédiatrique de l'AP-HP ?",choices:shuffle(["Robert-Debré","Necker-Enfants malades","Armand-Trousseau","Saint-Antoine"]),fix:"Robert-Debré",e:"SOS Mains enfants : Robert-Debré. Adultes : Saint-Antoine et Georges-Pompidou."}),
  ()=>{const h=pick(without("sau"));const o=opts(h,withS("sau"));return{id:"nosau:"+h.n,q:"Lequel de ces hôpitaux n'a PAS de SAU adultes ?",choices:o.map(x=>x.n),answer:o.indexOf(h),e:`${h.n} : ${h.sp.map(x=>HSP[x]).join(", ")}.`}},
  ()=>{if(!SECT)return null;const s=pick(SECT.sect);const L=withS("sau").map(h=>({h,d:kmTo(s.ll,h.ll)})).sort((a,b)=>a.d-b.d);const far=L.slice(1).filter(x=>x.d-L[0].d>1.2);if(far.length<n-1)return null;
   const o=shuffle([L[0],...shuffle(far.slice(0,6)).slice(0,n-1)]);return{id:"near:"+s.code,q:`Depuis le CS ${s.name}, quel est l'hôpital avec SAU adultes le plus proche (à vol d'oiseau) ?`,choices:o.map(x=>x.h.n),answer:o.indexOf(L[0]),e:`${L[0].h.n}, à ${fmtKm(L[0].d)} du CS ${s.name}. L'orientation reste décidée par la régulation.`}});
 const seen=new Set(),fam={},cap={sp2h:3,h2sp:2,near:2,dep:1};let guard=0;while(Q.length<10&&guard++<400){const q=pick(gens)();if(!q||seen.has(q.id))continue;const f=q.id.split(":")[0];if((fam[f]||0)>=(cap[f]||1))continue;fam[f]=(fam[f]||0)+1;seen.add(q.id);
  if(q.fix){if(!q.choices.includes(q.fix))q.choices[0]=q.fix;q.choices=shuffle(q.choices);q.answer=q.choices.indexOf(q.fix)}Q.push(q)}
 return Q}
function runHospQuiz(expert,back){back=back||(()=>go("home"));loadSect().catch(()=>null).then(()=>{const pre=expert?"hosp:":"s:hosp:";const qs=freshGen(()=>hospQuestions(expert),pre,10);let i=0,score=0,combo=0;
 const show=()=>{const q=qs[i];
  app.innerHTML=push("Quiz des hôpitaux",`${i+1}/${qs.length}`)+`<div class="bar"><i style="width:${i/qs.length*100}%"></i></div><div class="qhead"><span class="qtag">Hôpitaux · niveau ${expert?"Officier":"Sapeur"}${combo>=2?` · <span class="combo">série ×${combo}</span>`:""}</span></div>
   <p class="qtext">${esc(q.q)}</p><div class="opts">${q.choices.map((c,k)=>`<button class="opt" data-k="${k}"><span class="k">${LETTERS[k]}</span><span>${esc(c)}</span></button>`).join("")}</div><div id="after"></div>`;
  bindBack(back);
  app.querySelectorAll(".opt").forEach(b=>b.onclick=()=>{const ok=+b.dataset.k===q.answer;if(ok){score++;combo++}else combo=0;record(pre+q.id,ok);if(navigator.vibrate)navigator.vibrate(ok?15:[30,40,30]);
   app.querySelectorAll(".opt").forEach(o=>{o.disabled=true;if(+o.dataset.k===q.answer)o.classList.add("good");else if(o===b)o.classList.add("bad")});
   $("#after").innerHTML=`<div class="fb ${ok?"good":"bad"}"><b>${cheer(ok)}</b>${esc(q.e)}</div><div class="actions"><button class="btn full" id="next">${i+1<qs.length?"Question suivante":"Voir le score"}</button></div>`;
   const n=$("#next");n.onclick=()=>{i++;i<qs.length?show():end()};n.scrollIntoView({behavior:"smooth",block:"nearest"})})};
 const end=()=>{setTimeout(syncSoon,50);app.innerHTML=push("Résultat")+`<div class="result"><div class="score">${score}/${qs.length}</div><div class="grade">${grade(score*10)}</div><p class="small">+${score*(expert?20:5)} points</p></div>
  <div class="actions"><button class="btn" id="again">Rejouer</button><button class="btn sec" id="hMap">Carte des hôpitaux</button></div>`;
  bindBack(back);$("#again").onclick=()=>runHospQuiz(expert,back);$("#hMap").onclick=()=>{carteTab="hosp";store.set("carteTab","hosp");go("carte")};window.scrollTo(0,0)};
 show()})}

/* ============ Documents ============ */
const GROUPS=[["Le parcours CI",["guide","groupes"]],["Règlements BSPP",["b1151","b1152","b1153","b118","b112","b30016","b20020"]],["Secours à personne (BSP 200.2)",["b2002","bilan","acr72","drepano","victime","deces","noncontact","noncontact2","maj2025","maj2024"]],["Fiches et notes",["ft231","daecivil","dsa","chaleur","chaleur2","lifevest","chiens","reveil","ambu","police","ambassade","papillon","vie","mcori","tph","grimp"]],["MACA / formations",["macaintro","trauma","macaacr","chutes","macaefibi","nnn"]],["eFiBi",["efibi","recap","ircs","md5","tutoarr","tutobil","suppr"]],["Bonus",["pse"]]];
let docQ="";
function viewDocs(){
  app.innerHTML=`${backLink()}<h1 class="big">Documents</h1><p class="sub">Les référentiels du parcours, consultables et cherchables hors réseau.</p>
   <form id="dform"><input class="search" id="dq" type="search" placeholder="Chercher dans tous les documents" value="${esc(docQ)}"></form><div id="dres"></div>
   <div id="dlist">${GROUPS.map(([g,ids])=>`<div class="sect">${g}</div><div class="list">${ids.filter(i=>DOC[i]).map(i=>{const d=DOC[i];return `<button class="row" data-doc="${i}"><span class="ic" style="background:${i==="pse"?"#8e8e93":"var(--navy2)"}">${I.doc}</span><span class="tx"><b>${esc(d.t)}</b><span>${d.n} page${d.n>1?"s":""} · ${d.kb>1024?(d.kb/1024).toFixed(1)+" Mo":d.kb+" Ko"}</span></span><span class="chev">${I.chev}</span></button>`}).join("")}</div>`).join("")}
   <div class="sect">Hors réseau</div><div class="card"><p style="margin:0 0 10px">Les documents se téléchargent quand tu les ouvres. Pour tout avoir sans réseau, télécharge-les en une fois (environ 180 Mo, en Wi-Fi de préférence).</p><button class="btn sec full" id="dlAll">Tout télécharger</button><p class="small" id="dlMsg"></p></div>`;
  app.querySelectorAll("[data-doc]").forEach(b=>b.onclick=()=>openDoc(b.dataset.doc,1,[]));
  const run=async()=>{const q=$("#dq").value.trim();docQ=q;if(!q){$("#dres").innerHTML="";$("#dlist").hidden=false;return}
    $("#dres").innerHTML=`<div class="loading">Recherche…</div>`;try{await loadIndex()}catch(e){$("#dres").innerHTML=`<p class="sub">Index indisponible hors réseau. Ouvre l'appli une fois avec du réseau.</p>`;return}
    const hits=searchChunks(q,25);$("#dlist").hidden=true;
    $("#dres").innerHTML=`<div class="sect">${hits.length} résultat(s)</div>`+hits.map(r=>`<button class="hit" data-open="${r.doc.id}|${r.p}|${r.terms.join(",")}"><span class="d">${esc(r.doc.t)} · p. ${r.p}</span><p>${excerpt(r.text,r.terms,260)}</p></button>`).join("");
    $("#dres").querySelectorAll("[data-open]").forEach(b=>b.onclick=()=>{const [d,p,t]=b.dataset.open.split("|");openDoc(d,+p,t?t.split(","):[])})};
  $("#dform").onsubmit=e=>{e.preventDefault();$("#dq").blur();run()};$("#dq").onsearch=run;if(docQ)run();
  $("#dlAll").onclick=async()=>{const b=$("#dlAll"),m=$("#dlMsg");b.disabled=true;let k=0;
    for(const d of DOCS){m.textContent=`Téléchargement ${++k}/${DOCS.length} : ${d.t}`;try{const c=await caches.open("quiz-ci-docs");for(const u of pdfUrls(d.id)){if(!(await c.match(u))){const r=await fetch(u);if(r.ok)await c.put(u,r)}}}catch(e){}}
    m.textContent="Documents disponibles hors réseau.";b.disabled=false}
}

/* ============ Lecteur PDF ============ */
let pdfjsReady=null;
function loadPdfJs(){if(pdfjsReady)return pdfjsReady;pdfjsReady=new Promise((res,rej)=>{const s=document.createElement("script");s.src="pdfjs/pdf.min.js";s.onload=()=>{window.pdfjsLib.GlobalWorkerOptions.workerSrc="pdfjs/pdf.worker.min.js";res(window.pdfjsLib)};s.onerror=()=>{pdfjsReady=null;rej()};document.head.appendChild(s)});return pdfjsReady}
const pdfCache={};
const PARTS={b2002:7,pse:5};
const pdfUrls=id=>PARTS[id]?Array.from({length:PARTS[id]},(_,i)=>`pdf/${id}.pdf.part${i}`):[`pdf/${id}.pdf`];
async function getCached(url){let resp=null;try{const c=await caches.open("quiz-ci-docs");resp=await c.match(url)}catch(e){}
  if(!resp){resp=await fetch(url);if(!resp.ok)throw new Error("pdf");try{const c=await caches.open("quiz-ci-docs");await c.put(url,resp.clone())}catch(e){}}return resp}
async function fetchPdf(id,onProg){if(pdfCache[id])return pdfCache[id];
  const urls=pdfUrls(id);const total=DOC[id].kb*1024;const parts=[];let got=0;
  for(const u of urls){const resp=await getCached(u);const reader=resp.body&&resp.body.getReader?resp.body.getReader():null;
    if(reader){for(;;){const {done,value}=await reader.read();if(done)break;parts.push(value);got+=value.length;onProg&&onProg(Math.min(1,got/total))}}
    else{const b=new Uint8Array(await resp.arrayBuffer());parts.push(b);got+=b.length;onProg&&onProg(Math.min(1,got/total))}}
  const buf=new Uint8Array(got);let o=0;parts.forEach(p=>{buf.set(p,o);o+=p.length});
  const lib=await loadPdfJs();const pdf=await lib.getDocument({data:buf,isEvalSupported:false}).promise;pdfCache[id]=pdf;return pdf}
let pageText={};
async function textOf(id,p){if(!pageText[id]){try{await loadIndex()}catch(e){return""}pageText[id]={};IDX.chunks.forEach(c=>{if(DOCS[c[0]].id===id)pageText[id][c[1]]=(pageText[id][c[1]]?pageText[id][c[1]]+"\n\n":"")+c[2]})}return pageText[id][p]||""}
function openDoc(id,page,terms){const d=DOC[id];if(!d)return;let p=Math.max(1,Math.min(d.n,page||1)),mode="pdf",zoom=1,pdf=null,renderTask=null;
  const v=document.createElement("div");v.className="viewer";v.id="viewer";
  v.innerHTML=`<div class="vbar"><button id="vclose">Fermer</button><div class="ttl">${esc(d.t)}</div><button id="vtoc">${d.ol&&d.ol.length?"Sommaire":""}</button></div><div class="vbody" id="vbody"></div>
   <div class="vfoot"><button class="btn sec small" id="vprev" aria-label="Page précédente">‹</button><div class="mid"><span class="pg" id="vpg"></span><button class="btn sec small" id="vmode">Texte</button><button class="btn sec small" id="vzoom">Zoom</button></div><button class="btn sec small" id="vnext" aria-label="Page suivante">›</button></div>`;
  document.body.appendChild(v);document.body.style.overflow="hidden";history.pushState({app:1},"");
  const body=v.querySelector("#vbody");
  const close=()=>{v.remove();document.body.style.overflow=""};
  v.querySelector("#vclose").onclick=close;
  v.querySelector("#vprev").onclick=()=>{if(p>1){p--;draw()}};v.querySelector("#vnext").onclick=()=>{if(p<d.n){p++;draw()}};
  v.querySelector("#vmode").onclick=()=>{mode=mode==="pdf"?"text":"pdf";v.querySelector("#vmode").textContent=mode==="pdf"?"Texte":"Page";draw()};
  v.querySelector("#vzoom").onclick=()=>{zoom=zoom===1?1.8:zoom===1.8?2.6:1;draw()};
  if(d.ol&&d.ol.length)v.querySelector("#vtoc").onclick=()=>{const s=sheet(`<h2>Sommaire</h2><div class="list">${d.ol.map(([l,t,pg])=>`<button class="row" data-pg="${pg}" style="padding-left:${10+(l-1)*16}px"><span class="tx"><b style="font-weight:${l===1?700:500}">${esc(t)}</b></span><span class="small">p. ${pg}</span></button>`).join("")}</div>`);s.style.zIndex=60;
    s.querySelectorAll("[data-pg]").forEach(b=>b.onclick=()=>{p=+b.dataset.pg;closeSheet();draw()})};
  let sx=null;body.addEventListener("touchstart",e=>{if(e.touches.length===1&&zoom===1)sx=e.touches[0].clientX},{passive:true});
  body.addEventListener("touchend",e=>{if(sx==null)return;const dx=e.changedTouches[0].clientX-sx;sx=null;if(Math.abs(dx)>80){if(dx<0&&p<d.n){p++;draw()}else if(dx>0&&p>1){p--;draw()}}});
  async function draw(){v.querySelector("#vpg").textContent=`${p} / ${d.n}`;
    const txt=await textOf(id,p);const pass=terms&&terms.length&&txt?excerpt(txt,terms,300):"";
    const passHTML=pass&&pass.includes("<mark>")?`<div class="passage"><b>Passage repéré</b>${pass}</div>`:"";
    if(mode==="text"){body.innerHTML=passHTML+`<div class="vtext">${txt?highlight(txt,terms||[]):"Pas de texte extractible sur cette page. Passe en mode Page."}</div>`;body.scrollTop=0;return}
    if(!pdf){body.innerHTML=passHTML+`<div class="loading"><div>Chargement du document…</div><div class="lbar"><i id="vlb"></i></div><div class="small">${d.kb>8000?"Document volumineux : le premier chargement peut prendre un moment.":""}</div></div>`;
      try{pdf=await fetchPdf(id,f=>{const b=v.querySelector("#vlb");if(b)b.style.width=Math.round(f*100)+"%"})}
      catch(e){mode="text";v.querySelector("#vmode").textContent="Page";body.innerHTML=passHTML+`<p class="small">Le PDF n'est pas disponible hors réseau. Voici le texte de la page.</p><div class="vtext">${highlight(txt,terms||[])}</div>`;return}}
    const pg=await pdf.getPage(p);const w=body.clientWidth-2;const vp0=pg.getViewport({scale:1});const scale=w/vp0.width*zoom;const dpr=Math.min(window.devicePixelRatio||1,2.5);
    const vp=pg.getViewport({scale:scale*dpr});const cv=document.createElement("canvas");cv.className="vpage";cv.width=vp.width;cv.height=vp.height;cv.style.width=(vp.width/dpr)+"px";cv.style.maxWidth=zoom>1?"none":"100%";
    if(renderTask)try{renderTask.cancel()}catch(e){}
    renderTask=pg.render({canvasContext:cv.getContext("2d"),viewport:vp});
    try{await renderTask.promise}catch(e){return}
    body.innerHTML=passHTML;body.appendChild(cv);body.scrollTop=0}
  draw();
}

/* ============ Profil ============ */
let profFilter="ko",confirmReset=false,profTab=store.get("profTab","moi");
function viewProfile(){
  const head=`${backLink()}<h1 class="big">Profil</h1><div class="seg" style="margin:6px 0 14px"><button data-pt="moi" aria-pressed="${profTab==="moi"}">Moi</button><button data-pt="equipe" aria-pressed="${profTab==="equipe"}">Équipe</button></div>`;
  if(profTab==="equipe"){app.innerHTML=head+`<div id="board"></div>`;bindProfTabs();renderBoard();return}
  if(profTab==="stats"){profTab="moi";store.set("profTab",profTab)}
  viewMe(head)}
function viewStatsTab(){viewStats()}
function reStats(){drawStats()}
function bindProfTabs(){bindTabBack();app.querySelectorAll("[data-pt]").forEach(b=>b.onclick=()=>{if(b.dataset.pt==="equipe")rkNav={v:"top"};profTab=b.dataset.pt;store.set("profTab",profTab);viewProfile()})}
const CROSS_IC='<svg class="uic" viewBox="0 0 40 40" aria-hidden="true"><rect width="40" height="40" rx="9" fill="#fff"/><path d="M15 6h10v9h9v10h-9v9H15v-9H6V15h9z" fill="#e3051b"/></svg>';
// casque de sapeur-pompier vu de face (dessin original : bombe chromée, crête jaune, visière dorée, bavolet) — choix C
const HELMET_IC='<svg class="uic" viewBox="0 0 100 100" aria-hidden="true"><defs><linearGradient id="hcS" x1="0" x2="1"><stop offset="0" stop-color="#8f97a2"/><stop offset=".4" stop-color="#f4f6f8"/><stop offset="1" stop-color="#8a929d"/></linearGradient><linearGradient id="hcV" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffe08a"/><stop offset="1" stop-color="#b8780f"/></linearGradient></defs><rect width="100" height="100" rx="22" fill="#14223f"/><path d="M14 56h8l-2 26h-8zM86 56h-8l2 26h8z" fill="#2a2f37"/><path d="M15 56C15 31 31 13 50 13s35 18 35 43z" fill="url(#hcS)"/><path d="M46 13.5C46.8 24 47 40 46.5 56h7C53 40 53.2 24 54 13.5z" fill="#f2c230"/><path d="M13 54h74v6H13z" fill="#2f343c"/><path d="M21 60h58c0 14-13 25-29 25S21 74 21 60z" fill="url(#hcV)"/><path d="M28 63c2 7 7 12 14 14" fill="none" stroke="#fff6d6" stroke-width="2.6" stroke-linecap="round" opacity=".85"/></svg>';
const SGT_IC=`<svg class="sgtic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 18.5c0-3 2.4-5.5 5-6 1.2-1.8 3.6-2.6 5.6-1.6 2.6.4 4.9 2.8 5.2 5.6.1.9-.6 1.5-1.5 1.5H5.3c-.7 0-1.3-.6-1.3-1.3z"/><path d="M9 15.5l2-1.5M13.5 15l1.5-1.2" opacity=".8"/><path d="M8 7.5c0-1 .8-1.6.8-2.5M12 6c0-1.2 1-2 1-3M16 7.5c0-1 .8-1.6.8-2.5"/></svg>`;
function fireCard(){const d={off:"Encouragements adaptés à ton niveau, sans effets.",sgt:"Le feu couve : pas de thème visuel, mais un sergent-chef de très mauvaise humeur commente chacune de tes réponses.",fire:"Thème enflammé, animations surprises et sergent-chef de très mauvaise humeur à chaque réponse."}[fxMode];
 return `<div class="card firecard${fxMode!=="off"?" on":""}${fxMode==="sgt"?" sgt":""}"><b>${fxMode==="fire"?FLAME_IC:SGT_IC} Ambiance</b><p class="small" style="margin:6px 0 10px">${d} Tu changes quand tu veux (un administrateur peut aussi te l'activer).</p><div class="seg firetog"><button data-fx="off" aria-pressed="${fxMode==="off"}">Normal</button><button data-fx="sgt" aria-pressed="${fxMode==="sgt"}">${SGT_IC} Braise</button><button data-fx="fire" aria-pressed="${fxMode==="fire"}">${FLAME_IC} On Fire</button></div></div>`}
function bindFire(){document.querySelectorAll("[data-fx]").forEach(b=>b.onclick=async()=>{const m=b.dataset.fx;if(m===fxMode)return;document.querySelectorAll("[data-fx]").forEach(x=>x.disabled=true);
 try{await api("profile","PUT",{fx:m});setFx(m,true);alog("fire",m);toast({off:"Retour au calme. Repos !",sgt:"Mode Braise activé. Garde-à-vous !",fire:"Mode On Fire allumé. Ça va chauffer !"}[m]);viewProfile()}catch(e){document.querySelectorAll("[data-fx]").forEach(x=>x.disabled=false);toast(e.error||"Erreur.")}})}
function updCard(){return `<div class="sect">Mise à jour</div><div class="card"><p class="small" style="margin:0 0 10px">Version installée : <b>${APP_VER}</b> · <span id="verOnline">en ligne : vérification…</span></p><button class="btn sec full" id="forceUpd">${I.refresh} Forcer la mise à jour de l'appli</button><p class="small" style="margin:8px 0 0">Recharge la dernière version mise en ligne (vide le cache de l'appli, garde tes documents téléchargés et ta progression).</p></div>`}
async function checkOnline(){const el=$("#verOnline");if(!el)return;try{const t=await (await fetch("sw.js?t="+Date.now(),{cache:"no-store"})).text();const m=t.match(/quiz-ci-v?([\d.]+)/);const v=m?m[1]:"?";el.innerHTML=v===APP_VER?"à jour ✓":`en ligne : <b>${v}</b> – mets à jour !`}catch(e){el.textContent="en ligne : hors connexion"}}
async function forceUpdate(){const b=$("#forceUpd");if(b){b.disabled=true;b.textContent="Mise à jour en cours…"}alog("maj","force",{ver:APP_VER});
 try{await Promise.race([syncNow(),new Promise(r=>setTimeout(r,2500))])}catch(e){}try{logFlush(true)}catch(e){}
 try{if("serviceWorker" in navigator){const rs=await navigator.serviceWorker.getRegistrations();await Promise.all(rs.map(r=>r.unregister()))}}catch(e){}
 try{if(window.caches){const ks=await caches.keys();await Promise.all(ks.filter(k=>k!=="quiz-ci-docs").map(k=>caches.delete(k)))}}catch(e){}
 location.replace(location.pathname+"?maj="+Date.now())}
function usageCard(){return `<div class="sect">Mode d'utilisation</div><div class="card">
  <div class="seg usage"><button data-usage="apprenti" aria-pressed="${usage==="apprenti"}">${CROSS_IC}<span>Apprenti</span></button><button data-usage="ci" aria-pressed="${usage==="ci"}">${HELMET_IC}<span>CI BSPP</span></button></div>
  <p class="small" style="margin:10px 0 0">${usage==="ci"?"<b>Mode CI BSPP</b> : l'appli garde le défi de la semaine et tes outils de garde (documents, codes CRI, messages radio, grades, carte des secteurs). L'entraînement est masqué, ta progression est conservée. Ce choix suit ton compte sur tous tes appareils.":"<b>Mode Apprenti</b> : tout l'entraînement (quiz, niveaux Sapeur et Officier, révisions, évaluation par fiche) en plus des outils. Passe en mode CI BSPP une fois ta formation validée."}</p></div>`}
function bindUsage(){app.querySelectorAll("[data-usage]").forEach(b=>b.onclick=()=>{if(usage===b.dataset.usage)return;setUsage(b.dataset.usage);renderTabs();viewProfile();toast(usage==="ci"?"Mode CI BSPP activé.":"Mode Apprenti activé.")})}
function viewMe(head){app.innerHTML=head+`${meCard()}${me&&!me.expired?rankCard():""}${usageCard()}${fireCard()}<div class="sect">Aide</div><div class="list"><button class="row" id="openTuto"><span class="ic" style="background:#e3051b">${TUTO_IC}</span><span class="tx"><b>Tutoriel et présentation</b><span>Revoir la visite guidée de l'appli</span></span><span class="chev">${I.chev}</span></button></div><p class="small" style="margin:8px 4px 0">Pour corriger les bugs, l'appli enregistre ton activité (pages ouvertes, boutons touchés, réponses, erreurs) pendant 30 jours. Seuls les administrateurs y ont accès.</p>${updCard()}${accountCard()}`;bindProfTabs();bindMe();bindUsage();bindFire();bindRank();$("#openTuto").onclick=()=>openTuto();$("#forceUpd").onclick=forceUpdate;checkOnline()}
/* ---- graphiques d'évolution (barres SVG, une seule série : pas de légende, le titre la nomme) ---- */
let evoPer=store.get("evoPer","w");
const MOIS=["janv.","févr.","mars","avr.","mai","juin","juil.","août","sept.","oct.","nov.","déc."];
const perLabel=k=>/S\d+$/.test(k)?"S"+(+k.split("-S")[1]):MOIS[+k.slice(5)-1];
const perLong=k=>/S\d+$/.test(k)?"Semaine "+(+k.split("-S")[1])+" ("+k.slice(0,4)+")":MOIS[+k.slice(5)-1]+" "+k.slice(0,4);
function barChart(keys,vals,cur,id){const W=320,H=150,pl=30,pb=20,pt=18,n=keys.length,bw=(W-pl-4)/n,max=Math.max(10,...vals);const nice=v=>{const p=Math.pow(10,Math.floor(Math.log10(v)));const m=v/p;return (m<=1?1:m<=2?2:m<=5?5:10)*p};const top=nice(max);const y=v=>pt+(H-pt-pb)*(1-v/top);
 let g=`<svg class="evo" viewBox="0 0 ${W} ${H}" role="img" aria-labelledby="${id}t"><title id="${id}t">${esc(keys.map((k,i)=>perLong(k)+" : "+vals[i]+" points").join(" ; "))}</title>`;
 [0,.5,1].forEach(f=>{const yy=y(top*f);g+=`<line x1="${pl}" x2="${W}" y1="${yy}" y2="${yy}" class="evg"/><text x="${pl-5}" y="${yy+3.5}" class="evy">${Math.round(top*f).toLocaleString("fr-FR")}</text>`});
 keys.forEach((k,i)=>{const v=vals[i],x=pl+2+i*bw,w=Math.max(4,bw-3),yy=y(v),h=Math.max(0,H-pb-yy),r=Math.min(4,w/2,h);
  g+=`<g class="evb ${k===cur?"cur":""}" data-ev="${i}"><rect x="${x}" y="${pt}" width="${w}" height="${H-pb-pt}" class="evhit"/>${h>0?`<path d="M${x},${H-pb}V${yy+r}q0,-${r} ${r},-${r}h${w-2*r}q${r},0 ${r},${r}V${H-pb}z" class="evbar"/>`:`<line x1="${x}" x2="${x+w}" y1="${H-pb-.5}" y2="${H-pb-.5}" class="evzero"/>`}
   <text x="${x+w/2}" y="${H-6}" class="evx">${(n<=12||i%2===0)?perLabel(k):""}</text>${k===cur&&v?`<text x="${x+w/2}" y="${yy-5}" class="evv">${v.toLocaleString("fr-FR")}</text>`:""}</g>`});
 return g+`</svg><div class="evtip" id="${id}tip"></div>`}
function bindChart(id,keys,vals,unit){const box=document.getElementById(id);if(!box)return;const tip=document.getElementById(id+"tip");
 box.querySelectorAll("[data-ev]").forEach(b=>{const show=()=>{box.querySelectorAll(".evb").forEach(x=>x.classList.toggle("sel",x===b));const i=+b.dataset.ev;tip.textContent=`${perLong(keys[i])} : ${vals[i].toLocaleString("fr-FR")} ${unit}`};b.addEventListener("click",show);b.addEventListener("mouseenter",show)})}
function evoData(kind){const P=kind==="m"?lastMonths(12):lastWeeks(12);const cur=kind==="m"?today().slice(0,7):isoWeek();return {P,cur}}
function evoCards(){const {P,cur}=evoData(evoPer);const H=myHist();const mine=P.map(k=>(evoPer==="m"?H.hm:H.hw)[k]||0);
 const tid=myTeamId(),tm=teamOf(tid);let team=null;
 if(tm&&board){const mem=(board.profiles||[]).filter(p=>p.team===tid);team=P.map(k=>{if(!mem.length)return 0;const s=mem.reduce((a,p)=>a+(p.id===me.id?(mine[P.indexOf(k)]):((p.stats&&(evoPer==="m"?p.stats.hm:p.stats.hw)||{})[k]||0)),0);return Math.round(s/mem.length)})}
 const sum=a=>a.reduce((x,y)=>x+y,0),act=mine.filter(v=>v>0);
 const stat=(a)=>{const nz=a.filter(v=>v>0);return `<div class="evst"><span>Moyenne <b>${nz.length?Math.round(sum(nz)/nz.length).toLocaleString("fr-FR"):0}</b></span><span>Meilleure ${evoPer==="m"?"période":"semaine"} <b>${Math.max(0,...a).toLocaleString("fr-FR")}</b></span><span>Total affiché <b>${sum(a).toLocaleString("fr-FR")}</b></span></div>`};
 return `<div class="seg evoper" style="margin:14px 0 10px"><button data-evo="w" aria-pressed="${evoPer==="w"}">Par semaine</button><button data-evo="m" aria-pressed="${evoPer==="m"}">Par mois</button></div>
  <div class="card evcard"><b>Mes points</b><span class="small">${evoPer==="m"?"12 derniers mois":"12 dernières semaines"}</span><div id="evMe">${barChart(P,mine,cur,"evMe")}</div>${stat(mine)}</div>
  ${team?`<div class="card evcard team" style="margin-top:10px"><b>Équipe ${esc(tm.name)}</b><span class="small">Moyenne des points par membre (${(board.profiles||[]).filter(p=>p.team===tid).length} membre(s))</span><div id="evTeam">${barChart(P,team,cur,"evTeam")}</div>${stat(team)}</div>`:`<p class="small" style="margin:10px 4px 0">Rejoins une équipe pour suivre aussi son évolution ici.</p>`}
  <p class="small" style="margin:8px 4px 0">Touche une barre pour voir sa valeur. L'historique démarre avec cette version de l'appli.</p>`}
function bindEvo(){const {P}=evoData(evoPer);const H=myHist();const mine=P.map(k=>(evoPer==="m"?H.hm:H.hw)[k]||0);bindChart("evMe",P,mine,"points");
 const t=$("#evTeam");if(t){const vals=[...t.querySelectorAll("[data-ev]")].map(()=>0);const tid=myTeamId(),mem=(board.profiles||[]).filter(p=>p.team===tid);const tv=P.map((k,i)=>Math.round(mem.reduce((a,p)=>a+(p.id===me.id?mine[i]:((p.stats&&(evoPer==="m"?p.stats.hm:p.stats.hw)||{})[k]||0)),0)/(mem.length||1)));bindChart("evTeam",P,tv,"points en moyenne")}
 app.querySelectorAll("[data-evo]").forEach(b=>b.onclick=()=>{evoPer=b.dataset.evo;store.set("evoPer",evoPer);drawStats()})}
function scoreCard(){const T=cntTotal(),W=wkTotal();const since=days.length?new Date(days[0]+"T12:00:00").toLocaleDateString("fr-FR",{day:"numeric",month:"long",year:"numeric"}):null;
 return `<div class="card scorecard"><div class="kpis"><div class="kpi"><b>${W.points.toLocaleString("fr-FR")}</b><span>points cette semaine</span></div><div class="kpi"><b>${T.points.toLocaleString("fr-FR")}</b><span>points au total</span></div><div class="kpi"><b>${T.answered.toLocaleString("fr-FR")}</b><span>réponses au total</span></div></div>
  <p class="small" style="margin:10px 0 0">Les classements (personnel et équipes) repartent de zéro chaque lundi. Ton total cumule tous tes points${since?` depuis le ${since}`:" depuis ton inscription"}.</p></div>`}
// ====== Statistiques : écran à part, avec ses propres onglets (Résumé · Évolution · Fiches) ======
let statTab=store.get("statTab","sum");
function viewStats(){const ci=usage==="ci";if(ci&&statTab==="fiches")statTab="sum";
 const tabs=[["sum","Résumé"],["evo","Évolution"],...(ci?[]:[["fiches","Fiches"]])];
 app.innerHTML=`${backLink()}<h1 class="big">Statistiques</h1><p class="sub">${ci?"Tes points et leur évolution.":"Ton grade, tes points, ton évolution et ta maîtrise de chaque fiche."}</p>
  <div class="seg sttabs">${tabs.map(([k,l])=>`<button data-st="${k}" aria-pressed="${k===statTab}">${l}</button>`).join("")}</div><div id="stBody"></div>`;
 bindTabBack();bindRank();
 app.querySelectorAll("[data-st]").forEach(b=>b.onclick=()=>{statTab=b.dataset.st;store.set("statTab",statTab);app.querySelectorAll("[data-st]").forEach(x=>x.setAttribute("aria-pressed",x===b));drawStats();window.scrollTo({top:0})});
 drawStats()}
function drawStats(){const el=$("#stBody");if(!el)return;({sum:statSummary,evo:statEvolution,fiches:statFiches}[statTab]||statSummary)(el)}
function statSummary(el){const T=cntTotal(),W=wkTotal(),ci=usage==="ci";const w=isoWeek(),dd=defiDone[w];
 const scored=ALL.filter(x=>SCORED.has(x._k));const seen=scored.filter(x=>hist[x._id]&&hist[x._id].length).length;
 const rate=T.answered?Math.round(T.correct/T.answered*100):0;const since=days.length?new Date(days[0]+"T12:00:00").toLocaleDateString("fr-FR",{day:"numeric",month:"long",year:"numeric"}):null;
 const tile=(v,l,s)=>`<div class="sttile"><b>${v}</b><span>${l}</span>${s?`<small>${s}</small>`:""}</div>`;
 el.innerHTML=`${me&&!me.expired&&!ci?rankCard(true):""}
  <div class="sect">Mes chiffres</div>
  <div class="stgrid">${tile(W.points.toLocaleString("fr-FR"),"points cette semaine","remis à zéro chaque lundi")}${tile(T.points.toLocaleString("fr-FR"),"points au total",since?"depuis le "+since:"")}${tile(rate+" %","de bonnes réponses",T.answered.toLocaleString("fr-FR")+" réponses")}${tile(streak(),"jour"+(streak()>1?"s":"")+" de suite","série en cours")}${ci?"":tile(seen+" / "+scored.length,"questions déjà vues","niveau Officier")}${tile(dd?dd.score+"/20":"—","défi de la semaine",dd?"premier essai":"pas encore joué")}</div>
  ${ci?"":`<div class="sect">Par thème</div><div class="card">${DATA.map(t=>{const v=themePct()[t.id]||0;return `<div class="stth"><span>${esc(short(t))}</span><b>${v} %</b><div class="stbar"><i style="width:${v}%"></i></div></div>`}).join("")}<p class="small" style="margin:8px 0 0">Part des questions acquises (réussies aux deux dernières tentatives) dans chaque thème.</p></div>
  <div class="sect">Records</div><div class="list">${[["Quiz",best.qcm!=null?best.qcm+" %":"—"],["Examen blanc",best.exam!=null?best.exam+" %":"—"],["Vrai ou faux 60 s",best.chrono!=null?best.chrono+" bonnes réponses":"—"]].map(([a,b])=>`<div class="row"><span class="tx"><b>${a}</b></span><span>${b}</span></div>`).join("")}</div>`}
  <div class="actions" style="margin-top:14px"><button class="btn sec full" data-goevo>Voir mon évolution</button></div>`;
 bindRank(el);const g=el.querySelector("[data-goevo]");if(g)g.onclick=()=>{statTab="evo";store.set("statTab",statTab);app.querySelectorAll("[data-st]").forEach(x=>x.setAttribute("aria-pressed",x.dataset.st==="evo"));drawStats();window.scrollTo({top:0})}}
function statEvolution(el){el.innerHTML=evoCards();bindEvo()}
function statFiches(el){const rows=FICHES.map(f=>({f,s:ficheStats(f.id)})).filter(x=>x.s.n>0);const g=globalStats();
 const order={ko:0,warn:1,none:2,ok:3};
 const shown=rows.filter(x=>profFilter==="all"||x.s.st===profFilter).sort((a,b)=>order[a.s.st]-order[b.s.st]||b.s.ko-a.s.ko||b.s.n-a.s.n);
 el.innerHTML=`<div class="card" style="margin-top:12px"><div class="kpis"><div class="kpi"><b>${g.by.ok}</b><span>fiches acquises</span></div><div class="kpi"><b>${g.by.warn}</b><span>en cours</span></div><div class="kpi"><b>${g.by.ko}</b><span>à travailler</span></div></div>
   <div class="prog" style="height:10px;margin-top:14px"><i class="p1" style="width:${g.by.ok/rows.length*100}%"></i><i class="p2" style="width:${g.by.warn/rows.length*100}%"></i><i class="p3" style="width:${g.by.ko/rows.length*100}%"></i></div>
   <div class="legend"><span><i style="background:var(--ok)"></i>Acquise</span><span><i style="background:var(--warn)"></i>En cours</span><span><i style="background:var(--ko)"></i>À travailler</span><span><i style="background:var(--card2)"></i>Pas encore vue</span></div></div>
  <div class="chips stfilter" style="margin-top:12px">${[["ko","À travailler"],["warn","En cours"],["ok","Acquises"],["none","Pas vues"],["all","Toutes"]].map(([k,l])=>`<button class="chip" data-pf="${k}" aria-pressed="${k===profFilter}">${l} (${k==="all"?rows.length:rows.filter(x=>x.s.st===k).length})</button>`).join("")}</div>
  <div class="list" style="margin-top:10px">${shown.map(({f,s})=>`<button class="row" data-fiche="${esc(f.id)}"><span class="tx"><b>${esc(f.label)}</b><span>${s.ok}/${s.n} acquises${s.ko?` · ${s.ko} ratée(s)`:""}</span><span class="prog"><i class="p1" style="width:${s.ok/s.n*100}%"></i><i class="p3" style="width:${s.ko/s.n*100}%"></i></span></span><span class="pill ${ST[s.st][1]}">${ST[s.st][0]}</span></button>`).join("")||`<div class="row"><span class="tx"><span>${profFilter==="ko"?"Aucune fiche à travailler pour l'instant. Joue quelques quiz pour lancer l'évaluation.":"Aucune fiche dans cette catégorie."}</span></span></div>`}</div>
  <p class="small" style="margin:8px 4px 0">Touche une fiche pour réviser ses questions. Une question est acquise quand tu as réussi tes deux dernières tentatives. Une fiche est acquise à partir de 80 % de questions acquises, et à travailler sous 60 % de réussite sur les questions vues.</p>
  <div class="sect">Réinitialiser</div>
  <div class="card"><p style="margin:0 0 12px">Remet à zéro l'évaluation continue : fiches, questions à revoir, records, série et défis joués. Ton grade et tes points sont conservés.</p>
   ${confirmReset?`<div class="confirm"><b>Tout effacer ?</b><p class="small" style="margin:4px 0 12px">Cette action ne peut pas être annulée.</p><div class="actions" style="margin:0"><button class="btn" id="resetYes" style="background:var(--ko)">Oui, tout effacer</button><button class="btn sec" id="resetNo">Annuler</button></div></div>`:`<button class="btn sec full" id="resetBtn" style="color:var(--ko)">Réinitialiser mon évaluation</button>`}</div>`;
 el.querySelectorAll("[data-pf]").forEach(b=>b.onclick=()=>{profFilter=b.dataset.pf;drawStats()});
 el.querySelectorAll("[data-fiche]").forEach(b=>b.onclick=()=>ficheSheet(b.dataset.fiche));
 const rb=$("#resetBtn");if(rb)rb.onclick=()=>{confirmReset=true;drawStats();$("#resetYes").scrollIntoView({block:"center"})};
 const ry=$("#resetYes");if(ry)ry.onclick=()=>{localReset();confirmReset=false;syncNow();drawStats()};
 const rn=$("#resetNo");if(rn)rn.onclick=()=>{confirmReset=false;drawStats()}}
function ficheSheet(fid){const f=FICHE[fid],s=ficheStats(fid);const q=s.items.filter(x=>x._k==="qcm"||x._k==="vf").length,fl=s.items.filter(x=>x._k==="flashcards").length;
  const sh=sheet(`<span class="pill ${ST[s.st][1]}">${ST[s.st][0]}</span><h2 style="margin-top:8px">${esc(f.label)}</h2><p class="small">${esc(f.doc||(DOC[f.d]?DOC[f.d].t:""))}</p>
   <div class="card" style="margin:12px 0"><div class="kpis"><div class="kpi"><b>${s.ok}</b><span>acquises</span></div><div class="kpi"><b>${s.ko}</b><span>ratées</span></div><div class="kpi"><b>${s.n-s.seen}</b><span>pas vues</span></div></div></div>
   <div class="actions" style="flex-direction:column">${q?`<button class="btn full" id="fq">Réviser en quiz (${Math.min(q,15)} questions)</button>`:""}${fl?`<button class="btn sec full" id="ff">Flashcards (${fl})</button>`:""}${f.d&&DOC[f.d]?`<button class="btn sec full" id="fd">Ouvrir le document, p. ${f.p}</button>`:""}<button class="btn sec full" data-close>Fermer</button></div>`);
  const a=sh.querySelector("#fq");if(a)a.onclick=()=>{closeSheet();reviseFiche(fid)};
  const b=sh.querySelector("#ff");if(b)b.onclick=()=>{closeSheet();runFlash(shuffle(s.items.filter(x=>x._k==="flashcards")),()=>go(tab))};
  const c=sh.querySelector("#fd");if(c)c.onclick=()=>{closeSheet();openDoc(f.d,f.p,[])}}
function reviseFiche(fid){const items=ALL.filter(x=>x.f===fid&&(x._k==="qcm"||x._k==="vf"));
  const sorted=items.sort((a,b)=>(known(a._id)===false?0:known(a._id)===null?1:2)-(known(b._id)===false?0:known(b._id)===null?1:2));
  if(items.length)runQuiz(sorted.slice(0,15),"fiche",true,()=>go(tab));else{const fl=ALL.filter(x=>x.f===fid&&x._k==="flashcards");if(fl.length)runFlash(shuffle(fl),()=>go(tab))}}

/* ============ Équipe : connexion Google, profils, classement, administration ============ */
let me=store.get("me",null);       // {id,token,pseudo,unite,color,email,admin,superAdmin,resetSeen,team}
let apiState=store.get("apiState","unknown"); // ok | absent | unknown
let board=store.get("board",null);
let srvCfg=store.get("srvCfg",null); // {google,clientId,teamCode}
const COLORS=["#e3051b","#0a84ff","#34c759","#ff9f0a","#5e5ce6","#30b0c7","#ff375f","#8e8e93"];
const saveMe=()=>me?store.set("me",me):store.del("me");
async function api(path,method="GET",body,retried){
  const h={};if(body||method!=="GET")h["content-type"]="application/json";
  let b=body;if(me&&me.token){h["authorization"]="Bearer "+me.id+":"+me.token;h["x-id"]=me.id;h["x-token"]=me.token;if(method!=="GET")b={...(body||{}),id:me.id,token:me.token}}
  const sep=path.includes("?")?"&":"?";const url="api/"+path+(me&&me.token&&method==="GET"?`${sep}uid=${encodeURIComponent(me.id)}&tk=${encodeURIComponent(me.token)}`:"");
  const apiT0=Date.now();let r;try{r=await fetch(url,{method,headers:h,body:b?JSON.stringify(b):undefined,cache:"no-store",credentials:"same-origin"})}catch(e){if(path!=="log")alog("api",method+" "+path.split("?")[0]+" → hors connexion",{duree:Date.now()-apiT0+" ms"});throw {offline:true,error:"Pas de connexion. Réessaie avec du réseau."}}
  if(r.status===404&&!(r.headers.get("content-type")||"").includes("json")){apiState="absent";store.set("apiState",apiState);throw {absent:true,error:"Le classement n'est pas activé sur ce site."}}
  let j={};try{j=await r.json()}catch(e){}
  apiState="ok";store.set("apiState",apiState);
  if(!r.ok){store.set("lastErr",{at:Date.now(),path,method,status:r.status,code:j.code||"",msg:j.error||""});if(path!=="log")alog("api",method+" "+path.split("?")[0]+" → "+r.status,{code:j.code||"",message:j.error||"",duree:Date.now()-apiT0+" ms"})}
  if(r.status===401&&me&&me.token&&!retried){await new Promise(res=>setTimeout(res,2500));return api(path,method,body,true)}
  if(r.status===401&&me&&me.token){me.expired=true;saveMe();setTimeout(()=>location.replace(location.pathname),300)}
  if(!r.ok)throw {status:r.status,error:j.error||"Erreur "+r.status};return j}
async function loadCfg(){try{srvCfg=await api("config");store.set("srvCfg",srvCfg)}catch(e){}return srvCfg}
function themePct(){const o={};DATA.forEach(t=>{const items=ALL.filter(x=>x._t===t&&SCORED.has(x._k));const k=items.filter(x=>known(x._id)).length;o[t.id]=items.length?Math.round(k/items.length*100):0});return o}
function buildStats(){const g=globalStats();const w=isoWeek();
  const T=cntTotal(),W=wkTotal(),H=myHist();return {points:W.points,week:w,total:T.points,hw:H.hw,hm:H.hm,answered:T.answered,correct:T.correct,fichesOk:g.by.ok,fichesTotal:FICHES.length,seen:Object.keys(hist).length,streak:streak(),
    rank:rankObj.g,dw:Object.values(duelCr).filter(v=>v===30).length,dl:Object.values(duelCr).filter(v=>v===10).length,bestExam:best.exam||0,bestQcm:best.qcm||0,bestChrono:best.chrono||0,themes:themePct(),defi:defiDone[w]?{week:w,score:defiDone[w].score,ms:defiDone[w].ms}:null}}
function mergeProgress(a, b) {
  a = a || {}; b = b || {};
  const rdA = a.radio, rdB = b.radio; // l'indicatif radio survit aux remises à zéro
  const usA = a.usage, usB = b.usage; // le mode d'utilisation aussi
  const wkA = a.wk, wkB = b.wk; // points de la semaine (par appareil)
  const dpA = a.dp, dpB = b.dp; // points par jour et par appareil (historique des graphiques)
  const ra = Number(a.resetAt) || 0, rb = Number(b.resetAt) || 0;
  if (rb > ra) a = { resetAt: rb }; else if (ra > rb) b = { resetAt: ra };
  const out = { v: 1, resetAt: Math.max(ra, rb), hist: {}, histT: {}, best: {}, days: [], defi: {}, cntDev: {}, marks: {} };
  const okId = (k) => typeof k === "string" && k.length <= 60;
  const ha = a.hist || {}, hb = b.hist || {}, ta = a.histT || {}, tb = b.histT || {};
  for (const id of new Set([...Object.keys(ha), ...Object.keys(hb)])) {
    if (!okId(id)) continue;
    const x = Array.isArray(ha[id]) ? ha[id] : null, y = Array.isArray(hb[id]) ? hb[id] : null;
    const tx = Number(ta[id]) || 0, ty = Number(tb[id]) || 0;
    const pick = !x ? y : !y ? x : ty > tx ? y : tx > ty ? x : (y.length >= x.length ? y : x);
    if (!pick || !pick.length) continue;
    out.hist[id] = pick.slice(-5).map((v) => (v ? 1 : 0)); out.histT[id] = Math.max(tx, ty);
  }
  for (const s of [a.best || {}, b.best || {}]) for (const [k, v] of Object.entries(s)) if (typeof v === "number" && okId(k) && !(out.best[k] >= v)) out.best[k] = Math.min(v, 1000);
  out.days = [...new Set([...(a.days || []), ...(b.days || [])].filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)))].sort().slice(-400);
  for (const s of [b.defi || {}, a.defi || {}]) for (const [w, v] of Object.entries(s)) if (/^\d{4}-S\d{2}$/.test(w) && v && typeof v.score === "number") out.defi[w] = { score: v.score, ms: Number(v.ms) || 0 };
  for (const s of [a.cntDev || {}, b.cntDev || {}]) for (const [d, c] of Object.entries(s)) {
    if (!okId(d) || !c) continue; const o = out.cntDev[d] || { points: 0, answered: 0, correct: 0 };
    for (const k of ["points", "answered", "correct"]) o[k] = Math.max(o[k], Number(c[k]) || 0);
    out.cntDev[d] = o;
  }
  const ma = a.marks || {}, mb = b.marks || {};
  for (const id of new Set([...Object.keys(ma), ...Object.keys(mb)])) {
    if (!okId(id)) continue; const x = ma[id], y = mb[id];
    const pick = !x ? y : !y ? x : (Number(y.t) || 0) >= (Number(x.t) || 0) ? y : x;
    if (pick) out.marks[id] = { on: !!pick.on, t: Number(pick.t) || 0 };
  }
  const rd = [rdA, rdB].filter((x) => x && typeof x === "object").sort((x, y) => (Number(y.t) || 0) - (Number(x.t) || 0))[0];
  const us = [usA, usB].filter((x) => x && typeof x === "object" && (x.v === "ci" || x.v === "apprenti")).sort((x, y) => (Number(y.t) || 0) - (Number(x.t) || 0))[0];
  if (us) out.usage = { v: us.v, t: Number(us.t) || 0 };
  {
    const dp = {};
    for (const src of [dpA, dpB]) if (src && typeof src === "object") for (const [day, devs] of Object.entries(src)) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !devs || typeof devs !== "object") continue;
      const o = dp[day] || (dp[day] = {});
      for (const [dev, v] of Object.entries(devs)) { if (typeof dev !== "string" || dev.length > 60 || !Array.isArray(v)) continue; const c = o[dev] || [0, 0, 0]; o[dev] = [0, 1, 2].map((i) => Math.max(c[i], Math.min(1e6, Number(v[i]) || 0))); }
    }
    const days = Object.keys(dp).sort().slice(-400); if (days.length) { out.dp = {}; for (const d of days) out.dp[d] = dp[d]; }
  }
  {
    const ok = (x) => x && typeof x === "object" && /^\d{4}-S\d{2}$/.test(x.w || "");
    const list = [wkA, wkB].filter(ok);
    if (list.length) {
      const w = list.map((x) => x.w).sort().pop(); const d = {};
      for (const x of list.filter((x) => x.w === w)) for (const [dev, c] of Object.entries(x.d || {})) {
        if (typeof dev !== "string" || dev.length > 60 || !c) continue; const o = d[dev] || { points: 0, answered: 0, correct: 0 };
        for (const k of ["points", "answered", "correct"]) o[k] = Math.max(o[k], Number(c[k]) || 0); d[dev] = o;
      }
      out.wk = { w, d };
    }
  }
  {
    const rk = [a.rank, b.rank].filter((x) => x && typeof x === "object").sort((x, y) => (Number(y.t) || 0) - (Number(x.t) || 0))[0];
    const n = (v, m) => Math.max(0, Math.min(m, Math.floor(Number(v) || 0)));
    if (rk) out.rank = { g: n(rk.g, 16), ex: n(rk.ex, 999), bad: n(rk.bad, 10), wait: n(rk.wait, 20), t: Number(rk.t) || 0, h: (Array.isArray(rk.h) ? rk.h : []).slice(-30).map((x) => ({ g: n(x && x.g, 16), t: Number(x && x.t) || 0, d: x && x.d < 0 ? -1 : 1 })) };
  }
  {
    const dc = {}; for (const src of [a.dcr, b.dcr]) if (src && typeof src === "object") for (const k of Object.keys(src)) if (/^[a-f0-9]{6,20}$/.test(k)) dc[k] = 1;
    const ks = Object.keys(dc).slice(-300); if (ks.length) { out.dcr = {}; for (const k of ks) out.dcr[k] = 1; }
  }
  if (rd) out.radio = { num: String(rd.num || "").slice(0, 6), cs: String(rd.cs || "").slice(0, 40), golf: String(rd.golf || "").slice(0, 3), t: Number(rd.t) || 0 };
  return out;
}

function localProgress(){return {v:1,resetAt:progReset,hist,histT,best,days,defi:defiDone,cntDev,marks:marksLog,radio:radioId,usage:usageObj,wk:wkDev,dp:dayPts,rank:rankObj,dcr:duelCr}}
function applyProgress(p){if(p.dcr&&typeof duelCr!=="undefined"){for(const[k,v]of Object.entries(p.dcr))duelCr[k]=Math.max(+duelCr[k]||0,+v||1);store.set("duelCr",duelCr)}if(p.rank&&(+p.rank.t||0)>(+rankObj.t||0)){rankObj=rankFix(p.rank);store.set("rank",rankObj)}else if(!p.rank&&(+p.resetAt||0)>(+rankObj.t||0)){rankObj=rankFix({});store.set("rank",rankObj)}hist=p.hist||{};histT=p.histT||{};best=p.best||{};days=p.days||[];defiDone=p.defi||{};cntDev=p.cntDev||{};if(!cntDev[DEV])cntDev[DEV]={points:0,answered:0,correct:0};cnt=cntDev[DEV];
  marksLog=p.marks||{};rebuildMarks();progReset=p.resetAt||0;if(p.radio&&(+p.radio.t||0)>=(+radioId.t||0)){radioId=p.radio;store.set("radioId",radioId)}if(p.dp){dayPts=p.dp;store.set("dayPts",dayPts)}if(p.wk){wkDev=p.wk;if(!wkDev.d)wkDev.d={};store.set("wkDev",wkDev)}if(p.usage&&(+p.usage.t||0)>(+usageObj.t||0)){const ch=p.usage.v!==usage;usageObj=p.usage;usage=p.usage.v;store.set("usageObj",usageObj);store.set("usage",usage);if(ch&&typeof renderTabs==="function"){setTimeout(()=>{renderTabs();if(!visTabs().some(x=>x[0]===tab))go("home");else if(!document.body.classList.contains("pushed")&&!$("#sheet"))go(tab,true)},0)}}
  review=new Set(Object.entries(hist).filter(([id,h])=>h.length&&h[h.length-1]===0&&BYID[id]).map(([id])=>id));
  store.set("hist",hist);store.set("histT",histT);store.set("best",best);store.set("days",days);store.set("defi",defiDone);store.set("cntDev",cntDev);store.set("marksLog",marksLog);store.set("progReset",progReset);store.set("review",[...review])}
function localReset(){applyProgress({resetAt:Date.now()})}
let progLoaded=false;
let syncT=null,syncing=false;
let dirty=false;
function syncSoon(delay){if(!me||me.expired)return;dirty=true;clearTimeout(syncT);syncT=setTimeout(()=>{if(navigator.onLine!==false)syncNow()},delay||1200)}
// synchronisation automatique : après chaque réponse (regroupée), au retour dans l'appli, au retour du réseau et toutes les 5 minutes
document.addEventListener("visibilitychange",()=>{if(document.hidden){if(dirty)syncNow()}else if(me&&!me.expired){syncNow()}});
window.addEventListener("online",()=>{if(me&&!me.expired)syncNow()});
setInterval(()=>{if(!document.hidden&&me&&!me.expired)syncNow()},5*60e3);
async function syncNow(){if(!me||me.expired||syncing)return;syncing=true;dirty=false;const sT0=Date.now();
  try{const before=JSON.stringify(localProgress());
    const pr=await api("progress","PUT",{progress:localProgress()});
    if(pr&&pr.progress){applyProgress(pr.progress);progLoaded=true;if(JSON.stringify(localProgress())!==before)refreshLocalViews()}
    let j=await api("profile","PUT",{stats:buildStats()});if(j&&j.profile)setFx(fxFrom(j.profile));
    if(typeof j.admin==="boolean"&&j.admin!==me.admin){me.admin=j.admin;saveMe()}
    store.set("lastSync",Date.now());await loadBoard(true);alog("sync","ok",{duree:Date.now()-sT0+" ms",points:typeof cntTotal==="function"?cntTotal().points:""})}
  catch(e){dirty=true;alog("sync","échec",{erreur:String(e&&(e.error||e.message)||e).slice(0,160),duree:Date.now()-sT0+" ms"})}finally{syncing=false}}
function refreshLocalViews(){if(document.body.classList.contains("pushed")||$("#sheet"))return;if(tab==="home")viewHome();else if(tab==="profile")viewProfile();else if(tab==="revise")viewRevise()}
async function loadBoard(silent){if(!me||me.expired)return null;
  try{const j=await api("board");board={profiles:j.profiles,teams:j.teams||[],at:Date.now()};store.set("board",board);try{const mine=j.profiles.find(p=>me&&p.id===me.id);if(mine&&typeof setFx==="function")setFx(fxFrom(mine))}catch(e){}refreshTeamViews();return board}
  catch(e){if(!silent)throw e;return null}}
function refreshTeamViews(){if(document.body.classList.contains("pushed")||$("#sheet"))return;
  if(tab==="profile")viewProfile();
  const hb=$("#homeBoard");if(hb&&tab==="home")hb.outerHTML=homeBoard()}

/* ---- connexion Google (fonctionne aussi depuis l'appli installée : l'appli récupère la session par interrogation) */
let pollT=null;
function randHex(n){const a=new Uint8Array(n/2);crypto.getRandomValues(a);return [...a].map(b=>b.toString(16).padStart(2,"0")).join("")}
function loginGoogle(){if(!srvCfg||!srvCfg.clientId)return;const code=randHex(32);store.set("pendingLogin",{code,at:Date.now()});
  const p=new URLSearchParams({client_id:srvCfg.clientId,redirect_uri:location.origin+"/api/auth/google",response_type:"id_token",scope:"openid email profile",nonce:code,state:code,response_mode:"form_post",prompt:"select_account"});
  startPoll();location.href="https://accounts.google.com/o/oauth2/v2/auth?"+p}
function startPoll(){clearInterval(pollT);pollT=setInterval(pollLogin,2000);pollLogin()}
async function pollLogin(){const pl=store.get("pendingLogin",null);if(!pl||Date.now()-pl.at>15*60e3){store.del("pendingLogin");clearInterval(pollT);return}
  try{const r=await fetch("api/auth/poll?code="+pl.code,{cache:"no-store"});const j=await r.json();if(j.pending)return;
    clearInterval(pollT);store.del("pendingLogin");if(j.error){toast(j.error);return}
    me={id:j.id,token:j.token,email:j.email,admin:j.admin,superAdmin:j.superAdmin,pseudo:j.profile.pseudo,unite:j.profile.unite,color:j.profile.color,resetSeen:Date.now()};saveMe();
    profTab="moi";store.set("profTab",profTab);go("profile");if(j.isNew)profileSheet(true,true);else toast("Connecté : "+j.email);syncNow()}catch(e){}}
document.addEventListener("visibilitychange",()=>{if(!document.hidden&&store.get("pendingLogin",null))startPoll()});
function toast(t){const d=document.createElement("div");d.className="toast";d.textContent=t;document.body.appendChild(d);setTimeout(()=>d.remove(),3200)}
async function clearProtected(){try{for(const k of await caches.keys()){const c=await caches.open(k);if(k==="quiz-ci-docs"){await caches.delete(k);continue}await c.delete("data.js");await c.delete("search.json");await c.delete("secteurs.json");await c.delete("simple.js");for(const r of await c.keys()){if(/\/(data\.js|search\.json|secteurs\.json|simple\.js)$/.test(new URL(r.url).pathname))await c.delete(r)}}}catch(e){}}
async function logout(){try{await syncNow()}catch(e){}try{await api("logout","POST",{})}catch(e){}applyProgress({resetAt:0});store.del("progOwner");me=null;saveMe();board=null;store.del("board");await clearProtected();location.replace(location.pathname)}

/* ---- affichage */
const initials=s=>String(s||"?").trim().split(/\s+/).map(w=>w[0]).join("").slice(0,2).toUpperCase();
const avatar=(p,size=36)=>`<span class="av" style="width:${size}px;height:${size}px;background:${esc(p.color||"#8e8e93")};font-size:${Math.round(size*.4)}px">${esc(initials(p.pseudo))}</span>`;
const METRICS={
  defi:{l:()=>"Défi "+isoWeek(),f:p=>p.stats&&p.stats.defi&&p.stats.defi.week===isoWeek(),v:p=>p.stats.defi.score,fmt:p=>`${p.stats.defi.score}/20 · ${fmtTime(p.stats.defi.ms)}`,sort:(a,b)=>b.stats.defi.score-a.stats.defi.score||a.stats.defi.ms-b.stats.defi.ms},
  points:{l:()=>"Points de la semaine",f:p=>wpts(p)>0,v:p=>wpts(p),fmt:p=>wpts(p).toLocaleString("fr-FR")+" pts"},
  fiches:{l:()=>"Fiches acquises",f:p=>p.stats&&p.stats.fichesOk>0,v:p=>p.stats.fichesOk,fmt:p=>`${p.stats.fichesOk}/${p.stats.fichesTotal}`},
  reussite:{l:()=>"Réussite",f:p=>p.stats&&p.stats.answered>=20,v:p=>p.stats.correct/p.stats.answered,fmt:p=>Math.round(p.stats.correct/p.stats.answered*100)+" %"},
  exam:{l:()=>"Examen blanc",f:p=>p.stats&&p.stats.bestExam>0,v:p=>p.stats.bestExam,fmt:p=>p.stats.bestExam+" %"},
  serie:{l:()=>"Série",f:p=>p.stats&&p.stats.streak>0,v:p=>p.stats.streak,fmt:p=>p.stats.streak+" j"},
};
let boardScope=store.get("boardScope","team");
function myTeamId(){const mine=(board&&board.profiles||[]).find(p=>me&&p.id===me.id);return mine?mine.team:(me&&me.team)||null}
function teamOf(id){return (board&&board.teams||[]).find(t=>t.id===id)||null}
function scopeProfiles(){const all=board&&board.profiles||[];const t=myTeamId();return boardScope==="team"&&t?all.filter(p=>p.team===t):all}
function ranked(m){const M=METRICS[m];const list=scopeProfiles().filter(M.f);return list.sort(M.sort||((a,b)=>M.v(b)-M.v(a)))}
function myRank(m){const r=ranked(m);const i=r.findIndex(p=>me&&p.id===me.id);return i<0?null:{pos:i+1,of:r.length}}
function teamRanking(){const P=board&&board.profiles||[];return (board&&board.teams||[]).map(t=>{const m=P.filter(p=>p.team===t.id);const pts=m.map(p=>wpts(p));const sum=pts.reduce((a,b)=>a+b,0);
  return {t,n:m.length,sum,avg:m.length?Math.round(sum/m.length):0}}).sort((a,b)=>b.avg-a.avg||b.n-a.n||String(a.t.name).localeCompare(b.t.name))}
// ====== Classements : navigation en profondeur (Classements › équipe › membre) ======
let rkNav={v:"top"};const RKM=[["points","Points"],["defi","Défi"],["fiches","Fiches"],["duels","Duels"]];let rkMetric=store.get("rkMetric","points");
const rkVal={points:p=>wpts(p),defi:p=>p.stats&&p.stats.defi&&p.stats.defi.week===isoWeek()?p.stats.defi.score*1e7-(p.stats.defi.ms||0)/1000:null,fiches:p=>p.stats&&p.stats.fichesOk||0,duels:p=>p.stats&&(p.stats.dw||p.stats.dl)?(p.stats.dw||0)*1000+(p.stats.dw||0)-(p.stats.dl||0):null};
const rkFmt={points:p=>wpts(p).toLocaleString("fr-FR")+" pts",defi:p=>p.stats&&p.stats.defi&&p.stats.defi.week===isoWeek()?`${p.stats.defi.score}/20 · ${fmtTime(p.stats.defi.ms)}`:"pas joué",fiches:p=>`${p.stats&&p.stats.fichesOk||0}/${p.stats&&p.stats.fichesTotal||FICHES.length}`,duels:p=>p.stats&&(p.stats.dw||p.stats.dl)?`${p.stats.dw||0} V · ${p.stats.dl||0} D`:"aucun"};
function rkGo(v){rkNav=v;renderBoard(true);window.scrollTo({top:0})}
function rkCrumb(parts){return `<div class="rkcrumb">${parts.map((x,i)=>i<parts.length-1?`<button data-crumb="${i}">${esc(x[0])}</button><span>›</span>`:`<b>${esc(x[0])}</b>`).join("")}</div>`}
function bindCrumb(el,parts){el.querySelectorAll("[data-crumb]").forEach(b=>b.onclick=()=>rkGo(parts[+b.dataset.crumb][1]))}
function rkUpdated(){return `<p class="small" style="margin:12px 4px 6px">${board&&board.at?`Mis à jour ${new Date(board.at).toLocaleString("fr-FR",{weekday:"short",hour:"2-digit",minute:"2-digit"})}`:"Pas encore chargé"}</p><button class="btn sec full" id="bRefresh">Actualiser</button><p class="small" id="bMsg" style="margin:8px 4px"></p>`}
function bindRefresh(){const r=$("#bRefresh");if(r)r.onclick=async()=>{const m=$("#bMsg");m.textContent="Mise à jour…";try{await syncNow();await loadBoard();m.textContent=""}catch(e){m.textContent=e.error||"Échec de la mise à jour."}}}
function renderBoard(fromRefresh){const el=$("#board");if(!el)return;
 if(!me||me.expired){el.innerHTML=noProfileCard();bindMe();return}
 if(!fromRefresh&&(!board||Date.now()-board.at>8000))loadBoard(true);
 const v=rkNav.v;if(v==="team"||v==="all")return rkList(el);if(v==="member")return rkMember(el);rkTop(el)}
// niveau 1 : mon équipe, les équipes, tout le monde
function rkTop(el){const rows=teamRanking(),mine=myTeamId(),tm=teamOf(mine),all=(board&&board.profiles||[]);const ti=rows.findIndex(x=>x.t.id===mine);
 const meP=all.find(p=>p.id===me.id);const inTeam=tm?all.filter(p=>p.team===mine).sort((a,b)=>wpts(b)-wpts(a)):[];const myRk=inTeam.findIndex(p=>p.id===me.id);
 el.innerHTML=`${tm?`<button class="card rkteam" data-rkteam="${esc(mine)}"><div class="rkteamh"><span class="av" style="width:44px;height:44px;background:var(--navy2);font-size:16px">${esc(initials(tm.name))}</span><div><span class="small">Mon équipe</span><b>${esc(tm.name)}</b></div><span class="chev">${I.chev}</span></div>
   <div class="rkkpi"><div><b>${myRk+1}<small>/${inTeam.length}</small></b><span>ma place</span></div><div><b>${ti+1}<small>/${rows.length}</small></b><span>place de l'équipe</span></div><div><b>${(rows[ti]?rows[ti].avg:0).toLocaleString("fr-FR")}</b><span>pts moyens</span></div></div></button>`:noTeamCard()}
  <div class="sect">Classements de la semaine</div>
  <div class="list">${rows.map((x,i)=>`<button class="row lbrow ${x.t.id===mine?"mine":""}" data-rkteam="${esc(x.t.id)}"><span class="rk ${i<3?"top"+(i+1):""}">${i+1}</span><span class="av" style="width:36px;height:36px;background:var(--navy2);font-size:14px">${esc(initials(x.t.name))}</span><span class="tx"><b>${esc(x.t.name)}${x.t.id===mine?" (mon équipe)":""}</b><span>${x.n} membre${x.n>1?"s":""}</span></span><span class="val">${x.avg.toLocaleString("fr-FR")} pts moy.</span><span class="chev">${I.chev}</span></button>`).join("")}
   <button class="row lbrow" data-rkall><span class="rk"></span><span class="av" style="width:36px;height:36px;background:#8e8e93;font-size:14px">★</span><span class="tx"><b>Tout le monde</b><span>classement général</span></span><span class="val">${all.length} membres</span><span class="chev">${I.chev}</span></button></div>
  <p class="small" style="margin:8px 4px 0">Les équipes sont classées sur la moyenne des points de la semaine de leurs membres (remise à zéro le lundi). Touche une équipe pour voir ses membres, puis un membre pour voir sa fiche.</p>${rkUpdated()}`;
 el.querySelectorAll("[data-rkteam]").forEach(b=>b.onclick=()=>rkGo({v:"team",team:b.dataset.rkteam}));const a=el.querySelector("[data-rkall]");if(a)a.onclick=()=>rkGo({v:"all"});
 bindTeams();bindRefresh()}
// niveau 2 : membres d'une équipe ou de tout le monde, avec le critère choisi (jamais de liste vide)
function rkList(el){const all=(board&&board.profiles||[]);const isTeam=rkNav.v==="team";const t=isTeam?teamOf(rkNav.team):null;
 if(isTeam&&!t){rkGo({v:"top"});return}
 const mem=(isTeam?all.filter(p=>p.team===rkNav.team):all).slice();const V=rkVal[rkMetric];
 const has=mem.filter(p=>V(p)!=null&&(rkMetric!=="points"||true)),none=mem.filter(p=>V(p)==null);
 has.sort((a,b)=>V(b)-V(a)||String(a.pseudo).localeCompare(b.pseudo));none.sort((a,b)=>String(a.pseudo).localeCompare(b.pseudo));
 const parts=[["Classements",{v:"top"}],[isTeam?t.name:"Tout le monde",rkNav]];const mine=myTeamId();
 const row=(p,i)=>`<div class="row lbrow ${p.id===me.id?"mine":""} ${i<0?"off":""}" data-rkmem="${esc(p.id)}"><span class="rk ${i>=0&&i<3?"top"+(i+1):""}">${i>=0?i+1:"–"}</span>${avatar(p)}<span class="tx"><b>${gradeSvg(rankCode((p.stats&&p.stats.rank)||0),"rkmini")}${esc(p.pseudo)}${p.id===me.id?" (toi)":""}${decoHtml(p)}${nickHtml(p)}</b><span>${esc([p.unite,!isTeam&&teamOf(p.team)?teamOf(p.team).name:""].filter(Boolean).join(" · "))}</span></span><span class="val">${esc(rkFmt[rkMetric](p))}</span>${p.id!==me.id?`<button class="dlbtn" data-duelp="${esc(p.id)}" aria-label="Défier ${esc(p.pseudo)}">⚔</button>`:""}</div>`;
 el.innerHTML=`${rkCrumb(parts)}<h2 class="rkh2">${esc(isTeam?t.name:"Tout le monde")}</h2><p class="small" style="margin:0 4px 10px">${mem.length} membre${mem.length>1?"s":""}${isTeam&&rkNav.team===mine?" · mon équipe":""}</p>
  <div class="seg rkm">${RKM.map(([k,l])=>`<button data-rkm="${k}" aria-pressed="${k===rkMetric}">${l}</button>`).join("")}</div>
  ${rkMetric==="defi"?`<div class="card" style="margin:10px 0;display:flex;gap:12px;align-items:center"><div style="flex:1"><b>Défi ${isoWeek()}</b><div class="small">Seul le premier essai compte, égalité départagée au temps.</div></div><button class="btn small" id="bDefi">${defiDone[isoWeek()]?"Rejouer":"Jouer"}</button></div>`:""}
  <div class="list" style="margin-top:10px">${has.map((p,i)=>row(p,i)).join("")}${none.length?`${has.length?`<div class="rksep">${rkMetric==="defi"?"Pas encore joué le défi":rkMetric==="duels"?"Pas encore de duel":"Pas encore de points"}</div>`:""}${none.map(p=>row(p,-1)).join("")}`:""}</div>
  ${isTeam&&rkNav.team===mine?`<div class="actions" style="margin-top:12px;flex-direction:column"><button class="btn sec full" data-teams="1">Changer d'équipe</button><button class="btn sec full" id="leaveTeam">Quitter l'équipe</button>${teamOf(mine)&&teamOf(mine).ownerId===me.id?`<button class="btn sec full" id="delTeam" style="color:var(--ko)">Supprimer l'équipe</button>`:""}</div><p class="small" id="tmMsg"></p>`:""}${rkUpdated()}`;
 bindCrumb(el,parts);el.querySelectorAll("[data-rkm]").forEach(b=>b.onclick=()=>{rkMetric=b.dataset.rkm;store.set("rkMetric",rkMetric);renderBoard(true)});
 el.querySelectorAll("[data-rkmem]").forEach(r=>r.onclick=e=>{if(e.target.closest("[data-duelp],[data-deco],[data-nick]"))return;rkGo({v:"member",id:r.dataset.rkmem,back:rkNav})});
 const d=$("#bDefi");if(d)d.onclick=()=>runQuiz(defiQuestions(),"defi",false);bindTeams();bindRefresh()}
// niveau 3 : fiche d'un membre
function rkMember(el){const all=(board&&board.profiles||[]);const p=all.find(x=>x.id===rkNav.id);if(!p){rkGo(rkNav.back||{v:"top"});return}
 const back=rkNav.back||{v:"top"};const t=teamOf(p.team);const parts=[["Classements",{v:"top"}],...(back.v==="team"?[[teamOf(back.team)?teamOf(back.team).name:"Équipe",back]]:back.v==="all"?[["Tout le monde",back]]:[]),[p.pseudo,rkNav]];
 const s=p.stats||{};const isMe=p.id===me.id;const vs=(typeof duels!=="undefined"?duels:[]).filter(d=>d.status==="done"&&(d.from===p.id||d.to===p.id)&&!isMe);
 const vW=vs.filter(d=>d.winner===me.id).length,vL=vs.filter(d=>d.winner===p.id).length;
 const inTeam=t?all.filter(x=>x.team===p.team).sort((a,b)=>wpts(b)-wpts(a)):[];const tr=inTeam.findIndex(x=>x.id===p.id);
 const tile=(v,l)=>`<div class="sttile"><b>${v}</b><span>${l}</span></div>`;
 el.innerHTML=`${rkCrumb(parts)}<div class="card rkmem"><div class="rkmemh">${avatar(p,56)}<div><b class="rkname">${esc(p.pseudo)}${isMe?" (toi)":""}${decoHtml(p)}</b>${nickHtml(p)?`<div>${nickHtml(p)}</div>`:""}<div class="small">${gradeSvg(rankCode(s.rank||0),"rkmini")}${esc(rankName(s.rank||0))}${t?` · ${esc(t.name)}`:""}${p.unite?` · ${esc(p.unite)}`:""}</div></div></div>
   ${decoOf(p)?`<p class="small rkdeco">${esc(decoText(p))}</p>`:""}</div>
  <div class="stgrid" style="margin-top:12px">${tile(wpts(p).toLocaleString("fr-FR"),"points cette semaine")}${tile((s.total||0).toLocaleString("fr-FR"),"points au total")}${tile(s.answered?Math.round(s.correct/s.answered*100)+" %":"—","de bonnes réponses")}${tile(t&&tr>=0?`${tr+1}<small>/${inTeam.length}</small>`:"—","place dans l'équipe")}${tile(s.defi&&s.defi.week===isoWeek()?s.defi.score+"/20":"—","défi de la semaine")}${tile(`${s.fichesOk||0}<small>/${s.fichesTotal||FICHES.length}</small>`,"fiches acquises")}${tile(s.streak||0,"jours de suite")}${tile(`${s.dw||0} V · ${s.dl||0} D`,"duels")}</div>
  ${isMe?`<p class="small" style="margin:12px 4px">C'est ta fiche telle que les autres la voient. Le détail de ta progression est dans le menu Statistiques.</p>`:`${vs.length?`<div class="card" style="margin-top:12px"><b>Vos duels</b><p class="small" style="margin:4px 0 0">${vW} victoire${vW>1?"s":""} pour toi · ${vL} pour ${esc(p.pseudo)}${vs.length-vW-vL?` · ${vs.length-vW-vL} nul${vs.length-vW-vL>1?"s":""}`:""}</p></div>`:""}<button class="btn full" data-duelp="${esc(p.id)}" style="margin-top:12px">⚔ Défier ${esc(p.pseudo)}</button>`}`;
 bindCrumb(el,parts)}
function noTeamCard(){return `<div class="card"><h2 style="font-size:20px;margin-bottom:6px">Tu n'es dans aucune équipe</h2><p class="small" style="margin:0 0 12px">Rejoins une équipe existante ou crée la tienne pour te comparer à tes coéquipiers.</p><button class="btn full" data-teams="1">Rejoindre ou créer une équipe</button></div>`}
function teamCard(){const tid=myTeamId(),tm=teamOf(tid);
  if(!tm)return `<div class="sect">Mon équipe</div>${noTeamCard()}`;
  const n=(board.profiles||[]).filter(p=>p.team===tid).length;const owner=tm.ownerId===me.id;
  return `<div class="sect">Mon équipe</div><div class="card"><div style="display:flex;gap:12px;align-items:center"><span class="av" style="width:44px;height:44px;background:var(--navy2);font-size:17px">${esc(initials(tm.name))}</span><div style="flex:1;min-width:0"><b style="font-size:18px">${esc(tm.name)}</b><div class="small">${n} membre(s)${owner?" · tu l'as créée":""}</div></div></div>
   ${(()=>{const rk=teamRanking();const i=rk.findIndex(x=>x.t.id===tid);return i<0?"":`<button class="teamrank" id="goTeams"><span class="rk ${i<3?"top"+(i+1):""}" style="font-size:22px;width:auto">${i+1}<sup style="font-size:12px">${i?"e":"re"}</sup></span><span style="flex:1;text-align:left"><b>sur ${rk.length} équipe${rk.length>1?"s":""}</b><br><span class="small">Moyenne : ${rk[i].avg.toLocaleString("fr-FR")} pts par membre</span></span><span class="small" style="color:var(--red);font-weight:600">Classement ›</span></button>`})()}
   <div class="actions"><button class="btn sec small" data-teams="1">Changer d'équipe</button><button class="btn sec small" id="leaveTeam">Quitter</button>${owner||me.admin?`<button class="btn sec small" id="delTeam" style="color:var(--ko)">Supprimer l'équipe</button>`:""}</div><p class="small" id="tmMsg" style="margin:8px 0 0"></p></div>`}
function bindTeams(){
  const gt=$("#goTeams");if(gt)gt.onclick=()=>{profTab="equipe";store.set("profTab",profTab);rkNav={v:"top"};viewProfile()};
  app.querySelectorAll("[data-teams]").forEach(b=>b.onclick=teamsSheet);
  const lv=$("#leaveTeam");if(lv)lv.onclick=async()=>{if(!lv.dataset.c){lv.dataset.c="1";lv.textContent="Confirmer : quitter";return}try{await api("teams/leave","POST",{});me.team=null;saveMe();rkNav={v:"top"};await loadBoard(true);viewProfile();toast("Tu as quitté l'équipe.")}catch(e){$("#tmMsg").textContent=e.error||"Erreur."}};
  const dl=$("#delTeam");if(dl)dl.onclick=async()=>{if(!dl.dataset.c){dl.dataset.c="1";dl.textContent="Confirmer la suppression";$("#tmMsg").textContent="L'équipe sera supprimée pour tous ses membres (leurs scores sont conservés).";return}
    try{await api("teams","DELETE",{teamId:myTeamId()});me.team=null;saveMe();rkNav={v:"top"};await loadBoard(true);viewProfile();toast("Équipe supprimée.")}catch(e){$("#tmMsg").textContent=e.error||"Erreur."}};
}
async function teamsSheet(){const sh=sheet(`<h2>Équipes</h2><p class="small">Tu ne peux être que dans une seule équipe à la fois.</p><div id="tlist"><div class="loading">Chargement…</div></div>
   <div class="sect">Créer une équipe</div><form id="tform" class="form" style="display:flex;gap:8px;align-items:flex-end"><div style="flex:1;min-width:0;display:grid;gap:6px"><label for="tName" style="margin-top:0">Nom de l'équipe</label><input id="tName" maxlength="40" placeholder="ex. CRF Paris 18 · garde du lundi"></div><button class="btn" type="submit">Créer</button></form><p class="small" id="tsMsg" style="color:var(--ko)"></p>
   <div class="actions"><button class="btn sec full" data-close>Fermer</button></div>`);
  let data;try{data=await api("teams")}catch(e){sh.querySelector("#tlist").innerHTML=`<p class="small">${esc(e.error||"Erreur.")}</p>`;return}
  const cur=data.myTeam,curName=(data.teams.find(t=>t.id===cur)||{}).name;
  sh.querySelector("#tlist").innerHTML=data.teams.length?`<div class="list">${data.teams.map(t=>`<div class="row"><span class="av" style="width:36px;height:36px;background:var(--navy2);font-size:14px">${esc(initials(t.name))}</span><span class="tx"><b>${esc(t.name)}</b><span>${t.members} membre(s) · créée par ${esc(t.owner)}</span></span>${t.id===cur?`<span class="pill ok">Ton équipe</span>`:`<button class="btn small" data-join="${esc(t.id)}">Rejoindre</button>`}</div>`).join("")}</div>${cur?`<p class="small" style="margin:8px 4px 0">Rejoindre une autre équipe te fera quitter « ${esc(curName||"ton équipe")} ».</p>`:""}`:`<p class="small">Aucune équipe pour l'instant. Crée la première ci-dessous.</p>`;
  sh.querySelectorAll("[data-join]").forEach(b=>b.onclick=async()=>{b.disabled=true;try{const j=await api("teams/join","POST",{teamId:b.dataset.join});me.team=j.team.id;saveMe();rkNav={v:"top"};closeSheet();await loadBoard(true);viewProfile();toast("Tu as rejoint « "+j.team.name+" ».")}catch(e){sh.querySelector("#tsMsg").textContent=e.error||"Erreur.";b.disabled=false}});
  sh.querySelector("#tform").onsubmit=async e=>{e.preventDefault();const name=sh.querySelector("#tName").value.trim();try{const j=await api("teams","POST",{name});me.team=j.team.id;saveMe();rkNav={v:"top"};closeSheet();await loadBoard(true);viewProfile();toast("Équipe « "+j.team.name+" » créée.")}catch(err){sh.querySelector("#tsMsg").textContent=err.error||"Erreur."}};
}
function homeBoard(){if(!me||!board)return `<div id="homeBoard"></div>`;
  const tid=myTeamId(),tm=teamOf(tid),all=board.profiles||[];const w=isoWeek();
  const pts=p=>wpts(p),dfi=p=>p.stats&&p.stats.defi&&p.stats.defi.week===w?p.stats.defi.score:null;
  const members=(tm?all.filter(p=>p.team===tid):all).slice().sort((a,b)=>pts(b)-pts(a)||(dfi(b)??-1)-(dfi(a)??-1)||String(a.pseudo).localeCompare(b.pseudo));
  const cut=(list,isMine,n=6)=>{const k=list.findIndex(isMine);if(list.length<=n||k<n-1)return list.slice(0,n).map((x,i)=>[x,i]);return list.slice(0,n-2).map((x,i)=>[x,i]).concat([[null,-1],[list[k],k]])};
  const rowP=([p,i])=>p?`<div class="hbrow ${p.id===me.id?"mine":""}"><span class="rk ${i<3?"top"+(i+1):""}">${i+1}</span>${avatar(p,28)}<span class="nm">${gradeSvg(rankCode((p.stats&&p.stats.rank)||0),"rkmini")}${esc(p.pseudo)}${p.id===me.id?" (toi)":""}${decoHtml(p)}${nickHtml(p)}</span><span class="small">${dfi(p)!=null?`défi ${dfi(p)}/20 · `:""}<b>${pts(p).toLocaleString("fr-FR")}</b> pts</span></div>`:`<div class="hbgap">⋯</div>`;
  const rk=teamRanking();const ti=rk.findIndex(x=>x.t.id===tid);
  const rowT=([x,i])=>x?`<div class="hbrow ${x.t.id===tid?"mine":""}"><span class="rk ${i<3?"top"+(i+1):""}">${i+1}</span><span class="nm"><b>${esc(x.t.name)}</b><br><span class="small">${x.n} membre${x.n>1?"s":""}</span></span><span class="small"><b>${x.avg.toLocaleString("fr-FR")}</b> pts moy.</span></div>`:`<div class="hbgap">⋯</div>`;
  return `<div id="homeBoard"><div class="sect">${tm?"Mon équipe · "+esc(tm.name):"Classement général"}</div>
   <div class="card hbcard" id="hbGo" role="button" tabindex="0"><div class="hbhead"><b>${tm?"Mon équipe":"Tous les membres"}</b><span class="small">${members.length} membre${members.length>1?"s":""} ›</span></div>
    ${members.length?cut(members,p=>p.id===me.id).map(rowP).join(""):`<span class="small">Aucun membre pour l'instant.</span>`}
    ${tm&&members.length===1?`<p class="small" style="margin:8px 0 0">Tu es seul dans l'équipe : invite tes coéquipiers à la rejoindre depuis Profil › Équipe.</p>`:""}
    ${tm?"":`<p class="small" style="margin:8px 0 0">Rejoins une équipe depuis Profil › Équipe pour te comparer à tes coéquipiers.</p>`}</div>
   ${rk.length?`<div class="card hbcard" id="hbTeams" role="button" tabindex="0" style="margin-top:10px"><div class="hbhead"><b>Équipes</b><span class="small">${ti>=0?`Ton équipe : ${ti+1}<sup>${ti?"e":"re"}</sup>/${rk.length}`:`${rk.length} équipe${rk.length>1?"s":""}`} ›</span></div>
    ${cut(rk,x=>x.t.id===tid,5).map(rowT).join("")}<p class="small" style="margin:8px 0 0">Moyenne des points de la semaine par membre. Remise à zéro chaque lundi.</p></div>`:""}</div>`}
const GLOGO='<svg viewBox="0 0 48 48" width="20" height="20"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>';
function noProfileCard(){
  const exp=me&&me.expired;
  if(srvCfg&&srvCfg.google)return `<div class="card"><h2 style="font-size:20px;margin-bottom:6px">${exp?"Reconnecte-toi":"Rejoins le classement"}</h2><p class="small" style="margin:0 0 14px">${exp?"Ta session a expiré ou a été fermée.":"Connecte-toi avec ton compte Google pour créer ton profil et te comparer à l'équipe."} Ta progression détaillée reste sur ton téléphone ; seuls ton pseudo et tes scores sont partagés.</p>
    <button class="gbtn" id="gLogin">${GLOGO}<span>Se connecter avec Google</span></button>${exp&&store.get("lastErr",null)?`<p class="small" style="margin-top:10px">Détail technique : ${esc(store.get("lastErr").method+" "+store.get("lastErr").path+" → "+store.get("lastErr").status+" "+(store.get("lastErr").code||"")+" "+store.get("lastErr").msg)}</p>`:""}${store.get("pendingLogin",null)?`<p class="small" style="margin-top:10px">Connexion en cours… Si tu as fini sur la page Google, reviens simplement ici.</p>`:""}</div>`;
  return `<div class="card"><h2 style="font-size:20px;margin-bottom:6px">Crée ton profil</h2><p class="small" style="margin:0 0 12px">Choisis un pseudo pour apparaître dans le classement et te comparer aux autres membres de l'équipe.</p>
  <button class="btn full" id="mkProfile">Créer mon profil</button>${apiState==="absent"?`<p class="small" style="margin-top:10px">Le classement n'est pas activé sur ce site : l'appli doit être déployée depuis GitHub avec son dossier « api ».</p>`:""}</div>`}
function meCard(){if(!me||me.expired)return noProfileCard();
  const s=buildStats();const team=scopeProfiles().filter(p=>p.id!==me.id&&p.stats&&p.stats.answered>0);
  const avg=f=>team.length?Math.round(team.reduce((a,p)=>a+f(p),0)/team.length):null;
  const myAcc=s.answered?Math.round(s.correct/s.answered*100):0;const tAcc=avg(p=>p.stats.answered?p.stats.correct/p.stats.answered*100:0);
  const rk=k=>{const r=myRank(k);return `<div class="kpi">${r?`<b>${r.pos}<sup>e</sup><small>/${r.of}</small></b>`:`<b>–</b>`}<span>${esc(k==="defi"?"Défi semaine":METRICS[k].l())}</span></div>`};
  const bar=(lab,mine,their,unit="%")=>`<div class="cmp"><div class="cmpl"><span>${lab}</span><span><b>${mine}${unit}</b>${their!=null?` · équipe ${their}${unit}`:""}</span></div><div class="cmpb"><i style="width:${Math.min(100,mine)}%"></i>${their!=null?`<em style="left:${Math.min(100,their)}%"></em>`:""}</div></div>`;
  return `<div class="card"><div style="display:flex;gap:12px;align-items:center">${avatar(me,52)}<div style="flex:1;min-width:0"><b style="font-size:19px">${esc(me.pseudo)}</b>${fxMode==="fire"?` <span class="pill firepill">${FLAME_IC} On Fire</span>`:fxMode==="sgt"?` <span class="pill firepill sgtpill">${SGT_IC} Braise</span>`:""}${me.superAdmin?` <span class="pill warn">Super admin</span>`:me.admin?` <span class="pill warn">Admin</span>`:""}<div class="small">${esc(me.unite||"")}${me.unite?" · ":""}${s.points.toLocaleString("fr-FR")} pts cette semaine</div></div><button class="btn sec small" id="editProfile">Modifier</button></div>
   <div class="kpis rks" style="margin-top:14px">${rk("points")}${rk("defi")}${rk("fiches")}</div></div>
   ${me.admin?`<div class="list" style="margin-top:12px"><button class="row" id="openAdmin"><span class="ic" style="background:var(--navy2)">${I.user}</span><span class="tx"><b>Administration</b><span>Membres, équipes, accès, remises à zéro</span></span><span class="chev">${I.chev}</span></button></div>`:""}
   ${teamCard()}
   <div class="sect">Moi face à ${boardScope==="team"&&teamOf(myTeamId())?"mon équipe":"tout le monde"}</div>
   <div class="card">${bar("Taux de réussite",myAcc,tAcc)}${bar("Fiches acquises",Math.round(s.fichesOk/s.fichesTotal*100),avg(p=>p.stats.fichesOk/(p.stats.fichesTotal||1)*100))}
    ${DATA.map(t=>bar(esc(short(t)),s.themes[t.id]||0,avg(p=>(p.stats.themes||{})[t.id]||0))).join("")}
    <p class="small" style="margin:8px 0 0">Barre : ta maîtrise. Repère noir : moyenne des ${team.length} autre(s) membre(s).</p></div>`}
function accountCard(){if(!me||me.expired)return"";
  return `<div class="sect">Mon compte</div><div class="list">${me.email?`<div class="row"><span class="tx"><b>Compte Google</b><span>${esc(me.email)}</span></span></div>`:""}
   ${isStandalone()?"":`<button class="row" id="installBtn"><span class="ic" style="background:var(--red)">${I.plus}</span><span class="tx"><b>Installer l'appli</b><span>Ajouter le quiz à l'écran d'accueil du téléphone</span></span><span class="chev">${I.chev}</span></button>`}
   <button class="row" id="syncBtn"><span class="tx"><b>Scores synchronisés automatiquement</b><span id="accMsg">${store.get("lastSync",0)?"Dernier envoi "+new Date(store.get("lastSync",0)).toLocaleString("fr-FR",{weekday:"short",hour:"2-digit",minute:"2-digit"}):"Pas encore envoyé"}</span></span></button>
   ${me.email?`<button class="row" id="logoutBtn"><span class="tx"><b style="color:var(--red)">Se déconnecter</b></span></button>`:""}
   ${me.superAdmin?"":`<button class="row" id="delProfile"><span class="tx"><b style="color:var(--ko)">Supprimer mon profil</b><span id="delMsg">Retire ton pseudo et tes scores du classement.</span></span></button>`}</div>`}
function bindMe(){bindInstall();bindTeams();
  const g=$("#gLogin");if(g)g.onclick=loginGoogle;
  const mk=$("#mkProfile");if(mk)mk.onclick=()=>profileSheet(false);
  const ed=$("#editProfile");if(ed)ed.onclick=()=>profileSheet(true);
  const ad=$("#openAdmin");if(ad)ad.onclick=viewAdmin;
  const sy=$("#syncBtn");if(sy)sy.onclick=async()=>{$("#accMsg").textContent="Synchronisation…";await syncNow();$("#accMsg").textContent=store.get("lastSync",0)>Date.now()-5000?"Scores envoyés.":"Échec : vérifie ta connexion."};
  const lo=$("#logoutBtn");if(lo)lo.onclick=logout;
  const dl=$("#delProfile");if(dl)dl.onclick=async()=>{if(!dl.dataset.c){dl.dataset.c="1";$("#delMsg").textContent="Touche encore pour confirmer : ton profil sera supprimé du classement (ta progression locale est conservée).";return}
    try{await api("profile","DELETE",{})}catch(e){}me=null;saveMe();board=null;store.del("board");await clearProtected();location.replace(location.pathname)};
}
function profileSheet(edit,welcome){const p=edit?me:{pseudo:"",unite:"",color:COLORS[Math.floor(Math.random()*COLORS.length)],team:store.get("lastTeam","")};let color=p.color;
  const sh=sheet(`<h2>${welcome?"Bienvenue !":edit?"Modifier mon profil":"Créer mon profil"}</h2>${welcome?`<p class="small">Vérifie le pseudo qui apparaîtra dans le classement et indique ton unité.</p>`:""}
   <form id="pform" class="form"><label for="fPseudo">Pseudo</label><input id="fPseudo" maxlength="24" required value="${esc(p.pseudo)}" placeholder="ex. Pierre B.">
    <label for="fUnite">Unité ou centre (facultatif)</label><input id="fUnite" maxlength="40" value="${esc(p.unite||"")}" placeholder="ex. CRF Paris 15e">
    <label>Couleur</label><div class="colors">${COLORS.map(c=>`<button type="button" class="col" data-c="${c}" style="background:${c}" aria-pressed="${c===color}" aria-label="Couleur"></button>`).join("")}</div>
    ${edit?"":`<label for="fTeam">Code d'équipe</label><input id="fTeam" autocapitalize="characters" value="${esc(p.team||"")}" placeholder="Donné par ton responsable">`}
    <button class="btn full" type="submit" style="margin-top:16px">${edit?"Enregistrer":"Créer mon profil"}</button><p class="small" id="pMsg" style="color:var(--ko)"></p></form>`);
  sh.querySelectorAll(".col").forEach(b=>b.onclick=()=>{color=b.dataset.c;sh.querySelectorAll(".col").forEach(x=>x.setAttribute("aria-pressed",x===b))});
  sh.querySelector("#pform").onsubmit=async e=>{e.preventDefault();const m=sh.querySelector("#pMsg");m.textContent="";const btn=sh.querySelector('[type="submit"]');btn.disabled=true;
    const pseudo=sh.querySelector("#fPseudo").value.trim(),unite=sh.querySelector("#fUnite").value.trim();
    try{if(edit){const j=await api("profile","PUT",{pseudo,unite,color});Object.assign(me,{pseudo:j.profile.pseudo,unite:j.profile.unite,color:j.profile.color});saveMe()}
      else{const team=sh.querySelector("#fTeam").value.trim();store.set("lastTeam",team);const j=await api("profile","POST",{team,pseudo,unite,color,stats:buildStats()});me={id:j.id,token:j.token,pseudo:j.profile.pseudo,unite:j.profile.unite,color:j.profile.color,resetSeen:Date.now()};saveMe()}
      closeSheet();await loadBoard(true);viewProfile()}catch(err){m.textContent=err.error||"Erreur.";btn.disabled=false}}}

/* ---- administration */
let adminData=null,adminQ="";
async function viewAdmin(){app.innerHTML=push("Administration")+`<div class="loading">Chargement…</div>`;bindBack(()=>go("profile"));
  try{adminData=await api("admin/members")}catch(e){app.innerHTML=push("Administration")+`<p class="sub" style="margin-top:20px">${esc(e.error||"Accès refusé.")}</p>`;bindBack(()=>go("profile"));return}
  drawAdmin()}
async function drawAdminTeams(){const el=$("#adTeams");if(!el)return;let d;try{d=await api("teams")}catch(e){if(el.isConnected)el.innerHTML=`<p class="small">${esc(e.error||"Erreur.")}</p>`;return}
  if(!el.isConnected)return; // l'écran a été quitté pendant le chargement
  const rk=teamRanking();const tc=$("#tcount");if(tc)tc.textContent=d.teams.length;
  el.innerHTML=d.teams.length?`<div class="list">${d.teams.map(t=>{const r=rk.find(x=>x.t.id===t.id);return `<div class="row"><span class="av" style="width:36px;height:36px;background:var(--navy2);font-size:14px">${esc(initials(t.name))}</span><span class="tx"><b>${esc(t.name)}</b><span>${t.members} membre(s) · créée par ${esc(t.owner)}${r?` · ${r.avg.toLocaleString("fr-FR")} pts de moyenne`:""}</span></span><button class="btn sec small" data-deltm="${esc(t.id)}" style="color:var(--ko)">Supprimer</button></div>`}).join("")}</div><p class="small" id="tmAdMsg" style="margin:6px 4px 0">Supprimer une équipe retire ses membres de l'équipe ; leurs scores sont conservés.</p>`:`<p class="small">Aucune équipe.</p>`;
  el.querySelectorAll("[data-deltm]").forEach(b=>b.onclick=async()=>{if(!b.dataset.c){b.dataset.c="1";b.textContent="Confirmer";return}b.disabled=true;
    try{await api("teams","DELETE",{teamId:b.dataset.deltm});if(me.team===b.dataset.deltm){me.team=null;saveMe()}toast("Équipe supprimée.");await loadBoard(true);drawAdminTeams()}catch(e){$("#tmAdMsg").textContent=e.error||"Erreur.";b.disabled=false}})}
function drawAdmin(){setTimeout(drawAdminTeams,0);const A=adminData,S=A.settings;const qn=norm(adminQ);
  const mem=A.members.filter(m=>!qn||norm([m.pseudo,m.email,m.name,m.unite].join(" ")).includes(qn)).sort((a,b)=>(b.superAdmin-a.superAdmin)||(b.admin-a.admin)||a.pseudo.localeCompare(b.pseudo));
  const badge=m=>m.superAdmin?`<span class="pill warn">Super admin</span>`:m.blocked?`<span class="pill ko">Bloqué</span>`:m.admin?`<span class="pill warn">Admin</span>`:"";
  app.innerHTML=push("Administration")+`
   <div class="sect">Accès à l'appli</div>
   <div class="card"><p class="small" style="margin:0 0 10px">Qui peut se connecter avec Google. Laisse les deux champs vides pour accepter tous les comptes. Les administrateurs sont toujours autorisés.</p>
    <form id="aform" class="form"><label for="aDom">Domaines autorisés</label><input id="aDom" value="${esc((S.allowedDomains||[]).join(", "))}" placeholder="ex. croix-rouge.fr, gmail.com">
    <label for="aMail">E-mails autorisés (en plus des domaines)</label><textarea id="aMail" rows="3" placeholder="un e-mail par ligne">${esc((S.allowedEmails||[]).join("\n"))}</textarea>
    <button class="btn full" type="submit" style="margin-top:12px">Enregistrer les accès</button><p class="small" id="aMsg"></p></form></div>
   <div class="sect">Journaux d'activité</div><div class="list"><button class="row" id="openLogs"><span class="ic" style="background:#30b0c7">${I.list}</span><span class="tx"><b>Journaux d'activité</b><span>Qui fait quoi, clics, réponses, erreurs (30 derniers jours)</span></span><span class="chev">${I.chev}</span></button></div>
   <div class="sect">Équipes (<span id="tcount">…</span>)</div><div id="adTeams"><div class="loading">Chargement…</div></div>
   <div class="sect">Membres (${A.members.length})</div>
   <input class="search" id="aq" type="search" placeholder="Rechercher un membre" value="${esc(adminQ)}">
   <div class="list" style="margin-top:10px">${mem.map(m=>`<button class="row lbrow" data-mem="${esc(m.id)}">${avatar(m)}<span class="tx"><b>${esc(m.pseudo)} ${badge(m)}</b><span>${esc(m.email||"sans compte Google")}${m.unite?" · "+esc(m.unite):""}</span><span>${(m.stats&&m.stats.points||0).toLocaleString("fr-FR")} pts · ${m.lastLogin?"vu "+new Date(m.lastLogin).toLocaleDateString("fr-FR"):"jamais connecté"}</span></span><span class="chev">${I.chev}</span></button>`).join("")||`<div class="row"><span class="tx"><span>Aucun membre.</span></span></div>`}</div>
   <p class="small" style="margin:10px 4px">Super administrateur : ${esc(A.superEmail)}. ${A.superAdmin?"Tu peux nommer d'autres administrateurs depuis la fiche d'un membre.":"Seul le super administrateur peut nommer des administrateurs."}</p>`;
  bindBack(()=>go("profile"));
  $("#aform").onsubmit=async e=>{e.preventDefault();const m=$("#aMsg");m.textContent="Enregistrement…";
    try{const j=await api("admin/settings","PUT",{allowedDomains:$("#aDom").value,allowedEmails:$("#aMail").value});adminData.settings=j.settings;m.textContent="Accès enregistrés.";$("#aDom").value=j.settings.allowedDomains.join(", ");$("#aMail").value=j.settings.allowedEmails.join("\n")}catch(err){m.textContent=err.error||"Erreur."}};
  $("#openLogs").onclick=()=>viewLogs();
  let to;$("#aq").oninput=e=>{adminQ=e.target.value;clearTimeout(to);to=setTimeout(()=>{drawAdmin();const q=$("#aq");q.focus();q.setSelectionRange(q.value.length,q.value.length)},250)};
  app.querySelectorAll("[data-mem]").forEach(b=>b.onclick=()=>memberSheet(adminData.members.find(m=>m.id===b.dataset.mem)));
}
function memberSheet(m){const A=adminData;const canAdmin=A.superAdmin&&m.email&&!m.superAdmin;const s=m.stats||{};
  const sh=sheet(`<div style="display:flex;gap:12px;align-items:center">${avatar(m,48)}<div><h2 style="margin:0">${esc(m.pseudo)}</h2><div class="small">${esc(m.email||"sans compte Google")}${m.name?" · "+esc(m.name):""}</div></div></div>
   <div class="card" style="margin:14px 0"><div class="kpis"><div class="kpi"><b>${(s.total!=null?s.total:(s.points||0)).toLocaleString("fr-FR")}</b><span>points au total</span></div><div class="kpi"><b>${s.answered?Math.round(s.correct/s.answered*100):0} %</b><span>réussite</span></div><div class="kpi"><b>${s.fichesOk||0}</b><span>fiches acquises</span></div></div></div>
   <form id="rnf" class="form" style="grid-template-columns:1fr auto;align-items:end;gap:8px"><div style="display:grid;gap:6px"><label for="rnP">Pseudo</label><input id="rnP" maxlength="24" value="${esc(m.pseudo)}"></div><button class="btn sec" type="submit">Renommer</button></form>
   <div class="actions" style="flex-direction:column">
    <button class="btn sec full" data-act="reset">Remettre ses scores à zéro</button>
    <div class="small" style="margin:2px 0 -2px">Ambiance (actuelle : ${FXLBL[fxFrom(m)]})</div><div class="seg firetog admfx">${[["unfire","off","Normal",""],["sergent","sgt","Braise",SGT_IC],["fire","fire","On Fire",FLAME_IC]].map(([a,k,l,ic])=>`<button data-act="${a}" aria-pressed="${fxFrom(m)===k}">${ic}${l}</button>`).join("")}</div>
    ${m.nick&&m.nick.u>Date.now()?`<button class="btn sec full" data-act="unnick">Retirer le surnom « ${esc(m.nick.n)} »</button>`:""}
    ${m.superAdmin?"":`<button class="btn sec full" data-act="${m.blocked?"unblock":"block"}">${m.blocked?"Débloquer le compte":"Bloquer le compte"}</button>`}
    ${canAdmin?`<button class="btn sec full" data-act="${m.admin?"unadmin":"admin"}">${m.admin?"Retirer les droits d'administrateur":"Nommer administrateur"}</button>`:""}
    ${m.superAdmin?"":`<button class="btn sec full" data-act="delete" style="color:var(--ko)">Supprimer le profil</button>`}
    <button class="btn full" data-close>Fermer</button></div><p class="small" id="mMsg"></p>`);
  const act=async(action,extra)=>{const msg=sh.querySelector("#mMsg");msg.textContent="…";try{await api("admin/member","PUT",{target:m.id,action,...extra});closeSheet();toast("Modification enregistrée.");adminData=await api("admin/members");drawAdmin();loadBoard(true)}catch(e){msg.textContent=e.error||"Erreur."}};
  sh.querySelector("#rnf").onsubmit=e=>{e.preventDefault();act("rename",{pseudo:sh.querySelector("#rnP").value})};
  sh.querySelectorAll("[data-act]").forEach(b=>b.onclick=()=>{const a=b.dataset.act;if((a==="delete"||a==="reset"||a==="block")&&!b.dataset.c){b.dataset.c="1";b.textContent="Confirmer : "+b.textContent.toLowerCase();return}act(a)});
}

/* ============ Démarrage ============ */
const LOGOS=window.QLOGOS||"";
app.addEventListener("keydown",e=>{if((e.key==="Enter"||e.key===" ")&&e.target.matches&&e.target.matches("#hbGo,#hbTeams")){e.preventDefault();e.target.click()}});
app.addEventListener("click",e=>{if(e.target.closest("[data-deco],[data-nick],[data-duelp]"))return;if(e.target.closest("#hbTeams")){profTab="equipe";store.set("profTab",profTab);rkNav={v:"top"};go("profile");return}if(e.target.closest("#hbGo")){profTab="equipe";store.set("profTab",profTab);const t=myTeamId();rkNav=t&&teamOf(t)?{v:"team",team:t}:{v:"all"};go("profile")}});
setTimeout(()=>loadSimple().then(()=>{if(tab==="revise"&&!document.body.classList.contains("pushed"))viewRevise()}).catch(()=>{}),1500);
alog("demarrage",APP_VER,{chargement:Math.round(performance.now())+" ms",langue:navigator.language,ecran:screen.width+"x"+screen.height+" @"+devicePixelRatio,reseau:(navigator.connection&&navigator.connection.effectiveType)||"",sw:navigator.serviceWorker&&navigator.serviceWorker.controller?"actif":"aucun",stockage:(()=>{try{return Math.round(JSON.stringify(localStorage).length/1024)+" Ko"}catch(e){return ""}})(),w:innerWidth,h:innerHeight,app:(window.matchMedia("(display-mode: standalone)").matches||navigator.standalone===true)?"installée":"navigateur",mode:typeof usage!=="undefined"?usage:"",niveau:typeof level!=="undefined"?level:"",tab});
if(me&&me.id){const o=store.get("progOwner",null);if(o&&o!==me.id)applyProgress({resetAt:0});store.set("progOwner",me.id)}
go(tab);{const wel=store.get("welcome",false);if(wel)store.del("welcome");const tk="tutoSeen_"+(me&&me.id||"x");
 const afterTuto=()=>{if(wel){profTab="moi";go("profile");profileSheet(true,true)}};
 const nk="news320_"+(me&&me.id||"x"),nk2="news330_"+(me&&me.id||"x");
 if(!store.get(tk,false))setTimeout(()=>openTuto(()=>{store.set(tk,true);store.set(nk,true);store.set(nk2,true);afterTuto()}),350);else if(wel)setTimeout(afterTuto,300);
 else if(me&&!me.expired&&!store.get(nk,false))setTimeout(()=>openTuto(()=>store.set(nk,true),"rank"),600);
 else if(me&&!me.expired&&!store.get(nk2,false))setTimeout(()=>openTuto(()=>{store.set(nk2,true);if(typeof duelNotify==="function")duelNotify()},"duel"),600)}loadCfg().then(()=>{if(tab==="profile"&&!document.body.classList.contains("pushed"))viewProfile()});if(store.get("pendingLogin",null))startPoll();if(me&&!me.expired)loadBoard(true).then(()=>{syncSoon();setTimeout(()=>loadDuels(true),1200)});
if("serviceWorker" in navigator&&location.protocol.startsWith("http"))navigator.serviceWorker.register("sw.js").catch(()=>{});
