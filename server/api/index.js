#!/usr/bin/env node
// AKS TIZIM — ilova serveri (Fastify). Nginx 80 → 127.0.0.1:3000.
//   GET  /            — xodimlar ilovasi (?k=KOD), Index.html serverdan
//   POST /api/rpc     — {fn, args}: serverda bor amal — shu yerda; yo'q bo'lsa — eski tizim ko'prigi
//   GET  /api/holat   — server holati (JSON)
// Tizim muallifi va yaratuvchisi: Kamoliddin Naqiyev
'use strict';
const fastify = require('fastify')({ logger: false, bodyLimit: 30 * 1024 * 1024, trustProxy: true });
const env = require('../lib/env');
const { q, pool, redis } = require('../lib/db');
const S = require('./sessiya');
const A = require('./amallar');
const koprik = require('./koprik');
const ui = require('./ui');

const VERSIYA = (() => { try { return require('fs').readFileSync(__dirname + '/../.versiya', 'utf8').trim().slice(0, 7); } catch (e) { return 'dev'; } })();

function jurnal(fn, qayerda, ms, ok, xato) {
  q('INSERT INTO rpc_jurnal (fn, qayerda, ms, ok, xato) VALUES ($1,$2,$3,$4,$5)', [fn.slice(0, 80), qayerda, ms, ok, xato ? String(xato).slice(0, 300) : null]).catch(() => {});
}

// ---------- ilova sahifasi
fastify.get('/', async (req, reply) => {
  const kod = String(req.query.k || '').trim();
  const user = kod ? await S.xodimKod(kod) : null;
  reply.type('text/html; charset=utf-8');
  if (!user) return ui.TAQIQ;
  let html = ui.sahifa(user, kod, String(req.query.b || '').replace(/[^0-9a-f]/gi, '').slice(0, 40));
  if (html === null) return ui.YOQ;
  // 👁 ko'rish rejimi (&sifat=ID) — Sifat.gs mantig'i hali serverda emas; direktor eski havolada ko'raveradi
  return html;
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
    if (typeof A[fn] === 'function') { qayerda = 'server'; r = await A[fn](args); }
    else {
      qayerda = 'koprik';
      // eski tizimga faqat tirik sessiya bilan; kod «kod|tok» ko'rinishida keladi
      const u = await S.foydalanuvchi(args[0]);
      if (!u) throw new S.Xato('Sessiya tugagan — PIN ni qayta kiriting.');
      r = await koprik.chaqir(fn, u.kod, args.slice(1));
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
  console.log(`${new Date().toISOString()} AKS api ${VERSIYA} tinglayapti: 127.0.0.1:${env.appPort}`);
}
main().catch(e => { console.error('API ishga tushmadi:', e); process.exit(1); });

for (const sig of ['SIGTERM', 'SIGINT']) process.on(sig, async () => { try { await fastify.close(); await pool.end(); redis.disconnect(); } finally { process.exit(0); } });
