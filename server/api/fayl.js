// AKS TIZIM — fayllarni ko'rish / yuklab olish serverda (robot «AKS TIZIM» papkasida «Читатель», 17.10.2026):
//   devonFayl (Devon.gs) · bekorFayl (Bekor.gs) · kbFayl (KelishuvBekor.gs) · tqFayl (Topshiriq.gs) · yhAloqaFayl (Yurhujjat.gs)
//   hujjatFayl — FAQAT serverda (eski tizimda yo'q): mijoz kartasidagi skanni «skan» huquqi bilan ko'rish
// Tartib: serverdagi nusxa → Drive (robot, faqat o'qish) → bo'lmasa eski tizim. Word (.docx) nusxasi va yon ta'sirli holatlar — eski tizim.
'use strict';
const S = require('./sessiya');
const J = require('../lib/jurnallar');
const G = require('../lib/google');
const env = require('../lib/env');
const koprik = require('./koprik');

const MIME = { pdf: 'application/pdf', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', heic: 'image/heic' };
// fid → { bytes, nom (Drive nomi), mime } yoki null (robot ko'rmaydi)
async function ol(fid, no, nom) {
  const sv = require('./hujjat_yoz').srvFayl(fid, no || '', nom || '');
  if (sv) { const e = (/\.([a-z0-9]+)$/i.exec(sv.nom) || ['', 'pdf'])[1].toLowerCase(); return { bytes: sv.bytes, nom: sv.nom, mime: MIME[e] || 'application/pdf' }; }
  try { const f = await G.driveFayl(fid, env.googleKey); return { bytes: f.bytes, nom: f.nom, mime: f.mime || 'application/pdf' }; }
  catch (e) { if (!(e instanceof G.RuxsatYoq)) console.error('fayl (Drive):', e.message); return null; }
}
const eski = (fn, kod, args) => koprik.chaqir(fn, kod, args);

// ------------------------------------------------------------------ 📮 devonFayl
const devonFaylNom = v => String(v || '').replace(/[\\\/:*?"<>|«»№#]/g, '-').replace(/\s+/g, '_').slice(0, 40);
async function devonFayl([kodSes, id, k]) {
  const u = await S.foydalanuvchi(kodSes); if (!u) throw new S.Xato('Sessiya tugagan — PIN ni qayta kiriting.');
  const D = require('./direktor')._ichki;
  const R = await D.devonRows();
  const x = R.find(z => String(z.id) === String(id));
  if (!x) throw new S.Xato('Xat topilmadi.');
  D.devonKorishHuquq(u, x, R);
  const Jx = D.devonIjro(x);
  if (k === 'doc') return eski('devonFayl', u.kod, [id, k]);
  let fid = '', nom = '';
  if (k === 'kv') { fid = (Jx.yub || {}).kvF; nom = 'Kvitansiya_' + x.tartib + '_' + devonFaylNom(x.raqam) + '.pdf'; }
  else if (k === 'pdf') { fid = Jx.pdf; nom = 'Chiqim_' + x.tartib + '_' + devonFaylNom(x.raqam) + '.pdf'; }
  else if (!k || k === 'xat') { fid = x.fayl || (x.turi === 'Chiqim' ? Jx.pdf : ''); nom = (x.turi === 'Kirim' ? 'Kirim_' : 'Chiqim_') + x.tartib + '_' + devonFaylNom(x.turi === 'Kirim' ? x.tashkilot : x.raqam) + (x.turi === 'Chiqim' && x.fayl ? ((Jx.yub || {}).usul === 'qol' ? '_qabul_belgisi' : '_imzolangan') : '') + '.pdf'; }
  else if (/^f:/.test(k)) { const t = (Jx.top || {})[k.slice(2)]; if (!t || !t.f) throw new S.Xato('Isbot fayli topilmadi.'); fid = t.f; nom = 'Ijro_' + x.tartib + '_' + devonFaylNom(k.slice(2)) + '.pdf'; }
  if (!fid) throw new S.Xato('Fayl yo\'q.');
  // direktor kirim xatni birinchi marta ochdi — eski tizim «ko'rdi» belgisini yozadi (devonKordi_)
  if ((!k || k === 'xat') && x.turi === 'Kirim' && x.holati === 'Rezolyutsiya kutmoqda' && (u.huquq || []).indexOf('admin') >= 0 && !Jx.kordi) return eski('devonFayl', u.kod, [id, k]);
  const f = await ol(fid); if (!f) return eski('devonFayl', u.kod, [id, k]);
  return { b64: f.bytes.toString('base64'), nom, mime: 'application/pdf' };
}

// ------------------------------------------------------------------ ✂ bekorFayl
async function bekorFayl([kodSes, id, hujjat, format]) {
  const u = await S.ruxsat(kodSes);
  if (!u.admin && !u.huquq.includes('undiruv') && !u.huquq.includes('hujjat')) throw new S.Xato('Bu bo\'limga ruxsatingiz yo\'q.');
  const s = (await J.bekorJurnal()).find(z => String(z.id) === String(id));
  if (!s) throw new S.Xato('So\'rov topilmadi (ID ' + id + ').');
  if (String(format) === 'doc') {   // Word: serverda yasalgan nusxa (SRV yoki Drive'ga ko'chgani); eski so'rovlardagi Google Doc — eski tizim eksport qiladi
    const docId = hujjat === 'xab' ? s.xDoc : s.bDoc;
    const f = docId ? await require('./xat_chiqar')._ichki.pdfOl(docId) : null;
    if (f && f.bytes.subarray(0, 2).toString('latin1') === 'PK')
      return { nom: (hujjat === 'xab' ? 'Bekor_xabarnoma_' : 'Bekor_buyruq_') + s.no.replace(/\//g, '-') + '_' + ((hujjat === 'xab' && s.xRaqam) || s.raqam).replace('/', '-') + '.docx',
        mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', b64: f.bytes.toString('base64') };
    return eski('bekorFayl', u.kod, [id, hujjat, format]);
  }
  const pdfId = hujjat === 'xab' ? s.xPdf : s.bPdf;
  if (!pdfId) throw new S.Xato('PDF topilmadi.');
  const f = await ol(pdfId); if (!f) return eski('bekorFayl', u.kod, [id, hujjat, format]);
  return { nom: f.nom, mime: 'application/pdf', b64: f.bytes.toString('base64') };
}

// ------------------------------------------------------------------ 🤝 kbFayl
async function kbFayl([kodSes, id, k]) {
  const u = await S.foydalanuvchi(kodSes); if (!u) throw new S.Xato('Sessiya tugagan — PIN ni qayta kiriting.');
  if (!(u.huquq.indexOf('admin') >= 0 || u.huquq.indexOf('ijara_kelishuv') >= 0)) throw new S.Xato('Ijarani kelishuv bilan bekor qilishga ruxsatingiz yo\'q (huquq: «ijara_kelishuv»). Direktorga murojaat qiling.');
  const V = require('../lib/varaq');
  const s = (await V.qatorlar('06m_Kelishuv_bekor')).map(({ r }) => ({ id: r[0] || '', no: String(r[2] || '').trim(), fish: r[3] || '', pdf: r[13] || '', skan: r[15] || '' })).find(z => z.id && String(z.id) === String(id));
  if (!s) throw new S.Xato('So\'rov topilmadi.');
  if (k === 'doc') return eski('kbFayl', u.kod, [id, k]);
  const fam = (String(s.fish || '').replace(/["«»'`ʻʼ‘’“”]/g, '').trim().split(/\s+/)[0] || 'Ijarachi').replace(/[\\/:*?<>|]/g, '');   // kbFam_
  const nomB = 'Kelishuv_bekor_' + s.no.replace(/\//g, '-') + '_' + fam;
  const fid = k === 'skan' ? s.skan : s.pdf;
  if (!fid) throw new S.Xato(k === 'skan' ? 'Skan hali yuklanmagan.' : 'Fayl topilmadi.');
  const f = await ol(fid); if (!f) return eski('kbFayl', u.kod, [id, k]);
  return { b64: f.bytes.toString('base64'), nom: nomB + (k === 'skan' ? '_imzolangan' : '') + '.pdf', mime: 'application/pdf' };
}

// ------------------------------------------------------------------ ⚖ tqFayl (yurist qarorlari jurnalidagi isbot)
async function tqFayl([kodSes, id, n]) {
  const u = await S.ruxsat(kodSes, 'admin');
  const q = (await J.tqRows()).find(z => String(z.id) === String(id)); if (!q) throw new S.Xato('Qaror topilmadi.');
  const f0 = ((q.m || {}).fayl || [])[Number(n) || 0]; if (!f0) throw new S.Xato('Isbot fayli topilmadi.');
  let fid = '', nom = '', no = '';
  if (f0.hj) { const h = (await J.hujjatJurnal()).find(z => String(z.id) === String(f0.hj)); if (!h || !h.faylId) throw new S.Xato('Isbot fayli topilmadi.'); fid = h.faylId; nom = h.nom; no = h.no; }
  else if (f0.f) fid = f0.f;
  else throw new S.Xato('Isbot fayli topilmadi.');
  const f = await ol(fid, no, nom); if (!f) return eski('tqFayl', u.kod, [id, n]);
  return { nom: nom || f.nom, b64: f.bytes.toString('base64'), mime: f.mime || 'application/pdf' };
}

// ------------------------------------------------------------------ ⚖ yhAloqaFayl (yurist aloqa xati)
async function yhAloqaFayl([kodSes, raqam, format]) {
  const u = await S.ruxsat(kodSes, 'yurist');
  const h = (await J.yuxJurnal()).find(z => z.raqam === raqam); if (!h) throw new S.Xato('Xat topilmadi: ' + raqam);
  if (String(format) === 'doc') return eski('yhAloqaFayl', u.kod, [raqam, format]);
  const f = await ol(h.pdf); if (!f) return eski('yhAloqaFayl', u.kod, [raqam, format]);
  return { nom: f.nom, mime: 'application/pdf', b64: f.bytes.toString('base64') };
}

// ------------------------------------------------------------------ 👁 hujjatFayl — mijoz kartasidagi skanni ko'rish / yuklab olish (huquq «skan», 18.10.2026)
// Faqat «Faol» hujjat, faqat xodimga ko'rinadigan shartnomaniki (lib/korinish). Kim qachon qaysi skanni ochgani — Redis «skan_jurnal» (aks-bugun skan).
async function hujjatFayl([kodSes, id]) {
  const u = await S.ruxsat(kodSes);
  if (!u.admin && !u.huquq.includes('skan')) throw new S.Xato('Skanlarni ko\'rishga ruxsatingiz yo\'q (huquq: «skan»). Direktorga murojaat qiling.');
  const h = (await J.hujjatJurnal()).find(z => String(z.id) === String(id));
  if (!h || (h.holati !== 'Faol' && !u.admin)) throw new S.Xato('Hujjat topilmadi.');
  if ((await require('../lib/korinish').yopiqlar(u)).has(String(h.no).trim())) throw new S.Xato('Hujjat topilmadi.');
  const f = await ol(h.faylId, h.no, h.nom);
  if (!f) throw new S.Xato('Fayl hali serverga yetib kelmagan — birozdan keyin qayta urinib ko\'ring.');
  try {
    const { redis } = require('../lib/db');
    const d = new Date(Date.now() + 5 * 3600000), p = n => String(n).padStart(2, '0');
    await redis.lpush('skan_jurnal', JSON.stringify({ vaqt: p(d.getUTCDate()) + '.' + p(d.getUTCMonth() + 1) + '.' + d.getUTCFullYear() + ' ' + p(d.getUTCHours()) + ':' + p(d.getUTCMinutes()), fish: u.fish, id: h.id, no: h.no, nom: h.nom }));
    await redis.ltrim('skan_jurnal', 0, 1999);
  } catch (e) { console.error('skan jurnali:', e.message); }
  return { nom: h.nom || f.nom, mime: f.mime || 'application/pdf', b64: f.bytes.toString('base64') };
}

module.exports = { devonFayl, bekorFayl, kbFayl, tqFayl, yhAloqaFayl, hujjatFayl };
