// AKS TIZIM — 07b_Kirish_jurnali ga yozuv serverda (Monitoring.gs v26.4 monKirishYoz_ bilan bir xil: appendRow [Sana dd.MM.yyyy, Vaqt HH:mm:ss, FISH, Usul];
// A:B varaqda matn formatli — shuning uchun to'rttala qiymat ham MATN bo'lib, varaqning oxirgi to'ldirilgan qatoridan keyin qo'yiladi (appendCells).
// Avval PIN kirishi uchun server eski tizimga pinKir ni fonda yuborardi (faqat shu yozuv uchun) — endi kerak emas.
// Yoqilishi: Redis yozuv_yondi:kirish07b («aks-yozuv-sinov kirish»). Aks holda — avvalgidek eski tizim (ko'prik).
'use strict';
const G = require('../lib/google');
const env = require('../lib/env');
const { redis } = require('../lib/db');

const KIRISH_V = '07b_Kirish_jurnali';
function hozir() { const d = new Date(Date.now() + 5 * 3600 * 1000), p = n => String(n).padStart(2, '0');
  return { dmy: p(d.getUTCDate()) + '.' + p(d.getUTCMonth() + 1) + '.' + d.getUTCFullYear(), hms: p(d.getUTCHours()) + ':' + p(d.getUTCMinutes()) + ':' + p(d.getUTCSeconds()) }; }
async function yoqilgan() { try { return (await redis.get('yozuv_yondi:kirish07b')) === '1'; } catch (e) { return false; } }
// yozuv yadrosi (sinov ham shuni ishlatadi — nusxa varaqda)
async function kirishYoz(fish, usul, varaq) {
  const v = varaq || KIRISH_V, h = hozir();
  const g = await G.gid(env.aksBazaId, v, env.googleKey);
  await G.soralar(env.aksBazaId, [{ appendCells: { sheetId: g, fields: 'userEnteredValue',
    rows: [{ values: [h.dmy, h.hms, String(fish || ''), String(usul || 'PIN')].map(x => ({ userEnteredValue: { stringValue: x } })) }] } }], env.googleKey);
}
module.exports = { kirishYoz, yoqilgan, KIRISH_V };
