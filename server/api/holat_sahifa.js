// AKS TIZIM — 🛠 «Tizim holati» sahifasi (03.11.2026): /tizim-holati?k=KOD — FAQAT direktor (admin). Ma'lumot — lib/tizim_holat.js (faqat o'qiydi).
// Sahifa darhol ochiladi, ma'lumot keyin keladi (/tizim-holati/qism?k=KOD — Drive va eski tizimni so'rash 5–20 s olishi mumkin).
'use strict';
const TH = require('../lib/tizim_holat');

const esc = v => String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const RANG = { '✅': 'ok', '⚠': 'og', '✖': 'xt', 'ℹ': 'in' };
const XULOSA = { '✅': 'Hammasi joyida', '⚠': 'E\'tibor bering — sariq belgili qatorlarni ko\'ring', '✖': 'Muammo bor — qizil belgili qatorlarni ko\'ring' };

function sahifa(kod) {
  const k = encodeURIComponent(kod);
  return `<!DOCTYPE html><html lang="uz"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex"><title>Tizim holati — AKS</title><link rel="icon" href="/favicon.png">
<style>
:root{--bg:#f4f6f5;--kart:#fff;--matn:#1c2421;--kul:#66706c;--chiz:#e2e7e4;--ok:#1f8a4c;--og:#b7791f;--xt:#c53030;--in:#5a6b8c;--asos:#0B3D2E}
@media (prefers-color-scheme: dark){:root{--bg:#121715;--kart:#1b2220;--matn:#e6ece9;--kul:#9aa5a0;--chiz:#2b3431;--ok:#48bb78;--og:#ecc94b;--xt:#fc8181;--in:#a3b3d1;--asos:#7fd1ae}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--matn);font:15px/1.45 -apple-system,Segoe UI,Roboto,Arial,sans-serif}
.ich{max-width:860px;margin:0 auto;padding:16px}
header{display:flex;flex-wrap:wrap;align-items:center;gap:10px;justify-content:space-between;margin-bottom:14px}
h1{font-size:20px;margin:0;color:var(--asos)}
.tug{display:inline-block;padding:8px 14px;border-radius:8px;border:1px solid var(--chiz);background:var(--kart);color:var(--matn);text-decoration:none;font-size:14px;cursor:pointer}
.tug:hover{border-color:var(--asos)}
.xul{padding:14px 16px;border-radius:10px;background:var(--kart);border-left:6px solid var(--in);margin-bottom:14px;font-weight:600}
.xul.ok{border-color:var(--ok)}.xul.og{border-color:var(--og)}.xul.xt{border-color:var(--xt)}
.xul small{display:block;font-weight:400;color:var(--kul);margin-top:2px}
section{background:var(--kart);border-radius:10px;margin-bottom:12px;overflow:hidden;border:1px solid var(--chiz)}
section h2{font-size:15px;margin:0;padding:11px 14px;border-bottom:1px solid var(--chiz);display:flex;gap:8px;align-items:center}
.q{display:flex;gap:10px;padding:9px 14px;border-bottom:1px solid var(--chiz)}.q:last-child{border-bottom:0}
.b{flex:0 0 22px;text-align:center}.m{flex:1;min-width:0;overflow-wrap:anywhere}
.i{display:block;color:var(--kul);font-size:13px;margin-top:1px}
.q.og .m>span:first-child{color:var(--og)}.q.xt .m>span:first-child{color:var(--xt);font-weight:600}
a.l{color:var(--asos)}
.yuk{padding:40px 16px;text-align:center;color:var(--kul)}
.spin{display:inline-block;width:22px;height:22px;border:3px solid var(--chiz);border-top-color:var(--asos);border-radius:50%;animation:a 0.9s linear infinite;vertical-align:middle;margin-right:8px}
@keyframes a{to{transform:rotate(360deg)}}
footer{color:var(--kul);font-size:12px;text-align:center;margin:18px 0 8px}
</style></head><body><div class="ich">
<header><h1>🛠 Tizim holati</h1><div><button class="tug" id="yan" type="button">🔄 Yangilash</button> <a class="tug" href="/?k=${k}">← Ilovaga</a></div></header>
<div id="j"><div class="yuk"><span class="spin"></span>Tekshirilmoqda… (Drive va eski tizimni so'rash 5–20 soniya olishi mumkin)</div></div>
<footer>Faqat ko'rsatadi — hech narsani o'zgartirmaydi. Faqat direktor ko'radi.</footer>
</div><script>
(function(){var j=document.getElementById('j'),y=document.getElementById('yan'),band=false;
function ol(){if(band)return;band=true;y.disabled=true;j.innerHTML='<div class="yuk"><span class="spin"></span>Tekshirilmoqda…</div>';
fetch('/tizim-holati/qism?k=${k}',{cache:'no-store'}).then(function(r){if(!r.ok)throw new Error('Server javobi: '+r.status);return r.text();})
.then(function(t){j.innerHTML=t;}).catch(function(e){j.innerHTML='<div class="xul xt">Yuklab bo\\'lmadi<small>'+String(e.message).replace(/</g,'&lt;')+'</small></div>';})
.then(function(){band=false;y.disabled=false;});}
y.onclick=ol;ol();})();
</script></body></html>`;
}

async function qism(user, versiya) {
  const H = await TH.yig({ kod: user.kod, versiya });
  const vaqt = H.vaqt.toLocaleString('ru-RU', { timeZone: 'Asia/Tashkent' }).replace(',', '');
  let h = `<div class="xul ${RANG[H.umumiy]}">${H.umumiy} ${esc(XULOSA[H.umumiy])}<small>Tekshirildi: ${esc(vaqt)} · ${(H.ms / 1000).toFixed(1)} s</small></div>`;
  for (const b of H.B) {
    h += `<section><h2>${b.b} ${esc(b.n)}</h2>`;
    for (const z of b.Q) {
      h += `<div class="q ${RANG[z.b] || 'in'}"><div class="b">${z.b}</div><div class="m"><span>${esc(z.m)}</span>` +
        (z.i ? `<span class="i">${esc(z.i)}</span>` : '') + (z.url ? `<span class="i"><a class="l" href="${esc(z.url)}" target="_blank" rel="noopener">Drive'da ochish ↗</a></span>` : '') + `</div></div>`;
    }
    h += `</section>`;
  }
  return h;
}

module.exports = { sahifa, qism };
