// AKS TIZIM — 🔎 isbotni tasdiqlash / qaytarish (tasdiqQil, topTasdiq) — TEZ JAVOB + FONDA ESKI TIZIM.
// Qarorning o'zi (jadvallar, 06t jurnali, Telegram xabarlarini tahrirlash, hujjatni bekor qilish, xatni qaytarish, ijro) — avvalgidek ESKI TIZIM
// (Topshiriq.gs / Xat.gs) bajaradi, ya'ni natija aynan bir xil. Farqi: server avval eski kodning o'zidagi tekshiruvlarni (huquq, holat, sabab)
// ko'zgudan tekshiradi va xato bo'lsa — o'sha matn bilan darhol qaytaradi; xato bo'lmasa qaror NAVBATGA qo'yiladi va foydalanuvchiga
// eski tizim qaytaradigan javob darhol beriladi (20 s kutish yo'q). Navbatni server fonda bittadan bajaradi (Redis tasdiq_navbat).
// Navbatdagi isbot ro'yxatlarda ko'rinmaydi (topshiriq — kutilgan holatda), bajarilgach ko'zgu yangilanadi.
// Eski tizim xato qaytarsa (masalan shu orada Telegram tugmasi bilan tasdiqlangan) — isbot ro'yxatga qaytadi, direktorga Telegram, yozuv_ogoh.
// Yoqilishi: Redis yozuv_yondi:tasdiq = 1 (aks-yozuv-sinov tasdiq). Yo'q bo'lsa — avvalgidek eski tizim kutiladi.
'use strict';
const S = require('./sessiya');
const J = require('../lib/jurnallar');
const V = require('../lib/varaq');
const koprik = require('./koprik');
const tetik = require('../lib/kozgu_tetik');
const { redis } = require('../lib/db');
const { xodimTeng } = require('../lib/xodim');

const NAVBAT = 'tasdiq_navbat', KUT = 'tasdiq_kutish';
const s = v => String(v == null ? '' : v);
const tasdiqchi = t => /^(hj|skanq|skanu|skanz|yutop)\|/.test(s(t.kalit)) ? 'yurist' : 'direktor';
const rol = u => (u.huquq || []).indexOf('admin') >= 0 ? 'Direktor' : (u.huquq || []).indexOf('yurist') >= 0 ? 'Yurist' : s(u.fish);
function hozirDmyHm() { const d = new Date(Date.now() + 5 * 3600 * 1000), p = n => String(n).padStart(2, '0');
  return p(d.getUTCDate()) + '.' + p(d.getUTCMonth() + 1) + '.' + d.getUTCFullYear() + ' ' + p(d.getUTCHours()) + ':' + p(d.getUTCMinutes()); }
async function ogoh(xab) { try { await redis.lpush('yozuv_ogoh', JSON.stringify(Object.assign({ vaqt: hozirDmyHm() }, xab))); await redis.ltrim('yozuv_ogoh', 0, 49); } catch (e) { } }
async function yoqilgan() { try { return (await redis.get('yozuv_yondi:tasdiq')) === '1'; } catch (e) { return false; } }
async function kutilmoqda() { try { return (await redis.hgetall(KUT)) || {}; } catch (e) { return {}; } }

// topKimga_ (skan qaytarilganda kimga topshiriq ketishini javobda aytish uchun)
async function topKimga(raw) {
  const XD = (await V.qatorlar('07_Xodimlar')).map(({ x }) => x).filter(r => r[1] && s(r[10]).trim() === 'Ishlayapti' && s(r[18]).trim())
    .map(r => ({ fish: s(r[1]).trim(), admin: /(^|,)\s*admin\s*(,|$)/.test(s(r[18])) }));
  raw = s(raw).trim(); const dir = (XD.find(x => x.admin) || {}).fish || '';
  if (!raw || raw === '—') return dir;
  const x = XD.find(z => xodimTeng(raw, z.fish)); return x ? x.fish : dir;
}

// Eski kod (tasdiqBajar0_ → topTasdiq_ / xatIsbotTasdiq_ / skanNazQaror_) yozishdan OLDIN tashlaydigan xatolar va muvaffaqiyatli javobi
async function oldindan(u, k, ha, izoh0) {
  const adm = (u.huquq || []).indexOf('admin') >= 0, yu = (u.huquq || []).indexOf('yurist') >= 0;
  const izoh = s(izoh0).replace(/\s+/g, ' ').trim();
  const t0 = k.charAt(0), id = k.slice(1);
  if (t0 === 't') {
    const x = (await J.topRows()).find(t => String(t.id) === String(id)); if (!x) throw new S.Xato('Topshiriq topilmadi.');
    const kim = tasdiqchi(x);
    if (!adm && !(kim === 'yurist' && yu)) throw new S.Xato('Bu isbotni ' + (kim === 'yurist' ? 'yurist' : 'direktor') + ' tekshiradi.');
    if (x.holati !== 'Tekshiruvda') throw new S.Xato('Topshiriq tekshiruvda emas (holati: ' + x.holati + ').');
    if (/^qayta\|/.test(x.kalit)) throw new S.Xato('Qayta tuzish topshirig\'i «🔁 Ochish» oynasida tasdiqlanadi yoki qaytariladi.');
    if (/^devon\|/.test(x.kalit)) throw new S.Xato('Kirim xat ijrosi 👔 Direktor → Tasdiqlar dagi xat kartochkasida qabul qilinadi yoki qaytariladi.');
    const tal = /^talab\|/.test(x.kalit);
    if (ha) return { ok: true, natija: tal ? 'Tasdiqlandi — endi ⚖ Sud kartasida «Yuristga o\'tkazish» tugmasi ochiq.' : 'Tasdiqlandi.' };
    if (izoh.length < 3) throw new S.Xato('Qaytarish sababini yozing.');
    return { ok: true, natija: 'Xodimga qaytarildi (Telegram xabar ketdi).' };
  }
  if (t0 === 'x') {
    if (!adm && !yu) throw new S.Xato('Xat isbotini yurist tekshiradi.');
    const h = (await J.xatJurnal()).find(z => z.raqam === String(id)); if (!h) throw new S.Xato('Xat topilmadi: ' + id);
    const it = await require('./topshiriq')._ichki.tasdiqItem(k);
    if (!it) throw new S.Xato('Bu xat isboti tekshiruvda emas (holati: ' + h.holati + ').');
    if (ha) return { ok: true, natija: 'Tasdiqlandi.' };
    if (izoh.length < 3) throw new S.Xato('Qaytarish sababini yozing.');
    return { ok: true, natija: 'Qaytarildi — xat qayta «yetkazilmagan», xodimga xabar ketdi.' };
  }
  if (t0 === 'n') {
    if (!adm && !yu) throw new S.Xato('Skanni yurist yoki direktor ko\'radi.');
    const it = await require('./topshiriq')._ichki.tasdiqItem(k);
    if (!it) throw new S.Xato('Bu skan allaqachon ko\'rib chiqilgan yoki bekor qilingan.');
    if (ha) return { ok: true, natija: 'Belgilandi: to\'g\'ri.' };
    if (izoh.length < 3) throw new S.Xato('Qaytarish sababini yozing.');
    return { ok: true, natija: 'Qaytarildi — skan bekor, ' + (await topKimga(it.kim)) + ' ga qayta yuklash topshirig\'i berildi (1 ish kuni).' };
  }
  throw new S.Xato('Noma\'lum isbot: ' + k);
}

// ------------------------------------------------------------------ navbat
let ishlayapti = false;
const BAJARILGAN = /tekshiruvda emas|allaqachon ko'rib chiqilgan|allaqachon tekshirilgan|Topshiriq topilmadi|Xat topilmadi/;
async function bajar(j) {
  let xato = '';
  try { await koprik.chaqir(j.fn, j.kod, j.args); }
  catch (e) { xato = (e && e.message) || String(e); }
  try { await redis.hdel(KUT, j.k); } catch (e) { }
  require('./kesh').yozuvdanKeyin(j.kod).catch(() => {});
  await tetik.yangilaKut(20000).catch(() => {});
  if (!xato) return;
  console.error(new Date().toISOString(), 'tasdiq navbati:', j.k, xato);
  await ogoh({ varaq: 'tasdiq', qator: j.k, xato: (j.ha ? 'tasdiq' : 'qaytarish') + ' bajarilmadi (' + j.fish + '): ' + xato });
  if (j.urinish && BAJARILGAN.test(xato)) return;   // server qayta yongandan keyingi takror — birinchisi allaqachon bajargan
  const m = '⚠ <b>Isbot ' + (j.ha ? 'tasdiqlanmadi' : 'qaytarilmadi') + '</b> (' + j.k + ', ' + j.fish + ')\nEski tizim javobi: «' + xato.replace(/</g, '&lt;').slice(0, 300) + '»\nIsbot ro\'yxatga qaytdi — 👔 Tasdiqlar da qayta ko\'ring.';
  koprik.chaqir('koprikTgYubor', j.kod, [m]).catch(() => {});
}
async function ishchi() {
  if (ishlayapti) return; ishlayapti = true;
  try {
    for (;;) {
      const t = await redis.lindex(NAVBAT, 0); if (!t) break;
      let j; try { j = JSON.parse(t); } catch (e) { await redis.lpop(NAVBAT); continue; }
      if (j.boshlandi) j.urinish = (j.urinish || 0) + 1;   // oldingi jarayon bajarayotganda to'xtagan
      j.boshlandi = Date.now();
      await redis.lset(NAVBAT, 0, JSON.stringify(j)).catch(() => {});
      await bajar(j);
      await redis.lpop(NAVBAT);
    }
  } catch (e) { console.error('tasdiq navbati (ishchi):', e.message); }
  finally { ishlayapti = false; }
}
if (process.env.pm_id !== undefined) setTimeout(() => ishchi().catch(() => {}), 5000);   // ilova serveri (pm2) qayta yonganda — qolgan navbat

async function navbatga(u, k, ha, izoh, fn, args) {
  const r = await oldindan(u, k, ha, izoh);
  const ok = await redis.hsetnx(KUT, k, JSON.stringify({ ha: !!ha, fish: u.fish, vaqt: hozirDmyHm() }));
  if (!ok) throw new S.Xato('Bu isbot hozir ko\'rib chiqilmoqda — bir oz kuting.');
  try { await redis.rpush(NAVBAT, JSON.stringify({ k, ha: !!ha, fn, args, kod: u.kod, fish: u.fish, rol: rol(u), qoyildi: Date.now() })); }
  catch (e) { await redis.hdel(KUT, k).catch(() => {}); throw e; }
  ishchi().catch(() => {});
  return r;
}

// ------------------------------------------------------------------ amallar
async function tasdiqQil(args) {
  const [kodSes, k0, ha, izoh] = args;
  const u = await S.ruxsat(kodSes);
  const k = s(k0);
  if (!(await yoqilgan())) return koprik.chaqir('tasdiqQil', u.kod, [k0, ha, izoh]).then(async r => { await tetik.yangilaKut(20000); return r; });
  if ((await kutilmoqda())[k]) throw new S.Xato('Bu isbot hozir ko\'rib chiqilmoqda — bir oz kuting.');
  return navbatga(u, k, ha, izoh, 'tasdiqQil', [k0, ha, izoh]);
}
async function topTasdiq(args) {
  const [kodSes, id, ha, izoh] = args;
  const u = await S.ruxsat(kodSes);
  if (!(await yoqilgan())) return koprik.chaqir('topTasdiq', u.kod, [id, ha, izoh]).then(async r => { await tetik.yangilaKut(20000); return r; });
  const k = 't' + s(id);
  if ((await kutilmoqda())[k]) throw new S.Xato('Bu isbot hozir ko\'rib chiqilmoqda — bir oz kuting.');
  return navbatga(u, k, ha, izoh, 'topTasdiq', [id, ha, izoh]);
}

module.exports = { tasdiqQil, topTasdiq };
module.exports._ichki = { oldindan, kutilmoqda, ishchi, NAVBAT, KUT };
