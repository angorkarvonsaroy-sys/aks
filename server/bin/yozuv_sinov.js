#!/usr/bin/env node
// AKS TIZIM — serverda YOZISHNI xavfsiz sinash (to'lov 05_Tolovlar, tashrif 01b_Tashrif_jurnali).
// Haqiqiy varaqlarga TEGMAYDI: har varaqning NUSXASI ochiladi (zz_sinov_…), server o'sha nusxaga bitta qator yozadi —
// xuddi haqiqiy yozuvdagi yo'l bilan (A ustuni, ID, append, formatlar, formulalar). Keyin yangi qator eski tizim yozgan
// oldingi qator bilan ustunma-ustun solishtiriladi (qiymat turi, son/sana/matn formati, formula). Nusxa o'chiriladi.
// Hammasi bir xil bo'lsa — serverda yozish YOQILADI (Redis yozuv_yondi:*). «ochir» — o'chiradi (eski tizimga qaytadi).
// Ishlatish: aks-yozuv-sinov           — to'lov va tashrifni sinash va yoqish
//            aks-yozuv-sinov taminot   — ta'minot (kiritish + tasdiq/rad) ni sinash va yoqish (Koprik v1.5 kerak)
//            aks-yozuv-sinov hujjat    — hujjatni tuzatish (06d «Bekor») ni sinash va yoqish (Koprik v1.6 kerak)
//            aks-yozuv-sinov topshiriq — topshiriq berish (10_Topshiriqlar: yangi qator + asl topshiriqni yopish) ni sinash va yoqish (Koprik v1.5 kerak)
//            aks-yozuv-sinov tasdiq    — isbotni tasdiqlash/qaytarish: tez javob, qarorni eski tizim fonda bajaradi (navbat) — yoqish
//            aks-yozuv-sinov mayda     — xatni bekor qilish (06e N, V) va oylik reja (08_Lugatlar Z3:Z4) ni sinash va yoqish
//            aks-yozuv-sinov shartnoma — yangi mijoz (02), sotuv shartnomasi (03 + 03b jadval) va ijara (04) ni sinash va yoqish
//            aks-yozuv-sinov ochir     — hammasini o'chirish (eski tizimga qaytadi)
'use strict';
process.env.AKS_ENV = process.env.AKS_ENV || '/opt/aks/.env';
const G = require('../lib/google');
const env = require('../lib/env');
const V = require('../lib/varaq');
const { pool, redis } = require('../lib/db');
const K = require('../api/kassa')._ichki;
const TY = require('../api/taminot_yoz')._ichki;
const HY = require('../api/hujjat_yoz')._ichki;
const TP = require('../api/topshiriq_yoz')._ichki;
const MY = require('../api/mayda_yoz')._ichki;
const SY = require('../api/shartnoma_yoz')._ichki;
const koprik = require('../api/koprik');
const ID = env.aksBazaId, KEY = env.googleKey;

const harf = n => { let r = ''; while (n > 0) { const m = (n - 1) % 26; r = String.fromCharCode(65 + m) + r; n = Math.floor((n - 1) / 26); } return r; };
const fmt = c => { const f = c && c.userEnteredFormat && c.userEnteredFormat.numberFormat; return f ? (f.type || '') + (f.pattern ? ' ' + f.pattern : '') : '—'; };
const tur = c => { const v = c && c.userEnteredValue; if (!v) return 'bo\'sh'; const k = Object.keys(v)[0]; return ({ numberValue: 'son', stringValue: 'matn', formulaValue: 'formula', boolValue: 'mantiq' })[k] || k; };
// formulani bir qator pastga surish (nisbiy qator raqamlari +1) — eski qatordagi formula yangi qatorda qanday bo'lishi kerakligi
const sur = f => String(f).replace(/(\$?)([A-Z]{1,3})(\$?)(\d+)/g, (m, d1, c, d2, n) => d1 + c + d2 + (d2 ? n : String(+n + 1)));
const qisqa = (v, n = 22) => { v = String(v == null ? '' : v); return v.length > n ? v.slice(0, n - 1) + '…' : v; };

async function sinov(nom, varaq, F, oxirgi, qurish) {
  console.log('\n=== ' + nom + ' (' + varaq + ') ===');
  const M = await G.varaqlar(ID, KEY);
  const src = M.varaqlar.find(v => v.title === varaq); if (!src) throw new Error('Varaq topilmadi: ' + varaq);
  const nusxa = 'zz_sinov_' + varaq;
  const j = await G.soralar(ID, [{ duplicateSheet: { sourceSheetId: src.sheetId, insertSheetIndex: M.varaqlar.length, newSheetName: nusxa } }], KEY);
  const ng = j.replies[0].duplicateSheet.properties.sheetId;
  try {
    await G.gid(ID, nusxa, KEY, true);
    const t0 = Date.now();
    const h = await K.jurnalHolat(nusxa, true);
    const prev = (await G.oraliqOqi(ID, nusxa, 'A' + h.last + ':' + harf(oxirgi) + h.last, KEY))[0] || [];
    const qator = qurish(h, prev);
    const r = await G.qatorQoshR(ID, nusxa, h.last + 1, K.matnBelgi(qator, F), KEY);
    await K.jurnalFormat(nusxa, r, F);
    console.log('Yozish: ' + (Date.now() - t0) + ' ms · oxirgi qator ' + h.last + ', yangi qator ' + r + (r === h.last + 1 ? ' ✅' : ' ⚠ (kutilgan ' + (h.last + 1) + ')') + ' · yangi ID ' + h.id);
    const R = await G.kataklarOqi(ID, nusxa, 'A' + (r - 1) + ':' + harf(oxirgi) + r, KEY);
    const o = R[0] || [], y = R[1] || [];
    let xato = r === h.last + 1 ? 0 : 1;
    console.log('Ustun | eski tizim yozgan qator          | server yozgan qator              | ');
    for (let i = 0; i < oxirgi; i++) {
      const a = o[i] || {}, b = y[i] || {};
      const fa = fmt(a), fb = fmt(b), ta = tur(a), tb = tur(b);
      let ok = fa === fb && (ta === tb || ta === 'bo\'sh' || tb === 'bo\'sh');
      let izoh = '';
      if (ta === 'formula' && tb === 'formula') { const kut = sur(a.userEnteredValue.formulaValue); if (kut !== b.userEnteredValue.formulaValue) { ok = false; izoh = '  formula: ' + qisqa(b.userEnteredValue.formulaValue, 60) + '  kutilgan: ' + qisqa(kut, 60); } }
      if ((ta === 'formula') !== (tb === 'formula')) ok = false;
      if (!ok) xato++;
      console.log(harf(i + 1).padEnd(5) + ' | ' + (ta + ' ' + fa + ' «' + qisqa(a.formattedValue, 12) + '»').padEnd(32) + ' | ' + (tb + ' ' + fb + ' «' + qisqa(b.formattedValue, 12) + '»').padEnd(32) + ' | ' + (ok ? '✅' : '⚠') + izoh);
    }
    return xato;
  } finally {
    await G.soralar(ID, [{ deleteSheet: { sheetId: ng } }], KEY).catch(e => console.log('Nusxani o\'chirib bo\'lmadi: ' + e.message));
    console.log('Nusxa varaq o\'chirildi.');
  }
}

// Ikki qatorni ustunma-ustun solishtirish (o — eski tizim yozgani, y — server yozgani). ustunlar: 1 dan; bo'sh katak — har qanday bilan mos
function solishtir(o, y, ustunlar, sarlavha) {
  let xato = 0;
  console.log(sarlavha);
  console.log('Ustun | eski tizim yozgan qator          | server yozgan qator              | ');
  for (const u of ustunlar) {
    const a = o[u - 1] || {}, b = y[u - 1] || {};
    const fa = fmt(a), fb = fmt(b), ta = tur(a), tb = tur(b);
    let ok = (ta === 'bo\'sh' || tb === 'bo\'sh') ? true : (fa === fb && ta === tb);
    if ((ta === 'formula') !== (tb === 'formula')) ok = false;
    if (!ok) xato++;
    console.log(harf(u).padEnd(5) + ' | ' + (ta + ' ' + fa + ' «' + qisqa(a.formattedValue, 12) + '»').padEnd(32) + ' | ' + (tb + ' ' + fb + ' «' + qisqa(b.formattedValue, 12) + '»').padEnd(32) + ' | ' + (ok ? '✅' : '⚠'));
  }
  return xato;
}

// 📦 TA'MINOT: nusxa varaqqa 2 ta mahsulot kiritiladi (server yo'li), keyin 1-si tasdiqlanadi, 2-si rad etiladi; har biri eski tizim yozgan qator bilan solishtiriladi
async function taminotSinov() {
  const varaq = TY.TAM_V;
  console.log('\n=== TA\'MINOT (' + varaq + ') ===');
  const adm = (await pool.query('SELECT kirish_kodi, huquqlar FROM v_xodimlar WHERE kompaniya_id = 1')).rows.find(x => (x.huquqlar || []).includes('admin') && String(x.kirish_kodi || '').length >= 8);
  let ver = '?';
  try { ver = String(await koprik.chaqir('koprikVersiya', adm.kirish_kodi, [])); } catch (e) { ver = 'xato: ' + e.message; }
  const k15 = ver >= '1.5' && !/^xato/.test(ver);
  console.log('Eski tizim ko\'prigi: v' + ver + (k15 ? ' ✅' : ' ⚠ (1.5 kerak — Koprik.gs yangilanmagan)'));
  const M = await G.varaqlar(ID, KEY);
  const src = M.varaqlar.find(v => v.title === varaq); if (!src) throw new Error('Varaq topilmadi: ' + varaq);
  const nusxa = 'zz_sinov_' + varaq;
  const j = await G.soralar(ID, [{ duplicateSheet: { sourceSheetId: src.sheetId, insertSheetIndex: M.varaqlar.length, newSheetName: nusxa } }], KEY);
  const ng = j.replies[0].duplicateSheet.properties.sheetId;
  let x = 0;
  try {
    await G.gid(ID, nusxa, KEY, true);
    const oldin = await TY.qatorlarYangi(nusxa);
    const oxirgi = oldin.length ? oldin[oldin.length - 1].qator : 1;
    const tas = oldin.filter(z => z.holati === 'Tasdiqlandi').pop(), rad = oldin.filter(z => z.holati === 'Rad etildi').pop();
    let t0 = Date.now();
    const w = await TY.kiritishYoz(nusxa, 'SINOV', V.bugun(), 'Jismoniy', 'SINOV',
      [['Sinov mahsulot', 'dona', 2, 15000, 30000, 'SINOV'], ['Sinov mahsulot 2', 'kg', 1.5, 20000, 30000, '']], 'nusxa varaq, o\'chiriladi');
    console.log('Kiritish: ' + (Date.now() - t0) + ' ms · oxirgi qator ' + oxirgi + ', yangi qatorlar ' + w.qator + '–' + (w.qator + 1) + (w.qator === oxirgi + 1 ? ' ✅' : ' ⚠ (kutilgan ' + (oxirgi + 1) + ')') + ' · ' + w.partiya + ', ID ' + w.idBosh + '…');
    if (w.qator !== oxirgi + 1) x++;
    const R = (await TY.qatorlarYangi(nusxa)).filter(z => z.partiya === w.partiya);
    if (R.length !== 2 || R.some(z => z.holati !== 'Kutilmoqda')) { console.log('⚠ Kiritilgan qatorlar o\'qilmadi: ' + JSON.stringify(R)); x++; }
    t0 = Date.now();
    await TY.tasdiqYoz(nusxa, 'SINOV', [R[0]], true, '');
    await TY.tasdiqYoz(nusxa, 'SINOV', [R[1]], false, 'SINOV rad sababi');
    console.log('Tasdiq + rad: ' + (Date.now() - t0) + ' ms');
    const kat = async n => (await G.kataklarOqi(ID, nusxa, 'A' + n + ':P' + n, KEY))[0] || [];
    const YA = await kat(R[0].qator), YB = await kat(R[1].qator), O = await kat(oxirgi);
    x += solishtir(O, YA, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13], '\n— Kiritilgan qator (A–M) va oldingi qator ' + oxirgi + ':');
    if (tas) x += solishtir(await kat(tas.qator), YA, [14, 15], '\n— Tasdiqlangan (N–O) va eski tizim tasdiqlagan qator ' + tas.qator + ':');
    else console.log('(eski tizim tasdiqlagan qator yo\'q — N–O solishtirilmadi)');
    if (rad) x += solishtir(await kat(rad.qator), YB, [14, 15, 16], '\n— Rad etilgan (N–P) va eski tizim rad etgan qator ' + rad.qator + ':');
    else console.log('(eski tizim rad etgan qator yo\'q — N–P solishtirilmadi)');
    const qiy = r => [13, 14, 15].map(i => (r[i] && r[i].formattedValue) || '').join(' | ');   // Google oxirgi bo'sh kataklarni qaytarmaydi
    console.log('Yozilgan qiymatlar: 1) ' + qiy(YA) + '   2) ' + qiy(YB));
    if (!/^Tasdiqlandi \| SINOV, \d{2}\.\d{2}\.\d{4} \d{2}:\d{2} \| $/.test(qiy(YA)) || !/^Rad etildi \| SINOV, .* \| SINOV rad sababi$/.test(qiy(YB))) { console.log('⚠ N–P qiymatlari kutilgandek emas'); x++; }
  } finally {
    await G.soralar(ID, [{ deleteSheet: { sheetId: ng } }], KEY).catch(e => console.log('Nusxani o\'chirib bo\'lmadi: ' + e.message));
    console.log('Nusxa varaq o\'chirildi.');
  }
  console.log('');
  if (!x && k15) {
    await redis.set('yozuv_yondi:taminot', '1');
    console.log('✅ HAMMASI BIR XIL — ta\'minot (kiritish, tasdiq/rad) endi server orqali saqlanadi.');
    console.log('   Qaytarish kerak bo\'lsa: aks-yozuv-sinov ochir');
  } else if (!x) console.log('⚠ Yozuv bir xil, lekin Koprik.gs v1.5 o\'rnatilmagan — YOQILMADI. Koprik.gs ni yangilab, qayta ishga tushiring.');
  else console.log('⚠ ' + x + ' ta farq — ta\'minot YOQILMADI (eski tizim orqali ishlayveradi).');
}

// ✎ HUJJAT TUZATISH: 06d nusxasida oxirgi «Faol» qatorga server yozuvi (N «Bekor», O izoh) — eski tizim «Bekor» qilgan qator bilan solishtiriladi
async function hujjatSinov() {
  const varaq = '06d_Hujjatlar';
  console.log('\n=== HUJJAT TUZATISH (' + varaq + ') ===');
  const adm = (await pool.query('SELECT kirish_kodi, huquqlar FROM v_xodimlar WHERE kompaniya_id = 1')).rows.find(x => (x.huquqlar || []).includes('admin') && String(x.kirish_kodi || '').length >= 8);
  let ver = '?';
  try { ver = String(await koprik.chaqir('koprikVersiya', adm.kirish_kodi, [])); } catch (e) { ver = 'xato: ' + e.message; }
  const k16 = ver >= '1.6' && !/^xato/.test(ver);
  console.log('Eski tizim ko\'prigi: v' + ver + (k16 ? ' ✅' : ' ⚠ (1.6 kerak — Koprik.gs yangilanmagan)'));
  const M = await G.varaqlar(ID, KEY);
  const src = M.varaqlar.find(v => v.title === varaq); if (!src) throw new Error('Varaq topilmadi: ' + varaq);
  const nusxa = 'zz_sinov_' + varaq;
  const j = await G.soralar(ID, [{ duplicateSheet: { sourceSheetId: src.sheetId, insertSheetIndex: M.varaqlar.length, newSheetName: nusxa } }], KEY);
  const ng = j.replies[0].duplicateSheet.properties.sheetId;
  let x = 0;
  try {
    await G.gid(ID, nusxa, KEY, true);
    const L = (await HY.yangiQatorlar(nusxa, 'O')).map(({ qator, r }) => ({ qator, id: String(r[0] == null ? '' : r[0]), holati: String(r[13] == null ? '' : r[13]) })).filter(z => z.id);
    const faol = L.filter(z => z.holati === 'Faol').pop(), bek = L.filter(z => z.holati === 'Bekor').pop();
    if (!faol) throw new Error('06d da «Faol» hujjat yo\'q — sinab bo\'lmaydi');
    const h = await HY.hujjatYangi(nusxa, faol.id);
    const t0 = Date.now();
    await G.yoz(ID, HY.tuzatKataklar(nusxa, h, 'SINOV sababi', 'SINOV', HY.hozirHm()), KEY);
    console.log('Yozish: ' + (Date.now() - t0) + ' ms · qator ' + h.qator + ' (ID ' + h.id + ')');
    const kat = async n => (await G.kataklarOqi(ID, nusxa, 'A' + n + ':O' + n, KEY))[0] || [];
    const Y = await kat(h.qator);
    if (bek) x += solishtir(await kat(bek.qator), Y, [14, 15], '\n— Bekor qilingan (N–O) va eski tizim bekor qilgan qator ' + bek.qator + ':');
    else console.log('(eski tizim bekor qilgan qator yo\'q — N–O solishtirilmadi)');
    const n = (Y[13] && Y[13].formattedValue) || '', o = (Y[14] && Y[14].formattedValue) || '';
    console.log('Yozilgan qiymatlar: ' + n + ' | ' + o);
    if (n !== 'Bekor' || !/Bekor: SINOV sababi \(SINOV, \d{2}\.\d{2}\.\d{4} \d{2}:\d{2}\)$/.test(o)) { console.log('⚠ N–O qiymatlari kutilgandek emas'); x++; }
  } finally {
    await G.soralar(ID, [{ deleteSheet: { sheetId: ng } }], KEY).catch(e => console.log('Nusxani o\'chirib bo\'lmadi: ' + e.message));
    console.log('Nusxa varaq o\'chirildi.');
  }
  console.log('');
  if (!x && k16) {
    await redis.set('yozuv_yondi:hujjat', '1');
    console.log('✅ HAMMASI BIR XIL — hujjatni tuzatish endi server orqali saqlanadi.');
    console.log('   Qaytarish kerak bo\'lsa: aks-yozuv-sinov ochir');
  } else if (!x) console.log('⚠ Yozuv bir xil, lekin Koprik.gs v1.6 o\'rnatilmagan — YOQILMADI. Koprik.gs ni yangilab, qayta ishga tushiring.');
  else console.log('⚠ ' + x + ' ta farq — hujjatni tuzatish YOQILMADI (eski tizim orqali ishlayveradi).');
}

// 📌 TOPSHIRIQ: 10_Topshiriqlar nusxasiga server yo'li bilan yangi topshiriq qatori (topYoz) va bitta «Jarayonda» topshiriqni yopish (topYop);
// yangi qator eski tizim yozgan oxirgi direktor topshirig'i bilan, yopilgan N–R esa eski tizim yopgan qator bilan solishtiriladi
async function topshiriqSinov() {
  const varaq = TP.TOP_V;
  console.log('\n=== TOPSHIRIQ (' + varaq + ') ===');
  const adm = (await pool.query('SELECT kirish_kodi, huquqlar FROM v_xodimlar WHERE kompaniya_id = 1')).rows.find(x => (x.huquqlar || []).includes('admin') && String(x.kirish_kodi || '').length >= 8);
  let ver = '?';
  try { ver = String(await koprik.chaqir('koprikVersiya', adm.kirish_kodi, [])); } catch (e) { ver = 'xato: ' + e.message; }
  const k15 = ver >= '1.5' && !/^xato/.test(ver);
  console.log('Eski tizim ko\'prigi: v' + ver + (k15 ? ' ✅' : ' ⚠ (1.5 kerak — Koprik.gs yangilanmagan)'));
  const M = await G.varaqlar(ID, KEY);
  const src = M.varaqlar.find(v => v.title === varaq); if (!src) throw new Error('Varaq topilmadi: ' + varaq);
  const nusxa = 'zz_sinov_' + varaq;
  const j = await G.soralar(ID, [{ duplicateSheet: { sourceSheetId: src.sheetId, insertSheetIndex: M.varaqlar.length, newSheetName: nusxa } }], KEY);
  const ng = j.replies[0].duplicateSheet.properties.sheetId;
  let x = 0;
  try {
    await G.gid(ID, nusxa, KEY, true);
    const R = await TP.topRowsYangi(nusxa);
    const dir = R.L.filter(z => z.manba === 'Direktor').pop() || R.L[R.L.length - 1];
    const yop = R.L.filter(z => z.holati === 'Bajarildi' && z.yopildi && z.yopdi).pop();
    const och = R.L.filter(z => z.holati === 'Jarayonda').pop();
    let t0 = Date.now();
    const row = await TP.topYoz(nusxa, { manba: 'Direktor', qoida: '', kalit: '', sarlavha: 'SINOV topshiriq — nusxa varaq, o\'chiriladi', izoh: 'SINOV', no: '27/1', mid: '1', kimga: 'SINOV', kimBerdi: 'SINOV',
      muddat: '20.10.2026 18:00', muhim: 'Oddiy', isbotMaj: true }, R);
    console.log('Yangi qator: ' + (Date.now() - t0) + ' ms · oxirgi qator ' + (R.l) + ', yangi qator ' + row.qator + (row.qator === R.l + 1 ? ' ✅' : ' ⚠ (kutilgan ' + (R.l + 1) + ')') + ' · ID ' + row.id);
    if (row.qator !== R.l + 1) x++;
    const kat = async n => (await G.kataklarOqi(ID, nusxa, 'A' + n + ':V' + n, KEY))[0] || [];
    const Y = await kat(row.qator);
    x += solishtir(await kat(dir.qator), Y, Array.from({ length: 22 }, (_, i) => i + 1), '\n— Yangi qator (A–V) va eski tizim yozgan direktor topshirig\'i (№' + dir.id + ', qator ' + dir.qator + '):');
    const qiy = Y.map(c => (c && c.formattedValue) || '');
    if (qiy[0] !== String(row.id) || qiy[2] !== 'Direktor' || qiy[13] !== 'Jarayonda' || qiy[19] !== 'Ha' || qiy[7] !== '27/1') { console.log('⚠ Yangi qator qiymatlari kutilgandek emas: ' + JSON.stringify(qiy)); x++; }
    if (och) {
      t0 = Date.now();
      await TP.topYop(nusxa, och, 'Bajarildi', 'SINOV', 'SINOV dalil');
      console.log('\nYopish (№' + och.id + ', qator ' + och.qator + '): ' + (Date.now() - t0) + ' ms');
      const Z = await kat(och.qator);
      if (yop) x += solishtir(await kat(yop.qator), Z, [14, 15, 16, 17, 18], '— Yopilgan (N–R) va eski tizim yopgan qator (№' + yop.id + ', qator ' + yop.qator + '):');
      else console.log('(eski tizim yopgan qator yo\'q — N–R solishtirilmadi)');
      const zq = Z.map(c => (c && c.formattedValue) || '');
      if (zq[13] !== 'Bajarildi' || zq[15] !== 'SINOV' || zq[16] !== 'SINOV dalil' || !/^\d{2}\.\d{2}\.\d{4}/.test(zq[14])) { console.log('⚠ Yopilgan qator qiymatlari kutilgandek emas: ' + JSON.stringify(zq.slice(13, 18))); x++; }
    } else console.log('(«Jarayonda» topshiriq yo\'q — yopish sinalmadi)');
  } finally {
    await G.soralar(ID, [{ deleteSheet: { sheetId: ng } }], KEY).catch(e => console.log('Nusxani o\'chirib bo\'lmadi: ' + e.message));
    console.log('Nusxa varaq o\'chirildi.');
  }
  console.log('');
  if (!x && k15) {
    await redis.set('yozuv_yondi:topshiriq', '1');
    console.log('✅ HAMMASI BIR XIL — topshiriq berish endi server orqali saqlanadi.');
    console.log('   Qaytarish kerak bo\'lsa: aks-yozuv-sinov ochir');
  } else if (!x) console.log('⚠ Yozuv bir xil, lekin Koprik.gs v1.5 o\'rnatilmagan — YOQILMADI.');
  else console.log('⚠ ' + x + ' ta farq — topshiriq berish YOQILMADI (eski tizim orqali ishlayveradi).');
}

// ✕ XAT BEKOR + 🏠 OYLIK REJA: 06e va 08_Lugatlar nusxalarida server yozuvi — eski tizim yozgan kataklar bilan solishtiriladi
async function maydaSinov() {
  const adm = (await pool.query('SELECT kirish_kodi, huquqlar FROM v_xodimlar WHERE kompaniya_id = 1')).rows.find(x => (x.huquqlar || []).includes('admin') && String(x.kirish_kodi || '').length >= 8);
  let ver = '?'; try { ver = String(await koprik.chaqir('koprikVersiya', adm.kirish_kodi, [])); } catch (e) { ver = 'xato: ' + e.message; }
  const k15 = ver >= '1.5' && !/^xato/.test(ver);
  console.log('Eski tizim ko\'prigi: v' + ver + (k15 ? ' ✅' : ' ⚠ (1.5 kerak)'));
  const M = await G.varaqlar(ID, KEY);
  const nusxala = async varaq => { const src = M.varaqlar.find(v => v.title === varaq); if (!src) throw new Error('Varaq topilmadi: ' + varaq);
    const j = await G.soralar(ID, [{ duplicateSheet: { sourceSheetId: src.sheetId, insertSheetIndex: M.varaqlar.length, newSheetName: 'zz_sinov_' + varaq } }], KEY);
    await G.gid(ID, 'zz_sinov_' + varaq, KEY, true); return j.replies[0].duplicateSheet.properties.sheetId; };
  let x = 0; const ochir = [];
  try {
    console.log('\n=== XAT BEKOR (' + MY.XAT_V + ') ===');
    ochir.push(await nusxala(MY.XAT_V)); const nx = 'zz_sinov_' + MY.XAT_V;
    const R = await G.oraliqOqi(ID, nx, 'A2:V', KEY);
    let bek = -1, och = -1; R.forEach((r, i) => { if (!r[0]) return; if (r[13] === 'Bekor' && String(r[21] || '').indexOf('Bekor:') >= 0) bek = i; else if (r[13] !== 'Bekor') och = i; });
    if (och < 0) console.log('(bekor qilinmagan xat yo\'q — sinalmadi)');
    else {
      const h = await MY.xatYangi(nx, R[och][0]);
      let t0 = Date.now(); await MY.xatBekorYoz(nx, h, 'SINOV sababi', 'SINOV');
      console.log('Yozish: ' + (Date.now() - t0) + ' ms · xat ' + h.raqam + ', qator ' + h.qator);
      const kat = async n => (await G.kataklarOqi(ID, nx, 'A' + n + ':V' + n, KEY))[0] || [];
      const Y = await kat(h.qator);
      if (bek >= 0) x += solishtir(await kat(bek + 2), Y, [14, 22], '— Bekor qilingan (N, V) va eski tizim bekor qilgan xat (qator ' + (bek + 2) + '):');
      else console.log('(eski tizim bekor qilgan xat yo\'q — N, V solishtirilmadi)');
      const q14 = (Y[13] && Y[13].formattedValue) || '', q22 = (Y[21] && Y[21].formattedValue) || '';
      if (q14 !== 'Bekor' || !/Bekor: SINOV sababi \(SINOV, \d{2}\.\d{2}\.\d{4} \d{2}:\d{2}\)$/.test(q22)) { console.log('⚠ Qiymatlar kutilgandek emas: ' + q14 + ' | ' + q22); x++; }
    }
    console.log('\n=== OYLIK REJA (' + MY.LUG_V + ' Z3:Z4) ===');
    ochir.push(await nusxala(MY.LUG_V)); const nl = 'zz_sinov_' + MY.LUG_V;
    const O = await G.kataklarOqi(ID, MY.LUG_V, 'Z3:Z4', KEY);
    const eski = Number(((O[1] || [])[0] || {}).effectiveValue ? O[1][0].effectiveValue.numberValue : 0) || 500000000;
    let t0 = Date.now(); await MY.rejaYoz(nl, eski);
    console.log('Yozish: ' + (Date.now() - t0) + ' ms · reja ' + eski);
    const Yl = await G.kataklarOqi(ID, nl, 'Z3:Z4', KEY);
    x += solishtir([(O[0] || [])[0]], [(Yl[0] || [])[0]], [1], '— Z3 (eski | server):');
    x += solishtir([(O[1] || [])[0]], [(Yl[1] || [])[0]], [1], '— Z4 (eski | server):');
    const b = c => !!(c && c.userEnteredFormat && c.userEnteredFormat.textFormat && c.userEnteredFormat.textFormat.bold);
    if (b((O[0] || [])[0]) !== b((Yl[0] || [])[0])) { console.log('⚠ Z3 qalinligi farq qiladi'); x++; }
  } finally {
    if (ochir.length) await G.soralar(ID, ochir.map(g => ({ deleteSheet: { sheetId: g } })), KEY).catch(e => console.log('Nusxani o\'chirib bo\'lmadi: ' + e.message));
    console.log('Nusxa varaqlar o\'chirildi.');
  }
  console.log('');
  if (!x && k15) { await redis.set('yozuv_yondi:mayda', '1'); console.log('✅ HAMMASI BIR XIL — xatni bekor qilish va oylik reja endi server orqali saqlanadi.\n   Qaytarish kerak bo\'lsa: aks-yozuv-sinov ochir'); }
  else if (!x) console.log('⚠ Yozuv bir xil, lekin Koprik.gs v1.5 o\'rnatilmagan — YOQILMADI.');
  else console.log('⚠ ' + x + ' ta farq — YOQILMADI (eski tizim orqali ishlayveradi).');
}

// Yangi qator(lar)ni oldingi qator bilan ustunma-ustun: qiymat turi, format, formula (oldingi qatordagi formula bir qator pastga surilgan bo'lishi kerak)
const surD = (f, d) => String(f).replace(/(\$?)([A-Z]{1,3})(\$?)(\d+)/g, (m, d1, c, d2, n) => d1 + c + d2 + (d2 ? n : String(+n + d)));
async function qatorSolishtir(nx, r1, soni, oxirgi, sarlavha, eskiQ, istisno) {   // eskiQ — solishtiriladigan eski qator (berilmasa — oldingi qator); istisno(i, fa, fb) — ma'lum farq
  let xato = 0;
  const R = await G.kataklarOqi(ID, nx, 'A' + (r1 - 1) + ':' + harf(oxirgi) + (r1 + soni - 1), KEY);
  const E = eskiQ ? ((await G.kataklarOqi(ID, nx, 'A' + eskiQ + ':' + harf(oxirgi) + eskiQ, KEY))[0] || []) : null;
  for (let k = 0; k < soni; k++) {
    const o = E && k === 0 ? E : (R[k] || []), y = R[k + 1] || [], dq = E && k === 0 ? r1 - eskiQ : 1;
    console.log(sarlavha + (soni > 1 ? ' — ' + (k + 1) + '/' + soni : '') + ' (qator ' + (r1 + k) + ', eski tizim yozgani ' + (E && k === 0 ? eskiQ : r1 + k - 1) + ')');
    const yomon = [];
    for (let i = 0; i < oxirgi; i++) {
      const a = o[i] || {}, b = y[i] || {}, ta = tur(a), tb = tur(b), fa = fmt(a), fb = fmt(b);
      let ok = (ta === 'bo\'sh' || tb === 'bo\'sh') ? true : (fa === fb && ta === tb);
      if ((ta === 'formula') !== (tb === 'formula') && !(ta === 'bo\'sh' && tb !== 'formula')) ok = false;
      if (ta === 'formula' && tb === 'formula' && surD(a.userEnteredValue.formulaValue, dq) !== b.userEnteredValue.formulaValue) ok = false;
      if (!ok && istisno && istisno(i, fa, fb)) { console.log('  ℹ ' + harf(i + 1) + ': eski ' + fa + ' | server ' + fb + ' — ' + istisno(i, fa, fb)); ok = true; }
      if (!ok) yomon.push(harf(i + 1) + ': eski ' + ta + ' ' + fa + ' «' + qisqa(a.formattedValue || (a.userEnteredValue && a.userEnteredValue.formulaValue), 30) + '» | server ' + tb + ' ' + fb + ' «' + qisqa(b.formattedValue || (b.userEnteredValue && b.userEnteredValue.formulaValue), 30) + '»');
    }
    if (yomon.length) { xato += yomon.length; yomon.forEach(z => console.log('  ⚠ ' + z)); } else console.log('  ✅ ' + oxirgi + ' ustun — qiymat turi, format va formulalar bir xil');
  }
  return xato;
}
// 📝 SHARTNOMA: 02, 03, 03b, 04 nusxalarida server yo'li bilan mijoz, sotuv shartnomasi (+ to'lov jadvali) va ijara yoziladi — oldingi (eski tizim yozgan) qatorlar bilan solishtiriladi
async function shartnomaSinov() {
  const Sx = require('../api/sessiya'); Sx.ruxsat = async () => ({ admin: true, huquq: ['admin'], fish: 'SINOV', kod: 'sinov' });   // jadvalHisob uchun
  const M = await G.varaqlar(ID, KEY);
  const ochir = []; let x = 0;
  const nusxala = async varaq => { const src = M.varaqlar.find(v => v.title === varaq); if (!src) throw new Error('Varaq topilmadi: ' + varaq);
    const j = await G.soralar(ID, [{ duplicateSheet: { sourceSheetId: src.sheetId, insertSheetIndex: M.varaqlar.length + ochir.length, newSheetName: 'zz_sinov_' + varaq } }], KEY);
    ochir.push(j.replies[0].duplicateSheet.properties.sheetId); await G.gid(ID, 'zz_sinov_' + varaq, KEY, true); return 'zz_sinov_' + varaq; };
  const u = { fish: 'SINOV', admin: true };
  try {
    console.log('\n=== MIJOZ (02_Mijozlar) ===');
    const n2 = await nusxala(SY.T02);
    let t0 = Date.now();
    const m = await SY.mijozYoz(n2, u, { iibv: 'Сурхондарё', iibt: 'Ангор', mv: 'Сурхондарё', mt: 'Ангор тумани', mfy: 'Синов', kocha: 'Синов', uy: '1', xon: '', izoh: 'SINOV — nusxa varaq' },
      { fish: 'SINOV SINOV SINOVICH', tel: '901112233', tel2: '', pas: 'ZZ0000001', jsh: '30000000000001', ps: '01.01.2020', pm: '01.01.2030' });
    console.log('Yozish: ' + (Date.now() - t0) + ' ms · ID ' + m.id + ', qator ' + m.qator);
    x += await qatorSolishtir(n2, m.qator, 1, 31, '— Yangi mijoz (A–AE) va oldingi qator');
    console.log('\n=== SOTUV SHARTNOMASI (03 + 03b) ===');
    const n3 = await nusxala(SY.T03), n3b = await nusxala(SY.T03b);
    const D = await G.oraliqOqi(ID, '01_Dokonlar', 'A2:Z641', KEY, 'UNFORMATTED_VALUE');
    const dr0 = D.find(r => r[0] && !r[17] && String(r[18]) === 'SOTILMAGAN' && Number(r[5]) > 0 && Number(r[6]) > 0);
    if (!dr0) throw new Error('Sotilmagan do\'kon topilmadi');
    const dr = []; for (let k = 0; k < 26; k++) dr.push(dr0[k] == null ? '' : dr0[k]);
    const bugun = V.bugun();
    const d = { mijozId: 1, turi: 'Тайёр дўкон (Муддатли тўлов шартномаси)', dokonId: String(dr[0]), sana: bugun, boshl: 60000000, oy: 3, bkun: 10, tkun: 15, birinchi: bugun.slice(0, 8) + '15', undiruvchi: '', izoh: 'SINOV — nusxa varaq', maydon: Number(dr[5]), baza: Number(dr[6]) };
    const h = await require('../api/shartnoma').jadvalHisob(['sinov', d]);
    t0 = Date.now();
    const w = await SY.shartnomaYoz(n3, n3b, u, d, 1, dr, h);
    console.log('Yozish: ' + (Date.now() - t0) + ' ms · ' + w.no + ' (do\'kon ' + dr[0] + '), 03 qator ' + w.qator + ', 03b qatorlar ' + w.jQator + '–' + (w.jQator + w.jSoni - 1));
    // Oldingi qator bilan. Yagona ma'lum farq: «Qayta tuzish» (Qayta.gs) I ustuniga «0.00%» qo'yadi, oddiy shartnoma (Kod.gs shartnomaSaqlash) — «0%»
    x += await qatorSolishtir(n3, w.qator, 1, 42, '— Yangi shartnoma (A–AP) va oldingi qator', null,
      (i, fa, fb) => i === 8 && fa === 'PERCENT 0.00%' && fb === 'PERCENT 0%' ? 'oldingi qatorni «Qayta tuzish» yozgan (0.00%); oddiy yangi shartnomaga eski tizim ham «0%» qo\'yadi (Kod.gs)' : '');
    x += await qatorSolishtir(n3b, w.jQator, w.jSoni, 8, '— To\'lov jadvali (A–H)');
    console.log('\n=== IJARA (04_Ijara_shartnomalar) ===');
    const n4 = await nusxala(SY.T04);
    const di0 = D.find(r => r[0] && !r[21] && String(r[18]) === 'SOTILMAGAN' && Number(r[5]) > 0);
    const di = { mijozId: 1, dokonId: String(di0[0]), sana: bugun, boshlanish: bugun, muddat: 12, bepul: 3, oylik: '1000000', m2: '', tkun: 5, garov: '', kommunal: '', faoliyat: 'SINOV', savdo: '', asos: '', izoh: 'SINOV — nusxa varaq' };
    const t = await SY.ijaraTekshir(di);
    t0 = Date.now();
    const wi = await SY.ijaraYoz(n4, u, di, t);
    console.log('Yozish: ' + (Date.now() - t0) + ' ms · ' + wi.no + ' (do\'kon ' + di.dokonId + '), qator ' + wi.qator);
    x += await qatorSolishtir(n4, wi.qator, 1, 38, '— Yangi ijara (A–AL) va oldingi qator');
  } finally {
    if (ochir.length) await G.soralar(ID, ochir.map(g => ({ deleteSheet: { sheetId: g } })), KEY).catch(e => console.log('Nusxani o\'chirib bo\'lmadi: ' + e.message));
    console.log('\nNusxa varaqlar o\'chirildi.');
  }
  console.log('');
  if (!x) { await redis.set('yozuv_yondi:shartnoma', '1'); console.log('✅ HAMMASI BIR XIL — yangi mijoz, sotuv shartnomasi (jadvali bilan) va ijara endi server orqali saqlanadi.\n   Shartnoma PDF — avvalgidek eski tizimda. Qaytarish kerak bo\'lsa: aks-yozuv-sinov ochir'); }
  else console.log('⚠ ' + x + ' ta farq — YOQILMADI (eski tizim orqali ishlayveradi).');
}

// ------------------------------------------------------------------ 📋 reyestr PDF / Excel: eski tizim fayli bilan solishtirish
const RY = require('../api/reyestr')._ichki;
const XL = require('../lib/xlsx');
const PDF = require('../lib/pdf');
const S = require('../api/sessiya');
const tetik = require('../lib/kozgu_tetik');
const { execFileSync } = require('child_process');
function pdfMatn(buf) {
  const fs = require('fs'), os = require('os'), path = require('path');
  const f = path.join(os.tmpdir(), 'aks_eks_' + process.pid + '_' + Math.random().toString(36).slice(2) + '.pdf');
  fs.writeFileSync(f, buf);
  try {
    const t = execFileSync('pdftotext', ['-enc', 'UTF-8', f, '-'], { maxBuffer: 64 << 20 }).toString('utf8');
    const info = execFileSync('pdfinfo', [f]).toString('utf8');
    const bet = +((/Pages:\s+(\d+)/.exec(info) || [])[1] || 0), olcham = ((/Page size:\s+([^\n]+)/.exec(info) || [])[1] || '').trim();
    const yasovchi = ((/Creator:\s+([^\n]+)/.exec(info) || [])[1] || '').trim();
    const m = t.normalize('NFKC').replace(/\u00ad/g, '');
    return { matn: m, betlar: m.split('\f').slice(0, bet), bet, olcham, yasovchi };
  } finally { try { fs.unlinkSync(f); } catch (e) { } }
}
function belgilar(s) { const m = new Map(); for (const c of s.replace(/\s+/g, '')) m.set(c, (m.get(c) || 0) + 1); return m; }
function sozlar(s) { const m = new Map(); s.split(/\s+/).filter(Boolean).forEach(w => m.set(w, (m.get(w) || 0) + 1)); return m; }
const tengM = (A, B) => A.size === B.size && [...A].every(([k, v]) => B.get(k) === v);
function pdfSolishtir(eskiB, yangiB) {
  const a = pdfMatn(eskiB), b = pdfMatn(yangiB); let x = 0;
  console.log('  eski:   ' + a.bet + ' bet, ' + a.olcham + ' (' + a.yasovchi + ')');
  console.log('  server: ' + b.bet + ' bet, ' + b.olcham + ' (' + b.yasovchi + ')');
  const A = belgilar(a.matn), B = belgilar(b.matn); let farq = 0; const ft = [];
  new Set([...A.keys(), ...B.keys()]).forEach(c => { const d = (A.get(c) || 0) - (B.get(c) || 0); if (d) { farq += Math.abs(d); ft.push(JSON.stringify(c) + ' eski ' + (A.get(c) || 0) + ' / server ' + (B.get(c) || 0)); } });
  if (!farq) console.log('  ✅ matn bir xil (' + [...A.values()].reduce((p, q) => p + q, 0) + ' belgi)');
  else {
    x++; console.log('  ✖ matnda ' + farq + ' belgi farq: ' + ft.slice(0, 12).join('; '));
    const SA = sozlar(a.matn), SB = sozlar(b.matn), fa = [], fb = [];
    SA.forEach((n, w) => { if (n > (SB.get(w) || 0)) fa.push(w + (n - (SB.get(w) || 0) > 1 ? '×' + (n - (SB.get(w) || 0)) : '')); });
    SB.forEach((n, w) => { if (n > (SA.get(w) || 0)) fb.push(w + (n - (SA.get(w) || 0) > 1 ? '×' + (n - (SA.get(w) || 0)) : '')); });
    console.log('    faqat eskida: ' + fa.slice(0, 15).join(' | '));
    console.log('    faqat serverda: ' + fb.slice(0, 15).join(' | '));
  }
  // sahifalar: soni, o'lchami va har sahifadagi matn (qator qaysi sahifaga tushgani) — bir xil bo'lishi kerak
  if (a.bet !== b.bet || a.olcham !== b.olcham) { x++; console.log('  ✖ sahifalar: eski ' + a.bet + ' bet ' + a.olcham + ' | server ' + b.bet + ' bet ' + b.olcham); }
  else {
    const farqBet = []; for (let i = 0; i < a.bet; i++) if (!tengM(belgilar(a.betlar[i] || ''), belgilar(b.betlar[i] || ''))) farqBet.push(i + 1);
    if (farqBet.length) { x++; console.log('  ✖ sahifa chegaralari farq: ' + farqBet.slice(0, 10).join(', ') + '-bet'); }
    else console.log('  ✅ ' + a.bet + ' bet — har sahifadagi matn ham bir xil (sahifa chegaralari aynan bir joyda)');
    try { const f = rasmFarq(eskiB, yangiB); if (f !== null) console.log('  ' + (f < 1 ? '✅' : 'ℹ') + ' ko\'rinishi: ' + f.toFixed(2) + '% nuqta farq (eng ko\'p farqli sahifada)'); } catch (e) { }
  }
  return x;
}
// Ikkala PDF'ni rasm qilib (kulrang, 50 dpi) nuqtama-nuqta solishtirish — faqat ma'lumot uchun
function pgmOqi(buf) {
  let i = 0; const tok = () => { while (/\s/.test(String.fromCharCode(buf[i]))) i++; if (buf[i] === 35) { while (buf[i] !== 10) i++; return tok(); } let t = ''; while (!/\s/.test(String.fromCharCode(buf[i]))) t += String.fromCharCode(buf[i++]); return t; };
  if (tok() !== 'P5') return null; const w = +tok(), h = +tok(); tok(); i++;
  return { w, h, d: buf.slice(i, i + w * h) };
}
function rasmFarq(eskiB, yangiB) {
  const fs = require('fs'), os = require('os'), path = require('path');
  const papka = fs.mkdtempSync(path.join(os.tmpdir(), 'aks_rasm_'));
  try {
    fs.writeFileSync(path.join(papka, 'a.pdf'), eskiB); fs.writeFileSync(path.join(papka, 'b.pdf'), yangiB);
    execFileSync('pdftoppm', ['-gray', '-r', '50', path.join(papka, 'a.pdf'), path.join(papka, 'a')]);
    execFileSync('pdftoppm', ['-gray', '-r', '50', path.join(papka, 'b.pdf'), path.join(papka, 'b')]);
    const A = fs.readdirSync(papka).filter(f => /^a-.*\.pgm$/.test(f)).sort(), B = fs.readdirSync(papka).filter(f => /^b-.*\.pgm$/.test(f)).sort();
    if (!A.length || A.length !== B.length) return null;
    let eng = 0;
    A.forEach((f, k) => { const p = pgmOqi(fs.readFileSync(path.join(papka, f))), q = pgmOqi(fs.readFileSync(path.join(papka, B[k])));
      if (!p || !q || p.w !== q.w || p.h !== q.h) { eng = 100; return; }
      let n = 0; for (let j = 0; j < p.d.length; j++) if (Math.abs(p.d[j] - q.d[j]) > 80) n++;
      eng = Math.max(eng, 100 * n / p.d.length); });
    return eng;
  } finally { try { fs.rmSync(papka, { recursive: true, force: true }); } catch (e) { } }
}
function xlsSolishtir(eskiB, yangiB) {
  const a = XL.oqi(eskiB), b = XL.oqi(yangiB); let x = 0;
  if (a.nom !== b.nom) { x++; console.log('  ✖ varaq nomi: eski «' + a.nom + '» | server «' + b.nom + '»'); }
  if (a.muzlat !== b.muzlat) { x++; console.log('  ✖ muzlatilgan qator: eski ' + a.muzlat + ' | server ' + b.muzlat); }
  const kalit = k => { const m = /^([A-Z]+)(\d+)$/.exec(k); return [m[1], +m[2]]; };
  const bor = c => c && c.tur !== 'bo\'sh';
  const hamma = new Set([...Object.keys(a.kataklar).filter(k => bor(a.kataklar[k]) || kalit(k)[1] === 1), ...Object.keys(b.kataklar).filter(k => bor(b.kataklar[k]) || kalit(k)[1] === 1)]);
  const guruh = new Map(); let soni = 0;
  hamma.forEach(k => {
    const [u, q] = kalit(k), e = a.kataklar[k] || { tur: 'bo\'sh', val: null, fmt: 'General', qalin: false, rang: '', fon: '' }, y = b.kataklar[k] || { tur: 'bo\'sh', val: null, fmt: 'General', qalin: false, rang: '', fon: '' };
    if (q === 1 && !bor(e) && !bor(y)) return;
    soni++;
    const tv = (e.tur === y.tur) && (e.tur === 'son' ? Math.abs(e.val - y.val) < 1e-9 : e.val === y.val);
    const fm = !bor(e) && !bor(y) ? true : e.fmt === y.fmt;
    const us = q !== 1 || (e.qalin === y.qalin && e.rang === y.rang && e.fon === y.fon);
    if (tv && fm && us) return;
    const imzo = u + (q === 1 ? '1' : '') + ' | ' + (!tv ? 'qiymat: eski ' + e.tur + ' | server ' + y.tur : '') + (!fm ? ' format: eski «' + e.fmt + '» | server «' + y.fmt + '»' : '') + (!us ? ' uslub: eski ' + [e.qalin ? 'qalin' : 'oddiy', e.rang, e.fon].join(' ') + ' | server ' + [y.qalin ? 'qalin' : 'oddiy', y.rang, y.fon].join(' ') : '');
    const g = guruh.get(imzo) || { n: 0, misol: k + ': eski ' + JSON.stringify(e.val) + ' | server ' + JSON.stringify(y.val) }; g.n++; guruh.set(imzo, g);
  });
  guruh.forEach((g, imzo) => { x++; console.log('  ✖ ' + imzo + ' — ' + g.n + ' katak (' + g.misol + ')'); });
  if (!x) console.log('  ✅ ' + soni + ' katak — qiymat, turi, formati va sarlavha uslubi bir xil');
  return x;
}
async function eksportSinov() {
  let pb = await PDF.bor(); let ptt = true; try { execFileSync('pdftotext', ['-v'], { stdio: 'ignore' }); } catch (e) { ptt = false; }
  if (!pb || !ptt) { console.log('⏳ PDF dasturi serverga hali o\'rnatilmagan (' + (!pb ? 'Chromium ' : '') + (!ptt ? 'poppler-utils' : '') + ') — 3 daqiqadan keyin qayta ishga tushiring.\n   (o\'rnatish jurnali: tail -5 /var/log/aks-pdf-ornat.log)'); return; }
  const adm = (await pool.query('SELECT kirish_kodi, huquqlar FROM v_xodimlar WHERE kompaniya_id = 1')).rows.find(z => (z.huquqlar || []).includes('admin') && String(z.kirish_kodi || '').length >= 8);
  const tok = await S.sessiyaOch(adm.kirish_kodi), ks = adm.kirish_kodi + '|' + tok;
  await tetik.varaqlarYangila(['02_Mijozlar', '03_Sotuv_shartnomalar', '04_Ijara_shartnomalar']).catch(e => console.log('(ko\'zgu yangilanmadi: ' + e.message + ')'));
  const ishlar = [
    ['IJARA REYESTRI — Excel (barchasi)', 'reyestrExcel', RY.ijaraExcelYasa, 'hammasi', 'x'],
    ['SOTUV REYESTRI — Excel (barchasi)', 'reyestrSotuvExcel', RY.sotuvExcelYasa, 'hammasi', 'x'],
    ['IJARA REYESTRI — PDF (barchasi)', 'reyestrPdf', RY.ijaraPdfYasa, 'hammasi', 'p'],
    ['SOTUV REYESTRI — PDF (barchasi)', 'reyestrSotuvPdf', RY.sotuvPdfYasa, 'hammasi', 'p'],
  ];
  let x = 0;
  try {
    for (const [nom, fn, yasa, filtr, tur] of ishlar) {
      console.log('\n=== ' + nom + ' ===');
      let t = Date.now(), e;
      try { e = await koprik.chaqir(fn, adm.kirish_kodi, [filtr]); } catch (er) { console.log('  ✖ eski tizim: ' + er.message); x++; continue; }
      const te = Date.now() - t; t = Date.now();
      const y = await yasa(ks, filtr); const ty = Date.now() - t;
      console.log('  vaqt: eski tizim ' + (te / 1000).toFixed(1) + ' s · server ' + (ty / 1000).toFixed(1) + ' s');
      if (e.nom !== y.nom || e.mime !== y.mime) { x++; console.log('  ✖ fayl nomi: eski ' + e.nom + ' | server ' + y.nom); } else console.log('  fayl: ' + y.nom);
      const eb = Buffer.from(e.b64, 'base64'), yb = Buffer.from(y.b64, 'base64');
      x += tur === 'x' ? xlsSolishtir(eb, yb) : pdfSolishtir(eb, yb);
    }
  } finally { await redis.del('ses:' + tok); }
  console.log('');
  if (!x) { await redis.set('yozuv_yondi:eksport', '1'); await redis.set('yozuv_yondi:eksport_pdf', '1'); console.log('✅ HAMMASI BIR XIL — reyestr PDF va Excel endi serverda yasaladi.\n   Qaytarish kerak bo\'lsa: aks-yozuv-sinov ochir'); }
  else console.log('⚠ ' + x + ' ta farq — YOQILMADI (eski tizim orqali ishlayveradi).');
}

// ------------------------------------------------------------------ 📊 hisobot PDF (HisobotPDF.gs): eski tizim fayli bilan solishtirish
async function hisobotSinov() {
  const HP = require('../api/hisobot_pdf')._ichki;
  let pb = await PDF.bor(); let ptt = true; try { execFileSync('pdftotext', ['-v'], { stdio: 'ignore' }); } catch (e) { ptt = false; }
  if (!pb || !ptt) { console.log('⏳ PDF dasturi serverga hali o\'rnatilmagan — 3 daqiqadan keyin qayta ishga tushiring.'); return; }
  const adm = (await pool.query('SELECT kirish_kodi, huquqlar FROM v_xodimlar WHERE kompaniya_id = 1')).rows.find(z => (z.huquqlar || []).includes('admin') && String(z.kirish_kodi || '').length >= 8);
  const tok = await S.sessiyaOch(adm.kirish_kodi), ks = adm.kirish_kodi + '|' + tok;
  const u = await S.ruxsat(ks, 'hisobot');
  await tetik.varaqlarYangila(['01b_Tashrif_jurnali', '03_Sotuv_shartnomalar', '04_Ijara_shartnomalar', '05_Tolovlar']).catch(e => console.log('(ko\'zgu yangilanmadi: ' + e.message + ')'));
  const bugun = V.bugun(), kunQosh = (iso, d) => new Date(Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)) + d * 86400000).toISOString().slice(0, 10);
  const hk = new Date(bugun + 'T12:00:00Z').getUTCDay(), dushanba = kunQosh(bugun, -((hk + 6) % 7));
  const ishlar = [['SHU HAFTA (ustunlar — kunlar)', dushanba, bugun], ['SHU OY (ustunlar — haftalar + kunma-kun)', bugun.slice(0, 8) + '01', bugun], ['SHU YIL (ustunlar — oylar + haftama-hafta)', bugun.slice(0, 5) + '01-01', bugun]];
  let x = 0;
  try {
    for (const [nom, b, o] of ishlar) {
      console.log('\n=== HISOBOT PDF — ' + nom + ': ' + b + ' … ' + o + ' ===');
      let t = Date.now(), e;
      try { e = await koprik.chaqir('hisobotPdf', adm.kirish_kodi, [b, o]); } catch (er) { console.log('  ✖ eski tizim: ' + er.message); x++; continue; }
      const te = Date.now() - t;
      const eb = Buffer.from(e.b64, 'base64');
      const vaqt = (/Шакллантирилди:\s*(\d{2}\.\d{2}\.\d{4} \d{2}:\d{2})/.exec(pdfMatn(eb).matn) || [])[1] || '';
      t = Date.now(); const y = await HP.hisobotYasa(u.fish, b, o, vaqt); const ty = Date.now() - t;
      console.log('  vaqt: eski tizim ' + (te / 1000).toFixed(1) + ' s · server ' + (ty / 1000).toFixed(1) + ' s');
      if (e.nom !== y.nom || e.davr !== y.davr) { x++; console.log('  ✖ fayl: eski ' + e.nom + ' «' + e.davr + '» | server ' + y.nom + ' «' + y.davr + '»'); } else console.log('  fayl: ' + y.nom + ' · ' + y.davr);
      x += pdfSolishtir(eb, Buffer.from(y.b64, 'base64'));
    }
  } finally { await redis.del('ses:' + tok); }
  console.log('');
  if (!x) { await redis.set('yozuv_yondi:hisobot_pdf', '1'); console.log('✅ HAMMASI BIR XIL — sotuv bo\'limi hisoboti (PDF) endi serverda yasaladi.\n   Qaytarish kerak bo\'lsa: aks-yozuv-sinov ochir'); }
  else console.log('⚠ ' + x + ' ta farq — YOQILMADI (eski tizim orqali ishlayveradi).');
}

// ▶ BUGUNGI ISH (Qadam.gs): 06n va 06i nusxalariga server yo'li bilan qator yoziladi — eski tizim yozgan qator bilan solishtiriladi
async function qadamSinov() {
  const QY = require('../api/qadam_yoz')._ichki;
  const adm = (await pool.query('SELECT kirish_kodi, huquqlar FROM v_xodimlar WHERE kompaniya_id = 1')).rows.find(z => (z.huquqlar || []).includes('admin') && String(z.kirish_kodi || '').length >= 8);
  let ver = '?'; try { ver = String(await koprik.chaqir('koprikVersiya', adm.kirish_kodi, [])); } catch (e) { ver = 'xato: ' + e.message; }
  const k15 = ver >= '1.5' && !/^xato/.test(ver);
  console.log('Eski tizim ko\'prigi (Telegram uchun): v' + ver + (k15 ? ' ✅' : ' ⚠ (1.5 kerak)'));
  const M = await G.varaqlar(ID, KEY);
  const ochir = []; let x = 0;
  const nusxala = async varaq => { const src = M.varaqlar.find(v => v.title === varaq); if (!src) throw new Error('Varaq topilmadi: ' + varaq);
    const j = await G.soralar(ID, [{ duplicateSheet: { sourceSheetId: src.sheetId, insertSheetIndex: M.varaqlar.length + ochir.length, newSheetName: 'zz_sinov_' + varaq } }], KEY);
    ochir.push(j.replies[0].duplicateSheet.properties.sheetId); await G.gid(ID, 'zz_sinov_' + varaq, KEY, true); return 'zz_sinov_' + varaq; };
  try {
    console.log('\n=== ⏭ BUGUN QILA OLMAYMAN (06n_Qadam_kun) ===');
    const n = await nusxala(QY.QDV);
    const R = await G.oraliqOqi(ID, n, 'A2:I', KEY);
    const eq = R[R.length - 1] || [];   // 06n ga hozir faqat server yozadi (Kechiktirildi / Kutilmoqda) — oldingi qator bilan
    console.log('  (06n ga eski tizim hali bu turdagi qator yozmagan — oldingi qator (' + (eq[4] || '—') + ') bilan solishtiriladi)');
    let t0 = Date.now();
    const r = await QY.qdYoz(n, V.bugun(), { xodim: 'SINOV', no: String(eq[2] || '27/1'), fish: String(eq[3] || 'SINOV'), holat: 'O\'tkazildi', sabab: 'SINOV — nusxa varaq, o\'chiriladi', qadam: 'Qo\'ng\'iroq qiling | 1-xatni chiqaring', bugun: '10:15 📞 SINOV' });
    console.log('Yozish: ' + (Date.now() - t0) + ' ms · qator ' + r);
    x += await qatorSolishtir(n, r, 1, 9, '— O\'tkazish qatori (A–I)');
    // ⏸️ kutish ruxsati (direktor): 06n «Kutilmoqda» qatori (11 ustun) — avvalgi «Kutilmoqda» qatori bilan; 10_Topshiriqlar L (muddat) — yuqoridagi L bilan
    console.log('\n=== ⏸️ KUTISHGA RUXSAT (06n «Kutilmoqda» + topshiriq muddati) ===');
    let ki = -1; R.forEach((q, i) => { if (String(q[4] || '') === 'Kutilmoqda') ki = i; });
    const gacha = new Date(Date.parse(V.bugun()) + 3 * 86400000).toISOString().slice(0, 10);
    t0 = Date.now();
    const rk = await QY.kutishYoz(n, V.bugun(), { xodim: 'SINOV', no: String(eq[2] || '27/1'), fish: String(eq[3] || 'SINOV'), sabab: 'SINOV — nusxa varaq (direktor ruxsati)', qadam: 'SINOV', bugun: '', gacha, k: 'olib' });
    console.log('Yozish: ' + (Date.now() - t0) + ' ms · qator ' + rk);
    x += await qatorSolishtir(n, rk, 1, 11, '— Kutish qatori (A–K)', ki >= 0 ? ki + 2 : null);
    const n10 = await nusxala('10_Topshiriqlar');
    const A10 = await G.oraliqOqi(ID, n10, 'A2:A', KEY); const r10 = A10.length + 1;
    await G.yoz(ID, [{ varaq: n10, katak: 'L' + r10, qiymat: [[gacha.split('-').reverse().join('.') + ' 18:00']] }], KEY);
    const L = await G.kataklarOqi(ID, n10, 'L' + (r10 - 1) + ':L' + r10, KEY);
    const la = (L[0] || [])[0] || {}, lb = (L[1] || [])[0] || {}, lt = c => (fmt(c).split(' ')[0]);
    const lok = tur(la) === tur(lb) && lt(la) === lt(lb);
    console.log('— Topshiriq muddati (L' + r10 + '): eski ' + tur(la) + ' ' + fmt(la) + ' «' + (la.formattedValue || '') + '» | server ' + tur(lb) + ' ' + fmt(lb) + ' «' + (lb.formattedValue || '') + '» ' + (lok ? '✅' : '⚠'));
    if (!lok) x++;
    console.log('\n=== ⓘ TOPILGAN MA\'LUMOT — TAHRIR SO\'ROVI (06i_Direktor_sorovlari) ===');
    const n6 = await nusxala(QY.SOR_V);
    const S6 = await QY.sorovlar(n6);
    const es = S6.L[S6.L.length - 1];   // 06i ga faqat eski tizim yozadi (appendRow) — oldingi qator bilan
    t0 = Date.now();
    const y = await QY.sorovYoz(n6, S6, 'SINOV', es ? es.kalit : '27/1', 'Telefon topildi — manba: SINOV', JSON.stringify({ d: { tel: '99 123 45 67' }, f: [['Telefon', '', '99 123 45 67']] }));
    console.log('Yozish: ' + (Date.now() - t0) + ' ms · ID ' + y.id + ', qator ' + y.qator);
    x += await qatorSolishtir(n6, y.qator, 1, 11, '— Tahrir so\'rovi (A–K)');
  } finally {
    if (ochir.length) await G.soralar(ID, ochir.map(g => ({ deleteSheet: { sheetId: g } })), KEY).catch(e => console.log('Nusxani o\'chirib bo\'lmadi: ' + e.message));
    console.log('\nNusxa varaqlar o\'chirildi.');
  }
  console.log('');
  if (!x && k15) { await redis.set('yozuv_yondi:qadam', '1'); await redis.set('yozuv_yondi:qadam_ruxsat', '1'); console.log('✅ HAMMASI BIR XIL — «Bugungi ish» dagi ⏭ o\'tkazish, 📣 direktorga, ⓘ ma\'lumot, 📅 muddat so\'rash, ✈ Telegram\n   va direktorning ✓ ruxsat / ✕ rad javoblari (o\'tkazish, muddat, kutish) endi server orqali.\n   Qaytarish kerak bo\'lsa: aks-yozuv-sinov ochir'); }
  else console.log('⚠ ' + (x ? x + ' ta farq' : 'ko\'prik javob bermadi') + ' — YOQILMADI (eski tizim orqali ishlayveradi).');
}

// ✎ TAHRIR: 02_Mijozlar kataklari (eski tizim 06j ga yozgan oxirgi tahrirlar bilan), 04 faoliyat, 06j jurnal qatori, 06i javob (G:J) — nusxa varaqlarda
async function tahrirSinov() {
  const TY = require('../api/tahrir_yoz')._ichki, QY = require('../api/qadam_yoz')._ichki;
  const adm = (await pool.query('SELECT kirish_kodi, huquqlar FROM v_xodimlar WHERE kompaniya_id = 1')).rows.find(z => (z.huquqlar || []).includes('admin') && String(z.kirish_kodi || '').length >= 8);
  let ver = '?'; try { ver = String(await koprik.chaqir('koprikVersiya', adm.kirish_kodi, [])); } catch (e) { ver = 'xato: ' + e.message; }
  const k15 = ver >= '1.5' && !/^xato/.test(ver);
  console.log('Eski tizim ko\'prigi (Telegram uchun): v' + ver + (k15 ? ' ✅' : ' ⚠ (1.5 kerak)'));
  const M = await G.varaqlar(ID, KEY);
  const ochir = []; let x = 0;
  const nusxala = async varaq => { const src = M.varaqlar.find(v => v.title === varaq); if (!src) throw new Error('Varaq topilmadi: ' + varaq);
    const j = await G.soralar(ID, [{ duplicateSheet: { sourceSheetId: src.sheetId, insertSheetIndex: M.varaqlar.length + ochir.length, newSheetName: 'zz_sinov_' + varaq } }], KEY);
    ochir.push(j.replies[0].duplicateSheet.properties.sheetId); await G.gid(ID, 'zz_sinov_' + varaq, KEY, true); return 'zz_sinov_' + varaq; };
  const katak = c => tur(c) + ' ' + fmt(c) + ' «' + qisqa(c.formattedValue, 24) + '»';
  const tozalaK = async (nx, q, u, faqatQiymat) => G.soralar(ID, [{ updateCells: { range: { sheetId: await G.gid(ID, nx, KEY), startRowIndex: q - 1, endRowIndex: q, startColumnIndex: u - 1, endColumnIndex: u },
    rows: [{ values: [{}] }], fields: faqatQiymat ? 'userEnteredValue' : 'userEnteredValue,userEnteredFormat.numberFormat' } }], KEY);
  try {
    const JR = await G.oraliqOqi(ID, TY.JUR_V, 'A2:J', KEY);
    console.log('\n=== ✎ MIJOZ KARTASI KATAKLARI (02_Mijozlar) ===');
    console.log('  06j_Tahrir_jurnali da eski tizim yozgan tahrirlar: ' + JR.filter(r => r[0]).length + ' ta');
    const M2 = await G.oraliqOqi(ID, TY.MIJ_V, 'A2:S', KEY);
    const nomU = {}; Object.keys(TY.TAHRIR_02).forEach(k => { nomU[TY.TAHRIR_02[k][1]] = TY.TAHRIR_02[k][0]; });
    const tanlov = {};   // har maydon bo'yicha oxirgi tahrir — katak hozir ham o'sha qiymatda bo'lsa
    for (let i = JR.length - 1; i >= 0; i--) { const r = JR[i] || []; const u = nomU[r[5]]; if (!u || tanlov[r[5]]) continue;
      const mi = M2.findIndex(z => String(z[0] || '').trim() === String(r[4] || '').trim()); if (mi < 0) continue;
      const yv = r[7] === '—' ? '' : String(r[7] || ''); if (String((M2[mi] || [])[u - 1] || '') !== yv) continue;
      tanlov[r[5]] = { qator: mi + 2, ustun: u, v: yv, no: r[2], vaqt: r[1] }; }
    const n2 = await nusxala(TY.MIJ_V);
    const T = Object.keys(tanlov);
    if (!T.length) {
      console.log('  (eski tizim bilan tahrirlangan katak topilmadi — kutilgan natija bilan: matn, @)');
      const mi = M2.findIndex(z => String(z[0] || '').trim()); const q = mi + 2;
      await tozalaK(n2, q, 5); await TY.matnKataklar(n2, [{ qator: q, ustun: 5, v: '99 123 45 67' }, { qator: q, ustun: 12, v: '12345678901234' }]);
      const R = await G.kataklarOqi(ID, n2, 'E' + q + ':L' + q, KEY); const a = (R[0] || [])[0] || {}, b = (R[0] || [])[7] || {};
      for (const [nm, c] of [['Telefon (E' + q + ')', a], ['JSHSHIR (L' + q + ')', b]]) { const ok = tur(c) === 'matn' && fmt(c) === 'TEXT @'; if (!ok) x++; console.log('  ' + nm + ': server ' + katak(c) + ' ' + (ok ? '✅' : '⚠ (matn, TEXT @ kutilgan)')); }
    }
    for (const nm of T) {
      const t = tanlov[nm]; const a1 = harf(t.ustun) + t.qator;
      await tozalaK(n2, t.qator, t.ustun);
      const t0 = Date.now(); await TY.matnKataklar(n2, [{ qator: t.qator, ustun: t.ustun, v: t.v }]); const ms = Date.now() - t0;
      const a = ((await G.kataklarOqi(ID, TY.MIJ_V, a1, KEY))[0] || [])[0] || {}, b = ((await G.kataklarOqi(ID, n2, a1, KEY))[0] || [])[0] || {};
      const ok = tur(a) === tur(b) && fmt(a) === fmt(b) && String(a.formattedValue || '') === String(b.formattedValue || '');
      if (!ok) x++;
      console.log('  ' + nm.padEnd(18) + ' ' + a1.padEnd(6) + ' (' + t.no + ', ' + t.vaqt + ') eski ' + katak(a) + ' | server ' + katak(b) + ' ' + (ok ? '✅' : '⚠') + ' · ' + ms + ' ms');
    }
    console.log('\n=== ✎ FAOLIYAT TURI (04_Ijara_shartnomalar, S) ===');
    const fr = [...JR].reverse().find(r => r && r[5] === 'Faoliyat turi');
    if (!fr) console.log('  (eski tizim faoliyat turini tahrirlamagan — o\'tkazildi; yozuv oddiy setValue)');
    else {
      const S4 = await G.oraliqOqi(ID, TY.S4_V, 'A2:S', KEY); const i4 = S4.findIndex(z => String(z[0] || '').trim() === String(fr[2] || '').trim());
      if (i4 < 0 || String((S4[i4] || [])[18] || '') !== fr[7]) console.log('  (oxirgi tahrir qilingan katak keyin o\'zgargan — o\'tkazildi)');
      else {
        const n4 = await nusxala(TY.S4_V); const a1 = 'S' + (i4 + 2);
        await tozalaK(n4, i4 + 2, 19, true); await G.yoz(ID, [{ varaq: n4, katak: a1, qiymat: [[fr[7]]] }], KEY);
        const a = ((await G.kataklarOqi(ID, TY.S4_V, a1, KEY))[0] || [])[0] || {}, b = ((await G.kataklarOqi(ID, n4, a1, KEY))[0] || [])[0] || {};
        const ok = tur(a) === tur(b) && fmt(a) === fmt(b); if (!ok) x++;
        console.log('  ' + a1 + ' eski ' + katak(a) + ' | server ' + katak(b) + ' ' + (ok ? '✅' : '⚠'));
      }
    }
    console.log('\n=== 📒 TAHRIR JURNALI (06j_Tahrir_jurnali) ===');
    const nj = await nusxala(TY.JUR_V);
    const jr = JR.filter(r => r[0]); const oxirgi = jr[jr.length - 1] || [];
    let t0 = Date.now();
    const w = await TY.jurnalYoz(nj, [[QY.hozir().dmyHm, String(oxirgi[2] || '27/1'), String(oxirgi[3] || 'Sotuv'), String(oxirgi[4] || '1'), 'Telefon', '90 123 45 67', '99 765 43 21', 'SINOV', 'direktor']]);
    console.log('Yozish: ' + (Date.now() - t0) + ' ms · qator ' + w.r + ', ID ' + w.L[0][0]);
    if (jr.length) x += await qatorSolishtir(nj, w.r, 1, 10, '— Jurnal qatori (A–J)');
    else { const R = (await G.kataklarOqi(ID, nj, 'A' + w.r + ':J' + w.r, KEY))[0] || []; console.log('  (eski qator yo\'q) ' + R.map((c, i) => harf(i + 1) + ': ' + katak(c)).join(' · ')); }
    console.log('\n=== 📨 DIREKTOR SO\'ROVI VA JAVOBI (06i_Direktor_sorovlari) ===');
    const n6 = await nusxala(QY.SOR_V);
    const S6 = await QY.sorovlar(n6);
    const es = S6.L[S6.L.length - 1];
    const jv = [...S6.L].reverse().find(z => z.holati === 'Tasdiqlandi' || z.holati === 'Rad etildi');
    t0 = Date.now();
    const y = await QY.sorovYoz(n6, S6, 'SINOV', jv ? jv.kalit : 'OG-SINOV', 'SINOV — nusxa varaq, o\'chiriladi', '', jv ? jv.tur : 'xat_bekor');
    await TY.javobYoz(n6, y.qator, ['Rad etildi', 'SINOV — nusxa varaq', QY.hozir().dmyHm, 'SINOV']);
    console.log('Yozish: ' + (Date.now() - t0) + ' ms · so\'rov ID ' + y.id + ', qator ' + y.qator + (jv ? ' · javobni eski tizim javob bergan qator ' + jv.qator + ' bilan' : ''));
    x += await qatorSolishtir(n6, y.qator, 1, 10, '— So\'rov + javob (A–J)', jv ? jv.qator : (es ? es.qator : null));
  } finally {
    if (ochir.length) await G.soralar(ID, ochir.map(g => ({ deleteSheet: { sheetId: g } })), KEY).catch(e => console.log('Nusxani o\'chirib bo\'lmadi: ' + e.message));
    console.log('\nNusxa varaqlar o\'chirildi.');
  }
  console.log('');
  if (!x && k15) { await redis.set('yozuv_yondi:tahrir', '1'); console.log('✅ HAMMASI BIR XIL — ✎ shartnoma ma\'lumotini tahrirlash, 📨 direktordan so\'rash, direktorning ✓/✕ javobi\n   va 📌 ma\'lumot topshirig\'ini kiritish / tasdiqlash endi server orqali.\n   Qaytarish kerak bo\'lsa: aks-yozuv-sinov ochir'); }
  else console.log('⚠ ' + (x ? x + ' ta farq' : 'ko\'prik javob bermadi') + ' — YOQILMADI (eski tizim orqali ishlayveradi).');
}

// ▶ UNDIRUV (Bugungi ish): qadamSkan / qadamHujjat dagi topshiriq yozuvi — 10_Topshiriqlar U «HJ:<id>» (eski topHjTekshir_ yozgan katak bilan), Koprik ≥ 1.7
async function undiruvSinov() {
  const adm = (await pool.query('SELECT kirish_kodi, huquqlar FROM v_xodimlar WHERE kompaniya_id = 1')).rows.find(z => (z.huquqlar || []).includes('admin') && String(z.kirish_kodi || '').length >= 8);
  let ver = '?'; try { ver = String(await koprik.chaqir('koprikVersiya', adm.kirish_kodi, [])); } catch (e) { ver = 'xato: ' + e.message; }
  const k17 = ver >= '1.7' && !/^xato/.test(ver);
  console.log('Eski tizim ko\'prigi: v' + ver + (k17 ? ' ✅' : ' ⚠ (1.7 kerak — Koprik.gs yangilanmagan)'));
  const M = await G.varaqlar(ID, KEY);
  const ochir = []; let x = 0;
  try {
    console.log('\n=== 📎 HUJJAT YUKLANGAN TOPSHIRIQ (10_Topshiriqlar, U «HJ:…») ===');
    const R = await G.oraliqOqi(ID, '10_Topshiriqlar', 'A2:V', KEY);
    let i = -1; R.forEach((r, k) => { if (/^HJ:\d+/.test(String(r[20] || ''))) i = k; });
    const src = M.varaqlar.find(v => v.title === '10_Topshiriqlar');
    const j = await G.soralar(ID, [{ duplicateSheet: { sourceSheetId: src.sheetId, insertSheetIndex: M.varaqlar.length, newSheetName: 'zz_sinov_10_Topshiriqlar' } }], KEY);
    ochir.push(j.replies[0].duplicateSheet.properties.sheetId); const n10 = 'zz_sinov_10_Topshiriqlar'; const g = await G.gid(ID, n10, KEY, true);
    const q = i >= 0 ? i + 2 : R.length + 2, v = i >= 0 ? String(R[i][20]) : 'HJ:123';
    await G.soralar(ID, [{ updateCells: { range: { sheetId: g, startRowIndex: q - 1, endRowIndex: q, startColumnIndex: 20, endColumnIndex: 21 }, rows: [{ values: [{}] }], fields: 'userEnteredValue' } }], KEY);
    const t0 = Date.now();
    await G.yoz(ID, [{ varaq: n10, katak: 'U' + q, qiymat: [[v]] }], KEY);
    const ms = Date.now() - t0;
    const a = ((await G.kataklarOqi(ID, '10_Topshiriqlar', 'U' + q, KEY))[0] || [])[0] || {}, b = ((await G.kataklarOqi(ID, n10, 'U' + q, KEY))[0] || [])[0] || {};
    const ok = i >= 0 ? (tur(a) === tur(b) && fmt(a) === fmt(b) && String(a.formattedValue || '') === String(b.formattedValue || '')) : tur(b) === 'matn';
    if (!ok) x++;
    console.log('  U' + q + (i >= 0 ? ' eski ' + tur(a) + ' ' + fmt(a) + ' «' + (a.formattedValue || '') + '» |' : ' (eski tizim yozgan katak yo\'q — kutilgan: matn) |') + ' server ' + tur(b) + ' ' + fmt(b) + ' «' + (b.formattedValue || '') + '» ' + (ok ? '✅' : '⚠') + ' · ' + ms + ' ms');
    console.log('  Qolgan yozuvlar (topshiriq holati N:R, 06d hujjat qatori, xat bekor) — avval sinovdan o\'tgan yo\'llar (topYop, hujjatYukla, xatBekor).');
  } finally {
    if (ochir.length) await G.soralar(ID, ochir.map(g => ({ deleteSheet: { sheetId: g } })), KEY).catch(e => console.log('Nusxani o\'chirib bo\'lmadi: ' + e.message));
    console.log('\nNusxa varaq o\'chirildi.');
  }
  console.log('');
  if (!x && k17) { await redis.set('yozuv_yondi:qadam_hujjat', '1'); console.log('✅ HAMMASI BIR XIL — «Bugungi ish» dagi ✕ xatni bekor qilish, 📎 shartnoma skani va 📎 so\'ralgan hujjatni yuklash\n   endi server orqali (tekshiruvchiga Telegram — eski tizim, fayl Drive\'ga ko\'chgach).\n   Qaytarish kerak bo\'lsa: aks-yozuv-sinov ochir'); }
  else console.log('⚠ ' + (x ? x + ' ta farq' : 'Koprik 1.7 emas') + ' — YOQILMADI (eski tizim orqali ishlayveradi).');
}

// ✉ XAT ISBOTI: 06e qatoriga N, P, Q:S, W, X:Y (eski «Yuborildi» qator bilan), 06_Undiruv_jurnali «Ёзма огоҳлантириш» qatori (eski avtomatik qator bilan); Koprik ≥ 1.7
async function xatSinov() {
  const XI = require('../api/xat_isbot')._ichki, U = require('../lib/undiruv_yordam');
  const adm = (await pool.query('SELECT kirish_kodi, huquqlar FROM v_xodimlar WHERE kompaniya_id = 1')).rows.find(z => (z.huquqlar || []).includes('admin') && String(z.kirish_kodi || '').length >= 8);
  let ver = '?'; try { ver = String(await koprik.chaqir('koprikVersiya', adm.kirish_kodi, [])); } catch (e) { ver = 'xato: ' + e.message; }
  const k17 = ver >= '1.7' && !/^xato/.test(ver);
  console.log('Eski tizim ko\'prigi: v' + ver + (k17 ? ' ✅' : ' ⚠ (1.7 kerak)'));
  const M = await G.varaqlar(ID, KEY);
  const ochir = []; let x = 0;
  const nusxala = async varaq => { const src = M.varaqlar.find(v => v.title === varaq); if (!src) throw new Error('Varaq topilmadi: ' + varaq);
    const j = await G.soralar(ID, [{ duplicateSheet: { sourceSheetId: src.sheetId, insertSheetIndex: M.varaqlar.length + ochir.length, newSheetName: 'zz_sinov_' + varaq } }], KEY);
    ochir.push(j.replies[0].duplicateSheet.properties.sheetId); await G.gid(ID, 'zz_sinov_' + varaq, KEY, true); return 'zz_sinov_' + varaq; };
  try {
    console.log('\n=== ✉ XAT «YUBORILDI» (06e_Xatlar) ===');
    const XJ = await XI.xatlarYangi(XI.XAT_V);
    const ey = [...XJ].reverse().find(h => h.holati === 'Yuborildi' && h.usul === 'Pochta' && h.pochta && h.tek) || [...XJ].reverse().find(h => h.holati === 'Yuborildi' && h.usul);
    if (!ey) { console.log('  (eski tizim «Yuborildi» qilgan xat yo\'q)'); x++; }
    else {
      const n6 = await nusxala(XI.XAT_V);
      const tq = [...XJ].reverse().find(h => h.holati === 'Tayyorlandi') || XJ[XJ.length - 1];
      const t0 = Date.now();
      await XI.xatKataklar(n6, tq, { nom: ey.skan || ey.isbot, usul: ey.usul === 'Pochta' ? 'pochta' : 'qol', sana: ey.yetSana.split('.').reverse().join('-'), pochta: ey.pochta || 'RB000000000UZ', tek: !!ey.tek, vaqt: '2026-10-18 23:30', fish: 'SINOV' });
      console.log('Yozish: ' + (Date.now() - t0) + ' ms · nusxada qator ' + tq.qator + ' (' + tq.raqam + '), eski tizim yozgan qator ' + ey.qator + ' (' + ey.raqam + ')');
      x += await qatorSolishtir(n6, tq.qator, 1, 25, '— Xat qatori (A–Y)', ey.qator);
    }
    console.log('\n=== 📒 UNDIRUV JURNALI — «Ёзма огоҳлантириш» (06_Undiruv_jurnali) ===');
    const UJ = await G.oraliqOqi(ID, XI.UND_V, 'A2:R', KEY);
    let ei = -1; UJ.forEach((r, i) => { if (String(r[4] || '') === 'Ёзма огоҳлантириш' && /орқали етказилди$/.test(String(r[5] || ''))) ei = i; });
    if (ei < 0) console.log('  (eski tizim yozgan avtomatik qator yo\'q — o\'tkazildi)');
    else {
      const nu = await nusxala(XI.UND_V);
      const er = UJ[ei]; const sh = (await U.undShartnomalar()).find(z => z.no === String(er[2])) || { no: String(er[2]), undiruvchi: String(er[3]), fish: String(er[12]), dokon: String(er[13]), jami: 0, mid: String(er[16]) };
      const t0 = Date.now();
      const r = await XI.undXatYoz(nu, { raqam: String(er[8]), shablon: '', bosqich: 1 }, 'қўлма-қўл', V.bugun(), 'SINOV', sh);
      console.log('Yozish: ' + (Date.now() - t0) + ' ms · qator ' + r + ', eski tizim yozgani ' + (ei + 2));
      x += await qatorSolishtir(nu, r, 1, 18, '— Jurnal qatori (A–R)', ei + 2);
    }
  } finally {
    if (ochir.length) await G.soralar(ID, ochir.map(g => ({ deleteSheet: { sheetId: g } })), KEY).catch(e => console.log('Nusxani o\'chirib bo\'lmadi: ' + e.message));
    console.log('\nNusxa varaqlar o\'chirildi.');
  }
  console.log('');
  if (!x && k17) { await redis.set('yozuv_yondi:xat_isbot', '1'); console.log('✅ HAMMASI BIR XIL — ✉ xat yetkazildi (imzolangan nusxa / pochta kvitansiyasi) va 📨 talabnoma isboti endi server orqali\n   (direktorga Telegram — eski tizim, fayl Drive\'ga ko\'chgach). Qaytarish kerak bo\'lsa: aks-yozuv-sinov ochir'); }
  else console.log('⚠ ' + (x ? x + ' ta farq' : 'Koprik 1.7 emas') + ' — YOQILMADI (eski tizim orqali ishlayveradi).');
}

// 📌 BAJARDIM: topshiriq holati (topYop) va yangi topshiriq (topYoz) — avval sinovdan o'tgan; bu yerda 10_Topshiriqlar U ni tozalash va G izohi (eski yozgan katak bilan); Koprik ≥ 1.7
async function bajardimSinov() {
  const adm = (await pool.query('SELECT kirish_kodi, huquqlar FROM v_xodimlar WHERE kompaniya_id = 1')).rows.find(z => (z.huquqlar || []).includes('admin') && String(z.kirish_kodi || '').length >= 8);
  let ver = '?'; try { ver = String(await koprik.chaqir('koprikVersiya', adm.kirish_kodi, [])); } catch (e) { ver = 'xato: ' + e.message; }
  const k17 = ver >= '1.7' && !/^xato/.test(ver);
  console.log('Eski tizim ko\'prigi: v' + ver + (k17 ? ' ✅' : ' ⚠ (1.7 kerak)'));
  const M = await G.varaqlar(ID, KEY);
  const ochir = []; let x = 0;
  try {
    console.log('\n=== 📌 TOPSHIRIQ KATAKLARI (10_Topshiriqlar: U tozalash, G izoh) ===');
    const R = await G.oraliqOqi(ID, '10_Topshiriqlar', 'A2:V', KEY);
    const src = M.varaqlar.find(v => v.title === '10_Topshiriqlar');
    const j = await G.soralar(ID, [{ duplicateSheet: { sourceSheetId: src.sheetId, insertSheetIndex: M.varaqlar.length, newSheetName: 'zz_sinov_10_Topshiriqlar' } }], KEY);
    ochir.push(j.replies[0].duplicateSheet.properties.sheetId); const n10 = 'zz_sinov_10_Topshiriqlar'; await G.gid(ID, n10, KEY, true);
    let iu = -1; R.forEach((r, k) => { if (String(r[20] || '')) iu = k; });
    const qu = iu >= 0 ? iu + 2 : R.length + 1;
    await G.yoz(ID, [{ varaq: n10, katak: 'U' + qu, qiymat: [['']] }], KEY);
    const bu = ((await G.kataklarOqi(ID, n10, 'U' + qu, KEY))[0] || [])[0] || {};
    const oku = tur(bu) === 'bo\'sh'; if (!oku) x++;
    console.log('  U' + qu + ' («' + (iu >= 0 ? R[iu][20] : '') + '») → tozalandi: ' + tur(bu) + ' ' + (oku ? '✅' : '⚠'));
    let ig = -1; R.forEach((r, k) => { if (/(Qaytarildi|Rad etildi|Kotiba): /.test(String(r[6] || ''))) ig = k; });
    if (ig >= 0) {
      const qg = ig + 2, v = String(R[ig][6]);
      await G.soralar(ID, [{ updateCells: { range: { sheetId: await G.gid(ID, n10, KEY), startRowIndex: qg - 1, endRowIndex: qg, startColumnIndex: 6, endColumnIndex: 7 }, rows: [{ values: [{}] }], fields: 'userEnteredValue' } }], KEY);
      await G.yoz(ID, [{ varaq: n10, katak: 'G' + qg, qiymat: [[v]] }], KEY);
      const a = ((await G.kataklarOqi(ID, '10_Topshiriqlar', 'G' + qg, KEY))[0] || [])[0] || {}, b = ((await G.kataklarOqi(ID, n10, 'G' + qg, KEY))[0] || [])[0] || {};
      const ok = tur(a) === tur(b) && fmt(a) === fmt(b) && String(a.formattedValue || '') === String(b.formattedValue || ''); if (!ok) x++;
      console.log('  G' + qg + ' eski ' + tur(a) + ' ' + fmt(a) + ' | server ' + tur(b) + ' ' + fmt(b) + ' «' + qisqa(b.formattedValue, 40) + '» ' + (ok ? '✅' : '⚠'));
    } else console.log('  (G izohi — eski tizim yozgan «Qaytarildi/Kotiba» izohi yo\'q, o\'tkazildi)');
  } finally {
    if (ochir.length) await G.soralar(ID, ochir.map(g => ({ deleteSheet: { sheetId: g } })), KEY).catch(e => console.log('Nusxani o\'chirib bo\'lmadi: ' + e.message));
    console.log('\nNusxa varaq o\'chirildi.');
  }
  console.log('');
  if (!x && k17) { await redis.set('yozuv_yondi:bajardim', '1'); console.log('✅ HAMMASI BIR XIL — 📌 topshiriqdagi «✓ Bajardim» (faylsiz), 🤝 nusxani kotibaga topshirish va ✖ «menga berilmagan»\n   endi server orqali (tekshiruvchiga Telegram — eski tizim). Isbot fayli bilan «Bajardim» — hali eski tizim orqali.\n   Qaytarish kerak bo\'lsa: aks-yozuv-sinov ochir'); }
  else console.log('⚠ ' + (x ? x + ' ta farq' : 'Koprik 1.7 emas') + ' — YOQILMADI (eski tizim orqali ishlayveradi).');
}

(async () => {
  const arg = process.argv[2];
  if (arg === 'ochir') {
    await redis.del('yozuv_yondi:tolov', 'yozuv_yondi:tashrif', 'yozuv_yondi:taminot', 'yozuv_yondi:hujjat', 'yozuv_yondi:topshiriq', 'yozuv_yondi:tasdiq', 'yozuv_yondi:mayda', 'yozuv_yondi:shartnoma', 'yozuv_yondi:eksport', 'yozuv_yondi:eksport_pdf', 'yozuv_yondi:hisobot_pdf', 'yozuv_yondi:qadam', 'yozuv_yondi:qadam_ruxsat', 'yozuv_yondi:tahrir', 'yozuv_yondi:qadam_hujjat', 'yozuv_yondi:xat_isbot', 'yozuv_yondi:bajardim');
    console.log('⏸ Serverda yozish O\'CHIRILDI — to\'lov, tashrif, ta\'minot, hujjat tuzatish, topshiriq, tasdiqlash, shartnoma va reyestr PDF/Excel yana eski tizim orqali.');
  } else if (arg === 'bajardim') {
    console.log('Hozir: topshiriq «Bajardim», nusxa kotibaga — ' + ((await redis.get('yozuv_yondi:bajardim')) === '1' ? 'serverda' : 'eski tizimda'));
    const M = await G.varaqlar(ID, KEY);
    const eski = M.varaqlar.filter(v => /^zz_sinov_/.test(v.title));
    if (eski.length) await G.soralar(ID, eski.map(v => ({ deleteSheet: { sheetId: v.sheetId } })), KEY);
    await bajardimSinov();
  } else if (arg === 'xat') {
    console.log('Hozir: xat isboti (yetkazildi) — ' + ((await redis.get('yozuv_yondi:xat_isbot')) === '1' ? 'serverda' : 'eski tizimda'));
    const M = await G.varaqlar(ID, KEY);
    const eski = M.varaqlar.filter(v => /^zz_sinov_/.test(v.title));
    if (eski.length) await G.soralar(ID, eski.map(v => ({ deleteSheet: { sheetId: v.sheetId } })), KEY);
    await xatSinov();
  } else if (arg === 'undiruv') {
    console.log('Hozir: Bugungi ish — skan, hujjat, xat bekor — ' + ((await redis.get('yozuv_yondi:qadam_hujjat')) === '1' ? 'serverda' : 'eski tizimda'));
    const M = await G.varaqlar(ID, KEY);
    const eski = M.varaqlar.filter(v => /^zz_sinov_/.test(v.title));
    if (eski.length) await G.soralar(ID, eski.map(v => ({ deleteSheet: { sheetId: v.sheetId } })), KEY);
    await undiruvSinov();
  } else if (arg === 'tahrir') {
    console.log('Hozir: shartnoma tahriri va direktor so\'rovlari — ' + ((await redis.get('yozuv_yondi:tahrir')) === '1' ? 'serverda' : 'eski tizimda'));
    const M = await G.varaqlar(ID, KEY);
    const eski = M.varaqlar.filter(v => /^zz_sinov_/.test(v.title));
    if (eski.length) await G.soralar(ID, eski.map(v => ({ deleteSheet: { sheetId: v.sheetId } })), KEY);
    await tahrirSinov();
  } else if (arg === 'qadam') {
    console.log('Hozir: Bugungi ish amallari — ' + ((await redis.get('yozuv_yondi:qadam')) === '1' ? 'serverda' : 'eski tizimda'));
    const M = await G.varaqlar(ID, KEY);
    const eski = M.varaqlar.filter(v => /^zz_sinov_/.test(v.title));
    if (eski.length) await G.soralar(ID, eski.map(v => ({ deleteSheet: { sheetId: v.sheetId } })), KEY);
    await qadamSinov();
  } else if (arg === 'hisobot') {
    console.log('Hozir: hisobot PDF — ' + ((await redis.get('yozuv_yondi:hisobot_pdf')) === '1' ? 'serverda' : 'eski tizimda'));
    await hisobotSinov();
  } else if (arg === 'eksport') {
    console.log('Hozir: reyestr PDF/Excel — ' + ((await redis.get('yozuv_yondi:eksport')) === '1' ? 'serverda' : 'eski tizimda'));
    await eksportSinov();
  } else if (arg === 'taminot') {
    console.log('Hozir: ta\'minot — ' + ((await redis.get('yozuv_yondi:taminot')) === '1' ? 'serverda' : 'eski tizimda'));
    const M = await G.varaqlar(ID, KEY);
    const eski = M.varaqlar.filter(v => /^zz_sinov_/.test(v.title));
    if (eski.length) await G.soralar(ID, eski.map(v => ({ deleteSheet: { sheetId: v.sheetId } })), KEY);
    await taminotSinov();
  } else if (arg === 'shartnoma') {
    console.log('Hozir: shartnoma/mijoz/ijara saqlash — ' + ((await redis.get('yozuv_yondi:shartnoma')) === '1' ? 'serverda' : 'eski tizimda'));
    const M = await G.varaqlar(ID, KEY);
    const eski = M.varaqlar.filter(v => /^zz_sinov_/.test(v.title));
    if (eski.length) await G.soralar(ID, eski.map(v => ({ deleteSheet: { sheetId: v.sheetId } })), KEY);
    await shartnomaSinov();
  } else if (arg === 'mayda') {
    console.log('Hozir: xat bekor / oylik reja — ' + ((await redis.get('yozuv_yondi:mayda')) === '1' ? 'serverda' : 'eski tizimda'));
    const M = await G.varaqlar(ID, KEY);
    const eski = M.varaqlar.filter(v => /^zz_sinov_/.test(v.title));
    if (eski.length) await G.soralar(ID, eski.map(v => ({ deleteSheet: { sheetId: v.sheetId } })), KEY);
    await maydaSinov();
  } else if (arg === 'tasdiq') {
    // jadvalga server yozmaydi — qarorni eski tizimning o'zi (tasdiqQil / topTasdiq) fonda bajaradi; faqat ko'prik ishlashini tekshiramiz
    console.log('Hozir: tasdiqlash — ' + ((await redis.get('yozuv_yondi:tasdiq')) === '1' ? 'tez (navbat)' : 'eski tizim (kutiladi)'));
    const adm = (await pool.query('SELECT kirish_kodi, huquqlar FROM v_xodimlar WHERE kompaniya_id = 1')).rows.find(x => (x.huquqlar || []).includes('admin') && String(x.kirish_kodi || '').length >= 8);
    let ver = '?'; try { ver = String(await koprik.chaqir('koprikVersiya', adm.kirish_kodi, [])); } catch (e) { ver = 'xato: ' + e.message; }
    const k15 = ver >= '1.5' && !/^xato/.test(ver);
    console.log('Eski tizim ko\'prigi: v' + ver + (k15 ? ' ✅' : ' ⚠ (1.5 kerak)'));
    console.log('Navbatda: ' + (await redis.llen('tasdiq_navbat')) + ' ta qaror');
    if (k15) { await redis.set('yozuv_yondi:tasdiq', '1'); console.log('✅ YOQILDI — «Tasdiqlash / Qaytarish» darhol javob beradi; qarorni eski tizim fonda bajaradi (natija avvalgidek).\n   Xato bo\'lsa — isbot ro\'yxatga qaytadi va direktorga Telegram keladi. Qaytarish: aks-yozuv-sinov ochir'); }
    else console.log('⚠ Ko\'prik javob bermadi — YOQILMADI.');
  } else if (arg === 'topshiriq') {
    console.log('Hozir: topshiriq berish — ' + ((await redis.get('yozuv_yondi:topshiriq')) === '1' ? 'serverda' : 'eski tizimda'));
    const M = await G.varaqlar(ID, KEY);
    const eski = M.varaqlar.filter(v => /^zz_sinov_/.test(v.title));
    if (eski.length) await G.soralar(ID, eski.map(v => ({ deleteSheet: { sheetId: v.sheetId } })), KEY);
    await topshiriqSinov();
  } else if (arg === 'hujjat') {
    console.log('Hozir: hujjat tuzatish — ' + ((await redis.get('yozuv_yondi:hujjat')) === '1' ? 'serverda' : 'eski tizimda'));
    const M = await G.varaqlar(ID, KEY);
    const eski = M.varaqlar.filter(v => /^zz_sinov_/.test(v.title));
    if (eski.length) await G.soralar(ID, eski.map(v => ({ deleteSheet: { sheetId: v.sheetId } })), KEY);
    await hujjatSinov();
  } else {
    const holat = async n => (await redis.get('yozuv_yondi:' + n)) === '1' ? 'serverda' : 'eski tizimda';
    console.log('Hozir: to\'lov — ' + await holat('tolov') + ', tashrif — ' + await holat('tashrif'));
    const M = await G.varaqlar(ID, KEY);   // oldingi sinovdan qolib ketgan nusxalar
    const eski = M.varaqlar.filter(v => /^zz_sinov_/.test(v.title));
    if (eski.length) await G.soralar(ID, eski.map(v => ({ deleteSheet: { sheetId: v.sheetId } })), KEY);
    const bugun = V.bugun().split('-').reverse().join('.');
    let x = 0;
    x += await sinov('TO\'LOV', K.T05, K.F05, 15, (h, p) => [h.id, bugun, String(p[2] || ''), 1, 'Naqt', '', String(p[6] || ''), '', '', 'SINOV', K.hozirDmyHms(), 'SINOV — nusxa varaq, o\'chiriladi']);
    x += await sinov('TASHRIF', K.T01b, K.F01b, 16, (h, p) => [h.id, bugun, 'Sinov Tekshiruv', String(p[3] || ''), String(p[4] || ''), String(p[5] || ''), String(p[6] || ''), 'SINOV', 'SINOV', K.hozirDmyHms()]);
    console.log('');
    if (!x) {
      await redis.set('yozuv_yondi:tolov', '1'); await redis.set('yozuv_yondi:tashrif', '1');
      console.log('✅ HAMMASI BIR XIL — serverda yozish YOQILDI: to\'lov va tashrif endi server orqali saqlanadi.');
      console.log('   Qaytarish kerak bo\'lsa: aks-yozuv-sinov ochir');
    } else {
      console.log('⚠ ' + x + ' ta farq — serverda yozish YOQILMADI (eski tizim orqali ishlayveradi).');
    }
  }
  await pool.end(); redis.disconnect(); process.exit(0);
})().catch(async e => { console.error('XATO:', e.message); try { await pool.end(); redis.disconnect(); } catch (z) { } process.exit(1); });
