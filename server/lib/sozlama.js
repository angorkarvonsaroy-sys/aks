// AKS TIZIM — ⚙ SERVER SOZLAMALARI (02.11.2026, sql/009). Eski tizim Script Properties'da saqlagan sozlamalar endi server bazasida:
//   'xat_zanjir' — XAT_ZANJIR (lib/xat_yordam.js), 'top_qoida' — TOP_QOIDA (api/topshiriq.js) → jadval server_sozlama;
//   ertalabki ish navbati QD_NAVBAT_* (api/qadam.js qdSnap) → jadval qd_navbat.
// Birinchi o'qishda qiymat bazada yo'q bo'lsa — eskidan() orqali eski joydan BIR MARTA ko'chiriladi; keyin manba — faqat shu jadval.
// O'qish 60 s xotirada turadi (ilova bitta jarayon — yozuv xotirani darhol yangilaydi).
'use strict';
const { q } = require('./db');

const XOTIRA_MS = 60000;
const X = new Map();          // 'kompaniya|kalit' → { t, v }
const kochish = new Map();    // bir vaqtda ikki ko'chirish bo'lmasin

async function ol(kalit, k = 1) {
  const kk = k + '|' + kalit, m = X.get(kk);
  if (m && Date.now() - m.t < XOTIRA_MS) return m.v;
  const r = await q('SELECT qiymat FROM server_sozlama WHERE kompaniya_id = $1 AND kalit = $2', [k, kalit]);
  const v = r.rows.length ? r.rows[0].qiymat : null;
  if (v !== null) X.set(kk, { t: Date.now(), v });
  return v;
}

// Bazada bo'lmasa — eskidan(): { qiymat, manba } yoki null (hozir olib bo'lmadi — keyingi o'qishda yana urinadi). Qaytaradi: qiymat | null
async function olYokiKochir(kalit, eskidan, k = 1) {
  const v = await ol(kalit, k); if (v !== null) return v;
  const kk = k + '|' + kalit;
  if (!kochish.has(kk)) kochish.set(kk, (async () => {
    try {
      const e = await eskidan(); if (!e) return null;
      await q(`INSERT INTO server_sozlama (kompaniya_id, kalit, qiymat, kim, manba) VALUES ($1, $2, $3::jsonb, 'ko''chirish', $4)
        ON CONFLICT (kompaniya_id, kalit) DO NOTHING`, [k, kalit, JSON.stringify(e.qiymat), e.manba]);
      X.delete(kk);
      return await ol(kalit, k);
    } finally { kochish.delete(kk); }
  })());
  return kochish.get(kk);
}

// butunlay almashtirish
async function yoz(kalit, qiymat, kim, k = 1) {
  const r = await q(`INSERT INTO server_sozlama (kompaniya_id, kalit, qiymat, kim, manba) VALUES ($1, $2, $3::jsonb, $4, 'server')
    ON CONFLICT (kompaniya_id, kalit) DO UPDATE SET qiymat = EXCLUDED.qiymat, kim = EXCLUDED.kim, manba = 'server', yangilandi = now()
    RETURNING qiymat`, [k, kalit, JSON.stringify(qiymat), kim || null]);
  X.set(k + '|' + kalit, { t: Date.now(), v: r.rows[0].qiymat });
  return r.rows[0].qiymat;
}

// obyektga kalitlar qo'shish (qiymat || obj) — bir vaqtdagi ikki yozuv bir-birini o'chirmaydi
async function qosh(kalit, obj, kim, k = 1) {
  const r = await q(`INSERT INTO server_sozlama (kompaniya_id, kalit, qiymat, kim, manba) VALUES ($1, $2, $3::jsonb, $4, 'server')
    ON CONFLICT (kompaniya_id, kalit) DO UPDATE SET qiymat = server_sozlama.qiymat || EXCLUDED.qiymat, kim = EXCLUDED.kim, manba = 'server', yangilandi = now()
    RETURNING qiymat`, [k, kalit, JSON.stringify(obj), kim || null]);
  X.set(k + '|' + kalit, { t: Date.now(), v: r.rows[0].qiymat });
  return r.rows[0].qiymat;
}

async function malumot(kalit, k = 1) {
  const r = await q('SELECT qiymat, yangilandi, kim, manba FROM server_sozlama WHERE kompaniya_id = $1 AND kalit = $2', [k, kalit]);
  return r.rows[0] || null;
}

// ------------------------------------------------------------------ ertalabki ish navbati (qd_navbat)
let tozalandi = '';
async function navbatOl(fish, sana, k = 1) {
  const r = await q('SELECT nolar FROM qd_navbat WHERE kompaniya_id = $1 AND sana = $2 AND fish = $3', [k, sana, String(fish)]);
  return r.rows.length ? r.rows[0].nolar : null;
}
// nolar — qo'shiladi (bor ro'yxat bilan birlashadi)
async function navbatQosh(fish, sana, nolar, k = 1) {
  if (tozalandi !== sana) { tozalandi = sana; q(`DELETE FROM qd_navbat WHERE sana < $1::date - 14`, [sana]).catch(e => console.error('qd_navbat tozalash:', e.message)); }
  await q(`INSERT INTO qd_navbat (kompaniya_id, sana, fish, nolar) VALUES ($1, $2, $3, $4::jsonb)
    ON CONFLICT (kompaniya_id, sana, fish) DO UPDATE SET yangilandi = now(),
      nolar = (SELECT coalesce(jsonb_agg(DISTINCT e), '[]'::jsonb) FROM jsonb_array_elements(qd_navbat.nolar || EXCLUDED.nolar) e)`,
  [k, sana, String(fish), JSON.stringify((nolar || []).map(String))]);
}

module.exports = { ol, olYokiKochir, yoz, qosh, malumot, navbatOl, navbatQosh, _ichki: { X } };
