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
  // «navbat» — yuristga o'tkazish tasdig'ini kutayotgan har bir shartnoma bilan (qadamSudKarta uchun)
  let ishlar = [parsed];
  if (parsed[0] === 'navbat') { const I = await require('../lib/jurnallar').yuIshlar();
    ishlar = [...new Set(I.filter(i => i.holati === 'Tasdiq kutilmoqda').map(i => i.no))].map(no => [no, ...parsed.slice(1)]);
    console.log('Tasdiq kutayotganlar: ' + (ishlar.map(z => z[0]).join(', ') || 'yo\'q')); }
  // «namuna» — har xil shartnomalar bilan: oxirgi 3 ta sotuv, oxirgi 3 ta ijara, ochiq bekor so'rovlari (2 tagacha)
  if (parsed[0] === 'namuna') { const V = require('../lib/varaq'), Jr = require('../lib/jurnallar');
    const ol = async (v, re) => (await V.qatorlar(v)).map(z => String(z.x[0] == null ? '' : z.x[0]).trim()).filter(n => re.test(n)).slice(-3);
    const B = (await Jr.bekorJurnal()).filter(z => ['Bekor qilindi', 'Rad etildi', 'Qaytarildi'].indexOf(z.holati) < 0).map(z => z.no).slice(-2);
    const N = [...new Set([...(await ol('03_Sotuv_shartnomalar', /^27\/\d+$/)), ...(await ol('04_Ijara_shartnomalar', /^IJ-27\/\d+$/)), ...B])];
    ishlar = N.map(no => [no, ...parsed.slice(1)]);
    console.log('Namuna: ' + N.join(', ')); }
  // «devon» — oxirgi 4 ta devonxona yozuvi (ID) bilan
  if (parsed[0] === 'devon') { const V = require('../lib/varaq');
    const N = (await V.qatorlar('11_Devonxona')).map(z => z.x[0]).filter(v => v !== null && v !== undefined && v !== '').slice(-4);
    ishlar = N.map(id => [id, ...parsed.slice(1)]); console.log('Devon ID: ' + N.join(', ')); }
  // «xatlar» — oxirgi 3 ta PDF i bor xat raqami bilan (xatPdf uchun)
  if (parsed[0] === 'xatlar') { const N = (await require('../lib/jurnallar').xatJurnal()).filter(h => h.pdf).map(h => h.raqam).slice(-3);
    ishlar = N.map(r => [r, ...parsed.slice(1)]); console.log('Xatlar: ' + N.join(', ')); }
  let jamiF = 0;
  for (const P of ishlar) {
    if (ishlar.length > 1) console.log('--- ' + P.join(' '));
    // xato ham javob sifatida solishtiriladi (ikkalasi bir xil xato bersa — BIR XIL)
    let t = Date.now(); let srv; try { srv = await A[fn]([kod + '|' + tok, ...P]); } catch (e) { srv = { xato: e.message }; } const tS = Date.now() - t;
    t = Date.now(); let esk; try { esk = await koprik.chaqir(fn, kod, P); } catch (e) { esk = { xato: e.message }; } const tE = Date.now() - t;
    console.log(`server: ${tS} ms · eski tizim: ${tE} ms`);
    const b64q = o => { if (o && typeof o.b64 === 'string') { const c = require('crypto').createHash('md5').update(o.b64).digest('hex').slice(0, 12); return Object.assign({}, o, { b64: 'md5:' + c + ' (' + o.b64.length + ')' }); } return o; };
    const F = []; farqlar(JSON.parse(JSON.stringify(b64q(srv))), JSON.parse(JSON.stringify(b64q(esk))), '', F); jamiF += F.length;
    if (!F.length) console.log('✅ Javoblar BIR XIL.');
    else { console.log(`⚠ ${F.length} ta farq (server ← → eski):`); F.slice(0, 40).forEach(([y, a, b]) => console.log('  ' + y + ':  ' + qisqa(a) + '  ←→  ' + qisqa(b))); if (F.length > 40) console.log('  … yana ' + (F.length - 40) + ' ta'); }
  }
  if (ishlar.length > 1) console.log(jamiF ? '⚠ JAMI ' + jamiF + ' ta farq' : '✅ HAMMASI BIR XIL');
  await redis.del('ses:' + tok); await pool.end(); redis.disconnect(); process.exit(0);
})().catch(e => { console.error('XATO:', e.message); process.exit(1); });
