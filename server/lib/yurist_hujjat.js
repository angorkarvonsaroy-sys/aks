// AKS TIZIM — yurist bo'limi hujjatlari serverda (Yurhujjat.gs v25.4 bilan bir xil matn va joylashuv).
//   АЛОҚА ХАТИ (yhAloqaYasa_) — rasmiy blankada, Xat.gs umumiy tartibida (lib/xat_pdf.js blankaYasa: bir varaq qoidasi, imzo bloki blankadan).
// Ma'lumot — lib/yurist_malumot.js yhYig (yhYig_ bilan bir xil).
'use strict';
const YM = require('./yurist_malumot');
const XP = require('./xat_pdf');

const s = v => String(v == null ? '' : v);
const YH_PALATA = ['Савдо-саноат палатаси', 'Сурхондарё вилояти ҳудудий', 'бошқармаси бошлиғи', 'А.Раимовга'];
const YU_SUD = 'Шеробод туманлараро фуқаролик ишлари бўйича суди';
const YUX_TUR = { ALOQA_SSP: 'Алоқа хати (ССП)' };
const { yhPul, yhDmy, yhIso, yhSoz, yhSozDa, yhRoyxat, yhSon, yhBoshMuddat } = YM;

// ------------------------------------------------------------------ АЛОҚА ХАТИ — matn (bazadan)
function aloqaMatn(M) {
  const P = M.penya, sh = M.shart;
  const qolgan = Math.max(0, (sh.qiymat || 0) - (sh.boshSumma || 0));
  const bosh = sh.boshSumma > 0
    ? 'шундан ' + yhPul(sh.boshSumma) + ' сўм бошланғич тўлов сифатида ' + yhBoshMuddat(sh, M) + ', қолган ' + yhPul(qolgan) + ' сўм эса '
    : 'шартнома қиймати ';
  const X = [];
  X.push('«ANGOR KARVON SAROY» МЧЖ ва фуқаро ' + M.fishK + ' ўртасида ' + yhSozDa(M.sana) + ' №' + M.no + '-сонли «'
    + (M.turi || 'олди-сотди шартномаси') + '» тузилган. Шартномага кўра савдо мажмуасининг ' + M.dokonMatn + ' бўлган савдо дўкони '
    + yhPul(sh.qiymat) + ' сўмга баҳоланиб, ' + bosh + (sh.oy || M.jadval.length) + ' ой давомида ҳар ойнинг '
    + (sh.tkun || '—') + '-санасигача ' + yhPul(sh.oylik) + ' сўмдан тўланиши белгиланган.');
  const ox = M.tolov.length ? M.tolov[M.tolov.length - 1] : null;
  const kech = M.jadval.filter(j => j.sana <= M.bugun).length;
  X.push('Шартнома бўйича охирги тўлов муддати ' + yhSoz(M.jadval.length ? M.jadval[M.jadval.length - 1].sana : '') + ' этиб белгиланган. '
    + 'Тўлов жадвалида ' + M.jadval.length + ' та тўлов назарда тутилган, шундан ' + kech + ' тасининг муддати келган. '
    + 'Жами ' + yhPul(M.tolangan) + ' сўм тўланган' + (ox ? ', охирги тўлов ' + yhSozDa(ox.sana) + ' амалга оширилган' : '') + '. '
    + yhSozDa(M.bugun) + 'ги ҳолатга қолган қарз ' + yhPul(M.asosiy) + ' сўм, шундан муддати ўтган қарз ' + yhPul(M.muddati)
    + ' сўмни ташкил этади' + (M.kechikkan ? ' (энг эски тўланмаган тўлов бўйича кечикиш — ' + M.kechikkan + ' кун)' : '') + '.');
  const yub = M.xat.filter(h => h.holati === 'Yuborildi');
  let p3 = '';
  if (yub.length) p3 = 'Жамият томонидан қарздорга шартномада кўрсатилган манзилга ' + yhSon(yub.length) + ' марта ёзма огоҳлантириш юборилган: '
    + yub.map(h => yhDmy(yhIso(h.sana)) + ' даги №' + h.raqam + '-сонли ' + (h.bosqichNomi || 'огоҳлантириш хати').toLowerCase()
      + (h.usul === 'Pochta' ? ' (почта жўнатмаси ' + (h.pochta || '__________') + (h.yetSana ? ', ' + h.yetSana : '') + ')'
        : (h.yetSana ? ' (қўлма-қўл топширилган, ' + h.yetSana + ')' : ''))).join('; ') + '. ';
  else if (M.svod.xatSkan) {
    const sk = M.svod.xatSkanDavr.split(' — '); const skm = sk[0] === sk[1] ? sk[0] + ' да' : sk[0] + ' — ' + sk[1] + ' оралиғида';
    p3 = 'Жамият томонидан қарздорга ' + yhSon(M.svod.xatSkan) + ' марта ёзма огоҳлантириш юборилган (' + skm + '), сканлари иш материалларига илова қилинади. ';
  }
  else p3 = 'Қарздорга ёзма огоҳлантириш хати юборилмаган. ';
  const buz = M.jurnal.filter(j => /буз/i.test(String(j.vadaNatija))).map(j => yhDmy(yhIso(j.sana)));
  p3 += 'Бироқ қарздорлик бартараф этилмаган' + (buz.length ? ', қарздор ' + yhRoyxat(buz.slice(-3)) + ' даги тўлов ваъдаларини ҳам бажармаган' : '') + '.';
  X.push(p3);
  X.push('Қарздор тўғрисида маълумот: ' + M.fishK + ', паспорт ' + M.pasport
    + (M.pasIIB ? ' (' + M.pasIIB + ' томонидан ' + yhDmy(M.pasSana) + ' йилда берилган, амал қилиш муддати ' + yhDmy(M.pasMuddat) + ' йилгача)' : '')
    + ', ЖШШИР ' + M.jshshir + '; манзили: ' + M.manzil + '; тел.: ' + M.tel + '.');
  X.push('Юқорида келтирилган муддати ўтган ' + yhPul(M.muddati + M.qoshimcha) + ' сўм қарзни (ариза киритилгунга қадар муддати келган тўловлар билан бирга) ҳамда шартноманинг '
    + P.band.split('(')[0].trim() + 'ига асосан ҳисобланган ' + yhPul(P.undiriladigan) + ' сўм пеняни ундириш учун '
    + YU_SUD + 'га ариза киритишингизни сўраймиз.');
  const il = ['№' + M.no + '-сонли шартнома нусхаси — ___ варақ;'];
  yub.forEach(h => il.push(yhDmy(yhIso(h.sana)) + ' даги №' + h.raqam + '-сонли хат' + (h.usul === 'Pochta' ? ' ва почта квитанцияси' : ' ва топшириш тилхати') + ' — ___ варақ;'));
  if (!yub.length && M.svod.xatSkan) il.push('Огоҳлантириш хатлари сканлари — ___ варақ;');
  il.push('Қарздорнинг тўловлари рўйхати (банк тўлов топшириқномалари рақамлари билан) — ___ варақ;');
  il.push('Қарздорлик ва пеня ҳисоби — ___ варақ;');
  il.push('Мижоз маълумотномаси ва иш ҳаракатлари баённомаси — ___ варақ.');
  return { X, il };
}
// blankaga joylanadigan bloklar (yhAloqaYasa_ ichidagi qator() chaqiruvlari tartibida)
function aloqaBloklar(M) { return aloqaJoyla(aloqaMatn(M)); }
function aloqaJoyla({ X, il }) {
  const L = [];
  const q = (x, o) => L.push(Object.assign({ t: 'p', x, al: 'left', b: false, sz: 11, ind: false, left: 0, before: 0, after: 0 }, o || {}));
  YH_PALATA.forEach((x, i) => q(x, { al: 'right', left: XP.XAT_MANZIL_CHAP, b: i === YH_PALATA.length - 1 }));
  q(' ', { al: 'left' });
  q('“ANGOR KARVON SAROY” MCHJ', { al: 'right', left: XP.XAT_MANZIL_CHAP });
  q('директори К.Ҳ.Ҳайдаров томонидан', { al: 'right', left: XP.XAT_MANZIL_CHAP });
  q(' ', { al: 'left' });
  q('АЛОҚА ХАТИ', { al: 'center', b: true, after: 3 });
  X.forEach(x => q(x, { al: 'both', ind: true, after: 1.5 }));
  q('Илова:', { al: 'left', b: true, before: 1.5 });
  il.forEach((x, i) => q((i + 1) + '. ' + x, { al: 'both', left: 14 }));
  L.push({ t: 'imzo' });
  return L;
}
function aloqaNom(M, raqam) { return 'Aloqa_xati_' + M.no.replace(/\//g, '-') + '_' + M.famLat + '_' + raqam.replace('/', '-'); }
// PDF: { pdf, bet, ikkiBet, k, bloklar, nom }
async function aloqaYasa(M, raqam, ij) {
  const bloklar = aloqaBloklar(M);
  const r = await XP.blankaYasa(bloklar, { '{{Ундирувчи}}': ij.ism, '{{Ундирувчи_тел}}': ij.tel }, raqam, M.bugun, false);
  return Object.assign({ bloklar, nom: aloqaNom(M, raqam) }, r);
}

// ------------------------------------------------------------------ МАЪЛУМОТНОМА, БАЁННОМА, ПЕНЯ — eski DocumentApp kodi docs_model yozuvchisida
// (Yurhujjat.gs v25.4 yhMalumotnoma / yhBayonnoma / yhPenya va yhSarlavha_, yhBolim_, yhMatn_, yhJuft_, yhJadval_, yhImzo_ — so'zma-so'z).
// ism — «Тайёрлади» (yhXodim_(u.fish)). Natija — model (lib/docs_model.js): PDF va Word shundan yasaladi.
const DM = require('./docs_model');
const AL = DM.HorizontalAlignment, YH_FONT = 'Times New Roman';
const { yhShakl, yhKun, yhQisqa, yhHolat, yuBosqichNomiK, YH_YIL } = YM;
function yhSarlavha(b, sarl, ost) {
  const p = b.appendParagraph(sarl); p.setAlignment(AL.CENTER).setSpacingAfter(2);
  p.editAsText().setFontFamily(YH_FONT).setFontSize(14).setBold(true);
  const q = b.appendParagraph(ost); q.setAlignment(AL.CENTER).setSpacingAfter(8);
  q.editAsText().setFontFamily(YH_FONT).setFontSize(10.5).setBold(false);
}
function yhBolim(b, matn) {
  const p = b.appendParagraph(matn); p.setSpacingBefore(8).setSpacingAfter(3);
  p.editAsText().setFontFamily(YH_FONT).setFontSize(11.5).setBold(true);
}
function yhMatn(b, matn, sz, qalin) {
  const p = b.appendParagraph(matn); p.setSpacingBefore(2).setSpacingAfter(2).setLineSpacing(1);
  p.editAsText().setFontFamily(YH_FONT).setFontSize(sz || 11).setBold(!!qalin); return p;
}
function yhJuft(b, satrlar) {
  const t = b.appendTable(satrlar.map(r => [r[0], String(r[1] == null || r[1] === '' ? '—' : r[1])]));
  t.setBorderWidth(0);
  try { t.setColumnWidth(0, 170); t.setColumnWidth(1, 350); } catch (e) { }
  for (let i = 0; i < t.getNumRows(); i++) for (let j = 0; j < 2; j++) {
    const c = t.getCell(i, j); c.setPaddingTop(1).setPaddingBottom(1).setPaddingLeft(0);
    const p = c.getChild(0).asParagraph(); p.setSpacingAfter(0);
    p.editAsText().setFontFamily(YH_FONT).setFontSize(10.5).setBold(j === 1 && /қарз|Жами/i.test(t.getCell(i, 0).getText()));
  }
}
function yhJadval(b, sarlavha, satrlar, kenglik, oxirgiQalin) {
  if (!satrlar.length) satrlar = [sarlavha.map(() => '—')];
  const t = b.appendTable([sarlavha].concat(satrlar));
  t.setBorderColor('#9AA4B2').setBorderWidth(0.5);
  try { (kenglik || []).forEach((w, i) => t.setColumnWidth(i, w)); } catch (e) { }
  for (let i = 0; i < t.getNumRows(); i++) for (let j = 0; j < sarlavha.length; j++) {
    const c = t.getCell(i, j); c.setPaddingTop(1).setPaddingBottom(1).setPaddingLeft(3).setPaddingRight(3);
    const p = c.getChild(0).asParagraph(); p.setSpacingBefore(0).setSpacingAfter(0).setLineSpacing(1);
    const raqam = j > 0 && /^[\d  ]+$/.test(c.getText());
    p.setAlignment(raqam ? AL.RIGHT : AL.LEFT);
    p.editAsText().setFontFamily(YH_FONT).setFontSize(i === 0 ? 10 : 9.5).setBold(i === 0 || (!!oxirgiQalin && i === t.getNumRows() - 1));
    if (i === 0) c.setBackgroundColor('#EEF3F8');
  }
}
function yhImzo(b, ism, bugun) {
  yhMatn(b, '', 9);
  yhMatn(b, 'Тайёрлади: ' + ism + ', ' + yhDmy(bugun) + '   ______________________', 10.5);
  yhMatn(b, 'Тасдиқлади: директор Ҳайдаров К.Ҳ.   ______________________', 10.5);
  yhMatn(b, 'Ушбу маълумот «ANGOR KARVON SAROY» МЧЖ нинг ички ҳисоб базасидан ' + yhDmy(bugun) + ' куни автоматик тайёрланди.', 9);
}
const noF = M => M.no.replace(/\//g, '-');
function malumotnomaModel(M, ism) {
  const { body: b, model } = DM.hujjat();
  b.setMarginTop(36).setMarginBottom(28).setMarginLeft(45).setMarginRight(30);
  yhSarlavha(b, 'МИЖОЗ МАЪЛУМОТНОМАСИ', '№' + M.no + ' шартнома бўйича · ' + yhDmy(M.bugun) + ' ҳолатига');

  yhBolim(b, '1. Мижоз');
  yhJuft(b, [['Ф.И.Ш.', M.fishK], ['Паспорт', M.pasport], ['ЖШШИР', M.jshshir],
    ['Телефон', M.tel], ['Манзил', M.manzil]]);

  yhBolim(b, '2. Шартнома ва дўкон');
  yhJuft(b, [['Шартнома', '№' + M.no + (M.sana ? ', ' + yhDmy(M.sana) : '')], ['Тури', M.turi],
    ['Дўкон', M.dokonMatn], ['Шартнома қиймати', yhPul(M.qiymat) + ' сўм'],
    ['Жами тўланган', yhPul(M.tolangan) + ' сўм'], ['Ойлик тўлов', yhPul(M.oylik) + ' сўм']]);

  yhBolim(b, '3. Қарздорлик');
  const qr = [['Асосий қарз', yhPul(M.asosiy) + ' сўм'], ['шундан муддати ўтган', yhPul(M.muddati) + ' сўм']];
  if (M.qoshimcha > 0) qr.push(['Қўшимча майдон учун қарз', yhPul(M.qoshimcha) + ' сўм']);
  qr.push(['Жами қарздорлик', yhPul(M.jami) + ' сўм']);
  if (M.kechikkan) qr.push(['Кечикиш', M.kechikkan + ' кун']);
  yhJadval(b, ['Кўрсаткич', 'Миқдор'], qr.map(r => [r[0], r[1]]), [330, 150], true);

  yhBolim(b, '4. Тўловлар');
  if (M.tolov.length) {
    const ox = M.tolov[M.tolov.length - 1];
    yhJuft(b, [['Жами тўлов сони', M.tolov.length + ' та'],
      ['Охирги тўлов', yhDmy(ox.sana) + ' · ' + yhPul(ox.summa) + ' сўм · ' + yhShakl(ox.shakl)],
      ['Охирги тўловдан бери', yhKun(ox.sana, M.bugun) + ' кун']]);
  } else yhMatn(b, 'Шартнома бўйича бирорта ҳам тўлов қайд этилмаган.', 10.5);

  yhBolim(b, '5. Судгача кўрилган чоралар — СВОД');
  const sv = M.svod;
  yhJadval(b, ['Кўрилган чора', 'Сони', 'Даври'],
    sv.chora.map(c => [c.nom, c.soni + ' марта', c.davr])
      .concat([['Ёзма огоҳлантириш хати (тизим орқали)', sv.xatYuborilgan + ' та юборилди' + (sv.xatJami > sv.xatYuborilgan ? ', ' + (sv.xatJami - sv.xatYuborilgan) + ' та тайёр (етказилмаган)' : ''), sv.xatOxirgi ? 'охиргиси ' + (sv.xatOxirgi.yetSana || sv.xatOxirgi.sana) : ''],
        ['Огоҳлантириш хати сканлари (архив)', sv.xatSkan + ' та', sv.xatSkanDavr],
        ['Етказилганлик исботи (тилхат/почта)', sv.isbot + ' та', ''],
        ['Мижоз берган тўлов ваъдаси', sv.vada + ' марта', 'тўлиқ бажарган ' + sv.toliq + ', қисман ' + sv.qisman + ', бузган ' + sv.buzgan + (sv.belgisiz ? ', натижаси белгиланмаган ' + sv.belgisiz : '')],
        ['Қабул қилинган тўлов', sv.tolovSoni + ' та', sv.tolovDavr]]),
    [200, 140, 180], false);   // 23.10.2026: eski [230,160,170] = 560 pt — sahifa (520 pt: A4 595 − chekka 45 − 30) chetidan chiqib ketardi
  yhMatn(b, 'Жами ' + sv.jami + ' та ундирув ҳаракати қайд этилган. Берилган ' + sv.vada + ' та ваъданинг ' + (sv.qisman + sv.buzgan + sv.belgisiz) + ' таси тўлиқ бажарилмаган.', 10.5, true);
  yhMatn(b, sv.xatHammasi >= 3
    ? 'Судгача низони ҳал қилиш тартиби: ' + sv.xatHammasi + ' та ёзма огоҳлантириш мавжуд' + (sv.isbot ? ', ' + sv.isbot + ' таси бўйича етказилганлик исботи юкланган' : ', БИРОҚ етказилганлик исботи юкланмаган — юрист текширсин') + '.'
    : 'ДИҚҚАТ: судгача тартиб тўлиқ бажарилмаган — ёзма огоҳлантириш ' + sv.xatHammasi + ' та. Судга беришдан олдин талабнома юборилиши керак.', 10.5, true);

  yhBolim(b, '6. Ундирув журнали — сўнгги қайдлар');
  if (M.jurnal.length) {
    yhJadval(b, ['Сана', 'Чора', 'Натижа', 'Мазмуни'],
      M.jurnal.slice(-5).reverse().map(j => [yhDmy(j.sana), j.chora || '—', j.natija || '—', yhQisqa(j.mazmun, 90)]),
      [60, 110, 90, 220], false);
    yhMatn(b, 'Жами журналда: ' + M.jurnal.length + ' та қайд.' + (M.vada ? '  Охирги ваъда: ' + yhDmy(M.vada.sana) + ' — ' + yhPul(M.vada.summa) + ' сўм (' + (M.vada.natija || 'натижа белгиланмаган') + ').' : ''), 10);
  } else yhMatn(b, 'Ундирув журналида қайд йўқ.', 10.5);

  yhBolim(b, '7. Огоҳлантириш хатлари');
  if (M.xat.length) yhJadval(b, ['Рақам', 'Босқич', 'Сана', 'Ҳолати', 'Етказилган'],
    M.xat.map(h => [h.raqam, h.bosqichNomi, h.sana, h.holati, h.yetSana ? h.yetSana + (h.usul ? ' (' + h.usul + ')' : '') : '—']),
    [95, 130, 65, 80, 110], false);
  else yhMatn(b, sv.xatSkan
    ? 'Тизим орқали хат чиқарилмаган. Архивда ' + sv.xatSkan + ' та огоҳлантириш хати скани мавжуд (' + sv.xatSkanDavr + ') — 8-бўлимга қаранг. Уларнинг мижозга етказилганлиги юрист томонидан текширилиши лозим.'
    : 'Огоҳлантириш хати юборилмаган.', 10.5);

  yhBolim(b, '8. Тўпланган ҳужжатлар');
  if (M.hujjat.length) yhJadval(b, ['Тури', 'Сана', 'Файл'],
    M.hujjat.map(h => [h.turi, h.sana, yhQisqa(h.nom, 55)]), [150, 65, 265], false);
  else yhMatn(b, 'Ҳужжат юкланмаган.', 10.5);
  if (M.yoq.length) yhMatn(b, 'Йўқ ҳужжатлар: ' + M.yoq.join(', ') + '.', 10);

  yhBolim(b, '9. Пеня ва даъво суммаси');
  const P = M.penya;
  yhJuft(b, [['Ҳисоб асоси', P.band], ['Ҳисоб усули', 'тўлов жадвалининг ҳар бир банди бўйича алоҳида, тўлов эски қарздан ёпилади'],
    ['Ҳисобланган пеня', yhPul(P.jami) + ' сўм (' + P.satr.length + ' та кечикиш даври)'],
    ['Чегара — муддати ўтган қарзнинг 50% (2.7-банд)', yhPul(P.chegara) + ' сўм'],
    ['Ундирилиши мумкин бўлган пеня', yhPul(P.undiriladigan) + ' сўм' + (P.kesildi ? ' (чегара қўлланилди)' : '')],
    ['Муддатидан олдин тўлашни талаб қилиш', 'шартномада бундай банд йўқ — фақат муддати ўтган қарз талаб қилинади'],
    ['ДАЪВО СУММАСИ (муддати ўтган қарз + пеня)', yhPul(M.muddati + M.qoshimcha + P.undiriladigan) + ' сўм'],
    ['Маълумот учун: қолдиқ қарзнинг ҳаммаси', yhPul(M.jami) + ' сўм']]);
  yhMatn(b, 'Батафсил ҳисоб-китоб «Пеня ҳисоб-китоби» иловасида келтирилган.', 10);

  yhBolim(b, '10. Даъво муддати');
  const D = M.muddat;
  yhJuft(b, [['Охирги тўлов (қарзни тан олиш)', D.oxirgiTolov ? yhDmy(D.oxirgiTolov) : 'тўлов йўқ'],
    ['Даъво муддати тугайди', D.tugaydi ? yhDmy(D.tugaydi) + ' (' + D.qolganKun + ' кун қолди)' : '—'],
    ['Ҳолати', D.xavf ? 'ДИҚҚАТ: 6 ойдан кам қолди — судга бериш кечиктирилмасин' : 'муддат етарли']]);
  if (D.eskirgan) yhMatn(b, 'Изоҳ: жадвалнинг ' + D.eskirgan + ' та банди ' + yhDmy(D.chek) + ' дан олдинги даврга тегишли — уларга пеня ҳисобланмади.', 10);

  yhBolim(b, '11. Юридик иш');
  const bq = M.ish.tartib === 'Buyruq';
  const yl = [['Ҳолати', yhHolat(M.ish.holati)], ['Ариза тартиби', M.ish.tartib ? (bq ? 'Буйруқ тартибида (суд буйруғи)' : 'Даъво тартибида') : 'ҳали танланмаган'],
    ['Босқич', yuBosqichNomiK(M.ish)],
    ['Юристга ўтган сана', yhDmy(M.ish.topshirilgan)], ['Масъул юрист', M.yurist || '—'],
    ['Масъул ундирувчи', M.undiruvchi || '—']];
  if (M.ish.davoNo) yl.push([bq ? 'Ариза (буйруқ тартибида)' : 'Даъво аризаси', '№' + M.ish.davoNo + ' (' + yhDmy(M.ish.davoSana) + '), ' + (M.ish.sudNomi || '')]);
  if (M.ish.radIzoh) yl.push(['Рад этилган ариза', M.ish.radIzoh]);
  if (bq && M.ish.sudIshNo) yl.push(['Суд буйруғи', '№' + M.ish.sudIshNo + (M.ish.qarorSana ? ' (' + yhDmy(M.ish.qarorSana) + ')' : '') + ' — ижро ҳужжати']);
  else if (M.ish.sudIshNo) yl.push(['Суд иши', '№' + M.ish.sudIshNo + (M.ish.majlis ? ', кейинги мажлис ' + yhDmy(M.ish.majlis) : '')]);
  if (!bq && M.ish.qaror) yl.push(['Суд қарори', M.ish.qaror + ' (' + yhDmy(M.ish.qarorSana) + ')']);
  if (M.ish.mibSana) yl.push(['МИБ', yhDmy(M.ish.mibSana) + (M.ish.ijrochi ? ', ижрочи: ' + M.ish.ijrochi : '')]);
  if (M.ish.ijroNo) yl.push(['Ижро варақаси', '№' + M.ish.ijroNo + ' (' + yhDmy(M.ish.ijroSana) + ')' + (M.ish.ijrochi ? ', ижрочи: ' + M.ish.ijrochi : '')]);
  yhJuft(b, yl);

  yhImzo(b, ism, M.bugun);
  return { model, nom: 'Malumotnoma_' + noF(M) + '_' + M.famLat + '_' + M.bugun };
}
function bayonnomaModel(M, X, ism) {
  const { body: b, model } = DM.hujjat();
  b.setPageWidth(841.89).setPageHeight(595.28);
  b.setMarginTop(34).setMarginBottom(28).setMarginLeft(40).setMarginRight(30);
  yhSarlavha(b, 'ИШ ҲАРАКАТЛАРИ БАЁННОМАСИ',
    '№' + M.no + ' шартнома · ' + M.fishK + ' · ' + M.dokonMatn + ' · ' + yhDmy(M.bugun) + ' ҳолатига');
  yhBolim(b, '1-қисм. Мижоз билан олиб борилган ишларнинг хронологияси');
  yhJadval(b, ['Сана', 'Тури', 'Мазмуни', 'Тўлов, сўм', 'Натижа / ваъда', 'Исбот ҳужжати'],
    X.map(r => [yhDmy(r.sana), r.tur, yhQisqa(r.mazmun, 110), r.summa ? yhPul(r.summa) : '', yhQisqa(r.natija || '', 60), r.isbot || '']),
    [62, 95, 270, 80, 150, 107], false);
  yhMatn(b, 'Изоҳ: «Тўлов» устунида фақат ҳақиқатда қабул қилинган пул кўрсатилган; мижознинг ваъдалари «Натижа / ваъда» устунида.', 9.5);
  yhMatn(b, 'Жами: ' + X.length + ' та қайд. Давр: ' + (X.length ? yhDmy(X[0].sana) + ' — ' + yhDmy(X[X.length - 1].sana) : '—') + '.', 10.5, true);
  yhBolim(b, '2-қисм. Тўловлар жадвали');
  let j = 0;
  const tr = M.tolov.map((t, n) => { j += Number(t.summa) || 0; return [String(n + 1), yhDmy(t.sana), yhShakl(t.shakl), yhPul(t.summa), yhPul(j)]; });
  yhJadval(b, ['№', 'Сана', 'Шакли', 'Сумма, сўм', 'Жамланма, сўм'], tr, [40, 80, 110, 130, 140], false);
  yhMatn(b, 'Жами тўланган: ' + yhPul(j) + ' сўм. Шартнома қиймати: ' + yhPul(M.qiymat) + ' сўм. Қолдиқ қарз: ' + yhPul(M.jami) + ' сўм.', 10.5, true);
  yhImzo(b, ism, M.bugun);
  return { model, nom: 'Bayonnoma_' + noF(M) + '_' + M.famLat + '_' + M.bugun };
}
function penyaModel(M, ism) {
  const P = M.penya;
  const { body: b, model } = DM.hujjat();
  b.setPageWidth(841.89).setPageHeight(595.28);
  b.setMarginTop(34).setMarginBottom(28).setMarginLeft(40).setMarginRight(30);
  yhSarlavha(b, 'ПЕНЯ (НЕУСТОЙКА) ҲИСОБ-КИТОБИ',
    '№' + M.no + ' шартнома · ' + M.fishK + ' · ҳисоб санаси ' + yhDmy(M.bugun));
  yhBolim(b, 'Ҳисоб-китоб асослари');
  yhJuft(b, [['Шартнома', '№' + M.no + ', ' + yhDmy(M.sana) + ', ' + M.turi],
    ['Пеня шарти', P.band],
    ['Ҳисоблаш усули', 'тўлов жадвалининг ҳар бир банди бўйича алоҳида: тўлов муддатидан кейинги кундан — ўша бўлак тўланган кунигача, тўланмагани эса ' + yhDmy(M.bugun) + ' гача'],
    ['Тўловларни тақсимлаш', 'келган тўлов энг эски қарздан ёпилади'],
    ['Даъво муддати', 'пеня фақат сўнгги ' + YH_YIL + ' йил (' + yhDmy(P.chek) + ' дан бошлаб) учун ҳисобланган'],
    ['Жадвал бўйича жами', yhPul(P.jadvalJami) + ' сўм'],
    ['Ҳақиқатда тўланган', yhPul(M.tolangan) + ' сўм']]
    .concat(Math.abs(P.jadvalJami - M.qiymat) > 1 ? [['Изоҳ', 'жадвал йиғиндиси шартнома қийматидан ' + yhPul(Math.abs(P.jadvalJami - M.qiymat)) + ' сўмга фарқ қилади (яхлитлаш); пеня жадвал бўйича ҳисобланган']] : []));
  yhBolim(b, 'Пеня ҳисоби — жадвал бандлари бўйича');
  yhJadval(b, ['№', 'Жадвал бўйича тўлов санаси', 'Сумма, сўм', 'Тўланган сана', 'Кечиккан кун', 'Ставка', 'Пеня, сўм'],
    P.satr.map((r, n) => [String(n + 1), yhDmy(r.muddat), yhPul(r.summa), r.tolandi ? yhDmy(r.tolandi) : 'тўланмаган',
      String(r.kun), '0,1%', yhPul(r.penya)]),
    [35, 140, 110, 110, 90, 55, 110], false);
  yhMatn(b, 'Жами ҳисобланган пеня: ' + yhPul(P.jami) + ' сўм (' + P.satr.length + ' та кечикиш даври).', 11, true);
  yhMatn(b, 'Шартноманинг 2.7 ва 3.3.1-бандларига мувофиқ пенянинг умумий миқдори муддати ўтган қарздорлик суммасининг 50 фоизидан ошмайди: '
    + yhPul(M.muddati) + ' × 50% = ' + yhPul(P.chegara) + ' сўм.'
    + (P.kesildi ? ' Ҳисобланган пеня чегарадан ошгани сабабли ундириш учун ' + yhPul(P.undiriladigan) + ' сўм қабул қилинди.' : ' Ҳисобланган пеня чегарадан ошмади.'), 10.5);
  if (P.eski) yhMatn(b, 'Изоҳ: ушбу шартнома 29.08.2025 гача тузилган (эски шакл). Унда пеня 4.2.1-бандда белгиланган. Чегара шарти юрист томонидан шартноманинг асл матни бўйича текширилиши лозим.', 10);
  yhBolim(b, 'ДАЪВО СУММАСИНИНГ ҲИСОБ-КИТОБИ');
  const dv = [['Шартнома бўйича қолдиқ қарз (жами)', yhPul(M.asosiy)],
    ['шундан тўлов муддати ўтгани', yhPul(M.muddati)],
    ['шундан муддати ҳали келмагани', yhPul(Math.max(0, M.asosiy - M.muddati))]];
  if (M.qoshimcha > 0) dv.push(['Қўшимча майдон учун қарз', yhPul(M.qoshimcha)]);
  dv.push(['Пеня (юқоридаги ҳисоб бўйича)', yhPul(P.undiriladigan)]);
  dv.push(['Давлат божи', '____________']);
  dv.push(['Почта харажатлари', '____________']);
  dv.push(['ДАЪВО СУММАСИ (муддати ўтган қарз + пеня)', yhPul(M.muddati + M.qoshimcha + P.undiriladigan)]);
  dv.push(['Маълумот учун: қолдиқ қарзнинг ҳаммаси + пеня', yhPul(M.jami + P.undiriladigan)]);
  yhJadval(b, ['Кўрсаткич', 'Сумма, сўм'], dv, [420, 200], true);
  yhMatn(b, 'Шартномада Сотувчига муддатидан олдин тўлашни талаб қилиш ҳуқуқини берувчи банд йўқ, шу боис даъво фақат муддати ўтган қарз ва пеня бўйича тақдим этилади. '
    + 'Муддати ҳали келмаган ' + yhPul(Math.max(0, M.asosiy - M.muddati)) + ' сўм жадвал бўйича тўланиши давом этади ёки шартнома бекор қилинганда алоҳида ҳисоб-китоб қилинади.', 10);
  yhMatn(b, 'Давлат божи ва почта харажатлари юрист томонидан амалдаги тарифлар бўйича тўлдирилади.', 10);
  yhImzo(b, ism, M.bugun);
  return { model, nom: 'Penya_' + noF(M) + '_' + M.famLat + '_' + M.bugun };
}

module.exports = { malumotnomaModel, bayonnomaModel, penyaModel, aloqaMatn, aloqaBloklar, aloqaJoyla, aloqaYasa, aloqaNom, YH_PALATA, YU_SUD, YUX_TUR };
