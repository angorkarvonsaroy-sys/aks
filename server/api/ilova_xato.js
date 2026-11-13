// AKS TIZIM — ⚠️ ILOVA (EKRAN) XATOSI: brauzerdagi kodda chiqqan dastur xatosini direktorga yetkazadi (14.11.2026).
// Chaqiruvchi — api/ui.js dagi ko'prik (google.script.run o'rni): javobni ekranga chizayotgan kod xato bersa yoki sahifada kutilmagan xato chiqsa.
// Hech narsa yozmaydi (baza, Google), hech qachon xato tashlamaydi. Cheklovlar va matn — lib/xato_ogoh.js yuborIlova.
'use strict';
const XO = require('../lib/xato_ogoh');
async function ilovaXato([kodSes, d]) {
  const natija = await XO.yuborIlova(d, kodSes);
  return { ok: true, natija };
}
module.exports = { ilovaXato };
