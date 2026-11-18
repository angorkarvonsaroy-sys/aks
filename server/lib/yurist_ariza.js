// AKS TIZIM — ⚖ ДАЪВО АРИЗАСИ (суд буйруғи тартибида) — Савдо-саноат палатаси бланкасида, 19.11.2026 (direktor topshirig'i).
// Palataning o'z blankasi va o'z matni shablon faylda (shablon/davo_ariza_ssp.docx) — logotip, shrift, joylashuv o'zgarmaydi.
// Kodga faqat <<BELGI>> larning o'rniga tushadigan matn yoziladi; hammasi AKS_BAZA dan (02 mijoz, 03 shartnoma, 01 do'kon, 05 to'lovlar, 06b ish).
// Chiqish — DOCX: Palata sanani, raqamni va imzoni o'zi qo'yadi, shuning uchun fayl tahrirlanadigan bo'lishi kerak.
// Nom o'zgarishi: «ANGOR INDEX» MCHJ 10.09.2025 dagi № 07 yig'ilish qarori bilan «ANGOR KARVON SAROY» MCHJ bo'lgan.
// Shartnoma shu sanadan OLDIN tuzilgan bo'lsa — preambulada eski nom va qaror eslanadi, ilovaga qaror nusxasi qo'shiladi; keyin bo'lsa — faqat yangi nom.
'use strict';
const fs = require('fs');
const path = require('path');
const XL = require('./xlsx');
const IS = require('./ism');

const SHABLON = path.join(__dirname, '..', 'shablon', 'davo_ariza_ssp.docx');
const NOM_SANA = '2025-09-10';   // nomi o'zgargan kun
const OYLAR = ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr'];
const BOSH = '______________________';   // bazada yo'q ma'lumot — qo'lda to'ldiriladi
// 19.11.2026 (direktor savoli): shartnoma shabloni yillar davomida uch marta o'zgargan — band raqamlari ham, peniya chegarasi ham boshqa.
// Quyidagi jadval TAXMIN emas: har bir davr imzolangan haqiqiy shartnoma skanidan tekshirilgan —
//   ESKI               27/54 (25.12.2021), 27/195 (12.08.2023), 27/213 (12.08.2024), 27/245 (13.01.2025), 27/314 (15.09.2025)
//   YANGI_TAYYOR       27/316 (22.09.2025), 27/320 (13.10.2025), 27/336 (13.01.2026), 27/372 (04.11.2026)
//   YANGI_QURILAYOTGAN 27/374 (10.11.2026)
// Davrni sana emas, tizimning o'z tasnifi (portfel.js shablon) belgilaydi; shablon noma'lum bo'lsa band raqami «____» qoldiriladi.
// O'TISH DAVRI: 2025-yil sentabrda ikkala shablon ham parallel ishlatilgan —
// 27/301 (08.09.2025) yangi o'zbekcha, 27/314 (15.09.2025) eski ruscha, 27/316 (22.09.2025) yangi.
// Shu oraliqda sanaga qarab shablonni aniqlab bo'lmaydi — band raqamlari «____» qoldiriladi.
const OTISH = ['2025-08-01', '2025-10-12'];
const SHB = {
  ESKI: { nom: 'Ulushli qurilishda ishtirok etish (rus tilida, договор соинвестирования)', dokon: '1.2', qiymat: '2.1', tolov: '2.2',
    maydon: '2.3.2', penya: '4.2.1', chek: null, chekMatn: 'shartnomada peniyaning yuqori chegarasi belgilanmagan', maydonTur: 'kelishuv' },
  YANGI_TAYYOR: { nom: "Do'konni muddatli to'lov yoki bank krediti asosida sotib olish bo'yicha dastlabki oldi-sotdi shartnomasi",
    dokon: '1.1', qiymat: '2.1', tolov: '2.2', maydon: '2.5', penya: '2.7', chek: 0.10, chekAsos: 'muddati',
    chekMatn: "uning umumiy miqdori muddati o'tgan qarzdorlikning 10 % idan oshmaydi", maydonTur: 'tolerans' },
  YANGI_QURILAYOTGAN: { nom: "Do'kon qurilishiga investitsiya kiritish va kelgusida oldi-sotdi qilish bo'yicha dastlabki shartnoma",
    dokon: '1.2', qiymat: '2.1', tolov: '2.2', maydon: '2.3.1', penya: '5.1', chek: 0.10, chekAsos: 'shartnoma',
    chekMatn: "uning umumiy miqdori shartnoma summasining 10 % idan oshmaydi", maydonTur: 'kelishuv' }
};

const s = v => String(v == null ? '' : v).trim();
const esc = v => String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const pul = n => Math.round(Number(n) || 0).toLocaleString('ru-RU').replace(/[  ,]/g, '.');   // 528.150.000 — Palata uslubi
const son = n => s(n).replace('.', ',');
// «XUDOYBERDIYEVA XULKAR» → «Xudoyberdiyeva Xulkar»; kirill bo'lsa — lotinga
function ism(f) {
  let t = s(f); if (!t) return '';
  if (/[Ѐ-ӿ]/.test(t)) t = IS.lotinga(t);
  return t.split(/\s+/).filter(Boolean).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
}
// ismga qo'shimcha: «Xudoyberdiyeva Xulkar» + «ga» / «ning»
const qosh = (f, q) => ism(f) + q;
function sanaMatn(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s(iso)); if (!m) return s(iso);
  return m[1] + ' yil ' + Number(m[3]) + ' ' + OYLAR[Number(m[2]) - 1] + 'da';
}
function pasportMatn(p) {
  const t = s(p).replace(/\s+/g, '').toUpperCase();
  const m = /^([A-Z]{2})(\d+)$/.exec(t);
  return t ? (m ? m[1] + ' ' + m[2] : t) : BOSH;
}
const eski = iso => s(iso) && s(iso) < NOM_SANA;   // shartnoma eski nom davrida tuzilganmi
// son → so'z (lotin, o'zbekcha) — jami undiriladigan summa arizada so'z bilan ham yoziladi
const S_BIR = ['', 'bir', 'ikki', 'uch', 'to’rt', 'besh', 'olti', 'yetti', 'sakkiz', 'to’qqiz'];
const S_ON = ['', 'o’n', 'yigirma', 'o’ttiz', 'qirq', 'ellik', 'oltmish', 'yetmish', 'sakson', 'to’qson'];
function uchXona(n) { const y = Math.floor(n / 100), o = Math.floor((n % 100) / 10), b = n % 10; const p = [];
  if (y) p.push((y > 1 ? S_BIR[y] + ' ' : '') + 'yuz'); if (o) p.push(S_ON[o]); if (b) p.push(S_BIR[b]); return p.join(' '); }
function sozBilan(n) {
  n = Math.round(Number(n) || 0); if (!n) return 'nol';
  const q = [[1000000000, 'milliard'], [1000000, 'million'], [1000, 'ming']]; const p = [];
  for (const [d, nom] of q) { const k = Math.floor(n / d); if (k) { p.push(uchXona(k) + ' ' + nom); n %= d; } }
  if (n) p.push(uchXona(n)); return p.join(' ');
}
// bitta xatboshini (belgili) bir nechta xatboshiga yoyish — shartnoma tavsifi bandma-band yoziladi
function kopXatboshi(doc, belgi, matnlar) {
  const re = new RegExp('<w:p\\b[^>]*>(?:(?!</w:p>)[\\s\\S])*?' + belgi + '(?:(?!</w:p>)[\\s\\S])*?</w:p>');
  const m = re.exec(doc); if (!m) return doc;
  const para = m[0];
  const bosh = (/<w:p\b[^>]*>/.exec(para) || [''])[0];
  const ppr = (/<w:pPr>[\s\S]*?<\/w:pPr>/.exec(para) || [''])[0];
  const rpr = (/<w:rPr>[\s\S]*?<\/w:rPr>/.exec(para) || [''])[0];
  const yangi = matnlar.filter(x => s(x)).map(x => bosh + ppr + '<w:r>' + rpr + '<w:t xml:space="preserve">' + esc(x) + '</w:t></w:r></w:p>').join('');
  return doc.slice(0, m.index) + yangi + doc.slice(m.index + para.length);
}

// M — lib/yurist_malumot.js yhYig natijasi. Qaytaradi { nom, mime, b64, ogoh: [...] }
function ariza(M) {
  const ogoh = [];
  const E = eski(M.sana);
  const fish = ism(M.fish);
  if (s(M.fish).split(/\s+/).filter(Boolean).length < 3) ogoh.push('Mijozning otasining ismi bazada yo\'q — arizada bo\'sh joy qoldirildi (02_Mijozlar, FISH).');
  const jsh = /^\d{14}$/.test(s(M.jshshir)) ? s(M.jshshir) : '';
  if (!jsh) ogoh.push('Mijozning JSHSHIRi bazada yo\'q yoki 14 raqam emas — arizada bo\'sh joy qoldirildi (02_Mijozlar).');
  const pas = s(M.pasport) && s(M.pasport) !== '—' ? pasportMatn(M.pasport) : '';
  if (!pas) ogoh.push('Mijozning pasport seriyasi bazada yo\'q.');
  const manzil = s(M.manzil) && s(M.manzil) !== '—' ? IS.lotinga(M.manzil) : '';
  if (!manzil) ogoh.push('Mijozning manzili bazada yo\'q.');

  const D = M.dokon || {}, sh = M.shart || {};
  const otish = s(M.sana) >= OTISH[0] && s(M.sana) <= OTISH[1];
  const shbKod = otish ? '' : (/^ESKI_/.test(s(M.shablon)) ? 'ESKI' : s(M.shablon));
  const B = SHB[shbKod] || null;
  if (otish) ogoh.push('Shartnoma ' + s(M.sana).split('-').reverse().join('.') + ' — shablon almashgan o\'tish davrida tuzilgan. '
    + 'O\'sha paytda eski (ruscha) va yangi (o\'zbekcha) shablonlar parallel ishlatilgan, sanaga qarab aniqlab bo\'lmaydi. '
    + 'Band raqamlari «____» qoldirildi — imzolangan shartnoma skanidan qo\'ying.');
  const bnd = k => (B ? B[k] : '____') + '-band';
  if (!B) ogoh.push('Shartnoma shabloni aniqlanmadi (tizimda shablon turi yo\'q — 100 % to\'lov shartnomasi bo\'lishi mumkin). '
    + 'Arizada band raqamlari «____» qoldirildi: imzolangan shartnoma skanidan qo\'ying.');
  else ogoh.push('Shartnoma shabloni: ' + B.nom + ' (bandlar: do\'kon ' + B.dokon + ', qiymat ' + B.qiymat + ', to\'lov ' + B.tolov
    + ', maydon ' + B.maydon + ', peniya ' + B.penya + '). Imzolangan skan bilan solishtiring.');
  const qarz = Number(M.jami) || 0;
  const pen = Math.round((M.penya && M.penya.undiriladigan) || 0);
  if (!pen) ogoh.push('Peniya hisoblanmadi — shartnomada neustoyka bandi topilmadi yoki muddati o\'tgan qarz yo\'q.');
  if (M.muddat && M.muddat.qolganKun < 0) ogoh.push('DIQQAT: da\'vo muddati ' + (-M.muddat.qolganKun) + ' kun oldin tugagan (oxirgi to\'lov ' + s(M.muddat.oxirgiTolov) + ') — yurist xulosasi kerak.');
  if ((M.ish && Number(M.ish.bosqich) || 0) > 1) ogoh.push('Ish allaqachon ' + M.ish.bosqich + '-bosqichda — ariza avval berilgan bo\'lishi mumkin.');
  if (!(M.hujjat || []).some(h => h.kod === 'SHARTNOMA')) ogoh.push('Ish hujjatlari ichida imzolangan shartnoma skani yo\'q — ilovaga qo\'shilishi kerak.');
  if (!(M.xat || []).some(x => x.holati === 'Yuborildi') && !(M.hujjat || []).some(h => h.kod === 'OGOHLANTIRISH'))
    ogoh.push('Yetkazilgani isbotlangan ogohlantirish xati topilmadi — sudgacha tartib bajarilmagan bo\'lishi mumkin.');

  const UND = E
    ? '“ANGOR INDEX” MCHJning 10.09.2025 yildagi № 07 sonli yig’ilish qaroriga asosan nomi o’zgartirilgan undiruvchi “ANGOR KARVON SAROY” MCHJ'
    : '“ANGOR KARVON SAROY” MCHJ';
  const MUR = 'Savdo sanoat palatasi Surxondaryo viloyat hududiy boshqarmasiga  “ANGOR KARVON SAROY” MCHJ murojaat etib, qarzdor '
    + qosh(M.fish, 'ga') + ' nisbatan ' + pul(qarz) + ' so’m qarzdorligini va ' + pul(pen) + ' so’m peniyani, jami ' + pul(qarz + pen) + ' so’mni undirish bo‘yicha amaliy yordam berishni so’ragan.';

  const dokonMatn = (D.blok ? D.blok + '-blok, ' : '') + (D.qavat ? D.qavat + '-qavat, ' : '') + (D.no ? D.no + '-sonli ' : '')
    + (D.maydon ? son(D.maydon) + ' kv.m bo’lgan ' : '') + 'savdo do’koni';
  const bosh = Number(sh.boshSumma) || 0, boshKun = Number(sh.boshKun) || 0, oy = Number(sh.oy) || 0;
  const narx1 = Number(sh.narx1m2) || 0, qiymatSh = Number(sh.qiymatSh) || Number(M.qiymat) || 0;
  // Shartnoma tavsifi — bandma-band (direktor talabi 19.11.2026): har bir raqam qaysi bandga asoslangani ko'rinsin
  const SHA = [];
  SHA.push((E ? '“ANGOR INDEX” MCHJ xozirgi nomi “ANGOR KARVON SAROY” MCHJ' : '“ANGOR KARVON SAROY” MCHJ')
    + ' bilan ' + fish + ' o’rtasida ' + sanaMatn(M.sana) + ' №' + s(M.no)
    + '-sonli «' + (B ? B.nom : 'shartnoma') + '» tuzilgan. '
    + 'Shartnomaning ' + bnd('dokon') + 'iga ko’ra “ANGOR KARVON SAROY” MCHJ xududidagi ' + dokonMatn
    + (shbKod === 'ESKI' ? ' ulushli qurilish obyekti sifatida Xaridorga (Dolshchikka) berilishi kelishilgan. '
                         : ' Xaridorga sotilgan. ')
    + 'Shartnomaning ' + bnd('qiymat') + 'iga ko’ra do’konning qiymati ' + pul(qiymatSh) + ' so’m'
    + (narx1 ? ', 1 m² uchun qiymat ' + pul(narx1) + ' so’m' : '') + ' etib belgilangan.'
    + (bosh ? ' Shartnomaning ' + bnd('tolov') + 'iga ko’ra qiymatning ' + pul(bosh) + ' so’mi shartnoma imzolangan sanadan ' + (boshKun || 0)
        + ' kun ichida, qolgan qismi esa ' + (oy || 0) + ' oy davomida har oyda ' + pul(M.oylik) + ' so’mdan to’lanishi kelishilgan.'
      : ' Shartnomaning ' + bnd('tolov') + 'iga ko’ra qiymati ' + (oy || 0) + ' oy davomida har oyda ' + pul(M.oylik) + ' so’mdan to’lanishi kelishilgan.'));
  if (Number(M.qoshimcha) > 0) {
    const farq = Math.round((Number(sh.realMaydon) - Number(D.maydon)) * 100) / 100;
    const mTol = !B || B.maydonTur === 'tolerans';
    SHA.push('Shartnomaning ' + bnd('maydon') + 'iga ko’ra yakuniy maydon kadastr/texnik o’lchov bo’yicha ' + bnd('dokon') + 'dagidan '
      + (mTol ? '±0,50 m² dan ortiq farq qilsa, do’kon qiymati 1 m² narxidan kelib chiqib qayta hisoblanadi. '
             : 'katta chiqsa, Xaridor ortiqcha maydon uchun ' + bnd('qiymat') + 'dagi 1 m² narxidan kelib chiqib qo’shimcha to’lov qiladi; '
               + 'to’lov qo’shimcha kelishuv rasmiylashtirilganidan keyin 10 bank kuni ichida amalga oshiriladi. ')
      + (farq > 0 ? 'O’lchovda haqiqiy maydon ' + son(sh.realMaydon) + ' kv.m — shartnomadagi ' + son(D.maydon) + ' kv.m dan ' + son(farq)
          + ' kv.m ko’p chiqqan; shu bandga asosan ' + (narx1 ? '1 m² narxi ' + pul(narx1) + ' so’mdan ' : '') + son(farq)
          + ' kv.m uchun qo’shimcha ' + pul(M.qoshimcha) + ' so’m hisoblangan'
        : 'qayta hisobda qo’shimcha ' + pul(M.qoshimcha) + ' so’m hisoblangan')
      + ', umumiy qiymat ' + pul(M.qiymat) + ' so’m bo’lgan.');
    if (!mTol && !(M.hujjat || []).some(h => h.kod === 'KELISHUV'))
      ogoh.push('DIQQAT: bu shablonda qo\'shimcha maydon to\'lovi ' + bnd('maydon') + 'ga ko\'ra QO\'SHIMCHA KELISHUV rasmiylashtirilgandan keyin talab qilinadi, '
        + 'ish hujjatlari ichida esa qo\'shimcha kelishuv yo\'q. Qo\'shimcha maydon qarzi (' + pul(M.qoshimcha) + ' so\'m) sudda rad etilishi mumkin — yurist xulosasi kerak.');
    // 19.11.2026: maydon farqi (QM) xat zanjiri — sudgacha tartib shu qarz bo'yicha ham bajarilgan bo'lishi kerak
    if (M.qm && M.qm.kerak && !M.qm.toliq)
      ogoh.push('DIQQAT: maydon farqi bo\'yicha sudgacha xat zanjiri tugallanmagan — '
        + (M.qm.bosqich ? M.qm.bosqich + '-xat (' + (M.qm.bosqich === 1 ? 'bildirishnoma' : 'ogohlantirish') + ') gacha yetkazilgan, talabnoma yuborilmagan'
                        : 'bitta ham maydon farqi xati yetkazilmagan')
        + '. Qo\'shimcha maydon qarzi ' + pul(M.qoshimcha) + ' so\'m shu holda da\'voga kiritilsa, sud shu qismni rad etishi mumkin.');
  }
  SHA.push('Shartnomaning ' + bnd('penya') + 'iga ko’ra kechiktirilgan har bir kun uchun muddati o’tgan qarzdorlikning 0,1 % miqdorida peniya hisoblanadi'
    + (B ? ' va ' + B.chekMatn : '') + '; shu bandga asosan peniya ' + pul(pen) + ' so’m qilib hisoblangan.');
  // Tizim peniyani 50 % chegara bilan hisoblaydi (yurist_malumot.js YH_CHEGARA) — shartnomadagi haqiqiy chegara boshqacha bo'lishi mumkin
  if (B && B.chek != null) {
    const asosChek = Math.round((B.chekAsos === 'shartnoma' ? (Number(sh.qiymatSh) || Number(M.qiymat) || 0) : (Number(M.muddati) || 0)) * B.chek);
    if (asosChek > 0 && pen > asosChek) ogoh.push('DIQQAT: shartnomaning ' + B.penya + '-bandiga ko\'ra peniya ' + (B.chek * 100) + ' % dan oshmaydi ('
      + pul(asosChek) + ' so\'m), tizim esa ' + pul(pen) + ' so\'m hisoblagan (tizimdagi chegara 50 %). Arizaga chegara summasi yozilishi kerak — yurist tasdiqlasin.');
  } else if (B && M.penya && M.penya.kesildi) {
    ogoh.push('Eslatma: bu shablonning ' + B.penya + '-bandida peniyaga yuqori chegara ko\'rsatilmagan. Tizim 50 % chegara qo\'llamoqda '
      + '(to\'liq hisoblangan ' + pul(M.penya.jami) + ' so\'m, arizada ' + pul(pen) + ' so\'m). 27/200 ishida Palata ham aynan shu 50 % summani yozgan. '
      + 'Chegarani o\'zgartirish kerakmi — yurist hal qilsin.');
  }

  // Direktor talabi 19.11.2026: oxirida hammasi qo'shilib, UNDIRILADIGAN JAMI SUMMA so'raladi — har qanday holatda
  const asosiyQ = Math.max(0, qarz - (Number(M.qoshimcha) || 0));
  const jamiU = qarz + pen;
  const SOR = '- ' + qosh(M.fish, 'ning') + ' hisobidan shartnomaga asosan to’lanmagan asosiy qarz ' + pul(asosiyQ) + ' so’m'
    + (Number(M.qoshimcha) > 0 ? ', shartnomaning ' + bnd('maydon') + 'iga asosan qo’shimcha maydon uchun qarz ' + pul(M.qoshimcha) + ' so’m' : '')
    + ', shartnomaning ' + bnd('penya') + 'iga asosan hisoblangan peniya ' + pul(pen) + ' so’m, JAMI ' + pul(jamiU) + ' (' + sozBilan(jamiU) + ') so’mni '
    + '“ANGOR KARVON SAROY” MCHJ foydasiga undirish haqida sud buyrug’i berishingizni;';

  const Q = {
    QARZDOR: fish + (s(M.fish).split(/\s+/).filter(Boolean).length < 3 ? ' ' + BOSH : ''),
    PASPORT: 'Pasport seriyasi: ' + (pas || BOSH),
    JSHSHIR: 'JShIR: ' + (jsh || BOSH),
    MANZIL: 'Manzili: ' + (manzil || BOSH),
    UNDIRUVCHI: UND,
    MUROJAAT: MUR,
    SORAYMIZ: SOR,
    ILOVA6: E ? '             6) MCHJning nomi o’zgarganligi haqida qaror nusxasi' : '',
  };

  const Z = XL.zipOqi(fs.readFileSync(SHABLON));
  let doc = Z['word/document.xml'].toString('utf8');
  doc = kopXatboshi(doc, '&lt;&lt;SHARTNOMA&gt;&gt;', SHA);
  doc = kopXatboshi(doc, '&lt;&lt;SHARTNOMA&gt;&gt;'.replace(/&lt;/g, '<').replace(/&gt;/g, '>'), SHA);
  Object.keys(Q).forEach(k => {
    const b = '&lt;&lt;' + k + '&gt;&gt;';   // XML da < va > qochirilgan bo'lishi mumkin
    doc = doc.split('<<' + k + '>>').join(esc(Q[k])).split(b).join(esc(Q[k]));
  });
  // bo'sh qolgan xatboshi (masalan ILOVA6) — matni bo'sh qator bo'lib qolmasin
  doc = doc.replace(/<w:p\b[^>]*>(?:(?!<\/w:p>)[\s\S])*?<w:t xml:space="preserve"><\/w:t>(?:(?!<\/w:p>)[\s\S])*?<\/w:p>/g, m => (/<w:drawing|<w:tbl/.test(m) ? m : ''));
  const qolgan = (doc.match(/&lt;&lt;[A-Z0-9_]+&gt;&gt;|<<[A-Z0-9_]+>>/g) || []);
  if (qolgan.length) ogoh.push('Shablonda to\'ldirilmagan belgi qoldi: ' + qolgan.join(', '));
  Z['word/document.xml'] = Buffer.from(doc, 'utf8');
  const buf = XL.zipYasa(Object.keys(Z).map(n => ({ nom: n, data: Z[n] })));
  const nom = 'Davo_arizasi_' + s(M.no).replace(/\//g, '-') + '_' + (M.famLat || 'mijoz') + '.docx';
  return { nom, mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', b64: buf.toString('base64'), ogoh, eski: E };
}

module.exports = { ariza, _ichki: { ism, pul, sanaMatn, pasportMatn, eski, NOM_SANA } };
