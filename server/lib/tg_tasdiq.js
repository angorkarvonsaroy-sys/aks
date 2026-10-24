// AKS TIZIM — ✈ TELEGRAM: isbot fayli + ✅ / ✖ tugmalari, yurist qarorlari xulosasi va direktor ro'yxatlari — SERVERDA
// (Telegram ko'chirish rejasi 23.10.2026, 3-qadam). Eski kodning o'zi: Topshiriq.gs v2.2 — tgTasdiqYubor_, tgFaylYubor_, tgRefYoz_,
// tgKlavAsosiy_, tgKlavSabab_, tgTasdiqchiChat_, tgAdminChatlar_, tgTasdiqChatlar_, tqCaption_, tqKlav_, tqXulosaMatn_, tqXulosaYubor_,
// tqKutYubor_, tqRadYubor_. Matnlar va tugma kodlari (ts|…, tq|…, tr|…) eski bilan AYNAN — eski tgTugmaPoll ham, serverdagi poll ham tushunadi.
// Fayl: serverdagi nusxa (hujjat_yoz srvFayl) yoki Drive (robot — faqat o'qish); o'qilmasa — faylsiz (matn) yuboriladi, chaqiruvchi xohlasa Koprik'ka qaytaradi.
// Havola (d|m:chat:xabar) — 10_Topshiriqlar V / 06d Q / 06e Y / 06t O ustunlariga RAW yoziladi (eski tgTasdiqYangila_ shu havola bilan xabarni yangilaydi).
// ctx — { quruq, api(metod, tana, fayl), log[] }: haqiqiy (lib/telegram.js) yoki quruq (hech narsa yubormaydi, yozmaydi — ro'yxat qaytaradi).
'use strict';
const TG = require('./telegram');
const V = require('./varaq');
const J = require('./jurnallar');
const TS = require('./tasdiq');
const G = require('./google');
const env = require('./env');

const s = v => String(v == null ? '' : v);
const esc = v => s(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const TQ_MAX = 20;
const TOP_RAD_SABAB = {
  hujjat: ['Sahifa yetishmaydi', 'O\'qib bo\'lmaydi — xira', 'Boshqa hujjat yuklangan', 'Imzo yo\'q'],
  xat: ['Mijoz imzosi yo\'q', 'Kvitansiya o\'qilmaydi', 'Pochta raqami mos emas', 'Boshqa xatning isboti'],
  oddiy: ['Isbot yetarli emas', 'Ish to\'liq bajarilmagan', 'Boshqa fayl yuklangan'] };
function hozirDmyHm() { const d = new Date(Date.now() + 5 * 3600 * 1000), p = n => String(n).padStart(2, '0');
  return p(d.getUTCDate()) + '.' + p(d.getUTCMonth() + 1) + '.' + d.getUTCFullYear() + ' ' + p(d.getUTCHours()) + ':' + p(d.getUTCMinutes()); }

// ---------------------------------------------------------------- ctx: haqiqiy yoki quruq
function haqiqiy() { return { quruq: false, log: [], api: (m, t, f, o) => TG.api(m, t, f, o) }; }
function klavMatn(k) { try { return (k.inline_keyboard || []).map(r => r.map(b => b.text).join(' · ')).join(' / ') || (k.force_reply ? '(javob so\'raladi)' : k.keyboard ? k.keyboard.map(r => r.map(b => b.text).join(' · ')).join(' / ') : ''); } catch (e) { return ''; } }
function quruq() {
  let n = 0; const log = [];
  return { quruq: true, log, api: async (m, t, f) => {
    const t2 = t || {};
    log.push({ metod: m, chat: s(t2.chat_id), matn: s(t2.text || t2.caption || '').replace(/<[^>]+>/g, ''), fayl: f ? (f.nom + ' (' + Math.round((f.bayt || []).length / 1024) + ' KB)') : '', tugma: t2.reply_markup ? klavMatn(t2.reply_markup) : '' });
    return { message_id: 900000 + (++n), ok: true }; } };
}
async function yozuv(ctx, tavsif, ish) { if (ctx.quruq) { ctx.log.push({ yozuv: tavsif }); return null; } return ish(); }

// ---------------------------------------------------------------- 07_Xodimlar (topXodimlar_): Ishlayapti + huquqli
async function xodimlar() {
  return (await V.qatorlar('07_Xodimlar')).map(({ n, x: r }) => ({ qator: n, fish: s(r[1]).trim(), lavozim: s(r[3]), huquq: s(r[18]).trim(), tel: s(r[5]).replace(/\D/g, ''), kod: s(r[11]).trim(),
    tg: s(r[20]).trim().replace(/\.0+$/, ''), holat: s(r[10]).trim(), admin: /(^|,)\s*admin\s*(,|$)/i.test(s(r[18])) }))
    .filter(z => z.fish && z.holat === 'Ishlayapti' && z.huquq);
}
const huquqlar = x => s(x.huquq).toLowerCase().split(',').map(z => z.trim()).filter(Boolean);
// Telegram ID → xodim (tgFoydalanuvchi_): { fish, huquq[], kod, admin, yurist, tg }
async function tgXodim(tgId) {
  if (!tgId) return null; const x = (await xodimlar()).find(z => z.tg && z.tg === s(tgId)); if (!x) return null;
  const h = huquqlar(x); return { fish: x.fish, kod: x.kod, huquq: h, admin: h.indexOf('admin') >= 0, yurist: h.indexOf('yurist') >= 0, tg: x.tg, qator: x.qator, tel: x.tel };
}
const tasdiqHuquq = (u, it) => u.admin || (it.tasdiqchi === 'yurist' && u.yurist);
const rol = u => u.admin ? 'Direktor' : u.yurist ? 'Yurist' : s(u.fish);
async function tasdiqchiChat(it, XD) {
  XD = XD || await xodimlar();
  if (it.tasdiqchi === 'yurist') { const y = XD.find(z => /(^|,)\s*yurist\s*(,|$)/i.test(z.huquq) && !z.admin); if (y) return y.tg || ''; }
  const a = XD.find(z => z.admin && z.tg); return a ? a.tg : '';
}
async function adminChatlar(XD) { return (XD || await xodimlar()).filter(z => z.admin && z.tg).map(z => z.tg); }
async function tasdiqChatlar(it) {   // ixtiyoriy nazorat — yurist + direktor; qolgani — tekshiruvchi
  const XD = await xodimlar(); const L = [s(await tasdiqchiChat(it, XD))]; if (it.ixtiyoriy) (await adminChatlar(XD)).forEach(c => L.push(c));
  return L.filter((c, i) => c && L.indexOf(c) === i);
}

// ---------------------------------------------------------------- tugmalar
function klavAsosiy(k) { const n = s(k).charAt(0) === 'n';
  return { inline_keyboard: [[{ text: n ? '✅ To\'g\'ri' : '✅ Tasdiqlash', callback_data: 'ts|A|' + k }, { text: '✖ Qaytarish', callback_data: 'ts|R|' + k }]] }; }
function klavSabab(it) {
  const L = TOP_RAD_SABAB[it.rad] || TOP_RAD_SABAB.oddiy;
  return { inline_keyboard: L.map((z, i) => [{ text: '✖ ' + z, callback_data: 'ts|S|' + it.k + '|' + i }])
    .concat([[{ text: '✍ Boshqa — yozaman', callback_data: 'ts|W|' + it.k }], [{ text: '↩ Orqaga', callback_data: 'ts|B|' + it.k }]]) };
}

// ---------------------------------------------------------------- fayl (tasdiqBlob_): { nom, bytes, mime } yoki null
async function faylOl(f) {
  try {
    if (!f) return null;
    let fid = '', nom = '', no = '';
    if (f.hj) {
      let h = (await J.hujjatJurnal()).find(z => String(z.id) === String(f.hj));
      if (!h) { try { h = (await require('../api/qadam_hujjat')._ichki.hjYangi()).find(z => String(z.id) === String(f.hj)); } catch (e) { h = null; } }   // ko'zgu hali yangilanmagan — Google'dan
      if (!h || !h.faylId) return null; fid = h.faylId; nom = h.nom; no = h.no;
    } else if (f.f) fid = f.f; else return null;
    const sv = require('../api/hujjat_yoz').srvFayl(fid, no, nom);
    if (sv) { const e = (/\.([a-z0-9]+)$/i.exec(sv.nom) || ['', 'pdf'])[1].toLowerCase(); return { nom: nom || sv.nom, bytes: sv.bytes, mime: MIME[e] || 'application/pdf' }; }
    const d = await G.driveFayl(fid, env.googleKey);
    return { nom: nom || d.nom, bytes: d.bytes, mime: d.mime || 'application/pdf' };
  } catch (e) { if (!(e instanceof G.RuxsatYoq)) console.error('tg faylOl:', e.message); return null; }
}
const MIME = { pdf: 'application/pdf', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', heic: 'image/heic' };

// fayl(lar)ni bitta chatga: oxirgisi ostida tugmalar (tgFaylYubor_). Qaytaradi { ref: 'd|m:chat:xabar' | '', yoq: o'qilmagan fayllar soni }
async function faylYubor(ctx, chat, F, caption, klav, nomi) {
  F = F || []; let res = null, tur = '', katta = false, yoq = 0;
  for (let i = 0; i < F.length; i++) {
    const b = await faylOl(F[i]); if (!b) { yoq++; continue; }
    if (b.bytes.length > 49 * 1024 * 1024) { katta = true; continue; }
    const so = i === F.length - 1;
    const p = { chat_id: s(chat), caption: so ? s(caption).slice(0, 1024) : '📎 ' + s(nomi) + ' (' + (i + 1) + '/' + F.length + ')', parse_mode: 'HTML' };
    if (so && klav) p.reply_markup = klav;
    const r = await ctx.api('sendDocument', p, { bayt: b.bytes, nom: b.nom, mime: b.mime }); if (so) { res = r; tur = 'd'; }
  }
  if (tur !== 'd') { const p = { chat_id: s(chat), text: s(caption) + (katta ? '\n⚠ Fayl Telegram uchun katta — ilovada oching.' : ''), parse_mode: 'HTML' }; if (klav) p.reply_markup = klav;
    res = await ctx.api('sendMessage', p); tur = 'm'; }
  return { ref: res ? tur + ':' + s(chat) + ':' + res.message_id : '', yoq };
}

// ---------------------------------------------------------------- havola yozish (tgRefYoz_ / xatRefYoz_ / skanNazYoz_ / tqUstunYoz_) — RAW, qator Google'dan tekshirilib
const JOY = { top: { varaq: '10_Topshiriqlar', ustun: 22, kalit: 'id' }, skan: { varaq: '06d_Hujjatlar', ustun: 17, kalit: 'id' }, xat: { varaq: '06e_Xatlar', ustun: 25, kalit: 'raqam' }, tq: { varaq: '06t_Tasdiq_qarorlari', ustun: 15, kalit: 'id' } };
async function qatorTop(tur, kalit) {
  const L = tur === 'top' ? await J.topRows() : tur === 'skan' ? await J.hujjatJurnal() : tur === 'xat' ? await J.xatJurnal() : await J.tqRows();
  const k = JOY[tur].kalit; const h = L.find(z => s(z[k]) === s(kalit)); return h ? h.qator : 0;
}
async function refYoz(ctx, tur, kalit, ref, qosh) {
  const jy = JOY[tur]; if (!jy || !ref) return;
  await yozuv(ctx, jy.varaq + ' ' + G.harfU(jy.ustun) + ' (' + kalit + ') ← havola ' + ref + (qosh ? ' (qo\'shib)' : ''), async () => {
    let q = await qatorTop(tur, kalit);
    const U = G.harfU(jy.ustun);
    let eski = '';
    if (q) { const r = (await G.oraliqOqi(env.aksBazaId, jy.varaq, 'A' + q + ':' + U + q, env.googleKey))[0] || []; if (s(r[0]).trim() !== s(kalit).trim()) q = 0; else eski = s(r[jy.ustun - 1]); }
    if (!q) { const A = await G.ustunOqi(env.aksBazaId, jy.varaq, 'A', env.googleKey); const i = A.findIndex((v, j) => j > 0 && s(v).trim() === s(kalit).trim()); if (i < 0) throw new Error(jy.varaq + ': qator topilmadi — ' + kalit); q = i + 1;
      eski = s(((await G.oraliqOqi(env.aksBazaId, jy.varaq, U + q, env.googleKey))[0] || [])[0]); }
    await G.xomYoz(env.aksBazaId, [{ varaq: jy.varaq, qator: q, ustun: jy.ustun, qiymat: qosh && eski ? eski + ' ' + ref : ref }], env.googleKey);
  });
}

// isbot fayli(lari) tekshiruvchi(lar)ga + ✅ / ✖ (tgTasdiqYubor_). chat berilsa — faqat shu chatga (havola qo'shiladi). Qaytaradi { ref, yoq }
async function tasdiqYubor(ctx, it, chat) {
  if (!it) return { ref: '', yoq: 0 };
  const C = chat ? [s(chat)] : await tasdiqChatlar(it); if (!C.length) return { ref: '', yoq: 0, sabab: 'tekshiruvchining Telegram\'i yo\'q' };
  const klav = klavAsosiy(it.k), R = []; let yoq = 0;
  for (const c of C) { try { const r = await faylYubor(ctx, c, it.fayl, it.caption, klav, it.nomi); if (r.ref) R.push(r.ref); yoq = Math.max(yoq, r.yoq); } catch (e) { console.error('tasdiqYubor ' + c + ':', e.message); } }
  if (!R.length) return { ref: '', yoq };
  const ref = R.join(' ');
  try { await refYoz(ctx, it.tur, it.tur === 'xat' ? it.raqam : it.id, ref, !!chat); } catch (e) { console.error('tasdiqYubor havola:', e.message); }
  return { ref, yoq };
}

// ---------------------------------------------------------------- ⚖ yurist qarorlari (06t): direktor uchun karta va tugmalar
const tqQisqa = v => { v = s(v); return v.length > 300 ? v.slice(0, 297) + '…' : v; };
const tqDmy = iso => { iso = s(iso); return iso ? iso.slice(8, 10) + '.' + iso.slice(5, 7) + ' ' + iso.slice(11, 16) : ''; };
function tqCaption(q) {
  const m = q.m || {};
  return '✖ <b>' + (q.rol === 'direktor' ? 'Direktor' : 'Yurist') + ' qaytardi</b>' + (q.no ? ' · <b>' + esc(q.no) + '</b>' : '') + (m.mijoz ? ' ' + esc(m.mijoz) : '') + '\n'
    + esc(m.nomi || '') + (m.tur === 'xat' || !m.sarlavha ? '' : '\n«' + esc(s(m.sarlavha).slice(0, 160)) + '»') + '\n'
    + 'Yukladi: ' + esc(m.kim || '—') + (m.vaqt ? ', ' + tqDmy(m.vaqt) : '') + '\n'
    + 'Sabab: «' + esc(tqQisqa(q.sabab)) + '» — ' + esc(q.kim) + ', ' + tqDmy(q.vaqt) + '\n'
    + 'Oqibati: ' + (m.ixtiyoriy ? 'skan bekor, xodimga «qayta yuklang» topshirig\'i (1 ish kuni), minus yo\'q' : m.tur === 'xat' ? 'xat «yetkazilmagan»ga qaytdi, xodimga minus yozildi' : m.rad === 'hujjat' ? 'fayl bekor, topshiriq xodimga qaytdi' : 'topshiriq xodimga qaytdi')
    + (q.tiklash ? '' : '\n(tiklash ma\'lumoti yo\'q — kerak bo\'lsa qo\'lda tekshiring)');
}
function tqKlav(q) {
  const L = [{ text: '👍 To\'g\'ri qaytargan', callback_data: 'tr|O|' + q.id }]; if (q.tiklash) L.push({ text: '↩ Isbotni tiklash', callback_data: 'tr|U|' + q.id });
  return { inline_keyboard: [L] };
}
// xulosa matni (tqXulosaMatn_); X — api/topshiriq tqXulosa(L)
function xulosaMatn(X) {
  const m = '⚖ <b>Yurist bugun — ' + X.bugun.split('-').reverse().join('.') + '</b>\n✅ Tasdiqladi: <b>' + X.tas + '</b>\n✖ Qaytardi: <b>' + X.rad + '</b>\n⏳ Kutmoqda: <b>' + X.kut + '</b>'
    + (X.kech ? ' (muddati o\'tgan: <b>' + X.kech + '</b>)' : '')
    + (X.nzTas || X.nzRad || X.nzKut ? '\n🗂 Yangi shartnoma skanlari: ✅ ' + X.nzTas + ' · ✖ ' + X.nzRad + ' · ko\'rilmagan ' + X.nzKut : '')
    + (X.dirTas || X.dirRad ? '\nSiz o\'zingiz: ✅ ' + X.dirTas + ' · ✖ ' + X.dirRad : '')
    + (X.kor ? '\nQaroringizni kutayotgan qaytarishlar: <b>' + X.kor + '</b>' : '') + (X.tik ? '\nSiz tiklagan isbotlar (7 kun): ' + X.tik : '');
  const T = []; if (X.kut) T.push({ text: '📥 Kutilayotganlar (' + X.kut + ')', callback_data: 'tq|K' }); if (X.kor) T.push({ text: '📥 Qaytarilganlar — qaroringiz (' + X.kor + ')', callback_data: 'tq|Q' });
  return { matn: m, klav: T.length ? { inline_keyboard: [T] } : null, bosh: !(X.tas || X.rad || X.kut || X.nzTas || X.nzRad || X.nzKut || X.dirTas || X.dirRad || X.kor) };
}
async function xulosa() { const TP = require('../api/topshiriq')._ichki; return xulosaMatn(await TP.tqXulosa(await J.tqRows())); }
// tqXulosaYubor_: majburiy — bo'sh bo'lsa ham («hech narsa yo'q ✅»). Qaytaradi true — yuborildi
async function xulosaYubor(ctx, chat, majburiy) {
  const X = await xulosa();
  if (X.bosh && !majburiy) return false;
  const p = { chat_id: s(chat), text: X.bosh ? '⚖ Bugun yurist tekshiruvi bo\'yicha hech narsa yo\'q ✅' : X.matn, parse_mode: 'HTML' }; if (X.klav && !X.bosh) p.reply_markup = X.klav;
  await ctx.api('sendMessage', p); return true;
}
// «📥 Kutilayotganlar» — har biri fayl + ✅ / ✖ (tqKutYubor_). Navbatdagi (fonda bajarilayotgan) qarorlar ko'rsatilmaydi
async function kutYubor(ctx, chat) {
  let L = (await TS.tasdiqNavbat()).filter(it => it.tasdiqchi === 'yurist');
  try { const KUT = await require('../api/tasdiq_navbat')._ichki.kutilmoqda(); L = L.filter(it => !KUT[it.k]); } catch (e) { }
  L.sort((a, b) => (b.kech - a.kech) || (b.shosh - a.shosh) || (a.muddat < b.muddat ? -1 : 1));
  if (!L.length) { await ctx.api('sendMessage', { chat_id: s(chat), text: 'Kutilayotgan isbot yo\'q ✅' }); return 0; }
  for (const it of L.slice(0, TQ_MAX)) await tasdiqYubor(ctx, it, chat);
  if (L.length > TQ_MAX) await ctx.api('sendMessage', { chat_id: s(chat), text: 'Yana ' + (L.length - TQ_MAX) + ' ta — ilovada: ⚖ Yurist → 🔎 Tekshirish kerak.' });
  return Math.min(L.length, TQ_MAX);
}
// «📥 Qaytarilganlar» — yurist qaytargan, direktor ko'rmaganlar: fayl + sabab + 👍 / ↩ (tqRadYubor_)
async function radYubor(ctx, chat) {
  const L = await TS.tqKorilmagan();
  if (!L.length) { await ctx.api('sendMessage', { chat_id: s(chat), text: 'Qaroringizni kutayotgan qaytarish yo\'q ✅' }); return 0; }
  for (const q of L.slice(0, TQ_MAX)) {
    try { const r = await faylYubor(ctx, chat, (q.m || {}).fayl, tqCaption(q), tqKlav(q), (q.m || {}).nomi); if (r.ref) await refYoz(ctx, 'tq', q.id, r.ref, true); }
    catch (e) { console.error('radYubor:', e.message); }
  }
  if (L.length > TQ_MAX) await ctx.api('sendMessage', { chat_id: s(chat), text: 'Yana ' + (L.length - TQ_MAX) + ' ta — ilovada: ⚖ Yurist → ⚖ Yurist qarorlari.' });
  return Math.min(L.length, TQ_MAX);
}

// ---------------------------------------------------------------- Koprik o'rni: koprikTopTasdiqTg(id) / koprikXatTasdiqTg(raqam) — natija shakli Koprik bilan bir xil;
// fayl o'qilmasa { koprikka: true } — chaqiruvchi eski Koprik'ka beradi (direktor hisobi faylni ko'radi)
async function topTasdiqTg(id) {
  const TP = require('../api/topshiriq_yoz')._ichki;
  const R = await TP.topRowsYangi('10_Topshiriqlar'); const t = R.L.find(z => String(z.id) === String(id)); if (!t) return { ok: false };
  const [sh, HJ, XJ] = await Promise.all([TS.topShosh(), J.hujjatJurnal(), J.xatJurnal()]);
  const it = TS.tasdiqTopItem(t, sh, HJ, XJ);
  if (!(t.holati === 'Tekshiruvda' && !/^(qayta|devon|malumot)\|/.test(s(t.kalit)))) return { ok: true, ref: '' };
  // 🤖 avto qabul (24.10): yurist tekshiradigan isbot — tugma yuborilmaydi, server o'zi ✅ qaror qiladi (api/avto_isbot.js)
  if (it.tasdiqchi === 'yurist') { const A = require('../api/avto_isbot'); if (await A.yoqilgan()) return A.qabul('t' + t.id); }
  for (const f of it.fayl) if (!(await faylOl(f))) return { koprikka: true };
  const r = await tasdiqYubor(haqiqiy(), it); return { ok: true, ref: r.ref };
}
async function xatTasdiqTg(raqam) {
  const XJ = await J.xatJurnal(); const h = XJ.find(z => z.raqam === String(raqam));
  const [sh, HJ] = await Promise.all([TS.topShosh(), J.hujjatJurnal()]);
  const it = h ? TS.xatTasdiqItem(h, sh, HJ) : null;
  if (!it) return { ok: false, ref: '' };
  // 🤖 avto qabul (24.10): xat isbotini ham server o'zi qabul qiladi
  { const A = require('../api/avto_isbot'); if (await A.yoqilgan()) return A.qabul('x' + h.raqam); }
  for (const f of it.fayl) if (!(await faylOl(f))) return { koprikka: true };
  const r = await tasdiqYubor(haqiqiy(), it); return { ok: true, ref: r.ref };
}

module.exports = { haqiqiy, quruq, yozuv, xodimlar, tgXodim, tasdiqHuquq, rol, tasdiqchiChat, adminChatlar, tasdiqChatlar, klavAsosiy, klavSabab, faylOl, faylYubor, refYoz, tasdiqYubor,
  tqCaption, tqKlav, xulosaMatn, xulosa, xulosaYubor, kutYubor, radYubor, topTasdiqTg, xatTasdiqTg, TOP_RAD_SABAB, TQ_MAX, hozirDmyHm, esc };
