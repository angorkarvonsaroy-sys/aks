// AKS TIZIM — 🏠 DIREKTOR BOSH SAHIFASI (Bosh.gs v1.3 boshMalumot) va 📊 hisobot hisobi (Hisobot.gs v27.10 hisobotHisobla_, hisobotMalumot) serverda.
// Natija eski tizim bilan bir xil. boshRejaYoz (08_Lugatlar!Z4 ga yozadi) — hali ko'prik.
'use strict';
const S = require('./sessiya');
const V = require('../lib/varaq');
const U = require('../lib/undiruv_yordam');
const P = require('../lib/portfel');
const KR = require('../lib/korinish');   // shartnoma holati bo'yicha ko'rinish (18.10.2026)

const BOSH_REJA_USTUN = 26, BOSH_PASPORT_KUN = 30, BOSH_BEPUL_KUN = 30;
const num = x => { const n = Number(x); return isNaN(n) ? 0 : Math.round(n); };   // Kod.gs num_
const s = v => String(v == null ? '' : v);
const qosh = U.kunQosh;
const dmy = iso => iso ? String(iso).split('-').reverse().join('.') : '';
const haftaKuni = iso => { const d = new Date(iso + 'T12:00:00Z').getUTCDay(); return d === 0 ? 7 : d; };   // 1 = dushanba (Utilities 'u')

// ------------------------------------------------------------------ Hisobot.gs hisobotHisobla_
async function hisobotHisobla(bosh, oxir) {
  const ichida = v => { const d = V.iso(v); return !!d && d >= bosh && d <= oxir; };
  const tol = { jami: 0, soni: 0, shakl: {}, kim: {}, katta: [] };
  (await V.qatorlar('05_Tolovlar')).forEach(({ x: r }) => {
    if (r[0] == null || r[0] === '' || !ichida(r[1])) return;
    const sm = num(r[3]); tol.jami += sm; tol.soni++;
    const sh = s(r[4]) || '—'; tol.shakl[sh] = (tol.shakl[sh] || 0) + sm;
    const k = s(r[9]) || '—'; tol.kim[k] = (tol.kim[k] || 0) + 1;
    tol.katta.push([sm, s(r[2]), s(r[13])]);
  });
  tol.katta.sort((a, b) => b[0] - a[0]); tol.katta = tol.katta.slice(0, 5);
  const sot = { soni: 0, qiymat: 0, royxat: [], bekor: [] };
  (await V.qatorlar('03_Sotuv_shartnomalar')).forEach(({ x: r }) => {
    if (r[0] == null || r[0] === '') return;
    if (/QAYTA TUZ(ISH|ILDI)/i.test(s(r[19]))) return;
    if (ichida(r[2]) && r[13] !== 'Bekor qilindi') { sot.soni++; sot.qiymat += num(r[25]); sot.royxat.push(s(r[0]) + ' · ' + s(r[5]) + ' · ' + s(r[20])); }
    if (ichida(r[14])) sot.bekor.push(s(r[0]) + ' · ' + s(r[5]));
  });
  const ij = { soni: 0, royxat: [], bekor: [] };
  (await V.qatorlar('04_Ijara_shartnomalar')).forEach(({ x: r }) => {
    if (r[0] == null || r[0] === '') return;
    if (ichida(r[1])) { ij.soni++; ij.royxat.push(s(r[0]) + ' · ' + s(r[4]) + ' · ' + s(r[23])); }
    if (ichida(r[3])) ij.bekor.push(s(r[0]) + ' · ' + s(r[4]));
  });
  const tash = { soni: 0, jamiYozuv: 0, maqsad: {}, kim: {}, shartnoma: 0 };
  (await V.qatorlar('01b_Tashrif_jurnali')).forEach(({ x: r }) => {
    if (r[0] == null || r[0] === '' || !ichida(r[1])) return;
    tash.jamiYozuv++;
    const k = s(r[8]) || '—'; tash.kim[k] = (tash.kim[k] || 0) + 1;
    if (!(r[14] === true || Number(r[14]) === 1)) return;
    tash.soni++;
    const m = (s(r[6]) || '—').replace(' масаласида', ''); tash.maqsad[m] = (tash.maqsad[m] || 0) + 1;
    if (r[12] === true || s(r[12]).toLowerCase() === 'ha' || Number(r[12]) === 1) tash.shartnoma++;
  });
  const buf = { soni: 0, jami: 0, muddatiOtgan: 0, muddatiOtganSumma: 0 };
  (await V.qatorlar('05b_Bufer_tolovlar')).forEach(({ x: r }) => {
    if (r[0] == null || r[0] === '' || s(r[6]) !== 'Буферда') return;
    buf.soni++; buf.jami += num(r[3]);
    if (/MUDDATI O'TDI/i.test(s(r[11]))) { buf.muddatiOtgan++; buf.muddatiOtganSumma += num(r[3]); }
  });
  const dok = await dokonlar();
  return { bosh, oxir, tol, sot, ij, tash, buf, dok };
}
// 01_Dokonlar: 2..641-qatorlar, Z ustuni (holat); bo'sh katak — «Bo'sh». Eski kod aynan 640 qator o'qiydi (bo'sh qatorlar ham sanaladi).
async function dokonlar() {
  const R = await V.qatorlar('01_Dokonlar'); const bor = {}; R.forEach(({ n, x }) => { bor[n] = x; });
  const dok = {};
  for (let n = 2; n <= 641; n++) { const x = bor[n] || []; const h = s(x[25]) || "Bo'sh"; dok[h] = (dok[h] || 0) + 1; }
  return dok;
}
function davrChegara(davr, bugun) {
  const kecha = qosh(bugun, -1), hk = haftaKuni(bugun);
  const hafta = qosh(bugun, -(hk - 1)), oy = bugun.slice(0, 8) + '01';
  if (davr === 'kecha') return [kecha, kecha, 'Kecha'];
  if (davr === 'hafta') return [hafta, bugun, 'Shu hafta'];
  if (davr === 'oy') return [oy, bugun, 'Shu oy'];
  return [bugun, bugun, 'Bugun'];
}
async function hisobotMalumot([kodSes, davr]) {
  const u = await S.ruxsat(kodSes, 'hisobot');
  const bugun = V.bugun();
  const [b, o, nom] = davrChegara(davr, bugun);
  const h = await hisobotHisobla(b, o); h.nom = nom;
  if (!u.admin) delete h.buf;
  const Y = await KR.yopiqlar(u);   // yashirin shartnomalar ro'yxatlardan olinadi; jami summalar o'zgarmaydi
  if (Y.size) { const no = t => String(t).split(' · ')[0].trim();
    h.tol.katta = h.tol.katta.filter(x => !Y.has(String(x[1]).trim()));
    ['royxat', 'bekor'].forEach(k => { h.sot[k] = h.sot[k].filter(t => !Y.has(no(t))); h.ij[k] = h.ij[k].filter(t => !Y.has(no(t))); }); }
  const [hb, ho] = davrChegara('hafta', bugun); const [ob, oo] = davrChegara('oy', bugun);
  h.haftaTushum = davr === 'hafta' ? h.tol.jami : (await hisobotHisobla(hb, ho)).tol.jami;
  h.oyTushum = davr === 'oy' ? h.tol.jami : (await hisobotHisobla(ob, oo)).tol.jami;
  return h;
}

// ------------------------------------------------------------------ Bosh.gs boshMalumot
function boshOyOldin(bugun, n) { const y = Number(bugun.slice(0, 4)), m = Number(bugun.slice(5, 7)) - 1 - n; const d = new Date(Date.UTC(y, m, 1)); return d.toISOString().slice(0, 7) + '-01'; }
function boshOyOldinShuKun(bugun) {
  const y = Number(bugun.slice(0, 4)), m = Number(bugun.slice(5, 7)) - 1, k = Number(bugun.slice(8, 10));
  const oxir = new Date(Date.UTC(y, m, 0)).getUTCDate(); const d = new Date(Date.UTC(y, m - 1, Math.min(k, oxir)));
  return d.toISOString().slice(0, 10);
}
async function boshMalumot([kodSes, davr]) {
  const u = await S.ruxsat(kodSes, 'admin');
  const bugun = V.bugun();
  davr = ['bugun', 'hafta', 'oy'].indexOf(davr) >= 0 ? davr : 'bugun';
  const kun = n => qosh(bugun, n);
  const hk = haftaKuni(bugun);
  const haftaBosh = kun(-(hk - 1)), oyBosh = bugun.slice(0, 8) + '01';
  const qisq = f => String(f || '').trim().split(/\s+/).slice(0, 2).join(' ');
  // ---------- undiruv portfeli
  const Pf = await P.undPortfel(() => true, u.kod); const L = Pf.royxat;
  const el = x => ({ no: x.no, fish: qisq(x.fish), dokon: x.dokon || '', kechikkan: Number(x.kechikkan) || 0, qolgan: Number(x.davoQolgan) || 0,
    jami: Number(x.jami) || 0, undiruvchi: qisq(x.undiruvchi || ''), chora: x.oxirgi ? dmy(x.oxirgi.sana) : '', jim: x.jimKun === 9999 ? '' : x.jimKun, yurist: !!x.yuSorov });
  const dOt = L.filter(x => x.davoOtgan).sort((a, b) => b.kechikkan - a.kechikkan);
  const dXv = L.filter(x => x.davoXavf).sort((a, b) => a.davoQolgan - b.davoQolgan);
  const top = L.filter(x => (Number(x.jami) || 0) > 0).sort((a, b) => (Number(b.jami) || 0) - (Number(a.jami) || 0));
  const yosh = { y1: 0, y2: 0, y3: 0, y4: 0, s1: 0, s2: 0, s3: 0, s4: 0 };
  L.filter(x => (Number(x.muddati) || 0) > 0).forEach(x => { const k = Number(x.kechikkan) || 0, sm = Number(x.muddati) || 0;
    if (k > 365) { yosh.y4++; yosh.s4 += sm; } else if (k > 180) { yosh.y3++; yosh.s3 += sm; } else if (k > 30) { yosh.y2++; yosh.s2 += sm; } else { yosh.y1++; yosh.s1 += sm; } });
  const muddatiJami = L.reduce((a, x) => a + (Number(x.muddati) || 0), 0);
  // ---------- davr tushumi va taqqoslash
  const davrlar = { bugun: [bugun, bugun, kun(-1), kun(-1), 'kechagidan'],
    hafta: [haftaBosh, bugun, kun(-(hk - 1) - 7), kun(-7), "o'tgan hafta shu kunga"],
    oy: [oyBosh, bugun, boshOyOldin(bugun, 1), boshOyOldinShuKun(bugun), "o'tgan oy shu kunga"] };
  const dv = davrlar[davr];
  const H = await hisobotHisobla(dv[0], dv[1]), HO = await hisobotHisobla(dv[2], dv[3]);
  const oyH = davr === 'oy' ? H : await hisobotHisobla(oyBosh, bugun), oyO = davr === 'oy' ? HO : await hisobotHisobla(boshOyOldin(bugun, 1), boshOyOldinShuKun(bugun));
  // ---------- 6 oy
  const oylar = [], M = {}; const OY = ['yan', 'fev', 'mar', 'apr', 'may', 'iyn', 'iyl', 'avg', 'sen', 'okt', 'noy', 'dek'];
  const y0 = Number(bugun.slice(0, 4)), m0 = Number(bugun.slice(5, 7)) - 1;
  for (let i = 5; i >= 0; i--) { const d = new Date(Date.UTC(y0, m0 - i, 1)); const k = d.toISOString().slice(0, 7); M[k] = 0; oylar.push({ k, oy: OY[d.getUTCMonth()] }); }
  (await V.qatorlar('05_Tolovlar')).forEach(({ x: r }) => { if (r[0] == null || r[0] === '') return; const d = V.iso(r[1]); if (!d) return; const k = d.slice(0, 7); if (k in M) M[k] += num(r[3]); });
  const lg = (await V.qatorlar('08_Lugatlar')).find(q => q.n === 4);
  const reja = lg ? Number(lg.x[BOSH_REJA_USTUN - 1]) || 0 : 0;
  // ---------- do'konlar
  const dok = await dokonlar();
  const dokJami = Object.keys(dok).reduce((a, k) => a + dok[k], 0);
  // ---------- shartnomalar oqimi + bepul davri + aktiv mijozlar
  const oqim = [], bekor = [], bepul = [], aktivMid = {};
  (await V.qatorlar('03_Sotuv_shartnomalar')).forEach(({ x: r }) => { if (r[0] == null || r[0] === '') return; const sana = V.iso(r[2]);
    if (!/bekor/i.test(s(r[13]))) aktivMid[s(r[4])] = 1;
    const qt = /QAYTA TUZ(ISH|ILDI)/i.test(s(r[19]));
    if (sana >= haftaBosh && !/bekor/i.test(s(r[13]))) oqim.push({ sana: dmy(sana), no: s(r[0]), tur: qt ? 'qayta tuzish' : 'sotuv', dokon: s(r[5]), fish: qisq(r[20]), kim: qisq(r[41] || ''), qiymat: num(r[25]) });
    if (V.iso(r[14]) >= haftaBosh && V.iso(r[14]) && !qt) bekor.push({ sana: dmy(V.iso(r[14])), no: s(r[0]), tur: 'sotuv', dokon: s(r[5]), fish: qisq(r[20]) }); });
  (await V.qatorlar('04_Ijara_shartnomalar')).forEach(({ x: r }) => { if (r[0] == null || r[0] === '') return; const sana = V.iso(r[1]), bek = /bekor/i.test(s(r[2]));
    if (!bek) aktivMid[s(r[5])] = 1;
    if (sana >= haftaBosh && !bek) oqim.push({ sana: dmy(sana), no: s(r[0]), tur: 'ijara', dokon: s(r[4]), fish: qisq(r[23]), kim: qisq(r[20] || ''), qiymat: 0, bepul: Number(r[12]) || 0 });
    if (V.iso(r[3]) >= haftaBosh && V.iso(r[3])) bekor.push({ sana: dmy(V.iso(r[3])), no: s(r[0]), tur: 'ijara', dokon: s(r[4]), fish: qisq(r[23]) });
    const bt = V.iso(r[28]); if (!bek && bt && bt >= bugun && bt <= kun(BOSH_BEPUL_KUN)) bepul.push({ no: s(r[0]), dokon: s(r[4]), fish: qisq(r[23]), tugash: dmy(bt), qolgan: U.kun(bugun, bt) }); });
  oqim.sort((a, b) => a.sana.split('.').reverse().join('') < b.sana.split('.').reverse().join('') ? 1 : -1);
  bepul.sort((a, b) => a.qolgan - b.qolgan);
  // ---------- pasporti tugayotgan mijozlar
  const pasport = [];
  (await V.qatorlar('02_Mijozlar')).forEach(({ x: r }) => { if (r[0] == null || r[0] === '' || !aktivMid[s(r[0])]) return; const pm = V.iso(r[10]); if (!pm) return;
    const q = U.kun(bugun, pm); if (q <= BOSH_PASPORT_KUN && q > -3650) pasport.push({ mid: s(r[0]), fish: qisq(r[2]), muddat: dmy(pm), qolgan: q }); });
  pasport.sort((a, b) => a.qolgan - b.qolgan);
  return {
    bugun, davr, davrNom: { bugun: 'Bugun', hafta: 'Shu hafta', oy: 'Shu oy' }[davr], taqqosNom: dv[4],
    kpi: { tushum: H.tol.jami, tolovSoni: H.tol.soni, tushumOldin: HO.tol.jami,
      tashrif: H.tash.soni, shartnoma: H.sot.soni + H.ij.soni, tashrifOldin: HO.tash.soni,
      davoOtgan: { n: dOt.length, summa: dOt.reduce((a, x) => a + (Number(x.jami) || 0), 0) },
      davoXavf: { n: dXv.length, engYaqin: dXv.length ? dXv[0].davoQolgan : null },
      muddati: { jami: muddatiJami, soni: L.filter(x => (Number(x.muddati) || 0) > 0).length },
      bosh: { n: dok["Bo'sh"] || 0, jami: dokJami } },
    davoOtgan: dOt.slice(0, 10).map(el), davoXavf: dXv.slice(0, 10).map(el), top: top.slice(0, 10).map(el), yosh,
    tushum: { oylar: oylar.map(o => ({ oy: o.oy, summa: Math.round(M[o.k]) })), shuOy: oyH.tol.jami, otganOyShuKun: oyO.tol.jami, reja },
    oqim: oqim.slice(0, 12), bekor: bekor.slice(0, 8), bepul: bepul.slice(0, 8),
    buf: H.buf, pasport: pasport.slice(0, 8)
  };
}

module.exports = { boshMalumot, hisobotMalumot };
