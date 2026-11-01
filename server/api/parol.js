// AKS TIZIM — 🔑 KIRISH PAROLI (direktor qarori 25.10.2026).
// Avval ikkita maxfiy narsa bor edi: uzun kirish kodi (havoladagi ?k=…) va 6 xonali PIN. Xodim chiqib qayta kirganda
// oyna KIRISH KODINI so'rardi, odam esa PIN ni terardi — «topilmadi» chiqardi. Direktor qarori: BITTA parol bo'lsin,
// uni xodim o'zi tanlasin, PIN butunlay olib tashlansin. Parol — 07_Xodimlar L ustunidagi kirish kodining o'zi.
// kirishOch — parolning o'zi bilan sessiya ochadi (PIN so'ralmaydi). parolOrnat — xodim o'z parolini o'rnatadi.
// 01.11.2026: kirish TELEFON + PAROL (api/kirish.js). L endi parol emas — tizim beradigan kirish kaliti (havoladagi ?k=…);
// kirishOch shu kalit bilan sessiya ochadi, parolOrnat parol izini server bazasiga yozib, kalitni yangilaydi.
'use strict';
const S = require('./sessiya');
const { q, redis } = require('../lib/db');
const TK = require('../lib/tg_kirish');

const s = v => String(v == null ? '' : v);
const PAROL_L = 12;   // 07_Xodimlar L ustuni (1 dan)
const A = {};

// ---------------------------------------------------------------- kirish: parolning o'zi yetarli
A.kirishOch = async ([kod]) => {
  const x = await S.xodimKod(kod);
  if (!x) throw new S.Xato('Parol noto\'g\'ri. Qaytadan kiriting yoki «Parolimni unutdim» ni bosing.');
  const b = await S.blokDaq(x.kod);
  if (b) throw new S.Xato('Kirish ' + b + ' daqiqaga bloklangan. Keyinroq urinib ko\'ring.');
  await S.xatoToza(x.kod);
  const tok = await S.sessiyaOch(x.kod);
  // botdan olingan VAQTINCHALIK parol bo'lsa — ilova ochilmaydi, avval xodim o'z doimiy parolini qo'yadi (direktor qarori 26.10.2026)
  let vaqtinchalik = false;
  try { vaqtinchalik = (await redis.get('parol_vaqt:' + x.kod)) === '1'; } catch (e) { }
  if (!vaqtinchalik) jurnal(x).catch(e => console.error('kirish jurnali:', e.message));
  return { tok, ism: x.ism, fish: x.fish, vaqtinchalik };
};
A.parolTirik = async ([kodSes]) => ({ ok: !!(await S.foydalanuvchi(kodSes)) });

async function jurnal(x) {
  try { await q(`INSERT INTO kirishlar (kompaniya_id, xodim_id, fish, usul) VALUES (1, $1, $2, $3)`, [x.id, x.fish, 'Parol']); }
  catch (e) { console.error('kirishlar:', e.message); }
  try { const KY = require('./kirish_yoz'); if (await KY.yoqilgan()) await KY.kirishYoz(x.fish, 'Parol'); }
  catch (e) { console.error('07b kirish (parol):', e.message); }
}

// ---------------------------------------------------------------- parol (01.11.2026: SHARTSIZ)
// Direktor qarori 01.11.2026: parolga hech qanday shart yo'q — «1» ham bo'ladi. Odamni endi telefon raqami taniydi (api/kirish.js),
// shuning uchun ikki xodimda bir xil parol bo'lishi ham mumkin («band» tekshiruvi olib tashlandi — u boshqaning parolini fosh qilardi).
function parolXato(p) {
  const n = K().parolNorm(p);
  if (!n) return 'Parolni yozing.';
  if (n.length > 100) return 'Parol juda uzun (100 belgidan oshmasin).';
  return '';
}
async function parolBand() { return false; }   // eski chaqiruvlar uchun — endi tekshirilmaydi
const K = () => require('./kirish');

// ---------------------------------------------------------------- xodim o'z parolini o'rnatadi
// Parolning izi server bazasiga (xodim_kirish) yoziladi. Kirish kaliti (L) har safar YANGILANADI — boshqa telefon/kompyuterlarda
// saqlangan eski kirish o'sha zahoti ishlamay qoladi (xodim o'sha joyda yangi parol bilan qayta kiradi). Shu qurilmada ish davom etadi.
A.parolOrnat = async ([kodSes, yangi, takror]) => {
  const u = await S.ruxsat(kodSes);
  if (K().parolNorm(yangi) !== K().parolNorm(takror)) throw new S.Xato('Ikkala parol bir xil emas.');
  const xato = parolXato(yangi); if (xato) throw new S.Xato(xato);
  if (!u.tel) throw new S.Xato('Tizimda telefon raqamingiz yo\'q — direktorga ayting (endi telefon raqami va parol bilan kiriladi).');

  await K().izSaqla(u.id, K().parolNorm(yangi));
  const kod = await K().kalitYangila({ kod: u.kod, qator: u.qator });

  try { await redis.del('ses:' + s(kodSes).slice(s(kodSes).indexOf('|') + 1)); } catch (e) { }   // eski sessiya yopiladi
  try { await redis.del('parol_vaqt:' + u.kod, 'parol_vaqt:' + kod, 'parol_tmp:' + u.id); } catch (e) { }   // endi doimiy parol
  const tok = await S.sessiyaOch(kod);
  const x = (await S.xodimKod(kod)) || u;
  jurnal(x).catch(() => {});
  TK.parolXabar(x).catch(() => {});                          // xodimga Telegram'dan ogohlantirish
  (async () => { const r = await K().qatorOl(u.id); if (r && r.gmail && require('../lib/pochta').bor())
    await require('../lib/pochta').yubor(r.gmail, 'AKS TIZIM — parolingiz o\'zgartirildi', u.ism + ', AKS TIZIMdagi kirish parolingiz o\'zgartirildi.\nAgar buni siz qilmagan bo\'lsangiz — darhol direktorga ayting.'); })()
    .catch(e => console.error('parol pochta:', e.message));
  return { kod, tok };
};

module.exports = A;
module.exports._ichki = { parolXato, parolBand };
