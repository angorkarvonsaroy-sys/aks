// AKS TIZIM — ⏳ DIREKTORGA ERTALABKI ESLATMA: 3 kundan ortiq javob kutayotgan so'rovlar (13.11.2026, direktor qarori).
// 13.11.2026 dagi holat: yuristga o'tkazish so'rovlari o'rtacha 22 kun (eng eskisi 30 kun), kirim xatlar o'rtacha 22 kun (eng eskisi 35 kun)
// direktor javobini kutib turgan; bu orada da'vo muddatlari o'tib borgan. Ilovada ular «Sizdan kutilmoqda» ro'yxatida, lekin ilova ochilmasa — ko'rinmaydi.
// Har kuni 08:45 da (yakshanbadan tashqari) Telegramga qisqa ro'yxat ketadi; 3 kundan ortiq kutayotgan narsa bo'lmasa — hech narsa yuborilmaydi.
// Faqat o'qiydi (ko'zgudan): 06b yurist ishlari, 06i xodim so'rovlari, 06l imzolanmagan ijara so'rovlari, 11 devonxona.
// 14.11.2026 (direktor qarori): ikkinchi qism — 👥 XODIMLARDA TURIB QOLGAN ISHLAR. Avval eslatma faqat direktordan kutilayotganini ko'rsatardi;
// xodimda to'xtab qolgan ish hech kimga eslatilmasdi: kelishuv bilan bekor qilish hujjati tayyorlanib, imzolangan skani yuklanmagan 7 ta ijara
// shartnomasi (5 tasi 34 kundan beri) bazada «Aktiv» bo'lib turgan — do'kon band ko'rinardi. Endi: kimda, necha kundan beri. Shu yerga yuristning
// muddati o'tgan kelishuvlari ham chiqadi. Direktor qismiga «kelishuv bilan bekor qilish — tasdiq» ham qo'shildi (qo'ng'iroqchada bor edi, bu yerda yo'q edi).
// opt.quruq — yubormaydi, matnni qaytaradi (aks-vaqt sinov kut_eslatma).
'use strict';
const V = require('./varaq');
const J = require('./jurnallar');
const CHEGARA = 3, KOP = 5;
const s = v => String(v == null ? '' : v).trim();
const esc = v => s(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const dmy = iso => s(iso).split('-').reverse().join('.');
function iso(v) {
  if (typeof v === 'number' && v > 30000 && v < 80000) return new Date(Date.UTC(1899, 11, 30) + Math.floor(v) * 86400000).toISOString().slice(0, 10);   // jadval sanasi (seriya raqami)
  const t = s(v), p = n => String(n).padStart(2, '0');
  let m = /^(\d{1,2})\.(\d{1,2})\.(\d{4})/.exec(t); if (m) return m[3] + '-' + p(m[2]) + '-' + p(m[1]);
  m = /^(\d{4})-(\d{2})-(\d{2})/.exec(t); return m ? m[1] + '-' + m[2] + '-' + m[3] : '';
}
const kun = (v, bugun) => { const i = iso(v); if (!i) return -1; const k = Math.round((Date.parse(bugun) - Date.parse(i)) / 86400000); return isNaN(k) ? -1 : k; };
const SOROV_NOM = { xat_bekor: 'xatni bekor qilish', tahrir: 'shartnoma tahriri', taqiq_sotuv: 'taqiqdagi do\'konni sotishga ruxsat' };

// D — {yurist, sorov, imzosiz, devon} xom ro'yxatlar (sinovda beriladi); qaytaradi: guruhlar [{nom, L: [{t, kun}]}] — faqat CHEGARA kundan ortiqlari
function yig(D, bugun) {
  const G = [
    { nom: '⚖ Yuristga o\'tkazish so\'rovlari', L: D.yurist.filter(i => s(i.holati) === 'Tasdiq kutilmoqda').map(i => ({ t: s(i.no) + (s(i.undiruvchi) ? ' — so\'ragan: ' + s(i.undiruvchi) : ''), kun: kun(i.sorovVaqt, bugun) })) },
    { nom: '📥 Kirim xatlar — rezolyutsiya', L: D.devon.filter(x => s(x.turi) === 'Kirim' && s(x.holati) === 'Rezolyutsiya kutmoqda').map(x => ({ t: '№' + s(x.tartib) + ' ' + s(x.tashkilot), kun: kun(x.kiritildi, bugun) })) },
    { nom: '📨 Xodim so\'rovlari', L: D.sorov.filter(x => s(x.holati) === 'Kutilmoqda').map(x => ({ t: (SOROV_NOM[s(x.tur)] || s(x.tur)) + ' ' + s(x.kalit) + ' — ' + s(x.kim), kun: kun(x.vaqt, bugun) })) },
    { nom: '✕ Imzolanmagan ijarani bekor qilish', L: D.imzosiz.filter(r => s(r[7]) === 'Kutilmoqda').map(r => ({ t: s(r[2]) + ' ' + s(r[3]) + ' — ' + s(r[5]), kun: kun(r[1], bugun) })) },
    { nom: '🤝 Kelishuv bilan bekor qilish — tasdiq', L: (D.kb || []).filter(k => s(k.holati) === 'Tasdiq kutilmoqda').map(k => ({ t: s(k.no) + ' ' + s(k.fish) + ' — ' + s(k.skanKim || k.kim), kun: kun(k.skanVaqt || k.vaqt, bugun) })) },
  ];
  return G.map(g => ({ nom: g.nom, jami: g.L.length, L: g.L.filter(z => z.kun > CHEGARA).sort((a, b) => b.kun - a.kun) })).filter(g => g.L.length);
}
// 👥 xodimlarda turib qolgan ishlar: D.kb — 06m qatorlari, D.kelishuv — yuristning muddati o'tgan kelishuvlari [{no, fish, kun, yurist}]
function xodimda(D, bugun) {
  const X = [
    { nom: '🤝 Kelishuv bilan bekor qilish — imzolangan skan yuklanmagan', izoh: 'Bu shartnomalar bazada hali «Aktiv»: do\'kon band ko\'rinadi, yangi ijarachiga berib bo\'lmaydi. Xodimga tizim o\'zi topshiriq beradi.',
      L: (D.kb || []).filter(k => s(k.holati) === 'Hujjat tayyorlandi' || s(k.holati) === 'Rad etildi').map(k => { const q = s(k.holati) === 'Rad etildi';
        return { t: s(k.no) + (s(k.dokon) ? ' · ' + s(k.dokon) : '') + ' — ' + (s(k.kim) || 'xodim noma\'lum') + (q ? ' (siz qaytargansiz)' : ''), kun: kun(q ? (k.javobVaqt || k.vaqt) : k.vaqt, bugun) }; }).filter(z => z.kun > CHEGARA) },
    { nom: '⚖ Yurist: kelishuv muddati o\'tgan', izoh: 'Mijoz kelishuvni bajardimi — yurist natijani kiritishi yoki muddatni uzaytirishi kerak.',
      L: (D.kelishuv || []).map(k => ({ t: s(k.no) + ' ' + s(k.fish) + (s(k.yurist) ? ' — ' + s(k.yurist) : ''), kun: Number(k.kun) || 0 })).filter(z => z.kun >= 1) },
  ];
  return X.map(g => ({ nom: g.nom, izoh: g.izoh, L: g.L.sort((a, b) => b.kun - a.kun) })).filter(g => g.L.length);
}
function matn(G, bugun, X) {
  X = X || []; const M = [];
  if (G.length) {
    const jami = G.reduce((a, g) => a + g.L.length, 0), eski = Math.max.apply(null, G.map(g => g.L[0].kun));
    M.push('⏳ <b>Sizdan javob kutilmoqda</b> — ' + dmy(bugun), CHEGARA + ' kundan ortiq kutayotganlar: <b>' + jami + '</b> ta, eng eskisi <b>' + eski + ' kun</b>.', '');
  }
  const xodimQism = () => { if (!X.length) return;
    const jx = X.reduce((a, g) => a + g.L.length, 0), ex = Math.max.apply(null, X.map(g => g.L[0].kun));
    M.push('👥 <b>Xodimlarda turib qolgan ishlar</b>' + (G.length ? '' : ' — ' + dmy(bugun)), 'Jami <b>' + jx + '</b> ta, eng eskisi <b>' + ex + ' kun</b>. Bular sizdan emas, xodimdan kutilmoqda.', '');
    X.forEach(g => { M.push(g.nom + ': <b>' + g.L.length + '</b> ta'); g.L.slice(0, KOP + 3).forEach(z => M.push('   • ' + esc(z.t) + ' — <b>' + z.kun + ' kun</b>')); if (g.L.length > KOP + 3) M.push('   … va yana ' + (g.L.length - KOP - 3) + ' ta');
      if (g.izoh) M.push('   <i>' + esc(g.izoh) + '</i>'); M.push(''); }); };
  if (!G.length) { xodimQism(); return M.join('\n'); }
  G.forEach(g => { M.push(g.nom + ': <b>' + g.L.length + '</b> ta' + (g.jami > g.L.length ? ' (jami ' + g.jami + ' ta kutmoqda)' : ''));
    g.L.slice(0, KOP).forEach(z => M.push('   • ' + esc(z.t) + ' — <b>' + z.kun + ' kun</b>')); if (g.L.length > KOP) M.push('   … va yana ' + (g.L.length - KOP) + ' ta'); M.push(''); });
  M.push('Javob berish: ilovada 🔔 qo\'ng\'iroqcha yoki Ishlar → Tasdiqlar — hammasi bitta ro\'yxatda, eng eskisi tepada.');
  if (X.length) { M.push(''); xodimQism(); }
  return M.join('\n');
}
async function eslatma(kod, opt = {}) {
  const bugun = V.bugun();
  if (new Date(bugun + 'T12:00:00Z').getUTCDay() === 0) return { yuborilmadi: 'Yakshanba — eslatma yuborilmaydi.' };
  const [yurist, sorov, R6l, devon] = await Promise.all([J.yuIshlar(), J.monSorovlar(), V.qatorlar('06l_Imzosiz_sorovlar').catch(() => []), require('../api/direktor')._ichki.devonRows()]);
  let kb = []; try { kb = await require('../api/taminot')._ichki.kbRows(); } catch (e) { console.error('kut_eslatma kb:', e.message); }
  let kelishuv = [];
  try { const KL = yurist.filter(i => s(i.holati) === 'Kelishuv');
    if (KL.length) { const YQ = require('../api/yurist').Q, K = await YQ.yuKesh();
      kelishuv = KL.map(i => YQ.yuKorinish(i, null, bugun, K)).filter(k => k.kelOtdi).map(k => ({ no: k.no, fish: k.fishQ || k.fish, kun: k.kechikdi, yurist: (yurist.find(z => String(z.id) === String(k.id)) || {}).yurist || '' })); } }
  catch (e) { console.error('kut_eslatma kelishuv:', e.message); }
  const D = { yurist, sorov, imzosiz: R6l.map(z => z.r), devon, kb, kelishuv };
  const G = yig(D, bugun), X = xodimda(D, bugun);
  if (!G.length && !X.length) return { yuborilmadi: CHEGARA + ' kundan ortiq kutayotgan so\'rov ham, xodimlarda turib qolgan ish ham yo\'q.' };
  const t = matn(G, bugun, X), soni = G.reduce((a, g) => a + g.L.length, 0), xodimSoni = X.reduce((a, g) => a + g.L.length, 0);
  if (opt.quruq) return { quruq: true, soni, xodimSoni, xabarlar: [{ kimga: 'direktor', matn: t }] };
  await require('./telegram').direktor(t);
  return { soni, xodimSoni, guruh: G.concat(X).map(g => g.nom.replace(/^\S+\s/, '') + ': ' + g.L.length) };
}
module.exports = { eslatma, _ichki: { yig, xodimda, matn, iso, kun, CHEGARA } };
