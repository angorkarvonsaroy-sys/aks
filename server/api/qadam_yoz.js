// AKS TIZIM — ▶ «Bugungi ish» dagi undiruvchi amallari serverda (Qadam.gs v2.2 bilan bir xil tekshiruvlar, xato matnlari, javob va kataklar):
//   qadamOtkaz      — ⏭ «Bugun qila olmayman»: 06n_Qadam_kun ga «O'tkazildi» / «Qisman» (qdYoz_); kuniga 3 tadan oshsa direktorga Telegram;
//                     da'vo muddati o'tgan mijoz — direktordan ruxsat so'rovi (qdRuxsatSora_ → 10_Topshiriqlar + Telegram)
//   qadamDirektorga — 📣 direktorga Telegram (kuniga bir marta; Redis eslab qoladi); «ma'lumot topilmadi» — direktor topshirig'i (qdMalumotTop_)
//   qadamMalumot    — ⓘ topilgan JSHSHIR / otasining ismi / telefon — 06i_Direktor_sorovlari ga tahrir so'rovi + Telegram (qdMalumotYoz_)
//   qadamMuhlatSora — 📅 qo'shimcha muddat so'rash: suhbat jurnali (undYoz) + direktorga topshiriq + Telegram
//   qadamTgYubordim — ✈ xat Telegramda yuborildi — jurnalga (undYoz)
// Telegram — Koprik v1.5 koprikTgYubor (eski tizimning tgYubor_ ining o'zi). Yozish faqat «aks-yozuv-sinov qadam» nusxa varaqda tekshirgach yoqiladi
// (Redis yozuv_yondi:qadam). Aks holda yoki robotda yozish huquqi bo'lmasa — amal avvalgidek eski tizim orqali bajariladi.
'use strict';
const crypto = require('crypto');
const S = require('./sessiya');
const V = require('../lib/varaq');
const J = require('../lib/jurnallar');
const U = require('../lib/undiruv_yordam');
const G = require('../lib/google');
const env = require('../lib/env');
const koprik = require('./koprik');
const tetik = require('../lib/kozgu_tetik');
const { redis } = require('../lib/db');
const { qisqaIsm } = require('../lib/ism');
const Q = require('./qadam');
const UY = require('./undiruv_yoz');
const TP = require('./topshiriq_yoz')._ichki;

const QDV = '06n_Qadam_kun', SOR_V = '06i_Direktor_sorovlari', XAT_V = '06e_Xatlar', TOP_V = TP.TOP_V;
const QD_OTKAZ_CHEGARA = 3, QD_MAQSAD = 20, QD_SABAB_MIN = 10;
const QD_MAYDON = { jshshir: 'JSHSHIR', ota: 'Otasining ismi', tel: 'Telefon raqami' };
const s = v => String(v == null ? '' : v);
const dmy = iso => iso.split('-').reverse().join('.');
const esc = v => s(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const escAL = v => s(v).replace(/&/g, '&amp;').replace(/</g, '&lt;');   // qadamDirektorga dagi esc (faqat & va <)
const qdPul = n => Math.round(Number(n) || 0).toLocaleString('ru-RU').replace(/[  ,]/g, ' ');
function qdSabab(v, izoh) { const t = s(v).replace(/\s+/g, ' ').trim(); if (t.length < QD_SABAB_MIN) throw new S.Xato('Sababini yozing (kamida ' + QD_SABAB_MIN + ' belgi)' + (izoh === undefined ? ': nega bugun qila olmaysiz.' : izoh)); return t.slice(0, 300); }
function hozir() { const d = new Date(Date.now() + 5 * 3600 * 1000), p = n => String(n).padStart(2, '0');
  return { iso: d.toISOString().slice(0, 19).replace('T', ' '), dmyHm: p(d.getUTCDate()) + '.' + p(d.getUTCMonth() + 1) + '.' + d.getUTCFullYear() + ' ' + p(d.getUTCHours()) + ':' + p(d.getUTCMinutes()),
    dmyHms: p(d.getUTCDate()) + '.' + p(d.getUTCMonth() + 1) + '.' + d.getUTCFullYear() + ' ' + p(d.getUTCHours()) + ':' + p(d.getUTCMinutes()) + ':' + p(d.getUTCSeconds()) }; }
function ertaDmy() { const d = new Date(Date.now() + 5 * 3600 * 1000 + 86400000), p = n => String(n).padStart(2, '0'); return p(d.getUTCDate()) + '.' + p(d.getUTCMonth() + 1) + '.' + d.getUTCFullYear(); }
const kut = (p, ms) => Promise.race([p, new Promise(r => setTimeout(r, ms))]);

async function qulf(nom, ish) {   // LockService o'rni; «topshiriq» — topshiriq_yoz.js bilan bitta qulf
  const kalit = 'qulf:' + nom, belgi = crypto.randomBytes(8).toString('hex'), t0 = Date.now();
  while (!(await redis.set(kalit, belgi, 'PX', 30000, 'NX'))) { if (Date.now() - t0 > 30000) throw new S.Xato('Tizim band — birozdan keyin qayta urinib ko\'ring.'); await new Promise(r => setTimeout(r, 150)); }
  try { return await ish(); } finally { if ((await redis.get(kalit)) === belgi) await redis.del(kalit); }
}
async function serverda(kod) {
  try { if ((await redis.get('yozuv_yondi:qadam')) !== '1') return false; } catch (e) { return false; }
  return TP.koprik15(kod);
}
async function eskiTizim(fn, u, args) { const r = await koprik.chaqir(fn, u.kod, args); await tetik.yangilaKut(20000); return r; }
const tgDirektor = (kod, matn) => koprik.chaqir('koprikTgYubor', kod, [matn]);   // tgYubor_
const tgFon = (kod, matn) => { tgDirektor(kod, matn).catch(e => console.error('qadam tg (ko\'prik):', e.message)); };
const yangila = nomlar => kut(tetik.varaqlarYangila(nomlar).catch(e => console.error('ko\'zgu (qadam):', e.message)), 15000);
function yozilmadi(e) { if (e instanceof G.RuxsatYoq) e.yozilmadi = true; return e; }

// ------------------------------------------------------------------ yozuv yadrolari (sinov ham shularni ishlatadi — nusxa varaqda)
// qdYoz_: 06n oxiriga [Sana, Xodim, Shartnoma, Mijoz, Holati, Sabab, Qadam / qolgan ishlar, Bugun qilingan, Vaqt]; A — dd.MM.yyyy, I — dd.MM.yyyy HH:mm:ss
async function qdYoz(varaq, bugun, q) {
  const v = hozir();
  try {
    const A = await G.ustunOqi(env.aksBazaId, varaq, 'A', env.googleKey);
    const r = await G.qatorQoshR(env.aksBazaId, varaq, A.length + 1, [dmy(bugun), q.xodim, q.no, q.fish, q.holat, q.sabab, q.qadam, q.bugun, v.dmyHms], env.googleKey);
    await G.sanaYoz(env.aksBazaId, [{ varaq, qator: r, ustun: 1, iso: bugun }, { varaq, qator: r, ustun: 9, iso: v.iso, naqsh: 'dd.MM.yyyy HH:mm:ss' }], env.googleKey);
    return r;
  } catch (e) { throw yozilmadi(e); }
}
// monSorovlar_ — 06i Google'dan YANGI (getDisplayValues, A ustunining oxirgi to'ldirilgan qatorigacha)
async function sorovlar(varaq) {
  const X = await G.oraliqOqi(env.aksBazaId, varaq, 'A2:K', env.googleKey);
  let m = -1; X.forEach((r, i) => { if (s(r[0]) !== '') m = i; });
  return { L: X.slice(0, m + 1).map((r, i) => ({ qator: i + 2, id: s(r[0]), vaqt: s(r[1]), kim: s(r[2]), tur: s(r[3]), kalit: s(r[4]), sabab: s(r[5]), holati: s(r[6]) })).filter(z => z.id), l: m + 2 };
}
// qdMalumotYoz_ ning yozuv qismi: 06i oxiriga [ID, Vaqt, Kim, 'tahrir', Kalit, Sabab, 'Kutilmoqda', '', '', '', Malumot]
async function sorovYoz(varaq, R, kim, no, sabab, malumot) {
  const A = await G.oraliqOqi(env.aksBazaId, varaq, 'A2:A', env.googleKey, 'UNFORMATTED_VALUE');
  const id = Math.max(0, ...A.map(r => Number(r[0]) || 0)) + 1;
  let qator;
  try { qator = await G.qatorQoshR(env.aksBazaId, varaq, R.l + 1, [id, hozir().dmyHm, kim, 'tahrir', no, sabab, 'Kutilmoqda', '', '', '', malumot], env.googleKey); }
  catch (e) { throw yozilmadi(e); }
  return { id, qator };
}

// ------------------------------------------------------------------ ⏭ o'tkazish
async function ruxsatSora(u, m, sabab, bugun, H) {   // qdRuxsatSora_
  const kalit = 'otkaz|' + m.no + '|' + bugun;
  const XD = await TP.topXodimlar();
  const yangi = await qulf('topshiriq', async () => {
    const R = await TP.topRowsYangi(TOP_V);
    const bor = R.L.filter(t => t.kalit === kalit).pop();
    if (bor && (bor.holati === 'Jarayonda' || bor.holati === 'Tekshiruvda')) throw new S.Xato('Ruxsat so\'rovi allaqachon yuborilgan — direktor javobini kuting. Bu orada keyingi mijoz bilan ishlang.');
    if (bor && /^Rad/.test(bor.dalil)) throw new S.Xato('Direktor bugun bu mijozni o\'tkazishga ruxsat bermadi (' + bor.dalil + '). Shu mijoz bilan ishlang.');
    const dir = (XD.find(z => z.admin) || {}).fish; if (!dir) throw new S.Xato('Direktor 07_Xodimlar da topilmadi.');
    const keyingi = (m.qadam.find(z => z.holat === 'kutadi') || {}).t || '';
    return TP.topYoz(TOP_V, { manba: 'Xodim', qoida: 'otkaz', kalit, sarlavha: 'Da\'vo muddati o\'tgan mijozni bugun o\'tkazishga ruxsat so\'rayapti',
      izoh: sabab + ' | undiruvchi: ' + u.fish + (keyingi ? ' | navbatdagi qadam: ' + keyingi : ''), no: m.no, mid: m.mid, kimga: dir, kimBerdi: u.fish,
      muddat: dmy(bugun) + ' 18:00', muhim: 'Shoshilinch' }, R);
  });
  tgFon(u.kod, '🙋 <b>' + esc(u.fish) + '</b> — <b>' + m.no + '</b> ' + esc(qisqaIsm(m.fish)) + ' (⚖ da\'vo muddati o\'tgan) mijozni bugun o\'tkazishga ruxsat so\'rayapti:\n«' + esc(sabab) + '»\nJavob — ilovada 📌 Topshiriqlar (✓ Ruxsat / ✕ Rad).');
  await yangila([TOP_V]);
  return { ok: true, ruxsat: true, id: yangi.id, matn: 'Direktordan ruxsat so\'raldi. Javob kelguncha bu mijoz navbat oxirida turadi — keyingi mijoz bilan ishlang.', son: H.son };
}
function otkazTgMatn(u, m, n, holat, sabab, H) {
  const nom = x => '<b>' + x.no + '</b> ' + esc(qisqaIsm(x.fish));
  if (n === QD_OTKAZ_CHEGARA + 1) {
    const L = H.otkaz.concat([{ no: m.no, fish: m.fish, sabab, holat }]);
    return '⏭ <b>' + esc(u.fish) + '</b> bugun <b>' + n + '</b> ta mijozni o\'tkazdi (chegara — ' + QD_OTKAZ_CHEGARA + '):\n'
      + L.map((x, i) => (i + 1) + '. ' + nom(x) + (x.holat === 'Qisman' ? ' (qisman)' : '') + ' — «' + esc(x.sabab) + '»').join('\n')
      + '\n▶ Bajarildi: ' + H.son.bajarildi + ' / ' + QD_MAQSAD;
  }
  return '⏭ <b>' + esc(u.fish) + '</b> yana mijoz o\'tkazdi (' + n + '-si): ' + nom(m) + (holat === 'Qisman' ? ' (qisman)' : '') + ' — «' + esc(sabab) + '»';
}
async function qadamOtkaz(args) {
  const [kodSes, d] = args;
  const u = await S.ruxsat(kodSes, 'undiruv');
  if (!(await serverda(u.kod))) return eskiTizim('qadamOtkaz', u, args.slice(1));
  const sabab = qdSabab(d && d.sabab);
  const bugun = V.bugun();
  const H = (await Q._ichki.qdHisob(u.kod, [u.fish], bugun))[u.fish];
  const m = H.hamma.find(z => z.no === s(d.no));
  if (!m) throw new S.Xato('Bu mijoz portfelingizda emas.');
  if (m.yopildi) throw new S.Xato('Bu mijoz bugun allaqachon o\'tkazilgan.');
  if (m.tugadi) throw new S.Xato('Bu mijoz bo\'yicha bugungi ish bajarilgan — o\'tkazish shart emas, «Keyingi mijoz» ni bosing.');
  if (m.faqatYurist && !(d && d.ruxsatBilan)) return ruxsatSora(u, m, sabab, bugun, H);
  const holat = m.faol ? 'Qisman' : 'O\'tkazildi';
  try {
    await qulf('qadam', () => qdYoz(QDV, bugun, { xodim: u.fish, no: m.no, fish: m.fish, holat, sabab,
      qadam: m.qadam.filter(z => z.holat === 'kutadi').map(z => z.t).join(' | '), bugun: m.bugun.map(b => (b.vaqt ? b.vaqt + ' ' : '') + b.matn).join(' | ').slice(0, 1000) }));
  } catch (e) { if (e.yozilmadi) return eskiTizim('qadamOtkaz', u, args.slice(1)); throw e; }
  const n = H.otkaz.length + 1;
  let xabar = false;
  if (n > QD_OTKAZ_CHEGARA) { try { await tgDirektor(u.kod, otkazTgMatn(u, m, n, holat, sabab, H)); xabar = true; } catch (e) { console.error('qadamOtkaz telegram:', e.message); } }
  await yangila([QDV]);
  const son = Object.assign({}, H.son); son.navbat = Math.max(0, son.navbat - 1); son.otkazildi++; son.otkazJami++;
  return { ok: true, holat, otkaz: n, chegara: QD_OTKAZ_CHEGARA, xabar, son };
}

// ------------------------------------------------------------------ 📣 direktorga
async function portfeldagi(u, no) {
  const x = (await U.undShartnomalar()).find(z => z.no === s(no));
  if (!x || (!u.admin && x.undiruvchi !== u.fish)) throw new S.Xato('Bu shartnoma sizning portfelingizda emas.');
  return x;
}
async function malumotTop(u, x, maydon, izoh) {   // qdMalumotTop_
  const kalit = 'malumot|' + x.no + '|' + maydon;
  const XD = await TP.topXodimlar();
  return qulf('topshiriq', async () => {
    const R = await TP.topRowsYangi(TOP_V);
    const bor = R.L.find(t => t.kalit === kalit && (t.holati === 'Jarayonda' || t.holati === 'Tekshiruvda')); if (bor) return { bor };
    const dir = (XD.find(z => z.admin) || {}).fish; if (!dir) throw new S.Xato('Direktor 07_Xodimlar da topilmadi.');
    return { yangi: await TP.topYoz(TOP_V, { manba: 'Xodim', qoida: 'malumot', kalit, sarlavha: QD_MAYDON[maydon] + ' topilmadi — kim topib kiritadi?',
      izoh: qisqaIsm(x.fish) + (x.dokon ? ' · ' + x.dokon : '') + ' · undiruvchi: ' + u.fish + (izoh ? ' · «' + izoh + '»' : ''), no: x.no, mid: x.mid, kimga: dir, kimBerdi: u.fish, muddat: ertaDmy() + ' 18:00', muhim: 'Oddiy' }, R) };
  });
}
async function qadamDirektorga(args) {
  const [kodSes, d] = args;
  const u = await S.ruxsat(kodSes, 'undiruv');
  if (!(await serverda(u.kod))) return eskiTizim('qadamDirektorga', u, args.slice(1));
  const x = await portfeldagi(u, d.no);
  const matn = s(d.matn).replace(/\s+/g, ' ').trim().slice(0, 200); if (matn.length < 5) throw new S.Xato('Nima haqida ekani yo\'q.');
  const izoh = s(d.izoh).replace(/\s+/g, ' ').trim().slice(0, 300);
  const maydon = QD_MAYDON[s(d.maydon)] ? s(d.maydon) : '';
  if (maydon) {
    const t = await malumotTop(u, x, maydon, izoh);
    if (t.bor) return { ok: true, xabar: false, matn: 'Bu haqda direktorga aytilgan — topshiriq ochiq: ' + t.bor.kimga + ', muddat ' + t.bor.muddat + '.' };
    tgFon(u.kod, '📣 <b>' + escAL(u.fish) + '</b> — <b>' + x.no + '</b> ' + escAL(qisqaIsm(x.fish)) + (x.dokon ? ' · ' + escAL(x.dokon) : '') + '\n' + escAL(QD_MAYDON[maydon]) + ' topilmadi' + (izoh ? '\n«' + escAL(izoh) + '»' : '') + '\n📌 Topshiriqlaringizga qo\'shildi — «👤 Xodimga berish» bilan kimgadir topshiring yoki o\'zingiz kiriting.');
    await yangila([TOP_V]);
    return { ok: true, xabar: true, matn: 'Direktorga yuborildi: topshiriqlariga yozildi, Telegram xabar ketdi. Direktor kimgadir topshiradi.' };
  }
  const key = 'qd_dir_' + V.bugun() + '_' + x.no + '_' + Buffer.from(matn, 'utf8').toString('base64').replace(/\+/g, '-').replace(/\//g, '_').slice(0, 40);
  try { if (await redis.get(key)) return { ok: true, xabar: false, matn: 'Bu haqda bugun direktorga xabar yuborilgan — javobini kuting.' }; } catch (e) { }
  await tgDirektor(u.kod, '📣 <b>' + escAL(u.fish) + '</b> — <b>' + x.no + '</b> ' + escAL(qisqaIsm(x.fish)) + (x.dokon ? ' · ' + escAL(x.dokon) : '') + '\n' + escAL(matn) + (izoh ? '\n«' + escAL(izoh) + '»' : '') + '\nJami qarz: ' + qdPul(x.jami) + ' so\'m');
  try { await redis.set(key, '1', 'EX', 21600); } catch (e) { }
  return { ok: true, xabar: true, matn: 'Direktorga Telegram xabari yuborildi.' };
}

// ------------------------------------------------------------------ ⓘ topilgan ma'lumot → direktorga tahrir so'rovi
// qdMalumotYoz_ ning tekshiruv qismi (yozmaydi): { dd, f, sabab }
function malumotTekshir(r2, d, x, kutilmoqda) {
  const T = v => s(v).replace(/\s+/g, ' ').trim();
  const maydon = s(d.maydon), q = T(d.qiymat), manba = T(d.manba);
  if (manba.length < 5) throw new S.Xato('Qayerdan olganingizni yozing (masalan: pasport nusxasi, mijozning o\'zi aytdi).');
  const dd = {}, f = [];
  if (maydon === 'jshshir') { const j = q.replace(/\D/g, ''); if (j.length !== 14) throw new S.Xato('JSHSHIR 14 ta raqam bo\'lishi kerak.'); dd.jshshir = j; f.push(['JSHSHIR', T(r2[11]), j]); }
  else if (maydon === 'ota') { const o = q.toUpperCase(); if (!/^[A-Z'‘’ʻʼ`\-]{3,}(\s+[A-Z'‘’ʻʼ`\-]+)*$/.test(o)) throw new S.Xato('Otasining ismini pasportdagidek LOTIN harflarida yozing (masalan: O\'ROLOVICH).');
    const fish = T(r2[2]).toUpperCase().split(' ').slice(0, 2).join(' ') + ' ' + o; dd.fish = fish; f.push(['F.I.Sh.', T(r2[2]), fish]); }
  else if (maydon === 'tel') { const t = q.replace(/\D/g, '').replace(/^998/, ''); if (t.length !== 9) throw new S.Xato('Telefon 9 ta raqam bo\'lishi kerak (masalan: 99 123 45 67).');
    const fm = t.slice(0, 2) + ' ' + t.slice(2, 5) + ' ' + t.slice(5, 7) + ' ' + t.slice(7); if (T(r2[4])) { dd.tel2 = fm; f.push(['Qo\'shimcha tel', T(r2[5]), fm]); } else { dd.tel = fm; f.push(['Telefon', '', fm]); } }
  else throw new S.Xato('Noma\'lum maydon.');
  if (kutilmoqda) throw new S.Xato('Bu shartnoma bo\'yicha tahrir so\'rovi allaqachon direktorda — javobini kuting.');
  return { dd, f, sabab: f[0][0] + ' topildi — manba: ' + manba };
}
async function qadamMalumot(args) {
  const [kodSes, d] = args;
  const u = await S.ruxsat(kodSes, 'undiruv');
  if (!(await serverda(u.kod))) return eskiTizim('qadamMalumot', u, args.slice(1));
  const x = await portfeldagi(u, d.no);
  const M2 = await G.oraliqOqi(env.aksBazaId, '02_Mijozlar', 'A2:L', env.googleKey);
  const r2 = M2.find(r => s(r[0]) === x.mid); if (!r2) throw new S.Xato('Mijoz 02_Mijozlar da topilmadi: ' + x.mid);
  let w;
  try {
    w = await qulf('06i', async () => {
      const R = await sorovlar(SOR_V);
      const t = malumotTekshir(r2, d, x, R.L.some(z => z.tur === 'tahrir' && z.kalit === x.no && z.holati === 'Kutilmoqda'));
      const y = await sorovYoz(SOR_V, R, u.fish, x.no, t.sabab, JSON.stringify({ d: t.dd, f: t.f }));
      return Object.assign({ id: y.id }, t);
    });
  } catch (e) { if (e.yozilmadi) return eskiTizim('qadamMalumot', u, args.slice(1)); throw e; }
  tgFon(u.kod, '📨 <b>Direktorga so\'rov</b> — ' + u.fish + ': Shartnoma tahriri <b>' + x.no + '</b> · ' + qisqaIsm(x.fish) + '\n' + w.f.map(z => z[0] + ': ' + (z[1] ? z[1] + ' → ' : '') + '<b>' + z[2] + '</b>').join('\n') + '\n«' + w.sabab + '»\nJavob — ilovada 📌 Topshiriqlar yoki 👔 Direktor → Tasdiqlar.');
  await yangila([SOR_V]);
  const m = await Q.qadamMijoz([kodSes, d.no]); m.saqlandi = { ok: true, matn: w.f[0][0] + ' direktorga tasdiqqa yuborildi' }; return m;
}

// ------------------------------------------------------------------ 📅 qo'shimcha muddat so'rash
async function qadamMuhlatSora(args) {
  const [kodSes, d] = args;
  const u = await S.ruxsat(kodSes, 'undiruv');
  if (!(await serverda(u.kod))) return eskiTizim('qadamMuhlatSora', u, args.slice(1));
  const bugun = V.bugun();
  const no = s(d.no), sana = s(d.sana), summa = Number(s(d.summa).replace(/\D/g, ''));
  if (!/^\d{4}-\d{2}-\d{2}$/.test(sana) || sana < bugun) throw new S.Xato('Yangi sanani tanlang.');
  if (!(summa >= 100000)) throw new S.Xato('Summani yozing.');
  const sabab = s(d.sabab).replace(/\s+/g, ' ').trim(); if (sabab.length < 5) throw new S.Xato('Nega yana muddat kerakligini qisqa yozing.');
  const x = await portfeldagi(u, no);
  if ((await TP.topRowsYangi(TOP_V)).L.some(t => /^muhlat\|/.test(t.kalit) && t.kalit.split('|')[1] === no && (t.holati === 'Jarayonda' || t.holati === 'Tekshiruvda'))) throw new S.Xato('Bu mijoz bo\'yicha muddat so\'rovi allaqachon direktorda — javobini kuting.');
  const mz = (s(d.mazmun).trim() ? s(d.mazmun).trim() + '. ' : '') + 'Yangi muddat so\'radi: ' + dmy(sana) + ' gacha ' + qdPul(summa) + ' so\'m — direktor ruxsati so\'raldi';
  await UY.undYoz([kodSes, { no, chora: d.chora || 'Телефон', natija: 'Боғланилди', mazmun: mz, izoh: d.izoh || '', rasm: d.rasm, gps: d.gps, gpsAniq: d.gpsAniq, gpsX: d.gpsX, rasmYoq: d.rasmYoq }]);
  const XD = await TP.topXodimlar();
  const dir = (XD.find(z => z.admin) || {}).fish; if (!dir) throw new S.Xato('Direktor 07_Xodimlar da topilmadi.');
  const t = await qulf('topshiriq', async () => TP.topYoz(TOP_V, { manba: 'Xodim', qoida: 'muhlat', kalit: 'muhlat|' + no + '|' + sana + '|' + summa, sarlavha: 'Mijozga qo\'shimcha muddat berishga ruxsat so\'rayapti: ' + dmy(sana) + ' gacha ' + qdPul(summa) + ' so\'m',
    izoh: sabab + ' | undiruvchi: ' + u.fish, no, mid: x.mid, kimga: dir, kimBerdi: u.fish, muddat: dmy(bugun) + ' 18:00', muhim: 'Shoshilinch' }, await TP.topRowsYangi(TOP_V)));
  tgFon(u.kod, '📅 <b>' + esc(u.fish) + '</b> — <b>' + no + '</b> ' + esc(qisqaIsm(x.fish)) + ' ga qo\'shimcha muddat so\'rayapti: <b>' + dmy(sana) + '</b> gacha ' + qdPul(summa) + ' so\'m\n«' + esc(sabab) + '»\nJavob — ilovada 📌 Topshiriqlar (✓ Ruxsat / ✕ Rad).');
  await yangila([TOP_V]);
  return { ok: true, id: t.id, matn: 'Suhbat jurnalga yozildi, direktorga ruxsat so\'rovi yuborildi. Ruxsat berilsa, va\'da o\'zi yoziladi.' };
}

// ------------------------------------------------------------------ ✈ xat Telegramda yuborildi
function qdXatNom(h) { return /^QM_/.test(s(h.shablon)) ? (['', 'Maydon farqi bildirishnomasi', 'Maydon farqi ogohlantirish xati', 'Maydon farqi talabnomasi'][h.bosqich] || 'Maydon farqi xati')
  : (['', '1-ogohlantirish xati', '2-ogohlantirish xati', 'Talabnoma'][h.bosqich] || 'Ogohlantirish xati'); }
async function qadamTgYubordim(args) {
  const [kodSes, d0] = args; const d = d0 || {};
  const u = await S.ruxsat(kodSes, 'undiruv');
  if (!(await serverda(u.kod))) return eskiTizim('qadamTgYubordim', u, args.slice(1));
  const raqam = s(d.raqam).trim();
  const X = await G.oraliqOqi(env.aksBazaId, XAT_V, 'A2:N', env.googleKey);   // xatJurnal_ — Google'dan yangi
  const r = X.find(z => s(z[0]) === raqam && raqam !== '');
  if (!r) throw new S.Xato('Xat topilmadi: ' + raqam);
  const h = { raqam, no: s(r[2]), shablon: s(r[6]), bosqich: Number(r[7]) || 0, holati: s(r[13]) };
  if (h.holati !== 'Yuborildi') throw new S.Xato('Bu xat hali «yetkazildi» deb belgilanmagan — avval isbotni yuklang.');
  const t = s(d.tel).replace(/\D/g, '').slice(-9);
  if (t.length !== 9) throw new S.Xato('Qarzdorning telefon raqami noto\'g\'ri.');
  const bugun = V.bugun();
  if ((await J.undJurnal()).some(j => j.no === h.no && j.sana === bugun && j.chora === 'СМС/Телеграм' && /^Telegramda yuborildi/.test(j.mazmun) && j.mazmun.indexOf(raqam) >= 0))
    throw new S.Xato('Bu xat bugun Telegramda yuborilgan deb allaqachon yozilgan.');
  const tf = '+998 ' + t.slice(0, 2) + ' ' + t.slice(2, 5) + ' ' + t.slice(5, 7) + ' ' + t.slice(7);
  const w = await UY.undYoz([kodSes, { no: h.no, chora: 'СМС/Телеграм', natija: 'Боғланиб бўлмади',
    mazmun: 'Telegramda yuborildi: ' + qdXatNom(h) + ' ' + raqam + ' (imzolangan nusxa + pochta kvitansiyasi, PDF) → ' + tf, izoh: '✈ Telegram · xat isboti' }]);
  return { ok: true, no: h.no, id: w.id };
}

module.exports = { qadamOtkaz, qadamDirektorga, qadamMalumot, qadamMuhlatSora, qadamTgYubordim };
module.exports._ichki = { qdYoz, sorovlar, sorovYoz, malumotTekshir, otkazTgMatn, qdXatNom, QDV, SOR_V };
