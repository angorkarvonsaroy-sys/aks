// AKS TIZIM — 🗄 BAZA KO'CHIRISHI, 3-bosqich: IKKI TOMONLAMA YOZISH (02.11.2026). Reja: loyiha hujjati claude/IKKI_YOZISH_REJA.md.
// Server AKS_BAZA ga nima yozsa (lib/google.js dagi yozuv funksiyalari), o'sha o'zgarish shu zahoti «baza» jadvallariga ham qo'llanadi.
//   • Qiymat — Google'ning O'Z JAVOBIDAN (includeValuesInResponse, UNFORMATTED + SERIAL_NUMBER): katakda haqiqatda saqlangan xom qiymat,
//     ko'zgu (kozgu.qatorlar.data) bilan aynan bir xil ko'rinishda. USER_ENTERED talqinini serverda takrorlash shart emas.
//     Javobda qiymat bo'lmaydigan so'rovlar (copyPaste, formula) — o'sha kataklar Google'dan qayta o'qiladi.
//   • Keyin 1-bosqichdagi qoidalar (lib/baza.js: aylantir, qolda, faqatSon, bo'sh qator) — shuning uchun «baza» kechasi ko'zgudan qurilgan
//     nusxa («baza_tekshir») bilan katakma-katak bir xil bo'lishi kerak (lib/ikki_solishtir.js).
//   • 08_Lugatlar / 08b_Hududlar ga yozuvdan keyin lugat / zona / sozlama Google'dan qayta o'qib quriladi.
// Bayroq: Redis «ikki_yozuv_yondi» = '1' (aks-baza ikki yoq | ochir), 15 s kesh. O'CHIQ bo'lsa google.js hech narsani o'zgartirmaydi
// (so'rov ham, javob ham bugungidek). XAVFSIZLIK: bu yerdagi har qanday xato xodimga QAYTMAYDI (Google — asosiy, yozuv bo'lib bo'lgan) —
// baza_ikki_jurnal ga «xato» + direktorga Telegram (soatiga ko'pi bilan 1). Har qo'llash — baza_ikki_jurnal (aks-baza ikki jurnal).
'use strict';
const { AsyncLocalStorage } = require('async_hooks');
const path = require('path');
const { JADVALLAR, LUGAT } = require('./baza_sxema');
const B = require('./baza');

const BAYROQ = 'ikki_yozuv_yondi';
const ECHO = { includeValuesInResponse: true, responseValueRenderOption: 'UNFORMATTED_VALUE', responseDateTimeRenderOption: 'SERIAL_NUMBER' };
const ECHO_URL = '&includeValuesInResponse=true&responseValueRenderOption=UNFORMATTED_VALUE&responseDateTimeRenderOption=SERIAL_NUMBER';
const KATAK_MAX = 2000;   // jurnalda bitta yozuvda saqlanadigan kataklar (tiklashda qayta qo'llash uchun)

const u0 = h => h.split('').reduce((a, c) => a * 26 + c.charCodeAt(0) - 64, 0) - 1;
const harf = n => { n += 1; let r = ''; while (n > 0) { const m = (n - 1) % 26; r = String.fromCharCode(65 + m) + r; n = Math.floor((n - 1) / 26); } return r; };
const bosh = v => v === '' || v === null || v === undefined;
const qq = s => '"' + s + '"';
const s = v => String(v == null ? '' : v);
const guruhla = (A, f) => { const M = new Map(); for (const a of A) { const k = f(a); if (!M.has(k)) M.set(k, []); M.get(k).push(a); } return M; };

// varaq → { j (sxema), kol: ustun indeksi (0 dan) → [harf, nom, tur, sarlavha], hisob: formula ustunlari }
const XARITA = new Map(JADVALLAR.map(j => [j.varaq, { j, kol: new Map(j.ustunlar.map(u => [u0(u[0]), u])), hisob: new Set(s(j.hisob).split(/\s+/).filter(Boolean).map(u0)) }]));
const LUGAT_VARAQ = new Set([LUGAT.varaq].concat(LUGAT.qoshimcha.map(x => x.varaq)));
const kerakli = varaq => XARITA.has(varaq) || LUGAT_VARAQ.has(varaq);
const sinovVaraq = varaq => /^zz_/.test(s(varaq));   // bin/yozuv_sinov nusxalari — e'tiborsiz

// ---------- kim yozdi (jurnal uchun): api/index.js rpc → fn nomi, lib/vaqt.js → 'vaqt:<ish>', lib/tg_poll.js → 'tg'
const ALS = new AsyncLocalStorage();
const STANDART = (() => { const b = path.basename(process.argv[1] || '').replace(/\.js$/, ''); return b === 'index' ? 'fon' : 'bin:' + (b || '?'); })();
function bilan(amal, fn) { return ALS.run({ amal: s(amal) }, fn); }
const amalNomi = () => ((ALS.getStore() || {}).amal) || STANDART;

// ---------- bayroq (15 s kesh; Redis 1 s da javob bermasa — o'chiq deb olinadi)
let K = { t: 0, yon: false, kom: new Map() };
async function holatOl() {
  if (Date.now() - K.t < 15000) return K;
  const { redis, q } = require('./db');
  let yon = false, kom = K.kom;
  try {
    yon = (await Promise.race([redis.get(BAYROQ), new Promise((_, r) => setTimeout(() => r(new Error('redis javob bermadi')), 1000))])) === '1';
    if (yon) kom = new Map((await q('SELECT id, sheet_id FROM kompaniyalar WHERE faol AND sheet_id IS NOT NULL')).rows.map(r => [r.sheet_id, r.id]));
  } catch (e) { yon = false; }
  K = { t: Date.now(), yon, kom };
  return K;
}
// google.js chaqiradi: shu jadvalga yozuv «baza» ga ham qo'llanadimi? → kompaniya_id yoki null
async function kompaniya(sheetId) { const h = await holatOl(); return h.yon ? (h.kom.get(sheetId) || null) : null; }
async function yoqilganmi() { const { redis } = require('./db'); return (await redis.get(BAYROQ)) === '1'; }
async function bayroq(yoq) { const { redis } = require('./db'); if (yoq) await redis.set(BAYROQ, '1'); else await redis.del(BAYROQ); K.t = 0; }

// ---------- Google so'rovi + javobi → qadamlar: { tur: 'kataklar', kataklar: [{varaq, qator (1 dan), u (0 dan), xom}] }
//                                             | { tur: 'qayta', varaq, r1, r2, c1, c2 } (Google'dan qayta o'qiladi; qator 1 dan, ustun 0 dan, ikkalasi ham ichida)
//                                             | { tur: 'surish', varaq, bosh, soni } (qator o'chirildi: soni < 0; qo'shildi: soni > 0)
//                                             | { tur: 'ogoh', varaq, izoh }
const boshKatak = a1 => { const m = /\$?([A-Z]+)\$?(\d+)/.exec(s(a1).split('!').pop()); return m ? { qator: +m[2], u: u0(m[1]) } : null; };
function qiymatKataklar(varaq, Q, st, V) {   // so'rovdagi 2D qiymat (null — Google tegmaydi) + javobdagi qiymat (bo'lmasa — bo'sh)
  const out = [];
  (Q || []).forEach((r, i) => { if (!Array.isArray(r)) return; r.forEach((v, j) => { if (v === null || v === undefined) return;
    const e = V && Array.isArray(V[i]) ? V[i][j] : undefined;
    out.push({ varaq, qator: st.qator + i, u: st.u + j, xom: e === undefined || e === null ? '' : e }); }); });
  return out;
}
function oraliqQadam(varaq, st, Q) {   // javob kelmagan — yozilgan oraliq qayta o'qiladi
  const n = (Q || []).length, m = Math.max(0, ...(Q || []).map(r => Array.isArray(r) ? r.length : 0));
  return { tur: 'qayta', varaq, r1: st.qator, r2: st.qator + Math.max(n, 1) - 1, c1: st.u, c2: st.u + Math.max(m, 1) - 1 };
}
const QAYTA = Symbol('qayta');
function katakQiymat(c) {   // updateCells / repeatCell dagi CellData → xom (Google saqlaydigan ko'rinishda)
  const v = c && c.userEnteredValue;
  if (!v) return '';
  if ('formulaValue' in v) return QAYTA;
  if ('numberValue' in v) return v.numberValue;
  if ('stringValue' in v) return v.stringValue;
  if ('boolValue' in v) return v.boolValue;
  return '';
}
const qiymatMaydon = f => s(f).split(',').some(x => { x = x.trim(); return x === '*' || x === 'userEnteredValue' || x.startsWith('userEnteredValue.'); });
const FORMATGINA = new Set(['PASTE_FORMAT', 'PASTE_DATA_VALIDATION', 'PASTE_CONDITIONAL_FORMATTING']);
const QIYMATSIZ = new Set(['appendDimension', 'repeatCell', 'updateCells', 'updateDimensionProperties', 'updateSheetProperties', 'updateBorders', 'mergeCells', 'unmergeCells',
  'setDataValidation', 'addConditionalFormatRule', 'updateConditionalFormatRule', 'deleteConditionalFormatRule', 'autoResizeDimensions', 'setBasicFilter', 'clearBasicFilter',
  'addSheet', 'deleteSheet', 'duplicateSheet', 'addProtectedRange', 'updateProtectedRange', 'deleteProtectedRange', 'addNamedRange', 'deleteNamedRange', 'updateNamedRange',
  'addFilterView', 'deleteFilterView', 'updateFilterView', 'addBanding', 'updateBanding', 'deleteBanding', 'updateSpreadsheetProperties']);

async function qadamlarga(a, sheetId, kalitFayl) {
  const Q = [];
  if (a.tur === 'qiymat') {   // values:batchUpdate (yoz — USER_ENTERED, xomYoz — RAW): javob.responses[i].updatedData
    const R = (a.javob && a.javob.responses) || [];
    a.yozuvlar.forEach((y, i) => {
      if (sinovVaraq(y.varaq) || !kerakli(y.varaq)) { Q.push({ tur: 'kataklar', kataklar: qiymatKataklar(y.varaq, y.qiymat, boshKatak(y.katak) || { qator: 0, u: 0 }, null) }); return; }
      const ud = R[i] && R[i].updatedData, st = (ud && boshKatak(ud.range)) || boshKatak(y.katak);
      if (!st) { Q.push({ tur: 'ogoh', varaq: y.varaq, izoh: 'katak manzili tushunilmadi: ' + y.katak }); return; }
      Q.push(ud ? { tur: 'kataklar', kataklar: qiymatKataklar(y.varaq, y.qiymat, st, ud.values) } : oraliqQadam(y.varaq, st, y.qiymat));
    });
  } else if (a.tur === 'qosh') {   // :append — javob.updates.updatedData (haqiqiy qator — Google qo'ygan joy)
    const up = (a.javob && a.javob.updates) || {}, ud = up.updatedData;
    const st = (ud && boshKatak(ud.range)) || boshKatak(up.updatedRange);
    if (!st) Q.push({ tur: 'ogoh', varaq: a.varaq, izoh: 'qo\'shilgan qator raqami javobda yo\'q' });
    else Q.push(ud ? { tur: 'kataklar', kataklar: qiymatKataklar(a.varaq, a.qatorlar, st, ud.values) } : oraliqQadam(a.varaq, st, a.qatorlar));
  } else if (a.tur === 'sana') {   // sanaYoz — updateCells numberValue (seriya raqami)
    Q.push({ tur: 'kataklar', kataklar: a.kataklar.map(c => ({ varaq: c.varaq, qator: c.qator, u: c.ustun - 1, xom: c.xom })) });
  } else if (a.tur === 'soralar') {   // spreadsheets:batchUpdate — so'rovlar ketma-ket (Google'da ham shunday)
    const G = require('./google');
    const nom = async gid => G.varaqNomi(sheetId, gid, kalitFayl);
    for (const r of a.requests || []) {
      const tur = Object.keys(r || {})[0], b = (r || {})[tur] || {};
      if (tur === 'updateCells') {
        if (!qiymatMaydon(b.fields)) continue;
        const gr = b.range || b.start || {}, varaq = await nom(gr.sheetId);
        if (sinovVaraq(varaq) || !kerakli(varaq)) { Q.push({ tur: 'kataklar', kataklar: [{ varaq, qator: (gr.startRowIndex || gr.rowIndex || 0) + 1, u: gr.startColumnIndex || gr.columnIndex || 0, xom: '' }] }); continue; }
        const r0 = b.range ? (gr.startRowIndex || 0) : (gr.rowIndex || 0), c0 = b.range ? (gr.startColumnIndex || 0) : (gr.columnIndex || 0);
        const C = [], bor = new Set(); let qayta = false;
        (b.rows || []).forEach((row, i) => ((row && row.values) || []).forEach((c, j) => { const x = katakQiymat(c); if (x === QAYTA) qayta = true;
          bor.add(i + ',' + j); C.push({ varaq, qator: r0 + i + 1, u: c0 + j, xom: x }); }));
        // range berilgan bo'lsa — rows qoplamagan kataklar tozalanadi (Sheets API qoidasi)
        if (b.range && gr.endRowIndex != null && gr.endColumnIndex != null)
          for (let i = 0; i < gr.endRowIndex - r0; i++) for (let j = 0; j < gr.endColumnIndex - c0; j++) if (!bor.has(i + ',' + j)) C.push({ varaq, qator: r0 + i + 1, u: c0 + j, xom: '' });
        if (qayta) { const rr = C.map(c => c.qator), cc = C.map(c => c.u); Q.push({ tur: 'qayta', varaq, r1: Math.min(...rr), r2: Math.max(...rr), c1: Math.min(...cc), c2: Math.max(...cc) }); }
        else Q.push({ tur: 'kataklar', kataklar: C });
      } else if (tur === 'repeatCell') {
        if (!qiymatMaydon(b.fields)) continue;
        const gr = b.range || {}, varaq = await nom(gr.sheetId);
        if (sinovVaraq(varaq) || !kerakli(varaq)) continue;
        if (gr.endRowIndex == null || gr.endColumnIndex == null) { Q.push({ tur: 'ogoh', varaq, izoh: 'repeatCell chegarasiz oraliqqa qiymat yozdi' }); continue; }
        const x = katakQiymat(b.cell), r1 = (gr.startRowIndex || 0) + 1, c1 = gr.startColumnIndex || 0;
        if (x === QAYTA) { Q.push({ tur: 'qayta', varaq, r1, r2: gr.endRowIndex, c1, c2: gr.endColumnIndex - 1 }); continue; }
        const C = []; for (let i = r1; i <= gr.endRowIndex; i++) for (let j = c1; j < gr.endColumnIndex; j++) C.push({ varaq, qator: i, u: j, xom: x });
        Q.push({ tur: 'kataklar', kataklar: C });
      } else if (tur === 'copyPaste' || tur === 'cutPaste') {
        if (FORMATGINA.has(b.pasteType)) continue;
        const src = b.source || {};
        const d = tur === 'copyPaste' ? b.destination || {} : { sheetId: (b.destination || {}).sheetId, startRowIndex: (b.destination || {}).rowIndex || 0,
          endRowIndex: ((b.destination || {}).rowIndex || 0) + ((src.endRowIndex || 0) - (src.startRowIndex || 0)),
          startColumnIndex: (b.destination || {}).columnIndex || 0, endColumnIndex: ((b.destination || {}).columnIndex || 0) + ((src.endColumnIndex || 0) - (src.startColumnIndex || 0)) };
        const oraliqlar = [d].concat(tur === 'cutPaste' ? [src] : []);
        for (const g of oraliqlar) {
          const varaq = await nom(g.sheetId);
          if (sinovVaraq(varaq) || !kerakli(varaq)) continue;
          const X = XARITA.get(varaq);
          if (g.endRowIndex == null || g.endColumnIndex == null) { Q.push({ tur: 'ogoh', varaq, izoh: tur + ' chegarasiz oraliq' }); continue; }
          // faqat formula ustunlariga (sxemadagi hisob) tushgan nusxa — «baza» ga tegishli emas
          let kerak = LUGAT_VARAQ.has(varaq);
          for (let j = g.startColumnIndex || 0; j < g.endColumnIndex && !kerak; j++) if (X && X.kol.has(j)) kerak = true;
          if (kerak) Q.push({ tur: 'qayta', varaq, r1: (g.startRowIndex || 0) + 1, r2: g.endRowIndex, c1: g.startColumnIndex || 0, c2: g.endColumnIndex - 1 });
        }
      } else if (tur === 'deleteDimension' || tur === 'insertDimension') {
        const g = b.range || {}, varaq = await nom(g.sheetId);
        if (sinovVaraq(varaq) || !kerakli(varaq)) continue;
        const n = (g.endIndex || 0) - (g.startIndex || 0);
        if (g.dimension === 'ROWS') Q.push({ tur: 'surish', varaq, bosh: (g.startIndex || 0) + 1, soni: tur === 'deleteDimension' ? -n : n });
        else Q.push({ tur: 'ogoh', varaq, izoh: 'USTUN ' + (tur === 'deleteDimension' ? 'o\'chirildi' : 'qo\'shildi') + ' — tuzilma o\'zgardi, aks-baza tikla kerak' });
      } else if (!QIYMATSIZ.has(tur)) {
        Q.push({ tur: 'ogoh', varaq: '', izoh: 'tanilmagan so\'rov: ' + tur });
      }
    }
  }
  return Q;
}

// Google'dan qayta o'qish (faqat «baza» ga tegishli varaqlar) → kataklar
async function qaytaOqi(sheetId, kalitFayl, z) {
  const G = require('./google');
  const V = await G.oraliqOqi(sheetId, z.varaq, harf(z.c1) + z.r1 + ':' + harf(z.c2) + z.r2, kalitFayl, 'UNFORMATTED_VALUE');
  const C = [];
  for (let i = z.r1; i <= z.r2; i++) for (let j = z.c1; j <= z.c2; j++) { const v = (V[i - z.r1] || [])[j - z.c1]; C.push({ varaq: z.varaq, qator: i, u: j, xom: v === undefined || v === null ? '' : v }); }
  return { tur: 'kataklar', kataklar: C, qayta: true };
}
// lugat manbai: 08_Lugatlar to'liq + qo'shimcha varaqlar (08b D) — Google'dan, yozuvdan keyin
async function lugatOqi(sheetId, kalitFayl) {
  const G = require('./google');
  const rows = V => V.map((x, i) => ({ n: i + 1, x: Array.isArray(x) ? x : [] }));
  const Q = rows(await G.oraliqOqi(sheetId, LUGAT.varaq, 'A1:' + harf(Math.max(...LUGAT.royxat.concat(LUGAT.zona, [LUGAT.sozlama]).map(u0))), kalitFayl, 'UNFORMATTED_VALUE'));
  const qosh = {};
  for (const qo of LUGAT.qoshimcha) qosh[qo.varaq] = rows(await G.oraliqOqi(sheetId, qo.varaq, 'A1:' + qo.ustun, kalitFayl, 'UNFORMATTED_VALUE'));
  return { Q, qosh };
}

// ---------- «baza» ga qo'llash (bitta tranzaksiya). opt: { sxema ('baza'), db (tayyor ulanish — tranzaksiyani chaqiruvchi boshqaradi), jurnalsiz, lugatManba, amal, t0 }
// Qaytaradi: jurnal yozuvlari [{varaq, jadval, qatorlar, ustunlar, soni, holat, xato, kataklar}]
async function qollaDb(k, qadamlar, opt = {}) {
  const SX = opt.sxema || 'baza';
  const db = opt.db || await require('./db').pool.connect();
  const J = [];
  try {
    if (!opt.db) { await db.query('BEGIN'); await db.query(`SET LOCAL lock_timeout = '3s'`); await db.query(`SET LOCAL statement_timeout = '20s'`); }
    let navbat = [];
    const tashla = async () => { if (navbat.length) { await kataklarQolla(db, SX, k, navbat, J); navbat = []; } };
    for (const z of qadamlar) {
      if (z.tur === 'kataklar') { navbat.push(...z.kataklar); continue; }
      await tashla();
      if (z.tur === 'surish') await surish(db, SX, k, z, J);
      else if (z.tur === 'ogoh') J.push({ varaq: z.varaq, holat: 'ogoh', xato: z.izoh });
      else if (z.tur === 'qayta' && kerakli(z.varaq)) J.push({ varaq: z.varaq, holat: 'ogoh', xato: 'qayta o\'qilmadi' });
    }
    await tashla();
    if (opt.lugatManba) await lugatQolla(db, SX, k, opt.lugatManba, J);
    if (!opt.jurnalsiz && J.length) await jurnalYoz(db, k, opt.amal || amalNomi(), J, Date.now() - (opt.t0 || Date.now()));
    if (!opt.db) await db.query('COMMIT');
  } catch (e) {
    if (!opt.db) await db.query('ROLLBACK').catch(() => {});
    throw e;
  } finally { if (!opt.db) db.release(); }
  return J;
}

async function kataklarQolla(db, SX, k, kataklar, J) {
  const V = [...guruhla(kataklar, c => c.varaq)].sort((a, b) => a[0] < b[0] ? -1 : 1);   // har doim bir xil tartib — qulflar to'qnashmasin
  for (const [varaq, C] of V) {
    if (sinovVaraq(varaq)) continue;
    const X = XARITA.get(varaq);
    const yoz = { varaq, soni: C.length, qatorlar: [...new Set(C.map(c => c.qator))].sort((a, b) => a - b).slice(0, 500),
      ustunlar: [...new Set(C.map(c => c.u))].sort((a, b) => a - b).map(harf), kataklar: C.slice(0, KATAK_MAX).map(c => [c.qator, harf(c.u), c.xom]) };
    if (!X) { if (!LUGAT_VARAQ.has(varaq)) J.push(Object.assign(yoz, { holat: 'tashqari', kataklar: null })); continue; }   // 08_Lugatlar — lugatQolla
    const j = X.j, T = SX + '.' + qq(j.jadval), izoh = new Set(); let ogoh = false;
    const Q = new Map();   // qator → Map(ustun → xom); keyingi yozuv oldingisini bosadi
    for (const c of C) {
      if (c.qator < 2) { izoh.add('sarlavha'); continue; }
      if (!X.kol.has(c.u)) { if (!X.hisob.has(c.u)) { izoh.add('sxemada yo\'q ustun ' + harf(c.u)); ogoh = true; } continue; }
      if (!Q.has(c.qator)) Q.set(c.qator, new Map());
      Q.get(c.qator).set(c.u, c.xom);
    }
    const qatorlar = [...Q.keys()].sort((a, b) => a - b);
    // qolda (01 P: faqat F×G dan farq qilsa) va faqatSon (08c A) uchun — bazadagi mavjud qator kerak bo'lishi mumkin
    const qoldaU = j.qolda ? Object.keys(j.qolda).map(u0) : [];
    const kerak = qatorlar.filter(n => j.faqatSon || qoldaU.some(u => Q.get(n).has(u)));
    const mavjud = kerak.length ? new Map((await db.query(`SELECT * FROM ${T} WHERE kompaniya_id = $1 AND qator = ANY($2)`, [k, kerak])).rows.map(r => [r.qator, r])) : new Map();
    const Y = [], ochir = [], tegQ = [], tegU = [], xatoY = [];   // xatolar jadvali ham 1-bosqichdagidek yuritiladi (aks-baza xatolar)
    for (const n of qatorlar) {
      const M = Q.get(n), o = { kompaniya_id: k, qator: n };
      let saqla = false;   // bo'sh bo'lmagan xom NULL ga aylandi (xato / bo'shliq) — 1-bosqichda bunday qator qoladi
      if (j.faqatSon) {
        const a = u0(j.faqatSon);
        if (M.has(a)) {
          if (typeof M.get(a) !== 'number') { ochir.push(n); continue; }   // 1-bosqichda bunday qator olinmaydi
          if (!mavjud.has(n) && M.size < j.ustunlar.length) { izoh.add('qator ' + n + ' endi olinadi, lekin qolgan ustunlari Google\'da bo\'lishi mumkin'); ogoh = true; }
        } else if (!mavjud.has(n)) { izoh.add('qator ' + n + ' bazada yo\'q, ' + j.faqatSon + ' tegilmagan'); ogoh = true; continue; }
      }
      for (const [u, xom0] of M) {
        const [h, nom, tur] = X.kol.get(u);
        tegQ.push(n); tegU.push(h);
        let xom = xom0;
        if (j.qolda && j.qolda[h] && typeof xom === 'number') {   // P ≠ F×G bo'lsagina saqlanadi (F, G — shu yozuvdan yoki bazadan)
          const r = mavjud.get(n);
          const [a, b] = j.qolda[h].map(hh => { const uu = u0(hh); if (M.has(uu)) return Number(M.get(uu)); return r ? Number(r[X.kol.get(uu)[1]]) : 0; });
          if (Number.isFinite(a) && Number.isFinite(b) && Math.abs(xom - a * b) <= 0.5) xom = '';
        }
        const r = B.aylantir(xom, tur);
        if (r.xato) { o[nom] = null; saqla = true; ogoh = true; izoh.add('aylantirilmadi ' + h + n + ' «' + s(xom).slice(0, 40) + '»: ' + r.xato);
          xatoY.push({ kompaniya_id: k, jadval: j.jadval, varaq, qator: n, ustun: h, qiymat: s(xom).slice(0, 200), sabab: r.xato }); }
        else { o[nom] = r.v; if (r.v === null && !bosh(xom0)) saqla = true; }
      }
      Y.push({ o, saqla, imzo: Object.keys(o).slice(2).join(',') });
    }
    const XT = SX + '.xatolar';
    if (tegQ.length) await db.query(`DELETE FROM ${XT} x USING unnest($3::int[], $4::text[]) t(q, u) WHERE x.kompaniya_id = $1 AND x.jadval = $2 AND x.qator = t.q AND x.ustun = t.u`, [k, j.jadval, tegQ, tegU]);
    if (xatoY.length) await db.query(`INSERT INTO ${XT} SELECT * FROM jsonb_populate_recordset(NULL::${XT}, $1::jsonb)`, [JSON.stringify(xatoY)]);
    const boshShart = j.ustunlar.map(u => qq(u[1]) + ' IS NULL').join(' AND ');
    const nomzod = [];
    for (const [imzo, G] of guruhla(Y, y => y.imzo)) {
      if (!imzo) continue;
      const kol = imzo.split(',').map(qq).join(', ');
      const R = await db.query(`INSERT INTO ${T} AS t (kompaniya_id, qator, ${kol})
          SELECT kompaniya_id, qator, ${kol} FROM jsonb_populate_recordset(NULL::${T}, $1::jsonb)
          ON CONFLICT (kompaniya_id, qator) DO UPDATE SET ${imzo.split(',').map(x => qq(x) + ' = EXCLUDED.' + qq(x)).join(', ')}
          RETURNING qator, (${boshShart}) AS bosh`, [JSON.stringify(G.map(y => y.o))]);
      const sq = new Map(G.map(y => [y.o.qator, y.saqla]));
      for (const r of R.rows) if (r.bosh && !sq.get(r.qator)) nomzod.push(r.qator);
    }
    // hamma ustuni bo'sh qator — 1-bosqichdagidek olinmaydi; lekin boshqa ustunida aylantirilmagan qiymat qolgan bo'lsa (xatolar) — qator bor
    if (nomzod.length) { const qol = new Set((await db.query(`SELECT DISTINCT qator FROM ${XT} WHERE kompaniya_id = $1 AND jadval = $2 AND qator = ANY($3)`, [k, j.jadval, nomzod])).rows.map(r => r.qator));
      ochir.push(...nomzod.filter(n => !qol.has(n))); }
    if (ochir.length) { await db.query(`DELETE FROM ${T} WHERE kompaniya_id = $1 AND qator = ANY($2)`, [k, ochir]);
      await db.query(`DELETE FROM ${XT} WHERE kompaniya_id = $1 AND jadval = $2 AND qator = ANY($3)`, [k, j.jadval, ochir]); }
    J.push(Object.assign(yoz, { jadval: j.jadval, holat: ogoh ? 'ogoh' : 'ok', xato: izoh.size ? [...izoh].join('; ').slice(0, 1000) : null }));
  }
}

async function surish(db, SX, k, z, J) {
  const X = XARITA.get(z.varaq);
  if (X) {
    const T = SX + '.' + qq(X.j.jadval);
    if (z.soni < 0) {
      const n = -z.soni;
      await db.query(`DELETE FROM ${T} WHERE kompaniya_id = $1 AND qator >= $2 AND qator < $3`, [k, z.bosh, z.bosh + n]);
      await db.query(`UPDATE ${T} SET qator = -(qator - $3) WHERE kompaniya_id = $1 AND qator >= $2`, [k, z.bosh + n, n]);
    } else await db.query(`UPDATE ${T} SET qator = -(qator + $3) WHERE kompaniya_id = $1 AND qator >= $2`, [k, z.bosh, z.soni]);
    await db.query(`UPDATE ${T} SET qator = -qator WHERE kompaniya_id = $1 AND qator < 0`, [k]);   // ikki qadam — kalit (kompaniya_id, qator) to'qnashmasin
    const XT = SX + '.xatolar', jd = X.j.jadval;
    if (z.soni < 0) { await db.query(`DELETE FROM ${XT} WHERE kompaniya_id = $1 AND jadval = $2 AND qator >= $3 AND qator < $4`, [k, jd, z.bosh, z.bosh - z.soni]);
      await db.query(`UPDATE ${XT} SET qator = qator + $4 WHERE kompaniya_id = $1 AND jadval = $2 AND qator >= $3`, [k, jd, z.bosh - z.soni, z.soni]); }
    else await db.query(`UPDATE ${XT} SET qator = qator + $4 WHERE kompaniya_id = $1 AND jadval = $2 AND qator >= $3`, [k, jd, z.bosh, z.soni]);
  }
  J.push({ varaq: z.varaq, jadval: X ? X.j.jadval : null, qatorlar: [z.bosh], soni: Math.abs(z.soni), holat: 'ok',
    xato: (z.soni < 0 ? 'qator o\'chirildi: ' : 'qator qo\'shildi: ') + Math.abs(z.soni) + ' ta, ' + z.bosh + '-qatordan', kataklar: { surish: [z.bosh, z.soni] } });
}

async function lugatQolla(db, SX, k, manba, J) {
  const M = B.lugatQur(k, manba.Q, v => manba.qosh[v]);
  await db.query(`DELETE FROM ${SX}.xatolar WHERE kompaniya_id = $1 AND jadval = 'zona'`, [k]);
  if (M.xatolar.length) await db.query(`INSERT INTO ${SX}.xatolar SELECT * FROM jsonb_to_recordset($1::jsonb) AS t(kompaniya_id int, jadval text, varaq text, qator int, ustun text, qiymat text, sabab text)`,
    [JSON.stringify(M.xatolar.map(([kompaniya_id, jadval, varaq, qator, ustun, qiymat, sabab]) => ({ kompaniya_id, jadval, varaq, qator, ustun, qiymat, sabab })))]);
  for (const t of ['lugat', 'zona', 'sozlama']) {
    await db.query(`DELETE FROM ${SX}.${t} WHERE kompaniya_id = $1`, [k]);
    if (M[t].length) await db.query(`INSERT INTO ${SX}.${t} SELECT * FROM jsonb_populate_recordset(NULL::${SX}.${t}, $1::jsonb)`, [JSON.stringify(M[t])]);
  }
  J.push({ varaq: LUGAT.varaq, jadval: 'lugat', holat: M.xatolar.length ? 'ogoh' : 'ok', soni: M.lugat.length + M.zona.length + M.sozlama.length,
    xato: 'qayta qurildi: lugat ' + M.lugat.length + ', zona ' + M.zona.length + ', sozlama ' + M.sozlama.length + (M.xatolar.length ? '; zona xato ' + M.xatolar.length : ''), kataklar: { lugat: true } });
}

async function jurnalYoz(db, k, amal, J, ms) {
  await db.query(`INSERT INTO baza_ikki_jurnal (kompaniya_id, amal, varaq, jadval, qatorlar, ustunlar, soni, holat, xato, kataklar, ms)
    SELECT * FROM jsonb_to_recordset($1::jsonb) AS t(kompaniya_id int, amal text, varaq text, jadval text, qatorlar int[], ustunlar text[], soni int, holat text, xato text, kataklar jsonb, ms int)`,
    [JSON.stringify(J.map(y => ({ kompaniya_id: k, amal: s(amal).slice(0, 100), varaq: y.varaq || null, jadval: y.jadval || null, qatorlar: y.qatorlar || null, ustunlar: y.ustunlar || null,
      soni: y.soni || 0, holat: y.holat, xato: y.xato || null, kataklar: y.kataklar === undefined ? null : y.kataklar, ms })))]);
}

// ---------- google.js chaqiradi (yozuv Google'da MUVAFFAQIYATLI bo'lgandan keyin). Hech qachon xato tashlamaydi.
async function qolla(k, sheetId, kalitFayl, amallar) {
  const t0 = Date.now(), amal = amalNomi();
  let Q = [];
  try {
    for (const a of amallar) Q.push(...await qadamlarga(a, sheetId, kalitFayl));
    // javobda qiymat yo'q joylar — Google'dan qayta o'qiladi (tranzaksiyadan oldin)
    for (let i = 0; i < Q.length; i++) if (Q[i].tur === 'qayta' && kerakli(Q[i].varaq)) Q[i] = await qaytaOqi(sheetId, kalitFayl, Q[i]);
    const lugatTegdi = Q.some(z => (z.varaq && LUGAT_VARAQ.has(z.varaq)) || (z.kataklar || []).some(c => LUGAT_VARAQ.has(c.varaq)));
    const lugatManba = lugatTegdi ? await lugatOqi(sheetId, kalitFayl) : null;
    if (!Q.length && !lugatManba) return;
    await qollaDb(k, Q, { amal, lugatManba, t0 });
  } catch (e) { await xatoYoz(k, amal, Q, e, t0); }
}

async function xatoYoz(k, amal, Q, e, t0) {
  const msg = s(e && e.message ? e.message : e).slice(0, 500);
  console.error(new Date().toISOString(), 'ikki yozuv XATO (baza ga yozilmadi):', amal, msg);
  const C = [].concat(...Q.map(z => z.kataklar || []));
  const varaqlar = [...new Set(Q.map(z => z.varaq).concat(C.map(c => c.varaq)).filter(Boolean))];
  try {
    const { q } = require('./db');
    await q(`INSERT INTO baza_ikki_jurnal (kompaniya_id, amal, varaq, qatorlar, soni, holat, xato, kataklar, ms) VALUES ($1, $2, $3, $4, $5, 'xato', $6, $7, $8)`,
      [k, s(amal).slice(0, 100), varaqlar.join(', ').slice(0, 300) || null, [...new Set(C.map(c => c.qator))].slice(0, 500), C.length, msg,
        JSON.stringify(varaqlar.length === 1 ? C.slice(0, KATAK_MAX).map(c => [c.qator, harf(c.u), c.xom]) : null), Date.now() - t0]);
  } catch (z) { console.error(new Date().toISOString(), 'ikki yozuv jurnali yozilmadi:', z.message); }
  try {
    const { redis } = require('./db');
    if (await redis.set('ikki_yozuv:xabar', '1', 'EX', 3600, 'NX'))
      await require('./telegram').direktor('🗄 <b>Ikki tomonlama yozish: server bazasiga yozilmadi</b>\nAmal: ' + esc(amal) + (varaqlar.length ? ' · ' + esc(varaqlar.join(', ')) : '') +
        '\nSabab: ' + esc(msg.slice(0, 300)) + '\n\nXodimning ishi to\'xtamadi (Google jadvalga yozildi). Kechasi tekshiruvda tuzatiladi. Batafsil: <code>aks-baza ikki jurnal --xato</code> — Claude\'ga ko\'rsating.\n(Bu xabar soatiga ko\'pi bilan bir marta keladi.)');
  } catch (z) { }
}
const esc = v => s(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// ---------- tiklashdan keyin: ko'zgu o'qilgandan beri jurnalga tushgan yozuvlarni qayta qo'llash (ko'zgu ularni ko'rmagan bo'lishi mumkin).
// Qator surish (07c) qayta qo'llanmaydi — ko'zgu uni ko'rgan bo'lsa ikki marta o'chib ketadi; soni hisobotda aytiladi.
async function qaytaQolla(db, dan, opt = {}) {
  const R = (await db.query(`SELECT id, kompaniya_id, varaq, holat, kataklar FROM baza_ikki_jurnal WHERE vaqt >= $1 AND holat <> 'tashqari' AND kataklar IS NOT NULL ORDER BY id`, [dan])).rows;
  const n = { yozuv: 0, katak: 0, surish: 0, lugat: 0 };
  const kom = guruhla(R, r => r.kompaniya_id);
  for (const [k, RR] of kom) {
    const Q = []; let lugat = false;
    for (const r of RR) {
      if (Array.isArray(r.kataklar)) { Q.push({ tur: 'kataklar', kataklar: r.kataklar.map(([q, h, x]) => ({ varaq: r.varaq, qator: q, u: u0(h), xom: x })) }); n.yozuv++; n.katak += r.kataklar.length; }
      else if (r.kataklar && r.kataklar.surish) n.surish++;
      else if (r.kataklar && r.kataklar.lugat) lugat = true;
    }
    let lugatManba = null;
    if (lugat && opt.sheetId) { lugatManba = await lugatOqi(opt.sheetId(k), opt.kalitFayl); n.lugat++; }
    await qollaDb(k, Q, { sxema: opt.sxema || 'baza', db, jurnalsiz: true, lugatManba });
  }
  return n;
}

module.exports = { kompaniya, yoqilganmi, bayroq, bilan, amalNomi, qolla, qollaDb, qaytaQolla, lugatOqi, ECHO, ECHO_URL, BAYROQ, XARITA, LUGAT_VARAQ,
  _ichki: { qadamlarga, qiymatKataklar, katakQiymat, qiymatMaydon, boshKatak, harf, u0, keshTozala: () => { K.t = 0; } } };
