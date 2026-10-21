// AKS TIZIM — 📮 devonxona CHIQUVCHI XATI rasmiy blankada serverda (Devon.gs v1.5 devonXatYasa_ bilan bir xil tartib va o'lchamlar):
//   raqam va sana → (javob bo'lsa) havola «… даги …-сон хатингизга» (10 pt, № ostida) → kimga (o'ng yarmida, chapga tekis; tashkilot — hammasi qalin,
//   mijoz — manzil oddiy, F.I.Sh. qalin) → mavzu (o'rtada, qalin) → murojaat (ixtiyoriy) → matn (ikki tomonga, 1-qator chekinishi) → «Илова: …» (ixtiyoriy) →
//   «Ҳурмат билан,» (murojaat bo'lsa) → imzo («Ижрочи» — xatni yozgan xodim; tashkilotga — kompaniya telefoni, «Асл нусхасини олдим» qatori matnsiz).
// Hamma xatboshi setLineSpacing(1.1) — bloklarda ls: 1.1. PDF — lib/xat_pdf.js blankaYasa (bir varaq qoidasi o'sha), Word — lib/bekor_word.js bloklarDocx.
'use strict';
const XP = require('./xat_pdf');
const BW = require('./bekor_word');

const DEVON_TEL = '+998 95 557 88 88';   // v1.4: tashkilotlarga xatda ijrochining xizmat telefoni (kompaniya raqami)
const s = v => String(v == null ? '' : v);
const XAT_OY = XP.XAT_OY;

// devonSanaSoz_: '07.10.2026' → '2026 йил 7 октябр'
function sanaSoz(sana) { const p = s(sana).split('.'); if (p.length !== 3) return s(sana); return p[2] + ' йил ' + Number(p[0]) + ' ' + XAT_OY[Number(p[1]) - 1]; }
// devonXatYasa_ dagi qator(...) chaqiruvlari — bloklar ko'rinishida. o = { tur, mavzu, murojaat, ilova }
function bloklar(oluvchi, mazmun, o) {
  const tash = o.tur !== 'mijoz', L = 1.1;
  const X = s(mazmun).split('\n').filter(z => z.trim());
  const B = [];
  const q = (x, b) => B.push(Object.assign({ t: 'p', x: s(x).trim() ? x : ' ', ls: L, sz: 11 }, b));
  oluvchi.forEach((x, i) => q(x, { al: 'left', left: XP.XAT_MANZIL_CHAP, b: tash || i === oluvchi.length - 1, before: i === 0 ? 8 : 0 }));
  if (o.mavzu) q(o.mavzu, { al: 'center', b: true, before: 12, after: 6 }); else q(' ', { al: 'left' });
  if (o.murojaat) q(o.murojaat, { al: 'center', b: true, after: 4 });
  X.forEach(x => q(x, { al: 'both', ind: true, after: /^\s*\d+[.)]\s/.test(x) ? 2 : 3 }));
  if (o.ilova) q('Илова: ' + o.ilova, { al: 'both', before: 6 });
  if (o.murojaat) q('Ҳурмат билан,', { al: 'left', before: 8 });
  return B;
}
// Qaytaradi { pdf, docx, bet, k, bloklar }. ij — { ism, tel } (xatIjrochi_), kirim — { sana, raqam } yoki null (havola uchun)
async function yasa(raqam, sanaIso, oluvchi, mazmun, ij, o, kirim) {
  const tash = o.tur !== 'mijoz';
  const havola = kirim ? sanaSoz(kirim.sana) + 'даги ' + kirim.raqam + '-сон хатингизга' : '';
  const B = bloklar(oluvchi, mazmun, o);
  const q = { '{{Ундирувчи}}': ij.ism, '{{Ундирувчи_тел}}': tash ? DEVON_TEL : ij.tel };
  const r = await XP.blankaYasa(B, q, raqam, sanaIso, false, { havola, aslYoq: tash });
  const docx = BW.bloklarDocx(B, raqam, sanaIso, { ism: ij.ism, tel: tash ? DEVON_TEL : ij.tel }, r.k, { havola, aslYoq: tash });
  return { pdf: r.pdf, docx, bet: r.bet, k: r.k, bloklar: B, havola };
}

module.exports = { bloklar, yasa, sanaSoz, DEVON_TEL };
