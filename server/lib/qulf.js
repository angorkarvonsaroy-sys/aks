// AKS TIZIM — Redis qulfi (eski LockService o'rni) — bir nechta fayl BITTA qulfni ishlatishi kerak bo'lganda (02.11.2026).
// qulfBilan('und', ish) — 06_Undiruv_jurnali ga yangi qator (ID = max + 1) qo'shadiganlar: api/undiruv_yoz.js undYoz va api/xat_isbot.js undXatYoz.
// Qulf 30 s da o'zi tushadi (jarayon yiqilsa ham); 30 s kutib ololmasa — «Tizim band» xatosi. Faqat o'z qulfini ochadi (belgi bilan).
'use strict';
const crypto = require('crypto');
const { redis } = require('./db');

async function qulfBilan(nom, ish, Xato = Error) {
  const kalit = 'qulf:' + nom, belgi = crypto.randomBytes(8).toString('hex'), t0 = Date.now();
  while (!(await redis.set(kalit, belgi, 'PX', 30000, 'NX'))) { if (Date.now() - t0 > 30000) throw new Xato('Tizim band — birozdan keyin qayta urinib ko\'ring.'); await new Promise(r => setTimeout(r, 150)); }
  try { return await ish(); } finally { if ((await redis.get(kalit)) === belgi) await redis.del(kalit); }
}

module.exports = { qulfBilan };
