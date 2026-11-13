#!/usr/bin/env node
// AKS TIZIM — 🧪 ilova sahifasi (Index.html / Xarita.html) ichidagi skriptlar sintaksisi. Sahifa buzuq bo'lsa hech bir xodim kira olmaydi —
// shuning uchun yangi sahifa o'rnatilishidan oldin tekshiriladi.  node index_tekshir.js <fayl.html> …   → 0 — sog'; 2 — sintaksis xatosi.
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
process.exit(yomon ? 2 : 0);
