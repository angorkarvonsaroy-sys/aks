// AKS TIZIM — yurist hujjatlari (ma'lumotnoma, bayonnoma, penya — PDF / Word / Excel; aloqa xati — PDF / Word) serverda lokal natija
// bilan bir xil chiqishini tekshirish. Hujjat yasovchilar haqiqiy eski hujjatlar bilan lokal solishtirilgan (19.10.2026 namunalari:
// PDF — har so'z joyi 0,3 pt gacha, Word va Excel — Google eksporti bilan bayt-ma-bayt). Bu yerda SOXTA ma'lumot bilan yasaladi:
// PDF — har so'zning joyi (pdftotext -bbox), Word / Excel — zip ichidagi qismlar (siqilmagan) xeshi lokal natija bilan solishtiriladi.
// Haqiqiy mijoz ma'lumoti YO'Q (repo ochiq). Kutilgan natijani yangilash (faqat lokal): node lib/yurist_sinov.js yoz
'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const YM = require('./yurist_malumot');
const YH = require('./yurist_hujjat');
const DP = require('./docs_pdf');
const DD = require('./docs_docx');
const YE = require('./yurist_excel');
const XG = require('./xlsx_google');
const BW = require('./bekor_word');
const { zipOqi } = require('./xlsx');
const { sozlar } = require('./xat_sinov');

const KUT = path.join(__dirname, 'yurist', 'sinov_kutilgan.json');
const ISM = 'Синовчи Юрист Тестович', IJ = { ism: 'Синовчи Юрист', tel: '+998 90 000 00 00' };
// katta — ko'p sahifali holat (jurnal va to'lovlar ko'paytirilgan): sahifa bo'linishi va jadval qatorlarining sahifalarga tushishi
function namunalar() {
  const J = JSON.parse(fs.readFileSync(path.join(__dirname, 'yurist', 'sinov_M.json'), 'utf8'));
  const katta = JSON.parse(JSON.stringify(J.M7));
  for (let k = 0; k < 6; k++) {
    J.M7.jurnal.forEach((j, i) => katta.jurnal.push(Object.assign({}, j, { id: 100 + k * 10 + i, sana: '2026-0' + (3 + k) + '-1' + i, mazmun: (j.mazmun || 'Синов') + ' — қўшимча синов қайди ' + (k + 1) + ' (узун матн билан: қарздорликни ундириш масаласи бўйича суҳбат)' })));
    J.M7.tolov.forEach((t, i) => katta.tolov.push(Object.assign({}, t, { sana: '2025-0' + (3 + k) + '-0' + (i + 1), summa: 1000000 * (k + 1) + i })));
  }
  katta.tolov.sort((a, b) => a.sana < b.sana ? -1 : 1); katta.jurnal.sort((a, b) => a.sana < b.sana ? -1 : 1);
  return { kichik: J.M7, buyruq: J.M8, katta };
}
const xesh = b => crypto.createHash('sha1').update(b).digest('hex').slice(0, 16);
const qismlar = buf => { const Z = zipOqi(buf), o = {}; Object.keys(Z).sort().forEach(k => { o[k] = xesh(Z[k]); }); return o; };
async function izlar() {
  const o = {};
  for (const [nom, M] of Object.entries(namunalar())) {
    const X = YM.yhXronologiya(M), r = {};
    for (const [k, md] of [['mal', YH.malumotnomaModel(M, ISM)], ['bay', YH.bayonnomaModel(M, X, ISM)], ['pen', YH.penyaModel(M, ISM)]]) {
      const p = await DP.yasa(md.model);
      r[k] = { nom: md.nom, bet: p.bet, sozlar: sozlar(p.pdf), docx: qismlar(DD.yasa(md.model)) };
    }
    r.bayX = qismlar(XG.yasa(YE.bayonnomaKitob(M, X))); r.penX = qismlar(XG.yasa(YE.penyaKitob(M)));
    const a = await YH.aloqaYasa(M, 'YU-2026/9001', IJ);
    r.aloqa = { nom: a.nom, bet: a.bet, k: a.k, sozlar: sozlar(a.pdf), docx: qismlar(BW.bloklarDocx(a.bloklar, 'YU-2026/9001', M.bugun, IJ, a.k)) };
    o[nom] = r;
  }
  return o;
}
async function tekshir() {
  const K = JSON.parse(fs.readFileSync(KUT, 'utf8'));
  const Y = await izlar(), out = []; let farq = 0;
  for (const nom of Object.keys(K)) for (const k of Object.keys(K[nom])) {
    const a = K[nom][k], b = Y[nom] && Y[nom][k], nm = nom + ' / ' + k; const yomon = []; let mx = 0;
    if (!b) { out.push('✖ ' + nm + ': yasalmadi'); farq++; continue; }
    if (a.sozlar) {
      if (a.bet !== b.bet || a.nom !== b.nom) yomon.push('fayl/bet: kutilgan ' + a.nom + ' ' + a.bet + ' bet, serverda ' + b.nom + ' ' + b.bet + ' bet');
      if (a.sozlar.length !== b.sozlar.length) yomon.push('so\'zlar soni: kutilgan ' + a.sozlar.length + ', serverda ' + b.sozlar.length);
      const n = Math.min(a.sozlar.length, b.sozlar.length);
      for (let i = 0; i < n; i++) {
        const p = a.sozlar[i], q = b.sozlar[i];
        if (p[0] !== q[0] || p[1] !== q[1]) { yomon.push('so\'z ' + (i + 1) + ': kutilgan «' + p[1] + '» (' + p[0] + '-bet), serverda «' + q[1] + '» (' + q[0] + '-bet)'); break; }
        const d = Math.max(...[2, 3, 4, 5].map(j => Math.abs(p[j] - q[j]))); if (d > mx) mx = d;
        if (d > 0.1 && yomon.length < 4) yomon.push('«' + p[1] + '» ' + d.toFixed(2) + ' pt siljigan');
      }
    }
    const qa = a.docx || (a.sozlar ? null : a), qb = b.docx || (b.sozlar ? null : b);
    if (qa) Object.keys(Object.assign({}, qa, qb)).forEach(f => { if (qa[f] !== qb[f]) yomon.push((a.sozlar ? 'Word ' : 'Excel ') + f + ' farq qiladi'); });
    if (yomon.length) farq++;
    out.push((yomon.length ? '✖ ' : '✓ ') + nm.padEnd(18) + (a.sozlar ? b.bet + ' bet, ' + b.sozlar.length + ' so\'z, eng katta og\'ish ' + mx.toFixed(2) + ' pt' + (a.docx ? ' + Word' : '') : 'Excel ' + Object.keys(qb).length + ' qism')
      + (yomon.length ? '\n     ' + yomon.slice(0, 6).join('\n     ') : ''));
  }
  return { farq, chiqish: out };
}
module.exports = { tekshir, izlar, namunalar };

if (require.main === module && process.argv[2] === 'yoz') {
  izlar().then(o => {
    fs.writeFileSync(KUT, JSON.stringify(o));
    for (const [k, v] of Object.entries(o)) console.log(k.padEnd(8), Object.entries(v).map(([n, r]) => n + (r.bet ? ' ' + r.bet + ' bet' : '')).join(' | '));
    process.exit(0);
  }).catch(e => { console.error(e); process.exit(1); });
}
