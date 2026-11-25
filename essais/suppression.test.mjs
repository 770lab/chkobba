// Essais de « Supprimer mon profil » et du son rendu quand on quitte le jeu (bloc correctifs-jeu), avec le vrai index.html,
// le faux Firebase (faux-firebase.mjs) et Chromium au format téléphone. Usage : node essais/suppression.test.mjs [dossier du jeu]
// JAMAIS sur une vraie base : tout passe par le faux (le faux n'applique pas les règles ; elles sont relues à part).
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { demarrer } from './faux-firebase.mjs';
const { chromium } = createRequire(import.meta.url)('playwright');

const JEU = process.argv[2] || join(dirname(fileURLToPath(import.meta.url)), '..');
const SITE = 8782, FAUX = 8783;
const dodo = ms => new Promise(r => setTimeout(r, ms));
let echecs = 0;
const ok = (cond, msg) => { if (cond) console.log('  ✓ ' + msg); else { echecs++; console.log('  ✗ ' + msg); } };

const faux = await demarrer(FAUX);
const http = spawn('python3', ['-m', 'http.server', String(SITE), '--bind', '127.0.0.1', '--directory', JEU], { stdio: 'ignore' });
await dodo(800);
const navigateur = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
const bd = async () => (await fetch(`http://127.0.0.1:${FAUX}/db`)).json();
const ops = async () => (await fetch(`http://127.0.0.1:${FAUX}/ops`)).json();
const reset = () => fetch(`http://127.0.0.1:${FAUX}/reset`);

async function ouvrir(uid, prefs) {
  const ctx = await navigateur.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
  await ctx.route('**/*', r => { const u = new URL(r.request().url()); return (u.hostname === '127.0.0.1' || u.protocol === 'data:' || u.protocol === 'blob:') ? r.continue() : r.abort(); });
  await ctx.addInitScript(({ url, uid, prefs }) => { localStorage.setItem('chk-mock', url); sessionStorage.setItem('chk-mock-uid', uid); if (prefs && !localStorage.getItem('chkobba-prefs2')) localStorage.setItem('chkobba-prefs2', JSON.stringify(prefs)); },
    { url: `ws://127.0.0.1:${FAUX}/?uid=${uid}`, uid, prefs: prefs || null });
  const page = await ctx.newPage();
  const erreurs = [];
  page.on('pageerror', e => erreurs.push(String(e && e.message || e)));
  await page.goto(`http://127.0.0.1:${SITE}/index.html`, { waitUntil: 'load' });
  await page.waitForFunction(() => typeof netBoot === 'function' && typeof renderProf === 'function', null, { timeout: 20000 });
  await page.evaluate(() => netBoot());
  await page.waitForFunction(() => typeof NET !== 'undefined' && NET.ok === true && !!P.myCode, null, { timeout: 20000 });
  return { ctx, page, erreurs };
}
const boite = page => page.evaluate(() => { const o = document.getElementById('ovAsk'); return o && o.classList.contains('on') ? document.getElementById('askPanel').innerText.replace(/\s+/g, ' ').trim() : null; });
async function attendreBoite(page, mot) { await page.waitForFunction(m => { const o = document.getElementById('ovAsk'); return o && o.classList.contains('on') && document.getElementById('askPanel').innerText.includes(m); }, mot, { timeout: 15000 }); }
/* une vieille semaine et le trimestre en cours : des lignes de classement que le joueur a pu laisser */
const semer = (page) => page.evaluate(async () => {
  const u = NET.uid, per = perGet();
  await NET.set('users/' + u + '/friends/B', true); await NET.set('users/B/friends/' + u, true); await NET.set('users/B/name', 'Bob');
  await NET.set('users/C/friends/' + u, true); await NET.set('users/' + u + '/friends/C', true);
  await NET.set('users/' + u + '/rel', { B: { wp: 0, lp: 0, wa: 2, la: 1 } });
  await NET.set('board/' + u, { name: 'Moi', elo: 1010, g: 3, w: 2, at: 1 });
  await NET.set('lb/wk/2026-S45/' + u, { name: 'Moi', elo: 1010, g: 1, w: 1, d: 10, at: 1 });
  await NET.set('lb/wk/' + per.wk.id + '/' + u, { name: 'Moi', elo: 1010, g: 1, w: 1, d: 10, at: 1 });
  await NET.set('lb/mo/2026-10/' + u, { name: 'Moi', elo: 1010, g: 1, w: 1, d: 10, at: 1 });
  await NET.set('lb/qt/' + per.qt.id + '/' + u, { name: 'Moi', elo: 1010, g: 1, w: 1, d: 10, at: 1 });
  await NET.set('lb/yr/' + per.yr.id + '/' + u, { name: 'Moi', elo: 1010, g: 1, w: 1, d: 10, at: 1 });
  await NET.set('lb/wk/2026-S45/B', { name: 'Bob', elo: 1000, g: 1, w: 0, d: 0, at: 1 });
  await NET.set('board/B', { name: 'Bob', elo: 1000, g: 1, w: 0, at: 1 });
  await NET.set('names/moi770', u); P.nameKey = 'moi770'; P.nameUid = u; P.seats.me = 'Moi770'; P.elo = 1010; P.stats = { g: 3, w: 2 }; P.rel = { B: { wp: 0, lp: 0, wa: 2, la: 1 } }; savePrefs();
  await NET.set('status/' + u, { on: true, at: 1 });
  return { code: P.myCode };
});

try {
  console.log('1. Le bouton est dans « Mon profil »');
  await reset();
  {
    const { ctx, page, erreurs } = await ouvrir('A');
    const semis = await semer(page);
    await page.evaluate(() => openProf());
    await dodo(300);
    const b = await page.evaluate(() => { const x = document.querySelectorAll('#profPanel [data-suppr]'); return { n: x.length, texte: x[0] && x[0].textContent, dernier: x[0] && x[0].closest('#profPanel').lastElementChild.contains(x[0]) }; });
    ok(b.n === 1 && /Supprimer mon profil/.test(b.texte) && b.dernier, `un seul bouton, à la fin du profil : « ${b.texte} »`);
    await page.evaluate(() => { renderProf(); renderProf(); });
    ok(await page.evaluate(() => document.querySelectorAll('#profPanel [data-suppr]').length) === 1, 'toujours un seul bouton après plusieurs affichages');

    console.log('2. Annuler ne supprime rien');
    await page.locator('[data-suppr]').click();
    await attendreBoite(page, 'Supprimer mon profil ?');
    ok(/effacés pour de bon/.test(await boite(page)), 'la première question dit ce qui sera effacé');
    await page.locator('#askNo').click(); await dodo(200);
    await page.locator('[data-suppr]').click(); await attendreBoite(page, 'Supprimer mon profil ?'); await page.locator('#askOk').click();
    await attendreBoite(page, 'Dernière confirmation'); await page.locator('#askNo').click(); await dodo(300);
    let base = await bd();
    ok(base.users.A && base.users.A.friends && base.users.B.friends.A === true && base.board.A && base.names.moi770 === 'A', 'après deux annulations, tout est encore là');

    console.log('3. Pas pendant une partie en ligne');
    await page.evaluate(() => { P.pend = { code: 'T1', at: Date.now(), partner: null, opp: [{ r: 1000, human: true }], hum: true }; });
    await page.locator('[data-suppr]').click(); await attendreBoite(page, 'Partie en ligne en cours'); await page.locator('#askNo').click(); await dodo(200);
    base = await bd(); ok(!!base.users.A && !!base.board.A, 'refusé, rien n\'est effacé');
    await page.evaluate(() => { P.pend = null; });

    console.log('4. Si la fiche ne part pas, on s\'arrête et on le dit');
    await page.evaluate(() => { window.__rm = NET.remove; NET.remove = p => p === 'users/' + NET.uid ? Promise.reject(new Error('refus')) : window.__rm(p); window.__out = 0; NET.signOut = async () => { window.__out++; NET.uid = 'A2'; }; });
    await page.locator('[data-suppr]').click(); await attendreBoite(page, 'Supprimer mon profil ?'); await page.locator('#askOk').click();
    await attendreBoite(page, 'Dernière confirmation'); await page.locator('#askOk').click();
    await attendreBoite(page, 'n\'a pas abouti'); await page.locator('#askNo').click(); await dodo(200);
    const e4 = await page.evaluate(() => ({ out: window.__out, nom: P.seats.me, uid: NET.uid, occupe: PF.busy }));
    base = await bd();
    ok(e4.out === 0 && e4.uid === 'A' && e4.nom === 'Moi770' && !!base.users.A, 'pas de déconnexion, le profil est gardé sur l\'appareil et dans la base');
    ok(e4.occupe === false, 'le profil n\'est pas resté bloqué en « suppression en cours »');
    await page.evaluate(() => { NET.remove = window.__rm; });
    await semer(page);

    console.log('5. La suppression efface tout ce qui porte le joueur');
    const avant = (await ops()).length;
    await page.locator('[data-suppr]').click(); await attendreBoite(page, 'Supprimer mon profil ?'); await page.locator('#askOk').click();
    await attendreBoite(page, 'Dernière confirmation'); await page.locator('#askOk').click();
    await attendreBoite(page, 'Profil supprimé');
    const texte = await boite(page); await page.locator('#askNo').click(); await dodo(500);
    base = await bd(); const faits = (await ops()).slice(avant);
    ok(!base.users.A, 'users/A (profil, amis, invitations, historique) n\'existe plus');
    ok(!(base.users.B.friends && base.users.B.friends.A) && !(base.users.C && base.users.C.friends && base.users.C.friends.A), 'A a disparu de la liste d\'amis de B et de C');
    ok(base.users.B.name === 'Bob' && base.board.B && base.lb.wk['2026-S45'].B, 'les autres joueurs ne sont pas touchés (fiche, classement)');
    ok(!base.board.A, 'plus de ligne au classement général');
    const lbA = JSON.stringify(base.lb).includes('"A":');
    ok(!lbA, 'plus aucune ligne dans les classements par période (semaine ancienne, mois ancien, trimestre, année)');
    ok(!(base.names && base.names.moi770), 'le pseudo réservé est libéré');
    ok(!(base.status && base.status.A), 'la présence est effacée');
    ok(base.codes && base.codes[semis.code] === 'A', 'le code ami reste (les règles ne laissent pas le joueur l\'effacer) : il ne contient que l\'identifiant');
    const nLb = faits.filter(o => o.op === 'remove' && o.path.startsWith('lb/')).length;
    ok(nLb >= 8 && nLb < 400, `${nLb} effacements de classements par période tentés (toutes les périodes depuis octobre 2026)`);
    const e5 = await page.evaluate(() => ({ out: window.__out, uid: NET.uid, nom: P.seats.me, elo: P.elo, rel: Object.keys(P.rel || {}).length, g: P.stats.g, code: P.myCode, occupe: PF.busy,
      bouton: document.querySelectorAll('#profPanel [data-suppr]').length }));
    ok(e5.out === 1 && e5.uid === 'A2', 'déconnecté une fois, l\'appareil a un nouvel identifiant');
    ok(e5.nom === '' && e5.elo === 1000 && e5.g === 0 && e5.rel === 0, 'le profil de l\'appareil est remis à neuf (pseudo, note, parties, historique)');
    ok(!!e5.code && e5.code !== semis.code && !!base.users.A2, 'un profil invité neuf repart, avec un autre code ami');
    ok(/Profil supprimé/.test(texte) && !/n'ont pas pu/.test(texte) && !/n'a pas pu/.test(texte), 'message final sans réserve : « ' + texte.slice(0, 80) + '… »');
    ok(e5.occupe === false && e5.bouton === 1, 'le profil est de nouveau utilisable');
    ok(erreurs.length === 0, 'aucune erreur de page' + (erreurs.length ? ' : ' + erreurs.join(' | ') : ''));
    await ctx.close();
  }

  console.log('6. Le son est rendu quand on quitte le jeu, et revient au toucher suivant');
  {
    const { ctx, page, erreurs } = await ouvrir('S');
    await page.mouse.click(200, 400); await dodo(300);
    const a = await page.evaluate(() => ({ son: !!P.sound, boucle: !!IOSAUD, joue: !!IOSAUD && !IOSAUD.paused, moteur: AC && AC.state }));
    ok(a.son && a.boucle, `après un toucher : la boucle muette existe (elle joue : ${a.joue}), moteur de sons « ${a.moteur} »`);
    const cacher = v => page.evaluate(v => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => v }); Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => v ? 'hidden' : 'visible' }); document.dispatchEvent(new Event('visibilitychange')); }, v);
    await page.evaluate(() => { window.__boucle = IOSAUD; });
    await cacher(true); await dodo(400);
    const b = await page.evaluate(() => ({ boucle: IOSAUD, pause: window.__boucle.paused, src: window.__boucle.getAttribute('src'), moteur: AC && AC.state }));
    ok(b.boucle === null && b.pause === true && !b.src, 'page cachée : la boucle est arrêtée, vidée et jetée');
    ok(b.moteur === 'suspended' || b.moteur == null, `page cachée : moteur de sons « ${b.moteur} »`);
    await cacher(false); await dodo(400);
    const c = await page.evaluate(() => ({ boucle: IOSAUD, moteur: AC && AC.state }));
    ok(c.boucle === null, 'au retour, rien ne rejoue tout seul');
    ok(c.moteur === 'running' || c.moteur == null, `au retour, le jeu relance son moteur de sons : « ${c.moteur} »`);
    await page.mouse.click(200, 400); await dodo(300);
    const d = await page.evaluate(() => ({ boucle: !!IOSAUD, autre: IOSAUD !== window.__boucle }));
    ok(d.boucle && d.autre, 'au toucher suivant, une nouvelle boucle est créée : les sons reviennent');
    await page.evaluate(() => { P.sound = false; }); await cacher(true); await dodo(200); await cacher(false); await page.mouse.click(200, 400); await dodo(200);
    ok(await page.evaluate(() => IOSAUD === null), 'sons coupés dans les réglages : aucune boucle n\'est recréée');
    await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
    ok(erreurs.length === 0, 'aucune erreur de page' + (erreurs.length ? ' : ' + erreurs.join(' | ') : ''));
    await ctx.close();
  }

  console.log('7. « Signaler ce joueur » sur la fiche d\'un autre joueur');
  await reset();
  {
    const { ctx, page, erreurs } = await ouvrir('M');
    await page.evaluate(async () => { await NET.set('users/B', { name: 'Bob <b>', elo: 1040, g: 5, w: 3, st: { g: 5, w: 3, chk: 2 } }); });
    await page.evaluate(() => openCompare('B'));
    await attendreBoite(page, 'Toi et Bob');
    const l = await page.evaluate(() => { const a = document.querySelector('#askPanel [data-signal]'); return a ? { texte: a.textContent, href: a.getAttribute('href'), avantBoutons: !!(a.closest('p').nextElementSibling && a.closest('p').nextElementSibling.classList.contains('stack')), html: a.closest('p').innerHTML } : null; });
    ok(!!l && l.texte === 'Signaler ce joueur' && l.avantBoutons, 'le lien est sur la fiche, au-dessus du bouton Fermer');
    const corps = l ? decodeURIComponent(l.href.split('body=')[1] || '') : '';
    ok(!!l && l.href.startsWith('mailto:contact@770lab.com?subject=') && corps.includes('Bob <b>') && corps.includes('identifiant B') && /Mon code ami : [A-Z0-9]{6}/.test(corps), 'l\'e-mail part à contact@770lab.com avec le pseudo, l\'identifiant du joueur et mon code ami');
    ok(!!l && !l.html.includes('<b>'), 'un pseudo contenant du code n\'est pas interprété dans la page');
    await page.locator('#askNo').click(); await dodo(200);
    await page.evaluate(() => openCompare('B')); await attendreBoite(page, 'Toi et Bob');
    ok(await page.evaluate(() => document.querySelectorAll('#askPanel [data-signal]').length) === 1, 'un seul lien à chaque ouverture');
    await page.locator('#askNo').click(); await dodo(200);
    await page.evaluate(() => openCompare('inconnu-zzz')); await dodo(600);
    ok(await page.evaluate(() => !document.querySelector('#askPanel [data-signal]') || !document.getElementById('ovAsk').classList.contains('on')), 'joueur introuvable : pas de fiche, pas de lien');
    ok((await ops()).filter(o => /signal|report/i.test(o.path)).length === 0, 'rien n\'est écrit dans la base');
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
