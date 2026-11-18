// AKS TIZIM — 🛒 SOTUV BO'LIMI (19.11.2026, direktor qarori).
//
// Nega: 01.09.2025 — 19.11.2026 oralig'ida 01b_Tashrif_jurnali ga 1704 ta tashrif yozilgan, shundan 519 tasi
// «Дўкон сотиб олиш» / «Кредитга дўкон олиш» maqsadida (434 ta takrorlanmas telefon). Shu davrda 67 ta sotuv
// shartnomasi tuzilgan — ya'ni 400 dan ortiq odam kelib ketgan va ULARGA NIMA BO'LGANI HECH QAYERDA YO'Q.
// Tashrif yozilgan, lekin natijasi ham, keyingi qadami ham yozilmagan. Shuning uchun ikkinchi qo'ng'iroq bo'lmaydi.
//
// Nima qilinadi: har tashrifga NATIJA va KEYINGI QADAM qo'yiladi. Yangi varaq — 01c_Tashrif_natija (Tashrif_ID bo'yicha).
// 01b ning ustunlariga tegilmaydi: u yerda formulalar bor (K:P) va eski tizim ham o'sha varaqqa yozadi.
'use strict';
const BQ = require('../lib/bayroq');
const S = require('./sessiya');
const V = require('../lib/varaq');
const G = require('../lib/google');
const env = require('../lib/env');
const koprik = require('./koprik');
const tetik = require('../lib/kozgu_tetik');
const { xodimTeng } = require('../lib/xodim');

const ST_VARAQ = '01c_Tashrif_natija';
const ST_S = ['Tashrif_ID', 'Natija', 'Sabab', 'Keyingi_qadam', 'Qadam_sana', 'Izoh', 'Kim', 'Vaqt'];
// 🔒 BRON (19.11.2026, direktor qarori). Xaritadagi «Брон» — bu bron emas, shartnomaning «Шартнома олмаган» holati.
// Haqiqiy bron shu yerda: do'kon 3 kunga band qilinadi, muddat tugasa o'zi bo'shaydi va sotuvchiga topshiriq tushadi.
const BR_VARAQ = '01d_Bronlar';
const BR_S = ['Bron_ID', 'Dokon_ID', 'Mijoz_FISH', 'Telefon', 'Bron_sana', 'Tugash_sana', 'Holati', 'Uzaytirildi', 'Uzaytirish_sababi', 'Izoh', 'Kim', 'Vaqt', 'Yakun_izoh'];
const BR_KUN = 3;          // bron muddati
const BR_UZAYTIR = 3;      // uzaytirilganda qo'shiladigan kun
const BR_UZ_MAX = 1;       // xodim necha marta uzaytira oladi (keyingisi — direktor)
const BR_OGOH_KUN = 1;     // tugashiga shuncha kun qolganda ogohlantiriladi

// Natijalar — yopiladigan (zanjir tugaydi) va ochiq (keyingi qadam kerak)
const ST_NATIJA = [
  ['shartnoma', 'Шартнома тузилди', true],
  ['taklif', 'Таклиф берилди', false],
  ['oylaydi', 'Ўйлаб кўради', false],
  ['qayta', 'Қайта келади / кўрсатиш керак', false],
  ['qiziqmadi', 'Қизиқмади', true],
  ['aloqa', 'Боғланиб бўлмади', false],
  ['notogri', 'Рақам нотўғри', true]
];
const ST_SABAB = ['Нарх қиммат', 'Жойи ёқмади', 'Кредит берилмади', 'Бошқа жойдан олди', 'Ҳозир пули йўқ', 'Бошқа сабаб'];
const ST_MAQSAD = ['Дўкон сотиб олиш масаласида', 'Кредитга дўкон олиш масаласида'];   // sotuv voronkasiga tushadigan tashriflar
const ST_KUN = 1;        // tashrifdan keyin necha kun ichida natija qo'yilishi kerak
// 19.11.2026: qoida shu kundan boshlanadi. Undan oldingi 519 ta tashrif uchun topshiriq chiqarilmaydi —
// ular bo'yicha alohida qo'ng'iroq ro'yxati berilgan (406 ta mijoz, Excel). Ekranda esa hammasi ko'rinadi.
const ST_BOSH = '2026-11-19';
// «Kim kiritdi» ustunida odam emas, migratsiya belgisi yoki pochta turgan qatorlar bor — ularga topshiriq berilmaydi
const stXodim = k => { const v = s(k).trim(); return v && v.indexOf('@') < 0 && !/migratsiya|лист|list/i.test(v) ? v : ''; };
const ST_ROYXAT = 400;   // ekranga chiqadigan eng ko'p qator

const s = v => String(v == null ? '' : v);
const kut = (p, ms) => Promise.race([p, new Promise(r => setTimeout(r, ms))]);
const yangila = nomlar => kut(tetik.varaqlarYangila(nomlar).catch(e => console.error('ko\'zgu (sotuv):', e.message)), 15000);
const ustunHarf = n => { let r = ''; while (n > 0) { const m = (n - 1) % 26; r = String.fromCharCode(65 + m) + r; n = Math.floor((n - 1) / 26); } return r; };
const stIso = v => typeof v === 'number' ? V.iso(v) : (/^\d{2}\.\d{2}\.\d{4}/.test(s(v)) ? s(v).slice(0, 10).split('.').reverse().join('-') : s(v).slice(0, 10));
const stDmy = iso => iso ? s(iso).slice(0, 10).split('-').reverse().join('.') : '';
function hozirIso() { const d = new Date(Date.now() + 5 * 3600 * 1000); return d.toISOString().slice(0, 10) + ' ' + d.toISOString().slice(11, 19); }
const natNomi = k => (ST_NATIJA.find(x => x[0] === k) || [, s(k)])[1];
const natYopiq = k => !!(ST_NATIJA.find(x => x[0] === k) || [])[2];

async function serverda() { try { return await BQ.yozuv('tashrif'); } catch (e) { return false; } }
function kunQosh(iso, n) { const d = new Date(iso + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }

// ------------------------------------------------------------------ 01c varaq
async function varaqTayyor() {
  const m = await G.varaqlar(env.aksBazaId, env.googleKey);
  if (m.varaqlar.some(v => v.title === ST_VARAQ)) return;
  await G.soralar(env.aksBazaId, [{ addSheet: { properties: { title: ST_VARAQ,
    gridProperties: { rowCount: 3000, columnCount: ST_S.length, frozenRowCount: 1 } } } }], env.googleKey);
  await G.yoz(env.aksBazaId, [{ varaq: ST_VARAQ, katak: 'A1', qiymat: [ST_S] }], env.googleKey);
}
// Google'dan YANGI o'qish (yozishdan oldin — ko'zgu kechikishi bo'lmasin)
async function natijaYangi() {
  try {
    const R = await G.oraliqOqi(env.aksBazaId, ST_VARAQ, 'A2:' + ustunHarf(ST_S.length), env.googleKey, 'UNFORMATTED_VALUE');
    let m = -1; R.forEach((r, i) => { if (r[0] !== '' && r[0] != null) m = i; });
    return R.slice(0, m + 1).map((r, i) => { const o = { qator: i + 2 }; ST_S.forEach((k, j) => { o[k] = r[j] == null ? '' : r[j]; }); return o; });
  } catch (e) { if (/Unable to parse range|not found/i.test(e.message)) return []; throw e; }
}
// Ko'zgudan (tez) — ekran uchun
async function natijaKozgu() {
  try { return (await V.qatorlar(ST_VARAQ)).map(({ n, x }) => { const o = { qator: n }; ST_S.forEach((k, j) => { o[k] = x[j] == null ? '' : x[j]; }); return o; })
    .filter(z => s(z.Tashrif_ID).trim()); } catch (e) { return []; }
}

// ------------------------------------------------------------------ tashriflar + natijalar
// Sotuv voronkasiga tushadigan tashriflar: maqsadi «sotib olish» yoki «kreditga», bekor qilinmagan.
async function tashrifRoyxat(bugun) {
  const [T, NT] = await Promise.all([V.qatorlar('01b_Tashrif_jurnali'), natijaKozgu()]);
  const N = {}; NT.forEach(z => { N[s(z.Tashrif_ID).trim()] = z; });
  const L = [];
  T.forEach(({ x }) => {
    const id = s(x[0]).trim(); if (!id) return;
    const maqsad = s(x[6]); if (ST_MAQSAD.indexOf(maqsad) < 0) return;
    const n = N[id] || null;
    const sana = stIso(x[1]);
    L.push({ id, sana, fish: s(x[2]), tel: s(x[3]), manzil: s(x[4]), maqsad, izoh: s(x[7]), kim: s(x[8]),
      turi: s(x[16]).trim() === 'Telefon' ? 'Telefon' : 'Tashrif',
      natija: n ? s(n.Natija) : '', natijaNomi: n ? natNomi(n.Natija) : '', sabab: n ? s(n.Sabab) : '',
      qadam: n ? s(n.Keyingi_qadam) : '', qadamSana: n ? stIso(n.Qadam_sana) : '', natIzoh: n ? s(n.Izoh) : '',
      natKim: n ? s(n.Kim) : '', natVaqt: n ? s(n.Vaqt) : '',
      yopiq: n ? natYopiq(n.Natija) : false });
  });
  L.forEach(z => {
    z.kechikkan = 0; z.holat = 'ochiq';
    if (z.yopiq) { z.holat = 'yopiq'; return; }
    if (!z.natija) { z.holat = 'natijasiz'; z.kechikkan = Math.max(0, kun(z.sana, bugun) - ST_KUN); return; }
    if (!z.qadamSana) { z.holat = 'qadamsiz'; return; }
    if (z.qadamSana < bugun) { z.holat = 'kechikdi'; z.kechikkan = kun(z.qadamSana, bugun); }
    else if (z.qadamSana === bugun) z.holat = 'bugun';
    else z.holat = 'kutilmoqda';
  });
  return L;
}
function kun(a, b) { if (!a || !b) return 0; return Math.round((new Date(b + 'T12:00:00Z') - new Date(a + 'T12:00:00Z')) / 86400000); }

// ------------------------------------------------------------------ 🛒 ekran
async function sotuvBoshlang([kodSes]) {
  const u = await S.ruxsat(kodSes, 'tashrif');
  const bugun = V.bugun();
  const L = await tashrifRoyxat(bugun);
  const meniki = z => u.admin || xodimTeng(z.kim, u.fish) || xodimTeng(z.natKim, u.fish);
  const M = L.filter(meniki);
  const son = { jami: M.length, natijasiz: 0, kechikdi: 0, bugun: 0, kutilmoqda: 0, yopiq: 0, shartnoma: 0 };
  M.forEach(z => { if (z.holat === 'natijasiz') son.natijasiz++; else if (z.holat === 'kechikdi' || z.holat === 'qadamsiz') son.kechikdi++;
    else if (z.holat === 'bugun') son.bugun++; else if (z.holat === 'kutilmoqda') son.kutilmoqda++; else son.yopiq++;
    if (z.natija === 'shartnoma') son.shartnoma++; });
  // oylik svod — direktor uchun (hamma xodim bo'yicha)
  const oy = bugun.slice(0, 7);
  const svod = {}; L.forEach(z => { if (s(z.sana).slice(0, 7) !== oy) return;
    const k = z.kim || '—'; const o = svod[k] || (svod[k] = { xodim: k, tashrif: 0, taklif: 0, shartnoma: 0, natijasiz: 0 });
    o.tashrif++; if (z.natija === 'taklif') o.taklif++; if (z.natija === 'shartnoma') o.shartnoma++; if (!z.natija) o.natijasiz++; });
  const tartib = { natijasiz: 0, kechikdi: 1, qadamsiz: 2, bugun: 3, kutilmoqda: 4, yopiq: 5 };
  M.sort((a, b) => (tartib[a.holat] - tartib[b.holat]) || (a.sana < b.sana ? 1 : -1));
  let bron = [];
  try { bron = (await bronRoyxat(bugun)).filter(z => u.admin || !z.kim || xodimTeng(z.kim, u.fish))
    .sort((a, b) => (a.holati === 'Faol' ? 0 : 1) - (b.holati === 'Faol' ? 0 : 1) || (a.qoldi == null ? 99 : a.qoldi) - (b.qoldi == null ? 99 : b.qoldi)); }
  catch (e) { console.error('sotuvBron:', e.message); }
  son.bronFaol = bron.filter(z => z.holati === 'Faol').length;
  son.bronOtdi = bron.filter(z => z.holati === 'Muddati o\'tdi').length;
  return { ishlar: M.slice(0, ST_ROYXAT), son, bron, bronKun: BR_KUN, bugun, bosh: ST_BOSH, admin: u.admin, mening: u.fish,
    svod: u.admin ? Object.values(svod).sort((a, b) => b.shartnoma - a.shartnoma || b.tashrif - a.tashrif) : [],
    natijalar: ST_NATIJA.map(x => ({ kalit: x[0], nomi: x[1], yopiq: x[2] })), sabablar: ST_SABAB };
}

// ------------------------------------------------------------------ ✍ natija yozish
async function sotuvNatija(args) {
  const [kodSes, id0, d0] = args; const d = d0 || {};
  const u = await S.ruxsat(kodSes, 'tashrif');
  if (u.sifat) throw new S.Xato('👁 Ko\'rish rejimida bajarilmaydi.');
  const id = s(id0).trim(); if (!id) throw new S.Xato('Tashrif tanlanmagan.');
  const nat = s(d.natija).trim(); if (!ST_NATIJA.some(x => x[0] === nat)) throw new S.Xato('Natijani tanlang.');
  const sabab = s(d.sabab).trim(), qadam = s(d.qadam).replace(/\s+/g, ' ').trim();
  const qSana = s(d.qadamSana).trim(), izoh = s(d.izoh).replace(/\s+/g, ' ').trim();
  if (nat === 'qiziqmadi' && !sabab) throw new S.Xato('«Қизиқмади» танланса — сабабини танланг.');
  if (!natYopiq(nat)) {
    if (qadam.length < 3) throw new S.Xato('Кейинги қадамни ёзинг (масалан: «Шанба куни дўконни кўрсатиш»).');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(qSana)) throw new S.Xato('Кейинги қадам санасини киритинг.');
    if (qSana < V.bugun()) throw new S.Xato('Кейинги қадам санаси ўтган кун бўлмасин.');
  }
  if (!(await serverda())) throw new S.Xato('Сотув бўлимига ёзиш ҳозир ўчиқ. Директорга айтинг.');
  const T = (await V.qatorlar('01b_Tashrif_jurnali')).find(({ x }) => s(x[0]).trim() === id);
  if (!T) throw new S.Xato('Ташриф топилмади.');
  if (!u.admin && !xodimTeng(s(T.x[8]), u.fish)) throw new S.Xato('Бу ташриф сизники эмас.');
  await varaqTayyor();
  const bor = (await natijaYangi()).find(z => s(z.Tashrif_ID).trim() === id);
  const qiymat = [id, nat, natYopiq(nat) ? sabab : '', natYopiq(nat) ? '' : qadam, '', izoh, u.fish, ''];
  if (bor) {
    await G.yoz(env.aksBazaId, [{ varaq: ST_VARAQ, katak: 'A' + bor.qator, qiymat: [qiymat] }], env.googleKey);
    if (!natYopiq(nat)) await G.sanaYoz(env.aksBazaId, [{ varaq: ST_VARAQ, qator: bor.qator, ustun: 5, iso: qSana, naqsh: 'dd.MM.yyyy' }], env.googleKey);
    await G.sanaYoz(env.aksBazaId, [{ varaq: ST_VARAQ, qator: bor.qator, ustun: 8, iso: hozirIso(), naqsh: 'auto' }], env.googleKey);
  } else {
    // qatorQoshR — qo'shilgan qatorning HAQIQIY raqamini qaytaradi (qatorQosh xom javob beradi)
    const N = (await natijaYangi()).reduce((m, z) => Math.max(m, z.qator), 1);
    const qator = await G.qatorQoshR(env.aksBazaId, ST_VARAQ, N + 1, qiymat, env.googleKey);
    if (!natYopiq(nat)) await G.sanaYoz(env.aksBazaId, [{ varaq: ST_VARAQ, qator, ustun: 5, iso: qSana, naqsh: 'dd.MM.yyyy' }], env.googleKey);
    await G.sanaYoz(env.aksBazaId, [{ varaq: ST_VARAQ, qator, ustun: 8, iso: hozirIso(), naqsh: 'auto' }], env.googleKey);
  }
  await yangila([ST_VARAQ]);
  return { ok: true, natija: natNomi(nat), yopiq: natYopiq(nat) };
}

// ------------------------------------------------------------------ 🔒 BRON
async function brVaraqTayyor() {
  const m = await G.varaqlar(env.aksBazaId, env.googleKey);
  if (m.varaqlar.some(v => v.title === BR_VARAQ)) return;
  await G.soralar(env.aksBazaId, [{ addSheet: { properties: { title: BR_VARAQ,
    gridProperties: { rowCount: 2000, columnCount: BR_S.length, frozenRowCount: 1 } } } }], env.googleKey);
  await G.yoz(env.aksBazaId, [{ varaq: BR_VARAQ, katak: 'A1', qiymat: [BR_S] }], env.googleKey);
}
async function brYangi() {
  try {
    const R = await G.oraliqOqi(env.aksBazaId, BR_VARAQ, 'A2:' + ustunHarf(BR_S.length), env.googleKey, 'UNFORMATTED_VALUE');
    let m = -1; R.forEach((r, i) => { if (r[0] !== '' && r[0] != null) m = i; });
    return R.slice(0, m + 1).map((r, i) => { const o = { qator: i + 2 }; BR_S.forEach((k, j) => { o[k] = r[j] == null ? '' : r[j]; }); return o; });
  } catch (e) { if (/Unable to parse range|not found/i.test(e.message)) return []; throw e; }
}
// Ko'zgudan — ekran va qoidalar uchun. Holati hisoblanadi: Faol / Muddati o'tdi / Shartnoma / Bekor
async function bronRoyxat(bugun) {
  let R = [];
  try { R = (await V.qatorlar(BR_VARAQ)).map(({ n, x }) => { const o = { qator: n }; BR_S.forEach((k, j) => { o[k] = x[j] == null ? '' : x[j]; }); return o; })
    .filter(z => s(z.Bron_ID).trim()); } catch (e) { return []; }
  return R.map(z => {
    const tugash = stIso(z.Tugash_sana), hol = s(z.Holati).trim() || 'Faol';
    const faol = hol === 'Faol';
    const qoldi = faol && tugash ? kun(bugun, tugash) : null;
    return { id: s(z.Bron_ID), dokon: s(z.Dokon_ID), fish: s(z.Mijoz_FISH), tel: s(z.Telefon),
      sana: stIso(z.Bron_sana), tugash, holati: faol && qoldi !== null && qoldi < 0 ? 'Muddati o\'tdi' : hol,
      uzaytirildi: Number(z.Uzaytirildi) || 0, uzSabab: s(z.Uzaytirish_sababi), izoh: s(z.Izoh),
      kim: s(z.Kim), vaqt: s(z.Vaqt), yakun: s(z.Yakun_izoh), qoldi, qator: z.qator,
      ogoh: faol && qoldi !== null && qoldi >= 0 && qoldi <= BR_OGOH_KUN };
  });
}
// Do'kon bron qilish mumkinmi: sotilgan / ijarada / boshqa bron bo'lmasin
async function dokonHolat(dokonId, bugun) {
  const D = (await V.qatorlar('01_Dokonlar')).find(({ x }) => s(x[0]).trim().toLowerCase() === s(dokonId).trim().toLowerCase());
  if (!D) return { bor: false };
  const x = D.x;
  // 01_Dokonlar: I(8) Taqiq, L(11) Rais, S(18) Egasi, Z(25) xarita holati (hisoblanadi: Bo'sh / Sotilgan / Sotilgan+ijara / Bo'sh+ijara / Bron / Ma'muriyat)
  const egasi = s(x[18]).trim(), taqiq = /^ha$/i.test(s(x[8]).trim()), rais = /^ha$/i.test(s(x[11]).trim());
  const xh = s(x[25]).trim(), qur = s(x[7]).trim();
  const B = (await bronRoyxat(bugun)).find(z => z.dokon.toLowerCase() === s(dokonId).trim().toLowerCase() && z.holati === 'Faol');
  return { bor: true, id: s(x[0]).trim(), blok: s(x[2]), qavat: s(x[3]), no: s(x[4]), maydon: Number(x[5]) || 0, qurilish: qur,
    egasi: egasi && egasi.toUpperCase() !== 'SOTILMAGAN' ? egasi : '', xHolat: xh,
    ijarada: /ijara/i.test(xh), mamuriyat: /ma.?muriyat/i.test(xh), taqiq, rais, bron: B || null };
}

async function sotuvBron(args) {
  const [kodSes, d0] = args; const d = d0 || {};
  const u = await S.ruxsat(kodSes, 'tashrif');
  if (u.sifat) throw new S.Xato('👁 Ko\'rish rejimida bajarilmaydi.');
  const dokon = s(d.dokon).trim().toUpperCase();
  if (!dokon) throw new S.Xato('Дўкон рақамини киритинг (масалан: B1-1-6).');
  const fish = s(d.fish).replace(/\s+/g, ' ').trim(); if (fish.length < 5) throw new S.Xato('Мижознинг Ф.И.Ш.ини ёзинг.');
  const tel = s(d.tel).replace(/\D/g, ''); if (tel.length < 9) throw new S.Xato('Телефон рақамини тўғри киритинг.');
  const izoh = s(d.izoh).replace(/\s+/g, ' ').trim();
  if (!(await serverda())) throw new S.Xato('Сотув бўлимига ёзиш ҳозир ўчиқ. Директорга айтинг.');
  const bugun = V.bugun();
  const D = await dokonHolat(dokon, bugun);
  if (!D.bor) throw new S.Xato('Бундай дўкон топилмади: ' + dokon);
  if (D.egasi) throw new S.Xato('Бу дўкон сотилган (эгаси: ' + D.egasi + ').');
  if (D.mamuriyat) throw new S.Xato('Бу дўкон маъмурият хонаси.');
  if (D.ijarada) throw new S.Xato('Бу дўкон ижарада.');
  if (D.taqiq) throw new S.Xato('Бу дўкон тақиқда — директордан рухсат керак.');
  if (D.rais && !u.admin) throw new S.Xato('Бу дўкон раисга ажратилган — директордан рухсат керак.');
  if (D.bron) throw new S.Xato('Бу дўкон аллақачон бронда: ' + D.bron.fish + ' (' + D.bron.kim + '), ' + stDmy(D.bron.tugash) + ' гача.');
  await brVaraqTayyor();
  const L = await brYangi();
  const id = 'BR-' + bugun.slice(0, 4) + '/' + String(L.reduce((m, z) => Math.max(m, Number(s(z.Bron_ID).split('/')[1]) || 0), 0) + 1).padStart(4, '0');
  const tugash = kunQosh(bugun, BR_KUN);
  const qator = await G.qatorQoshR(env.aksBazaId, BR_VARAQ, L.reduce((m, z) => Math.max(m, z.qator), 1) + 1,
    [id, dokon, fish, '+998' + tel.slice(-9), '', '', 'Faol', 0, '', izoh, u.fish, ''], env.googleKey);
  await G.sanaYoz(env.aksBazaId, [{ varaq: BR_VARAQ, qator, ustun: 5, iso: bugun, naqsh: 'dd.MM.yyyy' },
    { varaq: BR_VARAQ, qator, ustun: 6, iso: tugash, naqsh: 'dd.MM.yyyy' },
    { varaq: BR_VARAQ, qator, ustun: 12, iso: hozirIso(), naqsh: 'auto' }], env.googleKey);
  await yangila([BR_VARAQ]);
  return { ok: true, id, tugash, kun: BR_KUN, dokon: D.id, maydon: D.maydon };
}

// amal: 'uzaytir' | 'shartnoma' | 'bekor'
async function sotuvBronAmal(args) {
  const [kodSes, id0, amal0, izoh0] = args;
  const u = await S.ruxsat(kodSes, 'tashrif');
  if (u.sifat) throw new S.Xato('👁 Ko\'rish rejimida bajarilmaydi.');
  const id = s(id0).trim(), amal = s(amal0).trim(), izoh = s(izoh0).replace(/\s+/g, ' ').trim();
  if (['uzaytir', 'shartnoma', 'bekor'].indexOf(amal) < 0) throw new S.Xato('Амал нотўғри.');
  if (!(await serverda())) throw new S.Xato('Сотув бўлимига ёзиш ҳозир ўчиқ. Директорга айтинг.');
  const bugun = V.bugun();
  const L = await brYangi();
  const z = L.find(x => s(x.Bron_ID).trim() === id); if (!z) throw new S.Xato('Брон топилмади.');
  if (s(z.Holati).trim() !== 'Faol') throw new S.Xato('Бу брон аллақачон ёпилган: ' + s(z.Holati));
  if (!u.admin && s(z.Kim).trim() && !require('../lib/xodim').xodimTeng(s(z.Kim), u.fish)) throw new S.Xato('Бу брон сизники эмас.');
  const uz = Number(z.Uzaytirildi) || 0;
  if (amal === 'uzaytir') {
    if (!u.admin && uz >= BR_UZ_MAX) throw new S.Xato('Брон бир марта узайтирилган. Яна узайтириш — фақат директор рухсати билан.');
    if (izoh.length < 5) throw new S.Xato('Узайтириш сабабини ёзинг.');
    const yangiTugash = kunQosh(stIso(z.Tugash_sana) >= bugun ? stIso(z.Tugash_sana) : bugun, BR_UZAYTIR);
    await G.yoz(env.aksBazaId, [{ varaq: BR_VARAQ, katak: 'H' + z.qator, qiymat: [[uz + 1, izoh]] }], env.googleKey);
    await G.sanaYoz(env.aksBazaId, [{ varaq: BR_VARAQ, qator: z.qator, ustun: 6, iso: yangiTugash, naqsh: 'dd.MM.yyyy' },
      { varaq: BR_VARAQ, qator: z.qator, ustun: 12, iso: hozirIso(), naqsh: 'auto' }], env.googleKey);
    await yangila([BR_VARAQ]);
    return { ok: true, tugash: yangiTugash };
  }
  const holat = amal === 'shartnoma' ? 'Shartnoma' : 'Bekor';
  if (amal === 'bekor' && izoh.length < 3) throw new S.Xato('Бекор қилиш сабабини ёзинг.');
  await G.yoz(env.aksBazaId, [{ varaq: BR_VARAQ, katak: 'G' + z.qator, qiymat: [[holat]] },
    { varaq: BR_VARAQ, katak: 'M' + z.qator, qiymat: [[izoh + (izoh ? ' · ' : '') + u.fish]] }], env.googleKey);
  await G.sanaYoz(env.aksBazaId, [{ varaq: BR_VARAQ, qator: z.qator, ustun: 12, iso: hozirIso(), naqsh: 'auto' }], env.googleKey);
  await yangila([BR_VARAQ]);
  return { ok: true, holati: holat };
}

module.exports = { sotuvBoshlang, sotuvNatija, sotuvBron, sotuvBronAmal };
module.exports._ichki = { tashrifRoyxat, natijaKozgu, bronRoyxat, dokonHolat, ST_VARAQ, ST_S, BR_VARAQ, BR_S, BR_KUN, BR_OGOH_KUN,
  ST_NATIJA, ST_SABAB, ST_MAQSAD, ST_KUN, ST_BOSH, stXodim, natNomi, natYopiq, stDmy };
