// AKS TIZIM — ✉ ogohlantirish xatini CHIQARISH serverda (Xat.gs v26.1 xatTayyorla / xatQaytaYasa / xatTopTayyorla, Qadam.gs v2.2
// qadamXatChiqar / qadamTalabChiqar bilan bir xil tekshiruvlar, xato matnlari, raqamlash, muddat, 06e qatori va javob).
// Xat PDF i — lib/xat_pdf.js (Chromium; eski Google Docs xatlari bilan qatorma-qator solishtirilgan, direktor tasdiqlagan 19.10.2026).
// PDF avval SERVERDA saqlanadi (/opt/aks/hujjat/xat/<yil>/…), 06e «PDF_fayl_ID» = «SRV:<yo'l>» — xodim darhol oladi. Keyin fonda
// eski tizim (Koprik v1.8 koprikXatSaqla) faylni direktorning Drive'iga — «AKS TIZIM / 06 XATLAR / <yil>» — qo'yadi va O ga Drive ID yoziladi.
// Direktorga javobda Drive havolasi («Drive'da ochish») — eski tizimdagidek: fayl ko'chishi 15 soniyagacha kutiladi (ko'chmasa havola bo'sh).
// Yoqilishi: Redis yozuv_yondi:xat_chiqar («aks-yozuv-sinov xatchiqar») va Koprik ≥ 1.8. Aks holda — eski tizim.
'use strict';
const fs = require('fs');
const path = require('path');
const S = require('./sessiya');
const V = require('../lib/varaq');
const J = require('../lib/jurnallar');
const X = require('../lib/xat_yordam');
const P = require('../lib/portfel');
const U = require('../lib/undiruv_yordam');
const XP = require('../lib/xat_pdf');
const G = require('../lib/google');
const env = require('../lib/env');
const koprik = require('./koprik');
const tetik = require('../lib/kozgu_tetik');
const { redis } = require('../lib/db');
const QY = require('./qadam_yoz')._ichki;
const XI = require('./xat_isbot')._ichki;
const TP = require('./topshiriq_yoz')._ichki;
const { xodimTeng } = require('../lib/xodim');

const XAT_V = XI.XAT_V, TOP_V = TP.TOP_V;
const XAT_MUDDAT = { 1: 10, 2: 7, 3: 10 }, XAT_MUDDAT_YQ3 = 20, XAT_MUDDAT_SHOSH = 5, XAT_MUDDAT_SHOSH_YQ = 15, XAT_MIN_QARZ = 100000;
const ILDIZ = env.hujjatPapka || '/opt/aks/hujjat';
const s = v => String(v == null ? '' : v);
const d = iso => s(iso).split('-').reverse().join('.');
const iso = v => s(v).split('.').reverse().join('-');
const kut = (p, ms) => Promise.race([p, new Promise(r => setTimeout(r, ms))]);
const yangila = () => kut(tetik.varaqlarYangila([XAT_V]).catch(e => console.error('ko\'zgu (xat chiqarish):', e.message)), 15000);
function hozir() { const t = new Date(Date.now() + 5 * 3600 * 1000), p = n => String(n).padStart(2, '0');
  return { dmyHms: p(t.getUTCDate()) + '.' + p(t.getUTCMonth() + 1) + '.' + t.getUTCFullYear() + ' ' + p(t.getUTCHours()) + ':' + p(t.getUTCMinutes()) + ':' + p(t.getUTCSeconds()),
    dmyHm: p(t.getUTCDate()) + '.' + p(t.getUTCMonth() + 1) + '.' + t.getUTCFullYear() + ' ' + p(t.getUTCHours()) + ':' + p(t.getUTCMinutes()) }; }

// ------------------------------------------------------------------ yoqilganmi
const verSon = v => s(v).split('.').map(n => Number(n) || 0);
function verOk(v, min) { const a = verSon(v), b = verSon(min); for (let i = 0; i < Math.max(a.length, b.length); i++) { if ((a[i] || 0) !== (b[i] || 0)) return (a[i] || 0) > (b[i] || 0); } return true; }
let kv = { ok: false, t: 0 };
async function koprik18(kod) {   // Koprik.gs v1.8 (koprikXatSaqla) — 30 daqiqa kesh (yo'q bo'lsa 2 daqiqa)
  if (kv.t && Date.now() - kv.t < (kv.ok ? 30 : 2) * 60000) return kv.ok;
  try { kv = { ok: koprik.bor() && verOk(await koprik.chaqir('koprikVersiya', kod, []), '1.8'), t: Date.now() }; } catch (e) { kv = { ok: false, t: Date.now() }; }
  return kv.ok;
}
async function serverda(kod) {
  try { if ((await redis.get('yozuv_yondi:xat_chiqar')) !== '1') return false; } catch (e) { return false; }
  return koprik18(kod);
}
async function eskiTizim(fn, u, args) { const r = await koprik.chaqir(fn, u.kod, args); await tetik.yangilaKut(20000); return r; }

// ------------------------------------------------------------------ yordamchilar (Xat.gs)
function xatCheklov(u) { return (!u.admin && u.huquq.indexOf('undiruv') >= 0) ? u.fish : ''; }   // xatCheklov_ (undCheklov_ + undiruvchi)
function xatEgasi(u, x) {   // xatEgasi_ (topSs siz — topshiriq istisnosi yo'q)
  const ch = xatCheklov(u);
  if (ch && (!x || x.undiruvchi !== ch)) throw new S.Xato('Bu shartnoma sizning portfelingizda emas.');
}
async function ijrochi(fish) {   // xatIjrochi_: 07_Xodimlar C — kirillcha to'liq ism (2 so'z), F — telefon
  const r = (await V.qatorlar('07_Xodimlar')).map(z => z.x).find(z => s(z[1]).trim() === s(fish).trim());
  const ism = r && r[2] ? s(r[2]).trim().split(/\s+/).slice(0, 2).join(' ') : fish;
  return { ism, tel: r && r[5] ? '+998 ' + s(r[5]).trim() : '+998 95-557-88-88' };
}
function keyingiRaqam(Jx, yil) {   // OG-YYYY/NNNN — har yil 0001 dan, bekor qilingan raqam ham hisobda
  const tartib = Jx.filter(h => h.raqam.indexOf('OG-' + yil + '/') === 0).reduce((m, h) => Math.max(m, Number(h.raqam.split('/')[1]) || 0), 0) + 1;
  return 'OG-' + yil + '/' + ('000' + tartib).slice(-4);
}
function saqla(yil, nom, pdf) {   // serverdagi nusxa: /opt/aks/hujjat/xat/<yil>/<belgi>/<nom> — qayta yasalganda eski fayl ustiga yozilmaydi
  const rel = 'xat/' + yil + '/' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5) + '/' + nom;
  const yol = path.join(ILDIZ, rel);
  fs.mkdirSync(path.dirname(yol), { recursive: true });
  fs.writeFileSync(yol, pdf);
  return { rel, id: 'SRV:' + rel, yol };
}
// xat PDF ini o'qish: serverdagi nusxa (SRV yoki Drive'ga ko'chgandan keyingi belgi), bo'lmasa Drive (robot «Читатель»). Topilmasa — null
async function pdfOl(faylId) {
  let rel = /^SRV:/.test(s(faylId)) ? s(faylId).slice(4) : '';
  if (!rel && faylId) { try { rel = (await redis.get('xat_srv:' + faylId)) || ''; } catch (e) { rel = ''; } }
  if (rel) { try { const b = fs.readFileSync(path.join(ILDIZ, rel)); if (b.length) return { nom: path.basename(rel), bytes: b }; } catch (e) { } }
  if (!faylId || /^SRV:/.test(s(faylId))) return null;
  try { const f = await G.driveFayl(faylId, env.googleKey); return { nom: f.nom, bytes: f.bytes }; }
  catch (e) { if (!(e instanceof G.RuxsatYoq)) console.error('xat PDF (Drive):', e.message); return null; }
}

// 06e yangi qator (xatTayyorla / xatTopTayyorla): A:C — matn (@), qolgani — eski tizimdagi setValues kabi (USER_ENTERED)
async function qatorYoz(varaq, q) {
  const A = await G.ustunOqi(env.aksBazaId, varaq, 'A', env.googleKey);   // ustunA_oxiri_
  const row = A.length + 1;
  const g = await G.gid(env.aksBazaId, varaq, env.googleKey);
  await G.soralar(env.aksBazaId, [{ updateCells: { range: { sheetId: g, startRowIndex: row - 1, endRowIndex: row, startColumnIndex: 0, endColumnIndex: 3 },
    rows: [{ values: q.slice(0, 3).map(v => ({ userEnteredValue: { stringValue: s(v) }, userEnteredFormat: { numberFormat: { type: 'TEXT', pattern: '@' } } })) }],
    fields: 'userEnteredValue,userEnteredFormat.numberFormat' } }], env.googleKey);
  await G.yoz(env.aksBazaId, [{ varaq, katak: 'D' + row + ':W' + row, qiymat: [q.slice(3)] }], env.googleKey);
  return row;
}

// ------------------------------------------------------------------ Drive'ga ko'chirish (fon)
// Koprik v1.8 koprikXatSaqla → «AKS TIZIM / 06 XATLAR / <yil>»; ko'chgach 06e O ga Drive ID (agar O hali shu SRV bo'lsa — aks holda xat shu orada
// qayta yasalgan: yuklangan nusxa savatga). eski — almashtirilgan xatning Drive ID si (xatQaytaYasa: setTrashed).
async function driveGa(kod, f, urinish = 0) {
  if (!koprik.bor()) return;
  try {
    const b64 = fs.readFileSync(path.join(ILDIZ, f.rel)).toString('base64');
    const r = await koprik.chaqir('koprikXatSaqla', kod, [{ yil: f.yil, nom: f.nom, b64, eski: f.eski || '' }]);
    if (!r || !r.id) throw new Error('Drive ID qaytmadi');
    try { await redis.set('xat_srv:' + r.id, f.rel, 'EX', 400 * 86400); } catch (e) { }
    const A = await G.ustunOqi(env.aksBazaId, XAT_V, 'A', env.googleKey);
    const i = A.findIndex(v => s(v) === f.raqam);
    if (i < 1) throw new Error('06e da ' + f.raqam + ' topilmadi');
    const o = await G.qatorOqi(env.aksBazaId, XAT_V, i + 1, 'O', env.googleKey);
    if (s(o[14]) === 'SRV:' + f.rel) {
      await G.yoz(env.aksBazaId, [{ varaq: XAT_V, katak: 'O' + (i + 1), qiymat: [[r.id]] }], env.googleKey);
      tetik.varaqlarYangila([XAT_V]).catch(() => {});
      console.log(new Date().toISOString(), 'xat Drive ga ko\'chdi:', f.raqam, '→', r.id);
      return r;
    }
    koprik.chaqir('koprikXatSaqla', kod, [{ eski: r.id }]).catch(e => console.error('xat (eski nusxa savatga):', e.message));
    console.log(new Date().toISOString(), 'xat qayta yasalgan — ko\'chgan nusxa savatga:', f.raqam);
    return null;
  } catch (e) {
    console.error(new Date().toISOString(), 'xat Drive ko\'chirish (' + (urinish + 1) + '):', f.raqam, e.message);
    if (urinish < 3) setTimeout(() => driveGa(kod, f, urinish + 1).catch(() => {}), 10 * 60000).unref();
    return null;
  }
}
// Har 15 daqiqada: 06e da hali «SRV:» turgan xatlar (Koprik yangilanmagan / internet uzilgan bo'lsa)
let yolda = false;
async function qolganlarniKochir() {
  if (yolda || !koprik.bor()) return; yolda = true;
  try {
    const L = (await XI.xatlarYangi(XAT_V)).filter(h => /^SRV:/.test(s(h.pdf)));
    if (!L.length) return;
    const { q } = require('../lib/db');
    const x = (await q(`SELECT kirish_kodi FROM v_xodimlar WHERE holat='Ishlayapti' AND 'admin' = ANY(huquqlar) ORDER BY qator_no LIMIT 1`)).rows[0];
    if (!x || !(await koprik18(x.kirish_kodi))) return;
    for (const h of L.slice(0, 5)) { const rel = s(h.pdf).slice(4); if (fs.existsSync(path.join(ILDIZ, rel))) await driveGa(x.kirish_kodi, { raqam: h.raqam, rel, yil: rel.split('/')[1], nom: path.basename(rel) }, 3); }
  } catch (e) { console.error('qolgan xatlar:', e.message); } finally { yolda = false; }
}
function boshla() { const t = setInterval(() => qolganlarniKochir().catch(() => {}), 15 * 60000); t.unref(); setTimeout(() => qolganlarniKochir().catch(() => {}), 90000).unref(); }

// ------------------------------------------------------------------ xatTayyorla
async function xatTayyorla(args) {
  const [kodSes, no, seriya0] = args;
  const seriya = seriya0 === 'QM' ? 'QM' : 'AS';
  const u = await S.ruxsat(kodSes, 'xat');
  if (!(await serverda(u.kod))) return eskiTizim('xatTayyorla', u, args.slice(1));
  const r = await QY.qulf('xat', async () => {
    const bugunIso = V.bugun();
    const x = (await P.xatShartnomalar(bugunIso)).find(z => z.no === s(no));
    if (!x) throw new S.Xato('Shartnoma topilmadi: ' + no);
    xatEgasi(u, x);
    const [Jx, UJ, Z] = await Promise.all([XI.xatlarYangi(XAT_V), J.undJurnal(), X.xatZanjir(u.kod)]);
    const k = P.xatKeyingi(x, Jx, bugunIso, UJ, !!u.admin, seriya, Z);
    if (!k.mumkin) throw new S.Xato(k.sabab);
    const sh = seriya === 'QM' ? x.qm : x.shablon;
    const b = k.bosqich, oldin = Jx.filter(h => h.no === x.no && h.holati === 'Yuborildi' && X.xatSeriya(h.shablon) === seriya);
    const yil = bugunIso.slice(0, 4), raqam = keyingiRaqam(Jx, yil);
    const kun = k.shoshilinch ? (k.kun || (x.shablon === 'YANGI_QURILAYOTGAN' ? XAT_MUDDAT_SHOSH_YQ : XAT_MUDDAT_SHOSH))
      : (x.shablon === 'YANGI_QURILAYOTGAN' && b === 3) ? XAT_MUDDAT_YQ3 : XAT_MUDDAT[b];
    const muddatIso = U.kunQosh(bugunIso, kun);
    let shosh = null;
    if (k.shoshilinch) {
      const T = (await U.undTolovlar()).filter(t => t.no === x.no);
      shosh = { engEski: U.kunQosh(bugunIso, -(Number(x.kechikkan) || 0)), oxirgi: T.length ? T.map(t => t.sana).sort().pop() : '', muloqot: UJ.some(j => j.no === x.no), bugun: bugunIso };
    }
    const qmYoq = seriya === 'AS' && !x.qm;   // v25.5
    const Q = { asosiy: x.asosiy, muddati: x.muddati, qoshimcha: qmYoq ? 0 : x.qoshimcha, jami: qmYoq ? x.asosiy : x.jami };
    const f = await XP.xatChiqar(Object.assign({}, x, { shablon: sh }), b, raqam, bugunIso, muddatIso, Q, oldin, await ijrochi(u.fish), shosh);
    const fl = saqla(yil, f.nom, f.pdf);
    await qatorYoz(XAT_V, [raqam, d(bugunIso), x.no, x.mid, x.fish, x.dokon, sh, b, Q.asosiy, Q.muddati, Q.qoshimcha, Q.jami, d(muddatIso), 'Tayyorlandi', fl.id,
      '', '', '', '', u.fish, hozir().dmyHms, shosh ? 'Shoshilinch tartib (da\'vo muddati)' : '', '']);
    const kochish = driveGa(u.kod, { raqam, rel: fl.rel, yil, nom: f.nom }).catch(() => null);
    return { kochish, javob: { raqam, bosqich: b, seriya, nom: f.nom, b64: f.pdf.toString('base64'), muddat: d(muddatIso), url: '', ogoh: XP.ismOgoh(x.fish).concat(XP.betOgoh(f.bet, f.ikkiBet)) } };
  });
  await yangila();
  if (u.admin) { const k = await kut(r.kochish, 15000); if (k && k.url) r.javob.url = k.url; }   // eski tizim direktorga Drive havolasini berardi
  return r.javob;
}

// ------------------------------------------------------------------ xatQaytaYasa — imzolanmagan xat o'sha raqam, sana va qarz raqamlari bilan
async function xatQaytaYasa(args) {
  const [kodSes, raqam] = args;
  const u = await S.ruxsat(kodSes, 'xat');
  if (!(await serverda(u.kod))) return eskiTizim('xatQaytaYasa', u, args.slice(1));
  const r = await QY.qulf('xat', async () => {
    const Jx = await XI.xatlarYangi(XAT_V); const h = Jx.find(z => z.raqam === raqam);
    if (!h) throw new S.Xato('Xat topilmadi: ' + raqam);
    if (h.holati !== 'Tayyorlandi') throw new S.Xato('Faqat hali imzolanmagan («Tayyorlandi») xatni qayta yasash mumkin.');
    if (!u.admin && h.kim !== u.fish) throw new S.Xato('Bu xatni faqat uni tayyorlagan xodim yoki direktor qayta yasay oladi.');
    const x = (await P.xatShartnomalar(V.bugun())).find(z => z.no === h.no); if (!x) throw new S.Xato('Shartnoma topilmadi: ' + h.no);
    xatEgasi(u, x);
    const v = (await G.oraliqOqi(env.aksBazaId, XAT_V, 'I' + h.qator + ':L' + h.qator, env.googleKey, 'UNFORMATTED_VALUE'))[0] || [];
    const sanaIso = iso(h.sana), muddatIso = iso(h.muddat);
    const oldin = Jx.filter(z => z.no === h.no && z.holati === 'Yuborildi' && z.bosqich < h.bosqich && X.xatSeriya(z.shablon) === X.xatSeriya(h.shablon));
    const Q = { asosiy: Number(v[0]) || 0, muddati: Number(v[1]) || 0, qoshimcha: Number(v[2]) || 0, jami: Number(v[3]) || 0 };
    const f = await XP.xatChiqar(Object.assign({}, x, { shablon: h.shablon || x.shablon }), h.bosqich, raqam, sanaIso, muddatIso, Q, oldin, await ijrochi(h.kim), null);
    const yil = sanaIso.slice(0, 4), fl = saqla(yil, f.nom, f.pdf);
    await G.yoz(env.aksBazaId, [{ varaq: XAT_V, katak: 'O' + h.qator, qiymat: [[fl.id]] },
      { varaq: XAT_V, katak: 'V' + h.qator, qiymat: [[(h.izoh ? h.izoh + ' | ' : '') + 'Qayta yasaldi (' + u.fish + ', ' + hozir().dmyHm + ')']] }], env.googleKey);
    // eski PDF: Drive'da bo'lsa — yangisi ko'chganda savatga (setTrashed); hali serverda (SRV) bo'lsa — uning ko'chirilishi o'zi savatga tashlaydi
    driveGa(u.kod, { raqam, rel: fl.rel, yil, nom: f.nom, eski: /^SRV:/.test(s(h.pdf)) ? '' : s(h.pdf) }).catch(() => {});
    return { raqam, nom: f.nom, b64: f.pdf.toString('base64'), ogoh: XP.ismOgoh(x.fish).concat(XP.betOgoh(f.bet, f.ikkiBet)) };
  });
  await yangila();
  return r;
}

// ------------------------------------------------------------------ xatTopTayyorla — 📨 direktor talabnomasi (topshiriq bo'yicha, xat huquqisiz ham)
async function xatTopTayyorla(args) {
  const [kodSes, topId, seriya0] = args;
  const seriya = seriya0 === 'QM' ? 'QM' : 'AS';
  const u = await S.ruxsat(kodSes);   // xatTopKim_
  if (!(await serverda(u.kod))) return eskiTizim('xatTopTayyorla', u, args.slice(1));
  const r = await QY.qulf('xat', async () => {
    const t = (await TP.topRowsYangi(TOP_V)).L.find(z => s(z.id) === s(topId));   // xatTopOl_
    if (!t || !/^talab\|/.test(t.kalit)) throw new S.Xato('Talabnoma topshirig\'i topilmadi.');
    if (!u.admin && !xodimTeng(t.kimga, u.fish)) throw new S.Xato('Bu topshiriq sizga berilmagan.');
    if (t.holati !== 'Jarayonda') throw new S.Xato('Topshiriq «' + t.holati + '» holatida' + (t.holati === 'Tekshiruvda' ? ' — direktor tekshirmoqda.' : '.'));
    const p = t.kalit.split('|'), no = p[1];
    if (seriya === 'QM' && p[2] !== 'qm') throw new S.Xato('Bu topshiriqda qo\'shimcha maydon talabnomasi so\'ralmagan.');
    const bugunIso = V.bugun();
    const x = (await P.xatShartnomalar(bugunIso)).find(z => z.no === no); if (!x) throw new S.Xato('Shartnoma topilmadi: ' + no);
    if (/bekor/i.test(x.holati)) throw new S.Xato('Shartnoma bekor qilingan.');
    const sh = seriya === 'QM' ? x.qm : x.shablon;
    if (!sh) throw new S.Xato(seriya === 'QM' ? (x.qmSabab || 'Qo\'shimcha maydon talabnomasi chiqmaydi.') : '100% to\'lov shartnomasi — talabnoma shabloni yo\'q.');
    if (seriya === 'AS' && !(x.muddati > XAT_MIN_QARZ)) throw new S.Xato('Muddati o\'tgan asosiy qarz yo\'q (100 000 so\'mdan kam) — talabnoma chiqmaydi. Direktorga ayting.');
    if (seriya === 'QM' && !(x.qoshimcha > XAT_MIN_QARZ)) throw new S.Xato('Qo\'shimcha maydon qarzi yo\'q — talabnoma chiqmaydi.');
    const Jx = await XI.xatlarYangi(XAT_V), belgi = new RegExp('top№' + t.id + '(\\D|$)');
    const bor = Jx.find(h => h.no === no && Number(h.bosqich) === 3 && X.xatSeriya(h.shablon) === seriya && h.holati !== 'Bekor' && belgi.test(s(h.izoh)));
    if (bor) {
      const f0 = await pdfOl(bor.pdf);
      if (!f0) { const e = await koprik.chaqir('xatTopPdf', u.kod, [topId, bor.raqam]); return { raqam: bor.raqam, seriya, nom: e.nom, b64: e.b64, muddat: bor.muddat, mavjud: true, ogoh: [] }; }
      return { raqam: bor.raqam, seriya, nom: f0.nom, b64: f0.bytes.toString('base64'), muddat: bor.muddat, mavjud: true, ogoh: [] };
    }
    const ochiq = Jx.find(h => h.no === no && h.holati === 'Tayyorlandi' && X.xatSeriya(h.shablon) === seriya);
    if (ochiq) throw new S.Xato('Bu shartnomada hali yetkazilmagan xat bor (' + ochiq.raqam + ') — avval uni yetkazing yoki direktor bekor qilsin.');
    const yil = bugunIso.slice(0, 4), raqam = keyingiRaqam(Jx, yil);
    const kun = (seriya === 'AS' && x.shablon === 'YANGI_QURILAYOTGAN') ? XAT_MUDDAT_YQ3 : XAT_MUDDAT[3];
    const muddatIso = U.kunQosh(bugunIso, kun);
    const yub = Jx.filter(h => h.no === x.no && h.holati === 'Yuborildi' && X.xatSeriya(h.shablon) === seriya);
    const b1 = yub.filter(h => Number(h.bosqich) === 1).pop(), b2 = yub.filter(h => Number(h.bosqich) === 2).pop();
    const oldin = b1 && b2 ? [b1, b2] : b1 ? [b1] : [];
    let shosh = null;
    if (oldin.length < 2) {
      if (seriya === 'QM') shosh = { qm: true, oldin };
      else { const T = (await U.undTolovlar()).filter(z => z.no === x.no && z.summa > 0); const UJ = await J.undJurnal();
        shosh = { engEski: U.kunQosh(bugunIso, -(Number(x.kechikkan) || 0)), oxirgi: T.length ? T.map(z => z.sana).sort().pop() : '', muloqot: UJ.some(j => j.no === x.no), bugun: bugunIso }; }
    }
    const qmYoq = seriya === 'AS' && !x.qm;
    const Q = { asosiy: x.asosiy, muddati: x.muddati, qoshimcha: qmYoq ? 0 : x.qoshimcha, jami: qmYoq ? x.asosiy : x.jami };
    const f = await XP.xatChiqar(Object.assign({}, x, { shablon: sh }), 3, raqam, bugunIso, muddatIso, Q, oldin, await ijrochi(u.fish), shosh);
    const fl = saqla(yil, f.nom, f.pdf);
    await qatorYoz(XAT_V, [raqam, d(bugunIso), x.no, x.mid, x.fish, x.dokon, sh, 3, Q.asosiy, Q.muddati, Q.qoshimcha, Q.jami, d(muddatIso), 'Tayyorlandi', fl.id,
      '', '', '', '', u.fish, hozir().dmyHms, 'Direktor topshirig\'i top№' + t.id + ' (talabnoma' + (oldin.length < 2 ? ', oldingi xatlarsiz' : '') + ')', '']);
    driveGa(u.kod, { raqam, rel: fl.rel, yil, nom: f.nom }).catch(() => {});
    return { raqam, seriya, nom: f.nom, b64: f.pdf.toString('base64'), muddat: d(muddatIso), ogoh: XP.ismOgoh(x.fish).concat(XP.betOgoh(f.bet, f.ikkiBet)) };
  });
  await yangila();
  return r;
}

// ------------------------------------------------------------------ ▶ Bugungi ish (Qadam.gs v2.2)
async function qadamXatChiqar(args) {
  const [kodSes, d0] = args; const dd = d0 || {};
  const u = await S.ruxsat(kodSes, 'undiruv');
  if (!(await serverda(u.kod))) return eskiTizim('qadamXatChiqar', u, args.slice(1));
  const r = await xatTayyorla([kodSes, s(dd.no || ''), dd.seriya === 'QM' ? 'QM' : 'AS']);
  const m = await require('./qadam').qadamMijoz([kodSes, dd.no]);
  m.xat = { raqam: r.raqam, bosqich: r.bosqich, seriya: r.seriya, nom: r.nom, b64: r.b64, muddat: r.muddat, ogoh: r.ogoh || [] }; return m;
}
async function qadamTalabChiqar(args) {
  const [kodSes, d0] = args; const dd = d0 || {};
  const u = await S.ruxsat(kodSes, 'undiruv');
  if (!(await serverda(u.kod))) return eskiTizim('qadamTalabChiqar', u, args.slice(1));
  const r = await xatTopTayyorla([kodSes, s(dd.topId || ''), dd.seriya === 'QM' ? 'QM' : 'AS']);
  const m = await require('./qadam').qadamMijoz([kodSes, dd.no]);
  m.xat = { raqam: r.raqam, bosqich: 3, seriya: r.seriya, nom: r.nom, b64: r.b64, muddat: r.muddat, ogoh: r.ogoh || [] }; return m;
}

module.exports = { xatTayyorla, xatQaytaYasa, xatTopTayyorla, qadamXatChiqar, qadamTalabChiqar };
module.exports._ichki = { qatorYoz, ijrochi, keyingiRaqam, saqla, pdfOl, driveGa, koprik18, verOk, boshla };
