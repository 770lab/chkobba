# Chkobba — 770lab.com/chkobba

(Ancienne adresse `770lab.com/chkoba`, avec un seul b : le dépôt `770lab/chkoba` ne fait plus que rediriger ici.)

Le jeu de cartes tunisien (contre l'ordinateur, à 2 ou à 4, en ligne via Firebase `chkobba-55555`).
Site statique servi par GitHub Pages (mode legacy, `.nojekyll`), ex-chkobba-55555.netlify.app.

- `index.html` : tout le jeu (polices et cartes intégrées en base64).
- `sw.js` : hors ligne (réseau d'abord, cache ensuite). **Changer `V` à chaque mise à jour.**
- Les applis iPhone / Android (dépôt `770lab/chkobba-app`) embarquent ces mêmes fichiers.

Mettre à jour depuis un zip : `unzip -o ~/Downloads/chkobba-app.zip -d ~/chkobba`, puis commit + push.
**Garder les blocs `<style id="correctifs-affichage">` (avant `</head>`), `<script id="correctifs-jeu">` et `<script id="ajouts-amis">` (avant `</body>`)** : ils ne sont pas dans le zip d'origine.
