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
const bor = () => { const c = sozlama(); return !!(c.user && c.pass); };

const esc = v => String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const togri = e => /^[^\s@<>()",;:]+@[^\s@<>()",;:]+\.[A-Za-z]{2,}$/.test(String(e || '').trim());
// e-pochtani yashirib ko'rsatish: kamoliddin@gmail.com → k*******n@gmail.com
function yashir(e) {
  const t = String(e || '').trim(), i = t.indexOf('@'); if (i < 1) return '';
  const a = t.slice(0, i);
  return (a.length <= 2 ? a[0] + '*' : a[0] + '*'.repeat(Math.min(a.length - 2, 7)) + a[a.length - 1]) + t.slice(i);
}

let tr = null, trK = '';
// matn — oddiy matn (qatorlar \n). kod — bo'lsa, xatda katta qilib ajratib ko'rsatiladi.
async function yubor(kimga, mavzu, matn, kod) {
  const c = sozlama();
  if (!c.user || !c.pass) throw new Error('Pochta sozlanmagan (GMAIL_USER / GMAIL_APP_PASS)');
  if (!togri(kimga)) throw new Error('E-pochta manzili noto\'g\'ri');
  const k = c.user + '|' + c.pass;
  if (!tr || trK !== k) {
    const nm = require('nodemailer');
    tr = nm.createTransport({ host: 'smtp.gmail.com', port: 465, secure: true, auth: { user: c.user, pass: c.pass },
      connectionTimeout: 15000, greetingTimeout: 15000, socketTimeout: 20000 });
    trK = k;
  }
  let html = esc(matn).replace(/\n/g, '<br>');
  if (kod) html = html.split(esc(kod)).join('<span style="display:inline-block;font-size:24px;font-weight:bold;letter-spacing:3px;background:#F2F4F7;border-radius:8px;padding:6px 14px;color:#0B3D2E">' + esc(kod) + '</span>');
  html = '<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.55;color:#101828;max-width:520px">'
    + '<div style="font-weight:bold;color:#0B3D2E;font-size:17px;margin-bottom:10px">AKS TIZIM · Angor Karvon Saroy</div>' + html
    + '<div style="color:#98A2B3;font-size:12px;margin-top:18px">Bu xat avtomatik yuborildi — javob yozish shart emas.</div></div>';
  await tr.sendMail({ from: '"AKS TIZIM" <' + c.user + '>', to: String(kimga).trim(), subject: mavzu, text: matn, html });
  return true;
}

module.exports = { bor, yubor, togri, yashir, _ichki: { sozlama } };
