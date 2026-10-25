// AKS TIZIM — xodimni topish va sessiya (Pin.gs / Kod.gs mantig'i serverda).
// Sessiya: «kod|tok». tok — Redis'da 15 daqiqa, har amalda uzayadi (eski tizimdagidek).
'use strict';
const crypto = require('crypto');
const { q, redis } = require('../lib/db');

const SESSIYA_SEK = 900;              // 15 daqiqa (PIN_SESSIYA_SEK)
const XATO_MAX = 5, BLOK_DAQ = 15;    // 5 xato → 15 daqiqa blok

class Xato extends Error { }

// 07_Xodimlar dagi xodim — kirish kodi bo'yicha (Kod.gs foydalanuvchiKod_ + Pin.gs pinXodim_)
// 25.10 (direktor ko'rsatmasi): kod QO'LDA terilganda telefon klaviaturasi uni buzadi — birinchi harfni bosh harf qiladi,
// oxiriga bo'sh joy qo'shadi, yoki odam chiziqcha qo'yadi. Shuning uchun aniq mos kelmasa — belgilarsiz va katta-kichik
// harf farqisiz qaraladi. Agar shunda IKKI xodimga mos kelsa — kirish berilmaydi. Qaytarilgan kod — jadvaldagi haqiqiy kod.
const kodNorm = v => String(v == null ? '' : v).replace(/[^A-Za-z0-9]/g, '').toLowerCase();
const XOD_USTUN = `xodim_id, fish, lavozim, tel_raqam, holat, huquqlar, pin_iz, telegram_id, qator_no, kirish_kodi`;
async function xodimKod(kod) {
  kod = String(kod || '').trim();
  if (kod.length < 8) return null;
  let r = await q(`SELECT ${XOD_USTUN} FROM v_xodimlar WHERE kirish_kodi = $1 LIMIT 1`, [kod]);
  if (!r.rows[0]) {
    const n = kodNorm(kod);
    if (n.length < 8) return null;
    r = await q(`SELECT ${XOD_USTUN} FROM v_xodimlar
                 WHERE lower(regexp_replace(kirish_kodi, '[^A-Za-z0-9]', '', 'g')) = $1 LIMIT 2`, [n]);
    if (r.rows.length !== 1) return null;
  }
  const x = r.rows[0];
  if (!x || x.holat !== 'Ishlayapti' || !x.huquqlar || !x.huquqlar.length) return null;
  return {
    kod: String(x.kirish_kodi || '').trim(), id: x.xodim_id, fish: x.fish, ism: x.fish.split(/\s+/)[1] || x.fish, lavozim: x.lavozim,
    tel: x.tel_raqam.length === 12 && x.tel_raqam.startsWith('998') ? x.tel_raqam.slice(3) : x.tel_raqam,
    huquq: x.huquqlar, admin: x.huquqlar.includes('admin'), pin: x.pin_iz, tg: x.telegram_id, qator: x.qator_no,
  };
}

// «kod|tok» → xodim (Pin.gs foydalanuvchi_). Sessiya tirik bo'lsa uzayadi.
async function foydalanuvchi(kodSes) {
  const s = String(kodSes || ''); const i = s.indexOf('|');
  if (i < 8) return null;
  const kod = s.slice(0, i), tok = s.slice(i + 1);
  if (!/^[0-9a-f]{32}$/.test(tok)) return null;
  const saqlangan = await redis.get('ses:' + tok);
  if (saqlangan !== kod) return null;
  await redis.expire('ses:' + tok, SESSIYA_SEK);
  return xodimKod(kod);
}

async function ruxsat(kodSes, kerak) {
  const u = await foydalanuvchi(kodSes);
  if (!u) throw new Xato('Sessiya tugagan — parolingizni qayta kiriting.');
  if (kerak && !(u.admin || u.huquq.includes(kerak))) throw new Xato('Bu bo\'limga ruxsatingiz yo\'q.');
  return u;
}

async function sessiyaOch(kod) {
  const tok = crypto.randomBytes(16).toString('hex');
  await redis.set('ses:' + tok, kod, 'EX', SESSIYA_SEK);
  return tok;
}

// PIN izi: «tuz:sha256(tuz|kod|pin)» — Pin.gs pinIz_ bilan bir xil, shuning uchun xodimlarning hozirgi PIN'lari ishlayveradi
function pinIz(tuz, kod, pin) { return crypto.createHash('sha256').update(tuz + '|' + kod + '|' + pin).digest('hex'); }
function pinTekshir(saqlangan, kod, pin) {
  const i = String(saqlangan || '').indexOf(':'); if (i < 0) return false;
  const kutilgan = saqlangan.slice(i + 1), bor = pinIz(saqlangan.slice(0, i), kod, pin);
  return kutilgan.length === bor.length && crypto.timingSafeEqual(Buffer.from(kutilgan), Buffer.from(bor));
}

async function blokDaq(kod) {
  const ttl = await redis.ttl('pinblok:' + kod);
  return ttl > 0 ? Math.ceil(ttl / 60) : 0;
}
async function xatoYoz(kod) {
  const n = await redis.incr('pinx:' + kod);
  await redis.expire('pinx:' + kod, BLOK_DAQ * 60);
  if (n >= XATO_MAX) {
    await redis.set('pinblok:' + kod, '1', 'EX', BLOK_DAQ * 60);
    await redis.del('pinx:' + kod);
    return { blok: true, qoldi: 0 };
  }
  return { blok: false, qoldi: XATO_MAX - n };
}
async function xatoToza(kod) { await redis.del('pinx:' + kod, 'pinblok:' + kod); }

const telYashir = d => d.length === 9 ? d.slice(0, 2) + ' *** ** ' + d.slice(7) : '';

module.exports = { Xato, kodNorm, xodimKod, foydalanuvchi, ruxsat, sessiyaOch, pinIz, pinTekshir, blokDaq, xatoYoz, xatoToza, telYashir, SESSIYA_SEK, XATO_MAX, BLOK_DAQ };
