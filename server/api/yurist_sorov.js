// AKS TIZIM — ⚖ «Yuristga o'tkazish» so'rovi serverda (Yurist.gs v25.9 yuristgaSorov + yuYangi_ + yuTarix_ bilan bir xil tekshiruvlar, xato matnlari va kataklar):
//   06b_Yuridik_ishlar oxiriga yangi ish («Tasdiq kutilmoqda», yo'l U4): B — matn, T..AE, C/U — sana formati, AC — sana-vaqt, Q:S — oldingi qatordan formulalar;
//   06f_Yurist_tarix ga «Undiruvchi yuristga o'tkazishni so'radi». Direktor tasdiqlashi (yuristTasdiq) — allaqachon serverda.
// Yoqilishi: Redis yozuv_yondi:yurist_sorov («aks-yozuv-sinov yurist»). Aks holda, yoki robotda yozish huquqi bo'lmasa — eski tizim.
'use strict';
const S = require('./sessiya');
const V = require('../lib/varaq');
const J = require('../lib/jurnallar');
const U = require('../lib/undiruv_yordam');
const X = require('../lib/xat_yordam');
const P = require('../lib/portfel');
const G = require('../lib/google');
const env = require('../lib/env');
const koprik = require('./koprik');
const tetik = require('../lib/kozgu_tetik');
const { redis } = require('../lib/db');
const QY = require('./qadam_yoz')._ichki;

const YU_V = '06b_Yuridik_ishlar', TAR_V = '06f_Yurist_tarix';
const s = v => String(v == null ? '' : v);
const kut = (p, ms) => Promise.race([p, new Promise(r => setTimeout(r, ms))]);
function hozir() { const d = new Date(Date.now() + 5 * 3600 * 1000), p = n => String(n).padStart(2, '0');
  return { iso: d.toISOString().slice(0, 19).replace('T', ' '), dmyHms: p(d.getUTCDate()) + '.' + p(d.getUTCMonth() + 1) + '.' + d.getUTCFullYear() + ' ' + p(d.getUTCHours()) + ':' + p(d.getUTCMinutes()) + ':' + p(d.getUTCSeconds()) }; }
async function serverda() { try { return (await redis.get('yozuv_yondi:yurist_sorov')) === '1'; } catch (e) { return false; } }
async function eskiTizim(fn, u, args) { const r = await koprik.chaqir(fn, u.kod, args); await tetik.yangilaKut(20000); return r; }

async function yuristIsmi() {   // yuYuristIsmi_: 07_Xodimlar S da «yurist», K «Ishlayapti» — birinchisi
  const r = (await V.qatorlar('07_Xodimlar')).map(z => z.x).find(z => /(^|[\s,])yurist([\s,]|$)/i.test(s(z[18])) && s(z[10]).trim() === 'Ishlayapti');
  return r ? s(r[1]).trim() : '';
}
// yuYangi_: qaytaradi { id, no, qator }. Faol (to'g'ridan-to'g'ri) — C «topshirilgan» va U «bosqich sanasi» = bugun, T = 1
async function yuYangi(varaq, x, holati, yol, fish, sabab) {
  const faol = holati === 'Faol';
  const A = await G.ustunOqi(env.aksBazaId, varaq, 'A', env.googleKey);
  let max = 0; A.slice(1).forEach(v => { const n = Number(v); if (n > max) max = n; });
  const id = max + 1, row = A.length + 1;
  const g = await G.gid(env.aksBazaId, varaq, env.googleKey);
  const fmt = (c1, c2, nf) => ({ repeatCell: { range: { sheetId: g, startRowIndex: row - 1, endRowIndex: row, startColumnIndex: c1 - 1, endColumnIndex: c2 }, cell: { userEnteredFormat: { numberFormat: nf } }, fields: 'userEnteredFormat.numberFormat' } });
  await G.soralar(env.aksBazaId, [fmt(2, 2, { type: 'TEXT', pattern: '@' })], env.googleKey);
  const yur = await yuristIsmi();
  await G.yoz(env.aksBazaId, [
    { varaq, katak: 'A' + row + ':P' + row, qiymat: [[id, x.no, '', yur, '', '', '', '', '', '', '', '', '', '', holati, '']] },
    { varaq, katak: 'T' + row + ':AE' + row, qiymat: [[faol ? 1 : 0, '', '', '', '', '', yol, x.undiruvchi || '', sabab, hozir().dmyHms, '', '']] }], env.googleKey);
  const req = [fmt(3, 3, { type: 'DATE', pattern: 'dd.MM.yyyy' }), fmt(21, 21, { type: 'DATE', pattern: 'dd.MM.yyyy' })];
  if (row > 2) req.push({ copyPaste: { source: { sheetId: g, startRowIndex: row - 2, endRowIndex: row - 1, startColumnIndex: 16, endColumnIndex: 19 },
    destination: { sheetId: g, startRowIndex: row - 1, endRowIndex: row, startColumnIndex: 16, endColumnIndex: 19 }, pasteType: 'PASTE_FORMULA' } });
  await G.soralar(env.aksBazaId, req, env.googleKey);
  await G.sanaYoz(env.aksBazaId, [{ varaq, qator: row, ustun: 29, iso: hozir().iso, naqsh: 'dd.MM.yyyy HH:mm' }].concat(faol ? [3, 21].map(ustun => ({ varaq, qator: row, ustun, iso: V.bugun() })) : []), env.googleKey);
  return { id, no: x.no, qator: row };
}
// yuIshlar_(ss).some(i => i.no === no && i.holati !== 'Rad etildi') — Google'dan yangi; holati bo'sh (chala) qator hisobga olinmaydi
async function ishBor(no) {
  const YI = await G.oraliqOqi(env.aksBazaId, YU_V, 'A2:O', env.googleKey);
  let l = -1; YI.forEach((z, k) => { if (s(z[0]) !== '') l = k; });
  return YI.slice(0, l + 1).some(z => s(z[0]) !== '' && s(z[1]) !== '' && s(z[14]) !== '' && s(z[1]) === no && s(z[14]) !== 'Rad etildi');
}
async function tarixYoz(varaq, i, voqea, kim, izoh, hujjat) {   // yuTarix_ (appendRow)
  await G.qatorQosh(env.aksBazaId, varaq, [hozir().dmyHms, i.id, i.no, voqea, kim, izoh || '', hujjat || ''], env.googleKey);
}

async function yuristgaSorov(args) {
  const [kodSes, no, sabab0] = args;
  const u = await S.ruxsat(kodSes, 'undiruv');
  if (!(await serverda())) return eskiTizim('yuristgaSorov', u, args.slice(1));
  const bugun = V.bugun();
  const sabab = s(sabab0 || '').replace(/\s+/g, ' ').trim();
  if (sabab.length < 15) throw new S.Xato('Nega undirib bo\'lmaganini yozing (kamida 15 belgi).');
  let yoq = false;
  const r = await QY.qulf('yurist', async () => {
    const x = (await U.undShartnomalar()).find(z => z.no === s(no));
    if (!x || (!u.admin && x.undiruvchi !== u.fish)) throw new S.Xato('Bu shartnoma sizning portfelingizda emas.');
    if (await ishBor(x.no)) throw new S.Xato('Bu mijoz allaqachon yuristga o\'tkazilgan yoki so\'rov yuborilgan.');
    const [XJ, UJ, HJ, Z] = await Promise.all([J.xatJurnal(), J.undJurnal(), J.hujjatJurnal(), X.xatZanjir(u.kod)]);
    const m = P.yuMezon(x, XJ, UJ, HJ.filter(h => h.holati === 'Faol'), bugun, Z);
    if (!m.ok) throw new S.Xato('Mezonlar bajarilmagan: ' + m.yetishmaydi.join('; ') + '.');
    let i;
    try { i = await yuYangi(YU_V, x, 'Tasdiq kutilmoqda', 'U4', u.fish, sabab); }
    catch (e) { if (e instanceof G.RuxsatYoq) { yoq = true; return null; } throw e; }
    await tarixYoz(TAR_V, i, 'Undiruvchi yuristga o\'tkazishni so\'radi', u.fish, sabab, '');
    return { ok: true };
  });
  if (yoq) return eskiTizim('yuristgaSorov', u, args.slice(1));
  await kut(tetik.varaqlarYangila([YU_V, TAR_V]).catch(e => console.error('ko\'zgu (yurist so\'rov):', e.message)), 15000);
  return r;
}

module.exports = { yuristgaSorov };
module.exports._ichki = { yuYangi, tarixYoz, ishBor, YU_V, TAR_V };
