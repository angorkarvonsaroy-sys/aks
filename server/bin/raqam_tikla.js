#!/usr/bin/env node
// AKS TIZIM — «27/8» kabi shartnoma raqami SANAGA aylanib qolgan kataklarni topish va tiklash (23.10.2026).
// Shartnoma raqami ustunlari (24 ta) Google'dan YANGI o'qiladi (getValues kabi): son (sana seriyasi) turgan katak — buzilgan. Kuni 27 bo'lsa → «27/<oy>»
// (masalan 27.08.2026 → 27/8). Kuni 27 bo'lmasa — «noma'lum», tegilmaydi. Tiklash RAW (talqinsiz) — matn bo'lib yoziladi.
// Ishlatish: aks-raqam-tikla — ko'rsatadi (HECH NARSA YOZILMAYDI) · aks-raqam-tikla bajar — tiklaydi
'use strict';
process.env.AKS_ENV = process.env.AKS_ENV || '/opt/aks/.env';
const { pool, redis } = require('../lib/db');
const G = require('../lib/google');
const env = require('../lib/env');
const V = require('../lib/varaq');
const tetik = require('../lib/kozgu_tetik');

const USTUNLAR = [   // [varaq, ustun, sarlavha (tekshiriladi), izoh uchun ustunlar]
  ['01_Dokonlar', 'R', 'Sotuv_shartnoma_№'], ['03_Sotuv_shartnomalar', 'A', 'Shartnoma_№'], ['03b_Tolov_jadvali', 'B', 'Shartnoma_№'], ['03b_ochirilgan_qoldiq', 'B', 'Shartnoma_№'],
  ['04_Ijara_shartnomalar', 'AB', 'Sotuv_shartnoma_№'], ['05_Tolovlar', 'C', 'Shartnoma_№'], ['05_Tolovlar', 'H', 'Solidar_shartnoma'], ['05_Tolovlar', 'I', 'Kochirilgan_shartnoma'],
  ['05b_Bufer_tolovlar', 'C', 'Shartnoma_№'], ['06_Undiruv_jurnali', 'C', 'Shartnoma_№'], ['06b_Yuridik_ishlar', 'B', 'Shartnoma_№'], ['06c_Faollashtirish_jurnali', 'C', 'Shartnoma_№'],
  ['06d_Hujjatlar', 'B', 'Shartnoma_№'], ['06e_Xatlar', 'C', 'Shartnoma_№'], ['06f_Yurist_tarix', 'C', 'Shartnoma_№'], ['06g_Yuridik_xatlar', 'D', 'Shartnoma_№'],
  ['06h_Bekor_sorovlari', 'B', 'Shartnoma_№'], ['06k_Qayta_tuzish', 'D', 'Eski_№'], ['06k_Qayta_tuzish', 'E', 'Yangi_№'], ['06n_Qadam_kun', 'C', 'Shartnoma'],
  ['06p_Tekshiruv', 'E', 'Shartnoma'], ['06q_Qoidabuzarlik', 'H', 'Shartnoma'], ['06t_Tasdiq_qarorlari', 'E', 'Shartnoma'], ['10_Topshiriqlar', 'H', 'Shartnoma']];
const s = v => String(v == null ? '' : v);
const ustunN = h => h.split('').reduce((a, c) => a * 26 + c.charCodeAt(0) - 64, 0);

(async () => {
  const bajar = process.argv[2] === 'bajar';
  console.log('================ «27/8» → SANA bo\'lib qolgan shartnoma raqamlari — ' + (bajar ? 'TIKLANMOQDA' : 'KO\'RISH (hech narsa yozilmaydi)') + ' ================');
  const T = [], N = [], X = [];
  for (const [varaq, u, sar] of USTUNLAR) {
    let R, A = [];   // Google: daqiqasiga 60 o'qish — A ustuni faqat buzilgan katak bo'lsa o'qiladi
    try { R = await G.oraliqOqi(env.aksBazaId, varaq, u + '1:' + u, env.googleKey, 'UNFORMATTED_VALUE');
      if (R.some((r, i) => i > 0 && typeof (r || [])[0] === 'number')) A = await G.oraliqOqi(env.aksBazaId, varaq, 'A1:A', env.googleKey, 'UNFORMATTED_VALUE'); }
    catch (e) { X.push(varaq + ' ' + u + ': o\'qib bo\'lmadi — ' + e.message); continue; }
    if (s((R[0] || [])[0]).trim() !== sar) { X.push(varaq + ' ' + u + ': sarlavha «' + s((R[0] || [])[0]) + '» (kutilgan «' + sar + '») — o\'tkazib yuborildi'); continue; }
    R.forEach((r, i) => { const v = (r || [])[0]; if (i === 0 || typeof v !== 'number') return;
      const iso = V.iso(v), id = s((A[i] || [])[0]);
      if (iso && iso.slice(8, 10) === '27') T.push({ varaq, u, qator: i + 1, id, eski: iso.split('-').reverse().join('.'), yangi: '27/' + Number(iso.slice(5, 7)) });
      else N.push({ varaq, u, qator: i + 1, id, v, iso }); });
  }
  console.log('\nTiklanadigan kataklar: ' + T.length + ' ta');
  T.forEach(z => console.log('  • ' + z.varaq + ' ' + z.u + z.qator + ' (ID ' + z.id + '): ' + z.eski + ' → ' + z.yangi));
  if (N.length) { console.log('\n⚠ Son turgan, lekin kuni 27 emas (TEGILMAYDI, ko\'rib chiqish kerak): ' + N.length + ' ta');
    N.slice(0, 20).forEach(z => console.log('  • ' + z.varaq + ' ' + z.u + z.qator + ' (ID ' + z.id + '): ' + z.v + (z.iso ? ' (' + z.iso + ')' : ''))); }
  X.forEach(x => console.log('  ℹ ' + x));
  if (!bajar) console.log('\nHech narsa yozilmadi. Tiklash uchun: aks-raqam-tikla bajar');
  else if (T.length) {
    await G.xomYoz(env.aksBazaId, T.map(z => ({ varaq: z.varaq, qator: z.qator, ustun: ustunN(z.u), qiymat: z.yangi })), env.googleKey);
    let ok = 0; const C = {};   // tekshirish — har ustun bir marta o'qiladi
    for (const z of T) { const k = z.varaq + '|' + z.u; if (!C[k]) C[k] = await G.oraliqOqi(env.aksBazaId, z.varaq, z.u + '1:' + z.u, env.googleKey, 'UNFORMATTED_VALUE');
      if (s(((C[k][z.qator - 1] || [])[0])) === z.yangi) ok++; }
    console.log('\n' + (ok === T.length ? '✅' : '⚠') + ' Tiklandi: ' + ok + ' / ' + T.length + (ok === T.length ? ' — hammasi matn bo\'lib turibdi' : ' — FARQ BOR, Claude\'ga ko\'rsating'));
    const vq = [...new Set(T.map(z => z.varaq))];
    try { await Promise.race([tetik.varaqlarYangila(vq), new Promise(r => setTimeout(r, 25000))]); } catch (e) { }
    try { await redis.lpush('qaror_jurnal', new Date().toISOString() + ' raqam tiklandi: ' + T.map(z => z.varaq + '!' + z.u + z.qator + '=' + z.yangi).join(', ')); } catch (e) { }
  } else console.log('\nTiklanadigan katak yo\'q.');
  await pool.end(); redis.disconnect(); process.exit(0);
})().catch(async e => { console.error('XATO:', e.message); try { await pool.end(); redis.disconnect(); } catch (z) { } process.exit(1); });
