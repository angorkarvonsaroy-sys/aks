// AKS TIZIM — 📦 Ta'minotning YOZADIGAN amallari serverda (Taminot.gs v26.11 bilan bir xil tekshiruvlar, xato matnlari va kataklar):
//   taminotKiritish — ta'minotchi keltirgan mahsulotlar → 09_Taminot oxiriga (Holati «Kutilmoqda»)
//   taminotTasdiq   — direktor partiyani (yoki tanlangan mahsulotlarni) tasdiqlaydi / rad etadi → 09_Taminot N, O, P
// Telegram (direktorga, tgYubor_) — eski tizim orqali, kutilmaydi (Koprik.gs v1.5 → koprikTgYubor).
// Yozish faqat «aks-yozuv-sinov taminot» nusxa varaqda tekshirgach yoqiladi (Redis: yozuv_yondi:taminot) va Koprik v1.5 bo'lsa.
// Aks holda, yoki robotda yozish huquqi bo'lmasa — amal avvalgidek eski tizim orqali bajariladi.
// taminotFirmaQosh, taminotTolov, taminotTilxat, taminotDalolatnoma — hali eski tizimda (Drive fayllari).
'use strict';
const { verOk } = require('../lib/versiya');
const crypto = require('crypto');
const S = require('./sessiya');
const V = require('../lib/varaq');
const G = require('../lib/google');
const env = require('../lib/env');
const koprik = require('./koprik');
const tetik = require('../lib/kozgu_tetik');
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

module.exports = { taminotKiritish, taminotTasdiq, taminotTolov };
module.exports._ichki = { kiritishYoz, tasdiqYoz, qatorlarYangi, tamPul, TAM_V, koprik15 };
