// AKS TIZIM — ✂ DO'KONNI IKKIGA BO'LISH (direktor qarori 22–24.11.2026, «boshla» 28.11.2026 04:22).
// H-1-2…9, I-1-2…10, I-1-15…23, J-1-1…10 — 36 ta bo'sh do'kon teng ikkiga: H-1-2 → H-1-2A (eski qator) + H-1-2B (yangi qator).
// Dokon_ID «H-1-2A», Dokon_№ «2A» (E ustuni matn bo'lib qoladi — Index va server raqamni \D bilan ajratib tartiblaydi), maydon aniq yarmi,
// baza 10 690 000 (10 530 000 + 160 000 — o'rta devor 5,5 mln hisobidan, 26.11.2026). O izohga belgi. P/Z/AC formulalari yangi qatorga.
// Faqat direktor. Har do'kon tekshiriladi: bor, sotilmagan, sotuv/ijara shartnomasi yo'q, taqiq yo'q, raisga ajratilmagan, bron yo'q,
// ma'muriy emas, allaqachon bo'linmagan. Bittasi o'tmasa — hech narsa yozilmaydi (avval ko'rish: dokonBolishKorish).
// Yozuv: G.yoz (eski qator A/E/F/G/O) + qatorlarQoshR (yangi qatorlar) + 06j jurnali, keyin ko'zgu 01_Dokonlar.
'use strict';
const S = require('./sessiya');
const V = require('../lib/varaq');
const G = require('../lib/google');
const env = require('../lib/env');
const tetik = require('../lib/kozgu_tetik');
const ST = require('./sotuv')._ichki;
const QY = require('./qadam_yoz')._ichki;

const s = v => String(v == null ? '' : v);
const DK_V = '01_Dokonlar', JUR_V = '06j_Tahrir_jurnali';
const BOLISH_BAZA = 10690000;
const kut = (p, ms) => Promise.race([p, new Promise(r => setTimeout(r, ms))]);

// Direktor ro'yxati (24.11.2026)
const ROYXAT = [].concat(
  [2, 3, 4, 5, 6, 7, 8, 9].map(n => 'H-1-' + n),
  [2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => 'I-1-' + n),
  [15, 16, 17, 18, 19, 20, 21, 22, 23].map(n => 'I-1-' + n),
  [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => 'J-1-' + n));

const yoq = v => { const t = s(v).trim(); return !t || /^yo'?q$/i.test(t); };

async function tekshir(ids) {
  const R = await V.qatorlar(DK_V);
  const M = {}; R.forEach(z => { const id = s(z.x[0]).trim(); if (id) M[id.toUpperCase()] = z; });
  const BR = {}; try { (await ST.bronRoyxat(V.bugun())).forEach(z => { if (z.holati === 'Faol' && z.dokon) BR[z.dokon.trim().toUpperCase()] = z; }); } catch (e) { }
  const reja = [], xato = [];
  for (const id0 of ids) {
    const id = s(id0).trim().toUpperCase(); const z = M[id]; const sab = [];
    if (!z) { xato.push(id + ': 01_Dokonlar da yo\'q'); continue; }
    const x = z.x;
    if (M[id + 'A'] || M[id + 'B']) sab.push('allaqachon bo\'lingan (' + id + 'A/B bor)');
    if (/[AB]$/.test(id)) sab.push('bu o\'zi bo\'lak');
    if (s(x[18]).trim() !== 'SOTILMAGAN') sab.push('sotilgan (egasi: ' + s(x[18]) + ')');
    if (s(x[17]).trim()) sab.push('sotuv shartnomasi bor: ' + s(x[17]));
    if (s(x[21]).trim()) sab.push('ijara shartnomasi bor: ' + s(x[21]));
    if (!yoq(x[8])) sab.push('taqiqda: ' + s(x[8]) + (s(x[10]) ? ' (' + s(x[10]) + ')' : ''));
    if (!yoq(x[11])) sab.push('raisga ajratilgan: ' + s(x[11]));
    if (s(x[29]).trim()) sab.push('ma\'muriy xona');
    if (BR[id]) sab.push('faol bron bor');
    const maydon = Number(x[5]) || 0; if (!(maydon > 0)) sab.push('maydon yo\'q');
    if (sab.length) { xato.push(id + ': ' + sab.join('; ')); continue; }
    const yarim = Math.round(maydon / 2 * 1000) / 1000;
    reja.push({ id, qator: z.n, blok: s(x[2]), qavat: s(x[3]), no: s(x[4]), maydon, yarim, bazaEski: Number(x[6]) || 0, baza: BOLISH_BAZA, x: x.slice() });
  }
  return { reja, xato };
}

async function dokonBolishKorish([kodSes, ids]) {
  const u = await S.ruxsat(kodSes, 'admin');
  if (!u.admin) throw new S.Xato('Do\'konni bo\'lish — faqat direktor.');
  const t = await tekshir(Array.isArray(ids) && ids.length ? ids : ROYXAT);
  return { ok: true, baza: BOLISH_BAZA, soni: t.reja.length, xato: t.xato,
    reja: t.reja.map(r => ({ id: r.id, blok: r.blok, qavat: r.qavat, no: r.no, maydon: r.maydon, yarim: r.yarim, bazaEski: r.bazaEski, baza: r.baza, a: r.id + 'A', b: r.id + 'B' })) };
}

async function dokonBolish([kodSes, ids]) {
  const u = await S.ruxsat(kodSes, 'admin');
  if (!u.admin) throw new S.Xato('Do\'konni bo\'lish — faqat direktor.');
  const t = await tekshir(Array.isArray(ids) && ids.length ? ids : ROYXAT);
  if (t.xato.length) throw new S.Xato('Bo\'lib bo\'lmaydi — avval tuzating:\n' + t.xato.join('\n'));
  if (!t.reja.length) throw new S.Xato('Bo\'linadigan do\'kon yo\'q.');
  const bugun = V.bugun(), sana = bugun.split('-').reverse().join('.');
  const izoh = 'Bo\'lindi ' + sana + ' (A/B, devor hisobi +160 000/m²)';
  // 1) eski qatorlar → A
  const yoz = [];
  t.reja.forEach(r => {
    yoz.push({ varaq: DK_V, katak: 'A' + r.qator, qiymat: [[r.id + 'A']] });
    yoz.push({ varaq: DK_V, katak: 'E' + r.qator, qiymat: [[r.no + 'A']] });
    yoz.push({ varaq: DK_V, katak: 'F' + r.qator + ':G' + r.qator, qiymat: [[r.yarim, BOLISH_BAZA]] });
    yoz.push({ varaq: DK_V, katak: 'O' + r.qator, qiymat: [[(s(r.x[14]).trim() ? s(r.x[14]).trim() + '; ' : '') + izoh]] });
  });
  // 2) yangi qatorlar → B (A..AD = 30 ustun; P, Z, AC — formulalar, qator raqami append'dan keyin aniq bo'ladi → avval o'rin, keyin formulalar)
  const A = await G.ustunOqi(env.aksBazaId, DK_V, 'A', env.googleKey);
  const bosh = A.length + 1;   // birinchi yangi qator (append shu yerdan)
  const qatorlar = t.reja.map((r, i) => {
    const n = bosh + i, q = r.x.slice(0, 30); while (q.length < 30) q.push('');
    q[0] = r.id + 'B'; q[4] = r.no + 'B'; q[5] = r.yarim; q[6] = BOLISH_BAZA; q[14] = izoh;
    q[15] = '=F' + n + '*G' + n;
    q[25] = '=IF($AD' + n + '<>"","Ma\'muriyat",IF($T' + n + '="Shartnoma olmagan","Bron",IF($S' + n + '<>"SOTILMAGAN",IF($V' + n + '<>"","Sotilgan+ijara","Sotilgan"),IF($V' + n + '<>"","Bo\'sh+ijara","Bo\'sh"))))';
    q[28] = '=IF($R' + n + '="",0,SUMIFS(\'05_Tolovlar\'!$D$2:$D$4996,\'05_Tolovlar\'!$C$2:$C$4996,$R' + n + '))';
    return q.map(v => v == null ? '' : v);
  });
  await G.yoz(env.aksBazaId, yoz, env.googleKey);
  const r1 = await G.qatorlarQoshR(env.aksBazaId, DK_V, bosh, qatorlar, env.googleKey);
  if (r1 !== bosh) {   // append boshqa qatordan boshlagan bo'lsa — formulalarni haqiqiy qator raqami bilan qayta yozish
    const f = []; t.reja.forEach((r, i) => { const n = r1 + i;
      f.push({ varaq: DK_V, katak: 'P' + n, qiymat: [['=F' + n + '*G' + n]] });
      f.push({ varaq: DK_V, katak: 'Z' + n, qiymat: [[qatorlar[i][25].replace(new RegExp('\\$([A-Z]+)' + (bosh + i) + '\\b', 'g'), '$$$1' + n)]] });
      f.push({ varaq: DK_V, katak: 'AC' + n, qiymat: [[qatorlar[i][28].replace(new RegExp('\\$R' + (bosh + i) + '\\b', 'g'), '$R' + n)]] }); });
    await G.yoz(env.aksBazaId, f, env.googleKey);
  }
  // 3) jurnal
  try {
    const vaqt = QY.hozir().dmyHm;
    const AJ = (await G.ustunOqi(env.aksBazaId, JUR_V, 'A', env.googleKey)) || [];
    let id = Math.max(0, ...AJ.slice(1).map(v => Number(v) || 0));
    const L = t.reja.map(r => [++id, vaqt, 'ID ' + r.id, 'Dokon', '', 'Bo\'lish', r.id + ' (' + r.maydon + ' m², ' + r.bazaEski + ')', r.id + 'A + ' + r.id + 'B (' + r.yarim + ' m² × 2, ' + BOLISH_BAZA + ')', u.fish, 'direktor']);
    await G.qatorlarQoshR(env.aksBazaId, JUR_V, AJ.length + 1, L, env.googleKey);
  } catch (e) { console.error('dokonBolish jurnal:', e.message); }
  await kut(tetik.varaqlarYangila([DK_V, JUR_V]).catch(e => console.error('ko\'zgu (bo\'lish):', e.message)), 20000);
  return { ok: true, soni: t.reja.length, yangiQator: r1, baza: BOLISH_BAZA, royxat: t.reja.map(r => r.id + ' → ' + r.id + 'A / ' + r.id + 'B') };
}

module.exports = { dokonBolishKorish, dokonBolish };
module.exports._ichki = { ROYXAT, BOLISH_BAZA, tekshir };
