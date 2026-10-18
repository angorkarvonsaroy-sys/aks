// AKS TIZIM — eski tizim jurnallarini ko'zgudan o'qish. Har biri Apps Script'dagi shu nomli yordamchi bilan BIR XIL shaklda qaytaradi:
//   xatJurnal (Xat.gs xatJurnal_) · hujjatJurnal (Hujjat.gs hujjatJurnal_) · undJurnal (Undiruv.gs undJurnal_) ·
//   yuIshlar (Yurist.gs yuIshlar_) · topRows / topKor (Topshiriq.gs topRows_ / topKor_)
// r — ko'ringan matn (getDisplayValues), x — xom (getValues).
'use strict';
const V = require('./varaq');

// 06e_Xatlar — getDisplayValues
async function xatJurnal() {
  return (await V.qatorlar('06e_Xatlar')).map(({ n, r }) => ({ qator: n, raqam: r[0] || '', sana: r[1] || '', no: r[2] || '',
    shablon: r[6] || '', bosqich: Number(r[7]) || 0, muddati: r[9] || '', muddat: r[12] || '', holati: r[13] || '', pdf: r[14] || '', skan: r[15] || '', usul: r[16] || '',
    yetSana: r[17] || '', isbot: r[18] || '', kim: r[19] || '', vaqt: r[20] || '', izoh: r[21] || '', pochta: r[22] || '', tek: r[23] || '', tgx: r[24] || '' }))
    .filter(h => h.raqam);
}

// 06d_Hujjatlar — getDisplayValues
async function hujjatJurnal() {
  return (await V.qatorlar('06d_Hujjatlar')).map(({ n, r }) => ({ qator: n, id: r[0] || '', no: r[1] || '', turi: r[5] || '', sana: r[6] || '', nom: r[7] || '',
    faylId: r[8] || '', sahifa: r[10] || '', kim: r[11] || '', vaqt: r[12] || '', holati: r[13] || '', izoh: r[14] || '', naz: r[15] || '', tgx: r[16] || '' }))
    .filter(h => h.id);
}

// 06_Undiruv_jurnali — getValues (xom)
function soatDaq(v) {   // Date (seriya) → "HH:mm"
  if (typeof v !== 'number') { const m = /(\d{1,2}):(\d{2})/.exec(String(v || '')); return m ? m[1].padStart(2, '0') + ':' + m[2] : ''; }
  const sek = Math.round((v - Math.floor(v)) * 86400);
  return String(Math.floor(sek / 3600)).padStart(2, '0') + ':' + String(Math.floor(sek % 3600 / 60)).padStart(2, '0');
}
async function undJurnal() {
  return (await V.qatorlar('06_Undiruv_jurnali')).map(({ n, x, r }) => ({ qator: n, id: x[0] == null ? '' : x[0], sana: V.iso(x[1]), no: String(x[2] == null ? '' : x[2]),
    chora: String(x[4] == null ? '' : x[4]), mazmun: String(x[5] == null ? '' : x[5]), vadaSana: V.iso(x[6]), vadaSumma: Number(x[7]) || 0, hujjat: String(x[8] == null ? '' : x[8]), kim: String(x[9] == null ? '' : x[9]),
    vadaNatija: String(x[15] == null ? '' : x[15]), natija: String(x[17] == null ? '' : x[17]) || (String(x[4]) === 'Боғланиб бўлмади' ? 'Боғланиб бўлмади' : ''),
    vaqt: x[10] == null || x[10] === '' ? '' : (typeof x[10] === 'number' ? soatDaq(x[10]) : soatDaq(r[10])), izoh: String(x[11] == null ? '' : x[11]) }))
    .filter(j => j.id !== '' && j.id !== null && j.sana)
    .sort((a, b) => a.sana < b.sana ? -1 : a.sana > b.sana ? 1 : a.qator - b.qator);
}

// 06b_Yuridik_ishlar — getValues (xom). yuIshQator — bitta qator (n — qator raqami, x — xom qiymatlar); Google'dan yangi o'qilgan qatorga ham.
function yuIshQator(n, x) {
  const s = v => String(v == null ? '' : v);
  return { qator: n, id: x[0] == null ? '' : x[0], no: s(x[1]), topshirilgan: V.iso(x[2]), yurist: s(x[3]),
    davoNo: s(x[5]), davoSana: V.iso(x[6]), sudNomi: s(x[7]), sudIshNo: s(x[8]), qarorSana: V.iso(x[9]), qaror: s(x[10]),
    ijroNo: s(x[11]), ijroSana: V.iso(x[12]), ijrochi: s(x[13]), holati: s(x[14]), izoh: s(x[15]), fish: s(x[16]), dokon: s(x[17]),
    bosqich: Number(x[19]) || 0, bosqichSana: V.iso(x[20]), majlis: V.iso(x[21]), qabulSana: V.iso(x[22]), kuchSana: V.iso(x[23]), mibSana: V.iso(x[24]),
    yol: s(x[25]), undiruvchi: s(x[26]), sorovSabab: s(x[27]), sorovVaqt: typeof x[28] === 'number' ? V.dmy(x[28]) + ' ' + soatDaq(x[28]) : s(x[28]),
    tasdiqladi: s(x[29]), yopishSabab: s(x[30]), tartib: s(x[31]).trim() === 'Buyruq' ? 'Buyruq' : (s(x[31]).trim() === 'Davo' ? 'Davo' : ''), radIzoh: s(x[32]) };
}
async function yuIshlar() {
  return (await V.qatorlar('06b_Yuridik_ishlar')).map(({ n, x }) => yuIshQator(n, x))
    .filter(i => i.id !== '' && i.id !== null && i.no && i.holati);
}

// 10_Topshiriqlar — getDisplayValues
async function topRows() {
  // 🔎 navbatdagi qaror (api/tasdiq_navbat.js) — topshiriq kutilgan holatda ko'rinadi: tasdiq → «Bajarildi», qaytarish → «Jarayonda»
  let K = {}; try { K = (await require('./db').redis.hgetall('tasdiq_kutish')) || {}; } catch (e) { }
  const kut = x => { const v = K['t' + x.id]; if (!v) return x; let o = {}; try { o = JSON.parse(v); } catch (e) { } x.holati = o.ha ? 'Bajarildi' : 'Jarayonda'; return x; };
  return (await V.qatorlar('10_Topshiriqlar')).map(({ n, r }) => kut({ qator: n, id: r[0] || '', yaratildi: r[1] || '', manba: r[2] || '', qoida: r[3] || '', kalit: r[4] || '', sarlavha: r[5] || '', izoh: r[6] || '',
    no: r[7] || '', mid: r[8] || '', kimga: r[9] || '', kimBerdi: r[10] || '', muddat: r[11] || '', muhim: r[12] || '', holati: r[13] || '', yopildi: r[14] || '', yopdi: r[15] || '', dalil: r[16] || '', kechikdi: r[17] || '',
    isbotMaj: r[19] || '', isbot: r[20] || '', tgx: r[21] || '' }))
    .filter(x => x.id);
}
function topIso(dmyhm) { const m = /^(\d{2})\.(\d{2})\.(\d{4})(?:\s+(\d{2}):(\d{2}))?/.exec(String(dmyhm || '')); return m ? m[3] + '-' + m[2] + '-' + m[1] + ' ' + (m[4] || '23') + ':' + (m[5] || '59') : ''; }
function topHozirIso() { const d = new Date(Date.now() + 5 * 3600 * 1000); return d.toISOString().slice(0, 10) + ' ' + d.toISOString().slice(11, 16); }
const topTasdiqchi = t => /^(hj|skanq|skanu|skanz|yutop)\|/.test(String(t.kalit || '')) ? 'yurist' : 'direktor';
function topKor(x) {
  const kech = x.holati === 'Jarayonda' && topIso(x.muddat) && topIso(x.muddat) < topHozirIso();
  return Object.assign({}, x, { kechikkan: !!kech, tasdiqchi: topTasdiqchi(x), tgx: undefined });
}

// 06g_Yuridik_xatlar (Yurhujjat.gs yuxJurnal_) — getDisplayValues
async function yuxJurnal() {
  return (await V.qatorlar('06g_Yuridik_xatlar')).map(({ n, r }) => ({ qator: n, raqam: r[0] || '', sana: r[1] || '', ishId: r[2] || '', no: r[3] || '', fish: r[4] || '',
    turi: r[5] || '', qabul: r[6] || '', holati: r[7] || '', pdf: r[8] || '', doc: r[9] || '', usul: r[10] || '', yetSana: r[11] || '', isbot: r[12] || '', pochta: r[13] || '', kim: r[14] || '', vaqt: r[15] || '', izoh: r[16] || '' }))
    .filter(h => h.raqam);
}
// 06h_Bekor_sorovlari (Bekor.gs bekorJurnal_) — getDisplayValues
async function bekorJurnal() {
  const n = v => Number(String(v == null ? '' : v).replace(/[^\d.-]/g, '')) || 0;
  return (await V.qatorlar('06h_Bekor_sorovlari')).map(({ n: q, r }) => ({ qator: q, id: r[0] || '', no: r[1] || '', tur: r[2] || '', fish: r[3] || '', dokon: r[4] || '', sabab: r[5] || '', holati: r[6] || '', raqam: r[7] || '', sana: r[8] || '',
    shablon: r[9] || '', jami: n(r[10]), tolangan: n(r[11]), jarima: n(r[12]), qaytar: n(r[13]),
    bPdf: r[14] || '', bDoc: r[15] || '', xPdf: r[16] || '', xDoc: r[17] || '', bSkan: r[18] || '', usul: r[19] || '', yetSana: r[20] || '', pochta: r[21] || '', xSkan: r[22] || '',
    xatOgoh: r[23] === 'Ha', kim: r[24] || '', vaqt: r[25] || '', tKim: r[26] || '', tVaqt: r[27] || '', eski: r[28] || '', izoh: r[29] || '', xRaqam: r[30] || '' }))
    .filter(s => s.id);
}
// 06j_Tahrir_jurnali (Tahrir.gs tahrirJurnal_) — oxirgi 60 yozuv, yangilari tepada
async function tahrirJurnal() {
  const L = (await V.qatorlar('06j_Tahrir_jurnali')).map(({ r }) => ({ id: r[0] || '', vaqt: r[1] || '', no: r[2] || '', tur: r[3] || '', mid: r[4] || '', maydon: r[5] || '', eski: r[6] || '', yangi: r[7] || '', kim: r[8] || '', usul: r[9] || '' })).filter(x => x.id);
  return L.slice(-60).reverse();
}
// 06i_Direktor_sorovlari (Monitoring.gs monSorovlar_)
async function monSorovlar() {
  return (await V.qatorlar('06i_Direktor_sorovlari')).map(({ n, r }) => ({ qator: n, id: r[0] || '', vaqt: r[1] || '', kim: r[2] || '', tur: r[3] || '', kalit: r[4] || '', sabab: r[5] || '', holati: r[6] || '', javob: r[7] || '', javobVaqt: r[8] || '', javobKim: r[9] || '', malumot: r[10] || '' }))
    .filter(s => s.id);
}
// 06t_Tasdiq_qarorlari (Topshiriq.gs tqRows_)
async function tqRows() {
  return (await V.qatorlar('06t_Tasdiq_qarorlari')).map(({ n, r }) => { let m = {}; try { m = JSON.parse(r[11] || '{}'); } catch (e) { }
    return { qator: n, id: r[0] || '', vaqt: r[1] || '', kalit: r[2] || '', tur: r[3] || '', no: r[4] || '', yukladi: r[5] || '', tasdiqchi: r[6] || '', kim: r[7] || '', rol: r[8] || '', qaror: r[9] || '', sabab: r[10] || '', m, tiklash: r[12] || '', direktor: r[13] || '', tgx: r[14] || '' }; })
    .filter(q => q.id);
}

module.exports = { xatJurnal, hujjatJurnal, undJurnal, yuIshlar, yuIshQator, topRows, topKor, yuxJurnal, bekorJurnal, tahrirJurnal, monSorovlar, tqRows };
