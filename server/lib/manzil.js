// AKS TIZIM — 02_Mijozlar Z «Toliq_manzil»: N..S qismlaridan (viloyat, tuman, MFY, ko'cha, uy, xonadon) yig'iladi (01.11.2026).
// Qoida eski qatorlardan olingan: 01.11 da 2–263-qatorlarning 262 tasi (bo'sh qatordan tashqari hammasi) aynan shu bilan bir xil chiqdi.
//   «Сурхондарё вилояти Ангор тумани Гулистон МФЙ Файз кўчаси 1-уй, 9-хонадон»
//   viloyat «… шаҳри» / «… вилояти» / «… Республикаси» bilan tugasa — qo'shimcha yozilmaydi.
// Avval Z yangi qatorga yuqoridagi qatordan «formula» deb nusxalanardi (Z da formula yo'q) — oldingi mijozning manzili ko'chib qolardi.
'use strict';
const T = v => {
  if (v == null) return '';
  if (typeof v === 'number') return Number.isInteger(v) ? String(v) : String(v);
  return String(v).trim().replace(/^(\d+)\.0$/, '$1');
};
function toliqManzil(vil, tum, mfy, kocha, uy, xon) {
  const V = T(vil), q = [];
  if (V) q.push(/(вилояти|шаҳри|Республикаси)$/.test(V) ? V : V + ' вилояти');
  if (T(tum)) q.push(T(tum));
  if (T(mfy)) q.push(T(mfy) + ' МФЙ');
  if (T(kocha)) q.push(T(kocha) + ' кўчаси');
  if (T(uy)) q.push(T(uy) + '-уй');
  let s = q.join(' ');
  if (T(xon)) s += ', ' + T(xon) + '-хонадон';
  return s;
}
// 02 qatori (0 dan: 13 viloyat … 18 xonadon)
const qatordan = r => toliqManzil(r[13], r[14], r[15], r[16], r[17], r[18]);
module.exports = { toliqManzil, qatordan };
