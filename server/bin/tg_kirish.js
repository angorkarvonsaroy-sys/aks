#!/usr/bin/env node
// aks-tg-kirish — 📥 botdan keladigan xabarlar serverda (Telegram ko'chirish 3-qadami). Ishlatish:
//   aks-tg-kirish          — holat: bayroq, poll tirikmi, offset, Conflict bo'lganmi, skan_naz / tq_kechki, botda kutayotgan yangiliklar soni, oxirgi 15 ta ishlov
//   aks-tg-kirish sinov    — QURUQ sinov: soxta xabarlar (/start, kontakt, /tekshiruv, tugmalar) serverdagi ishlovdan o'tkaziladi — hech narsa yuborilmaydi,
//                            yozilmaydi; nima bo'lishi ko'rsatiladi. Botga tegmaydi (getUpdates chaqirilmaydi — eski trigger bilan to'qnashmaydi).
//   aks-tg-kirish yoq      — YOQISH (avval Apps Script'da tgTugmaPoll triggeri O'CHIRILGAN bo'lishi shart): yozuv_yondi:tg_kirish + vaqt_yondi:skan_naz + vaqt_yondi:tq_kechki
//   aks-tg-kirish ochir    — o'chirish (uchala bayroq) — keyin Apps Script'da tgTugmaOrnat ▶ bilan eski trigger qaytariladi
'use strict';
process.env.AKS_ENV = process.env.AKS_ENV || '/opt/aks/.env';
const { pool, redis, q } = require('../lib/db');
const TG = require('../lib/telegram');
const TT = require('../lib/tg_tasdiq');
const K = require('../lib/tg_kirish');
const P = require('../lib/tg_poll');
const env = require('../lib/env');

const s = v => String(v == null ? '' : v);
const tugat = async (kod) => { try { await pool.end(); redis.disconnect(); } catch (e) { } process.exit(kod || 0); };
function chop(y) { const x = y.xabarlar || y.log || []; x.forEach(z => { if (z.yozuv) console.log('     📝 yozuv: ' + z.yozuv); else console.log('     ✉ ' + z.metod + ' → ' + z.chat + (z.fayl ? ' 📎 ' + z.fayl : '') + (z.tugma ? ' [' + z.tugma + ']' : '') + '\n        «' + s(z.matn).replace(/\n/g, '\n        ') + '»'); }); }

(async () => {
  const arg = process.argv[2];
  console.log('================ 📥 TELEGRAM — BOTDAN KELADIGANLAR (serverda) ================');
  const bay = await redis.get('yozuv_yondi:tg'), bk = await K.yoqilgan();
  console.log('TG_TOKEN: ' + (TG.bor() ? 'bor' : 'YO\'Q') + ' · yuborish (yozuv_yondi:tg): ' + (bay === '1' ? '🟢 serverdan' : '⚪ Koprik') + ' · kirish (yozuv_yondi:tg_kirish): ' + (bk ? '🟢 SERVER O\'QIYDI' : '⚪ eski tgTugmaPoll triggeri o\'qiydi'));
  if (arg === 'yoq') {
    if (!TG.bor()) { console.log('✖ TG_TOKEN yo\'q — yoqib bo\'lmaydi.'); return tugat(1); }
    if (bay !== '1') { console.log('✖ Avval 2-qadam (aks-tg yoq) yoqilishi kerak.'); return tugat(1); }
    await redis.set('yozuv_yondi:tg_kirish', '1'); await redis.set('vaqt_yondi:skan_naz', '1'); await redis.set('vaqt_yondi:tq_kechki', '1');
    console.log('✅ YOQILDI: botdan keladigan xabarlar (ulash, PIN, ✅/✖ tugmalar, /tekshiruv), skan_naz (har 10 daq), tq_kechki (20:05) — endi SERVERDA.');
    console.log('   Poll 10 soniya ichida boshlanadi. Eski tgTugmaPoll triggeri O\'CHIRILGAN bo\'lishi shart — aks holda pastda «Conflict» ko\'rinadi.');
    console.log('   Qaytarish: aks-tg-kirish ochir, keyin Apps Script\'da tgTugmaOrnat ▶.');
    await new Promise(r => setTimeout(r, 15000));
  }
  if (arg === 'ochir') { await redis.del('yozuv_yondi:tg_kirish', 'vaqt_yondi:skan_naz', 'vaqt_yondi:tq_kechki'); console.log('⛔ O\'CHIRILDI — bot xabarlarini yana eski tizim o\'qiydi (Apps Script\'da tgTugmaOrnat ▶ ni ishga tushiring).'); }
  if (!TG.bor()) return tugat(0);

  if (arg === 'sinov') return sinov();

  const h = await P.holat();
  const tirik = h.tirik ? Math.round((Date.now() - h.tirik) / 1000) : -1;
  console.log('Poll (getUpdates): ' + (h.yoq ? (tirik >= 0 && tirik < 120 ? '🟢 tirik (' + tirik + ' s oldin)' : '🔴 TIRIK EMAS' + (tirik >= 0 ? ' (oxirgi ' + tirik + ' s oldin)' : ' (hech qachon)') + ' — pm2 aks-api ishlayaptimi?') : '⚪ o\'chiq') + ' · offset: ' + h.offset);
  if (h.konflikt) console.log('⚠ CONFLICT bo\'lgan: ' + h.konflikt + '\n   → Apps Script\'da tgTugmaPoll triggeri hali ishlayapti. Uni o\'chiring.');
  if (h.xato) console.log('⚠ Oxirgi poll xatosi: ' + h.xato);
  for (const nom of ['skan_naz', 'tq_kechki']) { const y = (await redis.get('vaqt_yondi:' + nom)) === '1'; let ox = null; try { ox = JSON.parse((await redis.get('vaqt:' + nom + ':oxirgi')) || 'null'); } catch (e) { }
    console.log('⏰ ' + nom.padEnd(10) + (y ? '🟢 SERVERDA' : '⚪ eski trigger ichida') + (ox ? ' · oxirgi: ' + ox.vaqt + ' ' + (ox.ok ? '✅ ' + JSON.stringify(ox.natija).slice(0, 120) : '✖ ' + ox.xato) : '')); }
  try { const w = await TG.api('getWebhookInfo', {}, null, { jurnalsiz: true }); console.log('Botda kutayotgan yangiliklar: ' + (w.pending_update_count || 0) + (w.url ? ' · ⚠ webhook o\'rnatilgan: ' + w.url : ' · webhook yo\'q ✅')); } catch (e) { console.log('getWebhookInfo: ✖ ' + e.message); }
  const J = await K.jurnalOqi(15);
  if (J.length) { console.log('\n--- Oxirgi ishlovlar (botdan kelganlar) ---'); J.forEach(r => console.log('  ' + r.vaqt + '  ' + s(r.tur).padEnd(11) + s(r.kim).padEnd(24) + s(r.nima).padEnd(14) + s(r.natija).slice(0, 70) + (r.ms ? '  ' + (r.ms / 1000).toFixed(1) + ' s' : ''))); }
  else console.log('\nHali birorta xabar ishlanmagan.');
  const E = (await q("SELECT to_char(vaqt,'DD.MM HH24:MI') v, xato FROM rpc_jurnal WHERE qayerda='tg' AND fn='tg_kirish' AND NOT ok ORDER BY vaqt DESC LIMIT 5")).rows;
  if (E.length) { console.log('\n--- Xatolar (tg_kirish) ---'); E.forEach(r => console.log('  ' + r.v + '  ' + r.xato)); }
  await tugat(0);

  async function sinov() {
    console.log('\n🧪 QURUQ SINOV — hech narsa yuborilmaydi va yozilmaydi (botga tegilmaydi).');
    const XD = await TT.xodimlar(); const dir = XD.find(z => z.admin && z.tg), yu = XD.find(z => /(^|,)\s*yurist\s*(,|$)/i.test(z.huquq) && !z.admin);
    console.log('Direktor: ' + (dir ? dir.fish + ' (Telegram bor)' : '✖ Telegram ID yo\'q!') + ' · Yurist: ' + (yu ? yu.fish + (yu.tg ? ' (Telegram bor)' : ' (Telegram YO\'Q)') : '✖ yo\'q'));
    const chat = '999000001', from = { id: 999000001, first_name: 'Sinov', last_name: 'Xodim' };
    const ctx0 = () => Object.assign(TT.quruq(), { ul: { sinovkod12345678: dir ? dir.kod : '' } });
    const yur = async (nom, z, ctx) => { ctx = ctx || ctx0(); console.log('\n' + nom); let n; try { n = await K.ishlov(z, ctx); } catch (e) { n = { natija: '⚠ ' + e.message }; }
      console.log('   → ' + JSON.stringify(n)); chop(ctx); };
    await yur('1) /start <ilova havolasi> (soxta chat ' + chat + ')', { update_id: 1, message: { chat: { id: chat, type: 'private' }, from, text: '/start sinovkod12345678' } });
    const ctx2 = ctx0(); ctx2.ulc = dir ? dir.kod : '';
    await yur('2) 📱 kontakt — direktorning raqami (ulash; 07 U ga yozuv — faqat ko\'rsatiladi)', { update_id: 2, message: { chat: { id: chat, type: 'private' }, from, contact: { phone_number: '+998' + (dir ? dir.tel.slice(-9) : '000000000'), user_id: from.id } } }, ctx2);
    await yur('3) 📱 kontakt — ro\'yxatda yo\'q raqam', { update_id: 3, message: { chat: { id: chat, type: 'private' }, from, contact: { phone_number: '+998901112233', user_id: from.id } } });
    await yur('4) 📱 kontakt — boshqa odamning raqami', { update_id: 4, message: { chat: { id: chat, type: 'private' }, from, contact: { phone_number: '+998901112233', user_id: 5 } } });
    if (dir) {
      const dfrom = { id: Number(dir.tg), first_name: dir.fish };
      await yur('5) /tekshiruv — direktordan', { update_id: 5, message: { chat: { id: dir.tg, type: 'private' }, from: dfrom, text: '/tekshiruv' } });
      await yur('6) /tekshiruv — begona odamdan (javob yo\'q)', { update_id: 6, message: { chat: { id: chat, type: 'private' }, from, text: '/tekshiruv' } });
      await yur('7) 📥 Kutilayotganlar tugmasi (tq|K) — direktordan (fayllar o\'qiladi, yuborilmaydi)', { update_id: 7, callback_query: { id: 'cb7', from: dfrom, data: 'tq|K', message: { message_id: 1, chat: { id: dir.tg } } } });
      await yur('8) 📥 Qaytarilganlar tugmasi (tq|Q) — direktordan', { update_id: 8, callback_query: { id: 'cb8', from: dfrom, data: 'tq|Q', message: { message_id: 2, chat: { id: dir.tg } } } });
    }
    const TS = require('../lib/tasdiq'); const L = (await TS.tasdiqNavbat()).filter(it => it.tasdiqchi === 'yurist');
    const it = L[0];
    if (it) {
      const yfrom = yu && yu.tg ? { id: Number(yu.tg), first_name: yu.fish } : dir ? { id: Number(dir.tg), first_name: dir.fish } : from;
      const kim = yu && yu.tg ? 'yurist' : 'direktor';
      await yur('9) ✖ Qaytarish tugmasi (ts|R|' + it.k + ') — ' + kim + 'dan: sabab tugmalari chiqadi', { update_id: 9, callback_query: { id: 'cb9', from: yfrom, data: 'ts|R|' + it.k, message: { message_id: 3, chat: { id: yfrom.id } } } });
      await yur('10) ✅ Tasdiqlash tugmasi (ts|A|' + it.k + ') — ' + kim + 'dan: qaror navbatga (quruq — qo\'yilmaydi)', { update_id: 10, callback_query: { id: 'cb10', from: yfrom, data: 'ts|A|' + it.k, message: { message_id: 3, chat: { id: yfrom.id } } } });
      await yur('11) ✅ Tasdiqlash — begona odamdan (rad)', { update_id: 11, callback_query: { id: 'cb11', from, data: 'ts|A|' + it.k, message: { message_id: 4, chat: { id: chat } } } });
      const ctx12 = ctx0(); ctx12.tsw = { k: it.k };
      await yur('12) «✍ yozaman» dan keyin yozilgan sabab — ' + kim + 'dan', { update_id: 12, message: { chat: { id: yfrom.id, type: 'private' }, from: yfrom, text: 'Sinov sababi — hujjat xira' } }, ctx12);
    } else console.log('\n9–12) Tekshiruvdagi isbot yo\'q — tugma sinovi o\'tkazilmadi.');
    await yur('13) Tekshiruvdan o\'tgan isbot tugmasi (ts|A|t0) — «allaqachon ko\'rilgan»', { update_id: 13, callback_query: { id: 'cb13', from: dir ? { id: Number(dir.tg) } : from, data: 'ts|A|t0', message: { message_id: 5, chat: { id: dir ? dir.tg : chat } } } });
    const VQ = require('../lib/vaqt');
    for (const nom of ['skan_naz', 'tq_kechki']) { const ish = VQ.ISHLAR.find(z => z.nom === nom); console.log('\n⏰ ' + nom + ' (quruq):'); try { const r = await VQ.sinov(ish); const { xabarlar, ...rest } = r; console.log('   → ' + JSON.stringify(rest).slice(0, 600)); chop({ xabarlar }); } catch (e) { console.log('   ✖ ' + e.message); } }
    console.log('\n✅ Quruq sinov tugadi. Hech narsa yuborilmadi va yozilmadi.');
    await tugat(0);
  }
})().catch(async e => { console.error('XATO:', e.message); await tugat(1); });
