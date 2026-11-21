// AKS TIZIM — 📮 ESKI KIRIM XATNI QO'LDA YAKUNLASH (BIR MARTALIK QOIDA, direktor qarori 21.11.2026).
// Sabab: kotiba ancha oldin kelgan (1–8 oylik) xatlarni ham devonxonaga kirim qilgan va ularga rezolyutsiya qo'yilgan.
//   Bu xatlarning javobi o'z vaqtida qog'ozda berilgan — ijrochida hozir na skan, na pochta kvitansiyasi bor,
//   shuning uchun u ularni tizimda umuman yopa olmaydi (har uch yo'lda ham fayl majburiy — api/devon_yoz.js ijroTopshirYadro).
// Qoida: xat sanasi KUN (10) kundan eski VA xat devonxonaga OXIR (21.11.2026) sanasigacha kirim qilingan bo'lsa —
//   asosiy ijrochi javobni qo'lda yozib, fayl va isbotsiz yakunlaydi; xat darhol «Ijro etildi» bo'ladi, direktor tasdig'i kerak emas.
// OXIR dan keyin kirim qilinadigan xatlarda — avvalgidek tartib (skan, javob xati, yuborilganlik isboti).
'use strict';
const KUN = 10, OXIR = '2026-11-21';
const iso = v => { const m = /^(\d{2})\.(\d{2})\.(\d{4})/.exec(String(v == null ? '' : v).trim()); return m ? m[3] + '-' + m[2] + '-' + m[1] : ''; };
function qolda(x, bugunIso) {
  if (!x || x.turi !== 'Kirim' || x.holati !== 'Ijroda') return false;
  const kir = iso(x.kiritildi); if (!kir || kir > OXIR) return false;
  const xs = iso(x.sana); if (!xs) return false;
  const a = Date.parse(xs + 'T00:00:00Z'), b = Date.parse(String(bugunIso) + 'T00:00:00Z');
  return !isNaN(a) && !isNaN(b) && (b - a) / 86400000 >= KUN;
}
module.exports = { qolda, iso, KUN, OXIR };
