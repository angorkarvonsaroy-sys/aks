// AKS TIZIM — ⏰ ertalabki ishlar serverda (lib/vaqt.js chaqiradi):
//   undErtalab  — Undiruv.gs undErtalabYubor (09:00, yakshanbadan tashqari): har undiruvchiga ertalabki topshiriq (🔴 BUGUN / 🟡 Ish bor / 🟢 Yuristga tayyor,
//                 va'da eslatmasi, nazoratdagilar), 07c_Ertalab_svod ga bugungi qatorlar (bugungi eski qatorlar o'chirilib qayta yoziladi — monErtalabYoz_),
//                 direktor(lar)ga svod (+ monErtalabSvod_ navbati). Telegram — eski tizim ko'prigi (koprikTgChat; uzun xabar bo'laklab — tgBolibYubor_).
//   monEslatma  — Monitoring.gs monEslatmaYubor (09:10, yakshanbadan tashqari): skansiz yangi shartnomalar — tuzgan xodimga eslatma, direktorga svod.
// Matnlar eski kod bilan aynan. opt.quruq — hech narsa yubormaydi/yozmaydi, xabarlar va 07c qatorlarini qaytaradi (aks-vaqt sinov).
'use strict';
const G = require('./google');
const env = require('./env');
const V = require('./varaq');
const P = require('./portfel');
const { qisqaIsm } = require('./ism');
const koprik = require('../api/koprik');
const tetik = require('./kozgu_tetik');

const ERTALAB_V = '07c_Ertalab_svod';
const UND_ERTALAB_BELGI = 3500;   // Telegram chegarasi 4096 belgi — undan uzun ro'yxat bir necha xabarga bo'linadi
const H_KUNLAR_K = ['yakshanba', 'dushanba', 'seshanba', 'chorshanba', 'payshanba', 'juma', 'shanba'];
const s = v => String(v == null ? '' : v);
const dmy = iso => iso ? s(iso).slice(0, 10).split('-').reverse().join('.') : '';
const pul = n => Math.round(n || 0).toLocaleString('ru-RU').replace(/[ ,]/g, ' ');
const monQisqa = f => s(f).trim().split(/\s+/).slice(0, 2).join(' ');
function hafta(iso) { return new Date(iso + 'T12:00:00Z').getUTCDay(); }   // 0 — yakshanba

// tgBolibYubor_: qatorlarni 3500 belgili bo'laklarga bo'lib yuborish; qaytaradi xabarlar soni
function bolak(qatorlar) {
  const B = []; let joriy = [], uz = 0;
  qatorlar.forEach(q => { if (uz + q.length + 1 > UND_ERTALAB_BELGI && joriy.length) { B.push(joriy); joriy = []; uz = 0; } joriy.push(q); uz += q.length + 1; });
  if (joriy.length) B.push(joriy);
  return B.map((b, i) => (i ? '… <b>davomi ' + (i + 1) + '/' + B.length + '</b>\n' : '') + b.join('\n').replace(/\n+$/, ''));
}
async function tgBolibYubor(kod, chat, qatorlar) {
  const X = bolak(qatorlar);
  for (const m of X) await koprik.chaqir('koprikTgChat', kod, [chat, m]);
  return X.length;
}
// direktor(lar)ga shaxsan; birortasiga ketmasa — guruhga (tgYubor_)
async function direktorga(kod, adm, matn) {
  let ketdi = false;
  for (const id of adm) { try { await koprik.chaqir('koprikTgChat', kod, [id, matn]); ketdi = true; } catch (e) { console.error('ertalab (direktor):', e.message); } }
  if (!ketdi) { try { await koprik.chaqir('koprikTgYubor', kod, [matn]); } catch (e) { console.error('ertalab (guruh):', e.message); } }
  return ketdi;
}

// 07c_Ertalab_svod: bugungi qatorlar yoziladi (ikki marta ishlasa — eski bugungi qatorlar o'chirilib qayta yoziladi). rows: [{fish,q,s,y,n,muddati,holat}]
async function ertalabYoz(varaq, bugunIso, rows) {
  const d = dmy(bugunIso);
  const A = await G.oraliqOqi(env.aksBazaId, varaq, 'A2:A', env.googleKey);
  let l = 1; A.forEach((r, i) => { if (s(r[0]) !== '') l = i + 2; });   // ustunA_oxiri_
  const ochir = []; for (let i = l - 2; i >= 0; i--) if (s((A[i] || [])[0]) === d) ochir.push(i + 2);   // pastdan yuqoriga (deleteRow kabi)
  if (ochir.length) {
    const g = await G.gid(env.aksBazaId, varaq, env.googleKey);
    await G.soralar(env.aksBazaId, ochir.map(q => ({ deleteDimension: { range: { sheetId: g, dimension: 'ROWS', startIndex: q - 1, endIndex: q } } })), env.googleKey);
    l -= ochir.length;
  }
  if (!rows.length) return { ochirildi: ochir.length, yozildi: 0 };
  await G.qatorlarQoshR(env.aksBazaId, varaq, l + 1, rows.map(r => [d, r.fish, r.q, r.s, r.y, r.n, r.muddati, r.holat]), env.googleKey);
  return { ochirildi: ochir.length, yozildi: rows.length, qator: l + 1 };
}

// ------------------------------------------------------------------ undErtalabYubor
async function undErtalab(kod, opt = {}) {
  const bugun = V.bugun();
  if (hafta(bugun) === 0) return { yuborilmadi: 'Yakshanba — topshiriq yuborilmaydi.' };
  const MON = require('../api/monitoring')._ichki;
  const XD = await MON.monXodimlarRoyxat();
  const U = XD.filter(x => x.ishlayapti && x.huquq.indexOf('undiruv') >= 0 && x.huquq.indexOf('admin') < 0);
  const adm = XD.filter(x => x.ishlayapti && x.huquq.indexOf('admin') >= 0 && x.tg).map(x => x.tg);
  const Pf = await P.undPortfel(() => true, kod);
  const sana = dmy(bugun) + ', ' + H_KUNLAR_K[hafta(bugun)];
  const svod = [], yoz = [], xabarlar = [];
  for (const x of U) {
    const L = Pf.royxat.filter(z => z.undiruvchi === x.fish);
    const q = [], sa = [], y = [];
    L.forEach(z => { const nom = '<b>' + z.no + '</b> ' + qisqaIsm(z.fish);
      const bq = z.buyruq.filter(b => b.d === 'q'), bs = z.buyruq.filter(b => b.d === 's'), by = z.buyruq.filter(b => b.d === 'y');
      if (bq.length) q.push(nom + ' — ' + bq[0].t + (bq.length > 1 ? ' (+' + (bq.length - 1) + ')' : ''));
      else if (bs.length) sa.push(nom + ' — ' + bs[0].t + (bs.length > 1 ? ' (+' + (bs.length - 1) + ')' : ''));
      if (by.length) y.push(nom); });
    const muddati = L.reduce((m, z) => m + (z.muddati || 0), 0);
    const M = ['☀️ <b>Ertalabki topshiriq</b> — ' + sana, '<b>' + x.ism + '</b>, portfelingizda ' + L.length + ' ta mijoz, muddati o\'tgan qarz ' + pul(muddati) + ' so\'m.', ''];
    const royxat = (sarl, R) => { if (!R.length) return; M.push(sarl + ' (' + R.length + ')'); R.forEach(t => M.push('• ' + t)); M.push(''); };
    const NZ = L.map(z => ({ z, n: P.undNazorat(z, bugun) })).filter(o => o.n);
    const vE = NZ.filter(o => o.n.kerak === 'eslatma0' || o.n.kerak === 'eslatma1');
    if (vE.length) { M.push('🔔 <b>Va\'da eslatmasi</b> — qo\'ng\'iroq qilib eslating (' + vE.length + ')');
      vE.forEach(o => M.push('• <b>' + o.z.no + '</b> ' + qisqaIsm(o.z.fish) + ' — ' + (o.n.kerak === 'eslatma0' ? 'BUGUN' : 'ertaga') + ' ' + pul(o.z.vada.summa) + ' so\'m')); M.push(''); }
    const nQ = NZ.filter(o => o.n.kerak === 'qongiroq').length;
    if (nQ) { M.push('📋 <b>Nazoratda</b>: ' + nQ + ' ta xat olgan mijozga bugun qo\'ng\'iroq qilish shart (ilovada «📋 Nazoratdagi mijozlar»).'); M.push(''); }
    royxat('🔴 <b>BUGUN</b>', q); royxat('🟡 <b>Ish bor</b>', sa);
    if (y.length) { M.push('🟢 <b>Yuristga tayyor</b>: ' + y.join(', ')); M.push(''); }
    if (!q.length && !sa.length) M.push('✅ Bugun shoshilinch ish yo\'q. Portfelni ilovada ko\'rib chiqing.');
    M.push('Ishlarni bajarib, har birini «Undiruv jurnali»ga yozing. 17:00 da yetkazilmagan xatlar tekshiriladi.');
    let holat;
    if (!x.tg) holat = '❌ Telegramga ulanmagan — topshiriq bormadi';
    else if (opt.quruq) { holat = '(quruq) ' + bolak(M).length + ' xabar'; xabarlar.push({ kimga: x.fish, matn: M.join('\n') }); }
    else { try { const n = await tgBolibYubor(kod, x.tg, M); holat = '✅ yuborildi' + (n > 1 ? ' (' + n + ' xabar)' : ''); } catch (e) { holat = '❌ yuborilmadi: ' + e.message; } }
    svod.push('<b>' + x.fish + '</b> — 🔴 ' + q.length + ' · 🟡 ' + sa.length + ' · 🟢 ' + y.length + ' · ' + holat);
    yoz.push({ fish: x.fish, q: q.length, s: sa.length, y: y.length, n: L.length, muddati, holat });
  }
  let yozNatija = null;
  if (!opt.quruq) { try { yozNatija = await ertalabYoz(opt.varaq || ERTALAB_V, bugun, yoz); } catch (e) { console.error('07c ertalab svod:', e.message); yozNatija = { xato: e.message }; } }
  const bosh = Pf.royxat.filter(z => !z.undiruvchi).length;
  let DIR = [];
  try { const N = MON.monNavbat(await MON.monMalumot(bugun, Pf, kod)); const g = (arr, k) => { const r = arr.filter(z => z.k === k)[0]; return r ? r.n : 0; };
    DIR = ['👔 <b>Direktor: bugungi navbat</b>',
      "🔴 Da'vo muddati: o'tgan <b>" + g(N.qizil, 'davo_otgan') + "</b> · 90 kun qolgan <b>" + g(N.qizil, 'davo_xavf') + "</b> · va'dasi bugun <b>" + g(N.qizil, 'vada') + '</b>',
      '🔴 Tasdiq kutmoqda: yurist <b>' + g(N.qizil, 'yur_sorov') + '</b> · bekor qilish <b>' + g(N.qizil, 'bekor') + '</b> · yurist bosqichi kechikkan <b>' + g(N.qizil, 'yur_kech') + '</b>',
      '🔴 Yetkazilmagan xatlar: OG <b>' + g(N.qizil, 'xat_og') + '</b> · YU <b>' + g(N.qizil, 'xat_yu') + '</b>',
      "🟡 Skansiz yangi <b>" + g(N.sariq, 'skan') + "</b> · boshlang'ich kelmagan <b>" + g(N.sariq, 'bosh') + '</b> · ' + P.UND_JIM_KUN + ' kun jim <b>' + g(N.sariq, 'jim') + '</b>',
      "⚪ JSHSHIR yo'q <b>" + g(N.oq, 'jshshir') + "</b> · ota ismi yo'q <b>" + g(N.oq, 'ota') + "</b> · notarial yo'q <b>" + g(N.oq, 'notarial') + '</b>'];
  } catch (e) { console.error('direktor navbati:', e.message); }
  const D = (DIR.length ? DIR.concat(['']) : []).concat(['📋 <b>Ertalabki topshiriqlar</b> — ' + sana, '']).concat(svod.length ? svod : ['Undiruvchi yo\'q.']);
  if (bosh) D.push('', '⚠️ Undiruvchi biriktirilmagan: ' + bosh + ' ta shartnoma — ularga topshiriq bormaydi.');
  const dm = D.join('\n');
  if (opt.quruq) { xabarlar.push({ kimga: 'direktor', matn: dm }); return { quruq: true, xabarlar, svod07c: yoz }; }
  const ketdi = await direktorga(kod, adm, dm);
  tetik.varaqlarYangila([ERTALAB_V]).catch(() => {});
  return { undiruvchi: U.length, yuborildi: yoz.filter(r => /^✅/.test(r.holat)).length, bormadi: yoz.filter(r => /^❌/.test(r.holat)).length, direktor: ketdi, c07: yozNatija };
}

// ------------------------------------------------------------------ monEslatmaYubor
async function monEslatma(kod, opt = {}) {
  const bugun = V.bugun();
  if (hafta(bugun) === 0) return { yuborilmadi: 'Yakshanba — eslatma yuborilmaydi.' };
  const MON = require('../api/monitoring')._ichki, J = require('./jurnallar');
  const A = await MON.monAktiv(), H = await MON.monHujjatSvod(bugun, A.MJ, await J.hujjatJurnal());
  const L = H.yangiSkansiz; if (!L.length) return { yuborilmadi: 'Skansiz yangi shartnoma yo\'q.' };
  const XD = await MON.monXodimlarRoyxat();
  const top = fish => { const f = s(fish).trim().toLowerCase(); return XD.filter(x => x.fish.toLowerCase() === f)[0] || null; };
  const Gr = {}; L.forEach(x => { (Gr[x.kim] = Gr[x.kim] || []).push(x); });
  const svod = [], xabarlar = [];
  for (const kim of Object.keys(Gr).sort()) {
    const R = Gr[kim], x = top(kim); let holat;
    const otgan = R.filter(r => r.kun >= H.kun).length;
    if (!x) holat = '❌ tizimda yo\'q';
    else if (!x.ishlayapti) holat = '❌ ishlamayapti';
    else if (!x.tg) holat = '❌ Telegramga ulanmagan';
    else {
      const M = ['📎 <b>Imzolangan nusxa yuklanmagan</b> — ' + dmy(bugun), x.ism + ', siz tuzgan ' + R.length + ' ta shartnomaning imzolangan nusxasi tizimga yuklanmagan:', ''];
      R.forEach(r => M.push((r.kun >= H.kun ? '🔴 ' : '⏳ ') + '<b>' + r.no + '</b> ' + monQisqa(r.fish) + ' · ' + r.dokon + ' — ' +
        (r.kun >= H.kun ? r.kun + ' kun o\'tdi' : (r.kun ? r.kun + ' kun, ' : '') + 'muddat: ' + (H.kun - r.kun) + ' kun qoldi')));
      M.push('', 'Ikkala tomon imzolagan shartnomani skanerlab 📎 Hujjatlar bo\'limiga «Shartnoma (imzolangan)» turi bilan yuklang. Muddat — shartnoma tuzilgan kundan ' + H.kun + ' kun.');
      if (opt.quruq) { holat = '(quruq)'; xabarlar.push({ kimga: x.fish, matn: M.join('\n') }); }
      else { try { await tgBolibYubor(kod, x.tg, M); holat = '✅ yuborildi'; } catch (e) { holat = '❌ yuborilmadi: ' + e.message; } }
    }
    svod.push('<b>' + kim + '</b> — ' + R.length + ' ta' + (otgan ? ' (🔴 ' + otgan + ' ta muddati o\'tgan)' : '') + ' · ' + holat);
  }
  const dm = ['📎 <b>Skansiz shartnomalar</b> — ' + dmy(bugun), ''].concat(svod).concat(['', 'Mas\'uli tizimda yo\'q yoki ulanmagan bo\'lsa — 04 Masul_xodim / 03b izohdagi ismni tekshiring yoki skanni o\'zingiz yuklang.']).join('\n');
  if (opt.quruq) { xabarlar.push({ kimga: 'direktor', matn: dm }); return { quruq: true, xabarlar }; }
  const adm = XD.filter(x => x.ishlayapti && x.huquq.indexOf('admin') >= 0 && x.tg).map(x => x.tg);
  const ketdi = await direktorga(kod, adm, dm);
  return { skansiz: L.length, xodimlar: Object.keys(Gr).length, yuborildi: svod.filter(z => /✅/.test(z)).length, direktor: ketdi };
}

module.exports = { undErtalab, monEslatma, ertalabYoz, bolak, ERTALAB_V };
