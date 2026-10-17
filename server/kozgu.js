#!/usr/bin/env node
// AKS TIZIM — KO'ZGU: Google jadval (AKS_BAZA) → PostgreSQL.
// Eski tizimga tegmaydi: Google'dan faqat O'QIYDI. Faqat o'zgargan varaqlar qayta yoziladi.
// Hamma varaq bitta tranzaksiyada yangilanadi — o'quvchi hech qachon "yarim" holatni ko'rmaydi.
'use strict';
const crypto = require('crypto');
const { Client } = require('pg');
const env = require('./lib/env');
const google = require('./lib/google');

const BOLAK = 2000; // bitta INSERT dagi qatorlar soni

function vaqt() { return new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Tashkent' }); }

// faqat — varaq nomlari ro'yxati berilsa, faqat o'shalar o'qiladi (server o'zi yozgandan keyin: 1–2 soniya). Berilmasa — hammasi.
async function kompaniyaKozgusi(db, k, faqat) {
  // bir kompaniya uchun bir vaqtda bitta yurish (taymer va ilova serveri to'qnashmasin)
  await db.query('SELECT pg_advisory_lock(424242, $1)', [k.id]);
  try { return await kompaniyaKozgusiIch(db, k, faqat); }
  finally { await db.query('SELECT pg_advisory_unlock(424242, $1)', [k.id]).catch(() => {}); }
}
async function kompaniyaKozgusiIch(db, k, faqat) {
  const yur = await db.query('INSERT INTO kozgu.yurishlar (kompaniya_id) VALUES ($1) RETURNING id', [k.id]);
  const yurId = yur.rows[0].id;
  const t0 = Date.now();
  try {
    const nomlar = faqat && faqat.length ? faqat.slice() : (await google.varaqlar(k.sheet_id, env.googleKey)).varaqlar.map(v => v.title);
    const qiymat = await google.qiymatlar(k.sheet_id, nomlar, env.googleKey);
    const googleMs = Date.now() - t0;

    const t1 = Date.now();
    const eski = new Map((await db.query(
      'SELECT varaq, xesh FROM kozgu.varaqlar WHERE kompaniya_id=$1', [k.id])).rows.map(r => [r.varaq, r.xesh]));

    let ozgargan = 0, jamiQator = 0;
    await db.query('BEGIN');
    for (const nom of nomlar) {
      const rows = qiymat.xom[nom] || [];
      const kor = qiymat.korinish[nom] || [];
      const json = JSON.stringify([rows, kor]);
      const xesh = crypto.createHash('sha1').update(json).digest('hex');
      const ustun = rows.reduce((m, r) => Math.max(m, r.length), 0);
      const toliq = [];
      rows.forEach((r, i) => { if (r.length && r.some(v => v !== '' && v !== null)) toliq.push([i + 1, r, kor[i] || []]); });
      jamiQator += toliq.length;

      if (eski.get(nom) === xesh) {
        await db.query('UPDATE kozgu.varaqlar SET tekshirilgan=now() WHERE kompaniya_id=$1 AND varaq=$2', [k.id, nom]);
        continue;
      }
      ozgargan++;
      await db.query('DELETE FROM kozgu.qatorlar WHERE kompaniya_id=$1 AND varaq=$2', [k.id, nom]);
      for (let i = 0; i < toliq.length; i += BOLAK) {
        await db.query(
          `INSERT INTO kozgu.qatorlar (kompaniya_id, varaq, qator_no, data, korinish)
           SELECT $1, $2, (x->>0)::int, x->1, x->2 FROM jsonb_array_elements($3::jsonb) AS x`,
          [k.id, nom, JSON.stringify(toliq.slice(i, i + BOLAK))]);
      }
      await db.query(
        `INSERT INTO kozgu.varaqlar (kompaniya_id, varaq, qatorlar, ustunlar, xesh, ozgargan, tekshirilgan)
         VALUES ($1,$2,$3,$4,$5,now(),now())
         ON CONFLICT (kompaniya_id, varaq) DO UPDATE
           SET qatorlar=EXCLUDED.qatorlar, ustunlar=EXCLUDED.ustunlar, xesh=EXCLUDED.xesh,
               ozgargan=now(), tekshirilgan=now()`,
        [k.id, nom, toliq.length, ustun, xesh]);
    }
    // Google'da o'chirilgan varaqlar bazadan ham olib tashlanadi
    const yoq = faqat && faqat.length ? [] : [...eski.keys()].filter(n => !nomlar.includes(n));
    for (const nom of yoq) {
      await db.query('DELETE FROM kozgu.qatorlar WHERE kompaniya_id=$1 AND varaq=$2', [k.id, nom]);
      await db.query('DELETE FROM kozgu.varaqlar WHERE kompaniya_id=$1 AND varaq=$2', [k.id, nom]);
      ozgargan++;
    }
    await db.query('COMMIT');
    const bazaMs = Date.now() - t1;

    await db.query(
      `UPDATE kozgu.yurishlar SET tugadi=now(), holat='ok', varaqlar=$2, ozgargan=$3, qatorlar=$4, google_ms=$5, baza_ms=$6 WHERE id=$1`,
      [yurId, nomlar.length, ozgargan, jamiQator, googleMs, bazaMs]);
    console.log(`${vaqt()}  ${k.nom}: ${nomlar.length} varaq, ${ozgargan} tasi o'zgargan, ${jamiQator} qator | Google ${googleMs} ms, baza ${bazaMs} ms`);
  } catch (e) {
    try { await db.query('ROLLBACK'); } catch (_) { /* tranzaksiya ochilmagan bo'lishi mumkin */ }
    await db.query(`UPDATE kozgu.yurishlar SET tugadi=now(), holat='xato', xato=$2 WHERE id=$1`, [yurId, String(e.message || e).slice(0, 2000)]);
    throw e;
  }
}

async function main() {
  const db = new Client(env.db);
  await db.connect();
  let xato = 0;
  try {
    // 1-kompaniya jadvali .env dagi AKS_BAZA_ID bilan bir xil bo'lsin
    await db.query(`UPDATE kompaniyalar SET sheet_id=$1 WHERE id=1 AND sheet_id IS DISTINCT FROM $1`, [env.aksBazaId]);
    const k = (await db.query('SELECT id, nom, sheet_id FROM kompaniyalar WHERE faol AND sheet_id IS NOT NULL ORDER BY id')).rows;
    for (const kom of k) {
      try { await kompaniyaKozgusi(db, kom); }
      catch (e) { xato++; console.error(`${vaqt()}  ${kom.nom}: XATO — ${e.message}`); }
    }
    // jurnal 30 kundan eskisini tozalash
    await db.query(`DELETE FROM kozgu.yurishlar WHERE boshlandi < now() - interval '30 days'`);
  } finally {
    await db.end();
  }
  process.exitCode = xato ? 1 : 0;
}

if (require.main === module) {
  main().catch(e => { console.error(`${vaqt()}  KO'ZGU TO'XTADI: ${e.message}`); process.exitCode = 1; });
}
module.exports = { kompaniyaKozgusi };
