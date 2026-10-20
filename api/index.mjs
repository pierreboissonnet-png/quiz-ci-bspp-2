// API du Quiz CI BSPP — Vercel Functions + base Redis (Upstash, via le Marketplace Vercel).
// Variables d'environnement (Vercel › Project › Settings › Environment Variables) :
//   GOOGLE_CLIENT_ID  identifiant OAuth « Application Web » (Google Cloud) — active la connexion Google
//   SESSION_SECRET    clé secrète (longue chaîne aléatoire) qui signe le cookie d'accès aux contenus
//   SUPER_ADMIN       e-mail du super administrateur (par défaut pierre.boissonnet@croix-rouge.fr)
//   TEAM_CODE         (facultatif) code d'équipe, utilisé seulement si la connexion Google n'est pas configurée
//   KV_REST_API_URL / KV_REST_API_TOKEN (ou UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN) : ajoutés
//   automatiquement quand on connecte une base « Upstash for Redis » au projet.
import { createHash, createHmac, randomBytes, timingSafeEqual, generateKeyPairSync, createECDH, createPrivateKey, createCipheriv, hkdfSync, sign as cSign } from "node:crypto";

// ---- stockage clé/valeur (Redis via l'API REST d'Upstash, sans dépendance)
const R_URL = (process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || "").trim().replace(/\/$/, "");
const R_TOK = (process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || "").trim();
const NS = "qci:";
async function redis(cmd) {
  if (!R_URL || !R_TOK) throw new Error("no-db");
  const r = await fetch(R_URL, { method: "POST", headers: { authorization: "Bearer " + R_TOK, "content-type": "application/json" }, body: JSON.stringify(cmd) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.error) throw new Error("db: " + (j.error || r.status));
  return j.result;
}
const parse = (v, type) => (v == null ? null : type === "json" ? (() => { try { return JSON.parse(v); } catch (e) { return null; } })() : v);
const store = () => ({
  get: async (k, o) => parse(await redis(["GET", NS + k]), o?.type),
  getMany: async (keys, o) => { const out = []; for (let i = 0; i < keys.length; i += 200) { const part = keys.slice(i, i + 200); if (part.length) out.push(...(await redis(["MGET", ...part.map((k) => NS + k)]))); } return out.map((v) => parse(v, o?.type)); },
  set: (k, v) => redis(["SET", NS + k, String(v)]),
  setJSON: (k, v, ttl) => redis(ttl ? ["SET", NS + k, JSON.stringify(v), "EX", String(ttl)] : ["SET", NS + k, JSON.stringify(v)]),
  delete: (k) => redis(["DEL", NS + k]),
  // journaux : une liste par jour, plafonnée et effacée au bout de 30 jours
  logPush: async (k, vals) => { await redis(["RPUSH", NS + k, ...vals]); await redis(["LTRIM", NS + k, "-20000", "-1"]); await redis(["EXPIRE", NS + k, String(30 * 86400)]); },
  logRange: (k, n) => redis(["LRANGE", NS + k, String(-n), "-1"]),
  list: async ({ prefix }) => { const keys = new Set(); let cur = "0", n = 0;
    do { const [c, ks] = await redis(["SCAN", cur, "MATCH", NS + prefix + "*", "COUNT", "1000"]); cur = String(c); ks.forEach((k) => keys.add(k.slice(NS.length))); } while (cur !== "0" && ++n < 50);
    return { blobs: [...keys].sort().map((key) => ({ key })) }; },
});

const SUPER = (process.env.SUPER_ADMIN || "pierre.boissonnet@croix-rouge.fr").trim().toLowerCase();
const CLIENT_ID = (process.env.GOOGLE_CLIENT_ID || "").trim();
const COLORS = ["#e3051b", "#0a84ff", "#34c759", "#ff9f0a", "#5e5ce6", "#30b0c7", "#ff375f", "#8e8e93"];
// cookie d'accès aux contenus protégés (vérifié par middleware.js)
const SECRET = (process.env.SESSION_SECRET || "").trim();
const COOKIE_DAYS = 30;
function accessCookie(id) {
  if (!SECRET) return null;
  const exp = Math.floor(Date.now() / 1000) + COOKIE_DAYS * 86400;
  const sig = createHmac("sha256", SECRET).update(id + "." + exp).digest("hex");
  return `qs=${id}.${exp}.${sig}; Path=/; Max-Age=${COOKIE_DAYS * 86400}; HttpOnly; Secure; SameSite=Lax`;
}
const withCookie = (res, id) => { const c = id === null ? "qs=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax" : accessCookie(id); if (c) res.headers.append("set-cookie", c); return res; };
const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });
const html = (body, status = 200) => new Response(`<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Quiz CI BSPP</title><style>body{font:17px -apple-system,Segoe UI,Roboto,sans-serif;background:#f2f2f7;color:#111;display:grid;place-items:center;min-height:90vh;margin:0;padding:20px;text-align:center}.c{background:#fff;border-radius:18px;padding:26px;max-width:360px}a{display:inline-block;margin-top:14px;background:#e3051b;color:#fff;border-radius:12px;padding:12px 20px;text-decoration:none;font-weight:600}</style></head><body><div class="c">${body}</div></body></html>`, { status, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
const sha = (s) => createHash("sha256").update(String(s)).digest("hex");
const clean = (s, n) => String(s ?? "").replace(/[\u0000-\u001f<>]/g, "").trim().slice(0, n);
const num = (v, max) => { const x = Number(v); return Number.isFinite(x) ? Math.max(0, Math.min(max, Math.round(x))) : 0; };
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

function sanitizeStats(s = {}) {
  const out = { points: num(s.points, 1e7), total: num(s.total, 1e8), week: /^\d{4}-S\d{2}$/.test(s.week || "") ? s.week : null, answered: num(s.answered, 1e6), correct: num(s.correct, 1e6), fichesOk: num(s.fichesOk, 500), fichesTotal: num(s.fichesTotal, 500), seen: num(s.seen, 5000), streak: num(s.streak, 5000), bestExam: num(s.bestExam, 100), bestQcm: num(s.bestQcm, 100), bestChrono: num(s.bestChrono, 500), themes: {}, defi: null };
  out.rank = num(s.rank, 16); out.dw = num(s.dw, 1e4); out.dl = num(s.dl, 1e4); out.sudden = num(s.sudden, 1e4);
  if (out.correct > out.answered) out.correct = out.answered;
  if (s.themes && typeof s.themes === "object") for (const [k, v] of Object.entries(s.themes).slice(0, 12)) out.themes[clean(k, 12)] = num(v, 100);
  // historique pour les graphiques : 12 dernières semaines et 12 derniers mois
  out.hw = {}; if (s.hw && typeof s.hw === "object") for (const [k, v] of Object.entries(s.hw).slice(-16)) if (/^\d{4}-S\d{2}$/.test(k)) out.hw[k] = num(v, 1e7);
  out.hm = {}; if (s.hm && typeof s.hm === "object") for (const [k, v] of Object.entries(s.hm).slice(-16)) if (/^\d{4}-\d{2}$/.test(k)) out.hm[k] = num(v, 1e7);
  if (s.defi && /^\d{4}-S\d{2}$/.test(s.defi.week || "")) out.defi = { week: s.defi.week, score: num(s.defi.score, 20), ms: num(s.defi.ms, 36e5) };
  return out;
}
const emptyStats = () => sanitizeStats({});
// ---- Duels entre membres (asynchrones) ----
const DUEL_TTL = 48 * 3600e3, DECO_TTL = 24 * 3600e3, NICK_PICK = 3600e3, DRAFT_TTL = 2 * 3600e3;
async function duelIds(st, uid) { return (await st.get("dl/" + uid, { type: "json" })) || []; }
async function duelLink(st, uid, id) { const l = (await duelIds(st, uid)).filter((x) => x !== id); l.unshift(id); await st.setJSON("dl/" + uid, l.slice(0, 80)); }
async function setDeco(st, uid, deco) { const p = await st.get("p/" + uid, { type: "json" }); if (!p) return; p.deco = { ...deco, u: Date.now() + DECO_TTL }; await st.setJSON("p/" + uid, p); }
// clôture : résultat, décorations (24 h) ; à appeler quand le duel change d'état
async function duelSettle(st, d) {
  const now = Date.now();
  if (d.status === "draft" && now > d.created + DRAFT_TTL) { d.status = "abandoned"; await st.setJSON("duel/" + d.id, d); return d; }
  if (d.status === "pending" && now > d.exp) {
    d.status = "expired"; d.done = now; await st.setJSON("duel/" + d.id, d);
    await setDeco(st, d.to, { t: "run", vs: d.fromN, th: d.themeN, why: "expired" });
    return d;
  }
  if (d.status === "pending" && d.res[d.from] && d.res[d.to]) {
    const a = d.res[d.from], b = d.res[d.to];
    d.status = "done"; d.done = now;
    d.winner = a.pts > b.pts ? d.from : b.pts > a.pts ? d.to : null;
    await st.setJSON("duel/" + d.id, d);
    if (d.winner) {
      const loser = d.winner === d.from ? d.to : d.from, wN = d.winner === d.from ? d.fromN : d.toN, lN = d.winner === d.from ? d.toN : d.fromN;
      const sc = `${d.res[d.winner].pts} à ${d.res[loser].pts}`;
      await setDeco(st, d.winner, { t: "medal", vs: lN, th: d.themeN, sc });
      await setDeco(st, loser, { t: "broom", vs: wN, th: d.themeN, sc });
    }
  }
  return d;
}
const NICK_BAN = /(conn?a?r|con\b|pute|putain|salop|encul|p[ée]d[ée]|pd\b|n[eè]gr|bougnoul|youp|tarlouz|tapette|gouine|bite|couill|chatte|nique|ntm|batard|bâtard|merde|abruti|d[ée]bile|mongol|triso|attard|handicap|clochard|nazi|hitler)/i;
const duelPub = (d, uid) => ({ id: d.id, from: d.from, to: d.to, fromN: d.fromN, toN: d.toN, theme: d.theme, themeN: d.themeN, level: d.level, created: d.created, exp: d.exp, status: d.status, done: d.done || null, winner: d.winner || null, qids: d.qids, nick: d.nick || null, zg: d.zg || null, mine: d.res[uid] || null, other: (d.status === "done" || d.status === "expired" || d.status === "declined") ? (d.res[d.from === uid ? d.to : d.from] || null) : (d.res[d.from === uid ? d.to : d.from] ? { played: true } : null) });
const fxOf = (p) => (["off", "sgt", "fire"].includes(p.fxm) ? p.fxm : p.onFire ? "fire" : "off"); // mode d'ambiance : normal / sergent / On Fire
const setFx = (p, m) => { p.fxm = m; p.onFire = m === "fire"; };

// ---- 3.4.0 : notifications push (Web Push, sans dépendance). Uniquement « untel t'a défié ».
const b64u = (b) => Buffer.from(b).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const ub64 = (s) => Buffer.from(String(s).replace(/-/g, "+").replace(/_/g, "/"), "base64");
async function vapid(st) {
  let v = await st.get("cfg/vapid", { type: "json" });
  if (!v) { const { privateKey } = generateKeyPairSync("ec", { namedCurve: "prime256v1" }); const jwk = privateKey.export({ format: "jwk" }); v = { jwk, pub: b64u(Buffer.concat([Buffer.from([4]), ub64(jwk.x), ub64(jwk.y)])) }; await st.setJSON("cfg/vapid", v); }
  return v;
}
function vapidAuth(v, endpoint) {
  const aud = new URL(endpoint).origin; const head = b64u(JSON.stringify({ typ: "JWT", alg: "ES256" }));
  const body = b64u(JSON.stringify({ aud, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: "mailto:" + SUPER }));
  const sig = cSign("sha256", Buffer.from(head + "." + body), { key: createPrivateKey({ key: v.jwk, format: "jwk" }), dsaEncoding: "ieee-p1363" });
  return `vapid t=${head}.${body}.${b64u(sig)}, k=${v.pub}`;
}
function pushEncrypt(sub, text) {
  const uaPub = ub64(sub.keys.p256dh), auth = ub64(sub.keys.auth);
  const ecdh = createECDH("prime256v1"); ecdh.generateKeys(); const asPub = ecdh.getPublicKey(); const shared = ecdh.computeSecret(uaPub);
  const ikm = Buffer.from(hkdfSync("sha256", shared, auth, Buffer.concat([Buffer.from("WebPush: info\0"), uaPub, asPub]), 32));
  const salt = randomBytes(16);
  const cek = Buffer.from(hkdfSync("sha256", ikm, salt, Buffer.from("Content-Encoding: aes128gcm\0"), 16));
  const nonce = Buffer.from(hkdfSync("sha256", ikm, salt, Buffer.from("Content-Encoding: nonce\0"), 12));
  const c = createCipheriv("aes-128-gcm", cek, nonce); const enc = Buffer.concat([c.update(Buffer.concat([Buffer.from(text), Buffer.from([2])])), c.final(), c.getAuthTag()]);
  const rs = Buffer.alloc(4); rs.writeUInt32BE(4096);
  return Buffer.concat([salt, rs, Buffer.from([asPub.length]), asPub, enc]);
}
async function pushTo(st, uid, msg) {
  try {
    const p = await st.get("p/" + uid, { type: "json" }); if (!p || !Array.isArray(p.push) || !p.push.length) return;
    const v = await vapid(st); const keep = [];
    for (const s of p.push) {
      try {
        const r = await fetch(s.endpoint, { method: "POST", headers: { TTL: "3600", Urgency: "high", "Content-Encoding": "aes128gcm", "Content-Type": "application/octet-stream", Authorization: vapidAuth(v, s.endpoint) }, body: pushEncrypt(s, JSON.stringify(msg)) });
        if (r.status !== 404 && r.status !== 410) keep.push(s);
      } catch (e) { keep.push(s); }
    }
    if (keep.length !== p.push.length) { p.push = keep; await st.setJSON("p/" + uid, p); }
  } catch (e) {}
}
// 5.0.0 : évaluations (synthèse de vacation CIR BSPP)
const EV_COMPS = ["base", "orga", "garde", "depart", "renforts", "admin", "cat", "radio"];
const nameFromEmail = (p) => { const m = /^([a-z0-9-]+)\.([a-z0-9.-]+)@/i.exec(p.email || ""); if (!m) return p.name || p.pseudo || ""; const cap = (s) => s.split(/([-.])/).map((w) => (w === "-" || w === "." ? (w === "." ? " " : w) : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())).join(""); return cap(m[1]) + " " + cap(m[2]).toUpperCase(); };
async function evList(st, key) { return (await st.get(key, { type: "json" })) || []; }
async function evLink(st, key, id, add) { let l = (await evList(st, key)).filter((x) => x !== id); if (add) l.unshift(id); await st.setJSON(key, l.slice(0, 200)); }
const evRole = (ev, me, cfg) => (ev.cand === me.id ? "cand" : ev.enc && ev.enc.uid === me.id ? "enc" : isAdmin(me, cfg) ? "admin" : null);
const evSum = (ev) => ({ id: ev.id, cand: ev.cand, candN: ev.candN, num: ev.num, date: ev.date, enc: ev.enc, status: ev.status, encDone: !!ev.encDone, updated: ev.updated, comps: Object.fromEntries(EV_COMPS.map((k) => [k, (ev.comps && ev.comps[k] && ev.comps[k].lvl) || 0])), autoEnc: ev.autoEnc && ev.autoEnc.v || "", autoCi: ev.autoCi && ev.autoCi.v || "", n: (ev.inter || []).length, cnt: (ev.inter || []).reduce((c, x) => { if (c[x.t] != null) c[x.t]++; return c; }, { UA: 0, UR: 0, DCD: 0, SS: 0 }) });
function evClean(ev, patch, role) {
  const s = (v, n) => clean(v, n), lvl = (v) => Math.max(0, Math.min(4, Math.round(Number(v) || 0)));
  const encPart = role === "enc" || (role === "cand" && !(ev.enc && ev.enc.uid));
  if (role === "cand") {
    if ("date" in patch) ev.date = s(patch.date, 10); if ("horaires" in patch) ev.horaires = s(patch.horaires, 40);
    if ("equip" in patch) ev.equip = ["ul", "ext", "mixte"].includes(patch.equip) ? patch.equip : "";
    if ("autoCi" in patch && patch.autoCi) ev.autoCi = { v: ["oui", "non"].includes(patch.autoCi.v) ? patch.autoCi.v : "", c: s(patch.autoCi.c, 1500) };
  }
  if (encPart && Array.isArray(patch.inter)) ev.inter = patch.inter.slice(0, 20).map((x) => ({ t: ["UA", "UR", "DCD", "SS"].includes(x.t) ? x.t : "", motif: s(x.motif, 120), pos: s(x.pos, 1200), axes: s(x.axes, 1200) }));
  if (encPart) {
    if (patch.comps && typeof patch.comps === "object") { ev.comps = ev.comps || {}; for (const k of EV_COMPS) if (patch.comps[k]) ev.comps[k] = { lvl: lvl(patch.comps[k].lvl), obs: s(patch.comps[k].obs, 1500) }; }
    if ("autoEnc" in patch && patch.autoEnc) ev.autoEnc = { v: ["oui", "non"].includes(patch.autoEnc.v) ? patch.autoEnc.v : "", c: s(patch.autoEnc.c, 1500) };
    if ("reserve" in patch) ev.reserve = !!patch.reserve;
    if (role === "enc" && "encDone" in patch) ev.encDone = !!patch.encDone;
  }
  return ev;
}
// 3.3.4 : vote d'exclusion d'un membre (seuls les autres membres déclenchent et votent ; majorité absolue ; 48 h)
const VOTE_TTL = 48 * 3600e3;
function voteState(tm, profiles, uid) {
  const v = (tm.votes || {})[uid]; if (!v) return null;
  const mem = profiles.filter((p) => p.team === tm.id && !p.blocked).map((p) => p.id);
  const el = mem.filter((id) => id !== uid); const need = Math.floor(el.length / 2) + 1;
  const yes = (v.yes || []).filter((id) => el.includes(id)).length, no = (v.no || []).filter((id) => el.includes(id)).length;
  return { v, el, need, yes, no, inTeam: mem.includes(uid), done: yes >= need ? "out" : no > el.length - need ? "kept" : Date.now() > v.exp ? "expired" : null };
}
async function dropRequest(st, p) { if (!p.askTeam) return; const o = await st.get("t/" + p.askTeam, { type: "json" }); if (o && o.pending) { o.pending = o.pending.filter((q) => q.id !== p.id); await st.setJSON("t/" + o.id, o); } p.askTeam = null; }
const zOf = (p) => (p.zm && p.zm.u > Date.now() ? { u: p.zm.u, by: clean(p.zm.by, 24), at: p.zm.at || 0 } : null); // mode Z, jamais dans pub()
const zmoOf = (p) => { const o = {}; for (const [k, v] of Object.entries(p.zmo || {})) if (v && v.u > Date.now()) o[k] = { u: v.u, by: clean(v.by, 24), at: v.at || 0 }; return Object.keys(o).length ? o : null; };
const xOf = (p) => (p.xm && p.xm.u > Date.now() ? { u: p.xm.u, by: clean(p.xm.by, 24), at: p.xm.at || 0 } : null); // mode X
const pub = (p) => ({ id: p.id, pseudo: p.pseudo, unite: p.unite, color: p.color, team: p.team || null, stats: p.stats, updatedAt: p.updatedAt, fire: fxOf(p) === "fire", fx: fxOf(p), deco: p.deco && p.deco.u > Date.now() ? p.deco : null, nick: p.nick && p.nick.u > Date.now() ? p.nick : null, sdf: p.sdf && p.sdf > Date.now() ? p.sdf : null });
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
    const dc = {}; for (const src of [a.dcr, b.dcr]) if (src && typeof src === "object") for (const [k, v] of Object.entries(src)) if (/^[a-f0-9]{6,20}$/.test(k)) dc[k] = Math.max(dc[k] || 0, [1, 10, 15, 30].includes(v) ? v : 1);
    const ks = Object.keys(dc).slice(-300); if (ks.length) { out.dcr = {}; for (const k of ks) out.dcr[k] = dc[k]; }
  }
  if (rd) out.radio = { num: String(rd.num || "").slice(0, 6), cs: String(rd.cs || "").slice(0, 40), golf: String(rd.golf || "").slice(0, 3), t: Number(rd.t) || 0 };
  return out;
}

async function allTeams(st) {
  const { blobs } = await st.list({ prefix: "t/" });
  return (await st.getMany(blobs.slice(0, 500).map((b) => b.key), { type: "json" })).filter(Boolean);
}

async function settings(st) { return (await st.get("cfg/settings", { type: "json" })) || { allowedDomains: [], allowedEmails: [], admins: [] }; }
const isAdmin = (p, cfg) => !!p?.email && (p.email === SUPER || (cfg.admins || []).includes(p.email));
function allowed(email, cfg) {
  if (email === SUPER || (cfg.admins || []).includes(email)) return true;
  const d = (cfg.allowedDomains || []).filter(Boolean), e = (cfg.allowedEmails || []).filter(Boolean);
  if (!d.length && !e.length) return true;
  return e.includes(email) || d.includes(email.split("@")[1]);
}
async function allProfiles(st) {
  const { blobs } = await st.list({ prefix: "p/" });
  return (await st.getMany(blobs.slice(0, 1000).map((b) => b.key), { type: "json" })).filter(Boolean);
}
async function uniquePseudo(st, wanted, selfId) {
  const all = await allProfiles(st); const base = clean(wanted, 22) || "Membre"; let p = base, i = 2;
  while (all.some((x) => x.id !== selfId && x.pseudo.toLowerCase() === p.toLowerCase())) p = `${base} ${i++}`;
  return p;
}
function teamOk(code) {
  const want = process.env.TEAM_CODE; if (!want) return true;
  const a = Buffer.from(String(code || "").trim().toUpperCase()), b = Buffer.from(want.trim().toUpperCase());
  return a.length === b.length && timingSafeEqual(a, b);
}
// authentification : en-têtes x-id / x-token, ou corps {id, token}
async function auth(st, req, body) {
  const url = new URL(req.url);
  let id = req.headers.get("x-id") || body?.id || url.searchParams.get("uid") || "";
  let token = req.headers.get("x-token") || body?.token || url.searchParams.get("tk") || "";
  const ah = req.headers.get("authorization") || "";
  if ((!id || !token) && ah.startsWith("Bearer ")) { const [a, b] = ah.slice(7).split(":"); id = id || a; token = token || b; }
  id = clean(id, 40);
  if (!id || !token) return { err: "no-cred" };
  const h = sha(token);
  // les sessions sont stockées à part (s/<hash>) pour qu'aucune écriture du profil ne puisse les effacer
  const s = await st.get("s/" + h, { type: "json" });
  const p = await st.get("p/" + id, { type: "json" });
  if (!p) return { err: "no-profile" };
  if (p.blocked) return { err: "blocked" };
  if (s && s.id === id) return { p };
  if ((p.sessions || []).includes(h)) return { p }; // anciennes sessions
  return { err: s ? "session-other-profile" : "no-session" };
}
async function newSession(st, p) { const token = randomBytes(24).toString("hex"); await st.setJSON("s/" + sha(token), { id: p.id, at: Date.now() }); return token; }

async function verifyGoogle(idToken) {
  const r = await fetch("https://oauth2.googleapis.com/tokeninfo?id_token=" + encodeURIComponent(idToken));
  if (!r.ok) return null;
  const t = await r.json();
  if (t.aud !== CLIENT_ID) return null;
  if (!["accounts.google.com", "https://accounts.google.com"].includes(t.iss)) return null;
  if (String(t.email_verified) !== "true") return null;
  if (Number(t.exp) * 1000 < Date.now()) return null;
  return t;
}

// 3.4.0 : notification « nouvelle version disponible » envoyée une seule fois par version (verrou Redis SET NX)
const APP_VERSION = "5.0.1"; let announced = false;
async function announceVersion(st) {
  try {
    const r = await redis(["SET", NS + "ver/announced/" + APP_VERSION, "1", "NX"]); if (r !== "OK") return;
    for (const p of await allProfiles(st)) if (Array.isArray(p.push) && p.push.length && !p.blocked) await pushTo(st, p.id, { title: "Quiz CI BSPP", body: `La version ${APP_VERSION} est disponible : ouvre l'appli pour en profiter.`, tag: "update" });
  } catch (e) {}
}
async function handler(req) {
  const url = new URL(req.url);
  // vercel.json réécrit /api/<route> vers /api?route=<route>
  const route = (url.searchParams.get("route") ?? url.pathname.replace(/^\/api\/?/, "")).replace(/^\/+|\/+$/g, "");
  const st = store();
  if (!announced) { announced = true; const job = announceVersion(st); try { const { waitUntil } = await import("@vercel/functions"); waitUntil(job); } catch (e) {} }
  try {
    // ---- configuration publique
    if (route === "config") return json({ google: !!CLIENT_ID, clientId: CLIENT_ID || null, teamCode: !CLIENT_ID && !!process.env.TEAM_CODE });

    // ---- retour de Google (response_mode=form_post)
    if (route === "auth/google" && req.method === "POST") {
      if (!CLIENT_ID) return html("<p>La connexion Google n'est pas configurée.</p>", 400);
      const form = await req.formData();
      const idToken = form.get("id_token"), state = String(form.get("state") || "");
      if (form.get("error")) return html(`<p>Connexion annulée.</p><a href="/">Revenir à l'appli</a>`);
      if (!idToken || !/^[a-f0-9]{32}$/.test(state)) return html("<p>Requête de connexion invalide.</p>", 400);
      const t = await verifyGoogle(idToken);
      if (!t || t.nonce !== state) return html("<p>Impossible de vérifier ton compte Google. Réessaie.</p>", 401);
      const email = String(t.email).toLowerCase(), cfg = await settings(st);
      if (!allowed(email, cfg)) return html(`<p><b>${esc(email)}</b> n'est pas autorisé à rejoindre l'équipe.</p><p>Demande à l'administrateur de t'ajouter, puis réessaie.</p><a href="/">Revenir à l'appli</a>`, 403);
      const pid = await st.get("g/" + t.sub);
      let p = pid ? await st.get("p/" + pid, { type: "json" }) : null;
      if (p?.blocked) return html("<p>Ce compte a été désactivé par l'administrateur.</p>", 403);
      const isNew = !p;
      if (!p) {
        const id = randomBytes(8).toString("hex");
        p = { id, sub: t.sub, email, name: clean(t.name, 60), pseudo: await uniquePseudo(st, (t.given_name || t.name || "Membre") + (t.family_name ? " " + t.family_name[0] + "." : ""), id), unite: "", color: COLORS[Math.floor(Math.random() * COLORS.length)], stats: emptyStats(), createdAt: Date.now(), updatedAt: Date.now(), sessions: [] };
        await st.set("g/" + t.sub, id);
      }
      p.email = email; p.name = clean(t.name, 60); p.lastLogin = Date.now();
      await st.setJSON("p/" + p.id, p);
      const token = await newSession(st, p);
      await st.setJSON("auth/" + state, { id: p.id, token, isNew, at: Date.now() }, 900);
      return html(`<p style="font-size:40px;margin:0">✓</p><p><b>Connecté : ${esc(email)}</b></p><p>Reviens à l'appli Quiz CI : la connexion se termine toute seule.</p><a href="/#login">Revenir à l'appli</a><script>setTimeout(()=>{location.href="/#login"},1500)</script>`);
    }

    // ---- l'appli récupère la session ouverte (fonctionne aussi depuis l'appli installée sur iPhone)
    if (route === "auth/poll" && req.method === "GET") {
      const code = url.searchParams.get("code") || "";
      if (!/^[a-f0-9]{32}$/.test(code)) return json({ error: "Code invalide." }, 400);
      const a = await st.get("auth/" + code, { type: "json" });
      if (!a) return json({ pending: true });
      await st.delete("auth/" + code);
      if (Date.now() - a.at > 15 * 60e3) return json({ error: "Connexion expirée, recommence." }, 410);
      const p = await st.get("p/" + a.id, { type: "json" }), cfg = await settings(st);
      return withCookie(json({ id: a.id, token: a.token, isNew: a.isNew, profile: pub(p), email: p.email, admin: isAdmin(p, cfg), superAdmin: p.email === SUPER }), a.id);
    }

    let body = null;
    if (req.method !== "GET") { try { body = await req.json(); } catch { return json({ error: "Requête invalide." }, 400); } }

    // ---- création sans Google (mode code d'équipe, si GOOGLE_CLIENT_ID absent)
    if (route === "profile" && req.method === "POST") {
      if (CLIENT_ID) return json({ error: "Utilise la connexion Google." }, 400);
      if (!process.env.TEAM_CODE) return json({ error: "La connexion n'est pas configurée sur ce site." }, 503);
      if (!teamOk(body.team)) return json({ error: "Code d'équipe incorrect." }, 403);
      const pseudo = clean(body.pseudo, 24);
      if (pseudo.length < 2) return json({ error: "Choisis un pseudo d'au moins 2 caractères." }, 400);
      const all = await allProfiles(st);
      if (all.some((p) => p.pseudo.toLowerCase() === pseudo.toLowerCase())) return json({ error: "Ce pseudo est déjà pris." }, 409);
      const id = randomBytes(8).toString("hex");
      const p = { id, pseudo, unite: clean(body.unite, 40), color: COLORS.includes(body.color) ? body.color : COLORS[0], stats: sanitizeStats(body.stats), createdAt: Date.now(), updatedAt: Date.now(), sessions: [] };
      await st.setJSON("p/" + id, p); const token = await newSession(st, p);
      return withCookie(json({ id, token, profile: pub(p) }), id);
    }

    const au = await auth(st, req, body);
    if (!au.p) return withCookie(json({ error: au.err === "blocked" ? "Compte désactivé par l'administrateur." : "Session expirée : reconnecte-toi.", code: au.err }, 401), null);
    const me = au.p;
    const cfg = await settings(st);

    if (route === "me") return withCookie(json({ profile: pub(me), email: me.email || null, admin: isAdmin(me, cfg), superAdmin: me.email === SUPER, resetAt: me.resetAt || null, zz: zOf(me), xx: xOf(me), zmo: zmoOf(me), kk: me.kicked || null }), me.id);

    // ---- duels
    if (route === "duel/list" && req.method === "GET") {
      const ids = await duelIds(st, me.id); const list = [];
      for (const d of (await st.getMany(ids.map((i) => "duel/" + i), { type: "json" })).filter(Boolean)) {
        const s2 = await duelSettle(st, d);
        if (s2.status === "abandoned" || (s2.status === "draft" && s2.from !== me.id)) continue;
        list.push(duelPub(s2, me.id));
      }
      return json({ duels: list, now: Date.now() });
    }
    if (route === "duel/new" && req.method === "POST") {
      const to = clean(body.to, 40); if (!to || to === me.id) return json({ error: "Choisis un adversaire." }, 400);
      const op = await st.get("p/" + to, { type: "json" }); if (!op || op.blocked) return json({ error: "Adversaire introuvable." }, 404);
      // 5.0.0 : plus de limite de défis en cours ni d'attente avec le même adversaire
      const cands = (Array.isArray(body.cands) ? body.cands : []).map((x) => clean(x, 60)).filter(Boolean).slice(0, 120);
      if (cands.length < 10) return json({ error: "Pas assez de questions pour ce thème." }, 400);
      const prog = (await st.get("u/" + to, { type: "json" })) || {}; const seen = prog.hist || {};
      const qids = [...cands.filter((q) => !seen[q]), ...cands.filter((q) => seen[q])].slice(0, 10);
      const d = { id: randomBytes(6).toString("hex"), from: me.id, to, fromN: me.pseudo, toN: op.pseudo, theme: clean(body.theme, 20), themeN: clean(body.themeN, 40), level: body.level === "simple" ? "simple" : "expert", qids, created: Date.now(), exp: Date.now() + DUEL_TTL, status: "draft", res: {} };
      await st.setJSON("duel/" + d.id, d); await duelLink(st, me.id, d.id); await duelLink(st, to, d.id);
      return json({ duel: duelPub(d, me.id) });
    }
    if (route === "duel/gage" && req.method === "POST") { // 3.4.0 : le gagnant inflige un gage (mode Z) d'une heure au perdant
      const d = await st.get("duel/" + clean(body.did, 20), { type: "json" }); if (!d || d.winner !== me.id || d.status !== "done") return json({ error: "Seul le gagnant peut choisir un gage." }, 403);
      if (d.zg) return json({ error: "Un gage a déjà été choisi pour ce duel." }, 409);
      if (d.nick && !((d.res[me.id] || {}).ok >= 10)) return json({ error: "Tu as déjà choisi un surnom : sans un sans-faute, c'est surnom OU gage." }, 409);
      if (Date.now() > (d.done || 0) + NICK_PICK) return json({ error: "Trop tard : le gage se choisit dans l'heure qui suit la victoire." }, 409);
      const m = clean(body.mode, 20); if (!["piege", "blague", "miroir", "escargot", "radio", "fuite"].includes(m)) return json({ error: "Gage inconnu." }, 400);
      const loser = d.from === me.id ? d.to : d.from; const l = await st.get("p/" + loser, { type: "json" }); if (!l) return json({ error: "Perdant introuvable." }, 404);
      const g = { u: Date.now() + 3600e3, by: me.pseudo, at: Date.now() };
      if (m === "piege") l.zm = g; else if (m === "blague") l.xm = g; else { l.zmo = l.zmo || {}; l.zmo[m] = g; }
      await st.setJSON("p/" + loser, l); d.zg = m; await st.setJSON("duel/" + d.id, d); return json({ ok: true, duel: duelPub(d, me.id) });
    }
    if (route === "duel/play" && req.method === "POST") {
      const d = await st.get("duel/" + clean(body.did, 20), { type: "json" }); if (!d || (d.from !== me.id && d.to !== me.id)) return json({ error: "Duel introuvable." }, 404);
      if (d.res[me.id]) return json({ error: "Tu as déjà joué ce duel." }, 409);
      if (d.from === me.id ? d.status !== "draft" : d.status !== "pending") return json({ error: "Ce duel n'est plus jouable." }, 409);
      const n = (v, m) => Math.max(0, Math.min(m, Math.round(Number(v) || 0)));
      d.res[me.id] = { pts: n(body.pts, 1000), ok: n(body.ok, 10), ms: n(body.ms, 36e5), at: Date.now() };
      if (d.from === me.id) { d.status = "pending"; d.exp = Date.now() + DUEL_TTL; await pushTo(st, d.to, { title: "⚔ Nouveau duel", body: `${d.fromN} t'a défié en duel${d.themeN ? " (" + d.themeN + ")" : ""}.`, tag: "duel-" + d.id }); }
      await st.setJSON("duel/" + d.id, d);
      return json({ duel: duelPub(await duelSettle(st, d), me.id) });
    }
    if (route === "duel/nick" && req.method === "POST") {
      const d = await st.get("duel/" + clean(body.did, 20), { type: "json" }); if (!d || d.status !== "done" || d.winner !== me.id) return json({ error: "Seul le gagnant peut choisir un surnom." }, 403);
      if (d.nick) return json({ error: "Le surnom a déjà été choisi." }, 409);
      if (d.zg && !((d.res[me.id] || {}).ok >= 10)) return json({ error: "Tu as déjà choisi un gage : sans un sans-faute, c'est surnom OU gage." }, 409);
      if (Date.now() > (d.done || 0) + NICK_PICK) return json({ error: "Trop tard : le surnom se choisit dans l'heure qui suit la victoire." }, 409);
      const nick = clean(body.nick, 28).replace(/\s+/g, " ");
      if (nick.length < 3) return json({ error: "Surnom trop court." }, 400);
      if (NICK_BAN.test(nick)) return json({ error: "Surnom refusé : reste dans l'esprit pompier, sans grossièreté." }, 400);
      const loser = d.winner === d.from ? d.to : d.from; d.nick = nick; await st.setJSON("duel/" + d.id, d);
      const lp = await st.get("p/" + loser, { type: "json" }); if (lp) { lp.nick = { n: nick, by: me.pseudo, u: Date.now() + DECO_TTL }; await st.setJSON("p/" + loser, lp); }
      return json({ ok: true, nick });
    }
    if (route === "duel/decline" && req.method === "POST") {
      const d = await st.get("duel/" + clean(body.did, 20), { type: "json" }); if (!d || d.to !== me.id || d.status !== "pending") return json({ error: "Duel introuvable." }, 404);
      d.status = "declined"; d.done = Date.now(); await st.setJSON("duel/" + d.id, d);
      await setDeco(st, me.id, { t: "run", vs: d.fromN, th: d.themeN, why: "declined" });
      return json({ duel: duelPub(d, me.id) });
    }

    if (route === "board" && req.method === "GET") {
      const [profiles, teams] = await Promise.all([allProfiles(st), allTeams(st)]);
      const ids = new Set(teams.map((x) => x.id));
      return json({ profiles: profiles.filter((p) => !p.blocked).map((p) => ({ ...pub(p), team: ids.has(p.team) ? p.team : null })), teams: teams.map((x) => ({ id: x.id, name: x.name, ownerId: x.ownerId, createdAt: x.createdAt, max: x.max || null, pendingN: (x.pending || []).length, pending: me.team === x.id ? (x.pending || []) : undefined, votes: me.team === x.id ? Object.keys(x.votes || {}).filter((uid) => uid !== me.id).map((uid) => { const s = voteState(x, profiles, uid); if (!s || s.done || !s.inTeam) return null; return { uid, byN: s.v.byN, at: s.v.at, exp: s.v.exp, yes: s.yes, no: s.no, need: s.need, el: s.el.length, mine: (s.v.yes || []).includes(me.id) ? "yes" : (s.v.no || []).includes(me.id) ? "no" : null }; }).filter(Boolean) : undefined })), now: Date.now() });
    }

    // ---- progression complète (réponses, records, marqueurs…) : sauvegardée par utilisateur et fusionnée entre appareils
    if (route === "progress" && req.method === "GET") return json({ progress: (await st.get("u/" + me.id, { type: "json" })) || { v: 1, resetAt: 0 } });
    if (route === "progress" && req.method === "PUT") {
      const raw = JSON.stringify(body.progress || {});
      if (raw.length > 400000) return json({ error: "Progression trop volumineuse." }, 413);
      const merged = mergeProgress((await st.get("u/" + me.id, { type: "json" })) || { v: 1, resetAt: 0 }, body.progress || {});
      await st.setJSON("u/" + me.id, merged);
      return json({ progress: merged });
    }

    // ---- équipes : une seule équipe à la fois par membre
    if (route === "teams" && req.method === "GET") {
      const [profiles, teams] = await Promise.all([allProfiles(st), allTeams(st)]);
      const byId = Object.fromEntries(profiles.map((p) => [p.id, p]));
      return json({ teams: teams.map((x) => ({ id: x.id, name: x.name, ownerId: x.ownerId, owner: byId[x.ownerId]?.pseudo || "—", members: profiles.filter((p) => p.team === x.id && !p.blocked).length, createdAt: x.createdAt, max: x.max || null, asked: (x.pending || []).some((q) => q.id === me.id) })).sort((a, b) => a.name.localeCompare(b.name)), myTeam: me.team || null });
    }
    if (route === "teams" && req.method === "POST") {
      const name = clean(body.name, 40);
      if (name.length < 3) return json({ error: "Le nom de l'équipe doit faire au moins 3 caractères." }, 400);
      const teams = await allTeams(st);
      if (teams.length >= 300) return json({ error: "Nombre maximal d'équipes atteint." }, 400);
      if (teams.some((x) => x.name.toLowerCase() === name.toLowerCase())) return json({ error: "Une équipe porte déjà ce nom." }, 409);
      const id = randomBytes(6).toString("hex");
      await st.setJSON("t/" + id, { id, name, ownerId: me.id, createdAt: Date.now() });
      await dropRequest(st, me); me.team = id; me.updatedAt = Date.now(); await st.setJSON("p/" + me.id, me);
      return json({ team: { id, name, ownerId: me.id } });
    }
    if (route === "teams/join" && req.method === "POST") {
      const tm = await st.get("t/" + clean(body.teamId, 20), { type: "json" });
      if (!tm) return json({ error: "Cette équipe n'existe plus." }, 404);
      if (me.team === tm.id) return json({ team: { id: tm.id, name: tm.name, ownerId: tm.ownerId } });
      const mem = (await allProfiles(st)).filter((p) => p.team === tm.id && !p.blocked);
      if (tm.max && mem.length >= tm.max) return json({ error: `L'équipe « ${tm.name} » est complète (${mem.length}/${tm.max}).` }, 409);
      if (!mem.length) { // équipe vide : on la rejoint directement
        me.team = tm.id; me.updatedAt = Date.now(); await st.setJSON("p/" + me.id, me);
        return json({ team: { id: tm.id, name: tm.name, ownerId: tm.ownerId } });
      }
      await dropRequest(st, me); // une seule demande à la fois
      tm.pending = (tm.pending || []).filter((q) => q.id !== me.id).concat([{ id: me.id, pseudo: me.pseudo, at: Date.now() }]).slice(-30);
      await st.setJSON("t/" + tm.id, tm); me.askTeam = tm.id; await st.setJSON("p/" + me.id, me);
      return json({ pending: true, team: { id: tm.id, name: tm.name } });
    }
    if (route === "teams/cancel" && req.method === "POST") { await dropRequest(st, me); await st.setJSON("p/" + me.id, me); return json({ ok: true }); }
    if (route === "teams/decide" && req.method === "POST") { // un membre de l'équipe (ou un admin) accepte ou refuse une demande
      const tm = await st.get("t/" + clean(body.teamId, 20), { type: "json" });
      if (!tm) return json({ error: "Cette équipe n'existe plus." }, 404);
      if (me.team !== tm.id && !isAdmin(me, cfg)) return json({ error: "Seuls les membres de l'équipe peuvent valider les demandes." }, 403);
      const uid = clean(body.uid, 40); const q = (tm.pending || []).find((x) => x.id === uid);
      tm.pending = (tm.pending || []).filter((x) => x.id !== uid);
      const t2 = await st.get("p/" + uid, { type: "json" });
      if (q && t2 && body.ok) {
        const n = (await allProfiles(st)).filter((p) => p.team === tm.id && !p.blocked).length;
        if (tm.max && n >= tm.max) { await st.setJSON("t/" + tm.id, { ...tm, pending: [q, ...tm.pending] }); return json({ error: `Équipe complète (${n}/${tm.max}) : augmente le maximum pour accepter.` }, 409); }
        t2.team = tm.id; t2.askTeam = null; t2.updatedAt = Date.now(); await st.setJSON("p/" + t2.id, t2);
      } else if (t2 && t2.askTeam === tm.id) { t2.askTeam = null; await st.setJSON("p/" + t2.id, t2); }
      await st.setJSON("t/" + tm.id, tm); return json({ ok: true });
    }
    // ---- 5.0.0 : évaluations
    if (route === "ev/list" && req.method === "GET") {
      const cand = clean(url.searchParams.get("cand"), 40);
      if (cand && cand !== me.id) { if (!isAdmin(me, cfg)) return json({ error: "Réservé aux administrateurs." }, 403); const ids = await evList(st, "evc/" + cand); const evs = (await st.getMany(ids.map((i) => "ev/" + i), { type: "json" })).filter(Boolean); return json({ mine: evs.map(evSum) }); }
      const [a, b] = await Promise.all([evList(st, "evc/" + me.id), evList(st, "eve/" + me.id)]);
      const [ea, eb] = await Promise.all([st.getMany(a.map((i) => "ev/" + i), { type: "json" }), st.getMany(b.map((i) => "ev/" + i), { type: "json" })]);
      return json({ mine: ea.filter(Boolean).map(evSum), asEnc: eb.filter(Boolean).filter((e) => e.enc && e.enc.uid === me.id).map(evSum), me: { name: nameFromEmail(me) } });
    }
    if (route === "ev/get" && req.method === "GET") {
      const ev = await st.get("ev/" + clean(url.searchParams.get("eid"), 20), { type: "json" }); if (!ev) return json({ error: "Fiche introuvable." }, 404);
      const role = evRole(ev, me, cfg); if (!role) return json({ error: "Accès réservé au candidat, à son encadrant et aux administrateurs." }, 403);
      return json({ ev, role });
    }
    if (route === "ev/new" && req.method === "POST") {
      const ids = await evList(st, "evc/" + me.id); const prev = (await st.getMany(ids.map((i) => "ev/" + i), { type: "json" })).filter(Boolean);
      const num = prev.reduce((m, e) => Math.max(m, e.num || 0), 0) + 1;
      const d = new Date(); const ev = { id: randomBytes(6).toString("hex"), cand: me.id, candN: nameFromEmail(me), num, date: d.toISOString().slice(0, 10), horaires: "", enc: null, equip: "", inter: [], comps: {}, autoEnc: { v: "", c: "" }, autoCi: { v: "", c: "" }, reserve: false, status: "draft", encDone: false, created: Date.now(), updated: Date.now() };
      await st.setJSON("ev/" + ev.id, ev); await evLink(st, "evc/" + me.id, ev.id, true); return json({ ev, role: "cand" });
    }
    if (route === "ev/save" && req.method === "POST") {
      const ev = await st.get("ev/" + clean(body.eid, 20), { type: "json" }); if (!ev) return json({ error: "Fiche introuvable." }, 404);
      const role = evRole(ev, me, cfg); if (role !== "cand" && role !== "enc") return json({ error: "Seuls le candidat et son encadrant peuvent modifier la fiche." }, 403);
      const patch = body.patch || {};
      if (role === "cand" && "status" in patch) ev.status = patch.status === "done" ? "done" : "draft";
      else if (ev.status === "done") return json({ error: "Fiche clôturée : rouvre-la pour la modifier." }, 409);
      if (role === "cand" && "enc" in patch) { // choix de l'encadrant : membre de l'appli ou nom saisi
        const old = ev.enc && ev.enc.uid; const e = patch.enc || null; let enc = null;
        if (e && e.uid) { const p = await st.get("p/" + clean(e.uid, 40), { type: "json" }); if (p && p.id !== me.id) enc = { uid: p.id, name: nameFromEmail(p) || p.pseudo }; }
        else if (e && e.name) enc = { uid: null, name: clean(e.name, 60) };
        if (old && (!enc || enc.uid !== old)) { await evLink(st, "eve/" + old, ev.id, false); ev.encDone = false; }
        if (enc && enc.uid && enc.uid !== old) { await evLink(st, "eve/" + enc.uid, ev.id, true); if (ev.status !== "done") await pushTo(st, enc.uid, { title: "📋 Fiche d'évaluation", body: `${ev.candN} t'a choisi comme encadrant : sa synthèse de vacation n°${ev.num} est à compléter.`, tag: "ev-" + ev.id, ev: ev.id }); }
        ev.enc = enc;
      }
      const wasDone = !!ev.encDone; evClean(ev, patch, role); ev.updated = Date.now(); await st.setJSON("ev/" + ev.id, ev);
      if (role === "enc" && ev.encDone && !wasDone) await pushTo(st, ev.cand, { title: "✅ Évaluation complétée", body: `${(ev.enc && ev.enc.name) || "Ton encadrant"} a complété et validé ta synthèse de vacation n°${ev.num}.`, tag: "ev-" + ev.id, ev: ev.id });
      return json({ ev, role });
    }
    if (route === "ev/delete" && req.method === "POST") {
      const ev = await st.get("ev/" + clean(body.eid, 20), { type: "json" }); if (!ev) return json({ ok: true });
      const role = evRole(ev, me, cfg); const adm = isAdmin(me, cfg);
      if (!adm && !(role === "cand" && ev.status !== "done")) return json({ error: "Une fiche clôturée ne peut être supprimée que par un administrateur." }, 403);
      await st.delete("ev/" + ev.id); await evLink(st, "evc/" + ev.cand, ev.id, false); if (ev.enc && ev.enc.uid) await evLink(st, "eve/" + ev.enc.uid, ev.id, false);
      return json({ ok: true });
    }
    if (route === "push/key" && req.method === "GET") { const v = await vapid(st); return json({ key: v.pub }); }
    if (route === "push/sub" && req.method === "POST") {
      const s = body.sub || {}; const ep = clean(s.endpoint, 600);
      if (!/^https:\/\//.test(ep) || !s.keys || !s.keys.p256dh || !s.keys.auth) return json({ error: "Abonnement invalide." }, 400);
      me.push = (me.push || []).filter((x) => x.endpoint !== ep).concat([{ endpoint: ep, keys: { p256dh: clean(s.keys.p256dh, 200), auth: clean(s.keys.auth, 60) }, at: Date.now() }]).slice(-5);
      await st.setJSON("p/" + me.id, me); return json({ ok: true });
    }
    if (route === "push/unsub" && req.method === "POST") { const ep = clean(body.endpoint, 600); me.push = (me.push || []).filter((x) => ep && x.endpoint !== ep); await st.setJSON("p/" + me.id, me); return json({ ok: true }); }
    // 3.4.0 : médaille « Soldat du feu » (10 bonnes réponses d'affilée en On Fire), affichée 4 h
    if (route === "badge/sdf" && req.method === "POST") { if (fxOf(me) !== "fire") return json({ error: "Réservé au mode On Fire." }, 403); me.sdf = Date.now() + 4 * 3600e3; await st.setJSON("p/" + me.id, me); return json({ ok: true, sdf: me.sdf }); }
    // 3.4.0 : duel en direct (salle partagée, progression de chaque joueur dans sa propre clé)
    if (route === "live/new" && req.method === "POST") {
      const to = clean(body.to, 40); const op = to && to !== me.id ? await st.get("p/" + to, { type: "json" }) : null;
      if (!op || op.blocked) return json({ error: "Adversaire introuvable." }, 404);
      const qids = (Array.isArray(body.qids) ? body.qids : []).map((x) => clean(x, 60)).filter(Boolean).slice(0, 10);
      if (qids.length < 5) return json({ error: "Pas assez de questions." }, 400);
      const r = { id: randomBytes(6).toString("hex"), a: me.id, aN: me.pseudo, b: to, bN: op.pseudo, qids, level: body.level === "simple" ? "simple" : "expert", themeN: clean(body.themeN, 40), status: "wait", created: Date.now() };
      await st.setJSON("live/" + r.id, r, 900); await st.setJSON("livein/" + to, { id: r.id, at: r.created }, 120);
      await pushTo(st, to, { title: "⚔ Duel en direct", body: `${me.pseudo} te défie maintenant ! Tu as une minute pour accepter.`, tag: "live-" + r.id });
      return json({ room: r });
    }
    if (route === "live/inbox" && req.method === "GET") {
      const x = await st.get("livein/" + me.id, { type: "json" }); if (!x || Date.now() - x.at > 60000) return json({ room: null });
      const r = await st.get("live/" + x.id, { type: "json" }); return json({ room: r && r.b === me.id && r.status === "wait" ? r : null });
    }
    if (route === "live/get" && req.method === "GET") {
      const id = clean(url.searchParams.get("id"), 20); const r = await st.get("live/" + id, { type: "json" });
      if (!r || (r.a !== me.id && r.b !== me.id)) return json({ error: "Duel introuvable." }, 404);
      if (r.status === "wait" && Date.now() - r.created > 60000) { r.status = "timeout"; await st.setJSON("live/" + r.id, r, 900); }
      const [pa, pb] = await st.getMany(["livep/" + r.id + "/" + r.a, "livep/" + r.id + "/" + r.b], { type: "json" });
      return json({ room: r, prog: { [r.a]: pa || null, [r.b]: pb || null }, now: Date.now() });
    }
    if (route === "live/answer" && req.method === "POST") {
      const r = await st.get("live/" + clean(body.rid, 20), { type: "json" }); if (!r || r.b !== me.id) return json({ error: "Duel introuvable." }, 404);
      if (r.status !== "wait") return json({ error: "Ce défi n'est plus disponible." }, 409);
      if (body.accept) { r.status = "go"; r.start = Date.now() + 4000; } else r.status = "no";
      await st.setJSON("live/" + r.id, r, 900); await st.delete("livein/" + me.id); return json({ room: r });
    }
    if (route === "live/cancel" && req.method === "POST") {
      const r = await st.get("live/" + clean(body.rid, 20), { type: "json" }); if (!r || r.a !== me.id) return json({ ok: true });
      if (r.status === "wait") { r.status = "cancel"; await st.setJSON("live/" + r.id, r, 900); await st.delete("livein/" + r.b); } return json({ ok: true });
    }
    if (route === "live/prog" && req.method === "POST") {
      const r = await st.get("live/" + clean(body.rid, 20), { type: "json" }); if (!r || (r.a !== me.id && r.b !== me.id)) return json({ error: "Duel introuvable." }, 404);
      const n = (v, m) => Math.max(0, Math.min(m, Math.round(Number(v) || 0)));
      await st.setJSON("livep/" + r.id + "/" + me.id, { i: n(body.i, 10), pts: n(body.pts, 1000), ok: n(body.ok, 10), done: !!body.done, at: Date.now() }, 900);
      return json({ ok: true });
    }
    if (route === "teams/vote" && req.method === "POST") {
      const tm = await st.get("t/" + clean(body.teamId, 20), { type: "json" });
      if (!tm) return json({ error: "Cette équipe n'existe plus." }, 404);
      const uid = clean(body.uid, 40);
      if (me.team !== tm.id) return json({ error: "Seuls les membres de l'équipe peuvent voter." }, 403);
      if (uid === me.id) return json({ error: "Tu ne peux pas voter sur ta propre exclusion." }, 403);
      const profiles = await allProfiles(st); const t2 = profiles.find((p) => p.id === uid);
      if (!t2 || t2.team !== tm.id) { if (tm.votes) delete tm.votes[uid]; await st.setJSON("t/" + tm.id, tm); return json({ error: "Ce joueur n'est plus dans l'équipe." }, 404); }
      tm.votes = tm.votes || {}; let v = tm.votes[uid];
      if (v && Date.now() > v.exp) v = null;
      if (!v) { if (body.yes === false) return json({ error: "Aucun vote en cours." }, 400); v = tm.votes[uid] = { by: me.id, byN: me.pseudo, at: Date.now(), exp: Date.now() + VOTE_TTL, yes: [], no: [] }; }
      v.yes = (v.yes || []).filter((id) => id !== me.id); v.no = (v.no || []).filter((id) => id !== me.id);
      (body.yes === false ? v.no : v.yes).push(me.id);
      const s = voteState(tm, profiles, uid); let result = null;
      if (s.done) {
        result = s.done; delete tm.votes[uid];
        if (s.done === "out") { t2.team = null; t2.kicked = { team: tm.name, at: Date.now() }; t2.updatedAt = Date.now(); await st.setJSON("p/" + t2.id, t2); if (tm.ownerId === t2.id) tm.ownerId = v.by || me.id; }
      }
      await st.setJSON("t/" + tm.id, tm); return json({ ok: true, result, yes: s.yes, no: s.no, need: s.need });
    }
    if (route === "teams/max" && req.method === "PUT") { // les membres fixent le nombre maximum de joueurs
      const tm = await st.get("t/" + clean(body.teamId, 20), { type: "json" });
      if (!tm) return json({ error: "Cette équipe n'existe plus." }, 404);
      if (me.team !== tm.id && !isAdmin(me, cfg)) return json({ error: "Seuls les membres de l'équipe peuvent changer ce réglage." }, 403);
      const m = Math.round(Number(body.max) || 0);
      const n = (await allProfiles(st)).filter((p) => p.team === tm.id && !p.blocked).length;
      if (m && (m < 2 || m > 99)) return json({ error: "Choisis un maximum entre 2 et 99 (ou aucun)." }, 400);
      if (m && m < n) return json({ error: `L'équipe compte déjà ${n} membres : le maximum ne peut pas être plus bas.` }, 400);
      tm.max = m || null; await st.setJSON("t/" + tm.id, tm); return json({ ok: true, max: tm.max });
    }
    if (route === "teams/leave" && req.method === "POST") { me.team = null; me.updatedAt = Date.now(); await st.setJSON("p/" + me.id, me); return json({ ok: true }); }
    if (route === "teams" && req.method === "DELETE") {
      const tm = await st.get("t/" + clean(body.teamId, 20), { type: "json" });
      if (!tm) return json({ ok: true });
      if (tm.ownerId !== me.id && !isAdmin(me, cfg)) return json({ error: "Seul le créateur de l'équipe peut la supprimer." }, 403);
      await st.delete("t/" + tm.id);
      for (const p of await allProfiles(st)) if (p.team === tm.id) { p.team = null; await st.setJSON("p/" + p.id, p); }
      return json({ ok: true });
    }

    if (route === "profile" && req.method === "PUT") {
      if (body.pseudo !== undefined) { const ps = clean(body.pseudo, 24); if (ps.length >= 2 && ps.toLowerCase() !== me.pseudo.toLowerCase()) { const all = await allProfiles(st); if (all.some((x) => x.id !== me.id && x.pseudo.toLowerCase() === ps.toLowerCase())) return json({ error: "Ce pseudo est déjà pris." }, 409); me.pseudo = ps; } }
      if (body.unite !== undefined) me.unite = clean(body.unite, 40);
      if (COLORS.includes(body.color)) me.color = body.color;
      if (["off", "sgt", "fire"].includes(body.fx)) setFx(me, body.fx); // le membre choisit lui-même : normal, sergent ou On Fire
      else if (typeof body.fire === "boolean") setFx(me, body.fire ? "fire" : "off");
      if (body.stats) {
        // un administrateur a remis les scores à zéro : l'appli doit d'abord appliquer la remise à zéro
        const s = sanitizeStats(body.stats); if (me.stats?.defi && s.defi && me.stats.defi.week === s.defi.week) s.defi = me.stats.defi; me.stats = s;
      }
      me.updatedAt = Date.now(); await st.setJSON("p/" + me.id, me);
      return withCookie(json({ profile: pub(me), resetAt: me.resetAt || null, admin: isAdmin(me, cfg), zz: zOf(me), xx: xOf(me), zmo: zmoOf(me), kk: me.kicked || null }), me.id);
    }
    if (route === "logout" && req.method === "POST") { const h = sha(req.headers.get("x-token") || body?.token); await st.delete("s/" + h); if ((me.sessions || []).includes(h)) { me.sessions = me.sessions.filter((x) => x !== h); await st.setJSON("p/" + me.id, me); } return withCookie(json({ ok: true }), null); }
    if (route === "kick/seen" && req.method === "POST") { if (me.kicked) { me.kicked = null; await st.setJSON("p/" + me.id, me); } return json({ ok: true }); }
    if (route === "z/seen" && req.method === "POST") { if (me.zm) { me.zm = null; await st.setJSON("p/" + me.id, me); } return json({ ok: true }); }
    if (route === "profile" && req.method === "DELETE") { if (me.email === SUPER) return json({ error: "Le super administrateur ne peut pas supprimer son profil." }, 400); await st.delete("p/" + me.id); await st.delete("u/" + me.id); if (me.sub) await st.delete("g/" + me.sub); return json({ ok: true }); }

    // ---- journal d'activité (pour analyser les bugs a posteriori)
    if (route === "log" && req.method === "POST") {
      const evs = Array.isArray(body.events) ? body.events.slice(0, 300) : [];
      if (!evs.length) return json({ ok: true });
      const ua = clean(req.headers.get("user-agent"), 160), now = Date.now();
      const byDay = {};
      for (const e of evs) {
        const t = Math.min(now, Math.max(now - 7 * 86400e3, Number(e && e.t) || now));
        const rec = { t, u: me.id, p: clean(me.pseudo, 24), k: clean(e && e.k, 16), v: clean(e && e.v, 100), d: clean(typeof (e && e.d) === "string" ? e.d : JSON.stringify((e && e.d) || ""), 800), c: clean(e && e.c, 140), s: clean(body.s, 12), ver: clean(body.ver, 12), ua };
        const day = new Date(t).toISOString().slice(0, 10); (byDay[day] = byDay[day] || []).push(JSON.stringify(rec));
      }
      for (const [day, list] of Object.entries(byDay)) await st.logPush("log/" + day, list);
      return json({ ok: true });
    }

    // ---- administration
    if (route.startsWith("admin/")) {
      if (!isAdmin(me, cfg)) return json({ error: "Réservé aux administrateurs." }, 403);
      const superMe = me.email === SUPER;
      if (route === "admin/logs" && req.method === "GET") {
        const day = /^\d{4}-\d{2}-\d{2}$/.test(url.searchParams.get("day") || "") ? url.searchParams.get("day") : new Date().toISOString().slice(0, 10);
        const n = Math.max(1, Math.min(5000, Number(url.searchParams.get("n")) || 2000));
        const raw = (await st.logRange("log/" + day, n)) || [];
        return json({ day, logs: raw.map((x) => { try { return JSON.parse(x); } catch (e) { return null; } }).filter(Boolean) });
      }
      if (route === "admin/members" && req.method === "GET") {
        const all = await allProfiles(st);
        return json({ members: all.map((p) => ({ ...pub(p), email: p.email || null, name: p.name || "", blocked: !!p.blocked, admin: isAdmin(p, cfg), superAdmin: p.email === SUPER, createdAt: p.createdAt, lastLogin: p.lastLogin || null, z: zOf(p), x: xOf(p), zmo: zmoOf(p) })), settings: cfg, superAdmin: superMe, superEmail: SUPER });
      }
      if (route === "admin/settings" && req.method === "PUT") {
        const list = (a, re) => [...new Set((Array.isArray(a) ? a : String(a || "").split(/[\s,;]+/)).map((x) => String(x).trim().toLowerCase().replace(/^@/, "")).filter((x) => re.test(x)))].slice(0, 300);
        cfg.allowedDomains = list(body.allowedDomains, /^[a-z0-9.-]+\.[a-z]{2,}$/);
        cfg.allowedEmails = list(body.allowedEmails, /^[^@\s]+@[a-z0-9.-]+\.[a-z]{2,}$/);
        await st.setJSON("cfg/settings", cfg); return json({ settings: cfg });
      }
      if (route === "admin/member" && req.method === "PUT") {
        const t = await st.get("p/" + clean(body.target, 40), { type: "json" });
        if (!t) return json({ error: "Membre introuvable." }, 404);
        const fun = ["fire", "unfire", "sergent", "unnick", "zon", "zoff", "xon", "xoff"].includes(body.action) || /^zmo-(miroir|escargot|radio|fuite|ponpon)-(on|off)$/.test(body.action || ""); // le mode On Fire peut viser tout le monde, super admin compris
        if (!fun && t.email === SUPER && body.action !== "reset") return json({ error: "Le super administrateur ne peut pas être modifié." }, 403);
        if (!fun && isAdmin(t, cfg) && !superMe && t.id !== me.id) return json({ error: "Seul le super administrateur peut modifier un administrateur." }, 403);
        switch (body.action) {
          case "reset": t.stats = emptyStats(); t.resetAt = Date.now(); await st.setJSON("u/" + t.id, { v: 1, resetAt: t.resetAt }); break;
          case "block": t.blocked = true; break;
          case "unblock": t.blocked = false; break;
          case "fire": setFx(t, "fire"); t.fireAt = Date.now(); break; // mode « On Fire » activé par un administrateur
          case "sergent": setFx(t, "sgt"); t.fireAt = Date.now(); break; // mode Braise : messages musclés sans thème visuel
          case "unfire": setFx(t, "off"); break;
          case "zon": t.zm = { u: Date.now() + 3600e3, by: me.pseudo || "un administrateur", at: Date.now() }; break; // mode Z : piège secret d'une heure
          case "zoff": t.zm = null; break;
          default: { const m = /^zmo-(miroir|escargot|radio|fuite|ponpon)-(on|off)$/.exec(body.action || ""); if (!m) return json({ error: "Action inconnue." }, 400); t.zmo = t.zmo || {}; if (m[2] === "on") t.zmo[m[1]] = { u: Date.now() + 3600e3, by: me.pseudo || "un administrateur", at: Date.now() }; else delete t.zmo[m[1]]; break; }
          case "xon": t.xm = { u: Date.now() + 3600e3, by: me.pseudo || "un administrateur", at: Date.now() }; break; // mode X : blagues visibles pendant une heure
          case "xoff": t.xm = null; break;
          case "unnick": t.nick = null; break; // retirer un surnom de duel jugé déplacé
          case "rename": { const ps = clean(body.pseudo, 24); if (ps.length < 2) return json({ error: "Pseudo trop court." }, 400); t.pseudo = await uniquePseudo(st, ps, t.id); break; }
          case "admin": case "unadmin":
            if (!superMe) return json({ error: "Seul le super administrateur gère les administrateurs." }, 403);
            if (!t.email) return json({ error: "Ce membre n'a pas de compte Google." }, 400);
            cfg.admins = (cfg.admins || []).filter((e) => e !== t.email); if (body.action === "admin") cfg.admins.push(t.email);
            await st.setJSON("cfg/settings", cfg); return json({ ok: true });
          case "delete": { await st.delete("u/" + t.id); await st.delete("p/" + t.id); if (t.sub) await st.delete("g/" + t.sub); const eids = await evList(st, "evc/" + t.id); for (const i of eids) { const ev = await st.get("ev/" + i, { type: "json" }); if (ev && ev.enc && ev.enc.uid) await evLink(st, "eve/" + ev.enc.uid, i, false); await st.delete("ev/" + i); } await st.delete("evc/" + t.id); return json({ ok: true }); }
        }
        t.updatedAt = Date.now(); await st.setJSON("p/" + t.id, t); return json({ ok: true });
      }
    }
    return json({ error: "Route inconnue." }, 404);
  } catch (e) {
    console.error(e);
    if (String(e && e.message) === "no-db") return json({ error: "Base de données non configurée (connecte Upstash Redis au projet Vercel)." }, 503);
    return json({ error: "Erreur serveur, réessaie plus tard." }, 500);
  }
}

export default { fetch: handler };
