// AKS TIZIM — ismni kirillga o'girish va qisqartirish (Xat.gs xatKirill_, Undiruv.gs undQisqaIsm_ bilan bir xil).
'use strict';
// 24.10.2026 tuzatish (direktor): otasining ismidan keyingi «ўғли» / «қизи» — KICHIK harf bilan. Eski xatKirill_ har so'zni bosh harf
// bilan yozardi → «Тестов Жасур Бахтиёр Ўғли» (2-xat salomi, F.I.Sh. qatori, bekor/kelishuv hujjatlari, Telegram). Birinchi so'z (familiya) tegilmaydi.
const OTA = /^(ўғли|қизи|угли|кизи|огли|оглы|кызы)$/i;
const otaKichik = t => t.split(' ').map((w, i) => i && OTA.test(w) ? w.toLowerCase() : w).join(' ');
// xatKirill_: «ODILOVA RANO ABDUXAKIMOVNA» → «Одилова Рано Абдухакимовна»; kirill harfi bor matn o'zgarmaydi (faqat «ўғли»/«қизи» kichik harfga)
function xatKirill(matn) {
  matn = String(matn || '').trim(); if (!matn) return matn;
  if (/[Ѐ-ӿ]/.test(matn)) return otaKichik(matn);
  // «Oʼ» / «Gʼ» (U+02BC — telefon klaviaturasi) ham: avval «ОЪ»/«ГЪ» bo'lib qolardi
  const J = [['O`', 'Ў'], ["O'", 'Ў'], ['Oʻ', 'Ў'], ['O‘', 'Ў'], ['O’', 'Ў'], ['Oʼ', 'Ў'], ['G`', 'Ғ'], ["G'", 'Ғ'], ['Gʻ', 'Ғ'], ['G‘', 'Ғ'], ['G’', 'Ғ'], ['Gʼ', 'Ғ'], ['SH', 'Ш'], ['CH', 'Ч'], ['KH', 'Х'], ['YE', 'Е'], ['YO', 'Ё'], ['YU', 'Ю'], ['YA', 'Я'], ['TS', 'Ц']];
  const B = { A: 'А', B: 'Б', D: 'Д', E: 'Е', F: 'Ф', G: 'Г', H: 'Ҳ', I: 'И', J: 'Ж', K: 'К', L: 'Л', M: 'М', N: 'Н', O: 'О', P: 'П', Q: 'Қ', R: 'Р', S: 'С', T: 'Т', U: 'У', V: 'В', X: 'Х', Y: 'Й', Z: 'З', C: 'К', W: 'В' };
  let t = matn.toUpperCase(); J.forEach(p => { t = t.split(p[0]).join(p[1]); });
  t = t.replace(/['`ʼʻ‘’]/g, 'Ъ');
  t = t.replace(/(^|[^A-ZЀ-ӿ])E/g, '$1Э');
  t = t.split('').map(ch => B[ch] || ch).join('');
  return otaKichik(t.split(/\s+/).map(w => w.charAt(0) + w.slice(1).toLowerCase()).join(' '));
}
// undQisqaIsm_: «ODILOVA RANO ABDUXAKIMOVNA» → «Одилова Р.А.»; «… BAXTIYOR O'G'LI» → «… Ж.Б.» («ўғли»/«қизи» bosh harfga olinmaydi — 24.10)
function qisqaIsm(fish) {
  const w = String(fish || '').trim().split(/\s+/).filter(Boolean); if (!w.length) return '';
  const k = xatKirill(w.join(' ')).split(/\s+/).filter((z, i) => !i || !OTA.test(z));
  return k[0] + (k.length > 1 ? ' ' + k.slice(1).map(z => z.charAt(0) + '.').join('') : '');
}
// 14.11.2026 (direktor: «qaysi alifboda yozsam ham tizim o'zi kerakligiga o'tkazsin»):
// kirill → lotin (tizimning asosiy alifbosi: xodimning qisqa nomi, lavozimi — kod lavozimni lotinda qidiradi: «kotib», «buxgalter», «kassir»)
const KL = { 'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'ё': 'yo', 'ж': 'j', 'з': 'z', 'и': 'i', 'й': 'y', 'к': 'k', 'л': 'l', 'м': 'm', 'н': 'n', 'о': 'o', 'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u', 'ф': 'f', 'х': 'x', 'ц': 's', 'ч': 'ch', 'ш': 'sh', 'щ': 'sh', 'ъ': "'", 'ь': '', 'ы': 'i', 'э': 'e', 'ю': 'yu', 'я': 'ya', 'ў': "o'", 'қ': 'q', 'ғ': "g'", 'ҳ': 'h' };
function lotinga(matn) {
  const s = String(matn == null ? '' : matn); let o = '';
  for (let i = 0; i < s.length; i++) {
    const c = s[i], l = c.toLowerCase(); let m = KL[l];
    if (m === undefined) { o += c; continue; }
    if (l === 'е' && (i === 0 || /[\s(«"-]/.test(s[i - 1]) || 'аеёиоуэюяўъь'.indexOf(s[i - 1].toLowerCase()) >= 0)) m = 'ye';
    o += (c !== l && m) ? m.charAt(0).toUpperCase() + m.slice(1) : m;
  }
  return o;
}
// hujjatlar uchun to'liq F.I.Sh.: lotincha so'zlar kirillga, hammasi KATTA harfda («Назаров Фурқат Qudratovich» → «НАЗАРОВ ФУРҚАТ ҚУДРАТОВИЧ»)
function toliqKirill(matn) {
  return String(matn == null ? '' : matn).replace(/\s+/g, ' ').trim().split(' ').filter(Boolean)
    .map(w => /[A-Za-z]/.test(w) && !/[Ѐ-ӿ]/.test(w) ? xatKirill(w) : w).join(' ').toUpperCase();
}
module.exports = { xatKirill, qisqaIsm, lotinga, toliqKirill };
