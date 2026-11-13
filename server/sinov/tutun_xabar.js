#!/usr/bin/env node
// AKS TIZIM — 🧪 tutun sinovi o'tmaganda direktorga Telegram (ishlab turgan ESKI kodning Telegram kutubxonasi orqali).
// node tutun_xabar.js --ildiz /opt/aks/app --versiya "<qisqa hash sarlavha>" --matn-fayl <fayl>
'use strict';
const path = require('path'), fs = require('fs');
const arg = k => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : ''; };
const esc = v => String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
(async () => {
  let matn = ''; try { matn = fs.readFileSync(arg('--matn-fayl'), 'utf8'); } catch (e) { }
  const TG = require(path.join(arg('--ildiz') || '/opt/aks/app', 'lib', 'telegram.js'));
  if (!TG.bor()) { console.log('  tutun: Telegram sozlanmagan — xabar yuborilmadi'); return; }
  await TG.direktor('🧪 <b>Yangilanish O\'RNATILMADI</b> — avtomatik sinovdan o\'tmadi.\nVersiya: ' + esc(arg('--versiya')) + '\n\n' + (matn || 'Tafsilot: serverdagi /var/log/aks-deploy.log')
    + '\n\n✅ Tizim eski versiyada ishlab turibdi, xodimlarga ta\'sir yo\'q. Tuzatilgan versiya kelganda o\'zi o\'rnatiladi.');
  console.log('  tutun: direktorga Telegram yuborildi');
})().catch(e => console.log('  tutun: Telegram yuborilmadi: ' + e.message)).finally(() => setTimeout(() => process.exit(0), 300));
