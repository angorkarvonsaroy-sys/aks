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
  window.AKS_V='__AKS_V__';
  /* 14.11.2026: EKRANDAGI dastur xatosi direktorga boradi (ilovaXato → lib/xato_ogoh.js). Bir sahifa ochilishida ko'pi bilan 5 ta; server o'zi ham cheklaydi. */
  var MATN="Dasturda nosozlik chiqdi. Direktorga xabar yuborildi — sahifani yangilab, qayta urinib ko'ring.";
  var OXK='', XS=0;
  function ilovaXato(fn,e,kod){ try{ if(XS>=5) return; XS++;
      var oyna=''; try{ var B=document.querySelectorAll('[id^=bolim-]'); for(var i=0;i<B.length;i++){ if(B[i].getClientRects().length){ oyna=B[i].id.slice(6); break; } } }catch(x){}
      var joy=String((e&&e.stack)||'').split('\\n').slice(1,4).join(' | ').split(location.origin).join('');
      fetch('/api/rpc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({fn:'ilovaXato',args:[(typeof kod==='string'&&kod)||OXK,{fn:String(fn||''),nom:String((e&&e.name)||''),xabar:String((e&&e.message)||e),joy:joy,talqin:window.AKS_V||'',oyna:oyna}]})}).catch(function(){});
    }catch(x){} }
  window.addEventListener('error',function(ev){ try{ var e=ev&&ev.error; var f=String(ev.filename||''); if(!e||!(e instanceof Error)||(f&&f.indexOf(location.origin)!==0)) return; ilovaXato('',e,OXK);   /* begona skript (kengaytma) xatosi hisobga olinmaydi */ }catch(x){} });
  /* 14.11.2026: YANGI TALQIN CHIQSA — xabar va «Yangilash». Avval ilova ochiq turgan telefonda yangi talqin chiqqanini bilishning yo'li yo'q edi:
     xodim eski sahifada ishlayverardi. Endi har 5 daqiqada (va ilovaga qaytilganda) server talqini so'raladi; farq bo'lsa tepada chiziq chiqadi.
     O'zi yangilanmaydi — to'ldirilayotgan forma yo'qolmasin; xodim tayyor bo'lganda bosadi. «✕» — shu talqin uchun bir soatga yopadi. */
  var YT=0;
  function talqinXabar(v){ try{ if(document.getElementById('aksYangi')||!document.body) return;
      try{ var y=JSON.parse(sessionStorage.getItem('aks_yangi_yop')||'null'); if(y&&y.v===v&&Date.now()-y.t<3600000) return; }catch(x){}
      var d=document.createElement('div'); d.id='aksYangi';
      d.style.cssText='position:fixed;left:0;right:0;top:0;z-index:400;background:#0B3D2E;color:#fff;padding:10px 12px;font-size:14px;line-height:1.35;display:flex;gap:10px;align-items:center;justify-content:center;flex-wrap:wrap;box-shadow:0 2px 12px rgba(0,0,0,.3)';
      var m=document.createElement('span'); m.textContent='🔄 Ilovaning yangi talqini chiqdi: '+v+' (sizda '+window.AKS_V+"). Ishingizni saqlab, yangilang.";
      var b=document.createElement('button'); b.type='button'; b.id='aksYangiB'; b.textContent='Yangilash'; b.style.cssText='background:#fff;color:#0B3D2E;border:0;border-radius:8px;padding:8px 16px;font-weight:700;font-size:14px;cursor:pointer;width:auto;margin:0';
      b.onclick=function(){ b.disabled=true; b.textContent='Yangilanmoqda…'; location.reload(); };
      var x=document.createElement('button'); x.type='button'; x.setAttribute('aria-label','Yopish'); x.textContent='✕'; x.style.cssText='background:transparent;color:#fff;border:1px solid rgba(255,255,255,.5);border-radius:8px;padding:6px 10px;font-size:14px;cursor:pointer;width:auto;margin:0';
      x.onclick=function(){ try{ sessionStorage.setItem('aks_yangi_yop',JSON.stringify({v:v,t:Date.now()})); }catch(e){} d.remove(); };
      d.appendChild(m); d.appendChild(b); d.appendChild(x); document.body.appendChild(d);
    }catch(e){} }
  function talqinTek(majbur){ try{ if(!window.AKS_V||document.hidden||document.getElementById('aksYangi')) return; var t=Date.now(); if(!majbur&&t-YT<240000) return; YT=t;
      fetch('/api/holat',{cache:'no-store'}).then(function(r){return r.json();}).then(function(j){ var v=j&&j.ilova; if(v&&v!==window.AKS_V) talqinXabar(v); }).catch(function(){});
    }catch(e){} }
  window.aksTalqinTek=talqinTek;
  setInterval(function(){ talqinTek(false); },300000);
  document.addEventListener('visibilitychange',function(){ if(!document.hidden) talqinTek(false); });
  function run(ok,yoq,uo){
    return new Proxy({},{get:function(_,k){
      if(k==='withSuccessHandler') return function(f){return run(f,yoq,uo);};
      if(k==='withFailureHandler') return function(f){return run(ok,f,uo);};
      if(k==='withUserObject') return function(o){return run(ok,yoq,o);};
      if(typeof k!=='string') return undefined;
      return function(){
        var args=Array.prototype.slice.call(arguments);
        if(typeof args[0]==='string'&&args[0]) OXK=args[0];
        fetch('/api/rpc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({fn:k,args:args})})
          .then(function(r){return r.json();})
          .then(function(j){
            if(j&&j.ok){ if(ok){ try{ ok(j.r,uo); }
              catch(e){ /* 14.11.2026: javobni EKRANGA CHIZAYOTGAN kod xato berdi — bu aloqa uzilishi emas: direktorga xabar, xodimga tushunarli matn */
                console.error(e); ilovaXato(k,e,args[0]); var x=new Error(MATN); x.aksIlova=1;   /* Index.html: xato tutuvchisi yo'q chaqiruvda shu belgi bo'yicha ekranga chiqaradi */
                if(yoq){ try{ yoq(x,uo); }catch(e2){ console.error(e2); } } else if(typeof toast==='function'){ try{ toast(MATN,true); }catch(e3){} } } } }
            else { var e=new Error((j&&j.xato)||'Server xatosi'); if(yoq){ try{ yoq(e,uo); }catch(e4){ console.error(e4); ilovaXato(k,e4,args[0]); } } else console.error(e); }
          },function(e){ var x=new Error("Server bilan aloqa yo'q. Internetni tekshirib, qayta urinib ko'ring."); if(yoq){ try{ yoq(x,uo); }catch(e5){ console.error(e5); } } else console.error(x); });
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
(function(){ try{ var QS=new URLSearchParams(location.search), k=QS.get('k'); if(k){ localStorage.setItem('aks_k',k);
    var mn=document.getElementById('aksMan'); if(mn) mn.href='/manifest.json?k='+encodeURIComponent(k);
    // 13.11.2026: kirish kaliti manzil satrida ko'rinib turmasin (ekran rasmi, yelka osha qarash) — kalit brauzer xotirasiga SAQLANGANI tasdiqlangach
    // manzil «/» ga almashtiriladi; sahifa yangilansa «/» → saqlangan kalit bilan o'zi qayta ochiladi. Boshqa parametr bo'lsa (👁 ko'rish rejimi va h.k.) — tegilmaydi.
    var boshqa=false; QS.forEach(function(v,n){ if(n!=='k') boshqa=true; });
    if(!boshqa&&localStorage.getItem('aks_k')===k&&window.history&&history.replaceState) history.replaceState(null,'','/'); } }catch(e){}   // 25.10: yorliq kod bilan o'rnatilsin
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
.chr{background:#FFF7E0;color:#0B3D2E;border-radius:12px;padding:12px 14px;font-size:14px;line-height:1.45;margin-bottom:12px}
.chrB{display:block;margin:10px 0 6px;padding:13px;border-radius:10px;background:#0B3D2E;color:#fff;font-weight:bold;font-size:16px;text-align:center;text-decoration:none}.chr2{display:block;font-size:12px;color:#475467}
.a{text-align:center;font-size:12px;color:#9FB8AD;padding:0 16px 16px;margin-top:-40px}</style></head><body>
<div id="e"><img src="/icon-192.png" alt=""><div class="n">AKS TIZIM</div><div class="m" id="sar">Angor Karvon Saroy</div>
<div class="kt">
 <div id="chr" class="chr" style="display:none"><span id="t_chr">Bu sahifa Telegram ichida ochildi. Ilovani telefoningizga o'rnatish uchun uni Chrome'da oching.</span><a id="chrB" class="chrB" href="#">Chrome'da ochish</a><span id="t_chr2" class="chr2">Ochilmasa: yuqoridagi uch nuqta — «Chrome'da ochish».</span></div>
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
var SAQLA=['AKS TIZIM','Telegram','Gmail','Chrome','AKS'];
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
  yk:'Yuklanmoqda…', muallif:'Tizim muallifi va yaratuvchisi: ',
  t_chr:"Bu sahifa Telegram ichida ochildi. Ilovani telefoningizga o'rnatish uchun uni Chrome'da oching.", chrB:"Chrome'da ochish", t_chr2:"Ochilmasa: yuqoridagi uch nuqta — «Chrome'da ochish»." };
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
  // 07.11.2026: telefon yozilayotganda o'zi formatlanadi — «99 594 44 74» (998 bilan boshlansa — tashlanadi)
  function telF(v){ var d=rq(v); if(d.length>9&&d.indexOf('998')===0) d=d.slice(3); d=d.slice(0,9);
    return [d.slice(0,2),d.slice(2,5),d.slice(5,7),d.slice(7,9)].filter(function(x){return x;}).join(' '); }
  ['tel','tel2'].forEach(function(id){ var el=g(id); el.addEventListener('input',function(){ var v=telF(el.value); if(v!==el.value) el.value=v; }); });
  var st=lsO('aks_tel'); if(st){ g('tel').value=telF(st); g('tel2').value=telF(st); }
  // 14.11.2026: xodimga yuborilgan kirish havolasi (/?t=907477114) — raqam tayyor turadi, faqat parol yoziladi
  var ht=rq(QP.get('t')||''); if(ht.length===12&&ht.indexOf('998')===0) ht=ht.slice(3);
  if(ht.length===9){ st=ht; g('tel').value=telF(ht); g('tel2').value=telF(ht); }
  // 14.11.2026: Telegram (yoki boshqa ilova) ichidagi brauzerda ochilsa — Chrome'ga o'tkazish tugmasi (ilovani o'rnatish faqat Chrome'ning o'zida chiqadi).
  // Android «intent» havolasi aynan Chrome'ni ochadi; o'z-o'zidan yo'naltirilmaydi (ichki brauzer uni tanimasa xato sahifasi chiqmasin) — bitta tugma.
  (function(){ try{ var ua=navigator.userAgent||''; var ichki=/Android/i.test(ua)&&(/; wv\\)/.test(ua)||/Telegram/i.test(ua)||typeof window.TelegramWebview!=='undefined'||typeof window.TelegramWebviewProxy!=='undefined');
    if(!ichki) return; g('chrB').setAttribute('href','intent://'+location.host+location.pathname+location.search+'#Intent;scheme=https;package=com.android.chrome;end'); g('chr').style.display='block'; }catch(e){} })();
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
// ilova talqini — Index.html boshidagi birinchi «<!-- vNN.NN» izohidan (pastki yozuvda, /api/holat da va «yangi talqin chiqdi» xabarida)
const versiyaOl = matn => (/<!--\s*(v\d+\.\d+)/.exec(matn || '') || [])[1] || '';
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
    'versiya': versiyaOl(matn),   // 06.11.2026: ilova versiyasi — Index.html boshidagi birinchi «<!-- v27.NN» izohidan (pastki yozuvda ko'rinadi)
  };
  let html = matn.replace(/<\?(!?)=\s*([\s\S]*?)\s*\?>/g, (m, raw, ifoda) => {
    if (ifoda in qiymat) return qiymat[ifoda];
    console.warn('Index.html: noma\'lum shablon ifodasi:', ifoda.slice(0, 80));
    return '';
  });
  html = html.replace(/<head>/i, '<head>\n<meta name="viewport" content="width=device-width, initial-scale=1">' + PWA_BOSH + SHIM.replace('__AKS_V__', qiymat.versiya));
  if (user.admin) html = html.replace(/<\/body>(?![\s\S]*<\/body>)/i, HOLAT_TUGMA(kod) + '</body>');   // 03.11: faqat direktorga — 🛠 Tizim holati
  return html;
}

const YOQ = '<!DOCTYPE html><html lang="uz"><head><meta charset="utf-8"><title>AKS TIZIM</title></head><body style="font-family:Arial;padding:40px;text-align:center">' +
  '<h2>AKS TIZIM server ishlayapti</h2><p>Ilova fayli (Index.html) hali serverga yuklanmagan.</p></body></html>';

module.exports = { sahifa, TAQIQ, KOP, YOQ, KIRISH, indexBor: () => !!indexMatn(), versiya: () => versiyaOl(indexMatn()) };
