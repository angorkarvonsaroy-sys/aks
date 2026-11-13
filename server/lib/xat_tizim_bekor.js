// AKS TIZIM — ✉ MUDDATI O'TGAN XATNI TIZIM O'ZI BEKOR QILADI (13.11.2026, direktor qarori).
// Avval: tayyorlangan xatning to'lov muddati o'tib, isboti yuklanmagan bo'lsa — undiruvchi uni O'ZI bekor qilishi kerak edi («yetkazmang: sababini
// yozib bekor qiling»). Bilmasa yoki qilmasa — o'sha mijozga yangi xat chiqmasdi («oldingi xat hali yuborilmagan») va mijozga xat umuman bormasdi
// (13.11.2026 holatiga 26 ta xat shu ahvolda turgan). Endi:
//   1) har 30 daqiqada: «Tayyorlandi» holatidagi, xatdagi to'lov muddati o'tgan xat — tizim tomonidan «Bekor» qilinadi (izohda TIZIM BEKOR QILDI);
//   2) undiruvchining xatosi yoziladi: ijro intizomida «xatbekor» qoidabuzarligi (xodimga Telegram ham ketadi) — faqat 13.11.2026 va undan keyin
//      muddati tugaydigan xatlar uchun (eski 26 ta xatga yangi qoidabuzarlik yozilmaydi);
//   3) tizim o'sha bosqichdagi xatni yangidan chiqarishni vazifa qiladi (lib/portfel.js xatKeyingi → qayta): «Xat OG-… muddatida mijozga
//      topshirilmadi — tizim bekor qildi. Yangisini chiqaring» — sababini yozib, aloqa shartisiz darhol chiqaradi (api/xat_chiqar.js);
//   4) xat aslida vaqtida yetkazilgan, lekin isboti yuklanmagan bo'lsa — «yetkazganman, isbotini yuklayman»: skan + kechikish sababi, yurist
//      tekshiradi (api/xat_isbot.js yuborildi → kech). Rad etilsa — xat yana «Tayyorlandi», keyingi yurishda tizim qayta bekor qiladi.
// opt.quruq — yozmaydi: nima bo'lishini qaytaradi (aks-vaqt sinov xat_eskirgan).
'use strict';
const V = require('./varaq');
const G = require('./google');
const env = require('./env');
const X = require('./xat_yordam');
const tetik = require('./kozgu_tetik');
const XAT_V = '06e_Xatlar', BELGI = 'TIZIM BEKOR QILDI', QOIDA_BOSH = '2026-11-13';
const s = v => String(v == null ? '' : v);
const esc = v => s(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const eskirgan = (h, bugunIso) => h.holati === 'Tayyorlandi' && !!h.muddat && /^\d{4}-\d{2}-\d{2}$/.test(X.xatIso(h.muddat)) && X.xatIso(h.muddat) < bugunIso;
const tizimBekor = h => !!h && h.holati === 'Bekor' && s(h.izoh).indexOf(BELGI) >= 0;
function hozir() { const d = new Date(Date.now() + 5 * 3600 * 1000), p = n => String(n).padStart(2, '0'); return p(d.getUTCDate()) + '.' + p(d.getUTCMonth() + 1) + '.' + d.getUTCFullYear() + ' ' + p(d.getUTCHours()) + ':' + p(d.getUTCMinutes()); }
// shu shartnoma va seriyada tizim bekor qilgan OXIRGI xat — undan keyin yangi xat chiqarilmagan bo'lsa (XJ — jadval tartibida)
function qaytaXat(XJ, no, seriya) {
  const M = XJ.filter(h => h.no === no && X.xatSeriya(h.shablon) === seriya); if (!M.length) return null;
  const ox = M[M.length - 1];
  return tizimBekor(ox) ? { raqam: ox.raqam, sana: ox.sana, muddat: ox.muddat, bosqich: ox.bosqich, kim: ox.kim, qator: ox.qator } : null;
}
// dep — sinov uchun: { xatlar, yoz, ijro, direktor, qulf, bugun }
async function bekorQil(kod, opt = {}, dep = {}) {
  const bugun = dep.bugun || V.bugun();
  const qulf = dep.qulf || require('../api/qadam_yoz')._ichki.qulf;
  const natija = await qulf('xat', async () => {
    const XJ = dep.xatlar ? await dep.xatlar() : await require('../api/xat_isbot')._ichki.xatlarYangi(XAT_V);
    const L = XJ.filter(h => eskirgan(h, bugun));
    const out = [];
    for (const h of L) {
      const yangi = X.xatIso(h.muddat) >= QOIDA_BOSH;   // eski xatlarga qoidabuzarlik yozilmaydi
      const izoh = (h.izoh ? h.izoh + ' | ' : '') + BELGI + ': to\'lov muddati ' + h.muddat + ' da o\'tdi, yetkazilgani isboti yuklanmadi (' + hozir() + ')';
      const o = { raqam: h.raqam, no: h.no, sana: h.sana, muddat: h.muddat, kim: h.kim, qoidabuzarlik: yangi };
      out.push(o);
      if (opt.quruq) continue;
      if (dep.yoz) await dep.yoz(h, izoh); else await G.yoz(env.aksBazaId, [{ varaq: XAT_V, katak: 'N' + h.qator, qiymat: [['Bekor']] }, { varaq: XAT_V, katak: 'V' + h.qator, qiymat: [[izoh]] }], env.googleKey);
      if (yangi && h.kim) {
        const q = { xodim: h.kim, tur: 'xatbekor', kalit: 'xatbekor|' + h.raqam, no: h.no, fish: s(h.fish || ''),
          tafsilot: h.raqam + ' (' + h.sana + ') — to\'lov muddati ' + h.muddat + ' gacha mijozga yetkazilmadi (isbot yuklanmadi), tizim bekor qildi. Yangisini chiqaring; vaqtida yetkazgan bo\'lsangiz — isbotini sababi bilan yuklang.' };
        try { if (dep.ijro) await dep.ijro(q); else await require('../api/ijro_yoz')._ichki.ijroDarhol(kod, q); } catch (e) { console.error('xat_tizim_bekor ijro:', e.message); }
      }
    }
    return out;
  });
  if (!natija.length) return { soni: 0 };
  if (opt.quruq) return { quruq: true, soni: natija.length, xatlar: natija };
  tetik.varaqlarYangila([XAT_V]).catch(() => {});
  const M = ['✉ <b>Tizim ' + natija.length + ' ta muddati o\'tgan xatni bekor qildi</b> — isboti yuklanmagan:', ''].concat(natija.slice(0, 20).map(o => '• <b>' + esc(o.raqam) + '</b> · ' + esc(o.no) + ' · chiqarilgan ' + esc(o.sana) + ', muddat ' + esc(o.muddat) + ' · ' + esc(o.kim || '—') + (o.qoidabuzarlik ? ' · ⚠ qoidabuzarlik yozildi' : '')))
    .concat(natija.length > 20 ? ['… va yana ' + (natija.length - 20) + ' ta'] : []).concat(['', 'Undiruvchiga yangi xat chiqarish vazifasi berildi. Vaqtida yetkazgan bo\'lsa — isbotini sababi bilan yuklaydi, yurist tekshiradi.']);
  try { if (dep.direktor) await dep.direktor(M.join('\n')); else await require('./telegram').direktor(M.join('\n')); } catch (e) { console.error('xat_tizim_bekor tg:', e.message); }
  return { soni: natija.length, xatlar: natija.map(o => o.raqam), qoidabuzarlik: natija.filter(o => o.qoidabuzarlik).length };
}
module.exports = { bekorQil, qaytaXat, tizimBekor, eskirgan, BELGI, QOIDA_BOSH };
