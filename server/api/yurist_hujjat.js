// AKS TIZIM — ⚖ yurist hujjatlari serverda: МИЖОЗ МАЪЛУМОТНОМАСИ (yhMalumotnoma), ИШ ҲАРАКАТЛАРИ БАЁННОМАСИ (yhBayonnoma),
// ПЕНЯ ҲИСОБ-КИТОБИ (yhPenya) — PDF / Word / Excel. Yurhujjat.gs v25.4 bilan bir xil: ma'lumot (lib/yurist_malumot.js yhYig),
// hujjat tuzilishi (lib/yurist_hujjat.js — eski DocumentApp kodi so'zma-so'z), PDF (lib/docs_pdf.js — eski Google Docs PDF bilan qatorma-qator),
// Word (lib/docs_docx.js — Google eksporti bilan bayt-ma-bayt), Excel (lib/xlsx.js). Eski tizimda har biri ~30 soniya edi.
// Hujjat saqlanmaydi (eski tizimdagidek): yasaladi va xodimga beriladi. Bazaga hech narsa yozilmaydi.
// Yoqilishi: Redis yozuv_yondi:yurist_hujjat («aks-yozuv-sinov yhhujjat» namunalar tasdiqlangach). Aks holda — eski tizim.
'use strict';
const S = require('./sessiya');
const koprik = require('./koprik');
const { redis } = require('../lib/db');
const YM = require('../lib/yurist_malumot');
const YH = require('../lib/yurist_hujjat');
const DP = require('../lib/docs_pdf');
const DD = require('../lib/docs_docx');

const DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
async function serverda() { try { return (await redis.get('yozuv_yondi:yurist_hujjat')) === '1'; } catch (e) { return false; } }
const eskiTizim = (fn, u, args) => koprik.chaqir(fn, u.kod, args);
async function yig(id) {
  try { return await YM.yhYig(id); } catch (e) { if (/topilmadi/.test(e.message)) throw new S.Xato(e.message); throw e; }
}
async function chiqar(r, format) {
  if (String(format) === 'doc') return { nom: r.nom + '.docx', mime: DOCX, b64: DD.yasa(r.model).toString('base64') };
  const p = await DP.yasa(r.model);
  return { nom: r.nom + '.pdf', mime: 'application/pdf', b64: p.pdf.toString('base64') };
}
// sinov va namuna uchun: model + fayl (Excel — lib/yurist_excel.js)
async function yasa(fn, M, ism, format) {
  if (fn === 'yhMalumotnoma') return chiqar(YH.malumotnomaModel(M, ism), format);
  if (fn === 'yhBayonnoma') {
    const X = YM.yhXronologiya(M);
    if (String(format) === 'xlsx') return require('../lib/yurist_excel').bayonnoma(M, X);
    return chiqar(YH.bayonnomaModel(M, X, ism), format);
  }
  if (fn === 'yhPenya') {
    if (String(format) === 'xlsx') return require('../lib/yurist_excel').penya(M);
    return chiqar(YH.penyaModel(M, ism), format);
  }
  throw new Error('Noma\'lum hujjat: ' + fn);
}
function amal(fn) {
  return async function (args) {
    const [kodSes, id, format] = args;
    const u = await S.ruxsat(kodSes, 'yurist');   // yhRuxsat_ — faqat direktor va yurist
    if (!(await serverda())) return eskiTizim(fn, u, args.slice(1));
    const M = await yig(id);
    return yasa(fn, M, await YM.yhXodim(u.fish), format);
  };
}

module.exports = { yhMalumotnoma: amal('yhMalumotnoma'), yhBayonnoma: amal('yhBayonnoma'), yhPenya: amal('yhPenya') };
module.exports._ichki = { yasa, DOCX, XLSX };
