// Protège les contenus du quiz (questions, index de recherche, carte et annuaire des CS, PDF) : accès réservé aux membres connectés.
// Vérifie le cookie signé « qs » posé par l'API à la connexion (variable SESSION_SECRET).
import { next } from "@vercel/functions";
import { createHmac, timingSafeEqual } from "node:crypto";

export const config = { matcher: ["/data.js", "/search.json", "/secteurs.json", "/simple.js", "/pdf/:path*"], runtime: "nodejs" };

export default function middleware(req) {
  const secret = (process.env.SESSION_SECRET || "").trim();
  if (!secret) return next(); // protection désactivée tant que SESSION_SECRET n'est pas défini
  const m = /(?:^|;\s*)qs=([a-f0-9]+)\.(\d+)\.([a-f0-9]{64})/.exec(req.headers.get("cookie") || "");
  if (m && Number(m[2]) * 1000 > Date.now()) {
    const sig = Buffer.from(createHmac("sha256", secret).update(m[1] + "." + m[2]).digest("hex"));
    const got = Buffer.from(m[3]);
    if (sig.length === got.length && timingSafeEqual(sig, got)) return next();
  }
  return new Response("Connexion requise", { status: 401, headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" } });
}
