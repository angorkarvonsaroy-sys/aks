// AKS TIZIM — rasmiy prays-list va 1 m² narx hisobi (Kod.gs NARX_JADVAL / narxHisob_ bilan bir xil).
// baza → (0 boshlang'ich, 60 mln, 120 mln); boshqa baza yoki boshlang'ich — formula bo'yicha ekstrapolyatsiya (10 000 gacha yaxlitlab).
'use strict';
const NARX_JADVAL = { 10530000: [15000000, 13000000, 12000000], 12510000: [17820000, 15440000, 14260000],
  13410000: [19100000, 16560000, 15280000], 14310000: [20385000, 17670000, 16310000] };
function narxHisob(baza, boshl, oy) {
  if (!oy || oy <= 0) return { narx: baza, manba: '100% to\'lov — baza narx' };
  const j = NARX_JADVAL[baza];
  if (j) {
    if (boshl === 0) return { narx: j[0], manba: 'Rasmiy jadval (boshlang\'ichsiz)' };
    if (boshl === 60000000) return { narx: j[1], manba: 'Rasmiy jadval (60 mln)' };
    if (boshl === 120000000) return { narx: j[2], manba: 'Rasmiy jadval (120 mln)' };
  }
  const x = baza * (1.045 + 0.3795 * Math.pow(0.5, boshl / 60000000));
  return { narx: Math.round(x / 10000) * 10000, manba: 'Formula bo\'yicha ekstrapolyatsiya — tasdiqlang' };
}
module.exports = { NARX_JADVAL, narxHisob };
