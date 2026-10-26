// AKS TIZIM — 📊 Ta'sischi hisoboti («ТАҲЛИЛИЙ МАЪЛУМОТ, 1-илова» — qo'lda yuritilgan Svodniy_hisobotlar jadvalining o'rni).
// Manba: 01_Dokonlar (640 do'kon: maydon, baza narx, qurilish holati, sotuv shartnomasi), 03_Sotuv_shartnomalar (qiymat, to'langan, qarz,
// notarial), 05_Tolovlar (to'lov shakllari: bank / naqd / plastik / barter). Faqat o'qiydi, hech narsa yozmaydi.
// Narx qoidasi (direktor, 27.10.2026): sotilgan do'kon — shartnoma qiymati; sotilmagan do'kon — prays-list baza narxi × real maydon.
// «Sotilgan» = do'konning sotuv shartnomasi bor va u bekor qilinmagan. Maydon — 01_Dokonlar F ustuni (ostdan o'lchov).
'use strict';
const S = require('./sessiya');
const V = require('../lib/varaq');

const s = v => String(v == null ? '' : v);
const son = V.son;
const r2 = n => Math.round(n * 100) / 100;
const DOKON_OXIRI = 641;                      // 01_Dokonlar: 2–641 qator = 640 do'kon
const TUGAL = 'Тугалланган';                  // qurilish holati (01_Dokonlar H ustuni)

// To'lov shakli → hisobot guruhi. 05_Tolovlar E ustuni: Naqt / Bank / Plastik / Barter (kirill variantlari ham bor).
// 27.10 (direktor): hisobotda «plastik karta» alohida bo'lim emas — naqd to'lovga qo'shiladi.
function shaklGuruh(x) {
  const t = s(x).trim();
  if (/barter|ўзаро|o'zaro|zaro hisob/i.test(t)) return 'barter';
  if (/naq|нақ|наличн/i.test(t)) return 'naqd';
  if (/plastik|пластик|karta|карт|uzcard|humo/i.test(t)) return 'naqd';   // direktor qarori 27.10: plastik karta — naqd to'lovga qo'shiladi
  if (/bank|банк|hisob|ҳисоб|перечис|o'tkazma/i.test(t)) return 'bank';
  return t ? 'boshqa' : 'korsatilmagan';
}

async function hisobla() {
  const [R1, R3, R5, R2] = await Promise.all([V.qatorlar('01_Dokonlar'), V.qatorlar('03_Sotuv_shartnomalar'), V.qatorlar('05_Tolovlar'), V.qatorlar('02_Mijozlar')]);
  const MJ = {};
  R2.forEach(({ x }) => { if (x[0] != null && x[0] !== '') MJ[s(x[0])] = s(x[2]).trim(); });

  // ---------- 1) Sotuv shartnomalari: faqat faol (bekor qilinmaganlari)
  const SH = {};                                // shartnoma raqami → ma'lumot
  let bekorSoni = 0;
  R3.forEach(({ x }) => {
    const no = s(x[0]).trim();
    if (!/^27\/\d+$/.test(no)) return;
    if (/bekor/i.test(s(x[13]))) { bekorSoni++; return; }
    SH[no] = { no, holati: s(x[13]).trim(), notarial: s(x[15]).trim(), qiymat: son(x[25]), tolangan: son(x[27]),
      qarz: son(x[30]), muddati: son(x[31]), sana: V.iso(x[2]), dokon: s(x[5]).trim(),
      fish: s(x[20]).trim() || MJ[s(x[4])] || '', dokonlar: [] };
  });

  // ---------- 2) Do'konlar
  const D = [];
  R1.forEach(({ n, x }) => {
    if (n < 2 || n > DOKON_OXIRI) return;
    const id = s(x[0]).trim(); if (!id) return;
    const sotuvNo = s(x[17]).trim();
    const sh = SH[sotuvNo] || null;
    const d = { id, blok: s(x[2]), qavat: s(x[3]), nomer: s(x[4]), maydon: son(x[5]), baza: son(x[6]),
      qurilish: s(x[7]).trim(), umumiy: son(x[15]), sotuvNo, egasi: s(x[18]).trim(), sh,
      sotilgan: !!sh, tugal: s(x[7]).trim() === TUGAL };
    if (sh) sh.dokonlar.push(d);
    D.push(d);
  });

  // ---------- 3) Shartnoma pulini do'konlarga taqsimlash (bir shartnomaga bir necha do'kon bo'lsa — maydon ulushiga qarab)
  const kopDokonli = [];
  Object.values(SH).forEach(sh => {
    const k = sh.dokonlar.length;
    if (k === 0) return;
    if (k > 1) kopDokonli.push({ no: sh.no, dokonlar: sh.dokonlar.map(d => d.id) });
    const jamiM = sh.dokonlar.reduce((a, d) => a + d.maydon, 0);
    sh.dokonlar.forEach(d => {
      const ul = k === 1 ? 1 : (jamiM > 0 ? d.maydon / jamiM : 1 / k);
      d.qiymat = sh.qiymat * ul; d.tolangan = sh.tolangan * ul; d.qarz = sh.qarz * ul; d.muddati = sh.muddati * ul;
    });
  });
  // shartnomasi do'konga bog'lanmagan (01_Dokonlar R ustunida ko'rinmayotgan) faol shartnomalar
  const D01 = {}; D.forEach(d => { D01[d.id] = d; });
  const dokonsizT = Object.values(SH).filter(sh => !sh.dokonlar.length).map(sh => {
    const d = D01[sh.dokon] || null;                      // 03 da yozilgan do'kon 01 da bormi
    return { no: sh.no, fish: sh.fish, dokon: sh.dokon, holati: sh.holati, sana: sh.sana,
      qiymat: Math.round(sh.qiymat), tolangan: Math.round(sh.tolangan), qarz: Math.round(sh.qarz),
      bor: !!d, dokonSotuvNo: d ? d.sotuvNo : '', dokonEgasi: d ? d.egasi : '',
      sabab: !sh.dokon ? '03 da do\'kon raqami yozilmagan'
        : !d ? '01_Dokonlar da «' + sh.dokon + '» nomli do\'kon yo\'q'
        : !d.sotuvNo ? '01_Dokonlar da «' + sh.dokon + '» bor, lekin shartnoma raqami ustuni BO\'SH'
        : '01_Dokonlar da «' + sh.dokon + '» ga boshqa shartnoma yozilgan: ' + d.sotuvNo };
  });
  const dokonsiz = dokonsizT.map(x => x.no + ' — ' + (x.fish || 'ismi yo\'q') + (x.dokon ? ' (' + x.dokon + ')' : '') + ': ' + x.sabab);

  // ---------- 4) To'lov shakllari (05_Tolovlar) — faqat do'konga BOG'LANGAN faol shartnomalar bo'yicha.
  // Sabab: «Jami qilingan to'lov» 03 dagi «to'langan» ustunidan do'konlarga taqsimlanadi, unga bog'lanmagan shartnoma kirmaydi —
  // shakllar ham o'sha doiradan olinmasa, shakllar yig'indisi jami to'lovdan katta chiqib qoladi.
  const T = { bank: 0, naqd: 0, barter: 0, boshqa: 0, korsatilmagan: 0 };
  let tolovJami = 0, tolovBarcha = 0, tolovBoglanmagan = 0, begonaTolov = 0, begonaSumma = 0;
  const BG = {};
  R5.forEach(({ x }) => {
    if (x[0] == null || x[0] === '') return;
    const no = s(x[2]).trim(), summa = son(x[3]);
    if (!SH[no]) { if (summa) { begonaTolov++; begonaSumma += summa; (BG[no || '(raqamsiz)'] = BG[no || '(raqamsiz)'] || { no: no || '(raqamsiz)', soni: 0, summa: 0 }).soni++; BG[no || '(raqamsiz)'].summa += summa; } return; }   // bekor qilingan / noma'lum shartnoma to'lovi
    tolovBarcha += summa;
    if (!SH[no].dokonlar.length) { tolovBoglanmagan += summa; return; }   // do'konga bog'lanmagan shartnoma — tushumga ham kirmaydi
    T[shaklGuruh(x[4])] += summa; tolovJami += summa;
  });

  // ---------- 5) Yig'indilar
  const yig = (ro, nom) => {
    const o = { nom, soni: ro.length, maydon: 0, summa: 0, sotSoni: 0, sotMaydon: 0, sotQiymat: 0, tushum: 0, qarz: 0, muddati: 0 };
    ro.forEach(d => {
      o.maydon += d.maydon;
      o.summa += d.sotilgan ? (d.qiymat || 0) : d.baza * d.maydon;      // narx qoidasi
      if (d.sotilgan) { o.sotSoni++; o.sotMaydon += d.maydon; o.sotQiymat += d.qiymat || 0; o.tushum += d.tolangan || 0; o.qarz += d.qarz || 0; o.muddati += d.muddati || 0; }
    });
    o.maydon = r2(o.maydon); o.sotMaydon = r2(o.sotMaydon);
    ['summa', 'sotQiymat', 'tushum', 'qarz', 'muddati'].forEach(k => o[k] = Math.round(o[k]));
    o.bosSoni = o.soni - o.sotSoni; o.bosMaydon = r2(o.maydon - o.sotMaydon); o.bosQiymat = o.summa - o.sotQiymat;
    return o;
  };

  const jami = yig(D, 'Жами');
  const tugal = yig(D.filter(d => d.tugal), 'Қурилиши тугалланган');
  const qurilayotgan = yig(D.filter(d => !d.tugal), 'Қурилиши якунланмаган');

  // hujjatlashtirilgan: notarial belgisi qo'yilgan faol shartnoma (sana bo'lmasa ham, belgi bo'lsa yetarli)
  const notBor = D.filter(d => d.sotilgan && d.sh.notarial);
  const notYoq = D.filter(d => !(d.sotilgan && d.sh.notarial));
  const hujBor = yig(notBor, 'Ҳужжатлаштирилган'), hujYoq = yig(notYoq, 'Ҳужжатлаштирилмаган');

  // qurilish holati ustunidagi haqiqiy qiymatlar (kutilmagan yozuv bo'lsa ko'rinsin)
  const qurTurlari = {};
  D.forEach(d => { const k = d.qurilish || '(bo\'sh)'; qurTurlari[k] = (qurTurlari[k] || 0) + 1; });

  // shubhali qatorlar: sotilgan lekin shartnoma qiymati 0; sotilmagan lekin baza narxi 0; 01 dagi «umumiy» ustuni baza×maydon ga mos kelmasligi
  const qiymatsiz = D.filter(d => d.sotilgan && !(d.qiymat > 0)).map(d => d.id + ' (' + d.sotuvNo + ')');
  const bazasiz = D.filter(d => !d.sotilgan && !(d.baza > 0)).map(d => d.id);
  const maydonsiz = D.filter(d => !(d.maydon > 0)).map(d => d.id);
  const umumiyFarq = D.filter(d => !d.sotilgan && Math.abs(d.umumiy - d.baza * d.maydon) > 1000).length;

  // 03 dagi «to'langan» yig'indisi bilan 05 dagi to'lovlar yig'indisi — mos kelishi tekshiriladi
  const shTolangan = Math.round(Object.values(SH).reduce((a, x) => a + x.tolangan, 0));
  const shQiymat = Math.round(Object.values(SH).reduce((a, x) => a + x.qiymat, 0));
  const shQarz = Math.round(Object.values(SH).reduce((a, x) => a + x.qarz, 0));
  const shMuddati = Math.round(Object.values(SH).reduce((a, x) => a + x.muddati, 0));

  return {
    sana: V.bugun(),
    jami, tugal, qurilayotgan, hujBor, hujYoq,
    tolov: { jami: jami.tushum, b05: Math.round(tolovJami), bank: Math.round(T.bank), naqd: Math.round(T.naqd),
      barter: Math.round(T.barter), boshqa: Math.round(T.boshqa), korsatilmagan: Math.round(T.korsatilmagan),
      yozilmagan: jami.tushum - Math.round(tolovJami) },
    shartnoma: { soni: Object.keys(SH).length, bekorSoni, qiymat: shQiymat, tolangan: shTolangan, qarz: shQarz, muddati: shMuddati },
    kutilayotgan: jami.bosQiymat + jami.qarz,
    nazorat: { kopDokonli, dokonsiz, dokonsizT, begonaTolov, begonaSumma: Math.round(begonaSumma), qurTurlari,
      tolovBarcha: Math.round(tolovBarcha), tolovBoglanmagan: Math.round(tolovBoglanmagan),
      begonaRoyxat: Object.values(BG).sort((a, b) => b.summa - a.summa).map(x => Object.assign({}, x, { summa: Math.round(x.summa) })),
      qiymatsiz, bazasiz, maydonsiz, umumiyFarq,
      tolovFarq: Math.round(tolovBarcha) - shTolangan, qiymatFarq: jami.sotQiymat - shQiymat }
  };
}

// ------------------------------------------------------------------ PDF (ta'sischiga beriladigan varaq)
const PDF = require('../lib/pdf');
const PDF_LOGO = require('fs').readFileSync(require('path').join(__dirname, '../lib/hisobot_logo.b64'), 'utf8').trim();
const PDF_DIREKTOR = 'К.Х.Нақиев';
const PDF_MUALLIF = 'Камолиддин Нақиев';
const pul = n => Math.round(Number(n) || 0).toLocaleString('ru-RU').replace(/[ ,]/g, ' ');
const mlrd = n => (Math.round(Number(n) / 1e8) / 10).toFixed(1).replace('.', ',') + ' млрд';
const m2 = n => (Math.round(Number(n) * 100) / 100).toFixed(2).replace('.', ',');
const foiz = (a, b) => b ? Math.round(a / b * 100) : 0;
const esc = v => s(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
function hozirDmyHm() {
  const d = new Date(Date.now() + 5 * 3600 * 1000);
  const p = n => String(n).padStart(2, '0');
  return p(d.getUTCDate()) + '.' + p(d.getUTCMonth() + 1) + '.' + d.getUTCFullYear() + ' ' + p(d.getUTCHours()) + ':' + p(d.getUTCMinutes());
}

// gorizontal chiziq: [{qism, rang, nom}] — foizga qarab bo'linadi
function chiziq(boluvlar) {
  const jami = boluvlar.reduce((a, b) => a + b.qism, 0) || 1;
  return '<table style="width:100%;border-collapse:collapse;margin:3px 0 1px"><tr>' +
    boluvlar.map(b => '<td style="width:' + (b.qism / jami * 100) + '%;background:' + b.rang + ';background-color:' + b.rang +
      ';height:13px;color:#ffffff;font-size:7pt;text-align:center;padding:0;white-space:nowrap">' +
      (b.qism / jami > 0.11 ? foiz(b.qism, jami) + '%' : '') + '</td>').join('') + '</tr></table>' +
    '<div style="font-size:7pt;color:#555555">' + boluvlar.map(b => '<span style="display:inline-block;width:8px;height:8px;background:' + b.rang +
      ';background-color:' + b.rang + '"></span> ' + b.nom).join(' &nbsp; ') + '</div>';
}

function pdfHtml(h, kim, vaqt) {
  const j = h.jami, T = h.tolov;
  const css = '<style>@page{size:A4;margin:9mm 10mm}*{-webkit-print-color-adjust:exact !important;print-color-adjust:exact !important;color-adjust:exact !important}' +
    'body{font-family:Arial,Helvetica,sans-serif;color:#1b2b24;font-size:8pt;margin:0}table{border-collapse:collapse;width:100%}' +
    '.t td,.t th{border:1px solid #9fb3aa;padding:2.6px 4px;font-size:7.6pt;text-align:right;white-space:nowrap}' +
    '.t th{background:#0b3d2e;background-color:#0b3d2e;color:#ffffff;text-align:center;font-weight:normal;font-size:7.2pt}' +
    '.t td.l,.t th.l{text-align:left;white-space:normal}.t tr.tot td{background:#f6efd9;background-color:#f6efd9;font-weight:bold}' +
    '.t tr.sub td{color:#555555}.qiz{color:#a32020;font-weight:bold}' +
    '.sr{font-size:9.5pt;font-weight:bold;color:#0b3d2e;margin:7px 0 3px;border-bottom:1px solid #0b3d2e;padding-bottom:1px}' +
    '.ft td{font-size:6.6pt;color:#777777;border-top:1px solid #9fb3aa;padding-top:3px}</style>';

  const kpi = [['Жами дўкон', j.soni + ' та', m2(j.maydon) + ' m²'],
    ['Сотилган', j.sotSoni + ' та (' + foiz(j.sotSoni, j.soni) + '%)', m2(j.sotMaydon) + ' m²'],
    ['Жами тушум', mlrd(j.tushum), pul(j.tushum)],
    ['Кутилаётган савдо', mlrd(h.kutilayotgan), pul(h.kutilayotgan)]];

  const xulosa = j.soni + ' та дўкондан <b>' + j.sotSoni + ' таси сотилган (' + foiz(j.sotSoni, j.soni) + '%)</b>. ' +
    'Жами <b>' + mlrd(j.tushum) + ' сўм</b> тушум олинган. Сотилганлардан <b>' + mlrd(j.qarz) + ' сўм</b> қарз қолган, ' +
    'шундан <span class="qiz">' + mlrd(j.muddati) + ' сўм муддати ўтган</span>. ' +
    'Сотилмаган ' + j.bosSoni + ' та дўкон қиймати <b>' + mlrd(j.bosQiymat) + ' сўм</b> — ' +
    'булар билан бирга кутилаётган умумий савдо <b>' + mlrd(h.kutilayotgan) + ' сўм</b>.';

  const q1 = [['Жами қилинган тўлов', pul(j.tushum), ''],
    ['&nbsp;&nbsp;— ҳисоб рақамга (банк)', pul(T.bank), foiz(T.bank, T.jami) + '%'],
    ['&nbsp;&nbsp;— нақд тўлов', pul(T.naqd), foiz(T.naqd, T.jami) + '%'],
    ['&nbsp;&nbsp;— бартер (товар/хизмат)', pul(T.barter), foiz(T.barter, T.jami) + '%']]
    .concat(T.boshqa ? [['&nbsp;&nbsp;— бошқа шакл', pul(T.boshqa), foiz(T.boshqa, T.jami) + '%']] : [])
    .concat(T.korsatilmagan ? [['&nbsp;&nbsp;— шакли кўрсатилмаган', pul(T.korsatilmagan), foiz(T.korsatilmagan, T.jami) + '%']] : [])
    .concat(T.yozilmagan ? [[T.yozilmagan > 0 ? '&nbsp;&nbsp;— тўлов жадвалига ёзилмаган' : '&nbsp;&nbsp;— тўлов жадвалида ортиқча',
      (T.yozilmagan > 0 ? '' : '−') + pul(Math.abs(T.yozilmagan)), foiz(Math.abs(T.yozilmagan), T.jami) + '%']] : []);

  const qator3 = o => '<tr' + (o.nom === 'Жами' ? ' class="tot"' : '') + '><td class="l">' + o.nom + '</td><td>' + o.soni + '</td><td>' + m2(o.maydon) +
    '</td><td>' + pul(o.summa) + '</td><td>' + o.sotSoni + '</td><td>' + m2(o.sotMaydon) + '</td><td>' + pul(o.sotQiymat) +
    '</td><td>' + pul(o.tushum) + '</td><td>' + pul(o.qarz) + '</td></tr>';
  const qator4 = o => '<tr' + (o.nom === 'Жами' ? ' class="tot"' : '') + '><td class="l">' + o.nom + '</td><td>' + o.soni + '</td><td>' + m2(o.maydon) +
    '</td><td>' + pul(o.summa) + '</td><td>' + pul(o.tushum) + '</td><td>' + pul(o.summa - o.tushum) + '</td></tr>';
  const hujJami = { nom: 'Жами', soni: j.soni, maydon: j.maydon, summa: j.summa, tushum: j.tushum };

  return '<html><head><meta charset="utf-8">' + css + '</head><body>' +
    '<table><tr><td style="width:46px"><img src="' + PDF_LOGO + '" width="40" height="40"></td>' +
    '<td><div style="font-size:11.5pt;font-weight:bold;color:#0b3d2e">«АНГОР КАРВОН САРОЙ» МЧЖ</div>' +
    '<div style="font-size:7.6pt;color:#555555">Сурхондарё вилояти, Ангор тумани · Янги қурилган савдо мажмуаси</div></td>' +
    '<td style="text-align:right;font-size:7.6pt;color:#555555">1-илова</td></tr></table>' +
    '<div style="border-bottom:2px solid #0b3d2e;margin:3px 0 7px"></div>' +
    '<div style="text-align:center;font-size:12pt;font-weight:bold;color:#0b3d2e">ТАҲЛИЛИЙ МАЪЛУМОТ</div>' +
    '<div style="text-align:center;font-size:8.6pt;color:#333333;margin:1px 0 7px">Савдо мажмуаси дўконлари тўғрисида · <b>' +
      h.sana.split('-').reverse().join('.') + ' ҳолатида</b></div>' +

    '<table style="margin-bottom:6px"><tr>' + kpi.map(c =>
      '<td style="border:1px solid #9fb3aa;padding:4px 6px;width:25%"><div style="font-size:7pt;color:#555555">' + c[0] + '</div>' +
      '<div style="font-size:12pt;font-weight:bold;color:#0b3d2e">' + c[1] + '</div>' +
      '<div style="font-size:7pt;color:#777777">' + c[2] + '</div></td>').join('<td style="width:5px"></td>') + '</tr></table>' +

    '<div style="border:1px solid #0b3d2e;background:#eef4f1;background-color:#eef4f1;padding:5px 7px;font-size:8.4pt;line-height:1.45;margin-bottom:6px">' +
      '<b style="color:#0b3d2e">ХУЛОСА.</b> ' + xulosa + '</div>' +

    '<table style="margin-bottom:5px"><tr><td style="width:49%;vertical-align:top">' +
      '<div style="font-size:7.6pt;font-weight:bold;color:#0b3d2e">Дўконлар сотуви</div>' +
      chiziq([{ qism: j.sotSoni, rang: '#0b3d2e', nom: 'Сотилган ' + j.sotSoni + ' та' }, { qism: j.bosSoni, rang: '#c8d6cf', nom: 'Бўш ' + j.bosSoni + ' та' }]) +
    '</td><td style="width:2%"></td><td style="width:49%;vertical-align:top">' +
      '<div style="font-size:7.6pt;font-weight:bold;color:#0b3d2e">Қурилиш ҳолати</div>' +
      chiziq([{ qism: h.tugal.soni, rang: '#2f7d5c', nom: 'Тугалланган ' + h.tugal.soni + ' та' }, { qism: h.qurilayotgan.soni, rang: '#d9b26a', nom: 'Якунланмаган ' + h.qurilayotgan.soni + ' та' }]) +
    '</td></tr></table>' +

    '<div class="sr">1. Сотилган дўконлар</div>' +
    '<table><tr><td style="width:49%;vertical-align:top"><table class="t">' +
      '<tr><th class="l">Кўрсаткич</th><th>Сўм</th><th>Улуши</th></tr>' +
      '<tr><td class="l">Сотилган дўконлар сони</td><td>' + j.sotSoni + ' та</td><td>' + foiz(j.sotSoni, j.soni) + '%</td></tr>' +
      '<tr><td class="l">Майдони, m²</td><td>' + m2(j.sotMaydon) + '</td><td>' + foiz(j.sotMaydon, j.maydon) + '%</td></tr>' +
      '<tr class="tot"><td class="l">Шартнома бўйича қиймати</td><td>' + pul(j.sotQiymat) + '</td><td></td></tr>' +
      q1.map((r, i) => '<tr' + (i ? ' class="sub"' : '') + '><td class="l">' + r[0] + '</td><td>' + r[1] + '</td><td>' + r[2] + '</td></tr>').join('') +
    '</table></td><td style="width:2%"></td><td style="width:49%;vertical-align:top"><table class="t">' +
      '<tr><th class="l">Қарздорлик</th><th>Сўм</th><th>Улуши</th></tr>' +
      '<tr class="tot"><td class="l">Жами қарздорлик</td><td>' + pul(j.qarz) + '</td><td>' + foiz(j.qarz, j.sotQiymat) + '%</td></tr>' +
      '<tr><td class="l qiz">&nbsp;&nbsp;— муддати ўтган</td><td class="qiz">' + pul(j.muddati) + '</td><td class="qiz">' + foiz(j.muddati, j.qarz) + '%</td></tr>' +
      '<tr><td class="l">&nbsp;&nbsp;— муддати келмаган</td><td>' + pul(j.qarz - j.muddati) + '</td><td>' + foiz(j.qarz - j.muddati, j.qarz) + '%</td></tr>' +
      '<tr><td class="l" colspan="3" style="padding:0"></td></tr>' +
      '<tr><td class="l" colspan="3" style="text-align:left;padding:4px 5px;background:#fbf3f3;background-color:#fbf3f3">' +
        'Муддати ўтган қарздорлик — жами қарзнинг <b class="qiz">' + foiz(j.muddati, j.qarz) + '%</b> и (' + mlrd(j.muddati) + ' сўм). Ундирув бўлими назоратида.</td></tr>' +
      '<tr><td class="l" colspan="3" style="padding:0"></td></tr>' +
      '<tr><th class="l">2. Бўш (сотилмаган) дўконлар</th><th>Миқдори</th><th>Улуши</th></tr>' +
      '<tr><td class="l">Сотилмаган дўконлар</td><td>' + j.bosSoni + ' та</td><td>' + foiz(j.bosSoni, j.soni) + '%</td></tr>' +
      '<tr><td class="l">Майдони, m²</td><td>' + m2(j.bosMaydon) + '</td><td>' + foiz(j.bosMaydon, j.maydon) + '%</td></tr>' +
      '<tr class="tot"><td class="l">Қиймати (прайс-лист нархида), сўм</td><td>' + pul(j.bosQiymat) + '</td><td></td></tr>' +
      '<tr class="sub"><td class="l">&nbsp;&nbsp;— қурилиши тугалланган (' + h.tugal.bosSoni + ' та)</td><td>' + pul(h.tugal.bosQiymat) + '</td><td>' + foiz(h.tugal.bosQiymat, j.bosQiymat) + '%</td></tr>' +
      '<tr class="sub"><td class="l">&nbsp;&nbsp;— қурилиши якунланмаган (' + h.qurilayotgan.bosSoni + ' та)</td><td>' + pul(h.qurilayotgan.bosQiymat) + '</td><td>' + foiz(h.qurilayotgan.bosQiymat, j.bosQiymat) + '%</td></tr>' +
    '</table></td></tr></table>' +

    '<div class="sr">3. Қурилиш ҳолати бўйича</div>' +
    '<table class="t"><tr><th class="l">Дўконлар</th><th>Сони</th><th>Майдони, m²</th><th>Сумма, сўм</th><th>Сотилган</th><th>Сотилган майдони</th>' +
      '<th>Сотилганлар қиймати</th><th>Тушум</th><th>Қарздорлиги</th></tr>' +
      qator3(h.tugal) + qator3(h.qurilayotgan) + qator3(j) + '</table>' +

    '<div class="sr">4. Ҳужжатлаштирилган дўконлар</div>' +
    '<table class="t"><tr><th class="l">Дўконлар</th><th>Сони</th><th>Майдони, m²</th><th>Сумма, сўм</th><th>Жами тўлов</th><th>Жами қолдиқ ва қарздорлик</th></tr>' +
      qator4(h.hujBor) + qator4(h.hujYoq) + qator4(hujJami) + '</table>' +

    '<div style="font-size:6.8pt;color:#555555;margin-top:5px;line-height:1.35">' +
      'Нархлаш: сотилган дўкон — шартнома қиймати, сотилмаган дўкон — прайс-лист база нархи × реал майдон. ' +
      '«Сотилган» — сотув шартномаси тузилган ва бекор қилинмаган дўкон. ' +
      '«Ҳужжатлаштирилган» — нотариал расмийлаштирилган шартнома. Пластик карта орқали қилинган тўловлар нақд тўловга қўшилган. ' +
      'Маълумот AKS ТИЗИМ базасидан автоматик олинди.</div>' +

    '<div style="margin-top:14px;font-size:8.6pt">Директор &nbsp;&nbsp;______________________&nbsp;&nbsp; ' + PDF_DIREKTOR + '</div>' +
    '<table class="ft" style="margin-top:8px"><tr><td>Шакллантирилди: ' + esc(vaqt) + ' · Юклаб олди: ' + esc(kim) + ' · AKS TIZIM</td>' +
    '<td style="text-align:right">Тизим муаллифи ва яратувчиси: ' + PDF_MUALLIF + '</td></tr></table>' +
    '</body></html>';
}

async function tasischiPdf([kodSes]) {
  const u = await S.ruxsat(kodSes);
  if (!u.admin) throw new S.Xato('Bu hisobot faqat direktor uchun.');
  if (!(await PDF.bor())) throw new S.Xato('PDF dasturi hozir ishlamayapti. Birozdan keyin urinib ko\'ring.');
  const h = await hisobla();
  const pdf = await PDF.yasa(pdfHtml(h, u.fish, hozirDmyHm()), '');
  return { nom: 'Tahliliy_malumot_' + h.sana.split('-').reverse().join('.') + '.pdf', b64: pdf.toString('base64'), sana: h.sana };
}

// ------------------------------------------------------------------ tafsilot (terminal uchun: kim, qachon, qancha)
// Sotilgan do'konlar ro'yxati (shartnoma sanasi bo'yicha) va to'lovlar ro'yxati (shakli bo'yicha). Faqat o'qiydi.
async function tafsilot() {
  const [R1, R3, R5, R2] = await Promise.all([V.qatorlar('01_Dokonlar'), V.qatorlar('03_Sotuv_shartnomalar'), V.qatorlar('05_Tolovlar'), V.qatorlar('02_Mijozlar')]);
  const MJ = {};
  R2.forEach(({ x }) => { if (x[0] != null && x[0] !== '') MJ[s(x[0])] = s(x[2]).trim(); });
  const SH = {};
  R3.forEach(({ x }) => {
    const no = s(x[0]).trim(); if (!/^27\/\d+$/.test(no)) return;
    const bekor = /bekor/i.test(s(x[13]));
    SH[no] = { no, bekor, holati: s(x[13]).trim(), sana: V.iso(x[2]), dokon: s(x[5]).trim(),
      fish: s(x[20]).trim() || MJ[s(x[4])] || '', qiymat: son(x[25]), tolangan: son(x[27]), qarz: son(x[30]), muddati: son(x[31]), dokonlar: 0 };
  });
  const sotilganlar = [];
  R1.forEach(({ n, x }) => {
    if (n < 2 || n > DOKON_OXIRI) return;
    const id = s(x[0]).trim(); if (!id) return;
    const sh = SH[s(x[17]).trim()];
    if (!sh || sh.bekor) return;
    sh.dokonlar++;
    sotilganlar.push({ dokon: id, maydon: son(x[5]), baza: son(x[6]), qurilish: s(x[7]).trim(), tugal: s(x[7]).trim() === TUGAL,
      no: sh.no, sana: sh.sana, fish: sh.fish, holati: sh.holati,
      qiymat: Math.round(sh.qiymat), tolangan: Math.round(sh.tolangan), qarz: Math.round(sh.qarz),
      bazaQiymat: Math.round(son(x[6]) * son(x[5])) });
  });
  sotilganlar.sort((a, b) => (b.sana || '').localeCompare(a.sana || '') || b.no.localeCompare(a.no));
  const tolovlar = [];
  R5.forEach(({ x }) => {
    if (x[0] == null || x[0] === '') return;
    const no = s(x[2]).trim(), sh = SH[no];
    tolovlar.push({ sana: V.iso(x[1]), no, summa: Math.round(son(x[3])), shakl: s(x[4]).trim(), guruh: shaklGuruh(x[4]),
      hujjat: s(x[5]).trim(), kim: s(x[9]).trim(), izoh: s(x[11]).trim(),
      fish: (sh && sh.fish) || MJ[s(x[12])] || '', dokon: (sh && sh.dokon) || '',
      holati: sh ? (sh.bekor ? 'BEKOR' : sh.holati) : 'shartnoma topilmadi' });
  });
  tolovlar.sort((a, b) => (a.sana || '').localeCompare(b.sana || ''));
  return { sotilganlar, tolovlar };
}

// Ilova uchun: ro'yxatlar talab bo'yicha yuklanadi (hammasini birdan yubormaslik uchun).
// tur: 'sotuv' — sotilgan do'konlar (shartnoma sanasi bo'yicha, yangisidan); yoki to'lov shakli guruhi.
async function tasischiTafsilot([kodSes, tur]) {
  const u = await S.ruxsat(kodSes);
  if (!u.admin) throw new S.Xato('Bu hisobot faqat direktor uchun.');
  const g = String(tur || '').trim();
  const { sotilganlar, tolovlar } = await tafsilot();
  if (g === 'sotuv') return { tur: g, soni: sotilganlar.length, jami: sotilganlar.reduce((a, x) => a + x.qiymat, 0), royxat: sotilganlar };
  const L = tolovlar.filter(x => x.guruh === g);
  const CHEK = 3000;
  return { tur: g, soni: L.length, jami: L.reduce((a, x) => a + x.summa, 0), kesildi: L.length > CHEK, royxat: L.slice(-CHEK).reverse() };
}

async function tasischiHisobot([kodSes]) {
  const u = await S.ruxsat(kodSes);
  if (!u.admin) throw new S.Xato('Bu hisobot faqat direktor uchun.');
  return await hisobla();
}

module.exports = { tasischiHisobot, tasischiPdf, tasischiTafsilot };
module.exports._ichki = { hisobla, pdfHtml, hozirDmyHm, tafsilot };
