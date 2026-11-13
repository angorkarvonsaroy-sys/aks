// AKS TIZIM — ⛔ TAQIQDAGI DO'KONNI SOTISH — faqat direktor ruxsati bilan (13.11.2026, direktor qarori).
// Avval: taqiqdagi do'kon tanlanganda ekranda «direktor ruxsati kerak» degan yozuv chiqardi, xolos — server tekshirmas, shartnoma saqlanaverardi
// (13.11.2026 holatiga 115 ta taqiqdagi do'kondan 9 tasi sotilgan). Endi:
//   • xodim shartnoma tuzishda taqiqdagi do'konni tanlasa — sababini yozib direktordan ruxsat so'raydi (06i_Direktor_sorovlari, turi taqiq_sotuv);
//   • direktorga Telegram ketadi va so'rov ilovada «Sizdan kutilmoqda» ro'yxatida chiqadi; direktor tasdiqlaydi yoki rad etadi (monSorovJavob);
//   • ruxsat — aynan shu xodimga, shu do'kon va shu mijoz uchun, 7 kun, bitta shartnomaga. Ruxsatsiz saqlash server tomonida rad etiladi;
//   • direktorning o'zi shartnoma tuzsa — ruxsat so'ralmaydi.
// IJARA shartnomasiga taalluqli emas — ijara avvalgidek tuziladi (direktor qarori: «ijara tuzilaversin, sotuv bo'yicha mendan so'ralsin»).
'use strict';
const S = require('./sessiya');
const V = require('../lib/varaq');
const J = require('../lib/jurnallar');
const tetik = require('../lib/kozgu_tetik');
const { xodimTeng } = require('../lib/xodim');

const TUR = 'taqiq_sotuv', TUR_NOMI = 'Taqiqdagi do\'konni sotishga ruxsat', KUN = 7, SOR_V = '06i_Direktor_sorovlari';
const s = v => String(v == null ? '' : v);
const S1 = x => s(x).replace(/\s+/g, ' ').trim();
const esc = v => s(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const kut = (p, ms) => Promise.race([p, new Promise(r => setTimeout(r, ms))]);
const dmy = iso => s(iso).split('-').reverse().join('.');
// «13.11.2026 21:50» yoki «2026-11-13 …» → 2026-11-13
function vaqtIso(t) {
  t = s(t).trim(); const p = n => String(n).padStart(2, '0');
  let m = /^(\d{1,2})\.(\d{1,2})\.(\d{4})/.exec(t); if (m) return m[3] + '-' + p(m[2]) + '-' + p(m[1]);
  m = /^(\d{4})-(\d{2})-(\d{2})/.exec(t); return m ? m[1] + '-' + m[2] + '-' + m[3] : '';
}
function kunQosh(iso, n) { const d = new Date(iso + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
function mal(z) { try { const o = JSON.parse(s(z.malumot)); return o && typeof o === 'object' ? o : {}; } catch (e) { return {}; } }
const taqiqmi = dr => S1(dr[8]) === 'Ha';

// L — 06i qatorlari; shu xodim, shu do'kon va shu mijoz uchun ruxsat holati:
//   bor (gacha) · kutilmoqda (meniki / boshqa xodimniki) · rad (izoh) · eskirgan (gacha) · ishlatilgan · yoq
function tanla(L, fish, dokonId, mid, bugun) {
  const R = L.filter(z => z.tur === TUR && S1(z.kalit) === S1(dokonId));
  const meniki = R.filter(z => xodimTeng(z.kim, fish) && String(mal(z).mid) === String(mid));
  const tasdiq = meniki.filter(z => S1(z.holati) === 'Tasdiqlandi').map(z => ({ z, gacha: kunQosh(vaqtIso(z.javobVaqt) || bugun, KUN) }));
  const bor = tasdiq.filter(o => o.gacha >= bugun).pop();
  if (bor) return { holat: 'bor', gacha: dmy(bor.gacha), so: bor.z };
  const kutm = R.find(z => S1(z.holati) === 'Kutilmoqda');
  if (kutm) return { holat: 'kutilmoqda', meniki: xodimTeng(kutm.kim, fish) && String(mal(kutm).mid) === String(mid), kim: kutm.kim, vaqt: kutm.vaqt, mijoz: s(mal(kutm).fish), so: kutm };
  const ox = meniki[meniki.length - 1];
  if (ox && S1(ox.holati) === 'Rad etildi') return { holat: 'rad', izoh: ox.javob, vaqt: ox.javobVaqt };
  if (ox && S1(ox.holati) === 'Tasdiqlandi') return { holat: 'eskirgan', gacha: dmy(tasdiq[tasdiq.length - 1].gacha) };
  if (ox && S1(ox.holati) === 'Ishlatildi') return { holat: 'ishlatilgan' };
  return { holat: 'yoq' };
}
const XABAR = {
  yoq: d => '⛔ ' + d + ' — taqiqdagi do\'kon. Sotish uchun direktor ruxsati kerak: «2. Do\'kon» qadamida sababini yozib, «Direktordan ruxsat so\'rash» tugmasini bosing.',
  kutilmoqda: d => '⏳ ' + d + ' — taqiqdagi do\'kon. Direktorga ruxsat so\'rovi yuborilgan, javob hali kelmagan. Javob kelgach saqlang.',
  rad: (d, r) => '⛔ ' + d + ' — direktor bu do\'konni sotishga ruxsat bermadi' + (r.izoh ? ': «' + r.izoh + '»' : '') + '.',
  eskirgan: (d, r) => '⛔ ' + d + ' — direktor ruxsatining muddati tugagan (' + r.gacha + ' gacha edi). Qayta so\'rang.',
  ishlatilgan: d => '⛔ ' + d + ' — oldingi ruxsat boshqa shartnomaga ishlatilgan. Qayta so\'rang.',
};

async function dokonQator(id) { const r = (await V.qatorlar('01_Dokonlar')).find(({ x }) => S1(x[0]) === S1(id)); return r ? r.x : null; }
async function mijozFish(mid) { const r = (await V.qatorlar('02_Mijozlar')).find(({ x }) => String(x[0]) === String(mid)); return r ? S1(r.x[2]) : ''; }

// ------------------------------------------------------------------ o'qish: do'kon tanlanganda (xodim oynasi)
async function taqiqRuxsatHolat([kodSes, dokonId, mid]) {
  const u = await S.ruxsat(kodSes, 'shartnoma');
  const dr = await dokonQator(dokonId);
  if (!dr) throw new S.Xato('Do\'kon topilmadi.');
  if (!taqiqmi(dr)) return { kerak: false };
  if (u.admin) return { kerak: false, admin: true };
  if (!Number(mid)) throw new S.Xato('Avval mijozni tanlang.');
  const r = tanla(await J.monSorovlar(), u.fish, dokonId, mid, V.bugun());
  return { kerak: true, holat: r.holat, gacha: r.gacha || '', izoh: r.izoh || '', vaqt: r.vaqt || '', kim: r.kim || '', meniki: !!r.meniki, mijoz: r.mijoz || '', kun: KUN };
}

// ------------------------------------------------------------------ yozuv: xodim → direktor
async function taqiqRuxsatSora([kodSes, dokonId0, mid0, sabab0]) {
  const u = await S.ruxsat(kodSes, 'shartnoma');
  const QY = require('./qadam_yoz')._ichki, SY = require('./shartnoma_yoz')._ichki;
  const dokonId = S1(dokonId0), mid = Number(mid0), sabab = S1(sabab0);
  if (!mid) throw new S.Xato('Avval mijozni tanlang.');
  if (sabab.length < 10) throw new S.Xato('Sababini yozing — nega aynan shu do\'kon sotilishi kerak (kamida 10 belgi).');
  const dr = await SY.dokon(dokonId);   // Google'dan yangi
  if (!dr) throw new S.Xato('Do\'kon topilmadi.');
  if (!taqiqmi(dr)) throw new S.Xato(dokonId + ' taqiqda emas — ruxsat kerak emas.');
  if (u.admin) throw new S.Xato('Direktorga ruxsat kerak emas — shartnomani saqlayvering.');
  if (dr[17] || S1(dr[18]) !== 'SOTILMAGAN') throw new S.Xato('Bu do\'kon allaqachon sotilgan (' + s(dr[17]) + ').');
  const fish = await mijozFish(mid);
  let y;
  try {
    y = await QY.qulf('06i', async () => {
      const R = await QY.sorovlar(SOR_V);
      const h = tanla(R.L, u.fish, dokonId, mid, V.bugun());
      if (h.holat === 'bor') throw new S.Xato('Ruxsat allaqachon berilgan — ' + h.gacha + ' gacha amal qiladi. Shartnomani saqlayvering.');
      if (h.holat === 'kutilmoqda') throw new S.Xato(h.meniki ? 'So\'rov allaqachon yuborilgan — direktor javobini kuting.' : 'Bu do\'kon bo\'yicha boshqa xodim (' + h.kim + ') so\'rov yuborgan — direktor javobini kuting.');
      return QY.sorovYoz(SOR_V, R, u.fish, dokonId, sabab, JSON.stringify({ mid, fish }), TUR);
    });
  } catch (e) { if (e.yozilmadi) throw new S.Xato('So\'rov yozilmadi (Google jadvaliga ulanib bo\'lmadi) — birozdan keyin qayta urinib ko\'ring.'); throw e; }
  QY.tgFon(u.kod, '⛔ <b>Taqiqdagi do\'konni sotishga ruxsat so\'ralmoqda</b>\nXodim: <b>' + esc(u.fish) + '</b>\nDo\'kon: <b>' + esc(dokonId) + '</b> (' + esc(s(dr[5])) + ' m²)\nMijoz: <b>' + esc(fish || ('ID ' + mid)) + '</b>\nSabab: «' + esc(sabab)
    + '»\n\nTasdiqlasangiz — shu xodim shu mijozga ' + KUN + ' kun ichida bitta shartnoma tuza oladi.\nJavob — ilovada: 🔔 qo\'ng\'iroqcha yoki Ishlar → Tasdiqlar.');
  await kut(tetik.varaqlarYangila([SOR_V]).catch(e => console.error('ko\'zgu (taqiq):', e.message)), 15000);
  return { ok: true, id: y.id };
}

// ------------------------------------------------------------------ shartnomaSaqlash ichida: ruxsat bormi (Google'dan YANGI o'qiladi)
// dr — 01_Dokonlar qatori. Taqiqda bo'lmasa yoki direktor bo'lsa — null. Ruxsat bo'lsa — so'rov qatori; bo'lmasa — S.Xato.
async function tekshir(u, d, dr, sorovlar) {
  if (!taqiqmi(dr) || u.admin) return null;
  const L = sorovlar || (await require('./qadam_yoz')._ichki.sorovlar(SOR_V)).L;
  const r = tanla(L, u.fish, d.dokonId, Number(d.mijozId), V.bugun());
  if (r.holat !== 'bor') throw new S.Xato((XABAR[r.holat] || XABAR.yoq)(S1(d.dokonId), r));
  return r.so;
}
// shartnoma saqlangach — ruxsat «Ishlatildi» (G), javobga shartnoma raqami qo'shiladi (H). Yozilmasa ham shartnoma saqlangan — xato tashlanmaydi.
async function ishlatildi(so, no, yoz) {
  if (!so) return false;
  try {
    const G = require('../lib/google'), env = require('../lib/env');
    const q = [['Ishlatildi', S1(s(so.javob) + ' · shartnoma ' + no).replace(/^· /, '')]];
    if (yoz) await yoz(so.qator, q); else await G.yoz(env.aksBazaId, [{ varaq: SOR_V, katak: 'G' + so.qator + ':H' + so.qator, qiymat: q }], env.googleKey);
    tetik.varaqlarYangila([SOR_V]).catch(() => {});
    return true;
  } catch (e) { console.error('taqiq ruxsat «Ishlatildi» yozilmadi (' + no + '):', e.message); return false; }
}
// monSorovJavob uchun: so'rov shu turdami (ko'zgudan)
async function sorovmi(id) { try { return (await J.monSorovlar()).some(z => s(z.id) === s(id) && z.tur === TUR); } catch (e) { return false; } }
const natija = (so, ha) => ha ? so.kalit + ': ' + so.kim + ' ga sotishga ruxsat berildi (mijoz: ' + (s(mal(so).fish) || '—') + ') — ' + KUN + ' kun, bitta shartnomaga.' : so.kalit + ': sotishga ruxsat berilmadi.';

module.exports = { taqiqRuxsatHolat, taqiqRuxsatSora };
module.exports._ichki = { TUR, TUR_NOMI, KUN, tanla, tekshir, ishlatildi, sorovmi, natija, taqiqmi, vaqtIso, mal, XABAR };
