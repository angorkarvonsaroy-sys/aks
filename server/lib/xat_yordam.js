// AKS TIZIM — Xat.gs dagi kichik yordamchilar (xatSeriya_, xatIso_, xatKechikkan_, xatJoriy_, xatZanjir_, xatZanjirBelgila_) serverda.
// XAT_ZANJIR eski tizimda Script Properties'da turardi. 02.11.2026 dan — server bazasida (server_sozlama 'xat_zanjir', lib/sozlama.js),
// belgini ham server qo'yadi (xatZanjirBelgila — undPortfel har ochilganda, eski tizimdagidek). Ko'prik endi faqat bir martalik ko'chirishda.
'use strict';
const { redis } = require('./db');
const SZ = require('./sozlama');

const XAT_YANGI_QOIDA = '2026-10-02';
const XAT_YETKAZISH_KUN = 3;
const XAT_MIN_QARZ = 100000;
const XAT_BOSQICH_QM = { 1: 'Maydon farqi: bildirishnoma', 2: 'Maydon farqi: ogohlantirish', 3: 'Maydon farqi: talabnoma' };
const XAT_BOSQICH = { 1: 'Eslatma (1-xat)', 2: 'Ogohlantirish (2-xat)', 3: 'Sudgacha talabnoma' };

const xatSeriya = sh => /^QM_/.test(String(sh || '')) ? 'QM' : 'AS';
function xatIso(s) { s = String(s || '').trim(); return /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : s.split('.').reverse().join('-'); }
function xatKechikkan(h, bugunIso) {
  if (h.holati !== 'Tayyorlandi') return 0;
  const x = xatIso(h.sana); if (!/^\d{4}-\d{2}-\d{2}$/.test(x)) return 0;
  const k = Math.round((new Date(bugunIso + 'T12:00:00Z') - new Date(x + 'T12:00:00Z')) / 86400000);
  if (x >= XAT_YANGI_QOIDA) return k >= 1 ? k : 0;
  return k > XAT_YETKAZISH_KUN ? k : 0;
}
function xatJoriy(h, Z) {
  const z = (Z || {})[h.no]; if (!z || h.holati !== 'Yuborildi') return true;
  return xatIso(h.yetSana || h.sana) > z;
}

// XAT_ZANJIR — {shartnoma: 'yyyy-MM-dd'} (muddati o'tgan qarz to'liq yopilgan kun; shu kundan oldin yetkazilgan asosiy xatlar — eski zanjir).
// Birinchi o'qishda bazada bo'lmasa — eski joydan bir marta ko'chiriladi: Redis 'xat_zanjir_zaxira' (server eski tizimdan olgan oxirgi nusxa)
// → bo'lmasa ko'prik (koprikZanjir). Eski tizim umuman ulanmagan bo'lsa — bo'sh ({}) bilan boshlanadi.
async function zanjirEskidan(kod) {
  try { const s = await redis.get('xat_zanjir_zaxira'); if (s) { const Z = JSON.parse(s); if (Z && typeof Z === 'object' && !Array.isArray(Z)) return { qiymat: Z, manba: 'eski:redis' }; } } catch (e) { }
  const koprik = require('../api/koprik');
  if (!koprik.bor()) return { qiymat: {}, manba: 'bosh' };
  if (!kod) kod = await require('./vaqt').adminKod();
  const r = await koprik.chaqir('koprikZanjir', kod, []);
  return r && typeof r === 'object' && !Array.isArray(r) ? { qiymat: r, manba: 'eski:koprik' } : null;
}
// null — hali ko'chirib bo'lmadi (eski joy javob bermadi)
async function zanjirOl(kod) {
  try { return await SZ.olYokiKochir('xat_zanjir', () => zanjirEskidan(kod)); }
  catch (e) { console.error('xat zanjiri:', e.message); return null; }
}
async function xatZanjir(kod) { return (await zanjirOl(kod)) || {}; }

// Xat.gs v25.7 xatZanjirBelgila_: muddati o'tgan qarzi 100 000 so'mdan oshmaydigan shartnomada oxirgi yetkazilgan asosiy (AS) xat
// bugundan oldin bo'lsa va zanjir hali o'sha xatdan keyin belgilanmagan bo'lsa — bugungi kun belgilanadi (keyingi kechikishda xatlar 1-xatdan).
// L — xatShartnomalar (hammasi), J — xatJurnal. Qaytaradi: yangilangan zanjir (undPortfel shuni ishlatadi — eski tizimdagidek).
async function xatZanjirBelgila(L, J, bugun, kod) {
  const Z = await zanjirOl(kod);
  if (Z === null) return {};   // eski belgilar hali ko'chirilmagan — ustiga yozilmaydi, keyingi safar
  const OX = {};
  (J || []).forEach(h => { if (h.holati !== 'Yuborildi' || xatSeriya(h.shablon) !== 'AS') return;
    const d = xatIso(h.yetSana || h.sana); if (OX[h.no] === undefined || d > OX[h.no]) OX[h.no] = d; });
  const Y = {};
  (L || []).forEach(x => { if (!x || !x.no || Number(x.muddati) > XAT_MIN_QARZ) return;
    const ox = OX[x.no]; if (!ox || ox >= bugun || (Z[x.no] && Z[x.no] >= ox)) return;
    Y[x.no] = bugun; });
  if (!Object.keys(Y).length) return Z;
  try { return await SZ.qosh('xat_zanjir', Y, 'undPortfel'); }
  catch (e) { console.error('xat zanjiri (belgilash):', e.message); return Object.assign({}, Z, Y); }
}

module.exports = { XAT_MIN_QARZ, XAT_BOSQICH, XAT_BOSQICH_QM, XAT_YANGI_QOIDA, xatSeriya, xatIso, xatKechikkan, xatJoriy, xatZanjir, xatZanjirBelgila };
