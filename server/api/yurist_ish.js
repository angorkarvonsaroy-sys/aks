// AKS TIZIM — ⚖ yurist bo'limining qolgan yozuvlari serverda (Yurist.gs v25.9 bilan bir xil tekshiruvlar, xato matnlari va kataklar):
//   yuristTogridan — direktor ishni to'g'ridan-to'g'ri yuristga o'tkazadi (06b yangi «Faol» ish, yo'l «Togridan», AD «Tasdiqladi»; 06f tarix);
//   yuristTopBer   — yurist undiruvchiga topshiriq beradi (10_Topshiriqlar yangi qator «yutop|…», Telegram; 06f tarix).
// Yoqilishi: Redis yozuv_yondi:yurist_ish («aks-yozuv-sinov yuristish»). Aks holda, yoki robotda yozish huquqi bo'lmasa — eski tizim.
'use strict';
const S = require('./sessiya');
const V = require('../lib/varaq');
const J = require('../lib/jurnallar');
const U = require('../lib/undiruv_yordam');
const G = require('../lib/google');
const env = require('../lib/env');
const koprik = require('./koprik');
const tetik = require('../lib/kozgu_tetik');
const { redis } = require('../lib/db');
const QY = require('./qadam_yoz')._ichki;
const YS = require('./yurist_sorov')._ichki;
const TP = require('./topshiriq_yoz')._ichki;
const { xodimTeng } = require('../lib/xodim');

const YU_V = YS.YU_V, TAR_V = YS.TAR_V, TOP_V = TP.TOP_V;
const YU_FAOL = ['Faol', 'Kelishuv', "Yopish so'ralgan"];
const YU_TOP_TUR = [['PASPORT', 'Mijoz pasport nusxasini yuklang'], ['SHARTNOMA', 'Imzolangan shartnoma skanini yuklang'], ['NOTARIAL', 'Notarial hujjat nusxasini yuklang'],
  ['QOSHIMCHA_KELISHUV', 'Qo\'shimcha kelishuv / dalolatnoma skanini yuklang'], ['JSHSHIR', 'Mijozning JSHSHIR ini toping (14 raqam)'], ['MANZIL', 'Mijozning yashash manzilini aniqlang'],
  ['BOSHQA', 'Boshqa']];
const s = v => String(v == null ? '' : v);
const kut = (p, ms) => Promise.race([p, new Promise(r => setTimeout(r, ms))]);
function hozirDmyHm() { const d = new Date(Date.now() + 5 * 3600 * 1000), p = n => String(n).padStart(2, '0');
  return p(d.getUTCDate()) + '.' + p(d.getUTCMonth() + 1) + '.' + d.getUTCFullYear() + ' ' + p(d.getUTCHours()) + ':' + p(d.getUTCMinutes()); }
async function serverda() { try { return (await redis.get('yozuv_yondi:yurist_ish')) === '1'; } catch (e) { return false; } }
async function eskiTizim(fn, u, args) { const r = await koprik.chaqir(fn, u.kod, args); await tetik.yangilaKut(20000); return r; }

// yuTalabBor_: isbotli talabnoma — tizimdagi 3-bosqich xat «Yuborildi» (yurist tekshiruvida emas) yoki «Ogohlantirish xati» turidagi talabnoma skani
function yuTalabBor(no, H, XJ) {
  if (XJ.some(h => h.no === no && h.holati === 'Yuborildi' && Number(h.bosqich) === 3 && !/^Kutilmoqda/.test(s(h.tek)))) return true;
  return (H || []).some(h => h.no === no && h.turi === 'OGOHLANTIRISH' && /талаб|talab/i.test(s(h.izoh) + ' ' + s(h.nom)));
}
// yuIshlar_ — Google'dan yangi (getValues: id, no, holati, undiruvchi, fish)
async function yuIshlarYangi() {
  const R = await G.oraliqOqi(env.aksBazaId, YU_V, 'A2:AG', env.googleKey, 'UNFORMATTED_VALUE');
  let l = -1; R.forEach((z, k) => { if (s(z[0]) !== '') l = k; });
  return R.slice(0, l + 1).map((r, n) => ({ qator: n + 2, id: r[0], no: s(r[1]), holati: s(r[14]), fish: s(r[16]), dokon: s(r[17]), undiruvchi: s(r[26]) }))
    .filter(i => i.id && i.no && i.holati);
}

// ------------------------------------------------------------------ direktor: to'g'ridan-to'g'ri o'tkazish (eski ishlar)
async function yuristTogridan(args) {
  const [kodSes, no, sabab0] = args;
  const u = await S.ruxsat(kodSes, 'admin');
  if (!(await serverda())) return eskiTizim('yuristTogridan', u, args.slice(1));
  const sabab = s(sabab0).replace(/\s+/g, ' ').trim();
  if (sabab.length < 15) throw new S.Xato('Sababini yozing (kamida 15 belgi): masalan, tizimgacha qanday xatlar yuborilgan.');
  let yoq = false;
  const r = await QY.qulf('yurist', async () => {
    const x = (await U.undShartnomalar()).find(z => z.no === s(no)); if (!x) throw new S.Xato('Shartnoma topilmadi: ' + no);
    if (await YS.ishBor(x.no)) throw new S.Xato('Bu mijoz allaqachon yuristda yoki so\'rov kutilmoqda.');
    const [HJ, XJ] = await Promise.all([J.hujjatJurnal(), J.xatJurnal()]);
    const H = HJ.filter(h => h.no === x.no && h.holati === 'Faol');
    if (!H.some(h => h.turi === 'SHARTNOMA')) throw new S.Xato('Avval imzolangan shartnomaning skanini yuklang (📎 Hujjatlar).');
    if (!yuTalabBor(x.no, H, XJ)) throw new S.Xato('Yuristga o\'tkazish uchun mijozga TALABNOMA isboti bilan yetkazilgan bo\'lishi kerak: tizimdagi talabnoma (3-bosqich xat) «Yuborildi», '
      + 'yoki tizimgacha yuborilgan talabnomaning skani «Ogohlantirish xati» turi bilan, izohida «talabnoma» so\'zi bilan yuklangan bo\'lsin. Talabnoma yo\'q bo\'lsa — ⚖ Sud kartasidagi «📨 Talabnoma topshirig\'i».');
    let i;
    try { i = await YS.yuYangi(YU_V, x, 'Faol', 'Togridan', u.fish, sabab); }
    catch (e) { if (e instanceof G.RuxsatYoq) { yoq = true; return null; } throw e; }
    await G.yoz(env.aksBazaId, [{ varaq: YU_V, katak: 'AD' + i.qator, qiymat: [[u.fish + ', ' + hozirDmyHm()]] }], env.googleKey);
    await YS.tarixYoz(TAR_V, i, "Direktor to'g'ridan-to'g'ri yuristga o'tkazdi", u.fish, sabab, '');
    return { ok: true };
  });
  if (yoq) return eskiTizim('yuristTogridan', u, args.slice(1));
  await kut(tetik.varaqlarYangila([YU_V, TAR_V]).catch(e => console.error('ko\'zgu (yurist to\'g\'ridan):', e.message)), 15000);
  return r;
}

// ------------------------------------------------------------------ 📌 yurist → undiruvchiga topshiriq. d = { tur, izoh, muddat (yyyy-MM-dd) }
async function yuristTopBer(args) {
  const [kodSes, id, d0] = args; const d = d0 || {};
  const u = await S.ruxsat(kodSes, 'yurist');
  if (!(await serverda()) || !(await TP.koprik15(u.kod))) return eskiTizim('yuristTopBer', u, args.slice(1));
  const i = (await yuIshlarYangi()).find(z => String(z.id) === String(id)); if (!i) throw new S.Xato('Ish topilmadi.');
  if (YU_FAOL.indexOf(i.holati) < 0) throw new S.Xato('Ish holati: ' + i.holati + ' — topshiriq faqat faol ishga beriladi.');
  const S1 = v => s(v).replace(/\s+/g, ' ').trim();
  const tur = YU_TOP_TUR.find(t => t[0] === S1(d && d.tur)); if (!tur) throw new S.Xato('Nimani bartaraf qilish kerakligini tanlang.');
  const izoh = S1(d.izoh); if (tur[0] === 'BOSHQA' && izoh.length < 10) throw new S.Xato('Nima qilish kerakligini yozing (kamida 10 belgi).');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(S1(d.muddat))) throw new S.Xato('Muddatni tanlang.');
  const x = (await U.undShartnomalar()).find(z => z.no === i.no) || {};
  const XD = await TP.topXodimlar(), faol = f => f && XD.some(z => xodimTeng(z.fish, f));
  const kimga = [S1(x.undiruvchi), S1(i.undiruvchi)].find(faol) || (XD.find(z => z.admin) || {}).fish || '';
  if (!kimga) throw new S.Xato('Bu ishga biriktirilgan undiruvchi topilmadi — direktorga ayting.');
  const kalit = 'yutop|' + i.no + '|' + tur[0] + '|' + i.id;
  const p = S1(d.muddat).split('-');
  let yoq = false;
  const row = await QY.qulf('topshiriq', async () => {
    const R = await TP.topRowsYangi(TOP_V);
    if (R.L.some(t => t.kalit === kalit && (t.holati === 'Jarayonda' || t.holati === 'Tekshiruvda'))) throw new S.Xato('Bu kamchilik bo\'yicha topshiriq allaqachon berilgan.');
    try {
      return await TP.topYoz(TOP_V, { manba: 'Yurist', qoida: 'yutop', kalit, sarlavha: '⚖ Yurist: ' + (tur[0] === 'BOSHQA' ? izoh : tur[1]),
        izoh: (tur[0] === 'BOSHQA' ? '' : izoh ? izoh + ' · ' : '') + 'ish №' + i.id + ' · ' + (x.fish || i.fish || ''),
        no: i.no, mid: x.mid || '', kimga, kimBerdi: u.fish, muddat: p[2] + '.' + p[1] + '.' + p[0] + ' 18:00', muhim: 'Shoshilinch' }, R);
    } catch (e) { if (e.yozilmadi) { yoq = true; return null; } throw e; }
  });
  if (yoq) return eskiTizim('yuristTopBer', u, args.slice(1));
  const xt = XD.find(z => z.fish === kimga);   // topTg_
  if (xt && xt.tg) koprik.chaqir('koprikTgChat', u.kod, [xt.tg, TP.topTgMatn([row])]).catch(e => console.error('yurist topshiriq tg:', e.message));
  await YS.tarixYoz(TAR_V, i, 'Yurist undiruvchiga topshiriq berdi', u.fish, row.sarlavha + ' → ' + kimga + ' (muddat ' + row.muddat + ')', '');
  await kut(tetik.varaqlarYangila([TOP_V, TAR_V]).catch(e => console.error('ko\'zgu (yurist topshiriq):', e.message)), 15000);
  return { ok: true, id: row.id, kimga };
}

module.exports = { yuristTogridan, yuristTopBer };
module.exports._ichki = { yuTalabBor, yuIshlarYangi };
