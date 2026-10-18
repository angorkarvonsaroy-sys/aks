// AKS TIZIM — Google Sheets'ning «.xlsx qilib yuklab olish» natijasi bilan bir xil Excel fayl. Eski tizim Excel'ni vaqtinchalik Google
// jadvalda yasab (SpreadsheetApp.create → setValues, setFontWeight, setNumberFormat …) uni xlsx qilib eksport qilardi. Bu yerda o'sha
// chaqiruvlarni yozib oladigan kichik «jadval» (yozuvchi) va undan Google eksporti tuzilishidagi xlsx yasovchi bor:
//   • qiymatlar setValues dagidek talqin qilinadi (raqam, sana «dd.MM.yyyy» → sana + d.m.yyyy / dd.mm.yyyy formati, matn);
//   • uslublar (shrift, fon, son formati) har katakka; jadvaldagi tartibda birinchi uchragani bo'yicha raqamlanadi (Google kabi);
//   • ustun eni px/8 + 0,125, muzlatilgan qatorlar, faol katak B(muzlatilgan+2), bo'sh chizma, person.xml — eksportdagidek.
// Yurist bayonnomasi va penya hisobining eski Excel fayllari (19.10.2026) bilan solishtirilgan (styles.xml bayt-ma-bayt).
'use strict';
const fs = require('fs');
const path = require('path');
const { zipYasa, sheetsQiymat } = require('./xlsx');

const s = v => String(v == null ? '' : v);
const esc = v => s(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
const harf = n => { let r = ''; n++; while (n > 0) { const m = (n - 1) % 26; r = String.fromCharCode(65 + m) + r; n = Math.floor((n - 1) / 26); } return r; };
const THEME = path.join(__dirname, 'xlsx_google', 'theme1.xml');

// ------------------------------------------------------------------ yozuvchi (SpreadsheetApp ning kerakli qismi)
function varaq(nom) {
  const v = { nom, kat: new Map(), muz: 0, eni: {} };   // kat: 'q,u' → { v (talqin qilingan), b, sz, rang, fon, nf }
  const k = (q, u) => { const kk = q + ',' + u; if (!v.kat.has(kk)) v.kat.set(kk, {}); return v.kat.get(kk); };
  const range = (q, u, nq, nu) => {
    nq = nq || 1; nu = nu || 1;
    const har = f => { for (let i = 0; i < nq; i++) for (let j = 0; j < nu; j++) f(k(q + i, u + j), i, j); return R; };
    const R = {
      setValues: m => har((c, i, j) => { const x = m[i][j]; c.v = typeof x === 'number' ? (isFinite(x) ? { t: 'n', v: x } : null) : sheetsQiymat(x); }),
      setValue: x => har(c => { c.v = typeof x === 'number' ? { t: 'n', v: x } : sheetsQiymat(x); }),
      setFontWeight: w => har(c => { c.b = w === 'bold'; }),
      setFontSize: n => har(c => { c.sz = n; }),
      setFontColor: r => har(c => { c.rang = s(r).replace('#', '').toUpperCase(); }),
      setBackground: r => har(c => { c.fon = s(r).replace('#', '').toUpperCase(); }),
      setNumberFormat: f => har(c => { c.nf = f; }),
    };
    return R;
  };
  const sh = {
    _v: v,
    setName(n) { v.nom = n; return sh; }, getRange: range,
    setFrozenRows(n) { v.muz = n; return sh; }, setColumnWidth(u, px) { v.eni[u] = px; return sh; },
  };
  return sh;
}
function kitob(nom0) {
  const V = [varaq('Лист1')];
  return { getSheets: () => V.slice(), insertSheet: n => { const x = varaq(n); V.push(x); return x; }, _V: V };
}

// ------------------------------------------------------------------ Java Double.toString (Google eksportidagi raqam yozuvi)
function javaSon(x) {
  if (Object.is(x, -0)) return '-0.0';
  const a = Math.abs(x);
  if (a === 0) return '0.0';
  if (a >= 1e-3 && a < 1e7) { const t = String(x); return /[.e]/.test(t) ? t : t + '.0'; }
  let [m, e] = x.toExponential().split('e');
  if (!m.includes('.')) m += '.0';
  return m + 'E' + Number(e);
}

// ------------------------------------------------------------------ xlsx
function yasa(kt) {
  const V = kt._V.map(x => x._v);
  // 1) kataklar ro'yxati va tartib: qator → ustun → varaq (keyingi varaq oldin — Google eksportidagi uslub raqamlari tartibi)
  const tartib = [];
  V.forEach((v, vi) => v.kat.forEach((c, kk) => { const [q, u] = kk.split(',').map(Number); tartib.push({ vi, q, u, c }); }));
  tartib.sort((a, b) => a.q - b.q || a.u - b.u || b.vi - a.vi);
  // 2) uslublar
  const nfId = {}, nfList = []; let nfN = 164;
  const nf = f => { if (!f || f === 'General') return 0; if (nfId[f] == null) { nfId[f] = nfN++; nfList.push(f); } return nfId[f]; };
  const fonts = ['<font><sz val="10.0"/><color rgb="FF000000"/><name val="Arial"/><scheme val="minor"/></font>'], fontId = {};
  const font = c => { const x = '<font>' + (c.b ? '<b/>' : '') + (c.sz ? '<sz val="' + Number(c.sz).toFixed(1) + '"/>' : '') + (c.rang ? '<color rgb="FF' + c.rang + '"/>' : '<color theme="1"/>') + '<name val="Arial"/><scheme val="minor"/></font>';
    if (fontId[x] == null) { fontId[x] = fonts.length; fonts.push(x); } return fontId[x]; };
  const fills = ['<fill><patternFill patternType="none"/></fill>', '<fill><patternFill patternType="lightGray"/></fill>'], fillId = {};
  const fill = r => { if (!r) return 0; if (fillId[r] == null) { fillId[r] = fills.length; fills.push('<fill><patternFill patternType="solid"><fgColor rgb="FF' + r + '"/><bgColor rgb="FF' + r + '"/></patternFill></fill>'); } return fillId[r]; };
  const xfs = ['<xf borderId="0" fillId="0" fontId="0" numFmtId="0" xfId="0" applyAlignment="1" applyFont="1"><alignment readingOrder="0" shrinkToFit="0" vertical="bottom" wrapText="0"/></xf>'], xfId = {};
  const sst = [], sstId = {}; let sstSon = 0;
  tartib.forEach(z => {
    const c = z.c, bor = !!c.v, ff = c.b || c.sz || c.rang || c.fon || c.nf || bor;
    if (!ff) { z.s = null; return; }
    const n = c.nf ? nf(c.nf) : (c.v && c.v.sana ? nf(c.v.sana) : 0);
    const fo = font(c), fi = fill(c.fon);
    const kalit = [bor ? (c.v.t === 's' ? 's' : 'n') : 'e', fo, fi, n].join('|');
    if (xfId[kalit] == null) {
      xfId[kalit] = xfs.length;
      xfs.push('<xf borderId="0" fillId="' + fi + '" fontId="' + fo + '" numFmtId="' + n + '" xfId="0"' + (bor ? ' applyAlignment="1"' : '') + (fi ? ' applyFill="1"' : '') + ' applyFont="1"' + (n ? ' applyNumberFormat="1"' : '')
        + (bor ? '><alignment readingOrder="0"/></xf>' : '/>'));
    }
    z.s = xfId[kalit];
    if (bor && c.v.t === 's') { sstSon++; if (sstId[c.v.v] == null) { sstId[c.v.v] = sst.length; sst.push(c.v.v); } }
  });
  const styles = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:x14ac="http://schemas.microsoft.com/office/spreadsheetml/2009/9/ac" xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006">'
    + (nfList.length ? '<numFmts count="' + nfList.length + '">' + nfList.map(f => '<numFmt numFmtId="' + nfId[f] + '" formatCode="' + esc(f) + '"/>').join('') + '</numFmts>' : '')
    + '<fonts count="' + fonts.length + '">' + fonts.join('') + '</fonts><fills count="' + fills.length + '">' + fills.join('') + '</fills><borders count="1"><border/></borders>'
    + '<cellStyleXfs count="1"><xf borderId="0" fillId="0" fontId="0" numFmtId="0" applyAlignment="1" applyFont="1"/></cellStyleXfs><cellXfs count="' + xfs.length + '">' + xfs.join('') + '</cellXfs>'
    + '<cellStyles count="1"><cellStyle xfId="0" name="Normal" builtinId="0"/></cellStyles><dxfs count="0"/></styleSheet>';
  const NSW = 'xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:mx="http://schemas.microsoft.com/office/mac/excel/2008/main" xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006" xmlns:mv="urn:schemas-microsoft-com:mac:vml" xmlns:x14="http://schemas.microsoft.com/office/spreadsheetml/2009/9/main" xmlns:x15="http://schemas.microsoft.com/office/spreadsheetml/2010/11/main" xmlns:x14ac="http://schemas.microsoft.com/office/spreadsheetml/2009/9/ac" xmlns:xm="http://schemas.microsoft.com/office/excel/2006/main"';
  // 3) varaqlar
  const sheetXml = (v, vi) => {
    const qat = new Map();
    tartib.filter(z => z.vi === vi && z.s != null).forEach(z => { if (!qat.has(z.q)) qat.set(z.q, []); qat.get(z.q).push(z); });
    const rows = [...qat.keys()].sort((a, b) => a - b).map(q => '<row r="' + q + '">' + qat.get(q).sort((a, b) => a.u - b.u).map(z => {
      const r = harf(z.u - 1) + q, c = z.c;
      if (!c.v) return '<c r="' + r + '" s="' + z.s + '"/>';
      if (c.v.t === 's') return '<c r="' + r + '" s="' + z.s + '" t="s"><v>' + sstId[c.v.v] + '</v></c>';
      if (c.v.t === 'b') return '<c r="' + r + '" s="' + z.s + '" t="b"><v>' + (c.v.v ? 1 : 0) + '</v></c>';
      return '<c r="' + r + '" s="' + z.s + '"><v>' + javaSon(c.v.v) + '</v></c>';
    }).join('') + '</row>').join('');
    const pane = v.muz ? '<pane ySplit="' + v.muz.toFixed(1) + '" topLeftCell="A' + (v.muz + 1) + '" activePane="bottomLeft" state="frozen"/><selection activeCell="B' + (v.muz + 2) + '" sqref="B' + (v.muz + 2) + '" pane="bottomLeft"/>' : '';
    const en = Object.keys(v.eni).map(Number).sort((a, b) => a - b), cols = [];
    en.forEach(u => { const w = (Math.round((v.eni[u] / 8 + 0.125) * 100) / 100).toFixed(2).replace(/0$/, '').replace(/\.$/, '.0'); const o = cols[cols.length - 1];
      if (o && o.max === u - 1 && o.w === w) o.max = u; else cols.push({ min: u, max: u, w }); });
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet ' + NSW + '><sheetPr><outlinePr summaryBelow="0" summaryRight="0"/></sheetPr><sheetViews><sheetView workbookViewId="0">' + pane + '</sheetView></sheetViews>'
      + '<sheetFormatPr customHeight="1" defaultColWidth="12.63" defaultRowHeight="15.75"/>' + (cols.length ? '<cols>' + cols.map(c => '<col customWidth="1" min="' + c.min + '" max="' + c.max + '" width="' + c.w + '"/>').join('') + '</cols>' : '')
      + '<sheetData>' + rows + '</sheetData><drawing r:id="rId1"/></worksheet>';
  };
  const n = V.length, R = (id, t, tg) => '<Relationship Id="' + id + '" Type="' + t + '" Target="' + tg + '"/>';
  const T = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/';
  const fayllar = [];
  V.forEach((v, i) => fayllar.push({ nom: 'xl/drawings/drawing' + (i + 1) + '.xml', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:cx="http://schemas.microsoft.com/office/drawing/2014/chartex" xmlns:cx1="http://schemas.microsoft.com/office/drawing/2015/9/8/chartex" xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006" xmlns:dgm="http://schemas.openxmlformats.org/drawingml/2006/diagram" xmlns:x3Unk="http://schemas.microsoft.com/office/drawing/2010/slicer" xmlns:sle15="http://schemas.microsoft.com/office/drawing/2012/slicer"/>' }));
  V.forEach((v, i) => { fayllar.push({ nom: 'xl/worksheets/sheet' + (i + 1) + '.xml', data: sheetXml(v, i) });
    fayllar.push({ nom: 'xl/worksheets/_rels/sheet' + (i + 1) + '.xml.rels', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' + R('rId1', T + 'drawing', '../drawings/drawing' + (i + 1) + '.xml') + '</Relationships>' }); });
  fayllar.push({ nom: 'xl/theme/theme1.xml', data: fs.readFileSync(THEME) });
  fayllar.push({ nom: 'xl/sharedStrings.xml', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="' + sstSon + '" uniqueCount="' + sst.length + '">' + sst.map(t => '<si><t>' + esc(t) + '</t></si>').join('') + '</sst>' });
  fayllar.push({ nom: 'xl/styles.xml', data: styles });
  fayllar.push({ nom: 'xl/persons/person.xml', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><x18tc:personList xmlns:x18tc="http://schemas.microsoft.com/office/spreadsheetml/2018/threadedcomments"/>' });
  fayllar.push({ nom: 'xl/workbook.xml', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook ' + NSW.replace('xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"', 'xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"') + '><workbookPr/><sheets>'
    + V.map((v, i) => '<sheet state="visible" name="' + esc(v.nom) + '" sheetId="' + (i + 1) + '" r:id="rId' + (5 + i) + '"/>').join('') + '</sheets><definedNames/><calcPr/></workbook>' });
  fayllar.push({ nom: 'xl/_rels/workbook.xml.rels', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' + R('rId1', T + 'theme', 'theme/theme1.xml') + R('rId2', T + 'styles', 'styles.xml')
    + R('rId3', T + 'sharedStrings', 'sharedStrings.xml') + R('rId4', 'http://schemas.microsoft.com/office/2017/10/relationships/person', 'persons/person.xml') + V.map((v, i) => R('rId' + (5 + i), T + 'worksheet', 'worksheets/sheet' + (i + 1) + '.xml')).join('') + '</Relationships>' });
  fayllar.push({ nom: '_rels/.rels', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' + R('rId1', T + 'officeDocument', 'xl/workbook.xml') + '</Relationships>' });
  const CT = 'application/vnd.openxmlformats-officedocument.';
  fayllar.push({ nom: '[Content_Types].xml', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default ContentType="application/xml" Extension="xml"/><Default ContentType="' + CT + 'obfuscatedFont" Extension="odttf"/><Default ContentType="application/vnd.openxmlformats-package.relationships+xml" Extension="rels"/>'
    + V.map((v, i) => '<Override ContentType="' + CT + 'spreadsheetml.worksheet+xml" PartName="/xl/worksheets/sheet' + (i + 1) + '.xml"/>').join('')
    + '<Override ContentType="' + CT + 'spreadsheetml.sharedStrings+xml" PartName="/xl/sharedStrings.xml"/>'
    + V.map((v, i) => '<Override ContentType="' + CT + 'drawing+xml" PartName="/xl/drawings/drawing' + (i + 1) + '.xml"/>').join('')
    + '<Override ContentType="application/vnd.ms-excel.person+xml" PartName="/xl/persons/person.xml"/><Override ContentType="' + CT + 'spreadsheetml.styles+xml" PartName="/xl/styles.xml"/><Override ContentType="' + CT + 'theme+xml" PartName="/xl/theme/theme1.xml"/><Override ContentType="' + CT + 'spreadsheetml.sheet.main+xml" PartName="/xl/workbook.xml"/></Types>' });
  // Google eksportida XML e'lonidan keyin yangi qator
  fayllar.forEach(f => { if (typeof f.data === 'string') f.data = f.data.replace(/^(<\?xml[^>]*\?>)/, '$1\r'); });
  return zipYasa(fayllar);
}

module.exports = { kitob, yasa, javaSon };
