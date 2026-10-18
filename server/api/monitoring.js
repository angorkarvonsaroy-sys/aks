// AKS TIZIM — 👔 DIREKTOR BO'LIMI (Monitoring.gs v26.4 monBoshlang) serverda. To'rt tortma bitta javobda: navbat, tasdiqlar, xodimlar, nazorat jurnallari.
// Manbalar — ko'zgu: portfel (lib/portfel.js), 06b/06f (yurist), 06e (xatlar), 06g (yuridik xatlar), 06h (bekor so'rovlari), 06i (xodim so'rovlari),
// 06j (tahrirlar), 06d (hujjatlar), 06t (tasdiq qarorlari), 10 (topshiriqlar), 07 (xodimlar), 07b (kirishlar), 07c (ertalab svod), 05, 01b, 03, 03b, 04.
// Natija eski tizim bilan bir xil. Yozadigan amallar (monSorovYubor, monSorovJavob) — hali ko'prik.
'use strict';
const S = require('./sessiya');
const V = require('../lib/varaq');
const J = require('../lib/jurnallar');
const U = require('../lib/undiruv_yordam');
const X = require('../lib/xat_yordam');
const P = require('../lib/portfel');
const TS = require('../lib/tasdiq');
const { Q } = require('./yurist');

const MON_SOROV_TUR = { xat_bekor: 'Xatni bekor qilish', tahrir: 'Shartnoma tahriri' };
const MON_HAFTA = 7, MON_OQISH_QATOR = 2500;
const HUJJAT_NAZORAT_BOSHI = '2026-09-29', HUJJAT_NAZORAT_KUN = 3;
const BEKOR_YOPIQ = ['Bekor qilindi', 'Rad etildi', 'Qaytarildi'], BEKOR_SKAN_ISH_KUN = 2;

const kun = U.kun, qosh = U.kunQosh, s = v => String(v == null ? '' : v);
const monQisqa = f => String(f || '').trim().split(/\s+/).slice(0, 2).join(' ');
const monPul = n => Math.round(Number(n) || 0).toLocaleString('ru-RU').replace(/[\u00a0,]/g, ' ');
const monDmy = iso => iso ? String(iso).slice(0, 10).split('-').reverse().join('.') : '';
const monBekorOchiq = b => BEKOR_YOPIQ.indexOf(String(b.holati || '')) < 0;
function monKunlar(bugun, n) { const L = []; for (let i = n - 1; i >= 0; i--) L.push(qosh(bugun, -i)); return L; }
function yhIso(v) { v = String(v || '').trim(); if (/^\d{4}-\d{2}-\d{2}/.test(v)) return v.slice(0, 10); if (/^\d{2}\.\d{2}\.\d{4}/.test(v)) return v.slice(0, 10).split('.').reverse().join('-'); return ''; }
function bekorIshKun(sana, bugunIso) {   // ish kunlari (yakshanbasiz), sananing o'zi 0-kun
  const iso = yhIso(sana); if (!iso) return 0;
  let k = 0; const d = new Date(iso + 'T12:00:00Z'), ox = new Date(bugunIso + 'T12:00:00Z');
  while (d < ox) { d.setUTCDate(d.getUTCDate() + 1); if (d.getUTCDay() !== 0) k++; }
  return k;
}

// ------------------------------------------------------------------ manbalar
async function monAktiv() {
  const MJ = {};
  (await V.qatorlar('02_Mijozlar')).forEach(({ x }) => { if (x[0] == null || x[0] === '') return; const f = s(x[2]).trim();
    MJ[s(x[0])] = { fish: f, tel: [x[4], x[5]].filter(Boolean).map(String).join(', '), ota: f.split(/\s+/).filter(Boolean).length >= 3, jshshir: /^\d{14}$/.test(s(x[11]).trim()) }; });
  const L = [];
  (await V.qatorlar('03_Sotuv_shartnomalar')).forEach(({ x }) => {
    const no = s(x[0]).trim(); if (!/^27\/\d+$/.test(no) || /bekor/i.test(s(x[13]))) return;
    const mid = s(x[4]), m = MJ[mid];
    L.push({ no, sana: V.iso(x[2]), mid, mijozBor: !!m, dokon: s(x[5]), holati: s(x[13]), notarial: V.iso(x[15]), undiruvchi: s(x[17]).trim(),
      fish: s(x[20]) || (m ? m.fish : '') || '', tolangan: V.son(x[27]), jami: V.son(x[30]), muddati: V.son(x[31]), kechikkan: V.son(x[32]),
      ota: m ? m.ota : true, jshshir: m ? m.jshshir : false, tel: m ? m.tel : '' });
  });
  return { L, MJ };
}
async function monHujjatSvod(bugun, MJ, HJ) {
  const chegara = qosh(bugun, -HUJJAT_NAZORAT_KUN);
  const bor = {}; let jami = 0;
  HJ.forEach(h => { if (h.holati === 'Faol') { jami++; if (h.turi === 'SHARTNOMA') bor[h.no] = true; } });
  const L = [], kim = {};
  (await V.qatorlar('03_Sotuv_shartnomalar')).forEach(({ x }) => { const no = s(x[0]).trim(); if (!/^27\/\d+$/.test(no)) return;
    L.push({ no, tur: 'sotuv', fish: s(x[20]) || (MJ[s(x[4])] || {}).fish || '', dokon: s(x[5]), sana: V.iso(x[2]), holati: s(x[13]) }); });
  (await V.qatorlar('04_Ijara_shartnomalar')).forEach(({ x }) => { const no = s(x[0]).trim(); if (!/^IJ-27\/\d+$/.test(no)) return;
    L.push({ no, tur: 'ijara', fish: s(x[23]) || (MJ[s(x[5])] || {}).fish || '', dokon: s(x[4]), sana: V.iso(x[1]), holati: s(x[2]) }); kim[no] = s(x[20]); });
  (await V.qatorlar('03b_Tolov_jadvali')).forEach(({ x }) => { const m = /^Web App: (.+)$/.exec(s(x[7])); if (m && !kim[s(x[1])]) kim[s(x[1])] = m[1]; });
  const faol = L.filter(x => !/Bekor/i.test(x.holati));
  const yangi = faol.filter(x => x.sana >= HUJJAT_NAZORAT_BOSHI && x.sana <= bugun && !bor[x.no])
    .map(x => ({ no: x.no, fish: x.fish, dokon: x.dokon, sana: x.sana, kun: kun(x.sana, bugun), kim: kim[x.no] || '—' })).sort((a, b) => b.kun - a.kun);
  const nusxasiz = yangi.filter(x => x.sana <= chegara);
  const st = t => { const f = faol.filter(x => x.tur === t); return [f.filter(x => bor[x.no]).length, f.length]; };
  return { nusxasiz, yangiSkansiz: yangi, arxiv: { sotuv: st('sotuv'), ijara: st('ijara'), jami }, kun: HUJJAT_NAZORAT_KUN, jurnal: HJ, kim };
}
async function monOfisBugun(bugun, HJ) {
  const out = {}, bDmy = monDmy(bugun);
  const o = f => out[f] = out[f] || { tolov: { soni: 0, summa: 0 }, tashrif: 0, shartnoma: 0, hujjat: 0 };
  const T5 = await V.qatorlar('05_Tolovlar'); T5.slice(Math.max(0, T5.length - MON_OQISH_QATOR)).forEach(({ x }) => { if (x[0] != null && x[0] !== '' && V.iso(x[1]) === bugun && x[9]) { const t = o(s(x[9]).trim()).tolov; t.soni++; t.summa += V.son(x[3]); } });
  const T1 = await V.qatorlar('01b_Tashrif_jurnali'); T1.slice(Math.max(0, T1.length - MON_OQISH_QATOR)).forEach(({ r }) => { if (r[0] && r[1] === bDmy && r[8]) o(s(r[8]).trim()).tashrif++; });
  const bugungi = {};
  (await V.qatorlar('03_Sotuv_shartnomalar')).forEach(({ x }) => { const no = s(x[0]).trim(); if (/^27\/\d+$/.test(no) && V.iso(x[2]) === bugun) bugungi[no] = true; });
  const sanalgan = {};
  if (Object.keys(bugungi).length) (await V.qatorlar('03b_Tolov_jadvali')).forEach(({ x }) => { const no = s(x[1]); if (!bugungi[no] || sanalgan[no]) return;
    const m = /^Web App: (.+)$/.exec(s(x[7])); if (m) { sanalgan[no] = true; o(m[1].trim()).shartnoma++; } });
  (await V.qatorlar('04_Ijara_shartnomalar')).forEach(({ x }) => { if (/^IJ-27\/\d+$/.test(s(x[0]).trim()) && V.iso(x[1]) === bugun && x[20]) o(s(x[20]).trim()).shartnoma++; });
  (HJ || []).forEach(h => { if (h.holati === 'Faol' && h.kim && String(h.vaqt).indexOf(bDmy) === 0) o(String(h.kim).trim()).hujjat++; });
  return out;
}
async function monXodimlarRoyxat() {
  return (await V.qatorlar('07_Xodimlar')).filter(({ x }) => s(x[1]).trim()).map(({ x }) => { const f = s(x[1]).trim();
    return { fish: f, ism: f.split(/\s+/)[1] || f, tel: s(x[5]).trim(), ishlayapti: s(x[10]).trim() === 'Ishlayapti', kodBor: !!s(x[11]).trim(),
      huquq: s(x[18]).toLowerCase().split(/[\s,;]+/).filter(Boolean), tg: s(x[20]).trim() }; });
}
async function monKirishlar(kunlar) {   // {fish: {sana: {birinchi, oxirgi, soni}}} — 07b, oxirgi MON_OQISH_QATOR qator
  const out = {}; const set = {}; kunlar.forEach(d => { set[monDmy(d)] = d; });
  const R = await V.qatorlar('07b_Kirish_jurnali');
  R.slice(Math.max(0, R.length - MON_OQISH_QATOR)).forEach(({ r }) => { const d = set[r[0]]; if (!d || !r[2]) return;
    const v = String(r[1]).slice(0, 5); const f = (out[r[2]] = out[r[2]] || {});
    const o = (f[d] = f[d] || { birinchi: v, oxirgi: v, soni: 0 }); o.soni++; if (v < o.birinchi) o.birinchi = v; if (v > o.oxirgi) o.oxirgi = v; });
  return out;
}
async function monErtalabOqi(kunlar) {   // {sana: {fish: {q,s,y,n,muddati,holat}}} — 07c
  const out = {}; const set = {}; kunlar.forEach(d => { set[monDmy(d)] = d; });
  (await V.qatorlar('07c_Ertalab_svod')).forEach(({ r }) => { const d = set[r[0]]; if (!d || !r[1]) return;
    (out[d] = out[d] || {})[r[1]] = { q: Number(r[2]) || 0, s: Number(r[3]) || 0, y: Number(r[4]) || 0, n: Number(r[5]) || 0, muddati: Number(String(r[6]).replace(/[^\d]/g, '')) || 0, holat: r[7] }; });
  return out;
}
async function bekorSorovlar(bugun) {
  return (await J.bekorJurnal()).map(x => {
    const ochiq = BEKOR_YOPIQ.indexOf(x.holati) < 0;
    const kech = (ochiq && !(x.bSkan && x.xSkan) && x.sana) ? bekorIshKun(x.sana, bugun) : 0;
    return { id: x.id, no: x.no, tur: x.tur === 'Ijara' ? 'ijara' : 'sotuv', fish: x.fish, dokon: x.dokon, holati: x.holati, kim: x.kim, vaqt: x.vaqt, sabab: x.sabab, jami: x.jami, tolangan: x.tolangan, qaytar: x.qaytar,
      hujjatKechikdi: kech >= BEKOR_SKAN_ISH_KUN ? kech : 0 };
  });
}

// ------------------------------------------------------------------ umumiy ma'lumot
async function monMalumot(bugun, Pf, kod) {
  const [A, I, K, TSn, SN, TQ, Xj, YX, B, SR, HJ, TH, TOP, XD] = await Promise.all([
    monAktiv(), J.yuIshlar(), Q.yuKesh(), TS.tasdiqNavbat(), TS.skanNazNavbat(), TS.tqKorilmagan(), J.xatJurnal(), J.yuxJurnal(), bekorSorovlar(bugun),
    J.monSorovlar(), J.hujjatJurnal(), J.tahrirJurnal(), J.topRows().then(T => T.map(J.topKor)), monXodimlarRoyxat()]);
  const NOM = {}; A.L.forEach(x => { NOM[x.no] = x; });
  const SP = {}; Pf.royxat.forEach(x => { SP[x.no] = x; });
  return { bugun, P: Pf, SP, A: A.L, MJ: A.MJ, NOM, I, K, TS: TSn, SN, TQ, X: Xj, YX, B, SR, H: await monHujjatSvod(bugun, A.MJ, HJ), TH, TOP, XD };
}

// ------------------------------------------------------------------ 1. NAVBAT
function monNavbat(D) {
  const Pr = D.P.royxat, bugun = D.bugun, Sp = D.SP;
  const el = (x, q, a, ekstra) => Object.assign({ no: x.no, fish: monQisqa(x.fish), dokon: x.dokon || '', jami: Number(x.jami) || 0, q: q || '', a: a || 'und' }, ekstra || {});
  const qator = (k, t, R) => ({ k, t, n: R.length, summa: R.reduce((a, r) => a + (Number(r.jami) || 0), 0), royxat: R });
  const dmy = iso => iso ? String(iso).split('-').reverse().join('.') : '';
  const Qz = [], Y = [], O = [];
  const davoO = Pr.filter(x => x.davoOtgan), davoX = Pr.filter(x => x.davoXavf);
  Qz.push(qator('davo_otgan', "Da'vo muddati o'tgan", davoO.map(x => el(x, 'kechikish ' + x.kechikkan + ' kun · ' + (x.undiruvchi || 'biriktirilmagan')))));
  Qz.push(qator('davo_xavf', "Da'vo muddati 90 kundan kam qoldi", davoX.map(x => el(x, x.davoQolgan + ' kun qoldi · ' + (x.undiruvchi || 'biriktirilmagan')))));
  const bOchiq = D.B.filter(monBekorOchiq);
  Qz.push(qator('bekor', 'Bekor qilishga kiritilgan shartnomalar', bOchiq.map(b => ({ no: b.no, fish: monQisqa(b.fish), dokon: b.dokon || '', jami: Number(b.jami) || 0, q: b.holati + ' · ' + (b.kim || ''), a: 'tasdiq' }))));
  const yk = D.I.filter(i => i.holati === 'Tasdiq kutilmoqda');
  Qz.push(qator('yur_sorov', "Yuristga o'tkazish — tasdiq kutmoqda", yk.map(i => { const x = Sp[i.no] || D.NOM[i.no] || {};
    return { no: i.no, fish: monQisqa(x.fish || i.fish), dokon: x.dokon || i.dokon || '', jami: Number(x.jami) || 0, q: (i.undiruvchi || '—') + ' · ' + (i.sorovVaqt || ''), a: 'tasdiq' }; })));
  const og = D.X.map(h => ({ h, kun: X.xatKechikkan(h, bugun) })).filter(o => o.kun > 0);
  Qz.push(qator('xat_og', 'Yetkazilmagan ogohlantirish xatlari (OG)', og.map(o => { const x = D.NOM[o.h.no] || {};
    return { no: o.h.no, fish: monQisqa(x.fish), dokon: x.dokon || '', jami: Number(x.muddati) || 0, q: o.h.raqam + ' · ' + o.kun + ' kun · ' + (o.h.kim || ''), a: 'xat', raqam: o.h.raqam }; })));
  const yu = D.YX.filter(h => h.holati === 'Tayyorlandi').map(h => ({ h, kun: kun(X.xatIso(h.sana), bugun) })).filter(o => o.kun >= 1);
  Qz.push(qator('xat_yu', 'Yetkazilmagan yuridik xatlar (YU)', yu.map(o => { const x = D.NOM[o.h.no] || {};
    return { no: o.h.no, fish: monQisqa(o.h.fish || x.fish), dokon: x.dokon || '', jami: Number(x.jami) || 0, q: o.h.raqam + ' · ' + o.kun + ' kun · ' + (o.h.kim || ''), a: 'yurist', id: o.h.ishId }; })));
  const kech = D.I.filter(i => Q.YU_FAOL.indexOf(i.holati) >= 0).map(i => Q.yuKorinish(i, Sp[i.no] || D.NOM[i.no], bugun, D.K)).filter(k => k.kechikdi > 0);
  Qz.push(qator('yur_kech', 'Yurist kechiktirgan ishlar', kech.filter(k => k.yuMas).map(k => ({ no: k.no, fish: monQisqa(k.fish), dokon: k.dokon || '', jami: Number(k.jami) || 0, q: k.keyingi + ' · ' + k.kechikdi + ' kun', a: 'yurist', id: k.id }))));
  const tsK = (D.TS || []).filter(it => it.tasdiqchi === 'yurist' && it.kech);
  Qz.push(qator('yu_tasdiq', "🔎 Yurist tekshirmagan isbotlar (muddati o'tgan)", tsK.map(it => { const x = D.NOM[it.no] || Sp[it.no] || {};
    return { no: it.no || '—', fish: monQisqa(x.fish || ''), dokon: x.dokon || '', jami: 0, q: it.nomi + ' · ' + (it.kim || '') + ' · muddat ' + dmy(String(it.muddat).slice(0, 10)), a: 'ts', id: it.k }; })));
  const tk = {}; (D.TOP || []).filter(t => t.kechikkan && t.kimga).forEach(t => { (tk[t.kimga] = tk[t.kimga] || []).push(t); });
  Qz.push(qator('top_kech', "Muddati o'tgan topshiriqlar (xodimlar)", Object.keys(tk).map(f => { const L = tk[f];
    const eski = Math.max.apply(null, L.map(t => kun(TS.topIso(t.muddat).slice(0, 10), bugun)));
    return { no: L.length + ' ta', fish: f, dokon: '', jami: 0, q: 'eng eskisi ' + eski + ' kun · ' + L.slice(0, 3).map(t => (t.no ? t.no + ' ' : '') + String(t.sarlavha).slice(0, 40)).join('; ') + (L.length > 3 ? ' …' : ''), a: 'top', soni: L.length, eski };
  }).sort((a, b) => b.eski - a.eski)));
  Qz.push(qator('vada', "Va'dasi bugun tugaydi", Pr.filter(x => x.bugunVada).map(x => el(x, "va'da " + monPul(x.vada.summa) + " so'm · " + (x.undiruvchi || '')))));
  // 🟡
  Y.push(qator('skan', D.H.kun + " kundan beri skani yo'q yangi shartnomalar", D.H.nusxasiz.map(x => ({ no: x.no, fish: monQisqa(x.fish), dokon: x.dokon || '', jami: 0, q: x.kun + ' kun · tuzdi: ' + (x.kim || '—'), a: 'hujjat' }))));
  const bNo = {}; bOchiq.forEach(b => { bNo[b.no] = true; });
  Y.push(qator('bosh', "Boshlang'ich to'lovi muddatida kelmagan (to'lov umuman yo'q)", Pr.filter(x => x.tolovSoni === 0 && x.boshOtgan && x.jami > 0 && !bNo[x.no])
    .map(x => el(x, 'shartnoma ' + dmy(x.sana) + ' · muddat ' + x.boshKun + ' kun · ' + (x.undiruvchi || 'biriktirilmagan')))));
  Y.push(qator('jim', P.UND_JIM_KUN + " kundan beri chora ko'rilmagan qarzdorlar", Pr.filter(x => x.muddati > 0 && x.jimKun >= P.UND_JIM_KUN)
    .map(x => el(x, (x.jimKun >= 9999 ? "hech chora yo'q" : x.jimKun + ' kun jim') + ' · ' + (x.undiruvchi || 'biriktirilmagan')))));
  Y.push(qator('novatsiya', "Novatsiya nomzodlari (da'vo muddati o'tgan — yangi shartnoma yo'li)", davoO.map(x => el(x, "to'langan " + monPul(x.tolangan) + " · qarz " + monPul(x.jami)))));
  const OB = {}; (D.TOP || []).forEach(t => { if (/^olib\|/.test(String(t.kalit || '')) && (t.holati === 'Jarayonda' || t.holati === 'Tekshiruvda')) OB[t.no] = t; });
  Y.push(qator('xavf', "🔥 Undirish imkoni kam — xavfli qarzdorlar", Pr.filter(x => x.xavf && x.xavf.length).sort((a, b) => (Number(b.muddati) || 0) - (Number(a.muddati) || 0))
    .map(x => Object.assign(el(x, x.xavf.join('; ') + ' · ' + (x.undiruvchi || ''), 'sud'), { jami: Number(x.muddati) || 0 }))));
  Y.push(qator('sud_kech', "Sud / MIB bosqichi cho'zilmoqda", kech.filter(k => !k.yuMas).map(k => ({ no: k.no, fish: monQisqa(k.fish), dokon: k.dokon || '', jami: Number(k.jami) || 0, q: k.keyingi + ' · ' + k.kechikdi + ' kun', a: 'yurist', id: k.id }))));
  Y.push(qator('skan_naz', "🗂 Yangi shartnoma skanlari — ixtiyoriy nazorat", (D.SN || []).map(it => { const x = D.NOM[it.no] || Sp[it.no] || {};
    return { no: it.no, fish: monQisqa(x.fish || it.mijoz || ''), dokon: x.dokon || '', jami: 0, q: 'yukladi: ' + (it.kim || '') + ' · ' + dmy(String(it.vaqt).slice(0, 10)), a: 'tsn', id: it.k }; })));
  Y.push(qator('yu_rad', "✖ Yurist qaytargan isbotlar — qaroringiz kutilmoqda", (D.TQ || []).map(q => { const x = D.NOM[q.no] || Sp[q.no] || {}, m = q.m || {};
    return { no: q.no || '—', fish: monQisqa(x.fish || m.mijoz || ''), dokon: x.dokon || '', jami: 0, q: (m.nomi || '') + ' · «' + q.sabab + '» · ' + dmy(String(q.vaqt).slice(0, 10)), a: 'tq', id: q.id }; })));
  Y.push(qator('sekin', "🐢 Sekin to'lovchilar — shartnomani qayta tuzishga chaqiring", Pr.filter(x => x.sekin).sort((a, b) => b.sekin.oy - a.sekin.oy)
    .map(x => { const t = OB[x.no]; return el(x, "shu sur'atda " + (x.sekin.oy >= 120 ? Math.round(x.sekin.oy / 12) + ' yilda' : x.sekin.oy + ' oyda') + ' · 12 oyda ' + monPul(x.sekin.s12) + ' · ' + (x.undiruvchi || 'biriktirilmagan')
      + (t ? ' · 📌 ' + (t.holati === 'Tekshiruvda' ? 'olib keldim dedi — tasdiqlang' : 'topshiriq berilgan, muddat ' + t.muddat) : ''), 'sud'); })));
  // ⚪
  const A = D.A;
  O.push(qator('jshshir', "JSHSHIR yo'q yoki 14 raqam emas", A.filter(x => !x.jshshir).map(x => el(x, x.mijozBor ? 'mijoz ID ' + x.mid : '02_Mijozlar da topilmadi (ID ' + x.mid + ')', 'info'))));
  O.push(qator('ota', "Otasining ismi yo'q", A.filter(x => x.mijozBor && !x.ota).map(x => el(x, 'mijoz ID ' + x.mid, 'info'))));
  O.push(qator('tel', "Telefon raqami yo'q", A.filter(x => x.mijozBor && !x.tel).map(x => el(x, 'mijoz ID ' + x.mid, 'info'))));
  O.push(qator('notarial', "To'lovi tugagan, notarial sanasi kiritilmagan", A.filter(x => !(x.jami > 0) && !x.notarial).map(x => el(x, "to'langan " + monPul(x.tolangan), 'info'))));
  return { qizil: Qz, sariq: Y, oq: O };
}

// ------------------------------------------------------------------ 2. TASDIQLAR
function monTasdiqlar(D) {
  const Sp = D.SP, bugun = D.bugun;
  const kor = i => Q.yuKorinish(i, Sp[i.no] || D.NOM[i.no], bugun, D.K);
  const yurist = D.I.filter(i => i.holati === 'Tasdiq kutilmoqda').map(i => Object.assign(kor(i), { sabab: i.sorovSabab, und: i.undiruvchi, vaqt: i.sorovVaqt }));
  const yopish = D.I.filter(i => i.holati === "Yopish so'ralgan").map(kor);
  const sorovlar = D.SR.filter(x => x.holati === 'Kutilmoqda').map(x => {
    const o = Object.assign({}, x, { turNomi: MON_SOROV_TUR[x.tur] || x.tur });
    if (x.tur === 'xat_bekor') { const h = D.X.find(z => z.raqam === x.kalit); const m = h ? (D.NOM[h.no] || {}) : {};
      o.izoh2 = h ? (h.no + ' · ' + monQisqa(m.fish) + ' · ' + h.sana + ' · holati: ' + h.holati) : 'xat topilmadi'; }
    if (x.tur === 'tahrir') { const m = D.NOM[x.kalit] || {}; o.izoh2 = [monQisqa(m.fish), m.dokon].filter(Boolean).join(' · '); }
    return o; });
  return { yurist, yopish, bekor: D.B.filter(monBekorOchiq), sorovlar };
}

// ------------------------------------------------------------------ 3. XODIMLAR
async function monXodimlar(D) {
  const bugun = D.bugun, Pr = D.P.royxat, bDmy = monDmy(bugun);
  const kunlar = monKunlar(bugun, MON_HAFTA);
  const [K, E, Jr, OF] = await Promise.all([monKirishlar(kunlar), monErtalabOqi(kunlar), J.undJurnal(), monOfisBugun(bugun, D.H.jurnal)]);
  const huq = (x, h) => x.huquq.indexOf(h) >= 0;
  const kirish = (fish, sana) => (K[fish] && K[fish][sana]) || null;
  const undiruvchilar = D.XD.filter(x => x.ishlayapti && huq(x, 'undiruv') && !huq(x, 'admin')).map(x => {
    const L = Pr.filter(z => z.undiruvchi === x.fish);
    const san = d => L.filter(z => z.buyruq.some(b => b.d === d)).length;
    const choraBugun = Jr.filter(j => j.kim === x.fish && j.sana === bugun);
    const turlar = {}; choraBugun.forEach(j => { turlar[j.chora] = (turlar[j.chora] || 0) + 1; });
    const meniki = h => (D.NOM[h.no] || {}).undiruvchi === x.fish;
    const e = (E[bugun] && E[bugun][x.fish]) || null;
    return {
      fish: x.fish, ism: x.ism, tg: x.tg, tel: x.tel,
      kirish: kirish(x.fish, bugun),
      ertalab: e, hozir: { q: san('q'), s: san('s'), y: san('y') },
      portfel: L.length, muddati: L.reduce((a, z) => a + (Number(z.muddati) || 0), 0),
      chora: { jami: choraBugun.length, turlar },
      xatChiqardi: D.X.filter(h => h.kim === x.fish && X.xatIso(h.sana) === bugun && h.holati !== 'Bekor').length,
      xatYetkazdi: D.X.filter(h => meniki(h) && h.holati === 'Yuborildi' && h.yetSana === bDmy).length,
      xatKechikkan: D.X.filter(h => meniki(h) && X.xatKechikkan(h, bugun) > 0).length,
      yuSorov: D.I.filter(i => i.undiruvchi === x.fish && i.holati === 'Tasdiq kutilmoqda').length,
      bekorHujjat: D.B.filter(b => b.kim === x.fish && b.hujjatKechikdi).length,
      hafta: kunlar.map(d => { const k = kirish(x.fish, d), ee = (E[d] && E[d][x.fish]) || null;
        return { sana: d, kir: k ? k.birinchi : '', q: ee ? ee.q : null, s: ee ? ee.s : null,
          chora: Jr.filter(j => j.kim === x.fish && j.sana === d).length,
          xat: D.X.filter(h => h.kim === x.fish && X.xatIso(h.sana) === d && h.holati !== 'Bekor').length }; })
    };
  });
  const ofis = D.XD.filter(x => x.ishlayapti && !huq(x, 'admin') && !huq(x, 'undiruv'))
    .map(x => { const o = OF[x.fish] || {};
      return { fish: x.fish, ism: x.ism, tg: x.tg, huquq: x.huquq.join(', '), kirish: kirish(x.fish, bugun),
        tolov: o.tolov || { soni: 0, summa: 0 }, tashrif: o.tashrif || 0, shartnoma: o.shartnoma || 0, hujjat: o.hujjat || 0,
        hafta: kunlar.map(d => { const k = kirish(x.fish, d); return { sana: d, kir: k ? k.birinchi : '' }; }) }; });
  return { kunlar, undiruvchilar, ofis };
}

// ------------------------------------------------------------------ 4. NAZORAT JURNALLARI
function monJurnallar(D) {
  const bugun = D.bugun;
  const xatlar = D.X.map(h => { const x = D.NOM[h.no] || {}; return { raqam: h.raqam, no: h.no, fish: monQisqa(x.fish), und: x.undiruvchi || '', sana: h.sana, holati: h.holati, kim: h.kim, kun: X.xatKechikkan(h, bugun) }; })
    .filter(h => h.kun > 0).sort((a, b) => b.kun - a.kun);
  const tgYoq = D.XD.filter(x => x.ishlayapti && x.kodBor && !x.tg).map(x => ({ fish: x.fish, tel: x.tel }));
  const birikmagan = D.P.royxat.filter(x => !x.undiruvchi && x.jami > 0).map(x => ({ no: x.no, fish: monQisqa(x.fish), dokon: x.dokon, jami: x.jami, muddati: x.muddati }));
  const bekorHujjat = D.B.filter(b => b.hujjatKechikdi);
  return { xatlar, hujjat: { nusxasiz: D.H.nusxasiz, arxiv: D.H.arxiv, kun: D.H.kun }, tgYoq, birikmagan, bekorHujjat,
    tahrir: D.TH.slice(0, 30), sorovlar: D.SR.filter(x => x.holati === 'Kutilmoqda').length };
}

// ------------------------------------------------------------------ asosiy chaqiriq
async function monBoshlang([kodSes]) {
  const u = await S.ruxsat(kodSes, 'admin');
  const bugun = V.bugun();
  const Pf = await P.undPortfel(() => true, u.kod);
  const D = await monMalumot(bugun, Pf, u.kod);
  return { bugun, navbat: monNavbat(D), tasdiqlar: monTasdiqlar(D), xodimlar: await monXodimlar(D), jurnallar: monJurnallar(D), turlar: MON_SOROV_TUR };
}

module.exports = { monBoshlang };
module.exports._ichki = { monAktiv, monMalumot, monXodimlar, monNavbat, monTasdiqlar, monJurnallar, bekorSorovlar, monXodimlarRoyxat, monHujjatSvod, monOfisBugun, monKirishlar, monErtalabOqi };   // aks-olchov uchun
