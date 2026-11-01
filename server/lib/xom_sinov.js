// AKS TIZIM — 🗄 3-bosqichga tayyorgarlik (02.11.2026): «ko'ringan matn» (r) o'rniga xom qiymat (x).
// Kod 33 joyda Google hisoblagan ustunni jadvalda KO'RINGAN MATNDAN o'qiydi (ming ajratgich, «dd.MM.yyyy» va h.k.) — BAZA_INVENTAR 8.5.
// «baza» jadvallarida ko'ringan matn yo'q, faqat qiymat — shuning uchun bu joylar xom qiymatga o'tadi.
// Bu sinov har joy uchun ko'zgudagi HAR QATORda: hozirgi kod natijasi (r dan) ↔ xom qiymatdan chiqadigan natija — aynan teng bo'lishi shart.
// Faqat o'qiydi: Google jadvalga, ko'zguga va ilovaga TEGMAYDI.
'use strict';
const Q = require('./qiymat');

const s = v => String(v == null ? '' : v);
const SHnum = v => Number(s(v).replace(/[^\d.-]/g, '')) || 0;                       // lib/sotuv_hujjat.js num
const m2eski = v => Number(s(v).replace(',', '.').replace(/[^\d.]/g, '')) || 0;     // api/reyestr.js reyestrIjara m2

// [joy, varaq, ustunlar, eski (ko'ringan matn katagi → kod oladigan qiymat), yangi (xom katak → qiymat)]
const JOYLAR = [
  ['api/mijoz.js — mijoz kartasi', '03_Sotuv_shartnomalar', ['Z', 'AA', 'AB', 'AC', 'AD', 'AE', 'AF', 'AG'], r => Q.son(r), x => Q.son(x)],
  ['api/mijoz.js — mijoz kartasi', '04_Ijara_shartnomalar', ['AC'], r => r || '', x => Q.korSana(x) || ''],
  ['api/mijoz.js — mijoz kartasi', '01_Dokonlar', ['Q', 'S', 'V', 'W', 'X', 'Y', 'Z'], r => r || '', x => Q.matn(x) || ''],
  ['api/mijoz.js — mijoz kartasi', '05_Tolovlar', ['M'], r => s(r).trim(), x => Q.matn(x).trim()],
  ['api/reyestr.js — sotuv reyestri', '03_Sotuv_shartnomalar', ['U'], r => s(r), x => Q.matn(x)],
  ['api/reyestr.js — sotuv reyestri', '03_Sotuv_shartnomalar', ['Z', 'AA', 'AB', 'AE', 'AF', 'AG'], r => Q.son(r), x => Q.son(x)],
  ['api/reyestr.js — ijara reyestri', '04_Ijara_shartnomalar', ['X', 'Y'], r => s(r), x => Q.matn(x)],
  ['api/reyestr.js — ijara reyestri', '04_Ijara_shartnomalar', ['Z'], m2eski, x => Q.son(x)],
  ['api/reyestr.js — ijara reyestri', '04_Ijara_shartnomalar', ['AC'], r => s(r), x => Q.korSana(x)],
  ['lib/sotuv_hujjat.js — sotuv shartnomasi PDF', '03_Sotuv_shartnomalar', ['W'], SHnum, x => SHnum(Q.matn(x))],
  ['lib/ijara_hujjat.js — ijara shartnomasi PDF', '04_Ijara_shartnomalar', ['AC'], r => s(r), x => Q.korSana(x)],
  ['api/xarita.js — xarita', '04_Ijara_shartnomalar', ['AC'], r => s(r), x => Q.korSana(x)],
  ['api/shartnoma.js — bugungi to\'lovlar', '05_Tolovlar', ['N'], r => s(r), x => Q.matn(x)],
  ['api/top_avto.js — avto topshiriqlar', '05b_Bufer_tolovlar', ['L'], r => s(r), x => Q.matn(x)]
];
const indeks = h => h.split('').reduce((a, c) => a * 26 + c.charCodeAt(0) - 64, 0) - 1;

// db — pg Client/Pool. Natija: [{ joy, varaq, harf, jami, farq, misollar:[{qator, no, eski, yangi, xom}] }]
async function xomSinov(db, kompaniya = 1) {
  const kesh = {};
  const qatorlar = async varaq => kesh[varaq] || (kesh[varaq] = (await db.query(
    `SELECT qator_no, data, korinish FROM kozgu.qatorlar WHERE kompaniya_id = $1 AND varaq = $2 AND qator_no >= 2 ORDER BY qator_no`, [kompaniya, varaq])).rows
    .map(q => { const x = Array.isArray(q.data) ? q.data : [];
      const r = Array.isArray(q.korinish) ? q.korinish.map(v => v == null ? '' : String(v)) : x.map(Q.matn);   // lib/varaq.js qatorlar bilan bir xil
      return { n: q.qator_no, x, r }; })
    .filter(z => s(z.r[0]).trim() || s(z.x[0]).trim()));
  const N = [];
  for (const [joy, varaq, harflar, eski, yangi] of JOYLAR) {
    const R = await qatorlar(varaq);
    for (const h of harflar) {
      const i = indeks(h), u = { joy, varaq, harf: h, jami: R.length, farq: 0, misollar: [] };
      for (const z of R) {
        const a = eski(z.r[i] == null ? '' : z.r[i]), b = yangi(z.x[i] == null ? '' : z.x[i]);
        if (a === b) continue;
        u.farq++;
        if (u.misollar.length < 5) u.misollar.push({ qator: z.n, no: s(z.r[0]), eski: a, yangi: b, xom: z.x[i] });
      }
      N.push(u);
    }
  }
  return N;
}

module.exports = { xomSinov, JOYLAR };
