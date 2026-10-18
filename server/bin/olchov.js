#!/usr/bin/env node
// AKS TIZIM — sekin amalni o'lchash (hozircha: monBoshlang — 👔 direktor monitoringi). Ishlatish: aks-olchov
// 1) so'nggi 3 kundagi chaqiruvlar: qancha vaqt, o'sha payt server yana nima bilan band edi;
// 2) alohida jarayonda bo'lak-bo'lak o'lchash: har varaqni o'qish, portfel, monitoring qismlari, to'liq javob (sovuq va iliq), javob hajmi.
'use strict';
process.env.AKS_ENV = process.env.AKS_ENV || '/opt/aks/.env';
const { pool, redis, q } = require('../lib/db');
const V = require('../lib/varaq');
const S = require('../api/sessiya');
const P = require('../lib/portfel');
const M = require('../api/monitoring');
const J = require('../lib/jurnallar');
const { Q } = require('../api/yurist');
const TS = require('../lib/tasdiq');

const vaqt = async (nom, f) => { const t0 = Date.now(); const r = await f(); const ms = Date.now() - t0; console.log('  ' + nom.padEnd(34) + String(ms).padStart(7) + ' ms'); return r; };
(async () => {
  console.log('================ O\'LCHOV: monBoshlang (direktor monitoringi) ================');
  // 0) ilova serveri holati
  try { const L = JSON.parse(require('child_process').execSync('pm2 jlist', { env: Object.assign({}, process.env, { PM2_HOME: '/home/aks/.pm2' }), stdio: ['ignore', 'pipe', 'ignore'] }).toString());
    L.filter(x => x.name === 'aks-api').forEach(x => console.log('aks-api: qayta ishga tushgan ' + x.pm2_env.restart_time + ' marta · ishlayapti ' + Math.round((Date.now() - x.pm2_env.pm_uptime) / 60000) + ' daqiqadan beri · xotira ' + Math.round(x.monit.memory / 1048576) + ' MB · CPU ' + x.monit.cpu + '%')); } catch (e) { console.log('pm2: ' + e.message.split('\n')[0]); }
  // 1) so'nggi chaqiruvlar
  const R = (await q("SELECT id, to_char(vaqt AT TIME ZONE 'Asia/Tashkent','DD.MM HH24:MI:SS') t, vaqt, ms, ok FROM rpc_jurnal WHERE fn = 'monBoshlang' AND vaqt > now() - interval '3 days' ORDER BY id")).rows;
  console.log('\n1) Chaqiruvlar (3 kun): ' + R.length + ' ta');
  for (const r of R) {
    const o = (await q("SELECT fn, count(*) n, max(ms) mx FROM rpc_jurnal WHERE id <> $1 AND vaqt > $2::timestamptz - ($3 || ' milliseconds')::interval AND vaqt - (ms || ' milliseconds')::interval < $2::timestamptz GROUP BY fn ORDER BY count(*) DESC LIMIT 4", [r.id, r.vaqt, r.ms])).rows;
    console.log('  ' + r.t + '  ' + String(r.ms).padStart(6) + ' ms' + (r.ok ? '' : ' XATO') + (o.length ? '  · shu payt: ' + o.map(x => x.fn + '×' + x.n + (x.mx > 5000 ? '(' + Math.round(x.mx / 1000) + 's)' : '')).join(', ') : ''));
  }
  // 2) bo'laklar
  const adm = (await q("SELECT fish, kirish_kodi FROM v_xodimlar WHERE kompaniya_id = 1 AND 'admin' = ANY(huquqlar) AND holat = 'Ishlayapti' LIMIT 1")).rows[0] || { fish: 'Direktor', kirish_kodi: '' };
  S.ruxsat = async () => ({ admin: true, huquq: ['admin'], fish: adm.fish, kod: adm.kirish_kodi });
  const varaqlar = (await q("SELECT varaq, count(*) n, sum(length(data::text) + length(coalesce(korinish::text,''))) b FROM kozgu.qatorlar WHERE kompaniya_id = 1 GROUP BY varaq ORDER BY 3 DESC")).rows;
  console.log('\n2) Varaqlarni o\'qish (sovuq, eng kattalari):');
  V.tozala();
  for (const v of varaqlar.slice(0, 14)) await vaqt(v.varaq + ' (' + v.n + ' qator, ' + Math.round(v.b / 1024) + ' KB)', () => V.qatorlar(v.varaq));
  const I = M._ichki;
  console.log('\n3) Qismlar (varaqlar xotirada — iliq):');
  const Pf = await vaqt('undPortfel', () => P.undPortfel(() => true, adm.kirish_kodi));
  await vaqt('monAktiv', () => I.monAktiv());
  await vaqt('J.yuIshlar', () => J.yuIshlar());
  await vaqt('Q.yuKesh', () => Q.yuKesh());
  await vaqt('TS.tasdiqNavbat', () => TS.tasdiqNavbat());
  await vaqt('TS.skanNazNavbat', () => TS.skanNazNavbat());
  await vaqt('TS.tqKorilmagan', () => TS.tqKorilmagan());
  await vaqt('bekorSorovlar', () => I.bekorSorovlar(V.bugun()));
  const D = await vaqt('monMalumot (hammasi)', () => I.monMalumot(V.bugun(), Pf, adm.kirish_kodi));
  await vaqt('monNavbat', async () => I.monNavbat(D));
  await vaqt('monTasdiqlar', async () => I.monTasdiqlar(D));
  await vaqt('monXodimlar', () => I.monXodimlar(D));
  await vaqt('monJurnallar', async () => I.monJurnallar(D));
  console.log('\n4) To\'liq monBoshlang:');
  V.tozala(); const r1 = await vaqt('sovuq (varaqlar bazadan)', () => M.monBoshlang(['x']));
  const r2 = await vaqt('iliq (20 s ichida qayta)', () => M.monBoshlang(['x']));
  const js = JSON.stringify(r2); await vaqt('JSON (' + Math.round(js.length / 1024) + ' KB)', async () => JSON.stringify(r1));
  const qism = Object.keys(r2).map(k => k + ' ' + Math.round(JSON.stringify(r2[k]).length / 1024) + ' KB').join(' · ');
  console.log('  javob qismlari: ' + qism);
  await pool.end(); redis.disconnect(); process.exit(0);
})().catch(async e => { console.error('XATO:', e.stack || e.message); try { await pool.end(); redis.disconnect(); } catch (z) { } process.exit(1); });
