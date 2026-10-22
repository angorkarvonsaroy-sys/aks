// AKS TIZIM — 📮 DEVONXONA: devonKirimSaqla serverda (Devon.gs v1.5 bilan bir xil tekshiruvlar, xato matnlari, 11_Devonxona qatori, tarix va javob).
// Tartib eski tizimdagidek: tekshiruvlar → qulf → takror xat tekshiruvi → tartib raqami → skan Drive'ga («AKS TIZIM / 08 DEVONXONA / Kirim / <yil>»,
// Koprik v1.12 koprikDevonSaqla — direktor hisobi) → 11_Devonxona ga qator → qulf ochiladi → direktor(lar)ga shaxsan Telegram (skan PDF + «📮 Rezolyutsiya
// qo'yish» tugmasi — eski devonDirShaxsiy_ ning o'zi, Koprik v1.12 koprikDevonTg) → natija tarixga; bormasa — kotibaga ogohlantirish.
// devonKordi (v1.5 «DIREKTOR KO'RDI»): direktor kirim xat kartasini / skanini birinchi marta ochganda — Ijro (R) JSON ga «kordi» {v, fish} + tarix; faqat
// «Rezolyutsiya kutmoqda» xatda, bir marta. devonFayl (api/fayl.js) ham shu yadroni chaqiradi. Yoqilishi: yozuv_yondi:devon_kordi (o'sha sinov, Koprik kerak emas).
// Yoqilishi: Redis yozuv_yondi:devon («aks-yozuv-sinov devon») va Koprik ≥ 1.12.
// QOLGAN AMALLAR (22.10.2026, Koprik ≥ 1.15 — koprikDevonSaqla / koprikDevonTg har xodim uchun, Word, bitta xodimga skan): devonChiqimSaqla (tayyor xatni
//   ro'yxatga olish, yuborish isboti), devonChiqimYubor («Tayyorlandi» → «Yuborildi», isbot), devonRezolyutsiya (direktor: 10_Topshiriqlar + 11 K:R + Telegram),
//   devonIjroTopshir (ijrochi/yordamchi: isbot, javob xati, 10 yopish), devonTasdiq (✅ qabul / ↩ qaytarish), devonRezQaytar, devonBekor — bayroq yozuv_yondi:devon2
//   («aks-yozuv-sinov devon2»); devonChiqimYoz (rasmiy blankada xat: PDF + Word serverda — lib/devon_xat.js, fayllar Drive'ga Koprik orqali) — yana yozuv_yondi:devon_xat
//   («aks-yozuv-sinov devonxat» — eski tizim yasagan xatlar bilan so'zma-so'z). Tekshiruvlar, xato matnlari, kataklar, tarix, JSON (R) va Telegram matnlari — Devon.gs bilan aynan.
//   Fayllar (skan, isbot, kvitansiya, PDF/Word) — eski tizimdagidek darhol direktor Drive'iga («08 DEVONXONA / Kirim|Chiqim|Ijro / <yil>»), jadvalda Drive ID.
'use strict';
const crypto = require('crypto');
const { verOk } = require('../lib/versiya');
const S = require('./sessiya');
const G = require('../lib/google');
const env = require('../lib/env');
const koprik = require('./koprik');
const tetik = require('../lib/kozgu_tetik');
const { redis } = require('../lib/db');

const DEVON_V = '11_Devonxona';
const DEVON_S = ['ID', 'Turi', 'Tartib', 'Kiritildi', 'Kim_kiritdi', 'Tashkilot', 'Xat_raqami', 'Xat_sanasi', 'Mazmun', 'Fayl_ID',
  'Holati', 'Ijro_turi', 'Ijrochi', 'Yordamchilar', 'Muddat', 'Rezolyutsiya', 'Rez_vaqt', 'Ijro', 'Tarix', 'Bogliq_ID'];
const DEVON_MAX_MB = 20;
const s = v => String(v == null ? '' : v);
const kut = (p, ms) => Promise.race([p, new Promise(r => setTimeout(r, ms))]);
const yangila = nomlar => kut(tetik.varaqlarYangila(nomlar).catch(e => console.error('ko\'zgu (devon):', e.message)), 15000);
function hozir() { const d = new Date(Date.now() + 5 * 3600 * 1000), p = n => String(n).padStart(2, '0');
  return { dmyHm: p(d.getUTCDate()) + '.' + p(d.getUTCMonth() + 1) + '.' + d.getUTCFullYear() + ' ' + p(d.getUTCHours()) + ':' + p(d.getUTCMinutes()), iso: d.toISOString().slice(0, 10), yil: String(d.getUTCFullYear()) }; }
function yozilmadi(e) { if (e instanceof G.RuxsatYoq) e.yozilmadi = true; return e; }
const xato = m => new S.Xato(m);

// yordamchilar (Devon.gs bilan bir xil)
const devonS = v => s(v).replace(/\s+/g, ' ').trim();
const devonNorm = v => s(v).toLowerCase().replace(/[«»"'`ʻʼ‘’\s.,№#-]/g, '');      // tashkilot nomi solishtirish
const devonRaqNorm = v => s(v).toLowerCase().replace(/[\s№#]/g, '');               // xat raqami: faqat bo'shliq va № belgisi e'tiborsiz
const devonHtml = v => s(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const devonFaylNom = v => s(v).replace(/[\\\/:*?"<>|«»№#]/g, '-').replace(/\s+/g, '_').slice(0, 40);
function devonSana(v, nom, kelajak) {         // 'yyyy-mm-dd' → 'dd.MM.yyyy'
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s(v)); if (!m) throw xato(nom + 'ni tanlang.');
  const bugun = hozir().iso;
  if (!kelajak && v > bugun) throw xato(nom + ' kelajakda bo\'lishi mumkin emas.');
  if (kelajak && v < bugun) throw xato(nom + ' o\'tgan kun bo\'lishi mumkin emas.');
  if (v < '2015-01-01') throw xato(nom + ' juda eski — tekshiring.');
  return m[3] + '.' + m[2] + '.' + m[1];
}
function devonPdf(b64) {
  const bayt = Buffer.from(s(b64), 'base64');
  if (bayt.length < 1000) throw xato('Xat skanini yuklang (kamera yoki PDF).');
  if (bayt.length > DEVON_MAX_MB * 1048576) throw xato('Fayl ' + DEVON_MAX_MB + ' MB dan katta — sahifalarni kamaytiring.');
  if (bayt.subarray(0, 5).toString('latin1') !== '%PDF-') throw xato('Fayl PDF emas. Faqat PDF yoki skanerlash orqali yuklang.');
  return bayt;
}
const devonKeyingi = (R, turi) => R.filter(x => x.turi === turi).reduce((m, x) => Math.max(m, Number(x.tartib) || 0), 0) + 1;

let kv = { ok: false, t: 0 };
async function koprik112(kod) {   // Koprik.gs v1.12 (koprikDevonSaqla, koprikDevonTg) — 30 daqiqa kesh (yo'q bo'lsa 2 daqiqa)
  if (kv.t && Date.now() - kv.t < (kv.ok ? 30 : 2) * 60000) return kv.ok;
  try { kv = { ok: koprik.bor() && verOk(await koprik.chaqir('koprikVersiya', kod, []), '1.12'), t: Date.now() }; } catch (e) { kv = { ok: false, t: Date.now() }; }
  return kv.ok;
}
async function serverda(kod) {
  try { if ((await redis.get('yozuv_yondi:devon')) !== '1') return false; } catch (e) { return false; }
  return koprik112(kod);
}
async function eskiTizim(fn, u, args) { const r = await koprik.chaqir(fn, u.kod, args, { muddat: 120000, urinish: 1 }); await tetik.yangilaKut(20000); return r; }
async function qulfBilan(ish) {   // LockService.getScriptLock() o'rni
  const kalit = 'qulf:devon', belgi = crypto.randomBytes(8).toString('hex'), t0 = Date.now();
  while (!(await redis.set(kalit, belgi, 'PX', 60000, 'NX'))) { if (Date.now() - t0 > 30000) throw xato('Tizim band — birozdan keyin qayta urinib ko\'ring.'); await new Promise(r => setTimeout(r, 150)); }
  try { return await ish(); } finally { if ((await redis.get(kalit)) === belgi) await redis.del(kalit); }
}

// ------------------------------------------------------------------ o'qish (Google'dan YANGI): devonRows_ (getDisplayValues, A oxirigacha); l — ustunA_oxiri_
async function devonRowsYangi(varaq) {
  const X = await G.oraliqOqi(env.aksBazaId, varaq || DEVON_V, 'A2:T', env.googleKey);
  let m = -1; X.forEach((r, i) => { if (s(r[0]) !== '') m = i; });
  const L = X.slice(0, m + 1).map((r0, i) => { const r = []; for (let k = 0; k < DEVON_S.length; k++) r.push(s(r0[k]));
    return { qator: i + 2, id: r[0], turi: r[1], tartib: r[2], kiritildi: r[3], kim: r[4], tashkilot: r[5], raqam: r[6], sana: r[7], mazmun: r[8], fayl: r[9],
      holati: r[10], tur: r[11], ijrochi: r[12], yordam: r[13].split(',').map(z => z.trim()).filter(Boolean), muddat: r[14], rez: r[15], rezVaqt: r[16], ijro: r[17], tarix: r[18], bogliq: r[19] }; }).filter(x => x.id);
  return { L, l: m + 2 };
}

// ------------------------------------------------------------------ yozuv yadrolari (sinov ham shularni ishlatadi — nusxa varaqda)
// devonYoz_: yangi qator (A–T) — ID = eng kattasi + 1, A ustunining oxirgi to'ldirilgan qatoridan keyin. Qaytaradi row (devonRows_ ko'rinishida)
async function devonYoz(varaq, R, o) {
  const id = R.L.reduce((m, x) => Math.max(m, Number(x.id) || 0), 0) + 1;
  const vaqt = hozir().dmyHm;
  const row = [id, o.turi, o.tartib, vaqt, o.kim, o.tashkilot, o.raqam, o.sana, o.mazmun || '', o.fayl,
    o.holati, '', '', '', '', '', '', '', vaqt + ' ' + o.kim + ': kiritildi', o.bogliq || ''];
  let q;
  try { q = await G.qatorQoshR(env.aksBazaId, varaq, R.l + 1, row, env.googleKey); } catch (e) { throw yozilmadi(e); }
  return { qator: q, id: String(id), turi: o.turi, tartib: String(o.tartib), kiritildi: vaqt, kim: o.kim, tashkilot: o.tashkilot, raqam: o.raqam, sana: o.sana,
    mazmun: o.mazmun || '', fayl: o.fayl, holati: o.holati, tur: '', ijrochi: '', yordam: [], muddat: '', rez: '', rezVaqt: '', ijro: '', tarix: row[18], bogliq: s(o.bogliq || '') };
}
// devonTarix_: S ustuniga (eskisiga qo'shib) «dd.MM.yyyy HH:mm matn»
async function devonTarix(varaq, x, matn) {
  const e = s(((await G.oraliqOqi(env.aksBazaId, varaq, 'S' + x.qator, env.googleKey))[0] || [])[0]);
  await G.yoz(env.aksBazaId, [{ varaq, katak: 'S' + x.qator, qiymat: [[(e ? e + '\n' : '') + hozir().dmyHm + ' ' + matn]] }], env.googleKey);
}

// ------------------------------------------------------------------ devonKirimSaqla(kod, d) — kirim xatini saqlash
// d = { tashkilot, raqam, sana 'yyyy-mm-dd', mazmun, b64 (PDF) }
async function devonKirimSaqla(args) {
  const [kodSes, d0] = args; const d = d0 || {};
  const u = await S.ruxsat(kodSes, 'devon');
  const tashkilot = devonS(d.tashkilot), raqam = devonS(d.raqam), mazmun = devonS(d.mazmun).slice(0, 500);
  if (tashkilot.length < 3) throw xato('Tashkilot nomini kiriting.');
  if (!raqam) throw xato('Kirim xat raqamini kiriting.');
  const sana = devonSana(d.sana, 'Kirim xat sanasi');
  const bayt = devonPdf(d.b64);
  if (!(await serverda(u.kod))) return eskiTizim('devonKirimSaqla', u, [d0]);
  let bor = true; try { await G.gid(env.aksBazaId, DEVON_V, env.googleKey, true); } catch (e) { bor = false; }
  if (!bor) return eskiTizim('devonKirimSaqla', u, [d0]);   // devonVaraq_ varaqni eski tizim ochadi
  const row = await qulfBilan(async () => {
    const R = await devonRowsYangi();
    const ayni = R.L.find(x => x.turi === 'Kirim' && x.holati !== 'Bekor' && devonNorm(x.tashkilot) === devonNorm(tashkilot) && devonRaqNorm(x.raqam) === devonRaqNorm(raqam) && x.sana === sana);
    if (ayni) throw xato('Bu xat allaqachon ro\'yxatga olingan: kirim №' + ayni.tartib + ' (' + ayni.tashkilot + ', №' + ayni.raqam + ', ' + ayni.sana + ', ' + ayni.kim + ' kiritgan). Ikkinchi marta saqlanmaydi.');
    const tartib = devonKeyingi(R.L, 'Kirim');
    const nom = 'K-' + tartib + '_' + sana.split('.').reverse().join('-') + '_' + devonFaylNom(tashkilot) + '_' + devonFaylNom(raqam);
    // devonFaylSaqla_: skan direktor Drive'iga — «AKS TIZIM / 08 DEVONXONA / Kirim / <yil>» (eski tizimning o'zi, Koprik v1.12 orqali)
    const f = await koprik.chaqir('koprikDevonSaqla', u.kod, [{ qism: 'Kirim', nom, b64: bayt.toString('base64') }], { muddat: 120000, urinish: 1 });
    if (!f || !f.id) throw new Error('Skan Drive\'ga saqlanmadi (Drive ID qaytmadi).');
    try { return await devonYoz(DEVON_V, R, { turi: 'Kirim', tartib, kim: u.fish, tashkilot, raqam, sana, mazmun, fayl: f.id, holati: 'Rezolyutsiya kutmoqda' }); }
    catch (e) { await yetimTozala(u, f.id); throw e; }   // qator yozilmadi — fayl savatga (har qanday xatoda, 23.10)
  }).catch(e => { if (e.yozilmadi) return null; throw e; });
  if (!row) return eskiTizim('devonKirimSaqla', u, [d0]);   // robotda yozish huquqi yo'q — hech narsa yozilmagan
  // v1.5: direktorga shaxsan — skan bilan, darhol; yuborilmasa sababi tarixga va kotibaga
  const tgM = '📥 <b>Kirim xat №' + row.tartib + '</b> · ' + row.kiritildi
    + '\n<b>Kimdan:</b> ' + devonHtml(tashkilot)
    + '\n<b>Xat:</b> № ' + devonHtml(raqam) + ' · ' + sana
    + (mazmun ? '\n<b>Mazmuni:</b> «' + devonHtml(mazmun) + '»' : '')
    + '\n<b>Kiritdi:</b> ' + devonHtml(u.fish)
    + '\n\nRezolyutsiya: ilovada 👔 Direktor → Tasdiqlar yoki 📮 Devonxona.';
  let tgX = '';
  try { const r = await koprik.chaqir('koprikDevonTg', u.kod, [{ matn: tgM, faylId: row.fayl, tugma: '📮 Rezolyutsiya qo\'yish' }], { muddat: 90000, urinish: 1 }); tgX = s(r && r.xato); }
  catch (e) { tgX = e.message; }
  const ogoh = [];
  try { await devonTarix(DEVON_V, row, tgX ? 'Direktorga Telegram yuborilmadi: ' + tgX : 'Telegram: direktorga yuborildi (shaxsan, skan bilan)'); } catch (e) { }
  if (tgX) ogoh.push('Xat saqlandi, lekin direktorga Telegram xabari bormadi (' + tgX + '). Direktorga o\'zingiz ayting.');
  await yangila([DEVON_V]);
  return { ok: true, id: row.id, tartib: row.tartib, ogoh };
}

// ------------------------------------------------------------------ v1.5: direktor kirim xatni ko'rdi (devonKordi_)
const devonIjro = x => { try { return JSON.parse(x.ijro || '{}') || {}; } catch (e) { return {}; } };
async function kordiServerda() { try { return (await redis.get('yozuv_yondi:devon_kordi')) === '1'; } catch (e) { return false; } }
// yozuv yadrosi (sinov ham shuni ishlatadi): R — JSON (avvalgi maydonlar + kordi), S — tarix. Qaytaradi kordi vaqti
async function devonKordiYoz(varaq, x, fish) {
  const J = devonIjro(x);
  J.kordi = { v: hozir().dmyHm, fish };
  try {
    await G.yoz(env.aksBazaId, [{ varaq, katak: 'R' + x.qator, qiymat: [[JSON.stringify(J)]] }], env.googleKey);
    await devonTarix(varaq, x, 'direktor ko\'rdi (' + fish + ')');
  } catch (e) { throw yozilmadi(e); }
  return J.kordi.v;
}
// devonKordi_ — qulf ichida, 11 Google'dan yangi. Qaytaradi { ok, kordi, oldin? , yozildi? }
async function kordiYadro(id, fish) {
  return qulfBilan(async () => {
    const R = await devonRowsYangi();
    const x = R.L.find(z => String(z.id) === String(id));
    if (!x || x.turi !== 'Kirim') throw xato('Kirim xat topilmadi.');
    const J = devonIjro(x);
    if (J.kordi) return { ok: true, kordi: J.kordi.v, oldin: true };
    if (x.holati !== 'Rezolyutsiya kutmoqda') return { ok: true, kordi: '', oldin: true };   // eski (ko'rib chiqilgan) xatlar belgilanmaydi
    return { ok: true, kordi: await devonKordiYoz(DEVON_V, x, fish), yozildi: true };
  });
}
async function devonKordi(args) {
  const [kodSes, id] = args;
  const u = await S.ruxsat(kodSes, 'admin');
  if (!(await kordiServerda())) return eskiTizim('devonKordi', u, [id]);
  const r = await kordiYadro(id, u.fish).catch(e => { if (e.yozilmadi) return null; throw e; });
  if (!r) return eskiTizim('devonKordi', u, [id]);   // robotda yozish huquqi yo'q — hech narsa yozilmagan
  const yoz = r.yozildi; delete r.yozildi;
  if (yoz) await yangila([DEVON_V]);
  return r;
}


// ================================================================== QOLGAN AMALLAR (Devon.gs v1.5 — tartib va matnlar aynan)
const TP = require('./topshiriq_yoz')._ichki;
const DX = require('../lib/devon_xat');
const TOP_V = TP.TOP_V, DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const DEVON_TUR = { javob: '✉ Javob xati tayyorlansin', ijro: '📋 Ijro etilsin', malumot: "👁 Ma'lumot uchun" };
const DEVON_MATN_MAX = 8000;
let kv15 = { ok: false, t: 0 };
async function koprik115(kod) {   // Koprik.gs v1.15 — 30 daqiqa kesh (yo'q bo'lsa 2 daqiqa)
  if (kv15.t && Date.now() - kv15.t < (kv15.ok ? 30 : 2) * 60000) return kv15.ok;
  try { kv15 = { ok: koprik.bor() && verOk(await koprik.chaqir('koprikVersiya', kod, []), '1.15'), t: Date.now() }; } catch (e) { kv15 = { ok: false, t: Date.now() }; }
  return kv15.ok;
}
async function bayroq2() { try { return (await redis.get('yozuv_yondi:devon2')) === '1'; } catch (e) { return false; } }
async function bayroqXat() { try { return (await redis.get('yozuv_yondi:devon_xat')) === '1'; } catch (e) { return false; } }
async function serverda2(kod) { return (await serverda(kod)) && (await bayroq2()) && koprik115(kod); }
async function serverdaXat(kod) { return (await serverda2(kod)) && bayroqXat(); }
async function topQulf(ish) {   // 10_Topshiriqlar yozuvlari — topshiriq_yoz.js / qadam_yoz.js / qayta.js bilan bitta qulf (devon qulfi ichida)
  const kalit = 'qulf:topshiriq', belgi = crypto.randomBytes(8).toString('hex'), t0 = Date.now();
  while (!(await redis.set(kalit, belgi, 'PX', 30000, 'NX'))) { if (Date.now() - t0 > 30000) throw xato('Tizim band — birozdan keyin qayta urinib ko\'ring.'); await new Promise(r => setTimeout(r, 150)); }
  try { return await ish(); } finally { if ((await redis.get(kalit)) === belgi) await redis.del(kalit); }
}
const devonIjroJ = devonIjro;
const yozK = async (varaq, K) => { try { await G.yoz(env.aksBazaId, K.map(z => ({ varaq, katak: z[0], qiymat: [[z[1]]] })), env.googleKey); } catch (e) { throw yozilmadi(e); } };
const kat = (ustun, qator) => ustun + qator;
const devonChiqimRaqamTekshir = (L, raqam) => {   // devonChiqimRaqamTekshir_
  const b = L.find(x => x.turi === 'Chiqim' && x.holati !== 'Bekor' && devonRaqNorm(x.raqam) === devonRaqNorm(raqam));
  if (b) throw xato('Bu raqam allaqachon bor: «' + b.raqam + '» — chiqim №' + b.tartib + ', ' + b.sana + ', xat oluvchi: ' + b.tashkilot + '. Boshqa raqam kiriting — saqlanmadi.');
};
const devonMatn = v => s(v).replace(/[​-‍﻿]/g, '').split(/\r?\n/).map(devonS).filter(Boolean).join('\n');   // devonMatn_
function devonSanaYoz(v) {   // devonSanaYoz_: chiquvchi xat sanasi — o'tgan kun yoki 7 kungacha oldinga
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s(v)); if (!m) throw xato('Xat sanasini tanlang.');
  const ch = new Date(Date.now() + 5 * 3600 * 1000 + 7 * 86400000).toISOString().slice(0, 10);
  if (v > ch) throw xato('Xat sanasi 7 kundan uzoq kelajakda bo\'lishi mumkin emas.');
  if (v < '2015-01-01') throw xato('Xat sanasi juda eski — tekshiring.');
  return m[3] + '.' + m[2] + '.' + m[1];
}
function devonKirimTanla(L, kirimId, u, kotib) {   // devonKirimTanla_: javob xati bog'lanadigan kirim xat
  if (!kirimId) return null;
  const k = L.find(z => String(z.id) === String(kirimId) && z.turi === 'Kirim' && z.holati !== 'Bekor');
  if (!k) throw xato('Bog\'lanadigan kirim xat topilmadi.');
  if (!kotib && !(k.ijrochi === u.fish && k.tur === 'javob' && k.holati === 'Ijroda')) throw xato('Bu kirim xatga javob yozish sizga topshirilmagan.');
  return k;
}
// v1.3: yuborish isboti — uchala yo'l uchun umumiy (devonYubOl_). d = { usul, sana, kv, kvB64, bolim, qabul, kiruvchi }
function devonYubOl(d, xatSana, asosiyB64) {
  d = d || {};
  const usul = d.usul === 'pochta' || d.usul === 'qol' ? d.usul : '';
  if (!usul) throw xato('Xat qanday yuborilganini tanlang: pochta orqali yoki qo\'lma-qo\'l.');
  const pochta = usul === 'pochta';
  const sana = devonSana(d.sana, pochta ? 'Pochtaga topshirilgan sana' : 'Tashkilotga topshirilgan sana');
  if (xatSana) devonYubSanaTekshir(sana, xatSana);
  const y = { usul, sana, kv: pochta ? devonS(d.kv).slice(0, 60) : '', bolim: pochta ? devonS(d.bolim).slice(0, 120) : '',
    qabul: pochta ? '' : devonS(d.qabul).slice(0, 120), kiruvchi: pochta ? '' : devonS(d.kiruvchi).slice(0, 60), kvF: '' };
  if (pochta && y.kv.replace(/[\s№#]/g, '').length < 3) throw xato('Pochta kvitansiyasi raqamini kiriting.');
  if (!asosiyB64) throw xato(pochta ? 'Imzolangan xat skanini yuklang.' : 'Tashkilot qabul qilib imzo (muhr) qo\'ygan nusxa skanini yuklang.');
  if (pochta && !d.kvB64) throw xato('Pochta kvitansiyasi skanini yuklang.');
  return { y, kvBayt: pochta ? devonPdf(d.kvB64) : null };
}
function devonYubSanaTekshir(yubSana, xatSana) {   // ikkalasi 'dd.MM.yyyy'
  if (yubSana.split('.').reverse().join('-') < s(xatSana).split('.').reverse().join('-')) throw xato('Yuborilgan sana xat sanasidan (' + xatSana + ') oldin bo\'lishi mumkin emas.');
}
const devonYubMatn = y => y.usul === 'pochta' ? 'pochta orqali, kvitansiya №' + y.kv + (y.bolim ? ' (' + y.bolim + ')' : '') + ', ' + y.sana
  : 'qo\'lma-qo\'l, ' + y.sana + (y.qabul ? ', qabul qildi: ' + y.qabul : '') + (y.kiruvchi ? ', kiruvchi №' + y.kiruvchi : '');
// devonFaylSaqla_: fayl direktor Drive'iga — «AKS TIZIM / 08 DEVONXONA / <qism> / <yil>» (Koprik v1.15, har xodim). quruq (sinov) — Drive'ga yozilmaydi
async function faylSaqla(u, qism, nom, bayt, docx, opt) {
  if (opt && opt.quruq) return { id: 'SINOV_' + qism + '_' + nom, doc: docx ? 'SINOV_' + qism + '_' + nom + '.docx' : '' };
  const m = { qism, nom, b64: bayt.toString('base64') }; if (docx) m.docB64 = docx.toString('base64');
  const f = await koprik.chaqir('koprikDevonSaqla', u.kod, [m], { muddat: 120000, urinish: 1 });
  if (!f || !f.id || (docx && !f.doc)) throw new Error('Fayl Drive\'ga saqlanmadi (Drive ID qaytmadi).');
  return f;
}
const faylOchir = (u, id) => { if (id && !/^SINOV_/.test(s(id))) koprik.chaqir('koprikDevonSaqla', u.kod, [{ eski: id }]).catch(() => {}); };   // devonOchir_
// 23.10.2026 (eski xato tuzatildi): qator yozilmay qolsa skan Drive'da YETIM qolardi — avval faqat «ruxsat yo'q» xatosida savatga tashlanardi.
// Endi HAR QANDAY xatoda: varaq qayta o'qiladi — fayl ID biror qatorda bo'lmasa (qator chindan yozilmagan) → savatga; bo'lsa (javob yo'qolgan, qator bor) — tegilmaydi.
async function yetimTozala(u, id, varaq) {
  if (!id || /^SINOV_/.test(s(id))) return;
  try { const R = await devonRowsYangi(varaq || DEVON_V); if (R.L.some(x => x.fayl === id)) return; } catch (e) { return; }   // o'qib bo'lmasa — fayl qoladi (xavfsiz tomon)
  faylOchir(u, id);
}
async function devonYubSaqla(Y, nomB, u, opt) {   // devonYubSaqla_: kvitansiya skanini saqlaydi, J.yub ni qaytaradi
  const y = Object.assign({}, Y.y);
  if (Y.kvBayt) y.kvF = (await faylSaqla(u, 'Chiqim', nomB + '_kvitansiya_' + devonFaylNom(y.kv), Y.kvBayt, null, opt)).id;
  y.v = hozir().dmyHm; y.fish = u.fish;
  return y;
}
// Telegram (eski: xato e'tiborsiz, jurnalga): direktor(lar) — tgYubor_ (koprikTgYubor); xodim — tgYuborChat_ (koprikTgChat); skan bilan — devonTgYubor_ (koprikDevonTg {chat})
const tgDir = (u, m) => koprik.chaqir('koprikTgYubor', u.kod, [m]).catch(e => console.error('devon tg (direktor):', e.message));
async function tgXodim(u, fish, m) {
  try { const x = (await TP.topXodimlar()).find(z => z.fish === fish); if (x && x.tg) await koprik.chaqir('koprikTgChat', u.kod, [x.tg, m]); }
  catch (e) { console.error('devon tg (xodim):', e.message); }
}
async function tgSkan(u, chat, matn, faylId) {   // qaytaradi '' yoki xato sababi
  try { const r = await koprik.chaqir('koprikDevonTg', u.kod, [{ chat, matn, faylId }], { muddat: 90000, urinish: 1 }); return s(r && r.xato); } catch (e) { return e.message; }
}
// 11 Google'dan yangi + topilgan xat (sinov nusxa varaqda ham)
async function xatTop(varaq, id, turi) {
  const R = await devonRowsYangi(varaq);
  const x = R.L.find(z => String(z.id) === String(id) && (!turi || z.turi === turi));
  return { R, x };
}

// ------------------------------------------------------------------ devonChiqimSaqla(kod, d) — chiquvchi xat skanini ro'yxatga olish (tayyor, imzolangan xat)
// d = { tashkilot, raqam, sana, mazmun, kirimId, b64, yub }
async function chiqimSaqlaYadro(u, d, opt = {}) {
  const varaq = opt.varaq || DEVON_V;
  const R = await devonRowsYangi(varaq);
  devonChiqimRaqamTekshir(R.L, d.raqam);
  const kirim = d.kirimId ? R.L.find(x => String(x.id) === String(d.kirimId) && x.turi === 'Kirim') : null;
  if (d.kirimId && !kirim) throw xato('Bog\'lanadigan kirim xat topilmadi.');
  const tartib = devonKeyingi(R.L, 'Chiqim');
  const fayl = await faylSaqla(u, 'Chiqim', 'CH-' + tartib + '_' + devonFaylNom(d.raqam) + '_' + devonFaylNom(d.tashkilot), d.bayt, null, opt);
  let row;
  try { row = await devonYoz(varaq, R, { turi: 'Chiqim', tartib, kim: u.fish, tashkilot: d.tashkilot, raqam: d.raqam, sana: d.sana, mazmun: d.mazmun, fayl: fayl.id, holati: 'Yuborildi', bogliq: kirim ? kirim.id : '' }); }
  catch (e) { await yetimTozala(u, fayl.id, varaq); throw e; }
  const yub = await devonYubSaqla(d.Y, 'CH-' + tartib + '_' + devonFaylNom(d.raqam), u, opt);
  await yozK(varaq, [[kat('R', row.qator), JSON.stringify({ yub })]]);
  await devonTarix(varaq, row, 'yuborildi — ' + devonYubMatn(yub));
  if (kirim) await devonTarix(varaq, kirim, 'javob xati ' + d.raqam + ' bog\'landi (' + u.fish + ')');
  return row;
}
async function devonChiqimSaqla(args) {
  const [kodSes, d0] = args; const d = d0 || {};
  const u = await S.ruxsat(kodSes, 'devon');
  const tashkilot = devonS(d.tashkilot), raqam = devonS(d.raqam), mazmun = devonS(d.mazmun).slice(0, 500);
  if (tashkilot.length < 3) throw xato('Xat oluvchi tashkilot nomini kiriting.');
  if (!raqam) throw xato('Xat raqamini kiriting.');
  const sana = devonSana(d.sana, 'Xat sanasi');
  const Y = devonYubOl(d.yub, sana, d.b64);   // v1.3: yuborish isboti — pochta kvitansiyasi yoki qabul belgisi
  const bayt = devonPdf(d.b64);
  if (!(await serverda2(u.kod))) return eskiTizim('devonChiqimSaqla', u, [d0]);
  const row = await qulfBilan(() => chiqimSaqlaYadro(u, { tashkilot, raqam, mazmun, sana, Y, bayt, kirimId: d.kirimId })).catch(e => { if (e.yozilmadi) return null; throw e; });
  if (!row) return eskiTizim('devonChiqimSaqla', u, [d0]);
  await yangila([DEVON_V]);
  return { ok: true, id: row.id, tartib: row.tartib };
}

// ------------------------------------------------------------------ v1.2: 📤 devonChiqimYubor(kod, id, d) — «Tayyorlandi» → «Yuborildi» (isbot bilan)
async function chiqimYuborYadro(u, id, Y, bayt, kotib, opt = {}) {
  const varaq = opt.varaq || DEVON_V, pochta = Y.y.usul === 'pochta';
  const { R, x } = await xatTop(varaq, id, 'Chiqim'); if (!x) throw xato('Xat topilmadi.');
  const k = x.bogliq ? R.L.find(z => String(z.id) === String(x.bogliq)) || null : null;
  if (!kotib && x.kim !== u.fish && !(k && k.ijrochi === u.fish)) throw xato('Bu xat sizga tegishli emas.');
  if (x.holati !== 'Tayyorlandi') throw xato('Xat «' + x.holati + '» holatida — yuborilganini faqat tayyorlangan, hali yuborilmagan xatga qayd etish mumkin.');
  devonYubSanaTekshir(Y.y.sana, x.sana);
  const nomB = 'CH-' + x.tartib + '_' + devonFaylNom(x.raqam);
  const f1 = await faylSaqla(u, 'Chiqim', nomB + (pochta ? '_imzolangan' : '_qabul_belgisi'), bayt, null, opt);
  const J = devonIjroJ(x);
  J.yub = await devonYubSaqla(Y, nomB, u, opt);
  await yozK(varaq, [[kat('J', x.qator), f1.id], [kat('K', x.qator), 'Yuborildi'], [kat('R', x.qator), JSON.stringify(J)]]);
  const yubMatn = devonYubMatn(J.yub);
  await devonTarix(varaq, x, 'yuborildi — ' + yubMatn + ' (' + u.fish + ')');
  return { x, k, yubMatn };
}
async function devonChiqimYubor(args) {
  const [kodSes, id, d0] = args; const d = d0 || {};
  const u = await S.foydalanuvchi(kodSes); if (!u) throw xato('Sessiya tugagan — PIN ni qayta kiriting.');
  const kotib = u.admin || u.huquq.indexOf('devon') >= 0;
  const Y = devonYubOl(d, '', d.b64);
  const bayt = devonPdf(d.b64);
  if (!(await serverda2(u.kod))) return eskiTizim('devonChiqimYubor', u, [id, d0]);
  const r = await qulfBilan(() => chiqimYuborYadro(u, id, Y, bayt, kotib)).catch(e => { if (e.yozilmadi) return null; throw e; });
  if (!r) return eskiTizim('devonChiqimYubor', u, [id, d0]);
  await yangila([DEVON_V]);
  const { x, k, yubMatn } = r;
  if (k && k.tur === 'javob' && k.holati === 'Ijroda' && k.ijrochi && k.ijrochi !== u.fish)
    await tgXodim(u, k.ijrochi, '✉ Kirim xat №' + k.tartib + ' (' + devonHtml(k.tashkilot) + ') uchun javob xati №' + devonHtml(x.raqam) + ' yuborildi — ' + devonHtml(yubMatn) + '.\nIjroni topshiring: 📌 Topshiriqlarim → 📮 Ochish.');
  return { ok: true, natija: 'Chiquvchi xat №' + x.tartib + ' (raqami ' + x.raqam + ') — «Yuborildi»: ' + yubMatn + '.' };
}

// ------------------------------------------------------------------ direktor: devonRezolyutsiya(kod, d) — rezolyutsiya → topshiriqlar
// d = { id, tur, ijrochi, yordam[], muddat, matn }
async function rezYadro(u, x0, p, opt = {}) {   // p = { tur, matn, muddat, asosiy, yordam }
  const varaq = opt.varaq || DEVON_V, topV = opt.topVaraq || TOP_V;
  const { x } = await xatTop(varaq, x0, 'Kirim'); if (!x) throw xato('Kirim xat topilmadi.');
  if (x.holati !== 'Rezolyutsiya kutmoqda') throw xato('Bu xat «' + x.holati + '» holatida — rezolyutsiya allaqachon yozilgan.');
  const sarl = '📥 Kirim xat №' + x.tartib + ' — ' + x.tashkilot + ' (№' + x.raqam + ', ' + x.sana + ')';
  const tid = {}, rows = [];
  await topQulf(async () => {
    const TR = await TP.topRowsYangi(topV);
    for (const [i, f] of [p.asosiy.fish].concat(p.yordam).entries()) {
      const r = await TP.topYoz(topV, { manba: 'Direktor', qoida: 'devon', kalit: 'devon|' + x.id + '|' + (i ? 'y' : 'a'),
        sarlavha: sarl + (i ? ' · yordamchi' : ''),
        izoh: DEVON_TUR[p.tur] + (i ? ' · asosiy ijrochi: ' + p.asosiy.fish : (p.yordam.length ? ' · yordamchilar: ' + p.yordam.join(', ') : '')) + ' · Rezolyutsiya: ' + p.matn,
        no: '', mid: '', kimga: f, kimBerdi: u.fish, muddat: p.muddat + ' 18:00', muhim: 'Oddiy' }, TR);
      TR.l = r.qator; TR.L.push({ id: String(r.id), qator: r.qator });
      tid[f] = r.id; rows.push(r);
    }
  });
  const vaqt = hozir().dmyHm, J = devonIjroJ(x);
  const J2 = Object.assign(J, { tid, top: {}, kordi: J.kordi || { v: vaqt, fish: u.fish } });
  try { await G.yoz(env.aksBazaId, [{ varaq, katak: 'K' + x.qator + ':R' + x.qator, qiymat: [['Ijroda', p.tur, p.asosiy.fish, p.yordam.join(', '), p.muddat, p.matn, vaqt + ' · ' + u.fish, JSON.stringify(J2)]] }], env.googleKey); }
  catch (e) { throw yozilmadi(e); }
  await devonTarix(varaq, x, 'rezolyutsiya: ' + DEVON_TUR[p.tur] + ' → ' + p.asosiy.fish + (p.yordam.length ? ' (+' + p.yordam.join(', ') + ')' : '') + ', muddat ' + p.muddat + ' (' + u.fish + ')');
  return { x, rows };
}
async function devonRezolyutsiya(args) {
  const [kodSes, d0] = args; const d = d0 || {};
  const u = await S.ruxsat(kodSes, 'admin');
  const tur = devonS(d.tur); if (!DEVON_TUR[tur]) throw xato('Ijro turini tanlang.');
  const matn = devonS(d.matn); if (matn.length < 5) throw xato('Rezolyutsiya matnini yozing (kamida 5 belgi).');
  const muddat = devonSana(d.muddat, 'Muddat', true);
  const XD = await TP.topXodimlar();
  const asosiy = XD.find(z => z.fish === devonS(d.ijrochi));
  if (!asosiy) throw xato('Asosiy ijrochini ro\'yxatdan tanlang.');
  const yordam = [];
  (Array.isArray(d.yordam) ? d.yordam : []).forEach(f => { const z = XD.find(q => q.fish === devonS(f)); if (z && z.fish !== asosiy.fish && yordam.indexOf(z.fish) < 0) yordam.push(z.fish); });
  if (yordam.length > 6) throw xato('Yordamchilar 6 tadan oshmasin.');
  if (!(await serverda2(u.kod))) return eskiTizim('devonRezolyutsiya', u, [d0]);
  const r = await qulfBilan(() => rezYadro(u, d.id, { tur, matn, muddat, asosiy, yordam })).catch(e => { if (e.yozilmadi) return null; throw e; });
  if (!r) return eskiTizim('devonRezolyutsiya', u, [d0]);
  const { x, rows } = r;
  await yangila([DEVON_V, TOP_V]);
  try { TP.topTg(u.kod, rows, XD); } catch (e) { console.error('devon tg:', e.message); }
  // v1.5: topshiriq xabaridan keyin — xat skanining o'zi (o'qib chiqish uchun)
  const tgYoq = [];
  if (x.fayl) for (const f of [asosiy.fish].concat(yordam)) {
    const z = XD.find(q => q.fish === f);
    if (!z || !z.tg) { tgYoq.push(f); continue; }
    const xt = await tgSkan(u, z.tg, '📎 <b>Kirim xat №' + x.tartib + '</b> skani — ' + devonHtml(x.tashkilot) + ' (№ ' + devonHtml(x.raqam) + ', ' + x.sana + ')', x.fayl);
    if (xt) tgYoq.push(f + ' (' + xt + ')');
  }
  return { ok: true, natija: 'Kirim xat №' + x.tartib + ' ijroga yuborildi: ' + asosiy.fish + (yordam.length ? ' + ' + yordam.length + ' yordamchi' : '') + ', muddat ' + muddat + '.'
    + (tgYoq.length ? ' ⚠ Telegram (skan) bormadi: ' + tgYoq.join(', ') + ' — topshiriq ilovada turibdi.' : '') };
}

// ------------------------------------------------------------------ ijrochi: devonIjroTopshir(kod, d) — isbot bilan topshirish
// d = { id, hisobot, b64, javobRaqam, javobSana, chiqimId, yub }
async function ijroTopshirYadro(u, d, opt = {}) {
  const varaq = opt.varaq || DEVON_V, topV = opt.topVaraq || TOP_V;
  const { R, x } = await xatTop(varaq, d.id, 'Kirim'); if (!x) throw xato('Kirim xat topilmadi.');
  const rol = x.ijrochi === u.fish ? 'a' : (x.yordam.indexOf(u.fish) >= 0 ? 'y' : '');
  if (!rol) throw xato('Bu xat sizga ijroga berilmagan.');
  if (x.holati !== 'Ijroda') throw xato('Xat «' + x.holati + '» holatida — hozir topshirib bo\'lmaydi.');
  const J = devonIjroJ(x); J.top = J.top || {};
  if (J.top[u.fish] && (rol === 'y' || x.tur === 'malumot')) throw xato('Siz bu xat bo\'yicha isbotni allaqachon topshirgansiz (' + J.top[u.fish].v + ').');
  const hisobot = devonS(d.hisobot).slice(0, 2000);
  const yozuv = { v: hozir().dmyHm, h: hisobot, rol };
  let chiqim = null, tanlangan = null;
  if (x.tur === 'javob' && rol === 'a' && d.chiqimId) {   // v1.1: tizimda yozilgan javob xati
    tanlangan = R.L.find(z => String(z.id) === String(d.chiqimId) && z.turi === 'Chiqim' && String(z.bogliq) === String(x.id) && z.holati !== 'Bekor');
    if (!tanlangan) throw xato('Tanlangan javob xati topilmadi yoki bu kirim xatga bog\'lanmagan.');
    if (tanlangan.holati === 'Tayyorlanmoqda') throw xato('Javob xati hali yasalmoqda — bir oz kutib qayta urinib ko\'ring.');
    if (tanlangan.holati !== 'Yuborildi') throw xato('Javob xati №' + tanlangan.raqam + ' hali yuborilmagan. Avval «📤 Yuborilganini qayd etish»: pochta kvitansiyasi yoki tashkilot qabul qilgan nusxa bilan.');
    yozuv.jr = tanlangan.raqam; yozuv.js = tanlangan.sana; yozuv.f = tanlangan.fayl; yozuv.cid = tanlangan.id;
    await yozK(varaq, [[kat('T', x.qator), tanlangan.id]]);
  }
  const javobA = x.tur === 'javob' && rol === 'a';
  let bayt = tanlangan || javobA ? null : devonPdf(d.b64), Y = null, yubM = '';
  if (tanlangan) { const Jt = devonIjroJ(tanlangan); yubM = Jt.yub ? devonYubMatn(Jt.yub) : ''; }
  else if (javobA) {
    const jr = devonS(d.javobRaqam); if (!jr) throw xato('Javob xatining raqamini kiriting.');
    const js = devonSana(d.javobSana, 'Javob xati sanasi');
    devonChiqimRaqamTekshir(R.L, jr);
    Y = devonYubOl(d.yub, js, d.b64); bayt = devonPdf(d.b64);
    chiqim = { raqam: jr, sana: js };
    yozuv.jr = jr; yozuv.js = js;
  } else if (x.tur !== 'malumot' && hisobot.length < 10) throw xato('Nima qilganingizni qisqa yozing (hisobot, kamida 10 belgi).');
  if (bayt) yozuv.f = (await faylSaqla(u, 'Ijro', 'K-' + x.tartib + '_' + (x.tur === 'malumot' ? 'tanishdim' : chiqim ? 'javob-' + devonFaylNom(chiqim.raqam) : 'ijro') + '_' + devonFaylNom(u.fish), bayt, null, opt)).id;
  if (chiqim) {   // javob xati — chiqim jurnaliga ham yoziladi (imzolangan skan bilan)
    const tartib = devonKeyingi(R.L, 'Chiqim');
    const ch = await devonYoz(varaq, R, { turi: 'Chiqim', tartib, kim: u.fish, tashkilot: x.tashkilot, raqam: chiqim.raqam, sana: chiqim.sana,
      mazmun: 'Javob: kirim №' + x.tartib + ' (' + x.raqam + ', ' + x.sana + ')' + (hisobot ? ' · ' + hisobot.slice(0, 300) : ''), fayl: yozuv.f, holati: 'Yuborildi', bogliq: x.id });
    const yub = await devonYubSaqla(Y, 'CH-' + tartib + '_' + devonFaylNom(chiqim.raqam), u, opt);
    await yozK(varaq, [[kat('R', ch.qator), JSON.stringify({ yub })]]);
    await devonTarix(varaq, ch, 'yuborildi — ' + devonYubMatn(yub)); yubM = devonYubMatn(yub);
    yozuv.cid = ch.id;
    await yozK(varaq, [[kat('T', x.qator), ch.id]]);
  }
  J.top[u.fish] = yozuv;
  const tid = (J.tid || {})[u.fish];
  let natija, xabarDir = '', xabarAsosiy = '';
  await topQulf(async () => {
    const t = tid ? (await TP.topRowsYangi(topV)).L.find(z => String(z.id) === String(tid)) : null;
    if (x.tur === 'malumot') {
      if (t && t.holati === 'Jarayonda') await TP.topYop(topV, t, 'Bajarildi', u.fish, 'Tanishdim (imzolangan nusxa yuklandi)');
      const hamma = [x.ijrochi].concat(x.yordam).every(f => J.top[f]);
      await yozK(varaq, [[kat('R', x.qator), JSON.stringify(J)]]);
      if (hamma) { await yozK(varaq, [[kat('K', x.qator), 'Tanishildi']]); xabarDir = '👁 Kirim xat №' + x.tartib + ' (' + devonHtml(x.tashkilot) + ') bilan hamma ijrochilar tanishdi.'; }
      await devonTarix(varaq, x, 'tanishdi: ' + u.fish);
      natija = 'Tanishganingiz qayd etildi.' + (hamma ? ' Xat «Tanishildi» holatiga o\'tdi.' : '');
    } else if (rol === 'y') {
      if (t && t.holati === 'Jarayonda') await TP.topYop(topV, t, 'Bajarildi', u.fish, 'O\'z qismi yuklandi: ' + hisobot.slice(0, 200));
      await yozK(varaq, [[kat('R', x.qator), JSON.stringify(J)]]);
      await devonTarix(varaq, x, 'yordamchi o\'z qismini yukladi: ' + u.fish);
      xabarAsosiy = '📎 <b>' + u.fish + '</b> kirim xat №' + x.tartib + ' bo\'yicha o\'z qismini yukladi.';
      natija = 'Qismingiz yuklandi. Asosiy ijrochi (' + x.ijrochi + ') ko\'radi.';
    } else {
      const jx = chiqim ? chiqim.raqam : tanlangan ? tanlangan.raqam : '';
      if (t && t.holati === 'Jarayonda') await TP.topYop(topV, t, 'Tekshiruvda', u.fish, jx ? 'Javob xati ' + jx + ' yuklandi' : 'Ijro topshirildi: ' + hisobot.slice(0, 200));
      await yozK(varaq, [[kat('R', x.qator), JSON.stringify(J)], [kat('K', x.qator), 'Tekshiruvda']]);
      await devonTarix(varaq, x, 'ijro topshirildi: ' + u.fish + (jx ? ' (javob xati ' + jx + ')' : ''));
      const yoq = x.yordam.filter(f => !J.top[f]);
      xabarDir = '✅ <b>' + u.fish + '</b> kirim xat №' + x.tartib + ' (' + devonHtml(x.tashkilot) + ') bo\'yicha ijroni topshirdi'
        + (jx ? ' — javob xati №' + devonHtml(jx) + (yubM ? ' (' + devonHtml(yubM) + ')' : '') : '') + '.' + (yoq.length ? '\n⚠ Yordamchi hali yuklamagan: ' + yoq.join(', ') : '')
        + '\nTekshirish: ilovada 👔 Direktor → Tasdiqlar.';
      natija = 'Ijro direktorga tekshiruvga yuborildi.';
    }
  });
  return { x, natija, xabarDir, xabarAsosiy };
}
async function devonIjroTopshir(args) {
  const [kodSes, d0] = args; const d = d0 || {};
  const u = await S.foydalanuvchi(kodSes); if (!u) throw xato('Sessiya tugagan — PIN ni qayta kiriting.');
  if (!(await serverda2(u.kod))) return eskiTizim('devonIjroTopshir', u, [d0]);
  const r = await qulfBilan(() => ijroTopshirYadro(u, d)).catch(e => { if (e.yozilmadi) return null; throw e; });
  if (!r) return eskiTizim('devonIjroTopshir', u, [d0]);
  await yangila([DEVON_V, TOP_V]);
  if (r.xabarDir) await tgDir(u, r.xabarDir);
  if (r.xabarAsosiy) await tgXodim(u, r.x.ijrochi, r.xabarAsosiy);
  return { ok: true, natija: r.natija };
}

// ------------------------------------------------------------------ direktor: devonTasdiq(kod, id, ha, izoh) — ✅ qabul / ↩ qaytarish
async function tasdiqYadro(u, id, ha, izoh, opt = {}) {
  const varaq = opt.varaq || DEVON_V, topV = opt.topVaraq || TOP_V;
  const { x } = await xatTop(varaq, id, 'Kirim'); if (!x) throw xato('Kirim xat topilmadi.');
  if (x.holati !== 'Tekshiruvda') throw xato('Xat tekshiruvda emas (hozir: ' + x.holati + ').');
  const J = devonIjroJ(x);
  await topQulf(async () => {
    const T = (await TP.topRowsYangi(topV)).L;
    const top = f => { const tid = (J.tid || {})[f]; return tid ? T.find(z => String(z.id) === String(tid)) : null; };
    if (ha) {
      const ta = top(x.ijrochi); if (ta && ta.holati === 'Tekshiruvda') await TP.topYop(topV, ta, 'Bajarildi', x.ijrochi + ' (tasdiq: ' + u.fish + ')', ta.dalil);
      for (const f of x.yordam) { const ty = top(f); if (ty && ty.holati === 'Jarayonda') await TP.topYop(topV, ty, 'Bekor', u.fish, 'xat ijro etildi (asosiy ijrochi yopdi)'); }
      await yozK(varaq, [[kat('K', x.qator), 'Ijro etildi']]);
      await devonTarix(varaq, x, 'qabul qilindi — Ijro etildi (' + u.fish + ')' + (izoh ? ': ' + izoh : ''));
    } else {
      const ta = top(x.ijrochi);
      if (ta && ta.holati === 'Tekshiruvda') { await TP.topYop(topV, ta, 'Jarayonda', '', ''); await yozK(topV, [[kat('G', ta.qator), (ta.izoh ? ta.izoh + ' | ' : '') + 'Qaytarildi: ' + izoh]]); }
      J.eski = J.eski || []; if (J.top && J.top[x.ijrochi]) { J.eski.push(Object.assign({ fish: x.ijrochi, qaytdi: izoh }, J.top[x.ijrochi])); delete J.top[x.ijrochi]; }
      await yozK(varaq, [[kat('R', x.qator), JSON.stringify(J)], [kat('K', x.qator), 'Ijroda']]);
      await devonTarix(varaq, x, 'qaytarildi: ' + izoh + ' (' + u.fish + ')');
    }
  });
  return x;
}
async function devonTasdiq(args) {
  const [kodSes, id, ha0, izoh0] = args; const ha = !!ha0;
  const u = await S.ruxsat(kodSes, 'admin');
  const izoh = devonS(izoh0);
  if (!ha && izoh.length < 5) throw xato('Qaytarish sababini yozing (kamida 5 belgi).');
  if (!(await serverda2(u.kod))) return eskiTizim('devonTasdiq', u, [id, ha0, izoh0]);
  const x = await qulfBilan(() => tasdiqYadro(u, id, ha, izoh)).catch(e => { if (e.yozilmadi) return null; throw e; });
  if (!x) return eskiTizim('devonTasdiq', u, [id, ha0, izoh0]);
  await yangila([DEVON_V, TOP_V]);
  await tgXodim(u, x.ijrochi, ha ? '✅ Kirim xat №' + x.tartib + ' (' + devonHtml(x.tashkilot) + '): ijroingiz qabul qilindi — «Ijro etildi».'
    : '↩ Kirim xat №' + x.tartib + ' (' + devonHtml(x.tashkilot) + '): ijro qaytarildi.\n«' + devonHtml(izoh) + '»\nQayta topshiring: 📌 Topshiriqlarim → 📮 Ochish.');
  return { ok: true, natija: 'Kirim xat №' + x.tartib + (ha ? ' — «Ijro etildi».' : ' ijrochiga qaytarildi.') };
}

// ------------------------------------------------------------------ direktor: devonRezQaytar(kod, id, izoh) — rezolyutsiyani qaytarib olish
async function rezQaytarYadro(u, id, izoh, opt = {}) {
  const varaq = opt.varaq || DEVON_V, topV = opt.topVaraq || TOP_V;
  const { x } = await xatTop(varaq, id, 'Kirim'); if (!x) throw xato('Kirim xat topilmadi.');
  if (x.holati !== 'Ijroda' && x.holati !== 'Tekshiruvda') throw xato('Rezolyutsiyani faqat «Ijroda» yoki «Tekshiruvda» holatida qaytarib olish mumkin (hozir: ' + x.holati + ').');
  const J = devonIjroJ(x), kimlar = [];
  await topQulf(async () => {
    const T = (await TP.topRowsYangi(topV)).L;
    for (const f of Object.keys(J.tid || {})) { const t = T.find(z => String(z.id) === String(J.tid[f]));
      if (t && (t.holati === 'Jarayonda' || t.holati === 'Tekshiruvda')) { await TP.topYop(topV, t, 'Bekor', u.fish, 'rezolyutsiya qaytarib olindi: ' + izoh); kimlar.push(f); } }
  });
  J.eskiRez = J.eskiRez || []; J.eskiRez.push({ tur: x.tur, ijrochi: x.ijrochi, yordam: x.yordam, muddat: x.muddat, matn: x.rez, vaqt: x.rezVaqt, top: J.top, sabab: izoh });
  try { await G.yoz(env.aksBazaId, [{ varaq, katak: 'K' + x.qator + ':R' + x.qator, qiymat: [['Rezolyutsiya kutmoqda', '', '', '', '', '', '', JSON.stringify({ eskiRez: J.eskiRez, eski: J.eski || [], kordi: J.kordi })]] }], env.googleKey); }
  catch (e) { throw yozilmadi(e); }
  await devonTarix(varaq, x, 'rezolyutsiya qaytarib olindi: ' + izoh + ' (' + u.fish + ')');
  return { x, kimlar };
}
async function devonRezQaytar(args) {
  const [kodSes, id, izoh0] = args;
  const u = await S.ruxsat(kodSes, 'admin');
  const izoh = devonS(izoh0); if (izoh.length < 3) throw xato('Sababini yozing.');
  if (!(await serverda2(u.kod))) return eskiTizim('devonRezQaytar', u, [id, izoh0]);
  const r = await qulfBilan(() => rezQaytarYadro(u, id, izoh)).catch(e => { if (e.yozilmadi) return null; throw e; });
  if (!r) return eskiTizim('devonRezQaytar', u, [id, izoh0]);
  await yangila([DEVON_V, TOP_V]);
  for (const f of r.kimlar) await tgXodim(u, f, '✕ Kirim xat №' + r.x.tartib + ' bo\'yicha topshiriq bekor qilindi (rezolyutsiya qaytarib olindi).');
  return { ok: true, natija: 'Kirim xat №' + r.x.tartib + ' yana «Rezolyutsiya kutmoqda».' };
}

// ------------------------------------------------------------------ direktor: devonBekor(kod, id, sabab) — xato kiritilgan yozuvni bekor qilish
async function bekorYadro(u, id, sabab, opt = {}) {
  const varaq = opt.varaq || DEVON_V;
  const { x } = await xatTop(varaq, id); if (!x) throw xato('Xat topilmadi.');
  if (!((x.turi === 'Kirim' && x.holati === 'Rezolyutsiya kutmoqda') || (x.turi === 'Chiqim' && x.holati === 'Yuborildi' && !x.bogliq) || (x.turi === 'Chiqim' && (x.holati === 'Tayyorlandi' || x.holati === 'Tayyorlanmoqda'))))
    throw xato('Faqat rezolyutsiya yozilmagan kirim xat, imzolanmagan chiquvchi xat yoki ijroga bog\'lanmagan chiquvchi xat bekor qilinadi (hozir: ' + x.holati + ').');
  await yozK(varaq, [[kat('K', x.qator), 'Bekor']]);
  await devonTarix(varaq, x, 'bekor qilindi: ' + sabab + ' (' + u.fish + ')');
  return { ok: true, natija: (x.turi === 'Kirim' ? 'Kirim' : 'Chiquvchi') + ' xat №' + x.tartib + ' bekor qilindi. Raqami jurnalda qoladi.' };
}
async function devonBekor(args) {
  const [kodSes, id, sabab0] = args;
  const u = await S.ruxsat(kodSes, 'admin');
  const sabab = devonS(sabab0); if (sabab.length < 5) throw xato('Bekor qilish sababini yozing (kamida 5 belgi).');
  if (!(await serverda2(u.kod))) return eskiTizim('devonBekor', u, [id, sabab0]);
  const r = await qulfBilan(() => bekorYadro(u, id, sabab)).catch(e => { if (e.yozilmadi) return null; throw e; });
  if (!r) return eskiTizim('devonBekor', u, [id, sabab0]);
  await yangila([DEVON_V]);
  return r;
}

// ------------------------------------------------------------------ v1.1: ✍ devonChiqimYoz(kod, d) — chiquvchi xatni RASMIY BLANKADA yozish (PDF + Word)
// d = { id? (tahrir), raqam, sana 'yyyy-mm-dd', oluvchi (ko'p qatorli), mazmun, kirimId?, format 'pdf'|'doc', tur, mavzu, murojaat, ilova }
// Kim yoza oladi: «devon» yoki direktor — har qanday xat; boshqa xodim — faqat o'ziga «Javob xati tayyorlansin» deb berilgan (Ijroda) kirim xatga javob.
function chiqimYozTekshir(d) {
  const raqam = devonS(d.raqam).slice(0, 40);
  if (!raqam) throw xato('Xat raqamini kiriting.');
  const sana = devonSanaYoz(d.sana);
  const oluvchi = s(d.oluvchi).replace(/[​-‍﻿]/g, '').split(/\r?\n/).map(devonS).filter(Boolean).slice(0, 8);
  if (!oluvchi.length || oluvchi.join(' ').length < 3) throw xato('Xat kimga yuborilishini kiriting (tashkilot nomi).');
  const mazmun = devonMatn(d.mazmun);
  if (mazmun.replace(/\s/g, '').length < 20) throw xato('Xat mazmunini yozing (kamida 20 belgi).');
  if (mazmun.length > DEVON_MATN_MAX) throw xato('Xat matni juda uzun (' + mazmun.length + ' belgi, ko\'pi bilan ' + DEVON_MATN_MAX + ').');
  const tur = d.tur === 'mijoz' ? 'mijoz' : 'tashkilot';
  const mavzu = devonS(d.mavzu).slice(0, 250);
  if (mavzu.length < 5) throw xato('Xat mavzusini yozing (masalan: «Очилиш маросимига таклиф тўғрисида»).');
  let murojaat = devonS(d.murojaat).slice(0, 150);
  if (murojaat && !/[!.]$/.test(murojaat)) murojaat += '!';
  const ilova = devonS(d.ilova).replace(/^(илова|ilova)\s*:\s*/i, '').slice(0, 300);
  return { raqam, sana, sanaIso: s(d.sana), oluvchi, mazmun, xat: { tur, mavzu, murojaat, ilova }, format: d.format === 'doc' ? 'doc' : 'pdf' };
}
// F:I — matn formati bilan (setNumberFormat('@').setValues: «-», «=» bilan boshlansa ham formula bo'lmaydi)
async function matnKataklar(varaq, qator, qiymatlar) {
  const g = await G.gid(env.aksBazaId, varaq, env.googleKey);
  try { await G.soralar(env.aksBazaId, [{ updateCells: { range: { sheetId: g, startRowIndex: qator - 1, endRowIndex: qator, startColumnIndex: 5, endColumnIndex: 9 },
    rows: [{ values: qiymatlar.map(v => ({ userEnteredValue: { stringValue: s(v) }, userEnteredFormat: { numberFormat: { type: 'TEXT', pattern: '@' } } })) }], fields: 'userEnteredValue,userEnteredFormat.numberFormat' } }], env.googleKey); }
  catch (e) { throw yozilmadi(e); }
}
async function devonChiqimYoz(args) {
  const [kodSes, d0] = args; const d = d0 || {};
  const u = await S.foydalanuvchi(kodSes); if (!u) throw xato('Sessiya tugagan — PIN ni qayta kiriting.');
  const kotib = u.admin || u.huquq.indexOf('devon') >= 0;
  const T = chiqimYozTekshir(d);
  const { raqam, sana, oluvchi, mazmun, xat, format } = T;
  if (!(await serverdaXat(u.kod))) return eskiTizim('devonChiqimYoz', u, [d0]);
  const varaq = DEVON_V;
  // 1) qulf ostida: tekshiruv va raqamni band qilish (xat yasash qulfdan tashqarida — boshqa ishlar kutib qolmasin)
  let x, kirim = null, tahrir = false, eskiJ = {};
  const r1 = await qulfBilan(async () => {
    const R = await devonRowsYangi(varaq);
    if (d.id) {
      tahrir = true;
      x = R.L.find(z => String(z.id) === String(d.id) && z.turi === 'Chiqim');
      if (!x) throw xato('Xat topilmadi.');
      if (x.holati !== 'Tayyorlandi') throw xato('Xat «' + x.holati + '» holatida — faqat hali yuborilmagan xat tahrirlanadi.');
      if (!kotib && x.kim !== u.fish) throw xato('Bu xatni siz yozmagansiz — tahrirlay olmaysiz.');
      eskiJ = devonIjroJ(x);
      if (devonRaqNorm(raqam) !== devonRaqNorm(x.raqam)) devonChiqimRaqamTekshir(R.L.filter(z => z.id !== x.id), raqam);
      if (x.bogliq) kirim = R.L.find(z => String(z.id) === String(x.bogliq)) || null;
      if (kotib && String(d.kirimId || '') !== String(x.bogliq || '')) kirim = devonKirimTanla(R.L, d.kirimId, u, kotib);
    } else {
      devonChiqimRaqamTekshir(R.L, raqam);
      kirim = devonKirimTanla(R.L, d.kirimId, u, kotib);
      if (!kotib && !kirim) throw xato('Siz faqat o\'zingizga «Javob xati tayyorlansin» deb berilgan kirim xatga javob yoza olasiz.');
      x = await devonYoz(varaq, R, { turi: 'Chiqim', tartib: devonKeyingi(R.L, 'Chiqim'), kim: u.fish, tashkilot: oluvchi.join(' '), raqam, sana,
        mazmun: '', fayl: '', holati: 'Tayyorlanmoqda', bogliq: kirim ? kirim.id : '' });
      await matnKataklar(varaq, x.qator, [oluvchi.join(' '), raqam, sana, mazmun]);
      x.mazmun = mazmun;
    }
    return true;
  }).catch(e => { if (e.yozilmadi) return null; throw e; });
  if (!r1) return eskiTizim('devonChiqimYoz', u, [d0]);
  // 2) blankada yasash (serverda) va Drive'ga (Koprik)
  let f;
  try {
    const ij = await require('./xat_chiqar')._ichki.ijrochi(x.kim);
    const y = await DX.yasa(raqam, T.sanaIso, oluvchi, mazmun, ij, xat, kirim ? { sana: kirim.sana, raqam: kirim.raqam } : null);
    const dr = await faylSaqla(u, 'Chiqim', 'CH-' + x.tartib + '_' + devonFaylNom(raqam) + '_' + devonFaylNom(oluvchi[0]), y.pdf, y.docx);
    f = { pdf: dr.id, doc: dr.doc, bet: y.bet, pdfB: y.pdf, docxB: y.docx };
  } catch (e) {
    if (!tahrir) { try { await qulfBilan(async () => { await yozK(varaq, [[kat('K', x.qator), 'Bekor']]); await devonTarix(varaq, x, 'blankada yasashda xato — raqam bo\'shatildi: ' + e.message); }); await yangila([varaq]); } catch (e2) { console.error('devon chiqim yoz (bekor):', e2.message); } }
    throw xato('Xat yasalmadi: ' + e.message);
  }
  // 3) qulf ostida: yozuvni yangilash
  await qulfBilan(async () => {
    const y = (await devonRowsYangi(varaq)).L.find(z => String(z.id) === String(x.id));
    const kutilgan = tahrir ? 'Tayyorlandi' : 'Tayyorlanmoqda';
    if (!y || y.holati !== kutilgan) { faylOchir(u, f.pdf); faylOchir(u, f.doc); throw xato('Xat shu orada o\'zgargan (hozir: ' + (y ? y.holati : 'yo\'q') + ') — ro\'yxatni yangilab qayta urinib ko\'ring.'); }
    const J = Object.assign({}, eskiJ, { pdf: f.pdf, doc: f.doc, bet: f.bet, oluvchi, xat, tahrir: tahrir ? (Number(eskiJ.tahrir) || 0) + 1 : 0 });
    const K = [[kat('F', y.qator) + ':' + kat('I', y.qator), [oluvchi.join(' '), raqam, sana, mazmun]], [kat('K', y.qator), 'Tayyorlandi'], [kat('R', y.qator), JSON.stringify(J)]];
    if (kotib && tahrir) K.push([kat('T', y.qator), kirim ? kirim.id : '']);
    try { await G.yoz(env.aksBazaId, K.map(z => ({ varaq, katak: z[0], qiymat: [Array.isArray(z[1]) ? z[1] : [z[1]]] })), env.googleKey); } catch (e) { throw yozilmadi(e); }
    await devonTarix(varaq, y, (tahrir ? 'tahrirlandi' + (devonRaqNorm(raqam) !== devonRaqNorm(x.raqam) ? ' (raqam: ' + x.raqam + ' → ' + raqam + ')' : '') : 'blankada yozildi') + ' — ' + f.bet + ' bet (' + u.fish + ')');
    if (kirim && (!tahrir || String(kirim.id) !== String(x.bogliq))) await devonTarix(varaq, kirim, 'javob xati yozildi: ' + raqam + ' (' + u.fish + ')');
  });
  if (tahrir) { faylOchir(u, eskiJ.pdf); faylOchir(u, eskiJ.doc); }
  await yangila([varaq]);
  const nomB = 'Chiqim_' + x.tartib + '_' + devonFaylNom(raqam);
  const fl = format === 'doc' ? { b64: f.docxB.toString('base64'), nom: nomB + '.docx', mime: DOCX } : { b64: f.pdfB.toString('base64'), nom: nomB + '.pdf', mime: 'application/pdf' };
  return { ok: true, id: x.id, tartib: x.tartib, raqam, bet: f.bet, ogoh: [], b64: fl.b64, nom: fl.nom, mime: fl.mime,
    natija: 'Chiquvchi xat №' + x.tartib + ' (raqami ' + raqam + ') ' + (tahrir ? 'qayta yasaldi' : 'tayyorlandi') + '. Chop eting, direktor imzolagach yuboring va «📤 Yuborilganini qayd etish» orqali isbotini yuklang.' };
}

module.exports = { devonKirimSaqla, devonKordi, devonChiqimSaqla, devonChiqimYubor, devonRezolyutsiya, devonIjroTopshir, devonTasdiq, devonRezQaytar, devonBekor, devonChiqimYoz };
module.exports._ichki = { devonRowsYangi, devonYoz, devonTarix, devonKordiYoz, kordiYadro, kordiServerda, devonNorm, devonRaqNorm, devonFaylNom, koprik112, koprik115, DEVON_V, DEVON_S, DEVON_TUR,
  chiqimSaqlaYadro, chiqimYuborYadro, rezYadro, ijroTopshirYadro, tasdiqYadro, rezQaytarYadro, bekorYadro, chiqimYozTekshir, devonYubOl, devonYubMatn, devonPdf, bayroq2, bayroqXat };
