#!/usr/bin/env node
// AKS TIZIM — shartnoma HOLATI bo'yicha ko'rinish qoidasi (lib/korinish.js): oldindan ko'rish, yoqish, o'chirish.
// Ishlatish: aks-korinish         — har xodimdan nima yashirinishini ko'rsatadi (hech narsa o'zgarmaydi)
//            aks-korinish yoq     — qoidani yoqish
//            aks-korinish ochir   — o'chirish (hamma narsa avvalgidek ko'rinadi)
'use strict';
process.env.AKS_ENV = process.env.AKS_ENV || '/opt/aks/.env';
const { pool, redis } = require('../lib/db');
const V = require('../lib/varaq');
const KR = require('../lib/korinish');
const { xodimTeng } = require('../lib/xodim');

(async () => {
  const arg = process.argv[2];
  if (arg === 'yoq') { await redis.set('korinish_yondi', '1'); console.log('✅ Ko\'rinish qoidasi YOQILDI — xodimlar faqat o\'zlariga ruxsat etilgan holatdagi shartnomalarni ko\'radi.\n   Qaytarish: aks-korinish ochir'); }
  else if (arg === 'ochir') { await redis.del('korinish_yondi'); console.log('⏸ Ko\'rinish qoidasi O\'CHIRILDI — hamma narsa avvalgidek ko\'rinadi.'); }
  else {
    console.log('================ SHARTNOMA HOLATI BO\'YICHA KO\'RINISH ================');
    console.log('Hozir: ' + ((await KR.yoqilgan()) ? 'YOQILGAN' : 'o\'chiq (hamma narsa avvalgidek ko\'rinadi)'));
    console.log('Qoida: Aktiv, Kredit asosida, Yakunlangan — hamma · Bekor qilindi — «bekor_korish» · Noqonuniy hududda — «yurist» yoki «noqonuniy_korish» · qolganlari — faqat direktor');
    console.log('Istisno: undiruvchi o\'ziga biriktirilgan shartnomani (03 «Undiruvchi») holatidan qat\'i nazar ko\'radi\n');
    const SH = [];
    (await V.qatorlar('03_Sotuv_shartnomalar')).forEach(({ r }) => { const no = String(r[0] == null ? '' : r[0]).trim(); if (no) SH.push({ no, tur: 'sotuv', holati: String(r[13] == null ? '' : r[13]).trim(), und: String(r[17] == null ? '' : r[17]).trim(), fish: String(r[20] == null ? '' : r[20]).trim() }); });
    (await V.qatorlar('04_Ijara_shartnomalar')).forEach(({ r }) => { const no = String(r[0] == null ? '' : r[0]).trim(); if (no) SH.push({ no, tur: 'ijara', holati: String(r[2] == null ? '' : r[2]).trim(), und: String(r[20] == null ? '' : r[20]).trim(), fish: String(r[23] == null ? '' : r[23]).trim() }); });
    const son = {}; SH.forEach(s => { const k = s.tur + '|' + (s.holati || '(bo\'sh)'); son[k] = (son[k] || 0) + 1; });
    console.log('Bazadagi shartnomalar:'); Object.keys(son).sort().forEach(k => console.log('  ' + k.replace('|', ' — ') + ': ' + son[k]));
    const X = (await pool.query("SELECT fish, huquqlar FROM v_xodimlar WHERE kompaniya_id = 1 AND holat = 'Ishlayapti' ORDER BY qator_no")).rows;
    console.log('\nHar bir xodimdan YASHIRILADI (direktordan tashqari, huquqi bor xodimlar):');
    for (const x of X) {
      const H = x.huquqlar || []; if (!H.length || H.includes('admin')) continue;
      const u = { admin: false, huquq: H, fish: x.fish };
      const yop = SH.filter(s => !KR.korinadi(u, s.holati, s.und));
      const g = {}; yop.forEach(s => { const k = s.holati || '(bo\'sh)'; g[k] = (g[k] || 0) + 1; });
      console.log('\n• ' + x.fish + '  [' + H.join(', ') + ']');
      console.log('   jami ' + yop.length + ' ta: ' + Object.keys(g).map(k => k + ' ' + g[k]).join(', '));
      const oz = SH.filter(s => s.tur === 'sotuv' && s.und && xodimTeng(s.und, x.fish) && !KR.korinadi({ admin: false, huquq: H, fish: '' }, s.holati));
      if (oz.length) console.log('   o\'z portfelidagi (holati yopiq, lekin ko\'rinadi): ' + oz.length + ' ta — ' + oz.map(s => s.no + ' ' + s.holati).join(', '));
    }
    console.log('\n1-bosqichda qo\'llanadigan bo\'limlar: mijoz qidiruvi va kartasi, to\'lov ro\'yxati, bugungi to\'lovlar, reyestr, hisobot ro\'yxatlari, 👁 skan.');
    console.log('Hisobot va bosh sahifadagi JAMI summalar o\'zgarmaydi (kassa tushumi to\'liq qoladi) — faqat shartnoma ko\'rinadigan qatorlar yashiriladi.');
    console.log('2-bosqich bo\'limlari (undiruv, xat, hujjatlar, yurist, xarita, ...) hali YASHIRMAYDI.');
    console.log('\nYoqish: aks-korinish yoq      ·      O\'chirish: aks-korinish ochir');
  }
  await pool.end(); redis.disconnect(); process.exit(0);
})().catch(async e => { console.error('XATO:', e.message); try { await pool.end(); redis.disconnect(); } catch (z) { } process.exit(1); });
