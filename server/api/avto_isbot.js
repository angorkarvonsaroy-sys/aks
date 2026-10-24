// AKS TIZIM — 🤖 ISBOTLARNI AVTOMATIK QABUL QILISH (direktor qarori 24.10.2026).
// Yurist tekshiradigan isbotlar endi odamni kutmaydi: isbot yuklanib fayli joyiga tushgan zahoti serverning o'zi
// yurist o'rniga ✅ bosadi — api/tasdiq_qaror.js `qaror` (yurist ✅ bosgandagi yozuvlarning AYNAN o'zi):
//   · shartnoma skan / hujjat topshiriqlari — «Bajarildi … (tasdiq: Tizim — avto qabul)»;
//   · xat yetkazish isbotlari — 06e X «Tasdiqlandi|vaqt|Tizim — avto qabul»;
//   · har qaror 06t jurnalga yoziladi (Kim: «Tizim — avto qabul») — keyin tanlab tekshirish uchun iz qoladi.
// Yangi shartnoma skanlarining ixtiyoriy nazorati (skan_naz) ham yuborilmaydi (lib/tg_ishlar.js o'zi o'tkazib yuboradi).
// DIREKTOR tekshiradigan isbotlar (oddiy topshiriq «Bajardim», talabnoma, «olib keldi»…) va boshqa tasdiqlar
// (bekor qilish, ta'minot, ruxsat so'rovlari, rezolyutsiya…) — AVVALGIDEK, bu modul ularga tegmaydi.
// Yoqilishi: yozuv_yondi:avto_isbot (aks-avto-isbot yoq) + yozuv_yondi:tasdiq_qaror (qaror serverda bo'lishi shart).
// O'chirilsa — hammasi avvalgidek: isbotlar «Tekshiruvda»da yuristni kutadi.
'use strict';
const { redis } = require('../lib/db');

const FISH = 'Tizim — avto qabul';

async function yoqilgan() {
  try { return (await redis.get('yozuv_yondi:avto_isbot')) === '1' && await require('./tasdiq_qaror')._ichki.yoqilgan(); }
  catch (e) { return false; }
}
// qaror() uchun soxta foydalanuvchi: huquqi faqat «yurist» — direktor tekshiradigan isbotga yanglishib ham qo'l tegiza olmaydi
// (qaror ichidagi huquq tekshiruvi xato beradi). kod — admin xodimning kirish kodi (kesh tozalash va rad yo'lidagi Koprik uchun).
async function avtoU() {
  const XD = await require('../lib/tg_tasdiq').xodimlar();
  const a = XD.find(z => z.admin);
  return { kod: a ? a.kod : '', fish: FISH, huquq: ['yurist'] };
}
// k — 't<id>' | 'x<raqam>' | 'n<id>'. Muvaffaqiyatda qaror natijasi (+avto), xatoda { ok:false, xato } — hech narsa otilmaydi,
// isbot «Tekshiruvda»da qoladi va ilovadagi tekshiruv ro'yxatida ko'rinadi (hech narsa yo'qolmaydi).
async function qabul(k, ctx) {
  try { const u = await avtoU(); const r = await require('./tasdiq_qaror')._ichki.qaror(u, k, true, '', ctx); return Object.assign({ avto: true }, r); }
  catch (e) { console.error('avto isbot ' + k + ':', e.message); return { ok: false, avto: true, xato: e.message }; }
}

module.exports = { yoqilgan, qabul, avtoU, FISH };
