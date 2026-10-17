// AKS TIZIM — ✉ Ogohlantirish xatlari: xatBoshlang (Xat.gs) serverda — ro'yxat va «keyingi xat mumkinmi». Faqat o'qiydi.
// Xat tayyorlash (PDF), «✉ Yuborildi», isbot yuklash, bekor qilish — eski tizimda (ko'prik).
'use strict';
const S = require('./sessiya');
const V = require('../lib/varaq');
const J = require('../lib/jurnallar');
const X = require('../lib/xat_yordam');
const P = require('../lib/portfel');

const XAT_BOSQICH_QM = { 1: 'Maydon farqi: bildirishnoma', 2: 'Maydon farqi: ogohlantirish', 3: 'Maydon farqi: talabnoma' };
const XAT_BOSQICH = { 1: 'Eslatma (1-xat)', 2: 'Ogohlantirish (2-xat)', 3: 'Sudgacha talabnoma' };

const xatEskirgan = (h, bugunIso) => h.holati === 'Tayyorlandi' && !!h.muddat && X.xatIso(h.muddat) < bugunIso;
function xatKorinish(h, u, bugun, bugunDmy) {
  const tk = String(h.tek || '').split('|');
  return { raqam: h.raqam, sana: h.sana, bosqich: h.bosqich, seriya: X.xatSeriya(h.shablon), holati: h.holati, muddat: h.muddat, skan: h.skan, usul: h.usul, yetSana: h.yetSana, pochta: h.pochta, kim: h.kim,
    tek: tk[0] || '', tekIzoh: tk[0] === 'Rad' ? (tk[3] || '') + ' (' + (tk[2] || '') + ', ' + (tk[1] || '') + ')' : tk[0] === 'Tasdiqlandi' ? (tk[2] || '') + ', ' + (tk[1] || '') : '',
    kechikdi: X.xatKechikkan(h, bugun), eskirgan: xatEskirgan(h, bugun),
    bekorMumkin: h.holati !== 'Bekor' && (u.admin || xatEskirgan(h, bugun) || (h.kim === u.fish && h.holati === 'Tayyorlandi' && h.vaqt.indexOf(bugunDmy) === 0)) };
}
// hujjatTopShartnoma_: direktor shu xodimga bergan ochiq topshiriqlardagi shartnomalar
async function hujjatTopShartnoma(fish) {
  const o = {};
  (await J.topRows()).forEach(t => { const no = String(t.no || '').trim();
    if (no && String(t.manba).trim() === 'Direktor' && String(t.kimga).trim() === fish && String(t.holati).trim() === 'Jarayonda') o[no] = true; });
  return o;
}

async function xatBoshlang([kodSes]) {
  const u = await S.ruxsat(kodSes, 'xat');
  const bugun = V.bugun(), bugunDmy = bugun.split('-').reverse().join('.');
  const adm = !!u.admin;                                                  // xatAdmin_ / undAdmin_
  const ch = (!adm && u.huquq.indexOf('undiruv') >= 0) ? u.fish : '';     // xatCheklov_ (undCheklov_ + undiruvchi)
  const [YF, TOP, XS, Jx, UJ, Z] = await Promise.all([P.yuFaolSet(), ch ? hujjatTopShartnoma(u.fish) : {}, P.xatShartnomalar(bugun), J.xatJurnal(), J.undJurnal(), X.xatZanjir(u.kod)]);
  const ozi = x => x.undiruvchi === ch && !YF.yuristda.has(x.no);
  const L = XS.filter(x => !ch || ozi(x) || TOP[x.no]);
  const Jn = {}; Jx.forEach(h => (Jn[h.no] = Jn[h.no] || []).push(h));
  const UJn = {}; UJ.forEach(j => (UJn[j.no] = UJn[j.no] || []).push(j));
  L.forEach(x => { const Jm = Jn[x.no] || [], Um = UJn[x.no] || [];
    x.xatlar = Jm.map(h => xatKorinish(h, u, bugun, bugunDmy)); x.keyingi = P.xatKeyingi(x, Jm, bugun, Um, adm, 'AS', Z);
    x.keyingiQM = x.qoshimcha > X.XAT_MIN_QARZ ? P.xatKeyingi(x, Jm, bugun, Um, adm, 'QM', Z) : null;
    if (ch && !ozi(x)) {
      const t = { mumkin: false, sabab: '📌 Bu shartnoma sizga direktor topshirig\'i bo\'yicha ochilgan: tayyor xatni yuklab olish va «✉ Yuborildi» orqali isbotini yuklash mumkin. Yangi xat chiqarilmaydi.' };
      x.topshiriq = true; x.keyingi = t; if (x.keyingiQM) x.keyingiQM = t;
    } });
  return { royxat: L, bugun, admin: u.admin, bosqich: XAT_BOSQICH, bosqichQM: XAT_BOSQICH_QM };
}

// 🔎 xatNazorat (Xat.gs) — yetkazilishi kechikkan xatlar (direktor)
async function xatNazorat([kodSes]) {
  await S.ruxsat(kodSes, 'admin');
  const bugun = V.bugun();
  const fish = {}; (await P.xatShartnomalar(bugun)).forEach(x => fish[x.no] = { fish: x.fish, und: x.undiruvchi });
  const L = (await J.xatJurnal()).map(h => ({ raqam: h.raqam, no: h.no, sana: h.sana, holati: h.holati, kim: h.kim, kun: X.xatKechikkan(h, bugun),
    fish: (fish[h.no] || {}).fish || '', und: (fish[h.no] || {}).und || '' })).filter(h => h.kun).sort((a, b) => b.kun - a.kun);
  return { royxat: L, chegara: 3 };   // XAT_YETKAZISH_KUN
}

// 📄 xatPdf — chiqarilgan xat PDF i (Drive, robot «Читатель»); robot ko'rmasa — eski tizim
async function xatPdf([kodSes, raqam]) {
  const u = await S.ruxsat(kodSes, 'xat');
  const h = (await J.xatJurnal()).find(z => z.raqam === raqam);
  if (!h || !h.pdf) throw new S.Xato('Xat topilmadi: ' + raqam);
  const ch = (!u.admin && u.huquq.indexOf('undiruv') >= 0) ? u.fish : '';   // xatEgasi_ (xatCheklov_)
  if (ch) { const x = (await P.xatShartnomalar(V.bugun())).find(z => z.no === h.no);
    if (!x || x.undiruvchi !== ch) { if (!(x && (await hujjatTopShartnoma(u.fish))[x.no])) throw new S.Xato('Bu shartnoma sizning portfelingizda emas.'); } }
  const G = require('../lib/google'), env = require('../lib/env');
  try { const f = await G.driveFayl(h.pdf, env.googleKey); return { nom: f.nom, b64: f.bytes.toString('base64') }; }
  catch (e) { if (!(e instanceof G.RuxsatYoq)) console.error('xatPdf (Drive):', e.message); return require('./koprik').chaqir('xatPdf', u.kod, [raqam]); }
}

module.exports = { xatBoshlang, xatNazorat, xatPdf };
