// AKS TIZIM — 📡 Telegram botdan yangiliklarni O'QISH (getUpdates, uzun so'rov 25 s) — eski tgTugmaPoll (har daqiqalik trigger) o'rni.
// Ilova serveri (pm2 aks-api, bitta nusxa) ichida: bayroq yozuv_yondi:tg_kirish = 1 bo'lsa uzluksiz; o'chiq bo'lsa 10 soniyada bir tekshiradi, xolos.
// Webhook EMAS — tashqaridan hech qanday eshik ochilmaydi, faqat serverdan chiquvchi so'rov. Offset — Redis tg_offset (har yangilik ishlovdan OLDIN
// belgilanadi: og'ir ish yiqilsa ham takror kelmaydi — eski v2.2 bilan bir xil). Har yangilik → lib/tg_kirish.js ishlov; natija — Redis tg_kirish_jurnal.
// MUHIM: bitta botni ikki joy o'qiy olmaydi — Telegram «Conflict» (409) beradi. Shuning uchun yoqishdan OLDIN Apps Script'da tgTugmaPoll triggeri
// o'chiriladi. Conflict kelsa — 60 s kutib yana (Redis tg_poll:konflikt — aks-tg-kirish ko'rsatadi). Tiriklik: Redis tg_poll:tirik (har aylanishda).
'use strict';
const { redis, q } = require('./db');
const TG = require('./telegram');
const K = require('./tg_kirish');

let yurmoqda = false, toxtash = false, konflikt = 0;
const uxla = ms => new Promise(r => setTimeout(r, ms));

async function birAylanish() {
  const off = Number(await redis.get('tg_offset')) || 0;
  const tana = { timeout: 25, allowed_updates: ['message', 'callback_query'] }; if (off) tana.offset = off;
  let R;
  try { R = await TG.api('getUpdates', tana, null, { jurnalsiz: true, muddat: 40000, urinishsiz: true }); konflikt = 0; }
  catch (e) {
    if (/Conflict/i.test(e.message)) {
      konflikt++;
      await redis.set('tg_poll:konflikt', new Date().toISOString() + ' ' + e.message.slice(0, 200), 'EX', 86400).catch(() => {});
      if (konflikt === 1 || konflikt % 10 === 0) console.error(new Date().toISOString(), 'tg poll: boshqa joy ham getUpdates qilyapti (eski tgTugmaPoll triggeri o\'chirilmaganmi?) —', e.message);
      await uxla(60000); return;
    }
    console.error(new Date().toISOString(), 'tg poll:', e.message); await uxla(15000); return;
  }
  await redis.set('tg_poll:tirik', String(Date.now()), 'EX', 600).catch(() => {});
  for (const z of R || []) {
    await redis.set('tg_offset', String(z.update_id + 1));
    const t0 = Date.now(); let n;
    try { n = await K.ishlov(z); }
    catch (e) { n = { tur: 'xato', natija: e.message }; console.error(new Date().toISOString(), 'tg kirish:', e.message);
      q('INSERT INTO rpc_jurnal (fn, qayerda, ms, ok, xato) VALUES ($1,$2,$3,$4,$5)', ['tg_kirish', 'tg', Date.now() - t0, false, e.message.slice(0, 300)]).catch(() => {}); }
    await K.jurnal(Object.assign({ ms: Date.now() - t0 }, n || {}));
  }
}
async function sikl() {
  while (!toxtash) {
    try { if (!(await K.yoqilgan())) { await uxla(10000); continue; } await birAylanish(); }
    catch (e) { console.error(new Date().toISOString(), 'tg poll sikl:', e.message); await uxla(15000); }
  }
}
function boshla() { if (yurmoqda) return; yurmoqda = true; sikl().catch(e => console.error('tg poll:', e.message)); }
function toxta() { toxtash = true; }
async function holat() {
  const [tirik, off, kon, yoq] = await Promise.all([redis.get('tg_poll:tirik'), redis.get('tg_offset'), redis.get('tg_poll:konflikt'), K.yoqilgan()]);
  return { yoq, tirik: tirik ? Number(tirik) : 0, offset: Number(off) || 0, konflikt: kon || '' };
}
module.exports = { boshla, toxta, holat, birAylanish };
