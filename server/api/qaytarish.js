// AKS TIZIM — ↩ MIJOZGA PUL QAYTARISH (KO-2, chiqim kassa orderi) — 06.11.2026, direktor qarori. FAQAT DIREKTOR kiritadi.
// Tartib: boshqa mijozlar naqd to'laydi (KO-1, 05_Tolovlar «Naqt») → shu pul kassadan qaytariladigan mijozga KO-2 bilan beriladi (bo'lib-bo'lib).
//   05r_Qaytarish_qarorlari — shartnoma bo'yicha qaror: qancha qaytariladi (masalan 27/313 — 66 000 000, 15% ushlab qolinmaydi).
//   05q_Qaytarishlar        — har KO-2 alohida qator: sana, raqam (KO2-2026/0001), summa, MANBA — qaysi naqd to'lov (05 Tolov_ID) pulidan qanchadan.
// Asl to'lov (05_Tolovlar) O'CHIRILMAYDI va manfiy yozilmaydi; shartnoma holati o'zgarmaydi (bekor qilish — alohida, qoldiq 0 bo'lgach).
// Ichki audit: bitta naqd to'lov pulidan uning summasidan ko'p berib bo'lmaydi; KO-2 sanasi manba to'lov sanasidan oldin bo'lmaydi.
// Xato KO-2 o'chirilmaydi — «Bekor» deb belgilanadi (sababi bilan), qoldiq qayta ochiladi.
// ISBOT QOIDASI (06.11.2026, direktor): har ish isbot (skan) yuklangach qabul bo'ladi.
//   Qaror — mijoz imzolagan ARIZA skani yuklanmaguncha KO-2 yozilmaydi (06d «QAYTARISH_ARIZA», 05r P/Q).
//   KO-2 — saqlangach «Skan kutilmoqda»; mijoz imzolagan KO-2 skani yuklangach «Faol» (06d «KO2_IMZO», 05q Q/R).
//   Skan yuklanmagan KO-2 / qaror — sababsiz DARHOL bekor qilinadi (xato yozilgan bo'lsa); skanli — faqat sababi bilan.
//   Bekor qilingan KO-2 PDF i qayta yuklansa — ustida qizil «БЕКОР ҚИЛИНГАН» va sababi.
'use strict';
const fs = require('fs');
const path = require('path');
const S = require('./sessiya');
const V = require('../lib/varaq');
const G = require('../lib/google');
const env = require('../lib/env');
const { redis } = require('../lib/db');
const PDF = require('../lib/pdf');
const SH = require('../lib/sotuv_hujjat');
const MI = require('../lib/mijoz_imzo');
const tetik = require('../lib/kozgu_tetik');
const kozgu = () => Promise.race([tetik.varaqlarYangila([QR, KQ]).catch(() => {}), new Promise(r => setTimeout(r, 15000))]);   // 📊 Hisobot darhol ko'rsin

const QR = '05r_Qaytarish_qarorlari', KQ = '05q_Qaytarishlar', T05 = '05_Tolovlar', S3 = '03_Sotuv_shartnomalar', M2 = '02_Mijozlar';
const QR_SARL = ['Qaror_ID', 'Shartnoma_№', 'Mijoz_ID', 'Mijoz_FISH', 'Dokon_ID', 'Jami_tolangan', 'Ushlab_qolinadi', 'Qaytariladi', 'Sabab', 'Qaror_sana', 'Kim', 'Vaqt', 'Holati', 'Yakun_vaqt', 'Izoh', 'Ariza_skan', 'Ariza_vaqt'];
const KQ_SARL = ['ID', 'KO2_№', 'Sana', 'Qaror_ID', 'Shartnoma_№', 'Mijoz_FISH', 'Summa', 'Manba', 'Oluvchi_FISH', 'Oluvchi_pasport', 'Kassir', 'Kim_kiritdi', 'Vaqt', 'Holati', 'PDF', 'Izoh', 'Skan', 'Skan_vaqt'];
const KUT = 'Skan kutilmoqda';   // KO-2 saqlangan, mijoz imzolagan skani hali yuklanmagan
const ILDIZ = env.hujjatPapka || '/opt/aks/hujjat';
const MANBA_KUN = 31;   // qaytarishga manba bo'ladigan naqd to'lovlar — oxirgi 31 kun

const s = v => String(v == null ? '' : v);
const son = v => { if (typeof v === 'number') return v; const n = Number(s(v).replace(/[^\d.-]/g, '')); return isFinite(n) ? n : 0; };
const pul = n => Math.round(Number(n) || 0).toLocaleString('ru-RU').replace(/[  ,]/g, ' ');
const esc = v => s(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
function hozir() { const d = new Date(Date.now() + 5 * 3600 * 1000), p = n => String(n).padStart(2, '0');
  return { iso: d.toISOString().slice(0, 10), dmy: p(d.getUTCDate()) + '.' + p(d.getUTCMonth() + 1) + '.' + d.getUTCFullYear(), dmyHm: p(d.getUTCDate()) + '.' + p(d.getUTCMonth() + 1) + '.' + d.getUTCFullYear() + ' ' + p(d.getUTCHours()) + ':' + p(d.getUTCMinutes()) }; }
// katak qiymati → yyyy-mm-dd (seriya raqam, dd.mm.yyyy yoki yyyy-mm-dd)
function iso(v) {
  if (typeof v === 'number' && v > 20000) return new Date(Date.UTC(1899, 11, 30) + Math.floor(v) * 86400000).toISOString().slice(0, 10);
  const t = s(v).trim(); let m = /^(\d{4})-(\d{2})-(\d{2})/.exec(t); if (m) return m[0];
  m = /^(\d{1,2})\.(\d{1,2})\.(\d{4})/.exec(t); return m ? m[3] + '-' + m[2].padStart(2, '0') + '-' + m[1].padStart(2, '0') : '';
}
const dmy = i => i ? i.split('-').reverse().join('.') : '';

async function direktor(kodSes) {
  const u = await S.ruxsat(kodSes);
  if (!u.admin) throw new S.Xato('Pul qaytarish (KO-2) — faqat direktor uchun.');
  return u;
}
async function qulf(nom, fn) {
  const k = 'qaytarish_qulf:' + nom;
  for (let i = 0; i < 40; i++) { if (await redis.set(k, '1', 'NX', 'EX', 60)) break; if (i === 39) throw new S.Xato('Tizim band — bir daqiqadan keyin qayta urinib ko\'ring.'); await new Promise(r => setTimeout(r, 500)); }
  try { return await fn(); } finally { await redis.del(k).catch(() => {}); }
}
// varaq yo'q bo'lsa — yaratiladi va sarlavha yoziladi
async function varaqTayyor(nom, sarl) {
  const m = await G.varaqlar(env.aksBazaId, env.googleKey);
  if (m.varaqlar.some(v => v.title === nom)) {   // yangi ustunlar qo'shilgan bo'lsa — sarlavha to'ldiriladi
    const h = (await G.oraliqOqi(env.aksBazaId, nom, 'A1:Z1', env.googleKey))[0] || [];
    if (sarl.some((x, i) => s(h[i]) !== x)) await G.yoz(env.aksBazaId, [{ varaq: nom, katak: 'A1', qiymat: [sarl] }], env.googleKey);
    return;
  }
  await G.soralar(env.aksBazaId, [{ addSheet: { properties: { title: nom, gridProperties: { rowCount: 500, columnCount: sarl.length, frozenRowCount: 1 } } } }], env.googleKey);
  await G.yoz(env.aksBazaId, [{ varaq: nom, katak: 'A1', qiymat: [sarl] }], env.googleKey);
}
async function jadval(nom, sarl) {
  let X = [];
  try { X = await G.oraliqOqi(env.aksBazaId, nom, 'A1:' + String.fromCharCode(64 + sarl.length), env.googleKey, 'UNFORMATTED_VALUE'); }
  catch (e) { if (/Unable to parse range|not found/i.test(e.message)) return []; throw e; }
  return X.slice(1).map((r, i) => ({ qator: i + 2, r: sarl.map((_, k) => r[k] == null ? '' : r[k]) })).filter(z => s(z.r[0]).trim());
}
// Vaqt kataklari (dd.mm.yyyy HH:MM) Sheets da sana-son bo'lib saqlanadi — o'qishda matnga qaytariladi
function vt(v) { if (typeof v !== 'number' && !/^\d{5}(\.\d+)?$/.test(s(v))) return s(v);
  const d = new Date(Math.round((Number(v) - 25569) * 86400e3)), p = n => String(n).padStart(2, '0');
  return p(d.getUTCDate()) + '.' + p(d.getUTCMonth() + 1) + '.' + d.getUTCFullYear() + ' ' + p(d.getUTCHours()) + ':' + p(d.getUTCMinutes()); }
const qarorOb = ({ qator, r }) => ({ qator, id: s(r[0]), no: s(r[1]), mid: s(r[2]), fish: s(r[3]), dokon: s(r[4]), jami: son(r[5]), ushlab: son(r[6]), qaytar: son(r[7]),
  sabab: s(r[8]), sana: iso(r[9]), kim: s(r[10]), vaqt: vt(r[11]), holati: s(r[12]), yakun: vt(r[13]), izoh: s(r[14]), ariza: s(r[15]), arizaVaqt: vt(r[16]) });
const ko2Ob = ({ qator, r }) => ({ qator, id: s(r[0]), raqam: s(r[1]), sana: iso(r[2]), qarorId: s(r[3]), no: s(r[4]), fish: s(r[5]), summa: son(r[6]),
  manba: manbaOqi(r[7]), oluvchi: s(r[8]), pasport: s(r[9]), kassir: s(r[10]), kim: s(r[11]), vaqt: vt(r[12]), holati: s(r[13]) === 'Faol' && !s(r[16]) ? KUT : s(r[13]), pdf: s(r[14]), izoh: s(r[15]), skan: s(r[16]), skanVaqt: vt(r[17]) });   // skansiz «Faol» (qoidadan oldingi) — ham «Skan kutilmoqda»
// «T1234:3000000; T1240:2000000» ⇄ [{ tid, summa }]
function manbaOqi(v) { return s(v).split(';').map(x => /^\s*T?(\d+)\s*:\s*(\d+)/.exec(x)).filter(Boolean).map(m => ({ tid: m[1], summa: +m[2] })); }
const manbaYoz = L => L.map(x => 'T' + x.tid + ':' + Math.round(x.summa)).join('; ');

// 05_Tolovlar — ustunlar sarlavha bo'yicha (Google'dan yangi)
async function tolovlar() {
  const X = await G.oraliqOqi(env.aksBazaId, T05, 'A1:Z', env.googleKey, 'UNFORMATTED_VALUE');
  const h = (X[0] || []).map(s), ix = n => h.indexOf(n);
  const I = { id: ix('Tolov_ID'), sana: ix('Sana'), no: ix('Shartnoma_№'), summa: ix('Summa'), shakl: ix('Shakli'), hujjat: ix('Hujjat_№'), fish: ix('Mijoz_FISH') };
  if (I.id < 0 || I.summa < 0 || I.shakl < 0) throw new S.Xato('05_Tolovlar sarlavhalari kutilgandek emas — direktorga ayting.');
  return X.slice(1).filter(r => s(r[I.id]).trim()).map(r => ({ tid: s(r[I.id]).trim(), sana: iso(r[I.sana]), no: s(r[I.no]).trim(), summa: son(r[I.summa]),
    shakl: s(r[I.shakl]).trim(), hujjat: I.hujjat >= 0 ? s(r[I.hujjat]) : '', fish: I.fish >= 0 ? s(r[I.fish]) : '' }));
}

async function holatYig() {
  const [Q, K, T] = await Promise.all([jadval(QR, QR_SARL), jadval(KQ, KQ_SARL), tolovlar()]);
  const qarorlar = Q.map(qarorOb), ko2 = K.map(ko2Ob).filter(k => k.holati !== 'Bekor');
  try { const M = {}; (await V.qatorlar('02_Mijozlar')).forEach(({ r }) => { if (s(r[0]).trim()) M[s(r[0]).trim()] = s(r[2]).trim(); });
    qarorlar.forEach(q => { if (M[q.mid]) q.fish = M[q.mid]; }); } catch (e) { /* ko'zgu bo'lmasa — qarordagi ism */ }
  const ishlatilgan = {}; ko2.forEach(k => k.manba.forEach(m => { ishlatilgan[m.tid] = (ishlatilgan[m.tid] || 0) + m.summa; }));
  qarorlar.forEach(q => { q.ko2 = K.map(ko2Ob).filter(k => k.qarorId === q.id); q.qaytarildi = q.ko2.filter(k => k.holati !== 'Bekor').reduce((a, k) => a + k.summa, 0); q.qoldiq = q.qaytar - q.qaytarildi; });
  return { qarorlar, ko2, ishlatilgan, T };
}

// ------------------------------------------------------------------ o'qish
async function qaytarishHolat([kodSes]) {
  await direktor(kodSes);
  const H = await holatYig();
  const chegara = new Date(Date.now() + 5 * 3600e3 - MANBA_KUN * 86400e3).toISOString().slice(0, 10);
  const manbalar = H.T.filter(t => t.shakl === 'Naqt' && t.sana >= chegara && t.summa > 0)
    .map(t => ({ tid: t.tid, sana: dmy(t.sana), no: t.no, fish: t.fish, summa: t.summa, hujjat: t.hujjat, ishlatilgan: H.ishlatilgan[t.tid] || 0, qoldiq: t.summa - (H.ishlatilgan[t.tid] || 0) }))
    .filter(t => t.qoldiq > 0).sort((a, b) => iso(b.sana) < iso(a.sana) ? -1 : 1);
  return { qarorlar: H.qarorlar.map(q => ({ id: q.id, no: q.no, fish: q.fish, dokon: q.dokon, jami: q.jami, ushlab: q.ushlab, qaytar: q.qaytar, qaytarildi: q.qaytarildi, qoldiq: q.qoldiq,
    holati: q.holati, sabab: q.sabab, sana: dmy(q.sana), ariza: q.ariza, arizaVaqt: q.arizaVaqt, izoh: q.izoh, ko2: q.ko2.map(k => ({ id: k.id, raqam: k.raqam, sana: dmy(k.sana), summa: k.summa, holati: k.holati, izoh: k.izoh, skan: k.skan, skanVaqt: k.skanVaqt, kassir: k.kassir,
      manba: k.manba.map(m => { const t = H.T.find(z => z.tid === m.tid) || {}; return { tid: m.tid, summa: m.summa, no: t.no || '', fish: t.fish || '', sana: dmy(t.sana || '') }; }) })) })),
    manbalar, bugun: hozir().iso, kassir: await kassirStandart(H), xodimlar: await kassirRoyxat() };
}

// Kassir — qo'lda yozilmasin (06.11.2026): oxirgi KO-2 dagi kassir; bo'lmasa 07_Xodimlar da lavozimi buxgalter/kassir, ishlayotgan xodim
async function kassirStandart(H) {
  const ox = H.ko2.filter(k => k.kassir).pop(); if (ox) return ox.kassir;
  const x = (await V.qatorlar('07_Xodimlar')).map(z => z.x).find(r => /buxgalter|бухгалтер|kassir|кассир/i.test(s(r[3])) && s(r[10]).trim() === 'Ishlayapti');
  return x ? s(x[1]).trim() : '';
}
// Pulni bergan xodim — tanlash ro'yxati: 07_Xodimlar, ishlayotganlar; buxgalter/kassir birinchi
async function kassirRoyxat() {
  const kas = r => /buxgalter|бухгалтер|kassir|кассир/i.test(s(r[3])) ? 0 : 1;
  return (await V.qatorlar('07_Xodimlar')).map(z => z.x).filter(r => s(r[1]).trim() && s(r[10]).trim() === 'Ishlayapti')
    .sort((a, b) => kas(a) - kas(b) || s(a[1]).localeCompare(s(b[1])))
    .map(r => ({ fish: s(r[1]).trim(), lavozim: s(r[3]).trim() }));
}

// ------------------------------------------------------------------ qaror: shartnoma bo'yicha qancha qaytariladi
async function qaytarishQaror([kodSes, d0]) {
  const u = await direktor(kodSes); const d = d0 || {};
  const no = s(d.no).trim(), qaytar = Math.round(son(d.qaytar)), sabab = s(d.sabab).trim();
  if (!/^27\/\d+$/.test(no)) throw new S.Xato('Sotuv shartnomasi raqamini kiriting (27/…).');
  if (sabab.length < 10) throw new S.Xato('Qaror sababini yozing (kamida 10 belgi): masalan «Direktor qarori: to\'liq qaytariladi, 15% ushlab qolinmaydi».');
  const sh = (await V.qatorlar(S3)).map(z => z.r).find(r => s(r[0]).trim() === no);
  if (!sh) throw new S.Xato('Shartnoma topilmadi: ' + no);
  if (/bekor/i.test(s(sh[13]))) throw new S.Xato(no + ' allaqachon bekor qilingan.');
  return qulf('qaror', async () => {
    await varaqTayyor(QR, QR_SARL);
    const H = await holatYig();
    const bor = H.qarorlar.find(q => q.no === no && q.holati !== 'Bekor');
    if (bor) throw new S.Xato(no + ' bo\'yicha qaytarish qarori allaqachon bor (' + bor.holati + '). Xato bo\'lsa — avval uni ✖ bilan bekor qiling.');
    const jami = H.T.filter(t => t.no === no).reduce((a, t) => a + t.summa, 0);
    if (!(qaytar > 0)) throw new S.Xato('Qaytariladigan summani kiriting.');
    if (qaytar > jami) throw new S.Xato('Qaytariladigan summa (' + pul(qaytar) + ') shu shartnomaga to\'langan jami summadan (' + pul(jami) + ') katta bo\'lishi mumkin emas.');
    const id = String(Math.max(0, ...H.qarorlar.map(q => +q.id || 0)) + 1), h = hozir();
    await G.qatorQosh(env.aksBazaId, QR, [id, no, s(sh[4]), s(sh[20]), s(sh[5]), jami, jami - qaytar, qaytar, sabab, h.dmy, u.fish, h.dmyHm, 'Ochiq', '', '', '', ''], env.googleKey);
    tg('↩ <b>Qaytarish qarori</b> ' + no + ' (' + esc(s(sh[20])) + '): qaytariladi <b>' + pul(qaytar) + '</b> so\'m' + (jami - qaytar ? ', ushlab qolinadi ' + pul(jami - qaytar) : ', ushlab qolinmaydi') + '.\nSabab: ' + esc(sabab) + '\n⏳ Mijoz imzolagan ariza skani yuklanmaguncha KO-2 yozilmaydi.');
    await kozgu();
    return { ok: true, id, no, jami, qaytar };
  });
}

// ------------------------------------------------------------------ KO-2 kiritish
async function qaytarishKirit([kodSes, d0]) {
  const u = await direktor(kodSes); const d = d0 || {};
  const sana = s(d.sana), summa = Math.round(son(d.summa)), kassir = s(d.kassir).trim(), izoh = s(d.izoh).trim();
  const bugun = hozir().iso;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(sana)) throw new S.Xato('KO-2 sanasini tanlang.');
  if (sana > bugun) throw new S.Xato('Kelajak sanasiga KO-2 yozib bo\'lmaydi.');
  if (!(summa > 0)) throw new S.Xato('Summani kiriting.');
  if (kassir.length < 3) throw new S.Xato('Pulni bergan kassir (buxgalter) ismini yozing.');
  const manba = (Array.isArray(d.manba) ? d.manba : []).map(m => ({ tid: s(m.tid).replace(/\D/g, ''), summa: Math.round(son(m.summa)) })).filter(m => m.tid && m.summa > 0);
  if (!manba.length) throw new S.Xato('Pul qaysi naqd to\'lov(lar)dan berilganini belgilang.');
  if (new Set(manba.map(m => m.tid)).size !== manba.length) throw new S.Xato('Bitta to\'lov ikki marta tanlangan.');
  if (manba.reduce((a, m) => a + m.summa, 0) !== summa) throw new S.Xato('Manbalar yig\'indisi (' + pul(manba.reduce((a, m) => a + m.summa, 0)) + ') KO-2 summasiga (' + pul(summa) + ') teng emas.');
  return qulf('ko2', async () => {
    await varaqTayyor(KQ, KQ_SARL);
    const H = await holatYig();
    const q = H.qarorlar.find(x => x.id === s(d.qarorId));
    if (!q) throw new S.Xato('Qaytarish qarori topilmadi.');
    if (q.holati !== 'Ochiq') throw new S.Xato(q.no + ' bo\'yicha qaytarish «' + q.holati + '» — yangi KO-2 yozilmaydi.');
    if (!q.ariza) throw new S.Xato('Avval mijoz imzolagan ARIZA skanini yuklang (qaror kartasidagi «📎 Ariza skani») — isbotsiz pul berilmaydi.');
    if (summa > q.qoldiq) throw new S.Xato('KO-2 summasi (' + pul(summa) + ') qaytarilishi kerak bo\'lgan qoldiqdan (' + pul(q.qoldiq) + ') katta.');
    for (const m of manba) {
      const t = H.T.find(z => z.tid === m.tid);
      if (!t) throw new S.Xato('To\'lov topilmadi: №' + m.tid);
      if (t.shakl !== 'Naqt') throw new S.Xato('To\'lov №' + m.tid + ' naqd emas («' + t.shakl + '») — kassadan faqat naqd tushgan pul beriladi.');
      if (t.no === q.no) throw new S.Xato('To\'lov №' + m.tid + ' — shu shartnomaning o\'z to\'lovi; manba boshqa mijozning naqd to\'lovi bo\'lishi kerak.');
      if (t.sana > sana) throw new S.Xato('To\'lov №' + m.tid + ' (' + dmy(t.sana) + ') KO-2 sanasidan (' + dmy(sana) + ') keyin tushgan.');
      const qol = t.summa - (H.ishlatilgan[m.tid] || 0);
      if (m.summa > qol) throw new S.Xato('To\'lov №' + m.tid + ' (' + t.fish + ', ' + pul(t.summa) + ') pulidan faqat ' + pul(qol) + ' so\'m qolgan — ' + pul(m.summa) + ' berib bo\'lmaydi.');
    }
    // oluvchi — shartnoma egasi (02_Mijozlar), pasport ma'lumoti bilan
    const sh = (await V.qatorlar(S3)).map(z => z.r).find(r => s(r[0]).trim() === q.no) || [];
    const mj = (await V.qatorlar(M2)).map(z => z.r).find(r => s(r[0]).trim() === s(sh[4] || q.mid).trim()) || [];
    const oluvchi = s(mj[2] || q.fish).trim();
    const pasport = [s(mj[6]).replace(/\s/g, ''), s(mj[8]) ? s(mj[8]) + ' ИИБ' : '', s(mj[9]) ? s(mj[9]) + ' да берилган' : ''].filter(Boolean).join(', ');
    const K = await jadval(KQ, KQ_SARL);
    const yil = sana.slice(0, 4);
    const tartib = Math.max(0, ...K.map(z => { const m = /^KO2-(\d{4})\/(\d+)$/.exec(s(z.r[1])); return m && m[1] === yil ? +m[2] : 0; })) + 1;
    const raqam = 'KO2-' + yil + '/' + String(tartib).padStart(4, '0');
    const id = String(Math.max(0, ...K.map(z => +s(z.r[0]) || 0)) + 1);
    const oldin = q.qaytarildi, qoldiq = q.qoldiq - summa, h = hozir();
    // PDF — serverda: /opt/aks/hujjat/<shartnoma>/KO2-2026-0001.pdf
    const pdf = await ko2Pdf({ raqam, sana, oluvchi, pasport, summa, q, oldin, qoldiq, manba, kassir, izoh });
    const noF = q.no.replace(/\//g, '-'), nom = raqam.replace(/\//g, '-') + '_' + noF + '.pdf';
    fs.mkdirSync(path.join(ILDIZ, noF), { recursive: true });
    fs.writeFileSync(path.join(ILDIZ, noF, nom), pdf, { mode: 0o640 });
    const jq = await G.qatorQosh(env.aksBazaId, KQ, [id, raqam, dmy(sana), q.id, q.no, q.fish, summa, manbaYoz(manba), oluvchi, pasport, kassir, u.fish, h.dmyHm, KUT, 'SRV:' + noF + '/' + nom, izoh, '', ''], env.googleKey);
    await G.sanaYoz(env.aksBazaId, [{ varaq: KQ, qator: G.qatorRaqam(jq, K.length + 2), ustun: 3, iso: sana }], env.googleKey).catch(() => {});
    if (qoldiq === 0) await G.yoz(env.aksBazaId, [{ varaq: QR, katak: 'M' + q.qator + ':N' + q.qator, qiymat: [['Yakunlandi', h.dmyHm]] }], env.googleKey);
    // Drive arxivi — mijoz papkasiga (fonda)
    driveGa(u.kod, { no: q.no, fish: q.fish, nom, pdf });
    tg('↩ <b>' + raqam + '</b> yozildi — ' + esc(q.fish) + ' (' + q.no + ') ga <b>' + pul(summa) + '</b> so\'m (' + dmy(sana) + ', pulni bergan: ' + esc(kassir) + '). ⏳ Imzolangan skan kutilmoqda.\n'
      + 'Manba: ' + manba.map(m => { const t = H.T.find(z => z.tid === m.tid); return '№' + m.tid + ' ' + esc(t.fish) + ' (' + t.no + ') — ' + pul(m.summa); }).join('; ') + '\n'
      + 'Qaytarildi: ' + pul(oldin + summa) + ' / ' + pul(q.qaytar) + ' · qoldiq <b>' + pul(qoldiq) + '</b>'
      + (qoldiq === 0 ? '\n✅ Qaror summasi to\'liq yozildi — barcha KO-2 skanlari yuklangach shartnomani «Xaridor tashabbusi bilan» bekor qilish mumkin.' : ''));
    await kozgu();
    return { ok: true, id, raqam, summa, qoldiq, nom, b64: pdf.toString('base64') };
  });
}

// ------------------------------------------------------------------ KO-2 PDF (qayta yuklab olish) va bekor qilish
async function qaytarishPdf([kodSes, id]) {
  await direktor(kodSes);
  const H = await holatYig();
  const k = (await jadval(KQ, KQ_SARL)).map(ko2Ob).find(x => x.id === s(id));
  if (!k) throw new S.Xato('KO-2 topilmadi.');
  const y = /^SRV:(.+)$/.exec(k.pdf); const f = y ? path.join(ILDIZ, path.normalize(y[1]).replace(/^(\.\.[/\\])+/, '')) : '';
  if (k.holati === 'Bekor') {   // bekor qilingan — asl nusxa berilmaydi: ustida qizil «БЕКОР ҚИЛИНГАН» va sababi
    const q = H.qarorlar.find(x => x.id === k.qarorId) || { no: k.no, qaytar: 0, sana: '' };
    const b = bekorAjrat(k.izoh);
    const pdf = await ko2Pdf({ raqam: k.raqam, sana: k.sana, oluvchi: k.oluvchi, pasport: k.pasport, summa: k.summa, q, oldin: 0, qoldiq: 0, manba: k.manba, kassir: k.kassir, izoh: b.izoh, bekor: b.bekor || 'sababi yozilmagan' });
    return { nom: (f ? path.basename(f, '.pdf') : k.raqam.replace(/\//g, '-')) + '_BEKOR.pdf', b64: pdf.toString('base64') };
  }
  if (!f || !fs.existsSync(f)) throw new S.Xato('KO-2 fayli serverda topilmadi: ' + k.raqam);
  return { nom: path.basename(f), b64: fs.readFileSync(f).toString('base64') };
}
// izoh: «<asl izoh> | Bekor: <sabab> (<kim>, <vaqt>)» → { izoh, bekor }
function bekorAjrat(v) { const m = /^(?:(.*?) \| )?Bekor: (.*)$/.exec(s(v)); return m ? { izoh: s(m[1]), bekor: m[2] } : { izoh: s(v), bekor: '' }; }

// ✖ KO-2 ni bekor qilish. Skan yuklanmagan (xato yozilgan) — DARHOL, sababsiz; skanli (Faol) — faqat sababi bilan.
async function qaytarishBekor([kodSes, id, sabab0]) {
  const u = await direktor(kodSes); let sabab = s(sabab0).trim();
  return qulf('ko2', async () => {
    const k = (await jadval(KQ, KQ_SARL)).map(ko2Ob).find(x => x.id === s(id));
    if (!k) throw new S.Xato('KO-2 topilmadi.');
    if (k.holati === 'Bekor') throw new S.Xato(k.raqam + ' allaqachon bekor qilingan.');
    if (k.holati === KUT) { if (!sabab) sabab = 'Skan yuklanmagan — xato kiritilgan, darhol bekor qilindi'; }
    else if (sabab.length < 5) throw new S.Xato(k.raqam + ' — mijoz imzolagan skani yuklangan. Bekor qilish sababini yozing (kamida 5 belgi).');
    const q = (await jadval(QR, QR_SARL)).map(qarorOb).find(x => x.id === k.qarorId);
    if (q && /bekor/i.test(s(((await V.qatorlar(S3)).map(z => z.r).find(r => s(r[0]).trim() === q.no) || [])[13]))) throw new S.Xato('Shartnoma bekor qilingan — KO-2 ni bekor qilib bo\'lmaydi.');
    const h = hozir();
    const D = [{ varaq: KQ, katak: 'N' + k.qator, qiymat: [['Bekor']] }, { varaq: KQ, katak: 'P' + k.qator, qiymat: [[(k.izoh ? k.izoh + ' | ' : '') + 'Bekor: ' + sabab + ' (' + u.fish + ', ' + h.dmyHm + ')']] }];
    if (q && q.holati === 'Yakunlandi') D.push({ varaq: QR, katak: 'M' + q.qator + ':N' + q.qator, qiymat: [['Ochiq', '']] });
    await G.yoz(env.aksBazaId, D, env.googleKey);
    tg('✖ <b>' + k.raqam + '</b> bekor qilindi (' + esc(k.fish) + ', ' + pul(k.summa) + ' so\'m' + (k.holati === KUT ? ', skan yuklanmagan edi' : '') + '). Sabab: ' + esc(sabab));
    await kozgu();
    return { ok: true, raqam: k.raqam, darhol: k.holati === KUT };
  });
}

// ✖ Qarorni bekor qilish — faqat unda faol KO-2 qolmagan bo'lsa. Ariza skani yuklanmagan — darhol; yuklangan — sababi bilan.
async function qaytarishQarorBekor([kodSes, id, sabab0]) {
  const u = await direktor(kodSes); let sabab = s(sabab0).trim();
  return qulf('qaror', async () => {
    const H = await holatYig();
    const q = H.qarorlar.find(x => x.id === s(id));
    if (!q) throw new S.Xato('Qaytarish qarori topilmadi.');
    if (q.holati === 'Bekor') throw new S.Xato('Qaror allaqachon bekor qilingan.');
    const faol = q.ko2.filter(k => k.holati !== 'Bekor');
    if (faol.length) throw new S.Xato('Qarorda ' + faol.length + ' ta KO-2 bor (' + faol.map(k => k.raqam).join(', ') + ') — avval ularni ✖ bilan bekor qiling.');
    if (!q.ariza) { if (!sabab) sabab = 'Ariza skani yuklanmagan — xato kiritilgan, darhol bekor qilindi'; }
    else if (sabab.length < 5) throw new S.Xato('Qarorga mijoz arizasi skani yuklangan. Bekor qilish sababini yozing (kamida 5 belgi).');
    const h = hozir();
    await G.yoz(env.aksBazaId, [{ varaq: QR, katak: 'M' + q.qator + ':O' + q.qator, qiymat: [['Bekor', h.dmyHm, (q.izoh ? q.izoh + ' | ' : '') + 'Bekor: ' + sabab + ' (' + u.fish + ', ' + h.dmyHm + ')']] }], env.googleKey);
    tg('✖ <b>Qaytarish qarori</b> ' + q.no + ' (' + esc(q.fish) + ', ' + pul(q.qaytar) + ' so\'m) bekor qilindi. Sabab: ' + esc(sabab));
    await kozgu();
    return { ok: true, no: q.no };
  });
}

// 📎 Isbot skanlari — 06d ga (HY.yuklaYadro: server papkasi + Drive), so'ng 05r/05q da bog'lanadi
const HYk = () => require('./hujjat_yoz')._ichki;   // kech yuklash — hujjat_yoz ham bu faylni chaqiradi
async function shOb(no, fish) {
  const sh = (await V.qatorlar(S3)).map(z => z.r).find(r => s(r[0]).trim() === no) || [];
  return { no, tur: 'sotuv', fish: s(sh[20] || fish), dokon: s(sh[5]) };
}
async function qaytarishArizaSkan([kodSes, id, sana, b64, sahifa]) {
  const u = await direktor(kodSes);
  const q = (await jadval(QR, QR_SARL)).map(qarorOb).find(x => x.id === s(id));
  if (!q) throw new S.Xato('Qaytarish qarori topilmadi.');
  if (q.holati === 'Bekor') throw new S.Xato('Qaror bekor qilingan.');
  if (q.ariza) throw new S.Xato('Ariza skani allaqachon yuklangan: ' + q.ariza + '. Xato bo\'lsa — «📎 Hujjatlar» da «✎ Tuzatish» bilan bekor qilib, qayta yuklang.');
  await varaqTayyor(QR, QR_SARL);
  const r = await HYk().yuklaYadro(u, { turi: 'QAYTARISH_ARIZA', sana, b64, sahifa, izoh: '№QR-' + q.id + ' · Пул қайтариш аризаси (мижоз имзоси билан), ' + pul(q.qaytar) + ' сўм' }, await shOb(q.no, q.fish));
  const h = hozir();
  await G.yoz(env.aksBazaId, [{ varaq: QR, katak: 'P' + q.qator + ':Q' + q.qator, qiymat: [[r.nom, h.dmyHm]] }], env.googleKey);
  tg('📎 ' + q.no + ' (' + esc(q.fish) + ') — mijoz imzolagan qaytarish arizasi skani yuklandi. Endi KO-2 yozish mumkin.');
  await kozgu();
  return { ok: true, nom: r.nom };
}
async function qaytarishSkan([kodSes, id, sana, b64, sahifa]) {
  const u = await direktor(kodSes);
  const k = (await jadval(KQ, KQ_SARL)).map(ko2Ob).find(x => x.id === s(id));
  if (!k) throw new S.Xato('KO-2 topilmadi.');
  if (k.holati !== KUT) throw new S.Xato(k.raqam + ' — «' + k.holati + '»' + (k.skan ? ', skani yuklangan: ' + k.skan : '') + '.');
  if (s(sana) < k.sana) throw new S.Xato('Imzolangan sana KO-2 sanasidan (' + dmy(k.sana) + ') oldin bo\'lishi mumkin emas.');
  await varaqTayyor(KQ, KQ_SARL);
  const r = await HYk().yuklaYadro(u, { turi: 'KO2_IMZO', sana, b64, sahifa, izoh: k.raqam + ' · КО-2, ' + pul(k.summa) + ' сўм (мижоз имзоси билан)' }, await shOb(k.no, k.fish));
  const h = hozir();
  await G.yoz(env.aksBazaId, [{ varaq: KQ, katak: 'N' + k.qator, qiymat: [['Faol']] }, { varaq: KQ, katak: 'Q' + k.qator + ':R' + k.qator, qiymat: [[r.nom, h.dmyHm]] }], env.googleKey);
  tg('✅ <b>' + k.raqam + '</b> tasdiqlandi — mijoz imzolagan skan yuklandi (' + esc(k.fish) + ', ' + pul(k.summa) + ' so\'m).');
  await kozgu();
  return { ok: true, raqam: k.raqam, nom: r.nom };
}
// «📎 Hujjatlar → ✎ Tuzatish» bilan skan bekor qilinsa — bog'lanish uziladi (hujjat_yoz.hujjatTuzat chaqiradi)
async function skanTuzatKataklar(hj, sabab, fish, vaqt) {
  const Y = [], xabar = [];
  if (hj.turi === 'KO2_IMZO') {
    for (const k of (await jadval(KQ, KQ_SARL)).map(ko2Ob)) {
      if (k.no !== hj.no || k.skan !== hj.nom) continue;
      Y.push({ varaq: KQ, katak: 'Q' + k.qator + ':R' + k.qator, qiymat: [['', '']] }, { varaq: KQ, katak: 'P' + k.qator, qiymat: [[(k.izoh ? k.izoh + ' | ' : '') + 'Skan bekor qilindi: ' + sabab + ' (' + fish + ', ' + vaqt + ')']] });
      if (k.holati === 'Faol') { Y.push({ varaq: KQ, katak: 'N' + k.qator, qiymat: [[KUT]] }); xabar.push(k.raqam + ' qayta «Skan kutilmoqda» — to\'g\'ri skanni yuklang.'); }
    }
  } else if (hj.turi === 'QAYTARISH_ARIZA') {
    for (const q of (await jadval(QR, QR_SARL)).map(qarorOb)) {
      if (q.no !== hj.no || q.ariza !== hj.nom) continue;
      Y.push({ varaq: QR, katak: 'P' + q.qator + ':Q' + q.qator, qiymat: [['', '']] }, { varaq: QR, katak: 'O' + q.qator, qiymat: [[(q.izoh ? q.izoh + ' | ' : '') + 'Ariza skani bekor qilindi: ' + sabab + ' (' + fish + ', ' + vaqt + ')']] });
      xabar.push(q.no + ' qaytarish qarorining ariza skani olib tashlandi — to\'g\'ri skan yuklanmaguncha yangi KO-2 yozilmaydi.');
    }
  }
  return { Y, matn: xabar.join(' '), varaqlar: Y.length ? [QR, KQ] : [] };
}

function tg(matn) { try { const TG = require('../lib/telegram'); if (TG.bor()) TG.direktor(matn).catch(e => console.error('qaytarish TG:', e.message)); } catch (e) { } }
function driveGa(kod, f) {
  (async () => {
    const ARX = require('../lib/arxiv');
    if (!(await ARX.bor())) return;
    await ARX.chaqir('koprikDriveSaqla', kod, [{ no: f.no, fish: f.fish, nom: f.nom, b64: f.pdf.toString('base64') }]);
  })().catch(e => console.error('KO-2 Drive:', e.message));
}

// ------------------------------------------------------------------ KO-2 matni (A4, bitta varaq; muhrsiz — loyiha qoidasi)
async function ko2Pdf(o) {
  const SOZ = SH.sozBilan(o.summa), KR = v => { try { return require('../lib/ism').xatKirill(s(v)); } catch (e) { return s(v); } };   // ism — kirillda (hujjat qoidasi)
  const asos = '№ ' + o.q.no + ' шартнома бўйича Харидор томонидан тўланган маблағни қайтариш (директор қарори, ' + dmy(o.q.sana) + ').';
  const manba = o.manba.map(m => 'кирим № ' + m.tid + ' — ' + pul(m.summa)).join('; ');
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>
@page{size:A4;margin:16mm 16mm 18mm 22mm}*{box-sizing:border-box}body{margin:0;padding-right:1mm;font-family:'Liberation Serif','Times New Roman',serif;font-size:12pt;line-height:1.35;color:#000}   /* padding-right: o'ng chegaradagi ramka chizig'i PDF da kesilmasin */
.t{display:flex;justify-content:space-between;font-size:11pt}.h{text-align:center;margin:8mm 0 1mm;font-size:16pt;font-weight:bold;letter-spacing:1px}
.r{text-align:center;font-size:12.5pt;margin-bottom:5mm}table{width:100%;border-collapse:collapse;margin:3mm 0 5mm}td,th{border:.7pt solid #000;padding:2mm;font-size:11pt;text-align:center}
th{background:#eee;font-weight:bold}.q{margin:2.6mm 0;display:flex;gap:3mm}.q b.l{flex:0 0 34mm;font-weight:bold}.q span{flex:1;border-bottom:.6pt solid #000;padding-bottom:.6mm}
.i{font-size:10pt;color:#333}.imz{margin-top:5mm;line-height:2.15}.ch{display:inline-block;border-bottom:.7pt solid #000;vertical-align:bottom}
.ol{margin-top:6mm;border:1pt solid #000;padding:3mm 4mm;line-height:2.1}
.bk{position:fixed;left:0;right:0;top:110mm;text-align:center}.bk span{display:inline-block;transform:rotate(-30deg);white-space:nowrap;font:bold 40pt 'Liberation Sans',Arial,sans-serif;color:rgba(200,0,0,.45);border:4pt solid rgba(200,0,0,.45);padding:1mm 5mm;letter-spacing:2px}
.bks{color:#c00;font-weight:bold}</style></head><body>${o.bekor ? '<div class="bk"><span>БЕКОР ҚИЛИНГАН</span></div>' : ''}
<div class="t"><span><b>«ANGOR KARVON SAROY» МЧЖ</b><br>СТИР 308 489 492 · Ангор тумани</span><span style="text-align:right">КО-2 шакли</span></div>
<div class="h">ЧИҚИМ КАССА ОРДЕРИ</div><div class="r">№ ${esc(o.raqam)} &nbsp;·&nbsp; ${esc(dmy(o.sana))}</div>
<table><tr><th>Дебет счёти</th><th>Кредит счёти</th><th>Сумма, сўм</th><th>Мақсадли белги</th></tr><tr><td>&nbsp;</td><td>&nbsp;</td><td><b>${pul(o.summa)}</b></td><td>&nbsp;</td></tr></table>
<div class="q"><b class="l">Берилсин:</b><span><b>${esc(KR(o.oluvchi))}</b></span></div>
<div class="q"><b class="l">Асос:</b><span>${esc(asos)}</span></div>
<div class="q"><b class="l">Сумма:</b><span>${esc(SOZ.charAt(0).toUpperCase() + SOZ.slice(1))} сўм</span></div>
${o.bekor ? `<div class="q"><b class="l bks">БЕКОР:</b><span class="bks">Ушбу ордер бекор қилинган — ҳақиқий эмас. ${esc(o.bekor)}</span></div>`
  : `<div class="q"><b class="l">Ҳисоб-китоб:</b><span>қайтарилиши керак ${pul(o.q.qaytar)} · аввал қайтарилган ${pul(o.oldin)} · ушбу ордер ${pul(o.summa)} · қолдиқ <b>${pul(o.qoldiq)}</b></span></div>`}
<div class="q"><b class="l">Илова:</b><span class="i">Манба (ички ҳисоб): ${esc(manba)}${o.izoh ? '. ' + esc(o.izoh) : ''}</span></div>
<div class="imz">Директор <span class="ch" style="width:48mm"></span> К.Ҳ. Ҳайдаров &nbsp;&nbsp;&nbsp; Бош бухгалтер <span class="ch" style="width:42mm"></span><br>
Берди (кассир): <span class="ch" style="width:48mm"></span> ${esc(KR(o.kassir))}</div>
<div class="ol"><b>Олдим:</b> <span class="ch" style="width:120mm"></span> сўм<br>
<span class="i">(сумма сўз билан, ўз қўли билан)</span><br>
«____» ______________ 20___ й. &nbsp;&nbsp; Имзо: <span class="ch" style="width:45mm"></span><br>
Ф.И.Ш. (тўлиқ, ўз қўли билан): <span class="ch" style="width:98mm"></span><br>
<span class="ch" style="width:160mm"></span><br>
Паспорт: ${esc(o.pasport || '______________________________________________')}</div>
</body></html>`;
  return PDF.yasa(html, '', Object.assign({ format: 'A4', preferCSSPageSize: true, printBackground: true }, MI.chromKol()));
}

// ------------------------------------------------------------------ 📄 MIJOZ ARIZASI (06.11.2026, direktor): tizim chiqaradi, mijoz tagida Ф.И.Ш. ni qo'lda yozadi,
// imzolaydi va «Юқоридаги ариза менинг сўзларим билан тўғри ёзилган» deb tasdiqlaydi. Qarordan OLDIN ham chiqadi (summa — qaror bo'lsa qarordagi, aks holda jami to'langan).
async function qaytarishAriza([kodSes, no0]) {
  await direktor(kodSes);
  const no = s(no0).trim();
  if (!/^27\/\d+$/.test(no)) throw new S.Xato('Sotuv shartnomasi raqamini kiriting (27/…).');
  const sh = (await V.qatorlar(S3)).map(z => z.x).find(r => s(r[0]).trim() === no);
  if (!sh) throw new S.Xato('Shartnoma topilmadi: ' + no);
  const mj = (await V.qatorlar(M2)).map(z => z.x).find(r => s(r[0]).trim() === s(sh[4]).trim()) || [];
  const H = await holatYig();
  const q = H.qarorlar.filter(x => x.no === no && x.holati !== 'Bekor').pop();
  const tolangan = H.T.filter(t => t.no === no).reduce((a, t) => a + t.summa, 0);
  const summa = q ? q.qaytar : tolangan;
  if (!(summa > 0)) throw new S.Xato(no + ' bo\'yicha to\'lov topilmadi — qaytariladigan summa yo\'q.');
  const KR = v => { try { return require('../lib/ism').xatKirill(s(v)); } catch (e) { return s(v); } };
  const fish = KR(s(mj[2] || sh[20]).trim());
  const pas = [s(mj[6]).replace(/\s/g, ''), s(mj[8]) ? s(mj[8]) + ' ИИБ' : '', iso(mj[9]) ? dmy(iso(mj[9])) + ' да берилган' : ''].filter(Boolean).join(', ');
  const SOZ = SH.sozBilan(summa);
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>
@page{size:A4;margin:18mm 16mm 20mm 25mm}*{box-sizing:border-box}body{margin:0;font-family:'Liberation Serif','Times New Roman',serif;font-size:13pt;line-height:1.45;color:#000}
.kimga{margin-left:52%;font-size:12.5pt;line-height:1.4}.h{text-align:center;font-size:16pt;font-weight:bold;letter-spacing:2px;margin:12mm 0 6mm}
p{margin:0 0 3mm;text-align:justify;text-indent:12mm}.ch{display:inline-block;border-bottom:.7pt solid #000;vertical-align:bottom}.k{font-size:10pt;color:#444}
.imz{margin-top:12mm;line-height:2.4}</style></head><body>
<div class="kimga">«ANGOR KARVON SAROY» МЧЖ<br>директори К.Ҳ.&nbsp;Ҳайдаровга<br>фуқаро <b>${esc(fish)}</b>дан<br>
Манзил: ${esc(s(mj[25]) || '________________________')}<br>Паспорт: ${esc(pas || '________________________')}<br>Тел.: ${esc(s(mj[4]) || '________________')}</div>
<div class="h">АРИЗА</div>
<p>Мен, ${esc(fish)}, Сиз раҳбарлик қилаётган «ANGOR KARVON SAROY» МЧЖ билан ${esc(dmy(iso(sh[2])))} санада тузилган, ${esc(s(sh[5]))} рақамли савдо дўкони бўйича №${esc(no)}-сонли шартномани ўз ташаббусим билан бекор қилишни ва шартнома бўйича тўлаган <b>${pul(summa)}</b> (${esc(SOZ)}) сўм маблағимни менга қайтаришни сўрайман.</p>
<p>Маблағни Жамият кассасидан нақд пулда, бўлиб-бўлиб олишга розиман. Ҳар бир олган суммам учун чиқим касса ордерига имзо қўяман.</p>
<p>Маблағ тўлиқ қайтарилгач, ушбу шартнома бўйича Жамиятга нисбатан ҳеч қандай моддий ва бошқа даъвом бўлмайди.</p>
<div class="imz">«____» ______________ 20___ йил &nbsp;&nbsp;&nbsp; Имзо: <span class="ch" style="width:55mm"></span><br>
Ф.И.Ш. <span class="k">(тўлиқ, ўз қўли билан)</span>: <span class="ch" style="width:105mm"></span><br>
<span class="ch" style="width:165mm"></span><br>
Юқоридаги ариза менинг сўзларим билан тўғри ёзилган.<br>Имзо: <span class="ch" style="width:55mm"></span></div>
</body></html>`;
  const pdf = await PDF.yasa(html, '', Object.assign({ format: 'A4', preferCSSPageSize: true, printBackground: true }, MI.chromKol()));
  return { nom: 'Ariza_qaytarish_' + no.replace(/\//g, '-') + '_' + (s(mj[2] || sh[20]).split(/\s+/)[0] || 'Mijoz') + '.pdf', mime: 'application/pdf', b64: pdf.toString('base64') };
}

module.exports = { qaytarishHolat, qaytarishQaror, qaytarishKirit, qaytarishPdf, qaytarishBekor, qaytarishAriza, qaytarishQarorBekor, qaytarishArizaSkan, qaytarishSkan };
module.exports._ichki = { manbaOqi, manbaYoz, iso, holatYig, ko2Pdf, QR, KQ, KUT, bekorAjrat, skanTuzatKataklar };
