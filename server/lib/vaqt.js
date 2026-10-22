// AKS TIZIM — ⏰ VAQT BO'YICHA ISHLAR (eski tizimdagi Apps Script triggerlari o'rni). Ilova serveri ichida har daqiqada tekshiriladi.
// Har ish Redis bayrog'i bilan yoqiladi: vaqt_yondi:<nom> (aks-vaqt yoq <nom> / ochir <nom>). Bayroq o'chiq bo'lsa server hech narsa qilmaydi —
// eski tizimning triggeri ishlayveradi. Yoqilgach eski trigger Apps Script'da qo'lda o'chiriladi (ikkalasi birga ishlamasin).
// Vaqt oynasi (Toshkent): har ish o'z «bo'lak»ida bir marta — masalan har 2 soatda: 00:05, 02:05, … 22:05 (eski everyHours(2) ham kecha-kunduz).
// Server o'sha paytda o'chiq bo'lsa (yangilanish), qayta ishga tushgach o'sha bo'lak hali o'tmagan bo'lsa — darhol bajariladi. Xato bo'lsa — 1 daqiqadan
// keyin yana (bo'lakda ko'pi bilan 3 urinish). Har bajarilish: Redis vaqt_jurnal (oxirgi 300) + rpc_jurnal (qayerda = 'vaqt') — aks-vaqt / aks-bugun.
// Ishlar:
//   top_avto — Topshiriq.gs topAvto (har 2 soatda): api/top_avto.js topAvto (yozuv_yondi:top_avto va Koprik ≥ 1.5 bo'lsa serverda; aks holda
//              eski tizimning o'zi — ko'prik topHozir). Direktor kodi bilan (Telegram / koprikSkanNaz uchun eski tizim sessiyasi).
'use strict';
const { q, redis } = require('./db');

const s = v => String(v == null ? '' : v);
function toshkent(ms) { const d = new Date((ms || Date.now()) + 5 * 3600 * 1000); return { d, iso: d.toISOString().slice(0, 10), soat: d.getUTCHours(), daq: d.getUTCMinutes(),
  dmyHm: String(d.getUTCDate()).padStart(2, '0') + '.' + String(d.getUTCMonth() + 1).padStart(2, '0') + '.' + d.getUTCFullYear() + ' ' + String(d.getUTCHours()).padStart(2, '0') + ':' + String(d.getUTCMinutes()).padStart(2, '0') }; }

// bo'lak kaliti: 'soat2' — har 2 soat (00,02,…22), daqiqa ≥ 5 dan; 'kun:HH:MM' — kuniga bir marta, shu vaqtdan boshlab
function bolak(ish, t) {
  if (ish.har === 'soat2') { if (t.daq < 5) return null; return t.iso + 'T' + String(t.soat - t.soat % 2).padStart(2, '0'); }
  const m = /^kun:(\d{2}):(\d{2})$/.exec(ish.har);
  if (m) { if (t.soat < +m[1] || (t.soat === +m[1] && t.daq < +m[2])) return null; return t.iso; }
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
async function topAvtoIsh(kod) {
  const TA = require('../api/top_avto')._ichki, TP = require('../api/topshiriq_yoz')._ichki, koprik = require('../api/koprik'), tetik = require('./kozgu_tetik');
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
const ISHLAR = [
  { nom: 'top_avto', tavsif: '🤖 Topshiriq qoidalari (topAvto)', har: 'soat2', eski: 'topAvto — everyHours(2)', ish: topAvtoIsh },
];

// ------------------------------------------------------------------ bajarish va jurnal
async function jurnalYoz(ish, t0, ok, natija, xato) {
  const yoz = { vaqt: toshkent().dmyHm, nom: ish.nom, ms: Date.now() - t0, ok, natija: natija || null, xato: xato ? s(xato).slice(0, 300) : null };
  try { await redis.lpush('vaqt_jurnal', JSON.stringify(yoz)); await redis.ltrim('vaqt_jurnal', 0, 299); await redis.set('vaqt:' + ish.nom + ':oxirgi', JSON.stringify(yoz)); } catch (e) { }
  q('INSERT INTO rpc_jurnal (fn, qayerda, ms, ok, xato) VALUES ($1,$2,$3,$4,$5)', [ish.nom === 'top_avto' ? 'topAvto' : ish.nom, 'vaqt', yoz.ms, ok, yoz.xato]).catch(() => {});
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
module.exports = { ISHLAR, boshla, tekshir, bajar, holat, toshkent, bolak };
