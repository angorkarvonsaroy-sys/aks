// AKS TIZIM — 📎 hujjat (skan) YUKLASH serverda (Hujjat.gs v25.9 hujjatYukla + hujjatYukla_ bilan bir xil tekshiruvlar va 06d yozuvi).
// Fayl avval SERVERDA saqlanadi (/opt/aks/hujjat/<shartnoma>/<nom>.pdf) — xodim 2–3 soniyada javob oladi.
// Keyin fonda eski tizim (Koprik.gs v1.3 koprikDriveSaqla → hujjatPapka_) faylni direktorning Drive'iga o'sha papkaga ko'chiradi:
// fayllar egasi avvalgidek direktor, Drive — asosiy arxiv. Ko'chguncha 06d «Fayl_ID» = «SRV:<yo'l>», ko'chgach Drive ID yoziladi.
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
    tetik.varaqlarYangila([HUJ]).catch(() => {});
    console.log(new Date().toISOString(), 'hujjat Drive ga ko\'chdi:', f.rel, '→', r.id);
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
function srvFayl(faylId) { const y = srvYol(faylId); if (!y) return null; try { return { nom: path.basename(y), bytes: fs.readFileSync(y) }; } catch (e) { return null; } }

module.exports = { hujjatYukla, srvFayl, srvYol, boshla };
