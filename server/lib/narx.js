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
  bazalar: [10530000, 10690000, 12510000, 13410000, 14310000],   // 10 690 000 — 28.11.2026: ikkiga bo'lingan 72 ta do'kon (10 530 000 + 160 000, o'rta devor)
  engPast: 10530000,   // 23.11.2026 direktor qarori: sotilmagan do'konda baza shundan past bo'lmaydi
  shartlar: [0, 60000000, 120000000],
  jadval: { '10530000': [15000000, 13000000, 12000000], '10690000': [15230000, 13200000, 12190000],
            '12510000': [17820000, 15440000, 14260000],
            '13410000': [19100000, 16560000, 15280000], '14310000': [20385000, 17670000, 16310000] },
  // 28.11.2026 (direktor qarori): prays-listda e'lon qilinmagan, lekin DIREKTOR O'ZI QO'YGAN narxlar.
  // Bular bitta-bitta do'konga tegishli, yangi prays-list bazasi emas — shuning uchun «Rasmiy» tugmalariga
  // chiqmaydi va bekor qilinganda qayta tiklanmaydi; faqat «prays-listda yo'q — tasdiqlang» ogohlantirishi
  // ko'rsatilmaydi. 16 200 000 — L-1-12/13 hojatxona, 20 630 000 — B2-1-22 hojatxona (13 410 000 × 20/13),
  // qolganlari — 28.11.2026 da bekor qilingan shartnoma narxlari o'rniga direktor qo'ygan narxlar.
  tasdiq: [11610000, 11700000, 12900000, 15470000, 16200000, 20630000],
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
// prays-listda bormi YOKI direktor tasdiqlaganmi — ogohlantirish shu bo'yicha ko'rsatiladi
const tasdiqlangan = baza => rasmiy(baza) || NARX.tasdiq.indexOf(Number(baza)) >= 0;

// 24.11.2026 (direktor qarori) — MUDDAT NARXGA TA'SIR QILADI.
// Qoida: 0 oy = 100 % naqd (1 m² = bazaning o'zi), 36 oy = bugungi rasmiy narx (jadval yoki formula),
// orasi to'g'ri mutanosib. Ya'ni bo'lib to'lash ustamasi muddatga qarab kamayadi:
//   1 m² = baza + (oy / 36) \u00d7 (36 oylik narx \u2212 baza),  eng yaqin 10 000 so'mgacha.
// Shu bilan ikki uchi bir-biriga ulanadi: 36 oyda bugungi prays-list raqamlari 1 so'mga ham o'zgarmaydi,
// 0 oyda esa naqd narxning aynan o'zi chiqadi.
function m2NarxOy(baza, boshlangich, oy) {
  const b = Number(baza) || 0, o = Math.max(0, Math.min(NARX.oy, Math.round(Number(oy) || 0)));
  if (!o) return b;                                   // 100 % naqd
  const toliq = m2Narx(b, boshlangich);               // 36 oylik narx (rasmiy bo'lsa — jadvaldan)
  if (o >= NARX.oy) return toliq;
  return Math.round((b + (o / NARX.oy) * (toliq - b)) / NARX.yaxlit) * NARX.yaxlit;
}

// 24.11.2026 (direktor qarori) — SOTILMAGAN DO'KON BAZASINI TUZATISH.
// Faqat sotilmagan do'konga tegishli (sotilgan do'kon narxi shartnomada qotib qolgan).
//  1) 23.11.2026: baza eng past rasmiy narxdan (10 530 000) past bo'lmaydi;
//  2) 24.11.2026: bazada 1 000 so'mgacha ham to'g'ri kelmaydigan raqam turgan bo'lsa — bu narx emas,
//     eski hisobning qoldig'i. Eng yaqin 10 000 so'mga keltiriladi; do'konning haqiqiy narxi
//     (katta maydon, burchak, tarsaviy do'kon ustamasi) saqlanadi, faqat ortiqcha raqamlar olinadi.
// Qaytaradi: { baza, xom, sabab } — sabab '' | 'past' | 'tiyin'.
function bazaTuzat(bazaXom, sotilganmi) {
  const x = Number(bazaXom) || 0;
  if (!x || sotilganmi) return { baza: x, xom: x, sabab: '' };
  if (x < NARX.engPast) return { baza: NARX.engPast, xom: x, sabab: 'past' };
  if (x % 1000 !== 0) return { baza: Math.round(x / NARX.yaxlit) * NARX.yaxlit, xom: x, sabab: 'tiyin' };
  return { baza: x, xom: x, sabab: '' };
}

// To'rtta tarif. t0 — boshlang'ichsiz umumiy qiymat (tejash shunga nisbatan hisoblanadi).
function hisobla(baza, maydon) {
  const b = Number(baza) || 0, S = Number(maydon) || 0;
  const p0 = m2Narx(b, 0), p60 = m2Narx(b, 60000000), p120 = m2Narx(b, 120000000);
  const t0 = p0 * S, t60 = p60 * S, t120 = p120 * S, tN = b * S;
  return {
    rasmiy: rasmiy(b), tasdiq: tasdiqlangan(b), baza: b, maydon: S,
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
  const j = NARX_JADVAL[baza], toliqOy = (Math.round(Number(oy)) >= NARX.oy);
  if (j && toliqOy) {
    if (boshl === 0) return { narx: j[0], manba: 'Rasmiy jadval (boshlang\'ichsiz)' };
    if (boshl === 60000000) return { narx: j[1], manba: 'Rasmiy jadval (60 mln)' };
    if (boshl === 120000000) return { narx: j[2], manba: 'Rasmiy jadval (120 mln)' };
  }
  // 24.11.2026: muddat ham narxga ta'sir qiladi (m2NarxOy)
  const n = m2NarxOy(baza, boshl, oy);
  return { narx: n, manba: toliqOy ? 'Formula bo\'yicha ekstrapolyatsiya — tasdiqlang'
    : Math.round(Number(oy)) + ' oy — formula bo\'yicha hisoblandi, tasdiqlang' };
}


// 28.11.2026 (direktor qarori) — SHARTNOMA BEKOR QILINGANDA NARX PRAYS-LISTGA QAYTADI.
// Sabab: sotilgan do'konda G ustunida shartnomaning o'z 1 m² narxi turadi. Shartnoma bekor qilinib
// do'kon bo'shaganda o'sha eski narx qolib ketar edi (28.11.2026 holatiga 9 ta do'kon shunday edi:
// H-1-23, Q-1-11, O-1-24, R-1-14 — bekor qilingan shartnomalardan; qolganlari eski davr qoldig'i).
// Qoida: shu blok va qavatdagi BO'SH do'konlarning rasmiy bazasi olinadi — avval maydoni teng
// (±0,5 m²) bo'lganlardan, bo'lmasa butun blok-qavatdan. Bitta aniq g'olib bo'lmasa — tizim narxni
// o'zgartirmaydi va direktorga «qo'lda qo'ying» deb aytadi (o'zicha nolga yaxlitlab yubormaydi).
const RASMIY_BAZA = NARX.bazalar;   // yagona manba — prays-list bazalari
function praysBaza(R, blok, qavat, maydon) {
  const s = v => String(v == null ? '' : v).trim();
  const qav = z => s(z).replace(/\.0+$/, '');
  const bosh = x => {
    const ij = s(x[21]);
    return !s(x[17]) && (!ij || /^IJ-YOQ/i.test(ij));
  };
  const N = [];
  R.forEach(({ x }) => {
    if (!s(x[0]) || s(x[2]) !== s(blok) || qav(x[3]) !== qav(qavat) || !bosh(x)) return;
    if (s(x[14])) return;   // 28.11.2026: izohli do'kon (ҲОЖАТХОНА kabi) maxsus narxda — namuna bo'lmaydi
    const b = Number(x[6]) || 0;
    if (RASMIY_BAZA.indexOf(b) >= 0) N.push({ b, m: Number(x[5]) || 0 });
  });
  const golib = L => {
    if (!L.length) return 0;
    const c = {}; L.forEach(z => { c[z.b] = (c[z.b] || 0) + 1; });
    const K = Object.keys(c).sort((a, b) => c[b] - c[a]);
    if (K.length > 1 && c[K[0]] === c[K[1]]) return 0;    // teng chiqdi — tanlamaymiz
    return Number(K[0]);
  };
  const m = Number(maydon) || 0;
  return (m ? golib(N.filter(z => Math.abs(z.m - m) <= 0.5)) : 0) || golib(N);
}

module.exports = { bazaTuzat, NARX, praysBaza, RASMIY_BAZA, tasdiqlangan, m2Narx, m2NarxOy, rasmiy, hisobla, NARX_JADVAL, narxHisob };
