// AKS TIZIM — 🔑 KIRISH PAROLI (direktor qarori 25.10.2026).
// Avval ikkita maxfiy narsa bor edi: uzun kirish kodi (havoladagi ?k=…) va 6 xonali PIN. Xodim chiqib qayta kirganda
// oyna KIRISH KODINI so'rardi, odam esa PIN ni terardi — «topilmadi» chiqardi. Direktor qarori: BITTA parol bo'lsin,
// uni xodim o'zi tanlasin, PIN butunlay olib tashlansin. Parol — 07_Xodimlar L ustunidagi kirish kodining o'zi.
// kirishOch — parolning o'zi bilan sessiya ochadi (PIN so'ralmaydi). parolOrnat — xodim o'z parolini o'rnatadi.
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
  jurnal(x).catch(e => console.error('kirish jurnali:', e.message));
  return { tok, ism: x.ism, fish: x.fish };
};
A.parolTirik = async ([kodSes]) => ({ ok: !!(await S.foydalanuvchi(kodSes)) });

async function jurnal(x) {
  try { await q(`INSERT INTO kirishlar (kompaniya_id, xodim_id, fish, usul) VALUES (1, $1, $2, $3)`, [x.id, x.fish, 'Parol']); }
  catch (e) { console.error('kirishlar:', e.message); }
  try { const KY = require('./kirish_yoz'); if (await KY.yoqilgan()) await KY.kirishYoz(x.fish, 'Parol'); }
  catch (e) { console.error('07b kirish (parol):', e.message); }
}

// ---------------------------------------------------------------- parolni tekshirish
const ODDIY = ['12345678', '123456789', '1234567890', 'qwertyui', 'password', 'parol123', 'aksTIZIM', 'akstizim'];
function parolXato(p, x) {
  if (!/^[A-Za-z0-9_-]{8,32}$/.test(p)) return 'Parol 8–32 ta belgi bo\'lsin: harf, raqam, «-» va «_». Bo\'sh joy va boshqa belgi bo\'lmaydi.';
  if (!/[A-Za-z]/.test(p) || !/[0-9]/.test(p)) return 'Parolda kamida bitta harf va bitta raqam bo\'lsin (masalan: Angor2026).';
  const n = S.kodNorm(p);
  if (ODDIY.some(z => S.kodNorm(z) === n)) return 'Bu parol juda oson. Boshqasini tanlang.';
  if (/^(.)\1+$/.test(n)) return 'Bir xil belgilardan iborat parol bo\'lmaydi.';
  if (x && x.tel && s(x.tel).length >= 7 && n.indexOf(S.kodNorm(x.tel)) >= 0) return 'Parol telefon raqamingiz bo\'lmasin.';
  return '';
}
// shu parol boshqa xodimda bormi (katta-kichik harf farqisiz — kirish shunday tekshiradi)
async function parolBand(p, ozQator) {
  const r = await q(`SELECT qator_no FROM v_xodimlar WHERE lower(regexp_replace(kirish_kodi, '[^A-Za-z0-9]', '', 'g')) = $1`, [S.kodNorm(p)]);
  return r.rows.some(z => Number(z.qator_no) !== Number(ozQator));
}

// ---------------------------------------------------------------- xodim o'z parolini o'rnatadi
A.parolOrnat = async ([kodSes, yangi, takror]) => {
  const u = await S.ruxsat(kodSes);
  yangi = s(yangi).trim(); takror = s(takror).trim();
  if (yangi !== takror) throw new S.Xato('Ikkala parol bir xil emas.');
  const xato = parolXato(yangi, u); if (xato) throw new S.Xato(xato);
  if (S.kodNorm(yangi) === S.kodNorm(u.kod)) throw new S.Xato('Bu parol hozirgisining o\'zi.');
  if (await parolBand(yangi, u.qator)) throw new S.Xato('Bu parol band — boshqasini tanlang.');

  await TK.xodim07Yoz(u, PAROL_L, yangi);                   // 07_Xodimlar L — qator L ustuni bo'yicha tekshiriladi
  const x = await TK.kodKut(yangi, 30);                      // ko'zgu yangilanishini kutamiz, aks holda yangi parol darhol ishlamaydi
  if (!x) throw new S.Xato('Parol jadvalga yozildi, lekin tizim uni hali ko\'rmayapti. 1 daqiqadan keyin yangi parol bilan kiring.');

  try { await redis.del('ses:' + s(kodSes).slice(s(kodSes).indexOf('|') + 1)); } catch (e) { }   // eski sessiya yopiladi
  const tok = await S.sessiyaOch(x.kod);
  TK.parolXabar(x).catch(() => {});                          // xodimga Telegram'dan ogohlantirish
  return { kod: x.kod, tok };
};

module.exports = A;
module.exports._ichki = { parolXato, parolBand };
