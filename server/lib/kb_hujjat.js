// AKS TIZIM — 🤝 IJARA SHARTNOMASINI O'ZARO KELISHUV BILAN BEKOR QILISH: hujjat va tekshiruv serverda (KelishuvBekor.gs v1.0 kbTekshir_ / kbHujjat_
// va yordamchilari bilan aynan bir xil matn, tartib, xato va ogohlantirishlar).
//   kbTekshir(no, ozId, R06m) — shartlar (04 Aktiv, MChJ, imzolangan skan bor, 06h ochiq so'rov yo'q, 06m ochiq so'rov yo'q) va hujjat uchun
//     ma'lumot: 04 + 02 (pasport, JSHSHIR, manzil, yuridik shaxs) + 01 (do'kon). Bazaga yozmaydi. 04/02/01/06d/06h — ko'zgu, 06m — chaqiruvchi beradi (Google'dan yangi).
//   kbHujjat(x, D, nom) — BITTA hujjat: 1-varaq «Келишув», 2-varaq «Дўконни қабул қилиш-топшириш далолатномаси» — eski DocumentApp kodi
//     lib/docs_model.js yozuvchisida (o'zgarishsiz), PDF — lib/docs_pdf.js (Docs chizgichi bilan bir xil joylashuv), Word — lib/docs_docx.js.
'use strict';
const V = require('./varaq');
const J = require('./jurnallar');
const DM = require('./docs_model');
const DP = require('./docs_pdf');
const DX = require('./docs_docx');
const { xatKirill } = require('./ism');

const KB_VARAQ = '06m_Kelishuv_bekor';
const KB_SARLAVHA = ['ID', 'Vaqt', 'Shartnoma_№', 'Mijoz_FISH', 'Dokon_ID', 'Sabab', 'Bekor_sana', 'Elektr_qarz', 'Kalitlar', 'Hisoblagich',
  'Dokon_holati', 'Holat_izoh', 'Holati', 'PDF_ID', 'DOC_ID', 'Skan_ID', 'Skan_vaqt', 'Skan_kim', 'Kim', 'Javob', 'Javob_vaqt', 'Javob_kim', 'Tarix', 'Skan_sahifa'];
const KB_HUQUQ = 'ijara_kelishuv';
const KB_OCHIQ = ['Hujjat tayyorlandi', 'Tasdiq kutilmoqda', 'Rad etildi'];
const KB_QARZ_KUN = 10;                       // elektr qarzi bo'lsa — kelishuvdan keyin shuncha kun ichida to'lanadi
const KB_PAPKA = ['AKS TIZIM', '07 BEKOR QILISH', 'Kelishuv'];
const KB_MCHJ = { nom: '«ANGOR KARVON SAROY» МЧЖ', dir: 'Ҳайдаров Камолиддин Ҳайдарович', dirQ: 'К.Ҳ.Ҳайдаров',
  manzil: 'Сурхондарё вилояти, Ангор тумани, Гулистон МФЙ, Ат-Термизий кўчаси, 198-уй', bank: 'АТ «Халқ банк» Термиз шаҳар филиали',
  hr: '20208000305390706001', mfo: '01125', stir: '308 489 492', tel: '+998 95-557-88-88' };
const KB_OY = ['январ', 'феврал', 'март', 'апрел', 'май', 'июн', 'июл', 'август', 'сентябр', 'октябр', 'ноябр', 'декабр'];
const BEKOR_YOPIQ = ['Bekor qilindi', 'Rad etildi', 'Qaytarildi'];

class Xato extends Error {}
const s = v => String(v == null ? '' : v);
const T = v => s(v).trim();
// getValues dagi Date → 'yyyy-MM-dd' (eski iso): faqat sana katagi (xom seriya raqami); matn bo'lib yozilgan sana — '' (eski tizimdagidek)
const isoX = v => typeof v === 'number' ? V.iso(v) : '';
const xom = (x, n) => { const o = []; for (let i = 0; i < n; i++) o.push(x[i] == null ? '' : x[i]); return o; };
function aOxiri(rows) { let m = 0; rows.forEach(({ n, x }) => { if (x[0] !== null && x[0] !== undefined && x[0] !== '') m = n; }); return rows.filter(z => z.n <= m); }
function bugunIso(qosh) { const d = new Date(Date.now() + 5 * 3600 * 1000 + (qosh || 0) * 86400000); return d.toISOString().slice(0, 10); }

// ------------------------------------------------------------------ yordamchilar (KelishuvBekor.gs bilan bir xil)
function kbHuquq(u) { const h = u.huquq || []; return h.indexOf('admin') >= 0 || h.indexOf(KB_HUQUQ) >= 0; }
function kbAdmin(u) { return (u.huquq || []).indexOf('admin') >= 0; }
function kbFam(fish) { return (s(fish).replace(/["«»'`ʻʼ‘’“”]/g, '').trim().split(/\s+/)[0] || 'Ijarachi').replace(/[\\/:*?<>|]/g, ''); }
function kbQisqa(fish) {   // «Юсупова Насиба Равшановна» → «Н.Р.Юсупова»
  const w = s(fish).trim().split(/\s+/); if (w.length < 2) return s(fish);
  return w.slice(1, 3).map(z => z.charAt(0) + '.').join('') + w[0];
}
// Gap (xodim yozgan izoh) — lotin harflari kirillga, katta-kichik harf saqlanadi; kirill va raqamlar o'zgarmaydi
function kbLotin(matn) {
  let t = s(matn);
  if (!/[A-Za-z]/.test(t)) return t;
  t = t.replace(/([OoGg])['`ʻʼ‘’]/g, (m, h) => ({ O: 'Ў', o: 'ў', G: 'Ғ', g: 'ғ' })[h]);
  [['SH', 'Ш'], ['Sh', 'Ш'], ['sh', 'ш'], ['CH', 'Ч'], ['Ch', 'Ч'], ['ch', 'ч'], ['YO', 'Ё'], ['Yo', 'Ё'], ['yo', 'ё'], ['YU', 'Ю'], ['Yu', 'Ю'], ['yu', 'ю'],
    ['YA', 'Я'], ['Ya', 'Я'], ['ya', 'я'], ['YE', 'Е'], ['Ye', 'Е'], ['ye', 'е']].forEach(p => { t = t.split(p[0]).join(p[1]); });
  t = t.replace(/(^|[^A-Za-zЀ-ӿ])E/g, '$1Э').replace(/(^|[^A-Za-zЀ-ӿ])e/g, '$1э');
  t = t.replace(/(\S)['`ʻʼ‘’](?=[A-Za-zЀ-ӿ])/g, '$1ъ');
  const B = { A: 'А', B: 'Б', C: 'С', D: 'Д', E: 'Е', F: 'Ф', G: 'Г', H: 'Ҳ', I: 'И', J: 'Ж', K: 'К', L: 'Л', M: 'М', N: 'Н', O: 'О', P: 'П', Q: 'Қ', R: 'Р', S: 'С', T: 'Т', U: 'У', V: 'В', W: 'В', X: 'Х', Y: 'Й', Z: 'З' };
  return t.replace(/[A-Za-z]/g, c => { const k = B[c.toUpperCase()]; return c === c.toUpperCase() ? k : k.toLowerCase(); });
}
function kbKir(v) { v = s(v).trim(); return v ? xatKirill(v) : v; }
function kbTel(t) {
  const d = s(t).replace(/\D/g, '').replace(/^998(?=\d{9}$)/, '');
  return d.length === 9 ? '+998 ' + d.slice(0, 2) + '-' + d.slice(2, 5) + '-' + d.slice(5, 7) + '-' + d.slice(7) : s(t).trim();
}
function kbS(v) { return s(v).replace(/[​-‍﻿]/g, '').replace(/\s+/g, ' ').trim(); }
function kbPul(n) { return String(Math.round(Number(n) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ' '); }
function kbM2(n) { return String(Math.round((Number(n) || 0) * 100) / 100).replace('.', ','); }
function kbDmy(iso) { const p = s(iso).split('-'); return p.length === 3 ? p[2] + '.' + p[1] + '.' + p[0] : s(iso); }
function kbSoz(iso) { const p = s(iso).split('-'); return p.length === 3 ? p[0] + ' йил ' + Number(p[2]) + ' ' + KB_OY[Number(p[1]) - 1] : s(iso); }   // 2026 йил 9 октябр
function kbSozDa(iso) { return kbSoz(iso) + 'да'; }
function kbSanaQ(iso) { const p = s(iso).split('-'); return p.length === 3 ? p[0] + ' йил «' + p[2] + '» ' + KB_OY[Number(p[1]) - 1] : ''; }   // 2026 йил «09» октябр
function kbKunQosh(iso, n) { const d = new Date(iso + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
function kbSonSoz(n) {
  const B = ['нол', 'бир', 'икки', 'уч', 'тўрт', 'беш', 'олти', 'етти', 'саккиз', 'тўққиз'], O = ['', 'ўн', 'йигирма', 'ўттиз', 'қирқ', 'эллик', 'олтмиш', 'етмиш', 'саксон', 'тўқсон'];
  n = Number(n) || 0; if (n < 10) return B[n];
  return O[Math.floor(n / 10)] + (n % 10 ? ' ' + B[n % 10] : '');
}
// Manzil — 02 ning N..S qismlaridan (ijaraPdf dagi kabi), lotin qismlar kirillga; bo'lmasa Z (to'liq manzil)
function kbManzil(m) {
  const Tn = v => (typeof v === 'number' && v === Math.round(v)) ? String(v) : s(v).trim().replace(/^(\d+)\.0$/, '$1');
  const toza = (v, re) => Tn(v).replace(re, '').trim();
  const vil = toza(m[13], /\s*(вилояти|viloyati)\s*$/i), tum = Tn(m[14]), mfy = toza(m[15], /\s*(МФЙ|MFY)\s*$/i), koc = toza(m[16], /\s*(кўчаси|ko['`ʻ‘’]?chasi|kochasi)\s*$/i),
    uy = toza(m[17], /\s*-?\s*(уй|uy)\s*$/i), xon = toza(m[18], /\s*-?\s*(хонадон|xonadon)\s*$/i);
  const q = [vil ? kbKir(vil) + ' вилояти' : '', kbKir(tum), mfy ? kbKir(mfy) + ' МФЙ' : '', koc ? kbKir(koc) + ' кўчаси' : '', uy ? uy + '-уй' : '', xon ? xon + '-хонадон' : ''].filter(Boolean);
  return q.length >= 3 ? q.join(', ') : Tn(m[25]).replace(/(\d+)\.0(-уй)/g, '$1$2');
}
// 07_Xodimlar: C — kirillcha to'liq ism (kbXodimIsm_)
async function kbXodimIsm(fish) {
  try {
    const r = aOxiri(await V.qatorlar('07_Xodimlar')).map(z => z.x).find(z => s(z[1]).trim() === s(fish).trim());
    if (r && s(r[2]).trim()) return s(r[2]).trim().replace(/\s+/g, ' ');
  } catch (e) { }
  return kbKir(fish);
}
// 06m qatorlari (kbRows_ — getDisplayValues). rows: [{ qator, r }] (ko'zgu yoki Google'dan yangi)
function kbRowsDan(rows) {
  return rows.map(({ qator, r: r0 }) => { const r = []; for (let i = 0; i < KB_SARLAVHA.length; i++) r.push(s(r0[i]));
    return { qator, id: r[0], vaqt: r[1], no: r[2].trim(), fish: r[3], dokon: r[4], sabab: r[5], sana: r[6], qarz: r[7].trim() === 'Йўқ' ? 'Йўқ' : r[7].replace(/\D/g, ''), kalit: r[8], hisob: r[9],
      holat: r[10], izoh: r[11], holati: r[12], pdf: r[13], doc: r[14], skan: r[15], skanVaqt: r[16], skanKim: r[17], kim: r[18], javob: r[19], javobVaqt: r[20], javobKim: r[21], tarix: r[22], sahifa: r[23] }; })
    .filter(z => z.id);
}
async function kbRowsKozgu() { return kbRowsDan(aOxiri(await V.qatorlar(KB_VARAQ)).map(z => ({ qator: z.n, r: z.r }))); }

// ------------------------------------------------------------------ kbTekshir_: shartlar + hujjat ma'lumotlari (04 + 02 + 01). R06m — 06m qatorlari (kbRowsDan)
// opt.tekshirma — shartlar tekshirilmaydi, faqat hujjat ma'lumoti (sinov: eski so'rov hujjatini qayta yasash)
async function kbTekshir(no, ozId, R06m, opt = {}) {
  no = s(no).trim();
  if (!/^IJ-27\/\d+$/.test(no)) throw new Xato('Bu yo\'l faqat ijara shartnomasi (IJ-27/…) uchun: ' + no);
  const V4 = aOxiri(await V.qatorlar('04_Ijara_shartnomalar')).map(z => ({ n: z.n, r: xom(z.x, 29) }));
  const top = []; V4.forEach((z, i) => { if (s(z.r[0]).trim() === no) top.push(i); });
  if (!top.length) throw new Xato('Ijara shartnomasi topilmadi: ' + no);
  if (top.length > 1) throw new Xato(no + ' raqami 04 da ' + top.length + ' marta uchraydi — avval bazada qo\'lda tekshiring.');
  const r = V4[top[0]].r;
  if (!opt.tekshirma) {
    const holati = s(r[2]).trim();
    if (holati !== 'Aktiv') throw new Xato(no + ' holati «' + (holati || 'bo\'sh') + '» — faqat «Aktiv» shartnoma bekor qilinadi.');
    if (s(r[6]).trim() !== 'MChJ') throw new Xato(no + ' bo\'yicha ijaraga beruvchi — «' + r[6] + '». Bu yo\'l faqat MChJ nomidan tuzilgan shartnoma uchun — Kamoliddinga ayting.');
    if (!(await J.hujjatJurnal()).some(h => h.no === no && h.turi === 'SHARTNOMA' && h.holati === 'Faol'))
      throw new Xato(no + ' ning imzolangan skani yuklanmagan — demak shartnoma imzolanmagan. Uni «✕ Imzolanmagan» yo\'li bilan bekor qiling.');
    const och = (await J.bekorJurnal()).find(z => z.no === no && BEKOR_YOPIQ.indexOf(z.holati) < 0);
    if (och) throw new Xato(no + ' bo\'yicha bir tomonlama bekor qilish so\'rovi ochiq: ' + (och.raqam || 'ID ' + och.id) + ' (' + och.holati + ') — avval uni yoping.');
    const boshqa = (R06m || await kbRowsKozgu()).find(z => z.no === no && KB_OCHIQ.indexOf(z.holati) >= 0 && String(z.id) !== String(ozId || ''));
    if (boshqa) throw new Xato(no + ' bo\'yicha kelishuv so\'rovi allaqachon ochiq (' + boshqa.holati + ', ' + boshqa.kim + ').');
  }
  const x = { qator: V4[top[0]].n, no, sana: isoX(r[1]), dokon: T(r[4]), mid: T(r[5]), fish: T(r[23]), tel: T(r[24]), maydon: Number(r[25]) || 0,
    egasi: T(r[26]), oylik: Number(r[14]) || 0, bepulGacha: isoX(r[28]), ogoh: [] };
  // 02 — mijoz: pasport, JSHSHIR, manzil (yuridik shaxs — STIR, rahbar, bank)
  const m = aOxiri(await V.qatorlar('02_Mijozlar')).map(z => xom(z.x, 26)).find(z => T(z[0]) === x.mid);
  if (m) {
    if (!x.fish) x.fish = T(m[2]);
    if (!x.tel) x.tel = T(m[4]);
    x.yur = /^yuridik$/i.test(T(m[1])) || /(^|[\s"«»])(МЧЖ|MCHJ|MChJ|ООО|OOO|АЖ|ХК|XK)([\s"«»]|$)/.test(x.fish);
    const ps = T(m[6]).replace(/\s+/g, '').toUpperCase();
    x.pasport = /^[A-ZА-Я]{2}\d{7}$/.test(ps) ? ps.slice(0, 2) + ' ' + ps.slice(2) : ps;
    x.iib = (T(m[7]) || T(m[8])) ? ((T(m[7]) ? T(m[7]).replace(/\s*вилояти$/i, '') + ' вилояти ' : '') + T(m[8]) + ' ИИБ').trim() : '';
    x.pasSana = isoX(m[9]); const mud = isoX(m[10]);
    const j = typeof m[11] === 'number' ? String(Math.round(m[11])) : T(m[11]).replace(/\s+/g, '');
    x.jshshir = /^\d{14}$/.test(j) ? j : '';
    if (!x.jshshir) x.ogoh.push((x.yur ? 'Rahbarning ' : '') + 'JSHSHIR bazada 14 raqam emas («' + T(m[11]) + '») — hujjatda bo\'sh qoldirildi, qo\'lda yozing.');
    if (!x.pasport) x.ogoh.push('Pasport seriya va raqami bazada yo\'q — hujjatda bo\'sh qoldirildi.');
    if (mud) { const uch = bugunIso(91), bug = bugunIso(0);
      if (mud < bug) x.ogoh.push('Pasport muddati TUGAGAN (' + kbDmy(mud) + ') — yangi pasport ma\'lumotini so\'rang, 02_Mijozlar ni yangilab, hujjatni qayta tayyorlang.');
      else if (mud < uch) x.ogoh.push('Pasport muddati 3 oydan kam qolgan (' + kbDmy(mud) + ').'); }
    x.manzil = kbManzil(m);
    if (x.yur) {
      x.stir = T(m[12]).replace(/\D/g, ''); x.rahbar = T(m[3]); x.bank = T(m[19]); x.hr = T(m[20]).replace(/\s+/g, '');
      x.rahbarK = kbKir(x.rahbar);
      if (!x.rahbar) x.ogoh.push('Ijarachi yuridik shaxs, lekin 02 da rahbar F.I.Sh. yo\'q — hujjatda bo\'sh qoldirildi.');
      if (x.stir.length !== 9) x.ogoh.push('Ijarachining STIR i bazada 9 raqam emas («' + T(m[12]) + '») — hujjatda bo\'sh qoldirildi.');
      x.stir = x.stir.length === 9 ? x.stir : '';
      x.ogoh.push('Ijarachi yuridik shaxs — imzolovchi rahbarning vakolatini (buyruq yoki ishonchnoma) tekshiring' + (x.rahbar ? '; rahbar ismi kirillga o\'girildi: «' + x.rahbarK + '» — pasport bilan solishtiring' : '') + '.');
    }
  } else x.ogoh.push('Ijarachi 02_Mijozlar da topilmadi (ID ' + x.mid + ') — pasport, JSHSHIR va manzil hujjatda bo\'sh qoldi.');
  if (!x.yur) x.yur = /(^|[\s"«»])(МЧЖ|MCHJ|MChJ|ООО|OOO|АЖ|ХК|XK)([\s"«»]|$)/.test(x.fish);
  x.fishK = kbKir(x.fish);
  const hujjatNom = x.yur ? 'davlat ro\'yxatidan o\'tganlik guvohnomasi' : 'pasport';
  if (!/[Ѐ-ӿ]/.test(x.fish)) x.ogoh.push('Ijarachi nomi bazada lotincha — hujjatda kirillga o\'girildi: «' + x.fishK + '». ' + hujjatNom.charAt(0).toUpperCase() + hujjatNom.slice(1) + ' bilan solishtiring.');
  else x.ogoh.push('Ijarachi nomi: «' + x.fishK + '» — ' + hujjatNom + ' bilan solishtiring.');
  if (!x.yur && x.fish.split(/\s+/).length < 3) x.ogoh.push('Bazada ism to\'liq emas (otasining ismi yo\'q): «' + x.fish + '».');
  if (x.oylik > 0) x.ogoh.push('Bu shartnomada oylik ijara ' + kbPul(x.oylik) + ' so\'m — ijara haqi bo\'yicha qarz yo\'qligini buxgalteriyada tekshiring.');
  x.tel = kbTel(x.tel);
  // 01 — do'kon (eski: 2-qatordan 640 qator, 6 ustun)
  const d = (await V.qatorlar('01_Dokonlar')).filter(z => z.n <= 641).map(z => xom(z.x, 6)).find(z => T(z[0]) === x.dokon);
  x.dk = d ? { blok: T(d[2]), qavat: T(d[3]), nomer: T(d[4]), maydon: Number(d[5]) || 0 } : null;
  if (!x.dk) { const p = x.dokon.split('-'); x.dk = { blok: p[0] || '', qavat: p[1] || '', nomer: p[2] || '', maydon: 0 }; x.ogoh.push('Do\'kon ' + x.dokon + ' 01_Dokonlar da topilmadi — raqami ID dan olindi.'); }
  if (!x.maydon) x.maydon = x.dk.maydon;
  if (!x.sana) x.ogoh.push('04 da shartnoma sanasi sana ko\'rinishida emas — hujjatda bo\'sh qoldirildi.');
  return x;
}

// ------------------------------------------------------------------ kbHujjat_: 1-varaq kelishuv, 2-varaq dalolatnoma → { pdf, docx, bet, model }
// D = { sabab, sana 'yyyy-MM-dd', qarz, kalit (son), hisob (kirill), holat 'soz'|'kamchilik', izoh (kirill), xodim }
async function kbHujjat(x, D) {
  const { body: b, model } = DM.hujjat();
  b.setMarginTop(45).setMarginBottom(40).setMarginLeft(57).setMarginRight(45);
  const HA = DM.HorizontalAlignment;
  const AL = { c: HA.CENTER, r: HA.RIGHT, j: HA.JUSTIFY, l: HA.LEFT };
  const par = function (matn, o) { o = o || {}; const p = b.appendParagraph(matn);
    p.setAlignment(AL[o.al] || AL.l).setSpacingBefore(o.before || 0).setSpacingAfter(o.after || 0).setLineSpacing(o.ls || 1.05);
    p.setIndentStart(o.left || 0).setIndentFirstLine((o.left || 0) + (o.ind ? 28.35 : 0)).setIndentEnd(0);
    p.editAsText().setFontFamily('Times New Roman').setFontSize(o.sz || 11).setBold(!!o.b); return p; };
  const jadval = function (qatorlar, kenglik, opt) {   // chegarasiz jadval (sana qatori, imzolar, rekvizitlar)
    const t = b.appendTable(qatorlar.map(q => q.map(c => s(c).trim() ? s(c) : ' '))); t.setBorderWidth(0);
    try { kenglik.forEach((w, i) => { t.setColumnWidth(i, w); }); } catch (e) { }
    for (let r = 0; r < t.getNumRows(); r++) for (let c = 0; c < t.getRow(r).getNumCells(); c++) {
      const cc = t.getCell(r, c); cc.setPaddingTop(1).setPaddingBottom(1).setPaddingLeft(2).setPaddingRight(2);
      const p = cc.getChild(0).asParagraph(); p.setAlignment((opt.al && opt.al[c]) || AL.l).setSpacingAfter(0).setSpacingBefore(0).setLineSpacing(1);
      const qalin = opt.qalin ? opt.qalin(r, c) : false;
      p.editAsText().setFontFamily('Times New Roman').setFontSize(opt.sz || 10.5).setBold(qalin);
    }
    return t;
  };
  const dk = x.dk || {};
  const maydon = kbM2(x.maydon);
  const dokonNi = '«ANGOR KARVON SAROY» савдо мажмуасининг ' + (dk.blok || '—') + '-блоки, ' + (dk.qavat || '—') + '-қаватдаги № ' + (dk.nomer || x.dokon) + '-дўконни';
  const BO = '__________';
  const ijarachiPre = x.yur
    ? x.fishK + ' (СТИР: ' + (x.stir || BO) + ') номидан раҳбари ' + (x.rahbarK || BO)
    : 'Ўзбекистон Республикаси фуқароси ' + x.fishK + ' (паспорт серияси ва рақами: ' + (x.pasport || BO) + (x.iib ? ', ' + x.iib + ' томонидан ' + (x.pasSana ? kbSanaQ(x.pasSana) + ' санасида' : BO) + ' берилган' : '')
      + '; ЖШШИР: ' + (x.jshshir || '______________') + '; яшаш манзили: ' + (x.manzil || BO) + ')';
  const ijQisqa = x.yur ? x.fishK + ' номидан раҳбари ' + (x.rahbarK || BO) : x.fishK;
  const ijRek = x.yur
    ? [['', x.fishK], ['', 'Манзил: ' + (x.manzil || BO)], ['', 'СТИР: ' + (x.stir || BO)], ['', 'Банк: ' + (x.bank || BO)], ['', 'Ҳ/р: ' + (x.hr || BO)], ['', 'Телефон: ' + (x.tel || BO)], ['', 'Раҳбар: ' + (x.rahbarK || BO)]]
    : [['', x.fishK], ['', 'Манзил: ' + (x.manzil || BO)], ['', 'Паспорт серияси ва рақами: ' + (x.pasport || BO)], ['', x.iib ? x.iib + ' томонидан ' + (x.pasSana ? kbDmy(x.pasSana) : '____') + ' да берилган' : ''], ['', 'ЖШШИР: ' + (x.jshshir || '______________')], ['', 'Телефон: ' + (x.tel || BO)], ['', '']];
  const bekorSoz = kbSoz(D.sana);
  // ---------------- 1-VARAQ: KELISHUV
  par('№ ' + x.no + '-сонли ижара шартномасини бекор қилиш тўғрисида', { al: 'c', b: true, sz: 12 });
  par('КЕЛИШУВ', { al: 'c', b: true, sz: 14, before: 2, after: 6 });
  jadval([['Ангор тумани, Гулистон МФЙ', kbSanaQ(D.sana)]], [250, 230], { al: [AL.l, AL.r], sz: 11 });
  par(KB_MCHJ.nom + ' номидан Устав асосида иш юритувчи директори ' + KB_MCHJ.dir + ' (кейинги ўринларда — «Ижарага берувчи») бир томондан, ва '
    + ijarachiPre + ' (кейинги ўринларда — «Ижарачи») иккинчи томондан, биргаликда «Томонлар» деб аталган ҳолда, Томонлар ўртасида '
    + (x.sana ? kbSozDa(x.sana) : '20__ йил «___» __________да') + ' тузилган № ' + x.no + '-сонли ижара шартномасининг (кейинги ўринларда — «Шартнома») 9.2-бандига асосан қуйидагилар тўғрисида ушбу келишувни туздилар:',
    { al: 'j', ind: true, before: 8, after: 4 });
  const B = [];
  B.push('Томонларнинг ўзаро келишувига асосан Шартнома ' + bekorSoz + 'дан бошлаб бекор қилинади.');
  B.push('Ижарачи Шартнома бўйича фойдаланишда бўлган ' + dokonNi + ' (умумий майдони ' + maydon + ' м²; кейинги ўринларда — «Дўкон») ' + bekorSoz + 'да Шартноманинг 6.4-бандига мувофиқ қабул қилиш-топшириш далолатномаси асосида Ижарага берувчига қайтариб топширади. Далолатнома ушбу келишувнинг ажралмас қисми ҳисобланади.');
  B.push(x.oylik > 0 ? 'Ижара ҳақи бўйича Ижарачининг қарздорлиги мавжуд эмас.'
    : 'Шартноманинг 2.1 ва 6.6-бандларига мувофиқ Дўкондан фойдаланиш бепул бўлганлиги сабабли ижара ҳақи бўйича Ижарачининг қарздорлиги мавжуд эмас.');
  B.push(D.qarz ? 'Ижарачининг электр энергияси ҳақи бўйича ' + kbPul(D.qarz) + ' сўм қарзи мавжуд бўлиб, Ижарачи уни ' + kbSoz(kbKunQosh(D.sana, KB_QARZ_KUN)) + 'гача Ижарага берувчига тўлаш мажбуриятини олади.'
    : 'Ижарачининг электр энергияси ҳақи бўйича қарздорлиги мавжуд эмас.');
  if (x.egasi === 'SOTILMAGAN') B.push('Шартнома бекор қилиниши муносабати билан Ижарачининг Шартноманинг 4-бўлимида назарда тутилган Дўконни устувор тартибда сотиб олиш ҳуқуқи ҳам бекор бўлади.');
  if (D.holat === 'kamchilik') B.push('Дўконни қабул қилишда аниқланган камчиликлар (далолатноманинг 4-бандига қаранг) Шартноманинг 6.5-бандига мувофиқ Ижарачи ҳисобидан бартараф этилади (қопланади).');
  B.push((D.qarz || D.holat === 'kamchilik' ? 'Ушбу келишувда кўрсатилган мажбуриятлар бажарилгандан сўнг Томонлар' : 'Томонлар') + ' бир-бирига нисбатан Шартнома юзасидан бошқа моддий ва молиявий даъволарга эга эмаслар.');
  B.push('Ушбу келишув Томонлар имзолаган кундан кучга киради, Шартноманинг ажралмас қисми ҳисобланади ва 2 (икки) нусхада, бир хил юридик кучга эга ҳолда тузилди — ҳар бир Томонда биттадан сақланади.');
  B.forEach((m, i) => { par((i + 1) + '. ' + m, { al: 'j', ind: true, after: 3 }); });
  par('ТОМОНЛАРНИНГ МАНЗИЛЛАРИ ВА РЕКВИЗИТЛАРИ', { al: 'c', b: true, sz: 11, before: 8, after: 4 });
  const chap = [KB_MCHJ.nom, 'Манзил: ' + KB_MCHJ.manzil, 'Банк: ' + KB_MCHJ.bank, 'Ҳ/р: ' + KB_MCHJ.hr, 'МФО: ' + KB_MCHJ.mfo + '   СТИР: ' + KB_MCHJ.stir, 'Телефон: ' + KB_MCHJ.tel, 'Директор: ' + KB_MCHJ.dirQ];
  jadval([['ИЖАРАГА БЕРУВЧИ:', 'ИЖАРАЧИ:']].concat(chap.map((c, i) => [c, ijRek[i][1]]))
    .concat([[' ', ' '], ['Имзо: ____________________', 'Имзо: ____________________']]), [245, 235], { sz: 10.5, qalin: r => r <= 1 });
  // ---------------- 2-VARAQ: DALOLATNOMA
  b.appendPageBreak();
  par('ДЎКОННИ ҚАБУЛ ҚИЛИШ-ТОПШИРИШ ДАЛОЛАТНОМАСИ', { al: 'c', b: true, sz: 13, after: 2 });
  par('(№ ' + x.no + '-сонли ижара шартномасини бекор қилиш тўғрисидаги ' + kbSozDa(D.sana) + 'ги келишувга илова)', { al: 'c', sz: 10.5, after: 6 });
  jadval([['Ангор тумани, Гулистон МФЙ', kbSanaQ(D.sana)]], [250, 230], { al: [AL.l, AL.r], sz: 11 });
  par('Биз, қуйида имзо чекувчилар: топширувчи — Ижарачи ' + ijQisqa + ' ҳамда қабул қилувчи — ' + KB_MCHJ.nom + ' (Ижарага берувчи) номидан директор ' + KB_MCHJ.dir
    + (D.xodim ? ', Ижарага берувчи ходими ' + D.xodim + ' иштирокида' : '') + ', № ' + x.no + '-сонли ижара шартномасининг 3.2.11 ва 6.4-бандларига мувофиқ ушбу далолатномани туздик:',
    { al: 'j', ind: true, before: 8, after: 4 });
  const H = [];
  H.push('Ижарачи Шартнома бўйича фойдаланишда бўлган, Сурхондарё вилояти, Ангор тумани, Гулистон МФЙ, Ат-Термизий кўчаси, 198-уйда жойлашган ' + dokonNi + ' (умумий майдони ' + maydon + ' м²) ' + bekorSoz + 'да Ижарага берувчига қайтариб топширди, Ижарага берувчи эса уни қабул қилиб олди.');
  H.push('Топширилган калитлар сони: ' + D.kalit + ' (' + kbSonSoz(D.kalit) + ') дона.');
  H.push('Электр энергияси ҳисоблагичининг топшириш кунидаги кўрсаткичи: ' + D.hisob + '.');
  H.push(D.holat === 'soz' ? 'Дўкон соз ҳолатда, табиий эскиришни ҳисобга олган ҳолда Ижарачига топширилган ҳолатида қайтарилди. Томонларда Дўконнинг ҳолати юзасидан эътироз йўқ.'
    : 'Дўконни кўздан кечиришда қуйидаги камчиликлар аниқланди: ' + D.izoh + '. Ушбу камчиликлар Шартноманинг 6.5-бандига мувофиқ Ижарачи ҳисобидан бартараф этилади (қопланади).');
  H.push('Ижарачи Дўкондаги ўз товарлари ва мол-мулкини олиб чиқиб кетди; Дўконда Ижарачига тегишли мол-мулк қолмади.');
  H.push('Далолатнома 2 (икки) нусхада тузилди — ҳар бир Томонда биттадан сақланади.');
  H.forEach((m, i) => { par((i + 1) + '. ' + m, { al: 'j', ind: true, after: 5, ls: 1.1 }); });
  par(' ', { before: 14 });
  jadval([
    ['ТОПШИРДИ (Ижарачи):', 'ҚАБУЛ ҚИЛДИ (Ижарага берувчи):'],
    [x.yur ? x.fishK + ' раҳбари ' + (x.rahbarK ? kbQisqa(x.rahbarK) : BO) : x.fishK, KB_MCHJ.nom + ' директори ' + KB_MCHJ.dirQ],
    [' ', ' '],
    ['Имзо: ____________________', 'Имзо: ____________________']
  ], [245, 235], { sz: 10.5, qalin: r => r === 0 });
  if (D.xodim) { par(' ', { before: 10 }); par('Иштирок этди (Ижарага берувчи ходими): ____________________ ' + kbQisqa(D.xodim), { sz: 10.5 }); }
  const b0 = b.getChild(0);                          // DocumentApp.create boshida bo'sh paragraf qoldiradi
  if (b0.getType() === DM.ElementType.PARAGRAPH && !b0.asParagraph().getText().trim()) b0.removeFromParent();
  const { pdf, bet } = await DP.yasa(model);
  return { pdf, bet, docx: DX.yasa(model), model };
}

module.exports = { kbTekshir, kbHujjat, kbRowsDan, kbRowsKozgu, kbHuquq, kbAdmin, kbFam, kbLotin, kbKir, kbXodimIsm, kbS, kbDmy, Xato,
  KB_VARAQ, KB_SARLAVHA, KB_HUQUQ, KB_OCHIQ, KB_PAPKA };
