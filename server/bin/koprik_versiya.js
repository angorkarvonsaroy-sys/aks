#!/usr/bin/env node
// aks-koprik — eski tizimdagi Koprik versiyasi (koprikVersiya) va ko'prik holati
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
  await pool.end(); redis.disconnect(); process.exit(0);
})().catch(async e => { console.error('XATO:', e.message); try { await pool.end(); redis.disconnect(); } catch (z) { } process.exit(1); });
