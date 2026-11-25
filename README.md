# Chkobba — 770lab.com/chkobba

(Ancienne adresse `770lab.com/chkoba`, avec un seul b : le dépôt `770lab/chkoba` ne fait plus que rediriger ici.)

Le jeu de cartes tunisien (contre l'ordinateur, à 2 ou à 4, en ligne via Firebase `chkobba-770lab`, le projet de 770lab,
depuis le 25/11/2026 ; avant : `chkobba-55555`, le projet de Laurent).
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

Ajout du 24/11/2026 dans `correctifs-jeu` : **l'historique « face à face / ensemble » suit le compte et compte les abandons**
(un joueur voyait « jamais joué ensemble » avec un ami de longue date). `P.rel` n'était gardé que sur l'appareil ; il part
maintenant dans `users/<uid>/rel` (écriture à part du profil : une règle qui la refuse ne casse pas le reste) et revient
fusionné (le plus grand compteur gagne) quand un compte relié est retrouvé sur un autre appareil (`profFromCloud`) ;
`startOnline` note qui est à la table (`P.pend.uids`) et `eloAbandon` compte la défaite pour chaque joueur réel. Les fonctions
de Laurent sont enveloppées, pas modifiées. **Règles Firebase : `users/$uid/rel` doit être accessible en écriture à son
propriétaire** (à vérifier dans les règles réelles ; sur le projet de 770lab, les règles seront à nous). Essais : `node essais/rel.test.mjs`
(Playwright + `essais/faux-firebase.mjs`, un faux Firebase qui répond à `initMock` ; format téléphone ; 33 vérifications, jamais sur une vraie base).

Reprendre une nouvelle version de Laurent :
1. garder nos trois blocs (les copier depuis l'`index.html` actuel), remplacer le reste par son fichier, reposer les blocs ;
2. changer `V` dans `sw.js` (`chkobba-AAAAMMJJ-HHMM`) ;
3. `node --check` sur chaque `<script>` extrait, puis les essais (simulateur `chk-mock` : un petit serveur WebSocket qui
   répond aux opérations de `initMock`) ;
4. lui rendre le journal de ce qui vient de nous, pour que sa copie reste identique.

## Déménagement vers le Firebase de 770lab (depuis le 23/11/2026)

**BASCULE FAITE LE 25/11/2026 À 15 H 14** (« Go, bascule complète » d'Ishay, donné ici et confirmé sur le MacBook Air). Ce qui suit plus bas est
l'histoire de la préparation ; l'état actuel est celui-ci :
- Le site (PR #9) et les applis (`chkobba-app` PR #10, TestFlight + APK de test lancés à 15 h 13) pointent vers **`chkobba-770lab`**.
- Import final à 15 h 10 – 15 h 11, vérifié par la session du MacBook Air puis recoupé depuis le cloud : 139 comptes des deux côtés (mêmes uid,
  mêmes fournisseurs, mêmes adresses), base identique nœud pour nœud, règles identiques, lecture et écriture refusées sans compte (401). Personne
  n'avait joué chez Laurent depuis le 24/11 à 21 h 58 : rien n'a été perdu entre l'export et la bascule.
- **`chkobba-770lab` est la base en service : NE PLUS JAMAIS y réimporter** (`database:set /`, `auth:import`, règles), ni y faire d'essai qui crée
  un joueur ou une table (le classement est public). Pour essayer : `essais/` (faux Firebase).
- `chkobba-55555` (Laurent) n'a pas été modifié et reste tel quel. La copie d'essai de Laurent (chkobba-55555.netlify.app) est encore dessus :
  ses joueurs et ceux du site ne se voient plus tant qu'il n'a pas repris le nouveau `FB_CONFIG` et `OAUTH.google` de `index.html`.
- Les exports de 15 h 10 sont dans `~/chkobba-demenagement/export-laurent-J2` sur le MacBook Air (dossier privé : adresses et empreintes de mots de
  passe, jamais dans un dépôt).
- **Reste à faire** : vérifier que l'écran de consentement Google est « En production » (console Google Cloud → `chkobba-770lab` → Google Auth
  Platform → Audience), sinon la connexion Google ne marche que pour les comptes de test ; essayer en vrai Google, Facebook et le mot de passe d'un
  compte e-mail importé ; prévenir Laurent ; faire installer la nouvelle appli aux testeurs (une ancienne appli reste chez Laurent).
- **Revenir en arrière** (si besoin, dans les premières heures) : `outils/bascule-firebase.mjs` avec l'ancienne configuration (dans l'historique
  git, commit `beb54c0`) ; ce que les joueurs auront écrit chez 770lab entre-temps n'y sera pas.

Ishay, 23/11 : « On va passer sur mon firebase ». Tant que la bascule n'est pas faite, le jeu reste sur `chkobba-55555` (Laurent) et
rien ne change pour les joueurs. **Seul `index.html` dépend du projet, à deux endroits** : `FB_CONFIG` (configuration web) et
`OAUTH.google` (client Google du même projet) ; `outils/bascule-firebase.mjs` les réécrit ensemble et vérifie qu'ils vont ensemble
(sans argument : l'état du jeu et de la copie de l'appli). Les adresses de retour OAuth (`https://770lab.com/chkobba/`) ne changent pas.

- **Fait le 23/11** (depuis l'iMac, outil `firebase` connecté avec chabadclub770@gmail.com) : projet **`chkobba-770lab`** (n° 565136876072),
  appli web « Chkobba site » (`1:565136876072:web:1acde55b6d503473adcb1d`), base `chkobba-770lab-default-rtdb` en europe-west1 (comme celle de
  Laurent), vide et **fermée** (règles par défaut ; lecture sans compte → 401, revérifié le 24/11). Aucun fournisseur de connexion activé.
- **Laurent a invité chabadclub770@gmail.com comme propriétaire de `chkobba-55555`** (mail Firebase du 23/11 à 19 h 10) : à accepter, connecté
  avec ce compte. Il ne doit pas publier de nouvelle version d'ici la bascule.
- **À faire par Ishay** dans la console de `chkobba-770lab` : Authentication → Commencer → activer Anonyme, Adresse e-mail / Mot de passe,
  Google (et Facebook, avec l'identifiant `1458044300724505` et la clé secrète donnée par Laurent par un canal privé) ; Paramètres →
  Domaines autorisés : `770lab.com`, `www.770lab.com`. Puis relever le **client Google** (Authentication → Google → configuration du SDK Web :
  `565136876072-….apps.googleusercontent.com`) et la **configuration web** (`firebase apps:sdkconfig WEB --project chkobba-770lab`).

**Répétition faite dans la nuit du 24 au 25/11/2026**, par une session lancée sur le MacBook Air d'Ishay (outils `firebase` et `gcloud` connectés avec
chabadclub770@gmail.com ; dossier privé `~/chkobba-demenagement`, hors git). D'après son bilan, relu depuis le cloud :
- Invitation de Laurent acceptée : chabadclub770 est propriétaire de `chkobba-55555`.
- `chkobba-770lab` : Anonyme, E-mail / Mot de passe, Google et Facebook activés (Facebook : même identifiant `1458044300724505`, clé secrète lue chez
  Laurent, jamais gardée dans un fichier) ; domaines autorisés + `770lab.com` et `www.770lab.com` ; suppression automatique des invités de plus de
  30 jours COUPÉE (elle est activée par défaut sur un projet neuf, pas chez Laurent). `identityPlatform:initializeAuth` exige la facturation : passer
  par `firebase deploy --only auth`.
- **Client Google du projet** (à donner à `outils/bascule-firebase.mjs`) : `565136876072-dn7af2rn87phd7v5ot82ar5j6atnegm0.apps.googleusercontent.com`,
  adresses de retour `https://770lab.com/chkobba/` et `https://www.770lab.com/chkobba/` déclarées. Écran de consentement Google : état « En production »
  pas encore vérifié.
- Export (lecture seule) puis import : **139 comptes, dont 136 invités et 3 Google** (20 actifs sur 7 jours) ; base et règles identiques. Les règles de
  Laurent laissent chaque joueur écrire sous `users/$uid` : **`users/$uid/rel` est déjà accepté, aucune règle à ajouter.**
- Essai du jeu en local contre `chkobba-770lab` : invité, pseudo et code ami, classement, compte e-mail créé depuis l'invité, table à deux. Pas essayé :
  Google de bout en bout (il faut le vrai site), le mot de passe d'un compte importé, Facebook.
- La base de `chkobba-770lab` contient ces essais : **elle est à refaire à neuf le jour de la bascule** (nouvel export, nouvel import).

**Les applis ne sont dans aucun magasin** (vérifié le 25/11 dans `chkobba-app`) : iPhone = TestFlight à la demande (`ios.yml`, `testflight=true`),
Android = APK de test à chaque push sur `main` (l'envoi Play « test interne » n'a jamais servi). « Le site et les applis en même temps » = environ
une heure de construction, sans validation Apple ni Google. La copie d'essai de Laurent (chkobba-55555.netlify.app) reste sur son projet tant qu'il
ne reprend pas le nouveau `FB_CONFIG`. Le jour J, `index.html` est servi avec `cache-control: max-age=600` et `sw.js` reste 4 h chez Cloudflare (`max-age=14400`) : le service worker
va chercher la page sur le réseau d'abord, donc un joueur passe sur le nouveau projet dans les dix minutes, pas tous au même instant.

Ensuite, sur un Mac où `firebase` est connecté avec chabadclub770 (l'iMac ou le MacBook Air ; jamais depuis le cloud : il faut le compte) :
1. **Exporter chez Laurent** : la base (`firebase database:get / --project chkobba-55555 -o base-laurent.json`), les comptes
   (`firebase auth:export comptes-laurent.json --format json --project chkobba-55555`, avec les paramètres de hachage des mots de passe lus dans
   la console, Authentication → Utilisateurs → ⋮) et les **règles** (console → Realtime Database → Règles ; ou
   `curl "<databaseURL>/.settings/rules.json" -H "Authorization: Bearer $(gcloud auth print-access-token)"`). Rien n'est modifié chez lui.
2. **Importer dans `chkobba-770lab`** : comptes (`firebase auth:import … --hash-algo SCRYPT …`, mêmes uid : un compte Google ou e-mail garde
   tout), base (`firebase database:set / base-laurent.json`), règles + `users/$uid/rel`. Les **invités** (connexion anonyme) ne peuvent pas
   être repris : leur jeton est celui de l'ancien projet, ils recevront un nouvel identifiant et un nouveau code ami ; leur note et leurs
   statistiques sont sur le téléphone (`P`) et remontent toutes seules (`netSaveProfile`), leurs amis sont à rattacher à la main. Les tables
   et parties en attente ne sont pas reprises (annoncer la bascule).
3. **Basculer** : `node outils/bascule-firebase.mjs config-770lab.txt <client Google>` (d'abord `--essai`), `node --check` des scripts, les essais
   (`banc.mjs`, jamais sur une vraie base), puis `npm run jeu -- ~/chkobba` dans chkobba-app. Mettre en ligne **le site et les applis en
   même temps** (une ancienne appli resterait chez Laurent : deux mondes de joueurs ; les applis affichent « autre version » si `PROTO`
   change, pas si le projet change). Laurent reprend le même `FB_CONFIG` pour sa copie d'essai.
