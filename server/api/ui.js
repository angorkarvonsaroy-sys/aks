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
  html = html.replace(/<head>/i, '<head>\n<meta name="viewport" content="width=device-width, initial-scale=1">' + SHIM);
  return html;
}

const TAQIQ = '<!DOCTYPE html><html lang="uz"><head><meta charset="utf-8"><title>AKS TIZIM</title></head><body>' +
  '<div style="font-family:Arial;padding:40px;text-align:center"><h2>Kirish taqiqlangan</h2>' +
  '<p>Havola noto\'g\'ri yoki eskirgan. Direktorga murojaat qiling.</p>' +
  '<p style="margin-top:60px;font-size:12px;color:#667085">AKS TIZIM · Tizim muallifi va yaratuvchisi: <b>' + MUALLIF + '</b></p></div></body></html>';
const YOQ = '<!DOCTYPE html><html lang="uz"><head><meta charset="utf-8"><title>AKS TIZIM</title></head><body style="font-family:Arial;padding:40px;text-align:center">' +
  '<h2>AKS TIZIM server ishlayapti</h2><p>Ilova fayli (Index.html) hali serverga yuklanmagan.</p></body></html>';

module.exports = { sahifa, TAQIQ, YOQ, indexBor: () => !!indexMatn() };
