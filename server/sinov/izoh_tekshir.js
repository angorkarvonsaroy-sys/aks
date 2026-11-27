#!/usr/bin/env node
// AKS TIZIM — 🧪 server JS fayllarida «//» izohi o'sha qatordagi KODNI yutib yuborgan holat. 27.11.2026 (6edc768): api/shartnoma.js return
// qatorining o'rtasiga «// …» qo'yilgan — qatorning qolgan maydonlari (turlar, undiruvchilar…) izoh ichida qolib, Yangi shartnoma oynasi
// 20 daqiqa ishlamagan. Sintaksis sog' (node --check o'tadi), shuning uchun alohida tekshiriladi. index_tekshir.js dagi shu qoida — server uchun.
//   node sinov/izoh_tekshir.js --ildiz <server papkasi>   → 0 — toza; 2 — shubhali qator bor.
'use strict';
const fs = require('fs'), path = require('path');
let ildiz = '.'; const a = process.argv.indexOf('--ildiz'); if (a > 0) ildiz = process.argv[a + 1];
const fayllar = [];
(function yur(d) { for (const n of fs.readdirSync(d)) { if (n === 'node_modules' || n[0] === '.') continue; const p = path.join(d, n); const st = fs.statSync(p);
  if (st.isDirectory()) yur(p); else if (/\.js$/.test(n)) fayllar.push(p); } })(ildiz);
let yomon = 0, n = 0;
for (const f of fayllar) { const s = fs.readFileSync(f, 'utf8'); n++;
  s.split('\n').forEach((l0, i) => {
    // regex literal ichidagi «//» (masalan /^\/?xl\//) — izoh emas: regex literal o'rniga shu uzunlikda bo'sh joy qo'yiladi (ustun saqlanadi)
    const l = l0.replace(/(^|[(,=:\[!&|?{};]\s*)\/(?:[^/\\\n]|\\.)+\/[gimsuy]*/g, (m, p) => p + ' '.repeat(m.length - p.length));
    // izohdan KEYIN shu qatorda kod belgisi: «,» bilan davom etayotgan obyekt maydoni, yoki const/let/var/return/if/for/function
    const m = /\/\/[^\n]*?(\b(?:const|let|var|return|function|if|for|while)\s|\b[A-Za-z_$][\w$]*\s*:\s*[A-Za-z_$'"\d]|\b[A-Za-z_$][\w$]*\s*,\s*[A-Za-z_$][\w$]*\s*:\s)/.exec(l); if (!m) return;
    const old = l.slice(0, m.index);
    if (old.endsWith(':') || /[:=]\s*["'`]?$/.test(old)) return;                                   // http:// va shunga o'xshash
    if ((old.match(/'/g) || []).length % 2 || (old.match(/"/g) || []).length % 2 || (old.match(/`/g) || []).length % 2) return;   // satr ichida
    if (/^\s*\/\//.test(l)) return;                                                                // butun qator izoh
    const izoh = l.slice(m.index + 2);
    // haqiqiy izohlar ham «a, b: …» yoki «if …» so'zlarini ishlatadi — faqat izoh OXIRIDA «,» yoki «{» bilan tugasa, yoki «return {» / «: NARX_JADVAL,» kabi kod ko'rinishi bo'lsa shubha
    if (!/[,{(]\s*$/.test(izoh) && !/\b(return|const|let|var)\s+[A-Za-z_$][\w$]*\s*[={(]/.test(izoh)) return;
    console.log('  ✗ ' + path.relative(ildiz, f) + ':' + (i + 1) + ' — «//» izohidan keyin shu qatorda kod qolib ketganga o\'xshaydi (izoh uni yutib yuboradi):');
    console.log('      ' + l.slice(m.index, m.index + 140).trim()); yomon++; }); }
console.log('  izoh tekshiruvi: ' + n + ' ta fayl' + (yomon ? '' : ' — toza'));
process.exit(yomon ? 2 : 0);
