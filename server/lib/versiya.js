// AKS TIZIM — eski tizim ko'prigi (Koprik.gs) versiyasini RAQAM bo'yicha solishtirish: '1.10' > '1.9' (matn bo'yicha solishtirsa '1.10' < '1.5' chiqadi).
'use strict';
const son = v => String(v == null ? '' : v).split('.').map(n => Number(n) || 0);
function verOk(v, min) {
  if (!/^\d+(\.\d+)*$/.test(String(v == null ? '' : v).trim())) return false;
  const a = son(v), b = son(min);
  for (let i = 0; i < Math.max(a.length, b.length); i++) { if ((a[i] || 0) !== (b[i] || 0)) return (a[i] || 0) > (b[i] || 0); }
  return true;
}
module.exports = { verOk };
