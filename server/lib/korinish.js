// AKS TIZIM — shartnoma HOLATI bo'yicha ko'rinish (direktor qarori, 18.10.2026):
//   Aktiv, Kredit asosida, Yakunlangan          — hamma xodim (o'z bo'limi doirasida)
//   Bekor qilindi                               — direktor + «bekor_korish» huquqi
//   Noqonuniy hududda                           — direktor + «yurist» yoki «noqonuniy_korish» huquqi
//   Passiv, Kutilmoqda, Shartnoma olmagan, boshqa — faqat direktor
//   ISTISNO: undiruvchi o'ziga biriktirilgan (03 R «Undiruvchi») shartnomani holatidan qat'i nazar ko'radi (direktor qarori 18.10 02:45)
// Yoqilishi: Redis «korinish_yondi» = 1 (aks-korinish yoq). O'chiq bo'lsa — hamma narsa avvalgidek ko'rinadi.
// Yashirin shartnoma: ro'yxatlarda yo'q, raqami bilan ochilmaydi, unga bog'liq to'lov/hujjat/xat ham ko'rinmaydi.
// Jami summalar (hisobot tushumi va h.k.) o'zgarmaydi — faqat shartnomani ko'rsatadigan qatorlar yashiriladi.
'use strict';
const V = require('./varaq');
const { redis } = require('./db');
const { xodimTeng } = require('./xodim');

const HAMMA = new Set(['Aktiv', 'Kredit asosida', 'Yakunlangan']);
function korinadi(u, holati, undiruvchi) {
  if (!u || u.admin) return true;
  const h = String(holati == null ? '' : holati).trim(), H = u.huquq || [];
  if (undiruvchi && u.fish && xodimTeng(String(undiruvchi), u.fish)) return true;   // o'z portfeli
  if (HAMMA.has(h)) return true;
  if (h === 'Bekor qilindi') return H.includes('bekor_korish');
  if (h === 'Noqonuniy hududda') return H.includes('yurist') || H.includes('noqonuniy_korish');
  return false;
}
async function yoqilgan() { try { return (await redis.get('korinish_yondi')) === '1'; } catch (e) { return false; } }
// (holati, undiruvchi) => bool — o'chiq bo'lsa yoki direktor bo'lsa hammasi ko'rinadi
async function korish(u) { if (!u || u.admin || !(await yoqilgan())) return () => true; return (h, und) => korinadi(u, h, und); }
// Shu xodimdan yashiriladigan shartnoma raqamlari (03 + 04)
async function yopiqlar(u) {
  const k = await korish(u); const Y = new Set();
  if (!u || u.admin || !(await yoqilgan())) return Y;
  (await V.qatorlar('03_Sotuv_shartnomalar')).forEach(({ r }) => { const no = String(r[0] == null ? '' : r[0]).trim(); if (no && !k(r[13], r[17])) Y.add(no); });
  (await V.qatorlar('04_Ijara_shartnomalar')).forEach(({ r }) => { const no = String(r[0] == null ? '' : r[0]).trim(); if (no && !k(r[2])) Y.add(no); });
  return Y;
}

module.exports = { korinadi, korish, yopiqlar, yoqilgan, HAMMA };
