#!/usr/bin/env node
// AKS TIZIM — serverdagi yozuv bayroqlari (Redis yozuv_yondi:*) ni ko'rish va boshqarish.
//   aks-bayroq                 — hamma bayroqlar ro'yxati (yoqilgan / o'chiq)
//   aks-bayroq yoq <nom>       — yoqish  (o'sha amal serverda bajariladi)
//   aks-bayroq ochir <nom>     — o'chirish (eski tizimga qaytadi)
// «aks-yozuv-sinov» bilan sinalmaydigan, alohida yoqiladigan amallar uchun (masalan bekor_tasdiq).
'use strict';
process.env.AKS_ENV = process.env.AKS_ENV || '/opt/aks/.env';
const { redis } = require('../lib/db');
process.stdout.on('error', e => { if (e.code === 'EPIPE') process.exit(0); });   // «| head» ro'yxatni uzsa — xato chiqmasin

// kodda bor, lekin Redis'da yo'q bo'lishi mumkin bo'lgan bayroqlar (o'chiq holda ham ko'rinsin)
const QOSHIMCHA = ['bekor_tasdiq'];

const NOM = /^[a-z0-9_]{2,40}$/;
(async () => {
  const amal = (process.argv[2] || '').trim(), nom = (process.argv[3] || '').trim();
  if (amal === 'yoq' || amal === 'ochir') {
    if (!NOM.test(nom)) { console.log('Bayroq nomi noto\'g\'ri. Masalan: aks-bayroq yoq bekor_tasdiq'); process.exit(1); }
    if (amal === 'yoq') { await redis.set('yozuv_yondi:' + nom, '1'); console.log('✅ yozuv_yondi:' + nom + ' — YOQILDI (bu amal endi serverda bajariladi).'); }
    else { await redis.del('yozuv_yondi:' + nom); console.log('⛔ yozuv_yondi:' + nom + ' — O\'CHIRILDI (eski tizimga qaytdi).'); }
  }
  const bor = await redis.keys('yozuv_yondi:*');
  QOSHIMCHA.forEach(n => { if (bor.indexOf('yozuv_yondi:' + n) < 0) bor.push('yozuv_yondi:' + n); });
  const K = bor.sort();
  console.log('\n================ YOZUV BAYROQLARI (' + K.length + ' ta) ================');
  for (const k of K) console.log((((await redis.get(k)) === '1') ? ' 🟢 ' : ' ⚪ ') + k.replace('yozuv_yondi:', ''));
  console.log('\nYoqish: aks-bayroq yoq <nom> · O\'chirish: aks-bayroq ochir <nom>');
  process.exit(0);
})().catch(e => { console.error('Xato:', e.message); process.exit(1); });
