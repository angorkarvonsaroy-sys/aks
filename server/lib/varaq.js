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

// Xom katak → matn (ko'rinish bo'lmaganda). Raqamlar: 123.0 → "123"; bo'sh → "".
function matn(v) {
  if (v === null || v === undefined) return '';
  if (typeof v === 'number') return Number.isInteger(v) ? String(v) : String(v);
  if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
  return String(v);
}

// Xom sana (seriya raqami) → "YYYY-MM-DD" (Apps Script: Utilities.formatDate(d, TZ, 'yyyy-MM-dd')). Sana bo'lmasa — ''.
function iso(v) {
  if (v === '' || v === null || v === undefined) return '';
  if (typeof v === 'string') { const m = /^(\d{2})\.(\d{2})\.(\d{4})/.exec(v); return m ? m[3] + '-' + m[2] + '-' + m[1] : (/^\d{4}-\d{2}-\d{2}/.test(v) ? v.slice(0, 10) : ''); }
  const n = Number(v);
  if (!isFinite(n) || n < 20000 || n > 80000) return '';
  const d = new Date(Date.UTC(1899, 11, 30) + Math.round(n) * 86400000);
  return d.getUTCFullYear() + '-' + String(d.getUTCMonth() + 1).padStart(2, '0') + '-' + String(d.getUTCDate()).padStart(2, '0');
}
const dmy = v => { const s = iso(v); return s ? s.split('-').reverse().join('.') : ''; };   // "DD.MM.YYYY"
const son = v => Number(String(v == null ? '' : v).replace(/\s/g, '').replace(',', '.')) || 0;   // Mijoz.gs num bilan bir xil

// Bugun (Toshkent) — "YYYY-MM-DD"
function bugun() {
  const d = new Date(Date.now() + 5 * 3600 * 1000);
  return d.getUTCFullYear() + '-' + String(d.getUTCMonth() + 1).padStart(2, '0') + '-' + String(d.getUTCDate()).padStart(2, '0');
}

function tozala() { kesh.clear(); }

module.exports = { qatorlar, matn, iso, dmy, son, bugun, tozala };
