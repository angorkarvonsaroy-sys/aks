#!/usr/bin/env node
// aks-tg — serverdagi Telegram (lib/telegram.js) holati va sinovi. Ishlatish:
//   aks-tg            — TG_TOKEN bormi, bot nomi (getMe), direktorlar Telegram ID soni, oxirgi 10 so'rov (rpc_jurnal qayerda='tg')
//   aks-tg sinov      — direktor(lar)ga «🧪 Sinov» xabari (haqiqiy yuboriladi — faqat direktorga)
//   aks-tg guruh      — hisobot guruhiga (TG_GURUH) «🧪 Sinov» xabari
//   aks-tg yoq / ochir — 2-qadam: serverdagi Telegram chaqiruvlari (koprikTgYubor/TgChat/TgGuruh/Tg/DevonTg) to'g'ridan-to'g'ri / Koprik orqali (bayroq yozuv_yondi:tg)
'use strict';
process.env.AKS_ENV = process.env.AKS_ENV || '/opt/aks/.env';
const { pool, redis, q } = require('../lib/db');
const TG = require('../lib/telegram');
const env = require('../lib/env');
(async () => {
  const arg = process.argv[2];
  console.log('================ 📱 TELEGRAM (serverdan) ================');
  console.log('TG_TOKEN (.env): ' + (TG.bor() ? 'bor (' + env.tgToken.length + ' belgi, oxiri …' + env.tgToken.slice(-4) + ')' : 'YO\'Q — Telegram avvalgidek Koprik orqali') + ' · TG_GURUH: ' + (env.tgGuruh ? 'bor' : 'yo\'q'));
  const bay = (await redis.get('yozuv_yondi:tg')) === '1';
  console.log('Xabarlar yo\'li (yozuv_yondi:tg): ' + (bay ? '🟢 SERVERDAN to\'g\'ridan-to\'g\'ri' : '⚪ Koprik orqali (eski tizim)') + ' · hali Koprik\'da: tasdiq tugmalari (koprikTopTasdiqTg, koprikXatTasdiqTg)');
  if (arg === 'yoq') { if (!TG.bor()) { console.log('✖ TG_TOKEN yo\'q — yoqib bo\'lmaydi.'); } else { await redis.set('yozuv_yondi:tg', '1'); console.log('✅ YOQILDI — endi Telegram xabarlari serverdan to\'g\'ridan-to\'g\'ri (eski tizim tegilmaydi; qaytarish: aks-tg ochir).'); } }
  if (arg === 'ochir') { await redis.del('yozuv_yondi:tg'); console.log('⛔ O\'CHIRILDI — xabarlar yana Koprik orqali.'); }
  if (!TG.bor()) { await pool.end(); redis.disconnect(); process.exit(0); }
  try { const m = await TG.men(); console.log('Bot: @' + m.username + ' (' + m.first_name + ')'); } catch (e) { console.log('Bot: ✖ ' + e.message); }
  const D = await TG.direktorlar(); console.log('Direktorlar (07_Xodimlar: admin + Ishlayapti + Telegram): ' + D.length + ' ta');
  if (arg === 'sinov') { const t0 = Date.now(); const n = await TG.direktor('🧪 <b>Sinov</b> — bu xabar serverdan TO\'G\'RIDAN-TO\'G\'RI keldi (Koprik orqali emas). ' + new Date().toLocaleString('ru-RU', { timeZone: 'Asia/Tashkent' }));
    console.log('✅ Direktorga yuborildi: ' + n + ' ta chat (' + ((Date.now() - t0) / 1000).toFixed(1) + ' s)'); }
  else if (arg === 'guruh') { const t0 = Date.now(); await TG.guruh('🧪 <b>Sinov</b> — hisobot guruhiga serverdan to\'g\'ridan-to\'g\'ri. ' + new Date().toLocaleString('ru-RU', { timeZone: 'Asia/Tashkent' }));
    console.log('✅ Guruhga yuborildi (' + ((Date.now() - t0) / 1000).toFixed(1) + ' s)'); }
  const J = (await q("SELECT to_char(vaqt,'DD.MM HH24:MI:SS') v, fn, ms, ok, xato FROM rpc_jurnal WHERE qayerda='tg' ORDER BY vaqt DESC LIMIT 10")).rows;
  if (J.length) { console.log('\n--- Oxirgi Telegram so\'rovlari (serverdan) ---'); J.forEach(r => console.log('  ' + r.v + '  ' + r.fn.padEnd(22) + (r.ok ? '✅' : '✖ ' + r.xato) + '  ' + (r.ms / 1000).toFixed(1) + ' s')); }
  await pool.end(); redis.disconnect(); process.exit(0);
})().catch(async e => { console.error('XATO:', e.message); try { await pool.end(); redis.disconnect(); } catch (z) { } process.exit(1); });
