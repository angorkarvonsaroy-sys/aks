// AKS TIZIM — yurist hujjatlari uchun ma'lumot yig'ish va hisob-kitob (Yurhujjat.gs v25.4 yhYig_, yhPenyaHisob_, yhSvod_, yhDavoMuddati_,
// yhXronologiya_ bilan bir xil). Hujjatlar (ma'lumotnoma, bayonnoma, penya, aloqa xati) shu ma'lumotdan yasaladi.
'use strict';
const V = require('./varaq');
const J = require('./jurnallar');
const U = require('./undiruv_yordam');
const P = require('./portfel');
const X = require('./xat_yordam');
const { xatKirill } = require('./ism');

const s = v => String(v == null ? '' : v);
const XAT_OY = ['январ', 'феврал', 'март', 'апрел', 'май', 'июн', 'июл', 'август', 'сентябр', 'октябр', 'ноябр', 'декабр'];
const XAT_BOSQICH = X.XAT_BOSQICH, XAT_BOSQICH_QM = X.XAT_BOSQICH_QM;
const YH_STAVKA = 0.001, YH_CHEGARA = 0.5, YH_YIL = 3;
const YH_BAND = { ESKI_TAYYOR: '4.2.1-банд (неустойка, кунига 0,1%)', ESKI_QURILAYOTGAN: '4.2.1-банд (неустойка, кунига 0,1%)',
  YANGI_TAYYOR: '2.7-банд (пеня, кунига 0,1%)', YANGI_QURILAYOTGAN: '5.1-банд (пеня, кунига 0,1%)' };
const YH_TUR = { tolov: 'Тўлов', chora: 'Ундирув чораси', xat: 'Огоҳлантириш хати', hujjat: 'Ҳужжат', yurist: 'Юридик иш' };
const YH_SHAKL = { 'Naqt': 'нақд', 'Naqd': 'нақд', 'Bank': 'банк', 'Plastik': 'пластик', 'Barter': 'бартер', "O'zaro hisob": 'ўзаро ҳисоб' };
const YH_BOSQICH_K = { 1: 'Юристга ўтди', 2: 'Даъво берилди', 3: 'Суд жараёнида', 4: 'Суд қарори чиқди', 5: 'Қарор кучга кирди', 6: 'Ижро варақаси олинди', 7: 'МИБ да ижрода' };
const YU_BOSQICH = { 1: "Yuristga o'tdi", 2: "Da'vo berildi", 3: 'Sud jarayonida', 4: 'Sud qarori chiqdi', 5: 'Qaror kuchga kirdi', 6: 'Ijro varaqasi olindi', 7: 'MIB da ijroda' };
const YU_TREK = { Davo: { zanjir: [1, 2, 3, 4, 5, 6, 7] }, Buyruq: { zanjir: [1, 2, 4, 7], bosqichK: { 1: 'Юристга ўтди', 2: 'Ариза берилди (буйруқ тартибида)', 4: 'Суд буйруғи чиқди', 7: 'МИБ да ижрода' } } };
const YH_TURI_K = { SHARTNOMA: 'Имзоланган шартнома', OGOHLANTIRISH: 'Огоҳлантириш хати', XAT_OLDIM: 'Хат топширилганлик тилхати',
  POCHTA: 'Почта квитанцияси', PASPORT: 'Паспорт нусхаси', KELISHUV: 'Қўшимча келишув', DALOLATNOMA: 'Далолатнома',
  DAVO: 'Даъво аризаси', SUD_AJRIM: 'Суд ажрими', SUD_QARORI: 'Суд қарори', IJRO_VARAQASI: 'Ижро варақаси', MIB: 'МИБ ҳужжати', BOSHQA: 'Бошқа ҳужжат' };
const YH_VOQEA = [["Direktor to'g'ridan-to'g'ri yuristga o'tkazdi", 'Директор тўғридан-тўғри юристга ўтказди'],
  ["Direktor tasdiqladi — yuristga o'tdi", 'Директор тасдиқлади — юристга ўтди'],
  ['Direktor rad etdi — mijoz undiruvchida qoladi', 'Директор рад этди — мижоз ундирувчида қолади'],
  ["Direktor tasdiqladi — yopildi (undirib bo'lmadi)", 'Директор тасдиқлади — ёпилди (ундириб бўлмади)'],
  ['Direktor yopishni rad etdi — ish davom etadi', 'Директор ёпишни рад этди — иш давом этади'],
  ["Undiruvchi yuristga o'tkazishni so'radi", 'Ундирувчи юристга ўтказишни сўради'],
  ["Undirib bo'lmadi — yopish so'raldi", 'Ундириб бўлмади — ёпиш сўралди'],
  ['Yopildi — shartnoma bekor qilindi', 'Ёпилди — шартнома бекор қилинди'],
  ['Direktor yopdi — mijoz qayta tuzishga keldi', 'Директор ёпди — мижоз қайта тузишга келди'],
  ["Kelishuv — muddatlar to'xtatildi", 'Келишув — муддатлар тўхтатилди'],
  ['Kelishuv buzildi — ish davom etadi', 'Келишув бузилди — иш давом этади'],
  ["Qarz to'liq to'landi — ish o'zi yopildi", 'Қарз тўлиқ тўланди — иш ўзи ёпилди'],
  ['Keyingi sud majlisi: ', 'Кейинги суд мажлиси: '],
  ['Ariza berildi (buyruq)', 'Ариза берилди (буйруқ тартибида)'], ["Sud buyrug'i chiqdi", 'Суд буйруғи чиқди'],
  ['Ariza rad etildi — qayta beriladi', 'Ариза рад этилди — қайта берилади']];

// ------------------------------------------------------------------ yordamchilar (Yurhujjat.gs)
const yhPul = n => Math.round(Number(n) || 0).toLocaleString('ru-RU').replace(/[  ,]/g, ' ');
function yhDmy(v) { v = s(v); return /^\d{4}-\d{2}-\d{2}/.test(v) ? v.slice(0, 10).split('-').reverse().join('.') : v; }
function yhIso(v) { v = s(v).trim(); if (/^\d{4}-\d{2}-\d{2}/.test(v)) return v.slice(0, 10); if (/^\d{2}\.\d{2}\.\d{4}/.test(v)) return v.slice(0, 10).split('.').reverse().join('-'); return ''; }
const yhKun = (a, b) => Math.round((new Date(yhIso(b) + 'T12:00:00') - new Date(yhIso(a) + 'T12:00:00')) / 86400000);
const yhKunlar = (a, b) => Math.round((new Date(b + 'T12:00:00') - new Date(a + 'T12:00:00')) / 86400000);
const yhOrqaga = (iso, yil) => { const p = iso.split('-'); return (Number(p[0]) - yil) + '-' + p[1] + '-' + p[2]; };
const yhQoshYil = (iso, yil) => { const p = s(iso).slice(0, 10).split('-'); return (Number(p[0]) + yil) + '-' + p[1] + '-' + p[2]; };
function yhSoz(iso) { iso = s(iso); if (!/^\d{4}-\d{2}-\d{2}/.test(iso)) return iso || '—'; return iso.slice(0, 4) + ' йил ' + Number(iso.slice(8, 10)) + ' ' + XAT_OY[Number(iso.slice(5, 7)) - 1]; }
function yhSozDa(iso) { const t = yhSoz(iso); return /^\d{4} йил/.test(t) ? t + 'да' : t; }
function yhRoyxat(a) { a = (a || []).filter(Boolean); if (a.length < 2) return a.join(''); return a.slice(0, -1).join(', ') + ' ва ' + a[a.length - 1]; }
const yhSon = n => ({ 1: 'бир', 2: 'икки', 3: 'уч', 4: 'тўрт', 5: 'беш' })[n] || n;
const yhShakl = v => YH_SHAKL[s(v).trim()] || s(v);
function yhHolat(h) {
  return { 'Faol': 'Фаол', 'Kelishuv': 'Келишув', "Yopish so'ralgan": 'Ёпиш сўралган', 'Tasdiq kutilmoqda': 'Тасдиқ кутилмоқда',
    'Yopildi — undirildi': 'Ёпилди — ундирилди', 'Yopildi — shartnoma bekor': 'Ёпилди — шартнома бекор қилинди',
    'Yopildi — undirib bo\'lmadi': 'Ёпилди — ундириб бўлмади', 'Yopildi — qayta tuzildi': 'Ёпилди — қайта тузилди' }[s(h)] || s(h || '—');
}
function yhVoqea(v) {
  v = s(v); const t = YH_VOQEA.find(p => v.indexOf(p[0]) === 0);
  if (t) return t[1] + v.slice(t[0].length);
  const b = Object.keys(YU_BOSQICH).find(k => YU_BOSQICH[k] === v);
  return b ? YH_BOSQICH_K[b] : v;
}
const yhQisqa = (v, n) => { v = s(v); return v.length > n ? v.slice(0, n - 1) + '…' : v; };
function yuBosqichNomiK(i) {   // Yurist.gs yuBosqichNomiK_
  const T = YU_TREK[i && i.tartib === 'Buyruq' ? 'Buyruq' : 'Davo']; const k = T.zanjir.indexOf(Number(i.bosqich));
  const nomi = T.bosqichK ? T.bosqichK[i.bosqich] : YH_BOSQICH_K[i.bosqich];
  return (k >= 0 ? (k + 1) + '. ' : '') + (nomi || '—');
}
function yhBoshMuddat(sh, M) {
  if (sh.boshKun) return 'шартнома имзоланган санадан бошлаб ' + sh.boshKun + ' кун ичида';
  const b1 = M.jadval.length ? M.jadval[0].sana : '';
  if (b1 && b1 > M.sana) return yhSoz(b1) + 'гача';
  return 'шартнома имзоланган санада';
}

// ------------------------------------------------------------------ manbalar (ko'zgu — getValues)
function aOxiri(rows) { let m = 0; rows.forEach(({ n, x }) => { if (x[0] !== null && x[0] !== undefined && x[0] !== '') m = n; }); return rows.filter(z => z.n <= m); }
const isoD = v => typeof v === 'number' ? V.iso(v) : '';   // getValues: Date → iso, aks holda ''
async function yh03(no) {
  const v = (aOxiri(await V.qatorlar('03_Sotuv_shartnomalar')).map(z => z.x).find(r => s(r[0]).trim() === no)) || [];
  return { mid: s(v[4] || ''), sana: isoD(v[2]), turi: s(v[3] || ''), qiymat: Number(v[25]) || 0,
    oylik: Number(v[26]) || 0, tolangan: Number(v[27]) || 0, kechikkan: Number(v[32]) || 0,
    boshSumma: Number(v[9]) || 0, boshKun: Number(v[10]) || 0, oy: Number(v[11]) || 0, tkun: Number(v[12]) || 0 };
}
async function yhMijoz(mid) {
  if (!mid) return {};
  const v = aOxiri(await V.qatorlar('02_Mijozlar')).map(z => { const o = []; for (let i = 0; i < 26; i++) o.push(z.x[i] == null ? '' : z.x[i]); return o; }).find(r => s(r[0]) === s(mid));
  if (!v) return {};
  const tel = [v[4], v[5]].filter(Boolean).map(t => '+998 ' + s(t).trim()).join(', ');
  const iib = [s(v[7] || ''), s(v[8] || '')].filter(Boolean).join(' ');
  return { fish: s(v[2] || ''), pasport: s(v[6] || ''), jshshir: s(v[11] || ''), tel, manzil: U.mijozManzil(v),
    pasIIB: iib ? iib + ' ИИБ' : '', pasSana: isoD(v[9]), pasMuddat: isoD(v[10]) };
}
async function yh03b(no) {
  return aOxiri(await V.qatorlar('03b_Tolov_jadvali')).map(z => z.x).filter(r => s(r[1]).trim() === no && r[3])
    .map(r => ({ t: Number(r[2]) || 0, sana: isoD(r[3]), summa: Number(r[4]) || 0, turi: s(r[6] || '') }))
    .sort((a, b) => a.sana < b.sana ? -1 : (a.sana > b.sana ? 1 : 0));
}
async function yhXodim(fish) {   // 07_Xodimlar: B — lotincha, C — kirillcha to'liq ism
  fish = s(fish).trim(); if (!fish) return '—';
  const r = aOxiri(await V.qatorlar('07_Xodimlar')).map(z => z.x).find(z => s(z[1]).trim() === fish);
  return r && r[2] ? s(r[2]).trim() : xatKirill(fish);
}
async function yuTarixOl(id) {   // yuTarixOl_ (getDisplayValues, teskari tartibda)
  return (await V.qatorlar('06f_Yurist_tarix')).map(z => { const o = []; for (let i = 0; i < 7; i++) o.push(s(z.r[i])); return o; })
    .filter(r => s(r[1]) === s(id)).reverse().map(r => ({ vaqt: r[0], voqea: r[3], kim: r[4], izoh: r[5], hujjat: r[6] }));
}

// ------------------------------------------------------------------ svod, penya, da'vo muddati, xronologiya
function yhSvod(jurnal, xat, tolov, hujjat) {
  const c = {}; let vada = 0, buzgan = 0, toliq = 0, qisman = 0, belgisiz = 0;
  jurnal.forEach(j => {
    const ch = s(j.chora || 'Белгиланмаган'); c[ch] = (c[ch] || 0) + 1;
    if (j.vadaSana || j.vadaSumma) {
      vada++; const n = s(j.vadaNatija);
      if (/буз/i.test(n)) buzgan++; else if (/қисман|кисман/i.test(n)) qisman++; else if (/тўлади|тулади/i.test(n)) toliq++; else belgisiz++;
    }
  });
  const yub = xat.filter(h => h.holati === 'Yuborildi');
  const skan = (hujjat || []).filter(h => h.kod === 'OGOHLANTIRISH');
  const isbot = (hujjat || []).filter(h => h.kod === 'XAT_OLDIM' || h.kod === 'POCHTA');
  // davr — eng erta va eng kech sana (23.10.2026: avval ro'yxatdagi birinchi va oxirgisi olinardi — skanlar yuklangan tartibda bo'lgani uchun «14.05.2026 — 20.04.2026» kabi teskari chiqardi)
  const dav = a => { const L = a.map(yhIso).filter(Boolean).sort(); return L.length ? yhDmy(L[0]) + ' — ' + yhDmy(L[L.length - 1]) : ''; };
  const sanalar = ch => jurnal.filter(j => s(j.chora) === ch).map(j => j.sana);
  return {
    chora: Object.keys(c).map(k => ({ nom: k, soni: c[k], davr: dav(sanalar(k)) })).sort((a, b) => b.soni - a.soni),
    jami: jurnal.length, xatJami: xat.length, xatYuborilgan: yub.length,
    xatSkan: skan.length, xatSkanDavr: dav(skan.map(h => h.sana)), isbot: isbot.length,
    xatHammasi: Math.max(yub.length, skan.length),
    xatOxirgi: yub.length ? yub[yub.length - 1] : null,
    vada, buzgan, toliq, qisman, belgisiz,
    tolovSoni: tolov.length, tolovDavr: tolov.length ? yhDmy(tolov[0].sana) + ' — ' + yhDmy(tolov[tolov.length - 1].sana) : ''
  };
}
function yhPenyaHisob(M) {
  const chek = yhOrqaga(M.bugun, YH_YIL);
  const qol = M.jadval.map(j => ({ sana: j.sana, summa: j.summa, qoldiq: j.summa, yopildi: [] }));
  M.tolov.slice().sort((a, b) => yhIso(a.sana) < yhIso(b.sana) ? -1 : 1).forEach(t => {
    let pul = Number(t.summa) || 0;
    for (let i = 0; i < qol.length && pul > 0; i++) {
      if (qol[i].qoldiq <= 0) continue;
      const x = Math.min(qol[i].qoldiq, pul); qol[i].qoldiq -= x; pul -= x;
      qol[i].yopildi.push({ sana: yhIso(t.sana), summa: x });
    }
  });
  const satr = []; let jami = 0;
  qol.forEach(q => {
    const boshla = q.sana > chek ? q.sana : chek;
    q.yopildi.forEach(y => {
      const kun = yhKunlar(boshla, y.sana); if (kun <= 0) return;
      const p = Math.round(y.summa * YH_STAVKA * kun); jami += p;
      satr.push({ muddat: q.sana, summa: y.summa, tolandi: y.sana, kun, penya: p });
    });
    if (q.qoldiq > 0) {
      const kun = yhKunlar(boshla, M.bugun); if (kun <= 0) return;
      const p = Math.round(q.qoldiq * YH_STAVKA * kun); jami += p;
      satr.push({ muddat: q.sana, summa: q.qoldiq, tolandi: '', kun, penya: p });
    }
  });
  const chegara = Math.round((Number(M.muddati) || 0) * YH_CHEGARA);
  const eski = /^ESKI_/.test(s(M.shablon));
  return { satr, jami, chegara, undiriladigan: Math.min(jami, chegara), eski, kesildi: jami > chegara, chek, band: YH_BAND[M.shablon] || 'шартноманинг пеня банди',
    jadvalJami: M.jadval.reduce((a, j) => a + j.summa, 0) };
}
function yhDavoMuddati(jadval, penya, tolov, bugun) {
  const ochiq = [];
  const oxirgiTolov = tolov.length ? yhIso(tolov[tolov.length - 1].sana) : '';
  const eng = jadval.filter(j => j.sana <= bugun).map(j => j.sana).sort()[0] || '';
  const tan = [oxirgiTolov, eng].filter(Boolean).sort().pop();
  const tugaydi = tan ? yhQoshYil(tan, YH_YIL) : '';
  const qolgan = tugaydi ? yhKunlar(bugun, tugaydi) : 0;
  jadval.forEach(j => { if (j.sana < penya.chek) ochiq.push(j.sana); });
  return { oxirgiTolov, tanOlish: tan, tugaydi, qolganKun: qolgan, xavf: !!tugaydi && qolgan < 180, eskirgan: ochiq.length, chek: penya.chek };
}
function yhXronologiya(M) {
  const R = [];
  M.tolov.forEach(t => R.push({ sana: yhIso(t.sana), tur: YH_TUR.tolov, mazmun: 'Тўлов қабул қилинди' + (t.shakl ? ' (' + yhShakl(t.shakl) + ')' : ''),
    summa: t.summa, natija: '', isbot: t.hujjat || '' }));
  M.jurnal.forEach(j => {
    const v = j.vadaSumma ? 'ваъда ' + yhPul(j.vadaSumma) + ' сўм' + (j.vadaSana ? ' (' + yhDmy(j.vadaSana) + ')' : '') + (j.vadaNatija ? ' — ' + j.vadaNatija : '') : '';
    R.push({ sana: yhIso(j.sana), tur: YH_TUR.chora, mazmun: (j.chora || '') + (j.mazmun ? ': ' + j.mazmun : ''),
      summa: '', natija: [j.natija || '', v].filter(Boolean).join(' · '), isbot: j.hujjat || 'ҳужжат илова қилинмаган' });
  });
  M.xat.forEach(h => {
    R.push({ sana: yhIso(h.sana), tur: YH_TUR.xat, mazmun: h.bosqichNomi + ' — №' + h.raqam + ' тайёрланди' + (h.muddat ? ', тўлов муддати ' + h.muddat : ''), summa: '', natija: h.holati, isbot: '' });
    if (h.yetSana) R.push({ sana: yhIso(h.yetSana), tur: YH_TUR.xat, mazmun: '№' + h.raqam + ' мижозга етказилди' + (h.usul ? ' (' + h.usul + ')' : ''), summa: '', natija: 'Етказилди', isbot: 'исбот ҳужжати юкланган' });
  });
  M.hujjat.forEach(h => R.push({ sana: yhIso(h.sana), tur: YH_TUR.hujjat, mazmun: h.turi + ' — ' + h.nom, summa: '', natija: '', isbot: h.nom }));
  M.tarix.forEach(t => R.push({ sana: yhIso(s(t.vaqt).slice(0, 10)), tur: YH_TUR.yurist, mazmun: yhVoqea(t.voqea) + (t.izoh ? ' — ' + t.izoh : ''), summa: '', natija: '', isbot: t.hujjat || '' }));
  return R.filter(r => r.sana).sort((a, b) => a.sana < b.sana ? -1 : (a.sana > b.sana ? 1 : 0));
}

// ------------------------------------------------------------------ yhYig_ — hamma ma'lumot
async function yhYig(id, ishOld) {
  const bugun = V.bugun();
  const ish = ishOld || (await J.yuIshlar()).find(z => String(z.id) === String(id));
  if (!ish) throw new Error('Yuristdagi ish topilmadi.');
  const no = ish.no;
  const x = (await P.xatShartnomalar(bugun)).find(z => z.no === no) || {};
  const r03 = await yh03(no), mij = await yhMijoz(x.mid || r03.mid);
  const fish = x.fish || ish.fish || mij.fish || '';
  const fishK = xatKirill(fish);
  const nomi = {}; require('../api/hujjat').HUJJAT_TURLARI.forEach(t => { nomi[t[0]] = t[1]; });
  const hujjat = (await J.hujjatJurnal()).filter(h => h.no === no && h.holati === 'Faol')
    .map(h => ({ turi: YH_TURI_K[h.turi] || nomi[h.turi] || h.turi, kod: h.turi, sana: h.sana, nom: h.nom, kim: h.kim }));
  const bor = {}; hujjat.forEach(h => { bor[h.kod] = true; });
  if (bor.XAT_OLDIM || bor.POCHTA) { bor.XAT_OLDIM = true; bor.OGOHLANTIRISH = true; }
  const yoq = [['SHARTNOMA', 'имзоланган шартнома'], ['OGOHLANTIRISH', 'огоҳлантириш хати'], ['XAT_OLDIM', 'хат топширилганлик исботи']].filter(t => !bor[t[0]]).map(t => t[1]);
  const xat = (await J.xatJurnal()).filter(h => h.no === no && h.holati !== 'Bekor').map(h => ({
    raqam: h.raqam, sana: h.sana, holati: h.holati, usul: h.usul, yetSana: h.yetSana, muddat: h.muddat,
    bosqichNomi: (X.xatSeriya(h.shablon) === 'QM' ? XAT_BOSQICH_QM : XAT_BOSQICH)[h.bosqich] || '' }));
  const jurnal = (await J.undJurnal()).filter(j => j.no === no);
  let vada = null; jurnal.forEach(j => { if (j.vadaSana) vada = { sana: j.vadaSana, summa: j.vadaSumma, natija: j.vadaNatija }; });
  const tolov = (await U.undTolovlar()).filter(t => t.no === no).slice().sort((a, b) => s(a.sana) < s(b.sana) ? -1 : 1);
  const jadval = await yh03b(no);
  const penya = yhPenyaHisob({ bugun, jadval, tolov, asosiy: x.asosiy || 0, muddati: x.muddati || 0, shablon: x.shablon || '' });
  return {
    svod: yhSvod(jurnal, xat, tolov, hujjat),
    jadval, penya, muddat: yhDavoMuddati(jadval, penya, tolov, bugun),
    bugun, no, ish, fish, fishK,
    famLat: s(fish).split(/\s+/)[0].replace(/[^A-Za-z`'Ѐ-ӿ]/g, '') || 'mijoz',
    pasport: mij.pasport || '—', jshshir: mij.jshshir || '—', tel: mij.tel || '—',
    manzil: x.manzil || mij.manzil || '—',
    sana: x.sana || r03.sana, turi: x.turi || r03.turi,
    dokonMatn: (x.blok ? '«' + x.blok + '» блок, ' + x.qavat + '-қават, ' + x.dokonNo + '-дўкон' : (x.dokon || ish.dokon || '—')) + (x.maydon ? ', ' + s(x.maydon).replace('.', ',') + ' м²' : ''),
    qiymat: r03.qiymat, tolangan: r03.tolangan, oylik: r03.oylik, kechikkan: r03.kechikkan, shart: r03,
    pasIIB: mij.pasIIB, pasSana: mij.pasSana, pasMuddat: mij.pasMuddat,
    asosiy: x.asosiy || 0, muddati: x.muddati || 0, qoshimcha: x.qoshimcha || 0, jami: x.jami || 0,
    undiruvchi: await yhXodim(x.undiruvchi || ish.undiruvchi), yurist: await yhXodim(ish.yurist),
    hujjat, yoq, xat, jurnal, vada, tolov,
    tarix: await yuTarixOl(ish.id)
  };
}

module.exports = { yhYig, yhXronologiya, yhPenyaHisob, yhSvod, yhDavoMuddati, yhXodim, yuBosqichNomiK, yhBoshMuddat,
  yhPul, yhDmy, yhIso, yhKun, yhKunlar, yhSoz, yhSozDa, yhRoyxat, yhSon, yhShakl, yhHolat, yhVoqea, yhQisqa, YH_YIL, YH_BOSQICH_K, XAT_OY };
