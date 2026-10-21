// FAYL: Koprik.gs — Apps Script loyihasidagi «Koprik» fayli (v1.13). Boshqa fayllar o'zgarmaydi.
// v1.13: koprikKbSaqla — imzolangan kelishuv SKANI ni ham qabul qiladi ({ yil, skanNom, skanB64 } → { skan }): kbSkan serverda, fayl «Kelishuv / <yil>» ga shu orqali.
// v1.12: koprikDevonSaqla — kirim xat skanini «AKS TIZIM / 08 DEVONXONA / Kirim / <yil>» ga (Devon.gs devonFaylSaqla_ ning o'zi; 11_Devonxona ni server yozadi);
//        koprikDevonTg — direktor(lar)ga shaxsan Telegram, skan PDF + tugma (devonDirShaxsiy_ ning o'zi; natija matni serverga qaytadi — tarixga va kotibaga);
//        koprikKbSaqla — server yasagan kelishuv + dalolatnoma (PDF va Word) ni «AKS TIZIM / 07 BEKOR QILISH / Kelishuv / <yil>» ga (06m ni server yozadi);
//        koprikSkanNaz — yangi shartnoma skanlarining ixtiyoriy nazorati (Topshiriq.gs skanNazTekshir_: belgi 06d ga, yuristga Telegram) — server topHozir dan chaqiradi.
// v1.11: koprikXatSaqla Word (.docx) faylini ham qabul qiladi va fayl nomida lotin bo'lmagan harflar (', `, kirill) bo'lishi mumkin —
//        yurist ALOQA XATI (YU seriyasi) serverda yasaladi, PDF va Word nusxasi shu yerdan «AKS TIZIM / 06 XATLAR / <yil>» ga qo'yiladi.
// v1.10: koprikBekorSaqla Word (.docx) faylini ham qabul qiladi (bDocB64, xDocB64) — server yasagan Word Drive'ga o'zi qo'yiladi,
//        eski tizim Google Doc yasamaydi (tezroq). Word kelmasa — avvalgidek (v1.9).
// v1.9: koprikBekorSaqla — server yasagan shartnomani bekor qilish BUYRUG'I va XABARNOMASI (PDF) ni «AKS TIZIM / 07 BEKOR QILISH / <yil>» ga qo'yish;
//       «Word» tugmasi uchun Google Doc nusxasini Bekor.gs ning o'z funksiyalari (bekorBuyruq_, bekorXabarnoma_) shu ma'lumotdan yasaydi
//       (ular yasagan PDF savatga — PDF serverniki). Qayta yasalganda eski fayllar savatga. 06h ni server o'zi yozadi.
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
function koprikVersiya(kod) { return '1.13'; }
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
    if (yil.length !== 4 || nom.length > 180 || !/^[^\/\\]+\.(pdf|docx)$/.test(nom)) throw new Error('Xat fayli nomi noto\'g\'ri.');
    var mime = /\.docx$/.test(nom) ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' : 'application/pdf';
    var papka = papka_(['AKS TIZIM', '06 XATLAR', yil]);
    if (!m.eski) { var bor = papka.getFilesByName(nom); if (bor.hasNext()) f = bor.next(); }
    if (!f) f = papka.createFile(Utilities.newBlob(Utilities.base64Decode(String(m.b64)), mime, nom));
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
// v1.9: shartnomani bekor qilish hujjatlari → «AKS TIZIM / 07 BEKOR QILISH / <yil>» (bekorHujjatYasa_ papkasi va nomlari).
//   m = { yil, bNom, xNom, bB64, xB64, [bDocB64, xDocB64 — v1.10], x, X, P, raqam, xRaqam, sana, fish, eski }. bB64 bo'lsa: ikkala PDF qo'yiladi va Google Doc nusxalari yasaladi
//   (qayta urinishda shu nomli fayl bor bo'lsa — o'shasi qaytadi, ikkinchi nusxa bo'lmaydi). eski — almashtirilgan fayllar (Drive ID), faqat
//   «07 BEKOR QILISH» ichidagilari savatga. Qaytaradi { bPdf, bDoc, xPdf, xDoc } (faqat eski bo'lsa — { ok }).
function koprikBekorSaqla(kod, m) {
  bekorKirish_(kod);
  m = m || {};
  var eski = (m.eski || []).map(String), r = { ok: true };
  if (m.bB64) {
    var yil = String(m.yil || '').replace(/\D/g, '').slice(0, 4);
    var nomOk = function (n) { return /^Bekor_(buyruq|xabarnoma)_[^\/\\]{3,160}$/.test(String(n || '')); };
    if (yil.length !== 4 || !nomOk(m.bNom) || !nomOk(m.xNom) || !m.xB64) throw new Error('Bekor hujjati nomi noto\'g\'ri.');
    var ss = SpreadsheetApp.openById(SS_ID), papka = papka_(BEKOR_PAPKA.concat([yil]));
    var top = function (nom, mime) { var it = papka.getFilesByName(nom); while (it.hasNext()) { var f = it.next(); if (eski.indexOf(f.getId()) < 0 && !f.isTrashed() && f.getMimeType() === mime) return f; } return null; };
    var pdf = function (nom, b64) { return top(nom + '.pdf', 'application/pdf') || papka.createFile(Utilities.newBlob(Utilities.base64Decode(String(b64)), 'application/pdf', nom + '.pdf')); };
    var DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    var doc = function (nom, yasa, b64) {
      if (b64) return (top(nom + '.docx', DOCX) || papka.createFile(Utilities.newBlob(Utilities.base64Decode(String(b64)), DOCX, nom + '.docx'))).getId();   // v1.10
      var f = top(nom, MimeType.GOOGLE_DOCS); if (f) return f.getId(); var h = yasa(); try { DriveApp.getFileById(h.pdfId).setTrashed(true); } catch (e) { } return h.docId; };
    var bp = pdf(m.bNom, m.bB64), xp = pdf(m.xNom, m.xB64);
    var bDoc = doc(m.bNom, function () { return bekorBuyruq_(papka, m.bNom, m.x, m.X, m.P, m.raqam, m.sana); }, m.bDocB64);
    var xDoc = doc(m.xNom, function () { return bekorXabarnoma_(ss, papka, m.xNom, m.x, m.X, m.P, m.raqam, m.xRaqam, m.sana, { fish: String(m.fish || '') }); }, m.xDocB64);
    r = { bPdf: bp.getId(), bDoc: bDoc, xPdf: xp.getId(), xDoc: xDoc };
  }
  eski.forEach(function (id) {
    try { var e = DriveApp.getFileById(id), p = e.getParents(), ota = p.hasNext() ? p.next().getParents() : null;
      if (ota && ota.hasNext() && ota.next().getName() === BEKOR_PAPKA[BEKOR_PAPKA.length - 1]) e.setTrashed(true); } catch (x) { }
  });
  return r;
}
// v1.12: kirim xat skani → «AKS TIZIM / 08 DEVONXONA / <qism> / <yil>» (Devon.gs devonFaylSaqla_ ning o'zi). m = { qism: 'Kirim', nom (kengaytmasiz), b64 }.
//   Qaytaradi { id }. m.eski (Drive ID) bo'lsa — o'sha fayl savatga, faqat «08 DEVONXONA» ichidagi bo'lsa (server qatorni yoza olmaganda). Qaytaradi { ok }.
function koprikDevonSaqla(kod, m) {
  ruxsat_(kod, 'devon');
  m = m || {};
  if (m.eski) {
    try { var e = DriveApp.getFileById(String(m.eski)), p = e.getParents(), ota = p.hasNext() ? p.next().getParents() : null, bobo = ota && ota.hasNext() ? ota.next().getParents() : null;
      if (bobo && bobo.hasNext() && bobo.next().getName() === '08 DEVONXONA') e.setTrashed(true); } catch (x) { }
    return { ok: true };
  }
  var qism = String(m.qism || ''), nom = String(m.nom || '');
  if (!/^(Kirim|Chiqim|Ijro)$/.test(qism) || !nom || nom.length > 200 || /[\/\\]/.test(nom)) throw new Error('Devon fayli nomi noto\'g\'ri.');
  var bayt = Utilities.base64Decode(String(m.b64 || ''));
  if (bayt.length < 1000) throw new Error('Xat skani bo\'sh.');
  return { id: devonFaylSaqla_(bayt, [qism], nom).getId() };
}
// v1.12: direktor(lar)ga shaxsan Telegram — skan PDF + tugma (Devon.gs devonDirShaxsiy_ ning o'zi). m = { matn, faylId, tugma }. Qaytaradi { xato: '' | sabab }.
function koprikDevonTg(kod, m) {
  ruxsat_(kod, 'devon');
  m = m || {};
  return { xato: devonDirShaxsiy_(SpreadsheetApp.openById(SS_ID), String(m.matn || ''), String(m.faylId || ''), String(m.tugma || '')) };
}
// v1.12: server yasagan kelishuv + dalolatnoma → «AKS TIZIM / 07 BEKOR QILISH / Kelishuv / <yil>» (KelishuvBekor.gs kbHujjat_ papkasi va nomlari).
//   m = { yil, nom (kengaytmasiz), pdfB64, docB64, eski }. pdfB64 bo'lsa: PDF va Word qo'yiladi (qayta urinishda shu nomli fayl bor bo'lsa — o'shasi qaytadi);
//   eski — almashtirilgan fayllar (Drive ID), faqat «Kelishuv» ichidagilari savatga (kbOchir_). Qaytaradi { pdf, doc } (faqat eski bo'lsa — { ok }).
//   v1.13: m = { yil, skanNom, skanB64 } — ikkala tomon imzolagan skan (kbSkan nomi «KB-<id>_<no>_imzolangan_<vaqt>.pdf»), qaytaradi { skan }.
function koprikKbSaqla(kod, m) {
  kbU_(kod);
  m = m || {};
  var eski = (m.eski || []).map(String), r = { ok: true };
  if (m.skanB64) {
    var yilS = String(m.yil || '').replace(/\D/g, '').slice(0, 4), nomS = String(m.skanNom || '');
    if (yilS.length !== 4 || !/^KB-\d+_[^\/\\]{3,160}\.pdf$/.test(nomS)) throw new Error('Kelishuv skani nomi noto\'g\'ri.');
    var papkaS = papka_(KB_PAPKA.concat([yilS])), itS = papkaS.getFilesByName(nomS), fS = null;
    while (itS.hasNext()) { var zS = itS.next(); if (!zS.isTrashed() && zS.getMimeType() === 'application/pdf') { fS = zS; break; } }
    if (!fS) fS = papkaS.createFile(Utilities.newBlob(Utilities.base64Decode(String(m.skanB64)), 'application/pdf', nomS));
    return { skan: fS.getId() };
  }
  if (m.pdfB64) {
    var yil = String(m.yil || '').replace(/\D/g, '').slice(0, 4), nom = String(m.nom || '');
    if (yil.length !== 4 || !/^Kelishuv_bekor_[^\/\\]{3,160}$/.test(nom) || !m.docB64) throw new Error('Kelishuv hujjati nomi noto\'g\'ri.');
    var papka = papka_(KB_PAPKA.concat([yil]));
    var DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    var top = function (n, mime) { var it = papka.getFilesByName(n); while (it.hasNext()) { var f = it.next(); if (eski.indexOf(f.getId()) < 0 && !f.isTrashed() && f.getMimeType() === mime) return f; } return null; };
    var pdf = top(nom + '.pdf', 'application/pdf') || papka.createFile(Utilities.newBlob(Utilities.base64Decode(String(m.pdfB64)), 'application/pdf', nom + '.pdf'));
    var doc = top(nom + '.docx', DOCX) || papka.createFile(Utilities.newBlob(Utilities.base64Decode(String(m.docB64)), DOCX, nom + '.docx'));
    r = { pdf: pdf.getId(), doc: doc.getId() };
  }
  eski.forEach(function (id) {
    try { var e = DriveApp.getFileById(id), p = e.getParents(), ota = p.hasNext() ? p.next().getParents() : null;
      if (ota && ota.hasNext() && ota.next().getName() === KB_PAPKA[KB_PAPKA.length - 1]) e.setTrashed(true); } catch (x) { }
  });
  return r;
}
// v1.12: yangi shartnoma skanlarining ixtiyoriy nazorati (Topshiriq.gs skanNazTekshir_: belgi 06d P ga, yurist/direktorga Telegram) — server topHozir dan.
function koprikSkanNaz(kod) {
  ruxsat_(kod, 'admin');
  return { n: skanNazTekshir_(SpreadsheetApp.openById(SS_ID)) };
}
