// AKS TIZIM — 🛠 «Tizim holati» (03.11.2026): kundalik tekshiruvlar SSH siz — direktor ilovadan, istalgan kompyuter yoki telefondan ko'radi.
// aks-holat, aks-arxiv, aks-koprik, aks-bugun eski, aks-vaqt dagi asosiy ma'lumotlar bitta joyda. FAQAT O'QIYDI — hech narsa yozmaydi va o'zgartirmaydi.
// Har bo'lim alohida (vaqt chegarasi bilan): bittasi sekin yoki xato bo'lsa, qolganlari baribir ko'rinadi. Sirlar (kalit, parol, token) chiqarilmaydi.
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { q, redis } = require('./db');
const BQ = require('./bayroq');

const s = v => String(v == null ? '' : v);
const OK = '✅', OG = '⚠', XT = '✖', IN = 'ℹ';
const soat = ms => ms / 3600000;
const sana = d => d ? new Date(d).toLocaleString('ru-RU', { timeZone: 'Asia/Tashkent', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).replace(',', '') : '—';
const oldin = d => { if (!d) return ''; const m = Math.round((Date.now() - new Date(d).getTime()) / 60000); return m < 1 ? 'hozir' : m < 60 ? m + ' daq oldin' : m < 2880 ? Math.round(m / 60) + ' soat oldin' : Math.round(m / 1440) + ' kun oldin'; };
const mb = b => (Number(b) / 1048576).toFixed(1) + ' MB';
const gb = b => (Number(b) / 1073741824).toFixed(1) + ' GB';
function vaqtli(p, ms, nom) { return Promise.race([p, new Promise((_, r) => setTimeout(() => r(new Error(nom + ': ' + Math.round(ms / 1000) + ' s da javob bo\'lmadi')), ms))]); }
const eng = (...b) => b.includes(XT) ? XT : b.includes(OG) ? OG : OK;   // bo'lim belgisi — qatorlarning eng yomoni

// ------------------------------------------------------------------ 1. server
async function server(versiya) {
  const Q = [];
  let dep = OK;
  try {
    const L = fs.readFileSync('/var/log/aks-deploy.log', 'utf8').split('\n').filter(Boolean).slice(-60);
    const okI = L.map((z, i) => /OK:/.test(z) ? i : -1).filter(i => i >= 0).pop();
    const oxirgiOk = okI >= 0 ? L[okI] : '';
    const keyin = okI >= 0 ? L.slice(okI + 1) : L;
    if (keyin.some(z => /!!!|XATO/.test(z))) { dep = XT; Q.push({ b: XT, m: 'Oxirgi o\'rnatishda xato', i: keyin.filter(z => /!!!|XATO/.test(z)).slice(-2).join(' · ').slice(0, 300) }); }
    Q.push({ b: dep === XT ? OG : OK, m: 'Kod versiyasi: ' + versiya, i: oxirgiOk ? oxirgiOk.replace(/^(\S+ \S+) OK: (\w+) /, '$1 · $2 · ').slice(0, 220) : 'o\'rnatish jurnali bo\'sh' });
  } catch (e) { Q.push({ b: IN, m: 'Kod versiyasi: ' + versiya, i: 'o\'rnatish jurnalini o\'qib bo\'lmadi' }); }
  const up = process.uptime();
  Q.push({ b: OK, m: 'Ilova serveri ishlayapti', i: 'uzluksiz: ' + (up > 86400 ? Math.floor(up / 86400) + ' kun ' : '') + Math.floor(up % 86400 / 3600) + ' soat' });
  const jami = os.totalmem(), bosh = os.freemem();
  Q.push({ b: bosh / jami < 0.08 ? OG : OK, m: 'Operativ xotira: bo\'sh ' + gb(bosh) + ' / ' + gb(jami) });
  try { const d = fs.statfsSync('/'); const b = d.bavail * d.bsize, j = d.blocks * d.bsize; Q.push({ b: b / j < 0.1 ? XT : b / j < 0.2 ? OG : OK, m: 'Disk: bo\'sh ' + gb(b) + ' / ' + gb(j) + ' (' + Math.round(b / j * 100) + '%)' }); }
  catch (e) { Q.push({ b: IN, m: 'Disk: o\'qib bo\'lmadi' }); }
  return { n: 'Server', Q };
}

// ------------------------------------------------------------------ 2. baza, Redis, ko'zgu
async function baza() {
  const Q = [];
  try { await q('SELECT 1'); Q.push({ b: OK, m: 'PostgreSQL ishlayapti' }); } catch (e) { Q.push({ b: XT, m: 'PostgreSQL: ' + e.message }); }
  try {
    const m = await redis.info('memory'), st = await redis.info('stats');
    const g = (t, k) => (new RegExp('^' + k + ':(.*)$', 'm').exec(t) || [])[1] || '';
    const ev = Number(g(st, 'evicted_keys')) || 0;
    const mx = g(m, 'maxmemory_human').trim();
    Q.push({ b: ev ? OG : OK, m: 'Redis: band ' + g(m, 'used_memory_human').trim() + ' / chegara ' + (!mx || mx === '0B' ? 'yo\'q' : mx), i: ev ? 'xotira to\'lib ' + ev + ' ta kalit o\'chgan' : 'o\'chirilgan kalit yo\'q' });
  } catch (e) { Q.push({ b: XT, m: 'Redis: ' + e.message }); }
  try {
    const y = (await q(`SELECT boshlandi, holat, qatorlar, left(xato, 150) xato FROM kozgu.yurishlar ORDER BY id DESC LIMIT 1`)).rows[0];
    const ok = (await q(`SELECT max(boshlandi) t FROM kozgu.yurishlar WHERE holat = 'ok'`)).rows[0].t;
    const eski = !ok || Date.now() - new Date(ok).getTime() > 20 * 60000;
    Q.push({ b: y && y.holat === 'xato' ? (eski ? XT : OG) : eski ? OG : OK, m: 'Google jadval nusxasi (ko\'zgu, har 5 daq): ' + (ok ? 'oxirgi muvaffaqiyatli — ' + sana(ok) + ' (' + oldin(ok) + ')' : 'muvaffaqiyatli yurish yo\'q'),
      i: y ? (y.holat === 'xato' ? 'oxirgi urinish xato: ' + s(y.xato) : (y.qatorlar || 0) + ' qator') : '' });
  } catch (e) { Q.push({ b: IN, m: 'Ko\'zgu: ' + e.message }); }
  // server bazasining kunlik nusxasi (aks-backup 03:00) va shifrlangan tashqi nusxasi (aks-zaxira-tashqi 03:30). /var/backups/aks ilova uchun yopiq —
  // natijani aks-zaxira-tashqi (root) /opt/aks/holat/zaxira_tashqi.json ga yozadi.
  try {
    const z = JSON.parse(fs.readFileSync('/opt/aks/holat/zaxira_tashqi.json', 'utf8'));
    if (z.baza_vaqt) Q.push({ b: soat(Date.now() - new Date(z.baza_vaqt).getTime()) > 26 ? OG : OK, m: 'Server bazasi zaxirasi (har kecha 03:00): ' + sana(z.baza_vaqt) + ' (' + oldin(z.baza_vaqt) + ')', i: s(z.baza) + ' · ' + mb(z.hajm) });
    else Q.push({ b: OG, m: 'Server bazasi zaxirasi: fayl topilmadi' });
    Q.push({ b: !z.ok ? XT : soat(Date.now() - new Date(z.vaqt).getTime()) > 26 ? OG : OK, m: 'Shifrlangan nusxa Drive\'ga (har kecha 03:30): ' + (z.ok ? sana(z.vaqt) + ' (' + oldin(z.vaqt) + ')' : 'XATO — ' + sana(z.vaqt)), i: s(z.matn) });
  } catch (e) { Q.push({ b: IN, m: 'Server bazasi zaxirasi: holat fayli hali yo\'q', i: 'kechasi 03:30 dagi zaxiradan keyin paydo bo\'ladi' }); }
  return { n: 'Baza va zaxira', Q };
}

// ------------------------------------------------------------------ 3. Drive arxivi
async function arxiv() {
  const ARX = require('./arxiv'), env = require('./env');
  const Q = [];
  const on = await ARX.yoniq();
  Q.push({ b: on ? OK : OG, m: on ? 'Arxiv yoniq — fayllarni server o\'zi Drive\'ga qo\'yadi' : 'Arxiv o\'chiq — fayllarni eski tizim qo\'yadi', i: '«AKS TIZIM / AKS ARXIV»', url: 'https://drive.google.com/drive/folders/' + env.arxivPapka });
  if (on) {
    try { const L = JSON.parse(await vaqtli(ARX._ichki.rc(['lsjson', '--dirs-only', 'aksarxiv:'], { ms: 20000 }), 25000, 'Drive')); Q.push({ b: OK, m: 'Drive ulanishi ishlayapti', i: L.map(z => z.Name).join(', ') }); }
    catch (e) { Q.push({ b: XT, m: 'Drive ulanishi: ' + s(e.message).slice(0, 200) }); }
  }
  try {
    const r = (await q(`SELECT count(*)::int n, coalesce(sum(hajm) FILTER (WHERE NOT savatda), 0)::bigint h, max(yaratildi) t FROM arxiv_fayllar`)).rows[0];
    Q.push({ b: IN, m: 'Server yuklagan fayllar: ' + r.n + ' · ' + mb(r.h), i: r.t ? 'oxirgisi ' + sana(r.t) : '' });
    for (const [fn, nom] of [['zaxira', 'AKS_BAZA nusxasi «99 ZAXIRA» ga (har kecha 02:00)'], ['nusxa', 'Server fayllari «SERVER NUSXA» ga (har kecha, zaxiradan keyin)']]) {
      const z = (await q(`SELECT vaqt, ok, left(xato, 160) xato FROM rpc_jurnal WHERE qayerda = 'arxiv' AND fn = $1 ORDER BY id DESC LIMIT 1`, [fn])).rows[0];
      const zo = (await q(`SELECT max(vaqt) t FROM rpc_jurnal WHERE qayerda = 'arxiv' AND fn = $1 AND ok`, [fn])).rows[0].t;
      if (!z) { Q.push({ b: on ? OG : IN, m: nom + ': hali bo\'lmagan' }); continue; }
      Q.push({ b: !zo || soat(Date.now() - new Date(zo).getTime()) > 26 ? OG : z.ok ? OK : OG, m: nom + ': ' + (zo ? sana(zo) + ' (' + oldin(zo) + ')' : 'muvaffaqiyatlisi yo\'q'), i: z.ok ? '' : 'oxirgi urinish xato: ' + s(z.xato) });
    }
    const x = (await q(`SELECT count(*)::int n, (array_agg(fn || ': ' || left(xato, 120) ORDER BY id DESC))[1] x FROM rpc_jurnal WHERE qayerda = 'arxiv' AND NOT ok AND vaqt > now() - interval '24 hours'`)).rows[0];
    Q.push({ b: x.n ? OG : OK, m: 'Arxiv xatolari (24 soat): ' + x.n, i: x.n ? 'oxirgisi — ' + s(x.x) : '' });
  } catch (e) { Q.push({ b: IN, m: 'Arxiv jurnali: ' + e.message }); }
  return { n: 'Drive arxivi', Q };
}

// ------------------------------------------------------------------ 4. eski tizim
async function eski(kod) {
  const koprik = require('../api/koprik'), V = require('./versiya');
  const Q = [];
  let n = 0; const yoq = [];
  for (const [nom, L] of V.BOLIMLAR) { if (await V.serverOzi(L)) n++; else yoq.push(nom); }
  Q.push({ b: yoq.length ? OG : OK, m: 'Eski tizim javob bermasa ham serverda ishlaydigan bo\'limlar: ' + n + '/' + V.BOLIMLAR.length, i: yoq.length ? 'eski tizimga bog\'liq: ' + yoq.join(', ') : 'eski tizim kerak emas' });
  if (koprik.bor()) {
    const t0 = Date.now();
    try { const v = await vaqtli(koprik.chaqir('koprikVersiya', kod, [], { muddat: 12000, urinish: 1 }), 15000, 'Eski tizim'); Q.push({ b: IN, m: 'Eski tizim (Koprik) javob beryapti: v' + s(v), i: ((Date.now() - t0) / 1000).toFixed(1) + ' s' }); }
    catch (e) { Q.push({ b: yoq.length ? OG : IN, m: 'Eski tizim javob bermadi', i: s(e.message).slice(0, 160) + (yoq.length ? '' : ' — server ishiga ta\'sir qilmaydi') }); }
  } else Q.push({ b: IN, m: 'Eski tizim ko\'prigi sozlanmagan' });
  try {
    const R = (await q(`SELECT fn, count(*)::int n, max(vaqt) t, count(*) FILTER (WHERE NOT ok)::int x FROM rpc_jurnal WHERE qayerda = 'eski' AND fn NOT LIKE 'koprik%' AND vaqt > now() - interval '3 days' GROUP BY 1 ORDER BY max(vaqt) DESC LIMIT 12`)).rows;
    const ataylab = new Set(['bekorTasdiq', 'bekorQaytarish', 'topRoyxat', 'qadamVersiya']);
    const kutilmagan = R.filter(r => !ataylab.has(r.fn));
    Q.push({ b: kutilmagan.length ? OG : OK, m: 'Eski tizimga borgan amallar (3 kun): ' + (R.length ? R.reduce((a, r) => a + r.n, 0) + ' ta' : 'yo\'q'),
      i: R.length ? R.map(r => r.fn + ' ×' + r.n + ' (' + oldin(r.t) + (r.x ? ', xato ' + r.x : '') + ')' + (ataylab.has(r.fn) ? ' — ataylab' : '')).join(' · ') : '' });
  } catch (e) { Q.push({ b: IN, m: 'Jurnal: ' + e.message }); }
  return { n: 'Eski tizimdan mustaqillik', Q };
}

// ------------------------------------------------------------------ 5. bayroqlar va vaqt ishlari
async function ishlar() {
  const VQ = require('./vaqt');
  const Q = [];
  const ochiq = [];
  for (const nom of BQ.YOZUV_NOMLAR) {
    if (await BQ.yozuv(nom)) continue;
    let v = null; try { v = await redis.get('yozuv_yondi:' + nom); } catch (e) { }
    ochiq.push(nom + (v === '0' ? ' (ataylab o\'chirilgan)' : ' (hali yoqilmagan)'));
  }
  Q.push({ b: ochiq.every(z => /^bekor_tasdiq /.test(z)) ? OK : OG, m: 'Serverda bajariladigan amallar: ' + (BQ.YOZUV_NOMLAR.length - ochiq.length) + '/' + BQ.YOZUV_NOMLAR.length, i: ochiq.length ? 'o\'chiq: ' + ochiq.join(', ') : '' });
  try {
    const H = await VQ.holat();
    for (const h of H) {
      const ox = h.oxirgi;
      const b = !h.yoq ? OG : ox && ox.ok === false ? OG : OK;
      Q.push({ b, m: h.tavsif.replace(/\s*\([^)]*\)\s*$/, '') + ' — ' + VQ.harMatn(h.har), i: !h.yoq ? 'O\'CHIQ' : ox ? 'oxirgi: ' + ox.vaqt + (ox.ok ? ' ✓' : ' ✖ ' + s(ox.xato).slice(0, 120)) : 'hali ishlamagan' });
    }
  } catch (e) { Q.push({ b: IN, m: 'Vaqt ishlari: ' + e.message }); }
  return { n: 'Amallar va vaqt bo\'yicha ishlar', Q };
}

// ------------------------------------------------------------------ 6. xatolar (24 soat) — ma'lumot uchun (xodimga chiqqan ogohlantirishlar ham kiradi)
async function xatolar() {
  const Q = [];
  try {
    const R = (await q(`SELECT fn, qayerda, count(*)::int n, max(vaqt) t, (array_agg(left(xato, 140) ORDER BY id DESC))[1] x FROM rpc_jurnal
                        WHERE NOT ok AND vaqt > now() - interval '24 hours' GROUP BY 1, 2 ORDER BY count(*) DESC LIMIT 10`)).rows;
    if (!R.length) Q.push({ b: OK, m: 'Oxirgi 24 soatda xato yo\'q' });
    R.forEach(r => Q.push({ b: IN, m: r.fn + ' ×' + r.n + ' (' + r.qayerda + ', ' + oldin(r.t) + ')', i: s(r.x) }));
  } catch (e) { Q.push({ b: IN, m: e.message }); }
  return { n: 'Xatolar (24 soat) — xodimga chiqqan ogohlantirishlar ham shu yerda', Q, info: true };
}

// ------------------------------------------------------------------ 🗄 Baza ko'chishi — 3-bosqichga tayyorlik (07.11.2026)
// baza_yuklashlar: har kecha 03:00 (baza_solishtir) natijasi — server hisobi ↔ Google hisobi. Mezon (BAZA_KOCHIRISH_REJA 2a):
// ketma-ket kamida 14 kecha 0 farq va 0 to'xtash → 3.2 (ikki tomonlama yozish) yoqishga tayyor.
const KERAK_KECHA = 14;
async function bazaKochish() {
  const Q = [];
  let ikki = false; try { ikki = await require('./ikki_yozuv').yoqilganmi(); } catch (e) { }
  const R = (await q(`SELECT id, boshlandi, holat, ms, xato_matn, hisobot->'solishtir' sol, hisobot->'ikki' ikki
                       FROM baza_yuklashlar WHERE boshlandi > now() - interval '30 days' ORDER BY id DESC`)).rows;
  // har kunga oxirgi yurish (kechasi 03:00 dagisi yoki qo'lda yuritilgani)
  const kun = {}; R.forEach(r => { const k = new Date(new Date(r.boshlandi).getTime() + 5 * 3600e3).toISOString().slice(0, 10); if (!kun[k]) kun[k] = r; });
  const K = Object.keys(kun).sort().reverse().map(k => ({ k, r: kun[k] }));
  const farqi = r => r.holat !== 'ok' ? null : r.ikki ? Number((r.ikki.jami || {}).ikki || 0) + Number((r.sol || {}).farq || 0) : Number((r.sol || {}).farq || 0);
  let ketma = 0; for (const z of K) { if (z.r.holat === 'ok' && farqi(z.r) === 0) ketma++; else break; }
  const bosh = K.length ? K[K.length - 1].k : null;
  Q.push({ b: ikki ? IN : ketma >= KERAK_KECHA ? OK : IN, m: ikki ? '3-bosqich (ikki tomonlama yozish) YONIQ — har kecha katakma-katak tekshiriladi'
      : ketma >= KERAK_KECHA ? '✔ 3-bosqichga TAYYOR: ketma-ket ' + ketma + ' kecha 0 farq (kerak — ' + KERAK_KECHA + ')'
      : '3-bosqichga hali erta: ketma-ket ' + ketma + ' kecha 0 farq, kerak — ' + KERAK_KECHA + ' (yana ' + (KERAK_KECHA - ketma) + ' kecha)',
    i: 'Har kecha 03:00 da server hisobi Google jadval bilan har katak bo\'yicha solishtiriladi' + (bosh ? '; jurnal ' + bosh.split('-').reverse().join('.') + ' dan' : '') });
  if (!K.length) Q.push({ b: OG, m: 'Oxirgi 30 kunda solishtirish yurmagan', i: 'vaqt ishi «baza_solishtir» yoqilganmi — «Amallar va vaqt bo\'yicha ishlar» bo\'limida' });
  for (const { k, r } of K.slice(0, 16)) {
    const kunM = k.split('-').reverse().join('.');
    if (r.holat === 'ishlayapti') { Q.push({ b: IN, m: kunM + ' — yurmoqda / tugamagan' }); continue; }
    if (r.holat !== 'ok') { Q.push({ b: XT, m: kunM + ' — TO\'XTADI', i: s(r.xato_matn).slice(0, 200) }); continue; }
    const f = farqi(r), sol = r.sol || {};
    const ust = (sol.ustunlar || []).map(u => u.varaq + ' ' + u.harf + ' (' + u.farq + ')').slice(0, 5).join(', ');
    Q.push({ b: f ? OG : OK, m: kunM + ' — ' + (f ? f + ' katakda FARQ' : '0 farq') + (sol.katak ? ' · ' + Number(sol.katak).toLocaleString('ru-RU').replace(/ /g, ' ') + ' katak' : '') + (r.ms ? ' · ' + (r.ms / 1000).toFixed(1) + ' s' : ''),
      i: f ? (ust || 'ikki tomonlama tekshiruvda farq') : '' });
  }
  return { n: 'Baza ko\'chishi — 3-bosqichga tayyorlik', Q };
}

// hammasi — bo'limlar parallel, har biri vaqt chegarasi bilan
async function yig(opt = {}) {
  const t0 = Date.now();
  const B = [['Server', () => server(opt.versiya || 'dev')], ['Baza va zaxira', baza], ['Baza ko\'chishi', bazaKochish], ['Drive arxivi', arxiv], ['Eski tizimdan mustaqillik', () => eski(opt.kod)], ['Amallar va vaqt bo\'yicha ishlar', ishlar], ['Xatolar (24 soat)', xatolar]];
  const R = await Promise.all(B.map(([n, f]) => vaqtli(Promise.resolve().then(f), 40000, n).catch(e => ({ n, Q: [{ b: XT, m: 'Bo\'limni yig\'ib bo\'lmadi', i: s(e.message).slice(0, 200) }] }))));
  R.forEach(b => { b.b = b.info ? IN : eng(...b.Q.map(z => z.b)); });
  const umumiy = eng(...R.filter(b => !b.info).map(b => b.b));
  return { vaqt: new Date(), ms: Date.now() - t0, umumiy, B: R };
}

module.exports = { yig, _ichki: { server, baza, bazaKochish, arxiv, eski, ishlar, xatolar, eng, oldin } };
