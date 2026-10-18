// AKS TIZIM — ogohlantirish xati PDF'ini serverda tekshirish (lib/xat_pdf.js).
// lib/xat_pdf.js eski Google Docs xatlari bilan lokal solishtirilgan (4 ta haqiqiy xat — qatorlar 0,15 pt gacha mos).
// Serverdagi Chromium / shrift boshqacha joylashtirmasligini tekshirish uchun bu yerda SOXTA ma'lumotli xatlar yasaladi
// va har so'zning joyi (pdftotext -bbox) lokal natija bilan (lib/xat/sinov_kutilgan.json) solishtiriladi.
// Haqiqiy mijoz ma'lumoti YO'Q (repo ochiq). Kutilgan natijani yangilash (faqat lokal): node lib/xat_sinov.js yoz
'use strict';
const fs = require('fs'), os = require('os'), path = require('path');
const { execFileSync } = require('child_process');
const XP = require('./xat_pdf');

const IJ = { ism: 'Синовчи Ходим', tel: '+998 90 000 00 00' };
const X = (o) => Object.assign({ no: '99/901', fish: 'Тестов Сардор Алишерович', manzil: 'Сурхондарё вилояти Ангор тумани Намуна МФЙ Синов кўчаси 12-уй',
  sana: '2023-05-15', blok: 'A', qavat: '1', dokonNo: '5', maydon: 25.4, shablon: 'ESKI_TAYYOR' }, o);
const NAMUNALAR = {
  eski_tayyor_1: { x: X({}), b: 1, raqam: 'OG-2026/9001', sana: '2026-10-08', muddat: '2026-10-18', Q: { asosiy: 12345678, muddati: 5432100, qoshimcha: 0, jami: 12345678 }, oldin: [] },
  eski_tayyor_2: { x: X({ no: '99/902', fish: 'Синов Камола Баҳодировна', sana: '2022-03-01', maydon: 39.52 }), b: 2, raqam: 'OG-2026/9002', sana: '2026-10-14', muddat: '2026-10-21',
    Q: { asosiy: 78145609, muddati: 78145609, qoshimcha: 40677615, jami: 118823224 }, oldin: [{ raqam: 'OG-2026/9000', sana: '07.10.2026' }] },
  eski_qur_3_shosh: { x: X({ no: '99/72', fish: 'Намунов Аброр Анварович', shablon: 'ESKI_QURILAYOTGAN', maydon: 14.98 }), b: 3, raqam: 'OG-2026/9003', sana: '2026-10-14', muddat: '2026-10-19',
    Q: { asosiy: 65820000, muddati: 65820000, qoshimcha: 0, jami: 65820000 }, oldin: [], shosh: { engEski: '2022-03-01', oxirgi: '2026-02-10', bugun: '2026-10-14', muloqot: true } },
  yangi_tayyor_2: { x: X({ no: '99/903', fish: 'Testov Jasur Baxtiyor o‘g‘li', shablon: 'YANGI_TAYYOR' }), b: 2, raqam: 'OG-2026/9004', sana: '2026-10-14', muddat: '2026-10-21',
    Q: { asosiy: 9800000, muddati: 4200000, qoshimcha: 1500000, jami: 11300000 }, oldin: [{ raqam: 'OG-2026/8999', sana: '01.10.2026' }] },
  yangi_qur_1: { x: X({ no: '99/904', shablon: 'YANGI_QURILAYOTGAN' }), b: 1, raqam: 'OG-2026/9005', sana: '2026-10-09', muddat: '2026-10-19',
    Q: { asosiy: 30000000, muddati: 2500000, qoshimcha: 0, jami: 30000000 }, oldin: [] },
  maydon_b_1: { x: X({ no: '99/76', fish: 'Синовов Ҳамдам Ўролович', manzil: 'Сурхондарё вилояти Ангор тумани Гулистон МФЙ Фароғат кўчаси 11-уй', sana: '2022-02-28', blok: '', qavat: '', dokonNo: '',
    maydon: 16.3, real: 18.5, farq: 2.2, narx: 10530000, qoshQiymat: 23166000, shablon: 'QM_B' }), b: 1, raqam: 'OG-2026/9006', sana: '2026-10-08', muddat: '2026-10-18',
    Q: { asosiy: 0, muddati: 0, qoshimcha: 23166000, jami: 23166000 }, oldin: [] },
  maydon_a_3: { x: X({ no: '99/77', maydon: 20, real: 21.75, farq: 1.75, narx: 12510000, qoshQiymat: 21892500, notarial: '2026-11-01', shablon: 'QM_A' }), b: 3, raqam: 'OG-2026/9007', sana: '2026-10-15', muddat: '2026-10-25',
    Q: { asosiy: 0, muddati: 0, qoshimcha: 21892500, jami: 21892500 }, oldin: [{ raqam: 'OG-2026/9101', sana: '01.10.2026' }, { raqam: 'OG-2026/9102', sana: '08.10.2026' }] },
  ikki_bet: { x: X({ no: '99/905', manzil: 'Сурхондарё вилояти Ангор тумани ' + 'жуда узун синов манзили '.repeat(12) + '1-уй' }), b: 2, raqam: 'OG-2026/9008', sana: '2026-10-14', muddat: '2026-10-21',
    Q: { asosiy: 78145609, muddati: 78145609, qoshimcha: 40677615, jami: 118823224 }, oldin: [{ raqam: 'OG-2026/9000', sana: '07.10.2026' }] },
};

// PDF → har so'z: [bet, matn, xMin, yMin, xMax, yMax] (pt, 2 xona)
function sozlar(buf) {
  const f = path.join(os.tmpdir(), 'aks_xat_' + process.pid + '_' + Math.random().toString(36).slice(2) + '.pdf');
  fs.writeFileSync(f, buf);
  try {
    const h = execFileSync('pdftotext', ['-bbox', f, '-'], { maxBuffer: 64 << 20 }).toString('utf8');
    const r = []; let bet = 0;
    const re = /<page |<word xMin="([\d.]+)" yMin="([\d.]+)" xMax="([\d.]+)" yMax="([\d.]+)">([^<]*)<\/word>/g; let m;
    while ((m = re.exec(h))) {
      if (m[0] === '<page ') { bet++; continue; }
      r.push([bet, m[5], +(+m[1]).toFixed(2), +(+m[2]).toFixed(2), +(+m[3]).toFixed(2), +(+m[4]).toFixed(2)]);
    }
    return r;
  } finally { fs.unlink(f, () => {}); }
}
async function izlar() {
  const o = {};
  for (const [nom, n] of Object.entries(NAMUNALAR)) {
    const r = await XP.xatChiqar(n.x, n.b, n.raqam, n.sana, n.muddat, n.Q, n.oldin, IJ, n.shosh || null);
    o[nom] = { nom: r.nom, bet: r.bet, ikkiBet: r.ikkiBet, sozlar: sozlar(r.pdf) };
  }
  return o;
}
// Kutilgan natija bilan solishtirish: { farq, chiqish[] }
async function tekshir() {
  const K = JSON.parse(fs.readFileSync(path.join(__dirname, 'xat', 'sinov_kutilgan.json'), 'utf8'));
  const Y = await izlar(), out = []; let farq = 0;
  for (const nom of Object.keys(K)) {
    const a = K[nom], b = Y[nom]; let mx = 0; const yomon = [];
    if (!b) { out.push('✖ ' + nom + ': yasalmadi'); farq++; continue; }
    if (a.nom !== b.nom || a.bet !== b.bet || a.ikkiBet !== b.ikkiBet) yomon.push('fayl/bet: kutilgan ' + a.nom + ' ' + a.bet + ' bet, serverda ' + b.nom + ' ' + b.bet + ' bet');
    if (a.sozlar.length !== b.sozlar.length) yomon.push('so\'zlar soni: kutilgan ' + a.sozlar.length + ', serverda ' + b.sozlar.length);
    const n = Math.min(a.sozlar.length, b.sozlar.length);
    for (let i = 0; i < n; i++) {
      const p = a.sozlar[i], q = b.sozlar[i];
      if (p[0] !== q[0] || p[1] !== q[1]) { yomon.push('so\'z ' + (i + 1) + ': kutilgan «' + p[1] + '» (' + p[0] + '-bet), serverda «' + q[1] + '» (' + q[0] + '-bet)'); break; }
      const d = Math.max(...[2, 3, 4, 5].map(k => Math.abs(p[k] - q[k]))); if (d > mx) mx = d;
      if (d > 0.1 && yomon.length < 4) yomon.push('«' + p[1] + '» ' + d.toFixed(2) + ' pt siljigan');
    }
    if (yomon.length) farq++;
    out.push((yomon.length ? '✖ ' : '✓ ') + nom.padEnd(18) + b.bet + ' bet, ' + b.sozlar.length + ' so\'z, eng katta og\'ish ' + mx.toFixed(2) + ' pt' + (yomon.length ? '\n     ' + yomon.join('\n     ') : ''));
  }
  return { farq, chiqish: out };
}

module.exports = { tekshir, izlar, NAMUNALAR };

if (require.main === module && process.argv[2] === 'yoz') {
  izlar().then(o => {
    fs.writeFileSync(path.join(__dirname, 'xat', 'sinov_kutilgan.json'), JSON.stringify(o));
    for (const [k, v] of Object.entries(o)) console.log(k, v.nom, v.bet + ' bet', v.ikkiBet ? '(ikki bet)' : '', v.sozlar.length + ' so\'z');
    process.exit(0);
  }).catch(e => { console.error(e); process.exit(1); });
}
