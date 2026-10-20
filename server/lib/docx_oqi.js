// AKS TIZIM — Google Doc shablonini (Drive «export?mimeType=docx» — Google'ning o'z eksporti) o'qib, hujjat MODELIGA aylantirish.
// Eski tizim shablonni DocumentApp bilan ochib (<<BELGI>> larni almashtirib) PDF qilardi; serverda DocumentApp yo'q — shuning uchun
// shablon DOCX ko'rinishida olinadi va shu yerda xatboshi / yozuv bo'laklari (run) / jadval / kolontitul / sahifa o'lchamlari ajratib olinadi.
// Model (pt birligida; sozlanmagan xususiyat — null = Docs standarti: Arial 11, qator oralig'i 1,15, chapga tekislash):
//   { w, h, tepa, past, chap, ong, pastKol (footer masofasi), el:[...], footer:[...] | null, header:[...] | null }
//   xatboshi: { t:'p', runs:[{ x, b, i, u, c, sz, font }], al, before, after, ls, indStart, indFirst, indEnd, font, sz, b,
//              num:{ matn, font, sz, left, hanging } | null, betOldin, keepNext, keepLines, widow }
//   jadval:   { t:'tbl', cols:[pt], eni, rows:[{ h, hRule, cells:[{ pad:{t,b,l,r}, bg, bord:{top,left,bottom,right}, span, el:[xatboshilar] }] }] }
// Tashqi kutubxonasiz: zip (inflateRaw) va kichik XML o'qigich shu faylda.
'use strict';
const zlib = require('zlib');

// ------------------------------------------------------------------ ZIP
function zipOqi(buf) {
  const n = buf.length; let e = -1;
  for (let i = n - 22; i >= Math.max(0, n - 65557); i--) if (buf.readUInt32LE(i) === 0x06054b50) { e = i; break; }
  if (e < 0) throw new Error('DOCX: zip oxiri topilmadi');
  const soni = buf.readUInt16LE(e + 10), cdOff = buf.readUInt32LE(e + 16);
  const F = {}; let p = cdOff;
  for (let k = 0; k < soni; k++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) throw new Error('DOCX: zip katalogi buzilgan');
    const usul = buf.readUInt16LE(p + 10), siq = buf.readUInt32LE(p + 20), asl = buf.readUInt32LE(p + 24);
    const nL = buf.readUInt16LE(p + 28), xL = buf.readUInt16LE(p + 30), cL = buf.readUInt16LE(p + 32), lOff = buf.readUInt32LE(p + 42);
    const nom = buf.toString('utf8', p + 46, p + 46 + nL);
    F[nom] = { usul, siq, asl, lOff }; p += 46 + nL + xL + cL;
  }
  return {
    bor: nom => !!F[nom],
    ol(nom) {
      const f = F[nom]; if (!f) return null;
      const h = f.lOff; if (buf.readUInt32LE(h) !== 0x04034b50) throw new Error('DOCX: zip yozuvi buzilgan: ' + nom);
      const nL = buf.readUInt16LE(h + 26), xL = buf.readUInt16LE(h + 28), s = h + 30 + nL + xL;
      const d = buf.subarray(s, s + f.siq);
      return f.usul === 0 ? Buffer.from(d) : zlib.inflateRawSync(d);
    },
    nomlar: () => Object.keys(F),
  };
}

// ------------------------------------------------------------------ XML (WordprocessingML uchun yetarli: element, atribut, matn; CDATA/PI/izoh o'tkazib yuboriladi)
const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: '\'' };
const entDek = s => s.indexOf('&') < 0 ? s : s.replace(/&(#x[0-9a-fA-F]+|#\d+|[a-zA-Z]+);/g, (m, k) =>
  k[0] === '#' ? String.fromCodePoint(k[1] === 'x' || k[1] === 'X' ? parseInt(k.slice(2), 16) : parseInt(k.slice(1), 10)) : (ENT[k] != null ? ENT[k] : m));
function xmlOqi(s) {
  const root = { n: '#', a: {}, c: [] }; const st = [root]; let i = 0; const L = s.length;
  while (i < L) {
    const lt = s.indexOf('<', i);
    if (lt < 0) break;
    if (lt > i) { const t = s.slice(i, lt); if (t.trim() || st.length > 1) st[st.length - 1].c.push({ n: '#t', t: entDek(t) }); }
    if (s.startsWith('<?', lt)) { i = s.indexOf('?>', lt) + 2; continue; }
    if (s.startsWith('<!--', lt)) { i = s.indexOf('-->', lt) + 3; continue; }
    if (s.startsWith('<![CDATA[', lt)) { const e = s.indexOf(']]>', lt); st[st.length - 1].c.push({ n: '#t', t: s.slice(lt + 9, e) }); i = e + 3; continue; }
    if (s.startsWith('<!', lt)) { i = s.indexOf('>', lt) + 1; continue; }
    const gt = s.indexOf('>', lt); let ich = s.slice(lt + 1, gt);
    if (ich[0] === '/') { st.pop(); i = gt + 1; continue; }
    const yopiq = ich.endsWith('/'); if (yopiq) ich = ich.slice(0, -1);
    const sp = ich.search(/\s/); const nom = sp < 0 ? ich : ich.slice(0, sp);
    const el = { n: nom, a: {}, c: [] };
    if (sp >= 0) { const re = /([^\s=]+)\s*=\s*("([^"]*)"|'([^']*)')/g; let m; const at = ich.slice(sp); while ((m = re.exec(at))) el.a[m[1]] = entDek(m[3] != null ? m[3] : m[4]); }
    st[st.length - 1].c.push(el); if (!yopiq) st.push(el); i = gt + 1;
  }
  return root;
}
const bola = (el, nom) => el ? el.c.find(x => x.n === nom) : undefined;
const bolalar = (el, nom) => el ? el.c.filter(x => x.n === nom) : [];
const at = (el, nom) => el && el.a[nom] != null ? el.a[nom] : null;
const son = v => v == null || v === '' ? null : Number(v);
const pt = v => (v == null ? null : Number(v) / 20);              // twip → pt
const onoff = el => el ? (at(el, 'w:val') == null || !/^(0|false|off)$/i.test(at(el, 'w:val'))) : null;

// ------------------------------------------------------------------ uslublar (styles.xml): docDefaults + styleId → pPr/rPr (basedOn zanjiri bilan)
function uslublar(x) {
  const r = { pDef: null, rDef: null, S: {} };
  if (!x) return r;
  const st = bola(x, 'w:styles'); if (!st) return r;
  const dd = bola(st, 'w:docDefaults');
  r.pDef = bola(bola(dd, 'w:pPrDefault'), 'w:pPr') || null; r.rDef = bola(bola(dd, 'w:rPrDefault'), 'w:rPr') || null;
  bolalar(st, 'w:style').forEach(s => { r.S[at(s, 'w:styleId')] = { tur: at(s, 'w:type'), asos: at(bola(s, 'w:basedOn'), 'w:val'), pPr: bola(s, 'w:pPr'), rPr: bola(s, 'w:rPr'), tblPr: bola(s, 'w:tblPr'), def: at(s, 'w:default') === '1' }; });
  return r;
}
function zanjir(U, id) { const L = []; let k = 0; while (id && U.S[id] && k++ < 20) { L.unshift(U.S[id]); id = U.S[id].asos; } return L; }

// rPr → { font, sz, b, i, u, c }  (faqat berilganlari)
function rPrOqi(rp) {
  const o = {}; if (!rp) return o;
  const f = bola(rp, 'w:rFonts'); if (f && (at(f, 'w:ascii') || at(f, 'w:hAnsi'))) o.font = at(f, 'w:ascii') || at(f, 'w:hAnsi');
  const sz = bola(rp, 'w:sz'); if (sz) o.sz = son(at(sz, 'w:val')) / 2;
  const b = bola(rp, 'w:b'); if (b) o.b = onoff(b);
  const i = bola(rp, 'w:i'); if (i) o.i = onoff(i);
  const u = bola(rp, 'w:u'); if (u) o.u = at(u, 'w:val') != null && at(u, 'w:val') !== 'none';
  const c = bola(rp, 'w:color'); if (c && at(c, 'w:val') && at(c, 'w:val') !== 'auto') o.c = '#' + at(c, 'w:val');
  const va = bola(rp, 'w:vertAlign'); if (va) o.va = at(va, 'w:val');
  return o;
}
// pPr → xatboshi sozlamalari (faqat berilganlari)
function pPrOqi(pp) {
  const o = {}; if (!pp) return o;
  const jc = bola(pp, 'w:jc'); if (jc) o.al = ({ left: 'left', start: 'left', center: 'center', right: 'right', end: 'right', both: 'both', distribute: 'both' })[at(jc, 'w:val')] || 'left';
  const sp = bola(pp, 'w:spacing');
  if (sp) {
    if (at(sp, 'w:before') != null) o.before = pt(at(sp, 'w:before'));
    if (at(sp, 'w:after') != null) o.after = pt(at(sp, 'w:after'));
    if (at(sp, 'w:line') != null) { const rule = at(sp, 'w:lineRule') || 'auto'; o.ls = rule === 'auto' ? Number(at(sp, 'w:line')) / 240 : null; if (rule !== 'auto') o.lsPt = pt(at(sp, 'w:line')); }
  }
  const ind = bola(pp, 'w:ind');
  if (ind) {
    if (at(ind, 'w:left') != null || at(ind, 'w:start') != null) o.indStart = pt(at(ind, 'w:left') != null ? at(ind, 'w:left') : at(ind, 'w:start'));
    if (at(ind, 'w:right') != null || at(ind, 'w:end') != null) o.indEnd = pt(at(ind, 'w:right') != null ? at(ind, 'w:right') : at(ind, 'w:end'));
    if (at(ind, 'w:hanging') != null) o.indFirst = -pt(at(ind, 'w:hanging'));
    else if (at(ind, 'w:firstLine') != null) o.indFirst = pt(at(ind, 'w:firstLine'));
  }
  const ps = bola(pp, 'w:pStyle'); if (ps) o.uslub = at(ps, 'w:val');
  const np = bola(pp, 'w:numPr'); if (np) o.numPr = { id: at(bola(np, 'w:numId'), 'w:val'), lvl: son(at(bola(np, 'w:ilvl'), 'w:val')) || 0 };
  if (bola(pp, 'w:pageBreakBefore') && onoff(bola(pp, 'w:pageBreakBefore'))) o.betOldin = true;
  if (bola(pp, 'w:keepNext') && onoff(bola(pp, 'w:keepNext'))) o.keepNext = true;
  if (bola(pp, 'w:keepLines') && onoff(bola(pp, 'w:keepLines'))) o.keepLines = true;
  const wc = bola(pp, 'w:widowControl'); if (wc) o.widow = onoff(wc);
  const mrp = bola(pp, 'w:rPr'); if (mrp) o.belgi = rPrOqi(mrp);     // xatboshi belgisi (bo'sh xatboshi balandligi uchun)
  return o;
}

// ------------------------------------------------------------------ raqamlash (numbering.xml): numId → lvl → { matn, fmt, font, sz, left, hanging }
function raqamlash(x) {
  const N = {}; if (!x) return N;
  const root = bola(x, 'w:numbering'); if (!root) return N;
  const A = {};
  bolalar(root, 'w:abstractNum').forEach(a => { const L = {}; bolalar(a, 'w:lvl').forEach(l => { const p = pPrOqi(bola(l, 'w:pPr')), r = rPrOqi(bola(l, 'w:rPr'));
    L[son(at(l, 'w:ilvl'))] = { matn: at(bola(l, 'w:lvlText'), 'w:val') || '', fmt: at(bola(l, 'w:numFmt'), 'w:val') || 'bullet', boshi: son(at(bola(l, 'w:start'), 'w:val')) || 1, left: p.indStart, hanging: p.indFirst, font: r.font || null, sz: r.sz || null }; }); A[at(a, 'w:abstractNumId')] = L; });
  bolalar(root, 'w:num').forEach(n => { N[at(n, 'w:numId')] = A[at(bola(n, 'w:abstractNumId'), 'w:val')] || {}; });
  return N;
}

// ------------------------------------------------------------------ hujjat qismi → model elementlari
function qism(root, U, N, rels, zip) {
  const sayt = { N, U };
  const RUN_NOM = { 'w:r': 1, 'w:hyperlink': 1, 'w:ins': 1, 'w:smartTag': 1, 'w:sdt': 1, 'w:sdtContent': 1 };
  // xatboshi uslubi: docDefaults → uslub zanjiri → o'zi
  function pSoz(pp) {
    const own = pPrOqi(pp); let o = Object.assign({}, pPrOqi(U.pDef));
    const z = zanjir(U, own.uslub || (Object.keys(U.S).find(k => U.S[k].tur === 'paragraph' && U.S[k].def)));
    z.forEach(s => Object.assign(o, pPrOqi(s.pPr)));
    Object.assign(o, own);
    // uslub zanjiridagi matn sozlamalari (belgi uchun)
    let r = Object.assign({}, rPrOqi(U.rDef)); z.forEach(s => Object.assign(r, rPrOqi(s.rPr))); if (own.belgi) Object.assign(r, own.belgi);
    o.belgi = r; return o;
  }
  function runlar(p, belgiAsos) {
    const R = [];
    const yur = el => el.c.forEach(ch => {
      if (ch.n === 'w:r') {
        const rp = Object.assign({}, belgiAsos, rPrOqi(bola(ch, 'w:rPr'))); let x = '';
        ch.c.forEach(k => {
          if (k.n === 'w:t') x += k.c.map(z => z.t || '').join('');
          else if (k.n === 'w:tab') x += '\t';
          else if (k.n === 'w:br') { if (at(k, 'w:type') === 'page') R.betUz = true; else x += '\n'; }
          else if (k.n === 'w:noBreakHyphen') x += '‑';
          else if (k.n === 'w:softHyphen') x += '­';
          else if (k.n === 'w:sym') x += at(k, 'w:char') ? String.fromCharCode(parseInt(at(k, 'w:char'), 16)) : '';
          else if (k.n === 'w:drawing' || k.n === 'w:pict') R.rasm = true;
        });
        R.push({ x, b: !!rp.b, i: !!rp.i, u: !!rp.u, c: rp.c || null, sz: rp.sz || null, font: rp.font || null, va: rp.va || null });
      } else if (RUN_NOM[ch.n]) yur(ch);
    });
    yur(p); return R;
  }
  function xatboshi(p) {
    const s = pSoz(bola(p, 'w:pPr'));
    const asos = { font: s.belgi.font || null, sz: s.belgi.sz || null, b: !!s.belgi.b, i: !!s.belgi.i, u: !!s.belgi.u, c: s.belgi.c || null };
    const R = runlar(p, { font: asos.font, sz: asos.sz, b: asos.b, i: asos.i, u: asos.u, c: asos.c });
    let num = null;
    if (s.numPr && N[s.numPr.id] && N[s.numPr.id][s.numPr.lvl]) {
      const l = N[s.numPr.id][s.numPr.lvl];
      num = { matn: l.matn, fmt: l.fmt, font: l.font, sz: l.sz, left: l.left, hanging: l.hanging };
      if (s.indStart == null && l.left != null) s.indStart = l.left;
      if (s.indFirst == null && l.hanging != null) s.indFirst = l.hanging;
    }
    return { t: 'p', runs: R, x: R.map(r => r.x).join(''), al: s.al || null, before: s.before == null ? null : s.before, after: s.after == null ? null : s.after,
      ls: s.ls == null ? null : s.ls, lsPt: s.lsPt || null, indStart: s.indStart == null ? null : s.indStart, indFirst: s.indFirst == null ? null : s.indFirst, indEnd: s.indEnd == null ? null : s.indEnd,
      font: asos.font, sz: asos.sz, b: asos.b, i: asos.i, u: asos.u, c: asos.c, num, betOldin: !!s.betOldin || !!R.betUz, keepNext: !!s.keepNext, keepLines: !!s.keepLines, widow: s.widow == null ? null : s.widow };
  }
  function chegara(el) {   // w:top / w:left ... → { val, sz(pt), c }
    if (!el) return null; const v = at(el, 'w:val'); if (!v || v === 'nil' || v === 'none') return { yoq: true };
    return { yoq: false, sz: (son(at(el, 'w:sz')) || 4) / 8, c: at(el, 'w:color') && at(el, 'w:color') !== 'auto' ? '#' + at(el, 'w:color') : '#000000' };
  }
  function jadval(t) {
    const tp = bola(t, 'w:tblPr');
    const stNom = at(bola(tp, 'w:tblStyle'), 'w:val');
    // katak chekinishlari: uslub zanjiri (TableNormal 5 pt) → jadvalning o'zi
    let mar = { t: null, b: null, l: null, r: null };
    const marOqi = m => { if (!m) return; ['top', 'bottom', 'left', 'right'].forEach(k => { const e = bola(m, 'w:' + k) || (k === 'left' ? bola(m, 'w:start') : k === 'right' ? bola(m, 'w:end') : null); if (e && at(e, 'w:w') != null) mar[k[0]] = pt(at(e, 'w:w')); }); };
    zanjir(U, stNom).forEach(s => marOqi(bola(s.tblPr, 'w:tblCellMar')));
    marOqi(bola(tp, 'w:tblCellMar'));
    let tb = {};
    const bordOqi = b => { if (!b) return; ['top', 'left', 'bottom', 'right', 'insideH', 'insideV'].forEach(k => { const e = bola(b, 'w:' + k); if (e) tb[k] = chegara(e); }); };
    zanjir(U, stNom).forEach(s => bordOqi(bola(s.tblPr, 'w:tblBorders')));
    bordOqi(bola(tp, 'w:tblBorders'));
    const cols = bolalar(bola(t, 'w:tblGrid'), 'w:gridCol').map(c => pt(at(c, 'w:w')));
    const ind = bola(tp, 'w:tblInd');
    const rows = bolalar(t, 'w:tr').map((tr, ri, TR) => {
      const trp = bola(tr, 'w:trPr'); const th = bola(trp, 'w:trHeight');
      const cells = bolalar(tr, 'w:tc').map((tc, ci, TC) => {
        const cp = bola(tc, 'w:tcPr');
        const pad = Object.assign({}, mar); const cm = bola(cp, 'w:tcMar');
        if (cm) ['top', 'bottom', 'left', 'right'].forEach(k => { const e = bola(cm, 'w:' + k); if (e && at(e, 'w:w') != null) pad[k[0]] = pt(at(e, 'w:w')); });
        const bord = {}; const cb = bola(cp, 'w:tcBorders');
        ['top', 'left', 'bottom', 'right'].forEach(k => {
          let e = cb ? chegara(bola(cb, 'w:' + k)) : null;
          if (!e) e = (k === 'top' && ri > 0) ? tb.insideH : (k === 'bottom' && ri < TR.length - 1) ? tb.insideH : (k === 'left' && ci > 0) ? tb.insideV : (k === 'right' && ci < TC.length - 1) ? tb.insideV : tb[k];
          bord[k] = e && !e.yoq ? { sz: e.sz, c: e.c } : null;
        });
        const shd = bola(cp, 'w:shd'); const bg = shd && at(shd, 'w:fill') && at(shd, 'w:fill') !== 'auto' ? '#' + at(shd, 'w:fill') : null;
        const span = son(at(bola(cp, 'w:gridSpan'), 'w:val')) || 1;
        const el = []; tc.c.forEach(ch => { if (ch.n === 'w:p') el.push(xatboshi(ch)); else if (ch.n === 'w:tbl') el.push(jadval(ch)); });
        return { pad, bg, bord, span, el, vAlign: at(bola(cp, 'w:vAlign'), 'w:val') || 'top' };
      });
      return { h: th ? pt(at(th, 'w:val')) : null, hRule: th ? (at(th, 'w:hRule') || 'atLeast') : null, cantSplit: !!(trp && bola(trp, 'w:cantSplit') && onoff(bola(trp, 'w:cantSplit'))), cells };
    });
    return { t: 'tbl', cols, eni: cols.reduce((a, b) => a + b, 0), chap: ind && at(ind, 'w:w') != null ? pt(at(ind, 'w:w')) : 0, rows };
  }
  const el = []; let sect = null;
  root.c.forEach(ch => { if (ch.n === 'w:p') el.push(xatboshi(ch)); else if (ch.n === 'w:tbl') el.push(jadval(ch)); else if (ch.n === 'w:sectPr') sect = ch; });
  return { el, sect };
}

// ------------------------------------------------------------------ asosiy
function oqi(buf) {
  const zip = zipOqi(buf);
  const xml = nom => { const b = zip.ol(nom); return b ? xmlOqi(b.toString('utf8')) : null; };
  const doc = xml('word/document.xml'); if (!doc) throw new Error('DOCX: word/document.xml yo\'q');
  const U = uslublar(xml('word/styles.xml')), N = raqamlash(xml('word/numbering.xml'));
  const rels = {}; const rx = xml('word/_rels/document.xml.rels');
  if (rx) bolalar(bola(rx, 'Relationships'), 'Relationship').forEach(r => { rels[r.a.Id] = r.a.Target; });
  const body = bola(bola(doc, 'w:document'), 'w:body');
  const { el, sect } = qism(body, U, N, rels, zip);
  const m = { w: 595.28, h: 841.89, tepa: 72, past: 72, chap: 72, ong: 72, tepaKol: 36, pastKol: 36, el, footer: null, header: null };
  if (sect) {
    const sz = bola(sect, 'w:pgSz'); if (sz) { m.w = pt(at(sz, 'w:w')); m.h = pt(at(sz, 'w:h')); }
    const mr = bola(sect, 'w:pgMar'); if (mr) { m.tepa = pt(at(mr, 'w:top')); m.past = pt(at(mr, 'w:bottom')); m.chap = pt(at(mr, 'w:left')); m.ong = pt(at(mr, 'w:right')); if (at(mr, 'w:header') != null) m.tepaKol = pt(at(mr, 'w:header')); if (at(mr, 'w:footer') != null) m.pastKol = pt(at(mr, 'w:footer')); }
    const kol = (nom, tur) => { const r = bolalar(sect, nom).find(z => (at(z, 'w:type') || 'default') === 'default') || bolalar(sect, nom)[0]; if (!r) return null;
      const yol = rels[at(r, 'r:id')]; if (!yol) return null; const x = xml('word/' + yol.replace(/^\/?word\//, '')); if (!x) return null;
      const rt = bola(x, tur); return rt ? qism(rt, U, N, rels, zip).el : null; };
    m.footer = kol('w:footerReference', 'w:ftr'); m.header = kol('w:headerReference', 'w:hdr');
  }
  return m;
}

module.exports = { oqi, zipOqi, xmlOqi };
