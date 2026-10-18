// AKS TIZIM — HTML → PDF serverda. Eski tizim (Utilities.newBlob(html,'text/html').getAs('application/pdf')) PDF'ni Google'ning
// Chromium'ida yasaydi (fayl ichida: Creator «Chromium», Producer «Skia/PDF»; A4 = 594,96 × 841,92 pt, chekkalar 0,5 dyuym —
// 18.10 da eski PDF bilan o'lchab tekshirildi). Shuning uchun bu yerda ham o'sha dvigatel: Chromium (playwright-core,
// chromium-headless-shell; deploy.sh o'rnatadi → /opt/aks/pw). Natija eski tizimnikidek: bir xil sahifa, bir xil joylashuv.
// Brauzer birinchi so'rovda ochiladi va 3 daqiqa ishlatilmasa yopiladi (xotira bo'shaydi).
'use strict';
if (!process.env.PLAYWRIGHT_BROWSERS_PATH) process.env.PLAYWRIGHT_BROWSERS_PATH = '/opt/aks/pw';
let pw = null;
try { pw = require('playwright-core'); } catch (e) { pw = null; }

// Shrift: Liberation Serif (fonts-liberation 2.1.5 — «қ ғ ҳ» ham bor; Google'dagi eski versiyada yo'q, u Times New Roman'dan oladi —
// ikkalasining o'lchami bir xil, joylashuvga ta'sir qilmaydi).
const BOSH_TURISH_MS = 180000, MUDDAT_MS = 60000;
let brP = null, faol = 0, oxirgi = 0, yoqHolat = null, yoqVaqt = 0;

function brauzer() {
  if (brP) return brP;
  brP = pw.chromium.launch({ headless: true })
    .then(b => { b.on('disconnected', () => { brP = null; }); return b; })
    .catch(e => { brP = null; throw e; });
  return brP;
}
setInterval(() => {   // ishlatilmayotgan brauzerni yopish
  if (brP && !faol && Date.now() - oxirgi > BOSH_TURISH_MS) { const p = brP; brP = null; p.then(b => b.close()).catch(() => {}); }
}, 30000).unref();

// Chromium ishga tushadimi (natija 10 daqiqa, «yo'q» bo'lsa 1 daqiqa eslab qolinadi)
async function bor() {
  if (yoqHolat !== null && Date.now() - yoqVaqt < (yoqHolat ? 600000 : 60000)) return yoqHolat;
  let ok = false;
  if (pw) { try { await brauzer(); ok = true; oxirgi = Date.now(); } catch (e) { console.error('PDF (Chromium) ishga tushmadi:', e.message.split('\n')[0]); } }
  yoqHolat = ok; yoqVaqt = Date.now(); return ok;
}

// css: qo'shimcha qoidalar (masalan '@page{size:A4;margin:0.5in}') — HTML'ning <style> boshiga qo'shiladi;
// opt: page.pdf ga qo'shimcha (masalan { scale: 0.125 } — xat_pdf.js: Chromium qatorlarni butun px ga yaxlitlamasligi uchun);
//      opt.skript — PDF dan oldin sahifada bajariladigan JS (print media'da), masalan xat_pdf.js TEKISLA
async function yasa(html, css, opt) {
  if (!pw) throw new Error('PDF dasturi (playwright-core) o\'rnatilmagan');
  if (css) html = html.replace('<style>', '<style>' + css);
  faol++;
  let ctx = null, t = null;
  try {
    const b = await brauzer();
    ctx = await b.newContext();
    const ish = (async () => {
      const p = await ctx.newPage();
      await p.setContent(html, { waitUntil: 'load', timeout: MUDDAT_MS });
      const { skript, ...pdfOpt } = opt || {};
      if (skript) { await p.emulateMedia({ media: 'print' }); await p.evaluate(skript); }   // chop etish o'lchamida joylashuvni tuzatish
      return p.pdf(Object.assign({ preferCSSPageSize: true, printBackground: false }, pdfOpt));
    })();
    const buf = await Promise.race([ish, new Promise((_, rej) => { t = setTimeout(() => rej(new Error('PDF yasash ' + MUDDAT_MS / 1000 + ' soniyadan oshdi')), MUDDAT_MS); })]);
    return Buffer.from(buf);
  } finally {
    clearTimeout(t); faol--; oxirgi = Date.now();
    if (ctx) ctx.close().catch(() => {});
  }
}

module.exports = { bor, yasa };
