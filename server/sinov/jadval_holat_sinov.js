// node sinov/jadval_holat_sinov.js — lib/jadval_holat.js ning 8 ta holati
const { jadvalHolat, tolovOldindan } = require('../lib/jadval_holat');
const assert = require('assert');
const Q = [{ tartib: 0, sana: '2026-08-24', summa: 30035000 }, { tartib: 1, sana: '2026-09-01', summa: 4463000 }, { tartib: 2, sana: '2026-10-01', summa: 4463000 }, { tartib: 3, sana: '2026-11-01', summa: 4463000 }, { tartib: 4, sana: '2026-12-01', summa: 4463000 }];
const P = { qatorlar: Q, bugun: '2026-11-19', qiymat: 47887000, umumiy: 47887000 };
let n = 0; const ok = (m) => { n++; console.log('  ✓', m); };
// 1. to'lovsiz: boshlang'ich + 3 oylik kechikkan, 4-si kutilmoqda
let r = jadvalHolat({ ...P, tolovlar: [] });
assert.deepStrictEqual(r.qatorlar.map(q => q.holat), ['kechikkan', 'kechikkan', 'kechikkan', 'kechikkan', 'kutilmoqda']); assert.strictEqual(r.muddatiOtgan, 30035000 + 3 * 4463000); assert.strictEqual(r.kechikkanKun, 87); ok("to'lovsiz: 4 kechikkan, muddati o'tgan = 43 424 000, 87 kun");
// 2. BirManzil videodagi: 31 035 000 → boshlang'ich to'liq + 1-to'lov qisman (1 000 000)
r = jadvalHolat({ ...P, tolovlar: [{ id: '1', sana: '2026-08-01', summa: 31035000 }] });
assert.strictEqual(r.tolovlar[0].yopdi, "Boshlang'ich — 30 035 000 (yopildi) · 1-to'lov — 1 000 000 (qisman)"); assert.strictEqual(r.qatorlar[0].holat, 'oldindan'); assert.strictEqual(r.qatorlar[1].holat, 'qisman'); assert.strictEqual(r.qatorlar[1].qoldiq, 3463000); ok('31 035 000 → boshlang\'ich (oldindan) + 1-to\'lov qisman, qoldiq 3 463 000');
// 3. ikkinchi to'lov 4 000 000 → 1-to'lov qisman (3 463 000) + 2-to'lov qisman (537 000)
r = jadvalHolat({ ...P, tolovlar: [{ id: '1', sana: '2026-08-01', summa: 31035000 }, { id: '2', sana: '2026-08-24', summa: 4000000 }] });
assert.strictEqual(r.tolovlar[1].yopdi, "1-to'lov — 3 463 000 (yopildi) · 2-to'lov — 537 000 (qisman)"); assert.strictEqual(r.qatorlar[2].tolandi, 537000); assert.strictEqual(r.keyingi.nom, "2-to'lov"); assert.strictEqual(r.keyingi.summa, 3926000); ok("4 000 000 → 1-to'lov yopildi, 2-to'lov qisman; keyingi = 2-to'lov 3 926 000");
// 4. jami ko'rsatkichlar bazadagi formulaga mos: muddati o'tgan = Σ(≤bugun) − tolangan
assert.strictEqual(r.muddatiOtgan, (30035000 + 3 * 4463000) - 35035000); ok("muddati o'tgan = 8 389 000 (AF formulasi)");
// 5. ortiqcha to'lov jadvaldan tashqarida
r = jadvalHolat({ ...P, tolovlar: [{ id: '1', sana: '2026-08-01', summa: 60000000 }] });
assert.strictEqual(r.tolovlar[0].ortiqcha, 60000000 - 47887000); assert.strictEqual(r.keyingi, null); assert.strictEqual(r.muddatiOtgan, 0); assert.strictEqual(r.progress, 1); ok("ortiqcha to'lov: jadval to'liq, keyingi yo'q, progress 100%");
// 6. yaxlitlash chegarasi: 500 so'm kam — baribir to'landi
r = jadvalHolat({ ...P, tolovlar: [{ id: '1', sana: '2026-08-20', summa: 30034500 }] });
assert.strictEqual(r.qatorlar[0].holat, 'oldindan'); assert.strictEqual(r.kechikkanKun, 79); ok('500 so\'m kam — qator to\'langan hisoblanadi; kechikkan kun 1-to\'lovdan (79)');
// 7. oldindan ko'rish: 10 000 000 kiritilsa nimani yopadi
const o = tolovOldindan({ ...P, tolovlar: [{ id: '1', sana: '2026-08-01', summa: 31035000 }] }, 10000000, '2026-11-19');
assert.strictEqual(o.yopdi, "1-to'lov — 3 463 000 (yopildi) · 2-to'lov — 4 463 000 (yopildi) · 3-to'lov — 2 074 000 (qisman)"); assert.strictEqual(o.keyin.muddatiOtgan, 2389000); ok("oldindan: 10 000 000 → 1,2 to'liq, 3 qisman; muddati o'tgan 12 389 000 → 2 389 000");
// 8. bufer to'lov ham hisobga kiradi (AB formulasi)
r = jadvalHolat({ ...P, tolovlar: [{ id: 'b1', sana: '2026-09-10', summa: 30035000, bufer: true }] });
assert.strictEqual(r.jamiTolangan, 30035000); assert.strictEqual(r.qatorlar[0].holat, 'tolandi'); ok('bufer («Буферда») to\'lov jami to\'langanga kiradi');
console.log('jadval_holat: ' + n + ' ta sinov o\'tdi');
