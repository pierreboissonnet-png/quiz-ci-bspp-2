// API du Quiz CI BSPP — Vercel Functions + base Redis (Upstash, via le Marketplace Vercel).
// Variables d'environnement (Vercel › Project › Settings › Environment Variables) :
//   GOOGLE_CLIENT_ID  identifiant OAuth « Application Web » (Google Cloud) — active la connexion Google
//   SESSION_SECRET    clé secrète (longue chaîne aléatoire) qui signe le cookie d'accès aux contenus
//   SUPER_ADMIN       e-mail du super administrateur (par défaut pierre.boissonnet@croix-rouge.fr)
//   TEAM_CODE         (facultatif) code d'équipe, utilisé seulement si la connexion Google n'est pas configurée
//   KV_REST_API_URL / KV_REST_API_TOKEN (ou UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN) : ajoutés
//   automatiquement quand on connecte une base « Upstash for Redis » au projet.
import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

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
  out.rank = num(s.rank, 16);
  if (out.correct > out.answered) out.correct = out.answered;
  if (s.themes && typeof s.themes === "object") for (const [k, v] of Object.entries(s.themes).slice(0, 12)) out.themes[clean(k, 12)] = num(v, 100);
  // historique pour les graphiques : 12 dernières semaines et 12 derniers mois
  out.hw = {}; if (s.hw && typeof s.hw === "object") for (const [k, v] of Object.entries(s.hw).slice(-16)) if (/^\d{4}-S\d{2}$/.test(k)) out.hw[k] = num(v, 1e7);
  out.hm = {}; if (s.hm && typeof s.hm === "object") for (const [k, v] of Object.entries(s.hm).slice(-16)) if (/^\d{4}-\d{2}$/.test(k)) out.hm[k] = num(v, 1e7);
  if (s.defi && /^\d{4}-S\d{2}$/.test(s.defi.week || "")) out.defi = { week: s.defi.week, score: num(s.defi.score, 20), ms: num(s.defi.ms, 36e5) };
  return out;
}
const emptyStats = () => sanitizeStats({});
const fxOf = (p) => (["off", "sgt", "fire"].includes(p.fxm) ? p.fxm : p.onFire ? "fire" : "off"); // mode d'ambiance : normal / sergent / On Fire
const setFx = (p, m) => { p.fxm = m; p.onFire = m === "fire"; };
const pub = (p) => ({ id: p.id, pseudo: p.pseudo, unite: p.unite, color: p.color, team: p.team || null, stats: p.stats, updatedAt: p.updatedAt, fire: fxOf(p) === "fire", fx: fxOf(p) });
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

async function handler(req) {
  const url = new URL(req.url);
  // vercel.json réécrit /api/<route> vers /api?route=<route>
  const route = (url.searchParams.get("route") ?? url.pathname.replace(/^\/api\/?/, "")).replace(/^\/+|\/+$/g, "");
  const st = store();
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

    if (route === "me") return withCookie(json({ profile: pub(me), email: me.email || null, admin: isAdmin(me, cfg), superAdmin: me.email === SUPER, resetAt: me.resetAt || null }), me.id);

    if (route === "board" && req.method === "GET") {
      const [profiles, teams] = await Promise.all([allProfiles(st), allTeams(st)]);
      const ids = new Set(teams.map((x) => x.id));
      return json({ profiles: profiles.filter((p) => !p.blocked).map((p) => ({ ...pub(p), team: ids.has(p.team) ? p.team : null })), teams: teams.map((x) => ({ id: x.id, name: x.name, ownerId: x.ownerId, createdAt: x.createdAt })), now: Date.now() });
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
      return json({ teams: teams.map((x) => ({ id: x.id, name: x.name, ownerId: x.ownerId, owner: byId[x.ownerId]?.pseudo || "—", members: profiles.filter((p) => p.team === x.id && !p.blocked).length, createdAt: x.createdAt })).sort((a, b) => a.name.localeCompare(b.name)), myTeam: me.team || null });
    }
    if (route === "teams" && req.method === "POST") {
      const name = clean(body.name, 40);
      if (name.length < 3) return json({ error: "Le nom de l'équipe doit faire au moins 3 caractères." }, 400);
      const teams = await allTeams(st);
      if (teams.length >= 300) return json({ error: "Nombre maximal d'équipes atteint." }, 400);
      if (teams.some((x) => x.name.toLowerCase() === name.toLowerCase())) return json({ error: "Une équipe porte déjà ce nom." }, 409);
      const id = randomBytes(6).toString("hex");
      await st.setJSON("t/" + id, { id, name, ownerId: me.id, createdAt: Date.now() });
      me.team = id; me.updatedAt = Date.now(); await st.setJSON("p/" + me.id, me);
      return json({ team: { id, name, ownerId: me.id } });
    }
    if (route === "teams/join" && req.method === "POST") {
      const tm = await st.get("t/" + clean(body.teamId, 20), { type: "json" });
      if (!tm) return json({ error: "Cette équipe n'existe plus." }, 404);
      me.team = tm.id; me.updatedAt = Date.now(); await st.setJSON("p/" + me.id, me);
      return json({ team: { id: tm.id, name: tm.name, ownerId: tm.ownerId } });
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
      return withCookie(json({ profile: pub(me), resetAt: me.resetAt || null, admin: isAdmin(me, cfg) }), me.id);
    }
    if (route === "logout" && req.method === "POST") { const h = sha(req.headers.get("x-token") || body?.token); await st.delete("s/" + h); if ((me.sessions || []).includes(h)) { me.sessions = me.sessions.filter((x) => x !== h); await st.setJSON("p/" + me.id, me); } return withCookie(json({ ok: true }), null); }
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
        return json({ members: all.map((p) => ({ ...pub(p), email: p.email || null, name: p.name || "", blocked: !!p.blocked, admin: isAdmin(p, cfg), superAdmin: p.email === SUPER, createdAt: p.createdAt, lastLogin: p.lastLogin || null })), settings: cfg, superAdmin: superMe, superEmail: SUPER });
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
        const fun = ["fire", "unfire", "sergent"].includes(body.action); // le mode On Fire peut viser tout le monde, super admin compris
        if (!fun && t.email === SUPER && body.action !== "reset") return json({ error: "Le super administrateur ne peut pas être modifié." }, 403);
        if (!fun && isAdmin(t, cfg) && !superMe && t.id !== me.id) return json({ error: "Seul le super administrateur peut modifier un administrateur." }, 403);
        switch (body.action) {
          case "reset": t.stats = emptyStats(); t.resetAt = Date.now(); await st.setJSON("u/" + t.id, { v: 1, resetAt: t.resetAt }); break;
          case "block": t.blocked = true; break;
          case "unblock": t.blocked = false; break;
          case "fire": setFx(t, "fire"); t.fireAt = Date.now(); break; // mode « On Fire » activé par un administrateur
          case "sergent": setFx(t, "sgt"); t.fireAt = Date.now(); break; // mode Braise : messages musclés sans thème visuel
          case "unfire": setFx(t, "off"); break;
          case "rename": { const ps = clean(body.pseudo, 24); if (ps.length < 2) return json({ error: "Pseudo trop court." }, 400); t.pseudo = await uniquePseudo(st, ps, t.id); break; }
          case "admin": case "unadmin":
            if (!superMe) return json({ error: "Seul le super administrateur gère les administrateurs." }, 403);
            if (!t.email) return json({ error: "Ce membre n'a pas de compte Google." }, 400);
            cfg.admins = (cfg.admins || []).filter((e) => e !== t.email); if (body.action === "admin") cfg.admins.push(t.email);
            await st.setJSON("cfg/settings", cfg); return json({ ok: true });
          case "delete": await st.delete("u/" + t.id); await st.delete("p/" + t.id); if (t.sub) await st.delete("g/" + t.sub); return json({ ok: true });
          default: return json({ error: "Action inconnue." }, 400);
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
