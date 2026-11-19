// AKS TIZIM — do'kon narxi. YAGONA MANBA: ilova ham, taklif varag'i ham shu yerdan oladi.
// 19.11.2026 (direktor qarori) — taklif_generator.py dagi qoida serverga ko'chirildi.
//
// Rasmiy prays-listda e'lon qilingan 4 ta baza uchun — JADVAL dagi aniq raqamlar.
// Boshqa baza uchun — formula: 1 m² = baza × [1,045 + 0,3795 × 0,5^(boshlang'ich / 60 000 000)],
// eng yaqin 10 000 so'mgacha yaxlitlanadi. Formula taqribiy: rasmiy bazalarda ham 5–10 ming so'm
// farq qiladi, shuning uchun rasmiy baza bo'lsa FAQAT jadval ishlaydi.
// 100 % naqd — alohida hol: 1 m² = bazaning o'zi.
'use strict';

const NARX = {
  k1: 1.045, k2: 0.3795, yarim: 60000000, yaxlit: 10000, oy: 36,
  bazalar: [10530000, 12510000, 13410000, 14310000],
  shartlar: [0, 60000000, 120000000],
  jadval: { '10530000': [15000000, 13000000, 12000000], '12510000': [17820000, 15440000, 14260000],
            '13410000': [19100000, 16560000, 15280000], '14310000': [20385000, 17670000, 16310000] },
  sovga: { naqd: '«Умра» сафарига йўлланма ва замонавий телевизор', '120': '12-ўлчамли кондиционер',
           '60': 'Замонавий телевизор', '0': 'Мотивацион эсдалик совғалари' }
};

// 1 m² narxi: rasmiy baza bo'lsa jadvaldan, aks holda formuladan
function m2Narx(baza, boshlangich) {
  const J = NARX.jadval[String(baza)];
  if (J) { const i = NARX.shartlar.indexOf(boshlangich); if (i >= 0 && J[i]) return J[i]; }
  return Math.round(baza * (NARX.k1 + NARX.k2 * Math.pow(0.5, boshlangich / NARX.yarim)) / NARX.yaxlit) * NARX.yaxlit;
}
const rasmiy = baza => NARX.bazalar.indexOf(Number(baza)) >= 0;

// To'rtta tarif. t0 — boshlang'ichsiz umumiy qiymat (tejash shunga nisbatan hisoblanadi).
function hisobla(baza, maydon) {
  const b = Number(baza) || 0, S = Number(maydon) || 0;
  const p0 = m2Narx(b, 0), p60 = m2Narx(b, 60000000), p120 = m2Narx(b, 120000000);
  const t0 = p0 * S, t60 = p60 * S, t120 = p120 * S, tN = b * S;
  return {
    rasmiy: rasmiy(b), baza: b, maydon: S,
    naqd: { m2: b, jami: tN, tejash: t0 - tN, oylik: 0, boshlangich: 0 },
    '120': { m2: p120, jami: t120, oylik: (t120 - 120000000) / NARX.oy, tejash: t0 - t120, boshlangich: 120000000 },
    '60':  { m2: p60,  jami: t60,  oylik: (t60 - 60000000) / NARX.oy,   tejash: t0 - t60,  boshlangich: 60000000 },
    yoq:   { m2: p0,   jami: t0,   oylik: t0 / NARX.oy,                 tejash: 0,         boshlangich: 0 }
  };
}

// ───────────────────────────────────────────────────────────────────────────
// ESKI NOM BILAN CHAQIRILADIGAN QISM — api/shartnoma.js (jadvalHisob) va
// lib/ijara_hujjat.js shu ikkisini ishlatadi. Jadval yuqoridagi NARX.jadval bilan
// AYNAN bir xil, ikkinchi manba emas: NARX_JADVAL o'sha obyektdan yasaladi.
const NARX_JADVAL = {};
Object.keys(NARX.jadval).forEach(k => { NARX_JADVAL[Number(k)] = NARX.jadval[k]; });

// narxHisob(baza, boshlang'ich, oy) — oy 0 yoki yo'q bo'lsa 100 % to'lov (1 m² = baza)
function narxHisob(baza, boshl, oy) {
  if (!oy || oy <= 0) return { narx: baza, manba: '100% to\'lov — baza narx' };
  const j = NARX_JADVAL[baza];
  if (j) {
    if (boshl === 0) return { narx: j[0], manba: 'Rasmiy jadval (boshlang\'ichsiz)' };
    if (boshl === 60000000) return { narx: j[1], manba: 'Rasmiy jadval (60 mln)' };
    if (boshl === 120000000) return { narx: j[2], manba: 'Rasmiy jadval (120 mln)' };
  }
  const x = baza * (NARX.k1 + NARX.k2 * Math.pow(0.5, boshl / NARX.yarim));
  return { narx: Math.round(x / NARX.yaxlit) * NARX.yaxlit, manba: 'Formula bo\'yicha ekstrapolyatsiya — tasdiqlang' };
}

module.exports = { NARX, m2Narx, rasmiy, hisobla, NARX_JADVAL, narxHisob };
