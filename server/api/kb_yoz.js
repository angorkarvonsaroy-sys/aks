// AKS TIZIM — 🤝 IJARANI O'ZARO KELISHUV BILAN BEKOR QILISH: kbTayyorla serverda (KelishuvBekor.gs v1.0 bilan bir xil tekshiruvlar, xato matnlari,
// 06m_Kelishuv_bekor kataklari va javob). Hujjat (1-varaq kelishuv + 2-varaq dalolatnoma) — lib/kb_hujjat.js (eski DocumentApp kodi serverda), PDF va Word.
// Fayllar avval SERVERDA saqlanadi (/opt/aks/hujjat/kb/<yil>/…), 06m N «PDF_ID» / O «DOC_ID» = «SRV:<yo'l>» — xodim darhol oladi (kbFayl ham shu nusxani beradi).
// Keyin fonda eski tizim (Koprik v1.12 koprikKbSaqla) ikkala faylni direktor Drive'iga — «AKS TIZIM / 07 BEKOR QILISH / Kelishuv / <yil>» — qo'yadi va
// N/O ga Drive ID yoziladi (agar hali shu SRV bo'lsa). Qayta tayyorlanganda eski fayllar savatga (kbOchir_).
//   kbSkan   — ikkala tomon imzolagan skan: serverda (SRV) + fonda Drive (Koprik v1.13 koprikKbSaqla skan), 06m M «Tasdiq kutilmoqda», P:R, T:V tozalanadi, X sahifa, tarix; direktorga Telegram.
//   kbBekor  — so'rovni yopish (tayyorlagan xodim yoki direktor): M «Bekor», tarix.
//   kbTasdiq — direktor ✅: shartlar QAYTA tekshiriladi (kbTekshir), 04 C «Bekor qilindi» / D bekor sanasi / W izoh, 06j jurnal, 06m M «Tasdiqlandi» + T:V, tarix;
//              qulfdan keyin skan 06d ga «QOSHIMCHA_KELISHUV» bo'lib (hujjat_yoz yuklaYadro — serverda, Drive fonda), 01 nazorati; ✖: «Rad etildi» + T:V; xodim(lar)ga Telegram.
// Yoqilishi: kbTayyorla — Redis yozuv_yondi:kb («aks-yozuv-sinov kb»); kbSkan/kbBekor/kbTasdiq — yozuv_yondi:kb2 («aks-yozuv-sinov kb2», Koprik ≥ 1.13). Aks holda — eski tizim.
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { verOk } = require('../lib/versiya');
const S = require('./sessiya');
const G = require('../lib/google');
const env = require('../lib/env');
const koprik = require('./koprik');
const tetik = require('../lib/kozgu_tetik');
const PDF = require('../lib/pdf');
const KBH = require('../lib/kb_hujjat');
const V = require('../lib/varaq');
const TY = require('./tahrir_yoz')._ichki;
const { redis } = require('../lib/db');

const KB_V = KBH.KB_VARAQ, N = KBH.KB_SARLAVHA.length;
const ILDIZ = env.hujjatPapka || '/opt/aks/hujjat';
const DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const s = v => String(v == null ? '' : v);
const kut = (p, ms) => Promise.race([p, new Promise(r => setTimeout(r, ms))]);
const yangila = nomlar => kut(tetik.varaqlarYangila(nomlar).catch(e => console.error('ko\'zgu (kb):', e.message)), 15000);
function hozir() { const d = new Date(Date.now() + 5 * 3600 * 1000), p = n => String(n).padStart(2, '0');
  return { dmyHm: p(d.getUTCDate()) + '.' + p(d.getUTCMonth() + 1) + '.' + d.getUTCFullYear() + ' ' + p(d.getUTCHours()) + ':' + p(d.getUTCMinutes()), iso: d.toISOString().slice(0, 10) }; }
function yozilmadi(e) { if (e instanceof G.RuxsatYoq) e.yozilmadi = true; return e; }
const xato = m => new S.Xato(m);

let kver = { v: '', t: 0 };
async function koprikVer(kod) {   // Koprik.gs versiyasi — 30 daqiqa kesh (olinmasa 2 daqiqa)
  if (kver.t && Date.now() - kver.t < (kver.v ? 30 : 2) * 60000) return kver.v;
  try { kver = { v: koprik.bor() ? String(await koprik.chaqir('koprikVersiya', kod, [])) : '', t: Date.now() }; } catch (e) { kver = { v: '', t: Date.now() }; }
  return kver.v;
}
async function koprik112(kod) { return verOk(await koprikVer(kod), '1.12'); }   // koprikKbSaqla (PDF + Word)
async function koprik113(kod) { return verOk(await koprikVer(kod), '1.13'); }   // koprikKbSaqla skan
async function serverda() { try { return (await redis.get('yozuv_yondi:kb')) === '1' && (await PDF.bor()); } catch (e) { return false; } }
async function serverda2(kod) { try { if ((await redis.get('yozuv_yondi:kb2')) !== '1') return false; } catch (e) { return false; } return koprik113(kod); }
async function eskiTizim(fn, u, args) { const r = await koprik.chaqir(fn, u.kod, args, { muddat: 120000, urinish: 1 }); await tetik.yangilaKut(20000); return r; }
async function qulfBilan(ish) {   // LockService.getScriptLock() o'rni
  const kalit = 'qulf:kb', belgi = crypto.randomBytes(8).toString('hex'), t0 = Date.now();
  while (!(await redis.set(kalit, belgi, 'PX', 30000, 'NX'))) { if (Date.now() - t0 > 30000) throw xato('Tizim band — birozdan keyin qayta urinib ko\'ring.'); await new Promise(r => setTimeout(r, 150)); }
  try { return await ish(); } finally { if ((await redis.get(kalit)) === belgi) await redis.del(kalit); }
}
async function kbU(kodSes) {   // kbU_
  const u = await S.foydalanuvchi(kodSes); if (!u) throw xato('Sessiya tugagan — PIN ni qayta kiriting.');
  if (!KBH.kbHuquq(u)) throw xato('Ijarani kelishuv bilan bekor qilishga ruxsatingiz yo\'q (huquq: «' + KBH.KB_HUQUQ + '»). Direktorga murojaat qiling.');
  return u;
}

// ------------------------------------------------------------------ o'qish (Google'dan YANGI): kbRows_ (getDisplayValues, A oxirigacha); l — ustunA_oxiri_
async function kbRowsYangi(varaq) {
  const X = await G.oraliqOqi(env.aksBazaId, varaq || KB_V, 'A2:X', env.googleKey);
  let m = -1; X.forEach((r, i) => { if (s(r[0]) !== '') m = i; });
  return { L: KBH.kbRowsDan(X.slice(0, m + 1).map((r, i) => ({ qator: i + 2, r }))), l: m + 2 };
}

// ------------------------------------------------------------------ fayllar serverda
function saqla(rel, buf) { const yol = path.join(ILDIZ, rel); fs.mkdirSync(path.dirname(yol), { recursive: true }); fs.writeFileSync(yol, buf); return 'SRV:' + rel; }
function ochirSrv(id) { if (/^SRV:/.test(s(id))) { try { fs.unlinkSync(path.join(ILDIZ, s(id).slice(4))); } catch (e) { } } }

// ------------------------------------------------------------------ yozuv yadrolari (sinov ham shularni ishlatadi — nusxa varaqda)
// yangi so'rov qatori (A–X): ID = A dagi eng kattasi + 1, A ustunining oxirgi to'ldirilgan qatoridan keyin. Qaytaradi { id, qator }
async function kbSorovYoz(varaq, R, o) {
  const id = (R.L.length ? Math.max(...R.L.map(z => Number(z.id) || 0)) : 0) + 1;
  const vaqt = hozir().dmyHm;
  const row = [id, vaqt].concat(o.qator).concat(['Hujjat tayyorlandi', o.pdfId, o.docId, '', '', '', o.kim, '', '', '', vaqt + ' ' + o.kim + ': tayyorlandi', '']);
  try { const q = await G.qatorQoshR(env.aksBazaId, varaq, R.l + 1, row, env.googleKey); return { id, qator: q, vaqt }; }
  catch (e) { throw yozilmadi(e); }
}
// qayta tayyorlash: C–L (shartnoma ma'lumotlari) va M–R (holat, PDF, DOC, skan tozalanadi) + tarix
async function kbQaytaYoz(varaq, eski, o, kim) {
  const vaqt = hozir().dmyHm;
  try {
    await G.yoz(env.aksBazaId, [{ varaq, katak: 'C' + eski.qator + ':L' + eski.qator, qiymat: [o.qator] },
      { varaq, katak: 'M' + eski.qator + ':R' + eski.qator, qiymat: [['Hujjat tayyorlandi', o.pdfId, o.docId, '', '', '']] }], env.googleKey);
    await kbTarix(varaq, eski.qator, vaqt + ' ' + kim + ': qayta tayyorlandi' + (eski.skan ? '; oldingi skan papkada qoldi: ' + eski.skan : ''));
  } catch (e) { throw yozilmadi(e); }
  return { vaqt };
}
async function kbTarix(varaq, qator, matn) {   // kbTarix_: W — eskisiga qo'shib
  const e = s(((await G.oraliqOqi(env.aksBazaId, varaq, 'W' + qator, env.googleKey))[0] || [])[0]);
  await G.yoz(env.aksBazaId, [{ varaq, katak: 'W' + qator, qiymat: [[(e ? e + '\n' : '') + matn]] }], env.googleKey);
}

// ------------------------------------------------------------------ kbTayyorla(kod, d) — kelishuv + dalolatnomani tayyorlash (yoki qayta tayyorlash)
// d = { id?, no, sabab, sana 'yyyy-mm-dd', qarzYoq: bool, qarz: so'm, kalit, hisob, holat: 'soz'|'kamchilik', izoh, format: 'pdf'|'doc' }
async function kbTayyorla(args) {
  const [kodSes, d0] = args; const d = d0 || {};
  const u = await kbU(kodSes);
  const Sx = KBH.kbS;
  const no = Sx(d.no), sabab = Sx(d.sabab).slice(0, 500);
  if (sabab.length < 10) throw xato('Bekor qilish sababini yozing (kamida 10 belgi).');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s(d.sana))) throw xato('Bekor qilish va do\'konni qaytarish sanasini tanlang.');
  const bugun = hozir().iso;
  if (d.sana > bugun) throw xato('Sana kelajakda bo\'lishi mumkin emas — kelishuv imzolanadigan kunni tanlang.');
  let qarz = 0;
  if (!d.qarzYoq) { qarz = Math.round(Number(s(d.qarz).replace(/[^\d.]/g, '')) || 0);
    if (qarz <= 0) throw xato('Elektr qarzini tanlang: «qarzi yo\'q» yoki qarz summasini yozing.'); }
  const kalit = s(d.kalit == null ? '' : d.kalit).trim();
  if (!/^\d{1,2}$/.test(kalit)) throw xato('Topshirilgan kalitlar sonini yozing (0 dan 99 gacha).');
  const hisob = Sx(d.hisob).slice(0, 40);
  if (!hisob) throw xato('Elektr hisoblagichi ko\'rsatkichini yozing (hisoblagich bo\'lmasa — «йўқ»).');
  const holat = d.holat === 'kamchilik' ? 'kamchilik' : d.holat === 'soz' ? 'soz' : '';
  if (!holat) throw xato('Do\'kon holatini tanlang: «soz» yoki «kamchiliklar bor».');
  const izoh = Sx(d.izoh).slice(0, 500);
  if (holat === 'kamchilik' && izoh.length < 5) throw xato('Qanday kamchiliklar borligini yozing (kamida 5 belgi).');
  const format = d.format === 'doc' ? 'doc' : 'pdf';
  if (!(await serverda())) return eskiTizim('kbTayyorla', u, [d0]);
  let bor = true; try { await G.gid(env.aksBazaId, KB_V, env.googleKey, true); } catch (e) { bor = false; }
  if (!bor) return eskiTizim('kbTayyorla', u, [d0]);   // kbVaraq_ varaqni eski tizim ochadi
  const R0 = await kbRowsYangi();
  let x; try { x = await KBH.kbTekshir(no, d.id, R0.L); } catch (e) { if (e instanceof KBH.Xato) throw xato(e.message); throw e; }
  if (d.sana < x.sana) throw xato('Sana shartnoma sanasidan (' + KBH.kbDmy(x.sana) + ') oldin bo\'lishi mumkin emas.');
  let eski = null;
  if (d.id) {
    eski = R0.L.find(z => String(z.id) === String(d.id));
    if (!eski || eski.no !== no) throw xato('So\'rov topilmadi.');
    if (eski.holati !== 'Hujjat tayyorlandi' && eski.holati !== 'Rad etildi') throw xato('So\'rov «' + eski.holati + '» holatida — qayta tayyorlab bo\'lmaydi.');
  }
  const D = { sabab, sana: d.sana, qarz, kalit: Number(kalit), hisob: KBH.kbLotin(hisob), holat, izoh: KBH.kbLotin(izoh).replace(/[.;,\s]+$/, ''), xodim: KBH.kbAdmin(u) ? '' : await KBH.kbXodimIsm(u.fish) };
  const nom = 'Kelishuv_bekor_' + no.replace(/\//g, '-') + '_' + KBH.kbFam(x.fish) + '_' + d.sana;
  const f = await KBH.kbHujjat(x, D);
  const yil = d.sana.slice(0, 4), belgi = Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
  const pdfRel = 'kb/' + yil + '/' + belgi + '/' + nom + '.pdf', docRel = 'kb/' + yil + '/' + belgi + '/' + nom + '.docx';
  const pdfId = saqla(pdfRel, f.pdf), docId = saqla(docRel, f.docx);
  const qator = [no, x.fish, x.dokon, sabab, KBH.kbDmy(d.sana), qarz ? qarz : 'Йўқ', kalit, hisob, holat === 'soz' ? 'Соз' : 'Камчиликлар бор', izoh];
  let id, eskiFayl = [];
  const w = await qulfBilan(async () => {
    const R = await kbRowsYangi();
    try { await KBH.kbTekshir(no, d.id, R.L); } catch (e) { if (e instanceof KBH.Xato) throw xato(e.message); throw e; }   // shu orada boshqa so'rov ochilgan bo'lsa — to'xtaydi
    if (eski) {
      const e2 = R.L.find(z => String(z.id) === String(d.id)) || eski;
      id = e2.id;
      await kbQaytaYoz(KB_V, e2, { qator, pdfId, docId }, u.fish);
      eskiFayl = [e2.pdf, e2.doc].filter(Boolean);
      eskiFayl.forEach(ochirSrv);   // kbOchir_: serverdagi eski nusxa; Drive'dagisi — fonda savatga
      return { qator: e2.qator };
    }
    const r = await kbSorovYoz(KB_V, R, { qator, pdfId, docId, kim: u.fish });
    id = r.id; return r;
  }).catch(e => { ochirSrv(pdfId); ochirSrv(docId); if (e.yozilmadi) return null; throw e; });
  if (!w) { return eskiTizim('kbTayyorla', u, [d0]); }   // robotda yozish huquqi yo'q — hech narsa yozilmagan
  driveGa(u.kod, { id, yil, nom, pdfRel, docRel, eski: eskiFayl.filter(z => !/^SRV:/.test(z)) }).catch(e => console.error('kb Drive:', e.message));
  await yangila([KB_V]);
  const fl = format === 'doc' ? { b64: f.docx.toString('base64'), nom: nom + '.docx', mime: DOCX } : { b64: f.pdf.toString('base64'), nom: nom + '.pdf', mime: 'application/pdf' };
  return { ok: true, id, no, b64: fl.b64, nom: fl.nom, mime: fl.mime, bet: f.bet, ogoh: x.ogoh, serverda: true,
    natija: no + ': kelishuv va dalolatnoma tayyorlandi. Chop eting → ijarachi va direktor imzolasin → skanini shu yerdan yuklang. Direktor tasdiqlagach shartnoma bekor bo\'ladi.' };
}

// ------------------------------------------------------------------ yozuv yadrolari — skan / bekor / tasdiq (sinov ham shularni ishlatadi — nusxa varaqda)
// kbSkan: 06m M «Tasdiq kutilmoqda», P:R [skan, vaqt, kim], T:V tozalanadi (oldingi rad javobi tarixda qoladi), X sahifa, tarix
async function kbSkanYoz(varaq, sr, skanId, kim, sahifa) {
  const vaqt = hozir().dmyHm;
  try {
    await G.yoz(env.aksBazaId, [{ varaq, katak: 'M' + sr.qator, qiymat: [['Tasdiq kutilmoqda']] }, { varaq, katak: 'P' + sr.qator + ':R' + sr.qator, qiymat: [[skanId, vaqt, kim]] },
      { varaq, katak: 'T' + sr.qator + ':V' + sr.qator, qiymat: [['', '', '']] }, { varaq, katak: 'X' + sr.qator, qiymat: [[Number(sahifa) || '']] }], env.googleKey);
    await kbTarix(varaq, sr.qator, vaqt + ' ' + kim + ': imzolangan skan yuklandi' + (Number(sahifa) ? ' (' + Number(sahifa) + ' sahifa)' : '') + (sr.skan ? '; oldingi (rad etilgan) skan papkada qoldi: ' + sr.skan : ''));
  } catch (e) { throw yozilmadi(e); }
  return { vaqt };
}
// kbBekor: M «Bekor» + tarix
async function kbBekorYoz(varaq, sr, kim, sabab) {
  try { await G.yoz(env.aksBazaId, [{ varaq, katak: 'M' + sr.qator, qiymat: [['Bekor']] }], env.googleKey); await kbTarix(varaq, sr.qator, hozir().dmyHm + ' ' + kim + ': so\'rov bekor qilindi — ' + sabab); }
  catch (e) { throw yozilmadi(e); }
}
// kbTasdiq javobi: M holati, T:V [izoh, vaqt, kim] + tarix
async function kbJavobYoz(varaq, sr, holati, izoh, kim, tarixMatn) {
  const vaqt = hozir().dmyHm;
  try { await G.yoz(env.aksBazaId, [{ varaq, katak: 'M' + sr.qator, qiymat: [[holati]] }, { varaq, katak: 'T' + sr.qator + ':V' + sr.qator, qiymat: [[izoh || '', vaqt, kim]] }], env.googleKey); await kbTarix(varaq, sr.qator, vaqt + ' ' + kim + ': ' + tarixMatn); }
  catch (e) { throw yozilmadi(e); }
  return { vaqt };
}
// kbTasdiq ✅ — 04 (C «Bekor qilindi», D bekor sanasi, W izoh) + 06j jurnal. v — {s4, jurnal} (sinov nusxalari). Qaytaradi ogoh ro'yxati
async function kbBekorQil(u, x, sr, v = {}) {
  const S4 = v.s4 || '04_Ijara_shartnomalar', jv = v.jurnal || '06j_Tahrir_jurnali', vaqt = hozir().dmyHm, ogoh = [];
  const A = (await G.oraliqOqi(env.aksBazaId, S4, 'A' + x.qator + ':C' + x.qator, env.googleKey))[0] || [];   // qator ko'zgudan — Google'da ham shu shartnoma va «Aktiv» ekani tekshiriladi
  if (s(A[0]).trim() !== x.no) throw xato('04_Ijara_shartnomalar da ' + x.no + ' qatori o\'zgargan — sahifani yangilab, qayta urinib ko\'ring.');
  if (s(A[2]).trim() !== 'Aktiv') throw xato(x.no + ' holati «' + (s(A[2]).trim() || 'bo\'sh') + '» — faqat «Aktiv» shartnoma bekor qilinadi.');
  try {
    await G.yoz(env.aksBazaId, [{ varaq: S4, katak: 'C' + x.qator, qiymat: [['Bekor qilindi']] }], env.googleKey);
    const sp = sr.sana.split('.');
    await G.sanaYoz(env.aksBazaId, [{ varaq: S4, qator: x.qator, ustun: 4, iso: sp[2] + '-' + sp[1] + '-' + sp[0] }], env.googleKey);   // setValue(new Date(...)).setNumberFormat('dd.MM.yyyy')
    const W = (await G.oraliqOqi(env.aksBazaId, S4, 'W' + x.qator, env.googleKey, 'FORMULA'))[0] || [];
    if (typeof W[0] === 'string' && W[0][0] === '=') ogoh.push('04 Izoh ustunida formula bor — izoh yozilmadi.');
    else {
      const e = s(((await G.oraliqOqi(env.aksBazaId, S4, 'W' + x.qator, env.googleKey))[0] || [])[0]).trim();
      await G.yoz(env.aksBazaId, [{ varaq: S4, katak: 'W' + x.qator, qiymat: [[(e ? e + ' | ' : '') + 'Ўзаро келишув билан ' + sr.sana + ' бекор қилинди (KB-' + sr.id + '; ' + sr.kim + '; тасдиқ: ' + u.fish + '): ' + sr.sabab]] }], env.googleKey);
    }
    let bor = true; try { await G.gid(env.aksBazaId, jv, env.googleKey); } catch (e) { bor = false; }
    if (bor) await TY.jurnalYoz(jv, [[vaqt, x.no, 'Ijara', x.mid, 'Holati', 'Aktiv', 'Bekor qilindi', u.fish, 'o\'zaro kelishuv (KB-' + sr.id + ', ' + sr.kim + '): ' + sr.sabab]]);
    else ogoh.push('06j_Tahrir_jurnali varag\'i topilmadi — jurnalga yozilmadi.');
  } catch (e) { throw yozilmadi(e); }
  return ogoh;
}
const kbHtml = v => s(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const tgFon = (kod, fn, a) => { koprik.chaqir(fn, kod, a).catch(e => console.error(fn + ' (kb):', e.message)); };
async function kbTgXodim(kod, fish, m) {   // kbTgXodim_: 07_Xodimlar U — xodimning shaxsiy chati
  try { const r = (await V.qatorlar('07_Xodimlar')).map(z => z.x).find(z => s(z[1]).trim() === s(fish).trim()); if (r && s(r[20]).trim()) tgFon(kod, 'koprikTgChat', [s(r[20]).trim(), m]); } catch (e) { }
}
function skanNom(sr) { const d = new Date(Date.now() + 5 * 3600 * 1000), p = n => String(n).padStart(2, '0');
  return 'KB-' + sr.id + '_' + sr.no.replace(/\//g, '-') + '_imzolangan_' + d.getUTCFullYear() + p(d.getUTCMonth() + 1) + p(d.getUTCDate()) + '_' + p(d.getUTCHours()) + p(d.getUTCMinutes()) + '.pdf'; }

// ------------------------------------------------------------------ kbSkan(kod, id, b64, sahifa) — imzolangan skan → «Tasdiq kutilmoqda»
async function kbSkan(args) {
  const [kodSes, id, b64, sahifa] = args;
  const u = await kbU(kodSes);
  const bayt = Buffer.from(s(b64), 'base64');
  if (bayt.length < 1000) throw xato('Ikkala tomon imzolagan kelishuv va dalolatnoma skanini yuklang (kamera yoki PDF).');
  if (bayt.length > 25 * 1048576) throw xato('Fayl 25 MB dan katta.');
  if (bayt.subarray(0, 5).toString('latin1') !== '%PDF-') throw xato('Fayl PDF emas. Faqat PDF yoki skanerlash orqali yuklang.');
  if (!(await serverda2(u.kod))) return eskiTizim('kbSkan', u, [id, b64, sahifa]);
  let rel = '';
  const r = await qulfBilan(async () => {
    const R = await kbRowsYangi();
    const sr = R.L.find(z => String(z.id) === String(id));
    if (!sr) throw xato('So\'rov topilmadi.');
    if (sr.holati !== 'Hujjat tayyorlandi' && sr.holati !== 'Rad etildi') throw xato('So\'rov «' + sr.holati + '» holatida — skan yuklanmaydi.');
    try { await KBH.kbTekshir(sr.no, sr.id, R.L); } catch (e) { if (e instanceof KBH.Xato) throw xato(e.message); throw e; }
    const yil = hozir().iso.slice(0, 4), nom = skanNom(sr);
    rel = 'kb/' + yil + '/' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5) + '/' + nom;
    const skanId = saqla(rel, bayt);
    try { await kbSkanYoz(KB_V, sr, skanId, u.fish, sahifa); } catch (e) { ochirSrv(skanId); throw e; }
    return { sr, yil, nom };
  }).catch(e => { if (e.yozilmadi) return null; throw e; });
  if (!r) return eskiTizim('kbSkan', u, [id, b64, sahifa]);
  skanDriveGa(u.kod, { id: r.sr.id, yil: r.yil, nom: r.nom, rel }).catch(e => console.error('kb skan Drive:', e.message));
  tgFon(u.kod, 'koprikTgYubor', ['🤝 <b>Ijara kelishuv bilan bekor qilinmoqda</b> — ' + r.sr.no + ' (' + kbHtml(r.sr.fish) + ', ' + kbHtml(r.sr.dokon) + ')\n«' + kbHtml(r.sr.sabab) + '»\n'
    + 'Ikki tomon imzolagan skan yuklandi (' + u.fish + '). Imzolarni tekshirib tasdiqlang: ilovada 👔 Direktor → Tasdiqlar.']);
  await yangila([KB_V]);
  return { ok: true, natija: r.sr.no + ': imzolangan skan yuklandi — direktor tasdig\'ini kutmoqda. Tasdiqlangach shartnoma bekor bo\'ladi, do\'kon bo\'shaydi.' };
}
// ------------------------------------------------------------------ kbBekor(kod, id, sabab) — so'rovni bekor qilish (tasdiqgacha)
async function kbBekor(args) {
  const [kodSes, id, sabab0] = args;
  const u = await kbU(kodSes);
  const sabab = KBH.kbS(sabab0); if (sabab.length < 5) throw xato('Sababini yozing (kamida 5 belgi).');
  if (!(await serverda2(u.kod))) return eskiTizim('kbBekor', u, [id, sabab0]);
  const r = await qulfBilan(async () => {
    const R = await kbRowsYangi();
    const sr = R.L.find(z => String(z.id) === String(id));
    if (!sr) throw xato('So\'rov topilmadi.');
    if (KBH.KB_OCHIQ.indexOf(sr.holati) < 0) throw xato('So\'rov «' + sr.holati + '» holatida.');
    if (!KBH.kbAdmin(u) && sr.kim !== u.fish) throw xato('So\'rovni faqat uni ochgan xodim (' + sr.kim + ') yoki direktor bekor qiladi.');
    await kbBekorYoz(KB_V, sr, u.fish, sabab);
    return sr;
  }).catch(e => { if (e.yozilmadi) return null; throw e; });
  if (!r) return eskiTizim('kbBekor', u, [id, sabab0]);
  await yangila([KB_V]);
  return { ok: true, natija: r.no + ' bo\'yicha kelishuv so\'rovi bekor qilindi. Shartnoma o\'zgarmadi.' };
}
// ------------------------------------------------------------------ kbTasdiq(kod, id, ha, izoh) — direktor ✅ tasdiq / ✖ rad
async function kbTasdiq(args) {
  const [kodSes, id, ha0, izoh0] = args;
  const u = await S.ruxsat(kodSes, 'admin');
  const ha = !!ha0, izoh = KBH.kbS(izoh0);
  if (!ha && izoh.length < 5) throw xato('Rad etish sababini yozing (kamida 5 belgi) — xodimga boradi.');
  if (!(await serverda2(u.kod))) return eskiTizim('kbTasdiq', u, [id, ha0, izoh0]);
  const r = await qulfBilan(async () => {
    const R = await kbRowsYangi();
    const sr = R.L.find(z => String(z.id) === String(id));
    if (!sr) throw xato('So\'rov topilmadi.');
    if (sr.holati !== 'Tasdiq kutilmoqda') throw xato('So\'rov «' + sr.holati + '» holatida — tasdiq kutmayapti.');
    let natija = '', ogoh = [], x = null;
    if (ha) {
      try { x = await KBH.kbTekshir(sr.no, sr.id, R.L); } catch (e) { if (e instanceof KBH.Xato) throw xato(e.message); throw e; }
      ogoh = await kbBekorQil(u, x, sr);
      await kbJavobYoz(KB_V, sr, 'Tasdiqlandi', izoh || '', u.fish, 'tasdiqlandi — shartnoma bekor qilindi');
    } else {
      await kbJavobYoz(KB_V, sr, 'Rad etildi', izoh, u.fish, 'rad etildi — ' + izoh);
      natija = sr.no + ' bo\'yicha kelishuv rad etildi. Xodim skanni qayta yuklashi mumkin.';
    }
    return { sr, natija, ogoh, x };
  }).catch(e => { if (e.yozilmadi) return null; throw e; });
  if (!r) return eskiTizim('kbTasdiq', u, [id, ha0, izoh0]);
  const { sr, x } = r; let { natija, ogoh } = r;
  if (x) {   // qulfdan keyin: hujjat yuklash o'z qulfini oladi (Bekor.gs dagi kabi)
    // 3) 06d: imzolangan kelishuv — «Qo'shimcha kelishuv» turi bilan mijoz hujjatlariga (serverda — hujjat_yoz yuklaYadro, Drive fonda)
    try {
      const f = await require('./xat_chiqar')._ichki.pdfOl(sr.skan);
      if (!f) throw new Error('skan fayli topilmadi (' + sr.skan + ')');
      const HY = require('./hujjat_yoz')._ichki;
      const h = await HY.yuklaYadro({ fish: sr.skanKim || sr.kim, admin: false, kod: u.kod },
        { no: x.no, turi: 'QOSHIMCHA_KELISHUV', sana: sr.sana.split('.').reverse().join('-'), sahifa: sr.sahifa, b64: f.bytes.toString('base64'),
          izoh: '№КБ-' + sr.id + ' · Ижара шартномасини ўзаро келишув билан бекор қилиш тўғрисида келишув ва дўконни қабул қилиш-топшириш далолатномаси (тасдиқ: ' + u.fish + ')' },
        { no: x.no, tur: 'ijara', fish: x.fish, dokon: x.dokon });
      await kbTarix(KB_V, sr.qator, hozir().dmyHm + ' skan 06d ga yozildi: ' + (h.nom || ''));
    } catch (e) { ogoh.push('Skan «📎 Hujjatlar»ga yozilmadi (' + e.message + ') — fayl 07 BEKOR QILISH / Kelishuv papkasida turibdi.'); }
    // 4) 01 nazorati — do'kon bo'shadimi
    if (x.dokon) {
      const D = await G.oraliqOqi(env.aksBazaId, '01_Dokonlar', 'A2:V641', env.googleKey);
      const k = D.findIndex(z => s(z[0]).trim() === x.dokon);
      if (k < 0) ogoh.push('Do\'kon ' + x.dokon + ' 01_Dokonlar da topilmadi — qo\'lda tekshiring.');
      else if (s(D[k][21]).trim() === x.no) ogoh.push('01_Dokonlar hali ham ' + x.no + ' ni ko\'rsatyapti — bazani tekshiring.');
    }
    natija = sr.no + ' bekor qilindi (o\'zaro kelishuv), do\'kon ' + x.dokon + ' bo\'shadi.' + (ogoh.length ? ' ⚠ ' + ogoh.join(' ') : '');
  }
  const m = (ha ? '✅ <b>Kelishuv tasdiqlandi</b> — ' + sr.no + ' (' + kbHtml(sr.fish) + ') bekor qilindi, do\'kon ' + kbHtml(sr.dokon) + ' bo\'shadi.'
    : '✖ <b>Kelishuv rad etildi</b> — ' + sr.no + ' (' + kbHtml(sr.fish) + ').\n«' + kbHtml(izoh) + '»\nTuzatib, skanni qayta yuklang: 📎 Hujjatlar → shartnoma → 🤝 kelishuv bloki.');
  await kbTgXodim(u.kod, sr.kim, m); if (sr.skanKim && sr.skanKim !== sr.kim) await kbTgXodim(u.kod, sr.skanKim, m);
  await yangila(x ? [KB_V, '04_Ijara_shartnomalar', '06j_Tahrir_jurnali', '06d_Hujjatlar'] : [KB_V]);
  return { ok: true, natija, ogoh };
}
// skan → Drive (fon): Koprik v1.13 koprikKbSaqla { yil, skanNom, skanB64 } → { skan }; 06m P ga Drive ID (agar hali shu SRV bo'lsa)
const skanYolda = new Set();
async function skanDriveGa(kod, k, urinish = 0) {
  if (!koprik.bor() || skanYolda.has(k.rel)) return null;
  if (!(await koprik113(kod))) { if (urinish < 3) setTimeout(() => skanDriveGa(kod, k, urinish + 1).catch(() => {}), 10 * 60000).unref(); return null; }
  skanYolda.add(k.rel);
  try {
    const r = await koprik.chaqir('koprikKbSaqla', kod, [{ yil: k.yil, skanNom: k.nom, skanB64: fs.readFileSync(path.join(ILDIZ, k.rel)).toString('base64') }], { muddat: 120000, urinish: 1 });
    if (!r || !r.skan) throw new Error('Drive ID qaytmadi');
    try { await redis.set('xat_srv:' + r.skan, k.rel, 'EX', 400 * 86400); } catch (e) { }
    const yozildi = await qulfBilan(async () => {
      const z = (await kbRowsYangi()).L.find(q => s(q.id) === s(k.id));
      if (!z || z.skan !== 'SRV:' + k.rel) return false;   // shu orada qayta yuklangan — yuklangan nusxa papkada qoladi (eski kbSkan ham eskisini qoldiradi)
      await G.yoz(env.aksBazaId, [{ varaq: KB_V, katak: 'P' + z.qator, qiymat: [[r.skan]] }], env.googleKey);
      return true;
    });
    if (yozildi) { tetik.varaqlarYangila([KB_V]).catch(() => {}); console.log(new Date().toISOString(), 'kelishuv skani Drive ga ko\'chdi:', k.nom, '→', r.skan); }
    return r;
  } catch (e) {
    console.error(new Date().toISOString(), 'kb skan Drive ko\'chirish (' + (urinish + 1) + '):', k.nom, e.message);
    if (urinish < 3) setTimeout(() => skanDriveGa(kod, k, urinish + 1).catch(() => {}), 10 * 60000).unref();
    return null;
  } finally { skanYolda.delete(k.rel); }
}

// ------------------------------------------------------------------ Drive'ga ko'chirish (fon) — Koprik v1.12 koprikKbSaqla → «AKS TIZIM / 07 BEKOR QILISH / Kelishuv / <yil>»
const yolda = new Set();
async function driveGa(kod, k, urinish = 0) {
  if (!koprik.bor() || yolda.has(k.pdfRel)) return null;
  if (!(await koprik112(kod))) { if (urinish < 3) setTimeout(() => driveGa(kod, k, urinish + 1).catch(() => {}), 10 * 60000).unref(); return null; }
  yolda.add(k.pdfRel);
  try {
    const b64 = rel => fs.readFileSync(path.join(ILDIZ, rel)).toString('base64');
    const r = await koprik.chaqir('koprikKbSaqla', kod, [{ yil: k.yil, nom: k.nom, pdfB64: b64(k.pdfRel), docB64: b64(k.docRel), eski: k.eski || [] }], { muddat: 120000, urinish: 1 });
    if (!r || !r.pdf || !r.doc) throw new Error('Drive ID qaytmadi');
    try { await redis.set('xat_srv:' + r.pdf, k.pdfRel, 'EX', 400 * 86400); await redis.set('xat_srv:' + r.doc, k.docRel, 'EX', 400 * 86400); } catch (e) { }
    const yozildi = await qulfBilan(async () => {
      const z = (await kbRowsYangi()).L.find(q => s(q.id) === s(k.id));
      if (!z || z.pdf !== 'SRV:' + k.pdfRel) return false;   // shu orada qayta tayyorlangan — yuklangan nusxa savatga
      await G.yoz(env.aksBazaId, [{ varaq: KB_V, katak: 'N' + z.qator + ':O' + z.qator, qiymat: [[r.pdf, r.doc]] }], env.googleKey);
      return true;
    });
    if (yozildi) { tetik.varaqlarYangila([KB_V]).catch(() => {}); console.log(new Date().toISOString(), 'kelishuv hujjatlari Drive ga ko\'chdi:', k.nom, '→', r.pdf, r.doc); return r; }
    koprik.chaqir('koprikKbSaqla', kod, [{ eski: [r.pdf, r.doc] }]).catch(e => console.error('kb (eski nusxa savatga):', e.message));
    return null;
  } catch (e) {
    console.error(new Date().toISOString(), 'kb Drive ko\'chirish (' + (urinish + 1) + '):', k.nom, e.message);
    if (urinish < 3) setTimeout(() => driveGa(kod, k, urinish + 1).catch(() => {}), 10 * 60000).unref();
    return null;
  } finally { yolda.delete(k.pdfRel); }
}
// Har 15 daqiqada: hali Drive'ga ko'chmagan (SRV:) qatorlar bo'lsa — qayta urinish (Koprik yangilanmagan / internet uzilgan / server qayta ishga tushgan bo'lsa)
let aylanmoqda = false;
async function qolganlarniKochir() {
  if (aylanmoqda || !koprik.bor()) return; aylanmoqda = true;
  try {
    const R = await KBH.kbRowsKozgu();
    const L = R.filter(z => /^SRV:kb\//.test(z.pdf) && /^SRV:kb\//.test(z.doc)), Ls = R.filter(z => /^SRV:kb\//.test(z.skan));
    if (!L.length && !Ls.length) return;
    const { q } = require('../lib/db');
    const xk = (await q(`SELECT kirish_kodi FROM v_xodimlar WHERE holat='Ishlayapti' AND ('admin' = ANY(huquqlar) OR 'ijara_kelishuv' = ANY(huquqlar)) ORDER BY qator_no LIMIT 1`)).rows[0];
    if (!xk) return;
    for (const z of Ls.slice(0, 5)) { const rel = z.skan.slice(4); if (fs.existsSync(path.join(ILDIZ, rel))) await skanDriveGa(xk.kirish_kodi, { id: z.id, yil: rel.split('/')[1], nom: path.basename(rel), rel }, 3); }
    for (const z of L.slice(0, 5)) {
      const pdfRel = z.pdf.slice(4), docRel = z.doc.slice(4);
      if (!fs.existsSync(path.join(ILDIZ, pdfRel)) || !fs.existsSync(path.join(ILDIZ, docRel))) continue;
      const m = /\/([^\/]+)\.pdf$/.exec(pdfRel); if (!m) continue;
      await driveGa(xk.kirish_kodi, { id: z.id, yil: pdfRel.split('/')[1], nom: m[1], pdfRel, docRel, eski: [] }, 3);
    }
  } catch (e) { console.error('qolgan kelishuv hujjatlari:', e.message); } finally { aylanmoqda = false; }
}
function boshla() { const t = setInterval(() => qolganlarniKochir().catch(() => {}), 15 * 60000); t.unref(); setTimeout(() => qolganlarniKochir().catch(() => {}), 90000).unref(); }

module.exports = { kbTayyorla, kbSkan, kbBekor, kbTasdiq };
module.exports._ichki = { kbRowsYangi, kbSorovYoz, kbQaytaYoz, kbTarix, kbSkanYoz, kbBekorYoz, kbJavobYoz, kbBekorQil, koprik112, koprik113, boshla, KB_V, N };
