// AKS TIZIM — Google Sheets bilan ishlash (robot hisob). Tashqi kutubxonasiz: Node crypto + fetch.
// O'qish — «spreadsheets.readonly» ruxsati bilan (ko'zgu). Yozish — «spreadsheets» ruxsati bilan (faqat serverga ko'chirilgan amallar;
// robotga jadvalda «Редактор» huquqi berilgan bo'lishi kerak, aks holda yozuv 403 bilan qaytadi va amal eski tizimga o'tadi).
'use strict';
const crypto = require('crypto');
const fs = require('fs');

const SCOPE = 'https://www.googleapis.com/auth/spreadsheets.readonly';
const SCOPE_YOZ = 'https://www.googleapis.com/auth/spreadsheets';
const SCOPE_DRIVE = 'https://www.googleapis.com/auth/drive.readonly';   // skanlarni o'qish (papka robotga «Читатель» qilib berilgan)
const keshlar = {};   // ruxsat → { token, tugaydi }

function b64(o) { return Buffer.from(typeof o === 'string' ? o : JSON.stringify(o)).toString('base64url'); }

async function token(kalitFayl, scope = SCOPE) {
  const hozir = Math.floor(Date.now() / 1000);
  const kesh = keshlar[scope] || {};
  if (kesh.token && kesh.tugaydi - 120 > hozir) return kesh.token;
  const k = JSON.parse(fs.readFileSync(kalitFayl, 'utf8'));
  const bosh = b64({ alg: 'RS256', typ: 'JWT' }) + '.' +
    b64({ iss: k.client_email, scope, aud: 'https://oauth2.googleapis.com/token', iat: hozir, exp: hozir + 3600 });
  const imzo = crypto.createSign('RSA-SHA256').update(bosh).sign(k.private_key).toString('base64url');
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: bosh + '.' + imzo }),
  });
  const j = await r.json();
  if (!j.access_token) throw new Error('Google token olinmadi: ' + JSON.stringify(j));
  keshlar[scope] = { token: j.access_token, tugaydi: hozir + (j.expires_in || 3600) };
  return j.access_token;
}

async function ol(url, kalitFayl, urinish = 0) {
  const t = await token(kalitFayl);
  const r = await fetch(url, { headers: { Authorization: 'Bearer ' + t } });
  if ((r.status === 429 || r.status >= 500) && urinish < 3) {
    await new Promise(res => setTimeout(res, 5000 * (urinish + 1)));
    return ol(url, kalitFayl, urinish + 1);
  }
  const j = await r.json();
  if (j.error) throw new Error(`Google xato ${j.error.code}: ${j.error.message}`);
  return j;
}

// Jadvaldagi varaqlar ro'yxati
async function varaqlar(sheetId, kalitFayl) {
  const j = await ol(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}` +
    '?fields=properties.title,sheets.properties(sheetId,title,gridProperties(rowCount,columnCount))', kalitFayl);
  return { nom: j.properties.title, varaqlar: j.sheets.map(s => s.properties) };
}

// Hamma varaqni o'qish. Har varaq uchun ikki ko'rinish: xom (raqam — raqam, sana — seriya raqami; getValues o'rni)
// va ko'rinish (katakda ko'ringan matn: «12.05.2026», «1 234 567»; getDisplayValues o'rni). Eski kod ikkalasini ham ishlatadi.
async function qiymatlar(sheetId, nomlar, kalitFayl) {
  const xom = await qiymatlarBir(sheetId, nomlar, kalitFayl, 'UNFORMATTED_VALUE');
  const korinish = await qiymatlarBir(sheetId, nomlar, kalitFayl, 'FORMATTED_VALUE');
  return { xom, korinish };
}
async function qiymatlarBir(sheetId, nomlar, kalitFayl, render) {
  const natija = {};
  const BOLAK = 25; // URL juda uzun bo'lmasligi uchun bo'lib-bo'lib
  for (let i = 0; i < nomlar.length; i += BOLAK) {
    const qism = nomlar.slice(i, i + BOLAK);
    const p = new URLSearchParams({ valueRenderOption: render, dateTimeRenderOption: 'SERIAL_NUMBER', majorDimension: 'ROWS' });
    for (const n of qism) p.append('ranges', `'${n.replace(/'/g, "''")}'`);
    const j = await ol(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values:batchGet?${p}`, kalitFayl);
    (j.valueRanges || []).forEach((vr, idx) => { natija[qism[idx]] = vr.values || []; });
  }
  return natija;
}

// ------------------------------------------------------------------ YOZISH
class RuxsatYoq extends Error {}   // robotda «Редактор» huquqi yo'q — chaqiruvchi eski tizimga o'tadi

async function yuborYoz(url, metod, tana, kalitFayl, urinish = 0) {
  const t = await token(kalitFayl, SCOPE_YOZ);
  const r = await fetch(url, { method: metod, headers: { Authorization: 'Bearer ' + t, 'Content-Type': 'application/json' }, body: JSON.stringify(tana) });
  if ((r.status === 429 || r.status >= 500) && urinish < 2) { await new Promise(res => setTimeout(res, 1500 * (urinish + 1))); return yuborYoz(url, metod, tana, kalitFayl, urinish + 1); }
  const j = await r.json().catch(() => ({}));
  if (r.status === 403 || (j.error && j.error.status === 'PERMISSION_DENIED')) throw new RuxsatYoq('Robotda jadvalga yozish huquqi yo\'q');
  if (j.error) throw new Error(`Google yozuv xato ${j.error.code}: ${j.error.message}`);
  return j;
}
const q = n => `'${String(n).replace(/'/g, "''")}'`;

// Bitta qatorni YANGI o'qish (ko'zgu emas, to'g'ridan-to'g'ri Google) — yozishdan oldin tekshirish uchun. Xom (UNFORMATTED) qiymatlar.
async function qatorOqi(sheetId, varaq, qatorNo, oxirgiUstun, kalitFayl) {
  const p = new URLSearchParams({ valueRenderOption: 'UNFORMATTED_VALUE', dateTimeRenderOption: 'SERIAL_NUMBER', majorDimension: 'ROWS' });
  const j = await ol(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(q(varaq) + '!A' + qatorNo + ':' + oxirgiUstun + qatorNo)}?${p}`, kalitFayl);
  return (j.values && j.values[0]) || [];
}
// Bitta ustunning hamma qiymatlari (Google'dan YANGI, xom): ['A2'..] — 2-qatordan boshlab; bo'sh kataklar '' bo'lib qaytadi
async function ustunOqi(sheetId, varaq, ustun, kalitFayl) {
  const p = new URLSearchParams({ majorDimension: 'COLUMNS', valueRenderOption: 'UNFORMATTED_VALUE' });
  const j = await ol(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(q(varaq) + '!' + ustun + ':' + ustun)}?${p}`, kalitFayl);
  return ((j.values && j.values[0]) || []).map(v => v == null ? '' : v);
}
// Kataklarga yozish — USER_ENTERED: Apps Script setValue(matn) bilan bir xil talqin (sana «2026-10-17» → sana, «27/315» matn ustunida — matn).
// data: [{ varaq, katak: 'F12' yoki 'F12:H12', qiymat: [[…]] }]
async function yoz(sheetId, data, kalitFayl) {
  return yuborYoz(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values:batchUpdate`, 'POST',
    { valueInputOption: 'USER_ENTERED', data: data.map(d => ({ range: q(d.varaq) + '!' + d.katak, majorDimension: 'ROWS', values: d.qiymat })) }, kalitFayl);
}
// Jurnal varag'i oxiriga qator qo'shish (Apps Script appendRow o'rni): A ustunidagi oxirgi to'ldirilgan qatordan keyingi qatorga.
async function qatorQosh(sheetId, varaq, qator, kalitFayl) {
  const p = new URLSearchParams({ majorDimension: 'COLUMNS', valueRenderOption: 'UNFORMATTED_VALUE' });
  const j = await ol(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(q(varaq) + '!A:A')}?${p}`, kalitFayl);
  const n = ((j.values && j.values[0]) || []).length + 1;
  return yuborYoz(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(q(varaq) + '!A' + n)}:append?valueInputOption=USER_ENTERED&insertDataOption=OVERWRITE`, 'POST',
    { majorDimension: 'ROWS', values: [qator] }, kalitFayl);
}
// Kataklarga sana formati (setNumberFormat('dd.MM.yyyy') o'rni). kataklar: [{ varaq, qator (1 dan), ustun (1 dan) }]
const gidKesh = {};
async function sanaFormat(sheetId, kataklar, kalitFayl, naqsh = 'dd.MM.yyyy') {
  if (!kataklar.length) return;
  if (!gidKesh[sheetId]) { const m = await varaqlar(sheetId, kalitFayl); gidKesh[sheetId] = {}; m.varaqlar.forEach(v => { gidKesh[sheetId][v.title] = v.sheetId; }); }
  const requests = kataklar.map(c => ({ repeatCell: { range: { sheetId: gidKesh[sheetId][c.varaq], startRowIndex: c.qator - 1, endRowIndex: c.qator, startColumnIndex: c.ustun - 1, endColumnIndex: c.ustun },
    cell: { userEnteredFormat: { numberFormat: { type: 'DATE', pattern: naqsh } } }, fields: 'userEnteredFormat.numberFormat' } }));
  return yuborYoz(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}:batchUpdate`, 'POST', { requests }, kalitFayl);
}

// Sana yozish (Apps Script: setValue(new Date(...)) + setNumberFormat('dd.MM.yyyy') o'rni): katakka SANA qiymati (seriya raqami) va format,
// katak formati matn («@») bo'lsa ham sana bo'lib yoziladi. kataklar: [{ varaq, qator, ustun, iso: 'yyyy-MM-dd' }]
async function sanaYoz(sheetId, kataklar, kalitFayl, naqsh = 'dd.MM.yyyy') {
  if (!kataklar.length) return;
  if (!gidKesh[sheetId]) { const m = await varaqlar(sheetId, kalitFayl); gidKesh[sheetId] = {}; m.varaqlar.forEach(v => { gidKesh[sheetId][v.title] = v.sheetId; }); }
  // iso: 'yyyy-MM-dd' yoki 'yyyy-MM-dd HH:mm:ss' (Toshkent vaqti) → seriya raqami (kasr — soat); c.naqsh — katakning o'z formati
  const seriya = iso => { const m = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?/.exec(String(iso)); if (!m) return 0;
    return (Date.UTC(+m[1], +m[2] - 1, +m[3]) - Date.UTC(1899, 11, 30)) / 86400000 + ((+m[4] || 0) * 3600 + (+m[5] || 0) * 60 + (+m[6] || 0)) / 86400; };
  const requests = kataklar.map(c => ({ updateCells: { range: { sheetId: gidKesh[sheetId][c.varaq], startRowIndex: c.qator - 1, endRowIndex: c.qator, startColumnIndex: c.ustun - 1, endColumnIndex: c.ustun },
    rows: [{ values: [{ userEnteredValue: { numberValue: seriya(c.iso) }, userEnteredFormat: { numberFormat: { type: c.naqsh && /H/.test(c.naqsh) ? 'DATE_TIME' : 'DATE', pattern: c.naqsh || naqsh } } }] }],
    fields: 'userEnteredValue,userEnteredFormat.numberFormat' } }));
  return yuborYoz(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}:batchUpdate`, 'POST', { requests }, kalitFayl);
}

// Oraliqni YANGI o'qish (ko'zgu emas): a1 — «B2:D500»; render — 'FORMATTED_VALUE' (getDisplayValues) yoki 'UNFORMATTED_VALUE' (getValues)
async function oraliqOqi(sheetId, varaq, a1, kalitFayl, render = 'FORMATTED_VALUE') {
  const p = new URLSearchParams({ valueRenderOption: render, dateTimeRenderOption: 'SERIAL_NUMBER', majorDimension: 'ROWS' });
  const j = await ol(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(q(varaq) + '!' + a1)}?${p}`, kalitFayl);
  return j.values || [];
}
// Varaq nomi → ichki raqami (sheetId / gid)
async function gid(sheetId, varaq, kalitFayl, yangila) {
  if (yangila || !gidKesh[sheetId] || gidKesh[sheetId][varaq] === undefined) { const m = await varaqlar(sheetId, kalitFayl); gidKesh[sheetId] = {}; m.varaqlar.forEach(v => { gidKesh[sheetId][v.title] = v.sheetId; }); }
  if (gidKesh[sheetId][varaq] === undefined) throw new Error('Varaq topilmadi: ' + varaq);
  return gidKesh[sheetId][varaq];
}
// spreadsheets:batchUpdate — bir nechta so'rov bitta urinishda (format, formula nusxasi, varaq nusxasi …); hammasi yoki hech biri
async function soralar(sheetId, requests, kalitFayl) {
  if (!requests.length) return {};
  return yuborYoz(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}:batchUpdate`, 'POST', { requests }, kalitFayl);
}
// Jurnal oxiriga qator (appendRow o'rni) — n: kutilgan qator (A ustunidagi oxirgi to'ldirilgandan keyingi). Google qo'shishni o'zi navbatga qo'yadi:
// shu orada boshqa yozuv n-qatorni egallagan bo'lsa — yangi qator undan keyingisiga tushadi (ustma-ust yozilmaydi). Haqiqiy qator raqami qaytadi.
async function qatorQoshR(sheetId, varaq, n, qator, kalitFayl) {
  const j = await yuborYoz(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(q(varaq) + '!A' + n)}:append?valueInputOption=USER_ENTERED&insertDataOption=OVERWRITE`, 'POST',
    { majorDimension: 'ROWS', values: [qator] }, kalitFayl);
  const m = /!\$?[A-Z]+\$?(\d+)/.exec((j.updates && j.updates.updatedRange) || '');
  return m ? Number(m[1]) : n;
}
// Kataklar haqida to'liq ma'lumot (qiymat turi, format, formula) — yozuvni eski tizim yozganiga solishtirish uchun
async function kataklarOqi(sheetId, varaq, a1, kalitFayl) {
  const p = new URLSearchParams({ ranges: q(varaq) + '!' + a1, fields: 'sheets.data.rowData.values(userEnteredValue,effectiveValue,formattedValue,userEnteredFormat.numberFormat)' });
  const j = await ol(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}?${p}`, kalitFayl);
  const d = (((j.sheets || [])[0] || {}).data || [])[0] || {};
  return (d.rowData || []).map(r => r.values || []);
}

// ------------------------------------------------------------------ DRIVE (faqat o'qish): fayl nomi + tanasi (Buffer)
// Disk keshi: <hujjatPapka>/.drive/<id>.bin (+ .json: modifiedTime, nom, mime). Har safar faqat metama'lumot so'raladi (tez);
// fayl o'zgarmagan bo'lsa — diskdan, o'zgargan bo'lsa — qayta yuklanadi. Kesh yozilmasa ham (ruxsat) — oddiy yuklab berish.
const path = require('path');
const DRIVE_KESH_MAX = 30 * 1048576;
function keshYol(id) { const env = require('./env'); return path.join(env.hujjatPapka, '.drive', String(id).replace(/[^A-Za-z0-9_-]/g, '_')); }
async function driveFayl(faylId, kalitFayl) {
  const t = await token(kalitFayl, SCOPE_DRIVE);
  const id0 = String(faylId || '').trim(), id = encodeURIComponent(id0);
  const ky = keshYol(id0);
  let k = null; try { k = JSON.parse(fs.readFileSync(ky + '.json', 'utf8')); if (!fs.existsSync(ky + '.bin')) k = null; } catch (e) { k = null; }
  const metaP = fetch(`https://www.googleapis.com/drive/v3/files/${id}?fields=name,size,mimeType,modifiedTime&supportsAllDrives=true`, { headers: { Authorization: 'Bearer ' + t } });
  const media = () => fetch(`https://www.googleapis.com/drive/v3/files/${id}?alt=media&supportsAllDrives=true`, { headers: { Authorization: 'Bearer ' + t } });
  let mediaP = k ? null : media();                    // keshda yo'q — tanasini darhol (parallel) so'raymiz
  if (mediaP) mediaP.catch(() => {});                  // meta xato bersa — kutilmagan rad etish jarayonni yiqitmasin
  const m = await metaP;
  const meta = await m.json().catch(() => ({}));
  if (m.status === 403 || m.status === 404) { throw new RuxsatYoq('Robot bu faylni ko\'ra olmaydi (' + m.status + '): ' + ((meta.error && meta.error.message) || '').slice(0, 160)); }
  if (meta.error) throw new Error('Drive xato ' + meta.error.code + ': ' + meta.error.message);
  if (k && k.mt === meta.modifiedTime) {
    try { return { nom: meta.name, mime: meta.mimeType, bytes: fs.readFileSync(ky + '.bin') }; } catch (e) { }
  }
  if (!mediaP) mediaP = media();
  const r = await mediaP;
  if (!r.ok) throw new Error('Drive fayl yuklanmadi: ' + r.status);
  const bytes = Buffer.from(await r.arrayBuffer());
  if (bytes.length <= DRIVE_KESH_MAX) {
    try { fs.mkdirSync(path.dirname(ky), { recursive: true }); fs.writeFileSync(ky + '.bin', bytes); fs.writeFileSync(ky + '.json', JSON.stringify({ mt: meta.modifiedTime, nom: meta.name, mime: meta.mimeType })); } catch (e) { }
  }
  return { nom: meta.name, mime: meta.mimeType, bytes };
}

module.exports = { token, varaqlar, qiymatlar, qiymatlarBir, qatorOqi, ustunOqi, oraliqOqi, yoz, qatorQosh, qatorQoshR, sanaFormat, sanaYoz, gid, soralar, kataklarOqi, driveFayl, RuxsatYoq };
