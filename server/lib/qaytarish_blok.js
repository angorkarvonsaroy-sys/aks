// AKS TIZIM — ↩ pul qaytarilayotgan shartnoma (05r qaror «Ochiq») — sudga / yuristga o'tkazish BLOKLANADI (yurist xulosasi, 06.11.2026).
// Ogohlantirish xatlari va boshqa undiruv choralari davom etadi. Qaror yakunlansa yoki bekor bo'lsa — blok o'zi olinadi.
'use strict';
const V = require('./varaq');
const s = v => String(v == null ? '' : v).trim();
async function ochiqQarorlar() {
  try { return (await V.qatorlar('05r_Qaytarish_qarorlari')).map(z => z.x).filter(r => s(r[0]) && s(r[12]) === 'Ochiq').map(r => ({ no: s(r[1]), fish: s(r[3]), qaytar: Number(r[7]) || 0 })); }
  catch (e) { return []; }
}
async function qaytarilmoqda(no) { return (await ochiqQarorlar()).find(q => q.no === s(no)) || null; }
const SABAB = no => no + ' bo\'yicha mijozga pul qaytarilmoqda (direktor qarori) — bu holatda yuristga / sudga o\'tkazilmaydi. Ogohlantirish xatlari davom etadi.';
module.exports = { ochiqQarorlar, qaytarilmoqda, SABAB };
