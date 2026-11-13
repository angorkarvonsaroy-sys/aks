// AKS TIZIM — ⚠️ KUTILMAGAN DASTUR XATOSI → direktorga Telegram (13.11.2026, direktor qarori).
// 13.11.2026 da «Bugungi ish» undiruvchilarda ochilmay qoldi («Cannot read properties of undefined»), buni xodim aytmaguncha hech kim bilmadi:
// xato faqat jurnalga yozilardi. Endi dastur xatosi (TypeError, ReferenceError, RangeError) chiqsa:
//   • direktorga darhol Telegram — qaysi amal, kim, xato matni va kodning qaysi qatori;
//   • xodimga inglizcha matn emas, tushunarli xabar (MATN).
// Shovqin bo'lmasligi uchun: bir xil xato soatiga 1 marta; jami soatiga ko'pi bilan 12 ta xabar. Oddiy rad javoblari (S.Xato — «ruxsat yo'q»,
// «summa noto'g'ri» va h.k.) va tarmoq/Google xatolari bu yerga kirmaydi.
'use strict';
const crypto = require('crypto');
const path = require('path');
const TUR = ['TypeError', 'ReferenceError', 'RangeError'];
// tarmoq uzilishi ham TypeError bo'lib keladi («fetch failed», sababi e.cause da) — bu dastur xatosi emas, Google/internet javob bermadi xolos
const TARMOQ = /fetch failed|terminated|network|socket|ECONN|ETIMEDOUT|EAI_AGAIN|ENOTFOUND|aborted/i;
const MATN = 'Dasturda nosozlik chiqdi. Direktorga xabar yuborildi — birozdan keyin qayta urinib ko\'ring.';
const SOAT_MAX = 12;
const esc = v => String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const dasturmi = e => !!e && TUR.indexOf(e.name) >= 0 && !e.cause && !TARMOQ.test(String(e.message || ''));
const ILDIZ = path.join(__dirname, '..');
function joy(e) {
  const q = String((e && e.stack) || '').split('\n').slice(1).find(z => z.indexOf(ILDIZ) >= 0 && z.indexOf('node_modules') < 0) || '';
  const m = /\(?([^()\s]+):(\d+):\d+\)?\s*$/.exec(q.trim()); return m ? path.relative(ILDIZ, m[1]) + ':' + m[2] : '';
}
function hozir() { const t = new Date(Date.now() + 5 * 3600 * 1000), p = n => String(n).padStart(2, '0'); return p(t.getUTCDate()) + '.' + p(t.getUTCMonth() + 1) + ' ' + p(t.getUTCHours()) + ':' + p(t.getUTCMinutes()); }

// yubor(fn, e, kodSes) — hech qachon xato tashlamaydi; qaytaradi: 'yuborildi' | 'takror' | 'chegara' | 'yoq'
async function yubor(fn, e, kodSes, dep) {
  try {
    dep = dep || {};
    const redis = dep.redis || require('./db').redis, TG = dep.TG || require('./telegram');
    const j = joy(e), xabar = String((e && e.message) || e).slice(0, 300);
    const kalit = 'xato_ogoh:' + crypto.createHash('sha1').update(fn + '|' + (e && e.name) + '|' + xabar.replace(/\d+/g, '#') + '|' + j).digest('hex').slice(0, 16);
    const n = await redis.incr(kalit + ':n'); if (n === 1) await redis.expire(kalit + ':n', 86400);
    if (!(await redis.set(kalit, '1', 'EX', 3600, 'NX'))) return 'takror';
    const jami = await redis.incr('xato_ogoh:soat'); if (jami === 1) await redis.expire('xato_ogoh:soat', 3600);
    if (jami > SOAT_MAX) return 'chegara';
    if (!TG.bor()) return 'yoq';
    let kim = '';
    try { const S = dep.S || require('../api/sessiya'); const u = await S.foydalanuvchi(kodSes); if (u) kim = u.fish; } catch (x) { }
    await TG.direktor('⚠️ <b>Dasturda xato chiqdi</b>\nAmal: <b>' + esc(fn) + '</b>' + (kim ? '\nXodim: ' + esc(kim) : '') + '\nXato: ' + esc((e && e.name) + ': ' + xabar)
      + (j ? '\nJoyi: <code>' + esc(j) + '</code>' : '') + '\nVaqt: ' + hozir() + (n > 1 ? '\nBugun ' + n + '-marta' : '')
      + '\n\nXodim ekranida: «' + esc(MATN) + '»\nShu xato takrorlansa, bir soat ichida qayta yozilmaydi.'
      + (jami === SOAT_MAX ? '\n\n❗ Bu soatda ' + SOAT_MAX + ' ta xabar yuborildi — keyingilari soat tugaguncha yuborilmaydi.' : ''));
    return 'yuborildi';
  } catch (x) { console.error('xato_ogoh:', x && x.message); return 'yoq'; }
}
module.exports = { yubor, dasturmi, joy, MATN, TUR, SOAT_MAX };
