// AKS TIZIM — 🗄 BAZA KO'CHIRISHI, 2a: har kecha avtomatik solishtirish (01.11.2026, direktor topshirig'i).
// lib/vaqt.js ishi «baza_solishtir» (03:00): «baza» ni ko'zgudan yangidan quradi (aks-baza toldir) va har qatorni Google hisobi bilan
// solishtiradi (aks-baza solishtir). Hammasi bir xil bo'lsa — jim (natija jurnalda: aks-baza, aks-vaqt). FARQ bo'lsa yoki qurish
// to'xtasa (masalan Google'da ustun surilgan) — direktorga Telegram: qaysi ustun, nechta, misollar.
// Google jadvalga va ilovaga TEGMAYDI.
'use strict';
const { pool } = require('./db');
const B = require('./baza');
const BS = require('./baza_solishtir');

const esc = v => String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const pul = v => typeof v === 'number' ? v.toLocaleString('ru-RU').replace(/ /g, ' ') : String(v);

function xabarMatn(R) {
  const F = R.ustunlar.filter(u => u.farq);
  const jami = F.reduce((a, u) => a + u.farq, 0);
  const L = ['🗄 <b>Baza solishtiruvi — FARQ bor</b>',
    'Server hisobi Google jadval bilan ' + jami + ' katakda farq qildi (BUGUN = ' + esc(R.bugun) + ').', ''];
  for (const u of F.slice(0, 8)) {
    L.push('• <b>' + esc(u.varaq) + ' ' + esc(u.harf) + '</b> (' + esc(u.ustun) + ') — ' + u.farq + ' ta');
    u.misollar.slice(0, 3).forEach(m => L.push('   ' + esc(m.no) + ' (qator ' + m.qator + '): Google ' + esc(pul(m.google)) + ' · server ' + esc(pul(m.server))));
  }
  if (F.length > 8) L.push('… yana ' + (F.length - 8) + ' ustun');
  L.push('', 'Ilovaga ta\'siri yo\'q (ilova hali Google jadvaldan o\'qiydi). To\'liq ro\'yxat: <code>aks-baza solishtir --toldirmasdan</code> — Claude\'ga ko\'rsating.');
  return L.join('\n');
}

// ---------- 3-bosqich (2b): ikki tomonlama yozish YONIQ bo'lsa — «baza» doimiy (server yozib boradi), qayta qurilmaydi. Har kecha:
// ko'zgu Google'dan yangilanadi → «baza_tekshir» quriladi → har katak solishtiriladi (lib/ikki_solishtir.js) → farqlar tuzatiladi →
// 2a (server hisobi ↔ Google hisobi) doimiy «baza» ustida. Server yozgan qatorda farq / jurnalda xato / 2a farq bo'lsa — direktorga xabar.
function ikkiXabar(R, jx, R2a) {
  const L = ['🗄 <b>Ikki tomonlama yozish — kunlik tekshiruv</b>', ''];
  if (R.jami.ikki) {
    L.push('⚠ Server yozgan qatorlarda «baza» Google\'dan <b>' + R.jami.ikki + '</b> qatorda farq qildi:');
    for (const h of R.jadvallar.filter(z => z.ikki).slice(0, 6)) {
      L.push('• <b>' + esc(h.varaq) + '</b> — ' + h.ikki + ' qator: ' + esc(Object.entries(h.ustunlar).slice(0, 4).map(([u, n]) => u + ' ' + n).join(', ')));
      h.misollar.filter(m => m.tur === 'ikki').slice(0, 2).forEach(m => L.push('   qator ' + m.qator + (m.amal ? ' [' + esc(m.amal) + ']' : '') + ': ' +
        esc(m.ustunlar.map(u => typeof u === 'string' ? u : u.ustun + ' — baza ' + pul(u.a) + ' · Google ' + pul(u.b)).join(' | ').slice(0, 300))));
    }
  }
  if (jx.xato) L.push('⚠ Jurnalda <b>' + jx.xato + '</b> ta yozuv server bazasiga yozilmagan (xato).');
  if (R2a && R2a.farq) L.push('⚠ 2a: server hisobi Google hisobidan ' + R2a.farq + ' katakda farq qildi (aks-baza solishtir --toldirmasdan).');
  L.push('', 'Tashqi o\'zgarish (server tegmagan qatorlar — Google\'da qo\'lda yoki eski tizim): ' + R.jami.tashqi + ' qator.',
    '«baza» Google holatiga keltirildi (' + R.jami.tuzatildi + ' qator). Ilovaga ta\'siri yo\'q (ilova hali Google jadvaldan o\'qiydi).',
    'Batafsil: <code>aks-baza ikki</code>, <code>aks-baza ikki jurnal --xato</code> — Claude\'ga ko\'rsating.');
  return L.join('\n');
}
async function ikkiTekshir(opt = {}) {
  const IS = require('./ikki_solishtir');
  const db = await pool.connect();
  let yid = null;
  try {
    yid = (await db.query(`INSERT INTO baza_yuklashlar (holat) VALUES ('ishlayapti') RETURNING id`)).rows[0].id;
    const o = (await db.query(`SELECT hisobot->'ikki'->>'dan' dan FROM baza_yuklashlar WHERE holat = 'ok' AND hisobot ? 'ikki' ORDER BY id DESC LIMIT 1`)).rows[0];
    const oldin = o && o.dan ? new Date(o.dan) : new Date(Date.now() - 26 * 3600000), dan = new Date(Date.now() - 60000);
    await require('./kozgu_tetik').yangila();
    let n;
    try { n = await B.toldir(db, { sxema: 'baza_tekshir' }); }
    catch (e) {
      await db.query(`UPDATE baza_yuklashlar SET tugadi = now(), holat = 'xato', xato_matn = $2 WHERE id = $1`, [yid, String(e.message).slice(0, 2000)]);
      const m = '🗄 <b>Kunlik tekshiruv to\'xtadi</b> (ikki tomonlama yozish)\n' + esc(e.message) + '\n\n«baza» o\'z joyida, server yozishda davom etadi. Ilovaga ta\'siri yo\'q. Claude\'ga ko\'rsating.';
      if (opt.quruq) return { quruq: true, xabarlar: [{ kimga: 'direktor', matn: m }] };
      await require('./telegram').direktor(m);
      return { ok: false, toxtadi: e.message.slice(0, 200), yuborildi: 1 };
    }
    const R = await IS.solishtir(db, { dan, oldin, tuzat: !opt.quruq });
    const R2 = await BS.solishtir(db);
    const farq2a = R2.ustunlar.reduce((a, u) => a + u.farq, 0);
    const jx = {}; (await db.query(`SELECT holat, count(*)::int n FROM baza_ikki_jurnal WHERE vaqt >= $1 GROUP BY 1`, [oldin])).rows.forEach(r => { jx[r.holat] = r.n; });
    if (!opt.quruq) await db.query(`DELETE FROM baza_ikki_jurnal WHERE vaqt < now() - interval '45 days'`);
    const ikki = { dan, oldin, jami: R.jami, jurnal: jx, jadvallar: R.jadvallar.filter(h => h.farq || h.chiqarildi).map(h => ({ jadval: h.jadval, farq: h.farq, ikki: h.ikki, tashqi: h.tashqi,
      chiqarildi: h.chiqarildi, ustunlar: h.ustunlar, misollar: h.misollar.slice(0, 3) })) };
    await db.query(`UPDATE baza_yuklashlar SET tugadi = now(), holat = 'ok', ms = $2, hisobot = $3 WHERE id = $1`,
      [yid, n.ms, JSON.stringify(Object.assign({}, n, { [opt.quruq ? 'ikki_quruq' : 'ikki']: ikki, solishtir: { farq: farq2a, bugun: R2.bugun } }))]);   // quruq — keyingi oynaga ta'sir qilmasin
    const natija = { ikki: R.jami.ikki, tashqi: R.jami.tashqi, tuzatildi: R.jami.tuzatildi, jurnalXato: jx.xato || 0, farq2a };
    if (!R.jami.ikki && !jx.xato && !farq2a) return natija;
    const m = ikkiXabar(R, jx, { farq: farq2a });
    if (opt.quruq) return Object.assign(natija, { quruq: true, xabarlar: [{ kimga: 'direktor', matn: m }] });
    await require('./telegram').direktor(m);
    return Object.assign(natija, { yuborildi: 1 });
  } catch (e) {
    if (yid) await db.query(`UPDATE baza_yuklashlar SET tugadi = now(), holat = 'xato', xato_matn = $2 WHERE id = $1`, [yid, String(e.message).slice(0, 2000)]).catch(() => {});
    throw e;
  } finally { db.release(); }
}

async function bazaSolishtir(kod, opt = {}) {
  let ikkiYon = false;
  try { ikkiYon = await require('./ikki_yozuv').yoqilganmi(); } catch (e) { }
  if (ikkiYon) return ikkiTekshir(opt);
  const db = await pool.connect();
  let yid = null;
  try {
    yid = (await db.query(`INSERT INTO baza_yuklashlar (holat) VALUES ('ishlayapti') RETURNING id`)).rows[0].id;
    let n;
    try { n = await B.toldir(db); }
    catch (e) {
      await db.query(`UPDATE baza_yuklashlar SET tugadi = now(), holat = 'xato', xato_matn = $2 WHERE id = $1`, [yid, String(e.message).slice(0, 2000)]);
      const m = '🗄 <b>Baza solishtiruvi to\'xtadi</b>\n' + esc(e.message) + '\n\nEski «baza» o\'z joyida. Ilovaga ta\'siri yo\'q. Claude\'ga ko\'rsating.';
      if (opt.quruq) return { quruq: true, xabarlar: [{ kimga: 'direktor', matn: m }] };
      await require('./telegram').direktor(m);
      return { ok: false, toxtadi: e.message.slice(0, 200), yuborildi: 1 };
    }
    const R = await BS.solishtir(db);
    const katak = R.ustunlar.reduce((a, u) => a + u.jami, 0), farq = R.ustunlar.reduce((a, u) => a + u.farq, 0);
    const xulosa = { katak, farq, bugun: R.bugun, ustunlar: R.ustunlar.filter(u => u.farq).map(u => ({ varaq: u.varaq, harf: u.harf, farq: u.farq, misollar: u.misollar.slice(0, 5) })) };
    await db.query(`UPDATE baza_yuklashlar SET tugadi = now(), holat = 'ok', ms = $2, hisobot = $3 WHERE id = $1`, [yid, n.ms, JSON.stringify(Object.assign({}, n, { solishtir: xulosa }))]);
    if (!farq) return { katak, farq: 0, qator: n.jadvallar.reduce((a, t) => a + t.qator, 0), xatolar: n.xatolar };
    const m = xabarMatn(R);
    if (opt.quruq) return { quruq: true, katak, farq, xabarlar: [{ kimga: 'direktor', matn: m }] };
    await require('./telegram').direktor(m);
    return { katak, farq, yuborildi: 1 };
  } finally { db.release(); }
}

module.exports = { bazaSolishtir, xabarMatn, ikkiXabar, ikkiTekshir };
