// AKS TIZIM — 🤖 TOPSHIRIQ QOIDALARINI HOZIR TEKSHIRISH: topHozir serverda (Topshiriq.gs v2.2 topAvto bilan bir xil nomzodlar, kalitlar, matnlar,
// mas'ullar, muddatlar, takrorsizlik va avtomatik yopish; 10_Topshiriqlar — Google'dan YANGI, qolgan manbalar — ko'zgu: portfel (lib/portfel.js),
// hujjat svodi (api/monitoring.js monHujjatSvod), 06e, 06h, 03, 04, 02, 05b).
//   Qoidalar: skan · davo · vada · tolov · xat · bekor · pasport · bepul · bufer · skanq (v1.9) — sozlama (TOP_QOIDA) api/topshiriq.js dan.
//   Yangi topshiriq — topYoz (api/topshiriq_yoz.js), xodimga Telegram — topTg (Koprik koprikTgChat).
//   Avtomatik yopish — topHal_ (sabab bartaraf bo'lsa «Bajarildi», yopdi «tizim») va topHalHujjat_ (hujjat yuklangan — «Tekshiruvda», U «HJ:<id>»,
//   tekshiruvchiga Telegram — Koprik v1.7 koprikTopTasdiqTg; fayl hali serverda (SRV) bo'lsa — Drive'ga ko'chgach).
//   skanNazTekshir_ (v2.1, yangi skanlarning ixtiyoriy nazorati — Script Properties bilan) — eski tizimning o'zi (Koprik v1.12 koprikSkanNaz).
//   tgTugmaOrnat_ (Telegram tugmalari triggeri) — faqat Apps Script'da; eski topAvto triggeri (har 2 soat) uni o'zi o'rnatib turadi — bu yerda yo'q.
// Eski topAvto triggeri (har 2 soatda) — lib/vaqt.js «top_avto» (vaqt_yondi:top_avto) yoqilgach serverda; eski trigger Apps Script'da o'chiriladi (22.10.2026).
// Yoqilishi: Redis yozuv_yondi:top_avto («aks-yozuv-sinov tophozir») va Koprik ≥ 1.5. Aks holda — eski tizim.
'use strict';
const BQ = require('../lib/bayroq');   // yozuv/vaqt bayroqlari — standart holat kodda (02.11.2026)
const crypto = require('crypto');
const S = require('./sessiya');
const V = require('../lib/varaq');
const G = require('../lib/google');
const env = require('../lib/env');
const J = require('../lib/jurnallar');
const P = require('../lib/portfel');
const X = require('../lib/xat_yordam');
const UY = require('../lib/undiruv_yordam');   // 18.11.2026: yuristdagi ishlarda da'vo muddati
const TS = require('../lib/tasdiq');
const koprik = require('./koprik');
const tetik = require('../lib/kozgu_tetik');
const { redis } = require('../lib/db');
const TP = require('./topshiriq_yoz')._ichki;
const TQ = require('./topshiriq')._ichki;
const MON = require('./monitoring')._ichki;

const TOP_V = TP.TOP_V, HUJ_V = '06d_Hujjatlar';
const s = v => String(v == null ? '' : v);
const kut = (p, ms) => Promise.race([p, new Promise(r => setTimeout(r, ms))]);
const yangila = nomlar => kut(tetik.varaqlarYangila(nomlar).catch(e => console.error('ko\'zgu (top avto):', e.message)), 15000);
const pul = n => Math.round(Number(n) || 0).toLocaleString('ru-RU');   // eski: Math.round(x).toLocaleString('ru-RU') — «1 234 567» (ajratuvchi — V8/ICU ru-RU: U+00A0)
function isoKun(ms) { return new Date(ms + 5 * 3600 * 1000).toISOString().slice(0, 10); }
const dmy = iso => iso ? s(iso).split('-').reverse().join('.') : '';
const isoX = v => typeof v === 'number' ? V.iso(v) : '';   // getValues dagi Date → iso; matn — ''
function aOxiri(rows) { let m = 0; rows.forEach(({ n, x }) => { if (x[0] !== null && x[0] !== undefined && x[0] !== '') m = n; }); return rows.filter(z => z.n <= m); }

async function serverda(kod) {
  try { if (!(await BQ.yozuv('top_avto'))) return false; } catch (e) { return false; }
  return TP.koprik15(kod);
}
async function eskiTizim(fn, u, args) { const r = await koprik.chaqir(fn, u.kod, args, { muddat: 120000, urinish: 1 }); await tetik.yangilaKut(20000); return r; }
// LockService tryLock(20000) o'rni — topBer bilan bitta qulf (qulf:topshiriq); band bo'lsa null
async function qulfUrin(ish) {
  const kalit = 'qulf:topshiriq', belgi = crypto.randomBytes(8).toString('hex'), t0 = Date.now();
  while (!(await redis.set(kalit, belgi, 'PX', 120000, 'NX'))) { if (Date.now() - t0 > 20000) return null; await new Promise(r => setTimeout(r, 200)); }
  try { return await ish(); } finally { if ((await redis.get(kalit)) === belgi) await redis.del(kalit); }
}

const KB_SKAN_KUN = 3;
// ------------------------------------------------------------------ topCtx_: qoidalar uchun manbalar
async function topCtx(kod, bugun) {
  const d0 = new Date(bugun + 'T12:00:00Z');
  const [Pf, HJ, Xj, B0, R3, R4, R2, R5, mlM] = await Promise.all([P.undPortfel(() => true, kod), J.hujjatJurnal(), J.xatJurnal(), MON.bekorSorovlar(bugun),
    V.qatorlar('03_Sotuv_shartnomalar'), V.qatorlar('04_Ijara_shartnomalar'), V.qatorlar('02_Mijozlar'), V.qatorlar('05b_Bufer_tolovlar').catch(() => []), TQ.topMlMijoz()]);
  const Pl = Pf.royxat; const PN = {}; Pl.forEach(x => PN[x.no] = x);
  const SV = await MON.monHujjatSvod(bugun, {}, HJ);   // eski: monHujjatSvod_(ss, bugun, {})
  const skanBor = {}; (SV.jurnal || []).forEach(h => { if (h.holati === 'Faol' && h.turi === 'SHARTNOMA') skanBor[h.no] = 1; });
  const B = B0.filter(z => ['Bekor qilindi', 'Rad etildi', 'Qaytarildi'].indexOf(z.holati) < 0);
  // shartnoma → mijoz, ijara ma'lumotlari, bekorlar
  const mid = {}, bekorNo = {}, ijOylik = {}, bepul = [], mijozShar = {};
  aOxiri(R3).forEach(({ r }) => { const no = s(r[0]).trim(); if (!no) return; mid[no] = s(r[4]).trim();
    // 13.11.2026: YAKUNLANGAN (to'liq to'langan) shartnoma ham «faol» emas — bunday mijozga «pasportini yangilang» topshirig'i berilmaydi, borlari o'zi yopiladi
    if (/bekor/i.test(s(r[13]))) bekorNo[no] = 1; else if (!/yakun/i.test(s(r[13]))) (mijozShar[mid[no]] = mijozShar[mid[no]] || []).push({ no, kim: s(r[17]) }); });
  aOxiri(R4).forEach(({ x }) => { const no = s(x[0]).trim(); if (!no) return; mid[no] = s(x[5]).trim(); ijOylik[no] = Number(x[14]) || 0;
    const bek = /bekor/i.test(s(x[2])); if (bek) { bekorNo[no] = 1; return; }
    (mijozShar[mid[no]] = mijozShar[mid[no]] || []).push({ no, kim: s(x[20]) });
    const bt = isoX(x[28]); if (bt && bt >= bugun && (new Date(bt + 'T12:00:00Z') - d0) / 86400000 <= 30 && !(Number(x[14]) > 0))
      bepul.push({ no, fish: s(x[23]), tugash: dmy(bt), qolgan: Math.round((new Date(bt + 'T12:00:00Z') - d0) / 86400000), kim: s(x[20]) }); });
  // pasport (faqat faol shartnomasi borlar)
  const pasport = [], pasMuddat = {};   // pasMuddat — pasporti hamon eskirgan mijozlar (shartnomasi faol bo'lmasa ham): topshiriq nega yopilganini to'g'ri yozish uchun
  aOxiri(R2).forEach(({ x }) => { const m = s(x[0]).trim(); if (!m || typeof x[10] !== 'number') return;
    const mud = isoX(x[10]); if (!mud) return;
    const q = Math.round((new Date(mud + 'T12:00:00Z') - d0) / 86400000); if (q <= 30 && q > -3650) { pasMuddat[m] = 1; if (!mijozShar[m]) return; const sh = mijozShar[m][0]; pasport.push({ mid: m, fish: s(x[2]), muddat: dmy(mud), qolgan: q, no: sh.no, kim: sh.kim || (PN[sh.no] || {}).undiruvchi || '' }); } });
  // bufer
  const bufer = [];
  // 05b L (Muddat_holati) — ko'ringan matndan emas, xom qiymatdan (02.11.2026, 3-bosqichga tayyorgarlik)
  aOxiri(R5).forEach(({ r, x }) => { if (r[0] && s(r[6]) === 'Буферда' && /MUDDATI O'TDI/i.test(s(x[11]))) bufer.push({ id: s(r[0]), sana: s(r[1]), no: s(r[2]), summa: Number(s(r[3]).replace(/\s/g, '').replace(',', '.')) || 0 }); });
  const qaytBlok = {}; (await require('../lib/qaytarish_blok').ochiqQarorlar()).forEach(q => { qaytBlok[q.no] = true; });   // pul qaytarilayotganlar — yuristga tavsiya yo'q
  // 14.11.2026 (direktor qarori): 🤝 kelishuv bilan bekor qilish hujjati tayyorlangan, lekin imzolangan skan KB_SKAN_KUN kundan beri yuklanmagan (yoki direktor
  // qaytargan va qayta yuklanmagan) — shartnoma bazada «Aktiv» bo'lib turaveradi. 14.11.2026 da shunday 7 ta ish bor edi, 5 tasi 34 kundan beri.
  let kb = [];
  try { kb = (await require('./taminot')._ichki.kbRows()).filter(z => z.holati === 'Hujjat tayyorlandi' || z.holati === 'Rad etildi').map(z => {
      const sana = TS.topIso(z.holati === 'Rad etildi' ? (z.javobVaqt || z.vaqt) : z.vaqt).slice(0, 10);
      return { id: s(z.id), no: z.no, fish: s(z.fish), dokon: s(z.dokon), kim: s(z.kim), qaytgan: z.holati === 'Rad etildi', kun: sana ? Math.round((d0 - new Date(sana + 'T12:00:00Z')) / 86400000) : 0 }; })
    .filter(z => z.kun > KB_SKAN_KUN); } catch (e) { console.error('topCtx kb:', e.message); }
  // ⚖ 18.11.2026 (direktor qarori): ish yuristga o'tgach «davo» qoidasi to'xtar edi — yuristdagi, hali sudga berilmagan ishlarda da'vo muddati
  // (3 yil = 1095 kun) 90 kundan kam qolgan yoki allaqachon tugaganlari nazoratsiz qolardi. Endi ular yuristga topshiriq bo'lib tushadi.
  let yuDavo = [];
  try {
    const [YI, SHL] = await Promise.all([J.yuIshlar(), UY.undShartnomalar()]);
    const SH = {}; SHL.forEach(z => SH[z.no] = z);
    yuDavo = YI.filter(i => ['Faol', 'Kelishuv', "Yopish so'ralgan"].indexOf(i.holati) >= 0 && (Number(i.bosqich) || 0) <= 1)
      .map(i => { const z = SH[i.no] || {}; const dk = Number(z.davoKun != null ? z.davoKun : z.kechikkan) || 0;
        return { id: s(i.id), no: i.no, fish: s(z.fish || i.fish), dokon: s(z.dokon || i.dokon), jami: Number(z.jami) || 0, yurist: s(i.yurist), qoldi: 1095 - dk }; })
      .filter(z => z.qoldi <= 90);
  } catch (e) { console.error('topCtx yuDavo:', e.message); }
  // 📒 18.11.2026 (direktor qarori): ijro intizomi — oy ichida 3 balldan oshgan xodimdan YOZMA TUSHUNTIRISH talab qilinadi (zinapoyaning 2-pog'onasi).
  // Avval bu faqat Telegram xabari bilan so'ralardi va hech qayerda kuzatilmasdi: Badalovda 8 ta qoidabuzarlik, 8 tasi ham tushuntirishsiz turardi.
  let ijTush = [];
  try {
    const oy = bugun.slice(0, 7), Q = await V.qatorlar('06q_Qoidabuzarlik');
    const L = Q.map(({ x }) => ({ id: s(x[0]), sana: typeof x[1] === 'number' ? V.iso(x[1]) : s(x[1]).slice(0, 10), xodim: s(x[2]), tur: s(x[3]), nomi: s(x[4]),
      ogirlik: s(x[5]), ball: Number(x[6]) || 1, no: s(x[7]), tafsilot: s(x[9]), holati: s(x[10]), tush: s(x[13]).trim() }))
      .filter(q => q.id && q.xodim && q.holati !== 'Uzrli' && String(q.sana).slice(0, 7) === oy);
    const ball = {}; L.forEach(q => ball[q.xodim] = (ball[q.xodim] || 0) + q.ball);
    // Har qoidabuzarlikka alohida topshiriq berilsa — bir kunda 165 ta topshiriq chiqadi (18.11 sinovi). Shuning uchun xodimga OYIGA BITTA topshiriq:
    // «shu oyda N ta tushuntirilmagan qoidabuzarlik bor» — ichidagilarni xodim «📒 Ijro intizomi» sahifasida birin-ketin yozadi.
    ijTush = Object.keys(ball).filter(x => ball[x] >= 3).map(x => {
      const M = L.filter(q => q.xodim === x && !q.tush).sort((a2, b2) => (a2.sana < b2.sana ? -1 : 1));
      return { xodim: x, oy, soni: M.length, ball: ball[x], eski: M.length ? M[0].sana : '', misol: M.slice(0, 3).map(q => q.nomi) };
    }).filter(z => z.soni);
  } catch (e) { console.error('topCtx ijTush:', e.message); }
  return { mlM, qaytBlok, kb, yuDavo, ijTush, HJ: SV.jurnal || [], P: Pl, PN, skansiz: SV.nusxasiz || [], skanBor, X: Xj, B, mid, bekorNo, ijOylik, bepul, pasport, pasMuddat, bufer,
    kunOldin: k => new Date(d0.getTime() - k * 86400000).toISOString().slice(0, 10) };   // bugun − k kun
}
// sabab bartaraf bo'lganmi — bo'lsa dalil matni, aks holda ''
function topHal(t, ctx, hozir) {
  const q = t.qoida, id = t.kalit.split('|')[1], yarat = TS.topIso(t.yaratildi).slice(0, 10);
  if (TS.topHjTur(t)) return '';   // v2.0: hujjat topshiriqlari — topHalHujjat_ (tekshiruvga)
  if (q === 'skan') return ctx.skanBor[id] ? 'shartnoma skani yuklandi' : (ctx.bekorNo[id] ? 'shartnoma bekor qilingan' : '');
  if (q === 'davo') { const x = ctx.PN[id]; if (!x) return 'portfeldan chiqdi'; if (x.yuSorov) return 'yuristga o\'tkazish so\'raldi';
    if (ctx.X.some(h => h.no === id && h.holati === 'Yuborildi' && X.xatIso(h.yetSana || h.sana) >= yarat)) return 'ogohlantirish xati yuborildi'; return x.davoXavf ? '' : 'da\'vo xavfi yo\'q'; }
  if (q === 'vada' || q === 'tolov') { const x = ctx.PN[id]; if (!x) return 'portfeldan chiqdi'; if (x.oxirgi && x.oxirgi.sana >= yarat) return 'chora yozildi: ' + x.oxirgi.chora;
    if (q === 'tolov' && !(Number(x.muddati) > 0)) return 'qarz to\'landi'; if (q === 'vada' && x.vada && x.vada.natija && x.vada.natija !== 'Вадада') return 'va\'da natijasi: ' + x.vada.natija; return ''; }
  if (q === 'xat') { const h = ctx.X.find(z => z.raqam === id); return !h ? 'xat topilmadi' : h.holati !== 'Tayyorlandi' ? 'xat holati: ' + h.holati : ''; }
  if (q === 'bekor') { const sr = ctx.B.find(z => String(z.id) === id); return !sr ? 'so\'rov yopilgan' : sr.hujjatKechikdi ? '' : 'skanlar yuklandi'; }
  if (q === 'pasport') return hozir[t.kalit] ? '' : (ctx.pasMuddat && ctx.pasMuddat[id] ? 'mijozning faol shartnomasi qolmadi (yakunlangan yoki bekor qilingan)' : 'pasport yangilandi');
  if (q === 'bepul') return ctx.bekorNo[id] ? 'shartnoma bekor qilingan' : (ctx.ijOylik[id] > 0 ? 'pullik ijara kiritildi' : '');
  if (q === 'bufer') return hozir[t.kalit] ? '' : 'buferdan chiqarildi';
  if (q === 'kbskan') return hozir[t.kalit] ? '' : 'imzolangan skan yuklandi yoki so\'rov yopildi';   // 14.11.2026
  if (q === 'yudavo') return (ctx.yuDavo || []).some(z => z.no === id) ? '' : 'sudga ariza berildi yoki ish yopildi';   // 18.11.2026
  if (q === 'tushuntirish') return (ctx.ijTush || []).some(z => z.xodim === t.kalit.split('|')[1]) ? '' : 'hamma tushuntirish yozildi yoki uzrli deb topildi';   // 18.11.2026
  if (q === 'otkaz') return t.kalit.split('|')[2] < ctx.kunOldin(0) ? 'kun tugadi — javob berilmadi' : '';   // v1.5
  if (q === 'muhlat') return t.kalit.split('|')[2] < ctx.kunOldin(0) ? 'so\'ralgan sana o\'tdi — javob berilmadi' : '';   // v1.6
  if (q === 'malumot') { const p = t.kalit.split('|'); if (ctx.bekorNo[p[1]]) return 'shartnoma bekor qilingan';   // v1.4
    return ((ctx.mlM || {})[t.mid || ctx.mid[p[1]]] || {})[p[2]] ? 'ma\'lumot bazaga kiritildi' : ''; }
  return '';
}
// topHalHujjat_: ochiq hujjat topshiriqlari — JSHSHIR kiritilgan bo'lsa «Bajarildi»; hujjat yuklangan bo'lsa «Tekshiruvda» (+ U «HJ:<id>», tekshiruvchiga Telegram);
// shartnoma bekor qilingan bo'lsa «Bajarildi». quruq — yozmaydi, faqat ro'yxat. filtr — faqat shu topshiriqlar (topMening: xodimniki; R.L esa — hammasi,
// «shu hujjat bo'yicha Telegram allaqachon ketganmi» tekshiruvi uchun). Qaytaradi { n, yop: [{id, holat, dalil}], tg: [{id, h}] }
async function topHalHujjat(R, HJ, mlM, bekorNo, quruq, filtr) {
  const H = R.L.filter(t => t.holati === 'Jarayonda' && TS.topHjTur(t) && TS.topHjTur(t) !== 'MANZIL' && TS.topHjTur(t) !== 'BOSHQA' && (!filtr || filtr(t)));
  const out = { n: 0, yop: [], tg: [] }; if (!H.length) return out;
  const rejada = new Set();
  for (const t of H) {
    const no = t.no || s(t.kalit).split('|')[1];
    const yop = async (holat, kim, dalil, h) => {
      out.yop.push({ id: t.id, holat, kim, dalil, hj: h ? h.id : '' }); out.n++;
      if (quruq) return;
      await TP.topYop(TOP_V, t, holat, kim, dalil);
      if (h) await G.yoz(env.aksBazaId, [{ varaq: TOP_V, katak: 'U' + t.qator, qiymat: [['HJ:' + h.id]] }], env.googleKey);
    };
    if (TS.topHjTur(t) === 'JSHSHIR') { if ((mlM[t.mid] || {}).jshshir) await yop('Bajarildi', 'tizim', 'JSHSHIR bazaga kiritildi'); continue; }
    const h = TQ.topHjHujjat(t, HJ);
    if (h) {
      await yop('Tekshiruvda', h.kim || 'tizim', 'hujjat yuklandi: ' + h.nom + (h.kim ? ' (' + h.kim + ')' : ''), h);
      // bitta hujjat — bir nechta topshiriq: Telegram xabari faqat birinchisiga (boshqasida xabar bo'lsa — yuborilmaydi)
      const bor = rejada.has(h.id) || R.L.some(z => s(z.id) !== s(t.id) && z.holati === 'Tekshiruvda' && s(z.isbot) === 'HJ:' + h.id && z.tgx);
      if (!bor) { rejada.add(h.id); out.tg.push({ id: t.id, h }); }
    } else if (bekorNo && bekorNo[no]) await yop('Bajarildi', 'tizim', 'shartnoma bekor qilingan');
  }
  return out;
}
function tasdiqTg(kod, L) {   // tekshiruvchiga Telegram — eski tizim faylni Drive'dan oladi: serverdagi (SRV) fayl ko'chgach
  const HY = require('./hujjat_yoz')._ichki;
  L.forEach(({ id, h }) => {
    const yub = async () => { await koprik.chaqir('koprikTopTasdiqTg', kod, [id]); };
    if (/^SRV:/.test(s(h.faylId))) HY.driveKeyin(s(h.no).replace(/\//g, '-') + '/' + h.nom, yub);
    else yub().catch(e => console.error('koprikTopTasdiqTg (top avto):', e.message));
  });
}

// ------------------------------------------------------------------ topAvto: qoidalar bo'yicha nomzodlar → yangi topshiriqlar; sabab bartaraf bo'lganlar yopiladi
// opt.quruq — hech narsa yozmaydi (sinov): { yangi: [o…], yop: [{id, holat, kim, dalil}], nomzod: [...] }
async function topAvto(kod, opt = {}) {
  const quruq = !!opt.quruq;
  const bugun = V.bugun(), cfg = await TQ.topQoidaCfg(kod), XD = await TP.topXodimlar();
  const d0 = new Date(bugun + 'T12:00:00Z'); const qosh = n => dmy(new Date(d0.getTime() + n * 86400000).toISOString().slice(0, 10)) + ' 18:00';
  const R = await TP.topRowsYangi(TOP_V);
  const ctx = await topCtx(kod, bugun);
  const C = [];                                          // nomzodlar
  const nomzod = (q, kalit, sarl, izoh, no, mid, raw) => { if (!cfg[q] || !cfg[q].on) return; C.push({ qoida: q, kalit: q + '|' + kalit, sarlavha: sarl, izoh, no: no || '', mid: mid || '', raw }); };
  // 1 skan
  ctx.skansiz.forEach(x => nomzod('skan', x.no, 'Shartnoma skanini kiriting', x.fish + ' · ' + x.dokon + ' · ' + x.kun + ' kundan beri skan yo\'q', x.no, ctx.mid[x.no], x.kim));
  // 2–4 portfel
  ctx.P.forEach(x => {
    if (x.davoXavf && !x.yuSorov && !ctx.qaytBlok[x.no]) nomzod('davo', x.no, "Da'vo muddati yaqin — ogohlantirish yoki yuristga o'tkazish", x.fish + ' · ' + x.davoQolgan + ' kun qoldi · qarz ' + pul(x.jami), x.no, x.mijozId || ctx.mid[x.no], x.undiruvchi);
    if (x.bugunVada && !ctx.qaytBlok[x.no]) nomzod('vada', x.no + '|' + (x.vada ? x.vada.sana : ''), "Va'da sanasi — mijoz bilan bog'laning", x.fish + ' · va\'da ' + (x.vada ? pul(x.vada.summa) + ' so\'m' : ''), x.no, x.mijozId || ctx.mid[x.no], x.undiruvchi);
    const k = Number(x.kechikkan) || 0;
    if (!ctx.qaytBlok[x.no] && (Number(x.muddati) || 0) > 0 && k >= 1 && k <= 30 && !(x.oxirgi && x.oxirgi.sana >= ctx.kunOldin(k))) nomzod('tolov', x.no, "To'lov kechikdi — mijoz bilan bog'laning", x.fish + ' · ' + k + ' kun · muddati o\'tgan ' + pul(x.muddati), x.no, x.mijozId || ctx.mid[x.no], x.undiruvchi);
  });
  // 5 xat
  ctx.X.forEach(h => { const kun = X.xatKechikkan(h, bugun); if (kun > 0) nomzod('xat', h.raqam, 'Ogohlantirish xatini yetkazing', h.raqam + ' · ' + kun + ' kun kechikdi', h.no, ctx.mid[h.no], h.kim); });
  // 6 bekor
  ctx.B.forEach(sr => { if (sr.hujjatKechikdi) nomzod('bekor', sr.id, 'Bekor qilish skanlarini yuklang (buyruq, xabarnoma)', sr.fish + ' · ' + sr.hujjatKechikdi + ' ish kuni', sr.no, ctx.mid[sr.no], sr.kim); });
  // 7 pasport
  ctx.pasport.forEach(p => nomzod('pasport', p.mid, 'Mijoz pasportini yangilang', p.fish + ' · ' + (p.qolgan < 0 ? 'muddati ' + p.muddat + ' da tugagan' : p.muddat + ' da tugaydi'), p.no, p.mid, p.kim));
  // 8 bepul
  ctx.bepul.forEach(b => nomzod('bepul', b.no, 'Ijara bepul davri tugaydi — pullik ijara / sotib olish qarori', b.fish + ' · ' + b.tugash + ' (' + b.qolgan + ' kun)', b.no, ctx.mid[b.no], b.kim));
  // 10 skanq (v1.9) — qarzdor shartnomasining skani yo'q: kotibaga (arxiv); «Arxivda topilmadi» bo'lgan yoki undiruvchida ochiq — qayta yo'q
  const kotiba = (XD.find(z => /kotib/i.test(z.lavozim)) || {}).fish || '';
  const skanTop = {}; R.L.forEach(t => { const p = s(t.kalit).split('|');
    if ((p[0] === 'skanq' && /^Arxivda topilmadi/.test(t.dalil)) || ((p[0] === 'skanu' || p[0] === 'skanz') && (t.holati === 'Jarayonda' || t.holati === 'Tekshiruvda'))) skanTop[p[1]] = 1; });
  ctx.P.forEach(x => { if (!(Number(x.muddati) > 100000) || ctx.skanBor[x.no] || ctx.bekorNo[x.no] || skanTop[x.no]) return;
    nomzod('skanq', x.no, 'Shartnoma skanini arxivdan topib yuklang', x.fish + ' · ' + x.dokon + ' · qarzdor, undiruvchi: ' + (x.undiruvchi || '—') + ' — skan sudga kerak', x.no, x.mijozId || ctx.mid[x.no], kotiba || x.undiruvchi); });
  // 11 kbskan (14.11.2026) — kelishuv bilan bekor qilish: hujjat tayyor, imzolangan skan yo'q
  (ctx.kb || []).forEach(k => nomzod('kbskan', k.id, 'Kelishuv bilan bekor qilish: imzolangan skanni yuklang', k.no + ' · ' + k.fish + ' · ' + k.dokon + ' · ' + (k.qaytgan ? 'direktor qaytargan, ' : 'hujjat ') + k.kun + ' kundan beri ' + (k.qaytgan ? 'qayta yuklanmagan' : 'imzolanmagan') + ' — shartnoma hali «Aktiv»', k.no, ctx.mid[k.no], k.kim));
  // 12 yudavo (18.11.2026) — yuristdagi ishda da'vo muddati tugayapti yoki tugagan
  (ctx.yuDavo || []).forEach(z => nomzod('yudavo', z.no,
    z.qoldi > 0 ? "Da'vo muddati tugayapti — sudga ariza bering" : "Da'vo muddati tugagan — sudga ariza bering yoki yozma xulosa kiriting",
    z.fish + ' \u00b7 ' + z.dokon + ' \u00b7 ' + (z.qoldi > 0 ? "da'vo muddatiga " + z.qoldi + ' kun qoldi' : "da'vo muddati " + (-z.qoldi) + ' kun oldin tugagan')
      + ' \u00b7 qarz ' + pul(z.jami) + ' so\'m \u00b7 hali sudga berilmagan',
    z.no, ctx.mid[z.no], z.yurist));
  // 13 tushuntirish (18.11.2026) — ijro intizomi: 2-pog'onadagi xodimga oyiga bitta topshiriq (ichida nechta tushuntirish kerakligi yozilgan)
  (ctx.ijTush || []).forEach(z => nomzod('tushuntirish', z.xodim + '|' + z.oy,
    z.soni + ' ta qoidabuzarlikka yozma tushuntirish yozing',
    'Bu oyda ' + z.ball + ' ball qoidabuzarlik \u00b7 ' + z.soni + ' tasi tushuntirilmagan'
      + (z.eski ? ' \u00b7 eng eskisi ' + dmy(z.eski) : '') + (z.misol.length ? ' \u00b7 masalan: ' + z.misol.join('; ') : '')
      + ' \u2014 ilovada: \ud83d\udcd2 Ishlar \u2192 Ijro intizomi \u2192 har qatorda \u00ab\u270d Tushuntirish yozish\u00bb',
    '', '', z.xodim));
  // 9 bufer
  ctx.bufer.forEach(b => nomzod('bufer', b.id, 'Bufer to\'lovni kirim qiling yoki qaytaring', b.no + ' · ' + pul(b.summa) + ' so\'m · ' + b.sana, b.no, ctx.mid[b.no], ''));

  // --- yaratish (takrorsiz: shu kalit ochiq bo'lsa yoki 7 kun ichida yopilgan bo'lsa — yo'q)
  const yetti = isoKun(Date.now() - 7 * 86400000);
  const band = {}; R.L.forEach(t => { if (!t.kalit) return; if (t.holati === 'Jarayonda' || t.holati === 'Tekshiruvda' || TS.topIso(t.yopildi).slice(0, 10) >= yetti) band[t.kalit] = 1; });
  const yangi = [], asl = { L: R.L.slice() };   // avtomatik yopish — faqat avval bor topshiriqlar (eski: R yaratishdan oldin o'qilgan)
  // 14.11.2026: yangi «kbskan» topshiriqlari faqat ish vaqtida (08:00–20:00) yaratiladi — xodimga tunda bir nechta Telegram xabar bormasin.
  // Nomzodlar ro'yxati (C) tunda ham to'liq — aks holda ochiq topshiriqlar «sabab bartaraf bo'ldi» deb yopilib ketardi.
  const soatT = new Date(Date.now() + 5 * 3600 * 1000).getUTCHours(), tun = soatT < 8 || soatT >= 20;
  for (const c of C) {
    if (!quruq && tun && c.qoida === 'kbskan') continue;
    if (band[c.kalit]) continue; band[c.kalit] = 1; const k = TP.topKimga(XD, c.raw);
    const o = { manba: 'Tizim', qoida: c.qoida, kalit: c.kalit, sarlavha: c.sarlavha, izoh: c.izoh + (k.egasiz && c.qoida !== 'bufer' ? ' · ⚠ mas\'ul topilmadi — qayta topshiring' : ''), no: c.no, mid: c.mid, kimga: k.fish, kimBerdi: 'tizim', muddat: qosh(cfg[c.qoida].kun), muhim: c.qoida === 'davo' || c.qoida === 'vada' || c.qoida === 'yudavo' ? 'Shoshilinch' : 'Oddiy' };
    if (quruq) { yangi.push(o); continue; }
    const row = await TP.topYoz(TOP_V, o, R);
    R.L.push(Object.assign({ holati: 'Jarayonda', yopildi: '', isbot: '', tgx: '' }, row)); R.l = row.qator;   // keyingi ID va qator uchun
    yangi.push(row);
  }
  // --- avtomatik yopish: kalitli ochiq topshiriqlar, sabab bartaraf bo'lsa
  const hozirKalit = {}; C.forEach(c => hozirKalit[c.kalit] = 1);
  const hj = await topHalHujjat(asl, ctx.HJ, ctx.mlM, ctx.bekorNo, quruq);   // v2.0: hujjat — tekshiruvga
  let yopildi = hj.n; const yop = hj.yop.slice();
  for (const t of asl.L.filter(z => z.kalit && z.holati === 'Jarayonda' && !TS.topHjTur(z))) {
    const sabab = topHal(t, ctx, hozirKalit); if (!sabab) continue;
    yop.push({ id: t.id, holat: 'Bajarildi', kim: 'tizim', dalil: sabab }); yopildi++;
    if (!quruq) await TP.topYop(TOP_V, t, 'Bajarildi', 'tizim', sabab);
  }
  if (quruq) return { ok: true, yangi, yop, nomzod: C.length, band: C.filter(c => !yangi.some(y => y.kalit === c.kalit)).length };
  // tgTugmaOrnat_ — faqat Apps Script (eski trigger o'zi o'rnatadi). skanNazTekshir_ — eski tizimning o'zi (Koprik v1.12), xato e'tiborsiz
  let skanNaz = null;
  // 23.10: vaqt_yondi:skan_naz yoqilgan bo'lsa — serverning o'zi har 10 daqiqada (lib/tg_ishlar.js), eski koprikSkanNaz chaqirilmaydi (ikki marta ketmasin)
  let snServer = false; try { snServer = (await BQ.vaqt('skan_naz')); } catch (e) { }
  try { if (!snServer && await koprik112(kod)) skanNaz = (await koprik.chaqir('koprikSkanNaz', kod, [], { muddat: 90000, urinish: 1 }) || {}).n; } catch (e) { console.error('koprikSkanNaz:', e.message); }
  if (hj.tg.length) tasdiqTg(kod, hj.tg);
  if (yangi.length) TP.topTg(kod, yangi, XD);
  return { ok: true, yangi: yangi.length, yopildi, skanNaz };
}
let kv = { ok: false, t: 0 };
async function koprik112(kod) {
  if (kv.t && Date.now() - kv.t < (kv.ok ? 30 : 2) * 60000) return kv.ok;
  try { kv = { ok: koprik.bor() && require('../lib/versiya').verOk(await koprik.chaqir('koprikVersiya', kod, []), '1.12'), t: Date.now() }; } catch (e) { kv = { ok: false, t: Date.now() }; }
  return kv.ok;
}

// ------------------------------------------------------------------ topMening ichidagi topHalHujjat_ (Topshiriq.gs v2.2: xodim «📌 Topshiriqlarim» ni ochganda
// uning ochiq hujjat topshiriqlari — hujjat yuklangan bo'lsa darhol «Tekshiruvda», JSHSHIR kiritilgan bo'lsa «Bajarildi»; bekor qilingan shartnoma — tekshirilmaydi,
// eski tizimdagidek). 10 / 06d / 02 — Google'dan YANGI. Qaytaradi: yopilganlar soni; null — server qila olmaydi (bayroq yo'q, qulf band, yozish huquqi yo'q) → eski tizim.
// opt.quruq — yozmaydi (sinov): { n, yop, tg }
async function topMeningYop(u, opt = {}) {
  const quruq = !!opt.quruq;
  if (!quruq) {
    try { if (!(await BQ.yozuv('top_mening'))) return null; } catch (e) { return null; }
    if (!(await require('./qadam_hujjat')._ichki.koprik17(u.kod))) return null;   // koprikTopTasdiqTg
  }
  const { xodimTeng } = require('../lib/xodim');
  const meniki = t => xodimTeng(t.kimga, u.fish);
  const ish = async () => {
    const R = await TP.topRowsYangi(TOP_V);
    const QH = require('./qadam_hujjat')._ichki;
    const HJ = await QH.hjYangi();
    const mlM = R.L.some(t => t.holati === 'Jarayonda' && meniki(t) && TS.topHjTur(t) === 'JSHSHIR') ? await QH.mlYangi() : {};
    try { return await topHalHujjat(R, HJ, mlM, null, quruq, meniki); }
    catch (e) { if (e.yozilmadi) return { yoq: true }; throw e; }
  };
  const r = quruq ? await ish() : await qulfUrin(ish);
  if (r === null || r.yoq) return null;
  if (quruq) return r;
  if (r.tg.length) tasdiqTg(u.kod, r.tg);
  if (r.n) await yangila([TOP_V]);
  return r.n;
}

// ------------------------------------------------------------------ topHozir(kod) — direktor: «🤖 Hozir tekshirish»
async function topHozir(args) {
  const [kodSes] = args;
  const u = await S.ruxsat(kodSes, 'admin');
  if (!(await serverda(u.kod))) return eskiTizim('topHozir', u, []);
  let yoq = false;
  const r = await qulfUrin(async () => {
    try { return await topAvto(u.kod); }
    catch (e) { if (e.yozilmadi) { yoq = true; return null; } throw e; }
  });
  if (yoq) return eskiTizim('topHozir', u, []);   // robotda yozish huquqi yo'q
  if (r === null) return { ok: false, xato: 'band' };   // tryLock(20000) muvaffaqiyatsiz — eski tizimdagi javob
  await yangila([TOP_V, HUJ_V]);
  return { ok: true, yangi: r.yangi, yopildi: r.yopildi };
}

module.exports = { topHozir };
module.exports._ichki = { topAvto, topCtx, topHal, topHalHujjat, topMeningYop, qulfUrin, TOP_V };
