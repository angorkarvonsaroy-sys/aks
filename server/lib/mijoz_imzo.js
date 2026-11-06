// AKS TIZIM — MIJOZ BILAN TUZILADIGAN HUJJATLAR QOIDASI (04.11.2026, direktor ko'rsatmasi). Google Doc shabloni modeli (lib/docx_oqi.js) ustida:
//   1) har varaq tagida «Варақ N / M» (N, M — lib/shablon_pdf.js betlar() yozadi: PAGE / NUMPAGES maydonlari);
//   2) shartnomalarda har varaq tagida FAQAT mijozning imzo joyi («Харидор имзоси: ____», «Ижарачи имзоси: ____») —
//      mijoz shartnomaning har bir beti bilan tanishgan hisoblanadi;
//   3) yakuniy imzo blokida mijoz imzosi ostida — Ф.И.Ш. ni o'z qo'li bilan yozishi uchun chiziq.
// Shablonning o'z kolontituli (ijara: «Шартнома № … — N»; kelishuv/solishtirma: ikki tomon imzosi) shu yagona ko'rinish bilan almashtiriladi.
'use strict';
const DS = require('./docs_shablon');

const s = v => String(v == null ? '' : v);
const RANG = '#555555', SZ = 9, SHRIFT = 'Times New Roman';
const run = (x, o) => Object.assign({ x: s(x), b: false, i: false, u: false, c: RANG, sz: SZ, font: SHRIFT, va: null, maydon: null }, o || {});
const par = (runs, al, o) => Object.assign({ t: 'p', runs, x: runs.map(r => r.x).join(''), al, before: 0, after: 0, ls: 1, lsPt: null, indStart: null, indFirst: null, indEnd: null,
  font: SHRIFT, sz: SZ, b: false, i: false, u: false, c: RANG, num: null, betOldin: false, keepNext: false, keepLines: false, widow: null }, o || {});
const katak = el => ({ el, bord: {}, pad: { t: 0, b: 0, l: 0, r: 0 }, span: 1, vAlign: 'bottom', bg: null });

// kolontitul(m, { imzo: 'Харидор' | 'Ижарачи' | null, raqam: '27/373' | null })
//   imzo bo'lsa — chapda «Шартнома № … · Варақ N / M», o'ngda «<imzo> имзоси: ____»; bo'lmasa — o'rtada «Варақ N / M».
function kolontitul(m, o) {
  o = o || {};
  const eni = +(m.w - m.chap - m.ong).toFixed(3);
  const bet = [run('Варақ '), run('', { maydon: 'PAGE' }), run(' / '), run('', { maydon: 'NUMPAGES' })];
  if (!o.imzo) { m.footer = [par(bet, 'center')]; return m; }
  const chap = (o.raqam ? [run('Шартнома № ' + o.raqam + '  ·  ')] : []).concat(bet);
  const ong = [run(o.imzo + ' имзоси: ', { c: '#000000', sz: 10 }), run('______________________', { c: '#000000', sz: 10 })];
  const w2 = Math.min(240, Math.round(eni * 0.5));
  m.footer = [{ t: 'tbl', chap: 0, cols: [+(eni - w2).toFixed(3), w2], rows: [{ h: null, cantSplit: true, cells: [katak([par(chap, 'left')]), katak([par(ong, 'right', { sz: 10, c: '#000000' })])] }] }];
  return m;
}

// fishChiziq(m, { rol }) — yakuniy imzo jadvali (tanadagi oxirgi jadval, «____» bor) ning oxirgi ustunida (mijoz tomoni — hamma shablonlarda o'ngda)
// oxirgi «____» li xatboshidan keyin: «Ф.И.Ш.: ______» va «(тўлиқ, ўз қўли билан)». Topilmasa — xato matni qaytadi (hujjat to'xtamaydi, ДИҚҚАТ ga chiqadi).
function fishChiziq(m, o) {
  o = o || {};
  const jad = m.el.filter(e => e.t === 'tbl' && e.rows.some(r => r.cells.length >= 2 && DS.xatboshilar(r.cells[r.cells.length - 1].el).some(z => /_{5,}/.test(DS.matn(z.p)))));
  const t = jad[jad.length - 1];
  if (!t) return 'Ф.И.Ш. чизиғи қўйилмади: шаблонда якуний имзо жадвали топилмади';
  let joy = null;
  t.rows.forEach(r => { const c = r.cells[r.cells.length - 1]; c.el.forEach((e, i) => { if (e.t === 'p' && /_{5,}/.test(DS.matn(e))) joy = { c, i, p: e }; }); });
  const ustun = t.rows.map(r => DS.xatboshilar(r.cells[r.cells.length - 1].el).map(z => DS.matn(z.p)).join('\n')).join('\n');
  if (o.rol && !new RegExp(o.rol, 'i').test(ustun) && !(o.ism && ustun.indexOf(o.ism) >= 0)) return 'Ф.И.Ш. чизиғи қўйилмади: имзо жадвалининг ўнг устуни мижозники эмас';
  const lr = [...joy.p.runs].reverse().find(r => r.x) || {};
  const sz = lr.sz || joy.p.sz || 11, font = lr.font || joy.p.font || SHRIFT;
  const enI = t.cols[t.cols.length - 1] || 200;
  const pad = (joy.c.pad.l == null ? 5 : joy.c.pad.l) + (joy.c.pad.r == null ? 5 : joy.c.pad.r) + (joy.p.indStart || 0) + (joy.p.indEnd || 0);
  // Ф.И.Ш. to'liq (familiya, ism, otasining ismi — qo'lda 9–10 sm): sarlavha + ustun eni bo'ylab 2 ta chiziq, har biri 26 pt balandlikda (qo'lda yozishga joy)
  const eni = Math.min(enI - pad, 300);
  const n = Math.max(30, Math.floor(eni / (0.5 * sz)) - 1);   // «_» = 0,5 em — chiziq ustun eniga teng, bitta qatorga sig'adi
  const al = joy.p.al === 'right' ? 'right' : 'left';
  const ind = { indStart: joy.p.indStart, indEnd: joy.p.indEnd };
  const p0 = par([run('Ф.И.Ш. ', { c: null, sz, font }), run('(тўлиқ, ўз қўли билан):', { c: RANG, sz: sz - 2, font, i: true })], al, Object.assign({ before: Math.round(sz * 0.9), sz, font, c: null }, ind));
  const chiziq = () => par([run('_'.repeat(n), { c: null, sz, font })], al, Object.assign({ sz, font, c: null, lsPt: 26 }, ind));
  const p1 = p0, p2 = chiziq(), p3 = chiziq();
  let ix = joy.i; const kel = joy.c.el[ix + 1];
  if (kel && kel.t === 'p' && /^\s*\/[^/]+\/\s*$/.test(DS.matn(kel))) ix++;   // «Имзо: ____» dan keyin «/Ф.И.Ш. қисқа/» qatori bo'lsa — undan keyin
  joy.c.el.splice(ix + 1, 0, p1, p2, p3);
  t.rows.forEach(r => { r.cantSplit = true; });   // imzo bloki varaqlarga bo'linmaydi (rekvizitlar va imzolar bitta varaqda)
  for (let i = m.el.indexOf(t) - 1, k = 0; i >= 0 && k < 4 && m.el[i].t === 'p'; i--, k++) { m.el[i].keepNext = true; if (DS.matn(m.el[i]).trim()) break; }   // sarlavhasi jadvaldan ajralmaydi
  return null;
}

// mijozQoida(m, { tur: 'shartnoma' | 'hujjat', imzo, raqam, rol, ism }) → ogohlantirishlar ro'yxati
function mijozQoida(m, o) {
  o = o || {};
  const og = [];
  kolontitul(m, o.tur === 'shartnoma' ? { imzo: o.imzo || 'Харидор', raqam: o.raqam } : {});
  const x = fishChiziq(m, { rol: o.rol, ism: o.ism }); if (x) og.push(x);
  return og;
}

// Chromium kolontituli — lib/docs_pdf.js (ijara bekor kelishuvi) va lib/xat_pdf.js (xatlar) uchun: page.pdf opsiyalari.
// imzo berilsa — o'ngda «<imzo> имзоси: ____» (har varaqda). Kolontitul pastki hoshiyaga chiziladi (hoshiya ≥ 28 pt bo'lishi kerak).
function chromKol(o) {
  o = o || {};
  const st = 'font-family:\'Liberation Serif\',\'Times New Roman\',serif;font-size:9pt;color:#555;';
  const bet = 'Варақ <span class="pageNumber"></span> / <span class="totalPages"></span>';
  const ich = o.imzo
    ? `<div style="${st}width:100%;margin:0 ${o.ong || 40}pt 0 ${o.chap || 40}pt;display:flex;justify-content:space-between;align-items:flex-end">`
      + `<span>${o.sarlavha ? o.sarlavha + '  ·  ' : ''}${bet}</span><span style="color:#000;font-size:10pt">${o.imzo} имзоси: ______________________</span></div>`
    : `<div style="${st}width:100%;text-align:center">${bet}</div>`;
  return { displayHeaderFooter: true, headerTemplate: '<span></span>', footerTemplate: ich };
}

module.exports = { kolontitul, fishChiziq, mijozQoida, chromKol };
