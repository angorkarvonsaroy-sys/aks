#!/usr/bin/env node
// AKS TIZIM — 🔌 EKSPORT TEKSHIRUVI (19.11.2026, direktor qarori).
// Sabab: lib/narx.js allaqachon bor edi, lekin yangi fayl deb ustidan yozilgan — natijada
// api/shartnoma.js va lib/ijara_hujjat.js ishlatadigan { NARX_JADVAL, narxHisob } yo'qolib,
// shartnoma tuzishda «narxHisob is not a function» chiqdi. Sintaksis sinovi buni ko'rmaydi,
// tutun sinovi esa bu amalni chaqirmaydi. Shuning uchun STATIK tekshiruv:
//   const { A, B } = require('./x')  →  x da A va B eksport qilinganmi
// Faqat shu shakl tekshiriladi: u aniq, noto'g'ri ogohlantirish bermaydi. «M.foo» ko'rinishidagi
// ishlatish tekshirilmaydi — o'zgaruvchi nomi mahalliy ro'yxat bilan to'qnashib, soxta xato berardi.
// Hech narsa ishga tushirilmaydi — faqat matn o'qiladi. Eksportlari aniq o'qilmagan
// modul (Object.assign, spread va h.k.) — tekshirilmaydi, noto'g'ri ogohlantirish bermасин.
//
// Ishlatish: node sinov/eksport_tekshir.js [--ildiz <server papkasi>]
// Chiqish kodi: 0 — toza; 2 — yo'q eksport topildi.
'use strict';
const fs = require('fs'), path = require('path');

const arg = process.argv.slice(2);
const i = arg.indexOf('--ildiz');
const ILDIZ = i >= 0 && arg[i + 1] ? path.resolve(arg[i + 1]) : path.resolve(__dirname, '..');
const PAPKA = ['api', 'lib', 'bin'];

function fayllar() {
  const o = [];
  PAPKA.forEach(p => {
    const d = path.join(ILDIZ, p);
    if (!fs.existsSync(d)) return;
    fs.readdirSync(d).forEach(f => { if (f.endsWith('.js')) o.push(path.join(d, f)); });
  });
  return o;
}
const oqi = f => { try { return fs.readFileSync(f, 'utf8'); } catch (e) { return ''; } };

// Modul qanday eksport qilishini matndan o'qish. { nomlar: Set, aniq: bool }
function eksportlar(matn) {
  const nom = new Set(); let aniq = false;
  // module.exports = { a, b: ..., c }   (eng ichki qavs juftini emas, birinchi balanslangan blokni olamiz)
  const m = /module\.exports\s*=\s*\{/.exec(matn);
  if (m) {
    let k = m.index + m[0].length - 1, chuq = 0, oxir = -1;
    for (let j = k; j < matn.length; j++) {
      if (matn[j] === '{') chuq++;
      else if (matn[j] === '}') { chuq--; if (!chuq) { oxir = j; break; } }
    }
    if (oxir > 0) {
      const ich = matn.slice(k + 1, oxir);
      if (/\.\.\./.test(ich)) return { nom, aniq: false };          // spread — aniq o'qib bo'lmaydi
      aniq = true;
      // faqat eng yuqori darajadagi vergullar bo'yicha bo'lamiz
      let chuq2 = 0, bosh = 0; const bolak = [];
      for (let j = 0; j <= ich.length; j++) {
        const c = ich[j];
        if (c === '{' || c === '(' || c === '[') chuq2++;
        else if (c === '}' || c === ')' || c === ']') chuq2--;
        if (j === ich.length || (c === ',' && !chuq2)) { bolak.push(ich.slice(bosh, j)); bosh = j + 1; }
      }
      bolak.forEach(b => { const t = /^\s*([A-Za-z_$][\w$]*)\s*(:|$)/.exec(b.replace(/\/\/[^\n]*/g, '')); if (t) nom.add(t[1]); });
    }
  }
  // module.exports.X = ... / exports.X = ... / Object.defineProperty(A, 'X'
  let r;
  const re1 = /(?:module\.)?exports\.([A-Za-z_$][\w$]*)\s*=/g;
  while ((r = re1.exec(matn))) { nom.add(r[1]); aniq = aniq || true; }
  if (/Object\.assign\s*\(\s*(module\.)?exports/.test(matn)) return { nom, aniq: false };
  return { nom, aniq };
}

// _ichki ichidagi nomlar
function ichkiNomlar(matn) {
  const m = /module\.exports\._ichki\s*=\s*\{([\s\S]*?)\};/.exec(matn);
  const nom = new Set();
  if (!m) return { nom, aniq: false };
  if (/\.\.\./.test(m[1])) return { nom, aniq: false };
  m[1].split(',').forEach(b => { const t = /^\s*([A-Za-z_$][\w$]*)\s*(:|$)/.exec(b); if (t) nom.add(t[1]); });
  return { nom, aniq: true };
}

const F = fayllar(), KESH = {};
function modulOqi(p) { if (!(p in KESH)) KESH[p] = oqi(p); return KESH[p]; }
function yol(fayl, rel) {
  if (!rel.startsWith('.')) return '';
  let p = path.resolve(path.dirname(fayl), rel);
  if (fs.existsSync(p) && fs.statSync(p).isFile()) return p;
  if (fs.existsSync(p + '.js')) return p + '.js';
  return '';
}

const xato = [];
F.forEach(f => {
  const matn = oqi(f), qisqa = path.relative(ILDIZ, f);
  let r;
  // 1) const { A, B } = require('./x')   va   = require('./x')._ichki
  const re = /const\s*\{([^}]*)\}\s*=\s*require\(\s*['"]([^'"]+)['"]\s*\)\s*(\._ichki)?\s*;/g;
  while ((r = re.exec(matn))) {
    const p = yol(f, r[2]); if (!p) continue;
    const E = r[3] ? ichkiNomlar(modulOqi(p)) : eksportlar(modulOqi(p));
    if (!E.aniq) continue;
    r[1].split(',').forEach(b => {
      const t = /^\s*([A-Za-z_$][\w$]*)/.exec(b.replace(/:.*$/, '')); if (!t) return;
      if (!E.nom.has(t[1])) xato.push(qisqa + ': ' + r[2] + (r[3] || '') + ' da «' + t[1] + '» eksport qilinmagan');
    });
  }
});

console.log('  eksport tekshiruvi: ' + F.length + ' ta fayl' + (xato.length ? '' : ' — toza'));
xato.slice(0, 20).forEach(x => console.log('  ✗ ' + x));
if (xato.length > 20) console.log('  … yana ' + (xato.length - 20) + ' ta');
process.exit(xato.length ? 2 : 0);
