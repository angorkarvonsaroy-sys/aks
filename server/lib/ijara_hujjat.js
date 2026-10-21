// AKS TIZIM — ijara shartnomasi hujjati (Kod.gs v9.7 ijaraPdf bilan bir xil matn): Google Doc shabloni NOMI bo'yicha
// (Ijara_shartnoma_MChJ_shablon — do'kon SOTILMAGAN; Ijara_shartnoma_egasi_shablon — do'kon sotilgan, egasining tilxati asosida) →
// <<belgi>> lar → PDF (lib/shablon_pdf.js). Kolontituldagi «Шартнома № <<SH_RAQAM>> — <sahifa>» ham to'ldiriladi. Bazaga hech narsa yozmaydi.
//   r  — 04_Ijara_shartnomalar qatori (ko'rinish qiymatlari, 37 ustun);  mr — 02_Mijozlar qatori (ko'rinish);
//   dr — 01_Dokonlar qatori (XOM qiymatlar — eski kod getValues bilan o'qigan: F maydon son, G baza son, R sotuv sh., S egasi)
'use strict';
const DS = require('./docs_shablon');
const SP = require('./shablon_pdf');
const SH = require('./sotuv_hujjat');
const { NARX_JADVAL, narxHisob } = require('./narx');

const s = v => String(v == null ? '' : v);
const { sozBilan, telPlus, fmt, num, OYLAR } = SH;
const IJARA_SHABLON_MCHJ = 'Ijara_shartnoma_MChJ_shablon';
const IJARA_SHABLON_EGASI = 'Ijara_shartnoma_egasi_shablon';
function sanaBolak(ddmmyyyy) { const p = s(ddmmyyyy).split('.'); if (p.length !== 3) return { yil: '', kun: '', oy: '', oyRaqam: '' }; return { yil: p[2], kun: p[0], oy: OYLAR[Number(p[1]) - 1] || '', oyRaqam: p[1] }; }

// Belgilar lug'ati (Kod.gs ijaraPdf T bilan bir xil) + ogohlantirishlar
function belgilar(r, mr, dr) {
  const sotilgan = s(dr[18]) !== 'SOTILMAGAN';
  const sh = sanaBolak(r[1]), ps = sanaBolak(mr[9]), mu = sanaBolak(mr[10]), b = sanaBolak(r[9]);
  const t = sanaBolak(num(r[12]) > 0 ? r[28] : r[10]);   // bepul davr tugashi (AC), bo'lmasa tugash sanasi (K)
  const baza = Number(dr[6]); const j = NARX_JADVAL[baza];
  const p0 = j ? j[0] : narxHisob(baza, 0, 36).narx, p60 = j ? j[1] : narxHisob(baza, 60000000, 36).narx, p120 = j ? j[2] : narxHisob(baza, 120000000, 36).narx;
  const dk = s(r[4]).split('-');
  const toza = (v, suf) => s(v).trim().replace(suf, '').trim();
  const kocha = toza(mr[16], /\s*(кўчаси|ko['`ʻ]?chasi|kochasi)\s*$/i), mfy = toza(mr[15], /\s*(МФЙ|MFY)\s*$/i), uy = toza(mr[17], /\s*-?\s*(уй|uy)\s*$/i), xon = toza(mr[18], /\s*-?\s*(хонадон|xonadon)\s*$/i);
  const manzil = [mr[13] ? toza(mr[13], /\s*(вилояти|viloyati)\s*$/i) + ' вилояти' : '', mr[14] ? mr[14] : '', mfy ? mfy + ' МФЙ' : '', kocha ? kocha + ' кўчаси' : '', uy ? uy + '-уй' : '', xon ? xon + '-хонадон' : ''].filter(Boolean).join(', ');
  const bepul = num(r[12]), oylik = num(r[14]), muddat = num(r[11]), tkun = num(r[15]) || 1;
  const IJARA_HAQI_MATN = oylik > 0
    ? 'Бепул фойдаланиш даври мобайнида ижара ҳақи олинмайди. Бепул давр тугаганидан сўнг ойлик ижара ҳақи ' + fmt(oylik) + ' (' + sozBilan(oylik) + ') сўм миқдорида белгиланади ва Ижарачи томонидан ҳар ойнинг ' + tkun + '-кунигача тўлаб борилади.'
    : 'Ижара ҳақи — 0 (нол) сўм. Ижарачи Дўкондан фойдаланганлиги учун бирор сўм ижара ҳақи тўламайди.';
  const KEYINGI_MATN = oylik > 0
    ? 'Бепул давр тугаганидан сўнг Ижарачи ушбу шартнома асосида Дўкондан жами ' + muddat + ' (' + sozBilan(muddat) + ') ой муддатга — ' + r[10] + ' гача — 2.1-бандда белгиланган ижара ҳақи эвазига фойдаланишда давом этади. Муддат Томонларнинг ёзма келишуви билан узайтирилиши мумкин.'
    : 'Бепул фойдаланиш даври тугаганидан сўнг Ижарачи Дўконда қолишни истаса ва сотиб олиш ҳуқуқидан фойдаланмаса, пуллик ижара шартлари алоҳида шартнома билан ўзаро келишиб белгиланади.';
  const PENYA_MATN = oylik > 0
    ? 'Ижара ҳақи муддатида тўланмаса, Ижарачига ҳар бир кечиккан кун учун қарздорлик суммасининг 0,1 % миқдорида пеня қўлланилади; пенянинг умумий миқдори қарздорлик суммасининг 50 % идан ошмайди. Пеня тўланмаган электр энергияси ҳақи ва қопланмаган зарар суммасига нисбатан ҳам шу тартибда қўлланилади.'
    : 'Ижара бепул бўлганлиги сабабли Ижарачидан ижара ҳақи бўйича ҳеч қандай қарздорлик ёки пеня ундирилмайди. Пеня фақат тўланмаган электр энергияси ҳақи ва қопланмаган зарар суммасига нисбатан, ҳар бир кечиккан кун учун 0,1 % миқдорида қўлланилиши мумкин; пенянинг умумий миқдори қарздорлик суммасининг 50 % идан ошмайди.';
  const T = {
    SH_RAQAM: r[0], SH_YIL: sh.yil, SH_KUN: sh.kun, SH_OY: sh.oy,
    FISH: mr[2], PASPORT: s(mr[6]).replace(/^([A-Z]{2})(\d+)$/, '$1 $2'),
    IIB: (mr[7] ? mr[7] + ' вилояти ' : '') + (mr[8] || '') + ' ИИБ', AA: mr[7], AB: mr[8],
    PAS_YIL: ps.yil, PAS_KUN: ps.kun, PAS_OY: ps.oy, PAS_OY_RAQAM: ps.oyRaqam, MUD_YIL: mu.yil, MUD_KUN: mu.kun, MUD_OY: mu.oy,
    JSHSHIR: mr[11], MANZIL: manzil, AG: mr[13], AH: mr[14], AI: mr[15], AJ: mr[16], AK: mr[17], AL: mr[18],
    BLOK: dk[0] || '', QAVAT: dk[1] || '', DOKON: dk[2] || '', MAYDON: s(dr[5]).replace('.', ','),
    B_YIL: b.yil, B_KUN: b.kun, B_OY: b.oy, T_YIL: t.yil, T_KUN: t.kun, T_OY: t.oy,
    BAZA: fmt(baza), P_NAQD: fmt(baza), P_120: fmt(p120), P_60: fmt(p60), P_0: fmt(p0),
    TEL: telPlus(mr[4]) + (mr[5] ? ', ' + telPlus(mr[5]) : ''),
    EGASI: sotilgan ? s(dr[18]) : '', SOTUV_SH: sotilgan ? s(dr[17]) : '', TILXAT: r[7] || '',
    BEPUL_OY: String(bepul), BEPUL_OY_SOZ: sozBilan(bepul), IJARA_HAQI_MATN, KEYINGI_MATN, PENYA_MATN, OYLIK: fmt(oylik)
  };
  const bosh = [['Pasport', mr[6]], ['JSHSHIR', mr[11]], ['Pasport sanasi', mr[9]], ['Manzil', manzil], ['Telefon', mr[4]]].filter(x => !s(x[1]).trim()).map(x => x[0]);
  const pm = s(mr[10]).split('.'); if (pm.length === 3) { const pmd = new Date(Date.UTC(+pm[2], +pm[1] - 1, +pm[0])); const kun = Math.round((pmd - new Date()) / 86400000); if (kun < 0) bosh.push('PASPORT MUDDATI TUGAGAN (' + mr[10] + ')'); else if (kun < 90) bosh.push('pasport muddati ' + kun + ' kundan keyin tugaydi (' + mr[10] + ')'); }
  if (s(mr[11]).replace(/\D/g, '').length !== 14 && s(mr[11]).trim()) bosh.push('JSHSHIR 14 raqam emas (' + mr[11] + ')');
  if (!j) bosh.push('baza narxi (' + fmt(baza) + ') rasmiy prays-listda yo\'q — 4-bo\'lim narxlari formula bo\'yicha');
  return { T, bosh, sotilgan, shablonNom: sotilgan ? IJARA_SHABLON_EGASI : IJARA_SHABLON_MCHJ };
}

// Hujjat: { pdf, bet, qolgan, bosh, nom, sotilgan, shablon:{id,nom,modifiedTime} }
async function ijaraHujjat(r, mr, dr, opt) {
  const { T, bosh, sotilgan, shablonNom } = belgilar(r, mr, dr);
  const sh = await DS.ol(shablonNom), m = sh.model, body = m.el;
  for (const k in T) DS.replaceText(body, '<<' + k + '>>', s(T[k]));
  if (m.footer) DS.replaceText(m.footer, '<<SH_RAQAM>>', s(r[0]));
  const qolgan = DS.qolganBelgilar(body);
  const r2 = await SP.yasa(m);
  return { pdf: r2.pdf, bet: r2.bet, qolgan, bosh, nom: opt && opt.nom || '', sotilgan, shablon: { id: sh.id, nom: sh.nom, modifiedTime: sh.modifiedTime } };
}

module.exports = { ijaraHujjat, belgilar, sanaBolak, IJARA_SHABLON_MCHJ, IJARA_SHABLON_EGASI };
