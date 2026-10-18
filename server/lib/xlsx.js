// AKS TIZIM — Excel (.xlsx) fayl yasash va o'qish (tashqi kutubxonasiz: zip + XML).
// Eski tizim Excel'ni vaqtinchalik Google jadval yasab, uni .xlsx qilib yuklab olardi (SpreadsheetApp.create → export?format=xlsx).
// Bu yerda o'sha natija to'g'ridan-to'g'ri yasaladi. Eski usuldagi kabi: matn qiymatlari Google jadval «yozilganda» qanday tushunilsa
// (raqam, sana, matn — sheetsQiymat), shunday yoziladi.
'use strict';
const zlib = require('zlib');

// ------------------------------------------------------------------ zip
const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc32(b) { let c = 0xFFFFFFFF; for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
function zipYasa(fayllar) {   // [{ nom, data: Buffer|string }]
  const qism = [], markaz = []; let o = 0;
  const vaqt = 0, sana = (2026 - 1980) << 9 | 1 << 5 | 1;   // o'zgarmas sana — bir xil kirishga bir xil fayl
  for (const f of fayllar) {
    const nom = Buffer.from(f.nom, 'utf8'), d = Buffer.isBuffer(f.data) ? f.data : Buffer.from(f.data, 'utf8');
    const z = zlib.deflateRawSync(d), crc = crc32(d);
    const h = Buffer.alloc(30); h.writeUInt32LE(0x04034b50, 0); h.writeUInt16LE(20, 4); h.writeUInt16LE(0x0800, 6); h.writeUInt16LE(8, 8);
    h.writeUInt16LE(vaqt, 10); h.writeUInt16LE(sana, 12); h.writeUInt32LE(crc, 14); h.writeUInt32LE(z.length, 18); h.writeUInt32LE(d.length, 22);
    h.writeUInt16LE(nom.length, 26); h.writeUInt16LE(0, 28);
    qism.push(h, nom, z);
    const c = Buffer.alloc(46); c.writeUInt32LE(0x02014b50, 0); c.writeUInt16LE(20, 4); c.writeUInt16LE(20, 6); c.writeUInt16LE(0x0800, 8); c.writeUInt16LE(8, 10);
    c.writeUInt16LE(vaqt, 12); c.writeUInt16LE(sana, 14); c.writeUInt32LE(crc, 16); c.writeUInt32LE(z.length, 20); c.writeUInt32LE(d.length, 24);
    c.writeUInt16LE(nom.length, 28); c.writeUInt32LE(o, 42);
    markaz.push(c, nom);
    o += 30 + nom.length + z.length;
  }
  const m = Buffer.concat(markaz), e = Buffer.alloc(22);
  e.writeUInt32LE(0x06054b50, 0); e.writeUInt16LE(fayllar.length, 8); e.writeUInt16LE(fayllar.length, 10); e.writeUInt32LE(m.length, 12); e.writeUInt32LE(o, 16);
  return Buffer.concat([...qism, m, e]);
}
function zipOqi(buf) {   // → { nom: Buffer }
  let e = buf.length - 22; while (e >= 0 && buf.readUInt32LE(e) !== 0x06054b50) e--;
  if (e < 0) throw new Error('zip emas');
  const soni = buf.readUInt16LE(e + 10); let p = buf.readUInt32LE(e + 16); const R = {};
  for (let i = 0; i < soni; i++) {
    const usul = buf.readUInt16LE(p + 10), zl = buf.readUInt32LE(p + 20), nl = buf.readUInt16LE(p + 28), xl = buf.readUInt16LE(p + 30), kl = buf.readUInt16LE(p + 32), lo = buf.readUInt32LE(p + 42);
    const nom = buf.slice(p + 46, p + 46 + nl).toString('utf8');
    const lnl = buf.readUInt16LE(lo + 26), lxl = buf.readUInt16LE(lo + 28), d = buf.slice(lo + 30 + lnl + lxl, lo + 30 + lnl + lxl + zl);
    R[nom] = usul === 8 ? zlib.inflateRawSync(d) : d;
    p += 46 + nl + xl + kl;
  }
  return R;
}

// ------------------------------------------------------------------ Google jadval matnni qanday tushunadi (setValues, «Россия» hududi)
// '' → bo'sh; «123» → 123; «22.09.2026» → sana (seriya raqami, dd.mm.yyyy); qolgani — matn.
function seriya(y, m, d) { return Math.round((Date.UTC(y, m - 1, d) - Date.UTC(1899, 11, 30)) / 86400000); }
function sheetsQiymat(v) {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number') return isFinite(v) ? { t: 'n', v } : null;
  if (typeof v === 'boolean') return { t: 'b', v };
  const s = String(v), t = s.trim();
  if (/^[+-]?\d+$/.test(t) && t.replace(/^[+-]/, '').length <= 15) return { t: 'n', v: Number(t) };
  const m = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(t);
  if (m) { const d = +m[1], mo = +m[2], y = +m[3]; const dt = new Date(Date.UTC(y, mo - 1, d)); if (mo >= 1 && mo <= 12 && dt.getUTCDate() === d) return { t: 'n', v: seriya(y, mo, d), sana: true }; }
  return { t: 's', v: s };
}

// ------------------------------------------------------------------ yasash
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
const harf = n => { let r = ''; n++; while (n > 0) { const m = (n - 1) % 26; r = String.fromCharCode(65 + m) + r; n = Math.floor((n - 1) / 26); } return r; };
const ICHKI = { 'General': 0, '0': 1, '0.00': 2, '#,##0': 3, '#,##0.00': 4, '@': 49 };

// varaq: { nom, qatorlar: [[qiymat…]…], sarlavha: true (1-qator: qalin, oq harf, #0B3D2E fon), muzlat: 1,
//          ustunFormat: { 0: '@' } (butun ustun), oraliqFormat: [{ q1, q2, u1, u2, f: '#,##0' }] (0 dan, 1-qator = 0), sanaFormat: 'dd.mm.yyyy' }
function yasa(v) {
  const sanaF = v.sanaFormat || 'dd.mm.yyyy';
  const xf = [{ f: 0, s: 0 }], xfK = { '0|0': 0 };
  const FMT = { [sanaF]: 164 }; let fId = 165;
  const fmtId = f => f == null ? 0 : (ICHKI[f] !== undefined ? ICHKI[f] : (FMT[f] !== undefined ? FMT[f] : (FMT[f] = fId++)));
  const uslub = (f, sarl) => { const k = fmtId(f) + '|' + (sarl ? 1 : 0); if (xfK[k] === undefined) { xfK[k] = xf.length; xf.push({ f: fmtId(f), s: sarl ? 1 : 0 }); } return xfK[k]; };
  const ss = [], ssK = new Map(); const sId = s => { if (!ssK.has(s)) { ssK.set(s, ss.length); ss.push(s); } return ssK.get(s); };
  const fmtQ = (q, u) => { let f = v.ustunFormat && v.ustunFormat[u] !== undefined ? v.ustunFormat[u] : null;
    (v.oraliqFormat || []).forEach(o => { if (q >= o.q1 && q <= o.q2 && u >= o.u1 && u <= o.u2) f = o.f; }); return f; };
  let qx = '';
  v.qatorlar.forEach((row, q) => {
    let cx = '';
    row.forEach((val, u) => {
      const sarl = v.sarlavha && q === 0;
      let p = sheetsQiymat(val), f = fmtQ(q, u);
      if (p && p.sana && f == null) f = sanaF;
      const s = (f != null || sarl) ? uslub(f, sarl) : 0;
      const r = harf(u) + (q + 1);
      if (!p) { if (s) cx += '<c r="' + r + '" s="' + s + '"/>'; return; }
      const sa = s ? ' s="' + s + '"' : '';
      if (p.t === 's') cx += '<c r="' + r + '"' + sa + ' t="s"><v>' + sId(p.v) + '</v></c>';
      else if (p.t === 'b') cx += '<c r="' + r + '"' + sa + ' t="b"><v>' + (p.v ? 1 : 0) + '</v></c>';
      else cx += '<c r="' + r + '"' + sa + '><v>' + p.v + '</v></c>';
    });
    qx += '<row r="' + (q + 1) + '">' + cx + '</row>';
  });
  const ustunSoni = Math.max(1, ...v.qatorlar.map(r => r.length));
  const oxir = harf(ustunSoni - 1) + Math.max(1, v.qatorlar.length);
  const muz = v.muzlat ? '<sheetViews><sheetView workbookViewId="0"><pane ySplit="' + v.muzlat + '" topLeftCell="A' + (v.muzlat + 1) + '" activePane="bottomLeft" state="frozen"/><selection pane="bottomLeft"/></sheetView></sheetViews>'
    : '<sheetViews><sheetView workbookViewId="0"/></sheetViews>';
  const sheet = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
    + '<dimension ref="A1:' + oxir + '"/>' + muz + '<sheetFormatPr defaultRowHeight="15.75" customHeight="1"/><sheetData>' + qx + '</sheetData></worksheet>';
  const numFmts = Object.keys(FMT).map(k => '<numFmt numFmtId="' + FMT[k] + '" formatCode="' + esc(k) + '"/>').join('');
  const styles = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
    + (numFmts ? '<numFmts count="' + Object.keys(FMT).length + '">' + numFmts + '</numFmts>' : '')
    + '<fonts count="2"><font><sz val="10"/><color rgb="FF000000"/><name val="Arial"/></font><font><b/><sz val="10"/><color rgb="FFFFFFFF"/><name val="Arial"/></font></fonts>'
    + '<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF0B3D2E"/><bgColor rgb="FF0B3D2E"/></patternFill></fill></fills>'
    + '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>'
    + '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>'
    + '<cellXfs count="' + xf.length + '">' + xf.map(x => '<xf numFmtId="' + x.f + '" fontId="' + x.s + '" fillId="' + (x.s ? 2 : 0) + '" borderId="0" xfId="0"'
      + (x.f ? ' applyNumberFormat="1"' : '') + (x.s ? ' applyFont="1" applyFill="1"' : '') + '/>').join('') + '</cellXfs>'
    + '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>';
  const sst = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="' + ss.length + '" uniqueCount="' + ss.length + '">'
    + ss.map(s => '<si><t xml:space="preserve">' + esc(s) + '</t></si>').join('') + '</sst>';
  return zipYasa([
    { nom: '[Content_Types].xml', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/><Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/></Types>' },
    { nom: '_rels/.rels', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>' },
    { nom: 'xl/workbook.xml', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="' + esc(v.nom || 'Sheet1') + '" sheetId="1" r:id="rId1"/></sheets></workbook>' },
    { nom: 'xl/_rels/workbook.xml.rels', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/></Relationships>' },
    { nom: 'xl/styles.xml', data: styles },
    { nom: 'xl/sharedStrings.xml', data: sst },
    { nom: 'xl/worksheets/sheet1.xml', data: sheet },
  ]);
}

// ------------------------------------------------------------------ o'qish (sinov uchun: eski tizim fayli bilan solishtirish)
const BUILTIN = { 0: 'General', 1: '0', 2: '0.00', 3: '#,##0', 4: '#,##0.00', 9: '0%', 10: '0.00%', 14: 'm/d/yyyy', 22: 'm/d/yyyy h:mm', 49: '@' };
const unesc = s => String(s).replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#(\d+);/g, (m, n) => String.fromCodePoint(+n)).replace(/&#x([0-9a-f]+);/gi, (m, n) => String.fromCodePoint(parseInt(n, 16))).replace(/&amp;/g, '&');
const attr = (s, a) => { const m = new RegExp('\\b' + a + '="([^"]*)"').exec(s); return m ? m[1] : null; };
function matnlar(x) { return (x.match(/<si>[\s\S]*?<\/si>/g) || []).map(si => (si.match(/<t[^>]*>([\s\S]*?)<\/t>/g) || []).map(t => unesc(t.replace(/^<t[^>]*>|<\/t>$/g, ''))).join('')); }
function oqi(buf) {
  const Z = zipOqi(buf), s = k => Z[k] ? Z[k].toString('utf8') : '';
  const wb = s('xl/workbook.xml'), rels = s('xl/_rels/workbook.xml.rels');
  const sh1 = /<sheet\b[^>]*>/.exec(wb)[0], rid = attr(sh1, 'r:id');
  const relM = new RegExp('<Relationship\\b[^>]*Id="' + rid + '"[^>]*>').exec(rels) || new RegExp('<Relationship\\b[^>]*Target="[^"]*"[^>]*Id="' + rid + '"[^>]*>').exec(rels);
  let tgt = attr(relM[0], 'Target'); tgt = tgt.replace(/^\/?xl\//, '').replace(/^\//, ''); const sheetX = s('xl/' + tgt);
  const SS = matnlar(s('xl/sharedStrings.xml'));
  const st = s('xl/styles.xml'), FM = Object.assign({}, BUILTIN);
  (st.match(/<numFmt\b[^>]*\/?>/g) || []).forEach(n => { FM[attr(n, 'numFmtId')] = unesc(attr(n, 'formatCode')); });
  const shrift = ((/<fonts\b[^>]*>([\s\S]*?)<\/fonts>/.exec(st) || [])[1] || '').match(/<font\b[\s\S]*?<\/font>|<font\/>/g) || [];
  const fon = ((/<fills\b[^>]*>([\s\S]*?)<\/fills>/.exec(st) || [])[1] || '').match(/<fill\b[\s\S]*?<\/fill>|<fill\/>/g) || [];
  const xfs = (((/<cellXfs\b[^>]*>([\s\S]*?)<\/cellXfs>/.exec(st) || [])[1] || '').match(/<xf\b[^>]*?(\/>|>[\s\S]*?<\/xf>)/g) || []).map(x => {
    const f = shrift[+attr(x, 'fontId') || 0] || '', fl = fon[+attr(x, 'fillId') || 0] || '';
    const rang = (/<color\b[^>]*rgb="([^"]+)"/.exec(f) || [])[1] || '';
    const fonR = /patternType="solid"/.test(fl) ? ((/<fgColor\b[^>]*rgb="([^"]+)"/.exec(fl) || [])[1] || '') : '';
    return { fmt: FM[attr(x, 'numFmtId') || '0'] || ('#' + attr(x, 'numFmtId')), qalin: /<b\/>|<b val="(1|true)"\/>/.test(f), rang: rang.slice(-6).toUpperCase(), fon: fonR.slice(-6).toUpperCase() };
  });
  const K = {};
  (sheetX.match(/<c\b[^>]*?(\/>|>[\s\S]*?<\/c>)/g) || []).forEach(c => {
    const bosh = /^<c\b[^>]*?(\/?)>/.exec(c)[0];
    const r = attr(bosh, 'r'), t = attr(bosh, 't') || 'n', si = +(attr(bosh, 's') || 0);
    const vm = /<v>([\s\S]*?)<\/v>/.exec(c), im = /<is>([\s\S]*?)<\/is>/.exec(c);
    let val = null, tur = 'bo\'sh';
    if (t === 's' && vm) { val = SS[+vm[1]]; tur = 'matn'; }
    else if (t === 'inlineStr' && im) { val = matnlar('<si>' + im[1] + '</si>')[0]; tur = 'matn'; }
    else if (t === 'str' && vm) { val = unesc(vm[1]); tur = 'matn'; }
    else if (t === 'b' && vm) { val = vm[1] === '1'; tur = 'mantiq'; }
    else if (vm) { val = Number(vm[1]); tur = 'son'; }
    K[r] = Object.assign({ tur, val }, xfs[si] || { fmt: 'General', qalin: false, rang: '', fon: '' });
  });
  const pane = /<pane\b[^>]*>/.exec(sheetX);
  return { nom: unesc(attr(sh1, 'name')), kataklar: K, muzlat: pane && /frozen/.test(pane[0]) ? +(attr(pane[0], 'ySplit') || 0) : 0 };
}

module.exports = { yasa, oqi, sheetsQiymat, zipYasa, zipOqi };
