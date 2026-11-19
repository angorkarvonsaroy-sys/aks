// AKS TIZIM — 📄 Дўкон сотиб олиш таклифи (A4 PDF). taklif_generator.py (wkhtmltopdf) dan serverga
// ko'chirildi, 19.11.2026 (direktor qarori). Dizayn — AYNAN o'sha: CSS, joylashuv, matn va ranglar
// o'zgartirilmagan. Narx lib/narx.js dan (rasmiy prays-list jadvali, aks holda formula).
// PDF dvigateli — lib/pdf.js (Chromium). Fon ranglari chiqishi uchun printBackground: true.
'use strict';
const P = require('./pdf');
const NR = require('./narx');

// Bozor ochilish sanasi — shu kungacha varaqda banner chiqadi, sana o'tgach o'zi yo'qoladi.
// Bannerni butunlay o'chirish uchun: OCHILISH = null
const OCHILISH = '2026-10-10';
const ZOOM = 0.7685;   // eski wkhtmltopdf varag'i bilan o'lchab topilgan
const OCHILISH_JOY = 'M39 трассаси ёқасида, Таллимарон чорраҳаси ёнида';
const OY = ['январ', 'феврал', 'март', 'апрел', 'май', 'июн', 'июл', 'август', 'сентябр', 'октябр', 'ноябр', 'декабр'];

const s = x => String(Math.round(Number(x) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
const m2 = x => (Number(x) || 0).toFixed(2).replace('.', ',');
const esc = v => String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const bugunIso = () => new Date(Date.now() + 5 * 3600 * 1000).toISOString().slice(0, 10);

const CSS = `  @page { size: A4 portrait; margin: 0; }
  html,body{margin:0;padding:0}
  body{font-family:"DejaVu Sans",sans-serif;color:#132033;font-size:11pt;-webkit-print-color-adjust:exact}
  .page{width:184mm;margin:0 auto;padding:16mm 0 0 0}
  table{border-collapse:collapse;width:100%}

  .eyebrow{font-family:"DejaVu Sans Condensed","DejaVu Sans",sans-serif;font-weight:bold;
    font-size:9.5pt;letter-spacing:2.6px;color:#2A7A85;text-transform:uppercase}
  h1{font-family:"DejaVu Serif",serif;font-size:30pt;font-weight:bold;color:#1B3B5F;margin:7px 0 0;line-height:1.08}
  .sub{font-size:12pt;color:#5C6B7A;margin-top:7px}
  .rule{border-bottom:2.5pt solid #1B3B5F;margin:13px 0 20px;font-size:0;height:0}

  .obj{table-layout:fixed}
  .obj td{background:#F4F7F9;border:1px solid #DCE4EA;padding:16px 15px;width:25%;vertical-align:top}
  .obj .l{font-family:"DejaVu Sans Condensed","DejaVu Sans",sans-serif;font-size:9pt;
    letter-spacing:1.6px;color:#5C6B7A;text-transform:uppercase}
  .obj .v{font-family:"DejaVu Serif",serif;font-size:21pt;font-weight:bold;color:#1B3B5F;padding-top:6px}

  .tavsif{border:1px solid #DCE4EA;border-left:3.5pt solid #2A7A85;
    background:#F8FAFB;padding:9px 13px;margin-top:11px}
  .tavsif .l{font-family:"DejaVu Sans Condensed","DejaVu Sans",sans-serif;
    font-size:9pt;letter-spacing:1.8px;text-transform:uppercase;color:#2A7A85;font-weight:bold}
  .tavsif p{margin:4px 0 0;font-size:10pt;line-height:1.4}
  .hero{border:2.5pt solid #A67C00;background:#F7EFD8;padding:20px 22px 18px;margin-top:14px}
  .hero-in{table-layout:fixed}
  .hero-tag{font-family:"DejaVu Sans Condensed","DejaVu Sans",sans-serif;font-weight:bold;
    font-size:9.5pt;letter-spacing:2.4px;color:#A67C00;text-transform:uppercase}
  .hero-name{font-family:"DejaVu Serif",serif;font-size:26pt;font-weight:bold;color:#1B3B5F;margin:6px 0 18px}
  .hv{table-layout:fixed}
  .hv td{vertical-align:top;padding-right:8px}
  .hv .l{font-family:"DejaVu Sans Condensed","DejaVu Sans",sans-serif;font-size:9pt;
    letter-spacing:1.4px;color:#5C6B7A;text-transform:uppercase}
  .hv .v{font-family:"DejaVu Serif",serif;font-size:16pt;font-weight:bold;padding-top:5px;white-space:nowrap}
  .hv .gold{color:#A67C00}
  .hv .hint{font-size:8pt;color:#8A7A50;line-height:1.35;padding-top:5px}
  .stamp-cell{width:112px;vertical-align:top;padding:0}
  .stamp{width:104px;height:104px;border:3pt solid #A67C00;border-radius:52px;color:#A67C00;
    text-align:center;margin-left:auto}
  .stamp .n{font-family:"DejaVu Serif",serif;font-size:22pt;font-weight:bold;padding-top:25px;line-height:1}
  .stamp .t{font-family:"DejaVu Sans Condensed","DejaVu Sans",sans-serif;font-size:9pt;
    letter-spacing:2px;text-transform:uppercase;padding-top:6px}
  .gift{border-top:1px dashed #C9A94A;margin-top:18px;padding-top:14px;font-size:12pt}
  .gift b{color:#A67C00}

  .sec{font-family:"DejaVu Sans Condensed","DejaVu Sans",sans-serif;font-size:9.5pt;letter-spacing:2.4px;
    text-transform:uppercase;color:#2A7A85;border-bottom:1px solid #DCE4EA;padding-bottom:7px;margin:18px 0 12px}
  .cards{table-layout:fixed}
  .cards td{vertical-align:top;width:32%}
  .cards td.gap{width:2%;padding:0}
  .card{border:1px solid #DCE4EA;border-top:3.5pt solid #2A7A85;padding:18px 15px 18px}
  .card-name{font-family:"DejaVu Serif",serif;font-size:13pt;font-weight:bold;color:#1B3B5F;
    line-height:1.3;height:48px}
  .rows{margin-top:4px}
  .rows{table-layout:fixed}
  .rows td{padding:8px 0;border-bottom:1px dotted #DCE4EA}
  .rows td.k{width:44%;padding-right:6px}
  .rows .k{font-family:"DejaVu Sans Condensed","DejaVu Sans",sans-serif;font-size:9pt;
    color:#5C6B7A;text-transform:uppercase;letter-spacing:.8px}
  .rows .n{text-align:right;font-weight:bold;font-size:11pt;white-space:nowrap}
  .monthly{background:#F4F7F9;margin-top:14px;padding:14px 6px;text-align:center}
  .monthly .l{font-family:"DejaVu Sans Condensed","DejaVu Sans",sans-serif;font-size:9pt;
    letter-spacing:1.6px;text-transform:uppercase;color:#5C6B7A}
  .monthly .v{font-family:"DejaVu Serif",serif;font-size:19pt;font-weight:bold;color:#2A7A85;padding-top:4px}
  .save{margin-top:11px;border:1px solid #E0CE9A;background:#FBF6E9;padding:9px 10px;text-align:center}
  .save .l{font-family:"DejaVu Sans Condensed","DejaVu Sans",sans-serif;font-size:8.5pt;
    letter-spacing:1.5px;text-transform:uppercase;color:#8A7A50}
  .save .v{font-family:"DejaVu Serif",serif;font-size:14pt;font-weight:bold;color:#A67C00;padding-top:2px}
  .save.base{border-color:#C9D6DE;background:#F4F7F9}
  .save.base .l{color:#5C6B7A}
  .save.base .v{color:#1B3B5F}
  .card-gift{margin-top:12px;font-size:10.5pt;line-height:1.4;height:44px}
  .card-gift b{color:#2A7A85}

  .foot{margin-top:10mm}
  table.och{margin:0 0 14px;background:#1B3B5F;table-layout:fixed}
  table.och td{padding:11px 16px;vertical-align:middle;color:#fff}
  table.och td.s{width:92px;text-align:center;border-right:1px solid #3D5A7C;
    font-family:"DejaVu Serif",serif;font-weight:bold;font-size:30pt;line-height:1;color:#E3C06A}
  table.och td.s span{display:block;font-family:"DejaVu Sans Condensed","DejaVu Sans",sans-serif;
    font-size:9pt;letter-spacing:2.4px;padding-top:4px}
  table.och .t{font-family:"DejaVu Serif",serif;font-size:14pt;font-weight:bold;color:#fff}
  table.och .m{font-size:10pt;line-height:1.45;color:#D6E0EA;padding-top:4px}
  .note{border-top:1px solid #DCE4EA;padding-top:13px;font-size:9.5pt;color:#5C6B7A;line-height:1.7}
  .sign{margin-top:26px;table-layout:fixed}
  .sign td{width:31%;padding-top:40px}
  .sign td.sp{width:3.5%;padding:0}
  .sign .line{border-bottom:1px solid #132033;font-size:0;height:0}
  .sign .cap{font-family:"DejaVu Sans Condensed","DejaVu Sans",sans-serif;font-size:9pt;
    letter-spacing:1.5px;text-transform:uppercase;color:#5C6B7A;padding-top:7px}`;

// Bitta tarif kartasi (120 mln · 60 mln · boshlang'ichsiz)
function karta(nom, k, yorliq, sovga, asosmi) {
  const qator = asosmi
    ? '<div class="save base"><div class="l">Ҳақиқий нархи</div><div class="v">' + s(k.jami) + '</div></div>'
    : '<div class="save"><div class="l">Тежайсиз ' + yorliq + '</div><div class="v">' + s(k.tejash) + '</div></div>';
  const boshl = asosmi ? '—' : s(nom === '120' ? 120000000 : 60000000);
  const sarlavha = asosmi ? 'Бошланғич<br>тўловсиз' : boshl + ' сўм<br>бошланғич тўлов';
  return `      <td>
        <div class="card">
          <div class="card-name">${sarlavha}</div>
          <table class="rows">
            <tr><td class="k">1 м²</td><td class="n">${s(k.m2)}</td></tr>
            <tr><td class="k">Умумий</td><td class="n">${s(k.jami)}</td></tr>
            <tr><td class="k">Бошланғич</td><td class="n">${boshl}</td></tr>
          </table>
          <div class="monthly"><div class="l">36 ой — ойига</div><div class="v">${s(k.oylik)}</div></div>
          ${qator}
          <div class="card-gift"><b>Совға:</b> ${sovga}</div>
        </div>
      </td>`;
}

// d: { blok, qavat, no, maydon, baza, qurilish }   h: lib/narx.js hisobla() natijasi
function html(d, h, izoh) {
  const SOVGA = NR.NARX.sovga;
  const qurIzoh = /тугалланган/i.test(String(d.qurilish || ''))
    ? 'Дўкон қурилиши тугалланган ва фойдаланишга топширишга тайёр.'
    : 'Дўкон қурилиши ҳозирча якунланмаган — фойдаланишга топшириш муддати шартномада белгиланади.';
  let ochilish = '';
  if (OCHILISH && bugunIso() <= OCHILISH) {
    const p = OCHILISH.split('-'), kun = Number(p[2]), oy = OY[Number(p[1]) - 1];
    ochilish = '<table class="och"><tr><td class="s">' + kun + '<span>' + oy.toUpperCase() + '</span></td>'
      + '<td><div class="t">Бозор тўлиқ ишга тушади!</div><div class="m">«Ангор Карвон Саройи» савдо комплекси '
      + p[0] + ' йил ' + kun + ' ' + oy + 'дан тўлиқ фаолият бошлайди. ' + OCHILISH_JOY
      + '. Дўконингизни очилишгача банд қилиб қўйинг.</div></td></tr></table>';
  }
  const tavsif = izoh ? '<div class="tavsif"><div class="l">Дўкон тавсифи</div><p>' + esc(izoh).replace(/\n/g, '<br>') + '</p></div>' : '';
  return `<!DOCTYPE html>
<html lang="uz-Cyrl">
<head>
<meta charset="utf-8">
<title>Дўкон таклифи — ${esc(d.blok)} блок, ${esc(d.qavat)}-қават, ${esc(d.no)}-дўкон</title>
<style>${CSS}</style>
</head>
<body>
<div class="page">

  <div class="eyebrow">«Ангор Карвон Сарой» МЧЖ</div>
  <h1>Дўкон сотиб олиш таклифи</h1>
  <div class="sub">Тўртта тўлов тарифи — ўзингизга қулайини танланг</div>
  <div class="rule"></div>
  ${ochilish}

  <table class="obj">
    <tr>
      <td><div class="l">Блок</div><div class="v">${esc(d.blok)}</div></td>
      <td><div class="l">Қават</div><div class="v">${esc(d.qavat)}-қават</div></td>
      <td><div class="l">Дўкон</div><div class="v">№ ${esc(d.no)}</div></td>
      <td><div class="l">Майдони</div><div class="v">${m2(d.maydon)} м²</div></td>
    </tr>
  </table>

  ${tavsif}
  <div class="hero">
    <table class="hero-in">
      <tr>
        <td style="vertical-align:top">
          <div class="hero-tag">Энг фойдали шарт</div>
          <div class="hero-name">100% нақд тўлов</div>
          <table class="hv">
            <tr>
              <td><div class="l">1 м² нархи</div><div class="v">${s(h.naqd.m2)}</div></td>
              <td><div class="l">Умумий қиймати</div><div class="v">${s(h.naqd.jami)}</div></td>
              <td><div class="l">Тежаб қоласиз</div><div class="v gold">${s(h.naqd.tejash)}</div>
                  <div class="hint">бошланғич тўловсиз<br>нархга нисбатан &#8722;29,8%</div></td>
            </tr>
          </table>
        </td>
        <td class="stamp-cell">
          <div class="stamp"><div class="n">&#8722;30%</div><div class="t">Чегирма</div></div>
        </td>
      </tr>
    </table>
    <div class="gift"><b>Совға:</b> ${SOVGA.naqd}</div>
  </div>

  <div class="sec">Бўлиб тўлаш — 36 ой</div>

  <table class="cards">
    <tr>
${karta('120', h['120'], '&#8722;20%', SOVGA['120'], false)}
      <td class="gap"></td>
${karta('60', h['60'], '&#8722;13,3%', SOVGA['60'], false)}
      <td class="gap"></td>
${karta('yoq', h.yoq, '', SOVGA['0'], true)}
    </tr>
  </table>

  <div class="foot">
  <div class="note">
    Барча нархлар ўзбек сўмида кўрсатилган ва айнан ушбу дўкон (${m2(d.maydon)} м²) учун ҳисобланган.
    Бўлиб тўлаш муддати — 36 ой; тўлов жадвали шартнома имзолангандан сўнг расмийлаштирилади.
    ${qurIzoh}
    Совғалар ва таклиф шартлари чекланган муддат давомида амал қилади.
  </div>

  <table class="sign">
    <tr>
      <td><div class="line"></div><div class="cap">Мижоз Ф.И.Ш.</div></td>
      <td class="sp"></td>
      <td><div class="line"></div><div class="cap">Имзо</div></td>
      <td class="sp"></td>
      <td><div class="line"></div><div class="cap">Сана</div></td>
    </tr>
  </table>
  </div>

</div>
</body>
</html>`;
}

// d — do'kon; izoh — ixtiyoriy tavsif. Qaytaradi: { nom, pdf (Buffer), hisob, ogoh }
async function taklifYasa(d, izoh) {
  const h = NR.hisobla(d.baza, d.maydon);
  const ogoh = [];
  if (!h.rasmiy) ogoh.push('База ' + s(d.baza) + ' прайс-листда йўқ — бўлиб тўлаш нархлари формула бўйича экстраполяция, расман тасдиқланмаган.');
  if (d.taqiq) ogoh.push('ТАЪҚИҚ: дўкон тақиқда — расмийлаштиришдан олдин ечилиши керак.');
  if (d.rais) ogoh.push('РАИСГА АЖРАТИЛГАН дўкон — сотувга чиқарилганини тасдиқланг.');
  if (/якунланмаган/i.test(String(d.qurilish || ''))) ogoh.push('Қурилиши якунланмаган.');
  // wkhtmltopdf --dpi 300 varaqni ~0,7685 ga kichiklashtirib chizardi; Chromium 1:1 chizadi va
  // ikki betga tushib ketadi. Eski varaq bilan o'lchab solishtirildi: .page kengligi 141,4 mm,
  // chap chekka 34,0 mm. zoom shuni aynan takrorlaydi — dizayn o'zgarmaydi.
  const pdf = await P.yasa(html(d, h, izoh), 'body{zoom:' + ZOOM + '}', { printBackground: true });
  const nom = 'Taklif_' + String(d.blok).replace(/\s+/g, '') + '_' + d.qavat + '_' + d.no;
  return { nom, pdf, hisob: h, ogoh };
}

module.exports = { taklifYasa, html, OCHILISH };
