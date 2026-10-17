// AKS TIZIM — xodim ismini moslashuvchan solishtirish (Bekor.gs xodimTeng_/xodimNorm_ — kirill/lotin, qisqa ism).
'use strict';
function xodimNorm(x) {
  const K = { 'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'ё': 'yo', 'ж': 'j', 'з': 'z', 'и': 'i', 'й': 'y', 'к': 'k', 'л': 'l',
    'м': 'm', 'н': 'n', 'о': 'o', 'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u', 'ф': 'f', 'х': 'x', 'ц': 'ts', 'ч': 'ch', 'ш': 'sh', 'щ': 'sh',
    'ъ': '', 'ы': 'i', 'ь': '', 'э': 'e', 'ю': 'yu', 'я': 'ya', 'ў': 'o', 'қ': 'k', 'ғ': 'g', 'ҳ': 'x' };
  let t = String(x || '').toLowerCase().replace(/[ʻʼ'`’‘]/g, '');
  t = t.split('').map(c => K[c] !== undefined ? K[c] : c).join('');
  t = t.replace(/kh/g, 'x').replace(/(^|[^sc])h/g, '$1x').replace(/q/g, 'k').replace(/[^a-z\s]/g, ' ').replace(/\s+/g, ' ').trim();
  return t.split(' ');
}
function xodimTeng(a, b) {
  const A = xodimNorm(a), B = xodimNorm(b);
  if (!A[0] || !B[0]) return false;
  const f1 = A[0], f2 = B[0];
  const famOk = f1 === f2 || (f1.slice(0, 6) === f2.slice(0, 6) && Math.abs(f1.length - f2.length) <= 2);
  if (!famOk) return false;
  const i1 = A[1] || '', i2 = B[1] || '';
  if (!i1 || !i2) return true;
  return i1.indexOf(i2) === 0 || i2.indexOf(i1) === 0;
}
module.exports = { xodimNorm, xodimTeng };
