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
<link rel="manifest" href="/manifest.json" id="aksMan">
<meta name="theme-color" content="#0B3D2E">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="AKS TIZIM">
<link rel="icon" type="image/png" href="/favicon.png">
<link rel="apple-touch-icon" href="/icon-192.png">
<script>
(function(){ try{ var k=new URLSearchParams(location.search).get('k'); if(k){ localStorage.setItem('aks_k',k);
    var mn=document.getElementById('aksMan'); if(mn) mn.href='/manifest.json?k='+encodeURIComponent(k); } }catch(e){}   // 25.10: yorliq kod bilan o'rnatilsin
  if('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(function(){}); })();
</script>`;

// «/» kodsiz ochilganda (o'rnatilgan ilova ikonasi): saqlangan kod bo'lsa — darhol shunga; bo'lmasa — kodni so'raydi.
// 25.10 (direktor ko'rsatmasi): kod to'g'ri kelmasa ham AYNAN SHU sahifa qaytadi — qizil izoh bilan, kod maydoni joyida.
// Oldin «Kirish taqiqlangan» degan boshi berk sahifa chiqardi va qayta kod kiritish imkoni yo'q edi.
// «Kodimni unutdim» — Telegram botga o'tadi (/start kod), bot yangi kod yuboradi (lib/tg_kirish.js kodYubor).
const TG_BOT = 'aks_karvon_bot';
function kirishSahifa(xato) {
  return `<!DOCTYPE html><html lang="uz"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"><title>AKS TIZIM</title>
<link rel="manifest" href="/manifest.json"><meta name="theme-color" content="#0B3D2E"><link rel="icon" type="image/png" href="/favicon.png"><link rel="apple-touch-icon" href="/icon-192.png">
<style>html,body{margin:0;height:100%;background:#0B3D2E;font-family:Arial,sans-serif;color:#fff}
#e{position:fixed;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;gap:12px;padding:20px}
img{width:96px;height:96px;border-radius:22px}.n{font-size:22px;font-weight:bold;letter-spacing:.04em}.m{font-size:13px;color:#C9D8D1}
.xa{font-size:14px;color:#FFD7D0;background:#7F1D1D;border-radius:10px;padding:10px 14px;max-width:320px;line-height:1.45}
input{padding:13px;border-radius:10px;border:0;font-size:17px;width:280px;max-width:88vw;letter-spacing:.06em}
button{padding:13px 26px;border-radius:10px;border:0;background:#D4AF5A;color:#0B3D2E;font-weight:bold;font-size:17px}
a.u{color:#C9D8D1;font-size:13px;text-decoration:underline}
.a{position:fixed;bottom:14px;left:0;right:0;text-align:center;font-size:12px;color:#9FB8AD}</style></head><body>
<div id="e"><img src="/icon-192.png" alt=""><div class="n">AKS TIZIM</div>
<div id="x" class="m">Yuklanmoqda…</div>
<div id="f" style="display:none">
<div class="m">Shaxsiy kirish kodingizni kiriting</div><br>
<input id="kod" type="text" inputmode="text" placeholder="Kirish kodi" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" style="text-align:center"><br><br>
<button id="kir">Kirish</button><br><br>
<a class="u" id="unut" href="https://t.me/${TG_BOT}?start=kod">Kodimni unutdim</a>
</div></div>
<div class="a">Tizim muallifi va yaratuvchisi: <b>${MUALLIF}</b></div>
<script>
var XATO=${xato ? JSON.stringify(xato) : "''"};
var k=''; try{ k=localStorage.getItem('aks_k')||''; }catch(e){}
if(XATO || new URLSearchParams(location.search).has('chiqish')){ try{ localStorage.removeItem('aks_k'); }catch(e){} k=''; }
if(k){ location.replace('/?k='+encodeURIComponent(k)); }
else {
  var xd=document.getElementById('x');
  if(XATO){ xd.className='xa'; xd.textContent=XATO; } else { xd.style.display='none'; }
  document.getElementById('f').style.display='block';
  var kir=function(){ var v=document.getElementById('kod').value.replace(/\s+/g,''); if(!v) return; location.replace('/?k='+encodeURIComponent(v)); };
  document.getElementById('kir').onclick=kir;
  document.getElementById('kod').addEventListener('keydown',function(e){ if(e.key==='Enter') kir(); });
  try{ document.getElementById('kod').focus(); }catch(e){}
}
if('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(function(){});
</script></body></html>`;
}
const KIRISH = kirishSahifa('');
// kod topilmadi: boshi berk sahifa emas — o'sha kirish oynasi, qizil izoh bilan
const TAQIQ = kirishSahifa('Bu kirish kodi tizimda topilmadi. Kodni qaytadan kiriting yoki «Kodimni unutdim» ni bosing.');

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

const YOQ = '<!DOCTYPE html><html lang="uz"><head><meta charset="utf-8"><title>AKS TIZIM</title></head><body style="font-family:Arial;padding:40px;text-align:center">' +
  '<h2>AKS TIZIM server ishlayapti</h2><p>Ilova fayli (Index.html) hali serverga yuklanmagan.</p></body></html>';

module.exports = { sahifa, TAQIQ, YOQ, KIRISH, indexBor: () => !!indexMatn() };
