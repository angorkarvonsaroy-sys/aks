// AKS TIZIM — shartnomani bekor qilish hujjatlari (lib/bekor_hujjat.js) serverda eski Google Docs bilan bir xil chiqishini tekshirish.
// lib/bekor_hujjat.js haqiqiy eski buyruq va xabarnoma bilan lokal solishtirilgan (qatorlar 0,15 pt gacha mos). Bu yerda SOXTA ma'lumotli
// hujjatlar yasaladi va har so'zning joyi (pdftotext -bbox) lokal natija bilan (lib/bekor/sinov_kutilgan.json) solishtiriladi.
// Haqiqiy mijoz ma'lumoti YO'Q (repo ochiq). Kutilgan natijani yangilash (faqat lokal): node lib/bekor_sinov.js yoz
'use strict';
const fs = require('fs'), path = require('path');
const BH = require('./bekor_hujjat');
const { sozlar } = require('./xat_sinov');

const IJ = { ism: 'Синовчи Ходим', tel: '+998 90 000 00 00' };
const dk = (blok, qavat, nomer, maydon) => ({ blok, qavat, nomer, maydon });
const X0 = o => Object.assign({ tur: 'sotuv', no: '99/911', sana: '2025-09-10', dokon: 'L-1-3', maydon: 35.3, fish: 'Тестов Сардор Алишерович', fishK: 'Тестов Сардор Алишерович',
  manzil: 'Сурхондарё вилояти Ангор тумани Намуна МФЙ Синов кўчаси 30-уй', qiymat: 371709000, tolangan: 288000000, asosiy: 83709000, qoshimcha: 0, jami: 83709000,
  muddati: 83709000, kechikkan: 97, shablon: 'YANGI_TAYYOR', dk: dk('L', '1', '3', 35.3) }, o);
const NAMUNALAR = {
  yangi_tayyor: { x: X0({}), X: { jumla: '' }, raqam: 'BQ-2026/9001', xRaqam: 'BX-2026/9001', sana: '2026-10-03' },
  yangi_tayyor_xat: { x: X0({ no: '99/912', qoshimcha: 12500000, jami: 96209000, tolangan: 20000000 }), X: { jumla: 'Жамият томонидан мижозга 01.09.2026 санада №OG-2026/9101-рақамли огоҳлантириш хати, 15.09.2026 санада №OG-2026/9102-рақамли огоҳлантириш хати юборилган, бироқ қарздорлик бартараф этилмаган.' },
    raqam: 'BQ-2026/9002', xRaqam: 'BX-2026/9002', sana: '2026-10-15' },
  yangi_qur_tolovsiz: { x: X0({ no: '99/913', shablon: 'YANGI_QURILAYOTGAN', tolangan: 0, asosiy: 150000000, muddati: 12000000, jami: 150000000, kechikkan: 0, dk: dk('G', '2', '14', 22.75), maydon: 22.75 }),
    X: { jumla: 'Мижоз томонидан шартнома бўйича бирорта тўлов амалга оширилмаган.' }, raqam: 'BQ-2026/9003', xRaqam: 'BX-2026/9003', sana: '2026-10-16' },
  eski_tayyor: { x: X0({ no: '99/914', sana: '2023-04-12', shablon: 'ESKI_TAYYOR', manzil: '', tolangan: 54000000, asosiy: 26000000, muddati: 26000000, jami: 26000000, kechikkan: 410, dk: dk('E', '1', '10', 33.1), maydon: 33.1 }),
    X: { jumla: '' }, raqam: 'BQ-2026/9004', xRaqam: 'BX-2026/9004', sana: '2026-10-17' },
  eski_qur: { x: X0({ no: '99/915', sana: '2022-02-20', shablon: 'ESKI_QURILAYOTGAN', tolangan: 0, asosiy: 65820000, muddati: 65820000, jami: 65820000, kechikkan: 1200, dk: null, dokon: 'S-1-25', maydon: 14.98 }),
    X: { jumla: 'Мижоз томонидан шартнома бўйича бирорта тўлов амалга оширилмаган.' }, raqam: 'BQ-2026/9005', xRaqam: 'BX-2026/9005', sana: '2026-10-18' },
  ijara: { x: X0({ tur: 'ijara', no: 'IJ-27/901', sana: '2025-03-01', shablon: 'IJARA', qiymat: 0, tolangan: 0, asosiy: 0, muddati: 0, jami: 0, kechikkan: 0, dokon: 'B-2-7', dk: dk('B', '2', '7', 18.4), maydon: 18.4 }),
    X: { jumla: 'Жамият томонидан Ижарачига 2026 йил 1 сентябрда, 2026 йил 20 сентябрда ёзма огоҳлантириш хати юборилган (нусхаси иш материалларида), бироқ камчилик бартараф этилмаган.' },
    raqam: 'BQ-2026/9006', xRaqam: 'BX-2026/9006', sana: '2026-10-19' },
  uzun: { x: X0({ no: '99/916', manzil: 'Сурхондарё вилояти Ангор тумани ' + 'жуда узун синов манзили '.repeat(10) + '1-уй', qoshimcha: 40677615, jami: 124386615 }),
    X: { jumla: 'Жамият томонидан мижозга ' + Array.from({ length: 6 }, (_, i) => '0' + (i + 1) + '.0' + (i + 1) + '.2026 санада №OG-2026/91' + (10 + i) + '-рақамли огоҳлантириш хати').join(', ') + ' юборилган, бироқ қарздорлик бартараф этилмаган.' },
    raqam: 'BQ-2026/9007', xRaqam: 'BX-2026/9007', sana: '2026-10-19' },
};
async function izlar() {
  const o = {};
  for (const [nom, n] of Object.entries(NAMUNALAR)) {
    const P = BH.bekorPul(n.x);
    const b = await BH.buyruqYasa(n.x, n.X, P, n.raqam, n.sana);
    const h = await BH.xabarnomaYasa(n.x, n.X, P, n.raqam, n.xRaqam, n.sana, IJ);
    o[nom] = { b: { bet: b.bet, sozlar: sozlar(b.pdf) }, h: { bet: h.bet, ikkiBet: h.ikkiBet, sozlar: sozlar(h.pdf) } };
  }
  return o;
}
async function tekshir() {
  const K = JSON.parse(fs.readFileSync(path.join(__dirname, 'bekor', 'sinov_kutilgan.json'), 'utf8'));
  const Y = await izlar(), out = []; let farq = 0;
  for (const nom of Object.keys(K)) for (const t of ['b', 'h']) {
    const a = K[nom][t], b = Y[nom] && Y[nom][t], nm = nom + (t === 'b' ? ' (buyruq)' : ' (xabarnoma)'); let mx = 0; const yomon = [];
    if (!b) { out.push('✖ ' + nm + ': yasalmadi'); farq++; continue; }
    if (a.bet !== b.bet || !!a.ikkiBet !== !!b.ikkiBet) yomon.push('bet: kutilgan ' + a.bet + ', serverda ' + b.bet);
    if (a.sozlar.length !== b.sozlar.length) yomon.push('so\'zlar soni: kutilgan ' + a.sozlar.length + ', serverda ' + b.sozlar.length);
    const n = Math.min(a.sozlar.length, b.sozlar.length);
    for (let i = 0; i < n; i++) {
      const p = a.sozlar[i], q = b.sozlar[i];
      if (p[0] !== q[0] || p[1] !== q[1]) { yomon.push('so\'z ' + (i + 1) + ': kutilgan «' + p[1] + '» (' + p[0] + '-bet), serverda «' + q[1] + '» (' + q[0] + '-bet)'); break; }
      const d = Math.max(...[2, 3, 4, 5].map(k => Math.abs(p[k] - q[k]))); if (d > mx) mx = d;
      if (d > 0.1 && yomon.length < 4) yomon.push('«' + p[1] + '» ' + d.toFixed(2) + ' pt siljigan');
    }
    if (yomon.length) farq++;
    out.push((yomon.length ? '✖ ' : '✓ ') + nm.padEnd(30) + b.bet + ' bet, ' + b.sozlar.length + ' so\'z, eng katta og\'ish ' + mx.toFixed(2) + ' pt' + (yomon.length ? '\n     ' + yomon.join('\n     ') : ''));
  }
  return { farq, chiqish: out };
}
module.exports = { tekshir, izlar, NAMUNALAR, IJ };

if (require.main === module && process.argv[2] === 'yoz') {
  izlar().then(o => {
    fs.writeFileSync(path.join(__dirname, 'bekor', 'sinov_kutilgan.json'), JSON.stringify(o));
    for (const [k, v] of Object.entries(o)) console.log(k.padEnd(20), 'buyruq', v.b.bet + ' bet', v.b.sozlar.length + ' so\'z | xabarnoma', v.h.bet + ' bet' + (v.h.ikkiBet ? ' (ikki bet)' : ''), v.h.sozlar.length + ' so\'z');
    process.exit(0);
  }).catch(e => { console.error(e); process.exit(1); });
}
