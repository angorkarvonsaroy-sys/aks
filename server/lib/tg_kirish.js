// AKS TIZIM — 📥 BOTDAN KELADIGAN XABARLAR — SERVERDA (Telegram ko'chirish rejasi 23.10.2026, 3-qadam). Eski tizimning o'zi:
//   Pin.gs       — tgXabar_ (/start <kod> → «📱 Raqamni yuborish», kontakt → raqam 07_Xodimlar F bilan solishtiriladi, U ga Telegram ID yoziladi),
//                  tgUlanishBoshla / tgUlanishTekshir / pinKodYubor / pinOrnat (ilovadan — api/amallar.js shu yerga buradi; 07 T ustuniga PIN izi);
//   Topshiriq.gs — tgTugma_ (✅ / ✖ / sabab / «✍ yozaman» tugmalari — ts|…), tgRadMatn_ (yozilgan sabab), tqBuyruq_ (/tekshiruv — direktor),
//                  tqTugma_ (direktor: 📥 Kutilayotganlar / 📥 Qaytarilganlar — tq|…; 👍 To'g'ri qaytargan / ↩ Isbotni tiklash — tr|…).
// Qaror (tasdiq / qaytarish) — avvalgidek api/tasdiq_navbat.js orqali (yozuv_yondi:tasdiq: navbat, eski tasdiqQil fonda; bo'lmasa — Koprik tasdiqQil),
// 👍 / ↩ — eski tqAmal (Koprik). Matnlar eski bilan aynan. Eski CacheService kalitlari → Redis: tg_ul:<t>, tg_ulc:<chat>, tg_xato:<kod>, tg_pk:<kod>,
// tg_pks:<kod>, tg_tsw:<chat>, tg_ulandi:<kod> (U yozilgach ko'zgu yetib kelguncha), pin_yangi:<kod> (T yozilgach).
// Yoqilishi: yozuv_yondi:tg_kirish (aks-tg-kirish yoq) — bundan oldin Apps Script'da tgTugmaPoll triggeri O'CHIRILADI (ikki poll bo'lmasin).
// ctx (lib/tg_tasdiq.js): haqiqiy yoki quruq (sinov — hech narsa yubormaydi, yozmaydi).
'use strict';
const crypto = require('crypto');
const { q, redis } = require('./db');
const S = require('../api/sessiya');
const TT = require('./tg_tasdiq');
const TG = require('./telegram');
const G = require('./google');
const J = require('./jurnallar');
const env = require('./env');
const tetik = require('./kozgu_tetik');

const s = v => String(v == null ? '' : v);
const PIN_TG_BOT = 'aks_karvon_bot';
const T07 = '07_Xodimlar', PIN_T = 20, PIN_U = 21;
const yoqilgan = () => TG.kirishYoqilgan();

// ---------------------------------------------------------------- telefon (Pin.gs telNorm_/telKorin_/telYashir_)
function telNorm(t) { let d = s(t).replace(/\D/g, ''); if (d.length === 12 && d.startsWith('998')) d = d.slice(3); return d; }
function telKorin(t) { const d = telNorm(t); return d.length === 9 ? d.slice(0, 2) + ' ' + d.slice(2, 5) + ' ' + d.slice(5, 7) + ' ' + d.slice(7) : s(t); }
const telYashir = t => S.telYashir(telNorm(t));
function pinZaif(pin, x) {
  if (!/^\d{6}$/.test(pin)) return 'PIN aynan 6 ta raqamdan iborat bo\'lishi kerak.';
  if (/^(\d)\1{5}$/.test(pin)) return 'Bir xil raqamlardan iborat PIN juda oson. Boshqasini tanlang.';
  if ('01234567890'.indexOf(pin) >= 0 || '09876543210'.indexOf(pin) >= 0) return 'Ketma-ket raqamlar (123456 kabi) juda oson. Boshqasini tanlang.';
  if (/^(\d\d\d)\1$/.test(pin) || /^(\d\d)\1\1$/.test(pin)) return 'Takrorlanuvchi PIN (123123 kabi) juda oson. Boshqasini tanlang.';
  if (x.tel && x.tel.indexOf(pin) >= 0) return 'PIN telefon raqamingizning bir qismi bo\'lmasin.';
  return '';
}
async function xodim(kod) { const x = await S.xodimKod(kod); if (!x) throw new S.Xato('Kirish taqiqlangan. Havolani qayta oching.'); return x; }
async function tgOl(x) { return x.tg || (await redis.get('tg_ulandi:' + x.kod)) || ''; }

// 07_Xodimlar T / U ga yozish — qator Google'dan kirish kodi bilan tekshiriladi (ko'zgu eskirgan bo'lishi mumkin), RAW (Telegram ID son bo'lib ketmasin)
async function xodim07Yoz(x, ustun, qiymat) {
  let qt = x.qator;
  const l = s(((await G.oraliqOqi(env.aksBazaId, T07, 'L' + qt, env.googleKey))[0] || [])[0]).trim();
  if (l !== x.kod) { const L = await G.ustunOqi(env.aksBazaId, T07, 'L', env.googleKey); const i = L.findIndex((v, j) => j > 0 && s(v).trim() === x.kod); if (i < 0) throw new S.Xato('Xodim jadvalda topilmadi.'); qt = i + 1; }
  try { await G.xomYoz(env.aksBazaId, [{ varaq: T07, qator: qt, ustun, qiymat: s(qiymat) }], env.googleKey); }
  catch (e) { if (e instanceof G.RuxsatYoq) throw new S.Xato('Robotda jadvalga yozish huquqi yo\'q — direktorga ayting.'); throw e; }
  Promise.race([tetik.varaqlarYangila([T07]), new Promise(r => setTimeout(r, 20000))]).catch(e => console.error('ko\'zgu (07):', e.message));
  return qt;
}
async function kirishJurnali(x, usul) {
  try { await q(`INSERT INTO kirishlar (kompaniya_id, xodim_id, fish, usul) VALUES (1, $1, $2, $3)`, [x.id, x.fish, usul]); } catch (e) { console.error('kirishlar:', e.message); }
  try { const KY = require('../api/kirish_yoz'); if (await KY.yoqilgan()) await KY.kirishYoz(x.fish, usul); else if (require('../api/koprik').bor()) { /* eski 07b — eski pinOrnat orqali yozilardi; endi faqat server (kirish07b yoqilgan bo'lsa) */ } }
  catch (e) { console.error('07b kirish (' + usul + '):', e.message); }
}

// ================================================================== ILOVADAN (api/amallar.js, yozuv_yondi:tg_kirish bo'lsa)
async function tgUlanishBoshla([kod]) {
  const x = await xodim(kod);
  if (!x.tel) throw new S.Xato('07_Xodimlar da telefon raqamingiz yo\'q. Direktorga murojaat qiling.');
  const t = crypto.randomBytes(8).toString('hex');
  await redis.set('tg_ul:' + t, x.kod, 'EX', 900);
  return { link: 'https://t.me/' + PIN_TG_BOT + '?start=' + t };
}
async function tgUlanishTekshir([kod]) {
  const x = await xodim(kod);
  const xato = await redis.get('tg_xato:' + x.kod); if (xato) { await redis.del('tg_xato:' + x.kod); return { ulandi: false, xato }; }
  return { ulandi: !!(await tgOl(x)) };
}
async function pinKodYubor([kod]) {
  const x = await xodim(kod); const tg = await tgOl(x);
  if (!tg) throw new S.Xato('Avval Telegram orqali raqamingizni tasdiqlang.');
  if (await redis.get('tg_pks:' + x.kod)) throw new S.Xato('Kod yaqinda yuborildi. 1 daqiqadan keyin qayta so\'rang.');
  const k = String(crypto.randomInt(100000, 1000000));
  await redis.set('tg_pk:' + x.kod, JSON.stringify({ k, n: 0 }), 'EX', 300); await redis.set('tg_pks:' + x.kod, '1', 'EX', 60);
  try { await TG.chat(tg, '🔐 <b>AKS TIZIM</b> tasdiqlash kodi: <b>' + k + '</b>\nKod 5 daqiqa amal qiladi. Uni hech kimga bermang — xodimlar ham, direktor ham so\'ramaydi.'); }
  catch (e) { await redis.del('tg_pks:' + x.kod); throw new S.Xato(e.message); }
  return { ok: true };
}
async function pinOrnat([kod, tgKod, pin]) {
  const x = await xodim(kod);
  const v = await redis.get('tg_pk:' + x.kod); let st = null; try { st = v ? JSON.parse(v) : null; } catch (e) { st = null; }
  if (!st) throw new S.Xato('Tasdiqlash kodi eskirgan. «Kodni qayta yuborish» ni bosing.');
  if (s(tgKod).trim() !== st.k) {
    st.n++; if (st.n >= 5) { await redis.del('tg_pk:' + x.kod); throw new S.Xato('Kod 5 marta noto\'g\'ri kiritildi. Yangi kod so\'rang.'); }
    await redis.set('tg_pk:' + x.kod, JSON.stringify(st), 'EX', 300); throw new S.Xato('Tasdiqlash kodi noto\'g\'ri.');
  }
  pin = s(pin); const zaif = pinZaif(pin, x); if (zaif) throw new S.Xato(zaif);
  const tuz = crypto.randomUUID(), iz = tuz + ':' + S.pinIz(tuz, x.kod, pin);
  await xodim07Yoz(x, PIN_T, iz);
  await redis.set('pin_yangi:' + x.kod, iz, 'EX', 1800); await redis.del('tg_pk:' + x.kod); await S.xatoToza(x.kod);
  const tg = await tgOl(x);
  if (tg) TG.chat(tg, '✅ AKS TIZIM: PIN kodingiz o\'rnatildi (' + TT.hozirDmyHm() + '). Agar buni siz qilmagan bo\'lsangiz, darhol direktorga xabar bering.').catch(e => console.error('pinOrnat tg:', e.message));
  kirishJurnali(x, 'PIN o\'rnatildi').catch(() => {});
  return { tok: await S.sessiyaOch(x.kod) };
}
// 5 marta noto'g'ri PIN (pinKir) — direktorga va xodimning o'ziga (Pin.gs pinXabar_)
async function blokXabar(x) {
  const m = '⚠️ <b>' + x.fish + '</b> akkauntiga ' + S.XATO_MAX + ' marta noto\'g\'ri PIN kiritildi. Kirish ' + S.BLOK_DAQ + ' daqiqaga bloklandi.';
  try { await TG.direktor(m); } catch (e) { console.error('blokXabar direktor:', e.message); }
  const tg = await tgOl(x); if (tg) { try { await TG.chat(tg, m + '\nAgar bu siz bo\'lmasangiz, darhol direktorga xabar bering.'); } catch (e) { } }
}

// ================================================================== BOTDAN (lib/tg_poll.js → ishlov)
const javobla = (ctx, cb, m, alert) => ctx.api('answerCallbackQuery', Object.assign({ callback_query_id: s(cb.id), text: s(m).slice(0, 190) }, alert ? { show_alert: true } : {})).catch(() => {});
const yubor = (ctx, chat, matn, klav) => ctx.api('sendMessage', Object.assign({ chat_id: s(chat), text: s(matn), parse_mode: 'HTML' }, klav ? { reply_markup: klav } : {}));
const klavQoy = (ctx, chat, msg, klav) => ctx.api('editMessageReplyMarkup', { chat_id: s(chat), message_id: msg, reply_markup: klav || { inline_keyboard: [] } }).catch(e => console.error('klavQoy:', e.message));
async function direktorga(ctx, matn) {   // tgYubor_: direktor(lar)ga; topilmasa — guruhga
  const C = await TT.adminChatlar();
  if (!C.length) { if (!ctx.quruq) { try { await TG.guruh(matn); } catch (e) { } } else ctx.log.push({ metod: 'guruh', matn }); return; }
  for (const c of C) { try { await yubor(ctx, c, matn); } catch (e) { console.error('direktorga:', e.message); } }
}
async function pinKodTel(tel) {   // telefon → xodimning kirish kodi (faqat «Ishlayapti», kodi bor); bir xil raqam ikki xodimda — ulamaydi
  const t = telNorm(tel); if (t.length !== 9) return '';
  const top = []; for (const z of await TT.xodimlar()) if (telNorm(z.tel) === t && z.kod && await S.xodimKod(z.kod)) top.push(z.kod);
  return top.length === 1 ? top[0] : '';
}

async function ishlov(z, ctx) {
  ctx = ctx || TT.haqiqiy();
  if (z && z.callback_query) return tugma(ctx, z.callback_query);
  if (z && z.message) return xabar(ctx, z.message);
  return { tur: 'boshqa' };
}
// ---------------------------------------------------------------- xabarlar (eski tartib: tqBuyruq_ → tgRadMatn_ → tgXabar_)
async function xabar(ctx, m) {
  if (!m || !m.chat || m.chat.type !== 'private') return { tur: 'xabar', natija: 'shaxsiy chat emas — e\'tiborsiz' };
  const chat = s(m.chat.id), matn = s(m.text || '').trim(), from = m.from && m.from.id;
  if (/^\/tekshiruv(@\w+)?\s*$/i.test(matn)) {
    const u = await TT.tgXodim(from);
    if (u && u.admin) { try { await TT.xulosaYubor(ctx, chat, true); } catch (e) { await yubor(ctx, chat, '⚠ ' + e.message).catch(() => {}); } return { tur: '/tekshiruv', kim: u.fish, natija: 'xulosa yuborildi' }; }
  }
  if (/^\/kod(@\w+)?\s*$/i.test(matn)) return kodYubor(ctx, m, chat);   // 🔑 «Kodimni unutdim»
  if (matn && matn.charAt(0) !== '/') { const r = await radMatn(ctx, m, chat, matn); if (r) return r; }
  return pinXabar(ctx, m, chat, matn);
}
// «✍ Boshqa — yozaman» dan keyingi matn — qaytarish sababi (tgRadMatn_)
async function radMatn(ctx, m, chat, matn) {
  const v = ctx.tsw || await redis.get('tg_tsw:' + chat); if (!v) return null;
  if (!ctx.quruq) await redis.del('tg_tsw:' + chat);
  let o = null; try { o = typeof v === 'string' ? JSON.parse(v) : v; } catch (e) { return null; }
  if (o && o.rx) return require('./tg_ruxsat').radMatn(ctx, m, chat, matn, o.rx, { javobla, klavQoy, yubor });   // 🙋 ruxsat so'rovi rad sababi
  if (o && o.yq) return require('./tg_yurist').radMatn(ctx, m, chat, matn, o, { javobla, klavQoy, yubor });   // ⚖ ish qabul qilishdagi kamchilik
  let kim = '';
  try {
    const u = await TT.tgXodim(m.from && m.from.id); if (!u) throw new Error('Siz AKS TIZIM xodimlari ro\'yxatida yo\'qsiz.'); kim = u.fish;
    const it = await itemOl(ctx, o.k); if (!it) throw new Error('Bu isbot allaqachon ko\'rib chiqilgan.');
    if (!TT.tasdiqHuquq(u, it)) throw new Error('Bu isbotni siz tekshirmaysiz.');
    if (matn.length < 3) throw new Error('Sabab juda qisqa — qaytadan «✖ Qaytarish» ni bosing.');
    await tasdiqBajar(ctx, u, o.k, false, matn);
    await yubor(ctx, chat, '↩ Qaytarildi: «' + TT.esc(matn) + '»');
    return { tur: 'sabab', kim, nima: o.k, natija: 'qaytarildi: ' + matn.slice(0, 80) };
  } catch (e) { await yubor(ctx, chat, '⚠ ' + TT.esc(e.message)).catch(() => {}); return { tur: 'sabab', kim, nima: o.k, natija: '⚠ ' + e.message }; }
}
// ---------------------------------------------------------------- 🔑 «KODIMNI UNUTDIM» — /kod yoki /start kod (direktor ko'rsatmasi 25.10.2026)
// Xodim Telegram ID si bo'yicha topiladi (raqami avval tasdiqlangan bo'lishi shart), YANGI kod yasaladi va 07_Xodimlar L ustuniga
// yoziladi — eski kod o'sha zahoti ishlamay qoladi. Kodda o'xshash belgilar yo'q (0 O o 1 l I) — telefonda xatosiz teriladi.
const PIN_L = 12, AKS_SAYT = 'https://aks-tizim.uz';
const KOD_ALIF = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function kodYasa(n) { let v = ''; for (let i = 0; i < n; i++) v += KOD_ALIF[crypto.randomInt(0, KOD_ALIF.length)]; return v; }
async function kodBand(k) {
  const r = await q(`SELECT 1 FROM v_xodimlar WHERE lower(regexp_replace(kirish_kodi, '[^A-Za-z0-9]', '', 'g')) = $1 LIMIT 1`, [S.kodNorm(k)]);
  return !!r.rows[0];
}
async function kodYangi() { for (let i = 0; i < 20; i++) { const k = kodYasa(14); if (!(await kodBand(k))) return k; } throw new S.Xato('Yangi kod yasalmadi — qayta urinib ko\'ring.'); }

async function kodYubor(ctx, m, chat) {
  const u = await TT.tgXodim(m.from && m.from.id);
  if (!u) {
    await yubor(ctx, chat, '🔑 Yangi kirish kodi olish uchun avval raqamingizni tasdiqlang: pastdagi <b>«📱 Raqamni yuborish»</b> tugmasini bosing, keyin <b>/kod</b> deb yozing.',
      { keyboard: [[{ text: '📱 Raqamni yuborish', request_contact: true }]], one_time_keyboard: true, resize_keyboard: true });
    return { tur: '/kod', natija: 'raqam so\'raldi' };
  }
  const x = await S.xodimKod(u.kod);
  if (!x) { await yubor(ctx, chat, '⚠ Xodim ro\'yxatda topilmadi. Direktorga murojaat qiling.'); return { tur: '/kod', kim: u.fish, natija: 'xodim topilmadi' }; }
  if (!ctx.quruq && await redis.get('kod_s:' + x.kod)) { await yubor(ctx, chat, '⏳ Yangi kod yaqinda yuborildi. 2 daqiqadan keyin qayta so\'rang.'); return { tur: '/kod', kim: x.fish, natija: 'tez-tez so\'rov' }; }
  const yangi = await kodYangi();
  if (ctx.quruq) { ctx.log.push({ yozuv: T07 + ' L' + x.qator + ' (' + x.fish + ') ← yangi kirish kodi (' + yangi.length + ' belgi)' }); return { tur: '/kod', kim: x.fish, natija: '(quruq) yangi kod' }; }
  await redis.set('kod_s:' + x.kod, '1', 'EX', 120);
  try { await TT.yozuv(ctx, T07 + ' L' + x.qator + ' (' + x.fish + ') ← yangi kirish kodi', () => xodim07Yoz(x, PIN_L, yangi)); }
  catch (e) { await redis.del('kod_s:' + x.kod); await yubor(ctx, chat, '⚠ Kodni jadvalga yozib bo\'lmadi: ' + TT.esc(e.message)); return { tur: '/kod', kim: x.fish, natija: '⚠ ' + e.message }; }
  await yubor(ctx, chat, '🔑 <b>' + TT.esc(x.ism) + '</b>, yangi kirish kodingiz:\n\n<code>' + yangi + '</code>\n\n'
    + '👉 Tayyor havola — bosing va kiraverasiz:\n' + AKS_SAYT + '/?k=' + yangi + '\n\n'
    + '⚠️ Eski kodingiz endi ishlamaydi. Kodni hech kimga bermang — direktor ham, xodimlar ham so\'ramaydi.');
  await direktorga(ctx, '🔑 <b>' + TT.esc(x.fish) + '</b> botdan yangi kirish kodi oldi — eski kodi bekor qilindi.');
  return { tur: '/kod', kim: x.fish, natija: 'yangi kod yuborildi' };
}

// Pin.gs tgXabar_: /start <kod> va kontakt
async function pinXabar(ctx, m, chat, matn) {
  if (matn.indexOf('/start') === 0) {
    const t = matn.split(/\s+/)[1] || '';
    if (t === 'kod') return kodYubor(ctx, m, chat);   // 🔑 kirish oynasidagi «Kodimni unutdim» havolasi
    const kod = t ? (ctx.ul && ctx.ul[t]) || await redis.get('tg_ul:' + t) : null;
    if (!ctx.quruq) { if (kod) await redis.set('tg_ulc:' + chat, kod, 'EX', 900); else await redis.del('tg_ulc:' + chat); } else ctx.log.push({ yozuv: kod ? 'ulash kodi ' + t + ' → chat ' + chat + ' (' + kod.slice(0, 4) + '…)' : 'ulash kodi yo\'q — raqam bo\'yicha topiladi' });
    await yubor(ctx, chat, 'Assalomu alaykum! AKS TIZIMga ulanish uchun pastdagi <b>«📱 Raqamni yuborish»</b> tugmasini bosing.',
      { keyboard: [[{ text: '📱 Raqamni yuborish', request_contact: true }]], one_time_keyboard: true, resize_keyboard: true });
    return { tur: '/start', nima: t ? (kod ? 'ilova havolasi' : 'eskirgan havola') : 'to\'g\'ridan-to\'g\'ri', natija: 'raqam so\'raldi' };
  }
  if (m.contact) {
    const ol = { remove_keyboard: true }, ism = [m.from && m.from.first_name, m.from && m.from.last_name].filter(Boolean).join(' ');
    if (!m.from || m.contact.user_id !== m.from.id) { await yubor(ctx, chat, '❌ Faqat o\'zingizning raqamingizni tugma orqali yuboring.', ol); return { tur: 'kontakt', kim: ism, natija: 'begona raqam' }; }
    let kod = ctx.ulc || await redis.get('tg_ulc:' + chat);
    if (!kod) {
      kod = await pinKodTel(m.contact.phone_number);
      if (!kod) {
        const tt = telKorin(m.contact.phone_number);
        await yubor(ctx, chat, '❌ Telegram raqamingiz (<b>' + tt + '</b>) AKS TIZIM xodimlari ro\'yxatida yo\'q.\n\n'
          + 'Tizimga kirish uchun Telegram\'ingiz ochilgan raqam direktor tomonidan ro\'yxatga kiritilgan bo\'lishi kerak.\n'
          + '👉 Direktorga ayting: «Mening Telegram raqamim ' + tt + '». U raqamni tizimga kiritgach, AKS ilovasida <b>«Qayta urinish»</b> ni bosing.', ol);
        await direktorga(ctx, '⚠️ Ro\'yxatda yo\'q raqam botga ulanmoqchi bo\'ldi: <b>' + tt + '</b> (Telegram\'dagi ismi: ' + TT.esc(ism || '—') + ').\nAgar bu xodimingiz bo\'lsa — 07_Xodimlar da uning F katagiga shu raqamni yozing.');
        return { tur: 'kontakt', kim: ism, nima: tt, natija: 'ro\'yxatda yo\'q' };
      }
    }
    const x = await S.xodimKod(kod); if (!x) return { tur: 'kontakt', kim: ism, natija: 'kod eskirgan (xodim topilmadi)' };
    if (telNorm(m.contact.phone_number) !== telNorm(x.tel)) {
      const tt = telKorin(m.contact.phone_number), rr = telYashir(x.tel);
      if (!ctx.quruq) await redis.set('tg_xato:' + x.kod, 'Telegram raqamingiz (' + tt + ') ro\'yxatdagi raqamingiz (' + rr + ') bilan bir xil emas. Direktorga ayting: «Mening Telegram raqamim ' + tt + '». U raqamingizni tizimga kiritgach, «Qayta urinish» ni bosing.', 'EX', 600);
      await yubor(ctx, chat, '❌ Telegram raqamingiz (<b>' + tt + '</b>) AKS TIZIM dagi raqamingiz (<b>' + rr + '</b>) bilan bir xil emas.\n\n'
        + '👉 Direktorga ayting: «Mening Telegram raqamim ' + tt + '». U raqamingizni tizimga kiritgach, AKS ilovasida <b>«Qayta urinish»</b> ni bosing.', ol);
      await direktorga(ctx, '⚠️ <b>' + TT.esc(x.fish) + '</b> Telegram\'ga ulana olmadi — raqam mos kelmadi.\nRo\'yxatda: <b>' + telKorin(x.tel) + '</b>\nTelegram: <b>' + tt + '</b>\nAgar Telegram raqami to\'g\'ri bo\'lsa — 07_Xodimlar <b>F' + x.qator + '</b> ga shu raqamni yozing.');
      return { tur: 'kontakt', kim: x.fish, nima: tt, natija: 'raqam mos emas' };
    }
    await TT.yozuv(ctx, T07 + ' U' + x.qator + ' (' + x.fish + ') ← Telegram ID ' + chat, () => xodim07Yoz(x, PIN_U, chat));
    if (!ctx.quruq) { await redis.set('tg_ulandi:' + x.kod, chat, 'EX', 1800); await redis.del('tg_ulc:' + chat); }
    await yubor(ctx, chat, '✅ Raqamingiz tasdiqlandi, ' + TT.esc(x.ism) + '. Endi AKS ilovasiga qayting — tasdiqlash kodi shu yerga keladi.', ol);
    return { tur: 'kontakt', kim: x.fish, natija: 'ulandi — 07 U yozildi' };
  }
  return { tur: 'xabar', natija: 'e\'tiborsiz: ' + matn.slice(0, 40) };
}

// isbot (tasdiqItem_) — ko'zgudan; topilmasa (hozirgina yozilgan, ko'zgu hali yetib kelmagan) — o'sha varaq darhol yangilanib yana qaraladi
async function itemOl(ctx, k) {
  const TP = require('../api/topshiriq')._ichki; let it = await TP.tasdiqItem(k); if (it || ctx.quruq) return it;
  const v = k.charAt(0) === 't' ? ['10_Topshiriqlar'] : k.charAt(0) === 'x' ? ['06e_Xatlar'] : ['06d_Hujjatlar'];
  try { await Promise.race([tetik.varaqlarYangila(v), new Promise(r => setTimeout(r, 15000))]); } catch (e) { }
  return TP.tasdiqItem(k);
}
// ---------------------------------------------------------------- qaror: navbat (api/tasdiq_navbat.js) yoki Koprik tasdiqQil
async function tasdiqBajar(ctx, u, k, ha, izoh) {
  if (ctx.quruq) { ctx.log.push({ yozuv: 'QAROR ' + k + ' ' + (ha ? '✅ tasdiq' : '✖ qaytarish «' + izoh + '»') + ' — ' + u.fish + ' (tasdiq navbatiga qo\'yilardi)' }); return { ok: true }; }
  const TN = require('../api/tasdiq_navbat')._ichki, uu = { kod: u.kod, fish: u.fish, huquq: u.huquq };
  if ((await TN.kutilmoqda())[k]) throw new Error('Bu isbot hozir ko\'rib chiqilmoqda — bir oz kuting.');
  const TQ = require('../api/tasdiq_qaror')._ichki; if (await TQ.yoqilgan()) return TQ.qaror(uu, k, ha, izoh, ctx);   // 3b: qaror serverning o'zida
  if (await TN.yoqilgan()) { if ((await TN.kutilmoqda())[k]) throw new Error('Bu isbot hozir ko\'rib chiqilmoqda — bir oz kuting.'); return TN.navbatga(uu, k, ha, izoh, 'tasdiqQil', [k, ha, izoh]); }
  const r = await require('../api/koprik').chaqir('tasdiqQil', u.kod, [k, ha, izoh]); tetik.yangilaKut(20000).catch(() => {}); return r;
}
async function tqAmal(ctx, u, id, amal, qr) {   // 👍 — serverda (3b, tasdiq_qaror); ↩ tiklash — hali eski tqAmal (Drive'da faylni qaytarish — Koprik v1.18 bilan)
  const TQ = require('../api/tasdiq_qaror')._ichki;
  if (amal === 'togri' && qr && await TQ.yoqilgan()) return TQ.tqTogri({ kod: u.kod, fish: u.fish, huquq: u.huquq }, qr, ctx);
  if (amal === 'tikla' && qr && await TQ.yoqilgan() && (ctx.quruq || await TQ.koprik18(u.kod))) return TQ.tqTiklash({ kod: u.kod, fish: u.fish, huquq: u.huquq }, qr, ctx);
  if (ctx.quruq) { ctx.log.push({ yozuv: 'tqAmal ' + id + ' ' + amal + ' — ' + u.fish + ' (Koprik)' }); return { ok: true, natija: '(quruq)' }; }
  const r = await require('../api/koprik').chaqir('tqAmal', u.kod, [id, amal]); tetik.yangilaKut(20000).catch(() => {}); return r;
}
// ---------------------------------------------------------------- tugmalar
async function tugma(ctx, cb) {
  const d = s(cb.data).split('|');
  if (d[0] === 'tq' || d[0] === 'tr') return tqTugma(ctx, cb, d);
  if (d[0] === 'rx') return require('./tg_ruxsat').tugma(ctx, cb, d, { javobla, klavQoy, yubor });   // 🙋 «Bugungi ish» ruxsat so'rovlari
  if (d[0] === 'yq') return require('./tg_yurist').tugma(ctx, cb, d, { javobla, klavQoy, yubor });   // ⚖ ishni botdan qabul qilish
  if (d[0] !== 'ts') return { tur: 'tugma', nima: s(cb.data), natija: 'noma\'lum — e\'tiborsiz' };
  const amal = d[1], k = d[2], chat = cb.message && cb.message.chat ? s(cb.message.chat.id) : '', msg = cb.message ? cb.message.message_id : 0;
  const u = await TT.tgXodim(cb.from && cb.from.id);
  if (!u) { await javobla(ctx, cb, 'Siz AKS TIZIM xodimlari ro\'yxatida yo\'qsiz.'); return { tur: 'ts|' + amal, nima: k, natija: 'begona' }; }
  const it = await itemOl(ctx, k);
  if (!it) { await javobla(ctx, cb, 'Bu isbot allaqachon ko\'rib chiqilgan.'); await klavQoy(ctx, chat, msg, { inline_keyboard: [] }); return { tur: 'ts|' + amal, kim: u.fish, nima: k, natija: 'allaqachon ko\'rilgan' }; }
  if (!TT.tasdiqHuquq(u, it)) { await javobla(ctx, cb, 'Bu isbotni ' + (it.tasdiqchi === 'yurist' ? 'yurist' : 'direktor') + ' tekshiradi.'); return { tur: 'ts|' + amal, kim: u.fish, nima: k, natija: 'huquq yo\'q' }; }
  try {
    if (amal === 'A') { await tasdiqBajar(ctx, u, k, true, ''); await javobla(ctx, cb, '✅ Tasdiqlandi'); await klavQoy(ctx, chat, msg, { inline_keyboard: [] }); return { tur: 'ts|A', kim: u.fish, nima: k, natija: '✅ tasdiq navbatga' }; }
    if (amal === 'R') { await klavQoy(ctx, chat, msg, TT.klavSabab(it)); await javobla(ctx, cb, 'Sababni tanlang'); return { tur: 'ts|R', kim: u.fish, nima: k, natija: 'sabab tugmalari' }; }
    if (amal === 'B') { await klavQoy(ctx, chat, msg, TT.klavAsosiy(k)); await javobla(ctx, cb, ''); return { tur: 'ts|B', kim: u.fish, nima: k, natija: 'orqaga' }; }
    if (amal === 'S') {
      const sab = (TT.TOP_RAD_SABAB[it.rad] || TT.TOP_RAD_SABAB.oddiy)[Number(d[3])]; if (!sab) { await javobla(ctx, cb, 'Sabab topilmadi'); return { tur: 'ts|S', kim: u.fish, nima: k, natija: 'sabab topilmadi' }; }
      await tasdiqBajar(ctx, u, k, false, sab); await javobla(ctx, cb, '↩ Qaytarildi'); await klavQoy(ctx, chat, msg, { inline_keyboard: [] });
      return { tur: 'ts|S', kim: u.fish, nima: k, natija: '↩ qaytarish navbatga: ' + sab };
    }
    if (amal === 'W') {
      if (!ctx.quruq) await redis.set('tg_tsw:' + chat, JSON.stringify({ k }), 'EX', 1800); else ctx.log.push({ yozuv: 'tg_tsw:' + chat + ' ← ' + k + ' (30 daqiqa)' });
      await javobla(ctx, cb, 'Sababini yozing');
      await yubor(ctx, chat, '✍ <b>' + TT.esc(it.no || it.nomi) + '</b> — qaytarish sababini yozing (shu xabarga javob qilib):', { force_reply: true });
      return { tur: 'ts|W', kim: u.fish, nima: k, natija: 'sabab so\'raldi' };
    }
    return { tur: 'ts|' + amal, kim: u.fish, nima: k, natija: 'noma\'lum amal' };
  } catch (e) { await javobla(ctx, cb, 'Xato: ' + e.message); await yubor(ctx, chat, '⚠ ' + TT.esc(e.message)).catch(() => {}); return { tur: 'ts|' + amal, kim: u.fish, nima: k, natija: '⚠ ' + e.message }; }
}
async function tqTugma(ctx, cb, d) {
  const chat = cb.message && cb.message.chat ? s(cb.message.chat.id) : '', msg = cb.message ? cb.message.message_id : 0, tur = d[0] + '|' + d[1];
  const u = await TT.tgXodim(cb.from && cb.from.id);
  if (!u || !u.admin) { await javobla(ctx, cb, 'Bu tugma faqat direktor uchun.'); return { tur, natija: 'direktor emas' }; }
  try {
    if (d[0] === 'tq') { await javobla(ctx, cb, 'Yuborilmoqda…'); const n = d[1] === 'K' ? await TT.kutYubor(ctx, chat) : d[1] === 'Q' ? await TT.radYubor(ctx, chat) : 0; return { tur, kim: u.fish, natija: n + ' ta yuborildi' }; }
    const qr = (await J.tqRows()).find(z => s(z.id) === s(d[2])); if (!qr) { await javobla(ctx, cb, 'Qaror topilmadi.'); return { tur, kim: u.fish, nima: d[2], natija: 'qaror topilmadi' }; }
    if (qr.direktor) { await javobla(ctx, cb, 'Allaqachon ko\'rib chiqilgan: ' + qr.direktor.split('|')[0]); await klavQoy(ctx, chat, msg, { inline_keyboard: [] }); return { tur, kim: u.fish, nima: d[2], natija: 'allaqachon' }; }
    if (d[1] === 'O') { await tqAmal(ctx, u, qr.id, 'togri', qr); await javobla(ctx, cb, '👍 Belgilandi'); return { tur, kim: u.fish, nima: d[2], natija: '👍 to\'g\'ri qaytargan' }; }
    if (d[1] === 'U') { await klavQoy(ctx, chat, msg, { inline_keyboard: [[{ text: '✅ Ha — isbotni tiklayman', callback_data: 'tr|Y|' + qr.id }], [{ text: '↩ Orqaga', callback_data: 'tr|B|' + qr.id }]] });
      await javobla(ctx, cb, 'Isbot qayta kuchga kiradi, xodimning minusi uzrli bo\'ladi, «qayta yuklang» topshirig\'i yopiladi. Xabar ostidagi «✅ Ha» ni bosing.', true); return { tur, kim: u.fish, nima: d[2], natija: 'tasdiq so\'raldi' }; }
    if (d[1] === 'B') { await klavQoy(ctx, chat, msg, TT.tqKlav(qr)); await javobla(ctx, cb, ''); return { tur, kim: u.fish, nima: d[2], natija: 'orqaga' }; }
    if (d[1] === 'Y') { const r = await tqAmal(ctx, u, qr.id, 'tikla', qr); await javobla(ctx, cb, '✅ Isbot tiklandi'); await yubor(ctx, chat, '✅ ' + TT.esc((r || {}).natija || 'Isbot tiklandi')).catch(() => {}); return { tur, kim: u.fish, nima: d[2], natija: '↩ tiklandi' }; }
    return { tur, kim: u.fish, nima: d[2], natija: 'noma\'lum amal' };
  } catch (e) { await javobla(ctx, cb, '⚠ ' + e.message); await yubor(ctx, chat, '⚠ ' + TT.esc(e.message)).catch(() => {}); return { tur, kim: u.fish, nima: d[2], natija: '⚠ ' + e.message }; }
}

// ---------------------------------------------------------------- jurnal (Redis tg_kirish_jurnal — oxirgi 100; aks-tg-kirish)
async function jurnal(y) { try { await redis.lpush('tg_kirish_jurnal', JSON.stringify(Object.assign({ vaqt: TT.hozirDmyHm() }, y))); await redis.ltrim('tg_kirish_jurnal', 0, 99); } catch (e) { } }
async function jurnalOqi(n = 20) { try { return (await redis.lrange('tg_kirish_jurnal', 0, n - 1)).map(x => JSON.parse(x)); } catch (e) { return []; } }

module.exports = { yoqilgan, ishlov, xabar, tugma, jurnal, jurnalOqi, tgUlanishBoshla, tgUlanishTekshir, pinKodYubor, pinOrnat, blokXabar, tgOl, telNorm, telKorin, pinZaif, pinKodTel, xodim07Yoz, kodYubor, kodYasa, PIN_TG_BOT };
