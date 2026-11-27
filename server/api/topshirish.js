// AKS TIZIM — 📄 topshirishPdf(kod, no, sana?, xodim?) — ijara boshida DO'KONNI QABUL QILISH-TOPSHIRISH DALOLATNOMASI (27.11.2026, direktor).
// Index: ijara saqlangach «📄 Topshirish dalolatnomasi» tugmasi va shartnoma kartasidagi tugma. Ruxsat: shartnoma. Bazaga yozmaydi.
// Ma'lumot — lib/kb_hujjat.js kbTekshir (tekshirma: holati/skan tekshirilmaydi — shartnoma endigina tuzilgan bo'ladi), hujjat — lib/topshirish_hujjat.js.
// PDF /opt/aks/hujjat/topshirish/ ga ham yoziladi (shartnoma PDF lari kabi). Muhr yo'q — qo'lda bosiladi. Sana berilmasa — bugun.
'use strict';
const S = require('./sessiya');
const KB = require('../lib/kb_hujjat');
const TH = require('../lib/topshirish_hujjat');
const fs = require('fs');
const path = require('path');

const s = v => String(v == null ? '' : v);
const PAPKA = '/opt/aks/hujjat/topshirish';

async function topshirishPdf(args) {
  const [kodSes, no0, sana0, xodim0] = args;
  const u = await S.ruxsat(kodSes, 'shartnoma');
  const no = s(no0).trim().toUpperCase();
  if (!/^IJ-27\/\d+$/.test(no)) throw new S.Xato('Dalolatnoma faqat ijara shartnomasi (IJ-27/…) uchun: ' + no);
  let x; try { x = await KB.kbTekshir(no, null, null, { tekshirma: true }); } catch (e) { throw new S.Xato(e.message); }
  if (/bekor|yakun/i.test(s(x.holati))) throw new S.Xato(no + ' holati «' + x.holati + '» — bekor qilingan shartnomaga topshirish dalolatnomasi tuzilmaydi.');
  const sana = /^\d{4}-\d{2}-\d{2}$/.test(s(sana0)) ? s(sana0) : KB.bugunIso(0);
  const xodim = s(xodim0).trim() ? KB.kbKir(s(xodim0).trim()) : (u.admin ? '' : KB.kbKir(u.fish));   // xodim tuzsa — ishtirokchi sifatida yoziladi
  const h = await TH.topshirishHujjat(x, { sana, xodim });
  const nom = 'Topshirish_' + no.replace('/', '-') + '_' + KB.kbFam(x.fish) + '_' + x.dokon + '.pdf';
  try { fs.mkdirSync(PAPKA, { recursive: true }); fs.writeFileSync(path.join(PAPKA, nom), h.pdf); } catch (e) { console.error('topshirishPdf (disk):', e.message); }
  return { ok: true, no, nom, b64: h.pdf.toString('base64'), bet: h.bet, sana, ogoh: x.ogoh || [], bosh: x.bosh || '' };
}

module.exports = { topshirishPdf };
