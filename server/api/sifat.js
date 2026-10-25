// AKS TIZIM — 👁 KO'RISH REJIMI serverda (Sifat.gs v1.8 bilan bir xil tartib): direktor xodim ko'zi bilan ilovani ochadi — faqat o'qish.
//   sifatHavola  — havola: /?k=<direktor kodi>&sifat=<Xodim_ID>[&q=1]&b=<bilet>; bilet — bir martalik, 10 daqiqa (Redis sfb:), PIN o'rniga.
//   sifatAsosiy  — «✕ Yopish»: direktorning o'z sahifasi havolasi (bilet bilan).
//   sifatBilet   — sahifa ochilganda bilet → direktorning tirik sessiya tokeni ({tok}); bilet o'chadi.
//   sifatida     — ko'rish oynasining HAR so'rovi: direktor sessiyasi tekshiriladi, amal SIFAT_OQISH ro'yxatida bo'lsa — XODIM NOMIDAN bajariladi:
//                  serverdagi amal — xodimning kirish kodi bilan serverda ochilgan yashirin sessiya orqali (token brauzerga chiqmaydi, 07b ga yozilmaydi);
//                  serverda yo'q amal — eski tizimning o'z sifatida() si (ko'prik). Ro'yxatda yo'q amal (saqlash, yuklash, tasdiqlash…) — rad.
//   GET /?k=…&sifat=ID — api/index.js: sahifa xodim ismi va huquqlari (+ «sifat=ID») bilan ochiladi (Kod.gs doGet v9.6).
// Yoqilishi: Redis yozuv_yondi:sifat («aks-yozuv-sinov sifat»). Aks holda — avvalgidek eski tizim (ko'prik: havola eski saytga).
'use strict';
const crypto = require('crypto');
const S = require('./sessiya');
const koprik = require('./koprik');
const { q, redis } = require('../lib/db');

const SIFAT_OQISH = ['xodimBosh', 'topMening', 'topXodimlar', 'pinTirik', 'qadamSudKarta', 'qadamTgTel',
  'qadamTalabHolat', 'xatTopPdf', 'tasdiqRoyxat', 'tasdiqFayl',
  'devonBoshlang', 'devonFayl', 'devonChiqimOl', 'devonIjroHolat',
  'hujjatBoshlang', 'hujjatlarRoyxati', 'hujjatNazorat',
  'mijozQidir', 'mijozKarta', 'mijozKartaPdf',
  'shartnomaBoshlang', 'shartnomalar', 'bugungiTolovlar', 'jadvalHisob', 'bugungiTashriflarHammasi', 'tashrifTekshir',
  'xatBoshlang', 'xatPdf', 'xatNazorat', 'yuristBoshlang', 'yuristIsh', 'yuristHolat', 'yhAloqaFayl',
  'undBoshlang', 'undMijoz', 'qadamBoshlang', 'qadamMijoz', 'qadamNazorat', 'qadamTarix', 'qadamFayl', 'qadamYuristYol', 'ijroKorish', 'taminotBoshlang', 'taminotSvodOl',
  'reyestrIjara', 'reyestrSotuv', 'reyestrPdf', 'reyestrExcel', 'reyestrSotuvPdf', 'reyestrSotuvExcel', 'hisobotMalumot', 'hisobotPdf',
  'qaytaOchiq', 'qaytaLoyiha', 'qaytaKor', 'qaytaHujjatlar', 'kbHolat', 'kbFayl', 'ijaraImzosizHolat', 'bekorHolat', 'bekorFayl', 'tahrirHolat',
  'xaritaMalumot',
  'menKimman', 'hujjatFayl', 'tqRoyxat'];   // faqat serverda bor o'qish amallari
const BILET_SEK = 600;
const s = v => String(v == null ? '' : v);

async function yoqilgan() { try { return (await redis.get('yozuv_yondi:sifat')) === '1'; } catch (e) { return false; } }
// sifatXodim_: ishlayotgan, huquqi bor xodim (Xodim_ID bo'yicha)
async function sifatXodim(xodimId) {
  const id = s(xodimId).replace(/\.0$/, '').trim(); if (!id) return null;
  const r = await q(`SELECT xodim_id, fish, lavozim, huquqlar, kirish_kodi FROM v_xodimlar WHERE kompaniya_id = 1 AND holat = 'Ishlayapti' AND xodim_id = $1 LIMIT 1`, [id]);
  const x = r.rows[0]; if (!x || !x.huquqlar || !x.huquqlar.length) return null;
  return { id: x.xodim_id, fish: x.fish, lavozim: x.lavozim, huquq: x.huquqlar, kod: s(x.kirish_kodi).trim() };
}
async function biletYasa(kodSes) {   // sifatUrl_: bilet — direktor sessiyasi (kod|tok) 10 daqiqa
  const bilet = crypto.randomBytes(16).toString('hex');
  await redis.set('sfb:' + bilet, kodSes, 'EX', BILET_SEK);
  return bilet;
}
async function sifatUrl(kodSes, qoshimcha) {
  const i = s(kodSes).indexOf('|'); if (i < 8) throw new S.Xato('Sessiya tugagan — parolingizni qayta kiriting.');
  return '/?k=' + encodeURIComponent(s(kodSes).slice(0, i)) + qoshimcha + '&b=' + await biletYasa(kodSes);
}

// ---------- direktor: xodim ko'zi bilan ochish havolasi
async function sifatHavola(args) {
  const [kodSes, xodimId, qobiq] = args;
  const u = await S.ruxsat(kodSes, 'admin');
  if (!(await yoqilgan())) return koprik.chaqir('sifatHavola', u.kod, [xodimId, qobiq]);
  const x = await sifatXodim(xodimId); if (!x) throw new S.Xato('Xodim topilmadi yoki ishlamayapti.');
  return { url: await sifatUrl(kodSes, '&sifat=' + encodeURIComponent(x.id) + (qobiq ? '&q=1' : '')), fish: x.fish };
}
// ---------- «✕ Yopish» — direktorning o'z sahifasi
async function sifatAsosiy(args) {
  const [kodSes] = args;
  const u = await S.ruxsat(kodSes, 'admin');
  if (!(await yoqilgan())) return koprik.chaqir('sifatAsosiy', u.kod, []);
  return { url: await sifatUrl(kodSes, '') };
}
// ---------- bilet → token (bir marta)
async function sifatBilet(args) {
  const [kod0, bilet] = args;
  const b = s(bilet).replace(/[^0-9a-f]/gi, ''); if (!b) throw new S.Xato('Bilet yo\'q.');
  const v = await redis.get('sfb:' + b); if (v) await redis.del('sfb:' + b);   // bir martalik
  if (!v) { if (!(await yoqilgan())) return koprik.chaqir('sifatBilet', s(kod0), [bilet]); throw new S.Xato('Bilet eskirgan.'); }
  const i = v.indexOf('|'); if (i < 1 || v.slice(0, i) !== s(kod0)) throw new S.Xato('Bilet boshqa foydalanuvchiniki.');
  if (!(await S.foydalanuvchi(v))) throw new S.Xato('Sessiya tugagan.');
  return { tok: v.slice(i + 1) };
}
// ---------- xodim nomidan o'qish
async function xodimSessiya(dirTok, x) {   // direktor sessiyasiga bog'langan yashirin xodim sessiyasi (15 daqiqa, har so'rovda uzayadi)
  const k = 'sfses:' + dirTok + ':' + x.id;
  let tok = await redis.get(k);
  if (tok && (await redis.get('ses:' + tok)) === x.kod) { await redis.expire(k, S.SESSIYA_SEK); return tok; }
  tok = await S.sessiyaOch(x.kod);
  await redis.set(k, tok, 'EX', S.SESSIYA_SEK);
  return tok;
}
async function sifatida(args) {
  const [kodSes, xodimId, fn0, a0] = args;
  const u = await S.foydalanuvchi(kodSes); if (!u) throw new S.Xato('Sessiya tugagan — parolingizni qayta kiriting.');
  if (!u.admin) throw new S.Xato('Ko\'rish rejimi faqat direktorga.');
  const fn = s(fn0).replace(/[^A-Za-z0-9_]/g, ''), a = Array.isArray(a0) ? a0 : [];
  if (!(await yoqilgan())) return koprik.chaqir('sifatida', u.kod, [xodimId, fn, a]);
  return sifatidaYadro(u, kodSes, xodimId, fn, a);
}
async function sifatidaYadro(u, kodSes, xodimId, fn, a) {   // sinov ham shuni ishlatadi
  if (SIFAT_OQISH.indexOf(fn) < 0) throw new S.Xato('👁 Ko\'rish rejimi: bu amal («' + fn + '») bazaga yozadi — ko\'rish rejimida bajarilmaydi. Kerak bo\'lsa o\'z oynangizdan bajaring.');
  const x = await sifatXodim(xodimId); if (!x) throw new S.Xato('Xodim topilmadi yoki ishlamayapti (ID ' + s(xodimId) + ').');
  const A = require('./amallar');
  if (typeof A[fn] !== 'function') return koprik.chaqir('sifatida', u.kod, [x.id, fn, a]);   // serverda yo'q — eski tizimning sifatida() si
  if (!x.kod) throw new S.Xato('Xodimning kirish kodi yo\'q (07_Xodimlar L ustuni) — ko\'rish rejimi ochilmaydi.');
  const tok = await xodimSessiya(s(kodSes).split('|')[1], x);
  return A[fn]([x.kod + '|' + tok].concat(a));
}

module.exports = { sifatHavola, sifatAsosiy, sifatBilet, sifatida };
module.exports._ichki = { sifatXodim, sifatidaYadro, yoqilgan, SIFAT_OQISH };
