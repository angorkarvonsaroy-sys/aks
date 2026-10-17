// AKS TIZIM — ▶ BUGUNGI ISH (Qadam.gs v2.1) o'qishi serverda: qadamBoshlang, qadamMijoz, qadamNazorat, qadamJamoa (+ Ijro.gs ijroQisqa_).
// Natija eski tizim bilan bir xil. Yozuvlar (qadamChora, qadamKechiktir, qadamOtkaz, …) — hali ko'prik.
// qdSnap_ (ertalabki navbat, Script Properties QD_NAVBAT_*) — o'qish/yozish Koprik v1.4 koprikQdSnap orqali: eski tizim bilan BITTA ro'yxat.
// Koprik eski bo'lsa — Redis'dagi kunlik ro'yxat (faqat server ichida).
'use strict';
const S = require('./sessiya');
const V = require('../lib/varaq');
const J = require('../lib/jurnallar');
const U = require('../lib/undiruv_yordam');
const X = require('../lib/xat_yordam');
const P = require('../lib/portfel');
const TS = require('../lib/tasdiq');
const koprik = require('./koprik');
const { redis } = require('../lib/db');

const QD_MAQSAD = 20, QD_TEL = '+998 95-557-88-88';
const QD_KUN = ['yakshanba', 'dushanba', 'seshanba', 'chorshanba', 'payshanba', 'juma', 'shanba'];
const QD_OY = ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr'];
const UND_CHORA = ['Телефон', 'Ташриф (манзилига бориб)', 'Офисда суҳбат', 'СМС/Телеграм'];
const UND_NATIJA = ['Боғланилди', 'Боғланиб бўлмади', 'Тўлашдан бош тортди'];
const UND_MUHLAT_KUN = 7;
const BEKOR_YOPIQ = ['Bekor qilindi', 'Rad etildi', 'Qaytarildi'];
const TOP_HJ_TUR = { SHARTNOMA: 1, PASPORT: 1, NOTARIAL: 1, QOSHIMCHA_KELISHUV: 1, YOZISHMA: 1 };
const QD_GURUH = [
  ['olib', '📌 Topshiriq', b => !!b.topId],
  ['xat', '✉ Xat yetkazilmagan', b => /yetkaz/.test(b.t)],
  ['vada', '⚠ Va\'da buzilgan', b => /Va'da buzildi|Va'daning bir qismini/.test(b.t)],
  ['davo', '⚖ Da\'vo muddati', b => /Da'vo muddati/.test(b.t)],
  ['bekor', '✂ To\'lov umuman yo\'q', b => /bekor qilish/.test(b.t)],
  ['yurist', '🟢 Yuristga tayyor', b => b.d === 'y'],
  ['xatchiq', '✉ Xat chiqarish vaqti', b => /chiqaring/.test(b.t)],
  ['chora', '📞 Chora yetishmaydi', b => /jurnalga yozing/.test(b.t)],
  ['jim', '🔕 Uzoq vaqt aloqa yo\'q', b => /bog'laning/.test(b.t)],
  ['boshqa', '📋 Boshqa ish', b => true]];
const QD_SMS_MATN = {
  as1: 'Hurmatli {ism}! ANGOR KARVON SAROY: {no}-shartnoma bo\'yicha {summa} so\'m muddati o\'tgan qarzingiz bor. Iltimos, tezda to\'lang. Tel: {tel}',
  as2: 'Hurmatli {ism}! {no}-shartnoma bo\'yicha eslatma xatimizdagi muddat o\'tdi, {summa} so\'m to\'lanmadi. Ogohlantirish xati yuboriladi. Tel: {tel}',
  as3: 'Hurmatli {ism}! {no}-shartnoma bo\'yicha ogohlantirishdan keyin ham {summa} so\'m to\'lanmadi. Sudgacha talabnoma tayyorlanmoqda. Tel: {tel}',
  qm1: 'Hurmatli {ism}! {no}-shartnoma: do\'koningizning haqiqiy maydoni {farq} kv.m katta chiqdi. Qo\'shimcha maydon uchun {summa} so\'m to\'lash kerak. Tel: {tel}',
  qm2: 'Hurmatli {ism}! {no}-shartnoma bo\'yicha qo\'shimcha maydon uchun {summa} so\'m hali to\'lanmadi. Ogohlantirish xati yuboriladi. Tel: {tel}',
  qm3: 'Hurmatli {ism}! {no}-shartnoma bo\'yicha qo\'shimcha maydon uchun {summa} so\'m bo\'yicha talabnoma tayyorlanmoqda. Tel: {tel}',
  buzildi: 'Hurmatli {ism}! {sana} ga {summa} so\'m to\'lashni va\'da bergan edingiz, to\'lov kelmadi. Iltimos, bugun to\'lang. Tel: {tel}',
  qisman: 'Hurmatli {ism}! {sana} ga {summa} so\'m va\'da bergan edingiz, {tolandi} so\'m to\'ladingiz. Qolgan {qoldi} so\'mni to\'lang. Tel: {tel}',
  vada1: 'Hurmatli {ism}! Ertaga ({sana}) {summa} so\'m to\'lashni va\'da bergansiz. ANGOR KARVON SAROY, tel: {tel}',
  vada0: 'Hurmatli {ism}! Bugun ({sana}) {summa} so\'m to\'lov kuningiz. ANGOR KARVON SAROY, tel: {tel}',
  nazorat: 'Hurmatli {ism}! {no}-shartnoma bo\'yicha xatimizdagi to\'lov muddati {sana}. Qarzingiz {summa} so\'m. Iltimos, o\'z vaqtida to\'lang. Tel: {tel}',
  nazorat2: 'Hurmatli {ism}! {no}-shartnoma bo\'yicha xatimizdagi to\'lov muddati o\'tdi. Qarzingiz {summa} so\'m. Iltimos, bugun to\'lang. Tel: {tel}' };
// Ijro.gs
const IJRO_S = ['ID', 'Sana', 'Xodim', 'Tur', 'Nomi', 'Ogirlik', 'Ball', 'Shartnoma', 'Mijoz', 'Tafsilot', 'Holati', 'Uzr_sababi', 'Uzr_kim', 'Tushuntirish', 'Tushuntirish_vaqt', 'Kalit', 'Yozildi'];
const IJRO_KS = ['Sana', 'Xodim', 'Reja_talab', 'Reja_bajardi', 'Nazorat_talab', 'Nazorat_bajardi', 'Xat_talab', 'Xat_ozkunida', 'Top_talab', 'Top_vaqtida', 'Foiz', 'Yozildi'];
const IJRO_TUR_OGIR = { xat3: true, soxta: true };
const IJRO_ZINA = [1, 3, 5], IJRO_OGIR_BALL = 3, IJRO_SOXTA_MINUS = 10;

const s = v => String(v == null ? '' : v);
const kun = U.kun;
const qdPul = n => Math.round(Number(n) || 0).toLocaleString('ru-RU').replace(/[ ,]/g, ' ');
const qdKalit = t => String(t || '').replace(/\d+/g, 'N').replace(/\s*\([^)]*\)/g, '').replace(/\s+/g, ' ').trim();
const qdQisqa = m => ({ no: m.no, fish: m.fish, dokon: m.dokon, bugun: m.bugun });
function qdXatNom(h) { return /^QM_/.test(String(h.shablon || '')) ? (['', 'Maydon farqi bildirishnomasi', 'Maydon farqi ogohlantirish xati', 'Maydon farqi talabnomasi'][h.bosqich] || 'Maydon farqi xati')
  : (['', '1-ogohlantirish xati', '2-ogohlantirish xati', 'Talabnoma'][h.bosqich] || 'Ogohlantirish xati'); }

// Bekor.gs xodimTeng_/xodimNorm_ — xodim ismini moslashuvchan solishtirish
function xodimNorm(x) {
  const K = { 'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'ё': 'yo', 'ж': 'j', 'з': 'z', 'и': 'i', 'й': 'y', 'к': 'k', 'л': 'l',
    'м': 'm', 'н': 'n', 'о': 'o', 'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u', 'ф': 'f', 'х': 'x', 'ц': 'ts', 'ч': 'ch', 'ш': 'sh', 'щ': 'sh',
    'ъ': '', 'ы': 'i', 'ь': '', 'э': 'e', 'ю': 'yu', 'я': 'ya', 'ў': 'o', 'қ': 'k', 'ғ': 'g', 'ҳ': 'x' };
  let t = String(x || '').toLowerCase().replace(/[ʻʼ'`’‘]/g, '');
  t = t.split('').map(c => K[c] !== undefined ? K[c] : c).join('');
  t = t.replace(/kh/g, 'x').replace(/(^|[^sc])h/g, '$1x').replace(/q/g, 'k').replace(/[^a-z\s]/g, ' ').replace(/\s+/g, ' ').trim();
  return t.split(' ');
}
function xodimTeng(a, b) {
  const A = xodimNorm(a), B = xodimNorm(b);
  if (!A[0] || !B[0]) return false;
  const f1 = A[0], f2 = B[0];
  const famOk = f1 === f2 || (f1.slice(0, 6) === f2.slice(0, 6) && Math.abs(f1.length - f2.length) <= 2);
  if (!famOk) return false;
  const i1 = A[1] || '', i2 = B[1] || '';
  if (!i1 || !i2) return true;
  return i1.indexOf(i2) === 0 || i2.indexOf(i1) === 0;
}
const qdTeng = xodimTeng;

// ------------------------------------------------------------------ manbalar
async function qdXodimlar() {
  return (await V.qatorlar('07_Xodimlar')).filter(({ x }) => s(x[1]).trim() && s(x[10]).trim() === 'Ishlayapti').map(({ x }) => {
    const h = s(x[18]).toLowerCase().split(/[\s,;]+/).filter(Boolean); const fish = s(x[1]).trim();
    return { fish, ism: fish.split(/\s+/)[1] || fish, huquq: h, tg: s(x[20]).trim(), undiruvchi: h.indexOf('undiruv') >= 0 && h.indexOf('admin') < 0 }; });
}
async function qdXodimTel(fish) {
  try { const r = (await V.qatorlar('07_Xodimlar')).find(({ r }) => qdTeng(r[1], fish));
    const t = r ? String(r.r[5] || '').replace(/\D/g, '').replace(/^998/, '') : '';
    if (t.length === 9) return '+998 ' + t.slice(0, 2) + ' ' + t.slice(2, 5) + ' ' + t.slice(5, 7) + ' ' + t.slice(7);
  } catch (e) { }
  return QD_TEL;
}
// 06n — bugungi «o'tkazildi»/«kechiktirildi» yozuvlari (xom: A sana, I vaqt)
async function qdJurnal(bugun) {
  return (await V.qatorlar('06n_Qadam_kun')).filter(({ x }) => V.iso(x[0]) === bugun)
    .map(({ x, r }) => ({ xodim: s(x[1]), no: s(x[2]).trim(), fish: s(x[3]), holat: s(x[4]), sabab: s(x[5]), qadam: s(x[6]),
      vaqt: typeof x[8] === 'number' ? soatDaq(x[8]) : (/(\d{2}):(\d{2})/.exec(s(r[8])) || ['', ''])[0] }));
}
function soatDaq(v) { const sek = Math.round((v - Math.floor(v)) * 86400); return String(Math.floor(sek / 3600)).padStart(2, '0') + ':' + String(Math.floor(sek % 3600 / 60)).padStart(2, '0'); }
async function qdBekorOchiq() { const B = {}; (await J.bekorJurnal()).forEach(z => { if (BEKOR_YOPIQ.indexOf(z.holati) < 0) B[s(z.no).trim()] = 1; }); return B; }
// bugungi haqiqiy ishlar (jurnallardan): shartnoma → [{tur, kim, vaqt, srt, ik, matn, chora?, vada?}]
async function qdBugungi(bugun, dmy, XJ) {
  const A = {}; const qo = (no, a) => { no = s(no).trim(); if (!no) return; (A[no] = A[no] || []).push(a); };
  const hm = v => { const m = /(\d{2}):(\d{2})/.exec(s(v)); return m ? m[1] + ':' + m[2] : ''; };
  const IK = { 'Телефон': '📞', 'Ташриф (манзилига бориб)': '🏠', 'Офисда суҳбат': '🏢', 'СМС/Телеграм': '💬' };
  (await V.qatorlar('06_Undiruv_jurnali')).forEach(({ x: r, r: rr }) => { if (r[0] == null || r[0] === '') return;
    const kBor = typeof r[10] === 'number'; const kn = kBor ? V.iso(r[10]) : V.iso(r[1]);
    if (kn !== bugun) return;
    const chora = s(r[4]).trim(), natija = s(r[17]).trim(), vq = kBor ? soatDaq(r[10]) : '';
    const vada = !!V.iso(r[6]) && Number(r[7]) > 0, mz = s(r[5]).replace(/\s+/g, ' ').trim();
    if (chora === 'Ёзма огоҳлантириш') qo(r[2], { tur: 'yetkazdi', kim: s(r[9]), vaqt: vq, srt: vq, ik: '✉', matn: 'Xat yetkazildi: ' + mz.slice(0, 110) });
    else if (UND_CHORA.indexOf(chora) >= 0) qo(r[2], { tur: 'chora', kim: s(r[9]), vaqt: vq, srt: vq, ik: IK[chora] || '📞', chora, vada,
      matn: (chora === 'Ташриф (манзилига бориб)' ? 'Ташриф (уйига бориб)' : chora) + (natija ? ' — ' + natija : '') + (mz ? ': «' + mz.slice(0, 90) + (mz.length > 90 ? '…' : '') + '»' : '')
        + (vada ? ' · va\'da ' + V.iso(r[6]).slice(8, 10) + '.' + V.iso(r[6]).slice(5, 7) + ', ' + qdPul(r[7]) : '') });
  });
  (XJ || []).forEach(h => {
    const bk = /Bekor: .*\((.+?), (\d{2}\.\d{2}\.\d{4}) (\d{2}:\d{2})\)\s*$/.exec(String(h.izoh || ''));
    if (h.holati === 'Bekor') { if (bk && bk[2] === dmy) qo(h.no, { tur: 'xatbekor', kim: bk[1], vaqt: bk[3], srt: bk[3], ik: '✕', matn: qdXatNom(h) + ' ' + h.raqam + ' bekor qilindi' }); return; }
    if (String(h.vaqt).indexOf(dmy) !== 0) return;
    qo(h.no, { tur: 'xat', kim: h.kim, vaqt: hm(h.vaqt), srt: hm(h.vaqt), ik: '✉', matn: qdXatNom(h) + ' ' + h.raqam + ' chiqarildi' + (h.holati === 'Tayyorlandi' ? ' — hali yetkazilmagan' : '') }); });
  (await J.hujjatJurnal()).forEach(h => { if (h.holati !== 'Faol' || String(h.vaqt).indexOf(dmy) !== 0 || /^(XAT_|POCHTA|YOZISHMA)/.test(String(h.turi || ''))) return;
    qo(h.no, { tur: 'skan', kim: h.kim, vaqt: hm(h.vaqt), srt: hm(h.vaqt), ik: '📎', matn: 'Skan yuklandi: ' + String(h.turi || '').toLowerCase().replace(/_/g, ' ') }); });
  (await J.yuIshlar()).forEach(i => { if (String(i.sorovVaqt).indexOf(dmy) !== 0) return;
    qo(i.no, { tur: 'yurist', kim: i.undiruvchi, vaqt: hm(i.sorovVaqt), srt: hm(i.sorovVaqt), ik: '⚖', matn: 'Yuristga o\'tkazish so\'raldi' + (i.holati ? ' — ' + i.holati : '') }); });
  (await J.bekorJurnal()).forEach(z => { if (String(z.vaqt).indexOf(dmy) !== 0) return;
    qo(z.no, { tur: 'bekor', kim: z.kim, vaqt: hm(z.vaqt), srt: hm(z.vaqt), ik: '✂', matn: 'Bekor qilish so\'rovi kiritildi ' + (z.raqam || '') }); });
  return A;
}
async function qdTopshiriq(dmy, A, RX, bugun) {
  const T = {}; const R = await J.topRows();
  if (RX) R.forEach(t => { const p = String(t.kalit || '').split('|'); if (p[0] !== 'otkaz' || p[2] !== bugun) return;
    RX[p[1]] = { holat: (t.holati === 'Jarayonda' || t.holati === 'Tekshiruvda') ? 'kutish' : /^Rad/.test(t.dalil) ? 'rad' : 'berildi', izoh: String(t.dalil || '') }; });
  const hm = v => { const m = /(\d{2}):(\d{2})/.exec(s(v)); return m ? m[1] + ':' + m[2] : ''; };
  R.forEach(t => { if (!t.no) return; const no = String(t.no).trim();
    if (t.holati === 'Jarayonda' || t.holati === 'Tekshiruvda') (T[no] = T[no] || []).push(J.topKor(t));
    if ((t.holati === 'Bajarildi' || t.holati === 'Tekshiruvda') && String(t.yopildi).indexOf(dmy) === 0 && t.yopdi && t.yopdi !== 'tizim')
      (A[no] = A[no] || []).push({ tur: 'top', kim: t.yopdi, vaqt: hm(t.yopildi), srt: hm(t.yopildi), ik: '📌', matn: 'Topshiriq: ' + t.sarlavha + (t.dalil ? ' — ' + String(t.dalil).slice(0, 80) : '') }); });
  return T;
}
// ertalabki navbat (qdSnap_): eski tizim Script Properties — Koprik v1.4 orqali; bo'lmasa Redis. Qaytaradi {no: 1}
async function qdSnap(kod, fish, bugun, navbatNo, tugadiNo) {
  const kalit = 'qd:snap:' + bugun + ':' + Buffer.from(String(fish)).toString('base64url');
  let S0 = {}; try { const v = await redis.get(kalit); if (v) JSON.parse(v).forEach(n => S0[n] = 1); } catch (e) { }
  const yangiKun = !Object.keys(S0).length;
  if (yangiKun && koprik.bor()) {   // kun boshida — eski tizimdagi ro'yxat (u yerda allaqachon bo'lishi mumkin)
    try { const r = await koprik.chaqir('koprikQdSnap', kod, [fish, bugun, [], []]); if (r && Array.isArray(r.n)) r.n.forEach(n => S0[n] = 1); } catch (e) { if (!/topilmadi/.test(e.message)) console.error('qdSnap (ko\'prik):', e.message); }
  }
  const yangi = []; const hali = !Object.keys(S0).length;
  navbatNo.concat(hali ? tugadiNo : []).forEach(n => { if (!S0[n]) { S0[n] = 1; yangi.push(n); } });
  if (yangi.length) {
    try { await redis.set(kalit, JSON.stringify(Object.keys(S0)), 'EX', 36 * 3600); } catch (e) { }
    if (koprik.bor()) koprik.chaqir('koprikQdSnap', kod, [fish, bugun, yangi, []]).catch(e => { if (!/topilmadi/.test(e.message)) console.error('qdSnap yozish (ko\'prik):', e.message); });
  } else if (yangiKun) { try { await redis.set(kalit, JSON.stringify(Object.keys(S0)), 'EX', 36 * 3600); } catch (e) { } }
  return S0;
}

// ------------------------------------------------------------------ bitta mijoz (qdMijoz_)
function qdTur(t) {
  if (/so'rovi direktorda/.test(t)) return { tur: 'tezlashtir' };
  if (/talabnoma muddati/.test(t)) return { tur: 'info' };
  if (/^JSHSHIR yo'q/.test(t)) return { tur: 'malumot', maydon: 'jshshir' };
  if (/^Otasining ismi yo'q/.test(t)) return { tur: 'malumot', maydon: 'ota' };
  if (/^Telefon raqami yo'q/.test(t)) return { tur: 'malumot', maydon: 'tel' };
  if (/direktorga ayting/.test(t)) return { tur: 'info' };
  if (/bekor qilish uchun/.test(t)) return { tur: 'bekor' };
  if (/yetkazmang/.test(t)) return { tur: 'xatbekor', huquq: 'xat', raqam: (/(OG-\d{4}\/\d{4})/.exec(t) || [])[1] || '' };
  if (/yetkaz/.test(t)) return { tur: 'yetkaz', huquq: 'xat' };
  if (/chiqaring/.test(t)) return { tur: 'xat', huquq: 'xat' };
  if (/skanini yuklang/.test(t)) return { tur: 'skan', huquq: 'hujjat' };
  if (/yuristga o'tkazishni so'rang/i.test(t)) return { tur: 'yurist' };
  if (/Va'da buzildi/.test(t)) return { tur: 'aloqa', chora: ['Телефон', 'Ташриф (манзилига бориб)', 'Офисда суҳбат'], sms: 'buzildi' };
  if (/^Va'daning bir qismini/.test(t)) return { tur: 'aloqa', chora: ['Телефон', 'Ташриф (манзилига бориб)', 'Офисда суҳбат'], sms: 'qisman' };
  if (/^Qo'ng'iroq qiling/.test(t)) return { tur: 'aloqa', chora: ['Телефон'] };
  if (/^Uyiga boring/.test(t)) return { tur: 'aloqa', chora: ['Ташриф (манзилига бориб)'], tashrif: true };
  if (/^SMS\/Telegram/.test(t)) return { tur: 'aloqa', chora: ['СМС/Телеграм'] };
  if (/bog'laning/.test(t)) return { tur: 'aloqa', chora: UND_CHORA.slice() };
  return { tur: 'info' };
}
const TOP_HJ_NOM = TS.TOP_HJ_NOM;
const qdYuHj = t => { const r = String(t.kalit || '').split('|')[2] || ''; return r === 'JSHSHIR' || !!TOP_HJ_TUR[r]; };
function qdMijoz(x, fish, act0, top0, bekorOchiq, o, Jn) {
  const act = act0.filter(a => !a.kim || qdTeng(a.kim, fish));
  const kech = {}; Jn.forEach(r => { if (r.no === x.no && r.holat === 'Kechiktirildi' && qdTeng(r.xodim, fish)) kech[qdKalit(r.qadam)] = r; });
  const yop = Jn.filter(r => r.no === x.no && r.holat !== 'Kechiktirildi' && qdTeng(r.xodim, fish)).pop() || null;
  const lev = { q: 0, y: 1, s: 2, k: 3 };
  const B = (x.buyruq || []).map((b, i) => ({ b, i, tr: qdTur(b.t) }))
    .sort((a, c) => (lev[a.b.d] - lev[c.b.d]) || ((a.tr.tashrif ? 1 : 0) - (c.tr.tashrif ? 1 : 0)) || (a.i - c.i));
  const qadam = []; let qoldi = 0, kutishN = 0, yuBor = false;
  const smsT = (x.kAS && x.kAS.yetishmaydi && x.kAS.yetishmaydi.indexOf('СМС/Телеграм') >= 0) ? 'as' + x.kAS.bosqich
    : (x.kQM && x.kQM.yetishmaydi && x.kQM.yetishmaydi.indexOf('СМС/Телеграм') >= 0) ? 'qm' + x.kQM.bosqich
    : (x.kAS && x.kAS.mumkin && x.kAS.bosqich) ? 'as' + Math.min(3, x.kAS.bosqich) : 'as1';
  B.forEach(z => { const b = z.b, tr = z.tr, k = qdKalit(b.t);
    if (tr.tur === 'yurist') { if (yuBor) return; yuBor = true; }
    let majburiy = (b.d === 'q' || b.d === 's' || b.d === 'y') && tr.tur !== 'info' && tr.tur !== 'tezlashtir', holat = 'kutadi', izoh = '';
    if (tr.tur === 'bekor' && bekorOchiq) { majburiy = false; tr.tur = 'info'; izoh = 'Bekor qilish so\'rovi kiritilgan — direktor qarorini kutmoqda.'; }
    if (tr.huquq && !o.huquq[tr.huquq]) { majburiy = false; izoh = 'Sizda bu bo\'limga ruxsat yo\'q — direktorga ayting.'; }
    if (tr.tur === 'aloqa') { const m = act.filter(a => a.tur === 'chora' && tr.chora.indexOf(a.chora) >= 0).pop(); if (m) { holat = 'bajarildi'; izoh = (m.vaqt ? m.vaqt + ' · ' : '') + m.matn; } }
    if (holat === 'kutadi' && majburiy && kech[k]) { holat = 'kechiktirildi'; izoh = 'Ertaga: «' + kech[k].sabab + '»'; }
    if (holat === 'kutadi' && !majburiy) holat = (tr.tur === 'info' || izoh) ? 'info' : 'ixtiyoriy';
    if (holat === 'kutadi' && tr.tur === 'yetkaz' && /^Xatni bugun yetkazing/.test(b.t)) { holat = 'kutish'; izoh = 'Savatda — isbot (imzolangan nusxa yoki kvitansiya) yuklanganda yopiladi.'; }
    if (holat === 'kutadi') qoldi++;
    if (holat === 'kutish') kutishN++;
    const sms = tr.tur !== 'aloqa' ? '' : tr.sms ? tr.sms : smsT;
    qadam.push({ k, t: b.t, d: b.d, tur: tr.tur, chora: tr.chora || [], holat, izoh, majburiy, maydon: tr.maydon || '', raqam: tr.raqam || '', seriya: /[Mm]aydon farqi/.test(b.t) ? 'QM' : 'AS', sms }); });
  const ob = (top0 || []).find(t => /^olib\|/.test(String(t.kalit || '')) && (t.holati === 'Jarayonda' || t.holati === 'Tekshiruvda') && qdTeng(t.kimga, fish));
  if (ob) { const kut = ob.holati === 'Tekshiruvda';
    if (kut) qadam.unshift({ k: 'olib', t: 'Mijozni direktor huzuriga olib kelish — siz «olib keldim» dedingiz', d: 'k', tur: 'info', chora: [], holat: 'info', izoh: 'Direktor tasdig\'ini kutmoqda.', majburiy: false, maydon: '', raqam: '', seriya: 'AS', sms: '' });
    else { qadam.unshift({ k: 'olib', t: 'Mijozni direktor huzuriga olib keling — shartnomani qayta tuzish', d: 'q', tur: 'olib', chora: [], holat: 'kutadi',
      izoh: 'Direktor topshirig\'i · muddat ' + ob.muddat + (ob.kechikkan ? ' · ⛔ muddati o\'tgan — bajarilmaguncha har kuni ijro minusi' : ''), majburiy: true, maydon: '', raqam: '', seriya: 'AS', sms: '', topId: ob.id, muddat: ob.muddat, kech: !!ob.kechikkan });
      qoldi++; } }
  (top0 || []).forEach(t => { const p = String(t.kalit || '').split('|'), men = qdTeng(t.kimga, fish), och = t.holati === 'Jarayonda', tek = t.holati === 'Tekshiruvda';
    if (!(och || tek)) return;
    const kch = !!t.kechikkan, mz = 'Direktor topshirig\'i · muddat ' + t.muddat + (kch ? ' · ⛔ muddati o\'tgan' : '');
    if (p[0] === 'talab' && men) {
      if (tek) qadam.unshift({ k: 'talab', t: '📨 Talabnoma yetkazildi — direktor isbotni tekshirmoqda', d: 'k', tur: 'info', chora: [], holat: 'info', izoh: t.dalil || '', majburiy: false, maydon: '', raqam: '', seriya: 'AS', sms: '' });
      else { qadam.unshift({ k: 'talab', t: '📨 Talabnomani chiqaring va bugun yetkazing' + (p[2] === 'qm' ? ' (asosiy qarz + qo\'shimcha maydon)' : ''), d: 'q', tur: 'talab', chora: [], holat: 'kutadi',
        izoh: mz + (t.izoh ? ' · ' + t.izoh : ''), majburiy: true, maydon: '', raqam: '', seriya: 'AS', sms: '', topId: t.id, muddat: t.muddat, kech: kch, qm: p[2] === 'qm' }); qoldi++; }
    } else if (p[0] === 'hj' && men && och) {
      qadam.unshift({ k: 'hj|' + p[2], t: '📎 ' + (TOP_HJ_NOM[p[2]] || p[2]) + ' — yuklang', d: 'q', tur: 'hj', hjTur: p[2], chora: [], holat: 'kutadi',
        izoh: mz + (t.izoh ? ' · ' + t.izoh : ''), majburiy: true, maydon: p[2] === 'JSHSHIR' ? 'jshshir' : '', raqam: '', seriya: 'AS', sms: '', topId: t.id, muddat: t.muddat, kech: kch }); qoldi++;
    } else if (p[0] === 'skanu' && men && och) {
      const sk = qadam.find(z => z.tur === 'skan');
      if (sk) { sk.topId = t.id; sk.muddat = t.muddat; sk.kech = kch; sk.izoh = 'Kotiba arxivdan topa olmadi — mijozdan nusxa oling · muddat ' + t.muddat; if (sk.holat !== 'kutadi') { sk.holat = 'kutadi'; sk.majburiy = true; qoldi++; }
        qadam.splice(qadam.indexOf(sk), 1); qadam.unshift(sk); }
      else { qadam.unshift({ k: 'skanu', t: 'Shartnoma nusxasini mijozdan olib, skanini yuklang', d: 'q', tur: 'skan', chora: [], holat: 'kutadi', izoh: 'Kotiba arxivdan topa olmadi · muddat ' + t.muddat + (kch ? ' · ⛔ muddati o\'tgan' : ''),
        majburiy: true, maydon: '', raqam: '', seriya: 'AS', sms: '', topId: t.id, muddat: t.muddat, kech: kch }); qoldi++; }
    } else if (p[0] === 'skanq' && och) {
      qadam.push({ k: 'skanq', t: 'Shartnoma skani yo\'q — ' + (men ? 'arxivdan qidiring' : 'kotiba (' + t.kimga + ') arxivdan qidirmoqda'), d: 'k', tur: 'info', chora: [], holat: 'info', izoh: 'Topilmasa — topshiriq sizga o\'tadi: mijozdan nusxa olib kelasiz.', majburiy: false, maydon: '', raqam: '', seriya: 'AS', sms: '' });
    } });
  const ochiqQ = qadam.filter(z => z.holat === 'kutadi');
  let gi = QD_GURUH.findIndex(g => (ochiqQ.length ? ochiqQ : qadam).some(z => g[2](z))); if (gi < 0) gi = QD_GURUH.length - 1;
  const faol = act.length > 0;
  const M = Number(x.muddati) > 100000, xatKech = (x.xatKechikdi > 0 || (x.xatEskirgan && x.xatEskirgan.length)) ? 1 : 0;
  const topQ = qadam.find(z => z.topId && z.holat === 'kutadi'), xavf = (x.xavf || []).slice();
  const nom = topQ ? '📌 ' + (topQ.tur === 'olib' ? 'Direktor huzuriga olib kelish' : topQ.tur === 'talab' ? 'Talabnoma topshirig\'i' : topQ.tur === 'hj' ? 'Hujjat topshirig\'i' : 'Skan topshirig\'i')
    : x.davoOtgan && M ? '⚖ Da\'vo muddati o\'tgan — yuristga' : x.davoShosh && M ? '⏳ Da\'vo muddati yaqin (' + x.davoQolgan + ' kun)' : xatKech ? '✉ Xat yetkazilmagan' : xavf.length && M ? '🔥 Undirish imkoni kam' : QD_GURUH[gi][1];
  return { no: x.no, fish: x.fish, mid: x.mid, dokon: x.dokon, tel: String(x.tel || '').split(',').map(z => z.trim()).filter(Boolean), manzil: x.manzil,
    muddati: x.muddati, jami: x.jami, asosiy: x.asosiy, qoshimcha: x.qoshimcha, oylik: x.oylik, kechikkan: x.kechikkan, jimKun: x.jimKun, davoKun: x.davoKun, oxirgiTolov: x.oxirgiTolov || null, sekin: x.sekin || null,
    xavf, yuRad: x.yuRad || null,
    oxirgi: x.oxirgi, vada: x.vada, xat: x.xat, skan: x.skan, davoQolgan: x.davoQolgan, davoOtgan: x.davoOtgan, davoShosh: !!x.davoShosh,
    faqatYurist: !!(x.davoOtgan && M), xatKech, farq: x.farq || 0, sms: smsT,
    guruh: QD_GURUH[gi][0], guruhNom: nom, guruhN: gi,
    qadam, top: top0.filter(t => qdTeng(t.kimga, fish)).map(t => ({ id: t.id, sarlavha: t.sarlavha, izoh: t.izoh, qoida: t.qoida, muddat: t.muddat, holati: t.holati, kechikkan: t.kechikkan,
      avto: /^(davo|vada|tolov|xat|skan|bekor|bufer|talab|hj|skanq|skanu|skanz)$/.test(t.qoida) || (t.qoida === 'yutop' && qdYuHj(t)), qolda: /^(qayta|devon)\|/.test(t.kalit), isbotMaj: t.isbotMaj || '', tasdiqchi: TS.topTasdiqchi(t) })),
    bugun: act.slice().sort((a, b) => a.srt < b.srt ? -1 : 1).map(a => ({ vaqt: a.vaqt, ik: a.ik, matn: a.matn })),
    qoldi, kutish: kutishN, savat: qoldi === 0 && kutishN > 0, faol, boshlangan: faol && qoldi > 0 ? 1 : 0, tugadi: faol && qoldi === 0 && kutishN === 0, yopildi: yop ? { holat: yop.holat, sabab: yop.sabab } : null };
}

// ------------------------------------------------------------------ HISOB (qdHisob_)
async function qdHisob(kod, fishlar, bugun, XD) {
  XD = XD || await qdXodimlar();
  const dmy = bugun.split('-').reverse().join('.');
  const F = {}; fishlar.forEach(f => { const x = XD.find(z => qdTeng(z.fish, f)); const h = x ? x.huquq : [];
    const bor = k => h.indexOf('admin') >= 0 || h.indexOf(k) >= 0;
    F[f] = { hamma: [], navbat: [], savat: [], bajarildi: [], qoshimcha: [], otkaz: [], kech: [], huquq: { xat: bor('xat'), hujjat: bor('hujjat') }, L: [] }; });
  const egasi = fish => fishlar.find(f => qdTeng(f, fish));
  const Pf = await P.undPortfel(x => !!x.undiruvchi && !!egasi(x.undiruvchi), kod);
  const XJ = await J.xatJurnal();
  const XO = {}; XJ.forEach(h => { if (h.holati === 'Tayyorlandi') (XO[String(h.no).trim()] = XO[String(h.no).trim()] || []).push({ raqam: h.raqam, sana: h.sana, nom: qdXatNom(h) }); });
  const A = await qdBugungi(bugun, dmy, XJ);
  const RX = {};
  const TP = await qdTopshiriq(dmy, A, RX, bugun);
  const BO = await qdBekorOchiq();
  const Jn = await qdJurnal(bugun);
  const RAD = {}; (await J.yuIshlar()).forEach(i => { RAD[i.no] = i.holati === 'Rad etildi' ? { sabab: i.izoh || 'oldingi so\'rov rad etilgan', sana: i.tasdiqladi } : null; });
  Jn.forEach(r => { const f = egasi(r.xodim); if (!f) return; if (r.holat === 'Kechiktirildi') F[f].kech.push(r); else F[f].otkaz.push(r); });
  Pf.royxat.forEach(x => { const f = egasi(x.undiruvchi); if (f) F[f].L.push(x); });
  for (const f of fishlar) {
    const o = F[f];
    o.L.forEach(x => { x.yuRad = RAD[x.no] || null; const m = qdMijoz(x, f, A[x.no] || [], TP[x.no] || [], !!BO[x.no], o, Jn); m.xatlar = XO[x.no] || [];
      m.qadam.forEach(z => { if (z.tur !== 'talab') return; const t = (TP[x.no] || []).find(y => String(y.id) === String(z.topId)); if (t) z.tx = TS.topTalabHolat(t, XJ); });
      if (RX[x.no]) { m.ruxsat = RX[x.no].holat; m.ruxsatIzoh = RX[x.no].izoh; if (m.ruxsat === 'kutish') { m.guruhNom = '⏳ Direktor ruxsati kutilmoqda'; } }
      o.hamma.push(m); });
    o.savat = o.hamma.filter(m => m.savat && !m.yopildi);
    const NZ = o.L.map(x => ({ x, n: P.undNazorat(x, bugun) })).filter(z => z.n);
    const nzK = NZ.filter(z => z.n.kerak);
    o.nazorat = { jami: NZ.length, kerak: nzK.length, qilinmadi: nzK.filter(z => !z.n.qilindi).length, eslatma: nzK.filter(z => /^eslatma/.test(z.n.kerak)).length,
      qilinmaganlar: nzK.filter(z => !z.n.qilindi).map(z => ({ no: z.x.no, fish: z.x.fish, kerak: z.n.kerak })) };
    const navbat = o.hamma.filter(m => !m.tugadi && !m.yopildi && m.qoldi > 0);
    const snap = await qdSnap(kod, f, bugun, navbat.map(m => m.no), o.hamma.filter(m => m.tugadi).map(m => m.no));
    o.hamma.forEach(m => { m.navbatda = !!snap[m.no]; });
    o.bajarildi = o.hamma.filter(m => m.tugadi && m.navbatda);
    o.qoshimcha = o.hamma.filter(m => m.tugadi && !m.navbatda);
    const rx = m => m.ruxsat === 'kutish' ? 1 : 0, qz = m => (Number(m.muddati) > 100000 ? 1 : 0);
    const ob = m => (m.qadam || []).some(z => z.topId && z.holat === 'kutadi') ? 1 : 0;
    const dv = m => (m.davoOtgan && Number(m.muddati) > 100000) ? 1 : 0, xv = m => (m.xavf && m.xavf.length) ? 1 : 0;
    o.navbat = navbat.sort((a, b) => (rx(a) - rx(b)) || (ob(b) - ob(a)) || (b.boshlangan - a.boshlangan) || (b.xatKech - a.xatKech) || (dv(b) - dv(a)) || (xv(b) - xv(a))
      || (qz(b) - qz(a)) || ((Number(b.muddati) || 0) - (Number(a.muddati) || 0)) || ((Number(b.kechikkan) || 0) - (Number(a.kechikkan) || 0)) || (b.jami - a.jami));
    let aloqa = 0, vada = 0, xat = 0;
    Object.keys(A).forEach(no => A[no].forEach(a => { if (!qdTeng(a.kim, f)) return;
      if (a.tur === 'chora') { aloqa++; if (a.vada) vada++; } else if (a.tur === 'xat' || a.tur === 'yetkazdi') xat++; }));
    const tugNo = {}; o.hamma.forEach(m => { if (m.tugadi) tugNo[m.no] = 1; });
    const B = o.L;
    o.son = { maqsad: QD_MAQSAD, bajarildi: o.bajarildi.length, qoshimcha: o.qoshimcha.length, navbat: o.navbat.length,
      otkazildi: o.otkaz.filter(r => !tugNo[r.no]).length, otkazJami: o.otkaz.length, kech: o.kech.length, aloqa, vada, xat, savat: o.savat.length,
      davoOtgan: B.filter(x => x.davoOtgan && Number(x.muddati) > 100000).length,
      portfel: B.length, qizil: B.filter(x => (x.buyruq || []).some(b => b.d === 'q')).length, buzilgan: B.filter(x => x.buzilgan && Number(x.muddati) > 100000).length,
      jim: B.filter(x => x.jimKun >= P.UND_JIM_KUN).length, davo: B.filter(x => x.davoXavf).length, yuristga: B.filter(x => (x.buyruq || []).some(b => b.d === 'y' || /shoshilinch yuristga o'tkazishni so'rang/.test(b.t))).length,
      nazorat: o.nazorat.jami, nazoratQilinmadi: o.nazorat.qilinmadi };
    delete o.L;
  }
  return F;
}

// ------------------------------------------------------------------ Ijro.gs ijroQisqa_
async function ijroQator(nom, Sx) { return (await V.qatorlar(nom)).map(({ n, x }) => { const o = { qator: n }; Sx.forEach((k, j) => o[k] = x[j] == null ? '' : x[j]); return o; }); }
const ijroIso = v => typeof v === 'number' ? V.iso(v) : X.xatIso(String(v || '').slice(0, 10));
const ijroBall = q => IJRO_TUR_OGIR[q.Tur] ? IJRO_OGIR_BALL : 1;
const ijroPog = ball => ball >= IJRO_ZINA[2] ? 3 : ball >= IJRO_ZINA[1] ? 2 : ball >= IJRO_ZINA[0] ? 1 : 0;
function ijroFoiz(k, soxta) { const t = k.rT + k.nT + k.xT + k.tT, b = k.rB + k.nB + k.xB + k.tB; if (!t) return null; return Math.max(0, Math.min(100, Math.round(b / t * 100) - (soxta || 0) * IJRO_SOXTA_MINUS)); }
function ijroYig(A) { const z = { rT: 0, rB: 0, nT: 0, nB: 0, xT: 0, xB: 0, tT: 0, tB: 0 }; A.forEach(k => Object.keys(z).forEach(y => z[y] += Number(k[y]) || 0)); return z; }
function ijroKun(h, fish, bugun, Xj, T, Sx) {
  const hozir = TS.topHozirIso();
  const navbatda = h.hamma.filter(m => m.navbatda).length;
  const rT = Math.min(QD_MAQSAD, navbatda), rB = Math.min(rT, h.bajarildi.length);
  const nT = h.nazorat ? h.nazorat.kerak : 0, nB = nT - (h.nazorat ? h.nazorat.qilinmadi : 0);
  const xs = Xj.filter(x => X.xatIso(x.sana) === bugun && x.holati !== 'Bekor' && Sx[x.no] && qdTeng(Sx[x.no].undiruvchi, fish));
  const xB = xs.filter(x => x.holati === 'Yuborildi' && X.xatIso(x.yetSana || x.sana) === bugun).length;
  const ts = T.filter(t => qdTeng(t.kimga, fish) && t.holati !== 'Bekor' && TS.topIso(t.muddat).slice(0, 10) === bugun && TS.topIso(t.muddat) <= hozir);
  const tB = ts.filter(t => (t.holati === 'Bajarildi' || t.holati === 'Tekshiruvda') && t.kechikdi !== 'Ha').length;
  return { rT, rB, nT, nB, xT: xs.length, xB, tT: ts.length, tB };
}
async function ijroQisqa(fish, h, bugun) {
  const oy = bugun.slice(0, 7);
  const [Xj, T, Q, KL] = await Promise.all([J.xatJurnal(), J.topRows(), ijroQator('06q_Qoidabuzarlik', IJRO_S), ijroQator('06r_Ijro_kun', IJRO_KS)]);
  const Sx = {}; h.hamma.forEach(m => Sx[m.no] = { undiruvchi: fish });
  const bk = ijroKun(h, fish, bugun, Xj, T, Sx);
  const K = KL.filter(r => qdTeng(r.Xodim, fish) && ijroIso(r.Sana).slice(0, 7) === oy)
    .map(r => ({ sana: ijroIso(r.Sana), rT: r.Reja_talab, rB: r.Reja_bajardi, nT: r.Nazorat_talab, nB: r.Nazorat_bajardi, xT: r.Xat_talab, xB: r.Xat_ozkunida, tT: r.Top_talab, tB: r.Top_vaqtida, foiz: r.Foiz }));
  const M = Q.filter(q => q.ID !== '' && qdTeng(q.Xodim, fish) && ijroIso(q.Sana).slice(0, 7) === oy && q.Holati !== 'Uzrli');
  const son = { soni: M.length, ball: M.reduce((a, q) => a + ijroBall(q), 0), soxta: M.filter(q => q.Tur === 'soxta').length, tushuntirishsiz: M.filter(q => !String(q.Tushuntirish || '').trim()).length };
  return { bugun: ijroFoiz(bk, 0), oy: K.length ? ijroFoiz(ijroYig(K), son.soxta) : null, kunlar: K.length, ball: son.ball, soni: son.soni, pog: ijroPog(son.ball), tushuntirish: son.tushuntirishsiz };
}

// ------------------------------------------------------------------ amallar
async function qadamBoshlang([kodSes]) {
  const u = await S.ruxsat(kodSes, 'undiruv');
  const bugun = V.bugun();
  const H = (await qdHisob(u.kod, [u.fish], bugun))[u.fish];
  const d = new Date(bugun + 'T12:00:00Z'); const hk = d.getUTCDay();
  let ijro = null; try { ijro = await ijroQisqa(u.fish, H, bugun); } catch (e) { console.error('ijroQisqa:', e.message); }
  return { ok: true, fish: u.fish, ism: (String(u.fish).trim().split(/\s+/)[1] || u.fish), bugun,
    sana: QD_KUN[hk].charAt(0).toUpperCase() + QD_KUN[hk].slice(1) + ', ' + d.getUTCDate() + '-' + QD_OY[d.getUTCMonth()],
    maqsad: QD_MAQSAD, son: H.son, navbat: H.navbat, bajarildi: H.bajarildi.map(qdQisqa), qoshimcha: H.qoshimcha.map(qdQisqa),
    savat: H.savat.map(m => ({ no: m.no, fish: m.fish, dokon: m.dokon, xatlar: m.xatlar })),
    nazorat: H.nazorat, ijro,
    otkazildi: H.otkaz, kechiktirildi: H.kech, chora: UND_CHORA, natija: UND_NATIJA, huquq: H.huquq, sms: QD_SMS_MATN.as1, smsMatn: QD_SMS_MATN, tel: await qdXodimTel(u.fish) };
}
async function qadamMijoz([kodSes, no]) {
  const u = await S.ruxsat(kodSes, 'undiruv');
  const H = (await qdHisob(u.kod, [u.fish], V.bugun()))[u.fish];
  const m = H.hamma.find(z => z.no === String(no)) || null;
  return { mijoz: m, son: H.son, xabar: m ? '' : String(no) + ' endi portfelingizda emas (yuristga o\'tgan, bekor qilingan yoki qarzi yopilgan).' };
}
async function qadamJamoa([kodSes]) {
  const u = await S.ruxsat(kodSes, 'admin');
  const bugun = V.bugun();
  const XD = (await qdXodimlar()).filter(x => x.undiruvchi);
  const H = await qdHisob(u.kod, XD.map(x => x.fish), bugun, XD);
  return { bugun, maqsad: QD_MAQSAD, xodimlar: XD.map(x => { const h = H[x.fish];
    return { fish: x.fish, ism: x.ism, tg: !!x.tg, son: h.son, otkaz: h.otkaz, kech: h.kech.map(k => ({ no: k.no, fish: k.fish, qadam: k.qadam, sabab: k.sabab, vaqt: k.vaqt })),
      bajarildi: h.bajarildi.map(qdQisqa) }; }) };
}
async function qadamNazorat([kodSes]) {
  const u = await S.ruxsat(kodSes, 'undiruv');
  const bugun = V.bugun();
  const Pr = (await P.undPortfel(x => !!x.undiruvchi && qdTeng(x.undiruvchi, u.fish), u.kod)).royxat;
  const Jn = await J.undJurnal();
  const dmy = v => v ? v.split('-').reverse().join('.') : '';
  const L = [];
  Pr.forEach(x => { const n = P.undNazorat(x, bugun); if (!n) return;
    const ox = x.oxirgiXat; let bosqich = '', qoldi = null;
    if (ox) { const nom = ox.qm ? ['', 'Maydon farqi bildirishnomasi', 'Maydon farqi ogohlantirishi', 'Maydon farqi talabnomasi'][ox.bosqich] : ox.shosh ? 'Shoshilinch talabnoma' : ['', '1-xat (eslatma)', '2-xat (ogohlantirish)', 'Talabnoma'][ox.bosqich];
      qoldi = ox.muddat ? kun(bugun, ox.muddat) : null;
      bosqich = (nom || 'Xat') + ' yetkazildi ' + dmy(ox.yet) + (ox.muddat ? ' · to\'lov muddati ' + dmy(ox.muddat) + (qoldi > 0 ? ' · ' + qoldi + ' kun qoldi' : qoldi === 0 ? ' · BUGUN' : ' · muddat o\'tdi') : ''); }
    let yurist = '';
    if (n.tur === 'yurist') yurist = x.yuSorov ? 'Yuristga o\'tkazish so\'rovi direktorda' : x.talabnoma && !x.talabnoma.otgan ? 'Talabnoma muddati ' + x.talabnoma.muddat + ' — keyin yuristga' : 'Yuristga o\'tkazish — «▶ Bugungi ish»da';
    const bb = x.bosqichBosh || '';
    const oldin = Jn.filter(j => j.no === x.no && j.vadaSana && j.sana >= bb && ['', 'Вадада', 'Вадасини бузди', 'Қисман тўлади', 'Кўчирилди'].indexOf(j.vadaNatija) >= 0);
    const asos = oldin.length ? (oldin[oldin.length - 1].vadaSana > bugun ? oldin[oldin.length - 1].vadaSana : bugun) : '';
    const koch = oldin.length === 0 ? { erkin: true } : oldin.length === 1 ? { erkin: false, chek: U.kunQosh(asos, UND_MUHLAT_KUN) } : { tugagan: true };
    L.push({ no: x.no, fish: x.fish, mid: x.mid, dokon: x.dokon, tel: String(x.tel || '').split(',').map(t => t.trim()).filter(Boolean), manzil: x.manzil,
      muddati: x.muddati, qoshimcha: x.qoshimcha, jami: x.jami, farq: x.farq || 0, vada: x.vada, tur: n.tur, kerak: n.kerak, qilindi: n.qilindi, vaqt: n.vaqt,
      bugunAloqa: x.bugunAloqa || [], bugunSms: !!x.bugunSms, javobsizKun: x.javobsizKun || 0, bosqich, qoldi, xatMuddat: ox ? ox.muddat : '', yurist, koch,
      sms: n.kerak === 'eslatma0' ? 'vada0' : n.kerak === 'eslatma1' ? 'vada1' : n.tur === 'xat' ? (qoldi !== null && qoldi < 0 ? 'nazorat2' : 'nazorat') : '' }); });
  const dar = z => z.kerak && !z.qilindi ? (/^eslatma/.test(z.kerak) ? 0 : 1) : z.kerak ? 2 : 3;
  L.sort((a, b) => (dar(a) - dar(b)) || ((a.qoldi === null ? 999 : a.qoldi) - (b.qoldi === null ? 999 : b.qoldi)) || (b.muddati - a.muddati));
  const K = L.filter(z => z.kerak);
  return { ok: true, bugun, royxat: L, son: { jami: L.length, kerak: K.length, qilindi: K.filter(z => z.qilindi).length, qilinmadi: K.filter(z => !z.qilindi).length },
    smsMatn: QD_SMS_MATN, tel: await qdXodimTel(u.fish), chora: UND_CHORA, natija: UND_NATIJA, muhlatKun: UND_MUHLAT_KUN };
}

module.exports = { qadamBoshlang, qadamMijoz, qadamJamoa, qadamNazorat };
