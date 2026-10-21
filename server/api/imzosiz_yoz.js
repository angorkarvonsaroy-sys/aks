// AKS TIZIM — ✕ IMZOLANMAGAN IJARA SHARTNOMASINI BEKOR QILISH — yozuvlar serverda (ImzosizBekor.gs v1.1 bilan bir xil tekshiruvlar,
// xato matnlari, kataklar va Telegram):
//   ijaraImzosizSorov — shartnomani tuzgan xodim (04 Masul_xodim) direktordan so'raydi: 06l_Imzosiz_sorovlar ga qator («Kutilmoqda»), guruhga Telegram.
//   ijaraImzosizJavob — direktor ✅ / ✖ («👔 Direktor → Tasdiqlar»): ✅ — shartlar QAYTA tekshiriladi va bekor qilinadi (04 C «Bekor qilindi», D bugun,
//     W izoh; 06j_Tahrir_jurnali «Holati: Aktiv → Bekor qilindi»; 01 nazorati), 06l H:K javob; ikkala holda xodimga shaxsiy Telegram.
//   (ijaraImzosizBekor — direktor darhol — hali eski tizimda; o'qishlar ijaraImzosizRoyxat / ijaraImzosizHolat — api/taminot.js.)
// Shartlar: IJ-27/…, 04 «Aktiv», imzolangan SHARTNOMA skani (06d Faol) yo'q, 05 / 05b (Буферда) to'lov yo'q, 06h da ochiq bekor so'rovi yo'q.
// Yoqilishi: Redis yozuv_yondi:imzosiz («aks-yozuv-sinov imzosiz») va Koprik ≥ 1.5 (Telegram). Aks holda — eski tizim.
'use strict';
const crypto = require('crypto');
const S = require('./sessiya');
const V = require('../lib/varaq');
const G = require('../lib/google');
const env = require('../lib/env');
const J = require('../lib/jurnallar');
const koprik = require('./koprik');
const tetik = require('../lib/kozgu_tetik');
const { redis } = require('../lib/db');
const { xodimTeng } = require('../lib/xodim');
const TP = require('./topshiriq_yoz')._ichki;
const TY = require('./tahrir_yoz')._ichki;

const IMZ_VARAQ = '06l_Imzosiz_sorovlar', S4_V = '04_Ijara_shartnomalar', JUR_V = '06j_Tahrir_jurnali', D1_V = '01_Dokonlar';
const IMZ_SARLAVHA = ['ID', 'Vaqt', 'Shartnoma_№', 'Mijoz_FISH', 'Dokon_ID', 'Kim', 'Sabab', 'Holati', 'Javob', 'Javob_vaqt', 'Javob_kim'];
const BEKOR_YOPIQ = ['Bekor qilindi', 'Rad etildi', 'Qaytarildi'];
const s = v => String(v == null ? '' : v);
const kut = (p, ms) => Promise.race([p, new Promise(r => setTimeout(r, ms))]);
const yangila = nomlar => kut(tetik.varaqlarYangila(nomlar).catch(e => console.error('ko\'zgu (imzosiz):', e.message)), 15000);
function hozir() { const d = new Date(Date.now() + 5 * 3600 * 1000), p = n => String(n).padStart(2, '0');
  const dmy = p(d.getUTCDate()) + '.' + p(d.getUTCMonth() + 1) + '.' + d.getUTCFullYear();
  return { dmy, dmyHm: dmy + ' ' + p(d.getUTCHours()) + ':' + p(d.getUTCMinutes()), iso: d.toISOString().slice(0, 10) }; }
function yozilmadi(e) { if (e instanceof G.RuxsatYoq) e.yozilmadi = true; return e; }

async function serverda(kod) {
  try { if ((await redis.get('yozuv_yondi:imzosiz')) !== '1') return false; } catch (e) { return false; }
  return TP.koprik15(kod);
}
async function eskiTizim(fn, u, args) { const r = await koprik.chaqir(fn, u.kod, args); await tetik.yangilaKut(20000); return r; }
const tgFon = (kod, fn, a) => { koprik.chaqir(fn, kod, a).catch(e => console.error(fn + ' (imzosiz):', e.message)); };
async function qulfBilan(ish) {   // LockService.getScriptLock() o'rni
  const kalit = 'qulf:imzosiz', belgi = crypto.randomBytes(8).toString('hex'), t0 = Date.now();
  while (!(await redis.set(kalit, belgi, 'PX', 30000, 'NX'))) { if (Date.now() - t0 > 30000) throw new S.Xato('Tizim band — birozdan keyin qayta urinib ko\'ring.'); await new Promise(r => setTimeout(r, 150)); }
  try { return await ish(); } finally { if ((await redis.get(kalit)) === belgi) await redis.del(kalit); }
}

// ------------------------------------------------------------------ o'qish (Google'dan YANGI)
// imzSorovlar_: 06l (getDisplayValues), A ustunining oxirgi to'ldirilgan qatorigacha; l — ustunA_oxiri_
async function imzSorovlarYangi(varaq) {
  const R = await G.oraliqOqi(env.aksBazaId, varaq || IMZ_VARAQ, 'A2:K', env.googleKey);
  let m = -1; R.forEach((r, i) => { if (s(r[0]) !== '') m = i; });
  const L = R.slice(0, m + 1).map((r0, i) => { const r = []; for (let k = 0; k < 11; k++) r.push(s(r0[k]));
    return { qator: i + 2, id: r[0], vaqt: r[1], no: r[2].trim(), fish: r[3], dokon: r[4], kim: r[5], sabab: r[6], holati: r[7], javob: r[8], javobVaqt: r[9], javobKim: r[10] }; }).filter(z => z.id);
  return { L, l: m + 2 };
}
// imzTekshir_: shartlarni tekshiradi, { qator, no, dokon, mid, fish, masul } qaytaradi yoki xato (bazaga yozmaydi). 04 — Google'dan yangi (24 ustun)
async function imzTekshir(no, v = {}) {
  no = s(no).trim();
  if (!/^IJ-27\/\d+$/.test(no)) throw new S.Xato('Bu yo\'l faqat ijara shartnomasi (IJ-27/…) uchun: ' + no);
  const X4 = await G.oraliqOqi(env.aksBazaId, v.s4 || S4_V, 'A2:X', env.googleKey, 'UNFORMATTED_VALUE');
  let l4 = -1; X4.forEach((r, i) => { if (s(r[0]) !== '') l4 = i; });
  if (l4 < 0) throw new S.Xato('04_Ijara_shartnomalar bo\'sh.');
  const topil = []; X4.slice(0, l4 + 1).forEach((r, i) => { if (s(r[0]).trim() === no) topil.push(i); });
  if (!topil.length) throw new S.Xato('Ijara shartnomasi topilmadi: ' + no);
  if (topil.length > 1) throw new S.Xato(no + ' raqami 04 da ' + topil.length + ' marta uchraydi — avval bazada qo\'lda tekshiring.');
  const r = []; for (let k = 0; k < 24; k++) r.push(X4[topil[0]][k] == null ? '' : X4[topil[0]][k]);
  const holati = s(r[2]).trim();
  if (holati !== 'Aktiv') throw new S.Xato(no + ' holati «' + (holati || 'bo\'sh') + '» — faqat «Aktiv» shartnoma shu yo\'l bilan bekor qilinadi.');
  if ((await J.hujjatJurnal()).some(h => h.no === no && h.turi === 'SHARTNOMA' && h.holati === 'Faol'))
    throw new S.Xato(no + ' ga imzolangan shartnoma skani yuklangan — demak u imzolangan. Bu yo\'l faqat imzolanmagan shartnoma uchun; «✂ Bekor qilishga kiritish» tartibidan foydalaning.');
  const soni = async (nom, shart) => { const R = await G.oraliqOqi(env.aksBazaId, nom, 'A2:G', env.googleKey, 'UNFORMATTED_VALUE');
    let m = -1; R.forEach((z, i) => { if (s(z[0]) !== '') m = i; });
    return R.slice(0, m + 1).filter(z => s(z[2]).trim() === no && (!shart || shart(z))).length; };
  const t5 = await soni('05_Tolovlar'), t5b = await soni('05b_Bufer_tolovlar', z => s(z[6]).trim() === 'Буферда');
  if (t5 || t5b) throw new S.Xato(no + ' bo\'yicha to\'lov bor (' + (t5 ? '05_Tolovlar: ' + t5 + ' ta' : '') + (t5 && t5b ? ', ' : '') + (t5b ? 'buferda: ' + t5b + ' ta' : '') + ') — imzolanmagan deb bekor qilib bo\'lmaydi.');
  const och = (await J.bekorJurnal()).find(z => z.no === no && BEKOR_YOPIQ.indexOf(z.holati) < 0);
  if (och) throw new S.Xato(no + ' bo\'yicha ochiq bekor so\'rovi bor: ' + och.raqam + ' (' + och.holati + ') — avval uni yoping.');
  return { qator: topil[0] + 2, no, dokon: s(r[4]).trim(), mid: s(r[5]).trim(), fish: s(r[23]).trim(), masul: s(r[20]).trim() };
}
const imzMasul = (masul, fish) => !!s(masul).trim() && xodimTeng(masul, fish);

// ------------------------------------------------------------------ yozuv yadrolari (sinov ham shularni ishlatadi — nusxa varaqda)
// imzBekorQil_: 04 (C, D, W) + 06j + 01 nazorati. Qaytaradi ogohlantirishlar ro'yxati. v — {s4, jurnal} (sinov nusxalari)
async function imzBekorQil(u, x, sabab, usul, v = {}) {
  const s4 = v.s4 || S4_V, jv = v.jurnal || JUR_V, h = hozir();
  const ogoh = [];
  try {
    await G.yoz(env.aksBazaId, [{ varaq: s4, katak: 'C' + x.qator, qiymat: [['Bekor qilindi']] }], env.googleKey);
    await G.sanaYoz(env.aksBazaId, [{ varaq: s4, qator: x.qator, ustun: 4, iso: h.iso }], env.googleKey);   // setValue('dd.MM.yyyy').setNumberFormat('dd.MM.yyyy')
    const W = (await G.oraliqOqi(env.aksBazaId, s4, 'W' + x.qator, env.googleKey, 'FORMULA'))[0] || [];
    if (typeof W[0] === 'string' && W[0][0] === '=') ogoh.push('04 Izoh ustunida formula bor — izoh yozilmadi.');
    else {
      const eski = s(((await G.oraliqOqi(env.aksBazaId, s4, 'W' + x.qator, env.googleKey))[0] || [])[0]).trim();
      await G.yoz(env.aksBazaId, [{ varaq: s4, katak: 'W' + x.qator, qiymat: [[(eski ? eski + ' | ' : '') + 'Imzolanmagan, kuchga kirmagan — ' + h.dmy + ' bekor qilindi (' + u.fish + '): ' + sabab]] }], env.googleKey);
    }
    let bor = true; try { await G.gid(env.aksBazaId, jv, env.googleKey); } catch (e) { bor = false; }
    if (bor) await TY.jurnalYoz(jv, [[h.dmyHm, x.no, 'Ijara', x.mid, 'Holati', 'Aktiv', 'Bekor qilindi', u.fish, usul]]);
    else ogoh.push('06j_Tahrir_jurnali varag\'i topilmadi — jurnalga yozilmadi.');
  } catch (e) { throw yozilmadi(e); }
  if (x.dokon && !v.s4) {   // 01 formulalari — faqat haqiqiy 04 dan keyin ma'noli
    const D = await G.oraliqOqi(env.aksBazaId, D1_V, 'A2:V641', env.googleKey);
    const k = D.findIndex(z => s(z[0]).trim() === x.dokon);
    if (k < 0) ogoh.push('Do\'kon ' + x.dokon + ' 01_Dokonlar da topilmadi — qo\'lda tekshiring.');
    else if (s(D[k][21]).trim() === x.no) ogoh.push('01_Dokonlar hali ham ' + x.no + ' ni ko\'rsatyapti — bazani tekshiring.');
  }
  return ogoh;
}
// 06l yangi so'rov qatori (A:K) — ID = eng kattasi + 1, A ustunining oxirgi to'ldirilgan qatoridan keyin. Qaytaradi { id, qator }
async function imzSorovYoz(varaq, R, o) {
  const id = (R.L.length ? Math.max(...R.L.map(z => Number(z.id) || 0)) : 0) + 1;
  try { const q = await G.qatorQoshR(env.aksBazaId, varaq, R.l + 1, [id, hozir().dmyHm, o.no, o.fish, o.dokon, o.kim, o.sabab, 'Kutilmoqda', '', '', ''], env.googleKey); return { id, qator: q }; }
  catch (e) { throw yozilmadi(e); }
}
// imzJavobYoz_: 06l H:K — [Holati, Javob, Javob_vaqt, Javob_kim]
async function imzJavobYoz(varaq, sr, holati, javob, kim) {
  try { await G.yoz(env.aksBazaId, [{ varaq, katak: 'H' + sr.qator + ':K' + sr.qator, qiymat: [[holati, javob || '', hozir().dmyHm, kim]] }], env.googleKey); }
  catch (e) { throw yozilmadi(e); }
}
// imzXodimTg_: so'rov yuborgan xodimga shaxsiy Telegram (07: B FISH, U Telegram_ID); yuborib bo'lmasa — jim
async function imzXodimTg(kod, sr, ha, izoh) {
  try {
    const r = (await V.qatorlar('07_Xodimlar')).map(z => z.x).find(z => s(z[1]).trim() === s(sr.kim).trim());
    if (!r || !s(r[20]).trim()) return;
    tgFon(kod, 'koprikTgChat', [s(r[20]).trim(), (ha ? '✅' : '✖') + ' <b>So\'rovingiz</b> (imzolanmagan ijarani bekor qilish ' + sr.no + '): ' + (ha ? 'tasdiqlandi — shartnoma bekor qilindi, do\'kon bo\'shadi' : 'rad etildi') + (izoh ? '\n«' + izoh + '»' : '')]);
  } catch (e) { }
}

// ------------------------------------------------------------------ ijaraImzosizSorov(kod, no, sabab) — xodim → direktorga so'rov
async function ijaraImzosizSorov(args) {
  const [kodSes, no0, sabab0] = args;
  const u = await S.ruxsat(kodSes, 'shartnoma');
  const no = s(no0).trim(), sabab = s(sabab0).replace(/\s+/g, ' ').trim();
  if (!/^IJ-27\/\d+$/.test(no)) throw new S.Xato('Bu yo\'l faqat ijara shartnomasi (IJ-27/…) uchun: ' + no);
  if (sabab.length < 5) throw new S.Xato('Sababini yozing (kamida 5 belgi).');
  if (!(await serverda(u.kod))) return eskiTizim('ijaraImzosizSorov', u, [no, sabab]);
  const r = await qulfBilan(async () => {
    const x = await imzTekshir(no);
    if (!u.admin && !imzMasul(x.masul, u.fish)) throw new S.Xato('Bu shartnomani ' + (x.masul || 'boshqa xodim') + ' tuzgan — so\'rovni faqat u yuboradi.');
    let R; try { await G.gid(env.aksBazaId, IMZ_VARAQ, env.googleKey); R = await imzSorovlarYangi(); } catch (e) { const z = new Error('06l varag\'i yo\'q'); z.yozilmadi = true; throw z; }   // imzVaraq_ yaratadi — eski tizimga
    if (R.L.some(z => z.no === no && z.holati === 'Kutilmoqda')) throw new S.Xato('Bu shartnoma bo\'yicha so\'rov allaqachon yuborilgan — direktor javobini kuting.');
    const w = await imzSorovYoz(IMZ_VARAQ, R, { no, fish: x.fish, dokon: x.dokon, kim: u.fish, sabab });
    return Object.assign(w, { x });
  }).catch(e => { if (e.yozilmadi) return null; throw e; });
  if (!r) return eskiTizim('ijaraImzosizSorov', u, [no, sabab]);
  tgFon(u.kod, 'koprikTgYubor', ['📨 <b>Direktorga so\'rov</b> — ' + u.fish + ': imzolanmagan ijarani bekor qilish <b>' + no + '</b> (' + r.x.fish + ', ' + r.x.dokon + ')\n«' + sabab + '»\nJavob — ilovada 👔 Direktor → Tasdiqlar.']);
  await yangila([IMZ_VARAQ]);
  return { ok: true, id: r.id, no };
}

// ------------------------------------------------------------------ ijaraImzosizJavob(kod, id, ha, izoh) — direktor ✅ / ✖
async function ijaraImzosizJavob(args) {
  const [kodSes, id, ha0, izoh0] = args;
  const u = await S.ruxsat(kodSes, 'admin');
  const ha = !!ha0, izoh = s(izoh0).replace(/\s+/g, ' ').trim();
  if (!ha && izoh.length < 5) throw new S.Xato('Rad etish sababini yozing (kamida 5 belgi).');
  if (!(await serverda(u.kod))) return eskiTizim('ijaraImzosizJavob', u, [id, ha0, izoh0]);
  const r = await qulfBilan(async () => {
    const R = await imzSorovlarYangi();
    const sr = R.L.find(z => s(z.id) === s(id));
    if (!sr) throw new S.Xato('So\'rov topilmadi (ID ' + id + ').');
    if (sr.holati !== 'Kutilmoqda') throw new S.Xato('Bu so\'rovga allaqachon javob berilgan: ' + sr.holati + '.');
    let natija = '', ogoh = [], x = null;
    if (ha) {
      x = await imzTekshir(sr.no);   // holat o'zgargan bo'lsa (skan yuklangan, to'lov kelgan) — shu yerda to'xtaydi
      const sab = 'xodim so\'rovi (' + sr.kim + '): ' + sr.sabab + (izoh ? ' · ' + izoh : '');
      ogoh = await imzBekorQil(u, x, sab, 'direktor tasdiqladi — ' + sab);
      natija = sr.no + ' bekor qilindi, do\'kon ' + x.dokon + ' bo\'shadi.' + (ogoh.length ? ' ⚠ ' + ogoh.join(' ') : '');
    } else natija = sr.no + ' bo\'yicha so\'rov rad etildi.';
    await imzJavobYoz(IMZ_VARAQ, sr, ha ? 'Tasdiqlandi' : 'Rad etildi', izoh, u.fish);
    return { sr, natija, x };
  }).catch(e => { if (e.yozilmadi) return null; throw e; });
  if (!r) return eskiTizim('ijaraImzosizJavob', u, [id, ha0, izoh0]);
  await imzXodimTg(u.kod, r.sr, ha, izoh);
  await yangila(ha ? [IMZ_VARAQ, S4_V, JUR_V] : [IMZ_VARAQ]);
  return { ok: true, natija: r.natija };
}

module.exports = { ijaraImzosizSorov, ijaraImzosizJavob };
module.exports._ichki = { imzSorovlarYangi, imzTekshir, imzBekorQil, imzSorovYoz, imzJavobYoz, IMZ_VARAQ, IMZ_SARLAVHA, S4_V, JUR_V };
