// AKS TIZIM — Xat.gs dagi kichik yordamchilar (xatSeriya_, xatIso_, xatKechikkan_, xatJoriy_, xatZanjir_) serverda.
// xatZanjir_ eski tizimda Script Properties (XAT_ZANJIR) da turadi — varaqda emas, shuning uchun ko'zguda yo'q.
// Uni ko'prikdagi koprikZanjir (Koprik.gs v1.1) beradi; 10 daqiqa Redis'da turadi. Ko'prik yo'q / eski Koprik bo'lsa — bo'sh ({}):
// unda hamma xat «joriy zanjir» deb olinadi (faqat qarzi bir marta to'liq yopilib yana kechikkan kam sonli mijozga ta'sir qiladi).
'use strict';
const { redis } = require('./db');

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

// XAT_ZANJIR — {shartnoma: 'yyyy-MM-dd'} (qarz to'liq yopilgan kun). kod — xodimning kirish kodi (ko'prik sessiyasi uchun)
// Eski tizim (Script Properties) dan ko'prik orqali olinadi. Ko'prik sekin bo'lishi mumkin (eski tizim band — 60 s gacha),
// shuning uchun xodim hech qachon kutmaydi: oxirgi ma'lum nusxa (Redis 'xat_zanjir_zaxira', muddatsiz) darhol beriladi,
// 10 daqiqadan eskirgan bo'lsa — fonda yangilanadi. Zaxira umuman yo'q bo'lsa (birinchi marta) — bir marta kutiladi.
let zanjirXotira = { t: 0, Z: {} };
async function zanjirKoprikdan(kod) {
  const koprik = require('../api/koprik');
  if (!kod || !koprik.bor()) return null;
  const r = await koprik.chaqir('koprikZanjir', kod, []);
  if (!r || typeof r !== 'object') return null;
  const j = JSON.stringify(r);
  await redis.set('xat_zanjir', j, 'EX', 600);
  await redis.set('xat_zanjir_zaxira', j);
  return r;
}
function zanjirFonda(kod) {
  redis.set('xat_zanjir_qulf', '1', 'NX', 'EX', 120).then(ok => {
    if (!ok) return;
    zanjirKoprikdan(kod).then(Z => { if (Z) zanjirXotira = { t: Date.now(), Z }; })
      .catch(e => { if (!/topilmadi/.test(e.message)) console.error('xat zanjiri (fonda):', e.message); })
      .finally(() => redis.del('xat_zanjir_qulf').catch(() => {}));
  }).catch(() => {});
}
async function xatZanjir(kod) {
  if (Date.now() - zanjirXotira.t < 60000) return zanjirXotira.Z;
  let Z = null;
  try { const s = await redis.get('xat_zanjir'); if (s) { Z = JSON.parse(s); redis.set('xat_zanjir_zaxira', s).catch(() => {}); } } catch (e) { }
  if (!Z) {
    let zax = null;
    try { const s = await redis.get('xat_zanjir_zaxira'); if (s) zax = JSON.parse(s); } catch (e) { }
    if (zax) { Z = zax; zanjirFonda(kod); }
    else {
      try { Z = await zanjirKoprikdan(kod); } catch (e) { if (!/topilmadi/.test(e.message)) console.error('xat zanjiri (ko\'prik):', e.message); }
      Z = Z || {};
    }
  }
  zanjirXotira = { t: Date.now(), Z };
  return Z;
}

module.exports = { XAT_MIN_QARZ, XAT_BOSQICH, XAT_BOSQICH_QM, XAT_YANGI_QOIDA, xatSeriya, xatIso, xatKechikkan, xatJoriy, xatZanjir };
