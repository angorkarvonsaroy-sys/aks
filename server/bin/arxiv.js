#!/usr/bin/env node
// AKS TIZIM — 🗄 Drive arxivi («AKS TIZIM / AKS ARXIV», lib/arxiv.js) — 02.11.2026.
//   aks-arxiv          — holat: yoniqmi, ulanish, arxivdagi fayllar soni, oxirgi amallar
//   aks-arxiv sinov    — haqiqiy sinov (bayroq o'chiq bo'lsa ham): «_SINOV» ga fayl yuklash → robot o'qiy oladimi → ko'chirish → tiklash → savatga
//   aks-arxiv zaxira   — AKS_BAZA nusxasini hozir olish («99 ZAXIRA»)
//   aks-arxiv nusxa    — serverdagi fayllarni hozir «SERVER NUSXA» ga (birinchi marta uzoq bo'lishi mumkin)
// Ulanish kaliti (/opt/aks/rclone.conf) ekranga chiqarilmaydi.
'use strict';
process.env.AKS_ENV = process.env.AKS_ENV || '/opt/aks/.env';
const fs = require('fs');
const env = require('../lib/env');
const { q } = require('../lib/db');
const BQ = require('../lib/bayroq');
const A = require('../lib/arxiv');
process.stdout.on('error', e => { if (e.code === 'EPIPE') process.exit(0); });

const PDF = Buffer.from('%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj 2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj 3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n');

async function holat() {
  const on = await BQ.yozuv('arxiv'), konf = fs.existsSync(env.rcloneKonf);
  console.log('Arxiv: ' + (on && konf ? '🟢 YONIQ — fayllarni server o\'zi yuklaydi' : '⚪ o\'chiq — fayllarni avvalgidek eski tizim yuklaydi') +
    ' · bayroq: ' + (on ? 'yoniq' : 'o\'chiq') + ' · ulanish fayli: ' + (konf ? 'bor' : 'YO\'Q'));
  console.log('Papka: «AKS TIZIM / AKS ARXIV» (ID ' + env.arxivPapka + ')');
  try { const L = JSON.parse(await A._ichki.rc(['lsjson', '--dirs-only', 'aksarxiv:'])); console.log('Ulanish: ✅ ishlayapti · ichidagi papkalar: ' + (L.map(z => z.Name).join(', ') || '— (bo\'sh)')); }
  catch (e) { console.log('Ulanish: ✖ ' + e.message); }
  const r = (await q(`SELECT count(*)::int n, count(*) FILTER (WHERE savatda)::int s, coalesce(sum(hajm) FILTER (WHERE NOT savatda), 0)::bigint h, max(yaratildi) t FROM arxiv_fayllar`)).rows[0];
  console.log('Server yuklagan fayllar: ' + r.n + ' (savatda ' + r.s + ') · ' + (Number(r.h) / 1048576).toFixed(1) + ' MB' + (r.t ? ' · oxirgisi: ' + new Date(r.t).toLocaleString('ru-RU', { timeZone: 'Asia/Tashkent' }) : ''));
  const J = (await q(`SELECT to_char(vaqt AT TIME ZONE 'Asia/Tashkent', 'DD.MM HH24:MI') v, fn, ok, ms, left(xato, 90) x FROM rpc_jurnal WHERE qayerda = 'arxiv' ORDER BY id DESC LIMIT 8`)).rows;
  if (J.length) { console.log('Oxirgi amallar:'); J.forEach(j => console.log('  ' + j.v + '  ' + (j.ok ? '✅' : '✖') + ' ' + j.fn + ' (' + j.ms + ' ms)' + (j.x ? ' — ' + j.x : ''))); }
}

async function sinov() {
  let xato = 0;
  const qadam = async (nom, f) => { try { const r = await f(); console.log('  ✅ ' + nom + (r ? ' — ' + r : '')); return true; } catch (e) { xato++; console.log('  ✖ ' + nom + ' — ' + e.message); return false; } };
  const nom = 'sinov_' + Date.now() + '.pdf';
  let id = '';
  console.log('Arxiv sinovi («AKS ARXIV / _SINOV»):');
  await qadam('1. Faylni yuklash', async () => { const r = await A.saqla(['_SINOV'], nom, PDF, { yangi: true }); id = r.id; return 'Drive ID ' + id; });
  if (!id) return finish(xato);
  await qadam('2. Qayta yuklashda ikkinchi nusxa bo\'lmaydi', async () => { const r = await A.saqla(['_SINOV'], nom, PDF); if (r.id !== id || !r.bor) throw new Error('boshqa fayl qaytdi: ' + r.id); return 'o\'sha fayl'; });
  await qadam('3. Robot (o\'qish huquqi) faylni o\'qiy oladi — papka «AKS TIZIM» ichida', async () => {
    const f = await require('../lib/google').driveFayl(id, env.googleKey);
    if (!f.bytes || !f.bytes.equals(PDF)) throw new Error('mazmuni boshqa'); return f.nom; });
  await qadam('4. Ko\'chirish («_SINOV/_BEKOR», boshqa nom bilan)', async () => { const r = await A.kochir(id, ['_SINOV', '_BEKOR'], 'BEKOR_' + nom); if (!r.ok) throw new Error(JSON.stringify(r)); if (r.id !== id) throw new Error('ID o\'zgardi'); return 'ID o\'zgarmadi'; });
  await qadam('5. Tiklash (asl joyiga)', async () => { const r = await A.ISH.koprikFaylTikla('', id, '', ''); if (!r.ok) throw new Error(JSON.stringify(r)); const z = await A.stat('_SINOV/' + nom); if (!z || z.ID !== id) throw new Error('asl joyida topilmadi'); return r.nom; });
  await qadam('6. Savatga', async () => { const r = await A.savatga(id); if (!r.ok) throw new Error(JSON.stringify(r)); if (await A.stat('_SINOV/' + nom)) throw new Error('hali turibdi'); return 'Drive savatida (30 kun)'; });
  await qadam('7. Mijoz papkasi nomi (Hujjat.gs bilan bir xil)', async () => { const p = await A.mijozPapka('27/999', 'ALIYEV VALI GANIYEVICH'); return p.join(' / '); });
  try { await A._ichki.rc(['rmdirs', 'aksarxiv:_SINOV']); } catch (e) { }
  finish(xato);
}
function finish(xato) { console.log('\n' + (xato ? '⚠ ' + xato + ' ta qadam o\'tmadi — natijani Claude\'ga ko\'rsating.' : '✅ ARXIV SINOVI O\'TDI — yoqish mumkin: aks-bayroq yoq arxiv')); if (xato) process.exitCode = 2; }

(async () => {
  const b = process.argv[2] || 'holat';
  if (b === 'sinov') await sinov();
  else if (b === 'zaxira') { const r = await A.zaxira(); console.log('✅ AKS_BAZA nusxasi: ' + r.nom + (r.hajm ? ' (' + (r.hajm / 1048576).toFixed(1) + ' MB)' : r.bor ? ' (bugungisi allaqachon bor)' : '')); }
  else if (b === 'nusxa') { const r = await A.nusxa(); console.log(r.band ? 'Hozir boshqa nusxa ketyapti — keyinroq.' : '✅ Server fayllari «SERVER NUSXA» ga: ' + (r.ms / 1000).toFixed(0) + ' s'); }
  else await holat();
  process.exit(process.exitCode || 0);
})().catch(e => { console.error('XATO:', e.message); process.exit(1); });
