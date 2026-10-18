// AKS TIZIM — Google Docs hujjati modelidan (lib/docs_model.js) Word (.docx): eski tizimdagi «Word» tugmasi Google Doc'ni .docx qilib
// eksport qilardi — bu yerda o'sha eksport bilan bir xil tuzilishdagi fayl yasaladi (xatboshi va jadval yozuvi, uslublar, sahifa).
// Umumiy qismlar (shriftlar, sozlamalar, mavzu) — DocumentApp.create hujjatining Google eksportidan (lib/bekor/buyruq_docx — bir xil).
// Yurist ma'lumotnomasi namunasi (19.10.2026) bilan document.xml bayt-ma-bayt solishtirilgan.
'use strict';
const fs = require('fs');
const path = require('path');
const { zipYasa } = require('./xlsx');

const DIR = path.join(__dirname, 'bekor', 'buyruq_docx');
const qism = rel => fs.readFileSync(path.join(DIR, rel));
const s = v => String(v == null ? '' : v);
const esc = v => s(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const NS = '<w:document xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006" xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:w10="urn:schemas-microsoft-com:office:word" xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:wne="http://schemas.microsoft.com/office/word/2006/wordml" xmlns:sl="http://schemas.openxmlformats.org/schemaLibrary/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture" xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:lc="http://schemas.openxmlformats.org/drawingml/2006/lockedCanvas" xmlns:dgm="http://schemas.openxmlformats.org/drawingml/2006/diagram" xmlns:wps="http://schemas.microsoft.com/office/word/2010/wordprocessingShape" xmlns:wpg="http://schemas.microsoft.com/office/word/2010/wordprocessingGroup" xmlns:w14="http://schemas.microsoft.com/office/word/2010/wordml" xmlns:w15="http://schemas.microsoft.com/office/word/2012/wordml" xmlns:w16="http://schemas.microsoft.com/office/word/2018/wordml" xmlns:w16cex="http://schemas.microsoft.com/office/word/2018/wordml/cex" xmlns:w16cid="http://schemas.microsoft.com/office/word/2016/wordml/cid" xmlns="http://schemas.microsoft.com/office/tasks/2019/documenttasks" xmlns:cr="http://schemas.microsoft.com/office/comments/2020/reactions">';
const PBDR = '<w:keepNext w:val="0"/><w:keepLines w:val="0"/><w:pageBreakBefore w:val="0"/><w:widowControl w:val="0"/><w:pBdr><w:top w:space="0" w:sz="0" w:val="nil"/><w:left w:space="0" w:sz="0" w:val="nil"/><w:bottom w:space="0" w:sz="0" w:val="nil"/><w:right w:space="0" w:sz="0" w:val="nil"/><w:between w:space="0" w:sz="0" w:val="nil"/></w:pBdr><w:shd w:fill="auto" w:val="clear"/>';
const R0 = '<w:r w:rsidDel="00000000" w:rsidR="00000000" w:rsidRPr="00000000">';
const P0 = '<w:p w:rsidR="00000000" w:rsidDel="00000000" w:rsidP="00000000" w:rsidRDefault="00000000" w:rsidRPr="00000000" w14:paraId="00000000">';
const tw = pt => String(Math.round(pt * 20 * 100) / 100);
const twD = pt => (Math.round(pt * 20 * 10) / 10).toFixed(1);   // «20.0» ko'rinishida (jadval eni, katak chekinishlari)

function rpr(p) {
  let x = '';
  if (p.font) x += '<w:rFonts w:ascii="' + p.font + '" w:cs="' + p.font + '" w:eastAsia="' + p.font + '" w:hAnsi="' + p.font + '"/>';
  if (p.b != null) x += '<w:b w:val="' + (p.b ? 1 : 0) + '"/><w:bCs w:val="' + (p.b ? 1 : 0) + '"/>';
  if (p.sz != null) { const h = Math.round(p.sz * 2); x += '<w:sz w:val="' + h + '"/><w:szCs w:val="' + h + '"/>'; }
  return x;
}
// xatboshi; bosh — DocumentApp.create dagi tegilmagan birinchi bo'sh xatboshi (eksportda qisqa yoziladi)
function par(p, bosh) {
  if (bosh) return P0 + '<w:pPr><w:rPr/></w:pPr>' + R0 + '<w:rPr><w:rtl w:val="0"/></w:rPr></w:r></w:p>';
  const r = rpr(p);
  const ppr = '<w:pPr>' + PBDR + '<w:spacing w:after="' + tw(p.after || 0) + '" w:before="' + tw(p.before || 0) + '" w:line="' + Math.round(240 * (p.ls == null ? 1.15 : p.ls)) + '" w:lineRule="auto"/>'
    + '<w:ind w:left="' + tw(p.indStart || 0) + '" w:right="' + tw(p.indEnd || 0) + '" w:firstLine="' + tw((p.indFirst || 0) - (p.indStart || 0)) + '"/>'
    + '<w:jc w:val="' + (p.al || 'left') + '"/><w:rPr>' + r + '</w:rPr></w:pPr>';
  return P0 + ppr + (s(p.x) !== '' ? R0 + '<w:rPr>' + r + '<w:rtl w:val="0"/></w:rPr><w:t xml:space="preserve">' + esc(p.x) + '</w:t></w:r>' : R0 + '<w:rPr><w:rtl w:val="0"/></w:rPr></w:r>') + '</w:p>';
}
function jadval(t, k) {
  const n = Math.max(...t.rows.map(r => r.length));
  const w = []; for (let i = 0; i < n; i++) w.push(t.cols[i] != null ? t.cols[i] : 100);
  const grid = w.map(x => '<w:gridCol w:w="' + tw(x) + '"/>').join('');
  const rang = s(t.bc || '#000000').replace('#', '').toLowerCase();
  const ch = t.bw ? '<w:tblBorders>' + ['top', 'left', 'bottom', 'right', 'insideH', 'insideV'].map(q => '<w:' + q + ' w:color="' + rang + '" w:space="0" w:sz="' + Math.round(t.bw * 8) + '" w:val="single"/>').join('') + '</w:tblBorders>' : '';
  let x = '<w:tbl><w:tblPr><w:tblStyle w:val="Table' + k + '"/><w:tblW w:w="' + twD(w.reduce((a, b) => a + b, 0)) + '" w:type="dxa"/><w:jc w:val="left"/>' + ch + '<w:tblLayout w:type="fixed"/><w:tblLook w:val="0600"/></w:tblPr>'
    + '<w:tblGrid>' + grid + '<w:tblGridChange w:id="0"><w:tblGrid>' + grid + '</w:tblGrid></w:tblGridChange></w:tblGrid>';
  t.rows.forEach(r => {
    x += '<w:tr><w:trPr><w:cantSplit w:val="0"/><w:tblHeader w:val="0"/></w:trPr>' + r.map(c => {
      const m = k2 => twD(c.pad[k2] == null ? 5 : c.pad[k2]);
      return '<w:tc><w:tcPr><w:shd w:fill="' + (c.bg ? s(c.bg).replace('#', '').toLowerCase() : 'auto') + '" w:val="clear"/><w:tcMar><w:top w:w="' + m('t') + '" w:type="dxa"/><w:left w:w="' + m('l') + '" w:type="dxa"/><w:bottom w:w="' + m('b') + '" w:type="dxa"/><w:right w:w="' + m('r') + '" w:type="dxa"/></w:tcMar><w:vAlign w:val="top"/></w:tcPr>'
        + par(Object.assign({}, c.p, { x: c.x })) + '</w:tc>';
    }).join('') + '</w:tr>';
  });
  return x + '</w:tbl>';
}
// Sahifa: Docs eksportidagi o'lcham (A4 — 11909 × 16834 twip), yo'nalish, hoshiyalar
function sect(m) {
  const land = m.w > m.h, W = land ? 16838 : 11909, H = land ? 11906 : 16834;   // Docs eksporti: albom — 16838 × 11906, kitob — 11909 × 16834
  return '<w:sectPr><w:pgSz w:h="' + H + '" w:w="' + W + '" w:orient="' + (land ? 'landscape' : 'portrait') + '"/><w:pgMar w:bottom="' + tw(m.past) + '" w:top="' + tw(m.tepa) + '" w:left="' + tw(m.chap) + '" w:right="' + tw(m.ong) + '" w:header="720" w:footer="720"/><w:pgNumType w:start="1"/></w:sectPr>';
}
function documentXml(m) {
  let k = 0, nn = 0;
  const h = m.el.map((e, i) => e.t === 'tbl' ? jadval(e, ++k) : par(e, i === 0 && !e.x && e.al == null && e.sz == null && e.before == null)).join('');
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\r' + NS + '<w:body>' + h.replace(/w14:paraId="00000000"/g, () => 'w14:paraId="' + (++nn).toString(16).toUpperCase().padStart(8, '0') + '"') + sect(m) + '</w:body></w:document>';
}
function stylesXml(n) {   // har jadvalga alohida «TableN» uslubi (Google eksportidagidek)
  const st = qism('word/styles.xml').toString('utf8').replace(/<w:style w:type="table" w:styleId="Table\d+">[\s\S]*?<\/w:style>/g, '');
  let t = ''; for (let i = 1; i <= n; i++) t += '<w:style w:type="table" w:styleId="Table' + i + '"><w:basedOn w:val="TableNormal"/><w:tblPr><w:tblStyleRowBandSize w:val="1"/><w:tblStyleColBandSize w:val="1"/></w:tblPr></w:style>';
  return st.replace('</w:styles>', t + '</w:styles>');
}
function yasa(m) {
  const n = m.el.filter(e => e.t === 'tbl').length;
  return zipYasa([
    { nom: 'word/numbering.xml', data: qism('word/numbering.xml') }, { nom: 'word/settings.xml', data: qism('word/settings.xml') },
    { nom: 'word/fontTable.xml', data: qism('word/fontTable.xml') }, { nom: 'word/styles.xml', data: stylesXml(n) },
    { nom: 'word/document.xml', data: documentXml(m) }, { nom: 'word/_rels/document.xml.rels', data: qism('word/_rels/document.xml.rels') },
    { nom: '_rels/.rels', data: qism('_rels/.rels') }, { nom: 'word/theme/theme1.xml', data: qism('word/theme/theme1.xml') },
    { nom: '[Content_Types].xml', data: qism('[Content_Types].xml') }]);
}

module.exports = { yasa, documentXml, stylesXml };
