// Chkobba : garde l'appli en mémoire pour jouer sans Internet
const V='chkobba-20261125-1552';
const FILES=['./','index.html','manifest.webmanifest','icon-192.png','icon-512.png','icon-maskable.png','apple-touch-icon.png','firebase-app-compat.js','firebase-auth-compat.js','firebase-database-compat.js'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(V).then(c=>c.addAll(FILES).then(()=>c.add('confidentialite.html').catch(()=>{}))).then(()=>self.skipWaiting()))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==V).map(x=>caches.delete(x)))).then(()=>self.clients.claim()))});
// Réseau d'abord (pour recevoir les mises à jour). Sans connexion, ou si le réseau ne répond pas en 3 secondes, on sert la copie gardée en mémoire.
// Seuls les fichiers de l'appli sont concernés : les échanges avec Firebase ne passent pas par ici.
self.addEventListener('fetch',e=>{
  const q=e.request;if(q.method!=='GET'||new URL(q.url).origin!==location.origin)return;
  e.respondWith((async()=>{
    const old=await caches.match(q,{ignoreSearch:true});
    const net=fetch(q).then(r=>{if(r&&r.ok){const cp=r.clone();caches.open(V).then(c=>c.put(q,cp))}return r});
    if(!old)return net.catch(()=>q.mode==='navigate'?caches.match('index.html').then(r=>r||Response.error()):Response.error());
    net.catch(()=>{});
    return Promise.race([net,new Promise(r=>setTimeout(()=>r(null),3000))]).then(r=>r&&r.ok?r:old).catch(()=>old);
  })());
});
