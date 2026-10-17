// AKS TIZIM — 👤 Mijozlar: qidiruv (Mijoz.gs v2.2 dagi mijozQidir ning serverdagi o'rni).
// Manba: ko'zgudagi 02_Mijozlar, 03_Sotuv_shartnomalar, 04_Ijara_shartnomalar. Natija eski tizim bilan BIR XIL shaklda.
'use strict';
const S = require('./sessiya');
const V = require('../lib/varaq');
const J = require('../lib/jurnallar');

const MJ_HUQUQ = ['shartnoma', 'undiruv', 'hujjat', 'tolov', 'xat', 'yurist'];

async function mjRuxsat(kodSes) {
  const u = await S.ruxsat(kodSes);
  if (!u.admin && !MJ_HUQUQ.some(h => u.huquq.includes(h))) throw new S.Xato('Mijozlar bo\'limiga ruxsatingiz yo\'q.');
  return u;
}

// qidiruv uchun: kirill → lotin, harf farqlari tenglashtiriladi (Mijoz.gs mjLat_ bilan bir xil)
const K = { 'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'ё': 'yo', 'ж': 'j', 'з': 'z', 'и': 'i', 'й': 'y', 'к': 'k', 'л': 'l', 'м': 'm', 'н': 'n', 'о': 'o', 'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u', 'ф': 'f', 'х': 'x', 'ц': 'ts', 'ч': 'ch', 'ш': 'sh', 'щ': 'sh', 'ъ': '', 'ы': 'i', 'ь': '', 'э': 'e', 'ю': 'yu', 'я': 'ya', 'ў': 'o', 'қ': 'k', 'ғ': 'g', 'ҳ': 'x' };
function lat(s) {
  return String(s || '').toLowerCase().replace(/[ʻʼ'`’‘]/g, '').split('').map(c => K[c] !== undefined ? K[c] : c).join('')
    .replace(/kh/g, 'x').replace(/(^|[^sc])h/g, '$1x').replace(/q/g, 'k').replace(/\s+/g, ' ').trim();
}

// mid → [{no, tur, dokon, holati}]
async function shartnomalar() {
  const SH = {};
  (await V.qatorlar('03_Sotuv_shartnomalar')).forEach(({ r }) => {
    if (!r[0]) return; const mid = String(r[4] || '').trim();
    (SH[mid] = SH[mid] || []).push({ no: String(r[0]).trim(), tur: 'sotuv', dokon: String(r[5] || ''), holati: String(r[13] || '') });
  });
  (await V.qatorlar('04_Ijara_shartnomalar')).forEach(({ r }) => {
    if (!r[0]) return; const mid = String(r[5] || '').trim();
    (SH[mid] = SH[mid] || []).push({ no: String(r[0]).trim(), tur: 'ijara', dokon: String(r[4] || ''), holati: String(r[2] || '') });
  });
  return SH;
}

async function mijozQidir([kodSes, q]) {
  await mjRuxsat(kodSes);
  q = String(q || '').trim(); if (q.length < 2) return { royxat: [] };
  const ql = lat(q), qd = q.replace(/\D/g, ''), qu = q.toUpperCase().replace(/\s/g, '');
  const SH = await shartnomalar();
  const R = [];
  (await V.qatorlar('02_Mijozlar')).forEach(({ r }) => {
    if (!r[0]) return;
    const id = String(r[0]).trim(), fish = String(r[2] || ''), tel = String(r[4] || '').replace(/\D/g, ''), tel2 = String(r[5] || '').replace(/\D/g, ''), pas = String(r[6] || '').toUpperCase().replace(/\s/g, '');
    const sh = SH[id] || [];
    const mos = lat(fish).indexOf(ql) >= 0 || (qd.length >= 4 && (tel.indexOf(qd) >= 0 || tel2.indexOf(qd) >= 0)) || (qu.length >= 4 && pas.indexOf(qu) >= 0) || id === q
      || sh.some(s => s.no.toUpperCase().indexOf(qu) >= 0 && qu.length >= 3) || sh.some(s => s.dokon.toUpperCase() === qu);
    if (mos) R.push({ id, fish, tel: r[4] || '', pasport: r[6] || '', shartnomalar: sh.map(s => s.no + (s.holati && /bekor|yakun/i.test(s.holati) ? ' (' + s.holati + ')' : '')), dokonlar: sh.map(s => s.dokon).filter(Boolean) });
  });
  return { royxat: R.slice(0, 25), jami: R.length };
}

// ------------------------------------------------------------------ karta (Mijoz.gs mijozKarta v2.2 bilan bir xil)
async function mijozKarta([kodSes, mid]) {
  const u = await mjRuxsat(kodSes);
  mid = String(mid || '').trim(); if (!mid) throw new S.Xato('Mijoz ID yo\'q.');
  const M2 = await V.qatorlar('02_Mijozlar');
  const row = M2.find(({ r }) => String(r[0] || '').trim() === mid);
  if (!row) throw new S.Xato('Mijoz topilmadi: ' + mid);
  const r = row.r;
  const mijoz = { id: mid, turi: r[1] || '', fish: r[2] || '', tel: r[4] || '', tel2: r[5] || '', pasport: r[6] || '', iib: [r[7], r[8]].filter(Boolean).join(', '), pSana: r[9] || '', pMuddat: r[10] || '', jshshir: r[11] || '',
    manzil: [r[13], r[14], r[15], r[16], r[17] ? r[17] + '-uy' : '', r[18] ? r[18] + '-xonadon' : ''].filter(Boolean).join(', '), izoh: r[23] || '' };
  const num = V.son;
  // shartnomalar
  const SH = [], NO = {};
  (await V.qatorlar('03_Sotuv_shartnomalar')).forEach(({ r: x }) => { if (!x[0] || String(x[4] || '').trim() !== mid) return; NO[String(x[0]).trim()] = 1;
    SH.push({ no: String(x[0]).trim(), tur: 'sotuv', sana: x[2] || '', dokon: x[5] || '', maydon: x[6] || '', holati: x[13] || '', qiymat: num(x[25]), oylik: num(x[26]), tolangan: num(x[27]), asosiy: num(x[28]), qoshimcha: num(x[29]), jami: num(x[30]), muddati: num(x[31]), kechikkan: num(x[32]), undiruvchi: x[17] || '', bekorSana: x[14] || '' }); });
  (await V.qatorlar('04_Ijara_shartnomalar')).forEach(({ r: x }) => { if (!x[0] || String(x[5] || '').trim() !== mid) return; NO[String(x[0]).trim()] = 1;
    SH.push({ no: String(x[0]).trim(), tur: 'ijara', sana: x[1] || '', dokon: x[4] || '', maydon: x[13] || '', holati: x[2] || '', bosh: x[9] || '', tugash: x[10] || '', muddat: x[11] || '', bepul: x[12] || '', oylik: num(x[14]), faoliyat: x[18] || '', masul: x[20] || '', bepulTugash: x[28] || '', bekorSana: x[3] || '' }); });
  // 03b: keyingi to'lov sanasi va jadval tugashi
  const bugunIso = V.bugun(); const JD = {};
  (await V.qatorlar('03b_Tolov_jadvali')).forEach(({ x }) => { const no = String(x[1] == null ? '' : x[1]).trim(); if (!NO[no]) return; const d = V.iso(x[3]); if (!d) return; (JD[no] = JD[no] || []).push(d); });
  SH.forEach(s => { const L = (JD[s.no] || []).sort(); if (!L.length) return; s.tugash = L[L.length - 1].split('-').reverse().join('.'); const k = L.find(d => d >= bugunIso); s.keyingi = k ? k.split('-').reverse().join('.') : 'jadval tugagan'; });
  // do'konlar (01_Dokonlar)
  const DK = []; const DKN = {}; SH.forEach(s => { if (s.dokon && !/bekor/i.test(s.holati)) DKN[String(s.dokon).trim()] = s; });
  if (Object.keys(DKN).length) (await V.qatorlar('01_Dokonlar')).forEach(({ r }) => { const id = String(r[0] || '').trim(); const s = DKN[id]; if (!s) return;
    const real = num(r[5]), sh = num(s.maydon);
    DK.push({ id, blok: r[2] || '', qavat: r[3] || '', raqam: r[4] || '', real, shartnoma: sh, farq: real && sh ? Math.round((real - sh) * 100) / 100 : 0, qurilish: r[7] || '', taqiq: r[8] || '', rais: r[11] || '',
      zona: r[16] || '', no: s.no, tur: s.tur, egasi: r[18] || '', ijaraNo: r[21] || '', ijarachi: r[22] || '', faoliyat: r[23] || '', savdo: r[24] || '', xarita: r[25] || '', hujjat: r[26] || '', narx: num(r[6]) }); });
  // to'lovlar
  const T = [];
  (await V.qatorlar('05_Tolovlar')).forEach(({ r: x }) => { if (!x[0]) return; if (NO[String(x[2] || '').trim()] || String(x[12] || '').trim() === mid) T.push({ sana: x[1] || '', no: x[2] || '', summa: num(x[3]), shakl: x[4] || '', hujjat: x[5] || '', kim: x[9] || '', izoh: x[11] || '' }); });
  T.reverse();
  // xatlar, hujjatlar, undiruv, yurist
  const X = (await J.xatJurnal()).filter(h => NO[h.no]).map(h => ({ raqam: h.raqam, no: h.no, sana: h.sana, shablon: h.shablon, bosqich: h.bosqich, holati: h.holati, yetSana: h.yetSana, kim: h.kim })).reverse();
  const H = (await J.hujjatJurnal()).filter(h => NO[h.no]).map(h => ({ no: h.no, turi: h.turi, sana: h.sana, nom: h.nom, kim: h.kim, vaqt: h.vaqt, holati: h.holati, faylId: h.faylId })).reverse();
  const U = (await J.undJurnal()).filter(j => NO[j.no]).map(j => ({ sana: j.sana ? String(j.sana).split('-').reverse().join('.') : '', no: j.no, chora: j.chora, mazmun: j.mazmun, vada: j.vadaSana ? String(j.vadaSana).split('-').reverse().join('.') : '', vadaSumma: j.vadaSumma, natija: j.vadaNatija || j.natija, kim: j.kim })).reverse();
  const Y = (await J.yuIshlar()).filter(i => NO[i.no]).map(i => ({ no: i.no, holati: i.holati, yurist: i.yurist, topshirilgan: i.topshirilgan, davoNo: i.davoNo, qaror: i.qaror }));
  // tashriflar (telefon bo'yicha)
  const tel = String(mijoz.tel || '').replace(/\D/g, '').slice(-9); const TS = [];
  if (tel.length === 9) { (await V.qatorlar('01b_Tashrif_jurnali')).forEach(({ r: x }) => { if (x[0] && String(x[3] || '').replace(/\D/g, '').slice(-9) === tel) TS.push({ sana: x[1] || '', maqsad: String(x[6] || '').replace(' масаласида', ''), izoh: x[7] || '', kim: x[8] || '' }); }); TS.reverse(); }
  const faol = SH.filter(s => !/bekor|yakun/i.test(s.holati));
  // hujjatlar nazorati
  const bor = {}; H.forEach(h => { if (h.holati === 'Faol') bor[h.no + '|' + h.turi] = h; });
  const pasBor = H.find(h => h.holati === 'Faol' && h.turi === 'PASPORT');
  const pIso = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(String(mijoz.pMuddat || '')); const pQ = pIso ? Math.round((new Date(pIso[3] + '-' + pIso[2] + '-' + pIso[1] + 'T12:00:00Z') - new Date(bugunIso + 'T12:00:00Z')) / 86400000) : null;
  const nazorat = faol.map(s => ({ no: s.no, tur: s.tur, sana: s.sana, royxat: [
    { turi: 'SHARTNOMA', nom: 'Shartnoma skani (imzolangan)', bor: bor[s.no + '|SHARTNOMA'] || null },
    { turi: 'PASPORT', nom: 'Pasport nusxasi', bor: bor[s.no + '|PASPORT'] || pasBor || null },
    { turi: 'DALOLATNOMA', nom: 'Qabul-topshirish dalolatnomasi', bor: bor[s.no + '|DALOLATNOMA'] || null }] }));
  // topshiriqlar
  const TP = (await J.topRows()).filter(t => NO[t.no] || t.mid === mid).map(J.topKor).reverse();
  return { ok: true, mijoz, shartnomalar: SH, dokonlar: DK, nazorat, pasportQolgan: pQ, topshiriqlar: TP.slice(0, 40), tolovlar: T.slice(0, 60), xatlar: X, hujjatlar: H, chora: U.slice(0, 60), yurist: Y, tashriflar: TS.slice(0, 40),
    jami: { shartnoma: SH.length, faol: faol.length, qiymat: faol.reduce((a, s) => a + (s.qiymat || 0), 0), qarz: faol.reduce((a, s) => a + (s.jami || 0), 0), asosiy: faol.reduce((a, s) => a + (s.asosiy || 0), 0), qoshimcha: faol.reduce((a, s) => a + (s.qoshimcha || 0), 0),
      muddati: faol.reduce((a, s) => a + (s.muddati || 0), 0), tolangan: SH.reduce((a, s) => a + (s.tolangan || 0), 0), tolovSoni: T.length, oxirgiTolov: T[0] || null },
    admin: u.admin, huquq: u.huquq };
}

module.exports = { mijozQidir, mijozKarta };
