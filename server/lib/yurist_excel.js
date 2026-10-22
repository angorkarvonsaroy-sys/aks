// AKS TIZIM — yurist hujjatlarining Excel nusxasi (Yurhujjat.gs v25.4 yhExcel_ — bayonnoma, ikki varaq; yhPenyaExcel_ — penya hisobi).
// Eski kod so'zma-so'z: jadval chaqiruvlari lib/xlsx_google.js yozuvchisida, fayl — Google eksporti tuzilishida.
// 23.10.2026 tuzatildi (eski xato): «Ставка» formati '0,0%' (vergul — minglik ajratuvchi) 0,1% ni «0%» ko'rsatardi → '0.0%';
// summalar '# ##0' (bo'sh joy — oddiy belgi) faqat bitta bo'sh joy qo'yardi («8333 333») → '#,##0' (minglik guruhlash, «8 333 333»).
'use strict';
const XG = require('./xlsx_google');
const YM = require('./yurist_malumot');
const { yhDmy, yhShakl, YH_YIL } = YM;
const XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const nomi = (pref, M) => pref + '_' + M.no.replace(/\//g, '-') + '_' + M.famLat + '_' + M.bugun;

function penyaKitob(M) {
  const P = M.penya;
  const ss = XG.kitob();
  const s1 = ss.getSheets()[0]; s1.setName('Пеня ҳисоби');
  const b1 = [['ПЕНЯ (НЕУСТОЙКА) ҲИСОБ-КИТОБИ'], ['№' + M.no + ' · ' + M.fishK + ' · ҳисоб санаси ' + yhDmy(M.bugun)],
    [P.band + ' · тўлов эски қарздан ёпилади · пеня сўнгги ' + YH_YIL + ' йил учун'], [],
    ['№', 'Жадвал санаси', 'Сумма', 'Тўланган сана', 'Кечиккан кун', 'Ставка', 'Пеня']];
  P.satr.forEach((r, n) => b1.push([n + 1, yhDmy(r.muddat), r.summa, r.tolandi ? yhDmy(r.tolandi) : 'тўланмаган', r.kun, 0.001, r.penya]));
  b1.push([], ['', '', '', '', '', 'Жами пеня', P.jami], ['', '', '', '', '', 'Чегара (50%)', P.chegara],
    ['', '', '', '', '', 'Ундириладиган пеня', P.undiriladigan], ['', '', '', '', '', 'Асосий қарз', M.asosiy],
    ['', '', '', '', '', 'ЖАМИ ДАЪВО СУММАСИ', M.jami + P.undiriladigan]);
  s1.getRange(1, 1, b1.length, 7).setValues(b1.map(r => { while (r.length < 7) r.push(''); return r; }));
  s1.getRange(5, 1, 1, 7).setFontWeight('bold').setBackground('#0B3D2E').setFontColor('#FFFFFF');
  s1.getRange(1, 1).setFontWeight('bold').setFontSize(13); s1.setFrozenRows(5);
  s1.getRange(6, 3, Math.max(1, b1.length - 5), 1).setNumberFormat('#,##0');
  s1.getRange(6, 7, Math.max(1, b1.length - 5), 1).setNumberFormat('#,##0');
  s1.getRange(6, 6, Math.max(1, P.satr.length), 1).setNumberFormat('0.0%');
  [40, 120, 120, 120, 110, 90, 130].forEach((w, i) => s1.setColumnWidth(i + 1, w));
  return ss;
}
function bayonnomaKitob(M, X) {
  const ss = XG.kitob();
  const s1 = ss.getSheets()[0]; s1.setName('Хронология');
  const b1 = [['ИШ ҲАРАКАТЛАРИ БАЁННОМАСИ — 1-қисм. Хронология'], ['№' + M.no + ' · ' + M.fishK + ' · ' + M.dokonMatn + ' · ' + yhDmy(M.bugun) + ' ҳолатига'], [],
    ['Сана', 'Тури', 'Мазмуни', 'Тўлов, сўм', 'Натижа / ваъда', 'Исбот ҳужжати']];
  X.forEach(r => b1.push([yhDmy(r.sana), r.tur, r.mazmun, Number(r.summa) || '', r.natija || '', r.isbot || '']));
  b1.push([], ['Жами қайд:', X.length]);
  s1.getRange(1, 1, b1.length, 6).setValues(b1.map(r => { while (r.length < 6) r.push(''); return r; }));
  s1.getRange(4, 1, 1, 6).setFontWeight('bold').setBackground('#0B3D2E').setFontColor('#FFFFFF');
  s1.getRange(1, 1).setFontWeight('bold').setFontSize(13); s1.setFrozenRows(4);
  s1.setColumnWidth(1, 85); s1.setColumnWidth(2, 130); s1.setColumnWidth(3, 420); s1.setColumnWidth(4, 110); s1.setColumnWidth(5, 150); s1.setColumnWidth(6, 170);

  const s2 = ss.insertSheet('Тўловлар');
  const b2 = [['2-қисм. Тўловлар жадвали'], ['№' + M.no + ' · ' + M.fishK], [], ['№', 'Сана', 'Шакли', 'Сумма, сўм', 'Жамланма, сўм']];
  let j = 0; M.tolov.forEach((t, n) => { j += Number(t.summa) || 0; b2.push([n + 1, yhDmy(t.sana), yhShakl(t.shakl), Number(t.summa) || 0, j]); });
  b2.push([], ['', '', 'Жами тўланган', j, ''], ['', '', 'Шартнома қиймати', Number(M.qiymat) || 0, ''], ['', '', 'Қолдиқ қарз', Number(M.jami) || 0, '']);
  s2.getRange(1, 1, b2.length, 5).setValues(b2.map(r => { while (r.length < 5) r.push(''); return r; }));
  s2.getRange(4, 1, 1, 5).setFontWeight('bold').setBackground('#0B3D2E').setFontColor('#FFFFFF');
  s2.getRange(1, 1).setFontWeight('bold').setFontSize(13); s2.setFrozenRows(4);
  s2.getRange(5, 4, Math.max(1, b2.length - 4), 2).setNumberFormat('#,##0');
  s2.setColumnWidth(2, 95); s2.setColumnWidth(3, 130); s2.setColumnWidth(4, 130); s2.setColumnWidth(5, 140);
  return ss;
}
function penya(M) { return { nom: nomi('Penya', M) + '.xlsx', mime: XLSX, b64: XG.yasa(penyaKitob(M)).toString('base64') }; }
function bayonnoma(M, X) { return { nom: nomi('Bayonnoma', M) + '.xlsx', mime: XLSX, b64: XG.yasa(bayonnomaKitob(M, X)).toString('base64') }; }

module.exports = { penya, bayonnoma, penyaKitob, bayonnomaKitob };
