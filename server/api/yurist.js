// AKS TIZIM — ⚖ Yurist bo'limining O'QIYDIGAN qismi serverda (Yurist.gs v25.9 bilan BIR XIL natija):
//   yuristBoshlang (ro'yxat + direktor bloklari) · yuristIsh (ish kartasi)
// Yozadigan amallar (yuristKeyingi, yuristRad, yuristQabul, yuristHolat, yuristTasdiq, yuristTopBer, yuristHujjat — Drive) — hali ko'prik orqali.
// Eski yuristBoshlang qarzi yopilgan ishlarni o'zi yopardi (yuAvtoYop_); server yozmaydi — shunday ish ko'rsa, fonda eskisini chaqiradi.
'use strict';
const S = require('./sessiya');
const V = require('../lib/varaq');
const J = require('../lib/jurnallar');
const U = require('../lib/undiruv_yordam');
const X = require('../lib/xat_yordam');
const koprik = require('./koprik');
const { HUJJAT_TURLARI } = require('./hujjat');

const YU_BOSQICH = { 1: "Yuristga o'tdi", 2: "Da'vo berildi", 3: 'Sud jarayonida', 4: 'Sud qarori chiqdi', 5: 'Qaror kuchga kirdi', 6: 'Ijro varaqasi olindi', 7: 'MIB da ijroda' };
const YU_KEYINGI = { 1: "Da'vo arizasini berish", 2: 'Sud ish yuritishga qabul qilishi', 3: 'Sud qarori', 4: 'Qaror kuchga kirishi', 5: 'Ijro varaqasini olish', 6: 'MIB ga topshirish', 7: 'MIB ijrosi' };
const YU_MUDDAT = { 1: 5, 2: 5, 3: 60, 4: 30, 5: 7, 6: 4, 7: 60 };
const YU_QABUL_KUN = 1, YU_ARIZA_SHOSH = 2, YU_QABUL_BOSH = '2026-10-16';
const YU_HUJJAT = { 2: 'DAVO', 3: 'SUD_AJRIM', 4: 'SUD_QARORI', 6: 'IJRO_VARAQASI', 7: 'MIB' };
const YU_TREK = {
  Davo: { nomi: "Da'vo tartibida", zanjir: [1, 2, 3, 4, 5, 6, 7], bosqich: YU_BOSQICH, keyingi: YU_KEYINGI, muddat: YU_MUDDAT, hujjat: YU_HUJJAT, yurist: [1, 5, 6], ariza: "Da'vo arizasi" },
  Buyruq: { nomi: 'Buyruq tartibida', zanjir: [1, 2, 4, 7],
    bosqich: { 1: "Yuristga o'tdi", 2: 'Ariza berildi (buyruq)', 4: "Sud buyrug'i chiqdi", 7: 'MIB da ijroda' },
    keyingi: { 1: 'Sudga ariza berish (buyruq tartibida)', 2: "Sud buyrug'i (yoki rad)", 4: 'MIB da ijroga tushishi', 7: 'MIB ijrosi' },
    muddat: { 1: 5, 2: 4, 4: 1, 7: 60 }, hujjat: { 2: 'SUD', 4: 'SUD', 7: '' }, yurist: [1, 4], ariza: 'Ariza (buyruq chiqarish to\'g\'risida)' } };
const YU_QARORLAR = ['Қаноатлантирилди', 'Қисман қаноатлантирилди', 'Рад этилди'];
const YU_SUD = 'Шеробод туманлараро фуқаролик ишлари бўйича суди';
const YU_FAOL = ['Faol', 'Kelishuv', "Yopish so'ralgan"];
const YU_KUTISH_KUN = 7;
const YU_TOP_TUR = [['PASPORT', 'Mijoz pasport nusxasini yuklang'], ['SHARTNOMA', 'Imzolangan shartnoma skanini yuklang'], ['NOTARIAL', 'Notarial hujjat nusxasini yuklang'],
  ['QOSHIMCHA_KELISHUV', 'Qo\'shimcha kelishuv / dalolatnoma skanini yuklang'], ['JSHSHIR', 'Mijozning JSHSHIR ini toping (14 raqam)'], ['MANZIL', 'Mijozning yashash manzilini aniqlang'],
  ['BOSHQA', 'Boshqa']];
const YUX_TUR = { ALOQA_SSP: 'Алоқа хати (ССП)' };

const kun = U.kun, qosh = U.kunQosh;
const yuDmy = iso => iso ? String(iso).split('-').reverse().join('.') : '';
const yuTrek = i => YU_TREK[i && i.tartib === 'Buyruq' ? 'Buyruq' : 'Davo'];
const yuKeyingiB = (T, b) => { const k = T.zanjir.indexOf(Number(b)); return k >= 0 && k + 1 < T.zanjir.length ? T.zanjir[k + 1] : 0; };
function yuIshKun(iso, n) {                              // sana + n ish kuni (yakshanba hisobga olinmaydi)
  let d = new Date(String(iso).slice(0, 10) + 'T12:00:00Z'), k = 0;
  while (k < n) { d = new Date(d.getTime() + 86400000); if (d.getUTCDay() !== 0) k++; }
  return d.toISOString().slice(0, 10);
}
const ishRe = i => new RegExp('^yutop\\|' + String(i.no).replace('/', '\\/') + '\\|[^|]+\\|' + i.id + '$');
function yuPauza(TP, i, bosh, bugun) {
  const re = ishRe(i);
  const iso = v => { const m = /^(\d{2})\.(\d{2})\.(\d{4})/.exec(String(v || '')); return m ? m[3] + '-' + m[2] + '-' + m[1] : ''; };
  const A = (TP || []).filter(t => re.test(String(t.kalit || '')) && t.holati !== 'Bekor').map(t => [iso(t.yaratildi), (t.holati === 'Jarayonda' || t.holati === 'Tekshiruvda') ? bugun : (iso(t.yopildi) || bugun)])
    .map(z => [z[0] < bosh ? bosh : z[0], z[1] > bugun ? bugun : z[1]]).filter(z => z[0] && z[1] > z[0]).sort((a, b) => a[0] < b[0] ? -1 : 1);
  let n = 0, oxir = '';
  A.forEach(z => { const s0 = oxir && z[0] < oxir ? oxir : z[0]; if (z[1] > s0) n += kun(s0, z[1]); if (!oxir || z[1] > oxir) oxir = z[1]; });
  return n;
}

// 06f_Yurist_tarix: ish → birinchi «Ish qabul qilindi…» yozuvi
async function yuQabulMap() {
  const o = {};
  (await V.qatorlar('06f_Yurist_tarix')).forEach(({ r }) => { if (!/^Ish qabul qilindi/.test(String(r[3]))) return; const id = String(r[1]); if (o[id]) return;
    const m = /^(\d{2})\.(\d{2})\.(\d{4})/.exec(String(r[0])); o[id] = { sana: m ? m[3] + '-' + m[2] + '-' + m[1] : '', vaqt: String(r[0]).slice(0, 16), kim: r[4], kamchilik: /kamchilik/i.test(String(r[3])), izoh: r[5] }; });
  return o;
}
async function yuKesh() { return { Q: await yuQabulMap(), TP: (await J.topRows()).filter(t => /^yutop\|/.test(String(t.kalit || ''))) }; }
async function yuTarixOl(id) {
  return (await V.qatorlar('06f_Yurist_tarix')).map(({ r }) => r).filter(r => String(r[1]) === String(id)).reverse()
    .map(r => ({ vaqt: r[0], voqea: r[3], kim: r[4], izoh: r[5], hujjat: r[6] }));
}

function yuKorinish(i, x, bugun, K) {
  x = x || {}; const T = yuTrek(i);
  let kechikdi = 0, eslatma = '', chegara = '', yuMas = false, pauza = 0;
  const q = (K.Q || {})[String(i.id)] || null;
  const qabulKerak = i.holati === 'Faol' && i.bosqich === 1 && !!i.topshirilgan && i.topshirilgan >= YU_QABUL_BOSH && !q;
  const shosh = (Number(x.muddati) || 0) > 0 && (Number(x.davoKun != null ? x.davoKun : x.kechikkan) || 0) >= 1095 - 90;
  if (qabulKerak) {
    chegara = yuIshKun(i.topshirilgan, YU_QABUL_KUN); yuMas = true; eslatma = 'qabul qilish muddati ' + yuDmy(chegara);
  } else if (i.holati === 'Faol' && T.muddat[i.bosqich] && i.bosqichSana) {
    yuMas = (T.yurist || []).indexOf(i.bosqich) >= 0;
    let bosh = i.bosqichSana, n = T.muddat[i.bosqich];
    if (i.bosqich === 1) { if (q && q.sana > bosh) bosh = q.sana; if (shosh) n = Math.min(n, YU_ARIZA_SHOSH); }
    chegara = yuMas ? yuIshKun(bosh, n) : qosh(bosh, n);
    if (i.bosqich === 1) { pauza = yuPauza(K.TP, i, bosh, bugun); if (pauza) chegara = qosh(chegara, pauza); }
    if (i.bosqich === 3 && i.majlis) { chegara = i.majlis; eslatma = 'keyingi majlis ' + yuDmy(i.majlis); }
    if (!eslatma) eslatma = 'muddat ' + yuDmy(chegara) + (pauza ? ' (kamchilik topshirig\'i: +' + pauza + ' kun)' : '') + (i.bosqich === 1 && shosh ? ' · shoshilinch' : '');
  }
  if (chegara) kechikdi = Math.max(0, kun(chegara, bugun));
  const fishQ = String(x.fish || i.fish || '').split(/\s+/).slice(0, 2).join(' ');
  return { id: i.id, no: i.no, fish: x.fish || i.fish, fishQ, dokon: x.dokon || i.dokon, tel: x.tel || '', manzil: x.manzil || '',
    jami: x.jami != null ? x.jami : 0, muddati: x.muddati || 0, qoshimcha: x.qoshimcha || 0, bosqich: i.bosqich, bosqichNomi: T.bosqich[i.bosqich] || '—',
    keyingi: qabulKerak ? 'Ishni qabul qilish (hujjatlarni tekshirish)' : (!i.tartib && i.bosqich === 1) ? 'Sudga ariza berish' : (T.keyingi[i.bosqich] || ''), keyingiB: yuKeyingiB(T, i.bosqich), bosqichSana: i.bosqichSana, holati: i.holati, kechikdi, eslatma, yol: i.yol,
    chegara, yuMas, qabulKerak, qabul: q, shosh, pauza,
    tartib: i.tartib, tartibNomi: i.tartib ? T.nomi : '', zanjir: T.zanjir, radIzoh: i.radIzoh,
    topshirilgan: i.topshirilgan, davoNo: i.davoNo, davoSana: i.davoSana, sudNomi: i.sudNomi, sudIshNo: i.sudIshNo, qarorSana: i.qarorSana, qaror: i.qaror,
    kuchSana: i.kuchSana, ijroNo: i.ijroNo, ijroSana: i.ijroSana, ijrochi: i.ijrochi, mibSana: i.mibSana, majlis: i.majlis,
    undiruvchi: i.undiruvchi, sorovSabab: i.sorovSabab, yopishSabab: i.yopishSabab, tasdiqladi: i.tasdiqladi };
}

const { yuMezon } = require('../lib/portfel');   // U4 mezoni — portfel bilan umumiy

// ------------------------------------------------------------------ yurist / direktor ekrani
async function yuristBoshlang([kodSes]) {
  const u = await S.ruxsat(kodSes, 'yurist'); const adm = u.admin;
  const bugun = V.bugun();
  const Sh = {}; (await U.undShartnomalar()).forEach(x => Sh[x.no] = x);
  const I = await J.yuIshlar(); const K = await yuKesh();
  // qarzi to'liq yopilgan faol ish — eski tizim o'zi yopadi; serverda yozuv yo'q, fonda eskisini bir marta chaqiramiz
  if (I.some(i => YU_FAOL.indexOf(i.holati) >= 0 && Sh[i.no] && !(Sh[i.no].jami > 0)) && koprik.bor())
    koprik.chaqir('yuristBoshlang', u.kod, []).catch(e => console.error('yuAvtoYop (ko\'prik):', e.message));
  const ishlar = I.filter(i => YU_FAOL.indexOf(i.holati) >= 0 || /^Yopildi/.test(i.holati)).map(i => yuKorinish(i, Sh[i.no], bugun, K));
  const res = { ishlar, admin: adm, bugun, topTur: YU_TOP_TUR, bosqich: YU_BOSQICH, keyingi: YU_KEYINGI, qarorlar: YU_QARORLAR, sud: YU_SUD,
    treklar: { Davo: { nomi: YU_TREK.Davo.nomi, zanjir: YU_TREK.Davo.zanjir, bosqich: YU_TREK.Davo.bosqich, ariza: YU_TREK.Davo.ariza },
      Buyruq: { nomi: YU_TREK.Buyruq.nomi, zanjir: YU_TREK.Buyruq.zanjir, bosqich: YU_TREK.Buyruq.bosqich, ariza: YU_TREK.Buyruq.ariza } } };
  if (adm) {
    res.kutish = I.filter(i => i.holati === 'Tasdiq kutilmoqda').map(i => Object.assign(yuKorinish(i, Sh[i.no], bugun, K), { sabab: i.sorovSabab, und: i.undiruvchi, vaqt: i.sorovVaqt }));
    res.yopishSorov = ishlar.filter(i => i.holati === "Yopish so'ralgan");
    const band = new Set(I.filter(i => i.holati !== 'Rad etildi').map(i => i.no));
    const [XJ, UJ, HJ, Z] = await Promise.all([J.xatJurnal(), J.undJurnal(), J.hujjatJurnal(), X.xatZanjir(u.kod)]);
    const H = HJ.filter(h => h.holati === 'Faol');
    res.kechikkan = Object.keys(Sh).filter(no => !band.has(no)).map(no => ({ x: Sh[no], m: yuMezon(Sh[no], XJ, UJ, H, bugun, Z) }))
      .filter(o => o.m.ok && o.m.kun > YU_KUTISH_KUN).map(o => ({ no: o.x.no, fish: o.x.fish, und: o.x.undiruvchi, kun: o.m.kun, jami: o.x.jami }));
    res.nomzodlar = Object.keys(Sh).filter(no => !band.has(no) && Sh[no].jami > 0).map(no => ({ no, fish: Sh[no].fish, dokon: Sh[no].dokon, jami: Sh[no].jami, und: Sh[no].undiruvchi }));
  }
  return res;
}

// ------------------------------------------------------------------ ish kartasi
async function yuristIsh([kodSes, id]) {
  const u = await S.ruxsat(kodSes, 'yurist');
  const bugun = V.bugun();
  const I = await J.yuIshlar();
  const i = I.find(z => String(z.id) === String(id)); if (!i) throw new S.Xato('Ish topilmadi.');
  const nomi = {}; HUJJAT_TURLARI.forEach(t => nomi[t[0]] = t[1]);
  const hujjat = (await J.hujjatJurnal()).filter(h => h.no === i.no && h.holati === 'Faol').map(h => ({ id: h.id, turi: nomi[h.turi] || h.turi, sana: h.sana, nom: h.nom }));
  const xat = (await J.xatJurnal()).filter(h => h.no === i.no && h.holati !== 'Bekor')
    .map(h => ({ raqam: h.raqam, sana: h.sana, bosqich: (X.xatSeriya(h.shablon) === 'QM' ? X.XAT_BOSQICH_QM : X.XAT_BOSQICH)[h.bosqich], holati: h.holati, usul: h.usul, yetSana: h.yetSana }));
  const jurnal = (await J.undJurnal()).filter(j => j.no === i.no).reverse().slice(0, 40).map(j => ({ sana: j.sana, chora: j.chora, natija: j.natija, mazmun: j.mazmun, kim: j.kim }));
  const tolov = (await U.undTolovlar()).filter(t => t.no === i.no).slice(-20).reverse();
  const tarix = await yuTarixOl(i.id);
  const bugunDmy = yuDmy(bugun);
  const yux = (await V.qatorlar('06g_Yuridik_xatlar')).map(({ r }) => r).filter(r => r[0] && String(r[2]) === String(i.id))
    .map(r => ({ raqam: r[0], sana: r[1], turi: YUX_TUR[r[5]] || r[5], holati: r[7], usul: r[10], yetSana: r[11], pochta: r[13], kim: r[14], doc: !!r[9],
      bekorMumkin: r[7] !== 'Bekor' && (u.admin || (r[14] === u.fish && r[7] === 'Tayyorlandi' && String(r[15]).indexOf(bugunDmy) === 0)) }));
  const re = ishRe(i);
  const top = (await J.topRows()).filter(t => re.test(t.kalit)).map(J.topKor).reverse()
    .map(t => ({ id: t.id, sarlavha: t.sarlavha, izoh: t.izoh, kimga: t.kimga, muddat: t.muddat, holati: t.holati, dalil: t.dalil, yopildi: t.yopildi, kechikkan: t.kechikkan }));
  const S1 = (await U.undShartnomalar()).find(z => z.no === i.no); const kor = yuKorinish(i, S1, bugun, await yuKesh());
  return { hujjat, xat, jurnal, tolov, tarix, yux, top, topTur: YU_TOP_TUR, mening: u.fish,
    qabul: kor.qabul, qabulKerak: kor.qabulKerak, chegara: kor.chegara, eslatma: kor.eslatma, kechikdi: kor.kechikdi, yuMas: kor.yuMas };
}

module.exports = { yuristBoshlang, yuristIsh };
// yozadigan amallar (yurist_yoz.js) uchun umumiy qoidalar — amal emas
module.exports.Q = { YU_TREK, YU_FAOL, YU_QARORLAR, YU_SUD, YU_TOP_TUR, yuTrek, yuKeyingiB, yuDmy, yuQabulMap, yuKorinish, yuKesh };
