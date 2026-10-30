# Quiz CI BSPP — hébergement Vercel

Application web (PWA) d'entraînement au parcours CI BSPP. Application non officielle, développée par l'UL de Paris XVIII.

## Contenu du dossier
- `index.html`, `boot.js`, `app.js`, `style.css`, `sw.js`, `manifest.webmanifest`, icônes et logos : l'appli
- `data.js`, `search.json`, `pdf/`, `secteurs.json` : questions, index de recherche, référentiels, carte des secteurs
- `pdfjs/`, `leaflet/` : lecteur PDF et carte
- `api/index.mjs` : serveur (connexion Google, profils, équipes, classement, synchronisation)
- `middleware.js` : réserve les questions et les PDF aux membres connectés
- `vercel.json`, `package.json` : configuration Vercel

## Variables d'environnement (Vercel › Settings › Environment Variables)
- `GOOGLE_CLIENT_ID` : identifiant du client OAuth Google
- `SESSION_SECRET` : longue chaîne aléatoire (ne jamais la publier)
- `SUPER_ADMIN` (facultatif) : par défaut pierre.boissonnet@croix-rouge.fr
- `BUG_API_KEY` (facultatif, 5.2.1) : clé d'accès de service aux signalements (suivi avec Claude). Au moins 32 caractères, ne jamais la publier ni l'envoyer sur GitHub. Sans cette variable, l'accès est désactivé. Le super administrateur peut aussi le couper dans Administration › Signalements.
- Base Redis : `KV_REST_API_URL` et `KV_REST_API_TOKEN`, ajoutées automatiquement en connectant « Upstash for Redis » (Storage)

## Mise à jour
Envoyer les fichiers modifiés sur GitHub : Vercel redéploie tout seul.
