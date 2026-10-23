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
//            aks-yozuv-sinov xatpdf    — ogohlantirish xati PDF'i serverda lokal natija bilan bir xil chiqishini tekshirish (hech narsa yoqmaydi)
//            aks-yozuv-sinov xatchiqar — xat chiqarish (06e qatori nusxada + PDF + Drive'ga ko'chirish, Koprik v1.8) ni sinash va yoqish
//            aks-yozuv-sinov bekor     — shartnomani bekor qilish (06h qatori nusxada + buyruq/xabarnoma PDF + Drive va Word nusxasi, Koprik v1.9) ni sinash va yoqish
//            aks-yozuv-sinov yuristish — to'g'ridan-to'g'ri yuristga o'tkazish va yurist → undiruvchiga topshiriq ni sinash va yoqish
//            aks-yozuv-sinov yurhujjat — yurist hujjatlari (ma'lumotnoma, bayonnoma, penya) va aloqa xatini sinash va yoqish (aloqa: Koprik v1.11)
//            aks-yozuv-sinov qayta     — qayta tuzish: o'qishlar eski tizim bilan solishtiriladi, 06k nusxasida yozuv; skan/tekshiruvga/qaytarish ni yoqish
//            aks-yozuv-sinov qaytabekor — qayta tuzish loyihasini bekor qilish: 06k nusxasida server yozuvi (C holat, AE jurnal) eski tizim bekor qilgan qator bilan; Koprik 1.14 (bo'sh papka savatga); yoqish
//            aks-yozuv-sinov qayta2    — qayta tuzish 2-bosqich: nusxa varaqlarda to'liq tasdiq yozuvi + loyiha qatori, eski yozganlari bilan; loyiha/ijrochi/tasdiq ni yoqish
//            aks-yozuv-sinov qaytahuj  — qayta tuzish hujjatlari (4 PDF): oxirgi «Bajarildi» loyiha uchun serverda qayta yasab, eski tizim Drive'ga qo'ygan PDF lar bilan so'zma-so'z (joyi bilan) solishtirish; hujjatlarni yoqish
//            aks-yozuv-sinov shpdf [27/351] [IJ-27/141] — shartnoma PDF (sotuv va ijara): serverda qayta yasab, eski tizim Drive'ga qo'ygan PDF (03 S / 04 V havolasi) bilan so'zma-so'z solishtirish; shartnoma PDF ni yoqish
//            aks-yozuv-sinov tekshir   — 🎲 tekshiruv qo'ng'irog'i javobi: 06p M:O javob, 06q qoidabuzarlik qatori, qayta tekshiruv (10 + 06p) — nusxa varaqlarda; ijroTekshirJavob ni yoqish
//            aks-yozuv-sinov imzosiz   — ✕ imzolanmagan ijara: 06l so'rov qatori va javob, 04 C/D/W + 06j bekor yozuvi — nusxa varaqlarda; ijaraImzosizSorov/Javob ni yoqish
//            aks-yozuv-sinov devon     — 📮 kirim xat: 11_Devonxona qatori, tarix va «direktor ko'rdi» (nusxa varaqda, eski yozgan qator bilan), skan Drive'ga (Koprik v1.12, SINOV fayl, savatga); devonKirimSaqla ni yoqish
//            aks-yozuv-sinov kb        — 🤝 kelishuv bilan bekor: hujjat (PDF so'zma-so'z, Word matni) eski tizim yasagani bilan, 06m qatori (nusxada), Drive (Koprik v1.12); kbTayyorla ni yoqish
//            aks-yozuv-sinov kb2       — 🤝 kelishuv: skan yuklash, so'rovni bekor qilish, direktor tasdig'i/radi (06m kataklari, 04 C/D/W + 06j — nusxa varaqlarda), skan Drive'ga (Koprik v1.13); kbSkan/kbBekor/kbTasdiq ni yoqish
//            aks-yozuv-sinov sifat     — 👁 ko'rish rejimi: bitta xodim nomidan o'qish (server vs eski sifatida — javob tuzilishi va ismi), yozuvchi amal rad etilishi; yoqish
//            aks-yozuv-sinov devon2    — devonxona qolgan amallari (chiqim xat ro'yxati, yuborildi, rezolyutsiya, ijro topshirish, tasdiq, rezolyutsiya qaytarish, bekor):
//                                        11 va 10 NUSXALARIDA to'liq yo'l, eski tizim yozgan qatorlar bilan (tur/format), JSON va tarix naqshlari; Koprik 1.15; yoqish
//            aks-yozuv-sinov devonxat  — blankadagi chiquvchi xat: eski tizim yasagan xatlarni server qayta yasab PDF (so'zlar joyi) va Word bilan solishtiradi; yoqish
//            aks-yozuv-sinov ertalab   — 07c_Ertalab_svod yozuvi (undErtalabYubor): nusxa varaqda bugungi qatorlar yozish / qayta yozish, eski tizim yozgan qator bilan (tur/format)
//            aks-yozuv-sinov ijrokun   — 📒 ijroKechki yozuvi: 06r va 06q NUSXALARIDA (bugungi kechki qoidabuzarliklar nusxadan olib tashlanib, server qayta yozadi), eski yozgan qatorlar bilan (tur/format), Telegram'siz
//            aks-yozuv-sinov kirish    — 🔑 07b_Kirish_jurnali qatori (PIN kirishi): nusxa varaqda, eski yozgan oxirgi qator bilan; yoqish (eski tizimga pinKir yuborilmaydi)
//            aks-yozuv-sinov mijozpdf [M0251 …] — 👤 mijoz kartasi PDF: eski tizim yasagani bilan matn, sahifa va so'zlar joyi (ikki sahifa varianti); yoqish
//            aks-yozuv-sinov topmening — 📌 Topshiriqlarim: hujjat topshiriqlarini yopish (har xodim: server quruq hisob → eski topMening yozadi → solishtirish); yoqish
//            aks-yozuv-sinov tophozir  — 🤖 topshiriq qoidalari: server «quruq» hisoblaydi, eski topHozir yozadi, 10_Topshiriqlar dagi yangi/yopilgan qatorlar server hisobi bilan; topHozir ni yoqish
//            aks-yozuv-sinov ochir     — hammasini o'chirish (eski tizimga qaytadi)
'use strict';
const { verOk } = require('../lib/versiya');
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
function solishtir(o, y, ustunlar, sarlavha, maxsus) {
  let xato = 0;
  console.log(sarlavha);
  console.log('Ustun | eski tizim yozgan qator          | server yozgan qator              | ');
  for (const u of ustunlar) {
    const a = o[u - 1] || {}, b = y[u - 1] || {};
    const fa = fmt(a), fb = fmt(b), ta = tur(a), tb = tur(b);
    let ok = (ta === 'bo\'sh' || tb === 'bo\'sh') ? true : (fa === fb && ta === tb);
    if ((ta === 'formula') !== (tb === 'formula')) ok = false;
    if (maxsus && maxsus[u]) ok = maxsus[u](a, b);
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
  const k15 = verOk(ver, '1.5') && !/^xato/.test(ver);
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
  const k16 = verOk(ver, '1.6') && !/^xato/.test(ver);
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
  const k15 = verOk(ver, '1.5') && !/^xato/.test(ver);
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
  const k15 = verOk(ver, '1.5') && !/^xato/.test(ver);
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
    const m = t.normalize('NFKC').replace(/[\u00ad\u200b]/g, '');   // yumshoq defis va ko'rinmas bo'sh joy (Docs qator uzilishida qo'yadi) — matn emas
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
  // o'lcham: Google Docs PDF'i 596 x 842, Chromium 595.92 x 841.92 — 0,08 pt (0,03 mm) farq ko'zga ko'rinmaydi, 0,5 pt gacha teng hisoblanadi
  const olT = (p, q) => { const f = t => (String(t).match(/[\d.]+/g) || []).slice(0, 2).map(Number); const [u, v] = [f(p), f(q)]; return u.length === 2 && v.length === 2 && Math.abs(u[0] - v[0]) <= 0.5 && Math.abs(u[1] - v[1]) <= 0.5; };
  if (a.bet !== b.bet || !olT(a.olcham, b.olcham)) { x++; console.log('  ✖ sahifalar: eski ' + a.bet + ' bet ' + a.olcham + ' | server ' + b.bet + ' bet ' + b.olcham); }
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
  const k15 = verOk(ver, '1.5') && !/^xato/.test(ver);
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
  const k15 = verOk(ver, '1.5') && !/^xato/.test(ver);
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
  const k17 = verOk(ver, '1.7') && !/^xato/.test(ver);
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
  const k17 = verOk(ver, '1.7') && !/^xato/.test(ver);
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
  const k17 = verOk(ver, '1.7') && !/^xato/.test(ver);
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

// ⚖ YURISTGA SO'ROV: 06b yangi ish qatori (eski «Tasdiq kutilmoqda»/U4 qator bilan; Q:S formulalari), 06f tarix qatori (oldingi qator bilan)
// ⚖ YURIST: to'g'ridan-to'g'ri o'tkazish (06b «Faol» qatori + AD) va yurist → undiruvchiga topshiriq (10_Topshiriqlar) — nusxa varaqlarda
// 📄 Yurist hujjatlarining ESKI tizimdagi namunalari (ma'lumotnoma, bayonnoma, penya — PDF / Word / Excel) — serverdagi nusxani solishtirish uchun.
// Eski tizim yasaydi va direktorning Drive'iga «AKS TIZIM / 06 XATLAR / <yil>» ga NAMUNA_… nomi bilan qo'yiladi (keyin o'chiriladi). Bazaga hech narsa yozilmaydi.
async function yhNamuna(idArg) {
  const J = require('../lib/jurnallar');
  const adm = (await pool.query('SELECT kirish_kodi, huquqlar FROM v_xodimlar WHERE kompaniya_id = 1')).rows.find(z => (z.huquqlar || []).includes('admin') && String(z.kirish_kodi || '').length >= 8);
  const R = await G.oraliqOqi(ID, '06b_Yuridik_ishlar', 'A2:O', KEY);
  const UJ = await J.undJurnal(), son = {}; UJ.forEach(j => { son[j.no] = (son[j.no] || 0) + 1; });
  const ish = R.filter(r => String(r[0] || '') && /^(Faol|Kelishuv)$/.test(String(r[14] || ''))).map(r => ({ id: String(r[0]), no: String(r[1]), n: son[String(r[1])] || 0 }));
  const tan = idArg ? ish.find(i => i.id === String(idArg)) || { id: String(idArg), no: '?', n: 0 } : ish.sort((a, b) => b.n - a.n)[0];
  if (!tan) { console.log('Faol yurist ishi topilmadi.'); return; }
  console.log('Ish ID ' + tan.id + ' (' + tan.no + ', jurnalda ' + tan.n + ' qayd)');
  const yil = V.bugun().slice(0, 4);
  for (const [fn, fmt] of [['yhMalumotnoma', 'pdf'], ['yhMalumotnoma', 'doc'], ['yhBayonnoma', 'pdf'], ['yhBayonnoma', 'doc'], ['yhBayonnoma', 'xlsx'], ['yhPenya', 'pdf'], ['yhPenya', 'doc'], ['yhPenya', 'xlsx']]) {
    const t0 = Date.now();
    try {
      const r = await koprik.chaqir(fn, adm.kirish_kodi, [tan.id, fmt]);
      const nom = 'NAMUNA_' + fn + '_' + fmt + '_' + tan.id + '.pdf';
      await koprik.chaqir('koprikXatSaqla', adm.kirish_kodi, [{ yil, nom, b64: r.b64 }]);
      console.log('  ✅ ' + fn + ' ' + fmt + ' — ' + Math.round(Buffer.from(r.b64, 'base64').length / 1024) + ' KB, ' + Math.round((Date.now() - t0) / 1000) + ' s');
    } catch (e) { console.log('  ⚠ ' + fn + ' ' + fmt + ': ' + e.message); }
  }
  console.log('\nNamunalar Drive\'ga qo\'yildi (AKS TIZIM / 06 XATLAR / ' + yil + ', NAMUNA_…). Claude ularni solishtirgach o\'chiradi.');
}
// ⚖ YURIST HUJJATLARI va ALOQA XATI:
//   1) soxta ma'lumot — PDF har so'z joyi, Word va Excel qismlari lokal natija bilan (lib/yurist_sinov.js);
//   2) haqiqiy ish — eski tizim yasagan ma'lumotnoma / bayonnoma / penya (PDF, Word, Excel) server nusxasi bilan;
//   3) aloqa xati — 06g qatori nusxada (eski tizim yozgan qator bilan), 06f tarix, eski tizim yasagan oxirgi aloqa xatini server qayta
//      yasaydi (PDF — matn va ko'rinish, Word — Google eksporti bilan bayt-ma-bayt), Drive (Koprik v1.11: .docx).
// Hujjatlar bir xil bo'lsa — yozuv_yondi:yurist_hujjat, aloqa xati ham bir xil va Koprik 1.11 bo'lsa — yozuv_yondi:yurist_aloqa.
async function zipQismlar(nom, eskiB, yangiB, xlsx) {
  const A = XL.zipOqi(eskiB), B = XL.zipOqi(yangiB); let x = 0;
  const sst = Z => [...String(Z['xl/sharedStrings.xml'] || '').matchAll(/<si><t[^>]*>([\s\S]*?)<\/t><\/si>/g)].map(m => m[1]);
  const SA = xlsx ? sst(A) : null, SB = xlsx ? sst(B) : null;
  const yech = (t, S) => t.replace(/ t="s"><v>(\d+)<\/v>/g, (m, i) => ' t="s"><v>' + S[+i] + '</v>');
  if (!xlsx) {   // Word: Google eksporti rasmlarni har safar boshqa tartibda raqamlashi mumkin (image1/2/3, rId) — rasmlar mazmuni (xesh) bo'yicha solishtiriladi
    const tekis = Z => {
      const rel = String(Z['word/_rels/document.xml.rels'] || ''), xs = {}, map = {};
      Object.keys(Z).filter(k => k.startsWith('word/media/')).forEach(k => { xs[k] = require('crypto').createHash('sha1').update(Z[k]).digest('hex').slice(0, 12); });
      for (const m of rel.matchAll(/<Relationship [^>]*?Id="([^"]+)"[^>]*?Target="media\/([^"]+)"[^>]*?\/>/g)) map[m[1]] = xs['word/media/' + m[2]];
      for (const m of rel.matchAll(/<Relationship [^>]*?Target="media\/([^"]+)"[^>]*?Id="([^"]+)"[^>]*?\/>/g)) map[m[2]] = xs['word/media/' + m[1]];
      const o = {}; Object.keys(Z).forEach(k => { if (!k.startsWith('word/media/')) o[k] = Z[k]; });
      o['word/media'] = Buffer.from(Object.values(xs).sort().join(','));
      o['word/_rels/document.xml.rels'] = Buffer.from(rel.replace(/<Relationship [^>]*?media\/[^>]*?\/>/g, ''));
      if (o['word/document.xml']) o['word/document.xml'] = Buffer.from(o['word/document.xml'].toString('utf8').replace(/r:embed="([^"]+)"/g, (q, id) => 'r:embed="' + (map[id] || id) + '"').replace(/(<wp:docPr id=")\d+/g, '$1?').replace(/"(image\d+\.[a-z]+)"/g, (q, f) => '"' + (xs['word/media/' + f] || f) + '"'));
      return o;
    };
    const ta = tekis(A), tb = tekis(B); Object.keys(A).forEach(k => delete A[k]); Object.keys(B).forEach(k => delete B[k]); Object.assign(A, ta); Object.assign(B, tb);
  }
  const nomlar = [...new Set([...Object.keys(A), ...Object.keys(B)])].sort(); const farq = [];
  for (const n of nomlar) {
    let a = A[n] ? A[n].toString('utf8') : null, b = B[n] ? B[n].toString('utf8') : null;
    if (xlsx && n === 'xl/sharedStrings.xml') { if (JSON.stringify([...SA].sort()) !== JSON.stringify([...SB].sort())) farq.push(n); continue; }
    if (xlsx && /^xl\/worksheets\/sheet\d+\.xml$/.test(n) && a && b) { a = yech(a, SA); b = yech(b, SB); }
    if (a !== b) farq.push(n);
  }
  if (farq.length) {
    x++; console.log('  ✖ ' + nom + ': farqli qismlar — ' + farq.join(', '));
    if (xlsx) {   // qaysi kataklar farq qiladi — tuzatish uchun ko'rsatiladi
      const kat = (t, S) => { const o = new Map(); for (const m of yech(t, S).matchAll(/<c r="([A-Z]+\d+)"[^>]*?(?:\/>|>[\s\S]*?<\/c>)/g)) o.set(m[1], m[0]); return o; };
      farq.filter(n => /sheet\d+\.xml$/.test(n) && A[n] && B[n]).forEach(n => {
        const ka = kat(A[n].toString('utf8'), SA), kb = kat(B[n].toString('utf8'), SB); let k = 0;
        for (const r of new Set([...ka.keys(), ...kb.keys()])) if (ka.get(r) !== kb.get(r) && k++ < 4) console.log('     ' + n.replace('xl/worksheets/', '') + ' ' + r + ': eski ' + String(ka.get(r) || '—').slice(0, 110) + ' | server ' + String(kb.get(r) || '—').slice(0, 110));
        if (k > 4) console.log('     … yana ' + (k - 4) + ' katak');
        const ta = A[n].toString('utf8').replace(/<sheetData>[\s\S]*<\/sheetData>/, ''), tb = B[n].toString('utf8').replace(/<sheetData>[\s\S]*<\/sheetData>/, '');
        if (ta !== tb) console.log('     ' + n.replace('xl/worksheets/', '') + ' kataklardan tashqari qism ham farq qiladi');
      });
      if (farq.includes('xl/styles.xml')) { const xf = Z => ((/<cellXfs count="(\d+)"/.exec(Z['xl/styles.xml'].toString('utf8')) || [])[1]); console.log('     uslublar soni: eski ' + xf(A) + ' | server ' + xf(B)); }
    }
  }
  else console.log('  ✅ ' + nom + ': ' + nomlar.length + ' qism — ' + (xlsx ? 'kataklar, uslublar, ustunlar bir xil' : 'Google eksporti bilan bayt-ma-bayt bir xil'));
  return x;
}
async function yuristHujjatSinov() {
  const YS = require('../lib/yurist_sinov'), YHA = require('../api/yurist_hujjat')._ichki, YA = require('../api/yurist_aloqa')._ichki, YSO = require('../api/yurist_sorov')._ichki;
  const YM = require('../lib/yurist_malumot'), YH = require('../lib/yurist_hujjat'), XP = require('../lib/xat_pdf'), BW = require('../lib/bekor_word'), J = require('../lib/jurnallar');
  const DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  const adm = (await pool.query('SELECT kirish_kodi, huquqlar, fish FROM v_xodimlar WHERE kompaniya_id = 1')).rows.find(z => (z.huquqlar || []).includes('admin') && String(z.kirish_kodi || '').length >= 8);
  let ver = '?'; try { ver = String(await koprik.chaqir('koprikVersiya', adm.kirish_kodi, [])); } catch (e) { ver = 'xato: ' + e.message; }
  const k111 = !/^xato/.test(ver) && verOk(ver, '1.11');
  console.log('Eski tizim ko\'prigi: v' + ver + (k111 ? ' ✅' : ' ⚠ (aloqa xati uchun 1.11 kerak — Koprik.gs ni yangilang)'));
  let xH = 0, xA = 0;
  console.log('\n=== 📄 SOXTA MA\'LUMOT (har so\'z joyi; Word va Excel qismlari) ===');
  if (!(await PDF.bor())) { console.log('  ⏳ PDF dasturi (Chromium) hali tayyor emas'); xH++; xA++; }
  else { const r = await YS.tekshir(); r.chiqish.forEach(z => console.log('  ' + z)); if (r.farq) { xH++; xA++; } }

  console.log('\n=== ⚖ HAQIQIY ISH: eski tizim yasagan hujjat ↔ server nusxasi ===');
  await tetik.yangilaKut(30000);
  const R = await G.oraliqOqi(ID, '06b_Yuridik_ishlar', 'A2:O', KEY);
  const UJ = await J.undJurnal(), son = {}; UJ.forEach(j => { son[j.no] = (son[j.no] || 0) + 1; });
  const tan = R.filter(r => String(r[0] || '') && /^(Faol|Kelishuv)$/.test(String(r[14] || ''))).map(r => ({ id: String(r[0]), no: String(r[1]), n: son[String(r[1])] || 0 })).sort((a, b) => b.n - a.n)[0];
  if (!tan) { console.log('  (faol yurist ishi yo\'q)'); xH++; }
  else {
    console.log('Ish ID ' + tan.id + ' (' + tan.no + ', jurnalda ' + tan.n + ' qayd). Eski tizim 8 ta faylni yasayapti (har biri ~30 s, 4 tadan parallel)…');
    const M = await YM.yhYig(tan.id), ism = await YM.yhXodim(adm.fish);
    const ROY = [['yhMalumotnoma', 'pdf'], ['yhMalumotnoma', 'doc'], ['yhBayonnoma', 'pdf'], ['yhBayonnoma', 'doc'], ['yhBayonnoma', 'xlsx'], ['yhPenya', 'pdf'], ['yhPenya', 'doc'], ['yhPenya', 'xlsx']];
    const eski = {}; let i = 0;
    await Promise.all([0, 1, 2, 3].map(async () => { while (i < ROY.length) { const [fn, fmt] = ROY[i++]; try { eski[fn + fmt] = await koprik.chaqir(fn, adm.kirish_kodi, [tan.id, fmt]); } catch (e) { eski[fn + fmt] = { xato: e.message }; } } }));
    for (const [fn, fmt] of ROY) {
      const nom = fn + ' ' + fmt.toUpperCase(), e = eski[fn + fmt];
      if (!e || e.xato) { console.log('  ⚠ ' + nom + ': eski tizim — ' + (e ? e.xato : 'javob yo\'q')); xH++; continue; }
      const t0 = Date.now(), y = await YHA.yasa(fn, M, ism, fmt), ms = Date.now() - t0;
      const eb = Buffer.from(e.b64, 'base64'), yb = Buffer.from(y.b64, 'base64');
      if (e.nom !== y.nom) { console.log('  ✖ ' + nom + ': fayl nomi — eski «' + e.nom + '», server «' + y.nom + '»'); xH++; }
      console.log('— ' + nom + ' (server ' + ms + ' ms)');
      if (fmt === 'pdf') xH += pdfSolishtir(eb, yb);
      else xH += await zipQismlar(nom, eb, yb, fmt === 'xlsx');
    }
  }
  if (!xH) { await redis.set('yozuv_yondi:yurist_hujjat', '1'); console.log('\n✅ HUJJATLAR BIR XIL — ma\'lumotnoma, bayonnoma va penya hisobi (PDF, Word, Excel) endi serverda yasaladi.'); }
  else console.log('\n⚠ Hujjatlarda ' + xH + ' ta farq — YOQILMADI (eski tizimda qoladi).');

  console.log('\n=== ✉ ALOQA XATI (06g_Yuridik_xatlar, 06f_Yurist_tarix) ===');
  const M2 = await G.varaqlar(ID, KEY); const ochir = [];
  const nusxala = async varaq => { const src = M2.varaqlar.find(v => v.title === varaq); if (!src) throw new Error('Varaq topilmadi: ' + varaq);
    const j = await G.soralar(ID, [{ duplicateSheet: { sourceSheetId: src.sheetId, insertSheetIndex: M2.varaqlar.length + ochir.length, newSheetName: 'zz_sinov_' + varaq } }], KEY);
    ochir.push(j.replies[0].duplicateSheet.properties.sheetId); await G.gid(ID, 'zz_sinov_' + varaq, KEY, true); return 'zz_sinov_' + varaq; };
  const Jx = await YA.yuxYangi();
  const ey = [...Jx].reverse().find(h => /^YU-\d{4}\/\d{4}$/.test(h.raqam) && h.pdf && !/^SRV:/.test(h.pdf) && h.doc && !/^SRV:/.test(h.doc));
  if (!ey) { console.log('  (eski tizim yasagan aloqa xati topilmadi)'); xA++; }
  else {
    try {
      const n6 = await nusxala(YA.YUX_V);
      const ishM = (await J.yuIshlar()).find(z => String(z.id) === String(ey.ishId));   // serverdagidek: M.ish.id (ko'zgudan)
      const row = await YA.qatorYoz(n6, [ey.raqam.replace(/\d{4}$/, '9999'), ey.sana, ishM ? ishM.id : ey.ishId, ey.no, ey.fish, 'ALOQA_SSP', YH.YH_PALATA.join(', '), 'Tayyorlandi',
        'SRV:yurist/sinov/sinov.pdf', 'SRV:yurist/sinov/sinov.docx', '', '', '', '', 'SINOV', ey.vaqt || '19.10.2026 04:00:00', '']);
      xA += await qatorSolishtir(n6, row, 1, 17, '— Aloqa xati qatori (A–Q)', ey.qator, (i, fa, fb) => i === 8 || i === 9 ? 'PDF/Doc ID — eski: Drive ID, server: «SRV:…» (Drive\'ga ko\'chguncha)' : '');
      const nt = await nusxala(YSO.TAR_V), A6 = await G.ustunOqi(ID, nt, 'A', KEY);
      await YSO.tarixYoz(nt, ishM || { id: ey.ishId, no: ey.no }, 'Алоқа хати тайёрланди: SINOV', 'SINOV', 'Алоқа хати (ССП)', 'SINOV.pdf');
      xA += await qatorSolishtir(nt, A6.length + 1, 1, 7, '— Tarix qatori (A–G)');
    } finally {
      if (ochir.length) await G.soralar(ID, ochir.map(g => ({ deleteSheet: { sheetId: g } })), KEY).catch(e => console.log('Nusxani o\'chirib bo\'lmadi: ' + e.message));
      console.log('Nusxa varaqlar o\'chirildi.');
    }
    // eski tizim yasagan xat (Drive) — server o'sha matndan qayta yasaydi
    console.log('— Eski xat ' + ey.raqam + ' (' + ey.no + ') ni server qayta yasaydi');
    try {
      const ePdf = (await G.driveFayl(ey.pdf, KEY)).bytes, eDoc = await G.driveEksport(ey.doc, DOCX, KEY);
      const d = XL.zipOqi(eDoc)['word/document.xml'].toString('utf8');
      const P = (d.match(/<w:p [^>]*>[\s\S]*?<\/w:p>/g) || []).map(p => (p.match(/<w:t(?: [^>]*)?>[^<]*<\/w:t>/g) || []).map(t => t.replace(/<[^>]+>/g, '')).join('')
        .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&amp;/g, '&'));
      const i0 = P.findIndex(t => /^№ YU-/.test(t)), i1 = P.findIndex(t => /^Директор/.test(t)), ijT = P.find(t => /^Ижрочи:/.test(t)) || '';
      const body = P.slice(i0 + 1, i1).filter((t, k, a) => true);
      const blok = YH.aloqaJoyla({ X: body.slice(9, 14), il: body.slice(15).map(t => t.replace(/^\d+\. /, '')) });
      const ij = { ism: (/^Ижрочи: (.*), тел\.: /.exec(ijT) || [])[1] || '', tel: (/тел\.: (.*)$/.exec(ijT) || [])[1] || '' };
      const sanaIso = ey.sana.split('.').reverse().join('-');
      const ok = JSON.stringify(blok.filter(b => b.t === 'p').map(b => b.x)) === JSON.stringify(body);
      if (!ok) { console.log('  ✖ eski xat tuzilishi kutilganidek emas (' + body.length + ' xatboshi)'); xA++; }
      else {
        const f = await XP.blankaYasa(blok, { '{{Ундирувчи}}': ij.ism, '{{Ундирувчи_тел}}': ij.tel }, ey.raqam, sanaIso, false);
        console.log('  PDF (o\'lcham ' + Math.round(f.k * 100) + '%):'); xA += pdfSolishtir(ePdf, f.pdf);
        xA += await zipQismlar('Word', eDoc, BW.bloklarDocx(blok, ey.raqam, sanaIso, ij, f.k), false);
      }
    } catch (e) { console.log('  ⚠ eski xatni o\'qib bo\'lmadi: ' + e.message); xA++; }
  }
  console.log('\n=== ☁ DRIVE (Koprik v1.11: Word fayli «06 XATLAR» ga) ===');
  if (!k111) { console.log('  ⏭ Koprik 1.11 emas — o\'tkazildi'); }
  else {
    try {
      const S = YS.namunalar().kichik, a = await YH.aloqaYasa(S, 'YU-2026/9001', { ism: 'Синовчи', tel: '+998 90 000 00 00' });
      const doc = BW.bloklarDocx(a.bloklar, 'YU-2026/9001', S.bugun, { ism: 'Синовчи', tel: '+998 90 000 00 00' }, a.k), nom = 'SINOV_' + Date.now().toString(36) + '_Aloqa_xati_TESTOV.docx';
      const r = await koprik.chaqir('koprikXatSaqla', adm.kirish_kodi, [{ yil: V.bugun().slice(0, 4), nom, b64: doc.toString('base64') }]);
      if (!r || !r.id) { console.log('  ⚠ Drive ID qaytmadi'); xA++; }
      else {
        const dd = await G.driveFayl(r.id, KEY); const ok = dd.bytes.length === doc.length;
        console.log('  Word Drive\'ga qo\'yildi, robot o\'qiy oladi: ' + (ok ? '✅ (' + dd.bytes.length + ' bayt, ' + dd.mime + ')' : '⚠ hajm farq qiladi')); if (!ok) xA++;
        await koprik.chaqir('koprikXatSaqla', adm.kirish_kodi, [{ eski: r.id }]); console.log('  SINOV fayl savatga tashlandi ✅');
      }
    } catch (e) { console.log('  ⚠ Drive: ' + e.message); xA++; }
  }
  if (!xA && k111) { await redis.set('yozuv_yondi:yurist_aloqa', '1'); console.log('\n✅ ALOQA XATI BIR XIL — «Алоқа хати» tayyorlash, yuborildi va bekor qilish endi serverda (PDF va Word darhol, Drive\'ga — fonda).'); }
  else console.log('\n⚠ Aloqa xati: ' + (xA ? xA + ' ta farq' : 'Koprik 1.11 emas') + ' — YOQILMADI (eski tizimda qoladi).');
  console.log('Qaytarish kerak bo\'lsa: aks-yozuv-sinov ochir');
}
async function yuristIshSinov() {
  const YS = require('../api/yurist_sorov')._ichki, TP = require('../api/topshiriq_yoz')._ichki;
  const M = await G.varaqlar(ID, KEY);
  const ochir = []; let x = 0;
  const nusxala = async varaq => { const src = M.varaqlar.find(v => v.title === varaq); if (!src) throw new Error('Varaq topilmadi: ' + varaq);
    const j = await G.soralar(ID, [{ duplicateSheet: { sourceSheetId: src.sheetId, insertSheetIndex: M.varaqlar.length + ochir.length, newSheetName: 'zz_sinov_' + varaq } }], KEY);
    ochir.push(j.replies[0].duplicateSheet.properties.sheetId); await G.gid(ID, 'zz_sinov_' + varaq, KEY, true); return 'zz_sinov_' + varaq; };
  try {
    console.log('\n=== ⚖ TO\'G\'RIDAN-TO\'G\'RI YURISTGA (06b_Yuridik_ishlar, «Faol») ===');
    const R = await G.oraliqOqi(ID, YS.YU_V, 'A2:AG', KEY);
    let ei = -1; R.forEach((r, k) => { if (String(r[25] || '') === 'Togridan') ei = k; });
    if (ei < 0) R.forEach((r, k) => { if (String(r[14] || '') === 'Faol' && String(r[2] || '') && String(r[29] || '')) ei = k; });
    if (ei < 0) { console.log('  (eski tizim yozgan faol ish topilmadi)'); x++; }
    else {
      const n = await nusxala(YS.YU_V), er = R[ei];
      const t0 = Date.now();
      const i = await YS.yuYangi(n, { no: String(er[1] || '27/1'), undiruvchi: String(er[26] || 'SINOV') }, 'Faol', 'Togridan', 'SINOV', 'SINOV — nusxa varaq, o\'chiriladi (to\'g\'ridan-to\'g\'ri)');
      await G.yoz(ID, [{ varaq: n, katak: 'AD' + i.qator, qiymat: [['SINOV, 19.10.2026 03:00']] }], KEY);
      console.log('Yozish: ' + (Date.now() - t0) + ' ms · qator ' + i.qator + ' · eski tizim yozgan qator ' + (ei + 2) + ' (' + (er[14] || '') + ', ' + (er[25] || '') + ')');
      x += await qatorSolishtir(n, i.qator, 1, 33, '— Ish qatori (A–AG)', ei + 2);
    }
    console.log('\n=== 📌 YURIST → UNDIRUVCHIGA TOPSHIRIQ (10_Topshiriqlar) ===');
    const nt = await nusxala(TP.TOP_V);
    const Rt = await TP.topRowsYangi(nt);
    const ey = [...Rt.L].reverse().find(t => /^yutop\|/.test(t.kalit)) || Rt.L[Rt.L.length - 1];
    const row = await TP.topYoz(nt, { manba: 'Yurist', qoida: 'yutop', kalit: 'yutop|27/0|PASPORT|0', sarlavha: '⚖ Yurist: SINOV', izoh: 'SINOV — nusxa varaq', no: '27/0', mid: '', kimga: 'SINOV', kimBerdi: 'SINOV',
      muddat: '25.10.2026 18:00', muhim: 'Shoshilinch' }, Rt);
    x += await qatorSolishtir(nt, row.qator, 1, 22, '— Topshiriq qatori (A–V)', ey ? ey.qator : undefined);
  } finally {
    if (ochir.length) await G.soralar(ID, ochir.map(g => ({ deleteSheet: { sheetId: g } })), KEY).catch(e => console.log('Nusxani o\'chirib bo\'lmadi: ' + e.message));
    console.log('\nNusxa varaqlar o\'chirildi.');
  }
  console.log('');
  if (!x) { await redis.set('yozuv_yondi:yurist_ish', '1'); console.log('✅ HAMMASI BIR XIL — ⚖ ishni to\'g\'ridan-to\'g\'ri yuristga o\'tkazish va yuristning topshirig\'i endi server orqali. Qaytarish kerak bo\'lsa: aks-yozuv-sinov ochir'); }
  else console.log('⚠ ' + x + ' ta farq — YOQILMADI (eski tizim orqali ishlayveradi).');
}
async function yuristSorovSinov() {
  const YS = require('../api/yurist_sorov')._ichki;
  const M = await G.varaqlar(ID, KEY);
  const ochir = []; let x = 0;
  const nusxala = async varaq => { const src = M.varaqlar.find(v => v.title === varaq); if (!src) throw new Error('Varaq topilmadi: ' + varaq);
    const j = await G.soralar(ID, [{ duplicateSheet: { sourceSheetId: src.sheetId, insertSheetIndex: M.varaqlar.length + ochir.length, newSheetName: 'zz_sinov_' + varaq } }], KEY);
    ochir.push(j.replies[0].duplicateSheet.properties.sheetId); await G.gid(ID, 'zz_sinov_' + varaq, KEY, true); return 'zz_sinov_' + varaq; };
  try {
    console.log('\n=== ⚖ YURISTGA O\'TKAZISH SO\'ROVI (06b_Yuridik_ishlar) ===');
    const R = await G.oraliqOqi(ID, YS.YU_V, 'A2:AG', KEY);
    let ei = -1; R.forEach((r, k) => { if (String(r[25] || '') === 'U4') ei = k; }); if (ei < 0) R.forEach((r, k) => { if (String(r[0] || '')) ei = k; });
    const n = await nusxala(YS.YU_V);
    const er = R[ei] || [];
    const t0 = Date.now();
    const i = await YS.yuYangi(n, { no: String(er[1] || '27/1'), undiruvchi: String(er[26] || 'SINOV') }, 'Tasdiq kutilmoqda', 'U4', 'SINOV', 'SINOV — nusxa varaq, o\'chiriladi (yuristga o\'tkazish sababi)');
    console.log('Yozish: ' + (Date.now() - t0) + ' ms · ID ' + i.id + ', qator ' + i.qator + ' · eski tizim yozgan qator ' + (ei + 2) + ' (' + (er[14] || '') + ', ' + (er[25] || '') + ')');
    x += await qatorSolishtir(n, i.qator, 1, 33, '— Ish qatori (A–AG)', ei + 2);
    console.log('\n=== 📒 YURIST TARIXI (06f_Yurist_tarix) ===');
    const nt = await nusxala(YS.TAR_V);
    const A = await G.ustunOqi(ID, nt, 'A', KEY);
    await YS.tarixYoz(nt, i, 'Undiruvchi yuristga o\'tkazishni so\'radi', 'SINOV', 'SINOV — nusxa varaq', '');
    x += await qatorSolishtir(nt, A.length + 1, 1, 7, '— Tarix qatori (A–G)');
  } finally {
    if (ochir.length) await G.soralar(ID, ochir.map(g => ({ deleteSheet: { sheetId: g } })), KEY).catch(e => console.log('Nusxani o\'chirib bo\'lmadi: ' + e.message));
    console.log('\nNusxa varaqlar o\'chirildi.');
  }
  console.log('');
  if (!x) { await redis.set('yozuv_yondi:yurist_sorov', '1'); console.log('✅ HAMMASI BIR XIL — ⚖ «Yuristga o\'tkazish» so\'rovi endi server orqali. Qaytarish kerak bo\'lsa: aks-yozuv-sinov ochir'); }
  else console.log('⚠ ' + x + ' ta farq — YOQILMADI (eski tizim orqali ishlayveradi).');
}

// ✉ XAT CHIQARISH: 06e nusxasida server yo'li bilan yangi xat qatori (eski tizim chiqargan oxirgi xat qatori bilan solishtiriladi), xat PDF (soxta
// ma'lumotli 8 xat — har so'z joyi), Drive: Koprik v1.8 koprikXatSaqla → «AKS TIZIM / 06 XATLAR / <yil>» ga SINOV fayl, robot o'qiy oladimi, keyin savatga
async function xatChiqarSinov() {
  const XC = require('../api/xat_chiqar')._ichki, XI = require('../api/xat_isbot')._ichki, XS = require('../lib/xat_sinov'), XP = require('../lib/xat_pdf'), P = require('../lib/portfel');
  const adm = (await pool.query('SELECT kirish_kodi, huquqlar FROM v_xodimlar WHERE kompaniya_id = 1')).rows.find(z => (z.huquqlar || []).includes('admin') && String(z.kirish_kodi || '').length >= 8);
  let ver = '?'; try { ver = String(await koprik.chaqir('koprikVersiya', adm.kirish_kodi, [])); } catch (e) { ver = 'xato: ' + e.message; }
  const k18 = !/^xato/.test(ver) && XC.verOk(ver, '1.8');
  console.log('Eski tizim ko\'prigi: v' + ver + (k18 ? ' ✅' : ' ⚠ (1.8 kerak — Koprik.gs ni yangilang)'));
  const M = await G.varaqlar(ID, KEY);
  const ochir = []; let x = 0;
  const nusxala = async varaq => { const src = M.varaqlar.find(v => v.title === varaq); if (!src) throw new Error('Varaq topilmadi: ' + varaq);
    const j = await G.soralar(ID, [{ duplicateSheet: { sourceSheetId: src.sheetId, insertSheetIndex: M.varaqlar.length + ochir.length, newSheetName: 'zz_sinov_' + varaq } }], KEY);
    ochir.push(j.replies[0].duplicateSheet.properties.sheetId); await G.gid(ID, 'zz_sinov_' + varaq, KEY, true); return 'zz_sinov_' + varaq; };
  try {
    console.log('\n=== ✉ YANGI XAT QATORI (06e_Xatlar) ===');
    const XJ = await XI.xatlarYangi(XI.XAT_V);
    const ey = [...XJ].reverse().find(h => /^OG-\d{4}\/\d{4}$/.test(h.raqam) && /^[A-Za-z0-9_-]{20,}$/.test(h.pdf) && /Tayyorlandi|Yuborildi/.test(h.holati));
    const sh = ey && (await P.xatShartnomalar(V.bugun())).find(z => z.no === ey.no);
    if (!ey || !sh) { console.log('  (eski tizim chiqargan xat topilmadi)'); x++; }
    else {
      const n6 = await nusxala(XI.XAT_V);
      const v = (await G.oraliqOqi(ID, XI.XAT_V, 'I' + ey.qator + ':L' + ey.qator, KEY, 'UNFORMATTED_VALUE'))[0] || [];
      const t0 = Date.now();
      const r = await XC.qatorYoz(n6, [ey.raqam.replace(/\d{4}$/, '9999'), ey.sana, ey.no, sh.mid, sh.fish, sh.dokon, ey.shablon, ey.bosqich, Number(v[0]) || 0, Number(v[1]) || 0, Number(v[2]) || 0, Number(v[3]) || 0,
        ey.muddat, 'Tayyorlandi', 'SRV:xat/sinov/sinov.pdf', '', '', '', '', 'SINOV', ey.vaqt || '19.10.2026 01:00:00', '', '']);
      console.log('Yozish: ' + (Date.now() - t0) + ' ms · nusxada qator ' + r + ', eski tizim yozgan qator ' + ey.qator + ' (' + ey.raqam + ')');
      x += await qatorSolishtir(n6, r, 1, 23, '— Xat qatori (A–W)', ey.qator, (i, fa, fb) => i === 14 ? 'PDF_fayl_ID — eski: Drive ID, server: «SRV:…» (Drive\'ga ko\'chguncha)' : '');
    }
  } finally {
    if (ochir.length) await G.soralar(ID, ochir.map(g => ({ deleteSheet: { sheetId: g } })), KEY).catch(e => console.log('Nusxani o\'chirib bo\'lmadi: ' + e.message));
    console.log('\nNusxa varaq o\'chirildi.');
  }
  console.log('\n=== 📄 XAT PDF (soxta ma\'lumotli 8 xat — eski Google Docs xati bilan bir xil joylashuv) ===');
  if (!(await PDF.bor())) { console.log('  ⏳ PDF dasturi (Chromium) hali tayyor emas'); x++; }
  else { const r = await XS.tekshir(); r.chiqish.forEach(z => console.log('  ' + z)); x += r.farq; }
  console.log('\n=== ☁ DRIVE (Koprik v1.8: «AKS TIZIM / 06 XATLAR / ' + V.bugun().slice(0, 4) + '») ===');
  if (!k18) { console.log('  ⏭ Koprik 1.8 emas — o\'tkazildi'); }
  else {
    try {
      const n = XS.NAMUNALAR.eski_tayyor_1, f = await XP.xatChiqar(n.x, n.b, n.raqam, n.sana, n.muddat, n.Q, n.oldin, { ism: 'Синовчи Ходим', tel: '+998 90 000 00 00' }, null);
      const nom = 'SINOV_' + Date.now().toString(36) + '.pdf', t0 = Date.now();
      const r = await koprik.chaqir('koprikXatSaqla', adm.kirish_kodi, [{ yil: V.bugun().slice(0, 4), nom, b64: f.pdf.toString('base64') }]);
      console.log('  Drive\'ga qo\'yildi: ' + (Date.now() - t0) + ' ms · ' + (r && r.id ? 'ID bor ✅' : 'ID YO\'Q ⚠') + ' · ' + (r && r.url ? 'havola bor ✅' : 'havola YO\'Q ⚠'));
      if (!r || !r.id || !r.url) x++;
      else {
        try { const d = await G.driveFayl(r.id, KEY); const ok = d.bytes.length === f.pdf.length; console.log('  Robot o\'qiy oladi: ' + (ok ? '✅ (' + d.bytes.length + ' bayt)' : '⚠ hajm farq qiladi')); if (!ok) x++; }
        catch (e) { console.log('  ⚠ Robot o\'qiy olmadi: ' + e.message); x++; }
        await koprik.chaqir('koprikXatSaqla', adm.kirish_kodi, [{ eski: r.id }]);
        console.log('  SINOV fayl savatga tashlandi ✅');
      }
    } catch (e) { console.log('  ⚠ Drive: ' + e.message); x++; }
  }
  console.log('');
  if (!x && k18) { await redis.set('yozuv_yondi:xat_chiqar', '1'); console.log('✅ HAMMASI BIR XIL — ✉ ogohlantirish xati, talabnoma va maydon farqi xatlari endi serverda chiqariladi\n   (PDF darhol, Drive\'ga nusxa — fonda). Qaytarish kerak bo\'lsa: aks-yozuv-sinov ochir'); }
  else console.log('⚠ ' + (x ? x + ' ta farq' : 'Koprik 1.8 emas') + ' — YOQILMADI (eski tizim orqali ishlayveradi).');
}

// ✂ SHARTNOMANI BEKOR QILISH: 06h qatori nusxada (eski tizim yozgan oxirgi qator bilan), buyruq/xabarnoma PDF (soxta ma'lumot), Drive + Word nusxasi (Koprik v1.9)
async function bekorSinov() {
  const BY = require('../api/bekor_yoz')._ichki, XC = require('../api/xat_chiqar')._ichki, BS = require('../lib/bekor_sinov'), BH = require('../lib/bekor_hujjat');
  const adm = (await pool.query('SELECT kirish_kodi, huquqlar FROM v_xodimlar WHERE kompaniya_id = 1')).rows.find(z => (z.huquqlar || []).includes('admin') && String(z.kirish_kodi || '').length >= 8);
  let ver = '?'; try { ver = String(await koprik.chaqir('koprikVersiya', adm.kirish_kodi, [])); } catch (e) { ver = 'xato: ' + e.message; }
  const k19 = !/^xato/.test(ver) && XC.verOk(ver, '1.9'), k110 = k19 && XC.verOk(ver, '1.10');
  console.log('Eski tizim ko\'prigi: v' + ver + (k19 ? ' ✅' + (k110 ? '' : ' (Word Drive\'ga v1.10 dan — hozircha Google Doc eski tizimda yasaladi)') : ' ⚠ (1.9 kerak — Koprik.gs ni yangilang)'));
  const M = await G.varaqlar(ID, KEY);
  const ochir = []; let x = 0;
  const nusxala = async varaq => { const src = M.varaqlar.find(v => v.title === varaq); if (!src) throw new Error('Varaq topilmadi: ' + varaq);
    const j = await G.soralar(ID, [{ duplicateSheet: { sourceSheetId: src.sheetId, insertSheetIndex: M.varaqlar.length + ochir.length, newSheetName: 'zz_sinov_' + varaq } }], KEY);
    ochir.push(j.replies[0].duplicateSheet.properties.sheetId); await G.gid(ID, 'zz_sinov_' + varaq, KEY, true); return 'zz_sinov_' + varaq; };
  try {
    console.log('\n=== ✂ YANGI BEKOR SO\'ROVI QATORI (06h_Bekor_sorovlari) ===');
    const BJ = await BY.bekorJurnalYangi();
    const ey = [...BJ].reverse().find(z => /^BQ-\d{4}\/\d{4}$/.test(z.raqam) && /^[A-Za-z0-9_-]{20,}$/.test(z.bPdf));
    if (!ey) { console.log('  (eski tizim kiritgan so\'rov topilmadi)'); x++; }
    else {
      const n6 = await nusxala('06h_Bekor_sorovlari');
      const v = (await G.oraliqOqi(ID, '06h_Bekor_sorovlari', 'K' + ey.qator + ':N' + ey.qator, KEY, 'UNFORMATTED_VALUE'))[0] || [];
      const A = await G.ustunOqi(ID, n6, 'A', KEY), t0 = Date.now();
      await BY.qatorYoz(n6, A.length + 1, [9999, ey.no, ey.tur, ey.fish, ey.dokon, 'SINOV — nusxa varaq, o\'chiriladi', 'Hujjatlar tayyorlandi', ey.raqam.replace(/\d{4}$/, '9999'), ey.sana, ey.shablon,
        Number(v[0]) || 0, Number(v[1]) || 0, Number(v[2]) || 0, Number(v[3]) || 0, 'SRV:bekor/sinov/b.pdf', '', 'SRV:bekor/sinov/x.pdf', '', '', '', '', '', '', ey.xatOgoh ? 'Ha' : '', 'SINOV',
        ey.vaqt || '19.10.2026 01:00:00', '', '', '', '', (ey.xRaqam || 'BX-2026/0001').replace(/\d{4}$/, '9999')]);
      console.log('Yozish: ' + (Date.now() - t0) + ' ms · nusxada qator ' + (A.length + 1) + ', eski tizim yozgan qator ' + ey.qator + ' (' + ey.raqam + ')');
      x += await qatorSolishtir(n6, A.length + 1, 1, 31, '— Bekor so\'rovi qatori (A–AE)', ey.qator,
        i => i >= 14 && i <= 17 ? 'fayl ustuni — eski: Drive ID, server: «SRV:…» / bo\'sh (Drive\'ga ko\'chguncha)' : '');
    }
  } finally {
    if (ochir.length) await G.soralar(ID, ochir.map(g => ({ deleteSheet: { sheetId: g } })), KEY).catch(e => console.log('Nusxani o\'chirib bo\'lmadi: ' + e.message));
    console.log('\nNusxa varaq o\'chirildi.');
  }
  console.log('\n=== 📄 BUYRUQ VA XABARNOMA PDF (soxta ma\'lumotli 7 holat — eski Google Docs bilan bir xil joylashuv) ===');
  if (!(await PDF.bor())) { console.log('  ⏳ PDF dasturi (Chromium) hali tayyor emas'); x++; }
  else { const r = await BS.tekshir(); r.chiqish.forEach(z => console.log('  ' + z)); x += r.farq; }
  console.log('\n=== 📝 WORD NUSXASI (serverda yasaladi — 7 holat) ===');
  { const BW = require('../lib/bekor_word'), { zipOqi } = require('../lib/xlsx'); let w = 0;
    for (const [nom, n] of Object.entries(BS.NAMUNALAR)) {
      try { const P = BH.bekorPul(n.x);
        const b = BW.buyruqDocx(BH.buyruqMatn(n.x, n.X, P, n.raqam, n.sana), n.raqam, n.sana, 1), h = BW.xabarnomaDocx(n.x, BH.xabarnomaMatn(n.x, n.X, P, n.raqam, n.sana), n.xRaqam, n.sana, BS.IJ, 1);
        const db = zipOqi(b)['word/document.xml'].toString(), dh = zipOqi(h)['word/document.xml'].toString();
        if (db.indexOf(n.raqam + '-сон') < 0 || dh.indexOf('№ ' + n.xRaqam) < 0 || dh.indexOf('ТЎҒРИСИДА ХАБАРНОМА') < 0) throw new Error('matn topilmadi');
        w++; } catch (e) { console.log('  ⚠ ' + nom + ': ' + e.message); x++; } }
    console.log('  ' + w + ' / ' + Object.keys(BS.NAMUNALAR).length + ' holatda buyruq va xabarnoma Word fayli yasaldi ' + (w === Object.keys(BS.NAMUNALAR).length ? '✅' : '⚠')); }
  console.log('\n=== ☁ DRIVE + WORD NUSXASI (Koprik v' + ver + ': «AKS TIZIM / 07 BEKOR QILISH / ' + V.bugun().slice(0, 4) + '») ===');
  if (!k19) { console.log('  ⏭ Koprik 1.9 emas — o\'tkazildi'); }
  else {
    try {
      const n = BS.NAMUNALAR.yangi_tayyor, P = BH.bekorPul(n.x), sana = V.bugun();
      const b = await BH.buyruqYasa(n.x, n.X, P, n.raqam, sana), h = await BH.xabarnomaYasa(n.x, n.X, P, n.raqam, n.xRaqam, sana, BS.IJ);
      const belgi = 'SINOV_' + Date.now().toString(36), t0 = Date.now();
      const BW = require('../lib/bekor_word'), bd = BW.buyruqDocx(b.matn, n.raqam, sana, b.k), xd = BW.xabarnomaDocx(n.x, h.matn, n.xRaqam, sana, BS.IJ, h.k);
      const r = await koprik.chaqir('koprikBekorSaqla', adm.kirish_kodi, [Object.assign({ yil: sana.slice(0, 4), bNom: 'Bekor_buyruq_' + belgi, xNom: 'Bekor_xabarnoma_' + belgi, bB64: b.pdf.toString('base64'), xB64: h.pdf.toString('base64'),
        x: n.x, X: n.X, P, raqam: n.raqam, xRaqam: n.xRaqam, sana, fish: 'SINOV', eski: [] }, k110 ? { bDocB64: bd.toString('base64'), xDocB64: xd.toString('base64') } : {})]);
      const ok = r && r.bPdf && r.bDoc && r.xPdf && r.xDoc;
      console.log('  Drive\'ga qo\'yildi va Word nusxasi yasaldi: ' + Math.round((Date.now() - t0) / 1000) + ' s · ' + (ok ? '4 ta fayl ✅' : 'fayllar to\'liq emas ⚠ ' + JSON.stringify(r)));
      if (!ok) x++;
      if (r && r.bPdf) {
        try { const d = await G.driveFayl(r.bPdf, KEY); const t = d.bytes.length === b.pdf.length; console.log('  Robot PDF ni o\'qiy oladi: ' + (t ? '✅ (' + d.bytes.length + ' bayt)' : '⚠ hajm farq qiladi')); if (!t) x++; }
        catch (e) { console.log('  ⚠ Robot o\'qiy olmadi: ' + e.message); x++; }
        if (k110 && r.xDoc) {
          try { const d = await G.driveFayl(r.xDoc, KEY); const t = d.bytes.length === xd.length; console.log('  Word fayli Drive\'da (server yasagani): ' + (t ? '✅ (' + d.bytes.length + ' bayt)' : '⚠ hajm farq qiladi')); if (!t) x++; }
          catch (e) { console.log('  ⚠ Word faylini o\'qib bo\'lmadi: ' + e.message); x++; }
        }
      }
      if (r) { await koprik.chaqir('koprikBekorSaqla', adm.kirish_kodi, [{ eski: [r.bPdf, r.bDoc, r.xPdf, r.xDoc].filter(Boolean) }]); console.log('  SINOV fayllar savatga tashlandi ✅'); }
    } catch (e) { console.log('  ⚠ Drive: ' + e.message); x++; }
  }
  console.log('');
  if (!x && k19) { await redis.set('yozuv_yondi:bekor', '1'); await redis.set('yozuv_yondi:bekor_word', '1'); console.log('✅ HAMMASI BIR XIL — ✂ shartnomani bekor qilish so\'rovi, buyruq va xabarnoma, ularning skanlari endi serverda\n   (PDF va Word darhol, Drive\'ga nusxa — fonda). Direktor tasdig\'i hozircha eski tizimda. Qaytarish kerak bo\'lsa: aks-yozuv-sinov ochir'); }
  else console.log('⚠ ' + (x ? x + ' ta farq' : 'Koprik 1.9 emas') + ' — YOQILMADI (eski tizim orqali ishlayveradi).');
}

// 🔁 QAYTA TUZISH (Qayta.gs): (1) o'qishlar — har loyiha (qaytaOchiq) va 3 ta shartnoma (qaytaKor) eski tizim javobi bilan solishtiriladi;
// (2) 06k nusxasida server yo'li bilan C/AA/AE va skan ustuni yoziladi — eski tizim yozgan kataklar bilan solishtiriladi. Hammasi bir xil → yozuv_yondi:qayta
async function qaytaSinov() {
  const QT = require('../api/qayta'), S = require('../api/sessiya');
  console.log('\n=== QAYTA TUZISH (06k_Qayta_tuzish) ===');
  const adm = (await pool.query('SELECT kirish_kodi, huquqlar FROM v_xodimlar WHERE kompaniya_id = 1')).rows.find(x => (x.huquqlar || []).includes('admin') && String(x.kirish_kodi || '').length >= 8);
  let ver = '?';
  try { ver = String(await koprik.chaqir('koprikVersiya', adm.kirish_kodi, [])); } catch (e) { ver = 'xato: ' + e.message; }
  const k16 = verOk(ver, '1.6') && !/^xato/.test(ver);
  console.log('Eski tizim ko\'prigi: v' + ver + (k16 ? ' ✅' : ' ⚠ (1.6 kerak)'));
  const kod = adm.kirish_kodi, tok = await S.sessiyaOch(kod);
  await redis.set('yozuv_yondi:qayta', '1');   // solishtirish paytida server yo'li ishlasin (bayroqsiz qaytaOchiq/qaytaKor eski tizimga boradi); farq bo'lsa — oxirida o'chiriladi
  const toza = v => JSON.parse(JSON.stringify(v, (k, x) => x === null || x === undefined ? '' : x));
  const farq = (a, b, yol, o) => { if (o.length > 30) return; const bo = v => v === '' || v === null || v === undefined;
    if (bo(a) && bo(b)) return; if (typeof a !== typeof b) { if (String(a) !== String(b)) o.push(yol + ': ' + JSON.stringify(a).slice(0, 60) + ' ←→ ' + JSON.stringify(b).slice(0, 60)); return; }
    if (a && typeof a === 'object') { if (Array.isArray(a) && a.length !== b.length) o.push(yol + '.length: ' + a.length + ' ←→ ' + b.length); for (const k of new Set([...Object.keys(a), ...Object.keys(b || {})])) farq(a[k], (b || {})[k], yol + '.' + k, o); return; }
    if (typeof a === 'number' && Math.abs(a - b) < 0.5) return; if (a !== b) o.push(yol + ': ' + JSON.stringify(a).slice(0, 60) + ' ←→ ' + JSON.stringify(b).slice(0, 60)); };
  let x = 0;
  const ikki = async (fn, args) => {
    let a, b; const t0 = Date.now();
    try { a = await QT[fn]([kod + '|' + tok, ...args]); } catch (e) { a = { xato: e.message }; } const t1 = Date.now();
    try { b = await koprik.chaqir(fn, kod, args); } catch (e) { b = { xato: e.message }; } const t2 = Date.now();
    const o = []; farq(toza(a), toza(b), fn, o);
    console.log('- ' + fn + ' ' + args.join(' ') + ': server ' + (t1 - t0) + ' ms · eski ' + (t2 - t1) + ' ms — ' + (o.length ? '⚠ ' + o.length + ' farq' : '✅ bir xil') + (a && a.xato ? ' (' + a.xato.slice(0, 60) + ')' : ''));
    o.slice(0, 8).forEach(z => console.log('    ' + z)); if (o.length) x++;
  };
  const rows = await QT._ichki.qtRows();
  const ids = rows.slice(-5).map(z => z.id);
  if (!ids.length) console.log('(06k da loyiha yo\'q — qaytaOchiq solishtirilmadi)');
  for (const id of ids) await ikki('qaytaOchiq', [id]);
  const nolar = (await V.qatorlar('03_Sotuv_shartnomalar')).map(z => String(z.x[0] == null ? '' : z.x[0]).trim()).filter(n => /^27\/\d+$/.test(n)).slice(-3);
  for (const no of nolar.concat(rows.slice(-1).map(z => z.eski))) await ikki('qaytaKor', [no]);
  await redis.del('ses:' + tok);
  // (2) nusxa varaqda yozuv
  const varaq = QT._ichki.QT_VARAQ;
  const M = await G.varaqlar(ID, KEY);
  const src = M.varaqlar.find(v => v.title === varaq);
  if (!src || !rows.length) console.log('(06k varag\'i yoki qatori yo\'q — yozuv solishtirilmadi)');
  else {
    const nusxa = 'zz_sinov_06k';
    const j = await G.soralar(ID, [{ duplicateSheet: { sourceSheetId: src.sheetId, insertSheetIndex: M.varaqlar.length, newSheetName: nusxa } }], KEY);
    const ng = j.replies[0].duplicateSheet.properties.sheetId;
    try {
      await G.gid(ID, nusxa, KEY, true);
      const oxir = rows[rows.length - 1], q = oxir.qator;
      const t0 = Date.now();
      await G.yoz(ID, [{ varaq: nusxa, katak: 'C' + q, qiymat: [['Tekshiruvda']] }, { varaq: nusxa, katak: 'AA' + q, qiymat: [[HY.hozirHm()]] },
        { varaq: nusxa, katak: 'V' + q, qiymat: [['99999']] }, { varaq: nusxa, katak: 'AE' + q, qiymat: [[(oxir.jurnal ? oxir.jurnal + '\n' : '') + HY.hozirHm() + ' · SINOV: tekshiruvga yuborildi']] }], KEY);
      console.log('Yozish: ' + (Date.now() - t0) + ' ms · qator ' + q + ' (loyiha №' + oxir.id + ')');
      const kat = async n => (await G.kataklarOqi(ID, nusxa, 'A' + n + ':AE' + n, KEY))[0] || [];
      const Y = await kat(q);
      const eskiAA = rows.filter(z => z.tekshiruvga && z.qator !== q).pop(), eskiV = rows.filter(z => z.skan.ariza && z.qator !== q).pop();
      const O = eskiAA ? await kat(eskiAA.qator) : (eskiV ? await kat(eskiV.qator) : null);
      if (O) x += solishtir(O, Y, [3, 22, 27, 31], '\n— eski tizim yozgan qator ' + (eskiAA || eskiV).qator + ' va server yozgan qator ' + q + ' (C holat, V skan, AA tekshiruvga, AE jurnal):');
      else console.log('(eski tizim yozgan solishtiriladigan qator yo\'q)');
    } finally {
      await G.soralar(ID, [{ deleteSheet: { sheetId: ng } }], KEY).catch(e => console.log('Nusxani o\'chirib bo\'lmadi: ' + e.message));
      console.log('Nusxa varaq o\'chirildi.');
    }
  }
  console.log('');
  if (x || !k16) await redis.del('yozuv_yondi:qayta');
  if (!x && k16) { await redis.set('yozuv_yondi:qayta', '1'); console.log('✅ HAMMASI BIR XIL — 🔁 qayta tuzish: skan yuklash, tekshiruvga yuborish va qaytarish endi serverda (o\'qishlar — deploy bilan).\n   Loyiha yaratish, hujjatlar (4 PDF), tasdiqlash va bekor qilish hozircha eski tizimda. Qaytarish kerak bo\'lsa: aks-yozuv-sinov ochir'); }
  else console.log('⚠ ' + (x ? x + ' ta farq' : 'Koprik 1.6 emas') + ' — yozuvlar YOQILMADI (eski tizim orqali ishlayveradi).');
}

// 🔁 QAYTA TUZISH — LOYIHANI BEKOR QILISH (Qayta.gs qaytaBekor): 06k NUSXASIDA oxirgi qator «Loyiha» holatiga, skansiz va bazada yo'q yangi raqam bilan
// qo'yiladi, server bekorYadro (ishdagi kodning o'zi, quruq) uni bekor qiladi; C (holat) va AE (jurnal) eski tizim ilgari bekor qilgan qator bilan
// (qiymat turi, format) va jurnal matni naqshi bilan solishtiriladi; «Bajarildi» loyiha rad etilishi; Koprik 1.14 va koprikQtPapkaSavat (yo'q raqam → 0 papka).
async function qaytabekorSinov() {
  const QT = require('../api/qayta'), QI = QT._ichki;
  console.log('\n=== QAYTA TUZISH — BEKOR QILISH (06k nusxasida) ===');
  const adm = (await pool.query('SELECT kirish_kodi, huquqlar, fish FROM v_xodimlar WHERE kompaniya_id = 1')).rows.find(x => (x.huquqlar || []).includes('admin') && String(x.kirish_kodi || '').length >= 8);
  const u = { fish: adm.fish, kod: adm.kirish_kodi, admin: true };
  let ver = '?', x = 0;
  try { ver = String(await koprik.chaqir('koprikVersiya', adm.kirish_kodi, [])); } catch (e) { ver = 'xato: ' + e.message; }
  const k114 = verOk(ver, '1.14') && !/^xato/.test(ver);
  console.log('Eski tizim ko\'prigi: v' + ver + (k114 ? ' ✅' : ' ⚠ (1.14 kerak)'));
  if (k114) { try { const r = await koprik.chaqir('koprikQtPapkaSavat', adm.kirish_kodi, ['27/999999']); console.log('koprikQtPapkaSavat(27/999999): ' + (r && r.n === 0 ? '✅ 0 papka (yo\'q raqam)' : '✖ ' + JSON.stringify(r))); if (!r || r.n !== 0) x++; } catch (e) { console.log('koprikQtPapkaSavat: ✖ ' + e.message); x++; } }
  const rows = (await QI.qtRows()) || [];
  if (!rows.length) { console.log('06k bo\'sh — solishtirib bo\'lmaydi.'); return; }
  const eskiB = rows.filter(z => z.holati === 'Bekor').pop();
  console.log(eskiB ? 'Namuna: eski tizim bekor qilgan loyiha №' + eskiB.id + ' (qator ' + eskiB.qator + ')' : '(eski tizim bekor qilgan loyiha yo\'q — faqat matn naqshi tekshiriladi)');
  const M = await G.varaqlar(ID, KEY), src = M.varaqlar.find(v => v.title === QI.QT_VARAQ);
  const nusxa = 'zz_sinov_06k';
  const j = await G.soralar(ID, [{ duplicateSheet: { sourceSheetId: src.sheetId, insertSheetIndex: M.varaqlar.length, newSheetName: nusxa } }], KEY);
  const ng = j.replies[0].duplicateSheet.properties.sheetId;
  try {
    await G.gid(ID, nusxa, KEY, true);
    const oxir = rows[rows.length - 1], q = oxir.qator;
    await G.yoz(ID, [{ varaq: nusxa, katak: 'C' + q, qiymat: [['Loyiha']] }, { varaq: nusxa, katak: 'E' + q, qiymat: [['27/999999']] }, { varaq: nusxa, katak: 'V' + q + ':Y' + q, qiymat: [['', '', '', '']] }], KEY);
    const t0 = Date.now();
    const r = await QI.bekorYadro(u, oxir.id, 'SINOV: sinov sababi', { varaq: nusxa, quruq: true });
    console.log('Yozish: ' + (Date.now() - t0) + ' ms · qator ' + q + ' (loyiha №' + oxir.id + ') → ' + JSON.stringify(r));
    const kat = async n => (await G.kataklarOqi(ID, nusxa, 'A' + n + ':AE' + n, KEY))[0] || [];
    const Y = await kat(q);
    const hol = Y[2] && Y[2].userEnteredValue ? Y[2].userEnteredValue.stringValue : '', jur = Y[30] && Y[30].userEnteredValue ? String(Y[30].userEnteredValue.stringValue || '') : '';
    const oxirQ = jur.split('\n').pop();
    const naqsh = new RegExp('^\\d\\d\\.\\d\\d\\.\\d{4} \\d\\d:\\d\\d · ' + adm.fish.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ': BEKOR: SINOV: sinov sababi \\(raqam 27/999999 bo\'shadi\\)$');
    if (hol !== 'Bekor') { x++; console.log('  C holat: ✖ «' + hol + '» (kutilgan «Bekor»)'); } else console.log('  C holat: ✅ Bekor');
    if (!naqsh.test(oxirQ)) { x++; console.log('  AE jurnal: ✖ «' + oxirQ + '»'); } else console.log('  AE jurnal: ✅ «' + oxirQ + '»');
    if (eskiB) { const O = await kat(eskiB.qator); x += solishtir(O, Y, [3, 31], '\n— eski tizim bekor qilgan qator ' + eskiB.qator + ' va server bekor qilgan qator ' + q + ' (C holat, AE jurnal — tur va format):'); }
    // «Bajarildi» (yoki boshqa faol bo'lmagan) loyiha — rad
    const yop = rows.find(z => ['Loyiha', 'Qaytarildi', 'Tekshiruvda', 'Yozilmoqda'].indexOf(z.holati) < 0 && z.qator !== q);
    if (yop) { let xt = ''; try { await QI.bekorYadro(u, yop.id, 'SINOV', { varaq: nusxa, quruq: true }); } catch (e) { xt = e.message; }
      if (/holatida — bekor qilib bo'lmaydi/.test(xt)) console.log('  «' + yop.holati + '» loyiha: ✅ rad — «' + xt + '»'); else { x++; console.log('  «' + yop.holati + '» loyiha: ✖ rad etilmadi: ' + (xt || 'xatosiz o\'tdi')); } }
  } finally {
    await G.soralar(ID, [{ deleteSheet: { sheetId: ng } }], KEY).catch(e => console.log('Nusxani o\'chirib bo\'lmadi: ' + e.message));
    console.log('Nusxa varaq o\'chirildi.');
  }
  console.log('');
  if (!x && k114) { await redis.set('yozuv_yondi:qayta_bekor', '1'); console.log('✅ HAMMASI BIR XIL — 🔁 qayta tuzish loyihasini bekor qilish endi serverda (06k, 06d, topshiriq — server; bo\'sh Drive papkasi — Koprik 1.14). Qaytarish: aks-yozuv-sinov ochir'); }
  else { await redis.del('yozuv_yondi:qayta_bekor'); console.log('⚠ ' + (x ? x + ' ta farq' : 'Koprik 1.14 emas') + ' — YOQILMADI (eski tizim orqali ishlayveradi).'); }
}

// 🔁 QAYTA TUZISH 2-BOSQICH (tasdiq, loyiha): 06k/03/03b/05/05b NUSXALARIDA server to'liq tasdiq yozuvini bajaradi (tasdiqYadro — ishdagi kodning o'zi)
// va loyiha qatorini yozadi; har bir yozuv eski tizim (Qayta.gs) ilgari yozgan haqiqiy kataklar bilan ustunma-ustun (qiymat turi, format, formula) solishtiriladi.
async function qayta2Sinov() {
  const QT = require('../api/qayta'), QI = QT._ichki;
  console.log('\n=== QAYTA TUZISH — TASDIQLASH va LOYIHA (nusxa varaqlarda) ===');
  const adm = (await pool.query('SELECT kirish_kodi, huquqlar, fish FROM v_xodimlar WHERE kompaniya_id = 1')).rows.find(x => (x.huquqlar || []).includes('admin') && String(x.kirish_kodi || '').length >= 8);
  let ver = '?';
  try { ver = String(await koprik.chaqir('koprikVersiya', adm.kirish_kodi, [])); } catch (e) { ver = 'xato: ' + e.message; }
  const k16 = verOk(ver, '1.6') && !/^xato/.test(ver);
  console.log('Eski tizim ko\'prigi: v' + ver + (k16 ? ' ✅' : ' ⚠ (1.6 kerak)'));
  const rows = (await QI.qtRows()) || [];
  const xo = rows.filter(z => z.holati === 'Bajarildi').pop();
  if (!xo) { console.log('06k da «Bajarildi» loyiha yo\'q — tasdiq yozuvini solishtirib bo\'lmaydi.'); return; }
  console.log('Namuna: eski tizim tasdiqlagan loyiha №' + xo.id + ' (' + xo.eski + ' → ' + xo.yangi + ', ' + xo.fish + ')');
  const M0 = await G.varaqlar(ID, KEY);
  const ASL = { k: '06k_Qayta_tuzish', s3: '03_Sotuv_shartnomalar', s3b: '03b_Tolov_jadvali', s5: '05_Tolovlar', s5b: '05b_Bufer_tolovlar' };
  const VQ = { k: 'zz_sinov_06k', s3: 'zz_sinov_03', s3b: 'zz_sinov_03b', s5: 'zz_sinov_05', s5b: 'zz_sinov_05b' };
  const req = Object.keys(ASL).map((k, i) => { const src = M0.varaqlar.find(v => v.title === ASL[k]); if (!src) throw new Error('Varaq topilmadi: ' + ASL[k]); return { duplicateSheet: { sourceSheetId: src.sheetId, insertSheetIndex: M0.varaqlar.length + i, newSheetName: VQ[k] } }; });
  const j = await G.soralar(ID, req, KEY);
  const ng = j.replies.map(r => r.duplicateSheet.properties.sheetId);
  let x = 0;
  try {
    for (const k of Object.keys(VQ)) await G.gid(ID, VQ[k], KEY, true);
    const M = QI.manba(true, { '03_Sotuv_shartnomalar': VQ.s3, '03b_Tolov_jadvali': VQ.s3b, '05_Tolovlar': VQ.s5, '05b_Bufer_tolovlar': VQ.s5b });
    const S3 = await QI.qtShartnoma(xo.yangi, M); if (!S3.x) throw new Error('03 da ' + xo.yangi + ' topilmadi');
    const eskiRow = (await QI.qtShartnoma(xo.eski, M)).x;
    const r = S3.x.r;
    let nn = S3.mx + 1; while (S3.barcha.indexOf('27/' + nn) >= 0) nn++;
    const X = { id: '9999', qator: xo.qator, eski: xo.yangi, yangi: '27/' + nn, mid: String(r[4] || ''), fish: String(r[20] || ''), dokon: String(r[5] || ''), turi: xo.turi,
      qiymat: Math.round(Number(r[22]) || 0), tolangan: Math.round(Number(r[27]) || 0), oy: xo.oy || 12, kun: xo.kun || 23, sana: new Date(Date.now() + 5 * 3600000).toISOString().slice(0, 10).split('-').reverse().join('.'),
      birinchi: xo.birinchi, ijrochi: xo.ijrochi, jurnal: xo.jurnal };
    X.qolgan = X.qiymat - X.tolangan;
    const T0 = await QI.qtTolovlar(X.eski, M);
    console.log('Sinov loyihasi: ' + X.eski + ' → ' + X.yangi + ' · qiymat ' + QI.qtFmt(X.qiymat) + ' · to\'langan ' + QI.qtFmt(X.tolangan) + ' · ' + X.oy + ' oy · to\'lovlar ' + T0.length + ' ta (05: ' + T0.filter(t => t.v === '05').length + ', 05b: ' + T0.filter(t => t.v === '05b').length + ')');
    const kat = async (v, a1) => (await G.kataklarOqi(ID, v, a1, KEY))[0] || [];
    const oldin05 = {}; for (const t of T0) oldin05[t.v + ':' + t.qator] = await kat(t.v === '05' ? VQ.s5 : VQ.s5b, 'A' + t.qator + ':L' + t.qator);
    const oldin06k = await kat(VQ.k, 'A' + xo.qator + ':AE' + xo.qator);
    const sl = (await SY.aUstun(VQ.s3)).last, R3b0 = await G.oraliqOqi(ID, VQ.s3b, 'A2:B', KEY, 'UNFORMATTED_VALUE'); let jl = 1; R3b0.forEach((z, i) => { if (z[0] !== '' && z[0] != null) jl = i + 2; });
    const t0 = Date.now();
    const natija = await QI.tasdiqYadro(VQ, { fish: adm.fish, kod: adm.kirish_kodi }, X, M, false);
    console.log('Tasdiq yozuvi: ' + ((Date.now() - t0) / 1000).toFixed(1) + ' s — ' + JSON.stringify(natija));
    // 03: yangi qator ↔ eski tizim yozgan xo.yangi qatori
    x += solishtir(await kat(VQ.s3, 'A' + S3.x.qator + ':AP' + S3.x.qator), await kat(VQ.s3, 'A' + (sl + 1) + ':AP' + (sl + 1)), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 18, 20, 21, 22, 23, 27, 30, 33, 40, 41, 42], '\n— 03: eski tizim yozgan ' + xo.yangi + ' (qator ' + S3.x.qator + ') va server yozgan ' + X.yangi + ' (qator ' + (sl + 1) + '):');
    // 03b: jadvalning 1- va 2-qatori ↔ eski tizim yozgan xo.yangi jadvali
    const R3b = await G.oraliqOqi(ID, VQ.s3b, 'A2:B', KEY); const e3b = []; R3b.forEach((z, i) => { if (String(z[1] || '').trim() === xo.yangi) e3b.push(i + 2); });
    if (e3b.length >= 2) { x += solishtir(await kat(VQ.s3b, 'A' + e3b[0] + ':H' + e3b[0]), await kat(VQ.s3b, 'A' + (jl + 1) + ':H' + (jl + 1)), [1, 2, 3, 4, 5, 6, 7, 8], '\n— 03b «Boshlang\'ich»: eski qator ' + e3b[0] + ' va server qatori ' + (jl + 1) + ':');
      x += solishtir(await kat(VQ.s3b, 'A' + e3b[1] + ':H' + e3b[1]), await kat(VQ.s3b, 'A' + (jl + 2) + ':H' + (jl + 2)), [1, 2, 3, 4, 5, 6, 7, 8], '\n— 03b «Oylik»: eski qator ' + e3b[1] + ' va server qatori ' + (jl + 2) + ':'); }
    else console.log('(03b da ' + xo.yangi + ' jadvali topilmadi — solishtirilmadi)');
    // 05 / 05b: ko'chirilgan to'lov qatori — oldin (eski tizim ko'chirgan) ↔ keyin (server ko'chirgan)
    for (const t of T0.slice(0, 2)) { const v = t.v === '05' ? VQ.s5 : VQ.s5b;
      x += solishtir(oldin05[t.v + ':' + t.qator], await kat(v, 'A' + t.qator + ':L' + t.qator), t.v === '05' ? [3, 9, 12] : [3, 6], '\n— ' + t.v + ' qator ' + t.qator + ': eski tizim ko\'chirgan (C/I/L) va server ko\'chirgan:',
        // I «eski raqam»: ikkalasi ham setValue (USER_ENTERED) — Google «27/8» ni sanaga aylantiradi, «27/368» ni yo'q; shuning uchun har biri o'z eski raqamiga teng bo'lsa — bir xil
        { 9: (a, b) => String(a.formattedValue || '') === xo.eski && String(b.formattedValue || '') === X.eski }); }
    // eski shartnoma «Bekor qilindi»: server bekor qilgan xo.yangi qatori ↔ eski tizim bekor qilgan xo.eski qatori
    if (eskiRow) x += solishtir(await kat(VQ.s3, 'A' + eskiRow.qator + ':T' + eskiRow.qator), await kat(VQ.s3, 'A' + S3.x.qator + ':T' + S3.x.qator), [14, 15, 20], '\n— 03 eski shartnoma (N holat, O sana, T izoh): eski tizim bekor qilgan ' + xo.eski + ' va server bekor qilgan ' + xo.yangi + ':');
    // 06k: loyiha qatori — oldin (eski tizim «Bajarildi» qilgan) ↔ keyin (server)
    x += solishtir(oldin06k, await kat(VQ.k, 'A' + xo.qator + ':AE' + xo.qator), [3, 28, 29, 30, 31], '\n— 06k qator ' + xo.qator + ' (C holat, AB vaqt, AC kim, AD to\'lovlar, AE jurnal): eski tizim va server:');
    // loyiha qatori: server yozgan yangi 06k qatori ↔ eski tizim yozgan xo qatori (31 ustun — hammasi matn)
    const l = rows[rows.length - 1].qator;
    const row = [String(Number(rows[rows.length - 1].id) + 1), '01.01.2026 00:00', 'Loyiha', X.eski, X.yangi, X.mid, X.fish, X.dokon, X.turi, String(X.qiymat), String(X.tolangan), String(X.qolgan), X.sana, String(X.oy), String(X.kun), X.birinchi, 'SINOV', 'SINOV eski nomi', adm.fish, adm.fish, '',
      '', '', '', '', '', '', '', '', '', '01.01.2026 00:00 · SINOV: loyiha yaratildi'];
    const t1 = Date.now(); const q = await QI.loyihaQatorYoz(VQ.k, l, row); console.log('Loyiha qatori: ' + (Date.now() - t1) + ' ms · qator ' + q);
    const U31 = []; for (let i = 1; i <= 31; i++) U31.push(i);
    x += solishtir(oldin06k, await kat(VQ.k, 'A' + q + ':AE' + q), U31, '\n— 06k loyiha qatori: eski tizim yozgan qator ' + xo.qator + ' va server yozgan qator ' + q + ' (31 ustun):');
  } finally {
    await G.soralar(ID, ng.map(g => ({ deleteSheet: { sheetId: g } })), KEY).catch(e => console.log('Nusxalarni o\'chirib bo\'lmadi: ' + e.message));
    console.log('Nusxa varaqlar o\'chirildi.');
  }
  console.log('');
  if (!x && k16) { await redis.set('yozuv_yondi:qayta2', '1'); console.log('✅ HAMMASI BIR XIL — 🔁 qayta tuzish: loyiha yaratish, ijrochini almashtirish va ✓ TASDIQLASH endi serverda.\n   Hujjatlar (4 PDF) va ✕ bekor qilish hozircha eski tizimda. Qaytarish kerak bo\'lsa: aks-yozuv-sinov ochir'); }
  else console.log('⚠ ' + (x ? x + ' ta farq' : 'Koprik 1.6 emas') + ' — 2-bosqich YOQILMADI (eski tizim orqali ishlayveradi).');
}

// PDF → so'zlar joyi (pdftotext -bbox): [bet, matn, xMin, yMin, xMax, yMax] (​ olib tashlanadi — Docs qator uzilishida qo'yadi)
function sozJoy(buf) {
  const fs = require('fs'), os = require('os'), path = require('path');
  const f = path.join(os.tmpdir(), 'aks_qh_' + process.pid + '_' + Math.random().toString(36).slice(2) + '.pdf');
  fs.writeFileSync(f, buf);
  try {
    const h = execFileSync('pdftotext', ['-bbox', f, '-'], { maxBuffer: 64 << 20 }).toString('utf8');
    const r = []; let bet = 0;
    const re = /<page |<word xMin="([\d.]+)" yMin="([\d.]+)" xMax="([\d.]+)" yMax="([\d.]+)">([^<]*)<\/word>/g; let m;
    while ((m = re.exec(h))) {
      if (m[0] === '<page ') { bet++; continue; }
      const t = m[5].replace(/​/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, '\'');
      if (t) r.push([bet, t, +m[1], +m[2], +m[3], +m[4]]);
    }
    return r;
  } finally { fs.unlink(f, () => {}); }
}
// ikki PDF ni so'zma-so'z solishtirish: { farq, dmax, sozlar, betlar } — matn farqi, boshqa betga tushgan yoki 0,9 pt dan ko'p surilgan so'z = farq
function sozSolishtir(eskiB, yangiB, tol) {
  const A = sozJoy(eskiB), B = sozJoy(yangiB); tol = tol || 0.9;
  let farq = 0, dmax = 0, i = 0, j = 0; const ch = [];
  while (i < A.length || j < B.length) {
    const a = A[i], b = B[j];
    if (a && b && a[1] === b[1]) {
      const d = Math.max(Math.abs(a[2] - b[2]), Math.abs(a[3] - b[3])); dmax = Math.max(dmax, d);
      if (a[0] !== b[0] || d >= tol) { farq++; if (ch.length < 8) ch.push(a[0] + '/' + b[0] + '-bet «' + a[1].slice(0, 24) + '» eski (' + a[2].toFixed(1) + ',' + a[3].toFixed(1) + ') server (' + b[2].toFixed(1) + ',' + b[3].toFixed(1) + ')'); }
      i++; j++; continue;
    }
    farq++; if (ch.length < 8) ch.push('matn: eski «' + (a ? a[1] : '—') + '» server «' + (b ? b[1] : '—') + '»');
    let best = null;
    for (let di = 0; di < 4; di++) for (let dj = 0; dj < 4; dj++) if (A[i + di] && B[j + dj] && A[i + di][1] === B[j + dj][1] && (!best || di + dj < best[0])) best = [di + dj, di, dj];
    if (best) { i += best[1]; j += best[2]; } else { i++; j++; }
  }
  return { farq, dmax, sozlar: [A.length, B.length], betlar: [A.length ? A[A.length - 1][0] : 0, B.length ? B[B.length - 1][0] : 0], ch };
}
// 🔁 QAYTA TUZISH HUJJATLARI: oxirgi «Bajarildi» loyiha (Drive papkasi bor) uchun 4 PDF serverda qayta yasaladi va eski tizim papkaga qo'ygan PDF lar bilan solishtiriladi.
// Ma'lumot: 06k qatori (sana, oy, kun, sabab — o'sha paytdagidek), eski shartnoma 03 qatori (sana/tur/maydon o'zgarmagan), 02 mijoz, to'lovlar — tasdiqda yangi raqamga
// ko'chirilganlari (05 C=yangi, I to'ldirilgan; 05b C=yangi «Буферда»). Hech narsa yozilmaydi.
async function qaytahujSinov() {
  const QT = require('../api/qayta'), QI = QT._ichki, s = v => String(v == null ? '' : v);
  console.log('\n=== QAYTA TUZISH — HUJJATLAR (4 PDF, eski tizim chiqargani bilan) ===');
  if (!(await PDF.bor())) { console.log('⏳ PDF dasturi (Chromium) hali tayyor emas — 3 daqiqadan keyin qayta ishga tushiring.'); return; }
  try { execFileSync('pdftotext', ['-v'], { stdio: 'ignore' }); } catch (e) { console.log('⚠ pdftotext yo\'q (poppler-utils) — solishtirib bo\'lmaydi.'); return; }
  const rows = (await QI.qtRows()) || [];
  const xo = rows.filter(z => z.holati === 'Bajarildi' && /folders\/([\w-]+)/.test(s(z.papka))).pop();
  if (!xo) { console.log('06k da Drive papkali «Bajarildi» loyiha yo\'q — solishtirib bo\'lmaydi.'); return; }
  console.log('Namuna: loyiha №' + xo.id + ' (' + xo.eski + ' → ' + xo.yangi + ', ' + xo.fish + ') · sana ' + xo.sana + ' · ' + xo.oy + ' oy · to\'langan ' + QI.qtFmt(xo.tolangan));
  const pid = /folders\/([\w-]+)/.exec(xo.papka)[1];
  const tok = await G.token(KEY, 'https://www.googleapis.com/auth/drive.readonly');
  const q = "'" + pid + "' in parents and mimeType = 'application/pdf' and trashed = false";
  const rl = await fetch('https://www.googleapis.com/drive/v3/files?q=' + encodeURIComponent(q) + '&fields=files(id,name,size,modifiedTime)&pageSize=50&supportsAllDrives=true&includeItemsFromAllDrives=true', { headers: { Authorization: 'Bearer ' + tok } });
  if (!rl.ok) { console.log('⚠ Drive papkasi o\'qilmadi: ' + rl.status + ' ' + (await rl.text()).slice(0, 200)); return; }
  const DF = ((await rl.json()).files || []); console.log('Drive papkasida ' + DF.length + ' ta PDF (robot o\'qidi).');
  const e = (await QI.qtShartnoma(xo.eski)).x; if (!e) { console.log('03 da ' + xo.eski + ' topilmadi'); return; }
  const mr = await QI.qtMijoz(xo.mid); if (!mr) { console.log('02 da mijoz ' + xo.mid + ' topilmadi'); return; }
  const T = [];
  (await V.qatorlar('05_Tolovlar')).forEach(z => { const r = z.x; if (r[0] && s(r[2]).trim() === xo.yangi && s(r[8]).trim() !== '') T.push({ sana: V.iso(r[1]), summa: Number(r[3]) || 0, shakl: s(r[4]) }); });
  (await V.qatorlar('05b_Bufer_tolovlar')).forEach(z => { const r = z.x; if (r[0] && s(r[2]).trim() === xo.yangi && s(r[6]).trim() === 'Буферда' && s(r[5]).indexOf(xo.eski + ' dan') >= 0) T.push({ sana: V.iso(r[1]), summa: Number(r[3]) || 0, shakl: s(r[4]) }); });
  T.sort((a, b) => a.sana < b.sana ? -1 : a.sana > b.sana ? 1 : 0);
  console.log('To\'lovlar (tasdiqda ko\'chirilganlar): ' + T.length + ' ta, yig\'indi ' + QI.qtFmt(T.reduce((a, t) => a + t.summa, 0)));
  let x = 0;
  const t0 = Date.now();
  const N = await QI.hujjatlarYasa(xo, e.d, mr, T);
  console.log('Server 4 ta PDF: ' + ((Date.now() - t0) / 1000).toFixed(1) + ' s' + N.map(n => ' · ' + n.k + ' ' + n.bet + ' bet').join('') + (N.some(n => n.qolgan.length) ? ' · to\'ldirilmagan belgilar: ' + N.map(n => n.qolgan.join(',')).filter(Boolean).join(' ') : '') + (N[3].bosh.length ? ' · mijoz ma\'lumoti: ' + N[3].bosh.join(', ') : ''));
  N.forEach(n => console.log('  shablon: ' + n.shablon.nom + ' (' + n.shablon.modifiedTime + ')'));
  for (const n of N) {
    const f = DF.find(z => z.name === n.nom);
    console.log('\n— ' + n.nom + ':');
    if (!f) { console.log('  ⚠ eski tizim PDF i Drive papkasida topilmadi (' + DF.map(z => z.name).join(', ') + ')'); x++; continue; }
    let eskiB; try { eskiB = (await G.driveFayl(f.id, KEY)).bytes; } catch (err) { console.log('  ⚠ robot o\'qiy olmadi: ' + err.message); x++; continue; }
    x += pdfSolishtir(eskiB, n.pdf);
    const w = sozSolishtir(eskiB, n.pdf);
    if (w.sozlar[0] !== w.sozlar[1] || w.betlar[0] !== w.betlar[1] || w.farq) { x++; console.log('  ✖ so\'zlar joyi: eski ' + w.sozlar[0] + ' / server ' + w.sozlar[1] + ' so\'z, betlar ' + w.betlar.join('/') + ', ' + w.farq + ' ta farq, eng katta og\'ish ' + w.dmax.toFixed(2) + ' pt'); w.ch.forEach(c => console.log('     ' + c)); }
    else console.log('  ✅ ' + w.sozlar[0] + ' so\'zning joyi bir xil (eng katta og\'ish ' + w.dmax.toFixed(2) + ' pt — lotin harflari kerningi)');
  }
  console.log('');
  if (!x) { await redis.set('yozuv_yondi:qayta_hujjat', '1'); console.log('✅ HAMMASI BIR XIL — 📄 qayta tuzish hujjatlari (4 PDF) endi serverda yasaladi (Drive papkasi, Google Doc nusxalari, 06k Z va jurnal — fonda eski tizim). Qaytarish: aks-yozuv-sinov ochir'); }
  else console.log('⚠ ' + x + ' ta farq — hujjatlar YOQILMADI (eski tizim orqali ishlayveradi).');
}

// 📄 SHARTNOMA PDF: sotuv (03) va ijara (04) shartnomasi serverda qayta yasaladi va eski tizim Drive'ga qo'ygan PDF (S / V ustunidagi havola, robot o'qiydi)
// bilan solishtiriladi. Raqam berilmasa — havolasi bor oxirgi qatorlar. Mijoz ma'lumoti (02) yoki do'kon (01) keyin o'zgargan bo'lsa matn farq qiladi —
// o'shanda boshqa raqam bering. Hech narsa yozilmaydi.
async function shpdfSinov(nolar) {
  const SP2 = require('../api/shartnoma_pdf')._ichki, s = v => String(v == null ? '' : v);
  console.log('\n=== SHARTNOMA PDF (sotuv + ijara, eski tizim chiqargani bilan) ===');
  if (!(await PDF.bor())) { console.log('⏳ PDF dasturi (Chromium) hali tayyor emas — 3 daqiqadan keyin qayta ishga tushiring.'); return; }
  try { execFileSync('pdftotext', ['-v'], { stdio: 'ignore' }); } catch (e) { console.log('⚠ pdftotext yo\'q (poppler-utils) — solishtirib bo\'lmaydi.'); return; }
  const idOl = u => { const m = /\/d\/([\w-]+)/.exec(s(u)) || /[?&]id=([\w-]+)/.exec(s(u)); return m ? m[1] : null; };
  const R3 = (await V.qatorlar('03_Sotuv_shartnomalar')).filter(z => s(z.r[0]).trim()), R4 = (await V.qatorlar('04_Ijara_shartnomalar')).filter(z => s(z.r[0]).trim());
  const ish = [];
  const sot = nolar.filter(n => !/^IJ-/i.test(n)), ij = nolar.filter(n => /^IJ-/i.test(n));
  if (!sot.length) { const z = R3.filter(q => idOl(q.r[18])).pop(); if (z) sot.push(s(z.r[0]).trim()); }
  if (!ij.length) { const z = R4.filter(q => idOl(q.r[21])).pop(); if (z) ij.push(s(z.r[0]).trim()); }
  sot.forEach(n => { const z = R3.find(q => s(q.r[0]).trim() === n); ish.push({ tur: 'sotuv', no: n, url: z ? z.r[18] : '' }); });
  ij.forEach(n => { const z = R4.find(q => s(q.r[0]).trim() === n); ish.push({ tur: 'ijara', no: n, url: z ? z.r[21] : '' }); });
  if (!ish.length) { console.log('03 S / 04 V ustunida Drive havolasi bor shartnoma yo\'q — solishtirib bo\'lmaydi.'); return; }
  let x = 0;
  for (const w of ish) {
    console.log('\n— ' + (w.tur === 'sotuv' ? 'Sotuv' : 'Ijara') + ' ' + w.no + ':');
    const fid = idOl(w.url); if (!fid) { console.log('  ⚠ ' + (w.tur === 'sotuv' ? '03 S' : '04 V') + ' ustunida eski tizim PDF havolasi yo\'q — avval eski tizimda 📄 PDF qiling.'); x++; continue; }
    let eskiB; try { eskiB = (await G.driveFayl(fid, KEY)).bytes; } catch (err) { console.log('  ⚠ robot Drive\'dagi PDF ni o\'qiy olmadi: ' + err.message); x++; continue; }
    let h; const t0 = Date.now();
    try { h = w.tur === 'sotuv' ? await SP2.sotuvYasa(w.no) : await SP2.ijaraYasa(w.no); } catch (err) { console.log('  ✖ server yasay olmadi: ' + err.message); x++; continue; }
    console.log('  server: ' + h.nom + '.pdf · ' + h.bet + ' bet · ' + ((Date.now() - t0) / 1000).toFixed(1) + ' s · shablon ' + h.shablon.nom + ' (' + h.shablon.modifiedTime + ')' + (w.tur === 'ijara' ? ' · ' + (h.sotilgan ? 'egasi nomidan' : 'MChJ nomidan') : ''));
    if (h.qolgan.length) { console.log('  ⚠ to\'ldirilmagan belgilar: ' + h.qolgan.join(', ')); }
    if (h.bosh.length) console.log('  mijoz ma\'lumoti: ' + h.bosh.join(', '));
    x += pdfSolishtir(eskiB, h.pdf);
    const q = sozSolishtir(eskiB, h.pdf);
    if (q.sozlar[0] !== q.sozlar[1] || q.betlar[0] !== q.betlar[1] || q.farq) { x++; console.log('  ✖ so\'zlar joyi: eski ' + q.sozlar[0] + ' / server ' + q.sozlar[1] + ' so\'z, betlar ' + q.betlar.join('/') + ', ' + q.farq + ' ta farq, eng katta og\'ish ' + q.dmax.toFixed(2) + ' pt'); q.ch.forEach(c => console.log('     ' + c)); }
    else console.log('  ✅ ' + q.sozlar[0] + ' so\'zning joyi bir xil (eng katta og\'ish ' + q.dmax.toFixed(2) + ' pt)');
  }
  console.log('');
  if (!x) { await redis.set('yozuv_yondi:shartnoma_pdf', '1'); console.log('✅ HAMMASI BIR XIL — 📄 shartnoma PDF (sotuv va ijara) endi serverda yasaladi, 2–4 soniyada (Drive nusxasi va 03 S / 04 V havolasi — fonda eski tizim, ~1 daqiqa). Qaytarish: aks-yozuv-sinov ochir'); }
  else console.log('⚠ ' + x + ' ta farq — shartnoma PDF YOQILMADI (eski tizim orqali ishlayveradi).');
}

// 🎲 TEKSHIRUV JAVOBI (Ijro.gs ijroTekshirJavob): 06p nusxasida javob kataklari (M:O), 06q nusxasida «soxta» qoidabuzarlik qatori, qayta tekshiruv —
// 10 nusxasida topshiriq + 06p nusxasida qator; hammasi eski tizim yozgan qatorlar bilan (qiymat turi, format). Telegram va zinapoya sinalmaydi.
async function tekshirSinov() {
  const IY = require('../api/ijro_yoz')._ichki;
  const adm = (await pool.query('SELECT kirish_kodi, huquqlar FROM v_xodimlar WHERE kompaniya_id = 1')).rows.find(z => (z.huquqlar || []).includes('admin') && String(z.kirish_kodi || '').length >= 8);
  let ver = '?'; try { ver = String(await koprik.chaqir('koprikVersiya', adm.kirish_kodi, [])); } catch (e) { ver = 'xato: ' + e.message; }
  const k15 = verOk(ver, '1.5') && !/^xato/.test(ver);
  console.log('Eski tizim ko\'prigi: v' + ver + (k15 ? ' ✅' : ' ⚠ (1.5 kerak — Telegram)'));
  const M = await G.varaqlar(ID, KEY);
  const ochir = []; let x = 0;
  const nusxala = async varaq => { const src = M.varaqlar.find(v => v.title === varaq); if (!src) throw new Error('Varaq topilmadi: ' + varaq);
    const j = await G.soralar(ID, [{ duplicateSheet: { sourceSheetId: src.sheetId, insertSheetIndex: M.varaqlar.length + ochir.length, newSheetName: 'zz_sinov_' + varaq } }], KEY);
    ochir.push(j.replies[0].duplicateSheet.properties.sheetId); await G.gid(ID, 'zz_sinov_' + varaq, KEY, true); return 'zz_sinov_' + varaq; };
  const s = v => String(v == null ? '' : v);
  try {
    console.log('\n=== 🎲 TEKSHIRUV JAVOBI (06p_Tekshiruv M:O) ===');
    const TL = await IY.ijroQatorYangi(IY.IJRO_TEK, IY.IJRO_TS);
    if (!TL.length) { console.log('06p_Tekshiruv bo\'sh — hali birorta tekshiruv tanlanmagan, solishtirib bo\'lmaydi (09:30 dan keyin qayta urinib ko\'ring).'); return; }
    const n06p = await nusxala(IY.IJRO_TEK);
    const ej = TL.filter(r => r.Holati !== 'Kutilmoqda' && r.Javob_vaqt !== '').pop();
    const target = (TL.find(r => r.Holati === 'Kutilmoqda' && (!ej || r.qator !== ej.qator)) || TL.find(r => !ej || r.qator !== ej.qator) || TL[TL.length - 1]).qator;
    const t0 = Date.now();
    await IY.tekJavobYoz(n06p, target, 'Tasdiqlandi', 'SINOV — nusxa varaq');
    console.log('Yozish: ' + (Date.now() - t0) + ' ms · qator ' + target + (ej ? ' · eski tizim javob yozgan qator ' + ej.qator + ' (' + ej.Holati + ')' : ' · eski tizim yozgan javob hali yo\'q'));
    if (ej) { const [a, b] = await Promise.all([G.kataklarOqi(ID, n06p, 'A' + ej.qator + ':O' + ej.qator, KEY), G.kataklarOqi(ID, n06p, 'A' + target + ':O' + target, KEY)]);
      x += solishtir(a[0] || [], b[0] || [], [13, 14, 15], '— Javob kataklari (M Holati, N Izoh, O Javob_vaqt)'); }
    else { const b = (await G.kataklarOqi(ID, n06p, 'M' + target + ':O' + target, KEY))[0] || []; console.log('  server yozdi: M ' + tur(b[0]) + ' · N ' + tur(b[1]) + ' · O ' + tur(b[2]) + ' ' + fmt(b[2]) + ' (eski tizim javobi yo\'q — solishtirilmadi)'); }

    console.log('\n=== 📒 QOIDABUZARLIK (06q_Qoidabuzarlik — «soxta» qatori) ===');
    const n06q = await nusxala(IY.IJRO_VARAQ);
    const L = await IY.ijroQatorYangi(n06q, IY.IJRO_S);
    const eq = L.filter(q => q.Tur === 'soxta').pop() || L[L.length - 1];
    // shartnoma raqami — eski qatordagi ko'rinishning o'zi («27/5» kabi raqamni eski tizim ham, server (USER_ENTERED) ham sanaga aylantiradi — ma'lum eski xato, parity)
    const eh = eq ? (((await G.kataklarOqi(ID, n06q, 'H' + eq.qator, KEY))[0] || [])[0] || {}) : {};
    const noS = eh.formattedValue ? String(eh.formattedValue) : '27/999';
    const t1 = Date.now();
    const q = await IY.ijroYoz(n06q, { xodim: 'SINOV XODIM', tur: 'soxta', kalit: 'sinov|' + Date.now(), no: noS, fish: 'SINOV MIJOZ', tafsilot: 'SINOV — nusxa varaq, o\'chiriladi' });
    console.log('Yozish: ' + (Date.now() - t1) + ' ms · ID ' + q.id + ', qator ' + q.qator + (eq ? ' · eski tizim yozgan qator ' + eq.qator + ' (' + eq.Tur + ', shartnoma «' + noS + '»)' : ''));
    if (eq) x += await qatorSolishtir(n06q, q.qator, 1, 17, '— Qoidabuzarlik qatori (A–Q)', eq.qator, (i, fa, fb) => i === 7 && /DATE/.test(fa) !== /DATE/.test(fb) ? 'shartnoma raqami: eski tizim «' + noS + '» ni sanaga aylantirgan (ma\'lum eski xato) — server ham USER_ENTERED bilan xuddi shunday yozadi' : null);
    else console.log('  (06q da eski qator yo\'q — solishtirilmadi)');

    console.log('\n=== 🎲 QAYTA TEKSHIRUV (10_Topshiriqlar + 06p) ===');
    const n10 = await nusxala('10_Topshiriqlar');
    const R10 = await TP.topRowsYangi(n10);
    const et = R10.L.filter(t => t.qoida === 'tekshir').pop();
    const t2 = Date.now();
    const w = await IY.tekYarat({ id: 999999, sana: V.bugun(), chora: 'Телефон', mazmun: 'SINOV — nusxa varaq', vadaSana: '', vadaSumma: 0 },
      { no: '27/999', fish: 'SINOV MIJOZ', tel: '+998 90 000 00 00' }, 'SINOV UNDIRUVCHI', et ? et.kimga : 'SINOV TEKSHIRUVCHI', 2, V.bugun(), R10, { top: n10, tek: n06p });
    console.log('Yozish: ' + (Date.now() - t2) + ' ms · topshiriq ' + w.top + ' (qator ' + w.topQator + ')' + (et ? ', eski tizim yozgan tekshiruv topshirig\'i qator ' + et.qator : '') + ' · 06p qator ' + w.qator);
    if (et) x += await qatorSolishtir(n10, w.topQator, 1, 22, '— Topshiriq qatori (A–V)', et.qator); else console.log('  (10 da eski «tekshir» topshirig\'i yo\'q — solishtirilmadi)');
    const e1 = TL.filter(r => r.Holati === 'Kutilmoqda').pop() || TL[TL.length - 1];
    x += await qatorSolishtir(n06p, w.qator, 1, 15, '— 06p qatori (A–O)', e1.qator);
  } finally {
    if (ochir.length) await G.soralar(ID, ochir.map(g => ({ deleteSheet: { sheetId: g } })), KEY).catch(e => console.log('Nusxani o\'chirib bo\'lmadi: ' + e.message));
    console.log('\nNusxa varaqlar o\'chirildi.');
  }
  console.log('');
  if (!x && k15) { await redis.set('yozuv_yondi:ijro_tekshir', '1'); console.log('✅ HAMMASI BIR XIL — 🎲 tekshiruv qo\'ng\'irog\'i javobi (✅ / ❌ / 📵) endi server orqali (Telegram — eski tizim ko\'prigi). Qaytarish: aks-yozuv-sinov ochir'); }
  else console.log('⚠ ' + (x ? x + ' ta farq' : 'Koprik 1.5 emas') + ' — YOQILMADI (eski tizim orqali ishlayveradi).');
}

// ✕ IMZOLANMAGAN IJARA (ImzosizBekor.gs): 06l nusxasida so'rov qatori va javob kataklari (H:K), 04 nusxasida bekor kataklari (C, D, W) va 06j nusxasida
// jurnal qatori — eski tizim yozganlari bilan (qiymat turi, format). Telegram sinalmaydi. Haqiqiy varaqlarga tegilmaydi.
async function imzosizSinov() {
  const IM = require('../api/imzosiz_yoz')._ichki;
  const adm = (await pool.query('SELECT kirish_kodi, huquqlar FROM v_xodimlar WHERE kompaniya_id = 1')).rows.find(z => (z.huquqlar || []).includes('admin') && String(z.kirish_kodi || '').length >= 8);
  let ver = '?'; try { ver = String(await koprik.chaqir('koprikVersiya', adm.kirish_kodi, [])); } catch (e) { ver = 'xato: ' + e.message; }
  const k15 = verOk(ver, '1.5') && !/^xato/.test(ver);
  console.log('Eski tizim ko\'prigi: v' + ver + (k15 ? ' ✅' : ' ⚠ (1.5 kerak — Telegram)'));
  const M = await G.varaqlar(ID, KEY);
  const ochir = []; let x = 0;
  const nusxala = async varaq => { const src = M.varaqlar.find(v => v.title === varaq); if (!src) throw new Error('Varaq topilmadi: ' + varaq);
    const j = await G.soralar(ID, [{ duplicateSheet: { sourceSheetId: src.sheetId, insertSheetIndex: M.varaqlar.length + ochir.length, newSheetName: 'zz_sinov_' + varaq } }], KEY);
    ochir.push(j.replies[0].duplicateSheet.properties.sheetId); await G.gid(ID, 'zz_sinov_' + varaq, KEY, true); return 'zz_sinov_' + varaq; };
  const s = v => String(v == null ? '' : v);
  try {
    if (!M.varaqlar.some(v => v.title === IM.IMZ_VARAQ)) { console.log('06l_Imzosiz_sorovlar varag\'i yo\'q (eski tizim birinchi so\'rovda o\'zi ochadi) — solishtirib bo\'lmaydi.'); return; }
    console.log('\n=== ✕ IMZOLANMAGAN IJARA — SO\'ROV (06l_Imzosiz_sorovlar) ===');
    const n06l = await nusxala(IM.IMZ_VARAQ);
    const R = await IM.imzSorovlarYangi(n06l);
    const es = R.L[R.L.length - 1];
    const t0 = Date.now();
    const w = await IM.imzSorovYoz(n06l, R, { no: 'IJ-27/1', fish: 'SINOV MIJOZ', dokon: 'B1-1-1', kim: 'SINOV XODIM', sabab: 'SINOV — nusxa varaq, o\'chiriladi' });
    console.log('Yozish: ' + (Date.now() - t0) + ' ms · ID ' + w.id + ', qator ' + w.qator + (es ? ' · eski tizim yozgan qator ' + es.qator + ' (' + es.holati + ')' : ' · eski so\'rov yo\'q'));
    if (es) x += await qatorSolishtir(n06l, w.qator, 1, 11, '— So\'rov qatori (A–K)', es.qator); else console.log('  (06l bo\'sh — solishtirilmadi)');
    const ea = R.L.filter(z => z.holati !== 'Kutilmoqda').pop();
    await IM.imzJavobYoz(n06l, { qator: w.qator }, 'Rad etildi', 'SINOV — nusxa varaq', 'SINOV DIREKTOR');
    if (ea) { const [a, b] = await Promise.all([G.kataklarOqi(ID, n06l, 'A' + ea.qator + ':K' + ea.qator, KEY), G.kataklarOqi(ID, n06l, 'A' + w.qator + ':K' + w.qator, KEY)]);
      x += solishtir(a[0] || [], b[0] || [], [8, 9, 10, 11], '— Javob kataklari (H Holati, I Javob, J Javob_vaqt, K Javob_kim) — eski tizim javob yozgan qator ' + ea.qator); }
    else console.log('  (eski tizim javob yozgan so\'rov yo\'q — javob kataklari solishtirilmadi)');

    console.log('\n=== ✕ BEKOR QILISH (04 C, D, W + 06j_Tahrir_jurnali) ===');
    const n04 = await nusxala(IM.S4_V), n06j = await nusxala(IM.JUR_V);
    const X4 = await G.oraliqOqi(ID, n04, 'A2:X', KEY);
    let eb = -1, ak = -1; X4.forEach((r, i) => { if (/Imzolanmagan, kuchga kirmagan/.test(s(r[22]))) eb = i; if (s(r[2]).trim() === 'Aktiv') ak = i; });
    if (ak < 0) { console.log('04 da «Aktiv» ijara yo\'q — bekor yozuvi sinalmadi.'); x++; }
    else {
      const r = X4[ak];
      const xx = { qator: ak + 2, no: s(r[0]).trim(), dokon: s(r[4]).trim(), mid: s(r[5]).trim(), fish: s(r[23]).trim(), masul: '' };
      const t1 = Date.now();
      const ogoh = await IM.imzBekorQil({ fish: 'SINOV DIREKTOR' }, xx, 'SINOV sabab', 'SINOV — nusxa varaq', { s4: n04, jurnal: n06j });
      console.log('Yozish: ' + (Date.now() - t1) + ' ms · 04 qator ' + xx.qator + ' (' + xx.no + ')' + (eb >= 0 ? ' · eski tizim bekor qilgan qator ' + (eb + 2) : '') + (ogoh.length ? ' · ogoh: ' + ogoh.join(' ') : ''));
      const [a, b] = await Promise.all([eb >= 0 ? G.kataklarOqi(ID, n04, 'A' + (eb + 2) + ':X' + (eb + 2), KEY) : Promise.resolve([[]]), G.kataklarOqi(ID, n04, 'A' + xx.qator + ':X' + xx.qator, KEY)]);
      if (eb >= 0) x += solishtir(a[0] || [], b[0] || [], [3, 4, 23], '— 04 kataklari (C Holati, D Sana, W Izoh)');
      else { const y = b[0] || []; console.log('  server yozdi: C ' + tur(y[2]) + ' · D ' + tur(y[3]) + ' ' + fmt(y[3]) + ' · W ' + tur(y[22]) + ' (eski tizim bekor qilgan imzolanmagan ijara yo\'q — solishtirilmadi)'); }
      const A = await G.ustunOqi(ID, n06j, 'A', KEY);
      x += await qatorSolishtir(n06j, A.length, 1, 10, '— 06j jurnal qatori (A–J)');
    }
  } finally {
    if (ochir.length) await G.soralar(ID, ochir.map(g => ({ deleteSheet: { sheetId: g } })), KEY).catch(e => console.log('Nusxani o\'chirib bo\'lmadi: ' + e.message));
    console.log('\nNusxa varaqlar o\'chirildi.');
  }
  console.log('');
  if (!x && k15) { await redis.set('yozuv_yondi:imzosiz', '1'); await redis.set('yozuv_yondi:imzosiz_bekor', '1'); console.log('✅ HAMMASI BIR XIL — ✕ imzolanmagan ijara: xodim so\'rovi, direktor javobi (✅ bekor / ✖ rad) va direktorning darhol bekor qilishi (ijaraImzosizBekor — o\'sha yozuvlar) endi server orqali (Telegram — eski tizim ko\'prigi). Qaytarish: aks-yozuv-sinov ochir'); }
  else console.log('⚠ ' + (x ? x + ' ta farq' : 'Koprik 1.5 emas') + ' — YOQILMADI (eski tizim orqali ishlayveradi).');
}

// 📮 KIRIM XAT (Devon.gs devonKirimSaqla): 11_Devonxona nusxasida server yo'li bilan «soxta» kirim xat qatori (devonYoz) va tarix (devonTarix) — eski tizim yozgan
// oxirgi kirim xat qatori bilan (qiymat turi, format); skan Drive'ga — Koprik v1.12 koprikDevonSaqla bilan SINOV fayl «08 DEVONXONA / Kirim / <yil>» ga, robot o'qiydi, savatga.
// Telegram sinalmaydi. Haqiqiy varaqlarga tegilmaydi.
async function devonSinov() {
  const DV = require('../api/devon_yoz')._ichki;
  const adm = (await pool.query('SELECT kirish_kodi, huquqlar FROM v_xodimlar WHERE kompaniya_id = 1')).rows.find(z => (z.huquqlar || []).includes('admin') && String(z.kirish_kodi || '').length >= 8);
  let ver = '?'; try { ver = String(await koprik.chaqir('koprikVersiya', adm.kirish_kodi, [])); } catch (e) { ver = 'xato: ' + e.message; }
  const k112 = verOk(ver, '1.12') && !/^xato/.test(ver);
  console.log('Eski tizim ko\'prigi: v' + ver + (k112 ? ' ✅' : ' ⚠ (1.12 kerak — Drive va Telegram)'));
  const M = await G.varaqlar(ID, KEY);
  const ochir = []; let x = 0;
  const nusxala = async varaq => { const src = M.varaqlar.find(v => v.title === varaq); if (!src) throw new Error('Varaq topilmadi: ' + varaq);
    const j = await G.soralar(ID, [{ duplicateSheet: { sourceSheetId: src.sheetId, insertSheetIndex: M.varaqlar.length + ochir.length, newSheetName: 'zz_sinov_' + varaq } }], KEY);
    ochir.push(j.replies[0].duplicateSheet.properties.sheetId); await G.gid(ID, 'zz_sinov_' + varaq, KEY, true); return 'zz_sinov_' + varaq; };
  try {
    if (!M.varaqlar.some(v => v.title === DV.DEVON_V)) { console.log('11_Devonxona varag\'i yo\'q — solishtirib bo\'lmaydi.'); return; }
    console.log('\n=== 📮 KIRIM XAT — 11_Devonxona qatori va tarix ===');
    const n11 = await nusxala(DV.DEVON_V);
    const R = await DV.devonRowsYangi(n11);
    const es = R.L.filter(z => z.turi === 'Kirim').pop();
    const t0 = Date.now();
    const bugun = V.bugun().split('-').reverse().join('.');
    const w = await DV.devonYoz(n11, R, { turi: 'Kirim', tartib: R.L.filter(z => z.turi === 'Kirim').reduce((m, z) => Math.max(m, Number(z.tartib) || 0), 0) + 1, kim: 'SINOV XODIM', tashkilot: 'SINOV TASHKILOT', raqam: '01-SINOV', sana: bugun, mazmun: 'SINOV — nusxa varaq, o\'chiriladi', fayl: 'SINOV', holati: 'Rezolyutsiya kutmoqda' });
    await DV.devonTarix(n11, w, 'Telegram: direktorga yuborildi (shaxsan, skan bilan)');
    console.log('Yozish: ' + (Date.now() - t0) + ' ms · ID ' + w.id + ', kirim №' + w.tartib + ', qator ' + w.qator + (es ? ' · eski tizim yozgan kirim xat qatori ' + es.qator + ' (№' + es.tartib + ', ' + es.holati + ')' : ' · eski kirim xat yo\'q'));
    if (es) x += await qatorSolishtir(n11, w.qator, 1, 20, '— Kirim xat qatori (A–T; S — tarix 2 qator)', es.qator); else console.log('  (11_Devonxona da kirim xat yo\'q — solishtirilmadi)');
    // «direktor ko'rdi» (devonKordi_): R — Ijro JSON ga kordi, S — tarix; eski tizim belgilagan kirim xat qatori bilan
    console.log('\n=== 📮 DIREKTOR KO\'RDI — R (Ijro JSON) va S (tarix) ===');
    const ek = R.L.filter(z => z.turi === 'Kirim' && /"kordi"/.test(z.ijro)).pop();
    const w2 = (await DV.devonRowsYangi(n11)).L.find(z => String(z.id) === String(w.id));
    const kv = await DV.devonKordiYoz(n11, w2, 'SINOV DIREKTOR');
    const yk = (await DV.devonRowsYangi(n11)).L.find(z => String(z.id) === String(w.id));
    let jk = null; try { jk = JSON.parse(yk.ijro); } catch (e) { }
    const jOk = !!(jk && jk.kordi && jk.kordi.v === kv && jk.kordi.fish === 'SINOV DIREKTOR' && Object.keys(jk).join(',') === 'kordi');
    console.log('  server yozdi: R = ' + qisqa(yk.ijro, 80) + ' · ' + (jOk ? '✅ JSON to\'g\'ri' : '✖ JSON noto\'g\'ri')); if (!jOk) x++;
    if (!/direktor ko'rdi \(SINOV DIREKTOR\)$/.test(yk.tarix)) { x++; console.log('  ✖ tarix oxiri: ' + qisqa(yk.tarix, 80)); }
    if (ek) { let je = null; try { je = JSON.parse(ek.ijro); } catch (e) { }
      const shakl = z => z && z.kordi ? Object.keys(z.kordi).join(',') + '|' + (/^\d{2}\.\d{2}\.\d{4} \d{2}:\d{2}$/.test(z.kordi.v) ? 'dd.MM.yyyy HH:mm' : z.kordi.v) : '—';
      if (shakl(je) !== shakl(jk)) { x++; console.log('  ✖ kordi shakli: eski ' + shakl(je) + ' | server ' + shakl(jk)); } else console.log('  ✅ kordi shakli eski tizim belgilagan xat (№' + ek.tartib + ') bilan bir xil: {' + shakl(jk) + '}');
      const [a, b] = await Promise.all([G.kataklarOqi(ID, n11, 'A' + ek.qator + ':T' + ek.qator, KEY), G.kataklarOqi(ID, n11, 'A' + w.qator + ':T' + w.qator, KEY)]);
      x += solishtir(a[0] || [], b[0] || [], [18, 19], '— R Ijro, S Tarix (eski qator ' + ek.qator + ')'); }
    else console.log('  (eski tizim «ko\'rdi» belgilagan kirim xat yo\'q — shakli solishtirilmadi)');
    console.log('\n=== 📮 SKAN → Drive (Koprik v1.12 koprikDevonSaqla) ===');
    if (!k112) { console.log('  ⚠ Koprik 1.12 emas — Drive sinalmadi.'); x++; }
    else {
      const PDF0 = Buffer.from('%PDF-1.4\n' + '% SINOV — AKS TIZIM server sinovi, o\'chiriladi\n'.repeat(40) + '%%EOF\n');
      const t1 = Date.now();
      const f = await koprik.chaqir('koprikDevonSaqla', adm.kirish_kodi, [{ qism: 'Kirim', nom: 'SINOV_server_' + Date.now().toString(36), b64: PDF0.toString('base64') }], { muddat: 120000, urinish: 1 });
      if (!f || !f.id) { console.log('  ✖ Drive ID qaytmadi'); x++; }
      else {
        console.log('  fayl Drive\'ga qo\'yildi: ' + f.id + ' (' + (Date.now() - t1) + ' ms)');
        let o = null; try { o = await G.driveFayl(f.id, KEY); } catch (e) { console.log('  ✖ robot o\'qiy olmadi: ' + e.message); x++; }
        if (o) { const bir = Buffer.compare(o.bytes, PDF0) === 0; console.log('  ' + (bir ? '✅' : '✖') + ' robot o\'qidi: ' + o.nom + ', ' + o.bytes.length + ' bayt' + (bir ? ' — bir xil' : ' — FARQ')); if (!bir) x++; }
        await koprik.chaqir('koprikDevonSaqla', adm.kirish_kodi, [{ eski: f.id }]).then(() => console.log('  SINOV fayl savatga tashlandi.')).catch(e => console.log('  ⚠ SINOV faylni savatga tashlab bo\'lmadi: ' + e.message));
      }
    }
  } finally {
    if (ochir.length) await G.soralar(ID, ochir.map(g => ({ deleteSheet: { sheetId: g } })), KEY).catch(e => console.log('Nusxani o\'chirib bo\'lmadi: ' + e.message));
    console.log('\nNusxa varaqlar o\'chirildi.');
  }
  console.log('');
  if (!x && k112) { await redis.set('yozuv_yondi:devon', '1'); await redis.set('yozuv_yondi:devon_kordi', '1'); console.log('✅ HAMMASI BIR XIL — 📮 kirim xatni saqlash va «direktor ko\'rdi» belgisi endi server orqali (skan Drive\'ga va direktorga Telegram — eski tizim ko\'prigi). Qaytarish: aks-yozuv-sinov ochir'); }
  else console.log('⚠ ' + (x ? x + ' ta farq' : 'Koprik 1.12 emas') + ' — YOQILMADI (eski tizim orqali ishlayveradi).');
}

// Word (.docx) → xatboshilar matni (bo'shlarsiz; jadval kataklari ham) — Google eksporti bilan server nusxasini matn bo'yicha solishtirish
function docxMatnlar(buf) {
  const Z = XL.zipOqi(buf); const d = String(Z['word/document.xml'] || '');
  const un = v => v.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, '\'');
  return [...d.matchAll(/<w:p[ >][\s\S]*?<\/w:p>/g)].map(m => [...m[0].matchAll(/<w:t(?: [^>]*)?>([^<]*)<\/w:t>/g)].map(z => un(z[1])).join('').replace(/\s+/g, ' ').trim()).filter(Boolean);
}
// 🤝 KELISHUV BILAN BEKOR (KelishuvBekor.gs kbTayyorla): (1) 06m dagi oxirgi so'rov hujjati serverda qayta yasaladi — eski tizim Drive'ga qo'ygan PDF bilan so'zma-so'z,
// Word — Google Doc eksporti bilan matn bo'yicha (bayt-ma-bayt — ma'lumot uchun); (2) 06m nusxasida yangi so'rov qatori va qayta tayyorlash kataklari — eski
// yozgan qator bilan (qiymat turi, format); (3) Drive — Koprik v1.12 koprikKbSaqla bilan SINOV fayllar «07 BEKOR QILISH / Kelishuv / <yil>» ga, robot o'qiydi, savatga.
async function kbSinov() {
  const KBH = require('../lib/kb_hujjat'), KB = require('../api/kb_yoz')._ichki, s = v => String(v == null ? '' : v);
  const DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  if (!(await PDF.bor())) { console.log('⏳ PDF dasturi (Chromium) hali tayyor emas — 3 daqiqadan keyin qayta ishga tushiring.'); return; }
  try { execFileSync('pdftotext', ['-v'], { stdio: 'ignore' }); } catch (e) { console.log('⚠ pdftotext yo\'q (poppler-utils) — solishtirib bo\'lmaydi.'); return; }
  const adm = (await pool.query('SELECT kirish_kodi, huquqlar FROM v_xodimlar WHERE kompaniya_id = 1')).rows.find(z => (z.huquqlar || []).includes('admin') && String(z.kirish_kodi || '').length >= 8);
  let ver = '?'; try { ver = String(await koprik.chaqir('koprikVersiya', adm.kirish_kodi, [])); } catch (e) { ver = 'xato: ' + e.message; }
  const k112 = verOk(ver, '1.12') && !/^xato/.test(ver);
  console.log('Eski tizim ko\'prigi: v' + ver + (k112 ? ' ✅' : ' ⚠ (1.12 kerak — Drive)'));
  const M = await G.varaqlar(ID, KEY);
  let x = 0;
  if (!M.varaqlar.some(v => v.title === KBH.KB_VARAQ)) { console.log('06m_Kelishuv_bekor varag\'i yo\'q (eski tizim birinchi so\'rovda o\'zi ochadi) — solishtirib bo\'lmaydi.'); return; }
  // (1) hujjat
  console.log('\n=== 🤝 KELISHUV + DALOLATNOMA — eski tizim yasagan hujjat bilan ===');
  const rows = await KBH.kbRowsKozgu();
  const es = rows.filter(z => z.pdf && !/^SRV:/.test(z.pdf)).pop();
  if (!es) { console.log('  ⚠ 06m da eski tizim yasagan hujjatli so\'rov yo\'q — avval eski tizimda bitta kelishuv tayyorlang (📎 Hujjatlar → ijara shartnomasi → 🤝 O\'zaro kelishuv), keyin sinovni qayta ishga tushiring.'); x++; }
  else {
    console.log('Namuna: so\'rov KB-' + es.id + ' (' + es.no + ', ' + es.fish + ', ' + es.dokon + ') · ' + es.vaqt + ' · ' + es.kim + ' · ' + es.holati);
    let xx = null; try { xx = await KBH.kbTekshir(es.no, es.id, rows, { tekshirma: true }); } catch (e) { console.log('  ✖ ' + e.message); x++; }
    if (xx) {
      const adminmi = (await V.qatorlar('07_Xodimlar')).map(z => z.x).some(z => s(z[1]).trim() === s(es.kim).trim() && /(^|,)\s*admin\s*(,|$)/.test(s(z[18])));
      const sanaIso = es.sana.split('.').reverse().join('-');
      const D = { sabab: es.sabab, sana: sanaIso, qarz: es.qarz === 'Йўқ' ? 0 : Number(es.qarz) || 0, kalit: Number(es.kalit) || 0, hisob: KBH.kbLotin(es.hisob), holat: es.holat === 'Соз' ? 'soz' : 'kamchilik',
        izoh: KBH.kbLotin(es.izoh).replace(/[.;,\s]+$/, ''), xodim: adminmi ? '' : await KBH.kbXodimIsm(es.kim) };
      const t0 = Date.now();
      const f = await KBH.kbHujjat(xx, D);
      console.log('  server: ' + f.bet + ' bet · ' + ((Date.now() - t0) / 1000).toFixed(1) + ' s' + (xx.ogoh.length ? ' · ma\'lumot: ' + xx.ogoh.join(' ') : ''));
      let eskiB = null; try { eskiB = (await G.driveFayl(es.pdf, KEY)).bytes; } catch (e) { console.log('  ✖ robot eski PDF ni o\'qiy olmadi: ' + e.message); x++; }
      try { const fs = require('fs'), pth = require('path'), d = pth.join(env.hujjatPapka || '/opt/aks/hujjat', 'sinov'); fs.mkdirSync(d, { recursive: true });   // solishtirish uchun nusxalar
        fs.writeFileSync(pth.join(d, 'kb_server.pdf'), f.pdf); fs.writeFileSync(pth.join(d, 'kb_server.docx'), f.docx); if (eskiB) fs.writeFileSync(pth.join(d, 'kb_eski.pdf'), eskiB);
        console.log('  nusxalar: ' + d + '/kb_eski.pdf, kb_server.pdf, kb_server.docx'); } catch (e) { }
      if (eskiB) {
        x += pdfSolishtir(eskiB, f.pdf);
        const q = sozSolishtir(eskiB, f.pdf);
        if (q.sozlar[0] !== q.sozlar[1] || q.betlar[0] !== q.betlar[1] || q.farq) { x++; console.log('  ✖ so\'zlar joyi: eski ' + q.sozlar[0] + ' / server ' + q.sozlar[1] + ' so\'z, betlar ' + q.betlar.join('/') + ', ' + q.farq + ' ta farq, eng katta og\'ish ' + q.dmax.toFixed(2) + ' pt'); q.ch.forEach(c => console.log('     ' + c)); }
        else console.log('  ✅ ' + q.sozlar[0] + ' so\'zning joyi bir xil (eng katta og\'ish ' + q.dmax.toFixed(2) + ' pt)');
      }
      if (es.doc && !/^SRV:/.test(es.doc)) {
        let eskiD = null; try { eskiD = await G.driveEksport(es.doc, DOCX, KEY); } catch (e) { console.log('  ⚠ Google Doc eksporti o\'qilmadi (Word solishtirilmadi): ' + e.message); }
        if (eskiD) {
          const A = docxMatnlar(eskiD), B = docxMatnlar(f.docx);
          let k = -1; for (let i = 0; i < Math.max(A.length, B.length); i++) if (A[i] !== B[i]) { k = i; break; }
          if (k < 0) console.log('  ✅ Word: ' + A.length + ' xatboshi matni Google Doc eksporti bilan bir xil');
          else { x++; console.log('  ✖ Word matni farq qiladi (xatboshi ' + (k + 1) + ' / eski ' + A.length + ', server ' + B.length + '): eski «' + qisqa(A[k], 70) + '» | server «' + qisqa(B[k], 70) + '»'); }
          await zipQismlar('Word (bayt-ma-bayt, ma\'lumot uchun)', eskiD, f.docx, false).then(z => { if (z) { const dA = String(XL.zipOqi(eskiD)['word/document.xml'] || ''), dB = String(XL.zipOqi(f.docx)['word/document.xml'] || ''); let i = 0; while (i < dA.length && dA[i] === dB[i]) i++; console.log('     document.xml birinchi farq ' + i + '-belgida: eski «' + dA.slice(Math.max(0, i - 40), i + 80).replace(/\s+/g, ' ') + '» | server «' + dB.slice(Math.max(0, i - 40), i + 80).replace(/\s+/g, ' ') + '»'); } });
        }
      }
    }
  }
  // (2) 06m qatori — nusxa varaqda
  const ochir = [];
  const nusxala = async varaq => { const src = M.varaqlar.find(v => v.title === varaq); if (!src) throw new Error('Varaq topilmadi: ' + varaq);
    const j = await G.soralar(ID, [{ duplicateSheet: { sourceSheetId: src.sheetId, insertSheetIndex: M.varaqlar.length + ochir.length, newSheetName: 'zz_sinov_' + varaq } }], KEY);
    ochir.push(j.replies[0].duplicateSheet.properties.sheetId); await G.gid(ID, 'zz_sinov_' + varaq, KEY, true); return 'zz_sinov_' + varaq; };
  try {
    console.log('\n=== 🤝 06m_Kelishuv_bekor qatori (nusxa varaqda) ===');
    const n06m = await nusxala(KBH.KB_VARAQ);
    const R = await KB.kbRowsYangi(n06m);
    const eq = R.L[R.L.length - 1];
    const qarzV = eq && eq.qarz && eq.qarz !== 'Йўқ' ? 150000 : 'Йўқ';   // H ustuni turi eski qatordagidek (son yoki «Йўқ» matni)
    const qator = ['IJ-27/1', 'SINOV MIJOZ', 'B1-1-1', 'SINOV — nusxa varaq, o\'chiriladi', V.bugun().split('-').reverse().join('.'), qarzV, '2', '12345', 'Соз', ''];
    const t1 = Date.now();
    const w = await KB.kbSorovYoz(n06m, R, { qator, pdfId: 'SRV:kb/sinov.pdf', docId: 'SRV:kb/sinov.docx', kim: 'SINOV XODIM' });
    console.log('Yozish: ' + (Date.now() - t1) + ' ms · ID ' + w.id + ', qator ' + w.qator + (eq ? ' · eski tizim yozgan qator ' + eq.qator + ' (KB-' + eq.id + ', ' + eq.holati + ')' : ''));
    if (eq) x += await qatorSolishtir(n06m, w.qator, 1, 24, '— So\'rov qatori (A–X)', eq.qator); else console.log('  (06m bo\'sh — solishtirilmadi)');
    await KB.kbQaytaYoz(n06m, { qator: w.qator, skan: '' }, { qator: qator.slice(0, 7).concat(['12346', 'Камчиликлар бор', 'SINOV izoh']), pdfId: 'SRV:kb/sinov2.pdf', docId: 'SRV:kb/sinov2.docx' }, 'SINOV XODIM');
    if (eq) { const [a, b] = await Promise.all([G.kataklarOqi(ID, n06m, 'A' + eq.qator + ':X' + eq.qator, KEY), G.kataklarOqi(ID, n06m, 'A' + w.qator + ':X' + w.qator, KEY)]);
      x += solishtir(a[0] || [], b[0] || [], [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 23], '— Qayta tayyorlash kataklari (C–O, W tarix)'); }
  } finally {
    if (ochir.length) await G.soralar(ID, ochir.map(g => ({ deleteSheet: { sheetId: g } })), KEY).catch(e => console.log('Nusxani o\'chirib bo\'lmadi: ' + e.message));
    console.log('\nNusxa varaqlar o\'chirildi.');
  }
  // (3) Drive
  console.log('\n=== 🤝 Hujjatlar → Drive (Koprik v1.12 koprikKbSaqla) ===');
  if (!k112) { console.log('  ⚠ Koprik 1.12 emas — Drive sinalmadi.'); x++; }
  else {
    const P0 = Buffer.from('%PDF-1.4\n' + '% SINOV — AKS TIZIM server sinovi, o\'chiriladi\n'.repeat(40) + '%%EOF\n'), D0 = XL.zipYasa([{ nom: 'sinov.txt', data: Buffer.from('SINOV') }]);
    const nom = 'Kelishuv_bekor_SINOV_' + Date.now().toString(36), t2 = Date.now();
    const r = await koprik.chaqir('koprikKbSaqla', adm.kirish_kodi, [{ yil: V.bugun().slice(0, 4), nom, pdfB64: P0.toString('base64'), docB64: D0.toString('base64'), eski: [] }], { muddat: 120000, urinish: 1 });
    if (!r || !r.pdf || !r.doc) { console.log('  ✖ Drive ID qaytmadi'); x++; }
    else {
      console.log('  fayllar Drive\'ga qo\'yildi: ' + r.pdf + ', ' + r.doc + ' (' + (Date.now() - t2) + ' ms)');
      let o = null; try { o = await G.driveFayl(r.pdf, KEY); } catch (e) { console.log('  ✖ robot o\'qiy olmadi: ' + e.message); x++; }
      if (o) { const bir = Buffer.compare(o.bytes, P0) === 0; console.log('  ' + (bir ? '✅' : '✖') + ' robot o\'qidi: ' + o.nom + ', ' + o.bytes.length + ' bayt' + (bir ? ' — bir xil' : ' — FARQ')); if (!bir) x++; }
      await koprik.chaqir('koprikKbSaqla', adm.kirish_kodi, [{ eski: [r.pdf, r.doc] }]).then(() => console.log('  SINOV fayllar savatga tashlandi.')).catch(e => console.log('  ⚠ SINOV fayllarni savatga tashlab bo\'lmadi: ' + e.message));
    }
  }
  console.log('');
  if (!x && k112) { await redis.set('yozuv_yondi:kb', '1'); console.log('✅ HAMMASI BIR XIL — 🤝 kelishuv + dalolatnoma endi serverda yasaladi (PDF va Word darhol; Drive nusxasi — fonda eski tizim). Skan yuklash, so\'rovni bekor qilish va direktor tasdig\'i hozircha eski tizimda. Qaytarish: aks-yozuv-sinov ochir'); }
  else console.log('⚠ ' + (x ? x + ' ta farq' : 'Koprik 1.12 emas') + ' — YOQILMADI (eski tizim orqali ishlayveradi).');
}

// 🤝 KELISHUV — SKAN / BEKOR / TASDIQ (KelishuvBekor.gs kbSkan, kbBekor, kbTasdiq): 06m nusxasida soxta so'rov qatoriga skan kataklari (M, P:R, T:V, X), rad va tasdiq
// javobi (M, T:V, W), bekor (M, W) — eski tizim yozgan shunday qatorlar bilan; 04 nusxasida «Aktiv» ijaraga C/D/W + 06j nusxasida jurnal qatori — eski kelishuv bilan bekor
// qilingan qator bilan (bo'lsa); skan Drive'ga — Koprik v1.13 koprikKbSaqla skan rejimi (SINOV fayl, robot o'qiydi, savatga). Telegram va 06d (hujjat_yoz) sinalmaydi.
async function kb2Sinov() {
  const KBH = require('../lib/kb_hujjat'), KB = require('../api/kb_yoz')._ichki, s = v => String(v == null ? '' : v);
  const adm = (await pool.query('SELECT kirish_kodi, huquqlar FROM v_xodimlar WHERE kompaniya_id = 1')).rows.find(z => (z.huquqlar || []).includes('admin') && String(z.kirish_kodi || '').length >= 8);
  let ver = '?'; try { ver = String(await koprik.chaqir('koprikVersiya', adm.kirish_kodi, [])); } catch (e) { ver = 'xato: ' + e.message; }
  const k113 = verOk(ver, '1.13') && !/^xato/.test(ver);
  console.log('Eski tizim ko\'prigi: v' + ver + (k113 ? ' ✅' : ' ⚠ (1.13 kerak — skan Drive\'ga)'));
  const M = await G.varaqlar(ID, KEY);
  const ochir = []; let x = 0;
  const nusxala = async varaq => { const src = M.varaqlar.find(v => v.title === varaq); if (!src) throw new Error('Varaq topilmadi: ' + varaq);
    const j = await G.soralar(ID, [{ duplicateSheet: { sourceSheetId: src.sheetId, insertSheetIndex: M.varaqlar.length + ochir.length, newSheetName: 'zz_sinov_' + varaq } }], KEY);
    ochir.push(j.replies[0].duplicateSheet.properties.sheetId); await G.gid(ID, 'zz_sinov_' + varaq, KEY, true); return 'zz_sinov_' + varaq; };
  const ikki = async (nusxa, eq, w, ust, sarl) => { if (!eq) { console.log('  (' + sarl + ' — eski tizim yozgan namuna qator yo\'q, solishtirilmadi)'); return 0; }
    const [a, b] = await Promise.all([G.kataklarOqi(ID, nusxa, 'A' + eq.qator + ':X' + eq.qator, KEY), G.kataklarOqi(ID, nusxa, 'A' + w.qator + ':X' + w.qator, KEY)]);
    return solishtir(a[0] || [], b[0] || [], ust, '— ' + sarl + ' (eski qator ' + eq.qator + ', KB-' + eq.id + ' ' + eq.holati + ')'); };
  try {
    if (!M.varaqlar.some(v => v.title === KBH.KB_VARAQ)) { console.log('06m_Kelishuv_bekor varag\'i yo\'q — solishtirib bo\'lmaydi.'); return; }
    console.log('\n=== 🤝 SKAN / BEKOR / TASDIQ — 06m_Kelishuv_bekor kataklari (nusxa varaqda) ===');
    const n06m = await nusxala(KBH.KB_VARAQ);
    const R = await KB.kbRowsYangi(n06m);
    const eSkan = R.L.filter(z => z.skan).pop(), eBek = R.L.filter(z => z.holati === 'Bekor').pop(), eTas = R.L.filter(z => z.holati === 'Tasdiqlandi').pop(), eRad = R.L.filter(z => z.holati === 'Rad etildi').pop();
    console.log('Namunalar: skan ' + (eSkan ? 'KB-' + eSkan.id : '—') + ' · rad ' + (eRad ? 'KB-' + eRad.id : '—') + ' · tasdiq ' + (eTas ? 'KB-' + eTas.id : '—') + ' · bekor ' + (eBek ? 'KB-' + eBek.id : '—'));
    const w = await KB.kbSorovYoz(n06m, R, { qator: ['IJ-27/1', 'SINOV MIJOZ', 'B1-1-1', 'SINOV — nusxa varaq, o\'chiriladi', V.bugun().split('-').reverse().join('.'), 'Йўқ', '2', '12345', 'Соз', ''], pdfId: 'SRV:kb/sinov.pdf', docId: 'SRV:kb/sinov.docx', kim: 'SINOV XODIM' });
    const sr = { qator: w.qator, id: w.id, skan: '' };
    const t0 = Date.now();
    await KB.kbSkanYoz(n06m, sr, 'SRV:kb/sinov_skan.pdf', 'SINOV XODIM', 3);
    console.log('Skan kataklari: ' + (Date.now() - t0) + ' ms · qator ' + w.qator);
    x += await ikki(n06m, eSkan, w, [13, 16, 17, 18, 20, 21, 22, 24], 'skan: M holati, P:R skan/vaqt/kim, T:V tozalangan, X sahifa');
    await KB.kbJavobYoz(n06m, sr, 'Rad etildi', 'SINOV — rad sababi', 'SINOV DIREKTOR', 'rad etildi — SINOV — rad sababi');
    x += await ikki(n06m, eRad, w, [13, 20, 21, 22, 23], 'rad: M, T:V javob, W tarix');
    await KB.kbJavobYoz(n06m, sr, 'Tasdiqlandi', '', 'SINOV DIREKTOR', 'tasdiqlandi — shartnoma bekor qilindi');
    x += await ikki(n06m, eTas, w, [13, 20, 21, 22, 23], 'tasdiq: M, T:V javob, W tarix');
    await KB.kbBekorYoz(n06m, sr, 'SINOV XODIM', 'SINOV sabab');
    x += await ikki(n06m, eBek, w, [13, 23], 'bekor: M, W tarix');
    if (!eSkan && !eRad && !eTas && !eBek) { const b = (await G.kataklarOqi(ID, n06m, 'A' + w.qator + ':X' + w.qator, KEY))[0] || [];
      console.log('  server yozdi: M ' + tur(b[12]) + ' «' + qisqa(b[12] && b[12].formattedValue, 16) + '» · P ' + tur(b[15]) + ' · Q ' + tur(b[16]) + ' ' + fmt(b[16]) + ' · X ' + tur(b[23]) + ' ' + fmt(b[23]) + ' · W ' + tur(b[22]) + ' (06m da eski namuna qatorlar yo\'q — solishtirilmadi)'); }

    console.log('\n=== 🤝 TASDIQ ✅ — 04 (C, D, W) + 06j_Tahrir_jurnali (nusxa varaqlarda) ===');
    const n04 = await nusxala('04_Ijara_shartnomalar'), n06j = await nusxala('06j_Tahrir_jurnali');
    const X4 = await G.oraliqOqi(ID, n04, 'A2:X', KEY);
    let eb = -1, ak = -1; X4.forEach((r, i) => { if (/Ўзаро келишув билан/.test(s(r[22]))) eb = i; if (s(r[2]).trim() === 'Aktiv') ak = i; });
    if (ak < 0) { console.log('04 da «Aktiv» ijara yo\'q — bekor yozuvi sinalmadi.'); x++; }
    else {
      const r = X4[ak];
      const xx = { qator: ak + 2, no: s(r[0]).trim(), dokon: s(r[4]).trim(), mid: s(r[5]).trim(), fish: s(r[23]).trim() };
      const srF = { id: w.id, sana: V.bugun().split('-').reverse().join('.'), kim: 'SINOV XODIM', sabab: 'SINOV sabab' };
      const t1 = Date.now();
      const ogoh = await KB.kbBekorQil({ fish: 'SINOV DIREKTOR' }, xx, srF, { s4: n04, jurnal: n06j });
      console.log('Yozish: ' + (Date.now() - t1) + ' ms · 04 qator ' + xx.qator + ' (' + xx.no + ')' + (eb >= 0 ? ' · eski tizim kelishuv bilan bekor qilgan qator ' + (eb + 2) : '') + (ogoh.length ? ' · ogoh: ' + ogoh.join(' ') : ''));
      const [a, b] = await Promise.all([eb >= 0 ? G.kataklarOqi(ID, n04, 'A' + (eb + 2) + ':X' + (eb + 2), KEY) : Promise.resolve([[]]), G.kataklarOqi(ID, n04, 'A' + xx.qator + ':X' + xx.qator, KEY)]);
      if (eb >= 0) x += solishtir(a[0] || [], b[0] || [], [3, 4, 23], '— 04 kataklari (C Holati, D Bekor sanasi, W Izoh)');
      else { const y = b[0] || []; console.log('  server yozdi: C ' + tur(y[2]) + ' · D ' + tur(y[3]) + ' ' + fmt(y[3]) + ' · W ' + tur(y[22]) + ' (eski tizim kelishuv bilan bekor qilgan ijara yo\'q — solishtirilmadi; imzosiz sinovida D «son DATE dd.MM.yyyy» tasdiqlangan)'); }
      const A = await G.ustunOqi(ID, n06j, 'A', KEY);
      x += await qatorSolishtir(n06j, A.length, 1, 10, '— 06j jurnal qatori (A–J)');
    }
  } finally {
    if (ochir.length) await G.soralar(ID, ochir.map(g => ({ deleteSheet: { sheetId: g } })), KEY).catch(e => console.log('Nusxani o\'chirib bo\'lmadi: ' + e.message));
    console.log('\nNusxa varaqlar o\'chirildi.');
  }
  console.log('\n=== 🤝 Skan → Drive (Koprik v1.13 koprikKbSaqla skan) ===');
  if (!k113) { console.log('  ⚠ Koprik 1.13 emas — Drive sinalmadi.'); x++; }
  else {
    const P0 = Buffer.from('%PDF-1.4\n' + '% SINOV — AKS TIZIM server sinovi, o\'chiriladi\n'.repeat(40) + '%%EOF\n');
    const nom = 'KB-0_SINOV_imzolangan_' + Date.now().toString(36) + '.pdf', t2 = Date.now();
    const r = await koprik.chaqir('koprikKbSaqla', adm.kirish_kodi, [{ yil: V.bugun().slice(0, 4), skanNom: nom, skanB64: P0.toString('base64') }], { muddat: 120000, urinish: 1 });
    if (!r || !r.skan) { console.log('  ✖ Drive ID qaytmadi'); x++; }
    else {
      console.log('  fayl Drive\'ga qo\'yildi: ' + r.skan + ' (' + (Date.now() - t2) + ' ms)');
      let o = null; try { o = await G.driveFayl(r.skan, KEY); } catch (e) { console.log('  ✖ robot o\'qiy olmadi: ' + e.message); x++; }
      if (o) { const bir = Buffer.compare(o.bytes, P0) === 0; console.log('  ' + (bir ? '✅' : '✖') + ' robot o\'qidi: ' + o.nom + ', ' + o.bytes.length + ' bayt' + (bir ? ' — bir xil' : ' — FARQ')); if (!bir) x++; }
      await koprik.chaqir('koprikKbSaqla', adm.kirish_kodi, [{ eski: [r.skan] }]).then(() => console.log('  SINOV fayl savatga tashlandi.')).catch(e => console.log('  ⚠ SINOV faylni savatga tashlab bo\'lmadi: ' + e.message));
    }
  }
  console.log('');
  if (!x && k113) { await redis.set('yozuv_yondi:kb2', '1'); console.log('✅ HAMMASI BIR XIL — 🤝 kelishuv: skan yuklash, so\'rovni bekor qilish va direktor tasdig\'i/radi endi server orqali (skan Drive\'ga va Telegram — eski tizim ko\'prigi; tasdiqda skan 06d ga serverda). Qaytarish: aks-yozuv-sinov ochir'); }
  else console.log('⚠ ' + (x ? x + ' ta farq' : 'Koprik 1.13 emas') + ' — YOQILMADI (eski tizim orqali ishlayveradi).');
}

// 👁 KO'RISH REJIMI (Sifat.gs): direktor sessiyasi bilan bitta oddiy xodim nomidan o'qish — server (sifatidaYadro) va eski tizim (sifatida, ko'prik)
// javoblari: ism (fish) va javob kalitlari bir xil; yozuvchi amal (tolovSaqlash) ikkalasida ham rad; xodimning yashirin sessiyasi 07b ga yozilmaydi.
async function sifatSinov() {
  const SF = require('../api/sifat')._ichki, s = v => String(v == null ? '' : v);
  const X = (await pool.query("SELECT xodim_id, fish, kirish_kodi, huquqlar FROM v_xodimlar WHERE kompaniya_id = 1 AND holat = 'Ishlayapti' AND kirish_kodi <> '' ORDER BY qator_no")).rows;
  const adm = X.find(z => (z.huquqlar || []).includes('admin') && String(z.kirish_kodi || '').length >= 8);
  const xd = X.find(z => (z.huquqlar || []).length && !(z.huquqlar || []).includes('admin') && (z.huquqlar || []).includes('undiruv')) || X.find(z => (z.huquqlar || []).length && !(z.huquqlar || []).includes('admin'));
  if (!xd) { console.log('Oddiy (admin bo\'lmagan) xodim topilmadi.'); return; }
  const tok = await S.sessiyaOch(adm.kirish_kodi), ks = adm.kirish_kodi + '|' + tok;
  const u = await S.foydalanuvchi(ks);
  console.log('\n=== 👁 KO\'RISH REJIMI — ' + xd.fish + ' (ID ' + xd.xodim_id + ', ' + (xd.huquqlar || []).join(',') + ') ko\'zi bilan ===');
  let x = 0;
  const kalitlar = o => o && typeof o === 'object' && !Array.isArray(o) ? Object.keys(o).sort().join(',') : (Array.isArray(o) ? 'ro\'yxat[' + o.length + ']' : typeof o);
  try {
    for (const fn of ['xodimBosh', 'topMening', 'mijozQidir']) {
      const a = fn === 'mijozQidir' ? ['27/1'] : [];
      let e, y; const t0 = Date.now();
      try { e = await koprik.chaqir('sifatida', adm.kirish_kodi, [xd.xodim_id, fn, a], { muddat: 120000, urinish: 1 }); } catch (er) { console.log('  ' + fn + ': ✖ eski tizim: ' + er.message); x++; continue; }
      const te = Date.now() - t0, t1 = Date.now();
      try { y = await SF.sifatidaYadro(u, ks, xd.xodim_id, fn, a); } catch (er) { console.log('  ' + fn + ': ✖ server: ' + er.message); x++; continue; }
      const f = []; if (kalitlar(e) !== kalitlar(y)) f.push('kalitlar: eski {' + kalitlar(e) + '} server {' + kalitlar(y) + '}');
      if (e && y && e.fish !== undefined && s(e.fish) !== s(y.fish)) f.push('fish: eski «' + e.fish + '» server «' + y.fish + '»');
      if (y && y.fish !== undefined && s(y.fish) !== s(xd.fish)) f.push('server javobi xodim nomidan emas: «' + y.fish + '»');
      if (f.length) { x++; console.log('  ' + fn + ': ✖ ' + f.join('; ')); } else console.log('  ' + fn + ': ✅ bir xil (' + kalitlar(y) + ')' + (y && y.fish !== undefined ? ' · ' + y.fish : '') + ' · eski ' + (te / 1000).toFixed(1) + ' s, server ' + ((Date.now() - t1) / 1000).toFixed(1) + ' s');
    }
    // yozuvchi amal — rad
    let rad = ''; try { await SF.sifatidaYadro(u, ks, xd.xodim_id, 'tolovSaqlash', [{}]); } catch (er) { rad = er.message; }
    if (/Ko'rish rejimi: bu amal/.test(rad)) console.log('  tolovSaqlash: ✅ rad — «' + rad.slice(0, 70) + '…»'); else { x++; console.log('  tolovSaqlash: ✖ rad etilmadi: ' + (rad || 'xatosiz o\'tdi')); }
    // yashirin sessiya tokeni brauzerga chiqmaydi; 07b ga yozilmaydi — kirishYoz chaqirilmaydi (kod bo'yicha tekshiruv: sfses: kaliti bor, ses: bor)
    const sf = await redis.keys('sfses:' + tok + ':*'); console.log('  xodim sessiyasi: ' + (sf.length ? '✅ serverda yashirin (' + sf.length + ' ta), 07b ga yozilmaydi' : '⚠ ochilmagan'));
    if (!sf.length) x++;
  } finally { for (const k of await redis.keys('sfses:' + tok + ':*')) { const t2 = await redis.get(k); if (t2) await redis.del('ses:' + t2); await redis.del(k); } await redis.del('ses:' + tok); }
  console.log('');
  if (!x) { await redis.set('yozuv_yondi:sifat', '1'); console.log('✅ HAMMASI BIR XIL — 👁 «xodim ko\'zi bilan» endi yangi saytda ochiladi (havola, bilet, o\'qish — serverda; serverda yo\'q o\'qishlar — eski tizim). Qaytarish: aks-yozuv-sinov ochir'); }
  else console.log('⚠ ' + x + ' ta farq — YOQILMADI (havola avvalgidek eski saytga ochiladi).');
}

// 📮 DEVONXONA QOLGAN AMALLARI (Devon.gs v1.5): 11_Devonxona va 10_Topshiriqlar NUSXALARIDA server yadrolari (ishdagi kodning o'zi, quruq — Drive/Telegram yo'q)
// to'liq yo'lni bosib o'tadi: kirim xat → rezolyutsiya (2 ijrochi) → yordamchi qismi → asosiy topshirdi → qaytarildi → qayta topshirdi → qabul;
// 2-xat: rezolyutsiya → qaytarib olish; 3-xat: bekor; tayyor chiqim xat (qo'lma-qo'l); «Tayyorlandi» xat → yuborildi (pochta). Har bosqichda kataklar
// (K:T va 10 qatorlari) eski tizim yozgan o'xshash qatorlar bilan (qiymat turi, format), JSON (R) tuzilishi va tarix (S) naqshi tekshiriladi.
async function devon2Sinov() {
  const DV = require('../api/devon_yoz')._ichki, TPI = require('../api/topshiriq_yoz')._ichki;
  const adm = (await pool.query('SELECT kirish_kodi, huquqlar, fish FROM v_xodimlar WHERE kompaniya_id = 1')).rows.find(z => (z.huquqlar || []).includes('admin') && String(z.kirish_kodi || '').length >= 8);
  let ver = '?'; try { ver = String(await koprik.chaqir('koprikVersiya', adm.kirish_kodi, [])); } catch (e) { ver = 'xato: ' + e.message; }
  const k115 = verOk(ver, '1.15') && !/^xato/.test(ver);
  console.log('Eski tizim ko\'prigi: v' + ver + (k115 ? ' ✅' : ' ⚠ (1.15 kerak — fayllar har xodim uchun, Word, bitta xodimga skan)'));
  const u = { fish: adm.fish, kod: adm.kirish_kodi, admin: true, huquq: ['admin'] };
  const XD = (await TPI.topXodimlar()).filter(z => !z.admin);
  if (XD.length < 2) { console.log('Kamida 2 ta oddiy xodim kerak.'); return; }
  const A1 = XD[0], Y1 = XD[1], uA = { fish: A1.fish, kod: '', admin: false, huquq: [] }, uY = { fish: Y1.fish, kod: '', admin: false, huquq: [] };
  const M = await G.varaqlar(ID, KEY);
  const ochir = []; let x = 0;
  const nusxala = async varaq => { const src = M.varaqlar.find(v => v.title === varaq); if (!src) throw new Error('Varaq topilmadi: ' + varaq);
    const j = await G.soralar(ID, [{ duplicateSheet: { sourceSheetId: src.sheetId, insertSheetIndex: M.varaqlar.length + ochir.length, newSheetName: 'zz_sinov_' + varaq } }], KEY);
    ochir.push(j.replies[0].duplicateSheet.properties.sheetId); await G.gid(ID, 'zz_sinov_' + varaq, KEY, true); return 'zz_sinov_' + varaq; };
  const PDF0 = Buffer.from('%PDF-1.4\n' + '% SINOV — AKS TIZIM server sinovi, o\'chiriladi\n'.repeat(40) + '%%EOF\n');
  const bugun = V.bugun(), bugunD = bugun.split('-').reverse().join('.');
  const tek = (ok, m) => { if (ok) console.log('  ✅ ' + m); else { x++; console.log('  ✖ ' + m); } };
  const jsonOl = v => { try { return JSON.parse(v || '{}') || {}; } catch (e) { return null; } };
  try {
    if (!M.varaqlar.some(v => v.title === DV.DEVON_V)) { console.log('11_Devonxona varag\'i yo\'q — solishtirib bo\'lmaydi.'); return; }
    const n11 = await nusxala(DV.DEVON_V), n10 = await nusxala(TPI.TOP_V), opt = { varaq: n11, topVaraq: n10, quruq: true };
    const R0 = await DV.devonRowsYangi(n11), T0 = await TPI.topRowsYangi(n10);
    const eskiIjro = R0.L.filter(z => z.turi === 'Kirim' && z.holati === 'Ijro etildi').pop() || R0.L.filter(z => z.turi === 'Kirim' && (z.holati === 'Ijroda' || z.holati === 'Tekshiruvda')).pop();
    const eskiChiqim = R0.L.filter(z => z.turi === 'Chiqim' && z.holati === 'Yuborildi' && /"yub"/.test(z.ijro)).pop();
    const eskiTop = T0.L.filter(z => /^devon\|/.test(z.kalit)).pop();
    const kir = async (n, raqam) => DV.devonYoz(n11, await DV.devonRowsYangi(n11), { turi: 'Kirim', tartib: 9000 + n, kim: 'SINOV KOTIBA', tashkilot: 'SINOV TASHKILOT ' + n, raqam, sana: bugunD, mazmun: 'SINOV — nusxa varaq, o\'chiriladi', fayl: '', holati: 'Rezolyutsiya kutmoqda' });
    const ol = async id => (await DV.devonRowsYangi(n11)).L.find(z => String(z.id) === String(id));
    const top = async () => (await TPI.topRowsYangi(n10)).L;
    const kat11 = async q => (await G.kataklarOqi(ID, n11, 'A' + q + ':T' + q, KEY))[0] || [];
    const kat10 = async q => (await G.kataklarOqi(ID, n10, 'A' + q + ':V' + q, KEY))[0] || [];
    // ---------- 1) rezolyutsiya
    console.log('\n=== 1) REZOLYUTSIYA — ' + A1.fish + ' (asosiy) + ' + Y1.fish + ' (yordamchi) ===');
    const K1 = await kir(1, 'SINOV-K1');
    let t0 = Date.now();
    const r1 = await DV.rezYadro(u, K1.id, { tur: 'ijro', matn: 'SINOV: o\'rganib, hisobot bersin', muddat: bugunD, asosiy: A1, yordam: [Y1.fish] }, opt);
    console.log('  ' + (Date.now() - t0) + ' ms · 10 ga ' + r1.rows.length + ' qator (ID ' + r1.rows.map(z => z.id).join(', ') + ')');
    let k1 = await ol(K1.id), J = jsonOl(k1.ijro);
    tek(k1.holati === 'Ijroda' && k1.tur === 'ijro' && k1.ijrochi === A1.fish && k1.yordam.join(',') === Y1.fish && k1.muddat === bugunD && k1.rez === 'SINOV: o\'rganib, hisobot bersin' && /^\d\d\.\d\d\.\d{4} \d\d:\d\d · /.test(k1.rezVaqt), 'K:Q — Ijroda, ijro, ijrochi, yordamchi, muddat, matn, rez vaqti');
    tek(J && Object.keys(J).join(',') === 'tid,top,kordi' && String(J.tid[A1.fish]) === String(r1.rows[0].id) && String(J.tid[Y1.fish]) === String(r1.rows[1].id) && J.kordi && J.kordi.fish === u.fish, 'R JSON {tid, top, kordi}: ' + qisqa(k1.ijro, 90));
    tek(new RegExp('rezolyutsiya: 📋 Ijro etilsin → ' + A1.fish.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ' \\(\\+' + Y1.fish.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\), muddat ' + bugunD + ' \\(' + u.fish.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\)$').test(k1.tarix), 'S tarix: ' + qisqa(k1.tarix.split('\n').pop(), 100));
    const TL = await top(); const ta = TL.find(z => String(z.id) === String(r1.rows[0].id)), ty = TL.find(z => String(z.id) === String(r1.rows[1].id));
    tek(ta && ta.kalit === 'devon|' + K1.id + '|a' && ta.qoida === 'devon' && ta.manba === 'Direktor' && ta.kimga === A1.fish && ta.holati === 'Jarayonda' && ta.muddat === bugunD + ' 18:00' && ta.sarlavha === '📥 Kirim xat №' + K1.tartib + ' — SINOV TASHKILOT 1 (№SINOV-K1, ' + bugunD + ')' && ta.izoh === '📋 Ijro etilsin · yordamchilar: ' + Y1.fish + ' · Rezolyutsiya: SINOV: o\'rganib, hisobot bersin', '10 asosiy: ' + (ta ? qisqa(ta.sarlavha, 60) + ' · ' + qisqa(ta.izoh, 70) : 'topilmadi'));
    tek(ty && ty.kalit === 'devon|' + K1.id + '|y' && ty.kimga === Y1.fish && ty.sarlavha.endsWith(' · yordamchi') && ty.izoh === '📋 Ijro etilsin · asosiy ijrochi: ' + A1.fish + ' · Rezolyutsiya: SINOV: o\'rganib, hisobot bersin', '10 yordamchi: ' + (ty ? qisqa(ty.izoh, 90) : 'topilmadi'));
    if (eskiTop) x += solishtir(await kat10(eskiTop.qator), await kat10(ta.qator), [1, 2, 3, 4, 5, 6, 7, 10, 11, 12, 13, 14], '— 10_Topshiriqlar: eski tizim yozgan devon topshirig\'i (qator ' + eskiTop.qator + ') va server yozgani (qator ' + ta.qator + ')');
    else console.log('  (10 da eski devon topshirig\'i yo\'q — tur/format solishtirilmadi)');
    if (eskiIjro) x += solishtir(await kat11(eskiIjro.qator), await kat11(k1.qator), [11, 12, 13, 14, 15, 16, 17, 18, 19], '— 11: eski tizim rezolyutsiya yozgan xat (qator ' + eskiIjro.qator + ', ' + eskiIjro.holati + ') va server (qator ' + k1.qator + '): K–S');
    else console.log('  (11 da rezolyutsiya yozilgan eski xat yo\'q — tur/format solishtirilmadi)');
    // ---------- 2) yordamchi o'z qismini yukladi
    console.log('\n=== 2) YORDAMCHI QISMI (' + Y1.fish + ') ===');
    const r2 = await DV.ijroTopshirYadro(uY, { id: K1.id, hisobot: 'SINOV: yordamchi o\'z qismini bajardi', b64: PDF0.toString('base64') }, opt);
    k1 = await ol(K1.id); J = jsonOl(k1.ijro);
    tek(r2.natija === 'Qismingiz yuklandi. Asosiy ijrochi (' + A1.fish + ') ko\'radi.' && r2.xabarAsosiy.indexOf('o\'z qismini yukladi') > 0, 'natija: ' + r2.natija);
    tek(k1.holati === 'Ijroda' && J && J.top && J.top[Y1.fish] && J.top[Y1.fish].rol === 'y' && J.top[Y1.fish].h === 'SINOV: yordamchi o\'z qismini bajardi' && /^SINOV_Ijro_K-/.test(J.top[Y1.fish].f) && Object.keys(J.top[Y1.fish]).join(',') === 'v,h,rol,f', 'R top[yordamchi] {v,h,rol,f}, holat Ijroda qoladi');
    tek(/yordamchi o'z qismini yukladi: /.test(k1.tarix.split('\n').pop()), 'S tarix: ' + qisqa(k1.tarix.split('\n').pop(), 80));
    let TY1 = (await top()).find(z => String(z.id) === String(ty.id));
    tek(TY1.holati === 'Bajarildi' && TY1.yopdi === Y1.fish && TY1.dalil === 'O\'z qismi yuklandi: SINOV: yordamchi o\'z qismini bajardi', '10 yordamchi topshirig\'i: Bajarildi, dalil «O\'z qismi yuklandi: …»');
    let xt = ''; try { await DV.ijroTopshirYadro(uY, { id: K1.id, hisobot: 'SINOV takror', b64: PDF0.toString('base64') }, opt); } catch (e) { xt = e.message; }
    tek(/allaqachon topshirgansiz/.test(xt), 'takror topshirish rad: ' + qisqa(xt, 70));
    // ---------- 3) asosiy topshirdi → 4) qaytarildi → 5) qayta topshirdi → 6) qabul
    console.log('\n=== 3) ASOSIY IJROCHI TOPSHIRDI (' + A1.fish + ') ===');
    const r3 = await DV.ijroTopshirYadro(uA, { id: K1.id, hisobot: 'SINOV: ijro hisoboti — bajarildi', b64: PDF0.toString('base64') }, opt);
    k1 = await ol(K1.id); J = jsonOl(k1.ijro);
    tek(r3.natija === 'Ijro direktorga tekshiruvga yuborildi.' && /ijroni topshirdi\.\nTekshirish: ilovada 👔 Direktor → Tasdiqlar\.$/.test(r3.xabarDir), 'natija + direktorga xabar');
    tek(k1.holati === 'Tekshiruvda' && J.top[A1.fish] && J.top[A1.fish].rol === 'a' && /^SINOV_Ijro_K-9001_ijro_/.test(J.top[A1.fish].f), 'K Tekshiruvda, R top[asosiy] {rol a, f}');
    tek(/ijro topshirildi: /.test(k1.tarix.split('\n').pop()), 'S tarix: ' + qisqa(k1.tarix.split('\n').pop(), 80));
    let TA1 = (await top()).find(z => String(z.id) === String(ta.id));
    tek(TA1.holati === 'Tekshiruvda' && TA1.dalil === 'Ijro topshirildi: SINOV: ijro hisoboti — bajarildi', '10 asosiy topshirig\'i: Tekshiruvda');
    if (eskiIjro) x += solishtir(await kat11(eskiIjro.qator), await kat11(k1.qator), [11, 18, 19, 20], '— 11 K, R, S, T (eski qator ' + eskiIjro.qator + ')');
    console.log('\n=== 4) DIREKTOR QAYTARDI ===');
    const x4 = await DV.tasdiqYadro(u, K1.id, false, 'SINOV: hisobot to\'liq emas', opt);
    k1 = await ol(K1.id); J = jsonOl(k1.ijro);
    tek(k1.holati === 'Ijroda' && J.eski && J.eski.length === 1 && J.eski[0].fish === A1.fish && J.eski[0].qaytdi === 'SINOV: hisobot to\'liq emas' && Object.keys(J.eski[0]).join(',') === 'fish,qaytdi,v,h,rol,f' && !J.top[A1.fish] && J.top[Y1.fish], 'K Ijroda, R eski[{fish,qaytdi,v,h,rol,f}], top[asosiy] o\'chdi');
    tek(/qaytarildi: SINOV: hisobot to'liq emas \(/.test(k1.tarix.split('\n').pop()), 'S tarix: ' + qisqa(k1.tarix.split('\n').pop(), 80));
    TA1 = (await top()).find(z => String(z.id) === String(ta.id));
    tek(TA1.holati === 'Jarayonda' && TA1.yopildi === '' && TA1.yopdi === '' && TA1.dalil === '' && TA1.izoh.endsWith(' | Qaytarildi: SINOV: hisobot to\'liq emas'), '10 asosiy: Jarayonda, G izoh «… | Qaytarildi: …»');
    console.log('\n=== 5) QAYTA TOPSHIRDI → 6) QABUL ===');
    await DV.ijroTopshirYadro(uA, { id: K1.id, hisobot: 'SINOV: to\'ldirilgan hisobot', b64: PDF0.toString('base64') }, opt);
    const x6 = await DV.tasdiqYadro(u, K1.id, true, '', opt);
    k1 = await ol(K1.id); J = jsonOl(k1.ijro);
    tek(k1.holati === 'Ijro etildi' && J.top[A1.fish] && J.top[A1.fish].h === 'SINOV: to\'ldirilgan hisobot' && J.eski.length === 1, 'K Ijro etildi, R top[asosiy] yangi, eski 1 ta');
    tek(/qabul qilindi — Ijro etildi \(/.test(k1.tarix.split('\n').pop()), 'S tarix: ' + qisqa(k1.tarix.split('\n').pop(), 80));
    TA1 = (await top()).find(z => String(z.id) === String(ta.id)); TY1 = (await top()).find(z => String(z.id) === String(ty.id));
    tek(TA1.holati === 'Bajarildi' && TA1.yopdi === A1.fish + ' (tasdiq: ' + u.fish + ')' && TA1.dalil === 'Ijro topshirildi: SINOV: to\'ldirilgan hisobot' && TY1.holati === 'Bajarildi', '10: asosiy Bajarildi «… (tasdiq: direktor)», yordamchi Bajarildi qoldi');
    if (eskiIjro && eskiIjro.holati === 'Ijro etildi') x += solishtir(await kat11(eskiIjro.qator), await kat11(k1.qator), [11, 12, 13, 14, 15, 16, 17, 18, 19], '— 11 yakuniy (Ijro etildi): eski qator ' + eskiIjro.qator + ' va server qator ' + k1.qator);
    const eskiTopB = T0.L.filter(z => /^devon\|/.test(z.kalit) && z.holati === 'Bajarildi').pop();
    if (eskiTopB) x += solishtir(await kat10(eskiTopB.qator), await kat10(ta.qator), [14, 15, 16, 17, 18], '— 10 yopilgan devon topshirig\'i (N–R): eski qator ' + eskiTopB.qator + ' va server qator ' + ta.qator);
    // ---------- 7) rezolyutsiya qaytarib olindi (2-xat, javob turi, faqat asosiy)
    console.log('\n=== 7) 2-XAT: REZOLYUTSIYA → QAYTARIB OLISH ===');
    const K2 = await kir(2, 'SINOV-K2');
    const r7 = await DV.rezYadro(u, K2.id, { tur: 'javob', matn: 'SINOV: javob xati tayyorlansin', muddat: bugunD, asosiy: A1, yordam: [] }, opt);
    let k2 = await ol(K2.id);
    tek(k2.holati === 'Ijroda' && k2.tur === 'javob' && k2.yordam.length === 0, 'rezolyutsiya (javob, yordamchisiz) yozildi');
    const r7b = await DV.rezQaytarYadro(u, K2.id, 'SINOV: ijrochi xato tanlangan', opt);
    k2 = await ol(K2.id); J = jsonOl(k2.ijro);
    tek(k2.holati === 'Rezolyutsiya kutmoqda' && k2.tur === '' && k2.ijrochi === '' && k2.muddat === '' && k2.rez === '' && k2.rezVaqt === '' && r7b.kimlar.join(',') === A1.fish, 'K:Q tozalandi, topshiriq egasi: ' + r7b.kimlar.join(', '));
    tek(J && Object.keys(J).join(',') === 'eskiRez,eski,kordi' && J.eskiRez.length === 1 && J.eskiRez[0].ijrochi === A1.fish && J.eskiRez[0].sabab === 'SINOV: ijrochi xato tanlangan' && Object.keys(J.eskiRez[0]).join(',') === 'tur,ijrochi,yordam,muddat,matn,vaqt,top,sabab', 'R JSON {eskiRez[{tur,ijrochi,yordam,muddat,matn,vaqt,top,sabab}], eski, kordi}: ' + qisqa(k2.ijro, 80));
    tek(/rezolyutsiya qaytarib olindi: SINOV: ijrochi xato tanlangan \(/.test(k2.tarix.split('\n').pop()), 'S tarix: ' + qisqa(k2.tarix.split('\n').pop(), 80));
    const T7 = (await top()).find(z => String(z.id) === String(r7.rows[0].id));
    tek(T7.holati === 'Bekor' && T7.yopdi === u.fish && T7.dalil === 'rezolyutsiya qaytarib olindi: SINOV: ijrochi xato tanlangan', '10: topshiriq Bekor, dalil «rezolyutsiya qaytarib olindi: …»');
    const eskiRQ = R0.L.filter(z => z.turi === 'Kirim' && /"eskiRez"/.test(z.ijro)).pop();
    if (eskiRQ) x += solishtir(await kat11(eskiRQ.qator), await kat11(k2.qator), [11, 12, 13, 14, 15, 16, 17, 18, 19], '— 11 rezolyutsiya qaytarib olingan xat: eski qator ' + eskiRQ.qator + ' va server qator ' + k2.qator);
    // ---------- 8) bekor (3-xat)
    console.log('\n=== 8) 3-XAT: BEKOR ===');
    const K3 = await kir(3, 'SINOV-K3');
    const r8 = await DV.bekorYadro(u, K3.id, 'SINOV: xato kiritilgan', opt);
    const k3 = await ol(K3.id);
    tek(k3.holati === 'Bekor' && r8.natija === 'Kirim xat №' + K3.tartib + ' bekor qilindi. Raqami jurnalda qoladi.' && /bekor qilindi: SINOV: xato kiritilgan \(/.test(k3.tarix.split('\n').pop()), 'K Bekor, natija, tarix');
    xt = ''; try { await DV.bekorYadro(u, K1.id, 'SINOV: bekor', opt); } catch (e) { xt = e.message; }
    tek(/Faqat rezolyutsiya yozilmagan kirim xat/.test(xt), 'ijro etilgan xatni bekor qilish rad: ' + qisqa(xt, 60));
    // ---------- 9) tayyor chiqim xat (qo'lma-qo'l), 2-kirim xatga bog'langan
    console.log('\n=== 9) TAYYOR CHIQIM XATNI RO\'YXATGA OLISH (qo\'lma-qo\'l) ===');
    const Yq = DV.devonYubOl({ usul: 'qol', sana: bugun, qabul: 'SINOV qabul qiluvchi', kiruvchi: '77' }, bugunD, 'x');
    const r9 = await DV.chiqimSaqlaYadro(u, { tashkilot: 'SINOV TASHKILOT 2', raqam: 'SINOV-CH-1', mazmun: 'SINOV chiqim mazmuni', sana: bugunD, Y: Yq, bayt: PDF0, kirimId: K2.id }, opt);
    const c9 = await ol(r9.id); J = jsonOl(c9.ijro); k2 = await ol(K2.id);
    tek(c9.turi === 'Chiqim' && c9.holati === 'Yuborildi' && c9.bogliq === String(K2.id) && /^SINOV_Chiqim_CH-/.test(c9.fayl) && c9.kim === u.fish, 'Chiqim qatori: Yuborildi, bog\'liq K2, fayl');
    tek(J && Object.keys(J).join(',') === 'yub' && Object.keys(J.yub).join(',') === 'usul,sana,kv,bolim,qabul,kiruvchi,kvF,v,fish' && J.yub.usul === 'qol' && J.yub.qabul === 'SINOV qabul qiluvchi' && J.yub.kiruvchi === '77', 'R JSON {yub:{usul,sana,kv,bolim,qabul,kiruvchi,kvF,v,fish}}');
    tek(/ yuborildi — qo'lma-qo'l, \d\d\.\d\d\.\d{4}, qabul qildi: SINOV qabul qiluvchi, kiruvchi №77$/.test(c9.tarix.split('\n').pop()), 'S tarix: ' + qisqa(c9.tarix.split('\n').pop(), 90));
    tek(/javob xati SINOV-CH-1 bog'landi \(/.test(k2.tarix.split('\n').pop()), 'K2 tarix: ' + qisqa(k2.tarix.split('\n').pop(), 80));
    xt = ''; try { await DV.chiqimSaqlaYadro(u, { tashkilot: 'SINOV TASHKILOT 2', raqam: 'SINOV-CH-1', mazmun: '', sana: bugunD, Y: Yq, bayt: PDF0, kirimId: '' }, opt); } catch (e) { xt = e.message; }
    tek(/Bu raqam allaqachon bor/.test(xt), 'takror raqam rad: ' + qisqa(xt, 60));
    if (eskiChiqim) x += await qatorSolishtir(n11, c9.qator, 1, 20, '— Chiqim xat qatori (A–T)', eskiChiqim.qator); else console.log('  (11 da eski chiqim xat yo\'q — solishtirilmadi)');
    // ---------- 10) «Tayyorlandi» xat → yuborildi (pochta)
    console.log('\n=== 10) BLANKADAGI XAT → YUBORILDI (pochta) ===');
    const R10 = await DV.devonRowsYangi(n11);
    const c10 = await DV.devonYoz(n11, R10, { turi: 'Chiqim', tartib: 9100, kim: A1.fish, tashkilot: 'SINOV TASHKILOT 3', raqam: 'SINOV-CH-2', sana: bugunD, mazmun: 'SINOV blankadagi xat matni', fayl: '', holati: 'Tayyorlandi', bogliq: '' });
    await G.yoz(ID, [{ varaq: n11, katak: 'R' + c10.qator, qiymat: [[JSON.stringify({ pdf: 'SINOV_PDF', doc: 'SINOV_DOC', bet: 1, oluvchi: ['SINOV TASHKILOT 3'], xat: { tur: 'tashkilot', mavzu: 'SINOV', murojaat: '', ilova: '' }, tahrir: 0 })]] }], KEY);
    const Yp = DV.devonYubOl({ usul: 'pochta', sana: bugun, kv: 'RB 123456 UZ', bolim: 'Angor pochta', kvB64: PDF0.toString('base64') }, '', 'x');
    const r10 = await DV.chiqimYuborYadro(uA, c10.id, Yp, PDF0, false, opt);
    const y10 = await ol(c10.id); J = jsonOl(y10.ijro);
    tek(y10.holati === 'Yuborildi' && /^SINOV_Chiqim_CH-9100_SINOV-CH-2_imzolangan$/.test(y10.fayl) && r10.yubMatn === 'pochta orqali, kvitansiya №RB 123456 UZ (Angor pochta), ' + bugunD, 'K Yuborildi, J fayl «…_imzolangan», matn: ' + r10.yubMatn);
    tek(J && Object.keys(J).join(',') === 'pdf,doc,bet,oluvchi,xat,tahrir,yub' && J.yub.usul === 'pochta' && /^SINOV_Chiqim_CH-9100_SINOV-CH-2_kvitansiya_/.test(J.yub.kvF) && J.yub.fish === A1.fish, 'R JSON: avvalgi maydonlar + yub (kvF kvitansiya fayli)');
    tek(/ yuborildi — pochta orqali, kvitansiya №RB 123456 UZ \(Angor pochta\), \d\d\.\d\d\.\d{4} \(/.test(y10.tarix.split('\n').pop()), 'S tarix: ' + qisqa(y10.tarix.split('\n').pop(), 90));
    xt = ''; try { await DV.chiqimYuborYadro(uY, c10.id, Yp, PDF0, false, opt); } catch (e) { xt = e.message; }
    tek(/Bu xat sizga tegishli emas/.test(xt), 'begona xodim rad: ' + xt);
    const eskiYub = R0.L.filter(z => z.turi === 'Chiqim' && z.holati === 'Yuborildi' && /"pdf"/.test(z.ijro) && /"yub"/.test(z.ijro)).pop();
    if (eskiYub) x += solishtir(await kat11(eskiYub.qator), await kat11(y10.qator), [10, 11, 18, 19], '— 11 blankadagi xat yuborildi (J, K, R, S): eski qator ' + eskiYub.qator + ' va server qator ' + y10.qator);
  } finally {
    if (ochir.length) await G.soralar(ID, ochir.map(g => ({ deleteSheet: { sheetId: g } })), KEY).catch(e => console.log('Nusxani o\'chirib bo\'lmadi: ' + e.message));
    console.log('\nNusxa varaqlar o\'chirildi.');
  }
  console.log('');
  if (!x && k115) { await redis.set('yozuv_yondi:devon2', '1'); console.log('✅ HAMMASI BIR XIL — 📮 devonxona: chiqim xatni ro\'yxatga olish, yuborildi, rezolyutsiya, ijro topshirish, qabul/qaytarish, rezolyutsiyani qaytarib olish, bekor — endi serverda (fayllar Drive\'ga va Telegram — eski tizim ko\'prigi). Blankadagi xat — alohida: aks-yozuv-sinov devonxat. Qaytarish: aks-yozuv-sinov ochir'); }
  else { await redis.del('yozuv_yondi:devon2'); console.log('⚠ ' + (x ? x + ' ta farq' : 'Koprik 1.15 emas') + ' — YOQILMADI (eski tizim orqali ishlayveradi).'); }
}

// Qatorma-qator: eski va server PDF dagi har bir matn qatorining yuqori chegarasi (so'zlar bir xil ketma-ketlikda bo'lsa) — farq o'zgargan joylar chiqariladi
function qatorFarq(eskiB, yangiB) {
  const A = sozJoy(eskiB), B = sozJoy(yangiB);
  if (A.length !== B.length) return;
  const L = []; let j = null;
  A.forEach((a, i) => { const b = B[i]; if (!b || a[1] !== b[1]) return;
    if (j && j.bet === a[0] && Math.abs(j.ye - a[3]) < 0.6) { j.n++; j.dy += (a[3] - b[3]); if (j.matn.length < 34) j.matn += ' ' + a[1]; }
    else { j = { bet: a[0], ye: a[3], ys: b[3], n: 1, dy: a[3] - b[3], matn: a[1] }; L.push(j); } });
  let oldin = null, k = 0;
  console.log('    qator: eski y | server y | farq (eski − server) — faqat farq o\'zgargan qatorlar');
  L.forEach((l, i) => { const d = l.dy / l.n; const chiq = oldin === null || Math.abs(d - oldin) >= 0.25 || i === L.length - 1;
    if (chiq && k < 40) { console.log('    ' + l.bet + '-bet ' + l.ye.toFixed(1).padStart(6) + ' | ' + l.ys.toFixed(1).padStart(6) + ' | ' + (d >= 0 ? '+' : '') + d.toFixed(2).padStart(5) + '  «' + l.matn + '»'); k++; }
    oldin = d; });
}

// 📮 BLANKADAGI CHIQUVCHI XAT (Devon.gs devonChiqimYoz / devonXatYasa_): 11 dagi eski tizim yasagan oxirgi 2 ta xatni (R JSON da pdf, doc, oluvchi, xat)
// server o'sha ma'lumotdan qayta yasaydi — PDF matni, sahifalari, so'zlar joyi va Word (Google eksporti bilan qismma-qism) solishtiriladi. Hech narsa yozilmaydi.
async function devonxatSinov() {
  const DV = require('../api/devon_yoz')._ichki, DX = require('../lib/devon_xat'), XC = require('../api/xat_chiqar')._ichki;
  const DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  const adm = (await pool.query('SELECT kirish_kodi, huquqlar, fish FROM v_xodimlar WHERE kompaniya_id = 1')).rows.find(z => (z.huquqlar || []).includes('admin') && String(z.kirish_kodi || '').length >= 8);
  let ver = '?'; try { ver = String(await koprik.chaqir('koprikVersiya', adm.kirish_kodi, [])); } catch (e) { ver = 'xato: ' + e.message; }
  const k115 = verOk(ver, '1.15') && !/^xato/.test(ver);
  console.log('Eski tizim ko\'prigi: v' + ver + (k115 ? ' ✅' : ' ⚠ (1.15 kerak — Word Drive\'ga)'));
  if (!(await PDF.bor())) { console.log('⏳ PDF dasturi (Chromium) hali tayyor emas — 3 daqiqadan keyin qayta ishga tushiring.'); return; }
  const R = (await DV.devonRowsYangi()).L;
  const jsonOl = v => { try { return JSON.parse(v || '{}') || {}; } catch (e) { return {}; } };
  const L = R.filter(z => z.turi === 'Chiqim' && z.holati !== 'Bekor').map(z => ({ x: z, J: jsonOl(z.ijro) })).filter(z => z.J.pdf && z.J.doc && Array.isArray(z.J.oluvchi) && z.J.xat).slice(-2);
  if (!L.length) { console.log('11_Devonxona da eski tizim blankada yasagan xat yo\'q — solishtirib bo\'lmaydi (xat yozilgach qayta ishga tushiring).'); return; }
  let x = 0;
  for (const { x: z, J } of L) {
    console.log('\n— Chiqim №' + z.tartib + ' (' + z.raqam + ', ' + z.sana + ', ' + z.kim + ', ' + (J.xat.tur || 'tashkilot') + (z.bogliq ? ', javob: kirim ID ' + z.bogliq : '') + ', tahrir ' + (J.tahrir || 0) + ')');
    try {
      const kirim = z.bogliq ? R.find(q => String(q.id) === String(z.bogliq)) : null;
      const ij = await XC.ijrochi(z.kim);
      const t0 = Date.now();
      const f = await DX.yasa(z.raqam, z.sana.split('.').reverse().join('-'), J.oluvchi, z.mazmun, ij, J.xat, kirim ? { sana: kirim.sana, raqam: kirim.raqam } : null);
      console.log('  server: ' + ((Date.now() - t0) / 1000).toFixed(1) + ' s · ' + f.bet + ' bet (eski ' + J.bet + ') · o\'lcham ' + Math.round(f.k * 100) + '%' + (f.havola ? ' · havola: «' + f.havola + '»' : ''));
      let ePdf; try { ePdf = (await G.driveFayl(J.pdf, KEY)).bytes; } catch (e) { console.log('  ⚠ eski PDF ni robot o\'qiy olmadi: ' + e.message); x++; continue; }
      x += pdfSolishtir(ePdf, f.pdf);
      const w = sozSolishtir(ePdf, f.pdf);
      if (w.sozlar[0] !== w.sozlar[1] || w.betlar[0] !== w.betlar[1] || w.farq) { x++; console.log('  ✖ so\'zlar joyi: eski ' + w.sozlar[0] + ' / server ' + w.sozlar[1] + ' so\'z, betlar ' + w.betlar.join('/') + ', ' + w.farq + ' ta farq, eng katta og\'ish ' + w.dmax.toFixed(2) + ' pt'); qatorFarq(ePdf, f.pdf); }
      else console.log('  ✅ ' + w.sozlar[0] + ' so\'zning joyi bir xil (eng katta og\'ish ' + w.dmax.toFixed(2) + ' pt)');
      let eDoc = null; try { eDoc = await G.driveEksport(J.doc, DOCX, KEY); } catch (e) { console.log('  ⚠ Google Doc eksporti o\'qilmadi (Word solishtirilmadi): ' + e.message); }
      if (eDoc) {
        const ta = docxMatnlar(eDoc), tb = docxMatnlar(f.docx);
        if (JSON.stringify(ta) === JSON.stringify(tb)) console.log('  ✅ Word matni xatboshima-xatboshi bir xil (' + ta.length + ' xatboshi)');
        else { x++; console.log('  ✖ Word matni farq qiladi: eski ' + ta.length + ' / server ' + tb.length + ' xatboshi'); for (let i = 0; i < Math.max(ta.length, tb.length); i++) if (ta[i] !== tb[i]) { console.log('     ' + (i + 1) + ': eski «' + qisqa(ta[i], 60) + '» | server «' + qisqa(tb[i], 60) + '»'); break; } }
        await zipQismlar('Word (qismlar)', eDoc, f.docx, false).then(n => { if (n) console.log('  ℹ Word qismlari baytma-bayt farq qiladi (matn bir xil bo\'lsa — yetarli; farq yuqorida)'); });
      }
    } catch (e) { console.log('  ⚠ ' + e.message); x++; }
  }
  console.log('');
  if (!x && k115) { await redis.set('yozuv_yondi:devon_xat', '1'); console.log('✅ HAMMASI BIR XIL — ✍ blankadagi chiquvchi xat endi serverda yasaladi (PDF 1–2 s, Word; Drive\'ga — eski tizim ko\'prigi). Qaytarish: aks-yozuv-sinov ochir'); }
  else { await redis.del('yozuv_yondi:devon_xat'); console.log('⚠ ' + (x ? x + ' ta farq' : 'Koprik 1.15 emas') + ' — YOQILMADI (blankadagi xat eski tizimda yasalaveradi).'); }
}

// ☀️ 07c ERTALAB SVOD (Monitoring.gs monErtalabYoz_): nusxa varaqda server 2 ta sinov qator yozadi, keyin qayta yozadi (bugungi eski qatorlar o'chirilib, yangilari);
// qator kataklari eski tizim yozgan oxirgi qator bilan solishtiriladi (qiymat turi, format).
async function ertalabSinov() {
  const ER = require('../lib/ertalab');
  console.log('\n=== ☀️ 07c_Ertalab_svod — bugungi qatorlar (nusxa varaqda) ===');
  const M = await G.varaqlar(ID, KEY);
  const src = M.varaqlar.find(v => v.title === ER.ERTALAB_V); if (!src) { console.log('07c varag\'i yo\'q — solishtirib bo\'lmaydi.'); return; }
  const nusxa = 'zz_sinov_07c';
  const j = await G.soralar(ID, [{ duplicateSheet: { sourceSheetId: src.sheetId, insertSheetIndex: M.varaqlar.length, newSheetName: nusxa } }], KEY);
  const ng = j.replies[0].duplicateSheet.properties.sheetId; let x = 0;
  try {
    await G.gid(ID, nusxa, KEY, true);
    const A = await G.oraliqOqi(ID, nusxa, 'A2:H', KEY); let l = 1; A.forEach((r, i) => { if (String(r[0] || '') !== '') l = i + 2; });
    const eskiQ = l >= 2 ? l : 0;
    const bugun = V.bugun(), bugunD = bugun.split('-').reverse().join('.');
    const borBugun = A.filter(r => String(r[0] || '') === bugunD).length;
    console.log('Eski tizim yozgan oxirgi qator: ' + (eskiQ || 'yo\'q') + ' · bugungi (' + bugunD + ') qatorlar: ' + borBugun);
    const rows = [{ fish: 'SINOV XODIM 1', q: 3, s: 5, y: 1, n: 40, muddati: 123456789, holat: '✅ yuborildi' }, { fish: 'SINOV XODIM 2', q: 0, s: 2, y: 0, n: 12, muddati: 0, holat: '❌ Telegramga ulanmagan — topshiriq bormadi' }];
    let t0 = Date.now();
    const r1 = await ER.ertalabYoz(nusxa, bugun, rows);
    console.log('1-yozuv: ' + (Date.now() - t0) + ' ms · ' + JSON.stringify(r1) + (r1.ochirildi === borBugun ? ' ✅ bugungi eski qatorlar o\'chirildi' : ' ✖ o\'chirilgan ' + r1.ochirildi + ', kutilgan ' + borBugun));
    if (r1.ochirildi !== borBugun) x++;
    if (r1.qator > 2) x += await qatorSolishtir(nusxa, r1.qator, 1, 8, '— 07c qatori (A–H)', r1.qator - 1);   // undan oldingi qator — eski tizim yozgani
    else console.log('  (07c da eski qator yo\'q — solishtirilmadi)');
    t0 = Date.now();
    const r2 = await ER.ertalabYoz(nusxa, bugun, rows);
    const A2 = await G.oraliqOqi(ID, nusxa, 'A2:B', KEY); const sinov = A2.filter(r => String(r[0] || '') === bugunD && /^SINOV XODIM/.test(String(r[1] || ''))).length;
    console.log('2-yozuv (qayta): ' + (Date.now() - t0) + ' ms · ' + JSON.stringify(r2) + (r2.ochirildi === rows.length && sinov === rows.length ? ' ✅ takror yozilmadi (eski 2 ta o\'chib, 2 ta yangi)' : ' ✖ varaqda SINOV qatorlar: ' + sinov));
    if (!(r2.ochirildi === rows.length && sinov === rows.length)) x++;
  } finally {
    await G.soralar(ID, [{ deleteSheet: { sheetId: ng } }], KEY).catch(e => console.log('Nusxani o\'chirib bo\'lmadi: ' + e.message));
    console.log('Nusxa varaq o\'chirildi.');
  }
  console.log('');
  if (!x) console.log('✅ HAMMASI BIR XIL — 07c yozuvi to\'g\'ri. Yoqish: aks-vaqt yoq und_ertalab (eski trigger o\'chiriladi).');
  else console.log('⚠ ' + x + ' ta farq — und_ertalab ni YOQMANG, avval tuzatish kerak.');
}

// 📒 IJRO KECHKI (Ijro.gs ijroKechki): 06r va 06q nusxalarida server yo'li bilan haqiqiy yozuv. 06q nusxasidan bugungi kechki qoidabuzarliklar
// olib tashlanadi — server ularni qayta yozadi; 06r da bugungi qatorlar (eski tizim 18:15 da yozgan) ustidan yoziladi. Telegram yuborilmaydi.
async function ijrokunSinov() {
  const IK = require('../lib/ijro_kun'), IY = require('../api/ijro_yoz')._ichki, Qd = require('../api/qadam')._ichki, VQ = require('../lib/vaqt');
  const M = await G.varaqlar(ID, KEY); const ochir = []; let x = 0;
  const nusxala = async varaq => { const src = M.varaqlar.find(v => v.title === varaq); if (!src) throw new Error('Varaq topilmadi: ' + varaq);
    const j = await G.soralar(ID, [{ duplicateSheet: { sourceSheetId: src.sheetId, insertSheetIndex: M.varaqlar.length + ochir.length, newSheetName: 'zz_sinov_' + varaq } }], KEY);
    ochir.push(j.replies[0].duplicateSheet.properties.sheetId); await G.gid(ID, 'zz_sinov_' + varaq, KEY, true); return 'zz_sinov_' + varaq; };
  const bugun = V.bugun(), iso = v => typeof v === 'number' ? V.iso(v) : String(v || '').slice(0, 10).split('.').reverse().join('-');
  const KT = ['reja', 'nazorat', 'otkaz', 'xat', 'xat3', 'top', 'tasdiq', 'yuqabul', 'yubosqich'];
  try {
    const nk = await nusxala(IK.IJRO_KUN), nq = await nusxala(IY.IJRO_VARAQ);
    const K0 = await IY.ijroQatorYangi(nk, Qd.IJRO_KS), Q0 = await IY.ijroQatorYangi(nq, IY.IJRO_S);
    const kunB = K0.filter(r => iso(r.Sana) === bugun), qB = Q0.filter(r => iso(r.Sana) === bugun && KT.indexOf(String(r.Tur)) >= 0);
    console.log('\n=== 📒 06r_Ijro_kun / 06q_Qoidabuzarlik — nusxa varaqlarda ===');
    console.log('Eski tizim bugun yozgan: 06r ' + kunB.length + ' qator · 06q kechki qoidabuzarlik ' + qB.length + ' ta (nusxadan olib tashlandi — server qayta yozadi)');
    if (qB.length) { const g = await G.gid(ID, nq, KEY);
      await G.soralar(ID, qB.map(r => r.qator).sort((a, b) => b - a).map(q => ({ deleteDimension: { range: { sheetId: g, dimension: 'ROWS', startIndex: q - 1, endIndex: q } } })), KEY); }
    const t0 = Date.now();
    const r = await IK.ijroKechki(await VQ.adminKod(), { varaq: { kun: nk, q: nq }, tgYoq: true });
    console.log('Server: ' + r.natija + ' (' + ((Date.now() - t0) / 1000).toFixed(1) + ' s)');
    const K1 = await IY.ijroQatorYangi(nk, Qd.IJRO_KS), Q1 = await IY.ijroQatorYangi(nq, IY.IJRO_S);
    const kunB1 = K1.filter(r2 => iso(r2.Sana) === bugun);
    const ok06r = kunB1.length === r.kun06r && (!kunB.length || kunB1.length >= kunB.length);
    console.log('06r bugungi qatorlar: oldin ' + kunB.length + ' → keyin ' + kunB1.length + ' (server ' + r.kun06r + ' xodimga yozdi)' + (ok06r ? ' ✅ takror qator yo\'q' : ' ✖ takror yoki yo\'qolgan qator'));
    if (!ok06r) x++;
    const eskiK = K1.filter(r2 => iso(r2.Sana) < bugun).pop();
    if (r.kunLog && r.kunLog.length && eskiK) x += await qatorSolishtir(nk, r.kunLog[0].qator, 1, 12, '— 06r qatori (A–L)', eskiK.qator);
    const yangiQ = Q1.filter(r2 => iso(r2.Sana) === bugun && KT.indexOf(String(r2.Tur)) >= 0);
    const ek = new Set(qB.map(r2 => String(r2.Kalit))), sk = new Set(yangiQ.map(r2 => String(r2.Kalit)));
    console.log('06q: server ' + yangiQ.length + ' ta yozdi · eski tizim 18:15 da ' + qB.length + ' ta · ikkalasida bir xil kalit ' + yangiQ.filter(r2 => ek.has(String(r2.Kalit))).length + ' ta');
    yangiQ.filter(r2 => !ek.has(String(r2.Kalit))).forEach(r2 => console.log('  🆕 faqat server: ' + r2.Xodim + ' — ' + r2.Kalit));
    qB.filter(r2 => !sk.has(String(r2.Kalit))).forEach(r2 => console.log('  ⚪ faqat eski: ' + r2.Xodim + ' — ' + r2.Kalit));
    const id = yangiQ.map(r2 => Number(r2.ID)); if (new Set(id).size !== id.length) { console.log('  ✖ ID takrorlangan'); x++; }
    const eskiQ = Q1.filter(r2 => !(iso(r2.Sana) === bugun && KT.indexOf(String(r2.Tur)) >= 0)).pop();
    if (yangiQ.length && eskiQ) x += await qatorSolishtir(nq, yangiQ[0].qator, 1, 17, '— 06q qatori (A–Q)', eskiQ.qator);
    else console.log('  (06q ga yangi qator yozilmadi — format solishtirilmadi)');
    console.log('(Server hozirgi holatni oladi, eski tizim 18:15 dagisini — shu orada qilingan ish farq berishi mumkin; bu xato emas.)');
  } finally {
    if (ochir.length) await G.soralar(ID, ochir.map(g => ({ deleteSheet: { sheetId: g } })), KEY).catch(e => console.log('Nusxani o\'chirib bo\'lmadi: ' + e.message));
    console.log('Nusxa varaqlar o\'chirildi.');
  }
  console.log('');
  if (!x) console.log('✅ YOZUV BIR XIL — 06r va 06q to\'g\'ri yoziladi.');
  else console.log('⚠ ' + x + ' ta farq — ijro_kechki ni YOQMANG, Claude\'ga ko\'rsating.');
}

// 🔑 07b KIRISH JURNALI (Monitoring.gs monKirishYoz_): nusxa varaqqa server yo'li bilan qator — eski tizim yozgan oxirgi qator bilan (qiymat turi, format)
async function kirishSinov() {
  const KY = require('../api/kirish_yoz');
  const M = await G.varaqlar(ID, KEY);
  const src = M.varaqlar.find(v => v.title === KY.KIRISH_V); if (!src) { console.log('07b_Kirish_jurnali varag\'i yo\'q — solishtirib bo\'lmaydi.'); return; }
  const nusxa = 'zz_sinov_' + KY.KIRISH_V;
  const j = await G.soralar(ID, [{ duplicateSheet: { sourceSheetId: src.sheetId, insertSheetIndex: M.varaqlar.length, newSheetName: nusxa } }], KEY);
  const ng = j.replies[0].duplicateSheet.properties.sheetId; let x = 0;
  try {
    await G.gid(ID, nusxa, KEY, true);
    console.log('\n=== 🔑 07b_Kirish_jurnali — PIN kirishi qatori (nusxa varaqda) ===');
    const A0 = await G.ustunOqi(ID, nusxa, 'A', KEY);
    const t0 = Date.now();
    await KY.kirishYoz('SINOV XODIM', 'PIN', nusxa);
    const A1 = await G.ustunOqi(ID, nusxa, 'A', KEY);
    console.log('Yozish: ' + (Date.now() - t0) + ' ms · oxirgi qator ' + A0.length + ' → ' + A1.length + (A1.length === A0.length + 1 ? ' ✅' : ' ⚠'));
    if (A1.length !== A0.length + 1) x++;
    x += await qatorSolishtir(nusxa, A1.length, 1, 4, '— Kirish qatori (A Sana, B Vaqt, C FISH, D Usul)');
  } finally {
    await G.soralar(ID, [{ deleteSheet: { sheetId: ng } }], KEY).catch(e => console.log('Nusxani o\'chirib bo\'lmadi: ' + e.message));
    console.log('\nNusxa varaq o\'chirildi.');
  }
  console.log('');
  if (!x) { await redis.set('yozuv_yondi:kirish07b', '1'); console.log('✅ HAMMASI BIR XIL — 🔑 PIN kirishi 07b ga endi server o\'zi yozadi (eski tizimga pinKir yuborilmaydi). Qaytarish: aks-yozuv-sinov ochir'); }
  else console.log('⚠ ' + x + ' ta farq — YOQILMADI (avvalgidek eski tizim orqali).');
}

// 👤 MIJOZ KARTASI PDF (Mijoz.gs mijozKartaPdf): bir nechta mijoz uchun eski tizim PDF'i (direktor nomidan, ko'prik) va server PDF'i — matn, sahifalar,
// so'zlar joyi. Sahifa chekkasi ikki variantda sinaladi: HTML'dagi @page (14 mm / 12 mm) yoki Google standarti (0,5 dyuym) — moslari tanlanadi.
// Vaqt («… ҳолатига») eski PDF dagidek beriladi. Mijoz berilmasa — qarzi bor sotuv, ijara va do'koni bor mijoz avtomatik tanlanadi. Hech narsa yozilmaydi.
async function mijozpdfSinov(midlar) {
  const MP = require('../api/mijoz_pdf')._ichki, s = v => String(v == null ? '' : v);
  if (!(await PDF.bor())) { console.log('⏳ PDF dasturi (Chromium) hali tayyor emas — 3 daqiqadan keyin qayta ishga tushiring.'); return; }
  try { execFileSync('pdftotext', ['-v'], { stdio: 'ignore' }); } catch (e) { console.log('⚠ pdftotext yo\'q (poppler-utils) — solishtirib bo\'lmaydi.'); return; }
  const adm = (await pool.query('SELECT kirish_kodi, huquqlar FROM v_xodimlar WHERE kompaniya_id = 1')).rows.find(z => (z.huquqlar || []).includes('admin') && String(z.kirish_kodi || '').length >= 8);
  const tok = await S.sessiyaOch(adm.kirish_kodi), ks = adm.kirish_kodi + '|' + tok;
  if (!midlar.length) {
    const R3 = (await V.qatorlar('03_Sotuv_shartnomalar')).filter(z => s(z.r[0]).trim() && !/bekor/i.test(s(z.r[13])));
    const R4 = (await V.qatorlar('04_Ijara_shartnomalar')).filter(z => s(z.r[0]).trim() && !/bekor/i.test(s(z.r[2])));
    const a = R3.filter(z => V.son(z.x[31]) > 0).pop(), b = R4[R4.length - 1], c = R3[0];
    [a && s(a.r[4]).trim(), b && s(b.r[5]).trim(), c && s(c.r[4]).trim()].filter(Boolean).forEach(m => { if (midlar.indexOf(m) < 0) midlar.push(m); });
  }
  const natija = { html: 0, google: 0 }; let xato = 0;
  try {
    for (const mid of midlar) {
      console.log('\n=== 👤 MIJOZ KARTASI — mijoz ID ' + mid + ' ===');
      let t0 = Date.now(), e;
      try { e = await koprik.chaqir('mijozKartaPdf', adm.kirish_kodi, [mid], { muddat: 120000, urinish: 1 }); } catch (er) { console.log('  ✖ eski tizim: ' + er.message); xato++; continue; }
      const te = Date.now() - t0;
      const eb = Buffer.from(e.b64, 'base64');
      const vq = (/(\d{2}\.\d{2}\.\d{4} \d{2}:\d{2}) ҳолатига/.exec(pdfMatn(eb).matn) || [])[1] || '';
      for (const v of ['html', 'google']) {
        t0 = Date.now();
        let y; try { y = await MP.kartaPdfYasa(ks, mid, { bugun: vq, sahifa: v }); } catch (er) { console.log('  ✖ server (' + v + '): ' + er.message); natija[v]++; continue; }
        const ty = Date.now() - t0;
        console.log('\n  — sahifa varianti «' + v + '» · eski tizim ' + (te / 1000).toFixed(1) + ' s · server ' + (ty / 1000).toFixed(1) + ' s · vaqt ' + vq);
        if (e.nom !== y.nom || e.mime !== y.mime) { natija[v]++; console.log('  ✖ fayl nomi: eski ' + e.nom + ' | server ' + y.nom); }
        const yb = Buffer.from(y.b64, 'base64');
        natija[v] += pdfSolishtir(eb, yb);
        const q = sozSolishtir(eb, yb);
        if (q.sozlar[0] !== q.sozlar[1] || q.betlar[0] !== q.betlar[1] || q.farq) { natija[v]++; console.log('  ✖ so\'zlar joyi: eski ' + q.sozlar[0] + ' / server ' + q.sozlar[1] + ' so\'z, betlar ' + q.betlar.join('/') + ', ' + q.farq + ' ta farq, eng katta og\'ish ' + q.dmax.toFixed(2) + ' pt'); q.ch.slice(0, 4).forEach(c => console.log('     ' + c));
          if (q.sozlar[0] === q.sozlar[1] && v === 'html') {   // qaysi belgi kengligi farq qiladi — surilgan so'zdan oldingi so'zlar (eni bilan)
            const A = sozJoy(eb), B = sozJoy(yb); let n = 0;
            for (let i = 1; i < A.length && n < 6; i++) { if (A[i][1] !== B[i][1] || Math.abs(A[i][2] - B[i][2]) < 0.9) continue; n++;
              const k = s2 => s2.length > 14 ? s2.slice(0, 13) + '…' : s2;
              console.log('     «' + k(A[i][1]) + '»dan oldin: ' + [i - 2, i - 1].filter(j => j >= 0).map(j => '«' + k(A[j][1]) + '» eski x ' + A[j][2].toFixed(1) + '–' + A[j][4].toFixed(1) + ' (eni ' + (A[j][4] - A[j][2]).toFixed(2) + ') server ' + B[j][2].toFixed(1) + '–' + B[j][4].toFixed(1) + ' (eni ' + (B[j][4] - B[j][2]).toFixed(2) + ')').join(' · ')); }
          } }
        else console.log('  ✅ ' + q.sozlar[0] + ' so\'zning joyi bir xil (eng katta og\'ish ' + q.dmax.toFixed(2) + ' pt)');
      }
    }
  } finally { await redis.del('ses:' + tok); }
  console.log('\nNatija: «html» varianti — ' + (natija.html ? natija.html + ' ta farq' : 'BIR XIL') + ' · «google» varianti — ' + (natija.google ? natija.google + ' ta farq' : 'BIR XIL'));
  const tanlov = !natija.html ? 'html' : !natija.google ? 'google' : '';
  if (!xato && tanlov && midlar.length) { await redis.set('mijoz_karta_sahifa', tanlov); await redis.set('yozuv_yondi:mijoz_karta_pdf', '1'); console.log('✅ HAMMASI BIR XIL («' + tanlov + '» sahifa) — 👤 mijoz kartasi PDF endi serverda yasaladi. Qaytarish: aks-yozuv-sinov ochir'); }
  else console.log('⚠ ' + (xato ? xato + ' ta eski tizim xatosi' : 'ikkala variantda ham farq') + ' — YOQILMADI (eski tizim orqali ishlayveradi).');
}

// 📌 MENING TOPSHIRIQLARIM (Topshiriq.gs topMening → topHalHujjat_): har ishlayotgan xodim uchun server «quruq» hisoblaydi — qaysi hujjat topshiriqlari
// darhol «Tekshiruvda» / «Bajarildi» bo'ladi; yopiladigani bor xodim uchun eski tizim topMening haqiqatan yozadi (xodim sahifani ochgandagidek, Telegram ham) →
// 10_Topshiriqlar dagi o'zgargan qatorlar server hisobi bilan (holat, yopdi, dalil, U). Hech kimda bo'lmasa — «hech narsa yo'q» mosligi.
async function topmeningSinov() {
  const TA = require('../api/top_avto')._ichki, s = v => String(v == null ? '' : v);
  const X = (await pool.query("SELECT fish, kirish_kodi FROM v_xodimlar WHERE kompaniya_id = 1 AND holat = 'Ishlayapti' AND kirish_kodi <> '' AND huquq_matn <> '' ORDER BY qator_no")).rows;
  const adm = (await pool.query('SELECT kirish_kodi, huquqlar FROM v_xodimlar WHERE kompaniya_id = 1')).rows.find(z => (z.huquqlar || []).includes('admin') && String(z.kirish_kodi || '').length >= 8);
  let ver = '?'; try { ver = String(await koprik.chaqir('koprikVersiya', adm.kirish_kodi, [])); } catch (e) { ver = 'xato: ' + e.message; }
  const k17 = verOk(ver, '1.7') && !/^xato/.test(ver);
  console.log('Eski tizim ko\'prigi: v' + ver + (k17 ? ' ✅' : ' ⚠ (1.7 kerak — tekshiruvchiga Telegram)'));
  console.log('\n=== 📌 MENING TOPSHIRIQLARIM — hujjat topshiriqlari (server quruq hisob → eski tizim topMening) ===');
  let x = 0, jami = 0;
  for (const xd of X) {
    const R0 = await TP.topRowsYangi(TP.TOP_V);
    const q = await TA.topMeningYop({ fish: xd.fish, kod: xd.kirish_kodi }, { quruq: true });
    if (!q || !q.yop.length) { console.log('  ' + xd.fish + ': yopiladigan hujjat topshirig\'i yo\'q'); continue; }
    jami += q.yop.length;
    console.log('  ' + xd.fish + ': server ' + q.yop.length + ' ta → ' + q.yop.map(z => '№' + z.id + ' ' + z.holat).join(', ') + ' · eski tizim topMening…');
    let o; try { o = await koprik.chaqir('topMening', xd.kirish_kodi, [], { muddat: 120000, urinish: 1 }); } catch (e) { console.log('    ✖ eski tizim: ' + e.message); x++; continue; }
    const R1 = await TP.topRowsYangi(TP.TOP_V);
    const old = {}; R0.L.forEach(z => old[z.id] = z);
    const ozg = R1.L.filter(z => old[z.id] && old[z.id].holati === 'Jarayonda' && z.holati !== 'Jarayonda');
    q.yop.forEach(p => {
      const z = R1.L.find(t => s(t.id) === s(p.id));
      if (!z || z.holati === 'Jarayonda') { x++; console.log('    ✖ server yopmoqchi, eski yopmagan: №' + p.id + ' → ' + p.holat); return; }
      const f = [];
      if (z.holati !== p.holat) f.push('holati eski «' + z.holati + '» server «' + p.holat + '»');
      if (s(z.yopdi) !== s(p.kim)) f.push('yopdi eski «' + z.yopdi + '» server «' + p.kim + '»');
      if (s(z.dalil) !== s(p.dalil)) f.push('dalil eski «' + qisqa(z.dalil, 50) + '» server «' + qisqa(p.dalil, 50) + '»');
      if (p.hj && z.isbot !== 'HJ:' + p.hj) f.push('U eski «' + z.isbot + '» server «HJ:' + p.hj + '»');
      if (f.length) { x++; console.log('    ✖ №' + p.id + ': ' + f.join('; ')); } else console.log('    ✅ №' + p.id + ' → ' + z.holati + ' (' + z.yopdi + '): ' + qisqa(z.dalil, 60));
    });
    ozg.filter(z => !q.yop.some(p => s(p.id) === s(z.id))).forEach(z => { x++; console.log('    ✖ eski yopgan, server kutmagan: №' + z.id + ' → ' + z.holati + ' (' + z.yopdi + ')'); });
    if (o && o.son) console.log('    eski javobi: ochiq ' + o.son.ochiq + ', kechikkan ' + o.son.kechikkan);
  }
  await tetik.varaqlarYangila([TP.TOP_V]).catch(() => {});
  console.log('');
  if (!x && k17) { await redis.set('yozuv_yondi:top_mening', '1'); console.log('✅ HAMMASI BIR XIL — 📌 «Topshiriqlarim»: yuklangan hujjat topshiriqlarini yopish endi serverda (eski tizimga o\'tmaydi; tekshiruvchiga Telegram — ko\'prik).' + (!jami ? '\n   (Bu safar hech kimda yopiladigan hujjat topshirig\'i yo\'q edi — «hech narsa yo\'q» mosligi; yozuv yo\'li qadamSkan va topHozir sinovlarida tasdiqlangan.)' : '') + ' Qaytarish: aks-yozuv-sinov ochir'); }
  else console.log('⚠ ' + (x ? x + ' ta farq' : 'Koprik 1.7 emas') + ' — YOQILMADI (eski tizim orqali ishlayveradi).');
}

// 🤖 TOPSHIRIQ QOIDALARI (Topshiriq.gs topAvto / topHozir): server «quruq» hisoblaydi (hech narsa yozmaydi) → eski tizim topHozir haqiqatan yozadi →
// 10_Topshiriqlar dagi yangi qatorlar va holati o'zgargan qatorlar server hisobi bilan solishtiriladi (kalit, sarlavha, izoh, mas'ul, muddat, muhimlik; yopish sababi).
// Eski tizim yozadi va Telegram yuboradi — bu uning oddiy ishi (trigger 2 soatda shuni qiladi).
async function tophozirSinov() {
  const TA = require('../api/top_avto')._ichki, s = v => String(v == null ? '' : v), n0 = v => s(v).replace(/ /g, ' ');
  const adm = (await pool.query('SELECT kirish_kodi, huquqlar FROM v_xodimlar WHERE kompaniya_id = 1')).rows.find(z => (z.huquqlar || []).includes('admin') && String(z.kirish_kodi || '').length >= 8);
  let ver = '?'; try { ver = String(await koprik.chaqir('koprikVersiya', adm.kirish_kodi, [])); } catch (e) { ver = 'xato: ' + e.message; }
  const k15 = verOk(ver, '1.5') && !/^xato/.test(ver), k112 = verOk(ver, '1.12') && !/^xato/.test(ver);
  console.log('Eski tizim ko\'prigi: v' + ver + (k15 ? ' ✅' : ' ⚠ (1.5 kerak — Telegram)') + (k112 ? '' : ' · skan nazorati (koprikSkanNaz) uchun 1.12 kerak — hozircha eski trigger o\'zi qiladi'));
  console.log('Ko\'zgu yangilanmoqda (eski tizim bilan bir xil ma\'lumot bo\'lsin)…'); const tk = Date.now(); await tetik.yangilaKut(90000); console.log('  ' + ((Date.now() - tk) / 1000).toFixed(0) + ' s');
  console.log('\n=== 🤖 TOPSHIRIQ QOIDALARI — server hisobi (quruq) ===');
  const R0 = await TP.topRowsYangi(TP.TOP_V);
  const t0 = Date.now();
  const q = await TA.topAvto(adm.kirish_kodi, { quruq: true });
  console.log('Server: nomzod ' + q.nomzod + ' ta (band ' + q.band + ') → yangi ' + q.yangi.length + ' ta, yopiladi ' + q.yop.length + ' ta · ' + ((Date.now() - t0) / 1000).toFixed(1) + ' s');
  q.yangi.forEach(o => console.log('  + ' + o.kalit + ' → ' + o.kimga + ' · ' + o.muddat + ' · ' + o.muhim + ' · «' + qisqa(o.sarlavha, 40) + '» · ' + qisqa(n0(o.izoh), 60)));
  q.yop.forEach(z => console.log('  − №' + z.id + ' → ' + z.holat + ' (' + z.kim + '): ' + qisqa(z.dalil, 70)));
  console.log('\n=== eski tizim topHozir (haqiqatan yozadi) ===');
  const t1 = Date.now(); let o;
  try { o = await koprik.chaqir('topHozir', adm.kirish_kodi, [], { muddat: 180000, urinish: 1 }); } catch (e) { console.log('  ✖ eski tizim: ' + e.message); o = null; }
  if (!o) { console.log('⚠ eski tizim javob bermadi — YOQILMADI.'); return; }
  console.log('Eski tizim: ' + JSON.stringify(o) + ' · ' + ((Date.now() - t1) / 1000).toFixed(1) + ' s');
  if (o.ok === false) { console.log('⚠ eski tizim band (lock) — birozdan keyin qayta ishga tushiring.'); return; }
  const R1 = await TP.topRowsYangi(TP.TOP_V);
  let x = 0;
  const yangiQ = R1.L.filter(t => t.qator > R0.l);
  console.log('\n— Yangi qatorlar: eski tizim ' + yangiQ.length + ' ta (javobida ' + o.yangi + '), server ' + q.yangi.length + ' ta');
  const U = [['qoida', 'qoida'], ['kalit', 'kalit'], ['sarlavha', 'sarlavha'], ['izoh', 'izoh'], ['no', 'no'], ['mid', 'mid'], ['kimga', 'kimga'], ['kimBerdi', 'kimBerdi'], ['muddat', 'muddat'], ['muhim', 'muhim']];
  q.yangi.forEach(p => {
    const t = yangiQ.find(z => z.kalit === p.kalit);
    if (!t) { x++; console.log('  ✖ server kutgan, eski yozmagan: ' + p.kalit + ' (' + p.kimga + ')'); return; }
    const f = U.filter(([a, b]) => n0(p[a]) !== n0(t[b])).concat(t.manba !== 'Tizim' ? [['manba']] : [], t.holati !== 'Jarayonda' ? [['holati']] : []);
    if (f.length) { x++; console.log('  ✖ ' + p.kalit + ': ' + f.map(([a, b]) => a + ' — eski «' + qisqa(n0(t[b || a]), 50) + '» server «' + qisqa(n0(p[a]), 50) + '»').join('; ')); }
    else console.log('  ✅ ' + p.kalit + ' → ' + t.kimga + ' · ' + t.muddat + ' (№' + t.id + ')');
  });
  yangiQ.filter(t => !q.yangi.some(p => p.kalit === t.kalit)).forEach(t => { x++; console.log('  ✖ eski yozgan, server kutmagan: ' + t.kalit + ' (' + t.kimga + ', ' + t.manba + ') №' + t.id); });
  const eskiHol = {}; R0.L.forEach(t => eskiHol[t.id] = t);
  const ozg = R1.L.filter(t => eskiHol[t.id] && eskiHol[t.id].holati === 'Jarayonda' && t.holati !== 'Jarayonda');
  console.log('\n— Holati o\'zgargan (yopilgan / tekshiruvga) qatorlar: eski tizim ' + ozg.length + ' ta (javobida ' + o.yopildi + '), server ' + q.yop.length + ' ta');
  q.yop.forEach(p => {
    const t = R1.L.find(z => s(z.id) === s(p.id));
    if (!t || t.holati === 'Jarayonda') { x++; console.log('  ✖ server yopmoqchi, eski yopmagan: №' + p.id + ' → ' + p.holat + ' (' + p.dalil + ')'); return; }
    const f = [];
    if (t.holati !== p.holat) f.push('holati eski «' + t.holati + '» server «' + p.holat + '»');
    if (n0(t.yopdi) !== n0(p.kim)) f.push('yopdi eski «' + t.yopdi + '» server «' + p.kim + '»');
    if (n0(t.dalil) !== n0(p.dalil)) f.push('dalil eski «' + qisqa(t.dalil, 50) + '» server «' + qisqa(p.dalil, 50) + '»');
    if (p.hj && t.isbot !== 'HJ:' + p.hj) f.push('U eski «' + t.isbot + '» server «HJ:' + p.hj + '»');
    if (f.length) { x++; console.log('  ✖ №' + p.id + ': ' + f.join('; ')); } else console.log('  ✅ №' + p.id + ' → ' + t.holati + ' (' + t.yopdi + '): ' + qisqa(t.dalil, 60));
  });
  ozg.filter(t => !q.yop.some(p => s(p.id) === s(t.id))).forEach(t => { if (t.yopdi === 'tizim' || t.holati === 'Tekshiruvda') { x++; console.log('  ✖ eski yopgan, server kutmagan: №' + t.id + ' → ' + t.holati + ' (' + t.yopdi + '): ' + qisqa(t.dalil, 60)); }
    else console.log('  (№' + t.id + ' ni shu orada xodim yopdi: ' + t.yopdi + ' — hisobga olinmadi)'); });
  await tetik.varaqlarYangila([TP.TOP_V]).catch(() => {});
  console.log('');
  if (!x && k15) { await redis.set('yozuv_yondi:top_avto', '1'); console.log('✅ HAMMASI BIR XIL — 🤖 «Hozir tekshirish» endi serverda (yangi topshiriqlar, avtomatik yopish, xodimga Telegram — ko\'prik). Eski 2 soatlik trigger ishlayveradi.' + (!q.yangi.length && !q.yop.length ? '\n   (Bu safar ikkala tomonda ham yangi topshiriq va yopish yo\'q edi — nomzodlar ' + q.nomzod + ' ta, hammasi band; «hech narsa yo\'q» mosligi tasdiqlandi. Keyingi haqiqiy topshiriq ochilganda aks-bugun ko\'rsatadi.)' : '') + ' Qaytarish: aks-yozuv-sinov ochir'); }
  else console.log('⚠ ' + (x ? x + ' ta farq' : 'Koprik 1.5 emas') + ' — YOQILMADI (eski tizim orqali ishlayveradi).');
}

(async () => {
  const arg = process.argv[2];
  if (arg === 'devon') {
    console.log('Hozir: kirim xat — ' + ((await redis.get('yozuv_yondi:devon')) === '1' ? 'serverda' : 'eski tizimda'));
    const M = await G.varaqlar(ID, KEY);
    const eski = M.varaqlar.filter(v => /^zz_sinov_/.test(v.title));
    if (eski.length) await G.soralar(ID, eski.map(v => ({ deleteSheet: { sheetId: v.sheetId } })), KEY);
    await devonSinov();
  } else if (arg === 'kb') {
    console.log('Hozir: kelishuv hujjati — ' + ((await redis.get('yozuv_yondi:kb')) === '1' ? 'serverda' : 'eski tizimda'));
    const M = await G.varaqlar(ID, KEY);
    const eski = M.varaqlar.filter(v => /^zz_sinov_/.test(v.title));
    if (eski.length) await G.soralar(ID, eski.map(v => ({ deleteSheet: { sheetId: v.sheetId } })), KEY);
    await kbSinov();
  } else if (arg === 'kb2') {
    console.log('Hozir: kelishuv skan/bekor/tasdiq — ' + ((await redis.get('yozuv_yondi:kb2')) === '1' ? 'serverda' : 'eski tizimda'));
    const M = await G.varaqlar(ID, KEY);
    const eski = M.varaqlar.filter(v => /^zz_sinov_/.test(v.title));
    if (eski.length) await G.soralar(ID, eski.map(v => ({ deleteSheet: { sheetId: v.sheetId } })), KEY);
    await kb2Sinov();
  } else if (arg === 'sifat') {
    console.log('Hozir: ko\'rish rejimi — ' + ((await redis.get('yozuv_yondi:sifat')) === '1' ? 'yangi saytda' : 'eski saytda (ko\'prik)'));
    await sifatSinov();
  } else if (arg === 'devon2') {
    console.log('Hozir: devonxona qolgan amallari — ' + ((await redis.get('yozuv_yondi:devon2')) === '1' ? 'serverda' : 'eski tizimda'));
    await devon2Sinov();
  } else if (arg === 'devonxat') {
    console.log('Hozir: blankadagi chiquvchi xat — ' + ((await redis.get('yozuv_yondi:devon_xat')) === '1' ? 'serverda' : 'eski tizimda'));
    await devonxatSinov();
  } else if (arg === 'ertalab') {
    await ertalabSinov();
  } else if (arg === 'ijrokun') {
    const M = await G.varaqlar(ID, KEY);
    const eski = M.varaqlar.filter(v => /^zz_sinov_/.test(v.title));
    if (eski.length) await G.soralar(ID, eski.map(v => ({ deleteSheet: { sheetId: v.sheetId } })), KEY);
    await ijrokunSinov();
  } else if (arg === 'kirish') {
    console.log('Hozir: 07b kirish jurnali — ' + ((await redis.get('yozuv_yondi:kirish07b')) === '1' ? 'serverda' : 'eski tizimda (pinKir ko\'prik)'));
    const M = await G.varaqlar(ID, KEY);
    const eski = M.varaqlar.filter(v => /^zz_sinov_/.test(v.title));
    if (eski.length) await G.soralar(ID, eski.map(v => ({ deleteSheet: { sheetId: v.sheetId } })), KEY);
    await kirishSinov();
  } else if (arg === 'mijozpdf') {
    console.log('Hozir: mijoz kartasi PDF — ' + ((await redis.get('yozuv_yondi:mijoz_karta_pdf')) === '1' ? 'serverda (sahifa: ' + (await redis.get('mijoz_karta_sahifa')) + ')' : 'eski tizimda'));
    await mijozpdfSinov(process.argv.slice(3).map(z => String(z).trim()).filter(Boolean));
  } else if (arg === 'topmening') {
    console.log('Hozir: Topshiriqlarim (hujjat topshiriqlarini yopish) — ' + ((await redis.get('yozuv_yondi:top_mening')) === '1' ? 'serverda' : 'eski tizimda'));
    await topmeningSinov();
  } else if (arg === 'tophozir') {
    console.log('Hozir: topshiriq qoidalari (Hozir tekshirish) — ' + ((await redis.get('yozuv_yondi:top_avto')) === '1' ? 'serverda' : 'eski tizimda'));
    await tophozirSinov();
  } else if (arg === 'tekshir') {
    console.log('Hozir: tekshiruv javobi — ' + ((await redis.get('yozuv_yondi:ijro_tekshir')) === '1' ? 'serverda' : 'eski tizimda'));
    const M = await G.varaqlar(ID, KEY);
    const eski = M.varaqlar.filter(v => /^zz_sinov_/.test(v.title));
    if (eski.length) await G.soralar(ID, eski.map(v => ({ deleteSheet: { sheetId: v.sheetId } })), KEY);
    await tekshirSinov();
  } else if (arg === 'imzosiz') {
    console.log('Hozir: imzolanmagan ijara — ' + ((await redis.get('yozuv_yondi:imzosiz')) === '1' ? 'serverda' : 'eski tizimda'));
    const M = await G.varaqlar(ID, KEY);
    const eski = M.varaqlar.filter(v => /^zz_sinov_/.test(v.title));
    if (eski.length) await G.soralar(ID, eski.map(v => ({ deleteSheet: { sheetId: v.sheetId } })), KEY);
    await imzosizSinov();
  } else if (arg === 'shpdf') {
    console.log('Hozir: shartnoma PDF — ' + ((await redis.get('yozuv_yondi:shartnoma_pdf')) === '1' ? 'serverda' : 'eski tizimda'));
    await shpdfSinov(process.argv.slice(3).map(z => String(z).trim().toUpperCase()));
  } else if (arg === 'qaytahuj') {
    console.log('Hozir: qayta tuzish hujjatlari — ' + ((await redis.get('yozuv_yondi:qayta_hujjat')) === '1' ? 'serverda' : 'eski tizimda'));
    await qaytahujSinov();
  } else if (arg === 'qaytabekor') {
    console.log('Hozir: qayta tuzish bekor qilish — ' + ((await redis.get('yozuv_yondi:qayta_bekor')) === '1' ? 'serverda' : 'eski tizimda'));
    await qaytabekorSinov();
  } else if (arg === 'qayta2') {
    console.log('Hozir: qayta tuzish tasdiq/loyiha — ' + ((await redis.get('yozuv_yondi:qayta2')) === '1' ? 'serverda' : 'eski tizimda'));
    const M = await G.varaqlar(ID, KEY);
    const eski = M.varaqlar.filter(v => /^zz_sinov_/.test(v.title));
    if (eski.length) await G.soralar(ID, eski.map(v => ({ deleteSheet: { sheetId: v.sheetId } })), KEY);
    await qayta2Sinov();
  } else if (arg === 'qayta') {
    console.log('Hozir: qayta tuzish yozuvlari — ' + ((await redis.get('yozuv_yondi:qayta')) === '1' ? 'serverda' : 'eski tizimda'));
    const M = await G.varaqlar(ID, KEY);
    const eski = M.varaqlar.filter(v => /^zz_sinov_/.test(v.title));
    if (eski.length) await G.soralar(ID, eski.map(v => ({ deleteSheet: { sheetId: v.sheetId } })), KEY);
    await qaytaSinov();
  } else if (arg === 'bekor') {
    console.log('Hozir: bekor qilish — ' + ((await redis.get('yozuv_yondi:bekor')) === '1' ? 'serverda' : 'eski tizimda'));
    const M = await G.varaqlar(ID, KEY);
    const eski = M.varaqlar.filter(v => /^zz_sinov_/.test(v.title));
    if (eski.length) await G.soralar(ID, eski.map(v => ({ deleteSheet: { sheetId: v.sheetId } })), KEY);
    await bekorSinov();
  } else if (arg === 'xatchiqar') {
    console.log('Hozir: xat chiqarish — ' + ((await redis.get('yozuv_yondi:xat_chiqar')) === '1' ? 'serverda' : 'eski tizimda'));
    const M = await G.varaqlar(ID, KEY);
    const eski = M.varaqlar.filter(v => /^zz_sinov_/.test(v.title));
    if (eski.length) await G.soralar(ID, eski.map(v => ({ deleteSheet: { sheetId: v.sheetId } })), KEY);
    await xatChiqarSinov();
  } else if (arg === 'xatpdf') {
    // lib/xat_pdf.js — soxta ma'lumotli 8 ta xat; har so'zning joyi lokal (eski Google Docs bilan solishtirilgan) natija bilan
    if (!(await PDF.bor())) { console.log('⏳ PDF dasturi (Chromium) hali tayyor emas — 3 daqiqadan keyin qayta ishga tushiring.'); }
    else {
      const t0 = Date.now(), r = await require('../lib/xat_sinov').tekshir();
      console.log(r.chiqish.join('\n'));
      console.log('\n' + (r.farq ? '⚠ ' + r.farq + ' ta xatda farq — server boshqacha joylashtiryapti, Claude\'ga ayting.' : '✅ HAMMASI BIR XIL — xatlar serverda ham eski tizimdagidek chiqadi (' + ((Date.now() - t0) / 1000).toFixed(1) + ' s).'));
      if (!r.farq) await redis.set('xat_pdf_tekshirildi', new Date().toISOString());
    }
  } else if (arg === 'ochir') {
    await redis.del('yozuv_yondi:tolov', 'yozuv_yondi:tashrif', 'yozuv_yondi:taminot', 'yozuv_yondi:hujjat', 'yozuv_yondi:topshiriq', 'yozuv_yondi:tasdiq', 'yozuv_yondi:mayda', 'yozuv_yondi:shartnoma', 'yozuv_yondi:eksport', 'yozuv_yondi:eksport_pdf', 'yozuv_yondi:hisobot_pdf', 'yozuv_yondi:qadam', 'yozuv_yondi:qadam_ruxsat', 'yozuv_yondi:tahrir', 'yozuv_yondi:qadam_hujjat', 'yozuv_yondi:xat_isbot', 'yozuv_yondi:bajardim', 'yozuv_yondi:yurist_sorov', 'yozuv_yondi:xat_chiqar', 'yozuv_yondi:bekor', 'yozuv_yondi:bekor_word', 'yozuv_yondi:yurist_ish', 'yozuv_yondi:yurist_hujjat', 'yozuv_yondi:yurist_aloqa', 'yozuv_yondi:qayta', 'yozuv_yondi:qayta2', 'yozuv_yondi:qayta_hujjat', 'yozuv_yondi:shartnoma_pdf', 'yozuv_yondi:ijro_tekshir', 'yozuv_yondi:imzosiz', 'yozuv_yondi:devon', 'yozuv_yondi:kb', 'yozuv_yondi:top_avto', 'yozuv_yondi:kb2', 'yozuv_yondi:imzosiz_bekor', 'yozuv_yondi:devon_kordi', 'yozuv_yondi:top_mening', 'yozuv_yondi:mijoz_karta_pdf', 'yozuv_yondi:kirish07b', 'yozuv_yondi:sifat', 'yozuv_yondi:qayta_bekor', 'yozuv_yondi:devon2', 'yozuv_yondi:devon_xat', 'yozuv_yondi:tg', 'yozuv_yondi:tg_kirish');
    console.log('⏸ Serverda yozish O\'CHIRILDI — to\'lov, tashrif, ta\'minot, hujjat tuzatish, topshiriq, tasdiqlash, shartnoma va reyestr PDF/Excel yana eski tizim orqali.');
  } else if (arg === 'yurhujjat') {
    const holat = async n => (await redis.get('yozuv_yondi:' + n)) === '1' ? 'serverda' : 'eski tizimda';
    console.log('Hozir: yurist hujjatlari — ' + await holat('yurist_hujjat') + ', aloqa xati — ' + await holat('yurist_aloqa'));
    const M = await G.varaqlar(ID, KEY);
    const eski = M.varaqlar.filter(v => /^zz_sinov_/.test(v.title));
    if (eski.length) await G.soralar(ID, eski.map(v => ({ deleteSheet: { sheetId: v.sheetId } })), KEY);
    await yuristHujjatSinov();
  } else if (arg === 'yhnamuna') {
    await yhNamuna(process.argv[3]);
  } else if (arg === 'yuristish') {
    console.log('Hozir: to\'g\'ridan-to\'g\'ri yuristga va yurist topshirig\'i — ' + ((await redis.get('yozuv_yondi:yurist_ish')) === '1' ? 'serverda' : 'eski tizimda'));
    const M = await G.varaqlar(ID, KEY);
    const eski = M.varaqlar.filter(v => /^zz_sinov_/.test(v.title));
    if (eski.length) await G.soralar(ID, eski.map(v => ({ deleteSheet: { sheetId: v.sheetId } })), KEY);
    await yuristIshSinov();
  } else if (arg === 'yurist') {
    console.log('Hozir: yuristga o\'tkazish so\'rovi — ' + ((await redis.get('yozuv_yondi:yurist_sorov')) === '1' ? 'serverda' : 'eski tizimda'));
    const M = await G.varaqlar(ID, KEY);
    const eski = M.varaqlar.filter(v => /^zz_sinov_/.test(v.title));
    if (eski.length) await G.soralar(ID, eski.map(v => ({ deleteSheet: { sheetId: v.sheetId } })), KEY);
    await yuristSorovSinov();
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
    const k15 = verOk(ver, '1.5') && !/^xato/.test(ver);
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
