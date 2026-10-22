// AKS TIZIM — ogohlantirish xati / talabnoma PDF serverda (Xat.gs v26.0 xatChiqar_ + xatChiz_ + xatImzoTold_ + rasmiy blanka RASMIY_BLANKA_v2 bilan bir xil matn va joylashuv).
// Eski tizim blankani Google Docs'da nusxalab to'ldiradi va PDF ga aylantiradi (15–20 s). Bu yerda o'sha blanka HTML'da qayta chizilgan
// (shapka, logotiplar, chiziq — eski PDF'dan o'lchab olingan koordinatalar bilan) va Chromium bilan PDF qilinadi (1–2 s).
// Shrift: Liberation Serif — Times New Roman bilan harf kengliklari bir xil (qator bo'linishi bir xil).
// Bir varaq qoidasi: 2-betga o'tsa — «Ижрочи» qatorisiz sinab ko'riladi; 2-betga 3+ qator o'tsa kichraytirilmaydi (2 bet), aks holda 0,95 / 0,9 / 0,85.
'use strict';
const fs = require('fs');
const path = require('path');
const PDF = require('./pdf');
const { xatKirill } = require('./ism');

const XAT_MATN = JSON.parse(fs.readFileSync(path.join(__dirname, 'xat', 'xat_matn.json'), 'utf8'));
const XAT_OY = ['январ', 'феврал', 'март', 'апрел', 'май', 'июн', 'июл', 'август', 'сентябр', 'октябр', 'ноябр', 'декабр'];
const XAT_MANZIL_CHAP = 290.6;
const LOGO8 = 'data:image/png;base64,' + fs.readFileSync(path.join(__dirname, 'xat', 'logo8.png')).toString('base64');
const LOGO12 = 'data:image/png;base64,' + fs.readFileSync(path.join(__dirname, 'xat', 'logo12.png')).toString('base64');

// Sahifa (Google Docs A4: 794×1123 px) va blanka hoshiyalari (twip: chap 1701, o'ng 851, yuqori/past 1134)
const SAH = { w: 595.5, h: 842.25, chap: 85.05, ong: 42.55, tepa: 56.7, past: 56.7 };
const ENI = 467.68;                      // matn kengligi: Docs A4 595,28 − 85,05 − 42,55 (eski PDF'da o'ng chegara 552,73)
const NO_TEPA = 190.37;                  // «№ …» qatori qutisining yuqorisi (eski PDF: tayanch chiziq 200,41)
const s = v => String(v == null ? '' : v);
const esc = v => s(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const pul = n => Math.round(Number(n) || 0).toLocaleString('ru-RU').replace(/[  ,]/g, ' ');
const d = iso => s(iso).split('-').reverse().join('.');

// Salom uchun: «Эшмўминова Мунира Ҳакимовна» → «Мунира Ҳакимовна». Yuridik shaxs to'liq nomi bilan qoladi. (xatIsmOtasi_)
function xatIsmOtasi(fish) {
  const F = s(fish).trim();
  if (/(^|\s)(МЧЖ|АЖ|ОАЖ|ХК|ЯТТ|MCHJ|OOO|ООО)(\s|$)/i.test(F)) return F;
  const w = F.split(/\s+/).filter(Boolean);
  return w.slice(1).map(z => /^(Ўғли|Қизи|Угли|Кизи)$/i.test(z) ? z.toLowerCase() : z).join(' ') || F;
}
function xatSeriya(sh) { return /^QM_/.test(s(sh)) ? 'QM' : 'AS'; }
// QAT'IY TARTIB: manzil → F.I.Sh. → sarlavha (xatTartibTekshir_)
function tartibTekshir(matn, nom) {
  const p = (matn || []).filter(z => z && z.t === 'p');
  const xato = m => { throw new Error('Xat shabloni tartibi buzilgan (' + nom + '): ' + m + '. Kelishilgan tartib: manzil → F.I.Sh. → sarlavha. Xat chiqarilmadi — Kamoliddinga ayting.'); };
  if (p.length < 3) xato('bloklar yetarli emas');
  if (p[0].x !== '{{Манзил_яшовчи}}' || p[0].al !== 'right') xato('1-blok manzil (o\'ngda) emas');
  if (p[1].x !== '{{Мижоз_ФИШ}}га' || p[1].al !== 'right') xato('2-blok F.I.Sh. (o\'ngda) emas');
  if (p[0].left !== XAT_MANZIL_CHAP || p[1].left !== XAT_MANZIL_CHAP || p[0].sz !== 11 || p[1].sz !== 11 || p[0].b || !p[1].b)
    xato('manzil va F.I.Sh. o\'lchami namunadagidek emas (chapdan ' + XAT_MANZIL_CHAP + ' pt, 11 pt, F.I.Sh. qalin)');
  if (p[2].al !== 'center' || !p[2].b || p[2].sz !== 11) xato('3-blok sarlavha (markazda, qalin, 11 pt) emas');
}
// Shoshilinch talabnoma (xatShoshMatn_) va direktor topshirig'idagi maydon talabnomasi (xatDirQmMatn_)
function shoshMatn(matn, sh, Q) {
  const soz = iso => iso ? iso.slice(0, 4) + ' йил ' + Number(iso.slice(8, 10)) + ' ' + XAT_OY[Number(iso.slice(5, 7)) - 1] : '';
  const j = 'Шартнома бўйича тўлов мажбуриятлари ' + soz(sh.engEski) + 'дан бери бажарилмаяпти. '
    + (sh.oxirgi ? 'Охирги тўлов ' + soz(sh.oxirgi) + 'да амалга оширилган, ' : 'Шартнома имзолангандан бери бирорта тўлов амалга оширилмаган, ')
    + soz(sh.bugun) + 'даги ҳолатга муддати ўтган қарз ' + pul(Q.muddati) + ' сўмни ташкил этади. '
    + (sh.muloqot ? 'Жамият ходимлари томонидан Сиз билан қарздорликни тўлаш юзасидан мулоқотлар олиб борилган, бироқ қарздорлик тўланмади:' : 'Бироқ қарздорлик тўланмади:');
  return matn.map(p => (p.x && /\{\{1-хат_санаси\}\}/.test(p.x)) ? Object.assign({}, p, { x: j }) : p);
}
function dirQmMatn(matn, oldin) {
  const j = 'Дўкон майдони Шартномада кўрсатилганидан {{Фарқ}} м² га кўп чиққанлиги аниқланди'
    + (oldin[0] ? ' ва бу ҳақда Сизга ' + oldin[0].sana + ' даги №' + oldin[0].raqam + '-сонли билдиришнома юборилган' : '')
    + '. Шартномага кўра бу ҳолда қўшимча келишув имзоланиши ва қўшимча бадал тўланиши лозим, бироқ Сиз қўшимча келишувни имзоламадингиз ва қўшимча бадални тўламадингиз:';
  return matn.map(p => (p.x && /\{\{1-хат_санаси\}\}/.test(p.x)) ? Object.assign({}, p, { x: j }) : p);
}

// ------------------------------------------------------------------ HTML
// Chromium @page chekkalarini butun px ga (0,75 pt) yaxlitlaydi — qolgan ulush body padding bilan to'ldiriladi (matn x = 85,05 aniq).
// Xatboshi oraliqlari (spacing before / after) — margin bilan: CSS da qo'shni margin'lar birlashadi (kattasi qoladi) va Google Docs ham shunday
// (devonxat sinovi, 22.10: X xatboshi after=3 → «Ҳурмат билан,» before=8 orasi Docs'da 8, yig'indi 11 emas). № qatorining 2,0 qator oralig'idan qolgan
// 12,65 pt esa qator ichidagi joy (xatboshi oralig'i emas) — u PADDING: keyingi xatboshining before'i bilan birlashmaydi (Docs'da 12,65 + 8).
const PX = 0.75, pxPast = v => Math.floor(v / PX + 1e-9), qoldiq = v => +(v - pxPast(v) * PX).toFixed(3);
const CSS = `@page{size:${SAH.w}pt ${SAH.h}pt;margin:${pxPast(SAH.tepa)}px ${pxPast(SAH.ong)}px ${Math.ceil(SAH.past / PX)}px ${pxPast(SAH.chap)}px}
*{box-sizing:content-box}html{margin:0;padding:0}body{margin:0;padding:${qoldiq(SAH.tepa)}pt 0 0 ${qoldiq(SAH.chap)}pt;width:${ENI}pt}
.nw{white-space:nowrap;display:inline-block;text-indent:0}
body{font-family:'Liberation Serif','Times New Roman',serif;color:#000;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.sh{position:relative;width:${ENI}pt;height:${(NO_TEPA - SAH.tepa).toFixed(2)}pt}
.sh img,.sh .t,.sh .ch{position:absolute;display:block}
.sh .t{white-space:pre;line-height:1.107}
.sh .ch{height:0;border-top:2.25pt solid #000}
p{margin:0;padding:0;white-space:pre-wrap;overflow-wrap:break-word}
.no{font-size:11pt;line-height:12.65pt;font-weight:bold;padding-bottom:12.65pt;position:relative}
.no .o{position:absolute;right:0;top:0}
table{border-collapse:collapse;table-layout:fixed}
td{border:0.75pt solid #808080;vertical-align:top}
.dir{font-size:11pt;line-height:12.65pt;font-weight:bold;margin:12pt 0 4pt;position:relative}
.dir .n{font-weight:normal}.dir .f{position:absolute;left:180pt;top:0}
.k9{font-size:9pt;line-height:10.35pt;margin-bottom:3pt}`;

// Shapka (RASMIY_BLANKA_v2, eski PDF'dagi joylashuv) — koordinatalar sahifa bo'yicha, pt
function shapka() {
  const X = x => (x - SAH.chap).toFixed(2), Y = (tayanch, sz) => (tayanch - 0.891 * sz - SAH.tepa).toFixed(2);
  const t = (matn, x, tay, sz, b) => '<div class="t" style="left:' + X(x) + 'pt;top:' + Y(tay, sz) + 'pt;font-size:' + sz + 'pt' + (b ? ';font-weight:bold' : '') + '">' + esc(matn) + '</div>';
  return '<div class="sh">'
    + '<img src="' + LOGO8 + '" style="left:' + X(82.02) + 'pt;top:' + (83.767 - SAH.tepa).toFixed(2) + 'pt;width:103.5pt;height:65.25pt">'
    + '<img src="' + LOGO12 + '" style="left:' + X(174.3) + 'pt;top:' + (101.42 - SAH.tepa).toFixed(2) + 'pt;width:135pt;height:45pt">'
    + t('ЎЗБЕКИСТОН РЕСПУБЛИКАСИ', 339.87, 88.45, 12, 1) + t('СУРХОНДАРЁ ВИЛОЯТИ', 361.42, 102.25, 12, 1) + t('АНГОР ТУМАНИ', 384.69, 116.05, 12, 1)
    + t('“ANGOR KARVON SAROY” M.CH.J', 335.59, 137.85, 12, 1)
    + t('Манзил: Ангор тумани, Aт Термизий кўчаси 198-уй', 346.64, 147.91, 8) + t('Банк: АТ Халқ банк Сурхондарё минтакавий филиали\u200b', 343.06, 157.11, 8)
    + t('ИНН:308489492 МФО:01125  Тел: +998 95-557-88-88', 345.25, 166.31, 8)
    + '<div class="ch" style="left:' + X(86.55) + 'pt;top:' + (184.86 - SAH.tepa).toFixed(2) + 'pt;width:465.75pt"></div>'
    + '</div>';
}
// o: { bloklar, q, qoshimchaBor, yil, raqam, sanaMatn, k, sinov, havola?, aslYoq? }
//   havola — № qatori ostidagi 10 pt qator (Devon.gs devonXatYasa_: javob xati «… даги …-сон хатингизга»); aslYoq — «Асл нусхасини олдим» matni olib tashlanadi
//   (devonAslOchir_: Docs oxirgi xatboshini o'chirmaydi — matni o'chirilib, bo'sh qator qoladi). Blok: ls — qator oralig'i (setLineSpacing; 1 = 1,15 em)
function xatHtml(o) {
  const k = o.k || 1, z = n => Math.round(n * k * 2) / 2;
  const tq = t => s(t).replace(/\{\{[^}]+\}\}/g, m => (o.q[m] !== undefined ? o.q[m] : m));
  const AL = { both: 'justify', center: 'center', right: 'right', left: 'left' };
  let keyingiOldin = 0, html = '';
  const para = (matn, b) => {
    const sz = z(b.sz || 11);
    const tek = (b.al || 'both') === 'both';
    const ls = b.ls || 1;
    const st = ['text-align:' + (tek ? 'left' : AL[b.al]), 'margin-top:' + z((b.before || 0) + keyingiOldin) + 'pt', 'margin-bottom:' + z(b.after || 0) + 'pt',
      'padding-left:' + Math.round((b.left || 0) / 0.75) * 0.75 + 'pt'   /* Docs chekinishni butun px ga yaxlitlaydi: 28,4 → 28,5 */, 'text-indent:' + (b.ind ? 28.5 : 0) + 'pt', 'font-size:' + sz + 'pt', 'line-height:' + (sz * 1.15 * ls).toFixed(3) + 'pt'];
    // Docs qator oralig'i > 1 bo'lsa qo'shimcha joyni matn OSTIGA qo'yadi (matn qator boshida qoladi), Chromium esa teng bo'lib ustiga ham qo'yadi — matn yarmiga ko'tariladi
    if (ls > 1) st.push('position:relative', 'top:-' + (sz * 1.15 * (ls - 1) / 2).toFixed(4) + 'pt');
    if (b.b) st.push('font-weight:bold');
    keyingiOldin = 0;
    // Google Docs chiziqcha/qiyshiq chiziqdan keyin qatorni bo'lmaydi («198-уйдаги» butun o'tadi) — Chromium bo'ladi; so'z butun qoldiriladi.
    // «№» ni Chromium tekislashda ieroglif kabi ko'radi va yoniga bo'sh joy qo'shadi — inline-block buni to'xtatadi.
    // Ikki tomonga tekislash (justify) Docs'dagidek TEKISLA skripti bilan qilinadi: har bo'sh joy alohida <span class="sp">.
    const soz = w => /[-\/№]/.test(w) ? '<span class="nw">' + esc(w) + '</span>' : esc(w);
    const ich = !matn ? '<br>' : tek ? matn.split(' ').map(soz).join('<span class="sp"> </span>') + '<span class="so"></span>' : matn.split(' ').map(soz).join(' ');
    html += '<p' + (tek ? ' class="j"' : '') + ' style="' + st.join(';') + '">' + ich + '</p>';
  };
  o.bloklar.forEach(bl => {
    if (bl.t === 'bosh') para(' ', { al: 'left', sz: bl.sz || 11, after: 0 });
    else if (bl.t === 'p') { const matn = tq(bl.x); if (!matn.trim() && /\{\{/.test(s(bl.x))) return; para(matn, bl); }
    else if (bl.t === 'tbl') {
      const rows = bl.rows.filter(r => o.qoshimchaBor || r[1].indexOf('{{Қўшимча_майдон_қарзи}}') < 0).map(r => [tq(r[0]), tq(r[1])]);
      const sz = z(10), lh = (sz * 1.15).toFixed(3);
      // eski PDF: chiziqlar x 85,5 / 394,5 / 552,5, qatorlar orasi 13,75 pt, matn x 88,8. Chromium 0,5 pt chiziqni 1 px (0,75 pt) qiladi;
      // jadval kengligi matn kengligidan oshsa butun sahifani kichraytiradi — shuning uchun tashqi chegara ichkarida qoladi.
      html += '<table style="margin-top:' + z(keyingiOldin) + 'pt;margin-left:-0.05pt;width:467.25pt"><colgroup><col style="width:309pt"><col style="width:158.25pt"></colgroup>'
        + rows.map((r, i) => '<tr>' + r.map((c, j) => '<td style="padding:0.75pt ' + (j ? '3.7pt 0.75pt 3pt' : '3pt 0.75pt 3.05pt') + ';font-size:' + sz + 'pt;line-height:' + lh + 'pt;text-align:' + (j ? 'right' : 'left') + (i === rows.length - 1 ? ';font-weight:bold' : '') + '">' + esc(c) + '</td>').join('') + '</tr>').join('')
        + '</table>';
      keyingiOldin = 5;
    }
  });
  // blankaning imzo qismi (o'lchami o'zgarmaydi): Директор, 3 bo'sh qator, Ижрочи, Асл нусхасини олдим
  const ij = 'Ижрочи: ' + s(o.q['{{Ундирувчи}}']) + ', тел.: ' + s(o.q['{{Ундирувчи_тел}}']);
  const asl = o.aslYoq ? '' : 'Асл нусхасини олдим: ___________ (имзо) ___________________ (Ф.И.Ш.) «___» ________ ' + o.yil + ' й.';
  const imzo = '<p class="dir">Директор<span class="n">______________________</span>&#8203;<span class="f">Ҳайдаров К.Ҳ.</span></p>'
    + '<p class="k9"><br></p><p class="k9"><br></p>' + (o.sinov ? '' : '<p class="k9"><br></p><p class="k9">' + esc(ij) + '</p>')   // bo'sh qator — <br> (PDF matnida ortiqcha belgi yo'q, eski xatdagidek)
    + '<p class="k9" style="margin-bottom:0">' + (asl ? esc(asl) : '<br>') + '</p>';
  const havola = o.havola ? '<p style="font-size:' + z(10) + 'pt;line-height:' + (z(10) * 1.15).toFixed(3) + 'pt;margin-top:' + z(2) + 'pt;margin-bottom:0;text-align:left">' + esc(o.havola) + '</p>' : '';
  return kattalashtir('<!doctype html><html><head><meta charset="utf-8"><style>' + CSS + '</style></head><body>' + shapka()
    + '<p class="no">№ ' + esc(o.raqam) + '&#8203;<span class="o">' + esc(o.sanaMatn) + '</span></p>' + havola
    + html + imzo + '</body></html>');
}
// Chromium chop etishda matn tayanch chizig'ini butun px ga (0,75 pt) yaxlitlaydi — qatorlar 12 / 12,75 pt sakraydi (Docs'da 12,65 tekis).
// Shuning uchun sahifa ichi 4 barobar kattalikda teriladi va PDF scale 0,25 bilan chiqariladi: qadam 0,19 pt ga tushadi.
// @page (sahifa o'lchami va chekkalar) kattalashtirilmaydi — u sahifa birligida qoladi.
// Shrift o'lchami: Google Docs harf kengligini px o'lchamning 1/76 px ga pastga qirqilgan qiymatidan hisoblaydi (11 pt = 14,6579 px,
// 8 pt = 10,6579, 10 pt = 13,3289; 10,5 / 9 / 12 pt — butun px). 4 ta eski xatdagi 200 dan ortiq qatordan o'lchangan (farq < 0,002%).
// Qirqilmasa 11 pt qatorlar Docs'dagidan 0,06% uzun chiqadi va qator bo'linishi / tekislash farq qiladi.
const KAT = 8;
// Google Docs ikki tomonga tekislashi: qatordagi bo'sh qoldiq butun px larga (0,75 pt) bo'linadi (qoldiq < 1 px tashlanadi),
// har bo'sh joyga teng bo'lib qo'shiladi, ortgan px lar qatordagi birinchi bo'sh joylarga 1 tadan beriladi (eski PDF'lardan o'lchangan).
// Chromium esa qoldiqni kasr bilan teng bo'ladi — so'zlar 2 pt gacha siljiydi. Shuning uchun PDF dan oldin sahifada shu skript ishlaydi.
const TEKISLA = `(U => { document.querySelectorAll('p.j').forEach(p => {
  const R = p.getBoundingClientRect().right, so = p.querySelector('.so').getBoundingClientRect().top, gr = new Map(), ish = [];
  p.querySelectorAll('.sp').forEach(s => { const r = s.getBoundingClientRect(), k = Math.round(r.top); if (!gr.has(k)) gr.set(k, []); gr.get(k).push({ s, r }); });
  for (const [top, L] of gr) {
    if (Math.abs(top - so) < 2) continue;                       // xatboshining oxirgi qatori tekislanmaydi
    const t = L[L.length - 1], g = L.slice(0, -1);               // t — qator oxiridagi (bo'linish) bo'sh joyi
    if (!g.length) continue;
    const P = Math.floor((R - t.r.left) / U + 1e-6); if (P <= 0) continue;
    const b = Math.floor(P / g.length), q = P % g.length;
    g.forEach((z, i) => ish.push([z.s, (b + (i < q ? 1 : 0)) * U]));
  }
  ish.forEach(([s, w]) => { if (w) s.style.paddingRight = w + 'px'; });
}); })(${KAT})`;
function kattalashtir(h) {
  const k = t => t.replace(/font-size:(\d+(?:\.\d+)?)pt\b/g, (m, n) => 'font-size:' + +(Math.floor(Number(n) / 0.75 * 76 + 1e-6) / 76 * KAT).toFixed(4) + 'px')
    .replace(/(-?\d+(?:\.\d+)?)pt\b/g, (m, n) => +(Number(n) * KAT).toFixed(3) + 'pt');
  return h.replace(/<style>([\s\S]*?)<\/style>/, (m, c) => '<style>' + c.replace(/(@page\{[^}]*\})|([^@]+)/g, (mm, pg, boshqa) => pg || k(boshqa)) + '</style>')
    .replace(/style="([^"]*)"/g, (m, c) => 'style="' + k(c) + '"');
}
function betSoni(buf) { const m = buf.toString('latin1').match(/\/Type\s*\/Page(?!s)/g); return m ? m.length : 1; }

// xatChiqar_: x — xatShartnomalar_ yozuvi (shablon bilan), b — bosqich, sanaIso, muddatIso, Q, oldin, ij {ism, tel}, shosh
async function xatChiqar(x, b, raqam, sanaIso, muddatIso, Q, oldin, ij, shosh) {
  const yil = sanaIso.slice(0, 4);
  const fish = xatKirill(x.fish);
  const m2 = n => s(Math.round((Number(n) || 0) * 100) / 100).replace('.', ',');
  const q = {
    '{{Мижоз_ФИШ}}': fish, '{{Мижоз_исм_отаси}}': xatIsmOtasi(fish),
    '{{Манзил_яшовчи}}': x.manzil ? x.manzil + 'да яшовчи' : '', '{{Шартнома_рақами}}': x.no, '{{Шартнома_санаси}}': d(x.sana),
    '{{Блок}}': x.blok, '{{Қават}}': x.qavat, '{{Дўкон_рақами}}': x.dokonNo, '{{Майдон}}': s(x.maydon).replace('.', ','),
    '{{Асосий_қарз}}': pul(Q.asosiy), '{{Муддати_ўтган_қарз}}': pul(Q.muddati), '{{Қўшимча_майдон_қарзи}}': pul(Q.qoshimcha),
    '{{Жами_қарз}}': pul(Q.jami), '{{Ҳолат_санаси}}': d(sanaIso), '{{Тўлов_муддати}}': d(muddatIso),
    '{{1-хат_рақами}}': oldin[0] ? oldin[0].raqam : '', '{{1-хат_санаси}}': oldin[0] ? oldin[0].sana : '',
    '{{2-хат_рақами}}': oldin[1] ? oldin[1].raqam : '', '{{2-хат_санаси}}': oldin[1] ? oldin[1].sana : '',
    '{{Ундирувчи}}': ij.ism, '{{Ундирувчи_тел}}': ij.tel,
    '{{Шартнома_майдони}}': m2(x.maydon), '{{Ҳақиқий_майдон}}': m2(x.real), '{{Фарқ}}': m2(x.farq), '{{1м2_нархи}}': pul(x.narx),
    '{{Қўшимча_қиймат}}': pul(x.qoshQiymat), '{{Қўшимча_қарз}}': pul(Q.qoshimcha), '{{Нотариал_сана}}': x.notarial ? d(x.notarial) : ''
  };
  const noF = s(x.no).replace(/\//g, '-'), rF = raqam.replace('/', '-');
  const nom = noF + (xatSeriya(x.shablon) === 'QM' ? '_MAYDON_' : '_OGOHLANTIRISH_') + b + '_' + rF + '.pdf';
  const shab = XAT_MATN[x.shablon]; if (!shab || !shab[b - 1]) throw new Error('Xat shabloni topilmadi: ' + x.shablon + ' ' + b + '-bosqich.');
  const matnB = shosh ? (shosh.qm ? dirQmMatn(shab[b - 1], shosh.oldin || []) : shoshMatn(shab[b - 1], shosh, Q)) : shab[b - 1];
  tartibTekshir(matnB, x.shablon + ' ' + b + '-bosqich');
  return Object.assign({ nom }, await blankaYasa(matnB, q, raqam, sanaIso, Q.qoshimcha > 0));
}
// Rasmiy blankadagi hujjat (xat, bekor qilish xabarnomasi): bloklar — xatChiz_ bloklari (p / bosh / tbl / imzo), q — o'rinbosarlar
// ({{Ундирувчи}}, {{Ундирувчи_тел}} — «Ижрочи» qatori uchun), raqam — № qatori. Bir varaq qoidasi — xatChiqar_ / bekorXabarnoma_ dagidek.
// opt — { havola, aslYoq } (devon chiqim xati)
async function blankaYasa(bloklar, q, raqam, sanaIso, qoshimchaBor, opt = {}) {
  const yil = sanaIso.slice(0, 4);
  const sanaMatn = '«' + sanaIso.slice(8, 10) + '» ' + XAT_OY[Number(sanaIso.slice(5, 7)) - 1] + ' ' + yil + ' йил';
  const yasa = async (k, sinov) => { const pdf = await PDF.yasa(xatHtml({ bloklar, q, qoshimchaBor, yil, raqam, sanaMatn, k, sinov, havola: opt.havola, aslYoq: opt.aslYoq }), '', { scale: 1 / KAT, skript: TEKISLA }); return { pdf, bet: betSoni(pdf) }; };
  let ikkiBet = false, kk = 1;
  let r = await yasa(1);
  if (r.bet > 1) {
    if ((await yasa(1, true)).bet > 1) ikkiBet = true;   // 2-betga kamida 3 qator o'tadi — kichraytirilmaydi
    else for (const k of [0.95, 0.9, 0.85]) { r = await yasa(k); kk = k; if (r.bet <= 1) break; }
  }
  return { pdf: r.pdf, bet: r.bet, ikkiBet, k: kk };   // k — Word nusxasi ham shu o'lchamda (lib/bekor_word.js)
}
function betOgoh(bet, ikkiBet) {   // xatBetOgoh_
  if (bet <= 1) return [];
  if (ikkiBet) return ['Xat ' + bet + ' betga chiqdi: 2-betga 3 qatordan ko\'p matn o\'tgani uchun qoida bo\'yicha kichraytirilmadi. Ikkala betni chop etib, birga topshiring.'];
  return ['Xat kichraytirilganda ham ' + bet + ' betga chiqdi — direktorga ayting.'];
}
function ismOgoh(fish) {   // xatIsmOgoh_
  const o = [];
  if (!/[Ѐ-ӿ]/.test(s(fish))) o.push('Mijoz ismi bazada lotincha — xatda kirillga o\'girildi: «' + xatKirill(fish) + '». Pasport bilan solishtiring.');
  if (s(fish).trim().split(/\s+/).length < 3) o.push('Bazada ism to\'liq emas (otasining ismi yo\'q): «' + fish + '». 02_Mijozlar da to\'ldirib, xatni qayta yasang.');
  return o;
}

module.exports = { xatChiqar, xatHtml, blankaYasa, betOgoh, ismOgoh, xatIsmOtasi, XAT_MATN, XAT_OY, XAT_MANZIL_CHAP, KAT, TEKISLA, kattalashtir, betSoni, pul };
