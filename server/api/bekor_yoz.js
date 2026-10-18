// AKS TIZIM — ✂ shartnomani bir tomonlama BEKOR QILISH so'rovi va hujjatlari serverda (Bekor.gs v25.8.5 bekorKirit / bekorQaytaYasa /
// bekorBuyruqSkan / bekorXabarnomaSkan, Qadam.gs v2.2 qadamBekorKirit bilan bir xil tekshiruvlar, xato matnlari, BQ/BX raqamlash, 06h qatori va javob).
// Hujjatlar — lib/bekor_hujjat.js (Chromium; eski Google Docs buyrug'i va xabarnomasi bilan qatorma-qator solishtirilgan).
// PDF lar avval SERVERDA saqlanadi (/opt/aks/hujjat/bekor/<yil>/…), 06h «Buyruq_PDF» / «Xabarnoma_PDF» = «SRV:<yo'l>» — xodim darhol oladi.
// Keyin fonda eski tizim (Koprik v1.9 koprikBekorSaqla) shu PDF larni direktorning Drive'iga — «AKS TIZIM / 07 BEKOR QILISH / <yil>» — qo'yadi va
// «Word» tugmasi uchun Google Doc nusxasini eski tizimning o'z funksiyalari (bekorBuyruq_, bekorXabarnoma_) bilan shu ma'lumotdan yasaydi;
// 06h O–R ga Drive ID lar yoziladi. Direktor tasdig'i / rad etish / qaytarish va 17:15 nazorati — hali eski tizimda.
// Yoqilishi: Redis yozuv_yondi:bekor («aks-yozuv-sinov bekor») va Koprik ≥ 1.9. Aks holda — eski tizim.
'use strict';
const fs = require('fs');
const path = require('path');
const S = require('./sessiya');
const V = require('../lib/varaq');
const G = require('../lib/google');
const env = require('../lib/env');
const koprik = require('./koprik');
const tetik = require('../lib/kozgu_tetik');
const { redis } = require('../lib/db');
const U = require('../lib/undiruv_yordam');
const XP = require('../lib/xat_pdf');
const BH = require('../lib/bekor_hujjat');
const { xatKirill } = require('../lib/ism');
const { xodimTeng } = require('../lib/xodim');
const QY = require('./qadam_yoz')._ichki;
const XC = require('./xat_chiqar')._ichki;
const XI = require('./xat_isbot')._ichki;
const HY = require('./hujjat_yoz')._ichki;

const BEK = '06h_Bekor_sorovlari', HUJ = '06d_Hujjatlar', XAT_V = XI.XAT_V;
const BEKOR_YOPIQ = ['Bekor qilindi', 'Rad etildi', 'Qaytarildi'];
const BEKOR_SKAN_ISH_KUN = 2, BEKOR_IJARA_OGOH_KUN = 10, XAT_ESKI_CHEGARA = '2025-08-30';
const ILDIZ = env.hujjatPapka || '/opt/aks/hujjat';
const s = v => String(v == null ? '' : v);
const { yhIso, yhDmy } = BH;
const kut = (p, ms) => Promise.race([p, new Promise(r => setTimeout(r, ms))]);
const yangila = () => kut(tetik.varaqlarYangila([BEK]).catch(e => console.error('ko\'zgu (bekor):', e.message)), 15000);
function hozir() { const t = new Date(Date.now() + 5 * 3600 * 1000), p = n => String(n).padStart(2, '0');
  const d = p(t.getUTCDate()) + '.' + p(t.getUTCMonth() + 1) + '.' + t.getUTCFullYear() + ' ' + p(t.getUTCHours()) + ':' + p(t.getUTCMinutes());
  return { dmyHm: d, dmyHms: d + ':' + p(t.getUTCSeconds()) }; }
const harf = n => { let x = ''; while (n > 0) { const m = (n - 1) % 26; x = String.fromCharCode(65 + m) + x; n = Math.floor((n - 1) / 26); } return x; };
const kat = (qator, ustun, qiymatlar) => ({ varaq: BEK, katak: harf(ustun) + qator + (qiymatlar.length > 1 ? ':' + harf(ustun + qiymatlar.length - 1) + qator : ''), qiymat: [qiymatlar] });

// ------------------------------------------------------------------ yoqilganmi
let kv = { ok: false, t: 0 };
async function koprik19(kod) {   // Koprik.gs v1.9 (koprikBekorSaqla) — 30 daqiqa kesh (yo'q bo'lsa 2 daqiqa)
  if (kv.t && Date.now() - kv.t < (kv.ok ? 30 : 2) * 60000) return kv.ok;
  try { kv = { ok: koprik.bor() && XC.verOk(await koprik.chaqir('koprikVersiya', kod, []), '1.9'), t: Date.now() }; } catch (e) { kv = { ok: false, t: Date.now() }; }
  return kv.ok;
}
async function serverda(kod) {
  try { if ((await redis.get('yozuv_yondi:bekor')) !== '1') return false; } catch (e) { return false; }
  return koprik19(kod);
}
async function eskiTizim(fn, u, args) { const r = await koprik.chaqir(fn, u.kod, args); await tetik.yangilaKut(20000); return r; }
async function bekorKirish(kodSes) {   // bekorKirish_
  const u = await S.ruxsat(kodSes);
  if (!u.admin && !u.huquq.includes('undiruv') && !u.huquq.includes('hujjat')) throw new S.Xato('Bu bo\'limga ruxsatingiz yo\'q.');
  return u;
}

// ------------------------------------------------------------------ o'qish (Google'dan YANGI — yozishdan oldin)
// 06h_Bekor_sorovlari (bekorJurnal_ — getDisplayValues)
async function bekorJurnalYangi() {
  const n = v => Number(s(v).replace(/[^\d.-]/g, '')) || 0;
  return (await HY.yangiQatorlar(BEK, 'AE')).map(({ qator, r: r0 }) => { const r = []; for (let k = 0; k < 31; k++) r.push(s(r0[k]));
    return { qator, id: r[0], no: r[1], tur: r[2], fish: r[3], dokon: r[4], sabab: r[5], holati: r[6], raqam: r[7], sana: r[8],
      shablon: r[9], jami: n(r[10]), tolangan: n(r[11]), jarima: n(r[12]), qaytar: n(r[13]),
      bPdf: r[14], bDoc: r[15], xPdf: r[16], xDoc: r[17], bSkan: r[18], usul: r[19], yetSana: r[20], pochta: r[21], xSkan: r[22],
      xatOgoh: r[23] === 'Ha', kim: r[24], vaqt: r[25], tKim: r[26], tVaqt: r[27], eski: r[28], izoh: r[29], xRaqam: r[30] }; }).filter(z => z.id);
}
async function hujjatlarYangi() {   // hujjatJurnal_ — kerakli maydonlar
  return (await HY.yangiQatorlar(HUJ, 'O')).map(({ r }) => ({ id: s(r[0]), no: s(r[1]), turi: s(r[5]), sana: s(r[6]), holati: s(r[13]) })).filter(h => h.id);
}
function bekorKeyingi(Jr, kalit, seriya, yil) {   // bekorKeyingi_ — BQ yoki BX ning yildagi keyingi raqami (bekor qilingani ham hisobda)
  const t = Jr.filter(z => s(z[kalit]).indexOf(seriya + '-' + yil + '/') === 0).reduce((m, z) => Math.max(m, Number(s(z[kalit]).split('/')[1]) || 0), 0) + 1;
  return seriya + '-' + yil + '/' + ('000' + t).slice(-4);
}

// ------------------------------------------------------------------ shartnoma ma'lumotlari (bekorShartnoma_ + bekorMijozQosh_ + bekorDokonQosh_)
function aOxiri(rows) { let m = 0; rows.forEach(({ n, x }) => { if (x[0] !== null && x[0] !== undefined && x[0] !== '') m = n; }); return rows.filter(z => z.n <= m); }
const xom = (x, n) => { const o = []; for (let i = 0; i < n; i++) o.push(x[i] == null ? '' : x[i]); return o; };   // getValues
function oraliq(rows, bosh, soni) { const M = {}; rows.forEach(z => { M[z.n] = z; }); const o = []; for (let n = bosh; n < bosh + soni; n++) o.push(M[n] || { n, x: [], r: [] }); return o; }
const isoV = v => typeof v === 'number' ? V.iso(v) : yhIso(v);
// Shartnoma qatori: ko'zgudan topiladi, qiymatlari (to'langan, qarz — formulalar) Google'dan shu zahoti yangi o'qiladi
async function qatorYangi(varaq, rows, no, gacha, n) {
  const i = rows.findIndex(z => s(z.x[0]).trim() === no);
  if (i < 0) return null;
  const q = rows[i].n;
  try {
    const r = ((await G.oraliqOqi(env.aksBazaId, varaq, 'A' + q + ':' + gacha + q, env.googleKey, 'UNFORMATTED_VALUE'))[0]) || [];
    if (s(r[0]).trim() === no) return { qator: q, r: xom(r, n) };
  } catch (e) { console.error('bekor (' + varaq + ' qatori):', e.message); }
  return { qator: q, r: xom(rows[i].x, n) };
}
async function bekorShartnoma(no) {
  no = s(no).trim();
  let x;
  if (/^IJ-/.test(no)) {
    const q = await qatorYangi('04_Ijara_shartnomalar', aOxiri(await V.qatorlar('04_Ijara_shartnomalar')), no, 'X', 24);
    if (!q) return null;
    const r = q.r;
    x = { tur: 'ijara', qator: q.qator, no, sana: isoV(r[1]), holati: s(r[2]), dokon: s(r[4]), mid: s(r[5]), beruvchi: s(r[6]), bosh: isoV(r[9]), tug: isoV(r[10]),
      oylik: Number(s(r[14]).replace(/[^\d.-]/g, '')) || 0, masul: s(r[20]).trim(), fish: s(r[23]),
      shablon: 'IJARA', qiymat: 0, tolangan: 0, asosiy: 0, qoshimcha: 0, jami: 0, muddati: 0, kechikkan: 0, undiruvchi: '' };
  } else {
    const q = await qatorYangi('03_Sotuv_shartnomalar', aOxiri(await V.qatorlar('03_Sotuv_shartnomalar')), no, 'AG', 33);
    if (!q) return null;
    const r3 = q.r;
    x = { tur: 'sotuv', qator: q.qator, no, sana: isoV(r3[2]), turi: s(r3[3]), mid: s(r3[4]), dokon: s(r3[5]), maydon: Number(r3[6]) || 0, holati: s(r3[13]), notarial: isoV(r3[15]),
      undiruvchi: s(r3[17]).trim(), fish: s(r3[20]), qiymat: Number(r3[22]) || 0, tolangan: Number(r3[27]) || 0, asosiy: Number(r3[28]) || 0, qoshimcha: Number(r3[29]) || 0,
      jami: Number(r3[30]) || 0, muddati: Number(r3[31]) || 0, kechikkan: Number(r3[32]) || 0, masul: '' };
  }
  // bekorMijozQosh_ (02_Mijozlar, 26 ustun)
  const m = aOxiri(await V.qatorlar('02_Mijozlar')).map(z => xom(z.x, 26)).find(z => s(z[0]) === s(x.mid));
  x.fishK = xatKirill(x.fish || (m ? s(m[2]) : ''));
  x.manzil = m ? U.mijozManzil(m) : '';
  x.tel = m ? s(m[4]) : '';
  // bekorDokonQosh_ (01_Dokonlar 2..641)
  const d = oraliq(await V.qatorlar('01_Dokonlar'), 2, 640).map(z => ({ n: z.n, r: xom(z.x, 26) })).find(z => s(z.r[0]) === s(x.dokon));
  if (!d) x.dk = null;
  else {
    const r = d.r;
    x.dk = { qator: d.n, blok: String(r[2]), qavat: String(r[3]), nomer: String(r[4]), maydon: Number(r[5]) || 0, qurilish: s(r[7]), sotuvNo: s(r[17]), egasi: s(r[18]),
      ijaraNo: s(r[21]), ijarachi: s(r[22]), holat: s(r[25]) };
    if (!x.maydon) x.maydon = x.dk.maydon;
  }
  if (x.tur === 'sotuv') {
    if (/100%/.test(x.turi)) x.shablon = 'TOLIQ';
    else if (x.sana && x.sana < XAT_ESKI_CHEGARA) x.shablon = x.dk && x.dk.qurilish === 'Якунланмаган' ? 'ESKI_QURILAYOTGAN' : 'ESKI_TAYYOR';
    else x.shablon = /Қурилаётган/.test(x.turi) ? 'YANGI_QURILAYOTGAN' : 'YANGI_TAYYOR';
  }
  return x;
}
// bekorXatlar_ — yuborilgan ogohlantirish xatlari jumlasi (buyruq va xabarnoma uchun bir xil)
function bekorXatlar(x, HJ, XJ) {
  if (x.tur === 'ijara') {
    const og = HJ.filter(h => h.no === x.no && h.turi === 'OGOHLANTIRISH' && h.holati === 'Faol').sort((a, b) => yhIso(a.sana) < yhIso(b.sana) ? -1 : 1);
    if (og.length) return { jumla: 'Жамият томонидан Ижарачига ' + og.map(h => BH.yhSozDa(yhIso(h.sana))).join(', ')
      + ' ёзма огоҳлантириш хати юборилган (нусхаси иш материалларида), бироқ камчилик бартараф этилмаган.', yoq: false, og };
    return { jumla: 'Ижарачига ёзма огоҳлантириш хати юборилмаган.', yoq: true, og: [] };
  }
  const yub = XJ.filter(h => h.no === x.no && h.holati === 'Yuborildi');
  if (yub.length) return { jumla: 'Жамият томонидан мижозга ' + yub.map(h => yhDmy(yhIso(h.yetSana || h.sana)) + ' санада №' + h.raqam + '-рақамли огоҳлантириш хати').join(', ')
    + ' юборилган, бироқ қарздорлик бартараф этилмаган.', yoq: false, og: yub };
  if (!x.tolangan) return { jumla: 'Мижоз томонидан шартнома бўйича бирорта тўлов амалга оширилмаган.', yoq: true, og: [] };
  return { jumla: '', yoq: true, og: [] };   // hujjatda yozilmaydi — ogohlantirish faqat direktorga
}
// bekorTekshir_ — so'rov kiritish mumkinmi
async function bekorTekshir(u, no, BJ) {
  const x = await bekorShartnoma(no);
  if (!x) return { ok: false, sabab: 'Shartnoma bazada topilmadi: ' + no };
  if (/bekor/i.test(x.holati)) return { ok: false, sabab: 'Shartnoma allaqachon bekor qilingan (' + x.holati + ').', x };
  if (x.shablon === 'TOLIQ') return { ok: false, sabab: '100% to\'lov shartnomasi — bekor qilish tartibi alohida ko\'rib chiqiladi, Kamoliddinga ayting.', x };
  const ochiq = BJ.find(z => z.no === no && BEKOR_YOPIQ.indexOf(z.holati) < 0);
  if (ochiq) return { ok: false, sabab: 'Bu shartnoma bo\'yicha ochiq so\'rov bor: ' + ochiq.raqam + ' (' + ochiq.holati + ', ' + ochiq.kim + ').', x, s: ochiq };
  if (!u.admin) {
    if (x.tur === 'sotuv' && !xodimTeng(x.undiruvchi, u.fish))
      return { ok: false, sabab: 'Sotuv shartnomasini bekor qilishga faqat biriktirilgan undiruvchi (' + (x.undiruvchi || 'biriktirilmagan') + ') yoki direktor kiritadi.', x };
    if (x.tur === 'ijara' && !xodimTeng(x.masul, u.fish))
      return { ok: false, sabab: 'Ijara shartnomasini bekor qilishga faqat uni tuzgan xodim (' + (x.masul || 'noma\'lum') + ') yoki direktor kiritadi.', x };
  }
  const HJ = await hujjatlarYangi();
  if (!HJ.some(h => h.no === no && h.turi === 'SHARTNOMA' && h.holati === 'Faol')) return { ok: false, sabab: 'Imzolangan shartnoma skani yuklanmagan — avval «📎 Hujjatlar» bo\'limida SHARTNOMA turini yuklang.', x };
  const X = bekorXatlar(x, HJ, x.tur === 'ijara' ? [] : await XI.xatlarYangi(XAT_V));
  if (x.tur === 'ijara') {
    if (!X.og.length) return { ok: false, sabab: 'Ijara shartnomasining 6.3-bandi: avval yozma ogohlantirish yuboriladi (skani «📎 Hujjatlar»da OGOHLANTIRISH turi bilan yuklanadi) va kamchilikni tuzatishga ' + BEKOR_IJARA_OGOH_KUN + ' kun beriladi.', x };
    const bugun = V.bugun();
    const chegara = new Date(Date.now() + 5 * 3600000 - BEKOR_IJARA_OGOH_KUN * 86400000).toISOString().slice(0, 10);
    const bor = X.og.some(h => { const t = yhIso(h.sana); return t && t <= chegara && t <= bugun; });
    if (!bor) return { ok: false, sabab: 'Ijara 6.3-band: ogohlantirish xatidan keyin ' + BEKOR_IJARA_OGOH_KUN + ' kun o\'tishi kerak (oxirgi ogohlantirish: ' + yhDmy(yhIso(X.og[X.og.length - 1].sana)) + ').', x };
  }
  const ogoh = [];
  let xatOgoh = false;
  if (x.tur === 'sotuv' && X.yoq && (x.shablon === 'YANGI_TAYYOR' || x.shablon === 'YANGI_QURILAYOTGAN')) {
    xatOgoh = true;
    ogoh.push('Bu yangi shartnoma bo\'yicha bironta ogohlantirish xati yuborilmagan — so\'rov qabul qilinadi, lekin direktorga qizil ogohlantirish bilan boradi.');
  }
  if (/^ESKI/.test(x.shablon))
    ogoh.push('Eski shartnoma (4.2.1): xabarnoma SHARTNOMADA ko\'rsatilgan manzilga yuboriladi — manzilni imzolangan shartnoma skani bilan solishtiring (elektron va imzolangan nusxada manzil farq qilishi mumkin).');
  if (x.tur === 'ijara' && x.beruvchi && x.beruvchi !== 'MChJ')
    ogoh.push('Ijara do\'kon egasi nomidan tuzilgan (' + x.beruvchi + (x.dk && x.dk.egasi !== 'SOTILMAGAN' ? ': ' + x.dk.egasi : '') + ') — bekor qilishni egasi bilan kelishing.');
  if (x.tur === 'sotuv' && x.dk && x.dk.ijaraNo)
    ogoh.push('Do\'konda faol ijara bor (' + x.dk.ijaraNo + ') — sotuv bekor qilinganda ijara shartnomasiga tegilmaydi, u alohida ko\'rib chiqiladi.');
  return { ok: true, x, X, ogoh, xatOgoh };
}
async function bekorMasulmi(u, z) {   // bekorMasulmi_
  if (u.admin || z.kim === u.fish) return true;
  const x = await bekorShartnoma(z.no);
  if (!x) return false;
  return (x.tur === 'sotuv' && xodimTeng(x.undiruvchi, u.fish)) || (x.tur === 'ijara' && xodimTeng(x.masul, u.fish));
}

// ------------------------------------------------------------------ hujjatlar (bekorHujjatYasa_) — serverda saqlanadi
function saqla(rel, pdf) {
  const yol = path.join(ILDIZ, rel);
  fs.mkdirSync(path.dirname(yol), { recursive: true });
  fs.writeFileSync(yol, pdf);
  return 'SRV:' + rel;
}
async function hujjatYasa(x, X, P, raqam, xRaqam, sanaIso, u) {
  const noF = x.no.replace(/\//g, '-'), rF = raqam.replace('/', '-');
  const fam = s(x.fish).split(/\s+/)[0] || 'Mijoz';
  const bNom = 'Bekor_buyruq_' + noF + '_' + fam + '_' + rF, xNom = 'Bekor_xabarnoma_' + noF + '_' + fam + '_' + xRaqam.replace('/', '-');
  const b = await BH.buyruqYasa(x, X, P, raqam, sanaIso);
  const h = await BH.xabarnomaYasa(x, X, P, raqam, xRaqam, sanaIso, await XC.ijrochi(u.fish));
  const yil = sanaIso.slice(0, 4), belgi = Date.now().toString(36) + Math.random().toString(36).slice(2, 5), fx = n => n.replace(/[\/\\]/g, '-');
  const bRel = 'bekor/' + yil + '/' + belgi + '/' + fx(bNom) + '.pdf', xRel = 'bekor/' + yil + '/' + belgi + '/' + fx(xNom) + '.pdf';
  return { bPdf: saqla(bRel, b.pdf), bDoc: '', xPdf: saqla(xRel, h.pdf), xDoc: '', bNom: bNom + '.pdf', bB64: b.pdf.toString('base64'), xNom: xNom + '.pdf', xB64: h.pdf.toString('base64'),
    bet: h.bet, kochir: { yil, bNom, xNom, bRel, xRel, x, X, P, raqam, xRaqam, sana: sanaIso, fish: u.fish } };
}

// ------------------------------------------------------------------ Drive'ga ko'chirish (fon) — Koprik v1.9 koprikBekorSaqla
// Kutilayotganlar Redis'da (server qayta ishga tushsa ham yo'qolmaydi): bekor_kochir (to'plam) + bekor_kochir:<id> (JSON).
const yolda = new Set();
async function navbatga(id, k) { try { await redis.set('bekor_kochir:' + id, JSON.stringify(k), 'EX', 60 * 86400); await redis.sadd('bekor_kochir', String(id)); } catch (e) { console.error('bekor navbat:', e.message); } }
async function navbatdan(id, k) {
  try { const j = await redis.get('bekor_kochir:' + id); if (j && JSON.parse(j).bRel !== k.bRel) return;   // shu orada qayta yasalgan — yangisi navbatda qoladi
    await redis.del('bekor_kochir:' + id); await redis.srem('bekor_kochir', String(id)); } catch (e) { }
}
async function driveGa(kod, id, k, urinish = 0) {
  if (!koprik.bor() || yolda.has(id + '|' + k.bRel)) return null;
  yolda.add(id + '|' + k.bRel);
  try {
    const b64 = rel => fs.readFileSync(path.join(ILDIZ, rel)).toString('base64');
    const r = await koprik.chaqir('koprikBekorSaqla', kod, [{ yil: k.yil, bNom: k.bNom, xNom: k.xNom, bB64: b64(k.bRel), xB64: b64(k.xRel), x: k.x, X: { jumla: k.X.jumla }, P: k.P,
      raqam: k.raqam, xRaqam: k.xRaqam, sana: k.sana, fish: k.fish, eski: k.eski || [] }]);
    if (!r || !r.bPdf || !r.xPdf) throw new Error('Drive ID qaytmadi');
    try { await redis.set('xat_srv:' + r.bPdf, k.bRel, 'EX', 400 * 86400); await redis.set('xat_srv:' + r.xPdf, k.xRel, 'EX', 400 * 86400); } catch (e) { }
    const yozildi = await QY.qulf('bekor', async () => {
      const z = (await bekorJurnalYangi()).find(q => s(q.id) === s(id));
      if (!z || z.bPdf !== 'SRV:' + k.bRel || z.xPdf !== 'SRV:' + k.xRel) return false;
      await G.yoz(env.aksBazaId, [kat(z.qator, 15, [r.bPdf, r.bDoc || '', r.xPdf, r.xDoc || ''])], env.googleKey);
      return true;
    });
    await navbatdan(id, k);
    if (yozildi) { tetik.varaqlarYangila([BEK]).catch(() => {}); console.log(new Date().toISOString(), 'bekor hujjatlari Drive ga ko\'chdi:', k.raqam, '→', r.bPdf, r.xPdf); return r; }
    koprik.chaqir('koprikBekorSaqla', kod, [{ eski: [r.bPdf, r.bDoc, r.xPdf, r.xDoc].filter(Boolean) }]).catch(e => console.error('bekor (eski nusxa savatga):', e.message));
    console.log(new Date().toISOString(), 'bekor hujjatlari qayta yasalgan — ko\'chgan nusxa savatga:', k.raqam);
    return null;
  } catch (e) {
    console.error(new Date().toISOString(), 'bekor Drive ko\'chirish (' + (urinish + 1) + '):', k.raqam, e.message);
    if (urinish < 3) setTimeout(() => driveGa(kod, id, k, urinish + 1).catch(() => {}), 10 * 60000).unref();
    return null;
  } finally { yolda.delete(id + '|' + k.bRel); }
}
// Har 15 daqiqada: navbatda qolganlar (Koprik yangilanmagan / internet uzilgan / server qayta ishga tushgan bo'lsa)
let aylanmoqda = false;
async function qolganlarniKochir() {
  if (aylanmoqda || !koprik.bor()) return; aylanmoqda = true;
  try {
    const ids = await redis.smembers('bekor_kochir'); if (!ids.length) return;
    const { q } = require('../lib/db');
    const a = (await q(`SELECT kirish_kodi FROM v_xodimlar WHERE holat='Ishlayapti' AND 'admin' = ANY(huquqlar) ORDER BY qator_no LIMIT 1`)).rows[0];
    if (!a || !(await koprik19(a.kirish_kodi))) return;
    for (const id of ids.slice(0, 3)) {
      const j = await redis.get('bekor_kochir:' + id); if (!j) { await redis.srem('bekor_kochir', id); continue; }
      const k = JSON.parse(j);
      if (!fs.existsSync(path.join(ILDIZ, k.bRel)) || !fs.existsSync(path.join(ILDIZ, k.xRel))) { await navbatdan(id, k); continue; }
      await driveGa(a.kirish_kodi, id, k, 3);
    }
  } catch (e) { console.error('qolgan bekor hujjatlari:', e.message); } finally { aylanmoqda = false; }
}
function boshla() { const t = setInterval(() => qolganlarniKochir().catch(() => {}), 15 * 60000); t.unref(); setTimeout(() => qolganlarniKochir().catch(() => {}), 120000).unref(); }

// 06h yangi qator (bekorKirit): B, H, I, U, AE — matn (@), qolgani — eski tizimdagi setValues kabi (USER_ENTERED)
async function qatorYoz(varaq, row, q) {
  const g = await G.gid(env.aksBazaId, varaq, env.googleKey);
  const matn = (c, qiymat) => ({ updateCells: { range: { sheetId: g, startRowIndex: row - 1, endRowIndex: row, startColumnIndex: c - 1, endColumnIndex: c - 1 + (qiymat ? qiymat.length : 1) },
    rows: [{ values: qiymat ? qiymat.map(v => ({ userEnteredValue: { stringValue: s(v) }, userEnteredFormat: { numberFormat: { type: 'TEXT', pattern: '@' } } }))
      : [{ userEnteredFormat: { numberFormat: { type: 'TEXT', pattern: '@' } } }] }],
    fields: qiymat ? 'userEnteredValue,userEnteredFormat.numberFormat' : 'userEnteredFormat.numberFormat' } });
  await G.soralar(env.aksBazaId, [matn(2, [q[1]]), matn(8, [q[7], q[8]]), matn(21), matn(31, [q[30]])], env.googleKey);
  const k = (c, v) => ({ varaq, katak: harf(c) + row + (v.length > 1 ? ':' + harf(c + v.length - 1) + row : ''), qiymat: [v] });
  await G.yoz(env.aksBazaId, [k(1, [q[0]]), k(3, q.slice(2, 7)), k(10, q.slice(9, 30))], env.googleKey);   // U (21) — bo'sh, formati yuqorida
}

// ------------------------------------------------------------------ 1-2-bosqich: so'rov + hujjatlar (bekorKirit)
async function bekorKirit(args) {
  const [kodSes, no0, sabab0] = args;
  const u = await bekorKirish(kodSes);
  if (!(await serverda(u.kod))) return eskiTizim('bekorKirit', u, args.slice(1));
  const no = s(no0).trim();
  const sabab = s(sabab0).replace(/\s+/g, ' ').trim();
  if (sabab.length < 15) throw new S.Xato('Sababini to\'liq yozing (kamida 15 belgi) — buyruq va xabarnoma shu asosda chiqadi.');
  const r = await QY.qulf('bekor', async () => {
    const BJ = await bekorJurnalYangi();
    const t = await bekorTekshir(u, no, BJ);
    if (!t.ok) throw new S.Xato(t.sabab);
    const x = t.x;
    const bugunIso = V.bugun(), yil = bugunIso.slice(0, 4);
    const raqam = bekorKeyingi(BJ, 'raqam', 'BQ', yil), xRaqam = bekorKeyingi(BJ, 'xRaqam', 'BX', yil);
    const P = BH.bekorPul(x);
    const f = await hujjatYasa(x, t.X, P, raqam, xRaqam, bugunIso, u);
    const A = await G.ustunOqi(env.aksBazaId, BEK, 'A', env.googleKey);   // ustunA_oxiri_
    const last = A.length;
    const ids = last >= 2 ? A.slice(1, last).map(v => Number(v) || 0) : [0];
    const id = Math.max.apply(null, ids) + 1;
    await qatorYoz(BEK, last + 1, [id, no, x.tur === 'ijara' ? 'Ijara' : 'Sotuv', x.fishK, x.dokon, sabab,
      'Hujjatlar tayyorlandi', raqam, yhDmy(bugunIso), x.shablon, x.jami, x.tolangan, P.jarima, P.qaytar,
      f.bPdf, f.bDoc, f.xPdf, f.xDoc, '', '', '', '', '', t.xatOgoh ? 'Ha' : '', u.fish,
      hozir().dmyHms, '', '', '', f.bet > 1 ? 'Xabarnoma ' + f.bet + ' bet' : '', xRaqam]);
    await navbatga(id, f.kochir);
    const ogoh = t.ogoh.concat(XP.ismOgoh(x.fish));
    if (f.bet > 1) ogoh.push('Xabarnoma ' + f.bet + ' betga chiqdi — ikkala betni chop eting.');
    return { id, kochir: f.kochir, javob: { ok: true, id, raqam, xRaqam, no, fish: x.fishK, holati: 'Hujjatlar tayyorlandi',
      buyruqNom: f.bNom, buyruqB64: f.bB64, xabNom: f.xNom, xabB64: f.xB64, ogoh,
      eslatma: 'Ikkala hujjatni chop eting → direktorga imzolating (muhr bilan) → xabarnomani mijozga yetkazing → ikkala skanini shu yerdan yuklang. Skanlar yuklanmasa ertaga Telegram eslatmasi, ' + BEKOR_SKAN_ISH_KUN + ' ish kundan keyin direktorga qizil xabar boradi.' } };
  });
  await yangila();
  driveGa(u.kod, r.id, r.kochir).catch(() => {});
  return r.javob;
}

// ------------------------------------------------------------------ qayta yasash (raqam qoladi, sana yangilanadi) — bekorQaytaYasa
async function bekorQaytaYasa(args) {
  const [kodSes, id] = args;
  const u = await bekorKirish(kodSes);
  if (!(await serverda(u.kod))) return eskiTizim('bekorQaytaYasa', u, args.slice(1));
  const r = await QY.qulf('bekor', async () => {
    const BJ = await bekorJurnalYangi();
    const z = BJ.find(q => s(q.id) === s(id));
    if (!z) throw new S.Xato('So\'rov topilmadi (ID ' + id + ').');
    if (z.holati !== 'Hujjatlar tayyorlandi') throw new S.Xato('Qayta yasash faqat skan yuklanmagan «Hujjatlar tayyorlandi» holatida mumkin (hozir: ' + z.holati + ').');
    if (!u.admin && z.kim !== u.fish) throw new S.Xato('Bu hujjatlarni faqat so\'rovni kiritgan xodim yoki direktor qayta yasay oladi.');
    const x = await bekorShartnoma(z.no);
    if (!x) throw new S.Xato('Shartnoma topilmadi: ' + z.no);
    const X = bekorXatlar(x, x.tur === 'ijara' ? await hujjatlarYangi() : [], x.tur === 'ijara' ? [] : await XI.xatlarYangi(XAT_V));
    const P = BH.bekorPul(x);
    const bugunIso = V.bugun();
    const xRaqam = z.xRaqam || bekorKeyingi(BJ, 'xRaqam', 'BX', bugunIso.slice(0, 4));   // v25.8.4 gacha kiritilganlarga BX shu yerda beriladi
    const f = await hujjatYasa(x, X, P, z.raqam, xRaqam, bugunIso, u);
    // eski fayllar: Drive'dagilari — yangisi ko'chganda savatga (eski tizim darhol yhOchir_ qilardi); hali serverda (SRV) bo'lsa — uning ko'chirilishi o'zi savatga tashlaydi
    f.kochir.eski = [z.bPdf, z.bDoc, z.xPdf, z.xDoc].filter(fid => fid && !/^SRV:/.test(fid));
    const Y = [kat(z.qator, 9, [yhDmy(bugunIso)]), kat(z.qator, 11, [x.jami, x.tolangan, P.jarima, P.qaytar]), kat(z.qator, 15, [f.bPdf, f.bDoc, f.xPdf, f.xDoc]),
      kat(z.qator, 30, [(z.izoh ? z.izoh + ' | ' : '') + 'Qayta yasaldi (' + u.fish + ', ' + hozir().dmyHm + ')'])];
    if (!z.xRaqam) {
      const g = await G.gid(env.aksBazaId, BEK, env.googleKey);
      await G.soralar(env.aksBazaId, [{ updateCells: { range: { sheetId: g, startRowIndex: z.qator - 1, endRowIndex: z.qator, startColumnIndex: 30, endColumnIndex: 31 },
        rows: [{ values: [{ userEnteredValue: { stringValue: xRaqam }, userEnteredFormat: { numberFormat: { type: 'TEXT', pattern: '@' } } }] }], fields: 'userEnteredValue,userEnteredFormat.numberFormat' } }], env.googleKey);
    }
    await G.yoz(env.aksBazaId, Y, env.googleKey);
    await navbatga(z.id, f.kochir);
    return { id: z.id, kochir: f.kochir, javob: { ok: true, id: z.id, raqam: z.raqam, xRaqam, buyruqNom: f.bNom, buyruqB64: f.bB64, xabNom: f.xNom, xabB64: f.xB64 } };
  });
  await yangila();
  driveGa(u.kod, r.id, r.kochir).catch(() => {});
  return r.javob;
}

// ------------------------------------------------------------------ 4-bosqich: skanlar (bekorBuyruqSkan, bekorXabarnomaSkan)
// Fayl va 06d yozuvi — hujjatYukla_ ning o'zi (api/hujjat_yoz.js yuklaYadro); 06h holati — fayl yuklangach, qulf ostida yangi o'qib
async function bekorSkanOldin(u, id) {   // bekorSkanOldin_
  const z = (await bekorJurnalYangi()).find(q => s(q.id) === s(id));
  if (!z) throw new S.Xato('So\'rov topilmadi (ID ' + id + ').');
  if (BEKOR_YOPIQ.indexOf(z.holati) >= 0) throw new S.Xato('So\'rov yopilgan: ' + z.holati + '.');
  if (!(await bekorMasulmi(u, z))) throw new S.Xato('Bu so\'rov bo\'yicha skan yuklashga ruxsatingiz yo\'q.');
  return z;
}
function bekorSkanSana(z, sana) {   // bekorSkanSana_
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s(sana))) throw new S.Xato('Sanani tanlang.');
  const bIso = yhIso(z.sana);
  if (bIso && sana < bIso) throw new S.Xato('Sana buyruq sanasidan (' + z.sana + ') oldin bo\'lolmaydi.');
}
const bekorSh = z => ({ no: z.no, tur: z.tur === 'Ijara' ? 'ijara' : 'sotuv', fish: z.fish, dokon: z.dokon });
async function holatYoz(z, kataklar) {   // bekorHolatYangila_ — ikkala skan bo'lsa «Tasdiq kutilmoqda»
  await QY.qulf('bekor', async () => {
    const y = (await bekorJurnalYangi()).find(q => s(q.id) === s(z.id)) || z;
    const bSkan = kataklar.bSkan !== undefined ? kataklar.bSkan : y.bSkan, xSkan = kataklar.xSkan !== undefined ? kataklar.xSkan : y.xSkan;
    await G.yoz(env.aksBazaId, kataklar.Y.concat([kat(y.qator, 7, [bSkan && xSkan ? 'Tasdiq kutilmoqda' : 'Hujjatlar kutilmoqda'])]), env.googleKey);
  });
  await yangila();
}
async function bekorBuyruqSkan(args) {
  const [kodSes, id, sana, b64, sahifa] = args;
  const u = await bekorKirish(kodSes);
  if (!(await serverda(u.kod))) return eskiTizim('bekorBuyruqSkan', u, args.slice(1));
  const z = await bekorSkanOldin(u, id);
  if (z.bSkan) throw new S.Xato('Buyruq skani allaqachon yuklangan: ' + z.bSkan);
  bekorSkanSana(z, sana);
  const r = await HY.yuklaYadro(u, { turi: 'BEKOR_BUYRUQ', sana, b64, sahifa, izoh: z.raqam + ' · Бекор қилиш буйруғи (имзоланган, муҳрланган)' }, bekorSh(z));
  await holatYoz(z, { bSkan: r.nom, Y: [kat(z.qator, 19, [r.nom])] });
  return { ok: true, id: z.id, nom: r.nom };
}
async function bekorXabarnomaSkan(args) {
  const [kodSes, id, usul, sana, b64, sahifa, pochtaNo0] = args;
  const u = await bekorKirish(kodSes);
  if (!(await serverda(u.kod))) return eskiTizim('bekorXabarnomaSkan', u, args.slice(1));
  const z = await bekorSkanOldin(u, id);
  if (z.xSkan) throw new S.Xato('Xabarnoma skani allaqachon yuklangan: ' + z.xSkan);
  if (usul !== 'qol' && usul !== 'pochta') throw new S.Xato('Yetkazish usulini tanlang.');
  const pochtaNo = s(pochtaNo0).replace(/\s+/g, '').toUpperCase();
  if (usul === 'pochta' && pochtaNo.length < 5) throw new S.Xato('Pochta jo\'natma raqamini yozing (masalan RB191625837UZ) — bekor qilish sanasi yetkazilgan kundan hisoblanadi, isbot shu.');
  bekorSkanSana(z, sana);
  const r = await HY.yuklaYadro(u, { turi: 'BEKOR_XABARNOMA', sana, b64, sahifa,
    izoh: (z.xRaqam || z.raqam) + ' · Бекор қилиш хабарномаси (буйруқ ' + z.raqam + ') · ' + (usul === 'pochta' ? 'почта ' + pochtaNo + ' (имзоланган нусха + квитанция)' : 'қўлма-қўл (мижоз имзоси билан)') }, bekorSh(z));
  await holatYoz(z, { xSkan: r.nom, Y: [kat(z.qator, 20, [usul === 'pochta' ? 'Pochta' : 'Qo\'lma-qo\'l', s(sana).split('-').reverse().join('.'), pochtaNo, r.nom])] });
  return { ok: true, id: z.id, nom: r.nom };
}

// ------------------------------------------------------------------ ▶ Bugungi ish (Qadam.gs v2.2 qadamBekorKirit)
async function qadamBekorKirit(args) {
  const [kodSes, d0] = args; const dd = d0 || {};
  const u = await S.ruxsat(kodSes, 'undiruv');
  if (!(await serverda(u.kod))) return eskiTizim('qadamBekorKirit', u, args.slice(1));
  const r = await bekorKirit([kodSes, s(dd.no || ''), s(dd.sabab || '')]);
  const m = await require('./qadam').qadamMijoz([kodSes, dd.no]); m.saqlandi = r; return m;
}

module.exports = { bekorKirit, bekorQaytaYasa, bekorBuyruqSkan, bekorXabarnomaSkan, qadamBekorKirit };
module.exports._ichki = { bekorShartnoma, bekorXatlar, bekorTekshir, bekorJurnalYangi, bekorKeyingi, hujjatYasa, qatorYoz, driveGa, koprik19, boshla, saqla };
