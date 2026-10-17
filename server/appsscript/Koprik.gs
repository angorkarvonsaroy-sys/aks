// FAYL: Koprik.gs — Apps Script loyihasidagi «Koprik» fayli (v1.4). Boshqa fayllar o'zgarmaydi.
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
function koprikVersiya(kod) { return '1.4'; }
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
