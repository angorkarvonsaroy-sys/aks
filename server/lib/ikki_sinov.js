// AKS TIZIM — 🗄 3-bosqich: ikki tomonlama yozish qatlamining O'Z-O'ZINI SINOVI (02.11.2026). aks-baza ikki sinov.
// Google'ga ham, «baza» ga ham TEGMAYDI: ikkita vaqtinchalik sxema (baza_sinov, baza_sinov_kut) quriladi va oxirida o'chiriladi.
//   1. baza_sinov_kut — ko'zgudan 1-bosqich bilan (toldir).
//   2. baza_sinov — bo'sh jadvallar; ko'zgudagi HAR QATOR «Google javobi» sifatida ikki tomonlama yozish qatlami (lib/ikki_yozuv.js qollaDb) orqali qo'llanadi.
//   3. Solishtiriladi — 0 farq bo'lishi kerak (aylantirish, bo'sh qator, qolda, faqatSon, lugat qoidalari bir xil).
//   4. Qisman yozuvlar: tasodifiy qatorlar avval butunlay tozalanadi, keyin ustunma-ustun, aralash tartibda qayta yoziladi.
//   5. Qator o'chirish / qo'shish (07c dagi deleteDimension kabi) — pastdagi qatorlar to'g'ri suriladimi.
//   6. Yana solishtiriladi — 0 farq.
'use strict';
const { JADVALLAR, LUGAT } = require('./baza_sxema');
const B = require('./baza');
const IK = require('./ikki_yozuv');
const IS = require('./ikki_solishtir');

const u0 = h => h.split('').reduce((a, c) => a * 26 + c.charCodeAt(0) - 64, 0) - 1;
const qq = s => '"' + s + '"';
const SX = 'baza_sinov', KUT = 'baza_sinov_kut';

function tasodif(seed) { let x = seed >>> 0 || 1; return () => { x ^= x << 13; x >>>= 0; x ^= x >>> 17; x ^= x << 5; x >>>= 0; return x / 4294967296; }; }

async function sinov(db, opt = {}) {
  const t0 = Date.now(), rnd = tasodif(opt.urug || Date.now()), N = opt.qisman == null ? 300 : opt.qisman;
  const kom = (await db.query('SELECT id FROM kompaniyalar WHERE faol ORDER BY id')).rows.map(r => r.id);
  const varaqlar = [...new Set(JADVALLAR.map(j => j.varaq).concat(LUGAT.varaq, LUGAT.qoshimcha.map(x => x.varaq)))];
  const natija = { qator: 0, katak: 0 };
  try {
    await B.toldir(db, { sxema: KUT, kompaniyalar: kom });
    await db.query(`DROP SCHEMA IF EXISTS ${SX} CASCADE`);
    await db.query(`CREATE SCHEMA ${SX}`);
    await db.query(`CREATE TABLE ${SX}.xatolar (LIKE ${KUT}.xatolar)`);
    for (const j of JADVALLAR) await db.query(B.jadvalDDL(SX, j));
    for (const s of B.LUGAT_DDL(SX)) await db.query(s);
    const R = await db.query(`SELECT kompaniya_id, varaq, qator_no, data FROM kozgu.qatorlar WHERE kompaniya_id = ANY($1) AND varaq = ANY($2) ORDER BY kompaniya_id, varaq, qator_no`, [kom, varaqlar]);
    const V = {};
    for (const r of R.rows) { const k = r.kompaniya_id + '|' + r.varaq; (V[k] = V[k] || []).push({ n: r.qator_no, x: Array.isArray(r.data) ? r.data : [] }); }
    const qatorKataklar = (j, z) => j.ustunlar.map(([h]) => ({ varaq: j.varaq, qator: z.n, u: u0(h), xom: z.x[u0(h)] === undefined || z.x[u0(h)] === null ? '' : z.x[u0(h)] }));
    // 2. har qator — «javob» sifatida
    for (const k of kom) {
      for (const j of JADVALLAR) {
        const Q = (V[k + '|' + j.varaq] || []).filter(z => z.n >= 2);
        for (let i = 0; i < Q.length; i += 500) {
          const C = [].concat(...Q.slice(i, i + 500).map(z => qatorKataklar(j, z)));
          natija.katak += C.length; natija.qator += Math.min(500, Q.length - i);
          await IK.qollaDb(k, [{ tur: 'kataklar', kataklar: C }], { sxema: SX, db, jurnalsiz: true });
        }
      }
      const qosh = {}; for (const qo of LUGAT.qoshimcha) qosh[qo.varaq] = V[k + '|' + qo.varaq] || [];
      await IK.qollaDb(k, [], { sxema: SX, db, jurnalsiz: true, lugatManba: { Q: V[k + '|' + LUGAT.varaq] || [], qosh } });
    }
    natija.birinchi = await IS.solishtir(db, { a: SX, b: KUT });
    // 4. qisman yozuvlar
    const tanlov = [];
    for (const k of kom) for (const j of JADVALLAR) for (const z of (V[k + '|' + j.varaq] || [])) if (z.n >= 2) tanlov.push({ k, j, z });
    const olingan = [];
    for (let i = 0; i < Math.min(N, tanlov.length); i++) { const t = Math.floor(rnd() * tanlov.length); olingan.push(tanlov[t]); }
    const yagona = [...new Map(olingan.map(o => [o.k + '|' + o.j.jadval + '|' + o.z.n, o])).values()];
    for (const k of kom) {
      const O = yagona.filter(o => o.k === k);
      if (!O.length) continue;
      await IK.qollaDb(k, [{ tur: 'kataklar', kataklar: [].concat(...O.map(o => qatorKataklar(o.j, o.z).map(c => Object.assign(c, { xom: '' })))) }], { sxema: SX, db, jurnalsiz: true });
      const tartib = O.map(o => { const C = qatorKataklar(o.j, o.z); for (let i = C.length - 1; i > 0; i--) { const r = Math.floor(rnd() * (i + 1)); [C[i], C[r]] = [C[r], C[i]]; }
        if (o.j.faqatSon) { const a = C.findIndex(c => c.u === u0(o.j.faqatSon)); C.unshift(C.splice(a, 1)[0]); }
        if (o.j.qolda) for (const h of Object.keys(o.j.qolda)) { const a = C.findIndex(c => c.u === u0(h)); C.push(C.splice(a, 1)[0]); }   // 01 P — F, G dan keyin (Google'da ham shunday)
        return C; });
      for (let r = 0, max = Math.max(...tartib.map(t => t.length)); r < max; r++)
        await IK.qollaDb(k, [{ tur: 'kataklar', kataklar: tartib.map(t => t[r]).filter(Boolean) }], { sxema: SX, db, jurnalsiz: true });
    }
    natija.qisman = yagona.length;
    // 5. qator o'chirish / qo'shish — eng ko'p qatorli jadvallardan birida va 07c da
    natija.surish = [];
    const kandidat = JADVALLAR.filter(j => j.varaq === '07c_Ertalab_svod' || j.varaq === '05_Tolovlar');
    for (const k of kom) for (const j of kandidat) {
      const Q = (V[k + '|' + j.varaq] || []).filter(z => z.n >= 2);
      if (Q.length < 6) continue;
      const T = qq(j.jadval), kol = j.ustunlar.map(u => qq(u[1])).join(', ');
      const bosh = Q[Math.floor(Q.length / 2)].n;   // o'rtadagi qatordan 2 ta
      await IK.qollaDb(k, [{ tur: 'surish', varaq: j.varaq, bosh, soni: -2 }], { sxema: SX, db, jurnalsiz: true });
      const f = (await db.query(`SELECT count(*)::int n FROM (
          (SELECT qator - CASE WHEN qator >= $2 THEN 2 ELSE 0 END q, ${kol} FROM ${KUT}.${T} WHERE kompaniya_id = $1 AND qator NOT IN ($3, $4)
           EXCEPT ALL SELECT qator, ${kol} FROM ${SX}.${T} WHERE kompaniya_id = $1)
          UNION ALL
          (SELECT qator, ${kol} FROM ${SX}.${T} WHERE kompaniya_id = $1
           EXCEPT ALL SELECT qator - CASE WHEN qator >= $2 THEN 2 ELSE 0 END, ${kol} FROM ${KUT}.${T} WHERE kompaniya_id = $1 AND qator NOT IN ($3, $4))) x`,
        [k, bosh + 2, bosh, bosh + 1])).rows[0].n;
      // qaytarish: 2 ta bo'sh qator qo'shiladi va o'sha qatorlar qayta yoziladi
      await IK.qollaDb(k, [{ tur: 'surish', varaq: j.varaq, bosh, soni: 2 },
        { tur: 'kataklar', kataklar: [].concat(...Q.filter(z => z.n === bosh || z.n === bosh + 1).map(z => qatorKataklar(j, z))) }], { sxema: SX, db, jurnalsiz: true });
      natija.surish.push({ jadval: j.jadval, bosh, farq: f });
    }
    natija.ikkinchi = await IS.solishtir(db, { a: SX, b: KUT });
    natija.xatolar = (await db.query(`SELECT count(*)::int n FROM ((SELECT * FROM ${SX}.xatolar EXCEPT ALL SELECT * FROM ${KUT}.xatolar)
      UNION ALL (SELECT * FROM ${KUT}.xatolar EXCEPT ALL SELECT * FROM ${SX}.xatolar)) x`)).rows[0].n;
  } finally {
    if (!opt.qoldir) { await db.query(`DROP SCHEMA IF EXISTS ${SX} CASCADE`).catch(() => {}); await db.query(`DROP SCHEMA IF EXISTS ${KUT} CASCADE`).catch(() => {}); }
  }
  natija.ms = Date.now() - t0;
  return natija;
}

module.exports = { sinov };
