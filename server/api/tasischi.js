// AKS TIZIM — 📊 Ta'sischi hisoboti («ТАҲЛИЛИЙ МАЪЛУМОТ, 1-илова» — qo'lda yuritilgan Svodniy_hisobotlar jadvalining o'rni).
// Manba: 01_Dokonlar (640 do'kon: maydon, baza narx, qurilish holati, sotuv shartnomasi), 03_Sotuv_shartnomalar (qiymat, to'langan, qarz,
// notarial), 05_Tolovlar (to'lov shakllari: bank / naqd / plastik / barter). Faqat o'qiydi, hech narsa yozmaydi.
// Narx qoidasi (direktor, 27.10.2026): sotilgan do'kon — shartnoma qiymati; sotilmagan do'kon — prays-list baza narxi × real maydon.
// «Sotilgan» = do'konning sotuv shartnomasi bor va u bekor qilinmagan. Maydon — 01_Dokonlar F ustuni (ostdan o'lchov).
'use strict';
const S = require('./sessiya');
const V = require('../lib/varaq');

const s = v => String(v == null ? '' : v);
const son = V.son;
const r2 = n => Math.round(n * 100) / 100;
const DOKON_OXIRI = 641;                      // 01_Dokonlar: 2–641 qator = 640 do'kon
const TUGAL = 'Тугалланган';                  // qurilish holati (01_Dokonlar H ustuni)

// To'lov shakli → hisobot guruhi. 05_Tolovlar E ustuni: Naqt / Bank / Plastik / Barter (kirill variantlari ham bor).
function shaklGuruh(x) {
  const t = s(x).trim();
  if (/barter|ўзаро|o'zaro|zaro hisob/i.test(t)) return 'barter';
  if (/naq|нақ|наличн/i.test(t)) return 'naqd';
  if (/plastik|пластик|karta|карт|uzcard|humo/i.test(t)) return 'plastik';
  if (/bank|банк|hisob|ҳисоб|перечис|o'tkazma/i.test(t)) return 'bank';
  return t ? 'boshqa' : 'korsatilmagan';
}

async function hisobla() {
  const [R1, R3, R5] = await Promise.all([V.qatorlar('01_Dokonlar'), V.qatorlar('03_Sotuv_shartnomalar'), V.qatorlar('05_Tolovlar')]);

  // ---------- 1) Sotuv shartnomalari: faqat faol (bekor qilinmaganlari)
  const SH = {};                                // shartnoma raqami → ma'lumot
  let bekorSoni = 0;
  R3.forEach(({ x }) => {
    const no = s(x[0]).trim();
    if (!/^27\/\d+$/.test(no)) return;
    if (/bekor/i.test(s(x[13]))) { bekorSoni++; return; }
    SH[no] = { no, holati: s(x[13]).trim(), notarial: s(x[15]).trim(), qiymat: son(x[25]), tolangan: son(x[27]),
      qarz: son(x[30]), muddati: son(x[31]), dokonlar: [] };
  });

  // ---------- 2) Do'konlar
  const D = [];
  R1.forEach(({ n, x }) => {
    if (n < 2 || n > DOKON_OXIRI) return;
    const id = s(x[0]).trim(); if (!id) return;
    const sotuvNo = s(x[17]).trim();
    const sh = SH[sotuvNo] || null;
    const d = { id, blok: s(x[2]), qavat: s(x[3]), nomer: s(x[4]), maydon: son(x[5]), baza: son(x[6]),
      qurilish: s(x[7]).trim(), umumiy: son(x[15]), sotuvNo, egasi: s(x[18]).trim(), sh,
      sotilgan: !!sh, tugal: s(x[7]).trim() === TUGAL };
    if (sh) sh.dokonlar.push(d);
    D.push(d);
  });

  // ---------- 3) Shartnoma pulini do'konlarga taqsimlash (bir shartnomaga bir necha do'kon bo'lsa — maydon ulushiga qarab)
  const kopDokonli = [];
  Object.values(SH).forEach(sh => {
    const k = sh.dokonlar.length;
    if (k === 0) return;
    if (k > 1) kopDokonli.push({ no: sh.no, dokonlar: sh.dokonlar.map(d => d.id) });
    const jamiM = sh.dokonlar.reduce((a, d) => a + d.maydon, 0);
    sh.dokonlar.forEach(d => {
      const ul = k === 1 ? 1 : (jamiM > 0 ? d.maydon / jamiM : 1 / k);
      d.qiymat = sh.qiymat * ul; d.tolangan = sh.tolangan * ul; d.qarz = sh.qarz * ul; d.muddati = sh.muddati * ul;
    });
  });
  // shartnomasi do'konga bog'lanmagan (01_Dokonlar da ko'rinmayotgan) faol shartnomalar
  const dokonsiz = Object.values(SH).filter(sh => !sh.dokonlar.length).map(sh => sh.no);

  // ---------- 4) To'lov shakllari (05_Tolovlar) — faqat faol shartnomalar bo'yicha
  const T = { bank: 0, naqd: 0, plastik: 0, barter: 0, boshqa: 0, korsatilmagan: 0 };
  let tolovJami = 0, begonaTolov = 0, begonaSumma = 0;
  R5.forEach(({ x }) => {
    if (x[0] == null || x[0] === '') return;
    const no = s(x[2]).trim(), summa = son(x[3]);
    if (!SH[no]) { if (summa) { begonaTolov++; begonaSumma += summa; } return; }   // bekor qilingan / noma'lum shartnoma to'lovi
    T[shaklGuruh(x[4])] += summa; tolovJami += summa;
  });

  // ---------- 5) Yig'indilar
  const yig = (ro, nom) => {
    const o = { nom, soni: ro.length, maydon: 0, summa: 0, sotSoni: 0, sotMaydon: 0, sotQiymat: 0, tushum: 0, qarz: 0, muddati: 0 };
    ro.forEach(d => {
      o.maydon += d.maydon;
      o.summa += d.sotilgan ? (d.qiymat || 0) : d.baza * d.maydon;      // narx qoidasi
      if (d.sotilgan) { o.sotSoni++; o.sotMaydon += d.maydon; o.sotQiymat += d.qiymat || 0; o.tushum += d.tolangan || 0; o.qarz += d.qarz || 0; o.muddati += d.muddati || 0; }
    });
    o.maydon = r2(o.maydon); o.sotMaydon = r2(o.sotMaydon);
    ['summa', 'sotQiymat', 'tushum', 'qarz', 'muddati'].forEach(k => o[k] = Math.round(o[k]));
    o.bosSoni = o.soni - o.sotSoni; o.bosMaydon = r2(o.maydon - o.sotMaydon); o.bosQiymat = o.summa - o.sotQiymat;
    return o;
  };

  const jami = yig(D, 'Жами');
  const tugal = yig(D.filter(d => d.tugal), 'Қурилиши тугалланган');
  const qurilayotgan = yig(D.filter(d => !d.tugal), 'Қурилиши якунланмаган');

  // hujjatlashtirilgan: notarial belgisi qo'yilgan faol shartnoma (sana bo'lmasa ham, belgi bo'lsa yetarli)
  const notBor = D.filter(d => d.sotilgan && d.sh.notarial);
  const notYoq = D.filter(d => !(d.sotilgan && d.sh.notarial));
  const hujBor = yig(notBor, 'Ҳужжатлаштирилган'), hujYoq = yig(notYoq, 'Ҳужжатлаштирилмаган');

  // qurilish holati ustunidagi haqiqiy qiymatlar (kutilmagan yozuv bo'lsa ko'rinsin)
  const qurTurlari = {};
  D.forEach(d => { const k = d.qurilish || '(bo\'sh)'; qurTurlari[k] = (qurTurlari[k] || 0) + 1; });

  // shubhali qatorlar: sotilgan lekin shartnoma qiymati 0; sotilmagan lekin baza narxi 0; 01 dagi «umumiy» ustuni baza×maydon ga mos kelmasligi
  const qiymatsiz = D.filter(d => d.sotilgan && !(d.qiymat > 0)).map(d => d.id + ' (' + d.sotuvNo + ')');
  const bazasiz = D.filter(d => !d.sotilgan && !(d.baza > 0)).map(d => d.id);
  const maydonsiz = D.filter(d => !(d.maydon > 0)).map(d => d.id);
  const umumiyFarq = D.filter(d => !d.sotilgan && Math.abs(d.umumiy - d.baza * d.maydon) > 1000).length;

  // 03 dagi «to'langan» yig'indisi bilan 05 dagi to'lovlar yig'indisi — mos kelishi tekshiriladi
  const shTolangan = Math.round(Object.values(SH).reduce((a, x) => a + x.tolangan, 0));
  const shQiymat = Math.round(Object.values(SH).reduce((a, x) => a + x.qiymat, 0));
  const shQarz = Math.round(Object.values(SH).reduce((a, x) => a + x.qarz, 0));
  const shMuddati = Math.round(Object.values(SH).reduce((a, x) => a + x.muddati, 0));

  return {
    sana: V.bugun(),
    jami, tugal, qurilayotgan, hujBor, hujYoq,
    tolov: { jami: Math.round(tolovJami), bank: Math.round(T.bank), naqd: Math.round(T.naqd), plastik: Math.round(T.plastik),
      barter: Math.round(T.barter), boshqa: Math.round(T.boshqa), korsatilmagan: Math.round(T.korsatilmagan) },
    shartnoma: { soni: Object.keys(SH).length, bekorSoni, qiymat: shQiymat, tolangan: shTolangan, qarz: shQarz, muddati: shMuddati },
    kutilayotgan: jami.bosQiymat + jami.qarz,
    nazorat: { kopDokonli, dokonsiz, begonaTolov, begonaSumma: Math.round(begonaSumma), qurTurlari,
      qiymatsiz, bazasiz, maydonsiz, umumiyFarq,
      tolovFarq: Math.round(tolovJami) - shTolangan, qiymatFarq: jami.sotQiymat - shQiymat }
  };
}

async function tasischiHisobot([kodSes]) {
  const u = await S.ruxsat(kodSes);
  if (!u.admin) throw new S.Xato('Bu hisobot faqat direktor uchun.');
  return await hisobla();
}

module.exports = { tasischiHisobot, hisobla };
