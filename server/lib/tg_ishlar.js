// AKS TIZIM — ⏰ eski tgTugmaPoll ichida yashirin turgan ikki ish — endi alohida vaqt ishlari (lib/vaqt.js; Telegram ko'chirish 3-qadami, 23.10.2026):
//   skan_naz  (har 10 daqiqada) — Topshiriq.gs v2.1 skanNazTekshir_: 06d dagi YANGI «SHARTNOMA» skanlari (majburiy tekshiruvda bo'lmaganlari) — P ustuniga
//             «Kutilmoqda|vaqt», yurist + direktorga Telegram (fayl + ✅ To'g'ri / ✖ Qaytarish), havola Q ustuniga. Oxirgi ko'rilgan ID — Redis skan_naz_id
//             (eski: Script Properties SKAN_NAZ_ID). Birinchi marta — faqat belgi (eskilari yuborilmaydi). Yoqilgach api/top_avto.js koprikSkanNaz ni chaqirmaydi.
//   tq_kechki (20:05) — Topshiriq.gs v2.2 tqKechki_: direktor(lar)ga «⚖ Yurist bugun» xulosasi (📥 Kutilayotganlar / 📥 Qaytarilganlar tugmalari); bo'sh kun — yuborilmaydi.
// opt.quruq — hech narsa yozmaydi va yubormaydi: nima bo'lishini qaytaradi (aks-vaqt sinov skan_naz / tq_kechki).
'use strict';
const { redis } = require('./db');
const G = require('./google');
const env = require('./env');
const TS = require('./tasdiq');
const TT = require('./tg_tasdiq');
const tetik = require('./kozgu_tetik');

const s = v => String(v == null ? '' : v);
const HUJ_V = '06d_Hujjatlar', TOP_V = '10_Topshiriqlar';

async function skanNaz(kod, opt = {}) {
  const quruq = !!opt.quruq, ctx = quruq ? TT.quruq() : TT.haqiqiy();
  const X = await G.oraliqOqi(env.aksBazaId, HUJ_V, 'A2:Q', env.googleKey);   // Google'dan YANGI (getDisplayValues)
  let m = -1; X.forEach((r, i) => { if (s(r[0]) !== '') m = i; });
  const L = X.slice(0, m + 1).map((r, i) => ({ qator: i + 2, id: s(r[0]), no: s(r[1]), fish: s(r[3]), turi: s(r[5]), nom: s(r[7]), faylId: s(r[8]), kim: s(r[11]), vaqt: s(r[12]), holati: s(r[13]), naz: s(r[15]), tgx: s(r[16]) })).filter(h => h.id);
  if (!L.length) return { yangi: 0 };
  const max = Math.max(...L.map(h => Number(h.id) || 0)), oxir = Number(await redis.get('skan_naz_id')) || 0;
  // 🤖 avto qabul (24.10): ixtiyoriy nazorat yuborilmaydi — faqat belgi suriladi (keyin yoqilsa eskilari kelib qolmasin)
  if (await require('../api/avto_isbot').yoqilgan()) { if (!quruq && max > oxir) await redis.set('skan_naz_id', String(max)); return { yangi: 0, max, avto: true, izoh: 'avto qabul yoqiq — ixtiyoriy skan nazorati yuborilmaydi' }; }
  if (!oxir) { if (!quruq) await redis.set('skan_naz_id', String(max)); return { birinchi: true, max, izoh: 'birinchi marta — faqat belgi qo\'yildi (ID ' + max + '), eskilari yuborilmaydi' }; }
  if (max <= oxir) return { yangi: 0, max };
  if (!quruq) await redis.set('skan_naz_id', String(max));   // eski kod kabi — yuborishdan oldin (og'ir ish yiqilsa ham takror kelmaydi)
  const yangi = L.filter(h => Number(h.id) > oxir && h.turi === 'SHARTNOMA' && h.holati === 'Faol');
  if (!yangi.length) return { yangi: 0, max, oxir };
  const R = (await require('../api/topshiriq_yoz')._ichki.topRowsYangi(TOP_V)).L;
  const majburiy = h => R.some(t => s(t.isbot) === 'HJ:' + h.id) || R.some(t => /^(skanq|skanu|skanz|hj)\|/.test(s(t.kalit)) && s(t.kalit).split('|')[1] === h.no
    && TS.topHjTur(t) === 'SHARTNOMA' && (t.holati === 'Jarayonda' || t.holati === 'Tekshiruvda'));   // majburiy tekshiruvdagilar — bu yerga emas
  const yub = [], otk = [];
  for (const h of yangi) {
    if (majburiy(h)) { otk.push(h.no + ' (majburiy tekshiruvda)'); continue; }
    const mm = /^(\d{2})\.(\d{2})\.(\d{4}) (\d{2}):(\d{2})/.exec(h.vaqt);
    const naz = 'Kutilmoqda|' + (mm ? mm[3] + '-' + mm[2] + '-' + mm[1] + ' ' + mm[4] + ':' + mm[5] : TS.topHozirIso());
    await TT.yozuv(ctx, HUJ_V + ' P' + h.qator + ' (' + h.no + ' ' + h.nom + ') ← ' + naz, () => G.xomYoz(env.aksBazaId, [{ varaq: HUJ_V, qator: h.qator, ustun: 16, qiymat: naz }], env.googleKey));
    const it = TS.skanNazItem(Object.assign({}, h, { naz })); if (!it) continue;
    const r = await TT.tasdiqYubor(ctx, it);
    yub.push({ no: h.no, nom: h.nom, kim: h.kim, ref: r.ref, faylYoq: r.yoq || 0, sabab: r.sabab || '' });
  }
  if (!quruq && yub.length) tetik.varaqlarYangila([HUJ_V]).catch(() => {});
  const n = yub.filter(y => y.ref).length;
  return Object.assign({ max, oxir, yangi: yangi.length, n, otkazildi: otk }, quruq ? { quruq: true, yuborilardi: yub, xabarlar: ctx.log } : { yuborildi: yub });
}

async function tqKechki(kod, opt = {}) {
  const quruq = !!opt.quruq, ctx = quruq ? TT.quruq() : TT.haqiqiy();
  const C = await TT.adminChatlar(); let n = 0;
  for (const c of C) { try { if (await TT.xulosaYubor(ctx, c, false)) n++; } catch (e) { console.error('tqKechki ' + c + ':', e.message); if (!quruq) throw e; } }
  const X = quruq ? await TT.xulosa() : null;
  return Object.assign({ chatlar: C.length, yuborildi: n }, quruq ? { quruq: true, bosh: X.bosh, matn: X.matn.replace(/<[^>]+>/g, ''), xabarlar: ctx.log } : {});
}

module.exports = { skanNaz, tqKechki };
