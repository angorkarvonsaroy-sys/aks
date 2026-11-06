'use strict';
// ↩ KO-2 xaritasi (06.11.2026) — naqd to'lovning puli qaysi KO-2 bilan qaysi mijozga qaytarilganini ko'rsatish uchun.
// Manba: 05q_Qaytarishlar (ko'zgu). Bekor qilingan KO-2 lar kirmaydi.
//   manba[tid]      — shu to'lov pulidan berilgan KO-2 lar: [{ raqam, sana, no, fish, summa, olindi, holati }]
//   shartnoma[no]   — shu shartnoma bo'yicha mijozga qaytarilgan KO-2 lar
const V = require('./varaq');
const s = v => String(v == null ? '' : v).trim();
const son = v => Math.round(Number(String(v == null ? '' : v).replace(/[^\d.-]/g, '')) || 0);
const dmy = iso => iso ? iso.slice(8, 10) + '.' + iso.slice(5, 7) + '.' + iso.slice(0, 4) : '';

async function ko2Xarita() {
  const manba = {}, shartnoma = {};
  let R = [];
  try { R = await V.qatorlar('05q_Qaytarishlar'); } catch (e) { return { manba, shartnoma }; }   // varaq hali yo'q
  R.forEach(({ x }) => {
    if (!s(x[0]) || s(x[13]) === 'Bekor') return;
    const k = { raqam: s(x[1]), sana: dmy(V.iso(x[2])), no: s(x[4]), fish: s(x[8]) || s(x[5]), summa: son(x[6]),
      holati: s(x[13]) === 'Faol' && s(x[16]) ? 'Faol' : 'Skan kutilmoqda' };
    s(x[7]).split(';').forEach(p => { const m = /^\s*T?(\d+)\s*:\s*(\d+)/.exec(p); if (m) (manba[m[1]] = manba[m[1]] || []).push(Object.assign({ olindi: +m[2] }, k)); });
    (shartnoma[k.no] = shartnoma[k.no] || []).push(k);
  });
  return { manba, shartnoma };
}

module.exports = { ko2Xarita };
