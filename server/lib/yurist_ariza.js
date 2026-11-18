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
    + qosh(M.fish, 'ga') + ' nisbatan ' + pul(qarz) + ' so’m qarzdorligini va ' + pul(pen) + ' so’m peniyani undirish bo‘yicha amaliy yordam berishni so’ragan.';

  const dokonMatn = (D.blok ? D.blok + '-blok, ' : '') + (D.qavat ? D.qavat + '-qavat, ' : '') + (D.no ? D.no + '-sonli ' : '')
    + (D.maydon ? son(D.maydon) + ' kv.m bo’lgan ' : '') + 'savdo do’koni';
  const bosh = Number(sh.boshSumma) || 0, boshKun = Number(sh.boshKun) || 0, oy = Number(sh.oy) || 0;
  let SHA = (E ? '“ANGOR INDEX” MCHJ xozirgi nomi “ANGOR KARVON SAROY” MCHJ' : '“ANGOR KARVON SAROY” MCHJ')
    + ' bilan ' + fish + ' o’rtasida ' + sanaMatn(M.sana) + ' №' + s(M.no)
    + '-sonli «Do’konni muddatli to’lov yoki bank krediti asosida sotib olish bo’yicha dastlabki oldi-sotdi shartnomasi” tuzilib, '
    + '“ANGOR KARVON SAROY” MCHJ xududidagi ' + dokonMatn + ' ' + pul(sh.qiymatSh || M.qiymat) + ' so’mga baholanib, ';
  SHA += bosh ? ('shundan ' + pul(bosh) + ' so’mni shartnoma imzolangan sanadan ' + (boshKun || 0) + ' kun ichida to’lashligi belgilanib, qolgan qismini esa ')
               : 'qiymati ';
  SHA += 'har oyda ' + pul(M.oylik) + ' so’mdan to’lanishi kelishilib, ' + (oy || 0) + ' оy muddatga shartnoma tuzilgan.';
  if (Number(M.qoshimcha) > 0 && Number(sh.realMaydon) > Number(D.maydon)) {
    const farq = Math.round((Number(sh.realMaydon) - Number(D.maydon)) * 100) / 100;
    SHA += ' Keyinchalik do’konning haqiqiy maydoni ' + son(sh.realMaydon) + ' kv.m ekanligi aniqlanib, farqi bo’lgan ' + son(farq)
        + ' kv.m uchun ' + pul(M.qoshimcha) + ' so’m qo’shimcha qiymat hisoblangan va shartnomaning umumiy qiymati ' + pul(M.qiymat) + ' so’mni tashkil etgan.';
  }

  const SOR = '- ' + qosh(M.fish, 'ning') + ' hisobidan shartnomaga asosan to’lanmagan ' + pul(qarz) + ' so’m qarzdorligini'
    + (Number(M.qoshimcha) > 0 ? ' (shundan asosiy qarz ' + pul(M.muddati || M.asosiy) + ' so’m, qo’shimcha maydon uchun qarz ' + pul(M.qoshimcha) + ' so’m)' : '')
    + ' va ' + pul(pen) + ' so’m peniyani “ANGOR KARVON SAROY” MCHJ foydasiga undirish haqida sud buyrug’i berishingizni;';

  const Q = {
    QARZDOR: fish + (s(M.fish).split(/\s+/).filter(Boolean).length < 3 ? ' ' + BOSH : ''),
    PASPORT: 'Pasport seriyasi: ' + (pas || BOSH),
    JSHSHIR: 'JShIR: ' + (jsh || BOSH),
    MANZIL: 'Manzili: ' + (manzil || BOSH),
    UNDIRUVCHI: UND,
    MUROJAAT: MUR,
    SHARTNOMA: SHA,
    SORAYMIZ: SOR,
    ILOVA6: E ? '             6) MCHJning nomi o’zgarganligi haqida qaror nusxasi' : '',
  };

  const Z = XL.zipOqi(fs.readFileSync(SHABLON));
  let doc = Z['word/document.xml'].toString('utf8');
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
