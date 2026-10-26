#!/usr/bin/env node
// AKS TIZIM — 📊 Ta'sischi hisobotini terminalda ko'rish (raqamlarni tekshirish uchun). Ishlatish: aks-tasischi
'use strict';
process.env.AKS_ENV = process.env.AKS_ENV || '/opt/aks/.env';
const { pool, redis } = require('../lib/db');
const T = require('../api/tasischi');

process.stdout.on('error', e => { if (e.code === 'EPIPE') process.exit(0); });
const pul = n => Math.round(Number(n) || 0).toLocaleString('ru-RU').replace(/[ ,]/g, ' ');
const m2 = n => (Math.round(Number(n) * 100) / 100).toFixed(2).replace('.', ',');
const L = (a, b) => console.log('  ' + String(a).padEnd(46) + String(b).padStart(22));

const FAQAT_DIQQAT = /^(diqqat|d|nazorat)$/i.test(String(process.argv[2] || ''));

function diqqatChop(h) {
  const n = h.nazorat;
  console.log('\n===== ДИҚҚАТ — тузатиш керак бўлган маълумотлар =====\n');
  if (n.dokonsizT && n.dokonsizT.length) {
    console.log('1) ДЎКОНГА БОҒЛАНМАГАН ФАОЛ ШАРТНОМАЛАР — ' + n.dokonsizT.length + ' та');
    console.log('   (қиймати, тўлови ва қарзи ҳисоботга УМУМАН кирмаяпти)\n');
    n.dokonsizT.forEach((x, i) => {
      console.log('   ' + (i + 1) + ') ' + x.no + '  ' + (x.fish || '— исми ёзилмаган —'));
      console.log('      Шартнома санаси: ' + (x.sana ? x.sana.split('-').reverse().join('.') : '—') + '   Ҳолати: ' + (x.holati || '—'));
      console.log('      03 даги дўкон: ' + (x.dokon || '— бўш —'));
      console.log('      Шартнома қиймати: ' + pul(x.qiymat) + '   Тўланган: ' + pul(x.tolangan) + '   Қарз: ' + pul(x.qarz));
      console.log('      САБАБИ: ' + x.sabab);
      console.log('');
    });
    const jq = n.dokonsizT.reduce((a, x) => a + x.qiymat, 0), jt = n.dokonsizT.reduce((a, x) => a + x.tolangan, 0), jz = n.dokonsizT.reduce((a, x) => a + x.qarz, 0);
    console.log('   ЖАМИ ҳисобга кирмаган: қиймат ' + pul(jq) + ' · тўлов ' + pul(jt) + ' · қарз ' + pul(jz) + '\n');
  } else console.log('1) Дўконга боғланмаган фаол шартнома йўқ ✅\n');

  console.log('2) 05_Tolovlar ↔ 03 «тўланган» фарқи: ' + pul(n.tolovFarq) + ' сўм' + (n.tolovFarq ? '' : ' ✅') + '\n');

  if (n.begonaRoyxat && n.begonaRoyxat.length) {
    console.log('3) БЕКОР ҚИЛИНГАН / НОТАНИШ ШАРТНОМАЛАРГА ЁЗИЛГАН ТЎЛОВЛАР — ' + n.begonaTolov + ' та · ' + pul(n.begonaSumma) + ' сўм');
    n.begonaRoyxat.forEach(x => console.log('      ' + String(x.no).padEnd(14) + String(x.soni + ' та').padStart(6) + '   ' + pul(x.summa).padStart(18)));
    console.log('');
  } else console.log('3) Бекор қилинган шартнома тўлови йўқ ✅\n');

  const q = [];
  if (n.qiymatsiz && n.qiymatsiz.length) q.push('Сотилган, лекин шартнома қиймати 0: ' + n.qiymatsiz.join(', '));
  if (n.bazasiz && n.bazasiz.length) q.push('Сотилмаган, лекин база нархи 0: ' + n.bazasiz.join(', '));
  if (n.maydonsiz && n.maydonsiz.length) q.push('Майдони 0 бўлган дўкон: ' + n.maydonsiz.join(', '));
  if (n.umumiyFarq) q.push('01 «умумий» ≠ база×майдон (сотилмаган): ' + n.umumiyFarq + ' та — ҳисоботда база×майдон олинди');
  if (n.kopDokonli && n.kopDokonli.length) q.push('Битта шартномага бир неча дўкон: ' + n.kopDokonli.map(x => x.no + ' → ' + x.dokonlar.join('/')).join('; '));
  console.log('4) Бошқа текширувлар: ' + (q.length ? '' : 'ҳаммаси жойида ✅'));
  q.forEach(x => console.log('      · ' + x));
  console.log('');
}

(async () => {
  const h = await T._ichki.hisobla();
  if (FAQAT_DIQQAT) { diqqatChop(h); await pool.end(); redis.disconnect(); process.exit(0); }
  const j = h.jami;
  console.log('\n===== ТАҲЛИЛИЙ МАЪЛУМОТ — ' + h.sana.split('-').reverse().join('.') + ' ҳолатида =====\n');
  console.log('УМУМИЙ:');
  L('Дўкон сони', j.soni);
  L('Майдони, m²', m2(j.maydon));
  L('Дўконларнинг умумий нархи', pul(j.summa));
  L('Сотилган дўконлардан жами тушум', pul(j.tushum));
  L('Сотилганларнинг қолган қарздорлиги', pul(j.qarz));
  L('Сотилмаган дўконларнинг қиймати', pul(j.bosQiymat));
  L('КУТИЛАЁТГАН УМУМИЙ САВДО', pul(h.kutilayotgan));

  console.log('\n1. СОТИЛГАН ДЎКОНЛАР:');
  L('Сони', j.sotSoni + ' та (' + Math.round(j.sotSoni / j.soni * 100) + '%)');
  L('Майдони, m²', m2(j.sotMaydon));
  L('Шартнома бўйича нархлари', pul(j.sotQiymat));
  L('Жами қилинган тўлов', pul(j.tushum));
  L('  — ҳисоб рақамга (банк)', pul(h.tolov.bank));
  L('  — пластик карта', pul(h.tolov.plastik));
  L('  — нақд тўлов', pul(h.tolov.naqd));
  L('  — бартер (товар/хизмат)', pul(h.tolov.barter));
  if (h.tolov.boshqa) L('  — бошқа шакл', pul(h.tolov.boshqa));
  if (h.tolov.korsatilmagan) L('  — шакли кўрсатилмаган', pul(h.tolov.korsatilmagan));
  L('  05_Tolovlar йиғиндиси', pul(h.tolov.jami));
  L('Жами қарздорлик', pul(j.qarz));
  L('  — муддати ўтган', pul(j.muddati));
  L('  — муддати келмаган', pul(j.qarz - j.muddati));

  console.log('\n2. БЎШ ДЎКОНЛАР:');
  L('Сотилмаган', j.bosSoni + ' та (' + Math.round(j.bosSoni / j.soni * 100) + '%)');
  L('Майдони, m²', m2(j.bosMaydon));
  L('Қиймати (прайс-лист база нархида)', pul(j.bosQiymat));
  L('  — қурилиши тугалланганлардан', h.tugal.bosSoni + ' та · ' + m2(h.tugal.bosMaydon) + ' m² · ' + pul(h.tugal.bosQiymat));
  L('  — қурилиши якунланмаганлардан', h.qurilayotgan.bosSoni + ' та · ' + m2(h.qurilayotgan.bosMaydon) + ' m² · ' + pul(h.qurilayotgan.bosQiymat));

  console.log('\n3. ҚУРИЛИШ ҲОЛАТИ БЎЙИЧА:');
  [h.tugal, h.qurilayotgan, j].forEach(o => {
    console.log('  ' + o.nom);
    L('    сони / майдони', o.soni + ' та · ' + m2(o.maydon) + ' m²');
    L('    сумма', pul(o.summa));
    L('    сотилган / майдони', o.sotSoni + ' та · ' + m2(o.sotMaydon) + ' m²');
    L('    сотилганлар қиймати', pul(o.sotQiymat));
    L('    тушум / қарздорлик', pul(o.tushum) + ' / ' + pul(o.qarz));
  });

  console.log('\n4. ҲУЖЖАТЛАШТИРИЛГАН ДЎКОНЛАР:');
  [h.hujBor, h.hujYoq].forEach(o => {
    L(o.nom, o.soni + ' та · ' + m2(o.maydon) + ' m²');
    L('    сумма / тўлов', pul(o.summa) + ' / ' + pul(o.tushum));
    L('    қолдиқ ва қарздорлик', pul(o.summa - o.tushum));
  });
  L('Жами қолдиқ ва қарздорлик', pul(h.hujBor.summa - h.hujBor.tushum + h.hujYoq.summa - h.hujYoq.tushum));

  console.log('\n----- ТЕКШИРУВ -----');
  L('Фаол сотув шартномалари', h.shartnoma.soni + ' та');
  L('Бекор қилинганлар', h.shartnoma.bekorSoni + ' та');
  L('03 даги шартнома қиймати йиғиндиси', pul(h.shartnoma.qiymat));
  L('03 даги «тўланган» йиғиндиси', pul(h.shartnoma.tolangan));
  L('03 даги қарз / муддати ўтган', pul(h.shartnoma.qarz) + ' / ' + pul(h.shartnoma.muddati));
  L('05 ↔ 03 тўлов фарқи', pul(h.nazorat.tolovFarq));
  console.log('  Қурилиш ҳолати устунидаги қийматлар:');
  Object.keys(h.nazorat.qurTurlari).forEach(k => L('    ' + k, h.nazorat.qurTurlari[k] + ' та'));
  diqqatChop(h);
  await pool.end(); redis.disconnect(); process.exit(0);
})().catch(e => { console.error('XATO: ' + e.message); process.exit(1); });
