#!/usr/bin/env node
// AKS TIZIM — Drive'dagi skanlarni (06d_Hujjatlar, Faol) serverga nusxalash: /opt/aks/hujjat/<shartnoma>/<nom>.
// Drive asosiy arxiv bo'lib qoladi; serverdagi nusxa — tez ochish uchun. Bor fayl qayta olinmaydi. Robot faqat O'QIYDI (Drive'ga hech narsa yozmaydi).
// Har kecha 02:30 (aks-skan.timer) va qo'lda: aks-skan [soni]
'use strict';
process.env.AKS_ENV = process.env.AKS_ENV || '/opt/aks/.env';
const fs = require('fs');
const path = require('path');
const env = require('../lib/env');
const G = require('../lib/google');
const J = require('../lib/jurnallar');
const { pool, redis } = require('../lib/db');

(async () => {
  const max = Number(process.argv[2]) || 400;   // bir yurishda ko'pi bilan shuncha fayl (Drive kvotasi va vaqt)
  const ILDIZ = env.hujjatPapka || '/opt/aks/hujjat';
  const L = (await J.hujjatJurnal()).filter(h => h.holati === 'Faol' && h.faylId && !/^SRV:/.test(String(h.faylId)));
  let bor = 0, olindi = 0, xato = 0, bayt = 0; const t0 = Date.now();
  for (const h of L) {
    const papka = path.join(ILDIZ, String(h.no).replace(/\//g, '-')), yol = path.join(papka, String(h.nom || (h.faylId + '.pdf')));
    if (fs.existsSync(yol) && fs.statSync(yol).size > 0) { bor++; continue; }
    if (olindi + xato >= max) break;
    try {
      const f = await G.driveFayl(h.faylId, env.googleKey);
      fs.mkdirSync(papka, { recursive: true });
      fs.writeFileSync(yol + '.qism', f.bytes, { mode: 0o640 }); fs.renameSync(yol + '.qism', yol);
      olindi++; bayt += f.bytes.length;
    } catch (e) { xato++; if (xato <= 5) console.error('  ' + h.no + ' ' + h.nom + ': ' + e.message); }
  }
  console.log(`${new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Tashkent' })}  skanlar: jurnalda ${L.length} ta · serverda bor edi ${bor} · olindi ${olindi} (${Math.round(bayt / 1048576)} MB) · xato ${xato} · ${Math.round((Date.now() - t0) / 1000)} s`);
  await pool.end(); redis.disconnect(); process.exit(xato && !olindi ? 1 : 0);
})().catch(e => { console.error('XATO:', e.message); process.exit(1); });
