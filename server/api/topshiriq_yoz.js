// AKS TIZIM — 📌 TOPSHIRIQLARNING YOZADIGAN amallari serverda (Topshiriq.gs v2.2 bilan bir xil tekshiruvlar, xato matnlari va kataklar):
//   topBer — direktor topshiriq beradi → 10_Topshiriqlar oxiriga (topYoz_), «👤 Xodimga berish» bo'lsa asl topshiriq yopiladi (topYop_),
//            xodimga Telegram (topTg_ → Koprik v1.5 koprikTgChat, xodim kutmaydi).
//   topSkanTopilmadi — kotiba «skanq» topshirig'ida «🗂 Arxivda topilmadi»: topshiriq yopiladi, undiruvchiga «skanu» (mijozdan nusxa olib kelish).
// Yozish faqat «aks-yozuv-sinov topshiriq» nusxa varaqda tekshirgach yoqiladi (Redis: yozuv_yondi:topshiriq) va Koprik v1.5 bo'lsa.
// Aks holda, yoki robotda yozish huquqi bo'lmasa — amal avvalgidek eski tizim orqali bajariladi.
// 10_Topshiriqlar ga eski tizim ham yozadi (topAvto triggeri, Qadam/Yurist/Devon amallari ko'prik orqali) — ular Redis qulfini bilmaydi.
// Shuning uchun: A ustuni yozishdan oldin Google'dan YANGI o'qiladi, qator «append» bilan qo'shiladi (ustma-ust tushmaydi) va yozgandan keyin
// ID takrorlanmaganini tekshiradi; takrorlangan bo'lsa — server qatoriga keyingi bo'sh ID beriladi (yozuv_ogoh ga yoziladi).
'use strict';
const crypto = require('crypto');
const S = require('./sessiya');
const V = require('../lib/varaq');
const G = require('../lib/google');
const env = require('../lib/env');
const koprik = require('./koprik');
const tetik = require('../lib/kozgu_tetik');
const P = require('../lib/portfel');
const { redis } = require('../lib/db');
const U = require('../lib/undiruv_yordam');
const { xodimTeng } = require('../lib/xodim');

const TOP_V = '10_Topshiriqlar';
const TOP_N = 22;   // A–V (TOP_S)
const TOP_QOIDA_KALIT = ['skan', 'davo', 'vada', 'tolov', 'xat', 'bekor', 'pasport', 'bepul', 'bufer', 'skanq'];   // TOP_QOIDALAR kalitlari
const TOP_HJ_TUR = { SHARTNOMA: 1, PASPORT: 1, NOTARIAL: 1, QOSHIMCHA_KELISHUV: 1, YOZISHMA: 1 };
const s = v => String(v == null ? '' : v);
const S1 = v => s(v).replace(/\s+/g, ' ').trim();
function hozirDmyHm() { const d = new Date(Date.now() + 5 * 3600 * 1000), p = n => String(n).padStart(2, '0');
  return p(d.getUTCDate()) + '.' + p(d.getUTCMonth() + 1) + '.' + d.getUTCFullYear() + ' ' + p(d.getUTCHours()) + ':' + p(d.getUTCMinutes()); }
function topIso(dmyhm) { const m = /^(\d{2})\.(\d{2})\.(\d{4})(?:\s+(\d{2}):(\d{2}))?/.exec(s(dmyhm)); return m ? m[3] + '-' + m[2] + '-' + m[1] + ' ' + (m[4] || '23') + ':' + (m[5] || '59') : ''; }
function topHozirIso() { const d = new Date(Date.now() + 5 * 3600 * 1000); return d.toISOString().slice(0, 10) + ' ' + d.toISOString().slice(11, 16); }
const kut = (p, ms) => Promise.race([p, new Promise(r => setTimeout(r, ms))]);

// ------------------------------------------------------------------ umumiy
async function qulfBilan(ish) {   // LockService o'rni (server ichidagi topshiriq yozuvlari bittadan)
  const kalit = 'qulf:topshiriq', belgi = crypto.randomBytes(8).toString('hex'), t0 = Date.now();
  while (!(await redis.set(kalit, belgi, 'PX', 30000, 'NX'))) { if (Date.now() - t0 > 30000) throw new S.Xato('Tizim band — birozdan keyin qayta urinib ko\'ring.'); await new Promise(r => setTimeout(r, 150)); }
  try { return await ish(); } finally { if ((await redis.get(kalit)) === belgi) await redis.del(kalit); }
}
let kv = { ok: false, t: 0 };
async function koprik15(kod) {   // Koprik.gs v1.5 (koprikTgChat) — 30 daqiqa kesh (yo'q bo'lsa 2 daqiqa)
  if (kv.t && Date.now() - kv.t < (kv.ok ? 30 : 2) * 60000) return kv.ok;
  try { kv = { ok: koprik.bor() && String(await koprik.chaqir('koprikVersiya', kod, [])) >= '1.5', t: Date.now() }; } catch (e) { kv = { ok: false, t: Date.now() }; }
  return kv.ok;
}
async function serverda(kod) {
  try { if ((await redis.get('yozuv_yondi:topshiriq')) !== '1') return false; } catch (e) { return false; }
  return koprik15(kod);
}
async function eskiTizim(fn, u, args) { const r = await koprik.chaqir(fn, u.kod, args); await tetik.yangilaKut(20000); return r; }
async function ogoh(xab) { try { await redis.lpush('yozuv_ogoh', JSON.stringify(Object.assign({ vaqt: hozirDmyHm() }, xab))); await redis.ltrim('yozuv_ogoh', 0, 49); } catch (e) { } }

// topXodimlar_: ishlayotgan va huquqi bor xodimlar (07 — getValues)
async function topXodimlar() {
  return (await V.qatorlar('07_Xodimlar')).map(({ x }) => x).filter(r => r[1] && s(r[10]).trim() === 'Ishlayapti' && s(r[18]).trim())
    .map(r => ({ fish: s(r[1]).trim(), lavozim: s(r[3]), bolim: s(r[4]), huquq: s(r[18]), tg: s(r[20]).trim(), admin: /(^|,)\s*admin\s*(,|$)/.test(s(r[18])) }));
}
// topRows_ — Google'dan YANGI (getDisplayValues, A ustunining oxirgi to'ldirilgan qatorigacha); l — ustunA_oxiri_
async function topRowsYangi(varaq) {
  const X = await G.oraliqOqi(env.aksBazaId, varaq, 'A2:V', env.googleKey);
  let m = -1; X.forEach((r, i) => { if (s(r[0]) !== '') m = i; });
  const L = X.slice(0, m + 1).map((r0, i) => { const r = []; for (let k = 0; k < TOP_N; k++) r.push(s(r0[k]));
    return { qator: i + 2, id: r[0], yaratildi: r[1], manba: r[2], qoida: r[3], kalit: r[4], sarlavha: r[5], izoh: r[6], no: r[7], mid: r[8], kimga: r[9], kimBerdi: r[10],
      muddat: r[11], muhim: r[12], holati: r[13], yopildi: r[14], yopdi: r[15], dalil: r[16], kechikdi: r[17], isbotMaj: r[19], isbot: r[20], tgx: r[21] }; });
  return { L: L.filter(x => x.id), l: m + 2 };
}
const raqam = v => Number(s(v).replace(/[^\d]/g, '')) || 0;

// ------------------------------------------------------------------ yozuv yadrosi (sinov ham shuni ishlatadi — nusxa varaqda)
// topYoz_: yangi qator (ID = A dagi eng kattasi + 1), oxiriga append; yozgach ID takrorlanmaganini tekshiradi
async function topYoz(varaq, o, R) {
  const id = (R.L.length ? Math.max(...R.L.map(x => raqam(x.id))) : 0) + 1;
  const vaqt = hozirDmyHm();
  const qator = [id, vaqt, o.manba, o.qoida || '', o.kalit || '', o.sarlavha, o.izoh || '', o.no || '', o.mid || '', o.kimga, o.kimBerdi || 'tizim', o.muddat, o.muhim || 'Oddiy', 'Jarayonda', '', '', '', '', '',
    o.isbotMaj ? 'Ha' : '', '', ''];
  let q;
  try { q = await G.qatorQoshR(env.aksBazaId, varaq, R.l + 1, qator, env.googleKey); }
  catch (e) { if (e instanceof G.RuxsatYoq) e.yozilmadi = true; throw e; }
  let idY = id;
  if (q !== R.l + 1) {   // shu orada eski tizim ham qator qo'shgan — ID takrorlanmadimi
    const A = await G.oraliqOqi(env.aksBazaId, varaq, 'A2:A', env.googleKey, 'UNFORMATTED_VALUE');
    const boshqa = A.map((r, i) => ({ n: i + 2, id: raqam(r[0]) })).filter(z => z.n !== q && z.id);
    if (boshqa.some(z => z.id === id)) {
      idY = Math.max(...boshqa.map(z => z.id)) + 1;
      await G.yoz(env.aksBazaId, [{ varaq, katak: 'A' + q, qiymat: [[idY]] }], env.googleKey);
    }
    await ogoh({ varaq, qator: q, xato: 'kutilgan qator ' + (R.l + 1) + ' — shu orada boshqa yozuv qo\'shilgan' + (idY !== id ? ', ID ' + id + ' → ' + idY : '') });
  }
  return Object.assign({ id: idY, yaratildi: vaqt, qator: q }, o);
}
// topYop_: N–R (holati, yopildi, yopdi, dalil, kechikdi)
async function topYop(varaq, x, holat, kim, dalil) {
  const vaqt = hozirDmyHm();
  const kech = topIso(x.muddat) && topIso(x.muddat) < topHozirIso() ? 'Ha' : '';
  try { await G.yoz(env.aksBazaId, [{ varaq, katak: 'N' + x.qator + ':R' + x.qator, qiymat: [[holat, holat === 'Jarayonda' ? '' : vaqt, holat === 'Jarayonda' ? '' : kim, dalil || '', holat === 'Bajarildi' || holat === 'Tekshiruvda' ? kech : '']] }], env.googleKey); }
  catch (e) { if (e instanceof G.RuxsatYoq) e.yozilmadi = true; throw e; }
}
// topTg_: har xodimga bitta xabar (eski tizimda tgYuborChat_; xato e'tiborsiz)
function topTgMatn(L) {
  return '📌 <b>Sizga ' + (L.length === 1 ? 'yangi topshiriq' : L.length + ' ta yangi topshiriq') + '</b>\n' + L.slice(0, 10).map(r => '• ' + (r.muhim === 'Shoshilinch' ? '🔴 ' : '') + r.sarlavha + (r.no ? ' · ' + r.no : '') + ' — muddat ' + r.muddat + (r.manba === 'Tizim' ? ' 🤖' : '')).join('\n') + (L.length > 10 ? '\n… va yana ' + (L.length - 10) + ' ta' : '') + '\n\nAKS ilovasi → 📌 Topshiriqlar';
}
function topTg(kod, rows, XD) {
  const Gr = {}; rows.forEach(r => (Gr[r.kimga] = Gr[r.kimga] || []).push(r));
  Object.keys(Gr).forEach(f => { const x = XD.find(z => z.fish === f); if (!x || !x.tg) return;
    koprik.chaqir('koprikTgChat', kod, [x.tg, topTgMatn(Gr[f])]).catch(e => console.error('top tg (ko\'prik):', e.message)); });
}

// ------------------------------------------------------------------ 📌 direktor: topshiriq berish
// Tekshiruvlar (bazaga hech narsa yozmaydi) — topBer ning yozishgacha bo'lgan qismi; R — topRowsYangi natijasi
async function topBerTekshir(u, d, XD, R) {
  const sarl = S1(d.sarlavha); if (sarl.length < 5) throw new S.Xato('Topshiriq matnini yozing.');
  const x = XD.find(z => z.fish === S1(d.kimga)); if (!x) throw new S.Xato('Xodimni ro\'yxatdan tanlang.');
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?$/.exec(S1(d.muddat)); if (!m) throw new S.Xato('Muddatni tanlang.');
  const muddat = m[3] + '.' + m[2] + '.' + m[1] + ' ' + (m[4] || '18') + ':' + (m[5] || '00');
  const qoida = S1(d.kalit).split('|')[0];
  if (qoida === 'talab' || qoida === 'hj') {   // v1.9: bitta shartnomaga bitta ochiq topshiriq
    const kp = S1(d.kalit).split('|'); if (!/^27\/\d+$/.test(kp[1] || '')) throw new S.Xato('Shartnoma raqami noto\'g\'ri.');
    if (qoida === 'hj' && !TOP_HJ_TUR[kp[2]] && kp[2] !== 'JSHSHIR') throw new S.Xato('Hujjat turi noto\'g\'ri.');
    const och = R.L.find(t => (qoida === 'talab' ? /^talab\|/.test(t.kalit) && t.kalit.split('|')[1] === kp[1] : t.kalit === S1(d.kalit)) && (t.holati === 'Jarayonda' || t.holati === 'Tekshiruvda'));
    if (och) throw new S.Xato('Bu bo\'yicha ochiq topshiriq bor: №' + och.id + ' (' + och.kimga + ', ' + och.holati + ').');
    if (qoida === 'talab' && kp[2] === 'qm') { const xs = (await P.xatShartnomalar(V.bugun())).find(z => z.no === kp[1]);
      if (!xs || !xs.qm) throw new S.Xato('Qo\'shimcha maydon talabnomasi bu shartnomaga chiqmaydi: ' + String((xs && xs.qmSabab) || 'shablon yo\'q').replace(/\.$/, '') + '. Belgini olib tashlang.'); }
  }
  const ota = d.ota ? R.L.find(t => String(t.id) === S1(d.ota)) : null;   // v1.4: «👤 Xodimga berish» — asl topshiriq
  if (d.ota && (!ota || ota.holati !== 'Jarayonda' || ota.kalit !== S1(d.kalit))) throw new S.Xato('Asl topshiriq topilmadi yoki allaqachon yopilgan — sahifani yangilang.');
  const q2 = TOP_QOIDA_KALIT.indexOf(qoida) >= 0 || /^(malumot|talab|hj|olib)$/.test(qoida) ? qoida : '';
  const o = { manba: 'Direktor', qoida: q2, kalit: S1(d.kalit), sarlavha: sarl, izoh: S1(d.izoh), no: S1(d.no), mid: S1(d.mid), kimga: x.fish, kimBerdi: u.fish, muddat, muhim: d.muhim === 'Shoshilinch' ? 'Shoshilinch' : 'Oddiy',
    isbotMaj: !!d.isbot && !q2 && !/^(talab|hj|olib|malumot)\|/.test(S1(d.kalit)) };   // v2.0: 📎 isbot fayl majburiy — oddiy topshiriqda
  return { o, x, ota };
}
async function topBer(args) {
  const [kodSes, d0] = args; const d = d0 || {};
  const u = await S.ruxsat(kodSes, 'admin');
  if (!(await serverda(u.kod))) return eskiTizim('topBer', u, [d0]);
  const XD = await topXodimlar();
  let yoq = false;
  const w = await qulfBilan(async () => {
    const R = await topRowsYangi(TOP_V);
    const { o, x, ota } = await topBerTekshir(u, d, XD, R);
    let row;
    try {
      row = await topYoz(TOP_V, o, R);
      if (ota) await topYop(TOP_V, ota, 'Bajarildi', u.fish, 'Xodimga topshirildi: ' + x.fish + ' (№' + row.id + ')');   // v1.4
    } catch (e) { if (e.yozilmadi && !row) { yoq = true; return null; } throw e; }
    return { row, x };
  });
  if (yoq) return eskiTizim('topBer', u, [d0]);   // robotda yozish huquqi yo'q — hech narsa yozilmagan
  topTg(u.kod, [w.row], XD);
  await kut(tetik.varaqlarYangila([TOP_V]).catch(e => console.error('ko\'zgu (topshiriq):', e.message)), 15000);
  return { ok: true, id: w.row.id, kimga: w.x.fish, tg: !!w.x.tg };
}

// topKimga_: istalgan yozuvdagi ismni 07 dagi xodimga bog'lash; topilmasa — direktor
function topKimga(XD, raw) {
  raw = s(raw).trim(); const dir = (XD.find(x => x.admin) || {}).fish || '';
  if (!raw || raw === '—') return { fish: dir, egasiz: true };
  const x = XD.find(z => xodimTeng(raw, z.fish));
  return x ? { fish: x.fish, egasiz: false } : { fish: dir, egasiz: true };
}
function kunKeyinDmy(n) { const d = new Date(Date.now() + 5 * 3600 * 1000 + n * 86400000), p = x => String(x).padStart(2, '0'); return p(d.getUTCDate()) + '.' + p(d.getUTCMonth() + 1) + '.' + d.getUTCFullYear(); }

// ------------------------------------------------------------------ 🗂 kotiba arxivdan topa olmadi → undiruvchiga (mijozdan nusxa olib kelish)
async function topSkanTopilmadi(args) {
  const [kodSes, id, izoh0] = args;
  const u = await S.ruxsat(kodSes);
  if (!(await serverda(u.kod))) return eskiTizim('topSkanTopilmadi', u, args.slice(1));
  const XD = await topXodimlar();
  let yoq = false;
  const w = await qulfBilan(async () => {
    const R = await topRowsYangi(TOP_V);
    const x = R.L.find(t => String(t.id) === String(id));
    if (!x) throw new S.Xato('Topshiriq topilmadi.');
    if (!/^skanq\|/.test(x.kalit)) throw new S.Xato('Bu tugma faqat «shartnoma skanini arxivdan toping» topshirig\'iga ishlaydi.');
    if (!u.admin && !xodimTeng(x.kimga, u.fish)) throw new S.Xato('Bu topshiriq sizga berilmagan.');
    if (x.holati !== 'Jarayonda') throw new S.Xato('Topshiriq «' + x.holati + '» holatida.');
    const izoh = s(izoh0).replace(/\s+/g, ' ').trim(); if (izoh.length < 5) throw new S.Xato('Qayerda qidirganingizni qisqa yozing (kamida 5 belgi).');
    const no = x.no || x.kalit.split('|')[1];
    try { await topYop(TOP_V, x, 'Bajarildi', u.fish, 'Arxivda topilmadi: ' + izoh); }
    catch (e) { if (e.yozilmadi) { yoq = true; return null; } throw e; }
    const sh = (await U.undShartnomalar()).find(z => z.no === no) || {};
    const k = topKimga(XD, sh.undiruvchi);
    const row = await topYoz(TOP_V, { manba: 'Tizim', qoida: 'skanu', kalit: 'skanu|' + no, sarlavha: 'Shartnoma nusxasini mijozdan olib, skanini yuklang',
      izoh: (sh.fish || '') + ' · kotiba arxivdan topa olmadi: «' + izoh + '»', no, mid: x.mid, kimga: k.fish, kimBerdi: 'tizim', muddat: kunKeyinDmy(3) + ' 18:00', muhim: 'Oddiy' }, R);   // topYop qator qo'shmaydi — R (ID uchun) o'zgarmagan
    return { row, k };
  });
  if (yoq) return eskiTizim('topSkanTopilmadi', u, args.slice(1));   // robotda yozish huquqi yo'q — hech narsa yozilmagan
  topTg(u.kod, [w.row], XD);
  await kut(tetik.varaqlarYangila([TOP_V]).catch(e => console.error('ko\'zgu (topshiriq):', e.message)), 15000);
  return { ok: true, kimga: w.k.fish };
}

module.exports = { topBer, topSkanTopilmadi };
module.exports._ichki = { topYoz, topYop, topRowsYangi, topBerTekshir, topXodimlar, topTgMatn, topKimga, koprik15, TOP_V };
