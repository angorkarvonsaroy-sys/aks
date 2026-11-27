// AKS TIZIM — 📄 DO'KONNI QABUL QILISH-TOPSHIRISH DALOLATNOMASI (ijara boshida, Ijaraga beruvchi → Ijarachi). 27.11.2026, direktor:
// «dokon topshirish deb soddaroq bo'lsin» — bir varaq, muhr yo'q (qo'lda bosiladi), ikki imzo. Shartnoma 1.2 / 3.1.1 / 3.2.4 bandlari asosi.
// Ma'lumot — lib/kb_hujjat.js kbTekshir(no, null, null, {tekshirma:true}) bergan x (04 + 02 + 01, ogohlantirishlar bilan).
// Chizish — kbHujjat ning 2-varag'i bilan bir xil usul (docs_model → docs_pdf, Times New Roman, chromKol kolontituli).
'use strict';
const DM = require('./docs_model');
const DP = require('./docs_pdf');
const DX = require('./docs_docx');
const MI = require('./mijoz_imzo');
const KB = require('./kb_hujjat');

const s = v => String(v == null ? '' : v);
const MCHJ = { nom: '«ANGOR KARVON SAROY» МЧЖ', dir: 'Ҳайдаров Камолиддин Ҳайдарович', dirQ: 'К.Ҳ.Ҳайдаров' };
const BO = '__________';

// x — kbTekshir natijasi; D = { sana 'yyyy-MM-dd' (topshirish kuni), xodim (kirill F.I.Sh. yoki '') }
async function topshirishHujjat(x, D) {
  const { body: b, model } = DM.hujjat();
  b.setMarginTop(50).setMarginBottom(45).setMarginLeft(57).setMarginRight(45);
  const HA = DM.HorizontalAlignment; const AL = { c: HA.CENTER, r: HA.RIGHT, j: HA.JUSTIFY, l: HA.LEFT };
  const par = (matn, o = {}) => { const p = b.appendParagraph(matn);
    p.setAlignment(AL[o.al] || AL.l).setSpacingBefore(o.before || 0).setSpacingAfter(o.after || 0).setLineSpacing(o.ls || 1.15);
    p.setIndentStart(0).setIndentFirstLine(o.ind ? 28.35 : 0).setIndentEnd(0);
    p.editAsText().setFontFamily('Times New Roman').setFontSize(o.sz || 12).setBold(!!o.b); return p; };
  const jadval = (qatorlar, kenglik, opt = {}) => { const t = b.appendTable(qatorlar.map(q => q.map(c => s(c).trim() ? s(c) : ' '))); t.setBorderWidth(0);
    try { kenglik.forEach((w, i) => t.setColumnWidth(i, w)); } catch (e) { }
    for (let r = 0; r < t.getNumRows(); r++) for (let c = 0; c < t.getRow(r).getNumCells(); c++) { const cc = t.getCell(r, c);
      cc.setPaddingTop(1).setPaddingBottom(1).setPaddingLeft(2).setPaddingRight(2);
      const p = cc.getChild(0).asParagraph(); p.setAlignment((opt.al && opt.al[c]) || AL.l).setSpacingAfter(0).setSpacingBefore(0).setLineSpacing(1.1);
      p.editAsText().setFontFamily('Times New Roman').setFontSize(opt.sz || 11).setBold(opt.qalin ? opt.qalin(r, c) : false); }
    return t; };
  const dk = x.dk || {};
  const dokon = '«ANGOR KARVON SAROY» савдо мажмуасининг ' + (dk.blok || '—') + '-блоки, ' + (dk.qavat || '—') + '-қаватдаги № ' + (dk.nomer || x.dokon) + '-дўкон';
  const maydon = KB.kbM2 ? KB.kbM2(x.maydon) : String(Math.round((Number(x.maydon) || 0) * 100) / 100).replace('.', ',');
  const ijarachi = x.yur
    ? x.fishK + ' (СТИР: ' + (x.stir || BO) + ') номидан раҳбари ' + (x.rahbarK || BO)
    : 'Ўзбекистон Республикаси фуқароси ' + x.fishK + ' (паспорт: ' + (x.pasport || BO) + (x.iib ? ', ' + x.iib + ' томонидан ' + (x.pasSana ? KB.kbDmy(x.pasSana) : BO) + ' да берилган' : '') + '; ЖШШИР: ' + (x.jshshir || '______________') + ')';
  const fishQ = () => { const ch = '_'.repeat(36); return [['', ' '], ['', 'Ф.И.Ш. (тўлиқ, ўз қўли билан):'], ['', ' '], ['', ch], ['', ' '], ['', ch]]; };

  par('ДЎКОННИ ҚАБУЛ ҚИЛИШ-ТОПШИРИШ ДАЛОЛАТНОМАСИ', { al: 'c', b: true, sz: 14, after: 2 });
  par('(' + (x.sana ? KB.kbSozDa(x.sana) + ' тузилган ' : '') + '№ ' + x.no + '-сонли ижара шартномасига илова)', { al: 'c', sz: 11, after: 10 });
  jadval([['Ангор тумани, Гулистон МФЙ', KB.kbSanaQ(D.sana)]], [250, 230], { al: [AL.l, AL.r], sz: 12 });
  par('Биз, қуйида имзо чекувчилар: топширувчи — ' + MCHJ.nom + ' (Ижарага берувчи) номидан Устав асосида иш юритувчи директори ' + MCHJ.dir
    + ' ҳамда қабул қилувчи — Ижарачи ' + ijarachi + (D.xodim ? ', Ижарага берувчи ходими ' + D.xodim + ' иштирокида' : '')
    + ', № ' + x.no + '-сонли ижара шартномасининг (кейинги ўринларда — «Шартнома») 1.2, 3.1.1 ва 3.2.4-бандларига мувофиқ ушбу далолатномани туздик:',
    { al: 'j', ind: true, before: 12, after: 8 });
  const H = [
    'Ижарага берувчи Сурхондарё вилояти, Ангор тумани, Гулистон МФЙ, Ат-Термизий кўчаси, 198-уйда жойлашган ' + dokon + 'ни (умумий майдони ' + maydon + ' м²; кейинги ўринларда — «Дўкон») фойдаланишга тайёр, соз ҳолатда Ижарачига топширди, Ижарачи эса Дўконни қабул қилиб олди.',
    'Ижарачи Дўконни кўздан кечирди; Дўконнинг ҳолати юзасидан Томонларнинг бир-бирига эътирози йўқ.',
    'Дўкон Ижарачига ' + KB.kbSozDa(D.sana) + 'н бошлаб Шартнома шартларида фойдаланишга топширилган ҳисобланади.',
    'Ушбу далолатнома Шартноманинг ажралмас қисми бўлиб, 2 (икки) нусхада, бир хил юридик кучга эга ҳолда тузилди — ҳар бир Томонда биттадан сақланади.'
  ];
  H.forEach((m, i) => par((i + 1) + '. ' + m, { al: 'j', ind: true, after: 6, ls: 1.2 }));
  par(' ', { before: 22 });
  jadval([
    ['ТОПШИРДИ (Ижарага берувчи):', 'ҚАБУЛ ҚИЛДИ (Ижарачи):'],
    [MCHJ.nom + ' директори ' + MCHJ.dirQ, x.yur ? x.fishK + ' раҳбари ' + (x.rahbarK ? KB.kbQisqa(x.rahbarK) : BO) : x.fishK],
    [' ', ' '], [' ', ' '],
    ['Имзо: ____________________', 'Имзо: ____________________']
  ].concat(fishQ()), [245, 235], { sz: 11, qalin: r => r === 0 });
  if (D.xodim) { par(' ', { before: 14 }); par('Иштирок этди (Ижарага берувчи ходими): ____________________ ' + KB.kbQisqa(D.xodim), { sz: 11 }); }
  const b0 = b.getChild(0); if (b0.getType() === DM.ElementType.PARAGRAPH && !b0.asParagraph().getText().trim()) b0.removeFromParent();
  const { pdf, bet } = await DP.yasa(model, MI.chromKol({ imzo: 'Ижарачи', sarlavha: '№ ' + x.no + ' — қабул қилиш-топшириш далолатномаси', chap: 57, ong: 45 }));
  return { pdf, bet, docx: DX.yasa(model), model };
}

module.exports = { topshirishHujjat };
