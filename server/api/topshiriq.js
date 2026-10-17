// AKS TIZIM — 📌 Topshiriqlar (Topshiriq.gs v2.2): topRoyxat (direktor: hamma topshiriqlar + qoidalar) serverda, topQoidaYoz — eski tizim orqali.
// Qoidalar sozlamasi (TOP_QOIDA) eski tizimning Script Properties'ida turadi — server oxirgi nusxasini Redis'da saqlaydi:
//   'top_qoida' (muddatsiz) darhol ishlatiladi; 1 soatdan eskirsa — fonda eski tizimdagi topRoyxat orqali yangilanadi;
//   topQoidaYoz serverdan o'tadi: eski tizimga yozadi va shu zahoti Redis'dagi nusxani ham yangilaydi.
'use strict';
const S = require('./sessiya');
const V = require('../lib/varaq');
const J = require('../lib/jurnallar');
const TS = require('../lib/tasdiq');
const koprik = require('./koprik');
const { redis } = require('../lib/db');

const TOP_QOIDALAR = [   // [kalit, nomi, muddat kun, kimga]
  ['skan', 'Yangi shartnoma skansiz', 1, 'tuzgan xodim'], ['davo', "Da'vo muddatiga 90 kun qoldi", 7, 'undiruvchi'], ['vada', "Mijoz va'da qilgan sana keldi", 0, 'undiruvchi'],
  ['tolov', "Oylik to'lov o'tdi, to'lov yo'q", 3, 'undiruvchi'], ['xat', 'Ogohlantirish xati yetkazilmagan', 2, 'xatni chiqargan'], ['bekor', 'Bekor qilish skanlari kechikdi', 1, "so'rov kiritgan"],
  ['pasport', 'Mijoz pasporti tugagan / 30 kunda tugaydi', 14, 'biriktirilgan xodim'], ['bepul', 'Ijara bepul davriga 30 kun qoldi', 14, 'ijara mas\'uli'], ['bufer', "Bufer to'lov muddati o'tdi", 1, 'direktor'],
  ['skanq', "Qarzdor shartnomasining skani yo'q", 7, 'kotiba']];
const QOIDA_ESKI_MS = 60 * 60 * 1000;

// TOP_QOIDA (xom) → har qoida uchun {on, kun} (topQoidaCfg_ bilan bir xil)
function cfgDan(p) { const o = {}; TOP_QOIDALAR.forEach(q => { const c = (p || {})[q[0]] || {}; o[q[0]] = { on: c.on !== false, kun: c.kun === undefined ? q[2] : Number(c.kun) || 0 }; }); return o; }
async function qoidaKoprikdan(kod) {
  const r = await koprik.chaqir('topRoyxat', kod, []);
  if (!r || !Array.isArray(r.qoidalar)) return null;
  const p = {}; r.qoidalar.forEach(q => { p[q.k] = { on: q.on, kun: q.kun }; });
  await redis.set('top_qoida', JSON.stringify({ t: Date.now(), p }));
  return p;
}
function qoidaFonda(kod) {
  redis.set('top_qoida_qulf', '1', 'NX', 'EX', 180).then(ok => { if (!ok) return;
    qoidaKoprikdan(kod).catch(e => console.error('top_qoida (fonda):', e.message)).finally(() => redis.del('top_qoida_qulf').catch(() => {}));
  }).catch(() => {});
}
async function topQoidaCfg(kod) {
  let z = null; try { const s = await redis.get('top_qoida'); if (s) z = JSON.parse(s); } catch (e) { }
  if (z && z.p) { if (Date.now() - (z.t || 0) > QOIDA_ESKI_MS) qoidaFonda(kod); return cfgDan(z.p); }
  let p = null; try { p = await qoidaKoprikdan(kod); } catch (e) { console.error('top_qoida (ko\'prik):', e.message); }
  return cfgDan(p || {});
}

// ustunA_oxiri_
function aOxiri(rows) { let m = 0; rows.forEach(({ n, x }) => { if (x[0] !== null && x[0] !== undefined && x[0] !== '') m = n; }); return rows.filter(z => z.n <= m); }

// topMlMijoz_ / topMlSorov_ / topMlHolat_ — ochiq ma'lumot topshiriqlariga holat
async function topMlMijoz() {
  const M = {};
  aOxiri(await V.qatorlar('02_Mijozlar')).forEach(({ r }) => { const g = i => r[i] == null ? '' : String(r[i]); const m = g(0).trim(); if (!m) return;
    M[m] = { jshshir: /^\d{14}$/.test(g(11).trim()), ota: g(2).trim().split(/\s+/).length >= 3, tel: g(4).replace(/\D/g, '').length >= 9 }; });
  return M;
}
function topMlSorov(Sr, t) {
  const p = String(t.kalit || '').split('|'); const k = { jshshir: ['jshshir'], ota: ['fish'], tel: ['tel', 'tel2'] }[p[2]] || [];
  for (let i = 0; i < Sr.length; i++) { const s = Sr[i]; if (s.tur !== 'tahrir' || s.kalit !== p[1] || s.holati !== 'Kutilmoqda') continue;
    let j = null; try { j = JSON.parse(String(s.malumot || '')); } catch (e) { }
    if (!j || !j.d || !k.some(z => z in j.d)) continue;
    const f = (j.f || [])[0] || [];
    return { id: s.id, kim: s.kim, vaqt: s.vaqt, sabab: s.sabab, f: String(f[0] || ''), qiymat: String(f[2] || '') }; }
  return null;
}
async function topMlHolat(L) {
  const ML = L.filter(t => /^malumot\|/.test(t.kalit || '') && (t.holati === 'Jarayonda' || t.holati === 'Tekshiruvda')); if (!ML.length) return L;
  const [M, Sr] = await Promise.all([topMlMijoz(), J.monSorovlar()]);
  ML.forEach(t => { const p = t.kalit.split('|'); const mj = M[t.mid] || {};
    if (mj[p[2]]) { t.mh = 'tayyor'; return; }
    const s = topMlSorov(Sr, t); if (s) { t.mh = 'kutish'; t.ms = s; } });
  return L;
}
async function topTalabBelgi(L) {
  const T = (L || []).filter(t => /^talab\|/.test(t.kalit || '')); if (!T.length) return L;
  const [XJ, HJ] = await Promise.all([J.xatJurnal(), J.hujjatJurnal()]); const fid = nom => { const h = HJ.find(z => z.nom === nom); return h ? h.id : ''; };
  T.forEach(t => { const h = TS.topTalabHolat(t, XJ); ['as', 'qm'].forEach(k => { if (h[k] && h[k].isbot) h[k].hujjatId = fid(h[k].isbot); }); t.talab = h; });
  return L;
}

async function topRoyxat([kodSes]) {
  const u = await S.ruxsat(kodSes, 'admin');
  const oy = new Date(Date.now() + 5 * 3600000 - 30 * 86400000).toISOString().slice(0, 10), bugun = V.bugun().split('-').reverse().join('.');
  const [T0, cfg] = await Promise.all([J.topRows(), topQoidaCfg(u.kod)]);
  const R = T0.map(J.topKor);
  const L = R.filter(x => x.holati === 'Jarayonda' || x.holati === 'Tekshiruvda' || TS.topIso(x.yopildi).slice(0, 10) >= oy).reverse();
  const X = {}; R.forEach(x => { if (!x.kimga) return; const o = X[x.kimga] = X[x.kimga] || { fish: x.kimga, ochiq: 0, kechikkan: 0, bugunBajardi: 0, tekshiruv: 0 };
    if (x.holati === 'Jarayonda') { o.ochiq++; if (x.kechikkan) o.kechikkan++; } if (x.holati === 'Tekshiruvda') o.tekshiruv++; if (x.holati === 'Bajarildi' && x.yopildi.slice(0, 10) === bugun) o.bugunBajardi++; });
  const L3 = await topMlHolat(L.slice(0, 300));
  await topTalabBelgi(L3.filter(x => x.holati === 'Jarayonda' || x.holati === 'Tekshiruvda'));
  return { ok: true, royxat: L3, xodimlar: Object.keys(X).map(k => X[k]).sort((a, b) => b.kechikkan - a.kechikkan || b.ochiq - a.ochiq),
    qoidalar: TOP_QOIDALAR.map(q => ({ k: q[0], nom: q[1], kimga: q[3], on: cfg[q[0]].on, kun: cfg[q[0]].kun })),
    son: { ochiq: R.filter(x => x.holati === 'Jarayonda').length, kechikkan: R.filter(x => x.kechikkan).length, tekshiruv: R.filter(x => x.holati === 'Tekshiruvda').length, bugun: R.filter(x => x.holati === 'Bajarildi' && x.yopildi.slice(0, 10) === bugun).length } };
}
// qoidalarni saqlash — eski tizimga (Script Properties), keyin serverdagi nusxa ham shu zahoti yangilanadi
async function topQoidaYoz([kodSes, cfg]) {
  const u = await S.ruxsat(kodSes, 'admin');
  const r = await koprik.chaqir('topQoidaYoz', u.kod, [cfg]);
  const o = {}; TOP_QOIDALAR.forEach(q => { const c = (cfg || {})[q[0]] || {}; o[q[0]] = { on: c.on !== false, kun: Math.max(0, Math.min(60, Number(c.kun) || 0)) }; });
  await redis.set('top_qoida', JSON.stringify({ t: Date.now(), p: o })).catch(() => {});
  return r;
}

module.exports = { topRoyxat, topQoidaYoz };
