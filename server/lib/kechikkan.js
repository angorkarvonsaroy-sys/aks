// AKS TIZIM — ⏰ 17:00 nazoratlari serverda (lib/vaqt.js chaqiradi), yakshanbadan tashqari, faqat Telegram (jadvalga yozmaydi):
//   xatKechikkan   — Xat.gs xatKechikkanTekshir (17:00): yangi qoida (XAT_YANGI_QOIDA dan) chiqarilgan, hali «Tayyorlandi» (yetkazilmagan) ogohlantirish xatlari —
//                    direktor(lar)ga ro'yxat (tgYubor_ — koprikTgYubor; bormasa — har direktorga shaxsan), mas'ul xodimga shaxsiy ogohlantirish (kun bo'yicha 3 daraja).
//   bekorKechikkan — Bekor.gs bekorKechikkanTekshir (17:15): ochiq bekor so'rovlarida buyruq / xabarnoma skani ish kuni ≥ 1 kechikkan — xodimga shaxsiy,
//                    ≥ 2 ish kuni — direktor(lar)ga. Matnlar eski kod bilan aynan. opt.quruq — yubormaydi, xabarlarni qaytaradi (aks-vaqt sinov).
'use strict';
const V = require('./varaq');
const J = require('./jurnallar');
const P = require('./portfel');
const X = require('./xat_yordam');
const { xatKirill } = require('./ism');
const koprik = require('../api/koprik');

const BEKOR_YOPIQ = ['Bekor qilindi', 'Rad etildi', 'Qaytarildi'], BEKOR_SKAN_ISH_KUN = 2, XAT_TEKSHIR_SOAT = 17;
const s = v => String(v == null ? '' : v);
const dmy = iso => s(iso).slice(0, 10).split('-').reverse().join('.');
function hafta(iso) { return new Date(iso + 'T12:00:00Z').getUTCDay(); }
function yhIso(v) { v = s(v).trim(); if (/^\d{4}-\d{2}-\d{2}/.test(v)) return v.slice(0, 10); if (/^\d{2}\.\d{2}\.\d{4}/.test(v)) return v.slice(0, 10).split('.').reverse().join('-'); return ''; }
function bekorIshKun(sana, bugunIso) {   // bekorIshKun_: yakshanba hisobga olinmaydi
  const iso = yhIso(sana); if (!iso) return 0;
  let k = 0; const d = new Date(iso + 'T12:00:00Z'), ox = new Date(bugunIso + 'T12:00:00Z');
  while (d < ox) { d.setUTCDate(d.getUTCDate() + 1); if (d.getUTCDay() !== 0) k++; }
  return k;
}
// 07_Xodimlar: ism (C — kirill, 2 so'z), tg (ishlayotgan, admin bo'lmagan), adm (ishlayotgan direktorlar Telegram'i)
async function xodimlar() {
  const ism = {}, tg = {}, adm = [];
  (await V.qatorlar('07_Xodimlar')).forEach(({ x: r }) => {
    const c = s(r[2]).trim().split(/\s+/).slice(0, 2).join(' '); if (c) ism[s(r[1]).trim()] = c;
    if (s(r[10]).trim() !== 'Ishlayapti' || !s(r[20]).trim()) return;
    if (/admin/i.test(s(r[18]))) adm.push(s(r[20]).trim()); else tg[s(r[1]).trim()] = s(r[20]).trim();
  });
  return { ism, tg, adm, kim: f => ism[f] || xatKirill(f) };
}
// yuboruvchi: quruq bo'lsa to'playdi; xato e'tiborsiz (eski: try/catch + console.log)
function yuboruvchi(kod, opt, jurnal) {
  const xabarlar = [];
  return { xabarlar,
    chat: async (id, kimga, m) => { if (opt.quruq) { xabarlar.push({ kimga, matn: m }); return true; } try { await koprik.chaqir('koprikTgChat', kod, [id, m]); return true; } catch (e) { console.error(jurnal + ':', e.message); return false; } },
    direktor: async m => { if (opt.quruq) { xabarlar.push({ kimga: 'direktor (tgYubor_)', matn: m }); return true; } try { await koprik.chaqir('koprikTgYubor', kod, [m]); return true; } catch (e) { console.error(jurnal + ' (guruh):', e.message); return false; } } };
}

// ------------------------------------------------------------------ xatKechikkanTekshir
async function xatKechikkan(kod, opt = {}) {
  const bugun = V.bugun();
  if (hafta(bugun) === 0) return { yuborilmadi: 'Yakshanba — xabar yuborilmaydi.' };
  const S = {}; (await P.xatShartnomalar(bugun)).forEach(x => { S[x.no] = x; });
  const L = (await J.xatJurnal()).filter(h => h.holati === 'Tayyorlandi' && X.xatIso(h.sana) >= X.XAT_YANGI_QOIDA && X.xatIso(h.sana) <= bugun)
    .map(h => { const x = S[h.no] || {};
      const f2 = s(x.fish).split(/\s+/).slice(0, 2).map(w => w.charAt(0) + w.slice(1).toLowerCase()).join(' ');
      return { raqam: h.raqam, no: h.no, fish: xatKirill(f2), masul: s(x.undiruvchi).trim() || s(h.kim).trim(), sanaIso: X.xatIso(h.sana),
        k: Math.round((new Date(bugun + 'T12:00:00Z') - new Date(X.xatIso(h.sana) + 'T12:00:00Z')) / 86400000) }; })
    .sort((a, b) => b.k - a.k);
  if (!L.length) return { yuborilmadi: 'Kechikkan xat yo\'q.' };
  const xat = h => '<b>' + h.raqam + '</b> (' + h.no + ' ' + h.fish + ')';
  const XD = await xodimlar(), Y = yuboruvchi(kod, opt, 'xatKechikkanTekshir');
  const Q = require('../api/qadam')._ichki;
  if (opt.yangiQoida !== undefined ? opt.yangiQoida : await Q.xatYangiQoida()) return xatKechikkanYangi(kod, opt, bugun, L, xat, XD, Y, Q);
  const g = ['✉️ <b>Етказилмаган огоҳлантириш хатлари</b> — ' + dmy(bugun) + ', ' + XAT_TEKSHIR_SOAT + ':00', ''];
  L.forEach(h => g.push(
    h.k === 0 ? '⚠️ <b>' + XD.kim(h.masul) + '</b> бугун чиқарилган ' + xat(h) + ' хатни юбормади.'
    : h.k === 1 ? '🔴 <b>' + XD.kim(h.masul) + '</b> ' + xat(h) + ' хатни кечадан бери юбормаяпти — иккинчи кун.'
    : '⛔ <b>' + XD.kim(h.masul) + '</b> ' + xat(h) + ' хатни ' + (h.k + 1) + ' кундан бери юбормади. Интизомий чора масаласи.'));
  g.push('', 'Масъул ходимлар билан боғланиб, хатларни кечиктирмасдан юборишларини айтинг.');
  const guruh = await Y.direktor(g.join('\n'));
  const shaxsiy = h =>
    h.k === 0 ? '⚠️ ' + xat(h) + ' — бугун чиқарилган хат ҳали юборилмаган. Хатни <b>бугуноқ</b> етказишингиз ва исботини юклашингиз шарт. Бунга жиддий қаранг.'
    : h.k === 1 ? '🔴 <b>Иккинчи огоҳлантириш.</b> ' + xat(h) + ' хат кеча чиқарилган, ҳалигача юборилмаган. Бу — жиддий иш интизоми бузилиши. Бугун етказинг.'
    : '⛔ <b>Охирги огоҳлантириш.</b> ' + xat(h) + ' хат ' + (h.k + 1) + ' кундан бери юборилмаган. Сизга нисбатан <b>интизомий жазо чораси</b> қўлланилиши мумкин. '
      + 'Хат кучини йўқотади — ундаги тўлов муддати ўтиб кетган ҳисобланади, бекор қилиниб, қайтадан чиқарилишига тўғри келади.';
  const kim = {}; L.forEach(h => (kim[h.masul] = kim[h.masul] || []).push(h));
  let xodim = 0;
  for (const f of Object.keys(kim)) { if (!XD.tg[f]) continue; xodim++;
    await Y.chat(XD.tg[f], f, kim[f].map(shaxsiy).join('\n\n') + '\n\nИсбот «✉ Yuborildi» тугмаси орқали юкланади: почта — имзоланган 2-нусха + квитанция ва жўнатма рақами; қўлма-қўл — мижоз имзолаган нусха.'); }
  if (!guruh) for (const id of XD.adm) await Y.chat(id, 'direktor', g.join('\n'));
  if (opt.quruq) return { quruq: true, xabarlar: Y.xabarlar, xatlar: L.length };
  return { xatlar: L.length, guruh, xodimlar: xodim };
}

// 23.10.2026 DIREKTOR QARORI — 1 ISH KUNI MUHLAT (ijro_kechki bilan bir xil hisob, lib/ijro_kun.js): muhlat — xat chiqarilgan kundan keyingi ish kuni
// (yakshanba o'tkaziladi; isbotni yurist qaytargan bo'lsa — qaytarilgan kundan). 18:15 da: muhlat kuni o'tib yetkazilmagan — 1 ball, 3 ish kunidan beri — 3 ball.
// 17:00 xabari shunga mos: chiqarilgan kun — eslatma (faqat xodimga), muhlat kuni — «bugun oxirgi kun» (xodim + direktor), keyin — qizil / qora.
async function xatKechikkanYangi(kod, opt, bugun, L0, xat, XD, Y, Q) {
  const tek = {}; (await J.xatJurnal()).forEach(h => { tek[h.raqam] = s(h.tek); });
  const L = L0.map(h => { const rad = /^Rad\|(\d{2})\.(\d{2})\.(\d{4})/.exec(tek[h.raqam] || ''); const bosh = rad ? rad[3] + '-' + rad[2] + '-' + rad[1] : h.sanaIso;
    return Object.assign({}, h, { ik: Q.xatIshKun(bosh, bugun), muh: Q.xatMuhlat(bosh), rad: !!rad }); }).sort((a, b) => b.ik - a.ik);
  const dir = L.filter(h => h.ik >= 1);
  let guruh = null;
  if (dir.length) {
    const g = ['✉️ <b>Етказилмаган огоҳлантириш хатлари</b> — ' + dmy(bugun) + ', ' + XAT_TEKSHIR_SOAT + ':00 (муҳлат — 1 иш куни)', ''];
    dir.forEach(h => g.push(
      h.ik === 1 ? '🟡 <b>' + XD.kim(h.masul) + '</b> ' + xat(h) + ' — бугун муҳлатнинг охирги куни. 18:15 гача етказилмаса — қоидабузарлик.'
      : h.ik === 2 ? '🔴 <b>' + XD.kim(h.masul) + '</b> ' + xat(h) + ' — муҳлати (' + dmy(h.muh) + ') ўтди, ҳалигача юборилмаган.'
      : '⛔ <b>' + XD.kim(h.masul) + '</b> ' + xat(h) + ' хатни ' + h.ik + ' иш кунидан бери юбормади. Интизомий чора масаласи.'));
    g.push('', 'Масъул ходимлар билан боғланиб, хатларни кечиктирмасдан юборишларини айтинг.');
    guruh = await Y.direktor(g.join('\n'));
    if (!guruh) for (const id of XD.adm) await Y.chat(id, 'direktor', g.join('\n'));
  }
  const shaxsiy = h =>
    h.ik === 0 ? 'ℹ️ ' + xat(h) + ' — ' + (h.rad ? 'исботи бугун қайтарилди' : 'бугун чиқарилган') + '. Муҳлат — <b>' + dmy(h.muh) + '</b> (1 иш куни). Почтага топширинг ва исботини юкланг.'
    : h.ik === 1 ? '⚠️ ' + xat(h) + ' — <b>бугун муҳлатнинг охирги куни</b>. Бугун етказиб, исботини юкланг — акс ҳолда қоидабузарлик ёзилади.'
    : h.ik === 2 ? '🔴 <b>Иккинчи огоҳлантириш.</b> ' + xat(h) + ' хат муҳлати (' + dmy(h.muh) + ') ўтди, ҳалигача юборилмаган. Бу — иш интизоми бузилиши. Бугун етказинг.'
    : '⛔ <b>Охирги огоҳлантириш.</b> ' + xat(h) + ' хат ' + h.ik + ' иш кунидан бери юборилмаган. Сизга нисбатан <b>интизомий жазо чораси</b> қўлланилиши мумкин. '
      + 'Хат кучини йўқотади — ундаги тўлов муддати ўтиб кетган ҳисобланади, бекор қилиниб, қайтадан чиқарилишига тўғри келади.';
  const kim = {}; L.forEach(h => (kim[h.masul] = kim[h.masul] || []).push(h));
  let xodim = 0;
  for (const f of Object.keys(kim)) { if (!XD.tg[f]) continue; xodim++;
    await Y.chat(XD.tg[f], f, kim[f].map(shaxsiy).join('\n\n') + '\n\nИсбот «✉ Yuborildi» тугмаси орқали юкланади: почта — имзоланган 2-нусха + квитанция ва жўнатма рақами; қўлма-қўл — мижоз имзолаган нусха.'); }
  if (opt.quruq) return { quruq: true, qoida: '1 ish kuni muhlat', xabarlar: Y.xabarlar, xatlar: L.length, direktorga: dir.length };
  return { xatlar: L.length, direktorga: dir.length, guruh, xodimlar: xodim };
}

// ------------------------------------------------------------------ bekorKechikkanTekshir
async function bekorKechikkan(kod, opt = {}) {
  const bugun = V.bugun();
  if (hafta(bugun) === 0) return { yuborilmadi: 'Yakshanba — xabar yuborilmaydi.' };
  const L = (await J.bekorJurnal())
    .filter(z => BEKOR_YOPIQ.indexOf(z.holati) < 0 && !(z.bSkan && z.xSkan))
    .map(z => ({ s: z, k: bekorIshKun(z.sana, bugun), yoq: [!z.bSkan ? 'буйруқ скани' : '', !z.xSkan ? 'хабарнома скани' : ''].filter(Boolean).join(' ва ') }))
    .filter(z => z.k >= 1).sort((a, b) => b.k - a.k);
  if (!L.length) return { yuborilmadi: 'Kechikkan bekor hujjati yo\'q.' };
  const XD = await xodimlar(), Y = yuboruvchi(kod, opt, 'bekorKechikkanTekshir');
  const byKim = {}; L.forEach(z => (byKim[z.s.kim] = byKim[z.s.kim] || []).push(z));
  let xodim = 0;
  for (const f of Object.keys(byKim)) { if (!XD.tg[f]) continue; xodim++;
    await Y.chat(XD.tg[f], f, byKim[f].map(z => (z.k >= BEKOR_SKAN_ISH_KUN ? '⛔ ' : '🔴 ') + '<b>' + z.s.raqam + '</b> (' + z.s.no + ' ' + z.s.fish + ') — бекор қилиш бўйича '
      + z.yoq + ' ' + z.k + ' иш кундан бери юкланмаган. Буйруқни имзолатиб, хабарномани етказиб, сканларни бугуноқ юкланг.').join('\n\n')); }
  const qizil = L.filter(z => z.k >= BEKOR_SKAN_ISH_KUN);
  let guruh = null;
  if (qizil.length) {
    const g = ['✂️ <b>Бекор қилиш ҳужжатлари кечиккан</b> — ' + dmy(bugun), ''];
    qizil.forEach(z => g.push('⛔ <b>' + XD.kim(z.s.kim) + '</b>: ' + z.s.raqam + ' (' + z.s.no + ' ' + z.s.fish + ') — ' + z.yoq + ' ' + z.k + ' иш кундан бери юкланмаган.'));
    guruh = await Y.direktor(g.join('\n'));
    if (!guruh) for (const id of XD.adm) await Y.chat(id, 'direktor', g.join('\n'));
  }
  if (opt.quruq) return { quruq: true, xabarlar: Y.xabarlar, sorovlar: L.length, qizil: qizil.length };
  return { sorovlar: L.length, qizil: qizil.length, xodimlar: xodim, guruh };
}

module.exports = { xatKechikkan, bekorKechikkan, bekorIshKun, xodimlar };
