// AKS TIZIM — 🙋 «BUGUNGI ISH» RUXSAT SO'ROVLARI — DIREKTORGA TELEGRAM TUGMALARI BILAN (direktor qarori 24.10.2026).
// Undiruvchi so'rovi (⏭ da'vo muddati o'tgan mijozni o'tkazish — otkaz|…, 📅 qo'shimcha muddat — muhlat|…, ⏸ topshiriqni keyinga qoldirish — kutish|…)
// direktorga xabar + «✅ Ruxsat berish / ✖ Rad etish» tugmalari bilan keladi. Rad — tayyor sabablar yoki «✍ Boshqa — yozaman».
// Qarorning o'zi — ilovadagi amalning AYNAN o'zi (api/qadam_yoz.js qadamOtkazRuxsat / qadamMuhlatRuxsat / qadamKutishRuxsat; direktor uchun qisqa sessiya).
// Xabar havolasi 10_Topshiriqlar V ustuniga (tgx) yoziladi — ilovadan javob berilsa ham Telegram xabari yangilanadi, tugmalar o'chadi.
// Tugma kodlari: rx|A|<id> (ruxsat), rx|R|<id> (sabab tugmalari), rx|S|<id>|<n> (tayyor sabab bilan rad), rx|W|<id> (sababni yozaman), rx|B|<id> (orqaga).
'use strict';
const { redis } = require('./db');
const TG = require('./telegram');
const TT = require('./tg_tasdiq');

const s = v => String(v == null ? '' : v);
const TUR = {
  otkaz: { fn: 'qadamOtkazRuxsat', nom: '⏭ O\'tkazish', sabab: ['Bugun shu mijoz bilan ishlang', 'Sabab yetarli emas', 'Avval mijozga qo\'ng\'iroq qiling'] },
  muhlat: { fn: 'qadamMuhlatRuxsat', nom: '📅 Qo\'shimcha muddat', sabab: ['Yana muddat berilmaydi', 'Summa kam', 'Sana juda uzoq'] },
  kutish: { fn: 'qadamKutishRuxsat', nom: '⏸ Kutish', sabab: ['Topshiriqni muddatida bajaring', 'Muddat juda uzoq', 'Sabab yetarli emas'] } };
const turi = kalit => { const p = s(kalit).split('|')[0]; return TUR[p] ? p : ''; };
const klav = id => ({ inline_keyboard: [[{ text: '✅ Ruxsat berish', callback_data: 'rx|A|' + id }, { text: '✖ Rad etish', callback_data: 'rx|R|' + id }]] });
function klavSabab(tur, id) {
  return { inline_keyboard: TUR[tur].sabab.map((z, i) => [{ text: '✖ ' + z, callback_data: 'rx|S|' + id + '|' + i }])
    .concat([[{ text: '✍ Boshqa — yozaman', callback_data: 'rx|W|' + id }], [{ text: '↩ Orqaga', callback_data: 'rx|B|' + id }]]) };
}

// ---------------------------------------------------------------- yuborish (so'rov yaratilgach). Direktor Telegram'i yo'q bo'lsa — eski yo'l (koprikTgYubor, tugmasiz)
async function yubor(kod, id, matn) {
  const m = s(matn) + '\n\nJavob: pastdagi tugmalar yoki ilovada 📌 Topshiriqlar.';
  const C = await TT.adminChatlar();
  if (!C.length || !(await TG.serverda())) { await require('../api/koprik').chaqir('koprikTgYubor', kod, [s(matn) + '\nJavob — ilovada 📌 Topshiriqlar (✓ Ruxsat / ✕ Rad).']); return ''; }
  const R = [];
  for (const c of C) { try { const r = await TG.api('sendMessage', { chat_id: c, text: m, parse_mode: 'HTML', disable_web_page_preview: true, reply_markup: klav(id) }); if (r && r.message_id) R.push('m:' + c + ':' + r.message_id); } catch (e) { console.error('ruxsat tg ' + c + ':', e.message); } }
  if (!R.length) return '';
  const ref = R.join(' ');
  try { await redis.set('rx_matn:' + id, m, 'EX', 30 * 86400); } catch (e) { }
  try { await TT.refYoz(TT.haqiqiy(), 'top', id, ref); } catch (e) { console.error('ruxsat havola:', e.message); }
  return ref;
}
const yuborFon = (kod, id, matn) => { yubor(kod, id, matn).catch(e => console.error('ruxsat so\'rovi tg:', e.message)); };

// qaror chiqqach (ilovadan yoki botdan): xabar(lar) yangilanadi, tugmalar o'chadi
async function natija(t, matn) {
  if (!t || !s(t.tgx)) return;
  let cap = ''; try { cap = (await redis.get('rx_matn:' + t.id)) || ''; } catch (e) { }
  cap = cap.replace(/\n\nJavob: pastdagi tugmalar yoki ilovada 📌 Topshiriqlar\.$/, '');
  try { await require('../api/tasdiq_qaror')._ichki.tasdiqYangila(TT.haqiqiy(), t.tgx, matn, cap); } catch (e) { console.error('ruxsat natija tg:', e.message); }
}
const natijaFon = (t, matn) => { natija(t, matn).catch(() => {}); };

// ---------------------------------------------------------------- qaror: ilovadagi amal, direktor nomidan (qisqa sessiya)
async function bajar(u, id, ha, izoh) {
  const t = (await require('../api/topshiriq_yoz')._ichki.topRowsYangi('10_Topshiriqlar')).L.find(z => String(z.id) === String(id));
  if (!t) throw new Error('So\'rov topilmadi.');
  const tur = turi(t.kalit); if (!tur) throw new Error('Bu ruxsat so\'rovi emas.');
  if (t.holati !== 'Jarayonda') throw new Error('Bu so\'rovga allaqachon javob berilgan (' + (t.dalil || t.holati) + ').');
  const S = require('../api/sessiya'), tok = await S.sessiyaOch(u.kod);
  // 26.10 TUZATILDI: amal «kod|tok» kutadi (S.foydalanuvchi '|' bo'yicha ajratadi). Avval faqat «tok» yuborilardi —
  // server xodimni tanimay «Sessiya tugagan» deb javob berardi va tugma umuman ishlamasdi.
  try { return await require('../api/qadam_yoz')[TUR[tur].fn]([u.kod + '|' + tok, id, !!ha, izoh || '']); }
  finally { try { await redis.del('ses:' + tok); } catch (e) { } }
}

// ---------------------------------------------------------------- tugmalar (lib/tg_kirish.js chaqiradi). h — { javobla, klavQoy, yubor }
async function tugma(ctx, cb, d, h) {
  const amal = d[1], id = d[2], chat = cb.message && cb.message.chat ? s(cb.message.chat.id) : '', msg = cb.message ? cb.message.message_id : 0, tur0 = 'rx|' + amal;
  const u = await TT.tgXodim(cb.from && cb.from.id);
  if (!u || !u.admin) { await h.javobla(ctx, cb, 'Bu tugma faqat direktor uchun.'); return { tur: tur0, nima: id, natija: 'direktor emas' }; }
  try {
    const t = (await require('../api/topshiriq_yoz')._ichki.topRowsYangi('10_Topshiriqlar')).L.find(z => String(z.id) === String(id));
    if (!t || !turi(t.kalit)) { await h.javobla(ctx, cb, 'So\'rov topilmadi.'); await h.klavQoy(ctx, chat, msg); return { tur: tur0, kim: u.fish, nima: id, natija: 'topilmadi' }; }
    if (t.holati !== 'Jarayonda') { await h.javobla(ctx, cb, 'Allaqachon javob berilgan: ' + (t.dalil || t.holati)); await h.klavQoy(ctx, chat, msg); return { tur: tur0, kim: u.fish, nima: id, natija: 'allaqachon' }; }
    const tur = turi(t.kalit);
    if (amal === 'A') {
      if (ctx.quruq) { ctx.log.push({ yozuv: 'RUXSAT ✅ ' + id + ' (' + TUR[tur].fn + ') — ' + u.fish }); return { tur: tur0, kim: u.fish, nima: id, natija: '(quruq)' }; }
      const r = await bajar(u, id, true, ''); await h.javobla(ctx, cb, '✅ Ruxsat berildi'); return { tur: tur0, kim: u.fish, nima: id, natija: '✅ ' + s((r || {}).natija).slice(0, 80) };
    }
    if (amal === 'R') { await h.klavQoy(ctx, chat, msg, klavSabab(tur, id)); await h.javobla(ctx, cb, 'Sababni tanlang'); return { tur: tur0, kim: u.fish, nima: id, natija: 'sabab tugmalari' }; }
    if (amal === 'B') { await h.klavQoy(ctx, chat, msg, klav(id)); await h.javobla(ctx, cb, ''); return { tur: tur0, kim: u.fish, nima: id, natija: 'orqaga' }; }
    if (amal === 'S') {
      const sab = TUR[tur].sabab[Number(d[3])]; if (!sab) { await h.javobla(ctx, cb, 'Sabab topilmadi'); return { tur: tur0, kim: u.fish, nima: id, natija: 'sabab topilmadi' }; }
      if (ctx.quruq) { ctx.log.push({ yozuv: 'RUXSAT ✖ ' + id + ' «' + sab + '» — ' + u.fish }); return { tur: tur0, kim: u.fish, nima: id, natija: '(quruq)' }; }
      await bajar(u, id, false, sab); await h.javobla(ctx, cb, '✖ Rad etildi'); return { tur: tur0, kim: u.fish, nima: id, natija: '✖ ' + sab };
    }
    if (amal === 'W') {
      if (!ctx.quruq) await redis.set('tg_tsw:' + chat, JSON.stringify({ rx: id }), 'EX', 1800); else ctx.log.push({ yozuv: 'tg_tsw:' + chat + ' ← rx ' + id });
      await h.javobla(ctx, cb, 'Sababini yozing');
      await h.yubor(ctx, chat, '✍ <b>' + TT.esc(t.no) + '</b> — rad etish sababini yozing (shu xabarga javob qilib):', { force_reply: true });
      return { tur: tur0, kim: u.fish, nima: id, natija: 'sabab so\'raldi' };
    }
    return { tur: tur0, kim: u.fish, nima: id, natija: 'noma\'lum amal' };
  } catch (e) { await h.javobla(ctx, cb, '⚠ ' + e.message); await h.yubor(ctx, chat, '⚠ ' + TT.esc(e.message)).catch(() => {}); return { tur: tur0, kim: u.fish, nima: id, natija: '⚠ ' + e.message }; }
}
// «✍ Boshqa — yozaman» dan keyin yozilgan sabab
async function radMatn(ctx, m, chat, matn, id, h) {
  let kim = '';
  try {
    const u = await TT.tgXodim(m.from && m.from.id); if (!u || !u.admin) throw new Error('Bu so\'rovga faqat direktor javob beradi.'); kim = u.fish;
    if (matn.length < 3) throw new Error('Sabab juda qisqa — qaytadan «✖ Rad etish» ni bosing.');
    if (ctx.quruq) { ctx.log.push({ yozuv: 'RUXSAT ✖ ' + id + ' «' + matn + '»' }); return { tur: 'rx sabab', kim, nima: id, natija: '(quruq)' }; }
    await bajar(u, id, false, matn);
    await h.yubor(ctx, chat, '✖ Rad etildi: «' + TT.esc(matn) + '»');
    return { tur: 'rx sabab', kim, nima: id, natija: 'rad: ' + matn.slice(0, 80) };
  } catch (e) { await h.yubor(ctx, chat, '⚠ ' + TT.esc(e.message)).catch(() => {}); return { tur: 'rx sabab', kim, nima: id, natija: '⚠ ' + e.message }; }
}

module.exports = { yubor, yuborFon, natija, natijaFon, bajar, tugma, radMatn, klav, klavSabab, turi, TUR };
