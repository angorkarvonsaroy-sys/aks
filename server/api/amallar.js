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
  if (!koprikdan) (async () => {   // serverda (yozuv_yondi:kirish07b), aks holda avvalgidek eski tizim pinKir orqali
    const KY = require('./kirish_yoz');
    if (await KY.yoqilgan()) { try { await KY.kirishYoz(x.fish, 'PIN'); return; } catch (e) { console.error('07b kirish (server):', e.message); } }
    if (koprik.bor()) await koprik.chaqir('pinKir', kod, [pin]);
  })().catch(e => console.error('07b kirish (ko\'prik):', e.message));
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
// 👁 Sifat.gs — ko'rish rejimi: sifatHavola, sifatAsosiy, sifatBilet, sifatida (yozuv_yondi:sifat bo'lsa serverda, aks holda ko'prik)
Object.assign(A, require('./sifat'));
// 👤 mijozKartaPdf (Mijoz.gs v2.3) — mijoz kartasi PDF serverda (yozuv_yondi:mijoz_karta_pdf + Chromium), aks holda eski tizim
Object.assign(A, require('./mijoz_pdf'));
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
// 📝 mijozSaqlash, shartnomaSaqlash, ijaraSaqlash — server o'zi yozadi (aks-yozuv-sinov shartnoma yoqgandan keyin); aks holda eski tizim
Object.assign(A, require('./shartnoma_yoz'));
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
// 📊 hisobotPdf (HisobotPDF.gs) — sotuv bo'limi hisoboti PDF (aks-yozuv-sinov hisobot bilan yoqiladi)
Object.assign(A, require('./hisobot_pdf'));
// ▶ Bugungi ish — undiruvchi amallari (Qadam.gs): qadamOtkaz, qadamDirektorga, qadamMalumot, qadamMuhlatSora, qadamTgYubordim (aks-yozuv-sinov qadam bilan yoqiladi)
Object.assign(A, require('./qadam_yoz'));
// ✎ tahrirSaqlash (Tahrir.gs), 📨 monSorovYubor / monSorovJavob (Monitoring.gs), 📌 topMalumotKirit / topMalumotTasdiq (Qadam.gs) — aks-yozuv-sinov tahrir bilan yoqiladi
Object.assign(A, require('./tahrir_yoz'));
// ▶ Bugungi ish: qadamXatBekor, qadamSkan, qadamHujjat (Qadam.gs) — aks-yozuv-sinov undiruv bilan yoqiladi (skan/hujjat — Koprik v1.7)
Object.assign(A, require('./qadam_hujjat'));
// ✉ xatYuborildi, xatTopYuborildi, xatTopPdf (Xat.gs v26.0) — aks-yozuv-sinov xat bilan yoqiladi (Koprik v1.7)
Object.assign(A, require('./xat_isbot'));
// 📌 topBajardim, topSkanZaynabga, topSkanBerilmagan (Topshiriq.gs v2.2) — aks-yozuv-sinov bajardim bilan yoqiladi (Koprik v1.7)
Object.assign(A, require('./bajardim'));
// ⚖ yuristgaSorov (Yurist.gs) — aks-yozuv-sinov yurist bilan yoqiladi
Object.assign(A, require('./yurist_sorov'));
// ✉ xatTayyorla, xatQaytaYasa, xatTopTayyorla (Xat.gs v26.1), qadamXatChiqar, qadamTalabChiqar (Qadam.gs v2.2) — xat PDF serverda (lib/xat_pdf.js); aks-yozuv-sinov xatchiqar bilan yoqiladi (Koprik v1.8)
Object.assign(A, require('./xat_chiqar'));
// ✂ shartnomani bekor qilish: bekorKirit, bekorQaytaYasa, bekorBuyruqSkan, bekorXabarnomaSkan, qadamBekorKirit — serverda (yoqilgan bo'lsa), aks holda eski tizim
Object.assign(A, require('./bekor_yoz'));
// ⚖ yuristTogridan, yuristTopBer — serverda (yoqilgan bo'lsa), aks holda eski tizim
Object.assign(A, require('./yurist_ish'));
// ⚖ yurist hujjatlari: yhMalumotnoma, yhBayonnoma, yhPenya (PDF / Word / Excel) — serverda (yoqilgan bo'lsa), aks holda eski tizim
Object.assign(A, require('./yurist_hujjat'));
// ⚖ yurist aloqa xati: yhAloqa, yhAloqaYuborildi, yhAloqaBekor — serverda (yoqilgan bo'lsa), aks holda eski tizim
Object.assign(A, require('./yurist_aloqa'));
// 📎 fayllar: devonFayl, bekorFayl, kbFayl, tqFayl, yhAloqaFayl — Drive (robot) orqali, bo'lmasa eski tizim
Object.assign(A, require('./fayl'));
// 💵🚶 tashrifTekshir, bugungiTashriflar (o'qish); tolovSaqlash, tashrifSaqlash — server o'zi yozadi (aks-yozuv-sinov yoqgandan keyin)
Object.assign(A, require('./kassa'));
// 🔁 qayta tuzish (Qayta.gs): qaytaKor, qaytaOchiq (o'qish); qaytaSkan, qaytaTekshiruvga, qaytaQaytar (yozuv — yozuv_yondi:qayta bo'lsa);
//   qaytaLoyiha, qaytaIjrochi, qaytaTasdiq (2-bosqich — yana yozuv_yondi:qayta2 bo'lsa)
Object.assign(A, require('./qayta'));
// ✉ «Bugungi ish»: qadamXatYetkaz, qadamTalabYetkaz — xat isboti (server xatYuborildi / xatTopYuborildi) + qadamMijoz
Object.assign(A, require('./qadam_xat'));
// 🔑 xodimlar huquqlari (Sozlamalar → Huquqlar): huqRoyxat, huqSaqla — faqat serverda, faqat direktor
Object.assign(A, require('./huquq'));
// 📄 shartnomaPdf (sotuv), ijaraPdf (ijara) — PDF serverda (yozuv_yondi:shartnoma_pdf bo'lsa; Drive nusxasi va 03 S / 04 V — fonda eski tizim), aks holda eski tizim
Object.assign(A, require('./shartnoma_pdf'));
// 🎲 ijroTekshirJavob (Ijro.gs) — tekshiruv qo'ng'irog'i javobi: 06p, 10, 06q (yozuv_yondi:ijro_tekshir bo'lsa), aks holda eski tizim
Object.assign(A, require('./ijro_yoz'));
// ✕ ijaraImzosizSorov, ijaraImzosizJavob (ImzosizBekor.gs) — imzolanmagan ijara: 06l, 04, 06j (yozuv_yondi:imzosiz bo'lsa); ijaraImzosizBekor — yozuv_yondi:imzosiz_bekor; aks holda eski tizim
Object.assign(A, require('./imzosiz_yoz'));
// 📮 devonKirimSaqla (Devon.gs) — kirim xat: 11_Devonxona qatori, skan Drive'ga va direktorga Telegram — Koprik v1.12 (yozuv_yondi:devon bo'lsa); devonKordi — «direktor ko'rdi» (yozuv_yondi:devon_kordi); aks holda eski tizim
Object.assign(A, require('./devon_yoz'));
// 🤝 kbTayyorla (KelishuvBekor.gs) — kelishuv + dalolatnoma PDF/Word serverda, 06m qatori (yozuv_yondi:kb bo'lsa; Drive — fonda Koprik v1.12); kbSkan, kbBekor, kbTasdiq — yozuv_yondi:kb2 (Koprik v1.13); aks holda eski tizim
Object.assign(A, require('./kb_yoz'));
// 🤖 topHozir (Topshiriq.gs topAvto) — qoidalar bo'yicha topshiriqlar va avtomatik yopish serverda (yozuv_yondi:top_avto bo'lsa), aks holda eski tizim
Object.assign(A, require('./top_avto'));

// amal bo'lmagan eksportlar (Q, _ichki, ro'yxatlar) RPC ga chiqmasin
for (const k of Object.keys(A)) if (typeof A[k] !== 'function') delete A[k];

// serverda bajariladigan YOZUV amallari (index.js ulardan keyin xodim keshini tozalaydi)
Object.defineProperty(A, 'YOZUV', { value: new Set(['yuristQabul', 'yuristMajlis', 'yuristHolat', 'yuristKeyingi', 'yuristRad', 'yuristTasdiq', 'hujjatYukla', 'undYoz', 'qadamChora', 'qadamNazoratYoz', 'qadamKechiktir', 'tolovSaqlash', 'tashrifSaqlash', 'qadamKutish', 'taminotKiritish', 'taminotTasdiq', 'hujjatTuzat', 'topBer', 'topSkanTopilmadi', 'tasdiqQil', 'topTasdiq', 'xatBekor', 'boshRejaYoz', 'mijozSaqlash', 'shartnomaSaqlash', 'ijaraSaqlash', 'qadamOtkaz', 'qadamDirektorga', 'qadamMalumot', 'qadamMuhlatSora', 'qadamTgYubordim', 'qadamOtkazRuxsat', 'qadamMuhlatRuxsat', 'qadamKutishRuxsat', 'tahrirSaqlash', 'monSorovYubor', 'monSorovJavob', 'topMalumotKirit', 'topMalumotTasdiq', 'qadamXatBekor', 'qadamSkan', 'qadamHujjat', 'xatYuborildi', 'xatTopYuborildi', 'topBajardim', 'topSkanZaynabga', 'topSkanBerilmagan', 'yuristgaSorov', 'xatTayyorla', 'xatQaytaYasa', 'xatTopTayyorla', 'qadamXatChiqar', 'qadamTalabChiqar', 'bekorKirit', 'bekorQaytaYasa', 'bekorBuyruqSkan', 'bekorXabarnomaSkan', 'qadamBekorKirit', 'yuristTogridan', 'yuristTopBer', 'yhAloqa', 'yhAloqaYuborildi', 'yhAloqaBekor', 'huqSaqla', 'qadamXatYetkaz', 'qadamTalabYetkaz', 'qaytaSkan', 'qaytaTekshiruvga', 'qaytaQaytar', 'qaytaLoyiha', 'qaytaIjrochi', 'qaytaTasdiq', 'qaytaHujjatlar', 'shartnomaPdf', 'ijaraPdf', 'ijroTekshirJavob', 'ijaraImzosizSorov', 'ijaraImzosizJavob', 'devonKirimSaqla', 'kbTayyorla', 'topHozir', 'kbSkan', 'kbBekor', 'kbTasdiq', 'ijaraImzosizBekor', 'devonKordi']), enumerable: false });
module.exports = A;
