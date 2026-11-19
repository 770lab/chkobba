# Chkobba — 770lab.com/chkobba

(Ancienne adresse `770lab.com/chkoba`, avec un seul b : le dépôt `770lab/chkoba` ne fait plus que rediriger ici.)

Le jeu de cartes tunisien (contre l'ordinateur, à 2 ou à 4, en ligne via Firebase `chkobba-55555`).
Site statique servi par GitHub Pages (mode legacy, `.nojekyll`), ex-chkobba-55555.netlify.app.

- `index.html` : tout le jeu (polices et cartes intégrées en base64).
- `sw.js` : hors ligne (réseau d'abord, cache ensuite). **Changer `V` à chaque mise à jour.**
- Les applis iPhone / Android (dépôt `770lab/chkobba-app`) embarquent ces mêmes fichiers.

## Version commune avec Laurent (depuis le 16/11/2026)

Le jeu est développé à deux : Laurent (sa copie d'essai : chkobba-55555.netlify.app) et 770lab. **La base est le fichier de
Laurent** (dernière reprise : sa version de lancement du 19/11/2026, `PROTO = 3`). Tout ce qui touche au jeu en ligne (journal
`ev/`, tables, sièges, schéma et règles Firebase, note, classements, ordre de `REACTS`, `PROTO`) vient de lui et ne se
change pas seul.

Nos ajouts sont dans trois blocs posés après coup, **absents de son fichier** :
`<style id="correctifs-affichage">` (avant `</head>`), `<script id="correctifs-jeu">` et `<script id="ajouts-amis">`
(avant `</body>`). Ils enveloppent ses fonctions sans les modifier.

Un 4e ajout (16/11) : `<style id="suivi-direct-style">` + `<script id="suivi-direct">`,
le volet « En direct » à droite sur écran large (iPhone Duo ouvert, tablette, ordinateur).

Volet « En direct » : depuis la livraison finale (18/11), réservé au mode Entraînement contre l'IA, quand le joueur a
demandé l'aide au comptage (`aideComptage()`), règle de Laurent acceptée par Ishay le 19/11. La page
`confidentialite.html` est publiée avec contact@770lab.com (choix d'Ishay, 19/11) et l'hébergeur GitHub Pages.

Reprendre une nouvelle version de Laurent :
1. garder nos trois blocs (les copier depuis l'`index.html` actuel), remplacer le reste par son fichier, reposer les blocs ;
2. changer `V` dans `sw.js` (`chkobba-AAAAMMJJ-HHMM`) ;
3. `node --check` sur chaque `<script>` extrait, puis les essais (simulateur `chk-mock` : un petit serveur WebSocket qui
   répond aux opérations de `initMock`) ;
4. lui rendre le journal de ce qui vient de nous, pour que sa copie reste identique.
