// AKS TIZIM — bosh sahifa / bo'limlarning kichik o'qish amallari serverda (natija eski tizim bilan bir xil):
//   shartnomalar (Kod.gs v9.7) · devonDirektor (Devon.gs) · bekorDirektor (Bekor.gs)
'use strict';
const S = require('./sessiya');
const V = require('../lib/varaq');
const J = require('../lib/jurnallar');

const num = x => { const n = Number(x); return isNaN(n) ? 0 : Math.round(n); };   // Kod.gs num_
const s = v => String(v == null ? '' : v);

// ------------------------------------------------------------------ Kod.gs shartnomalar (to'lov kiritish uchun ro'yxat)
async function shartnomalar([kodSes]) {
  await S.ruxsat(kodSes, 'tolov');
  const out = [];
  (await V.qatorlar('03_Sotuv_shartnomalar')).forEach(({ x: r }) => {
    if (r[0] == null || r[0] === '' || r[0] === false || r[0] === 0) return;
    out.push({ no: s(r[0]), fish: s(r[20]), dokon: s(r[5]), holati: s(r[13]), oylik: num(r[26]), qarz: num(r[30]), muddati: num(r[31]), undiruvchi: s(r[17]) });
  });
  return out;
}

// ------------------------------------------------------------------ Devon.gs: devonRows_, devonKor_, devonDirektor
const DEVON_TUR = { javob: '✉ Javob xati tayyorlansin', ijro: '📋 Ijro etilsin', malumot: "👁 Ma'lumot uchun" };
async function devonRows() {
  return (await V.qatorlar('11_Devonxona')).map(({ n, r }) => ({ qator: n, id: r[0] || '', turi: r[1] || '', tartib: r[2] || '', kiritildi: r[3] || '', kim: r[4] || '', tashkilot: r[5] || '', raqam: r[6] || '', sana: r[7] || '', mazmun: r[8] || '', fayl: r[9] || '',
    holati: r[10] || '', tur: r[11] || '', ijrochi: r[12] || '', yordam: s(r[13]).split(',').map(z => z.trim()).filter(Boolean),
    muddat: r[14] || '', rez: r[15] || '', rezVaqt: r[16] || '', ijro: r[17] || '', tarix: r[18] || '', bogliq: r[19] || '' })).filter(x => x.id);
}
function devonIjro(x) { try { return JSON.parse(x.ijro || '{}') || {}; } catch (e) { return {}; } }
function devonKor(x, bugunIso, R) {
  const Jx = devonIjro(x);
  const mIso = x.muddat ? x.muddat.split('.').reverse().join('-') : '';
  const ijro = Object.keys(Jx.top || {}).map(f => { const t = Jx.top[f]; return { fish: f, vaqt: t.v, hisobot: t.h || '', rol: t.rol, javob: t.jr ? t.jr + ' (' + t.js + ')' : '', fayl: !!t.f }; });
  const bog = x.bogliq ? (R || []).find(z => String(z.id) === String(x.bogliq)) : null;
  // eski kodda «skan» va «bet» izoh ichida qolib ketgan — javobda yo'q (bir xil bo'lishi uchun bu yerda ham yo'q)
  return { id: x.id, turi: x.turi, tartib: x.tartib, kiritildi: x.kiritildi, kim: x.kim, tashkilot: x.tashkilot, raqam: x.raqam, sana: x.sana,
    mazmun: Jx.xat && Jx.xat.mavzu ? Jx.xat.mavzu : (x.mazmun.length > 300 ? x.mazmun.slice(0, 300) + '…' : x.mazmun), gen: !!Jx.pdf,
    yub: Jx.yub ? { usul: Jx.yub.usul, sana: Jx.yub.sana, kv: Jx.yub.kv || '', bolim: Jx.yub.bolim || '', qabul: Jx.yub.qabul || '', kiruvchi: Jx.yub.kiruvchi || '', kvF: !!Jx.yub.kvF, fish: Jx.yub.fish || '', v: Jx.yub.v || '' } : null,
    yangi: x.turi === 'Kirim' && x.holati === 'Rezolyutsiya kutmoqda' && !Jx.kordi, kordi: Jx.kordi ? Jx.kordi.v + ' · ' + Jx.kordi.fish : '',
    holati: x.holati, tur: x.tur, turNomi: DEVON_TUR[x.tur] || '', ijrochi: x.ijrochi, yordam: x.yordam, muddat: x.muddat, rez: x.rez, rezVaqt: x.rezVaqt,
    kechikkan: !!(mIso && mIso < bugunIso && (x.holati === 'Ijroda')), ijro, tarix: x.tarix,
    eski: (Jx.eski || []).map(e => ({ fish: e.fish, vaqt: e.v, qaytdi: e.qaytdi })),
    bogliq: bog ? { id: bog.id, turi: bog.turi, tartib: bog.tartib, raqam: bog.raqam, sana: bog.sana } : null };
}
async function devonDirektor([kodSes]) {
  await S.ruxsat(kodSes, 'admin');
  const R = await devonRows(); const bugun = V.bugun();
  const L = R.filter(x => x.turi === 'Kirim' && (x.holati === 'Rezolyutsiya kutmoqda' || x.holati === 'Tekshiruvda')).map(x => devonKor(x, bugun, R));
  const K = L.filter(x => x.holati === 'Rezolyutsiya kutmoqda');
  return { kutmoqda: K, tekshiruv: L.filter(x => x.holati === 'Tekshiruvda'), yangi: K.filter(x => x.yangi).length };
}

// ------------------------------------------------------------------ Bekor.gs bekorDirektor
const BEKOR_YOPIQ = ['Bekor qilindi', 'Rad etildi', 'Qaytarildi'], BEKOR_SKAN_ISH_KUN = 2;
function yhIso(v) { v = s(v).trim(); if (/^\d{4}-\d{2}-\d{2}/.test(v)) return v.slice(0, 10); if (/^\d{2}\.\d{2}\.\d{4}/.test(v)) return v.slice(0, 10).split('.').reverse().join('-'); return ''; }
function bekorIshKun(sana, bugunIso) {
  const iso = yhIso(sana); if (!iso) return 0;
  let k = 0; const d = new Date(iso + 'T12:00:00Z'), ox = new Date(bugunIso + 'T12:00:00Z');
  while (d < ox) { d.setUTCDate(d.getUTCDate() + 1); if (d.getUTCDay() !== 0) k++; }
  return k;
}
async function bekorDirektor([kodSes]) {
  await S.ruxsat(kodSes, 'admin');
  const bugun = V.bugun();
  const Jr = await J.bekorJurnal();
  const kart = z => {
    const kech = (!(z.bSkan && z.xSkan) && z.sana) ? bekorIshKun(z.sana, bugun) : 0;
    return { id: z.id, no: z.no, tur: z.tur, fish: z.fish, dokon: z.dokon, holati: z.holati, sabab: z.sabab, kim: z.kim, vaqt: z.vaqt,
      raqam: z.raqam, xRaqam: z.xRaqam, sana: z.sana, shablon: z.shablon, jami: z.jami, tolangan: z.tolangan, jarima: z.jarima, qaytar: z.qaytar,
      eski: /^ESKI/.test(z.shablon), xatOgoh: z.xatOgoh, bSkan: z.bSkan, xSkan: z.xSkan, usul: z.usul, yetSana: z.yetSana,
      pochta: z.pochta, kechikdi: kech >= BEKOR_SKAN_ISH_KUN ? kech : 0, tayyor: !!(z.bSkan && z.xSkan),
      tKim: z.tKim, tVaqt: z.tVaqt, izoh: z.izoh };
  };
  return { ochiq: Jr.filter(z => BEKOR_YOPIQ.indexOf(z.holati) < 0).map(kart), arxiv: Jr.filter(z => BEKOR_YOPIQ.indexOf(z.holati) >= 0).map(kart).reverse() };
}

module.exports = { shartnomalar, devonDirektor, bekorDirektor };
