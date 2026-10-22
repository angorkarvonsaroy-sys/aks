// AKS TIZIM — ⏰ VAQT BO'YICHA ISHLAR (eski tizimdagi Apps Script triggerlari o'rni). Ilova serveri ichida har daqiqada tekshiriladi.
// Har ish Redis bayrog'i bilan yoqiladi: vaqt_yondi:<nom> (aks-vaqt yoq <nom> / ochir <nom>). Bayroq o'chiq bo'lsa server hech narsa qilmaydi —
// eski tizimning triggeri ishlayveradi. Yoqilgach eski trigger Apps Script'da qo'lda o'chiriladi (ikkalasi birga ishlamasin).
// Vaqt oynasi (Toshkent): har ish o'z «bo'lak»ida bir marta — masalan har 2 soatda: 00:05, 02:05, … 22:05 (eski everyHours(2) ham kecha-kunduz).
// Server o'sha paytda o'chiq bo'lsa (yangilanish), qayta ishga tushgach o'sha bo'lak hali o'tmagan bo'lsa — darhol bajariladi (kunlik ish — faqat belgilangan
// vaqtdan 90 daqiqa ichida; 22.10: yoqilganda o'sha kuni kechqurun ertalabki xabar ketib qolgan edi). Xato bo'lsa — 1 daqiqadan
// keyin yana (bo'lakda ko'pi bilan 3 urinish). Har bajarilish: Redis vaqt_jurnal (oxirgi 300) + rpc_jurnal (qayerda = 'vaqt') — aks-vaqt / aks-bugun.
// Ishlar:
//   top_avto    — Topshiriq.gs topAvto (har 2 soatda): api/top_avto.js topAvto (yozuv_yondi:top_avto va Koprik ≥ 1.5 bo'lsa serverda; aks holda
//                 eski tizimning o'zi — ko'prik topHozir). Direktor kodi bilan (Telegram / koprikSkanNaz uchun eski tizim sessiyasi).
//   top_ertalab — topErtalab (08:30): har xodimga bugungi ochiq topshiriqlari (Telegram — koprikTgChat); 10 Google'dan yangi.
//   top_kechki  — topKechki (20:10): direktorga kun yakuni — kim nechta bajardi / qoldi / muddati o'tgan (tgYubor_ — koprikTgYubor).
//   und_ertalab — undErtalabYubor (09:00, yakshanbadan tashqari): lib/ertalab.js — undiruvchilarga ertalabki topshiriq, 07c_Ertalab_svod, direktorga svod.
//   mon_eslatma — monEslatmaYubor (09:10, yakshanbadan tashqari): lib/ertalab.js — skansiz yangi shartnomalar eslatmasi.
//   xat_kechikkan   — xatKechikkanTekshir (17:00): lib/kechikkan.js — yetkazilmagan ogohlantirish xatlari (direktorga, mas'ulga).
//   bekor_kechikkan — bekorKechikkanTekshir (17:15): lib/kechikkan.js — bekor qilish skanlari kechikkan (xodimga, ≥2 ish kuni — direktorga).
'use strict';
const { q, redis } = require('./db');

const s = v => String(v == null ? '' : v);
function toshkent(ms) { const d = new Date((ms || Date.now()) + 5 * 3600 * 1000); return { d, iso: d.toISOString().slice(0, 10), soat: d.getUTCHours(), daq: d.getUTCMinutes(),
  dmyHm: String(d.getUTCDate()).padStart(2, '0') + '.' + String(d.getUTCMonth() + 1).padStart(2, '0') + '.' + d.getUTCFullYear() + ' ' + String(d.getUTCHours()).padStart(2, '0') + ':' + String(d.getUTCMinutes()).padStart(2, '0') }; }

// bo'lak kaliti: 'soat2' — har 2 soat (00,02,…22), daqiqa ≥ 5 dan; 'kun:HH:MM' — kuniga bir marta, shu vaqtdan boshlab
function bolak(ish, t) {
  if (ish.har === 'soat2') { if (t.daq < 5) return null; return t.iso + 'T' + String(t.soat - t.soat % 2).padStart(2, '0'); }
  const m = /^kun:(\d{2}):(\d{2})$/.exec(ish.har);
  if (m) {   // kunlik ish: belgilangan vaqtdan boshlab 90 daqiqa ichida (server o'chiq bo'lsa shu oynada yetib oladi); kechroq — bugun o'tkazib yuboriladi
    const d = t.soat * 60 + t.daq - (+m[1] * 60 + +m[2]);
    if (d < 0 || d > 90) return null; return t.iso;
  }
  return null;
}
function keyingi(ish, t) {   // ko'rsatish uchun: keyingi bo'lak boshlanishi
  if (ish.har === 'soat2') { const h = t.soat - t.soat % 2 + (t.daq >= 5 ? 2 : 0); return (h >= 24 ? 'ertaga ' : '') + String(h % 24).padStart(2, '0') + ':05'; }
  const m = /^kun:(\d{2}):(\d{2})$/.exec(ish.har); return m ? ((t.soat > +m[1] || (t.soat === +m[1] && t.daq >= +m[2])) ? 'ertaga ' : '') + m[1] + ':' + m[2] : '?';
}
async function adminKod() {
  const r = await q(`SELECT kirish_kodi FROM v_xodimlar WHERE kompaniya_id = 1 AND holat = 'Ishlayapti' AND 'admin' = ANY(huquqlar) AND length(kirish_kodi) >= 8 ORDER BY qator_no LIMIT 1`);
  if (!r.rows[0]) throw new Error('Direktor (admin) kirish kodi topilmadi (07_Xodimlar L)');
  return r.rows[0].kirish_kodi;
}

// ------------------------------------------------------------------ ishlar
async function topAvtoIsh(kod, opt = {}) {
  const TA = require('../api/top_avto')._ichki, TP = require('../api/topshiriq_yoz')._ichki, koprik = require('../api/koprik'), tetik = require('./kozgu_tetik');
  if (opt.quruq) { const r = await TA.topAvto(kod, { quruq: true }); return { quruq: true, yangi: r.yangi, yopildi: r.yopildi }; }
  let serverda = false;
  try { serverda = (await redis.get('yozuv_yondi:top_avto')) === '1' && (await TP.koprik15(kod)); } catch (e) { serverda = false; }
  if (serverda) {
    let yoq = false;
    const r = await TA.qulfUrin(async () => { try { return await TA.topAvto(kod); } catch (e) { if (e.yozilmadi) { yoq = true; return null; } throw e; } });
    if (r === null && !yoq) throw new Error('band (topshiriq qulfi 20 soniyada bo\'shamadi)');
    if (!yoq) { await Promise.race([tetik.varaqlarYangila([TP.TOP_V, '06d_Hujjatlar']).catch(() => {}), new Promise(z => setTimeout(z, 15000))]); return { qayerda: 'server', yangi: r.yangi, yopildi: r.yopildi, skanNaz: r.skanNaz }; }
  }
  const r = await koprik.chaqir('topHozir', kod, [], { muddat: 150000, urinish: 1 });   // eski tizimning topAvto si (robotda yozish huquqi yo'q yoki bayroq o'chiq)
  if (r && r.ok === false) throw new Error('eski tizim: ' + (r.xato || 'bajarilmadi'));
  return { qayerda: 'eski', yangi: r && r.yangi, yopildi: r && r.yopildi };
}
// Topshiriq.gs topErtalab — matnlar aynan; xodim Telegram'siz bo'lsa yoki topshirig'i bo'lmasa — o'tkazib yuboriladi; yuborish xatosi e'tiborsiz (eski: try/catch)
async function topErtalabIsh(kod, opt = {}) {
  const TP = require('../api/topshiriq_yoz')._ichki, J = require('./jurnallar'), koprik = require('../api/koprik');
  const XD = await TP.topXodimlar();
  const R = (await TP.topRowsYangi(TP.TOP_V)).L.map(J.topKor).filter(x => x.holati === 'Jarayonda');
  let yuborildi = 0, xato = 0, kimlar = []; const matnlar = [];
  for (const x of XD) {
    if (!x.tg) continue; const L = R.filter(t => t.kimga === x.fish); if (!L.length) continue;
    const kech = L.filter(t => t.kechikkan).length;
    const m = '☀️ <b>Bugungi topshiriqlaringiz: ' + L.length + ' ta</b>' + (kech ? ' (🔴 ' + kech + ' tasi muddati o\'tgan)' : '') + '\n' + L.slice(0, 12).map(t => '• ' + (t.kechikkan ? '🔴 ' : '') + t.sarlavha + (t.no ? ' · ' + t.no : '') + ' — ' + t.muddat).join('\n') + '\n\nAKS ilovasi → 📌 Topshiriqlar';
    if (opt.quruq) { matnlar.push({ kimga: x.fish, matn: m }); continue; }
    try { await koprik.chaqir('koprikTgChat', kod, [x.tg, m]); yuborildi++; kimlar.push(x.fish.split(' ')[0] + ' ' + L.length); } catch (e) { xato++; console.error('topErtalab tg:', x.fish, e.message); }
  }
  if (opt.quruq) return { quruq: true, ochiq: R.length, xabarlar: matnlar };
  return { ochiq: R.length, yuborildi, xato, kimlar: kimlar.join(', ') };
}
// Topshiriq.gs topKechki — direktor(lar)ga (tgYubor_); hech kimda bajarilgan/ochiq topshiriq bo'lmasa yuborilmaydi
async function topKechkiIsh(kod, opt = {}) {
  const TP = require('../api/topshiriq_yoz')._ichki, J = require('./jurnallar'), koprik = require('../api/koprik');
  const t = toshkent(), bugun = t.dmyHm.slice(0, 10);
  const R = (await TP.topRowsYangi(TP.TOP_V)).L.map(J.topKor); const X = {};
  R.forEach(x => { if (!x.kimga) return; const o = X[x.kimga] = X[x.kimga] || { b: 0, q: 0, k: 0 };
    if (x.holati === 'Bajarildi' && s(x.yopildi).slice(0, 10) === bugun) o.b++; if (x.holati === 'Jarayonda') { o.q++; if (x.kechikkan) o.k++; } });
  const K = Object.keys(X).filter(k => X[k].b || X[k].q); if (!K.length) return { yuborildi: 0, sabab: 'bo\'sh' };
  K.sort((a, b) => X[b].k - X[a].k || X[b].q - X[a].q);
  const m = '📌 <b>Topshiriqlar — ' + bugun + '</b>\n' + K.map(k => (X[k].k ? '🔴' : X[k].q ? '🟡' : '🟢') + ' ' + k + ': bajardi ' + X[k].b + ' · qoldi ' + X[k].q + (X[k].k ? ' (muddati o\'tgan ' + X[k].k + ')' : '')).join('\n');
  if (opt.quruq) return { quruq: true, xabarlar: [{ kimga: 'direktor', matn: m }] };
  await koprik.chaqir('koprikTgYubor', kod, [m]);
  return { yuborildi: 1, xodimlar: K.length, bajardi: K.reduce((a, k) => a + X[k].b, 0), qoldi: K.reduce((a, k) => a + X[k].q, 0), kechikkan: K.reduce((a, k) => a + X[k].k, 0) };
}
const ER = require('./ertalab');
const KC = require('./kechikkan');
const ISHLAR = [
  { nom: 'top_avto', fn: 'topAvto', tavsif: '🤖 Topshiriq qoidalari (topAvto)', har: 'soat2', eski: 'topAvto — everyHours(2)', ish: topAvtoIsh },
  { nom: 'und_ertalab', fn: 'undErtalabYubor', tavsif: '☀️ Undiruvchilarga ertalabki topshiriq + 07c svod (undErtalabYubor)', har: 'kun:09:00', eski: 'undErtalabYubor — har kuni 09:00', ish: (kod, opt) => ER.undErtalab(kod, opt) },
  { nom: 'xat_kechikkan', fn: 'xatKechikkanTekshir', tavsif: '✉️ Yetkazilmagan xatlar nazorati (xatKechikkanTekshir)', har: 'kun:17:00', eski: 'xatKechikkanTekshir — har kuni 17:00', ish: (kod, opt) => KC.xatKechikkan(kod, opt) },
  { nom: 'bekor_kechikkan', fn: 'bekorKechikkanTekshir', tavsif: '✂️ Bekor qilish skanlari nazorati (bekorKechikkanTekshir)', har: 'kun:17:15', eski: 'bekorKechikkanTekshir — har kuni 17:15', ish: (kod, opt) => KC.bekorKechikkan(kod, opt) },
  { nom: 'mon_eslatma', fn: 'monEslatmaYubor', tavsif: '📎 Skansiz shartnoma eslatmasi (monEslatmaYubor)', har: 'kun:09:10', eski: 'monEslatmaYubor — har kuni 09:10', ish: (kod, opt) => ER.monEslatma(kod, opt) },
  { nom: 'top_ertalab', fn: 'topErtalab', tavsif: '☀️ Xodimlarga bugungi topshiriqlar (topErtalab)', har: 'kun:08:30', eski: 'topErtalab — har kuni 08:30', ish: topErtalabIsh },
  { nom: 'top_kechki', fn: 'topKechki', tavsif: '📌 Direktorga kun yakuni (topKechki)', har: 'kun:20:10', eski: 'topKechki — har kuni 20:10', ish: topKechkiIsh },
];

// ------------------------------------------------------------------ bajarish va jurnal
async function jurnalYoz(ish, t0, ok, natija, xato) {
  const yoz = { vaqt: toshkent().dmyHm, nom: ish.nom, ms: Date.now() - t0, ok, natija: natija || null, xato: xato ? s(xato).slice(0, 300) : null };
  try { await redis.lpush('vaqt_jurnal', JSON.stringify(yoz)); await redis.ltrim('vaqt_jurnal', 0, 299); await redis.set('vaqt:' + ish.nom + ':oxirgi', JSON.stringify(yoz)); } catch (e) { }
  q('INSERT INTO rpc_jurnal (fn, qayerda, ms, ok, xato) VALUES ($1,$2,$3,$4,$5)', [ish.fn || ish.nom, 'vaqt', yoz.ms, ok, yoz.xato]).catch(() => {});
  return yoz;
}
// bitta ishni hozir bajarish (jadval yoki aks-vaqt hozir). Qaytaradi jurnal yozuvi
async function bajar(ish) {
  const t0 = Date.now();
  const qulf = 'vaqt:' + ish.nom + ':qulf';
  if (!(await redis.set(qulf, '1', 'NX', 'PX', 25 * 60000))) return { nom: ish.nom, ok: false, xato: 'hozir bajarilmoqda (qulf)', ms: 0 };
  try {
    const kod = await adminKod();
    const n = await ish.ish(kod);
    const y = await jurnalYoz(ish, t0, true, n, null);
    console.log(new Date().toISOString(), '⏰', ish.nom, 'bajarildi', JSON.stringify(n), (y.ms / 1000).toFixed(1) + ' s');
    return y;
  } catch (e) {
    const y = await jurnalYoz(ish, t0, false, null, e.message);
    console.error(new Date().toISOString(), '⏰', ish.nom, 'XATO:', e.message);
    return y;
  } finally { await redis.del(qulf).catch(() => {}); }
}
let ishlayapti = false;
async function tekshir() {
  if (ishlayapti) return; ishlayapti = true;
  try {
    const t = toshkent();
    for (const ish of ISHLAR) {
      let yoq = false; try { yoq = (await redis.get('vaqt_yondi:' + ish.nom)) === '1'; } catch (e) { }
      if (!yoq) continue;
      const b = bolak(ish, t); if (!b) continue;
      if ((await redis.get('vaqt:' + ish.nom + ':bolak')) === b) continue;   // bu bo'lakda bajarilgan
      const uk = 'vaqt:' + ish.nom + ':urinish:' + b;
      const u = Number(await redis.get(uk)) || 0; if (u >= 3) continue;    // 3 marta xato — bo'lak tashlab ketiladi (keyingisida yana)
      await redis.set(uk, String(u + 1), 'EX', 4 * 3600);
      const y = await bajar(ish);
      if (y.ok) await redis.set('vaqt:' + ish.nom + ':bolak', b, 'EX', 48 * 3600);
    }
  } catch (e) { console.error('vaqt:', e.message); } finally { ishlayapti = false; }
}
function boshla() { const t = setInterval(() => tekshir().catch(() => {}), 60000); t.unref(); setTimeout(() => tekshir().catch(() => {}), 20000).unref(); }

// ------------------------------------------------------------------ holat (aks-vaqt / aks-holat uchun)
async function holat() {
  const t = toshkent(), out = [];
  for (const ish of ISHLAR) {
    let yoq = false, ox = null; try { yoq = (await redis.get('vaqt_yondi:' + ish.nom)) === '1'; ox = JSON.parse((await redis.get('vaqt:' + ish.nom + ':oxirgi')) || 'null'); } catch (e) { }
    out.push({ nom: ish.nom, tavsif: ish.tavsif, har: ish.har, eski: ish.eski, yoq, keyingi: yoq ? keyingi(ish, t) : '', oxirgi: ox });
  }
  return out;
}
// quruq sinov: hech narsa yozmaydi va yubormaydi — nima bo'lishini qaytaradi (aks-vaqt sinov <nom>)
async function sinov(ish) { return ish.ish(await adminKod(), { quruq: true }); }
module.exports = { ISHLAR, boshla, tekshir, bajar, sinov, holat, toshkent, bolak };
