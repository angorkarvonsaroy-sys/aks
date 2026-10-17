// AKS TIZIM — shartnoma tuzish va to'lov bo'limlarining o'qish amallari serverda (Kod.gs v9.7; natija eski tizim bilan bir xil):
//   shartnomaBoshlang (forma uchun ro'yxatlar) · bugungiTolovlar (bugun kiritilgan to'lovlar)
// Saqlash (shartnomaSaqlash, mijozSaqlash, tolovSaqlash, ijaraSaqlash, tashrifSaqlash) — eski tizimda (ko'prik).
'use strict';
const S = require('./sessiya');
const V = require('../lib/varaq');

const SHARTNOMA_TURLARI = ['Тайёр дўкон (Муддатли тўлов шартномаси)', 'Қурилаётган дўкон (Муддатли тўлов шартномаси)',
  'Тайёр дўкон (100% тўлов шартномаси)', 'Қурилаётган дўкон (100% тўлов шартномаси)'];
const NARX_JADVAL = { 10530000: [15000000, 13000000, 12000000], 12510000: [17820000, 15440000, 14260000],
  13410000: [19100000, 16560000, 15280000], 14310000: [20385000, 17670000, 16310000] };

function aOxiri(rows) { let m = 0; rows.forEach(({ n, x }) => { if (x[0] !== null && x[0] !== undefined && x[0] !== '') m = n; }); return rows.filter(z => z.n <= m); }
const kor = (r, n) => { const o = []; for (let i = 0; i < n; i++) o.push(r[i] == null ? '' : String(r[i])); return o; };
const xom = (x, n) => { const o = []; for (let i = 0; i < n; i++) o.push(x[i] == null ? '' : x[i]); return o; };
function oraliq(rows, bosh, soni) { const M = {}; rows.forEach(z => { M[z.n] = z; }); const o = []; for (let n = bosh; n < bosh + soni; n++) o.push(M[n] || { n, x: [], r: [] }); return o; }

async function shartnomaBoshlang([kodSes]) {
  const u = await S.ruxsat(kodSes, 'shartnoma');
  const [R2, R1b, R1, RL, R4, RH, R3, R7] = await Promise.all(['02_Mijozlar', '01b_Tashrif_jurnali', '01_Dokonlar', '08_Lugatlar', '04_Ijara_shartnomalar', '08b_Hududlar', '03_Sotuv_shartnomalar', '07_Xodimlar'].map(v => V.qatorlar(v)));
  const mijozlar = aOxiri(R2).map(z => kor(z.r, 25)).filter(r => r[0]).map(r => ({
    id: Number(r[0]), fish: r[2], tel: r[4], pasport: r[6], jshshir: r[11], viloyat: r[13], tuman: r[14], mfy: r[15] }));
  const byTel = {};
  for (const r of aOxiri(R1b).map(z => kor(z.r, 7))) {
    if (!r[0] || !r[3]) continue;
    const o = byTel[r[3]] || (byTel[r[3]] = { tel: r[3], soni: 0 });
    o.soni++; o.fish = r[2]; o.manzil = r[4]; o.kasb = r[5]; o.sana = r[1]; o.maqsad = r[6];
  }
  const mijozTel = new Set(mijozlar.map(x => x.tel));
  const tashriflar = Object.values(byTel).filter(x => !mijozTel.has(x.tel));
  const dokonlar = oraliq(R1, 2, 640).map(z => xom(z.x, 26)).filter(r => r[0]).map(r => ({
    id: String(r[0]), blok: String(r[2]), qavat: Number(r[3]), no: Number(r[4]), maydon: Number(r[5]), baza: Number(r[6]),
    umumiy: Number(r[15]), qurilish: String(r[7]), taqiq: String(r[8]) === 'Ha', rais: String(r[11]) === 'Ha', zona: r[16] === '' ? '' : Number(r[16]),
    sotuvNo: String(r[17] || ''), egasi: String(r[18] || ''), ijara: String(r[21] || ''), ijarachi: String(r[22] || '') }));
  const faoliyat = oraliq(RL, 2, 30).map(z => String(xom(z.x, 8)[7] || '')).filter(Boolean);
  let mx4 = 99; for (const z of aOxiri(R4)) { const mm = /^IJ-27\/(\d+)$/.exec(String(z.x[0] || '')); if (mm) mx4 = Math.max(mx4, Number(mm[1])); }
  const hud = oraliq(RH, 2, 210).map(z => xom(z.x, 2)).filter(r => r[0] && r[1]).map(r => [String(r[0]), String(r[1])]);
  let mx = 0; for (const z of aOxiri(R3)) { const mm = /^27\/(\d+)$/.exec(String(z.x[0] || '')); if (mm) mx = Math.max(mx, Number(mm[1])); }
  const undiruvchilar = R7.map(z => String(z.x[14] || '')).filter(Boolean);
  return { mijozlar, tashriflar, dokonlar, hud, keyingi: '27/' + (mx + 1), keyingiIjara: 'IJ-27/' + (mx4 + 1), faoliyat, turlar: SHARTNOMA_TURLARI, undiruvchilar, admin: u.admin, narxJadval: NARX_JADVAL,
    bugun: V.bugun() };
}

async function bugungiTolovlar([kodSes]) {
  const u = await S.ruxsat(kodSes, 'tolov');
  const R = aOxiri(await V.qatorlar('05_Tolovlar'));
  if (!R.length) return { royxat: [], jami: 0 };
  const last = R[R.length - 1].n;
  const bugun = V.bugun().split('-').reverse().join('.');
  const from = Math.max(2, last - 400);
  const v = oraliq(R, from, last - from + 1).map(z => kor(z.r, 14));
  const royxat = v.filter(r => String(r[10]).indexOf(bugun) === 0 && (u.admin || r[9] === u.fish))
    .map(r => ({ id: r[0], sana: r[1], no: r[2], summa: Number(String(r[3]).replace(/[^\d]/g, '')), shakl: r[4], fish: r[13], kim: r[9], vaqt: String(r[10]).slice(11, 16) }));
  return { royxat: royxat.reverse(), jami: royxat.reduce((s, x) => s + x.summa, 0) };
}

module.exports = { shartnomaBoshlang, bugungiTolovlar };
