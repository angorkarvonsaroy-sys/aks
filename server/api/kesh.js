// AKS TIZIM — ko'prik orqali o'qiladigan amallar uchun KESH («oldindan tayyor javob»).
// Muammo: eski tizimdagi har bir o'qish 10–40 s. Planshet har ochilganda shu kutish takrorlanadi.
// Yechim: faqat O'QIYDIGAN amallar javobi Redis'da saqlanadi (xodim + amal + argumentlar bo'yicha).
//   - keshda bor va yangi (≤ YANGI_MS) → darhol beriladi;
//   - keshda bor, lekin eskiroq → darhol beriladi, orqa fonda yangisi so'raladi (keyingi ochilish yangi bo'ladi);
//   - keshda yo'q → ko'prikdan olinadi va saqlanadi.
//   - xodim YOZADIGAN amal bajarsa (chora, xat, tasdiq…) — uning hamma keshi o'chadi va yaqinda ishlatgan o'qishlari
//     orqa fonda qayta tayyorlanadi (ekran yangilanganda tayyor turadi).
//   - har 3 daqiqada: oxirgi 20 daqiqada faol bo'lgan xodimlarning o'qishlari yangilanadi (planshet ochilganda doim tayyor).
// Bu vaqtinchalik ko'prik: amal serverga ko'chirilgach (amallar.js) kesh unga kerak bo'lmaydi.
'use strict';
const crypto = require('crypto');
const { redis } = require('../lib/db');
const koprik = require('./koprik');

const YANGI_MS = 45 * 1000;          // shu yoshgacha — yangi hisoblanadi, qayta so'ralmaydi
const SAQLASH_SEK = 15 * 60;         // Redis'da saqlash muddati
const FAYL_SEK = 60 * 60;            // fayl (PDF/rasm) javoblari o'zgarmaydi — 1 soat
const ISITISH_MS = 3 * 60 * 1000;    // orqa fon yangilash davri
const FAOL_SEK = 20 * 60;            // oxirgi 20 daqiqada ishlagan xodimlar isitiladi

// Eski tizimda faqat O'QIYDIGAN amallar (jadvalga yozmaydi). Ro'yxatda yo'q amal — yozuvchi hisoblanadi.
const OQISH = new Set(('qadamBoshlang qadamMijoz qadamNazorat qadamTarix qadamJamoa qadamYuristYol qadamSudKarta qadamTalabHolat qadamTgTel ' +
  'xodimBosh boshMalumot devonDirektor kbDirektor taminotDirektor sifatXodimlar sifatAsosiy bekorDirektor bekorHolat ' +
  'ijaraImzosizRoyxat ijaraImzosizHolat topRoyxat topMening topHozir topXodimlar tqRoyxat tasdiqRoyxat undBoshlang undMijoz ' +
  'xatBoshlang xatNazorat hujjatBoshlang hujjatNazorat hujjatlarRoyxati yuristBoshlang yuristHolat yuristIsh monBoshlang ' +
  'shartnomalar shartnomaBoshlang reyestrSotuv reyestrIjara hisobotMalumot bugungiTolovlar bugungiTashriflarHammasi ' +
  'devonBoshlang devonIjroHolat devonChiqimOl taminotBoshlang taminotSvodOl qaytaOchiq qaytaKor qaytaHujjatlar ijroKorish kbHolat tahrirHolat ' +
  'mijozKarta jadvalHisob').split(/\s+/));
const FAYL = new Set('qadamFayl kbFayl devonFayl bekorFayl tqFayl tasdiqFayl yhAloqaFayl'.split(' '));

const oqishmi = fn => OQISH.has(fn) || FAYL.has(fn);
const kalit = (kod, fn, args) => 'kk:' + kod + ':' + fn + ':' + crypto.createHash('sha1').update(JSON.stringify(args || [])).digest('hex').slice(0, 16);
const royxat = kod => 'kkr:' + kod;          // xodimning o'qish kalitlari: {kalit → JSON{fn,args,vaqt}}
const FAOL = 'kk_faol';                      // zset: kod → oxirgi faollik (ms)

const yolda = new Map();                     // kalit → Promise (bir xil so'rov ikki marta ketmasin)

async function kopriqdanOl(kod, fn, args, k) {
  if (yolda.has(k)) return yolda.get(k);
  const p = (async () => {
    const r = await koprik.chaqir(fn, kod, args);
    const yoz = JSON.stringify({ vaqt: Date.now(), r: r === undefined ? null : r });
    await redis.set(k, yoz, 'EX', FAYL.has(fn) ? FAYL_SEK : SAQLASH_SEK);
    return r;
  })();
  yolda.set(k, p);
  try { return await p; } finally { yolda.delete(k); }
}

async function eslab(kod, fn, args, k) {
  await redis.hset(royxat(kod), k, JSON.stringify({ fn, args: args || [], vaqt: Date.now() }));
  await redis.expire(royxat(kod), FAOL_SEK * 3);
  await redis.zadd(FAOL, Date.now(), kod);
}

// O'qish: {r, qayerda}. qayerda: 'kesh' (yangi), 'kesh-yangilanmoqda' (eski berildi, fon yangilayapti), 'koprik' (birinchi marta)
async function oqi(kod, fn, args) {
  const k = kalit(kod, fn, args);
  eslab(kod, fn, args, k).catch(() => {});
  const bor = await redis.get(k);
  if (bor) {
    const j = JSON.parse(bor);
    const yosh = Date.now() - j.vaqt;
    if (yosh > YANGI_MS && !FAYL.has(fn)) kopriqdanOl(kod, fn, args, k).catch(() => {});
    return { r: j.r, qayerda: yosh > YANGI_MS ? 'kesh-yangilanmoqda' : 'kesh' };
  }
  return { r: await kopriqdanOl(kod, fn, args, k), qayerda: 'koprik' };
}

// Yozuvdan keyin: xodimning keshi o'chadi, yaqinda ishlatgan o'qishlari fonda qayta tayyorlanadi
async function yozuvdanKeyin(kod) {
  const h = await redis.hgetall(royxat(kod));
  const kalitlar = Object.keys(h);
  if (!kalitlar.length) return;
  await redis.del(kalitlar);
  const yaqinda = kalitlar.map(k => ({ k, ...JSON.parse(h[k]) })).filter(x => Date.now() - x.vaqt < 30 * 60 * 1000 && !FAYL.has(x.fn));
  setTimeout(() => { for (const x of yaqinda) kopriqdanOl(kod, x.fn, x.args, x.k).catch(() => {}); }, 1500);
}

// Fon: faol xodimlarning eskirgan o'qishlarini yangilab turish
async function isit() {
  const kodlar = await redis.zrangebyscore(FAOL, Date.now() - FAOL_SEK * 1000, '+inf');
  await redis.zremrangebyscore(FAOL, '-inf', Date.now() - FAOL_SEK * 1000 * 3);
  let soni = 0;
  for (const kod of kodlar) {
    const h = await redis.hgetall(royxat(kod));
    for (const k of Object.keys(h)) {
      const x = JSON.parse(h[k]);
      if (FAYL.has(x.fn) || Date.now() - x.vaqt > FAOL_SEK * 1000) continue;
      const bor = await redis.get(k);
      if (bor && Date.now() - JSON.parse(bor).vaqt < 2 * 60 * 1000) continue;
      if (++soni > 40) return;   // bir davrda ko'pi bilan 40 ta — Google'ni bosmaslik uchun
      kopriqdanOl(kod, x.fn, x.args, k).catch(() => {});
    }
  }
}
let taymer = null;
function boshla() { if (!taymer) { taymer = setInterval(() => isit().catch(() => {}), ISITISH_MS); taymer.unref(); } }

module.exports = { oqishmi, oqi, yozuvdanKeyin, boshla };
