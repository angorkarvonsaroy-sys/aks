// AKS TIZIM — ⏰ IJRO INTIZOMI va QADAM kechki ishlari serverda (lib/vaqt.js chaqiradi). Eski kod bilan aynan (matnlar, kataklar, kalitlar):
//   qadamKechki        — Qadam.gs qadamKechki (18:00, yakshanbadan tashqari): direktorga «🌙 Bugungi ish natijasi» — reja bajarilmagan yoki nazorat
//                        qilinmagan undiruvchi bo'lsa (tgYubor_ — koprikTgYubor). Hammasi bajarilgan bo'lsa — yuborilmaydi.
//   ijroKechki         — Ijro.gs ijroKechki (18:15): 06r_Ijro_kun ga har xodim kunlik qatori (bor bo'lsa — ustidan), 06q_Qoidabuzarlik ga yangi
//                        qoidabuzarliklar (kalit bo'yicha takrorlanmaydi), xodimga Telegram, zinapoya (ijroZina — Redis).
//   ijroTekshiruvTanla — Ijro.gs ijroTekshiruvTanla (09:30): oyning 1-kuni — ijroOylik (o'tgan oy xulosasi direktorga); yakshanbadan tashqari —
//                        kechagi ish kuni yozuvlaridan har undiruvchiga 2 ta tasodifiy tekshiruv (10_Topshiriqlar + 06p_Tekshiruv), tekshiruvchiga Telegram.
// 23.10.2026 direktor qarori: XAT MUHLATI 1 ISH KUNI (api/qadam.js xatMuhlat/xatIshKun) — vaqt_yondi:ijro_kechki yoqilgach; quruq sinovda eski qoida (solishtirish uchun).
// opt.quruq — yozmaydi, yubormaydi: nima bo'lishini qaytaradi; bugun eski tizim allaqachon bajargan bo'lsa — uning natijasi bilan solishtiradi (aks-vaqt sinov).
// opt.varaq / opt.tgYoq — nusxa varaqqa haqiqiy yozuv, Telegram'siz (aks-yozuv-sinov ijrokun).
// Eski tizimdan farqi (yetkazish, matn emas): Telegram 4096 belgidan uzun xabarni rad etadi — qadamKechki xabari uzun bo'lsa qatorlar bo'yicha bo'lib yuboriladi
// (eski tizimda butun trigger xato bilan tugardi va direktorga hech narsa bormasdi).
'use strict';
const V = require('./varaq');
const G = require('./google');
const env = require('./env');
const J = require('./jurnallar');
const U = require('./undiruv_yordam');
const X = require('./xat_yordam');
const TS = require('./tasdiq');
const tetik = require('./kozgu_tetik');
const { redis } = require('./db');
const { xodimTeng } = require('./xodim');
const { qisqaIsm } = require('./ism');
const koprik = require('../api/koprik');

const IJRO_KUN = '06r_Ijro_kun', IJRO_BOSH = '2026-10-14', IJRO_BOSH_XODIM = '2026-10-19';
const IJRO_TEKSHIR_SONI = 2, IJRO_TEKSHIR_TAKROR_KUN = 14, QD_OTKAZ_CHEGARA = 3;
const IJRO_TEK_CHORA = ['Телефон', 'Ташриф (манзилига бориб)', 'Офисда суҳбат'];
const KECHKI_TUR = ['reja', 'nazorat', 'otkaz', 'xat', 'xat3', 'top', 'tasdiq', 'yuqabul', 'yubosqich'];   // faqat ijroKechki yozadigan turlar
const TG_MAX = 3900;

const s = v => String(v == null ? '' : v);
const esc = v => s(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const dmy = iso => iso ? s(iso).slice(0, 10).split('-').reverse().join('.') : '';
const hafta = iso => new Date(iso + 'T12:00:00Z').getUTCDay();
const kunFarq = (a, b) => Math.round((Date.parse(b + 'T12:00:00Z') - Date.parse(a + 'T12:00:00Z')) / 86400000);
const kunQosh = (iso, n) => new Date(Date.parse(iso + 'T12:00:00Z') + n * 86400000).toISOString().slice(0, 10);
const kut = (p, ms) => Promise.race([p, new Promise(r => setTimeout(r, ms))]);
function hozirSek() { const d = new Date(Date.now() + 5 * 3600 * 1000); return d.toISOString().slice(0, 10) + ' ' + d.toISOString().slice(11, 19); }
const seriyaVaqt = v => { if (typeof v !== 'number') return ''; const sek = Math.round((v - Math.floor(v)) * 86400); return String(Math.floor(sek / 3600)).padStart(2, '0') + ':' + String(Math.floor(sek % 3600 / 60)).padStart(2, '0'); };

const Q = () => require('../api/qadam')._ichki;
const IY = () => require('../api/ijro_yoz')._ichki;
const TP = () => require('../api/topshiriq_yoz')._ichki;
const ijroIso = v => typeof v === 'number' ? V.iso(v) : X.xatIso(s(v).slice(0, 10));
const ijroBall = q => { const T = IY().IJRO_TUR[q.Tur]; return T && T[1] === 'og\'ir' ? 3 : 1; };

// Telegram (ko'prik). quruq / tgYoq — yubormaydi, to'playdi
function yuboruvchi(kod, opt, jurnal) {
  const xabarlar = [], jim = opt.quruq || opt.tgYoq;
  const bol = m => { if (m.length <= TG_MAX) return [m]; const B = []; let b = '';
    m.split('\n').forEach(q => { if (b && (b + '\n' + q).length > TG_MAX) { B.push(b); b = q; } else b = b ? b + '\n' + q : q; }); if (b) B.push(b); return B; };
  return { xabarlar,
    chat: async (id, kimga, m) => { if (jim) { xabarlar.push({ kimga, matn: m }); return true; } try { await koprik.chaqir('koprikTgChat', kod, [id, m]); return true; } catch (e) { console.error(jurnal + ':', e.message); return false; } },
    // tgYubor_: eski tizimda xato bo'lsa trigger to'xtardi — bu yerda ham xato qaytariladi (jadval 1 daqiqadan keyin qayta uradi), uzun xabar bo'laklab
    direktor: async m => { if (jim) { xabarlar.push({ kimga: 'direktor (tgYubor_)', matn: m }); return 1; } const B = bol(m); for (const b of B) await koprik.chaqir('koprikTgYubor', kod, [b]); return B.length; } };
}

// ================================================================== qadamKechki (18:00)
function qdTurNom(t) { const r = Q().qdTur(s(t));
  return r.tashrif ? 'uyiga borish' : r.tur === 'aloqa' ? 'aloqa' : r.tur === 'xat' ? 'xat chiqarish' : r.tur === 'yetkaz' ? 'xat yetkazish' : r.tur === 'xatbekor' ? 'eskirgan xatni bekor qilish' : r.tur === 'yurist' ? 'yuristga so\'rov' : r.tur === 'skan' ? 'skan' : 'boshqa'; }
async function qadamKechki(kod, opt = {}) {
  const q = Q(), bugun = V.bugun(), hk = hafta(bugun);
  if (hk === 0) return { yuborilmadi: 'Yakshanba — xulosa yuborilmaydi.' };
  await kut(tetik.varaqlarYangila(['06_Undiruv_jurnali', '06n_Qadam_kun', '10_Topshiriqlar', '06e_Xatlar']).catch(() => {}), 30000);
  const XD = (await IY().qdXodimlar()).filter(x => x.undiruvchi);
  if (!XD.length) return { yuborilmadi: 'Undiruvchi yo\'q.' };
  const H = await q.qdHisob(kod, XD.map(x => x.fish), bugun, XD);
  const QM = q.QD_MAQSAD;
  let kam = 0; const M = ['🌙 <b>Bugungi ish natijasi</b> — ' + dmy(bugun) + ', ' + q.QD_KUN[hk], 'Reja: har undiruvchiga kuniga ' + QM + ' ta mijoz to\'liq ishlanishi.', ''];
  XD.forEach(x => { const h = H[x.fish], sn = h.son;
    const yetdi = sn.bajarildi >= QM; if (!yetdi || (h.nazorat && h.nazorat.qilinmadi)) kam++;
    M.push((yetdi ? '✅' : '⚠️') + ' <b>' + esc(x.fish) + '</b> — bajarildi <b>' + sn.bajarildi + ' / ' + QM + '</b>');
    M.push('   📞 ' + sn.aloqa + ' aloqa · 🤝 ' + sn.vada + ' va\'da · ✉ ' + sn.xat + ' xat · ⏭ ' + sn.otkazildi + ' o\'tkazildi · 🕓 ' + sn.kech + ' qadam kechiktirildi · navbatda ' + sn.navbat + ' qoldi'
      + (sn.qoshimcha ? ' · navbatdan tashqari ' + sn.qoshimcha : ''));
    if (!sn.aloqa && !sn.bajarildi && !h.otkaz.length) M.push('   ❗ Bugun bitta ham chora yozilmagan.');
    if (h.nazorat && h.nazorat.kerak) M.push('   📋 Nazorat: ' + h.nazorat.kerak + ' ta mijozdan ' + (h.nazorat.qilinmadi ? '<b>' + h.nazorat.qilinmadi + ' tasiga qo\'ng\'iroq qilinmadi</b>: ' + h.nazorat.qilinmaganlar.slice(0, 8).map(z => z.no + (z.kerak === 'eslatma0' ? ' (va\'da kuni!)' : z.kerak === 'eslatma1' ? ' (va\'da ertaga)' : '')).join(', ') : 'hammasiga qo\'ng\'iroq qilindi ✅'));
    if (h.otkaz.length) M.push('   O\'tkazgan: ' + h.otkaz.slice(0, 6).map(o => o.no + ' — «' + esc(o.sabab) + '»').join('; ') + (h.otkaz.length > 6 ? ' va yana ' + (h.otkaz.length - 6) : ''));
    if (h.kech.length) { const g = {}; h.kech.forEach(k => { const t = qdTurNom(k.qadam); g[t] = (g[t] || 0) + 1; });
      M.push('   Kechiktirgan: ' + Object.keys(g).map(t => g[t] + ' ta ' + t).join(', ')); }
    if (h.kutishBugun.length) M.push('   ⏸️ Kutishga qo\'ydi: ' + h.kutishBugun.slice(0, 6).map(r => r.no + ' — ' + dmy(r.gacha) + ' gacha, «' + esc(r.sabab) + '»').join('; ')
      + (h.kutishBugun.length > 6 ? ' va yana ' + (h.kutishBugun.length - 6) : ''));
    const teg = h.navbat.filter(m => !m.faol && ((m.davoOtgan && Number(m.muddati) > 100000) || m.qadam.some(z => z.topId && z.holat === 'kutadi')));
    if (teg.length) M.push('   ⚠ Xavfli, lekin bugun tegilmagan: <b>' + teg.length + '</b> — ' + teg.slice(0, 8).map(m => m.no + (m.qadam.some(z => z.topId && z.holat === 'kutadi') ? ' (📌)' : ' (⚖)')).join(', ')
      + (teg.length > 8 ? ' va yana ' + (teg.length - 8) : ''));
    M.push(''); });
  if (!kam) return { yuborilmadi: 'Hamma reja bajarildi — xabar yuborilmadi.', undiruvchi: XD.length };
  const t = M.join('\n').replace(/\n+$/, '');
  const Y = yuboruvchi(kod, opt, 'qadamKechki');
  const n = await Y.direktor(t);
  if (opt.quruq) return { quruq: true, xabarlar: Y.xabarlar, sabab: t.length + ' belgi' + (t.length > TG_MAX ? ' — eski tizimda Telegram rad etardi (4096 dan uzun), server ' + Math.ceil(t.length / TG_MAX) + '+ bo\'lakda yuboradi' : '') };
  return { undiruvchi: XD.length, kam, belgi: t.length, xabar: n };
}

// ================================================================== ijroKechki (18:15)
// zinapoya holati eski tizimda Script Properties da edi — server birinchi marta shu oyda ishlaganda hozirgi pog'onalarni «xabar berilgan» deb oladi
// (eski tizim har yozuvdan keyin xabar bergan), aks holda o'tib bo'lgan pog'onalar uchun xabar ikkinchi marta ketardi
async function zinaBoshla(oy, XD, L) {
  const k0 = 'ijro_zina_bosh:' + oy; if (await redis.get(k0)) return 0;
  let n = 0;
  for (const x of XD) { const p = IY().ijroOySon(L, x.fish, oy), b = p.ball, pg = b >= 5 ? 3 : b >= 3 ? 2 : b >= 1 ? 1 : 0; if (!pg) continue;
    if (await redis.set('ijro_zina:' + oy + ':' + Buffer.from(s(x.fish)).toString('base64url'), String(pg), 'NX')) n++; }
  await redis.set(k0, new Date().toISOString(), 'EX', 40 * 86400);
  return n;
}
async function ijroKechki(kod, opt = {}) {
  const iy = IY(), q = Q(), bugun = V.bugun(), oy = bugun.slice(0, 7);
  if (hafta(bugun) === 0) return { yuborilmadi: 'Yakshanba.' };
  const vq = opt.varaq || {}, KV = vq.kun || IJRO_KUN, QV = vq.q || iy.IJRO_VARAQ;
  if (!opt.quruq) await kut(tetik.varaqlarYangila(['06_Undiruv_jurnali', '06n_Qadam_kun', '10_Topshiriqlar', '06e_Xatlar', '06b_Yuridik_ishlar']).catch(() => {}), 30000);
  const XD = await iy.qdXodimlar(), UU = XD.filter(x => x.undiruvchi);
  const [KL, L0, Xj, T, Sl] = await Promise.all([iy.ijroQatorYangi(KV, q.IJRO_KS), iy.ijroQatorYangi(QV, iy.IJRO_S), J.xatJurnal(), J.topRows(), U.undShartnomalar()]);
  const S = {}; Sl.forEach(x => { S[x.no] = x; });
  // solishtirish (quruq): bugun eski tizim yozgan kechki qoidabuzarliklar hisobga olinmaydi — server «noldan» nima yozardi
  const eskiBugun = L0.filter(r => ijroIso(r.Sana) === bugun && KECHKI_TUR.indexOf(s(r.Tur)) >= 0);
  const eskiKun = KL.filter(r => ijroIso(r.Sana) === bugun);
  const L06 = opt.quruq ? L0.filter(r => eskiBugun.indexOf(r) < 0) : L0.slice();
  let hozir = TS.topHozirIso();
  if (opt.quruq && eskiKun.length) { const t = eskiKun.map(r => seriyaVaqt(r.Yozildi)).filter(Boolean).sort()[0]; if (t) hozir = bugun + ' ' + t; }
  const H = UU.length ? await q.qdHisob(kod, UU.map(x => x.fish), bugun, XD) : {};
  // 23.10 direktor qarori: xatlar uchun 1 ish kuni muhlat — server ijro_kechki ni o'ziga olgach (bayroq); quruq sinovda eski tizim bilan solishtirish uchun — eski qoida
  const yangiX = opt.yangiQoida !== undefined ? !!opt.yangiQoida : await q.xatYangiQoida();
  if (!opt.quruq && !opt.varaq) await zinaBoshla(oy, XD, L0).catch(e => console.error('ijro zina bosh:', e.message));
  const Y = yuboruvchi(kod, opt, 'ijroKechki');
  // 06r qatori: bor bo'lsa — o'sha qator, yo'q bo'lsa — A ustunining oxiridan keyin. Yozuvlar oxirida bitta so'rovda
  let oxiri = KL.length ? KL[KL.length - 1].qator : 1;
  const kunData = [], kunSana = [], kunLog = [];
  const kunQator = (f, k, foiz) => { const bor = KL.find(r => xodimTeng(r.Xodim, f) && ijroIso(r.Sana) === bugun); const row = bor ? bor.qator : ++oxiri;
    const v = [f, k.rT, k.rB, k.nT, k.nB, k.xT, k.xB, k.tT, k.tB, foiz === null ? '' : foiz];
    kunLog.push({ fish: f, qator: row, bor: !!bor, v, eski: bor ? [bor.Xodim, bor.Reja_talab, bor.Reja_bajardi, bor.Nazorat_talab, bor.Nazorat_bajardi, bor.Xat_talab, bor.Xat_ozkunida, bor.Top_talab, bor.Top_vaqtida, bor.Foiz] : null });
    kunData.push({ varaq: KV, katak: 'B' + row + ':K' + row, qiymat: [v] });
    kunSana.push({ varaq: KV, qator: row, ustun: 1, iso: bugun }, { varaq: KV, qator: row, ustun: 12, iso: hozirSek(), naqsh: 'dd.MM.yyyy HH:mm' }); };
  const kalitlar = new Set(L06.map(r => s(r.Kalit)));
  const yangiLog = [];
  const yoz = async (f, o, out) => {
    const o2 = Object.assign({ xodim: f, sana: bugun }, o); if (!iy.IJRO_TUR[o2.tur]) return;
    if (o2.kalit && kalitlar.has(o2.kalit)) return;
    let r;
    if (opt.quruq) { const T0 = iy.IJRO_TUR[o2.tur]; r = { tur: o2.tur, nomi: o2.nomi || T0[0], ogirlik: T0[1], no: o2.no || '', tafsilot: o2.tafsilot || '' }; }
    else { r = await iy.ijroYoz(QV, o2); if (!r) { kalitlar.add(o2.kalit); return; } }
    kalitlar.add(o2.kalit); out.push(r); yangiLog.push(Object.assign({ xodim: f, kalit: o2.kalit }, r));
    L06.push({ ID: r.id || '', Sana: bugun, Xodim: f, Tur: o2.tur, Nomi: r.nomi, Shartnoma: r.no, Tafsilot: r.tafsilot, Holati: 'Hisobda', Tushuntirish: '', Kalit: o2.kalit });
  };
  const yangi = {};
  for (const x of UU) { const h = H[x.fish]; if (!h) continue; const f = x.fish; const Lx = yangi[f] = [];
    const k = q.ijroKun(h, f, bugun, Xj, T, S, opt.quruq ? hozir : null, yangiX); const foiz = q.ijroFoiz(k, 0);
    kunQator(f, k, foiz);
    if (k.rB < k.rT) await yoz(f, { tur: 'reja', kalit: 'reja|' + bugun + '|' + f, tafsilot: 'Bajarildi ' + k.rB + ' / ' + k.rT + ' mijoz' + (h.otkaz.length ? ' · o\'tkazilgan: ' + h.otkaz.length : '') }, Lx);
    if (h.nazorat && h.nazorat.qilinmadi) await yoz(f, { tur: 'nazorat', kalit: 'nazorat|' + bugun + '|' + f, tafsilot: h.nazorat.qilinmadi + ' ta mijozga qo\'ng\'iroq qilinmadi: ' + h.nazorat.qilinmaganlar.slice(0, 8).map(z => z.no + (z.kerak === 'eslatma0' ? ' (va\'da kuni)' : z.kerak === 'eslatma1' ? ' (va\'da ertaga)' : '')).join(', ') }, Lx);
    if (h.otkaz.length > QD_OTKAZ_CHEGARA) await yoz(f, { tur: 'otkaz', kalit: 'otkaz|' + bugun + '|' + f, tafsilot: h.otkaz.length + ' ta mijoz o\'tkazildi: ' + h.otkaz.slice(0, 6).map(o => o.no + ' «' + o.sabab + '»').join('; ') }, Lx);
    for (const h2 of Xj.filter(z => z.holati === 'Tayyorlandi' && S[z.no] && xodimTeng(S[z.no].undiruvchi, f) && X.xatIso(z.sana) <= bugun && X.xatIso(z.sana) >= IJRO_BOSH)) {
      const rad = /^Rad\|(\d{2})\.(\d{2})\.(\d{4})/.exec(s(h2.tek));   // isbotni yurist qaytargan — hisob qaytarilgan kundan
      const bosh = rad ? rad[3] + '-' + rad[2] + '-' + rad[1] : X.xatIso(h2.sana);
      const fio = (S[h2.no] || {}).fish || '';
      if (yangiX) {   // 23.10 qoidasi: muhlat — keyingi ish kuni; o'tsa 1 ball (bir marta), 3 ish kunidan beri — 3 ball
        const ik = q.xatIshKun(bosh, bugun), muh = q.xatMuhlat(bosh);
        if (ik >= 1 && ik < 3 && !rad) await yoz(f, { tur: 'xat', nomi: 'Xat muhlatida (1 ish kuni) yetkazilmadi', kalit: 'xat|' + h2.raqam, no: h2.no, fish: fio, tafsilot: h2.raqam + ' — ' + q.qdXatNom(h2) + ' ' + dmy(bosh) + ' da chiqarilgan, muhlati (' + dmy(muh) + ') o\'tdi — yetkazilmadi' }, Lx);
        if (ik >= 3) await yoz(f, { tur: 'xat3', nomi: 'Xat 3 ish kunidan beri yetkazilmadi', kalit: 'xat3|' + h2.raqam, no: h2.no, fish: fio, tafsilot: h2.raqam + ' — ' + q.qdXatNom(h2) + ' ' + ik + ' ish kunidan beri yetkazilmagan (muhlat ' + dmy(muh) + ')' }, Lx);
        continue;
      }
      const kun = kunFarq(bosh, bugun);
      if (kun === 0 && !rad) await yoz(f, { tur: 'xat', kalit: 'xat|' + h2.raqam, no: h2.no, fish: fio, tafsilot: h2.raqam + ' — ' + q.qdXatNom(h2) + ' bugun chiqarilgan, yetkazilmadi' }, Lx);
      if (kun >= 2) await yoz(f, { tur: 'xat3', kalit: 'xat3|' + h2.raqam, no: h2.no, fish: fio, tafsilot: h2.raqam + ' — ' + q.qdXatNom(h2) + ' ' + (kun + 1) + ' kundan beri yetkazilmagan' }, Lx);
    }
    for (const t of T.filter(t => xodimTeng(t.kimga, f) && t.holati === 'Jarayonda' && TS.topIso(t.muddat) && TS.topIso(t.muddat) < hozir && TS.topIso(t.muddat) >= IJRO_BOSH)) {
      const olib = /^olib\|/.test(s(t.kalit));   // olib kelish topshirig'i — har kun
      await yoz(f, { tur: 'top', kalit: 'top|' + t.id + (olib ? '|' + bugun : ''), no: t.no, tafsilot: '«' + t.sarlavha + '» — muddat ' + t.muddat + (olib ? ' · hali bajarilmagan (har kun hisoblanadi)' : '') }, Lx);
    }
  }
  let jami = 0;
  for (const x of UU) { const Lx = yangi[x.fish] || []; if (!Lx.length) continue; jami += Lx.length;
    const S2 = iy.ijroOySon(L06, x.fish, oy);
    if (x.tg) await Y.chat(x.tg, x.fish, '📒 <b>Bugungi qoidabuzarliklar</b> — ' + dmy(bugun) + '\n' + Lx.map(z => '• ' + z.nomi + (z.no ? ' (' + z.no + ')' : '') + ' — ' + esc(z.tafsilot)).join('\n')
      + '\n\nBu oy: <b>' + S2.ball + '</b> ball. Sababini ilovada «📒 Ijro intizomi» da yozing.');
    if (!opt.quruq && !opt.tgYoq) await iy.ijroZina(kod, x.fish, XD, L06).catch(e => console.error('ijroZina:', e.message));
  }
  // boshqa xodimlar — faqat topshiriqlar (+ yurist nazorati)
  const O = XD.filter(x => !x.undiruvchi && x.huquq.length && x.huquq.indexOf('admin') < 0);
  let TN = null, YK = null;
  for (const x of O) { const f = x.fish, Lx = [];
    const k = q.ijroTopKun(T, f, bugun, hozir); const foiz = q.ijroFoiz(k, 0);
    if (k.tT || T.some(t => xodimTeng(t.kimga, f) && t.holati === 'Jarayonda')) kunQator(f, k, foiz);
    for (const t of T.filter(t => xodimTeng(t.kimga, f) && t.holati === 'Jarayonda' && TS.topIso(t.muddat) && TS.topIso(t.muddat) < hozir && TS.topIso(t.muddat) >= IJRO_BOSH_XODIM))
      await yoz(f, { tur: 'top', kalit: 'top|' + t.id, no: t.no, tafsilot: '«' + t.sarlavha + '» — muddat ' + t.muddat }, Lx);
    if (x.huquq.indexOf('yurist') >= 0) {   // ijroYurist_
      try { TN = TN || await TS.tasdiqNavbat();
        for (const it of TN.filter(it => it.tasdiqchi === 'yurist' && it.kech && s(it.muddat).slice(0, 10) >= IJRO_BOSH_XODIM))
          await yoz(f, { tur: 'tasdiq', kalit: 'tasdiq|' + it.k + '|' + it.vaqt, no: it.no, tafsilot: it.nomi + ' — ' + (it.kim || '') + ' topshirgan, tekshirish muddati ' + dmy(it.muddat) }, Lx);
      } catch (e) { console.error('ijroYurist_ tasdiq:', e.message); }
      try { const YQ = require('../api/yurist').Q; YK = YK || { K: await YQ.yuKesh(), I: await J.yuIshlar() };
        const KK = YK.I.filter(i => YQ.YU_FAOL.indexOf(i.holati) >= 0 && (!i.yurist || xodimTeng(i.yurist, f))).map(i => YQ.yuKorinish(i, S[i.no], bugun, YK.K))
          .filter(k2 => k2.yuMas && k2.kechikdi > 0 && k2.chegara >= IJRO_BOSH_XODIM);
        for (const k2 of KK) await yoz(f, { tur: k2.qabulKerak ? 'yuqabul' : 'yubosqich', kalit: k2.qabulKerak ? 'yuqabul|' + k2.id : 'yubos|' + k2.id + '|' + k2.bosqich, no: k2.no, fish: k2.fish,
          tafsilot: k2.keyingi + ' — muddat ' + dmy(k2.chegara) + ', ' + k2.kechikdi + ' kun kechikdi' }, Lx);
      } catch (e) { console.error('ijroYurist_ ish:', e.message); }
    }
    if (!Lx.length) continue; jami += Lx.length;
    const S2 = iy.ijroOySon(L06, f, oy);
    if (x.tg) await Y.chat(x.tg, f, '📒 <b>Muddati o\'tgan topshiriqlar</b> — ' + dmy(bugun) + '\n' + Lx.map(z => '• ' + (z.no ? z.no + ' — ' : '') + esc(z.tafsilot)).join('\n')
      + '\n\nBu oy: <b>' + S2.ball + '</b> ball. Topshiriqni bajaring yoki ilovada «📒 Ijro intizomi» da sababini yozing.');
    if (!opt.quruq && !opt.tgYoq) await iy.ijroZina(kod, f, XD, L06).catch(e => console.error('ijroZina:', e.message));
  }
  // 06r — bitta so'rovda (qiymatlar, keyin sanalar)
  if (!opt.quruq && kunData.length) {
    try { await G.yoz(env.aksBazaId, kunData, env.googleKey); await G.sanaYoz(env.aksBazaId, kunSana, env.googleKey); }
    catch (e) { if (e instanceof G.RuxsatYoq) e.yozilmadi = true; throw e; }
  }
  if (!opt.quruq && !opt.varaq) await kut(tetik.varaqlarYangila([IJRO_KUN, iy.IJRO_VARAQ]).catch(() => {}), 15000);
  const natija = UU.length + ' undiruvchi + ' + O.length + ' xodim: kunlik ijro yozildi; yangi qoidabuzarlik — ' + jami + ' ta.';
  if (!opt.quruq) return { natija, kun06r: kunLog.length, yangi06q: jami, xabar: Y.xabarlar.length || undefined, kunLog: opt.varaq ? kunLog : undefined };
  // ---- solishtirish chiqishi
  const ch = [];
  ch.push('Eski tizim bugun 06r ga yozgan qatorlar: ' + eskiKun.length + (eskiKun.length ? ' (vaqti ' + eskiKun.map(r => seriyaVaqt(r.Yozildi)).filter(Boolean).sort()[0] + ' — server «hozir» ni shunga oldi)' : ''));
  ch.push('06r (C–K: Reja_talab, Reja_bajardi, Nazorat_talab, Nazorat_bajardi, Xat_talab, Xat_ozkunida, Top_talab, Top_vaqtida, Foiz):');
  let farqKun = 0;
  kunLog.forEach(z => { const sv = z.v.slice(1).map(v => v === '' ? '—' : v).join(' '), ev = z.eski ? z.eski.slice(1).map(v => v === '' ? '—' : v).join(' ') : null;
    const ok = ev !== null && sv === ev; if (!ok) farqKun++;
    ch.push('  ' + (ok ? '✅' : ev === null ? '🆕' : '≠ ') + ' ' + z.fish + ': server ' + sv + (ev === null ? ' (eski tizimda bugungi qator yo\'q)' : ok ? '' : ' | eski ' + ev)); });
  eskiKun.filter(r => !kunLog.some(z => xodimTeng(z.fish, r.Xodim))).forEach(r => { farqKun++; ch.push('  ≠  ' + r.Xodim + ': faqat eski tizimda bor'); });
  const sk = new Set(yangiLog.map(z => z.kalit)), ek = new Set(eskiBugun.map(r => s(r.Kalit)));
  const faqatS = yangiLog.filter(z => !ek.has(z.kalit)), faqatE = eskiBugun.filter(r => !sk.has(s(r.Kalit)));
  ch.push('06q yangi qoidabuzarliklar: server ' + yangiLog.length + ' ta · eski tizim bugun ' + eskiBugun.length + ' ta · ikkalasida bir xil ' + yangiLog.filter(z => ek.has(z.kalit)).length + ' ta');
  faqatS.forEach(z => ch.push('  🆕 faqat server: ' + z.xodim + ' — ' + z.kalit + ' — ' + s(z.tafsilot).slice(0, 90)));
  faqatE.forEach(r => ch.push('  ⚪ faqat eski: ' + r.Xodim + ' — ' + r.Kalit + ' — ' + s(r.Tafsilot).slice(0, 90)));
  return { quruq: true, xabarlar: Y.xabarlar, chiqish: ch, farq: farqKun + faqatS.length + faqatE.length, eskiBor: eskiKun.length > 0 };
}

// ================================================================== ijroTekshiruvTanla (09:30) va ijroOylik (oyning 1-kuni)
async function ijroOylik(kod, opt = {}) {
  const iy = IY(), q = Q(), bugun = V.bugun();
  const p = bugun.split('-').map(Number), o = new Date(Date.UTC(p[0], p[1] - 2, 15));
  const oy = o.toISOString().slice(0, 7);
  const XD = await iy.qdXodimlar();
  const [L, TL, KL] = await Promise.all([iy.ijroQatorYangi(iy.IJRO_VARAQ, iy.IJRO_S), iy.ijroQatorYangi(iy.IJRO_TEK, iy.IJRO_TS), iy.ijroQatorYangi(IJRO_KUN, q.IJRO_KS)]);
  const M = ['📊 <b>Ijro intizomi — ' + q.QD_OY[o.getUTCMonth()] + ' ' + o.getUTCFullYear() + '</b>', ''];
  XD.filter(x => x.undiruvchi).forEach(x => {
    const K = KL.filter(r => xodimTeng(r.Xodim, x.fish) && ijroIso(r.Sana).slice(0, 7) === oy)
      .map(r => ({ rT: r.Reja_talab, rB: r.Reja_bajardi, nT: r.Nazorat_talab, nB: r.Nazorat_bajardi, xT: r.Xat_talab, xB: r.Xat_ozkunida, tT: r.Top_talab, tB: r.Top_vaqtida }));
    const sn = iy.ijroOySon(L, x.fish, oy); const f = q.ijroFoiz(q.ijroYig(K), sn.soxta);
    const tk = TL.filter(r => xodimTeng(r.Undiruvchi, x.fish) && ijroIso(r.Tanlandi).slice(0, 7) === oy);
    M.push('<b>' + esc(x.fish) + '</b> — ijro <b>' + (f === null ? '—' : f + '%') + '</b> (' + K.length + ' ish kuni) · qoidabuzarlik ' + sn.soni + ' ta (' + sn.ball + ' ball, ' + q.ijroPog(sn.ball) + '-pog\'ona)'
      + ' · tekshiruv: ' + tk.filter(r => r.Holati === 'Tasdiqlandi').length + ' ✅ / ' + tk.filter(r => r.Holati === 'Tasdiqlanmadi').length + ' ❌'); });
  const m = M.join('\n'); const adm = XD.filter(z => z.huquq.indexOf('admin') >= 0 && z.tg);
  const Y = yuboruvchi(kod, opt, 'ijroOylik');
  if (adm.length) { for (const a of adm) await Y.chat(a.tg, 'direktor ' + a.fish, m); } else await Y.direktor(m).catch(e => console.error('ijroOylik:', e.message));
  return opt.quruq ? { xabarlar: Y.xabarlar } : { oylik: oy, direktor: adm.length || 1 };
}
async function ijroTekshiruvTanla(kod, opt = {}) {
  const iy = IY(), tp = TP(), bugun = V.bugun(), d = hafta(bugun), xabar0 = [];
  let oylik = null;
  if (Number(bugun.slice(8, 10)) === 1 || opt.oylikKor) {
    try { const r = await ijroOylik(kod, opt); if (opt.quruq) (r.xabarlar || []).forEach(z => xabar0.push({ kimga: z.kimga + (Number(bugun.slice(8, 10)) === 1 ? '' : ' — NAMUNA: faqat oyning 1-kuni yuboriladi'), matn: z.matn })); else oylik = r; }
    catch (e) { console.error('ijroOylik:', e.message); oylik = { xato: e.message }; }
  }
  if (d === 0) return opt.quruq ? { quruq: true, xabarlar: xabar0, sabab: 'Yakshanba.' } : { yuborilmadi: 'Yakshanba.', oylik };
  const kecha = kunQosh(bugun, d === 1 ? -2 : -1);
  const vq = opt.varaq || {}, topV = vq.top || tp.TOP_V, tekV = vq.tek || iy.IJRO_TEK;
  const XD = await iy.qdXodimlar(), UU = XD.filter(x => x.undiruvchi);
  let tek = XD.filter(x => x.huquq.indexOf('tekshiruv') >= 0 && !x.undiruvchi); if (!tek.length) tek = XD.filter(x => x.huquq.indexOf('admin') >= 0);
  if (!tek.length) return { yuborilmadi: 'Tekshiruvchi yo\'q.', oylik };
  const TL0 = await iy.ijroQatorYangi(tekV, iy.IJRO_TS);
  const eskiBugun = TL0.filter(r => ijroIso(r.Tanlandi) === bugun && Number(r.Urinish) === 1);
  if (eskiBugun.length && !opt.quruq) return { yuborilmadi: 'Bugun allaqachon tanlangan.', oylik };
  const TL = opt.quruq ? TL0.filter(r => eskiBugun.indexOf(r) < 0) : TL0;
  const yaqin = kunQosh(bugun, -IJRO_TEKSHIR_TAKROR_KUN);
  const band = {}; TL.forEach(r => { if (ijroIso(r.Tanlandi) >= yaqin) band[s(r.Shartnoma)] = 1; });
  const S = {}; (await U.undShartnomalar()).forEach(x => { S[x.no] = x; });
  const Jr = (await J.undJurnal()).filter(j => j.sana === kecha && IJRO_TEK_CHORA.indexOf(j.chora) >= 0 && j.natija === 'Боғланилди' && !band[j.no] && S[j.no]);
  const yangi = [], hovuz = {}; let n = 0;
  for (const x of UU) { const L = Jr.filter(j => xodimTeng(j.kim, x.fish));
    const bir = {}, T = []; L.slice().sort(() => Math.random() - 0.5).forEach(j => { if (!bir[j.no] && T.length < IJRO_TEKSHIR_SONI) { bir[j.no] = 1; T.push(j); } });
    hovuz[x.fish] = new Set(L.map(j => j.no));
    for (const j of T) { const t = tek[n++ % tek.length];
      if (opt.quruq) { yangi.push({ no: S[j.no].no, fish: S[j.no].fish, kimga: t.fish, und: x.fish, jurnal: j.id }); continue; }
      const R = await tp.topRowsYangi(topV);
      yangi.push(await iy.tekYarat(j, S[j.no], x.fish, t.fish, 1, bugun, R, { top: topV, tek: tekV })); } }
  const Y = yuboruvchi(kod, opt, 'ijroTekshiruvTanla'); xabar0.forEach(z => Y.xabarlar.push(z));
  const Gr = {}; yangi.forEach(o => (Gr[o.kimga] = Gr[o.kimga] || []).push(o));
  for (const f of Object.keys(Gr)) { const t = XD.find(z => z.fish === f); if (!t || !t.tg) continue;
    await Y.chat(t.tg, f, '🎲 <b>Bugun ' + Gr[f].length + ' ta tekshiruv qo\'ng\'irog\'i</b> — mijozga qo\'ng\'iroq qilib, undiruvchi rostdan gaplashgan-gaplashmaganini so\'rang.\n'
      + Gr[f].map(o => '• ' + o.no + ' ' + esc(qisqaIsm(o.fish))).join('\n') + '\n\nIlovada: 📌 Topshiriqlar — javob kartaning o\'zida.'); }
  if (!opt.quruq) { if (yangi.length && !opt.varaq) await kut(tetik.varaqlarYangila([tp.TOP_V, iy.IJRO_TEK]).catch(() => {}), 15000);
    return { natija: kecha + ' yozuvlaridan ' + yangi.length + ' ta tekshiruv tanlandi.', tanlandi: yangi.length, oylik: oylik || undefined, yangi: opt.varaq ? yangi : undefined }; }
  // ---- solishtirish (bugun eski tizim tanlagan bo'lsa)
  const ch = ['Kechagi ish kuni: ' + dmy(kecha) + ' · tekshiruvchi(lar): ' + tek.map(t => t.fish).join(', ')];
  let farq = 0;
  UU.forEach(x => { const sv = yangi.filter(o => o.und === x.fish), ev = eskiBugun.filter(r => xodimTeng(r.Undiruvchi, x.fish)), hv = hovuz[x.fish] || new Set();
    const kerak = Math.min(IJRO_TEKSHIR_SONI, hv.size), tashqi = ev.filter(r => !hv.has(s(r.Shartnoma)));
    let belgi = '';
    if (eskiBugun.length) { const ok = ev.length === kerak && !tashqi.length; if (!ok) farq++; belgi = (ok ? '✅' : '≠ ') + ' '; }
    ch.push('  ' + belgi + x.fish + ': tanlash mumkin ' + hv.size + ' ta yozuv → server ' + sv.length + ' ta (' + sv.map(o => o.no).join(', ') + ')'
      + (eskiBugun.length ? ' · eski tizim bugun ' + ev.length + ' ta (' + ev.map(r => r.Shartnoma).join(', ') + ')' + (tashqi.length ? ' — ⚠ ' + tashqi.map(r => r.Shartnoma).join(', ') + ' server ro\'yxatida yo\'q' : '') : '')); });
  if (eskiBugun.length) ch.push('(Tanlash tasodifiy — raqamlar har xil bo\'lishi tabiiy; muhimi soni va eski tanlaganlar server ro\'yxatida borligi.)');
  else ch.push('(Eski tizim bugun hali tanlamagan — solishtirilmadi.)');
  return { quruq: true, xabarlar: Y.xabarlar, chiqish: ch, farq, eskiBor: eskiBugun.length > 0 };
}

module.exports = { qadamKechki, ijroKechki, ijroTekshiruvTanla, ijroOylik, zinaBoshla, IJRO_KUN };
