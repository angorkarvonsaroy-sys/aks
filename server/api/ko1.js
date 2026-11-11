// AKS TIZIM — 🧾 KIRIM KASSA ORDERI (KO-1) dasturning o'zida (11.11.2026, direktor). Avval faqat loyiha chatidagi generator chiqarardi.
//   ko1Chiqar(kod, tolovId) — 05_Tolovlar dagi NAQD to'lovga KO-1 PDF: { ok, raqam, nom, b64, ogoh[] }
// Raqam: KO1-<yil>/<0001…> — yil to'lov sanasidan, tartib shu yil ichida (05 F «Hujjat_№» dagi eng katta raqam + 1). Raqam birinchi chiqarishda
//   05 F ga yoziladi (qo'lda yozish kerak emas); F da allaqachon raqam bo'lsa (qo'lda yozilgan yoki avval berilgan) — o'sha ishlatiladi, hech narsa yozilmaydi.
//   Eski bazadan ko'chirilgan («Migratsiya») to'lovlarga raqam BERILMAYDI — qog'ozdagi eski raqam bilan chalkashmasin; varaqda raqam joyi bo'sh qoladi.
// Qarz — ORDER SANASIDAGI holat: jami to'langan (03 AB) dan shu sanadan KEYINGI to'lovlar ayiriladi; asosiy = MAX(0, W − to'langan),
//   qo'shimcha = MAX(0, Y − MAX(0, to'langan − W)), muddati o'tgan = MIN(asosiy, MAX(0, jadval(≤sana) − to'langan)) — 03 AC/AD/AF formulalari bilan bir xil.
// «Асос» — to'lovda saqlangan maqsad (tolovMaqsad yozgan matn); bo'lmasa umumiy matn. Faqat naqd; bekor qilingan shartnomaga chiqarilmaydi.
'use strict';
const S = require('./sessiya');
const V = require('../lib/varaq');
const G = require('../lib/google');
const env = require('../lib/env');
const BQ = require('../lib/bayroq');
const KR = require('../lib/korinish');
const KH = require('../lib/ko1_hujjat');
const tetik = require('../lib/kozgu_tetik');
const { qulfBilan } = require('../lib/qulf');

const T05 = '05_Tolovlar', T03 = '03_Sotuv_shartnomalar', T03b = '03b_Tolov_jadvali', T02 = '02_Mijozlar', T01 = '01_Dokonlar';
const s = v => String(v == null ? '' : v).trim();
const RAQAM = /^KO1-(\d{4})\/(\d+)$/;
const kut = (p, ms) => Promise.race([p, new Promise(r => setTimeout(r, ms))]);
const butun = v => { const n = Number(v); return isNaN(n) || s(v) === '' ? s(v) : String(n); };

// ko'zgudan: to'lov, shartnoma, mijoz, do'kon, jadval
async function malumot(id) {
  const [R5, R3, R3b, R2, R1] = await Promise.all([T05, T03, T03b, T02, T01].map(v => V.qatorlar(v)));
  const t5 = R5.find(({ x }) => s(x[0]) !== '' && butun(x[0]) === id);
  if (!t5) return null;
  const x = t5.x, no = s(x[2]);
  const tolov = { id, sana: V.iso(x[1]) || '', no, summa: V.son(x[3]), shakl: s(x[4]), hujjat: s(x[5]), maqsad: s(x[6]), kim: s(x[9]) };
  const sh = (R3.find(({ x: y }) => s(y[0]) === no) || {}).x || null;
  if (!sh) return { tolov, sh: null };
  const mj = (R2.find(({ x: y }) => butun(y[0]) === butun(sh[4])) || {}).x || [];
  const dk = (R1.find(({ x: y }) => s(y[0]) === s(sh[5])) || {}).x || null;
  const b = s(sh[5]).split('-');
  const T = R5.filter(({ x: y }) => s(y[2]) === no && s(y[0]) !== '').map(({ x: y }) => ({ sana: V.iso(y[1]) || '', summa: V.son(y[3]) }));
  const J = R3b.filter(({ x: y }) => s(y[1]) === no).map(({ x: y }) => ({ sana: V.iso(y[3]) || '', summa: V.son(y[4]) })).filter(j => j.sana);
  return { tolov, sh, mj, T, J,
    dokon: { blok: dk ? s(dk[2]) : (b[0] || ''), qavat: dk ? butun(dk[3]) : (b[1] || ''), nr: dk ? butun(dk[4]) : (b.slice(2).join('-') || ''), maydon: Number(sh[21]) || (dk ? Number(dk[5]) : 0) || 0 } };
}
// order sanasidagi qarz
function qarzHisob(M, bugun) {
  const { tolov: t, sh, T, J } = M;
  const W = V.son(sh[22]), Y = V.son(sh[24]), ab = V.son(sh[27]);
  const yig = T.reduce((a, z) => a + z.summa, 0);
  const eski = yig > ab + 1;                                   // 05 da to'lov bor, 03 AB hali yangilanmagan (ko'zgu orqada) → 05 yig'indisi olinadi
  const hozir = eski ? yig : ab;
  const keyingi = T.filter(z => z.sana > t.sana).reduce((a, z) => a + z.summa, 0);
  const tolangan = hozir - keyingi;
  const asosiy = Math.max(0, W - tolangan);
  const qoshimcha = Y > 0 ? Math.max(0, Y - Math.max(0, tolangan - W)) : 0;
  const jami = asosiy + qoshimcha;
  let motgan;
  if (!eski && keyingi === 0 && t.sana === bugun) motgan = Math.min(V.son(sh[31]), asosiy);     // bugungi holat — 03 AF ning o'zi
  else motgan = Math.min(asosiy, Math.max(0, J.filter(j => j.sana <= t.sana).reduce((a, j) => a + j.summa, 0) - tolangan));
  const tugash = J.length ? J.map(j => j.sana).sort().pop() : '';
  return { tolangan, asosiy: Math.round(asosiy), qoshimcha: Math.round(qoshimcha), jami: Math.round(jami), motgan: Math.round(motgan), keyingi, eski, tugash,
    umumiy: V.son(sh[25]) || (W + Y), oylik: V.son(sh[26]), tolovKuni: Number(sh[12]) || 0 };
}
// raqam berish — Google'dan YANGI o'qib, 05 F ga yoziladi (to'lov yozuvi bilan bitta qulf: qatorlar surilib ketmasin)
async function raqamBer(id, yil) {
  return qulfBilan('j:' + T05, async () => {
    const [A, F] = await Promise.all([G.ustunOqi(env.aksBazaId, T05, 'A', env.googleKey), G.ustunOqi(env.aksBazaId, T05, 'F', env.googleKey)]);
    const i = A.findIndex((v, k) => k > 0 && s(v) !== '' && butun(v) === id);
    if (i < 0) throw new S.Xato('To\'lov jadvalda topilmadi (№' + id + ') — sahifani yangilab, qayta urinib ko\'ring.');
    if (s(F[i])) return { raqam: s(F[i]), yangi: false };
    let mx = 0; F.forEach(v => { const m = RAQAM.exec(s(v)); if (m && m[1] === yil && +m[2] > mx) mx = +m[2]; });
    const raqam = 'KO1-' + yil + '/' + String(mx + 1).padStart(4, '0');
    await G.yoz(env.aksBazaId, [{ varaq: T05, katak: 'F' + (i + 1), qiymat: [[raqam]] }], env.googleKey);
    return { raqam, yangi: true };
  }, S.Xato);
}

async function ko1Chiqar([kodSes, id0]) {
  const u = await S.ruxsat(kodSes, 'tolov');
  const id = butun(id0);
  if (!id) throw new S.Xato('To\'lov ko\'rsatilmagan.');
  let M = await malumot(id);
  if (!M) { await tetik.yangilaKut(20000); M = await malumot(id); }      // hozirgina kiritilgan — ko'zgu hali o'qimagan bo'lishi mumkin
  if (!M) throw new S.Xato('To\'lov topilmadi (№' + id + ').');
  const t = M.tolov;
  if ((await KR.yopiqlar(u)).has(t.no)) throw new S.Xato('Bu shartnoma sizga ko\'rinmaydi.');
  if (t.shakl !== 'Naqt') throw new S.Xato('Kirim kassa orderi faqat NAQD to\'lovga chiqariladi (bu to\'lov — «' + t.shakl + '»).');
  if (!M.sh) throw new S.Xato('KO-1 hozircha faqat sotuv shartnomasi to\'loviga chiqariladi (shartnoma topilmadi: ' + t.no + ').');
  if (/bekor/i.test(s(M.sh[13]))) throw new S.Xato('Shartnoma ' + t.no + ' bekor qilingan — unga kirim kassa orderi chiqarilmaydi.');
  if (!t.sana || !(t.summa > 0)) throw new S.Xato('To\'lov sanasi yoki summasi noto\'g\'ri — jadvalni tekshiring.');
  const ogoh = [];
  let q = qarzHisob(M, V.bugun());
  if (q.eski) { await kut(tetik.varaqlarYangila([T05, T03]).catch(() => {}), 15000); const M2 = await malumot(id); if (M2 && M2.sh) { M = M2; q = qarzHisob(M, V.bugun()); } }

  // raqam
  // 05 F da raqam emas, izoh turgan bo'lsa («Кирим ордери асосида» — raqamsiz matn) — u order raqami sifatida yozilmaydi va ustidan ham yozilmaydi
  let raqam = t.hujjat;
  if (raqam && !/\d/.test(raqam)) { ogoh.push('To\'lovning «hujjat raqami» katagida raqam emas, matn turibdi («' + raqam + '») — order raqami berilmadi. Katakni bo\'shatsangiz, dastur raqamni o\'zi beradi.'); raqam = ''; }
  else if (!raqam) {
    if (/^migratsiya/i.test(t.kim)) ogoh.push('Eski bazadan ko\'chirilgan to\'lov — order raqami berilmadi (qog\'ozdagi raqamni qo\'lda yozing).');
    else if (!(await BQ.yozuv('tolov'))) ogoh.push('Serverda yozish o\'chirilgan — order raqami berilmadi.');
    else {
      try { const r = await raqamBer(id, t.sana.slice(0, 4)); raqam = r.raqam; if (r.yangi) tetik.varaqlarYangila([T05]).catch(() => {}); }
      catch (e) { if (e instanceof G.RuxsatYoq) ogoh.push('Robotda jadvalga yozish huquqi yo\'q — order raqami berilmadi.'); else throw e; }
    }
  }
  const a = KH.asosMatn(t.maqsad, t.kim);
  if (a.qolda) ogoh.push('To\'lovdagi maqsad qo\'lda yozilgan — «Асос» qatoriga umumiy matn qo\'yildi.');
  if (q.keyingi > 0) ogoh.push('Shu sanadan keyin yana to\'lov bor — eslatmadagi qarz ' + t.sana.split('-').reverse().join('.') + ' holatiga hisoblandi.');
  const o = { raqam, sana: t.sana, fish: s(M.mj[2]) || s(M.sh[20]), mid: butun(M.sh[4]), tel: M.mj[4], no: t.no, shSana: V.iso(M.sh[2]) || '',
    blok: M.dokon.blok, qavat: M.dokon.qavat, dokon: M.dokon.nr, maydon: M.dokon.maydon, summa: t.summa, asos: a.matn,
    asosiy: q.asosiy, motgan: q.motgan, qoshimcha: q.qoshimcha, jami: q.jami, tolangan: q.tolangan, umumiy: q.umumiy, oylik: q.oylik, tolovKuni: q.tolovKuni, tugash: q.tugash };
  const pdf = await KH.pdf(o);
  const nom = 'KO-1_' + (raqam ? raqam.replace(/[^\wА-Яа-я-]+/g, '-') + '_' : '') + t.no.replace(/\//g, '-') + '_' + t.sana.split('-').reverse().join('-') + '.pdf';
  return { ok: true, id, raqam: raqam || '', nom, b64: pdf.toString('base64'), ogoh };
}

module.exports = { ko1Chiqar };
module.exports._ichki = { malumot, qarzHisob, raqamBer, RAQAM };
