// AKS TIZIM — 🏪 OCHILISH NAZORATI (20.11.2026, direktor qarori). Amaliyotda ko'rildi: ijarachi 6 oylik bepul shartnoma tuzadi-da, do'konni
// olmaydi va ochmaydi; eski shartnoma matnida «N kunda qabul qilib olish shart» degan band yo'q edi, shuning uchun do'kon 6 oy uning nomida
// band turardi (sentabrdagi shartnomalar noyabrda ham «Aktiv»). Yangi shablonda (3.2.4 — 5 kun; 6.2 1-holat; 6.3 — ogohlantirishsiz xabarnoma,
// pochtadan 5 kun o'tgach bekor) zanjir qisqa, va uni tizim o'zi yuritadi:
//   0-kun  shartnoma → undiruvchi avtomatik biriktiriladi (eng kam yuklangan), topshiriq: skan (3 kun), 5-kun tekshiruvi
//   2-kun  ijarachiga SMS eslatma (undiruvchi o'z telefonidan, matn tayyor)                            — qoida «ochsms»
//   5-kun  undiruvchi boradi: ✅ Ochilgan (nazorat yopiladi) / ❌ Ochilmagan → SMS + qo'ng'iroq                 — qoida «ochtek»
//   6-kun  hali ochilmagan → xabarnoma (rasmiy blanka, direktor imzosi) → buyurtma xat → kvitansiya skani     — qoida «ochxat»
//   pochta + 5 kun → «✂ Bekor qilish» → 06m «Ochilmagan» so'rovi → direktor ✅ (Telegram bot) → 04 «Bekor qilindi»  — qoida «ochbekor»
// Zanjir FAQAT YANGI MATNDAGI shartnomaga (sana ≥ och_bosh sozlamasi — direktor Google Doc shablonlarini yangilagach belgilaydi).
// Eski matndagilar: undiruvchi + skan + 5-kun tekshiruvi bo'ladi, bekor qilish — 🚫 «Ijarachi kelmadi» (kbKelmadi) yo'li bilan.
// Varaq: 04b_Ochilish_nazorati — birinchi yozuvda yaratiladi (01c/01d kabi). Barcha kataklar matn (sana ham «dd.mm.yyyy» matn — xom/ko'rinish bir xil).
'use strict';
const V = require('./varaq');
const G = require('./google');
const env = require('./env');
const SZ = require('./sozlama');
const { xodimTeng } = require('./xodim');

const OCH_VARAQ = '04b_Ochilish_nazorati';
const OCH_S = ['ID', 'Ijara_№', 'Dokon_ID', 'Ijarachi', 'Undiruvchi', 'Boshlanish_sana', 'Muddat_sana', 'Holati', 'Matn',
  'Eslatma_SMS', 'Tekshiruv_vaqt', 'Tekshiruv_natija', 'SMS2', 'Qongiroq', 'Xabarnoma_№', 'Xabarnoma_sana', 'Xabarnoma_PDF', 'Hujjatdagi_bekor_sana',
  'Pochta_sana', 'Pochta_№', 'Kvitansiya_skan', 'Bekor_mumkin_sana', 'Bekor_sorov', 'Tarix', 'Izoh', 'Yaratildi'];
const U = {}; OCH_S.forEach((k, i) => U[k] = i + 1);   // ustun raqami (1 dan)
const OCH_KUN = 5;            // 3.2.4: bepul davr boshlangan kundan 5 kun ichida qabul qilib olish va ochish shart
const OCH_ESLATMA_KUN = 2;    // 2-kun: SMS eslatma
const OCH_XAT_KUN = 6;        // 6-kun: xabarnoma
const OCH_POCHTA_KUN = 5;     // 6.3: xat pochtaga topshirilgan kundan 5 kun o'tgach topshirilgan hisoblanadi; shartnoma kamida 5 kundan keyin bekor
const OCH_HUJJAT_KUN = 6;     // xabarnomadagi bekor sanasi = xabarnoma sanasi + 6 (1 kun pochtaga topshirishga + 5)
const OCH_BIRIKTIR_BOSH = '';   // 20.11.2026 09:33 direktor qarori: BARCHA «Aktiv» ijara shartnomalariga undiruvchi biriktiriladi (eskilarida ham skan va tekshiruv)
const OCH_YOPIQ = ['Ochildi', 'Bekor qilindi', 'Yopildi'];
const OCH_SMS = {
  eslatma: 'Hurmatli {ism}! ANGOR KARVON SAROY: {no}-ijara shartnomasi bo\'yicha {dokon} do\'konini {muddat} gacha qabul qilib olib, savdoni boshlashingiz shart (3.2.4-band). Kelmasangiz shartnoma bekor qilinadi. Tel: {tel}',
  ochilmagan: 'Hurmatli {ism}! ANGOR KARVON SAROY: {no}-shartnoma bo\'yicha {dokon} do\'koni {muddat} gacha qabul qilinishi kerak edi — do\'kon ochilmagan. Ertaga ham kelmasangiz shartnoma bir tomonlama bekor qilinadi (6.2-band). Tel: {tel}' };

const s = v => String(v == null ? '' : v);
const T = v => s(v).trim();
const harf = n => { let r = ''; while (n > 0) { const m = (n - 1) % 26; r = String.fromCharCode(65 + m) + r; n = Math.floor((n - 1) / 26); } return r; };
function hozir() { const d = new Date(Date.now() + 5 * 3600 * 1000), p = n => String(n).padStart(2, '0');
  const dmy = p(d.getUTCDate()) + '.' + p(d.getUTCMonth() + 1) + '.' + d.getUTCFullYear();
  return { dmy, dmyHm: dmy + ' ' + p(d.getUTCHours()) + ':' + p(d.getUTCMinutes()), iso: d.toISOString().slice(0, 10) }; }
function isoDan(v) {   // sana: seriya raqam | 'dd.mm.yyyy' | 'yyyy-mm-dd' → iso | ''
  if (typeof v === 'number') return V.iso(v) || '';
  v = T(v); if (/^\d{4}-\d{2}-\d{2}/.test(v)) return v.slice(0, 10);
  const m = /^(\d{2})\.(\d{2})\.(\d{4})/.exec(v); return m ? m[3] + '-' + m[2] + '-' + m[1] : '';
}
const dmy = iso => iso ? s(iso).slice(0, 10).split('-').reverse().join('.') : '';
function kunQosh(iso, n) { const d = new Date(iso + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
function kunFarq(a, b) { return Math.round((new Date(a + 'T12:00:00Z') - new Date(b + 'T12:00:00Z')) / 86400000); }   // a − b (kun)
const tx = v => { v = s(v); return /^[=+\-@']|^\d/.test(v) ? "'" + v : v; };   // USER_ENTERED: sana/raqam/formula bo'lib ketmasin — matn bo'lib qolsin
const ism = fish => { const w = T(fish).replace(/["«»'`ʻʼ‘’“”]/g, '').split(/\s+/), tc = x => x.charAt(0).toUpperCase() + x.slice(1).toLowerCase();
  return (w.length >= 3 ? w.slice(1, (w[3] && /G.?LI|QIZI|O.?G.?LI/i.test(w[3])) ? 4 : 3) : w).map(tc).join(' '); };

// ------------------------------------------------------------------ sozlama: yangi shablon kuchga kirgan sana
async function ochBosh() { try { const v = await SZ.ol('och_bosh'); const b = v && typeof v === 'object' ? v.sana : v; return /^\d{4}-\d{2}-\d{2}$/.test(s(b)) ? s(b) : ''; } catch (e) { return ''; } }
async function ochBoshYoz(sana, kim) { if (sana && !/^\d{4}-\d{2}-\d{2}$/.test(sana)) throw new Error('Sana noto\'g\'ri.'); await SZ.yoz('och_bosh', { sana: sana || '' }, kim); }
const yangiMatn = (sanaIso, bosh) => !!(bosh && sanaIso && sanaIso >= bosh);

// ------------------------------------------------------------------ varaq
async function varaqTayyor() {
  const m = await G.varaqlar(env.aksBazaId, env.googleKey);
  if (m.varaqlar.some(v => v.title === OCH_VARAQ)) return false;
  await G.soralar(env.aksBazaId, [{ addSheet: { properties: { title: OCH_VARAQ, gridProperties: { rowCount: 2000, columnCount: OCH_S.length, frozenRowCount: 1 } } } }], env.googleKey);
  await G.yoz(env.aksBazaId, [{ varaq: OCH_VARAQ, katak: 'A1', qiymat: [OCH_S] }], env.googleKey);
  return true;
}
function qatorDan(x, qator) {
  const o = { qator }; OCH_S.forEach((k, j) => { o[k] = x[j] == null ? '' : x[j]; });
  const z = { qator, id: T(o.ID), no: T(o['Ijara_№']), dokon: T(o.Dokon_ID), fish: T(o.Ijarachi), undiruvchi: T(o.Undiruvchi),
    bosh: isoDan(o.Boshlanish_sana), muddat: isoDan(o.Muddat_sana), holati: T(o.Holati) || 'Nazoratda', matn: T(o.Matn) || 'Eski',
    eslatma: T(o.Eslatma_SMS), tekVaqt: T(o.Tekshiruv_vaqt), natija: T(o.Tekshiruv_natija), sms2: T(o.SMS2), qongiroq: T(o.Qongiroq),
    xabNo: T(o['Xabarnoma_№']), xabSana: isoDan(o.Xabarnoma_sana), xabPdf: T(o.Xabarnoma_PDF), hujBekor: isoDan(o.Hujjatdagi_bekor_sana),
    pochtaSana: isoDan(o.Pochta_sana), pochtaNo: T(o['Pochta_№']), kvitansiya: T(o.Kvitansiya_skan), bekorMumkin: isoDan(o.Bekor_mumkin_sana),
    sorov: T(o.Bekor_sorov), tarix: T(o.Tarix), izoh: T(o.Izoh), yaratildi: T(o.Yaratildi) };
  return z;
}
// Google'dan YANGI (yozishdan oldin)
async function ochYangi() {
  try {
    const R = await G.oraliqOqi(env.aksBazaId, OCH_VARAQ, 'A2:' + harf(OCH_S.length), env.googleKey, 'UNFORMATTED_VALUE');
    let m = -1; R.forEach((r, i) => { if (r[0] !== '' && r[0] != null) m = i; });
    return R.slice(0, m + 1).map((r, i) => qatorDan(r, i + 2)).filter(z => z.id);
  } catch (e) { if (/Unable to parse range|not found/i.test(e.message)) return []; throw e; }
}
// Ko'zgudan (ekran va qoidalar uchun)
async function ochKozgu() {
  try { return (await V.qatorlar(OCH_VARAQ)).map(({ n, x }) => qatorDan(x, n)).filter(z => z.id); } catch (e) { return []; }
}

// ------------------------------------------------------------------ faza (qaysi kunda nima)
// bugun — iso. Qaytaradi: { kun (boshlanishdan necha kun o'tdi), faza, muddatOtdi, … }
function faza(z, bugun) {
  const kun = z.bosh ? kunFarq(bugun, z.bosh) : 0;
  const yopiq = OCH_YOPIQ.indexOf(z.holati) >= 0;
  let f = 'kutish';
  if (yopiq) f = 'yopiq';
  else if (z.sorov) f = 'soraldi';
  else if (z.natija === 'Ochilgan') f = 'yopiq';
  else if (z.natija === 'Imzolanmagan') f = 'imzosiz';                 // imzolangan nusxa yo'q — tuzgan xodim «✕ Imzolanmagan» so'rovini beradi
  else if (z.natija === 'Ochilmagan') {
    if (z.matn !== 'Yangi') f = 'eski';                                     // eski matn: 🚫 «Ijarachi kelmadi» yo'li
    else if (!z.xabNo) f = kun >= OCH_XAT_KUN ? 'xabarnoma' : 'ochilmagan';   // 5-kun: SMS + qo'ng'iroq; 6-kun: xabarnoma
    else if (!z.pochtaSana) f = 'pochta';                                   // xabarnoma chiqdi — buyurtma xat + kvitansiya
    else if (z.bekorMumkin && z.bekorMumkin <= bugun) f = 'bekor';          // pochtadan 5 kun o'tdi — bekor qilish mumkin
    else f = 'kutish2';                                                     // pochta kuni kutilmoqda
  } else if (kun >= OCH_KUN) f = 'tekshiruv';
  else if (kun >= OCH_ESLATMA_KUN && !z.eslatma) f = 'eslatma';
  return { kun, faza: f, muddatOtdi: !!(z.muddat && z.muddat < bugun) };
}

// ------------------------------------------------------------------ undiruvchilar va teng taqsimlash
// Pool: 07_Xodimlar — ishlayotgan, admin bo'lmagan, «undiruv» huquqli xodimlar (19.11 holatida: Sharipov G'ayrat, Boboqulov Azimbek).
// Direktorning o'z portfeli bu yerga kirmaydi (u admin). Pool bo'sh bo'lsa — '' (topshiriq zaxira lavozimga/direktorga tushadi).
async function undiruvchilar() {
  return (await V.qatorlar('07_Xodimlar')).map(({ x }) => x).filter(r => r[1] && T(r[10]) === 'Ishlayapti')
    .map(r => ({ fish: T(r[1]), lavozim: s(r[3]), huquq: s(r[18]), admin: /(^|,)\s*admin\s*(,|$)/.test(s(r[18])) }))
    .filter(x => !x.admin && /(^|,)\s*undiruv\s*(,|$)/.test(x.huquq)).map(x => x.fish);
}
// Eng kam yuklangan: ochiq nazoratlar soni, teng bo'lsa — jami nazoratlar, keyin ro'yxat tartibi
function engKam(pool, L) {
  if (!pool.length) return '';
  const och = {}, jami = {}; pool.forEach(p => { och[p] = 0; jami[p] = 0; });
  L.forEach(z => { const p = pool.find(q => xodimTeng(q, z.undiruvchi)); if (!p) return; jami[p]++; if (OCH_YOPIQ.indexOf(z.holati) < 0) och[p]++; });
  return pool.slice().sort((a, b) => och[a] - och[b] || jami[a] - jami[b] || pool.indexOf(a) - pool.indexOf(b))[0];
}

// ------------------------------------------------------------------ yozish
async function qatorYoz(qator, kataklar) {   // kataklar: { ustunNomi: qiymat } — bitta so'rov
  const D = Object.keys(kataklar).map(k => ({ varaq: OCH_VARAQ, katak: harf(U[k]) + qator, qiymat: [[tx(kataklar[k])]] }));
  if (D.length) await G.yoz(env.aksBazaId, D, env.googleKey);
}
async function tarixQosh(z, matn, qosh) {   // W Tarix — eskisiga qo'shib (+ boshqa kataklar bitta so'rovda)
  const t = (z.tarix ? z.tarix + '\n' : '') + hozir().dmyHm + ' ' + matn;
  await qatorYoz(z.qator, Object.assign({ Tarix: t }, qosh || {}));
  z.tarix = t;
}
// 04 dagi ijara shartnomasi → 04b qatori (biriktirish). x — { no, dokon, fish, bosh (iso), sana (iso) }
async function qatorQosh(x, undiruvchi, bosh, matn, kim) {
  await varaqTayyor();
  const L = await ochYangi();
  if (L.some(z => z.no === x.no)) return L.find(z => z.no === x.no);
  const id = String(L.reduce((m, z) => Math.max(m, Number(z.id) || 0), 0) + 1);
  const h = hozir(), muddat = kunQosh(bosh, OCH_KUN);
  const q = [id, x.no, x.dokon, x.fish, undiruvchi, dmy(bosh), dmy(muddat), 'Nazoratda', matn, '', '', '', '', '', '', '', '', '', '', '', '', '', '',
    h.dmyHm + ' tizim: undiruvchi biriktirildi — ' + (undiruvchi || 'topilmadi') + (kim ? ' (' + kim + ')' : ''), '', h.dmyHm].map(tx);
  const n = L.reduce((m, z) => Math.max(m, z.qator), 1) + 1;
  const qator = await G.qatorQoshR(env.aksBazaId, OCH_VARAQ, n, q, env.googleKey);
  return qatorDan(q.map(v => s(v).replace(/^'/, '')), qator);
}

// ------------------------------------------------------------------ biriktirish: 04 dagi Aktiv shartnomalarga 04b qatori
// faqatNo — bitta shartnoma (ijaraSaqlash dan keyin); bo'lmasa — hammasi (top_avto yurishi: qolib ketgani bo'lsa to'ldiradi).
// Qaytaradi: yangi qo'shilgan qatorlar.
async function biriktir(faqatNo, kim) {
  const bosh = await ochBosh();
  const R4 = (await V.qatorlar('04_Ijara_shartnomalar')).map(({ x }) => x).filter(r => r[0] && /^IJ-27\/\d+$/.test(T(r[0])));
  const L = await ochKozgu(); const bor = {}; L.forEach(z => bor[z.no] = z);
  const holat4 = {}; R4.forEach(r => holat4[T(r[0])] = T(r[2]));
  // shartnomasi endi «Aktiv» bo'lmagan ochiq nazoratlar yopiladi (bekor qilindi / muddati tugadi — boshqa yo'l bilan)
  if (!faqatNo) for (const z of L) { if (OCH_YOPIQ.indexOf(z.holati) >= 0 || holat4[z.no] === 'Aktiv') continue;
    try { await tarixQosh(z, 'tizim: shartnoma holati «' + (holat4[z.no] || 'yo\'q') + '» — nazorat yopildi', { Holati: 'Yopildi' }); } catch (e) { console.error('ochilish yop (' + z.no + '):', e.message); } }
  // ochiq kelishuv / kelmadi so'rovi bor shartnoma nazoratga kirmaydi (u shundoq ham bekor qilinyapti)
  let kbOchiq = {}; try { const KBH = require('./kb_hujjat'); (await KBH.kbRowsKozgu()).forEach(q => { if (KBH.KB_OCHIQ.indexOf(q.holati) >= 0) kbOchiq[q.no] = true; }); } catch (e) { }
  const nomzod = R4.filter(r => { const no = T(r[0]); if (faqatNo && no !== faqatNo) return false; if (bor[no] || kbOchiq[no]) return false;
    if (T(r[2]) !== 'Aktiv') return false; const sana = isoDan(r[1]); return sana && (!OCH_BIRIKTIR_BOSH || sana >= OCH_BIRIKTIR_BOSH); });
  if (!nomzod.length) return [];
  const pool = await undiruvchilar();
  const yangi = [], L2 = L.slice();
  for (const r of nomzod) {
    const no = T(r[0]), sana = isoDan(r[1]), b = isoDan(r[9]) || sana;
    const x = { no, dokon: T(r[4]), fish: T(r[23]), bosh: b, sana };
    const und = engKam(pool, L2);
    try {
      const z = await qatorQosh(x, und, b, yangiMatn(sana, bosh) ? 'Yangi' : 'Eski', kim);
      L2.push(z); yangi.push(z);
    } catch (e) { console.error('ochilish biriktir (' + no + '):', e.message); }
  }
  return yangi;
}

// ------------------------------------------------------------------ ijarachi aloqasi (02_Mijozlar) va SMS matni
async function mijozTel(mid) {
  const m = (await V.qatorlar('02_Mijozlar')).map(({ x }) => x).find(z => T(z[0]) === T(mid));
  const tel = v => { const d = s(v).replace(/\D/g, ''); return d.length >= 9 ? d.slice(-9) : ''; };
  return m ? { fish: T(m[2]), tel1: tel(m[4]), tel2: tel(m[5]) } : { fish: '', tel1: '', tel2: '' };
}
function smsMatn(tur, z, tel) {
  return (OCH_SMS[tur] || '').replace('{ism}', ism(z.fish) || 'mijoz').replace('{no}', z.no).replace('{dokon}', z.dokon).replace('{muddat}', dmy(z.muddat)).replace('{tel}', tel || '+998 95-557-88-88');
}

module.exports = { OCH_VARAQ, OCH_S, OCH_KUN, OCH_ESLATMA_KUN, OCH_XAT_KUN, OCH_POCHTA_KUN, OCH_HUJJAT_KUN, OCH_BIRIKTIR_BOSH, OCH_YOPIQ, OCH_SMS, U,
  hozir, isoDan, dmy, kunQosh, kunFarq, tx, ism, harf, ochBosh, ochBoshYoz, yangiMatn, varaqTayyor, qatorDan, ochYangi, ochKozgu, faza, undiruvchilar, engKam,
  qatorYoz, tarixQosh, qatorQosh, biriktir, mijozTel, smsMatn };
