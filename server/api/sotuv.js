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
const { xHolat } = require('../lib/dokon');

const ST_VARAQ = '01c_Tashrif_natija';
const ST_S = ['Tashrif_ID', 'Natija', 'Sabab', 'Keyingi_qadam', 'Qadam_sana', 'Izoh', 'Kim', 'Vaqt'];
// 🔒 BRON (19.11.2026, direktor qarori). Xaritadagi «Брон» — bu bron emas, shartnomaning «Шартнома олмаган» holati.
// Haqiqiy bron shu yerda: do'kon 3 kunga band qilinadi, muddat tugasa o'zi bo'shaydi va sotuvchiga topshiriq tushadi.
const BR_VARAQ = '01d_Bronlar';
const dkSon = v => { const n = parseInt(String(v == null ? '' : v).replace(/\D/g, ''), 10); return isNaN(n) ? 0 : n; };   // 28.11.2026: bo'lingan do'kon «2A» → 2
const BR_S = ['Bron_ID', 'Dokon_ID', 'Mijoz_FISH', 'Telefon', 'Bron_sana', 'Tugash_sana', 'Holati', 'Uzaytirildi', 'Uzaytirish_sababi', 'Izoh', 'Kim', 'Vaqt', 'Yakun_izoh'];
const BR_KUN = 3;          // bron muddati
const BR_UZAYTIR = 3;      // uzaytirilganda qo'shiladigan kun
const BR_UZ_MAX = 1;       // xodim necha marta uzaytira oladi (keyingisi — direktor)
const BR_OGOH_KUN = 1;     // tugashiga shuncha kun qolganda ogohlantiriladi
// 📊 19.11.2026 (direktor qarori) — oylik reja. Direktor ko'rsatkichni ilovada o'zi qo'yadi,
// kodda yozilmaydi: har oy o'zgarishi mumkin. Xodim satri bo'sh bo'lsa — butun bo'lim rejasi.
const NR = require('../lib/narx');          // 🏬 narx: rasmiy prays-list jadvali, aks holda formula
const TKP = require('../lib/taklif_pdf');   // 📄 taklif varag'i (A4 PDF)
const NARX = NR.NARX;

const RJ_VARAQ = '01e_Reja';
const RJ_S = ['Oy', 'Xodim', 'Tashrif_reja', 'Taklif_reja', 'Shartnoma_reja', 'Kim', 'Vaqt'];
// 📄 19.11.2026 — chiqarilgan takliflar jurnali: kimga, qachon, qaysi do'kon, qaysi narxda
const TK_VARAQ = '01f_Takliflar';
const TK_S = ['Taklif_ID', 'Sana', 'Dokon_ID', 'Mijoz_FISH', 'Telefon', 'Maydon', 'Baza_narx', 'Naqd_qiymat', 'Boshlangichsiz_qiymat', 'Izoh', 'Kim', 'Vaqt'];

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
// 📊 19.11.2026 (direktor qarori): sotuv bo'limi boshlig'i (ROP) — butun bo'lim ko'rinadi va oylik rejani
// u ham qo'yadi. Direktor ham shu huquqqa ega. Bron muddatini ikkinchi marta uzaytirish va raisga ajratilgan
// do'konni bronlash FAQAT direktorda qoladi — u yerda u.admin tekshiriladi.
const boshliq = u => !!(u.admin || (u.huquq || []).indexOf('sotuv_boshliq') >= 0);
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
    // 28.11.2026 (Zaynab): shartnoma saqlanganda tizim o'zi yozgan tashrif (izohi «Шартнома 27/368», «… (қайта тузиш)») — natijasi
    // o'zi «Shartnoma tuzildi», yopiq. Avval «Natija yo'q» bo'lib «Ishlanishi kerak» ro'yxatida osilib turardi, xodim nima yozishni bilmasdi.
    const avto = !n && /^Шартнома\s+(IJ-)?\d+\/\d+/i.test(s(x[7]).trim());
    L.push({ id, sana, fish: s(x[2]), tel: s(x[3]), manzil: s(x[4]), maqsad, izoh: s(x[7]), kim: s(x[8]),
      turi: s(x[16]).trim() === 'Telefon' ? 'Telefon' : 'Tashrif',
      natija: n ? s(n.Natija) : (avto ? 'shartnoma' : ''), natijaNomi: n ? natNomi(n.Natija) : (avto ? natNomi('shartnoma') : ''), sabab: n ? s(n.Sabab) : '',
      qadam: n ? s(n.Keyingi_qadam) : '', qadamSana: n ? stIso(n.Qadam_sana) : '', natIzoh: n ? s(n.Izoh) : (avto ? 'тизим: шартнома сақланганда ёзилди' : ''),
      natKim: n ? s(n.Kim) : '', natVaqt: n ? s(n.Vaqt) : '',
      yopiq: n ? natYopiq(n.Natija) : avto });
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
// 🧾 19.11.2026 (direktor qarori) — SABABLAR HISOBOTI: qaysi sababdan qancha mijoz yo'qolgan.
// Manbai 01c_Tashrif_natija: «Qiziqmadi» natijasi va uning sababi, hamda «Raqam noto'g'ri».
// Yo'qolgan deb faqat YOPILGAN ishlar sanaladi. Natija umuman yozilmagan va «Bog'lanib bo'lmadi»
// — bular hali yo'qotish emas, XAVF ostidagilar: alohida ko'rsatiladi, chunki aynan shular jim yo'qoladi.
function sababHisob(L) {
  const S = {}, oyM = {}, XD = {};
  let jami = 0, shartnoma = 0, yoq = 0, natijasiz = 0, aloqa = 0, jarayon = 0;
  L.forEach(z => {
    jami++;
    const m = s(z.sana).slice(0, 7);
    const o = oyM[m] || (oyM[m] = { oy: m, jami: 0, natijali: 0, taklif: 0, shartnoma: 0, yoqolgan: 0 });
    o.jami++; if (s(z.natija)) o.natijali++;
    if (s(z.natija) === 'taklif' || s(z.natija) === 'shartnoma') o.taklif++;   // таклиф босқичигача етганлар
    const kim = s(z.natKim) || s(z.kim) || '—';
    const qo = s(z.natija) === 'qiziqmadi', nt = s(z.natija) === 'notogri';
    if (s(z.natija) === 'shartnoma') { shartnoma++; o.shartnoma++; return; }
    if (qo || nt) {
      const k = nt ? 'Рақам нотўғри' : (s(z.sabab).trim() || 'Сабаб ёзилмаган');
      S[k] = (S[k] || 0) + 1; yoq++; o.yoqolgan++;
      const x = XD[kim] || (XD[kim] = { xodim: kim, yoqolgan: 0, sabablar: {} });
      x.yoqolgan++; x.sabablar[k] = (x.sabablar[k] || 0) + 1;
      return;
    }
    if (!s(z.natija)) natijasiz++; else if (s(z.natija) === 'aloqa') aloqa++; else jarayon++;
  });
  const royxat = Object.keys(S).map(k => ({ sabab: k, soni: S[k], ulush: yoq ? Math.round(S[k] / yoq * 1000) / 10 : 0 }))
    .sort((a2, b2) => b2.soni - a2.soni);
  const oylar = Object.values(oyM).sort((a2, b2) => a2.oy < b2.oy ? 1 : -1).slice(0, 12).reverse();
  return { jami, natijali: jami - natijasiz, shartnoma, yoqolgan: yoq, natijasiz, aloqa, jarayon, royxat, oylar,
    xodimlar: Object.values(XD).sort((a2, b2) => b2.yoqolgan - a2.yoqolgan)
      .map(x => ({ xodim: x.xodim, yoqolgan: x.yoqolgan,
        eng: Object.keys(x.sabablar).sort((p, q) => x.sabablar[q] - x.sabablar[p])[0] || '' })) };
}

async function sotuvBoshlang([kodSes]) {
  const u = await S.ruxsat(kodSes, 'tashrif');
  const bugun = V.bugun();
  const L = await tashrifRoyxat(bugun);
  const bosh = boshliq(u);
  const meniki = z => bosh || xodimTeng(z.kim, u.fish) || xodimTeng(z.natKim, u.fish);
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
  try { bron = (await bronRoyxat(bugun)).filter(z => bosh || !z.kim || xodimTeng(z.kim, u.fish))
    .sort((a, b) => (a.holati === 'Faol' ? 0 : 1) - (b.holati === 'Faol' ? 0 : 1) || (a.qoldi == null ? 99 : a.qoldi) - (b.qoldi == null ? 99 : b.qoldi)); }
  catch (e) { console.error('sotuvBron:', e.message); }
  let reja = [], shOy = [], shXodim = [], dokonlar = [], takliflar = [];
  try { takliflar = await taklifRoyxat(); } catch (e) { console.error('taklifRoyxat:', e.message); }
  try { dokonlar = await bosDokonlar(bugun); } catch (e) { console.error('bosDokonlar:', e.message); }
  try { reja = await rejaRoyxat(); } catch (e) { console.error('sotuvReja:', e.message); }
  try { const SH = await shartnomaOylar(bugun.slice(0, 7)); shOy = SH.oylar; shXodim = SH.xodim; } catch (e) { console.error('shartnomaOylar:', e.message); }
  // режа қўйиш учун сотувчилар рўйхати (директорга) — ташриф ёзадиган ходимлар
  const XR = [...new Set(L.map(z => stXodim(z.kim)).filter(Boolean))].sort();
  son.bronFaol = bron.filter(z => z.holati === 'Faol').length;
  son.bronOtdi = bron.filter(z => z.holati === 'Muddati o\'tdi').length;
  return { ishlar: M.slice(0, ST_ROYXAT), son, bron, bronKun: BR_KUN, bugun, bosh: ST_BOSH, admin: bosh, dir: u.admin, mening: u.fish,
    svod: bosh ? Object.values(svod).sort((a, b) => b.shartnoma - a.shartnoma || b.tashrif - a.tashrif) : [],
    natijalar: ST_NATIJA.map(x => ({ kalit: x[0], nomi: x[1], yopiq: x[2] })), sabablar: ST_SABAB,
    sababHis: sababHisob(bosh ? L : M), reja, shOy, shXodim: bosh ? shXodim : [], dokonlar, narx: NARX, takliflar: takliflar.slice(0, 200), xodimlar: bosh ? XR : [] };
}

// ------------------------------------------------------------------ 🏬 DO'KON KARTASI (23.11.2026, direktor: «bir ekranda hammasi, qayta tiqmasin»)
// Bitta chaqiruvda do'kon kartasiga kerak bo'lgan HAMMA narsa: holati, 4 ta rasmiy tarif, ogohlantirishlar,
// oldingi/keyingi do'kon (‹ › bilan varaqlash) va blok bir qavatlimi (bir qavatli blokda «1-qavat» yozilmaydi).
// Narx manbai — lib/narx.js (ilova ham, taklif PDF ham shundan oladi), ikkinchi hisob yo'q.
async function sotuvKarta(args) {
  const [kodSes, dokon0] = args;
  const u = await S.ruxsat(kodSes);
  if (!(u.admin || (u.huquq || []).some(h => h === 'tashrif' || h === 'xarita' || h === 'xarita_moliya' || h === 'shartnoma')))
    throw new S.Xato('Do\'kon kartasiga ruxsatingiz yo\'q. Direktorga murojaat qiling.');
  const dokon = s(dokon0).trim().toUpperCase();
  if (!dokon) throw new S.Xato('Do\'kon tanlanmagan.');
  const bugun = V.bugun();
  const D = await dokonHolat(dokon, bugun);
  if (!D.bor) throw new S.Xato('Bunday do\'kon topilmadi: ' + dokon);
  // qo'shnilar va blok qavatlari — 01_Dokonlar tartibida
  // ‹ › — blok ichida tartib bilan yuradi (H-1-2 → H-1-3), boshqa blokka sakramaydi
  const R = (await V.qatorlar('01_Dokonlar')).filter(V.dokonMi)
    .sort((a, b) => s(a.x[2]).localeCompare(s(b.x[2])) || (Number(a.x[3]) || 0) - (Number(b.x[3]) || 0) || dkSon(a.x[4]) - dkSon(b.x[4]) || s(a.x[4]).localeCompare(s(b.x[4])));   // 28.11: «2A»/«2B» — raqam, keyin harf
  const I = R.findIndex(({ x }) => s(x[0]).trim().toUpperCase() === dokon);
  const qav = {}; R.forEach(({ x }) => { if (s(x[2]).trim().toUpperCase() === D.blok.trim().toUpperCase()) qav[s(x[3]).trim()] = 1; });
  const ogoh = [];
  if (D.taqiq) ogoh.push('⛔ Do\'kon TAQIQDA — sotish uchun direktor ruxsati kerak.');
  if (D.rais) ogoh.push('👤 Raisga ajratilgan.');
  if (D.egasi) ogoh.push('🔴 Sotilgan: ' + D.egasi);
  if (D.ijarada) ogoh.push('🔵 Ijarada.');
  if (D.mamuriyat) ogoh.push('⬛ Ma\'muriyat do\'koni.');
  if (D.bron) ogoh.push('🔒 Bronda: ' + D.bron.fish + ' (' + D.bron.tugash + ' gacha).');
  if (D.qurilish && D.qurilish !== 'Тугалланган') ogoh.push('🚧 Qurilish: ' + D.qurilish);
  if (D.bazaSabab) {
    const xom = D.bazaXom.toLocaleString('ru-RU').replace(/,/g, ' '), yan = D.baza.toLocaleString('ru-RU').replace(/,/g, ' ');
    ogoh.push(D.bazaSabab === 'past'
      ? '\u26a0 Bazada 1 m\u00b2 ' + xom + ' deb turibdi \u2014 eng past rasmiy narxdan past. Hisobga ' + yan + ' olindi, 01_Dokonlar tuzatilishi kerak.'
      : '\u26a0 Bazada 1 m\u00b2 ' + xom + ' deb turibdi \u2014 bu narx emas, eski hisob qoldig\'i. Hisobga ' + yan + ' olindi, 01_Dokonlar tuzatilishi kerak.');
  }
  if (!D.maydon || !D.baza) ogoh.push('⚠ Maydoni yoki baza narxi bazada yo\'q — narx hisoblanmaydi.');
  const h = (D.maydon && D.baza) ? NR.hisobla(D.baza, D.maydon) : null;
  const t = (k, nom, sovga) => ({ k, nom, m2: h[k].m2, jami: h[k].jami, oylik: Math.round(h[k].oylik), boshlangich: h[k].boshlangich, tejash: Math.round(h[k].tejash), sovga });
  return { ok: true, bugun,
    d: { id: D.id, blok: D.blok, qavat: D.qavat, no: D.no, maydon: D.maydon, baza: D.baza, qurilish: D.qurilish,
         holat: D.xHolat, egasi: D.egasi, taqiq: D.taqiq, rais: D.rais, ijarada: D.ijarada, izoh: D.izoh, bron: D.bron,
         birQavat: Object.keys(qav).length <= 1, bosh: !D.egasi && !D.ijarada && !D.mamuriyat && !D.bron },
    narx: h ? { rasmiy: h.tasdiq, oy: NR.NARX.oy, tarif: [
        t('naqd', '100% naqd', NR.NARX.sovga.naqd), t('120', '120 mln boshlang\'ich', NR.NARX.sovga['120']),
        t('60', '60 mln boshlang\'ich', NR.NARX.sovga['60']), t('yoq', 'Boshlang\'ichsiz', NR.NARX.sovga['0'])] } : null,
    qoshni: { oldingi: I > 0 ? s(R[I - 1].x[0]).trim() : '', keyingi: (I >= 0 && I < R.length - 1) ? s(R[I + 1].x[0]).trim() : '', o: I + 1, jami: R.length },
    ogoh };
}
// Ixtiyoriy boshlang'ich to'lov uchun narx (hisoblagich «Hisoblash» tugmasi) — ekstrapolyatsiya bo'lsa aytiladi
async function sotuvNarx(args) {
  const [kodSes, dokon0, boshl0, oy0] = args;
  // 24.11.2026: hisoblagich ham do'kon kartasi bilan bir xil huquq so'raydi (avval faqat «tizimga kirganmi» tekshirilardi).
  const u = await S.ruxsat(kodSes);
  if (!(u.admin || (u.huquq || []).some(h => h === 'tashrif' || h === 'xarita' || h === 'xarita_moliya' || h === 'shartnoma')))
    throw new S.Xato('Narx hisoblashga ruxsatingiz yo\'q. Direktorga murojaat qiling.');
  const dokon = s(dokon0).trim().toUpperCase();
  const D = await dokonHolat(dokon, V.bugun());
  if (!D.bor) throw new S.Xato('Bunday do\'kon topilmadi: ' + dokon);
  if (!D.maydon || !D.baza) throw new S.Xato('Bu do\'konning maydoni yoki baza narxi bazada yo\'q.');
  const boshl = Math.max(0, Math.round(Number(boshl0) || 0)), oy = Math.max(0, Math.round(Number(oy0) || NR.NARX.oy));
  const r = NR.narxHisob(D.baza, boshl, oy);
  const jami = r.narx * D.maydon;
  if (jami < boshl) throw new S.Xato('Boshlang\'ich to\'lov do\'kon qiymatidan katta bo\'lolmaydi.');
  return { ok: true, m2: r.narx, jami, boshlangich: boshl, oy, oylik: oy > 0 ? Math.round((jami - boshl) / oy) : 0,
    manba: r.manba, ekstra: /ekstrapol/i.test(r.manba) };
}

// ------------------------------------------------------------------ 📋 PRAYS (24.11.2026, direktor: «blok-blok jadval ko'rinishida»)
// Bo'sh do'konlarning hammasi blok-blok, to'rtta rasmiy shart bo'yicha hisoblangan holda bir marta beriladi.
// Shartni almashtirganda qayta so'ralmaydi — hisob ilovada darhol ko'rinadi.
async function sotuvPrays(args) {
  // args[1] (ixtiyoriy): { boshl, oy } — direktor/sotuvchi qo'lda yozgan shart. Shunda har do'konga
  // 5-tarif qo'shiladi (t[4]) va «maxsus» qaytadi. 24.11.2026 direktor qarori: muddat ham narxga ta'sir qiladi.
  const [kodSes, shart0] = args;
  const u = await S.ruxsat(kodSes);
  if (!(u.admin || (u.huquq || []).some(h => h === 'tashrif' || h === 'xarita' || h === 'xarita_moliya' || h === 'shartnoma')))
    throw new S.Xato('Prays ro\'yxatiga ruxsatingiz yo\'q. Direktorga murojaat qiling.');
  const bugun = V.bugun();
  const R = (await V.qatorlar('01_Dokonlar')).filter(V.dokonMi);
  const BR = {};
  (await bronRoyxat(bugun)).forEach(b => { if (b.holati === 'Faol') BR[s(b.dokon).trim().toUpperCase()] = 1; });
  const Q = shart0 && typeof shart0 === 'object' ? shart0 : null;
  const mxBoshl = Q ? Math.max(0, Math.round(Number(Q.boshl) || 0)) : 0;
  const mxOy = Q ? Math.max(1, Math.min(NR.NARX.oy, Math.round(Number(Q.oy) || NR.NARX.oy))) : 0;
  const maxsus = Q ? { boshl: mxBoshl, oy: mxOy,
    rasmiy: (mxOy === NR.NARX.oy && NR.NARX.shartlar.indexOf(mxBoshl) >= 0) } : null;
  const M = {}; let jami = 0, ekstraSoni = 0, taqiqSoni = 0, raisSoni = 0;
  for (const { x } of R) {
    const id = s(x[0]).trim();
    if (s(x[17]).trim()) continue;                                  // sotilgan
    const ij = s(x[21]).trim();
    if (ij && !/^IJ-YOQ/i.test(ij)) continue;                       // ijarada
    // 28.11.2026 (direktor): taqiqdagi do'kon ham praysda chiqadi — narxi ko'rinib tursin, ⛔ belgi bilan; sotish esa faqat direktor ruxsati bilan (taqiq_ruxsat)
    const taqiq = s(x[8]).trim() === 'Ha';
    const rais = s(x[11]).trim() === 'Ha';                          // 28.11.2026 (direktor): raisga ajratilgan ham sotiladi — praysda 👤 belgi bilan chiqadi
    const izoh = s(x[14]).trim();                                   // 28.11.2026: O ustuni belgisi (masalan «ҲОЖАТХОНА») — praysda ko'rinadi
    if (BR[id.toUpperCase()]) continue;                             // bronda
    const maydon = Number(x[5]) || 0;
    let baza = Number(x[6]) || 0;
    baza = NR.bazaTuzat(baza, false).baza;   // 23-24.11.2026: eng past narx + tiyinli raqamni tozalash
    if (!maydon || !baza) continue;
    const blok = s(x[2]).trim(), qavat = s(x[3]).trim();
    const H = NR.hisobla(baza, maydon);
    const t = [H.naqd, H['120'], H['60'], H.yoq].map(z => ({ m2: Math.round(z.m2), jami: Math.round(z.jami), oylik: Math.round(z.oylik) }));
    if (maxsus) {                                   // 5-tarif — qo'lda yozilgan shart
      const m2 = NR.m2NarxOy(baza, mxBoshl, mxOy), jm = Math.round(m2 * maydon);
      t.push(mxBoshl >= jm ? { m2, jami: jm, oylik: 0, toliq: true }
                           : { m2, jami: jm, oylik: Math.round((jm - mxBoshl) / mxOy) });
    }
    const ekstra = !NR.tasdiqlangan(baza);   // 28.11.2026: direktor tasdiqlagan narx ham ogohlantirmaydi
    if (ekstra) ekstraSoni++; if (taqiq) taqiqSoni++; if (rais) raisSoni++;
    const K = blok + (Number(qavat) === 2 ? ' \u00b7 2-qavat' : '');   // 24.11: Qavat bazada raqam (2), matn emas
    if (!M[K]) M[K] = { blok: K, soni: 0, maydonMin: 0, maydonMax: 0, bazalar: [], dokonlar: [] };
    const B = M[K];
    B.soni++; jami++;
    if (!B.maydonMin || maydon < B.maydonMin) B.maydonMin = maydon;
    if (maydon > B.maydonMax) B.maydonMax = maydon;
    if (B.bazalar.indexOf(baza) < 0) B.bazalar.push(baza);
    B.dokonlar.push({ id, no: s(x[4]).trim(), maydon, baza, ekstra, taqiq, rais, izoh, t });
  }
  const bloklar = Object.keys(M).sort((a, b) => a.length - b.length || a.localeCompare(b)).map(k => {
    const B = M[k];
    B.dokonlar.sort((p, q) => (Number(p.no) || 0) - (Number(q.no) || 0) || p.no.localeCompare(q.no));
    B.bazalar.sort((p, q) => p - q);
    return B;
  });
  return { ok: true, sana: bugun, jami, ekstraSoni, taqiqSoni, raisSoni, oy: NR.NARX.oy, maxsus, bloklar };
}

// ------------------------------------------------------------------ 💰 MIJOZNING PULIGA QARAB TANLASH (23.11.2026)
// Sotuvchi mijozdan ikki raqamni so'raydi: qo'lida nechcha pul bor va oyiga qanchagacha to'lay oladi.
// Tizim BO'SH do'konlarning hammasini shu shart bo'yicha hisoblab, yaraydiganlarini chiqaradi.
// «Qaysi do'kon bor?» deb butun xaritani kezish o'rniga — mijozga mos ro'yxat darhol ko'rinadi.
async function sotuvTanlov(args) {
  const [kodSes, d0] = args; const d = d0 || {};
  const u = await S.ruxsat(kodSes);
  if (!(u.admin || (u.huquq || []).some(h => h === 'tashrif' || h === 'xarita' || h === 'xarita_moliya' || h === 'shartnoma')))
    throw new S.Xato('Ruxsatingiz yo\'q.');
  const boshl = Math.max(0, Math.round(Number(d.boshlangich) || 0));
  const oylikMax = Math.max(0, Math.round(Number(d.oylik) || 0));
  const oy = Math.max(1, Math.round(Number(d.oy) || NR.NARX.oy));
  const blok = s(d.blok).trim().toUpperCase();
  const mMin = Number(d.maydonMin) || 0, mMax = Number(d.maydonMax) || 0;
  if (!oylikMax && !boshl) throw new S.Xato('Mijoz qo\'lidagi pulni yoki oylik to\'lov imkonini yozing.');
  const bugun = V.bugun();
  const R = (await V.qatorlar('01_Dokonlar')).filter(V.dokonMi);
  const BR = {};   // faol bronlar — ular ham band hisoblanadi
  (await bronRoyxat(bugun)).forEach(b => { if (b.holati === 'Faol') BR[s(b.dokon).trim().toUpperCase()] = 1; });
  const L = [];
  for (const { x } of R) {
    const id = s(x[0]).trim();
    if (s(x[17]).trim()) continue;                                  // sotilgan (sotuv shartnomasi bor)
    const ij = s(x[21]).trim();
    if (ij && !/^IJ-YOQ/i.test(ij)) continue;                       // ijarada (IJ-YOQ-… = ijara yo'q degani)
    const taqiq = s(x[8]).trim() === 'Ha';                          // 28.11: taqiqdagi ham chiqadi (⛔ belgi), sotish — direktor ruxsati bilan
    const rais = s(x[11]).trim() === 'Ha';                          // 28.11 (direktor): raisga ajratilgan ham sotiladi — 👤 belgi bilan
    const izoh = s(x[14]).trim();
    if (BR[id.toUpperCase()]) continue;
    const maydon = Number(x[5]) || 0;
    let baza = Number(x[6]) || 0;
    baza = NR.bazaTuzat(baza, false).baza;   // 23-24.11.2026: eng past narx + tiyinli raqamni tozalash
    if (!maydon || !baza) continue;
    if (blok && s(x[2]).trim().toUpperCase() !== blok) continue;
    if (mMin && maydon < mMin) continue;
    if (mMax && maydon > mMax) continue;
    const r = NR.narxHisob(baza, boshl, oy);
    const jami = r.narx * maydon;
    if (jami <= boshl) { L.push({ id, blok: s(x[2]).trim(), no: s(x[4]).trim(), maydon, jami, oylik: 0, naqd: true, ekstra: /ekstrapol/i.test(r.manba), taqiq, rais, izoh }); continue; }
    const oylik = Math.round((jami - boshl) / oy);
    if (oylikMax && oylik > oylikMax) continue;
    L.push({ id, blok: s(x[2]).trim(), no: s(x[4]).trim(), maydon, jami, oylik, naqd: false, ekstra: /ekstrapol/i.test(r.manba), taqiq, rais, izoh });
  }
  L.sort((a, b) => b.maydon - a.maydon || a.oylik - b.oylik);
  const bloklar = [...new Set(L.map(z => z.blok))].sort();
  return { ok: true, jami: L.length, boshlangich: boshl, oylik: oylikMax, oy, bloklar, royxat: L.slice(0, 60) };
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
  if (!boshliq(u) && !xodimTeng(s(T.x[8]), u.fish)) throw new S.Xato('Бу ташриф сизники эмас.');
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
  // 01_Dokonlar: H(7) Qurilish, I(8) Taqiq, L(11) Rais, S(18) Egasi. Xarita holati lib/dokon.js da hisoblanadi
  // (Bo'sh / Bo'sh+ijara / Sotilgan / Sotilgan+ijara / Ma'muriyat / Bron) — xarita va bosh ekran bilan bitta manba.
  const egasi = s(x[18]).trim(), taqiq = /^ha$/i.test(s(x[8]).trim()), rais = /^ha$/i.test(s(x[11]).trim());
  const izoh = s(x[14]).trim();   // 28.11.2026 (direktor): O ustuni — «ҲОЖАТХОНА» kabi belgi; xarita, prays va kartada ko'rinadi
  const qur = s(x[7]).trim();
  const B = (await bronRoyxat(bugun)).find(z => z.dokon.toLowerCase() === s(dokonId).trim().toLowerCase() && z.holati === 'Faol');
  const xh = xHolat(x, !!B);
  // 23.11.2026 direktor qarori: sotilmagan do'konda baza eng past rasmiy narxdan (10 530 000) past bo'lmaydi.
  // Bazadagi raqam past bo'lsa — hisobga eng past rasmiy narx olinadi, kartada ogohlantirish chiqadi, 01_Dokonlar tuzatilishi kerak.
  const bazaXom = Number(x[6]) || 0, sotilganmi = !!(egasi && egasi.toUpperCase() !== 'SOTILMAGAN');
  const BZ = NR.bazaTuzat(bazaXom, sotilganmi);
  return { bor: true, id: s(x[0]).trim(), blok: s(x[2]), qavat: s(x[3]), no: s(x[4]), maydon: Number(x[5]) || 0,
    baza: BZ.baza, bazaXom, bazaSabab: BZ.sabab, bazaKotarildi: BZ.sabab === 'past', qurilish: qur,
    egasi: egasi && egasi.toUpperCase() !== 'SOTILMAGAN' ? egasi : '', xHolat: xh,
    ijarada: /ijara/i.test(xh), mamuriyat: /ma.?muriyat/i.test(xh), taqiq, rais, izoh, bron: B || null };
}

// 🏬 Sotuvga bo'sh do'konlar ro'yxati: xHolat — «Bo'sh» (sotilmagan, ijarasiz, ma'muriy emas, broni yo'q).
// Taqiqdagi va raisga ajratilganlar ham chiqadi, lekin belgisi bilan — ularni bronlashda ruxsat so'raladi.
async function bosDokonlar(bugun) {
  const [R1, B] = await Promise.all([V.qatorlar('01_Dokonlar'), bronRoyxat(bugun).catch(() => [])]);
  const br = {}; B.forEach(z => { if (z.holati === 'Faol' && z.dokon) br[z.dokon.trim().toUpperCase()] = 1; });
  const L = [];
  R1.forEach(({ n, x }) => {
    if (n > V.DOKON_OXIRI || !s(x[0]).trim()) return;
    const h = xHolat(x, !!br[s(x[0]).trim().toUpperCase()]);
    if (h !== 'Bo\'sh') return;
    L.push({ id: s(x[0]).trim(), blok: s(x[2]), qavat: s(x[3]), no: s(x[4]), maydon: Number(x[5]) || 0, baza: Number(x[6]) || 0,
      qurilish: s(x[7]), taqiq: /^ha$/i.test(s(x[8])), rais: /^ha$/i.test(s(x[11])), izoh: s(x[14]).trim() });
  });
  return L;
}

// 📋 19.11.2026 — oyma-oy TUZILGAN SHARTNOMALAR (03_Sotuv_shartnomalar dan, bekor qilinganlarsiz).
// Reja ekranidagi «Shartnoma» FAKTI shu yerdan olinadi, tashrif natijasidan emas: shartnoma tashrif
// jurnalida belgilanmagan bo'lsa ham tuzilgan bo'lishi mumkin — biznes natijasi 03 da turadi.
// 19.11.2026: masʼul sotuvchi — 03 AQ (43-ustun, 0 dan 42). Bo'sh bo'lsa «Kiritdi» (AP) olinadi:
// eski shartnomalarda sotuvchi yozilmagan, ularni hech kimga yozib qo'ymaymiz — «—» bo'lib turadi.
async function shartnomaOylar(bugunOy) {
  const O = {}, X = {};
  try {
    (await V.qatorlar('03_Sotuv_shartnomalar')).forEach(({ x }) => {
      if (!s(x[0]).trim()) return;
      if (/bekor/i.test(s(x[13]))) return;
      const m = stIso(x[2]).slice(0, 7); if (!/^\d{4}-\d{2}$/.test(m)) return;
      O[m] = (O[m] || 0) + 1;
      if (bugunOy && m === bugunOy) { const k = s(x[42]).trim() || '—'; X[k] = (X[k] || 0) + 1; }
    });
  } catch (e) { console.error('shartnomaOylar:', e.message); return { oylar: [], xodim: [] }; }
  return { oylar: Object.keys(O).sort().slice(-24).map(m => ({ oy: m, soni: O[m] })),
    xodim: Object.keys(X).map(k => ({ xodim: k, soni: X[k] })).sort((a, b) => b.soni - a.soni) };
}

// 📊 reja varag'i va ro'yxati
async function rjVaraqTayyor() {
  const m = await G.varaqlar(env.aksBazaId, env.googleKey);
  if (m.varaqlar.some(v => v.title === RJ_VARAQ)) return;
  await G.soralar(env.aksBazaId, [{ addSheet: { properties: { title: RJ_VARAQ,
    gridProperties: { rowCount: 500, columnCount: RJ_S.length, frozenRowCount: 1 } } } }], env.googleKey);
  await G.yoz(env.aksBazaId, [{ varaq: RJ_VARAQ, katak: 'A1', qiymat: [RJ_S] }], env.googleKey);
}
async function rjYangi() {
  try {
    const R = await G.oraliqOqi(env.aksBazaId, RJ_VARAQ, 'A2:G', env.googleKey, 'UNFORMATTED_VALUE');
    let m = -1; R.forEach((r, i) => { if (r[0] !== '' && r[0] != null) m = i; });
    return R.slice(0, m + 1).map((r, i) => { const o = { qator: i + 2 }; RJ_S.forEach((k, j) => { o[k] = r[j] == null ? '' : r[j]; }); return o; });
  } catch (e) { if (/Unable to parse range|not found/i.test(e.message)) return []; throw e; }
}
async function rejaRoyxat() {
  let R = [];
  try { R = (await V.qatorlar(RJ_VARAQ)).map(({ x }) => ({ oy: s(x[0]).trim(), xodim: s(x[1]).trim(),
    tashrif: Number(x[2]) || 0, taklif: Number(x[3]) || 0, shartnoma: Number(x[4]) || 0, kim: s(x[5]), vaqt: s(x[6]) }))
    .filter(z => /^\d{4}-\d{2}$/.test(z.oy)); } catch (e) { return []; }
  return R;
}
// 📊 rejani qo'yish / o'zgartirish — faqat direktor
async function sotuvRejaYoz(args) {
  const [kodSes, oy0, xodim0, tashrif0, taklif0, shartnoma0] = args;
  const u = await S.ruxsat(kodSes, 'tashrif');
  if (u.sifat) throw new S.Xato('👁 Кўриш режимида бажарилмайди.');
  if (!boshliq(u)) throw new S.Xato('Режани директор ёки сотув бўлими бошлиғи қўяди.');
  const oy = s(oy0).trim(), xodim = s(xodim0).trim();
  if (!/^\d{4}-\d{2}$/.test(oy)) throw new S.Xato('Ой нотўғри.');
  const son = v => { const n = Math.round(Number(v) || 0); return n < 0 ? 0 : (n > 9999 ? 9999 : n); };
  const tr = son(tashrif0), tk = son(taklif0), sh = son(shartnoma0);
  if (!tr && !tk && !sh) throw new S.Xato('Камида битта рақам киритинг.');
  if (!(await serverda())) throw new S.Xato('Сотув бўлимига ёзиш ҳозир ўчиқ. Директорга айтинг.');
  await rjVaraqTayyor();
  const L = await rjYangi();
  const bor = L.find(z => s(z.Oy).trim() === oy && s(z.Xodim).trim() === xodim);
  if (bor) {
    await G.yoz(env.aksBazaId, [{ varaq: RJ_VARAQ, katak: 'C' + bor.qator + ':F' + bor.qator, qiymat: [[tr, tk, sh, u.fish]] }], env.googleKey);
    await G.sanaYoz(env.aksBazaId, [{ varaq: RJ_VARAQ, qator: bor.qator, ustun: 7, iso: hozirIso(), naqsh: 'auto' }], env.googleKey);
  } else {
    const qator = await G.qatorQoshR(env.aksBazaId, RJ_VARAQ, L.reduce((m, z) => Math.max(m, z.qator), 1) + 1,
      [oy, xodim, tr, tk, sh, u.fish, ''], env.googleKey);
    await G.sanaYoz(env.aksBazaId, [{ varaq: RJ_VARAQ, qator, ustun: 7, iso: hozirIso(), naqsh: 'auto' }], env.googleKey);
  }
  await yangila([RJ_VARAQ]);
  return { ok: true, oy, xodim, tashrif: tr, taklif: tk, shartnoma: sh };
}

// 📄 takliflar jurnali
async function tkVaraqTayyor() {
  const m = await G.varaqlar(env.aksBazaId, env.googleKey);
  if (m.varaqlar.some(v => v.title === TK_VARAQ)) return;
  await G.soralar(env.aksBazaId, [{ addSheet: { properties: { title: TK_VARAQ,
    gridProperties: { rowCount: 5000, columnCount: TK_S.length, frozenRowCount: 1 } } } }], env.googleKey);
  await G.yoz(env.aksBazaId, [{ varaq: TK_VARAQ, katak: 'A1', qiymat: [TK_S] }], env.googleKey);
}
async function tkYangi() {
  try {
    const R = await G.oraliqOqi(env.aksBazaId, TK_VARAQ, 'A2:L', env.googleKey, 'UNFORMATTED_VALUE');
    let m = -1; R.forEach((r, i) => { if (r[0] !== '' && r[0] != null) m = i; });
    return R.slice(0, m + 1).map((r, i) => { const o = { qator: i + 2 }; TK_S.forEach((k, j) => { o[k] = r[j] == null ? '' : r[j]; }); return o; });
  } catch (e) { if (/Unable to parse range|not found/i.test(e.message)) return []; throw e; }
}
async function taklifRoyxat() {
  let R = [];
  try { R = (await V.qatorlar(TK_VARAQ)).map(({ x }) => ({ id: s(x[0]).trim(), sana: stIso(x[1]), dokon: s(x[2]),
    fish: s(x[3]), tel: s(x[4]), maydon: Number(x[5]) || 0, baza: Number(x[6]) || 0,
    naqd: Number(x[7]) || 0, boshsiz: Number(x[8]) || 0, izoh: s(x[9]), kim: s(x[10]), vaqt: s(x[11]) }))
    .filter(z => z.id); } catch (e) { return []; }
  return R.sort((a, b) => a.sana < b.sana ? 1 : (a.sana > b.sana ? -1 : 0));
}

// 📄 taklifni chiqarish: PDF + jurnalga qator. Ruxsat — «tashrif» (sotuvchi).
async function sotuvTaklif(args) {
  const [kodSes, d0] = args;
  const u = await S.ruxsat(kodSes, 'tashrif');
  if (u.sifat) throw new S.Xato('👁 Кўриш режимида бажарилмайди.');
  const d = d0 || {};
  const dokon = s(d.dokon).trim().toUpperCase();
  const fish = s(d.fish).replace(/\s+/g, ' ').trim();
  const tel = s(d.tel).replace(/\D/g, '');
  const izoh = s(d.izoh).replace(/\s+/g, ' ').trim().slice(0, 300);
  if (!dokon) throw new S.Xato('Дўкон рақамини киритинг.');
  const bugun = V.bugun();
  const D = await dokonHolat(dokon, bugun);
  if (!D.bor) throw new S.Xato('Бундай дўкон топилмади: ' + dokon);
  if (!D.maydon || !D.baza) throw new S.Xato('Бу дўконнинг майдони ёки база нархи базада йўқ.');
  const T = await TKP.taklifYasa({ blok: D.blok, qavat: D.qavat, no: D.no, maydon: D.maydon, baza: D.baza,
    qurilish: D.qurilish, taqiq: D.taqiq, rais: D.rais }, izoh);
  if (D.egasi) T.ogoh.unshift('Дўкон бўш эмас: ' + D.egasi + '.');
  if (D.ijarada) T.ogoh.unshift('Дўкон ижарада.');
  if (D.bron) T.ogoh.unshift('Дўкон бронда: ' + D.bron.fish + ', ' + stDmy(D.bron.tugash) + ' гача.');
  // jurnalga yozish — PDF baribir berilади, yozuv imkoni bo'lmasa faqat ogohlantiriladi
  let id = '', yozildi = false;
  try {
    if (await serverda()) {
      await tkVaraqTayyor();
      const L = await tkYangi();
      id = 'TK-' + bugun.slice(0, 4) + '/' + String(L.reduce((m, z) => Math.max(m, Number(s(z.Taklif_ID).split('/')[1]) || 0), 0) + 1).padStart(4, '0');
      const qator = await G.qatorQoshR(env.aksBazaId, TK_VARAQ, L.reduce((m, z) => Math.max(m, z.qator), 1) + 1,
        [id, '', D.id, fish, tel ? '+998' + tel.slice(-9) : '', D.maydon, D.baza,
         Math.round(T.hisob.naqd.jami), Math.round(T.hisob.yoq.jami), izoh, u.fish, ''], env.googleKey);
      await G.sanaYoz(env.aksBazaId, [{ varaq: TK_VARAQ, qator, ustun: 2, iso: bugun, naqsh: 'dd.MM.yyyy' },
        { varaq: TK_VARAQ, qator, ustun: 12, iso: hozirIso(), naqsh: 'auto' }], env.googleKey);
      await yangila([TK_VARAQ]);
      yozildi = true;
    }
  } catch (e) { console.error('sotuvTaklif (jurnal):', e.message); }
  return { ok: true, id, yozildi, nom: T.nom + '.pdf', mime: 'application/pdf', b64: T.pdf.toString('base64'),
    dokon: D.id, ogoh: T.ogoh, hisob: T.hisob };
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
  // 28.11.2026 (direktor): raisga ajratilgan do'kon ham oddiy sotiladi — bronga to'siq yo'q (faqat belgi). Sotilmaydigani: sotilgan va ijaradagi.
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
  if (!boshliq(u) && s(z.Kim).trim() && !require('../lib/xodim').xodimTeng(s(z.Kim), u.fish)) throw new S.Xato('Бу брон сизники эмас.');
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

// ------------------------------------------------------------------ 🏠 ROLGA QARAB BOSH SAHIFA (19.11.2026, direktor qarori)
// Sotuvchi («sotuvchi» huquqi) va sotuv bo'limi boshlig'i («sotuv_boshliq») ilovani ochganda umumiy xodim sahifasi
// o'rniga o'z ekranini ko'radi. Tartib — Uysot / MacroCRM / Profitbase / Kommo / Salesforce / Pipedrive da bir xil:
//   sotuvchi — avval MUDDATI O'TGAN (qizil), keyin BUGUN, TUGAYOTGAN BRONLAR, oxirida o'z rejasi;
//   boshliq — REJA/FAKT katta raqamlar, shu oy VORONKA, SOTUVCHILAR JADVALI, E'TIBOR ro'yxati, yo'qotish sabablari.
// Bu funksiya hech narsa yozmaydi; xodim_bosh.js chaqiradi (bitta so'rov — bitta ekran). Ekran yarmi bo'sh bo'lsa ham
// blok yashirilmaydi — yashil «hammasi joyida» chiqadi (odam ekranni o'rganib olsin).
const XB_ROY = 8;   // har blokda ko'rinadigan eng ko'p qator (qolgani — «Hammasi →»)
function sotuvBosh(u, bugun, boshliqmi) {
  return (async () => {
    const oy = bugun.slice(0, 7);
    const L = await tashrifRoyxat(bugun);
    let B = []; try { B = await bronRoyxat(bugun); } catch (e) { }
    let R = []; try { R = await rejaRoyxat(); } catch (e) { }
    let SH = { oylar: [], xodim: [] }; try { SH = await shartnomaOylar(oy); } catch (e) { }
    const shOy = (SH.oylar.find(z => z.oy === oy) || {}).soni || 0;
    const kunOy = new Date(+oy.slice(0, 4), +oy.slice(5, 7), 0).getDate();
    const otdi = Math.round(+bugun.slice(8, 10) / kunOy * 100);   // oyning necha foizi o'tdi — reja sur'ati uchun
    // Harakat kerak bo'lgan ish: natijasi yozilmagan (qoida boshlanganidan keyin), qadam muddati o'tgan, qadami yo'q.
    // 19.11 gacha bo'lgan natijasiz tashriflar alohida sanaladi — ular qayta qo'ng'iroq ro'yxatida, «muddati o'tgan» emas.
    const kechikkanMi = z => z.holat === 'kechikdi' || z.holat === 'qadamsiz' || (z.holat === 'natijasiz' && z.sana >= ST_BOSH && z.kechikkan > 0);
    const eskiMi = z => z.holat === 'natijasiz' && z.sana < ST_BOSH;
    const kTartib = z => z.holat === 'natijasiz' ? 0 : z.holat === 'kechikdi' ? 1 : 2;
    const qisqa = z => ({ id: z.id, fish: z.fish, tel: z.tel, sana: z.sana, turi: z.turi, holat: z.holat, kechikkan: z.kechikkan, kim: stXodim(z.kim) || z.kim,
      natija: z.natija, natijaNomi: z.natijaNomi, sabab: z.sabab, qadam: z.qadam, qadamSana: z.qadamSana, natIzoh: z.natIzoh, izoh: z.izoh, manzil: z.manzil });
    const bronQ = b => ({ id: b.id, dokon: b.dokon, fish: b.fish, tel: b.tel, sana: b.sana, tugash: b.tugash, holati: b.holati, qoldi: b.qoldi, ogoh: b.ogoh, kim: b.kim, uzaytirildi: b.uzaytirildi });
    const bronOchiq = b => b.holati === 'Faol' || b.holati === 'Muddati o\'tdi';
    const bronTartib = (a, b) => (a.qoldi == null ? 99 : a.qoldi) - (b.qoldi == null ? 99 : b.qoldi);
    // reja: xodimning o'z satri, bo'lmasa bo'lim satri (xodim bo'sh)
    const rejaTop = fish => { const own = fish ? R.find(z => z.oy === oy && z.xodim && xodimTeng(z.xodim, fish)) : null; const bol = R.find(z => z.oy === oy && !z.xodim) || null;
      return own ? { tashrif: own.tashrif, taklif: own.taklif, shartnoma: own.shartnoma, kimniki: 'mening' } : bol ? { tashrif: bol.tashrif, taklif: bol.taklif, shartnoma: bol.shartnoma, kimniki: 'bolim' } : null; };
    const faktOy = (Z, shSoni) => ({ tashrif: Z.filter(z => z.sana.slice(0, 7) === oy).length,
      taklif: Z.filter(z => z.sana.slice(0, 7) === oy && (z.natija === 'taklif' || z.natija === 'shartnoma')).length, shartnoma: shSoni });

    if (!boshliqmi) {
      const M = L.filter(z => xodimTeng(z.kim, u.fish) || xodimTeng(z.natKim, u.fish));
      const K = M.filter(kechikkanMi).sort((a, b) => kTartib(a) - kTartib(b) || b.kechikkan - a.kechikkan || (a.sana < b.sana ? -1 : 1));
      // bugun qilinadigan: qadami bugunga belgilangan; natijasi hali yozilmagan yangi tashrif (bugungi yoki kechagi — muddati bugun tugaydi)
      const bugungi = M.filter(z => z.holat === 'bugun' || (z.holat === 'natijasiz' && z.sana >= ST_BOSH && !z.kechikkan)).sort((a, b) => (a.holat === 'bugun' ? 0 : 1) - (b.holat === 'bugun' ? 0 : 1) || (a.sana < b.sana ? 1 : -1));
      const BR = B.filter(b => bronOchiq(b) && (!b.kim || xodimTeng(b.kim, u.fish))).sort(bronTartib);
      const shMen = (SH.xodim.find(x => xodimTeng(x.xodim, u.fish)) || {}).soni || 0;
      return { rol: 'sotuvchi', oy, otdi, bosh: ST_BOSH, bronKun: BR_KUN,
        kechikkan: K.slice(0, XB_ROY).map(qisqa), kechikkanSoni: K.length, eskiSoni: M.filter(eskiMi).length,
        bugungi: bugungi.slice(0, XB_ROY).map(qisqa), bugungiSoni: bugungi.length, bugunYozdim: M.filter(z => z.sana === bugun).length,
        bron: BR.slice(0, XB_ROY).map(bronQ), bronSoni: BR.length, bronOtdi: BR.filter(b => b.holati !== 'Faol').length,
        reja: rejaTop(u.fish), fakt: faktOy(M, shMen) };
    }
    // ---- boshliq: butun bo'lim
    const oyL = L.filter(z => z.sana.slice(0, 7) === oy);
    const bronFaol = B.filter(b => b.holati === 'Faol');
    const voronka = { murojaat: oyL.filter(z => z.turi === 'Telefon').length, tashrif: oyL.filter(z => z.turi !== 'Telefon').length,
      taklif: oyL.filter(z => z.natija === 'taklif' || z.natija === 'shartnoma').length, band: bronFaol.length, shartnoma: shOy };
    const X = {};
    const xo = k => { const n = stXodim(k) || '—'; return X[n] || (X[n] = { xodim: n, tashrif: 0, natijali: 0, bron: 0, shartnoma: 0, kechikkan: 0, eski: 0 }); };
    oyL.forEach(z => { const x = xo(z.kim); x.tashrif++; if (z.natija) x.natijali++; });
    L.forEach(z => { if (kechikkanMi(z)) xo(z.kim).kechikkan++; else if (eskiMi(z)) xo(z.kim).eski++; });
    bronFaol.forEach(b => { if (b.kim) xo(b.kim).bron++; });
    SH.xodim.forEach(x => { if (x.xodim !== '—') xo(x.xodim).shartnoma += x.soni; });
    const sotuvchilar = Object.values(X).filter(x => x.xodim !== '—' || x.tashrif || x.kechikkan).sort((a, b) => b.shartnoma - a.shartnoma || b.tashrif - a.tashrif);
    // e'tibor — nima yomon ketyapti
    const E = [];
    B.filter(b => b.holati === 'Muddati o\'tdi').sort(bronTartib).forEach(b => E.push({ rang: 'q', matn: '🔒 Bron muddati o\'tdi: ' + b.dokon + ' · ' + b.fish + (b.kim ? ' · ' + b.kim : '') + ' — shartnoma tuziladi yoki bekor qilinadi', och: { t: 'sotuv', tab: 'bron' } }));
    bronFaol.filter(b => b.ogoh).sort(bronTartib).forEach(b => E.push({ rang: 's', matn: '🔒 Bron ' + (b.qoldi === 0 ? 'bugun' : 'ertaga') + ' tugaydi: ' + b.dokon + ' · ' + b.fish + (b.kim ? ' · ' + b.kim : ''), och: { t: 'sotuv', tab: 'bron' } }));
    sotuvchilar.filter(x => x.kechikkan).forEach(x => E.push({ rang: 'q', matn: '⏰ ' + x.xodim + ' — ' + x.kechikkan + ' ta muddati o\'tgan ish (natija yoki qadam yozilmagan)', och: { t: 'sotuv', tab: 'ish' } }));
    if (!R.some(z => z.oy === oy)) E.push({ rang: 's', matn: '📊 Bu oyga reja qo\'yilmagan — tashrif / taklif / shartnoma rejasini qo\'ying', och: { t: 'sotuv', tab: 'rej' } });
    // imzolangan skani yo'q sotuv shartnomalari (06d da Faol SHARTNOMA skani bo'lmasa)
    try {
      const skanBor = {}; (await V.qatorlar('06d_Hujjatlar')).forEach(({ x }) => { if (x[0] && s(x[5]) === 'SHARTNOMA' && s(x[13]) === 'Faol') skanBor[s(x[1]).trim()] = 1; });
      const SK = [];
      (await V.qatorlar('03_Sotuv_shartnomalar')).forEach(({ x }) => { const no = s(x[0]).trim(); if (!no || /bekor/i.test(s(x[13])) || /QAYTA TUZ/i.test(s(x[19]))) return;
        const sana = stIso(x[2]); if (!sana || sana < '2026-09-29') return; const k = kun(sana, bugun); if (k >= 3 && !skanBor[no]) SK.push({ no, kun: k, fish: s(x[20]).trim().split(/\s+/).slice(0, 2).join(' '), kim: stXodim(x[42]) }); });
      SK.sort((a, b) => b.kun - a.kun);
      if (SK.length) E.push({ rang: SK[0].kun >= 7 ? 'q' : 's', matn: '📎 ' + SK.length + ' ta sotuv shartnomasining imzolangan skani yo\'q (eng eskisi ' + SK[0].no + ' · ' + SK[0].fish + ' — ' + SK[0].kun + ' kun)', och: { t: 'bolim', v: 'hujjat' } });
    } catch (e) { }
    // yo'qotish sabablari — shu oy
    const SB = {}; let yoq = 0;
    oyL.forEach(z => { if (z.natija === 'qiziqmadi' || z.natija === 'notogri') { const k = z.natija === 'notogri' ? 'Рақам нотўғри' : (s(z.sabab).trim() || 'Сабаб ёзилмаган'); SB[k] = (SB[k] || 0) + 1; yoq++; } });
    const sabablar = Object.keys(SB).map(k => ({ sabab: k, soni: SB[k] })).sort((a, b) => b.soni - a.soni);
    return { rol: 'rop', oy, otdi, bosh: ST_BOSH, bronKun: BR_KUN, reja: rejaTop(''), fakt: faktOy(L, shOy), voronka, sotuvchilar,
      etibor: E.slice(0, 10), etiborSoni: E.length, yoqolgan: yoq, sabablar: sabablar.slice(0, 3),
      bron: bronFaol.sort(bronTartib).slice(0, XB_ROY).map(bronQ), bronSoni: bronFaol.length,
      kechikkanSoni: L.filter(kechikkanMi).length, eskiSoni: L.filter(eskiMi).length, oyJami: oyL.length };
  })();
}

module.exports = { sotuvKarta, sotuvNarx, sotuvTanlov, sotuvPrays, sotuvBoshlang, sotuvNatija, sotuvBron, sotuvBronAmal, sotuvRejaYoz, sotuvTaklif };
module.exports._ichki = { tashrifRoyxat, natijaKozgu, bronRoyxat, dokonHolat, rejaRoyxat, sotuvBosh, ST_VARAQ, ST_S, BR_VARAQ, BR_S, BR_KUN, BR_OGOH_KUN, RJ_VARAQ, RJ_S,
  ST_NATIJA, ST_SABAB, ST_MAQSAD, ST_KUN, ST_BOSH, stXodim, natNomi, natYopiq, stDmy };
