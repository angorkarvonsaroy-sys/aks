// AKS TIZIM — ✉ xat yetkazildi (isbot) serverda (Xat.gs v26.0 xatYuborildi / xatYuborildi_ / xatTopYuborildi / xatTopPdf bilan bir xil tekshiruvlar, xato matnlari, javob va kataklar):
//   xatYuborildi    — xodim imzolangan nusxa / pochta kvitansiyasini yuklaydi: 06d (server hujjatYukla), 06e N, P, Q:S, W (pochta №, matn), X:Y (isbot tekshiruvi),
//                     06_Undiruv_jurnali ga «Ёзма огоҳлантириш» yozuvi (undXatYozuv_), talabnoma bo'lsa — talab topshirig'i «Tekshiruvda» (topTalabTekshir_)
//   xatTopYuborildi — direktor talabnomasi topshirig'i bo'yicha (xat huquqisiz ham): hujjatYukla_ (shartnoma ro'yxatisiz) + shu yo'l
//   xatTopPdf       — talabnoma PDF (Drive, robot «Читатель»)
// Telegram (fayl + ✅/✖) — eski tizimning o'zi: Koprik v1.7 koprikXatTasdiqTg / koprikTopTasdiqTg, fayl Drive'ga ko'chgach.
// Yoqilishi: Redis yozuv_yondi:xat_isbot («aks-yozuv-sinov xat») va Koprik ≥ 1.7. Aks holda — eski tizim.
'use strict';
const S = require('./sessiya');
const V = require('../lib/varaq');
const P = require('../lib/portfel');
const U = require('../lib/undiruv_yordam');
const X = require('../lib/xat_yordam');
const TS = require('../lib/tasdiq');
const G = require('../lib/google');
const env = require('../lib/env');
const koprik = require('./koprik');
const tetik = require('../lib/kozgu_tetik');
const { redis } = require('../lib/db');
const TP = require('./topshiriq_yoz')._ichki;
const HY = require('./hujjat_yoz');
const QH = require('./qadam_hujjat')._ichki;
const { xodimTeng } = require('../lib/xodim');

const XAT_V = '06e_Xatlar', UND_V = '06_Undiruv_jurnali', TOP_V = TP.TOP_V, HUJ_V = '06d_Hujjatlar';
const XAT_BOSQICH_QM = { 1: 'Maydon farqi: bildirishnoma', 2: 'Maydon farqi: ogohlantirish', 3: 'Maydon farqi: talabnoma' };
const XAT_BOSQICH = { 1: 'Eslatma (1-xat)', 2: 'Ogohlantirish (2-xat)', 3: 'Sudgacha talabnoma' };
const s = v => String(v == null ? '' : v);
const kut = (p, ms) => Promise.race([p, new Promise(r => setTimeout(r, ms))]);
const yangila = nomlar => kut(tetik.varaqlarYangila(nomlar).catch(e => console.error('ko\'zgu (xat isbot):', e.message)), 15000);
function hozir() { const d = new Date(Date.now() + 5 * 3600 * 1000), p = n => String(n).padStart(2, '0');
  return { iso: d.toISOString().slice(0, 19).replace('T', ' '), isoHm: d.toISOString().slice(0, 16).replace('T', ' ') }; }

async function serverda(kod) {
  try { if ((await redis.get('yozuv_yondi:xat_isbot')) !== '1') return false; } catch (e) { return false; }
  return QH.koprik17(kod);
}
async function eskiTizim(fn, u, args) { const r = await koprik.chaqir(fn, u.kod, args); await tetik.yangilaKut(20000); return r; }
function yozilmadi(e) { if (e instanceof G.RuxsatYoq) e.yozilmadi = true; return e; }

// xatJurnal_ — Google'dan YANGI (getDisplayValues, A ustunining oxirgi to'ldirilgan qatorigacha)
async function xatlarYangi(varaq) {
  const R = await G.oraliqOqi(env.aksBazaId, varaq || XAT_V, 'A2:Y', env.googleKey);
  let m = -1; R.forEach((r, i) => { if (s(r[0]) !== '') m = i; });
  return R.slice(0, m + 1).map((r0, i) => { const r = []; for (let k = 0; k < 25; k++) r.push(s(r0[k]));
    return { qator: i + 2, raqam: r[0], sana: r[1], no: r[2], shablon: r[6], bosqich: Number(r[7]) || 0, muddati: r[9], muddat: r[12], holati: r[13], pdf: r[14], skan: r[15], usul: r[16],
      yetSana: r[17], isbot: r[18], kim: r[19], vaqt: r[20], izoh: r[21], pochta: r[22], tek: r[23] || '', tgx: r[24] || '' }; }).filter(h => h.raqam);
}
async function topTopshiriqlar(fish) {   // hujjatTopShartnoma_ (Google'dan yangi)
  const o = {}; (await TP.topRowsYangi(TOP_V)).L.forEach(t => { const no = s(t.no).trim();
    if (no && s(t.manba).trim() === 'Direktor' && s(t.kimga).trim() === fish && s(t.holati).trim() === 'Jarayonda') o[no] = true; });
  return o;
}

// ------------------------------------------------------------------ yozuv yadrolari (sinov ham shularni ishlatadi — nusxa varaqda)
// 06e: N «Yuborildi», P skan nomi, Q:S [usul, sana, isbot], W pochta № (matn «@»), X:Y isbot tekshiruvi
async function xatKataklar(varaq, h, q) {
  try {
    const data = [{ varaq, katak: 'N' + h.qator, qiymat: [['Yuborildi']] }, { varaq, katak: 'P' + h.qator, qiymat: [[q.nom]] },
      { varaq, katak: 'Q' + h.qator + ':S' + h.qator, qiymat: [[q.usul === 'pochta' ? 'Pochta' : 'Qo\'lma-qo\'l', q.sana.split('-').reverse().join('.'), q.nom]] }];
    await G.yoz(env.aksBazaId, data, env.googleKey);
    const g = await G.gid(env.aksBazaId, varaq, env.googleKey);
    const req = [];
    if (q.usul === 'pochta') req.push({ updateCells: { range: { sheetId: g, startRowIndex: h.qator - 1, endRowIndex: h.qator, startColumnIndex: 22, endColumnIndex: 23 },
      rows: [{ values: [Object.assign(q.pochta === '' ? {} : { userEnteredValue: { stringValue: q.pochta } }, { userEnteredFormat: { numberFormat: { type: 'TEXT', pattern: '@' } } })] }], fields: 'userEnteredValue,userEnteredFormat.numberFormat' } });
    if (q.tek) {   // xatTekUstun_: sarlavha bo'lmasa — qalin
      const h1 = await G.qatorOqi(env.aksBazaId, varaq, 1, 'X', env.googleKey);
      if (!s(h1[23])) req.push({ updateCells: { range: { sheetId: g, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 23, endColumnIndex: 25 },
        rows: [{ values: ['Isbot_tekshiruv', 'TG_xabar'].map(t => ({ userEnteredValue: { stringValue: t }, userEnteredFormat: { textFormat: { bold: true } } })) }], fields: 'userEnteredValue,userEnteredFormat.textFormat.bold' } });
    }
    if (req.length) await G.soralar(env.aksBazaId, req, env.googleKey);
    if (q.tek) await G.yoz(env.aksBazaId, [{ varaq, katak: 'X' + h.qator + ':Y' + h.qator, qiymat: [['Kutilmoqda|' + q.vaqt + '|' + q.fish, '']] }], env.googleKey);
  } catch (e) { throw yozilmadi(e); }
}
// undXatYozuv_: 06_Undiruv_jurnali oxiriga «Ёзма огоҳлантириш» (B — sana, K — sana-vaqt). Xato e'tiborsiz (eski kabi).
async function undXatYoz(varaq, h, usul, sana, fish, x) {
  const ids = await G.ustunOqi(env.aksBazaId, varaq, 'A', env.googleKey);
  let max = 0; ids.slice(1).forEach(v => { const n = Number(v); if (n > max) max = n; });
  const row = ids.length + 1, vaqt = hozir().iso;
  const bosq = (/^QM_/.test(s(h.shablon))
    ? { 1: 'Майдон фарқи бўйича билдиришнома', 2: 'Майдон фарқи бўйича огоҳлантириш хати', 3: 'Майдон фарқи бўйича судгача талабнома' }
    : { 1: 'Эслатма хати (1-огоҳлантириш)', 2: 'Огоҳлантириш хати (2-огоҳлантириш)', 3: 'Судгача талабнома' })[h.bosqich] || 'Огоҳлантириш хати';
  const r = await G.qatorQoshR(env.aksBazaId, varaq, row, [max + 1, sana.split('-').reverse().join('.'), x.no, x.undiruvchi || fish, 'Ёзма огоҳлантириш',
    bosq + ' №' + h.raqam + ' · ' + usul + ' орқали етказилди', '', '', h.raqam, fish, vaqt, '', x.fish, x.dokon, x.jami, '', x.mid, 'Юборилди'], env.googleKey);
  await G.sanaYoz(env.aksBazaId, [{ varaq, qator: r, ustun: 2, iso: sana }, { varaq, qator: r, ustun: 11, iso: vaqt, naqsh: 'dd.MM.yyyy HH:mm:ss' }], env.googleKey);
  return r;
}

// ------------------------------------------------------------------ xatYuborildi_ (umumiy qism)
async function yuborildi(kodSes, u, h, usul, sana, b64, sahifa, pochtaNo0, yukla) {
  const raqam = h.raqam;
  if (h.holati !== 'Tayyorlandi') throw new S.Xato('Bu xat holati: ' + h.holati + '. Isbot faqat «Tayyorlandi» holatidagi xatga yuklanadi.');
  if (usul !== 'qol' && usul !== 'pochta') throw new S.Xato('Yetkazish usulini tanlang.');
  const pochtaNo = s(pochtaNo0 || '').replace(/\s+/g, '').toUpperCase();
  if (usul === 'pochta' && pochtaNo.length < 5) throw new S.Xato('Pochta jo\'natma raqamini yozing (masalan RB191625837UZ) — sudda xat юборилганлигининг исботи шу рақам.');
  const xs = h.sana.split('.').reverse().join('-');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(sana || '')) || sana < xs) throw new S.Xato('Yetkazilgan sana xat sanasidan oldin bo\'lolmaydi.');
  const bosq = (X.xatSeriya(h.shablon) === 'QM' ? XAT_BOSQICH_QM : XAT_BOSQICH)[h.bosqich];
  const r = await yukla({ no: h.no, turi: usul === 'pochta' ? 'POCHTA' : 'XAT_OLDIM', sana, b64, sahifa, xatRaqam: raqam,
    izoh: raqam + ' · ' + bosq + ' · ' + (usul === 'pochta' ? 'почта ' + pochtaNo + ' (имзоланган нусха + квитанция)' : 'қўлма-қўл (мижоз имзоси билан)') });
  const tek = !/top№\d+/.test(s(h.izoh));   // v26.0: direktor talabnoma topshirig'i xati — direktor tekshiradi
  await xatKataklar(XAT_V, h, { nom: r.nom, usul, sana, pochta: pochtaNo, tek, vaqt: hozir().isoHm, fish: u.fish });
  try { const x = (await U.undShartnomalar()).find(z => z.no === h.no); if (x) await undXatYoz(UND_V, h, usul === 'pochta' ? 'почта' : 'қўлма-қўл', sana, u.fish, x); }
  catch (e) { console.error('undXatYozuv_ (server):', e.message); }
  const tg = [];
  let top = '';
  if (Number(h.bosqich) === 3) {   // topTalabTekshir_
    try {
      const T = (await TP.topRowsYangi(TOP_V)).L.filter(t => /^talab\|/.test(t.kalit) && t.kalit.split('|')[1] === s(h.no) && t.holati === 'Jarayonda');
      if (T.length) {
        const XJ = await xatlarYangi(XAT_V);
        for (const t of T) {
          const hl = TS.topTalabHolat(t, XJ); if (!hl.tayyor) continue;
          const dalil = [hl.as, hl.qm].filter(Boolean).map(z => z.raqam + ' — ' + (z.usul || '') + (z.pochta ? ' № ' + z.pochta : '') + (z.yet ? ', ' + z.yet : '')).join('; ');
          await TP.topYop(TOP_V, t, 'Tekshiruvda', u.fish, dalil);
          top = 'Talabnoma yetkazildi — direktor tekshiradi.';
          tg.push(['koprikTopTasdiqTg', t.id]);
        }
      }
    } catch (e) { console.error('topTalabTekshir_ (server):', e.message); top = top || ''; }
  }
  if (tek) tg.push(['koprikXatTasdiqTg', raqam]);
  if (tg.length) HY._ichki.driveKeyin(s(h.no).replace(/\//g, '-') + '/' + r.nom, async () => { for (const [fn, a] of tg) { try { await koprik.chaqir(fn, u.kod, [a]); } catch (e) { console.error(fn + ' (xat isbot):', e.message); } } });
  await yangila([XAT_V, UND_V].concat(top ? [TOP_V] : []));
  return { ok: true, raqam, top, tek };
}

// ------------------------------------------------------------------ amallar
async function xatYuborildi(args) {
  const [kodSes, raqam, usul, sana, b64, sahifa, pochtaNo] = args;
  const u = await S.ruxsat(kodSes, 'xat');
  if (!(await serverda(u.kod))) return eskiTizim('xatYuborildi', u, args.slice(1));
  const h = (await xatlarYangi(XAT_V)).find(z => z.raqam === raqam);
  if (!h) throw new S.Xato('Xat topilmadi: ' + raqam);
  const ch = (!u.admin && u.huquq.indexOf('undiruv') >= 0) ? u.fish : '';   // xatEgasi_(u, x, ss) — topshiriq bo'yicha ham
  if (ch) { const x = (await P.xatShartnomalar(V.bugun())).find(z => z.no === h.no);
    if (!x || x.undiruvchi !== ch) { if (!(x && (await topTopshiriqlar(u.fish))[x.no])) throw new S.Xato('Bu shartnoma sizning portfelingizda emas.'); } }
  try { return await yuborildi(kodSes, u, h, usul, sana, b64, sahifa, pochtaNo, d => HY.hujjatYukla([kodSes, d])); }
  catch (e) { if (e.yozilmadi) throw new S.Xato('Isbot yuklandi, lekin xat holati yozilmadi — direktorga ayting (' + e.message + ').'); throw e; }
}
async function topOl(u, topId) {   // xatTopOl_
  const t = (await TP.topRowsYangi(TOP_V)).L.find(z => s(z.id) === s(topId));
  if (!t || !/^talab\|/.test(t.kalit)) throw new S.Xato('Talabnoma topshirig\'i topilmadi.');
  if (!u.admin && !xodimTeng(t.kimga, u.fish)) throw new S.Xato('Bu topshiriq sizga berilmagan.');
  return t;
}
async function topXat(t, raqam) {   // xatTopXat_
  const h = (await xatlarYangi(XAT_V)).find(z => z.raqam === raqam);
  if (!h || h.no !== t.kalit.split('|')[1] || !new RegExp('top№' + t.id + '(\\D|$)').test(s(h.izoh))) throw new S.Xato('Bu xat shu topshiriqqa tegishli emas: ' + raqam);
  return h;
}
async function xatTopYuborildi(args) {
  const [kodSes, topId, raqam, usul, sana, b64, sahifa, pochtaNo] = args;
  const u = await S.ruxsat(kodSes);
  if (!(await serverda(u.kod))) return eskiTizim('xatTopYuborildi', u, args.slice(1));
  const t = await topOl(u, topId);
  if (t.holati !== 'Jarayonda') throw new S.Xato('Topshiriq «' + t.holati + '» holatida' + (t.holati === 'Tekshiruvda' ? ' — direktor tekshirmoqda.' : '.'));
  const h = await topXat(t, raqam);
  const x = (await P.xatShartnomalar(V.bugun())).find(z => z.no === h.no); if (!x) throw new S.Xato('Shartnoma topilmadi.');
  try { return await yuborildi(kodSes, u, h, usul, sana, b64, sahifa, pochtaNo, d => HY._ichki.yuklaYadro(u, d, { no: x.no, tur: 'sotuv', fish: x.fish, dokon: x.dokon })); }
  catch (e) { if (e.yozilmadi) throw new S.Xato('Isbot yuklandi, lekin xat holati yozilmadi — direktorga ayting (' + e.message + ').'); throw e; }
}
async function xatTopPdf(args) {
  const [kodSes, topId, raqam] = args;
  const u = await S.ruxsat(kodSes);
  const t = await topOl(u, topId);
  const h = await topXat(t, raqam); if (!h.pdf) throw new S.Xato('PDF topilmadi.');
  try { const f = await G.driveFayl(h.pdf, env.googleKey); return { nom: f.nom, b64: f.bytes.toString('base64') }; }
  catch (e) { if (!(e instanceof G.RuxsatYoq)) console.error('xatTopPdf (Drive):', e.message); return koprik.chaqir('xatTopPdf', u.kod, [topId, raqam]); }
}

module.exports = { xatYuborildi, xatTopYuborildi, xatTopPdf };
module.exports._ichki = { xatlarYangi, xatKataklar, undXatYoz, XAT_V, UND_V };
