#!/usr/bin/env node
// AKS TIZIM — 🖥 EKRAN SINOVI (28.11.2026): xodim ilovasini (Index.html) MAHALLIY serverda, tanlangan xodim nomidan,
// HAQIQIY API bilan (mahalliy PostgreSQL ko'zgusi, faqat o'qish) ochib ko'rish uchun kichik http server.
// Ishlab turgan tizimga tegmaydi: Google, Telegram, ko'prik, tashqi dasturlar o'chiriladi; baza faqat o'qiydi; Redis yozuvlari bo'sh.
// Sessiya: xodim kirish kodi ISHLATILMAYDI — S.ruxsat sinov foydalanuvchisini qaytaradi (tutun.js kabi).
//
// Ishlatish:
//   AKS_ENV=/tmp/akssrv/.env node sinov/ekran_sinov.js --ildiz /home/claude/aks/server --index <Index.html> --xarita <Xarita.html> --xodim Doston [--port 3777]
// Keyin brauzer (playwright) http://127.0.0.1:<port>/ ni ochadi. Tugatish: Ctrl+C yoki /tugat ga GET.
'use strict';
const path = require('path'), fs = require('fs'), http = require('http');
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const ILDIZ = path.resolve(arg('--ildiz', path.join(__dirname, '..')));
const PORT = Number(arg('--port', 3777));
const XODIM = String(arg('--xodim', '')).trim();
if (arg('--index')) process.env.UI_FAYL = path.resolve(arg('--index'));
if (arg('--xarita')) process.env.XARITA_FAYL = path.resolve(arg('--xarita'));

// ---- himoya (tutun.js bilan bir xil): hech narsa yozilmaydi, tashqariga chiqilmaydi
global.fetch = async () => { throw new Error('ekran_sinov: tarmoq o\'chirilgan'); };
const cp = require('child_process'); ['spawn', 'exec', 'execFile', 'fork', 'spawnSync', 'execSync', 'execFileSync'].forEach(k => { cp[k] = () => { throw new Error('ekran_sinov: tashqi dastur o\'chirilgan'); }; });
process.env.PGOPTIONS = ((process.env.PGOPTIONS || '') + ' -c default_transaction_read_only=on').trim();
const db = require(path.join(ILDIZ, 'lib', 'db.js'));
['set', 'setex', 'psetex', 'setnx', 'del', 'unlink', 'incr', 'incrby', 'decr', 'expire', 'pexpire', 'hset', 'hdel', 'hincrby', 'lpush', 'rpush', 'lpop', 'rpop', 'ltrim', 'sadd', 'srem',
  'zadd', 'zrem', 'append', 'getset', 'getdel', 'mset', 'publish', 'eval', 'evalsha', 'flushdb', 'flushall', 'rename', 'persist']
  .forEach(k => { if (typeof db.redis[k] === 'function') db.redis[k] = async () => (k === 'set' || k === 'setnx' ? 'OK' : k === 'incr' || k === 'incrby' ? 1 : 0); });
process.on('unhandledRejection', () => { });

(async () => {
  const ro = (await db.q('SHOW default_transaction_read_only')).rows[0].default_transaction_read_only;
  if (ro !== 'on') { console.error('ekran_sinov: baza faqat-o\'qish rejimida emas — to\'xtatildi'); process.exit(3); }
  const X = (await db.q(`SELECT xodim_id, fish, lavozim, tel_raqam, huquqlar, telegram_id, qator_no FROM v_xodimlar WHERE holat = 'Ishlayapti' ORDER BY xodim_id`)).rows;
  const x = X.find(z => String(z.fish).toLowerCase().indexOf(XODIM.toLowerCase()) >= 0);
  if (!x) { console.error('ekran_sinov: xodim topilmadi: ' + XODIM + '. Bor: ' + X.map(z => z.fish).join(' | ')); process.exit(4); }
  const h = (x.huquqlar || []).map(z => String(z).trim());
  const U = { kod: 'EKRANSINOVKODI00', id: x.xodim_id, fish: x.fish, ism: String(x.fish).split(/\s+/)[1] || x.fish, lavozim: x.lavozim,
    tel: String(x.tel_raqam || ''), huquq: h, admin: h.includes('admin'), pin: '', tg: x.telegram_id, qator: x.qator_no };
  const S = require(path.join(ILDIZ, 'api', 'sessiya.js'));
  S.foydalanuvchi = async () => U;
  S.ruxsat = async (kodSes, kerak) => { if (kerak && !(U.admin || U.huquq.includes(kerak))) throw new S.Xato('Bu bo\'limga ruxsatingiz yo\'q.'); return U; };
  const ui = require(path.join(ILDIZ, 'api', 'ui.js'));
  const A = require(path.join(ILDIZ, 'api', 'amallar.js'));
  const LOG = [];
  const srv = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://x');
    if (req.method === 'GET' && (u.pathname === '/' || u.pathname === '/index.html')) {
      const html = ui.sahifa(U, 'EKRANSINOVKODI00', '');
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); return res.end(html || '<h1>Index.html yo\'q</h1>');
    }
    if (u.pathname === '/api/holat') { res.writeHead(200, { 'Content-Type': 'application/json' }); return res.end(JSON.stringify({ ok: true, ilova: ui.versiya() })); }
    if (u.pathname === '/tugat') { res.end('ok'); setTimeout(() => process.exit(0), 100); return; }
    if (u.pathname === '/jurnal') { res.writeHead(200, { 'Content-Type': 'application/json' }); return res.end(JSON.stringify(LOG)); }
    if (req.method === 'POST' && u.pathname === '/api/rpc') {
      let b = ''; req.on('data', d => { b += d; }); req.on('end', async () => {
        let j = {}; try { j = JSON.parse(b || '{}'); } catch (e) { }
        const fn = String(j.fn || ''); const t0 = Date.now();
        res.setHeader('Content-Type', 'application/json');
        // sessiya amallari — sinov foydalanuvchisi uchun doim «kirdi» (haqiqiy parol tekshiruvi chetlab o'tiladi, chunki kalit yo'q)
        if (fn === 'kirishOch') { LOG.push({ fn, ms: 0 }); return res.end(JSON.stringify({ ok: true, r: { tok: 'EKRANSINOVTOK', ism: U.ism, fish: U.fish, vaqtinchalik: false } })); }
        if (fn === 'parolTirik' || fn === 'sesTirik' || fn === 'qPing') { LOG.push({ fn, ms: 0 }); return res.end(JSON.stringify({ ok: true, r: { ok: true } })); }
        if (fn === 'ilovaXato') { LOG.push({ fn, ms: 0, ilovaXato: j.args && j.args[1] }); return res.end(JSON.stringify({ ok: true, r: true })); }
        if (typeof A[fn] !== 'function') { LOG.push({ fn, xato: 'yo\'q' }); return res.end(JSON.stringify({ ok: false, xato: 'ekran_sinov: ' + fn + ' amali yo\'q' })); }
        try { const r = await Promise.race([A[fn](j.args || []), new Promise((_, rj) => setTimeout(() => rj(new Error('muddat')), 25000))]);
          LOG.push({ fn, ms: Date.now() - t0 }); res.end(JSON.stringify({ ok: true, r })); }
        catch (e) { LOG.push({ fn, ms: Date.now() - t0, xato: e && e.name + ': ' + e.message, dastur: ['TypeError', 'ReferenceError', 'SyntaxError', 'RangeError'].indexOf(e && e.name) >= 0 });
          res.end(JSON.stringify({ ok: false, xato: (e && e.message) || 'xato' })); }
      }); return; }
    res.writeHead(404); res.end('');
  });
  srv.listen(PORT, '127.0.0.1', () => { console.log('EKRAN_TAYYOR http://127.0.0.1:' + PORT + '/  xodim=' + U.fish + '  huquq=' + h.join(',') + '  ilova=' + ui.versiya()); });
})().catch(e => { console.error('ekran_sinov:', e && e.stack); process.exit(5); });
