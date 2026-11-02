// AKS TIZIM — eski tizim ko'prigi (Koprik.gs) versiyasini RAQAM bo'yicha solishtirish: '1.10' > '1.9' (matn bo'yicha solishtirsa '1.10' < '1.5' chiqadi).
'use strict';
const son = v => String(v == null ? '' : v).split('.').map(n => Number(n) || 0);
function verOk(v, min) {
  if (!/^\d+(\.\d+)*$/.test(String(v == null ? '' : v).trim())) return false;
  const a = son(v), b = son(min);
  for (let i = 0; i < Math.max(a.length, b.length); i++) { if ((a[i] || 0) !== (b[i] || 0)) return (a[i] || 0) > (b[i] || 0); }
  return true;
}
// 02.11.2026: Koprik versiyasi tekshiruvlari (koprik15, koprik16, … — 15 joy) amalga kerakli koprik* yordamchilari uchun edi. Endi ularni server o'zi bajaradi:
// Drive — lib/arxiv.js (ISH), Telegram — lib/telegram.js (KOPRIK_ORNI). Ro'yxatdagi HAMMA yordamchi serverda bo'lsa — eski tizim (va uning versiyasi) kerak emas:
// eski tizim javob bermasa ham amal serverda bajariladi (avval versiya olinmasa amal butunligicha eski tizimga ketardi — u ham ishlamasdi).
// Bittasi serverda bo'lmasa (bayroq o'chiq, ulanish fayli / TG_TOKEN yo'q) — false: avvalgidek versiya tekshiriladi.
async function serverOzi(fnlar) {
  const ARX = require('./arxiv'), TG = require('./telegram');
  try {
    for (const fn of fnlar) {
      if (ARX.ISH[fn]) { if (!(await ARX.yoniq())) return false; continue; }
      if (TG.KOPRIK_ORNI[fn]) { if (!(await TG.serverda(fn))) return false; continue; }
      return false;   // server bajarmaydigan yordamchi
    }
    return true;
  } catch (e) { return false; }
}
// bo'limlar va ularga kerakli yordamchilar — aks-koprik va «Tizim holati» sahifasi uchun (api/* dagi tekshiruvlar bilan bir xil ro'yxat)
const BOLIMLAR = [['Topshiriqlar', ['koprikTgChat']], ["Ta'minot (kiritish, tasdiq, to'lov, dalolatnoma)", ['koprikTgYubor', 'koprikTamIsbot']],
  ['Devonxona', ['koprikDevonSaqla', 'koprikDevonTg', 'koprikTgChat', 'koprikTgYubor']], ['Qayta tuzish', ['koprikHujjatBekorFayl', 'koprikDriveSaqla', 'koprikTgYubor', 'koprikTgChat', 'koprikQtPapkaSavat']],
  ['Ogohlantirish xatlari', ['koprikXatSaqla']], ['Qadam hujjatlari (skan)', ['koprikTopTasdiqTg', 'koprikDriveSaqla']], ['Mijoz hujjatlari (yuklash, tuzatish)', ['koprikHujjatBekorFayl', 'koprikDriveSaqla']],
  ['Isbotni tiklash (direktor qarori)', ['koprikFaylTikla']], ['Yurist aloqa xati', ['koprikXatSaqla', 'koprikDriveSaqla']], ['Shartnomani bekor qilish', ['koprikBekorSaqla', 'koprikDriveSaqla']],
  ['Ijara kelishuvi', ['koprikKbSaqla', 'koprikDriveSaqla', 'koprikTgYubor', 'koprikTgChat']], ['Yurist ishi (skan, rad, tasdiq)', ['koprikTg', 'koprikDriveSaqla']]];
module.exports = { verOk, serverOzi, BOLIMLAR };
