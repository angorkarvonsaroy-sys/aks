// AKS TIZIM — ⚖ YURIST: ISHNI BOTDAN QABUL QILISH (direktor qarori 24.10.2026).
// Ish yuristga o'tkazilganda unga Telegram xabar «✅ Qabul qilaman» / «↩ Kamchilik bor» tugmalari bilan keladi:
// tizimga kirmasdan, botning o'zidan qabul qiladi yoki kamchilik bilan qaytaradi — natija tizimda ham darhol aks etadi
// (api/yurist_yoz.js yuristQabul ning AYNAN o'zi chaqiriladi, yurist nomidan qisqa sessiya bilan).
// Tugma kodlari: yq|A|<ish id> (qabul), yq|K|<id> (kamchilik ro'yxati), yq|S|<id>|<n> (tayyor kamchilik), yq|W|<id> (yozaman), yq|B|<id> (orqaga).
'use strict';
const { redis } = require('./db');
const TG = require('./telegram');
const TT = require('./tg_tasdiq');

const s = v => String(v == null ? '' : v);
const KAMCHILIK = ['Pasport nusxasi yo\'q yoki eskirgan', 'Shartnoma skani to\'liq emas', 'Xat isboti yetishmaydi', 'JSHSHIR yo\'q', 'Mijoz manzili aniq emas'];
const klav = id => ({ inline_keyboard: [[{ text: '✅ Qabul qilaman', callback_data: 'yq|A|' + id }, { text: '↩ Kamchilik bor', callback_data: 'yq|K|' + id }]] });
const klavKam = id => ({ inline_keyboard: KAMCHILIK.map((z, i) => [{ text: '↩ ' + z, callback_data: 'yq|S|' + id + '|' + i }])
  .concat([[{ text: '✍ Boshqa — yozaman', callback_data: 'yq|W|' + id }], [{ text: '↩ Orqaga', callback_data: 'yq|B|' + id }]]) });

// ishni botdan qabul qilish — ilovadagi amalning o'zi (yurist nomidan qisqa sessiya)
async function bajar(u, id, kamchilik, izoh) {
  const S = require('../api/sessiya'), tok = await S.sessiyaOch(u.kod);
  try { return await require('../api/yurist_yoz').yuristQabul([tok, id, !!kamchilik, izoh || '']); }
  finally { try { await redis.del('ses:' + tok); } catch (e) { } }
}
// xabarni yangilash: tugmalar o'chadi, natija qo'shiladi
async function natija(ctx, chat, msg, eski, qator) {
  try { await ctx.api('editMessageText', { chat_id: s(chat), message_id: msg, text: s(eski) + '\n\n<b>' + s(qator) + '</b>', parse_mode: 'HTML', reply_markup: { inline_keyboard: [] } }, null, { urinishsiz: true }); }
  catch (e) { console.error('yurist qabul natija:', e.message); }
}

async function tugma(ctx, cb, d, h) {
  const amal = d[1], id = d[2], chat = cb.message && cb.message.chat ? s(cb.message.chat.id) : '', msg = cb.message ? cb.message.message_id : 0;
  const eski = cb.message ? s(cb.message.text || cb.message.caption || '') : '', tur = 'yq|' + amal;
  const u = await TT.tgXodim(cb.from && cb.from.id);
  if (!u || !(u.yurist || u.admin)) { await h.javobla(ctx, cb, 'Bu tugma yurist uchun.'); return { tur, nima: id, natija: 'yurist emas' }; }
  try {
    if (amal === 'K') { await h.klavQoy(ctx, chat, msg, klavKam(id)); await h.javobla(ctx, cb, 'Qanday kamchilik?'); return { tur, kim: u.fish, nima: id, natija: 'kamchilik ro\'yxati' }; }
    if (amal === 'B') { await h.klavQoy(ctx, chat, msg, klav(id)); await h.javobla(ctx, cb, ''); return { tur, kim: u.fish, nima: id, natija: 'orqaga' }; }
    if (amal === 'W') {
      if (!ctx.quruq) await redis.set('tg_tsw:' + chat, JSON.stringify({ yq: id, msg, eski }), 'EX', 1800); else ctx.log.push({ yozuv: 'tg_tsw:' + chat + ' ← yq ' + id });
      await h.javobla(ctx, cb, 'Kamchilikni yozing');
      await h.yubor(ctx, chat, '✍ Qanday kamchilik borligini yozing (shu xabarga javob qilib):', { force_reply: true });
      return { tur, kim: u.fish, nima: id, natija: 'kamchilik so\'raldi' };
    }
    const kam = amal === 'S', izoh = kam ? KAMCHILIK[Number(d[3])] : '';
    if (kam && !izoh) { await h.javobla(ctx, cb, 'Kamchilik topilmadi'); return { tur, kim: u.fish, nima: id, natija: 'kamchilik topilmadi' }; }
    if (amal !== 'A' && !kam) { await h.javobla(ctx, cb, ''); return { tur, kim: u.fish, nima: id, natija: 'noma\'lum amal' }; }
    if (ctx.quruq) { ctx.log.push({ yozuv: 'QABUL ' + id + (kam ? ' ↩ kamchilik «' + izoh + '»' : ' ✅') + ' — ' + u.fish }); return { tur, kim: u.fish, nima: id, natija: '(quruq)' }; }
    await bajar(u, id, kam, izoh);
    await h.javobla(ctx, cb, kam ? '↩ Kamchilik yozildi' : '✅ Qabul qilindi');
    await natija(ctx, chat, msg, eski, kam ? '↩ Kamchilik bilan qabul qilindi: «' + izoh + '» (' + u.fish + ', ' + TT.hozirDmyHm() + ')\nUndiruvchiga topshiriqni ilovada bering: ⚖ Yurist → ish kartasi.'
      : '✅ Ish qabul qilindi — ' + u.fish + ', ' + TT.hozirDmyHm());
    return { tur, kim: u.fish, nima: id, natija: kam ? '↩ kamchilik: ' + izoh : '✅ qabul qilindi' };
  } catch (e) { await h.javobla(ctx, cb, '⚠ ' + e.message); await h.yubor(ctx, chat, '⚠ ' + TT.esc(e.message)).catch(() => {}); return { tur, kim: u.fish, nima: id, natija: '⚠ ' + e.message }; }
}
// «✍ Boshqa — yozaman» dan keyingi matn
async function radMatn(ctx, m, chat, matn, o, h) {
  let kim = '';
  try {
    const u = await TT.tgXodim(m.from && m.from.id); if (!u || !(u.yurist || u.admin)) throw new Error('Bu ishni yurist qabul qiladi.'); kim = u.fish;
    if (matn.length < 5) throw new Error('Kamchilikni qisqa yozing (kamida 5 belgi).');
    if (ctx.quruq) { ctx.log.push({ yozuv: 'QABUL ' + o.yq + ' ↩ kamchilik «' + matn + '»' }); return { tur: 'yq matn', kim, nima: o.yq, natija: '(quruq)' }; }
    await bajar(u, o.yq, true, matn);
    if (o.msg) await natija(ctx, chat, o.msg, o.eski || '', '↩ Kamchilik bilan qabul qilindi: «' + matn + '» (' + u.fish + ', ' + TT.hozirDmyHm() + ')');
    await h.yubor(ctx, chat, '↩ Kamchilik yozildi: «' + TT.esc(matn) + '». Undiruvchiga topshiriqni ilovada bering.');
    return { tur: 'yq matn', kim, nima: o.yq, natija: 'kamchilik: ' + matn.slice(0, 80) };
  } catch (e) { await h.yubor(ctx, chat, '⚠ ' + TT.esc(e.message)).catch(() => {}); return { tur: 'yq matn', kim, nima: o.yq, natija: '⚠ ' + e.message }; }
}

module.exports = { tugma, radMatn, klav, klavKam, bajar, KAMCHILIK };
