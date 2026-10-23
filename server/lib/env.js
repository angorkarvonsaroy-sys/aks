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
  hujjatPapka: E.HUJJAT_PAPKA || '/opt/aks/hujjat',      // skanlar serverda (Drive'ga fonda ko'chadi)
  redisUrl: E.REDIS_URL || 'redis://127.0.0.1:6379',
  appPort: Number(E.APP_PORT || 3000),
  // Eski tizim (Apps Script) ko'prigi: serverda hali yozilmagan amallar o'sha yerga yuboriladi. Bo'sh bo'lsa — ko'prik yo'q.
  bridgeUrl: E.BRIDGE_URL || '',
  bridgeSecret: E.BRIDGE_SECRET || '',
  // Xodimlar ilovasi (Index.html) — faqat serverda turadi, GitHub'ga qo'yilmaydi
  uiFayl: E.UI_FAYL || '/opt/aks/private/Index.html',
  xaritaFayl: E.XARITA_FAYL || '/opt/aks/private/Xarita.html',
  // 1-kompaniya (Angor Karvon Saroy) jadvali; boshqa kompaniyalar bazadagi kompaniyalar jadvalidan olinadi
  // Telegram bot kaliti (23.10.2026 reja, 1-qadam): faqat /opt/aks/.env da (TG_TOKEN=…); bo'sh bo'lsa — Telegram avvalgidek Koprik orqali. TG_GURUH — hisobot guruhi chat ID.
  tgToken: E.TG_TOKEN || '',
  tgGuruh: E.TG_GURUH || '',
  ilovaUrl: E.ILOVA_URL || 'https://aks-tizim.uz/',   // Telegram tugmalaridagi havola (devonDirShaxsiy_: ILOVA_URL?k=<kod>)
  aksBazaId: E.AKS_BAZA_ID || '1qqBgS99WeIVEq_BwQ4-qdUWpRoGAKJpUum86aCDSJJE',
};
