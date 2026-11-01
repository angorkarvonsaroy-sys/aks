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

async function bazaSolishtir(kod, opt = {}) {
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

module.exports = { bazaSolishtir, xabarMatn };
