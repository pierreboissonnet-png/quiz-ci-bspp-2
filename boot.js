"use strict";
/* Démarrage : la connexion est obligatoire. Sans session valide, on affiche l'écran de connexion ;
   les contenus (questions, documents) ne sont chargés qu'une fois connecté. */
(function () {
  const LS = {
    get(k, d) { try { const v = localStorage.getItem("cq_" + k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem("cq_" + k, JSON.stringify(v)); } catch (e) {} },
    del(k) { try { localStorage.removeItem("cq_" + k); } catch (e) {} },
  };
  const app = document.getElementById("app");
  const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const GLOGO = '<svg viewBox="0 0 48 48" width="20" height="20"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>';
  const authHeaders = (me) => ({ authorization: "Bearer " + me.id + ":" + me.token, "x-id": me.id, "x-token": me.token });

  function loadScript(src) {
    return new Promise((res, rej) => { const s = document.createElement("script"); s.src = src; s.onload = res; s.onerror = rej; document.body.appendChild(s); });
  }
  async function dataOk() { try { const r = await fetch("data.js", { method: "HEAD", cache: "no-store", credentials: "same-origin" }); return r.ok; } catch (e) { return null; } }

  async function start() {
    const me = LS.get("me", null);
    if (!me || !me.token || me.expired) return renderLogin();
    document.body.classList.add("booting");
    let ok = await dataOk();
    if (ok === false) {
      // pas de cookie d'accès sur cet appareil : on le redemande avec la session enregistrée
      try {
        const r = await fetch("api/me", { headers: authHeaders(me), cache: "no-store", credentials: "same-origin" });
        if (r.status === 401) { me.expired = true; LS.set("me", me); return renderLogin("Ta session a expiré. Reconnecte-toi."); }
        ok = await dataOk();
      } catch (e) { ok = null; }
      if (ok === false) return renderLogin("Accès refusé. Reconnecte-toi.");
    }
    try { await loadScript("data.js"); await loadScript("app.js"); }
    catch (e) { return renderLogin("Impossible de charger l'appli. Vérifie ta connexion puis réessaie."); }
    document.body.classList.remove("booting");
  }

  let cfg = LS.get("srvCfg", null), pollT = null;
  async function loadCfg() { try { const r = await fetch("api/config", { cache: "no-store" }); if (r.ok) { cfg = await r.json(); LS.set("srvCfg", cfg); } } catch (e) {} return cfg; }
  const isStandalone = () => window.matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
  const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

  async function renderLogin(msg) {
    document.body.classList.remove("booting");
    document.body.classList.add("pushed", "gate");
    const pending = LS.get("pendingLogin", null);
    app.className = "view gatev";
    app.innerHTML = `<div class="gatebox">
      <div class="logos"><img src="logo-bspp.png" alt="BSPP"><img class="crf" src="logo-crf.png" alt="Croix-Rouge française"></div>
      <h1 class="big" style="margin-top:22px">Quiz CI BSPP</h1>
      <p class="sub">Entraînement au parcours Chef d'Intervention en réseau de secours BSPP. Accès réservé aux membres de l'équipe.</p>
      <div class="card" id="gcard"><div class="loading">Chargement…</div></div>
      ${msg ? `<p class="small" style="margin:12px 4px 0;color:var(--ko)">${esc(msg)}</p>` : ""}
      <p class="small" style="margin:18px 4px 0"><b>Application non officielle</b>, ni éditée ni validée par la BSPP ni par la Croix-Rouge française. Elle sert uniquement à s'entraîner et à réviser. Développée par l'Unité Locale de Paris XVIII de la Croix-Rouge française.</p>
      ${!isStandalone() && isIOS() ? `<p class="small" style="margin:16px 4px 0">Astuce : après connexion, ajoute l'appli à ton écran d'accueil (bouton Partager › Sur l'écran d'accueil).</p>` : ""}
    </div>`;
    if (!cfg || navigator.onLine) await loadCfg();
    const card = document.getElementById("gcard");
    if (!cfg) { card.innerHTML = `<p style="margin:0">Une connexion internet est nécessaire pour te connecter la première fois.</p><button class="btn sec full" style="margin-top:12px" id="retry">Réessayer</button>`; document.getElementById("retry").onclick = () => renderLogin(); return; }
    if (cfg.google) {
      card.innerHTML = `<p style="margin:0 0 14px">Connecte-toi avec ton compte Google pour accéder au quiz.</p>
        <button class="gbtn" id="gLogin">${GLOGO}<span>Se connecter avec Google</span></button>
        ${pending ? `<p class="small" style="margin:12px 0 0">Connexion en cours… Une fois connecté sur la page Google, reviens simplement ici.</p>` : ""}`;
      document.getElementById("gLogin").onclick = loginGoogle;
      if (pending) startPoll();
    } else if (!cfg.teamCode) {
      card.innerHTML = `<p style="margin:0"><b>Connexion pas encore configurée.</b></p><p class="small" style="margin:8px 0 0">L'administrateur doit renseigner la variable <b>GOOGLE_CLIENT_ID</b> dans l'hébergeur puis redéployer le site.</p><button class="btn sec full" style="margin-top:12px" id="retry">Réessayer</button>`;
      document.getElementById("retry").onclick = async () => { cfg = null; LS.del("srvCfg"); renderLogin(); };
    } else {
      card.innerHTML = `<form id="tform" class="form"><label for="tP">Pseudo</label><input id="tP" maxlength="24" required placeholder="ex. Pierre B.">
        <label for="tU">Unité (facultatif)</label><input id="tU" maxlength="40" placeholder="ex. CRF Paris 18">
        ${cfg.teamCode ? `<label for="tC">Code d'équipe</label><input id="tC" autocapitalize="characters" required>` : ""}
        <button class="btn full" type="submit" style="margin-top:14px">Entrer</button><p class="small" id="tM" style="color:var(--ko)"></p></form>`;
      document.getElementById("tform").onsubmit = async (e) => {
        e.preventDefault(); const m = document.getElementById("tM"); m.textContent = "";
        try {
          const r = await fetch("api/profile", { method: "POST", headers: { "content-type": "application/json" }, credentials: "same-origin", body: JSON.stringify({ pseudo: tP.value, unite: tU.value, team: cfg.teamCode ? tC.value : "", color: "#e3051b", stats: {} }) });
          const j = await r.json(); if (!r.ok) { m.textContent = j.error || "Erreur."; return; }
          LS.set("me", { id: j.id, token: j.token, pseudo: j.profile.pseudo, unite: j.profile.unite, color: j.profile.color, resetSeen: Date.now() });
          location.replace(location.pathname);
        } catch (err) { m.textContent = "Pas de connexion."; }
      };
    }
  }
  function randHex(n) { const a = new Uint8Array(n / 2); crypto.getRandomValues(a); return [...a].map((b) => b.toString(16).padStart(2, "0")).join(""); }
  function loginGoogle() {
    const code = randHex(32); LS.set("pendingLogin", { code, at: Date.now() });
    const p = new URLSearchParams({ client_id: cfg.clientId, redirect_uri: location.origin + "/api/auth/google", response_type: "id_token", scope: "openid email profile", nonce: code, state: code, response_mode: "form_post", prompt: "select_account" });
    startPoll(); location.href = "https://accounts.google.com/o/oauth2/v2/auth?" + p;
  }
  function startPoll() { clearInterval(pollT); pollT = setInterval(poll, 2000); poll(); }
  async function poll() {
    const pl = LS.get("pendingLogin", null);
    if (!pl || Date.now() - pl.at > 15 * 60e3) { LS.del("pendingLogin"); clearInterval(pollT); return; }
    try {
      const r = await fetch("api/auth/poll?code=" + pl.code, { cache: "no-store", credentials: "same-origin" }); const j = await r.json();
      if (j.pending) return;
      clearInterval(pollT); LS.del("pendingLogin");
      if (j.error) { renderLogin(j.error); return; }
      LS.set("me", { id: j.id, token: j.token, email: j.email, admin: j.admin, superAdmin: j.superAdmin, pseudo: j.profile.pseudo, unite: j.profile.unite, color: j.profile.color, resetSeen: Date.now() });
      if (j.isNew) LS.set("welcome", true);
      location.replace(location.pathname);
    } catch (e) {}
  }
  document.addEventListener("visibilitychange", () => { if (!document.hidden && LS.get("pendingLogin", null) && document.body.classList.contains("gate")) startPoll(); });
  if (location.hash === "#login") history.replaceState(null, "", location.pathname);
  if ("serviceWorker" in navigator && location.protocol.startsWith("http")) navigator.serviceWorker.register("sw.js").catch(() => {});
  start();
})();
