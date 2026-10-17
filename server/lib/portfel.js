// AKS TIZIM — UNDIRUV PORTFELI hisobi serverda (Undiruv.gs v26.3 undPortfel_ + Xat.gs xatShartnomalar_/xatKeyingi_/xatDavo_ + Yurist.gs yuMezon_/yuFaolSet_).
// Monitoring, bosh sahifa va «Bugungi ish» shunga tayanadi. Natija shakli eski tizim bilan BIR XIL.
// Farqi: eski undPortfel_ yo'l-yo'lakay ikkita yozuv qilardi — undVadaYangila_ (va'da natijasi) va xatZanjirBelgila_ (yopilgan zanjir).
// Server yozmaydi: va'da natijasini xuddi shu qoida bilan O'ZI hisoblaydi (javob bir xil chiqadi); zanjir belgilari eski tizimdan (koprikZanjir) olinadi.
'use strict';
const V = require('./varaq');
const J = require('./jurnallar');
const U = require('./undiruv_yordam');
const X = require('./xat_yordam');

const UND_ALOQA = ['Телефон', 'Ташриф (манзилига бориб)', 'Офисда суҳбат'];
const UND_JIM_KUN = 30, UND_JAVOBSIZ_KUN = 3;
const UND_DAVO_KUN = 1095, UND_DAVO_OGOH = 90;
const UND_XAVF_TOLOV = 365, UND_XAVF_DAVO = 180;
const XAT_ESKI_CHEGARA = '2025-08-30';
const XAT_CHORA_KUN = 30;
const XAT_CHORA_SHART = { 1: ['Телефон', 'СМС/Телеграм'], 2: ['Телефон', 'СМС/Телеграм'], 3: ['Телефон', 'Ташриф (манзилига бориб)', 'СМС/Телеграм'] };
const XAT_MUDDAT = { 1: 10, 2: 7, 3: 10 }, XAT_MUDDAT_YQ3 = 20, XAT_MUDDAT_SHOSH = 5, XAT_MUDDAT_SHOSH_YQ = 15, XAT_MUDDAT_SHOSH_MAX = 10, XAT_ZAXIRA_KUN = 30;
const XAT_DAVO_KUN = 1095, XAT_DAVO_OGOH = 90;
const YU_TOLOV_KUN = 90, YU_TOLOV_ULUSH = 0.7;

const kun = U.kun, qosh = U.kunQosh;
const s = v => String(v == null ? '' : v);

// ------------------------------------------------------------------ Xat.gs: xatShartnomalar_
async function xatShartnomalar(bugun) {
  const DK = {}; (await V.qatorlar('01_Dokonlar')).forEach(({ x }) => { if (x[0] != null && x[0] !== '') DK[s(x[0])] = { blok: s(x[2]), qavat: s(x[3]), no: s(x[4]), qur: s(x[7]) }; });
  const MJ = {}; (await V.qatorlar('02_Mijozlar')).forEach(({ x }) => { if (x[0] != null && x[0] !== '') MJ[s(x[0])] = U.mijozManzil(x.map(v => v == null ? '' : v)); });
  const OX = await U.oxirgiTolov(bugun);
  const L = [];
  (await V.qatorlar('03_Sotuv_shartnomalar')).forEach(({ x }) => {
    const no = s(x[0]).trim(); if (!/^27\/\d+$/.test(no)) return;
    const sana = V.iso(x[2]), turi = s(x[3]), dk = DK[s(x[5])] || {};
    const kechikkan = V.son(x[32]);
    const davoKun = U.davoKun(kechikkan, V.son(x[31]), OX[no], bugun);
    let shablon = '';
    if (!/100%/.test(turi)) {
      if (sana && sana < XAT_ESKI_CHEGARA) shablon = dk.qur === 'Якунланмаган' ? 'ESKI_QURILAYOTGAN' : 'ESKI_TAYYOR';
      else shablon = /Қурилаётган/.test(turi) ? 'YANGI_QURILAYOTGAN' : 'YANGI_TAYYOR';
    }
    const notarial = V.iso(x[15]);
    let qm = '', qmSabab = '';
    if (!(sana && sana < XAT_ESKI_CHEGARA)) qmSabab = 'Yangi shartnoma (2.5-band) — maydon farqi xati hali tayyorlanmagan.';
    else if (dk.qur !== 'Тугалланган') qmSabab = 'Do\'kon hali bitmagan — shartnomaning 2.3-bandiga ko\'ra yakuniy maydon qurilish tugagach aniqlanadi.';
    else qm = notarial ? 'QM_A' : 'QM_B';
    L.push({ no, sana, turi, mid: s(x[4]), dokon: s(x[5]), holati: s(x[13]), fish: s(x[20]),
      qm, qmSabab, notarial, real: V.son(x[21]), farq: V.son(x[23]), narx: V.son(x[7]), qoshQiymat: V.son(x[24]),
      maydon: V.son(x[6]) || '', asosiy: V.son(x[28]), qoshimcha: V.son(x[29]), jami: V.son(x[30]), muddati: V.son(x[31]),
      kechikkan, davoKun, oxirgiTolov: OX[no] || null, shoshilinch: davoKun >= XAT_DAVO_KUN - XAT_DAVO_OGOH, tolangan: V.son(x[27]), boshKun: V.son(x[10]),
      blok: dk.blok || '', qavat: dk.qavat || '', dokonNo: dk.no || '', manzil: MJ[s(x[4])] || '', shablon, undiruvchi: s(x[17]) });
  });
  return L;
}

// ------------------------------------------------------------------ Xat.gs: xatDavo_ / xatKeyingi_
function xatDavo(x, yubSoni) {
  const k = Number(x.davoKun != null ? x.davoKun : x.kechikkan) || 0;
  if (!(Number(x.muddati) > 0)) return { qolgan: 9999, otgan: false, shosh: false, kerak: 0, kun: 0 };
  const qolgan = XAT_DAVO_KUN - k, yq = x.shablon === 'YANGI_QURILAYOTGAN';
  let kerak = XAT_ZAXIRA_KUN; for (let b = (Number(yubSoni) || 0) + 1; b <= 3; b++) kerak += (yq && b === 3 ? XAT_MUDDAT_YQ3 : XAT_MUDDAT[b]) + 1;
  const otgan = qolgan <= 0;
  return { qolgan, otgan, shosh: otgan || qolgan < kerak, kerak, kun: yq ? XAT_MUDDAT_SHOSH_YQ : Math.max(XAT_MUDDAT_SHOSH, Math.min(XAT_MUDDAT_SHOSH_MAX, qolgan - XAT_ZAXIRA_KUN - 1)) };
}
function xatKeyingi(x, XJ, bugunIso, UJ, adm, seriya, Z) {
  seriya = seriya || 'AS';
  const ZZ = seriya === 'AS' ? (Z || {}) : {};
  const my = XJ.filter(h => h.no === x.no && h.holati !== 'Bekor' && X.xatSeriya(h.shablon) === seriya && X.xatJoriy(h, ZZ));
  const ochiq = my.find(h => h.holati === 'Tayyorlandi');
  if (/bekor/i.test(x.holati)) return { mumkin: false, sabab: 'Shartnoma bekor qilingan.' };
  if (seriya === 'AS' && !x.shablon) return { mumkin: false, sabab: '100% to\'lov shartnomasi — ogohlantirish xati shabloni yo\'q.' };
  if (seriya === 'QM' && !x.qm) return { mumkin: false, sabab: x.qmSabab || 'Maydon farqi bo\'yicha xat chiqmaydi.' };
  if (ochiq) return { mumkin: false, sabab: 'Oldingi xat (' + ochiq.raqam + ') hali yuborilmagan — holati: ' + ochiq.holati + '.' };
  const yub = my.filter(h => h.holati === 'Yuborildi');
  if (yub.length >= 3) return { mumkin: false, sabab: 'Uchala xat yuborilgan — navbat: yuristga o\'tkazish.' };
  if (yub.some(h => Number(h.bosqich) === 3)) return { mumkin: false, sabab: 'Talabnoma yuborilgan — navbat: yuristga o\'tkazish.' };
  if (seriya === 'AS' && !(x.muddati > X.XAT_MIN_QARZ)) return { mumkin: false, sabab: x.muddati > 0 ? 'Muddati o\'tgan qarz ' + x.muddati + ' so\'m — 100 000 so\'mdan kam, xat chiqmaydi.' : 'Muddati o\'tgan qarz yo\'q.' };
  const dv = seriya === 'AS' ? xatDavo(x, yub.length) : null;
  if (dv && dv.shosh) {
    if (yub.some(h => h.bosqich === 3)) return { mumkin: false, sabab: 'Talabnoma yuborilgan — navbat: yuristga o\'tkazish.' };
    return { mumkin: true, bosqich: 3, shoshilinch: true, davoQolgan: dv.qolgan, kun: dv.kun, kerak: dv.kerak };
  }
  if (seriya === 'QM' && !(x.qoshimcha > X.XAT_MIN_QARZ)) return { mumkin: false, sabab: 'Qo\'shimcha maydon qarzi yo\'q (yoki 100 000 so\'mdan kam).' };
  if (yub.length) { const m = X.xatIso(yub[yub.length - 1].muddat);
    if (bugunIso <= m) return { mumkin: false, sabab: 'Oldingi xatda berilgan to\'lov muddati (' + yub[yub.length - 1].muddat + ') hali o\'tmagan.' }; }
  const b = yub.length + 1;
  if (!adm) {
    let dan, izoh;
    if (b === 1) { dan = qosh(bugunIso, -XAT_CHORA_KUN); izoh = 'so\'nggi ' + XAT_CHORA_KUN + ' kunda'; }
    else { const p = yub[b - 2]; dan = X.xatIso(p.yetSana || p.sana); izoh = (b - 1) + '-xat yetkazilgan ' + (p.yetSana || p.sana) + ' dan keyin'; }
    const bor = (UJ || []).filter(j => j.no === x.no && (b === 1 ? j.sana >= dan : j.sana > dan)).map(j => j.chora);
    const yoq = XAT_CHORA_SHART[b].filter(c => bor.indexOf(c) < 0);
    if (yoq.length) return { mumkin: false, yetishmaydi: yoq, bosqich: b,
      sabab: (seriya === 'QM' ? 'Maydon farqi bo\'yicha ' : '') + (b === 3 ? 'talabnomadan' : b + '-xatdan') + ' oldin ' + izoh + ' jurnalda yetishmayapti: ' + yoq.map(c => c === 'Ташриф (манзилига бориб)' ? 'Ташриф (уйига бориб)' : c).join(', ') + '. Avval shu choralarni qilib, «Undiruv jurnali»ga yozing.' };
  }
  return { mumkin: true, bosqich: b };
}

// ------------------------------------------------------------------ Yurist.gs: yuHimoya_ / yuMezon_ / yuFaolSet_
function yuHimoya(x, t) {
  const ox = x && x.oxirgiTolov; if (!ox || !ox.sana || !(t >= 0 && t <= YU_TOLOV_KUN) || x.sekin) return null;
  const s90 = Number(ox.s90) || 0, oy = Number(x.oylik) || 0, kerak = Math.round(oy * 3 * YU_TOLOV_ULUSH);
  if (oy > 0 ? s90 < kerak : !(s90 > 0)) return null;
  const p = n => Math.round(n || 0).toLocaleString('ru-RU').replace(/[ ,]/g, ' ');
  return { s90, kerak, matn: '90 kunda jadvalning ' + Math.round(YU_TOLOV_ULUSH * 100) + ' % i to\'langan (' + p(s90) + (oy > 0 ? ' / ' + p(kerak) : '') + ' so\'m) — yuristga hali erta' };
}
function yuMezon(x, XJ, UJ, H, bugun, Z) {
  const yet = []; let sana = '';
  const xat = (sr, b) => XJ.filter(h => h.no === x.no && h.holati === 'Yuborildi' && X.xatSeriya(h.shablon) === sr && h.bosqich === b && X.xatJoriy(h, Z) && !/^Kutilmoqda/.test(String(h.tek || ''))).pop();
  const tAS = xat('AS', 3), tQM = xat('QM', 3);
  const shAS = !!tAS && /Shoshilinch/i.test(String(tAS.izoh || ''));
  const shosh = shAS || ((Number(x.muddati) || 0) > 0 && (Number(x.davoKun != null ? x.davoKun : x.kechikkan) || 0) >= 1095 - 90);
  const ikkiAS = !!(xat('AS', 1) && xat('AS', 2)), ikkiQM = !!(xat('QM', 1) && xat('QM', 2));
  const okAS = tAS && bugun > X.xatIso(tAS.muddat) && x.muddati > X.XAT_MIN_QARZ && (shosh || ikkiAS);
  const okQM = tQM && bugun > X.xatIso(tQM.muddat) && x.qoshimcha > X.XAT_MIN_QARZ && (shosh || ikkiQM);
  if (!okAS && !okQM) {
    if (!tAS && !tQM) yet.push(shosh ? 'shoshilinch talabnoma isboti bilan yuborilmagan' : 'uchala ogohlantirish xati (talabnomagacha) isboti bilan yuborilmagan');
    else if (!shosh && ((tAS && !ikkiAS) || (tQM && !ikkiQM)) && !(tAS && ikkiAS) && !(tQM && ikkiQM)) yet.push('talabnomadan oldingi 1- va 2-xat isboti bilan yuborilmagan');
    else yet.push('talabnomadagi to\'lov muddati hali o\'tmagan yoki qarz qolmagan');
  } else sana = [okAS ? X.xatIso(tAS.muddat) : '', okQM ? X.xatIso(tQM.muddat) : ''].filter(Boolean).sort()[0];
  const my = UJ.filter(j => j.no === x.no);
  if (!shosh) {
    if (!my.some(j => j.chora === 'Телефон')) yet.push('jurnalda telefon orqali ogohlantirish yo\'q');
    if (!my.some(j => j.chora === 'СМС/Телеграм')) yet.push('jurnalda SMS / Telegram orqali ogohlantirish yo\'q');
    if (!my.some(j => j.chora === 'Ташриф (манзилига бориб)')) yet.push('jurnalda uyiga borib ogohlantirish yo\'q');
  }
  if (!H.some(h => h.no === x.no && h.turi === 'SHARTNOMA')) yet.push('imzolangan shartnoma skani yuklanmagan');
  const ox = x.oxirgiTolov; if (ox && ox.sana) { const h = yuHimoya(x, kun(ox.sana, bugun)); if (h) yet.push(h.matn); }
  return { ok: !yet.length, yetishmaydi: yet, kun: sana ? kun(sana, bugun) : 0 };
}
async function yuFaolSet() {
  const I = await J.yuIshlar(); const f = new Set(), k = new Set();
  I.forEach(i => { if (i.holati === 'Tasdiq kutilmoqda') k.add(i.no); else if (i.holati !== 'Rad etildi') f.add(i.no); });
  return { yuristda: f, kutish: k };
}

// ------------------------------------------------------------------ Undiruv.gs: undVadaYangila_ (yozmasdan — natijani hisoblash), undXavf_, undNazorat_, undBuyruq_
function vadaNatija(j, T, bugun) {   // 06 dagi va'da natijasi; bo'sh yoki «Вадада» bo'lsa to'lovlarga qarab (eski tizim shu qiymatni yozib qo'yardi)
  if (!j.vadaSana || !j.vadaSumma || (j.vadaNatija && j.vadaNatija !== 'Вадада')) return j.vadaNatija;
  const tol = T.filter(t => t.no === j.no && t.sana >= j.sana && t.sana <= j.vadaSana).reduce((a, t) => a + t.summa, 0);
  if (tol >= j.vadaSumma) return 'Тўлади';
  if (bugun > j.vadaSana) return tol > 0 ? 'Қисман тўлади' : 'Вадасини бузди';
  return 'Вадада';
}
function undXavf(x, my, bugun) {
  if (!(Number(x.muddati) > 100000) || x.davoOtgan) return [];
  const R = [], dmy = v => String(v || '').split('-').reverse().join('.');
  const ox = x.oxirgiTolov;
  if (!x.tolovSoni) R.push('shartnomadan beri bir marta ham to\'lamagan');
  else if (ox && ox.sana) { const ref = x.sana && x.sana > ox.sana ? x.sana : ox.sana;
    if (kun(ref, bugun) > UND_XAVF_TOLOV) R.push(kun(ref, bugun) + ' kundan beri to\'lov yo\'q (' + (ref === ox.sana ? 'oxirgisi ' + dmy(ox.sana) : 'shartnoma ' + dmy(ref) + ' dan beri') + ')'); }
  if (x.buzilgan && x.vada) R.push('va\'dani buzgan (' + dmy(x.vada.sana) + '), yangi va\'da yo\'q');
  const al = my.filter(j => j.chora === 'Телефон' || j.chora === 'СМС/Телеграм' || j.chora === 'Ташриф (манзилига бориб)').slice(-3);
  if (!String(x.tel || '').replace(/\D/g, '')) R.push('telefon raqami yo\'q');
  else if (al.length === 3 && al.every(j => j.natija === 'Боғланиб бўлмади')) R.push('oxirgi 3 marta bog\'lanib bo\'lmadi');
  if (x.davoQolgan > 0 && x.davoQolgan <= UND_XAVF_DAVO) R.push('da\'vo muddati tugashiga ' + x.davoQolgan + ' kun qoldi');
  return R;
}
function undNazorat(x, bugun) {
  const M = Number(x.muddati) > 100000, Q = Number(x.qoshimcha) > 100000;
  if (x.tolovSoni === 0 && x.boshOtgan && x.jami > 0) return null;
  const ertaga = qosh(bugun, 1);
  const yakshanba = new Date(bugun + 'T12:00:00Z').getUTCDay() === 0;
  const bA = x.bugunAloqa || [], qilindi = bA.length > 0, vaqt = qilindi ? bA[0].vaqt : '';
  if (x.davoOtgan && M) return (x.yuSorov || x.talabnoma || x.oxirgiXat) ? { tur: 'yurist', kerak: '', qilindi, vaqt } : null;
  const v = x.vada;
  if (v && v.natija === 'Вадада' && v.sana >= bugun && (M || Q)) return { tur: 'vada', kerak: yakshanba ? '' : v.sana === bugun ? 'eslatma0' : v.sana === ertaga ? 'eslatma1' : '', qilindi, vaqt };
  if (x.oxirgiXat && (M || (Q && x.oxirgiXat.qm))) return { tur: 'xat', kerak: yakshanba ? '' : 'qongiroq', qilindi, vaqt };
  return null;
}
function undBuyruq(x) {
  const B = [];
  const har = t => /xat|talabnoma|bildirishnoma/i.test(t) ? 'xat' : /skanini yuklang/.test(t) ? 'hujjat' : 'karta';
  const q = t => B.push({ d: 'q', t, a: har(t) }), sq = t => B.push({ d: 's', t, a: har(t) }), k = t => B.push({ d: 'k', t, a: har(t) }), y = t => B.push({ d: 'y', t, a: har(t) });
  const sOn = t => { if (!B.some(b => b.t === t)) sq(t); };
  const choraT = c => c === 'Ташриф (манзилига бориб)' ? 'Uyiga boring va jurnalga yozing' : c === 'Телефон' ? 'Qo\'ng\'iroq qiling va jurnalga yozing' : 'SMS/Telegram yozing va jurnalga yozing';
  const M = Number(x.muddati) > 100000;
  const bekor = x.tolovSoni === 0 && x.boshOtgan && x.jami > 0;
  const eski = !!(x.xatEskirgan && x.xatEskirgan.length);
  const davo = !bekor && M && (x.davoOtgan || x.davoShosh);
  const faqatYurist = davo && x.davoOtgan;
  if (bekor) q('Boshlang\'ich to\'lov muddati o\'tdi, to\'lov yo\'q — shartnomani bekor qilish uchun direktorga kiriting');
  if (eski) x.xatEskirgan.forEach(h => q('Xat ' + h.raqam + ' — to\'lov muddati ' + h.muddat + ' da o\'tgan, yetkazmang: sababini yozib bekor qiling'));
  if (x.xatKechikdi > 0) q('Xat ' + x.xatKechikdi + ' kundan beri yetkazilmagan — darhol yetkazing va isbotini yuklang');
  else if (x.xatOchiq) q('Xatni bugun yetkazing va isbotini yuklang');
  if (davo) {
    const bosh = x.davoOtgan ? 'Da\'vo muddati o\'tgan' : 'Da\'vo muddati tugayapti (' + x.davoQolgan + ' kun qoldi)';
    if (x.yuSorov) q(bosh + ' — yuristga o\'tkazish so\'rovi direktorda, tezlashtiring');
    else if (!x.skan) q(bosh + ' — avval shartnoma skanini yuklang');
    else if (x.talabnoma) q(bosh + (x.talabnoma.otgan ? ' — shoshilinch yuristga o\'tkazishni so\'rang' : ' — talabnoma muddati ' + x.talabnoma.muddat + ', keyin yuristga o\'tkazishni so\'rang'));
    else if (!x.xatOchiq && !eski) q(bosh + ' — shoshilinch talabnomani chiqaring');
  }
  if (faqatYurist) {
    if (!x.jshshir) k('JSHSHIR yo\'q — direktorga ayting');
    if (!x.ota) k('Otasining ismi yo\'q — direktorga ayting');
    return B;
  }
  if (x.buzilgan && M) q('Va\'da buzildi — bugun qo\'ng\'iroq qiling');
  else if (x.qisman && M) sq('Va\'daning bir qismini to\'ladi — qolganiga yangi sana oling');
  if (x.u4 && x.u4.ok && !x.yuSorov) y('Yuristga o\'tkazishni so\'rang');
  if (!bekor && !eski && !davo && x.kAS) {
    if (x.kAS.mumkin) sq(x.kAS.bosqich === 3 ? 'Talabnomani chiqaring' : x.kAS.bosqich + '-xatni chiqaring');
    else if (x.kAS.yetishmaydi) x.kAS.yetishmaydi.forEach(c => sOn(choraT(c)));
  }
  if (!bekor && !eski && x.kQM) {
    if (x.kQM.mumkin) sq(x.kQM.bosqich === 1 ? 'Maydon farqi bildirishnomasini chiqaring' : x.kQM.bosqich === 2 ? 'Maydon farqi ogohlantirish xatini chiqaring' : 'Maydon farqi talabnomasini chiqaring');
    else if (x.kQM.yetishmaydi) x.kQM.yetishmaydi.forEach(c => sOn(choraT(c)));
  }
  if (!bekor && (M || Number(x.qoshimcha) > 100000) && x.javobsizKun >= UND_JAVOBSIZ_KUN) sq('Uyiga boring — ' + x.javobsizKun + ' kundan beri telefonga javob bermayapti');
  if (!bekor && x.jimKun >= UND_JIM_KUN && !x.buzilgan) sq(x.jimKun >= 9999 ? 'Hali chora ko\'rilmagan — bugun bog\'laning' : x.jimKun + ' kundan beri chora yo\'q — bugun bog\'laning');
  if (!x.skan && !B.some(b => /skanini yuklang/.test(b.t))) k('Shartnoma skanini yuklang');
  if (!x.jshshir) k('JSHSHIR yo\'q — direktorga ayting');
  if (!x.ota) k('Otasining ismi yo\'q — direktorga ayting');
  if (!x.tel) k('Telefon raqami yo\'q — direktorga ayting');
  return B;
}

// ------------------------------------------------------------------ undPortfel_ (kod — xat zanjirini ko'prikdan olish uchun xodim kodi)
async function undPortfel(filtr, kod) {
  const bugun = V.bugun();
  const [UJ, T, XJ, HJ, YF, SH, XSL, Z] = await Promise.all([J.undJurnal(), U.undTolovlar(), J.xatJurnal(), J.hujjatJurnal(), yuFaolSet(), U.undShartnomalar(), xatShartnomalar(bugun), X.xatZanjir(kod)]);
  UJ.forEach(j => { j.vadaNatija = vadaNatija(j, T, bugun); });
  const H = HJ.filter(h => h.holati === 'Faol');
  const L = SH.filter(x => filtr(x) && !YF.yuristda.has(x.no));
  const XS = {}; XSL.forEach(z => XS[z.no] = z);
  const joriy = h => X.xatJoriy(h, Z);
  // tezlik: shartnoma bo'yicha guruhlash (eski kod har mijozda butun jurnalni filtrlaydi — natija bir xil)
  const UJn = {}, Tn = {}, XJn = {};
  UJ.forEach(j => (UJn[j.no] = UJn[j.no] || []).push(j));
  T.forEach(t => (Tn[t.no] = Tn[t.no] || []).push(t));
  XJ.forEach(h => (XJn[h.no] = XJn[h.no] || []).push(h));
  L.forEach(x => {
    const xs = XS[x.no];
    const my = UJn[x.no] || [], Tm = Tn[x.no] || [], Xm = XJn[x.no] || [];
    const oxirgi = my[my.length - 1];
    x.chora = my.length;
    x.oxirgi = oxirgi ? { sana: oxirgi.sana, chora: oxirgi.chora, natija: oxirgi.natija } : null;
    x.jimKun = oxirgi ? kun(oxirgi.sana, bugun) : 9999;
    const vada = my.filter(j => j.vadaSana).pop();
    x.vada = vada ? { sana: vada.vadaSana, summa: vada.vadaSumma, natija: vada.vadaNatija, yozildi: vada.sana,
      tolandi: Tm.filter(t => t.sana >= vada.sana && t.sana <= vada.vadaSana).reduce((a, t) => a + t.summa, 0) } : null;
    x.xat = Xm.filter(h => h.holati === 'Yuborildi').length;
    const XE = Xm.filter(h => h.holati === 'Tayyorlandi' && h.muddat && X.xatIso(h.muddat) < bugun);
    x.xatEskirgan = XE.map(h => ({ raqam: h.raqam, muddat: h.muddat, sana: h.sana, bosqich: h.bosqich, qm: /^QM_/.test(String(h.shablon || '')) }));
    const eskiR = XE.map(h => h.raqam);
    x.xatOchiq = Xm.some(h => (h.holati === 'Tayyorlandi' || h.holati === 'Imzolandi') && eskiR.indexOf(h.raqam) < 0);
    x.xatKechikdi = Xm.filter(h => eskiR.indexOf(h.raqam) < 0).reduce((m, h) => Math.max(m, X.xatKechikkan(h, bugun)), 0);
    x.skan = H.some(h => h.no === x.no && h.turi === 'SHARTNOMA');
    x.bugunVada = !!(x.vada && x.vada.sana === bugun && x.vada.natija === 'Вадада');
    x.buzilgan = !!(x.vada && x.vada.natija === 'Вадасини бузди');
    x.yuSorov = YF.kutish.has(x.no);
    x.u4 = !x.yuSorov ? yuMezon(x, Xm, my, H, bugun, Z) : null;
    const dk = x.davoKun != null ? x.davoKun : x.kechikkan;
    x.davoQolgan = x.muddati > 0 ? UND_DAVO_KUN - dk : 9999;
    x.davoOtgan = x.muddati > 0 && dk >= UND_DAVO_KUN;
    x.davoXavf = !x.davoOtgan && x.muddati > 0 && x.davoQolgan <= UND_DAVO_OGOH;
    const yubAS = Xm.filter(h => h.holati === 'Yuborildi' && !/^QM_/.test(String(h.shablon || '')) && joriy(h)).length;
    const dv = xatDavo({ kechikkan: dk, muddati: x.muddati, shablon: xs ? xs.shablon : '' }, yubAS);
    x.davoShosh = !x.davoOtgan && dv.shosh;
    x.davoKerak = dv.kerak;
    x.qisman = !!(x.vada && x.vada.natija === 'Қисман тўлади');
    x.farq = xs ? Number(xs.farq) || 0 : 0;
    const ox = Xm.filter(h => h.holati === 'Yuborildi' && (/^QM_/.test(String(h.shablon || '')) || joriy(h)))
      .map(h => ({ raqam: h.raqam, bosqich: h.bosqich, qm: /^QM_/.test(String(h.shablon || '')), yet: X.xatIso(h.yetSana || h.sana), muddat: X.xatIso(h.muddat), shosh: /Shoshilinch/i.test(String(h.izoh || '')) }))
      .sort((a, b) => a.yet < b.yet ? -1 : a.yet > b.yet ? 1 : 0).pop() || null;
    x.oxirgiXat = ox;
    x.bosqichBosh = ox ? ox.yet : qosh(bugun, -30);
    x.bugunAloqa = my.filter(j => j.sana === bugun && UND_ALOQA.indexOf(j.chora) >= 0).map(j => ({ chora: j.chora, natija: j.natija, vaqt: j.vaqt }));
    x.bugunSms = my.some(j => j.sana === bugun && j.chora === 'СМС/Телеграм');
    const jk = {}; for (let i = my.length - 1; i >= 0; i--) { const j = my[i];
      if (j.chora === 'Ташриф (манзилига бориб)' || j.chora === 'Офисда суҳбат' || ((j.chora === 'Телефон' || j.chora === 'СМС/Телеграм') && j.natija && j.natija !== 'Боғланиб бўлмади')) break;
      if (j.chora === 'Телефон' && j.natija === 'Боғланиб бўлмади' && new Date(j.sana + 'T12:00:00Z').getUTCDay() !== 0) jk[j.sana] = 1; }
    x.javobsizKun = Object.keys(jk).length;
    x.tolovSoni = Tm.length;
    x.boshOtgan = !!(x.sana && new Date(x.sana + 'T12:00:00Z').getTime() + x.boshKun * 86400000 < new Date(bugun + 'T12:00:00Z').getTime());
    const tal = Xm.filter(h => h.holati === 'Yuborildi' && h.bosqich === 3 && !/^QM_/.test(String(h.shablon || '')) && joriy(h)).pop();
    x.talabnoma = tal ? { muddat: tal.muddat, otgan: bugun > X.xatIso(tal.muddat) } : null;
    x.tashrif = my.some(j => j.chora === 'Ташриф (манзилига бориб)');
    x.xavf = undXavf(x, my, bugun);
    x.kAS = xs ? xatKeyingi(xs, Xm, bugun, my, false, 'AS', Z) : null;
    x.kQM = (xs && xs.qoshimcha > 100000) ? xatKeyingi(xs, Xm, bugun, my, false, 'QM', Z) : null;
    x.buyruq = undBuyruq(x);
  });
  return { royxat: L, bugun };
}

module.exports = { undPortfel, xatShartnomalar, xatKeyingi, xatDavo, yuMezon, yuHimoya, yuFaolSet, undNazorat, undXavf, undBuyruq, vadaNatija,
  UND_JIM_KUN, UND_DAVO_KUN, UND_DAVO_OGOH, UND_ALOQA };
