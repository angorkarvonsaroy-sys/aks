// AKS TIZIM — ✂ ХАРИДОР ТАШАББУСИ БИЛАН шартномани бекор қилиш (06.11.2026, директор қарори). FAQAT DIREKTOR.
// Bir tomonlama bekor qilishdan (api/bekor_yoz.js) farqi: jarima yo'q, xabarnoma yo'q — buning o'rniga mijoz imzolaydigan ЎЗАРО ҲИСОБ-КИТОБ ДАЛОЛАТНОМАСИ.
// Shart: ↩ Qaytarish (api/qaytarish.js) qarori «Yakunlandi» (qoldiq 0) — yoki shartnomaga umuman to'lov bo'lmagan.
// Tartib: bekorXaridorKirit → 06h qatori (Shablon «XARIDOR», holati «Hujjatlar tayyorlandi»), BUYRUQ (BQ-…) + DALOLATNOMA (BD-…) PDF →
//   buyruq skani (bekorBuyruqSkan — mavjud) + dalolatnoma skani (bekorDalolatnomaSkan, 06d «BEKOR_DALOLATNOMA») → bekorXaridorYakun (direktor):
//   03 N «Bekor qilindi», 03 O bekor sanasi, 01_Dokonlar bo'shatiladi (bekor_yoz tasdiqQollash — bir tomonlama bekor bilan bir xil yadro).
'use strict';
const fs = require('fs');
const path = require('path');
const S = require('./sessiya');
const V = require('../lib/varaq');
const G = require('../lib/google');
const env = require('../lib/env');
const tetik = require('../lib/kozgu_tetik');
const XP = require('../lib/xat_pdf');
const BX = require('../lib/bekor_xaridor');
const BY = require('./bekor_yoz')._ichki;
const QY = require('./qadam_yoz')._ichki;
const HY = require('./hujjat_yoz')._ichki;
const QT = require('./qaytarish')._ichki;

const BEK = '06h_Bekor_sorovlari', S3 = '03_Sotuv_shartnomalar';
const BEKOR_YOPIQ = ['Bekor qilindi', 'Rad etildi', 'Qaytarildi'];
const ILDIZ = env.hujjatPapka || '/opt/aks/hujjat';
const s = v => String(v == null ? '' : v);
const kut = (p, ms) => Promise.race([p, new Promise(r => setTimeout(r, ms))]);
function hozir() { const t = new Date(Date.now() + 5 * 3600 * 1000), p = n => String(n).padStart(2, '0');
  const d = p(t.getUTCDate()) + '.' + p(t.getUTCMonth() + 1) + '.' + t.getUTCFullYear() + ' ' + p(t.getUTCHours()) + ':' + p(t.getUTCMinutes());
  return { dmy: d.slice(0, 10), dmyHm: d, dmyHms: d + ':' + p(t.getUTCSeconds()) }; }

async function direktor(kodSes) { const u = await S.ruxsat(kodSes); if (!u.admin) throw new S.Xato('Xaridor tashabbusi bilan bekor qilish — faqat direktor uchun.'); return u; }

// Shartlar va hisob-kitob: { mumkin, sabab, x, Q, m, ochiq }
async function tekshir(no, BJ) {
  no = s(no).trim();
  if (!/^27\/\d+$/.test(no)) return { mumkin: false, sabab: 'Faqat sotuv shartnomasi (27/…).' };
  const x = await BY.bekorShartnoma(no);
  if (!x) return { mumkin: false, sabab: 'Shartnoma bazada topilmadi: ' + no };
  if (/bekor/i.test(x.holati)) return { mumkin: false, sabab: 'Shartnoma allaqachon bekor qilingan (' + x.holati + ').', x };
  const ochiq = (BJ || await BY.bekorJurnalYangi()).find(z => z.no === no && BEKOR_YOPIQ.indexOf(z.holati) < 0);
  if (ochiq) return { mumkin: false, sabab: 'Bu shartnoma bo\'yicha ochiq bekor qilish so\'rovi bor: ' + ochiq.raqam + ' (' + ochiq.holati + ').', x, ochiq };
  const H = await QT.holatYig();
  const tolovlar = H.T.filter(t => t.no === no).sort((a, b) => a.sana < b.sana ? -1 : 1);
  const tolangan = tolovlar.reduce((a, t) => a + t.summa, 0);
  const q = H.qarorlar.filter(z => z.no === no && z.holati !== 'Bekor').pop();
  const Q = { qaytar: q ? q.qaytar : 0, ushlab: q ? q.ushlab : 0, qaytarildi: q ? q.qaytarildi : 0, qoldiq: q ? q.qoldiq : 0, sana: q ? q.sana : '', holati: q ? q.holati : '',
    ko2: q ? q.ko2.filter(k => k.holati !== 'Bekor').map(k => ({ raqam: k.raqam, sana: k.sana, summa: k.summa })) : [], tolovlar };
  if (tolangan > 0) {
    if (!q) return { mumkin: false, sabab: 'Shartnomaga ' + XP.pul(tolangan) + ' so\'m to\'langan — avval «💰 Moliya → ↩ Qaytarish (KO-2)» da qaytarish qarorini oching va pulni to\'liq qaytaring.', x, Q };
    if (q.holati !== 'Yakunlandi' || Q.qoldiq !== 0) return { mumkin: false, sabab: 'Qaytarish tugallanmagan: qaytarildi ' + XP.pul(Q.qaytarildi) + ' / ' + XP.pul(Q.qaytar) + ', qoldiq ' + XP.pul(Q.qoldiq) + ' so\'m. Qoldiq 0 bo\'lgach bekor qilish ochiladi.', x, Q };
    const isbot = isbotYoq(q); if (isbot) return { mumkin: false, sabab: isbot, x, Q };
    if (Q.ushlab > 0) return { mumkin: false, sabab: 'Qarorda ' + XP.pul(Q.ushlab) + ' so\'m ushlab qolingan — «Xaridor tashabbusi bilan» yo\'li faqat to\'liq qaytarilganda (jarimasiz). Ushlab qolish bo\'lsa — bir tomonlama bekor qilish tartibi.', x, Q };
  }
  const skan = (await HY.yangiQatorlar('06d_Hujjatlar', 'O')).some(r => s(r.r[1]) === no && s(r.r[5]) === 'SHARTNOMA' && s(r.r[13]) === 'Faol');
  if (!skan) return { mumkin: false, sabab: 'Imzolangan shartnoma skani yuklanmagan — avval «📎 Hujjatlar» da SHARTNOMA turini yuklang.', x, Q };
  const mj = (await V.qatorlar('02_Mijozlar')).map(z => z.r).find(r => s(r[0]).trim() === s(x.mid).trim()) || [];
  const m = { pasport: s(mj[6]).replace(/\s/g, ''), iib: [s(mj[7]), s(mj[8])].filter(Boolean).join(', '), psana: QT.iso(mj[9]), manzil: x.manzil, tel: x.tel };
  x.tolangan = tolangan;
  return { mumkin: true, x, Q, m };
}
// ISBOT QOIDASI: qaror — mijoz arizasi skani, har KO-2 — mijoz imzolagan skan (05q «Faol»)
function isbotYoq(q) {
  if (!q.ariza) return 'Qaytarish qaroriga mijoz imzolagan ARIZA skani yuklanmagan — «Moliya → ↩ Qaytarish» da yuklang.';
  if (!q.buyruqSkan) return 'Mablag\'ni qaytarish buyrug\'i' + (q.buyruq ? ' ' + q.buyruq + ' ning imzolangan skani yuklanmagan' : ' chiqarilmagan') + ' — «Moliya → ↩ Qaytarish» da.';
  if (!q.javobSkan) return 'Direktorning arizaga javobi' + (q.javob ? ' ' + q.javob + ' ning mijoz imzolagan skani yuklanmagan' : ' chiqarilmagan') + ' — «Moliya → ↩ Qaytarish» da.';
  const kut = q.ko2.filter(k => k.holati === QT.KUT);
  return kut.length ? kut.length + ' ta KO-2 ning mijoz imzolagan skani yuklanmagan (' + kut.map(k => k.raqam).join(', ') + ') — «Moliya → ↩ Qaytarish» da yuklang.' : '';
}
async function bekorXaridorHolat([kodSes, no]) {
  await direktor(kodSes);
  const t = await tekshir(no);
  return { mumkin: t.mumkin, sabab: t.sabab || '', tolangan: t.x ? t.x.tolangan : 0, Q: t.Q ? { qaytar: t.Q.qaytar, qaytarildi: t.Q.qaytarildi, qoldiq: t.Q.qoldiq, ko2: t.Q.ko2.length } : null };
}

// ------------------------------------------------------------------ kiritish: hujjatlar + 06h qatori
async function bekorXaridorKirit(args) {
  const [kodSes, no0, sabab0] = args;
  const u = await direktor(kodSes);
  const no = s(no0).trim(), sabab = s(sabab0).replace(/\s+/g, ' ').trim();
  if (sabab.length < 10) throw new S.Xato('Sababini yozing (kamida 10 belgi) — buyruqqa va jurnalga shu yoziladi.');
  const r = await QY.qulf('bekor', async () => {
    const BJ = await BY.bekorJurnalYangi();
    const t = await tekshir(no, BJ);
    if (!t.mumkin) throw new S.Xato(t.sabab);
    const { x, Q, m } = t;
    const bugunIso = V.bugun(), yil = bugunIso.slice(0, 4);
    const raqam = BY.bekorKeyingi(BJ, 'raqam', 'BQ', yil), dRaqam = BY.bekorKeyingi(BJ, 'xRaqam', 'BD', yil);
    const b = await BX.buyruqYasa(x, Q, raqam, bugunIso);
    const d = await BX.dalolatnomaYasa(x, Q, raqam, dRaqam, bugunIso, m);
    const noF = x.no.replace(/\//g, '-'), fam = s(x.fish).split(/\s+/)[0] || 'Mijoz', fx = n => n.replace(/[\/\\]/g, '-');
    const bNom = 'Bekor_buyruq_' + noF + '_' + fam + '_' + raqam.replace('/', '-'), xNom = 'Bekor_dalolatnoma_' + noF + '_' + fam + '_' + dRaqam.replace('/', '-');
    const belgi = Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
    const bRel = 'bekor/' + yil + '/' + belgi + '/' + fx(bNom) + '.pdf', xRel = 'bekor/' + yil + '/' + belgi + '/' + fx(xNom) + '.pdf';
    const bPdf = BY.saqla(bRel, b.pdf), xPdf = BY.saqla(xRel, d.pdf);
    const A = await G.ustunOqi(env.aksBazaId, BEK, 'A', env.googleKey);
    const last = A.length, ids = last >= 2 ? A.slice(1, last).map(v => Number(v) || 0) : [0];
    const id = Math.max.apply(null, ids) + 1;
    await BY.qatorYoz(BEK, last + 1, [id, no, 'Sotuv', x.fishK, x.dokon, sabab,
      'Hujjatlar tayyorlandi', raqam, s(bugunIso).split('-').reverse().join('.'), 'XARIDOR', x.jami, x.tolangan, 0, Q.qaytarildi,
      bPdf, '', xPdf, '', '', '', '', '', '', '', u.fish,
      hozir().dmyHms, '', '', '', 'Xaridor tashabbusi bilan (jarimasiz): qaytarildi ' + XP.pul(Q.qaytarildi) + ' so\'m, ' + Q.ko2.map(k => k.raqam).join(', '), dRaqam]);
    const kochir = { yil, bNom, xNom, bRel, xRel, bDocRel: '', xDocRel: '', x: { no: x.no, fish: x.fish, dokon: x.dokon, tur: 'sotuv' }, X: { jumla: '' }, P: { jarima: 0, qaytar: Q.qaytarildi }, raqam, xRaqam: dRaqam, sana: bugunIso, fish: u.fish };
    await BY.navbatga(id, kochir);
    const ogoh = XP.ismOgoh(x.fish);
    if (!m.pasport) ogoh.push('Mijoz kartasida pasport yo\'q — dalolatnomada pasport qatori bo\'sh; «✎ Tahrir» da to\'ldirib, «↻ Qayta yasash» qiling.');
    if (d.bet > 1) ogoh.push('Dalolatnoma ' + d.bet + ' betga chiqdi — har varaqda Харидор imzosi bor, hammasini imzolating.');
    return { id, kochir, javob: { ok: true, id, raqam, xRaqam: dRaqam, no, fish: x.fishK, holati: 'Hujjatlar tayyorlandi',
      buyruqNom: bNom + '.pdf', buyruqB64: b.pdf.toString('base64'), xabNom: xNom + '.pdf', xabB64: d.pdf.toString('base64'), ogoh,
      eslatma: 'Buyruqni imzolang (muhr bilan), dalolatnomani ikki nusxada mijoz bilan imzolang (har varaqda mijoz imzosi, oxirida Ф.И.Ш. o\'z qo\'li bilan) → ikkala skanini shu yerdan yuklang → «✅ Bekor qilishni yakunlash».' } };
  });
  await kut(tetik.varaqlarYangila([BEK]).catch(() => {}), 15000);
  BY.driveGa(u.kod, r.id, r.kochir).catch(() => {});
  return r.javob;
}

// ------------------------------------------------------------------ dalolatnoma skani (mijoz imzolagan) — 06d «BEKOR_DALOLATNOMA», 06h W/T/U
async function bekorDalolatnomaSkan(args) {
  const [kodSes, id, sana, b64, sahifa] = args;
  const u = await direktor(kodSes);
  const z = await BY.bekorSkanOldin(u, id);
  if (z.shablon !== 'XARIDOR') throw new S.Xato('Bu so\'rov «Xaridor tashabbusi» turida emas — xabarnoma skanini «📨 Yetkazildi» orqali yuklang.');
  if (z.xSkan) throw new S.Xato('Dalolatnoma skani allaqachon yuklangan: ' + z.xSkan);
  BY.bekorSkanSana(z, sana);
  const r = await HY.yuklaYadro(u, { turi: 'BEKOR_DALOLATNOMA', sana, b64, sahifa, izoh: (z.xRaqam || z.raqam) + ' · Ўзаро ҳисоб-китоб далолатномаси (буйруқ ' + z.raqam + ', мижоз имзоси билан)' }, BY.bekorSh(z));
  await BY.holatYoz(z, { xSkan: r.nom, Y: [BY.kat(z.qator, 20, ['Qo\'lma-qo\'l', s(sana).split('-').reverse().join('.'), '', r.nom])] });
  return { ok: true, id: z.id, nom: r.nom };
}

// ------------------------------------------------------------------ yakunlash (direktor): shartnoma «Bekor qilindi», do'kon bo'shaydi
async function bekorXaridorYakun(args) {
  const [kodSes, id, izoh0] = args;
  const u = await direktor(kodSes); const izoh = s(izoh0).trim();
  const r = await QY.qulf('bekor', async () => {
    const z = (await BY.bekorJurnalYangi()).find(q => s(q.id) === s(id));
    if (!z) throw new S.Xato('So\'rov topilmadi (ID ' + id + ').');
    if (z.shablon !== 'XARIDOR') throw new S.Xato('Bu so\'rov «Xaridor tashabbusi» turida emas — «👔 Tasdiqlar» orqali tasdiqlang.');
    if (BEKOR_YOPIQ.indexOf(z.holati) >= 0) throw new S.Xato('So\'rov allaqachon yopilgan: ' + z.holati + '.');
    const yoq = [];
    if (!z.bSkan) yoq.push('imzolangan buyruq skani');
    if (!z.xSkan) yoq.push('mijoz imzolagan dalolatnoma skani');
    if (yoq.length) throw new S.Xato('Yakunlash uchun yetishmayapti: ' + yoq.join(', ') + '.');
    // qaytarish hali ham to'liq ekanini qayta tekshirish (KO-2 bekor qilingan bo'lishi mumkin)
    const H = await QT.holatYig();
    const q = H.qarorlar.filter(x => x.no === z.no && x.holati !== 'Bekor').pop();
    const tolangan = H.T.filter(t => t.no === z.no).reduce((a, t) => a + t.summa, 0);
    if (tolangan > 0 && !(q && q.holati === 'Yakunlandi' && q.qoldiq === 0)) throw new S.Xato('Qaytarish tugallanmagan (qoldiq ' + XP.pul(q ? q.qoldiq : tolangan) + ' so\'m) — avval pulni to\'liq qaytaring.');
    if (tolangan > 0) { const isbot = isbotYoq(q); if (isbot) throw new S.Xato(isbot); }
    const h = hozir();
    const sh = (await V.qatorlar(S3)).find(y => s(y.r[0]).trim() === z.no);
    const qosh = [];
    if (sh) {
      qosh.push({ varaq: S3, katak: 'O' + sh.n, qiymat: [[h.dmy]] });   // Bekor_sana
      const izohE = s(sh.r[19]).trim();
      qosh.push({ varaq: S3, katak: 'T' + sh.n, qiymat: [[(izohE ? izohE + ' | ' : '') + h.dmy + ': Xaridor tashabbusi bilan bekor qilindi (buyruq ' + z.raqam + ', dalolatnoma ' + z.xRaqam + '), to\'langan ' + XP.pul(tolangan) + ' so\'m to\'liq qaytarilgan']] });
    }
    return BY.tasdiqQollash(u, z, (izoh ? izoh + ' · ' : '') + 'Xaridor tashabbusi bilan, jarimasiz', h.dmyHm, qosh);
  });
  await kut(tetik.varaqlarYangila(BY.BEKOR_VARAQLAR).catch(e => console.error('ko\'zgu (bekor xaridor):', e.message)), 20000);
  try { const TG = require('../lib/telegram'); if (TG.bor()) await TG.direktor('✂ <b>' + r.x.no + '</b> (' + r.x.fish + ', ' + r.x.dokon + ') Xaridor tashabbusi bilan bekor qilindi — do\'kon bo\'shadi.' + (r.ogoh.length ? '\n⚠ ' + r.ogoh.join('\n⚠ ') : '')); } catch (e) { }
  return { ok: true, natija: r.natija };
}

module.exports = { bekorXaridorHolat, bekorXaridorKirit, bekorDalolatnomaSkan, bekorXaridorYakun };
module.exports._ichki = { tekshir };
