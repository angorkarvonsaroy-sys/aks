// AKS TIZIM — 📌 xodimning topshiriq amallari serverda (Topshiriq.gs v2.2 bilan bir xil tekshiruvlar, xato matnlari, javob va kataklar):
//   topBajardim       — «✓ Bajardim» (dalil bilan): xodim — «Tekshiruvda» (tekshiruvchiga Telegram — Koprik v1.7 koprikTopTasdiqTg), direktor — «Bajarildi»;
//                       hujjat topshirig'i — yuklangan hujjat bilan «Tekshiruvda» (JSHSHIR — «Bajarildi»); ma'lumot topshirig'i «Topa olmadim» — direktorga Telegram.
//                       Isbot FAYLI bilan (Drive «06 TOPSHIRIQ ISBOTLARI» papkasiga) — hali eski tizim orqali (fayl direktor Drive'iga eski tizimning o'zi saqlaydi).
//   topSkanZaynabga   — 🤝 undiruvchi nusxani kotibaga berdi → kotibaga «skanz» topshirig'i (1 ish kuni) + Telegram
//   topSkanBerilmagan — ✖ kotiba: «menga berilmagan» → undiruvchining topshirig'i qaytadi + Telegram
// Yoqilishi: Redis yozuv_yondi:bajardim («aks-yozuv-sinov bajardim») va Koprik ≥ 1.7. Aks holda — eski tizim.
'use strict';
const S = require('./sessiya');
const V = require('../lib/varaq');
const G = require('../lib/google');
const env = require('../lib/env');
const TS = require('../lib/tasdiq');
const U = require('../lib/undiruv_yordam');
const koprik = require('./koprik');
const tetik = require('../lib/kozgu_tetik');
const { redis } = require('../lib/db');
const { xodimTeng } = require('../lib/xodim');
const TP = require('./topshiriq_yoz')._ichki;
const TQ = require('./topshiriq')._ichki;
const QH = require('./qadam_hujjat')._ichki;
const QY = require('./qadam_yoz')._ichki;
const HY = require('./hujjat_yoz');

const TOP_V = TP.TOP_V, MIJ_V = '02_Mijozlar';
const s = v => String(v == null ? '' : v);
const kut = (p, ms) => Promise.race([p, new Promise(r => setTimeout(r, ms))]);
const yangila = nomlar => kut(tetik.varaqlarYangila(nomlar).catch(e => console.error('ko\'zgu (bajardim):', e.message)), 15000);

async function serverda(kod) {
  try { if ((await redis.get('yozuv_yondi:bajardim')) !== '1') return false; } catch (e) { return false; }
  return QH.koprik17(kod);
}
async function eskiTizim(fn, u, args) { const r = await koprik.chaqir(fn, u.kod, args); await tetik.yangilaKut(20000); return r; }
const tgFon = (kod, fn, a) => { koprik.chaqir(fn, kod, a).catch(e => console.error(fn + ' (bajardim):', e.message)); };

async function mlJshshir(mid) {   // topMlMijoz_(ss)[mid].jshshir — Google'dan yangi
  const X = await G.oraliqOqi(env.aksBazaId, MIJ_V, 'A2:L', env.googleKey);
  const r = X.find(z => s(z[0]).trim() === s(mid).trim() && s(z[0]).trim() !== '');
  return !!(r && /^\d{14}$/.test(s(r[11]).trim()));
}
// topHjTekshir_: «Tekshiruvda» + U «HJ:<id>»; boshqa topshiriqda shu hujjat xabari bo'lmasa — Telegram (fayl Drive'da bo'lsa darhol, serverda bo'lsa — ko'chgach)
async function hjTekshir(kod, R, t, h) {
  await TP.topYop(TOP_V, t, 'Tekshiruvda', h.kim || 'tizim', 'hujjat yuklandi: ' + h.nom + (h.kim ? ' (' + h.kim + ')' : ''));
  await G.yoz(env.aksBazaId, [{ varaq: TOP_V, katak: 'U' + t.qator, qiymat: [['HJ:' + h.id]] }], env.googleKey);
  if (R.L.some(z => s(z.id) !== s(t.id) && z.holati === 'Tekshiruvda' && s(z.isbot) === 'HJ:' + h.id && z.tgx)) return;
  const yubor = () => koprik.chaqir('koprikTopTasdiqTg', kod, [t.id]);
  if (/^SRV:/.test(s(h.faylId))) HY._ichki.driveKeyin(s(h.faylId).slice(4), yubor);
  else yubor().catch(e => console.error('koprikTopTasdiqTg (bajardim):', e.message));
}

// ------------------------------------------------------------------ ✓ Bajardim
async function topBajardim(args) {
  const [kodSes, id, dalil0, f] = args;
  const u = await S.ruxsat(kodSes);
  if (!(await serverda(u.kod)) || (f && f.b64)) return eskiTizim('topBajardim', u, args.slice(1));   // isbot fayli — eski tizim (Drive)
  const admin = u.admin;
  let dalil = s(dalil0 || '').replace(/\s+/g, ' ').trim();
  if (dalil.length < 5) throw new S.Xato('Nima qilganingizni qisqa yozing (dalil) — kamida 5 belgi.');
  const R = await TP.topRowsYangi(TOP_V); const x = R.L.find(t => s(t.id) === s(id));
  if (!x) throw new S.Xato('Topshiriq topilmadi.');
  if (!admin && !xodimTeng(x.kimga, u.fish)) throw new S.Xato('Bu topshiriq sizga berilmagan.');
  if (x.holati !== 'Jarayonda') throw new S.Xato('Topshiriq «' + x.holati + '» holatida.');
  if (/^qayta\|/.test(x.kalit)) throw new S.Xato('Bu topshiriq «🔁 Ochish» tugmasi orqali bajariladi: 4 ta skanni yuklab, «Tekshiruvga yuborish» ni bosing.');
  if (/^devon\|/.test(x.kalit)) throw new S.Xato('Bu kirim xat topshirig\'i — «📮 Ochish» tugmasi orqali isbot yuklab topshiriladi.');
  if (/^tekshir\|/.test(x.kalit)) throw new S.Xato('Bu tekshiruv qo\'ng\'irog\'i — kartadagi «✅ Tasdiqlandi», «❌ Tasdiqlanmadi» yoki «📵 Bog\'lanib bo\'lmadi» tugmasi bilan javob bering.');
  if (/^(otkaz|muhlat)\|/.test(x.kalit)) throw new S.Xato('Bu ruxsat so\'rovi — kartadagi «✓ Ruxsat» yoki «✕ Rad» tugmasi bilan javob bering.');
  if (/^talab\|/.test(x.kalit)) throw new S.Xato('Bu topshiriq talabnomani chiqarib, isbotini yuklash bilan bajariladi — kartadagi «📨 Talabnoma» tugmasi. Isbot yuklangach topshiriq o\'zi direktorga tekshiruvga ketadi.');
  const tur = TS.topHjTur(x);
  if (tur && tur !== 'MANZIL' && tur !== 'BOSHQA') {   // hujjat topshirig'i
    if (tur === 'JSHSHIR') {
      if (!(await mlJshshir(x.mid))) throw new S.Xato('JSHSHIR hali bazaga kiritilmagan — mijoz kartasida kiriting. Kiritilgach topshiriq o\'zi yopiladi.');
      await TP.topYop(TOP_V, x, 'Bajarildi', u.fish, 'JSHSHIR bazaga kiritildi'); await yangila([TOP_V]); return { ok: true, holati: 'Bajarildi' };
    }
    const h = TQ.topHjHujjat(x, await QH.hjYangi());
    if (!h) throw new S.Xato('Hujjat hali yuklanmagan — kartadagi «📎 Yuklash» tugmasi bilan yuklang: ' + (TS.TOP_HJ_NOM[tur] || tur) + '. Yuklangach topshiriq yuristga tekshiruvga ketadi.');
    await hjTekshir(u.kod, R, x, h); await yangila([TOP_V]); return { ok: true, holati: 'Tekshiruvda' };
  }
  const ml = /^malumot\|/.test(x.kalit);
  if (x.isbotMaj === 'Ha' && !admin) throw new S.Xato('Bu topshiriqda isbot fayli majburiy — rasmga oling yoki PDF tanlang.');
  if (admin) { await TP.topYop(TOP_V, x, 'Bajarildi', u.fish, dalil); await yangila([TOP_V]); return { ok: true, holati: 'Bajarildi' }; }
  await TP.topYop(TOP_V, x, 'Tekshiruvda', u.fish, dalil);
  await G.yoz(env.aksBazaId, [{ varaq: TOP_V, katak: 'U' + x.qator, qiymat: [['']] }], env.googleKey);
  await yangila([TOP_V]);
  if (ml) { tgFon(u.kod, 'koprikTgYubor', ['📌 <b>' + u.fish + '</b> ma\'lumotni topa olmadi — qarovingiz kerak:\n«' + x.sarlavha + '»' + (x.no ? ' · ' + x.no : '') + '\nDalil: ' + dalil]); return { ok: true, holati: 'Tekshiruvda' }; }
  tgFon(u.kod, 'koprikTopTasdiqTg', [x.id]);
  return { ok: true, holati: 'Tekshiruvda', tasdiqchi: TS.topTasdiqchi(x) };
}

// ------------------------------------------------------------------ 🤝 nusxa kotibaga
function hozirIsoHm() { const d = new Date(Date.now() + 5 * 3600 * 1000); return d.toISOString().slice(0, 16).replace('T', ' '); }
async function topSkanZaynabga(args) {
  const [kodSes, id] = args;
  const u = await S.ruxsat(kodSes);
  if (!(await serverda(u.kod))) return eskiTizim('topSkanZaynabga', u, args.slice(1));
  const XD = await TP.topXodimlar();
  const w = await QY.qulf('topshiriq', async () => {
    const R = await TP.topRowsYangi(TOP_V); const x = R.L.find(t => s(t.id) === s(id));
    if (!x) throw new S.Xato('Topshiriq topilmadi.');
    if (!/^skanu\|/.test(x.kalit)) throw new S.Xato('Bu tugma faqat «shartnoma nusxasini mijozdan olib keling» topshirig\'iga ishlaydi.');
    if (!u.admin && !xodimTeng(x.kimga, u.fish)) throw new S.Xato('Bu topshiriq sizga berilmagan.');
    if (x.holati !== 'Jarayonda') throw new S.Xato('Topshiriq «' + x.holati + '» holatida.');
    const kot = XD.find(z => /kotib/i.test(z.lavozim));
    if (!kot) throw new S.Xato('Kotiba topilmadi (07_Xodimlar — lavozimi «Kotiba», «Ishlayapti»). Nusxani o\'zingiz skanerlab yuklang.');
    const no = x.no || x.kalit.split('|')[1];
    if (R.L.some(t => t.kalit === 'skanz|' + no && (t.holati === 'Jarayonda' || t.holati === 'Tekshiruvda'))) throw new S.Xato('Bu shartnoma nusxasi kotibaga allaqachon topshirilgan.');
    await TP.topYop(TOP_V, x, 'Bajarildi', u.fish, 'Nusxa kotibaga topshirildi: ' + kot.fish);
    const fio = s(x.izoh).split(' · ')[0];
    const row = await TP.topYoz(TOP_V, { manba: 'Tizim', qoida: 'skanz', kalit: 'skanz|' + no, sarlavha: 'Shartnoma nusxasini skanerlab yuklang — ' + u.fish + ' olib keldi',
      izoh: (fio ? fio + ' · ' : '') + 'Undiruvchi mijozdan olib kelgan qog\'oz nusxa. Qog\'oz sizga berilmagan bo\'lsa — «✖ Menga berilmagan».', no, mid: x.mid, kimga: kot.fish, kimBerdi: u.fish,
      muddat: TS.topIshKun(hozirIsoHm(), 1).replace(/^(\d{4})-(\d{2})-(\d{2}) (.*)$/, '$3.$2.$1 $4'), muhim: 'Oddiy' }, R);
    return { row, kot };
  });
  topTgYubor(u.kod, [w.row], XD);
  await yangila([TOP_V]);
  return { ok: true, kimga: w.kot.fish };
}
function topTgYubor(kod, rows, XD) {   // topTg_ (topshiriq_yoz.js topTg bilan bir xil)
  const Gr = {}; rows.forEach(r => (Gr[r.kimga] = Gr[r.kimga] || []).push(r));
  Object.keys(Gr).forEach(f => { const x = XD.find(z => z.fish === f); if (!x || !x.tg) return; tgFon(kod, 'koprikTgChat', [x.tg, TP.topTgMatn(Gr[f])]); });
}
// ------------------------------------------------------------------ ✖ kotiba: menga berilmagan
async function yuTgXodim(kod, fish, matn) {   // yuTgXodim_: 07_Xodimlar (hamma qatorlar) — xodimTeng, U ustuni
  if (!fish) return;
  const r = (await V.qatorlar('07_Xodimlar')).map(z => z.x).find(z => xodimTeng(s(z[1]), fish));
  const tg = r ? s(r[20]).trim() : ''; if (tg) tgFon(kod, 'koprikTgChat', [tg, matn]);
}
async function topSkanBerilmagan(args) {
  const [kodSes, id, izoh0] = args;
  const u = await S.ruxsat(kodSes);
  if (!(await serverda(u.kod))) return eskiTizim('topSkanBerilmagan', u, args.slice(1));
  const w = await QY.qulf('topshiriq', async () => {
    const R = await TP.topRowsYangi(TOP_V); const x = R.L.find(t => s(t.id) === s(id));
    if (!x) throw new S.Xato('Topshiriq topilmadi.');
    if (!/^skanz\|/.test(x.kalit)) throw new S.Xato('Bu tugma faqat kotibaga topshirilgan nusxa topshirig\'iga ishlaydi.');
    if (!u.admin && !xodimTeng(x.kimga, u.fish)) throw new S.Xato('Bu topshiriq sizga berilmagan.');
    if (x.holati !== 'Jarayonda') throw new S.Xato('Topshiriq «' + x.holati + '» holatida.');
    const izoh = s(izoh0 || '').replace(/\s+/g, ' ').trim(); if (izoh.length < 3) throw new S.Xato('Qisqa izoh yozing (kamida 3 belgi).');
    const no = x.no || x.kalit.split('|')[1];
    await TP.topYop(TOP_V, x, 'Bekor', u.fish, 'Menga berilmagan: ' + izoh);
    const ota = R.L.filter(t => t.kalit === 'skanu|' + no && t.holati === 'Bajarildi' && /^Nusxa kotibaga topshirildi/.test(t.dalil)).pop();
    if (ota) {
      await TP.topYop(TOP_V, ota, 'Jarayonda', '', '');
      await G.yoz(env.aksBazaId, [{ varaq: TOP_V, katak: 'G' + ota.qator, qiymat: [[(ota.izoh ? ota.izoh + ' | ' : '') + 'Kotiba: nusxa menga berilmagan — «' + izoh + '»']] }], env.googleKey);
    }
    return { ota, no, izoh };
  });
  if (w.ota) await yuTgXodim(u.kod, w.ota.kimga, '↩ <b>' + w.no + '</b> — kotiba (' + u.fish + '): shartnoma nusxasi unga berilmagan.\nIzoh: «' + w.izoh + '»\nNusxani kotibaga bering yoki o\'zingiz skanerlab yuklang. AKS → 📌 Topshiriqlar');
  await yangila([TOP_V]);
  return { ok: true, kimga: w.ota ? w.ota.kimga : '' };
}

module.exports = { topBajardim, topSkanZaynabga, topSkanBerilmagan };
