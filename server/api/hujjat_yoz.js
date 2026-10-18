// AKS TIZIM — 📎 hujjat (skan) YUKLASH serverda (Hujjat.gs v25.9 hujjatYukla + hujjatYukla_ bilan bir xil tekshiruvlar va 06d yozuvi).
// Fayl avval SERVERDA saqlanadi (/opt/aks/hujjat/<shartnoma>/<nom>.pdf) — xodim 2–3 soniyada javob oladi.
// Keyin fonda eski tizim (Koprik.gs v1.3 koprikDriveSaqla → hujjatPapka_) faylni direktorning Drive'iga o'sha papkaga ko'chiradi:
// fayllar egasi avvalgidek direktor, Drive — asosiy arxiv. Ko'chguncha 06d «Fayl_ID» = «SRV:<yo'l>», ko'chgach Drive ID yoziladi.
// ✎ Tuzatish (hujjatTuzat) ham shu yerda — pastda.
// Server o'quvchilari (yuristHujjat, hujjatlarRoyxati) SRV ni tushunadi; eski tizimdagi o'quvchilar faqat Drive ID ni — shuning uchun ko'chirish darhol boshlanadi.
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const S = require('./sessiya');
const V = require('../lib/varaq');
const J = require('../lib/jurnallar');
const G = require('../lib/google');
const env = require('../lib/env');
const koprik = require('./koprik');
const tetik = require('../lib/kozgu_tetik');
const { redis } = require('../lib/db');
const H = require('./hujjat');

const HUJ = '06d_Hujjatlar', HUJJAT_MAX_MB = 25, HUJJAT_BIR_MARTA = ['SHARTNOMA'];
const ILDIZ = env.hujjatPapka || '/opt/aks/hujjat';
const t = v => String(v == null ? '' : v).replace(/\s+/g, ' ').trim();
function hozir() { const d = new Date(Date.now() + 5 * 3600 * 1000), p = n => String(n).padStart(2, '0'); return p(d.getUTCDate()) + '.' + p(d.getUTCMonth() + 1) + '.' + d.getUTCFullYear() + ' ' + p(d.getUTCHours()) + ':' + p(d.getUTCMinutes()) + ':' + p(d.getUTCSeconds()); }
function hujjatRaqam(izoh) { const r = String(izoh || '').split(' · ')[0].trim(); return (r.length <= 24 && /OG-\d|№|\d\/|\/\d/.test(r)) ? r : ''; }
const srvYol = faylId => /^SRV:/.test(String(faylId || '')) ? path.join(ILDIZ, String(faylId).slice(4)) : '';

async function qulfBilan(ish) {
  const kalit = 'qulf:hujjat', belgi = crypto.randomBytes(8).toString('hex'), t0 = Date.now();
  while (!(await redis.set(kalit, belgi, 'PX', 30000, 'NX'))) { if (Date.now() - t0 > 30000) throw new S.Xato('Tizim band — birozdan keyin qayta urinib ko\'ring.'); await new Promise(r => setTimeout(r, 150)); }
  try { return await ish(); } finally { if ((await redis.get(kalit)) === belgi) await redis.del(kalit); }
}
// 06d A ustunini Google'dan YANGI o'qib: keyingi ID va qator raqami (ko'zgu bir necha soniya orqada bo'lishi mumkin)
async function keyingiId() {
  const ids = await G.ustunOqi(env.aksBazaId, HUJ, 'A', env.googleKey);
  let max = 0; ids.forEach(v => { const n = Number(v); if (n > max) max = n; });
  return { id: max + 1, qator: ids.length + 1 };
}

async function hujjatYukla(args) {
  const [kodSes, d0] = args; const d = d0 || {};
  const u = await S.ruxsat(kodSes, 'hujjat');
  const no = t(d.no);
  if (/^BEKOR_/.test(t(d.turi))) throw new S.Xato('Bekor qilish buyrug\'i va xabarnomasi faqat pastdagi «✂ Shartnomani bekor qilish» panelidan yuklanadi.');
  const sh = (await H.hujjatBoshlang([kodSes])).royxat.find(x => x.no === no);
  if (!sh) throw new S.Xato('Shartnoma bazada topilmadi: ' + no + '. Ro\'yxatdan tanlang.');
  if ((d.turi === 'POCHTA' || d.turi === 'XAT_OLDIM') && !d.xatRaqam && !hujjatRaqam(d.izoh)) {
    const och = (await J.xatJurnal()).filter(h => h.no === no && h.holati === 'Tayyorlandi').map(h => h.raqam);
    if (och.length) throw new S.Xato('Bu shartnomada hali yuborilmagan ogohlantirish xati bor (' + och.join(', ') + '). Uning kvitansiyasi yoki mijoz imzolagan nusxasi '
      + '«✉ Xatlar» bo\'limida — o\'sha xat qatoridagi «✉ Yuborildi» tugmasi orqali yuklanadi. Shunda xat yuborilgan deb belgilanadi va keyingi bosqich ochiladi.');
  }
  // --- hujjatYukla_: tekshiruvlar
  const turi = t(d.turi);
  if (!H.HUJJAT_TURLARI.some(x => x[0] === turi)) throw new S.Xato('Hujjat turini tanlang.');
  const sana = String(d.sana || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(sana)) throw new S.Xato('Hujjat sanasini tanlang.');
  const bugun = V.bugun();
  if (sana > bugun) throw new S.Xato('Hujjat sanasi kelajakda bo\'lishi mumkin emas.');
  if (sana < '2015-01-01') throw new S.Xato('Hujjat sanasi juda eski — tekshiring.');
  const bayt = Buffer.from(String(d.b64 || ''), 'base64');
  if (bayt.length < 1000) throw new S.Xato('Fayl bo\'sh yoki buzilgan.');
  if (bayt.length > HUJJAT_MAX_MB * 1024 * 1024) throw new S.Xato('Fayl ' + HUJJAT_MAX_MB + ' MB dan katta.');
  if (bayt.subarray(0, 5).toString('latin1') !== '%PDF-') throw new S.Xato('Fayl PDF emas. Faqat PDF yoki skanerlash orqali yuklang.');
  return qulfBilan(async () => {
    const jurnal = await J.hujjatJurnal();
    const eski = jurnal.filter(h => h.no === no && h.turi === turi && h.holati === 'Faol');
    const dmy = sana.split('-').reverse().join('.');
    const raqam = hujjatRaqam(d.izoh);
    const ayni = eski.filter(h => h.sana === dmy && !(raqam && hujjatRaqam(h.izoh) && hujjatRaqam(h.izoh) !== raqam));
    if (ayni.length)
      throw new S.Xato('ДИҚҚАТ: шу турдаги ҳужжат шу санада (' + dmy + ') аллақачон юкланган — ' + ayni[0].nom
        + ' (' + ayni[0].kim + ', ' + ayni[0].vaqt + '). Бир хил ҳужжат икки марта юкланмайди. Агар юкланган нусха хато бўлса, '
        + 'аввал уни рўйхатдаги «✎ Tuzatish» орқали бекор қилинг.');
    if (HUJJAT_BIR_MARTA.indexOf(turi) >= 0 && eski.length)
      throw new S.Xato('ДИҚҚАТ: bu shartnomaning imzolangan nusxasi allaqachon yuklangan — ' + eski[0].nom
        + ' (' + eski[0].kim + ', ' + eski[0].vaqt + '). Bir xil hujjat ikki marta yuklanmaydi. Agar yuklangan nusxa xato bo\'lsa, '
        + 'avval uni ro\'yxatdagi «✎ Tuzatish» orqali sababi bilan bekor qiling, shundan keyin yangisini yuklang.');
    // fayl nomi — shu shartnoma papkasida takrorlanmasin (06d dagi nomlar + serverdagi fayllar)
    const noF = no.replace(/\//g, '-');
    const papka = path.join(ILDIZ, noF);
    fs.mkdirSync(papka, { recursive: true });
    const bor = new Set(jurnal.filter(h => h.no === no).map(h => h.nom));
    let nom = noF + '_' + turi + '_' + sana;
    { let k = 1; const bormi = n => bor.has(n + '.pdf') || fs.existsSync(path.join(papka, n + '.pdf')); while (bormi(nom + (k > 1 ? '_' + k : ''))) k++; if (k > 1) nom += '_' + k; }
    nom += '.pdf';
    const yol = path.join(papka, nom), rel = noF + '/' + nom;
    fs.writeFileSync(yol, bayt, { mode: 0o640 });
    // 06d ga yozuv (hujjatYukla_ bilan bir xil ustunlar)
    const { id, qator } = await keyingiId();
    const vaqt = hozir();
    const izoh = String(d.izoh || '').trim();
    await G.qatorQosh(env.aksBazaId, HUJ, [id, no, sh.tur === 'ijara' ? 'Ijara' : 'Sotuv', sh.fish, sh.dokon, turi, dmy, nom, 'SRV:' + rel, Math.round(bayt.length / 1024), Number(d.sahifa) || '', u.fish, vaqt, 'Faol', izoh], env.googleKey);
    await G.sanaYoz(env.aksBazaId, [{ varaq: HUJ, qator, ustun: 7, iso: sana }], env.googleKey).catch(() => {});
    await Promise.race([tetik.varaqlarYangila([HUJ]).catch(e => console.error('ko\'zgu (hujjat):', e.message)), new Promise(r => setTimeout(r, 15000))]);
    // fonda — Drive'ga (direktor hisobi, eski tizim orqali)
    driveGaKochir(u.kod, { id, no, fish: sh.fish, nom, rel, yol }).catch(e => console.error('Drive ko\'chirish:', e.message));
    const chiroyli = String(sh.fish || '').toLowerCase().split(/\s+/).filter(Boolean).slice(0, 2).map(x => x.charAt(0).toUpperCase() + x.slice(1)).join(' ');
    return { ok: true, no, fish: sh.fish, nom, papka: 'AKS TIZIM / 05 MIJOZ HUJJATLARI / ' + (noF + ' ' + chiroyli).trim(), kb: Math.round(bayt.length / 1024), url: '' };
  });
}

// Fayl Drive'ga ko'chgach bajariladigan ishlar (masalan, tekshiruvchiga Telegram xabari — eski tizim faylni Drive'dan oladi). rel — «<no>/<nom>»
const keyin = new Map(), kochdi = new Map();
function driveKeyin(rel, fn) {
  const ishla = () => Promise.resolve().then(fn).catch(e => console.error('Drive keyin (' + rel + '):', e.message));
  if (kochdi.has(rel)) return ishla();
  if (!keyin.has(rel)) keyin.set(rel, []);
  keyin.get(rel).push(ishla);
}
function kochdiBelgi(rel) {
  kochdi.set(rel, Date.now()); for (const [k, t] of kochdi) if (Date.now() - t > 30 * 60000) kochdi.delete(k);
  const L = keyin.get(rel); if (L) { keyin.delete(rel); L.forEach(f => f()); }
}
// Fon: faylni Drive'ga ko'chirish (Koprik v1.3 koprikDriveSaqla) → 06d I ustuniga Drive ID. Muvaffaqiyatsiz bo'lsa — 10 daqiqadan keyin yana (3 marta).
async function driveGaKochir(kod, f, urinish = 0) {
  if (!koprik.bor()) return;
  try {
    const b64 = fs.readFileSync(f.yol).toString('base64');
    const r = await koprik.chaqir('koprikDriveSaqla', kod, [{ no: f.no, fish: f.fish, nom: f.nom, b64 }]);
    if (!r || !r.id) throw new Error('Drive ID qaytmadi');
    const ids = await G.ustunOqi(env.aksBazaId, HUJ, 'A', env.googleKey);
    const i = ids.findIndex(v => String(v) === String(f.id));   // ids[0] — sarlavha (1-qator)
    if (i < 0) throw new Error('06d da ' + f.id + ' topilmadi');
    await G.yoz(env.aksBazaId, [{ varaq: HUJ, katak: 'I' + (i + 1), qiymat: [[r.id]] }], env.googleKey);
    const hol = await G.qatorOqi(env.aksBazaId, HUJ, i + 1, 'N', env.googleKey).catch(() => []);   // shu orada «✎ Tuzatish» bilan bekor qilingan bo'lsa
    if (String(hol[13] || '') === 'Bekor') koprik.chaqir('koprikHujjatBekorFayl', kod, [r.id, 'BEKOR_' + f.id + '_' + f.nom]).catch(e => console.error('hujjat bekor (Drive):', e.message));
    tetik.varaqlarYangila([HUJ]).catch(() => {});
    console.log(new Date().toISOString(), 'hujjat Drive ga ko\'chdi:', f.rel, '→', r.id);
    kochdiBelgi(f.rel);
  } catch (e) {
    console.error(new Date().toISOString(), 'Drive ko\'chirish (' + (urinish + 1) + '):', f.rel, e.message);
    if (urinish < 3) setTimeout(() => driveGaKochir(kod, f, urinish + 1).catch(() => {}), 10 * 60000).unref();
  }
}

// Har 15 daqiqada: hali Drive'ga ko'chmagan (SRV:) fayllar bo'lsa — qayta urinish (Koprik yangilanmagan / internet uzilgan bo'lsa)
let yolda = false;
async function qolganlarniKochir() {
  if (yolda || !koprik.bor()) return; yolda = true;
  try {
    const L = (await J.hujjatJurnal()).filter(h => /^SRV:/.test(String(h.faylId)));
    if (!L.length) return;
    const { q } = require('../lib/db');
    const x = (await q(`SELECT kirish_kodi FROM v_xodimlar WHERE holat='Ishlayapti' AND ('admin' = ANY(huquqlar) OR 'hujjat' = ANY(huquqlar)) ORDER BY qator_no LIMIT 1`)).rows[0];
    if (!x) return;
    const F = {}; (await V.qatorlar('06d_Hujjatlar')).forEach(({ r }) => { if (r[0]) F[String(r[0])] = r[3] || ''; });
    for (const h of L.slice(0, 5)) { const yol = srvYol(h.faylId); if (yol && fs.existsSync(yol)) await driveGaKochir(x.kirish_kodi, { id: h.id, no: h.no, fish: F[String(h.id)] || '', nom: h.nom, rel: String(h.faylId).slice(4), yol }, 3); }
  } catch (e) { console.error('qolgan skanlar:', e.message); } finally { yolda = false; }
}
function boshla() { const t = setInterval(() => qolganlarniKochir().catch(() => {}), 15 * 60000); t.unref(); setTimeout(() => qolganlarniKochir().catch(() => {}), 60000).unref(); }

// Serverdagi fayl (SRV:) — o'quvchilar uchun
// faylId «SRV:…» bo'lsa — o'sha; aks holda (Drive ID) aks-skan nusxalagan joy: /opt/aks/hujjat/<shartnoma>/<nom>
function srvFayl(faylId, no, nom) {
  let y = srvYol(faylId);
  if (!y && no && nom) y = path.join(ILDIZ, String(no).replace(/\//g, '-'), path.basename(String(nom)));
  if (!y) return null;
  try { const b = fs.readFileSync(y); return b.length ? { nom: path.basename(y), bytes: b } : null; } catch (e) { return null; }
}

// ------------------------------------------------------------------ ✎ TUZATISH (bekor qilish) — Hujjat.gs v25.9 hujjatTuzat bilan bir xil
// 06d N «Bekor», O izoh; xat isboti bo'lsa — 06e qatori «Tayyorlandi» ga (xatHujjatBekor_) va 06 undiruv jurnalida belgi (undXatBelgi_);
// bekor qilish buyrug'i / xabarnomasi bo'lsa — 06h holati orqaga (bekorHujjatBekor_). Drive'dagi fayl «_BEKOR QILINGANLAR» ga — eski tizim
// orqali (Koprik v1.6 koprikHujjatBekorFayl), xodim kutmaydi. Yoqilishi: «aks-yozuv-sinov hujjat» (Redis yozuv_yondi:hujjat) va Koprik ≥ 1.6.
const XAT = '06e_Xatlar', BEK = '06h_Bekor_sorovlari', UND = '06_Undiruv_jurnali';
const BEKOR_YOPIQ = ['Bekor qilindi', 'Rad etildi', 'Qaytarildi'];
const s_ = v => String(v == null ? '' : v);
function hozirHm() { return hozir().slice(0, 16); }
let kv16 = { ok: false, t: 0 };
async function koprik16(kod) {
  if (kv16.t && Date.now() - kv16.t < (kv16.ok ? 30 : 2) * 60000) return kv16.ok;
  try { kv16 = { ok: koprik.bor() && String(await koprik.chaqir('koprikVersiya', kod, [])) >= '1.6', t: Date.now() }; } catch (e) { kv16 = { ok: false, t: Date.now() }; }
  return kv16.ok;
}
async function tuzatServerda(kod) {
  try { if ((await redis.get('yozuv_yondi:hujjat')) !== '1') return false; } catch (e) { return false; }
  return koprik16(kod);
}
// Varaqni Google'dan YANGI o'qish (getDisplayValues yoki getValues), A ustunining oxirgi to'ldirilgan qatorigacha; har qator {qator, r}
async function yangiQatorlar(varaq, gacha, xom) {
  const X = await G.oraliqOqi(env.aksBazaId, varaq, 'A2:' + gacha, env.googleKey, xom ? 'UNFORMATTED_VALUE' : 'FORMATTED_VALUE');
  let m = -1; X.forEach((r, i) => { if (r[0] !== '' && r[0] != null) m = i; });
  return X.slice(0, m + 1).map((r, i) => ({ qator: i + 2, r }));
}
const harf_ = n => { let x = ''; while (n > 0) { const m = (n - 1) % 26; x = String.fromCharCode(65 + m) + x; n = Math.floor((n - 1) / 26); } return x; };
const kat = (varaq, qator, ustun, qiymatlar) => ({ varaq, katak: harf_(ustun) + qator + (qiymatlar.length > 1 ? ':' + harf_(ustun + qiymatlar.length - 1) + qator : ''), qiymat: [qiymatlar] });

// 06d qatori — Google'dan YANGI (hujjatJurnal_ ko'rinishi)
async function hujjatYangi(varaq, id) {
  return (await yangiQatorlar(varaq, 'O')).map(({ qator, r }) => ({ qator, id: s_(r[0]), no: s_(r[1]), turi: s_(r[5]), sana: s_(r[6]), nom: s_(r[7]), faylId: s_(r[8]),
    kim: s_(r[11]), vaqt: s_(r[12]), holati: s_(r[13]), izoh: s_(r[14]) })).filter(h => h.id).find(x => String(x.id) === String(id));
}
// Yozuv yadrosi (sinov ham shuni ishlatadi): 06d N, O — qaytaradi yozilgan kataklar ro'yxati
function tuzatKataklar(varaq, h, sabab, fish, vaqt) {
  return [kat(varaq, h.qator, 14, ['Bekor']), kat(varaq, h.qator, 15, [(h.izoh ? h.izoh + ' | ' : '') + 'Bekor: ' + sabab + ' (' + fish + ', ' + vaqt + ')'])];
}
// xatHujjatBekor_ + undXatBelgi_
async function xatKataklar(hj, sabab, fish, vaqt) {
  const Y = [], xabar = [];
  const L = (await yangiQatorlar(XAT, 'Y')).map(({ qator, r }) => ({ qator, raqam: s_(r[0]), no: s_(r[2]), holati: s_(r[13]), skan: s_(r[15]), isbot: s_(r[18]), izoh: s_(r[21]) })).filter(h => h.raqam);
  let U = null;
  for (const h of L) {
    if (!(h.no === hj.no && h.holati === 'Yuborildi')) continue;
    if (!hj.nom || (h.isbot !== hj.nom && h.skan !== hj.nom)) continue;
    Y.push(kat(XAT, h.qator, 14, ['Tayyorlandi']), kat(XAT, h.qator, 16, ['']), kat(XAT, h.qator, 17, ['', '', '']), kat(XAT, h.qator, 23, ['']),
      kat(XAT, h.qator, 22, [(h.izoh ? h.izoh + ' | ' : '') + 'Етказиш исботи бекор қилинди: ' + sabab + ' (' + fish + ', ' + vaqt + ')']));
    U = U || await yangiQatorlar(UND, 'R', true);
    for (let i = U.length - 1; i >= 0; i--) {
      const v = U[i].r;
      if (s_(v[8]) === h.raqam && s_(v[4]) === 'Ёзма огоҳлантириш') {
        Y.push(kat(UND, U[i].qator, 18, ['Исбот бекор қилинди']), kat(UND, U[i].qator, 12, [(v[11] ? v[11] + ' | ' : '') + 'Етказиш исботи бекор қилинди (' + vaqt + ')']));
        break;
      }
    }
    xabar.push(h.raqam + ' xati «Tayyorlandi» holatiga qaytdi — isbotini qayta yuklang («✉ Yuborildi»).');
  }
  return { Y, matn: xabar.join(' ') };
}
// bekorHujjatBekor_
async function bekKataklar(hj, sabab, fish, vaqt) {
  const Y = [], xabar = [];
  if (hj.turi !== 'BEKOR_BUYRUQ' && hj.turi !== 'BEKOR_XABARNOMA') return { Y, matn: '' };
  const L = (await yangiQatorlar(BEK, 'AE')).map(({ qator, r }) => ({ qator, id: s_(r[0]), no: s_(r[1]), holati: s_(r[6]), raqam: s_(r[7]), bSkan: s_(r[18]), xSkan: s_(r[22]), izoh: s_(r[29]) })).filter(z => z.id);
  for (const z of L) {
    if (z.no !== hj.no) continue;
    if (hj.turi === 'BEKOR_BUYRUQ' ? z.bSkan !== hj.nom : z.xSkan !== hj.nom) continue;
    if (BEKOR_YOPIQ.indexOf(z.holati) >= 0) { xabar.push(z.raqam + ' so\'rovi allaqachon «' + z.holati + '» — skan bekor qilingani bekor qilish holatini o\'zgartirmaydi, direktor bilan hal qiling.'); continue; }
    if (hj.turi === 'BEKOR_BUYRUQ') { Y.push(kat(BEK, z.qator, 19, [''])); z.bSkan = ''; }
    else { Y.push(kat(BEK, z.qator, 20, ['', '', '', ''])); z.xSkan = ''; }
    Y.push(kat(BEK, z.qator, 7, [z.bSkan || z.xSkan ? 'Hujjatlar kutilmoqda' : 'Hujjatlar tayyorlandi']),
      kat(BEK, z.qator, 30, [(z.izoh ? z.izoh + ' | ' : '') + (hj.turi === 'BEKOR_BUYRUQ' ? 'Buyruq' : 'Xabarnoma') + ' skani bekor qilindi: ' + sabab + ' (' + fish + ', ' + vaqt + ')']));
    xabar.push(z.raqam + ' so\'rovi holati orqaga qaytdi — skanni qayta yuklang.');
  }
  return { Y, matn: xabar.join(' ') };
}
function driveBekor(kod, faylId, nom) {   // eski tizimda: try { moveTo + setName } catch (e) {} — xato e'tiborsiz
  if (!faylId || /^SRV:/.test(faylId)) return;   // hali Drive'ga ko'chmagan — driveGaKochir ko'chgach o'zi «_BEKOR QILINGANLAR» ga qo'yadi
  koprik.chaqir('koprikHujjatBekorFayl', kod, [faylId, nom]).catch(e => console.error('hujjat bekor (Drive):', e.message));
}
async function hujjatTuzat(args) {
  const [kodSes, id, sabab0] = args;
  const u = await S.ruxsat(kodSes, 'hujjat');
  if (!(await tuzatServerda(u.kod))) { const r = await koprik.chaqir('hujjatTuzat', u.kod, [id, sabab0]); await tetik.yangilaKut(20000); return r; }
  const sabab = s_(sabab0).replace(/\s+/g, ' ').trim();
  if (sabab.length < 5) throw new S.Xato('Sababini yozing (kamida 5 belgi) — masalan: «xat sanasi noto\'g\'ri».');
  let yoq = false;
  const w = await qulfBilan(async () => {
    const h = await hujjatYangi(HUJ, id);
    if (!h) throw new S.Xato('Hujjat topilmadi (ID ' + id + ').');
    if (!(await H._ichki.royxatda(u, h.no))) throw new S.Xato('Hujjat topilmadi (ID ' + id + ').');   // shartnoma holati bo'yicha yashirin
    if (h.holati !== 'Faol') throw new S.Xato('Bu hujjat allaqachon «' + h.holati + '».');
    const bugun = V.bugun().split('-').reverse().join('.');
    if (!(u.admin || (h.kim === u.fish && String(h.vaqt).indexOf(bugun) === 0))) throw new S.Xato('Bu hujjatni tuzata olmaysiz: o\'zingiz yuklagan hujjatni faqat o\'sha kuni tuzatish mumkin. Keyin — faqat direktor.');
    const vaqt = hozirHm();
    const [x, b] = await Promise.all([xatKataklar(h, sabab, u.fish, vaqt), bekKataklar(h, sabab, u.fish, vaqt)]);
    try { await G.yoz(env.aksBazaId, tuzatKataklar(HUJ, h, sabab, u.fish, vaqt).concat(x.Y, b.Y), env.googleKey); }
    catch (e) { if (e instanceof G.RuxsatYoq) { yoq = true; return null; } throw e; }
    return { h, xat: [x.matn, b.matn].filter(Boolean).join(' '), varaqlar: [HUJ].concat(x.Y.length ? [XAT, UND] : [], b.Y.length ? [BEK] : []) };
  });
  if (yoq) { const r = await koprik.chaqir('hujjatTuzat', u.kod, [id, sabab0]); await tetik.yangilaKut(20000); return r; }   // hech narsa yozilmagan
  driveBekor(u.kod, w.h.faylId, 'BEKOR_' + w.h.id + '_' + w.h.nom);
  await Promise.race([tetik.varaqlarYangila(w.varaqlar).catch(e => console.error('ko\'zgu (tuzatish):', e.message)), new Promise(r => setTimeout(r, 15000))]);
  return { ok: true, id: w.h.id, nom: w.h.nom, no: w.h.no, turi: w.h.turi, xat: w.xat };
}

module.exports = { hujjatYukla, hujjatTuzat, srvFayl, srvYol, boshla };
module.exports._ichki = { hujjatYangi, tuzatKataklar, xatKataklar, bekKataklar, yangiQatorlar, koprik16, hozirHm, driveKeyin, kochdiBelgi };
