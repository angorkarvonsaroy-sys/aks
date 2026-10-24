// AKS TIZIM — ⚖ YURISTGA ERTALABKI XABAR (09:05, yakshanbadan tashqari) — direktor qarori 24.10.2026.
// Eski tizimda yo'q edi: yurist faqat kechqurun 18:15 da «qoidabuzarlik» xabarini olardi (avval jazo, keyin eslatma).
// Endi ertalab bugungi ish ro'yxati keladi: ① qabul qilish kerak (1 ish kuni muddat) ② mening navbatim (kechikkan / bugun / keyin) ③ sud yoki MIB kutilmoqda (aybi yo'q — faqat son).
// Ro'yxat manbai — api/yurist.js yuKorinish (ilovadagi ro'yxat bilan AYNAN bir xil). Telegram — lib/telegram.js (serverda).
// opt.quruq — hech narsa yubormaydi: xabarlarni qaytaradi (aks-vaqt sinov yu_ertalab).
'use strict';
const V = require('./varaq');
const J = require('./jurnallar');
const U = require('./undiruv_yordam');
const TG = require('./telegram');
const { xodimTeng } = require('./xodim');

const s = v => String(v == null ? '' : v);
const dmy = iso => iso ? s(iso).slice(0, 10).split('-').reverse().join('.') : '';
const pul = n => Math.round(n || 0).toLocaleString('ru-RU').replace(/[ ,]/g, ' ');
const esc = v => s(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const qisqa = f => s(f).trim().split(/\s+/).slice(0, 2).join(' ');

// yuristlar (admin emas) — 07_Xodimlar dan
async function yuristlar() {
  return (await V.qatorlar('07_Xodimlar')).map(({ x: r }) => ({ fish: s(r[1]).trim(), huquq: s(r[18]).toLowerCase(), tg: s(r[20]).trim().replace(/\.0+$/, ''), holat: s(r[10]).trim() }))
    .filter(z => z.fish && z.holat === 'Ishlayapti' && /(^|,)\s*yurist\s*(,|$)/.test(z.huquq) && !/(^|,)\s*admin\s*(,|$)/.test(z.huquq));
}
// bitta yurist uchun matn (yoki '' — bugun hech narsa yo'q)
function matn(fish, G, bugun) {
  const M = ['⚖ <b>Bugungi ishingiz</b> — ' + dmy(bugun), ''];
  if (G.qabul.length) {
    M.push('🔴 <b>Qabul qilish kerak — ' + G.qabul.length + ' ta</b> (muddat: 1 ish kuni)');
    G.qabul.forEach(k => M.push('• <b>' + k.no + '</b> ' + esc(qisqa(k.fish)) + ' — qarz ' + pul(k.jami) + (k.kechikdi ? ' · <b>' + k.kechikdi + ' kun kechikdi</b>' : ' · muddat ' + dmy(k.chegara))));
    M.push('Hujjatlarni tekshirib «✅ Qabul qilish» yoki kamchilik bo\'lsa «↩ Kamchilik bilan qaytarish».', '');
  }
  const kech = G.mening.filter(k => k.kechikdi > 0), bugungi = G.mening.filter(k => !k.kechikdi && k.chegara === bugun), keyin = G.mening.filter(k => !k.kechikdi && k.chegara !== bugun);
  if (kech.length) {
    M.push('🔴 <b>Kechikkan — ' + kech.length + ' ta</b>');
    kech.forEach(k => M.push('• <b>' + k.no + '</b> ' + esc(qisqa(k.fish)) + ' — ' + esc(k.keyingi) + ' · <b>' + k.kechikdi + ' kun</b>'));
    M.push('');
  }
  if (bugungi.length) {
    M.push('🟡 <b>Bugun muddati tugaydi — ' + bugungi.length + ' ta</b>');
    bugungi.forEach(k => M.push('• <b>' + k.no + '</b> ' + esc(qisqa(k.fish)) + ' — ' + esc(k.keyingi)));
    M.push('');
  }
  if (!G.qabul.length && !kech.length && !bugungi.length) M.push('✅ Bugun shoshilinch ish yo\'q.', '');
  const qator = [];
  if (keyin.length) qator.push('mening navbatimda yana ' + keyin.length + ' ta (muddati keyinroq)');
  if (G.kutish.length) qator.push('sud yoki MIB javobi kutilmoqda — ' + G.kutish.length + ' ta (sizdan ish talab qilinmaydi)');
  if (qator.length) M.push('ℹ ' + qator.join(' · '));
  M.push('', 'Ro\'yxat va tugmalar: ilovada ⚖ Yurist.');
  return M.join('\n');
}

async function yuErtalab(kod, opt = {}) {
  const bugun = V.bugun();
  if (new Date(bugun + 'T12:00:00Z').getUTCDay() === 0) return { yuborilmadi: 'Yakshanba — xabar yuborilmaydi.' };
  const Y = await yuristlar(); if (!Y.length) return { yuborilmadi: 'Yurist 07_Xodimlar da topilmadi.' };
  const YQ = require('../api/yurist').Q;
  const Sh = {}; (await U.undShartnomalar()).forEach(x => Sh[x.no] = x);
  const K = await YQ.yuKesh(), I = await J.yuIshlar();
  const xabarlar = [], svod = [];
  for (const y of Y) {
    const G = { qabul: [], mening: [], kutish: [] };
    I.filter(i => YQ.YU_FAOL.indexOf(i.holati) >= 0 && (!i.yurist || xodimTeng(i.yurist, y.fish))).forEach(i => {
      const k = YQ.yuKorinish(i, Sh[i.no], bugun, K);
      if (k.qabulKerak) G.qabul.push(k); else if (k.yuMas) G.mening.push(k); else G.kutish.push(k);
    });
    G.qabul.sort((a, b) => b.kechikdi - a.kechikdi); G.mening.sort((a, b) => b.kechikdi - a.kechikdi);
    const m = matn(y.fish, G, bugun);
    const holat = G.qabul.length + ' qabul · ' + G.mening.filter(k => k.kechikdi > 0).length + ' kechikkan · ' + G.mening.length + ' navbatimda · ' + G.kutish.length + ' kutilmoqda';
    if (opt.quruq) { xabarlar.push({ kimga: y.fish, matn: m }); svod.push(y.fish + ': ' + holat + ' (quruq)'); continue; }
    if (!y.tg) { svod.push(y.fish + ': ❌ Telegramga ulanmagan'); continue; }
    try { await TG.chat(y.tg, m); svod.push(y.fish + ': ✅ ' + holat); }
    catch (e) { svod.push(y.fish + ': ❌ ' + e.message); }
  }
  return Object.assign({ yuristlar: Y.length, svod }, opt.quruq ? { quruq: true, xabarlar } : {});
}

module.exports = { yuErtalab, yuristlar, matn };
