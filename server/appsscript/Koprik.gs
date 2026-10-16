// FAYL: Koprik.gs — Apps Script loyihasiga YANGI fayl sifatida qo'shiladi (v1.0). Boshqa fayllar o'zgarmaydi.
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
 * va funksiya xuddi ilovadan chaqirilgandek «kod|tok» bilan bajariladi. pin va tg funksiyalari — kirish kodining o'zi bilan.
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
    const birinchi = /^(pin|tg|sifat)/.test(fn) ? kod : kod + '|' + koprikSessiya_(kod);
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
