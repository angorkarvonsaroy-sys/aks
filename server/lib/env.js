// AKS TIZIM — sozlamalarni /opt/aks/.env dan o'qish (sirlar faqat serverda turadi, GitHub'ga tushmaydi)
'use strict';
const fs = require('fs');

function oqi(fayl) {
  const natija = {};
  let matn = '';
  try { matn = fs.readFileSync(fayl, 'utf8'); } catch (e) { return natija; }
  for (const qator of matn.split(/\r?\n/)) {
    const m = qator.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    let v = m[2];
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    natija[m[1]] = v;
  }
  return natija;
}

const fayl = process.env.AKS_ENV || '/opt/aks/.env';
const E = Object.assign({}, oqi(fayl), process.env);

module.exports = {
  db: {
    host: E.DB_HOST || '127.0.0.1',
    port: Number(E.DB_PORT || 5432),
    database: E.DB_NAME || 'aks_tizim',
    user: E.DB_USER || 'aks',
    password: E.DB_PASS || undefined,
  },
  googleKey: E.GOOGLE_KEY || '/opt/aks/google-key.json',
  // 1-kompaniya (Angor Karvon Saroy) jadvali; boshqa kompaniyalar bazadagi kompaniyalar jadvalidan olinadi
  aksBazaId: E.AKS_BAZA_ID || '1qqBgS99WeIVEq_BwQ4-qdUWpRoGAKJpUum86aCDSJJE',
};
