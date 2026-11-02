// AKS TIZIM — 🗄 ARXIV: server fayllarni direktor Drive'idagi «AKS TIZIM / AKS ARXIV» papkasiga O'ZI yuklaydi (02.11.2026, direktor qarori — 4-variant).
// Ilgari bu ishni eski tizim (Koprik: koprikDriveSaqla, koprikXatSaqla, …) qilardi. Endi: rclone, direktor hisobi (angorkarvonsaroy@gmail.com),
// ruxsat — faqat o'zi yaratgan fayllar (drive.file): server Drive'dagi boshqa fayllarni ko'rmaydi. Robotga «Редактор» berilmaydi.
// Papka «AKS TIZIM» ichida — robot (o'qish huquqi) yangi fayllarni ham o'qiy oladi (Telegram'ga yuborish, ko'rish).
// Yoqilishi: yozuv_yondi:arxiv (02.11.2026 07:15 sinovdan o'tib yoqildi, standart — yoniq) va /opt/aks/rclone.conf.
// Favqulodda o'chirish: aks-bayroq ochir arxiv — hammasi avvalgidek eski tizim orqali.
//   chaqir(fn, kod, args, opt) — koprik.chaqir bilan bir xil chaqiruv va javob shakli (Koprik v1.20 dagi Drive yordamchilari);
//   eski tizim yaratgan fayllarga (bu arxivda yo'q) — avvalgidek eski tizim orqali tegiladi (ko'prik bor ekan).
//   zaxira() — AKS_BAZA nusxasi (xlsx) «99 ZAXIRA» ga, 30 kun; nusxa() — serverdagi barcha fayllar «SERVER NUSXA» ga (har kecha).
'use strict';
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const env = require('./env');
const BQ = require('./bayroq');
const { q, redis } = require('./db');

const RCONF = env.rcloneKonf || '/opt/aks/rclone.conf';
const REM = 'aksarxiv:';
const ILDIZ = env.hujjatPapka || '/opt/aks/hujjat';
const MAHALLIY = path.join(ILDIZ, '_arxiv');       // serverda saqlanmaydigan fayllarning (isbot, devon, ta'minot) server nusxasi
const s = v => String(v == null ? '' : v);
const seg = v => s(v).replace(/[\/\\]/g, '_').replace(/[\x00-\x1f]/g, '').trim().slice(0, 200) || '_';
const toshkentYil = () => new Date(Date.now() + 5 * 3600e3).toISOString().slice(0, 4);
const yilOl = v => { const y = s(v).replace(/\D/g, '').slice(0, 4); return y.length === 4 ? y : toshkentYil(); };
const url = id => 'https://drive.google.com/file/d/' + id + '/view?usp=drivesdk';
const bayt = b64 => Buffer.from(s(b64), 'base64');

async function yoniq() { return (await BQ.yozuv('arxiv')) && fs.existsSync(RCONF); }
// ko'prik guard'lari o'rniga: arxiv yoniq yoki eski tizim ko'prigi sozlangan
async function bor() { return (await yoniq()) || require('../api/koprik').bor(); }

// ------------------------------------------------------------------ rclone
const SINOV = { rclone: null };   // sinovda almashtiriladi: (args, kirish) → Promise<string>
function rc(args, opt = {}) {
  if (SINOV.rclone) return SINOV.rclone(args, opt.kirish);
  return new Promise((ok, yoq) => {
    const p = spawn('rclone', ['--config', RCONF, '--drive-root-folder-id', env.arxivPapka, '--retries', '2', '--low-level-retries', '5'].concat(args), { stdio: ['pipe', 'pipe', 'pipe'] });
    const out = []; let err = '';
    const t = setTimeout(() => p.kill('SIGKILL'), opt.ms || 120000);
    p.stdout.on('data', d => out.push(d));
    p.stderr.on('data', d => { err += d; if (err.length > 20000) err = err.slice(-20000); });
    p.on('error', e => { clearTimeout(t); yoq(e); });
    p.on('close', kod => {
      clearTimeout(t);
      if (kod === 0) return ok(Buffer.concat(out).toString('utf8'));
      const e = new Error('rclone ' + args[0] + ' (' + kod + '): ' + err.trim().split('\n').slice(-2).join(' ').slice(0, 300));
      e.kod = kod; e.stderr = err; yoq(e);
    });
    p.stdin.on('error', () => {});
    p.stdin.end(opt.kirish || undefined);
  });
}
const topilmadi = e => e && (e.kod === 3 || e.kod === 4 || /not found/i.test(s(e.stderr) + s(e.message)));
async function stat(yol) {
  try { const j = JSON.parse(await rc(['lsjson', '--stat', REM + yol])); return j && j.ID ? j : null; }
  catch (e) { if (topilmadi(e)) return null; throw e; }
}
function jurnal(fn, ms, ok, xato) {   // promis qaytaradi — buyruq qatoridan (aks-arxiv) chaqirilganda kutiladi, ilovada kutilmaydi
  try { return q('INSERT INTO rpc_jurnal (fn, qayerda, ms, ok, xato) VALUES ($1, $2, $3, $4, $5)', [s(fn).slice(0, 80), 'arxiv', ms, ok, xato ? s(xato).slice(0, 300) : null]).catch(() => {}); } catch (e) { return Promise.resolve(); }
}

// ------------------------------------------------------------------ asosiy amallar
async function yozJ(id, yol, hajm) {
  await q(`INSERT INTO arxiv_fayllar (id, yol, hajm) VALUES ($1, $2, $3)
    ON CONFLICT (id) DO UPDATE SET yol = EXCLUDED.yol, hajm = EXCLUDED.hajm, savatda = false, yangilandi = now()`, [id, yol, Number(hajm) || null]);
}
async function meniki(id) { return id ? ((await q('SELECT id, yol, asl_yol, savatda FROM arxiv_fayllar WHERE id = $1', [s(id)])).rows[0] || null) : null; }
function mahalliyYoz(yol, b) {
  try { const f = path.join(MAHALLIY, yol); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, b, { mode: 0o640 }); }
  catch (e) { console.error('arxiv: server nusxasi yozilmadi (' + yol + '):', e.message); }
}
// papka — ['06 XATLAR', '2026'], nom — fayl nomi. Shu nomli fayl bor bo'lsa (opt.yangi bo'lmasa) — o'shasi qaytadi (qayta urinishda ikkinchi nusxa bo'lmasin).
async function saqla(papka, nom, b, opt = {}) {
  const yol = papka.map(seg).concat(seg(nom)).join('/');
  if (!opt.yangi) { const z = await stat(yol); if (z) { await yozJ(z.ID, yol, z.Size); return { id: z.ID, bor: true }; } }
  if (opt.mahalliy) mahalliyYoz(yol, b);
  await rc(['rcat', REM + yol], { kirish: b, ms: 300000 });
  const f = await stat(yol);
  if (!f) throw new Error('Arxiv: yuklangan fayl topilmadi — ' + yol);
  await yozJ(f.ID, yol, f.Size);
  return { id: f.ID };
}
// arxivdagi faylni savatga (Drive savati — 30 kun tiklash mumkin). ichida — faqat shu papka ichidagi bo'lsa (eski tizimdagidek)
async function savatga(id, ichida) {
  const r = await meniki(id);
  if (!r) return { ok: false, meniki: false };
  if (r.savatda || (ichida && r.yol.indexOf(ichida + '/') !== 0)) return { ok: false, meniki: true };
  const z = await stat(r.yol);
  if (z && z.ID !== r.id) return { ok: false, meniki: true };   // shu yo'lda boshqa fayl — tegilmaydi
  if (z) await rc(['deletefile', REM + r.yol]);
  await q('UPDATE arxiv_fayllar SET savatda = true, yangilandi = now() WHERE id = $1', [r.id]);
  return { ok: true, meniki: true };
}
// boshqa papkaga va/yoki boshqa nom bilan (Drive'da ID o'zgarmaydi). Avvalgi yo'l asl_yol da qoladi (tiklash uchun)
async function kochir(id, papka, nom) {
  const r = await meniki(id);
  if (!r) return { ok: false, meniki: false };
  const yangi = papka.map(seg).concat(seg(nom)).join('/');
  if (r.yol === yangi) return { ok: true, id: r.id };
  const z = await stat(r.yol);
  if (!z || z.ID !== r.id) return { ok: false, meniki: true };
  await rc(['moveto', REM + r.yol, REM + yangi]);
  const f = await stat(yangi);
  await q('UPDATE arxiv_fayllar SET id = $2, yol = $3, asl_yol = coalesce(asl_yol, $4), savatda = false, yangilandi = now() WHERE id = $1', [r.id, f ? f.ID : r.id, yangi, r.yol]);
  return { ok: true, id: f ? f.ID : r.id };
}
async function tikla(id, nom) {
  const r = await meniki(id);
  if (!r) return { ok: false, meniki: false };
  if (!r.asl_yol) return { ok: true, nom: path.posix.basename(r.yol) };
  const asl = nom ? path.posix.dirname(r.asl_yol) + '/' + seg(nom) : r.asl_yol;
  const z = await stat(r.yol);
  if (!z || z.ID !== r.id) return { ok: false, meniki: true };
  await rc(['moveto', REM + r.yol, REM + asl]);
  await q('UPDATE arxiv_fayllar SET yol = $2, asl_yol = NULL, yangilandi = now() WHERE id = $1', [r.id, asl]);
  return { ok: true, nom: path.posix.basename(asl) };
}
// «05 MIJOZ HUJJATLARI / <27-123> <Familiya Ism>» (Hujjat.gs hujjatPapka_ bilan bir xil nom)
const MIJOZ = '05 MIJOZ HUJJATLARI';
let mijozKesh = { t: 0, L: [] };
async function mijozlar(yangila) {
  if (yangila || Date.now() - mijozKesh.t > 300000) {
    let L = [];
    try { L = JSON.parse(await rc(['lsjson', '--dirs-only', REM + MIJOZ])).map(z => z.Name); } catch (e) { if (!topilmadi(e)) throw e; }
    mijozKesh = { t: Date.now(), L };
  }
  return mijozKesh.L;
}
async function mijozPapka(no, fish) {
  const bosh = seg(s(no).replace(/\//g, '-')) + ' ';
  const L = await mijozlar();
  let n = L.find(x => x.indexOf(bosh) === 0 || x === bosh.trim());
  if (!n) {
    const chiroyli = s(fish).toLowerCase().split(/\s+/).filter(Boolean).slice(0, 2).map(z => z.charAt(0).toUpperCase() + z.slice(1)).join(' ');
    n = (bosh + chiroyli).trim(); L.push(n);
  }
  return [MIJOZ, n];
}
// qayta tuzish bekor: yangi raqam uchun ochilgan BO'SH mijoz papkalari (rclone rmdir faqat bo'sh papkani o'chiradi)
async function papkaSavat(yangi) {
  const bosh = seg(s(yangi).replace(/\//g, '-')) + ' ';
  if (bosh.length < 3) return 0;
  let n = 0;
  for (const x of (await mijozlar(true)).filter(z => z.indexOf(bosh) === 0)) {
    try { await rc(['rmdir', REM + MIJOZ + '/' + x]); n++; } catch (e) { }
  }
  if (n) mijozKesh.t = 0;
  return n;
}

// ------------------------------------------------------------------ eski tizim yordamchilari o'rnida (Koprik v1.20 dagi bilan bir xil javob)
async function eskiga(fn, kod, args, opt) {   // eski tizim yaratgan fayl — avvalgidek eski tizim orqali (ko'prik bo'lmasa — tegilmaydi)
  const koprik = require('../api/koprik');
  if (!koprik.bor()) return { ok: false, eski: true };
  return koprik.chaqir(fn, kod, args, opt);
}
const eskiFon = (fn, kod, args) => eskiga(fn, kod, args).catch(e => console.error('arxiv → eski tizim (' + fn + '):', e.message));

const ISH = {
  // v1.3: skan → «05 MIJOZ HUJJATLARI / <shartnoma> <mijoz>». m = { no, fish, nom, b64 } → { id }
  async koprikDriveSaqla(kod, m) {
    m = m || {};
    return saqla(await mijozPapka(m.no, m.fish), s(m.nom), bayt(m.b64));
  },
  // v1.6: «✎ Tuzatish» qilingan skan → «_BEKOR QILINGANLAR», nomi BEKOR_…
  async koprikHujjatBekorFayl(kod, faylId, nom) {
    const r = await kochir(s(faylId), [MIJOZ, '_BEKOR QILINGANLAR'], s(nom));
    if (r.meniki === false) return eskiga('koprikHujjatBekorFayl', kod, [faylId, nom]);
    return { ok: r.ok };
  },
  // v1.18: «↩ Isbotni tiklash» — fayl asl nomi va joyiga
  async koprikFaylTikla(kod, faylId, nom, papka) {
    const r = await tikla(s(faylId), s(nom));
    if (r.meniki === false) return eskiga('koprikFaylTikla', kod, [faylId, nom, papka]);
    return r;
  },
  // v1.8 / v1.11: xat (PDF yoki Word) → «06 XATLAR / <yil>». m = { yil, nom, b64, eski } → { id, url } (faqat eski — { ok })
  async koprikXatSaqla(kod, m) {
    m = m || {};
    if (m.eski) { const e = await savatga(s(m.eski), '06 XATLAR'); if (!e.meniki) eskiFon('koprikXatSaqla', kod, [{ eski: m.eski }]); }
    if (!m.b64) return { ok: true };
    const nom = s(m.nom);
    if (nom.length > 180 || !/^[^\/\\]+\.(pdf|docx)$/.test(nom)) throw new Error('Xat fayli nomi noto\'g\'ri.');
    const r = await saqla(['06 XATLAR', yilOl(m.yil)], nom, bayt(m.b64), { yangi: !!m.eski });
    return { id: r.id, url: url(r.id) };
  },
  // v1.8: topshiriq isboti → «06 TOPSHIRIQ ISBOTLARI». m = { nom, b64 } → { id }
  async koprikIsbotSaqla(kod, m) {
    const nom = s((m || {}).nom);
    if (!/^[\w.\-]+\.pdf$/.test(nom)) throw new Error('Isbot fayli nomi noto\'g\'ri.');
    return saqla(['06 TOPSHIRIQ ISBOTLARI'], nom, bayt(m.b64), { mahalliy: true });
  },
  // v1.9 / v1.10: bekor qilish buyrug'i va xabarnomasi → «07 BEKOR QILISH / <yil>». → { bPdf, bDoc, xPdf, xDoc } (faqat eski — { ok })
  async koprikBekorSaqla(kod, m) {
    m = m || {};
    const eski = (m.eski || []).map(String).filter(Boolean), boshqa = [];
    for (const id of eski) { const e = await savatga(id, '07 BEKOR QILISH'); if (!e.meniki) boshqa.push(id); }
    if (boshqa.length) eskiFon('koprikBekorSaqla', kod, [{ eski: boshqa }]);
    if (!m.bB64) return { ok: true };
    const nomOk = n => /^Bekor_(buyruq|xabarnoma)_[^\/\\]{3,160}$/.test(s(n));
    if (!nomOk(m.bNom) || !nomOk(m.xNom) || !m.xB64) throw new Error('Bekor hujjati nomi noto\'g\'ri.');
    const papka = ['07 BEKOR QILISH', yilOl(m.yil)];
    const bp = await saqla(papka, m.bNom + '.pdf', bayt(m.bB64)), xp = await saqla(papka, m.xNom + '.pdf', bayt(m.xB64));
    const bd = m.bDocB64 ? (await saqla(papka, m.bNom + '.docx', bayt(m.bDocB64))).id : '';
    const xd = m.xDocB64 ? (await saqla(papka, m.xNom + '.docx', bayt(m.xDocB64))).id : '';
    return { bPdf: bp.id, bDoc: bd, xPdf: xp.id, xDoc: xd };
  },
  // v1.12 / v1.15: devonxona → «08 DEVONXONA / <qism> / <yil>». m = { qism, nom (kengaytmasiz), b64, docB64 } → { id, doc }; m.eski → savatga
  async koprikDevonSaqla(kod, m) {
    m = m || {};
    if (m.eski) { const e = await savatga(s(m.eski), '08 DEVONXONA'); if (!e.meniki) await eskiga('koprikDevonSaqla', kod, [{ eski: m.eski }]); return { ok: true }; }
    const qism = s(m.qism), nom = s(m.nom);
    if (!/^(Kirim|Chiqim|Ijro)$/.test(qism) || !nom || nom.length > 200 || /[\/\\]/.test(nom)) throw new Error('Devon fayli nomi noto\'g\'ri.');
    const b = bayt(m.b64);
    if (b.length < 1000) throw new Error('Xat skani bo\'sh.');
    const papka = ['08 DEVONXONA', qism, toshkentYil()];
    const r = { id: (await saqla(papka, nom + '.pdf', b, { mahalliy: true })).id };
    if (m.docB64) r.doc = (await saqla(papka, nom + '.docx', bayt(m.docB64), { mahalliy: true })).id;
    return r;
  },
  // v1.12 / v1.13: kelishuv (PDF + Word) yoki imzolangan skan → «07 BEKOR QILISH / Kelishuv / <yil>»
  async koprikKbSaqla(kod, m) {
    m = m || {};
    const KB = ['07 BEKOR QILISH', 'Kelishuv'];
    if (m.skanB64) {
      const nomS = s(m.skanNom);
      if (!/^KB-\d+_[^\/\\]{3,160}\.pdf$/.test(nomS)) throw new Error('Kelishuv skani nomi noto\'g\'ri.');
      return { skan: (await saqla(KB.concat(yilOl(m.yil)), nomS, bayt(m.skanB64))).id };
    }
    const eski = (m.eski || []).map(String).filter(Boolean), boshqa = [];
    for (const id of eski) { const e = await savatga(id, KB.join('/')); if (!e.meniki) boshqa.push(id); }
    if (boshqa.length) eskiFon('koprikKbSaqla', kod, [{ eski: boshqa }]);
    if (!m.pdfB64) return { ok: true };
    const nom = s(m.nom);
    if (!/^Kelishuv_bekor_[^\/\\]{3,160}$/.test(nom) || !m.docB64) throw new Error('Kelishuv hujjati nomi noto\'g\'ri.');
    const papka = KB.concat(yilOl(m.yil));
    return { pdf: (await saqla(papka, nom + '.pdf', bayt(m.pdfB64))).id, doc: (await saqla(papka, nom + '.docx', bayt(m.docB64))).id };
  },
  // v1.19 / v1.20: ta'minot to'lovi isboti yoki dalolatnoma → «06 TAMINOT / ISBOTLAR | DALOLATNOMALAR»
  async koprikTamIsbot(kod, m) {
    m = m || {};
    const nom = s(m.nom), qism = s(m.qism || 'ISBOTLAR');
    if (qism !== 'ISBOTLAR' && qism !== 'DALOLATNOMALAR') throw new Error('Ta\'minot papkasi noto\'g\'ri: ' + qism);
    if (!(qism === 'ISBOTLAR' ? /^Tolov_.+\.pdf$/ : /^Dalolatnoma_.+\.pdf$/).test(nom) || nom.length > 150) throw new Error('Ta\'minot fayli: fayl nomi noto\'g\'ri.');
    return { id: (await saqla(['06 TAMINOT', qism], nom, bayt(m.b64), { mahalliy: true })).id };
  },
  // v1.14: qayta tuzish bekor — yangi raqamning bo'sh mijoz papkasi (arxivda ham, eski tizimda ham)
  async koprikQtPapkaSavat(kod, yangi) {
    const n = await papkaSavat(yangi);
    let e = { n: 0 }; try { e = (await eskiga('koprikQtPapkaSavat', kod, [yangi])) || e; } catch (x) { }
    return { n: n + (Number(e.n) || 0) };
  },
};

// koprik.chaqir o'rnida: arxiv yoniq bo'lsa — server o'zi, aks holda avvalgidek eski tizim
async function chaqir(fn, kod, args, opt) {
  if (!ISH[fn] || !(await yoniq())) return require('../api/koprik').chaqir(fn, kod, args, opt);
  const t0 = Date.now();
  try { const r = await ISH[fn](kod, ...(args || [])); jurnal(fn, Date.now() - t0, true); return r; }
  catch (e) { jurnal(fn, Date.now() - t0, false, e.message); throw e; }
}

// ------------------------------------------------------------------ zaxira (Zaxira.gs zaxiraKunlik o'rnida) va serverdagi fayllar nusxasi
const XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
async function zaxira() {
  const t0 = Date.now(), sana = new Date(Date.now() + 5 * 3600e3).toISOString().slice(0, 10);
  const nom = 'AKS_BAZA_' + sana + '.xlsx';
  try {
    if (await stat('99 ZAXIRA/' + nom)) { await jurnal('zaxira', Date.now() - t0, true); return { nom, bor: true }; }
    const b = await require('./google').driveEksport(env.aksBazaId, XLSX, env.googleKey);
    if (b.length < 10000) throw new Error('AKS_BAZA eksporti juda kichik (' + b.length + ' bayt)');
    await saqla(['99 ZAXIRA'], nom, b, { yangi: true });
    let ochdi = '';
    try { await rc(['delete', REM + '99 ZAXIRA', '--min-age', '30d', '--include', 'AKS_BAZA_*.xlsx']); } catch (e) { ochdi = ' (eski nusxalar o\'chmadi: ' + e.message + ')'; }
    await jurnal('zaxira', Date.now() - t0, true);
    return { nom: nom + ochdi, hajm: b.length };
  } catch (e) { await jurnal('zaxira', Date.now() - t0, false, e.message); throw e; }
}
// serverdagi hamma fayl (/opt/aks/hujjat) → «SERVER NUSXA» (faqat yangi va o'zgarganlari; Drive keshi va _arxiv — yo'q, ular arxivda bor)
async function nusxa() {
  if (!(await redis.set('arxiv_nusxa_qulf', '1', 'NX', 'EX', 3600))) return { band: true };
  const t0 = Date.now();
  try {
    await rc(['copy', ILDIZ, REM + 'SERVER NUSXA', '--exclude', '.drive/**', '--exclude', '_arxiv/**', '--exclude', '*.tmp'], { ms: 3300000 });
    await jurnal('nusxa', Date.now() - t0, true);
    return { ok: true, ms: Date.now() - t0 };
  } catch (e) { await jurnal('nusxa', Date.now() - t0, false, e.message); throw e; }
  finally { redis.del('arxiv_nusxa_qulf').catch(() => {}); }
}

module.exports = { yoniq, bor, chaqir, zaxira, nusxa, saqla, savatga, kochir, tikla, mijozPapka, meniki, stat, ISH, _ichki: { SINOV, rc, seg, url, MAHALLIY, mijozKesh: () => { mijozKesh = { t: 0, L: [] }; } } };
