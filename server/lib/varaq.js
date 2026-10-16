// AKS TIZIM — ko'zgudagi varaqlarni o'qish (Apps Script'dagi getDisplayValues/getValues o'rni).
// Qatorlar xotirada 20 soniya saqlanadi: bir xil varaq ketma-ket so'ralsa bazaga qayta borilmaydi.
'use strict';
const { q } = require('./db');

const KESH_MS = 20000;
const kesh = new Map();   // varaq → { vaqt, qatorlar }

// Varaqning 2-qatordan boshlab hamma qatorlari: [{ n: qator_no, r: [ustunlar…] }]. Hamma katak matnga aylantiriladi (eski tizimdagidek).
async function qatorlar(varaq, kompaniyaId = 1) {
  const k = kompaniyaId + '|' + varaq;
  const bor = kesh.get(k);
  if (bor && Date.now() - bor.vaqt < KESH_MS) return bor.qatorlar;
  const r = await q(`SELECT qator_no, data FROM kozgu.qatorlar WHERE kompaniya_id = $1 AND varaq = $2 AND qator_no >= 2 ORDER BY qator_no`, [kompaniyaId, varaq]);
  const natija = r.rows.map(x => ({ n: x.qator_no, r: (Array.isArray(x.data) ? x.data : []).map(matn) }));
  kesh.set(k, { vaqt: Date.now(), qatorlar: natija });
  return natija;
}

// Katak qiymati → matn. Raqamlar: 123.0 → "123"; bo'sh → "".
function matn(v) {
  if (v === null || v === undefined) return '';
  if (typeof v === 'number') return Number.isInteger(v) ? String(v) : String(v).replace(/\.0+$/, '');
  if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
  return String(v);
}

// Sheets'dagi sana seriya raqami (SERIAL_NUMBER) → "DD.MM.YYYY"; matn bo'lsa o'zi qaytadi
function sana(v) {
  if (v === '' || v === null || v === undefined) return '';
  const n = Number(v);
  if (!isFinite(n) || n < 20000 || n > 80000) return String(v);
  const d = new Date(Date.UTC(1899, 11, 30) + Math.round(n) * 86400000);
  return String(d.getUTCDate()).padStart(2, '0') + '.' + String(d.getUTCMonth() + 1).padStart(2, '0') + '.' + d.getUTCFullYear();
}

const son = v => Number(String(v == null ? '' : v).replace(/\s/g, '').replace(',', '.')) || 0;

module.exports = { qatorlar, matn, sana, son };
