// AKS TIZIM — 07b_Kirish_jurnali ga yozuv serverda (Monitoring.gs v26.4 monKirishYoz_ bilan bir xil: appendRow [Sana dd.MM.yyyy, Vaqt HH:mm:ss, FISH, Usul];
// appendRow qiymatlarni setValue kabi talqin qiladi: «21.10.2026» → SANA (d.m.yyyy), «21:43:14» → VAQT (h:mm:ss) — sinov (22.10) eski qatorlarda shuni
// ko'rsatdi (varaqdagi A:B '@' formati amalda yo'q). Server ham USER_ENTERED bilan qo'shadi — Google o'sha talqinni beradi.
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
  await G.qatorQosh(env.aksBazaId, v, [h.dmy, h.hms, String(fish || ''), String(usul || 'PIN')], env.googleKey);
}
module.exports = { kirishYoz, yoqilgan, KIRISH_V };
