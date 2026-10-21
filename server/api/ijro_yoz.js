// AKS TIZIM — 📒 IJRO INTIZOMI yozuvlari serverda (Ijro.gs v1.4 bilan bir xil tekshiruvlar, xato matnlari, kataklar va Telegram):
//   ijroTekshirJavob — 🎲 tekshiruv qo'ng'irog'iga tekshiruvchi javobi (📌 kartaning o'zidan): ✅ ha / ❌ yoq / 📵 aloqa.
//     06p_Tekshiruv M:O (Holati, Izoh, Javob_vaqt), 10_Topshiriqlar N:R (topYop_ — Bajarildi), ❌ bo'lsa — 06q_Qoidabuzarlik «soxta» (ijroDarhol_:
//     xodimga Telegram + zinapoya) va direktor(lar)ga Telegram; 📵 bo'lsa (1-urinish) — ertangi ish kuniga qayta tekshiruv (ijroTekYarat_: yangi
//     topshiriq + 06p qatori). Zinapoya «bir marta xabar» holati — Redis (ijro_zina:<oy>:<xodim>; eski tizimda Script Properties — alohida).
// Yoqilishi: Redis yozuv_yondi:ijro_tekshir («aks-yozuv-sinov tekshir») va Koprik ≥ 1.5 (Telegram). Aks holda — eski tizim.
'use strict';
const S = require('./sessiya');
const V = require('../lib/varaq');
const G = require('../lib/google');
const env = require('../lib/env');
const J = require('../lib/jurnallar');
const U = require('../lib/undiruv_yordam');
const X = require('../lib/xat_yordam');
const koprik = require('./koprik');
const tetik = require('../lib/kozgu_tetik');
const { redis } = require('../lib/db');
const { xodimTeng } = require('../lib/xodim');
const { qisqaIsm } = require('../lib/ism');
const TP = require('./topshiriq_yoz')._ichki;

const IJRO_VARAQ = '06q_Qoidabuzarlik', IJRO_TEK = '06p_Tekshiruv', TOP_V = TP.TOP_V;
const IJRO_S = ['ID', 'Sana', 'Xodim', 'Tur', 'Nomi', 'Ogirlik', 'Ball', 'Shartnoma', 'Mijoz', 'Tafsilot', 'Holati', 'Uzr_sababi', 'Uzr_kim', 'Tushuntirish', 'Tushuntirish_vaqt', 'Kalit', 'Yozildi'];
const IJRO_TS = ['ID', 'Tanlandi', 'Jurnal_ID', 'Yozuv_sanasi', 'Shartnoma', 'Mijoz', 'Undiruvchi', 'Chora', 'Mazmun', 'Tekshiruvchi', 'Topshiriq_ID', 'Urinish', 'Holati', 'Izoh', 'Javob_vaqt'];
const IJRO_TUR = {
  reja: ['Kunlik reja bajarilmadi', 'o\'rta'], nazorat: ['Nazorat qo\'ng\'irog\'i / va\'da eslatmasi qilinmadi', 'yengil'],
  xat: ['Xat chiqarilgan kuni yetkazilmadi', 'o\'rta'], xat3: ['Xat 3 kundan beri yetkazilmadi', 'og\'ir'],
  tashrif: ['Uyiga borish isbotsiz (rasm yo\'q)', 'o\'rta'], top: ['Topshiriq muddati o\'tdi', 'yengil'],
  otkaz: ['«Bugun qila olmayman» kuniga 3 tadan ko\'p', 'yengil'], soxta: ['Tasodifiy tekshiruvda tasdiqlanmadi', 'og\'ir'],
  tasdiq: ['Isbotni muddatida tekshirmadi', 'yengil'], yuqabul: ['Yuristga o\'tgan ishni muddatida qabul qilmadi', 'yengil'],
  yubosqich: ['Sud ishini muddatida yuritmadi (yurist bosqichi)', 'o\'rta'], isbotrad: ['Xat isboti tekshiruvda qaytarildi', 'o\'rta'] };
const IJRO_ZINA = [1, 3, 5], IJRO_OGIR_BALL = 3;

const s = v => String(v == null ? '' : v);
const kut = (p, ms) => Promise.race([p, new Promise(r => setTimeout(r, ms))]);
const yangila = nomlar => kut(tetik.varaqlarYangila(nomlar).catch(e => console.error('ko\'zgu (ijro):', e.message)), 15000);
const esc = v => s(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const ijroIso = v => typeof v === 'number' ? V.iso(v) : X.xatIso(s(v).slice(0, 10));
const ijroDmy = iso => iso ? s(iso).slice(0, 10).split('-').reverse().join('.') : '';
const ijroBall = q => IJRO_TUR[q.Tur] && IJRO_TUR[q.Tur][1] === 'og\'ir' ? IJRO_OGIR_BALL : 1;
const ijroPog = ball => ball >= IJRO_ZINA[2] ? 3 : ball >= IJRO_ZINA[1] ? 2 : ball >= IJRO_ZINA[0] ? 1 : 0;
const qdPul = n => Math.round(Number(n) || 0).toLocaleString('ru-RU').replace(/[  ,]/g, ' ');
function hozirIso() { const d = new Date(Date.now() + 5 * 3600 * 1000); return d.toISOString().slice(0, 10) + ' ' + d.toISOString().slice(11, 19); }
const ustunHarf = n => { let r = ''; while (n > 0) { const m = (n - 1) % 26; r = String.fromCharCode(65 + m) + r; n = Math.floor((n - 1) / 26); } return r; };
function yozilmadi(e) { if (e instanceof G.RuxsatYoq) e.yozilmadi = true; return e; }

async function serverda(kod) {
  try { if ((await redis.get('yozuv_yondi:ijro_tekshir')) !== '1') return false; } catch (e) { return false; }
  return TP.koprik15(kod);
}
async function eskiTizim(fn, u, args) { const r = await koprik.chaqir(fn, u.kod, args); await tetik.yangilaKut(20000); return r; }
const tgFon = (kod, fn, a) => { koprik.chaqir(fn, kod, a).catch(e => console.error(fn + ' (ijro):', e.message)); };

// ------------------------------------------------------------------ manbalar
// ijroQator_: varaq qatorlari (Google'dan YANGI, getValues — sanalar seriya raqami), A ustunining oxirgi to'ldirilgan qatorigacha
async function ijroQatorYangi(varaq, Sx) {
  const R = await G.oraliqOqi(env.aksBazaId, varaq, 'A2:' + ustunHarf(Sx.length), env.googleKey, 'UNFORMATTED_VALUE');
  let m = -1; R.forEach((r, i) => { if (r[0] !== '' && r[0] != null) m = i; });
  return R.slice(0, m + 1).map((r, i) => { const o = { qator: i + 2 }; Sx.forEach((k, j) => o[k] = r[j] == null ? '' : r[j]); return o; });
}
// qdXodimlar_: ishlayotgan xodimlar (07, ko'zgu) — huquq, Telegram
async function qdXodimlar() {
  return (await V.qatorlar('07_Xodimlar')).filter(({ x }) => s(x[1]).trim() && s(x[10]).trim() === 'Ishlayapti').map(({ x }) => {
    const h = s(x[18]).toLowerCase().split(/[\s,;]+/).filter(Boolean); const fish = s(x[1]).trim();
    return { fish, ism: fish.split(/\s+/)[1] || fish, huquq: h, tg: s(x[20]).trim(), undiruvchi: h.indexOf('undiruv') >= 0 && h.indexOf('admin') < 0 }; });
}
// ijroOySon_: oy ichidagi uzrsiz ball va soni
function ijroOySon(L, fish, oy) {
  const M = L.filter(q => xodimTeng(q.Xodim, fish) && ijroIso(q.Sana).slice(0, 7) === oy && q.Holati !== 'Uzrli');
  return { soni: M.length, ball: M.reduce((a, q) => a + ijroBall(q), 0), soxta: M.filter(q => q.Tur === 'soxta').length, tushuntirishsiz: M.filter(q => !s(q.Tushuntirish).trim()).length };
}

// ------------------------------------------------------------------ yozuv yadrolari (sinov ham shularni ishlatadi — nusxa varaqda)
// ijroYoz_: 06q ga qoidabuzarlik (takror yozilmaydi — kalit bo'yicha). Qaytaradi { id, tur, nomi, ogirlik, no, tafsilot, qator } yoki null
async function ijroYoz(varaq, o) {
  const T = IJRO_TUR[o.tur]; if (!T || !o.xodim) return null;
  const L = await ijroQatorYangi(varaq, IJRO_S);
  if (o.kalit && L.some(q => s(q.Kalit) === o.kalit)) return null;
  const id = (L.length ? Math.max(...L.map(q => Number(q.ID) || 0)) : 0) + 1;
  const sana = o.sana || V.bugun(), vaqt = hozirIso();
  const row = (L.length ? L[L.length - 1].qator : 1) + 1;
  const ball = T[1] === 'og\'ir' ? IJRO_OGIR_BALL : 1;
  let q;
  try {
    q = await G.qatorQoshR(env.aksBazaId, varaq, row, [id, '', o.xodim, o.tur, T[0], T[1], ball, o.no || '', o.fish || '', s(o.tafsilot).slice(0, 900), 'Hisobda', '', '', '', '', o.kalit || '', ''], env.googleKey);
    await G.sanaYoz(env.aksBazaId, [{ varaq, qator: q, ustun: 2, iso: sana }, { varaq, qator: q, ustun: 17, iso: vaqt, naqsh: 'dd.MM.yyyy HH:mm' }], env.googleKey);
  } catch (e) { throw yozilmadi(e); }
  return { id, tur: o.tur, nomi: T[0], ogirlik: T[1], no: o.no || '', tafsilot: o.tafsilot || '', qator: q };
}
// ijroZina_: zinapoya — yangi pog'onaga chiqqanda bir marta xabar (holat — Redis)
async function ijroZina(kod, fish, XD, L) {
  const oy = V.bugun().slice(0, 7); L = L || await ijroQatorYangi(IJRO_VARAQ, IJRO_S);
  const Sn = ijroOySon(L, fish, oy), p = ijroPog(Sn.ball);
  const k = 'ijro_zina:' + oy + ':' + Buffer.from(s(fish)).toString('base64url');
  let old = 0; try { old = Number(await redis.get(k)) || 0; } catch (e) { }
  if (p <= old || p < 2) { if (p > old) try { await redis.set(k, String(p)); } catch (e) { } return p; }
  try { await redis.set(k, String(p)); } catch (e) { }
  XD = XD || await qdXodimlar(); const x = XD.find(z => xodimTeng(z.fish, fish)), adm = XD.filter(z => z.huquq.indexOf('admin') >= 0 && z.tg);
  const M = L.filter(q => xodimTeng(q.Xodim, fish) && ijroIso(q.Sana).slice(0, 7) === oy && q.Holati !== 'Uzrli');
  const ro = M.slice(-8).map(q => '• ' + ijroDmy(ijroIso(q.Sana)) + ' — ' + q.Nomi + (q.Shartnoma ? ' (' + q.Shartnoma + ')' : '') + (q.Tushuntirish ? ' — «' + esc(s(q.Tushuntirish).slice(0, 80)) + '»' : '')).join('\n');
  const dir = p === 2 ? '⚠️ <b>' + esc(fish) + '</b> — bu oy ' + Sn.ball + ' ball qoidabuzarlik (2-pog\'ona). Undan yozma tushuntirish so\'raldi.\n' + ro
    : '⛔ <b>' + esc(fish) + '</b> — bu oy ' + Sn.ball + ' ball qoidabuzarlik (3-pog\'ona): <b>intizomiy jazo masalasi</b>. Dalillar:\n' + ro + '\n\nIlovada: 📒 Ijro intizomi.';
  const xod = p === 2 ? '⚠️ <b>Ikkinchi pog\'ona.</b> Bu oy ' + Sn.ball + ' ball qoidabuzarlik. Har biriga ilovada («📒 Ijro intizomi») yozma tushuntirish yozing — direktor ko\'radi.'
    : '⛔ <b>Uchinchi pog\'ona.</b> Bu oy ' + Sn.ball + ' ball qoidabuzarlik. Masala direktorga intizomiy jazo uchun yuborildi. Tushuntirishlaringizni yozing.';
  if (adm.length) adm.forEach(a => tgFon(kod, 'koprikTgChat', [a.tg, dir])); else tgFon(kod, 'koprikTgYubor', [dir]);
  if (x && x.tg) tgFon(kod, 'koprikTgChat', [x.tg, xod]);
  return p;
}
// ijroDarhol_: darhol yoziladigan qoidabuzarlik — yozadi + xodimga Telegram + zinapoya
async function ijroDarhol(kod, o) {
  const q = await ijroYoz(IJRO_VARAQ, o); if (!q) return null;
  try {
    const XD = await qdXodimlar(); const x = XD.find(z => xodimTeng(z.fish, o.xodim));
    const L = await ijroQatorYangi(IJRO_VARAQ, IJRO_S); const Sn = ijroOySon(L, o.xodim, V.bugun().slice(0, 7));
    if (x && x.tg) tgFon(kod, 'koprikTgChat', [x.tg, '⚠️ <b>Qoidabuzarlik qayd etildi</b>: ' + q.nomi + (q.no ? ' · ' + q.no : '') + '\n' + esc(q.tafsilot)
      + '\n\nBu oy: <b>' + Sn.ball + '</b> ball. Ilovada «📒 Ijro intizomi» bo\'limida tushuntirish yozishingiz mumkin.']);
    await ijroZina(kod, o.xodim, XD, L);
  } catch (e) { console.error('ijroDarhol:', e.message); }
  return q;
}
// ijroTekYarat_: qayta tekshiruv — yangi topshiriq (kalit tekshir|<jurnal>|<urinish>) + 06p qatori. R — topRowsYangi natijasi
async function tekYarat(j, x, und, kimga, urinish, bugun, R, varaqlar) {
  const vq = varaqlar || {}; const topV = vq.top || TOP_V, tekV = vq.tek || IJRO_TEK;
  const tel = s(x.tel).split(',').map(z => z.trim()).filter(Boolean)[0] || '';
  const sav = j.chora === 'Телефон' ? 'siz bilan telefonda gaplashdimi' : j.chora === 'Офисда суҳбат' ? 'siz bilan ofisda gaplashdimi' : 'uyingizga kelib gaplashdimi';
  const t = await TP.topYoz(topV, { manba: 'Tizim', qoida: 'tekshir', kalit: 'tekshir|' + j.id + '|' + urinish, sarlavha: '🎲 Tekshiruv qo\'ng\'irog\'i: ' + x.no + ' ' + qisqaIsm(x.fish) + (urinish > 1 ? ' (qayta)' : ''),
    izoh: 'Mijozdan so\'rang: «' + ijroDmy(j.sana) + ' kuni xodimimiz ' + qisqaIsm(und) + ' ' + sav + '? Nima kelishildi?»'
      + ' · Jurnalda yozilgan: «' + s(j.mazmun).slice(0, 160) + '»' + (j.vadaSana ? ' · va\'da: ' + ijroDmy(j.vadaSana) + ' gacha ' + qdPul(j.vadaSumma) + ' so\'m' : '') + ' · Tel: ' + tel,
    no: '', mid: '', kimga, kimBerdi: 'tizim', muddat: ijroDmy(bugun) + ' 17:00', muhim: 'Oddiy' }, R);
  const L = await ijroQatorYangi(tekV, IJRO_TS);
  const id = (L.length ? Math.max(...L.map(r => Number(r.ID) || 0)) : 0) + 1, row = (L.length ? L[L.length - 1].qator : 1) + 1;
  let q;
  try {
    q = await G.qatorQoshR(env.aksBazaId, tekV, row, [id, '', j.id, '', x.no, x.fish, und, j.chora, s(j.mazmun).slice(0, 300), kimga, t.id, urinish, 'Kutilmoqda', '', ''], env.googleKey);
    await G.sanaYoz(env.aksBazaId, [{ varaq: tekV, qator: q, ustun: 2, iso: bugun }, { varaq: tekV, qator: q, ustun: 4, iso: j.sana }], env.googleKey);
  } catch (e) { throw yozilmadi(e); }
  return { no: x.no, fish: x.fish, kimga, top: t.id, topQator: t.qator, qator: q, id };
}
// 06p M:O — [Holati, Izoh, Javob_vaqt] (setValues: matn, matn, Date formatsiz → DATE turi, naqshsiz — sinovda eski qator «20.10.2026» ko'rsatdi)
async function tekJavobYoz(varaq, qator, hol, izoh) {
  try {
    await G.yoz(env.aksBazaId, [{ varaq, katak: 'M' + qator + ':N' + qator, qiymat: [[hol, izoh]] }], env.googleKey);
    await G.sanaYoz(env.aksBazaId, [{ varaq, qator, ustun: 15, iso: hozirIso(), naqsh: 'auto' }], env.googleKey);
  } catch (e) { throw yozilmadi(e); }
}

// ------------------------------------------------------------------ ijroTekshirJavob(kod, topId, natija, izoh)
async function ijroTekshirJavob(args) {
  const [kodSes, topId, natija, izoh0] = args;
  const u = await S.foydalanuvchi(kodSes); if (!u) throw new S.Xato('Sessiya tugagan — PIN ni qayta kiriting.');
  if (u.sifat) throw new S.Xato('👁 Ko\'rish rejimida javob berilmaydi.');
  if (!(await serverda(u.kod))) return eskiTizim('ijroTekshirJavob', u, [topId, natija, izoh0]);
  const adm = u.admin, bugun = V.bugun();
  const R = await TP.topRowsYangi(TOP_V);
  const t = R.L.find(z => s(z.id) === s(topId)); if (!t) throw new S.Xato('Topshiriq topilmadi.');
  const p = s(t.kalit).split('|'); if (p[0] !== 'tekshir') throw new S.Xato('Bu tekshiruv topshirig\'i emas.');
  if (t.holati !== 'Jarayonda') throw new S.Xato('Bu tekshiruvga allaqachon javob berilgan.');
  if (!adm && !xodimTeng(t.kimga, u.fish)) throw new S.Xato('Bu tekshiruv sizga berilmagan.');
  const izoh = s(izoh0).replace(/\s+/g, ' ').trim();
  if (natija === 'yoq' && izoh.length < 5) throw new S.Xato('Mijoz nima deganini yozing.');
  const TL = await ijroQatorYangi(IJRO_TEK, IJRO_TS); const r = TL.find(z => s(z.Topshiriq_ID) === s(t.id));
  const urin = Number(p[2]) || 1;
  const hol = natija === 'ha' ? 'Tasdiqlandi' : natija === 'yoq' ? 'Tasdiqlanmadi' : (urin >= 2 ? 'Tekshirib bo\'lmadi' : 'Bog\'lanib bo\'lmadi');
  try {
    if (r) await tekJavobYoz(IJRO_TEK, r.qator, hol, izoh);
    await TP.topYop(TOP_V, t, 'Bajarildi', u.fish, hol + (izoh ? ': ' + izoh : ''));
  } catch (e) { if (e.yozilmadi) return eskiTizim('ijroTekshirJavob', u, [topId, natija, izoh0]); throw e; }   // robotda yozish yo'q — hech narsa yozilmagan
  let qayta = false;
  const varaqlar = [TOP_V, IJRO_TEK];
  if (natija === 'yoq' && r) {
    varaqlar.push(IJRO_VARAQ);
    await ijroDarhol(u.kod, { xodim: s(r.Undiruvchi), tur: 'soxta', kalit: 'soxta|' + r.Jurnal_ID, no: s(r.Shartnoma), fish: s(r.Mijoz),
      tafsilot: ijroDmy(ijroIso(r.Yozuv_sanasi)) + ' «' + r.Chora + '» yozuvi: «' + s(r.Mazmun).slice(0, 120) + '». Mijoz: «' + izoh + '» (tekshirdi: ' + u.fish + ')' });
    try { const XD = await qdXodimlar(); const m = '❌ <b>Tekshiruvda tasdiqlanmadi</b>: ' + esc(r.Undiruvchi) + ' — ' + r.Shartnoma + ' ' + esc(qisqaIsm(r.Mijoz)) + '\n'
      + ijroDmy(ijroIso(r.Yozuv_sanasi)) + ' jurnalda: «' + esc(s(r.Mazmun).slice(0, 160)) + '»\nMijoz: «' + esc(izoh) + '»\nTekshirdi: ' + esc(u.fish);
      const adm2 = XD.filter(z => z.huquq.indexOf('admin') >= 0 && z.tg); if (adm2.length) adm2.forEach(a => tgFon(u.kod, 'koprikTgChat', [a.tg, m])); else tgFon(u.kod, 'koprikTgYubor', [m]); } catch (e) { console.error('soxta tg:', e.message); }
  }
  if (natija === 'aloqa' && urin < 2 && r) {   // ertaga (ish kuni) qayta
    const d = new Date(bugun + 'T12:00:00Z'); const ert = new Date(d.getTime() + (d.getUTCDay() === 6 ? 2 : 1) * 86400000);
    const x = (await U.undShartnomalar()).find(z => z.no === s(r.Shartnoma));
    const j = (await J.undJurnal()).find(z => s(z.id) === s(r.Jurnal_ID));
    if (x && j) { await tekYarat(j, x, s(r.Undiruvchi), t.kimga, 2, ert.toISOString().slice(0, 10), await TP.topRowsYangi(TOP_V)); qayta = true; }
  }
  await yangila(varaqlar);
  return { ok: true, holat: hol, natija: hol + (qayta ? ' — ertaga qayta chiqadi' : '') };
}

module.exports = { ijroTekshirJavob };
module.exports._ichki = { ijroYoz, ijroZina, ijroDarhol, tekYarat, tekJavobYoz, ijroQatorYangi, ijroOySon, qdXodimlar, IJRO_S, IJRO_TS, IJRO_TUR, IJRO_VARAQ, IJRO_TEK };
