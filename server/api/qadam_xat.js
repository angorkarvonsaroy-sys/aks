// AKS TIZIM — ▶ «Bugungi ish»: ✉ xat yetkazildi — isbot yuklash (Qadam.gs v2.2 bilan bir xil):
//   qadamXatYetkaz   = ruxsat_('undiruv') → xatYuborildi(kod, raqam, usul, sana, b64, sahifa, pochtaNo) → qadamMijoz; m.saqlandi = natija
//   qadamTalabYetkaz = ruxsat_('undiruv') → xatTopYuborildi(kod, topId, raqam, …) → qadamMijoz  (📨 direktor talabnomasi)
// Ikkala ichki qism ham allaqachon serverda (api/xat_isbot.js — 18.10 dan, api/qadam.js qadamMijoz) — bu yerda faqat eski tizimdagi
// o'ram: tekshiruvlar tartibi, xato matnlari va javob o'sha. Eski tizimda bu amal o'rtacha 64 s olardi (Drive + Telegram), 70 s
// ko'prik muddatidan oshib xato ham berardi; serverda isbot fayli avval diskka yoziladi, Drive va Telegram — fonda.
// Yoqilishi: xat isboti bilan bir xil — Redis yozuv_yondi:xat_isbot va Koprik ≥ 1.7. Aks holda — butunlay eski tizim.
'use strict';
const S = require('./sessiya');
const koprik = require('./koprik');
const tetik = require('../lib/kozgu_tetik');
const { redis } = require('../lib/db');
const XI = require('./xat_isbot');
const Q = require('./qadam');
const QH = require('./qadam_hujjat')._ichki;

const s = v => String(v == null ? '' : v);
async function serverda(kod) {
  try { if ((await redis.get('yozuv_yondi:xat_isbot')) !== '1') return false; } catch (e) { return false; }
  return QH.koprik17(kod);
}
async function eskiTizim(fn, u, args) { const r = await koprik.chaqir(fn, u.kod, args); await tetik.yangilaKut(20000); return r; }

async function qadamXatYetkaz(args) {
  const [kodSes, d0] = args; const d = d0 || {};
  const u = await S.ruxsat(kodSes, 'undiruv');
  if (!(await serverda(u.kod))) return eskiTizim('qadamXatYetkaz', u, args.slice(1));
  const r = await XI.xatYuborildi([kodSes, s(d.raqam || ''), d.usul, d.sana, d.b64, d.sahifa || '', d.pochtaNo || '']);
  const m = await Q.qadamMijoz([kodSes, d.no]); m.saqlandi = r; return m;
}
async function qadamTalabYetkaz(args) {
  const [kodSes, d0] = args; const d = d0 || {};
  const u = await S.ruxsat(kodSes, 'undiruv');
  if (!(await serverda(u.kod))) return eskiTizim('qadamTalabYetkaz', u, args.slice(1));
  const r = await XI.xatTopYuborildi([kodSes, s(d.topId || ''), s(d.raqam || ''), d.usul, d.sana, d.b64, d.sahifa || '', d.pochtaNo || '']);
  const m = await Q.qadamMijoz([kodSes, d.no]); m.saqlandi = r; return m;
}

module.exports = { qadamXatYetkaz, qadamTalabYetkaz };
