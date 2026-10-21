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

// ------------------------------------------------------------------ 🔎 Tekshiruvdagi isbotlar (tasdiqRoyxat, tasdiqFayl) — o'qish; tasdiqQil — eski tizimda
const TOP_RAD_SABAB = {
  hujjat: ['Sahifa yetishmaydi', 'O\'qib bo\'lmaydi — xira', 'Boshqa hujjat yuklangan', 'Imzo yo\'q'],
  xat: ['Mijoz imzosi yo\'q', 'Kvitansiya o\'qilmaydi', 'Pochta raqami mos emas', 'Boshqa xatning isboti'],
  oddiy: ['Isbot yetarli emas', 'Ish to\'liq bajarilmagan', 'Boshqa fayl yuklangan'] };
async function tasdiqRoyxat([kodSes, d]) {
  const u = await S.ruxsat(kodSes);
  const adm = u.huquq.indexOf('admin') >= 0, yu = u.huquq.indexOf('yurist') >= 0;
  if (!adm && !yu) throw new S.Xato('Bu ro\'yxat faqat yurist va direktor uchun.');
  let L = d && d.ixtiyoriy ? await TS.skanNazNavbat() : await TS.tasdiqNavbat();
  const KUT = await require('./tasdiq_navbat')._ichki.kutilmoqda(); L = L.filter(it => !KUT[it.k]);   // navbatdagi qarorlar (fonda eski tizim bajaryapti)
  if (d && d.kech) L = L.filter(it => it.tasdiqchi === 'yurist' && it.kech);
  else if (!adm) L = L.filter(it => it.tasdiqchi === 'yurist');
  L.sort((a, b) => (b.kech - a.kech) || (b.shosh - a.shosh) || (a.muddat < b.muddat ? -1 : 1));
  return { ok: true, admin: adm, sabab: TOP_RAD_SABAB, royxat: L.map(it => { const o = Object.assign({}, it); delete o.caption; delete o.tgx; o.fayl = it.fayl.length; return o; }) };
}
// tasdiqItem_: bitta (hali tekshirilmagan) isbot — 't<ID>', 'x<raqam>' yoki 'n<hujjat ID>'
async function tasdiqItem(k) {
  k = String(k || '');
  if (k.charAt(0) === 't') {
    const t = (await J.topRows()).find(z => String(z.id) === k.slice(1));
    if (!(t && t.holati === 'Tekshiruvda' && !/^(qayta|devon|malumot)\|/.test(String(t.kalit || '')))) return null;
    const [sh, HJ, XJ] = await Promise.all([TS.topShosh(), J.hujjatJurnal(), J.xatJurnal()]);
    return TS.tasdiqTopItem(t, sh, HJ, XJ);
  }
  if (k.charAt(0) === 'x') {
    const XJ = await J.xatJurnal(); const h = XJ.find(z => z.raqam === k.slice(1)); if (!h) return null;
    const [sh, HJ] = await Promise.all([TS.topShosh(), J.hujjatJurnal()]);
    return TS.xatTasdiqItem(h, sh, HJ);
  }
  if (k.charAt(0) === 'n') {
    const r = (await V.qatorlar('06d_Hujjatlar')).map(({ r }) => ({ id: r[0] || '', no: r[1] || '', fish: r[3] || '', turi: r[5] || '', nom: r[7] || '', faylId: r[8] || '', kim: r[11] || '', vaqt: r[12] || '', holati: r[13] || '', naz: r[15] || '', tgx: r[16] || '' }))
      .find(h => h.id && h.turi === 'SHARTNOMA' && String(h.id) === k.slice(1));
    return r ? TS.skanNazItem(r) : null;
  }
  return null;
}
const MIME = { pdf: 'application/pdf', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', heic: 'image/heic' };
async function tasdiqFayl([kodSes, k, n]) {
  const u = await S.ruxsat(kodSes);
  const it = await tasdiqItem(k);
  if (!it) throw new S.Xato('Isbot topilmadi yoki allaqachon tekshirilgan.');
  if (!(u.huquq.indexOf('admin') >= 0 || (it.tasdiqchi === 'yurist' && u.huquq.indexOf('yurist') >= 0))) throw new S.Xato('Bu isbotni ' + (it.tasdiqchi === 'yurist' ? 'yurist' : 'direktor') + ' tekshiradi.');
  const f = it.fayl[Number(n) || 0]; if (!f) throw new S.Xato('Isbot fayli topilmadi.');
  let fid = '', nom = '', no = '';
  if (f.hj) { const h = (await J.hujjatJurnal()).find(z => String(z.id) === String(f.hj)); if (!h || !h.faylId) throw new S.Xato('Isbot fayli topilmadi.'); fid = h.faylId; nom = h.nom; no = h.no; }
  else if (f.f) fid = f.f;
  else throw new S.Xato('Isbot fayli topilmadi.');
  const sv = require('./hujjat_yoz').srvFayl(fid, no, nom);
  if (sv) { const e = (/\.([a-z0-9]+)$/i.exec(sv.nom) || ['', 'pdf'])[1].toLowerCase(); return { nom: nom || sv.nom, b64: sv.bytes.toString('base64'), mime: MIME[e] || 'application/pdf' }; }
  const G = require('../lib/google'), env = require('../lib/env');
  try {
    const d = await G.driveFayl(fid, env.googleKey);
    return { nom: nom || d.nom, b64: d.bytes.toString('base64'), mime: d.mime || 'application/pdf' };
  } catch (e) {
    if (!(e instanceof G.RuxsatYoq)) console.error('tasdiqFayl (Drive):', e.message);
    return koprik.chaqir('tasdiqFayl', u.kod, [k, n]);
  }
}

// ------------------------------------------------------------------ 📌 topMening (xodimning o'z topshiriqlari)
// Eski kod hujjat yuklangan topshiriqni shu yerda «Tekshiruvda»ga o'tkazadi (topHalHujjat_: yozuv + Telegram). Server o'zi yozmaydi:
// shunday topshiriq bo'lsa — amal eski tizimda bajariladi (yozadi va javob beradi), keyin ko'zgu yangilanadi. Bo'lmasa — hammasi serverda.
const TOP_HJ_TUR_L = { SHARTNOMA: ['SHARTNOMA'], PASPORT: ['PASPORT'], NOTARIAL: ['NOTARIAL'], QOSHIMCHA_KELISHUV: ['QOSHIMCHA_KELISHUV', 'DALOLATNOMA'], YOZISHMA: ['YOZISHMA'] };
function topHjHujjat(t, HJ) {
  const tur = TS.topHjTur(t), no = t.no || String(t.kalit).split('|')[1]; const T = TOP_HJ_TUR_L[tur]; if (!T) return null;
  const yar = TS.topIso(t.yaratildi);
  return (HJ || []).filter(z => z.no === no && z.holati === 'Faol' && T.indexOf(z.turi) >= 0 && (tur === 'SHARTNOMA' || TS.topIso(z.vaqt) >= yar)).pop() || null;
}
async function topHalKerak(L) {                          // topHalHujjat_ biror topshiriqni o'zgartirarmidi
  const H = L.filter(t => t.holati === 'Jarayonda' && TS.topHjTur(t) && TS.topHjTur(t) !== 'MANZIL' && TS.topHjTur(t) !== 'BOSHQA'); if (!H.length) return false;
  const HJ = await J.hujjatJurnal(); const mlM = H.some(t => TS.topHjTur(t) === 'JSHSHIR') ? await topMlMijoz() : {};
  return H.some(t => TS.topHjTur(t) === 'JSHSHIR' ? !!(mlM[t.mid] || {}).jshshir : !!topHjHujjat(t, HJ));
}
async function topMening([kodSes]) {
  const u = await S.ruxsat(kodSes);
  const { xodimTeng } = require('../lib/xodim');
  const bugun = V.bugun().split('-').reverse().join('.');
  const hafta = new Date(Date.now() + 5 * 3600000 - 7 * 86400000).toISOString().slice(0, 10);
  const meniki = x => xodimTeng(x.kimga, u.fish);
  const R = (await J.topRows()).filter(meniki).map(J.topKor);
  if (await topHalKerak(R.filter(x => x.holati === 'Jarayonda'))) {
    const r = await koprik.chaqir('topMening', u.kod, []);
    require('../lib/kozgu_tetik').varaqlarYangila(['10_Topshiriqlar']).catch(() => {});
    return r;
  }
  const ochiq = R.filter(x => x.holati === 'Jarayonda' || x.holati === 'Tekshiruvda');
  await topTalabBelgi(ochiq);
  const yopiq = R.filter(x => x.holati === 'Bajarildi' && TS.topIso(x.yopildi).slice(0, 10) >= hafta).reverse().slice(0, 20);
  ochiq.sort((a, b) => (b.kechikkan - a.kechikkan) || (a.muhim === 'Shoshilinch' ? -1 : 0) - (b.muhim === 'Shoshilinch' ? -1 : 0) || (TS.topIso(a.muddat) < TS.topIso(b.muddat) ? -1 : 1));
  await topMlHolat(ochiq);
  return { ok: true, fish: u.fish, ochiq, yopiq, son: { kechikkan: ochiq.filter(x => x.kechikkan).length, bugun: ochiq.filter(x => x.muddat.slice(0, 10) === bugun).length, hafta: yopiq.length, ochiq: ochiq.length } };
}

// ------------------------------------------------------------------ ⚖ Yurist qarorlari jurnali (06t): tqRoyxat (Topshiriq.gs v2.2) — o'qish
const TQ_KUN = 7;
const tashkentKun = n => new Date(Date.now() + 5 * 3600000 - n * 86400000).toISOString().slice(0, 10);
async function tqXulosa(L) {
  const bugun = V.bugun();
  const B = L.filter(q => String(q.vaqt).slice(0, 10) === bugun && q.tasdiqchi === 'yurist');
  const yu = B.filter(q => q.rol === 'yurist' && !(q.m || {}).ixtiyoriy), nz = B.filter(q => (q.m || {}).ixtiyoriy && q.rol === 'yurist'), dr = B.filter(q => q.rol === 'direktor');
  const [kut0, nzL, kor] = await Promise.all([TS.tasdiqNavbat(), TS.skanNazNavbat(), TS.tqKorilmagan(L)]);
  const kut = kut0.filter(it => it.tasdiqchi === 'yurist');
  return { bugun, tas: yu.filter(q => q.qaror === 'Tasdiqlandi').length, rad: yu.filter(q => q.qaror === 'Rad').length, kut: kut.length, kech: kut.filter(it => it.kech).length,
    nzTas: nz.filter(q => q.qaror === 'Tasdiqlandi').length, nzRad: nz.filter(q => q.qaror === 'Rad').length, nzKut: nzL.length,
    dirTas: dr.filter(q => q.qaror === 'Tasdiqlandi').length, dirRad: dr.filter(q => q.qaror === 'Rad').length, kor: kor.length,
    tik: L.filter(q => /^Bekor qilindi\|/.test(q.direktor) && String(q.vaqt).slice(0, 10) >= tashkentKun(TQ_KUN)).length };
}
async function tqRoyxat([kodSes, d]) {
  await S.ruxsat(kodSes, 'admin');
  const kun = Math.max(1, Math.min(30, Number(d && d.kun) || TQ_KUN));
  const ch = tashkentKun(kun - 1);
  const Lh = await J.tqRows();
  const L = Lh.filter(q => q.tasdiqchi === 'yurist' && String(q.vaqt).slice(0, 10) >= ch).reverse();
  const dp = q => String(q.direktor || '').split('|');
  return { ok: true, xulosa: await tqXulosa(Lh), kun, royxat: L.map(q => { const m = q.m || {}, p = dp(q);
    return { id: q.id, vaqt: q.vaqt, k: q.kalit, tur: q.tur, no: q.no, nomi: m.nomi || '', sarlavha: m.sarlavha || '', yukladi: m.kim || q.yukladi, yVaqt: m.vaqt || '', kim: q.kim, rol: q.rol,
      qaror: q.qaror, sabab: q.sabab, direktor: p[0] || '', dVaqt: p[1] || '', dKim: p[2] || '', fayl: (m.fayl || []).length, ixtiyoriy: !!m.ixtiyoriy,
      tikla: !!q.tiklash && q.qaror === 'Rad' && q.rol === 'yurist' && !q.direktor, korish: q.qaror === 'Rad' && q.rol === 'yurist' && !q.direktor }; }) };
}

module.exports = { topRoyxat, topQoidaYoz, tasdiqRoyxat, tasdiqFayl, topMening, tqRoyxat };
module.exports._ichki = { tasdiqItem, topHjHujjat, topQoidaCfg, topMlMijoz, TOP_HJ_TUR_L };   // api/tasdiq_navbat.js, api/qadam_hujjat.js
