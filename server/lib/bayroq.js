// AKS TIZIM — yozuv va vaqt bayroqlari (yozuv_yondi:*, vaqt_yondi:*). 02.11.2026 dan STANDART HOLAT KODDA.
// Ilgari bayroq faqat Redis'da edi: kalit yo'qolsa (Redis 512 MB ga yetsa allkeys-lru istalgan kalitni o'chiradi) yoki Redis javob bermasa —
// amal jimgina eski tizimga qaytar, vaqt ishi esa umuman to'xtar edi (eski triggerlar 0 ta).
// Endi: '1' — yoniq, '0' — o'chiq (faqat ataylab: aks-bayroq ochir / aks-yozuv-sinov ochir), kalit yo'q yoki Redis xatosi — STANDART:
//   sinovdan o'tib yoqilgan hamma amal va vaqt ishi — YONIQ; hali yoqilmaganlar (quyidagi ro'yxat) — o'chiq.
'use strict';
const { redis } = require('./db');

const YOZUV_OCHIQ = new Set(['bekor_tasdiq']);   // direktor qarori kutilmoqda: bekor qilishni tasdiqlash hali eski tizimda
const VAQT_OCHIQ = new Set();
// koddagi hamma yozuv bayroqlari (02.11.2026: 49 ta; 48 tasi yoniq — arxiv 02.11 07:15 da sinovdan o'tib yoqildi; bekor_tasdiq — o'chiq). Yangi bayroq qo'shilsa — shu ro'yxatga,
// va sinovdan o'tib yoqilguncha YOZUV_OCHIQ ga ham (aks holda standart holatda darhol yoniq bo'lib qoladi).
const YOZUV_NOMLAR = [
  'arxiv', 'avto_isbot', 'bajardim', 'bekor', 'bekor_tasdiq', 'bekor_word', 'devon', 'devon2', 'devon_kordi', 'devon_xat', 'eksport', 'eksport_pdf',
  'hisobot_pdf', 'hujjat', 'ijro_tekshir', 'imzosiz', 'imzosiz_bekor', 'kb', 'kb2', 'kirish07b', 'mayda', 'mijoz_karta_pdf', 'qadam', 'qadam_hujjat',
  'qadam_ruxsat', 'qayta', 'qayta2', 'qayta_bekor', 'qayta_hujjat', 'shartnoma', 'shartnoma_pdf', 'sifat', 'tahrir', 'taminot', 'tasdiq',
  'tasdiq_qaror', 'tashrif', 'tg', 'tg_kirish', 'tolov', 'top_avto', 'top_mening', 'topshiriq', 'xat_chiqar', 'xat_isbot', 'yurist_aloqa',
  'yurist_hujjat', 'yurist_ish', 'yurist_sorov'];

async function oqi(kalit, standart) {
  let v = null;
  try { v = await redis.get(kalit); } catch (e) { return standart; }
  if (v === '1') return true;
  if (v === '0') return false;
  return standart;
}
const yozuvStandart = nom => !YOZUV_OCHIQ.has(nom);
const vaqtStandart = nom => !VAQT_OCHIQ.has(nom);
const yozuv = nom => oqi('yozuv_yondi:' + nom, yozuvStandart(nom));
const vaqt = nom => oqi('vaqt_yondi:' + nom, vaqtStandart(nom));
// bin buyruqlari uchun: yoqish / o'chirish (o'chirish — '0', kalitni o'chirish emas: o'chirilgan kalit standart holatga qaytadi)
const yoq = (tur, nom) => redis.set(tur + '_yondi:' + nom, '1');
const ochir = (tur, nom) => redis.set(tur + '_yondi:' + nom, '0');

module.exports = { yozuv, vaqt, yoq, ochir, yozuvStandart, vaqtStandart, YOZUV_OCHIQ, VAQT_OCHIQ, YOZUV_NOMLAR };
