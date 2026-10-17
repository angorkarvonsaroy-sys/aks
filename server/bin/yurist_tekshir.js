#!/usr/bin/env node
// AKS TIZIM — yurist bo'limi serverda to'liq ishlashga tayyormi: (1) robot jadvalga yoza oladimi, (2) Koprik.gs v1.2 o'rnatilganmi.
// Hech narsa o'zgartirmaydi (06f sarlavhasini o'z qiymati bilan qayta yozadi). Ishlatish: aks-yurist
'use strict';
process.env.AKS_ENV = process.env.AKS_ENV || '/opt/aks/.env';
const env = require('../lib/env');
const G = require('../lib/google');
const koprik = require('../api/koprik');
const { q, pool, redis } = require('../lib/db');

(async () => {
  console.log('=== Yurist bo\'limi — tekshiruv ===');
  try {
    const a1 = await G.qatorOqi(env.aksBazaId, '06f_Yurist_tarix', 1, 'A', env.googleKey);
    await G.yoz(env.aksBazaId, [{ varaq: '06f_Yurist_tarix', katak: 'A1', qiymat: [[a1[0] == null ? 'Vaqt' : a1[0]]] }], env.googleKey);
    console.log('✅ Robot jadvalga yoza oladi (Редактор).');
  } catch (e) { console.log('❌ Robot jadvalga yoza olmaydi: ' + e.message); }
  try {
    const r = (await q(`SELECT kirish_kodi FROM v_xodimlar WHERE holat='Ishlayapti' AND 'yurist' = ANY(huquqlar) LIMIT 1`)).rows[0]
      || (await q(`SELECT kirish_kodi FROM v_xodimlar WHERE holat='Ishlayapti' AND 'admin' = ANY(huquqlar) LIMIT 1`)).rows[0];
    const t0 = Date.now(); const v = await koprik.chaqir('koprikVersiya', r.kirish_kodi, []);
    console.log((String(v) >= '1.2' ? '✅' : '❌') + ' Koprik.gs versiyasi: ' + v + ' (' + (Date.now() - t0) + ' ms)');
  } catch (e) { console.log('❌ Koprik.gs v1.2 topilmadi: ' + e.message); }
  await pool.end(); redis.disconnect(); process.exit(0);
})().catch(e => { console.error('XATO:', e.message); process.exit(1); });
