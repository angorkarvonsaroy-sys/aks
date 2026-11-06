// AKS TIZIM — ХАРИДОР ТАШАББУСИ БИЛАН шартномани бекор қилиш ҳужжатлари (06.11.2026, директор қарори).
// Шарт: Харидорга тўланган маблағ ТЎЛИҚ қайтарилган (api/qaytarish.js: қарор «Yakunlandi», қолдиқ 0) — шунда жарима ушланмайди (4.3-банд 2-қисм, 5-бўлим).
//   1) БУЙРУҚ — lib/bekor_hujjat.js buyruqHtml (бир томонлама буйруқ билан бир хил кўриниш, муҳрсиз);
//   2) ЎЗАРО ҲИСОБ-КИТОБ ДАЛОЛАТНОМАСИ — икки томон имзолайди: тўловлар, қайтарилган КО-2 лар, қолдиқ 0, даъво йўқ.
//      Мижоз имзолайдиган ҳужжат қоидаси (lib/mijoz_imzo.js): ҳар варақда «Варақ N / M» ва Харидор имзоси, якуний имзода Ф.И.Ш. қўлда.
'use strict';
const PDF = require('./pdf');
const XP = require('./xat_pdf');
const BH = require('./bekor_hujjat');
const MI = require('./mijoz_imzo');

const s = v => String(v == null ? '' : v);
const esc = v => s(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const { yhSoz, yhSozDa, yhPul, yhDmy, yhIso } = BH;
const dokonMatn = x => x.dk ? '«' + x.dk.blok + '» блок ' + x.dk.qavat + '-қаватдаги ' + x.dk.nomer + '-рақамли, умумий майдони ' + s(x.maydon).replace('.', ',') + ' м² бўлган савдо дўкони'
  : x.dokon + ' рақамли савдо дўкони';
const BAND = 'Шартноманинг 4.3-банди иккинчи қисми ва 5-бўлими';

// Q = { qaytar, ushlab, qaytarildi, qoldiq, sana (qaror), ko2: [{ raqam, sana(iso), summa }], tolovlar: [{ sana(iso), shakl, hujjat, summa }] }
function buyruqMatn(x, Q, raqam, sanaIso) {
  const sarl = 'Муддатли тўлов шартномасини Харидор ташаббуси билан бекор қилиш тўғрисида';
  const K = [], B = [];
  K.push(BH.bekorJamiyat(x) + ' ва фуқаро ' + x.fishK + ' (кейинги ўринларда – Харидор) ўртасида ' + yhSozDa(x.sana) + ' ' + dokonMatn(x)
    + 'ни муддатли тўлов шартларида сотиш тўғрисида №' + x.no + '-сонли шартнома (кейинги ўринларда – Шартнома) тузилган. Шартноманинг умумий қиймати '
    + yhPul(x.qiymat) + ' сўмни ташкил этади.');
  K.push('Харидор Шартномани ўз ташаббуси билан бекор қилиш тўғрисида мурожаат қилган. Шартнома бўйича Харидор томонидан жами ' + yhPul(x.tolangan) + ' сўм тўланган.');
  K.push('Жамият директорининг ' + yhSozDa(Q.sana) + 'ги қарорига мувофиқ тўланган маблағ Харидорга тўлиқ қайтарилди: '
    + Q.ko2.map(k => k.raqam + '-сонли чиқим касса ордери (' + yhDmy(k.sana) + ', ' + yhPul(k.summa) + ' сўм)').join(', ')
    + ' — жами ' + yhPul(Q.qaytarildi) + ' сўм; ушлаб қолинган сумма йўқ. Томонлар ўртасида ўзаро ҳисоб-китоб далолатномаси имзоланди.');
  K.push(BAND + 'га ҳамда Ўзбекистон Республикаси фуқаролик қонунчилигига мувофиқ Шартнома томонларнинг келишувига кўра Харидор ташаббуси билан бекор қилинади.');
  B.push('№' + x.no + '-сонли шартнома ' + yhSozDa(sanaIso) + 'н бошлаб Харидор ташаббуси билан бекор қилинган ҳисоблансин.');
  B.push(x.dokon + ' рақамли дўкон эркин дўконлар рўйхатига қайтарилсин ва қайта сотувга чиқарилсин.');
  B.push('Харидор томонидан тўланган ' + yhPul(x.tolangan) + ' сўм ' + Q.ko2.map(k => k.raqam).join(', ') + '-сонли чиқим касса ордерлари билан тўлиқ қайтарилган деб ҳисоблансин; жарима ва бошқа суммалар ушлаб қолинмасин.');
  B.push('Бухгалтерия Шартнома бўйича ҳисоб-китобни ёпсин; ўзаро ҳисоб-китоб далолатномаси ва чиқим касса ордерлари Шартнома иш материалларига тикилсин.');
  B.push('Харидорга ушбу буйруқ нусхаси топширилсин.');
  B.push('Мазкур буйруқ ижросини назорат қилишни ўз зиммамда қолдираман.');
  return { sarl, K, B };
}
async function buyruqYasa(x, Q, raqam, sanaIso) {
  const M = buyruqMatn(x, Q, raqam, sanaIso);
  const yasa = async k => { const pdf = await PDF.yasa(BH.buyruqHtml(M, raqam, sanaIso, k), '', { scale: 1 / XP.KAT, skript: XP.TEKISLA }); return { pdf, bet: XP.betSoni(pdf) }; };
  let r = await yasa(1), kk = 1;
  if (r.bet > 1) for (const k of [0.95, 0.9, 0.85]) { r = await yasa(k); kk = k; if (r.bet <= 1) break; }
  return Object.assign({ matn: M, k: kk }, r);
}

// ------------------------------------------------------------------ ЎЗАРО ҲИСОБ-КИТОБ ДАЛОЛАТНОМАСИ (A4, Chromium)
function dalolatnomaHtml(x, Q, raqam, dRaqam, sanaIso, m) {
  const tr = (a, b, c, d) => '<tr><td class="c">' + a + '</td><td>' + b + '</td><td>' + c + '</td><td class="r">' + d + '</td></tr>';
  const T = Q.tolovlar.map((t, i) => tr(i + 1, esc(yhDmy(t.sana)), esc((t.shakl === 'Naqt' ? 'нақд' : t.shakl === 'Bank' ? 'банк' : t.shakl === 'Plastik' ? 'пластик' : t.shakl) + (t.hujjat ? ', ҳужжат № ' + t.hujjat : '')), yhPul(t.summa))).join('')
    + '<tr class="j"><td colspan="3">Жами тўланган</td><td class="r">' + yhPul(x.tolangan) + '</td></tr>';
  const K = Q.ko2.map((k, i) => tr(i + 1, esc(yhDmy(k.sana)), 'Чиқим касса ордери № ' + esc(k.raqam), yhPul(k.summa))).join('')
    + '<tr class="j"><td colspan="3">Жами қайтарилган</td><td class="r">' + yhPul(Q.qaytarildi) + '</td></tr>';
  const pas = [m.pasport, m.iib ? m.iib + ' томонидан берилган' : '', m.psana ? yhDmy(m.psana) : ''].filter(Boolean).join(', ');
  return `<!doctype html><html><head><meta charset="utf-8"><style>
@page{size:A4;margin:13mm 14mm 20mm 20mm}*{box-sizing:border-box}body{margin:0;font-family:'Liberation Serif','Times New Roman',serif;font-size:11pt;line-height:1.25;color:#000}
h1{text-align:center;font-size:12.5pt;margin:0 0 1mm;line-height:1.2}.ost{text-align:center;font-size:10.5pt;margin:0 0 3mm}
.r2{display:flex;justify-content:space-between;margin:0 0 3mm}p{margin:0 0 1.6mm;text-align:justify;text-indent:8mm}
h2{font-size:11pt;margin:2mm 0 1mm}table{width:100%;border-collapse:collapse;margin:1mm 0 2mm;page-break-inside:auto}tr{page-break-inside:avoid}
th,td{border:.6pt solid #000;padding:.9mm 2mm;font-size:10pt;vertical-align:middle}th{background:#eee;text-align:center}td.c{text-align:center;width:9mm}td.r{text-align:right;white-space:nowrap}tr.j td{font-weight:bold}
.imz{width:100%;border-collapse:collapse;margin-top:4mm;page-break-inside:avoid}.imz td{border:0;vertical-align:top;width:50%;padding:0 4mm 0 0;font-size:10.5pt;line-height:1.45}
.ch{display:inline-block;border-bottom:.7pt solid #000;vertical-align:bottom}.k{font-size:9.5pt;color:#444}
</style></head><body>
<h1>№ ${esc(x.no)}-СОНЛИ ШАРТНОМАНИ ХАРИДОР ТАШАББУСИ БИЛАН БЕКОР ҚИЛИШ БЎЙИЧА<br>ЎЗАРО ҲИСОБ-КИТОБ ДАЛОЛАТНОМАСИ</h1>
<div class="ost">№ ${esc(dRaqam)}</div>
<div class="r2"><span>Ангор тумани</span><span>${esc(yhSoz(sanaIso))}</span></div>
<p>Биз, қуйида имзо чекувчилар: ${esc(BH.bekorJamiyat(x))} номидан Устав асосида иш юритувчи директор Ҳайдаров Камолиддин Ҳайдарович, бир томондан, ва фуқаро <b>${esc(x.fishK)}</b> (паспорт: ${esc(pas || '____________________')}; кейинги ўринларда – Харидор), иккинчи томондан, ${esc(BAND)}га мувофиқ ушбу далолатномани қуйидагилар тўғрисида туздик:</p>
<p>1. Томонлар ўртасида ${esc(yhSozDa(x.sana))} ${esc(dokonMatn(x))}ни муддатли тўлов шартларида сотиш тўғрисида №${esc(x.no)}-сонли шартнома (кейинги ўринларда – Шартнома) тузилган. Шартноманинг умумий қиймати ${yhPul(x.qiymat)} сўм.</p>
<p>2. Шартнома Харидорнинг ташаббуси билан, томонларнинг келишувига кўра, Жамият директорининг ${esc(yhSozDa(sanaIso))}ги ${esc(raqam)}-сонли буйруғи билан бекор қилинди.</p>
<h2>3. Харидор томонидан Шартнома бўйича тўланган маблағлар:</h2>
<table><tr><th>№</th><th>Сана</th><th>Тўлов шакли, ҳужжат</th><th>Сумма, сўм</th></tr>${T}</table>
<h2>4. Жамият томонидан Харидорга қайтарилган маблағлар:</h2>
<table><tr><th>№</th><th>Сана</th><th>Ҳужжат</th><th>Сумма, сўм</th></tr>${K}</table>
<p>5. Жамият директорининг ${esc(yhSozDa(Q.sana))}ги қарорига мувофиқ Харидорга қайтарилиши лозим бўлган сумма ${yhPul(Q.qaytar)} сўм; ушлаб қолинган сумма — ${yhPul(Q.ushlab)} сўм (жарима ушлаб қолинмади). Қайтарилган сумма ${yhPul(Q.qaytarildi)} сўм. <b>Қолдиқ: ${yhPul(Q.qoldiq)} сўм.</b></p>
<p>6. Томонлар Шартнома бўйича ўзаро ҳисоб-китоб тўлиқ амалга оширилганини тасдиқлайди. Харидор Жамиятга, Жамият Харидорга нисбатан Шартномадан келиб чиқадиган бирор-бир молиявий ва бошқа даъвога эга эмас.</p>
<p>7. ${esc(x.dokon)} рақамли дўкон Жамият ихтиёрида қолади; Харидорнинг ушбу дўконга нисбатан Шартномадан келиб чиқадиган ҳуқуқлари ушбу далолатнома имзоланган кундан тугайди.</p>
<p>8. Ушбу далолатнома икки нусхада тузилди, ҳар бир томонга бир нусхадан берилди; ҳар бир нусха бир хил юридик кучга эга.</p>
<table class="imz"><tr>
<td><b>ЖАМИЯТ:</b><br>«ANGOR KARVON SAROY» МЧЖ<br>Ангор тумани, Гулистон МФЙ, Ат-Термизий кўчаси, 198-уй<br>СТИР 308 489 492<br><br>Директор <span class="ch" style="width:40mm"></span> К.Ҳ.&nbsp;Ҳайдаров<br><span class="k">М.Ў.</span></td>
<td><b>ХАРИДОР:</b><br>${esc(x.fishK)}<br>${esc(m.manzil || '')}<br>Тел.: ${esc(m.tel || '')}<br><br>Имзо: <span class="ch" style="width:45mm"></span><br>Ф.И.Ш. <span class="k">(тўлиқ, ўз қўли билан):</span><br><span class="ch" style="width:100%;height:7mm"></span><br><span class="ch" style="width:100%;height:7mm"></span></td>
</tr></table>
</body></html>`;
}
async function dalolatnomaYasa(x, Q, raqam, dRaqam, sanaIso, m) {
  const pdf = await PDF.yasa(dalolatnomaHtml(x, Q, raqam, dRaqam, sanaIso, m), '', Object.assign({ format: 'A4', preferCSSPageSize: true, printBackground: true },
    MI.chromKol({ imzo: 'Харидор', sarlavha: 'Далолатнома № ' + dRaqam, chap: 57, ong: 40 })));
  return { pdf, bet: XP.betSoni(pdf) };
}

module.exports = { buyruqMatn, buyruqYasa, dalolatnomaHtml, dalolatnomaYasa, BAND };
