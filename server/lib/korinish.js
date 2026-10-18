// AKS TIZIM — shartnoma HOLATI bo'yicha ko'rinish (direktor qarori, 18.10.2026 03:00):
//   Direktor                       — hammasi
//   «undiruv» huquqi bor xodim     — FAQAT o'ziga biriktirilgan (03 R «Undiruvchi») shartnomalar, holatidan qat'i nazar
//   «yurist» huquqi bor xodim      — FAQAT yuristga o'tkazilgan (06b, holati «Rad etildi» / «Tasdiq kutilmoqda» emas) shartnomalar, holatidan qat'i nazar
//   Boshqa xodimlar                — Aktiv, Kredit asosida, Yakunlangan, Noqonuniy hududda, Shartnoma olmagan;
//                                    Bekor qilindi — faqat «bekor_korish» huquqi bilan; Passiv, Kutilmoqda va boshqalar — hech qachon
// Undiruvchi va yurist shartnomasi yo'q mijozni ham ko'rmaydi (mijoz qidiruvi / kartasi).
// Yoqilishi: Redis «korinish_yondi» = 1 (aks-korinish yoq). O'chiq bo'lsa — hamma narsa avvalgidek ko'rinadi.
// Yashirin shartnoma: ro'yxatlarda yo'q, raqami bilan ochilmaydi, unga bog'liq to'lov/hujjat/xat ham ko'rinmaydi.
// Jami summalar (hisobot tushumi va h.k.) o'zgarmaydi — faqat shartnomani ko'rsatadigan qatorlar yashiriladi.
// 2-bosqich (18.10.2026): hujjatlar, xatlar, yangi shartnoma (mijozlar / do'kon egasi), tashrif — direktor topshirig'idagi shartnoma istisno.
'use strict';
const V = require('./varaq');
const { redis } = require('./db');
const { xodimTeng } = require('./xodim');

const HAMMA = new Set(['Aktiv', 'Kredit asosida', 'Yakunlangan', 'Noqonuniy hududda', 'Shartnoma olmagan']);
const tur = u => { const H = (u && u.huquq) || []; return !u || u.admin ? 'admin' : H.includes('undiruv') ? 'undiruv' : H.includes('yurist') ? 'yurist' : 'oddiy'; };
// yuristda — shu shartnoma yuristga o'tkazilganmi (faqat «yurist» uchun kerak)
function korinadi(u, holati, undiruvchi, yuristda) {
  const t = tur(u);
  if (t === 'admin') return true;
  if (t === 'undiruv') return !!(undiruvchi && u.fish && xodimTeng(String(undiruvchi), u.fish));
  if (t === 'yurist') return !!yuristda;
  const h = String(holati == null ? '' : holati).trim();
  if (HAMMA.has(h)) return true;
  if (h === 'Bekor qilindi') return (u.huquq || []).includes('bekor_korish');
  return false;
}
async function yuristSet() {
  const S = new Set();
  (await require('./jurnallar').yuIshlar()).forEach(i => { if (i.holati !== 'Rad etildi' && i.holati !== 'Tasdiq kutilmoqda') S.add(String(i.no).trim()); });
  return S;
}
async function yoqilgan() { try { return (await redis.get('korinish_yondi')) === '1'; } catch (e) { return false; } }
// (holati, undiruvchi, no) => bool; .cheklangan — undiruvchi/yurist (shartnomasiz mijozni ham ko'rmaydi)
async function korish(u) {
  if (!u || u.admin || !(await yoqilgan())) { const f = () => true; f.cheklangan = false; return f; }
  const t = tur(u), YU = t === 'yurist' ? await yuristSet() : null;
  const f = (h, und, no) => korinadi(u, h, und, YU ? YU.has(String(no == null ? '' : no).trim()) : false);
  f.cheklangan = t === 'undiruv' || t === 'yurist';
  return f;
}
// Shu xodimdan yashiriladigan shartnoma raqamlari (03 + 04)
async function yopiqlar(u) {
  const Y = new Set();
  if (!u || u.admin || !(await yoqilgan())) return Y;
  const k = await korish(u);
  (await V.qatorlar('03_Sotuv_shartnomalar')).forEach(({ r }) => { const no = String(r[0] == null ? '' : r[0]).trim(); if (no && !k(r[13], r[17], no)) Y.add(no); });
  (await V.qatorlar('04_Ijara_shartnomalar')).forEach(({ r }) => { const no = String(r[0] == null ? '' : r[0]).trim(); if (no && !k(r[2], '', no)) Y.add(no); });
  return Y;
}

module.exports = { korinadi, korish, yopiqlar, yoqilgan, yuristSet, tur, HAMMA };
