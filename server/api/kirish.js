// AKS TIZIM — 📱 KIRISH: TELEFON RAQAM + PAROL (direktor qarori 01.11.2026).
//
// Direktor ko'rsatmasi: «parolni hech qanday shartsiz qilish kerak — xohlasa 1 ni qo'ysin, xohlasa qiyin parol qo'ysin;
// faqat parolni unutganda ikkitadan biri Telegramiga, ikkinchisi Gmail elektron pochtasiga yuborilsin (SMS pullik, Gmail tekin)».
//
// Shunday bo'lgach, parol endi odamni TANIY OLMAYDI (ikki xodimda bir xil «1» bo'lishi mumkin) — odamni TELEFON RAQAMI taniydi.
//   • Parolning o'zi saqlanmaydi — faqat izi (scrypt, har xodimga alohida tuz), server bazasida (xodim_kirish), Google'da emas.
//   • Parol klaviatura tiliga bog'liq emas: kirill klaviaturada terilgan «ыфдщь» lotindagi «salom» bilan bir xil (tugmalar
//     o'rni bo'yicha), katta-kichik harf farqi yo'q, boshi-oxiridagi bo'sh joy olib tashlanadi. Avval eng ko'p chiqqan
//     «parolim xato deydi» muammosi shundan edi — klaviatura kirillda qolardi.
//   • Qo'riqchi: bitta raqamga 10 marta noto'g'ri → 15 daqiqa qulf, egasi va direktorga Telegram; bitta IP dan 15 daqiqada 20 xato.
//   • 07_Xodimlar L (kirish kodi) — endi qurilmada saqlanadigan uzun tasodifiy kalit (?k=…). Kirgach brauzer uni eslab qoladi.
//   • «Parolimni unutdim» → 24 soatlik vaqtinchalik parol (6 raqam) Telegram va Gmail'ga. Eski parol ham ishlayveradi
//     (begona odam boshqaning raqamini yozib uni qulflab qo'ya olmasin). Vaqtinchalik bilan kirgach — o'z parolini qo'yadi.
//   • Direktor: Huquqlar → xodim → «Parolni tiklash» (Telegram/Gmail bo'lmasa — og'zaki aytadi), Gmail'ni yozish.
'use strict';
const crypto = require('crypto');
const S = require('./sessiya');
const { q, redis } = require('../lib/db');
const TK = require('../lib/tg_kirish');
const TG = require('../lib/telegram');
const P = require('../lib/pochta');

const s = v => String(v == null ? '' : v);
const KOD_L = 12;                         // 07_Xodimlar L (1 dan)
const TOKEN_UZ = 20;                      // yangi kirish kaliti uzunligi
const IP_MAX = 20, TEL_MAX = 10, QULF_SEK = 900;
const VAQT_SEK = 24 * 3600;               // vaqtinchalik parol muddati
const esc = v => s(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// ---------------------------------------------------------------- parolni bir xil ko'rinishga keltirish
// Rus (ЙЦУКЕН) klaviaturasidagi harf → o'sha tugmadagi lotin belgi. O'zbek kirill klaviaturasidagi ў (o tugmasi), қ (s tugmasi) ham.
const KLAV = { 'й': 'q', 'ц': 'w', 'у': 'e', 'к': 'r', 'е': 't', 'н': 'y', 'г': 'u', 'ш': 'i', 'щ': 'o', 'з': 'p', 'х': '[', 'ъ': ']',
  'ф': 'a', 'ы': 's', 'в': 'd', 'а': 'f', 'п': 'g', 'р': 'h', 'о': 'j', 'л': 'k', 'д': 'l', 'ж': ';', 'э': '\'',
  'я': 'z', 'ч': 'x', 'с': 'c', 'м': 'v', 'и': 'b', 'т': 'n', 'ь': 'm', 'б': ',', 'ю': '.', 'ё': '`', 'ў': 'o', 'қ': 's' };
function parolNorm(p) {
  const t = s(p).trim().toLowerCase().replace(/[ʻʼ‘’]/g, '\'');
  let r = ''; for (const ch of t) r += KLAV[ch] || ch;
  return r;
}

// ---------------------------------------------------------------- iz (scrypt)
const SC = { N: 16384, r: 8, p: 1 };
const scrypt = (p, tuz) => new Promise((ok, yoq) => crypto.scrypt(p, tuz, 32, SC, (e, k) => e ? yoq(e) : ok(k)));
async function izYasa(norm) { const tuz = crypto.randomBytes(16); return 's1$' + tuz.toString('hex') + '$' + (await scrypt(norm, tuz)).toString('hex'); }
async function izTekshir(iz, norm) {
  const m = /^s1\$([0-9a-f]{32})\$([0-9a-f]{64})$/.exec(s(iz)); if (!m) return false;
  const k = await scrypt(norm, Buffer.from(m[1], 'hex'));
  return crypto.timingSafeEqual(k, Buffer.from(m[2], 'hex'));
}

// ---------------------------------------------------------------- xodim_kirish jadvali
async function qatorOl(id) { return (await q('SELECT * FROM xodim_kirish WHERE kompaniya_id = 1 AND xodim_id = $1', [s(id)])).rows[0] || null; }
async function izSaqla(id, norm) {
  await q(`INSERT INTO xodim_kirish (kompaniya_id, xodim_id, parol_iz, parol_vaqt) VALUES (1, $1, $2, now())
           ON CONFLICT (kompaniya_id, xodim_id) DO UPDATE SET parol_iz = EXCLUDED.parol_iz, parol_vaqt = now()`, [s(id), await izYasa(norm)]);
}
async function gmailSaqla(id, gmail, kim) {
  await q(`INSERT INTO xodim_kirish (kompaniya_id, xodim_id, gmail, gmail_vaqt, gmail_kim) VALUES (1, $1, $2, now(), $3)
           ON CONFLICT (kompaniya_id, xodim_id) DO UPDATE SET gmail = EXCLUDED.gmail, gmail_vaqt = now(), gmail_kim = EXCLUDED.gmail_kim`,
    [s(id), gmail || null, kim]);
}

// ---------------------------------------------------------------- xodimlar
const XS = `xodim_id, fish, tel_raqam, holat, huquqlar, kirish_kodi, telegram_id, qator_no`;
const xod = r => ({ id: s(r.xodim_id), fish: s(r.fish), ism: s(r.fish).split(/\s+/)[1] || s(r.fish), kod: s(r.kirish_kodi).trim(),
  qator: Number(r.qator_no), tg: s(r.telegram_id).trim().replace(/\.0+$/, ''), tel: TK.telNorm(r.tel_raqam) });
const faol = r => r.holat === 'Ishlayapti' && r.huquqlar && r.huquqlar.length;
async function telXodimlar(t) {   // telefon (9 raqam) → shu raqamli ishlayotgan xodimlar (odatda bitta)
  return (await q(`SELECT ${XS} FROM v_xodimlar WHERE right(tel_raqam, 9) = $1`, [t])).rows.filter(faol).map(xod);
}
async function idXodim(id) {
  const r = (await q(`SELECT ${XS} FROM v_xodimlar WHERE xodim_id = $1 LIMIT 1`, [s(id)])).rows[0];
  return r ? Object.assign(xod(r), { faol: !!faol(r) }) : null;
}
async function tgId(x) { return x.tg || (x.kod ? await redis.get('tg_ulandi:' + x.kod) : '') || ''; }

// kirish kaliti: L kuchsiz (xodim o'zi qo'ygan eski parol) yoki bo'sh bo'lsa — yangisi yasalib L ga yoziladi
async function kalitYangila(x) {
  const yangi = await TK.kodYangi(TOKEN_UZ);
  await TK.xodim07Yoz({ kod: x.kod, qator: x.qator }, KOD_L, yangi);   // qator Google'dan L bo'yicha tekshiriladi
  const y = await TK.kodKut(yangi, 30);
  if (!y) throw new S.Xato('Kirish tayyorlanmoqda — 1 daqiqadan keyin yana bir marta «Kirish» ni bosing.');
  return yangi;
}
async function kalitTayyor(x) { return S.kodToken(x.kod) ? x.kod : kalitYangila(x); }

// ---------------------------------------------------------------- xabar yuborish (Telegram + Gmail)
async function xabarla(x, tgMatn, mavzu, pochtaMatn, kod) {
  const ket = [];
  const tg = await tgId(x);
  if (tg) { try { await TG.chat(tg, tgMatn); ket.push('Telegram'); } catch (e) { console.error('kirish tg:', e.message); } }
  const r = await qatorOl(x.id);
  if (r && r.gmail && P.bor()) { try { await P.yubor(r.gmail, mavzu, pochtaMatn, kod); ket.push('Gmail (' + P.yashir(r.gmail) + ')'); } catch (e) { console.error('kirish pochta:', e.message); } }
  return ket;
}
const vaqtParol = () => String(crypto.randomInt(0, 1000000)).padStart(6, '0');
function vaqtMatn(x, p) {
  return {
    tg: '🔑 <b>AKS TIZIM</b> — ' + esc(x.ism) + ', vaqtinchalik parolingiz:\n\n<code>' + p + '</code>\n\n'
      + 'Kirish: telefon raqamingiz + shu parol. <b>24 soat</b> amal qiladi; kirgach o\'zingizga yangi parol qo\'yasiz.\n'
      + 'Agar buni siz so\'ramagan bo\'lsangiz — e\'tibor bermang, eski parolingiz ham ishlayveradi.',
    mavzu: 'AKS TIZIM — vaqtinchalik parol',
    pochta: x.ism + ', AKS TIZIM uchun vaqtinchalik parolingiz:\n\n' + p + '\n\n'
      + 'Kirish: https://aks-tizim.uz — telefon raqamingiz va shu parol. 24 soat amal qiladi; kirgach o\'zingizga yangi parol qo\'yasiz.\n'
      + 'Agar buni siz so\'ramagan bo\'lsangiz — e\'tibor bermang, eski parolingiz ham ishlayveradi.',
  };
}

// ================================================================== /api/kirish — telefon + parol
async function kirishTel(b, ip) {
  b = b || {};
  const ipk = 'kirx:' + s(ip).slice(0, 45);
  if (Number(await redis.get(ipk)) >= IP_MAX) throw new S.Xato('Juda ko\'p noto\'g\'ri urinish. 15 daqiqadan keyin qayta urinib ko\'ring.');
  const t = TK.telNorm(b.tel);
  if (t.length !== 9) throw new S.Xato('Telefon raqamingizni to\'liq yozing — 9 ta raqam (masalan 90 123 45 67).');
  const p = parolNorm(b.parol);
  if (!p) throw new S.Xato('Parolni yozing.');
  if (p.length > 100) throw new S.Xato('Parol juda uzun.');
  const qolgan = await redis.ttl('telblok:' + t);
  if (qolgan > 0) throw new S.Xato('Bu raqam bilan kirish ' + Math.ceil(qolgan / 60) + ' daqiqaga yopilgan (ko\'p noto\'g\'ri urinish). Keyinroq urinib ko\'ring.');

  const X = await telXodimlar(t);
  let top = null, yol = '';
  for (const x of X) {
    const r = await qatorOl(x.id);
    if (r && r.parol_iz && await izTekshir(r.parol_iz, p)) { top = x; yol = 'parol'; break; }
    const tmp = await redis.get('parol_tmp:' + x.id);
    if (tmp && await izTekshir(tmp, p)) { top = x; yol = 'vaqt'; break; }
    // o'tish davri: o'z parolini hali yangi tartibda saqlamagan xodim — L dagi eski parol (yoki botdan olgan kodi) bilan
    if (!(r && r.parol_iz) && x.kod && (S.kodNorm(p) === S.kodNorm(x.kod) || S.kodNorm(b.parol) === S.kodNorm(x.kod))) { top = x; yol = 'eski'; break; }
  }

  if (!top) {
    const n = await redis.incr(ipk); if (n === 1) await redis.expire(ipk, QULF_SEK);
    const m = await redis.incr('telx:' + t); if (m === 1) await redis.expire('telx:' + t, QULF_SEK);
    if (m >= TEL_MAX && X.length) {
      await redis.set('telblok:' + t, '1', 'EX', QULF_SEK); await redis.del('telx:' + t);
      for (const x of X) {
        const xm = '⚠️ <b>AKS TIZIM</b>: <b>' + esc(x.fish) + '</b> raqami bilan ' + TEL_MAX + ' marta noto\'g\'ri parol terildi. Kirish 15 daqiqaga yopildi.';
        xabarla(x, xm + '\nAgar bu siz bo\'lmasangiz — darhol direktorga ayting.', 'AKS TIZIM — kirishga urinish',
          'AKS TIZIM: raqamingiz bilan ' + TEL_MAX + ' marta noto\'g\'ri parol terildi. Kirish 15 daqiqaga yopildi.\nAgar bu siz bo\'lmasangiz — darhol direktorga ayting.').catch(() => {});
        TG.direktor(xm).catch(() => {});
      }
      throw new S.Xato(TEL_MAX + ' marta noto\'g\'ri. Bu raqam bilan kirish 15 daqiqaga yopildi.');
    }
    const qoldi = TEL_MAX - m;
    throw new S.Xato('Telefon raqam yoki parol noto\'g\'ri.' + (X.length && qoldi <= 3 ? ' Yana ' + qoldi + ' ta urinish qoldi.' : ''));
  }

  await redis.del(ipk, 'telx:' + t);
  const kod = await kalitTayyor(top);
  if (yol === 'eski') await izSaqla(top.id, p);   // shu parol endi yangi tartibda saqlanadi — keyin ham shu bilan kiradi
  if (yol === 'vaqt') {
    await redis.del('parol_tmp:' + top.id);
    await redis.set('parol_vaqt:' + kod, '1', 'EX', 7 * 86400);   // kirgach — «Doimiy parolingizni qo'ying» oynasi (kirishOch)
  }
  return { ok: true, k: kod };
}

// ================================================================== /api/unutdim — vaqtinchalik parol Telegram + Gmail'ga
async function unutdim(b, ip) {
  b = b || {};
  const ipk = 'unx:' + s(ip).slice(0, 45);
  const n = await redis.incr(ipk); if (n === 1) await redis.expire(ipk, 3600);
  if (n > 10) throw new S.Xato('Juda ko\'p so\'rov. 1 soatdan keyin qayta urinib ko\'ring.');
  const t = TK.telNorm(b.tel);
  if (t.length !== 9) throw new S.Xato('Telefon raqamingizni to\'liq yozing — 9 ta raqam (masalan 90 123 45 67).');
  const X = await telXodimlar(t);
  if (!X.length) throw new S.Xato('Bu raqam bilan ishlayotgan xodim topilmadi. Raqamni tekshiring yoki direktorga murojaat qiling.');
  const tk = 'uns:' + t;
  if (Number(await redis.get(tk)) >= 3) throw new S.Xato('Vaqtinchalik parol yaqinda yuborilgan. Telegram va pochtangizni tekshiring yoki 1 soatdan keyin qayta so\'rang.');
  const ketdi = [];
  for (const x of X) {
    const p = vaqtParol(), M = vaqtMatn(x, p);
    await redis.set('parol_tmp:' + x.id, await izYasa(p), 'EX', VAQT_SEK);
    const ket = await xabarla(x, M.tg, M.mavzu, M.pochta, p);
    if (!ket.length) { await redis.del('parol_tmp:' + x.id); continue; }
    ket.forEach(k => { if (ketdi.indexOf(k) < 0) ketdi.push(k); });
    TG.direktor('🔑 <b>' + esc(x.fish) + '</b> «Parolimni unutdim» orqali vaqtinchalik parol oldi (' + ket.join(', ') + ').').catch(() => {});
  }
  if (!ketdi.length) throw new S.Xato('Sizda Telegram ham, Gmail ham ulanmagan — parolni yuborishning iloji yo\'q. Direktorga murojaat qiling: u parolingizni tiklab beradi.');
  const m = await redis.incr(tk); if (m === 1) await redis.expire(tk, 3600);
  return { ok: true, kanallar: ketdi };
}

// ================================================================== ilova ichidagi amallar (RPC)
const R = {};

// ✉ o'z Gmail manzili
R.gmailHolat = async ([kodSes]) => {
  const u = await S.ruxsat(kodSes); const r = await qatorOl(u.id);
  return { gmail: (r && r.gmail) || '', pochta: P.bor() };
};
R.gmailKodYubor = async ([kodSes, gmail]) => {
  const u = await S.ruxsat(kodSes);
  if (!P.bor()) throw new S.Xato('Pochta xizmati hali sozlanmagan — direktorga ayting.');
  const g = s(gmail).trim().toLowerCase();
  if (!P.togri(g)) throw new S.Xato('Pochta manzili noto\'g\'ri. Masalan: ism.familiya@gmail.com');
  const sk = 'gmk_s:' + u.id; const n = await redis.incr(sk); if (n === 1) await redis.expire(sk, 3600);
  if (n > 5) throw new S.Xato('Juda ko\'p urinish. 1 soatdan keyin qayta urinib ko\'ring.');
  const kod = vaqtParol();
  await redis.set('gmk:' + u.id, JSON.stringify({ g, iz: crypto.createHash('sha256').update(kod).digest('hex') }), 'EX', 900);
  await redis.del('gmk_x:' + u.id);
  try {
    await P.yubor(g, 'AKS TIZIM — pochtani tasdiqlash kodi', u.ism + ', AKS TIZIMda pochtangizni tasdiqlash kodi:\n\n' + kod + '\n\n'
      + 'Kodni ilovadagi «✉ Gmail manzilim» oynasiga yozing. Kod 15 daqiqa amal qiladi.\nAgar buni siz so\'ramagan bo\'lsangiz — e\'tibor bermang.', kod);
  } catch (e) { console.error('gmailKodYubor:', e.message); throw new S.Xato('Xat yuborilmadi. Manzilni tekshiring yoki birozdan keyin qayta urinib ko\'ring.'); }
  return { ok: true, gmail: P.yashir(g) };
};
R.gmailTasdiq = async ([kodSes, kod]) => {
  const u = await S.ruxsat(kodSes);
  const j = JSON.parse((await redis.get('gmk:' + u.id)) || 'null');
  if (!j) throw new S.Xato('Kod eskirgan. «Kod yuborish» ni qayta bosing.');
  const xk = 'gmk_x:' + u.id; const n = await redis.incr(xk); if (n === 1) await redis.expire(xk, 900);
  if (n > 5) { await redis.del('gmk:' + u.id); throw new S.Xato('Ko\'p noto\'g\'ri urinish. «Kod yuborish» ni qayta bosing.'); }
  if (crypto.createHash('sha256').update(s(kod).replace(/\D/g, '')).digest('hex') !== j.iz) throw new S.Xato('Kod noto\'g\'ri.');
  await gmailSaqla(u.id, j.g, 'o\'zi (tasdiqlangan)');
  await redis.del('gmk:' + u.id, xk);
  return { ok: true, gmail: j.g };
};

// 👔 direktor: xodimning Gmail manzilini yozish / o'chirish
R.xodimGmailYoz = async ([kodSes, id, gmail]) => {
  const u = await S.ruxsat(kodSes, 'admin'); if (!u.admin) throw new S.Xato('Faqat direktor uchun.');
  const x = await idXodim(id); if (!x) throw new S.Xato('Xodim topilmadi.');
  const g = s(gmail).trim().toLowerCase();
  if (g && !P.togri(g)) throw new S.Xato('Pochta manzili noto\'g\'ri. Masalan: ism.familiya@gmail.com');
  await gmailSaqla(x.id, g, u.fish);
  return { ok: true, gmail: g, natija: x.fish + ': ' + (g ? 'pochta ' + g + ' saqlandi.' : 'pochta o\'chirildi.') };
};

// 👔 direktor: xodimga vaqtinchalik parol (Telegram/Gmail'ga ketadi; ikkalasi ham bo'lmasa — direktor og'zaki aytadi)
R.parolTiklaDir = async ([kodSes, id]) => {
  const u = await S.ruxsat(kodSes, 'admin'); if (!u.admin) throw new S.Xato('Faqat direktor uchun.');
  const x = await idXodim(id); if (!x) throw new S.Xato('Xodim topilmadi.');
  if (!x.faol) throw new S.Xato('Xodim «Ishlayapti» emas yoki huquqi yo\'q — u baribir kira olmaydi.');
  if (!x.tel) throw new S.Xato('Xodimning telefon raqami yo\'q — avval «✏️ Ma\'lumotlarini o\'zgartirish» dan raqamini yozing (u telefon bilan kiradi).');
  const p = vaqtParol(), M = vaqtMatn(x, p);
  await redis.set('parol_tmp:' + x.id, await izYasa(p), 'EX', VAQT_SEK);
  const ket = await xabarla(x, M.tg, M.mavzu, M.pochta, p);
  try { await redis.lpush('huquq_jurnal', JSON.stringify({ vaqt: new Date(Date.now() + 5 * 3600e3).toISOString().slice(0, 16).replace('T', ' '), kim: u.fish, xodim: x.fish, id: x.id, qoshildi: ['vaqtinchalik parol berildi'], olindi: [], tahrir: true })); } catch (e) { }
  return { ok: true, parol: p, kanallar: ket, tel: x.tel };
};

module.exports = { kirishTel, unutdim, R, parolNorm, izYasa, izTekshir, izSaqla, qatorOl, kalitYangila, xabarla, _ichki: { telXodimlar, idXodim, KLAV } };
