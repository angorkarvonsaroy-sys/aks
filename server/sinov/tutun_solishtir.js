#!/usr/bin/env node
// AKS TIZIM — 🧪 tutun sinovi natijalarini solishtirish: ESKI (ishlab turgan) kod bilan YANGI kod.
// Faqat YANGI kodda paydo bo'lgan dastur xatolari yangilanishni to'xtatadi; eskida ham bor bo'lganlari — ogohlantirish xolos
// (aks holda eskidan qolgan bitta xato barcha keyingi tuzatishlarni ham to'sib qo'yardi).
// Ishlatish: node tutun_solishtir.js <eski.txt> <yangi.txt> [xabar.txt]   → chiqish kodi: 0 — o'rnatilsin; 2 — o'rnatilmasin.
'use strict';
const fs = require('fs');
const oqi = f => { try { const m = fs.readFileSync(f, 'utf8').split('\n').filter(z => z.indexOf('TUTUN_JSON:') === 0).pop(); return m ? JSON.parse(m.slice(11)) : null; } catch (e) { return null; } };
const kalit = x => x.fn + '|' + x.tur + '|' + String(x.xabar).replace(/\d+/g, '#');
const [, , fE, fY, fX] = process.argv;
const E = oqi(fE), Y = oqi(fY);
if (!Y) { console.log('  tutun: yangi kod natijasi o\'qilmadi — sinab bo\'lmadi, o\'rnatish davom etadi'); process.exit(0); }
const hammasi = x => (x.yuklash || []).concat(x.xato || []);
const eski = {}; if (E) hammasi(E).forEach(x => { eski[kalit(x)] = 1; });
const yangi = hammasi(Y).filter(x => !eski[kalit(x)]), qolgan = hammasi(Y).filter(x => eski[kalit(x)]);
const s = Y.soni || {};
console.log('  tutun: fayl ' + (s.fayl || 0) + ' · xodim ' + (s.xodim || 0) + ' · amal ' + (s.amal || 0) + ' · o\'tdi ' + (s.otdi || 0) + (E ? '' : ' · (eski kod natijasi yo\'q — solishtirilmadi)'));
qolgan.forEach(x => console.log('  ⚠ eskidan bor: ' + x.fn + ' — ' + x.tur + ': ' + x.xabar + (x.joy ? ' @ ' + x.joy : '')));
if (!yangi.length) { console.log('  tutun: yangi dastur xatosi yo\'q ✅'); process.exit(0); }
yangi.forEach(x => console.log('  ✗ YANGI: ' + x.fn + ' — ' + x.tur + ': ' + x.xabar + (x.joy ? ' @ ' + x.joy : '') + (x.rollar ? ' [' + x.rollar.slice(0, 3).join(', ') + ']' : '')));
if (fX) { const esc = v => String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  try { fs.writeFileSync(fX, yangi.slice(0, 8).map(x => '• <b>' + esc(x.fn) + '</b>' + (x.rollar ? ' (' + esc(x.rollar[0]) + ')' : '') + ' — ' + esc(x.tur + ': ' + x.xabar) + (x.joy ? '\n   ' + esc(x.joy) : '')).join('\n')
    + (yangi.length > 8 ? '\n… yana ' + (yangi.length - 8) + ' ta' : '')); } catch (e) { } }
process.exit(2);
