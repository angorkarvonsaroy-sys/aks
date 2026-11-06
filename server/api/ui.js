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

// «/» kodsiz ochilganda (o'rnatilgan ilova ikonasi): saqlangan kirish kaliti bo'lsa — darhol shunga; bo'lmasa — kirish oynasi.
// 01.11.2026 (direktor qarori): KIRISH = TELEFON RAQAM + PAROL (api/kirish.js — POST /api/kirish). Parolga shart yo'q.
// «Parolimni unutdim» → telefon raqami → vaqtinchalik parol Telegram va Gmail'ga (POST /api/unutdim).
// Saqlangan kalit: kirilgach brauzer kalitni (aks_k) eslab qoladi — keyingi safar hech narsa so'ralmaydi.
// 01.11: XATO sahifasi saqlangan kalitni BEHUDA O'CHIRMAYDI — avval havoladagi (eski) kalit emas, saqlangani sinab ko'riladi.
// Avval bitta noto'g'ri havola (masalan o'rnatilgan ilova yorlig'idagi eski kalit) qurilmadagi to'g'ri kirishni o'chirib yuborardi.
function kirishSahifa(xato) {
  return `<!DOCTYPE html><html lang="uz"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"><title>AKS TIZIM</title>
<link rel="manifest" href="/manifest.json"><meta name="theme-color" content="#0B3D2E"><link rel="icon" type="image/png" href="/favicon.png"><link rel="apple-touch-icon" href="/icon-192.png">
<style>html,body{margin:0;min-height:100%;background:#0B3D2E;font-family:Arial,sans-serif;color:#fff}
*{box-sizing:border-box}
#e{min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:24px 16px 56px}
img{width:84px;height:84px;border-radius:20px}.n{font-size:22px;font-weight:bold;letter-spacing:.04em;margin:10px 0 2px}.m{font-size:14px;color:#C9D8D1}
.kt{width:100%;max-width:340px;margin-top:16px;text-align:left}
.xa{font-size:14px;color:#FFD7D0;background:#7F1D1D;border-radius:10px;padding:10px 14px;line-height:1.45;margin-bottom:12px}
.ok{font-size:14px;color:#D1FADF;background:#05603A;border-radius:10px;padding:10px 14px;line-height:1.45;margin-bottom:12px}
label.l{display:block;font-size:13px;color:#C9D8D1;margin:12px 0 6px}
.tel{display:flex;background:#fff;border-radius:10px;overflow:hidden}
.tel span{padding:13px 4px 13px 12px;color:#475467;font-size:17px;white-space:nowrap}
input.i{width:100%;padding:13px 12px;border:0;border-radius:10px;font-size:17px;color:#101828;background:#fff;outline:none}
.tel input.i{border-radius:0;padding-left:6px}
input.i:focus{box-shadow:0 0 0 3px #D4AF5A}.tel:focus-within{box-shadow:0 0 0 3px #D4AF5A}.tel input.i:focus{box-shadow:none}
button.b{width:100%;margin-top:16px;padding:14px;border-radius:10px;border:0;background:#D4AF5A;color:#0B3D2E;font-weight:bold;font-size:17px;cursor:pointer}
button.b:disabled{opacity:.6}
.kor{display:inline-flex;align-items:center;gap:7px;margin-top:10px;color:#C9D8D1;font-size:13px;cursor:pointer;user-select:none}
.kor input{width:16px;height:16px;margin:0}
.hv{text-align:center;margin-top:16px}a.u{color:#C9D8D1;font-size:14px;text-decoration:underline;cursor:pointer}
.iz{font-size:13px;color:#C9D8D1;line-height:1.45;margin-top:4px}
.a{text-align:center;font-size:12px;color:#9FB8AD;padding:0 16px 16px;margin-top:-40px}</style></head><body>
<div id="e"><img src="/icon-192.png" alt=""><div class="n">AKS TIZIM</div><div class="m" id="sar">Angor Karvon Saroy</div>
<div class="kt">
 <div id="x" style="display:none"></div>
 <div id="yk" class="m" style="text-align:center">Yuklanmoqda…</div>
 <div id="fk" style="display:none">
  <label class="l" for="tel" id="t_tel">Telefon raqamingiz</label>
  <div class="tel"><span>+998</span><input class="i" id="tel" type="tel" inputmode="numeric" autocomplete="username" placeholder="90 123 45 67" maxlength="16"></div>
  <label class="l" for="par" id="t_par">Parol</label>
  <input class="i" id="par" type="password" autocomplete="current-password" autocapitalize="off" autocorrect="off" spellcheck="false">
  <label class="kor"><input type="checkbox" id="kor"> <span id="t_kor">Parolni ko'rsatish</span></label>
  <button class="b" id="kir">Kirish</button>
  <div class="hv"><a class="u" id="unutH">Parolimni unutdim</a></div>
 </div>
 <div id="fu" style="display:none">
  <div class="iz" id="t_uiz">Telefon raqamingizni yozing — vaqtinchalik parol Telegram va Gmail'ingizga yuboriladi.</div>
  <label class="l" for="tel2" id="t_tel2">Telefon raqamingiz</label>
  <div class="tel"><span>+998</span><input class="i" id="tel2" type="tel" inputmode="numeric" autocomplete="username" placeholder="90 123 45 67" maxlength="16"></div>
  <button class="b" id="yub">Parol yuborish</button>
  <div class="hv"><a class="u" id="ortH">← Kirishga qaytish</a></div>
 </div>
 <div class="hv"><a class="u" id="alf" style="opacity:.75;font-size:13px">Кирилл алифбосига</a></div>
</div></div>
<div class="a" id="muallif">Tizim muallifi va yaratuvchisi: <b>${MUALLIF}</b></div>
<script>
var XATO=${xato ? JSON.stringify(xato) : "''"};
var g=function(i){ return document.getElementById(i); };
function lsO(k){ try{ return localStorage.getItem(k)||''; }catch(e){ return ''; } }
function lsY(k,v){ try{ if(v) localStorage.setItem(k,v); else localStorage.removeItem(k); }catch(e){} }
var QP=new URLSearchParams(location.search), urlK=QP.get('k')||'', k=lsO('aks_k');
if(QP.has('chiqish')){ lsY('aks_k',''); k=''; }
var ket=false;
if(k && (!XATO || k!==urlK)){ ket=true; location.replace('/?k='+encodeURIComponent(k)); }   // saqlangan kalit bilan
else if(XATO && k===urlK){ lsY('aks_k',''); k=''; }                                          // saqlangani ham yaramadi
// ---- alifbo (ilovadagi tanlov bilan bir xil kalit — aks_alifbo)
function kr(){ return lsO('aks_alifbo')==='kr'; }
var SAQLA=['AKS TIZIM','Telegram','Gmail','AKS'];
function lk(t){ // lotin → kirill (xato/izoh matnlari uchun, sodda)
  var Q=[]; t=t.replace(/[^\\s()]+@[^\\s()]+/g,function(m){ Q.push(m); return '\\u0003'+(Q.length-1)+'\\u0004'; });   // pochta manzili o'girilmaydi
  SAQLA.forEach(function(w,i){ t=t.split(w).join('\\u0001'+i+'\\u0002'); });
  var D=[["O'",'Ў'],["o'",'ў'],["G'",'Ғ'],["g'",'ғ'],['Sh','Ш'],['sh','ш'],['SH','Ш'],['Ch','Ч'],['ch','ч'],['CH','Ч'],['YO','Ё'],['Yo','Ё'],['yo','ё'],['YU','Ю'],['Yu','Ю'],['yu','ю'],['YA','Я'],['Ya','Я'],['ya','я'],['YE','Е'],['Ye','Е'],['ye','е']];
  t=t.replace(/[ʻʼ‘’\\u0060]/g,"'");   // u0060 — orqa tirnoq (bazada G va O dan keyin ko'p)
  D.forEach(function(d){ t=t.split(d[0]).join(d[1]); });
  t=t.replace(/(^|[^A-Za-zЀ-ӿ])([Ee])/g,function(m,a,b){ return a+(b==='E'?'Э':'э'); });
  var M={a:'а',b:'б',d:'д',e:'е',f:'ф',g:'г',h:'ҳ',i:'и',j:'ж',k:'к',l:'л',m:'м',n:'н',o:'о',p:'п',q:'қ',r:'р',s:'с',t:'т',u:'у',v:'в',x:'х',y:'й',z:'з',c:'ц',w:'в'};
  t=t.replace(/[A-Za-z]/g,function(c){ var l=c.toLowerCase(), r=M[l]||c; return c===l?r:r.toUpperCase(); });
  return t.replace(/\\u0001(\\d+)\\u0002/g,function(m,i){ return SAQLA[+i]; }).replace(/\\u0003(\\d+)\\u0004/g,function(m,i){ return Q[+i]; });
}
var T={ t_tel:'Telefon raqamingiz', t_tel2:'Telefon raqamingiz', t_par:'Parol', t_kor:"Parolni ko'rsatish", kir:'Kirish', unutH:'Parolimni unutdim',
  t_uiz:"Telefon raqamingizni yozing — vaqtinchalik parol Telegram va Gmail'ingizga yuboriladi.", yub:'Parol yuborish', ortH:'← Kirishga qaytish',
  yk:'Yuklanmoqda…', muallif:'Tizim muallifi va yaratuvchisi: ' };
function mt(t){ return kr()?lk(t):t; }
function alQoy(){
  Object.keys(T).forEach(function(i){ var e=g(i); if(!e) return; if(i==='muallif') e.innerHTML=mt(T[i])+'<b>'+(kr()?'Камолиддин Нақиев':${JSON.stringify(MUALLIF)})+'</b>'; else e.textContent=mt(T[i]); });
  g('par').setAttribute('placeholder',mt('Parol')); g('alf').textContent=kr()?'Lotin alifbosiga':'Кирилл алифбосига';
  var x=g('x'); if(x.dataset.m) x.textContent=mt(x.dataset.m);
}
function xab(m,tur){ var x=g('x'); x.dataset.m=m||''; x.className=tur==='ok'?'ok':'xa'; x.textContent=mt(m||''); x.style.display=m?'block':'none'; }
function rq(t){ return String(t||'').replace(/\\D/g,''); }
function yol(url,d,cb){
  fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(d)})
   .then(function(r){ return r.json(); }).then(cb)
   .catch(function(){ cb({ok:false,xato:"Server bilan aloqa yo'q. Internetni tekshirib, qayta urinib ko'ring."}); });
}
function kirish(){ var b=g('kir'); if(b.disabled) return; var tel=rq(g('tel').value), p=g('par').value;
  if(tel.length===12&&tel.indexOf('998')===0) tel=tel.slice(3);
  if(tel.length!==9){ xab("Telefon raqamingizni to'liq yozing — 9 ta raqam (masalan 90 123 45 67)."); g('tel').focus(); return; }
  if(!p.trim()){ xab('Parolni yozing.'); g('par').focus(); return; }
  b.disabled=true; b.textContent=mt('Tekshirilmoqda…'); xab('');
  yol('/api/kirish',{tel:tel,parol:p},function(r){
    if(r&&r.ok&&r.k){ lsY('aks_tel',tel); lsY('aks_k',r.k); location.replace('/?k='+encodeURIComponent(r.k)); return; }
    b.disabled=false; b.textContent=mt('Kirish'); xab((r&&r.xato)||'Xato.'); g('par').select(); });
}
function yubor(){ var b=g('yub'); if(b.disabled) return; var tel=rq(g('tel2').value);
  if(tel.length===12&&tel.indexOf('998')===0) tel=tel.slice(3);
  if(tel.length!==9){ xab("Telefon raqamingizni to'liq yozing — 9 ta raqam (masalan 90 123 45 67)."); return; }
  b.disabled=true; b.textContent=mt('Yuborilmoqda…'); xab('');
  yol('/api/unutdim',{tel:tel},function(r){ b.disabled=false; b.textContent=mt('Parol yuborish');
    if(r&&r.ok){ lsY('aks_tel',tel); g('tel').value=g('tel2').value; ekran('fk');
      xab('Vaqtinchalik parol yuborildi: '+(r.kanallar||[]).join(', ')+'. Telefon raqamingiz va shu parol bilan kiring (24 soat amal qiladi).','ok'); g('par').value=''; g('par').focus(); }
    else xab((r&&r.xato)||'Xato.'); });
}
function ekran(id){ g('fk').style.display=id==='fk'?'block':'none'; g('fu').style.display=id==='fu'?'block':'none'; }
alQoy();
if(!ket){
  g('yk').style.display='none'; ekran('fk');
  if(XATO) xab(XATO);
  var st=lsO('aks_tel'); if(st){ g('tel').value=st; g('tel2').value=st; }
  g('kir').onclick=kirish; g('yub').onclick=yubor;
  g('par').addEventListener('keydown',function(e){ if(e.key==='Enter') kirish(); });
  g('tel').addEventListener('keydown',function(e){ if(e.key==='Enter') g('par').focus(); });
  g('tel2').addEventListener('keydown',function(e){ if(e.key==='Enter') yubor(); });
  g('kor').onchange=function(){ g('par').type=g('kor').checked?'text':'password'; };
  g('unutH').onclick=function(){ g('tel2').value=g('tel').value; xab(''); ekran('fu'); g('tel2').focus(); };
  g('ortH').onclick=function(){ xab(''); ekran('fk'); };
  try{ (st?g('par'):g('tel')).focus(); }catch(e){}
}
g('alf').onclick=function(e){ e.preventDefault(); lsY('aks_alifbo',kr()?'lo':'kr'); alQoy(); return false; };
if('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(function(){});
</script></body></html>`;
}
const KIRISH = kirishSahifa('');
// kod topilmadi: boshi berk sahifa emas — o'sha kirish oynasi, qizil izoh bilan
const TAQIQ = kirishSahifa('Saqlangan kirish eskirgan. Telefon raqamingiz va parolingiz bilan kiring.');
// juda ko'p noto'g'ri urinish (api/index.js, IP bo'yicha)
const KOP = kirishSahifa('Juda ko\'p noto\'g\'ri urinish. 15 daqiqadan keyin qayta urinib ko\'ring.');

// doGet (Kod.gs) ning serverdagi o'rni
// 03.11.2026: direktorga «🛠 Тизим ҳолати» (/holat). Kompyuterda — chap menyuning pastki qismida (#yon .pastki, «Созламалар» ustida), boshqa tugmalar
// bilan bir xil ko'rinishda; menyu yo'q bo'lsa (telefon) — o'ng pastki burchakda oq kichik tugma. Xodimlarda (va «xodim ko'zi bilan» rejimida) yo'q; chop etishda ko'rinmaydi.
// (Birinchi variant — chap pastki burchakdagi yashil doira — yashil menyu ustida ko'rinmay qoldi.)
const HOLAT_TUGMA = kod => { const u = '/tizim-holati?k=' + encodeURIComponent(kod);
  return '<a id="aks-holat-tugma" href="' + u + '" title="Тизим ҳолати" style="position:fixed;right:12px;bottom:12px;z-index:60;background:#fff;color:#0B3D2E;' +
  'border:1px solid #0B3D2E;border-radius:18px;padding:6px 12px;font:600 13px Arial,sans-serif;text-decoration:none;box-shadow:0 2px 6px rgba(0,0,0,.2)">🛠 Ҳолат</a>' +
  '<style>@media print{#aks-holat-tugma,#aks-holat-yon{display:none!important}}</style>' +
  '<script>(function(){var U=' + JSON.stringify(u) + ',n=0;function q(){var y=document.getElementById("yon"),p=y&&y.querySelector(".pastki");' +
  'if(!p||getComputedStyle(y).display==="none")return false;if(!document.getElementById("aks-holat-yon")){var b=document.createElement("button");b.type="button";' +
  'b.id="aks-holat-yon";b.innerHTML=\'<span class="ik">🛠</span>Тизим ҳолати\';b.onclick=function(){location.href=U};p.insertBefore(b,p.firstChild);}' +
  'var f=document.getElementById("aks-holat-tugma");if(f)f.style.display="none";return true;}' +
  'var t=setInterval(function(){if(q()||++n>60)clearInterval(t)},250);})();</script>'; };
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
    'versiya': (/<!--\s*(v27\.\d+)/.exec(matn) || [])[1] || '',   // 06.11.2026: ilova versiyasi — Index.html boshidagi birinchi «<!-- v27.NN» izohidan (pastki yozuvda ko'rinadi)
  };
  let html = matn.replace(/<\?(!?)=\s*([\s\S]*?)\s*\?>/g, (m, raw, ifoda) => {
    if (ifoda in qiymat) return qiymat[ifoda];
    console.warn('Index.html: noma\'lum shablon ifodasi:', ifoda.slice(0, 80));
    return '';
  });
  html = html.replace(/<head>/i, '<head>\n<meta name="viewport" content="width=device-width, initial-scale=1">' + PWA_BOSH + SHIM);
  if (user.admin) html = html.replace(/<\/body>(?![\s\S]*<\/body>)/i, HOLAT_TUGMA(kod) + '</body>');   // 03.11: faqat direktorga — 🛠 Tizim holati
  return html;
}

const YOQ = '<!DOCTYPE html><html lang="uz"><head><meta charset="utf-8"><title>AKS TIZIM</title></head><body style="font-family:Arial;padding:40px;text-align:center">' +
  '<h2>AKS TIZIM server ishlayapti</h2><p>Ilova fayli (Index.html) hali serverga yuklanmagan.</p></body></html>';

module.exports = { sahifa, TAQIQ, KOP, YOQ, KIRISH, indexBor: () => !!indexMatn() };
