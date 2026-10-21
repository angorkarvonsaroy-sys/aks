// AKS TIZIM — 👤 MIJOZ KARTASI PDF serverda (Mijoz.gs v2.3 mijozKartaPdf bilan bir xil HTML — belgima-belgi; kirill, bir varaq, muhrsiz).
// Ma'lumot — serverdagi mijozKarta (api/mijoz.js, eski bilan bir xil). PDF — Chromium (eski tizim ham Google'ning Chromium'ida yasaydi: lib/pdf.js).
// Sahifa: eski HTML'dagi @page{size:A4;margin:14mm 12mm}; Google o'zinikini (A4, 0,5 dyuym) qo'shadimi — «aks-yozuv-sinov mijozpdf» ikkala variantni
// eski PDF bilan solishtirib tanlaydi (Redis mijoz_karta_sahifa: 'html' | 'google').
// Yoqilishi: Redis yozuv_yondi:mijoz_karta_pdf va Chromium. Aks holda — eski tizim.
'use strict';
const S = require('./sessiya');
const PDF = require('../lib/pdf');
const koprik = require('./koprik');
const { redis } = require('../lib/db');
const { mijozKarta } = require('./mijoz');
const { reyKiril } = require('./reyestr')._ichki;

const SAHIFA = { html: '', google: '@page{size:A4;margin:0.5in}' };   // 'google' — Google'ning standart sahifasi (0,5 dyuym) HTML'dagi @page dan KEYIN (ustun keladi)
function bugunDmyHm() { const d = new Date(Date.now() + 5 * 3600 * 1000), p = n => String(n).padStart(2, '0');
  return p(d.getUTCDate()) + '.' + p(d.getUTCMonth() + 1) + '.' + d.getUTCFullYear() + ' ' + p(d.getUTCHours()) + ':' + p(d.getUTCMinutes()); }

// Eski kod yasaydigan HTML — belgima-belgi bir xil. r — mijozKarta natijasi, bugun — 'dd.MM.yyyy HH:mm'
function kartaHtml(r, bugun) {
  const m = r.mijoz, J = r.jami;
  const e = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const k = s => reyKiril(s);
  const p = n => Math.round(Number(n) || 0).toLocaleString('ru-RU').replace(/,/g, ' ').replace(/ /g, ' ');
  const HL = { 'Aktiv': 'амалда', 'Kredit asosida': 'кредит асосида', 'Shartnoma olmagan': 'шартнома олмаган', 'Yakunlangan': 'якунланган', 'Bekor qilindi': 'бекор қилинган', 'Passiv': 'пассив' };
  const sh = r.shartnomalar.map(s => '<tr><td><b>' + e(s.no) + '</b><br>' + (s.tur === 'sotuv' ? 'сотув' : 'ижара') + '</td><td>' + e(s.dokon) + (s.maydon ? '<br>' + e(s.maydon) + ' м²' : '') + '</td><td>' + e(s.sana) + '</td><td>' + e(HL[s.holati] || s.holati) + '</td>'
    + (s.tur === 'sotuv' ? '<td class="r">' + p(s.qiymat) + '</td><td class="r">' + p(s.tolangan) + '</td><td class="r">' + p(s.asosiy) + (s.qoshimcha ? '<br>+' + p(s.qoshimcha) + ' қўш.' : '') + '</td><td class="r">' + (s.muddati ? '<b>' + p(s.muddati) + '</b><br>' + s.kechikkan + ' кун' : '—') + '</td><td>' + e(s.keyingi === 'jadval tugagan' ? 'жадвал тугаган' : (s.keyingi || '')) + '<br>' + e(s.tugash || '') + '</td>'
      : '<td colspan="5">' + e(s.bosh) + ' – ' + e(s.tugash) + ' · ' + e(s.muddat) + ' ой' + (s.bepul ? ' · бепул ' + e(s.bepul) + ' ой' : '') + (s.oylik ? ' · ойлик ' + p(s.oylik) : '') + '</td>') + '</tr>').join('');
  const dk = r.dokonlar.map(d => '<tr><td><b>' + e(d.id) + '</b></td><td class="r">' + String(d.real).replace('.', ',') + '</td><td class="r">' + String(d.shartnoma || '').replace('.', ',') + '</td><td class="r">' + (d.farq ? String(d.farq).replace('.', ',') : '—') + '</td><td>' + e(d.qurilish) + '</td><td>' + e(k(d.savdo)) + '</td><td>' + e(k(d.faoliyat || '—')) + '</td><td>' + e(k(d.ijarachi || '—')) + '</td></tr>').join('');
  const hj = r.nazorat.map(n => '<tr><td><b>' + e(n.no) + '</b></td>' + n.royxat.map(x => '<td>' + (x.bor ? '✔ ' : '✘ ') + e({ SHARTNOMA: 'шартнома', PASPORT: 'паспорт', DALOLATNOMA: 'далолатнома' }[x.turi]) + '</td>').join('') + '</tr>').join('');
  return '<html><head><meta charset="utf-8"><style>@page{size:A4;margin:14mm 12mm}body{font-family:"Times New Roman",serif;font-size:11px;color:#111;line-height:1.3}h1{font-size:14px;text-align:center;margin:0}h2{font-size:12px;margin:10px 0 4px;border-bottom:1px solid #999}'
    + '.sub{text-align:center;font-size:10px;color:#555;margin-bottom:8px}table{width:100%;border-collapse:collapse;font-size:10px}td,th{border:1px solid #999;padding:3px 4px;vertical-align:top}th{background:#eee}.r{text-align:right;white-space:nowrap}'
    + '.g{display:grid;grid-template-columns:1fr 1fr;gap:2px 16px}.k{display:flex;gap:6px}.k div{flex:1;border:1px solid #999;padding:4px 6px}.k b{display:block;font-size:12px}</style></head><body>'
    + '<h1>«ANGOR KARVON SAROY» МЧЖ</h1><h1>МИЖОЗ КАРТАСИ</h1><div class="sub">' + bugun + ' ҳолатига · мижоз ID ' + e(m.id) + '</div>'
    + '<h2>1. Мижоз</h2><div class="g"><div><b>Ф.И.Ш.:</b> ' + e(k(m.fish).toUpperCase()) + '</div><div><b>Телефон:</b> ' + e(m.tel) + (m.tel2 ? ', ' + e(m.tel2) : '') + '</div><div><b>Паспорт:</b> ' + e(m.pasport) + (m.pMuddat ? ' (амал қилиш муддати ' + e(m.pMuddat) + (r.pasportQolgan !== null && r.pasportQolgan < 0 ? ' — <b>муддати ўтган</b>' : '') + ')' : '') + '</div><div><b>ЖШШИР:</b> ' + e(m.jshshir) + '</div><div style="grid-column:1/3"><b>Манзил:</b> ' + e(k(m.manzil).replace(/-uy\b/g, '-уй').replace(/-xonadon\b/g, '-хонадон')) + '</div></div>'
    + '<h2>2. Ҳисоб-китоб</h2><div class="k"><div>Шартномалар<b>' + J.shartnoma + ' (амалда ' + J.faol + ')</b></div><div>Тўланган<b>' + p(J.tolangan) + '</b></div><div>Асосий қарз<b>' + p(J.asosiy) + '</b></div><div>Қўшимча майдон қарзи<b>' + p(J.qoshimcha) + '</b></div><div>Жами қарз<b>' + p(J.qarz) + '</b></div><div>Муддати ўтган<b>' + p(J.muddati) + '</b></div></div>'
    + '<h2>3. Шартномалар</h2><table><tr><th>Шартнома</th><th>Дўкон</th><th>Сана</th><th>Ҳолати</th><th>Қиймати</th><th>Тўланган</th><th>Қарз</th><th>Муддати ўтган</th><th>Кейинги тўлов / тугаш</th></tr>' + sh + '</table>'
    + (dk ? '<h2>4. Дўконлар</h2><table><tr><th>Дўкон</th><th>Реал м²</th><th>Шартн. м²</th><th>Фарқ</th><th>Қурилиш</th><th>Савдо</th><th>Фаолият</th><th>Ижарачи</th></tr>' + dk + '</table>' : '')
    + (hj ? '<h2>5. Ҳужжатлар</h2><table><tr><th>Шартнома</th><th>Шартнома нусхаси</th><th>Паспорт нусхаси</th><th>Қабул-топшириш далолатномаси</th></tr>' + hj + '</table>' : '')
    + '<p style="margin-top:14px;font-size:10px;color:#555">Маълумотнома AKS TIZIM базаси асосида шакллантирилди. Тўловлар сони: ' + J.tolovSoni + (J.oxirgiTolov ? ' · охирги тўлов ' + e(J.oxirgiTolov.sana) + ', ' + p(J.oxirgiTolov.summa) + ' сўм' : '') + '.</p>'
    + '<div style="margin-top:20px;display:flex;justify-content:space-between"><div></div><div>«ANGOR KARVON SAROY» МЧЖ<br>директори<br><br>_______________ ҲАЙДАРОВ К.</div></div></body></html>';
}

// Shrift farqlari (sinov, 22.10): Google «·» ni Times New Roman eni (0,25 em) bilan chizadi, serverdagi Liberation Serif 2.1.5 da u 0,333 em —
// 10 px jadvalda har «·» dan keyingi so'z 0,6 pt suriladi. Belgi inline-block bilan TNR eniga keltiriladi (PDF matni o'zgarmaydi).
const TUZAT = h => h.replace(/·/g, '<span style="display:inline-block;width:0.25em;text-align:center">·</span>');
// Yadro (sinov ham shuni ishlatadi): opt = { bugun, sahifa: 'html' | 'google' }
async function kartaPdfYasa(kodSes, mid, opt = {}) {
  const r = await mijozKarta([kodSes, mid]), m = r.mijoz;
  let sahifa = opt.sahifa; if (!sahifa) { try { sahifa = (await redis.get('mijoz_karta_sahifa')) || 'html'; } catch (e) { sahifa = 'html'; } }
  const html = TUZAT(kartaHtml(r, opt.bugun || bugunDmyHm()));
  const pdf = await PDF.yasa(SAHIFA[sahifa] ? html.replace('</style>', SAHIFA[sahifa] + '</style>') : html, '');
  return { ok: true, b64: pdf.toString('base64'), nom: 'Mijoz_kartasi_' + String(m.fish).split(' ')[0] + '_' + m.id + '.pdf', mime: 'application/pdf' };
}
async function yoqilgan() { try { if ((await redis.get('yozuv_yondi:mijoz_karta_pdf')) !== '1') return false; } catch (e) { return false; } return PDF.bor(); }

async function mijozKartaPdf(args) {
  const [kodSes, mid] = args;
  const u = await S.ruxsat(kodSes);
  if (!(await yoqilgan())) return koprik.chaqir('mijozKartaPdf', u.kod, [mid]);
  return kartaPdfYasa(kodSes, mid);
}

module.exports = { mijozKartaPdf };
module.exports._ichki = { kartaHtml, kartaPdfYasa, SAHIFA };
