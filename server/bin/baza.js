#!/usr/bin/env node
// AKS TIZIM — 🗄 BAZA (ko'chirishning 1-bosqichi): ko'zgudan «baza» sxemasidagi haqiqiy jadvallarni qurish va ko'rish (01.11.2026).
//   aks-baza                 — holat: oxirgi to'ldirish, har jadvalda nechta qator, nechta xato
//   aks-baza toldir          — ko'zgudan qaytadan qurish (eski «baza» faqat hammasi muvaffaqiyatli bo'lsa almashadi)
//   aks-baza xatolar [jadval] — aylantirib bo'lmagan kataklar (NULL qilingan): varaq, qator, ustun, qiymat, sabab
//   aks-baza solishtir       — (2-bosqich) yangidan quradi va HAR QATOR: Google hisoblagan qiymat ↔ server hisobi (lib/baza_hisob.js); --toldirmasdan
//   aks-baza xom             — (3-bosqichga tayyorgarlik) ko'ringan matndan o'qiydigan 33 joy: hozirgi natija ↔ xom qiymatdan (lib/xom_sinov.js)
//   aks-baza tikla           — (3-bosqich) ko'zguni Google'dan yangilab «baza» ni qaytadan quradi; ikki tomonlama yozish yoniq bo'lsa —
//                              shu orada server yozgan o'zgarishlar jurnaldan qayta qo'llanadi
//   aks-baza ikki            — (3-bosqich) ikki tomonlama yozish holati: bayroq, jurnal (24 soat), oxirgi kunlik tekshiruv
//   aks-baza ikki yoq | ochir — bayroqni yoqish (keyin avtomatik tikla) / o'chirish
//   aks-baza ikki solishtir [--tuzat] — hozir: ko'zgu → «baza_tekshir» va «baza» bilan har katak (--tuzat — farqlarni tuzatadi, faqat yoniq bo'lsa)
//   aks-baza ikki jurnal [jadval|varaq] [--xato] — oxirgi yozuvlar
//   aks-baza ikki sinov      — qatlamning o'z-o'zini sinovi: ko'zgudagi hamma qator qatlam orqali vaqtinchalik sxemaga (Google'ga va «baza» ga tegmaydi)
//   aks-baza sozlama [--tuzat] — eski tizim Script Properties o'rniga server sozlamalari (sql/009): xat zanjiri, topshiriq qoidalari,
//                              bugungi ish navbati; eski tizimdagi nusxa bilan solishtiradi (--tuzat — eskida bo'lib serverda yo'q zanjir belgilarini qo'shadi)
// Google jadvalga va ilovaga TEGMAYDI (tikla / ikki — faqat ko'zguni Google'dan o'qib yangilaydi). Ilova hali bu jadvallardan o'qimaydi.
'use strict';
process.env.AKS_ENV = process.env.AKS_ENV || '/opt/aks/.env';
const { Client } = require('pg');
const env = require('../lib/env');
const B = require('../lib/baza');
const IK = require('../lib/ikki_yozuv');
const IS = require('../lib/ikki_solishtir');
const uxla = ms => new Promise(r => setTimeout(r, ms));
const vaqtM = d => d ? new Date(d).toLocaleString('sv-SE', { timeZone: 'Asia/Tashkent' }).slice(0, 16) : '—';

const s = v => String(v == null ? '' : v);
const ong = (v, n) => s(v).padStart(n), chap = (v, n) => s(v).padEnd(n);
const son = n => Number(n || 0).toLocaleString('ru-RU').replace(/ /g, ' ');

async function holat(db) {
  const j = (await db.query(`SELECT * FROM baza_yuklashlar ORDER BY id DESC LIMIT 1`)).rows[0];
  if (!j) { console.log('Hali to\'ldirilmagan. Boshlash: aks-baza toldir'); return; }
  console.log('Oxirgi to\'ldirish: ' + new Date(j.boshlandi).toLocaleString('sv-SE', { timeZone: 'Asia/Tashkent' }) + ' · ' + j.holat +
    (j.ms ? ' · ' + (j.ms / 1000).toFixed(1) + ' s' : '') + (j.xato_matn ? ' · ' + j.xato_matn : ''));
  const bor = (await db.query(`SELECT 1 FROM information_schema.schemata WHERE schema_name = 'baza'`)).rows.length;
  if (!bor) { console.log('«baza» sxemasi yo\'q.'); return; }
  jadval((j.hisobot && j.hisobot.jadvallar) || [], j.hisobot && j.hisobot.xatolar);
}
function jadval(T, xatolar) {
  console.log('\n' + chap('Jadval', 26) + chap('Varaq', 30) + ong('Qator', 7) + ong('Xato', 6) + ong('Takror ID', 10) + ong('Bo\'sh', 7));
  console.log('-'.repeat(86));
  let q = 0;
  for (const t of T) { q += t.qator;
    console.log(chap(t.jadval, 26) + chap(t.varaq, 30) + ong(son(t.qator), 7) + ong(t.xato || '', 6) + ong(t.takror || '', 10) + ong((t.bosh || 0) + (t.tashlandi || 0) || '', 7)); }
  console.log('-'.repeat(86));
  console.log(chap('JAMI: ' + T.length + ' jadval', 56) + ong(son(q), 7) + ong(xatolar || 0, 6));
  console.log('\nXato — katakni aylantirib bo\'lmadi (NULL qilindi): aks-baza xatolar · Takror ID — ID ustunida bir xil qiymat bir necha qatorda.');
}

// ---------- 3-bosqich: ikki tomonlama yozish
async function jurnalBor(db) { return (await db.query(`SELECT to_regclass('public.baza_ikki_jurnal') t`)).rows[0].t !== null; }
async function oldingiDan(db) {   // oldingi kunlik tekshiruv ko'zgusi o'qilgan payt — «ikki»/«tashqi» ajratish oynasi shundan boshlanadi
  const r = (await db.query(`SELECT hisobot->'ikki'->>'dan' dan FROM baza_yuklashlar WHERE holat = 'ok' AND hisobot ? 'ikki' ORDER BY id DESC LIMIT 1`)).rows[0];
  return r && r.dan ? new Date(r.dan) : new Date(Date.now() - 26 * 3600000);
}
async function kozguYangila() {
  console.log('Ko\'zgu Google\'dan yangilanmoqda (1–2 daqiqa)…');
  await require('../lib/kozgu_tetik').yangila();
}
async function tikla(db) {
  const yon = await IK.yoqilganmi(), dan = new Date(Date.now() - 60000);
  await kozguYangila();
  const r0 = await db.query(`INSERT INTO baza_yuklashlar (holat) VALUES ('ishlayapti') RETURNING id`);
  console.log('Ko\'zgudan «baza» qurilmoqda…');
  const n = await B.toldir(db, { sxema: 'baza' });
  await db.query(`UPDATE baza_yuklashlar SET tugadi = now(), holat = 'ok', ms = $2, hisobot = $3 WHERE id = $1`, [r0.rows[0].id, n.ms, JSON.stringify(n)]);
  console.log('✅ «baza» qurildi: ' + n.jadvallar.reduce((a, t) => a + t.qator, 0) + ' qator, ' + n.xatolar + ' aylantirilmagan katak, ' + (n.ms / 1000).toFixed(1) + ' s');
  if (yon && await jurnalBor(db)) {
    const K = new Map((await db.query('SELECT id, sheet_id FROM kompaniyalar')).rows.map(r => [r.id, r.sheet_id]));
    const q = await IK.qaytaQolla(db, dan, { sheetId: k => K.get(k), kalitFayl: env.googleKey });
    console.log('Ko\'zgu o\'qilayotganda server yozgan o\'zgarishlar qayta qo\'llandi: ' + q.yozuv + ' yozuv, ' + q.katak + ' katak' +
      (q.lugat ? ', lugat qayta qurildi' : '') + (q.surish ? ' · ⚠ ' + q.surish + ' ta qator surish qayta qo\'llanmadi (kechasi tekshiriladi)' : ''));
  }
}
function farqJadval(R) {
  console.log(chap('Jadval', 26) + chap('Varaq', 28) + ong('Qator', 7) + ong('Farq', 6) + ong('Server', 8) + ong('Tashqi', 8) + ong('Hozir', 7));
  console.log('-'.repeat(90));
  for (const h of R.jadvallar) if (h.farq || h.chiqarildi)
    console.log(chap(h.jadval, 26) + chap(h.varaq, 28) + ong(son(h.qator), 7) + ong(h.farq || '', 6) + ong(h.ikki ? h.ikki + ' ⚠' : '', 8) + ong(h.tashqi || '', 8) + ong(h.chiqarildi || '', 7));
  console.log('-'.repeat(90));
  console.log(chap('JAMI: ' + R.jadvallar.length + ' jadval, ' + son(R.jami.katak) + ' katak', 61) + ong(R.jami.farq, 6) + ong(R.jami.ikki, 8) + ong(R.jami.tashqi, 8) + ong(R.jami.chiqarildi, 7));
  for (const h of R.jadvallar.filter(z => z.farq)) {
    console.log('\n' + h.jadval + ' (' + h.varaq + '): ' + Object.entries(h.ustunlar).map(([u, n]) => u + ' ' + n).join(', '));
    h.misollar.forEach(m => console.log('  ' + (m.tur === 'ikki' ? '⚠ server' : '  tashqi') + ' qator ' + ong(m.qator, 5) + (m.amal ? ' [' + m.amal + ']' : '') + ': ' +
      m.ustunlar.map(u => typeof u === 'string' ? u : u.ustun + ' — baza: ' + JSON.stringify(u.a) + ' · Google: ' + JSON.stringify(u.b)).join(' | ')));
  }
  console.log('\nServer — farq server yozgan qatorda (ikki tomonlama yozish xatosi bo\'lishi mumkin). Tashqi — server tegmagan qator (Google\'da qo\'lda yoki eski tizim yozgan).' +
    '\nHozir — oxirgi daqiqalarda yozilgan, ko\'zgu hali ko\'rmagan bo\'lishi mumkin — hisobga olinmadi.');
}
async function ikki(db, arg) {
  const kichik = arg[0] || 'holat', bor = await jurnalBor(db);
  if (!bor && kichik !== 'sinov') { console.log('⚠ baza_ikki_jurnal jadvali yo\'q — 008 migratsiya hali qo\'llanmagan (aks-yangila).'); process.exitCode = 1; return; }
  if (kichik === 'yoq') {
    if (await IK.yoqilganmi()) { console.log('Allaqachon YONIQ. Holat: aks-baza ikki'); return; }
    await IK.bayroq(true);
    console.log('✅ Bayroq yoqildi (ikki_yozuv_yondi). Server 15 soniya ichida sezadi — kutilmoqda…');
    await uxla(16000);
    await tikla(db);
    console.log('\nEndi server Google\'ga yozgan har o\'zgarishni «baza» ga ham yozadi. Har kecha 03:00 da tekshiriladi. O\'chirish: aks-baza ikki ochir');
  } else if (kichik === 'ochir') {
    await IK.bayroq(false);
    console.log('✅ Bayroq o\'chirildi. 15 soniyadan keyin server «baza» ga yozmaydi. Kechasi «baza» yana ko\'zgudan quriladi (avvalgidek). Ilovaga ta\'siri yo\'q.');
  } else if (kichik === 'solishtir') {
    const tuzat = arg.includes('--tuzat'), yon = await IK.yoqilganmi();
    if (tuzat && !yon) { console.log('--tuzat faqat ikki tomonlama yozish yoniq bo\'lsa (o\'chiq bo\'lsa «baza» kechasi baribir qaytadan quriladi).'); return; }
    const dan = new Date(Date.now() - 60000), oldin = await oldingiDan(db);
    await kozguYangila();
    console.log('Ko\'zgudan «baza_tekshir» qurilmoqda…');
    await B.toldir(db, { sxema: 'baza_tekshir' });
    const R = await IS.solishtir(db, { dan, oldin, tuzat });
    console.log('\n«baza» ↔ «baza_tekshir» (ko\'zgudan, hozirgi Google holati) · bayroq ' + (yon ? 'YONIQ' : 'o\'chiq') + ' · server yozuvlari ' + vaqtM(oldin) + ' dan beri\n');
    farqJadval(R);
    console.log('\n' + (R.jami.ikki ? '⚠ Server yozgan qatorlarda ' + R.jami.ikki + ' ta farq — Claude\'ga ko\'rsating.' : '✅ Server yozgan qatorlarda farq yo\'q.') +
      (R.jami.tashqi ? ' Tashqi: ' + R.jami.tashqi + ' qator.' : '') + (tuzat ? ' Tuzatildi: ' + R.jami.tuzatildi + ' qator.' : '') + (yon ? '' : '\n(Bayroq o\'chiq — hamma farq «tashqi»: «baza» oxirgi marta kechasi qurilgandan beri Google\'dagi o\'zgarishlar.)'));
    if (R.jami.ikki) process.exitCode = 2;
  } else if (kichik === 'jurnal') {
    const xato = arg.includes('--xato'), f = arg.slice(1).find(a => !a.startsWith('--'));
    const sh = [], p = [];
    if (xato) sh.push(`holat IN ('xato', 'ogoh')`);
    if (f) { p.push(f); sh.push(`(jadval = $${p.length} OR varaq = $${p.length})`); }
    const R = await db.query(`SELECT vaqt, amal, varaq, jadval, qatorlar, ustunlar, soni, holat, xato, ms FROM baza_ikki_jurnal ${sh.length ? 'WHERE ' + sh.join(' AND ') : ''} ORDER BY id DESC LIMIT 40`, p);
    if (!R.rows.length) { console.log('Jurnal bo\'sh' + (sh.length ? ' (shu shart bo\'yicha)' : '') + '.'); return; }
    for (const r of R.rows.reverse())
      console.log(vaqtM(r.vaqt) + '  ' + chap(r.holat, 8) + chap(s(r.amal).slice(0, 22), 23) + chap(s(r.varaq).slice(0, 26), 27) + 'q ' + chap(s((r.qatorlar || []).slice(0, 4).join(',')) + ((r.qatorlar || []).length > 4 ? '…' : ''), 18) +
        chap(s((r.ustunlar || []).slice(0, 8).join(',')), 18) + ong(r.ms == null ? '' : r.ms + 'ms', 7) + (r.xato ? '  ' + s(r.xato).slice(0, 160) : ''));
  } else if (kichik === 'sinov') {
    console.log('Sinov: ko\'zgudagi hamma qator ikki tomonlama yozish qatlami orqali vaqtinchalik «baza_sinov» ga (Google\'ga va «baza» ga tegmaydi)…');
    const N = await require('../lib/ikki_sinov').sinov(db);
    const f = R => R.jami.farq + R.jadvallar.filter(h => h.toliqEmas).length;
    console.log('\n1) To\'liq qatorlar: ' + son(N.qator) + ' qator, ' + son(N.katak) + ' katak → farq: ' + (f(N.birinchi) ? f(N.birinchi) + ' ⚠' : '0 ✅'));
    if (f(N.birinchi)) farqJadval(N.birinchi);
    console.log('2) Qisman yozuvlar (' + N.qisman + ' qator: tozalash + ustunma-ustun) va qator surish (' + N.surish.map(x => x.jadval + ' ' + x.bosh + '-qator: ' + (x.farq ? x.farq + ' farq ⚠' : '0 ✅')).join(', ') + ')');
    console.log('   keyin hammasi yana → farq: ' + (f(N.ikkinchi) ? f(N.ikkinchi) + ' ⚠' : '0 ✅') + (N.xatolar ? ' · xatolar jadvali: ' + N.xatolar + ' farq ⚠' : ''));
    if (f(N.ikkinchi)) farqJadval(N.ikkinchi);
    const ok = !f(N.birinchi) && !f(N.ikkinchi) && !N.surish.some(x => x.farq) && !N.xatolar;
    console.log('\n' + (ok ? '✅ SINOV O\'TDI' : '⚠ SINOV O\'TMADI — Claude\'ga ko\'rsating') + ' (' + (N.ms / 1000).toFixed(1) + ' s)');
    if (!ok) process.exitCode = 2;
  } else {
    const yon = await IK.yoqilganmi();
    console.log('Ikki tomonlama yozish (3-bosqich): ' + (yon ? '🟢 YONIQ' : '⚪ o\'chiq') + '  (Redis ' + IK.BAYROQ + ')');
    const J = (await db.query(`SELECT holat, count(*)::int n, coalesce(sum(soni), 0)::int katak FROM baza_ikki_jurnal WHERE vaqt > now() - interval '24 hours' GROUP BY 1 ORDER BY 1`)).rows;
    console.log('Jurnal, 24 soat: ' + (J.length ? J.map(r => r.holat + ' ' + r.n + ' (' + r.katak + ' katak)').join(' · ') : 'bo\'sh'));
    const T = (await db.query(`SELECT coalesce(jadval, varaq) j, count(*)::int n FROM baza_ikki_jurnal WHERE vaqt > now() - interval '24 hours' GROUP BY 1 ORDER BY 2 DESC LIMIT 8`)).rows;
    if (T.length) console.log('Ko\'p yozilgan: ' + T.map(r => r.j + ' ' + r.n).join(', '));
    const Y = (await db.query(`SELECT boshlandi, holat, hisobot->'ikki' i FROM baza_yuklashlar WHERE hisobot ? 'ikki' ORDER BY id DESC LIMIT 1`)).rows[0];
    if (Y) console.log('Oxirgi kunlik tekshiruv: ' + vaqtM(Y.boshlandi) + ' — server yozgan qatorlarda farq ' + Y.i.jami.ikki + ', tashqi ' + Y.i.jami.tashqi + ', tuzatildi ' + Y.i.jami.tuzatildi);
    else console.log('Kunlik tekshiruv (2b) hali bo\'lmagan' + (yon ? ' — bugun 03:00 da.' : ' (bayroq yoqilgach har kecha 03:00).'));
    const tk = (await db.query(`SELECT 1 FROM information_schema.schemata WHERE schema_name = 'baza_tekshir'`)).rows.length;
    console.log('«baza_tekshir»: ' + (tk ? 'bor' : 'yo\'q') + ' · Buyruqlar: aks-baza ikki sinov | solishtir | jurnal | yoq | ochir');
  }
}

// ---------- ⚙ server sozlamalari (02.11.2026): eski tizim Script Properties o'rniga server bazasi
async function sozlama(arg) {
  const SZ = require('../lib/sozlama'), X = require('../lib/xat_yordam'), TQ = require('../api/topshiriq')._ichki, koprik = require('../api/koprik');
  const tuzat = arg.includes('--tuzat');
  const kod = koprik.bor() ? await require('../lib/vaqt').adminKod() : '';
  const vaqt = d => d ? new Date(d).toLocaleString('ru-RU', { timeZone: 'Asia/Tashkent' }) : '—';
  const eski = async fn => { if (!koprik.bor()) return { xato: 'ko\'prik sozlanmagan' }; try { return { r: await koprik.chaqir(fn, kod, []) }; } catch (e) { return { xato: e.message }; } };
  let farqBor = false;
  // 1. xat zanjiri
  const Z = await X.xatZanjir(kod), mz = await SZ.malumot('xat_zanjir');
  console.log('1. XAT ZANJIRI (XAT_ZANJIR) — ' + (mz ? Object.keys(Z).length + ' shartnoma · manba: ' + mz.manba + ' · ' + vaqt(mz.yangilandi) + ' · ' + (mz.kim || '') : '⚠ bazada hali yo\'q (eski joydan ko\'chirib bo\'lmadi)'));
  const ez = await eski('koprikZanjir');
  if (ez.xato) console.log('   eski tizim bilan solishtirib bo\'lmadi: ' + ez.xato);
  else {
    const E = ez.r || {}, tushgan = [];
    let teng = 0, yangi = 0;
    for (const [no, d] of Object.entries(E)) { if (Z[no] === d) teng++; else if (!Z[no] || Z[no] < d) tushgan.push([no, d, Z[no] || '—']); else yangi++; }
    yangi += Object.keys(Z).filter(no => !(no in E)).length;
    console.log('   eski tizimda: ' + Object.keys(E).length + ' · bir xil: ' + teng + ' · faqat serverda (server qo\'ygan yangi belgi): ' + yangi + ' · eskida bor, serverda yo\'q/eskiroq: ' + tushgan.length);
    tushgan.slice(0, 20).forEach(([no, d, z]) => console.log('     ' + chap(no, 10) + ' eski: ' + d + '  server: ' + z));
    if (tushgan.length && tuzat) { const Y = {}; tushgan.forEach(([no, d]) => { Y[no] = d; }); await SZ.qosh('xat_zanjir', Y, 'aks-baza sozlama --tuzat'); console.log('   ✅ ' + tushgan.length + ' ta belgi serverga qo\'shildi.'); }
    else if (tushgan.length) { farqBor = true; console.log('   ⚠ Tuzatish: aks-baza sozlama --tuzat'); }
  }
  // 2. topshiriq qoidalari
  const C = await TQ.topQoidaCfg(kod), mq = await SZ.malumot('top_qoida');
  console.log('\n2. TOPSHIRIQ QOIDALARI (TOP_QOIDA) — ' + (mq ? 'manba: ' + mq.manba + ' · ' + vaqt(mq.yangilandi) + ' · ' + (mq.kim || '') : '⚠ bazada hali yo\'q'));
  const et = await eski('topRoyxat'), EQ = {};
  if (!et.xato && et.r && Array.isArray(et.r.qoidalar)) et.r.qoidalar.forEach(q => { EQ[q.k] = q; });
  let qf = 0;
  for (const k of Object.keys(C)) {
    const e = EQ[k], f = e && (e.on !== C[k].on || Number(e.kun) !== C[k].kun);
    if (f) qf++;
    console.log('   ' + chap(k, 9) + chap(C[k].on ? 'yoniq' : 'o\'chiq', 8) + ong(C[k].kun, 3) + ' kun' + (e ? (f ? '   ⚠ eski tizimda: ' + (e.on ? 'yoniq' : 'o\'chiq') + ' ' + e.kun + ' kun' : '   = eski') : ''));
  }
  if (et.xato) console.log('   eski tizim bilan solishtirib bo\'lmadi: ' + et.xato);
  else if (qf) console.log('   ℹ ' + qf + ' ta qoida eski tizimdagidan farq qiladi — server qiymati asosiy (direktor oxirgi saqlagani). Eski tizimda o\'zgartirish endi kerak emas.');
  // 3. bugungi ish navbati
  const bugun = require('../lib/varaq').bugun();
  const n = (await require('../lib/db').q(`SELECT count(*)::int x, coalesce(sum(jsonb_array_length(nolar)), 0)::int s, max(yangilandi) t FROM qd_navbat WHERE sana = $1`, [bugun])).rows[0];
  let rk = 0; try { rk = (await require('../lib/db').redis.keys('qd:snap:' + bugun + ':*')).length; } catch (e) { }
  console.log('\n3. BUGUNGI ISH NAVBATI (' + bugun + ') — serverda: ' + n.x + ' xodim, ' + n.s + ' shartnoma' + (n.t ? ' · oxirgi: ' + vaqt(n.t) : '') + ' · avvalgi joyda (Redis): ' + rk + ' xodim');
  console.log('\n' + (farqBor ? '⚠ Farq bor — yuqoriga qarang.' : '✅ Sozlamalar server bazasida.'));
  if (farqBor) process.exitCode = 2;
}

(async () => {
  const buyruq = process.argv[2] || 'holat';
  const db = new Client(env.db);
  await db.connect();
  try {
    if (buyruq === 'toldir' && await IK.yoqilganmi()) {
      console.log('Ikki tomonlama yozish YONIQ — «baza» doimiy, qayta qurilmaydi. Tekshirish uchun «baza_tekshir» quriladi…');
      const n = await B.toldir(db, { sxema: 'baza_tekshir' });
      console.log('✅ «baza_tekshir» tayyor: ' + (n.ms / 1000).toFixed(1) + ' s');
      jadval(n.jadvallar, n.xatolar);
      console.log('\nSolishtirish: aks-baza ikki solishtir · «baza» ni qaytadan qurish: aks-baza tikla');
    } else if (buyruq === 'tikla') {
      await tikla(db);
    } else if (buyruq === 'sozlama') {
      await sozlama(process.argv.slice(3));
    } else if (buyruq === 'ikki') {
      await ikki(db, process.argv.slice(3));
    } else if (buyruq === 'toldir') {
      const r0 = await db.query(`INSERT INTO baza_yuklashlar (holat) VALUES ('ishlayapti') RETURNING id`);
      console.log('Ko\'zgudan «baza» jadvallari qurilmoqda…');
      try {
        const n = await B.toldir(db);
        await db.query(`UPDATE baza_yuklashlar SET tugadi = now(), holat = 'ok', ms = $2, hisobot = $3 WHERE id = $1`, [r0.rows[0].id, n.ms, JSON.stringify(n)]);
        console.log('✅ Tayyor: ' + (n.ms / 1000).toFixed(1) + ' s');
        jadval(n.jadvallar, n.xatolar);
      } catch (e) {
        await db.query(`UPDATE baza_yuklashlar SET tugadi = now(), holat = 'xato', xato_matn = $2 WHERE id = $1`, [r0.rows[0].id, s(e.message).slice(0, 2000)]);
        console.log('⚠ To\'xtadi (eski «baza» o\'z joyida): ' + e.message);
        process.exitCode = 1;
      }
    } else if (buyruq === 'solishtir') {
      // avval yangidan quriladi (ko'zgu bilan bir xil holat), keyin har qator Google qiymati bilan solishtiriladi
      const yon = await IK.yoqilganmi();
      if (yon) console.log('Ikki tomonlama yozish YONIQ — «baza» qayta qurilmaydi, hozirgi holati solishtiriladi.');
      if (!yon && !process.argv.includes('--toldirmasdan')) {
        const r0 = await db.query(`INSERT INTO baza_yuklashlar (holat) VALUES ('ishlayapti') RETURNING id`);
        const n = await B.toldir(db);
        await db.query(`UPDATE baza_yuklashlar SET tugadi = now(), holat = 'ok', ms = $2, hisobot = $3 WHERE id = $1`, [r0.rows[0].id, n.ms, JSON.stringify(n)]);
        console.log('«baza» yangidan qurildi: ' + n.jadvallar.reduce((a, t) => a + t.qator, 0) + ' qator, ' + n.xatolar + ' xato.');
      }
      const R = await require('../lib/baza_solishtir').solishtir(db);
      console.log('Google hisobi ↔ server hisobi (BUGUN = ' + (R.bugun || '?') + ', varaqdagi 08_Lugatlar!Z2)\n');
      console.log(chap('Varaq', 24) + chap('Ustun', 6) + chap('Server nomi', 22) + ong('Qator', 7) + ong('Teng', 7) + ong('FARQ', 7));
      console.log('-'.repeat(73));
      let jamiFarq = 0;
      for (const u of R.ustunlar) { jamiFarq += u.farq;
        console.log(chap(u.varaq, 24) + chap(u.harf, 6) + chap(u.ustun, 22) + ong(u.jami, 7) + ong(u.teng, 7) + ong(u.farq ? u.farq + ' ⚠' : '0', 7)); }
      console.log('-'.repeat(73));
      Object.entries(R.qatorYoq).forEach(([v, n]) => console.log('⚠ ' + v + ': ' + n + ' qator «baza» da yo\'q (faqat formula natijasi bor)'));
      for (const u of R.ustunlar.filter(z => z.farq)) {
        console.log('\n' + u.varaq + ' ' + u.harf + ' (' + u.ustun + ') — ' + u.farq + ' farq:');
        u.misollar.forEach(m => console.log('  qator ' + ong(m.qator, 5) + '  ' + chap(m.no, 10) + ' Google: ' + chap(m.google, 16) + ' server: ' + m.server));
      }
      console.log('\n' + (jamiFarq ? '⚠ JAMI FARQ: ' + jamiFarq + ' katak — server hisobi hali Google bilan bir xil emas.' : '✅ HAMMASI BIR XIL — ' + R.ustunlar.reduce((a, u) => a + u.jami, 0) + ' katak, 0 farq.'));
      if (jamiFarq) process.exitCode = 2;
    } else if (buyruq === 'xatolar') {
      const j = process.argv[3];
      const R = await db.query(`SELECT jadval, varaq, qator, ustun, qiymat, sabab FROM baza.xatolar ${j ? 'WHERE jadval = $1' : ''} ORDER BY jadval, qator, ustun LIMIT 200`, j ? [j] : []);
      const S = await db.query(`SELECT jadval, ustun, sabab, count(*)::int n FROM baza.xatolar ${j ? 'WHERE jadval = $1' : ''} GROUP BY 1, 2, 3 ORDER BY 1, 2`, j ? [j] : []);
      if (!S.rows.length) { console.log('Xato yo\'q.'); return; }
      console.log('Guruhlab:'); S.rows.forEach(r => console.log('  ' + chap(r.jadval, 26) + chap(r.ustun, 4) + chap(r.sabab, 24) + ong(r.n, 5) + ' ta'));
      console.log('\nBirinchi ' + R.rows.length + ' ta:'); R.rows.forEach(r => console.log('  ' + chap(r.varaq, 28) + ong(r.qator, 6) + ' ' + chap(r.ustun, 3) + ' «' + s(r.qiymat).slice(0, 40) + '» — ' + r.sabab));
    } else if (buyruq === 'xom') {
      // 3-bosqichga tayyorgarlik: ko'ringan matndan o'qiydigan 33 joy — hozirgi natija ↔ xom qiymatdan chiqadigan natija (lib/xom_sinov.js)
      const N = await require('../lib/xom_sinov').xomSinov(db);
      console.log('Ko\'ringan matn (hozirgi kod) ↔ xom qiymat — har qator\n');
      console.log(chap('Joy', 44) + chap('Varaq', 24) + chap('Ustun', 6) + ong('Qator', 7) + ong('FARQ', 7));
      console.log('-'.repeat(88));
      let jf = 0;
      for (const u of N) { jf += u.farq; console.log(chap(u.joy, 44) + chap(u.varaq, 24) + chap(u.harf, 6) + ong(u.jami, 7) + ong(u.farq ? u.farq + ' ⚠' : '0', 7)); }
      console.log('-'.repeat(88));
      for (const u of N.filter(z => z.farq)) {
        console.log('\n' + u.varaq + ' ' + u.harf + ' — ' + u.joy + ' — ' + u.farq + ' farq:');
        u.misollar.forEach(m => console.log('  qator ' + ong(m.qator, 5) + '  ' + chap(m.no, 10) + ' hozir: ' + chap(JSON.stringify(m.eski), 22) + ' xomdan: ' + chap(JSON.stringify(m.yangi), 22) + ' xom: ' + JSON.stringify(m.xom)));
      }
      console.log('\n' + (jf ? '⚠ JAMI FARQ: ' + jf + ' katak — Claude\'ga ko\'rsating.' : '✅ HAMMASI BIR XIL — ' + N.length + ' joy, ' + N.reduce((a, u) => a + u.jami, 0) + ' katak, 0 farq.'));
      if (jf) process.exitCode = 2;
    } else await holat(db);
  } finally { await db.end(); }
  process.exit(process.exitCode || 0);   // lib/db (Redis) ochilgan bo'lishi mumkin — kutib qolmasin
})().catch(e => { console.error('XATO:', e.message); process.exit(1); });
