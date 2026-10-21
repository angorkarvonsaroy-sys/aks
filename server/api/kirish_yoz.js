// AKS TIZIM — 07b_Kirish_jurnali ga yozuv serverda (Monitoring.gs v26.4 monKirishYoz_ bilan bir xil: appendRow [Sana dd.MM.yyyy, Vaqt HH:mm:ss, FISH, Usul];
// appendRow qiymatlarni o'zi talqin qiladi va KATAK FORMATINI ham o'zgartiradi: varaqda A:B '@' (matn) bo'lsa ham «21.10.2026» → SANA (DATE d.m.yyyy),
// «21:43:14» → VAQT (TIME h:mm:ss) bo'lib yoziladi (sinov, 22.10: USER_ENTERED '@' katakda matn qoldiradi). Shuning uchun A:B — son + aniq format bilan.
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
  const A = await G.ustunOqi(env.aksBazaId, v, 'A', env.googleKey);
  const q = await G.qatorQoshR(env.aksBazaId, v, A.length + 1, ['', '', String(fish || ''), String(usul || 'PIN')], env.googleKey);
  const d = h.dmy.split('.'), t = h.hms.split(':').map(Number);
  const sana = (Date.UTC(+d[2], +d[1] - 1, +d[0]) - Date.UTC(1899, 11, 30)) / 86400000, vaqt = (t[0] * 3600 + t[1] * 60 + t[2]) / 86400;
  const g = await G.gid(env.aksBazaId, v, env.googleKey);
  await G.soralar(env.aksBazaId, [{ updateCells: { range: { sheetId: g, startRowIndex: q - 1, endRowIndex: q, startColumnIndex: 0, endColumnIndex: 2 },
    rows: [{ values: [{ userEnteredValue: { numberValue: sana }, userEnteredFormat: { numberFormat: { type: 'DATE', pattern: 'd.m.yyyy' } } },
      { userEnteredValue: { numberValue: vaqt }, userEnteredFormat: { numberFormat: { type: 'TIME', pattern: 'h:mm:ss' } } }] }],
    fields: 'userEnteredValue,userEnteredFormat.numberFormat' } }], env.googleKey);
}
module.exports = { kirishYoz, yoqilgan, KIRISH_V };
