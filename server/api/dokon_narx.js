// AKS TIZIM — 💲 DO'KON NARXI VA IZOHI (direktor qarori 28.11.2026).
// Nima uchun: 01_Dokonlar G (Baza_narx) va O (Izoh) ustunlarini faqat Google jadvalidan qo'lda tuzatish mumkin edi.
// Direktor telefonda ishlaydi — endi do'kon kartasidan o'zgartiradi. Ikki hol uchun kerak bo'ldi:
//   1) bekor qilingan shartnomadan qolgan eski narxlar (28.11: 9 ta bo'sh do'konda prays-listda yo'q narx turardi);
//   2) hojatxonaga aylantirilgan do'konlar — L-1-12, L-1-13 (16 200 000) va B2-1-22 (20 630 000, 13 410 000 × 20/13
//      — 10 530 000 → 16 200 000 propor­siyasi saqlangan holda), Izoh: «ҲОЖАТХОНА».
// Faqat direktor. Sotilgan yoki ijaradagi do'kon narxi O'ZGARTIRILMAYDI (narx shartnomada qotgan).
// Yozuv: G.yoz (G va/yoki O) + 06j_Tahrir_jurnali, keyin ko'zgu 01_Dokonlar.
'use strict';
const S = require('./sessiya');
const V = require('../lib/varaq');
const G = require('../lib/google');
const env = require('../lib/env');
const tetik = require('../lib/kozgu_tetik');
const NR = require('../lib/narx');
const QY = require('./qadam_yoz')._ichki;

const s = v => String(v == null ? '' : v);
const DK_V = '01_Dokonlar', JUR_V = '06j_Tahrir_jurnali';
const IZOH_MAX = 120;
const kut = (p, ms) => Promise.race([p, new Promise(r => setTimeout(r, ms))]);
const pul = n => Math.round(Number(n) || 0).toLocaleString('ru-RU').replace(/[  ,]/g, ' ');

async function dokonQator(id) {
  const t = s(id).trim().toUpperCase();
  const z = (await V.qatorlar(DK_V)).filter(V.dokonMi).find(q => s(q.x[0]).trim().toUpperCase() === t);
  if (!z) throw new S.Xato('Bunday do\'kon topilmadi: ' + s(id));
  return z;
}
const bandMi = x => {
  const ij = s(x[21]).trim();
  return { sotilgan: !!s(x[17]).trim(), ijarada: !!(ij && !/^IJ-YOQ/i.test(ij)) };
};

// 👔 direktor: do'kon narxi/izohi — hozirgi holat va prays-list taklifi
async function dokonNarxKorish(args) {
  const [kodSes, id] = args;
  const u = await S.ruxsat(kodSes, 'admin'); if (!u.admin) throw new S.Xato('Faqat direktor uchun.');
  const z = await dokonQator(id), x = z.x, b = bandMi(x);
  const baza = Number(x[6]) || 0, maydon = Number(x[5]) || 0;
  const prays = NR.praysBaza(await V.qatorlar(DK_V), s(x[2]).trim(), s(x[3]).trim(), maydon);
  return { ok: true, id: s(x[0]).trim(), blok: s(x[2]).trim(), qavat: s(x[3]).trim().replace(/\.0+$/, ''), no: s(x[4]).trim(),
    maydon, baza, izoh: s(x[14]).trim(), jami: Math.round(baza * maydon),
    rasmiy: NR.RASMIY_BAZA.indexOf(baza) >= 0, prays, sotilgan: b.sotilgan, ijarada: b.ijarada,
    egasi: s(x[18]).trim(), sotuvNo: s(x[17]).trim(), ijaraNo: s(x[21]).trim(), bazalar: NR.RASMIY_BAZA };
}

// 👔 direktor: yozish. baza — son yoki '' (tegilmaydi), izoh — matn yoki null (tegilmaydi)
async function dokonNarxYoz(args) {
  const [kodSes, id, baza0, izoh0] = args;
  const u = await S.ruxsat(kodSes, 'admin'); if (!u.admin) throw new S.Xato('Faqat direktor uchun.');
  const z = await dokonQator(id), x = z.x;
  const b = bandMi(x);
  const eskiBaza = Number(x[6]) || 0, eskiIzoh = s(x[14]).trim(), maydon = Number(x[5]) || 0;
  const D = [], ozg = [];

  const yangiBaza = s(baza0).trim() === '' ? null : Math.round(Number(String(baza0).replace(/[^\d]/g, '')) || 0);
  if (yangiBaza !== null) {
    if (b.sotilgan) throw new S.Xato('Bu do\'kon sotilgan (' + s(x[17]).trim() + ') — narxi shartnomada qotgan, o\'zgartirilmaydi.');
    if (b.ijarada) throw new S.Xato('Bu do\'kon ijarada (' + s(x[21]).trim() + ') — avval ijarani ko\'rib chiqing.');
    if (yangiBaza < NR.NARX.engPast) throw new S.Xato('1 m² narxi ' + pul(NR.NARX.engPast) + ' so\'mdan past bo\'lmaydi (direktor qarori 23.11.2026).');
    if (yangiBaza % 1000) throw new S.Xato('Narxni butun raqam qilib yozing — 1 000 so\'mgacha to\'g\'ri kelsin (yozilgani: ' + pul(yangiBaza) + ').');
    if (yangiBaza !== eskiBaza) {
      D.push({ varaq: DK_V, katak: 'G' + z.qator, qiymat: [[yangiBaza]] });
      ozg.push(['1 m² narx', pul(eskiBaza), pul(yangiBaza)]);
    }
  }
  if (izoh0 !== null && izoh0 !== undefined) {
    const yangiIzoh = s(izoh0).trim().slice(0, IZOH_MAX);
    if (yangiIzoh !== eskiIzoh) {
      D.push({ varaq: DK_V, katak: 'O' + z.qator, qiymat: [[yangiIzoh]] });
      ozg.push(['Izoh', eskiIzoh || '—', yangiIzoh || '—']);
    }
  }
  if (!D.length) return { ok: true, ozgarmadi: true, natija: s(x[0]).trim() + ': o\'zgarish yo\'q.' };

  await G.yoz(env.aksBazaId, D, env.googleKey);
  try {
    const vaqt = QY.hozir().dmyHm;
    const AJ = (await G.ustunOqi(env.aksBazaId, JUR_V, 'A', env.googleKey)) || [];
    let n = Math.max(0, ...AJ.slice(1).map(v => Number(v) || 0));
    const L = ozg.map(o => [++n, vaqt, 'ID ' + s(x[0]).trim(), 'Dokon', '', o[0], o[1], o[2], u.fish, 'direktor: do\'kon kartasi']);
    await G.qatorlarQoshR(env.aksBazaId, JUR_V, AJ.length + 1, L, env.googleKey);
  } catch (e) { console.error('dokonNarxYoz jurnal:', e.message); }
  await kut(tetik.varaqlarYangila([DK_V, JUR_V]).catch(e => console.error('ko\'zgu (narx):', e.message)), 20000);

  const yb = yangiBaza === null ? eskiBaza : yangiBaza;
  return { ok: true, natija: s(x[0]).trim() + ' yangilandi: ' + ozg.map(o => o[0] + ' ' + o[1] + ' → ' + o[2]).join(', ')
    + (maydon ? ' · jami ' + pul(yb * maydon) + ' so\'m' : ''), ozg };
}

module.exports = { dokonNarxKorish, dokonNarxYoz };
module.exports._ichki = { dokonQator, bandMi, IZOH_MAX };
