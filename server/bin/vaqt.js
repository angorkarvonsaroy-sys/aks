#!/usr/bin/env node
// aks-vaqt — lib/vaqt.js ishlarini ko'rish / hozir bajarish / yoqish / o'chirish
'use strict';
const { pool, redis } = require('../lib/db');
const VQ = require('../lib/vaqt');
const s = v => String(v == null ? '' : v);
(async () => {
  const [arg, nom] = process.argv.slice(2);
  const ish = nom ? VQ.ISHLAR.find(z => z.nom === nom) : null;
  if ((arg === 'hozir' || arg === 'sinov' || arg === 'yoq' || arg === 'ochir') && !ish) { console.log('Ish nomi noto\'g\'ri. Bor ishlar: ' + VQ.ISHLAR.map(z => z.nom).join(', ')); process.exit(1); }
  if (arg === 'yoq') {
    await redis.set('vaqt_yondi:' + ish.nom, '1');
    const b = VQ.bolak(ish, VQ.toshkent()); if (b) await redis.set('vaqt:' + ish.nom + ':bolak', b, 'EX', 48 * 3600);   // bugungi vaqti o'tib bo'lgan — bugun bajarilmaydi, keyingisidan
    console.log('✅ «' + ish.tavsif + '» serverda jadval bo\'yicha YOQILDI (' + (ish.har === 'soat2' ? 'har 2 soatda: 00:05, 02:05 … 22:05' : VQ.harMatn(ish.har)) + ').');
    console.log('   ENDI eski trigger o\'chirilsin: Apps Script → ⏰ Триггеры → «' + ish.eski.split(' — ')[0] + '» qatorida ⋮ → Удалить триггер.');
  } else if (arg === 'ochir') {
    await redis.del('vaqt_yondi:' + ish.nom);
    console.log('⛔ «' + ish.tavsif + '» serverda O\'CHIRILDI — eski tizim triggeri ishlashi kerak (Apps Script da bor-yo\'qligini tekshiring).');
  } else if (arg === 'sinov') {
    console.log('🔎 «' + ish.tavsif + '» — quruq sinov (yuborilmaydi, yozilmaydi)…');
    const t0 = Date.now(); const r = await VQ.sinov(ish);
    if (r.xabarlar) { console.log('  ' + r.xabarlar.length + ' ta xabar tayyor' + (r.ochiq !== undefined ? ' · ochiq topshiriqlar: ' + r.ochiq : '') + ' (' + ((Date.now() - t0) / 1000).toFixed(1) + ' s)' + (r.sabab ? ' · ' + r.sabab : ''));
      r.xabarlar.forEach(x => { console.log('\n  → ' + x.kimga + ':'); console.log('    ' + x.matn.replace(/<\/?b>/g, '').split('\n').join('\n    ')); });
      if (r.chiqish) { console.log('\n  ---- Eski tizim bugun qilgani bilan solishtirish ----'); r.chiqish.forEach(l => console.log('    ' + l));
        console.log('\n  ' + (!r.eskiBor ? 'ℹ Eski tizim bugun hali bajarmagan — faqat xabarlarni ko\'zdan kechiring.' : !r.farq ? '✅ HAMMASI BIR XIL — server eski tizim bilan bir xil hisobladi.' : '⚠ ' + r.farq + ' ta farq — Claude\'ga ko\'rsating (18:15 dan keyin qilingan ish bo\'lsa — tabiiy).')); }
      if (r.svod07c) { console.log('\n  07c_Ertalab_svod ga yoziladigan qatorlar (Sana | Xodim | Qizil | Sariq | Yashil | Mijozlar | Muddati_otgan | Holat):'); r.svod07c.forEach(z => console.log('    ' + [VQ.toshkent().dmyHm.slice(0, 10), z.fish, z.q, z.s, z.y, z.n, z.muddati, z.holat].join(' | '))); } }
    else console.log('  natija (' + ((Date.now() - t0) / 1000).toFixed(1) + ' s): ' + JSON.stringify(r));
  } else if (arg === 'hozir') {
    console.log('⏰ «' + ish.tavsif + '» hozir bajarilmoqda…');
    const y = await VQ.bajar(ish);
    if (y.ok) { console.log('✅ bajarildi (' + (y.ms / 1000).toFixed(1) + ' s): ' + JSON.stringify(y.natija)); const b = VQ.bolak(ish, VQ.toshkent()); if (b) await redis.set('vaqt:' + ish.nom + ':bolak', b, 'EX', 48 * 3600); }
    else console.log('✖ xato (' + (y.ms / 1000).toFixed(1) + ' s): ' + y.xato);
  } else {
    const H = await VQ.holat();
    console.log('================ ⏰ VAQT BO\'YICHA ISHLAR — ' + VQ.toshkent().dmyHm + ' (Toshkent) ================');
    for (const h of H) {
      const o = h.oxirgi;
      console.log((h.yoq ? '🟢 SERVERDA' : '⚪ eski triggerda') + '  ' + h.nom.padEnd(12) + ' ' + h.tavsif + ' · ' + VQ.harMatn(h.har) + (h.yoq ? ' · keyingi ' + h.keyingi : '') + ' · eski: ' + h.eski);
      console.log('              oxirgi: ' + (o ? o.vaqt + ' ' + (o.ok ? '✅ ' + JSON.stringify(o.natija) : '✖ ' + o.xato) + ' (' + (o.ms / 1000).toFixed(1) + ' s)' : '— hali bajarilmagan'));
    }
    const J = (await redis.lrange('vaqt_jurnal', 0, 9)).map(z => { try { return JSON.parse(z); } catch (e) { return null; } }).filter(Boolean);
    if (J.length) { console.log('\n--- Oxirgi bajarilishlar ---'); J.forEach(j => console.log('  ' + j.vaqt + '  ' + j.nom.padEnd(10) + (j.ok ? '✅ ' + JSON.stringify(j.natija) : '✖ ' + j.xato) + '  ' + (j.ms / 1000).toFixed(1) + ' s')); }
    console.log('\nBuyruqlar: aks-vaqt sinov <nom> (quruq) · aks-vaqt hozir <nom> · aks-vaqt yoq <nom> · aks-vaqt ochir <nom>   (nom: ' + VQ.ISHLAR.map(z => z.nom).join(', ') + ')');
  }
  await pool.end(); redis.disconnect(); process.exit(0);
})().catch(async e => { console.error('XATO:', e.message); try { await pool.end(); redis.disconnect(); } catch (z) { } process.exit(1); });
