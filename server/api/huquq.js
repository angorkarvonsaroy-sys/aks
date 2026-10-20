// AKS TIZIM — 🔑 xodimlar huquqlarini tizimdan boshqarish (yangi imkoniyat, faqat serverda; direktor so'rovi 20.10.2026).
// Avval direktor 07_Xodimlar S ustunini (Huquqlar) jadvalda qo'lda yozardi. Endi: Sozlamalar → Huquqlar → xodim → belgilar → Saqlash.
// Server S katagiga o'zi yozadi (matn, vergul bilan — avvalgi ko'rinishda). Eski tizim ham o'sha katakni o'qiydi — ikkalasida bir xil.
// Xavfsizlik: faqat direktor (admin); «admin» huquqi bu yerdan berilmaydi va olinmaydi (faqat jadvalda); o'z huquqini o'zgartirib bo'lmaydi;
// yozishdan oldin qator Google'dan YANGI o'qiladi — shu orada jadvalda o'zgargan bo'lsa yozilmaydi. Har o'zgarish jurnalga (Redis huquq_jurnal).
'use strict';
const crypto = require('crypto');
const S = require('./sessiya');
const V = require('../lib/varaq');
const G = require('../lib/google');
const env = require('../lib/env');
const tetik = require('../lib/kozgu_tetik');
const { redis } = require('../lib/db');

const T07 = '07_Xodimlar', T08d = '08d_Huquqlar';
const US = { id: 0, fish: 1, lavozim: 3, holat: 10, huquq: 18 };   // 07_Xodimlar: A ID, B F.I.Sh., D lavozim, K holat, S huquqlar
const KALIT = /^[a-z_]+$/;
// Tizim kodida ishlatiladigan huquqlar va ularning ma'nosi (08d_Huquqlar da tavsif bo'lsa — o'shanisi ko'rsatiladi)
const BILAMAN = [
  ['tolov', "To'lov kiritish (kassa)"],
  ['tashrif', 'Tashriflar va telefon murojaatlarini yozish'],
  ['shartnoma', 'Yangi mijoz va shartnoma tuzish, ijara'],
  ['hujjat', 'Hujjatlar: skan yuklash, tahrir, tuzatish'],
  ['skan', "Skanlarni ko'rish (👁)"],
  ['reyestr', 'Ijara va sotuv reyestri (PDF / Excel)'],
  ['hisobot', 'Hisobot'],
  ['xarita', "Do'konlar xaritasi"],
  ['xarita_moliya', "Xaritada pul ma'lumotlari (qarz, to'lov)"],
  ['undiruv', "Undiruvchi — o'ziga biriktirilgan qarzdorlar, «Bugungi ish»"],
  ['yurist', "Yurist bo'limi — yuristga o'tkazilgan ishlar"],
  ['xat', 'Ogohlantirish xatlari'],
  ['devon', 'Devonxona (kirim-chiqim xatlar)'],
  ['taminot', "Ta'minot (xarid, to'lov so'rovlari)"],
  ['ijara_kelishuv', 'Ijarani kelishuv bilan bekor qilish'],
  ['bekor_korish', "Bekor qilingan shartnomalarni ko'rish"],
  ['tekshiruv', 'Isbotlarni tekshirish (nazorat)'],
  ['kompyuter_rejim', "Kompyuter rejimi (chap menyuli yangi ko'rinish)"],
  ['noqonuniy_korish', "Noqonuniy hududdagilarni ko'rish (endi hamma ko'radi — kerak emas)"],
];
const s = v => String(v == null ? '' : v);
const idN = v => s(v).trim().replace(/\.0$/, '');
const ajrat = t => s(t).split(',').map(x => x.trim()).filter(Boolean);

// 08d_Huquqlar — ustunlar tartibi qat'iy emas: huquq kalitlari (kichik lotin harflar, «_») eng ko'p turgan ustun — kalit, eng uzun matnli boshqa ustun — tavsif
async function jadval08d() {
  let R = []; try { R = await V.qatorlar(T08d); } catch (e) { return {}; }
  if (!R.length) return {};
  const n = Math.max(...R.map(z => z.r.length)), ball = [];
  for (let c = 0; c < Math.min(n, 6); c++) ball.push(R.filter(z => KALIT.test(s(z.r[c]).trim().toLowerCase())).length);
  const kc = ball.indexOf(Math.max(...ball)); if (kc < 0 || !ball[kc]) return {};
  let tc = -1, eng = 0;
  for (let c = 0; c < Math.min(n, 6); c++) { if (c === kc) continue; const o = R.reduce((a, z) => a + s(z.r[c]).length, 0); if (o > eng) { eng = o; tc = c; } }
  const o = {}; R.forEach(z => { const k = s(z.r[kc]).trim().toLowerCase(); if (KALIT.test(k) && !(k in o)) o[k] = tc >= 0 ? s(z.r[tc]).trim() : ''; });
  return o;
}

async function huquqlarRoyxat(xodimlar) {
  const d = await jadval08d(), ism = Object.fromEntries(BILAMAN), tartib = BILAMAN.map(x => x[0]);
  const hammasi = new Set(['admin'].concat(tartib, Object.keys(d)));
  xodimlar.forEach(x => x.huquq.forEach(h => { if (KALIT.test(h)) hammasi.add(h); }));
  const ixt = k => k === 'admin' ? -1 : (tartib.indexOf(k) >= 0 ? tartib.indexOf(k) : 1000);
  return [...hammasi].sort((a, b) => ixt(a) - ixt(b) || a.localeCompare(b)).map(k => ({
    k, t: k === 'admin' ? 'Direktor — hamma narsaga to\'liq ruxsat' : (d[k] || ism[k] || ''), qulf: k === 'admin',
  }));
}

async function xodimlarOqi() {
  return (await V.qatorlar(T07)).filter(z => idN(z.x[US.id]) !== '').map(z => ({
    id: idN(z.r[US.id] || z.x[US.id]), fish: s(z.r[US.fish]).trim(), lavozim: s(z.r[US.lavozim]).trim(), holat: s(z.r[US.holat]).trim(),
    huquq: ajrat(s(z.r[US.huquq]).toLowerCase()),
  }));
}

async function jurnal(n = 15) { try { return (await redis.lrange('huquq_jurnal', 0, n - 1)).map(x => JSON.parse(x)); } catch (e) { return []; } }

async function huqRoyxat([kodSes]) {
  const u = await S.ruxsat(kodSes, 'admin');
  if (!u.admin) throw new S.Xato('Bu bo\'lim faqat direktor uchun.');
  const xodimlar = await xodimlarOqi();
  xodimlar.forEach(x => { x.ozi = x.id === idN(u.id); });
  return { xodimlar, huquqlar: await huquqlarRoyxat(xodimlar), jurnal: await jurnal() };
}

async function qulfBilan(nom, ish) {
  const kalit = 'qulf:' + nom, belgi = crypto.randomBytes(8).toString('hex'), t0 = Date.now();
  while (!(await redis.set(kalit, belgi, 'PX', 30000, 'NX'))) { if (Date.now() - t0 > 20000) throw new S.Xato('Tizim band — birozdan keyin qayta urinib ko\'ring.'); await new Promise(r => setTimeout(r, 150)); }
  try { return await ish(); } finally { if ((await redis.get(kalit)) === belgi) await redis.del(kalit); }
}
const vaqt = () => { const t = new Date(Date.now() + 5 * 3600000).toISOString(); return t.slice(8, 10) + '.' + t.slice(5, 7) + '.' + t.slice(0, 4) + ' ' + t.slice(11, 16); };   // Toshkent
const teng = (a, b) => a.length === b.length && [...a].sort().join() === [...b].sort().join();

async function huqSaqla([kodSes, d0]) {
  const u = await S.ruxsat(kodSes, 'admin');
  if (!u.admin) throw new S.Xato('Bu bo\'lim faqat direktor uchun.');
  const d = d0 || {}, id = idN(d.id);
  const oldin = Array.isArray(d.oldin) ? d.oldin.map(x => s(x).trim().toLowerCase()) : null;
  const keyin = Array.isArray(d.keyin) ? [...new Set(d.keyin.map(x => s(x).trim().toLowerCase()).filter(Boolean))] : null;
  if (!id || !oldin || !keyin) throw new S.Xato('Ma\'lumot to\'liq emas — sahifani yangilang.');
  if (id === idN(u.id)) throw new S.Xato('O\'z huquqlaringiz bu yerda o\'zgartirilmaydi.');
  if (keyin.some(k => !KALIT.test(k))) throw new S.Xato('Noto\'g\'ri huquq nomi.');
  if (oldin.includes('admin') !== keyin.includes('admin')) throw new S.Xato('«admin» huquqi bu yerdan berilmaydi va olinmaydi — faqat jadvalda.');
  const ruxsatli = new Set((await huquqlarRoyxat(await xodimlarOqi())).map(h => h.k));
  const begona = keyin.filter(k => !ruxsatli.has(k) && !oldin.includes(k));
  if (begona.length) throw new S.Xato('Noma\'lum huquq: ' + begona.join(', '));
  if (teng(oldin, keyin)) throw new S.Xato('O\'zgarish yo\'q.');

  let natija;
  try {
    natija = await qulfBilan('07', async () => {
      const R = await G.oraliqOqi(env.aksBazaId, T07, 'A2:S', env.googleKey);   // Google'dan YANGI
      const i = R.findIndex(r => idN(r[US.id]) === id);
      if (i < 0) throw new S.Xato('Xodim jadvalda topilmadi (ID ' + id + ').');
      const r = R[i], fish = s(r[US.fish]).trim(), cur = s(r[US.huquq]);
      const hozir = ajrat(cur.toLowerCase());
      if (!teng(hozir, oldin)) throw new S.Xato('Shu orada ' + fish + ' huquqlari jadvalda o\'zgargan. «⟳ Yangilash» bosib, qaytadan belgilang.');
      // avvalgi yozuv tartibi va ko'rinishi saqlanadi, yangilari oxiriga
      const qoldi = ajrat(cur).filter(x => keyin.includes(x.toLowerCase()));
      const qosh = keyin.filter(k => !hozir.includes(k));
      const sep = !cur.trim() || /,\s/.test(cur) ? ', ' : ',';
      const yangi = qoldi.concat(qosh).join(sep);
      const g = await G.gid(env.aksBazaId, T07, env.googleKey);
      await G.soralar(env.aksBazaId, [{ updateCells: { range: { sheetId: g, startRowIndex: i + 1, endRowIndex: i + 2, startColumnIndex: US.huquq, endColumnIndex: US.huquq + 1 },
        rows: [{ values: [{ userEnteredValue: { stringValue: yangi } }] }], fields: 'userEnteredValue' } }], env.googleKey);
      return { fish, qator: i + 2, qoshildi: qosh, olindi: hozir.filter(k => !keyin.includes(k)), huquq: ajrat(yangi.toLowerCase()) };
    });
  } catch (e) {
    if (e instanceof G.RuxsatYoq) throw new S.Xato('Robotda jadvalga yozish huquqi yo\'q — hech narsa o\'zgarmadi.');
    throw e;
  }
  const yoz = { vaqt: vaqt(), kim: u.fish, xodim: natija.fish, id, qoshildi: natija.qoshildi, olindi: natija.olindi };
  try { await redis.lpush('huquq_jurnal', JSON.stringify(yoz)); await redis.ltrim('huquq_jurnal', 0, 499); } catch (e) { console.error('huquq_jurnal:', e.message); }
  console.log('🔑 huquq:', JSON.stringify(yoz));
  await Promise.race([tetik.varaqlarYangila([T07]).catch(e => console.error('ko\'zgu (07):', e.message)), new Promise(r => setTimeout(r, 15000))]);
  return { ok: true, fish: natija.fish, huquq: natija.huquq, qoshildi: natija.qoshildi, olindi: natija.olindi, jurnal: await jurnal() };
}

module.exports = { huqRoyxat, huqSaqla };
module.exports._ichki = { jadval08d, huquqlarRoyxat, xodimlarOqi, BILAMAN, ajrat, idN };
