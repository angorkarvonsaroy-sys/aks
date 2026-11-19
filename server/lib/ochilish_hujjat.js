// AKS TIZIM — 🏪 Ochilish nazorati: «Дўкон очилмагани учун ижара шартномасини бир томонлама бекор қилиш тўғрисида ХАБАРНОМА» (20.11.2026).
// Rasmiy blankada (lib/xat_pdf.js blankaYasa — ogohlantirish xati va ✂ bekor xabarnomasi bilan bir xil usul), direktor imzosi, muhr yo'q.
// Asos — YANGI shablon matni: 3.2.4 (5 kun ichida qabul qilib olish va ochish shart), 6.2 1-holat, 6.3 (ogohlantirishsiz xabarnoma, pochtadan
// 5 kun o'tgach bekor), 6.4 (bir tomonlama qabul qilish, mol-mulk), 6.7 (ustuvor sotib olish huquqi bekor). Sotilgan do'kon shablonida bo'limlar
// 5.2 / 5.3 / 5.4, ustuvor huquq bandi yo'q. Buyruq chiqarilmaydi — qonun bo'yicha shart emas (huquqiy tahlil 19.11.2026), direktor imzosi kifoya.
'use strict';
const XP = require('./xat_pdf');
const BH = require('./bekor_hujjat');
const { xatKirill } = require('./ism');
const O = require('./ochilish');

const s = v => String(v == null ? '' : v);
const { yhSoz, yhSozDa } = BH;
const dokonMatn = x => x.dk ? '«' + x.dk.blok + '» блок ' + x.dk.qavat + '-қаватдаги ' + x.dk.nomer + '-рақамли, умумий майдони '
  + s(x.maydon).replace('.', ',') + ' м² бўлган савдо дўкони' : x.dokon + ' рақамли савдо дўкони';

// Matn: { PA, PB }. x — shartnoma (kbTekshir natijasi: no, sana, dokon, fish, maydon, dk, beruvchi), z — 04b qatori, bekorIso — xabarnomadagi bekor sanasi
function xabarnomaMatn(x, z, bekorIso) {
  const mchj = s(x.beruvchi).trim() === 'MChJ' || !x.beruvchi;
  const B = mchj ? { bek: '6.2', xab: '6.3', qab: '6.4', ust: '6.7' } : { bek: '5.2', xab: '5.3', qab: '5.4', ust: '' };
  const PA = [], PB = [];
  PA.push('Сиз билан «ANGOR KARVON SAROY» МЧЖ (кейинги ўринларда – Жамият) ўртасида ' + yhSozDa(x.sana) + ' ' + dokonMatn(x)
    + 'дан бепул фойдаланиш тўғрисида №' + x.no + '-сонли ижара шартномаси (кейинги ўринларда – Шартнома) тузилган.');
  PA.push('Шартноманинг 3.2.4-бандига мувофиқ Сиз бепул фойдаланиш даври бошланган кундан (' + yhSoz(z.bosh) + ') бошлаб ' + O.OCH_KUN + ' (беш) кун ичида, яъни '
    + yhSoz(z.muddat) + 'гача, Дўконни қабул қилиш-топшириш далолатномаси бўйича қабул қилиб олишингиз ва унда савдо фаолиятини бошлашингиз шарт эди.');
  // 04b yozuvlari: «dd.mm.yyyy HH:MM · (natija ·) kim»
  const al = [], sanaDa = v => { const d = O.isoDan(s(v).slice(0, 10)); return d ? yhSozDa(d) + ' ' : ''; };
  if (z.eslatma) al.push(sanaDa(z.eslatma) + 'SMS орқали эслатма юборилган');
  if (z.sms2) al.push(sanaDa(z.sms2) + 'SMS орқали огоҳлантирилган');
  if (z.qongiroq) al.push(sanaDa(z.qongiroq) + 'телефон орқали боғланишга ҳаракат қилинган');   // natija (xodim lotincha yozadi) rasmiy xatga kirmaydi
  PA.push((z.tekVaqt ? yhSozDa(O.isoDan(z.tekVaqt.slice(0, 10))) + ' ўтказилган текширувда' : 'Текширувда') + ' Дўкон қабул қилиб олинмагани ва очилмагани аниқланди.'
    + (al.length ? ' Сизга ' + al.join(', ') + ', бироқ Дўкон очилмади.' : ''));
  PB.push('Шартноманинг ' + B.bek + '-банди (биринчи ҳолат) ва ' + B.xab + '-бандига мувофиқ Жамият Шартномани бир томонлама бекор қилиш ҳуқуқидан фойдаланди. '
    + 'Шартнома ' + yhSoz(bekorIso) + 'дан бекор қилинган ҳисобланади; ' + B.xab + '-бандга кўра бунинг учун Сизнинг розилигингиз, ўзаро келишув ёки қўшимча келишув талаб қилинмайди.');
  PB.push('Шартноманинг ' + B.qab + '-бандига мувофиқ Дўкон ' + yhSoz(bekorIso) + 'дан кейин Жамият ходимлари иштирокида бир томонлама далолатнома билан қабул қилиб олинади ва бошқа шахсга '
    + 'ижарага бериш ёки сотиш учун бўш ҳисобланади. Дўконда Сизга тегишли мол-мулк бўлса, у далолатномада рўйхатга олинади ва 30 (ўттиз) кун ичида олиб кетишингиз сўралади.'
    + (B.ust ? ' Шартноманинг ' + B.ust + '-бандига мувофиқ Дўконни устувор тартибда сотиб олиш ҳуқуқингиз бекор бўлади.' : ''));
  PB.push('Агар ' + yhSoz(bekorIso) + 'гача Дўконни далолатнома бўйича қабул қилиб олиб, савдони бошласангиз, Жамият ушбу хабарномани қайтариб олиш масаласини кўриб чиқиши мумкин — '
    + 'бунинг учун {{Ундирувчи_тел}} рақамига мурожаат қилинг.');
  return { PA, PB, B };
}
function bloklar(x, M) {
  const L = [];
  const q = (matn, o) => L.push(Object.assign({ t: 'p', x: matn, al: 'left', b: false, sz: 11, ind: false, left: 0, after: 0 }, o || {}));
  if (x.manzil) q(x.manzil + 'да яшовчи', { al: 'right', left: XP.XAT_MANZIL_CHAP });
  q((x.fishK || xatKirill(x.fish)) + 'га', { al: 'right', left: XP.XAT_MANZIL_CHAP, b: true });
  q(' ', {});
  q('ИЖАРА ШАРТНОМАСИНИ БИР ТОМОНЛАМА БЕКОР ҚИЛИШ', { al: 'center', b: true, after: 0 });
  q('ТЎҒРИСИДА ХАБАРНОМА', { al: 'center', b: true, after: 3 });
  M.PA.forEach(m => q(m, { al: 'both', ind: true, after: 1.5 }));
  M.PB.forEach(m => q(m, { al: 'both', ind: true, after: 1.5 }));
  return L;
}
// PDF: { pdf, bet, matn }. ij — { ism, tel } (api/xat_chiqar.js ijrochi)
async function xabarnomaYasa(x, z, raqam, sanaIso, bekorIso, ij) {
  const M = xabarnomaMatn(x, z, bekorIso);
  const r = await XP.blankaYasa(bloklar(x, M), { '{{Ундирувчи}}': ij.ism, '{{Ундирувчи_тел}}': ij.tel }, raqam, sanaIso, true);
  return Object.assign({ matn: M }, r);
}

module.exports = { xabarnomaMatn, bloklar, xabarnomaYasa, dokonMatn };
