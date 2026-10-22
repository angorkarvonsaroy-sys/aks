// AKS TIZIM — ⏰ faqat Telegram xabar yuboradigan vaqt bo'yicha ishlar (lib/vaqt.js chaqiradi; jadvalga yozmaydi). Matnlar eski kod bilan aynan.
//   yuristKunlik   — Yurist.gs yuristKunlik (har kuni 20:05, yakshanba ham): direktor(lar)ga «⚖ Yurist bo'limi» — yuristdagi ishlar, cho'zilganlar (10 tagacha),
//                    tasdiq kutayotganlar, yurist tekshirishi kerak bo'lgan isbotlar. Har direktorga shaxsan (07_Xodimlar: admin, Ishlayapti, Telegram).
//   taminotEslatma — Taminot.gs taminotEslatma (dushanba 09:00): o'tgan hafta tasdiqlangan ta'minot bo'lsa — direktorga (tgYubor_) dalolatnoma eslatmasi.
// opt.quruq — yubormaydi, xabarlarni qaytaradi (aks-vaqt sinov).
'use strict';
const V = require('./varaq');
const J = require('./jurnallar');
const U = require('./undiruv_yordam');
const TS = require('./tasdiq');
const KC = require('./kechikkan');
const koprik = require('../api/koprik');

const dmy = iso => iso ? String(iso).split('-').reverse().join('.') : '';
const tamPul = n => Math.round(Number(n) || 0).toLocaleString('ru-RU').replace(/ /g, ' ').replace(/,/g, ' ');

async function yuristKunlik(kod, opt = {}) {
  const YQ = require('../api/yurist').Q, bugun = V.bugun();
  const S = {}; (await U.undShartnomalar()).forEach(x => { S[x.no] = x; });
  const I = await J.yuIshlar(); const K = await YQ.yuKesh();
  const faol = I.filter(i => YQ.YU_FAOL.indexOf(i.holati) >= 0).map(i => YQ.yuKorinish(i, S[i.no], bugun, K));
  const chozil = faol.filter(i => i.kechikdi > 0);
  const kutish = I.filter(i => i.holati === 'Tasdiq kutilmoqda').length + I.filter(i => i.holati === "Yopish so'ralgan").length;
  let m = '⚖ <b>Yurist bo\'limi — ' + dmy(bugun) + '</b>\nYuristda: <b>' + faol.length + '</b> ish · cho\'zilmoqda: <b>' + chozil.length + '</b>';
  if (kutish) m += '\nSizning tasdig\'ingizni kutmoqda: <b>' + kutish + '</b>';
  chozil.slice(0, 10).forEach(i => { m += '\n' + (i.yuMas ? '⛔ ' : '⚠ ') + i.no + ' ' + i.fishQ + ' — ' + i.keyingi + ', ' + i.kechikdi + ' kun kechikdi' + (i.yuMas ? ' (yurist)' : ''); });
  try { const T = (await TS.tasdiqNavbat()).filter(it => it.tasdiqchi === 'yurist'); const tk = T.filter(it => it.kech).length;
    if (T.length) m += '\n🔎 Yurist tekshirishi kerak bo\'lgan isbotlar: <b>' + T.length + '</b>' + (tk ? ' (muddati o\'tgan: <b>' + tk + '</b>)' : ''); } catch (e) { }
  const XD = await KC.xodimlar(), xabarlar = []; let ok = 0;
  for (const id of XD.adm) {
    if (opt.quruq) { xabarlar.push({ kimga: 'direktor (' + id + ')', matn: m }); continue; }
    try { await koprik.chaqir('koprikTgChat', kod, [id, m]); ok++; } catch (e) { console.error('yuristKunlik:', e.message); }
  }
  if (opt.quruq) return { quruq: true, xabarlar, sabab: XD.adm.length ? '' : 'Telegram\'li direktor yo\'q — xabar yuborilmaydi' };
  return { faol: faol.length, chozil: chozil.length, kutish, yuborildi: ok, direktor: XD.adm.length };
}

async function taminotEslatma(kod, opt = {}) {
  const TM = require('../api/taminot')._ichki;
  const d = TM.tamOtganHafta();
  const R = (await TM.tamRows()).filter(x => x.holati === 'Tasdiqlandi' && x.iso >= d.bosh && x.iso <= d.oxir);
  if (!R.length) return opt.quruq ? { quruq: true, xabarlar: [], sabab: 'o\'tgan hafta (' + dmy(d.bosh) + '–' + dmy(d.oxir) + ') tasdiqlangan ta\'minot yo\'q — xabar yuborilmaydi' } : { yuborilmadi: 'o\'tgan hafta tasdiqlangan ta\'minot yo\'q' };
  const jami = R.reduce((a, x) => a + x.summa, 0);
  const m = "📦 <b>Ta'minot — haftalik dalolatnoma vaqti</b>\nO'tgan hafta (" + dmy(d.bosh) + '–' + dmy(d.oxir) + '): ' + R.length + ' pozitsiya, ' + tamPul(jami) + " so'm (tasdiqlangan).\nIlovada: 👔 Direktor → Tasdiqlar → 📄 Dalolatnoma yaratish.";
  if (opt.quruq) return { quruq: true, xabarlar: [{ kimga: 'direktor (tgYubor_)', matn: m }] };
  try { await koprik.chaqir('koprikTgYubor', kod, [m]); } catch (e) { console.error('taminot eslatma:', e.message); return { pozitsiya: R.length, yuborilmadi: e.message }; }
  return { pozitsiya: R.length, jami, yuborildi: 1 };
}

module.exports = { yuristKunlik, taminotEslatma };
