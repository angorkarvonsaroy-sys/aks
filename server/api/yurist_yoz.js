// AKS TIZIM — ⚖ Yurist bo'limining YOZADIGAN amallari serverda (Yurist.gs v25.9 bilan bir xil qoidalar, bir xil kataklar):
//   yuristQabul · yuristMajlis · yuristHolat · yuristKeyingi · yuristRad · yuristTasdiq
// Server Google jadvalga O'ZI yozadi (robot «Редактор»), keyin faqat o'zgargan varaqlarni ko'zguga qayta o'qiydi — 1–2 soniya.
// Skan fayli Google Drive'ga eski tizim orqali yuklanadi (Koprik.gs v1.2 → koprikHujjatYukla), chunki fayllar Drive'da, egasi — direktor hisobi.
// Telegram xabari ham eski tizim orqali (koprikTg). Qaysidir imkon bo'lmasa (robotda yozish huquqi yo'q / Koprik eski) —
// amal butunligicha eski tizimga yuboriladi (avvalgidek ishlaydi, faqat sekinroq). yuristTopBer — hali eski tizimda (topshiriq raqami o'sha yerda beriladi).
'use strict';
const { verOk } = require('../lib/versiya');
const crypto = require('crypto');
const S = require('./sessiya');
const V = require('../lib/varaq');
const J = require('../lib/jurnallar');
const U = require('../lib/undiruv_yordam');
const G = require('../lib/google');
const env = require('../lib/env');
const koprik = require('./koprik');
const tetik = require('../lib/kozgu_tetik');
const { redis } = require('../lib/db');
const { HUJJAT_TURLARI } = require('./hujjat');
const { Q } = require('./yurist');

const VAR = '06b_Yuridik_ishlar', TAR = '06f_Yurist_tarix', HUJ = '06d_Hujjatlar';
const YU_RAD_MUDDAT = 7;
const t = v => String(v == null ? '' : v).replace(/\s+/g, ' ').trim();
const harf = n => { let s = ''; while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s; };
const katak = (ustun, qator, gacha) => harf(ustun) + qator + (gacha ? ':' + harf(gacha) + qator : '');
function hozir(fmt) {   // Toshkent vaqti: 'dmyhms' → dd.MM.yyyy HH:mm:ss, 'dmyhm' → dd.MM.yyyy HH:mm
  const d = new Date(Date.now() + 5 * 3600 * 1000), p = n => String(n).padStart(2, '0');
  const s = p(d.getUTCDate()) + '.' + p(d.getUTCMonth() + 1) + '.' + d.getUTCFullYear() + ' ' + p(d.getUTCHours()) + ':' + p(d.getUTCMinutes());
  return fmt === 'dmyhms' ? s + ':' + p(d.getUTCSeconds()) : s;
}
const turNomi = tr => { const r = HUJJAT_TURLARI.find(z => z[0] === tr); return r ? r[1] : tr; };
function hujjatNomi(T, b) {
  if (T === Q.YU_TREK.Buyruq) return ({ 2: 'ариза (буйруқ тартибида)', 4: 'суд буйруғи', 7: 'МИБ ҳужжати' })[b] || 'ҳужжат';
  return turNomi(T.hujjat[b] || 'SUD');
}

// ------------------------------------------------------------------ imkoniyatlar (keshlanadi)
let imk = { yoz: null, yozT: 0, fayl: null, faylT: 0 };
async function yozishMumkin() {                       // robotda «Редактор» bormi — 06f sarlavhasini o'z qiymati bilan qayta yozib tekshiriladi
  if (imk.yoz !== null && Date.now() - imk.yozT < (imk.yoz ? 30 : 2) * 60000) return imk.yoz;
  try {
    const a1 = await G.qatorOqi(env.aksBazaId, TAR, 1, 'A', env.googleKey);
    await G.yoz(env.aksBazaId, [{ varaq: TAR, katak: 'A1', qiymat: [[a1[0] == null ? 'Vaqt' : a1[0]]] }], env.googleKey);
    imk.yoz = true;
  } catch (e) { if (!(e instanceof G.RuxsatYoq)) console.error('yozish tekshiruvi:', e.message); imk.yoz = false; }
  imk.yozT = Date.now(); return imk.yoz;
}
async function faylMumkin(kod) {                      // Koprik.gs v1.2 o'rnatilganmi (koprikHujjatYukla, koprikTg)
  if (imk.fayl !== null && Date.now() - imk.faylT < (imk.fayl ? 30 : 3) * 60000) return imk.fayl;
  try { imk.fayl = koprik.bor() && verOk(await koprik.chaqir('koprikVersiya', kod, []), '1.2'); }
  catch (e) { imk.fayl = false; }
  imk.faylT = Date.now(); return imk.fayl;
}

// ------------------------------------------------------------------ eski tizimga to'liq yuborish (imkon bo'lmasa)
async function eskiTizim(fn, u, args) {
  const r = await koprik.chaqir(fn, u.kod, args);
  await tetik.yangilaKut(20000);
  return r;
}

// ------------------------------------------------------------------ qulf (bir vaqtda bitta yurist yozuvi) — Apps Script LockService o'rni
async function qulfBilan(ish) {
  const kalit = 'qulf:yurist', belgi = crypto.randomBytes(8).toString('hex');
  const t0 = Date.now();
  while (!(await redis.set(kalit, belgi, 'PX', 30000, 'NX'))) {
    if (Date.now() - t0 > 30000) throw new S.Xato('Tizim band — birozdan keyin qayta urinib ko\'ring.');
    await new Promise(r => setTimeout(r, 150));
  }
  try { return await ish(); }
  finally { if ((await redis.get(kalit)) === belgi) await redis.del(kalit); }
}

// Ish — ko'zgudan qatorini topib, Google'dan YANGI o'qiladi (ko'zgu bir necha soniya orqada bo'lishi mumkin)
async function ishYangi(id) {
  const I = await J.yuIshlar();
  const m = I.find(z => String(z.id) === String(id)); if (!m) throw new S.Xato('Ish topilmadi.');
  const x = await G.qatorOqi(env.aksBazaId, VAR, m.qator, 'AG', env.googleKey);
  const i = J.yuIshQator(m.qator, x);
  if (String(i.id) !== String(id)) { tetik.yangila(); throw new S.Xato('Ish ma\'lumoti yangilanmoqda — sahifani yangilab, qayta urinib ko\'ring.'); }
  return i;
}
async function tarixYoz(i, voqea, kim, izoh, hujjat) {
  await G.qatorQosh(env.aksBazaId, TAR, [hozir('dmyhms'), i.id, i.no, voqea, kim, izoh || '', hujjat || ''], env.googleKey);
}
// 06b qatoriga yozish. Y: [[ustun, qiymat]] yoki [[ustun, [qiymatlar…]]] (yonma-yon kataklar).
// sanalar — sana ustunlari: u yerdagi «yyyy-MM-dd» qiymat SANA bo'lib (dd.MM.yyyy), qolganlari matn/raqam bo'lib (USER_ENTERED) yoziladi.
async function ishYoz(i, Y, sanalar) {
  const SN = new Set(sanalar || []), matn = [], sana = [];
  Y.forEach(([ust, q]) => (Array.isArray(q) ? q : [q]).forEach((v, k) => {
    const u = ust + k;
    if (SN.has(u) && /^\d{4}-\d{2}-\d{2}$/.test(String(v))) sana.push({ varaq: VAR, qator: i.qator, ustun: u, iso: String(v) });
    else matn.push({ varaq: VAR, katak: katak(u, i.qator), qiymat: [[v]] });
  }));
  if (matn.length) await G.yoz(env.aksBazaId, matn, env.googleKey);
  if (sana.length) await G.sanaYoz(env.aksBazaId, sana, env.googleKey);
}
async function yangila(fayl) {   // yozilgan varaqlar ko'zguga — kutamiz (odatda 1–2 s), cho'zilsa 15 s dan keyin javob baribir qaytadi
  await Promise.race([tetik.varaqlarYangila(fayl ? [VAR, TAR, HUJ] : [VAR, TAR]).catch(e => console.error('ko\'zgu (yurist yozuvi):', e.message)), new Promise(r => setTimeout(r, 15000))]);
}
// Server yozishi — robotda huquq bo'lmasa amal eski tizimga to'liq o'tadi
async function bajar(fn, u, args, ish) {
  if (!(await yozishMumkin())) return eskiTizim(fn, u, args);
  try { return await ish(); }
  catch (e) { if (e instanceof G.RuxsatYoq) { imk.yoz = false; imk.yozT = Date.now(); return eskiTizim(fn, u, args); } throw e; }
}

// ------------------------------------------------------------------ 📥 ishni qabul qilish
async function yuristQabul(args) {
  const [kodSes, id, kamchilik, izoh0] = args;
  const u = await S.ruxsat(kodSes, 'yurist');
  return bajar('yuristQabul', u, args.slice(1), () => qulfBilan(async () => {
    const i = await ishYangi(id);
    if (Q.YU_FAOL.indexOf(i.holati) < 0) throw new S.Xato('Ish holati: ' + i.holati + '.');
    if ((await Q.yuQabulMap())[String(i.id)]) throw new S.Xato('Bu ish allaqachon qabul qilingan.');
    const izoh = t(izoh0);
    if (kamchilik && izoh.length < 5) throw new S.Xato('Qanday kamchilik borligini qisqa yozing (kamida 5 belgi).');
    await tarixYoz(i, kamchilik ? 'Ish qabul qilindi — kamchilik bor' : 'Ish qabul qilindi', u.fish, izoh, '');
    await yangila();
    return { ok: true, kamchilik: !!kamchilik };
  }));
}

// ------------------------------------------------------------------ sud jarayonida — keyingi majlis sanasi
async function yuristMajlis(args) {
  const [kodSes, id, sana, izoh] = args;
  const u = await S.ruxsat(kodSes, 'yurist');
  return bajar('yuristMajlis', u, args.slice(1), () => qulfBilan(async () => {
    const i = await ishYangi(id);
    if (i.bosqich !== 3) throw new S.Xato('Majlis sanasi faqat «Sud jarayonida» bosqichida kiritiladi.');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(sana || '')) || sana < V.bugun()) throw new S.Xato('Keyingi majlis sanasi bugundan oldin bo\'lolmaydi.');
    await ishYoz(i, [[22, sana]], [22]);
    await tarixYoz(i, 'Keyingi sud majlisi: ' + Q.yuDmy(sana), u.fish, String(izoh || '').trim(), '');
    await yangila();
    return { ok: true };
  }));
}

// ------------------------------------------------------------------ holat: kelishuv / shartnoma bekor / undirib bo'lmadi
async function yuristHolat(args) {
  const [kodSes, id, amal, sabab0] = args;
  const u = await S.ruxsat(kodSes, 'yurist');
  return bajar('yuristHolat', u, args.slice(1), () => qulfBilan(async () => {
    const sabab = t(sabab0);
    const i = await ishYangi(id);
    if (Q.YU_FAOL.indexOf(i.holati) < 0) throw new S.Xato('Bu ish holati: ' + i.holati + '.');
    let natija;
    if (amal === 'kelishuv') {
      const yangi = i.holati === 'Kelishuv' ? 'Faol' : 'Kelishuv';
      if (yangi === 'Kelishuv' && sabab.length < 10) throw new S.Xato('Kelishuv shartlarini yozing (kamida 10 belgi): qancha, qachongacha.');
      await ishYoz(i, [[15, yangi]]);
      await tarixYoz(i, yangi === 'Kelishuv' ? 'Kelishuv — muddatlar to\'xtatildi' : 'Kelishuv buzildi — ish davom etadi', u.fish, sabab, '');
      natija = { ok: true, holati: yangi };
    } else {
      if (sabab.length < 10) throw new S.Xato('Sababini batafsil yozing (kamida 10 belgi).');
      if (amal === 'bekor') {
        await ishYoz(i, [[15, 'Yopildi — shartnoma bekor'], [31, sabab]]);
        await tarixYoz(i, 'Yopildi — shartnoma bekor qilindi', u.fish, sabab, '');
        natija = { ok: true, holati: 'Yopildi — shartnoma bekor' };
      } else if (amal === 'undirib') {
        await ishYoz(i, [[15, "Yopish so'ralgan"], [31, sabab]]);
        await tarixYoz(i, 'Undirib bo\'lmadi — yopish so\'raldi', u.fish, sabab, '');
        natija = { ok: true, holati: "Yopish so'ralgan" };
      } else throw new S.Xato('Noma\'lum amal.');
    }
    await yangila();
    return natija;
  }));
}

// Skanni Drive'ga yuklash (eski tizim orqali — hujjatYukla_ bilan aynan bir xil: tekshiruv, papka, nom, 06d yozuvi)
async function skanYukla(u, i0, m) {
  const x = (await U.undShartnomalar()).find(z => z.no === i0.no) || { no: i0.no, fish: i0.fish, dokon: i0.dokon };
  const hr = await koprik.chaqir('koprikHujjatYukla', u.kod, [m, { no: i0.no, tur: 'sotuv', fish: x.fish, dokon: x.dokon }]);
  if (!hr || hr.mavjud) throw new S.Xato((hr && hr.xabar) || 'Skan yuklanmadi.');
  return hr.nom || '';
}

// ------------------------------------------------------------------ keyingi bosqich (hujjat bilan)
async function yuristKeyingi(args) {
  const [kodSes, id, d0] = args; const d = d0 || {};
  const u = await S.ruxsat(kodSes, 'yurist');
  if (d.b64 && !(await faylMumkin(u.kod))) return eskiTizim('yuristKeyingi', u, args.slice(1));
  return bajar('yuristKeyingi', u, args.slice(1), async () => {
    const bugun = V.bugun();
    const i0 = await ishYangi(id);
    if (i0.holati !== 'Faol' && i0.holati !== 'Kelishuv') throw new S.Xato('Bu ish holati: ' + i0.holati + '.');
    let tartib = i0.tartib, tanlandi = false;
    if (i0.bosqich === 1 || (i0.bosqich === 2 && !tartib)) {
      tartib = d.tartib === 'Buyruq' ? 'Buyruq' : d.tartib === 'Davo' ? 'Davo' : ''; tanlandi = true;
      if (!tartib) throw new S.Xato('Ariza tartibini tanlang: buyruq tartibida yoki da\'vo tartibida.');
    }
    if (!tartib) tartib = 'Davo';
    const T = Q.YU_TREK[tartib];
    const b = Q.yuKeyingiB(T, i0.bosqich); if (!b) throw new S.Xato('Bu ish oxirgi bosqichda (MIB da).');
    if (i0.bosqich === 4 && i0.qaror === 'Рад этилди') throw new S.Xato('Sud da\'voni rad etgan — ish faqat «Undirib bo\'lmadi» deb yopiladi (yoki shikoyat natijasini kiritish uchun direktorga murojaat qiling).');
    const sana = String(d.sana || '');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(sana)) throw new S.Xato('Sanani tanlang.');
    if (sana > bugun) throw new S.Xato('Sana kelajakda bo\'lishi mumkin emas.');
    if (sana < i0.bosqichSana) throw new S.Xato('Sana oldingi bosqich sanasidan (' + Q.yuDmy(i0.bosqichSana) + ') oldin bo\'lolmaydi.');
    const bq = tartib === 'Buyruq';
    if (b === 2 && t(d.davoNo).length < 1) throw new S.Xato((bq ? 'Ariza' : 'Da\'vo arizasi') + ' raqamini yozing.');
    if (b === 3 && t(d.sudIshNo).length < 1) throw new S.Xato('Sud ish raqamini yozing.');
    if (b === 4 && !bq && Q.YU_QARORLAR.indexOf(d.qaror) < 0) throw new S.Xato('Sud qarorini tanlang.');
    if (b === 4 && bq && t(d.buyruqNo).length < 1) throw new S.Xato('Sud buyrug\'i raqamini yozing.');
    if (b === 6 && t(d.ijroNo).length < 1) throw new S.Xato('Ijro varaqasi raqamini yozing.');
    if (b === 7 && !bq && t(d.ijrochi).length < 3) throw new S.Xato('Davlat ijrochisining F.I.Sh. ni yozing.');
    const hTur = T.hujjat[b] || '';
    if (hTur && !d.b64) throw new S.Xato('Bu bosqichga o\'tish uchun hujjat skani majburiy (' + hujjatNomi(T, b) + ').');
    // hujjat — qulfdan OLDIN (eski tizimdagidek)
    let fayl = '';
    if (d.b64) {
      const izohH = (b === 2 ? '№' + t(d.davoNo) : b === 4 && bq ? '№' + t(d.buyruqNo) : '');
      fayl = await skanYukla(u, i0, { no: i0.no, turi: hTur || 'SUD', sana, b64: d.b64, sahifa: d.sahifa || '', izoh: (izohH ? izohH + ' · ' : '') + 'Yurist: ' + hujjatNomi(T, b) });
    }
    return qulfBilan(async () => {
      const i = await ishYangi(id);
      if (i.bosqich !== i0.bosqich || i.holati !== i0.holati) throw new S.Xato('Ish holati shu orada o\'zgargan — sahifani yangilang.' + (fayl ? ' Yuklangan skan 📎 Hujjatlarda saqlanib qoldi: ' + fayl : ''));
      const Y = [], F = [];
      let izoh = '';
      if (tanlandi) Y.push([32, tartib]);
      if (b === 2) {
        Y.push([6, [t(d.davoNo), sana, t(d.sudNomi) || Q.YU_SUD]]); F.push(7);
        izoh = (bq ? 'Ariza (buyruq tartibida) №' : 'Da\'vo №') + t(d.davoNo) + ', ' + (t(d.sudNomi) || Q.YU_SUD);
      } else if (b === 3) {
        Y.push([9, t(d.sudIshNo)], [23, sana]); F.push(23);
        izoh = 'Sud ish №' + t(d.sudIshNo);
      } else if (b === 4 && bq) {
        Y.push([9, t(d.buyruqNo)], [10, [sana, 'Суд буйруғи']], [24, sana]); F.push(10, 24);
        izoh = 'Sud buyrug\'i №' + t(d.buyruqNo) + (t(d.summa) ? ', summa ' + t(d.summa) : '');
      } else if (b === 4) {
        Y.push([10, [sana, d.qaror]]); F.push(10);
        izoh = d.qaror + (t(d.summa) ? ', summa ' + t(d.summa) : '');
      } else if (b === 5) {
        Y.push([24, sana]); F.push(24); izoh = 'Qaror kuchga kirdi';
      } else if (b === 6) {
        Y.push([12, [t(d.ijroNo), sana]]); F.push(13);
        izoh = 'Ijro varaqasi №' + t(d.ijroNo);
      } else if (b === 7) {
        if (t(d.ijrochi)) Y.push([14, t(d.ijrochi)]);
        Y.push([25, sana]); F.push(25);
        izoh = bq ? 'MIB da ijroda (sud buyrug\'i bo\'yicha)' + (t(d.ijrochi) ? ', davlat ijrochisi: ' + t(d.ijrochi) : '') : 'MIB, davlat ijrochisi: ' + t(d.ijrochi);
      }
      Y.push([20, [b, sana, '']]); F.push(21);
      await ishYoz(i, Y, F);
      await tarixYoz(i, T.bosqich[b], u.fish, izoh + (t(d.izoh) ? ' · ' + t(d.izoh) : ''), fayl);
      await yangila(!!fayl);
      return { ok: true, bosqich: b, nomi: T.bosqich[b] };
    });
  });
}

// ------------------------------------------------------------------ ariza rad etildi (2-bosqichda) — skan + sabab majburiy; ish 1-bosqichga qaytadi
async function yuristRad(args) {
  const [kodSes, id, d0] = args; const d = d0 || {};
  const u = await S.ruxsat(kodSes, 'yurist');
  if (!(await faylMumkin(u.kod))) return eskiTizim('yuristRad', u, args.slice(1));
  return bajar('yuristRad', u, args.slice(1), async () => {
    const bugun = V.bugun();
    const i0 = await ishYangi(id);
    if (i0.holati !== 'Faol' && i0.holati !== 'Kelishuv') throw new S.Xato('Bu ish holati: ' + i0.holati + '.');
    if (i0.bosqich !== 2) throw new S.Xato('«Ariza rad etildi» faqat 2-bosqichda (ariza berilgan) kiritiladi.');
    const sana = String(d.sana || '');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(sana)) throw new S.Xato('Rad etilgan sanani tanlang.');
    if (sana > bugun) throw new S.Xato('Sana kelajakda bo\'lishi mumkin emas.');
    if (sana < i0.bosqichSana) throw new S.Xato('Sana ariza berilgan sanadan (' + Q.yuDmy(i0.bosqichSana) + ') oldin bo\'lolmaydi.');
    const sabab = t(d.sabab); if (sabab.length < 10) throw new S.Xato('Rad etish sababini yozing (kamida 10 belgi) — sud ajrimidagi asos.');
    if (!d.b64) throw new S.Xato('Rad etish ajrimining skani majburiy.');
    const fayl = await skanYukla(u, i0, { no: i0.no, turi: 'SUD', sana, b64: d.b64, sahifa: d.sahifa || '',
      izoh: (i0.davoNo ? '№' + i0.davoNo + ' · ' : '') + 'Yurist: аризани рад этиш ажрими — ' + sabab });
    return qulfBilan(async () => {
      const i = await ishYangi(id); if (i.bosqich !== 2) throw new S.Xato('Ish holati shu orada o\'zgargan — sahifani yangilang.');
      const eski = 'Ariza №' + (i.davoNo || '—') + ' (' + Q.yuDmy(i.davoSana) + ') ' + Q.yuDmy(sana) + ' da rad etildi: ' + sabab;
      await ishYoz(i, [[16, (i.izoh ? i.izoh + ' | ' : '') + eski], [6, ['', '']], [33, Q.yuDmy(sana) + ': ' + sabab], [20, [1, sana, '']]], [21]);
      await tarixYoz(i, 'Ariza rad etildi — qayta beriladi', u.fish, eski, fayl);
      await yangila(true);
      return { ok: true, bosqich: 1, nomi: 'Ariza rad etildi — ' + YU_RAD_MUDDAT + ' kun ichida tuzatib qayta bering' };
    });
  });
}

// ------------------------------------------------------------------ direktor: tasdiqlash / rad etish (o'tkazish va «undirib bo'lmadi»)
// 24.10 direktor qarori: ish yuristga o'tkazilgan zahoti unga Telegram — mijoz, qarz, qabul qilish muddati.
// Eski tizimda bunday xabar yo'q edi: yurist ertasi kuni ilovani ochguncha bilmasdi, muddat esa 1 ish kuni.
async function yuristgaXabar(kod, i, bugun) {
  const YE = require('../lib/yurist_ertalab');
  const Y = await YE.yuristlar(); if (!Y.length) return;
  const x = (await U.undShartnomalar()).find(z => z.no === i.no) || {};
  const muddat = Q.yuDmy(yuIshKunQ(bugun, 1));
  const pul = n => Math.round(Number(n) || 0).toLocaleString('ru-RU').replace(/[\u00a0 ,]/g, ' ');
  const e = v => String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const m = '⚖ <b>Yangi ish keldi</b> — <b>' + e(i.no) + '</b> ' + e(String(x.fish || i.fish || '').split(/\s+/).slice(0, 3).join(' '))
    + (x.dokon ? ' · ' + e(x.dokon) : '')
    + '\nJami qarz: <b>' + pul(x.jami) + '</b> so\'m' + (x.muddati ? ' (muddati o\'tgan: ' + pul(x.muddati) + ')' : '')
    + '\nUndiruvchi: ' + e(i.undiruvchi || '—')
    + (i.sorovSabab ? '\nSabab: «' + e(String(i.sorovSabab).slice(0, 200)) + '»' : '')
    + '\n\n🔴 <b>Qabul qilish muddati: ' + muddat + '</b> (1 ish kuni).'
    + '\nHujjatlarni tekshiring: ilovada ⚖ Yurist → «✅ Qabul qilish» yoki «↩ Kamchilik bilan qaytarish».';
  const TG = require('../lib/telegram');
  for (const y of Y) { if (!y.tg) continue; try { await TG.chat(y.tg, m); } catch (e2) { console.error('yuristga xabar ' + y.fish + ':', e2.message); } }
}
function yuIshKunQ(iso, n) { let d = new Date(String(iso).slice(0, 10) + 'T12:00:00Z'), k = 0;
  while (k < n) { d = new Date(d.getTime() + 86400000); if (d.getUTCDay() !== 0) k++; }
  return d.toISOString().slice(0, 10); }
async function yuristTasdiq(args) {
  const [kodSes, id, ha, izoh0] = args;
  const u = await S.ruxsat(kodSes, 'admin');
  const izoh = t(izoh0);
  // rad etilsa undiruvchiga Telegram ketadi — buning uchun Koprik v1.2 kerak
  const I = await J.yuIshlar(); const m = I.find(z => String(z.id) === String(id));
  if (m && m.holati === 'Tasdiq kutilmoqda' && !ha && !(await faylMumkin(u.kod))) return eskiTizim('yuristTasdiq', u, args.slice(1));
  return bajar('yuristTasdiq', u, args.slice(1), () => qulfBilan(async () => {
    const i = await ishYangi(id);
    const vaqt = hozir('dmyhm'), bugun = V.bugun();
    let tg = null;
    if (i.holati === 'Tasdiq kutilmoqda') {
      if (ha) {
        await ishYoz(i, [[3, bugun], [15, 'Faol'], [20, [1, bugun]], [30, u.fish + ', ' + vaqt]], [3, 21]);
        await tarixYoz(i, 'Direktor tasdiqladi — yuristga o\'tdi', u.fish, izoh, '');
        yuristgaXabar(u.kod, i, bugun).catch(e => console.error('yuristga xabar:', e.message));   // 24.10: yuristga darhol Telegram
      } else {
        if (izoh.length < 5) throw new S.Xato('Rad etish sababini yozing.');
        await ishYoz(i, [[15, 'Rad etildi'], [30, 'Rad: ' + u.fish + ', ' + vaqt], [16, 'Direktor rad etdi (' + vaqt.slice(0, 10) + '): ' + izoh]]);
        await tarixYoz(i, 'Direktor rad etdi — mijoz undiruvchida qoladi', u.fish, izoh, '');
        tg = [i.undiruvchi, '⛔ <b>' + i.no + '</b> ' + String(i.fish || '').split(/\s+/).slice(0, 2).join(' ') + ' — yuristga o\'tkazish so\'rovingizni direktor rad etdi.\nSabab: «' + izoh + '»'];
      }
    } else if (i.holati === "Yopish so'ralgan") {
      if (ha) { await ishYoz(i, [[15, "Yopildi — undirib bo'lmadi"]]); await tarixYoz(i, 'Direktor tasdiqladi — yopildi (undirib bo\'lmadi)', u.fish, izoh, ''); }
      else { if (izoh.length < 5) throw new S.Xato('Rad etish sababini yozing.'); await ishYoz(i, [[15, 'Faol']]); await tarixYoz(i, 'Direktor yopishni rad etdi — ish davom etadi', u.fish, izoh, ''); }
    } else throw new S.Xato('Bu ish tasdiq kutmayapti (holati: ' + i.holati + ').');
    await yangila();
    if (tg && tg[0]) koprik.chaqir('koprikTg', u.kod, tg).catch(e => console.error('yurist tg (ko\'prik):', e.message));
    return { ok: true };
  }));
}

// ------------------------------------------------------------------ skanni yuklab olish (Yurist.gs yuristHujjat) — Drive'dan to'g'ridan-to'g'ri (robot «Читатель»)
// Robot faylni ko'ra olmasa (papka ulashilmagan / boshqa papkadagi eski fayl) — eski tizim orqali (avvalgidek).
async function yuristHujjat(args) {
  const [kodSes, hujjatId] = args;
  const u = await S.ruxsat(kodSes, 'yurist');
  const h = (await J.hujjatJurnal()).find(z => String(z.id) === String(hujjatId) && z.holati === 'Faol'); if (!h) throw new S.Xato('Hujjat topilmadi.');
  if (!u.admin && !(await J.yuIshlar()).some(i => i.no === h.no && i.holati !== 'Rad etildi' && i.holati !== 'Tasdiq kutilmoqda')) throw new S.Xato('Bu hujjat sizdagi ishga tegishli emas.');
  const sv = require('./hujjat_yoz').srvFayl(h.faylId, h.no, h.nom);   // serverdagi nusxa (yangi yuklangan yoki aks-skan nusxalagan) — bir zumda
  if (sv) return { nom: sv.nom, b64: sv.bytes.toString('base64') };
  try {
    const f = await G.driveFayl(h.faylId, env.googleKey);
    return { nom: f.nom, b64: f.bytes.toString('base64') };
  } catch (e) {
    if (!(e instanceof G.RuxsatYoq)) console.error('yuristHujjat (Drive):', e.message);
    return koprik.chaqir('yuristHujjat', u.kod, [hujjatId]);
  }
}

module.exports = { yuristQabul, yuristMajlis, yuristHolat, yuristKeyingi, yuristRad, yuristTasdiq, yuristHujjat };
