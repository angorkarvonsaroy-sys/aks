// AKS TIZIM — tekshiruvdagi isbotlar navbati (Topshiriq.gs v2.2: tasdiqNavbat_, skanNazNavbat_, tqKorilmagan_, topShosh_, topIshKun_,
// tasdiqTopItem_, tasdiqCaption_; Xat.gs v26.0: xatTasdiqNavbat_/xatTasdiqItem_). Faqat o'qish; natija eski tizim bilan bir xil.
'use strict';
const V = require('./varaq');
const J = require('./jurnallar');
const U = require('./undiruv_yordam');
const X = require('./xat_yordam');

const TOP_TASDIQ_KUN = 2, TOP_TASDIQ_SHOSH = 1, SKAN_NAZ_KUN = 14, TQ_KUN = 7;
const TOP_HJ_NOM = { SHARTNOMA: 'Imzolangan shartnoma skani', PASPORT: 'Pasport nusxasi', NOTARIAL: 'Notarial hujjat', QOSHIMCHA_KELISHUV: 'Qo\'shimcha kelishuv / dalolatnoma', YOZISHMA: 'SMS / Telegram skrinshoti', JSHSHIR: 'JSHSHIR (14 raqam)' };

function topHozirIso() { const d = new Date(Date.now() + 5 * 3600 * 1000); return d.toISOString().slice(0, 10) + ' ' + d.toISOString().slice(11, 16); }
function topIso(dmyhm) { const m = /^(\d{2})\.(\d{2})\.(\d{4})(?:\s+(\d{2}):(\d{2}))?/.exec(String(dmyhm || '')); return m ? m[3] + '-' + m[2] + '-' + m[1] + ' ' + (m[4] || '23') + ':' + (m[5] || '59') : ''; }
function topIshKun(isoDT, n) {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?: (\d{2}):(\d{2}))?/.exec(String(isoDT || '')); if (!m) return '';
  let d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], 12)), k = 0;
  while (k < n) { d = new Date(d.getTime() + 86400000); if (d.getUTCDay() !== 0) k++; }
  const p = x => ('0' + x).slice(-2);
  return d.getUTCFullYear() + '-' + p(d.getUTCMonth() + 1) + '-' + p(d.getUTCDate()) + ' ' + (m[4] || '18') + ':' + (m[5] || '00');
}
const topTasdiqchi = t => /^(hj|skanq|skanu|skanz|yutop)\|/.test(String(t.kalit || '')) ? 'yurist' : 'direktor';
function topHjTur(t) {
  const p = String(t.kalit || '').split('|');
  if (p[0] === 'hj' || p[0] === 'yutop') return p[2] || '';
  if (p[0] === 'skanq' || p[0] === 'skanu' || p[0] === 'skanz') return 'SHARTNOMA';
  return '';
}
function topTalabHolat(t, XJ) {
  const p = String(t.kalit).split('|'), no = p[1], qm = p[2] === 'qm', belgi = new RegExp('top№' + t.id + '(\\D|$)');
  const L = (XJ || []).filter(h => h.no === no && Number(h.bosqich) === 3 && h.holati !== 'Bekor' && belgi.test(String(h.izoh || '')));
  const ol = sr => { const h = L.filter(z => X.xatSeriya(z.shablon) === sr).pop(); return h ? { raqam: h.raqam, holati: h.holati, sana: h.sana, muddat: h.muddat, isbot: h.isbot || '', usul: h.usul || '', pochta: h.pochta || '', yet: h.yetSana || '' } : null; };
  const as = ol('AS'), q = qm ? ol('QM') : null;
  return { no, qmKerak: qm, as, qm: q, tayyor: !!(as && as.holati === 'Yuborildi' && (!qm || (q && q.holati === 'Yuborildi'))) };
}
// da'vo muddati tugashiga 90 kundan kam (yoki o'tgan) shartnomalar
async function topShosh() {
  const o = {};
  try { (await U.undShartnomalar()).forEach(x => { if ((Number(x.muddati) || 0) > 0 && (Number(x.davoKun != null ? x.davoKun : x.kechikkan) || 0) >= 1095 - 90) o[x.no] = 1; }); } catch (e) { }
  return o;
}
function tasdiqCaption(it) {
  const e = s => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const d = iso => iso ? iso.slice(8, 10) + '.' + iso.slice(5, 7) + ' ' + iso.slice(11, 16) : '';
  if (it.ixtiyoriy) return '🗂 <b>Yangi shartnoma skani</b>' + (it.no ? ' · <b>' + e(it.no) + '</b>' : '') + (it.mijoz ? ' ' + e(it.mijoz) : '') + '\n'
    + 'Yukladi: ' + e(it.kim || '—') + (it.vaqt ? ', ' + d(it.vaqt) : '') + '\nFayl: ' + e(it.sarlavha || '') + '\nIxtiyoriy nazorat — ko\'rib chiqing; xato bo\'lsa «✖ Rad etish».';
  return '🔎 <b>Tekshiring</b>' + (it.no ? ' · <b>' + e(it.no) + '</b>' : '') + (it.mijoz ? ' ' + e(it.mijoz) : '') + '\n'
    + e(it.nomi) + (it.tur === 'xat' ? '' : '\n«' + e(String(it.sarlavha || '').slice(0, 160)) + '»') + '\n'
    + 'Topshirdi: ' + e(it.kim || '—') + (it.vaqt ? ', ' + d(it.vaqt) : '') + '\n'
    + (it.dalil ? 'Dalil: ' + e(String(it.dalil).slice(0, 300)) + '\n' : '')
    + (it.fayl && it.fayl.length ? '' : '📎 Fayl yo\'q — faqat yozma dalil.\n')
    + (it.tur === 'xat' ? '⚠ Qaytarilsa — xat «yetkazilmagan» bo\'ladi, xodimga minus yoziladi.\n' : '')
    + (it.muddat ? '⏳ Tekshirish muddati: ' + d(it.muddat) + (it.shosh ? ' (shoshilinch)' : '') : '');
}
function tasdiqTopItem(t, sh, HJ, XJ) {
  const tur = topHjTur(t), p0 = String(t.kalit || '').split('|')[0], fayl = [];
  if (/^HJ:/.test(String(t.isbot || ''))) fayl.push({ hj: String(t.isbot).slice(3) });
  else if (/^F:/.test(String(t.isbot || ''))) fayl.push({ f: String(t.isbot).slice(2) });
  else if (p0 === 'talab') { const h = topTalabHolat(t, XJ);
    [h.as, h.qm].filter(z => z && z.isbot).forEach(z => { const hj = HJ.find(y => y.nom === z.isbot && y.holati === 'Faol'); if (hj) fayl.push({ hj: String(hj.id) }); }); }
  const vaqt = topIso(t.yopildi), shosh = !!sh[t.no];
  const muddat = vaqt ? topIshKun(vaqt, shosh ? TOP_TASDIQ_SHOSH : TOP_TASDIQ_KUN) : '';
  const nomi = tur && TOP_HJ_NOM[tur] ? '📎 ' + TOP_HJ_NOM[tur] : p0 === 'talab' ? '📨 Talabnoma isboti' : p0 === 'olib' ? '📌 Mijozni olib keldi' : '📌 Topshiriq bajarildi';
  const it = { k: 't' + t.id, tur: 'top', id: String(t.id), no: t.no || '', sarlavha: t.sarlavha, nomi, kim: String(t.yopdi || '').replace(/ \(tasdiq:.*$/, ''), dalil: t.dalil, vaqt, muddat,
    kech: !!(muddat && muddat < topHozirIso()), shosh, tasdiqchi: topTasdiqchi(t), fayl, rad: p0 === 'talab' ? 'xat' : tur ? 'hujjat' : 'oddiy', tgx: t.tgx || '', kimga: t.kimga };
  it.caption = tasdiqCaption(it); return it;
}
const xatTekKutadi = h => /^Kutilmoqda\|/.test(String(h && h.tek || ''));
function xatTasdiqItem(h, sh, HJ) {
  if (!h || h.holati !== 'Yuborildi' || !xatTekKutadi(h)) return null;
  const p = String(h.tek).split('|'); const vaqt = p[1] || '', kim = p[2] || h.kim;
  const hj = HJ.find(y => y.nom === h.isbot && y.holati === 'Faol');
  const shosh = !!sh[h.no];
  const muddat = vaqt ? topIshKun(vaqt, shosh ? TOP_TASDIQ_SHOSH : TOP_TASDIQ_KUN) : '';
  const bos = (X.xatSeriya(h.shablon) === 'QM' ? X.XAT_BOSQICH_QM : X.XAT_BOSQICH)[h.bosqich] || (h.bosqich + '-xat');
  const it = { k: 'x' + h.raqam, tur: 'xat', id: h.raqam, raqam: h.raqam, no: h.no, sarlavha: h.raqam + ' — ' + bos, nomi: '✉ Xat isboti: ' + h.raqam + ' (' + bos + ')', kim,
    dalil: (h.usul || '') + (h.pochta ? ' № ' + h.pochta : '') + (h.yetSana ? ', ' + h.yetSana : ''), vaqt, muddat, kech: !!(muddat && muddat < topHozirIso()), shosh,
    tasdiqchi: 'yurist', fayl: hj ? [{ hj: String(hj.id) }] : [], rad: 'xat', tgx: h.tgx || '' };
  it.caption = tasdiqCaption(it); return it;
}
// tekshiruvdagi barcha isbotlar (topshiriqlar + xat isbotlari)
async function tasdiqNavbat() {
  const [sh, HJ, XJ, T] = await Promise.all([topShosh(), J.hujjatJurnal(), J.xatJurnal(), J.topRows()]);
  const L = T.filter(t => t.holati === 'Tekshiruvda' && !/^(qayta|devon|malumot)\|/.test(String(t.kalit || ''))).map(t => tasdiqTopItem(t, sh, HJ, XJ));
  XJ.filter(xatTekKutadi).map(h => xatTasdiqItem(h, sh, HJ)).filter(Boolean).forEach(x => L.push(x));
  return L;
}
function skanNazItem(h) {
  if (!h || h.holati !== 'Faol' || !/^Kutilmoqda\|/.test(String(h.naz || ''))) return null;
  const it = { k: 'n' + h.id, tur: 'skan', id: String(h.id), no: h.no, mijoz: String(h.fish || '').split(/\s+/).slice(0, 2).join(' '), sarlavha: h.nom, nomi: '🗂 Yangi shartnoma skani',
    kim: h.kim, dalil: '', vaqt: String(h.naz).split('|')[1] || '', muddat: '', kech: false, shosh: false, tasdiqchi: 'yurist', fayl: [{ hj: String(h.id) }], rad: 'hujjat', tgx: h.tgx || '', ixtiyoriy: true };
  it.caption = tasdiqCaption(it); return it;
}
// oxirgi SKAN_NAZ_KUN kunda yuklangan, hali ko'rilmagan skanlar (06d: fish — D ustuni)
async function skanNazNavbat() {
  const chegara = U.kunQosh(V.bugun(), -SKAN_NAZ_KUN);
  return (await V.qatorlar('06d_Hujjatlar')).map(({ r }) => ({ id: r[0] || '', no: r[1] || '', fish: r[3] || '', turi: r[5] || '', nom: r[7] || '', faylId: r[8] || '', kim: r[11] || '', vaqt: r[12] || '', holati: r[13] || '', naz: r[15] || '', tgx: r[16] || '' }))
    .filter(h => h.id && h.turi === 'SHARTNOMA' && h.naz).map(skanNazItem).filter(it => it && String(it.vaqt).slice(0, 10) >= chegara).reverse();
}
// yurist qaytargan, direktor hali ko'rmagan (oxirgi TQ_KUN kun)
async function tqKorilmagan(L) {
  const ch = U.kunQosh(V.bugun(), -TQ_KUN);
  return (L || await J.tqRows()).filter(q => q.rol === 'yurist' && q.qaror === 'Rad' && !q.direktor && String(q.vaqt).slice(0, 10) >= ch);
}

module.exports = { tasdiqTopItem, xatTasdiqItem, skanNazItem, xatTekKutadi, tasdiqNavbat, skanNazNavbat, tqKorilmagan, topShosh, topIshKun, topIso, topHozirIso, topTasdiqchi, topHjTur, topTalabHolat, TOP_HJ_NOM };
