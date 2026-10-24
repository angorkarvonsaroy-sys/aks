#!/usr/bin/env node
// AKS TIZIM — DIREKTOR QARORI (23.10.2026) bo'yicha bir martalik tuzatish (ijro intizomi):
//   1) 06q_Qoidabuzarlik: OKTABRDAGI «xat» va «xat3» qoidabuzarliklari → Uzrli («pochta xatlari uchun 1 ish kuni muhlat»);
//      «pasport» qoidasidagi topshiriq muddati o'tgani uchun yozilgan «top» → Uzrli («muddat 30.11.2026 gacha uzaytirildi»). K:M = Holati, Uzr_sababi, Uzr_kim.
//   1b) 24.10 qarori: «Isbotni muddatida tekshirmadi» (tasdiq) — hamma oy → Uzrli (vazifa yuristdan olib tashlandi, avtomatik qabul).
//   2) 10_Topshiriqlar: «pasport» qoidasidagi ochiq (Jarayonda) topshiriqlar muddati (L) → 30.11.2026 18:00.
// Ishlatish: aks-ijro-qaror — nima o'zgarishini ko'rsatadi (HECH NARSA YOZILMAYDI) · aks-ijro-qaror bajar — yozadi (bir marta; qayta ishlatilsa — o'zgargani qolmaydi)
'use strict';
process.env.AKS_ENV = process.env.AKS_ENV || '/opt/aks/.env';
const { pool, redis } = require('../lib/db');
const G = require('../lib/google');
const env = require('../lib/env');
const V = require('../lib/varaq');
const X = require('../lib/xat_yordam');
const tetik = require('../lib/kozgu_tetik');
const IY = require('../api/ijro_yoz')._ichki;
const TP = require('../api/topshiriq_yoz')._ichki;

const OY = '2026-10', MUDDAT = '30.11.2026 18:00';
const SAB_XAT = 'Direktor qarori 23.10.2026: pochta xatlari uchun 1 ish kuni muhlat';
const SAB_PAS = 'Direktor qarori 23.10.2026: pasport topshiriqlari muddati 30.11.2026 gacha uzaytirildi';
const SAB_TAS = 'Direktor qarori 24.10.2026: isbot tekshirish vazifasi yuristdan olib tashlandi (avtomatik qabul)';
const s = v => String(v == null ? '' : v);
const ijroIso = v => typeof v === 'number' ? V.iso(v) : X.xatIso(s(v).slice(0, 10));
const ball = q => q.Tur === 'xat3' || q.Tur === 'soxta' ? 3 : 1;

(async () => {
  const bajar = process.argv[2] === 'bajar';
  console.log('================ 📒 DIREKTOR QARORI 23.10.2026 — ' + (bajar ? 'BAJARILMOQDA' : 'KO\'RISH (hech narsa yozilmaydi)') + ' ================');
  const [L, R, XD] = await Promise.all([IY.ijroQatorYangi(IY.IJRO_VARAQ, IY.IJRO_S), TP.topRowsYangi(TP.TOP_V), IY.qdXodimlar()]);
  const dir = (XD.find(x => x.huquq.indexOf('admin') >= 0) || {}).fish || 'direktor';
  const pasId = new Set(R.L.filter(t => s(t.qoida) === 'pasport').map(t => s(t.id)));
  const oy = L.filter(q => ijroIso(q.Sana).slice(0, 7) === OY && q.Holati !== 'Uzrli');
  let qoidaSana = ''; try { qoidaSana = String((await redis.get('ijro_xat_qoida_sana')) || ''); } catch (e) { }   // yangi qoida kuchga kirgan kun — undan keyingi xat ballari haqiqiy, tegilmaydi
  const xat = oy.filter(q => (q.Tur === 'xat' || q.Tur === 'xat3') && (!qoidaSana || ijroIso(q.Sana) < qoidaSana));
  const pas = oy.filter(q => q.Tur === 'top' && /^top\|/.test(s(q.Kalit)) && pasId.has(s(q.Kalit).split('|')[1]));
  const och = R.L.filter(t => s(t.qoida) === 'pasport' && t.holati === 'Jarayonda');
  const tas = L.filter(q => q.Tur === 'tasdiq' && q.Holati !== 'Uzrli');   // 24.10: «Isbotni muddatida tekshirmadi» — vazifa olib tashlandi (hamma oy)
  // ko'rsatish
  const xodim = {}; oy.concat(tas).forEach(q => { const o = xodim[q.Xodim] = xodim[q.Xodim] || { oldin: 0, xat: 0, pas: 0, tas: 0 }; if (oy.indexOf(q) >= 0) o.oldin += ball(q); });
  xat.forEach(q => { xodim[q.Xodim].xat += ball(q); }); pas.forEach(q => { xodim[q.Xodim].pas += ball(q); }); tas.forEach(q => { xodim[q.Xodim].tas += ball(q); });
  console.log('\n1) 06q — oktabr, uzrsiz qoidabuzarliklar → Uzrli (Uzr_kim: ' + dir + '):');
  console.log('   xat / xat3 (pochta): ' + xat.length + ' ta · pasport topshirig\'i: ' + pas.length + ' ta · isbot tekshirmadi (yurist, 24.10 qarori): ' + tas.length + ' ta');
  if (qoidaSana) console.log('   (yangi xat qoidasi ' + qoidaSana + ' dan kuchda — shu kundan keyingi xat ballari haqiqiy, uzrli qilinmaydi)');
  Object.keys(xodim).sort().forEach(f => { const o = xodim[f]; if (!o.xat && !o.pas && !o.tas) return;
    console.log('   • ' + f + ': ' + o.oldin + ' ball → ' + (o.oldin - o.xat - o.pas - o.tas) + ' ball (xat −' + o.xat + ', pasport −' + o.pas + ', isbot tekshiruvi −' + o.tas + ')'); });
  console.log('\n2) 10_Topshiriqlar — «pasport» ochiq topshiriqlar muddati → ' + MUDDAT + ': ' + och.length + ' ta');
  const kim = {}; och.forEach(t => { kim[t.kimga] = (kim[t.kimga] || 0) + 1; }); Object.keys(kim).forEach(k => console.log('   • ' + k + ': ' + kim[k] + ' ta'));
  if (!bajar) {
    console.log('\nHech narsa yozilmadi. Yozish uchun: aks-ijro-qaror bajar');
  } else {
    const D = [];
    xat.forEach(q => D.push({ varaq: IY.IJRO_VARAQ, katak: 'K' + q.qator + ':M' + q.qator, qiymat: [['Uzrli', SAB_XAT, dir]] }));
    pas.forEach(q => D.push({ varaq: IY.IJRO_VARAQ, katak: 'K' + q.qator + ':M' + q.qator, qiymat: [['Uzrli', SAB_PAS, dir]] }));
    tas.forEach(q => D.push({ varaq: IY.IJRO_VARAQ, katak: 'K' + q.qator + ':M' + q.qator, qiymat: [['Uzrli', SAB_TAS, dir]] }));
    och.forEach(t => D.push({ varaq: TP.TOP_V, katak: 'L' + t.qator, qiymat: [[MUDDAT]] }));
    for (let i = 0; i < D.length; i += 200) await G.yoz(env.aksBazaId, D.slice(i, i + 200), env.googleKey);
    // tekshirish — Google'dan qayta o'qib
    const [L2, R2] = await Promise.all([IY.ijroQatorYangi(IY.IJRO_VARAQ, IY.IJRO_S), TP.topRowsYangi(TP.TOP_V)]);
    const uz = new Set(xat.concat(pas, tas).map(q => q.qator));
    const okQ = L2.filter(q => uz.has(q.qator) && q.Holati === 'Uzrli').length;
    const okT = R2.L.filter(t => s(t.qoida) === 'pasport' && t.holati === 'Jarayonda' && /^30\.11\.2026/.test(s(t.muddat))).length;
    console.log('\n✅ Yozildi: 06q Uzrli ' + okQ + ' / ' + uz.size + ' · 10 muddat 30.11 — ' + okT + ' / ' + och.length + (okQ === uz.size && okT === och.length ? '  — hammasi joyida' : '  ⚠ FARQ BOR — Claude\'ga ko\'rsating'));
    try { await Promise.race([tetik.varaqlarYangila([IY.IJRO_VARAQ, TP.TOP_V]), new Promise(r => setTimeout(r, 20000))]); } catch (e) { }
    try { await redis.lpush('qaror_jurnal', new Date().toISOString() + ' ijro 23.10: 06q ' + okQ + ', 10 ' + okT); } catch (e) { }
  }
  await pool.end(); redis.disconnect(); process.exit(0);
})().catch(async e => { console.error('XATO:', e.message); try { await pool.end(); redis.disconnect(); } catch (z) { } process.exit(1); });
