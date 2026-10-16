// AKS TIZIM — 👤 Mijozlar: qidiruv (Mijoz.gs v2.2 dagi mijozQidir ning serverdagi o'rni).
// Manba: ko'zgudagi 02_Mijozlar, 03_Sotuv_shartnomalar, 04_Ijara_shartnomalar. Natija eski tizim bilan BIR XIL shaklda.
'use strict';
const S = require('./sessiya');
const V = require('../lib/varaq');

const MJ_HUQUQ = ['shartnoma', 'undiruv', 'hujjat', 'tolov', 'xat', 'yurist'];

async function mjRuxsat(kodSes) {
  const u = await S.ruxsat(kodSes);
  if (!u.admin && !MJ_HUQUQ.some(h => u.huquq.includes(h))) throw new S.Xato('Mijozlar bo\'limiga ruxsatingiz yo\'q.');
  return u;
}

// qidiruv uchun: kirill → lotin, harf farqlari tenglashtiriladi (Mijoz.gs mjLat_ bilan bir xil)
const K = { 'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'ё': 'yo', 'ж': 'j', 'з': 'z', 'и': 'i', 'й': 'y', 'к': 'k', 'л': 'l', 'м': 'm', 'н': 'n', 'о': 'o', 'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u', 'ф': 'f', 'х': 'x', 'ц': 'ts', 'ч': 'ch', 'ш': 'sh', 'щ': 'sh', 'ъ': '', 'ы': 'i', 'ь': '', 'э': 'e', 'ю': 'yu', 'я': 'ya', 'ў': 'o', 'қ': 'k', 'ғ': 'g', 'ҳ': 'x' };
function lat(s) {
  return String(s || '').toLowerCase().replace(/[ʻʼ'`’‘]/g, '').split('').map(c => K[c] !== undefined ? K[c] : c).join('')
    .replace(/kh/g, 'x').replace(/(^|[^sc])h/g, '$1x').replace(/q/g, 'k').replace(/\s+/g, ' ').trim();
}

// mid → [{no, tur, dokon, holati}]
async function shartnomalar() {
  const SH = {};
  (await V.qatorlar('03_Sotuv_shartnomalar')).forEach(({ r }) => {
    if (!r[0]) return; const mid = String(r[4] || '').trim();
    (SH[mid] = SH[mid] || []).push({ no: String(r[0]).trim(), tur: 'sotuv', dokon: String(r[5] || ''), holati: String(r[13] || '') });
  });
  (await V.qatorlar('04_Ijara_shartnomalar')).forEach(({ r }) => {
    if (!r[0]) return; const mid = String(r[5] || '').trim();
    (SH[mid] = SH[mid] || []).push({ no: String(r[0]).trim(), tur: 'ijara', dokon: String(r[4] || ''), holati: String(r[2] || '') });
  });
  return SH;
}

async function mijozQidir([kodSes, q]) {
  await mjRuxsat(kodSes);
  q = String(q || '').trim(); if (q.length < 2) return { royxat: [] };
  const ql = lat(q), qd = q.replace(/\D/g, ''), qu = q.toUpperCase().replace(/\s/g, '');
  const SH = await shartnomalar();
  const R = [];
  (await V.qatorlar('02_Mijozlar')).forEach(({ r }) => {
    if (!r[0]) return;
    const id = String(r[0]).trim(), fish = String(r[2] || ''), tel = String(r[4] || '').replace(/\D/g, ''), tel2 = String(r[5] || '').replace(/\D/g, ''), pas = String(r[6] || '').toUpperCase().replace(/\s/g, '');
    const sh = SH[id] || [];
    const mos = lat(fish).indexOf(ql) >= 0 || (qd.length >= 4 && (tel.indexOf(qd) >= 0 || tel2.indexOf(qd) >= 0)) || (qu.length >= 4 && pas.indexOf(qu) >= 0) || id === q
      || sh.some(s => s.no.toUpperCase().indexOf(qu) >= 0 && qu.length >= 3) || sh.some(s => s.dokon.toUpperCase() === qu);
    if (mos) R.push({ id, fish, tel: r[4] || '', pasport: r[6] || '', shartnomalar: sh.map(s => s.no + (s.holati && /bekor|yakun/i.test(s.holati) ? ' (' + s.holati + ')' : '')), dokonlar: sh.map(s => s.dokon).filter(Boolean) });
  });
  return { royxat: R.slice(0, 25), jami: R.length };
}

module.exports = { mijozQidir };
