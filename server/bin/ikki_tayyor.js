#!/usr/bin/env node
// AKS TIZIM — 🗄 IKKI TOMONLAMA YOZISH, 3.0: serverda tayyorgarlik tekshiruvi (02.11.2026). FAQAT O'QIYDI — hech narsa yozmaydi, hech narsani yoqmaydi.
//   aks-ikki-tayyor — 5 bo'lim:
//     1. Yozuv bayroqlari (yozuv_yondi:*) — kodda bor bayroqlardan qaysilari o'chiq (o'chiq bo'lsa amal eski tizimda bajariladi → server bazasini chetlab o'tadi)
//     2. Vaqt ishlari (vaqt_yondi:*) — jadvalga yozadigan ishlardan qaysilari serverda emas (eski Apps Script triggeri yozadi)
//     3. Eski tizimga chaqiruvlar, oxirgi 14 kun (rpc_jurnal: qayerda = eski / koprik / tg) — qaysilari jadvalga yozadi
//     4. 09c_Taminotchilar_yuridik — STIR, h/r, MFO, telefon son bo'lib saqlanganmi (raqamlar ko'rsatilmaydi, faqat soni va qator raqami)
//     5. 2a kuzatuvi — oxirgi kechalardagi «baza» solishtiruvi natijasi
// Reja: claude/IKKI_YOZISH_REJA.md (5-bo'lim, 6-bo'lim №5, 8-bo'lim 3.0).
'use strict';
process.env.AKS_ENV = process.env.AKS_ENV || '/opt/aks/.env';
const fs = require('fs');
const path = require('path');
const env = require('../lib/env');
const { q, redis, pool } = require('../lib/db');
const G = require('../lib/google');
process.stdout.on('error', e => { if (e.code === 'EPIPE') process.exit(0); });

const s = v => String(v == null ? '' : v);
const chap = (v, n) => s(v).padEnd(n), ong = (v, n) => s(v).padStart(n);
const sarlavha = t => console.log('\n━━━ ' + t + ' ' + '━'.repeat(Math.max(3, 74 - t.length)));
const ILOVA = path.join(__dirname, '..');

// ---------- 1. bayroqlar: kodda uchraydigan barcha «yozuv_yondi:<nom>» (api, lib, bin — sinov vositalarisiz)
function koddagiBayroqlar() {
  const B = new Map();
  for (const d of ['api', 'lib', 'bin']) {
    let fayllar = []; try { fayllar = fs.readdirSync(path.join(ILOVA, d)).filter(f => f.endsWith('.js')); } catch (e) { continue; }
    for (const f of fayllar) {
      if (/yozuv_sinov|ikki_tayyor/.test(f)) continue;
      const t = fs.readFileSync(path.join(ILOVA, d, f), 'utf8');
      for (const m of t.matchAll(/yozuv_yondi:([a-z0-9_]+)/g)) { if (!B.has(m[1])) B.set(m[1], new Set()); B.get(m[1]).add(d + '/' + f); }
    }
  }
  return B;
}
// o'chiq bo'lsa ham jadvalga yozmaydigan (faqat hujjat / eksport / o'qish) bayroqlar
const YOZMAYDI = { eksport: 'reyestr eksporti (o\'qish)', eksport_pdf: 'reyestr PDF (o\'qish)', hisobot_pdf: 'hisobot PDF (o\'qish)', mijoz_karta_pdf: 'mijoz kartasi PDF (o\'qish)' };
const ATAYLAB = { bekor_tasdiq: 'ataylab o\'chiq (direktor tasdig\'i eski tizimda); yoqishdan oldin 02.11 tuzatilgan b8115ec serverda bo\'lishi kerak' };

// ---------- 2. vaqt ishlari: jadvalga yozadiganlari
const VAQT_YOZADI = { top_avto: '10_Topshiriqlar', und_ertalab: '07c_Ertalab_svod', ijro_kechki: '06r_Ijro_kun, 06q_Qoidabuzarlik', ijro_tanla: '10_Topshiriqlar, 06p_Tekshiruv',
  skan_naz: '06d_Hujjatlar P/Q (o\'chiq bo\'lsa top_avto eski koprikSkanNaz ni chaqiradi)' };

// ---------- 3. eski tizim chaqiruvlari tasnifi
const KOPRIK_YOZADI = { koprikTopTasdiqTg: '10 V (Telegram havolasi)', koprikXatTasdiqTg: '06e Y (Telegram havolasi)', koprikHujjatYukla: '06d — yangi qator',
  koprikSkanNaz: '06d P/Q', topHozir: '10 — topAvto eski tizimda', qaytaHujjatlar: '06k Z, AE (server fonda chaqiradi)', pinKir: '07b_Kirish_jurnali',
  shartnomaPdf: '03 S — PDF havolasi (server fonda chaqiradi, Drive nusxasi uchun)', ijaraPdf: '04 V — PDF havolasi (server fonda chaqiradi, Drive nusxasi uchun)' };
const ZARARSIZ = new Set(('koprikVersiya koprikTgYubor koprikTgChat koprikTgGuruh koprikTg koprikZaxira koprikXatSaqla koprikKbSaqla koprikDevonSaqla koprikDevonTg ' +
  'koprikBekorSaqla koprikHujjatBekorFayl koprikDriveSaqla koprikIsbotSaqla koprikQtPapkaSavat koprikNusxaTozala koprikFaylTikla koprikTamIsbot koprikQdSnap koprikZanjir ' +
  'qadamVersiya').split(/\s+/));
function tasnif(fn, oqishmi, qayerda) {
  if (qayerda === 'tg') return { t: 'serverda', izoh: 'server o\'zi bajardi (Telegram o\'rinbosari); eski tizimga ketgani bo\'lsa — «eski» qatorida' };
  if (KOPRIK_YOZADI[fn]) return { t: 'YOZADI', izoh: KOPRIK_YOZADI[fn] };
  if (ZARARSIZ.has(fn)) return { t: 'zararsiz', izoh: 'Drive / Telegram / versiya — jadvalga yozmaydi' };
  if (oqishmi(fn)) return { t: 'o\'qish', izoh: 'eski tizimda o\'qish (api/kesh.js ro\'yxati)' };
  return { t: 'YOZISHI MUMKIN', izoh: 'eski tizim amali — serverda bayrog\'i o\'chiq yoki zaxira yo\'li ishlagan' };
}

// ---------- 4. 09c ustunlari
const C09 = [['D', 3, 'STIR', 9], ['E', 4, 'Hisob raqam (h/r)', 20], ['G', 6, 'MFO', 5], ['I', 8, 'Telefon', 9]];

(async () => {
  const xulosa = [];
  console.log('AKS TIZIM — ikki tomonlama yozish, 3.0 tayyorgarlik tekshiruvi (faqat o\'qiydi) · ' + new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Tashkent' }));

  // 1 ──────────────────────────────────────────────────────────────
  sarlavha('1. Yozuv bayroqlari (yozuv_yondi:*)');
  const B = koddagiBayroqlar();
  const redisda = new Set((await redis.keys('yozuv_yondi:*')).map(k => k.replace('yozuv_yondi:', '')));
  const nomlar = [...new Set([...B.keys(), ...redisda])].sort();
  const ochiq = [];
  for (const n of nomlar) { const yoq = (await redis.get('yozuv_yondi:' + n)) === '1'; if (!yoq) ochiq.push(n); }
  const yoqilgan = nomlar.length - ochiq.length;
  console.log('Kodda ' + B.size + ' ta bayroq' + (redisda.size ? ', Redis\'da ' + redisda.size + ' ta' : '') + ' → 🟢 yoqilgan: ' + yoqilgan + ' · ⚪ o\'chiq: ' + ochiq.length);
  let xavfliBayroq = 0;
  for (const n of ochiq) {
    const izoh = YOZMAYDI[n] ? '— ' + YOZMAYDI[n] + ', jadvalga yozmaydi' : ATAYLAB[n] ? '— ' + ATAYLAB[n] : '— ⚠ o\'chiq: amal eski tizimda bajariladi (jadvalga to\'g\'ridan-to\'g\'ri yozadi)';
    if (!YOZMAYDI[n] && !ATAYLAB[n]) xavfliBayroq++;
    console.log('  ⚪ ' + chap(n, 18) + ' ' + izoh + (B.has(n) ? '' : ' (kodda yo\'q — eski kalit)'));
  }
  if (!ochiq.length) console.log('  Hammasi yoqilgan.');
  xulosa.push(xavfliBayroq ? '⚠ ' + xavfliBayroq + ' ta yozuv bayrog\'i o\'chiq — yoqishdan oldin hal qilinadi (yoki ataylab ekanligi yozib qo\'yiladi)' : '✅ Yozuv bayroqlari: chetlab o\'tadigan o\'chiq bayroq yo\'q');

  // 2 ──────────────────────────────────────────────────────────────
  sarlavha('2. Vaqt ishlari (vaqt_yondi:*)');
  const VQ = require('../lib/vaqt');
  const H = await VQ.holat();
  let xavfliVaqt = 0;
  for (const h of H) {
    const yoz = VAQT_YOZADI[h.nom];
    const ox = h.oxirgi && h.oxirgi.vaqt ? ' · oxirgi: ' + s(h.oxirgi.vaqt).slice(0, 16).replace('T', ' ') + (h.oxirgi.ok === false ? ' ⛔' : '') : '';
    if (!h.yoq && yoz) xavfliVaqt++;
    console.log('  ' + (h.yoq ? '🟢' : '⚪') + ' ' + chap(h.nom, 16) + ' ' + chap(yoz ? 'yozadi: ' + yoz : 'faqat Telegram / Drive / PG', 58) + (h.yoq ? ox : (yoz ? ' ⚠ serverda emas' : '')));
  }
  console.log('  Eslatma: server Apps Script triggerlarini ko\'ra olmaydi. 🟢 bo\'lgan ishning eski triggeri Apps Script\'da o\'chirilgan bo\'lishi kerak.');
  xulosa.push(xavfliVaqt ? '⚠ ' + xavfliVaqt + ' ta jadvalga yozadigan vaqt ishi serverda emas (eski trigger yozadi)' : '✅ Vaqt ishlari: jadvalga yozadiganlarning hammasi serverda');

  // 3 ──────────────────────────────────────────────────────────────
  sarlavha('3. Eski tizimga chaqiruvlar — oxirgi 14 kun (rpc_jurnal)');
  const { oqishmi } = require('../api/kesh');
  const R = (await q(`SELECT fn, qayerda, count(*)::int n, count(*) FILTER (WHERE ok)::int ok, max(vaqt) oxirgi
                      FROM rpc_jurnal WHERE vaqt > now() - interval '14 days' AND qayerda IN ('eski', 'koprik', 'tg')
                      GROUP BY fn, qayerda ORDER BY fn, qayerda`)).rows;
  const tartib = { 'YOZADI': 0, 'YOZISHI MUMKIN': 1, 'o\'qish': 2, 'serverda': 3, 'zararsiz': 4 };
  const L = R.map(r => Object.assign({}, r, tasnif(r.fn, oqishmi, r.qayerda))).sort((a, b) => (tartib[a.t] - tartib[b.t]) || b.n - a.n);
  if (!L.length) console.log('  14 kunda eski tizimga birorta ham chaqiruv yo\'q.');
  else {
    console.log('  ' + chap('Amal', 26) + chap('Qayerda', 8) + ong('Soni', 6) + ong('OK', 6) + '  ' + chap('Oxirgi', 17) + 'Tasnif');
    for (const r of L) {
      const faol = Date.now() - new Date(r.oxirgi).getTime() < 7 * 86400000;
      const belgi = (r.t === 'YOZADI' || r.t === 'YOZISHI MUMKIN') ? (faol ? '⚠' : '·') : ' ';
      console.log(belgi + ' ' + chap(r.fn, 26) + chap(r.qayerda, 8) + ong(r.n, 6) + ong(r.ok, 6) + '  ' + chap(new Date(r.oxirgi).toLocaleString('sv-SE', { timeZone: 'Asia/Tashkent' }).slice(0, 16), 17) +
        r.t + ' — ' + r.izoh);
    }
  }
  console.log('  ⚠ — oxirgi 7 kunda ham bo\'lgan; · — 7 kundan beri yo\'q (to\'xtagan).');
  const yoz7 = new Map();
  L.filter(r => r.qayerda === 'eski' && (r.t === 'YOZADI' || r.t === 'YOZISHI MUMKIN') && r.ok > 0 && Date.now() - new Date(r.oxirgi).getTime() < 7 * 86400000)
    .forEach(r => yoz7.set(r.fn, r.ok));
  xulosa.push(yoz7.size ? '⚠ Oxirgi 7 kunda eski tizim orqali jadvalga yozuv: ' + [...yoz7].map(([f, n]) => f + ' (' + n + ')').join(', ') + ' — reja 5-bo\'lim' : '✅ Oxirgi 7 kunda eski tizim orqali jadvalga yozuv yo\'q');

  // 4 ──────────────────────────────────────────────────────────────
  sarlavha('4. 09c_Taminotchilar_yuridik — raqamli ustunlar qanday saqlangan');
  try {
    const K = await G.kataklarOqi(env.aksBazaId, '09c_Taminotchilar_yuridik', 'A1:J', env.googleKey);
    const sar = (K[0] || []).map(c => s(c.formattedValue));
    console.log('  Sarlavha: ' + sar.join(' | '));
    const qatorlar = K.slice(1).map((r, i) => ({ n: i + 2, r })).filter(z => (z.r || []).some(c => c && (c.effectiveValue || c.userEnteredValue)));
    console.log('  Qatorlar: ' + qatorlar.length);
    let buzuq = 0;
    for (const [h, i, nom, xona] of C09) {
      let son = 0, matn = 0, bosh = 0; const fmt = {}, aniqlik = [], qisqa = [];
      for (const z of qatorlar) {
        const c = z.r[i] || {}, ev = c.effectiveValue || {};
        const nf = c.userEnteredFormat && c.userEnteredFormat.numberFormat; const f = nf ? (nf.type || '') + (nf.pattern ? ' ' + nf.pattern : '') : 'standart';
        if (ev.numberValue === undefined && ev.stringValue === undefined) { bosh++; continue; }
        fmt[f] = (fmt[f] || 0) + 1;
        if (ev.numberValue !== undefined) {
          son++;
          const v = ev.numberValue, raqam = Number.isInteger(v) ? String(Math.abs(v)) : '';
          if (Math.abs(v) > Number.MAX_SAFE_INTEGER || /E\+/i.test(s(c.formattedValue))) aniqlik.push(z.n);
          else if (raqam && raqam.length < xona) qisqa.push(z.n);
        } else matn++;
      }
      const b = aniqlik.length + qisqa.length; buzuq += b;
      console.log('  ' + h + ' ' + chap(nom, 18) + ' matn: ' + ong(matn, 3) + ' · son: ' + ong(son, 3) + ' · bo\'sh: ' + ong(bosh, 3) + ' · format: ' +
        (Object.entries(fmt).map(([k, v]) => k + ' (' + v + ')').join(', ') || '—'));
      if (aniqlik.length) console.log('      ⛔ aniqligi yo\'qolgan (15 xonadan uzun son): qator ' + aniqlik.join(', '));
      if (qisqa.length) console.log('      ⚠ ' + xona + ' xonadan kam (boshidagi 0 tushgan bo\'lishi mumkin): qator ' + qisqa.join(', '));
    }
    console.log('  (Raqamlarning o\'zi ko\'rsatilmaydi. «son» — Google uni matn emas, son deb saqlagan.)');
    xulosa.push(buzuq ? '⚠ 09c: ' + buzuq + ' katakda raqam buzilgan bo\'lishi mumkin — qatorlarni Google\'da tekshirish kerak' : '✅ 09c: buzilgan raqam topilmadi');
  } catch (e) { console.log('  ⛔ o\'qib bo\'lmadi: ' + e.message); xulosa.push('⚠ 09c o\'qilmadi: ' + e.message.slice(0, 80)); }

  // 5 ──────────────────────────────────────────────────────────────
  sarlavha('5. 2a kuzatuvi — oxirgi «baza» solishtiruvlari');
  try {
    const Y = (await q(`SELECT boshlandi, holat, ms, hisobot->'solishtir' AS sol, xato_matn FROM baza_yuklashlar ORDER BY id DESC LIMIT 7`)).rows;
    for (const y of Y) {
      const sol = y.sol || null;
      console.log('  ' + new Date(y.boshlandi).toLocaleString('sv-SE', { timeZone: 'Asia/Tashkent' }).slice(0, 16) + '  ' + chap(y.holat, 10) +
        (sol ? 'katak ' + sol.katak + ' · farq ' + sol.farq + (sol.farq ? ' ⚠' : ' ✅') : (y.xato_matn ? '⛔ ' + s(y.xato_matn).slice(0, 60) : 'faqat qurish (solishtiruvsiz)')));
    }
    const sol = Y.filter(y => y.sol);
    xulosa.push(sol.length ? (sol.some(y => y.sol.farq) ? '⚠ 2a: farq bo\'lgan kecha bor' : '✅ 2a: ' + sol.length + ' ta solishtiruv, hammasi 0 farq') : 'ℹ 2a: hali solishtiruv yozuvi yo\'q');
  } catch (e) { console.log('  ⛔ ' + e.message); }

  sarlavha('XULOSA');
  xulosa.forEach(x => console.log('  ' + x));
  console.log('\nBu natijani Claude\'ga yuboring (matn ko\'rinishida).');
  await pool.end(); redis.disconnect(); process.exit(0);
})().catch(async e => { console.error('XATO:', e.message); try { await pool.end(); redis.disconnect(); } catch (z) { } process.exit(1); });
