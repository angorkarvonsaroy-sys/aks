#!/usr/bin/env node
// AKS TIZIM — 📋 BAZA INVENTARIZATSIYASI (baza ko'chirish 0-bosqichi; direktor qarori 26.10.2026: AKS_BAZA ga qo'l tegmaydi).
// HECH NARSA YOZMAYDI — faqat o'qiydi va ro'yxat chiqaradi.
//   aks-inventar            — barcha varaqlar: qator/ustun soni, formulali ustunlar soni
//   aks-inventar <varaq>    — bitta varaq: har ustun — sarlavha, formulami yoki qo'lda, namuna qiymat
//   aks-inventar hammasi    — to'liq hisobot /opt/aks/private/inventar.md ga yoziladi
'use strict';
process.env.AKS_ENV = process.env.AKS_ENV || '/opt/aks/.env';
const fs = require('fs');
const G = require('../lib/google');
const env = require('../lib/env');

const ID = env.aksBazaId, KEY = env.googleKey;
const NAMUNA = 60;   // formulani aniqlash uchun nechta qator qaraladi
const harf = n => { let r = ''; while (n > 0) { const m = (n - 1) % 26; r = String.fromCharCode(65 + m) + r; n = Math.floor((n - 1) / 26); } return r; };
const s = v => String(v == null ? '' : v);
const qis = (v, n) => { const t = s(v).replace(/\s+/g, ' ').trim(); return t.length > n ? t.slice(0, n - 1) + '…' : t; };

async function batch(ranges, render) {
  const out = {};
  for (let i = 0; i < ranges.length; i += 20) {
    const q = ranges.slice(i, i + 20);
    const p = new URLSearchParams({ valueRenderOption: render, dateTimeRenderOption: 'FORMATTED_STRING', majorDimension: 'ROWS' });
    q.forEach(r => p.append('ranges', r));
    const j = await G.ol(`https://sheets.googleapis.com/v4/spreadsheets/${ID}/values:batchGet?${p}`, KEY);
    (j.valueRanges || []).forEach((vr, k) => { out[q[k]] = vr.values || []; });
  }
  return out;
}

async function varaqOqi(V) {
  const R = V.map(v => `'${v.title.replace(/'/g, "''")}'!A1:${harf(Math.min(v.gridProperties.columnCount, 60))}${NAMUNA}`);
  const [F, K] = [await batch(R, 'FORMULA'), await batch(R, 'FORMATTED_VALUE')];
  return V.map((v, i) => {
    const f = F[R[i]] || [], k = K[R[i]] || [];
    const sarl = (k[0] || []).map(x => s(x).trim());
    const n = Math.max(sarl.length, ...f.map(r => r.length), 0);
    const ust = [];
    for (let c = 0; c < n; c++) {
      let form = '', namuna = '';
      for (let r = 1; r < f.length; r++) { const x = s((f[r] || [])[c]); if (x.charAt(0) === '=') { form = x; break; } }
      for (let r = 1; r < k.length; r++) { const x = s((k[r] || [])[c]).trim(); if (x) { namuna = x; break; } }
      ust.push({ harf: harf(c + 1), sarl: sarl[c] || '', form, namuna });
    }
    return { nom: v.title, qator: v.gridProperties.rowCount, ustun: v.gridProperties.columnCount, ust };
  });
}

function varaqChiz(x) {
  const L = [];
  L.push('');
  L.push('=== ' + x.nom + ' ===  (' + x.qator + ' qator × ' + x.ustun + ' ustun)');
  L.push('UST  SARLAVHA                       TURI      NAMUNA');
  x.ust.forEach(u => {
    if (!u.sarl && !u.namuna && !u.form) return;
    L.push(' ' + u.harf.padEnd(4) + qis(u.sarl, 30).padEnd(32) + (u.form ? 'FORMULA  ' : "qo'lda   ") + qis(u.form || u.namuna, 60));
  });
  return L.join('\n');
}

(async () => {
  const arg = (process.argv[2] || '').trim();
  const M = await G.varaqlar(ID, KEY);
  const V = M.varaqlar.filter(v => !/^zz_/.test(v.title));
  console.log('================ 📋 BAZA INVENTARIZATSIYASI — ' + M.nom + ' ================');
  console.log(V.length + ' varaq (zz_sinov_* hisobga olinmadi). HECH NARSA YOZILMAYDI.\n');
  const X = await varaqOqi(V);
  if (arg && arg !== 'hammasi') {
    const x = X.find(z => z.nom.toLowerCase().indexOf(arg.toLowerCase()) >= 0);
    if (!x) { console.log('Varaq topilmadi: ' + arg + '\nBor varaqlar: ' + X.map(z => z.nom).join(', ')); process.exit(0); }
    console.log(varaqChiz(x));
    process.exit(0);
  }
  if (arg === 'hammasi') {
    const yol = '/opt/aks/private/inventar.md';
    fs.writeFileSync(yol, '# AKS_BAZA inventarizatsiyasi — ' + new Date().toISOString().slice(0, 16).replace('T', ' ') + '\n\n```' + X.map(varaqChiz).join('\n') + '\n```\n');
    console.log('To\'liq hisobot yozildi: ' + yol + ' (' + Math.round(fs.statSync(yol).size / 1024) + ' KB)');
  }
  console.log('VARAQ                          QATOR  USTUN  FORMULALI  QO\'LDA');
  let jf = 0, jq = 0;
  X.forEach(x => {
    const f = x.ust.filter(u => u.form).length, q = x.ust.filter(u => !u.form && (u.sarl || u.namuna)).length;
    jf += f; jq += q;
    console.log(qis(x.nom, 30).padEnd(31) + String(x.qator).padStart(5) + String(x.ustun).padStart(7) + String(f).padStart(11) + String(q).padStart(8));
  });
  console.log('-'.repeat(62));
  console.log('JAMI'.padEnd(31) + ''.padStart(5) + ''.padStart(7) + String(jf).padStart(11) + String(jq).padStart(8));
  console.log('\nBitta varaqni batafsil ko\'rish: aks-inventar <varaq nomi>');
  console.log('To\'liq hisobot fayli:            aks-inventar hammasi');
  process.exit(0);
})().catch(e => { console.error('Xato:', e.message); process.exit(1); });
