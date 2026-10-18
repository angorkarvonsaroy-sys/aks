// AKS TIZIM — ▶ «Bugungi ish» dagi qolgan undiruvchi amallari serverda (Qadam.gs v2.2 bilan bir xil tekshiruvlar, xato matnlari, javob va kataklar):
//   qadamXatBekor — ✕ eskirgan xatni bekor qilish (server xatBekor) + mijozning yangi holati
//   qadamSkan     — 📎 imzolangan shartnoma skani (server hujjatYukla) + shu shartnoma topshiriqlari (topHujjatYopTez_) + yangi holat
//   qadamHujjat   — 📎 direktor / yurist so'ragan hujjat (pasport, notarial, qo'shimcha kelishuv, yozishma) — xuddi shunday
// topHujjatYopTez_ → topHalHujjat_: ochiq hujjat topshiriqlari — JSHSHIR kiritilgan bo'lsa «Bajarildi»; hujjat yuklangan bo'lsa «Tekshiruvda»
//   (10_Topshiriqlar N:R + U «HJ:<id>»), tekshiruvchiga Telegram (fayl + ✅/✖) — eski tizimning o'zi (Koprik v1.7 koprikTopTasdiqTg),
//   fayl Drive'ga ko'chgach (eski tizim faylni Drive'dan oladi).
// Yoqilishi: Redis yozuv_yondi:qadam_hujjat («aks-yozuv-sinov undiruv») va Koprik ≥ 1.7. Aks holda — eski tizim.
'use strict';
const S = require('./sessiya');
const V = require('../lib/varaq');
const U = require('../lib/undiruv_yordam');
const G = require('../lib/google');
const env = require('../lib/env');
const koprik = require('./koprik');
const tetik = require('../lib/kozgu_tetik');
const TS = require('../lib/tasdiq');
const { redis } = require('../lib/db');
const Q = require('./qadam');
const QY = require('./qadam_yoz')._ichki;
const TP = require('./topshiriq_yoz')._ichki;
const TQ = require('./topshiriq')._ichki;
const MY = require('./mayda_yoz');
const HY = require('./hujjat_yoz');

const TOP_V = TP.TOP_V, HUJ_V = '06d_Hujjatlar', MIJ_V = '02_Mijozlar';
const s = v => String(v == null ? '' : v);
const kut = (p, ms) => Promise.race([p, new Promise(r => setTimeout(r, ms))]);
const yangila = nomlar => kut(tetik.varaqlarYangila(nomlar).catch(e => console.error('ko\'zgu (qadam hujjat):', e.message)), 15000);

let kv = { ok: false, t: 0 };
async function koprik17(kod) {   // Koprik.gs v1.7 (koprikTopTasdiqTg) — 30 daqiqa kesh (yo'q bo'lsa 2 daqiqa)
  if (kv.t && Date.now() - kv.t < (kv.ok ? 30 : 2) * 60000) return kv.ok;
  try { kv = { ok: koprik.bor() && String(await koprik.chaqir('koprikVersiya', kod, [])) >= '1.7', t: Date.now() }; } catch (e) { kv = { ok: false, t: Date.now() }; }
  return kv.ok;
}
async function bayroq() { try { return (await redis.get('yozuv_yondi:qadam_hujjat')) === '1'; } catch (e) { return false; } }
async function eskiTizim(fn, u, args) { const r = await koprik.chaqir(fn, u.kod, args); await tetik.yangilaKut(20000); return r; }

// ------------------------------------------------------------------ topHujjatYopTez_ (Topshiriq.gs v2.2)
async function hjYangi() {   // hujjatJurnal_ — Google'dan yangi (getDisplayValues, 15 ustun)
  const X = await G.oraliqOqi(env.aksBazaId, HUJ_V, 'A2:O', env.googleKey);
  let m = -1; X.forEach((r, i) => { if (s(r[0]) !== '') m = i; });
  return X.slice(0, m + 1).map((r, i) => ({ qator: i + 2, id: s(r[0]), no: s(r[1]), turi: s(r[5]), sana: s(r[6]), nom: s(r[7]), faylId: s(r[8]), sahifa: s(r[10]), kim: s(r[11]), vaqt: s(r[12]), holati: s(r[13]), izoh: s(r[14]) })).filter(h => h.id);
}
async function mlYangi() {   // topMlMijoz_ — Google'dan yangi
  const X = await G.oraliqOqi(env.aksBazaId, MIJ_V, 'A2:L', env.googleKey); const M = {};
  X.forEach(r => { const m = s(r[0]).trim(); if (!m) return; M[m] = { jshshir: /^\d{14}$/.test(s(r[11]).trim()), ota: s(r[2]).trim().split(/\s+/).length >= 3, tel: s(r[4]).replace(/\D/g, '').length >= 9 }; });
  return M;
}
// Qaytaradi: { n, tg: [topshiriq ID] } — tg: Telegram tasdiq xabari ketadigan topshiriqlar (fayl Drive'ga ko'chgach)
async function topHujjatYop(no) {
  const R = await TP.topRowsYangi(TOP_V);
  const H = R.L.filter(t => t.holati === 'Jarayonda' && s(t.no || s(t.kalit).split('|')[1]) === s(no))
    .filter(t => { const tr = TS.topHjTur(t); return tr && tr !== 'MANZIL' && tr !== 'BOSHQA'; });
  if (!H.length) return { n: 0, tg: [] };
  const HJ = await hjYangi(); const mlM = H.some(t => TS.topHjTur(t) === 'JSHSHIR') ? await mlYangi() : {};
  let n = 0; const tg = [], rejada = new Set();
  for (const t of H) {
    if (TS.topHjTur(t) === 'JSHSHIR') { if ((mlM[t.mid] || {}).jshshir) { await TP.topYop(TOP_V, t, 'Bajarildi', 'tizim', 'JSHSHIR bazaga kiritildi'); n++; } continue; }
    const h = TQ.topHjHujjat(t, HJ); if (!h) continue;
    await TP.topYop(TOP_V, t, 'Tekshiruvda', h.kim || 'tizim', 'hujjat yuklandi: ' + h.nom + (h.kim ? ' (' + h.kim + ')' : ''));
    await G.yoz(env.aksBazaId, [{ varaq: TOP_V, katak: 'U' + t.qator, qiymat: [['HJ:' + h.id]] }], env.googleKey);
    n++;
    // bitta hujjat — bir nechta topshiriq: Telegram xabari faqat birinchisiga (boshqasida xabar bo'lsa — yuborilmaydi)
    const bor = rejada.has(h.id) || R.L.some(z => s(z.id) !== s(t.id) && z.holati === 'Tekshiruvda' && s(z.isbot) === 'HJ:' + h.id && z.tgx);
    if (!bor) { rejada.add(h.id); tg.push(t.id); }
  }
  return { n, tg };
}
function tasdiqTg(kod, rel, ids) {
  if (!ids.length) return;
  HY._ichki.driveKeyin(rel, async () => { for (const id of ids) await koprik.chaqir('koprikTopTasdiqTg', kod, [id]); });
}
const relOl = (no, nom) => s(no).replace(/\//g, '-') + '/' + nom;

// ------------------------------------------------------------------ amallar
async function qadamXatBekor(args) {
  const [kodSes, d0] = args; const d = d0 || {};
  const u = await S.ruxsat(kodSes, 'undiruv');
  if (!(await bayroq())) return eskiTizim('qadamXatBekor', u, args.slice(1));
  const r = await MY.xatBekor([kodSes, s(d.raqam || ''), QY.qdSabab(d.sabab, '.')]);
  const m = await Q.qadamMijoz([kodSes, d.no]); m.saqlandi = r; return m;
}
async function yuklaVaYop(kodSes, u, x, hd, dNo) {
  const r = await HY.hujjatYukla([kodSes, hd]);
  if (r && r.mavjud) throw new S.Xato(r.xabar);
  try {
    const t = await topHujjatYop(x.no);
    if (t.n) { tasdiqTg(u.kod, relOl(r.no || x.no, r.nom), t.tg); await yangila([TOP_V]); }
  } catch (e) { console.error('topHujjatYopTez_ (server):', e.message); }   // eski tizimda ham xato e'tiborsiz (console.log)
  const m = await Q.qadamMijoz([kodSes, dNo]); m.saqlandi = r; return m;
}
async function qadamSkan(args) {
  const [kodSes, d0] = args; const d = d0 || {};
  const u = await S.ruxsat(kodSes, 'undiruv');
  if (!(await bayroq()) || !(await koprik17(u.kod))) return eskiTizim('qadamSkan', u, args.slice(1));
  const x = (await U.undShartnomalar()).find(z => z.no === s(d.no || '')); if (!x) throw new S.Xato('Shartnoma topilmadi.');
  return yuklaVaYop(kodSes, u, x, { no: x.no, turi: 'SHARTNOMA', sana: x.sana || V.bugun(), b64: d.b64, sahifa: d.sahifa || '', izoh: 'Bugungi ish' }, d.no);
}
async function qadamHujjat(args) {
  const [kodSes, d0] = args; const d = d0 || {};
  const u = await S.ruxsat(kodSes, 'undiruv');
  if (!(await bayroq()) || !(await koprik17(u.kod))) return eskiTizim('qadamHujjat', u, args.slice(1));
  const tur = s(d.tur || ''); if (!TQ.TOP_HJ_TUR_L[tur]) throw new S.Xato('Hujjat turi noto\'g\'ri.');
  const x = (await U.undShartnomalar()).find(z => z.no === s(d.no || '')); if (!x) throw new S.Xato('Shartnoma topilmadi.');
  return yuklaVaYop(kodSes, u, x, { no: x.no, turi: TQ.TOP_HJ_TUR_L[tur][0], sana: V.bugun(), b64: d.b64, sahifa: d.sahifa || '', izoh: 'Topshiriq bo\'yicha (Bugungi ish)' }, d.no);
}

module.exports = { qadamXatBekor, qadamSkan, qadamHujjat };
module.exports._ichki = { topHujjatYop, hjYangi, koprik17 };
