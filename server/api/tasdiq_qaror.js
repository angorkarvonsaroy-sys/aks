// AKS TIZIM — 🔎 ISBOT QARORI SERVERNING O'ZIDA (Telegram ko'chirish 3b-qadami, 23.10.2026). Eski kodning o'zi: Topshiriq.gs v2.2 tasdiqBajar_ →
//   topTasdiq_ (topshiriq isboti: ✅ «Bajarildi» / ✖ «Jarayonda» + hujjat «Bekor» (topHujjatRad_) yoki talabnoma isboti bekor (topTalabIsbotBekor_), xodimga Telegram),
//   Xat.gs v26.1 xatIsbotTasdiq_ (xat isboti: 06e X; ✖ — xat «Tayyorlandi»ga, xodim + undiruvchiga Telegram, ijro «isbotrad»),
//   skanNazQaror_ (🗂 ixtiyoriy skan: 06d P; ✖ — skan bekor, «qayta yuklang» topshirig'i), tqQaror_ + tqSnap_ (06t jurnali, rad — tiklash nusxasi,
//   yurist qaytarsa direktorga karta — tqDirXabar_), tgTasdiqYangila_ (Telegram xabari yangilanadi — tugmalar o'chadi), tqTogri_ («👍 To'g'ri qaytargan»).
// Avval qaror eski tizimda bajarilardi (api/tasdiq_navbat.js navbati — Koprik tasdiqQil); token almashtirilgach (4-qadam) eski kod Telegram'ga chiqa olmaydi,
// shuning uchun qaror butunlay serverda. Yozuvlar — Google'ga (robot), Telegram — lib/telegram.js, fayl Drive'ga ko'chirish — Koprik koprikHujjatBekorFayl (fonda).
// Yoqilishi: yozuv_yondi:tasdiq_qaror (aks-tasdiq-qaror yoq) + yozuv_yondi:tg + tg_kirish. ctx (lib/tg_tasdiq.js): haqiqiy / quruq (sinov — yozmaydi, yubormaydi).
// «↩ Isbotni tiklash» (tqTiklash_) — HALI eski tizimda (Drive'da faylni qaytarish — Koprik v1.18 bilan, 4-qadam tayyorgarligi).
'use strict';
const crypto = require('crypto');
const S = require('./sessiya');
const V = require('../lib/varaq');
const J = require('../lib/jurnallar');
const TS = require('../lib/tasdiq');
const TT = require('../lib/tg_tasdiq');
const TG = require('../lib/telegram');
const G = require('../lib/google');
const U = require('../lib/undiruv_yordam');
const env = require('../lib/env');
const koprik = require('./koprik');
const tetik = require('../lib/kozgu_tetik');
const { redis } = require('../lib/db');
const { xodimTeng } = require('../lib/xodim');

const s = v => String(v == null ? '' : v);
const esc = TT.esc;
const TOP_V = '10_Topshiriqlar', HUJ_V = '06d_Hujjatlar', XAT_V = '06e_Xatlar', TQ_V = '06t_Tasdiq_qarorlari', UND_V = '06_Undiruv_jurnali';
const TQ_S = ['ID', 'Vaqt', 'Kalit', 'Tur', 'Shartnoma', 'Yukladi', 'Tasdiqchi', 'Kim', 'Rol', 'Qaror', 'Sabab', 'Malumot', 'Tiklash', 'Direktor', 'TG_xabar'];
const TP = () => require('./topshiriq_yoz')._ichki;
const HY = () => require('./hujjat_yoz')._ichki;
const XI = () => require('./xat_isbot')._ichki;
const IJ = () => require('./ijro_yoz')._ichki;

async function yoqilgan() { try { return (await redis.get('yozuv_yondi:tasdiq_qaror')) === '1' && (await TG.serverda()); } catch (e) { return false; } }
const dmyHm = TT.hozirDmyHm;
const rol = u => (u.huquq || []).indexOf('admin') >= 0 ? 'Direktor' : (u.huquq || []).indexOf('yurist') >= 0 ? 'Yurist' : s(u.fish);
const rolK = u => (u.huquq || []).indexOf('admin') >= 0 ? 'direktor' : (u.huquq || []).indexOf('yurist') >= 0 ? 'yurist' : 'xodim';
const dmyIso = dmy => { const m = /^(\d{2})\.(\d{2})\.(\d{4}) (\d{2}):(\d{2})$/.exec(dmy); return m ? m[3] + '-' + m[2] + '-' + m[1] + ' ' + m[4] + ':' + m[5] : TS.topHozirIso(); };
const isoDmy = iso => s(iso).replace(/^(\d{4})-(\d{2})-(\d{2}) (.*)$/, '$3.$2.$1 $4');
const harf = n => G.harfU(n);
const kat = (varaq, qator, ustun, vals) => ({ varaq, katak: harf(ustun) + qator + (vals.length > 1 ? ':' + harf(ustun + vals.length - 1) + qator : ''), qiymat: [vals] });
const tqQisqa = v => { v = s(v); return v.length > 300 ? v.slice(0, 297) + '…' : v; };

// ---------------------------------------------------------------- Google'dan YANGI o'qish
async function hjYangi() {   // 06d A:Q (naz, tgx bilan)
  const X = await G.oraliqOqi(env.aksBazaId, HUJ_V, 'A2:Q', env.googleKey); let m = -1; X.forEach((r, i) => { if (s(r[0]) !== '') m = i; });
  return X.slice(0, m + 1).map((r, i) => ({ qator: i + 2, id: s(r[0]), no: s(r[1]), fish: s(r[3]), turi: s(r[5]), sana: s(r[6]), nom: s(r[7]), faylId: s(r[8]), sahifa: s(r[10]), kim: s(r[11]), vaqt: s(r[12]), holati: s(r[13]), izoh: s(r[14]), naz: s(r[15]), tgx: s(r[16]) })).filter(h => h.id);
}
async function tqYangi() {   // 06t
  const X = await G.oraliqOqi(env.aksBazaId, TQ_V, 'A2:O', env.googleKey); let m = -1; X.forEach((r, i) => { if (s(r[0]) !== '') m = i; });
  return { l: m + 2, L: X.slice(0, m + 1).map((r, i) => { let mm = {}; try { mm = JSON.parse(s(r[11]) || '{}'); } catch (e) { }
    return { qator: i + 2, id: s(r[0]), vaqt: s(r[1]), kalit: s(r[2]), tur: s(r[3]), no: s(r[4]), yukladi: s(r[5]), tasdiqchi: s(r[6]), kim: s(r[7]), rol: s(r[8]), qaror: s(r[9]), sabab: s(r[10]), m: mm, tiklash: s(r[12]), direktor: s(r[13]), tgx: s(r[14]) }; }).filter(q => q.id) };
}
async function yoz(ctx, tavsif, data) { return TT.yozuv(ctx, tavsif, () => G.yoz(env.aksBazaId, data, env.googleKey)); }
async function xomYoz(ctx, tavsif, kataklar) { return TT.yozuv(ctx, tavsif, () => G.xomYoz(env.aksBazaId, kataklar, env.googleKey)); }
async function xodimga(ctx, fish, matn) {   // yuTgXodim_
  try { const tg = await TG.xodimTg(fish); if (tg) await ctx.api('sendMessage', { chat_id: tg, text: matn, parse_mode: 'HTML', disable_web_page_preview: true }); else if (ctx.quruq) ctx.log.push({ yozuv: '(xodim ' + fish + ' — Telegram yo\'q, xabar ketmaydi)' }); }
  catch (e) { console.error('xodimga ' + fish + ':', e.message); }
}
// tgTasdiqYangila_: qaror chiqqach xabar(lar) yangilanadi, tugmalar o'chadi
async function tasdiqYangila(ctx, ref, natija, caption) {
  natija = s(natija); if (natija.length > 300) natija = natija.slice(0, 297) + '…';
  const nt = '<b>' + natija.replace(/&/g, '&amp;').replace(/</g, '&lt;') + '</b>';
  caption = s(caption); if (caption && caption.length + nt.length + 2 > 1000) caption = caption.slice(0, 1000 - nt.length - 3).replace(/<[^>]*$/, '') + '…';
  const matn = (caption ? caption + '\n\n' : '') + nt;
  for (const r of s(ref).split(/\s+/).filter(Boolean)) {
    const m = /^([dm]):([^:]+):(\d+)$/.exec(r); if (!m) continue;
    const p = { chat_id: m[2], message_id: Number(m[3]), parse_mode: 'HTML', reply_markup: { inline_keyboard: [] } };
    try { if (m[1] === 'd') { p.caption = matn.slice(0, 1024); await ctx.api('editMessageCaption', p, null, { urinishsiz: true }); } else { p.text = matn; await ctx.api('editMessageText', p, null, { urinishsiz: true }); } }
    catch (e) { console.error('tasdiqYangila ' + r + ':', e.message); }
  }
}

// ---------------------------------------------------------------- hujjat «Bekor» (topHujjatRad_): 06d N/O, xat «Tayyorlandi»ga, 06h orqaga, Drive — Koprik (fonda)
async function hujjatRad(ctx, kod, h, sabab, fish) {
  if (!h || h.holati !== 'Faol') return '';
  const vaqt = dmyHm(), H = HY();
  const [x, b] = await Promise.all([H.xatKataklar(h, 'tekshiruvda rad etildi: ' + sabab, fish, vaqt), H.bekKataklar(h, sabab, fish, vaqt)]);
  await yoz(ctx, HUJ_V + ' N/O' + h.qator + ' (' + h.nom + ') ← Bekor, «Tekshiruvda rad etildi: ' + sabab + '»' + (x.Y.length ? ' + 06e «Tayyorlandi» (' + x.matn.slice(0, 60) + ')' : '') + (b.Y.length ? ' + 06h orqaga' : ''),
    [kat(HUJ_V, h.qator, 14, ['Bekor']), kat(HUJ_V, h.qator, 15, [(h.izoh ? h.izoh + ' | ' : '') + 'Tekshiruvda rad etildi: ' + sabab + ' (' + fish + ', ' + vaqt + ')'])].concat(x.Y, b.Y));
  if (!ctx.quruq && h.faylId && !/^SRV:/.test(h.faylId)) koprik.chaqir('koprikHujjatBekorFayl', kod, [h.faylId, 'BEKOR_' + h.id + '_' + h.nom]).catch(e => console.error('hujjat bekor (Drive):', e.message));
  else if (ctx.quruq && h.faylId) ctx.log.push({ yozuv: 'Drive: fayl «_BEKOR QILINGANLAR» ga (Koprik koprikHujjatBekorFayl) — BEKOR_' + h.id + '_' + h.nom });
  h.holati = 'Bekor';
  return ['Yuklangan fayl (' + h.nom + ') bekor qilindi — to\'g\'risini qayta yuklang.', x.matn, b.matn].filter(Boolean).join(' ');
}
// topTalabIsbotBekor_: direktor rad etdi — talabnoma isboti bekor, xat «Tayyorlandi» ga qaytadi
async function talabIsbotBekor(ctx, x, sabab, fish, HJ, XJ) {
  const h = TS.topTalabHolat(x, XJ), out = [], vaqt = dmyHm();
  for (const z of [h.as, h.qm]) {
    if (!(z && z.holati === 'Yuborildi' && z.isbot)) continue;
    const hj = HJ.find(y => y.nom === z.isbot && y.holati === 'Faol'); if (!hj) continue;
    const xk = await HY().xatKataklar(hj, 'direktor rad etdi: ' + sabab, fish, vaqt);
    await yoz(ctx, HUJ_V + ' N/O' + hj.qator + ' (' + hj.nom + ') ← Bekor, «Direktor rad etdi: ' + sabab + '»' + (xk.Y.length ? ' + 06e «Tayyorlandi»' : ''),
      [kat(HUJ_V, hj.qator, 14, ['Bekor']), kat(HUJ_V, hj.qator, 15, [(hj.izoh ? hj.izoh + ' | ' : '') + 'Direktor rad etdi: ' + sabab])].concat(xk.Y));
    hj.holati = 'Bekor'; if (xk.matn) out.push(xk.matn);
  }
  return out.join(' ');
}

// ---------------------------------------------------------------- 📌 topshiriq isboti (topTasdiq_)
async function topQaror(ctx, u, x, R, HJ, XJ, ha, izoh, it) {
  const vaqt = dmyHm(), hj = /^HJ:/.test(s(x.isbot)) ? s(x.isbot) : '', tal = /^talab\|/.test(s(x.kalit));
  const L = hj ? R.filter(t => t.holati === 'Tekshiruvda' && s(t.isbot) === hj) : [x];   // bitta hujjat — bir nechta topshiriq
  if (ha) {
    await yoz(ctx, TOP_V + ' N:P ' + L.map(t => t.qator).join(',') + ' ← Bajarildi, ' + vaqt + ', «… (tasdiq: ' + u.fish + ')»',
      L.map(t => kat(TOP_V, t.qator, 14, ['Bajarildi', vaqt, (t.yopdi || '') + ' (tasdiq: ' + u.fish + ')'])));
    for (const t of L) if (String(t.id) !== String(x.id) && t.tgx) await tasdiqYangila(ctx, t.tgx, '✅ ' + rol(u) + ' tasdiqladi — ' + u.fish + ', ' + vaqt, '');
    await tasdiqYangila(ctx, x.tgx, '✅ ' + rol(u) + ' tasdiqladi — ' + u.fish + ', ' + vaqt, it ? it.caption : '');
    return { ok: true, natija: tal ? 'Tasdiqlandi — endi ⚖ Sud kartasida «Yuristga o\'tkazish» tugmasi ochiq.' : 'Tasdiqlandi.' };
  }
  let qo = '';
  if (tal) qo = await talabIsbotBekor(ctx, x, izoh, u.fish, HJ, XJ);
  if (hj) qo = await hujjatRad(ctx, u.kod, HJ.find(z => String(z.id) === hj.slice(3)), izoh, u.fish);
  const Y = [];
  for (const t of L) Y.push(kat(TOP_V, t.qator, 14, ['Jarayonda', '', '', '', '']), kat(TOP_V, t.qator, 21, ['', '']), kat(TOP_V, t.qator, 7, [(t.izoh ? t.izoh + ' | ' : '') + 'Qaytarildi: ' + izoh]));   // topYop_ Jarayonda + U:V tozalanadi
  await yoz(ctx, TOP_V + ' N:R/U:V/G ' + L.map(t => t.qator).join(',') + ' ← Jarayonda, «Qaytarildi: ' + izoh + '»', Y);
  for (const t of L) {
    await xodimga(ctx, t.kimga, '↩ <b>Topshiriq qaytarildi</b>: «' + t.sarlavha + '»' + (t.no ? ' · ' + t.no : '') + '\nSabab: «' + izoh + '» (' + u.fish + ')' + (qo ? '\n' + qo : '') + '\nAKS → 📌 Topshiriqlar');
    if (String(t.id) !== String(x.id) && t.tgx) await tasdiqYangila(ctx, t.tgx, '↩ ' + rol(u) + ' qaytardi — «' + izoh + '» (' + u.fish + ')', '');
  }
  await tasdiqYangila(ctx, x.tgx, '↩ ' + rol(u) + ' qaytardi — «' + izoh + '» (' + u.fish + ')', it ? it.caption : '');
  return { ok: true, natija: 'Xodimga qaytarildi (Telegram xabar ketdi).' };
}
// ---------------------------------------------------------------- ✉ xat isboti (xatIsbotTasdiq_)
async function xatQaror(ctx, u, h, HJ, ha, izoh, it) {
  const vaqt = dmyHm();
  if (ha) {
    await yoz(ctx, XAT_V + ' X' + h.qator + ' (' + h.raqam + ') ← Tasdiqlandi|' + vaqt + '|' + u.fish, [kat(XAT_V, h.qator, 24, ['Tasdiqlandi|' + vaqt + '|' + u.fish])]);
    await tasdiqYangila(ctx, h.tgx, '✅ ' + rol(u) + ' tasdiqladi — ' + u.fish + ', ' + vaqt, it.caption);
    return { ok: true, natija: 'Tasdiqlandi.' };
  }
  const hjId = (it.fayl[0] || {}).hj;
  if (hjId) await hujjatRad(ctx, u.kod, HJ.find(z => String(z.id) === String(hjId)), izoh, u.fish);   // isbot «Bekor» → xat «Tayyorlandi» (xatHujjatBekor_)
  else await yoz(ctx, XAT_V + ' N/Q:S/W' + h.qator + ' ← Tayyorlandi (isbotsiz)', [kat(XAT_V, h.qator, 14, ['Tayyorlandi']), kat(XAT_V, h.qator, 17, ['', '', '']), kat(XAT_V, h.qator, 23, [''])]);
  await yoz(ctx, XAT_V + ' X:Y' + h.qator + ' (' + h.raqam + ') ← Rad|' + vaqt + '|' + u.fish + '|' + izoh + ', havola tozalandi', [kat(XAT_V, h.qator, 24, ['Rad|' + vaqt + '|' + u.fish + '|' + izoh, ''])]);
  await tasdiqYangila(ctx, h.tgx, '↩ ' + rol(u) + ' qaytardi — «' + izoh + '» (' + u.fish + ')', it.caption);
  const sh = (await U.undShartnomalar()).find(z => z.no === h.no) || {};
  const m = '↩ <b>' + h.raqam + '</b> (' + h.no + ') — xat isbotini ' + rol(u).toLowerCase() + ' qaytardi.\nSabab: «' + izoh + '» (' + u.fish + ')\nXat qayta «yetkazilmagan» — to\'g\'ri isbotni yuklang: ✉ Xatlar → «✉ Yuborildi».\n⚠ Bu qaytarish ijro intizomida qoidabuzarlik sifatida yozildi.';
  await xodimga(ctx, it.kim, m); if (sh.undiruvchi && s(sh.undiruvchi).trim() !== s(it.kim).trim()) await xodimga(ctx, sh.undiruvchi, m);
  try {
    const XD = await IJ().qdXodimlar(); const x = XD.find(z => xodimTeng(z.fish, it.kim));
    if (x && (x.huquq || []).indexOf('admin') < 0) {
      const o = { xodim: x.fish, tur: 'isbotrad', kalit: 'isbotrad|' + h.raqam + '|' + (hjId || vaqt), no: h.no, fish: sh.fish || '', tafsilot: h.raqam + ' — isbotni ' + rol(u).toLowerCase() + ' qaytardi: «' + izoh + '» (' + u.fish + ')' };
      if (ctx.quruq) ctx.log.push({ yozuv: '06q ijro: ' + x.fish + ' — isbotrad ' + h.raqam + ' (ijroDarhol)' }); else await IJ().ijroDarhol(u.kod, o);
    }
  } catch (e) { console.error('xatQaror ijro:', e.message); }
  return { ok: true, natija: 'Qaytarildi — xat qayta «yetkazilmagan», xodimga xabar ketdi.' };
}
// ---------------------------------------------------------------- 🗂 ixtiyoriy skan (skanNazQaror_)
async function skanQaror(ctx, u, h, ha, izoh, it) {
  const vaqt = dmyHm();
  if (ha) {
    await xomYoz(ctx, HUJ_V + ' P' + h.qator + ' (' + h.no + ') ← Tasdiqlandi|' + vaqt + '|' + u.fish, [{ varaq: HUJ_V, qator: h.qator, ustun: 16, qiymat: 'Tasdiqlandi|' + vaqt + '|' + u.fish }]);
    await tasdiqYangila(ctx, h.tgx, '✅ ' + rol(u) + ' tasdiqladi (to\'g\'ri) — ' + u.fish + ', ' + vaqt, it.caption);
    return { ok: true, natija: 'Belgilandi: to\'g\'ri.' };
  }
  await hujjatRad(ctx, u.kod, h, izoh, u.fish);
  await xomYoz(ctx, HUJ_V + ' P/Q' + h.qator + ' ← Rad|' + vaqt + '|' + u.fish + '|' + izoh + ', havola tozalandi', [{ varaq: HUJ_V, qator: h.qator, ustun: 16, qiymat: 'Rad|' + vaqt + '|' + u.fish + '|' + izoh }, { varaq: HUJ_V, qator: h.qator, ustun: 17, qiymat: '' }]);
  await tasdiqYangila(ctx, h.tgx, '↩ ' + rol(u) + ' qaytardi — «' + izoh + '» (' + u.fish + ')', it.caption);
  // yuklagan xodimga — qayta yuklash topshirig'i (ochiq «skan|…» bo'lmasa) va Telegram
  const XD = await TP().topXodimlar(), k = TP().topKimga(XD, h.kim), R = await TP().topRowsYangi(TOP_V);
  const och = R.L.find(t => t.kalit === 'skan|' + h.no && (t.holati === 'Jarayonda' || t.holati === 'Tekshiruvda'));
  if (!och) {
    const mid = ((await U.undShartnomalar()).find(z => z.no === h.no) || {}).mid || '';
    const o = { manba: 'Tizim', qoida: 'skan', kalit: 'skan|' + h.no, sarlavha: 'Shartnoma skanini qayta yuklang — ' + (u.admin ? 'direktor' : 'yurist') + ' qaytardi',
      izoh: (h.fish || '') + ' · sabab: «' + izoh + '» (' + u.fish + ')', no: h.no, mid, kimga: k.fish, kimBerdi: u.fish, muddat: isoDmy(TS.topIshKun(TS.topHozirIso(), 1)), muhim: 'Shoshilinch' };
    if (ctx.quruq) ctx.log.push({ yozuv: TOP_V + ' yangi qator: «' + o.sarlavha + '» → ' + k.fish + ', muddat ' + o.muddat + ' (+ Telegram)' });
    else { const row = await TP().topYoz(TOP_V, o, R); TP().topTg(u.kod, [row], XD); }
  }
  await xodimga(ctx, k.fish, '↩ <b>' + h.no + '</b> — shartnoma skanini ' + rol(u).toLowerCase() + ' qaytardi (' + u.fish + ').\nSabab: «' + izoh + '»\nSkan bekor qilindi — to\'g\'risini qayta yuklang (📎 Hujjatlar). Muddat: 1 ish kuni.');
  return { ok: true, natija: 'Qaytarildi — skan bekor, ' + k.fish + ' ga qayta yuklash topshirig\'i berildi (1 ish kuni).' };
}

// ---------------------------------------------------------------- 06t: tiklash nusxasi (tqSnap_) va qaror yozuvi (tqQaror_), direktorga karta (tqDirXabar_)
async function driveMeta(fid) {
  try { const t = await G.token(env.googleKey, G.SCOPE_DRIVE);
    const r = await fetch('https://www.googleapis.com/drive/v3/files/' + encodeURIComponent(fid) + '?fields=name,parents&supportsAllDrives=true', { headers: { Authorization: 'Bearer ' + t }, signal: AbortSignal.timeout(15000) });
    const j = await r.json(); if (!r.ok) return { fnom: '', papka: '' }; return { fnom: s(j.name), papka: (j.parents || [])[0] || '' }; }
  catch (e) { return { fnom: '', papka: '' }; }
}
async function tqSnap(it, R, HJ, XJ) {
  const T = { ms: Date.now(), iso: TS.topHozirIso(), hj: [], xat: [], top: [] }, hjId = {};
  (it.fayl || []).forEach(f => { if (f.hj) hjId[String(f.hj)] = 1; });
  if (it.tur === 'top') { const x = R.find(z => String(z.id) === String(it.id));
    if (x) { const hk = /^HJ:/.test(s(x.isbot)) ? s(x.isbot) : '';
      (hk ? R.filter(t => t.holati === 'Tekshiruvda' && s(t.isbot) === hk) : [x]).forEach(t => T.top.push({ id: String(t.id), v: [t.holati, t.yopildi, t.yopdi, t.dalil, t.kechikdi], izoh: t.izoh, isbot: t.isbot }));
      if (hk) hjId[hk.slice(3)] = 1; } }
  for (const id of Object.keys(hjId)) { const h = HJ.find(z => String(z.id) === id); if (!h || h.holati !== 'Faol') continue;
    const d = h.faylId && !/^SRV:/.test(h.faylId) ? await driveMeta(h.faylId) : { fnom: '', papka: '' };
    T.hj.push({ id: String(h.id), no: h.no, turi: h.turi, nom: h.nom, izoh: h.izoh, fnom: d.fnom, papka: d.papka, top: it.tur === 'top' }); }
  const xs = XJ.filter(h => h.holati === 'Yuborildi' && ((it.tur === 'xat' && h.raqam === String(it.raqam)) || T.hj.some(z => z.no === h.no && z.nom && (h.isbot === z.nom || h.skan === z.nom))));
  if (xs.length) { let UJ = null; try { UJ = await HY().yangiQatorlar(UND_V, 'R', true); } catch (e) { UJ = []; }
    for (const h of xs) { let und = ''; for (let i = UJ.length - 1; i >= 0; i--) { const v = UJ[i].r; if (s(v[8]) === h.raqam && s(v[4]) === 'Ёзма огоҳлантириш') { und = s(v[17]); break; } }
      T.xat.push({ raqam: h.raqam, v: [h.holati, h.pdf, h.skan, h.usul, h.yetSana, h.isbot, h.kim, h.vaqt, h.izoh, h.pochta, h.tek], und }); } }
  return T;
}
async function tqDirXabar(ctx, q) {
  const A = await TT.adminChatlar(); if (!A.length) return '';
  const cap = TT.tqCaption(q), klav = TT.tqKlav(q), refs = [], m = q.m || {};
  for (const chat of A) {
    try {
      const bor = s(m.tgx).split(/\s+/).find(r => r.split(':')[1] === chat);   // 🗂 ixtiyoriy skan — direktorda shu isbot xabari bor
      if (bor) await tasdiqYangila(ctx, bor, '↩ Yurist qaytardi — «' + tqQisqa(q.sabab) + '» (' + q.kim + ')', '');
      const r = await TT.faylYubor(ctx, chat, bor ? [] : m.fayl, cap + (bor ? '\n(fayl — yuqoridagi xabarda)' : ''), klav, m.nomi); if (r.ref) refs.push(r.ref);
    } catch (e) { console.error('tqDirXabar ' + chat + ':', e.message); }
  }
  return refs.join(' ');
}
async function tqQaror(ctx, u, it, ha, izoh, snap) {
  const Q = await tqYangi(), id = (Q.L.length ? Math.max(...Q.L.map(q => Number(q.id) || 0)) : 0) + 1, qator = Q.l + 1, rl = rolK(u);   // Q.l — A ustunining oxirgi to'ldirilgan qatori (ustunA_oxiri_)
  const m = { k: it.k, tur: it.tur, id: it.id, raqam: it.raqam || '', no: it.no, nomi: it.nomi, sarlavha: it.sarlavha, mijoz: it.mijoz || '', kim: it.kim, dalil: it.dalil, vaqt: it.vaqt,
    tasdiqchi: it.tasdiqchi, rad: it.rad, fayl: it.fayl || [], ixtiyoriy: !!it.ixtiyoriy, kimga: it.kimga || '', tgx: it.tgx || '', caption: it.caption || '' };
  const sabab = ha ? '' : s(izoh).replace(/\s+/g, ' ').trim();
  const row = [String(id), TS.topHozirIso(), it.k, it.tur, it.no || '', it.kim || '', it.tasdiqchi || '', u.fish, rl, ha ? 'Tasdiqlandi' : 'Rad', sabab, JSON.stringify(m), snap ? JSON.stringify(snap) : '', '', ''];
  await xomYoz(ctx, TQ_V + ' qator ' + qator + ' ← ID ' + id + ' ' + it.k + ' ' + (ha ? 'Tasdiqlandi' : 'Rad «' + sabab + '»') + ' — ' + u.fish + ' (' + rl + ')' + (snap ? ', tiklash nusxasi' : ''),
    row.map((v, i) => ({ varaq: TQ_V, qator, ustun: i + 1, qiymat: v })));
  if (!ha && rl === 'yurist' && it.tasdiqchi === 'yurist') {
    const q = { qator, id: String(id), vaqt: row[1], kalit: it.k, tur: it.tur, no: it.no || '', yukladi: it.kim || '', tasdiqchi: it.tasdiqchi, kim: u.fish, rol: rl, qaror: 'Rad', sabab, m, tiklash: row[12], direktor: '', tgx: '' };
    const ref = await tqDirXabar(ctx, q);
    if (ref) await xomYoz(ctx, TQ_V + ' O' + qator + ' ← havola ' + ref, [{ varaq: TQ_V, qator, ustun: 15, qiymat: ref }]);
  }
  return id;
}

// ---------------------------------------------------------------- qulf (eski LockService o'rni)
async function qulfBilan(ish) {
  const kalit = 'qulf:tasdiq_qaror', belgi = crypto.randomBytes(8).toString('hex'), t0 = Date.now();
  while (!(await redis.set(kalit, belgi, 'PX', 60000, 'NX'))) { if (Date.now() - t0 > 30000) throw new S.Xato('Tizim band — birozdan keyin qayta urinib ko\'ring.'); await new Promise(r => setTimeout(r, 200)); }
  try { return await ish(); } finally { if ((await redis.get(kalit)) === belgi) await redis.del(kalit); }
}

// ================================================================== QAROR (tasdiqBajar_): u = { kod, fish, huquq }, k = 't<id>' | 'x<raqam>' | 'n<id>'
async function qaror(u, k0, ha, izoh0, ctx) {
  ctx = ctx || TT.haqiqiy(); const k = s(k0), izoh = s(izoh0).replace(/\s+/g, ' ').trim(), adm = (u.huquq || []).indexOf('admin') >= 0, yu = (u.huquq || []).indexOf('yurist') >= 0;
  u = Object.assign({ admin: adm, yurist: yu }, u);
  return qulfBilan(async () => {
    const t0 = k.charAt(0), id = k.slice(1);
    const [sh, HJ, XJ] = await Promise.all([TS.topShosh(), hjYangi(), XI().xatlarYangi()]);
    let it = null, snap = null, r, varaqlar = [];
    if (t0 === 't') {
      const R = (await TP().topRowsYangi(TOP_V)).L, x = R.find(t => String(t.id) === String(id)); if (!x) throw new S.Xato('Topshiriq topilmadi.');
      const kim = TS.topTasdiqchi(x);
      if (!adm && !(kim === 'yurist' && yu)) throw new S.Xato('Bu isbotni ' + (kim === 'yurist' ? 'yurist' : 'direktor') + ' tekshiradi.');
      if (x.holati !== 'Tekshiruvda') throw new S.Xato('Topshiriq tekshiruvda emas (holati: ' + x.holati + ').');
      if (/^qayta\|/.test(x.kalit)) throw new S.Xato('Qayta tuzish topshirig\'i «🔁 Ochish» oynasida tasdiqlanadi yoki qaytariladi.');
      if (/^devon\|/.test(x.kalit)) throw new S.Xato('Kirim xat ijrosi 👔 Direktor → Tasdiqlar dagi xat kartochkasida qabul qilinadi yoki qaytariladi.');
      if (/^malumot\|/.test(x.kalit)) throw new S.Xato('Ma\'lumot topshirig\'i isbot bilan tasdiqlanmaydi.');
      if (!ha && izoh.length < 3) throw new S.Xato('Qaytarish sababini yozing.');
      it = TS.tasdiqTopItem(x, sh, HJ, XJ);
      if (!ha) snap = await tqSnap(it, R, HJ, XJ);
      r = await topQaror(ctx, u, x, R, HJ, XJ, ha, izoh, it); varaqlar = [TOP_V, HUJ_V, XAT_V];
    } else if (t0 === 'x') {
      if (!adm && !yu) throw new S.Xato('Xat isbotini yurist tekshiradi.');
      const h = XJ.find(z => z.raqam === String(id)); if (!h) throw new S.Xato('Xat topilmadi: ' + id);
      it = TS.xatTasdiqItem(h, sh, HJ); if (!it) throw new S.Xato('Bu xat isboti tekshiruvda emas (holati: ' + h.holati + ').');
      if (!ha && izoh.length < 3) throw new S.Xato('Qaytarish sababini yozing.');
      if (!ha) snap = await tqSnap(it, [], HJ, XJ);
      r = await xatQaror(ctx, u, h, HJ, ha, izoh, it); varaqlar = [XAT_V, HUJ_V, UND_V];
    } else if (t0 === 'n') {
      if (!adm && !yu) throw new S.Xato('Skanni yurist yoki direktor ko\'radi.');
      const h = HJ.find(z => String(z.id) === String(id) && z.turi === 'SHARTNOMA'); it = h ? TS.skanNazItem(h) : null;
      if (!it) throw new S.Xato('Bu skan allaqachon ko\'rib chiqilgan yoki bekor qilingan.');
      if (!ha && izoh.length < 3) throw new S.Xato('Qaytarish sababini yozing.');
      if (!ha) snap = await tqSnap(it, [], HJ, XJ);
      r = await skanQaror(ctx, u, h, ha, izoh, it); varaqlar = [HUJ_V, TOP_V, XAT_V];
    } else throw new S.Xato('Noma\'lum isbot: ' + k);
    try { await tqQaror(ctx, u, it, ha, izoh, snap); } catch (e) { console.error('tqQaror:', e.message); if (ctx.quruq) ctx.log.push({ yozuv: '⚠ 06t yozilmadi: ' + e.message }); }
    if (!ctx.quruq) {
      require('./kesh').yozuvdanKeyin(u.kod).catch(() => {});
      await Promise.race([tetik.varaqlarYangila(varaqlar.concat([TQ_V])).catch(e => console.error('ko\'zgu (tasdiq):', e.message)), new Promise(z => setTimeout(z, 15000))]);
    }
    return r;
  });
}
// «👍 To'g'ri qaytargan» (tqTogri_). q — 06t qatori (lib/jurnallar tqRows ko'rinishi)
async function tqTogri(u, q, ctx) {
  ctx = ctx || TT.haqiqiy();
  if (q.qaror !== 'Rad') throw new S.Xato('Bu qaror rad emas.'); if (q.direktor) throw new S.Xato('Bu rad allaqachon ko\'rib chiqilgan.');
  const vaqt = dmyHm();
  const Q = await tqYangi(), qq = Q.L.find(z => z.id === String(q.id)); if (!qq) throw new S.Xato('Qaror topilmadi.'); if (qq.direktor) throw new S.Xato('Bu rad allaqachon ko\'rib chiqilgan.');
  await xomYoz(ctx, TQ_V + ' N' + qq.qator + ' (ID ' + q.id + ') ← Rad to\'g\'ri|' + vaqt + '|' + u.fish, [{ varaq: TQ_V, qator: qq.qator, ustun: 14, qiymat: 'Rad to\'g\'ri|' + vaqt + '|' + u.fish }]);
  await tasdiqYangila(ctx, qq.tgx || q.tgx, '👍 Direktor: to\'g\'ri qaytarilgan — ' + u.fish + ', ' + vaqt, TT.tqCaption(qq));
  if (!ctx.quruq) tetik.varaqlarYangila([TQ_V]).catch(() => {});
  return { ok: true, natija: '👍 Belgilandi: to\'g\'ri qaytarilgan.' };
}

// ---------------------------------------------------------------- ilova amallari (api/amallar.js): tqAmal — «togri» serverda, «tikla» hali eski tizim
async function tqAmal([kodSes, id, amal]) {
  const u = await S.ruxsat(kodSes, 'admin');
  if (amal === 'togri' && await yoqilgan()) { const q = (await J.tqRows()).find(z => s(z.id) === s(id)); if (!q) throw new S.Xato('Qaror topilmadi.'); return tqTogri(u, q); }
  const r = await koprik.chaqir('tqAmal', u.kod, [id, amal]); await tetik.yangilaKut(20000); return r;
}

module.exports = { tqAmal };
module.exports._ichki = { yoqilgan, qaror, tqTogri, tasdiqYangila, hujjatRad, tqSnap, tqQaror, hjYangi, tqYangi };
