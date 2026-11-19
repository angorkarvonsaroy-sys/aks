// AKS TIZIM — 🤝 IJARANI KELISHUV BILAN BEKOR QILISH: SKAN VA TUGMALAR BOTDA (direktor qarori 17.11.2026).
// Xodim ikki tomon imzolagan skanni yuklaganda direktorga Telegram'ga SKAN FAYLINING O'ZI «✅ Tasdiqlayman» / «✖ Rad etish»
// tugmalari bilan keladi: direktor ilovaga kirmasdan imzolarni ko'rib, botning o'zidan qaror qiladi. Qaror — ilovadagi amalning
// AYNAN o'zi (api/kb_yoz.js kbTasdiq, direktor nomidan qisqa sessiya): tekshiruvlar, 04/06j/06d yozuvlari va xodimga xabar o'zgarmaydi.
// Fayl o'qilmasa yoki Telegram serverda bo'lmasa — eski yo'l: matnli xabar (koprikTgYubor), qaror ilovada.
// Qaror ilovada chiqsa ham xabar yangilanadi va tugmalar o'chadi (natija — kbTasdiq chaqiradi).
// Tugma kodlari: kb|A|<id> (tasdiq), kb|R|<id> (sabablar), kb|S|<id>|<n> (tayyor sabab), kb|W|<id> (yozaman), kb|B|<id> (orqaga).
'use strict';
const { redis } = require('./db');
const TG = require('./telegram');
const TT = require('./tg_tasdiq');
const KBH = require('./kb_hujjat');

const s = v => String(v == null ? '' : v);
const SABAB = ['Imzo yo\'q yoki mos emas', 'Skan to\'liq emas — varaq yetishmaydi', 'O\'qib bo\'lmaydi — xira', 'Hujjatda xato bor'];
// 19.11.2026: «Ijarachi kelmadi» (bir tomonlama, skansiz) so'rovi uchun rad sabablari boshqa
const SABAB_K = ['Ijarachi bilan yana gaplashing', 'Muddat hali yetarli emas', 'Avval ogohlantirish xati yuboring', 'Sabab asosli emas'];
const sabablar = sr => (sr && sr.turi === 'Kelmadi') ? SABAB_K : SABAB;
const klav = id => ({ inline_keyboard: [[{ text: '✅ Tasdiqlayman', callback_data: 'kb|A|' + id }, { text: '✖ Rad etish', callback_data: 'kb|R|' + id }]] });
const klavSabab = (id, sr) => ({ inline_keyboard: sabablar(sr).map((z, i) => [{ text: '✖ ' + z, callback_data: 'kb|S|' + id + '|' + i }])
  .concat([[{ text: '✍ Boshqa — yozaman', callback_data: 'kb|W|' + id }], [{ text: '↩ Orqaga', callback_data: 'kb|B|' + id }]]) });

// xabar matni (skan fayl ostidagi izoh)
function matn(sr) {
  const e = TT.esc;
  if (sr.turi === 'Kelmadi') {   // 19.11.2026: hujjat va skan yo'q — direktor sababni o'qib qaror qiladi
    return '🚫 <b>Ijarachi kelmadi — bir tomonlama bekor qilish so\'rovi</b> — <b>' + e(sr.no) + '</b> (' + e(sr.fish) + ', ' + e(sr.dokon) + ')\n'
      + '<b>' + e(sr.kun || '?') + ' kundan beri</b> do\'kon ochilmagan · aloqa: ' + e(s(sr.aloqa).slice(0, 200)) + '\n'
      + 'Sabab: «' + e(s(sr.sabab).slice(0, 300)) + '»\n'
      + 'Bekor sanasi: ' + e(sr.sana) + ' · so\'radi: ' + e(sr.kim) + (sr.pdf ? ' · avval kelishuv hujjati tayyorlangan edi, ijarachi imzolamadi' : '')
      + ((sr.ogoh || []).length ? '\n⚠ ' + (sr.ogoh || []).map(e).join(' ') : '') + '\n'
      + '✅ bossangiz — shartnoma bekor bo\'ladi, do\'kon bo\'shaydi, xodimga xabar ketadi. Kelishuv va skan talab qilinmaydi.';
  }
  const qarz = s(sr.qarz) && s(sr.qarz) !== 'Йўқ' ? 'elektr qarzi ' + e(sr.qarz) + ' so\'m' : 'elektr qarzi yo\'q';
  return '🤝 <b>Ijara kelishuv bilan bekor qilinmoqda</b> — <b>' + e(sr.no) + '</b> (' + e(sr.fish) + ', ' + e(sr.dokon) + ')\n'
    + '«' + e(s(sr.sabab).slice(0, 300)) + '»\n'
    + 'Bekor sanasi: ' + e(sr.sana) + ' · kalit: ' + e(sr.kalit) + ' · hisoblagich: ' + e(sr.hisob) + ' · do\'kon: ' + e(sr.holat) + ' · ' + qarz + '\n'
    + 'Skanni yukladi: ' + e(sr.skanKim || sr.kim) + (sr.skanVaqt ? ', ' + e(sr.skanVaqt) : '') + '\n'
    + 'Ikkala imzoni tekshiring. ✅ bossangiz — shartnoma bekor bo\'ladi, do\'kon bo\'shaydi, xodimga xabar ketadi.';
}
// skan + tugmalar → direktor(lar) chatiga. Qaytaradi havola («d:chat:xabar …») yoki ''
async function yubor(kod, sr, eskiMatn) {
  const C = await TT.adminChatlar();
  if (!C.length || !(await TG.serverda('koprikTopTasdiqTg'))) {   // tugma uchun tg + tg_kirish kerak; bo'lmasa — eski matnli yo'l
    try { await require('../api/koprik').chaqir('koprikTgYubor', kod, [s(eskiMatn)]); } catch (e) { console.error('kb tg (eski yo\'l):', e.message); }
    return '';
  }
  const cap = matn(sr), ctx = TT.haqiqiy(), R = [];
  for (const chat of C) {
    try { const r = await TT.faylYubor(ctx, chat, sr.skan ? [{ f: sr.skan }] : [], cap, klav(sr.id), sr.turi === 'Kelmadi' ? 'Ijarachi kelmadi' : 'Imzolangan kelishuv'); if (r.ref) R.push(r.ref); }
    catch (e) { console.error('kb tg ' + chat + ':', e.message); }
  }
  if (!R.length) { try { await require('../api/koprik').chaqir('koprikTgYubor', kod, [s(eskiMatn)]); } catch (e) { } return ''; }
  const ref = R.join(' ');
  try { await redis.set('kb_matn:' + sr.id, cap, 'EX', 30 * 86400); await redis.set('kb_tgx:' + sr.id, ref, 'EX', 30 * 86400); } catch (e) { }
  return ref;
}
const yuborFon = (kod, sr, eskiMatn) => { yubor(kod, sr, eskiMatn).catch(e => console.error('kb tg yubor:', e.message)); };

// qaror chiqqach (ilovadan yoki botdan): xabar yangilanadi, tugmalar o'chadi
async function natija(id, natijaMatn) {
  let ref = '', cap = '';
  try { ref = (await redis.get('kb_tgx:' + id)) || ''; cap = (await redis.get('kb_matn:' + id)) || ''; } catch (e) { }
  if (!ref) return;
  cap = cap.replace(/\n(Ikkala imzoni tekshiring\.|✅ bossangiz — )[^\n]*$/, '');
  try { await require('../api/tasdiq_qaror')._ichki.tasdiqYangila(TT.haqiqiy(), ref, natijaMatn, cap); } catch (e) { console.error('kb natija tg:', e.message); }
  try { await redis.del('kb_tgx:' + id); } catch (e) { }
}
const natijaFon = (id, m) => { natija(id, m).catch(() => {}); };

// qaror — ilovadagi amalning o'zi (direktor nomidan qisqa sessiya)
async function bajar(u, id, ha, izoh) {
  const S = require('../api/sessiya'), tok = await S.sessiyaOch(u.kod);
  try { return await require('../api/kb_yoz').kbTasdiq([u.kod + '|' + tok, id, !!ha, izoh || '']); }
  finally { try { await redis.del('ses:' + tok); } catch (e) { } }
}
async function sorov(id) { try { return (await KBH.kbRowsKozgu()).find(z => s(z.id) === s(id)) || null; } catch (e) { return null; } }

// ---------------------------------------------------------------- tugmalar (lib/tg_kirish.js chaqiradi). h — { javobla, klavQoy, yubor }
async function tugma(ctx, cb, d, h) {
  const amal = d[1], id = d[2], chat = cb.message && cb.message.chat ? s(cb.message.chat.id) : '', msg = cb.message ? cb.message.message_id : 0, tur = 'kb|' + amal;
  const u = await TT.tgXodim(cb.from && cb.from.id);
  if (!u || !u.admin) { await h.javobla(ctx, cb, 'Bu tugma faqat direktor uchun.'); return { tur, nima: id, natija: 'direktor emas' }; }
  try {
    const sr = await sorov(id);
    if (!sr) { await h.javobla(ctx, cb, 'So\'rov topilmadi.'); await h.klavQoy(ctx, chat, msg); return { tur, kim: u.fish, nima: id, natija: 'topilmadi' }; }
    if (sr.holati !== 'Tasdiq kutilmoqda') { await h.javobla(ctx, cb, 'Allaqachon ko\'rib chiqilgan: ' + sr.holati); await h.klavQoy(ctx, chat, msg); return { tur, kim: u.fish, nima: id, natija: 'allaqachon: ' + sr.holati }; }
    if (amal === 'R') { await h.klavQoy(ctx, chat, msg, klavSabab(id, sr)); await h.javobla(ctx, cb, 'Sababni tanlang'); return { tur, kim: u.fish, nima: id, natija: 'sabab tugmalari' }; }
    if (amal === 'B') { await h.klavQoy(ctx, chat, msg, klav(id)); await h.javobla(ctx, cb, ''); return { tur, kim: u.fish, nima: id, natija: 'orqaga' }; }
    if (amal === 'W') {
      if (!ctx.quruq) await redis.set('tg_tsw:' + chat, JSON.stringify({ kb: id }), 'EX', 1800); else ctx.log.push({ yozuv: 'tg_tsw:' + chat + ' ← kb ' + id });
      await h.javobla(ctx, cb, 'Sababini yozing');
      await h.yubor(ctx, chat, '✍ <b>' + TT.esc(sr.no) + '</b> — rad etish sababini yozing (shu xabarga javob qilib):', { force_reply: true });
      return { tur, kim: u.fish, nima: id, natija: 'sabab so\'raldi' };
    }
    if (amal === 'A') {
      if (ctx.quruq) { ctx.log.push({ yozuv: 'KELISHUV ✅ ' + id + ' (' + sr.no + ') — ' + u.fish }); return { tur, kim: u.fish, nima: id, natija: '(quruq)' }; }
      const r = await bajar(u, id, true, '');
      await h.javobla(ctx, cb, '✅ Tasdiqlandi');
      return { tur, kim: u.fish, nima: id, natija: '✅ ' + s((r || {}).natija).slice(0, 120) };
    }
    if (amal === 'S') {
      const sab = sabablar(sr)[Number(d[3])]; if (!sab) { await h.javobla(ctx, cb, 'Sabab topilmadi'); return { tur, kim: u.fish, nima: id, natija: 'sabab topilmadi' }; }
      if (ctx.quruq) { ctx.log.push({ yozuv: 'KELISHUV ✖ ' + id + ' «' + sab + '» — ' + u.fish }); return { tur, kim: u.fish, nima: id, natija: '(quruq)' }; }
      await bajar(u, id, false, sab); await h.javobla(ctx, cb, '✖ Rad etildi');
      return { tur, kim: u.fish, nima: id, natija: '✖ ' + sab };
    }
    return { tur, kim: u.fish, nima: id, natija: 'noma\'lum amal' };
  } catch (e) { await h.javobla(ctx, cb, '⚠ ' + e.message); await h.yubor(ctx, chat, '⚠ ' + TT.esc(e.message)).catch(() => {}); return { tur, kim: u.fish, nima: id, natija: '⚠ ' + e.message }; }
}
// «✍ Boshqa — yozaman» dan keyin yozilgan sabab
async function radMatn(ctx, m, chat, matn0, id, h) {
  let kim = '';
  try {
    const u = await TT.tgXodim(m.from && m.from.id); if (!u || !u.admin) throw new Error('Kelishuvni faqat direktor tasdiqlaydi.'); kim = u.fish;
    if (s(matn0).length < 5) throw new Error('Sababini to\'liqroq yozing (kamida 5 belgi) — xodimga boradi.');
    if (ctx.quruq) { ctx.log.push({ yozuv: 'KELISHUV ✖ ' + id + ' «' + matn0 + '»' }); return { tur: 'kb sabab', kim, nima: id, natija: '(quruq)' }; }
    await bajar(u, id, false, matn0);
    const sr = await sorov(id);
    await h.yubor(ctx, chat, '✖ Rad etildi: «' + TT.esc(matn0) + '». ' + (sr && sr.turi === 'Kelmadi' ? 'Shartnoma «Aktiv» qoladi, xodimga xabar ketdi.' : 'Xodim tuzatib, skanni qayta yuklaydi.'));
    return { tur: 'kb sabab', kim, nima: id, natija: 'rad: ' + s(matn0).slice(0, 80) };
  } catch (e) { await h.yubor(ctx, chat, '⚠ ' + TT.esc(e.message)).catch(() => {}); return { tur: 'kb sabab', kim, nima: id, natija: '⚠ ' + e.message }; }
}

module.exports = { yubor, yuborFon, natija, natijaFon, bajar, tugma, radMatn, matn, klav, klavSabab, sorov, SABAB, SABAB_K };
