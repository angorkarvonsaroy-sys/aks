// AKS TIZIM — Google Doc shabloni bilan ishlash: eski tizimdagi DocumentApp amallari (body.replaceText / findText / removeChild /
// insertParagraph / jadval qatorini nusxalash) ning model (lib/docx_oqi.js) ustidagi o'rni. Shablon robot (Drive o'qish huquqi) orqali
// Google'ning o'z DOCX eksportidan olinadi — eski shablonTop_ kabi NOMI bo'yicha (savatdagisi emas) yoki ID bo'yicha; o'zgarmagan bo'lsa diskdan.
// replaceText qoidasi (Docs): naqsh RE2 (\\x{00A0} → \\u00A0), xatboshi matni bo'ylab (bo'laklar orasidan ham) izlanadi, almashtirilgan matn
// moslikning birinchi belgisi bo'lagining ko'rinishini oladi; Body da jadval kataklari ham qamrab olinadi; kolontitul — alohida.
'use strict';
const fs = require('fs');
const path = require('path');
const G = require('./google');
const env = require('./env');
const DX = require('./docx_oqi');

const s = v => String(v == null ? '' : v);
const DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const GDOC = 'application/vnd.google-apps.document';

// ------------------------------------------------------------------ shablonni olish (robot): nom yoki ID → model (disk keshi: modifiedTime bo'yicha)
function keshYol(k) { return path.join(env.hujjatPapka, '.shablon', String(k).replace(/[^A-Za-z0-9_-]/g, '_')); }
async function topId(nom) {   // shablonTop_: Drive'da shu nomli Google Doc (savatdagisi emas)
  const t = await G.token(env.googleKey, 'https://www.googleapis.com/auth/drive.readonly');
  const q = "name = '" + s(nom).replace(/'/g, "\\'") + "' and mimeType = '" + GDOC + "' and trashed = false";
  const r = await fetch('https://www.googleapis.com/drive/v3/files?q=' + encodeURIComponent(q) + '&fields=files(id,name,modifiedTime)&pageSize=5&supportsAllDrives=true&includeItemsFromAllDrives=true', { headers: { Authorization: 'Bearer ' + t } });
  if (!r.ok) throw new Error('Drive qidiruv: ' + r.status + ' ' + (await r.text()).slice(0, 200));
  const j = await r.json(); const f = (j.files || [])[0];
  if (!f) throw new Error('Shablon topilmadi: «' + nom + '» — uni Google Doc sifatida Drive\'ga qo\'ying.');
  return f;
}
async function meta(id) {
  const t = await G.token(env.googleKey, 'https://www.googleapis.com/auth/drive.readonly');
  const r = await fetch('https://www.googleapis.com/drive/v3/files/' + encodeURIComponent(id) + '?fields=id,name,mimeType,modifiedTime,trashed&supportsAllDrives=true', { headers: { Authorization: 'Bearer ' + t } });
  if (!r.ok) throw new Error('Shablon (' + id + ') o\'qilmadi: ' + r.status);
  return r.json();
}
// ol(nom) — Drive'da nomi bo'yicha (shablonTop_ kabi); olId(id) — Drive ID bo'yicha (Kod.gs SHABLON). Qaytaradi { model, id, nom, modifiedTime, keshdan }
async function ol(nom) { return olYadro(await topId(nom)); }
async function olId(id) { return olYadro(await meta(id)); }
async function olYadro(f) {
  if (f.trashed) throw new Error('Shablon savatda: ' + f.name);
  const yol = keshYol(f.id), j = yol + '.json';
  let buf = null, keshdan = false;
  try { const k = JSON.parse(fs.readFileSync(j, 'utf8')); if (k.modifiedTime === f.modifiedTime && fs.existsSync(yol + '.docx')) { buf = fs.readFileSync(yol + '.docx'); keshdan = true; } } catch (e) { }
  if (!buf) {
    buf = await G.driveEksport(f.id, DOCX, env.googleKey);
    try { fs.mkdirSync(path.dirname(yol), { recursive: true }); fs.writeFileSync(yol + '.docx', buf); fs.writeFileSync(j, JSON.stringify({ id: f.id, nom: f.name, modifiedTime: f.modifiedTime })); } catch (e) { }
  }
  return { model: DX.oqi(buf), id: f.id, nom: f.name, modifiedTime: f.modifiedTime, keshdan };
}

// ------------------------------------------------------------------ model bo'ylab yurish
// barcha xatboshilar (jadval kataklari ichidagilar ham), hujjat tartibida; har biri uchun { p, ota, i } (ota — p turgan ro'yxat)
function xatboshilar(el) {
  const L = [];
  const yur = ro => ro.forEach((e, i) => { if (e.t === 'p') L.push({ p: e, ota: ro, i }); else if (e.t === 'tbl') e.rows.forEach(r => r.cells.forEach(c => yur(c.el))); });
  yur(el); return L;
}
function matn(p) { return (p.runs || []).map(r => r.x).join(''); }
function yangila(p) { p.x = matn(p); return p; }
// RE2 naqshini JS RegExp ga: \x{00A0} →  ; getText bilan kelgan oddiy matn ham shu (eski kod rx_ bilan qochirib beradi)
function naqsh(pat, flags) { return new RegExp(s(pat).replace(/\\x\{([0-9A-Fa-f]{1,6})\}/g, (m, h) => '\\u{' + h + '}'), flags); }
// xatboshidagi [a, b) oraliqni (belgi o'rinlari) yangi matn bilan almashtirish — birinchi belgi bo'lagi saqlanadi, qolgani qirqiladi
function oraliqAlmashtir(p, a, b, yangi) {
  const R = p.runs; let pos = 0, done = false;
  for (const r of R) {
    const st = pos, en = pos + r.x.length; pos = en;
    if (en <= a || st >= b) continue;                        // kesishmaydi
    const ia = Math.max(a, st) - st, ib = Math.min(b, en) - st;
    r.x = r.x.slice(0, ia) + (done ? '' : yangi) + r.x.slice(ib); done = true;
  }
  if (!done) { if (R.length) R[R.length - 1].x += yangi; else R.push({ x: yangi, b: !!p.b, i: !!p.i, u: !!p.u, c: p.c || null, sz: p.sz || null, font: p.font || null }); }
  yangila(p);
}
// Text.replaceText / Body.replaceText: barcha mosliklar (hujjat tartibida). yangi — matn (qoidasiz: $ oddiy belgi, eski $$$$ qochirish kerak emas)
function replaceText(el, pat, yangi) {
  const re = naqsh(pat, 'gu'); let n = 0;
  xatboshilar(Array.isArray(el) ? el : [el]).forEach(({ p }) => {
    for (let k = 0; k < 50; k++) {
      const x = matn(p); re.lastIndex = 0; const m = re.exec(x); if (!m) break;
      if (m[0].length === 0) break;
      oraliqAlmashtir(p, m.index, m.index + m[0].length, s(yangi)); n++;
    }
  });
  return n;
}
// Body.findText: birinchi moslik → { p, ota, i, boshi, oxiri } yoki null
function findText(el, pat) {
  const re = naqsh(pat, 'u');
  for (const z of xatboshilar(el)) { const m = re.exec(matn(z.p)); if (m) return Object.assign({ boshi: m.index, oxiri: m.index + m[0].length }, z); }
  return null;
}
// Text.deleteText(start, endInclusive)
function deleteText(p, a, bInc) { oraliqAlmashtir(p, a, bInc + 1, ''); }
// Body.insertParagraph(index, text): yangi xatboshi — xatboshi sozlamalari hujjat standarti (def = model.def: chapga, oraliq 0, qator oralig'i
// docDefaults dagi — 27/368 shablonida 1,15), matn ko'rinishi oldingi xatboshining oxirgi belgisidan (Docs: Enter bosilgandek) — TNR 12, qalin emas
function insertParagraph(ro, i, x, def) {
  const old = ro[i - 1] && ro[i - 1].t === 'p' ? ro[i - 1] : (ro[i] && ro[i].t === 'p' ? ro[i] : null);
  const lr = old ? [...old.runs].reverse().find(r => r.x) || old.runs[0] : null;
  const run = { x: s(x), b: lr ? !!lr.b : false, i: lr ? !!lr.i : false, u: false, c: lr ? lr.c : null, sz: lr ? lr.sz : (old ? old.sz : null), font: lr ? lr.font : (old ? old.font : null) };
  const p = { t: 'p', runs: [run], x: s(x), al: null, before: 0, after: 0, ls: def && def.ls != null ? def.ls : null, lsPt: null, indStart: null, indFirst: null, indEnd: null,
    font: run.font, sz: run.sz, b: run.b, i: run.i, u: false, c: run.c, num: null, betOldin: false, keepNext: false, keepLines: false, widow: old ? old.widow : null };
  ro.splice(i, 0, p); return p;
}
function removeChild(ro, p) { const i = ro.indexOf(p); if (i >= 0) ro.splice(i, 1); return i; }
// qolganBelgilar_: to'ldirilmagan <<…>> lar (Body matni — jadvallar ham), takrorsiz
function qolganBelgilar(el) { const m = xatboshilar(el).map(z => matn(z.p)).join('\n').match(/<<[^<>]{1,60}>>/g); return m ? Array.from(new Set(m)) : []; }
// jadval qatorini chuqur nusxalash (TableRow.copy)
function qatorNusxa(row) { return JSON.parse(JSON.stringify(row)); }
// <<T_NO>> turgan jadval qatorini topish: { tbl, ix } yoki null
function belgiQatori(el, belgi) {
  const re = naqsh(belgi, 'u');
  let top = null;
  const yur = ro => ro.forEach(e => { if (top) return; if (e.t === 'tbl') e.rows.forEach((r, ix) => { if (top) return; if (r.cells.some(c => xatboshilar(c.el).some(z => re.test(matn(z.p))))) top = { tbl: e, ix }; else r.cells.forEach(c => yur(c.el)); }); });
  yur(el); return top;
}

module.exports = { ol, olId, topId, xatboshilar, matn, replaceText, findText, deleteText, insertParagraph, removeChild, qolganBelgilar, qatorNusxa, belgiQatori, naqsh };
