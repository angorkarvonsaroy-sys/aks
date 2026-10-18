// AKS TIZIM — 📊 SOTUV BO'LIMI HISOBOTI (PDF) serverda: hisobotPdf (HisobotPDF.gs v27.8 bilan bir xil — hisob, HTML, fayl nomi).
// Ma'lumot ko'zgudan (01b, 03, 04, 05); eski kod getValues() dagi faqat SANA kataklarni hisobga oladi — bu yerda ham (sanaKatak).
// PDF — Chromium (lib/pdf.js), eski tizim (Google) bilan bir xil dvigatel; sahifa o'lchami HTML'ning o'zidagi @page dan.
// Faqat «aks-yozuv-sinov hisobot» eski tizim fayli bilan solishtirgach yoqiladi (Redis yozuv_yondi:hisobot_pdf); aks holda eski tizim orqali.
'use strict';
const S = require('./sessiya');
const V = require('../lib/varaq');
const koprik = require('./koprik');
const PDF = require('../lib/pdf');
const { redis } = require('../lib/db');

const PDF_DIREKTOR = 'Ҳайдаров К.Ҳ.';
const PDF_MUALLIF = 'Камолиддин Нақиев';
const PDF_KUNQ = ['Як', 'Дш', 'Сш', 'Чш', 'Пш', 'Жм', 'Шб'];
const OYLAR = ['январ', 'феврал', 'март', 'апрел', 'май', 'июн', 'июл', 'август', 'сентябр', 'октябр', 'ноябр', 'декабр'];   // Kod.gs
const H09_MAQSAD = [   // Hisobot.gs
  ['Дўкон сотиб олиш масаласида', '🏪', 'Дўкон сотиб олиш'],
  ['Кредитга дўкон олиш масаласида', '💳', 'Кредитга дўкон олиш'],
  ['Ижарага туриш масаласида', '🔑', 'Ижарага туриш'],
  ['Ижарани бекор қилиш масаласида', '🚪', 'Ижарани бекор қилиш'],
  ['Сотув шартномани бекор қилиш масаласида', '✖️', 'Сотув шартномасини бекор қилиш'],
  ['Бошқа масалада', '💬', 'Бошқа масала']];
const PDF_LOGO = require('fs').readFileSync(require('path').join(__dirname, '../lib/hisobot_logo.b64'), 'utf8').trim();

const num = x => { const n = Number(x); return isNaN(n) ? 0 : Math.round(n); };   // num_
const utc = s => { const p = String(s).split('-').map(Number); if (p.length !== 3 || !p[0]) throw new S.Xato('Sana noto\'g\'ri: ' + s); return new Date(Date.UTC(p[0], p[1] - 1, p[2])); };
const iso = d => d.toISOString().slice(0, 10);
// getValues() da Date bo'ladigan katak: ko'zguda xom qiymati son (seriya) va ko'rinishi sana
const sanaKatak = (x, r) => typeof x === 'number' && /\d{1,2}[./-]\d{1,2}[./-]\d{2,4}|\d{4}-\d{2}-\d{2}/.test(String(r == null ? '' : r));
function hozirDmyHm() { const d = new Date(Date.now() + 5 * 3600 * 1000), p = n => String(n).padStart(2, '0');
  return p(d.getUTCDate()) + '.' + p(d.getUTCMonth() + 1) + '.' + d.getUTCFullYear() + ' ' + p(d.getUTCHours()) + ':' + p(d.getUTCMinutes()); }

// ------------------------------------------------------------------ ma'lumot
function pdfKunlar(bosh, oxir) { const L = []; let t = utc(bosh).getTime(); const oxT = utc(oxir).getTime(); while (t <= oxT) { L.push(iso(new Date(t))); t += 86400000; } return L; }
function pdfBosh() { return { m: [0, 0, 0, 0, 0, 0], ij: 0, sv: 0, qiy: 0, jami: 0, yangi: 0 }; }
async function pdfYigish(kunlar) {
  const K = {}; kunlar.forEach(k => K[k] = pdfBosh());
  const kun = (x, r) => sanaKatak(x, r) ? K[V.iso(x)] : null;
  (await V.qatorlar('01b_Tashrif_jurnali')).forEach(({ x, r }) => {
    const k = x[0] && kun(x[1], r[1]); if (!k || Number(x[14]) !== 1) return;
    const i = H09_MAQSAD.findIndex(m => m[0] === String(x[6] == null ? '' : x[6])); if (i >= 0) k.m[i]++;
  });
  (await V.qatorlar('04_Ijara_shartnomalar')).forEach(({ x, r }) => { const k = x[0] && kun(x[1], r[1]); if (k) k.ij++; });
  (await V.qatorlar('03_Sotuv_shartnomalar')).forEach(({ x, r }) => { const k = x[0] && kun(x[2], r[2]);
    if (k && x[13] !== 'Kutilmoqda' && !/QAYTA TUZISH/i.test(String(x[19] == null ? '' : x[19]))) { k.sv++; k.qiy += num(x[25]); } });
  (await V.qatorlar('05_Tolovlar')).forEach(({ x, r }) => {
    const k = x[0] && kun(x[1], r[1]); if (!k) return;
    const s = num(x[3]); k.jami += s;
    if (sanaKatak(x[17], r[17]) && V.iso(x[17]) === V.iso(x[1])) k.yangi += s;
  });
  return K;
}
function pdfQosh(K, kunlar) {
  const t = pdfBosh();
  kunlar.forEach(k => { const x = K[k]; x.m.forEach((v, i) => t.m[i] += v); t.ij += x.ij; t.sv += x.sv; t.qiy += x.qiy; t.jami += x.jami; t.yangi += x.yangi; });
  return t;
}

// ------------------------------------------------------------------ davrlar
const pdfWd = s => utc(s).getUTCDay();
const pdfDm = s => s.slice(8) + '.' + s.slice(5, 7);
function pdfHaftalar(kunlar) {
  const G = []; let cur = null;
  kunlar.forEach(k => { if (!cur || pdfWd(k) === 1) { cur = []; G.push(cur); } cur.push(k); });
  return G.map(g => ({ kunlar: g, nom: pdfDm(g[0]) + (g.length > 1 ? ' —<br>' + pdfDm(g[g.length - 1]) : ''), qator: pdfDm(g[0]) + (g.length > 1 ? ' — ' + pdfDm(g[g.length - 1]) : '') }));
}
function pdfOylar(kunlar) {
  const G = {}, T = [];
  kunlar.forEach(k => { const key = k.slice(0, 7); if (!G[key]) { G[key] = []; T.push(key); } G[key].push(k); });
  return T.map(key => { const o = OYLAR[Number(key.slice(5)) - 1]; return { kunlar: G[key], nom: o.charAt(0).toUpperCase() + o.slice(1) + '<br>' + key.slice(0, 4) }; });
}
function pdfDavrNomi(bosh, oxir, n, bugun) {
  const holat = oxir === bugun ? ', ' + pdfDm(oxir) + ' ҳолатига' : '';
  if (n === 1) return 'кунлик';
  const oyOxiri = iso(new Date(Date.UTC(Number(oxir.slice(0, 4)), Number(oxir.slice(5, 7)), 0)));
  if (pdfWd(bosh) === 1 && n <= 7) return 'ҳафталик' + (n < 7 ? holat : '');
  if (bosh.slice(8) === '01' && bosh.slice(0, 7) === oxir.slice(0, 7)) return 'ойлик' + (oxir < oyOxiri ? holat : '');
  return 'танланган давр';
}

// ------------------------------------------------------------------ HTML (pdfHtml_ — belgima-belgi)
function pdfKenglik(b, oxirgi, J, qatorlar) {
  const EN = 184;
  const cols = b.map(g => g.x).concat(oxirgi ? [J] : []);
  const mm = cols.map((x, i) => Math.max(11, ...qatorlar.map(q => String(q[1](x)).length * 1.75 + 3.4 + (oxirgi && i === cols.length - 1 ? 0.8 : 0))));
  const jam = mm.reduce((a, c) => a + c, 0);
  const lab = Math.max(52, EN - jam);
  const k = EN / (lab + jam);
  return { lab: (lab * k).toFixed(1) + 'mm', ust: mm.map(v => (v * k).toFixed(1) + 'mm') };
}
function pdfPul(v) { return v ? Math.round(v).toLocaleString('ru-RU').replace(/[  ,]/g, ' ') : '—'; }
function pdfHtml(K, kunlar, bosh, oxir, davrNomi, kim, vaqt) {
  const f = s => s.split('-').reverse().join('.');
  const J = pdfQosh(K, kunlar);
  const mijoz = x => x.m.reduce((a, b) => a + b, 0);
  let rejim, ustun, ikkinchi = null;
  if (kunlar.length <= 7) { rejim = 'kun'; ustun = kunlar.map(k => ({ kunlar: [k], nom: PDF_KUNQ[pdfWd(k)] + '<br>' + pdfDm(k) })); }
  else {
    const H = pdfHaftalar(kunlar);
    if (H.length <= 6) { rejim = 'hafta'; ustun = H; ikkinchi = kunlar.map(k => ({ kunlar: [k], qator: pdfDm(k) + ' ' + PDF_KUNQ[pdfWd(k)], yak: pdfWd(k) === 0 })); }
    else { rejim = 'oy'; ustun = pdfOylar(kunlar); ikkinchi = H; }
  }
  ustun.forEach(g => g.x = pdfQosh(K, g.kunlar));

  const css = '<style>@page{size:A4;margin:12mm 13mm}*{-webkit-print-color-adjust:exact !important;print-color-adjust:exact !important;color-adjust:exact !important}body{font-family:Arial,Helvetica,sans-serif;color:#1b2b24;font-size:9pt;margin:0}' +
    'table{border-collapse:collapse;width:100%}.t td{white-space:nowrap}.t td.l{white-space:normal}.t td,.t th{border:1px solid #9fb3aa;padding:4px 4px;font-size:8.3pt;text-align:right}' +
    '.t th{background:#0b3d2e;background-color:#0b3d2e;color:#ffffff;text-align:center;font-weight:normal;font-size:7.8pt}.t td.l,.t th.l{text-align:left}' +
    '.t td.j,.t th.j{font-weight:bold}.t td.j{background:#eef4f1}.t tr.cap td{background:#dfe9e4;font-weight:bold;text-align:left;color:#0b3d2e}' +
    '.t tr.tot td{background:#f6efd9;font-weight:bold}.t tr.yak td{background:#f4f4f1;color:#8a8a85}' +
    '.nt{font-size:7.6pt;color:#555555}.ft td{font-size:7pt;color:#777777;border-top:1px solid #9fb3aa;padding-top:3px}</style>';
  const bosh_ = () =>
    '<table><tr><td style="width:52px"><img src="' + PDF_LOGO + '" width="44" height="44"></td>' +
    '<td><div style="font-size:13pt;font-weight:bold;color:#0b3d2e">«АНГОР КАРВОН САРОЙ» МЧЖ</div>' +
    '<div style="font-size:8.3pt;color:#555555">Сурхондарё вилояти, Ангор тумани · Савдо мажмуаси</div></td></tr></table>' +
    '<div style="border-bottom:2px solid #0b3d2e;margin:4px 0 10px"></div>';
  const oyoq = (sahifa) => '<table class="ft" style="margin-top:14px"><tr><td>Шакллантирилди: ' + vaqt + ' · Юклаб олди: ' + kim + ' · AKS TIZIM' + (sahifa ? ' · ' + sahifa : '') +
    '</td><td style="text-align:right">Тизим муаллифи ва яратувчиси: ' + PDF_MUALLIF + '</td></tr></table>';

  const QISM = rejim === 'kun' ? 7 : 6;
  const bolaklar = []; for (let i = 0; i < ustun.length; i += QISM) bolaklar.push(ustun.slice(i, i + QISM));
  const son = v => v ? String(v) : '—';
  const A = H09_MAQSAD.map((m, i) => [m[0].replace('Сотув шартномани', 'Сотув шартномасини'), x => son(x.m[i])]);
  const B = [['Ижара шартномаси тузилди', x => son(x.ij)], ['Олди-сотди шартномаси тузилди', x => son(x.sv)], ['Шартнома қиймати, сўм', x => pdfPul(x.qiy)],
    ['Янги шартнома бўйича тўлов, сўм', x => pdfPul(x.yangi)], ['Ундирилган қарздорлик, сўм', x => pdfPul(x.jami - x.yangi)]];
  const BARCHA = A.concat([['', x => son(mijoz(x))]], B, [['', x => pdfPul(x.jami)]]);
  const jadval = (sarl, qatorlar, jamiQator) => bolaklar.map((b, bi) => {
    const oxirgi = bi === bolaklar.length - 1;
    const Kk = pdfKenglik(b, oxirgi, J, BARCHA);
    let h = '<table class="t" style="margin-bottom:9px;table-layout:fixed"><tr><th class="l" style="width:' + Kk.lab + '"></th>' + b.map((g, i) => '<th style="width:' + Kk.ust[i] + '">' + g.nom + '</th>').join('') + (oxirgi ? '<th class="j" style="width:' + Kk.ust[b.length] + '">Жами<br>' + (rejim === 'kun' && kunlar.length === 7 && pdfWd(bosh) === 1 ? 'ҳафта' : 'давр') + '</th>' : '') + '</tr>';
    h += '<tr class="cap"><td colspan="' + (b.length + 1 + (oxirgi ? 1 : 0)) + '">' + sarl + (bolaklar.length > 1 ? ' (' + (bi + 1) + '/' + bolaklar.length + ')' : '') + '</td></tr>';
    qatorlar.concat([jamiQator]).forEach((q, qi) => {
      const tot = qi === qatorlar.length;
      h += '<tr' + (tot ? ' class="tot"' : '') + '><td class="l">' + q[0] + '</td>' + b.map(g => '<td>' + q[1](g.x) + '</td>').join('') + (oxirgi ? '<td class="j">' + q[1](J) + '</td>' : '') + '</tr>';
    });
    return h + '</table>';
  }).join('');
  const ustIzoh = { kun: '', hafta: 'Устунлар — ҳафталар (душанбадан якшанбагача). Кунма-кун тафсилот — 2-варақда. ', oy: 'Устунлар — ойлар. Ҳафтама-ҳафта тафсилот — 2-варақда. ' }[rejim];

  let h = '<html><head><meta charset="utf-8">' + css + '</head><body>' + bosh_() +
    '<div style="text-align:center;font-size:12.5pt;font-weight:bold;margin-top:4px">СОТУВ БЎЛИМИ ҲИСОБОТИ</div>' +
    '<div style="text-align:center;font-size:9.5pt;color:#333333;margin:2px 0 10px">Давр: ' + f(bosh) + (bosh === oxir ? '' : ' — ' + f(oxir)) + ' (' + davrNomi + ')</div>' +
    '<table style="margin-bottom:12px"><tr>' + [['Келган мижозлар', son(mijoz(J))], ['Тузилган шартномалар', son(J.ij + J.sv)], ['Шартномалар қиймати, сўм', pdfPul(J.qiy)], ['Жами тушум, сўм', pdfPul(J.jami)]]
      .map(c => '<td style="border:1px solid #9fb3aa;padding:5px 7px;width:25%"><div style="font-size:7.6pt;color:#555555">' + c[0] + '</div><div style="font-size:11.5pt;font-weight:bold;color:#0b3d2e">' + c[1] + '</div></td>').join('<td style="width:6px"></td>') + '</tr></table>' +
    jadval('1. Сотув бўлимига келган мижозлар (такрорсиз)', A, ['Жами мижозлар', x => son(mijoz(x))]) +
    jadval('2. Шартномалар ва тушум', B, ['Жами тушум, сўм', x => pdfPul(x.jami)]) +
    '<div class="nt">' + ustIzoh + 'Тушум — фақат расмий тўловлар (05_Tolovlar). Мижозлар — бир кунда бир киши бир марта ҳисобланади. «—» — ҳаракат бўлмаган.</div>' +
    '<div style="margin-top:24px;font-size:9.5pt">Директор &nbsp;&nbsp;______________________&nbsp;&nbsp; ' + PDF_DIREKTOR + '</div>' +
    oyoq(ikkinchi ? '1-варақ' : '');

  if (ikkinchi) {
    ikkinchi.forEach(g => g.x = pdfQosh(K, g.kunlar));
    h += '<div style="page-break-before:always"></div>' + bosh_() +
      '<div style="text-align:center;font-size:12.5pt;font-weight:bold">' + (rejim === 'hafta' ? 'КУНМА-КУН ТАФСИЛОТ' : 'ҲАФТАМА-ҲАФТА ТАФСИЛОТ') + '</div>' +
      '<div style="text-align:center;font-size:9.5pt;color:#333333;margin:2px 0 10px">' + f(bosh) + ' — ' + f(oxir) + '</div>' +
      '<table class="t"><tr><th class="l" style="width:' + (rejim === 'hafta' ? '14' : '19') + '%">' + (rejim === 'hafta' ? 'Сана' : 'Ҳафта') + '</th><th>Мижоз:<br>сотиб олиш</th><th>Мижоз:<br>ижара</th><th>Мижоз:<br>бошқа</th><th>Жами<br>мижоз</th><th>Ижара<br>шартномаси</th><th>Олди-сотди<br>шартномаси</th><th style="width:17%">Тушум, сўм</th></tr>';
    const qator = (nom, x, cls) => '<tr' + (cls ? ' class="' + cls + '"' : '') + '><td class="l">' + nom + '</td><td>' + son(x.m[0] + x.m[1]) + '</td><td>' + son(x.m[2]) + '</td><td>' + son(x.m[3] + x.m[4] + x.m[5]) +
      '</td><td class="j">' + son(mijoz(x)) + '</td><td>' + son(x.ij) + '</td><td>' + son(x.sv) + '</td><td>' + pdfPul(x.jami) + '</td></tr>';
    ikkinchi.forEach(g => h += qator(g.qator, g.x, g.yak ? 'yak' : ''));
    h += qator('Жами', J, 'tot') + '</table>' +
      '<div class="nt" style="margin-top:6px">«Сотиб олиш» — нақд ва кредитга; «бошқа» — бекор қилиш ва бошқа масалалар.' + (rejim === 'hafta' ? ' Кулранг қатор — якшанба.' : '') + '</div>' +
      oyoq('2-варақ');
  }
  h = h.replace(/<th/g, '<th bgcolor="#0b3d2e"').replace(/<tr class="cap">/g, '<tr class="cap" bgcolor="#dfe9e4">')
    .replace(/<tr class="tot">/g, '<tr class="tot" bgcolor="#f6efd9">').replace(/<tr class="yak">/g, '<tr class="yak" bgcolor="#f4f4f1">');
  return h + '</body></html>';
}

// ------------------------------------------------------------------ asosiy
// tekshiruv (hisobotPdf boshidagi xatolar — eski matnlar bilan)
function davrTekshir(bosh, oxir, bugun) {
  const re = /^\d{4}-\d{2}-\d{2}$/;
  bosh = String(bosh || ''); oxir = String(oxir || '');
  if (!re.test(bosh) || !re.test(oxir)) throw new S.Xato('Sanani to\'liq tanlang.');
  if (oxir > bugun) oxir = bugun;
  if (bosh > oxir) throw new S.Xato('Boshlanish sanasi tugash sanasidan keyin bo\'lolmaydi.');
  if (bosh < '2021-01-01') throw new S.Xato('2021 yildan oldingi davr yo\'q.');
  const kunlar = pdfKunlar(bosh, oxir);
  if (kunlar.length > 366) throw new S.Xato('Davr 1 yildan oshmasin — bo\'lib-bo\'lib yuklang.');
  return { bosh, oxir, kunlar };
}
// Yadro (sinov ham shuni ishlatadi). vaqt — «Шакллантирилди» vaqti (sinovda eski fayldagi vaqt beriladi)
async function hisobotYasa(fish, bosh0, oxir0, vaqt) {
  const bugun = V.bugun();
  const { bosh, oxir, kunlar } = davrTekshir(bosh0, oxir0, bugun);
  const K = await pdfYigish(kunlar);
  const nom = pdfDavrNomi(bosh, oxir, kunlar.length, bugun);
  const html = pdfHtml(K, kunlar, bosh, oxir, nom, fish, vaqt || hozirDmyHm());
  const pdf = await PDF.yasa(html, '');
  const f = s => s.split('-').reverse().join('.');
  const fayl = 'Sotuv_hisoboti_' + f(bosh) + (bosh === oxir ? '' : '-' + f(oxir)) + '.pdf';
  return { nom: fayl, davr: f(bosh) + (bosh === oxir ? '' : ' — ' + f(oxir)) + ' (' + nom + ')', b64: pdf.toString('base64') };
}
async function yoqilgan() {
  try { if ((await redis.get('yozuv_yondi:hisobot_pdf')) !== '1') return false; } catch (e) { return false; }
  return PDF.bor();
}
async function hisobotPdf([kodSes, bosh, oxir]) {
  const u = await S.ruxsat(kodSes, 'hisobot');
  if (!(await yoqilgan())) return koprik.chaqir('hisobotPdf', u.kod, [bosh, oxir]);
  return hisobotYasa(u.fish, bosh, oxir);
}

module.exports = { hisobotPdf };
module.exports._ichki = { hisobotYasa, pdfYigish, pdfHtml, pdfKunlar, pdfDavrNomi, davrTekshir, pdfPul, sanaKatak, H09_MAQSAD };
