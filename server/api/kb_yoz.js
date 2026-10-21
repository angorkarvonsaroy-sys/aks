// AKS TIZIM — 🤝 IJARANI O'ZARO KELISHUV BILAN BEKOR QILISH: kbTayyorla serverda (KelishuvBekor.gs v1.0 bilan bir xil tekshiruvlar, xato matnlari,
// 06m_Kelishuv_bekor kataklari va javob). Hujjat (1-varaq kelishuv + 2-varaq dalolatnoma) — lib/kb_hujjat.js (eski DocumentApp kodi serverda), PDF va Word.
// Fayllar avval SERVERDA saqlanadi (/opt/aks/hujjat/kb/<yil>/…), 06m N «PDF_ID» / O «DOC_ID» = «SRV:<yo'l>» — xodim darhol oladi (kbFayl ham shu nusxani beradi).
// Keyin fonda eski tizim (Koprik v1.12 koprikKbSaqla) ikkala faylni direktor Drive'iga — «AKS TIZIM / 07 BEKOR QILISH / Kelishuv / <yil>» — qo'yadi va
// N/O ga Drive ID yoziladi (agar hali shu SRV bo'lsa). Qayta tayyorlanganda eski fayllar savatga (kbOchir_). kbSkan / kbBekor / kbTasdiq — hali eski tizimda.
// Yoqilishi: Redis yozuv_yondi:kb («aks-yozuv-sinov kb»). Aks holda — eski tizim.
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

let kv = { ok: false, t: 0 };
async function koprik112(kod) {   // Koprik.gs v1.12 (koprikKbSaqla) — 30 daqiqa kesh (yo'q bo'lsa 2 daqiqa)
  if (kv.t && Date.now() - kv.t < (kv.ok ? 30 : 2) * 60000) return kv.ok;
  try { kv = { ok: koprik.bor() && verOk(await koprik.chaqir('koprikVersiya', kod, []), '1.12'), t: Date.now() }; } catch (e) { kv = { ok: false, t: Date.now() }; }
  return kv.ok;
}
async function serverda() { try { return (await redis.get('yozuv_yondi:kb')) === '1' && (await PDF.bor()); } catch (e) { return false; } }
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
    const L = (await KBH.kbRowsKozgu()).filter(z => /^SRV:kb\//.test(z.pdf) && /^SRV:kb\//.test(z.doc));
    if (!L.length) return;
    const { q } = require('../lib/db');
    const xk = (await q(`SELECT kirish_kodi FROM v_xodimlar WHERE holat='Ishlayapti' AND ('admin' = ANY(huquqlar) OR 'ijara_kelishuv' = ANY(huquqlar)) ORDER BY qator_no LIMIT 1`)).rows[0];
    if (!xk) return;
    for (const z of L.slice(0, 5)) {
      const pdfRel = z.pdf.slice(4), docRel = z.doc.slice(4);
      if (!fs.existsSync(path.join(ILDIZ, pdfRel)) || !fs.existsSync(path.join(ILDIZ, docRel))) continue;
      const m = /\/([^\/]+)\.pdf$/.exec(pdfRel); if (!m) continue;
      await driveGa(xk.kirish_kodi, { id: z.id, yil: pdfRel.split('/')[1], nom: m[1], pdfRel, docRel, eski: [] }, 3);
    }
  } catch (e) { console.error('qolgan kelishuv hujjatlari:', e.message); } finally { aylanmoqda = false; }
}
function boshla() { const t = setInterval(() => qolganlarniKochir().catch(() => {}), 15 * 60000); t.unref(); setTimeout(() => qolganlarniKochir().catch(() => {}), 90000).unref(); }

module.exports = { kbTayyorla };
module.exports._ichki = { kbRowsYangi, kbSorovYoz, kbQaytaYoz, kbTarix, koprik112, boshla, KB_V, N };
