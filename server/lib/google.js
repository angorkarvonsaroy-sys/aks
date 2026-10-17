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
  const seriya = iso => { const [y, m, d] = iso.split('-').map(Number); return Math.round((Date.UTC(y, m - 1, d) - Date.UTC(1899, 11, 30)) / 86400000); };
  const requests = kataklar.map(c => ({ updateCells: { range: { sheetId: gidKesh[sheetId][c.varaq], startRowIndex: c.qator - 1, endRowIndex: c.qator, startColumnIndex: c.ustun - 1, endColumnIndex: c.ustun },
    rows: [{ values: [{ userEnteredValue: { numberValue: seriya(c.iso) }, userEnteredFormat: { numberFormat: { type: 'DATE', pattern: naqsh } } }] }],
    fields: 'userEnteredValue,userEnteredFormat.numberFormat' } }));
  return yuborYoz(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}:batchUpdate`, 'POST', { requests }, kalitFayl);
}

// ------------------------------------------------------------------ DRIVE (faqat o'qish): fayl nomi + tanasi (Buffer)
async function driveFayl(faylId, kalitFayl) {
  const t = await token(kalitFayl, SCOPE_DRIVE);
  const id = encodeURIComponent(String(faylId || '').trim());
  const m = await fetch(`https://www.googleapis.com/drive/v3/files/${id}?fields=name,size,mimeType&supportsAllDrives=true`, { headers: { Authorization: 'Bearer ' + t } });
  if (m.status === 403 || m.status === 404) throw new RuxsatYoq('Robot bu faylni ko\'ra olmaydi (' + m.status + ')');
  const meta = await m.json();
  if (meta.error) throw new Error('Drive xato ' + meta.error.code + ': ' + meta.error.message);
  const r = await fetch(`https://www.googleapis.com/drive/v3/files/${id}?alt=media&supportsAllDrives=true`, { headers: { Authorization: 'Bearer ' + t } });
  if (!r.ok) throw new Error('Drive fayl yuklanmadi: ' + r.status);
  return { nom: meta.name, mime: meta.mimeType, bytes: Buffer.from(await r.arrayBuffer()) };
}

module.exports = { token, varaqlar, qiymatlar, qiymatlarBir, qatorOqi, ustunOqi, yoz, qatorQosh, sanaFormat, sanaYoz, driveFayl, RuxsatYoq };
