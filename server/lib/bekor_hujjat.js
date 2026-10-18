// AKS TIZIM — shartnomani bir tomonlama bekor qilish hujjatlari serverda (Bekor.gs v25.8.5 bekorBuyruq_ + bekorXabarnoma_ + bekorPulBand_ +
// bekorJamiyat_ bilan bir xil matn va joylashuv): BUYRUQ (oddiy shakl, muhrsiz) va XABARNOMA (rasmiy blankada — lib/xat_pdf.js blankaYasa).
// Eski tizim ikkalasini Google Docs'da yasab PDF qiladi; bu yerda HTML → Chromium (xat bilan bir xil usul: 8× terish, Docs shrift va tekislash qoidalari).
// Word (.docx) nusxasi ham shu yerda yasaladi (eski tizimdagi Google Doc nusxasining o'rniga — «Word» tugmasi uchun).
'use strict';
const PDF = require('./pdf');
const XP = require('./xat_pdf');
const { xatKirill } = require('./ism');

const s = v => String(v == null ? '' : v);
const esc = v => s(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const XAT_OY = XP.XAT_OY;
const BEKOR_TOPSHIRISH_KUN = 10;
const BEKOR_ESKI_NEUSTOYKA = '';   // 4.2.5 — Badalov javobigacha bo'sh (Bekor.gs dagidek)
const BEKOR_BAND = { YANGI_TAYYOR: '3.3.1 ва 4.1-бандлари', YANGI_QURILAYOTGAN: '5.3-банди', ESKI_TAYYOR: '4.2.1-банди',
  ESKI_QURILAYOTGAN: '4.2.1-банди', IJARA: '6.2 ва 6.3-бандлари' };

// ------------------------------------------------------------------ Yurhujjat.gs yordamchilari
function yhSoz(iso) { iso = s(iso); if (!/^\d{4}-\d{2}-\d{2}/.test(iso)) return iso || '—'; return iso.slice(0, 4) + ' йил ' + Number(iso.slice(8, 10)) + ' ' + XAT_OY[Number(iso.slice(5, 7)) - 1]; }
function yhSozDa(iso) { const t = yhSoz(iso); return /^\d{4} йил/.test(t) ? t + 'да' : t; }
const yhPul = n => Math.round(Number(n) || 0).toLocaleString('ru-RU').replace(/[  ,]/g, ' ');
function yhDmy(v) { v = s(v); return /^\d{4}-\d{2}-\d{2}/.test(v) ? v.slice(0, 10).split('-').reverse().join('.') : v; }
function yhIso(v) { v = s(v).trim(); if (/^\d{4}-\d{2}-\d{2}/.test(v)) return v.slice(0, 10); if (/^\d{2}\.\d{2}\.\d{4}/.test(v)) return v.slice(0, 10).split('.').reverse().join('-'); return ''; }

// ------------------------------------------------------------------ Bekor.gs matnlari
// Jarima va qaytariladigan summa — shartnoma turiga qarab (bekorPul_)
function bekorPul(x) {
  if (x.shablon === 'YANGI_TAYYOR') { const j = Math.round(x.qiymat * 0.15); return { jarima: j, qaytar: Math.max(0, x.tolangan - j), eski: false }; }
  if (x.shablon === 'YANGI_QURILAYOTGAN') { const j2 = Math.round(x.tolangan * 0.20); return { jarima: j2, qaytar: Math.max(0, x.tolangan - j2), eski: false }; }
  if (x.shablon === 'ESKI_TAYYOR' || x.shablon === 'ESKI_QURILAYOTGAN') return { jarima: 0, qaytar: x.tolangan, eski: true };
  return { jarima: 0, qaytar: 0, eski: false };
}
function bekorJamiyat(x) {
  return /^ESKI/.test(x.shablon)
    ? 'ООО «ANGOR INDEX» (ҳозирги номи — «ANGOR KARVON SAROY» МЧЖ, СТИР 308 489 492; кейинги ўринларда – Жамият)'
    : '«ANGOR KARVON SAROY» МЧЖ (кейинги ўринларда – Жамият)';
}
function bekorPulBand(x, P) {
  if (/^ESKI/.test(x.shablon)) {
    if (!x.tolangan) return 'Шартнома бўйича тўлов амалга оширилмагани сабабли Мижозга қайтариладиган сумма йўқ.';
    return 'Мижоз томонидан тўланган ' + yhPul(x.tolangan) + ' сўм Шартноманинг 4.2.2-бандига мувофиқ 20 банк куни ичида Мижознинг ҳисоб рақамига қайтарилсин' + BEKOR_ESKI_NEUSTOYKA + '.';
  }
  if (x.shablon === 'YANGI_QURILAYOTGAN') {
    if (!x.tolangan) return 'Шартнома бўйича тўлов амалга оширилмагани сабабли Мижозга қайтариладиган сумма йўқ.';
    return 'Мижоз томонидан тўланган ' + yhPul(x.tolangan) + ' сўмдан Шартноманинг 5.4-бандига мувофиқ 20 фоиз миқдорида '
      + yhPul(P.jarima) + ' сўм жарима ушлаб қолинсин; қолган ' + yhPul(P.qaytar)
      + ' сўм Шартноманинг 6.2-бандига мувофиқ қурилиш қабул қилиниб, дўкон қайта сотилганидан кейин 20 банк куни ичида Мижозга қайтарилсин.';
  }
  if (!x.tolangan) return 'Шартнома бўйича тўлов амалга оширилмагани сабабли Мижозга қайтариладиган сумма йўқ. Дўкон Мижоздан қабул қилиш-топшириш далолатномаси ва инвентаризация билан қабул қилиб олинсин (Шартноманинг 4.5-банди).';
  if (P.qaytar <= 0)
    return 'Мижоз томонидан тўланган ' + yhPul(x.tolangan) + ' сўм Шартноманинг 3.3.2-бандига мувофиқ ҳисобланган '
      + yhPul(P.jarima) + ' сўм (шартнома умумий қийматининг 15 фоизи) жарима ҳисобига ушлаб қолинсин; Мижозга қайтариладиган сумма йўқ. Дўкон қабул қилиш-топшириш далолатномаси ва инвентаризация билан қабул қилиб олинсин (4.5-банд).';
  return 'Мижоз томонидан тўланган ' + yhPul(x.tolangan) + ' сўмдан Шартноманинг 3.3.2-бандига мувофиқ шартнома умумий қийматининг 15 фоизи миқдорида '
    + yhPul(P.jarima) + ' сўм жарима ушлаб қолинсин; қолган ' + yhPul(P.qaytar)
    + ' сўм Шартноманинг 5.1–5.3-бандларига мувофиқ дўкон бошқа харидорга сотилиб, ундан 100 фоиз тўлов келиб тушганидан кейин 20 банк куни ичида Мижозга қайтарилсин. Дўкон Мижоздан қабул қилиш-топшириш далолатномаси ва инвентаризация билан қабул қилиб олинсин (4.5-банд).';
}
const dokonMatn = x => x.dk ? '«' + x.dk.blok + '» блок ' + x.dk.qavat + '-қаватдаги ' + x.dk.nomer + '-рақамли, умумий майдони '
  + s(x.maydon).replace('.', ',') + ' м² бўлган савдо дўкони' : x.dokon + ' рақамли савдо дўкони';
// BUYRUQ matni: { sarl, K (asos xatboshilari), B (buyruq bandlari) }
function buyruqMatn(x, X, P, raqam, sanaIso) {
  const sarl = x.tur === 'ijara' ? 'Ижара шартномасини бир томонлама бекор қилиш тўғрисида' : 'Муддатли тўлов шартномасини бир томонлама бекор қилиш тўғрисида';
  const dm = dokonMatn(x), jam = bekorJamiyat(x), K = [], B = [];
  if (x.tur === 'ijara') {
    K.push(jam + ' ва ' + x.fishK + ' (кейинги ўринларда – Ижарачи) ўртасида ' + yhSozDa(x.sana) + ' ' + dm + 'дан фойдаланиш тўғрисида №' + x.no + '-сонли ижара шартномаси (кейинги ўринларда – Шартнома) тузилган.');
    K.push('Ижарачи томонидан Шартноманинг 6.2-бандида назарда тутилган мажбуриятлар бузилган. ' + X.jumla);
  } else {
    K.push(jam + ' ва фуқаро ' + x.fishK + ' (кейинги ўринларда – Мижоз) ўртасида ' + yhSozDa(x.sana)
      + (/^ESKI/.test(x.shablon) ? ' Ангор туманидаги савдо мажмуаси қурилишида улушли иштирок этиш тўғрисида' : ' ' + dm + 'ни муддатли тўлов шартларида сотиш тўғрисида')
      + ' №' + x.no + '-сонли шартнома (кейинги ўринларда – Шартнома) тузилган'
      + (/^ESKI/.test(x.shablon) ? ' бўлиб, унга асосан Мижозга ' + dm + ' ажратилган' : '')
      + '. Шартноманинг умумий қиймати ' + yhPul(x.qiymat) + ' сўмни ташкил этади.');
    K.push(yhSozDa(sanaIso) + 'ги ҳолатга Мижоз томонидан Шартнома бўйича '
      + (x.tolangan ? 'жами ' + yhPul(x.tolangan) + ' сўм тўланган' : 'бирорта тўлов амалга оширилмаган')
      + '; асосий қарз ' + yhPul(x.asosiy) + ' сўм, шундан муддати ўтган қарз ' + yhPul(x.muddati) + ' сўмни ташкил этади'
      + (x.kechikkan ? ' (кечикиш ' + x.kechikkan + ' кун)' : '') + '.' + (X.jumla ? ' ' + X.jumla : ''));
  }
  K.push('Шартноманинг ' + BEKOR_BAND[x.shablon] + 'га ҳамда Ўзбекистон Республикаси фуқаролик қонунчилигига мувофиқ Жамият Шартномани суд тартибисиз бир томонлама бекор қилиш ҳуқуқига эга.');
  B.push('№' + x.no + '-сонли шартнома бекор қилинсин; шартнома бекор қилиш тўғрисидаги хабарнома ' + (x.tur === 'ijara' ? 'Ижарачига' : 'Мижозга') + ' топширилган (етказилган) кундан бекор қилинган ҳисоблансин.');
  if (x.tur === 'ijara') {
    B.push(x.dokon + ' рақамли дўкон Ижарачидан Шартноманинг 6.4-бандига мувофиқ 10 иш куни ичида қабул қилиш-топшириш далолатномаси билан қабул қилиб олинсин ва эркин дўконлар рўйхатига қайтарилсин.');
    B.push('Ижарачининг дўконни устувор тартибда сотиб олиш ҳуқуқи Шартноманинг 6.7-бандига мувофиқ бекор ҳисоблансин.');
  } else {
    B.push(x.dokon + ' рақамли дўкон эркин дўконлар рўйхатига қайтарилсин ва қайта сотувга чиқарилсин.');
    B.push(bekorPulBand(x, P));
  }
  B.push((x.tur === 'ijara' ? 'Ижарачи' : 'Мижоз') + ' ушбу буйруқ тўғрисида ёзма хабардор қилинсин ва унга буйруқ нусхаси топширилсин.');
  B.push('Мазкур буйруқ ижросини назорат қилишни ўз зиммамда қолдираман.');
  return { sarl, K, B };
}
// XABARNOMA matni: { PA, rows (jadval yoki null), PB }
function xabarnomaMatn(x, X, P, raqam, sanaIso) {
  const dm = dokonMatn(x), PA = [], PB = [];
  if (x.tur === 'ijara') {
    PA.push('Сиз билан «ANGOR KARVON SAROY» МЧЖ (кейинги ўринларда – Жамият) ўртасида ' + yhSozDa(x.sana) + ' ' + dm + 'дан фойдаланиш тўғрисида №' + x.no + '-сонли ижара шартномаси (кейинги ўринларда – Шартнома) тузилган.');
    PA.push('Сиз томонингиздан Шартноманинг 6.2-бандида назарда тутилган мажбуриятлар бузилган. ' + X.jumla);
  } else {
    PA.push('Сиз билан ' + bekorJamiyat(x) + ' ўртасида ' + yhSozDa(x.sana)
      + (/^ESKI/.test(x.shablon) ? ' Ангор туманидаги савдо мажмуаси қурилишида улушли иштирок этиш тўғрисида' : ' ' + dm + 'ни муддатли тўлов шартларида сотиш тўғрисида')
      + ' №' + x.no + '-сонли шартнома (кейинги ўринларда – Шартнома) тузилган'
      + (/^ESKI/.test(x.shablon) ? ' бўлиб, унга асосан Сизга ' + dm + ' ажратилган' : '') + '.');
    PA.push(yhSozDa(sanaIso) + 'ги ҳолатга Шартнома бўйича '
      + (x.tolangan ? 'жами ' + yhPul(x.tolangan) + ' сўм тўлангани ҳолда қарздорлик' : 'бирорта тўлов амалга оширилмаган бўлиб, қарздорлик') + ' қуйидагича:');
  }
  let rows = null;
  if (x.tur !== 'ijara') {
    rows = [['Асосий қарз', yhPul(x.asosiy) + ' сўм'], ['шундан муддати ўтган қарз', yhPul(x.muddati) + ' сўм']];
    if (x.qoshimcha > 0) rows.push(['Қўшимча майдон учун қарз', yhPul(x.qoshimcha) + ' сўм']);
    rows.push(['Жами қарздорлик', yhPul(x.jami) + ' сўм']);
  }
  if (x.tur !== 'ijara' && X.jumla) PB.push(X.jumla);
  PB.push('Шартноманинг ' + BEKOR_BAND[x.shablon] + 'га мувофиқ Жамият Шартномани бир томонлама бекор қилиш ҳуқуқидан фойдаланди.');
  let p5 = 'Жамият директорининг ' + yhSozDa(sanaIso) + 'ги ' + raqam + '-сонли буйруғи билан №' + x.no + '-сонли шартнома бир томонлама бекор қилингани тўғрисида Сизни хабардор қиламиз. Буйруқ нусхаси иловада.';
  if (/^ESKI/.test(x.shablon)) p5 += ' Шартнома ушбу хабарнома Сизга топширилган (етказилган) кундан бошлаб бекор қилинган ҳисобланади.';
  PB.push(p5);
  if (x.tur !== 'ijara') {
    const pul = bekorPulBand(x, P).replace(/Мижоз томонидан тўланган/g, 'Сиз томонингиздан тўланган')
      .replace(/Мижозга қайтарилсин/g, 'Сизга қайтарилади').replace(/Мижознинг ҳисоб рақамига қайтарилсин/g, 'ҳисоб рақамингизга қайтарилади')
      .replace(/Мижозга қайтариладиган сумма йўқ/g, 'Сизга қайтариладиган сумма йўқ')
      .replace(/ушлаб қолинсин/g, 'ушлаб қолинади').replace(/қабул қилиб олинсин/g, 'қабул қилиб олинади')
      .replace(/Мижоздан/g, 'Сиздан')
      .replace(/\s*Дўкон Сиздан қабул қилиш-топшириш[^(]*\((Шартноманинг )?4\.5-банди?\)\./, '');
    PB.push(pul);
    PB.push((x.shablon === 'YANGI_TAYYOR' ? 'Шартноманинг 4.5-бандига мувофиқ д' : 'Д') + 'ўконни ушбу хабарнома олинган кундан бошлаб ' + BEKOR_TOPSHIRISH_KUN + ' кун ичида қабул қилиш-топшириш далолатномаси'
      + (x.shablon === 'YANGI_TAYYOR' ? ' ва инвентаризация' : '') + ' билан Жамиятга топширишингизни сўраймиз.');
  } else {
    PB.push('Шартноманинг 6.4-бандига мувофиқ дўконни ' + BEKOR_TOPSHIRISH_KUN + ' иш куни ичида қабул қилиш-топшириш далолатномаси билан Жамиятга топширишингизни сўраймиз. Шартноманинг 6.7-бандига мувофиқ дўконни устувор тартибда сотиб олиш ҳуқуқингиз бекор бўлади.');
  }
  return { PA, rows, PB };
}

// ------------------------------------------------------------------ XABARNOMA PDF (rasmiy blankada)
// bekorXabarnoma_ dagi qator() / jadval — xatChiz_ bloklari shaklida (lib/xat_pdf.js blankaYasa)
function xabarnomaBloklar(x, M) {
  const L = [];
  const q = (matn, o) => L.push(Object.assign({ t: 'p', x: matn, al: 'left', b: false, sz: 11, ind: false, left: 0, after: 0 }, o || {}));
  if (x.manzil) q(x.manzil + 'да яшовчи', { al: 'right', left: XP.XAT_MANZIL_CHAP });
  q(x.fishK + 'га', { al: 'right', left: XP.XAT_MANZIL_CHAP, b: true });
  q(' ', {});
  q('ШАРТНОМАНИ БИР ТОМОНЛАМА БЕКОР ҚИЛИШ', { al: 'center', b: true, after: 0 });
  q('ТЎҒРИСИДА ХАБАРНОМА', { al: 'center', b: true, after: 3 });
  M.PA.forEach(m => q(m, { al: 'both', ind: true, after: 1.5 }));
  if (M.rows) L.push({ t: 'tbl', rows: M.rows });
  M.PB.forEach(m => q(m, { al: 'both', ind: true, after: 1.5 }));
  q('Илова: буйруқ нусхаси — ___ варақ.', { al: 'left', b: true, before: 1.5 });
  L.push({ t: 'imzo' });
  return L;
}
async function xabarnomaYasa(x, X, P, raqam, xRaqam, sanaIso, ij) {
  const M = xabarnomaMatn(x, X, P, raqam, sanaIso);
  const r = await XP.blankaYasa(xabarnomaBloklar(x, M), { '{{Ундирувчи}}': ij.ism, '{{Ундирувчи_тел}}': ij.tel }, xRaqam, sanaIso, true);
  return Object.assign({ matn: M }, r);
}

// ------------------------------------------------------------------ BUYRUQ PDF (oddiy shakl, muhrsiz — DocumentApp.create)
// Sahifa A4, hoshiyalar 50 / 40 / 60 / 42 pt (Docs butun px ga yaxlitlaydi: yuqori 50,25). Matn eni 595,28 − 60 − 42 = 493,28.
// Eski PDF'dan: sana jadvali o'ng chegarasi 552,0; jadvaldan keyin Docs o'zi qo'shadigan bo'sh xatboshi bilan «Ангор тумани» gacha 20,41 pt;
// imzo jadvali ustunlari 150 / 190 / 150 (o'ng ustun matni 549,75 da tugaydi).
const BQ = { tepa: 50.25, chap: 60, ong: 42, past: 39.75, eni: 493.28 };
function buyruqHtml(M, raqam, sanaIso, k) {
  const z = n => Math.round(n * (k || 1) * 2) / 2;
  const nw = w => /[-\/№]/.test(w) ? '<span class="nw">' + esc(w) + '</span>' : esc(w);
  const par = (matn, o) => {
    const sz = z(o.sz || 11), tek = o.al === 'j';
    const st = ['text-align:' + (tek ? 'left' : ({ c: 'center', r: 'right' }[o.al] || 'left')), 'margin-top:' + z(o.before || 0) + 'pt', 'margin-bottom:' + z(o.after || 0) + 'pt',
      'text-indent:' + (o.ind ? 28.5 : 0) + 'pt', 'font-size:' + sz + 'pt', 'line-height:' + (sz * 1.15).toFixed(3) + 'pt'];
    if (o.b) st.push('font-weight:bold');
    const ich = !s(matn).trim() ? '&#8203;' : tek ? s(matn).split(' ').map(nw).join('<span class="sp"> </span>') + '<span class="so"></span>' : s(matn).split(' ').map(nw).join(' ');
    return '<p' + (tek ? ' class="j"' : '') + ' style="' + st.join(';') + '">' + ich + '</p>';
  };
  const sz11 = z(11), lh11 = (sz11 * 1.15).toFixed(3);
  let h = par('«ANGOR KARVON SAROY» МАСЪУЛИЯТИ ЧЕКЛАНГАН ЖАМИЯТИ', { al: 'c', b: true, sz: 12.5, after: 2 })
    + par('БУЙРУҚ', { al: 'c', b: true, sz: 14, before: 6, after: 4 })
    + '<div class="qt" style="font-size:' + sz11 + 'pt;line-height:' + lh11 + 'pt"><span class="ch">' + esc(yhSoz(sanaIso)) + '</span>&#8203;<span class="on" style="right:' + (BQ.eni - 492) + 'pt">' + esc(raqam + '-сон') + '</span></div>'
    + '<div style="height:20.41pt"></div>'
    + par('Ангор тумани', { al: 'c', sz: 11, after: 6 })
    + par(M.sarl, { al: 'c', b: true, sz: 11.5, after: 5 });
  M.K.forEach(m => { h += par(m, { al: 'j', ind: true, sz: 11, after: 2 }); });
  h += par('БУЮРАМАН:', { al: 'c', b: true, sz: 11.5, before: 4, after: 3 });
  M.B.forEach((m, i) => { h += par((i + 1) + '. ' + m, { al: 'j', ind: true, sz: 11, after: 2 }); });
  h += par(' ', { sz: 10, before: 4 });
  h += '<div class="qt" style="font-size:' + sz11 + 'pt;line-height:' + lh11 + 'pt"><span class="ch" style="font-weight:bold">Директор</span>&#8203;'
    + '<span class="ur" style="left:150pt;width:190pt">__________________</span><span class="on" style="right:' + (BQ.eni - 489.75) + 'pt;font-weight:bold">К.Ҳ.Ҳайдаров</span></div>'
    + '<p style="margin-top:1.9pt;font-size:' + z(10) + 'pt;line-height:' + (z(10) * 1.15).toFixed(3) + 'pt">&#8203;</p>';   // Docs jadvaldan keyin qo'yadigan bo'sh xatboshi
  const PX = 0.75, pp = v => Math.floor(v / PX + 1e-9), ql = v => +(v - pp(v) * PX).toFixed(3);
  const CSS = `@page{size:595.5pt 842.25pt;margin:${pp(BQ.tepa)}px ${pp(BQ.ong)}px ${Math.ceil(BQ.past / PX)}px ${pp(BQ.chap)}px}
*{box-sizing:content-box}html{margin:0;padding:0}body{margin:0;padding:${ql(BQ.tepa)}pt 0 0 ${ql(BQ.chap)}pt;width:${BQ.eni}pt}
body{font-family:'Liberation Serif','Times New Roman',serif;color:#000}
p{margin:0;padding:0;white-space:pre-wrap;overflow-wrap:break-word}
.nw{white-space:nowrap;display:inline-block;text-indent:0}
.qt{position:relative;white-space:pre}.qt .on{position:absolute;top:0}.qt .ur{position:absolute;top:0;text-align:center}`;
  return XP.kattalashtir('<!doctype html><html><head><meta charset="utf-8"><style>' + CSS + '</style></head><body>' + h + '</body></html>');
}
async function buyruqYasa(x, X, P, raqam, sanaIso) {
  const M = buyruqMatn(x, X, P, raqam, sanaIso);
  const yasa = async k => { const pdf = await PDF.yasa(buyruqHtml(M, raqam, sanaIso, k), '', { scale: 1 / XP.KAT, skript: XP.TEKISLA }); return { pdf, bet: XP.betSoni(pdf) }; };
  let r = await yasa(1);
  if (r.bet > 1) for (const k of [0.95, 0.9, 0.85]) { r = await yasa(k); if (r.bet <= 1) break; }
  return Object.assign({ matn: M }, r);
}

module.exports = { buyruqMatn, xabarnomaMatn, xabarnomaBloklar, buyruqHtml, buyruqYasa, xabarnomaYasa, bekorPul, bekorPulBand, bekorJamiyat, yhSoz, yhSozDa, yhPul, yhDmy, yhIso, BEKOR_BAND, xatKirill };
