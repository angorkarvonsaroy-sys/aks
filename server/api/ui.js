// AKS TIZIM — xodimlar ilovasini (Index.html) serverdan berish.
// Index.html — Apps Script shabloni (<?= ?> teglari). Shu yerda to'ldiriladi va boshiga «ko'prik» skripti qo'shiladi:
// google.script.run chaqiruvlari serverning /api/rpc ga boradi — Index.html kodi o'zgarmaydi.
'use strict';
const fs = require('fs');
const env = require('../lib/env');

const MUALLIF = 'Kamoliddin Naqiyev';
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

let kesh = { mtime: 0, matn: '' };
function indexMatn() {
  let st; try { st = fs.statSync(env.uiFayl); } catch (e) { return ''; }
  if (st.mtimeMs !== kesh.mtime) kesh = { mtime: st.mtimeMs, matn: fs.readFileSync(env.uiFayl, 'utf8') };
  return kesh.matn;
}
function xaritaMatn() { try { return fs.readFileSync(env.xaritaFayl, 'utf8'); } catch (e) { return '<!-- Xarita.html serverda yo\'q -->'; } }

const SHIM = `<script>
/* AKS TIZIM — server ko'prigi: google.script.run → /api/rpc (Index.html kodi o'zgarmaydi) */
(function(){
  window.AKS_SRV=1;   // Index.html: faqat serverdagi imkoniyatlar (masalan, 👁 skan) shu bilan yoqiladi
  function run(ok,yoq,uo){
    return new Proxy({},{get:function(_,k){
      if(k==='withSuccessHandler') return function(f){return run(f,yoq,uo);};
      if(k==='withFailureHandler') return function(f){return run(ok,f,uo);};
      if(k==='withUserObject') return function(o){return run(ok,yoq,o);};
      if(typeof k!=='string') return undefined;
      return function(){
        var args=Array.prototype.slice.call(arguments);
        fetch('/api/rpc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({fn:k,args:args})})
          .then(function(r){return r.json();})
          .then(function(j){ if(j&&j.ok){ if(ok) ok(j.r,uo); } else { var e=new Error((j&&j.xato)||'Server xatosi'); if(yoq) yoq(e,uo); else console.error(e); } })
          .catch(function(e){ var x=new Error('Server bilan aloqa yo\\'q: '+e.message); if(yoq) yoq(x,uo); else console.error(x); });
      };
    }});
  }
  var p={}; new URLSearchParams(location.search).forEach(function(v,k){p[k]=v;});
  window.google={script:{run:run(null,null,null),
    url:{getLocation:function(cb){cb({parameter:p,parameters:{},hash:location.hash.slice(1)});}},
    host:{close:function(){},setHeight:function(){},setWidth:function(){},editor:{focus:function(){}}},
    history:{push:function(){},replace:function(){},setChangeHandler:function(){}}}};
})();
</script>`;

// Ilova sifatida o'rnatish (Chrome «Установить приложение» / «Добавить на главный экран»): manifest + belgi + kodni eslab qolish.
// O'rnatilgan ilova «/» dan ochiladi — kod brauzer xotirasida (aks_k) turadi. 25.10: kod FAQAT shu yerda, ya'ni ilova sahifasi muvaffaqiyatli ochilganda saqlanadi;
// ishga tushirgich (KIRISH) saqlamaydi va «Kirish taqiqlangan» sahifasi uni o'chiradi — noto'g'ri kod xotirada qolib, ilova shu sahifada qulflanib qolmasin.
const PWA_BOSH = `
<link rel="manifest" href="/manifest.json">
<meta name="theme-color" content="#0B3D2E">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="AKS TIZIM">
<link rel="icon" type="image/png" href="/favicon.png">
<link rel="apple-touch-icon" href="/icon-192.png">
<script>
(function(){ try{ var k=new URLSearchParams(location.search).get('k'); if(k) localStorage.setItem('aks_k',k); }catch(e){}
  if('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(function(){}); })();
</script>`;

// «/» kodsiz ochilganda (o'rnatilgan ilova ikonasi): saqlangan kod bo'lsa — darhol shunga; bo'lmasa — kodni so'raydi
const KIRISH = `<!DOCTYPE html><html lang="uz"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"><title>AKS TIZIM</title>
<link rel="manifest" href="/manifest.json"><meta name="theme-color" content="#0B3D2E"><link rel="icon" type="image/png" href="/favicon.png"><link rel="apple-touch-icon" href="/icon-192.png">
<style>html,body{margin:0;height:100%;background:#0B3D2E;font-family:Arial,sans-serif;color:#fff}
#e{position:fixed;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;gap:14px;padding:20px}
img{width:120px;height:120px;border-radius:26px}.n{font-size:22px;font-weight:bold;letter-spacing:.04em}.m{font-size:13px;color:#C9D8D1}
input{padding:12px;border-radius:10px;border:0;font-size:16px;width:260px;max-width:90vw}
button{padding:12px 22px;border-radius:10px;border:0;background:#D4AF5A;color:#0B3D2E;font-weight:bold;font-size:16px}
.a{position:fixed;bottom:18px;left:0;right:0;text-align:center;font-size:12px;color:#9FB8AD}</style></head><body>
<div id="e"><img src="/icon-192.png" alt=""><div class="n">AKS TIZIM</div><div class="m" id="x">Yuklanmoqda…</div></div>
<div class="a">Tizim muallifi va yaratuvchisi: <b>${MUALLIF}</b></div>
<script>
var k=''; try{ k=localStorage.getItem('aks_k')||''; }catch(e){}
if(new URLSearchParams(location.search).has('chiqish')){ try{ localStorage.removeItem('aks_k'); }catch(e){} k=''; }
if(k){ location.replace('/?k='+encodeURIComponent(k)); }
else { document.getElementById('x').innerHTML='Shaxsiy kirish kodingizni kiriting<br><br><input id="kod" type="password" placeholder="Kirish kodi" autocomplete="off"><br><br><button id="kir">Kirish</button>';
  var kir=function(){ var v=document.getElementById('kod').value.trim(); if(!v) return; location.replace('/?k='+encodeURIComponent(v)); };   // 25.10: kod tekshirilmasdan saqlanmaydi — ilova sahifasi ochilgach saqlanadi
  document.getElementById('kir').onclick=kir; document.getElementById('kod').addEventListener('keydown',function(e){ if(e.key==='Enter') kir(); }); }
if('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(function(){});
</script></body></html>`;

// doGet (Kod.gs) ning serverdagi o'rni
function sahifa(user, kod, bilet) {
  const matn = indexMatn();
  if (!matn) return null;
  const huquq = user.huquq.join(',');
  const qiymat = {
    'JSON.stringify(kod)': JSON.stringify(kod),
    'JSON.stringify(huquq)': JSON.stringify(huquq),
    "JSON.stringify(String((typeof bilet!=='undefined'&&bilet)||''))": JSON.stringify(bilet || ''),
    "include('Xarita')": xaritaMatn(),
    'ism': esc(user.fish), 'muallif': esc(MUALLIF), 'yil': String(new Date().getFullYear()),
  };
  let html = matn.replace(/<\?(!?)=\s*([\s\S]*?)\s*\?>/g, (m, raw, ifoda) => {
    if (ifoda in qiymat) return qiymat[ifoda];
    console.warn('Index.html: noma\'lum shablon ifodasi:', ifoda.slice(0, 80));
    return '';
  });
  html = html.replace(/<head>/i, '<head>\n<meta name="viewport" content="width=device-width, initial-scale=1">' + PWA_BOSH + SHIM);
  return html;
}

const TAQIQ = '<!DOCTYPE html><html lang="uz"><head><meta charset="utf-8"><title>AKS TIZIM</title></head><body>' +
  '<div style="font-family:Arial;padding:40px;text-align:center"><h2>Kirish taqiqlangan</h2>' +
  '<p>Havola noto\'g\'ri yoki eskirgan. Direktorga murojaat qiling.</p><p><a href="/?chiqish=1" style="color:#1F4E78">Boshqa kod bilan kirish</a></p>' +
  '<p style="margin-top:60px;font-size:12px;color:#667085">AKS TIZIM · Tizim muallifi va yaratuvchisi: <b>' + MUALLIF + '</b></p></div>' +
  // 25.10: noto'g'ri kod telefon xotirasida qolib ketmasin — aks holda ilova har ochilganda shu sahifaga tushib qolardi (kod kiritish oynasiga qaytib bo'lmasdi)
  '<script>try{localStorage.removeItem("aks_k");}catch(e){}</script></body></html>';
const YOQ = '<!DOCTYPE html><html lang="uz"><head><meta charset="utf-8"><title>AKS TIZIM</title></head><body style="font-family:Arial;padding:40px;text-align:center">' +
  '<h2>AKS TIZIM server ishlayapti</h2><p>Ilova fayli (Index.html) hali serverga yuklanmagan.</p></body></html>';

module.exports = { sahifa, TAQIQ, YOQ, KIRISH, indexBor: () => !!indexMatn() };
