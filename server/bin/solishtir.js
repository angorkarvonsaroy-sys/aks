#!/usr/bin/env node
// AKS TIZIM — serverga ko'chirilgan amalni eski tizim bilan SOLISHTIRISH (ikkalasiga bir xil so'rov, javoblar farqi).
// Ishlatish (aks foydalanuvchisi, /opt/aks/app ichida):  node bin/solishtir.js <amal> <xodim_kirish_kodi> [arg1 arg2 …]
// Qulay: aks-solishtir <amal> <kod> [arg…]   (deploy.sh o'rnatadi)
// Chiqish: ikkala vaqt, farq qilgan maydonlar ro'yxati (ko'pi bilan 40 ta), yakun. Hech narsa yozmaydi.
'use strict';
process.env.AKS_ENV = process.env.AKS_ENV || '/opt/aks/.env';
const S = require('../api/sessiya');
const A = require('../api/amallar');
const koprik = require('../api/koprik');
const { pool, redis } = require('../lib/db');

function farqlar(a, b, yol, out) {
  if (out.length > 400) return;
  const ta = a === null ? 'null' : Array.isArray(a) ? 'array' : typeof a, tb = b === null ? 'null' : Array.isArray(b) ? 'array' : typeof b;
  const bosh = v => v === undefined || v === null || v === '';
  if (bosh(a) && bosh(b)) return;                                   // '' / null / undefined — bir xil deb olinadi
  if (ta !== tb) { if ((ta === 'number' || ta === 'string') && (tb === 'number' || tb === 'string') && String(a) === String(b)) return; out.push([yol, a, b]); return; }
  if (ta === 'array') { if (a.length !== b.length) out.push([yol + '.length', a.length, b.length]); const n = Math.min(a.length, b.length); for (let i = 0; i < n; i++) farqlar(a[i], b[i], yol + '[' + i + ']', out); return; }
  if (ta === 'object') { const K = new Set([...Object.keys(a), ...Object.keys(b)]); for (const k of K) farqlar(a[k], b[k], yol ? yol + '.' + k : k, out); return; }
  if (ta === 'number' && Math.abs(a - b) < 0.5) return;
  if (a !== b) out.push([yol, a, b]);
}
const qisqa = v => { const s = typeof v === 'string' ? v : JSON.stringify(v); return s === undefined ? 'undefined' : s.length > 70 ? s.slice(0, 67) + '…' : s; };

(async () => {
  const [fn, kod, ...args] = process.argv.slice(2);
  if (!fn || !kod) { console.log('Ishlatish: aks-solishtir <amal> <xodim_kirish_kodi> [arg…]'); process.exit(1); }
  if (typeof A[fn] !== 'function') { console.log('Bu amal serverda yo\'q: ' + fn); process.exit(1); }
  if (!koprik.bor()) { console.log('Ko\'prik sozlanmagan (.env BRIDGE_URL/BRIDGE_SECRET).'); process.exit(1); }
  const x = await S.xodimKod(kod); if (!x) { console.log('Kod bo\'yicha xodim topilmadi.'); process.exit(1); }
  const tok = await S.sessiyaOch(kod);
  const parsed = args.map(a => { try { return JSON.parse(a); } catch (e) { return a; } });
  console.log(`=== ${fn} — ${x.fish} (${x.admin ? 'direktor' : x.huquq.join(',')}) ===`);
  let t = Date.now(); const srv = await A[fn]([kod + '|' + tok, ...parsed]); const tS = Date.now() - t;
  t = Date.now(); const esk = await koprik.chaqir(fn, kod, parsed); const tE = Date.now() - t;
  console.log(`server: ${tS} ms · eski tizim: ${tE} ms`);
  const F = []; farqlar(JSON.parse(JSON.stringify(srv)), JSON.parse(JSON.stringify(esk)), '', F);
  if (!F.length) console.log('✅ Javoblar BIR XIL.');
  else { console.log(`⚠ ${F.length} ta farq (server ← → eski):`); F.slice(0, 40).forEach(([y, a, b]) => console.log('  ' + y + ':  ' + qisqa(a) + '  ←→  ' + qisqa(b))); if (F.length > 40) console.log('  … yana ' + (F.length - 40) + ' ta'); }
  await redis.del('ses:' + tok); await pool.end(); redis.disconnect(); process.exit(0);
})().catch(e => { console.error('XATO:', e.message); process.exit(1); });
