// Essai de la correction « historique face à face » (bloc correctifs-jeu de 770lab/chkobba) avec le vrai index.html,
// un faux Firebase (faux-firebase.mjs) et Chromium au format téléphone. Usage : node essais/rel.test.mjs [dossier du jeu]
// Il faut Playwright (require('playwright') doit marcher d'ici) et python3 (serveur statique). JAMAIS sur une vraie base : tout passe par le faux.
import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
import { demarrer } from './faux-firebase.mjs';

import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const JEU = process.argv[2] || join(dirname(fileURLToPath(import.meta.url)), '..');
const SITE = 8772, FAUX = 8773;
const dodo = ms => new Promise(r => setTimeout(r, ms));
let echecs = 0;
const ok = (cond, msg) => { if (cond) console.log('  ✓ ' + msg); else { echecs++; console.log('  ✗ ' + msg); } };

const faux = await demarrer(FAUX);
const http = spawn('python3', ['-m', 'http.server', String(SITE), '--bind', '127.0.0.1', '--directory', JEU], { stdio: 'ignore' });
await dodo(800);
const navigateur = await chromium.launch();
const bd = async () => (await fetch(`http://127.0.0.1:${FAUX}/db`)).json();
const ops = async () => (await fetch(`http://127.0.0.1:${FAUX}/ops`)).json();

async function ouvrir(uid) {
  const ctx = await navigateur.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: 'block',
    deviceScaleFactor: 1 });
  await ctx.addInitScript(({ url, uid }) => { localStorage.setItem('chk-mock', url); sessionStorage.setItem('chk-mock-uid', uid); }, { url: `ws://127.0.0.1:${FAUX}/?uid=${uid}`, uid });
  const page = await ctx.newPage();
  const erreurs = [];
  page.on('pageerror', e => erreurs.push(String(e && e.message || e)));
  await page.goto(`http://127.0.0.1:${SITE}/index.html`, { waitUntil: 'load' });
  await page.waitForFunction(() => typeof netBoot === 'function' && typeof startOnline === 'function', null, { timeout: 20000 });
  await page.evaluate(() => netBoot());
  await page.waitForFunction(() => typeof NET !== 'undefined' && NET.ok === true, null, { timeout: 20000 });
  return { ctx, page, erreurs };
}

try {
  console.log('1. Le bloc est bien là et enveloppe les fonctions de Laurent');
  {
    const { ctx, page, erreurs } = await ouvrir('A');
    const r = await page.evaluate(() => ({
      bloc: !!document.getElementById('correctifs-jeu') && document.getElementById('correctifs-jeu').textContent.includes('Historique « face à face »'),
      so: String(startOnline).includes('_startOnline'), ea: String(eloAbandon).includes('_eloAbandon'),
      ns: String(netSaveProfile).includes('_netSaveProfile'), pc: String(profFromCloud).includes('_profFromCloud'), uid: NET.uid, kind: NET.kind }));
    ok(r.bloc, 'le commentaire du correctif est dans le bloc correctifs-jeu');
    ok(r.so && r.ea && r.ns && r.pc, 'startOnline, eloAbandon, netSaveProfile et profFromCloud sont enveloppés');
    ok(r.uid === 'A' && r.kind === 'mock', 'connecté au faux Firebase comme A');
    ok(erreurs.length === 0, 'aucune erreur de page au chargement' + (erreurs.length ? ' : ' + erreurs.join(' | ') : ''));

    console.log('2. P.rel part dans users/A/rel, à part du profil, seulement quand il change');
    const avant = (await ops()).filter(o => o.path === 'users/A/rel').length;
    await page.evaluate(() => { rel('B').wa = 3; rel('B').la = 1; savePrefs(); netSaveProfile(); netSaveProfile(); });
    await dodo(400);
    let base = await bd();
    ok(base.users && base.users.A && base.users.A.elo !== undefined, 'le profil de A est enregistré (elo présent)');
    assert.deepEqual(base.users.A.rel, { B: { wp: 0, lp: 0, wa: 3, la: 1 } });
    ok(true, 'users/A/rel = ' + JSON.stringify(base.users.A.rel));
    let n = (await ops()).filter(o => o.path === 'users/A/rel').length - avant;
    ok(n === 1, `deux appels de netSaveProfile → ${n} écriture(s) de rel (attendu 1)`);
    const parProfil = (await ops()).filter(o => o.op === 'update' && o.path.startsWith('users/A/') && o.path.endsWith('/rel')).length;
    ok(parProfil === 0, 'rel ne passe jamais par le update du profil (règle Firebase à part)');
    await page.evaluate(() => { rel('B').wa = 4; netSaveProfile(); });
    await dodo(300);
    n = (await ops()).filter(o => o.path === 'users/A/rel').length - avant;
    base = await bd();
    ok(n === 2 && base.users.A.rel.B.wa === 4, 'un changement → une nouvelle écriture (wa = 4)');
    await ctx.close();
  }

  console.log('3. Un autre appareil du même compte retrouve l\'historique (profFromCloud fusionne)');
  {
    const { ctx, page, erreurs } = await ouvrir('A');
    const r = await page.evaluate(async () => {
      const vide = P.rel && Object.keys(P.rel).length;
      rel('B').wa = 5; rel('C').wp = 2; savePrefs();
      const v = await NET.get('users/' + NET.uid);
      profFromCloud(v);
      const local = JSON.parse(localStorage.getItem('chkobba-prefs2') || '{}');
      return { vide, rel: JSON.parse(JSON.stringify(P.rel)), vRel: v && v.rel, localB: local.rel && local.rel.B };
    });
    ok(!r.vide, 'appareil neuf : aucun historique local au départ');
    ok(r.vRel && r.vRel.B && r.vRel.B.wa === 4, 'le nuage contient B (wa 4, la 1)');
    assert.deepEqual(r.rel.B, { wp: 0, lp: 0, wa: 5, la: 1 });
    ok(true, 'B fusionné : wa = max(5, 4) = 5, la = 1 repris du nuage');
    ok(r.rel.C && r.rel.C.wp === 2, 'C (seulement local) est gardé');
    ok(r.localB && r.localB.wa === 5 && r.localB.la === 1, 'la fusion est enregistrée sur l\'appareil (savePrefs)');
    const r2 = await page.evaluate(() => {
      let err = null; try { profFromCloud({ name: 'x', elo: 1000, rel: { B: { wa: 'zz', lp: 2.7 }, D: null, E: 'texte', F: { wa: -3 } } }); } catch (e) { err = String(e); }
      return { err, rel: JSON.parse(JSON.stringify(P.rel)) };
    });
    ok(!r2.err, 'un rel abîmé dans le nuage ne casse rien');
    ok(r2.rel.B.wa === 5 && r2.rel.B.lp === 2 && !('D' in r2.rel) && !('E' in r2.rel) && !('F' in r2.rel) || (r2.rel.F && r2.rel.F.wa === 0),
      'valeurs abîmées ignorées (wa « zz » → inchangé, lp 2.7 → 2, D/E ignorés, F -3 → 0) : ' + JSON.stringify(r2.rel));
    ok(erreurs.length === 0, 'aucune erreur de page' + (erreurs.length ? ' : ' + erreurs.join(' | ') : ''));

    console.log('4. Un abandon compte une défaite pour chaque joueur réel de la table');
    const r3 = await page.evaluate(() => {
      const avant = P.elo, laB = rel('B').la;
      P.pend = { code: 'T1', at: Date.now(), partner: null, opp: [{ r: 1000, human: true }], hum: true, uids: [null, 'B'] };
      const d = eloAbandon(P.pend, 1.25);
      const laB2 = rel('B').la;
      P.pend = { code: 'T2', at: Date.now(), partner: 1000, opp: [{ r: 1000, human: true }, { r: 1000, human: false }], hum: true, uids: ['A', 'B', 'C', null] };
      const d2 = eloAbandon(P.pend, 1.25);
      let err = null; try { eloAbandon({ partner: null, opp: [{ r: 1000, human: true }] }, 1); } catch (e) { err = String(e); }
      return { avant, apres: P.elo, d, d2, laB, laB2, rel: JSON.parse(JSON.stringify(P.rel)), err };
    });
    ok(r3.d < 0 && r3.apres < r3.avant, `la note baisse comme avant (${r3.avant} → ${r3.apres})`);
    ok(r3.laB2 === r3.laB + 1, `à 2 : B gagne une victoire sur moi (la ${r3.laB} → ${r3.laB2})`);
    ok(r3.rel.B.la === r3.laB + 2, 'à 4 : B (adversaire) encore +1');
    ok(r3.rel.C && r3.rel.C.lp === 1 && r3.rel.C.la === 0, 'à 4 : C (partenaire) une partie perdue ensemble (lp 1)');
    ok(!('A' in r3.rel) && !('null' in r3.rel), 'ni moi-même ni l\'ordinateur dans l\'historique');
    ok(!r3.err && r3.d2 < 0, 'une partie en attente d\'avant (sans uids) passe sans erreur');
    await dodo(400);
    const base = await bd();
    ok(base.users.A.rel.B.la === r3.laB + 2 && base.users.A.rel.C.lp === 1, 'et le nuage a reçu le nouvel historique');
    await ctx.close();
  }

  console.log('5. startOnline retient qui est à la table (P.pend.uids)');
  {
    const { ctx, page, erreurs } = await ouvrir('A');
    const r = await page.evaluate(async () => {
      const g = { host: 'A', mode: 'c2', target: 11, napola: false, ecart: false, dealer: 0,
        seats: [{ kind: 'human', uid: 'A', name: 'Moi', elo: 1000, c: '#e0a526', av: null }, { kind: 'human', uid: 'B', name: 'Bob', elo: 1000, c: '#3d8bfd', av: null }] };
      await NET.set('tables/T9/game', g);
      let err = null; try { startOnline(g, 'T9', false); } catch (e) { err = String(e && e.stack || e); }
      await new Promise(r => setTimeout(r, 300));
      const local = JSON.parse(localStorage.getItem('chkobba-prefs2') || '{}');
      return { err, pend: P.pend && JSON.parse(JSON.stringify(P.pend)), localUids: local.pend && local.pend.uids, seatUid: S && S.seatUid };
    });
    ok(!r.err, 'startOnline passe' + (r.err ? ' : ' + r.err.split('\n')[0] : ''));
    ok(r.pend && r.pend.code === 'T9' && r.pend.hum === true, 'P.pend de Laurent inchangé (code, hum)');
    assert.deepEqual(r.pend && r.pend.uids, ['A', 'B']);
    ok(true, 'P.pend.uids = ' + JSON.stringify(r.pend && r.pend.uids) + ' (même ordre que S.seatUid ' + JSON.stringify(r.seatUid) + ')');
    assert.deepEqual(r.localUids, ['A', 'B']);
    ok(true, 'enregistré sur l\'appareil (une reprise après fermeture retrouve les sièges)');
    const g4 = await page.evaluate(async () => {
      const g = { host: 'A', mode: 'c4', target: 11, napola: false, ecart: false, dealer: 1,
        seats: [{ kind: 'human', uid: 'A', name: 'Moi', elo: 1000, c: '#e0a526', av: null }, { kind: 'cpu', lvl: 'moyen', name: 'Sami', c: '#e07a5f', elo: 1000 },
          { kind: 'human', uid: 'C', name: 'Cl', elo: 1000, c: '#2a9d8f', av: null }, { kind: 'human', uid: 'D', name: 'Dj', elo: 1000, c: '#c75b9b', av: null }] };
      try { leaveOnline(); } catch (e) {}
      let err = null; try { startOnline(g, 'T4', false); } catch (e) { err = String(e); }
      return { err, uids: P.pend && P.pend.uids, seatUid: S && S.seatUid };
    });
    ok(!g4.err && Array.isArray(g4.uids) && g4.uids.length === 4 && g4.uids[0] === 'A' && g4.uids[1] === null && g4.uids.includes('C') && g4.uids.includes('D'),
      'à 4 avec un ordinateur : uids = ' + JSON.stringify(g4.uids) + ' (ordinateur = null), sièges ' + JSON.stringify(g4.seatUid));
    ok(erreurs.length === 0, 'aucune erreur de page' + (erreurs.length ? ' : ' + erreurs.join(' | ') : ''));
    await ctx.close();
  }
} catch (e) {
  echecs++; console.log('  ✗ exception : ' + (e && e.stack || e));
} finally {
  await navigateur.close(); http.kill(); await faux.fermer().catch(() => {});
}
console.log(echecs ? `\n${echecs} ÉCHEC(S)` : '\nTOUT PASSE');
process.exit(echecs ? 1 : 0);
