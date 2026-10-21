// AKS TIZIM — sotuv shartnomasi hujjati (Kod.gs v9.3 sotuvHujjat_ bilan bir xil): Google Doc shabloni (SHABLON — tur → Drive ID) →
// <<belgi>> lar → PDF. Eski tizim nusxani DocumentApp bilan to'ldirib PDF qilardi (15–60 s); bu yerda shablon robot orqali olinadi
// (lib/docs_shablon.js), matn amallari modelda, PDF — Chromium (lib/shablon_pdf.js), 27/368 namunasi bilan so'zma-so'z solishtirilgan.
// Umumiy yordamchilar (Kod.gs): sozBilan, sanaMatn_, telPlus_, rx_, bandOchir_. Bazaga hech narsa yozmaydi.
'use strict';
const DS = require('./docs_shablon');
const SP = require('./shablon_pdf');

const s = v => String(v == null ? '' : v);
const SHABLON = {
  'Тайёр дўкон (Муддатли тўлов шартномаси)': '1RyJ5oHT8ApXUbxFumVJ0TK195QGq9mqy9NKQb-Bqoz8',
  'Тайёр дўкон (100% тўлов шартномаси)': '1uffx_2GKCbzznBsmPvjjAdtKpKLKnR4hS6TAyHfGIjw',   // Toliq_to'lov_shartnoma_shablon
  'Қурилаётган дўкон (Муддатли тўлов шартномаси)': '1WmjehxKT8NUlX4TEG32svGaneHFekpzCXJuoJ7elxlA',
  'Қурилаётган дўкон (100% тўлов шартномаси)': '1uffx_2GKCbzznBsmPvjjAdtKpKLKnR4hS6TAyHfGIjw'
};
const OYLAR = ['январ', 'феврал', 'март', 'апрел', 'май', 'июн', 'июл', 'август', 'сентябр', 'октябр', 'ноябр', 'декабр'];
// --- son so'z bilan (кирилл, ўзбек) ---
const S_BIR = ['', 'бир', 'икки', 'уч', 'тўрт', 'беш', 'олти', 'етти', 'саккиз', 'тўққиз'];
const S_ON = ['', 'ўн', 'йигирма', 'ўттиз', 'қирқ', 'эллик', 'олтмиш', 'етмиш', 'саксон', 'тўқсон'];
function uch(n) { const y = Math.floor(n / 100), o = Math.floor((n % 100) / 10), b = n % 10; const p = []; if (y) p.push((y > 1 ? S_BIR[y] + ' ' : '') + 'юз'); if (o) p.push(S_ON[o]); if (b) p.push(S_BIR[b]); return p.join(' '); }
function sozBilan(n) {
  n = Math.round(Number(n) || 0); if (n === 0) return 'нол';
  const qism = [[1000000000, 'миллиард'], [1000000, 'миллион'], [1000, 'минг']]; const p = [];
  for (const [d, nom] of qism) { const k = Math.floor(n / d); if (k) { p.push((k === 1 && nom === 'минг') ? 'минг' : uch(k) + ' ' + nom); n %= d; } }
  if (n) p.push(uch(n)); return p.join(' ');
}
function sanaMatn(ddmmyyyy) { const p = s(ddmmyyyy).split('.'); return p.length === 3 ? p[0] + ' ' + OYLAR[Number(p[1]) - 1] + ' ' + p[2] + ' йил' : s(ddmmyyyy); }
function rx(x) { return s(x).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
function telNorm(t) { let d = s(t).replace(/\D/g, ''); if (d.length === 12 && d.indexOf('998') === 0) d = d.slice(3); return d; }
function telPlus(t) { const d = telNorm(t); return d.length === 9 ? '+998 ' + d.slice(0, 2) + '-' + d.slice(2, 5) + '-' + d.slice(5, 7) + '-' + d.slice(7) : s(t); }
const fmt = n => Math.round(n).toLocaleString('ru-RU').replace(/[\u00a0\u202f]/g, ' ').replace(/,/g, ' ');   // Kod.gs: \xa0 → oddiy bo'sh joy (qator bo'linishi mumkin)
const num = x => Number(s(x).replace(/[^\d.-]/g, '')) || 0;
// v9.1: <<KALIT>> yolg'iz turgan xatboshini o'chiradi (matn ichida bo'lsa — faqat belgining o'zini); hujjatning oxirgi xatboshisi o'chirilmaydi
function bandOchir(body, kalit) {
  const belgi = '<<' + kalit + '>>';
  for (let n = 0; n < 5; n++) {
    const hit = DS.findText(body, rx(belgi)); if (!hit) return;
    if (DS.matn(hit.p).trim() === belgi && !(hit.ota === body && hit.i === body.length - 1)) { DS.removeChild(hit.ota, hit.p); continue; }
    DS.deleteText(hit.p, hit.boshi, hit.oxiri - 1);
  }
}
// sotuvHujjat_: r — 03 qatori (displayValues, 40 ustun) yoki nusxasi; mr — 02 qatori (displayValues); jad — [{sana:'dd.mm.yyyy', summa}];
// opt — { nom, qayta: { eskiNo, eskiSana, kelSana } }. Qaytaradi { pdf, bet, qolgan, bosh, nom }
async function sotuvHujjat(r, mr, jad, opt) {
  const tid = SHABLON[r[3]]; if (!tid) throw new Error('Bu shartnoma turi uchun shablon belgilanmagan: ' + r[3]);
  const dk = s(r[5]).split('-');
  const qurilish = /^Қурилаётган/.test(s(r[3]));
  const qt = opt.qayta || null;
  const qiymat = num(r[22]), boshl = num(r[9]), narx = num(r[7]), oy = num(r[11]), bkun = num(r[10]);
  const qoldiq = Math.max(0, qiymat - boshl);
  const fx = qiymat ? boshl / qiymat * 100 : 0;
  const foiz = (Math.abs(fx - Math.round(fx)) < 0.005) ? String(Math.round(fx)) : fx.toFixed(2).replace('.', ',');
  const vil = v => { v = s(v).trim(); return !v || /вилоят|viloyat|шаҳр|shahr|Республика/i.test(v) ? v : v + ' вилояти'; };
  const jadvalMatn = jad.map(x => '— ' + x.sana + ' санасигача: ' + fmt(x.summa) + ' сўм').join('\n');
  let eskiBand = '', sharti, mkvIzoh = '';
  if (qt) {
    const eskiS = sanaMatn(qt.eskiSana), kelS = sanaMatn(qt.kelSana);
    eskiBand = '1.4. Мазкур шартнома Томонлар ўртасида ' + eskiS + 'да тузилган ва Томонларнинг ' + kelS + 'даги келишувига асосан бекор қилинган №' + qt.eskiNo +
      '-сонли шартнома ўрнига, ўша Дўконга нисбатан тузилмоқда. Харидорнинг №' + qt.eskiNo + '-сонли шартнома бўйича тўлаган маблағлари мазкур шартноманинг ' +
      (qurilish ? '2.2.1' : '2.2') + '-бандига мувофиқ ҳисобга олинади.';
    sharti = (qurilish ? '' : 'дастлабки тўлов сифатида ') + 'тўлайди. Ушбу сумма Харидор томонидан №' + qt.eskiNo + '-сонли шартнома бўйича Сотувчининг ҳисоб рақамига тўлиқ тўланган бўлиб, Томонларнинг ' +
      qt.kelSana + 'даги Ўзаро ҳисоб-китоб солиштирма далолатномаси ва «№' + qt.eskiNo + '-сонли шартномани бекор қилиш тўғрисида»ги келишувига асосан мазкур шартнома бўйича дастлабки тўлов сифатида тўлиқ ҳисобга олинади; Томонлар дастлабки тўлов мажбурияти шартнома имзоланган кунда тўлиқ бажарилган деб ҳисоблайдилар.';
    if (!qurilish) mkvIzoh = ' (ўртача ҳисобда; Дўконнинг умумий қиймати Томонлар томонидан қатъий белгиланган бўлиб, ўзгармайди, 2.5-бандда назарда тутилган ҳол бундан мустасно)';
  } else {
    sharti = qurilish ? 'шартнома имзоланган кундан бошлаб ' + bkun + ' (' + sozBilan(bkun) + ') банк куни ичида тўлайди.'
                      : 'шартнома имзоланган санадан ' + bkun + ' (' + sozBilan(bkun) + ') кун ичида тўлайди.';
  }
  const T = {
    'Shartnoma raqami': r[0], 'Shartnoma sanasi': sanaMatn(r[2]),
    'Mijoz F.I.SH.': mr[2], 'Pasport seriyasi': mr[6], 'Pasport berilgan Viloyat IIB': vil(mr[7]), 'Shahar yoki tuman IIB': mr[8],
    'Pasport berilgan sana': mr[9], 'Pasport amal qilish muddati': mr[10], 'JSHSHIR': mr[11],
    'Yashash manzili. Viloyat': vil(mr[13]), 'Yashash manzili. Shahar yoki tuman': mr[14], 'Yashash MFY': mr[15], 'Ko`cha': mr[16], 'Uy': mr[17], 'Xonadon': mr[18],
    'Telefon raqami': telPlus(mr[4]),
    'Blok': dk[0] || '', 'Qavat': dk[1] || '', 'Dokon': dk[2] || '', 'Real maydon': s(r[6]).replace('.', ',') + ' м²',
    'Umumiy qiymat (raqam bilan)': fmt(qiymat), "Umumiy qiymat (so'z bilan)": sozBilan(qiymat),
    '1mkv bahosi': fmt(narx), "1mkv bahosi (so'z bilan)": sozBilan(narx), '1mkv izoh': mkvIzoh,
    "Boshlang'ich to'lov foizi": foiz, "Boshlang'ich to'lov (raqam bilan)": fmt(boshl), "Boshlang'ich to'lov (so'z bilan)": sozBilan(boshl),
    "Boshlang'ich to'lov muddati (kun)": String(bkun), "Boshlang'ich to'lov muddati (so'z bilan)": sozBilan(bkun),
    "Boshlang'ich to'lov sharti": sharti, 'Eski shartnoma bandi': eskiBand,
    'Qolgan summa (raqam bilan)': fmt(qoldiq), "Qolgan summa (so'z bilan)": sozBilan(qoldiq),
    "Muddatli to'lov oyi (raqam bilan)": String(oy), "Muddatli to'lov oyi (so'z bilan)": sozBilan(oy),
    "Har oyning to'lov sanasi": s(r[12] || '')
  };
  const sh = await DS.olId(tid), m = sh.model, body = m.el;
  if (!mr[18]) DS.replaceText(body, ',?\\s*<<Xonadon>>\\s*-?\\s*хонадон', '');
  if (!mr[17]) DS.replaceText(body, ',?\\s*<<Uy>>\\s*-?\\s*уй', '');
  if (!eskiBand) bandOchir(body, 'Eski shartnoma bandi');   // v9.1: oddiy shartnomada 1.4 qatori butunlay olib tashlanadi
  const bosh = [['Pasport', mr[6]], ['JSHSHIR', mr[11]], ['Pasport sanasi', mr[9]], ['Manzil (tuman)', mr[14]], ['Telefon', mr[4]]].filter(x => !s(x[1]).trim()).map(x => x[0]);
  const pm = s(mr[10]).split('.'); if (pm.length === 3) { const pmd = new Date(Date.UTC(+pm[2], +pm[1] - 1, +pm[0])); const kun = Math.round((pmd - new Date()) / 86400000); if (kun < 0) bosh.push('PASPORT MUDDATI TUGAGAN (' + mr[10] + ')'); else if (kun < 90) bosh.push('pasport muddati ' + kun + ' kundan keyin tugaydi (' + mr[10] + ')'); }
  if (s(mr[11]).replace(/\D/g, '').length !== 14 && s(mr[11]).trim()) bosh.push('JSHSHIR 14 raqam emas (' + mr[11] + ')');
  for (const k in T) DS.replaceText(body, '<<' + rx(k) + '>>', s(T[k]));
  DS.replaceText(body, 'вилояти[\\s\\x{00A0}]+вилояти', 'вилояти'); DS.replaceText(body, 'м²[\\s\\x{00A0}]*м²', 'м²');   // v9.2: shablonda ham yozilgan bo'lsa — takrorni olib tashlash
  // to'lov jadvali — har qator alohida xatboshi (setIndentStart(36): Docs birinchi qator chekinishini o'zgartirmaydi → osilgan 36 pt)
  const hit = DS.findText(body, "<<To'lov jadvali>>");
  if (hit) {
    const bi = hit.ota.indexOf(hit.p);
    const satr = jadvalMatn ? jadvalMatn.split('\n') : ['— (тўлов жадвали йўқ)'];
    satr.forEach((x, i) => { const p = DS.insertParagraph(hit.ota, bi + 1 + i, x); p.indStart = 36; p.indFirst = -36; });
    DS.removeChild(hit.ota, hit.p);
  }
  const qolgan = DS.qolganBelgilar(body);
  const r2 = await SP.yasa(m);
  return { pdf: r2.pdf, bet: r2.bet, qolgan, bosh, nom: opt.nom, shablon: { id: sh.id, nom: sh.nom, modifiedTime: sh.modifiedTime } };
}

module.exports = { sotuvHujjat, sozBilan, sanaMatn, telPlus, telNorm, rx, fmt, num, bandOchir, SHABLON, OYLAR };
