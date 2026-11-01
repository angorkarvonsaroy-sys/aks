// AKS TIZIM — katak qiymatini aylantirish (toza funksiyalar: bazaga, Redis'ga ulanmaydi). lib/varaq.js shularni qayta eksport qiladi.
// 02.11.2026: lib/varaq.js dan ajratildi — bin/ vositalari (aks-baza xom) ulanishsiz ishlatishi uchun; korSana qo'shildi.
'use strict';

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
  const d = new Date(Date.UTC(1899, 11, 30) + Math.floor(n + 1e-7) * 86400000);   // kasr qismi — soat; sana yaxlitlanmaydi (20:54 ertangi kunga o'tib ketmasin)
  return d.getUTCFullYear() + '-' + String(d.getUTCMonth() + 1).padStart(2, '0') + '-' + String(d.getUTCDate()).padStart(2, '0');
}
const dmy = v => { const s = iso(v); return s ? s.split('-').reverse().join('.') : ''; };   // "DD.MM.YYYY"
const son = v => Number(String(v == null ? '' : v).replace(/\s/g, '').replace(',', '.')) || 0;   // Mijoz.gs num bilan bir xil

// Sana formatli katakning xom qiymati → jadvalda ko'ringan matn «DD.MM.YYYY». Sana emas (bo'sh, matn) — o'zi matn holida.
// (Ko'ringan matndan o'qish o'rniga — 3-bosqichga tayyorgarlik: «baza» jadvallarida ko'ringan matn yo'q, faqat qiymat.)
const korSana = v => typeof v === 'number' && v >= 20000 && v <= 80000 ? dmy(v) : matn(v);

module.exports = { matn, iso, dmy, son, korSana };
