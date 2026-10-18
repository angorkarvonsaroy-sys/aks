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

(async () => {
  const arg = process.argv[2];
  if (arg === 'yoq') { await redis.set('korinish_yondi', '1'); console.log('✅ Ko\'rinish qoidasi YOQILDI — xodimlar faqat o\'zlariga ruxsat etilgan holatdagi shartnomalarni ko\'radi.\n   Qaytarish: aks-korinish ochir'); }
  else if (arg === 'ochir') { await redis.del('korinish_yondi'); console.log('⏸ Ko\'rinish qoidasi O\'CHIRILDI — hamma narsa avvalgidek ko\'rinadi.'); }
  else {
    console.log('================ SHARTNOMA HOLATI BO\'YICHA KO\'RINISH ================');
    console.log('Hozir: ' + ((await KR.yoqilgan()) ? 'YOQILGAN' : 'o\'chiq (hamma narsa avvalgidek ko\'rinadi)'));
    console.log('Qoida: direktor — hammasi · «undiruv» — faqat o\'ziga biriktirilganlar (har qanday holat) · «yurist» — faqat yuristga o\'tkazilganlar (har qanday holat)');
    console.log('       boshqalar — Aktiv, Kredit asosida, Yakunlangan, Noqonuniy hududda, Shartnoma olmagan; Bekor qilindi — «bekor_korish» bilan; Passiv, Kutilmoqda — hech kim\n');
    const SH = [];
    (await V.qatorlar('03_Sotuv_shartnomalar')).forEach(({ r }) => { const no = String(r[0] == null ? '' : r[0]).trim(); if (no) SH.push({ no, tur: 'sotuv', holati: String(r[13] == null ? '' : r[13]).trim(), und: String(r[17] == null ? '' : r[17]).trim() }); });
    (await V.qatorlar('04_Ijara_shartnomalar')).forEach(({ r }) => { const no = String(r[0] == null ? '' : r[0]).trim(); if (no) SH.push({ no, tur: 'ijara', holati: String(r[2] == null ? '' : r[2]).trim(), und: '' }); });
    const YU = await KR.yuristSet();
    const TART = ['Aktiv', 'Kredit asosida', 'Yakunlangan', 'Noqonuniy hududda', 'Shartnoma olmagan', 'Bekor qilindi', 'Passiv', 'Kutilmoqda'];
    const yoz = L => { const g = {}; L.forEach(s => { const k = s.holati || '(bo\'sh)'; (g[k] = g[k] || { sotuv: 0, ijara: 0 })[s.tur]++; });
      return Object.keys(g).sort((a, b) => (TART.indexOf(a) < 0 ? 99 : TART.indexOf(a)) - (TART.indexOf(b) < 0 ? 99 : TART.indexOf(b)))
        .map(k => k + ' ' + (g[k].sotuv + g[k].ijara) + (g[k].sotuv && g[k].ijara ? ' (sotuv ' + g[k].sotuv + ' + ijara ' + g[k].ijara + ')' : g[k].ijara ? ' (ijara)' : '')).join(', '); };
    console.log('• Direktor — ko\'radi: jami ' + SH.length + ' — ' + yoz(SH));
    const X = (await pool.query("SELECT fish, huquqlar FROM v_xodimlar WHERE kompaniya_id = 1 AND holat = 'Ishlayapti' ORDER BY qator_no")).rows;
    for (const x of X) {
      const H = x.huquqlar || []; if (!H.length || H.includes('admin')) continue;
      const u = { admin: false, huquq: H, fish: x.fish };
      const kor = SH.filter(s => KR.korinadi(u, s.holati, s.und, YU.has(s.no)));
      const t = KR.tur(u);
      console.log('• ' + x.fish + (t === 'undiruv' ? ' (undiruvchi — faqat o\'z portfeli)' : t === 'yurist' ? ' (yurist — faqat yuristdagi ishlar)' : '') + ' — ko\'radi: jami ' + kor.length + (kor.length ? ' — ' + yoz(kor) : ''));
    }
    console.log('\nQo\'llanadigan bo\'limlar: mijoz qidiruvi va kartasi, to\'lov ro\'yxati, bugungi to\'lovlar, reyestr, hisobot ro\'yxatlari, 👁 skan,');
    console.log('   📎 hujjatlar (ro\'yxat, yuklash, tuzatish, tahrir/bekor/kelishuv panellari), ✉ xatlar, 📝 yangi shartnoma (mijozlar, do\'kon egasi «*»), 🚶 tashrif (telefon bo\'yicha mijoz).');
    console.log('   Direktor topshirig\'idagi shartnoma — holatidan qat\'i nazar ko\'rinadi. Undiruv, Bugungi ish, xarita — avvaldan faqat o\'z portfeli / niqoblangan.');
    console.log('Hisobot va bosh sahifadagi JAMI summalar o\'zgarmaydi (kassa tushumi to\'liq qoladi) — faqat shartnoma ko\'rinadigan qatorlar yashiriladi.');
    console.log('\nYoqish: aks-korinish yoq      ·      O\'chirish: aks-korinish ochir');
  }
  await pool.end(); redis.disconnect(); process.exit(0);
})().catch(async e => { console.error('XATO:', e.message); try { await pool.end(); redis.disconnect(); } catch (z) { } process.exit(1); });
