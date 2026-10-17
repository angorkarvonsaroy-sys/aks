// AKS TIZIM — 📋 Reyestrlar (Reyestr.gs v27.6) serverda: reyestrIjara, reyestrSotuv — onlayn ro'yxat. Faqat o'qiydi; natija eski tizim bilan bir xil.
// PDF va Excel (reyestrPdf, reyestrExcel, reyestrSotuvPdf, reyestrSotuvExcel) — eski tizimda.
'use strict';
const S = require('./sessiya');
const V = require('../lib/varaq');
const KR = require('../lib/korinish');   // shartnoma holati bo'yicha ko'rinish (18.10.2026)

const REY_SOT_HOLAT = ['Aktiv', 'Kredit asosida', 'Shartnoma olmagan', 'Yakunlangan'];
function aOxiri(rows) { let m = 0; rows.forEach(({ n, x }) => { if (x[0] !== null && x[0] !== undefined && x[0] !== '') m = n; }); return rows.filter(z => z.n <= m); }
const kor = (r, n) => { const o = []; for (let i = 0; i < n; i++) o.push(r[i] == null ? '' : String(r[i])); return o; };
async function mijozlar() {
  const MIJ = {};
  aOxiri(await V.qatorlar('02_Mijozlar')).map(z => kor(z.r, 5)).forEach(r => { if (r[0]) MIJ[String(r[0])] = { fish: r[2], tel: r[4] }; });
  return MIJ;
}

async function reyestrIjara([kodSes]) {
  const u = await S.ruxsat(kodSes, 'reyestr');
  const k = await KR.korish(u);
  const [MIJ, R4] = await Promise.all([mijozlar(), V.qatorlar('04_Ijara_shartnomalar')]);
  const L = [];
  aOxiri(R4).map(z => kor(z.r, 29)).forEach(r => {
    const no = String(r[0] || '').trim(); if (!/^IJ-27\/\d+$/.test(no)) return;
    if (!k(r[2], '', no)) return;
    const m = MIJ[String(r[5]).trim()] || {};
    L.push({ no, sana: r[1], holati: String(r[2] || ''), dokon: String(r[4] || ''), mid: String(r[5] || ''),
      fish: String(r[23] || m.fish || ''), tel: String(r[24] || m.tel || ''),
      bosh: r[9], tugash: r[10], m2: Number(String(r[25]).replace(',', '.').replace(/[^\d.]/g, '')) || 0,
      oylik: Number(String(r[14]).replace(/\D/g, '')) || 0, bepul: Number(String(r[12]).replace(/\D/g, '')) || 0, bepulTugash: String(r[28] || ''),
      faoliyat: String(r[18] || '') });
  });
  L.sort((a, b) => (Number(b.no.replace(/\D/g, '')) || 0) - (Number(a.no.replace(/\D/g, '')) || 0));
  const faol = L.filter(x => !/bekor/i.test(x.holati));
  return { ok: true, royxat: L, admin: u.admin,
    jami: { faol: faol.length, bekor: L.length - faol.length, oylik: faol.reduce((a, x) => a + x.oylik, 0), maydon: Math.round(faol.reduce((a, x) => a + x.m2, 0) * 100) / 100,
      bepul: faol.filter(x => !x.oylik && x.bepul).length } };
}

async function reyestrSotuv([kodSes]) {
  const u = await S.ruxsat(kodSes, 'reyestr');
  const k = await KR.korish(u);
  const [MIJ, R3] = await Promise.all([mijozlar(), V.qatorlar('03_Sotuv_shartnomalar')]);
  const num = v => Number(String(v == null ? '' : v).replace(/\s/g, '').replace(',', '.')) || 0;
  const L = [];
  aOxiri(R3).map(z => kor(z.r, 33)).forEach(r => {
    const no = String(r[0] || '').trim(); if (!/^27\/\d+$/.test(no)) return;
    if (REY_SOT_HOLAT.indexOf(String(r[13] || '').trim()) < 0) return;
    if (!k(r[13], r[17], no)) return;
    const m = MIJ[String(r[4]).trim()] || {};
    L.push({ no, sana: r[2], mid: String(r[4] || ''), dokon: String(r[5] || ''), m2: num(r[6]), holati: String(r[13] || ''), undiruvchi: String(r[17] || ''),
      fish: String(r[20] || m.fish || ''), tel: String(m.tel || ''), qiymat: num(r[25]), oylik: num(r[26]), tolangan: num(r[27]), qarz: num(r[30]), muddati: num(r[31]), kechikkan: num(r[32]) });
  });
  L.sort((a, b) => (Number(b.no.replace(/\D/g, '')) || 0) - (Number(a.no.replace(/\D/g, '')) || 0));
  const f = L, son = {}; L.forEach(x => son[x.holati] = (son[x.holati] || 0) + 1);
  return { ok: true, royxat: L, admin: u.admin, son, yopilmagan: L.filter(x => x.holati !== 'Yakunlangan' && x.qarz <= 0).length, jami: { faol: f.length,
    qiymat: f.reduce((a, x) => a + x.qiymat, 0), tolangan: f.reduce((a, x) => a + x.tolangan, 0), qarz: f.reduce((a, x) => a + x.qarz, 0), muddati: f.reduce((a, x) => a + x.muddati, 0), maydon: Math.round(f.reduce((a, x) => a + x.m2, 0) * 100) / 100 } };
}

module.exports = { reyestrIjara, reyestrSotuv };
