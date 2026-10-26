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

(async () => {
  const h = await T.hisobla();
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
  L('Дўконга боғланмаган фаол шартнома', h.nazorat.dokonsiz.length + ' та' + (h.nazorat.dokonsiz.length ? ': ' + h.nazorat.dokonsiz.slice(0, 12).join(', ') : ''));
  L('Бир шартнома — бир неча дўкон', h.nazorat.kopDokonli.length + ' та');
  h.nazorat.kopDokonli.slice(0, 10).forEach(k => console.log('      ' + k.no + ' → ' + k.dokonlar.join(', ')));
  L('Бекор/нотаниш шартнома тўловлари', h.nazorat.begonaTolov + ' та · ' + pul(h.nazorat.begonaSumma));
  console.log('  Қурилиш ҳолати устунидаги қийматлар:');
  Object.keys(h.nazorat.qurTurlari).forEach(k => L('    ' + k, h.nazorat.qurTurlari[k] + ' та'));
  console.log('');
  await pool.end(); redis.disconnect(); process.exit(0);
})().catch(e => { console.error('XATO: ' + e.message); process.exit(1); });
