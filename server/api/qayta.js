// AKS TIZIM — 🔁 SOTUV SHARTNOMASINI QAYTA TUZISH (Qayta.gs v2.3) — serverdagi qismi.
// 1-bosqich (21.10.2026): o'qishlar — qaytaKor (direktor: oynani ochish), qaytaOchiq (loyiha: direktor yoki ijrochi);
//   yozuvlar — qaytaSkan (imzolangan skan → 06d + 06k), qaytaTekshiruvga (ijrochi), qaytaQaytar (direktor).
//   Eski tizimda qoladi (hozircha): qaytaLoyiha, qaytaIjrochi, qaytaHujjatlar (Google Docs shablonlari → 4 ta PDF), qaytaTasdiq (03/03b/05 yozuvi),
//   qaytaBekor (Drive papkasini savatga).
// Eski kod bilan bir xil: tekshiruvlar tartibi, xato matnlari, javob, kataklar. 06k — yozuvdan oldin Google'dan YANGI o'qiladi.
// Farq (yakuniy holat bir xil): eski qaytaSkan avval eski skanni Drive'da «_BEKOR» papkaga ko'chirib, yangi yuklash muvaffaqiyatsiz bo'lsa qaytarardi;
//   server 06d da avval «Bekor» belgilaydi (yangi skan takror tekshiruvidan o'tishi uchun), Drive faylini esa faqat yangi skan yozilgach ko'chiradi
//   (muvaffaqiyatsiz bo'lsa 06d qaytariladi, Drive'ga tegilmaydi). Skan avval serverga (SRV:), Drive'ga — fonda (hujjatYukla kabi).
// Yoqilishi: Redis yozuv_yondi:qayta («aks-yozuv-sinov qayta» — o'qishlar eski tizim bilan solishtiriladi, 06k nusxasida yozuv);
//   yozuvlar uchun yana Koprik ≥ 1.6 (koprikHujjatBekorFayl, koprikTgYubor, koprikTgChat). Aks holda — eski tizim (o'qishlar ham).
'use strict';
const crypto = require('crypto');
const { verOk } = require('../lib/versiya');
const S = require('./sessiya');
const V = require('../lib/varaq');
const J = require('../lib/jurnallar');
const G = require('../lib/google');
const env = require('../lib/env');
const koprik = require('./koprik');
const tetik = require('../lib/kozgu_tetik');
const { redis } = require('../lib/db');
const TP = require('./topshiriq_yoz')._ichki;
const HY = require('./hujjat_yoz')._ichki;
const QH = require('./qadam_hujjat')._ichki;

const QT_VARAQ = '06k_Qayta_tuzish', HUJ = '06d_Hujjatlar', TOP_V = TP.TOP_V;
const QT_N = 31;
const QT_FAOL = ['Loyiha', 'Qaytarildi', 'Tekshiruvda', 'Yozilmoqda'];
const QT_HUJ = [['ariza', 'XAT_KIRUVCHI', 'Ариза', 'eski'], ['kelishuv', 'QOSHIMCHA_KELISHUV', 'Бекор қилиш тўғрисидаги келишув', 'eski'],
  ['solishtirma', 'DALOLATNOMA', 'Солиштирма далолатнома', 'eski'], ['shartnoma', 'SHARTNOMA', 'Янги шартнома', 'yangi']];
const QT_SKAN_UST = { ariza: 22, kelishuv: 23, solishtirma: 24, shartnoma: 25 };
const QT_TUR_MUDDATLI = ['Тайёр дўкон (Муддатли тўлов шартномаси)', 'Қурилаётган дўкон (Муддатли тўлов шартномаси)'];
const QT_SABAB = 'Шартномада белгиланган тўлов жадвалига риоя қилишда томонимдан кечикишларга йўл қўйилганини тан оламан ва тўловларни янги жадвал асосида давом эттиришни хоҳлайман.';
const QT_NOMI = {
  'Тайёр дўкон (Муддатли тўлов шартномаси)': ['Дўконни муддатли тўлов ёки банк кредити асосида сотиб олиш бўйича дастлабки олди-сотди шартномаси', 'Дўконни муддатли тўлов ёки банк кредити асосида сотиб олиш бўйича олди-сотди шартномаси'],
  'Қурилаётган дўкон (Муддатли тўлов шартномаси)': ['Дўкон қурилишига инвестиция киритиш ва келгусида олди-сотди қилиш бўйича дастлабки шартнома', 'Дўкон қурилишига инвестиция киритиш ва келгусида олди-сотди қилиш бўйича дастлабки шартнома'],
  'Тайёр дўкон (100% тўлов шартномаси)': ['Дўконни сотиб олиш бўйича дастлабки олди-сотди шартнома', ''],
  'Қурилаётган дўкон (100% тўлов шартномаси)': ['Дўконни сотиб олиш бўйича дастлабки олди-сотди шартнома', '']
};
const YU_FAOL = ['Faol', 'Kelishuv', "Yopish so'ralgan"];
const BEKOR_YOPIQ = ['Bekor qilindi', 'Rad etildi', 'Qaytarildi'];
const HUJJAT_MAX_MB = 25;

const s = v => String(v == null ? '' : v);
const son = v => Number(s(v).replace(/[^\d.-]/g, '')) || 0;
const qtDmy = iso => iso ? s(iso).split('-').reverse().join('.') : '';
const qtIsoD = dmy => { const p = s(dmy).split('.'); return p.length === 3 ? p[2] + '-' + p[1] + '-' + p[0] : ''; };
const qtIso = v => typeof v === 'number' ? V.iso(v) : '';   // qtIso_: faqat Date (getValues) — matn sana bo'lsa ''
const qtFmt = n => Math.round(Number(n) || 0).toLocaleString('ru-RU').replace(/ /g, ' ').replace(/,/g, ' ');
function qtOyQosh(iso, n, kun) {
  const p = iso.split('-').map(Number); const y = p[0], m = p[1] - 1 + n;
  const oxir = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  return new Date(Date.UTC(y, m, Math.min(kun, oxir))).toISOString().slice(0, 10);
}
function qtJadval(qolgan, oy, birinchiIso, kun) {
  const asos = Math.floor(qolgan / oy); const L = [];
  for (let i = 0; i < oy; i++) L.push({ t: i + 1, sana: qtOyQosh(birinchiIso, i, kun), summa: i === oy - 1 ? qolgan - asos * (oy - 1) : asos });
  return L;
}
function hozirHm() { const d = new Date(Date.now() + 5 * 3600 * 1000), p = n => String(n).padStart(2, '0'); return p(d.getUTCDate()) + '.' + p(d.getUTCMonth() + 1) + '.' + d.getUTCFullYear() + ' ' + p(d.getUTCHours()) + ':' + p(d.getUTCMinutes()); }
// ustunA_oxiri_: ko'zgu qatorlari — A ustunidagi oxirgi to'ldirilgan qatorgacha
function aOxiri(R) { let m = -1; R.forEach((z, i) => { if (z.x[0] !== '' && z.x[0] !== null && z.x[0] !== undefined) m = i; }); return R.slice(0, m + 1); }

// ------------------------------------------------------------------ o'qish yordamchilari
async function qtRows() {   // qtRows_ — Google'dan YANGI (getDisplayValues)
  const R = await G.oraliqOqi(env.aksBazaId, QT_VARAQ, 'A1:AE', env.googleKey).catch(e => { if (/Unable to parse range|not found/i.test(e.message)) return []; throw e; });
  if (!R.length || s(R[0][2]) !== 'Holati') return [];
  let m = 0; R.forEach((r, i) => { if (i && s(r[0]) !== '') m = i; });
  return R.slice(1, m + 1).map((r0, i) => { const r = []; for (let k = 0; k < QT_N; k++) r.push(s(r0[k]));
    return { qator: i + 2, id: r[0], yaratildi: r[1], holati: r[2], eski: r[3], yangi: r[4], mid: r[5], fish: r[6], dokon: r[7],
      turi: r[8], qiymat: son(r[9]), tolangan: son(r[10]), qolgan: son(r[11]),
      sana: r[12], oy: Number(r[13]) || 0, kun: Number(r[14]) || 0, birinchi: r[15], sabab: r[16], eskiNomi: r[17], ijrochi: r[18], yaratdi: r[19], topId: r[20],
      skan: { ariza: r[21], kelishuv: r[22], solishtirma: r[23], shartnoma: r[24] }, papka: r[25], tekshiruvga: r[26], tasdiqVaqt: r[27], tasdiqladi: r[28], kochirilgan: r[29], jurnal: r[30] };
  }).filter(x => x.id);
}
function qtBandRaqamlar(rows) { const o = {}; rows.forEach(x => { if (QT_FAOL.indexOf(x.holati) >= 0) o[x.yangi] = x.id; }); return o; }
async function qtShartnoma(no) {   // 03: getValues (x) + getDisplayValues (r), 40 ustun
  const R = aOxiri(await V.qatorlar('03_Sotuv_shartnomalar'));
  let mx = 0, x = null;
  const pad = a => { const o = []; for (let k = 0; k < 40; k++) o.push(a[k] === undefined || a[k] === null ? '' : a[k]); return o; };
  R.forEach(z => { const n = s(z.x[0]).trim(); const m = /^27\/(\d+)$/.exec(n); if (m) mx = Math.max(mx, Number(m[1])); if (n === no) x = { qator: z.n, r: pad(z.x), d: pad(z.r) }; });
  return { x, mx, barcha: R.map(z => s(z.x[0]).trim()) };
}
async function qtJadvalRaqamlar() { const o = {}; aOxiri(await V.qatorlar('03b_Tolov_jadvali')).forEach(z => { const n = s(z.r[1]).trim(); if (n) o[n] = (o[n] || 0) + 1; }); return o; }
async function qtKeyingiNo(S3, rows) { const band = qtBandRaqamlar(rows), jad = await qtJadvalRaqamlar(); let n = S3.mx + 1; while (band['27/' + n] || jad['27/' + n] || S3.barcha.indexOf('27/' + n) >= 0) n++; return '27/' + n; }
async function qtTolovlar(no) {
  const T = [];
  aOxiri(await V.qatorlar('05_Tolovlar')).forEach(z => { const r = z.x; if (r[0] && s(r[2]).trim() === no) T.push({ v: '05', qator: z.n, id: r[0], sana: qtIso(r[1]), summa: Number(r[3]) || 0, shakl: s(r[4] || ''), izoh: s(r[11] || ''), kochdi: s(r[8] || '').trim() }); });
  aOxiri(await V.qatorlar('05b_Bufer_tolovlar')).forEach(z => { const r = z.x; if (r[0] && s(r[2]).trim() === no && s(r[6]).trim() === 'Буферда') T.push({ v: '05b', qator: z.n, id: r[0], sana: qtIso(r[1]), summa: Number(r[3]) || 0, shakl: s(r[4] || ''), izoh: s(r[5] || ''), bufer: true }); });
  return T.sort((a, b) => a.sana < b.sana ? -1 : a.sana > b.sana ? 1 : 0);
}
async function qtKirish(kodSes, x) {   // qtKirish_: direktor — hammasi; xodim — faqat o'ziga biriktirilgan loyiha
  const u = await S.foydalanuvchi(kodSes); if (!u) throw new S.Xato('Sessiya tugagan — PIN ni qayta kiriting.');
  if (u.admin) return u;
  if (s(x.ijrochi).trim() !== s(u.fish).trim()) throw new S.Xato('Bu loyiha sizga biriktirilmagan.');
  return u;
}
async function qtXodimlar() { return (await TP.topXodimlar()).filter(z => !z.admin).map(z => ({ fish: z.fish, bolim: z.bolim, tg: !!z.tg })); }

async function qtTahlil(no, rows) {
  const S3 = await qtShartnoma(no); if (!S3.x) throw new S.Xato('Shartnoma topilmadi: ' + no);
  const r = S3.x.r, d = S3.x.d, holat = s(r[13]);
  const T = await qtTolovlar(no);
  const ogoh = [];
  if (/bekor|yakun|kutil/i.test(holat)) ogoh.push('Shartnoma holati «' + holat + '» — qayta tuzib bo\'lmaydi.');
  { const I = (await J.yuIshlar()).filter(i => i.no === no && (YU_FAOL.indexOf(i.holati) >= 0 || i.holati === 'Tasdiq kutilmoqda'));
    if (I.length) ogoh.push('Shartnoma yuristda (holati: ' + I[0].holati + ') — avval yurist ishini yoping.'); }
  { const B = (await J.bekorJurnal()).filter(z => z.no === no && BEKOR_YOPIQ.indexOf(z.holati) < 0); if (B.length) ogoh.push('Bu shartnoma bo\'yicha ochiq bekor qilish so\'rovi bor — avval uni yoping.'); }
  const faol = rows.find(x => x.eski === no && QT_FAOL.indexOf(x.holati) >= 0);
  if (faol) ogoh.push('Bu shartnoma uchun ochiq loyiha bor (№' + faol.id + ', ' + faol.holati + ').');
  const qiymat = Math.round(Number(r[22]) || 0), tolangan = Math.round(Number(r[27]) || 0), yig = Math.round(T.reduce((a, t) => a + t.summa, 0));
  if (Math.abs(yig - tolangan) > 1) ogoh.push('To\'lovlar yig\'indisi (' + qtFmt(yig) + ') shartnomadagi «Jami to\'langan» (' + qtFmt(tolangan) + ') bilan mos emas — avval tekshiring.');
  if (qiymat - tolangan <= 0) ogoh.push('Qarz yo\'q — qayta tuzish o\'rniga shartnomani «Yakunlangan» qiling.');
  return { S: S3, r, d, T, ogoh, holat, qiymat, tolangan, yig, faol };
}
async function qtOgoh(x) {
  const ogoh = [];
  const S3 = await qtShartnoma(x.eski);
  if (!S3.x) ogoh.push('Eski shartnoma ' + x.eski + ' bazada topilmadi.');
  else {
    const r = S3.x.r;
    if (/bekor|yakun/i.test(s(r[13]))) ogoh.push('Eski shartnoma holati «' + r[13] + '».');
    const tol = Math.round(Number(r[27]) || 0), qiy = Math.round(Number(r[22]) || 0);
    if (Math.abs(tol - x.tolangan) > 1) ogoh.push('Loyihadan keyin to\'lov o\'zgardi: ' + qtFmt(x.tolangan) + ' → ' + qtFmt(tol) + '. Hujjatlar eskirgan — loyihani bekor qilib, qaytadan yarating.');
    if (Math.abs(qiy - x.qiymat) > 1) ogoh.push('Loyihadan keyin shartnoma qiymati o\'zgardi: ' + qtFmt(x.qiymat) + ' → ' + qtFmt(qiy) + ' — loyihani bekor qilib, qaytadan yarating.');
    if (s(r[4]) !== s(x.mid) || s(r[5]) !== s(x.dokon)) ogoh.push('Eski shartnomada mijoz yoki do\'kon o\'zgargan — loyihani bekor qilib, qaytadan yarating.');
  }
  if (S3.barcha.indexOf(x.yangi) >= 0) ogoh.push(x.yangi + ' raqami bazada paydo bo\'lgan — loyihani bekor qiling.');
  const jq = (await qtJadvalRaqamlar())[x.yangi]; if (jq) ogoh.push(x.yangi + ' raqami bo\'yicha 03b da ' + jq + ' ta eski jadval qatori bor (o\'chirilgan shartnoma qoldig\'i) — bu raqam bilan tasdiqlab bo\'lmaydi. Loyihani bekor qilib, boshqa raqam bilan qaytadan yarating.');
  return ogoh;
}
// jur — hujjatJurnal_ (o'qishda ko'zgu, yozuvdan oldin Google'dan yangi)
async function qtHolat(x, admin, jur) {
  const ogoh = ['Loyiha', 'Qaytarildi', 'Tekshiruvda'].indexOf(x.holati) >= 0 ? await qtOgoh(x) : [];
  jur = jur || await J.hujjatJurnal();
  const skan = QT_HUJ.map(h => { const hid = x.skan[h[0]]; const j = hid ? jur.find(z => s(z.id) === s(hid)) : null;
    return { k: h[0], nom: h[2], bor: !!(j && j.holati === 'Faol'), fayl: j ? j.nom : '', vaqt: j ? j.vaqt : '', kim: j ? j.kim : '', url: (j && admin) ? 'https://drive.google.com/file/d/' + j.faylId + '/view' : '' }; });
  return { ogoh, skan, tayyor: skan.every(z => z.bor) };
}

// ================================================================== 1) DIREKTOR: oynani ochish
async function qaytaKor(args) {
  const [kodSes, no0] = args;
  const u0 = await S.ruxsat(kodSes, 'admin');
  if (!(await bayroq())) return eskiTizim('qaytaKor', u0, args.slice(1));
  const no = s(no0).trim();
  const rows = await qtRows();
  const A = await qtTahlil(no, rows), r = A.r, d = A.d;
  const bugun = V.bugun(), tkun = Number(r[12]) || 23;
  const tur = s(r[3]), yangiTur = QT_TUR_MUDDATLI.indexOf(tur) >= 0 ? tur : (/^Қурилаётган/.test(tur) ? QT_TUR_MUDDATLI[1] : QT_TUR_MUDDATLI[0]);
  const XD = await qtXodimlar();
  return { ok: true, no, holat: A.holat, sana: d[2], turi: tur, yangiTur, turlar: QT_TUR_MUDDATLI, mid: s(r[4]), dokon: s(r[5]), maydon: Number(r[6]) || 0,
    fish: s(r[20]), undiruvchi: s(r[17]), qiymat: A.qiymat, qoshimcha: Math.round(Number(r[24]) || 0), tolangan: A.tolangan, tolovYigindi: A.yig, qolgan: A.qiymat - A.tolangan,
    tolovlar: A.T.map(t => ({ v: t.v, sana: qtDmy(t.sana), summa: t.summa, shakl: t.shakl })), oy: Number(r[11]) || 0, tkun,
    keyingiNo: await qtKeyingiNo(A.S, rows), bugun, birinchi: qtOyQosh(bugun, Number(bugun.slice(8, 10)) < tkun ? 0 : 1, tkun),
    eskiNomi: (QT_NOMI[tur] || [''])[0], sabab: QT_SABAB, xodimlar: XD, ogoh: A.ogoh, faolId: A.faol ? A.faol.id : '' };
}
// ================================================================== 3) LOYIHANI OCHISH (direktor yoki ijrochi)
async function qaytaOchiq(args) {
  const [kodSes, id] = args;
  if (!(await bayroq())) { const u0 = await S.foydalanuvchi(kodSes); if (!u0) throw new S.Xato('Sessiya tugagan — PIN ni qayta kiriting.'); return eskiTizim('qaytaOchiq', u0, args.slice(1)); }
  const x = (await qtRows()).find(z => s(z.id) === s(id)); if (!x) throw new S.Xato('Loyiha topilmadi (№' + id + ').');
  const u = await qtKirish(kodSes, x);
  const H = await qtHolat(x, u.admin);
  const Jd = x.oy ? qtJadval(x.qolgan, x.oy, qtIsoD(x.birinchi), x.kun) : [];
  const XD = u.admin ? await qtXodimlar() : [];
  return { ok: true, admin: u.admin, men: u.fish, xodimlar: XD, x: { id: x.id, holati: x.holati, eski: x.eski, yangi: x.yangi, fish: x.fish, dokon: x.dokon, turi: x.turi, qiymat: x.qiymat, tolangan: x.tolangan, qolgan: x.qolgan,
    sana: x.sana, oy: x.oy, kun: x.kun, birinchi: x.birinchi, sabab: x.sabab, eskiNomi: x.eskiNomi, ijrochi: x.ijrochi, yaratdi: x.yaratdi, yaratildi: x.yaratildi, papka: u.admin ? x.papka : '',
    tasdiqVaqt: x.tasdiqVaqt, tasdiqladi: x.tasdiqladi, jurnal: x.jurnal }, jadval: Jd.map(j => ({ sana: qtDmy(j.sana), summa: j.summa })), skan: H.skan, ogoh: H.ogoh, tayyor: H.tayyor };
}

// ------------------------------------------------------------------ yozuv yordamchilari
let kv = { ok: false, t: 0 };
async function koprik16(kod) {
  if (kv.t && Date.now() - kv.t < (kv.ok ? 30 : 2) * 60000) return kv.ok;
  try { kv = { ok: koprik.bor() && verOk(await koprik.chaqir('koprikVersiya', kod, []), '1.6'), t: Date.now() }; } catch (e) { kv = { ok: false, t: Date.now() }; }
  return kv.ok;
}
async function bayroq() { try { return (await redis.get('yozuv_yondi:qayta')) === '1'; } catch (e) { return false; } }
async function serverda(kod) { return (await bayroq()) && koprik16(kod); }
async function eskiTizim(fn, u, args) { const r = await koprik.chaqir(fn, u.kod, args); await tetik.yangilaKut(20000); return r; }
async function qulfBilan(ish) {   // LockService.getScriptLock() o'rni (eski tizimning qolgan qayta amallari bilan umumiy emas — direktor bitta)
  const kalit = 'qulf:qayta', belgi = crypto.randomBytes(8).toString('hex'), t0 = Date.now();
  while (!(await redis.set(kalit, belgi, 'PX', 30000, 'NX'))) { if (Date.now() - t0 > 30000) throw new S.Xato('Tizim band — birozdan keyin qayta urinib ko\'ring.'); await new Promise(r => setTimeout(r, 150)); }
  try { return await ish(); } finally { if ((await redis.get(kalit)) === belgi) await redis.del(kalit); }
}
const harf = n => { let x = ''; while (n > 0) { const m = (n - 1) % 26; x = String.fromCharCode(65 + m) + x; n = Math.floor((n - 1) / 26); } return x; };
const kat = (varaq, qator, ustun, q) => ({ varaq, katak: harf(ustun) + qator, qiymat: [[q]] });
const jurnalKat = (x, matn, kim) => kat(QT_VARAQ, x.qator, 31, (x.jurnal ? x.jurnal + '\n' : '') + hozirHm() + ' · ' + kim + ': ' + matn);   // qtJurnal_
const kut = (p, ms) => Promise.race([p, new Promise(r => setTimeout(r, ms))]);
const yangila = nomlar => kut(tetik.varaqlarYangila(nomlar).catch(e => console.error('ko\'zgu (qayta):', e.message)), 15000);
async function yoz(Y) { try { await G.yoz(env.aksBazaId, Y, env.googleKey); } catch (e) { if (e instanceof G.RuxsatYoq) e.yozilmadi = true; throw e; } }
// qtTop_: loyihaga bog'langan topshiriq holati
async function qtTop(x, holat, kim, dalil) {
  if (!x.topId) return;
  const t = (await TP.topRowsYangi(TOP_V)).L.find(z => s(z.id) === s(x.topId)); if (!t || t.holati === 'Bajarildi' || t.holati === 'Bekor') return;
  await TP.topYop(TOP_V, t, holat, kim, dalil);
}
// qtHujjatBekor_ — 06d N/O (Google'dan yangi qator); Drive fayli keyin ko'chiriladi (driveBekor)
async function hujjatBekor(hid, sabab, kim) {
  const h = (await QH.hjYangi()).find(z => s(z.id) === s(hid)); if (!h || h.holati !== 'Faol') return null;
  const vaqt = hozirHm();
  await yoz([kat(HUJ, h.qator, 14, 'Bekor'), kat(HUJ, h.qator, 15, (h.izoh ? h.izoh + ' | ' : '') + 'Bekor: ' + sabab + ' (' + kim + ', ' + vaqt + ')')]);
  return h;
}
function driveBekor(kod, h) {   // eski: f.moveTo(_BEKOR QILINGANLAR); f.setName('BEKOR_' + id + '_' + nom) — xato e'tiborsiz
  if (!h || !h.faylId || /^SRV:/.test(h.faylId)) return;   // hali Drive'ga ko'chmagan — driveGaKochir 06d «Bekor» ni ko'rib o'zi bekor papkaga qo'yadi
  koprik.chaqir('koprikHujjatBekorFayl', kod, [h.faylId, 'BEKOR_' + h.id + '_' + h.nom]).catch(e => console.error('qayta: hujjat bekor (Drive):', e.message));
}
async function hujjatTikla(h) { await yoz([kat(HUJ, h.qator, 14, 'Faol'), kat(HUJ, h.qator, 15, h.izoh || '')]); }   // qtHujjatTikla_

// ================================================================== 5) IMZOLANGAN SKANLARNI YUKLASH
async function qaytaSkan(args) {
  const [kodSes, id, k, b64, sahifa] = args;
  let x = (await qtRows()).find(z => s(z.id) === s(id)); if (!x) throw new S.Xato('Loyiha topilmadi.');
  const u = await qtKirish(kodSes, x);
  if (!(await serverda(u.kod))) return eskiTizim('qaytaSkan', u, args.slice(1));
  if (['Loyiha', 'Qaytarildi'].indexOf(x.holati) < 0) throw new S.Xato('Skan faqat «Loyiha» yoki «Qaytarildi» holatida yuklanadi (hozir: ' + x.holati + ').');
  const h = QT_HUJ.find(z => z[0] === k); if (!h) throw new S.Xato('Hujjat turi noto\'g\'ri.');
  const bayt = Buffer.from(s(b64), 'base64');
  if (bayt.length < 1000) throw new S.Xato('Fayl bo\'sh yoki buzilgan.');
  if (bayt.length > HUJJAT_MAX_MB * 1024 * 1024) throw new S.Xato('Fayl ' + HUJJAT_MAX_MB + ' MB dan katta.');
  if (bayt.subarray(0, 5).toString('latin1') !== '%PDF-') throw new S.Xato('Fayl PDF emas.');
  const sanaIso = qtIsoD(x.sana), bugun = V.bugun();
  if (sanaIso > bugun) throw new S.Xato('Hujjat sanasi (' + x.sana + ') hali kelmagan — skanni shu kuni yoki undan keyin yuklang.');
  const no = h[3] === 'yangi' ? x.yangi : x.eski;
  let eski = null;
  try { eski = x.skan[k] ? await hujjatBekor(x.skan[k], 'Qayta tuzish №' + x.id + ': skan almashtirildi', u.fish) : null; }
  catch (e) { if (e.yozilmadi) return eskiTizim('qaytaSkan', u, args.slice(1)); throw e; }   // robotda yozish yo'q — hech narsa yozilmagan
  if (eski) await yangila([HUJ]);   // yangi skan takror tekshiruvidan o'tishi uchun ko'zgu ham «Bekor» ni ko'rsin
  let r;
  try {
    r = await HY.yuklaYadro(u, { turi: h[1], sana: sanaIso, b64, sahifa, izoh: 'Qayta tuzish №' + x.id + ' · ' + h[2] + ' · ' + x.eski + ' → ' + x.yangi },
      { no, tur: 'sotuv', fish: x.fish, dokon: x.dokon });
  } catch (e) { if (eski) { await hujjatTikla(eski).catch(z => console.error('qayta: tiklash:', z.message)); await yangila([HUJ]); } throw e; }
  driveBekor(u.kod, eski);
  const w = await qulfBilan(async () => {
    x = (await qtRows()).find(z => s(z.id) === s(id));
    const j = (await QH.hjYangi()).filter(z => z.no === no && z.turi === h[1] && z.holati === 'Faol' && z.nom === r.nom).pop();
    if (['Loyiha', 'Qaytarildi'].indexOf(x.holati) < 0) {   // yuklash davomida loyiha yopilgan / tekshiruvga ketgan
      if (j) { const b = await hujjatBekor(j.id, 'Qayta tuzish №' + x.id + ' «' + x.holati + '» bo\'lgan paytda yuklandi', u.fish); driveBekor(u.kod, b); await yangila([HUJ]); }
      throw new S.Xato('Loyiha holati o\'zgardi (' + x.holati + ') — skan qabul qilinmadi.');
    }
    await yoz([kat(QT_VARAQ, x.qator, QT_SKAN_UST[k], j ? s(j.id) : ''), jurnalKat(x, h[2] + ' skani yuklandi (' + r.nom + ')', u.fish)]);
    return true;
  });
  if (w) await yangila([QT_VARAQ, HUJ]);
  return { ok: true, k, nom: r.nom };
}

// ================================================================== 6) TEKSHIRUVGA YUBORISH (ijrochi)
async function qaytaTekshiruvga(args) {
  const [kodSes, id] = args;
  const x0 = (await qtRows()).find(z => s(z.id) === s(id)); if (!x0) throw new S.Xato('Loyiha topilmadi.');
  const u = await qtKirish(kodSes, x0);
  if (!(await serverda(u.kod))) return eskiTizim('qaytaTekshiruvga', u, args.slice(1));
  let yoq = false;
  const x = await qulfBilan(async () => {
    const x = (await qtRows()).find(z => s(z.id) === s(id));
    if (['Loyiha', 'Qaytarildi'].indexOf(x.holati) < 0) throw new S.Xato('Loyiha «' + x.holati + '» holatida.');
    const H = await qtHolat(x, u.admin, await QH.hjYangi());
    if (H.ogoh.length) throw new S.Xato(H.ogoh.join(' '));
    if (!H.tayyor) throw new S.Xato('4 ta skanning hammasi yuklanmagan: ' + H.skan.filter(z => !z.bor).map(z => z.nom).join(', ') + '.');
    try { await yoz([kat(QT_VARAQ, x.qator, 3, 'Tekshiruvda'), kat(QT_VARAQ, x.qator, 27, hozirHm()), jurnalKat(x, 'tekshiruvga yuborildi', u.fish)]); }
    catch (e) { if (e.yozilmadi) { yoq = true; return null; } throw e; }
    await qtTop(x, 'Tekshiruvda', u.fish, '4 ta imzolangan skan yuklandi');
    return x;
  });
  if (yoq) return eskiTizim('qaytaTekshiruvga', u, args.slice(1));
  await yangila([QT_VARAQ, TOP_V]);
  koprik.chaqir('koprikTgYubor', u.kod, ['🔁 <b>Qayta tuzish tekshiruvda</b> (№' + x.id + ')\n' + x.eski + ' → <b>' + x.yangi + '</b> · ' + x.fish + ' · ' + x.dokon + '\n4 ta imzolangan skan yuklandi — ' + u.fish + '\nAKS → 🏠 Bosh sahifa yoki 👤 Mijoz kartasi → 🔁 Qayta tuzish'])
    .catch(e => console.error('qayta tg:', e.message));
  return { ok: true };
}

// ================================================================== 8) DIREKTOR: QAYTARISH
async function qaytaQaytar(args) {
  const [kodSes, id, izoh0] = args;
  const u = await S.ruxsat(kodSes, 'admin');
  const izoh = s(izoh0).replace(/\s+/g, ' ').trim(); if (izoh.length < 3) throw new S.Xato('Qaytarish sababini yozing.');
  if (!(await serverda(u.kod))) return eskiTizim('qaytaQaytar', u, args.slice(1));
  let yoq = false;
  const x = await qulfBilan(async () => {
    const x = (await qtRows()).find(z => s(z.id) === s(id)); if (!x) throw new S.Xato('Loyiha topilmadi.');
    if (x.holati !== 'Tekshiruvda') throw new S.Xato('Faqat «Tekshiruvda» holatidagi loyiha qaytariladi.');
    try { await yoz([kat(QT_VARAQ, x.qator, 3, 'Qaytarildi'), jurnalKat(x, 'qaytarildi: ' + izoh, u.fish)]); }
    catch (e) { if (e.yozilmadi) { yoq = true; return null; } throw e; }
    if (x.topId) { const t = (await TP.topRowsYangi(TOP_V)).L.find(z => s(z.id) === s(x.topId));
      if (t && t.holati === 'Tekshiruvda') { await TP.topYop(TOP_V, t, 'Jarayonda', '', ''); await yoz([kat(TOP_V, t.qator, 7, (t.izoh ? t.izoh + ' | ' : '') + 'Qaytarildi: ' + izoh)]); } }
    return x;
  });
  if (yoq) return eskiTizim('qaytaQaytar', u, args.slice(1));
  await yangila([QT_VARAQ, TOP_V]);
  try { const xd = (await TP.topXodimlar()).find(z => z.fish === x.ijrochi);
    if (xd && xd.tg) koprik.chaqir('koprikTgChat', u.kod, [xd.tg, '↩ <b>Qayta tuzish qaytarildi</b> (' + x.eski + ' → ' + x.yangi + ')\nSabab: ' + izoh + '\nAKS → 📌 Topshiriqlar → 🔁 Ochish']).catch(e => console.error('qayta tg:', e.message)); } catch (e) { }
  return { ok: true };
}

module.exports = { qaytaKor, qaytaOchiq, qaytaSkan, qaytaTekshiruvga, qaytaQaytar };
module.exports._ichki = { qtRows, qtShartnoma, qtTolovlar, qtTahlil, qtOgoh, qtHolat, qtJadval, qtOyQosh, qtFmt, qtKeyingiNo, hujjatBekor, QT_VARAQ };
