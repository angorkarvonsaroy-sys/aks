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

(async () => {
  const arg = process.argv[2];
  if (arg === 'ochir') {
    await redis.del('yozuv_yondi:tolov', 'yozuv_yondi:tashrif', 'yozuv_yondi:taminot', 'yozuv_yondi:hujjat', 'yozuv_yondi:topshiriq');
    console.log('⏸ Serverda yozish O\'CHIRILDI — to\'lov, tashrif, ta\'minot, hujjat tuzatish va topshiriq berish yana eski tizim orqali saqlanadi.');
  } else if (arg === 'taminot') {
    console.log('Hozir: ta\'minot — ' + ((await redis.get('yozuv_yondi:taminot')) === '1' ? 'serverda' : 'eski tizimda'));
    const M = await G.varaqlar(ID, KEY);
    const eski = M.varaqlar.filter(v => /^zz_sinov_/.test(v.title));
    if (eski.length) await G.soralar(ID, eski.map(v => ({ deleteSheet: { sheetId: v.sheetId } })), KEY);
    await taminotSinov();
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
