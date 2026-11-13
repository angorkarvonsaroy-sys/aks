#!/usr/bin/env node
// AKS TIZIM — 🧪 TUTUN SINOVI (13.11.2026, direktor qarori): yangi kod o'rnatilishidan OLDIN xodimlar nomidan asosiy o'qish amallari
// chaqirib ko'riladi. Maqsad — «Cannot read properties of undefined» kabi DASTUR xatolarini (TypeError, ReferenceError, SyntaxError,
// RangeError) ishlab turgan tizimga tushmasdan ushlash. 13.11.2026 dagi «Bugungi ish» nosozligi aynan shunday xato edi.
//
// Ishlatish:  node sinov/tutun.js --ildiz <server kodi papkasi>      (deploy: bin/aks-tutun eski va yangi kodni solishtiradi)
// Natija:     oxirgi qatorda  TUTUN_JSON:{...}   — {yuklash:[], xato:[{fn, rol, tur, xabar, joy}], soni:{...}}
// Chiqish kodi: 0 — dastur xatosi topilmadi; 2 — topildi; boshqa — sinovning o'zi ishlamadi (deploy to'xtatilmaydi).
//
// ❗ HECH NARSA YOZILMAYDI va tashqariga chiqilmaydi:
//   • PostgreSQL — har ulanishda default_transaction_read_only = on (har qanday INSERT/UPDATE rad etiladi);
//   • Redis — yozuvchi buyruqlar bo'sh javob qaytaradi;  • fetch (Google, Telegram, ko'prik) — o'chirilgan;  • tashqi dastur (rclone, Chromium) — o'chirilgan.
// Shu sabab «yoza olmadim», «tarmoq yo'q», «ruxsat yo'q» kabi xatolar HISOBGA OLINMAYDI — faqat dastur xatolari sanaladi.
'use strict';
const path = require('path'), fs = require('fs'), vm = require('vm');
const arg = k => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : ''; };
const ILDIZ = path.resolve(arg('--ildiz') || path.join(__dirname, '..'));
const MUDDAT = Number(arg('--muddat') || 150) * 1000;       // butun sinov uchun
const AMAL_MUDDAT = 25000;                                   // bitta amal uchun
const DASTUR = ['TypeError', 'ReferenceError', 'SyntaxError', 'RangeError'];
const N = { yuklash: [], xato: [], soni: { fayl: 0, xodim: 0, amal: 0, otdi: 0, oddiy: 0 }, ildiz: ILDIZ };
const tugat = kod => { process.stdout.write('\nTUTUN_JSON:' + JSON.stringify(N) + '\n', () => process.exit(kod)); setTimeout(() => process.exit(kod), 1500).unref(); };
setTimeout(() => { N.muddat = true; console.log('tutun: umumiy muddat tugadi — bor natija bilan yakunlanadi'); tugat(N.yuklash.length || N.xato.length ? 2 : 0); }, MUDDAT).unref();
process.on('unhandledRejection', () => { });   // fonda qolgan va'dalar (yozuvga urinishlar) sinovni yiqitmasin
process.on('uncaughtException', e => { console.log('tutun: kutilmagan istisno (hisobga olinmaydi):', e && e.message); });

const joy = e => { const q = String((e && e.stack) || '').split('\n').slice(1).find(z => z.indexOf(ILDIZ) >= 0 && z.indexOf(path.join('sinov', 'tutun.js')) < 0) || '';
  const m = /\(?([^()\s]+):(\d+):\d+\)?\s*$/.exec(q.trim()); return m ? path.relative(ILDIZ, m[1]) + ':' + m[2] : ''; };
const dasturmi = e => !!e && DASTUR.indexOf(e.name) >= 0;

// ------------------------------------------------------------------ 1. har bir fayl: sintaksis
function sintaksis() {
  for (const p of ['api', 'lib', '.']) {   // '.' — ildizdagi fayllar (kozgu.js va b.)
    let L = []; try { L = fs.readdirSync(path.join(ILDIZ, p)).filter(f => /\.js$/.test(f)); } catch (e) { continue; }
    for (const f of L) { N.soni.fayl++;
      try { let src = fs.readFileSync(path.join(ILDIZ, p, f), 'utf8'); if (src.charCodeAt(0) === 0xFEFF) src = src.slice(1); src = src.replace(/^#!.*/, '');
        new vm.Script('(async function (exports, require, module, __filename, __dirname) {' + src + '\n})', { filename: path.join(p, f) }); }
      catch (e) { N.yuklash.push({ fn: p + '/' + f, tur: e.name, xabar: String(e.message).slice(0, 200), joy: p + '/' + f }); } }
  }
}

// ------------------------------------------------------------------ 2. himoya: hech narsa yozilmaydi
function himoya() {
  global.fetch = async () => { throw new Error('tutun: tarmoq o\'chirilgan'); };
  const cp = require('child_process'); ['spawn', 'exec', 'execFile', 'fork'].forEach(k => { cp[k] = () => { throw new Error('tutun: tashqi dastur o\'chirilgan'); }; });
  ['spawnSync', 'execSync', 'execFileSync'].forEach(k => { cp[k] = () => { throw new Error('tutun: tashqi dastur o\'chirilgan'); }; });
  // PostgreSQL: butun jarayon faqat o'qiydi (PGOPTIONS — pg kutubxonasi ulanishda yuboradi); amallar() boshida tekshiriladi
  process.env.PGOPTIONS = ((process.env.PGOPTIONS || '') + ' -c default_transaction_read_only=on').trim();
  const db = require(path.join(ILDIZ, 'lib', 'db.js'));
  const yozuvchi = ['set', 'setex', 'psetex', 'setnx', 'del', 'unlink', 'incr', 'incrby', 'decr', 'expire', 'pexpire', 'hset', 'hdel', 'hincrby', 'lpush', 'rpush', 'lpop', 'rpop', 'ltrim', 'sadd', 'srem',
    'zadd', 'zrem', 'append', 'getset', 'getdel', 'mset', 'publish', 'eval', 'evalsha', 'flushdb', 'flushall', 'rename', 'persist'];
  yozuvchi.forEach(k => { if (typeof db.redis[k] === 'function') db.redis[k] = async () => (k === 'set' || k === 'setnx' ? 'OK' : k === 'incr' || k === 'incrby' ? 1 : 0); });
  return db;
}

// ------------------------------------------------------------------ 3. xodimlar nomidan o'qish amallari
const HAMMA = ['xodimBosh', 'topMening'];
const ROL = {
  undiruv: ['qadamBoshlang', 'qadamNazorat', 'undBoshlang', 'ijroKorish', 'qadamYuristYol'],
  tolov: ['shartnomalar', 'bugungiTolovlar'],
  shartnoma: ['shartnomaBoshlang'],
  hujjat: ['hujjatBoshlang'],
  tashrif: ['bugungiTashriflarHammasi'],
  yurist: ['yuristBoshlang', 'tqRoyxat'],
  xat: ['xatBoshlang'],
  taminot: ['taminotBoshlang'],
  reyestr: ['reyestrIjara', 'reyestrSotuv'],
  devon: ['devonBoshlang'],
  hisobot: ['hisobotMalumot'],
  xarita: ['xaritaMalumot'],
  admin: ['monBoshlang', 'boshMalumot', 'topRoyxat', 'devonDirektor', 'kbDirektor', 'ijaraImzosizRoyxat', 'qadamJamoa', 'taminotDirektor', 'hisobotMalumot', 'huqRoyxat',
    'tasdiqRoyxat', 'tqRoyxat', 'shartnomalar', 'shartnomaBoshlang', 'xatBoshlang', 'yuristBoshlang', 'devonBoshlang', 'hujjatBoshlang', 'undBoshlang', 'bekorDirektor', 'topXodimlar'],
};
const muddatli = (p, ms, nom) => Promise.race([p, new Promise((_, r) => setTimeout(() => r(Object.assign(new Error('tutun: ' + nom + ' ' + ms / 1000 + ' s da javob bermadi'), { name: 'Muddat' })), ms).unref())]);

async function amallar() {
  let A, S, db;
  try { db = himoya(); S = require(path.join(ILDIZ, 'api', 'sessiya.js')); A = require(path.join(ILDIZ, 'api', 'amallar.js')); }
  catch (e) {
    // yangi tashqi kutubxona hali o'rnatilmagan (npm install deploy ichida keyinroq bo'ladi) — bu dastur xatosi emas, sinab bo'lmadi xolos
    if (e && e.code === 'MODULE_NOT_FOUND' && !/Cannot find module '(\.{1,2}\/|\/)/.test(String(e.message))) { N.kutubxona = String(e.message).split('\n')[0]; console.log('tutun: ' + N.kutubxona + ' — amallar sinalmadi'); return; }
    N.yuklash.push({ fn: 'api/amallar.js (yuklash)', tur: e.name, xabar: String(e.message).split('\n')[0].slice(0, 200), joy: joy(e) }); return; }
  // himoya haqiqatan yoqilganmi — yoqilmagan bo'lsa amallar chaqirilmaydi (yozib qo'yish xavfi)
  try { const ro = (await db.q('SHOW default_transaction_read_only')).rows[0].default_transaction_read_only;
    if (ro !== 'on') { console.log('tutun: bazani faqat-o\'qish rejimiga o\'tkazib bo\'lmadi — amallar sinalmadi'); N.himoyasiz = true; return; } }
  catch (e) { console.log('tutun: bazaga ulanib bo\'lmadi (' + e.message + ') — amallar sinalmadi'); N.bazasiz = true; return; }
  let X = [];
  try { X = (await db.q(`SELECT xodim_id, fish, lavozim, tel_raqam, huquqlar, telegram_id, qator_no, kirish_kodi FROM v_xodimlar WHERE holat = 'Ishlayapti' ORDER BY xodim_id`)).rows.filter(x => x.huquqlar && x.huquqlar.length); }
  catch (e) { console.log('tutun: xodimlar ro\'yxati o\'qilmadi (' + e.message + ') — amallar sinalmadi'); N.xodimsiz = true; return; }
  let U = null;
  S.foydalanuvchi = async () => U;
  S.ruxsat = async (kodSes, kerak) => { if (!U) throw new S.Xato('Sessiya tugagan — parolingizni qayta kiriting.'); if (kerak && !(U.admin || U.huquq.includes(kerak))) throw new S.Xato('Bu bo\'limga ruxsatingiz yo\'q.'); return U; };
  const kodSes = 'TUTUNSINOVKODI00|' + '0'.repeat(32);
  const chaqir = async (fn, args, rol) => {
    if (typeof A[fn] !== 'function') return null;
    N.soni.amal++;
    try { const r = await muddatli(Promise.resolve().then(() => A[fn](args)), AMAL_MUDDAT, fn); N.soni.otdi++; return r; }
    catch (e) {
      if (dasturmi(e)) N.xato.push({ fn, rol, tur: e.name, xabar: String(e.message).slice(0, 200), joy: joy(e) });
      else N.soni.oddiy++;
      return null;
    }
  };
  for (const x of X) {
    N.soni.xodim++;
    const h = x.huquqlar.map(z => String(z).trim());
    U = { kod: String(x.kirish_kodi || '').trim() || 'TUTUNSINOVKODI00', id: x.xodim_id, fish: x.fish, ism: String(x.fish).split(/\s+/)[1] || x.fish, lavozim: x.lavozim,
      tel: String(x.tel_raqam || ''), huquq: h, admin: h.includes('admin'), pin: '', tg: x.telegram_id, qator: x.qator_no };
    const rolNomi = U.admin ? 'admin' : h.filter(z => ROL[z]).join('+') || 'huquqsiz';
    const fnlar = new Set(HAMMA); (U.admin ? ['admin'] : h).forEach(z => (ROL[z] || []).forEach(f => fnlar.add(f)));
    for (const fn of fnlar) {
      const r = await chaqir(fn, [kodSes], rolNomi);
      // undiruvchi: navbatdagi birinchi 3 mijozning kartasi ham ochib ko'riladi (13.11.2026 dagi xato aynan mijoz qadamlarida edi)
      if (fn === 'qadamBoshlang' && r && Array.isArray(r.navbat)) for (const m of r.navbat.slice(0, 3)) if (m && m.no) await chaqir('qadamMijoz', [kodSes, m.no], rolNomi);
      if (fn === 'undBoshlang' && r && Array.isArray(r.royxat)) for (const m of r.royxat.slice(0, 2)) if (m && m.no) await chaqir('undMijoz', [kodSes, m.no], rolNomi);
    }
  }
  U = null;
}

(async () => {
  try { sintaksis(); if (!N.yuklash.length) await amallar(); }
  catch (e) { console.log('tutun: sinovning o\'zi ishlamadi:', e && e.stack); N.sinovXato = String(e && e.message); return tugat(3); }
  // bir xil xato (amal + matn) bir marta
  const bor = {}; N.xato = N.xato.filter(x => { const k = x.fn + '|' + x.tur + '|' + x.xabar; if (bor[k]) { bor[k].rollar.push(x.rol); return false; } x.rollar = [x.rol]; bor[k] = x; return true; });
  console.log('tutun: fayl ' + N.soni.fayl + ' · xodim ' + N.soni.xodim + ' · amal ' + N.soni.amal + ' (o\'tdi ' + N.soni.otdi + ', oddiy rad ' + N.soni.oddiy + ') · DASTUR XATOSI ' + (N.yuklash.length + N.xato.length));
  N.yuklash.concat(N.xato).forEach(x => console.log('  ✗ ' + x.fn + ' — ' + x.tur + ': ' + x.xabar + (x.joy ? ' @ ' + x.joy : '')));
  tugat(N.yuklash.length || N.xato.length ? 2 : 0);
})();
