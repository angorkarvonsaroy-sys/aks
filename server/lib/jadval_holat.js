'use strict';
// lib/jadval_holat.js — TO'LOV JADVALI QATOR-QATOR HOLATI VA TO'LOVNI TAQSIMLASH (19.11.2026)
//
// Nima qiladi: 03b_Tolov_jadvali qatorlari + 05_Tolovlar (va 05b «Буферда») + bugun → har qator uchun
// «to'landi / qoldiq / holat», har to'lov uchun «nimani yopdi», keyingi to'lov, progress.
//
// QOIDA — AKS_BAZA dagi formulalar bilan BIR XIL (03 AB/AC/AE/AF/AG):
//   • pul eng eski qatordan boshlab yopiladi (kumulyativ, FIFO) — bazadagi AF/AG shunday hisoblaydi
//   • Jami_tolangan = 05_Tolovlar + 05b_Bufer_tolovlar («Буферда»)
//   • Muddati_otgan = min(Asosiy_qarz, max(0, Jami_qarz), max(0, Σ(sana ≤ bugun) − Jami_tolangan))
//   • Kechikkan_kun: muddati o'tgan ≤ 1000 bo'lsa 0; aks holda bugun − (kumulyativ > Jami_tolangan+1000 bo'lgan birinchi qator sanasi)
// Bu modul hech narsa YOZMAYDI — faqat hisoblaydi. Bazadagi raqamlar o'zgarmaydi, ularga qator-qator ko'rinish qo'shiladi.
//
// Holatlar: 'tolandi' (to'liq), 'oldindan' (to'liq, muddatidan oldin yopilgan), 'qisman', 'kechikkan' (sana o'tgan, yopilmagan), 'kutilmoqda'.

const CHEGARA = 1000;   // so'm — bazadagi AG formulasidagi yaxlitlash chegarasi

function num(v) { const n = Number(String(v == null ? '' : v).replace(/\s/g, '').replace(',', '.')); return isFinite(n) ? n : 0; }
function kun(a, b) { return Math.round((Date.parse(a + 'T00:00:00Z') - Date.parse(b + 'T00:00:00Z')) / 86400000); }
function nom(q) { if (q.nom) return q.nom; const t = num(q.tartib); return t === 0 ? "Boshlang'ich" : t + "-to'lov"; }

/**
 * @param {object} p
 * @param {Array<{tartib:number|string, sana:string(iso), summa:number, turi?:string, nom?:string}>} p.qatorlar  — 03b qatorlari (bitta shartnoma)
 * @param {Array<{id:string, sana:string(iso), summa:number, shakl?:string, bufer?:boolean}>} p.tolovlar — 05 (+05b Буферда) to'lovlari
 * @param {string} p.bugun — iso
 * @param {number} p.qiymat — 03 W Shartnoma_qiymati
 * @param {number} [p.umumiy] — 03 Z Umumiy_qiymat (W + qo'shimcha); bo'lmasa W
 */
function jadvalHolat(p) {
  const bugun = p.bugun;
  const Q = (p.qatorlar || []).map(q => ({ tartib: num(q.tartib), nom: nom(q), sana: q.sana, summa: Math.round(num(q.summa)), turi: q.turi || '' }))
    .filter(q => q.sana && q.summa > 0)
    .sort((a, b) => a.sana < b.sana ? -1 : a.sana > b.sana ? 1 : a.tartib - b.tartib);
  const T = (p.tolovlar || []).map(t => ({ id: String(t.id == null ? '' : t.id), sana: t.sana || '', summa: Math.round(num(t.summa)), shakl: t.shakl || '', bufer: !!t.bufer }))
    .filter(t => t.summa > 0)
    .sort((a, b) => a.sana < b.sana ? -1 : a.sana > b.sana ? 1 : (num(a.id) - num(b.id)));
  const qiymat = Math.round(num(p.qiymat)), umumiy = Math.round(num(p.umumiy)) || qiymat;

  // qatorlar holati
  const R = Q.map(q => ({ ...q, tolandi: 0, qoldiq: q.summa, yopganlar: [], yopilganSana: '' }));
  const Y = T.map(t => ({ ...t, qismlar: [] }));
  let i = 0;
  Y.forEach(t => {
    let qoldi = t.summa;
    while (qoldi > 0 && i < R.length) {
      const r = R[i];
      const ol = Math.min(qoldi, r.qoldiq);
      if (ol > 0) { r.tolandi += ol; r.qoldiq -= ol; qoldi -= ol; r.yopganlar.push(t.id); t.qismlar.push({ tartib: r.tartib, nom: r.nom, summa: ol, toliq: r.qoldiq < CHEGARA }); if (r.qoldiq < CHEGARA && !r.yopilganSana) r.yopilganSana = t.sana; }
      if (r.qoldiq <= 0) i++; else break;
    }
    t.ortiqcha = qoldi;   // jadvaldan tashqari (ortiqcha) qism
  });
  let kum = 0;
  R.forEach(r => {
    kum += r.summa; r.kumulyativ = kum;
    const otdi = r.sana <= bugun;
    if (r.qoldiq < CHEGARA) r.holat = (r.yopilganSana && r.yopilganSana < r.sana) ? 'oldindan' : 'tolandi';
    else if (r.tolandi > 0) r.holat = 'qisman';
    else r.holat = otdi ? 'kechikkan' : 'kutilmoqda';
    r.kun = (otdi && r.qoldiq >= CHEGARA) ? kun(bugun, r.sana) : 0;
    r.yopdi = undefined;
  });
  // «nimani yopdi» matni: qator nomi + shu to'lovdan tushgan summa + holati (yopildi = qator shu to'lov bilan to'liq yopildi)
  const fmt = n => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  Y.forEach(t => { t.yopdi = t.qismlar.map(z => z.nom + ' — ' + fmt(z.summa) + (z.toliq ? ' (yopildi)' : ' (qisman)')).join(' · ') + (t.ortiqcha > 0 ? (t.qismlar.length ? ' · ' : '') + 'jadvaldan ortiqcha ' + fmt(t.ortiqcha) : ''); });

  // bazadagi formulalar bilan bir xil jami ko'rsatkichlar
  const jamiTolangan = T.reduce((a, t) => a + t.summa, 0);
  const asosiyQarz = Math.max(0, qiymat - jamiTolangan);
  const jamiQarz = umumiy - jamiTolangan;
  const dueSum = R.filter(r => r.sana <= bugun).reduce((a, r) => a + r.summa, 0);
  const muddatiOtgan = Math.min(asosiyQarz, Math.max(0, jamiQarz), Math.max(0, dueSum - jamiTolangan));
  let kechikkanKun = 0;
  if (muddatiOtgan > CHEGARA) { const r1 = R.find(r => r.kumulyativ > jamiTolangan + CHEGARA); if (r1) kechikkanKun = Math.max(0, kun(bugun, r1.sana)); }
  const keyingiQ = R.find(r => r.qoldiq >= CHEGARA);
  const keyingi = keyingiQ ? { tartib: keyingiQ.tartib, nom: keyingiQ.nom, sana: keyingiQ.sana, summa: keyingiQ.qoldiq, kechikkan: keyingiQ.sana < bugun } : null;
  const progress = umumiy > 0 ? Math.min(1, Math.round(jamiTolangan / umumiy * 1000) / 1000) : 0;
  return { qatorlar: R.map(r => ({ tartib: r.tartib, nom: r.nom, sana: r.sana, summa: r.summa, tolandi: r.tolandi, qoldiq: Math.max(0, r.qoldiq), holat: r.holat, kun: r.kun, yopganlar: r.yopganlar })),
    tolovlar: Y.map(t => ({ id: t.id, sana: t.sana, summa: t.summa, bufer: t.bufer, yopdi: t.yopdi, qismlar: t.qismlar, ortiqcha: t.ortiqcha })),
    jamiTolangan, asosiyQarz, jamiQarz, muddatiOtgan, kechikkanKun, keyingi, progress, jadvalSumma: R.reduce((a, r) => a + r.summa, 0), umumiy,
    soni: { jami: R.length, tolandi: R.filter(r => r.holat === 'tolandi' || r.holat === 'oldindan').length, qisman: R.filter(r => r.holat === 'qisman').length, kechikkan: R.filter(r => r.holat === 'kechikkan').length } };
}

/** Yangi (hali saqlanmagan) to'lov jadvalning qaysi qatorlarini yopishini oldindan ko'rsatish. */
function tolovOldindan(p, summa, sana) {
  const avval = jadvalHolat(p);
  const keyin = jadvalHolat({ ...p, tolovlar: (p.tolovlar || []).concat([{ id: '__yangi__', sana: sana || p.bugun, summa }]) });
  const t = keyin.tolovlar.find(z => z.id === '__yangi__') || { qismlar: [], yopdi: '', ortiqcha: 0 };
  return { yopdi: t.yopdi, qismlar: t.qismlar, ortiqcha: t.ortiqcha, avval: { muddatiOtgan: avval.muddatiOtgan, keyingi: avval.keyingi }, keyin: { muddatiOtgan: keyin.muddatiOtgan, keyingi: keyin.keyingi, progress: keyin.progress } };
}

const HOLAT_NOM = { tolandi: "To'landi", oldindan: 'Muddatidan oldin', qisman: 'Qisman', kechikkan: 'Kechikkan', kutilmoqda: 'Kutilmoqda' };

module.exports = { jadvalHolat, tolovOldindan, HOLAT_NOM, CHEGARA };
