// AKS TIZIM — 🤝 MIJOZLAR BOTI (direktor qarori 10.11.2026): mijozning o'ziga Telegram orqali — to'lovi qabul qilinganda qolgan qarzi,
// to'lov sanasidan 3 kun oldin va to'lov kuni eslatma, muddati o'tsa haftada bir marta (dushanba). Yakshanba — xabar yo'q.
// ALOHIDA bot: kaliti TG_MIJOZ_TOKEN — faqat /opt/aks/.env da (aks-mijoz-bot buyrug'i yashirin so'raydi; kodda, repoda, chatda YO'Q).
// Xodimlar boti (TG_TOKEN) ga TEGILMAYDI. Kalit yo'q bo'lsa — modul hech narsa qilmaydi.
// Ulanish: Telegram boti odamga birinchi bo'lib yoza olmaydi — mijoz botni ochib «📱 Рақамни юбориш» ni bosadi; Telegram uning HAQIQIY raqamini
// yuboradi (contact.user_id = yuboruvchi), raqam 02_Mijozlar E/F bilan solishtiriladi. Mos kelmasa — hech qanday ma'lumot berilmaydi.
// Bog'lanishlar: server_sozlama 'mijoz_bot' → { chats: { <chat>: { tel, mids: [..], vaqt, ism, toxta } } } (Google jadvalga yozilmaydi).
// Qarz raqamlari — 03 hisob ustunlari (AC asosiy, AD qo'shimcha maydon, AE jami, AF muddati o'tgan), KO-1 «Мижозга эслатма» qoidasi bilan bir xil:
// shartnoma qiymati va jami to'langan KO'RSATILMAYDI. Keyingi to'lov — 03b jadvalidan: kumulyativ > jami to'langan bo'lgan birinchi kelajak qator.
'use strict';
const fs = require('fs');
const V = require('./varaq');
const TG = require('./telegram');
const SZ = require('./sozlama');
const { redis, q } = require('./db');
const { qulfBilan } = require('./qulf');
const { xatKirill } = require('./ism');

const M = {};
const s = v => String(v == null ? '' : v).trim();
const ENV = process.env.AKS_ENV || '/opt/aks/.env';
const OFIS_TEL = '+998 95-557-88-88';
const KALIT = 'mijoz_bot';
const uxla = ms => new Promise(r => setTimeout(r, ms));
const esc = v => s(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const pul = n => String(Math.round(Number(n) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
const dmy = i => i ? i.split('-').reverse().join('.') : '';
const kunQosh = (i, n) => { const d = new Date(i + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const telNorm = t => { let d = s(t).replace(/\D/g, ''); if (d.length === 12 && d.indexOf('998') === 0) d = d.slice(3); return d; };
const telFmt = d => d.length === 9 ? d.slice(0, 2) + ' ' + d.slice(2, 5) + ' ' + d.slice(5, 7) + ' ' + d.slice(7) : d;

// ---------------------------------------------------------------- kalit (.env dan, 30 s xotira — serverni qayta yoqmasdan ulanadi)
let tk = { t: 0, v: '' };
function token() {
  if (Date.now() - tk.t < 30000) return tk.v;
  let m = ''; try { m = fs.readFileSync(ENV, 'utf8'); } catch (e) { }
  const r = /^\s*TG_MIJOZ_TOKEN\s*=\s*(.*?)\s*$/m.exec(m);
  let v = r ? r[1] : (process.env.TG_MIJOZ_TOKEN || '');
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
  tk = { t: Date.now(), v: v.trim() }; return tk.v;
}
const bor = () => !!M.token();
const api = (metod, tana, opt) => TG.api(metod, tana, null, Object.assign({ token: M.token(), nom: 'mijoz' }, opt || {}));
async function yubor(chat, matn, klav) {
  const p = { chat_id: s(chat), text: matn, parse_mode: 'HTML', disable_web_page_preview: true }; if (klav) p.reply_markup = klav;
  return M.api('sendMessage', p);
}
const KL_RAQAM = { keyboard: [[{ text: '📱 Рақамни юбориш', request_contact: true }]], resize_keyboard: true };
const KL_ASOSIY = { keyboard: [[{ text: '📊 Қарзим' }]], resize_keyboard: true };

// ---------------------------------------------------------------- bog'lanishlar
async function holatOl() { const v = await SZ.ol(KALIT); return v && v.chats ? v : { chats: {} }; }
const ozgartir = fn => qulfBilan(KALIT, async () => { const h = JSON.parse(JSON.stringify(await holatOl())); const r = await fn(h); await SZ.yoz(KALIT, h, 'mijoz_bot'); return r; });
async function chatlar(mid) { const h = await holatOl(); return Object.keys(h.chats).filter(c => !h.chats[c].toxta && (h.chats[c].mids || []).indexOf(s(mid)) >= 0); }

// ---------------------------------------------------------------- ma'lumot (ko'zgudan)
async function malumot() {
  const [M2, S3, J3] = await Promise.all([V.qatorlar('02_Mijozlar'), V.qatorlar('03_Sotuv_shartnomalar'), V.qatorlar('03b_Tolov_jadvali')]);
  const MJ = {}, JD = {};
  M2.forEach(({ x }) => { const id = s(x[0]); if (!id) return; MJ[id] = { id, fish: s(x[2]), tel: [telNorm(x[4]), telNorm(x[5])].filter(t => t.length === 9) }; });
  J3.forEach(({ x }) => { const no = s(x[1]), sana = V.iso(x[3]); if (!no || !sana) return; (JD[no] = JD[no] || []).push({ sana, summa: V.son(x[4]), kum: V.son(x[5]) }); });
  Object.keys(JD).forEach(no => JD[no].sort((a, b) => a.sana < b.sana ? -1 : a.sana > b.sana ? 1 : a.kum - b.kum));
  const SH = [];
  S3.forEach(({ x }) => { const no = s(x[0]); if (!/^27\/\d+$/.test(no) || /bekor/i.test(s(x[13]))) return;
    SH.push({ no, mid: s(x[4]), dokon: s(x[5]), tolangan: V.son(x[27]), asosiy: V.son(x[28]), qoshimcha: V.son(x[29]), jami: V.son(x[30]), muddati: V.son(x[31]), jadval: JD[no] || [] }); });
  return { MJ, SH };
}
// jadvaldagi hali to'lanmagan qator: kumulyativ > jami to'langan + 1000 (03 AG formulasi bilan bir xil chegara); summa — qolgan qismi
function tolanmagan(sh, shart) {
  for (const j of sh.jadval) { if (!(j.kum > sh.tolangan + 1000) || !shart(j)) continue;
    return { sana: j.sana, summa: Math.max(0, Math.min(j.summa, j.kum - sh.tolangan, sh.asosiy > 0 ? sh.asosiy : j.summa)) }; }
  return null;
}
const keyingi = (sh, bugun) => tolanmagan(sh, j => j.sana > bugun);
const jadvalOxiri = sh => sh.jadval.length ? sh.jadval[sh.jadval.length - 1].sana : '';

// ---------------------------------------------------------------- matnlar (kirill — hujjatlardagidek)
function qarzQatorlar(sh, bugun) {
  if (!(sh.jami > 0)) return ['✅ Қарзингиз тўлиқ ёпилган.'];
  const L = [];
  if (sh.asosiy > 0 || !(sh.qoshimcha > 0)) L.push('Асосий қарз: ' + pul(sh.asosiy) + ' сўм');
  if (sh.muddati > 1000) L.push('шундан муддати ўтган: ' + pul(sh.muddati) + ' сўм');
  if (sh.qoshimcha > 0) L.push('Қўшимча майдон учун қарз: ' + pul(sh.qoshimcha) + ' сўм');
  L.push('<b>Жами қарздорлик: ' + pul(sh.jami) + ' сўм</b>');
  const k = keyingi(sh, bugun), jo = jadvalOxiri(sh);
  if (k && k.summa > 0) L.push('', '📅 Кейинги тўлов: ' + dmy(k.sana) + ' — ' + pul(k.summa) + ' сўм');
  else if (jo && jo <= bugun) L.push('', '📅 Тўлов жадвали ' + dmy(jo) + ' да тугаган — қарзни тўлашингизни сўраймиз.');
  if (jo && jo > bugun) L.push('Жадвал тугаши: ' + dmy(jo));
  return L;
}
const sarlavha = sh => '📄 ' + esc(sh.no) + '-сонли шартнома' + (sh.dokon ? ' (дўкон ' + esc(sh.dokon) + ')' : '');
const IMZO = '\n\nСаволлар бўйича: ' + OFIS_TEL + '\n«ANGOR KARVON SAROY» МЧЖ';
const SHAKL = { Naqt: 'нақд', Bank: 'банк орқали', Plastik: 'пластик карта орқали', Barter: 'ўзаро ҳисоб-китоб' };
function tolovMatn(fish, sh, t, bugun) {
  return '✅ <b>Тўловингиз қабул қилинди</b>\n\nҲурматли ' + esc(xatKirill(fish)) + '!\n' + esc(t.sana) + ' куни ' + esc(sh.no) + '-сонли шартнома' + (sh.dokon ? ' (дўкон ' + esc(sh.dokon) + ')' : '')
    + ' бўйича <b>' + pul(t.summa) + ' сўм</b> қабул қилинди' + (SHAKL[t.shakl] ? ' (' + SHAKL[t.shakl] + ')' : '') + '.\n\n📊 ' + dmy(bugun) + ' ҳолатига:\n'
    + (sh.jami > 0 ? qarzQatorlar(sh, bugun).join('\n') : '🎉 <b>Қарзингиз тўлиқ ёпилди.</b> Ҳамкорлигингиз учун раҳмат!') + IMZO;
}
function holatMatn(fish, L, bugun) {
  if (!L.length) return 'Ҳурматли ' + esc(xatKirill(fish)) + '!\nСизнинг номингизда амалдаги шартнома топилмади.' + IMZO;
  return 'Ҳурматли ' + esc(xatKirill(fish)) + '!\n📊 ' + dmy(bugun) + ' ҳолатига:\n\n' + L.map(sh => sarlavha(sh) + '\n' + qarzQatorlar(sh, bugun).join('\n')).join('\n\n') + IMZO;
}
const qachon = n => n === 0 ? 'бугун' : n === 1 ? 'эртага' : n + ' кундан кейин';
function eslatmaMatn(fish, sh, e) {
  const bosh = 'Ҳурматли ' + esc(xatKirill(fish)) + '!\n' + sarlavha(sh) + '\n\n';
  if (e.tur === 'hafta') return '⚠️ <b>Муддати ўтган қарз ҳақида эслатма</b>\n\n' + bosh + 'Муддати ўтган қарз: <b>' + pul(sh.muddati) + ' сўм</b>\nЖами қарздорлик: ' + pul(sh.jami) + ' сўм\n\n'
    + 'Қарзни имкон қадар тезроқ тўлашингизни сўраймиз. Тўлаб бўлган бўлсангиз — узр, ушбу хабарни эътиборсиз қолдиринг.' + IMZO;
  const avval = Math.max(0, sh.muddati - (e.kun === 0 ? e.summa : 0));   // to'lov kuni jadval qatori 03 AF «muddati o'tgan» ga kirib bo'lgan
  return '📅 <b>Тўлов эслатмаси</b>\n\n' + bosh + 'Навбатдаги тўлов: <b>' + dmy(e.sana) + '</b> (' + qachon(e.kun) + ') — <b>' + pul(e.summa) + ' сўм</b>'
    + (avval > 1000 ? '\nАввалги муддати ўтган қарз: ' + pul(avval) + ' сўм' : '') + '\nЖами қарздорлик: ' + pul(sh.jami) + ' сўм' + IMZO;
}

// ---------------------------------------------------------------- 💵 to'lov kiritilganda (api/kassa.js tolovSaqlash — kutmasdan chaqiradi)
// t: { no, summa, sana (dd.mm.yyyy), shakl, yangi: { asosiy, qoshimcha, qarz, muddati } | null } — yangi: Google'dan hozirgina o'qilgan qarz
async function tolovXabar(t) {
  if (!M.bor()) return { yuborildi: 0, sabab: 'kalit yo\'q' };
  const { MJ, SH } = await M.malumot(); const sh = SH.find(x => x.no === s(t.no)); if (!sh) return { yuborildi: 0, sabab: 'shartnoma yo\'q yoki bekor' };
  if (t.yangi && t.yangi.qarz != null) { const y = t.yangi; sh.jami = Number(y.qarz) || 0; sh.muddati = Number(y.muddati) || 0;
    if (y.asosiy != null) { sh.tolangan += Math.max(0, sh.asosiy - Number(y.asosiy)); sh.asosiy = Number(y.asosiy) || 0; } if (y.qoshimcha != null) sh.qoshimcha = Number(y.qoshimcha) || 0; }
  const C = await M.chatlar(sh.mid); if (!C.length) return { yuborildi: 0, sabab: 'mijoz botga ulanmagan' };
  const matn = tolovMatn((MJ[sh.mid] || {}).fish || '', sh, t, V.bugun()); let n = 0;
  for (const c of C) { try { await M.yubor(c, matn); n++; } catch (e) { await bloklandi(c, e); } }
  return { yuborildi: n };
}
async function bloklandi(chat, e) {   // mijoz botni to'xtatgan/bloklagan — qayta-qayta urinmaymiz (o'zi /start bossa tiklanadi)
  if (!/blocked|deactivated|chat not found/i.test(s(e && e.message))) { console.error('mijoz bot:', e && e.message); return; }
  await ozgartir(h => { if (h.chats[chat]) h.chats[chat].toxta = true; }).catch(() => {});
}

// ---------------------------------------------------------------- ⏰ eslatmalar (lib/vaqt.js mijoz_eslatma — har kuni 10:00)
// Yakshanba — yo'q. Shanba kuni yakshanbaga to'g'ri keladigan eslatmalar ham yuboriladi (to'lov kuni yakshanba → «эртага»; 3 kun oldin → «4 кундан кейин»).
// Bitta shartnomaga kuniga ko'pi bilan bitta xabar: to'lov kuni > 3 kun oldin > haftalik (dushanba, muddati o'tgan). Pul qaytarilayotgan shartnoma — yo'q.
async function eslatmaRoyxat(bugun) {
  const hk = new Date(bugun + 'T00:00:00Z').getUTCDay(); if (hk === 0) return [];
  const { MJ, SH } = await M.malumot(); const h = await holatOl();
  const ulangan = {}; Object.keys(h.chats).forEach(c => { if (!h.chats[c].toxta) (h.chats[c].mids || []).forEach(m => { (ulangan[m] = ulangan[m] || []).push(c); }); });
  const QB = {}; (await require('./qaytarish_blok').ochiqQarorlar()).forEach(x => { QB[x.no] = 1; });
  const kunlar = hk === 6 ? [0, 1, 3, 4] : [0, 3], L = [];
  SH.forEach(sh => { const C = ulangan[sh.mid]; if (!C || !(sh.jami > 1000) || QB[sh.no]) return;
    let e = null;
    for (const n of kunlar) { const d = kunQosh(bugun, n), j = tolanmagan(sh, x => x.sana === d); if (j && j.summa > 1000) { e = { tur: n <= 1 ? 'kun' : 'oldin', kun: n, sana: j.sana, summa: j.summa }; break; } }
    if (!e && hk === 1 && sh.muddati > 1000) e = { tur: 'hafta', kun: 0, sana: bugun, summa: sh.muddati };
    if (e) C.forEach(chat => L.push({ chat, sh, e, fish: (MJ[sh.mid] || {}).fish || '' })); });
  return L;
}
async function eslatma(kod, opt) {
  if (!M.bor()) return { yuborildi: 0, sabab: 'kalit yo\'q' };
  const bugun = (opt && opt.bugun) || V.bugun(), L = await eslatmaRoyxat(bugun); let n = 0, takror = 0, xato = 0;
  if (opt && opt.quruq) return { quruq: true, soni: L.length, royxat: L.map(x => x.sh.no + ' ' + x.e.tur + ' ' + x.e.sana) };
  for (const x of L) {
    const k = 'mb:esl:' + x.chat + ':' + x.sh.no + ':' + x.e.tur + ':' + x.e.sana;
    if (!(await redis.set(k, '1', 'EX', 10 * 86400, 'NX'))) { takror++; continue; }   // server qayta yoqilsa ham ikki marta ketmaydi
    try { await M.yubor(x.chat, eslatmaMatn(x.fish, x.sh, x.e)); n++; } catch (e) { xato++; await redis.del(k).catch(() => {}); await bloklandi(x.chat, e); }
    await uxla(60);
  }
  return { yuborildi: n, takror, xato };
}

// ---------------------------------------------------------------- 📥 mijozdan kelgan xabar
async function ishlov(z) {
  const m = z.message; if (!m || !m.chat || m.chat.type !== 'private') return { tur: 'boshqa' };
  const chat = s(m.chat.id), matn = s(m.text), bugun = V.bugun();
  if (m.contact) {
    if (s(m.contact.user_id) !== s(m.from && m.from.id)) { await M.yubor(chat, 'Илтимос, бошқа одамнинг эмас, <b>ўз рақамингизни</b> пастдаги тугма орқали юборинг.', KL_RAQAM); return { tur: 'kontakt', natija: 'begona raqam' }; }
    const tel = telNorm(m.contact.phone_number), { MJ, SH } = await M.malumot();
    const mos = Object.keys(MJ).filter(id => MJ[id].tel.indexOf(tel) >= 0 && SH.some(x => x.mid === id));
    if (tel.length !== 9 || !mos.length) {
      await M.yubor(chat, 'Бу рақам (' + esc(telFmt(tel)) + ') амалдаги шартномаларимизда топилмади.\n\nШартномада бошқа телефон рақами кўрсатилган бўлиши мумкин. Рақамни янгилаш учун офисга мурожаат қилинг: ' + OFIS_TEL, KL_RAQAM);
      return { tur: 'kontakt', natija: 'topilmadi', tel: telFmt(tel) };
    }
    await ozgartir(h => { h.chats[chat] = { tel, mids: mos, vaqt: new Date().toISOString(), ism: s([m.from.first_name, m.from.last_name].filter(Boolean).join(' ')).slice(0, 60) }; });
    const fish = MJ[mos[0]].fish;
    await M.yubor(chat, '✅ <b>Уландингиз.</b>\n\nЭнди тўловингиз қабул қилинганда ва тўлов муддати яқинлашганда шу ерга хабар келади. Қарзингизни исталган вақт «📊 Қарзим» тугмаси орқали кўришингиз мумкин.\nХабарларни тўхтатиш: /stop', KL_ASOSIY);
    await M.yubor(chat, holatMatn(fish, SH.filter(x => mos.indexOf(x.mid) >= 0), bugun), KL_ASOSIY);
    return { tur: 'kontakt', natija: 'ulandi', mids: mos };
  }
  const h = await holatOl(), u = h.chats[chat];
  if (/^\/stop/.test(matn)) {
    if (u) await ozgartir(x => { delete x.chats[chat]; });
    await M.yubor(chat, 'Хабарлар тўхтатилди. Қайта улаш учун /start ни босинг.', { remove_keyboard: true }); return { tur: '/stop' };
  }
  if (u && !u.toxta && (/Қарзим|qarz/i.test(matn) || /^\/start/.test(matn))) {
    const { MJ, SH } = await M.malumot(); const fish = (MJ[u.mids[0]] || {}).fish || '';
    await M.yubor(chat, holatMatn(fish, SH.filter(x => u.mids.indexOf(x.mid) >= 0), bugun), KL_ASOSIY); return { tur: 'qarzim' };
  }
  if (u && !u.toxta) { await M.yubor(chat, 'Қарзингизни кўриш учун «📊 Қарзим» тугмасини босинг.\nБошқа саволлар бўйича: ' + OFIS_TEL, KL_ASOSIY); return { tur: 'matn' }; }
  await M.yubor(chat, 'Ассалому алайкум! «ANGOR KARVON SAROY» МЧЖнинг мижозлар учун хабарнома ботига хуш келибсиз.\n\nТўловларингиз ва қарздорлигингиз ҳақида хабар олиб туриш учун пастдаги <b>«📱 Рақамни юбориш»</b> тугмасини босинг. '
    + 'Рақамингиз шартномадаги телефон рақами билан солиштирилади.', KL_RAQAM);
  return { tur: '/start' };
}

// ---------------------------------------------------------------- 📡 o'qish (getUpdates — xodimlar botidagidek, alohida offset: Redis mb_offset)
let yurmoqda = false, konflikt = 0;
async function birAylanish() {
  const off = Number(await redis.get('mb_offset')) || 0; const tana = { timeout: 25, allowed_updates: ['message'] }; if (off) tana.offset = off;
  await redis.set('mb_poll:tirik', String(Date.now()), 'EX', 600).catch(() => {});
  let R;
  try { R = await M.api('getUpdates', tana, { jurnalsiz: true, muddat: 40000, urinishsiz: true }); konflikt = 0; await redis.del('mb_poll:xato').catch(() => {}); }
  catch (e) { await redis.set('mb_poll:xato', new Date().toISOString() + ' ' + s(e.message).slice(0, 200), 'EX', 3600).catch(() => {});
    if (konflikt++ % 20 === 0) console.error(new Date().toISOString(), 'mijoz bot poll:', e.message); await uxla(/Conflict/i.test(e.message) ? 60000 : 15000); return; }
  for (const z of R || []) {
    await redis.set('mb_offset', String(z.update_id + 1)); const t0 = Date.now(); let n;
    try { n = await M.ishlov(z); } catch (e) { n = { tur: 'xato', natija: e.message }; console.error(new Date().toISOString(), 'mijoz bot:', e.message);
      q('INSERT INTO rpc_jurnal (fn, qayerda, ms, ok, xato) VALUES ($1,$2,$3,$4,$5)', ['mijoz_bot', 'tg', Date.now() - t0, false, s(e.message).slice(0, 300)]).catch(() => {}); }
    await redis.lpush('mb_jurnal', JSON.stringify(Object.assign({ vaqt: new Date().toISOString() }, n || {}))).then(() => redis.ltrim('mb_jurnal', 0, 199)).catch(() => {});
  }
}
function boshla() { if (yurmoqda) return; yurmoqda = true;
  (async () => { for (;;) { try { if (!M.bor()) { await uxla(30000); continue; } await birAylanish(); } catch (e) { console.error(new Date().toISOString(), 'mijoz bot sikl:', e.message); await uxla(15000); } } })(); }

// ---------------------------------------------------------------- holat (aks-mijoz-bot, Tizim holati)
async function holat() {
  const h = await holatOl().catch(() => ({ chats: {} })); const C = Object.keys(h.chats);
  const [tirik, xato] = await Promise.all([redis.get('mb_poll:tirik'), redis.get('mb_poll:xato')]).catch(() => [null, null]);
  const mids = {}; C.forEach(c => { if (!h.chats[c].toxta) (h.chats[c].mids || []).forEach(m => { mids[m] = 1; }); });
  return { bor: M.bor(), ulangan: C.filter(c => !h.chats[c].toxta).length, toxtagan: C.filter(c => h.chats[c].toxta).length, mijozlar: Object.keys(mids).length, tirik: tirik ? Number(tirik) : 0, xato: xato || '' };
}

Object.assign(M, { token, bor, api, yubor, malumot, chatlar, tolovXabar, eslatma, eslatmaRoyxat, ishlov, boshla, birAylanish, holat,
  _ichki: { tolanmagan, keyingi, qarzQatorlar, tolovMatn, holatMatn, eslatmaMatn, holatOl, telNorm, KALIT } });
module.exports = M;
