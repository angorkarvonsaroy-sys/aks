#!/usr/bin/env node
// AKS TIZIM — serverdagi yozuv bayroqlari (yozuv_yondi:*) ni ko'rish va boshqarish.
//   aks-bayroq                 — hamma bayroqlar: amaldagi holat (🟢 serverda / ⚪ eski tizimda) va Redis'dagi qiymati
//   aks-bayroq yoq <nom>       — yoqish  (o'sha amal serverda bajariladi)
//   aks-bayroq ochir <nom>     — o'chirish (eski tizimga qaytadi) — Redis'ga '0' yoziladi
// 02.11.2026 dan standart holat kodda (lib/bayroq.js): Redis'da kalit bo'lmasa ham sinovdan o'tgan amal serverda bajariladi.
'use strict';
process.env.AKS_ENV = process.env.AKS_ENV || '/opt/aks/.env';
const { redis } = require('../lib/db');
const BQ = require('../lib/bayroq');
process.stdout.on('error', e => { if (e.code === 'EPIPE') process.exit(0); });   // «| head» ro'yxatni uzsa — xato chiqmasin

const NOM = /^[a-z0-9_]{2,40}$/;
(async () => {
  const amal = (process.argv[2] || '').trim(), nom = (process.argv[3] || '').trim();
  if (amal === 'yoq' || amal === 'ochir') {
    if (!NOM.test(nom)) { console.log('Bayroq nomi noto\'g\'ri. Masalan: aks-bayroq yoq bekor_tasdiq'); process.exit(1); }
    if (amal === 'yoq') { await BQ.yoq('yozuv', nom); console.log('✅ yozuv_yondi:' + nom + ' — YOQILDI (bu amal endi serverda bajariladi).'); }
    else { await BQ.ochir('yozuv', nom); console.log('⛔ yozuv_yondi:' + nom + ' — O\'CHIRILDI (eski tizimga qaytdi).'); }
  }
  const redisda = (await redis.keys('yozuv_yondi:*')).map(k => k.replace('yozuv_yondi:', ''));
  const K = [...new Set(BQ.YOZUV_NOMLAR.concat(redisda))].sort();
  let y = 0;
  console.log('\n================ YOZUV BAYROQLARI (' + K.length + ' ta) ================');
  for (const n of K) {
    const v = await redis.get('yozuv_yondi:' + n), on = await BQ.yozuv(n); if (on) y++;
    const izoh = v === '1' ? '' : v === '0' ? '   (ataylab o\'chirilgan)' : '   (Redis\'da yo\'q — standart: ' + (BQ.yozuvStandart(n) ? 'yoniq' : 'o\'chiq') + ')';
    console.log((on ? ' 🟢 ' : ' ⚪ ') + n + izoh + (BQ.YOZUV_NOMLAR.includes(n) ? '' : '   (kodda yo\'q — eski kalit)'));
  }
  console.log('\nServerda: ' + y + ' · eski tizimda: ' + (K.length - y));
  console.log('Yoqish: aks-bayroq yoq <nom> · O\'chirish: aks-bayroq ochir <nom>');
  process.exit(0);
})().catch(e => { console.error('Xato:', e.message); process.exit(1); });
