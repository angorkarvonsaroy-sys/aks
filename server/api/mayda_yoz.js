// AKS TIZIM — kichik YOZUV amallari serverda (eski kod bilan bir xil tekshiruvlar, xato matnlari va kataklar):
//   xatBekor    (Xat.gs)  — ogohlantirish xatini bekor qilish: 06e N «Bekor», V izoh; xodim bekor qilsa direktorga Telegram (koprikTgYubor)
//   boshRejaYoz (Bosh.gs) — bosh sahifadagi oylik reja: 08_Lugatlar Z3 «Oylik reja» (qalin), Z4 summa (#,##0)
// Yozish faqat «aks-yozuv-sinov mayda» nusxa varaqlarda tekshirgach yoqiladi (Redis: yozuv_yondi:mayda) va Koprik v1.5 bo'lsa.
// Aks holda, yoki robotda yozish huquqi bo'lmasa — amal avvalgidek eski tizim orqali bajariladi.
'use strict';
const S = require('./sessiya');
const V = require('../lib/varaq');
const G = require('../lib/google');
const env = require('../lib/env');
const koprik = require('./koprik');
const tetik = require('../lib/kozgu_tetik');
const X = require('../lib/xat_yordam');
const P = require('../lib/portfel');
const { redis } = require('../lib/db');
const { koprik15 } = require('./taminot_yoz')._ichki;

const XAT_V = '06e_Xatlar', LUG_V = '08_Lugatlar', BOSH_REJA_USTUN = 26;
const s = v => String(v == null ? '' : v);
function hozirDmyHm() { const d = new Date(Date.now() + 5 * 3600 * 1000), p = n => String(n).padStart(2, '0');
  return p(d.getUTCDate()) + '.' + p(d.getUTCMonth() + 1) + '.' + d.getUTCFullYear() + ' ' + p(d.getUTCHours()) + ':' + p(d.getUTCMinutes()); }
const kut = (p, ms) => Promise.race([p, new Promise(r => setTimeout(r, ms))]);
async function serverda(kod) {
  try { if ((await redis.get('yozuv_yondi:mayda')) !== '1') return false; } catch (e) { return false; }
  return koprik15(kod);
}
async function eskiTizim(fn, u, args) { const r = await koprik.chaqir(fn, u.kod, args); await tetik.yangilaKut(20000); return r; }
const xatEskirgan = (h, bugunIso) => h.holati === 'Tayyorlandi' && !!h.muddat && X.xatIso(h.muddat) < bugunIso;   // xatEskirgan_

// 06e — Google'dan YANGI (getDisplayValues, xatJurnal_ ustunlari)
async function xatYangi(varaq, raqam) {
  const R = await G.oraliqOqi(env.aksBazaId, varaq, 'A2:Y', env.googleKey);
  const i = R.findIndex(r => s(r[0]) === s(raqam) && s(r[0]) !== ''); if (i < 0) return null;
  const r = R[i].map(s);
  return { qator: i + 2, raqam: r[0] || '', sana: r[1] || '', no: r[2] || '', muddat: r[12] || '', holati: r[13] || '', kim: r[19] || '', vaqt: r[20] || '', izoh: r[21] || '' };
}
// Yozuv yadrosi (sinov ham shuni ishlatadi): N «Bekor», V izoh
async function xatBekorYoz(varaq, h, sabab, fish) {
  try { await G.yoz(env.aksBazaId, [{ varaq, katak: 'N' + h.qator, qiymat: [['Bekor']] }, { varaq, katak: 'V' + h.qator, qiymat: [[(h.izoh ? h.izoh + ' | ' : '') + 'Bekor: ' + sabab + ' (' + fish + ', ' + hozirDmyHm() + ')']] }], env.googleKey); }
  catch (e) { if (e instanceof G.RuxsatYoq) e.yozilmadi = true; throw e; }
}
async function xatBekor(args) {
  const [kodSes, raqam, sabab0] = args;
  const u = await S.ruxsat(kodSes, 'xat');
  if (!(await serverda(u.kod))) return eskiTizim('xatBekor', u, args.slice(1));
  const sabab = s(sabab0).trim(); if (sabab.length < 5) throw new S.Xato('Sababini yozing (kamida 5 belgi).');
  const h = await xatYangi(XAT_V, raqam);
  if (!h) throw new S.Xato('Xat topilmadi: ' + raqam);
  const bugunIso = V.bugun(), bugun = bugunIso.split('-').reverse().join('.');
  const ch = (!u.admin && u.huquq.indexOf('undiruv') >= 0) ? u.fish : '';   // xatEgasi_ (xatCheklov_)
  if (ch) { const x = (await P.xatShartnomalar(bugunIso)).find(z => z.no === h.no); if (!x || x.undiruvchi !== ch) throw new S.Xato('Bu shartnoma sizning portfelingizda emas.'); }
  if (h.holati === 'Bekor') throw new S.Xato('Xat allaqachon bekor qilingan.');
  const eski = xatEskirgan(h, bugunIso);
  if (!u.admin && eski && sabab.length < 10) throw new S.Xato('Sababini yozing (kamida 10 belgi).');
  if (!u.admin && !eski && !(h.kim === u.fish && h.holati === 'Tayyorlandi' && h.vaqt.indexOf(bugun) === 0)) throw new S.Xato('Bu xatni faqat direktor bekor qila oladi.');
  try { await xatBekorYoz(XAT_V, h, sabab, u.fish); }
  catch (e) { if (e.yozilmadi) return eskiTizim('xatBekor', u, args.slice(1)); throw e; }
  if (!u.admin) koprik.chaqir('koprikTgYubor', u.kod, ['✕ <b>' + u.fish + '</b> xatni bekor qildi: <b>' + raqam + '</b> · ' + h.no + ' · ' + s(h.sana) + (eski ? ' (to\'lov muddati ' + h.muddat + ' da o\'tgan edi)' : '') + '\n«' + sabab.replace(/</g, '&lt;') + '»'])
    .catch(e => console.error('xatBekor tg (ko\'prik):', e.message));
  await kut(tetik.varaqlarYangila([XAT_V]).catch(e => console.error('ko\'zgu (xat):', e.message)), 15000);
  return { ok: true, raqam };
}

// ------------------------------------------------------------------ 🏠 oylik reja
async function rejaYoz(varaq, summa) {
  try {
    await G.yoz(env.aksBazaId, [{ varaq, katak: 'Z3', qiymat: [['Oylik reja']] }, { varaq, katak: 'Z4', qiymat: [[summa]] }], env.googleKey);
    const g = await G.gid(env.aksBazaId, varaq, env.googleKey);
    await G.soralar(env.aksBazaId, [
      { repeatCell: { range: { sheetId: g, startRowIndex: 2, endRowIndex: 3, startColumnIndex: BOSH_REJA_USTUN - 1, endColumnIndex: BOSH_REJA_USTUN }, cell: { userEnteredFormat: { textFormat: { bold: true } } }, fields: 'userEnteredFormat.textFormat.bold' } },
      { repeatCell: { range: { sheetId: g, startRowIndex: 3, endRowIndex: 4, startColumnIndex: BOSH_REJA_USTUN - 1, endColumnIndex: BOSH_REJA_USTUN }, cell: { userEnteredFormat: { numberFormat: { type: 'NUMBER', pattern: '#,##0' } } }, fields: 'userEnteredFormat.numberFormat' } },
    ], env.googleKey);
  } catch (e) { if (e instanceof G.RuxsatYoq) e.yozilmadi = true; throw e; }
}
async function boshRejaYoz(args) {
  const [kodSes, summa0] = args;
  const u = await S.ruxsat(kodSes, 'admin');
  if (!(await serverda(u.kod))) return eskiTizim('boshRejaYoz', u, args.slice(1));
  const summa = Math.round(Number(s(summa0).replace(/[^\d.]/g, '')) || 0);
  try { await rejaYoz(LUG_V, summa); }
  catch (e) { if (e.yozilmadi) return eskiTizim('boshRejaYoz', u, args.slice(1)); throw e; }
  await kut(tetik.varaqlarYangila([LUG_V]).catch(e => console.error('ko\'zgu (reja):', e.message)), 15000);
  return { ok: true, reja: summa };
}

module.exports = { xatBekor, boshRejaYoz };
module.exports._ichki = { xatYangi, xatBekorYoz, rejaYoz, XAT_V, LUG_V };
