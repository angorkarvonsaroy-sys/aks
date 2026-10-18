// AKS TIZIM — serverda bajariladigan amallar (eski tizimdagi google.script.run funksiyalarining o'rnini bosadi).
// Har bir amal: async (args) => natija. args[0] — eski tizimdagidek: pin*/tg* da kirish kodi, qolganlarda «kod|tok».
// Bu ro'yxatda yo'q amallar ko'prik orqali eski tizimga yuboriladi (koprik.js).
'use strict';
const S = require('./sessiya');
const koprik = require('./koprik');
const { q } = require('../lib/db');

const A = {};

// ---------------- PIN (Pin.gs)
A.pinHolat = async ([kod]) => {
  const x = await S.xodimKod(kod);
  if (!x) throw new S.Xato('Kirish taqiqlangan. Havolani qayta oching.');
  return { ism: x.ism, pinBor: !!x.pin, tgBor: !!x.tg, telBor: !!x.tel, tel: S.telYashir(x.tel), blok: await S.blokDaq(kod), bot: 'aks_karvon_bot' };
};

A.pinKir = async ([kod, pin]) => {
  const x = await S.xodimKod(kod);
  if (!x) throw new S.Xato('Kirish taqiqlangan. Havolani qayta oching.');
  const b = await S.blokDaq(kod); if (b) throw new S.Xato('Kirish ' + b + ' daqiqaga bloklangan. Keyinroq urinib ko\'ring.');
  pin = String(pin || '');
  let togri = !!x.pin && S.pinTekshir(x.pin, kod, pin), koprikdan = false;
  // PIN hozirgina o'rnatilgan/almashtirilgan bo'lishi mumkin (ko'zgu 5 daqiqada keladi) — eski tizimdan tasdiq olinadi
  if (!togri && koprik.bor()) {
    try { const r = await koprik.chaqir('pinKir', kod, [pin]); if (r && r.tok) { togri = true; koprikdan = true; } }
    catch (e) { if (!x.pin || !/noto'g'ri|bloklan/i.test(e.message)) throw new S.Xato(e.message); }
  }
  if (!x.pin && !togri) throw new S.Xato('PIN hali o\'rnatilmagan.');
  if (!togri) {
    const h = await S.xatoYoz(kod);
    if (h.blok) throw new S.Xato(S.XATO_MAX + ' marta noto\'g\'ri PIN. Kirish ' + S.BLOK_DAQ + ' daqiqaga bloklandi.');
    throw new S.Xato('PIN noto\'g\'ri. Yana ' + h.qoldi + ' ta urinish qoldi.');
  }
  await S.xatoToza(kod);
  kirishJurnali(x, 'PIN').catch(() => {});
  // eski tizimning 07b_Kirish_jurnali ham bilsin (direktor «Ishlar», «Jamoa bugun», ijro intizomi shundan o'qiydi) — fonda, kutmasdan
  if (!koprikdan && koprik.bor()) koprik.chaqir('pinKir', kod, [pin]).catch(e => console.error('07b kirish (ko\'prik):', e.message));
  return { tok: await S.sessiyaOch(kod) };
};

A.pinTirik = async ([kodSes]) => ({ ok: !!(await S.foydalanuvchi(kodSes)) });

// Birinchi kirish / PIN tiklash — Telegram bot eski tizimda; ko'prik orqali
for (const fn of ['tgUlanishBoshla', 'tgUlanishTekshir', 'pinKodYubor']) {
  A[fn] = async ([kod, ...rest]) => koprik.chaqir(fn, kod, rest);
}
A.pinOrnat = async ([kod, tgKod, pin]) => {
  const r = await koprik.chaqir('pinOrnat', kod, [tgKod, pin]);   // eski tizim jadvalga yozadi; 5 daqiqada ko'zguga keladi
  const x = await S.xodimKod(kod);
  if (!x) throw new S.Xato('Kirish taqiqlangan.');
  return { tok: await S.sessiyaOch(kod) };
};

// ---------------- xodim o'zi haqida (yangi, tez)
A.menKimman = async ([kodSes]) => {
  const u = await S.ruxsat(kodSes);
  return { id: u.id, fish: u.fish, ism: u.ism, lavozim: u.lavozim, huquq: u.huquq };
};

// 07b_Kirish_jurnali o'rniga: kirishlar serverda yoziladi (keyin hisobotga ulanadi)
async function kirishJurnali(x, usul) {
  await q(`INSERT INTO kirishlar (kompaniya_id, xodim_id, fish, usul) VALUES (1, $1, $2, $3)`, [x.id, x.fish, usul]);
}

// ---------------- 👤 Mijozlar (Mijoz.gs o'rni) — ko'zgudan, Google'siz
// 👁 Sifat.gs sifatXodimlar — direktor uchun xodimlar ro'yxati (ko'prik bu amalga eski sessiyani bermasdi → «Kirish taqiqlangan»)
A.sifatXodimlar = async ([kodSes]) => {
  await S.ruxsat(kodSes, 'admin');
  const r = await q(`SELECT xodim_id, fish, lavozim, huquqlar FROM v_xodimlar WHERE kompaniya_id = 1 AND holat = 'Ishlayapti' AND huquqlar IS NOT NULL ORDER BY qator_no`);
  return r.rows.filter(x => !x.huquqlar.includes('admin'))
    .map(x => ({ id: x.xodim_id, fish: x.fish, lavozim: x.lavozim, huquq: x.huquqlar.join(', '), komp: x.huquqlar.includes('kompyuter_rejim') }));
};

Object.assign(A, require('./mijoz'));
// ---------------- 📎 Hujjatlar: ro'yxatlar (Hujjat.gs o'qiydigan qismi)
Object.assign(A, require('./hujjat'));
delete A.HUJJAT_TURLARI;
// ⚖ Yurist: yuristBoshlang, yuristIsh (Yurist.gs v25.9) — o'qish serverda; yozuvlar hali ko'prikda
Object.assign(A, require('./yurist'));
delete A.Q;
// ⚖ Yurist yozuvlari: yuristQabul, yuristMajlis, yuristHolat, yuristKeyingi, yuristRad, yuristTasdiq — server o'zi yozadi
Object.assign(A, require('./yurist_yoz'));
// 💰 Undiruv: undBoshlang (portfel) — lib/portfel.js
Object.assign(A, require('./undiruv'));
// 👔 Direktor bo'limi: monBoshlang (Monitoring.gs v26.4) — lib/portfel.js + lib/tasdiq.js
Object.assign(A, require('./monitoring'));
// 🏠 Bosh sahifa: boshMalumot (Bosh.gs v1.3), 📊 hisobotMalumot (Hisobot.gs v27.10)
Object.assign(A, require('./bosh'));
// 📎 Hujjat yuklash — fayl serverda, fonda Drive'ga (Koprik v1.3)
const HY = require('./hujjat_yoz'); A.hujjatYukla = HY.hujjatYukla; A.hujjatTuzat = HY.hujjatTuzat;   // tuzatish — aks-yozuv-sinov hujjat va Koprik v1.6 bilan, aks holda eski tizim
// ▶ Bugungi ish: qadamBoshlang, qadamMijoz, qadamJamoa, qadamNazorat (Qadam.gs v2.1 + Ijro.gs ijroQisqa_)
Object.assign(A, require('./qadam'));
// undiruvchi yozuvlari: undYoz, qadamChora, qadamNazoratYoz, qadamKechiktir — server jadvalga o'zi yozadi
Object.assign(A, require('./undiruv_yoz'));
// shartnomalar, devonDirektor, bekorDirektor
Object.assign(A, require('./direktor'));
// 📦 Ta'minot (taminotDirektor, taminotSvodOl, taminotBoshlang), 🤝 kbDirektor, ✕ ijaraImzosizRoyxat — o'qish
Object.assign(A, require('./taminot'));
// 📦 Ta'minot yozuvlari (taminotKiritish, taminotTasdiq) — aks-yozuv-sinov taminot yoqgandan keyin va Koprik v1.5 bilan; aks holda eski tizim
Object.assign(A, require('./taminot_yoz'));
// 📌 topRoyxat (direktor topshiriqlari) — serverda; topQoidaYoz — eski tizim + server nusxasi
Object.assign(A, require('./topshiriq'));
// 📌 topBer (topshiriq berish), topSkanTopilmadi — server o'zi yozadi (aks-yozuv-sinov topshiriq yoqgandan keyin va Koprik v1.5 bilan); aks holda eski tizim
Object.assign(A, require('./topshiriq_yoz'));
// 🔎 tasdiqQil, topTasdiq — tekshiruv serverda, qarorni eski tizim fonda bajaradi (navbat); aks-yozuv-sinov tasdiq bilan yoqiladi
Object.assign(A, require('./tasdiq_navbat'));
// ✕ xatBekor, 🏠 boshRejaYoz — server o'zi yozadi (aks-yozuv-sinov mayda yoqgandan keyin); aks holda eski tizim
Object.assign(A, require('./mayda_yoz'));
// 🗺 xaritaMalumot (Kod.gs 5-bo'lim)
Object.assign(A, require('./xarita'));
// 📎 Hujjatlar kartasi panellari: tahrirHolat, bekorHolat — o'qish
Object.assign(A, require('./hujjat_panel'));
// ✉ xatBoshlang (Xat.gs) — ro'yxat; xat yasash/yuborish — eski tizimda
Object.assign(A, require('./xat'));
// 🏠 xodimBosh (XodimBosh.gs v1.1) — xodim bosh sahifasi
Object.assign(A, require('./xodim_bosh'));
// 📝 shartnomaBoshlang, 💵 bugungiTolovlar — o'qish (Kod.gs)
Object.assign(A, require('./shartnoma'));
// 📋 reyestrIjara, reyestrSotuv (Reyestr.gs) — onlayn ro'yxat
Object.assign(A, require('./reyestr'));
// 📎 fayllar: devonFayl, bekorFayl, kbFayl, tqFayl, yhAloqaFayl — Drive (robot) orqali, bo'lmasa eski tizim
Object.assign(A, require('./fayl'));
// 💵🚶 tashrifTekshir, bugungiTashriflar (o'qish); tolovSaqlash, tashrifSaqlash — server o'zi yozadi (aks-yozuv-sinov yoqgandan keyin)
Object.assign(A, require('./kassa'));

// amal bo'lmagan eksportlar (Q, _ichki, ro'yxatlar) RPC ga chiqmasin
for (const k of Object.keys(A)) if (typeof A[k] !== 'function') delete A[k];

// serverda bajariladigan YOZUV amallari (index.js ulardan keyin xodim keshini tozalaydi)
Object.defineProperty(A, 'YOZUV', { value: new Set(['yuristQabul', 'yuristMajlis', 'yuristHolat', 'yuristKeyingi', 'yuristRad', 'yuristTasdiq', 'hujjatYukla', 'undYoz', 'qadamChora', 'qadamNazoratYoz', 'qadamKechiktir', 'tolovSaqlash', 'tashrifSaqlash', 'qadamKutish', 'taminotKiritish', 'taminotTasdiq', 'hujjatTuzat', 'topBer', 'topSkanTopilmadi', 'tasdiqQil', 'topTasdiq', 'xatBekor', 'boshRejaYoz']), enumerable: false });
module.exports = A;
