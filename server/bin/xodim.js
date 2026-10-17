#!/usr/bin/env node
// AKS TIZIM — xodimni yangi tizimga (aks-tizim.uz) o'tkazishdan oldin tekshirish.
// Ishlatish: aks-xodim <ism yoki familiya bo'lagi>      (masalan: aks-xodim nurbek)
// Ko'rsatadi: 07_Xodimlar dagi yozuvi (holat, huquqlar, kirish kodi, PIN, Telegram), oxirgi kirishlari,
// uning huquqlari ochadigan har bir amal hozir qayerda bajariladi: ✅ serverda (tez) yoki ⏳ eski tizim orqali (sekinroq, lekin ishlaydi).
// Hech narsa yozmaydi.
'use strict';
process.env.AKS_ENV = process.env.AKS_ENV || '/opt/aks/.env';
const { pool, redis, q } = require('../lib/db');
const A = require('../api/amallar');

// Eski tizim (Index.html) chaqiradigan amallar → qaysi huquq ochadi ('*' — har bir xodim; 'admin' — faqat direktor)
const XARITA = {
  '*': 'devonChiqimOl devonChiqimYoz devonChiqimYubor devonFayl devonIjroHolat devonIjroTopshir ijroKorish ijroTushuntir pinHolat pinKir pinKodYubor pinOrnat pinTirik qaytaHujjatlar qaytaOchiq qaytaSkan qaytaTekshiruvga sifatBilet tgUlanishBoshla tgUlanishTekshir topBajardim topMalumotKirit topMening topSkanBerilmagan topSkanTopilmadi topSkanZaynabga topTasdiq xatTopPdf xatTopTayyorla xatTopYuborildi xodimBosh',
  'admin': 'bekorDirektor bekorQaytarish bekorTasdiq boshMalumot boshRejaYoz devonBekor devonDirektor devonKordi devonRezQaytar devonRezolyutsiya devonTasdiq hujjatNazorat ijaraImzosizBekor ijaraImzosizJavob ijaraImzosizRoyxat ijroUzrli kbDirektor kbTasdiq monBoshlang monSorovJavob qadamJamoa qadamMuhlatRuxsat qadamOtkazRuxsat qaytaBekor qaytaIjrochi qaytaKor qaytaLoyiha qaytaQaytar qaytaTasdiq sifatAsosiy sifatHavola sifatXodimlar taminotDalolatnoma taminotDirektor taminotSvodOl taminotTasdiq taminotTilxat taminotTolov topBekorQil topBer topHozir topMalumotTasdiq topQoidaYoz topRoyxat topXodimlar tqAmal tqFayl tqRoyxat xatNazorat yuristTasdiq yuristTogridan',
  'devon': 'devonBoshlang',
  'hisobot': 'hisobotMalumot hisobotPdf',
  'hujjat': 'hujjatBoshlang hujjatTuzat hujjatYukla hujjatlarRoyxati',
  'ijara_kelishuv': 'kbBekor kbFayl kbHolat kbSkan kbTayyorla',
  'reyestr': 'reyestrExcel reyestrIjara reyestrPdf reyestrSotuv reyestrSotuvExcel reyestrSotuvPdf',
  'shartnoma': 'ijaraImzosizHolat ijaraImzosizSorov ijaraSaqlash jadvalHisob mijozSaqlash shartnomaBoshlang shartnomaSaqlash tahrirHolat tahrirSaqlash',
  'shartnoma,undiruv,hujjat,tolov,xat,yurist': 'mijozKarta mijozKartaPdf mijozQidir',
  'taminot': 'taminotBoshlang taminotFirmaQosh taminotKiritish',
  'tashrif': 'bugungiTashriflar bugungiTashriflarHammasi tashrifSaqlash tashrifTekshir',
  'tekshiruv': 'ijroTekshirJavob',
  'tolov': 'bugungiTolovlar shartnomalar tolovSaqlash',
  'undiruv': 'qadamBekorKirit qadamBoshlang qadamChora qadamDirektorga qadamHujjat qadamKechiktir qadamMalumot qadamMijoz qadamMuhlatSora qadamNazorat qadamNazoratYoz qadamOtkaz qadamSkan qadamTalabChiqar qadamTgYubordim qadamXatBekor qadamXatChiqar undBoshlang undMijoz undYoz yuristgaSorov',
  'undiruv,hujjat': 'bekorBuyruqSkan bekorFayl bekorHolat bekorKirit bekorQaytaYasa bekorXabarnomaSkan',
  'undiruv,yurist': 'qadamFayl qadamSudKarta qadamTarix qadamTgTel qadamYuristYol',
  'xat': 'xatBekor xatBoshlang xatPdf xatQaytaYasa xatTayyorla xatYuborildi',
  'xat,shartnoma,undiruv': 'monSorovYubor',
  'xarita': 'xaritaMalumot',
  'yurist': 'tasdiqFayl tasdiqQil tasdiqRoyxat yhAloqa yhAloqaBekor yhAloqaFayl yhAloqaYuborildi yuristBoshlang yuristHolat yuristHujjat yuristIsh yuristKeyingi yuristMajlis yuristQabul yuristRad yuristTopBer',
};
// amallar.js da bor, lekin ichida baribir eski tizimga boradi (Telegram bot, PIN o'rnatish, qoida yozish)
const ICHI_ESKI = new Set(['tgUlanishBoshla', 'tgUlanishTekshir', 'pinKodYubor', 'pinOrnat', 'topQoidaYoz']);
const serverda = f => typeof A[f] === 'function' && !ICHI_ESKI.has(f);
const NOM = { '*': 'umumiy (har xodimda)', admin: 'faqat direktor', devon: 'devonxona', hisobot: 'hisobot', hujjat: 'hujjatlar (skan)', ijara_kelishuv: 'ijarani kelishuv bilan bekor',
  reyestr: 'reyestr', shartnoma: 'shartnoma tuzish', taminot: "ta'minot", tashrif: 'tashrif', tekshiruv: 'tekshiruv', tolov: "to'lov", undiruv: 'undiruv', xarita: 'xarita (Xarita.html)',
  xat: 'xatlar', yurist: 'yurist',
  'shartnoma,undiruv,hujjat,tolov,xat,yurist': 'mijozlar (qidiruv, karta)', 'undiruv,hujjat': 'shartnomani bekor qilish', 'undiruv,yurist': 'sud kartasi, mijoz tarixi',
  'xat,shartnoma,undiruv': 'direktorga so\'rov' };

(async () => {
  const soz = process.argv.slice(2).join(' ').trim();
  if (soz.length < 3) { console.log('Ishlatish: aks-xodim <ism yoki familiya bo\'lagi>   (masalan: aks-xodim nurbek)'); process.exit(1); }
  const R = (await q(`SELECT xodim_id, fish, lavozim, holat, kirish_kodi, huquqlar, pin_iz, telegram_id, tel_raqam FROM v_xodimlar WHERE kompaniya_id = 1 AND (fish ILIKE $1 OR lavozim ILIKE $1) ORDER BY qator_no`, ['%' + soz + '%'])).rows;
  if (!R.length) { console.log('«' + soz + '» bo\'yicha xodim topilmadi (07_Xodimlar).'); }
  for (const x of R) {
    const H = x.huquqlar || [], adm = H.includes('admin');
    console.log('================ ' + x.fish + ' ================');
    console.log('ID: ' + x.xodim_id + ' · lavozim: ' + (x.lavozim || '—') + ' · holat: ' + (x.holat || '—'));
    console.log('Huquqlar: ' + (H.join(', ') || '— YO\'Q'));
    console.log('Kirish kodi: ' + (x.kirish_kodi && x.kirish_kodi.length >= 8 ? 'bor' : 'YO\'Q') + ' · PIN: ' + (x.pin_iz ? 'o\'rnatilgan' : 'o\'rnatilmagan') +
      ' · Telegram: ' + (x.telegram_id ? 'ulangan' : 'ulanmagan') + ' · telefon: ' + (x.tel_raqam ? 'bor' : 'YO\'Q'));
    // kirishlar: eski tizim jurnali (07b, yangi tizimdagi kirish ham shu yerga yoziladi) va yangi server
    const k7 = (await q(`SELECT korinish FROM kozgu.qatorlar WHERE kompaniya_id = 1 AND varaq = '07b_Kirish_jurnali' AND qator_no >= 2 AND btrim(korinish->>2) = $1 ORDER BY qator_no DESC LIMIT 200`, [x.fish])).rows;
    const ky = (await q(`SELECT count(*)::int n, to_char(max(vaqt) AT TIME ZONE 'Asia/Tashkent', 'DD.MM.YYYY HH24:MI') oxirgi FROM kirishlar WHERE fish = $1 AND vaqt > now() - interval '30 days'`, [x.fish])).rows[0];
    console.log('Kirishlar (07b jurnali): ' + k7.length + ' ta' + (k7.length ? ' · oxirgisi ' + k7[0].korinish[0] + ' ' + k7[0].korinish[1] + ' (' + (k7[0].korinish[3] || '') + ')' : ''));
    console.log('Yangi server (aks-tizim.uz) orqali, 30 kun: ' + ky.n + ' marta' + (ky.oxirgi ? ' · oxirgisi ' + ky.oxirgi : ''));
    // tekshiruv
    const muammo = [];
    if (x.holat !== 'Ishlayapti') muammo.push('holati «Ishlayapti» emas — kira olmaydi');
    if (!H.length) muammo.push('huquqlar ustuni (S) bo\'sh — kira olmaydi');
    if (!(x.kirish_kodi && x.kirish_kodi.length >= 8)) muammo.push('kirish kodi (L ustuni) yo\'q yoki qisqa');
    console.log('');
    console.log('Bo\'limlari bo\'yicha amallar:  ✅ serverda (tez)   ⏳ eski tizim orqali (sekinroq, lekin ishlaydi)');
    let jS = 0, jE = 0;
    for (const h of Object.keys(XARITA)) {
      const kerak = h.split(',');
      const ochiq = adm || kerak.includes('*') || kerak.some(z => H.includes(z));
      if (!ochiq || (h === 'admin' && !adm)) continue;
      const F = XARITA[h].split(' ');
      const s = F.filter(serverda), e = F.filter(f => !serverda(f));
      jS += s.length; jE += e.length;
      const nom = NOM[h] || kerak.map(z => NOM[z] || z).join(' / ');
      console.log('  ' + nom + ': ✅ ' + s.length + (e.length ? '  ⏳ ' + e.length + ' — ' + e.join(', ') : ''));
    }
    const jami = jS + jE;
    console.log('JAMI: ' + jami + ' ta amaldan ' + jS + ' tasi serverda (' + (jami ? Math.round(jS * 100 / jami) : 0) + '%), ' + jE + ' tasi eski tizim orqali.');
    console.log('');
    if (muammo.length) console.log('⚠ HOZIRCHA O\'TKAZIB BO\'LMAYDI: ' + muammo.join('; ') + '. 07_Xodimlar da to\'g\'rilang.');
    else {
      console.log('✅ O\'TKAZSA BO\'LADI. Unga faqat o\'zining havolasini yuboring:');
      console.log('   https://aks-tizim.uz/?k=' + x.kirish_kodi);
      console.log('   ' + (x.pin_iz ? 'PIN — eski tizimdagisi bilan kiradi.' : 'PIN hali yo\'q — birinchi kirishda Telegram orqali PIN o\'rnatadi' + (x.tel_raqam ? '.' : ' (07_Xodimlar F ustuniga telefon yozilishi kerak).')));
      console.log('   Eski havola ham ishlab turadi — ikkalasida bir xil ma\'lumot.');
    }
    console.log('');
  }
  await pool.end(); redis.disconnect(); process.exit(0);
})().catch(async e => { console.error('XATO:', e.message); try { await pool.end(); redis.disconnect(); } catch (z) { } process.exit(1); });
