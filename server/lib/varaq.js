// AKS TIZIM — ko'zgudagi varaqlarni o'qish (Apps Script'dagi getDisplayValues / getValues o'rni).
// Har qator ikki ko'rinishda: r — katakda ko'ringan matn (getDisplayValues), x — xom qiymat (getValues: raqam, sana seriya raqami).
// Qatorlar xotirada 20 soniya saqlanadi: bir xil varaq ketma-ket so'ralsa bazaga qayta borilmaydi.
'use strict';
const { q } = require('./db');

const KESH_MS = 20000;
const kesh = new Map();   // varaq → { vaqt, qatorlar }

// Varaqning 2-qatordan boshlab hamma qatorlari: [{ n: qator_no, r: [ko'ringan matn…], x: [xom…] }]
async function qatorlar(varaq, kompaniyaId = 1) {
  const k = kompaniyaId + '|' + varaq;
  const bor = kesh.get(k);
  if (bor && Date.now() - bor.vaqt < KESH_MS) return bor.qatorlar;
  const res = await q(`SELECT qator_no, data, korinish FROM kozgu.qatorlar WHERE kompaniya_id = $1 AND varaq = $2 AND qator_no >= 2 ORDER BY qator_no`, [kompaniyaId, varaq]);
  const natija = res.rows.map(row => {
    const x = Array.isArray(row.data) ? row.data : [];
    const r = Array.isArray(row.korinish) ? row.korinish.map(v => v == null ? '' : String(v)) : x.map(matn);   // ko'rinish hali yo'q bo'lsa — xomdan
    while (r.length < x.length) r.push('');
    return { n: row.qator_no, r, x };
  });
  kesh.set(k, { vaqt: Date.now(), qatorlar: natija });
  return natija;
}

// matn, iso, dmy, son, korSana — lib/qiymat.js da (toza funksiyalar, 02.11.2026 ajratildi)
const { matn, iso, dmy, son, korSana } = require('./qiymat');

// Bugun (Toshkent) — "YYYY-MM-DD"
function bugun() {
  const d = new Date(Date.now() + 5 * 3600 * 1000);
  return d.getUTCFullYear() + '-' + String(d.getUTCMonth() + 1).padStart(2, '0') + '-' + String(d.getUTCDate()).padStart(2, '0');
}

function tozala() { kesh.clear(); }

module.exports = { qatorlar, matn, iso, dmy, son, korSana, bugun, tozala };
