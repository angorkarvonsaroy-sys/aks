#!/usr/bin/env node
// aks-tasdiq-qaror — 🔎 isbot qarori (✅ tasdiq / ✖ qaytarish, 👍 to'g'ri qaytargan) serverning o'zida (Telegram 3b). Ishlatish:
//   aks-tasdiq-qaror             — holat: bayroq, tekshiruvdagi isbotlar soni, 06t oxirgi 5 qaror
//   aks-tasdiq-qaror sinov [k]   — QURUQ: tekshiruvdagi bitta isbot (k — t<ID> | x<raqam> | n<ID>; berilmasa — yurist navbatidagi birinchisi) uchun ✅ va ✖ qarori
//                                  nima yozishi / kimga nima yuborishi ko'rsatiladi. Hech narsa yozilmaydi va yuborilmaydi.
//   aks-tasdiq-qaror tikla [ID]  — QURUQ: «↩ Isbotni tiklash» (06t dagi yurist qaytargan, direktor ko'rmagan qaror; ID berilmasa — eng oxirgisi) nima qilishi
//   aks-tasdiq-qaror yoq / ochir — yozuv_yondi:tasdiq_qaror (yoqilganda navbat va eski tasdiqQil ishlatilmaydi)
'use strict';
process.env.AKS_ENV = process.env.AKS_ENV || '/opt/aks/.env';
const { pool, redis } = require('../lib/db');
const TT = require('../lib/tg_tasdiq');
const TQ = require('../api/tasdiq_qaror')._ichki;
const TS = require('../lib/tasdiq');
const J = require('../lib/jurnallar');
const s = v => String(v == null ? '' : v);
const tugat = async k => { try { await pool.end(); redis.disconnect(); } catch (e) { } process.exit(k || 0); };
function chop(log) { log.forEach(z => { if (z.yozuv) console.log('     📝 ' + z.yozuv); else console.log('     ✉ ' + z.metod + ' → ' + z.chat + (z.fayl ? ' 📎 ' + z.fayl : '') + (z.tugma ? ' [' + z.tugma + ']' : '') + '\n        «' + s(z.matn).replace(/\n/g, '\n        ') + '»'); }); }
(async () => {
  const arg = process.argv[2];
  console.log('================ 🔎 ISBOT QARORI (serverda) ================');
  const b = (await redis.get('yozuv_yondi:tasdiq_qaror')) === '1', tg = (await redis.get('yozuv_yondi:tg')) === '1', tk = (await redis.get('yozuv_yondi:tg_kirish')) === '1', nv = (await redis.get('yozuv_yondi:tasdiq')) === '1';
  console.log('Qaror: ' + (b && tg ? '🟢 SERVERNING O\'ZIDA (darhol)' : nv ? '⚪ navbat → eski tizim (Koprik tasdiqQil)' : '⚪ eski tizim (Koprik tasdiqQil, kutib)') + ' · Telegram yuborish: ' + (tg ? '🟢' : '⚪') + ' · bot o\'qish: ' + (tk ? '🟢' : '⚪'));
  if (arg === 'yoq') { if (!tg || !tk) { console.log('✖ Avval aks-tg yoq va aks-tg-kirish yoq.'); return tugat(1); } await redis.set('yozuv_yondi:tasdiq_qaror', '1'); console.log('✅ YOQILDI — endi ✅/✖ qarori (ilova va Telegram tugmasi) serverning o\'zida bajariladi; «👍 To\'g\'ri qaytargan» ham. «↩ Isbotni tiklash» — hali eski tizim.'); }
  if (arg === 'ochir') { await redis.del('yozuv_yondi:tasdiq_qaror'); console.log('⛔ O\'CHIRILDI — qaror yana avvalgidek (navbat / eski tizim).'); }
  const L = await TS.tasdiqNavbat(); const yu = L.filter(it => it.tasdiqchi === 'yurist');
  console.log('Tekshiruvdagi isbotlar: ' + L.length + ' (yurist: ' + yu.length + ', direktor: ' + (L.length - yu.length) + ')');
  if (arg === 'sinov') {
    const k = process.argv[3]; const it = k ? L.find(z => z.k === k) : (yu[0] || L[0]);
    if (!it) { console.log('✖ Isbot topilmadi' + (k ? ': ' + k : ' (tekshiruvda hech narsa yo\'q)')); return tugat(1); }
    const XD = await TT.xodimlar(); const x = (it.tasdiqchi === 'yurist' ? XD.find(z => /(^|,)\s*yurist\s*(,|$)/i.test(z.huquq) && !z.admin) : null) || XD.find(z => z.admin);
    const u = { kod: x.kod, fish: x.fish, huquq: s(x.huquq).toLowerCase().split(',').map(z => z.trim()) };
    console.log('\n🧪 QURUQ SINOV — ' + it.k + ' · ' + it.nomi.replace(/<[^>]+>/g, '') + (it.no ? ' · ' + it.no : '') + ' · topshirdi: ' + it.kim + ' · tekshiradi: ' + x.fish + ' (' + it.tasdiqchi + ')');
    for (const [ha, izoh] of [[true, ''], [false, 'Sinov — sahifa yetishmaydi']]) {
      const ctx = TT.quruq(); console.log('\n' + (ha ? '✅ TASDIQLASH:' : '✖ QAYTARISH «' + izoh + '»:'));
      try { const r = await TQ.qaror(u, it.k, ha, izoh, ctx); console.log('   → ' + JSON.stringify(r)); } catch (e) { console.log('   ✖ ' + e.message); }
      chop(ctx.log);
    }
    console.log('\n✅ Quruq sinov tugadi. Hech narsa yozilmadi va yuborilmadi.');
    return tugat(0);
  }
  if (arg === 'tikla') {
    const L2 = (await J.tqRows()).filter(q => q.rol === 'yurist' && q.qaror === 'Rad' && !q.direktor), id = process.argv[3];
    const q = id ? L2.find(z => String(z.id) === String(id)) : L2[L2.length - 1];
    console.log('Yurist qaytargan, siz hali ko\'rmagan qarorlar: ' + L2.length + (L2.length ? ' (ID: ' + L2.map(z => z.id).join(', ') + ')' : ''));
    if (!q) { console.log('✖ Tiklash sinovi uchun qaror yo\'q' + (id ? ': ID ' + id : '') + '.'); return tugat(0); }
    const XD = await TT.xodimlar(), d = XD.find(z => z.admin), u = { kod: d.kod, fish: d.fish, huquq: s(d.huquq).toLowerCase().split(',').map(z => z.trim()) };
    console.log('\n🧪 QURUQ «↩ Isbotni tiklash» — 06t ID ' + q.id + ' · ' + q.kalit + ' · ' + (q.no || '') + ' · yurist sababi: «' + q.sabab + '» · tiklash nusxasi: ' + (q.tiklash ? 'bor' : 'YO\'Q'));
    const ctx = TT.quruq();
    try { const r = await TQ.tqTiklash(u, q, ctx); console.log('   → ' + JSON.stringify(r)); } catch (e) { console.log('   ✖ ' + e.message); }
    chop(ctx.log);
    console.log('\n✅ Quruq sinov tugadi. Hech narsa yozilmadi va yuborilmadi. Koprik v1.18: ' + ((await TQ.koprik18(u.kod)) ? '✅ bor' : '✖ hali yo\'q (haqiqiy tiklash eski tizimda qoladi)'));
    return tugat(0);
  }
  const Q = (await J.tqRows()).slice(-5);
  if (Q.length) { console.log('\n--- 06t oxirgi qarorlar ---'); Q.forEach(q => console.log('  ' + q.vaqt + '  ' + s(q.kalit).padEnd(8) + s(q.qaror).padEnd(12) + s(q.kim).padEnd(24) + (q.sabab ? '«' + q.sabab.slice(0, 50) + '»' : '') + (q.direktor ? '  direktor: ' + q.direktor.split('|')[0] : ''))); }
  await tugat(0);
})().catch(async e => { console.error('XATO:', e.message); await tugat(1); });
