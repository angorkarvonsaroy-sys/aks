// AKS TIZIM — eski tizimga (Apps Script) ko'prik. Serverda hali yozilmagan amallar shu orqali eski kodda bajariladi.
// Server tomonida: BRIDGE_URL (…/exec) va BRIDGE_SECRET (.env). Apps Script tomonida: Koprik.gs (doPost) + Script Properties BRIDGE_SECRET.
//
// Google bir vaqtda ko'p so'rov kelsa (bosh sahifa 15+ bo'limni birdan so'raydi) JSON o'rniga xato SAHIFASI (HTML, 200/404)
// qaytaradi. Shuning uchun: (1) Google'ga bir vaqtda ko'pi bilan NAVBAT ta so'rov boradi, qolganlari kutadi;
// (2) HTML/404/429/5xx kelsa so'rov 2 marta qayta uriniladi; (3) har urinish 70 soniyadan oshsa uziladi.
'use strict';
const env = require('../lib/env');

const NAVBAT = 4;            // Google'ga bir vaqtda ketadigan so'rovlar soni
const URINISH = 3;           // jami urinishlar
const MUDDAT_MS = 70000;     // bitta urinish uchun

let band = 0;
const kutayotganlar = [];
function joyOl() { return new Promise(res => { if (band < NAVBAT) { band++; res(); } else kutayotganlar.push(res); }); }
function joyBer() { const k = kutayotganlar.shift(); if (k) k(); else band--; }

function bor() { return !!(env.bridgeUrl && env.bridgeSecret); }

class Vaqtinchalik extends Error {}   // qayta urinsa bo'ladigan xato

async function birUrinish(tana) {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), MUDDAT_MS);
  let r, matn;
  try {
    r = await fetch(env.bridgeUrl, {
      method: 'POST', redirect: 'follow', signal: ac.signal,
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },   // Apps Script: preflight bo'lmasin
      body: tana,
    });
    matn = await r.text();
  } catch (e) {
    throw new Vaqtinchalik(e.name === 'AbortError' ? 'Eski tizim ' + (MUDDAT_MS / 1000) + ' soniyada javob bermadi' : 'Eski tizimga ulanib bo\'lmadi: ' + e.message);
  } finally { clearTimeout(t); }
  let j;
  try { j = JSON.parse(matn); } catch (e) { j = null; }
  if (!j || typeof j !== 'object') {
    const qisqa = matn.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 160);
    throw new Vaqtinchalik('Eski tizim javobi tushunarsiz (' + r.status + '): ' + qisqa);
  }
  if (!j.ok) throw new Error(j.xato || 'Eski tizimda xato');
  return j.r;
}

// fn — eski tizimdagi funksiya nomi; kod — xodimning kirish kodi (sessiyasiz); args — qolgan argumentlar
async function chaqir(fn, kod, args) {
  if (!bor()) throw new Error('Bu amal («' + fn + '») hali serverga ko\'chirilmagan, eski tizim ko\'prigi esa sozlanmagan.');
  const tana = JSON.stringify({ s: env.bridgeSecret, fn, kod, args: args || [] });
  await joyOl();
  try {
    let oxirgi;
    for (let i = 1; i <= URINISH; i++) {
      try { return await birUrinish(tana); }
      catch (e) {
        if (!(e instanceof Vaqtinchalik)) throw e;
        oxirgi = e;
        if (i < URINISH) await new Promise(r => setTimeout(r, 1500 * i));
      }
    }
    throw new Error(oxirgi.message + ' (' + URINISH + ' urinishdan keyin)');
  } finally { joyBer(); }
}

function holat() { return { band, navbatda: kutayotganlar.length, navbat: NAVBAT }; }

module.exports = { bor, chaqir, holat };
