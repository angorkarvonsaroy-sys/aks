#!/usr/bin/env node
// AKS TIZIM — ilova serveri (Fastify). Nginx 80 → 127.0.0.1:3000.
//   GET  /            — xodimlar ilovasi (?k=KOD), Index.html serverdan
//   POST /api/rpc     — {fn, args}: serverda bor amal — shu yerda; yo'q bo'lsa — eski tizim ko'prigi
//   GET  /api/holat   — server holati (JSON)
// Tizim muallifi va yaratuvchisi: Kamoliddin Naqiyev
'use strict';
const fastify = require('fastify')({ logger: false, bodyLimit: 64 * 1024 * 1024, trustProxy: true });
const env = require('../lib/env');
const { q, pool, redis } = require('../lib/db');
const S = require('./sessiya');
const A = require('./amallar');
const koprik = require('./koprik');
const kesh = require('./kesh');
const tetik = require('../lib/kozgu_tetik');
const ui = require('./ui');

const VERSIYA = (() => { try { return require('fs').readFileSync(__dirname + '/../.versiya', 'utf8').trim().slice(0, 7); } catch (e) { return 'dev'; } })();

function jurnal(fn, qayerda, ms, ok, xato) {
  q('INSERT INTO rpc_jurnal (fn, qayerda, ms, ok, xato) VALUES ($1,$2,$3,$4,$5)', [fn.slice(0, 80), qayerda, ms, ok, xato ? String(xato).slice(0, 300) : null]).catch(() => {});
}

// ---------- ilova sahifasi
fastify.get('/', async (req, reply) => {
  const kod = String(req.query.k || '').trim();
  reply.type('text/html; charset=utf-8');
  if (!kod) return ui.KIRISH;                       // o'rnatilgan ilova ikonasi: saqlangan kod bilan qayta ochiladi
  const user = await S.xodimKod(kod);
  if (!user) return ui.TAQIQ;
  let html = ui.sahifa(user, kod, String(req.query.b || '').replace(/[^0-9a-f]/gi, '').slice(0, 40));
  if (html === null) return ui.YOQ;
  // 👁 ko'rish rejimi (&sifat=ID) — Sifat.gs mantig'i hali serverda emas; direktor eski havolada ko'raveradi
  return html;
});

// ---------- ilova sifatida o'rnatish fayllari (manifest, belgi, sw)
const OCHIQ = { 'manifest.json': 'application/manifest+json', 'sw.js': 'text/javascript; charset=utf-8',
  'icon-192.png': 'image/png', 'icon-512.png': 'image/png', 'favicon.png': 'image/png' };
const ochiqFayl = {};
for (const f of Object.keys(OCHIQ)) { try { ochiqFayl[f] = require('fs').readFileSync(__dirname + '/../public/' + f); } catch (e) {} }
fastify.get('/:fayl', async (req, reply) => {
  const f = req.params.fayl;
  if (!ochiqFayl[f]) { reply.code(404).type('text/plain; charset=utf-8'); return 'AKS TIZIM: topilmadi'; }
  reply.type(OCHIQ[f]).header('Cache-Control', f === 'sw.js' ? 'no-cache' : 'public, max-age=86400');
  return ochiqFayl[f];
});

// ---------- amallar
fastify.post('/api/rpc', async (req, reply) => {
  const b = req.body || {};
  const fn = String(b.fn || '').replace(/[^A-Za-z0-9_]/g, '');
  const args = Array.isArray(b.args) ? b.args : [];
  const t0 = Date.now();
  if (!fn) return { ok: false, xato: 'Amal nomi yo\'q' };
  try {
    let r, qayerda;
    if (typeof A[fn] === 'function') {
      qayerda = 'server'; r = await A[fn](args);
      if (A.YOZUV.has(fn)) { const kod = String(args[0] || '').split('|')[0]; if (kod) kesh.yozuvdanKeyin(kod).catch(() => {}); }   // serverdagi yozuv — xodimning tayyor javoblari eskirdi
    }
    else {
      qayerda = 'koprik';
      // eski tizimga faqat tirik sessiya bilan; kod «kod|tok» ko'rinishida keladi
      const u = await S.foydalanuvchi(args[0]);
      if (!u) throw new S.Xato('Sessiya tugagan — PIN ni qayta kiriting.');
      if (kesh.oqishmi(fn)) {
        const n = await kesh.oqi(u.kod, fn, args.slice(1));      // o'qish: keshdan (tayyor) yoki ko'prikdan
        r = n.r; qayerda = n.qayerda;
      } else {
        r = await koprik.chaqir(fn, u.kod, args.slice(1));        // yozuv: faqat ko'prik
        kesh.yozuvdanKeyin(u.kod).catch(() => {});                // xodimning tayyor javoblari eskirdi — qayta tayyorlanadi
        await tetik.yangilaKut(20000);                            // ko'zgu darhol yangilansin — serverdagi amallar yangi yozuvni ko'rsin
      }
    }
    jurnal(fn, qayerda, Date.now() - t0, true);
    return { ok: true, r: r === undefined ? null : r };
  } catch (e) {
    const xato = e && e.message ? e.message : String(e);
    jurnal(fn, typeof A[fn] === 'function' ? 'server' : 'koprik', Date.now() - t0, false, xato);
    if (!(e instanceof S.Xato)) console.error(new Date().toISOString(), fn, 'XATO:', xato);
    reply.code(200);
    return { ok: false, xato };
  }
});

// ---------- holat
fastify.get('/api/holat', async () => {
  const out = { ok: true, versiya: VERSIYA, vaqt: new Date().toISOString(), koprik: koprik.bor(), ui: ui.indexBor() };
  try {
    out.baza = (await q('SELECT 1 AS ok')).rows[0].ok === 1;
    out.xodimlar = Number((await q(`SELECT count(*) FROM v_xodimlar WHERE holat='Ishlayapti'`)).rows[0].count);
    const y = (await q('SELECT boshlandi, holat, qatorlar FROM kozgu.yurishlar ORDER BY id DESC LIMIT 1')).rows[0];
    out.kozgu = y ? { vaqt: y.boshlandi, holat: y.holat, qatorlar: y.qatorlar } : null;
  } catch (e) { out.ok = false; out.baza = false; out.xato = e.message; }
  try { out.redis = (await redis.ping()) === 'PONG'; } catch (e) { out.ok = false; out.redis = false; }
  return out;
});

fastify.setNotFoundHandler((req, reply) => { reply.code(404).type('text/plain; charset=utf-8').send('AKS TIZIM: topilmadi'); });

async function main() {
  await fastify.listen({ port: env.appPort, host: '127.0.0.1' });
  kesh.boshla();
  require('./hujjat_yoz').boshla();   // Drive'ga ko'chmagan skanlar — har 15 daqiqada
  console.log(`${new Date().toISOString()} AKS api ${VERSIYA} tinglayapti: 127.0.0.1:${env.appPort}`);
}
main().catch(e => { console.error('API ishga tushmadi:', e); process.exit(1); });

for (const sig of ['SIGTERM', 'SIGINT']) process.on(sig, async () => { try { await fastify.close(); await pool.end(); redis.disconnect(); } finally { process.exit(0); } });
