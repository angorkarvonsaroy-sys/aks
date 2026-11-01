// AKS TIZIM — BAZA KO'CHIRISHI, 1-bosqich: ko'zgu (kozgu.qatorlar, jsonb) → «baza» sxemasidagi haqiqiy jadvallar (01.11.2026).
// Tuzilma va qoidalar — lib/baza_sxema.js. HECH NIMA bu jadvallarga bog'lanmagan (ilova hali ko'zgudan o'qiydi) — shuning uchun
// har to'ldirishda sxema butunlay qaytadan quriladi: «baza_yangi» ga yoziladi, oxirida bitta tranzaksiyada «baza» bilan almashtiriladi.
// Xato bo'lsa — eski «baza» o'z joyida qoladi. Google'ga TEGILMAYDI.
// Qiymat aylantirib bo'lmasa — katak NULL bo'ladi va baza.xatolar ga yoziladi (varaq, qator, ustun, qiymat, sabab).
'use strict';
const { JADVALLAR, LUGAT } = require('./baza_sxema');

const SQL_TUR = { matn: 'text', butun: 'bigint', son: 'numeric', pul: 'numeric(18,2)', sana: 'date', vaqt: 'timestamptz', soat: 'time' };
const KUN = 86400000, EPOXA = Date.UTC(1899, 11, 30);
const ustunN = h => h.split('').reduce((a, c) => a * 26 + c.charCodeAt(0) - 64, 0) - 1;
const p2 = n => String(n).padStart(2, '0');
const bosh = v => v === '' || v === null || v === undefined;

// ---------- qiymat aylantirish: { v } yoki { xato }
function seriyaSana(n) { const d = new Date(EPOXA + Math.floor(n) * KUN); return d.getUTCFullYear() + '-' + p2(d.getUTCMonth() + 1) + '-' + p2(d.getUTCDate()); }
function seriyaVaqt(n) {   // Google seriya raqami — Toshkent mahalliy vaqti
  const ms = Math.round((n - Math.floor(n)) * KUN / 1000) * 1000, d = new Date(EPOXA + Math.floor(n) * KUN + ms);
  return seriyaSana(n) + ' ' + p2(d.getUTCHours()) + ':' + p2(d.getUTCMinutes()) + ':' + p2(d.getUTCSeconds()) + '+05';
}
const togriSana = (y, m, d) => { const t = new Date(Date.UTC(y, m - 1, d)); return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d; };
function matnSana(s) {
  let m = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(s); if (m && togriSana(+m[3], +m[2], +m[1])) return m[3] + '-' + p2(m[2]) + '-' + p2(m[1]);
  m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s); if (m && togriSana(+m[1], +m[2], +m[3])) return s;
  return null;
}
function matnVaqt(s) {
  let m = /^(\d{1,2})\.(\d{1,2})\.(\d{4})[ ,T]+(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(s);
  if (m && togriSana(+m[3], +m[2], +m[1])) return m[3] + '-' + p2(m[2]) + '-' + p2(m[1]) + ' ' + p2(m[4]) + ':' + m[5] + ':' + (m[6] || '00') + '+05';
  m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(s);
  if (m && togriSana(+m[1], +m[2], +m[3])) return m[1] + '-' + m[2] + '-' + m[3] + ' ' + p2(m[4]) + ':' + m[5] + ':' + (m[6] || '00') + '+05';
  const d = matnSana(s); if (d) return d + ' 00:00:00+05';
  return null;
}
const sonMatn = s => { const t = String(s).replace(/[\s  ]/g, '').replace(',', '.'); return /^-?\d+(\.\d+)?$/.test(t) ? Number(t) : null; };

function aylantir(v, tur) {
  if (bosh(v)) return { v: null };
  const s = typeof v === 'string' ? v.trim() : v;
  if (s === '') return { v: null };
  switch (tur) {
    case 'matn':
      if (typeof v === 'number') return { v: Number.isInteger(v) ? String(v) : String(v) };
      if (typeof v === 'boolean') return { v: v ? 'TRUE' : 'FALSE' };
      return { v: String(v) };
    case 'butun': {
      const n = typeof s === 'number' ? s : sonMatn(s);
      if (n === null || !Number.isFinite(n)) return { xato: 'son emas' };
      if (!Number.isInteger(n)) return { xato: 'butun son emas' };
      return { v: n };
    }
    case 'son': case 'pul': {
      const n = typeof s === 'number' ? s : sonMatn(s);
      if (n === null || !Number.isFinite(n)) return { xato: 'son emas' };
      return { v: tur === 'pul' ? Math.round(n * 100) / 100 : n };
    }
    case 'sana': {
      if (typeof s === 'number') return s > 1 && s < 2958466 ? { v: seriyaSana(s) } : { xato: 'sana emas (son ' + s + ')' };
      const d = matnSana(s) || (matnVaqt(s) || '').slice(0, 10);
      return d ? { v: d } : { xato: 'sana emas' };
    }
    case 'vaqt': {
      if (typeof s === 'number') return s > 1 && s < 2958466 ? { v: seriyaVaqt(s) } : { xato: 'vaqt emas (son ' + s + ')' };
      const d = matnVaqt(s);
      return d ? { v: d } : { xato: 'vaqt emas' };
    }
    case 'soat': {
      if (typeof s === 'number' && s >= 0 && s < 1) { const t = Math.round(s * 86400); return { v: p2(Math.floor(t / 3600) % 24) + ':' + p2(Math.floor(t / 60) % 60) + ':' + p2(t % 60) }; }
      const m = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(String(s));
      return m ? { v: p2(m[1]) + ':' + m[2] + ':' + (m[3] || '00') } : { xato: 'soat emas' };
    }
  }
  return { xato: 'noma\'lum tur ' + tur };
}

// ---------- DDL
const q = s => '"' + s + '"';
function jadvalDDL(sx, j) {
  const u = j.ustunlar.map(([, nom, tur]) => '  ' + q(nom) + ' ' + SQL_TUR[tur]).join(',\n');
  return `CREATE TABLE ${sx}.${q(j.jadval)} (\n  kompaniya_id int NOT NULL,\n  qator int NOT NULL,\n${u},\n  PRIMARY KEY (kompaniya_id, qator)\n)`;
}
const izohMatn = s => "'" + String(s).replace(/'/g, "''") + "'";

// ---------- 08_Lugatlar → lugat (kategoriya, tartib, qiymat) · zona (blok, usd_m2) · sozlama (kalit, qiymat). Q — 08_Lugatlar qatorlari [{n, x}],
// qosh(varaq) — LUGAT.qoshimcha varag'ining qatorlari. 02.11: toldir'dan ajratildi — ikki tomonlama yozish (lib/ikki_yozuv.js) ham shuni ishlatadi.
const LUGAT_DDL = SX => [
  `CREATE TABLE ${SX}.lugat (kompaniya_id int NOT NULL, kategoriya text NOT NULL, tartib int NOT NULL, qiymat text NOT NULL, PRIMARY KEY (kompaniya_id, kategoriya, tartib))`,
  `CREATE TABLE ${SX}.zona (kompaniya_id int NOT NULL, blok text NOT NULL, usd_m2 numeric, PRIMARY KEY (kompaniya_id, blok))`,
  `CREATE TABLE ${SX}.sozlama (kompaniya_id int NOT NULL, kalit text NOT NULL, qiymat text, PRIMARY KEY (kompaniya_id, kalit))`];
function lugatQur(k, Q, qosh) {
  const sar = (Q.find(z => z.n === 1) || { x: [] }).x;
  const lug = [], zona = [], soz = [], xatolar = [];
  for (const h of LUGAT.royxat) {
    const kat = String(sar[ustunN(h)] || h).trim();
    Q.filter(z => z.n >= 2 && !bosh(z.x[ustunN(h)])).forEach((z, i) => lug.push({ kompaniya_id: k, kategoriya: kat, tartib: i + 1, qiymat: aylantir(z.x[ustunN(h)], 'matn').v }));
  }
  for (const qo of LUGAT.qoshimcha)
    (qosh(qo.varaq) || []).filter(z => z.n >= 2 && !bosh(z.x[ustunN(qo.ustun)])).forEach((z, i) => lug.push({ kompaniya_id: k, kategoriya: qo.kategoriya, tartib: i + 1, qiymat: aylantir(z.x[ustunN(qo.ustun)], 'matn').v }));
  const [zb, zu] = LUGAT.zona.map(ustunN);
  Q.filter(z => z.n >= 2 && !bosh(z.x[zb])).forEach(z => { const u = aylantir(z.x[zu], 'son');
    if (u.xato) xatolar.push([k, 'zona', LUGAT.varaq, z.n, LUGAT.zona[1], String(z.x[zu]), u.xato]);
    zona.push({ kompaniya_id: k, blok: aylantir(z.x[zb], 'matn').v, usd_m2: u.xato ? null : u.v }); });
  const zs = ustunN(LUGAT.sozlama), Z = Q.filter(z => !bosh(z.x[zs])).map(z => ({ n: z.n, v: z.x[zs] }));
  for (let i = 0; i < Z.length; i++) {   // nom qatori, keyingi qatorda qiymat
    if (typeof Z[i].v !== 'string' || !Z[i + 1] || Z[i + 1].n !== Z[i].n + 1) continue;
    if (!LUGAT.tashla.includes(Z[i].v.trim())) soz.push({ kompaniya_id: k, kalit: Z[i].v.trim(), qiymat: aylantir(Z[i + 1].v, 'matn').v });
    i++;
  }
  return { lugat: lug, zona, sozlama: soz, xatolar };
}

// ---------- to'ldirish
// db — pg Client (yoki pool emas: bitta ulanish, tranzaksiya kerak). natija: { jadvallar: [{jadval, varaq, qator, bosh, xato, takror}], xatolar: N, ms }
// opt.sxema — qaysi sxemaga quriladi (standart «baza»). 02.11: ikki tomonlama yozish yoqilganda «baza» doimiy — kunlik tekshiruv «baza_tekshir» ga quradi.
async function toldir(db, opt = {}) {
  const t0 = Date.now(), MAQSAD = opt.sxema || 'baza', SX = MAQSAD + '_yangi';
  if (!/^[a-z_]+$/.test(MAQSAD)) throw new Error('sxema nomi noto\'g\'ri: ' + MAQSAD);
  const kompaniyalar = opt.kompaniyalar || (await db.query('SELECT id FROM kompaniyalar WHERE faol ORDER BY id')).rows.map(r => r.id);
  const varaqlar = [...new Set(JADVALLAR.map(j => j.varaq).concat(LUGAT.varaq, LUGAT.qoshimcha.map(x => x.varaq)))];
  const natija = { jadvallar: [], xatolar: 0, ms: 0, kompaniyalar, sxema: MAQSAD };
  await db.query('BEGIN ISOLATION LEVEL REPEATABLE READ');
  try {
    await db.query(`DROP SCHEMA IF EXISTS ${SX} CASCADE`);
    await db.query(`CREATE SCHEMA ${SX}`);
    await db.query(`CREATE TABLE ${SX}.xatolar (kompaniya_id int, jadval text, varaq text, qator int, ustun text, qiymat text, sabab text)`);
    // ko'zgudagi qatorlar — bitta o'qishda (REPEATABLE READ: ko'zgu shu orada yangilansa ham bir xil holat)
    const R = await db.query(`SELECT kompaniya_id, varaq, qator_no, data FROM kozgu.qatorlar WHERE kompaniya_id = ANY($1) AND varaq = ANY($2) ORDER BY kompaniya_id, varaq, qator_no`, [kompaniyalar, varaqlar]);
    const V = {};   // `${k}|${varaq}` → [{n, x}]
    for (const r of R.rows) { const k = r.kompaniya_id + '|' + r.varaq; (V[k] = V[k] || []).push({ n: r.qator_no, x: Array.isArray(r.data) ? r.data : [] }); }
    const xatolar = [];
    for (const j of JADVALLAR) {
      await db.query(jadvalDDL(SX, j));
      await db.query(`COMMENT ON TABLE ${SX}.${q(j.jadval)} IS ${izohMatn('AKS_BAZA «' + j.varaq + '» (qo\'lda kiritiladigan ustunlar; hisob: ' + (j.hisob || '—') + ')')}`);
      for (const [h, nom, , sar] of j.ustunlar) await db.query(`COMMENT ON COLUMN ${SX}.${q(j.jadval)}.${q(nom)} IS ${izohMatn(h + ' ' + (sar || ''))}`);
      const hisobot = { jadval: j.jadval, varaq: j.varaq, qator: 0, bosh: 0, xato: 0, takror: 0, tashlandi: 0 };
      for (const k of kompaniyalar) {
        const Q = V[k + '|' + j.varaq] || [];
        const sarlavha = (Q.find(z => z.n === 1) || { x: [] }).x;
        // sarlavha tekshiruvi: ustun surilgan bo'lsa — butun yurish to'xtaydi (eski «baza» joyida qoladi)
        const farq = j.ustunlar.filter(([h, , , sar]) => String(sarlavha[ustunN(h)] == null ? '' : sarlavha[ustunN(h)]).trim() !== String(sar || '').trim());
        if (Q.length && farq.length) throw new Error(j.varaq + ': sarlavha mos emas — ' + farq.slice(0, 5).map(([h, , , sar]) => h + ' kutilgan «' + sar + '», bor «' + (sarlavha[ustunN(h)] || '') + '»').join('; '));
        const qatorlar = [];
        const kalitlar = new Map();
        for (const { n, x } of Q) {
          if (n < 2) continue;
          if (j.faqatSon && typeof x[ustunN(j.faqatSon)] !== 'number') { if (j.ustunlar.some(([h]) => !bosh(x[ustunN(h)]))) hisobot.tashlandi++; continue; }
          if (j.ustunlar.every(([h]) => bosh(x[ustunN(h)]))) { hisobot.bosh++; continue; }   // faqat formula natijasi bor qator
          const o = { kompaniya_id: k, qator: n };
          for (const [h, nom, tur] of j.ustunlar) {
            let xom = x[ustunN(h)];
            if (j.qolda && j.qolda[h]) {   // P ≠ F×G bo'lsagina
              const [a, b] = j.qolda[h].map(u => Number(x[ustunN(u)]));
              if (typeof xom === 'number' && Number.isFinite(a) && Number.isFinite(b) && Math.abs(xom - a * b) <= 0.5) xom = '';
            }
            const r = aylantir(xom, tur);
            if (r.xato) { o[nom] = null; xatolar.push([k, j.jadval, j.varaq, n, h, String(xom).slice(0, 200), r.xato]); hisobot.xato++; }
            else o[nom] = r.v;
          }
          if (j.kalit) {
            const kv = o[j.ustunlar.find(([h]) => h === j.kalit)[1]];
            if (kv !== null && kv !== undefined) { const kk = String(kv); if (kalitlar.has(kk)) hisobot.takror++; else kalitlar.set(kk, n); }
          }
          qatorlar.push(o);
        }
        for (let i = 0; i < qatorlar.length; i += 1000)
          await db.query(`INSERT INTO ${SX}.${q(j.jadval)} SELECT * FROM jsonb_populate_recordset(NULL::${SX}.${q(j.jadval)}, $1::jsonb)`, [JSON.stringify(qatorlar.slice(i, i + 1000))]);
        hisobot.qator += qatorlar.length;
      }
      if (j.kalit) { const kn = j.ustunlar.find(([h]) => h === j.kalit)[1]; await db.query(`CREATE INDEX ON ${SX}.${q(j.jadval)} (kompaniya_id, ${q(kn)})`); }
      natija.jadvallar.push(hisobot);
    }
    for (const s of LUGAT_DDL(SX)) await db.query(s);
    const L = { lugat: 0, zona: 0, sozlama: 0 };
    for (const k of kompaniyalar) {
      const M = lugatQur(k, V[k + '|' + LUGAT.varaq] || [], v => V[k + '|' + v]);
      xatolar.push(...M.xatolar);
      for (const t of ['lugat', 'zona', 'sozlama'])
        if (M[t].length) { await db.query(`INSERT INTO ${SX}.${t} SELECT * FROM jsonb_populate_recordset(NULL::${SX}.${t}, $1::jsonb)`, [JSON.stringify(M[t])]); L[t] += M[t].length; }
    }
    // 2-bosqich: Google formulalari o'rnini bosadigan view'lar (lib/baza_hisob.js) — jadvallar bilan birga
    for (const s of require('./baza_hisob').sql(SX)) await db.query(s);
    for (const t of ['lugat', 'zona', 'sozlama']) natija.jadvallar.push({ jadval: t, varaq: t === 'lugat' ? LUGAT.varaq + ' + 08b D' : LUGAT.varaq, qator: L[t], bosh: 0, xato: 0, takror: 0, tashlandi: 0 });
    for (let i = 0; i < xatolar.length; i += 1000)
      await db.query(`INSERT INTO ${SX}.xatolar SELECT * FROM jsonb_to_recordset($1::jsonb) AS t(kompaniya_id int, jadval text, varaq text, qator int, ustun text, qiymat text, sabab text)`,
        [JSON.stringify(xatolar.slice(i, i + 1000).map(([kompaniya_id, jadval, varaq, qator, ustun, qiymat, sabab]) => ({ kompaniya_id, jadval, varaq, qator, ustun, qiymat, sabab })))]);
    natija.xatolar = xatolar.length;
    // almashtirish — bitta tranzaksiyada
    await db.query(`DROP SCHEMA IF EXISTS ${MAQSAD} CASCADE`);
    await db.query(`ALTER SCHEMA ${SX} RENAME TO ${MAQSAD}`);
    await db.query(`COMMENT ON SCHEMA ${MAQSAD} IS ${izohMatn('AKS_BAZA dan qurilgan jadvallar (1-bosqich). Oxirgi to\'ldirish: ' + new Date().toISOString())}`);
    await db.query('COMMIT');
  } catch (e) {
    await db.query('ROLLBACK').catch(() => {});
    throw e;
  }
  natija.ms = Date.now() - t0;
  return natija;
}

module.exports = { toldir, aylantir, jadvalDDL, lugatQur, LUGAT_DDL, SQL_TUR, _ichki: { seriyaSana, seriyaVaqt, matnSana, matnVaqt, ustunN, bosh } };
