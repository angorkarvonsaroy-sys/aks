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
  ['tasischi', "Ta'sischi hisoboti (1-ilova) — ko'rish va PDF"],
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
    toliq: s(z.r[2]).trim(), tel: s(z.r[5]).trim(),   // C to'liq F.I.Sh., F telefon — ilovadan tahrirlanadi (xodimTahrir)
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

// ------------------------------------------------------------------ ➕ YANGI XODIM (direktor so'rovi 26.10.2026)
// Avval direktor 07_Xodimlar ga qo'lda qator yozardi. Endi: Sozlamalar → Huquqlar → «➕ Yangi xodim».
// Server qator qo'shadi: A ID (keyingi raqam), B F.I.Sh., C to'liq kirill F.I.Sh., D lavozim, F telefon, K «Ishlayapti», S huquqlar.
// L (kirish kodi) ATAYLAB BO'SH qoldiriladi — xodim botga raqamini yuborganda bot o'zi yasab beradi (lib/tg_kirish.js kodBirinchi).
// «admin» huquqi bu yerdan ham berilmaydi (faqat jadvalda). Takror F.I.Sh. yoki takror telefon — qabul qilinmaydi.
const UQ = { toliq: 2, tel: 5 };   // C to'liq F.I.Sh., F telefon
const telRaqam = t => { let d = s(t).replace(/\D/g, ''); if (d.length === 12 && d.indexOf('998') === 0) d = d.slice(3); return d; };
const nomTeng = (a2, b2) => s(a2).toLowerCase().replace(/[`'’ʻʼ]/g, '').replace(/\s+/g, ' ').trim() === s(b2).toLowerCase().replace(/[`'’ʻʼ]/g, '').replace(/\s+/g, ' ').trim();

async function xodimQosh([kodSes, d0]) {
  const u = await S.ruxsat(kodSes, 'admin');
  if (!u.admin) throw new S.Xato('Bu bo\'lim faqat direktor uchun.');
  const d = d0 || {};
  const fish = s(d.fish).replace(/\s+/g, ' ').trim();
  const toliq = s(d.toliq).replace(/\s+/g, ' ').trim();
  const lavozim = s(d.lavozim).replace(/\s+/g, ' ').trim();
  const tel = telRaqam(d.tel);
  const huquq = [...new Set(ajrat(s(d.huquq).toLowerCase()))];
  if (fish.split(' ').filter(Boolean).length < 2) throw new S.Xato('F.I.Sh. ni to\'liq yozing (kamida ism va familiya).');
  if (fish.length < 5 || fish.length > 80) throw new S.Xato('F.I.Sh. 5–80 belgi bo\'lsin.');
  if (!lavozim) throw new S.Xato('Lavozimini yozing.');
  if (tel.length !== 9) throw new S.Xato('Telefon raqami 9 ta raqamdan iborat bo\'lsin (masalan 90 123 45 67).');
  if (huquq.includes('admin')) throw new S.Xato('«admin» huquqi bu yerdan berilmaydi — faqat jadvalda.');
  if (huquq.some(k => !KALIT.test(k))) throw new S.Xato('Noto\'g\'ri huquq nomi.');
  if (!huquq.length) throw new S.Xato('Kamida bitta huquq belgilang — aks holda xodim tizimga kira olmaydi.');
  const ruxsatli = new Set((await huquqlarRoyxat(await xodimlarOqi())).map(h => h.k));
  const begona = huquq.filter(k => !ruxsatli.has(k));
  if (begona.length) throw new S.Xato('Noma\'lum huquq: ' + begona.join(', '));

  let natija;
  try {
    natija = await qulfBilan('07', async () => {
      const R = await G.oraliqOqi(env.aksBazaId, T07, 'A2:S', env.googleKey);   // Google'dan YANGI
      let m = -1; R.forEach((r, i) => { if (idN(r[US.id]) !== '') m = i; });
      const Y = R.slice(0, m + 1);
      if (Y.some(r => nomTeng(r[US.fish], fish))) throw new S.Xato('Bu F.I.Sh. ro\'yxatda bor: ' + fish);
      const t2 = Y.find(r => telRaqam(r[UQ.tel]) === tel);
      if (t2) throw new S.Xato('Bu telefon raqami boshqa xodimda: ' + s(t2[US.fish]).trim());
      const id = Y.reduce((a3, r) => Math.max(a3, Number(idN(r[US.id])) || 0), 0) + 1;
      const qator = [String(id), fish, toliq, lavozim, '', tel, '', '', '', '', 'Ishlayapti', '', '', '', '', '', '', '', huquq.join(', ')];
      const q = await G.qatorQoshR(env.aksBazaId, T07, m + 3, qator, env.googleKey);
      return { id, qator: q };
    });
  } catch (e) {
    if (e instanceof G.RuxsatYoq) throw new S.Xato('Robotda jadvalga yozish huquqi yo\'q — xodim qo\'shilmadi.');
    throw e;
  }
  const yoz = { vaqt: vaqt(), kim: u.fish, xodim: fish, id: String(natija.id), qoshildi: huquq, olindi: [], yangi: true };
  try { await redis.lpush('huquq_jurnal', JSON.stringify(yoz)); await redis.ltrim('huquq_jurnal', 0, 499); } catch (e) { console.error('huquq_jurnal:', e.message); }
  console.log('➕ yangi xodim:', JSON.stringify(yoz));
  await Promise.race([tetik.varaqlarYangila([T07]).catch(e => console.error('ko\'zgu (07):', e.message)), new Promise(r => setTimeout(r, 15000))]);
  return { ok: true, id: String(natija.id), fish, lavozim, tel,
    natija: fish + ' ro\'yxatga qo\'shildi (ID ' + natija.id + '). Endi u @aks_karvon_bot ga kirib «📱 Raqamni yuborish» tugmasini bossin — bot parolini o\'zi beradi.',
    jurnal: await jurnal() };
}

// ------------------------------------------------------------------ ✏️ XODIM MA'LUMOTLARI (direktor so'rovi 26.10.2026)
// Sozlamalar → Huquqlar → xodim → «✏️ Ma'lumotlarini o'zgartirish»: C to'liq kirill F.I.Sh., D lavozim, F telefon.
// F.I.Sh. (B) BU YERDAN O'ZGARMAYDI — u tizimda kalit sifatida ishlatiladi (topshiriqlar, jurnallar, qoidabuzarliklar unga bog'langan).
// Telefon — Telegram ulanishi shu raqam bo'yicha tekshiriladi, shuning uchun uni to'g'rilash jadvalsiz bo'lishi kerak.
async function xodimTahrir([kodSes, d0]) {
  const u = await S.ruxsat(kodSes, 'admin');
  if (!u.admin) throw new S.Xato('Bu bo\'lim faqat direktor uchun.');
  const d = d0 || {}, id = idN(d.id);
  const toliq = s(d.toliq).replace(/\s+/g, ' ').trim();
  const lavozim = s(d.lavozim).replace(/\s+/g, ' ').trim();
  const tel = telRaqam(d.tel);
  if (!id) throw new S.Xato('Xodim tanlanmadi.');
  if (!lavozim) throw new S.Xato('Lavozimini yozing.');
  if (tel.length !== 9) throw new S.Xato('Telefon raqami 9 ta raqamdan iborat bo\'lsin (masalan 90 123 45 67).');
  if (toliq.length > 120) throw new S.Xato('To\'liq F.I.Sh. juda uzun.');

  let natija;
  try {
    natija = await qulfBilan('07', async () => {
      const R = await G.oraliqOqi(env.aksBazaId, T07, 'A2:S', env.googleKey);   // Google'dan YANGI
      const i = R.findIndex(r => idN(r[US.id]) === id);
      if (i < 0) throw new S.Xato('Xodim jadvalda topilmadi (ID ' + id + ').');
      const t2 = R.findIndex((r, j) => j !== i && idN(r[US.id]) !== '' && telRaqam(r[UQ.tel]) === tel);
      if (t2 >= 0) throw new S.Xato('Bu telefon raqami boshqa xodimda: ' + s(R[t2][US.fish]).trim());
      const r = R[i], fish = s(r[US.fish]).trim(), qator = i + 2;
      const eski = { toliq: s(r[UQ.toliq]).trim(), lavozim: s(r[US.lavozim]).trim(), tel: telRaqam(r[UQ.tel]) };
      const yoz = [];
      if (eski.toliq !== toliq) yoz.push({ varaq: T07, qator, ustun: 3, qiymat: toliq });
      if (eski.lavozim !== lavozim) yoz.push({ varaq: T07, qator, ustun: 4, qiymat: lavozim });
      if (eski.tel !== tel) yoz.push({ varaq: T07, qator, ustun: 6, qiymat: tel });
      if (!yoz.length) throw new S.Xato('O\'zgarish yo\'q.');
      await G.xomYoz(env.aksBazaId, yoz, env.googleKey);   // RAW — telefon raqam bo'lib ketmasin
      return { fish, qator, eski, ozgardi: yoz.map(z => z.ustun === 3 ? 'to\'liq F.I.Sh.' : z.ustun === 4 ? 'lavozim' : 'telefon') };
    });
  } catch (e) {
    if (e instanceof G.RuxsatYoq) throw new S.Xato('Robotda jadvalga yozish huquqi yo\'q — hech narsa o\'zgarmadi.');
    throw e;
  }
  const yoz = { vaqt: vaqt(), kim: u.fish, xodim: natija.fish, id, qoshildi: natija.ozgardi, olindi: [], tahrir: true };
  try { await redis.lpush('huquq_jurnal', JSON.stringify(yoz)); await redis.ltrim('huquq_jurnal', 0, 499); } catch (e) { console.error('huquq_jurnal:', e.message); }
  console.log('✏️ xodim tahriri:', JSON.stringify(yoz));
  await Promise.race([tetik.varaqlarYangila([T07]).catch(e => console.error('ko\'zgu (07):', e.message)), new Promise(r => setTimeout(r, 15000))]);
  return { ok: true, fish: natija.fish, natija: natija.fish + ': ' + natija.ozgardi.join(', ') + ' yangilandi.', jurnal: await jurnal() };
}

module.exports = { huqRoyxat, huqSaqla, xodimQosh, xodimTahrir };
module.exports._ichki = { jadval08d, huquqlarRoyxat, xodimlarOqi, BILAMAN, ajrat, idN };
