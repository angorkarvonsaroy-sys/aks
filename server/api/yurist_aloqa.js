// AKS TIZIM — ⚖ yurist ALOQA XATI (Савдо-саноат палатасига) serverda — Yurhujjat.gs v25.4 yhAloqa / yhAloqaYuborildi / yhAloqaBekor bilan
// bir xil tekshiruvlar, xato matnlari, YU-YYYY/NNNN raqamlash, 06g_Yuridik_xatlar qatori va 06f_Yurist_tarix yozuvlari.
// Xat — lib/yurist_hujjat.js: PDF rasmiy blankada (lib/xat_pdf.js, bir varaq qoidasi — eski xat bilan qatorma-qator bir xil),
// Word — lib/bekor_word.js bloklarDocx (eski xatning Google eksporti bilan bayt-ma-bayt bir xil).
// Fayllar avval SERVERDA (/opt/aks/hujjat/yurist/<yil>/…), 06g I / J = «SRV:<yo'l>» — xodim darhol oladi. Fonda eski tizim (Koprik v1.11
// koprikXatSaqla) ularni direktorning Drive'iga «AKS TIZIM / 06 XATLAR / <yil>» ga qo'yadi va I / J ga Drive ID yoziladi
// (eski tizimda Word o'rnida Google Doc edi — endi .docx fayl; «Word» tugmasi serverdagi nusxani beradi).
// Yoqilishi: Redis yozuv_yondi:yurist_aloqa («aks-yozuv-sinov aloqa») va Koprik ≥ 1.11. Aks holda — eski tizim.
'use strict';
const fs = require('fs');
const path = require('path');
const S = require('./sessiya');
const J = require('../lib/jurnallar');
const G = require('../lib/google');
const env = require('../lib/env');
const koprik = require('./koprik');
const tetik = require('../lib/kozgu_tetik');
const { redis } = require('../lib/db');
const { verOk } = require('../lib/versiya');
const YM = require('../lib/yurist_malumot');
const YH = require('../lib/yurist_hujjat');
const BW = require('../lib/bekor_word');
const QY = require('./qadam_yoz')._ichki;
const XC = require('./xat_chiqar')._ichki;
const YS = require('./yurist_sorov')._ichki;
const HY = require('./hujjat_yoz');

const YUX_V = '06g_Yuridik_xatlar', TAR_V = YS.TAR_V;
const ILDIZ = env.hujjatPapka || '/opt/aks/hujjat';
const s = v => String(v == null ? '' : v);
const kut = (p, ms) => Promise.race([p, new Promise(r => setTimeout(r, ms))]);
const yangila = varaqlar => kut(tetik.varaqlarYangila(varaqlar).catch(e => console.error('ko\'zgu (aloqa xati):', e.message)), 15000);
function hozir() { const t = new Date(Date.now() + 5 * 3600 * 1000), p = n => String(n).padStart(2, '0');
  const d = p(t.getUTCDate()) + '.' + p(t.getUTCMonth() + 1) + '.' + t.getUTCFullYear(), hm = d + ' ' + p(t.getUTCHours()) + ':' + p(t.getUTCMinutes());
  return { dmy: d, dmyHm: hm, dmyHms: hm + ':' + p(t.getUTCSeconds()) }; }

// ------------------------------------------------------------------ yoqilganmi
let kv = { ver: '', t: 0 };
async function koprikVer(kod) {   // 30 daqiqa kesh (1.11 dan past / xato bo'lsa 2 daqiqa)
  const ok = () => !!kv.ver && verOk(kv.ver, '1.11');
  if (kv.t && Date.now() - kv.t < (ok() ? 30 : 2) * 60000) return kv.ver;
  try { kv = { ver: koprik.bor() ? String(await koprik.chaqir('koprikVersiya', kod, [])) : '', t: Date.now() }; } catch (e) { kv = { ver: '', t: Date.now() }; }
  return kv.ver;
}
async function koprik111(kod) { const v = await koprikVer(kod); return !!v && verOk(v, '1.11'); }   // koprikXatSaqla .docx ni qabul qiladi
async function serverda(kod) {
  try { if ((await redis.get('yozuv_yondi:yurist_aloqa')) !== '1') return false; } catch (e) { return false; }
  return koprik111(kod);
}
async function eskiTizim(fn, u, args) { const r = await koprik.chaqir(fn, u.kod, args); await tetik.yangilaKut(20000); return r; }

// ------------------------------------------------------------------ 06g — Google'dan YANGI (yuxJurnal_ — getDisplayValues)
async function yuxYangi(varaq) {
  return (await HY._ichki.yangiQatorlar(varaq || YUX_V, 'Q')).map(({ qator, r }) => { const z = k => s(r[k]);
    return { qator, raqam: z(0), sana: z(1), ishId: z(2), no: z(3), fish: z(4), turi: z(5), qabul: z(6), holati: z(7), pdf: z(8), doc: z(9),
      usul: z(10), yetSana: z(11), isbot: z(12), pochta: z(13), kim: z(14), vaqt: z(15), izoh: z(16) }; }).filter(h => h.raqam);
}
function keyingiRaqam(Jx, yil) {   // YU-YYYY/NNNN — har yil 0001 dan, bekor qilingan raqam ham hisobda
  const tartib = Jx.filter(h => h.raqam.indexOf('YU-' + yil + '/') === 0).reduce((m, h) => Math.max(m, Number(h.raqam.split('/')[1]) || 0), 0) + 1;
  return 'YU-' + yil + '/' + ('000' + tartib).slice(-4);
}
function saqla(rel, buf) {
  const yol = path.join(ILDIZ, rel);
  fs.mkdirSync(path.dirname(yol), { recursive: true });
  fs.writeFileSync(yol, buf);
  return 'SRV:' + rel;
}
// 06g yangi qator: A:D — matn formati (@) bilan (setNumberFormat('@') + setValues: C — ish ID soni), E:Q — setValues kabi (USER_ENTERED)
async function qatorYoz(varaq, q) {
  const A = await G.ustunOqi(env.aksBazaId, varaq, 'A', env.googleKey);   // ustunA_oxiri_
  const row = A.length + 1;
  const g = await G.gid(env.aksBazaId, varaq, env.googleKey);
  const kat = v => ({ userEnteredValue: typeof v === 'number' ? { numberValue: v } : { stringValue: s(v) }, userEnteredFormat: { numberFormat: { type: 'TEXT', pattern: '@' } } });
  await G.soralar(env.aksBazaId, [{ updateCells: { range: { sheetId: g, startRowIndex: row - 1, endRowIndex: row, startColumnIndex: 0, endColumnIndex: 4 },
    rows: [{ values: q.slice(0, 4).map(kat) }], fields: 'userEnteredValue,userEnteredFormat.numberFormat' } }], env.googleKey);
  await G.yoz(env.aksBazaId, [{ varaq, katak: 'E' + row + ':Q' + row, qiymat: [q.slice(4)] }], env.googleKey);
  return row;
}

// ------------------------------------------------------------------ Drive'ga ko'chirish (fon) — Koprik v1.11 koprikXatSaqla
// k = { raqam, yil, pRel, dRel }. Ko'chgach 06g I / J ga Drive ID (agar hali o'sha SRV turgan bo'lsa — aks holda yuklangan nusxa savatga).
const yolda = new Set();
async function driveGa(kod, k, urinish = 0) {
  if (!koprik.bor() || yolda.has(k.raqam)) return null;
  yolda.add(k.raqam);
  try {
    if (!(await koprik111(kod))) return null;
    const yukla = async rel => { const r = await koprik.chaqir('koprikXatSaqla', kod, [{ yil: k.yil, nom: path.basename(rel), b64: fs.readFileSync(path.join(ILDIZ, rel)).toString('base64') }]);
      if (!r || !r.id) throw new Error('Drive ID qaytmadi'); try { await redis.set('xat_srv:' + r.id, rel, 'EX', 400 * 86400); } catch (e) { } return r.id; };
    const pId = k.pRel ? await yukla(k.pRel) : '', dId = k.dRel ? await yukla(k.dRel) : '';
    const yozildi = await QY.qulf('yux', async () => {
      const h = (await yuxYangi()).find(z => z.raqam === k.raqam);
      if (!h) return false;
      const I = k.pRel && h.pdf === 'SRV:' + k.pRel ? pId : h.pdf, Jd = k.dRel && h.doc === 'SRV:' + k.dRel ? dId : h.doc;
      if (I === h.pdf && Jd === h.doc) return false;
      await G.yoz(env.aksBazaId, [{ varaq: YUX_V, katak: 'I' + h.qator + ':J' + h.qator, qiymat: [[I, Jd]] }], env.googleKey);
      return true;
    });
    if (yozildi) { tetik.varaqlarYangila([YUX_V]).catch(() => {}); console.log(new Date().toISOString(), 'aloqa xati Drive ga ko\'chdi:', k.raqam, '→', pId, dId); return { pId, dId }; }
    for (const id of [pId, dId].filter(Boolean)) koprik.chaqir('koprikXatSaqla', kod, [{ eski: id }]).catch(e => console.error('aloqa (nusxa savatga):', e.message));
    return null;
  } catch (e) {
    console.error(new Date().toISOString(), 'aloqa xati Drive ko\'chirish (' + (urinish + 1) + '):', k.raqam, e.message);
    if (urinish < 3) setTimeout(() => driveGa(kod, k, urinish + 1).catch(() => {}), 10 * 60000).unref();
    return null;
  } finally { yolda.delete(k.raqam); }
}
// Har 15 daqiqada: 06g da hali «SRV:» turgan xatlar (Koprik yangilanmagan / internet uzilgan / server qayta ishga tushgan bo'lsa)
let aylanmoqda = false;
async function qolganlarniKochir() {
  if (aylanmoqda || !koprik.bor()) return; aylanmoqda = true;
  try {
    const L = (await J.yuxJurnal()).filter(h => /^SRV:/.test(h.pdf) || /^SRV:/.test(h.doc));
    if (!L.length) return;
    const { q } = require('../lib/db');
    const a = (await q(`SELECT kirish_kodi FROM v_xodimlar WHERE holat='Ishlayapti' AND 'admin' = ANY(huquqlar) ORDER BY qator_no LIMIT 1`)).rows[0];
    if (!a || !(await koprik111(a.kirish_kodi))) return;
    for (const h of L.slice(0, 3)) {
      const rel = v => /^SRV:/.test(v) && fs.existsSync(path.join(ILDIZ, v.slice(4))) ? v.slice(4) : '';
      const k = { raqam: h.raqam, yil: (rel(h.pdf) || rel(h.doc)).split('/')[1] || h.raqam.slice(3, 7), pRel: rel(h.pdf), dRel: rel(h.doc) };
      if (k.pRel || k.dRel) await driveGa(a.kirish_kodi, k, 3);
    }
  } catch (e) { console.error('qolgan aloqa xatlari:', e.message); } finally { aylanmoqda = false; }
}
function boshla() { const t = setInterval(() => qolganlarniKochir().catch(() => {}), 15 * 60000); t.unref(); setTimeout(() => qolganlarniKochir().catch(() => {}), 150000).unref(); }

// ------------------------------------------------------------------ yhAloqa — yangi aloqa xati: raqam, PDF + Word, 06g, 06f
// yasa(M, raqam, ij) → { pdf, docx, bet, nom } (sinov uchun alohida)
async function yasa(M, raqam, ij) {
  const f = await YH.aloqaYasa(M, raqam, ij);
  return { pdf: f.pdf, docx: BW.bloklarDocx(f.bloklar, raqam, M.bugun, ij, f.k), bet: f.bet, nom: f.nom, k: f.k };
}
async function yhAloqa(args) {
  const [kodSes, id] = args;
  const u = await S.ruxsat(kodSes, 'yurist');
  if (!(await serverda(u.kod))) return eskiTizim('yhAloqa', u, args.slice(1));
  const r = await QY.qulf('yux', async () => {
    const Jx = await yuxYangi();
    const bor = Jx.find(h => s(h.ishId) === s(id) && h.turi === 'ALOQA_SSP' && h.holati !== 'Bekor');
    if (bor) throw new S.Xato('Bu ish bo\'yicha aloqa xati allaqachon bor: ' + bor.raqam + ' (' + bor.holati + '). Yangisini chiqarish uchun avval uni bekor qiling.');
    let M;
    try { M = await YM.yhYig(id); } catch (e) { if (/topilmadi/.test(e.message)) throw new S.Xato(e.message); throw e; }
    const yil = M.bugun.slice(0, 4), raqam = keyingiRaqam(Jx, yil);
    const f = await yasa(M, raqam, await XC.ijrochi(u.fish));
    const papka = 'yurist/' + yil + '/' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5) + '/', fx = n => n.replace(/[\/\\]/g, '-');
    const pRel = papka + fx(f.nom) + '.pdf', dRel = papka + fx(f.nom) + '.docx';
    saqla(pRel, f.pdf); saqla(dRel, f.docx);
    await qatorYoz(YUX_V, [raqam, YM.yhDmy(M.bugun), M.ish.id, M.no, M.fishK, 'ALOQA_SSP', YH.YH_PALATA.join(', '), 'Tayyorlandi',
      'SRV:' + pRel, 'SRV:' + dRel, '', '', '', '', u.fish, hozir().dmyHms, f.bet > 1 ? f.bet + ' bet' : '']);
    await YS.tarixYoz(TAR_V, M.ish, 'Алоқа хати тайёрланди: ' + raqam, u.fish, YH.YUX_TUR.ALOQA_SSP + (f.bet > 1 ? ' · ' + f.bet + ' бет' : ''), f.nom + '.pdf');
    return { k: { raqam, yil, pRel, dRel }, javob: { raqam, nom: f.nom + '.pdf', mime: 'application/pdf', b64: f.pdf.toString('base64'),
      ogoh: f.bet > 1 ? ['Xat ' + f.bet + ' betga chiqdi — 2-betga 3 qatordan ko\'p matn o\'tgani uchun kichraytirilmadi.'] : [] } };
  });
  await yangila([YUX_V, TAR_V]);
  driveGa(u.kod, r.k).catch(() => {});
  return r.javob;
}

// ------------------------------------------------------------------ yhAloqaYuborildi — yetkazildi (isbot fayli bilan, OG dagi tartib)
async function yhAloqaYuborildi(args) {
  const [kodSes, raqam, usul, sana, b64, sahifa, pochtaNo0] = args;
  const u = await S.ruxsat(kodSes, 'yurist');
  if (!(await serverda(u.kod))) return eskiTizim('yhAloqaYuborildi', u, args.slice(1));
  const h0 = (await yuxYangi()).find(z => z.raqam === raqam); if (!h0) throw new S.Xato('Xat topilmadi: ' + raqam);
  if (h0.holati !== 'Tayyorlandi') throw new S.Xato('Bu xat holati: ' + h0.holati + '. Isbot faqat «Tayyorlandi» holatidagi xatga yuklanadi.');
  if (usul !== 'qol' && usul !== 'pochta') throw new S.Xato('Yetkazish usulini tanlang.');
  const pochtaNo = s(pochtaNo0 || '').replace(/\s+/g, '').toUpperCase();
  if (usul === 'pochta' && pochtaNo.length < 5) throw new S.Xato('Pochta jo\'natma raqamini yozing (masalan RB191625837UZ).');
  const xs = YM.yhIso(h0.sana);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s(sana || '')) || sana < xs) throw new S.Xato('Yetkazilgan sana xat sanasidan oldin bo\'lolmaydi.');
  const r = await HY.hujjatYukla([kodSes, { no: h0.no, turi: usul === 'pochta' ? 'POCHTA' : 'XAT_OLDIM', sana, b64, sahifa,
    izoh: raqam + ' · ' + YH.YUX_TUR[h0.turi] + ' · ' + (usul === 'pochta' ? 'почта ' + pochtaNo + ' (имзоланган нусха + квитанция)' : 'қўлма-қўл (қабул қилувчининг кирувчи штампи билан нусха)') }]);
  const dmy = sana.split('-').reverse().join('.');
  await QY.qulf('yux', async () => {
    const h = (await yuxYangi()).find(z => z.raqam === raqam) || h0;
    const g = await G.gid(env.aksBazaId, YUX_V, env.googleKey);
    await G.yoz(env.aksBazaId, [{ varaq: YUX_V, katak: 'H' + h.qator, qiymat: [['Yuborildi']] },
      { varaq: YUX_V, katak: 'K' + h.qator + ':M' + h.qator, qiymat: [[usul === 'pochta' ? 'Pochta' : 'Qo\'lma-qo\'l', dmy, r.nom]] }], env.googleKey);
    if (usul === 'pochta') await G.soralar(env.aksBazaId, [{ updateCells: { range: { sheetId: g, startRowIndex: h.qator - 1, endRowIndex: h.qator, startColumnIndex: 13, endColumnIndex: 14 },
      rows: [{ values: [{ userEnteredValue: { stringValue: pochtaNo }, userEnteredFormat: { numberFormat: { type: 'TEXT', pattern: '@' } } }] }], fields: 'userEnteredValue,userEnteredFormat.numberFormat' } }], env.googleKey);
    const ish = (await J.yuIshlar()).find(z => s(z.id) === s(h0.ishId));
    if (ish) await YS.tarixYoz(TAR_V, ish, 'Алоқа хати юборилди: ' + raqam, u.fish, (usul === 'pochta' ? 'почта ' + pochtaNo : 'қўлма-қўл') + ', ' + dmy, r.nom);
  });
  await yangila([YUX_V, TAR_V]);
  return { ok: true, raqam };
}

// ------------------------------------------------------------------ yhAloqaBekor — direktor; yoki tayyorlagan xodim o'sha kuni, isbot yuklanmagan bo'lsa
async function yhAloqaBekor(args) {
  const [kodSes, raqam, sabab0] = args;
  const u = await S.ruxsat(kodSes, 'yurist');
  if (!(await serverda(u.kod))) return eskiTizim('yhAloqaBekor', u, args.slice(1));
  const sabab = s(sabab0 || '').trim(); if (sabab.length < 5) throw new S.Xato('Sababini yozing (kamida 5 belgi).');
  await QY.qulf('yux', async () => {
    const h = (await yuxYangi()).find(z => z.raqam === raqam); if (!h) throw new S.Xato('Xat topilmadi: ' + raqam);
    if (h.holati === 'Bekor') throw new S.Xato('Xat allaqachon bekor qilingan.');
    const t = hozir();
    if (!u.admin && !(h.kim === u.fish && h.holati === 'Tayyorlandi' && h.vaqt.indexOf(t.dmy) === 0)) throw new S.Xato('Bu xatni faqat direktor bekor qila oladi.');
    await G.yoz(env.aksBazaId, [{ varaq: YUX_V, katak: 'H' + h.qator, qiymat: [['Bekor']] },
      { varaq: YUX_V, katak: 'Q' + h.qator, qiymat: [[(h.izoh ? h.izoh + ' | ' : '') + 'Bekor: ' + sabab + ' (' + u.fish + ', ' + t.dmyHm + ')']] }], env.googleKey);
    const ish = (await J.yuIshlar()).find(z => s(z.id) === s(h.ishId));
    if (ish) await YS.tarixYoz(TAR_V, ish, 'Алоқа хати бекор қилинди: ' + raqam, u.fish, sabab, '');
  });
  await yangila([YUX_V, TAR_V]);
  return { ok: true, raqam };
}

module.exports = { yhAloqa, yhAloqaYuborildi, yhAloqaBekor };
module.exports._ichki = { yuxYangi, keyingiRaqam, qatorYoz, yasa, driveGa, koprik111, boshla, YUX_V,
  koprikVerTozala: () => { kv = { ver: '', t: 0 }; } };
