// AKS TIZIM — aks-mijoz-bot (tekshir | holat | eslatma). Kalit hech qachon ekranga chiqarilmaydi.
'use strict';
const MB = require('../lib/mijoz_bot');
const { redis } = require('../lib/db');
(async () => {
  const ish = process.argv[2] || 'holat';
  if (!MB.bor()) { console.log('⛔ Mijozlar boti ulanmagan (TG_MIJOZ_TOKEN yo\'q). Ulash: aks-mijoz-bot'); process.exit(1); }
  if (ish === 'tekshir') {
    const m = await MB.api('getMe', {});
    await MB.api('setMyCommands', { commands: [{ command: 'start', description: 'Ботни бошлаш / қарзимни кўриш' }, { command: 'stop', description: 'Хабарларни тўхтатиш' }] }).catch(() => {});
    console.log('✅ Bot ulandi: @' + m.username + ' («' + m.first_name + '»)');
    console.log('   Mijozlarga beriladigan havola: https://t.me/' + m.username);
    console.log('   1 daqiqa ichida bot xabarlarga javob bera boshlaydi. Sinash: botni oching → Start → «📱 Рақамни юбориш».');
  } else if (ish === 'eslatma') {
    const r = await MB.eslatma(null, { quruq: true });
    console.log('Bugungi eslatmalar (QURUQ — yuborilmadi): ' + r.soni + ' ta'); (r.royxat || []).forEach(x => console.log('  ' + x));
  } else {
    const h = await MB.holat(), m = await MB.api('getMe', {}).catch(e => ({ xato: e.message }));
    console.log(m.xato ? '⛔ Bot javob bermadi: ' + m.xato : '✅ Bot: @' + m.username);
    console.log('Ulangan suhbatlar: ' + h.ulangan + ' · mijozlar: ' + h.mijozlar + (h.toxtagan ? ' · botni to\'xtatganlar: ' + h.toxtagan : ''));
    console.log('O\'qish: ' + (h.tirik ? Math.round((Date.now() - h.tirik) / 1000) + ' s oldin tirik' : 'hali ishga tushmagan') + (h.xato ? ' · oxirgi xato: ' + h.xato : ''));
    (await redis.lrange('mb_jurnal', 0, 9)).forEach(x => { const j = JSON.parse(x); console.log('  ' + j.vaqt.slice(0, 16).replace('T', ' ') + ' ' + j.tur + (j.natija ? ' — ' + j.natija : '')); });
  }
  process.exit(0);
})().catch(e => { console.log('⛔ ' + e.message); process.exit(1); });
