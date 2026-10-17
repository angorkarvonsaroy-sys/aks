// AKS TIZIM — Tasdiqlar bloklari serverda (faqat o'qish; natija eski tizim bilan bir xil):
//   📦 Ta'minot (Taminot.gs v26.11): taminotDirektor, taminotSvodOl, taminotBoshlang
//   🤝 Kelishuv bilan bekor (KelishuvBekor.gs v1.0): kbDirektor
//   ✕ Imzolanmagan ijara (ImzosizBekor.gs v1.1): ijaraImzosizRoyxat
// Yozuvlar: taminotKiritish, taminotTasdiq — api/taminot_yoz.js; taminotTolov, kbTasdiq, ijaraImzosizJavob … hali eski tizimda (ko'prik).
'use strict';
const S = require('./sessiya');
const V = require('../lib/varaq');

// ustunA_oxiri_ — A ustunidagi oxirgi to'ldirilgan qatorgacha
function aOxiri(rows) { let m = 0; rows.forEach(({ n, x }) => { if (x[0] !== null && x[0] !== undefined && x[0] !== '') m = n; }); return rows.filter(z => z.n <= m); }
// getDisplayValues: so'ralgan har katak — matn ('' bo'lsa ham)
const kor = (r, n) => { const o = []; for (let i = 0; i < n; i++) o.push(r[i] == null ? '' : String(r[i])); return o; };

// ------------------------------------------------------------------ 📦 TA'MINOT
const TAM_OLCHOV = ['dona', 'kg', 'qop', 'metr', 'litr', 'pachka', 'komplekt', 'rulon', 'quti', 'tonna'];
const tamISOdan = dmy => { const p = String(dmy || '').split('.'); return p.length === 3 ? p[2] + '-' + p[1] + '-' + p[0] : ''; };
const raqam = v => Number(String(v).replace(/\D/g, '')) || 0;
async function tamRows() {
  return aOxiri(await V.qatorlar('09_Taminot')).map(({ n, r: r0 }) => { const r = kor(r0, 16);
    return { qator: n, id: r[0], partiya: r[1], sana: r[2], iso: tamISOdan(r[2]), tTuri: r[3], taminotchi: r[4], nom: r[5], olchov: r[6], miqdor: r[7], narx: raqam(r[8]), summa: raqam(r[9]),
      izoh: r[10], kim: r[11], vaqt: r[12], holati: r[13], tasdiq: r[14], sabab: r[15] }; }).filter(x => x.id);
}
async function tamTolovlar() {
  return aOxiri(await V.qatorlar('09b_Taminot_tolovlari')).map(({ r: r0 }) => { const r = kor(r0, 12);
    return { id: r[0], sana: r[1], tTuri: r[2], taminotchi: r[3], summa: raqam(r[4]), usul: r[5], tilxat: r[6], kim: r[9], vaqt: r[10] }; }).filter(x => x.id);
}
async function tamFirmalar() {
  return aOxiri(await V.qatorlar('09c_Taminotchilar_yuridik')).map(({ r: r0 }) => { const r = kor(r0, 10);
    return { id: r[0], nomi: r[1], direktor: r[2], stir: r[3], hr: r[4], bank: r[5], mfo: r[6], manzil: r[7], tel: r[8], holati: r[9] }; }).filter(f => f.id && f.holati !== 'Bekor');
}
async function tamJismoniy() {                         // 07_Xodimlar: «taminot» huquqi bor, ishlayotgan xodimlar (getLastRow — hamma qator)
  const t = v => String(v == null || v === '' ? '' : v);
  return (await V.qatorlar('07_Xodimlar')).map(({ x }) => x).filter(r => t(r[1]).trim() && t(r[10]).trim() === 'Ishlayapti'
      && t(r[18]).toLowerCase().split(',').map(z => z.trim()).indexOf('taminot') >= 0)
    .map(r => ({ fish: t(r[1]).trim(), toliq: t(r[2]).trim() }));
}
function tamHisob(R, TL) {                             // kalit: 'Jismoniy|Azim' → {kelt, tolan}
  const H = {};
  R.forEach(x => { if (x.holati !== 'Tasdiqlandi') return; const k = x.tTuri + '|' + x.taminotchi; (H[k] = H[k] || { kelt: 0, tolan: 0 }).kelt += x.summa; });
  TL.forEach(t => { const k = t.tTuri + '|' + t.taminotchi; (H[k] = H[k] || { kelt: 0, tolan: 0 }).tolan += t.summa; });
  return H;
}
function tamTolovHolat(R, TLr) {                       // isbotli to'lovlar tasdiqlangan mahsulotlarga — sana bo'yicha eng eskisidan (FIFO)
  const H = {}, P = {}, TL = {};
  TLr.forEach(t => { const k = t.tTuri + '|' + t.taminotchi; P[k] = (P[k] || 0) + t.summa; (TL[k] = TL[k] || []).push({ iso: tamISOdan(t.sana), sana: t.sana, summa: t.summa, id: Number(t.id) || 0 }); });
  Object.keys(TL).forEach(k => TL[k].sort((a, b) => (a.iso + ('00000' + a.id).slice(-6)) < (b.iso + ('00000' + b.id).slice(-6)) ? -1 : 1));
  const G = {};
  R.filter(x => x.holati === 'Tasdiqlandi').forEach(x => { (G[x.tTuri + '|' + x.taminotchi] = G[x.tTuri + '|' + x.taminotchi] || []).push(x); });
  Object.keys(G).forEach(k => {
    let qol = P[k] || 0;
    const T = TL[k] || []; let ti = 0, tq = T.length ? T[0].summa : 0;
    G[k].sort((a, b) => (a.iso + ('00000' + a.id).slice(-6)) < (b.iso + ('00000' + b.id).slice(-6)) ? -1 : 1).forEach(x => {
      const t = Math.min(qol, x.summa); qol -= t;
      let kerak = t, sana = '';
      while (kerak > 0 && ti < T.length) { const ol = Math.min(kerak, tq); kerak -= ol; tq -= ol; sana = T[ti].sana; if (tq <= 0) { ti++; tq = ti < T.length ? T[ti].summa : 0; } }
      H[x.id] = { tolangan: t, holat: t >= x.summa ? 'tolandi' : t > 0 ? 'qisman' : 'yoq', sana };
    });
  });
  return H;
}
function tamPozKor(x, TH) {
  const t = TH[x.id] || { tolangan: 0, holat: '', sana: '' };
  const tq = /(\d{2}\.\d{2}\.\d{4})/.exec(String(x.tasdiq || ''));
  return { id: x.id, partiya: x.partiya, sana: x.sana, taminotchi: x.taminotchi, tTuri: x.tTuri, nom: x.nom, olchov: x.olchov, miqdor: x.miqdor,
    narx: x.narx, summa: x.summa, izoh: x.izoh, kim: x.kim, holati: x.holati, sabab: x.sabab, tolov: x.holati === 'Tasdiqlandi' ? t.holat : '', tolangan: t.tolangan,
    kiritildi: String(x.vaqt || '').slice(0, 10), tasdiqSana: tq ? tq[1] : '', tolovSana: t.sana || '' };
}
function tamSvod(R, bosh, oxir) {
  const Sv = R.filter(x => x.holati === 'Tasdiqlandi' && x.iso >= bosh && x.iso <= oxir);
  const T = {}; Sv.forEach(x => { T[x.tTuri + '|' + x.taminotchi] = true; });
  return { soni: Sv.length, jami: Sv.reduce((a, x) => a + x.summa, 0), taminotchilar: Object.keys(T).map(k => k.split('|')[1]) };
}
function tamOtganHafta() {                             // o'tgan dushanba–yakshanba (ISO)
  const h = new Date(V.bugun() + 'T00:00:00Z');
  const kun = (h.getUTCDay() + 6) % 7;
  const du = new Date(h.getTime() - (kun + 7) * 86400000);
  const yak = new Date(du.getTime() + 6 * 86400000);
  const iso = d => d.toISOString().slice(0, 10);
  return { bosh: iso(du), oxir: iso(yak) };
}
function tamDavrTekshir(bosh, oxir) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(bosh)) || !/^\d{4}-\d{2}-\d{2}$/.test(String(oxir))) throw new S.Xato('Davr sanalarini tanlang.');
  if (bosh > oxir) throw new S.Xato('Davr boshi oxiridan keyin bo\'lmasin.');
  if ((new Date(oxir) - new Date(bosh)) / 86400000 > 92) throw new S.Xato('Davr 3 oydan oshmasin.');
}

async function taminotDirektor([kodSes]) {
  await S.ruxsat(kodSes, 'admin');
  const [R, TL] = await Promise.all([tamRows(), tamTolovlar()]);
  const KP = {};
  R.filter(x => x.holati === 'Kutilmoqda').forEach(x => {
    const p = KP[x.partiya] = KP[x.partiya] || { partiya: x.partiya, sana: x.sana, taminotchi: x.taminotchi, tTuri: x.tTuri, kim: x.kim, vaqt: x.vaqt, izoh: x.izoh, poz: [], jami: 0 };
    p.poz.push({ id: x.id, nom: x.nom, olchov: x.olchov, miqdor: x.miqdor, narx: x.narx, summa: x.summa, izoh: x.izoh, sana: x.sana }); p.jami += x.summa; });
  const H = tamHisob(R, TL);
  const hisob = Object.keys(H).map(k => { const p = k.split('|'); const h = H[k];
    return { tTuri: p[0], taminotchi: p[1], kelt: h.kelt, tolan: h.tolan, qoldiq: h.kelt - h.tolan }; })
    .sort((a, b) => b.qoldiq - a.qoldiq);
  const d = tamOtganHafta();
  const TH = tamTolovHolat(R, TL);
  const pozlar = R.filter(x => x.holati !== 'Kutilmoqda').sort((a, b) => (b.iso + b.partiya) < (a.iso + a.partiya) ? -1 : 1).slice(0, 300).map(x => tamPozKor(x, TH));
  return { ok: true, kutilmoqda: Object.keys(KP).map(k => KP[k]), hisob, pozlar,
    davr: { bosh: d.bosh, oxir: d.oxir }, svod: tamSvod(R, d.bosh, d.oxir), bugun: V.bugun() };
}
async function taminotSvodOl([kodSes, bosh, oxir]) {
  await S.ruxsat(kodSes, 'admin');
  tamDavrTekshir(bosh, oxir);
  return tamSvod(await tamRows(), bosh, oxir);
}
async function taminotBoshlang([kodSes]) {
  const u = await S.ruxsat(kodSes, 'taminot');
  const [R0, TL, J, F] = await Promise.all([tamRows(), tamTolovlar(), tamJismoniy(), tamFirmalar()]);
  const H = tamHisob(R0, TL);
  const oz = H['Jismoniy|' + u.fish] || { kelt: 0, tolan: 0 };
  const R = R0.filter(x => x.kim === u.fish || u.admin);
  const P = {};
  R.forEach(x => { const p = P[x.partiya] = P[x.partiya] || { partiya: x.partiya, sana: x.sana, taminotchi: x.taminotchi, tTuri: x.tTuri, soni: 0, jami: 0, holati: x.holati, sabab: x.sabab, iso: x.iso };
    p.soni++; p.jami += x.summa; });
  const mening = Object.keys(P).map(k => P[k]).sort((a, b) => b.partiya < a.partiya ? -1 : 1).slice(0, 25);
  const tol = TL.filter(t => u.admin || (t.tTuri === 'Jismoniy' && t.taminotchi === u.fish)).slice(-15).reverse();
  const TH = tamTolovHolat(R0, TL);
  const pozlar = R.slice().sort((a, b) => (b.iso + b.partiya) < (a.iso + a.partiya) ? -1 : 1).slice(0, 150).map(x => tamPozKor(x, TH));
  return { ok: true, fish: u.fish, admin: u.admin, bugun: V.bugun(), olchov: TAM_OLCHOV, pozlar,
    jismoniy: J.map(x => x.fish), menTaminotchi: J.some(x => x.fish === u.fish),
    firmalar: F.map(f => ({ id: f.id, nomi: f.nomi })),
    qarz: { kelt: oz.kelt || 0, tolan: oz.tolan || 0, qoldiq: (oz.kelt || 0) - (oz.tolan || 0) },
    mening, tolovlar: tol.map(t => ({ sana: t.sana, summa: t.summa, usul: t.usul, tilxat: t.tilxat, taminotchi: t.taminotchi })) };
}

// ------------------------------------------------------------------ 🤝 KELISHUV BILAN BEKOR (06m)
async function kbRows() {
  return aOxiri(await V.qatorlar('06m_Kelishuv_bekor')).map(({ n, r: r0 }) => { const r = kor(r0, 24);
    return { qator: n, id: r[0], vaqt: r[1], no: String(r[2]).trim(), fish: r[3], dokon: r[4], sabab: r[5], sana: r[6], qarz: String(r[7]).trim() === 'Йўқ' ? 'Йўқ' : String(r[7]).replace(/\D/g, ''), kalit: r[8], hisob: r[9],
      holat: r[10], izoh: r[11], holati: r[12], pdf: r[13], doc: r[14], skan: r[15], skanVaqt: r[16], skanKim: r[17], kim: r[18], javob: r[19], javobVaqt: r[20], javobKim: r[21], tarix: r[22], sahifa: r[23] }; })
    .filter(s => s.id);
}
function kbKor(s) {
  return { id: s.id, vaqt: s.vaqt, no: s.no, fish: s.fish, dokon: s.dokon, sabab: s.sabab, sana: s.sana, qarz: s.qarz, kalit: s.kalit, hisob: s.hisob, holat: s.holat, izoh: s.izoh,
    holati: s.holati, skan: !!s.skan, skanVaqt: s.skanVaqt, skanKim: s.skanKim, kim: s.kim, javob: s.javob, javobVaqt: s.javobVaqt, javobKim: s.javobKim, doc: !!s.doc };
}
async function kbDirektor([kodSes]) {
  await S.ruxsat(kodSes, 'admin');
  return (await kbRows()).filter(s => s.holati === 'Tasdiq kutilmoqda').map(kbKor);
}

// ------------------------------------------------------------------ ✕ IMZOLANMAGAN IJARA (06l)
async function imzSorovlar() {
  return aOxiri(await V.qatorlar('06l_Imzosiz_sorovlar')).map(({ n, r: r0 }) => { const r = kor(r0, 11);
    return { qator: n, id: r[0], vaqt: r[1], no: String(r[2]).trim(), fish: r[3], dokon: r[4], kim: r[5], sabab: r[6], holati: r[7], javob: r[8], javobVaqt: r[9], javobKim: r[10] }; })
    .filter(s => s.id);
}
async function ijaraImzosizRoyxat([kodSes]) {
  await S.ruxsat(kodSes, 'admin');
  return (await imzSorovlar()).filter(s => s.holati === 'Kutilmoqda')
    .map(s => ({ id: s.id, vaqt: s.vaqt, no: s.no, fish: s.fish, dokon: s.dokon, kim: s.kim, sabab: s.sabab }));
}

// ------------------------------------------------------------------ 📎 Hujjatlar paneli: kbHolat (KelishuvBekor.gs), ijaraImzosizHolat (ImzosizBekor.gs) — faqat tekshiruv
const J = require('../lib/jurnallar');
const { xodimTeng } = require('../lib/xodim');
const BEKOR_YOPIQ = ['Bekor qilindi', 'Rad etildi', 'Qaytarildi'];
const KB_OCHIQ = ['Hujjat tayyorlandi', 'Tasdiq kutilmoqda', 'Rad etildi'];
const xom = (x, n) => { const o = []; for (let i = 0; i < n; i++) o.push(x[i] == null ? '' : x[i]); return o; };
async function ijara04(no, ust) {
  const V4 = aOxiri(await V.qatorlar('04_Ijara_shartnomalar')).map(z => ({ n: z.n, r: xom(z.x, ust) }));
  const top = V4.filter(z => String(z.r[0]).trim() === no);
  if (!top.length) throw new S.Xato('Ijara shartnomasi topilmadi: ' + no);
  if (top.length > 1) throw new S.Xato(no + ' raqami 04 da ' + top.length + ' marta uchraydi — avval bazada qo\'lda tekshiring.');
  return top[0].r;
}
// kbTekshir_ — tekshiruv qismi (hujjat ma'lumotlari kerak emas)
async function kbTekshir(no, ozId) {
  no = String(no || '').trim();
  if (!/^IJ-27\/\d+$/.test(no)) throw new S.Xato('Bu yo\'l faqat ijara shartnomasi (IJ-27/…) uchun: ' + no);
  const r = await ijara04(no, 29);
  const holati = String(r[2] || '').trim();
  if (holati !== 'Aktiv') throw new S.Xato(no + ' holati «' + (holati || 'bo\'sh') + '» — faqat «Aktiv» shartnoma bekor qilinadi.');
  if (String(r[6] || '').trim() !== 'MChJ') throw new S.Xato(no + ' bo\'yicha ijaraga beruvchi — «' + r[6] + '». Bu yo\'l faqat MChJ nomidan tuzilgan shartnoma uchun — Kamoliddinga ayting.');
  if (!(await J.hujjatJurnal()).some(h => h.no === no && h.turi === 'SHARTNOMA' && h.holati === 'Faol'))
    throw new S.Xato(no + ' ning imzolangan skani yuklanmagan — demak shartnoma imzolanmagan. Uni «✕ Imzolanmagan» yo\'li bilan bekor qiling.');
  const och = (await J.bekorJurnal()).find(z => z.no === no && BEKOR_YOPIQ.indexOf(z.holati) < 0);
  if (och) throw new S.Xato(no + ' bo\'yicha bir tomonlama bekor qilish so\'rovi ochiq: ' + (och.raqam || 'ID ' + och.id) + ' (' + och.holati + ') — avval uni yoping.');
  const boshqa = (await kbRows()).find(z => z.no === no && KB_OCHIQ.indexOf(z.holati) >= 0 && String(z.id) !== String(ozId || ''));
  if (boshqa) throw new S.Xato(no + ' bo\'yicha kelishuv so\'rovi allaqachon ochiq (' + boshqa.holati + ', ' + boshqa.kim + ').');
}
async function kbHolat([kodSes, no]) {
  const u = await S.foydalanuvchi(kodSes); if (!u) throw new S.Xato('Sessiya tugagan — PIN ni qayta kiriting.');
  const h = u.huquq || []; const adm = h.indexOf('admin') >= 0;
  if (!(adm || h.indexOf('ijara_kelishuv') >= 0)) return { huquq: false };
  no = String(no || '').trim();
  const sr = (await kbRows()).filter(z => z.no === no && KB_OCHIQ.indexOf(z.holati) >= 0).pop();
  if (sr) return { huquq: true, admin: adm, ozi: sr.kim === u.fish, s: kbKor(sr) };
  try { await kbTekshir(no); } catch (e) { if (!(e instanceof S.Xato)) throw e; return { huquq: true, admin: adm, mumkin: false, sabab: e.message }; }
  return { huquq: true, admin: adm, mumkin: true };
}
// imzTekshir_ — tekshiruv qismi; masul qaytaradi
async function imzTekshir(no) {
  no = String(no || '').trim();
  if (!/^IJ-27\/\d+$/.test(no)) throw new S.Xato('Bu yo\'l faqat ijara shartnomasi (IJ-27/…) uchun: ' + no);
  const r = await ijara04(no, 24);
  const holati = String(r[2] || '').trim();
  if (holati !== 'Aktiv') throw new S.Xato(no + ' holati «' + (holati || 'bo\'sh') + '» — faqat «Aktiv» shartnoma shu yo\'l bilan bekor qilinadi.');
  if ((await J.hujjatJurnal()).some(h => h.no === no && h.turi === 'SHARTNOMA' && h.holati === 'Faol'))
    throw new S.Xato(no + ' ga imzolangan shartnoma skani yuklangan — demak u imzolangan. Bu yo\'l faqat imzolanmagan shartnoma uchun; «✂ Bekor qilishga kiritish» tartibidan foydalaning.');
  const soni = async (nom, shart) => aOxiri(await V.qatorlar(nom)).map(z => xom(z.x, 7)).filter(z => String(z[2]).trim() === no && (!shart || shart(z))).length;
  const t5 = await soni('05_Tolovlar'), t5b = await soni('05b_Bufer_tolovlar', z => String(z[6]).trim() === 'Буферда');
  if (t5 || t5b) throw new S.Xato(no + ' bo\'yicha to\'lov bor (' + (t5 ? '05_Tolovlar: ' + t5 + ' ta' : '') + (t5 && t5b ? ', ' : '') + (t5b ? 'buferda: ' + t5b + ' ta' : '') + ') — imzolanmagan deb bekor qilib bo\'lmaydi.');
  const och = (await J.bekorJurnal()).find(z => z.no === no && BEKOR_YOPIQ.indexOf(z.holati) < 0);
  if (och) throw new S.Xato(no + ' bo\'yicha ochiq bekor so\'rovi bor: ' + och.raqam + ' (' + och.holati + ') — avval uni yoping.');
  return { masul: String(r[20] || '').trim() };
}
async function ijaraImzosizHolat([kodSes, no]) {
  let u; try { u = await S.ruxsat(kodSes, 'shartnoma'); } catch (e) { return { admin: false, mumkin: false, sorov: null, sabab: '' }; }
  no = String(no || '').trim();
  const sr = (await imzSorovlar()).find(z => z.no === no && z.holati === 'Kutilmoqda');
  const sorov = sr ? { id: sr.id, vaqt: sr.vaqt, kim: sr.kim, sabab: sr.sabab } : null;
  let x; try { x = await imzTekshir(no); } catch (e) { if (!(e instanceof S.Xato)) throw e; return { admin: u.admin, mumkin: false, sorov, sabab: e.message }; }
  if (u.admin) return { admin: true, mumkin: true, sorov, sabab: '' };
  if (!(x.masul && xodimTeng(x.masul, u.fish))) return { admin: false, mumkin: false, sorov, sabab: 'Bu shartnomani ' + (x.masul || 'boshqa xodim') + ' tuzgan — so\'rovni faqat u yuboradi.' };
  return { admin: false, mumkin: true, sorov, sabab: '' };
}

module.exports = { taminotDirektor, taminotSvodOl, taminotBoshlang, kbDirektor, ijaraImzosizRoyxat, kbHolat, ijaraImzosizHolat };
module.exports._ichki = { tamRows, tamJismoniy, tamFirmalar };
