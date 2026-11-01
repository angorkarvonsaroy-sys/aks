#!/usr/bin/env node
// AKS TIZIM — 🗄 BAZA (ko'chirishning 1-bosqichi): ko'zgudan «baza» sxemasidagi haqiqiy jadvallarni qurish va ko'rish (01.11.2026).
//   aks-baza                 — holat: oxirgi to'ldirish, har jadvalda nechta qator, nechta xato
//   aks-baza toldir          — ko'zgudan qaytadan qurish (eski «baza» faqat hammasi muvaffaqiyatli bo'lsa almashadi)
//   aks-baza xatolar [jadval] — aylantirib bo'lmagan kataklar (NULL qilingan): varaq, qator, ustun, qiymat, sabab
//   aks-baza solishtir       — (2-bosqich) yangidan quradi va HAR QATOR: Google hisoblagan qiymat ↔ server hisobi (lib/baza_hisob.js); --toldirmasdan
// Google jadvalga, ko'zguga va ilovaga TEGMAYDI. Ilova hali bu jadvallardan o'qimaydi.
'use strict';
process.env.AKS_ENV = process.env.AKS_ENV || '/opt/aks/.env';
const { Client } = require('pg');
const env = require('../lib/env');
const B = require('../lib/baza');

const s = v => String(v == null ? '' : v);
const ong = (v, n) => s(v).padStart(n), chap = (v, n) => s(v).padEnd(n);
const son = n => Number(n || 0).toLocaleString('ru-RU').replace(/ /g, ' ');

async function holat(db) {
  const j = (await db.query(`SELECT * FROM baza_yuklashlar ORDER BY id DESC LIMIT 1`)).rows[0];
  if (!j) { console.log('Hali to\'ldirilmagan. Boshlash: aks-baza toldir'); return; }
  console.log('Oxirgi to\'ldirish: ' + new Date(j.boshlandi).toLocaleString('sv-SE', { timeZone: 'Asia/Tashkent' }) + ' · ' + j.holat +
    (j.ms ? ' · ' + (j.ms / 1000).toFixed(1) + ' s' : '') + (j.xato_matn ? ' · ' + j.xato_matn : ''));
  const bor = (await db.query(`SELECT 1 FROM information_schema.schemata WHERE schema_name = 'baza'`)).rows.length;
  if (!bor) { console.log('«baza» sxemasi yo\'q.'); return; }
  jadval((j.hisobot && j.hisobot.jadvallar) || [], j.hisobot && j.hisobot.xatolar);
}
function jadval(T, xatolar) {
  console.log('\n' + chap('Jadval', 26) + chap('Varaq', 30) + ong('Qator', 7) + ong('Xato', 6) + ong('Takror ID', 10) + ong('Bo\'sh', 7));
  console.log('-'.repeat(86));
  let q = 0;
  for (const t of T) { q += t.qator;
    console.log(chap(t.jadval, 26) + chap(t.varaq, 30) + ong(son(t.qator), 7) + ong(t.xato || '', 6) + ong(t.takror || '', 10) + ong((t.bosh || 0) + (t.tashlandi || 0) || '', 7)); }
  console.log('-'.repeat(86));
  console.log(chap('JAMI: ' + T.length + ' jadval', 56) + ong(son(q), 7) + ong(xatolar || 0, 6));
  console.log('\nXato — katakni aylantirib bo\'lmadi (NULL qilindi): aks-baza xatolar · Takror ID — ID ustunida bir xil qiymat bir necha qatorda.');
}

(async () => {
  const buyruq = process.argv[2] || 'holat';
  const db = new Client(env.db);
  await db.connect();
  try {
    if (buyruq === 'toldir') {
      const r0 = await db.query(`INSERT INTO baza_yuklashlar (holat) VALUES ('ishlayapti') RETURNING id`);
      console.log('Ko\'zgudan «baza» jadvallari qurilmoqda…');
      try {
        const n = await B.toldir(db);
        await db.query(`UPDATE baza_yuklashlar SET tugadi = now(), holat = 'ok', ms = $2, hisobot = $3 WHERE id = $1`, [r0.rows[0].id, n.ms, JSON.stringify(n)]);
        console.log('✅ Tayyor: ' + (n.ms / 1000).toFixed(1) + ' s');
        jadval(n.jadvallar, n.xatolar);
      } catch (e) {
        await db.query(`UPDATE baza_yuklashlar SET tugadi = now(), holat = 'xato', xato_matn = $2 WHERE id = $1`, [r0.rows[0].id, s(e.message).slice(0, 2000)]);
        console.log('⚠ To\'xtadi (eski «baza» o\'z joyida): ' + e.message);
        process.exitCode = 1;
      }
    } else if (buyruq === 'solishtir') {
      // avval yangidan quriladi (ko'zgu bilan bir xil holat), keyin har qator Google qiymati bilan solishtiriladi
      if (!process.argv.includes('--toldirmasdan')) {
        const r0 = await db.query(`INSERT INTO baza_yuklashlar (holat) VALUES ('ishlayapti') RETURNING id`);
        const n = await B.toldir(db);
        await db.query(`UPDATE baza_yuklashlar SET tugadi = now(), holat = 'ok', ms = $2, hisobot = $3 WHERE id = $1`, [r0.rows[0].id, n.ms, JSON.stringify(n)]);
        console.log('«baza» yangidan qurildi: ' + n.jadvallar.reduce((a, t) => a + t.qator, 0) + ' qator, ' + n.xatolar + ' xato.');
      }
      const R = await require('../lib/baza_solishtir').solishtir(db);
      console.log('Google hisobi ↔ server hisobi (BUGUN = ' + (R.bugun || '?') + ', varaqdagi 08_Lugatlar!Z2)\n');
      console.log(chap('Varaq', 24) + chap('Ustun', 6) + chap('Server nomi', 22) + ong('Qator', 7) + ong('Teng', 7) + ong('FARQ', 7));
      console.log('-'.repeat(73));
      let jamiFarq = 0;
      for (const u of R.ustunlar) { jamiFarq += u.farq;
        console.log(chap(u.varaq, 24) + chap(u.harf, 6) + chap(u.ustun, 22) + ong(u.jami, 7) + ong(u.teng, 7) + ong(u.farq ? u.farq + ' ⚠' : '0', 7)); }
      console.log('-'.repeat(73));
      Object.entries(R.qatorYoq).forEach(([v, n]) => console.log('⚠ ' + v + ': ' + n + ' qator «baza» da yo\'q (faqat formula natijasi bor)'));
      for (const u of R.ustunlar.filter(z => z.farq)) {
        console.log('\n' + u.varaq + ' ' + u.harf + ' (' + u.ustun + ') — ' + u.farq + ' farq:');
        u.misollar.forEach(m => console.log('  qator ' + ong(m.qator, 5) + '  ' + chap(m.no, 10) + ' Google: ' + chap(m.google, 16) + ' server: ' + m.server));
      }
      console.log('\n' + (jamiFarq ? '⚠ JAMI FARQ: ' + jamiFarq + ' katak — server hisobi hali Google bilan bir xil emas.' : '✅ HAMMASI BIR XIL — ' + R.ustunlar.reduce((a, u) => a + u.jami, 0) + ' katak, 0 farq.'));
      if (jamiFarq) process.exitCode = 2;
    } else if (buyruq === 'xatolar') {
      const j = process.argv[3];
      const R = await db.query(`SELECT jadval, varaq, qator, ustun, qiymat, sabab FROM baza.xatolar ${j ? 'WHERE jadval = $1' : ''} ORDER BY jadval, qator, ustun LIMIT 200`, j ? [j] : []);
      const S = await db.query(`SELECT jadval, ustun, sabab, count(*)::int n FROM baza.xatolar ${j ? 'WHERE jadval = $1' : ''} GROUP BY 1, 2, 3 ORDER BY 1, 2`, j ? [j] : []);
      if (!S.rows.length) { console.log('Xato yo\'q.'); return; }
      console.log('Guruhlab:'); S.rows.forEach(r => console.log('  ' + chap(r.jadval, 26) + chap(r.ustun, 4) + chap(r.sabab, 24) + ong(r.n, 5) + ' ta'));
      console.log('\nBirinchi ' + R.rows.length + ' ta:'); R.rows.forEach(r => console.log('  ' + chap(r.varaq, 28) + ong(r.qator, 6) + ' ' + chap(r.ustun, 3) + ' «' + s(r.qiymat).slice(0, 40) + '» — ' + r.sabab));
    } else await holat(db);
  } finally { await db.end(); }
})().catch(e => { console.error('XATO:', e.message); process.exit(1); });
