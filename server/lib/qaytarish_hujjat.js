// AKS TIZIM — ↩ ПУЛ ҚАЙТАРИШ ҳужжатлари (06.11.2026, юрист хулосаси асосида):
//   1) БУЙРУҚ (QB-YYYY/NNNN) — ариза асосида маблағ бўлиб-бўлиб кассадан қайтарилсин; 3.3.2-банд 15% ушланмасин; муддат; шартнома амалда қолади; масъул — бухгалтер.
//      Кўриниши — lib/bekor_hujjat.js buyruqHtml (бошқа буйруқлар билан бир хил, муҳрсиз).
//   2) ДИРЕКТОРНИНГ АРИЗАГА ЖАВОБИ (QJ-YYYY/NNNN) — муддат + фоиз/пеня/зарар ҳисобланмаслиги + 5-бўлим ўрнига ихтиёрий қарор; мижоз «Танишдим, розиман» деб имзолайди (ФК 242, 327-моддалар хавфини ёпади).
//   3) ИЧКИ АУДИТ РЕЕСТРИ — қайси мижознинг КО-1 нақд пули қайси КО-2 билан берилгани; имзосиз, мижозга берилмайди.
'use strict';
const PDF = require('./pdf');
const XP = require('./xat_pdf');
const BH = require('./bekor_hujjat');
const MI = require('./mijoz_imzo');
const SH = require('./sotuv_hujjat');

const s = v => String(v == null ? '' : v);
const esc = v => s(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const { yhSoz, yhSozDa, yhPul, yhDmy } = BH;
const dokonMatn = x => x.dk ? '«' + x.dk.blok + '» блок ' + x.dk.qavat + '-қаватдаги ' + x.dk.nomer + '-рақамли, умумий майдони ' + s(x.maydon).replace('.', ',') + ' м² бўлган савдо дўкони'
  : x.dokon + ' рақамли савдо дўкони';
const BAND = 'Шартноманинг 4.3-банди иккинчи қисми ва 5-бўлими';

// ------------------------------------------------------------------ 1) БУЙРУҚ
// x — BY.bekorShartnoma(no); q — qaror {qaytar, sana(iso), arizaSana(iso)}; muddatIso — қолдиқ қайтариш муддати; masul — бухгалтер
const pulN = n => yhPul(n).replace(/ /g, '\u00a0');   // buyruqda summa satr oxirida bo'linmasin
function buyruqMatn(x, q, muddatIso, masul) {
  const sarl = '№' + x.no + '-сонли шартнома бўйича тўланган маблағни Харидорга қайтариш тўғрисида';
  const K = [], B = [];
  K.push(BH.bekorJamiyat(x) + ' ва фуқаро ' + x.fishK + ' (кейинги ўринларда – Харидор) ўртасида ' + BH.shSanaDa(x) + ' ' + dokonMatn(x)
    + 'ни муддатли тўлов шартларида сотиш тўғрисида №' + x.no + '-сонли шартнома (кейинги ўринларда – Шартнома) тузилган' + BH.shSanaIzoh(x) + '. Шартнома бўйича Харидор томонидан жами '
    + pulN(x.tolangan) + ' сўм тўланган.');
  K.push('Харидор ' + yhSozDa(q.arizaSana || q.sana) + 'ги аризаси билан Шартномани ўз ташаббуси билан бекор қилишни ва тўлаган маблағини қайтаришни сўраган, маблағни Жамият кассасидан нақд пулда, бўлиб-бўлиб олишга розилик билдирган.');
  K.push('Низони судгача ҳал қилиш, Харидор билан муносабатларни сақлаш ва Жамият обрўсини ҳимоя қилиш мақсадида, ' + BAND + 'га ҳамда Ўзбекистон Республикаси фуқаролик қонунчилигига мувофиқ,');
  B.push('Харидор томонидан тўланган ' + pulN(q.qaytar) + ' сўм Жамият кассасидан нақд пулда, бўлиб-бўлиб, ҳар сафар чиқим касса ордери (КО-2) расмийлаштирилиб, Харидорнинг имзоси билан қайтарилсин.');
  B.push('Шартноманинг 3.3.2-бандида назарда тутилган 15 фоиз миқдоридаги сумма ушлаб қолинмасин; қайтариладиган маблағдан жарима ва бошқа суммалар чегирилмасин.');
  B.push('Қолдиқ сумма ' + yhSoz(muddatIso) + 'га қадар, Жамият кассасига нақд пул тушишига қараб, бўлиб-бўлиб қайтарилсин. Қайтариш суръати кассадаги нақд тушумга боғлиқ; муддат ичида қайтарилган суммага фоиз, пеня ва зарар ҳисобланмасин. Зарурат бўлса муддат Харидор билан ёзма қўшимча келишув асосида узайтирилсин.');
  B.push('Маблағ тўлиқ қайтарилгунга қадар Шартнома амалда қолсин; маблағ тўлиқ қайтарилгач Шартномани Харидор ташаббуси билан бекор қилиш тўғрисида алоҳида буйруқ чиқарилсин ва томонлар ўртасида ўзаро ҳисоб-китоб далолатномаси имзолансин.');
  B.push('Бухгалтерия ҳар бир қайтарилган сумманинг манбаи (кирим касса ордери) ва қолдиғини ички ҳисобда юритсин; чиқим касса ордерлари Шартнома иш материалларига тикилсин.');
  B.push('Харидорга ушбу буйруқ асосида ёзма жавоб юборилсин ва буйруқ нусхаси топширилсин.');
  B.push('Мазкур буйруқ ижроси учун масъул — ' + (masul || 'бош бухгалтер') + '. Ижросини назорат қилишни ўз зиммамда қолдираман.');
  return { sarl, K, B };
}
async function buyruqYasa(x, q, raqam, sanaIso, muddatIso, masul) {
  const M = buyruqMatn(x, q, muddatIso, masul);
  const yasa = async k => { const pdf = await PDF.yasa(BH.buyruqHtml(M, raqam, sanaIso, k), '', { scale: 1 / XP.KAT, skript: XP.TEKISLA }); return { pdf, bet: XP.betSoni(pdf) }; };
  let r = await yasa(1), kk = 1;
  if (r.bet > 1) for (const k of [0.95, 0.9, 0.85]) { r = await yasa(k); kk = k; if (r.bet <= 1) break; }
  return Object.assign({ matn: M, k: kk }, r);
}

// ------------------------------------------------------------------ 2) ДИРЕКТОРНИНГ АРИЗАГА ЖАВОБИ (A4, бир варақ; мижоз «Танишдим, розиман» деб имзолайди)
function javobHtml(x, q, raqam, sanaIso, buyruqRaqam, buyruqSana, muddatIso) {
  return `<!doctype html><html><head><meta charset="utf-8"><style>
@page{size:A4;margin:18mm 16mm 20mm 25mm}*{box-sizing:border-box}body{margin:0;padding-right:1mm;font-family:'Liberation Serif','Times New Roman',serif;font-size:12.5pt;line-height:1.45;color:#000}
.sh{text-align:center;font-weight:bold;font-size:12.5pt;line-height:1.3}.sh small{font-weight:normal;font-size:10pt}
.rq{display:flex;justify-content:space-between;margin:6mm 0 5mm}.kimga{margin-left:50%;line-height:1.4;margin-bottom:6mm}
p{margin:0 0 3mm;text-align:justify;text-indent:12mm}.ch{display:inline-block;border-bottom:.7pt solid #000;vertical-align:bottom}.k{font-size:10pt;color:#444}
.imz{margin-top:8mm;line-height:2.2}.roz{margin-top:9mm;border-top:.7pt solid #000;padding-top:3mm;line-height:2.3}</style></head><body>
<div class="sh">«ANGOR KARVON SAROY» МАСЪУЛИЯТИ ЧЕКЛАНГАН ЖАМИЯТИ<br><small>СТИР 308 489 492 · Сурхондарё вилояти, Ангор тумани · тел. +998 95-557-88-88</small></div>
<div class="rq"><span>${esc(yhSoz(sanaIso))}</span><span>№ ${esc(raqam)}</span></div>
<div class="kimga">Фуқаро <b>${esc(x.fishK)}</b>га<br>${x.manzil ? 'Манзил: ' + esc(x.manzil) + '<br>' : ''}${x.tel ? 'Тел.: ' + esc(x.tel) : ''}</div>
<p>Ҳурматли ${esc(x.fishK)}!</p>
<p>Сизнинг ${esc(BH.shSanaDa(x))} тузилган №${esc(x.no)}-сонли шартнома (${esc(dokonMatn(x))}) бўйича тўлаган маблағингизни қайтариш тўғрисидаги ${esc(yhDmy(q.arizaSana || q.sana))} даги аризангиз кўриб чиқилди.</p>
<p>Жамият директорининг ${esc(yhDmy(buyruqSana))} даги ${esc(buyruqRaqam)}-сонли буйруғига мувофиқ Сизга қуйидагиларни маълум қиламиз:</p>
<p>1. Шартнома бўйича тўланган <b>${yhPul(q.qaytar)}</b> (${esc(SH.sozBilan(q.qaytar))}) сўм Жамият кассасидан нақд пулда, бўлиб-бўлиб қайтарилади; ҳар бир олинган сумма учун чиқим касса ордери расмийлаштирилади ва Сиз томонингиздан имзоланади.</p>
<p>2. Шартноманинг 3.3.2-бандида назарда тутилган 15 фоиз миқдоридаги сумма ушлаб қолинмайди.</p>
<p>3. Маблағ тўлиқ қайтарилгунга қадар Шартнома амалда қолади; маблағ тўлиқ қайтарилгач Шартнома Сизнинг ташаббусингиз билан бекор қилинади ва томонлар ўртасида ўзаро ҳисоб-китоб далолатномаси имзоланади.</p>
<p>4. Қолдиқ сумма <b>${esc(yhSoz(muddatIso))}</b>га қадар, Жамият кассасига нақд пул тушишига қараб, бўлиб-бўлиб қайтарилади. Қайтариш суръати кассадаги нақд тушумга боғлиқ бўлиб, муддат ичида қайтарилган сумма учун фоиз, пеня ва зарар ҳисобланмайди. Зарурат бўлса муддат томонларнинг ёзма қўшимча келишуви билан узайтирилади.</p>
<p>5. Қайтариш Шартноманинг 5-бўлимида назарда тутилган тартиб ўрнига Жамиятнинг ихтиёрий қарори билан амалга оширилмоқда.</p>
<div class="imz">Директор &nbsp;&nbsp; <span class="ch" style="width:50mm"></span> &nbsp;&nbsp; К.Ҳ. Ҳайдаров</div>
<div class="roz"><b>Танишдим, розиман.</b> &nbsp; «____» ______________ 20___ йил &nbsp;&nbsp; Имзо: <span class="ch" style="width:45mm"></span><br>
Ф.И.Ш. <span class="k">(тўлиқ, ўз қўли билан)</span>: <span class="ch" style="width:110mm"></span></div>
</body></html>`;
}
async function javobYasa(x, q, raqam, sanaIso, buyruqRaqam, buyruqSana, muddatIso) {
  return PDF.yasa(javobHtml(x, q, raqam, sanaIso, buyruqRaqam, buyruqSana, muddatIso), '', Object.assign({ format: 'A4', preferCSSPageSize: true, printBackground: true }, MI.chromKol()));
}

// ------------------------------------------------------------------ 3) ИЧКИ АУДИТ РЕЕСТРИ (имзосиз, мижозга берилмайди)
// q — qaror (holatYig dan, ko2 bilan); T — 05_Tolovlar ro'yxati (tid, sana, no, fish, summa, hujjat); ishlatilgan — {tid: jami olingan}; vaqt — chop vaqti
function auditHtml(x, q, T, ishlatilgan, vaqt) {
  const tt = {}; T.forEach(t => { tt[t.tid] = t; });
  let n = 0, jami = 0;
  const Kq = q.ko2.filter(k => k.holati !== 'Bekor');
  const qat = Kq.map(k => k.manba.map((m, i) => { const t = tt[m.tid] || {}; if (!i) { n++; jami += k.summa; }
    return '<tr>' + (i ? '' : `<td class="c" rowspan="${k.manba.length}">${n}</td><td rowspan="${k.manba.length}"><b>${esc(k.raqam)}</b><br>${esc(yhDmy(k.sana))}${k.holati === 'Faol' ? '' : '<br><i>скан кутилмоқда</i>'}</td><td class="r" rowspan="${k.manba.length}"><b>${yhPul(k.summa)}</b></td>`)
      + `<td>КО-1 № ${esc(m.tid)}${t.hujjat ? ' (' + esc(t.hujjat) + ')' : ''}<br>${esc(t.sana ? yhDmy(t.sana) : '')}</td><td>${esc(t.fish || '')}<br>${esc(t.no || '')}</td><td class="r">${t.summa != null ? yhPul(t.summa) : ''}</td><td class="r">${yhPul(m.olindi != null ? m.olindi : m.summa)}</td><td class="r">${t.summa != null ? yhPul(t.summa - (ishlatilgan[m.tid] || 0)) : ''}</td></tr>`; }).join('')).join('');
  const bekor = q.ko2.filter(k => k.holati === 'Bekor').map(k => esc(k.raqam) + ' (' + esc(yhDmy(k.sana)) + ', ' + yhPul(k.summa) + ' сўм)').join('; ');
  return `<!doctype html><html><head><meta charset="utf-8"><style>
@page{size:A4 landscape;margin:14mm 14mm 16mm 14mm}*{box-sizing:border-box}body{margin:0;padding-right:1mm;font-family:'Liberation Serif','Times New Roman',serif;font-size:10.5pt;line-height:1.3;color:#000}
h1{font-size:13pt;text-align:center;margin:0 0 2mm}.k{text-align:center;font-size:9.5pt;color:#333;margin-bottom:4mm}
table{width:100%;border-collapse:collapse}th,td{border:.6pt solid #000;padding:1.6mm 2mm;vertical-align:top}th{background:#eee;font-size:9.5pt}.c{text-align:center}.r{text-align:right;white-space:nowrap}
.hk{margin:3mm 0 3mm;line-height:1.5}.iz{margin-top:4mm;font-size:9.5pt;color:#333}</style></head><body>
<h1>ИЧКИ АУДИТ РЕЕСТРИ — №${esc(x.no)}-сонли шартнома бўйича маблағ қайтариш (КО-2) манбалари</h1>
<div class="k">Ички ҳужжат · мижозга берилмайди · чоп этилди: ${esc(vaqt)}</div>
<div class="hk"><b>Харидор:</b> ${esc(x.fishK)} · <b>дўкон:</b> ${esc(x.dokon)} · <b>тўланган:</b> ${yhPul(x.tolangan)} сўм · <b>қарор (${esc(yhDmy(q.sana))}):</b> қайтарилиши керак ${yhPul(q.qaytar)} сўм${q.buyruq ? ' · <b>буйруқ:</b> ' + esc(q.buyruq) + ' (' + esc(yhDmy(q.buyruqSana)) + ')' : ''}${q.muddat ? ' · <b>муддат:</b> ' + esc(yhDmy(q.muddat)) : ''}</div>
<table><tr><th>№</th><th>КО-2 (чиқим)</th><th>Берилди, сўм</th><th>Манба — КО-1 (кирим)</th><th>Кимдан, шартнома</th><th>КО-1 нақд, сўм</th><th>Шундан олинди</th><th>Кассада қолди</th></tr>
${qat || '<tr><td colspan="8" class="c">Ҳали КО-2 ёзилмаган</td></tr>'}
<tr><th colspan="2" class="r">ЖАМИ қайтарилди (${n} та КО-2)</th><th class="r">${yhPul(jami)}</th><th colspan="4" class="r">Қолдиқ (қайтарилиши керак)</th><th class="r">${yhPul(q.qaytar - jami)}</th></tr></table>
<div class="iz">«Кассада қолди» — ушбу КО-1 нақд пулидан барча КО-2 лар (шу ва бошқа мижозларга) олингандан кейинги қолдиқ. Ҳар бир КО-1 ўз шартномасига кирим сифатида ёзилган ва ўша ерда ҳисобга олинган; қайтариш аванс қайтариши бўлиб, даромад ҳам, харажат ҳам эмас.${bekor ? '<br><b>Бекор қилинган КО-2 лар</b> (имзоланмаган, рақами сақланади): ' + bekor + '.' : ''}</div>
</body></html>`;
}
async function auditYasa(x, q, T, ishlatilgan, vaqt) {
  return PDF.yasa(auditHtml(x, q, T, ishlatilgan, vaqt), '', Object.assign({ format: 'A4', landscape: true, preferCSSPageSize: true, printBackground: true }, MI.chromKol()));
}

// ------------------------------------------------------------------ 4) МУДДАТНИ УЗАЙТИРИШ — ҚЎШИМЧА КЕЛИШУВ (бир варақ, икки томон имзолайди)
function kelishuvHtml(x, q, raqam, sanaIso, eskiIso, yangiIso, qoldiq) {
  return `<!doctype html><html><head><meta charset="utf-8"><style>
@page{size:A4;margin:18mm 16mm 20mm 25mm}*{box-sizing:border-box}body{margin:0;padding-right:1mm;font-family:'Liberation Serif','Times New Roman',serif;font-size:12.5pt;line-height:1.45;color:#000}
.h{text-align:center;font-weight:bold;font-size:14pt;margin:4mm 0 1mm}.h2{text-align:center;font-size:11.5pt;margin-bottom:5mm}.rq{display:flex;justify-content:space-between;margin-bottom:5mm}
p{margin:0 0 3mm;text-align:justify;text-indent:12mm}.ch{display:inline-block;border-bottom:.7pt solid #000;vertical-align:bottom}.k{font-size:10pt;color:#444}
table{width:100%;border-collapse:collapse;margin-top:9mm}td{width:50%;vertical-align:top;padding:0 3mm;line-height:2.1}</style></head><body>
<div class="h">ҚЎШИМЧА КЕЛИШУВ № ${esc(raqam)}</div>
<div class="h2">№${esc(x.no)}-сонли шартнома бўйича тўланган маблағни қайтариш муддатини узайтириш тўғрисида</div>
<div class="rq"><span>Ангор тумани</span><span>${esc(yhSoz(sanaIso))}</span></div>
<p>${BH.bekorJamiyat(x)} номидан директор К.Ҳ. Ҳайдаров ва фуқаро <b>${esc(x.fishK)}</b> (кейинги ўринларда – Харидор) қуйидагилар тўғрисида келишиб олдилар:</p>
<p>1. Жамият директорининг ${esc(yhDmy(q.buyruqSana))} даги ${esc(q.buyruq)}-сонли буйруғи ва ${esc(yhDmy(q.javobSana))} даги ${esc(q.javob)}-сонли жавобида белгиланган қолдиқ маблағни қайтариш муддати (${esc(yhDmy(eskiIso))}) <b>${esc(yhSoz(yangiIso))}</b>га қадар узайтирилади.</p>
<p>2. Ушбу келишув имзоланган кунга қолдиқ <b>${yhPul(qoldiq)}</b> (${esc(SH.sozBilan(qoldiq))}) сўмни ташкил этади. Қолдиқ Жамият кассасидан нақд пулда, кассага нақд тушумга қараб, бўлиб-бўлиб, ҳар сафар чиқим касса ордери билан қайтарилади.</p>
<p>3. Узайтирилган муддат ичида қайтариладиган маблағга фоиз, пеня ва зарар ҳисобланмайди. Харидор муддат узайтирилишига розилик билдиради ва шу муносабат билан Жамиятга нисбатан даъвоси йўқ.</p>
<p>4. Шартнома маблағ тўлиқ қайтарилгунга қадар амалда қолади; қолган шартлар ўзгармайди. Келишув икки нусхада тузилди, бири Харидорга топширилди.</p>
<table><tr><td><b>Жамият:</b><br>Директор<br><span class="ch" style="width:50mm"></span> К.Ҳ. Ҳайдаров</td>
<td><b>Харидор:</b><br>Имзо: <span class="ch" style="width:45mm"></span><br>Ф.И.Ш. <span class="k">(тўлиқ, ўз қўли билан)</span>:<br><span class="ch" style="width:75mm"></span></td></tr></table>
</body></html>`;
}
async function kelishuvYasa(x, q, raqam, sanaIso, eskiIso, yangiIso, qoldiq) {
  return PDF.yasa(kelishuvHtml(x, q, raqam, sanaIso, eskiIso, yangiIso, qoldiq), '', Object.assign({ format: 'A4', preferCSSPageSize: true, printBackground: true }, MI.chromKol({ imzo: 'Харидор' })));
}

module.exports = { kelishuvHtml, kelishuvYasa, buyruqMatn, buyruqYasa, javobHtml, javobYasa, auditHtml, auditYasa };
