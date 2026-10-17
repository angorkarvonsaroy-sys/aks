// AKS TIZIM — 📎 Hujjatlar kartasidagi panellar serverda (faqat o'qish; natija eski tizim bilan bir xil):
//   ✎ tahrirHolat (Tahrir.gs v25.9.3) · ✂ bekorHolat (Bekor.gs)
// Tahrirni saqlash, bekor so'rovini kiritish va hujjat yasash — eski tizimda (ko'prik).
'use strict';
const S = require('./sessiya');
const V = require('../lib/varaq');
const J = require('../lib/jurnallar');
const { xodimTeng } = require('../lib/xodim');

const XAT_ESKI_CHEGARA = '2025-08-30';
const BEKOR_YOPIQ = ['Bekor qilindi', 'Rad etildi', 'Qaytarildi'], BEKOR_IJARA_OGOH_KUN = 10;

function aOxiri(rows) { let m = 0; rows.forEach(({ n, x }) => { if (x[0] !== null && x[0] !== undefined && x[0] !== '') m = n; }); return rows.filter(z => z.n <= m); }
const kor = (r, n) => { const o = []; for (let i = 0; i < n; i++) o.push(r[i] == null ? '' : String(r[i])); return o; };   // getDisplayValues
const xom = (x, n) => { const o = []; for (let i = 0; i < n; i++) o.push(x[i] == null ? '' : x[i]); return o; };          // getValues
// getRange(bosh, 1, soni, …) — qator raqami bo'yicha; ko'zguda yo'q (bo'sh) qatorlar ham o'z joyida bo'sh turadi
function oraliq(rows, bosh, soni) { const M = {}; rows.forEach(z => { M[z.n] = z; }); const o = []; for (let n = bosh; n < bosh + soni; n++) o.push(M[n] || { n, x: [], r: [] }); return o; }
const bugunDmy = () => V.bugun().split('-').reverse().join('.');
function yhIso(s) { s = String(s || '').trim(); if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10); if (/^\d{2}\.\d{2}\.\d{4}/.test(s)) return s.slice(0, 10).split('.').reverse().join('-'); return ''; }
const yhDmy = s => { s = String(s || ''); return /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10).split('-').reverse().join('.') : s; };

// ------------------------------------------------------------------ ✎ TAHRIR (Tahrir.gs)
async function tahrirSh(no) {
  no = String(no || '').trim();
  if (/^IJ-27\/\d+$/.test(no)) {
    const Vv = aOxiri(await V.qatorlar('04_Ijara_shartnomalar')).map(z => kor(z.r, 38));
    const i = Vv.findIndex(x => String(x[0]).trim() === no);
    if (i < 0) throw new S.Xato('Ijara shartnomasi topilmadi: ' + no);
    const r = Vv[i];
    return { tur: 'ijara', no, mid: String(r[5]).trim(), dokon: String(r[4] || ''), sana: r[1], holati: String(r[2] || ''),
      kiritdi: String(r[20] || '').trim(), kiritildi: String(r[37] || '').trim(), faoliyat: String(r[18] || '') };
  }
  if (/^27\/\d+$/.test(no)) {
    const Vv = aOxiri(await V.qatorlar('03_Sotuv_shartnomalar')).map(z => kor(z.r, 42));
    const i = Vv.findIndex(x => String(x[0]).trim() === no);
    if (i < 0) throw new S.Xato('Shartnoma topilmadi: ' + no);
    const r = Vv[i];
    let kiritdi = String(r[41] || '').trim();
    if (!kiritdi) {  // eski shartnoma — 03b izohidagi «Web App: …»
      const x = aOxiri(await V.qatorlar('03b_Tolov_jadvali')).map(z => kor(z.r, 8)).find(z => String(z[1]).trim() === no && /^Web App: /.test(String(z[7] || '')));
      if (x) kiritdi = String(x[7]).replace(/^Web App: /, '').trim();
    }
    return { tur: 'sotuv', no, mid: String(r[4]).trim(), dokon: String(r[5] || ''), sana: r[2], holati: String(r[13] || ''), kiritdi, kiritildi: String(r[40] || '').trim(), faoliyat: '' };
  }
  throw new S.Xato('Shartnoma raqami noto\'g\'ri: «' + no + '» — 27/… yoki IJ-27/… bo\'lishi kerak.');
}
async function tahrirBoshqa(mid, no) {
  const L = [];
  aOxiri(await V.qatorlar('03_Sotuv_shartnomalar')).map(z => kor(z.r, 14)).forEach(x => {
    if (x[0] && String(x[4]).trim() === String(mid).trim() && String(x[0]).trim() !== no) L.push(String(x[0]).trim() + (x[13] ? ' (' + x[13] + ')' : '')); });
  aOxiri(await V.qatorlar('04_Ijara_shartnomalar')).map(z => kor(z.r, 6)).forEach(x => {
    if (x[0] && String(x[5]).trim() === String(mid).trim() && String(x[0]).trim() !== no) L.push(String(x[0]).trim() + (x[2] ? ' (' + x[2] + ')' : '')); });
  return L;
}
async function tahrirHolat([kodSes, no]) {
  const u = await S.ruxsat(kodSes, 'shartnoma');
  const c = await tahrirSh(no);
  const m2 = aOxiri(await V.qatorlar('02_Mijozlar')).map(z => kor(z.r, 25));
  const r = m2.find(x => String(x[0]).trim() === String(c.mid).trim());
  if (!r) throw new S.Xato('Mijoz 02_Mijozlar da topilmadi (ID ' + c.mid + ').');
  const bugun = bugunDmy();
  const kirKun = String(c.kiritildi || '').slice(0, 10) || String(c.sana || '');
  const skan = (await J.hujjatJurnal()).some(h => h.no === String(c.no) && h.turi === 'SHARTNOMA' && h.holati === 'Faol');
  const ogoh = [];
  let mumkin = true, sabab = '';
  if (/bekor/i.test(c.holati)) { mumkin = false; sabab = 'Shartnoma «' + c.holati + '» holatida — tahrirlanmaydi.'; }
  else if (!u.admin) {
    if (c.kiritdi && !xodimTeng(c.kiritdi, u.fish)) { mumkin = false; sabab = 'Bu shartnomani ' + c.kiritdi + ' kiritgan — faqat kiritgan xodim (o\'sha kuni) yoki direktor tahrirlaydi.'; }
    else if (skan) { mumkin = false; sabab = 'Imzolangan shartnoma skani yuklangan — endi faqat direktor ruxsati bilan.'; }
    else if (kirKun !== bugun) { mumkin = false; sabab = 'Kiritilgan kun (' + (kirKun || 'noma\'lum') + ') o\'tgan — endi faqat direktor ruxsati bilan.'; }
  } else {
    if (skan) ogoh.push('Imzolangan skan yuklangan — ma\'lumot o\'zgarsa qog\'ozdagi nusxa bilan farq chiqadi; PDF qayta chiqarib, qayta imzolatish kerak bo\'lishi mumkin.');
    if (kirKun !== bugun) ogoh.push('Kiritilgan kun o\'tgan (' + (kirKun || 'noma\'lum') + ').');
  }
  let faoliyatlar = [];
  if (c.tur === 'ijara') faoliyatlar = oraliq(await V.qatorlar('08_Lugatlar'), 2, 30).map(z => String(xom(z.x, 8)[7] || '')).filter(Boolean);
  const hud = oraliq(await V.qatorlar('08b_Hududlar'), 2, 210).map(z => xom(z.x, 2)).filter(x => x[0] && x[1]).map(x => [String(x[0]), String(x[1])]);
  return { ok: true, no: c.no, tur: c.tur, dokon: c.dokon, mid: c.mid, holati: c.holati, sana: String(c.sana || ''),
    kiritdi: c.kiritdi || '—', kiritildi: c.kiritildi || '', skan, mumkin, sabab, ogoh, admin: u.admin,
    mijoz: { fish: r[2], tel: r[4], tel2: r[5], pasport: r[6], jshshir: r[11], mv: r[13], mt: r[14], mfy: r[15], kocha: r[16], uy: r[17], xon: r[18] },
    faoliyat: c.faoliyat, faoliyatlar, hud, boshqa: await tahrirBoshqa(c.mid, c.no) };
}

// ------------------------------------------------------------------ ✂ BEKOR (Bekor.gs)
// bekorShartnoma_ — panel uchun kerakli qismi (mijoz manzili va kirill ismi hujjat yasashda kerak, bu yerda emas)
async function bekorShartnoma(no) {
  no = String(no || '').trim();
  const iso = v => typeof v === 'number' ? V.iso(v) : yhIso(v);
  let x = null;
  if (/^IJ-/.test(no)) {
    const r = (aOxiri(await V.qatorlar('04_Ijara_shartnomalar')).map(z => xom(z.x, 24)).find(z => String(z[0]).trim() === no));
    if (!r) return null;
    x = { tur: 'ijara', no, sana: iso(r[1]), holati: String(r[2] || ''), dokon: String(r[4] || ''), mid: String(r[5] || ''), beruvchi: String(r[6] || ''),
      masul: String(r[20] || '').trim(), fish: String(r[23] || ''), shablon: 'IJARA', tolangan: 0, undiruvchi: '' };
  } else {
    const r3 = aOxiri(await V.qatorlar('03_Sotuv_shartnomalar')).map(z => xom(z.x, 33)).find(z => String(z[0]).trim() === no);
    if (!r3) return null;
    x = { tur: 'sotuv', no, sana: iso(r3[2]), turi: String(r3[3] || ''), mid: String(r3[4] || ''), dokon: String(r3[5] || ''), holati: String(r3[13] || ''),
      undiruvchi: String(r3[17] || '').trim(), fish: String(r3[20] || ''), tolangan: Number(r3[27]) || 0, masul: '' };
  }
  // bekorDokonQosh_: 01_Dokonlar 2..641 (bo'sh qatorlar ham)
  const D = oraliq(await V.qatorlar('01_Dokonlar'), 2, 640).map(z => xom(z.x, 26));
  const d = D.find(z => String(z[0]) === String(x.dokon));
  x.dk = d ? { qurilish: String(d[7] || ''), egasi: String(d[18] || ''), ijaraNo: String(d[21] || '') } : null;
  if (x.tur === 'sotuv') {
    if (/100%/.test(x.turi)) x.shablon = 'TOLIQ';
    else if (x.sana && x.sana < XAT_ESKI_CHEGARA) x.shablon = x.dk && x.dk.qurilish === 'Якунланмаган' ? 'ESKI_QURILAYOTGAN' : 'ESKI_TAYYOR';
    else x.shablon = /Қурилаётган/.test(x.turi) ? 'YANGI_QURILAYOTGAN' : 'YANGI_TAYYOR';
  }
  return x;
}
async function bekorTekshir(u, no, BJ, HJ) {
  const x = await bekorShartnoma(no);
  if (!x) return { ok: false, sabab: 'Shartnoma bazada topilmadi: ' + no };
  if (/bekor/i.test(x.holati)) return { ok: false, sabab: 'Shartnoma allaqachon bekor qilingan (' + x.holati + ').' };
  if (x.shablon === 'TOLIQ') return { ok: false, sabab: '100% to\'lov shartnomasi — bekor qilish tartibi alohida ko\'rib chiqiladi, Kamoliddinga ayting.' };
  const ochiq = BJ.find(s => s.no === no && BEKOR_YOPIQ.indexOf(s.holati) < 0);
  if (ochiq) return { ok: false, sabab: 'Bu shartnoma bo\'yicha ochiq so\'rov bor: ' + ochiq.raqam + ' (' + ochiq.holati + ', ' + ochiq.kim + ').' };
  if (!u.admin) {
    if (x.tur === 'sotuv' && !xodimTeng(x.undiruvchi, u.fish))
      return { ok: false, sabab: 'Sotuv shartnomasini bekor qilishga faqat biriktirilgan undiruvchi (' + (x.undiruvchi || 'biriktirilmagan') + ') yoki direktor kiritadi.' };
    if (x.tur === 'ijara' && !xodimTeng(x.masul, u.fish))
      return { ok: false, sabab: 'Ijara shartnomasini bekor qilishga faqat uni tuzgan xodim (' + (x.masul || 'noma\'lum') + ') yoki direktor kiritadi.' };
  }
  if (!HJ.some(h => h.no === no && h.turi === 'SHARTNOMA' && h.holati === 'Faol')) return { ok: false, sabab: 'Imzolangan shartnoma skani yuklanmagan — avval «📎 Hujjatlar» bo\'limida SHARTNOMA turini yuklang.' };
  // bekorXatlar_ — faqat og (ro'yxat) va yoq kerak
  let og;
  if (x.tur === 'ijara') og = HJ.filter(h => h.no === x.no && h.turi === 'OGOHLANTIRISH' && h.holati === 'Faol').sort((a, b) => yhIso(a.sana) < yhIso(b.sana) ? -1 : 1);
  else og = (await J.xatJurnal()).filter(h => h.no === x.no && h.holati === 'Yuborildi');
  const yoq = !og.length;
  if (x.tur === 'ijara') {
    if (!og.length) return { ok: false, sabab: 'Ijara shartnomasining 6.3-bandi: avval yozma ogohlantirish yuboriladi (skani «📎 Hujjatlar»da OGOHLANTIRISH turi bilan yuklanadi) va kamchilikni tuzatishga ' + BEKOR_IJARA_OGOH_KUN + ' kun beriladi.' };
    const bugun = V.bugun();
    const chegara = new Date(Date.now() + 5 * 3600000 - BEKOR_IJARA_OGOH_KUN * 86400000).toISOString().slice(0, 10);
    const bor = og.some(h => { const s = yhIso(h.sana); return s && s <= chegara && s <= bugun; });
    if (!bor) return { ok: false, sabab: 'Ijara 6.3-band: ogohlantirish xatidan keyin ' + BEKOR_IJARA_OGOH_KUN + ' kun o\'tishi kerak (oxirgi ogohlantirish: ' + yhDmy(yhIso(og[og.length - 1].sana)) + ').' };
  }
  const ogoh = [];
  if (x.tur === 'sotuv' && yoq && (x.shablon === 'YANGI_TAYYOR' || x.shablon === 'YANGI_QURILAYOTGAN'))
    ogoh.push('Bu yangi shartnoma bo\'yicha bironta ogohlantirish xati yuborilmagan — so\'rov qabul qilinadi, lekin direktorga qizil ogohlantirish bilan boradi.');
  if (/^ESKI/.test(x.shablon))
    ogoh.push('Eski shartnoma (4.2.1): xabarnoma SHARTNOMADA ko\'rsatilgan manzilga yuboriladi — manzilni imzolangan shartnoma skani bilan solishtiring (elektron va imzolangan nusxada manzil farq qilishi mumkin).');
  if (x.tur === 'ijara' && x.beruvchi && x.beruvchi !== 'MChJ')
    ogoh.push('Ijara do\'kon egasi nomidan tuzilgan (' + x.beruvchi + (x.dk && x.dk.egasi !== 'SOTILMAGAN' ? ': ' + x.dk.egasi : '') + ') — bekor qilishni egasi bilan kelishing.');
  if (x.tur === 'sotuv' && x.dk && x.dk.ijaraNo)
    ogoh.push('Do\'konda faol ijara bor (' + x.dk.ijaraNo + ') — sotuv bekor qilinganda ijara shartnomasiga tegilmaydi, u alohida ko\'rib chiqiladi.');
  return { ok: true, ogoh };
}
async function bekorHolat([kodSes, no]) {
  const u = await S.ruxsat(kodSes);
  if (!u.admin && !u.huquq.includes('undiruv') && !u.huquq.includes('hujjat')) throw new S.Xato('Bu bo\'limga ruxsatingiz yo\'q.');
  no = String(no || '').trim();
  const BJ = await J.bekorJurnal();
  const hamma = BJ.filter(z => z.no === no);
  const s = hamma.filter(z => BEKOR_YOPIQ.indexOf(z.holati) < 0).pop();
  const ox = hamma.filter(z => BEKOR_YOPIQ.indexOf(z.holati) >= 0).pop();
  const oxirgi = ox ? { raqam: ox.raqam, holati: ox.holati, vaqt: ox.tVaqt || ox.vaqt } : null;
  if (s) {
    let mas = u.admin || s.kim === u.fish;   // bekorMasulmi_
    if (!mas) { const x = await bekorShartnoma(s.no); mas = !!x && ((x.tur === 'sotuv' && xodimTeng(x.undiruvchi, u.fish)) || (x.tur === 'ijara' && xodimTeng(x.masul, u.fish))); }
    return { no, s: { id: s.id, raqam: s.raqam, xRaqam: s.xRaqam, sana: s.sana, holati: s.holati, sabab: s.sabab, kim: s.kim, vaqt: s.vaqt,
      shablon: s.shablon, jarima: s.jarima, qaytar: s.qaytar, tolangan: s.tolangan, eski: /^ESKI/.test(s.shablon),
      bSkan: s.bSkan, xSkan: s.xSkan, usul: s.usul, yetSana: s.yetSana, pochta: s.pochta, xatOgoh: s.xatOgoh, izoh: s.izoh,
      doc: !!(s.bDoc || s.xDoc),
      qayta: s.holati === 'Hujjatlar tayyorlandi' && (u.admin || s.kim === u.fish),
      yuklay: mas }, oxirgi, admin: u.admin };
  }
  const t = await bekorTekshir(u, no, BJ, await J.hujjatJurnal());
  return { no, s: null, oxirgi, mumkin: t.ok, sabab: t.sabab || '', ogoh: t.ogoh || [], admin: u.admin };
}

// ------------------------------------------------------------------ 🗂 hujjatNazorat (Hujjat.gs) — nusxasi yuklanmagan shartnomalar, arxiv holati
const HUJJAT_NAZORAT_BOSHI = '2026-09-29', HUJJAT_NAZORAT_KUN = 3;
async function hujjatNazorat([kodSes]) {
  await S.ruxsat(kodSes, 'admin');
  const r = (await require('./hujjat').hujjatBoshlang([kodSes])).royxat;
  const bugun = V.bugun();
  const chegara = new Date(Date.now() + 5 * 3600000 - HUJJAT_NAZORAT_KUN * 86400000).toISOString().slice(0, 10);
  const kim = {};
  aOxiri(await V.qatorlar('04_Ijara_shartnomalar')).map(z => xom(z.x, 21)).forEach(x => { if (x[0]) kim[String(x[0])] = String(x[20] || ''); });
  aOxiri(await V.qatorlar('03b_Tolov_jadvali')).map(z => xom(z.x, 8)).forEach(x => { const m = /^Web App: (.+)$/.exec(String(x[7] || '')); if (m && !kim[String(x[1])]) kim[String(x[1])] = m[1]; });
  const nusxasiz = r.filter(x => x.sana >= HUJJAT_NAZORAT_BOSHI && x.sana <= chegara && !x.skan && !/Bekor/i.test(x.holati))
    .map(x => ({ no: x.no, fish: x.fish, dokon: x.dokon, sana: x.sana, kun: Math.round((new Date(bugun) - new Date(x.sana)) / 86400000), kim: kim[x.no] || '—' }))
    .sort((a, b) => b.kun - a.kun);
  const faol = r.filter(x => !/Bekor/i.test(x.holati));
  const arxiv = { sotuv: [faol.filter(x => x.tur === 'sotuv' && x.skan).length, faol.filter(x => x.tur === 'sotuv').length],
    ijara: [faol.filter(x => x.tur === 'ijara' && x.skan).length, faol.filter(x => x.tur === 'ijara').length],
    jami: (await J.hujjatJurnal()).filter(h => h.holati === 'Faol').length };
  return { nusxasiz, arxiv, kun: HUJJAT_NAZORAT_KUN };
}

module.exports = { tahrirHolat, bekorHolat, hujjatNazorat };
