// AKS TIZIM — 📝 SHARTNOMA TUZISHNING YOZADIGAN amallari serverda (Kod.gs v9.8 bilan bir xil tekshiruvlar, xato matnlari va kataklar):
//   mijozSaqlash      — yangi mijoz → 02_Mijozlar (G, L, E, F matn; J, K, V sana; Z va AE formulalari yuqoridagi qatordan)
//   shartnomaSaqlash  — sotuv shartnomasi → 03 (A matn, C sana, I foiz, U:AN formulalar, AO:AP «Kiritildi/Kiritdi»), to'lov jadvali → 03b
//                       (B matn, D sana, F «Kumulyativ» — oxirgi sog' formuladan, kumF_), raqam: 27/N (06k loyihasidagi va 03b dagi band raqamlar o'tkaziladi)
//   ijaraSaqlash      — ijara shartnomasi → 04 (A, E matn; B, J, K sana; X:AK formulalar; AL «Kiritildi»)
//   ikkalasidan keyin — o'sha kuni tashrif yozilmagan bo'lsa tashrifAvto_ (01b, server tashrifSaqlash yo'li bilan bir xil)
// Yozish faqat «aks-yozuv-sinov shartnoma» nusxa varaqlarda tekshirgach yoqiladi (Redis: yozuv_yondi:shartnoma).
// Aks holda, yoki robotda yozish huquqi bo'lmasa — avvalgidek eski tizim. Shartnoma PDF (Google Docs shablon) — eski tizimda qoladi.
'use strict';
const crypto = require('crypto');
const S = require('./sessiya');
const V = require('../lib/varaq');
const G = require('../lib/google');
const env = require('../lib/env');
const koprik = require('./koprik');
const tetik = require('../lib/kozgu_tetik');
const { redis } = require('../lib/db');
const K = require('./kassa')._ichki;
const U = require('../lib/undiruv_yordam');
const SH = require('./shartnoma');

const T02 = '02_Mijozlar', T03 = '03_Sotuv_shartnomalar', T03b = '03b_Tolov_jadvali', T04 = '04_Ijara_shartnomalar', T01 = '01_Dokonlar', T06k = '06k_Qayta_tuzish';
const SHARTNOMA_TURLARI = ['Тайёр дўкон (Муддатли тўлов шартномаси)', 'Қурилаётган дўкон (Муддатли тўлов шартномаси)',
  'Тайёр дўкон (100% тўлов шартномаси)', 'Қурилаётган дўкон (100% тўлов шартномаси)'];
const QT_FAOL = ['Loyiha', 'Qaytarildi', 'Tekshiruvda', 'Yozilmoqda'];
// Varaqlarning yozuv shakli: matn ustunlari, sana/son formatlari, yuqoridagi qatordan ko'chiriladigan formula oraliqlari (1-asosli)
const F02 = { matn: [7, 12, 5, 6], sana: { 10: 'dd.MM.yyyy', 11: 'dd.MM.yyyy', 22: 'dd.MM.yyyy' }, son: {}, formula: [[26, 26], [31, 31]] };
const F03 = { matn: [1, 41, 42], sana: { 3: 'dd.MM.yyyy' }, son: { 9: '0%' }, formula: [[21, 40]] };
const F03b = { matn: [2], sana: { 4: 'dd.MM.yyyy' }, son: {}, formula: [] };
const F04 = { matn: [1, 5, 38], sana: { 2: 'dd.MM.yyyy', 10: 'dd.MM.yyyy', 11: 'dd.MM.yyyy' }, son: {}, formula: [[24, 37]] };
const s = v => String(v == null ? '' : v);
const S_ = x => s(x).trim();
function hozir(f) { const d = new Date(Date.now() + 5 * 3600 * 1000), p = n => String(n).padStart(2, '0');
  const dmy = p(d.getUTCDate()) + '.' + p(d.getUTCMonth() + 1) + '.' + d.getUTCFullYear(); return f === 'dmy' ? dmy : dmy + ' ' + p(d.getUTCHours()) + ':' + p(d.getUTCMinutes()); }
const kut = (p, ms) => Promise.race([p, new Promise(r => setTimeout(r, ms))]);
const ds = x => s(x).split('-').reverse().join('.');

// ------------------------------------------------------------------ umumiy
async function qulfBilan(ish) {   // LockService o'rni — 02/03/03b/04 yozuvlari bittadan
  const kalit = 'qulf:shartnoma', belgi = crypto.randomBytes(8).toString('hex'), t0 = Date.now();
  while (!(await redis.set(kalit, belgi, 'PX', 60000, 'NX'))) { if (Date.now() - t0 > 30000) throw new S.Xato('Tizim band — birozdan keyin qayta urinib ko\'ring.'); await new Promise(r => setTimeout(r, 150)); }
  try { return await ish(); } finally { if ((await redis.get(kalit)) === belgi) await redis.del(kalit); }
}
async function serverda() { try { return (await redis.get('yozuv_yondi:shartnoma')) === '1'; } catch (e) { return false; } }
async function eskiTizim(fn, u, args) { const r = await koprik.chaqir(fn, u.kod, args); await tetik.yangilaKut(20000); return r; }
async function ogoh(xab) { try { await redis.lpush('yozuv_ogoh', JSON.stringify(Object.assign({ vaqt: hozir() }, xab))); await redis.ltrim('yozuv_ogoh', 0, 49); } catch (e) { } }
const yozilmadi = e => { if (e instanceof G.RuxsatYoq) e.yozilmadi = true; return e; };

// Qator(lar)ni oxiriga yozish: matn ustunlari «'» bilan (setNumberFormat('@') + setValues o'rni), keyin bitta so'rovda formatlar va formulalar.
// Qaytadi — haqiqiy birinchi qator. Format/formula yozilmasa — xato qaytarilmaydi (qator yozilgan), yozuv_ogoh ga.
function matnBelgi(qator, F) { const q = qator.slice(); F.matn.forEach(u => { if (u - 1 < q.length) { const v = s(q[u - 1]); q[u - 1] = v === '' ? '' : "'" + v; } }); return q; }
async function qatorlarYoz(varaq, n, qatorlar, F, qoshimcha) {
  let r;
  try { r = await G.qatorlarQoshR(env.aksBazaId, varaq, n, qatorlar.map(q => matnBelgi(q, F)), env.googleKey); }
  catch (e) { throw yozilmadi(e); }
  try { await formatla(varaq, r, qatorlar.length, F, qoshimcha); }
  catch (e) { console.error(new Date().toISOString(), varaq, r, 'format/formula yozilmadi:', e.message); await ogoh({ varaq, qator: r, xato: 'format/formula: ' + e.message.slice(0, 200) }); }
  if (r !== n) { console.error(new Date().toISOString(), varaq, ': kutilgan qator ' + n + ', yozildi ' + r); await ogoh({ varaq, qator: r, xato: 'kutilgan qator ' + n + ' — shu orada boshqa yozuv qo\'shilgan' }); }
  return r;
}
async function formatla(varaq, r, nq, F, qoshimcha) {
  const g = await G.gid(env.aksBazaId, varaq, env.googleKey);
  const oraliq = (u1, u2) => ({ sheetId: g, startRowIndex: r - 1, endRowIndex: r - 1 + nq, startColumnIndex: u1 - 1, endColumnIndex: u2 });
  const fmt = (u, f) => ({ repeatCell: { range: oraliq(u, u), cell: { userEnteredFormat: { numberFormat: f } }, fields: 'userEnteredFormat.numberFormat' } });
  const req = F.matn.map(u => fmt(u, { type: 'TEXT', pattern: '@' }))
    .concat(Object.keys(F.sana).map(u => fmt(+u, { type: /H/.test(F.sana[u]) ? 'DATE_TIME' : 'DATE', pattern: F.sana[u] })))
    .concat(Object.keys(F.son).map(u => fmt(+u, { type: /%/.test(F.son[u]) ? 'PERCENT' : 'NUMBER', pattern: F.son[u] })));
  if (r > 2) F.formula.forEach(([a, b]) => req.push({ copyPaste: { source: { sheetId: g, startRowIndex: r - 2, endRowIndex: r - 1, startColumnIndex: a - 1, endColumnIndex: b },
    destination: oraliq(a, b), pasteType: 'PASTE_FORMULA', pasteOrientation: 'NORMAL' } }));
  (qoshimcha || []).forEach(x => req.push(x(g)));
  if (req.length) await G.soralar(env.aksBazaId, req, env.googleKey);
}
// ustunA_oxiri_ va A ustuni (xom) — Google'dan YANGI
async function aUstun(varaq) { const A = await G.ustunOqi(env.aksBazaId, varaq, 'A', env.googleKey); return { last: A.length, A: A.slice(1) }; }

// ------------------------------------------------------------------ 🚶 tashrifAvto_ (v9.0): shartnoma kuni tashrif yozilmagan bo'lsa — oddiy tashrif qatori
async function tashrifAvto(sanaIso, mid, maqsad, kim, izoh) {
  try {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s(sanaIso)); if (!m) return '';
    const R = await G.oraliqOqi(env.aksBazaId, T02, 'A2:S', env.googleKey, 'UNFORMATTED_VALUE');
    const r = R.find(x => x[0] !== '' && x[0] != null && s(x[0]).trim() === s(mid).trim()); if (!r) return '';
    const fish = s(r[2]).replace(/\s+/g, ' ').trim(), tel = s(r[4]).replace(/\D/g, '').slice(-9);
    if (tel.length !== 9) return '';
    const XT = (await V.qatorlar('07_Xodimlar')).map(z => K.telNorm(z.x[5])).filter(Boolean);
    if (XT.indexOf(tel) >= 0) return '';   // xodim — tashrif sifatida sanalmaydi
    const manzil = U.mijozManzil(r.map(v => v == null ? '' : v));
    const sanaStr = m[3] + '.' + m[2] + '.' + m[1], telF = K.telFmt(tel);
    const kalit = 'qulf:j:' + K.T01b, belgi = crypto.randomBytes(8).toString('hex'), t0 = Date.now();
    while (!(await redis.set(kalit, belgi, 'PX', 30000, 'NX'))) { if (Date.now() - t0 > 20000) return ''; await new Promise(z => setTimeout(z, 150)); }   // tryLock(20000)
    try {
      // 📞 faqat telefon murojaati yozilgan bo'lsa — shartnomaga o'zi kelgan, tashrif ham yoziladi (01b Q «Murojaat_turi»)
      let qTayyor = true; try { await K.ustunQTayyor(); } catch (e) { qTayyor = false; }
      const [h, QQ] = await Promise.all([K.jurnalHolat(K.T01b, true), qTayyor ? G.oraliqOqi(env.aksBazaId, K.T01b, 'Q2:Q', env.googleKey) : []]);
      if (h.last >= 2 && h.BD.some((x, j) => x[2] === telF && x[0] === sanaStr && K.turiOf(QQ[j] && QQ[j][0]) === 'Tashrif')) return 'bor';
      await K.jurnalQator(K.T01b, h.last + 1, [h.id, sanaStr, fish, telF, manzil, '', maqsad, izoh, kim, K.hozirDmyHms()], qTayyor ? Object.assign({}, K.F01b, { qosh: { [K.Q01b]: 'Tashrif' } }) : K.F01b);
      tetik.varaqlarYangila([K.T01b]).catch(() => {});
      return 'yozildi';
    } finally { if ((await redis.get(kalit)) === belgi) await redis.del(kalit); }
  } catch (e) { console.log('tashrifAvto: ' + e.message); return ''; }
}

// ------------------------------------------------------------------ 👤 mijoz
async function mijozTekshir(u, d) {
  const fish = s(d.fish).replace(/\s+/g, ' ').trim().toUpperCase();
  let xato = K.ismTekshir(fish, true, !u.admin); if (xato) throw new S.Xato(xato);
  const tel = K.telNorm(d.tel); xato = K.telTekshir(tel); if (xato) throw new S.Xato(xato);
  const tel2 = K.telNorm(d.tel2); if (tel2 && K.telTekshir(tel2)) throw new S.Xato('2-telefon noto\'g\'ri.');
  const pas = s(d.pasport).toUpperCase().replace(/\s/g, '');
  if (!/^[A-Z]{2}\d{7}$/.test(pas)) throw new S.Xato('Pasport AB1234567 ko\'rinishida bo\'lishi kerak.');
  const jsh = s(d.jshshir).replace(/\D/g, '');
  if (jsh && jsh.length !== 14) throw new S.Xato('JSHSHIR 14 raqam bo\'lishi kerak.');
  const v = await G.oraliqOqi(env.aksBazaId, T02, 'A2:L', env.googleKey);
  let m = -1; v.forEach((r, i) => { if (s(r[0]) !== '') m = i; });
  for (const r0 of v.slice(0, m + 1)) { const r = []; for (let k = 0; k < 12; k++) r.push(s(r0[k]));
    if (r[6] && r[6].replace(/\s/g, '') === pas) throw new S.Xato('Bu pasport allaqachon ro\'yxatda: ' + r[2] + ' (ID ' + r[0] + '). Uni ro\'yxatdan tanlang.');
    if (jsh && r[11] && r[11].replace(/\D/g, '') === jsh) throw new S.Xato('Bu JSHSHIR allaqachon ro\'yxatda: ' + r[2] + ' (ID ' + r[0] + ').');
  }
  const ps = d.psana ? ds(d.psana) : '';
  const pm = d.pmuddat ? ds(d.pmuddat) : '';
  if (d.pmuddat && d.pmuddat < V.bugun()) throw new S.Xato('Pasport muddati tugagan — yangi pasport kerak.');
  return { fish, tel, tel2, pas, jsh, ps, pm };
}
function mijozQator(id, u, d, t) {
  return [id, 'Jismoniy', t.fish, '', K.telFmt(t.tel), t.tel2 ? K.telFmt(t.tel2) : '', t.pas, S_(d.iibv), S_(d.iibt), t.ps, t.pm, t.jsh, '',
    S_(d.mv), S_(d.mt), S_(d.mfy), S_(d.kocha), S_(d.uy), S_(d.xon), '', '', hozir('dmy'), u.fish, S_(d.izoh), ''];
}
async function mijozYoz(varaq, u, d, t) {   // yozuv yadrosi (sinov ham shuni ishlatadi)
  const h = await aUstun(varaq);
  let mx = 0; h.A.slice(0, Math.max(0, h.last - 1)).forEach(v => { const n = Number(v) || 0; if (n > mx) mx = n; });
  const id = mx + 1;
  const r = await qatorlarYoz(varaq, h.last + 1, [mijozQator(id, u, d, t)], F02);
  return { id, qator: r };
}
async function mijozSaqlash(args) {
  const [kodSes, d0] = args; const d = d0 || {};
  const u = await S.ruxsat(kodSes, 'shartnoma');
  if (!(await serverda())) return eskiTizim('mijozSaqlash', u, [d0]);
  const t = await mijozTekshir(u, d);
  let yoq = false;
  const w = await qulfBilan(async () => { try { return await mijozYoz(T02, u, d, t); } catch (e) { if (e.yozilmadi) { yoq = true; return null; } throw e; } });
  if (yoq) return eskiTizim('mijozSaqlash', u, [d0]);
  await kut(tetik.varaqlarYangila([T02]).catch(e => console.error('ko\'zgu (mijoz):', e.message)), 15000);
  return { ok: true, id: w.id, fish: t.fish, tel: K.telFmt(t.tel), pasport: t.pas, jshshir: t.jsh };
}

// ------------------------------------------------------------------ 🏬 do'kon (01_Dokonlar, getValues 640×26)
async function dokon(id) {
  const R = await G.oraliqOqi(env.aksBazaId, T01, 'A2:Z641', env.googleKey, 'UNFORMATTED_VALUE');
  const r = R.find(x => x[0] !== '' && x[0] != null && s(x[0]) === s(id)); if (!r) return null;
  const o = []; for (let k = 0; k < 26; k++) o.push(r[k] == null ? '' : r[k]); return o;
}

// ------------------------------------------------------------------ 📝 sotuv shartnomasi
async function shartnomaTekshir(kodSes, d) {
  const mid = Number(d.mijozId); if (!mid) throw new S.Xato('Mijoz tanlanmagan.');
  if (SHARTNOMA_TURLARI.indexOf(d.turi) < 0) throw new S.Xato('Shartnoma turini tanlang.');
  const dr = await dokon(d.dokonId);
  if (!dr) throw new S.Xato('Do\'kon topilmadi.');
  if (dr[17] || s(dr[18]) !== 'SOTILMAGAN') throw new S.Xato('Bu do\'kon allaqachon sotilgan (' + dr[17] + ').');
  d.maydon = Number(dr[5]); d.baza = Number(dr[6]);
  const h = await SH.jadvalHisob([kodSes, d]);
  return { mid, dr, h };
}
// Band raqamlar: 06k (Qayta.gs qtBandRaqamlar_ — faol loyihaning yangi raqami) va 03b da qoldiq jadvali bor raqamlar
async function bandRaqamlar() {
  const band = {};
  try { const R = await G.oraliqOqi(env.aksBazaId, T06k, 'A1:E', env.googleKey);
    if (R.length && s((R[0] || [])[2]) === 'Holati') { let m = -1; R.forEach((r, i) => { if (i && s(r[0]) !== '') m = i; });
      R.slice(1, m + 1).forEach(r => { if (s(r[0]) && QT_FAOL.indexOf(s(r[2])) >= 0) band[s(r[4])] = s(r[0]); }); } }
  catch (e) { if (!/Unable to parse range|topilmadi/i.test(e.message)) throw e; }
  return band;
}
// kumF_: 03b F «Kumulyativ» — yuqoridagi oxirgi SOG' (formulasi bor, #xatosiz) qatordan formula nusxasi
async function kumManba(varaq, row1) {
  const [Fo, Fk] = await Promise.all([G.oraliqOqi(env.aksBazaId, varaq, 'F2:F' + Math.max(2, row1 - 1), env.googleKey, 'FORMULA'), G.oraliqOqi(env.aksBazaId, varaq, 'F2:F' + Math.max(2, row1 - 1), env.googleKey)]);
  for (let src = row1 - 1; src >= 2; src--) { const f = s((Fo[src - 2] || [])[0]), k = s((Fk[src - 2] || [])[0]); if (/^=/.test(f) && !/^#/.test(k)) return src; }
  throw new S.Xato('03b: Kumulyativ formulasini olish uchun sog\' qator topilmadi.');
}
async function shartnomaYoz(v3, v3b, u, d, mid, dr, h) {   // yozuv yadrosi (sinov ham shuni ishlatadi — nusxa varaqlarda)
  const boshl = Math.round(Number(d.boshl) || 0), oy = Math.round(Number(d.oy) || 0);
  const [h3, R3b, band] = await Promise.all([aUstun(v3), G.oraliqOqi(env.aksBazaId, v3b, 'A2:B', env.googleKey, 'UNFORMATTED_VALUE'), bandRaqamlar()]);
  let mx = 0; h3.A.slice(0, Math.max(0, h3.last - 1)).forEach(v => { const mm = /^27\/(\d+)$/.exec(s(v)); if (mm) mx = Math.max(mx, Number(mm[1])); });
  let jl = 1; R3b.forEach((r, i) => { if (r[0] !== '' && r[0] != null) jl = i + 2; });
  const jadR = {}; R3b.slice(0, jl - 1).forEach(r => { jadR[s(r[1]).trim()] = 1; });
  let nn = mx + 1; while (band['27/' + nn] || jadR['27/' + nn]) nn++;
  const no = '27/' + nn;
  const sanaStr = ds(d.sana);
  const q3 = [no, nn, sanaStr, d.turi, mid, s(d.dokonId), Number(dr[5]), h.narx, h.foiz, boshl, Math.round(Number(d.bkun) || 0), oy, oy > 0 ? Math.round(Number(d.tkun)) : '', 'Aktiv', '', '', '', S_(d.undiruvchi), '', S_(d.izoh)];
  for (let i = 21; i <= 40; i++) q3.push(null);   // U:AN — formulalar (copyPaste); null — katakka tegilmaydi
  q3.push(hozir(), u.fish);                         // AO:AP — Kiritildi / Kiritdi (v8.4)
  const r3 = await qatorlarYoz(v3, h3.last + 1, [q3], F03);
  let jid = 0; R3b.slice(0, jl - 1).forEach(r => { const n = Number(r[0]) || 0; if (n > jid) jid = n; });
  const vals = h.jadval.map(j => [++jid, no, j.t, ds(j.sana), j.summa, j.summa, j.turi, 'Web App: ' + u.fish]);
  let r3b;
  try {
    const src = await kumManba(v3b, jl + 1);
    r3b = await qatorlarYoz(v3b, jl + 1, vals, F03b, [g => ({ copyPaste: { source: { sheetId: g, startRowIndex: src - 1, endRowIndex: src, startColumnIndex: 5, endColumnIndex: 6 },
      destination: { sheetId: g, startRowIndex: jl, endRowIndex: jl + vals.length, startColumnIndex: 5, endColumnIndex: 6 }, pasteType: 'PASTE_FORMULA', pasteOrientation: 'NORMAL' } })]);
  } catch (e) {   // 03 qatori yozilgan — xodim qayta saqlab, ikkinchi shartnoma ochib yubormasin
    console.error(new Date().toISOString(), 'shartnoma ' + no + ': 03b yozilmadi:', e.message);
    await ogoh({ varaq: v3b, qator: no, xato: 'shartnoma 03 ga yozildi (qator ' + r3 + '), to\'lov jadvali yozilmadi: ' + e.message.slice(0, 200) });
    throw new S.Xato('Shartnoma ' + no + ' saqlandi, lekin to\'lov jadvali yozilmadi — qayta saqlamang, direktorga ayting.');
  }
  if (r3b !== jl + 1) await ogoh({ varaq: v3b, qator: r3b, xato: 'Kumulyativ formulasi ' + (jl + 1) + '-qatordan yozildi, jadval ' + r3b + '-qatorga tushdi — tekshiring' });
  return { no, qator: r3, jQator: r3b, jSoni: vals.length };
}
async function shartnomaSaqlash(args) {
  const [kodSes, d0] = args; const d = Object.assign({}, d0 || {});
  const u = await S.ruxsat(kodSes, 'shartnoma');
  if (!(await serverda())) return eskiTizim('shartnomaSaqlash', u, [d0]);
  const { mid, dr, h } = await shartnomaTekshir(kodSes, d);
  let yoq = false;
  const w = await qulfBilan(async () => {
    const dr2 = await dokon(d.dokonId);   // qulf ichida qayta — shu orada boshqa xodim sotmadimi
    if (!dr2 || dr2[17] || s(dr2[18]) !== 'SOTILMAGAN') throw new S.Xato('Bu do\'kon allaqachon sotilgan (' + (dr2 ? dr2[17] : '') + ').');
    try { return await shartnomaYoz(T03, T03b, u, d, mid, dr2, h); } catch (e) { if (e.yozilmadi) { yoq = true; return null; } throw e; }
  });
  if (yoq) return eskiTizim('shartnomaSaqlash', u, [d0]);
  const tsh = await tashrifAvto(d.sana, mid, 'Дўкон сотиб олиш масаласида', u.fish, 'Шартнома ' + w.no);   // v9.0
  await kut(tetik.varaqlarYangila([T03, T03b, T01]).catch(e => console.error('ko\'zgu (shartnoma):', e.message)), 15000);
  return { ok: true, no: w.no, qiymat: h.qiymat, narx: h.narx, oylik: h.oylik, sovga: h.sovga, jadval: h.jadval, tashrif: tsh };
}

// ------------------------------------------------------------------ 🔑 ijara shartnomasi
const FAOLIYAT_ASOSI = ['Паспорт', 'Устав', 'Патент', 'Гувоҳнома'];
function utc(x) { const p = s(x).split('-').map(Number); if (p.length !== 3 || !p[0]) throw new S.Xato('Sana noto\'g\'ri: ' + x); return new Date(Date.UTC(p[0], p[1] - 1, p[2])); }
const isoG = dt => dt.toISOString().slice(0, 10);
function oyQosh(dt, n, kun) { const y = dt.getUTCFullYear(), mo = dt.getUTCMonth() + n; const oxiri = new Date(Date.UTC(y, mo + 1, 0)).getUTCDate(); return new Date(Date.UTC(y, mo, Math.min(kun || dt.getUTCDate(), oxiri))); }
async function ijaraTekshir(d) {
  const mid = Number(d.mijozId); if (!mid) throw new S.Xato('Ijarachi tanlanmagan.');
  const dr = await dokon(d.dokonId);
  if (!dr) throw new S.Xato('Do\'kon topilmadi.');
  if (dr[21]) throw new S.Xato('Bu do\'kon allaqachon ijarada: ' + dr[21] + ' (' + dr[22] + ').');
  const sotilgan = s(dr[18]) !== 'SOTILMAGAN';
  const beruvchi = sotilgan ? "Do'kon egasi" : 'MChJ';
  if (sotilgan && s(d.tilxat).trim().length < 3) throw new S.Xato('Do\'kon sotilgan (' + dr[18] + '). Egasining tilxati/ishonchnomasini yozing.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s(d.sana))) throw new S.Xato('Sana noto\'g\'ri.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s(d.boshlanish))) throw new S.Xato('Boshlanish sanasi noto\'g\'ri.');
  const muddat = Math.round(Number(d.muddat) || 0); if (muddat <= 0) throw new S.Xato('Ijara muddati (oy) kiritilmagan.');
  const bepul = Math.round(Number(d.bepul) || 0);
  if (bepul < 1) throw new S.Xato('Bepul davr kamida 1 oy bo\'lishi kerak — bu shartnoma bepul davrli ijara uchun.');
  if (bepul > muddat) throw new S.Xato('Bepul davr umumiy muddatdan katta bo\'lolmaydi.');
  const oylik = Math.round(Number(s(d.oylik).replace(/\D/g, '')) || 0);
  const m2 = Math.round(Number(s(d.m2).replace(/\D/g, '')) || 0);
  const oylikS = oylik || (m2 ? Math.round(m2 * Number(dr[5])) : 0);   // 0 = bepul ijara (ruxsat etiladi)
  if (oylikS > 0 && muddat <= bepul) throw new S.Xato('Pullik ijara uchun umumiy muddat bepul davrdan katta bo\'lishi kerak (masalan 12 oy, shundan 6 oy bepul).');
  if (oylikS > 50000000) throw new S.Xato('Oylik ijara haqi juda katta (' + oylikS.toLocaleString('ru-RU') + ') — tekshiring.');
  if (!d.faoliyat) throw new S.Xato('Faoliyat turini tanlang.');
  const tkun = Math.round(Number(d.tkun) || 1);
  const tug = oyQosh(utc(d.boshlanish), muddat, utc(d.boshlanish).getUTCDate());
  return { mid, dr, sotilgan, beruvchi, muddat, bepul, m2, oylikS, tkun, tug };
}
async function ijaraYoz(v4, u, d, t) {   // yozuv yadrosi (sinov ham shuni ishlatadi)
  const h4 = await aUstun(v4);
  let mx = 99; h4.A.slice(0, Math.max(0, h4.last - 1)).forEach(v => { const mm = /^IJ-27\/(\d+)$/.exec(s(v)); if (mm) mx = Math.max(mx, Number(mm[1])); });
  const no = 'IJ-27/' + (mx + 1);
  const q = [no, ds(d.sana), 'Aktiv', '', s(d.dokonId), t.mid, t.beruvchi, t.sotilgan ? S_(d.tilxat) : '', S_(d.asos) || 'Паспорт',
    ds(d.boshlanish), ds(isoG(t.tug)), t.muddat, t.bepul, t.m2 || '', t.oylikS, t.tkun, Math.round(Number(s(d.garov).replace(/\D/g, '')) || 0) || '', S_(d.kommunal),
    s(d.faoliyat), S_(d.savdo) || 'Ишлаяпти', u.fish, '', S_(d.izoh)];
  for (let i = 24; i <= 37; i++) q.push(null);   // X:AK — formulalar
  q.push(hozir());                                // AL — Kiritildi (v8.4)
  const r = await qatorlarYoz(v4, h4.last + 1, [q], F04);
  return { no, qator: r };
}
async function ijaraSaqlash(args) {
  const [kodSes, d0] = args; const d = d0 || {};
  const u = await S.ruxsat(kodSes, 'shartnoma');
  if (!(await serverda())) return eskiTizim('ijaraSaqlash', u, [d0]);
  const t = await ijaraTekshir(d);
  let yoq = false;
  const w = await qulfBilan(async () => {
    const dr2 = await dokon(d.dokonId);
    if (dr2 && dr2[21]) throw new S.Xato('Bu do\'kon allaqachon ijarada: ' + dr2[21] + ' (' + dr2[22] + ').');
    try { return await ijaraYoz(T04, u, d, t); } catch (e) { if (e.yozilmadi) { yoq = true; return null; } throw e; }
  });
  if (yoq) return eskiTizim('ijaraSaqlash', u, [d0]);
  const tsh = await tashrifAvto(d.sana, t.mid, 'Ижарага туриш масаласида', u.fish, 'Шартнома ' + w.no);   // v9.0
  await kut(tetik.varaqlarYangila([T04, T01]).catch(e => console.error('ko\'zgu (ijara):', e.message)), 15000);
  return { ok: true, no: w.no, beruvchi: t.beruvchi, oylik: t.oylikS, tugash: isoG(t.tug), egasi: t.sotilgan ? s(t.dr[18]) : '', tashrif: tsh };
}

module.exports = { mijozSaqlash, shartnomaSaqlash, ijaraSaqlash };
module.exports._ichki = { mijozTekshir, mijozYoz, shartnomaTekshir, shartnomaYoz, ijaraTekshir, ijaraYoz, tashrifAvto, bandRaqamlar, kumManba, dokon, matnBelgi, qatorlarYoz, formatla, aUstun, ogoh, F02, F03, F03b, F04, T02, T03, T03b, T04 };
