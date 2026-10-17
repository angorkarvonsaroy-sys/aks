// AKS TIZIM — ko'zguni DARHOL yangilash (yozuvdan keyin). Eski tizimga yozilgan narsa 5 daqiqa kutmasdan serverda ko'rinsin.
// Bir vaqtda bitta yurish; yurish paytida yana so'ralsa — tugagach yana bir marta yuradi (yozuv o'tkazib yuborilmasin).
'use strict';
const { Client } = require('pg');
const env = require('./env');
const V = require('./varaq');
const { kompaniyaKozgusi } = require('../kozgu');

let yolda = null, navbat = false;
function yangila() {
  if (yolda) { navbat = true; return yolda; }
  yolda = (async () => {
    do {
      navbat = false;
      const db = new Client(env.db);
      await db.connect();
      try {
        const k = (await db.query('SELECT id, nom, sheet_id FROM kompaniyalar WHERE id=1 AND faol AND sheet_id IS NOT NULL')).rows[0];
        if (k) await kompaniyaKozgusi(db, k);
      } finally { await db.end().catch(() => {}); }
      V.tozala();
    } while (navbat);
  })().catch(e => console.error(new Date().toISOString(), 'ko\'zgu (yozuvdan keyin):', e.message)).finally(() => { yolda = null; });
  return yolda;
}
// Server o'zi yozgan varaqlarni darhol qayta o'qish (faqat shular — tez). Butun yurish ketayotgan bo'lsa — o'sha tugashini kutadi.
async function varaqlarYangila(nomlar) {
  const db = new Client(env.db);
  await db.connect();
  try {
    const k = (await db.query('SELECT id, nom, sheet_id FROM kompaniyalar WHERE id=1 AND faol AND sheet_id IS NOT NULL')).rows[0];
    if (k) await kompaniyaKozgusi(db, k, nomlar);
  } finally { await db.end().catch(() => {}); V.tozala(); }
}
// Ko'pi bilan ms kutadi: ko'zgu cho'zilsa javob baribir qaytadi (fon davom etadi)
function yangilaKut(ms) { return Promise.race([yangila(), new Promise(r => setTimeout(r, ms))]); }

module.exports = { yangila, yangilaKut, varaqlarYangila };
