// AKS TIZIM — 🤖 TOPSHIRIQ QOIDALARINI HOZIR TEKSHIRISH: topHozir serverda (Topshiriq.gs v2.2 topAvto bilan bir xil nomzodlar, kalitlar, matnlar,
// mas'ullar, muddatlar, takrorsizlik va avtomatik yopish; 10_Topshiriqlar — Google'dan YANGI, qolgan manbalar — ko'zgu: portfel (lib/portfel.js),
// hujjat svodi (api/monitoring.js monHujjatSvod), 06e, 06h, 03, 04, 02, 05b).
//   Qoidalar: skan · davo · vada · tolov · xat · bekor · pasport · bepul · bufer · skanq (v1.9) — sozlama (TOP_QOIDA) api/topshiriq.js dan.
//   Yangi topshiriq — topYoz (api/topshiriq_yoz.js), xodimga Telegram — topTg (Koprik koprikTgChat).
//   Avtomatik yopish — topHal_ (sabab bartaraf bo'lsa «Bajarildi», yopdi «tizim») va topHalHujjat_ (hujjat yuklangan — «Tekshiruvda», U «HJ:<id>»,
//   tekshiruvchiga Telegram — Koprik v1.7 koprikTopTasdiqTg; fayl hali serverda (SRV) bo'lsa — Drive'ga ko'chgach).
//   skanNazTekshir_ (v2.1, yangi skanlarning ixtiyoriy nazorati — Script Properties bilan) — eski tizimning o'zi (Koprik v1.12 koprikSkanNaz).
//   tgTugmaOrnat_ (Telegram tugmalari triggeri) — faqat Apps Script'da; eski topAvto triggeri (har 2 soat) uni o'zi o'rnatib turadi — bu yerda yo'q.
// Eski topAvto triggeri (har 2 soatda) ishlayveradi — ikkalasi bitta qoidalar bilan, shuning uchun bir xil topshiriq ikki marta ochilmaydi (band kalit).
// Yoqilishi: Redis yozuv_yondi:top_avto («aks-yozuv-sinov tophozir») va Koprik ≥ 1.5. Aks holda — eski tizim.
'use strict';
const crypto = require('crypto');
const S = require('./sessiya');
const V = require('../lib/varaq');
const G = require('../lib/google');
const env = require('../lib/env');
const J = require('../lib/jurnallar');
const P = require('../lib/portfel');
const X = require('../lib/xat_yordam');
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
  try { if ((await redis.get('yozuv_yondi:top_avto')) !== '1') return false; } catch (e) { return false; }
  return TP.koprik15(kod);
}
async function eskiTizim(fn, u, args) { const r = await koprik.chaqir(fn, u.kod, args, { muddat: 120000, urinish: 1 }); await tetik.yangilaKut(20000); return r; }
// LockService tryLock(20000) o'rni — topBer bilan bitta qulf (qulf:topshiriq); band bo'lsa null
async function qulfUrin(ish) {
  const kalit = 'qulf:topshiriq', belgi = crypto.randomBytes(8).toString('hex'), t0 = Date.now();
  while (!(await redis.set(kalit, belgi, 'PX', 120000, 'NX'))) { if (Date.now() - t0 > 20000) return null; await new Promise(r => setTimeout(r, 200)); }
  try { return await ish(); } finally { if ((await redis.get(kalit)) === belgi) await redis.del(kalit); }
}

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
    if (/bekor/i.test(s(r[13]))) bekorNo[no] = 1; else (mijozShar[mid[no]] = mijozShar[mid[no]] || []).push({ no, kim: s(r[17]) }); });
  aOxiri(R4).forEach(({ x }) => { const no = s(x[0]).trim(); if (!no) return; mid[no] = s(x[5]).trim(); ijOylik[no] = Number(x[14]) || 0;
    const bek = /bekor/i.test(s(x[2])); if (bek) { bekorNo[no] = 1; return; }
    (mijozShar[mid[no]] = mijozShar[mid[no]] || []).push({ no, kim: s(x[20]) });
    const bt = isoX(x[28]); if (bt && bt >= bugun && (new Date(bt + 'T12:00:00Z') - d0) / 86400000 <= 30 && !(Number(x[14]) > 0))
      bepul.push({ no, fish: s(x[23]), tugash: dmy(bt), qolgan: Math.round((new Date(bt + 'T12:00:00Z') - d0) / 86400000), kim: s(x[20]) }); });
  // pasport (faqat faol shartnomasi borlar)
  const pasport = [];
  aOxiri(R2).forEach(({ x }) => { const m = s(x[0]).trim(); if (!m || !mijozShar[m] || typeof x[10] !== 'number') return;
    const mud = isoX(x[10]); if (!mud) return;
    const q = Math.round((new Date(mud + 'T12:00:00Z') - d0) / 86400000); if (q <= 30 && q > -3650) { const sh = mijozShar[m][0]; pasport.push({ mid: m, fish: s(x[2]), muddat: dmy(mud), qolgan: q, no: sh.no, kim: sh.kim || (PN[sh.no] || {}).undiruvchi || '' }); } });
  // bufer
  const bufer = [];
  aOxiri(R5).forEach(({ r }) => { if (r[0] && s(r[6]) === 'Буферда' && /MUDDATI O'TDI/i.test(s(r[11]))) bufer.push({ id: s(r[0]), sana: s(r[1]), no: s(r[2]), summa: Number(s(r[3]).replace(/\s/g, '').replace(',', '.')) || 0 }); });
  return { mlM, HJ: SV.jurnal || [], P: Pl, PN, skansiz: SV.nusxasiz || [], skanBor, X: Xj, B, mid, bekorNo, ijOylik, bepul, pasport, bufer,
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
  if (q === 'pasport') return hozir[t.kalit] ? '' : 'pasport yangilandi';
  if (q === 'bepul') return ctx.bekorNo[id] ? 'shartnoma bekor qilingan' : (ctx.ijOylik[id] > 0 ? 'pullik ijara kiritildi' : '');
  if (q === 'bufer') return hozir[t.kalit] ? '' : 'buferdan chiqarildi';
  if (q === 'otkaz') return t.kalit.split('|')[2] < ctx.kunOldin(0) ? 'kun tugadi — javob berilmadi' : '';   // v1.5
  if (q === 'muhlat') return t.kalit.split('|')[2] < ctx.kunOldin(0) ? 'so\'ralgan sana o\'tdi — javob berilmadi' : '';   // v1.6
  if (q === 'malumot') { const p = t.kalit.split('|'); if (ctx.bekorNo[p[1]]) return 'shartnoma bekor qilingan';   // v1.4
    return ((ctx.mlM || {})[t.mid || ctx.mid[p[1]]] || {})[p[2]] ? 'ma\'lumot bazaga kiritildi' : ''; }
  return '';
}
// topHalHujjat_: ochiq hujjat topshiriqlari — JSHSHIR kiritilgan bo'lsa «Bajarildi»; hujjat yuklangan bo'lsa «Tekshiruvda» (+ U «HJ:<id>», tekshiruvchiga Telegram);
// shartnoma bekor qilingan bo'lsa «Bajarildi». quruq — yozmaydi, faqat ro'yxat. Qaytaradi { n, yop: [{id, holat, dalil}], tg: [{id, h}] }
async function topHalHujjat(R, HJ, mlM, bekorNo, quruq) {
  const H = R.L.filter(t => t.holati === 'Jarayonda' && TS.topHjTur(t) && TS.topHjTur(t) !== 'MANZIL' && TS.topHjTur(t) !== 'BOSHQA');
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
    if (x.davoXavf && !x.yuSorov) nomzod('davo', x.no, "Da'vo muddati yaqin — ogohlantirish yoki yuristga o'tkazish", x.fish + ' · ' + x.davoQolgan + ' kun qoldi · qarz ' + pul(x.jami), x.no, x.mijozId || ctx.mid[x.no], x.undiruvchi);
    if (x.bugunVada) nomzod('vada', x.no + '|' + (x.vada ? x.vada.sana : ''), "Va'da sanasi — mijoz bilan bog'laning", x.fish + ' · va\'da ' + (x.vada ? pul(x.vada.summa) + ' so\'m' : ''), x.no, x.mijozId || ctx.mid[x.no], x.undiruvchi);
    const k = Number(x.kechikkan) || 0;
    if ((Number(x.muddati) || 0) > 0 && k >= 1 && k <= 30 && !(x.oxirgi && x.oxirgi.sana >= ctx.kunOldin(k))) nomzod('tolov', x.no, "To'lov kechikdi — mijoz bilan bog'laning", x.fish + ' · ' + k + ' kun · muddati o\'tgan ' + pul(x.muddati), x.no, x.mijozId || ctx.mid[x.no], x.undiruvchi);
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
  // 9 bufer
  ctx.bufer.forEach(b => nomzod('bufer', b.id, 'Bufer to\'lovni kirim qiling yoki qaytaring', b.no + ' · ' + pul(b.summa) + ' so\'m · ' + b.sana, b.no, ctx.mid[b.no], ''));

  // --- yaratish (takrorsiz: shu kalit ochiq bo'lsa yoki 7 kun ichida yopilgan bo'lsa — yo'q)
  const yetti = isoKun(Date.now() - 7 * 86400000);
  const band = {}; R.L.forEach(t => { if (!t.kalit) return; if (t.holati === 'Jarayonda' || t.holati === 'Tekshiruvda' || TS.topIso(t.yopildi).slice(0, 10) >= yetti) band[t.kalit] = 1; });
  const yangi = [], asl = { L: R.L.slice() };   // avtomatik yopish — faqat avval bor topshiriqlar (eski: R yaratishdan oldin o'qilgan)
  for (const c of C) {
    if (band[c.kalit]) continue; band[c.kalit] = 1; const k = TP.topKimga(XD, c.raw);
    const o = { manba: 'Tizim', qoida: c.qoida, kalit: c.kalit, sarlavha: c.sarlavha, izoh: c.izoh + (k.egasiz && c.qoida !== 'bufer' ? ' · ⚠ mas\'ul topilmadi — qayta topshiring' : ''), no: c.no, mid: c.mid, kimga: k.fish, kimBerdi: 'tizim', muddat: qosh(cfg[c.qoida].kun), muhim: c.qoida === 'davo' || c.qoida === 'vada' ? 'Shoshilinch' : 'Oddiy' };
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
  try { if (await koprik112(kod)) skanNaz = (await koprik.chaqir('koprikSkanNaz', kod, [], { muddat: 90000, urinish: 1 }) || {}).n; } catch (e) { console.error('koprikSkanNaz:', e.message); }
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
module.exports._ichki = { topAvto, topCtx, topHal, topHalHujjat, TOP_V };
