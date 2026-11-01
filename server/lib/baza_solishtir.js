// AKS TIZIM — BAZA KO'CHIRISHI, 2-bosqich: HAR QATOR solishtiruvi — Google hisoblagan qiymat (ko'zgu) ↔ server hisobi (baza view'lari).
// Ro'yxat — lib/baza_hisob.js SOLISHTIR. «0 farq» bo'lmaguncha keyingi bosqichga o'tilmaydi (claude/BAZA_KOCHIRISH_REJA.md).
// BUGUN — varaqdagi 08_Lugatlar!Z2 (Google shu sana bilan hisoblagan), view'ga `SET LOCAL aks.bugun` bilan beriladi.
'use strict';
const { SOLISHTIR } = require('./baza_hisob');

const KUN = 86400000, EPOXA = Date.UTC(1899, 11, 30);
const bosh = v => v === '' || v === null || v === undefined;
const son = v => (typeof v === 'number' ? v : (typeof v === 'string' && v.trim() !== '' && !isNaN(Number(v)) ? Number(v) : null));

async function bugunVaraqdan(db, k) {
  const r = (await db.query(`SELECT data->25 AS z FROM kozgu.qatorlar WHERE kompaniya_id = $1 AND varaq = '08_Lugatlar' AND qator_no = 2`, [k])).rows[0];
  const z = r && son(r.z);
  if (!z) return null;
  const d = new Date(EPOXA + Math.floor(z) * KUN);
  return d.toISOString().slice(0, 10);
}

// natija: { bugun, ustunlar: [{varaq, harf, ustun, jami, teng, farq, misollar: [{qator, no, google, server}]}], qatorYoq: {varaq: n} }
async function solishtir(db, opt = {}) {
  const k = opt.kompaniya || 1, misol = opt.misol || 12;
  const bugun = opt.bugun || await bugunVaraqdan(db, k);
  const natija = { bugun, ustunlar: [], qatorYoq: {} };
  await db.query('BEGIN ISOLATION LEVEL REPEATABLE READ');
  try {
    if (bugun) await db.query(`SELECT set_config('aks.bugun', $1, true)`, [bugun]);
    const guruh = {};
    for (const s of SOLISHTIR) (guruh[s[0] + '|' + s[3]] = guruh[s[0] + '|' + s[3]] || []).push(s);
    for (const key of Object.keys(guruh)) {
      const L = guruh[key], [varaq, , , view] = L[0];
      const G = (await db.query(`SELECT qator_no, data FROM kozgu.qatorlar WHERE kompaniya_id = $1 AND varaq = $2 AND qator_no >= 2 ORDER BY qator_no`, [k, varaq])).rows;
      const V = new Map((await db.query(`SELECT * FROM baza.${view} WHERE kompaniya_id = $1`, [k])).rows.map(r => [r.qator, r]));
      let yoq = 0;
      const H = L.map(([, i, harf, , ustun, aniq]) => ({ varaq, harf, ustun, i, aniq, jami: 0, teng: 0, farq: 0, misollar: [] }));
      for (const { qator_no, data } of G) {
        const x = Array.isArray(data) ? data : [];
        const v = V.get(qator_no);
        if (!v) { if (H.some(h => !bosh(x[h.i]))) yoq++; continue; }
        for (const h of H) {
          const g = x[h.i], s = v[h.ustun];
          if (bosh(g) && bosh(s)) { h.jami++; h.teng++; continue; }
          h.jami++;
          const gn = son(g), sn = son(s);
          const ok = gn !== null && sn !== null ? Math.abs(gn - sn) <= (h.aniq || 1e-6) : String(g).trim() === String(s == null ? '' : s).trim();
          if (ok) h.teng++;
          else { h.farq++; if (h.misollar.length < misol) h.misollar.push({ qator: qator_no, no: String(x[0] == null ? '' : x[0]), google: bosh(g) ? '(bo\'sh)' : g, server: bosh(s) ? '(bo\'sh)' : sn !== null ? sn : s }); }
        }
      }
      natija.ustunlar.push(...H);
      if (yoq) natija.qatorYoq[varaq] = yoq;
    }
    await db.query('COMMIT');
  } catch (e) { await db.query('ROLLBACK').catch(() => {}); throw e; }
  return natija;
}

module.exports = { solishtir, bugunVaraqdan };
