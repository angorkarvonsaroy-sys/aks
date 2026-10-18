#!/usr/bin/env node
// AKS TIZIM — 3-bosqich tekshiruvi: xodimlar eski havolani (Apps Script) ochsa nima ko'radi.
// Har ishlayotgan xodim kodi bilan eski ilova sahifasi (doGet) so'raladi: xodim — «AKS TIZIM yangi manzilda», direktor — eski tizim sahifasi.
// Kodlar ekranga chiqmaydi. Ishlatish: aks-eski-havola
'use strict';
process.env.AKS_ENV = process.env.AKS_ENV || '/opt/aks/.env';
const { pool, redis } = require('../lib/db');
const env = require('../lib/env');

async function sahifa(kod) {
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 60000);
  try { const r = await fetch(env.bridgeUrl + '?k=' + encodeURIComponent(kod), { redirect: 'follow', signal: ctl.signal }); return { kod: r.status, matn: await r.text() }; }
  finally { clearTimeout(t); }
}
(async () => {
  console.log('================ ESKI HAVOLA (3-bosqich) ================');
  if (!env.bridgeUrl) throw new Error('BRIDGE_URL yo\'q');
  const X = (await pool.query("SELECT fish, huquqlar, kirish_kodi FROM v_xodimlar WHERE kompaniya_id = 1 AND holat = 'Ishlayapti' ORDER BY qator_no")).rows
    .filter(x => (x.huquqlar || []).length && String(x.kirish_kodi || '').length >= 8);
  let xato = 0;
  for (const x of X) {
    const adm = (x.huquqlar || []).includes('admin');
    let n = '';
    try {
      const s = await sahifa(String(x.kirish_kodi).trim());
      const yangi = /yangi manzilda/.test(s.matn), taqiq = /Kirish taqiqlangan/.test(s.matn);
      const holat = yangi ? 'yangi tizimga o\'tish oynasi' : taqiq ? '«Kirish taqiqlangan»' : (s.kod === 200 ? 'ESKI TIZIM SAHIFASI' : 'javob ' + s.kod);
      const togri = adm ? (!yangi && !taqiq && s.kod === 200) : yangi;
      if (!togri) xato++;
      n = (togri ? '✅ ' : '⚠ ') + holat + (adm ? ' (direktor — eski tizim ochilishi kerak)' : '');
    } catch (e) { xato++; n = '⚠ so\'rov bo\'lmadi: ' + e.message; }
    console.log('• ' + x.fish + ' — ' + n);
  }
  console.log('\n' + (xato ? '⚠ ' + xato + ' ta kutilgandek emas.' : '✅ Hammasi to\'g\'ri: xodimlar eski havoladan yangi tizimga yo\'naltiriladi, eski tizim — faqat direktor.'));
  await pool.end(); redis.disconnect(); process.exit(0);
})().catch(async e => { console.error('XATO:', e.message); try { await pool.end(); redis.disconnect(); } catch (z) { } process.exit(1); });
