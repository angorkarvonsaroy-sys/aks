// AKS TIZIM — 📮 DEVONXONA: devonKirimSaqla serverda (Devon.gs v1.5 bilan bir xil tekshiruvlar, xato matnlari, 11_Devonxona qatori, tarix va javob).
// Tartib eski tizimdagidek: tekshiruvlar → qulf → takror xat tekshiruvi → tartib raqami → skan Drive'ga («AKS TIZIM / 08 DEVONXONA / Kirim / <yil>»,
// Koprik v1.12 koprikDevonSaqla — direktor hisobi) → 11_Devonxona ga qator → qulf ochiladi → direktor(lar)ga shaxsan Telegram (skan PDF + «📮 Rezolyutsiya
// qo'yish» tugmasi — eski devonDirShaxsiy_ ning o'zi, Koprik v1.12 koprikDevonTg) → natija tarixga; bormasa — kotibaga ogohlantirish.
// Boshqa devon amallari (chiqim, rezolyutsiya, ijro …) — hali eski tizimda. Yoqilishi: Redis yozuv_yondi:devon («aks-yozuv-sinov devon») va Koprik ≥ 1.12.
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
    catch (e) { if (e.yozilmadi) koprik.chaqir('koprikDevonSaqla', u.kod, [{ eski: f.id }]).catch(() => {}); throw e; }   // qator yozilmadi — fayl savatga
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

module.exports = { devonKirimSaqla };
module.exports._ichki = { devonRowsYangi, devonYoz, devonTarix, devonNorm, devonRaqNorm, devonFaylNom, koprik112, DEVON_V, DEVON_S };
