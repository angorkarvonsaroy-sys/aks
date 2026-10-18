// AKS TIZIM — ✎ SHARTNOMA TAHRIRI va unga bog'liq direktor so'rovlari serverda (eski kod bilan bir xil tekshiruvlar, xato matnlari, javob va kataklar):
//   tahrirSaqlash    (Tahrir.gs v25.9.3)  — kiritgan xodim (o'sha kuni, skan yuklanmaguncha) yoki direktor: 02_Mijozlar kataklari («@» matn),
//                                          04 faoliyat turi, har o'zgarish 06j_Tahrir_jurnali ga
//   monSorovYubor    (Monitoring.gs)      — xodim direktordan so'raydi (shartnoma tahriri / xatni bekor qilish): 06i oxiriga + direktorga Telegram
//   monSorovJavob    (Monitoring.gs)      — direktor javobi: tasdiqlansa tahrir qo'llanadi (tahrirQollash_) yoki xat bekor qilinadi (xatBekor);
//                                          06i G:J, xodimga Telegram (koprikTgChat)
//   topMalumotKirit  (Qadam.gs v2.2)      — 📌 «ma'lumot topshirig'i»: xodim — 06i so'rovi; direktor — darhol qo'llanadi, topshiriq yopiladi
//   topMalumotTasdiq (Qadam.gs v2.2)      — direktor topshiriq kartasida tasdiqlaydi / rad etadi (monSorovJavob orqali)
// Yozish faqat «aks-yozuv-sinov tahrir» nusxa varaqlarda tekshirgach yoqiladi (Redis: yozuv_yondi:tahrir) va Koprik v1.5 bo'lsa.
// Aks holda, yoki robotda yozish huquqi bo'lmasa — amal avvalgidek eski tizim orqali bajariladi (hech narsa yozilmasdan oldin qaytariladi).
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
const { xodimTeng } = require('../lib/xodim');
const { qisqaIsm } = require('../lib/ism');
const K = require('./kassa')._ichki;
const QY = require('./qadam_yoz')._ichki;
const TP = require('./topshiriq_yoz')._ichki;
const MY = require('./mayda_yoz');

const MIJ_V = '02_Mijozlar', S3_V = '03_Sotuv_shartnomalar', S4_V = '04_Ijara_shartnomalar', TJ_V = '03b_Tolov_jadvali', JUR_V = '06j_Tahrir_jurnali', SOR_V = QY.SOR_V, TOP_V = TP.TOP_V;
const MON_SOROV_TUR = { xat_bekor: 'Xatni bekor qilish', tahrir: 'Shartnoma tahriri' };
const QD_MAYDON = { jshshir: 'JSHSHIR', ota: 'Otasining ismi', tel: 'Telefon raqami' };
// 02_Mijozlar: maydon → [ustun (1 dan), nomi]
const TAHRIR_02 = { fish: [3, 'F.I.Sh.'], tel: [5, 'Telefon'], tel2: [6, "Qo'shimcha telefon"], pasport: [7, 'Pasport'], jshshir: [12, 'JSHSHIR'],
  mv: [14, 'Viloyat'], mt: [15, 'Tuman'], mfy: [16, 'MFY'], kocha: [17, "Ko'cha"], uy: [18, 'Uy'], xon: [19, 'Xonadon'] };
const s = v => String(v == null ? '' : v);
const S1 = x => s(x).replace(/\s+/g, ' ').trim();
const kut = (p, ms) => Promise.race([p, new Promise(r => setTimeout(r, ms))]);
const yangila = nomlar => kut(tetik.varaqlarYangila(nomlar).catch(e => console.error('ko\'zgu (tahrir):', e.message)), 15000);
function yozilmadi(e) { if (e instanceof G.RuxsatYoq) e.yozilmadi = true; return e; }

async function serverda(kod) {
  try { if ((await redis.get('yozuv_yondi:tahrir')) !== '1') return false; } catch (e) { return false; }
  return TP.koprik15(kod);
}
async function eskiTizim(fn, u, args) { const r = await koprik.chaqir(fn, u.kod, args); await tetik.yangilaKut(20000); return r; }

// ------------------------------------------------------------------ o'qish (Google'dan YANGI, getDisplayValues)
// tahrirSh_: {tur, qator, no, mid, dokon, sana, holati, kiritdi, kiritildi, faoliyat}; kiritdi — 03 AP bo'sh bo'lsa (eski shartnoma) 03b izohidagi «Web App: …»
async function shYangi(no, v = {}) {
  no = s(no).trim();
  if (/^IJ-27\/\d+$/.test(no)) {
    const X = await G.oraliqOqi(env.aksBazaId, v.s4 || S4_V, 'A2:AL', env.googleKey);
    const i = X.findIndex(x => s(x[0]).trim() === no);
    if (i < 0) throw new S.Xato('Ijara shartnomasi topilmadi: ' + no);
    const r = X[i];
    return { tur: 'ijara', qator: i + 2, no, mid: s(r[5]).trim(), dokon: s(r[4]), sana: s(r[1]), holati: s(r[2]), kiritdi: s(r[20]).trim(), kiritildi: s(r[37]).trim(), faoliyat: s(r[18]) };
  }
  if (/^27\/\d+$/.test(no)) {
    const X = await G.oraliqOqi(env.aksBazaId, v.s3 || S3_V, 'A2:AP', env.googleKey);
    const i = X.findIndex(x => s(x[0]).trim() === no);
    if (i < 0) throw new S.Xato('Shartnoma topilmadi: ' + no);
    const r = X[i];
    let kiritdi = s(r[41]).trim();
    if (!kiritdi && v.kiritdi) {   // faqat tahrirSaqlash ning ruxsat tekshiruvi uchun kerak (eski shartnomalar — ko'zgudan)
      const x = (await V.qatorlar(TJ_V)).map(z => z.r || []).find(z => s(z[1]).trim() === no && /^Web App: /.test(s(z[7])));
      if (x) kiritdi = s(x[7]).replace(/^Web App: /, '').trim();
    }
    return { tur: 'sotuv', qator: i + 2, no, mid: s(r[4]).trim(), dokon: s(r[5]), sana: s(r[2]), holati: s(r[13]), kiritdi, kiritildi: s(r[40]).trim(), faoliyat: '' };
  }
  throw new S.Xato('Shartnoma raqami noto\'g\'ri: «' + no + '» — 27/… yoki IJ-27/… bo\'lishi kerak.');
}
// tahrirMijoz_: {qator, r (25 ustun), X (hamma qatorlar — pasport/JSHSHIR takrorini tekshirish uchun)}
async function mijozYangi(mid, varaq) {
  const X = await G.oraliqOqi(env.aksBazaId, varaq || MIJ_V, 'A2:Y', env.googleKey);
  const i = X.findIndex(x => s(x[0]).trim() === s(mid).trim());
  if (i < 0) throw new S.Xato('Mijoz 02_Mijozlar da topilmadi (ID ' + mid + ').');
  const r = []; for (let k = 0; k < 25; k++) r.push(s(X[i][k]));
  return { qator: i + 2, r, X };
}

// ------------------------------------------------------------------ yozuv yadrolari (sinov ham shularni ishlatadi — nusxa varaqda)
// cell.setNumberFormat('@').setValue(v) — katak matn formatida, qiymat matn (bo'sh — tozalanadi)
async function matnKataklar(varaq, kataklar) {   // kataklar: [{ qator, ustun, v }]
  if (!kataklar.length) return;
  const g = await G.gid(env.aksBazaId, varaq, env.googleKey);
  try {
    await G.soralar(env.aksBazaId, kataklar.map(c => ({ updateCells: { range: { sheetId: g, startRowIndex: c.qator - 1, endRowIndex: c.qator, startColumnIndex: c.ustun - 1, endColumnIndex: c.ustun },
      rows: [{ values: [Object.assign(c.v === '' ? {} : { userEnteredValue: { stringValue: c.v } }, { userEnteredFormat: { numberFormat: { type: 'TEXT', pattern: '@' } } })] }],
      fields: 'userEnteredValue,userEnteredFormat.numberFormat' } })), env.googleKey);
  } catch (e) { throw yozilmadi(e); }
}
const ustunHarf = n => { let r = ''; while (n > 0) { const m = (n - 1) % 26; r = String.fromCharCode(65 + m) + r; n = Math.floor((n - 1) / 26); } return r; };
// js.getRange(jl + 1, 1, n, 10).setValues(log) — A ustunining oxirgi to'ldirilgan qatoridan keyin (USER_ENTERED — setValues bilan bir xil talqin)
async function jurnalYoz(varaq, log) {
  try {
    const A = await G.ustunOqi(env.aksBazaId, varaq, 'A', env.googleKey);
    let id = Math.max(0, ...A.slice(1).map(v => Number(v) || 0));
    const L = log.map(q => [++id].concat(q));
    const r = await G.qatorlarQoshR(env.aksBazaId, varaq, A.length + 1, L, env.googleKey);
    return { r, L };
  } catch (e) { throw yozilmadi(e); }
}
// 06i G:J — [Holati, Javob, Javob_vaqt, Javob_kim] (setValues)
async function javobYoz(varaq, qator, q) {
  try { await G.yoz(env.aksBazaId, [{ varaq, katak: 'G' + qator + ':J' + qator, qiymat: [q] }], env.googleKey); } catch (e) { throw yozilmadi(e); }
}

// ------------------------------------------------------------------ tahrirQollash_
// d: {fish, tel, tel2, pasport, jshshir, mv, mt, mfy, kocha, uy, xon, faoliyat} — bo'lgan maydonlargina tekshiriladi.
// v — varaq nomlari (sinov uchun); c, m — oldindan o'qilgan bo'lsa (tahrirSaqlash)
async function tahrirQollash(kim, no, d, usul, o = {}) {
  const v = o.v || {};
  const c = o.c || await shYangi(no, v);
  if (/bekor/i.test(c.holati)) throw new S.Xato('Shartnoma «' + c.holati + '» holatida — tahrirlanmaydi.');
  const m = o.m || await mijozYangi(c.mid, v.m2);
  const r = m.r;
  const joriy = { fish: r[2], tel: r[4], tel2: r[5], pasport: r[6], jshshir: r[11], mv: r[13], mt: r[14], mfy: r[15], kocha: r[16], uy: r[17], xon: r[18] };
  const yangi = {};
  if (d.fish !== undefined) { const f = S1(d.fish).toUpperCase(); const xt = K.ismTekshir(f, true, !/^direktor/.test(s(usul))); if (xt) throw new S.Xato(xt); yangi.fish = f; }   // 3 so'z + lotin shart (direktor istisno)
  if (d.tel !== undefined) { const t = K.telNorm(d.tel); const xt = K.telTekshir(t); if (xt) throw new S.Xato(xt); yangi.tel = K.telFmt(t); }
  if (d.tel2 !== undefined) { const t = K.telNorm(d.tel2); if (t && K.telTekshir(t)) throw new S.Xato('2-telefon noto\'g\'ri: ' + K.telTekshir(t)); yangi.tel2 = t ? K.telFmt(t) : ''; }
  if (d.pasport !== undefined) { const p = S1(d.pasport).toUpperCase().replace(/\s/g, ''); if (!/^[A-Z]{2}\d{7}$/.test(p)) throw new S.Xato('Pasport AB1234567 ko\'rinishida bo\'lishi kerak.'); yangi.pasport = p; }
  if (d.jshshir !== undefined) { const j = S1(d.jshshir).replace(/\D/g, ''); if (j && j.length !== 14) throw new S.Xato('JSHSHIR 14 raqam bo\'lishi kerak.'); yangi.jshshir = j; }
  ['mv', 'mt', 'mfy', 'kocha', 'uy', 'xon'].forEach(k => { if (d[k] !== undefined) yangi[k] = S1(d[k]); });
  // pasport/JSHSHIR boshqa mijozda bormi (o'z qatoridan tashqari)
  if (yangi.pasport !== undefined || yangi.jshshir) {
    let l = -1; m.X.forEach((x, i) => { if (s(x[0]) !== '') l = i; });
    for (let i = 0; i <= l; i++) { const x = m.X[i].map(s); if (i + 2 === m.qator || !x[0]) continue;
      if (yangi.pasport !== undefined && x[6] && x[6].replace(/\s/g, '') === yangi.pasport) throw new S.Xato('Bu pasport boshqa mijozda bor: ' + x[2] + ' (ID ' + x[0] + ').');
      if (yangi.jshshir && x[11] && x[11].replace(/\D/g, '') === yangi.jshshir) throw new S.Xato('Bu JSHSHIR boshqa mijozda bor: ' + x[2] + ' (ID ' + x[0] + ').'); }
  }
  let fYangi;
  if (d.faoliyat !== undefined && c.tur === 'ijara') { fYangi = S1(d.faoliyat); if (!fYangi) throw new S.Xato('Faoliyat turini tanlang.'); }
  const jv = v.jurnal || JUR_V, m2 = v.m2 || MIJ_V, s4 = v.s4 || S4_V;
  return QY.qulf('tahrir', async () => {
    const vaqt = QY.hozir().dmyHm;
    try { await G.gid(env.aksBazaId, jv, env.googleKey); } catch (e) { const x = new Error('06j_Tahrir_jurnali varag\'i yo\'q'); x.yozilmadi = true; throw x; }   // tahrirVaraq_ yaratadi — eski tizimga
    const log = [], kat = [];
    const ozgar = Object.keys(yangi).filter(k => yangi[k] !== S1(joriy[k]));
    if (ozgar.length) {
      const F = (await G.oraliqOqi(env.aksBazaId, m2, 'A' + m.qator + ':S' + m.qator, env.googleKey, 'FORMULA'))[0] || [];
      for (const k of ozgar) {
        const fx = F[TAHRIR_02[k][0] - 1];
        if (typeof fx === 'string' && fx[0] === '=') { await matnKataklar(m2, kat); throw new S.Xato('02_Mijozlar «' + TAHRIR_02[k][1] + '» katagida formula bor — tegilmadi, direktorga ayting.'); }
        kat.push({ qator: m.qator, ustun: TAHRIR_02[k][0], v: yangi[k] });
        log.push([vaqt, c.no, c.tur === 'ijara' ? 'Ijara' : 'Sotuv', c.mid, TAHRIR_02[k][1], S1(joriy[k]) || '—', yangi[k] || '—', kim, usul]);
      }
    }
    let fKatak = false;
    if (fYangi !== undefined && fYangi !== S1(c.faoliyat)) {
      const fx = ((await G.oraliqOqi(env.aksBazaId, s4, 'S' + c.qator, env.googleKey, 'FORMULA'))[0] || [])[0];
      if (typeof fx === 'string' && fx[0] === '=') { await matnKataklar(m2, kat); throw new S.Xato('04 dagi «Faoliyat» katagida formula bor — tegilmadi, direktorga ayting.'); }
      fKatak = true;
      log.push([vaqt, c.no, 'Ijara', c.mid, 'Faoliyat turi', S1(c.faoliyat) || '—', fYangi, kim, usul]);
    }
    if (!log.length) throw new S.Xato('Hech narsa o\'zgarmadi — qiymatlar avvalgisi bilan bir xil.');
    await matnKataklar(m2, kat);
    if (fKatak) { try { await G.yoz(env.aksBazaId, [{ varaq: s4, katak: 'S' + c.qator, qiymat: [[fYangi]] }], env.googleKey); } catch (e) { if (!kat.length) throw yozilmadi(e); throw e; } }
    await jurnalYoz(jv, log);
    return { ok: true, no: c.no, soni: log.length, ozgardi: log.map(x => ({ maydon: x[4], eski: x[5], yangi: x[6] })),
      fish: yangi.fish !== undefined ? yangi.fish : S1(joriy.fish), _fish: ozgar.indexOf('fish') >= 0, _f: fKatak };
  });
}
async function tahrirKozgu(t, qoshimcha = []) {   // 03/04 dagi F.I.Sh. — 02 ga formula, ko'zguda ham yangilansin
  await yangila((t ? [MIJ_V, JUR_V] : []).concat(t && t._fish ? [S3_V, S4_V] : t && t._f ? [S4_V] : []).concat(qoshimcha));
}
const toza = t => { const o = Object.assign({}, t); delete o._fish; delete o._f; return o; };

// ------------------------------------------------------------------ ✎ tahrirSaqlash (xodim o'zi — shartlar bajarilganda, yoki admin)
async function tahrirSaqlash(args) {
  const [kodSes, no, d0] = args;
  const u = await S.ruxsat(kodSes, 'shartnoma');
  if (!(await serverda(u.kod))) return eskiTizim('tahrirSaqlash', u, args.slice(1));
  const d = d0 || {};
  // tahrirHolat: shartnoma, mijoz, keyin ruxsat
  const c = await shYangi(no, { kiritdi: true });
  const m = await mijozYangi(c.mid);
  const bugun = V.bugun().split('-').reverse().join('.');
  const kirKun = s(c.kiritildi).slice(0, 10) || s(c.sana);
  const skan = (await J.hujjatJurnal()).some(h => h.no === s(c.no) && h.turi === 'SHARTNOMA' && h.holati === 'Faol');
  let sabab = '';
  if (/bekor/i.test(c.holati)) sabab = 'Shartnoma «' + c.holati + '» holatida — tahrirlanmaydi.';
  else if (!u.admin) {
    if (c.kiritdi && !xodimTeng(c.kiritdi, u.fish)) sabab = 'Bu shartnomani ' + c.kiritdi + ' kiritgan — faqat kiritgan xodim (o\'sha kuni) yoki direktor tahrirlaydi.';
    else if (skan) sabab = 'Imzolangan shartnoma skani yuklangan — endi faqat direktor ruxsati bilan.';
    else if (kirKun !== bugun) sabab = 'Kiritilgan kun (' + (kirKun || 'noma\'lum') + ') o\'tgan — endi faqat direktor ruxsati bilan.';
  }
  if (sabab) throw new S.Xato(sabab + ' «📨 Direktordan so\'rash» tugmasidan foydalaning.');
  let t;
  try { t = await tahrirQollash(u.fish, no, d, u.admin ? 'direktor' : "o'zi (kiritgan kuni)", { c, m }); }
  catch (e) { if (e.yozilmadi) return eskiTizim('tahrirSaqlash', u, args.slice(1)); throw e; }
  await tahrirKozgu(t);
  return toza(t);
}

// ------------------------------------------------------------------ 📨 monSorovYubor (xodim → direktor)
async function monSorovYubor(args) {
  const [kodSes, tur, kalit0, sabab0, malumot] = args;
  if (!MON_SOROV_TUR[tur]) throw new S.Xato("Noma'lum so'rov turi.");
  const u = await S.ruxsat(kodSes, tur === 'xat_bekor' ? 'xat' : tur === 'tahrir' ? 'shartnoma' : 'undiruv');
  if (!(await serverda(u.kod))) return eskiTizim('monSorovYubor', u, args.slice(1));
  const sabab = S1(sabab0), kalit = s(kalit0).trim();
  if (sabab.length < 5) throw new S.Xato('Sababini yozing (kamida 5 belgi).');
  if (tur === 'xat_bekor') {
    const h = await MY._ichki.xatYangi(MY._ichki.XAT_V, kalit);
    if (!h) throw new S.Xato('Xat topilmadi: ' + kalit);
    if (h.holati === 'Bekor') throw new S.Xato('Xat allaqachon bekor qilingan.');
    if (h.holati === 'Yuborildi') throw new S.Xato("Yuborilgan xat bekor qilinmaydi — u mijozga yetkazilgan.");
  }
  if (tur === 'tahrir') {
    await shYangi(kalit);   // shartnoma bor-yo'qligi tekshiriladi
    let p = null; try { p = JSON.parse(s(malumot || '')); } catch (e) { }
    if (!p || !p.d || !Object.keys(p.d).length) throw new S.Xato("So'rovda o'zgarishlar yo'q — formani to'ldirib qayta yuboring.");
  }
  let y;
  try {
    y = await QY.qulf('06i', async () => {
      const R = await QY.sorovlar(SOR_V);
      if (R.L.some(z => z.tur === tur && z.kalit === kalit && z.holati === 'Kutilmoqda')) throw new S.Xato("Bu bo'yicha so'rov allaqachon yuborilgan — direktor javobini kuting.");
      return QY.sorovYoz(SOR_V, R, u.fish, kalit, sabab, s(malumot || ''), tur);
    });
  } catch (e) { if (e.yozilmadi) return eskiTizim('monSorovYubor', u, args.slice(1)); throw e; }
  QY.tgFon(u.kod, "📨 <b>Direktorga so'rov</b> — " + u.fish + ': ' + MON_SOROV_TUR[tur] + ' <b>' + kalit + '</b>\n«' + sabab + "»\nJavob — ilovada 👔 Direktor → Tasdiqlar.");
  await yangila([SOR_V]);
  return { ok: true, id: y.id };
}

// ------------------------------------------------------------------ 👔 monSorovJavob (direktor)
async function monXodimlar() {   // monXodimlarRoyxat_ (07_Xodimlar: B FISH, U Telegram_ID)
  return (await V.qatorlar('07_Xodimlar')).filter(({ x }) => s(x[1]).trim()).map(({ x }) => ({ fish: s(x[1]).trim(), tg: s(x[20]).trim() }));
}
async function javob(u, kodSes, id, ha, izoh0) {   // monSorovJavob ning o'zi (topMalumotTasdiq ham chaqiradi)
  const izoh = S1(izoh0);
  const R = await QY.sorovlar(SOR_V);
  const so = R.L.find(z => s(z.id) === s(id));
  if (!so) throw new S.Xato("So'rov topilmadi.");
  if (so.holati !== 'Kutilmoqda') throw new S.Xato("Bu so'rovga allaqachon javob berilgan: " + so.holati + '.');
  if (!ha && izoh.length < 5) throw new S.Xato('Rad etish sababini yozing (kamida 5 belgi).');
  let natija = '', t = null;
  if (ha && so.tur === 'xat_bekor') { await MY.xatBekor([kodSes, so.kalit, "Xodim so'rovi (" + so.kim + '): ' + so.sabab + (izoh ? ' · ' + izoh : '')]); natija = so.kalit + ' xati bekor qilindi.'; }
  if (ha && so.tur === 'tahrir') {
    let p = null; try { p = JSON.parse(s(so.malumot || '')); } catch (e) { }
    if (!p || !p.d) throw new S.Xato("So'rovda o'zgarishlar yo'q (Malumot ustuni bo'sh) — xodim qayta yuborsin.");
    try {
      t = await tahrirQollash(so.kim, so.kalit, p.d, "direktor so'rov №" + so.id + ' (' + u.fish + ')');
      natija = so.kalit + ' tahrirlandi: ' + t.soni + " ta maydon o'zgardi. Shartnoma PDF ini qayta chiqarish kerak.";
    } catch (e) {
      if (/Hech narsa o'zgarmadi/.test(s(e.message))) natija = so.kalit + ": qiymatlar allaqachon so'ralgandek edi — o'zgarish kerak bo'lmadi.";
      else throw e;
    }
  }
  await javobYoz(SOR_V, so.qator, [ha ? 'Tasdiqlandi' : 'Rad etildi', izoh, QY.hozir().dmyHm, u.fish]);
  const x = (await monXodimlar()).find(z => z.fish === so.kim);
  if (x && x.tg) koprik.chaqir('koprikTgChat', u.kod, [x.tg, (ha ? '✅' : '✖') + " <b>So'rovingiz</b> (" + (MON_SOROV_TUR[so.tur] || so.tur) + ' ' + so.kalit + '): ' + (ha ? 'tasdiqlandi' : 'rad etildi') + (izoh ? '\n«' + izoh + '»' : '')])
    .catch(e => console.error('monSorovJavob tg (ko\'prik):', e.message));
  return { natija, t };
}
async function monSorovJavob(args) {
  const [kodSes, id, ha, izoh] = args;
  const u = await S.ruxsat(kodSes, 'admin');
  if (!(await serverda(u.kod))) return eskiTizim('monSorovJavob', u, args.slice(1));
  let j;
  try { j = await javob(u, kodSes, id, ha, izoh); }
  catch (e) { if (e.yozilmadi) return eskiTizim('monSorovJavob', u, args.slice(1)); throw e; }
  await tahrirKozgu(j.t, [SOR_V]);
  return { ok: true, natija: j.natija };
}

// ------------------------------------------------------------------ 📌 ma'lumot topshirig'i
async function topMalumotKirit(args) {
  const [kodSes, id, d0] = args;
  const u = await S.ruxsat(kodSes);
  if (!(await serverda(u.kod))) return eskiTizim('topMalumotKirit', u, args.slice(1));
  const admin = u.admin;
  const t = (await TP.topRowsYangi(TOP_V)).L.find(z => s(z.id) === s(id)); if (!t) throw new S.Xato('Topshiriq topilmadi.');
  const p = s(t.kalit).split('|'); if (p[0] !== 'malumot' || !QD_MAYDON[p[2]]) throw new S.Xato('Bu ma\'lumot topshirig\'i emas.');
  if (t.holati !== 'Jarayonda') throw new S.Xato('Topshiriq «' + t.holati + '» holatida — sahifani yangilang.');
  if (!admin && !xodimTeng(t.kimga, u.fish)) throw new S.Xato('Bu topshiriq sizga berilmagan.');
  const x = (await U.undShartnomalar()).find(z => z.no === p[1]); if (!x) throw new S.Xato(p[1] + ' shartnomasi undiruv ro\'yxatida topilmadi — direktorga ayting.');
  const d = d0 || {};
  const dm = { maydon: p[2], qiymat: d.qiymat, manba: d.manba };
  const M2 = await G.oraliqOqi(env.aksBazaId, MIJ_V, 'A2:L', env.googleKey);
  const r2 = M2.find(r => s(r[0]) === x.mid); if (!r2) throw new S.Xato('Mijoz 02_Mijozlar da topilmadi: ' + x.mid);
  if (!admin) {   // qdMalumotYoz_(…, tg = true): 06i so'rovi + direktorga Telegram
    let w;
    try {
      w = await QY.qulf('06i', async () => {
        const R = await QY.sorovlar(SOR_V);
        const tk = QY.malumotTekshir(r2, dm, x, R.L.some(z => z.tur === 'tahrir' && z.kalit === x.no && z.holati === 'Kutilmoqda'));
        const y = await QY.sorovYoz(SOR_V, R, u.fish, x.no, tk.sabab, JSON.stringify({ d: tk.dd, f: tk.f }));
        return Object.assign({ id: y.id }, tk);
      });
    } catch (e) { if (e.yozilmadi) return eskiTizim('topMalumotKirit', u, args.slice(1)); throw e; }
    QY.tgFon(u.kod, '📨 <b>Direktorga so\'rov</b> — ' + u.fish + ': Shartnoma tahriri <b>' + x.no + '</b> · ' + qisqaIsm(x.fish) + '\n' + w.f.map(z => z[0] + ': ' + (z[1] ? z[1] + ' → ' : '') + '<b>' + z[2] + '</b>').join('\n') + '\n«' + w.sabab + '»\nJavob — ilovada 📌 Topshiriqlar yoki 👔 Direktor → Tasdiqlar.');
    await yangila([SOR_V]);
    return { ok: true, matn: w.f[0][0] + ' direktorga tasdiqqa yuborildi. Tasdiqlansa, mijoz kartasiga o\'zi yoziladi va topshiriq yopiladi.' };
  }
  // direktor o'zi — tasdiq shart emas, darhol qo'llanadi (qdMalumotYoz_(…, faqatTayyor = true))
  const r = QY.malumotTekshir(r2, dm, x, (await QY.sorovlar(SOR_V)).L.some(z => z.tur === 'tahrir' && z.kalit === x.no && z.holati === 'Kutilmoqda'));
  let n = 0, tq = null;
  try {   // yozilmasa — eski tizim qayta bajaradi (u yerda «Hech narsa o'zgarmadi» e'tiborsiz, topshiriq yopiladi)
    try { tq = await tahrirQollash(u.fish, x.no, r.dd, 'direktor, topshiriq №' + t.id + ' — ' + r.sabab); n = tq.soni; }
    catch (e) { if (!/Hech narsa o'zgarmadi/.test(s(e.message))) throw e; }
    await TP.topYop(TOP_V, t, 'Bajarildi', u.fish, r.f[0][0] + ' kiritildi: ' + r.f[0][2]);
  } catch (e) { if (e.yozilmadi) return eskiTizim('topMalumotKirit', u, args.slice(1)); throw e; }
  await tahrirKozgu(tq, [TOP_V]);
  return { ok: true, matn: '✅ ' + x.no + ': ' + r.f[0][0] + ' mijoz kartasiga yozildi' + (n ? '' : ' (avval ham shunday edi)') + '. Topshiriq yopildi. Shartnoma PDF ini qayta chiqarish kerak.' };
}
// topMlSorov_: shu topshiriq bo'yicha direktorda kutilayotgan tahrir so'rovi (06i)
function topMlSorov(Sr, t) {
  const p = s(t.kalit).split('|'); const k = { jshshir: ['jshshir'], ota: ['fish'], tel: ['tel', 'tel2'] }[p[2]] || [];
  for (let i = 0; i < Sr.length; i++) { const so = Sr[i]; if (so.tur !== 'tahrir' || so.kalit !== p[1] || so.holati !== 'Kutilmoqda') continue;
    let j = null; try { j = JSON.parse(s(so.malumot || '')); } catch (e) { }
    if (!j || !j.d || !k.some(z => z in j.d)) continue;
    const f = (j.f || [])[0] || [];
    return { id: so.id, kim: so.kim, vaqt: so.vaqt, sabab: so.sabab, f: s(f[0] || ''), qiymat: s(f[2] || '') }; }
  return null;
}
async function topMalumotTasdiq(args) {
  const [kodSes, id, ha, izoh0] = args;
  const u = await S.ruxsat(kodSes, 'admin');
  if (!(await serverda(u.kod))) return eskiTizim('topMalumotTasdiq', u, args.slice(1));
  const t = (await TP.topRowsYangi(TOP_V)).L.find(z => s(z.id) === s(id)); if (!t) throw new S.Xato('Topshiriq topilmadi.');
  const so = topMlSorov((await QY.sorovlar(SOR_V)).L, t);
  if (!so) throw new S.Xato('Bu topshiriq bo\'yicha kutilayotgan so\'rov yo\'q — ehtimol allaqachon javob berilgan. Sahifani yangilang.');
  const izoh = S1(izoh0);
  let j;
  try { j = await javob(u, kodSes, so.id, !!ha, izoh); }
  catch (e) { if (e.yozilmadi) return eskiTizim('topMalumotTasdiq', u, args.slice(1)); throw e; }
  if (ha) { if (t.holati === 'Jarayonda' || t.holati === 'Tekshiruvda') await TP.topYop(TOP_V, t, 'Bajarildi', so.kim, (so.f || 'Ma\'lumot') + ' kiritildi: ' + so.qiymat + ' (tasdiq: ' + u.fish + ')'); }
  else await G.yoz(env.aksBazaId, [{ varaq: TOP_V, katak: 'G' + t.qator, qiymat: [[(t.izoh ? t.izoh + ' | ' : '') + 'Rad etildi: ' + izoh]] }], env.googleKey);
  await tahrirKozgu(j.t, [SOR_V, TOP_V]);
  return { ok: true, natija: ha ? (j && j.natija ? j.natija : 'Tasdiqlandi.') + ' Topshiriq yopildi.' : 'Rad etildi — xodimga Telegram xabar ketdi, topshiriq unda ochiq qoladi.' };
}

module.exports = { tahrirSaqlash, monSorovYubor, monSorovJavob, topMalumotKirit, topMalumotTasdiq };
module.exports._ichki = { shYangi, mijozYangi, matnKataklar, jurnalYoz, javobYoz, tahrirQollash, topMlSorov, TAHRIR_02, JUR_V, MIJ_V, S4_V };
