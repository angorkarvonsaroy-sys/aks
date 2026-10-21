// AKS TIZIM — Google Doc shabloni modelidan (lib/docx_oqi.js) PDF: eski tizimda DocumentApp bilan to'ldirilib «PDF» qilib olingan hujjat
// (Google'ning o'z Docs chizgichi) bilan bir xil joylashuv — Chromium'da. Qoidalar lib/docs_pdf.js (yurist hujjatlari) va lib/xat_pdf.js
// (xatlar) dagi o'lchangan Docs qoidalari: shrift px o'lchami 1/76 px ga qirqiladi, qator balandligi = o'lcham × 1,15 × oraliq, tayanch
// chiziq Docs'dagidek (ALFA_EXTRA), xatboshilar orasi — «keyin»/«oldin» ning kattasi, ikki tomonga tekislash — butun px larga (TEKISLA),
// chiziqcha/qiyshiq chiziq/№ li so'z bo'linmaydi, jadval chegaralari alohida. Bu yerda qo'shimcha: yozuv bo'laklari (qalin/kursiv/rang),
// birinchi qator chekinishi, ro'yxat belgisi (●), kolontitul (har sahifada; PAGE maydoni — sahifa raqami, betlar() 3-qadam), qator ichidagi
// uzilish, jadval qatorining eng kam balandligi.
'use strict';
const PDF = require('./pdf');
const XP = require('./xat_pdf');
const DP = require('./docs_pdf');

const s = v => String(v == null ? '' : v);
const esc = v => s(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const PX = 0.75, px = v => Math.round(v / PX) * PX;
const pxPast = v => Math.floor(v / PX + 1e-9), qoldiq = v => +(v - pxPast(v) * PX).toFixed(3);
// Sozlanmagan qiymatlar: DOCX qoidasi — oraliq yozilmagan bo'lsa yakka (1,0). Docs'ning 1,15 standarti eksportda docDefaults ga
// (w:spacing w:line=276) yoziladi — Qayta/sotuv shablonlari shunday; ijara shabloni docDefaults siz → sarlavhalar 1,0 (IJ-27/141 bilan o'lchangan).
const DEF = { font: 'Arial', sz: 11, ls: 1.0 };
const T = DP.T;

function shrift(nom) { return DP.SHRIFT[nom] || DP.SHRIFT.Arial; }
// xatboshi shrift o'lchami — matnli bo'laklarning eng kattasi (Docs qatorni bo'laklar bo'yicha o'lchaydi, uslub o'lchami hisobga olinmaydi);
// matnsiz (bo'sh) xatboshida — belgi (uslub) o'lchami
function szOf(p) { let m = 0; (p.runs || []).forEach(r => { if (r.sz && (r.x || r.maydon)) m = Math.max(m, r.sz); }); return m || p.sz || DEF.sz; }
function fontOf(p) { const r = (p.runs || []).find(z => z.x && z.font); return r ? r.font : (p.font || DEF.font); }   // matnli birinchi bo'lak shrifti (bo'sh xatboshida — belgi shrifti)
// qator balandligi va tayanch chiziq tuzatmasi (lib/docs_pdf.js parCss bilan bir xil hisob)
function qatorOlchov(p) {
  const f = shrift(fontOf(p)), sz = szOf(p), ls = p.ls == null ? DEF.ls : p.ls;
  const L = p.lsPt ? p.lsPt : sz * f.F * ls;
  const cssAlfa = (L - (f.asc + f.desc) * sz) / 2 + f.asc * sz;
  const yakka = sz * f.F, docsAlfa = (yakka - (f.asc + f.desc) * sz) / 2 + f.asc * sz + (L - yakka) * T.ALFA_EXTRA;
  return { L, sur: +(docsAlfa - cssAlfa).toFixed(4), sz, f };
}
// so'z: chiziqcha/qiyshiq chiziq/№ li so'z bo'linmaydi; tekislashda bo'sh joylar alohida <span class="sp">
function sozlar(x, tek) {
  const bol = x.split(/( +)/);
  let h = '';
  bol.forEach(w => {
    if (!w) return;
    if (/^ +$/.test(w)) { h += tek ? w.split('').map(() => '<span class="sp"> </span>').join('') : esc(w); return; }
    h += /[-\/№‑]/.test(w) ? '<span class="nw">' + esc(w) + '</span>' : esc(w);
  });
  return h;
}
function runHtml(r, p, tek) {
  const st = [];
  if (r.font && r.font !== fontOf(p)) st.push('font-family:' + shrift(r.font).css);
  if (r.sz && r.sz !== szOf(p)) st.push('font-size:' + r.sz + 'pt');
  if (r.b !== !!p.b) st.push('font-weight:' + (r.b ? 'bold' : 'normal'));
  if (r.i) st.push('font-style:italic');
  if (r.u) st.push('text-decoration:underline');
  if (r.c) st.push('color:' + r.c);
  if (r.va === 'superscript') st.push('vertical-align:super;font-size:0.65em'); else if (r.va === 'subscript') st.push('vertical-align:sub;font-size:0.65em');
  const ich = r.maydon === 'PAGE' ? '<span class="bet"></span>' : r.x.split('\n').map(z => sozlar(z, tek)).join('<br>');   // sahifa raqami — betlar() yozadi
  return st.length ? '<span style="' + st.join(';') + '">' + ich + '</span>' : ich;
}
function parHtml(p, ichida, eni) {
  // xatboshi shrifti o'lchami — matnli bo'laklarning eng kattasi (q.sz): Chromium qator qutisini xatboshi «tayanch» shrifti bilan ham o'lchaydi —
  // u kichik bo'lsa (ijara shabloni: uslub 10,5, sarlavha bo'lagi 14) qator L dan oshib ketadi; Docs qatorni faqat bo'laklar bo'yicha o'lchaydi
  const q = qatorOlchov(p), f = q.f, sz = q.sz, uslubSz = p.sz || DEF.sz;
  const tek = p.al === 'both';
  const st = ['font-family:' + f.css, 'font-size:' + sz + 'pt', 'line-height:' + q.L.toFixed(4) + 'pt',
    'text-align:' + ({ center: 'center', right: 'right' }[p.al] || 'left')];
  if (p.b) st.push('font-weight:bold');
  if (p.i) st.push('font-style:italic');
  if (p.c) st.push('color:' + p.c);
  if (!ichida) { st.push('margin-top:' + (p.before || 0) + 'pt', 'margin-bottom:' + (p.after || 0) + 'pt'); }
  else { if (p.before) st.push('margin-top:' + p.before + 'pt'); if (p.after) st.push('margin-bottom:' + p.after + 'pt'); }
  const chap = px(p.indStart || 0), ong = px(p.indEnd || 0), birinchi = px(p.indFirst || 0);   // Docs chekinishni butun px ga yaxlitlaydi
  if (chap) st.push('padding-left:' + chap + 'pt');
  if (ong) st.push('padding-right:' + ong + 'pt');
  if (birinchi && !(p.num && p.num.matn)) st.push('text-indent:' + birinchi + 'pt');   // ro'yxatda matn chekinish joyidan boshlanadi, belgi — osilgan joyda

  if (Math.abs(q.sur) > 0.0005) st.push('position:relative', 'top:' + q.sur + 'pt');
  if (p.betOldin) st.push('break-before:page');
  if (p.keepNext) st.push('break-after:avoid');
  if (p.keepLines) st.push('break-inside:avoid');
  // Docs'da yetim/beva qator nazorati standart holda YOQIQ (27/368: 3 qatorli xatboshi butunlay keyingi betga o'tgan); widowControl=0 bo'lsa — yo'q (Qayta shablonlari) → class nb
  const bor = (p.runs || []).some(r => r.x || r.maydon);
  let runs = p.runs || [];
  if ((p.al === 'center' || p.al === 'right') && bor) {   // Docs xatboshi oxiridagi bo'sh joyni markazlashtirishda hisobga olmaydi (Chromium pre-wrap da oladi) — olib tashlanadi
    runs = runs.map(r => Object.assign({}, r)); for (let k = runs.length - 1; k >= 0; k--) { if (runs[k].maydon) break; if (!runs[k].x) continue; const t = runs[k].x.replace(/ +$/, ''); runs[k].x = t; if (t) break; }
  }
  let ich = bor ? runs.filter(r => r.x || r.maydon).map(r => runHtml(r, p, tek)).join('') : '<br>';   // bo'sh bo'lak chiqarilmaydi: o'lchami boshqa bo'sh <span> ham qator qutisini kengaytiradi
  if (tek && bor) ich += '<span class="so"></span>';
  let belgi = '';
  if (p.num && p.num.matn) {   // ro'yxat belgisi — osilgan chekinish joyida (left + hanging), xatboshi belgisi (¶) shrifti (27/368: ● Arial 12)
    const nf = shrift(p.num.font || p.belgiFont || DEF.font);
    belgi = '<span class="nm" style="left:' + px((p.indStart || 0) + (p.indFirst || 0)) + 'pt;font-family:' + nf.css + ';font-size:' + (p.num.sz || p.belgiSz || uslubSz) + 'pt">' + esc(p.num.matn) + '</span>';
  }
  if (belgi) st.push('position:relative');
  const cls = [tek && bor ? 'j' : '', p.widow === false ? 'nb' : ''].filter(Boolean).join(' ');
  const yakka = q.sz * q.f.F, ruxsat = (q.L - yakka) * (1 - T.ALFA_EXTRA);   // Docs sahifa pastida qatorning yakka qismi sig'sa qator qoladi (betlar)
  return '<p' + (cls ? ' class="' + cls + '"' : '') + (ichida ? '' : ' data-l="' + q.L.toFixed(3) + '" data-r="' + Math.max(0, ruxsat).toFixed(3) + '"') + ' style="' + st.join(';') + '">' + belgi + ich + '</p>';
}
function jadvalHtml(t, eni) {
  const n = Math.max(...t.rows.map(r => r.cells.reduce((a, c) => a + (c.span || 1), 0)), t.cols.length);
  const w = []; for (let i = 0; i < n; i++) w.push(px(t.cols[i] != null ? t.cols[i] : 100));
  // chiziq: jadvalda biror chegara bo'lsa — chiziqli jadval (Docs jadval qutisini chiziq qalinligicha chapga suradi)
  let chizMax = 0; t.rows.forEach(r => r.cells.forEach(c => ['top', 'left', 'bottom', 'right'].forEach(k => { if (c.bord[k]) chizMax = Math.max(chizMax, c.bord[k].sz); })));
  const chiz = chizMax ? Math.max(PX, px(chizMax)) : 0;
  let h = '<table style="border-collapse:separate;border-spacing:0;width:' + (w.reduce((a, b) => a + b, 0) + chiz) + 'pt' + (chiz ? ';margin-left:-' + chiz + 'pt' : '') + (t.chap ? ';margin-left:' + (px(t.chap) - chiz) + 'pt' : '') + '"><colgroup>'
    + w.map((x, i) => '<col style="width:' + (x + (i === n - 1 ? chiz : 0)) + 'pt">').join('') + '</colgroup>';
  t.rows.forEach((r, ri) => {
    const trSt = [];
    if (r.h != null) trSt.push('height:' + px(r.h) + 'pt');
    if (r.cantSplit) trSt.push('break-inside:avoid');
    h += '<tr' + (trSt.length ? ' style="' + trSt.join(';') + '"' : '') + '>' + r.cells.map((c, ci) => {
      const pd = k => px(c.pad[k] == null ? 5 : c.pad[k]);
      const b = k => c.bord[k] ? Math.max(PX, px(c.bord[k].sz)) + 'pt solid ' + c.bord[k].c : '0';
      const bor = !!(c.bord.top || c.bord.left || c.bord.bottom || c.bord.right);
      const st = ['padding:' + +(pd('t') + (bor ? T.CHIZ_PAST : 0)).toFixed(3) + 'pt ' + +(pd('r') - chiz).toFixed(3) + 'pt ' + +(pd('b') - (bor ? T.CHIZ_PAST : 0)).toFixed(3) + 'pt ' + pd('l') + 'pt',
        'border-top:' + b('top'), 'border-left:' + b('left'), 'border-right:' + (ci === r.cells.length - 1 ? b('right') : '0'), 'border-bottom:' + (ri === t.rows.length - 1 ? b('bottom') : '0'),
        'vertical-align:' + (c.vAlign === 'center' ? 'middle' : c.vAlign === 'bottom' ? 'bottom' : 'top')];
      if (c.bord.bottom) st.push('--ch:' + Math.max(PX, px(c.bord.bottom.sz)) + 'pt', '--rang:' + c.bord.bottom.c);
      if (c.bg) st.push('background:' + c.bg);
      const ich = c.el.map(e => e.t === 'tbl' ? jadvalHtml(e, eni) : parHtml(e, true, eni)).join('');
      return '<td' + ((c.span || 1) > 1 ? ' colspan="' + c.span + '"' : '') + ' style="' + st.join(';') + '">' + ich + '</td>';
    }).join('') + '</tr>';
  });
  return h + '</table>';
}
// kolontitul balandligi (bir qatorli xatboshilar deb): Docs sahifa tanasini kolontitul + uning chekkasidan pastga tushirmaydi
function kolBaland(L) { return (L || []).reduce((a, e) => a + (e.t === 'p' ? qatorOlchov(e).L + (e.before || 0) + (e.after || 0) : 0), 0); }
// Sahifa hoshiyalari: tepa/past — kolontitul bilan (Docs tanani kolontitul + chekkasidan pastga tushirmaydi)
function hoshiya(m) {
  const past = Math.max(m.past, m.footer && m.footer.length ? m.pastKol + kolBaland(m.footer) : 0), tepa = Math.max(m.tepa, m.header && m.header.length ? m.tepaKol + kolBaland(m.header) : 0);
  return { tepa, past };
}
function html(m) {
  const W = px(m.w), H = px(m.h), eni = +(m.w - m.chap - m.ong).toFixed(3);
  const { tepa, past } = hoshiya(m);
  // Yuqori va pastki hoshiya @page da emas, .ust ning har sahifada takrorlanadigan (clone) ichki chekinishida — Chromium @page hoshiyasini
  // butun px ga yaxlitlaydi, bu yerda esa aniq (lib/docs_pdf.js kabi). Yetim/beva qator nazorati bu tuzilishda Chromium'da ishlamaydi — betlar() da qo'lda.
  const CSS = `@page{size:${W}pt ${H}pt;margin:0 0 0 ${pxPast(m.chap)}px}
*{box-sizing:border-box}html{margin:0;padding:0}body{margin:0;padding:0 0 0 ${qoldiq(m.chap)}pt;color:#000;-webkit-print-color-adjust:exact;print-color-adjust:exact;orphans:1;widows:1}
.ust{width:${(W - m.chap).toFixed(3)}pt;overflow:clip;padding:${tepa}pt 0 ${past}pt 0;box-decoration-break:clone;-webkit-box-decoration-break:clone}.ich{width:${eni}pt}
p{margin:0;padding:0;white-space:pre-wrap;overflow-wrap:break-word;tab-size:36pt}.nw{white-space:nowrap}.ba{line-break:anywhere}
.nm{position:absolute;top:0}
table{table-layout:fixed;margin:0}
td{box-decoration-break:clone;-webkit-box-decoration-break:clone;overflow:clip}tr.pend td{box-shadow:inset 0 calc(-1 * var(--ch)) 0 0 var(--rang)}
.kol{position:fixed;left:${qoldiq(m.chap)}pt;width:${eni}pt}.kolP{bottom:${m.pastKol}pt}.kolT{top:${m.tepaKol}pt}`;
  const tana = m.el.map(e => e.t === 'tbl' ? jadvalHtml(e, eni) : parHtml(e, false, eni)).join('');
  const kol = (L, cls) => L && L.length ? '<div class="kol ' + cls + '">' + L.map(e => e.t === 'tbl' ? jadvalHtml(e, eni) : parHtml(e, true, eni)).join('') + '</div>' : '';
  return XP.kattalashtir('<!doctype html><html><head><meta charset="utf-8"><style>' + CSS + '</style></head><body>' + kol(m.footer, 'kolP') + kol(m.header, 'kolT')
    + '<div class="ust"><div class="ich">' + tana + '</div></div></body></html>');
}
// Sahifalash (PDF dan oldin, chop etish o'lchamida): sahifa ichi balandligidagi ustunlar (multicol) bilan sinab ko'riladi — har ustun = bet.
//  1) Yetim/beva qator nazorati Docs'dagidek (kamida 2 qator: xatboshi 1 qator bilan bo'linsa — butunlay keyingi betga; 4+ qatorli xatboshining
//     oxirgi 1 qatori keyingi betga o'tsa — oxirgi 2 qatori o'tadi, buning uchun xatboshi o'sha qator boshidan ikkiga bo'linadi). Chromium
//     orphans/widows ni bu tuzilishda e'tiborsiz qoldiradi — shu yerda qo'lda. Har tuzatishdan keyin qaytadan o'lchanadi.
//  2) Docs jadval sahifada bo'linganda 1-sahifadagi qismni pastki chiziq bilan yopadi — sahifa oxiridagi qator kataklariga ichki chiziq (tr.pend).
function betlar(m) {
  const Hc = (px(m.h) * XP.KAT * 4 / 3).toFixed(3);   // butun sahifa (hoshiyalar .ust ichida), CSS px, KAT barobar
  const PASTpx = (hoshiya(m).past * XP.KAT * 4 / 3).toFixed(3);   // sahifa pastki hoshiyasi, CSS px
  return `(() => {
  const ust = document.querySelector('.ust'), b = document.body, K = ${XP.KAT * 4 / 3};
  const st = document.createElement('style'); st.textContent = '.yb{break-before:column;margin-top:0!important}'; document.head.appendChild(st);
  const W = ust.getBoundingClientRect().width;
  const olch = f => {   // ust ni ustunlarga joylab o'lchash: f(bet(x), chegara) — chegara: har ustunda matn pastki chegarasi (sahifa pasti − hoshiya), CSS px
    const mc = document.createElement('div'); mc.style.cssText = 'column-width:' + W + 'px;column-gap:0;column-fill:auto;height:${Hc}px;width:' + W + 'px';
    b.insertBefore(mc, ust); mc.appendChild(ust);
    const R = mc.getBoundingClientRect(); const r = f(x => Math.floor((x - R.left + 2) / W), R.top + ${Hc} - ${PASTpx});
    b.insertBefore(ust, mc); mc.remove(); return r;
  };
  // xatboshi qatorlari: matn tugunlari bo'yicha [{bet, top, bottom, tugun, boshi}] (qator boshi: tugun va undagi belgi o'rni)
  const qatorlar = (p, bet) => {
    const Q = []; const rel = parseFloat(getComputedStyle(p).top) || 0, L = parseFloat(p.dataset.l || 0) * K; const tw = document.createTreeWalker(p, NodeFilter.SHOW_TEXT, { acceptNode: n => n.parentElement.closest('.nm') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT });
    const rg = document.createRange(); let n;
    while ((n = tw.nextNode())) {
      if (!n.data) continue;
      rg.selectNodeContents(n);
      [...rg.getClientRects()].forEach(r => { if (r.width <= 0 && r.height <= 0) return; const k = bet(r.left), t = Math.round(r.top);
        if (!Q.length || Q[Q.length - 1].bet !== k || Math.abs(Q[Q.length - 1].top - t) > 2) {
          let o = 0; const len = n.data.length;
          for (let lo = 0, hi = len - 1; lo <= hi;) { const mid = (lo + hi) >> 1; rg.setStart(n, mid); rg.setEnd(n, mid + 1); const rr = rg.getBoundingClientRect();
            if (bet(rr.left) < k || (bet(rr.left) === k && rr.top < t - 2)) lo = mid + 1; else { o = mid; hi = mid - 1; } }
          rg.selectNodeContents(n);
          // quti (joylashuv) koordinatalari: matn to'rtburchagi − nisbiy surish; qator qutisi yuqorisi = matn yuqorisi − yarim oraliq
          const qt = r.top - rel - (L - r.height) / 2;
          Q.push({ bet: k, top: t, tugun: n, boshi: o, qt, qb: qt + L });
        } });
    }
    return Q;
  };
  // xatboshini q qatori boshidan ikkiga bo'lish (bo'laklar bitta guruh — data-g); qaytaradi: ikkinchi qism
  let gId = 0;
  const bol = (p, q) => {
    if (!p.dataset.g) p.dataset.g = String(++gId);
    const rg = document.createRange(); rg.setStart(q.tugun, q.boshi); rg.setEndAfter(p.lastChild);
    const p2 = p.cloneNode(false); p2.appendChild(rg.extractContents()); p2.style.textIndent = '0'; p2.style.marginTop = '0'; p2.style.paddingTop = ''; p2.classList.remove('yb');
    if (p.dataset.l0) { p2.style.lineHeight = p.dataset.lh0 || ''; p2.dataset.l = p.dataset.l0; delete p2.dataset.l0; delete p2.dataset.lh0; }
    p2.querySelectorAll('.nm').forEach(z => z.remove());
    p.style.marginBottom = '0'; p.after(p2); return p2;
  };
  // guruhlar: ketma-ket kelgan bir xil data-g li <p> lar — asl xatboshi
  const guruhlar = () => { const G = []; for (const el of ust.querySelectorAll('.ich > p, .ich > table')) { const g = G[G.length - 1];
    if (el.tagName === 'P' && g && g.p && el.dataset.g && g.p[0].dataset.g === el.dataset.g) g.p.push(el); else G.push(el.tagName === 'P' ? { p: [el] } : { t: el }); } return G; };
  for (let urin = 0; urin < 80; urin++) {
    const ish = olch((bet, chegara) => {
      const G = guruhlar(); let oldin = null;
      for (const g of G) {
        if (g.t) { oldin = g; continue; }
        const P = g.p, p0 = P[0];
        const Q = []; P.forEach(pc => qatorlar(pc, bet).forEach(q => { q.pc = pc; Q.push(q); }));
        if (!Q.length) { oldin = g; continue; }
        const L = parseFloat(p0.dataset.l0 || p0.dataset.l || 0) * K, RX = parseFloat(p0.dataset.r || 0) * K;
        const k0 = Q[0].bet, k = Q.filter(q => q.bet === k0).length, n = Q.length;
        // 1) Docs qoidasi: keyingi betga o'tgan birinchi qator (xatboshi ichida yoki xatboshining o'zi) oldingi betga ruxsat (RX) ichida sig'sa — qaytariladi
        if (RX > 0 && !p0.classList.contains('yb') && !p0.dataset.tortildi) {
          let i = -1, qt = null;
          if (k < n) { i = k; qt = Q[k - 1].qb; }
          else if (oldin && oldin.p && k0 > 0) {
            const QO = []; oldin.p.forEach(pc => qatorlar(pc, bet).forEach(q => QO.push(q)));
            if (QO.length && QO[QO.length - 1].bet === k0 - 1) {
              const gap = Math.max(parseFloat(getComputedStyle(oldin.p[oldin.p.length - 1]).marginBottom) || 0, parseFloat(getComputedStyle(p0).marginTop) || 0);
              i = 0; qt = QO[QO.length - 1].qb + gap; }
          }
          if (i >= 0 && qt != null && qt + L - RX <= chegara + 0.01 && qt + L > chegara - 0.01) return { g, tort: Q[i], L, RX };
        }
        // 2) yetim/beva qator nazorati (Docs standarti 2/2); widowControl=0 (nb) — yo'q
        if (!p0.classList.contains('nb') && n >= 2 && k < n) {
          if (k === 1 || (n - k === 1 && n === 3)) return { g, butun: true };
          if (n - k === 1) return { g, q: Q[k - 1] };   // (k−1)-qatordan bo'linadi: oxirgi 2 qator keyingi betga
        }
        oldin = g;
      }
      return null;
    });
    if (!ish) break;
    const tiklа = pc => { if (!pc.dataset.l0) return; pc.style.lineHeight = pc.dataset.lh0 || ''; pc.style.paddingTop = ''; pc.dataset.l = pc.dataset.l0; delete pc.dataset.l0; };
    if (ish.butun) { ish.g.p.forEach(tiklа); ish.g.p[0].classList.add('yb'); continue; }
    if (ish.tort) {
      // qatorni oldingi betga qaytarish: shu qator alohida bo'lak, qutisi kichraytiriladi (tayanch chizig'i o'z joyida: padding-top = (L − lh)/2)
      const lh = ish.L - 2 * ish.RX - 0.1, pad = (ish.L - lh) / 2, q = ish.tort, pc = q.pc;
      const Qp = qatorlar(pc, () => 0), ix = Qp.findIndex(z => z.tugun === q.tugun && z.boshi === q.boshi);
      let orta = pc; if (ix > 0) orta = bol(pc, Qp[ix]);
      const Qo = qatorlar(orta, () => 0); if (Qo.length > 1) bol(orta, Qo[1]);
      orta.dataset.l0 = orta.dataset.l; orta.dataset.lh0 = orta.style.lineHeight; orta.style.lineHeight = lh + 'px'; orta.style.paddingTop = pad + 'px'; orta.dataset.l = String(lh / K);
      ish.g.p[0].dataset.tortildi = '1'; if (!orta.dataset.g) { orta.dataset.g = ish.g.p[0].dataset.g; }
      continue;
    }
    bol(ish.q.pc, ish.q).classList.add('yb');
  }
  olch(bet => { document.querySelectorAll('table').forEach(t => { const R = [...t.rows]; R.forEach((tr, i) => { if (i < R.length - 1 && bet(R[i + 1].getBoundingClientRect().left) !== bet(tr.getBoundingClientRect().left)) tr.classList.add('pend'); }); }); });
  // 3) Sahifa raqami (PAGE maydoni) bor kolontitul: har sahifa uchun alohida nusxa — mutlaq joylashuv (sahifa k: y = k·H dan), fixed nusxa olib tashlanadi.
  //    Sahifalar soni — yakuniy joylashuvdagi ustunlar soni (oxirgi ustun + 1).
  if (document.querySelector('.kol .bet')) {
    const N = olch(bet => { let mx = 0; ust.querySelectorAll('.ich p, .ich tr').forEach(e => [...e.getClientRects()].forEach(r => { if (r.width > 0 || r.height > 0) mx = Math.max(mx, bet(r.left)); })); return mx + 1; });
    document.querySelectorAll('.kol').forEach(k => {
      if (!k.querySelector('.bet')) return;
      const h = k.getBoundingClientRect().height, past = k.classList.contains('kolP');
      for (let i = 0; i < N; i++) {
        const c = k.cloneNode(true); c.querySelectorAll('.bet').forEach(z => { z.textContent = String(i + 1); });
        c.style.position = 'absolute'; c.style.bottom = 'auto'; c.style.top = (i * ${Hc} + (past ? ${Hc} - ${(m.pastKol * XP.KAT * 4 / 3).toFixed(3)} - h : ${(m.tepaKol * XP.KAT * 4 / 3).toFixed(3)})) + 'px';
        b.appendChild(c);
      }
      k.remove();
    });
  }
  st.textContent = '.yb{break-before:page;margin-top:0!important}';   // bet boshida Docs «oldin» oralig'ini tashlaydi
})();`;
}
const SOZ = `document.querySelectorAll('span.nw').forEach(s => {
  const q = s.closest('td') || s.closest('p'), cs = getComputedStyle(q);
  const eni = q.getBoundingClientRect().width - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight) - parseFloat(cs.borderLeftWidth) - parseFloat(cs.borderRightWidth);
  if (s.getBoundingClientRect().width > eni + 0.5) s.className = 'ba';
});`;
// Ikki tomonga tekislash — lib/xat_pdf.js TEKISLA bilan bir xil qoida, faqat xatboshining o'ng chekinishi (padding-right) hisobga olinadi;
// qator oxiridagi KETMA-KET bo'sh joylar (27/351: «тумани  » — ikkitasi) hammasi chetga osiladi, cho'zilmaydi (Docs)
const TEKISLA = `(U => { document.querySelectorAll('p.j').forEach(p => {
  const cs = getComputedStyle(p), R = p.getBoundingClientRect().right - parseFloat(cs.paddingRight), so = p.querySelector('.so').getBoundingClientRect().top, gr = new Map(), ish = [];
  p.querySelectorAll('.sp').forEach(s => { const r = s.getBoundingClientRect(), k = Math.round(r.top); if (!gr.has(k)) gr.set(k, []); gr.get(k).push({ s, r }); });
  for (const [top, L] of gr) {
    if (Math.abs(top - so) < 2) continue;
    let n = L.length - 1; while (n > 0 && Math.abs(L[n - 1].r.right - L[n].r.left) < 0.5) n--;   // oxirgi bo'sh joylar tizmasi boshi
    const t = L[n], g = L.slice(0, n);
    if (!g.length) continue;
    const P = Math.floor((R - t.r.left) / U + 1e-6); if (P <= 0) continue;
    const b = Math.floor(P / g.length), q = P % g.length;
    g.forEach((z, i) => ish.push([z.s, (b + (i < q ? 1 : 0)) * U]));
  }
  ish.forEach(([s, w]) => { if (w) s.style.paddingRight = w + 'px'; });
}); })(${XP.KAT})`;
async function yasa(m) {
  const pdf = await PDF.yasa(html(m), '', { scale: 1 / XP.KAT, printBackground: true, skript: SOZ + ';' + TEKISLA + ';' + betlar(m) });
  return { pdf, bet: XP.betSoni(pdf) };
}

module.exports = { html, yasa, parHtml, jadvalHtml, _skript: m => SOZ + ';' + TEKISLA + ';' + betlar(m) };
