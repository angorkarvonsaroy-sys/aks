// AKS TIZIM — shartnomani bekor qilish BUYRUG'I va XABARNOMASINING Word (.docx) nusxasi serverda.
// Eski tizimda «Word» tugmasi Google Doc'ni .docx qilib eksport qilardi. Bu yerda o'sha eksport bilan bir xil tuzilishdagi fayl yasaladi:
//   BUYRUQ — Google eksportining o'zidan olingan qismlar (lib/bekor/buyruq_docx: uslublar, sozlamalar, shriftlar) + Bekor.gs bekorBuyruq_ dagi
//            xatboshilar Google yozadigan shaklda (xatboshi, jadval, sahifa o'lchami va hoshiyalar bir xil);
//   XABARNOMA — rasmiy blanka (lib/xat/blanka.docx — RASMIY_BLANKA_v2 ning Google eksporti) + Xat.gs dagi xatChiziq_ / xatRaqamSana_ /
//            xatBlankaJoy_ / xatImzoTold_ o'zgarishlari va bekorXabarnoma_ dagi xatboshilar va qarz jadvali.
// O'lcham (k) — PDF qaysi o'lchamda bir varaqqa sig'gan bo'lsa, Word ham shunda (eski tizimda Doc va PDF bitta hujjat edi).
'use strict';
const fs = require('fs');
const path = require('path');
const { zipYasa, zipOqi } = require('./xlsx');
const { yhSoz } = require('./bekor_hujjat');

const s = v => String(v == null ? '' : v);
const esc = v => s(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const BQ_DIR = path.join(__dirname, 'bekor', 'buyruq_docx');
const BLANKA = path.join(__dirname, 'xat', 'blanka.docx');
const XAT_MANZIL_CHAP = 290.6;
const QORA_PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGNgYGAAAAAEAAH2FzhVAAAAAElFTkSuQmCC', 'base64');   // Xat.gs XAT_QORA_PNG
const NS = '<w:document xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006" xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:w10="urn:schemas-microsoft-com:office:word" xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:wne="http://schemas.microsoft.com/office/word/2006/wordml" xmlns:sl="http://schemas.openxmlformats.org/schemaLibrary/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture" xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:lc="http://schemas.openxmlformats.org/drawingml/2006/lockedCanvas" xmlns:dgm="http://schemas.openxmlformats.org/drawingml/2006/diagram" xmlns:wps="http://schemas.microsoft.com/office/word/2010/wordprocessingShape" xmlns:wpg="http://schemas.microsoft.com/office/word/2010/wordprocessingGroup" xmlns:w14="http://schemas.microsoft.com/office/word/2010/wordml" xmlns:w15="http://schemas.microsoft.com/office/word/2012/wordml" xmlns:w16="http://schemas.microsoft.com/office/word/2018/wordml" xmlns:w16cex="http://schemas.microsoft.com/office/word/2018/wordml/cex" xmlns:w16cid="http://schemas.microsoft.com/office/word/2016/wordml/cid" xmlns="http://schemas.microsoft.com/office/tasks/2019/documenttasks" xmlns:cr="http://schemas.microsoft.com/office/comments/2020/reactions">';

// ------------------------------------------------------------------ Google eksporti shaklidagi xatboshi va jadval
const RF = '<w:rFonts w:ascii="Times New Roman" w:cs="Times New Roman" w:eastAsia="Times New Roman" w:hAnsi="Times New Roman"/>';
const PBDR = '<w:keepNext w:val="0"/><w:keepLines w:val="0"/><w:pageBreakBefore w:val="0"/><w:widowControl w:val="0"/><w:pBdr><w:top w:space="0" w:sz="0" w:val="nil"/><w:left w:space="0" w:sz="0" w:val="nil"/><w:bottom w:space="0" w:sz="0" w:val="nil"/><w:right w:space="0" w:sz="0" w:val="nil"/><w:between w:space="0" w:sz="0" w:val="nil"/></w:pBdr><w:shd w:fill="auto" w:val="clear"/>';
const R0 = '<w:r w:rsidDel="00000000" w:rsidR="00000000" w:rsidRPr="00000000">';
const tw = pt => { const v = Math.round(pt * 20 * 100) / 100; return String(v); };   // pt → twip (Google: 28,35 pt → 567)
function yasovchi() {
  let n = 0;
  const id = () => (++n).toString(16).toUpperCase().padStart(8, '0');
  // o: { matn, jc (left|center|right|both), before, after (pt), line (240 | 276), left, firstLine (pt), sz (pt), b }
  const p = o => {
    const sz = Math.round((o.sz || 11) * 2), b = o.b ? 1 : 0;
    const rpr = RF + '<w:b w:val="' + b + '"/><w:bCs w:val="' + b + '"/><w:sz w:val="' + sz + '"/><w:szCs w:val="' + sz + '"/>';
    return '<w:p w:rsidR="00000000" w:rsidDel="00000000" w:rsidP="00000000" w:rsidRDefault="00000000" w:rsidRPr="00000000" w14:paraId="' + id() + '"><w:pPr>' + PBDR
      + '<w:spacing w:after="' + tw(o.after || 0) + '" w:before="' + tw(o.before || 0) + '" w:line="' + (o.line || 240) + '" w:lineRule="auto"/>'
      + '<w:ind w:left="' + tw(o.left || 0) + '" w:right="0" w:firstLine="' + tw(o.firstLine || 0) + '"/><w:jc w:val="' + (o.jc || 'left') + '"/><w:rPr>' + rpr + '</w:rPr></w:pPr>'
      + (s(o.matn) !== '' ? R0 + '<w:rPr>' + rpr + '<w:rtl w:val="0"/></w:rPr><w:t xml:space="preserve">' + esc(o.matn) + '</w:t></w:r>' : R0 + '<w:rPr><w:rtl w:val="0"/></w:rPr></w:r>') + '</w:p>';
  };
  // t: { uslub, eni (twip yoki null), ustunlar [twip], chegara (null | {rang, sz}), mar {top,left,bottom,right} (twip), qatorlar: [[ p-obyekt ]] }
  const jadval = t => {
    const grid = t.ustunlar.map(w => '<w:gridCol w:w="' + w + '"/>').join('');
    const ch = t.chegara ? '<w:tblBorders>' + ['top', 'left', 'bottom', 'right', 'insideH', 'insideV'].map(k => '<w:' + k + ' w:color="' + t.chegara.rang + '" w:space="0" w:sz="' + t.chegara.sz + '" w:val="single"/>').join('') + '</w:tblBorders>' : '';
    const m = t.mar || { top: 0, left: 0, bottom: 0, right: 0 }, f = v => v.toFixed(1);
    const tcPr = '<w:tcPr><w:shd w:fill="auto" w:val="clear"/><w:tcMar><w:top w:w="' + f(m.top) + '" w:type="dxa"/><w:left w:w="' + f(m.left) + '" w:type="dxa"/><w:bottom w:w="' + f(m.bottom) + '" w:type="dxa"/><w:right w:w="' + f(m.right) + '" w:type="dxa"/></w:tcMar><w:vAlign w:val="top"/></w:tcPr>';
    return '<w:tbl><w:tblPr><w:tblStyle w:val="' + t.uslub + '"/>' + (t.eni ? '<w:tblW w:w="' + t.eni + '" w:type="dxa"/>' : '') + '<w:jc w:val="left"/>' + ch + '<w:tblLayout w:type="fixed"/><w:tblLook w:val="0600"/></w:tblPr>'
      + '<w:tblGrid>' + grid + '<w:tblGridChange w:id="0"><w:tblGrid>' + grid + '</w:tblGrid></w:tblGridChange></w:tblGrid>'
      + t.qatorlar.map(q => '<w:tr><w:trPr><w:cantSplit w:val="0"/><w:tblHeader w:val="0"/></w:trPr>' + q.map(c => '<w:tc>' + tcPr + p(c) + '</w:tc>').join('') + '</w:tr>').join('') + '</w:tbl>';
  };
  return { p, jadval, id };
}
const qism = rel => fs.readFileSync(path.join(BQ_DIR, rel));

// ------------------------------------------------------------------ BUYRUQ (bekorBuyruq_ — DocumentApp.create, oddiy shakl)
function buyruqDocx(M, raqam, sanaIso, k) {
  const z = n => Math.round(n * (k || 1) * 2) / 2;
  const Y = yasovchi(), P = Y.p;
  const par = (matn, o) => P({ matn, jc: { c: 'center', r: 'right', j: 'both' }[o.al] || 'left', before: z(o.before || 0), after: z(o.after || 0), line: 240,
    left: 0, firstLine: o.ind ? 28.35 : 0, sz: z(o.sz || 11), b: o.b });
  let h = par('«ANGOR KARVON SAROY» МАСЪУЛИЯТИ ЧЕКЛАНГАН ЖАМИЯТИ', { al: 'c', b: true, sz: 12.5, after: 2 })
    + par('БУЙРУҚ', { al: 'c', b: true, sz: 14, before: 6, after: 4 });
  const yacheyka = (matn, jc, b) => ({ matn, jc, line: 276, sz: z(11), b });
  h += Y.jadval({ uslub: 'Table1', ustunlar: ['4934.5', '4934.5'], qatorlar: [[yacheyka(yhSoz(sanaIso), 'left', false), yacheyka(raqam + '-сон', 'right', false)]] });
  h += P({ matn: '', jc: 'left', line: 276, sz: z(14), b: true });   // Docs jadvaldan keyin o'zi qo'yadigan bo'sh xatboshi (oldingi xatboshi shrifti bilan)
  h += par('Ангор тумани', { al: 'c', sz: 11, after: 6 }) + par(M.sarl, { al: 'c', b: true, sz: 11.5, after: 5 });
  M.K.forEach(m => { h += par(m, { al: 'j', ind: true, sz: 11, after: 2 }); });
  h += par('БУЮРАМАН:', { al: 'c', b: true, sz: 11.5, before: 4, after: 3 });
  M.B.forEach((m, i) => { h += par((i + 1) + '. ' + m, { al: 'j', ind: true, sz: 11, after: 2 }); });
  h += par(' ', { sz: 10, before: 4 });
  h += Y.jadval({ uslub: 'Table2', eni: '9800.0', ustunlar: ['3000', '3800', '3000'],
    qatorlar: [[yacheyka('Директор', 'left', true), yacheyka('__________________', 'center', false), yacheyka('К.Ҳ.Ҳайдаров', 'right', true)]] });
  h += P({ matn: '', jc: 'left', line: 276, sz: z(10), b: false });
  const doc = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\r' + NS + '<w:body>' + h
    + '<w:sectPr><w:pgSz w:h="16834" w:w="11909" w:orient="portrait"/><w:pgMar w:bottom="800" w:top="1000" w:left="1200" w:right="840" w:header="720" w:footer="720"/><w:pgNumType w:start="1"/></w:sectPr></w:body></w:document>';
  return zipYasa([
    { nom: 'word/numbering.xml', data: qism('word/numbering.xml') }, { nom: 'word/settings.xml', data: qism('word/settings.xml') },
    { nom: 'word/fontTable.xml', data: qism('word/fontTable.xml') }, { nom: 'word/styles.xml', data: qism('word/styles.xml') },
    { nom: 'word/document.xml', data: doc }, { nom: 'word/_rels/document.xml.rels', data: qism('word/_rels/document.xml.rels') },
    { nom: '_rels/.rels', data: qism('_rels/.rels') }, { nom: 'word/theme/theme1.xml', data: qism('word/theme/theme1.xml') },
    { nom: '[Content_Types].xml', data: qism('[Content_Types].xml') }]);
}

// ------------------------------------------------------------------ XABARNOMA (bekorXabarnoma_ — rasmiy blanka nusxasi)
let blankaKesh = null;
function blanka() { if (!blankaKesh) blankaKesh = zipOqi(fs.readFileSync(BLANKA)); return blankaKesh; }
const ELEM = /<w:p [^>]*>[\s\S]*?<\/w:p>|<w:tbl>[\s\S]*?<\/w:tbl>|<w:sectPr[\s\S]*?<\/w:sectPr>/g;
const matnOf = e => (e.match(/<w:t(?: [^>]*)?>[^<]*<\/w:t>/g) || []).map(t => t.replace(/<[^>]+>/g, '')).join('');
// M — xabarnomaMatn (PA, rows, PB); x — fishK, manzil; q — { ism, tel } (Ижрочи)
function xabarnomaDocx(x, M, xRaqam, sanaIso, ij, k) {
  const z = n => Math.round(n * (k || 1) * 2) / 2;
  const Y = yasovchi(), P = Y.p;
  let oldin = 0;
  const q = (matn, o) => { const r = P({ matn, jc: o.al === 'both' ? 'both' : o.al || 'left', before: z((o.before || 0) + oldin), after: z(o.after || 0), line: 240,
    left: o.left || 0, firstLine: o.ind ? 28.35 : 0,   /* Docs: 1-qator chekinishi = chap chekinish + 28,35; Word'da chap chekinishga nisbatan */ sz: z(o.sz || 11), b: o.b }); oldin = 0; return r; };
  let h = '';
  if (x.manzil) h += q(x.manzil + 'да яшовчи', { al: 'right', left: XAT_MANZIL_CHAP });
  h += q(x.fishK + 'га', { al: 'right', left: XAT_MANZIL_CHAP, b: true });
  h += q(' ', {});
  h += q('ШАРТНОМАНИ БИР ТОМОНЛАМА БЕКОР ҚИЛИШ', { al: 'center', b: true, after: 0 });
  h += q('ТЎҒРИСИДА ХАБАРНОМА', { al: 'center', b: true, after: 3 });
  M.PA.forEach(m => { h += q(m, { al: 'both', ind: true, after: 1.5 }); });
  if (M.rows) {
    const n = M.rows.length;
    h += Y.jadval({ uslub: 'Table2', ustunlar: ['6200', '3154'], chegara: { rang: '808080', sz: 4 }, mar: { top: 20, left: 80, bottom: 20, right: 80 },
      qatorlar: M.rows.map((r, i) => r.map((c, j) => ({ matn: c, jc: j ? 'right' : 'left', line: 240, sz: z(10), b: i === n - 1 }))) });
    oldin = 5;
  }
  M.PB.forEach(m => { h += q(m, { al: 'both', ind: true, after: 1.5 }); });
  h += q('Илова: буйруқ нусхаси — ___ варақ.', { al: 'left', b: true, before: 1.5 });
  return blankaQur(h, xRaqam, sanaIso, ij, true);
}
// Rasmiy blankadagi boshqa xatlar (yurist aloqa xati va h.k.): bloklar — lib/xat_pdf.js blankaYasa bloklari (p / imzo), k — PDF qaysi o'lchamda sig'gan bo'lsa
function bloklarDocx(bloklar, xRaqam, sanaIso, ij, k) {
  const z = n => Math.round(n * (k || 1) * 2) / 2;
  const Y = yasovchi(), P = Y.p;
  let h = '';
  bloklar.forEach(o => {
    if (o.t !== 'p') return;
    h += P({ matn: o.x, jc: o.al === 'both' ? 'both' : o.al || 'left', before: z(o.before || 0), after: z(o.after || 0), line: 240,
      left: o.left || 0, firstLine: o.ind ? 28.35 : 0, sz: z(o.sz || 11), b: o.b });
  });
  return blankaQur(h, xRaqam, sanaIso, ij, false);
}
// blanka nusxasi: shapka, chiziq, № va sana, matn («Директор» dan oldin), imzo bloki — h — matn xatboshilari (Google eksporti shaklida)
function blankaQur(h, xRaqam, sanaIso, ij, jadvalUslubi) {
  const B = blanka();
  const yil = sanaIso.slice(0, 4);
  const XAT_OY = ['январ', 'феврал', 'март', 'апрел', 'май', 'июн', 'июл', 'август', 'сентябр', 'октябр', 'ноябр', 'декабр'];
  const sanaMatn = '«' + sanaIso.slice(8, 10) + '» ' + XAT_OY[Number(sanaIso.slice(5, 7)) - 1] + ' ' + yil + ' йил';
  const d0 = B['word/document.xml'].toString('utf8');
  const bosh = d0.slice(0, d0.indexOf('<w:body>') + 8), oxir = d0.slice(d0.lastIndexOf('</w:body>'));
  const E = d0.slice(bosh.length, d0.length - oxir.length).match(ELEM);
  // xatShapkaTuzat_: shapka jadvalining 2-ustunidagi manfiy o'ng chekinish → 0 (logotip joyi blankadagidek — 75 pt)
  const ti = E.findIndex(e => e.startsWith('<w:tbl>'));
  // va setLeftOffset(XAT_LOGO_CHAP = 75) — Google eksportida joylashgan logotip ustun chetidan 1066800 EMU (eski xatning eksportidan)
  if (ti >= 0) E[ti] = E[ti].replace(/<w:tr>[\s\S]*?<\/w:tr>/g, tr => { let c = 0; return tr.replace(/<w:tc>[\s\S]*?<\/w:tc>/g, tc => (c++ > 0 ? tc.replace(/w:right="-\d+"/g, 'w:right="0"') : tc)); })
    .replace(/(<wp:positionH relativeFrom="column"><wp:posOffset>)\d+(<\/wp:posOffset>)/g, '$11066800$2');
  // xatChiziq_: jadvaldan keyingi gorizontal chiziq o'rniga qora chiziq-rasm, oraliqlar 0. O'lchamlar eski xatning Google eksportidan
  // (YU-2026/0003): 5918200 × 25400 EMU (466 × 2 pt), atrofida 19050 EMU.
  if (ti >= 0 && /o:hr="t"/.test(E[ti + 1] || '')) {
    E[ti + 1] = E[ti + 1].replace(/<w:spacing [^>]*\/>/, '<w:spacing w:after="0" w:before="0" w:line="240" w:lineRule="auto"/><w:ind w:left="0" w:right="0" w:firstLine="0"/>')
      .replace(/<w:r [^>]*><w:pict>[\s\S]*?<\/w:pict><\/w:r>/, R0 + '<w:rPr/><w:drawing><wp:inline distB="19050" distT="19050" distL="19050" distR="19050"><wp:extent cx="5918200" cy="25400"/><wp:effectExtent b="0" l="0" r="0" t="0"/><wp:docPr id="1" name="image3.png"/><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic><pic:nvPicPr><pic:cNvPr id="0" name="image3.png"/><pic:cNvPicPr preferRelativeResize="0"/></pic:nvPicPr><pic:blipFill><a:blip r:embed="rId8"/><a:srcRect b="0" l="0" r="0" t="0"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="5918200" cy="25400"/></a:xfrm><a:prstGeom prst="rect"/><a:ln/></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>');
    // Google eksporti uchta rasmni qayta nomlaydi: logotiplar (rId6, rId7) → image1 / image2 (docPr 3 / 2), chiziq (rId8) → image3 (docPr 1)
    E[ti] = E[ti].replace(/<w:drawing>[\s\S]*?<\/w:drawing>/g, dr => { const r = (/r:embed="(rId\d+)"/.exec(dr) || [])[1]; const m = { rId6: [3, 'image1.png'], rId7: [2, 'image2.png'] }[r];
      return m ? dr.replace(/<wp:docPr id="\d+" name="[^"]*"\/>/, '<wp:docPr id="' + m[0] + '" name="' + m[1] + '"/>').replace(/(<pic:cNvPr id="0" name=")[^"]*("\/>)/, '$1' + m[1] + '$2') : dr; });
  }
  // xatRaqamSana_: «№ ____» → «№ BX-…», tab dan keyingi chiziqcha → sana
  const ni = E.findIndex(e => e.startsWith('<w:p ') && /^\s*№/.test(matnOf(e)));
  const di = E.findIndex((e, i) => i > ni && e.startsWith('<w:p ') && /^\s*Директор/.test(matnOf(e)));
  if (ni < 0 || di < 0) throw new Error('Rasmiy blankada «№» yoki «Директор» qatori topilmadi — blanka o\'zgargan.');
  E[ni] = E[ni].replace(/(<w:t[^>]*>)№ *_+(<\/w:t>)/, (m, a, b) => a + esc('№ ' + xRaqam) + b).replace(/(<w:tab\/><w:t[^>]*>)_+(<\/w:t>)/, (m, a, b) => a + esc(sanaMatn) + b);
  // xatBlankaJoy_: № va «Директор» orasidagi bo'sh xatboshilar olib tashlanadi; matn «Директор» dan oldin
  // xatImzoTold_: Ижрочи qatori va «Асл нусхасини олдим … YYYY й.»
  const qoldi = E.filter((e, i) => !(i > ni && i < di && e.startsWith('<w:p ') && !matnOf(e).trim()));
  const D = qoldi.findIndex(e => e === E[di]);
  for (let i = D + 1; i < qoldi.length; i++) {
    const t = matnOf(qoldi[i]);
    if (/^\s*Ижрочи/.test(t)) qoldi[i] = qoldi[i].replace(/(<w:t[^>]*>)Ижрочи:[^<]*(<\/w:t>)/, (m, a, b) => a + esc('Ижрочи: ' + s(ij.ism) + ', тел.: ' + s(ij.tel)) + b);
    else if (/^\s*Асл нусхасини/.test(t)) qoldi[i] = qoldi[i].replace(/(<w:t[^>]*>[^<]*?)\d{4} й\.([^<]*<\/w:t>)/, (m, a, b) => a + yil + ' й.' + b);
  }
  // xatboshi raqamlari (w14:paraId) — Google eksportidagidek butun hujjat bo'yicha tartib bilan 1 dan
  let nn = 0;
  const doc = (bosh + qoldi.slice(0, D).join('') + h + qoldi.slice(D).join('') + oxir).replace(/w14:paraId="[0-9A-F]{8}"/g, () => 'w14:paraId="' + (++nn).toString(16).toUpperCase().padStart(8, '0') + '"');
  // Table2 uslubi (Google eksportida har jadvalga alohida uslub), chiziq rasmi
  let st = B['word/styles.xml'].toString('utf8');
  if (jadvalUslubi && !/w:styleId="Table2"/.test(st)) st = st.replace('</w:styles>', '<w:style w:type="table" w:styleId="Table2"><w:basedOn w:val="TableNormal"/><w:tblPr><w:tblStyleRowBandSize w:val="1"/><w:tblStyleColBandSize w:val="1"/></w:tblPr></w:style></w:styles>');
  const rels = B['word/_rels/document.xml.rels'].toString('utf8').replace(/(Id="rId6"[^>]*Target=")media\/image\d\.png/, '$1media/image1.png').replace(/(Id="rId7"[^>]*Target=")media\/image\d\.png/, '$1media/image2.png')
    .replace('</Relationships>', '<Relationship Id="rId8" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/image3.png"/></Relationships>');
  const rasm = rId => { const t = (new RegExp('Id="' + rId + '"[^>]*Target="(media\\/image\\d\\.png)"').exec(B['word/_rels/document.xml.rels'].toString('utf8')) || [])[1]; return B['word/' + t]; };
  const ft = B['word/fontTable.xml'].toString('utf8'), fontlar = /w:name="Times New Roman"/.test(ft) ? ft : ft.replace('</w:fonts>', '<w:font w:name="Times New Roman"/></w:fonts>');
  const media = { 'word/media/image1.png': rasm('rId6'), 'word/media/image2.png': rasm('rId7') };
  const fayllar = Object.keys(B).filter(n => !/\/$/.test(n)).map(nom => ({ nom, data: nom === 'word/document.xml' ? doc : nom === 'word/styles.xml' ? st : nom === 'word/_rels/document.xml.rels' ? rels
    : nom === 'word/fontTable.xml' ? fontlar : media[nom] || B[nom] }));
  fayllar.push({ nom: 'word/media/image3.png', data: QORA_PNG });
  return zipYasa(fayllar);
}

module.exports = { buyruqDocx, xabarnomaDocx, bloklarDocx };
