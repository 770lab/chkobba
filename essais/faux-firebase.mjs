// Faux Firebase pour le jeu Chkobba : répond aux opérations de initMock (localStorage 'chk-mock' = ws://…) sans aucune
// dépendance (WebSocket écrit à la main). En plus : GET /db (la base), GET /ops (les écritures reçues), GET /reset.
import { createServer } from 'node:http';
import { createHash } from 'node:crypto';

const GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';

export function demarrer(port = 8773) {
  let db = {};
  const ops = [];
  const prises = new Set();

  const parts = p => String(p).split('/').filter(Boolean);
  const norm = v => (v === undefined || v === null) ? null
    : (v && typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length === 0) ? null : v;
  const lire = path => { let o = db; for (const k of parts(path)) { if (o == null || typeof o !== 'object') return null; o = o[k]; } return norm(o === undefined ? null : o); };
  function nettoyer(o) {
    if (!o || typeof o !== 'object' || Array.isArray(o)) return o;
    for (const k of Object.keys(o)) { nettoyer(o[k]); if (o[k] == null || (typeof o[k] === 'object' && !Array.isArray(o[k]) && Object.keys(o[k]).length === 0)) delete o[k]; }
    return o;
  }
  function ecrire(path, val, op) {
    ops.push({ op, path, val: val == null ? null : JSON.parse(JSON.stringify(val)) });
    const ps = parts(path);
    if (!ps.length) { db = val == null ? {} : JSON.parse(JSON.stringify(val)); }
    else {
      let o = db;
      for (let i = 0; i < ps.length - 1; i++) { if (o[ps[i]] == null || typeof o[ps[i]] !== 'object') o[ps[i]] = {}; o = o[ps[i]]; }
      if (val == null) delete o[ps[ps.length - 1]]; else o[ps[ps.length - 1]] = JSON.parse(JSON.stringify(val));
    }
    nettoyer(db);
    notifier();
  }
  function notifier() {
    for (const p of prises) for (const s of p.subs.values()) {
      if (s.kind === 'value') { const v = lire(s.path), j = JSON.stringify(v); if (j !== s.last) { s.last = j; p.envoyer({ ev: 'value', id: s.sid, val: v }); } }
      else { const v = lire(s.path); if (v && typeof v === 'object') for (const k of Object.keys(v)) if (!s.vus.has(k)) { s.vus.add(k); p.envoyer({ ev: 'child', id: s.sid, key: k, val: v[k] }); } }
    }
  }

  const serveur = createServer((req, res) => {
    const u = new URL(req.url, 'http://x');
    res.setHeader('Access-Control-Allow-Origin', '*');
    if (u.pathname === '/db') { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(db)); return; }
    if (u.pathname === '/ops') { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(ops)); return; }
    if (u.pathname === '/reset') { db = {}; ops.length = 0; res.end('ok'); return; }
    res.statusCode = 404; res.end('?');
  });

  serveur.on('upgrade', (req, socket, head) => {
    const key = req.headers['sec-websocket-key'];
    if (!key) { socket.destroy(); return; }
    const accept = createHash('sha1').update(key + GUID).digest('base64');
    socket.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ' + accept + '\r\n\r\n');
    const u = new URL(req.url, 'http://x');
    const prise = { uid: u.searchParams.get('uid') || ('u' + Math.random().toString(36).slice(2, 8)), subs: new Map(), disc: [], reste: Buffer.alloc(0),
      envoyer(o) { try { socket.write(trame(1, Buffer.from(JSON.stringify(o)))); } catch (e) {} } };
    prises.add(prise);
    const traiter = texte => {
      let q; try { q = JSON.parse(texte); } catch (e) { return; }
      const res = val => prise.envoyer({ ev: 'res', rid: q.rid, val });
      switch (q.op) {
        case 'auth': res(prise.uid); break;
        case 'get': res(lire(q.path)); break;
        case 'set': ecrire(q.path, q.val, 'set'); res(true); break;
        case 'update': if (q.val && typeof q.val === 'object') for (const k of Object.keys(q.val)) ecrire(q.path + '/' + k, q.val[k], 'update'); res(true); break;
        case 'remove': ecrire(q.path, null, 'remove'); res(true); break;
        case 'putIfAbsent': if (lire(q.path) === null) { ecrire(q.path, q.val, 'putIfAbsent'); res(true); } else res(false); break;
        case 'sub': { const s = { sid: q.sid, path: q.path, kind: q.kind, last: undefined, vus: new Set() }; prise.subs.set(q.sid, s); notifier(); break; }
        case 'unsub': prise.subs.delete(q.sid); break;
        case 'onDisc': prise.disc.push([q.path, q.val]); res(true); break;
        default: res(null);
      }
    };
    const recevoir = chunk => {
      prise.reste = Buffer.concat([prise.reste, chunk]);
      const [msgs, reste] = trames(prise.reste); prise.reste = reste;
      for (const m of msgs) {
        if (m.op === 1) traiter(m.data.toString('utf8'));
        else if (m.op === 8) { try { socket.write(trame(8, Buffer.alloc(0))); } catch (e) {} socket.end(); }
        else if (m.op === 9) { try { socket.write(trame(10, m.data)); } catch (e) {} }
      }
    };
    if (head && head.length) recevoir(head);
    socket.on('data', recevoir);
    socket.on('close', () => { prises.delete(prise); for (const [p, v] of prise.disc) ecrire(p, v, 'onDisc'); });
    socket.on('error', () => {});
  });

  return new Promise(res => serveur.listen(port, '127.0.0.1', () => res({ serveur, lire, ecrire, db: () => db, ops, fermer: () => new Promise(r => { for (const p of prises) {} serveur.close(() => r()); }) })));
}

function trames(buf) {
  const out = []; let i = 0;
  while (i + 2 <= buf.length) {
    const b0 = buf[i], b1 = buf[i + 1], op = b0 & 0x0f, mask = (b1 & 0x80) !== 0; let len = b1 & 0x7f, j = i + 2;
    if (len === 126) { if (j + 2 > buf.length) break; len = buf.readUInt16BE(j); j += 2; }
    else if (len === 127) { if (j + 8 > buf.length) break; len = Number(buf.readBigUInt64BE(j)); j += 8; }
    let key = null; if (mask) { if (j + 4 > buf.length) break; key = buf.subarray(j, j + 4); j += 4; }
    if (j + len > buf.length) break;
    const data = Buffer.from(buf.subarray(j, j + len)); if (key) for (let k = 0; k < data.length; k++) data[k] ^= key[k & 3];
    out.push({ op, data }); i = j + len;
  }
  return [out, buf.subarray(i)];
}
function trame(op, data) {
  const len = data.length; let h;
  if (len < 126) h = Buffer.from([0x80 | op, len]);
  else if (len < 65536) { h = Buffer.alloc(4); h[0] = 0x80 | op; h[1] = 126; h.writeUInt16BE(len, 2); }
  else { h = Buffer.alloc(10); h[0] = 0x80 | op; h[1] = 127; h.writeBigUInt64BE(BigInt(len), 2); }
  return Buffer.concat([h, data]);
}

if (import.meta.url === 'file://' + process.argv[1]) demarrer(+(process.argv[2] || 8773)).then(() => console.log('faux Firebase sur ws://127.0.0.1:' + (process.argv[2] || 8773)));
