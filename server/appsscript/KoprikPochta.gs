// FAYL: KoprikPochta.gs — Apps Script loyihasiga YANGI fayl (Koprik.gs va boshqa fayllarga tegilmaydi). 01.11.2026.
// AKS TIZIM serveridan elektron xat (Gmail) yuborish. Serverspace pochta portlarini (465, 587) yopgan — shuning uchun xatni
// Google'ning o'zi, shu hisob nomidan (MailApp) yuboradi. Tekin, kuniga ~100 ta xat.
// Server chaqiradi: koprikPochta(kod, { kimga, mavzu, matn, html }) — faqat direktor kodi bilan (ruxsat_ … 'admin').
//
// O'rnatish (bir marta):
//  1. Apps Script → «+» → Скрипт → nomi: KoprikPochta → shu faylni to'liq qo'ying → 💾 Сохранить.
//  2. Yuqoridagi funksiyalar ro'yxatidan «koprikPochtaRuxsat» ni tanlang → ▶ Выполнить → Google ruxsat so'raydi → Разрешить.
//  3. Развернуть → Управление развертываниями → ✏️ → Версия: «Новая версия» → Развернуть.
function koprikPochta(kod, m) {
  ruxsat_(kod, 'admin'); m = m || {};
  var kimga = String(m.kimga || '').trim();
  if (!/^[^\s@<>()",;:]+@[^\s@<>()",;:]+\.[A-Za-z]{2,}$/.test(kimga)) throw new Error('Pochta manzili noto\'g\'ri.');
  var o = { to: kimga, subject: String(m.mavzu || 'AKS TIZIM').slice(0, 200), body: String(m.matn || ''), name: 'AKS TIZIM' };
  if (m.html) o.htmlBody = String(m.html);
  MailApp.sendEmail(o);
  return { ok: true, qoldi: MailApp.getRemainingDailyQuota() };
}
// Bir martalik: Google'dan «xat yuborish» ruxsatini olish uchun muharrirda ▶ bilan ishga tushiriladi.
function koprikPochtaRuxsat() {
  Logger.log('✅ Ruxsat bor. Bugun yana ' + MailApp.getRemainingDailyQuota() + ' ta xat yuborish mumkin.');
}
