// AKS TIZIM — hujjatlar bo'limining O'QIYDIGAN qismi (Hujjat.gs v25.9 dagi hujjatBoshlang / hujjatlarRoyxati bilan bir xil).
// Yuklash (hujjatYukla), tuzatish (hujjatTuzat), nazorat (hujjatNazorat) — hali ko'prik orqali eski tizimda (Drive'ga yozadi).
'use strict';
const S = require('./sessiya');
const V = require('../lib/varaq');
const J = require('../lib/jurnallar');

const HUJJAT_MAX_MB = 25;
const HUJJAT_TURLARI = [
  ['SHARTNOMA', 'Shartnoma (imzolangan)'], ['QOSHIMCHA_KELISHUV', "Qo'shimcha kelishuv"], ['NOTARIAL', 'Notarial hujjat'],
  ['PASPORT', 'Pasport nusxasi'], ['OGOHLANTIRISH', 'Ogohlantirish xati'], ['XAT_CHIQUVCHI', 'Chiquvchi xat'],
  ['XAT_KIRUVCHI', 'Kiruvchi xat (ariza)'], ['POCHTA', 'Pochta kvitansiyasi'], ['DALOLATNOMA', 'Dalolatnoma'],
  ['XAT_OLDIM', 'Xat topshirildi (mijoz imzosi)'], ['YOZISHMA', 'Yozishma skrinshoti (SMS/Telegram)'], ['DAVO', "Da'vo arizasi"], ['SUD_AJRIM', 'Sud ajrimi (ish yuritishga qabul)'],
  ['SUD_QARORI', 'Sud qarori'], ['IJRO_VARAQASI', 'Ijro varaqasi'], ['MIB', 'MIB hujjati'], ['SUD', 'Sud hujjati (boshqa)'],
  ['BEKOR_BUYRUQ', 'Бекор қилиш буйруғи'], ['BEKOR_XABARNOMA', 'Бекор қилиш хабарномаси'], ['BOSHQA', 'Boshqa']];

// Undiruv.gs undCheklov_: undiruvchi (shartnoma tuzmaydigan) — faqat o'z portfeli
const undCheklov = u => (!u.admin && u.huquq.includes('undiruv') && !u.huquq.includes('shartnoma')) ? u.fish : '';

// v25.9: shu xodimga direktor bergan, hali «Jarayonda» turgan topshiriqlardagi shartnoma raqamlari
async function topShartnoma(fish) {
  const o = {};
  (await V.qatorlar('10_Topshiriqlar')).forEach(({ r }) => {
    const no = String(r[7] || '').trim();
    if (no && String(r[2] || '').trim() === 'Direktor' && String(r[9] || '').trim() === fish && String(r[13] || '').trim() === 'Jarayonda') o[no] = true;
  });
  return o;
}

async function royxat(u) {
  const s = v => String(v == null ? '' : v);
  const MIJ = {}; (await V.qatorlar('02_Mijozlar')).forEach(({ x }) => { if (x[0] != null && x[0] !== '') MIJ[s(x[0])] = s(x[2]); });
  let L = [];
  (await V.qatorlar('03_Sotuv_shartnomalar')).forEach(({ x }) => {
    const no = s(x[0]).trim(); if (!/^27\/\d+$/.test(no)) return;
    L.push({ no, tur: 'sotuv', fish: s(x[20]) || MIJ[s(x[4])] || '', mid: s(x[4]), dokon: s(x[5]), sana: V.iso(x[2]), holati: s(x[13]), und: s(x[17]).trim() });
  });
  (await V.qatorlar('04_Ijara_shartnomalar')).forEach(({ x }) => {
    const no = s(x[0]).trim(); if (!/^IJ-27\/\d+$/.test(no)) return;
    L.push({ no, tur: 'ijara', fish: s(x[23]) || MIJ[s(x[5])] || '', mid: s(x[5]), dokon: s(x[4]), sana: V.iso(x[1]), holati: s(x[2]) });
  });
  const bor = {}; (await J.hujjatJurnal()).forEach(h => { if (h.holati === 'Faol') { (bor[h.no] = bor[h.no] || { soni: 0, shartnoma: false }).soni++; if (h.turi === 'SHARTNOMA') bor[h.no].shartnoma = true; } });
  L.forEach(x => { const b = bor[x.no]; x.hujjat = b ? b.soni : 0; x.skan = !!(b && b.shartnoma); });
  const ch = undCheklov(u);
  if (ch) {
    const T = await topShartnoma(u.fish);
    L = L.filter(x => x.und === ch || T[x.no]);
    L.forEach(x => { if (x.und !== ch) x.holati = (x.holati ? x.holati + ' · ' : '') + '📌 topshiriq bo\'yicha'; });
  }
  return L;
}

async function hujjatBoshlang([kodSes]) {
  const u = await S.ruxsat(kodSes, 'hujjat');
  return { royxat: await royxat(u), turlar: HUJJAT_TURLARI, bugun: V.bugun(), admin: u.admin, maxMb: HUJJAT_MAX_MB };
}

function tuzatHuquq(u, h) {
  if (u.admin) return true;
  const bugun = V.bugun().split('-').reverse().join('.');
  return h.kim === u.fish && String(h.vaqt).indexOf(bugun) === 0;
}

async function hujjatlarRoyxati([kodSes, no]) {
  const u = await S.ruxsat(kodSes, 'hujjat');
  if (undCheklov(u) && !(await royxat(u)).some(x => x.no === String(no))) throw new S.Xato('Bu shartnoma sizning portfelingizda emas.');
  return (await J.hujjatJurnal()).filter(h => h.no === String(no) && h.holati === 'Faol')
    .map(h => ({ id: h.id, turi: h.turi, sana: h.sana, nom: h.nom, kim: h.kim, vaqt: h.vaqt, sahifa: h.sahifa, izoh: h.izoh, tuzat: tuzatHuquq(u, h),
      url: u.admin && !/^SRV:/.test(String(h.faylId)) ? 'https://drive.google.com/file/d/' + h.faylId + '/view' : '' }));   // SRV: — hali Drive'ga ko'chmagan
}

module.exports = { hujjatBoshlang, hujjatlarRoyxati };
module.exports.HUJJAT_TURLARI = HUJJAT_TURLARI;   // Yurist bo'limi ham ishlatadi (amal emas)
