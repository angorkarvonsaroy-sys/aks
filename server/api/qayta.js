// AKS TIZIM — 🔁 SOTUV SHARTNOMASINI QAYTA TUZISH (Qayta.gs v2.3) — serverdagi qismi.
// 1-bosqich (21.10.2026): o'qishlar — qaytaKor (direktor: oynani ochish), qaytaOchiq (loyiha: direktor yoki ijrochi);
//   yozuvlar — qaytaSkan (imzolangan skan → 06d + 06k), qaytaTekshiruvga (ijrochi), qaytaQaytar (direktor).
// 2-bosqich (21.10.2026): qaytaLoyiha (06k yangi qator + xodimga topshiriq), qaytaIjrochi (ijrochini almashtirish), qaytaTasdiq (BAZAGA YOZISH:
//   03 yangi qator + U:AN formulalar, 03b jadval + Kumulyativ formulasi, 05/05b to'lovlar yangi raqamga, eski shartnoma «Bekor qilindi», 06k «Bajarildi»,
//   tashrif, Telegram). Tasdiq yozuvlaridan oldin 03/03b/05/05b Google'dan YANGI o'qiladi (eski tizim getValues kabi), qulf: qayta + shartnoma.
//   3-bosqich (21–22.10.2026): qaytaHujjatlar (yozuv_yondi:qayta_hujjat), qaytaBekor (yozuv_yondi:qayta_bekor + Koprik ≥ 1.14: bo'sh Drive papkasi savatga — koprikQtPapkaSavat).
// Eski kod bilan bir xil: tekshiruvlar tartibi, xato matnlari, javob, kataklar. 06k — yozuvdan oldin Google'dan YANGI o'qiladi.
// Farq (yakuniy holat bir xil): eski qaytaSkan avval eski skanni Drive'da «_BEKOR» papkaga ko'chirib, yangi yuklash muvaffaqiyatsiz bo'lsa qaytarardi;
//   server 06d da avval «Bekor» belgilaydi (yangi skan takror tekshiruvidan o'tishi uchun), Drive faylini esa faqat yangi skan yozilgach ko'chiradi
//   (muvaffaqiyatsiz bo'lsa 06d qaytariladi, Drive'ga tegilmaydi). Skan avval serverga (SRV:), Drive'ga — fonda (hujjatYukla kabi).
// Yoqilishi: Redis yozuv_yondi:qayta («aks-yozuv-sinov qayta» — o'qishlar eski tizim bilan solishtiriladi, 06k nusxasida yozuv);
//   yozuvlar uchun yana Koprik ≥ 1.6 (koprikHujjatBekorFayl, koprikTgYubor, koprikTgChat). Aks holda — eski tizim (o'qishlar ham).
//   2-bosqich (loyiha, ijrochi, tasdiq) — qo'shimcha yozuv_yondi:qayta2 («aks-yozuv-sinov qayta2» — nusxa varaqlarda to'liq tasdiq yozuvi, eski yozganlari bilan).
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
const SY = require('./shartnoma_yoz')._ichki;
const SH = require('../lib/sotuv_hujjat');
const DS = require('../lib/docs_shablon');
const SP = require('../lib/shablon_pdf');
const PDF = require('../lib/pdf');
const fs = require('fs');
const path = require('path');

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
// Ma'lumot manbai: o'qishlarda — ko'zgu (V.qatorlar), yozuvdan oldin — Google'dan YANGI (eski tizim getValues/getDisplayValues kabi).
// Har varaq bir marta o'qiladi (keshlanadi); yozuvdan keyin qayta o'qish — M.yangila(nom).
const KZ = { '03_Sotuv_shartnomalar': ['A2:AN', 40, true], '03b_Tolov_jadvali': ['A2:H', 8, true], '05_Tolovlar': ['A2:L', 12, false], '05b_Bufer_tolovlar': ['A2:G', 7, false] };
function manba(yangi, varaqNom) {
  const kesh = {}; const nomi = n => (varaqNom && varaqNom[n]) || n;   // varaqNom — sinovda nusxa varaqlar
  const ol = async nom => {
    if (!yangi) return V.qatorlar(nom);
    const [a1, n, ikki] = KZ[nom], v = nomi(nom);
    const [X, D] = await Promise.all([G.oraliqOqi(env.aksBazaId, v, a1, env.googleKey, 'UNFORMATTED_VALUE'), ikki ? G.oraliqOqi(env.aksBazaId, v, a1, env.googleKey) : null]);
    return X.map((r0, i) => { const x = [], r = []; for (let k = 0; k < n; k++) { x.push(r0[k] == null ? '' : r0[k]); r.push(D ? s((D[i] || [])[k]) : s(r0[k] == null ? '' : r0[k])); } return { n: i + 2, x, r }; });
  };
  return { q: nom => kesh[nom] || (kesh[nom] = ol(nom)), yangila: nom => { delete kesh[nom]; }, nomi };
}
const KOZGU = manba(false);
async function qtRows(varaq) {   // qtRows_ — Google'dan YANGI (getDisplayValues); null — varaq yo'q yoki eski (v1) tuzilishda
  const R = await G.oraliqOqi(env.aksBazaId, varaq || QT_VARAQ, 'A1:AE', env.googleKey).catch(e => { if (/Unable to parse range|not found/i.test(e.message)) return null; throw e; });
  if (!R || !R.length || s(R[0][2]) !== 'Holati') return null;
  let m = 0; R.forEach((r, i) => { if (i && s(r[0]) !== '') m = i; });
  return R.slice(1, m + 1).map((r0, i) => { const r = []; for (let k = 0; k < QT_N; k++) r.push(s(r0[k]));
    return { qator: i + 2, id: r[0], yaratildi: r[1], holati: r[2], eski: r[3], yangi: r[4], mid: r[5], fish: r[6], dokon: r[7],
      turi: r[8], qiymat: son(r[9]), tolangan: son(r[10]), qolgan: son(r[11]),
      sana: r[12], oy: Number(r[13]) || 0, kun: Number(r[14]) || 0, birinchi: r[15], sabab: r[16], eskiNomi: r[17], ijrochi: r[18], yaratdi: r[19], topId: r[20],
      skan: { ariza: r[21], kelishuv: r[22], solishtirma: r[23], shartnoma: r[24] }, papka: r[25], tekshiruvga: r[26], tasdiqVaqt: r[27], tasdiqladi: r[28], kochirilgan: r[29], jurnal: r[30] };
  }).filter(x => x.id);
}
function qtBandRaqamlar(rows) { const o = {}; rows.forEach(x => { if (QT_FAOL.indexOf(x.holati) >= 0) o[x.yangi] = x.id; }); return o; }
async function qtShartnoma(no, M) {   // 03: getValues (x) + getDisplayValues (r), 40 ustun
  const R = aOxiri(await (M || KOZGU).q('03_Sotuv_shartnomalar'));
  let mx = 0, x = null;
  const pad = a => { const o = []; for (let k = 0; k < 40; k++) o.push(a[k] === undefined || a[k] === null ? '' : a[k]); return o; };
  R.forEach(z => { const n = s(z.x[0]).trim(); const m = /^27\/(\d+)$/.exec(n); if (m) mx = Math.max(mx, Number(m[1])); if (n === no) x = { qator: z.n, r: pad(z.x), d: pad(z.r) }; });
  return { x, mx, barcha: R.map(z => s(z.x[0]).trim()) };
}
async function qtJadvalRaqamlar(M) { const o = {}; aOxiri(await (M || KOZGU).q('03b_Tolov_jadvali')).forEach(z => { const n = s(z.r[1]).trim(); if (n) o[n] = (o[n] || 0) + 1; }); return o; }
async function qtKeyingiNo(S3, rows) { const band = qtBandRaqamlar(rows), jad = await qtJadvalRaqamlar(); let n = S3.mx + 1; while (band['27/' + n] || jad['27/' + n] || S3.barcha.indexOf('27/' + n) >= 0) n++; return '27/' + n; }
async function qtTolovlar(no, M) {
  const T = []; M = M || KOZGU;
  aOxiri(await M.q('05_Tolovlar')).forEach(z => { const r = z.x; if (r[0] && s(r[2]).trim() === no) T.push({ v: '05', qator: z.n, id: r[0], sana: qtIso(r[1]), summa: Number(r[3]) || 0, shakl: s(r[4] || ''), izoh: s(r[11] || ''), kochdi: s(r[8] || '').trim() }); });
  aOxiri(await M.q('05b_Bufer_tolovlar')).forEach(z => { const r = z.x; if (r[0] && s(r[2]).trim() === no && s(r[6]).trim() === 'Буферда') T.push({ v: '05b', qator: z.n, id: r[0], sana: qtIso(r[1]), summa: Number(r[3]) || 0, shakl: s(r[4] || ''), izoh: s(r[5] || ''), bufer: true }); });
  return T.sort((a, b) => a.sana < b.sana ? -1 : a.sana > b.sana ? 1 : 0);
}
async function qtKirish(kodSes, x) {   // qtKirish_: direktor — hammasi; xodim — faqat o'ziga biriktirilgan loyiha
  const u = await S.foydalanuvchi(kodSes); if (!u) throw new S.Xato('Sessiya tugagan — PIN ni qayta kiriting.');
  if (u.admin) return u;
  if (s(x.ijrochi).trim() !== s(u.fish).trim()) throw new S.Xato('Bu loyiha sizga biriktirilmagan.');
  return u;
}
async function qtXodimlar() { return (await TP.topXodimlar()).filter(z => !z.admin).map(z => ({ fish: z.fish, bolim: z.bolim, tg: !!z.tg })); }

async function qtTahlil(no, rows, M) {
  const S3 = await qtShartnoma(no, M); if (!S3.x) throw new S.Xato('Shartnoma topilmadi: ' + no);
  const r = S3.x.r, d = S3.x.d, holat = s(r[13]);
  const T = await qtTolovlar(no, M);
  const ogoh = [];
  if (/bekor|yakun|kutil/i.test(holat)) ogoh.push('Shartnoma holati «' + holat + '» — qayta tuzib bo\'lmaydi.');
  { const I = (await J.yuIshlar()).filter(i => i.no === no && (YU_FAOL.indexOf(i.holati) >= 0 || i.holati === 'Tasdiq kutilmoqda'));
    if (I.length) ogoh.push('Shartnoma yuristda (holati: ' + I[0].holati + ') — avval yurist ishini yoping.'); }
  { const B = (await J.bekorJurnal()).filter(z => z.no === no && BEKOR_YOPIQ.indexOf(z.holati) < 0); if (B.length) ogoh.push('Bu shartnoma bo\'yicha ochiq bekor qilish so\'rovi bor — avval uni yoping.'); }
  const faol = (rows || []).find(x => x.eski === no && QT_FAOL.indexOf(x.holati) >= 0);
  if (faol) ogoh.push('Bu shartnoma uchun ochiq loyiha bor (№' + faol.id + ', ' + faol.holati + ').');
  const qiymat = Math.round(Number(r[22]) || 0), tolangan = Math.round(Number(r[27]) || 0), yig = Math.round(T.reduce((a, t) => a + t.summa, 0));
  if (Math.abs(yig - tolangan) > 1) ogoh.push('To\'lovlar yig\'indisi (' + qtFmt(yig) + ') shartnomadagi «Jami to\'langan» (' + qtFmt(tolangan) + ') bilan mos emas — avval tekshiring.');
  if (qiymat - tolangan <= 0) ogoh.push('Qarz yo\'q — qayta tuzish o\'rniga shartnomani «Yakunlangan» qiling.');
  return { S: S3, r, d, T, ogoh, holat, qiymat, tolangan, yig, faol };
}
async function qtOgoh(x, M) {
  const ogoh = [];
  const S3 = await qtShartnoma(x.eski, M);
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
  const jq = (await qtJadvalRaqamlar(M))[x.yangi]; if (jq) ogoh.push(x.yangi + ' raqami bo\'yicha 03b da ' + jq + ' ta eski jadval qatori bor (o\'chirilgan shartnoma qoldig\'i) — bu raqam bilan tasdiqlab bo\'lmaydi. Loyihani bekor qilib, boshqa raqam bilan qaytadan yarating.');
  return ogoh;
}
// jur — hujjatJurnal_ (o'qishda ko'zgu, yozuvdan oldin Google'dan yangi)
async function qtHolat(x, admin, jur, M) {
  const ogoh = ['Loyiha', 'Qaytarildi', 'Tekshiruvda'].indexOf(x.holati) >= 0 ? await qtOgoh(x, M) : [];
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
  const rows = (await qtRows()) || [];
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
  const x = ((await qtRows()) || []).find(z => s(z.id) === s(id)); if (!x) throw new S.Xato('Loyiha topilmadi (№' + id + ').');
  const u = await qtKirish(kodSes, x);
  const H = await qtHolat(x, u.admin);
  const Jd = x.oy ? qtJadval(x.qolgan, x.oy, qtIsoD(x.birinchi), x.kun) : [];
  const XD = u.admin ? await qtXodimlar() : [];
  return { ok: true, admin: u.admin, men: u.fish, xodimlar: XD, x: { id: x.id, holati: x.holati, eski: x.eski, yangi: x.yangi, fish: x.fish, dokon: x.dokon, turi: x.turi, qiymat: x.qiymat, tolangan: x.tolangan, qolgan: x.qolgan,
    sana: x.sana, oy: x.oy, kun: x.kun, birinchi: x.birinchi, sabab: x.sabab, eskiNomi: x.eskiNomi, ijrochi: x.ijrochi, yaratdi: x.yaratdi, yaratildi: x.yaratildi, papka: u.admin ? x.papka : '',
    tasdiqVaqt: x.tasdiqVaqt, tasdiqladi: x.tasdiqladi, jurnal: x.jurnal }, jadval: Jd.map(j => ({ sana: qtDmy(j.sana), summa: j.summa })), skan: H.skan, ogoh: H.ogoh, tayyor: H.tayyor };
}

// ------------------------------------------------------------------ yozuv yordamchilari
let kv14 = { ok: false, t: 0 };
async function koprik114(kod) {   // qaytaBekor: koprikQtPapkaSavat (v1.14)
  if (kv14.t && Date.now() - kv14.t < (kv14.ok ? 30 : 2) * 60000) return kv14.ok;
  try { kv14 = { ok: koprik.bor() && verOk(await koprik.chaqir('koprikVersiya', kod, []), '1.14'), t: Date.now() }; } catch (e) { kv14 = { ok: false, t: Date.now() }; }
  return kv14.ok;
}
let kv = { ok: false, t: 0 };
async function koprik16(kod) {
  if (kv.t && Date.now() - kv.t < (kv.ok ? 30 : 2) * 60000) return kv.ok;
  try { kv = { ok: koprik.bor() && verOk(await koprik.chaqir('koprikVersiya', kod, []), '1.6'), t: Date.now() }; } catch (e) { kv = { ok: false, t: Date.now() }; }
  return kv.ok;
}
async function bayroq() { try { return (await redis.get('yozuv_yondi:qayta')) === '1'; } catch (e) { return false; } }
async function serverda(kod) { return (await bayroq()) && koprik16(kod); }
async function bayroq2() { try { return (await redis.get('yozuv_yondi:qayta2')) === '1'; } catch (e) { return false; } }   // 2-bosqich: loyiha, ijrochi, tasdiq («aks-yozuv-sinov qayta2»)
async function serverda2(kod) { return (await bayroq()) && (await bayroq2()) && koprik16(kod); }
async function eskiTizim(fn, u, args) { const r = await koprik.chaqir(fn, u.kod, args); await tetik.yangilaKut(20000); return r; }
async function qulfBilan(ish) {   // LockService.getScriptLock() o'rni (eski tizimning qolgan qayta amallari bilan umumiy emas — direktor bitta)
  const kalit = 'qulf:qayta', belgi = crypto.randomBytes(8).toString('hex'), t0 = Date.now();
  while (!(await redis.set(kalit, belgi, 'PX', 30000, 'NX'))) { if (Date.now() - t0 > 30000) throw new S.Xato('Tizim band — birozdan keyin qayta urinib ko\'ring.'); await new Promise(r => setTimeout(r, 150)); }
  try { return await ish(); } finally { if ((await redis.get(kalit)) === belgi) await redis.del(kalit); }
}
const harf = n => { let x = ''; while (n > 0) { const m = (n - 1) % 26; x = String.fromCharCode(65 + m) + x; n = Math.floor((n - 1) / 26); } return x; };
const kat = (varaq, qator, ustun, q) => ({ varaq, katak: harf(ustun) + qator, qiymat: [[q]] });
const jurnalKatV = (varaq, x, matn, kim) => kat(varaq, x.qator, 31, (x.jurnal ? x.jurnal + '\n' : '') + hozirHm() + ' · ' + kim + ': ' + matn);
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
  let x = ((await qtRows()) || []).find(z => s(z.id) === s(id)); if (!x) throw new S.Xato('Loyiha topilmadi.');
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
    x = ((await qtRows()) || []).find(z => s(z.id) === s(id));
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
  const x0 = ((await qtRows()) || []).find(z => s(z.id) === s(id)); if (!x0) throw new S.Xato('Loyiha topilmadi.');
  const u = await qtKirish(kodSes, x0);
  if (!(await serverda(u.kod))) return eskiTizim('qaytaTekshiruvga', u, args.slice(1));
  let yoq = false;
  const x = await qulfBilan(async () => {
    const x = ((await qtRows()) || []).find(z => s(z.id) === s(id));
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
    const x = ((await qtRows()) || []).find(z => s(z.id) === s(id)); if (!x) throw new S.Xato('Loyiha topilmadi.');
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

// ================================================================== 1b) DIREKTOR: LOYIHANI BEKOR QILISH (Qayta.gs qaytaBekor — tartib va matnlar aynan)
async function bayroqB() { try { return (await redis.get('yozuv_yondi:qayta_bekor')) === '1'; } catch (e) { return false; } }
// Yadro (sinov ham shuni ishlatadi): opt = { varaq (06k nusxasi), quruq (Drive/topshiriq/Telegram yo'q) }
async function bekorYadro(u, id, sabab, opt = {}) {
  const varaq = opt.varaq || QT_VARAQ;
  const x = ((await qtRows(varaq)) || []).find(z => s(z.id) === s(id)); if (!x) throw new S.Xato('Loyiha topilmadi.');
  if (QT_FAOL.indexOf(x.holati) < 0) throw new S.Xato('Loyiha «' + x.holati + '» holatida — bekor qilib bo\'lmaydi.');
  if ((await qtShartnoma(x.eski, manba(true))).barcha.indexOf(x.yangi) >= 0) throw new S.Xato(x.yangi + ' bazada yozilgan — loyihani bekor qilib bo\'lmaydi.' + (x.holati === 'Yozilmoqda' ? ' ✓ Tasdiqlash ni qayta bosing — tizim qolgan qadamlarni bajaradi.' : ''));
  for (const h of QT_HUJ) if (x.skan[h[0]] && !opt.quruq) { const hj = await hujjatBekor(x.skan[h[0]], 'Qayta tuzish №' + x.id + ' bekor qilindi: ' + sabab, u.fish); driveBekor(u.kod, hj); }
  // yangi raqam uchun ochilgan bo'sh hujjat papkasi — o'chiriladi (eski: try/catch, xato e'tiborsiz)
  if (!opt.quruq) await koprik.chaqir('koprikQtPapkaSavat', u.kod, [x.yangi]).catch(e => console.error('qayta bekor: papka savat:', e.message));
  await yoz([kat(varaq, x.qator, 3, 'Bekor'), jurnalKatV(varaq, x, 'BEKOR: ' + sabab + ' (raqam ' + x.yangi + ' bo\'shadi)', u.fish)]);
  if (!opt.quruq) await qtTop(x, 'Bekor', u.fish, 'loyiha bekor qilindi: ' + sabab);
  return { ok: true, yangi: x.yangi };
}
async function qaytaBekor(args) {
  const [kodSes, id, sabab0] = args;
  const u = await S.ruxsat(kodSes, 'admin');
  const sabab = s(sabab0).replace(/\s+/g, ' ').trim(); if (sabab.length < 3) throw new S.Xato('Bekor qilish sababini yozing.');
  if (!(await serverda(u.kod)) || !(await bayroqB()) || !(await koprik114(u.kod))) return eskiTizim('qaytaBekor', u, args.slice(1));
  let r;
  try { r = await qulfBilan(() => bekorYadro(u, id, sabab)); }
  catch (e) { if (e.yozilmadi) return eskiTizim('qaytaBekor', u, args.slice(1)); throw e; }
  await yangila([QT_VARAQ, HUJ, TOP_V]);
  return r;
}

// ================================================================== 2) DIREKTOR: LOYIHA YARATISH (bazaga hali hech narsa yozilmaydi — faqat 06k + topshiriq)
const S_ = v => s(v).replace(/\s+/g, ' ').trim();
const TOP_O = { matn: [], sana: {}, son: {}, formula: [] };
function ertaga2() { const d = new Date(Date.now() + 2 * 86400000 + 5 * 3600000), p = n => String(n).padStart(2, '0'); return p(d.getUTCDate()) + '.' + p(d.getUTCMonth() + 1) + '.' + d.getUTCFullYear(); }
// 06k ga yangi qator: hamma katak matn (setNumberFormat('@') + setValues o'rni: «'» + TEXT formati). Qaytaradi haqiqiy qator raqami
async function loyihaQatorYoz(varaq, l, row) {
  const F = { matn: [], sana: {}, son: {}, formula: [] };
  let r;
  try { r = await G.qatorlarQoshR(env.aksBazaId, varaq, l + 1, [row.map(v => v === '' ? '' : "'" + v)], env.googleKey); }
  catch (e) { if (e instanceof G.RuxsatYoq) e.yozilmadi = true; throw e; }
  try {
    const g = await G.gid(env.aksBazaId, varaq, env.googleKey);
    await G.soralar(env.aksBazaId, [{ repeatCell: { range: { sheetId: g, startRowIndex: r - 1, endRowIndex: r, startColumnIndex: 0, endColumnIndex: QT_N }, cell: { userEnteredFormat: { numberFormat: { type: 'TEXT', pattern: '@' } } }, fields: 'userEnteredFormat.numberFormat' } }], env.googleKey);
  } catch (e) { console.error('06k format:', e.message); await SY.ogoh({ varaq, qator: r, xato: 'format: ' + e.message.slice(0, 200) }); }
  if (r !== l + 1) await SY.ogoh({ varaq, qator: r, xato: 'kutilgan qator ' + (l + 1) + ' — shu orada boshqa yozuv qo\'shilgan' });
  return r;
}
// topYoz_ — topshiriq qulfi ostida (topshiriq_yoz.js / qadam_yoz.js bilan bitta qulf)
async function topshiriqYoz(o) {
  const kalit = 'qulf:topshiriq', belgi = crypto.randomBytes(8).toString('hex'), t0 = Date.now();
  while (!(await redis.set(kalit, belgi, 'PX', 30000, 'NX'))) { if (Date.now() - t0 > 30000) throw new S.Xato('Tizim band — birozdan keyin qayta urinib ko\'ring.'); await new Promise(r => setTimeout(r, 150)); }
  try { return await TP.topYoz(TOP_V, o, await TP.topRowsYangi(TOP_V)); } finally { if ((await redis.get(kalit)) === belgi) await redis.del(kalit); }
}
async function qaytaLoyiha(args) {
  const [kodSes, d0] = args; const d = d0 || {};
  const u = await S.ruxsat(kodSes, 'admin');
  if (!(await serverda2(u.kod))) return eskiTizim('qaytaLoyiha', u, args.slice(1));
  const eski = S_(d.eski), yangi = S_(d.yangi);
  if (!/^27\/\d+$/.test(yangi)) throw new S.Xato('Yangi shartnoma raqamini 27/NNN shaklida yozing.');
  const oy = Math.round(Number(d.oy) || 0); if (oy < 1 || oy > 60) throw new S.Xato('Muddat 1–60 oy oralig\'ida bo\'lsin.');
  const kun = Math.round(Number(d.kun) || 0); if (kun < 1 || kun > 31) throw new S.Xato('To\'lov kuni 1–31.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(S_(d.sana))) throw new S.Xato('Yangi shartnoma sanasi noto\'g\'ri.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(S_(d.birinchi))) throw new S.Xato('Birinchi oylik to\'lov sanasi noto\'g\'ri.');
  if (d.birinchi <= d.sana) throw new S.Xato('Birinchi oylik to\'lov shartnoma sanasidan keyin bo\'lishi kerak.');
  if (QT_TUR_MUDDATLI.indexOf(S_(d.turi)) < 0) throw new S.Xato('Yangi shartnoma turini tanlang.');
  const ijrochi = S_(d.ijrochi) || u.fish;
  const xodim = ijrochi !== u.fish;
  let XD = [];
  if (xodim) { XD = await TP.topXodimlar(); if (!XD.some(x => x.fish === ijrochi)) throw new S.Xato('Ijrochini ro\'yxatdan tanlang.'); }
  const sabab = S_(d.sabab) || QT_SABAB, eskiNomi = S_(d.eskiNomi);
  if (eskiNomi.length < 10) throw new S.Xato('Eski shartnomaning nomini yozing (qog\'ozdagidek).');
  let yoq = false, t = null;
  const w = await qulfBilan(async () => {
    const rows = await qtRows(); if (rows === null) { yoq = true; return null; }   // 06k yo'q yoki eski tuzilish — eski tizim o'zi ochadi / xato beradi
    const M = manba(true);
    const A = await qtTahlil(eski, rows, M); if (A.ogoh.length) throw new S.Xato(A.ogoh.join(' '));
    if (d.sana > V.bugun()) throw new S.Xato('Yangi shartnoma sanasi kelajakda bo\'lmasin — loyihani imzolash kuni yarating (skanlar shu sana bilan yuklanadi).');
    if (qtIsoD(A.d[2]) && d.sana < qtIsoD(A.d[2])) throw new S.Xato('Yangi shartnoma sanasi eski shartnoma sanasidan (' + A.d[2] + ') oldin bo\'lishi mumkin emas.');
    if (A.S.barcha.indexOf(yangi) >= 0) throw new S.Xato(yangi + ' raqami bazada allaqachon bor — boshqa raqam yozing.');
    const jq = (await qtJadvalRaqamlar(M))[yangi]; if (jq) throw new S.Xato(yangi + ' raqami bo\'yicha 03b da ' + jq + ' ta eski jadval qatori qolgan (o\'chirilgan shartnoma qoldig\'i) — boshqa raqam tanlang.');
    const band = qtBandRaqamlar(rows); if (band[yangi]) throw new S.Xato(yangi + ' raqami №' + band[yangi] + ' loyihada band.');
    const l = rows.length ? rows[rows.length - 1].qator : 1;
    let id = 0; rows.forEach(z => { const n = Number(z.id) || 0; if (n > id) id = n; }); id++;
    const vaqt = hozirHm();
    const r = A.r, qolgan = A.qiymat - A.tolangan;
    const row = [String(id), vaqt, 'Loyiha', eski, yangi, s(r[4] || ''), s(r[20] || ''), s(r[5] || ''), S_(d.turi),
      String(A.qiymat), String(A.tolangan), String(qolgan), qtDmy(d.sana), String(oy), String(kun), qtDmy(d.birinchi), sabab, eskiNomi, ijrochi, u.fish, '',
      '', '', '', '', '', '', '', '', '', vaqt + ' · ' + u.fish + ': loyiha yaratildi (ijrochi: ' + ijrochi + ')'];
    let q;
    try { q = await loyihaQatorYoz(QT_VARAQ, l, row); } catch (e) { if (e.yozilmadi) { yoq = true; return null; } throw e; }
    if (xodim) {
      t = await topshiriqYoz({ manba: 'Direktor', qoida: '', kalit: 'qayta|' + id, sarlavha: 'Shartnomani qayta tuzish: ' + eski + ' → ' + yangi + ' — 4 ta hujjatni tayyorlab imzolating, skanlarini yuklang',
        izoh: s(r[20] || '') + ' · ' + s(r[5] || '') + ' · ' + oy + ' oy, har oyning ' + kun + '-kuni', no: eski, mid: s(r[4] || ''), kimga: ijrochi, kimBerdi: u.fish,
        muddat: ertaga2() + ' 18:00', muhim: 'Oddiy' });
      await G.yoz(env.aksBazaId, [kat(QT_VARAQ, q, 21, String(t.id))], env.googleKey);
      TP.topTg(u.kod, [t], XD);
    }
    return { id, qator: q };
  });
  if (yoq) return eskiTizim('qaytaLoyiha', u, args.slice(1));
  await yangila([QT_VARAQ].concat(t ? [TOP_V] : []));
  return { ok: true, id: String(w.id), yangi, ijrochi, xodim };
}
// ================================================================== 3b) DIREKTOR: IJROCHINI ALMASHTIRISH (v2.3)
async function qaytaIjrochi(args) {
  const [kodSes, id, ijrochi0] = args;
  const u = await S.ruxsat(kodSes, 'admin');
  if (!(await serverda2(u.kod))) return eskiTizim('qaytaIjrochi', u, args.slice(1));
  const ijrochi = s(ijrochi0).trim() || u.fish;   // Kod.gs S_ — faqat trim (qaytaLoyiha dagi lokal S_ dan farqli)
  const xodim = ijrochi !== u.fish;
  let XD = [];
  if (xodim) { XD = await TP.topXodimlar(); if (!XD.some(z => z.fish === ijrochi && !z.admin)) throw new S.Xato('Ijrochini ro\'yxatdan tanlang.'); }
  let yoq = false, t = null, eski;
  await qulfBilan(async () => {
    const x = ((await qtRows()) || []).find(z => s(z.id) === s(id)); if (!x) throw new S.Xato('Loyiha topilmadi (№' + id + ').');
    if (['Loyiha', 'Qaytarildi'].indexOf(x.holati) < 0) throw new S.Xato('Ijrochi faqat «Loyiha» yoki «Qaytarildi» holatida almashtiriladi (hozir: ' + x.holati + ').');
    eski = s(x.ijrochi).trim();
    if (eski === ijrochi) throw new S.Xato('Ijrochi allaqachon ' + ijrochi + '.');
    try {
      await qtTop(x, 'Bekor', u.fish, 'ijrochi almashtirildi: ' + eski + ' → ' + ijrochi);   // eski topshiriq (bo'lsa) yopiladi
      await G.yoz(env.aksBazaId, [kat(QT_VARAQ, x.qator, 19, ijrochi), kat(QT_VARAQ, x.qator, 21, '')], env.googleKey);
    } catch (e) { if (e instanceof G.RuxsatYoq || e.yozilmadi) { yoq = true; return; } throw e; }
    if (xodim) {
      const bor = QT_HUJ.filter(h => x.skan[h[0]]).length;
      t = await topshiriqYoz({ manba: 'Direktor', qoida: '', kalit: 'qayta|' + x.id,
        sarlavha: 'Shartnomani qayta tuzish: ' + x.eski + ' → ' + x.yangi + ' — ' + (bor ? 'qolgan ' + (QT_HUJ.length - bor) + ' ta imzolangan skanni yuklang' : '4 ta hujjatni tayyorlab imzolating, skanlarini yuklang'),
        izoh: x.fish + ' · ' + x.dokon + ' · ' + x.oy + ' oy, har oyning ' + x.kun + '-kuni' + (eski ? ' · avvalgi ijrochi: ' + eski : ''), no: x.eski, mid: x.mid, kimga: ijrochi, kimBerdi: u.fish,
        muddat: ertaga2() + ' 18:00', muhim: 'Oddiy' });
      await G.yoz(env.aksBazaId, [kat(QT_VARAQ, x.qator, 21, String(t.id))], env.googleKey);
    }
    await G.yoz(env.aksBazaId, [jurnalKat(x, 'ijrochi almashtirildi: ' + (eski || '—') + ' → ' + ijrochi + (t ? ' (topshiriq №' + t.id + ')' : ''), u.fish)], env.googleKey);
  });
  if (yoq) return eskiTizim('qaytaIjrochi', u, args.slice(1));
  await yangila([QT_VARAQ, TOP_V]);
  if (t) TP.topTg(u.kod, [t], XD);
  return { ok: true, ijrochi, eski, topId: t ? String(t.id) : '', xodim };
}

// ================================================================== 7) DIREKTOR: TASDIQLASH — BAZAGA YOZISH
// Yarim qolsa (xato/uzilish) — loyiha «Yozilmoqda» holatida qoladi; ✓ qayta bosilsa, bajarilmagan qadamlarni bajaradi.
const F03Q = { matn: [1, 41, 42], sana: { 3: 'dd.MM.yyyy' }, son: { 9: '0.00%' }, formula: [[21, 40]] };   // Qayta.gs: A '@', C dd.MM.yyyy, I 0.00%, U:AN formulalar, AO:AP '@'
const F03BQ = { matn: [2], sana: { 4: 'dd.MM.yyyy' }, son: {}, formula: [] };
const matnKat = (g, qator, ustun, v) => ({ updateCells: { range: { sheetId: g, startRowIndex: qator - 1, endRowIndex: qator, startColumnIndex: ustun - 1, endColumnIndex: ustun },
  rows: [{ values: [{ userEnteredValue: { stringValue: s(v) }, userEnteredFormat: { numberFormat: { type: 'TEXT', pattern: '@' } } }] }], fields: 'userEnteredValue,userEnteredFormat.numberFormat' } });   // setNumberFormat('@').setValue(matn)
const sanaFmt = (g, qator, ustun) => ({ repeatCell: { range: { sheetId: g, startRowIndex: qator - 1, endRowIndex: qator, startColumnIndex: ustun - 1, endColumnIndex: ustun }, cell: { userEnteredFormat: { numberFormat: { type: 'DATE', pattern: 'dd.MM.yyyy' } } }, fields: 'userEnteredFormat.numberFormat' } });
const kumKopya = (g, src, row, n) => ({ copyPaste: { source: { sheetId: g, startRowIndex: src - 1, endRowIndex: src, startColumnIndex: 5, endColumnIndex: 6 }, destination: { sheetId: g, startRowIndex: row - 1, endRowIndex: row - 1 + n, startColumnIndex: 5, endColumnIndex: 6 }, pasteType: 'PASTE_FORMULA', pasteOrientation: 'NORMAL' } });
// Yozuv yadrosi (sinov nusxa varaqlarda shuni ishlatadi): VQ — varaq nomlari {k, s3, s3b, s5, s5b}; x — 06k loyihasi; M — manba(true, VQ nomlari)
// Tartib va kataklar Qayta.gs qaytaTasdiq bilan bir xil: 1) 03 yangi qator, 2) 03b jadval, 3) to'lovlar, 4) eski shartnoma «Bekor qilindi», 5) 06k «Bajarildi»
async function tasdiqYadro(VQ, u, x, M, davom) {
  const vaqt = hozirHm(), sana = x.sana;
  const belgi = 'QAYTA TUZISH: ' + x.sana + ' o\'zaro kelishuv — ' + x.eski + ' o\'rniga (to\'langan ' + qtFmt(x.tolangan) + ' dastlabki to\'lovga o\'tdi; loyiha №' + x.id + ')';
  const belgiEski = 'QAYTA TUZILDI: ' + x.sana + ' o\'zaro kelishuv — o\'rniga ' + x.yangi + ' tuzildi (loyiha №' + x.id + ')';
  let S3 = await qtShartnoma(x.eski, M); if (!S3.x) throw new S.Xato('Eski shartnoma topilmadi: ' + x.eski);
  const r = S3.x.r;
  const g3 = await G.gid(env.aksBazaId, VQ.s3, env.googleKey), g3b = await G.gid(env.aksBazaId, VQ.s3b, env.googleKey);
  // 1) 03 — yangi qator (qiymat va 1 m² narxi eskisidan; formulalar yuqoridagi qatordan)
  if (S3.barcha.indexOf(x.yangi) < 0) {
    const sl = (await SY.aUstun(VQ.s3)).last;
    const q3 = [x.yangi, Number(x.yangi.split('/')[1]), sana, x.turi, r[4], r[5], r[6], r[7], x.qiymat ? Math.round(x.tolangan / x.qiymat * 10000) / 10000 : 0, x.tolangan,
      0, x.oy, x.kun, 'Aktiv', '', '', '', r[17], '', belgi];
    for (let i = 21; i <= 40; i++) q3.push(null);   // U:AN — formulalar (copyPaste)
    q3.push(vaqt, u.fish);                           // AO:AP
    await SY.qatorlarYoz(VQ.s3, sl + 1, [q3], F03Q);
    M.yangila('03_Sotuv_shartnomalar');
  } else {   // davom: qator bor — formulalari va «Kiritildi/Kiritdi» joyidami
    const row = S3.barcha.indexOf(x.yangi) + 2;
    const [Fw, AO] = await Promise.all([G.oraliqOqi(env.aksBazaId, VQ.s3, 'W' + row, env.googleKey, 'FORMULA'), G.oraliqOqi(env.aksBazaId, VQ.s3, 'AO' + row, env.googleKey)]);
    const req = [];
    if (!/^=/.test(s((Fw[0] || [])[0]))) req.push({ copyPaste: { source: { sheetId: g3, startRowIndex: row - 2, endRowIndex: row - 1, startColumnIndex: 20, endColumnIndex: 40 }, destination: { sheetId: g3, startRowIndex: row - 1, endRowIndex: row, startColumnIndex: 20, endColumnIndex: 40 }, pasteType: 'PASTE_FORMULA', pasteOrientation: 'NORMAL' } });
    if (!s((AO[0] || [])[0])) req.push(matnKat(g3, row, 41, vaqt), matnKat(g3, row, 42, u.fish));
    if (req.length) await G.soralar(env.aksBazaId, req, env.googleKey);
  }
  // 2) 03b — dastlabki (to'langan) + N oy; F (Kumulyativ) — formula yuqoridagi sog' qatordan (kumF_)
  const Jd = qtJadval(x.qolgan, x.oy, qtIsoD(x.birinchi), x.kun);
  const R3b = aOxiri(await M.q('03b_Tolov_jadvali')), jl = R3b.length ? R3b[R3b.length - 1].n : 1;
  const J03 = R3b.filter(z => s(z.r[1]).trim() === x.yangi);
  if (J03.some(z => !/^Qayta tuzish/.test(s(z.r[7])))) throw new S.Xato('03b da ' + x.yangi + ' raqamida boshqa (eski) jadval qatorlari bor — tasdiqlab bo\'lmaydi, menga murojaat qiling.');
  if (!J03.length) {
    let jid = 0; R3b.forEach(z => { const n = Number(z.x[0]) || 0; if (n > jid) jid = n; });
    const vals = [[++jid, x.yangi, 0, sana, x.tolangan, x.tolangan, "Boshlang'ich", 'Qayta tuzish: ' + u.fish]]
      .concat(Jd.map(j => [++jid, x.yangi, j.t, qtDmy(j.sana), j.summa, j.summa, 'Oylik', 'Qayta tuzish: ' + u.fish]));
    const src = await SY.kumManba(VQ.s3b, jl + 1);
    await SY.qatorlarYoz(VQ.s3b, jl + 1, vals, F03BQ, [g => kumKopya(g, src, jl + 1, vals.length)]);
  } else {   // davom: yangi raqam qatorlarida F formulasi borligini tekshirish
    const Fo = await G.oraliqOqi(env.aksBazaId, VQ.s3b, 'F2:F' + jl, env.googleKey, 'FORMULA');
    const req = [];
    for (const z of J03) { const f = s((Fo[z.n - 2] || [])[0]); if (!/^=/.test(f) || /R\[/.test(f)) req.push(kumKopya(g3b, await SY.kumManba(VQ.s3b, z.n), z.n, 1)); }
    if (req.length) await G.soralar(env.aksBazaId, req, env.googleKey);
  }
  M.yangila('03b_Tolov_jadvali');
  // 3) to'lovlarni ko'chirish (sanalar o'zgarmaydi) — faqat hali eski raqamda turganlari
  const g5 = await G.gid(env.aksBazaId, VQ.s5, env.googleKey), g5b = await G.gid(env.aksBazaId, VQ.s5b, env.googleKey);
  const T = await qtTolovlar(x.eski, M), Cq = [], Yv = [];
  const izohi = t => (t.izoh ? t.izoh + ' | ' : '') + x.eski + ' dan ' + x.yangi + ' ga o\'tkazildi (qayta tuzish ' + x.sana + ')';
  T.forEach(t => {
    if (t.v === '05') { Cq.push(matnKat(g5, t.qator, 3, x.yangi)); Yv.push(kat(VQ.s5, t.qator, 9, x.eski), kat(VQ.s5, t.qator, 12, izohi(t))); }
    else { Cq.push(matnKat(g5b, t.qator, 3, x.yangi)); Yv.push(kat(VQ.s5b, t.qator, 6, izohi(t))); }
  });
  if (davom) (await qtTolovlar(x.yangi, M)).forEach(t => { if (t.v === '05' && !t.kochdi) Yv.push(kat(VQ.s5, t.qator, 9, x.eski), kat(VQ.s5, t.qator, 12, izohi(t))); });   // yarim ko'chgan qator
  if (Cq.length) await G.soralar(env.aksBazaId, Cq, env.googleKey);
  if (Yv.length) await G.yoz(env.aksBazaId, Yv, env.googleKey);
  M.yangila('05_Tolovlar'); M.yangila('05b_Bufer_tolovlar');
  const TK = await qtTolovlar(x.yangi, M);   // yangi shartnomadagi hamma to'lovlar = ko'chirilganlar
  // 4) eski shartnoma — bekor (belgisi alohida: QAYTA TUZILDI)
  S3 = await qtShartnoma(x.eski, M);
  if (!/bekor/i.test(s(S3.x.r[13]))) {
    await G.yoz(env.aksBazaId, [kat(VQ.s3, S3.x.qator, 14, 'Bekor qilindi'), kat(VQ.s3, S3.x.qator, 15, sana), kat(VQ.s3, S3.x.qator, 20, (S3.x.r[19] ? s(S3.x.r[19]) + ' | ' : '') + belgiEski)], env.googleKey);
    await G.soralar(env.aksBazaId, [sanaFmt(g3, S3.x.qator, 15)], env.googleKey);
  }
  // 5) loyiha — bajarildi
  const gk = await G.gid(env.aksBazaId, VQ.k, env.googleKey);
  await G.yoz(env.aksBazaId, [kat(VQ.k, x.qator, 3, 'Bajarildi')], env.googleKey);
  await G.soralar(env.aksBazaId, [matnKat(gk, x.qator, 28, vaqt), matnKat(gk, x.qator, 29, u.fish), matnKat(gk, x.qator, 30, TK.map(t => t.v + ':' + t.id).join(', '))], env.googleKey);
  await G.yoz(env.aksBazaId, [Object.assign(jurnalKat(x, 'TASDIQLANDI — bazaga yozildi: ' + TK.length + ' ta to\'lov ko\'chdi, jadval ' + x.oy + ' oy', u.fish), { varaq: VQ.k })], env.googleKey);
  return { ok: true, eski: x.eski, yangi: x.yangi, tolovlar: TK.length, tolangan: x.tolangan, qolgan: x.qolgan, oylik: Jd[0].summa, oxirgi: Jd[Jd.length - 1].summa, tugash: qtDmy(Jd[Jd.length - 1].sana), mid: x.mid };
}
const VQ_ASL = { k: QT_VARAQ, s3: '03_Sotuv_shartnomalar', s3b: '03b_Tolov_jadvali', s5: '05_Tolovlar', s5b: '05b_Bufer_tolovlar' };
async function qulfShartnoma(ish) {   // 03/03b yozuvi — shartnoma_yoz.js bilan bitta qulf (qator raqamlari to'qnashmasin)
  const kalit = 'qulf:shartnoma', belgi = crypto.randomBytes(8).toString('hex'), t0 = Date.now();
  while (!(await redis.set(kalit, belgi, 'PX', 60000, 'NX'))) { if (Date.now() - t0 > 30000) throw new S.Xato('Tizim band — birozdan keyin qayta urinib ko\'ring.'); await new Promise(r => setTimeout(r, 150)); }
  try { return await ish(); } finally { if ((await redis.get(kalit)) === belgi) await redis.del(kalit); }
}
async function qaytaTasdiq(args) {
  const [kodSes, id] = args;
  const u = await S.ruxsat(kodSes, 'admin');
  if (!(await serverda2(u.kod))) return eskiTizim('qaytaTasdiq', u, args.slice(1));
  let yoq = false, natija, x;
  await qulfBilan(() => qulfShartnoma(async () => {
    x = ((await qtRows()) || []).find(z => s(z.id) === s(id)); if (!x) throw new S.Xato('Loyiha topilmadi.');
    if (QT_FAOL.indexOf(x.holati) < 0) throw new S.Xato('Loyiha «' + x.holati + '» holatida.');
    const davom = x.holati === 'Yozilmoqda';
    const M = manba(true);
    const H = await qtHolat(x, true, await QH.hjYangi(), M);
    if (!H.tayyor) throw new S.Xato('4 ta imzolangan skan yuklanmagan: ' + H.skan.filter(z => !z.bor).map(z => z.nom).join(', ') + '.');
    const S3 = await qtShartnoma(x.eski, M); if (!S3.x) throw new S.Xato('Eski shartnoma topilmadi: ' + x.eski);
    if (!davom) {
      if (H.ogoh.length) throw new S.Xato(H.ogoh.join(' '));
      const A = await qtTahlil(x.eski, await qtRows(), M);
      const og = A.ogoh.filter(m => !/ochiq loyiha bor/.test(m)); if (og.length) throw new S.Xato(og.join(' '));
      try { await G.yoz(env.aksBazaId, [kat(QT_VARAQ, x.qator, 3, 'Yozilmoqda'), jurnalKat(x, 'tasdiq boshlandi', u.fish)], env.googleKey); }
      catch (e) { if (e instanceof G.RuxsatYoq) { yoq = true; return; } throw e; }
      x = ((await qtRows()) || []).find(z => s(z.id) === s(id));
    } else {
      const yi = S3.barcha.indexOf(x.yangi);
      if (yi >= 0 && s(aOxiri(await M.q('03_Sotuv_shartnomalar'))[yi].x[19]).indexOf('loyiha №' + x.id + ')') < 0) throw new S.Xato(x.yangi + ' raqami bazada boshqa shartnomaga tegishli — menga murojaat qiling.');
      if (yi < 0) {   // hali hech narsa yozilmagan — to'liq tekshiruv
        const og1 = await qtOgoh(x, M); if (og1.length) throw new S.Xato(og1.join(' '));
        const og2 = (await qtTahlil(x.eski, await qtRows(), M)).ogoh.filter(m => !/ochiq loyiha bor/.test(m)); if (og2.length) throw new S.Xato(og2.join(' '));
      }
    }
    natija = await tasdiqYadro(VQ_ASL, u, x, M, davom);
    await qtTop(x, 'Bajarildi', 'tizim', 'qayta tuzish tasdiqlandi (' + u.fish + ')');
  }));
  if (yoq) return eskiTizim('qaytaTasdiq', u, args.slice(1));
  const tsh = await SY.tashrifAvto(qtIsoD(x.sana), x.mid, 'Дўкон сотиб олиш масаласида', x.ijrochi || u.fish, 'Шартнома ' + x.yangi + ' (қайта тузиш)');
  await yangila(['03_Sotuv_shartnomalar', '03b_Tolov_jadvali', '05_Tolovlar', '05b_Bufer_tolovlar', QT_VARAQ, TOP_V].concat(tsh === 'yozildi' ? ['01b_Tashrif_jurnali'] : []));
  koprik.chaqir('koprikTgYubor', u.kod, ['🔁 <b>Shartnoma qayta tuzildi</b>\n' + x.eski + ' → <b>' + x.yangi + '</b> · ' + x.fish + ' · ' + x.dokon + '\nTo\'langan ' + qtFmt(x.tolangan) + ' dastlabki to\'lovga o\'tdi (' + natija.tolovlar + ' ta to\'lov)\nQolgan ' + qtFmt(x.qolgan) + ' · ' + x.oy + ' oy × ' + qtFmt(natija.oylik) + ' · tugash ' + natija.tugash + '\nTasdiqladi: ' + u.fish])
    .catch(e => console.error('qayta tg:', e.message));
  return natija;
}

// ================================================================== 4) HUJJATLAR — 4 ta PDF (Qayta.gs v2.3 qaytaHujjatlar bilan bir xil matn va joylashuv)
// Eski tizim: Google Doc shablonlari nusxalanib to'ldiriladi, PDF Docs'dan olinadi (40–70 s), Drive'da loyiha papkasi (06k Z) + jurnal.
// Server: shablonlar robot orqali (Google DOCX eksporti), to'ldirish modelda (lib/docs_shablon.js), PDF Chromium (lib/shablon_pdf.js) — 2–4 s;
// PDF lar /opt/aks/hujjat/qayta/<id>/ da. Drive papkasi, Google Doc nusxalari, 06k Z va jurnal — fonda eski qaytaHujjatlar ning o'zi
// (ko'prik orqali, xodim kutmaydi) — Drive arxivi avvalgidek. Bayroq: yozuv_yondi:qayta_hujjat («aks-yozuv-sinov qaytahuj»).
async function bayroq3() { try { return (await redis.get('yozuv_yondi:qayta_hujjat')) === '1'; } catch (e) { return false; } }
async function qtMijoz(mid) { return ((await V.qatorlar('02_Mijozlar')).find(z => s(z.r[0]) === s(mid)) || { r: null }).r; }   // qtMijoz_: 02 (displayValues, 25 ustun)
function qtBandlar(tur) { return /^Қурилаётган/.test(tur) && /Муддатли/.test(tur) ? ['5.1 ва 5.3', '5.4, 5.5 ва 6.2'] : ['2.7 ва 3.3.1', '3.3.2, 4.2 ва 4.3']; }
function qtShakl(x) { x = s(x); return /naq|нақд|наличн/i.test(x) ? 'Нақд' : /barter|ўзаро|o'zaro/i.test(x) ? 'Ўзаро ҳисоб' : /plastik|karta|карт|uzcard|humo/i.test(x) ? 'Пластик карта' : /bank|банк|o'tkazma|перечис/i.test(x) ? 'Банк' : x; }
// hujjatlardagi <<BELGI>> qiymatlari (qtBelgilar_)
function qtBelgilar(x, e, mr) {
  const vil = v => { v = s(v).trim(); return !v || /вилоят|viloyat|шаҳр|shahr|Республика/i.test(v) ? v : v + ' вилояти'; };
  const toza = (v, suf) => s(v).trim().replace(suf, '').trim();
  const kocha = toza(mr[16], /\s*(кўчаси|ko['`ʻ]?chasi|kochasi)\s*$/i), mfy = toza(mr[15], /\s*(МФЙ|MFY)\s*$/i), uy = toza(mr[17], /\s*-?\s*(уй|uy)\s*$/i), xon = toza(mr[18], /\s*-?\s*(хонадон|xonadon)\s*$/i);
  const manzil = [vil(mr[13]), mr[14] || '', mfy ? mfy + ' МФЙ' : '', kocha ? kocha + ' кўчаси' : '', uy ? uy + '-уй' : '', xon ? xon + '-хонадон' : ''].filter(Boolean).join(', ');
  const P = s(mr[2]).trim().split(/\s+/);
  const bosh = z => { const m = /^.[`'ʻʼ’]?/.exec(z || ''); return m ? m[0] + '.' : ''; };
  const dk = s(x.dokon).split('-'), B = qtBandlar(s(e[3] || ''));
  const yangiNomi = (QT_NOMI[x.turi] || ['', ''])[1] || x.turi;
  return { SANA: x.sana, SANA_MATN: SH.sanaMatn(x.sana), FISH: mr[2], FISH_QISQA: (P[0] || '') + (P[1] ? ' ' + bosh(P[1]) : '') + (P[2] ? bosh(P[2]) : ''),
    PASPORT: mr[6], IIB: [vil(mr[7]), mr[8]].filter(Boolean).join(', ') + ' ИИБ', PAS_SANA: mr[9], PAS_MUDDAT: mr[10], JSHSHIR: mr[11], MANZIL: manzil, TEL: SH.telPlus(mr[4]),
    ESKI_NO: x.eski, ESKI_SANA_MATN: SH.sanaMatn(e[2]), ESKI_NOMI: x.eskiNomi, YANGI_NO: x.yangi, YANGI_NOMI: yangiNomi,
    BLOK: dk[0] || '', QAVAT: dk[1] || '', DOKON: dk[2] || '', MAYDON: s(e[6]).replace('.', ','),
    QIYMAT: qtFmt(x.qiymat), TOLANGAN: qtFmt(x.tolangan), TOLANGAN_SOZ: SH.sozBilan(x.tolangan), QOLDIQ: qtFmt(x.qolgan), OY: String(x.oy), OY_SOZ: SH.sozBilan(x.oy),
    SABAB: x.sabab, ESKI_PENYA_BANDLARI: B[0], ESKI_QAYTARISH_BANDLARI: B[1] };
}
// shablondan PDF (qtDocPdf_): tana + kolontitullar; tolovlar berilsa — <<T_…>> qatori har to'lovga ko'paytiriladi
async function qtDocPdf(shablonNom, nom, T, tolovlar) {
  const sh = await DS.ol(shablonNom), m = sh.model, body = m.el;
  if (tolovlar) {
    const q = DS.belgiQatori(body, '<<T_NO>>');
    if (q) {
      const asl = q.tbl.rows[q.ix];
      tolovlar.forEach((t, i) => { const yq = DS.qatorNusxa(asl); q.tbl.rows.splice(q.ix + 1 + i, 0, yq); const el = [].concat(...yq.cells.map(c => c.el));
        DS.replaceText(el, '<<T_NO>>', String(i + 1)); DS.replaceText(el, '<<T_SANA>>', qtDmy(t.sana)); DS.replaceText(el, '<<T_SHAKL>>', qtShakl(t.shakl)); DS.replaceText(el, '<<T_SUMMA>>', qtFmt(t.summa)); });
      q.tbl.rows.splice(q.ix, 1);
    }
  }
  const qoy = el => { if (!el) return; for (const k in T) DS.replaceText(el, '<<' + SH.rx(k) + '>>', s(T[k])); };
  qoy(body); qoy(m.footer); qoy(m.header);
  const qolgan = DS.qolganBelgilar(body);
  const r = await SP.yasa(m);
  return { nom: nom + '.pdf', pdf: r.pdf, bet: r.bet, qolgan, shablon: { id: sh.id, nom: sh.nom, modifiedTime: sh.modifiedTime } };
}
// 4 ta hujjatni yasash (bazaga yozmaydi): x — 06k loyihasi, e — eski shartnoma 03 qatori (displayValues), mr — 02 qatori, tolovlar — qtTolovlar
async function hujjatlarYasa(x, e, mr, tolovlar) {
  const nf = x.yangi.replace('/', '-'), ef = x.eski.replace('/', '-'), fam = s(mr[2]).split(' ')[0];
  const T = qtBelgilar(x, e, mr);
  const N = [];
  for (const h of [['ariza', 'Qayta_ariza_shablon', '1_Ariza_' + ef + '_' + fam], ['kelishuv', 'Qayta_kelishuv_shablon', '2_Kelishuv_bekor_qilish_' + ef + '_' + fam],
    ['solishtirma', 'Qayta_solishtirma_shablon', '3_Solishtirma_dalolatnoma_' + ef + '_' + fam]]) {
    N.push(Object.assign({ k: h[0] }, await qtDocPdf(h[1], h[2], T, h[0] === 'solishtirma' ? tolovlar : null)));
  }
  // 4: yangi shartnoma — sotuvHujjat (Код v9.2+), virtual qator
  const r = e.slice(); r[0] = x.yangi; r[2] = x.sana; r[3] = x.turi; r[9] = String(x.tolangan); r[10] = '0'; r[11] = String(x.oy); r[12] = String(x.kun); r[22] = String(x.qiymat);
  const jad = qtJadval(x.qolgan, x.oy, qtIsoD(x.birinchi), x.kun).map(j => ({ sana: qtDmy(j.sana), summa: j.summa }));
  const nom4 = '4_Shartnoma_' + nf + '_' + fam + '_' + x.dokon;
  const h4 = await SH.sotuvHujjat(r, mr, jad, { nom: nom4, qayta: { eskiNo: x.eski, eskiSana: e[2], kelSana: x.sana } });
  N.push({ k: 'shartnoma', nom: nom4 + '.pdf', pdf: h4.pdf, bet: h4.bet, qolgan: h4.qolgan, bosh: h4.bosh, shablon: h4.shablon });
  return N;
}
async function qaytaHujjatlar(args) {
  const [kodSes, id] = args;
  const x = ((await qtRows()) || []).find(z => s(z.id) === s(id)); if (!x) throw new S.Xato('Loyiha topilmadi.');
  const u = await qtKirish(kodSes, x);
  if (!(await serverda(u.kod)) || !(await bayroq3()) || !(await PDF.bor())) return eskiTizim('qaytaHujjatlar', u, args.slice(1));
  if (['Loyiha', 'Qaytarildi', 'Tekshiruvda'].indexOf(x.holati) < 0) throw new S.Xato('Loyiha «' + x.holati + '» holatida.');
  const H = await qtHolat(x, u.admin); if (H.ogoh.length) throw new S.Xato(H.ogoh.join(' '));
  const S3 = await qtShartnoma(x.eski); if (!S3.x) throw new S.Xato('Eski shartnoma topilmadi: ' + x.eski);
  const e = S3.x.d;
  const mr = await qtMijoz(x.mid); if (!mr) throw new S.Xato('Mijoz 02 da topilmadi (ID ' + x.mid + ').');
  const tolovlar = await qtTolovlar(x.eski);
  const N = await hujjatlarYasa(x, e, mr, tolovlar);
  // PDF lar diskda (arxiv): /opt/aks/hujjat/qayta/<id>/<nom>
  try { const dir = path.join(env.hujjatPapka || '/opt/aks/hujjat', 'qayta', String(x.id).replace(/[^\w-]/g, '_')); fs.mkdirSync(dir, { recursive: true }); N.forEach(n => fs.writeFileSync(path.join(dir, n.nom), n.pdf)); }
  catch (err) { console.error('qayta hujjat: diskka yozilmadi:', err.message); }
  // fonda: eski tizimning o'zi Drive papkasi + Google Doc nusxalari + 06k Z va jurnal (avvalgidek; natijasi kutilmaydi)
  // 23.10: eski qaytaHujjatlar har bosishda papkada yangi Doc + PDF qoldiradi — tayyor bo'lgach eski nusxalar savatga (Koprik ≥ 1.17, shartnoma_pdf.js nusxaTozala)
  const qtPapka = ['AKS TIZIM', '03 HUJJATLAR', '03.3 Qayta tuzish', x.id + ' ' + s(x.eski).replace('/', '-') + ' → ' + s(x.yangi).replace('/', '-') + ' ' + s(x.fish).split(' ')[0]];
  koprik.chaqir('qaytaHujjatlar', u.kod, [x.id], { muddat: 300000, urinish: 1 })
    .then(async () => { const SP = require('./shartnoma_pdf')._ichki; for (const n of N) await SP.nusxaTozala(u.kod, qtPapka, s(n.nom).replace(/\.pdf$/, '')); })
    .then(() => yangila([QT_VARAQ])).catch(err => console.error('qayta hujjat (Drive, eski tizim):', err.message));
  const qolgan = [].concat(...N.map(n => n.qolgan || []));
  return { ok: true, fayllar: N.map(n => ({ k: n.k, nom: n.nom, b64: n.pdf.toString('base64') })), qolgan: Array.from(new Set(qolgan)), bosh: N[3].bosh || [], papka: u.admin ? s(x.papka) : '' };
}

module.exports = { qaytaKor, qaytaOchiq, qaytaSkan, qaytaTekshiruvga, qaytaQaytar, qaytaLoyiha, qaytaIjrochi, qaytaTasdiq, qaytaHujjatlar, qaytaBekor };
module.exports._ichki = { bekorYadro, koprik114, qtRows, qtShartnoma, qtTolovlar, qtTahlil, qtOgoh, qtHolat, qtJadval, qtOyQosh, qtFmt, qtKeyingiNo, hujjatBekor, manba, tasdiqYadro, loyihaQatorYoz, QT_VARAQ, VQ_ASL, QT_N, qtMijoz, qtBelgilar, qtDocPdf, hujjatlarYasa, qtIsoD, qtDmy };
