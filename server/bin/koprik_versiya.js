#!/usr/bin/env node
// aks-koprik — eski tizimdagi Koprik versiyasi (koprikVersiya) va ko'prik holati
// 02.11.2026: + qaysi bo'limlar eski tizimsiz ishlaydi (yordamchilarni server o'zi bajaradi — lib/versiya.js serverOzi)
'use strict';
process.env.AKS_ENV = process.env.AKS_ENV || '/opt/aks/.env';
const { pool, redis } = require('../lib/db');
const koprik = require('../api/koprik');
const VQ = require('../lib/vaqt');
(async () => {
  const kod = await VQ.adminKod();
  const t0 = Date.now(); let v;
  try { v = String(await koprik.chaqir('koprikVersiya', kod, [])); } catch (e) { v = 'XATO: ' + e.message; }
  console.log('Koprik versiyasi (eski tizim): ' + v + '  (' + ((Date.now() - t0) / 1000).toFixed(1) + ' s)');
  const kerak = process.argv[2];
  if (kerak) console.log(require('../lib/versiya').verOk(v, kerak) ? '✅ ' + kerak + ' yoki yangiroq — yangi funksiyalar ishlaydi.' : '✖ ' + kerak + ' kerak edi — Apps Script\'da «Новая версия» qilinganini tekshiring.');
  const { serverOzi, BOLIMLAR: B } = require('../lib/versiya');
  console.log('\nEski tizim javob bermasa ham serverda ishlaydimi:');
  let n = 0;
  for (const [nom, L] of B) { const ha = await serverOzi(L); if (ha) n++; console.log('  ' + (ha ? '✅' : '⚠') + ' ' + nom + (ha ? '' : ' — hali eski tizim versiyasiga bog\'liq (arxiv yoki Telegram o\'chiq)')); }
  console.log(n === B.length ? '✅ Hammasi (' + n + '/' + B.length + ') — eski tizim kerak emas.' : '⚠ ' + n + '/' + B.length);
  await pool.end(); redis.disconnect(); process.exit(0);
})().catch(async e => { console.error('XATO:', e.message); try { await pool.end(); redis.disconnect(); } catch (z) { } process.exit(1); });
