// AKS TIZIM — 🗄 BAZA KO'CHIRISHI, 3-bosqich (2b): «baza» (ikki tomonlama yozish bilan yashaydigan) ↔ «baza_tekshir» (ko'zgudan yangidan qurilgan)
// — 39 jadval + lugat/zona/sozlama, har qator, har ustun (02.11.2026). Google jadvalga va ilovaga TEGMAYDI.
// Farq qilgan qator ikki xil bo'ladi:
//   • «ikki»   — bu qatorga server oxirgi tekshiruvdan beri yozgan (jurnalda bor) → ikki tomonlama yozishdagi xato bo'lishi mumkin — direktorga xabar.
//   • «tashqi» — server tegmagan: Google'da qo'lda tuzatilgan yoki eski tizim yozgan (bu yo'l 5-bosqichda yo'qoladi) — faqat sanaladi.
// Oxirgi daqiqalarda yozilgan qatorlar (ko'zgu ularni hali ko'rmagan bo'lishi mumkin) — chiqarib tashlanadi.
// tuzat: true — farq qilgan qatorlar «baza» da «baza_tekshir» dagidek qilinadi (har kecha: kun xatosi ertangi kunga o'tmasin).
'use strict';
const { JADVALLAR } = require('./baza_sxema');

const qq = s => '"' + s + '"';
const s = v => String(v == null ? '' : v);
const LUGAT_JADVALLAR = [['lugat', ['kategoriya', 'tartib', 'qiymat']], ['zona', ['blok', 'usd_m2']], ['sozlama', ['kalit', 'qiymat']]];

async function ustunlar(db, sx, t) {
  return (await db.query(`SELECT column_name FROM information_schema.columns WHERE table_schema = $1 AND table_name = $2 ORDER BY ordinal_position`, [sx, t])).rows.map(r => r.column_name);
}
// opt: { a: 'baza', b: 'baza_tekshir', dan (Date — shundan keyin yozilgan qatorlar chiqariladi), oldin (Date — «ikki»/«tashqi» ajratish oynasi boshi),
//        tuzat, misol (har jadvalda nechta misol) }
async function solishtir(db, opt = {}) {
  const A = opt.a || 'baza', Bs = opt.b || 'baza_tekshir', misolN = opt.misol || 3;
  for (const sx of [A, Bs]) if (!(await db.query(`SELECT 1 FROM information_schema.schemata WHERE schema_name = $1`, [sx])).rows.length) throw new Error('«' + sx + '» sxemasi yo\'q');
  // jurnal: qaysi qatorga kim qachon yozgan
  const teg = new Map();   // jadval|k|qator → { vaqt, amal }
  if (opt.oldin || opt.dan) {
    const R = await db.query(`SELECT jadval, kompaniya_id k, q, max(vaqt) vaqt, (array_agg(amal ORDER BY vaqt DESC))[1] amal
      FROM baza_ikki_jurnal, unnest(qatorlar) q WHERE vaqt >= $1 AND jadval IS NOT NULL AND holat <> 'tashqari' GROUP BY 1, 2, 3`, [opt.oldin || opt.dan]);
    for (const r of R.rows) teg.set(r.jadval + '|' + r.k + '|' + r.q, { vaqt: new Date(r.vaqt), amal: r.amal });
  }
  const lugatVaqt = async t => t ? (await db.query(`SELECT max(vaqt) v FROM baza_ikki_jurnal WHERE jadval = 'lugat' AND vaqt >= $1`, [t])).rows[0].v : null;
  const lugatTeg = await lugatVaqt(opt.dan), lugatOldin = await lugatVaqt(opt.oldin);
  const natija = { jadvallar: [], jami: { farq: 0, ikki: 0, tashqi: 0, chiqarildi: 0, tuzatildi: 0, katak: 0 } };
  for (const j of JADVALLAR) {
    const T = qq(j.jadval), kol = j.ustunlar.map(u => u[1]);
    const ua = await ustunlar(db, A, j.jadval), ub = await ustunlar(db, Bs, j.jadval);
    if (s(ua) !== s(ub)) throw new Error(j.jadval + ': «' + A + '» va «' + Bs + '» da ustunlar har xil (sxema o\'zgargan?) — aks-baza tikla kerak');
    const sh = kol.map(c => `a.${qq(c)} IS DISTINCT FROM b.${qq(c)}`).join(' OR ');
    const R = await db.query(`SELECT coalesce(a.kompaniya_id, b.kompaniya_id) k, coalesce(a.qator, b.qator) qator, a.qator IS NULL a_yoq, b.qator IS NULL b_yoq,
        array_remove(ARRAY[${kol.map(c => `CASE WHEN a.${qq(c)} IS DISTINCT FROM b.${qq(c)} THEN '${c}' END`).join(', ')}], NULL) ustun,
        to_jsonb(a) av, to_jsonb(b) bv
      FROM ${A}.${T} a FULL JOIN ${Bs}.${T} b ON a.kompaniya_id = b.kompaniya_id AND a.qator = b.qator
      WHERE a.qator IS NULL OR b.qator IS NULL OR ${sh} ORDER BY 1, 2 LIMIT 20000`);
    const jami = Number((await db.query(`SELECT count(*) n FROM ${Bs}.${T}`)).rows[0].n);
    natija.jami.katak += jami * kol.length;
    const h = { jadval: j.jadval, varaq: j.varaq, qator: jami, farq: 0, ikki: 0, tashqi: 0, chiqarildi: 0, tuzatildi: 0, ustunlar: {}, misollar: [] };
    const tuzat = new Map();   // k → [qator]
    for (const r of R.rows) {
      const t = teg.get(j.jadval + '|' + r.k + '|' + r.qator);
      if (t && opt.dan && t.vaqt >= opt.dan) { h.chiqarildi++; continue; }
      const tur = t ? 'ikki' : 'tashqi';
      h.farq++; h[tur]++;
      const U = r.a_yoq ? ['(' + A + ' da qator yo\'q)'] : r.b_yoq ? ['(' + Bs + ' da qator yo\'q)'] : r.ustun;
      U.forEach(u => { h.ustunlar[u] = (h.ustunlar[u] || 0) + 1; });
      if (h.misollar.filter(m => m.tur === tur).length < misolN) {
        const harf = nom => (j.ustunlar.find(u => u[1] === nom) || [nom])[0];
        h.misollar.push({ tur, qator: r.qator, k: r.k, amal: t ? t.amal : null,
          ustunlar: r.a_yoq || r.b_yoq ? U : r.ustun.slice(0, 4).map(u => ({ ustun: harf(u) + ' ' + u, a: r.av[u], b: r.bv[u] })) });
      }
      if (!tuzat.has(r.k)) tuzat.set(r.k, []); tuzat.get(r.k).push(r.qator);
    }
    if (opt.tuzat) for (const [k, Q] of tuzat) {
      await db.query(`DELETE FROM ${A}.${T} WHERE kompaniya_id = $1 AND qator = ANY($2)`, [k, Q]);
      await db.query(`INSERT INTO ${A}.${T} SELECT * FROM ${Bs}.${T} WHERE kompaniya_id = $1 AND qator = ANY($2)`, [k, Q]);
      h.tuzatildi += Q.length;
    }
    if (R.rows.length >= 20000) h.toliqEmas = true;
    for (const x of ['farq', 'ikki', 'tashqi', 'chiqarildi', 'tuzatildi']) natija.jami[x] += h[x];
    natija.jadvallar.push(h);
  }
  // lugat / zona / sozlama — butun jadval bo'yicha (kalit qator emas)
  for (const [t, kol] of LUGAT_JADVALLAR) {
    const K = kol.map(qq).join(', ');
    const R = await db.query(`SELECT kompaniya_id k, '+' ishora, ${K} FROM (SELECT kompaniya_id, ${K} FROM ${A}.${t} EXCEPT ALL SELECT kompaniya_id, ${K} FROM ${Bs}.${t}) x
      UNION ALL SELECT kompaniya_id, '-', ${K} FROM (SELECT kompaniya_id, ${K} FROM ${Bs}.${t} EXCEPT ALL SELECT kompaniya_id, ${K} FROM ${A}.${t}) y LIMIT 5000`);
    const jami = Number((await db.query(`SELECT count(*) n FROM ${Bs}.${t}`)).rows[0].n);
    const h = { jadval: t, varaq: '08_Lugatlar', qator: jami, farq: 0, ikki: 0, tashqi: 0, chiqarildi: 0, tuzatildi: 0, ustunlar: {}, misollar: [] };
    if (R.rows.length) {
      if (lugatTeg) h.chiqarildi = R.rows.length;
      else {
        const tur = lugatOldin ? 'ikki' : 'tashqi';
        h.farq = R.rows.length; h[tur] = R.rows.length;
        h.misollar = R.rows.slice(0, misolN).map(r => ({ tur, qator: '', k: r.k, ustunlar: [(r.ishora === '+' ? A + ' da ortiqcha: ' : Bs + ' da bor, ' + A + ' da yo\'q: ') + kol.map(c => s(r[c])).join(' · ')] }));
        if (opt.tuzat) for (const k of [...new Set(R.rows.map(r => r.k))]) {
          await db.query(`DELETE FROM ${A}.${t} WHERE kompaniya_id = $1`, [k]);
          await db.query(`INSERT INTO ${A}.${t} SELECT * FROM ${Bs}.${t} WHERE kompaniya_id = $1`, [k]);
          h.tuzatildi = R.rows.length;
        }
      }
    }
    for (const x of ['farq', 'ikki', 'tashqi', 'chiqarildi', 'tuzatildi']) natija.jami[x] += h[x];
    natija.jadvallar.push(h);
  }
  if (opt.tuzat) {   // aylantirib bo'lmagan kataklar ro'yxati ham yangilansin (aks-baza xatolar)
    await db.query(`DELETE FROM ${A}.xatolar`);
    await db.query(`INSERT INTO ${A}.xatolar SELECT * FROM ${Bs}.xatolar`);
  }
  return natija;
}

module.exports = { solishtir };
