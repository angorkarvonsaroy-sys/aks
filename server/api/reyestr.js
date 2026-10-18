// AKS TIZIM — 📋 Reyestrlar (Reyestr.gs v27.7) serverda: reyestrIjara, reyestrSotuv — onlayn ro'yxat. Faqat o'qiydi; natija eski tizim bilan bir xil.
// Yuklab olish (reyestrPdf, reyestrExcel, reyestrSotuvPdf, reyestrSotuvExcel): HTML matni va Excel qatorlari eski kod bilan bir xil;
// PDF — WeasyPrint (lib/pdf.js), Excel — lib/xlsx.js. Faqat «aks-yozuv-sinov eksport» eski tizim fayllari bilan solishtirgach yoqiladi
// (Redis yozuv_yondi:eksport); yoqilmagan bo'lsa yoki PDF dasturi yo'q bo'lsa — avvalgidek eski tizim orqali.
'use strict';
const S = require('./sessiya');
const V = require('../lib/varaq');
const KR = require('../lib/korinish');   // shartnoma holati bo'yicha ko'rinish (18.10.2026)
const koprik = require('./koprik');
const PDF = require('../lib/pdf');
const XL = require('../lib/xlsx');
const { redis } = require('../lib/db');

const REY_SOT_HOLAT = ['Aktiv', 'Kredit asosida', 'Shartnoma olmagan', 'Yakunlangan'];
function aOxiri(rows) { let m = 0; rows.forEach(({ n, x }) => { if (x[0] !== null && x[0] !== undefined && x[0] !== '') m = n; }); return rows.filter(z => z.n <= m); }
const kor = (r, n) => { const o = []; for (let i = 0; i < n; i++) o.push(r[i] == null ? '' : String(r[i])); return o; };
async function mijozlar() {
  const MIJ = {};
  aOxiri(await V.qatorlar('02_Mijozlar')).map(z => kor(z.r, 5)).forEach(r => { if (r[0]) MIJ[String(r[0])] = { fish: r[2], tel: r[4] }; });
  return MIJ;
}

async function reyestrIjara([kodSes]) {
  const u = await S.ruxsat(kodSes, 'reyestr');
  const k = await KR.korish(u);
  const [MIJ, R4] = await Promise.all([mijozlar(), V.qatorlar('04_Ijara_shartnomalar')]);
  const L = [];
  aOxiri(R4).map(z => kor(z.r, 29)).forEach(r => {
    const no = String(r[0] || '').trim(); if (!/^IJ-27\/\d+$/.test(no)) return;
    if (!k(r[2], '', no)) return;
    const m = MIJ[String(r[5]).trim()] || {};
    L.push({ no, sana: r[1], holati: String(r[2] || ''), dokon: String(r[4] || ''), mid: String(r[5] || ''),
      fish: String(r[23] || m.fish || ''), tel: String(r[24] || m.tel || ''),
      bosh: r[9], tugash: r[10], m2: Number(String(r[25]).replace(',', '.').replace(/[^\d.]/g, '')) || 0,
      oylik: Number(String(r[14]).replace(/\D/g, '')) || 0, bepul: Number(String(r[12]).replace(/\D/g, '')) || 0, bepulTugash: String(r[28] || ''),
      faoliyat: String(r[18] || '') });
  });
  L.sort((a, b) => (Number(b.no.replace(/\D/g, '')) || 0) - (Number(a.no.replace(/\D/g, '')) || 0));
  const faol = L.filter(x => !/bekor/i.test(x.holati));
  return { ok: true, royxat: L, admin: u.admin,
    jami: { faol: faol.length, bekor: L.length - faol.length, oylik: faol.reduce((a, x) => a + x.oylik, 0), maydon: Math.round(faol.reduce((a, x) => a + x.m2, 0) * 100) / 100,
      bepul: faol.filter(x => !x.oylik && x.bepul).length } };
}

async function reyestrSotuv([kodSes]) {
  const u = await S.ruxsat(kodSes, 'reyestr');
  const k = await KR.korish(u);
  const [MIJ, R3] = await Promise.all([mijozlar(), V.qatorlar('03_Sotuv_shartnomalar')]);
  const num = v => Number(String(v == null ? '' : v).replace(/\s/g, '').replace(',', '.')) || 0;
  const L = [];
  aOxiri(R3).map(z => kor(z.r, 33)).forEach(r => {
    const no = String(r[0] || '').trim(); if (!/^27\/\d+$/.test(no)) return;
    if (REY_SOT_HOLAT.indexOf(String(r[13] || '').trim()) < 0) return;
    if (!k(r[13], r[17], no)) return;
    const m = MIJ[String(r[4]).trim()] || {};
    L.push({ no, sana: r[2], mid: String(r[4] || ''), dokon: String(r[5] || ''), m2: num(r[6]), holati: String(r[13] || ''), undiruvchi: String(r[17] || ''),
      fish: String(r[20] || m.fish || ''), tel: String(m.tel || ''), qiymat: num(r[25]), oylik: num(r[26]), tolangan: num(r[27]), qarz: num(r[30]), muddati: num(r[31]), kechikkan: num(r[32]) });
  });
  L.sort((a, b) => (Number(b.no.replace(/\D/g, '')) || 0) - (Number(a.no.replace(/\D/g, '')) || 0));
  const f = L, son = {}; L.forEach(x => son[x.holati] = (son[x.holati] || 0) + 1);
  return { ok: true, royxat: L, admin: u.admin, son, yopilmagan: L.filter(x => x.holati !== 'Yakunlangan' && x.qarz <= 0).length, jami: { faol: f.length,
    qiymat: f.reduce((a, x) => a + x.qiymat, 0), tolangan: f.reduce((a, x) => a + x.tolangan, 0), qarz: f.reduce((a, x) => a + x.qarz, 0), muddati: f.reduce((a, x) => a + x.muddati, 0), maydon: Math.round(f.reduce((a, x) => a + x.m2, 0) * 100) / 100 } };
}

// ------------------------------------------------------------------ yuklab olish (PDF, Excel)
const TAM_MCHJ = '«ANGOR KARVON SAROY» МЧЖ';
const tamPul = n => { const v = Math.round(Number(n) || 0); return (v < 0 || Object.is(v, -0) ? '-' : '') + String(Math.abs(v)).replace(/\B(?=(\d{3})+(?!\d))/g, ' '); };   // tamPul_
const tamEsc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
function tamHtmlBosh() {
  return '<!DOCTYPE html><html><head><meta charset="utf-8"><style>' +
    'body{font-family:"Liberation Serif","Times New Roman",serif;font-size:14px;line-height:1.55;color:#000;margin:36px 44px}' +
    'h1{text-align:center;font-size:16px;margin:0 0 2px}.sub{text-align:center;font-size:13px;margin-bottom:14px}' +
    '.sana{display:flex;justify-content:space-between;margin:12px 0}' +
    'p{text-align:justify;text-indent:28px;margin:8px 0}' +
    'table{width:100%;border-collapse:collapse;font-size:12.5px;margin:10px 0}td,th{border:1px solid #000;padding:5px 7px}th{background:#efefef}' +
    '.r{text-align:right}.c{text-align:center}' +
    '.imzo{display:flex;justify-content:space-between;margin-top:34px;gap:26px}.imzo>div{width:48%;font-size:12.5px;line-height:1.6}' +
    '.k{font-size:11px}</style></head><body>';
}
// reyKiril_: lotin (o'zbek) → kirill. Kirill harfi bor matn o'zgarmaydi.
function reyKiril(s) {
  s = String(s || '');
  if (!s || /[\u0400-\u04FF]/.test(s)) return s;
  const katta = s === s.toUpperCase();
  const t = s.toLowerCase().replace(/[`ʻʼ’‘]/g, "'");
  const B = { a: 'а', b: 'б', d: 'д', e: 'е', f: 'ф', g: 'г', h: 'ҳ', i: 'и', j: 'ж', k: 'к', l: 'л', m: 'м', n: 'н', o: 'о', p: 'п', q: 'қ', r: 'р', s: 'с', t: 'т', u: 'у', v: 'в', x: 'х', y: 'й', z: 'з', c: 'с', w: 'в' };
  let o = '';
  for (let i = 0; i < t.length; i++) {
    const c = t[i], n = t[i + 1] || '', p = i ? t[i - 1] : ' ', bosh = !/[a-z']/.test(p);
    if ((c === 'o' || c === 'g') && n === "'") { o += c === 'o' ? 'ў' : 'ғ'; i++; continue; }
    if (c === 's' && n === 'h') { o += 'ш'; i++; continue; }
    if (c === 'c' && n === 'h') { o += 'ч'; i++; continue; }
    if (c === 'k' && n === 'h') { o += 'х'; i++; continue; }
    if (c === 'z' && n === 'h') { o += 'ж'; i++; continue; }
    if (c === 'y' && n === 'o') { o += 'ё'; i++; continue; }
    if (c === 'y' && n === 'u') { o += 'ю'; i++; continue; }
    if (c === 'y' && n === 'a') { o += 'я'; i++; continue; }
    if (c === 'y' && n === 'e') { o += 'е'; i++; continue; }
    if (c === 'e') { o += bosh ? 'э' : 'е'; continue; }
    if (c === "'") { if (/[sc]/.test(p) && n === 'h') continue; o += /[a-z]/.test(p) && !bosh ? 'ъ' : "'"; continue; }
    o += B[c] !== undefined ? B[c] : c;
  }
  return katta ? o.toUpperCase() : o.replace(/(^|[\s\-"«(])([а-яўқғҳёэ])/g, (m, a, b) => a + b.toUpperCase());
}
function reyTel(t) {   // «94 227 01 06» → «+998 94 227-01-06»
  const d = String(t || '').replace(/\D/g, '').replace(/^998(?=\d{9}$)/, '');
  return d.length === 9 ? '+998 ' + d.slice(0, 2) + ' ' + d.slice(2, 5) + '-' + d.slice(5, 7) + '-' + d.slice(7) : String(t || '—');
}
function reyFiltr(L, filtr) {
  if (filtr === 'bekor') return L.filter(x => /bekor/i.test(x.holati));
  if (filtr === 'hammasi') return L;
  return L.filter(x => !/bekor/i.test(x.holati));
}
function reySotFiltr(L, filtr) {
  const H = { aktiv: 'Aktiv', kredit: 'Kredit asosida', olmagan: 'Shartnoma olmagan', yakun: 'Yakunlangan' };
  if (H[filtr]) return L.filter(x => x.holati === H[filtr]);
  if (filtr === 'qarz') return L.filter(x => x.muddati > 0);
  if (filtr === 'yopilmagan') return L.filter(x => x.holati !== 'Yakunlangan' && x.qarz <= 0);
  return L;
}
const BOSH_XATO = 'Ro\'yxat bo\'sh — bu filtrda shartnoma yo\'q.';
const bugunDmy = () => V.bugun().split('-').reverse().join('.');
const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
// Eski HTML'da sahifa o'lchami yo'q (Google o'zgartirgichi A4 qo'yardi); chap/o'ng chekka — body margin.
// Google o'zgartirgichi ustun kengligini o'zgartirmaydi: sig'magan matn (uzun telefon, «B1-1-6,7,8,15,16,17» kabi do'kon) katak ichida
// keyingi qatorga o'tadi. Aks holda jadval sahifadan kengayib, oxirgi ustun («Ундирувчи») kesilib qoladi (18.10 sinovi).
const SAHIFA = '@page{size:A4;margin:10mm 0}table{table-layout:fixed}td,th{white-space:normal!important;overflow-wrap:anywhere}';

// Eski kod (reyestrPdf) yasaydigan HTML — belgima-belgi bir xil
function ijaraHtml(L, filtr, bugun) {
  const sarl = filtr === 'bekor' ? 'БЕКОР ҚИЛИНГАН ИЖАРА ШАРТНОМАЛАРИ' : filtr === 'hammasi' ? 'ИЖАРА ШАРТНОМАЛАРИ (БАРЧАСИ)' : 'АМАЛДАГИ ИЖАРА ШАРТНОМАЛАРИ';
  let jad = '<table><tr><th class="c" style="width:22px">№</th><th style="width:62px">Шартнома</th><th>Ижарачи (Ф.И.Ш.)</th><th class="c" style="width:86px">Телефон</th><th class="c" style="width:52px">Дўкон</th><th class="c" style="width:38px">м²</th><th class="c" style="width:56px">Ойлик</th><th class="c" style="width:70px">Муддат</th><th style="width:92px">Фаолият</th></tr>';
  let oylik = 0, maydon = 0, bepulSoni = 0;
  L.forEach((x, i) => { const bek = /bekor/i.test(x.holati);
    if (!bek) { oylik += x.oylik; maydon += x.m2; if (!x.oylik && x.bepul) bepulSoni++; }
    const oyl = x.oylik ? tamPul(x.oylik) : (x.bepul ? 'бепул<br><span style="font-size:9px">' + x.bepul + ' ой' + (x.bepulTugash && x.bepulTugash !== x.tugash ? ', ' + tamEsc(x.bepulTugash) + ' гача' : '') + '</span>' : '—');
    jad += '<tr' + (bek ? ' style="color:#777"' : '') + '><td class="c">' + (i + 1) + '</td><td>' + x.no + (bek ? '<br><span style="font-size:9px">(бекор)</span>' : '') + '</td><td>' + tamEsc(reyKiril(x.fish).toUpperCase()) + '</td><td class="c" style="white-space:nowrap">' + tamEsc(reyTel(x.tel)) + '</td><td class="c">' + tamEsc(x.dokon) + '</td><td class="c">' + (x.m2 ? String(x.m2).replace('.', ',') : '') + '</td><td class="c">' + oyl + '</td><td class="c">' + tamEsc(x.bosh) + '—<br>' + tamEsc(x.tugash) + '</td><td>' + tamEsc(x.faoliyat) + '</td></tr>'; });
  jad += '</table>';
  return tamHtmlBosh().replace('font-size:14px', 'font-size:12px').replace('margin:36px 44px', 'margin:24px 22px')
      .replace('table{width:100%;border-collapse:collapse;font-size:12.5px;', 'tr{page-break-inside:avoid}table{width:100%;border-collapse:collapse;font-size:11px;').replace('padding:5px 7px', 'padding:4px 4px').replace('line-height:1.55', 'line-height:1.3') +
    '<h1>«ANGOR KARVON SAROY» МЧЖ</h1><h1>' + sarl + ' РЕЕСТРИ</h1>' +
    '<div class="sub">' + bugun + ' ҳолатига</div>' + jad +
    '<p style="text-indent:0"><b>Жами:</b> ' + L.filter(x => !/bekor/i.test(x.holati)).length + ' та амалдаги шартнома · умумий майдон <b>' + String(Math.round(maydon * 100) / 100).replace('.', ',') + '</b> м²'
      + (bepulSoni ? ' · шундан бепул даврда: <b>' + bepulSoni + '</b> та' : '') + (oylik ? ' · ойлик ижара жами <b>' + tamPul(oylik) + '</b> сўм' : '') + '.</p>' +
    '<div class="imzo"><div></div><div>' + TAM_MCHJ + '<br>директори<br><br>_______________ ҲАЙДАРОВ К.</div></div></body></html>';
}
function sotuvHtml(L, filtr, bugun) {
  const sarl = { aktiv: 'АКТИВ СОТУВ ШАРТНОМАЛАРИ', kredit: 'КРЕДИТ АСОСИДАГИ СОТУВ ШАРТНОМАЛАРИ', olmagan: 'ШАРТНОМА ОЛМАГАН МИЖОЗЛАР', yakun: 'ЯКУНЛАНГАН СОТУВ ШАРТНОМАЛАРИ',
    qarz: 'МУДДАТИ ЎТГАН ҚАРЗИ БОР СОТУВ ШАРТНОМАЛАРИ', yopilmagan: 'ТЎЛИҚ ТЎЛАНГАН, ҲОЛАТИ ЁПИЛМАГАН ШАРТНОМАЛАР' }[filtr] || 'СОТУВ ШАРТНОМАЛАРИ';
  let jad = '<table><tr><th class="c" style="width:20px">№</th><th style="width:48px">Шарт.</th><th>Харидор (Ф.И.Ш.)</th><th class="c" style="width:82px">Телефон</th><th class="c" style="width:50px">Дўкон</th><th class="c" style="width:34px">м²</th><th class="r" style="width:76px">Қиймати</th><th class="r" style="width:72px">Тўланган</th><th class="r" style="width:70px">Қарз</th><th class="r" style="width:62px">Муддати ўтган</th><th class="c" style="width:30px">Кун</th><th style="width:62px">Ундирувчи</th></tr>';
  let q = 0, t = 0, z = 0, m = 0;
  const HQ = { 'Kredit asosida': 'кредит', 'Shartnoma olmagan': 'шартн. олмаган', 'Yakunlangan': 'якунланган' };
  L.forEach((x, i) => { q += x.qiymat; t += x.tolangan; z += x.qarz; m += x.muddati;
    jad += '<tr><td class="c">' + (i + 1) + '</td><td>' + x.no + (HQ[x.holati] ? '<br><span style="font-size:8px">(' + HQ[x.holati] + ')</span>' : '') + '</td><td>' + tamEsc(reyKiril(x.fish).toUpperCase()) + '</td><td class="c" style="white-space:nowrap">' + tamEsc(reyTel(x.tel)) + '</td><td class="c">' + tamEsc(x.dokon) + '</td><td class="c">' + (x.m2 ? String(x.m2).replace('.', ',') : '') + '</td><td class="r">' + tamPul(x.qiymat) + '</td><td class="r">' + tamPul(x.tolangan) + '</td><td class="r">' + tamPul(x.qarz) + '</td><td class="r' + (x.muddati ? ' style="color:#B42318"' : '') + '">' + (x.muddati ? tamPul(x.muddati) : '—') + '</td><td class="c">' + (x.kechikkan || '') + '</td><td>' + tamEsc(reyKiril(x.undiruvchi).split(' ')[0]) + '</td></tr>'; });
  jad += '</table>';
  return tamHtmlBosh().replace('font-size:14px', 'font-size:11px').replace('margin:36px 44px', 'margin:22px 18px')
      .replace('table{width:100%;border-collapse:collapse;font-size:12.5px;', 'tr{page-break-inside:avoid}table{width:100%;border-collapse:collapse;font-size:9.5px;').replace('padding:5px 7px', 'padding:3px 3px').replace('line-height:1.55', 'line-height:1.25') +
    '<h1>«ANGOR KARVON SAROY» МЧЖ</h1><h1>' + sarl + ' РЕЕСТРИ</h1><div class="sub">' + bugun + ' ҳолатига</div>' + jad +
    '<p style="text-indent:0;font-size:11px"><b>Жами:</b> ' + L.length + ' та шартнома · қиймати <b>' + tamPul(q) + '</b> · тўланган <b>' + tamPul(t) + '</b> · қарз <b>' + tamPul(z) + '</b> · шундан муддати ўтган <b style="color:#B42318">' + tamPul(m) + '</b> сўм.</p>' +
    '<div class="imzo"><div></div><div>' + TAM_MCHJ + '<br>директори<br><br>_______________ ҲАЙДАРОВ К.</div></div></body></html>';
}
// Eski kod (reyestrExcel / reyestrSotuvExcel) vaqtinchalik jadvalga yozadigan qatorlar va formatlar
function ijaraJadval(L) {
  const sarl = ['Shartnoma', 'Ijarachi F.I.Sh.', 'Telefon', 'Dokon', 'Maydon m2', 'Oylik, som', 'Bepul oy', 'Bepul tugash', 'Boshlanish', 'Tugash', 'Faoliyat', 'Holati', 'Mijoz ID'];
  const rows = L.map(x => [x.no, x.fish, x.tel, x.dokon, x.m2, x.oylik, x.bepul || '', x.bepulTugash, x.bosh, x.tugash, x.faoliyat, x.holati, x.mid]);
  return { nom: 'Reyestr', qatorlar: [sarl].concat(rows), sarlavha: true, muzlat: 1, ustunFormat: { 0: '@' }, oraliqFormat: [] };
}
function sotuvJadval(L) {
  const sarl = ['Shartnoma', 'Sana', 'Xaridor F.I.Sh.', 'Telefon', 'Dokon', 'Maydon m2', 'Qiymati', 'Oylik', 'Tolangan', 'Jami qarz', 'Muddati otgan', 'Kechikkan kun', 'Undiruvchi', 'Holati', 'Mijoz ID'];
  const rows = L.map(x => [x.no, x.sana, x.fish, x.tel, x.dokon, x.m2, x.qiymat, x.oylik, x.tolangan, x.qarz, x.muddati, x.kechikkan, x.undiruvchi, x.holati, x.mid]);
  return { nom: 'Sotuv reyestri', qatorlar: [sarl].concat(rows), sarlavha: true, muzlat: 1, ustunFormat: { 0: '@' }, oraliqFormat: [{ q1: 1, q2: rows.length, u1: 6, u2: 10, f: '#,##0' }] };
}

async function yoqilgan(pdf) {
  try { if ((await redis.get('yozuv_yondi:eksport')) !== '1') return false; } catch (e) { return false; }
  return pdf ? PDF.bor() : true;
}
const eskiTizim = (fn, u, filtr) => koprik.chaqir(fn, u.kod, [filtr]);

// Yadro (sinov ham shuni ishlatadi): kodSes huquqi bilan ro'yxat → fayl
async function ijaraPdfYasa(kodSes, filtr) {
  const L = reyFiltr((await reyestrIjara([kodSes])).royxat, filtr);
  if (!L.length) throw new S.Xato(BOSH_XATO);
  const bugun = bugunDmy(), pdf = await PDF.yasa(ijaraHtml(L, filtr, bugun), SAHIFA);
  return { ok: true, b64: pdf.toString('base64'), nom: 'Ijara_reyestri_' + bugun.replace(/\./g, '-') + '.pdf', mime: 'application/pdf' };
}
async function ijaraExcelYasa(kodSes, filtr) {
  const L = reyFiltr((await reyestrIjara([kodSes])).royxat, filtr);
  if (!L.length) throw new S.Xato(BOSH_XATO);
  const bugun = bugunDmy();
  return { ok: true, b64: XL.yasa(ijaraJadval(L)).toString('base64'), nom: 'Ijara_reyestri_' + bugun.replace(/\./g, '-') + '.xlsx', mime: XLSX_MIME };
}
async function sotuvPdfYasa(kodSes, filtr) {
  const L = reySotFiltr((await reyestrSotuv([kodSes])).royxat, filtr);
  if (!L.length) throw new S.Xato(BOSH_XATO);
  const bugun = bugunDmy(), pdf = await PDF.yasa(sotuvHtml(L, filtr, bugun), SAHIFA);
  return { ok: true, b64: pdf.toString('base64'), nom: 'Sotuv_reyestri_' + bugun.replace(/\./g, '-') + '.pdf', mime: 'application/pdf' };
}
async function sotuvExcelYasa(kodSes, filtr) {
  const L = reySotFiltr((await reyestrSotuv([kodSes])).royxat, filtr);
  if (!L.length) throw new S.Xato(BOSH_XATO);
  const bugun = bugunDmy();
  return { ok: true, b64: XL.yasa(sotuvJadval(L)).toString('base64'), nom: 'Sotuv_reyestri_' + bugun.replace(/\./g, '-') + '.xlsx', mime: XLSX_MIME };
}

async function reyestrPdf([kodSes, filtr]) {
  const u = await S.ruxsat(kodSes, 'reyestr');
  if (!(await yoqilgan(true))) return eskiTizim('reyestrPdf', u, filtr);
  return ijaraPdfYasa(kodSes, filtr);
}
async function reyestrExcel([kodSes, filtr]) {
  const u = await S.ruxsat(kodSes, 'reyestr');
  if (!(await yoqilgan(false))) return eskiTizim('reyestrExcel', u, filtr);
  return ijaraExcelYasa(kodSes, filtr);
}
async function reyestrSotuvPdf([kodSes, filtr]) {
  const u = await S.ruxsat(kodSes, 'reyestr');
  if (!(await yoqilgan(true))) return eskiTizim('reyestrSotuvPdf', u, filtr);
  return sotuvPdfYasa(kodSes, filtr);
}
async function reyestrSotuvExcel([kodSes, filtr]) {
  const u = await S.ruxsat(kodSes, 'reyestr');
  if (!(await yoqilgan(false))) return eskiTizim('reyestrSotuvExcel', u, filtr);
  return sotuvExcelYasa(kodSes, filtr);
}

module.exports = { reyestrIjara, reyestrSotuv, reyestrPdf, reyestrExcel, reyestrSotuvPdf, reyestrSotuvExcel };
module.exports._ichki = { ijaraHtml, sotuvHtml, ijaraJadval, sotuvJadval, reyFiltr, reySotFiltr, reyKiril, reyTel, tamPul,
  ijaraPdfYasa, ijaraExcelYasa, sotuvPdfYasa, sotuvExcelYasa, SAHIFA };
