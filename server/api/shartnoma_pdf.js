// AKS TIZIM — 📄 SHARTNOMA PDF: shartnomaPdf (sotuv, Kod.gs v9.7) va ijaraPdf (ijara) serverda.
// Index pdfYarat: raqam «27/…» → shartnomaPdf, «IJ-27/…» → ijaraPdf; natija { ok, no, nom, b64, pdf, doc, shablon, qolgan, bosh }.
// Serverda: shablon robot orqali (lib/docs_shablon.js), matn lib/sotuv_hujjat.js / lib/ijara_hujjat.js, PDF Chromium (lib/shablon_pdf.js) — 2–4 s
// (eski tizim 15–60 s). PDF darhol qaytadi va /opt/aks/hujjat/shartnoma/ ga yoziladi. Arxiv o'chiq bo'lsa: Drive'dagi Google Doc + PDF nusxasi va
// 03 S / 04 V ustunidagi havola — FONDA eski tizimning o'zi (shartnomaPdf / ijaraPdf ko'prik orqali, natijasi kutilmaydi).
// Direktorga ko'rsatiladigan «Drive'da ochish» / «Google Doc» havolalari — hujjat papkasi (nusxa ~1 daqiqada paydo bo'ladi).
// Yoqish: aks-yozuv-sinov shpdf (yozuv_yondi:shartnoma_pdf); o'chiq bo'lsa — eski tizim.
// 02.11.2026 (direktor qarori — faqat PDF): arxiv yoniq bo'lsa (lib/arxiv.js) PDF ni server o'zi «AKS ARXIV / 03 HUJJATLAR / 03.1 | 03.2» ga qo'yadi
// (qayta yasalsa — o'sha fayl yangilanadi, ID o'zgarmaydi) va 03 S / 04 V ga havolani yozadi. Eski tizim chaqirilmaydi; Google Doc nusxasi endi yo'q.
'use strict';
const BQ = require('../lib/bayroq');   // yozuv/vaqt bayroqlari — standart holat kodda (02.11.2026)
const S = require('./sessiya');
const V = require('../lib/varaq');
const koprik = require('./koprik');
const tetik = require('../lib/kozgu_tetik');
const { redis } = require('../lib/db');
const env = require('../lib/env');
const SH = require('../lib/sotuv_hujjat');
const IJ = require('../lib/ijara_hujjat');
const PDF = require('../lib/pdf');
const ARX = require('../lib/arxiv');
const G = require('../lib/google');
const fs = require('fs');
const path = require('path');

const s = v => String(v == null ? '' : v);
const PAPKA = {   // AKS TIZIM / 03 HUJJATLAR / … (eski papka_ shu nomlar bilan topadi)
  sotuv: 'https://drive.google.com/drive/folders/1XjdgH173j6i5aTq95E-WZAb7LaasTG2-',   // 03.1 Sotuv shartnomalari
  ijara: 'https://drive.google.com/drive/folders/1C7BhGaRt6rcu7b5btn4ekfDWMR5jWnk3'    // 03.2 Ijara shartnomalari
};
const pad = (a, n) => { const o = []; for (let k = 0; k < n; k++) o.push(a && a[k] !== undefined && a[k] !== null ? a[k] : ''); return o; };
const fam = mr => s(mr[2]).split(' ')[0];

async function bayroq() { try { return (await BQ.yozuv('shartnoma_pdf')); } catch (e) { return false; } }
// arxiv yoniq bo'lsa eski tizim umuman kerak emas (shablon — robot, PDF — Chromium, Drive — arxiv)
async function serverda() { return (await bayroq()) && (koprik.bor() || (await ARX.yoniq())) && (await PDF.bor()); }
async function eskiTizim(fn, u, args) { const r = await koprik.chaqir(fn, u.kod, args); await tetik.yangilaKut(20000); return r; }
function diskkaYoz(tur, nom, buf) {
  try { const dir = path.join(env.hujjatPapka || '/opt/aks/hujjat', 'shartnoma', tur); fs.mkdirSync(dir, { recursive: true }); fs.writeFileSync(path.join(dir, nom.replace(/[^\w.-]/g, '_')), buf); }
  catch (err) { console.error('shartnoma pdf: diskka yozilmadi:', err.message); }
}
// 23.10.2026 (eski xato tuzatildi): eski shartnomaPdf / ijaraPdf har bosishda Drive'da yangi Google Doc + PDF qoldiradi (eskisi savatga tushmaydi).
// Endi Drive nusxasi tayyor bo'lgach (fonda) Koprik ≥ 1.17 koprikNusxaTozala bilan shu nomdagi eski nusxalar savatga — eng yangisi qoladi.
let kv17 = { ok: false, t: 0 };
async function koprik17(kod) {
  if (Date.now() - kv17.t < (kv17.ok ? 1800000 : 120000)) return kv17.ok;
  try { kv17 = { ok: koprik.bor() && require('../lib/versiya').verOk(await koprik.chaqir('koprikVersiya', kod, []), '1.17'), t: Date.now() }; } catch (e) { kv17 = { ok: false, t: Date.now() }; }
  return kv17.ok;
}
async function nusxaTozala(kod, yol, nom) {
  try { if (!(await koprik17(kod))) return; const r = await koprik.chaqir('koprikNusxaTozala', kod, [{ yol, nomlar: [nom] }], { muddat: 120000, urinish: 1 });
    if (r && r.ochirildi) console.log('shartnoma pdf: eski nusxa savatga —', nom, r.ochirildi); }
  catch (e) { console.error('nusxa tozalash (' + nom + '):', e.message); }
}
// PDF → arxiv, havola → 03 S (sotuv) / 04 V (ijara) — faqat o'sha qator hali shu shartnoma bo'lsa (fonda, natijasi kutilmaydi)
const ARX_PAPKA = { sotuv: ['03 HUJJATLAR', '03.1 Sotuv shartnomalari'], ijara: ['03 HUJJATLAR', '03.2 Ijara shartnomalari'] };
async function arxivga(tur, h, no) {
  const varaq = tur === 'sotuv' ? '03_Sotuv_shartnomalar' : '04_Ijara_shartnomalar', ustun = tur === 'sotuv' ? 'S' : 'V';
  const r = await ARX.saqla(ARX_PAPKA[tur], h.nom + '.pdf', h.pdf, { yangi: true });
  const A = await G.qatorOqi(env.aksBazaId, varaq, h.qator, 'A', env.googleKey).catch(() => []);
  if (s(A[0]).trim() !== s(no).trim()) { console.error('shartnoma pdf (arxiv): ' + varaq + ' ' + h.qator + '-qator endi ' + s(A[0]) + ' — havola yozilmadi (' + no + ')'); return r; }
  await G.yoz(env.aksBazaId, [{ varaq, katak: ustun + h.qator, qiymat: [[ARX.url(r.id)]] }], env.googleKey);
  tetik.varaqlarYangila([varaq]).catch(() => {});
  return r;
}
async function papkaHavola(tur) { try { return (await ARX.papkaUrl(ARX_PAPKA[tur])) || PAPKA[tur]; } catch (e) { return PAPKA[tur]; } }
async function mijoz(mid) { return ((await V.qatorlar('02_Mijozlar')).find(z => s(z.r[0]) === s(mid)) || { r: null }).r; }   // 02 (displayValues, 25 ustun)

// ---- sotuv: 03 qatori (ko'rinish), 02 mijoz, 03b to'lov jadvali → { pdf, bet, nom, qolgan, bosh, r, mr, shablon }
async function sotuvYasa(no) {
  no = s(no).trim();
  const z = (await V.qatorlar('03_Sotuv_shartnomalar')).find(q => s(q.r[0]) === no); if (!z) throw new S.Xato('Shartnoma topilmadi: ' + no);
  const r = pad(z.r, 40);
  r[22] = V.matn(z.x[22]);   // 03 W «Umumiy qiymat» — ko'ringan matndan emas, XOM qiymatdan (02.11.2026, 3-bosqichga tayyorgarlik; aks-baza xom: 0 farq)
  const mr0 = await mijoz(r[4]); if (!mr0) throw new S.Xato('Mijoz 02 da topilmadi (ID ' + r[4] + ').');
  const mr = pad(mr0, 25);
  const jad = (await V.qatorlar('03b_Tolov_jadvali')).map(q => q.r).filter(x => s(x[1]) === r[0] && Number(x[2]) > 0).map(x => ({ sana: s(x[3]), summa: SH.num(x[4]) }));
  const nom = 'Shartnoma_' + r[0].replace('/', '-') + '_' + fam(mr) + '_' + r[5];
  const h = await SH.sotuvHujjat(r, mr, jad, { nom });
  return Object.assign(h, { r, mr, jad, qator: z.n });
}
// ---- ijara: 04 qatori (ko'rinish), 02 mijoz, 01 do'kon (xom) → { pdf, bet, nom, qolgan, bosh, sotilgan, r, mr, dr, shablon }
async function ijaraYasa(no) {
  no = s(no).trim();
  const z = (await V.qatorlar('04_Ijara_shartnomalar')).find(q => s(q.r[0]) === no); if (!z) throw new S.Xato('Ijara shartnomasi topilmadi: ' + no);
  const r = pad(z.r, 37);
  r[28] = V.korSana(z.x[28]);   // 04 AC bepul davr tugashi — XOM qiymatdan «dd.MM.yyyy» (02.11.2026; aks-baza xom: 0 farq)
  const mr0 = await mijoz(r[5]); if (!mr0) throw new S.Xato('Ijarachi 02 da topilmadi (ID ' + r[5] + ').');
  const mr = pad(mr0, 25);
  const d = (await V.qatorlar('01_Dokonlar')).find(q => s(q.x[0]) === s(r[4])); if (!d) throw new S.Xato('Do\'kon topilmadi: ' + r[4]);
  const dr = pad(d.x, 26);
  const nom = 'Ijara_' + r[0].replace('/', '-') + '_' + fam(mr) + '_' + r[4];
  const h = await IJ.ijaraHujjat(r, mr, dr, { nom });
  return Object.assign(h, { r, mr, dr, qator: z.n });
}

// 📄 shartnomaPdf(kod, no) — sotuv shartnomasi PDF (ruxsat: shartnoma)
async function shartnomaPdf(args) {
  const [kodSes, no] = args;
  const u = await S.ruxsat(kodSes, 'shartnoma');
  if (!(await serverda())) return eskiTizim('shartnomaPdf', u, [no]);
  const h = await sotuvYasa(no);
  diskkaYoz('sotuv', h.nom + '.pdf', h.pdf);
  if (await ARX.yoniq()) arxivga('sotuv', h, no).catch(err => console.error('shartnomaPdf (arxiv):', err.message));   // 02.11: server o'zi
  else   // eski yo'l: eski tizim Drive'ga Google Doc + PDF nusxasini qo'yadi va 03 S ga havolani yozadi (natijasi kutilmaydi)
    koprik.chaqir('shartnomaPdf', u.kod, [s(no).trim()], { muddat: 300000, urinish: 1 })
      .then(() => nusxaTozala(u.kod, ['AKS TIZIM', '03 HUJJATLAR', '03.1 Sotuv shartnomalari'], h.nom))
      .then(() => tetik.varaqlarYangila(['03_Sotuv_shartnomalar'])).catch(err => console.error('shartnomaPdf (Drive, eski tizim):', err.message));
  const ph = u.admin ? await papkaHavola('sotuv') : '';
  return { ok: true, no: h.r[0], pdf: ph, doc: ph, nom: h.nom + '.pdf', qolgan: h.qolgan, bosh: h.bosh, b64: h.pdf.toString('base64'), bet: h.bet, serverda: true };
}
// 📄 ijaraPdf(kod, no) — ijara shartnomasi PDF (ruxsat: shartnoma)
async function ijaraPdf(args) {
  const [kodSes, no] = args;
  const u = await S.ruxsat(kodSes, 'shartnoma');
  if (!(await serverda())) return eskiTizim('ijaraPdf', u, [no]);
  const h = await ijaraYasa(no);
  diskkaYoz('ijara', h.nom + '.pdf', h.pdf);
  if (await ARX.yoniq()) arxivga('ijara', h, no).catch(err => console.error('ijaraPdf (arxiv):', err.message));   // 02.11: server o'zi
  else
    koprik.chaqir('ijaraPdf', u.kod, [s(no).trim()], { muddat: 300000, urinish: 1 })
      .then(() => nusxaTozala(u.kod, ['AKS TIZIM', '03 HUJJATLAR', '03.2 Ijara shartnomalari'], h.nom))
      .then(() => tetik.varaqlarYangila(['04_Ijara_shartnomalar'])).catch(err => console.error('ijaraPdf (Drive, eski tizim):', err.message));
  const ph = u.admin ? await papkaHavola('ijara') : '';
  return { ok: true, no: h.r[0], pdf: ph, doc: ph, nom: h.nom + '.pdf', shablon: h.sotilgan ? 'egasi nomidan' : 'MChJ nomidan', qolgan: h.qolgan, bosh: h.bosh, b64: h.pdf.toString('base64'), bet: h.bet, serverda: true };
}

module.exports = { shartnomaPdf, ijaraPdf };
// (02.11: ikkinchi «_ichki =» birinchisini bosib ketgan edi — qayta.js dagi nusxaTozala chaqiruvi jimgina ishlamas edi; endi bitta)
module.exports._ichki = { sotuvYasa, ijaraYasa, bayroq, serverda, PAPKA, arxivga, ARX_PAPKA, papkaHavola, nusxaTozala, koprik17 };
