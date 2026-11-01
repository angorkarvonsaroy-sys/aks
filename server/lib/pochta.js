// AKS TIZIM — ✉ elektron pochta (Gmail) orqali xat yuborish (direktor qarori 01.11.2026: SMS pullik, Gmail tekin).
// Xatlar angorkarvonsaroy@gmail.com dan Gmail SMTP orqali ketadi. Sozlama — /opt/aks/.env:
//   GMAIL_USER=angorkarvonsaroy@gmail.com
//   GMAIL_APP_PASS=<Google'dagi 16 belgili «ilova paroli» — oddiy parol EMAS>
// Sozlama har xat oldidan fayldan qayta o'qiladi — .env ga yozilgach serverni qayta yoqish shart emas.
// Sozlanmagan bo'lsa bor() = false: ilova Gmail bandlarini ko'rsatmaydi, parol tiklash faqat Telegram orqali ketadi.
'use strict';
const fs = require('fs');

const ENV = process.env.AKS_ENV || '/opt/aks/.env';
function sozlama() {
  let m = ''; try { m = fs.readFileSync(ENV, 'utf8'); } catch (e) { }
  const ol = k => {
    const r = new RegExp('^\\s*' + k + '\\s*=\\s*(.*?)\\s*$', 'm').exec(m);
    let v = r ? r[1] : (process.env[k] || '');
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    return v;
  };
  return { user: ol('GMAIL_USER').trim(), pass: ol('GMAIL_APP_PASS').replace(/\s+/g, '') };
}
// 01.11 (2): Serverspace 465/587 portlarini yopgan — xat birinchi navbatda KOPRIK orqali (Apps Script MailApp, direktor hisobi,
// tekin, kuniga ~100 ta) ketadi; SMTP (GMAIL_USER/GMAIL_APP_PASS) — faqat zaxira yo'l (port ochilsa ishlaydi).
const smtpBor = () => { const c = sozlama(); return !!(c.user && c.pass); };
const koprikBor = () => { try { const e = require('./env'); return !!(e.bridgeUrl && e.bridgeSecret); } catch (x) { return false; } };
const bor = () => koprikBor() || smtpBor();
async function adminKod() {
  const r = await require('./db').q(`SELECT kirish_kodi FROM v_xodimlar WHERE kompaniya_id = 1 AND holat = 'Ishlayapti' AND 'admin' = ANY(huquqlar) AND length(kirish_kodi) >= 8 ORDER BY qator_no LIMIT 1`);
  if (!r.rows[0]) throw new Error('Direktor kirish kodi topilmadi');
  return r.rows[0].kirish_kodi;
}

const esc = v => String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const togri = e => /^[^\s@<>()",;:]+@[^\s@<>()",;:]+\.[A-Za-z]{2,}$/.test(String(e || '').trim());
// e-pochtani yashirib ko'rsatish: kamoliddin@gmail.com → k*******n@gmail.com
function yashir(e) {
  const t = String(e || '').trim(), i = t.indexOf('@'); if (i < 1) return '';
  const a = t.slice(0, i);
  return (a.length <= 2 ? a[0] + '*' : a[0] + '*'.repeat(Math.min(a.length - 2, 7)) + a[a.length - 1]) + t.slice(i);
}

// 01.11: serverdan Gmail'ga ulanish «Connection timeout» berdi. Ikki ehtimol: (1) smtp.gmail.com ning IPv6 manziliga ulanmoqchi
// bo'ladi, serverda IPv6 yo'li yo'q; (2) provayder 465-portni yopgan. Shuning uchun: faqat IPv4 manzil, avval 465 (SSL),
// bo'lmasa 587 (STARTTLS). Qaysi biri ishlasa — o'shanisi eslab qolinadi.
const dns = require('dns').promises;
let tr = null, trK = '';
async function yollar(c) {
  let ip = 'smtp.gmail.com';
  try { const a = await dns.resolve4('smtp.gmail.com'); if (a && a.length) ip = a[0]; } catch (e) { }
  const nm = require('nodemailer'), umumiy = { auth: { user: c.user, pass: c.pass }, tls: { servername: 'smtp.gmail.com' },
    connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 20000 };
  return [
    { nom: ip + ':465', t: nm.createTransport(Object.assign({ host: ip, port: 465, secure: true }, umumiy)) },
    { nom: ip + ':587', t: nm.createTransport(Object.assign({ host: ip, port: 587, secure: false, requireTLS: true }, umumiy)) },
  ];
}
async function jonat(c, xat) {
  const k = c.user + '|' + c.pass;
  if (tr && trK === k) { try { return await tr.t.sendMail(xat); } catch (e) { tr = null; } }
  let oxirgi = null;
  for (const y of await yollar(c)) {
    try { const r = await y.t.sendMail(xat); tr = y; trK = k; return r; }
    catch (e) { oxirgi = e; console.error('pochta ' + y.nom + ':', e.message); if (/auth|535|534|Username and Password/i.test(e.message)) break; }
  }
  throw oxirgi || new Error('Pochta yuborilmadi');
}
// matn — oddiy matn (qatorlar \n). kod — bo'lsa, xatda katta qilib ajratib ko'rsatiladi.
async function yubor(kimga, mavzu, matn, kod) {
  if (!bor()) throw new Error('Pochta sozlanmagan');
  if (!togri(kimga)) throw new Error('E-pochta manzili noto\'g\'ri');
  let html = esc(matn).replace(/\n/g, '<br>');
  if (kod) html = html.split(esc(kod)).join('<span style="display:inline-block;font-size:24px;font-weight:bold;letter-spacing:3px;background:#F2F4F7;border-radius:8px;padding:6px 14px;color:#0B3D2E">' + esc(kod) + '</span>');
  html = '<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.55;color:#101828;max-width:520px">'
    + '<div style="font-weight:bold;color:#0B3D2E;font-size:17px;margin-bottom:10px">AKS TIZIM · Angor Karvon Saroy</div>' + html
    + '<div style="color:#98A2B3;font-size:12px;margin-top:18px">Bu xat avtomatik yuborildi — javob yozish shart emas.</div></div>';
  let xatoK = null;
  if (koprikBor()) {
    try {
      await require('../api/koprik').chaqir('koprikPochta', await adminKod(), [{ kimga: String(kimga).trim(), mavzu, matn, html }], { urinish: 1, muddat: 60000 });
      return true;
    } catch (e) { xatoK = e; console.error('pochta (Koprik):', e.message); }
  }
  const c = sozlama();
  if (c.user && c.pass) { await jonat(c, { from: '"AKS TIZIM" <' + c.user + '>', to: String(kimga).trim(), subject: mavzu, text: matn, html }); return true; }
  throw xatoK || new Error('Pochta sozlanmagan');
}

module.exports = { bor, yubor, togri, yashir, _ichki: { sozlama, yollar, koprikBor, smtpBor } };
