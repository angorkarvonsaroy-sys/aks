#!/usr/bin/env node
// AKS TIZIM — 🧪 ilova sahifasi (Index.html / Xarita.html) ichidagi skriptlar sintaksisi. Sahifa buzuq bo'lsa hech bir xodim kira olmaydi —
// shuning uchun yangi sahifa o'rnatilishidan oldin tekshiriladi.  node index_tekshir.js <fayl.html> …   → 0 — sog'; 2 — sintaksis xatosi yoki tugmaga bog'langan funksiya ta'riflanmagan.
'use strict';
const fs = require('fs'), vm = require('vm');
let yomon = 0;
for (const f of process.argv.slice(2)) {
  let s; try { s = fs.readFileSync(f, 'utf8'); } catch (e) { console.log('  sahifa o\'qilmadi: ' + f); continue; }
  if (s.length < 1000) { console.log('  ✗ ' + f + ': sahifa juda qisqa (' + s.length + ' belgi) — buzuq'); yomon++; continue; }
  const B = []; s.replace(/<script(?![^>]*\bsrc=)([^>]*)>([\s\S]*?)<\/script>/gi, (m, a, kod) => { if (!/type\s*=\s*["']?(text\/template|application\/json)/i.test(a)) B.push(kod); return m; });
  let n = 0;
  B.forEach((kod, i) => { const k = kod.replace(/<\?!?=[\s\S]*?\?>/g, 'null'); if (!k.trim()) return; n++;
    try { new vm.Script(k, { filename: f + '#skript' + (i + 1) }); }
    catch (e) { yomon++; console.log('  ✗ ' + f.split('/').pop() + ' — ' + (i + 1) + '-skript: ' + e.name + ': ' + e.message + (e.stack ? ' (' + String(e.stack).split('\n')[0].replace(/^.*#skript\d+:?/, 'qator ') + ')' : '')); } });
  if (!yomon) console.log('  ' + f.split('/').pop() + ': ' + n + ' ta skript, sintaksis sog\'');
}
// 14.11.2026: TUGMAGA BOG'LANGAN FUNKSIYA TA'RIFLANGANMI (onclick="fn(…)" va shu kabi). v27.78 da «qyAriza» funksiyasining ta'rifi tushib qolgan, chaqiruvi
// esa qolgan — «📄 Mijoz arizasi» tugmasi 8 kun davomida hech narsa qilmagan, buni hech kim bilmagan. Endi bunday sahifa o'rnatilmaydi.
// Ta'riflar hamma berilgan sahifalardan birga yig'iladi (Index ↔ Xarita bir-birining funksiyalarini chaqiradi). Index dagi topilmagan nom — xato (2);
// boshqa sahifadagisi — faqat ogohlantirish (u sahifa bu yerda sinalmagan).
const ICHKI = new Set('if for while switch return typeof new function alert confirm prompt setTimeout clearTimeout setInterval clearInterval parseInt parseFloat Number String Boolean Math Date JSON Object Array event this document window location history navigator console encodeURIComponent decodeURIComponent isNaN isFinite void delete catch try else do in of Promise fetch requestAnimationFrame open close print scrollTo getComputedStyle RegExp Error Symbol Map Set'.split(' '));
function tarifNomlari(s) { const D = new Set(); let m;
  const R = [/\bfunction\s+([A-Za-z_$][\w$]*)\s*\(/g, /\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=/g, /\bwindow\.([A-Za-z_$][\w$]*)\s*=/g, /[,;{]\s*([A-Za-z_$][\w$]*)\s*=\s*(?:function\b|\([^)]*\)\s*=>|[A-Za-z_$][\w$]*\s*=>)/g];
  R.forEach(re => { while ((m = re.exec(s))) D.add(m[1]); }); return D; }
function tugmaChaqiruvlari(s) { const C = {}; let m;
  const re = /on(?:click|change|input|toggle|keyup|keydown|keypress|submit|blur|focus|touchstart|pointerdown|mousedown)\s*=\s*(\\?['"])([\s\S]{0,400}?)\1/g;
  while ((m = re.exec(s))) { const q = m[2], ri = /(?:^|[;{}?:&|!=(,\s])\s*([A-Za-z_$][\w$]*)\s*\(/g; let k;
    while ((k = ri.exec(q))) { const nom = k[1], bosh = k.index + k[0].indexOf(nom); if (ICHKI.has(nom)) continue; if (/[.\w$]$/.test(q.slice(0, bosh))) continue;
      (C[nom] = C[nom] || []).push(s.slice(0, m.index).split('\n').length); } }
  return C; }
{ const SAH = []; for (const f of process.argv.slice(2)) { try { const s = fs.readFileSync(f, 'utf8'); if (s.length >= 1000) SAH.push({ f, s }); } catch (e) { } }
  const D = new Set(); SAH.forEach(z => tarifNomlari(z.s).forEach(n => D.add(n)));
  SAH.forEach(z => { const C = tugmaChaqiruvlari(z.s), yoq = Object.keys(C).filter(n => !D.has(n)), nom = z.f.split('/').pop(), asosiy = /index/i.test(nom);
    if (!yoq.length) { console.log('  ' + nom + ': tugmalarga bog\'langan ' + Object.keys(C).length + ' ta funksiya — hammasi ta\'riflangan'); return; }
    yoq.forEach(n => console.log('  ' + (asosiy ? '✗' : '⚠') + ' ' + nom + ': tugmaga bog\'langan «' + n + '» funksiyasi ta\'riflanmagan (qator ' + [...new Set(C[n])].slice(0, 4).join(', ') + ') — tugma bosilganda hech narsa bo\'lmaydi'));
    if (asosiy) yomon += yoq.length; }); }
process.exit(yomon ? 2 : 0);
