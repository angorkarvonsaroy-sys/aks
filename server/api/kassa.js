// AKS TIZIM — 💵 to'lov va 🚶 tashrif bo'limlari serverda (Kod.gs v9.7 bilan bir xil tekshiruvlar, xato matnlari, kataklar va formatlar):
//   tashrifTekshir · bugungiTashriflar — o'qish (ko'zgudan)
//   tashrifSaqlash · tolovSaqlash     — server Google jadvalga O'ZI yozadi (robot «Редактор»)
// Yozish faqat «aks-yozuv-sinov» tekshiruvdan o'tgach yoqiladi (Redis: yozuv_yondi:tolov / yozuv_yondi:tashrif). Yoqilmagan bo'lsa,
// yoki robotda yozish huquqi bo'lmasa — amal avvalgidek eski tizim orqali bajariladi.
// Qator qo'shish Google'ning «append» usuli bilan: shu orada eski tizim ham shu varaqqa qator qo'shsa — ustma-ust tushmaydi;
// yozuvdan 10 va 60 soniya keyin qator yana tekshiriladi (o'zgarib qolsa — «yozuv_ogoh» ro'yxatiga, aks-holat ko'rsatadi).
'use strict';
const crypto = require('crypto');
const S = require('./sessiya');
const V = require('../lib/varaq');
const G = require('../lib/google');
const env = require('../lib/env');
const koprik = require('./koprik');
const tetik = require('../lib/kozgu_tetik');
const { redis } = require('../lib/db');

const T05 = '05_Tolovlar', T01b = '01b_Tashrif_jurnali', T03 = '03_Sotuv_shartnomalar', T07 = '07_Xodimlar';
const SHAKLLAR = ['Naqt', 'Bank', 'Plastik', 'Barter'];
const MAQSADLAR = ['Дўкон сотиб олиш масаласида', 'Кредитга дўкон олиш масаласида', 'Ижарага туриш масаласида',
  'Ижарани бекор қилиш масаласида', 'Сотув шартномани бекор қилиш масаласида', 'Бошқа масалада'];
const SOXTA_ISMLAR = ['ali', 'vali', "g'ani", 'gani', 'falonchi', 'pistonchi', 'test', 'тест', 'фалончи', 'мижоз', 'mijoz',
  'номаълум', 'nomalum', "noma'lum", 'али', 'вали', 'ғани', 'гани', 'xxx', 'ххх', 'asd', 'qwe'];
// Ustunlar (1 dan): matn («@»), sana formatlari, formula nusxasi (yuqoridagi qatordan, PASTE_FORMULA) — Kod.gs dagidek
const F05 = { matn: [3, 6], sana: { 2: 'dd.MM.yyyy', 11: 'dd.MM.yyyy HH:mm:ss' }, formula: [13, 15], belgi: 3 };
const F01b = { matn: [4], sana: { 2: 'dd.MM.yyyy', 10: 'dd.MM.yyyy HH:mm:ss' }, formula: [11, 16], belgi: 3 };

const s = v => String(v == null ? '' : v);
function aOxiri(rows) { let m = 0; rows.forEach(({ n, x }) => { if (x[0] !== null && x[0] !== undefined && x[0] !== '') m = n; }); return rows.filter(z => z.n <= m); }
const kor = (r, n) => { const o = []; for (let i = 0; i < n; i++) o.push(r[i] == null ? '' : String(r[i])); return o; };
function oraliq(rows, bosh, soni) { const M = {}; rows.forEach(z => { M[z.n] = z; }); const o = []; for (let n = bosh; n < bosh + soni; n++) o.push(M[n] || { n, x: [], r: [] }); return o; }
const dmy = iso => iso.split('-').reverse().join('.');
function hozirDmyHms() { const d = new Date(Date.now() + 5 * 3600 * 1000), p = n => String(n).padStart(2, '0');
  return p(d.getUTCDate()) + '.' + p(d.getUTCMonth() + 1) + '.' + d.getUTCFullYear() + ' ' + p(d.getUTCHours()) + ':' + p(d.getUTCMinutes()) + ':' + p(d.getUTCSeconds()); }
const num = x => { const n = Number(x); return isNaN(n) ? 0 : Math.round(n); };   // Kod.gs num_

// ------------------------------------------------------------------ Kod.gs: telefon va ism tekshiruvlari (o'zgarishsiz)
function telNorm(t) { let d = String(t || '').replace(/\D/g, ''); if (d.length === 12 && d.indexOf('998') === 0) d = d.slice(3); return d; }
function telFmt(d) { return d.length === 9 ? d.slice(0, 2) + ' ' + d.slice(2, 5) + ' ' + d.slice(5, 7) + ' ' + d.slice(7) : d; }
function telTekshir(d) {
  if (d.length !== 9) return 'Telefon raqami 9 xonali bo\'lishi kerak (masalan 99 594 44 74).';
  if (!/^(20|33|50|55|61|62|65|66|67|69|70|71|72|73|74|75|76|77|78|79|87|88|90|91|93|94|95|97|98|99)/.test(d)) return 'Telefon operator kodi noto\'g\'ri: ' + d.slice(0, 2);
  if (/^(\d)\1+$/.test(d.slice(2))) return 'Telefon raqami soxta ko\'rinadi.';
  return '';
}
function ismTekshir(fish, toliq, lotin) {
  const t = String(fish || '').replace(/\s+/g, ' ').trim();
  const soz = t.split(' ');
  if (lotin && /[Ѐ-ӿ]/.test(t)) return 'F.I.Sh. ni PASPORTDAGIDEK LOTIN harflarida yozing (kirill harflari bor). Chet el pasporti bo\'lsa — direktor kiritadi.';
  if (soz.length < 2) return 'Familiya va ismni to\'liq yozing (kamida 2 so\'z).';
  if (toliq && soz.length < 3) return 'F.I.Sh. ni pasportdagidek TO\'LIQ yozing: familiya, ism va otasining ismi (kamida 3 so\'z). Hozir ' + soz.length + ' so\'z.';
  const unli = /[aeiouyаеёиоуыэюяўAEIOUYАЕЁИОУЫЭЮЯЎ]/;
  for (const w of soz) {
    const toza = w.replace(/[ʻʼ'`’\-.]/g, '');
    if (!/^[A-Za-zА-Яа-яЁёЎўҚқҒғҲҳ]+$/.test(toza)) return 'Ismda faqat harflar bo\'lishi kerak: «' + w + '»';
    if (toza.length < 2) return 'Juda qisqa so\'z: «' + w + '» — to\'liq yozing.';
    if (toza.length >= 3 && !unli.test(toza)) return 'Tushunarsiz so\'z: «' + w + '» — haqiqiy ism yozing.';
    if (/(.)\1\1/.test(toza.toLowerCase())) return 'Tushunarsiz so\'z: «' + w + '»';
    if (SOXTA_ISMLAR.indexOf(toza.toLowerCase()) >= 0) return '«' + w + '» — haqiqiy ism emas.';
  }
  return '';
}
// xodimTellari_: 07_Xodimlar F ustuni (getValues) → telNorm_
async function xodimTellari() { return (await V.qatorlar(T07)).map(z => telNorm(z.x[5])).filter(Boolean); }

// ------------------------------------------------------------------ umumiy: qulf, yoqilganmi, eski tizim, jurnal qatori
async function qulfBilan(nom, ish) {
  const kalit = 'qulf:' + nom, belgi = crypto.randomBytes(8).toString('hex'), t0 = Date.now();
  while (!(await redis.set(kalit, belgi, 'PX', 30000, 'NX'))) { if (Date.now() - t0 > 20000) throw new S.Xato('Tizim band — birozdan keyin qayta urinib ko\'ring.'); await new Promise(r => setTimeout(r, 150)); }
  try { return await ish(); } finally { if ((await redis.get(kalit)) === belgi) await redis.del(kalit); }
}
async function yoqilgan(nom) { try { return (await redis.get('yozuv_yondi:' + nom)) === '1'; } catch (e) { return false; } }
async function eskiTizim(fn, u, args) { const r = await koprik.chaqir(fn, u.kod, args); await tetik.yangilaKut(20000); return r; }
const kut = (p, ms) => Promise.race([p, new Promise(r => setTimeout(r, ms))]);

// Varaq holati — Google'dan YANGI: A ustunidagi oxirgi to'ldirilgan qator (ustunA_oxiri_), keyingi ID (max+1), kerak bo'lsa B:D ko'rinishi
async function jurnalHolat(varaq, bdKerak) {
  const [A, BD] = await Promise.all([G.ustunOqi(env.aksBazaId, varaq, 'A', env.googleKey), bdKerak ? G.oraliqOqi(env.aksBazaId, varaq, 'B2:D', env.googleKey) : null]);
  const last = A.length;
  const ids = last >= 2 ? A.slice(1, last).map(v => Number(v) || 0) : [0];
  let mx = -Infinity; for (const v of ids) if (v > mx) mx = v;
  return { last, id: mx + 1, BD: BD ? BD.slice(0, Math.max(0, last - 1)).map(r => [s(r[0]), s(r[1]), s(r[2])]) : null };
}
// Jurnal oxiriga qator: qiymatlar USER_ENTERED (Apps Script setValues bilan bir xil talqin), matn ustunlari «'» bilan (sana bo'lib qolmasin),
// keyin bitta so'rovda: matn / sana formatlari va formula ustunlari yuqoridagi qatordan. Qaytadi — haqiqiy qator raqami.
function matnBelgi(qator, F) { const q = qator.slice(); F.matn.forEach(u => { const v = s(q[u - 1]); q[u - 1] = v === '' ? '' : "'" + v; }); return q; }
async function jurnalQator(varaq, n, qator, F) {
  const q = matnBelgi(qator, F);
  let r;
  try { r = await G.qatorQoshR(env.aksBazaId, varaq, n, q, env.googleKey); }
  catch (e) { if (e instanceof G.RuxsatYoq) e.yozilmadi = true; throw e; }   // qator yozilmadi — chaqiruvchi eski tizimga o'tkazishi mumkin
  try { await jurnalFormat(varaq, r, F); }
  catch (e) {   // qator yozilgan — xato qaytarilmaydi (aks holda xodim qayta kiritib, ikki marta yozilib qolardi); format keyin tuzatiladi
    console.error(new Date().toISOString(), varaq, r, 'format/formula yozilmadi:', e.message);
    await redis.lpush('yozuv_ogoh', JSON.stringify({ vaqt: hozirDmyHms(), varaq, qator: r, xato: 'format/formula: ' + e.message.slice(0, 200) })).catch(() => {});
  }
  if (r !== n) console.error(new Date().toISOString(), varaq, ': kutilgan qator ' + n + ', yozildi ' + r + ' (shu orada boshqa yozuv qo\'shilgan)');
  return r;
}
async function jurnalFormat(varaq, r, F) {
  const g = await G.gid(env.aksBazaId, varaq, env.googleKey);
  const katak = (u, f) => ({ repeatCell: { range: { sheetId: g, startRowIndex: r - 1, endRowIndex: r, startColumnIndex: u - 1, endColumnIndex: u }, cell: { userEnteredFormat: { numberFormat: f } }, fields: 'userEnteredFormat.numberFormat' } });
  const req = F.matn.map(u => katak(u, { type: 'TEXT', pattern: '@' }))
    .concat(Object.keys(F.sana).map(u => katak(+u, { type: /H/.test(F.sana[u]) ? 'DATE_TIME' : 'DATE', pattern: F.sana[u] })));
  if (r > 2 && F.formula) req.push({ copyPaste: { source: { sheetId: g, startRowIndex: r - 2, endRowIndex: r - 1, startColumnIndex: F.formula[0] - 1, endColumnIndex: F.formula[1] },
    destination: { sheetId: g, startRowIndex: r - 1, endRowIndex: r, startColumnIndex: F.formula[0] - 1, endColumnIndex: F.formula[1] }, pasteType: 'PASTE_FORMULA', pasteOrientation: 'NORMAL' } });
  await G.soralar(env.aksBazaId, req, env.googleKey);
}
// Yozuvdan keyin qator joyida turganini tekshirish (eski tizim shu qatorga ustidan yozib yubormaganmi)
function keyinTekshir(varaq, r, id, F, qiymat) {
  for (const ms of [10000, 60000]) {
    const t = setTimeout(async () => {
      try {
        const x = await G.qatorOqi(env.aksBazaId, varaq, r, 'L', env.googleKey);
        if (Number(x[0]) === id && s(x[F.belgi - 1]) === s(qiymat)) return;
        const xab = { vaqt: hozirDmyHms(), varaq, qator: r, id, kutilgan: s(qiymat), topildi: s(x[0]) + ' / ' + s(x[F.belgi - 1]) };
        console.error('YOZUV TO\'QNASHUVI:', JSON.stringify(xab));
        await redis.lpush('yozuv_ogoh', JSON.stringify(xab)); await redis.ltrim('yozuv_ogoh', 0, 49);
      } catch (e) { console.error('yozuv tekshiruvi (' + varaq + '):', e.message); }
    }, ms);
    if (t.unref) t.unref();
  }
}

// ================================================================== 🚶 TASHRIF
async function tashrifTekshir([kodSes, tel]) {
  const u = await S.ruxsat(kodSes, 'tashrif');
  const d = telNorm(tel);
  const xato = telTekshir(d);
  if (xato) return { xato };
  if ((await xodimTellari()).indexOf(d) >= 0) return { xato: 'Bu — xodimning telefon raqami. Mijoz sifatida yozib bo\'lmaydi.' };
  const f = telFmt(d);
  const [R1b, R2] = await Promise.all([V.qatorlar(T01b), V.qatorlar('02_Mijozlar')]);
  const bugun = dmy(V.bugun());
  let oldingi = null, soni = 0, bugunBor = '';
  const L = aOxiri(R1b);
  if (L.length) for (const z of oraliq(L, 2, L[L.length - 1].n - 1)) {
    const r = kor(z.r, 7);
    if (r[3] !== f) continue;
    soni++;
    oldingi = { fish: r[2], manzil: r[4], kasb: r[5], sana: r[1] };
    if (r[1] === bugun) bugunBor = r[2] + ' — ' + r[6];
  }
  let mijoz = null;
  const M = aOxiri(R2);
  if (M.length) for (const z of oraliq(M, 2, M[M.length - 1].n - 1)) { const r = kor(z.r, 6); if (r[4] === f || r[5] === f) { mijoz = { id: r[0], fish: r[2] }; break; } }
  if (mijoz) {   // holati bo'yicha: faqat yashirin shartnomalari bor mijoz ko'rsatilmaydi (undiruvchi/yurist — shartnomasiz mijozni ham ko'rmaydi)
    const KR = require('../lib/korinish'), Y = await KR.yopiqlar(u), ch = Y.size && (await KR.korish(u)).cheklangan;
    if (Y.size) { const L = []; (await V.qatorlar(T03)).forEach(({ x }) => { if (String(x[4] == null ? '' : x[4]).trim() === String(mijoz.id).trim() && x[0]) L.push(String(x[0]).trim()); });
      (await V.qatorlar('04_Ijara_shartnomalar')).forEach(({ x }) => { if (String(x[5] == null ? '' : x[5]).trim() === String(mijoz.id).trim() && x[0]) L.push(String(x[0]).trim()); });
      if ((L.length || ch) && L.every(no => Y.has(no))) mijoz = null; }
  }
  return { tel: f, soni, oldingi, bugunBor, mijoz };
}

async function bugungiTashriflar([kodSes]) {
  const u = await S.ruxsat(kodSes, 'tashrif');
  const R = aOxiri(await V.qatorlar(T01b));
  if (!R.length) return { royxat: [] };
  const last = R[R.length - 1].n;
  if (last < 2) return { royxat: [] };
  const bugun = dmy(V.bugun());
  const from = Math.max(2, last - 300);
  const v = oraliq(R, from, last - from + 1).map(z => kor(z.r, 10));
  const royxat = v.filter(r => r[1] === bugun && (u.admin || r[8] === u.fish))
    .map(r => ({ fish: r[2], tel: r[3], maqsad: r[6], kim: r[8], vaqt: String(r[9]).slice(11, 16) }));
  return { royxat: royxat.reverse() };
}

async function tashrifSaqlash(args) {
  const [kodSes, d0] = args; const d = d0 || {};
  const u = await S.ruxsat(kodSes, 'tashrif');
  if (!(await yoqilgan('tashrif'))) return eskiTizim('tashrifSaqlash', u, [d0]);
  const tel = telNorm(d.tel);
  let xato = telTekshir(tel); if (xato) throw new S.Xato(xato);
  if ((await xodimTellari()).indexOf(tel) >= 0) throw new S.Xato('Bu — xodimning telefon raqami.');
  const fish = String(d.fish || '').replace(/\s+/g, ' ').trim();
  xato = ismTekshir(fish); if (xato) throw new S.Xato(xato);
  const maqsad = String(d.maqsad || '');
  if (MAQSADLAR.indexOf(maqsad) < 0) throw new S.Xato('Tashrif maqsadini tanlang.');
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(d.sana || ''));
  if (!m) throw new S.Xato('Sana noto\'g\'ri.');
  const bugunISO = V.bugun();
  if (d.sana > bugunISO) throw new S.Xato('Kelajak sanasi bo\'lmaydi.');
  const farq = (new Date(bugunISO) - new Date(d.sana)) / 86400000;
  if (farq > 1 && !u.admin) throw new S.Xato('Tashrif faqat bugun yoki kecha uchun kiritiladi.');
  const sanaStr = m[3] + '.' + m[2] + '.' + m[1];
  const telF = telFmt(tel);
  let yoq = false;
  const w = await qulfBilan('j:' + T01b, async () => {
    const h = await jurnalHolat(T01b, true);
    if (h.last >= 2) { const bor = h.BD.find(r => r[2] === telF && r[0] === sanaStr);
      if (bor) throw new S.Xato('Bu odam (' + bor[1] + ') shu kuni allaqachon yozilgan. Bir kunda bir odam bir marta yoziladi — boshqa maqsadini izohga yozing.'); }
    const qator = [h.id, sanaStr, fish, telF, String(d.manzil || '').trim(), String(d.kasb || '').trim(), maqsad, String(d.izoh || '').trim(), u.fish, hozirDmyHms()];
    try { return { r: await jurnalQator(T01b, h.last + 1, qator, F01b), id: h.id }; }
    catch (e) { if (e.yozilmadi) { yoq = true; return null; } throw e; }
  });
  if (yoq) return eskiTizim('tashrifSaqlash', u, [d0]);   // robotda yozish huquqi yo'q — hech narsa yozilmagan
  keyinTekshir(T01b, w.r, w.id, F01b, fish);
  await kut(tetik.varaqlarYangila([T01b]).catch(e => console.error('ko\'zgu (tashrif):', e.message)), 15000);
  return { ok: true, fish, tel: telF, maqsad, sana: sanaStr };
}

// ================================================================== 💵 TO'LOV
// Yozuvdan keyingi qarz — 03 dagi formulalar qayta hisoblangan qiymat (Google'dan to'g'ridan-to'g'ri, shu shartnoma qatori)
async function qarzOl(no) {
  try {
    const z = (await V.qatorlar(T03)).find(q => s(q.x[0]) === no); if (!z) return null;
    const r = await G.qatorOqi(env.aksBazaId, T03, z.n, 'AF', env.googleKey);
    return s(r[0]) === no ? { qarz: num(r[30]), muddati: num(r[31]) } : null;
  } catch (e) { console.error('qarz (03):', e.message); return null; }
}

async function tolovSaqlash(args) {
  const [kodSes, d0] = args; const d = d0 || {};
  const u = await S.ruxsat(kodSes, 'tolov');
  if (!(await yoqilgan('tolov'))) return eskiTizim('tolovSaqlash', u, [d0]);
  const shartnomalar = require('./direktor').shartnomalar;
  const no = String(d.no || '').trim();
  const sn = (await shartnomalar([kodSes])).find(x => x.no === no);
  if (!sn) throw new S.Xato('Shartnoma topilmadi: ' + no);
  if (sn.holati === 'Bekor qilindi' && !u.admin) throw new S.Xato('Bu shartnoma bekor qilingan. To\'lovni faqat direktor kirita oladi.');
  const summa = Math.round(Number(String(d.summa || '').replace(/[^\d]/g, '')));
  if (!summa || summa <= 0) throw new S.Xato('Summa noto\'g\'ri.');
  if (summa > 5000000000) throw new S.Xato('Summa juda katta — tekshiring.');
  const shakl = String(d.shakl || '');
  if (!SHAKLLAR.includes(shakl)) throw new S.Xato('To\'lov turini tanlang.');
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(d.sana || ''));
  if (!m) throw new S.Xato('Sana noto\'g\'ri.');
  const sanaStr = m[3] + '.' + m[2] + '.' + m[1];
  const bugun = V.bugun();
  if (d.sana > bugun) throw new S.Xato('Kelajak sanasiga to\'lov kiritib bo\'lmaydi.');
  const kunFarq = (new Date(bugun) - new Date(d.sana)) / 86400000;
  if (kunFarq > 7 && !u.admin) throw new S.Xato('7 kundan eski to\'lovni faqat direktor kirita oladi.');
  const hujjat = String(d.hujjat || '').trim();
  const izoh = String(d.izoh || '').trim();
  const maqsad = String(d.maqsad || '').trim();
  if (shakl === 'Bank' && !hujjat) throw new S.Xato('Bank to\'lovi uchun to\'lov topshiriqnomasi raqami majburiy.');
  if (shakl === 'Barter' && izoh.length < 5) throw new S.Xato('Barter uchun nima olinganini izohda yozing.');
  let yoq = false;
  const w = await qulfBilan('j:' + T05, async () => {
    const h = await jurnalHolat(T05, !d.takrorTasdiq);
    if (h.last >= 2 && !d.takrorTasdiq) {   // takror himoyasi
      const bor = h.BD.some(r => r[1] === no && r[0] === sanaStr && Number(r[2].replace(/[^\d]/g, '')) === summa);
      if (bor) return { takror: true, xabar: 'Bu shartnomaga shu kuni aynan shu summa allaqachon kiritilgan. Rostdan ham ikkinchi to\'lovmi?' };
    }
    const qator = [h.id, sanaStr, no, summa, shakl, hujjat, maqsad, '', '', u.fish, hozirDmyHms(), izoh];
    try { return { r: await jurnalQator(T05, h.last + 1, qator, F05), id: h.id }; }
    catch (e) { if (e.yozilmadi) { yoq = true; return null; } throw e; }
  });
  if (yoq) return eskiTizim('tolovSaqlash', u, [d0]);   // robotda yozish huquqi yo'q — hech narsa yozilmagan
  if (w.takror) return w;
  keyinTekshir(T05, w.r, w.id, F05, no);
  const [, q] = await Promise.all([kut(tetik.varaqlarYangila([T05, T03]).catch(e => console.error('ko\'zgu (to\'lov):', e.message)), 15000), qarzOl(no)]);
  let yangi = q;
  if (!yangi) { const x = (await shartnomalar([kodSes])).find(z => z.no === no); yangi = x ? { qarz: x.qarz, muddati: x.muddati } : null; }
  return { ok: true, no, fish: sn.fish, summa, shakl, sana: sanaStr, qarz: yangi ? yangi.qarz : null, muddati: yangi ? yangi.muddati : null };
}

module.exports = { tashrifTekshir, bugungiTashriflar, tashrifSaqlash, tolovSaqlash };
module.exports._ichki = { jurnalHolat, jurnalQator, jurnalFormat, matnBelgi, hozirDmyHms, F05, F01b, T05, T01b, telNorm, telFmt, telTekshir, ismTekshir };
