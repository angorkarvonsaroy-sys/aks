// AKS TIZIM — 🧾 KIRIM KASSA ORDERI (KO-1) varag'i (11.11.2026, direktor): loyihadagi ko1_generator.py bilan AYNAN bir xil ko'rinish —
// shapka, jadval, kesish chizig'i, kvitansiya, 40 mm muhr (faqat KO-1 da muhr bor), «Мижозга эслатма» bloki. A4, 1 bet.
// «Мижозга эслатма» qoidasi: shartnoma qiymati va jami to'langan KO'RSATILMAYDI — faqat qarz (асосий / шундан муддати ўтган /
// қўшимча майдон (bo'lsa) / жами), oylik to'lov, to'lov kuni, jadval tugashi; tugashiga 31 kundan kam qolsa — ogohlantirish.
// Qarz to'liq yopilsa — yashil «якунланди» bloki (bu holda qiymat va jami to'langan ko'rsatiladi). Bazaga hech narsa yozmaydi.
'use strict';
const SH = require('./sotuv_hujjat');
const { xatKirill } = require('./ism');
const s = v => String(v == null ? '' : v);
const pul = n => Math.round(Number(n) || 0).toLocaleString('ru-RU').replace(/[  ,]/g, ' ');
const esc = x => s(x).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const dmy = iso => s(iso).split('-').reverse().join('.');
const OYLAR = ['январ', 'феврал', 'март', 'апрел', 'май', 'июн', 'июл', 'август', 'сентябр', 'октябр', 'ноябр', 'декабр'];
const sanaSoz = iso => { const p = s(iso).split('-'); return p.length === 3 ? Number(p[2]) + ' ' + OYLAR[Number(p[1]) - 1] + ' ' + p[0] + ' йил' : '—'; };
const telFmt = t => { let d = s(t).replace(/\D/g, ''); if (d.indexOf('998') === 0 && d.length === 12) d = d.slice(3); return d.length === 9 ? '+998 ' + d.slice(0, 2) + ' ' + d.slice(2, 5) + ' ' + d.slice(5, 7) + ' ' + d.slice(7) : (s(t).trim() || '—'); };
const kunFarq = (a, b) => Math.round((new Date(a + 'T00:00:00Z') - new Date(b + 'T00:00:00Z')) / 86400000);
// «Асос» — dasturda saqlangan to'lov maqsadidan (tolovMaqsad yozgan matn): ism va majmua nomi tashlanadi; boshqacha (qo'lda) matn ishlatilmaydi
function asosMatn(maqsad, kim) {
  maqsad = s(maqsad).trim();
  if (!maqsad || /^migratsiya/i.test(s(kim))) return { matn: null, qolda: false };
  const belgi = 'савдо мажмуасидан ';
  if (maqsad.indexOf(belgi) >= 0 && maqsad.indexOf('сонли шартнома') >= 0) return { matn: esc(maqsad.split(belgi).slice(1).join(belgi).trim()), qolda: false };
  return { matn: null, qolda: true };
}
const CSS = `  :root{
    --indigo:#1B3B5F;
    --oltin:#A67C00;
    --pechat:#2436A7;
    --chiziq:#B9C4D0;
  }
  *{box-sizing:border-box;margin:0;padding:0}
  html,body{background:#EDEFF2}
  body{font-family:"DejaVu Sans","Liberation Sans",Arial,sans-serif;padding:8mm 0;color:#111}
  .varaq{
    width:210mm;height:295mm;margin:0 auto;background:#fff;
    padding:10mm 13mm 6mm;box-shadow:0 2px 14px rgba(0,0,0,.18);
    display:flex;flex-direction:column;overflow:hidden;
  }

  .shapka{border-bottom:2px solid var(--indigo);padding-bottom:3px}
  .tashkilot{font-family:"DejaVu Serif","Liberation Serif","Times New Roman",serif;font-size:12.5pt;font-weight:700;color:var(--indigo);letter-spacing:.3px}
  .rekvizit{font-size:7.3pt;color:#4A5560;line-height:1.4;margin-top:1.5px}
  .rekvizit span{color:#0F1720;font-weight:700}

  .sarlavha{text-align:center;margin-top:5mm}
  .sarlavha h1{font-family:"DejaVu Serif","Liberation Serif","Times New Roman",serif;font-size:14.5pt;font-weight:700;
    color:var(--indigo);letter-spacing:1.4px;text-transform:uppercase;line-height:1.15}
  .sarlavha .shakl{font-size:7.3pt;color:#7A838C;margin-top:.5mm;letter-spacing:.5px}

  .raqam-qator{display:flex;justify-content:center;gap:14mm;margin-top:3.4mm;font-size:9.5pt}
  .raqam-qator b{color:var(--indigo)}
  .bosh{display:inline-block;min-width:24mm;border-bottom:1px solid var(--indigo);text-align:center}

  table.maydon{width:100%;border-collapse:collapse;margin-top:4.5mm}
  table.maydon td{border:1px solid var(--chiziq);padding:1.5mm 2.5mm;font-size:9.2pt;vertical-align:middle}
  td.yorliq{width:44mm;background:#F4F6F9;color:#3A4652;font-size:7.7pt;
            text-transform:uppercase;letter-spacing:.28px;font-weight:700}
  td.qiymat{font-weight:700;color:#0F1720}
  .summa-katak{background:#FFFBF0}
  .summa-raqam{font-family:"DejaVu Serif","Liberation Serif","Times New Roman",serif;font-size:14pt;font-weight:700;color:var(--oltin)}
  .summa-soz{font-family:"DejaVu Serif","Liberation Serif","Times New Roman",serif;font-style:italic;font-size:10pt;color:#0F1720}

  .imzolar{display:flex;gap:10mm;margin-top:6mm}
  .imzo{flex:1}
  .imzo .chiziq{border-bottom:1px solid #46505A;height:7mm}
  .imzo .nom{font-size:7.6pt;color:#5A646E;margin-top:1.2mm}

  .kesish{margin:6mm 0 4.5mm;border-top:1.4px dashed #9AA4AE;position:relative}
  .kesish span{position:absolute;top:-7px;left:50%;transform:translateX(-50%);
    background:#fff;padding:0 4mm;font-size:7.2pt;color:#7A838C;letter-spacing:1.3px}

  .kvitansiya{border:1.4px solid var(--indigo);padding:4mm 5mm;position:relative;min-height:48mm}
  .kvitansiya h2{font-family:"DejaVu Serif","Liberation Serif","Times New Roman",serif;font-size:11pt;color:var(--indigo);
    text-align:center;letter-spacing:1.1px;text-transform:uppercase;margin-bottom:2.6mm}
  .kv-qator{font-size:9pt;line-height:1.9;color:#1A222B;padding-right:46mm}
  .kv-qator b{color:#0F1720}
  .toldir{border-bottom:1px dotted #7A838C;padding:0 2mm}

  .muhr{position:absolute;right:5mm;bottom:3mm;width:40mm;height:40mm;
        transform:rotate(-12deg);opacity:.88}
  .muhr text{font-family:"DejaVu Sans","Liberation Sans",Arial,sans-serif;fill:var(--pechat);font-weight:700}
  .ogoh{margin-top:4.5mm;border:1px solid var(--oltin);border-left:3px solid var(--oltin);
        background:#FFFCF4;padding:3mm 4mm}
  .ogoh h3{font-family:"DejaVu Serif","Liberation Serif","Times New Roman",serif;font-size:9.4pt;color:var(--oltin);
           letter-spacing:.45px;text-transform:uppercase;margin-bottom:1.8mm}
  .ogoh p{font-size:8.4pt;line-height:1.5;color:#1A222B;margin-bottom:1.4mm}
  .ogoh p:last-child{margin-bottom:0}
  .raqamlar{display:flex;gap:4mm;margin:2.2mm 0;padding:1.8mm 0;
            border-top:1px solid #E4D9BC;border-bottom:1px solid #E4D9BC}
  .raqamlar div{flex:1;text-align:center}
  .raqamlar .yorl{font-size:6.9pt;color:#6B6250;text-transform:uppercase;letter-spacing:.2px}
  .raqamlar .qiy{font-family:"DejaVu Serif","Liberation Serif","Times New Roman",serif;font-size:10.5pt;font-weight:700;color:var(--indigo);margin-top:.7mm}

  .ogoh.yopildi{border-color:#2F7D5B;border-left-color:#2F7D5B;background:#F4FBF7}
  .ogoh.yopildi h3{color:#2F7D5B}
  .ogoh.yopildi .raqamlar{border-color:#CBE5D8}
  .raqamlar .qiy.nol{color:#2F7D5B;font-size:12.5pt}
  .ogoh .imzo-qator{margin-top:2.2mm;font-size:8pt;color:#3A4652}
  .izoh{margin-top:auto;padding-top:2.5mm;font-size:7pt;color:#7A838C;text-align:center}

  @media print{
    html,body{background:#fff}
    body{padding:0}
    .varaq{box-shadow:none;margin:0;width:210mm;height:295mm;page-break-after:avoid}
    @page{size:A4 portrait;margin:0}
  }
`;
const MUHR = `    <svg class="muhr" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <path id="tepa" d="M 100,100 m -76,0 a 76,76 0 1,1 152,0" fill="none"/>
        <path id="past" d="M 100,100 m -64,0 a 64,64 0 1,0 128,0" fill="none"/>
      </defs>
      <circle cx="100" cy="100" r="88" fill="none" stroke="#2436A7" stroke-width="4"/>
      <circle cx="100" cy="100" r="79" fill="none" stroke="#2436A7" stroke-width="1.6"/>
      <circle cx="100" cy="100" r="52" fill="none" stroke="#2436A7" stroke-width="1.6"/>
      <text font-size="15" letter-spacing="1.6">
        <textPath href="#tepa" startOffset="50%" text-anchor="middle">ANGOR KARVON SAROY</textPath>
      </text>
      <text font-size="11" letter-spacing="1.2">
        <textPath href="#past" startOffset="50%" text-anchor="middle">МЧЖ · СТИР 308 489 492</textPath>
      </text>
      <text x="100" y="93" text-anchor="middle" font-size="17" letter-spacing="1">КИРИМ</text>
      <text x="100" y="115" text-anchor="middle" font-size="17" letter-spacing="1">КАССА</text>
      <line x1="62" y1="100" x2="78" y2="100" stroke="#2436A7" stroke-width="1.6"/>
      <line x1="122" y1="100" x2="138" y2="100" stroke="#2436A7" stroke-width="1.6"/>
    </svg>`;
const N = '№';
const qisqaIsm = fish => { const q = s(fish).trim().split(/\s+/); return q.length >= 3 ? q.slice(1, 3).join(' ') : s(fish); };

function ogohYopildi(o, dok, mayd) {
  return `  <div class="ogoh yopildi">
    <h3>Шартнома бўйича ҳисоб-китоб якунланди</h3>
    <p>Ҳурматли <b>${esc(qisqaIsm(o.fishK))}</b>! Ушбу тўлов билан ${N} ${esc(o.no)} сонли шартнома бўйича мажбуриятингиз <b>тўлиқ бажарилди</b>. Қарздорлик мавжуд эмас.</p>
    <div class="raqamlar">
      <div><div class="yorl">Шартнома қиймати</div><div class="qiy">${pul(o.umumiy)}</div></div>
      <div><div class="yorl">Жами тўланган</div><div class="qiy">${pul(o.tolangan)}</div></div>
      <div><div class="yorl">Қолган қарз</div><div class="qiy nol">0</div></div>
    </div>
    <p>${dok} (${mayd} м²) фойдаланишга топширилган. Мулк ҳужжатларини расмийлаштириш ва қабул-топшириш далолатномасини имзолаш учун корхонага мурожаат қилишингизни сўраймиз.</p>
    <p>Мурожаат учун: «ANGOR KARVON SAROY» МЧЖ &nbsp;·&nbsp; тел. +998 95-557-88-88</p>
  </div>`;
}
function ogohOddiy(o) {
  let satr = '';
  if (o.oylik && o.tugash) {
    const kuni = o.tolovKuni || Number(o.tugash.slice(8, 10));
    const muddat = o.tugash < o.sana ? `Тўлов жадвали <b>${dmy(o.tugash)}</b> да тугаган — қолган қарз тўлиқ тўланиши лозим.` : `Тўлов жадвали <b>${dmy(o.tugash)}</b> да тугайди.`;
    satr = `    <p>Шартнома бўйича ойлик тўлов — <b>${pul(o.oylik)} сўм</b>, ҳар ойнинг <b>${kuni}-санасигача</b> амалга оширилиши лозим. ${muddat}</p>\n`;
    const q = kunFarq(o.tugash, o.sana);
    if (q >= 0 && q < 31) satr += '    <p><b>Диққат:</b> тўлов жадвали тугашига 1 ойдан кам вақт қолди — шу муддатгача қарз тўлиқ узилиши лозим.</p>\n';
  }
  const mot = o.motgan > 0 ? '    <p>Ҳозирда муддати ўтган қарздорлик мавжуд. Сиздан корхонага мурожаат қилиб, қолган қарзни узиш бўйича тўлов режасини аниқлаштиришингизни сўраймиз.</p>\n' : '';
  const qm = o.qoshimcha > 0 ? `      <div><div class="yorl">Қўшимча майдон учун қарз</div><div class="qiy">${pul(o.qoshimcha)}</div></div>\n` : '';
  return `  <div class="ogoh">
    <h3>Мижозга эслатма</h3>
    <p>Ҳурматли <b>${esc(qisqaIsm(o.fishK))}</b>! Тўловингиз учун раҳмат. Шу билан бирга ${N}&nbsp;${esc(o.no)} сонли шартнома бўйича ${dmy(o.sana)} ҳолатига қарздорлигингизни эътиборингизга ҳавола этамиз.</p>
    <div class="raqamlar">
      <div><div class="yorl">Асосий қарз</div><div class="qiy">${pul(o.asosiy)}</div></div>
      <div><div class="yorl">Шундан муддати ўтган</div><div class="qiy">${pul(o.motgan)}</div></div>
${qm}      <div><div class="yorl">Жами қарздорлик</div><div class="qiy">${pul(o.jami)}</div></div>
    </div>
${satr}${mot}    <div class="imzo-qator">Мурожаат учун: «ANGOR KARVON SAROY» МЧЖ &nbsp;·&nbsp; директор — Ҳайдаров Камолиддин</div>
  </div>`;
}
// o: { raqam, sana (iso), fish (bazadagi), mid, tel, no, shSana (iso), blok, qavat, dokon, maydon, summa, asos (tayyor matn yoki null),
//      asosiy, motgan, qoshimcha, jami, tolangan, umumiy, oylik, tolovKuni, tugash (iso) }
function html(o) {
  o = Object.assign({}, o); o.fishK = xatKirill(o.fish);
  const FISH = esc(o.fishK.toUpperCase());
  const dok = `${esc(o.blok)} блок, ${esc(o.qavat)}-қават, ${N} ${esc(o.dokon)}-дўкон`;
  const mayd = o.maydon ? Number(o.maydon).toFixed(2).replace('.', ',') : '—';
  const yopildi = o.jami <= 1;
  let asos, kvAsos, ogoh;
  if (yopildi) {
    asos = `${N} ${esc(o.no)} сонли шартнома бўйича <b>якуний тўлов</b> (қарзни тўлиқ узиш)`;
    kvAsos = `${N} ${esc(o.no)} сонли шартнома бўйича <b>якуний тўлов</b> — қарз тўлиқ узилди`;
    ogoh = ogohYopildi(o, dok, mayd);
  } else {
    asos = kvAsos = o.asos || `${N} ${esc(o.no)} сонли шартномага асосан дўкон сотиб олиш учун тўлов`;
    ogoh = ogohOddiy(o);
  }
  const sd = dmy(o.sana), soz = SH.sozBilan(o.summa), nb = '&nbsp;'.repeat(7), nb2 = '&nbsp;'.repeat(11);
  const rq = o.raqam ? esc(o.raqam) : '';
  return `<!DOCTYPE html>
<html lang="uz-Cyrl">
<head>
<meta charset="UTF-8">
<title>Кирим касса ордери — ${esc(o.no)} — ${sd}</title>
<style>${CSS}</style>
</head>
<body>
<div class="varaq">

  <div class="shapka">
    <div class="tashkilot">«ANGOR KARVON SAROY» МЧЖ</div>
    <div class="rekvizit">
      СТИР: <span>308 489 492</span> &nbsp;·&nbsp; Ҳ/р: <span>20208000305390706001</span><br>
      АТ «Халқ банк» Термиз шаҳар филиали &nbsp;·&nbsp; МФО: <span>01125</span>
    </div>
  </div>

  <div class="sarlavha">
    <h1>Кирим касса ордери</h1>
    <div class="shakl">КО-1 шакли</div>
  </div>

  <div class="raqam-qator">
    <div><b>Рақам:</b> <span class="bosh">${rq || '&nbsp;'}</span></div>
    <div><b>Сана:</b> <span class="bosh">${sd}</span></div>
  </div>

  <table class="maydon">
    <tr>
      <td class="yorliq">Кимдан қабул қилинди</td>
      <td class="qiymat" colspan="3">${FISH}</td>
    </tr>
    <tr>
      <td class="yorliq">Мижоз ID</td>
      <td class="qiymat" style="width:24mm">${esc(o.mid)}</td>
      <td class="yorliq" style="width:28mm">Телефон</td>
      <td class="qiymat">${esc(telFmt(o.tel))}</td>
    </tr>
    <tr>
      <td class="yorliq">Шартнома</td>
      <td class="qiymat">${N} ${esc(o.no)}</td>
      <td class="yorliq">Шартнома санаси</td>
      <td class="qiymat">${sanaSoz(o.shSana)}</td>
    </tr>
    <tr>
      <td class="yorliq">Дўкон</td>
      <td class="qiymat" colspan="3">${dok} &nbsp;·&nbsp; ${mayd} м²</td>
    </tr>
    <tr>
      <td class="yorliq">Асос</td>
      <td colspan="3" style="font-weight:400">${asos}</td>
    </tr>
    <tr class="summa-katak">
      <td class="yorliq">Қабул қилинди</td>
      <td colspan="3"><span class="summa-raqam">${pul(o.summa)}</span> <span style="font-size:9.2pt">сўм</span></td>
    </tr>
    <tr class="summa-katak">
      <td class="yorliq">Сўз билан</td>
      <td colspan="3"><span class="summa-soz">${soz.charAt(0).toUpperCase() + soz.slice(1)} сўм 00 тийин</span></td>
    </tr>
  </table>

  <div class="imzolar">
    <div class="imzo"><div class="chiziq"></div><div class="nom">Бош ҳисобчи — имзо, Ф.И.О.</div></div>
    <div class="imzo"><div class="chiziq"></div><div class="nom">Кассир — имзо, Ф.И.О.</div></div>
    <div class="imzo"><div class="chiziq"></div><div class="nom">Топширди — имзо, Ф.И.О.</div></div>
  </div>

  <div class="kesish"><span>К Е С И Ш   Ч И З И Ғ И</span></div>

  <div class="kvitansiya">
    <h2>Квитанция</h2>
    <div class="kv-qator">
      Кирим касса ордери ${N} ${rq ? '<b>' + rq + '</b>' : '<span class="toldir">' + nb + '</span>'}
      &nbsp; сана <b>${sd}</b><br>
      Кимдан қабул қилинди: <b>${FISH}</b> &nbsp;(ID ${esc(o.mid)})<br>
      Асос: ${kvAsos}<br>
      Суммаси: <b>${pul(o.summa)} сўм</b> — <i>${soz} сўм</i><br>
      Бош ҳисобчи: <span class="toldir">${nb2}</span>
      &nbsp; Кассир: <span class="toldir">${nb2}</span>
    </div>

${MUHR}
  </div>

${ogoh}

  <div class="izoh">Ҳужжат «ANGOR KARVON SAROY» МЧЖ томонидан расмийлаштирилди.</div>

</div>
</body>
</html>`;
}
// PDF: Chromium (lib/pdf.js), chekkasiz A4, fon ranglari bilan
async function pdf(o) { return require('./pdf').yasa(html(o), null, { printBackground: true, margin: { top: 0, right: 0, bottom: 0, left: 0 } }); }

module.exports = { html, pdf, asosMatn };
