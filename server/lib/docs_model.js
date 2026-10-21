// AKS TIZIM — Google Docs hujjatining «modeli»: eski tizimdagi DocumentApp chaqiruvlarini (appendParagraph / appendTable va ularning
// sozlamalari) xuddi o'sha tartibda yozib oladigan yozuvchi. Eski Apps Script kodi (masalan Yurhujjat.gs yhSarlavha_, yhJadval_) shu
// yozuvchida deyarli o'zgarishsiz ishlaydi — natija (model) keyin PDF (lib/docs_pdf.js) va Word (lib/docs_docx.js) ga aylantiriladi.
// Sozlanmagan xususiyat — null (Docs'dagi standart qiymat: «Обычный текст» — Arial 11, qator oralig'i 1,15, chap tekislash).
'use strict';

const HorizontalAlignment = { LEFT: 'left', CENTER: 'center', RIGHT: 'right', JUSTIFY: 'both' };

function paragraf(x) {
  const o = { t: 'p', x: String(x == null ? '' : x), al: null, before: null, after: null, ls: null, indStart: null, indFirst: null, indEnd: null, font: null, sz: null, b: null };
  const p = {
    _m: o,
    setAlignment(v) { o.al = v; return p; }, setSpacingBefore(v) { o.before = v; return p; }, setSpacingAfter(v) { o.after = v; return p; },
    setLineSpacing(v) { o.ls = v; return p; }, setIndentStart(v) { o.indStart = v; return p; }, setIndentFirstLine(v) { o.indFirst = v; return p; },
    setIndentEnd(v) { o.indEnd = v; return p; }, getText() { return o.x; },
    editAsText() { const t = { setFontFamily(v) { o.font = v; return t; }, setFontSize(v) { o.sz = v; return t; }, setBold(v) { o.b = !!v; return t; } }; return t; },
    asParagraph() { return p; },
  };
  return p;
}
function jadval(qatorlar) {
  const o = { t: 'tbl', bw: null, bc: null, cols: {}, rows: [] };
  const C = qatorlar.map(r => r.map(x => {
    const par = paragraf(x), c = { x: par._m.x, pad: { t: null, b: null, l: null, r: null }, bg: null, p: par._m };
    const h = {
      setPaddingTop(v) { c.pad.t = v; return h; }, setPaddingBottom(v) { c.pad.b = v; return h; }, setPaddingLeft(v) { c.pad.l = v; return h; }, setPaddingRight(v) { c.pad.r = v; return h; },
      setBackgroundColor(v) { c.bg = v; return h; }, getText() { return c.x; }, getChild() { return par; }, getNumChildren() { return 1; },
    };
    return { c, h };
  }));
  o.rows = C.map(r => r.map(z => z.c));
  const t = {
    _m: o,
    setBorderWidth(v) { o.bw = v; return t; }, setBorderColor(v) { o.bc = v; return t; }, setColumnWidth(i, w) { o.cols[i] = w; return t; },
    getNumRows() { return C.length; }, getCell(i, j) { return C[i][j].h; }, getRow(i) { return { getNumCells: () => C[i].length }; },
  };
  return t;
}
const ElementType = { PARAGRAPH: 'p', TABLE: 'tbl', PAGE_BREAK: 'pb' };
// Yangi hujjat (DocumentApp.create): A4, hoshiyalar 72 pt, bitta bo'sh xatboshi bilan boshlanadi
function hujjat() {
  const m = { w: 595.28, h: 841.89, tepa: 72, past: 72, chap: 72, ong: 72, el: [paragraf('')._m] };
  const b = {
    setMarginTop(v) { m.tepa = v; return b; }, setMarginBottom(v) { m.past = v; return b; }, setMarginLeft(v) { m.chap = v; return b; }, setMarginRight(v) { m.ong = v; return b; },
    setPageWidth(v) { m.w = v; return b; }, setPageHeight(v) { m.h = v; return b; },
    appendParagraph(x) { const p = paragraf(x); m.el.push(p._m); return p; },
    // Docs hujjat jadval bilan tugay olmaydi: jadvaldan keyin o'zi bo'sh xatboshi qo'yadi — xatboshi sozlamalari standart,
    // matn sozlamalari (shrift, o'lcham, qalinlik) jadvaldan oldingi xatboshidan (eski buyruq va xatlarning Google eksportidan)
    appendTable(q) { const t = jadval(q); const old = [...m.el].reverse().find(e => e.t === 'p') || {}; m.el.push(t._m);
      const bo = paragraf('')._m; bo.font = old.font || null; bo.sz = old.sz || null; bo.b = old.b == null ? null : old.b; bo.auto = true; m.el.push(bo); return t; },
    // appendPageBreak: Docs yangi (bo'sh) xatboshi ichiga sahifa uzilishini qo'yadi — keyingi element yangi sahifadan boshlanadi
    appendPageBreak() { m.el.push({ t: 'pb' }); return b; },
    // getChild(i) — faqat o'chirish uchun (DocumentApp.create boshidagi bo'sh xatboshini olib tashlash: KelishuvBekor.gs kbHujjat_)
    getChild(i) { const e = m.el[i]; return { getType: () => e ? e.t : '', asParagraph: () => ({ getText: () => (e && e.x) || '' }), removeFromParent() { const k = m.el.indexOf(e); if (k >= 0) m.el.splice(k, 1); } }; },
  };
  return { body: b, model: m };
}

module.exports = { hujjat, HorizontalAlignment, ElementType };
