// AKS TIZIM — eski tizimga (Apps Script) ko'prik. Serverda hali yozilmagan amallar shu orqali eski kodda bajariladi.
// Server tomonida: BRIDGE_URL (…/exec) va BRIDGE_SECRET (.env). Apps Script tomonida: Koprik.gs (doPost) + Script Properties BRIDGE_SECRET.
'use strict';
const env = require('../lib/env');

function bor() { return !!(env.bridgeUrl && env.bridgeSecret); }

// fn — eski tizimdagi funksiya nomi; kod — xodimning kirish kodi (sessiyasiz); args — qolgan argumentlar
async function chaqir(fn, kod, args) {
  if (!bor()) throw new Error('Bu amal («' + fn + '») hali serverga ko\'chirilmagan, eski tizim ko\'prigi esa sozlanmagan.');
  const r = await fetch(env.bridgeUrl, {
    method: 'POST',
    redirect: 'follow',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },   // Apps Script: preflight bo'lmasin
    body: JSON.stringify({ s: env.bridgeSecret, fn, kod, args: args || [] }),
  });
  const matn = await r.text();
  let j;
  try { j = JSON.parse(matn); } catch (e) { throw new Error('Eski tizim javobi tushunarsiz (' + r.status + '): ' + matn.slice(0, 200)); }
  if (!j.ok) throw new Error(j.xato || 'Eski tizimda xato');
  return j.r;
}

module.exports = { bor, chaqir };
