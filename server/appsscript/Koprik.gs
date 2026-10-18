// FAYL: Koprik.gs — Apps Script loyihasidagi «Koprik» fayli (v1.8). Boshqa fayllar o'zgarmaydi.
// v1.8: koprikXatSaqla — server yasagan ogohlantirish xati PDF ini direktor Drive'idagi «AKS TIZIM / 06 XATLAR / <yil>» papkasiga qo'yish
//       (xatChiqar_ dagi papka va nom bilan bir xil); qayta yasalganda eski PDF savatga (xatQaytaYasa dagi setTrashed). 06e ni server o'zi yozadi.
//       koprikIsbotSaqla — topshiriq isboti faylini «AKS TIZIM / 06 TOPSHIRIQ ISBOTLARI» ga (topIsbotSaqla_ papkasi).
// v1.7: koprikTopTasdiqTg — topshiriq isboti tekshiruvchi(lar)ga Telegram (fayl + ✅/✖): tgTasdiqYubor_(tasdiqTopItem_) ning o'zi;
//       koprikXatTasdiqTg — xat isboti direktorga (xatTasdiqItem_). Server topshiriqni / xatni o'zi yozadi, fayl Drive'ga ko'chgach shu chaqiriladi.
// v1.6: koprikHujjatBekorFayl — «✎ Tuzatish» qilingan skanni Drive'da «_BEKOR QILINGANLAR» papkasiga ko'chirish va nomini BEKOR_… qilish
//       (hujjatTuzat dagi bilan bir xil; 06d va boshqa jurnallarni server o'zi yozadi).
// v1.5: koprikTgYubor — direktor(lar)ga Telegram (tgYubor_), koprikTgChat — istalgan Telegram chatga (tgYuborChat_).
//       Server o'zi yozadigan amallar (ta'minot va keyingilari) xabarni shu orqali yuboradi — xodim kutmaydi.
// v1.4: koprikQdSnap — «Bugungi ish» ertalabki navbati (Qadam.gs qdSnap_, Script Properties) — server bilan bitta ro'yxat.
// v1.3: koprikDriveSaqla — serverga yuklangan skanni direktor Drive'idagi mijoz papkasiga ko'chirish (06d ni server o'zi yozadi).
// v1.2: yurist yozuvlari serverga ko'chdi — server jadvalga o'zi yozadi, faqat Drive va Telegram shu yerda:
//       koprikVersiya, koprikHujjatYukla (skan → Drive + 06d, hujjatYukla_ bilan aynan bir xil), koprikTg (xodimga Telegram).
// v1.1: koprikZanjir — XAT_ZANJIR (Script Properties) ni serverga beradi (yurist mezoni uchun).
/**
 * AKS TIZIM — SERVER KO'PRIGI. Yangi server (aks-tizim.uz) hali o'ziga ko'chirilmagan amallarni shu orqali eski tizimda bajaradi.
 * Tizim muallifi va yaratuvchisi: Kamoliddin Naqiyev
 *
 * O'rnatish (bir marta):
 *  1. Apps Script → «+» → Скрипт → nomi: Koprik → shu faylni to'liq qo'ying.
 *  2. Настройки проекта (⚙) → Свойства скрипта → Добавить: BRIDGE_SECRET = <serverdagi .env dagi BRIDGE_SECRET bilan BIR XIL uzun kalit>.
 *  3. Развернуть → Управление развертываниями → ✎ → Версия: Новая версия → Развернуть. (Доступ: «Все» — avvalgidek.)
 *
 * Xavfsizlik: faqat BRIDGE_SECRET ni bilgan (ya'ni server) chaqira oladi. Kalit URL da emas, so'rov tanasida.
 * Sessiya: server xodimni o'zi tekshirib bo'lgan; bu yerda o'sha xodim uchun eski tizim sessiyasi (CacheService) ochiladi
 * va funksiya xuddi ilovadan chaqirilgandek «kod|tok» bilan bajariladi. pin va tg funksiyalari (va sifatBilet) — kirish kodining o'zi bilan.
 */
function doPost(e) {
  const javob = o => ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
  let b;
  try { b = JSON.parse((e && e.postData && e.postData.contents) || '{}'); } catch (err) { return javob({ ok: false, xato: 'So\'rov tushunarsiz' }); }
  const sir = PropertiesService.getScriptProperties().getProperty('BRIDGE_SECRET') || '';
  if (!sir || String(b.s || '') !== sir) return javob({ ok: false, xato: 'Ko\'prik: ruxsat yo\'q' });
  const fn = String(b.fn || '').replace(/[^A-Za-z0-9_]/g, '');
  const kod = String(b.kod || '').trim();
  const args = Array.isArray(b.args) ? b.args : [];
  if (!fn || fn === 'doGet' || fn === 'doPost' || /_$/.test(fn)) return javob({ ok: false, xato: 'Ko\'prik: bunday amal yo\'q' });
  const f = globalThis[fn];
  if (typeof f !== 'function') return javob({ ok: false, xato: 'Eski tizimda funksiya topilmadi: ' + fn });
  if (!foydalanuvchiKod_(kod)) return javob({ ok: false, xato: 'Kirish taqiqlangan.' });
  try {
    const birinchi = (/^(pin|tg)/.test(fn) || fn === 'sifatBilet') ? kod : kod + '|' + koprikSessiya_(kod);   // v1.2: sifatHavola/sifatAsosiy ham sessiya bilan
    const r = f.apply(null, [birinchi].concat(args));
    return javob({ ok: true, r: r === undefined ? null : r });
  } catch (err) {
    return javob({ ok: false, xato: err && err.message ? err.message : String(err) });
  }
}
// Server nomidan ochilgan eski-tizim sessiyasi: xodim uchun bitta, 15 daqiqa, har chaqiruvda uzayadi
function koprikSessiya_(kod) {
  const c = CacheService.getScriptCache();
  let tok = c.get('srvses_' + kod);
  if (tok && c.get('ses_' + tok) === kod) { c.put('ses_' + tok, kod, PIN_SESSIYA_SEK); c.put('srvses_' + kod, tok, PIN_SESSIYA_SEK); return tok; }
  tok = pinSessiya_(kod);
  c.put('srvses_' + kod, tok, PIN_SESSIYA_SEK);
  return tok;
}
// v1.1: xat zanjiri (Xat.gs xatZanjir_ — Script Properties XAT_ZANJIR). Server yurist mezonida ishlatadi.
function koprikZanjir(kod) { if (!foydalanuvchi_(kod)) throw new Error('Sessiya tugagan.'); return (typeof xatZanjir_ === 'function') ? xatZanjir_() : {}; }   // v1.4: har qanday xodim (undiruvchi ham)
// v1.2: server qaysi imkoniyatlar borligini shu bilan biladi
function koprikVersiya(kod) { return '1.8'; }
// v1.2: skanni Drive'ga yuklash (yurist bosqichi / rad ajrimi). Tekshiruv, papka, fayl nomi, 06d yozuvi — hujjatYukla_ ning o'zi.
function koprikHujjatYukla(kod, m, sh) { const u = ruxsat_(kod, 'yurist'); return hujjatYukla_(u, m, sh); }
// v1.2: xodimga shaxsan Telegram (07_Xodimlar U ustuni) — yuTgXodim_ ning o'zi
function koprikTg(kod, fish, matn) { ruxsat_(kod, 'yurist'); yuTgXodim_(SpreadsheetApp.openById(SS_ID), fish, matn); return { ok: true }; }
// v1.3: serverdagi skanni Drive'ga (hujjatPapka_ — «05 MIJOZ HUJJATLARI / <shartnoma> <mijoz>»). m = {no, fish, nom, b64}. Qaytaradi {id}.
function koprikDriveSaqla(kod, m) {
  ruxsat_(kod, 'hujjat');
  const papka = hujjatPapka_(String(m.no), m.fish);
  const bor = papka.getFilesByName(String(m.nom));
  if (bor.hasNext()) return { id: bor.next().getId(), bor: true };
  const f = papka.createFile(Utilities.newBlob(Utilities.base64Decode(String(m.b64 || '')), 'application/pdf', String(m.nom)));
  return { id: f.getId() };
}
// v1.4: ertalabki navbat ro'yxati (Qadam.gs qdSnap_): o'qish — bo'sh ro'yxat bilan; yozish — yangi raqamlar bilan. Qaytaradi {n: [...]}
function koprikQdSnap(kod, fish, bugun, navbatNo, tugadiNo) { ruxsat_(kod, 'undiruv'); return { n: Object.keys(qdSnap_(String(fish), String(bugun), navbatNo || [], tugadiNo || [])) }; }
// v1.5: direktor(lar)ga Telegram — tgYubor_ ning o'zi (07_Xodimlar: admin + U ustuni; topilmasa — guruhga)
function koprikTgYubor(kod, matn) { if (!foydalanuvchi_(kod)) throw new Error('Sessiya tugagan.'); tgYubor_(String(matn || '')); return { ok: true }; }
// v1.5: istalgan chatga (xodimning Telegram ID si — serverda 07_Xodimlar U ustunidan) — tgYuborChat_ ning o'zi
function koprikTgChat(kod, chat, matn) { if (!foydalanuvchi_(kod)) throw new Error('Sessiya tugagan.'); tgYuborChat_(String(chat || ''), String(matn || '')); return { ok: true }; }
// v1.6: skanni bekor qilinganlar papkasiga (Hujjat.gs hujjatTuzat: moveTo + setName) — fayl topilmasa xato qaytadi, server e'tiborsiz qoldiradi
function koprikHujjatBekorFayl(kod, faylId, nom) {
  ruxsat_(kod, 'hujjat');
  const f = DriveApp.getFileById(String(faylId));
  f.moveTo(papka_(HUJJAT_ILDIZ.concat([HUJJAT_BEKOR_PAPKA])));
  f.setName(String(nom));
  return { ok: true };
}
// v1.7: topshiriq isboti — tekshiruvchi(lar)ga Telegram (Topshiriq.gs tgTasdiqYubor_ + tasdiqTopItem_; havola 10_Topshiriqlar V ustuniga o'zi yoziladi)
function koprikTopTasdiqTg(kod, id) {
  if (!foydalanuvchi_(kod)) throw new Error('Sessiya tugagan.');
  const ss = SpreadsheetApp.openById(SS_ID);
  const t = topRows_(ss).find(function (z) { return String(z.id) === String(id); });
  if (!t) return { ok: false };
  return { ok: true, ref: tgTasdiqYubor_(ss, tasdiqTopItem_(ss, t)) };
}
// v1.7: xat isboti — direktorga Telegram (Xat.gs xatTasdiqItem_ + tgTasdiqYubor_; havola 06e Y ustuniga o'zi yoziladi)
function koprikXatTasdiqTg(kod, raqam) {
  if (!foydalanuvchi_(kod)) throw new Error('Sessiya tugagan.');
  const ss = SpreadsheetApp.openById(SS_ID);
  const h = xatJurnal_(ss).find(function (z) { return z.raqam === String(raqam); });
  const it = h ? xatTasdiqItem_(ss, h) : null;
  return { ok: !!it, ref: it ? tgTasdiqYubor_(ss, it) : '' };
}
// v1.8: ogohlantirish xati PDF i → «AKS TIZIM / 06 XATLAR / <yil>». m = { yil, nom, b64, eski }.
//   b64 bo'lsa — fayl yaratiladi (eski berilmagan bo'lsa va shu nomli fayl bor bo'lsa — o'sha qaytadi: qayta urinishda ikkinchi nusxa bo'lmasin);
//   eski (Drive ID) bo'lsa — o'sha fayl savatga, faqat «06 XATLAR» ichidagi bo'lsa. Qaytaradi { id, url } (faqat eski bo'lsa — { ok }).
function koprikXatSaqla(kod, m) {
  if (!foydalanuvchi_(kod)) throw new Error('Sessiya tugagan.');
  m = m || {}; var f = null;
  if (m.b64) {
    var yil = String(m.yil || '').replace(/\D/g, '').slice(0, 4), nom = String(m.nom || '');
    if (yil.length !== 4 || !/^[\w.\-]+\.pdf$/.test(nom)) throw new Error('Xat fayli nomi noto\'g\'ri.');
    var papka = papka_(['AKS TIZIM', '06 XATLAR', yil]);
    if (!m.eski) { var bor = papka.getFilesByName(nom); if (bor.hasNext()) f = bor.next(); }
    if (!f) f = papka.createFile(Utilities.newBlob(Utilities.base64Decode(String(m.b64)), 'application/pdf', nom));
  }
  if (m.eski) {
    try {
      var e = DriveApp.getFileById(String(m.eski)), p = e.getParents(), ota = p.hasNext() ? p.next().getParents() : null;
      if (ota && ota.hasNext() && ota.next().getName() === '06 XATLAR') e.setTrashed(true);
    } catch (x) { }
  }
  return f ? { id: f.getId(), url: f.getUrl() } : { ok: true };
}
// v1.8: topshiriq isboti fayli → «AKS TIZIM / 06 TOPSHIRIQ ISBOTLARI» (topIsbotSaqla_ papkasi). m = { nom, b64 }. Qaytaradi { id }.
function koprikIsbotSaqla(kod, m) {
  if (!foydalanuvchi_(kod)) throw new Error('Sessiya tugagan.');
  var nom = String((m || {}).nom || '');
  if (!/^[\w.\-]+\.pdf$/.test(nom)) throw new Error('Isbot fayli nomi noto\'g\'ri.');
  var papka = papka_(TOP_ISBOT_PAPKA);
  var bor = papka.getFilesByName(nom); if (bor.hasNext()) return { id: bor.next().getId(), bor: true };
  return { id: papka.createFile(Utilities.newBlob(Utilities.base64Decode(String(m.b64 || '')), 'application/pdf', nom)).getId() };
}
