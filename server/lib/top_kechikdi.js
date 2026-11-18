// AKS TIZIM — ⏰ MUDDATI O'TGAN TOPSHIRIQ → DIREKTORGA DARHOL XABAR (18.11.2026, direktor qarori).
// Avval direktor topshiriq kechikkanini faqat kechqurun 20:10 dagi umumiy xabardan (top_kechki) bilardi, u ham sonini aytardi,
// qaysi topshiriq ekanini emas. Endi: har 30 daqiqada (08:00–21:00) tekshiriladi, muddati YANGI o'tgan topshiriqlar nomi bilan yuboriladi.
// Takror yo'q: bir marta xabar berilgan ID Redis to'plamida (TKL) qoladi.
// BIRINCHI ISHGA TUSHISH: o'sha paytda muddati o'tgan hamma topshiriq «xabar berilgan» deb belgilanadi va faqat SONI yoziladi —
// aks holda birinchi xabarda o'nlab eski topshiriq bir yo'la tushib ketardi. Keyingilari birma-bir keladi.
// opt.quruq — yubormaydi va Redis'ga yozmaydi, faqat matnni qaytaradi (aks-vaqt sinov top_kechikdi).
'use strict';
const J = require('./jurnallar');
const { redis } = require('./db');

const KALIT = 'top_kechikdi:xabar';   // Redis SET — xabar berilgan topshiriq ID lari
const KOP = 12;                        // bitta xabarda ko'rsatiladigan eng ko'p topshiriq
const SOAT_BOSH = 8, SOAT_OXIR = 21;   // Toshkent vaqti bilan ish oralig'i
const s = v => String(v == null ? '' : v).trim();
const esc = v => s(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const toshkent = () => new Date(Date.now() + 5 * 3600 * 1000);
function dmyHm(d) { const p = n => String(n).padStart(2, '0');
  return p(d.getUTCDate()) + '.' + p(d.getUTCMonth() + 1) + '.' + d.getUTCFullYear() + ' ' + p(d.getUTCHours()) + ':' + p(d.getUTCMinutes()); }

// R — topshiriq qatorlari (topKor bilan boyitilgan); qaytaradi muddati o'tgan, hali ochiq topshiriqlar
function kechikkanlar(R) {
  return R.filter(t => t.holati === 'Jarayonda' && t.kechikkan && s(t.id))
    .map(t => ({ id: s(t.id), kimga: s(t.kimga) || 'mas\'ul yo\'q', sarlavha: s(t.sarlavha), no: s(t.no), muddat: s(t.muddat), qoida: s(t.qoida), muhim: s(t.muhim) }));
}
function matn(Y, vaqt, jami) {
  const X = {}; Y.forEach(t => { (X[t.kimga] = X[t.kimga] || []).push(t); });
  const K = Object.keys(X).sort((a, b) => X[b].length - X[a].length);
  const M = ['⏰ <b>Topshiriq muddati o\'tdi</b> — ' + vaqt, 'Yangi kechikkani: <b>' + Y.length + '</b> ta' + (jami ? ' · jami ochiq kechikkan: <b>' + jami + '</b> ta' : ''), ''];
  let n = 0;
  K.forEach(k => {
    if (n >= KOP) return;
    M.push('👤 <b>' + esc(k) + '</b> — ' + X[k].length + ' ta');
    X[k].slice(0, Math.max(1, KOP - n)).forEach(t => { n++;
      M.push('   • ' + (t.no ? '<b>' + esc(t.no) + '</b> · ' : '') + esc(t.sarlavha) + (t.muhim === 'Shoshilinch' ? ' 🔴' : '') + ' — muddat ' + esc(t.muddat)); });
    if (X[k].length > KOP) M.push('   … va yana ' + (X[k].length - KOP) + ' ta');
    M.push('');
  });
  if (Y.length > n) M.push('… va yana ' + (Y.length - n) + ' ta — ro\'yxat ilovada: 📌 Topshiriqlar → «Muddati o\'tgan».');
  else M.push('Ro\'yxat: ilovada 📌 Topshiriqlar → «Muddati o\'tgan».');
  return M.join('\n');
}

async function tekshir(kod, opt = {}) {
  const t = toshkent(), soat = t.getUTCHours();
  if (!opt.quruq && (soat < SOAT_BOSH || soat >= SOAT_OXIR)) return { yuborilmadi: 'ish vaqti emas (' + soat + ':00)' };
  const TP = require('../api/topshiriq_yoz')._ichki;
  const R = (await TP.topRowsYangi(TP.TOP_V)).L.map(J.topKor);
  const K = kechikkanlar(R);
  if (!K.length) return { yuborilmadi: 'muddati o\'tgan ochiq topshiriq yo\'q' };
  let bor = [];
  try { bor = (await redis.smembers(KALIT)) || []; } catch (e) { console.error('top_kechikdi (redis):', e.message); return { yuborilmadi: 'redis o\'qilmadi' }; }
  const B = new Set(bor.map(String));
  const Y = K.filter(t => !B.has(t.id));
  if (!Y.length) return { yuborilmadi: 'yangi kechikkan topshiriq yo\'q', jami: K.length };
  // birinchi ishga tushish — hammasini belgilaymiz, ro'yxat emas, faqat soni
  const birinchi = !B.size;
  const vaqt = dmyHm(t);
  const m = birinchi
    ? '⏰ <b>Topshiriq muddati nazorati yoqildi</b> — ' + vaqt + '\nHozir muddati o\'tgan ochiq topshiriqlar: <b>' + K.length + '</b> ta.'
      + '\nRo\'yxat ilovada: 📌 Topshiriqlar → «Muddati o\'tgan».\nBundan keyin muddati o\'tgan har bir topshiriq nomi bilan shu yerga keladi.'
    : matn(Y, vaqt, K.length);
  if (opt.quruq) return { quruq: true, birinchi, yangi: Y.length, jami: K.length, xabarlar: [{ kimga: 'direktor', matn: m }] };
  await require('./telegram').direktor(m);
  try { await redis.sadd(KALIT, ...Y.map(t => t.id)); } catch (e) { console.error('top_kechikdi (sadd):', e.message); }
  return { yuborildi: 1, birinchi, yangi: Y.length, jami: K.length };
}

module.exports = { tekshir, _ichki: { kechikkanlar, matn, KALIT, KOP } };
