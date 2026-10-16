// Protège les contenus du quiz (questions, index de recherche, PDF) : accès réservé aux membres connectés.
// Vérifie le cookie signé « qs » posé par l'API à la connexion (variable SESSION_SECRET).
const enc = new TextEncoder();
let keyP = null;
function key(secret) {
  if (!keyP) keyP = crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return keyP;
}
const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");

export default async (req, context) => {
  const secret = (Netlify.env.get("SESSION_SECRET") || "").trim();
  if (!secret) return context.next(); // protection désactivée tant que SESSION_SECRET n'est pas défini
  const m = /(?:^|;\s*)qs=([a-f0-9]+)\.(\d+)\.([a-f0-9]{64})/.exec(req.headers.get("cookie") || "");
  if (m && Number(m[2]) * 1000 > Date.now()) {
    const sig = hex(await crypto.subtle.sign("HMAC", await key(secret), enc.encode(m[1] + "." + m[2])));
    if (sig === m[3]) return context.next();
  }
  return new Response("Connexion requise", { status: 401, headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" } });
};

export const config = { path: ["/data.js", "/search.json", "/pdf/*"] };
