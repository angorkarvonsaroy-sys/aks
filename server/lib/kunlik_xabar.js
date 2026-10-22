// AKS TIZIM — ⏰ faqat Telegram xabar yuboradigan vaqt bo'yicha ishlar (lib/vaqt.js chaqiradi; jadvalga yozmaydi). Matnlar eski kod bilan aynan.
//   yuristKunlik   — Yurist.gs yuristKunlik (har kuni 20:05, yakshanba ham): direktor(lar)ga «⚖ Yurist bo'limi» — yuristdagi ishlar, cho'zilganlar (10 tagacha),
//                    tasdiq kutayotganlar, yurist tekshirishi kerak bo'lgan isbotlar. Har direktorga shaxsan (07_Xodimlar: admin, Ishlayapti, Telegram).
//   taminotEslatma — Taminot.gs taminotEslatma (dushanba 09:00): o'tgan hafta tasdiqlangan ta'minot bo'lsa — direktorga (tgYubor_) dalolatnoma eslatmasi.
//   kechkiHisobot  — Hisobot.gs kechkiHisobotYubor (har kuni 20:00): GURUHGA (tgGuruh_ — Koprik v1.16 koprikTgGuruh) kunlik hisobot; shanba — + haftalik;
//                    oyning oxirgi kuni — + oylik. Hisob — hisob09b_ (01b, 03, 04, 05) — api/hisobot_pdf.js pdfYigish (eski bilan solishtirilgan).
//   zaxiraKunlik   — Zaxira.gs zaxiraKunlik (har kecha 02:00): AKS_BAZA ning Drive nusxasi «AKS TIZIM / 99 ZAXIRA» ga — Koprik v1.16 koprikZaxira
//                    (Drive'ga faqat direktor hisobi yozadi); 30 kundan eskilari savatga (o'sha funksiyaning o'zi).
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

// ------------------------------------------------------------------ kechkiHisobotYubor (Hisobot.gs v27.10)
const H_KUNLAR = ['yakshanba', 'dushanba', 'seshanba', 'chorshanba', 'payshanba', 'juma', 'shanba'];
const H_OYLAR = ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr'];
const H_SARLAVHA = '🏢 <b>«ANGOR KARVON SAROY» МЧЖ</b>';
const pulTG = n => Math.round(n || 0).toLocaleString('ru-RU').replace(/,/g, ' ').replace(/\u00a0/g, ' ');
const hafta = iso => new Date(iso + 'T12:00:00Z').getUTCDay();
const kunQosh = (iso, n) => new Date(Date.parse(iso + 'T12:00:00Z') + n * 86400000).toISOString().slice(0, 10);
function sanaChiroyli(s) { const [y, m, d] = s.split('-'); return d + '.' + m + '.' + y + ', ' + H_KUNLAR[hafta(s)]; }
// hisob09b_: tashrif maqsadlari, ijara, sotuv (+ qiymat), tushum (yangi / undirilgan), kunlar bo'yicha tushum
async function hisob09b(bosh, oxir) {
  const HP = require('../api/hisobot_pdf')._ichki;
  const kunlar = HP.pdfKunlar(bosh, oxir), K = await HP.pdfYigish(kunlar);
  const h = { maqsad: {}, mijoz: 0, ijara: 0, sotuv: 0, qiymat: 0, yangi: 0, tushum: 0, kunlar: {} };
  kunlar.forEach(k => { const x = K[k];
    x.m.forEach((v, i) => { if (v) { const m = HP.H09_MAQSAD[i][0]; h.maqsad[m] = (h.maqsad[m] || 0) + v; h.mijoz += v; } });
    h.ijara += x.ij; h.sotuv += x.sv; h.qiymat += x.qiy; h.tushum += x.jami; h.yangi += x.yangi; if (x.jami) h.kunlar[k] = x.jami; });
  h.undirilgan = h.tushum - h.yangi;
  h.bosh_ = h.mijoz + h.ijara + h.sotuv + h.tushum === 0;
  return h;
}
function bloklar(h) {
  const HP = require('../api/hisobot_pdf')._ichki, L = [];
  if (h.mijoz) { L.push('👥 <b>MIJOZLAR — ' + h.mijoz + ' ta</b>'); HP.H09_MAQSAD.forEach(([k, ik, nom]) => { if (h.maqsad[k]) L.push('   ' + ik + ' ' + nom + ' — ' + h.maqsad[k]); }); L.push(''); }
  if (h.ijara || h.sotuv) { L.push('📑 <b>SHARTNOMALAR</b>');
    if (h.ijara) L.push('   📝 Ijara shartnomasi — ' + h.ijara);
    if (h.sotuv) L.push('   🤝 Oldi-sotdi shartnomasi — ' + h.sotuv);
    if (h.qiymat) L.push('   💼 Shartnoma qiymati — ' + pulTG(h.qiymat) + ' so\'m');
    L.push(''); }
  if (h.tushum) { L.push('💰 <b>TUSHUM — ' + pulTG(h.tushum) + ' so\'m</b>');
    if (h.yangi) L.push('   🆕 Yangi shartnoma bo\'yicha — ' + pulTG(h.yangi));
    if (h.undirilgan) L.push('   📥 Undirilgan qarzdorlik — ' + pulTG(h.undirilgan));
    L.push(''); }
  return L;
}
async function kunlikMatn(bugun) {
  const hk = hafta(bugun), h = await hisob09b(bugun, bugun), L = [H_SARLAVHA];
  if (h.bosh_) { L.push('');
    if (hk === 0) { L.push('🌿 Bugun — yakshanba, dam olish kuni.'); L.push(''); L.push('☀️ Ertaga yangi hafta boshlanadi — ishlaringiz unumli, savdolaringiz barakali bo\'lsin! 💪'); }
    else { L.push('📅 ' + sanaChiroyli(bugun)); L.push('Bugun mijoz, shartnoma va tushum qayd etilmadi.'); L.push(''); L.push('☀️ Ertangi kuningiz barakali o\'tsin!'); }
  } else { L.push('Sotuv bo\'limi kunlik hisoboti'); L.push('📅 <b>' + sanaChiroyli(bugun) + '</b>'); L.push(''); bloklar(h).forEach(x => L.push(x)); }
  return L.join('\n').replace(/\n+$/, '');
}
async function davrMatn(nom, bosh, oxir, kunlarBilan) {
  const h = await hisob09b(bosh, oxir), f = s => s.split('-').reverse().join('.');
  const L = [H_SARLAVHA, nom, '📅 <b>' + f(bosh) + ' — ' + f(oxir) + '</b>', ''];
  if (h.bosh_) { L.push('Bu davrda mijoz, shartnoma va tushum qayd etilmadi.'); return L.join('\n'); }
  bloklar(h).forEach(x => L.push(x));
  if (kunlarBilan) { const k = Object.keys(h.kunlar).sort().filter(x => h.kunlar[x]);
    if (k.length > 1) { L.push('📆 <b>Kunlar bo\'yicha tushum</b>'); k.forEach(x => L.push('   ' + ['Ya', 'Du', 'Se', 'Ch', 'Pa', 'Ju', 'Sh'][hafta(x)] + ' ' + x.slice(8) + '.' + x.slice(5, 7) + ' — ' + pulTG(h.kunlar[x]))); L.push(''); } }
  return L.join('\n').replace(/\n+$/, '');
}
async function haftalikMatn(bugun) { const hk = hafta(bugun) || 7; return (await davrMatn('📊 <b>Haftalik hisobot</b>', kunQosh(bugun, -(hk - 1)), bugun, true)) + '\n\n🌿 Hafta yakuni muborak! Ertaga — dam olish kuni.'; }
async function oylikMatn(bugun) { return davrMatn('📈 <b>Oylik hisobot — ' + H_OYLAR[Number(bugun.slice(5, 7)) - 1] + ' ' + bugun.slice(0, 4) + '</b>', bugun.slice(0, 8) + '01', bugun, false); }
async function kechkiHisobot(kod, opt = {}) {
  const bugun = V.bugun(), shanba = hafta(bugun) === 6, oyOxiri = kunQosh(bugun, 1).slice(8) === '01';
  const M = [{ nom: 'kunlik', matn: await kunlikMatn(bugun) }];
  if (shanba || opt.quruq) M.push({ nom: 'haftalik' + (shanba ? '' : ' — NAMUNA: faqat shanba kuni yuboriladi'), matn: await haftalikMatn(bugun) });
  if (oyOxiri || opt.quruq) M.push({ nom: 'oylik' + (oyOxiri ? '' : ' — NAMUNA: faqat oyning oxirgi kuni yuboriladi'), matn: await oylikMatn(bugun) });
  if (opt.quruq) return { quruq: true, xabarlar: M.map(z => ({ kimga: 'GURUH (tgGuruh_) — ' + z.nom, matn: z.matn })) };
  // eski tizim: birinchi xatoda to'xtaydi (trigger xato). Bu yerda: hech biri ketmagan bo'lsa — xato (jadval 1 daqiqadan keyin qayta uradi); qismi ketgan bo'lsa — qayta yuborilmaydi
  let ok = 0; const xato = [];
  for (const z of M) { try { await koprik.chaqir('koprikTgGuruh', kod, [z.matn]); ok++; } catch (e) { if (!ok) throw e; xato.push(z.nom + ': ' + e.message); } }
  return { yuborildi: M.map(z => z.nom).slice(0, ok).join(', '), xato: xato.length ? xato.join('; ') : undefined };
}

// ------------------------------------------------------------------ zaxiraKunlik (Zaxira.gs) — Koprik v1.16 orqali
async function zaxiraKunlik(kod, opt = {}) {
  const { verOk } = require('./versiya');
  const v = await koprik.chaqir('koprikVersiya', kod, []);
  if (!verOk(v, '1.16')) throw new Error('Koprik ' + v + ' — zaxira uchun v1.16 kerak (koprikZaxira)');
  if (opt.quruq) return { quruq: true, xabarlar: [], sabab: 'Koprik ' + v + ' ✅ — zaxira olishga tayyor (quruq sinovda nusxa olinmaydi; haqiqiy sinov: aks-vaqt hozir zaxira_kunlik)' };
  const r = await koprik.chaqir('koprikZaxira', kod, [], { muddat: 300000, urinish: 1 });
  return { nom: r && r.nom };
}

module.exports = { yuristKunlik, taminotEslatma, kechkiHisobot, zaxiraKunlik, hisob09b };
