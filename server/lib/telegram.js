// AKS TIZIM — 📱 TELEGRAM to'g'ridan-to'g'ri serverdan (ko'chirish rejasi 23.10.2026, 1-qadam: faqat YUBORISH).
// Eski tizim funksiyalarining o'rni: tgYuborChat_ → chat(id, matn), tgYubor_ → direktor(matn) (07_Xodimlar: admin + Ishlayapti + Telegram ID;
// topilmasa — guruhga), tgGuruh_ → guruh(matn) (TG_GURUH), tgFaylYubor_ → fayl(id, bayt, nom, caption, klav).
// Kalit — faqat /opt/aks/.env (TG_TOKEN); kodda, repoda, chatda YO'Q. Kalit yo'q bo'lsa bor() = false — chaqiruvchilar Koprik'ka qaytadi.
// Har so'rov rpc_jurnal (qayerda = 'tg') ga: aks-bugun tg. 4096 belgidan uzun matn — qatorlar bo'yicha bo'laklab. Xatoda 2 marta qayta (429/5xx).
'use strict';
const env = require('./env');
const V = require('./varaq');
const { q } = require('./db');

const s = v => String(v == null ? '' : v);
const TG_MAX = 4096;
const M = {};   // module.exports — ichki chaqiruvlar M.api orqali (sinovda almashtirish uchun)
function bor() { return !!env.tgToken; }
function jurnal(fn, ms, ok, xato) { q('INSERT INTO rpc_jurnal (fn, qayerda, ms, ok, xato) VALUES ($1,$2,$3,$4,$5)', [fn, 'tg', ms, ok, xato ? s(xato).slice(0, 300) : null]).catch(() => {}); }
function bolak(m) { if (m.length <= TG_MAX) return [m]; const B = []; let b = '';
  m.split('\n').forEach(z => { if (b && (b + '\n' + z).length > TG_MAX) { B.push(b); b = z; } else b = b ? b + '\n' + z : z; }); if (b) B.push(b); return B; }

// Telegram API chaqiruvi (JSON yoki multipart). Qaytaradi result; xato — Error('Telegram xabar yuborilmadi: …') (eski tgYuborChat_ matni)
async function api(metod, tana, fayl) {
  if (!bor()) throw new Error('TG_TOKEN yo\'q (serverda Telegram o\'chiq).');
  const t0 = Date.now(); let oxirgi;
  for (let u = 0; u < 3; u++) {
    try {
      let r;
      if (fayl) { const fd = new FormData(); Object.keys(tana).forEach(k => { if (tana[k] != null) fd.append(k, typeof tana[k] === 'object' ? JSON.stringify(tana[k]) : String(tana[k])); });
        fd.append(fayl.maydon || 'document', new Blob([fayl.bayt], { type: fayl.mime || 'application/pdf' }), fayl.nom || 'fayl.pdf');
        r = await fetch('https://api.telegram.org/bot' + env.tgToken + '/' + metod, { method: 'POST', body: fd, signal: AbortSignal.timeout(60000) }); }
      else r = await fetch('https://api.telegram.org/bot' + env.tgToken + '/' + metod, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(tana), signal: AbortSignal.timeout(30000) });
      const j = await r.json().catch(() => ({ ok: false, description: 'javob tushunarsiz (' + r.status + ')' }));
      if (j.ok) { jurnal(metod, Date.now() - t0, true); return j.result; }
      oxirgi = new Error('Telegram xabar yuborilmadi: ' + (j.description || r.status));
      if (!(r.status === 429 || r.status >= 500)) break;
      await new Promise(z => setTimeout(z, j.parameters && j.parameters.retry_after ? j.parameters.retry_after * 1000 : 2000 * (u + 1)));
    } catch (e) { oxirgi = new Error('Telegram: ' + e.message); await new Promise(z => setTimeout(z, 1500 * (u + 1))); }
  }
  jurnal(metod, Date.now() - t0, false, oxirgi.message); throw oxirgi;
}
// tgYuborChat_(chat, matn, klav): HTML, uzun — bo'laklab (klaviatura — oxirgi bo'lakka). Qaytaradi oxirgi xabar message_id
async function chat(id, matn, klav) {
  const B = bolak(s(matn)); let r = null;
  for (let i = 0; i < B.length; i++) { const p = { chat_id: s(id), text: B[i], parse_mode: 'HTML', disable_web_page_preview: true }; if (klav && i === B.length - 1) p.reply_markup = klav; r = await M.api('sendMessage', p); }
  return r ? r.message_id : 0;
}
// tgDirektorlar_: 07_Xodimlar — Ishlayapti, «admin», Telegram ID (U)
async function direktorlar() {
  return (await V.qatorlar('07_Xodimlar')).filter(({ x: r }) => s(r[10]).trim() === 'Ishlayapti' && s(r[20]).trim() && /admin/i.test(s(r[18]))).map(({ x: r }) => s(r[20]).trim());
}
// tgYubor_: direktor(lar)ga shaxsan; Telegram'i topilmasa — guruhga (xabar yo'qolmasin); birortasiga ham bormasa — xato
async function direktor(matn) {
  const ids = await direktorlar();
  if (!ids.length) return guruh(matn);
  let ok = 0, xato = '';
  for (const id of ids) { try { await chat(id, matn); ok++; } catch (e) { xato = e.message; } }
  if (!ok) throw new Error('Direktorga Telegram yuborilmadi: ' + xato);
  return ok;
}
// tgGuruh_: hisobot guruhi (TG_GURUH)
async function guruh(matn) {
  if (!env.tgGuruh) throw new Error('TG_GURUH yo\'q — hisobot guruhi chat ID .env da sozlanmagan.');
  for (const b of bolak(s(matn))) await M.api('sendMessage', { chat_id: env.tgGuruh, text: b, parse_mode: 'HTML', disable_web_page_preview: true });
  return true;
}
// tgFaylYubor_: fayl (PDF/rasm) + caption (+ tugmalar). Qaytaradi message_id
async function fayl(id, bayt, nom, caption, klav, mime) {
  const p = { chat_id: s(id), caption: s(caption).slice(0, 1024), parse_mode: 'HTML' }; if (klav) p.reply_markup = klav;
  const r = await M.api('sendDocument', p, { bayt, nom, mime }); return r ? r.message_id : 0;
}
async function tugmalarOzgartir(id, msg, klav) { return M.api('editMessageReplyMarkup', { chat_id: s(id), message_id: msg, reply_markup: klav || { inline_keyboard: [] } }); }
async function callbackJavob(cbId, matn) { return M.api('answerCallbackQuery', { callback_query_id: s(cbId), text: s(matn).slice(0, 190) }); }
async function men() { return M.api('getMe', {}); }

// ---------------------------------------------------------------- 2-QADAM: eski Koprik tg* funksiyalarining o'rni (api/koprik.js chaqir() shu yerga buradi)
// Qaysi funksiya serverda: koprikTgYubor, koprikTgChat, koprikTgGuruh, koprikTg (fish → xodim), koprikDevonTg (skan bilan, direktorga tugma).
// koprikTopTasdiqTg / koprikXatTasdiqTg — HALI Koprik'da (tugma javoblari eski tgTugmaPoll da; 3-qadamda).
const KOPRIK_ORNI = { koprikTgYubor: 1, koprikTgChat: 1, koprikTgGuruh: 1, koprikTg: 1, koprikDevonTg: 1 };
async function xodimTg(fish) {   // yuTgXodim_: 07_Xodimlar B → U (xodimTeng)
  const { xodimTeng } = require('./xodim');
  const r = (await V.qatorlar('07_Xodimlar')).find(({ x }) => xodimTeng(s(x[1]), fish)); return r ? s(r.x[20]).trim() : '';
}
// devonTgYubor_: matn (+ Drive'dagi skan — robot o'qiydi, G.driveFayl) → xato matni yoki ''
async function devonYubor(chat, matn, faylId, klav) {
  let f = null;
  if (faylId) { try { f = await require('./google').driveFayl(faylId, env.googleKey); } catch (e) { f = null; } }
  try {
    if (!f) { await chat_(chat, matn, klav); return ''; }
    if (s(matn).replace(/<[^>]+>/g, '').length <= 1000) { await fayl(chat, f.bytes, f.nom || 'skan.pdf', matn, klav, f.mime); return ''; }
    await chat_(chat, matn, klav); await fayl(chat, f.bytes, f.nom || 'skan.pdf', '', null, f.mime); return '';
  } catch (e) { return e.message.replace(/^Telegram( xabar yuborilmadi)?: /, ''); }
}
const chat_ = (id, m, k) => chat(id, m, k);
// devonDirShaxsiy_: har direktorga (07: admin + Ishlayapti) skan + «tugma» (ilovaga havola, ?k=<kirish kodi>)
async function devonDirektorlar(matn, faylId, tugma) {
  let D = [];
  try { D = (await V.qatorlar('07_Xodimlar')).filter(({ x: r }) => s(r[10]).trim() === 'Ishlayapti' && /admin/i.test(s(r[18]))).map(({ x: r }) => ({ fish: s(r[1]).trim(), tg: s(r[20]).trim().replace(/\.0+$/, ''), kod: s(r[11]).trim() })); }
  catch (e) { return '07_Xodimlar o\'qilmadi: ' + e.message; }
  if (!D.length) return 'direktor 07_Xodimlar da topilmadi';
  const xato = [];
  for (const d of D) {
    if (!d.tg) { xato.push(d.fish + ': Telegram ulanmagan (07 U ustuni bo\'sh)'); continue; }
    const url = d.kod && /^https:\/\//.test(env.ilovaUrl) ? env.ilovaUrl + (env.ilovaUrl.indexOf('?') >= 0 ? '&' : '?') + 'k=' + encodeURIComponent(d.kod) : '';
    const xt = await devonYubor(d.tg, matn, faylId, url && tugma ? { inline_keyboard: [[{ text: tugma, url }]] } : null);
    if (xt) xato.push((D.length > 1 ? d.fish + ': ' : '') + xt);
  }
  return xato.join('; ');
}
// koprik.chaqir(fn, kod, args) o'rni — natija shakli Koprik bilan bir xil
async function koprikOrni(fn, args) {
  const a = args || [];
  if (fn === 'koprikTgYubor') { await direktor(s(a[0])); return { ok: true }; }
  if (fn === 'koprikTgChat') { await chat(s(a[0]), s(a[1])); return { ok: true }; }
  if (fn === 'koprikTgGuruh') { await guruh(s(a[0])); return { ok: true }; }
  if (fn === 'koprikTg') { try { const tg = await xodimTg(s(a[0])); if (tg) await chat(tg, s(a[1])); } catch (e) { console.error('yuTgXodim_:', e.message); } return { ok: true }; }
  if (fn === 'koprikDevonTg') { const m = a[0] || {}; if (m.chat) return { xato: await devonYubor(s(m.chat), s(m.matn), s(m.faylId), null) }; return { xato: await devonDirektorlar(s(m.matn), s(m.faylId), s(m.tugma)) }; }
  throw new Error('Telegram: ' + fn + ' serverda yo\'q');
}
async function serverda() { try { return bor() && (await require('./db').redis.get('yozuv_yondi:tg')) === '1'; } catch (e) { return false; } }

module.exports = Object.assign(M, { KOPRIK_ORNI, koprikOrni, serverda, xodimTg, bor, api, chat, direktor, direktorlar, guruh, fayl, tugmalarOzgartir, callbackJavob, men, bolak });
