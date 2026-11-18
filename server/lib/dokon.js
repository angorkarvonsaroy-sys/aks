// AKS TIZIM — do'konning xarita holati. 01_Dokonlar Z ustuni («Xarita_holati» formulasi) o'rniga serverda hisoblanadi.
// 19.11.2026, direktor qarori: «Bron» endi 01d_Bronlar dagi HAQIQIY bron (muddati o'tmagan, faol).
// Avval Z formulasi Sotuv_holati = «Shartnoma olmagan» shartnomalarni «Bron» deb ko'rsatardi — u bron emas,
// hujjat masalasi (shartnoma tuzilgan, mijoz nusxasini olmagan); endi ular «Sotilgan» bo'lib ko'rinadi.
// Boshqa hamma holat Z formulasi bilan aynan bir xil: Ma'muriyat / Sotilgan(+ijara) / Bo'sh(+ijara).
// Bron faqat bo'sh do'konga tushadi (sotilmagan, ijarasiz, ma'muriy emas) — api/sotuv.js sotuvBron shunday tekshiradi.
'use strict';
const s = v => v == null ? '' : String(v);

// x — 01_Dokonlar qatorining xom qiymatlari; bronBor — shu do'konda faol bron bormi
function xHolat(x, bronBor) {
  if (!s(x[0]).trim()) return "Bo'sh";                         // A  bo'sh qator (eski kod: bo'sh Z → «Bo'sh»)
  if (s(x[29]).trim()) return "Ma'muriyat";                    // AD Mamuriy_xona
  const ijara = s(x[21]).trim() !== '';                        // V  Ijara_shartnoma_№
  if (s(x[18]).trim() !== 'SOTILMAGAN') return ijara ? 'Sotilgan+ijara' : 'Sotilgan';   // S Egasi
  if (ijara) return "Bo'sh+ijara";
  return bronBor ? 'Bron' : "Bo'sh";
}

module.exports = { xHolat };
