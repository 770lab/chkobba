#!/usr/bin/env node
// Bascule du jeu d'un projet Firebase à un autre (770lab, 24/11/2026) : le jeu ne dépend du projet qu'à DEUX endroits
// de index.html, `const FB_CONFIG={…};` (configuration web du projet) et `OAUTH.google` (le client OAuth Google du MÊME
// projet, celui que Firebase crée en activant la connexion Google). Cet outil les réécrit ensemble, vérifie qu'ils vont
// bien ensemble, et change le cache de sw.js. Il ne touche à rien d'autre : ni au jeu, ni aux règles, ni aux données.
//
//   node outils/bascule-firebase.mjs                                   # état : projet et client Google du jeu (et de la copie de l'appli)
//   node outils/bascule-firebase.mjs <config> <client Google>          # bascule
//   node outils/bascule-firebase.mjs <config> <client Google> --essai  # montre ce qui changerait, sans rien écrire
//
// <config> : un fichier JSON avec apiKey, authDomain, databaseURL, projectId, storageBucket, messagingSenderId, appId,
//   ou la sortie brute de `firebase apps:sdkconfig WEB --project <projet>` (l'accolade est retrouvée dedans).
// <client Google> : « <numéro du projet>-xxxx.apps.googleusercontent.com » (console Firebase → Authentication → Google →
//   configuration du SDK Web). Son numéro doit être celui du projet (messagingSenderId), sinon Firebase refuse les jetons.
// Options : --jeu <dossier> (défaut : le dossier parent de outils/) ; --sans-sw (ne change pas sw.js).
// Ensuite : essais, puis `npm run jeu -- <dossier du jeu>` dans chkobba-app, puis la mise en ligne du site et des applis
// EN MÊME TEMPS (les anciennes versions resteraient sur l'ancien projet : deux mondes de joueurs).
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const CLES = ['apiKey', 'authDomain', 'databaseURL', 'projectId', 'storageBucket', 'messagingSenderId', 'appId'];
const args = process.argv.slice(2);
const option = (nom, valeur) => { const i = args.indexOf(nom); if (i < 0) return valeur ? null : false; if (!valeur) { args.splice(i, 1); return true; } const v = args[i + 1]; args.splice(i, 2); return v; };
const essai = option('--essai'), sansSw = option('--sans-sw');
const JEU = resolve(option('--jeu', true) || join(dirname(fileURLToPath(import.meta.url)), '..'));
const INDEX = join(JEU, 'index.html'), SW = join(JEU, 'sw.js');
const APPLI = join(JEU, '..', 'chkobba-app', 'www', 'index.html');

function echec(msg) { console.error('✗ ' + msg); process.exit(1); }
const masque = k => (typeof k === 'string' && k.length > 10) ? k.slice(0, 6) + '…' : '…';

/* Lit FB_CONFIG et OAUTH.google d'un index.html. */
function lireJeu(html) {
  const m = html.match(/^const FB_CONFIG=(\{[^\n]*\});/m);
  const g = html.match(/^const OAUTH=\{google:'([^']*)'/m);
  if (!m) echec('FB_CONFIG introuvable (attendu sur une ligne : const FB_CONFIG={…};)');
  if (!g) echec("OAUTH introuvable (attendu : const OAUTH={google:'…'");
  let cfg; try { cfg = Function('"use strict";return (' + m[1] + ')')(); } catch (e) { echec('FB_CONFIG illisible : ' + e.message); }
  return { cfg, google: g[1], ligne: m[0], lignes: html.split('\n').filter(l => l.startsWith('const FB_CONFIG=')).length,
    googles: html.split('\n').filter(l => l.startsWith('const OAUTH={google:')).length };
}

function etat() {
  const html = readFileSync(INDEX, 'utf8');
  const j = lireJeu(html);
  const v = (readFileSync(SW, 'utf8').match(/^const V='([^']*)'/m) || [])[1] || '?';
  console.log(`Jeu : ${INDEX}`);
  console.log(`  projet Firebase : ${j.cfg.projectId}  (n° ${j.cfg.messagingSenderId}, appli web ${j.cfg.appId})`);
  console.log(`  base            : ${j.cfg.databaseURL}`);
  console.log(`  connexion       : ${j.cfg.authDomain}  · clé web ${masque(j.cfg.apiKey)}`);
  console.log(`  client Google   : ${j.google}`);
  console.log(`  cache sw.js     : ${v}`);
  for (const p of verifier(j.cfg, j.google)) console.log('  ⚠ ' + p);
  if (existsSync(APPLI)) {
    const a = lireJeu(readFileSync(APPLI, 'utf8'));
    const meme = a.cfg.projectId === j.cfg.projectId && a.google === j.google;
    console.log(`Appli (${APPLI}) : projet ${a.cfg.projectId}, client ${a.google.split('-')[0]}-… → ${meme ? 'même projet que le site' : 'PAS LE MÊME PROJET QUE LE SITE : npm run jeu -- ' + JEU + ' dans chkobba-app'}`);
  }
}

/* Les contrôles qui évitent une bascule à moitié faite. Renvoie la liste des problèmes (vide = bon). */
function verifier(cfg, google) {
  const pb = [];
  for (const k of CLES) if (typeof cfg[k] !== 'string' || !cfg[k].trim()) pb.push(`${k} manquant`);
  if (pb.length) return pb;
  if (!/^[a-z0-9-]+$/.test(cfg.projectId)) pb.push(`projectId étrange : ${cfg.projectId}`);
  if (cfg.authDomain !== cfg.projectId + '.firebaseapp.com') pb.push(`authDomain ${cfg.authDomain} n'est pas ${cfg.projectId}.firebaseapp.com (domaine personnalisé ? sinon erreur)`);
  if (!/^https:\/\/[a-z0-9-]+\.(europe-west1\.firebasedatabase\.app|firebasedatabase\.app|firebaseio\.com)\/?$/.test(cfg.databaseURL)) pb.push(`databaseURL étrange : ${cfg.databaseURL}`);
  if (!cfg.databaseURL.includes(cfg.projectId)) pb.push(`databaseURL ne contient pas ${cfg.projectId}`);
  const a = cfg.appId.match(/^1:(\d+):web:[a-f0-9]+$/);
  if (!a) pb.push(`appId étrange : ${cfg.appId}`); else if (a[1] !== cfg.messagingSenderId) pb.push(`appId (projet n° ${a[1]}) et messagingSenderId (${cfg.messagingSenderId}) ne vont pas ensemble`);
  const g = String(google || '').match(/^(\d+)-[a-z0-9]+\.apps\.googleusercontent\.com$/);
  if (!g) pb.push(`client Google étrange : ${google} (attendu <numéro>-xxxx.apps.googleusercontent.com)`);
  else if (g[1] !== cfg.messagingSenderId) pb.push(`le client Google est celui du projet n° ${g[1]}, pas du projet ${cfg.projectId} (n° ${cfg.messagingSenderId}) : Firebase refuserait la connexion Google`);
  return pb;
}

function lireConfig(chemin) {
  if (!existsSync(chemin)) echec(`${chemin} introuvable`);
  const t = readFileSync(chemin, 'utf8');
  const i = t.indexOf('{'), j = t.lastIndexOf('}');
  if (i < 0 || j < i) echec(`${chemin} : aucune accolade, ce n'est ni un JSON ni la sortie de firebase apps:sdkconfig`);
  let cfg; try { cfg = JSON.parse(t.slice(i, j + 1)); } catch (e) { echec(`${chemin} : JSON illisible (${e.message})`); }
  const propre = {}; for (const k of CLES) propre[k] = typeof cfg[k] === 'string' ? cfg[k].trim() : cfg[k];
  return propre;
}

function basculer(cheminConfig, google) {
  const cfg = lireConfig(cheminConfig);
  const pb = verifier(cfg, google);
  if (pb.length) echec('rien n\'est écrit :\n✗ ' + pb.join('\n✗ '));
  const html = readFileSync(INDEX, 'utf8');
  const j = lireJeu(html);
  if (j.lignes !== 1 || j.googles !== 1) echec(`index.html : ${j.lignes} ligne(s) FB_CONFIG et ${j.googles} ligne(s) OAUTH (attendu 1 et 1)`);
  if (j.cfg.projectId === cfg.projectId && j.google === google) { console.log(`Déjà sur ${cfg.projectId} avec ce client Google : rien à faire.`); return; }
  const ligne = 'const FB_CONFIG={' + CLES.map(k => k + ':' + JSON.stringify(cfg[k])).join(',') + '};';
  let neuf = html.replace(j.ligne, ligne);
  neuf = neuf.replace(/^(const OAUTH=\{google:')[^']*(')/m, '$1' + google + '$2');
  const apres = lireJeu(neuf);
  if (apres.cfg.projectId !== cfg.projectId || apres.google !== google || neuf.length === html.length && neuf === html) echec('la réécriture n\'a pas pris');
  const pasAutre = html.replace(j.ligne, '').replace(/^(const OAUTH=\{google:')[^']*(')/m, '$1$2');
  const pasAutre2 = neuf.replace(ligne, '').replace(/^(const OAUTH=\{google:')[^']*(')/m, '$1$2');
  if (pasAutre !== pasAutre2) echec('autre chose que FB_CONFIG et OAUTH.google aurait changé : abandon');
  console.log(`${essai ? '(essai) ' : ''}index.html : ${j.cfg.projectId} → ${cfg.projectId}`);
  console.log(`  base   : ${j.cfg.databaseURL}\n       → ${cfg.databaseURL}`);
  console.log(`  appli  : ${j.cfg.appId} → ${cfg.appId}`);
  console.log(`  Google : ${j.google}\n       → ${google}`);
  console.log(`  clé web ${masque(j.cfg.apiKey)} → ${masque(cfg.apiKey)}`);
  let sw = null, vNeuf = null;
  if (!sansSw) {
    sw = readFileSync(SW, 'utf8');
    const d = new Date(), f = new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(d);
    const p = Object.fromEntries(f.map(x => [x.type, x.value]));
    vNeuf = `chkobba-${p.year}${p.month}${p.day}-${p.hour}${p.minute}`;
    if (!/^const V='chkobba-[^']*';/m.test(sw)) echec("sw.js : ligne const V='chkobba-…' introuvable");
    console.log(`  sw.js  : ${(sw.match(/^const V='([^']*)'/m) || [])[1]} → ${vNeuf}`);
  }
  if (essai) { console.log('Rien n\'a été écrit (--essai).'); return; }
  writeFileSync(INDEX, neuf);
  if (sw !== null) writeFileSync(SW, sw.replace(/^const V='chkobba-[^']*';/m, `const V='${vNeuf}';`));
  console.log('✓ écrit. Ensuite : node --check des scripts, les essais, `npm run jeu -- ' + JEU + '` dans chkobba-app, puis site + applis en même temps.');
  console.log('  Les adresses de retour OAuth (https://770lab.com/chkobba/) ne changent pas : à déclarer chez Google (client ci-dessus) et dans l\'appli Meta.');
}

if (!args.length) etat();
else if (args.length === 2) basculer(args[0], args[1]);
else echec('usage : bascule-firebase.mjs [<config> <client Google>] [--essai] [--sans-sw] [--jeu <dossier>]');
