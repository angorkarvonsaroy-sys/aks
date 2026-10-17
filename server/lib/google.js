// AKS TIZIM — Google Sheets'dan o'qish (robot hisob, faqat o'qish huquqi). Tashqi kutubxonasiz: Node crypto + fetch.
'use strict';
const crypto = require('crypto');
const fs = require('fs');

const SCOPE = 'https://www.googleapis.com/auth/spreadsheets.readonly';
let kesh = { token: '', tugaydi: 0 };

function b64(o) { return Buffer.from(typeof o === 'string' ? o : JSON.stringify(o)).toString('base64url'); }

async function token(kalitFayl) {
  const hozir = Math.floor(Date.now() / 1000);
  if (kesh.token && kesh.tugaydi - 120 > hozir) return kesh.token;
  const k = JSON.parse(fs.readFileSync(kalitFayl, 'utf8'));
  const bosh = b64({ alg: 'RS256', typ: 'JWT' }) + '.' +
    b64({ iss: k.client_email, scope: SCOPE, aud: 'https://oauth2.googleapis.com/token', iat: hozir, exp: hozir + 3600 });
  const imzo = crypto.createSign('RSA-SHA256').update(bosh).sign(k.private_key).toString('base64url');
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: bosh + '.' + imzo }),
  });
  const j = await r.json();
  if (!j.access_token) throw new Error('Google token olinmadi: ' + JSON.stringify(j));
  kesh = { token: j.access_token, tugaydi: hozir + (j.expires_in || 3600) };
  return kesh.token;
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

module.exports = { token, varaqlar, qiymatlar };
