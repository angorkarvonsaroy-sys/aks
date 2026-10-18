#!/usr/bin/env node
// AKS TIZIM — jadvaldagi «BUGUN» katagi (formulalar bugungi sanani shundan oladi) bugungi sanadami — tekshirish.
// Eski tizimda bu katakni doGet (xodim eski havolani ochganda) yangilardi. Ishlatish: aks-sana
'use strict';
process.env.AKS_ENV = process.env.AKS_ENV || '/opt/aks/.env';
const { pool, redis } = require('../lib/db');
const G = require('../lib/google');
const env = require('../lib/env');
const V = require('../lib/varaq');
const harf = n => { let s = ''; n++; while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s; };

(async () => {
  const bugun = V.bugun().split('-').reverse().join('.');
  console.log('================ «BUGUN» KATAGI ================');
  console.log('Bugun (Toshkent): ' + bugun);
  // 1) nomlangan oraliqlar
  let j = {}; try { j = await G.ol(`https://sheets.googleapis.com/v4/spreadsheets/${env.aksBazaId}?fields=namedRanges(name,range),sheets.properties(sheetId,title)`, env.googleKey); } catch (e) { console.log('Google: ' + e.message); }
  const NOM = {}; (j.sheets || []).forEach(s => { NOM[s.properties.sheetId] = s.properties.title; });
  const NR = j.namedRanges || [];
  console.log('\nNomlangan oraliqlar: ' + (NR.length ? NR.length + ' ta' : 'yo\'q'));
  for (const n of NR) {
    const r = n.range || {}; const v = NOM[r.sheetId || 0] || '?';
    const a1 = harf(r.startColumnIndex || 0) + ((r.startRowIndex || 0) + 1);
    let qiy = '';
    let kiritilgan = '';
    try { const c = ((await G.kataklarOqi(env.aksBazaId, v, a1, env.googleKey))[0] || [])[0] || {};
      qiy = String(c.formattedValue == null ? '' : c.formattedValue); const ue = c.userEnteredValue || {}; kiritilgan = ue.formulaValue ? 'formula ' + ue.formulaValue : (Object.keys(ue).length ? 'qo\'lda/kod yozgan qiymat' : 'bo\'sh'); } catch (e) { qiy = 'o\'qib bo\'lmadi: ' + e.message; }
    console.log('  • ' + n.name + ' = ' + v + '!' + a1 + ' → «' + qiy + '» (' + kiritilgan + ')' + (qiy.indexOf(bugun) === 0 ? '  ✅ bugungi' : (/^\d{2}\.\d{2}\.\d{4}/.test(qiy) ? '  ⚠ BUGUNGI EMAS' : '')));
  }
  // 2) ko'zguda «BUGUN» yozuvi bor kataklar (yorliq) va yonidagi qiymat
  const R = (await pool.query("SELECT varaq, qator_no, korinish FROM kozgu.qatorlar WHERE kompaniya_id = 1 AND korinish::text ILIKE '%bugun%' ORDER BY varaq, qator_no")).rows;
  const T = [];
  R.forEach(({ varaq, qator_no, korinish }) => { (korinish || []).forEach((c, i) => { const s = String(c || '').trim(); if (s.length <= 25 && /^bugun\b/i.test(s)) T.push(varaq + '!' + harf(i) + qator_no + ' «' + s + '» → yonida: ' + korinish.slice(i + 1, i + 4).map(x => JSON.stringify(x)).join(', ')); }); });
  console.log('\n«BUGUN» yorlig\'i bor kataklar: ' + (T.length ? T.length + ' ta' : 'topilmadi'));
  T.slice(0, 20).forEach(x => console.log('  • ' + x));
  await pool.end(); redis.disconnect(); process.exit(0);
})().catch(async e => { console.error('XATO:', e.message); try { await pool.end(); redis.disconnect(); } catch (z) { } process.exit(1); });
