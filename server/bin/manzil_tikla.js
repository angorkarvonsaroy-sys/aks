#!/usr/bin/env node
// AKS TIZIM — 02_Mijozlar Z «Toliq_manzil» ni N..S qismlaridan qayta yig'ish (01.11.2026, direktor roziligi bilan).
// Xato: yangi mijoz yozilganda Z yuqoridagi qatordan nusxalanardi — 02.10–30.10 da kiritilgan mijozlarda oldingi mijozning manzili turibdi.
// Qoida — lib/manzil.js (eski 262 qatorning hammasi shu bilan bir xil). Faqat Z yig'ilgani bilan FARQ qiladigan qatorlar tuzatiladi.
// Ishlatish: aks-manzil-tikla — ko'rsatadi (HECH NARSA YOZILMAYDI) · aks-manzil-tikla bajar — tuzatadi (+ 06j_Tahrir_jurnali ga yozadi)
'use strict';
process.env.AKS_ENV = process.env.AKS_ENV || '/opt/aks/.env';
const { pool, redis } = require('../lib/db');
const G = require('../lib/google');
const env = require('../lib/env');
const tetik = require('../lib/kozgu_tetik');
const MZ = require('../lib/manzil');

const VARAQ = '02_Mijozlar', JURNAL = '06j_Tahrir_jurnali', CHEGARA = 30;
const s = v => String(v == null ? '' : v);
const qisqa = (v, n) => { const t = s(v).trim(); return t.length > n ? t.slice(0, n - 1) + '…' : t; };

(async () => {
  const bajar = process.argv[2] === 'bajar', majburiy = process.argv.includes('--majburiy');
  console.log('========== 02_Mijozlar — «To\'liq manzil» (Z) tuzatish — ' + (bajar ? 'TUZATILMOQDA' : 'KO\'RISH (hech narsa yozilmaydi)') + ' ==========');
  const R = await G.oraliqOqi(env.aksBazaId, VARAQ, 'A1:Z', env.googleKey, 'UNFORMATTED_VALUE');
  const h = R[0] || [];
  if (s(h[13]).trim() !== 'Manzil_viloyat' || s(h[18]).trim() !== 'Xonadon' || s(h[25]).trim() !== 'Toliq_manzil') {
    console.log('⚠ Sarlavhalar kutilganidek emas (N «' + s(h[13]) + '», S «' + s(h[18]) + '», Z «' + s(h[25]) + '») — to\'xtatildi, Claude\'ga ko\'rsating.');
    await pool.end(); redis.disconnect(); process.exit(1);
  }
  let jami = 0, mos = 0;
  const T = [];
  for (let i = 1; i < R.length; i++) {
    const r = R[i] || []; if (!s(r[0]).trim()) continue;
    jami++;
    const yangi = MZ.qatordan(r), eski = s(r[25]).trim();
    if (!yangi) continue;   // qismlari bo'sh — tegilmaydi
    if (yangi === eski) { mos++; continue; }
    T.push({ qator: i + 1, id: s(r[0]).trim(), fish: s(r[2]).trim(), sana: r[21], eski, yangi });
  }
  console.log('\nMijozlar: ' + jami + ' · to\'g\'ri: ' + mos + ' · tuzatiladi: ' + T.length + '\n');
  T.forEach(z => console.log('  • ' + z.qator + '-qator (ID ' + z.id + ', ' + qisqa(z.fish, 28) + ')\n      hozir: ' + qisqa(z.eski, 90) + '\n      to\'g\'ri: ' + z.yangi));
  if (!T.length) { console.log('Tuzatiladigan qator yo\'q — hammasi to\'g\'ri.'); await pool.end(); redis.disconnect(); process.exit(0); }
  if (!bajar) { console.log('\nHech narsa yozilmadi. Tuzatish uchun: aks-manzil-tikla bajar'); await pool.end(); redis.disconnect(); process.exit(0); }
  if (T.length > CHEGARA && !majburiy) {
    console.log('\n⚠ ' + T.length + ' ta qator — kutilganidan (17) ancha ko\'p. Yozilmadi. Ro\'yxatni Claude\'ga ko\'rsating.');
    await pool.end(); redis.disconnect(); process.exit(1);
  }
  // 1) Z kataklari — RAW (talqinsiz matn)
  await G.xomYoz(env.aksBazaId, T.map(z => ({ varaq: VARAQ, qator: z.qator, ustun: 26, qiymat: z.yangi })), env.googleKey);
  // 2) tekshirish
  const Z = await G.oraliqOqi(env.aksBazaId, VARAQ, 'Z1:Z', env.googleKey, 'UNFORMATTED_VALUE');
  const ok = T.filter(z => s((Z[z.qator - 1] || [])[0]).trim() === z.yangi).length;
  console.log('\n' + (ok === T.length ? '✅' : '⚠') + ' Tuzatildi: ' + ok + ' / ' + T.length + (ok === T.length ? '' : ' — FARQ BOR, Claude\'ga ko\'rsating'));
  // 3) 06j_Tahrir_jurnali — har qator uchun bitta yozuv (direktor «Nazorat jurnallari» da ko'radi)
  try {
    const A = await G.ustunOqi(env.aksBazaId, JURNAL, 'A', env.googleKey);
    let id = Math.max(0, ...A.slice(1).map(v => Number(v) || 0));
    const d = new Date(Date.now() + 5 * 3600 * 1000), p = n => String(n).padStart(2, '0');
    const vaqt = p(d.getUTCDate()) + '.' + p(d.getUTCMonth() + 1) + '.' + d.getUTCFullYear() + ' ' + p(d.getUTCHours()) + ':' + p(d.getUTCMinutes());
    const L = T.map(z => [++id, vaqt, '', 'Mijoz', z.id, 'To\'liq manzil (Z)', z.eski || '—', z.yangi, 'Tizim (direktor roziligi)', 'aks-manzil-tikla: oldingi mijoz manzili ko\'chib qolgan edi']);
    await G.qatorlarQoshR(env.aksBazaId, JURNAL, A.length + 1, L, env.googleKey);
    console.log('📒 06j_Tahrir_jurnali ga ' + L.length + ' ta yozuv qo\'shildi.');
  } catch (e) { console.log('⚠ Jurnalga yozilmadi: ' + e.message + ' (Z kataklari tuzatilgan)'); }
  try { await Promise.race([tetik.varaqlarYangila([VARAQ, JURNAL]), new Promise(r => setTimeout(r, 25000))]); } catch (e) { }
  try { await redis.lpush('qaror_jurnal', new Date().toISOString() + ' manzil tuzatildi (02 Z): ' + T.map(z => z.qator).join(', ')); } catch (e) { }
  await pool.end(); redis.disconnect(); process.exit(0);
})().catch(async e => { console.error('XATO:', e.message); try { await pool.end(); redis.disconnect(); } catch (z) { } process.exit(1); });
