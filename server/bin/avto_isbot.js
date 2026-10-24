#!/usr/bin/env node
// aks-avto-isbot — 🤖 isbotlarni avtomatik qabul qilish (direktor qarori 24.10.2026). Ishlatish:
//   aks-avto-isbot                — holat: bayroq, tekshiruvda turgan isbotlar (yurist / direktor bo'lib)
//   aks-avto-isbot sinov [k]      — QURUQ: bitta yurist isbotini (k — t<ID> | x<raqam> | n<ID>) avto ✅ qilsa nima yozilishini ko'rsatadi. Yozmaydi.
//   aks-avto-isbot yoq / ochir    — yozuv_yondi:avto_isbot (yoqilganda yangi isbotlar odam kutmaydi)
//   aks-avto-isbot navbat         — hozir yurist kutayotgan isbotlar ro'yxati (nima yopilishini ko'rsatadi, yozmaydi)
//   aks-avto-isbot navbat bajar   — o'sha navbatni HAQIQATAN yopadi (har biri ~6 soniyada — Google chekloviga urilmaslik uchun)
'use strict';
process.env.AKS_ENV = process.env.AKS_ENV || '/opt/aks/.env';
const { pool, redis } = require('../lib/db');
const TS = require('../lib/tasdiq');
const TT = require('../lib/tg_tasdiq');
const AV = require('../api/avto_isbot');
const s = v => String(v == null ? '' : v);
const tugat = async k => { try { await pool.end(); redis.disconnect(); } catch (e) { } process.exit(k || 0); };
const uxla = ms => new Promise(r => setTimeout(r, ms));
function chop(log) { log.forEach(z => { if (z.yozuv) console.log('     📝 ' + z.yozuv); else console.log('     ✉ ' + z.metod + ' → ' + z.chat + '\n        «' + s(z.matn).replace(/\n/g, '\n        ') + '»'); }); }
async function royxat() {
  const L = await TS.tasdiqNavbat(), N = await TS.skanNazNavbat();
  return { yu: L.filter(it => it.tasdiqchi === 'yurist'), dir: L.filter(it => it.tasdiqchi !== 'yurist'), naz: N };
}
(async () => {
  const arg = process.argv[2];
  console.log('================ 🤖 ISBOTLARNI AVTO QABUL QILISH ================');
  const b = (await redis.get('yozuv_yondi:avto_isbot')) === '1', tq = (await redis.get('yozuv_yondi:tasdiq_qaror')) === '1';
  console.log('Holat: ' + (b && tq ? '🟢 YOQIQ — yangi skan va xat isbotlari odam kutmaydi' : b ? '🟡 bayroq yoqiq, lekin tasdiq_qaror o\'chiq — ishlamaydi' : '⚪ o\'chiq — isbotlar yuristni kutadi'));
  if (arg === 'yoq') { if (!tq) { console.log('✖ Avval aks-tasdiq-qaror yoq (qaror serverda bo\'lishi shart).'); return tugat(1); }
    await redis.set('yozuv_yondi:avto_isbot', '1');
    console.log('✅ YOQILDI — endi yurist tekshiradigan isbotlar (shartnoma skanlari, xat isbotlari) yuklangan zahoti avtomatik qabul qilinadi;');
    console.log('   ixtiyoriy skan nazorati ham yuborilmaydi. Direktor tekshiradigan isbotlar va boshqa tasdiqlar — avvalgidek.');
    console.log('   Eski navbatni yopish: aks-avto-isbot navbat bajar'); }
  if (arg === 'ochir') { await redis.del('yozuv_yondi:avto_isbot'); console.log('⛔ O\'CHIRILDI — isbotlar yana yurist tekshiruvini kutadi.'); }
  const R = await royxat();
  console.log('Tekshiruvda: yurist kutayotgani ' + R.yu.length + ' ta (topshiriq ' + R.yu.filter(z => z.tur === 'top').length + ', xat ' + R.yu.filter(z => z.tur === 'xat').length + ')'
    + ' · ixtiyoriy skan ' + R.naz.length + ' ta · direktorniki ' + R.dir.length + ' ta (tegilmaydi)');
  if (arg === 'sinov') {
    const k = process.argv[3]; const H = R.yu.concat(R.naz); const it = k ? H.find(z => z.k === k) : H[0];
    if (!it) { console.log('✖ Yurist kutayotgan isbot yo\'q' + (k ? ': ' + k : '') + '.'); return tugat(0); }
    console.log('\n🧪 QURUQ SINOV — ' + it.k + ' · ' + s(it.nomi).replace(/<[^>]+>/g, '') + (it.no ? ' · ' + it.no : '') + ' · yukladi: ' + it.kim);
    const ctx = TT.quruq();
    const r = await AV.qabul(it.k, ctx); console.log('   → ' + JSON.stringify(r));
    chop(ctx.log);
    console.log('\n✅ Quruq sinov tugadi. Hech narsa yozilmadi va yuborilmadi.');
    return tugat(0);
  }
  if (arg === 'navbat') {
    const bajar = process.argv[3] === 'bajar', H = R.yu.concat(R.naz);
    if (!H.length) { console.log('Yopadigan narsa yo\'q ✅'); return tugat(0); }
    H.forEach(it => console.log('  ' + s(it.k).padEnd(10) + s(it.no).padEnd(10) + s(it.nomi).replace(/<[^>]+>/g, '').slice(0, 45).padEnd(47) + (it.kim || '')));
    if (!bajar) { console.log('\nBu ro\'yxatni yopish uchun: aks-avto-isbot navbat bajar (' + H.length + ' ta, ~' + Math.ceil(H.length * 6 / 60) + ' daqiqa)'); return tugat(0); }
    if (!(b && tq)) { console.log('✖ Avval yoqing: aks-avto-isbot yoq'); return tugat(1); }
    console.log('\n▶ Yopilmoqda (har biri ~6 s — Google chekloviga urilmaslik uchun):');
    let ok = 0, xato = 0;
    for (let i = 0; i < H.length; i++) {
      const it = H[i]; let r = await AV.qabul(it.k);
      if (!r.ok && /quota|429|RESOURCE_EXHAUSTED|rateLimit/i.test(s(r.xato))) { console.log('  ⏳ Google chekloviga urildi — 65 s kutib qayta…'); await uxla(65000); r = await AV.qabul(it.k); }
      console.log('  ' + (i + 1) + '/' + H.length + ' ' + s(it.k).padEnd(10) + (r.ok ? '✅' : '✖ ' + s(r.xato).slice(0, 80)));
      if (r.ok) ok++; else xato++;
      if (i < H.length - 1) await uxla(6000);
    }
    console.log('\n✅ Tugadi: yopildi ' + ok + ' ta' + (xato ? ', xato ' + xato + ' ta (ular «Tekshiruvda»da qoldi — aks-avto-isbot bilan ko\'ring)' : '') + '.');
    return tugat(xato ? 1 : 0);
  }
  await tugat(0);
})().catch(async e => { console.error('XATO:', e.message); await tugat(1); });
