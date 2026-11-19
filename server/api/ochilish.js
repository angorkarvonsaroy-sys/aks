// AKS TIZIM — 🏪 OCHILISH NAZORATI amallari (20.11.2026, direktor qarori). Qoida va varaq — lib/ochilish.js, xabarnoma — lib/ochilish_hujjat.js.
//   ochHolat(kod, no)   — 📎 Hujjatlar kartasidagi blok: nazorat qatori, faza (qaysi kunda nima), ijarachi telefoni, tayyor SMS matnlari, huquq
//   ochAmal(kod, d)     — undiruvchi (yoki direktor) amali: sms1 · tekshir (Ochilgan/Ochilmagan) · sms2 · qongiroq · ochildi · xabarnoma · pochta · bekor · otkaz · yop
//   ochFayl(kod, id)    — xabarnoma PDF (serverdagi nusxa)
//   ochRoyxat(kod)      — barcha nazoratlar (direktor — hammasi, undiruvchi — o'ziniki)
// Yozuv — to'g'ridan-to'g'ri Google (robot), eski tizimda bu modul yo'q. Bayroq: yozuv_yondi:ochilish (standart holat lib/bayroq.js da).
'use strict';
const fs = require('fs');
const path = require('path');
const BQ = require('../lib/bayroq');
const S = require('./sessiya');
const V = require('../lib/varaq');
const G = require('../lib/google');
const env = require('../lib/env');
const tetik = require('../lib/kozgu_tetik');
const O = require('../lib/ochilish');
const OH = require('../lib/ochilish_hujjat');
const KBH = require('../lib/kb_hujjat');
const XP = require('../lib/xat_pdf');
const { xodimTeng } = require('../lib/xodim');

const s = v => String(v == null ? '' : v);
const T = v => s(v).trim();
const ILDIZ = env.hujjatPapka || '/opt/aks/hujjat';
const kut = (p, ms) => Promise.race([p, new Promise(r => setTimeout(r, ms))]);
const yangila = nomlar => kut(tetik.varaqlarYangila(nomlar).catch(e => console.error('ko\'zgu (ochilish):', e.message)), 15000);
async function serverda() { try { return await BQ.yozuv('ochilish'); } catch (e) { return false; } }
const xato = m => new S.Xato(m);

// 04b qatori + shartnoma (kbTekshir — tekshirmasdan: faqat ma'lumot)
async function qatorVaSh(no, yangi) {
  no = T(no);
  const L = yangi ? await O.ochYangi() : await O.ochKozgu();
  const z = L.filter(q => q.no === no).sort((a, b) => Number(b.id) - Number(a.id))[0] || null;
  let x = null;
  try { x = await KBH.kbTekshir(no, '', [], { tekshirma: true }); } catch (e) { x = null; }
  if (x) {   // ijaraga beruvchi (04 G) va 01 do'kon ma'lumotlari — xabarnoma matni uchun
    const r4 = (await V.qatorlar('04_Ijara_shartnomalar')).map(q => q.x).find(q => T(q[0]) === no);
    x.beruvchi = r4 ? T(r4[6]) : 'MChJ'; x.holati = r4 ? T(r4[2]) : '';
    const d = (await V.qatorlar('01_Dokonlar')).map(q => q.x).find(q => T(q[0]) === T(x.dokon));
    x.dk = d ? { blok: s(d[2]), qavat: s(d[3]), nomer: s(d[4]), egasi: T(d[18]) } : null;
    x.fishK = require('../lib/ism').xatKirill(x.fish);
  }
  return { z, x, L };
}
const ruxsatmi = (u, z) => !!(u.admin || (z && xodimTeng(z.undiruvchi, u.fish)));

// ------------------------------------------------------------------ ochHolat(kod, no)
async function ochHolat(args) {
  const [kodSes, no0] = args;
  const u = await S.ruxsat(kodSes);
  const no = T(no0);
  if (!/^IJ-27\/\d+$/.test(no)) return { bor: false };
  const bugun = V.bugun(), bosh = await O.ochBosh();
  const { z, x } = await qatorVaSh(no);
  const r4 = (await V.qatorlar('04_Ijara_shartnomalar')).map(q => q.x).find(q => T(q[0]) === no);
  const shSana = r4 ? O.isoDan(r4[1]) : '';
  const yangi = O.yangiMatn(shSana, bosh);
  if (!z) return { bor: false, yangiMatn: yangi, ochBosh: bosh, biriktirBosh: O.OCH_BIRIKTIR_BOSH, eski: !!(shSana && shSana < O.OCH_BIRIKTIR_BOSH), admin: !!u.admin };
  const f = O.faza(z, bugun);
  const m = await O.mijozTel(x ? x.mid : '');
  const ij = await require('./xat_chiqar')._ichki.ijrochi(z.undiruvchi || u.fish);
  const out = { bor: true, z, faza: f.faza, kun: f.kun, bugun, yangiMatn: z.matn === 'Yangi', ochBosh: bosh, ruxsat: ruxsatmi(u, z), admin: !!u.admin,
    mijoz: { ism: O.ism(z.fish || m.fish), tel1: m.tel1, tel2: m.tel2 },
    sms: { eslatma: O.smsMatn('eslatma', z, ij.tel), ochilmagan: O.smsMatn('ochilmagan', z, ij.tel) },
    kunlar: { och: O.OCH_KUN, eslatma: O.OCH_ESLATMA_KUN, xat: O.OCH_XAT_KUN, pochta: O.OCH_POCHTA_KUN },
    undiruvchilar: u.admin ? await O.undiruvchilar() : [], beruvchi: x ? x.beruvchi : '' };
  return out;
}

// ------------------------------------------------------------------ ochAmal(kod, d)
async function ochAmal(args) {
  const [kodSes, d0] = args; const d = d0 || {};
  const u = await S.ruxsat(kodSes);
  if (u.sifat) throw xato('👁 Ko\'rish rejimida bajarilmaydi.');
  const no = T(d.no), amal = T(d.amal);
  if (!/^IJ-27\/\d+$/.test(no)) throw xato('Shartnoma raqami noto\'g\'ri.');
  if (!(await serverda())) throw xato('Ochilish nazorati yozuvi hozir o\'chiq — direktorga ayting.');
  const { z, x } = await qatorVaSh(no, true);
  if (!z) throw xato(no + ' ochilish nazoratida yo\'q.');
  if (!ruxsatmi(u, z)) throw xato('Bu nazorat ' + (z.undiruvchi || 'biriktirilmagan') + ' da — faqat u yoki direktor amal qiladi.');
  if (amal !== 'otkaz' && amal !== 'yop' && O.OCH_YOPIQ.indexOf(z.holati) >= 0) throw xato('Nazorat yopilgan (' + z.holati + ').');
  const bugun = V.bugun(), h = O.hozir(), f = O.faza(z, bugun);
  const kim = u.fish;
  let natija = '', ogoh = [];
  if (amal === 'sms1') {
    if (z.eslatma) throw xato('Eslatma SMS allaqachon yozilgan: ' + z.eslatma);
    await O.tarixQosh(z, kim + ': ijarachiga SMS eslatma yuborildi', { Eslatma_SMS: h.dmyHm + ' · ' + kim });
    natija = 'SMS eslatma qayd etildi.';
  } else if (amal === 'tekshir') {
    const nat = T(d.natija);
    if (nat !== 'Ochilgan' && nat !== 'Ochilmagan') throw xato('Natijani tanlang: Ochilgan yoki Ochilmagan.');
    if (z.natija) throw xato('Tekshiruv natijasi allaqachon yozilgan: ' + z.natija + ' (' + z.tekVaqt + ').');
    if (f.kun < O.OCH_KUN && !u.admin && nat === 'Ochilmagan') throw xato('«Ochilmagan» belgisi ' + O.OCH_KUN + '-kundan (' + O.dmy(z.muddat) + ') boshlab qo\'yiladi — ijarachida hali muddat bor.');
    const q = { Tekshiruv_vaqt: h.dmyHm + ' · ' + kim, Tekshiruv_natija: nat };
    if (nat === 'Ochilgan') { q.Holati = 'Ochildi'; }
    await O.tarixQosh(z, kim + ': tekshiruv — ' + nat + (T(d.izoh) ? ' (' + T(d.izoh) + ')' : ''), q);
    natija = nat === 'Ochilgan' ? 'Do\'kon ochilgan — nazorat yopildi, shartnoma odatdagidek davom etadi.'
      : (z.matn === 'Yangi' ? 'Ochilmagan deb belgilandi. Endi SMS yuboring va qo\'ng\'iroq qiling; ' + O.OCH_XAT_KUN + '-kundan (' + O.dmy(O.kunQosh(z.bosh, O.OCH_XAT_KUN)) + ') xabarnoma chiqariladi.'
        : 'Ochilmagan deb belgilandi. Bu shartnoma eski matnda — bekor qilish 🚫 «Ijarachi kelmadi» yo\'li bilan (direktor tasdig\'i).');
  } else if (amal === 'sms2') {
    if (z.natija !== 'Ochilmagan') throw xato('Avval tekshiruv natijasini qo\'ying.');
    if (z.sms2) throw xato('SMS allaqachon yozilgan: ' + z.sms2);
    await O.tarixQosh(z, kim + ': ijarachiga SMS (ochilmagan) yuborildi', { SMS2: h.dmyHm + ' · ' + kim });
    natija = 'SMS qayd etildi.';
  } else if (amal === 'qongiroq') {
    if (z.natija !== 'Ochilmagan') throw xato('Avval tekshiruv natijasini qo\'ying.');
    const nat = T(d.natija).replace(/\s+/g, ' ').slice(0, 200);
    if (nat.length < 3) throw xato('Qo\'ng\'iroq natijasini yozing (masalan: javob bermadi; yoki: ertaga kelaman dedi).');
    await O.tarixQosh(z, kim + ': qo\'ng\'iroq — ' + nat, { Qongiroq: h.dmyHm + ' · ' + nat + ' · ' + kim });
    natija = 'Qo\'ng\'iroq qayd etildi.';
  } else if (amal === 'ochildi') {   // keyinchalik ochildi (xabarnomadan oldin yoki keyin) — nazorat yopiladi
    const iz = T(d.izoh).slice(0, 200);
    if (iz.length < 3) throw xato('Qachon va qanday ochilganini yozing.');
    if (z.sorov) throw xato('Bekor qilish so\'rovi direktorda — avval u javob bersin (yoki so\'rovni 🤝 blokida bekor qiling).');
    await O.tarixQosh(z, kim + ': do\'kon ochildi — ' + iz + (z.xabNo ? ' (xabarnoma ' + z.xabNo + ' qaytarib olindi)' : ''), { Holati: 'Ochildi', Izoh: (z.izoh ? z.izoh + ' | ' : '') + 'Ochildi: ' + iz });
    natija = 'Nazorat yopildi — do\'kon ochildi.' + (z.xabNo ? ' Xabarnoma qaytarib olingan hisoblanadi; ijarachiga buni aytib qo\'ying.' : '');
  } else if (amal === 'xabarnoma') {
    if (z.matn !== 'Yangi') throw xato('Bu shartnoma eski matnda (3.2.4 — 5 kun bandi yo\'q) — xabarnoma yo\'li unga ishlamaydi. 🚫 «Ijarachi kelmadi» yo\'lidan foydalaning.');
    if (z.natija !== 'Ochilmagan') throw xato('Avval ' + O.OCH_KUN + '-kun tekshiruvida «Ochilmagan» belgisini qo\'ying.');
    if (f.kun < O.OCH_XAT_KUN && !u.admin) throw xato('Xabarnoma ' + O.OCH_XAT_KUN + '-kundan (' + O.dmy(O.kunQosh(z.bosh, O.OCH_XAT_KUN)) + ') chiqariladi.');
    if (z.xabNo) throw xato('Xabarnoma allaqachon chiqarilgan: ' + z.xabNo + ' (' + O.dmy(z.xabSana) + ').');
    if (!x) throw xato('Shartnoma ma\'lumoti o\'qilmadi: ' + no);
    if (x.holati !== 'Aktiv') throw xato(no + ' holati «' + x.holati + '» — faqat Aktiv shartnomaga xabarnoma chiqariladi.');
    if (!(await require('../lib/pdf').bor())) throw xato('PDF yasash hozir ishlamayapti — direktorga ayting.');
    const yil = bugun.slice(0, 4);
    const L = await O.ochYangi();
    const t = L.filter(q => q.xabNo.indexOf('OX-' + yil + '/') === 0).reduce((m, q) => Math.max(m, Number(q.xabNo.split('/')[1]) || 0), 0) + 1;
    const raqam = 'OX-' + yil + '/' + ('000' + t).slice(-4);
    const bekorIso = O.kunQosh(bugun, O.OCH_HUJJAT_KUN);
    const ij = await require('./xat_chiqar')._ichki.ijrochi(z.undiruvchi || kim);
    const p = await OH.xabarnomaYasa(x, z, raqam, bugun, bekorIso, ij);
    const fam = (T(x.fish).split(/\s+/)[0] || 'Ijarachi').replace(/[\\/:*?<>|"]/g, '');
    const nom = 'Xabarnoma_ochilmagan_' + no.replace(/\//g, '-') + '_' + fam + '_' + raqam.replace('/', '-') + '.pdf';
    const rel = 'ochilish/' + yil + '/' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5) + '/' + nom;
    const yol = path.join(ILDIZ, rel); fs.mkdirSync(path.dirname(yol), { recursive: true }); fs.writeFileSync(yol, p.pdf);
    await O.tarixQosh(z, kim + ': xabarnoma chiqarildi ' + raqam + ' (bekor sanasi ' + O.dmy(bekorIso) + ')',
      { 'Xabarnoma_№': raqam, Xabarnoma_sana: O.dmy(bugun), Xabarnoma_PDF: 'SRV:' + rel, Hujjatdagi_bekor_sana: O.dmy(bekorIso), Holati: 'Xabarnoma' });
    // 06d — chiquvchi xat sifatida (tizim chiqargan nusxa); yozilmasa — faqat serverda qoladi
    try {
      const HY = require('./hujjat_yoz')._ichki;
      await HY.yuklaYadro({ fish: kim, admin: !!u.admin, kod: u.kod }, { no, turi: 'XAT_CHIQUVCHI', sana: bugun, sahifa: p.bet, b64: p.pdf.toString('base64'),
        izoh: raqam + ' · Дўкон очилмагани учун ижара шартномасини бир томонлама бекор қилиш тўғрисида хабарнома (тизим чиқарган нусха, имзосиз). Бекор санаси ' + O.dmy(bekorIso) },
        { no, tur: 'ijara', fish: x.fish, dokon: x.dokon });
    } catch (e) { ogoh.push('Xabarnoma «📎 Hujjatlar»ga yozilmadi (' + e.message + ') — fayl serverda turibdi, PDF tugmasi ishlaydi.'); }
    ogoh = ogoh.concat(XP.ismOgoh(x.fish));
    if (p.bet > 1) ogoh.push('Xabarnoma ' + p.bet + ' betga chiqdi — ikkala betni chop eting.');
    natija = 'Xabarnoma ' + raqam + ' tayyor. Chop eting → direktor imzolaydi → BUYURTMA XAT (почта хабарномаси билан) bilan ijarachining shartnomadagi manziliga yuboring → kvitansiya va imzolangan nusxa skanini shu yerga yuklang. Bekor sanasi hujjatda: ' + O.dmy(bekorIso) + '.';
    return { ok: true, natija, ogoh, raqam, pdfB64: p.pdf.toString('base64'), nom, bet: p.bet };
  } else if (amal === 'pochta') {
    if (!z.xabNo) throw xato('Avval xabarnoma chiqariladi.');
    if (z.pochtaSana) throw xato('Pochta kvitansiyasi allaqachon yuklangan (' + O.dmy(z.pochtaSana) + ', ' + z.pochtaNo + ').');
    const sana = T(d.sana); if (!/^\d{4}-\d{2}-\d{2}$/.test(sana)) throw xato('Pochtaga topshirilgan sanani tanlang.');
    if (sana > bugun) throw xato('Sana kelajakda bo\'lishi mumkin emas.');
    if (sana < z.xabSana) throw xato('Pochta sanasi xabarnoma sanasidan (' + O.dmy(z.xabSana) + ') oldin bo\'lolmaydi.');
    const trek = T(d.trek).replace(/\s+/g, '').toUpperCase();
    if (trek.length < 5) throw xato('Pochta jo\'natma raqamini yozing (masalan RB191625837UZ) — bekor qilish sanasi shu kundan hisoblanadi, sudda isbot shu.');
    if (!x) throw xato('Shartnoma ma\'lumoti o\'qilmadi: ' + no);
    const HY = require('./hujjat_yoz')._ichki;
    const r = await HY.yuklaYadro(u, { no, turi: 'BEKOR_XABARNOMA', sana, b64: d.b64, sahifa: d.sahifa,
      izoh: z.xabNo + ' · Очилмаганлик учун бир томонлама бекор қилиш хабарномаси · почта ' + trek + ' (имзоланган нусха + квитанция)' }, { no, tur: 'ijara', fish: x.fish, dokon: x.dokon });
    const bm = O.kunQosh(sana, O.OCH_POCHTA_KUN) > z.hujBekor ? O.kunQosh(sana, O.OCH_POCHTA_KUN) : z.hujBekor;
    await O.tarixQosh(z, kim + ': xabarnoma pochtaga topshirildi ' + O.dmy(sana) + ' (' + trek + '), skan ' + r.nom + '; bekor qilish mumkin: ' + O.dmy(bm),
      { Pochta_sana: O.dmy(sana), 'Pochta_№': trek, Kvitansiya_skan: r.nom, Bekor_mumkin_sana: O.dmy(bm) });
    if (bm > z.hujBekor) ogoh.push('Xat ' + O.dmy(sana) + ' da topshirilgan — 6.3-band bo\'yicha bekor sanasi hujjatdagidan keyinroq: ' + O.dmy(bm) + '.');
    natija = 'Kvitansiya yuklandi. «✂ Bekor qilish» tugmasi ' + O.dmy(bm) + ' dan chiqadi (xat pochtaga topshirilgan kundan ' + O.OCH_POCHTA_KUN + ' kun).';
  } else if (amal === 'bekor') {
    if (z.matn !== 'Yangi') throw xato('Eski matndagi shartnoma — 🚫 «Ijarachi kelmadi» yo\'lidan foydalaning.');
    if (!z.pochtaSana) throw xato('Avval xabarnoma pochta kvitansiyasini yuklang.');
    if (z.sorov) throw xato('So\'rov allaqachon direktorda (KB-' + z.sorov + ').');
    if (z.bekorMumkin > bugun && !u.admin) throw xato('Bekor qilish ' + O.dmy(z.bekorMumkin) + ' dan mumkin (xat pochtaga topshirilgan kundan ' + O.OCH_POCHTA_KUN + ' kun).');
    const KBY = require('./kb_yoz')._ichki;
    const r = await KBY.kbOchilmagan(u, z, f.kun);
    await O.tarixQosh(z, kim + ': bekor qilish so\'rovi direktorga yuborildi (KB-' + r.id + ')', { Bekor_sorov: String(r.id), Holati: 'Bekor so\'raldi' });
    natija = r.natija; ogoh = ogoh.concat(r.ogoh || []);
  } else if (amal === 'otkaz') {
    if (!u.admin) throw xato('Undiruvchini faqat direktor o\'zgartiradi.');
    const kimga = T(d.kimga); const pool = await O.undiruvchilar();
    if (!pool.some(p => xodimTeng(p, kimga))) throw xato('Undiruvchi topilmadi: ' + kimga + ' (undiruv huquqli, ishlayotgan xodim bo\'lishi kerak).');
    await O.tarixQosh(z, kim + ': undiruvchi o\'zgartirildi — ' + (z.undiruvchi || '—') + ' → ' + kimga, { Undiruvchi: kimga });
    natija = 'Undiruvchi: ' + kimga + '. Ochiq topshiriqlar keyingi yurishda unga o\'tadi.';
  } else if (amal === 'yop') {
    if (!u.admin) throw xato('Nazoratni faqat direktor yopadi.');
    const iz = T(d.izoh).slice(0, 200); if (iz.length < 3) throw xato('Sababini yozing.');
    await O.tarixQosh(z, kim + ': nazorat yopildi — ' + iz, { Holati: 'Yopildi', Izoh: (z.izoh ? z.izoh + ' | ' : '') + 'Yopildi: ' + iz });
    natija = 'Nazorat yopildi.';
  } else throw xato('Amal noto\'g\'ri: ' + amal);
  await yangila([O.OCH_VARAQ]);
  return { ok: true, natija, ogoh };
}

// ------------------------------------------------------------------ ochFayl(kod, id) — xabarnoma PDF
async function ochFayl(args) {
  const [kodSes, id] = args;
  const u = await S.foydalanuvchi(kodSes); if (!u) throw xato('Sessiya tugagan — parolingizni qayta kiriting.');
  const z = (await O.ochKozgu()).find(q => String(q.id) === String(id));
  if (!z || !z.xabPdf) throw xato('Fayl topilmadi.');
  const f = await require('./xat_chiqar')._ichki.pdfOl(z.xabPdf);
  if (!f) throw xato('Fayl serverda topilmadi — qayta chiqaring.');
  return { b64: f.bytes.toString('base64'), nom: f.nom, mime: 'application/pdf' };
}

// ------------------------------------------------------------------ ochRoyxat(kod) — nazoratlar ro'yxati
async function ochRoyxat(args) {
  const [kodSes] = args;
  const u = await S.ruxsat(kodSes);
  const bugun = V.bugun();
  const L = (await O.ochKozgu()).filter(z => u.admin || xodimTeng(z.undiruvchi, u.fish));
  return { ok: true, bugun, ochBosh: await O.ochBosh(), royxat: L.map(z => Object.assign({ faza: O.faza(z, bugun).faza, kun: O.faza(z, bugun).kun }, z)).sort((a, b) => Number(b.id) - Number(a.id)) };
}

// ijaraSaqlash dan keyin — fon (xato bo'lsa top_avto yurishi to'ldiradi)
function biriktirFon(no, kim) {
  (async () => { try { if (!(await serverda())) return; const y = await O.biriktir(no, kim); if (y.length) await yangila([O.OCH_VARAQ]); } catch (e) { console.error('ochilish biriktir (fon):', e.message); } })();
}

module.exports = { ochHolat, ochAmal, ochFayl, ochRoyxat };
module.exports._ichki = { biriktirFon, serverda, qatorVaSh, ruxsatmi };
