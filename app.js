"use strict";
/* ============ Données & état ============ */
const {themes:DATA,fiches:FICHES,docs:DOCS}=window.QDATA;
const DOC=Object.fromEntries(DOCS.map((d,i)=>[d.id,{...d,i}]));
const FICHE=Object.fromEntries(FICHES.map(f=>[f.id,f]));
const LETTERS="ABCD";
const store={get(k,d){try{const v=localStorage.getItem("cq_"+k);return v?JSON.parse(v):d}catch(e){return d}},set(k,v){try{localStorage.setItem("cq_"+k,JSON.stringify(v))}catch(e){}},del(k){try{localStorage.removeItem("cq_"+k)}catch(e){}}};
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
function cntTotal(){const t={points:0,answered:0,correct:0};Object.values(cntDev).forEach(c=>{t.points+=c.points||0;t.answered+=c.answered||0;t.correct+=c.correct||0});return t}
// barème : questions simples ×0,5 (5 pts), questions expert ×2 (20 pts), radio et carte ×1 (10 pts)
const ptsMult=id=>/^(s|doc):/.test(id)?.5:/^(radio|carte):/.test(id)?1:2;
function record(id,ok,bonus){if(typeof syncSoon==="function")syncSoon(6000);cnt.answered++;if(ok){cnt.correct++;cnt.points+=Math.round((10+(bonus||0))*ptsMult(id))}store.set("cntDev",cntDev);const h=(hist[id]||[]).concat(ok?1:0).slice(-5);hist[id]=h;histT[id]=Date.now();store.set("hist",hist);store.set("histT",histT);
  if(ok){if(review.delete(id))store.set("review",[...review])}else if(BYID[id]&&!/^(s|doc):/.test(id)){review.add(id);store.set("review",[...review])}
  const d=today();if(days[days.length-1]!==d){days.push(d);days=days.slice(-400);store.set("days",days)}}
function setBest(mode,val){if(typeof best[mode]!=="number"||val>best[mode]){best[mode]=val;store.set("best",best)}}
function known(id){const h=hist[id];if(!h||!h.length)return null;const l=h.slice(-2);return l.every(x=>x===1)||(h.length===1&&h[0]===1)}
function streak(){let s=0;const set=new Set(days);let d=new Date();if(!set.has(today()))d.setDate(d.getDate()-1);
  while(set.has(d.toISOString().slice(0,10))){s++;d.setDate(d.getDate()-1)}return s}

/* ============ Icônes ============ */
const I={
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
const TABS=[["home","Accueil",I.home],["revise","Réviser",I.cards],["chat","Assistant",I.chat],["cri","Codes CRI",'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="3"/><path d="M7 9h4M7 13h10M7 17h6"/><circle cx="16.5" cy="9" r="1.5"/></svg>'],["radio","Messages radio",RADIO_IC_T],["carte","Carte des secteurs",MAP_IC_T],["grades","Grades",GRADE_IC_T],["docs","Documents",I.book],["profile","Profil",I.user]];
let tab=store.get("tab","home");if(!TABS.some(t=>t[0]===tab))tab="home";
let cleanup=null;
const MENU_IC='<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M4 7h16M4 12h16M4 17h16"/></svg>';
function renderTabs(){const cur=TABS.find(t=>t[0]===tab);
  $("#tabbar").innerHTML=`<button class="menubtn" id="menuBtn" aria-label="Menu" aria-expanded="false" aria-controls="menuPanel">${cur?cur[2]:""}<span>${cur?esc(cur[1]):""}</span>${MENU_IC}</button>
   <div class="menupanel" id="menuPanel" hidden>${TABS.map(([k,l,ic])=>`<button data-tab="${k}" ${k===tab?'aria-current="page"':""}>${ic}<span>${l}</span></button>`).join("")}</div>`;
  const btn=$("#menuBtn"),pan=$("#menuPanel");
  const close=()=>{pan.hidden=true;btn.setAttribute("aria-expanded","false")};
  btn.onclick=e=>{e.stopPropagation();pan.hidden=!pan.hidden;btn.setAttribute("aria-expanded",String(!pan.hidden))};
  pan.querySelectorAll("button").forEach(b=>b.onclick=()=>{close();go(b.dataset.tab)});
  if(!renderTabs.bound){renderTabs.bound=true;document.addEventListener("click",e=>{const p=$("#menuPanel");if(p&&!p.hidden&&!e.target.closest("#tabbar")){p.hidden=true;const b=$("#menuBtn");if(b)b.setAttribute("aria-expanded","false")}});
    document.addEventListener("keydown",e=>{if(e.key==="Escape"){const p=$("#menuPanel");if(p)p.hidden=true}})}}
let navStack=[];
function go(t,fromBack){if(cleanup){cleanup();cleanup=null}if(!fromBack&&t!==tab&&!document.body.classList.contains("pushed")){navStack.push(tab);navStack=navStack.slice(-20)}if(!fromBack&&t!==tab)history.pushState({app:1},"");tab=t;store.set("tab",t);document.body.classList.remove("pushed");$("#composer").hidden=t!=="chat";renderTabs();
  app.className="view";({home:viewHome,revise:viewRevise,chat:viewChat,cri:viewCri,radio:viewRadio,carte:viewCarte,grades:()=>viewGrades(level==="expert",true),docs:viewDocs,profile:viewProfile})[t]();bindTabBack();window.scrollTo(0,0)}
function goBack(){const prev=navStack.pop();if(prev)go(prev,true);else go("home",true)}
function backLink(){return tab!=="home"?`<button class="tback" id="tback">${I.back}${esc((TABS.find(x=>x[0]===(navStack[navStack.length-1]||"home"))||[])[1]||"Accueil")}</button>`:""}
function bindTabBack(){const b=$("#tback");if(b)b.onclick=()=>goBack()}
window.addEventListener("popstate",()=>{const v=$("#viewer");if(v){v.querySelector("#vclose").click();return}if($("#sheet")){closeSheet();return}const bk=$("#back");if(bk){bk.click();return}if(tab!=="home")goBack()});
function push(title,right,onBack){if(!document.body.classList.contains("pushed"))history.pushState({app:1},"");if(cleanup){cleanup();cleanup=null}document.body.classList.add("pushed");$("#composer").hidden=true;app.className="view push";
  return `<div class="nav"><button class="back" id="back">${I.back}Retour</button><div class="ttl">${esc(title)}</div><div class="right" id="navr">${right||""}</div></div>`}
function bindBack(fn){const b=$("#back");if(b)b.onclick=()=>{if(cleanup){cleanup();cleanup=null}fn?fn():go(tab)}}
function setRight(t){const r=$("#navr");if(r)r.textContent=t}

/* ============ Installation ============ */
let deferredPrompt=null;
window.addEventListener("beforeinstallprompt",e=>{e.preventDefault();deferredPrompt=e;if(tab==="home"&&!document.body.classList.contains("pushed"))viewHome()});
const isStandalone=()=>window.matchMedia("(display-mode: standalone)").matches||navigator.standalone===true;
const isIOS=()=>/iphone|ipad|ipod/i.test(navigator.userAgent)||(navigator.platform==="MacIntel"&&navigator.maxTouchPoints>1);
function installBanner(){if(isStandalone()||store.get("hideInstall",false))return"";
  return `<div class="install"><img src="icon-180.png" alt=""><div><b>Installer l'appli</b><span>Ajoute le quiz à ton écran d'accueil pour l'ouvrir en plein écran, même hors réseau.</span></div><button class="btn small" id="installBtn">Ajouter</button></div>`}
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
function viewHome(){if(level==="simple")return viewHomeSimple();
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
   <div class="sect">Cette semaine</div>
   <div class="defi"><div class="wk">DÉFI ${w}</div><h2>Défi de la semaine</h2>
     <p>Les mêmes 20 questions pour toute l'équipe. Joue, puis partage ton score dans le groupe.</p>
     ${dd?`<p class="done">Ton premier essai : <b>${dd.score}/20</b> en ${fmtTime(dd.ms)}</p>`:""}
     <div class="actions" style="margin-top:0"><button class="btn" id="defiGo">${dd?"Rejouer":"Relever le défi"}</button>${dd?`<button class="btn sec" id="defiShare">Partager</button>`:""}</div><p class="small" id="defiMsg" style="color:#fff;opacity:.8"></p></div>
   ${homeBoard()}
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
    <button class="tile wide" data-m="grades"><span class="ic gic">${gradeSvg("CNE","")}</span><div><b>Les grades</b><br><span>Galons, abréviations, hiérarchie et services</span></div></button>
    <button class="tile wide" data-m="marks"><span class="ic" style="background:#5e5ce6">${FLAG}</span><div><b>Questions marquées (${Object.keys(marks).length})</b><br><span>Revois la réponse et le référentiel des points à éclaircir.</span></div></button>
    <button class="tile wide" data-m="review" ${review.size?"":"disabled"}><span class="ic" style="background:var(--warn)">${I.redo}</span><div><b>À revoir (${review.size})</b><br><span>Rejoue uniquement tes erreurs.</span></div></button>
   </div>
   <footer class="note">Questions tirées des référentiels du parcours CI BSPP (Guide pratique CI, BSP 112/115/118/200.2/200.20/300.16, MACA 2025-2026, eFiBi…) et, en bonus, du guide PSE CRF. En cas de doute, le référentiel en vigueur fait foi.</footer>
   <footer class="note" style="margin-top:10px"><b>Application non officielle.</b> Elle n'est ni éditée ni validée par la BSPP ni par la Croix-Rouge française et sert uniquement à s'entraîner et à réviser. Développée par l'Unité Locale de Paris XVIII de la Croix-Rouge française.</footer>`;
  bindLevel();app.querySelectorAll(".chip[data-t]").forEach(c=>c.onclick=()=>{const id=c.dataset.t;selected.has(id)?selected.delete(id):selected.add(id);if(!selected.size)selected.add(id);store.set("themes",[...selected]);c.setAttribute("aria-pressed",selected.has(id))});
  $("#defiGo").onclick=()=>runQuiz(defiQuestions(),"defi",false);
  const ds=$("#defiShare");if(ds)ds.onclick=()=>shareText(`Défi CI BSPP ${w} : ${dd.score}/20 en ${fmtTime(dd.ms)}. À toi de jouer !`,$("#defiMsg"));
  app.querySelectorAll("[data-fiche]").forEach(b=>b.onclick=()=>reviseFiche(b.dataset.fiche));
  app.querySelectorAll(".tile[data-m]").forEach(m=>m.onclick=()=>({qcm:()=>runQuiz(shuffle(pool("qcm")).slice(0,10),"qcm",true),chrono:runChrono,flash:()=>runFlash(shuffle(pool("flashcards"))),ordre:()=>runOrdre(shuffle(pool("ordre"))),cas:()=>runCas(shuffle(pool("cas"))),
    exam:()=>runQuiz(shuffle([...pool("qcm"),...pool("vf")]).slice(0,30),"exam",false),review:runReview,radio:()=>go("radio"),carte:()=>go("carte"),grades:()=>viewGrades(true),marks:()=>{revTab="marks";go("revise")}})[m.dataset.m]());
}

/* ============ Jeux ============ */
/* Encouragements adaptés au niveau : plus chaleureux pour qui débute ou se trompe souvent, plus sobres pour qui est à l'aise */
function learnerTier(){const ids=Object.keys(hist);const answered=Object.values(hist).reduce((a,h)=>a+h.length,0);
 const recent=ids.sort((a,b)=>(histT[b]||0)-(histT[a]||0)).slice(0,40).map(id=>hist[id][hist[id].length-1]);
 const rate=recent.length?recent.reduce((a,b)=>a+b,0)/recent.length:0;
 if(answered<30||rate<.55)return "debut";if(answered>=60&&rate>=.8)return "aise";return "mid"}
const FB={
 debut:{ok:["Bravo, c'est exactement ça !","Super, tu progresses !","Bien vu, continue comme ça !","Excellent réflexe !","Oui ! Tu as le bon raisonnement.","Génial, une de plus dans la poche !"],
  ko:["Pas grave, c'est en se trompant qu'on apprend.","Presque ! Lis l'explication, tu l'auras la prochaine fois.","Normal de ne pas tout savoir au début, tu avances bien.","Ce n'est pas ça, mais cette explication va t'aider."],
  ko2:["Courage ! Prends le temps de lire l'explication et la page du référentiel : ça aide énormément.","On s'accroche ! Tout le monde est passé par là, chaque erreur te fait progresser."],
  back:["Et voilà, tu te reprends bien !","Bien joué, c'est reparti !"]},
 mid:{ok:["Exact !","Bien joué !","Bonne réponse.","C'est ça !"],ko:["Raté, retiens bien l'explication.","Pas tout à fait.","Non, mais tu étais proche."],ko2:["Deux de suite : relis bien l'explication."],back:["Exact, tu te reprends !"]},
 aise:{ok:["Correct.","Exact.","Juste.","Imparable."],ko:["Erreur : à revoir.","Raté.","Piège classique, celui-là."],ko2:["Attention, deux erreurs d'affilée."],back:["Correct."]}};
let fbStreak=0;
function cheer(ok){const t=FB[learnerTier()];let m;
 if(ok){m=pick(fbStreak<=-2?t.back:t.ok);fbStreak=fbStreak>0?fbStreak+1:1}
 else{fbStreak=fbStreak<0?fbStreak-1:-1;m=pick(fbStreak<=-2?t.ko2:t.ko)}
 return m}
function grade(p){const t=learnerTier();
 if(t==="debut")return p>=90?"Formidable, tu es prêt pour la suite !":p>=70?"Très beau résultat, continue !":p>=50?"Bon travail, tu progresses à chaque partie !":"Bravo d'avoir joué : relis le corrigé, la prochaine sera meilleure !";
 if(t==="aise")return p>=90?"Prêt pour la garde.":p>=70?"Solide.":p>=50?"À consolider.":"Retour au référentiel.";
 return p>=90?"Prêt pour la garde":p>=70?"Solide, encore un effort":p>=50?"À consolider":"Relis le corrigé et retente ta chance"}
function srcBtn(it){if(!it.ref||!DOC[it.ref.d])return `<span class="src">Source : ${esc(it.source)}</span>`;
  return `<button class="srcbtn" data-src="${esc(it._id)}">${I.doc}<span>Voir dans le référentiel · ${esc(DOC[it.ref.d].t)}, p. ${it.ref.p}</span></button>`}
function bindSrc(root=app){root.querySelectorAll("[data-src]").forEach(b=>b.onclick=()=>{const it=BYID[b.dataset.src];openDoc(it.ref.d,it.ref.p,termsFor(it))})}
function termsFor(it){const txt=it._k==="qcm"?it.choices[it.answer]+" "+it.explication:it._k==="vf"?it.q:it._k==="flashcards"?it.verso:it.titre;return tokens(txt).slice(0,8)}
const MODE_T={exam:"Examen blanc",review:"À revoir",defi:"Défi de la semaine",qcm:"Quiz",fiche:"Révision de fiche"};
function runQuiz(qs,mode,instant,back){
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
  const qs=shuffle(pool("vf"));if(!qs.length)return;
  let i=0,score=0,errs=0,timer,over=false;const missed=[];let deadline=Date.now()+60000;
  const left=()=>Math.max(0,Math.ceil((deadline-Date.now())/1000));
  const stop=()=>clearInterval(timer);
  const show=()=>{const q=qs[i%qs.length];
    cleanup=null; // ne pas arrêter le chrono en changeant de question
    app.innerHTML=push("Vrai ou faux 60 s",`${score} pts`)+`<div style="display:flex;justify-content:space-between;align-items:center;margin-top:16px"><span class="qtag">${esc(short(q._t))}</span><span class="timer" id="tm">${left()} s</span></div><p class="qtext">${esc(q.q)}</p><div class="vf"><button class="opt" data-k="1">VRAI</button><button class="opt" data-k="0">FAUX</button></div>`;
    cleanup=stop;bindBack();app.querySelectorAll(".opt").forEach(b=>b.onclick=()=>answer(+b.dataset.k))};
  const answer=k=>{if(over)return;const q=qs[i%qs.length];const ok=(k===1)===q.answer;record(q._id,ok);if(ok)score++;else{errs++;deadline-=3000;missed.push(q)}if(navigator.vibrate)navigator.vibrate(ok?12:[30,40,30]);i++;left()>0?show():end()};
  const end=()=>{if(over)return;over=true;stop();cleanup=null;setBest("chrono",score);setTimeout(syncSoon,50);
    app.innerHTML=push("Résultat")+`<div class="result"><div class="score">${score}</div><div class="grade">bonnes réponses en 60 s</div><p class="small">${errs} erreur(s) · chaque erreur coûte 3 s</p></div><div class="actions"><button class="btn full" id="again">Rejouer</button></div>
     ${missed.length?`<div class="sect">Ce que tu as raté</div><div class="recap">${missed.map(q=>`<div class="card"><div class="qhead"><b>${esc(q.q)}</b>${markBtn(q._id,false)}</div><div class="a">${q.answer?"VRAI":"FAUX"}</div><div class="e">${esc(q.explication)}</div>${srcBtn(q)}</div>`).join("")}</div>`:""}`;
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
    const it=items[i];let cur=shuffle(it.etapes.map((s,k)=>({s,k})));if(cur.length>1&&cur.every((c,k)=>c.k===k))cur.reverse();
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
  const show=()=>{if(i>=items.length){back?back():go(tab);return}const c=items[i];
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
  const draw=()=>{const qn=norm(revQ);const list=ALL.filter(x=>(revTab==="marks"?!!marks[x._id]:x._k===revTab)&&(!qn||norm(JSON.stringify([x.q,x.choices,x.explication,x.recto,x.verso,x.titre,x.etapes,x.situation,x.questions])).includes(qn))).slice(0,150);if(revTab==="marks")list.sort((a,b)=>marks[b._id]-marks[a._id]);
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
function levelSwitch(){return `<div class="lvl"><div class="seg"><button data-lvl="simple" aria-pressed="${level==="simple"}" title="Niveau Sapeur : questions de découverte">${gradeSvg("1CL","grade")}<span>Sapeur</span></button><button data-lvl="expert" aria-pressed="${level==="expert"}" title="Niveau Lieutenant : questions expertes">${gradeSvg("LTN","grade")}<span>Lieutenant</span></button></div></div>`}
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
 return shuffle(Q.docq).slice(0,n).map(x=>{const fam=Q.fam[x.d];const others=shuffle(docs.filter(d=>d.id!==x.d&&Q.fam[d.id]!==fam)).slice(0,2);
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
    <button class="tile" data-sm="radio"><span class="ic" style="background:#0f1d36">${RADIO_IC_T}</span><b>Messages radio</b><span>Construis tes messages pas à pas</span></button>
    <button class="tile" data-sm="carte"><span class="ic" style="background:#1f9d55">${MAP_IC_T}</span><b>Carte des secteurs</b><span>Les CS, leurs adresses, leur Golf</span></button>
    <button class="tile wide" data-sm="grades"><span class="ic gic">${gradeSvg("CNE","")}</span><div><b>Les grades</b><br><span>Reconnais les galons, du sapeur au général</span></div></button>
   </div>
   <div class="sect">Thèmes du quiz</div><div class="chips">${Object.entries(Q.themes).map(([k,l])=>`<button class="chip" data-st="${k}" aria-pressed="${sSel.has(k)}">${esc(l)}</button>`).join("")}</div>
   <div class="sect">Cette semaine</div>
   <div class="defi"><div class="wk">DÉFI ${w}</div><h2>Défi de la semaine</h2><p>Le défi est au niveau Lieutenant (×2) : tente-le quand tu te sens prêt.</p>${dd?`<p class="done">Ton premier essai : <b>${dd.score}/20</b></p>`:""}<div class="actions" style="margin-top:0"><button class="btn" id="defiGo">${dd?"Rejouer":"Relever le défi"}</button></div></div>
   ${homeBoard()}
   <div class="card" style="margin-top:14px"><b>Comment ça marche ?</b><p class="small" style="margin:6px 0 0">Au niveau Sapeur, chaque bonne réponse rapporte 5 points (×0,5). Au niveau Lieutenant, 20 points (×2). Après chaque question, « Voir dans le référentiel » t'ouvre la bonne page du document : c'est le meilleur moyen de les découvrir.</p></div>
   <footer class="note" style="margin-top:10px"><b>Application non officielle.</b> Elle n'est ni éditée ni validée par la BSPP ni par la Croix-Rouge française et sert uniquement à s'entraîner et à réviser. Développée par l'Unité Locale de Paris XVIII de la Croix-Rouge française.</footer>`;
  const pool=k=>Q.items.filter(x=>sSel.has(x.g)&&(!k||x.k===k));
  app.querySelectorAll("[data-st]").forEach(c=>c.onclick=()=>{const k=c.dataset.st;sSel.has(k)?sSel.delete(k):sSel.add(k);if(!sSel.size)sSel.add(k);store.set("sThemes",[...sSel]);c.setAttribute("aria-pressed",sSel.has(k))});
  const back=()=>go("home");
  app.querySelectorAll("[data-sm]").forEach(b=>b.onclick=()=>({quiz:()=>runSimple(shuffle(pool()).slice(0,10),"Quiz découverte"),vf:()=>runSimple(shuffle(pool("vf")).slice(0,10),"Vrai ou faux ?"),
   doc:()=>runSimple(docQuestions(10),"Devine le document"),mix:()=>runSimple(shuffle(Q.items).slice(0,16).concat(docQuestions(4)).sort(()=>Math.random()-.5),"Grand mélange"),
   radio:()=>go("radio"),carte:()=>go("carte"),grades:()=>viewGrades(false)})[b.dataset.sm]());
  $("#defiGo").onclick=()=>runQuiz(defiQuestions(),"defi",false);
 }).catch(()=>{const b=$("#sbody");if(b)b.innerHTML=`<div class="card"><p style="margin:0">Impossible de charger les questions du niveau Sapeur. Vérifie ta connexion.</p><button class="btn sec full" style="margin-top:12px" id="sRetry">Réessayer</button></div>`;const r=$("#sRetry");if(r)r.onclick=viewHomeSimple})}
function runSimple(qs,title){if(!qs.length)return;let i=0,score=0,combo=0,bestCombo=0;const missed=[];const back=()=>go("home");const before=discovered();
 const show=()=>{const q=qs[i];
  const choices=q._k==="qcm"?`<div class="opts">${q.choices.map((c,k)=>`<button class="opt" data-k="${k}"><span class="k">${LETTERS[k]}</span><span>${esc(c)}</span></button>`).join("")}</div>`
   :`<div class="vf"><button class="opt" data-k="1">VRAI</button><button class="opt" data-k="0">FAUX</button></div>`;
  app.innerHTML=push(title,`${i+1}/${qs.length}`)+`<div class="bar"><i style="width:${i/qs.length*100}%"></i></div>
   <div class="qhead"><span class="qtag">${esc(q._t.theme)}${q._k==="vf"?" · vrai ou faux":""}${combo>=2?` · <span class="combo">série ×${combo}</span>`:""}</span>${q._id.startsWith("doc:")?"":markBtn(q._id)}</div><p class="qtext">${esc(q.q)}</p>${choices}<div id="after"></div>`;
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
  app.innerHTML=push("Résultat")+`<div class="result"><div class="score">${score}/${qs.length}</div><div class="grade">${p>=90?"Excellent, tente le niveau Lieutenant !":grade(p)}</div>
    <p class="small">+${score*5} points${bestCombo>=3?` · meilleure série : ${bestCombo}`:""}</p></div>
   ${nw.length?`<div class="card"><b>Nouveaux documents découverts</b><div class="list" style="margin-top:8px">${nw.map(d=>`<button class="row" data-od="${d}"><span class="ic" style="background:var(--navy2)">${I.book}</span><span class="tx"><b>${esc(DOC[d].t)}</b><span>${DOC[d].n} page${DOC[d].n>1?"s":""} · ouvrir</span></span><span class="chev">${I.chev}</span></button>`).join("")}</div></div>`:""}
   <div class="actions"><button class="btn" id="again">Rejouer</button><button class="btn sec" id="home2">Accueil</button></div>
   ${missed.length?`<div class="sect">À retenir</div><div class="recap">${missed.map(q=>`<div class="card"><b>${esc(q.q)}</b><div class="a">${esc(q._k==="qcm"?q.choices[q.answer]:(q.answer?"Vrai":"Faux"))}</div><div class="e">${esc(q.explication)}</div></div>`).join("")}</div>`:""}`;
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
 else if(Array.isArray(g[3])){const L=g[3];const sw=8,gap=4,tot=L.length*sw+(L.length-1)*gap,x0=(W-tot)/2+6;
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
  <div class="gqbtns"><button class="btn" data-gq="0">${gradeSvg("1CL","grade")} Quiz niveau Sapeur</button><button class="btn dark" data-gq="1">${gradeSvg("LTN","grade")} Quiz niveau Lieutenant</button></div>
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
function runGradeQuiz(expert){const qs=gradeQuestions(expert);let i=0,score=0,combo=0;const pre=expert?"grade:":"s:grade:";
 const show=()=>{const q=qs[i];
  app.innerHTML=push("Quiz des grades",`${i+1}/${qs.length}`)+`<div class="bar"><i style="width:${i/qs.length*100}%"></i></div><div class="qhead"><span class="qtag">Grades · niveau ${expert?"Lieutenant":"Sapeur"}${combo>=2?` · <span class="combo">série ×${combo}</span>`:""}</span></div>
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

/* ============ Messages radio ============ */
const RADIO_IC='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="8" width="12" height="13" rx="2.5"/><path d="M9 8 7 3"/><path d="M9.5 12h5M9.5 15h5"/><circle cx="12" cy="18.2" r=".6" fill="currentColor"/></svg>';
let radioId=store.get("radioId",{num:"",cs:"",golf:"",t:0});
function saveRadioId(v){radioId={num:String(v.num||"").trim().slice(0,6),cs:String(v.cs||"").trim().slice(0,40),golf:String(v.golf||"").trim().slice(0,3),t:Date.now()};store.set("radioId",radioId);if(typeof syncSoon==="function")syncSoon(2000)}
const rMe=()=>`Croix-Rouge française ${radioId.num||"XXX"} de ${radioId.cs||"(centre de secours)"}`;
const rGolf=()=>`Golf ${radioId.golf||"X"}`;
const rPf=()=>`Poste fixe de ${radioId.cs||"(centre de secours)"}`;
const rHour=()=>{const d=new Date();return d.getHours()+" h "+String(d.getMinutes()).padStart(2,"0")};
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
   ...PRES.map(p=>({k:"h_"+p[0],l:"Heure — "+p[2],ph:"ex. 14 h 05",show:f=>f.opt==="2"&&(f.who||[]).includes(p[0])}))],
  build:f=>{const w=(f.who||[]);const items=PRES.filter(p=>w.includes(p[0])).map(p=>{const n=p[0]==="em"?`Équipe médicale ${rv(f.hosp,"(hôpital)")}`:p[1];
    return f.opt==="2"?`${n} présenté${p[3]==="f"?"e":""} à ${rv(f["h_"+p[0]],"(telle heure)")}`:`${n} se présente`});
   return{lines:[["CRF",`${rGolf()} ici la ${rMe()}, parlez.`],["CSO",`${rMe()} ici ${rGolf()}, parlez.`],["CRF",`De la ${rMe()} : ${items.length?items.join(". "):"(moyen) se présente"}. ${rGolf()} parlez.`]],
    notes:["Principe du « tiroir » : tout moyen demandé doit être présenté. Les engins BSPP se présentent eux-mêmes.","Option 1 : pratique quand tu n'attends qu'un seul moyen. Option 2 : mieux quand plusieurs moyens sont attendus."]}}},
 clot:{t:"Clôture du renseignement",s:"Dénombrement définitif, suite donnée, heures",c:"#30b0c7",p:14,
  fields:[{k:"nua",t:"num",l:"UA"},{k:"uaBy",l:"UA transportée(s) par",ph:"ex. équipe médicale"},{k:"nur",t:"num",l:"UR"},{k:"urBy",l:"UR transportée(s) par",ph:"ex. moyens de transport non médicalisés"},
   {k:"who",t:"multi",l:"Moyens non BSPP présentés",o:PRES.map(p=>[p[0],p[2]]),d:["pol"]},...PRES.map(p=>({k:"h_"+p[0],l:"Heure — "+p[2],ph:"ex. 14 h 05",show:f=>(f.who||[]).includes(p[0])}))],
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
   {k:"hm",l:"Heure du message concerné",ph:"ex. 14 h 12",show:f=>f.cas==="add"},{k:"add",l:"Ajout ou modification",ph:"ex. victime transportée par équipe médicale",show:f=>f.cas==="add"}],
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
function viewRadio(){
 const head=`${backLink()}<h1 class="big">Messages radio</h1><p class="sub">Construis tes messages phonie BSPP, entraîne-toi au dialogue avec le CSO et révise les statuts.</p>${indicCard()}
  <div class="seg" style="margin:14px 0">${[["build","Construire"],["train","S'entraîner"],["statuts","Statuts"]].map(([k,l])=>`<button data-rt="${k}" aria-pressed="${k===radioTab}">${l}</button>`).join("")}</div>`;
 let body="";
 if(radioTab==="build")body=`<div class="list">${Object.entries(RB).map(([k,b])=>`<button class="row" data-rb="${k}"><span class="ic" style="background:${b.c}">${k==="rentree"?I.doc:k==="danger"?I.siren:RADIO_IC}</span><span class="tx"><b>${esc(b.t)}</b><span>${esc(b.s)}</span></span><span class="chev">${I.chev}</span></button>`).join("")}</div>
   <div class="card" style="margin-top:14px"><b>Règles d'or</b><ul class="rrules"><li>Fréquence <b>SGAP-OPS</b> du groupement où tu te trouves.</li><li>Vérifie qu'aucun échange n'est en cours avant de transmettre.</li><li>Appuie sur la pédale, attends environ <b>3 secondes</b> (relais) puis parle.</li><li>Interlocuteur principal : le CSO (« Golf »). Radio en panne : téléphone au CSO, à défaut au PVO.</li><li>La victime d'abord : mieux vaut un message imparfait qu'une victime délaissée.</li></ul><button class="srcbtn" data-gp="8">${I.doc}<span>Guide pratique CI, p. 8-16</span></button></div>`;
 else if(radioTab==="train"){const st=store.get("radioBest",null);
  body=`<div class="card"><h2 style="font-size:20px;margin:0 0 6px">Simulateur radio</h2><p class="small" style="margin:0 0 12px">10 situations tirées au hasard : statut à passer, moyen à demander, bon message à transmettre, réponse au CSO, CRI… Chaque bonne réponse rapporte des points au classement.</p>
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
 const sg=$("#simGo");if(sg)sg.onclick=runRadioSim;
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

function viewCarte(){
 const head=`${backLink()}<h1 class="big">Carte des secteurs</h1><p class="sub">Les ${SECT?SECT.sect.length:26} centres de secours et leurs secteurs, par groupement (Golf).</p>
  <div class="seg" style="margin:0 0 12px">${[["map","Carte"],["list","Liste"],["quiz","Quiz"]].map(([k,l])=>`<button data-ct="${k}" aria-pressed="${k===carteTab}">${l}</button>`).join("")}</div>`;
 app.innerHTML=head+`<div id="cbody"><div class="loading">Chargement de la carte…</div></div>`;bindTabBack();
 app.querySelectorAll("[data-ct]").forEach(b=>b.onclick=()=>{carteTab=b.dataset.ct;store.set("carteTab",carteTab);if(cleanup){cleanup();cleanup=null}viewCarte()});
 const need=carteTab==="map"?Promise.all([loadSect(),loadLeaflet()]):loadSect();
 need.then(()=>{if(tab!=="carte"||!$("#cbody"))return;({map:carteMapView,list:carteListView,quiz:carteQuizView})[carteTab]()})
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
  <button class="tile" data-cq="tap"><span class="ic" style="background:#e3051b">${MAP_IC}</span><b>Situe le secteur</b><span>Touche le bon secteur sur la carte${bq.tap!=null?` · record ${bq.tap}/10`:""}</span></button></div>
  <div class="card" style="margin-top:12px"><b>Pourquoi c'est utile ?</b><p class="small" style="margin:6px 0 0">Connaître le code 4 lettres du CS (ex. PLAI pour la saisie GDR), son groupement pour savoir quel Golf appeler, et les secteurs limitrophes (« carré des neuf ») pour les départs hors secteur et les renforts.</p></div>`;
 b.querySelectorAll("[data-cq]").forEach(x=>x.onclick=()=>x.dataset.cq==="qcm"?runCarteQuiz():Promise.all([loadSect(),loadLeaflet()]).then(runCarteTap).catch(()=>toast("Carte indisponible hors connexion.")))}
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
function runCarteQuiz(){loadSect().then(()=>{const qs=carteQuestions();let i=0,score=0;
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
  $("#next").onclick=()=>{i++;if(i<10)ask();else end()}};
 const end=()=>{const bq=store.get("carteBest",{});if(bq.tap==null||score>bq.tap){bq.tap=score;store.set("carteBest",bq)}setTimeout(syncSoon,50);if(cleanup){cleanup();cleanup=null}
  app.innerHTML=push("Résultat")+`<div class="result"><div class="score">${score}/10</div><div class="grade">${grade(score*10)}</div><p class="small">secteurs situés du premier coup</p></div><div class="actions"><button class="btn" id="again">Rejouer</button></div>`;
  bindBack(()=>go("carte"));$("#again").onclick=runCarteTap};
 ask();setTimeout(()=>m.invalidateSize(),60)}

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
  viewMe(head)}
function bindProfTabs(){bindTabBack();app.querySelectorAll("[data-pt]").forEach(b=>b.onclick=()=>{profTab=b.dataset.pt;store.set("profTab",profTab);viewProfile()})}
function viewMe(head){
  const rows=FICHES.map(f=>({f,s:ficheStats(f.id)})).filter(x=>x.s.n>0);const g=globalStats();
  const order={ko:0,warn:1,none:2,ok:3};
  const shown=rows.filter(x=>profFilter==="all"||x.s.st===profFilter).sort((a,b)=>order[a.s.st]-order[b.s.st]||b.s.ko-a.s.ko||b.s.n-a.s.n);
  const answered=Object.keys(hist).filter(id=>BYID[id]).length;const correct=Object.values(hist).reduce((a,h)=>a+h.filter(Boolean).length,0),tot=Object.values(hist).reduce((a,h)=>a+h.length,0);
  app.innerHTML=head+`${meCard()}<div class="sect">Mon évaluation</div>
   <div class="card"><div class="kpis"><div class="kpi"><b>${g.by.ok}</b><span>fiches acquises</span></div><div class="kpi"><b>${g.by.warn}</b><span>en cours</span></div><div class="kpi"><b>${g.by.ko}</b><span>à travailler</span></div></div>
    <div class="prog" style="height:10px;margin-top:14px"><i class="p1" style="width:${g.by.ok/rows.length*100}%"></i><i class="p2" style="width:${g.by.warn/rows.length*100}%"></i><i class="p3" style="width:${g.by.ko/rows.length*100}%"></i></div>
    <div class="legend"><span><i style="background:var(--ok)"></i>Acquise</span><span><i style="background:var(--warn)"></i>En cours</span><span><i style="background:var(--ko)"></i>À travailler</span><span><i style="background:var(--card2)"></i>Pas encore vue</span></div></div>
   <div class="sect">Fiches</div>
   <div class="seg">${[["ko","À travailler"],["warn","En cours"],["ok","Acquises"],["none","Pas vues"],["all","Toutes"]].map(([k,l])=>`<button data-pf="${k}" aria-pressed="${k===profFilter}">${l} (${k==="all"?rows.length:rows.filter(x=>x.s.st===k).length})</button>`).join("")}</div>
   <div class="list" style="margin-top:10px">${shown.map(({f,s})=>`<button class="row" data-fiche="${esc(f.id)}"><span class="tx"><b>${esc(f.label)}</b><span>${s.ok}/${s.n} acquises${s.ko?` · ${s.ko} ratée(s)`:""}</span><span class="prog"><i class="p1" style="width:${s.ok/s.n*100}%"></i><i class="p3" style="width:${s.ko/s.n*100}%"></i></span></span><span class="pill ${ST[s.st][1]}">${ST[s.st][0]}</span></button>`).join("")||`<div class="row"><span class="tx"><span>${profFilter==="ko"?"Aucune fiche à travailler pour l'instant. Joue quelques quiz pour lancer l'évaluation.":"Aucune fiche dans cette catégorie."}</span></span></div>`}</div>
   <p class="small" style="margin:8px 4px 0">Une question est acquise quand tu as réussi tes deux dernières tentatives. Une fiche est acquise à partir de 80 % de questions acquises, et à travailler sous 60 % de réussite sur les questions vues.</p>
   <div class="sect">Statistiques</div>
   <div class="list"><div class="row"><span class="tx"><b>Questions vues</b></span><span>${answered} / ${ALL.filter(x=>SCORED.has(x._k)).length}</span></div><div class="row"><span class="tx"><b>Taux de réussite</b></span><span>${tot?Math.round(correct/tot*100):0} %</span></div><div class="row"><span class="tx"><b>Série en cours</b></span><span>${streak()} jour(s)</span></div>
    <div class="row"><span class="tx"><b>Records</b></span><span class="small">${[best.qcm!=null?`Quiz ${best.qcm} %`:"",best.exam!=null?`Examen ${best.exam} %`:"",best.chrono!=null?`V/F ${best.chrono} pts`:""].filter(Boolean).join(" · ")||"Aucun pour l'instant"}</span></div></div>
   ${accountCard()}<div class="sect">Réinitialiser</div>
   <div class="card"><p style="margin:0 0 12px">Remet à zéro l'évaluation continue : fiches, questions à revoir, records, série et défis joués. Les thèmes choisis sont conservés.</p>
    ${confirmReset?`<div class="confirm"><b>Tout effacer ?</b><p class="small" style="margin:4px 0 12px">Cette action ne peut pas être annulée.</p><div class="actions" style="margin:0"><button class="btn" id="resetYes" style="background:var(--ko)">Oui, tout effacer</button><button class="btn sec" id="resetNo">Annuler</button></div></div>`:`<button class="btn sec full" id="resetBtn" style="color:var(--ko)">Réinitialiser mon évaluation</button>`}</div>`;
  bindProfTabs();bindMe();app.querySelectorAll("[data-pf]").forEach(b=>b.onclick=()=>{profFilter=b.dataset.pf;viewProfile()});
  app.querySelectorAll("[data-fiche]").forEach(b=>b.onclick=()=>ficheSheet(b.dataset.fiche));
  const rb=$("#resetBtn");if(rb)rb.onclick=()=>{confirmReset=true;viewProfile();$("#resetYes").scrollIntoView({block:"center"})};
  const ry=$("#resetYes");if(ry)ry.onclick=()=>{localReset();confirmReset=false;syncNow();viewProfile()};
  const rn=$("#resetNo");if(rn)rn.onclick=()=>{confirmReset=false;viewProfile()};
}
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
  let r;try{r=await fetch(url,{method,headers:h,body:b?JSON.stringify(b):undefined,cache:"no-store",credentials:"same-origin"})}catch(e){throw {offline:true,error:"Pas de connexion. Réessaie avec du réseau."}}
  if(r.status===404&&!(r.headers.get("content-type")||"").includes("json")){apiState="absent";store.set("apiState",apiState);throw {absent:true,error:"Le classement n'est pas activé sur ce site."}}
  let j={};try{j=await r.json()}catch(e){}
  apiState="ok";store.set("apiState",apiState);
  if(!r.ok)store.set("lastErr",{at:Date.now(),path,method,status:r.status,code:j.code||"",msg:j.error||""});
  if(r.status===401&&me&&me.token&&!retried){await new Promise(res=>setTimeout(res,2500));return api(path,method,body,true)}
  if(r.status===401&&me&&me.token){me.expired=true;saveMe();setTimeout(()=>location.replace(location.pathname),300)}
  if(!r.ok)throw {status:r.status,error:j.error||"Erreur "+r.status};return j}
async function loadCfg(){try{srvCfg=await api("config");store.set("srvCfg",srvCfg)}catch(e){}return srvCfg}
function themePct(){const o={};DATA.forEach(t=>{const items=ALL.filter(x=>x._t===t&&SCORED.has(x._k));const k=items.filter(x=>known(x._id)).length;o[t.id]=items.length?Math.round(k/items.length*100):0});return o}
function buildStats(){const g=globalStats();const w=isoWeek();
  const T=cntTotal();return {points:T.points,answered:T.answered,correct:T.correct,fichesOk:g.by.ok,fichesTotal:FICHES.length,seen:Object.keys(hist).length,streak:streak(),
    bestExam:best.exam||0,bestQcm:best.qcm||0,bestChrono:best.chrono||0,themes:themePct(),defi:defiDone[w]?{week:w,score:defiDone[w].score,ms:defiDone[w].ms}:null}}
function mergeProgress(a, b) {
  a = a || {}; b = b || {};
  const rdA = a.radio, rdB = b.radio; // l'indicatif radio survit aux remises à zéro
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
  if (rd) out.radio = { num: String(rd.num || "").slice(0, 6), cs: String(rd.cs || "").slice(0, 40), golf: String(rd.golf || "").slice(0, 3), t: Number(rd.t) || 0 };
  return out;
}

function localProgress(){return {v:1,resetAt:progReset,hist,histT,best,days,defi:defiDone,cntDev,marks:marksLog,radio:radioId}}
function applyProgress(p){hist=p.hist||{};histT=p.histT||{};best=p.best||{};days=p.days||[];defiDone=p.defi||{};cntDev=p.cntDev||{};if(!cntDev[DEV])cntDev[DEV]={points:0,answered:0,correct:0};cnt=cntDev[DEV];
  marksLog=p.marks||{};rebuildMarks();progReset=p.resetAt||0;if(p.radio&&(+p.radio.t||0)>=(+radioId.t||0)){radioId=p.radio;store.set("radioId",radioId)}
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
async function syncNow(){if(!me||me.expired||syncing)return;syncing=true;dirty=false;
  try{const before=JSON.stringify(localProgress());
    const pr=await api("progress","PUT",{progress:localProgress()});
    if(pr&&pr.progress){applyProgress(pr.progress);progLoaded=true;if(JSON.stringify(localProgress())!==before)refreshLocalViews()}
    let j=await api("profile","PUT",{stats:buildStats()});
    if(typeof j.admin==="boolean"&&j.admin!==me.admin){me.admin=j.admin;saveMe()}
    store.set("lastSync",Date.now());await loadBoard(true)}
  catch(e){dirty=true}finally{syncing=false}}
function refreshLocalViews(){if(document.body.classList.contains("pushed")||$("#sheet"))return;if(tab==="home")viewHome();else if(tab==="profile")viewProfile();else if(tab==="revise")viewRevise()}
async function loadBoard(silent){if(!me||me.expired)return null;
  try{const j=await api("board");board={profiles:j.profiles,teams:j.teams||[],at:Date.now()};store.set("board",board);refreshTeamViews();return board}
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
  points:{l:()=>"Points",f:p=>p.stats&&p.stats.points>0,v:p=>p.stats.points,fmt:p=>p.stats.points.toLocaleString("fr-FR")+" pts"},
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
let boardMetric=store.get("boardMetric","defi");
function renderBoard(fromRefresh){const el=$("#board");if(!el)return;
  if(!me||me.expired){el.innerHTML=noProfileCard();bindMe();return}
  if(boardScope==="teams"){renderTeamsBoard(el,fromRefresh);return}
  const r=ranked(boardMetric);const tid=myTeamId(),tm=teamOf(tid);
  if(boardScope==="team"&&!tm){el.innerHTML=`<div class="seg" style="margin-bottom:12px"><button data-sc="team" aria-pressed="true">Mon équipe</button><button data-sc="all" aria-pressed="false">Tout le monde</button><button data-sc="teams" aria-pressed="false">Équipes</button></div>${noTeamCard()}`;bindScope(el);bindTeams();if(!fromRefresh&&(!board||Date.now()-board.at>8000))loadBoard(true);return}
  el.innerHTML=`<div class="seg" style="margin-bottom:12px"><button data-sc="team" aria-pressed="${boardScope==="team"}">${esc(tm?tm.name:"Mon équipe")}</button><button data-sc="all" aria-pressed="${boardScope==="all"}">Tout le monde</button><button data-sc="teams" aria-pressed="false">Équipes</button></div><div class="chips">${Object.entries(METRICS).map(([k,m])=>`<button class="chip" data-bm="${k}" aria-pressed="${k===boardMetric}">${esc(m.l())}</button>`).join("")}</div>
   ${boardMetric==="defi"?`<div class="card" style="margin:10px 0;display:flex;gap:12px;align-items:center"><div style="flex:1"><b>Défi ${isoWeek()}</b><div class="small">Seul le premier essai compte. Égalité départagée au temps.</div></div><button class="btn small" id="bDefi">${defiDone[isoWeek()]?"Rejouer":"Jouer"}</button></div>`:""}
   <div class="list" style="margin-top:10px">${r.map((p,i)=>`<div class="row lbrow ${p.id===me.id?"mine":""}"><span class="rk ${i<3?"top"+(i+1):""}">${i+1}</span>${avatar(p)}<span class="tx"><b>${esc(p.pseudo)}${p.id===me.id?" (toi)":""}</b><span>${esc([p.unite,boardScope==="all"&&teamOf(p.team)?teamOf(p.team).name:""].filter(Boolean).join(" · "))}</span></span><span class="val">${esc(METRICS[boardMetric].fmt(p))}</span></div>`).join("")||`<div class="row"><span class="tx"><span>Personne n'est encore classé ici. ${boardMetric==="defi"?"Lance le défi de la semaine !":"Joue quelques quiz pour apparaître."}</span></span></div>`}</div>
   <p class="small" style="margin:10px 4px">${board&&board.at?`Mis à jour ${new Date(board.at).toLocaleString("fr-FR",{weekday:"short",hour:"2-digit",minute:"2-digit"})}`:"Pas encore chargé"} · ${scopeProfiles().length} membre(s)</p>
   <button class="btn sec full" id="bRefresh">Actualiser</button><p class="small" id="bMsg" style="margin:8px 4px"></p>`;
  el.querySelectorAll("[data-bm]").forEach(b=>b.onclick=()=>{boardMetric=b.dataset.bm;store.set("boardMetric",boardMetric);renderBoard(true)});bindScope(el);
  const d=$("#bDefi");if(d)d.onclick=()=>runQuiz(defiQuestions(),"defi",false);
  $("#bRefresh").onclick=async()=>{const m=$("#bMsg");m.textContent="Mise à jour…";try{await syncNow();await loadBoard();m.textContent=""}catch(e){m.textContent=e.error||"Échec de la mise à jour."}};
  if(!fromRefresh&&(!board||Date.now()-board.at>8000))loadBoard(true);
}
function teamRanking(){const P=board&&board.profiles||[];return (board&&board.teams||[]).map(t=>{const m=P.filter(p=>p.team===t.id);const pts=m.map(p=>(p.stats&&p.stats.points)||0);const sum=pts.reduce((a,b)=>a+b,0);
  return {t,n:m.length,sum,avg:m.length?Math.round(sum/m.length):0}}).sort((a,b)=>b.avg-a.avg||b.n-a.n||String(a.t.name).localeCompare(b.t.name))}
function renderTeamsBoard(el,fromRefresh){const rows=teamRanking();const mine=myTeamId();
  el.innerHTML=`<div class="seg" style="margin-bottom:12px"><button data-sc="team" aria-pressed="false">Mon équipe</button><button data-sc="all" aria-pressed="false">Tout le monde</button><button data-sc="teams" aria-pressed="true">Équipes</button></div>
   <p class="small" style="margin:0 4px 10px">Classement des équipes selon la <b>moyenne des points</b> de leurs membres.</p>
   <div class="list">${rows.map((x,i)=>`<div class="row lbrow ${x.t.id===mine?"mine":""}"><span class="rk ${i<3?"top"+(i+1):""}">${i+1}</span><span class="av" style="width:36px;height:36px;background:var(--navy2);font-size:14px">${esc(initials(x.t.name))}</span><span class="tx"><b>${esc(x.t.name)}${x.t.id===mine?" (ton équipe)":""}</b><span>${x.n} membre${x.n>1?"s":""} · ${x.sum.toLocaleString("fr-FR")} pts au total</span></span><span class="val">${x.avg.toLocaleString("fr-FR")} pts</span></div>`).join("")||`<div class="row"><span class="tx"><span>Aucune équipe avec des membres pour l'instant.</span></span></div>`}</div>
   <p class="small" style="margin:10px 4px">${board&&board.at?`Mis à jour ${new Date(board.at).toLocaleString("fr-FR",{weekday:"short",hour:"2-digit",minute:"2-digit"})}`:"Pas encore chargé"}</p>
   <button class="btn sec full" id="bRefresh">Actualiser</button><p class="small" id="bMsg" style="margin:8px 4px"></p>`;
  bindScope(el);$("#bRefresh").onclick=async()=>{const m=$("#bMsg");m.textContent="Mise à jour…";try{await syncNow();await loadBoard();m.textContent=""}catch(e){m.textContent=e.error||"Échec de la mise à jour."}};
  if(!fromRefresh&&(!board||Date.now()-board.at>8000))loadBoard(true)}
function bindScope(el){el.querySelectorAll("[data-sc]").forEach(b=>b.onclick=()=>{boardScope=b.dataset.sc;store.set("boardScope",boardScope);renderBoard(true)})}
function noTeamCard(){return `<div class="card"><h2 style="font-size:20px;margin-bottom:6px">Tu n'es dans aucune équipe</h2><p class="small" style="margin:0 0 12px">Rejoins une équipe existante ou crée la tienne pour te comparer à tes coéquipiers.</p><button class="btn full" data-teams="1">Rejoindre ou créer une équipe</button></div>`}
function teamCard(){const tid=myTeamId(),tm=teamOf(tid);
  if(!tm)return `<div class="sect">Mon équipe</div>${noTeamCard()}`;
  const n=(board.profiles||[]).filter(p=>p.team===tid).length;const owner=tm.ownerId===me.id;
  return `<div class="sect">Mon équipe</div><div class="card"><div style="display:flex;gap:12px;align-items:center"><span class="av" style="width:44px;height:44px;background:var(--navy2);font-size:17px">${esc(initials(tm.name))}</span><div style="flex:1;min-width:0"><b style="font-size:18px">${esc(tm.name)}</b><div class="small">${n} membre(s)${owner?" · tu l'as créée":""}</div></div></div>
   ${(()=>{const rk=teamRanking();const i=rk.findIndex(x=>x.t.id===tid);return i<0?"":`<button class="teamrank" id="goTeams"><span class="rk ${i<3?"top"+(i+1):""}" style="font-size:22px;width:auto">${i+1}<sup style="font-size:12px">${i?"e":"re"}</sup></span><span style="flex:1;text-align:left"><b>sur ${rk.length} équipe${rk.length>1?"s":""}</b><br><span class="small">Moyenne : ${rk[i].avg.toLocaleString("fr-FR")} pts par membre</span></span><span class="small" style="color:var(--red);font-weight:600">Classement ›</span></button>`})()}
   <div class="actions"><button class="btn sec small" data-teams="1">Changer d'équipe</button><button class="btn sec small" id="leaveTeam">Quitter</button>${owner||me.admin?`<button class="btn sec small" id="delTeam" style="color:var(--ko)">Supprimer l'équipe</button>`:""}</div><p class="small" id="tmMsg" style="margin:8px 0 0"></p></div>`}
function bindTeams(){
  const gt=$("#goTeams");if(gt)gt.onclick=()=>{profTab="equipe";store.set("profTab",profTab);boardScope="teams";store.set("boardScope",boardScope);viewProfile()};
  app.querySelectorAll("[data-teams]").forEach(b=>b.onclick=teamsSheet);
  const lv=$("#leaveTeam");if(lv)lv.onclick=async()=>{if(!lv.dataset.c){lv.dataset.c="1";lv.textContent="Confirmer : quitter";return}try{await api("teams/leave","POST",{});me.team=null;saveMe();await loadBoard(true);viewProfile();toast("Tu as quitté l'équipe.")}catch(e){$("#tmMsg").textContent=e.error||"Erreur."}};
  const dl=$("#delTeam");if(dl)dl.onclick=async()=>{if(!dl.dataset.c){dl.dataset.c="1";dl.textContent="Confirmer la suppression";$("#tmMsg").textContent="L'équipe sera supprimée pour tous ses membres (leurs scores sont conservés).";return}
    try{await api("teams","DELETE",{teamId:myTeamId()});me.team=null;saveMe();await loadBoard(true);viewProfile();toast("Équipe supprimée.")}catch(e){$("#tmMsg").textContent=e.error||"Erreur."}};
}
async function teamsSheet(){const sh=sheet(`<h2>Équipes</h2><p class="small">Tu ne peux être que dans une seule équipe à la fois.</p><div id="tlist"><div class="loading">Chargement…</div></div>
   <div class="sect">Créer une équipe</div><form id="tform" class="form" style="display:flex;gap:8px;align-items:flex-end"><div style="flex:1;min-width:0;display:grid;gap:6px"><label for="tName" style="margin-top:0">Nom de l'équipe</label><input id="tName" maxlength="40" placeholder="ex. CRF Paris 18 · garde du lundi"></div><button class="btn" type="submit">Créer</button></form><p class="small" id="tsMsg" style="color:var(--ko)"></p>
   <div class="actions"><button class="btn sec full" data-close>Fermer</button></div>`);
  let data;try{data=await api("teams")}catch(e){sh.querySelector("#tlist").innerHTML=`<p class="small">${esc(e.error||"Erreur.")}</p>`;return}
  const cur=data.myTeam,curName=(data.teams.find(t=>t.id===cur)||{}).name;
  sh.querySelector("#tlist").innerHTML=data.teams.length?`<div class="list">${data.teams.map(t=>`<div class="row"><span class="av" style="width:36px;height:36px;background:var(--navy2);font-size:14px">${esc(initials(t.name))}</span><span class="tx"><b>${esc(t.name)}</b><span>${t.members} membre(s) · créée par ${esc(t.owner)}</span></span>${t.id===cur?`<span class="pill ok">Ton équipe</span>`:`<button class="btn small" data-join="${esc(t.id)}">Rejoindre</button>`}</div>`).join("")}</div>${cur?`<p class="small" style="margin:8px 4px 0">Rejoindre une autre équipe te fera quitter « ${esc(curName||"ton équipe")} ».</p>`:""}`:`<p class="small">Aucune équipe pour l'instant. Crée la première ci-dessous.</p>`;
  sh.querySelectorAll("[data-join]").forEach(b=>b.onclick=async()=>{b.disabled=true;try{const j=await api("teams/join","POST",{teamId:b.dataset.join});me.team=j.team.id;saveMe();closeSheet();await loadBoard(true);viewProfile();toast("Tu as rejoint « "+j.team.name+" ».")}catch(e){sh.querySelector("#tsMsg").textContent=e.error||"Erreur.";b.disabled=false}});
  sh.querySelector("#tform").onsubmit=async e=>{e.preventDefault();const name=sh.querySelector("#tName").value.trim();try{const j=await api("teams","POST",{name});me.team=j.team.id;saveMe();closeSheet();await loadBoard(true);viewProfile();toast("Équipe « "+j.team.name+" » créée.")}catch(err){sh.querySelector("#tsMsg").textContent=err.error||"Erreur."}};
}
function homeBoard(){if(!me||!board)return `<div id="homeBoard"></div>`;
  const tid=myTeamId(),tm=teamOf(tid),all=board.profiles||[];const w=isoWeek();
  const pts=p=>(p.stats&&p.stats.points)||0,dfi=p=>p.stats&&p.stats.defi&&p.stats.defi.week===w?p.stats.defi.score:null;
  const members=(tm?all.filter(p=>p.team===tid):all).slice().sort((a,b)=>pts(b)-pts(a)||(dfi(b)??-1)-(dfi(a)??-1)||String(a.pseudo).localeCompare(b.pseudo));
  const cut=(list,isMine,n=6)=>{const k=list.findIndex(isMine);if(list.length<=n||k<n-1)return list.slice(0,n).map((x,i)=>[x,i]);return list.slice(0,n-2).map((x,i)=>[x,i]).concat([[null,-1],[list[k],k]])};
  const rowP=([p,i])=>p?`<div class="hbrow ${p.id===me.id?"mine":""}"><span class="rk ${i<3?"top"+(i+1):""}">${i+1}</span>${avatar(p,28)}<span class="nm">${esc(p.pseudo)}${p.id===me.id?" (toi)":""}</span><span class="small">${dfi(p)!=null?`défi ${dfi(p)}/20 · `:""}<b>${pts(p).toLocaleString("fr-FR")}</b> pts</span></div>`:`<div class="hbgap">⋯</div>`;
  const rk=teamRanking();const ti=rk.findIndex(x=>x.t.id===tid);
  const rowT=([x,i])=>x?`<div class="hbrow ${x.t.id===tid?"mine":""}"><span class="rk ${i<3?"top"+(i+1):""}">${i+1}</span><span class="nm"><b>${esc(x.t.name)}</b><br><span class="small">${x.n} membre${x.n>1?"s":""}</span></span><span class="small"><b>${x.avg.toLocaleString("fr-FR")}</b> pts moy.</span></div>`:`<div class="hbgap">⋯</div>`;
  return `<div id="homeBoard"><div class="sect">${tm?"Mon équipe · "+esc(tm.name):"Classement général"}</div>
   <button class="card hbcard" id="hbGo"><div class="hbhead"><b>${tm?"Mon équipe":"Tous les membres"}</b><span class="small">${members.length} membre${members.length>1?"s":""} ›</span></div>
    ${members.length?cut(members,p=>p.id===me.id).map(rowP).join(""):`<span class="small">Aucun membre pour l'instant.</span>`}
    ${tm&&members.length===1?`<p class="small" style="margin:8px 0 0">Tu es seul dans l'équipe : invite tes coéquipiers à la rejoindre depuis Profil › Équipe.</p>`:""}
    ${tm?"":`<p class="small" style="margin:8px 0 0">Rejoins une équipe depuis Profil › Équipe pour te comparer à tes coéquipiers.</p>`}</button>
   ${rk.length?`<button class="card hbcard" id="hbTeams" style="margin-top:10px"><div class="hbhead"><b>Équipes</b><span class="small">${ti>=0?`Ton équipe : ${ti+1}<sup>${ti?"e":"re"}</sup>/${rk.length}`:`${rk.length} équipe${rk.length>1?"s":""}`} ›</span></div>
    ${cut(rk,x=>x.t.id===tid,5).map(rowT).join("")}<p class="small" style="margin:8px 0 0">Moyenne des points des membres de chaque équipe.</p></button>`:""}</div>`}
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
  return `<div class="card"><div style="display:flex;gap:12px;align-items:center">${avatar(me,52)}<div style="flex:1;min-width:0"><b style="font-size:19px">${esc(me.pseudo)}</b>${me.superAdmin?` <span class="pill warn">Super admin</span>`:me.admin?` <span class="pill warn">Admin</span>`:""}<div class="small">${esc(me.unite||"")}${me.unite?" · ":""}${s.points.toLocaleString("fr-FR")} points</div></div><button class="btn sec small" id="editProfile">Modifier</button></div>
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
async function drawAdminTeams(){const el=$("#adTeams");if(!el)return;let d;try{d=await api("teams")}catch(e){el.innerHTML=`<p class="small">${esc(e.error||"Erreur.")}</p>`;return}
  const rk=teamRanking();$("#tcount").textContent=d.teams.length;
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
   <div class="sect">Équipes (<span id="tcount">…</span>)</div><div id="adTeams"><div class="loading">Chargement…</div></div>
   <div class="sect">Membres (${A.members.length})</div>
   <input class="search" id="aq" type="search" placeholder="Rechercher un membre" value="${esc(adminQ)}">
   <div class="list" style="margin-top:10px">${mem.map(m=>`<button class="row lbrow" data-mem="${esc(m.id)}">${avatar(m)}<span class="tx"><b>${esc(m.pseudo)} ${badge(m)}</b><span>${esc(m.email||"sans compte Google")}${m.unite?" · "+esc(m.unite):""}</span><span>${(m.stats&&m.stats.points||0).toLocaleString("fr-FR")} pts · ${m.lastLogin?"vu "+new Date(m.lastLogin).toLocaleDateString("fr-FR"):"jamais connecté"}</span></span><span class="chev">${I.chev}</span></button>`).join("")||`<div class="row"><span class="tx"><span>Aucun membre.</span></span></div>`}</div>
   <p class="small" style="margin:10px 4px">Super administrateur : ${esc(A.superEmail)}. ${A.superAdmin?"Tu peux nommer d'autres administrateurs depuis la fiche d'un membre.":"Seul le super administrateur peut nommer des administrateurs."}</p>`;
  bindBack(()=>go("profile"));
  $("#aform").onsubmit=async e=>{e.preventDefault();const m=$("#aMsg");m.textContent="Enregistrement…";
    try{const j=await api("admin/settings","PUT",{allowedDomains:$("#aDom").value,allowedEmails:$("#aMail").value});adminData.settings=j.settings;m.textContent="Accès enregistrés.";$("#aDom").value=j.settings.allowedDomains.join(", ");$("#aMail").value=j.settings.allowedEmails.join("\n")}catch(err){m.textContent=err.error||"Erreur."}};
  let to;$("#aq").oninput=e=>{adminQ=e.target.value;clearTimeout(to);to=setTimeout(()=>{drawAdmin();const q=$("#aq");q.focus();q.setSelectionRange(q.value.length,q.value.length)},250)};
  app.querySelectorAll("[data-mem]").forEach(b=>b.onclick=()=>memberSheet(adminData.members.find(m=>m.id===b.dataset.mem)));
}
function memberSheet(m){const A=adminData;const canAdmin=A.superAdmin&&m.email&&!m.superAdmin;const s=m.stats||{};
  const sh=sheet(`<div style="display:flex;gap:12px;align-items:center">${avatar(m,48)}<div><h2 style="margin:0">${esc(m.pseudo)}</h2><div class="small">${esc(m.email||"sans compte Google")}${m.name?" · "+esc(m.name):""}</div></div></div>
   <div class="card" style="margin:14px 0"><div class="kpis"><div class="kpi"><b>${(s.points||0).toLocaleString("fr-FR")}</b><span>points</span></div><div class="kpi"><b>${s.answered?Math.round(s.correct/s.answered*100):0} %</b><span>réussite</span></div><div class="kpi"><b>${s.fichesOk||0}</b><span>fiches acquises</span></div></div></div>
   <form id="rnf" class="form" style="grid-template-columns:1fr auto;align-items:end;gap:8px"><div style="display:grid;gap:6px"><label for="rnP">Pseudo</label><input id="rnP" maxlength="24" value="${esc(m.pseudo)}"></div><button class="btn sec" type="submit">Renommer</button></form>
   <div class="actions" style="flex-direction:column">
    <button class="btn sec full" data-act="reset">Remettre ses scores à zéro</button>
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
app.addEventListener("click",e=>{if(e.target.closest("#hbTeams")){profTab="equipe";store.set("profTab",profTab);boardScope="teams";store.set("boardScope",boardScope);go("profile");return}if(e.target.closest("#hbGo")){profTab="equipe";store.set("profTab",profTab);go("profile")}});
setTimeout(()=>loadSimple().then(()=>{if(tab==="revise"&&!document.body.classList.contains("pushed"))viewRevise()}).catch(()=>{}),1500);
if(me&&me.id){const o=store.get("progOwner",null);if(o&&o!==me.id)applyProgress({resetAt:0});store.set("progOwner",me.id)}
go(tab);if(store.get("welcome",false)){store.del("welcome");setTimeout(()=>{profTab="moi";go("profile");profileSheet(true,true)},300)}loadCfg().then(()=>{if(tab==="profile"&&!document.body.classList.contains("pushed"))viewProfile()});if(store.get("pendingLogin",null))startPoll();if(me&&!me.expired)loadBoard(true).then(syncSoon);
if("serviceWorker" in navigator&&location.protocol.startsWith("http"))navigator.serviceWorker.register("sw.js").catch(()=>{});
