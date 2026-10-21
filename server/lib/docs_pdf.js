// AKS TIZIM — Google Docs hujjati modelidan (lib/docs_model.js) PDF: eski tizimda DocumentApp bilan yasalib «PDF» qilib olingan hujjat
// (Docs'ning o'z PDF chizgichi) bilan bir xil joylashuv — Chromium'da. O'lchamlar eski hujjatlardan o'lchangan (yurist ma'lumotnomasi,
// bayonnoma, penya hisob-kitobi — 19.10.2026 namunalari):
//   • Docs o'lchamlarni ekran px ga (0,75 pt) yaxlitlaydi: sahifa, hoshiyalar, jadval ustunlari, katak chekinishlari;
//   • qator balandligi = o'lcham × 1,15 (Times New Roman «yakka» oraliq) × qator oralig'i (standart 1,15); tayanch chiziq — pastroq emas,
//     qator boshidan α × o'lcham (Chromium esa qo'shimcha oraliqni teng bo'ladi — farqi nisbiy siljitish bilan tuzatiladi);
//   • xatboshilar orasidagi oraliq — oldingi «keyin» va keyingi «oldin» ning kattasi (CSS margin kabi);
//   • jadval chegarasi 0,5 pt → 1 px; katak matni chap chekkadan chekinish bilan.
// Sahifa ichi KAT barobar kattalikda teriladi (lib/xat_pdf.js dagidek — tayanch chiziqlar butun px ga sakramasin).
'use strict';
const PDF = require('./pdf');
const XP = require('./xat_pdf');

const s = v => String(v == null ? '' : v);
const esc = v => s(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const PX = 0.75, px = v => Math.round(v / PX) * PX;           // Docs: pt → butun px
const pxPast = v => Math.floor(v / PX + 1e-9), qoldiq = v => +(v - pxPast(v) * PX).toFixed(3);
// Shrift o'lchamlari (Docs): F — «yakka» qator balandligi / o'lcham; A — tayanch chiziq qator boshidan / o'lcham (qator oralig'i 1 da)
const SHRIFT = {
  'Times New Roman': { css: "'Liberation Serif','Times New Roman',serif", F: 1.15, asc: 0.891, desc: 0.216 },
  'Arial': { css: "'Liberation Sans',Arial,sans-serif", F: 1.149, asc: 0.905, desc: 0.212 },
};
const T = { ALFA_EXTRA: 0.1345, CHIZ_PAST: 0.25 };   // qator oralig'i > 1 bo'lganda qo'shimcha joyning qancha ulushi tayanch chizig'idan YUQORIGA tushadi (namunadan)

function shrift(nom) { return SHRIFT[nom] || SHRIFT.Arial; }
// xatboshi CSS: o'lcham, qalinlik, tekislash, oraliqlar, qator balandligi va tayanch chiziq tuzatmasi
function parCss(p, ichida) {
  const f = shrift(p.font), sz = p.sz || 11, ls = p.ls == null ? 1.15 : p.ls;
  const L = sz * f.F * ls;                                        // Docs qator balandligi
  const cssAlfa = (L - (f.asc + f.desc) * sz) / 2 + f.asc * sz;   // Chromium tayanch chizig'i
  const yakka = sz * f.F, docsAlfa = (yakka - (f.asc + f.desc) * sz) / 2 + f.asc * sz + (L - yakka) * T.ALFA_EXTRA;
  const st = ['font-family:' + f.css, 'font-size:' + sz + 'pt', 'line-height:' + L.toFixed(4) + 'pt',
    'text-align:' + ({ center: 'center', right: 'right', both: 'justify' }[p.al] || 'left')];
  if (p.b) st.push('font-weight:bold');
  if (!ichida) { st.push('margin-top:' + (p.before || 0) + 'pt', 'margin-bottom:' + (p.after || 0) + 'pt'); }
  const sur = +(docsAlfa - cssAlfa).toFixed(4);
  if (Math.abs(sur) > 0.0005) st.push('position:relative', 'top:' + sur + 'pt');
  return st.join(';');
}
// Google Docs chiziqcha va qiyshiq chiziqdan keyin qatorni bo'lmaydi («8-бўлимга», «27/50» butun o'tadi), Chromium bo'ladi —
// shunday so'z <span class="nw"> (bo'linmaydi). Juda uzun so'z (katakka / qatorga umuman sig'masa) Docs'da harf bo'yicha bo'linadi —
// PDF dan oldin SOZ skripti bunday so'zni «ba» (har harfdan keyin bo'linishi mumkin) qiladi.
const bogla = t => t.split(/(\s+)/).map(w => /[-\/]\S/.test(w) ? '<span class="nw">' + esc(w) + '</span>' : esc(w)).join('');
const SOZ = `document.querySelectorAll('span.nw').forEach(s => {
  const q = s.closest('td') || s.parentElement, cs = getComputedStyle(q);
  const eni = q.getBoundingClientRect().width - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight) - parseFloat(cs.borderLeftWidth) - parseFloat(cs.borderRightWidth);
  if (s.getBoundingClientRect().width > eni + 0.5) s.className = 'ba';
});`;
// bo'sh xatboshi — <br>: bir qator balandligi, PDF matnida ortiqcha belgi yo'q
function parHtml(p, ichida) { return '<p style="' + parCss(p, ichida) + '">' + (p.x ? bogla(p.x) : '<br>') + '</p>'; }
function jadvalHtml(t) {
  const n = Math.max(...t.rows.map(r => r.length));
  const w = []; for (let i = 0; i < n; i++) w.push(px(t.cols[i] != null ? t.cols[i] : 100));
  const chiz = t.bw ? Math.max(PX, px(t.bw)) : 0, rang = t.bc || '#000000';
  // Chegaralar alohida (separate): har katak o'zining yuqori va chap chizig'i bilan (oxirgi ustun — o'ng, oxirgi qator — past ham).
  // Shunda sahifa bo'linganda yangi sahifadagi qator ham yuqori chizig'i bilan boshlanadi (Docs'dagidek). Matn x — jadval cheti + chekinish:
  // jadval chiziq qalinligicha chapga suriladi.
  let h = '<table style="border-collapse:separate;border-spacing:0;width:' + (w.reduce((a, b) => a + b, 0) + chiz) + 'pt' + (chiz ? ';margin-left:-' + chiz + 'pt' : '') + '"><colgroup>'
    + w.map((x, i) => '<col style="width:' + (x + (i === n - 1 ? chiz : 0)) + 'pt">').join('') + '</colgroup>';
  t.rows.forEach((r, ri) => {
    h += '<tr>' + r.map((c, ci) => {
      const pd = k => px(c.pad[k] == null ? 5 : c.pad[k]);
      const b = chiz + 'pt solid ' + rang;
      // o'ng chekinish: katak qutisi chiziq qalinligicha chapga surilgan — matn o'ng cheti Docs'dagidek (ustun cheti − chekinish) bo'lishi uchun
      // chiziqli jadvalda Docs matnni katak ichida 0,25 pt pastroq qo'yadi (qator balandligi o'zgarmaydi) — namunalardan o'lchangan
      const st = ['padding:' + +(pd('t') + (chiz ? T.CHIZ_PAST : 0)).toFixed(3) + 'pt ' + +(pd('r') - chiz).toFixed(3) + 'pt ' + +(pd('b') - (chiz ? T.CHIZ_PAST : 0)).toFixed(3) + 'pt ' + pd('l') + 'pt'];
      if (chiz) st.push('border-top:' + b, 'border-left:' + b, 'border-right:' + (ci === r.length - 1 ? b : '0'), 'border-bottom:' + (ri === t.rows.length - 1 ? b : '0'),
        '--ch:' + chiz + 'pt', '--rang:' + rang);
      else st.push('border:0');
      if (c.bg) st.push('background:' + c.bg);
      return '<td style="' + st.join(';') + '">' + parHtml(Object.assign({}, c.p, { x: c.x }), true) + '</td>';
    }).join('') + '</tr>';
  });
  return h + '</table>';
}
function html(m) {
  // Docs jadvali o'ng hoshiyaga (hatto sahifa chetidan) chiqishi mumkin — Chromium bunda butun sahifani kichraytirib yuboradi.
  // Shuning uchun @page o'ng hoshiyasi 0, body — sahifa chetigacha (ortig'i kesiladi), matn eni ichki .ich blokida.
  const W = px(m.w), H = px(m.h), eni = pxPast(m.w - m.chap - m.ong) * PX;   // matn eni — Docs butun px ga pastga yaxlitlaydi
  // Yuqori va pastki hoshiya @page da emas, .ust ning har sahifada takrorlanadigan (clone) ichki chekinishida — Chromium @page hoshiyasini
  // butun px ga yaxlitlaydi (34 pt → 33,75), bu yerda esa aniq: har sahifa matni Docs'dagidek aynan 34 pt dan boshlanadi.
  const CSS = `@page{size:${W}pt ${H}pt;margin:0 0 0 ${pxPast(m.chap)}px}
*{box-sizing:border-box}html{margin:0;padding:0}body{margin:0;padding:0 0 0 ${qoldiq(m.chap)}pt;color:#000;-webkit-print-color-adjust:exact;print-color-adjust:exact;orphans:1;widows:1}
.ust{width:${(W - m.chap).toFixed(3)}pt;overflow:clip;padding:${m.tepa}pt 0 ${m.past}pt 0;box-decoration-break:clone;-webkit-box-decoration-break:clone}.ich{width:${eni}pt}
p{margin:0;padding:0;white-space:pre-wrap;overflow-wrap:break-word}.nw{white-space:nowrap}.ba{line-break:anywhere}
table{table-layout:fixed;margin:0}
td{vertical-align:top;box-decoration-break:clone;-webkit-box-decoration-break:clone}tr.pend td{box-shadow:inset 0 calc(-1 * var(--ch)) 0 0 var(--rang)}`;
  // Sahifa uzilishi (appendPageBreak): Docs'da uzilish bo'sh xatboshi ichida — keyingi sahifa o'sha xatboshining davomi (bo'sh qator) bilan boshlanadi
  const pb = '<div style="break-after:page;height:0"></div>' + parHtml({ t: 'p', x: '' }, false);
  return XP.kattalashtir('<!doctype html><html><head><meta charset="utf-8"><style>' + CSS + '</style></head><body><div class="ust"><div class="ich">'
    + m.el.map(e => e.t === 'tbl' ? jadvalHtml(e) : e.t === 'pb' ? pb : parHtml(e, false)).join('') + '</div></div></body></html>');
}
// Docs jadval sahifada bo'linganda 1-sahifadagi qismni pastki chiziq bilan yopadi. Chromium yopmaydi — shuning uchun PDF dan oldin
// sahifalash ustunlar (multicol, ustun balandligi = sahifa ichi) bilan sinab ko'riladi: sahifa oxiridagi qator kataklariga
// ichki pastki chiziq (joy egallamaydi) qo'yiladi.
function betOxiri(m) {
  const Hc = px(m.h) * XP.KAT * 4 / 3;
  return `(() => { const ust = document.querySelector('.ust'), b = document.body;
  const mc = document.createElement('div'); mc.style.cssText = 'column-width:' + ust.getBoundingClientRect().width + 'px;column-gap:0;column-fill:auto;height:${Hc.toFixed(3)}px';
  b.insertBefore(mc, ust); mc.appendChild(ust);
  const X = tr => Math.round(tr.getBoundingClientRect().left);
  document.querySelectorAll('table').forEach(t => { const R = [...t.rows]; R.forEach((tr, i) => { if (i < R.length - 1 && X(R[i + 1]) !== X(tr)) tr.classList.add('pend'); }); });
  b.insertBefore(ust, mc); mc.remove(); })();`;
}
async function yasa(m) {
  const pdf = await PDF.yasa(html(m), '', { scale: 1 / XP.KAT, printBackground: true, skript: SOZ + betOxiri(m) });
  return { pdf, bet: XP.betSoni(pdf) };
}

module.exports = { html, yasa, T, SHRIFT };
