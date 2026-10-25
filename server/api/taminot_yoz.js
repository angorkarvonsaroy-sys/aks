// AKS TIZIM — 📦 Ta'minotning YOZADIGAN amallari serverda (Taminot.gs v26.11 bilan bir xil tekshiruvlar, xato matnlari va kataklar):
//   taminotKiritish — ta'minotchi keltirgan mahsulotlar → 09_Taminot oxiriga (Holati «Kutilmoqda»)
//   taminotTasdiq   — direktor partiyani (yoki tanlangan mahsulotlarni) tasdiqlaydi / rad etadi → 09_Taminot N, O, P
// Telegram (direktorga, tgYubor_) — eski tizim orqali, kutilmaydi (Koprik.gs v1.5 → koprikTgYubor).
// Yozish faqat «aks-yozuv-sinov taminot» nusxa varaqda tekshirgach yoqiladi (Redis: yozuv_yondi:taminot) va Koprik v1.5 bo'lsa.
// Aks holda, yoki robotda yozish huquqi bo'lmasa — amal avvalgidek eski tizim orqali bajariladi.
//   taminotFirmaQosh — yangi yuridik ta'minotchi → 09c_Taminotchilar_yuridik oxiriga (Holati «Faol»)
//   taminotTilxat    — naqd pul tilxati (PDF; jadvalga ham, Drive'ga ham yozmaydi)
//   taminotDalolatnoma — haftalik qabul qilish-topshirish dalolatnomasi (PDF server, Drive — Koprik ≥ 1.20)
'use strict';
const { verOk } = require('../lib/versiya');
const crypto = require('crypto');
const S = require('./sessiya');
const V = require('../lib/varaq');
const G = require('../lib/google');
const env = require('../lib/env');
const koprik = require('./koprik');
const tetik = require('../lib/kozgu_tetik');
const PDF = require('../lib/pdf');
const SH = require('../lib/sotuv_hujjat');   // sozBilan, OYLAR — hujjat matnlari uchun
const { redis } = require('../lib/db');
const T = require('./taminot')._ichki;

const TAM_V = '09_Taminot';
const TAM_OLCHOV = ['dona', 'kg', 'qop', 'metr', 'litr', 'pachka', 'komplekt', 'rulon', 'quti', 'tonna'];
const s = v => String(v == null ? '' : v);
const S1 = x => s(x).replace(/\s+/g, ' ').trim();
const tamDMY = iso => { const p = s(iso).split('-'); return p.length === 3 ? p[2] + '.' + p[1] + '.' + p[0] : s(iso); };
// tamPul_: toLocaleString('ru-RU') → oddiy bo'shliqlar bilan
const tamPul = n => { const v = Math.round(Number(n) || 0); return (v < 0 ? '-' : '') + String(Math.abs(v)).replace(/\B(?=(\d{3})+(?!\d))/g, ' '); };
function hozirDmyHm() { const d = new Date(Date.now() + 5 * 3600 * 1000), p = n => String(n).padStart(2, '0');
  return p(d.getUTCDate()) + '.' + p(d.getUTCMonth() + 1) + '.' + d.getUTCFullYear() + ' ' + p(d.getUTCHours()) + ':' + p(d.getUTCMinutes()); }
const kut = (p, ms) => Promise.race([p, new Promise(r => setTimeout(r, ms))]);

// ------------------------------------------------------------------ umumiy
async function qulfBilan(ish) {   // LockService o'rni (ta'minot yozuvlari bir vaqtda bittadan)
  const kalit = 'qulf:taminot', belgi = crypto.randomBytes(8).toString('hex'), t0 = Date.now();
  while (!(await redis.set(kalit, belgi, 'PX', 30000, 'NX'))) { if (Date.now() - t0 > 30000) throw new S.Xato('Tizim band — birozdan keyin qayta urinib ko\'ring.'); await new Promise(r => setTimeout(r, 150)); }
  try { return await ish(); } finally { if ((await redis.get(kalit)) === belgi) await redis.del(kalit); }
}
let kv = { ok: false, t: 0 };
async function koprik15(kod) {   // Koprik.gs v1.5 (koprikTgYubor) o'rnatilganmi — 30 daqiqa kesh (yo'q bo'lsa 2 daqiqa)
  if (kv.t && Date.now() - kv.t < (kv.ok ? 30 : 2) * 60000) return kv.ok;
  try { kv = { ok: koprik.bor() && verOk(await koprik.chaqir('koprikVersiya', kod, []), '1.5'), t: Date.now() }; } catch (e) { kv = { ok: false, t: Date.now() }; }
  return kv.ok;
}
async function serverda(kod) {
  try { if ((await redis.get('yozuv_yondi:taminot')) !== '1') return false; } catch (e) { return false; }
  return koprik15(kod);
}
async function eskiTizim(fn, u, args) { const r = await koprik.chaqir(fn, u.kod, args); await tetik.yangilaKut(20000); return r; }
function tgDirektor(kod, matn) {   // eski tizimda: try { tgYubor_(m) } catch (e) {} — xato e'tiborsiz, xodim kutmaydi
  koprik.chaqir('koprikTgYubor', kod, [matn]).catch(e => console.error('taminot tg (ko\'prik):', e.message));
}
async function ogoh(xab) { try { await redis.lpush('yozuv_ogoh', JSON.stringify(Object.assign({ vaqt: hozirDmyHm() }, xab))); await redis.ltrim('yozuv_ogoh', 0, 49); } catch (e) { } }

// 09_Taminot — Google'dan YANGI (ko'zgu emas): tamRows_ (getDisplayValues, A ustunining oxirgi to'ldirilgan qatorigacha)
async function qatorlarYangi(varaq) {
  const X = await G.oraliqOqi(env.aksBazaId, varaq, 'A2:P', env.googleKey);
  let m = -1; X.forEach((r, i) => { if (s(r[0]) !== '') m = i; });
  const raqam = v => Number(s(v).replace(/\D/g, '')) || 0;
  return X.slice(0, m + 1).map((r0, i) => { const r = []; for (let k = 0; k < 16; k++) r.push(s(r0[k]));
    return { qator: i + 2, id: r[0], partiya: r[1], nom: r[5], taminotchi: r[4], summa: raqam(r[9]), holati: r[13] }; }).filter(x => x.id);
}

// ------------------------------------------------------------------ yozuv yadrosi (sinov ham shuni ishlatadi — nusxa varaqda)
// Kiritish: A, B ustunlarini YANGI o'qib, keyingi ID va partiya raqami; qatorlar oxiriga (append — shu orada boshqa yozuv bo'lsa ustma-ust tushmaydi)
async function kiritishYoz(varaq, fish, sana, tTuri, taminotchi, rows, umIzoh) {
  const X = await G.oraliqOqi(env.aksBazaId, varaq, 'A2:B', env.googleKey, 'UNFORMATTED_VALUE');
  let m = -1; X.forEach((r, i) => { if (r[0] !== '' && r[0] != null) m = i; });
  const l = m + 2;                                        // ustunA_oxiri_
  const Y = X.slice(0, m + 1);
  let id = Y.length ? Math.max(...Y.map(r => Number(r[0]) || 0)) : 0;
  const pn = Y.length ? Math.max(...Y.map(r => Number(s(r[1]).replace(/\D/g, '')) || 0)) : 0;
  const partiya = 'П-' + ('0000' + (pn + 1)).slice(-4);
  const vaqt = hozirDmyHm();
  const bosh = id + 1;
  const out = rows.map(r => [++id, partiya, tamDMY(sana), tTuri, taminotchi, r[0], r[1], r[2], r[3], r[4], [r[5], umIzoh].filter(Boolean).join(' · '), fish, vaqt, 'Kutilmoqda', '', '']);
  let q;
  try { q = await G.qatorlarQoshR(env.aksBazaId, varaq, l + 1, out, env.googleKey); }
  catch (e) { if (e instanceof G.RuxsatYoq) e.yozilmadi = true; throw e; }
  if (q !== l + 1) { console.error(new Date().toISOString(), varaq, ': kutilgan qator ' + (l + 1) + ', yozildi ' + q); await ogoh({ varaq, qator: q, xato: 'kutilgan qator ' + (l + 1) + ' — shu orada boshqa yozuv qo\'shilgan, ID ' + bosh + '… takrorlanmaganini tekshiring' }); }
  return { partiya, qator: q, idBosh: bosh, soni: out.length };
}
// Tasdiq / rad: topilgan har qatorga N (holati), O (kim, vaqt), rad bo'lsa P (sabab) — bitta so'rovda
async function tasdiqYoz(varaq, fish, R, ha, izoh) {
  const vaqt = hozirDmyHm();
  const data = R.map(x => ({ varaq, katak: 'N' + x.qator + ':' + (ha ? 'O' : 'P') + x.qator, qiymat: [ha ? ['Tasdiqlandi', fish + ', ' + vaqt] : ['Rad etildi', fish + ', ' + vaqt, izoh]] }));
  try { await G.yoz(env.aksBazaId, data, env.googleKey); }
  catch (e) { if (e instanceof G.RuxsatYoq) e.yozilmadi = true; throw e; }
}

// ------------------------------------------------------------------ 📦 kiritish
async function taminotKiritish(args) {
  const [kodSes, d0] = args; const d = d0 || {};
  const u = await S.ruxsat(kodSes, 'taminot');
  if (!(await serverda(u.kod))) return eskiTizim('taminotKiritish', u, [d0]);
  const sana = s(d.sana).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(sana)) throw new S.Xato('Sanani tanlang.');
  if (sana > V.bugun()) throw new S.Xato('Sana kelajakda bo\'lishi mumkin emas.');
  const tTuri = d.tTuri === 'Yuridik' ? 'Yuridik' : 'Jismoniy';
  let taminotchi = '';
  if (tTuri === 'Jismoniy') {
    const J = await T.tamJismoniy();
    if (!J.length) throw new S.Xato('07_Xodimlar da «taminot» huquqi bor ishlayotgan xodim yo\'q — direktorga ayting.');
    const tanlov = s(d.jismoniy).trim();
    const x = J.find(z => z.fish === tanlov);
    if (!x) throw new S.Xato('Jismoniy ta\'minotchini ro\'yxatdan tanlang.');
    taminotchi = x.fish;
  }
  if (tTuri === 'Yuridik') {
    const f = (await T.tamFirmalar()).find(x => String(x.id) === String(d.firmaId));
    if (!f) throw new S.Xato('Yuridik firma tanlanmadi — ro\'yxatdan tanlang yoki yangisini qo\'shing.');
    taminotchi = f.nomi;
  }
  const P = Array.isArray(d.poz) ? d.poz : [];
  if (!P.length) throw new S.Xato('Kamida bitta mahsulot qo\'shing.');
  if (P.length > 40) throw new S.Xato('Bitta keltirishda 40 tadan ko\'p pozitsiya bo\'lmaydi.');
  const rows = [];
  P.forEach((p0, i) => {
    const p = p0 || {};
    const nom = S1(p.nom); if (nom.length < 2) throw new S.Xato((i + 1) + '-mahsulot nomini yozing.');
    const ol = TAM_OLCHOV.indexOf(String(p.olchov)) >= 0 ? String(p.olchov) : 'dona';
    const miq = Number(String(p.miqdor).replace(',', '.')) || 0; if (miq <= 0) throw new S.Xato('«' + nom + '» miqdorini yozing.');
    const narx = Math.round(Number(String(p.narx).replace(/[^\d.]/g, '')) || 0); if (narx <= 0) throw new S.Xato('«' + nom + '» narxini yozing.');
    rows.push([nom, ol, miq, narx, Math.round(miq * narx), S1(p.izoh)]);
  });
  let yoq = false;
  const w = await qulfBilan(async () => {
    try { return await kiritishYoz(TAM_V, u.fish, sana, tTuri, taminotchi, rows, S1(d.izoh)); }
    catch (e) { if (e.yozilmadi) { yoq = true; return null; } throw e; }
  });
  if (yoq) return eskiTizim('taminotKiritish', u, [d0]);   // robotda yozish huquqi yo'q — hech narsa yozilmagan
  const jami = rows.reduce((a, r) => a + r[4], 0);
  tgDirektor(u.kod, "📦 <b>Ta'minot</b> — " + u.fish + ': ' + w.partiya + ' (' + taminotchi + '), ' + rows.length + ' pozitsiya, <b>' + tamPul(jami) + "</b> so'm.\nTasdiqlash — ilovada 👔 Direktor → Tasdiqlar.");
  await kut(tetik.varaqlarYangila([TAM_V]).catch(e => console.error('ko\'zgu (ta\'minot):', e.message)), 15000);
  return { ok: true, partiya: w.partiya, soni: rows.length, jami, taminotchi };
}

// ------------------------------------------------------------------ 👔 tasdiq / rad
async function taminotTasdiq(args) {
  const [kodSes, partiya, ha, izoh0, ids] = args;
  const u = await S.ruxsat(kodSes, 'admin');
  if (!(await serverda(u.kod))) return eskiTizim('taminotTasdiq', u, args.slice(1));
  const izoh = s(izoh0).replace(/\s+/g, ' ').trim();
  if (!ha && izoh.length < 5) throw new S.Xato('Rad etish sababini yozing (kamida 5 belgi).');
  let yoq = false;
  const w = await qulfBilan(async () => {
    const IDS = Array.isArray(ids) && ids.length ? ids.map(String) : null;
    const R = (await qatorlarYangi(TAM_V)).filter(x => x.partiya === String(partiya) && x.holati === 'Kutilmoqda' && (!IDS || IDS.indexOf(String(x.id)) >= 0));
    if (!R.length) throw new S.Xato('Tasdiq kutayotgan mahsulot topilmadi (' + partiya + ') — sahifani yangilang.');
    try { await tasdiqYoz(TAM_V, u.fish, R, ha, izoh); }
    catch (e) { if (e.yozilmadi) { yoq = true; return null; } throw e; }
    return { R, IDS };
  });
  if (yoq) return eskiTizim('taminotTasdiq', u, args.slice(1));
  const { R, IDS } = w;
  const jami = R.reduce((a, x) => a + x.summa, 0);
  const nomlar = IDS ? ' [' + R.map(x => x.nom).join(', ') + ']' : '';
  tgDirektor(u.kod, '📦 ' + partiya + nomlar + ' (' + R[0].taminotchi + ', ' + tamPul(jami) + " so'm) — " + (ha ? '✅ tasdiqlandi, qarzga qo\'shildi.' : '✖ rad etildi: «' + izoh + '».'));
  await kut(tetik.varaqlarYangila([TAM_V]).catch(e => console.error('ko\'zgu (ta\'minot):', e.message)), 15000);
  return { ok: true, partiya, ha, jami, soni: R.length, natija: R.length + ' ta mahsulot, ' + tamPul(jami) + " so'm." };
}

// ------------------------------------------------------------------ 💵 taminotTolov (Taminot.gs v26.11) — ta'minotchiga to'lov, isbot PDF majburiy
// 23.10.2026: serverda (yozuv_yondi:taminot + Koprik ≥ 1.19): tekshiruvlar va xato matnlari aynan; 09b qatori server; isbot PDF Drive'ga — Koprik v1.19 koprikTamIsbot
// («06 TAMINOT / ISBOTLAR», shu nomli fayl bo'lsa o'shasi — qayta urinishda nusxa yo'q); direktorga Telegram — server (xato e'tiborsiz). Aks holda — eski tizim.
const TAM_TV = '09b_Taminot_tolovlari';
let kv19 = { ok: false, t: 0 };
async function koprik19(kod) {
  if (kv19.t && Date.now() - kv19.t < (kv19.ok ? 30 : 2) * 60000) return kv19.ok;
  try { kv19 = { ok: koprik.bor() && verOk(await koprik.chaqir('koprikVersiya', kod, []), '1.19'), t: Date.now() }; } catch (e) { kv19 = { ok: false, t: Date.now() }; }
  return kv19.ok;
}
const raqamT = v => Number(s(v).replace(/\D/g, '')) || 0;
async function taminotTolov(args) {
  const [kodSes, d0] = args; const d = d0 || {};
  const u = await S.ruxsat(kodSes, 'admin');
  if (!(await serverda(u.kod)) || !(await koprik19(u.kod))) return eskiTizim('taminotTolov', u, [d0]);
  const tTuri = d.tTuri === 'Yuridik' ? 'Yuridik' : 'Jismoniy';
  const taminotchi = s(d.taminotchi).trim();
  if (!taminotchi) throw new S.Xato('Ta\'minotchi tanlanmadi.');
  const summa = Math.round(Number(s(d.summa).replace(/[^\d.]/g, '')) || 0);
  if (summa <= 0) throw new S.Xato('Summani yozing.');
  const sana = s(d.sana).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(sana)) throw new S.Xato('Sanani tanlang.');
  if (sana > V.bugun()) throw new S.Xato('Sana kelajakda bo\'lishi mumkin emas.');
  const usul = ['Naqd', 'Bank', 'Plastik'].indexOf(s(d.usul)) >= 0 ? s(d.usul) : 'Naqd';
  const bayt = Buffer.from(s(d.b64), 'base64');
  if (bayt.length < 1000) throw new S.Xato('ISBOT MAJBURIY: ' + (tTuri === 'Jismoniy' ? 'imzolangan tilxat skanini' : "to'lov hujjati skanini") + ' yuklang — isbotsiz to\'lov saqlanmaydi.');
  if (bayt.slice(0, 5).toString('latin1') !== '%PDF-') throw new S.Xato('Isbot fayli PDF emas — kameradan skanerlang yoki PDF tanlang.');
  const tilxat = s(d.tilxat).trim(), izoh = s(d.izoh).trim();
  const w = await qulfBilan(async () => {
    const [R9, R9b] = await Promise.all([G.oraliqOqi(env.aksBazaId, TAM_V, 'A2:P', env.googleKey), G.oraliqOqi(env.aksBazaId, TAM_TV, 'A2:L', env.googleKey)]);
    const k = tTuri + '|' + taminotchi, h = { kelt: 0, tolan: 0 };
    R9.forEach(r => { if (s(r[0]) && s(r[13]) === 'Tasdiqlandi' && s(r[3]) + '|' + s(r[4]) === k) h.kelt += raqamT(r[9]); });
    let m = -1; R9b.forEach((r, i) => { if (s(r[0]) !== '') m = i; });
    const Y = R9b.slice(0, m + 1);
    Y.forEach(r => { if (s(r[0]) && s(r[2]) + '|' + s(r[3]) === k) h.tolan += raqamT(r[4]); });
    const id = (Y.length ? Math.max(...Y.map(r => Number(s(r[0]).replace(/\D/g, '')) || 0)) : 0) + 1, l = m + 2;
    const nom = 'Tolov_' + tamDMY(sana).replace(/\./g, '-') + '_' + taminotchi.replace(/[\\/:*?"<>|]/g, ' ').slice(0, 40) + '_' + id + '.pdf';
    const f = await koprik.chaqir('koprikTamIsbot', u.kod, [{ nom, b64: bayt.toString('base64') }], { muddat: 120000 });
    if (!f || !f.id) throw new S.Xato('Isbot fayli Drive\'ga saqlanmadi — qayta urinib ko\'ring.');
    const q = await G.qatorQoshR(env.aksBazaId, TAM_TV, l + 1, [id, tamDMY(sana), tTuri, taminotchi, summa, usul, tilxat, nom, f.id, u.fish, hozirDmyHm(), izoh], env.googleKey)
      .catch(e => { if (e instanceof G.RuxsatYoq) throw new S.Xato('Robotda jadvalga yozish huquqi yo\'q — isbot fayli saqlandi (' + nom + '), direktorga ayting.'); throw e; });
    if (q !== l + 1) await ogoh({ varaq: TAM_TV, qator: q, xato: 'kutilgan qator ' + (l + 1) + ' — shu orada boshqa yozuv qo\'shilgan (to\'lov ID ' + id + ')' });
    return { id, nom, qoldiq: h.kelt - h.tolan - summa };
  });
  tgDirektor(u.kod, "💵 Ta'minotchiga to'lov: " + taminotchi + ', <b>' + tamPul(summa) + "</b> so'm (" + usul + (tilxat ? ', ' + tilxat : '') + '). Isbot ✅. Qoldiq qarz: <b>' + tamPul(w.qoldiq) + '</b>.');
  await kut(tetik.varaqlarYangila([TAM_TV]).catch(e => console.error('ko\'zgu (09b):', e.message)), 15000);
  return { ok: true, id: w.id, summa, qoldiq: w.qoldiq, nom: w.nom };
}

// ------------------------------------------------------------------ 🏢 taminotFirmaQosh(kod, d) — yangi yuridik ta'minotchi (09c)
// Taminot.gs v26.11 taminotFirmaQosh bilan bir xil: «taminot» huquqi, nom ≥ 3 belgi, nom takrorlanmasin («Bekor» lar hisobga olinmaydi),
// ID — ustundagi eng katta raqamdan keyingisi (bekor qilinganlar ham hisobda), qator oxiriga, Holati «Faol».
// Varaq bo'lmasa — eski tizim o'zi yasaydi (server varaq yaratmaydi).
const TAM_FV = '09c_Taminotchilar_yuridik';
const TAM_S3 = ['ID', 'Nomi', 'Direktor', 'STIR', 'Hisob_raqam', 'Bank', 'MFO', 'Manzil', 'Telefon', 'Holati'];
const toza = x => s(x).replace(/\s+/g, ' ').trim();

async function firmaXom() {   // tamFirmalar_ manbai — Google'dan YANGI (A2:J)
  const X = await G.oraliqOqi(env.aksBazaId, TAM_FV, 'A2:J', env.googleKey);
  let m = -1; X.forEach((r, i) => { if (s(r[0]) !== '') m = i; });
  const R = X.slice(0, m + 1).map((r0, i) => { const r = []; for (let k = 0; k < TAM_S3.length; k++) r.push(s(r0[k])); return { qator: i + 2, r }; }).filter(z => z.r[0]);
  return { R, oxirgi: m + 2 };   // oxirgi to'ldirilgan qator (ustunA_oxiri_); bo'sh bo'lsa 1
}
function firmaBor(R, nomi) { const n = nomi.toLowerCase(); return R.some(z => z.r[9] !== 'Bekor' && z.r[1].toLowerCase() === n); }

async function taminotFirmaQosh(args) {
  const [kodSes, d0] = args;
  const u = await S.ruxsat(kodSes, 'taminot');
  const d = d0 || {};
  const nomi = toza(d.nomi);
  if (nomi.length < 3) throw new S.Xato('Firma nomini yozing.');
  if (!(await serverda(u.kod))) return eskiTizim('taminotFirmaQosh', u, [d0]);
  try { const z = await firmaXom(); if (firmaBor(z.R, nomi)) throw new S.Xato('Bu firma ro\'yxatda bor: ' + nomi); }
  catch (e) { if (e instanceof S.Xato) throw e; return eskiTizim('taminotFirmaQosh', u, [d0]); }   // varaq yo'q yoki o'qib bo'lmadi
  const r = await qulfBilan(async () => {
    const { R, oxirgi } = await firmaXom();                       // qulf ostida yana bir marta — shu orada qo'shilgan bo'lsa
    if (firmaBor(R, nomi)) throw new S.Xato('Bu firma ro\'yxatda bor: ' + nomi);
    const id = R.reduce((m, z) => Math.max(m, Number(z.r[0]) || 0), 0) + 1;
    const qator = [id, nomi, toza(d.direktor), toza(d.stir), toza(d.hr), toza(d.bank), toza(d.mfo), toza(d.manzil), toza(d.tel), 'Faol'];
    let q;
    try { q = await G.qatorQoshR(env.aksBazaId, TAM_FV, oxirgi + 1, qator, env.googleKey); }
    catch (e) { if (e instanceof G.RuxsatYoq) e.yozilmadi = true; throw e; }
    if (q !== oxirgi + 1) { console.error(new Date().toISOString(), TAM_FV, ': kutilgan qator ' + (oxirgi + 1) + ', yozildi ' + q);
      await ogoh({ varaq: TAM_FV, qator: q, xato: 'kutilgan qator ' + (oxirgi + 1) + ' — shu orada boshqa firma qo\'shilgan, ID ' + id + ' takrorlanmaganini tekshiring' }); }
    return { ok: true, id, nomi };
  }).catch(e => { if (e.yozilmadi) return null; throw e; });
  if (!r) return eskiTizim('taminotFirmaQosh', u, [d0]);          // robotda yozish huquqi yo'q — hech narsa yozilmagan
  await kut(tetik.varaqlarYangila([TAM_FV]).catch(e => console.error('ko\'zgu (09c):', e.message)), 15000);
  return r;
}

// ------------------------------------------------------------------ 🧾 taminotTilxat(kod, taminotchi, summa) — naqd pul tilxati (PDF)
// Taminot.gs v26.11 bilan bir xil: faqat direktor, raqam «ТХ-<yil>/NNNN» (09b G ustunidagi eng katta raqamdan keyingisi),
// ism — 07_Xodimlar C ustunidagi to'liq kirill F.I.Sh. (bo'lmasa B), matn, imzo joylari va HTML uslubi aynan.
// Jadvalga ham, Drive'ga ham HECH NARSA YOZILMAYDI — faqat PDF qaytariladi (eski tizimda ham shunday edi).
// PDF: Google HTML→PDF o'rniga server Chromium'i (lib/pdf.js), A4; chekkalar HTML ning o'zida (body margin).
const TAM_MCHJ = '«ANGOR KARVON SAROY» МЧЖ', TAM_DIREKTOR = 'ҲАЙДАРОВ КАМОЛИДДИН';
const tamEsc = v => s(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
function tamHtmlBosh() {
  return '<!DOCTYPE html><html><head><meta charset="utf-8"><style>' +
    'body{font-family:"Liberation Serif","Times New Roman",serif;font-size:14px;line-height:1.55;color:#000;margin:36px 44px}' +
    'h1{text-align:center;font-size:16px;margin:0 0 2px}.sub{text-align:center;font-size:13px;margin-bottom:14px}' +
    '.sana{display:flex;justify-content:space-between;margin:12px 0}' +
    'p{text-align:justify;text-indent:28px;margin:8px 0}' +
    'table{width:100%;border-collapse:collapse;font-size:12.5px;margin:10px 0}td,th{border:1px solid #000;padding:5px 7px}th{background:#efefef}' +
    '.r{text-align:right}.c{text-align:center}' +
    '.imzo{display:flex;justify-content:space-between;margin-top:34px;gap:26px}.imzo>div{width:48%;font-size:12.5px;line-height:1.6}' +
    '.k{font-size:11px}</style></head><body>';
}
const sanaSoz = dmy => '«' + dmy.slice(0, 2) + '» ' + SH.OYLAR[Number(dmy.slice(3, 5)) - 1] + ' ' + dmy.slice(6) + ' йил';
// tamJismoniy_ + tamToliq_: «taminot» huquqi bor, ishlayotgan xodim — C (to'liq F.I.Sh.), bo'lmasa B
async function tamToliqIsm(fish) {
  const X = await G.oraliqOqi(env.aksBazaId, '07_Xodimlar', 'A2:S', env.googleKey);
  const R = X.map(r0 => { const r = []; for (let k = 0; k < 19; k++) r.push(s(r0[k])); return r; });
  const j = R.find(r => r[1].trim() && r[10].trim() === 'Ishlayapti'
    && r[18].toLowerCase().split(',').map(z => z.trim()).indexOf('taminot') >= 0 && r[1].trim() === fish);
  if (j && j[2].trim()) return j[2].trim().toUpperCase();
  const r2 = R.find(r => r[1].trim() === fish);
  return s((r2 && r2[2]) || fish).toUpperCase();
}
async function tilxatRaqam() {
  const X = await G.oraliqOqi(env.aksBazaId, TAM_TV, 'A2:G', env.googleKey);
  let m = -1; X.forEach((r, i) => { if (s(r[0]) !== '') m = i; });
  const yil = String(new Date(Date.now() + 5 * 3600 * 1000).getUTCFullYear());
  const nmax = X.slice(0, m + 1).reduce((a2, r) => { const z = /(\d{4})$/.exec(s(r[6])); return Math.max(a2, z ? Number(z[1]) : 0); }, 0);
  return 'ТХ-' + yil + '/' + ('0000' + (nmax + 1)).slice(-4);
}

async function taminotTilxat(args) {
  const [kodSes, taminotchi0, summa0] = args;
  const u = await S.ruxsat(kodSes, 'admin');
  const taminotchi = s(taminotchi0).trim();
  const summa = Math.round(Number(s(summa0).replace(/[^\d.]/g, '')) || 0);
  if (!taminotchi || summa <= 0) throw new S.Xato('Ta\'minotchi va summani kiriting.');
  if (!(await serverda(u.kod)) || !(await PDF.bor())) return eskiTizim('taminotTilxat', u, [taminotchi0, summa0]);
  let raqam, ism;
  try { [raqam, ism] = await Promise.all([tilxatRaqam(), tamToliqIsm(taminotchi)]); }
  catch (e) { console.error('tilxat (o\'qish):', e.message); return eskiTizim('taminotTilxat', u, [taminotchi0, summa0]); }
  const sana = hozirDmyHm().slice(0, 10);
  const html = tamHtmlBosh() +
    '<h1>ТИЛХАТ</h1><div class="sub">№ ' + raqam + '</div>' +
    '<div class="sana"><span>Ангор тумани</span><span>' + sanaSoz(sana) + '</span></div>' +
    '<p>Мен, <b>' + tamEsc(ism) + '</b>, ' + TAM_MCHJ + ' дан етказиб берган маҳсулотларим ҳисобидан нақд пул кўринишида <b>' + tamPul(summa) + '</b> (' + SH.sozBilan(summa) + ') сўм 00 тийин олдим.</p>' +
    '<p>Олинган сумма бўйича даъвом йўқ.</p>' +
    '<div class="imzo"><div>Пулни олдим:<br><br>_______________ ' + tamEsc(ism) + '<br><span class="k">(имзо)</span></div>' +
    '<div>Пулни берди:<br>' + TAM_MCHJ + '<br><br>_______________ ' + TAM_DIREKTOR.split(' ')[0] + ' К.<br><span class="k">(имзо)</span></div></div></body></html>';
  let pdf;
  try { pdf = await PDF.yasa(html, '', { format: 'A4', printBackground: true, margin: { top: '0', right: '0', bottom: '0', left: '0' } }); }
  catch (e) { console.error('tilxat (PDF):', e.message); return eskiTizim('taminotTilxat', u, [taminotchi0, summa0]); }
  return { ok: true, raqam, b64: pdf.toString('base64'), nom: 'Tilxat_' + raqam.replace('/', '-') + '.pdf', mime: 'application/pdf' };
}

// ------------------------------------------------------------------ 📄 taminotDalolatnoma(kod, bosh, oxir) — haftalik qabul qilish-topshirish dalolatnomasi
// Taminot.gs v26.11 bilan bir xil: faqat direktor, davr tekshiruvi (3 oydan oshmasin), davrdagi «Tasdiqlandi» keltirishlar
// T_turi|Ta'minotchi bo'yicha guruhlanadi, har guruhga alohida dalolatnoma: raqam «ТД-<yil>/NNNN» (09d A ustunidan),
// PDF → Drive «06 TAMINOT / DALOLATNOMALAR», 09d ga qator (Raqam, Sana, Davr, T_turi, Taminotchi, Pozitsiya, Summa, Fayl_ID, Kim).
// PDF serverda yasaladi (lib/pdf.js), Drive'ga Koprik qo'yadi (koprikTamIsbot, qism «DALOLATNOMALAR» — Koprik ≥ 1.20).
// Koprik eski bo'lsa yoki PDF dasturi yo'q bo'lsa — amal butunligicha eski tizimda bajariladi.
const TAM_AV = '09d_Taminot_dalolatnomalari';
let kv120 = { ok: false, t: 0 };
async function koprik120(kod) {
  if (kv120.t && Date.now() - kv120.t < (kv120.ok ? 30 : 2) * 60000) return kv120.ok;
  try { kv120 = { ok: koprik.bor() && verOk(await koprik.chaqir('koprikVersiya', kod, []), '1.20'), t: Date.now() }; } catch (e) { kv120 = { ok: false, t: Date.now() }; }
  return kv120.ok;
}
function tamDavrTekshir(bosh, oxir) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s(bosh)) || !/^\d{4}-\d{2}-\d{2}$/.test(s(oxir))) throw new S.Xato('Davr sanalarini tanlang.');
  if (bosh > oxir) throw new S.Xato('Davr boshi oxiridan keyin bo\'lmasin.');
  if ((new Date(oxir + 'T00:00:00Z') - new Date(bosh + 'T00:00:00Z')) / 86400000 > 92) throw new S.Xato('Davr 3 oydan oshmasin.');
}
const tamIsoDan = dmy => { const p2 = s(dmy).split('.'); return p2.length === 3 ? p2[2] + '-' + p2[1] + '-' + p2[0] : ''; };
// tamAktHtml_ — matn, jadval va imzo bloklari aynan eski kodnikidek
function tamAktHtml(raqam, bugun, bosh, oxir, tTuri, taminotchi, f, P, jami) {
  const T = tamEsc(s(taminotchi).toUpperCase());
  const pre = tTuri === 'Yuridik'
    ? 'Биз, қуйида имзо чекувчилар: ' + TAM_MCHJ + ' номидан директор <b>' + TAM_DIREKTOR + '</b> («Қабул қилувчи») ва <b>' + T + '</b> номидан ' + (f && f.direktor ? 'директор <b>' + tamEsc(s(f.direktor).toUpperCase()) + '</b>' : 'ваколатли вакили') + ' («Топширувчи») ушбу далолатномани туздик:'
    : 'Биз, қуйида имзо чекувчилар: ' + TAM_MCHJ + ' номидан директор <b>' + TAM_DIREKTOR + '</b> («Қабул қилувчи») ва таъминотчи <b>' + T + '</b> («Топширувчи») ушбу далолатномани туздик:';
  let jad = '<table><tr><th class="c" style="width:30px">№</th><th>Маҳсулот номи</th><th class="c" style="width:62px">Ўлчов</th><th class="c" style="width:70px">Миқдор</th><th class="r" style="width:90px">Нархи, сўм</th><th class="r" style="width:105px">Суммаси, сўм</th></tr>';
  P.forEach((x, i) => { jad += '<tr><td class="c">' + (i + 1) + '</td><td>' + tamEsc(x.nom) + '</td><td class="c">' + tamEsc(x.olchov) + '</td><td class="c">' + x.miqdor + '</td><td class="r">' + tamPul(x.narx) + '</td><td class="r">' + tamPul(x.summa) + '</td></tr>'; });
  jad += '<tr><td colspan="5"><b>ЖАМИ:</b></td><td class="r"><b>' + tamPul(jami) + '</b></td></tr></table>';
  const imzoT = tTuri === 'Yuridik'
    ? '<b>ТОПШИРДИ:</b><br>' + T + (f ? (f.stir ? '<br>СТИР: ' + tamEsc(f.stir) : '') + (f.hr ? '<br>Ҳ/р: ' + tamEsc(f.hr) : '') + (f.bank ? '<br>' + tamEsc(f.bank) + (f.mfo ? ', МФО ' + tamEsc(f.mfo) : '') : '') + (f.manzil ? '<br>Манзил: ' + tamEsc(f.manzil) : '') : '') + '<br><br>' + (f && f.direktor ? 'Директор ' : '') + '_______________ ' + (f && f.direktor ? tamEsc(s(f.direktor).toUpperCase()) : T)
    : '<b>ТОПШИРДИ:</b><br>Таъминотчи<br><br><br>_______________ ' + T;
  return tamHtmlBosh() +
    '<h1>ҚАБУЛ ҚИЛИШ-ТОПШИРИШ ДАЛОЛАТНОМАСИ</h1><div class="sub">№ ' + raqam + '</div>' +
    '<div class="sana"><span>Ангор тумани</span><span>' + sanaSoz(bugun) + '</span></div>' +
    '<p>' + pre + '</p>' +
    '<p>Топширувчи <b>' + tamDMY(bosh) + ' — ' + tamDMY(oxir) + '</b> даври мобайнида қуйидаги маҳсулотларни етказиб берди, Қабул қилувчи уларни сони ва сифати бўйича текшириб қабул қилиб олди:</p>' +
    jad +
    '<p><b>Жами сумма (сўз билан):</b> ' + SH.sozBilan(jami) + ' сўм 00 тийин.</p>' +
    '<p>Маҳсулотлар «ANGOR KARVON SAROY» савдо мажмуаси эҳтиёжлари учун қабул қилинди. Тарафларнинг бир-бирига ушбу далолатнома бўйича эътирози йўқ. Далолатнома икки нусхада тузилди.</p>' +
    '<div class="imzo"><div>' + imzoT + '<br><span class="k">(имзо)</span></div>' +
    '<div><b>ҚАБУЛ ҚИЛДИ:</b><br>' + TAM_MCHJ + '<br>директори<br><br>_______________ ҲАЙДАРОВ К.<br><span class="k">(имзо)</span></div></div></body></html>';
}

async function taminotDalolatnoma(args) {
  const [kodSes, bosh, oxir] = args;
  const u = await S.ruxsat(kodSes, 'admin');
  tamDavrTekshir(bosh, oxir);
  if (!(await serverda(u.kod)) || !(await PDF.bor()) || !(await koprik120(u.kod))) return eskiTizim('taminotDalolatnoma', u, [bosh, oxir]);
  const [R9, R9c] = await Promise.all([
    G.oraliqOqi(env.aksBazaId, TAM_V, 'A2:P', env.googleKey),
    G.oraliqOqi(env.aksBazaId, TAM_FV, 'A2:J', env.googleKey).catch(() => [])]);
  const R = R9.map((r0, i) => { const r = []; for (let k = 0; k < 16; k++) r.push(s(r0[k]));
      return { qator: i + 2, id: r[0], iso: tamIsoDan(r[2]), tTuri: r[3], taminotchi: r[4], nom: r[5], olchov: r[6], miqdor: r[7],
        narx: Number(r[8].replace(/\D/g, '')) || 0, summa: Number(r[9].replace(/\D/g, '')) || 0, holati: r[13] }; })
    .filter(x => x.id && x.holati === 'Tasdiqlandi' && x.iso >= bosh && x.iso <= oxir);
  if (!R.length) throw new S.Xato('Bu davrda (' + tamDMY(bosh) + '–' + tamDMY(oxir) + ') tasdiqlangan keltirish yo\'q.');
  const firmalar = R9c.map(r0 => { const r = []; for (let k = 0; k < 10; k++) r.push(s(r0[k]));
      return { id: r[0], nomi: r[1], direktor: r[2], stir: r[3], hr: r[4], bank: r[5], mfo: r[6], manzil: r[7], tel: r[8], holati: r[9] }; })
    .filter(f => f.id && f.holati !== 'Bekor');
  const Gr = {}; R.forEach(x => { (Gr[x.tTuri + '|' + x.taminotchi] = Gr[x.tTuri + '|' + x.taminotchi] || []).push(x); });

  const w = await qulfBilan(async () => {
    const A = await G.oraliqOqi(env.aksBazaId, TAM_AV, 'A2:I', env.googleKey);
    let m = -1; A.forEach((r, i) => { if (s(r[0]) !== '') m = i; });
    let nmax = A.slice(0, m + 1).reduce((a2, r) => { const z = /(\d{4})$/.exec(s(r[0])); return Math.max(a2, z ? Number(z[1]) : 0); }, 0);
    const yil = String(new Date(Date.now() + 5 * 3600 * 1000).getUTCFullYear());
    const bugun = hozirDmyHm().slice(0, 10);
    const fayllar = [], qatorlar = [];
    for (const k of Object.keys(Gr)) {
      const p2 = k.split('|'), tTuri = p2[0], taminotchi = p2[1], P = Gr[k];
      const jami = P.reduce((a2, x) => a2 + x.summa, 0);
      const raqam = 'ТД-' + yil + '/' + ('0000' + (++nmax)).slice(-4);
      const f = tTuri === 'Yuridik' ? firmalar.find(x => x.nomi === taminotchi) : null;
      const ism = tTuri === 'Jismoniy' ? await tamToliqIsm(taminotchi) : taminotchi;
      const pdf = await PDF.yasa(tamAktHtml(raqam, bugun, bosh, oxir, tTuri, ism, f, P, jami), '',
        { format: 'A4', printBackground: true, margin: { top: '0', right: '0', bottom: '0', left: '0' } });
      const nom = 'Dalolatnoma_' + raqam.replace('/', '-') + '_' + taminotchi.replace(/[\\/:*?"<>|]/g, ' ').slice(0, 40) + '.pdf';
      const d = await koprik.chaqir('koprikTamIsbot', u.kod, [{ qism: 'DALOLATNOMALAR', nom, b64: pdf.toString('base64') }], { muddat: 120000 });
      if (!d || !d.id) throw new S.Xato('Dalolatnoma Drive\'ga saqlanmadi (' + raqam + ') — qayta urinib ko\'ring.');
      qatorlar.push([raqam, bugun, tamDMY(bosh) + '–' + tamDMY(oxir), tTuri, taminotchi, P.length, jami, d.id, u.fish]);
      fayllar.push({ raqam, taminotchi, soni: P.length, jami, nom, b64: pdf.toString('base64'), mime: 'application/pdf' });
    }
    const q = await G.qatorlarQoshR(env.aksBazaId, TAM_AV, m + 3, qatorlar, env.googleKey)
      .catch(e => { if (e instanceof G.RuxsatYoq) throw new S.Xato('Robotda jadvalga yozish huquqi yo\'q — dalolatnomalar Drive\'ga saqlandi, 09d ga qo\'lda yozing.'); throw e; });
    if (q !== m + 3) await ogoh({ varaq: TAM_AV, qator: q, xato: 'kutilgan qator ' + (m + 3) + ' — shu orada boshqa dalolatnoma qo\'shilgan' });
    return { fayllar };
  });
  await kut(tetik.varaqlarYangila([TAM_AV]).catch(e => console.error('ko\'zgu (09d):', e.message)), 15000);
  return { ok: true, fayllar: w.fayllar };
}

module.exports = { taminotKiritish, taminotTasdiq, taminotTolov, taminotFirmaQosh, taminotTilxat, taminotDalolatnoma };
module.exports._ichki = { kiritishYoz, tasdiqYoz, qatorlarYangi, tamPul, TAM_V, koprik15 };
