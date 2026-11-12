// AKS TIZIM — 🔔 TO'LOV ESLATMALARI KALENDARI (12.11.2026, direktor qarori). Undiruvchi nazorati, ertalabki topshiriq, mijozlar boti va SMS tartibi shu yerdan.
//   Eslatma kunlari: to'lov (yoki va'da) kunidan 3 KUN OLDIN, 2 KUN OLDIN va O'SHA KUNI.
//   Manba: 1) faol va'da (06 jurnal: «Вадада», sana ≥ bugun) — hamma mijoz uchun undiruvchiga (qo'ng'iroq + SMS), botga ulanganlarga botdan ham;
//          2) grafik (03b: navbatdagi to'lanmagan oylik) — botga ULANMAGAN mijoz uchun undiruvchiga (qo'ng'iroq + SMS); botga ulanganlarga — botdan.
//   Faol va'da + grafik kuni yaqin (0..3 kun) — BIRLASHGAN eslatma: «grafik bo'yicha falon sanagacha shuncha to'lash shart, va'dangiz falon kuni shuncha, grafikni ham bajaring».
//   Va'da grafik qarzini to'liq yopsa (summasi ≥ grafik bo'yicha qarz va sanasi grafik kunidan kech emas) — faqat va'da eslatmasi.
//   Va'da yozilgan kunning o'zida shu va'da bo'yicha eslatma chiqmaydi (hozirgina gaplashilgan).
//   YAKSHANBA — oddiy ish kuni: eslatma chiqadi, bajarilsa — tamom. Bajarilmasa — DUSHANBA kuni «↩ yakshanbadan» bo'lib qayta chiqadi (yakshanba ijro hisobiga kirmaydi).
//   Ish kunlarida bajarilmagan eslatma ertasiga ko'chmaydi (ijro minusi — avvalgidek).
'use strict';
const ESL_KUN = [3, 2, 0];
const kunQosh = (i, n) => { const d = new Date(i + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const farq = (a, b) => Math.round((new Date(b + 'T12:00:00Z') - new Date(a + 'T12:00:00Z')) / 86400000);   // a dan b gacha kun
const hafta = i => new Date(i + 'T12:00:00Z').getUTCDay();   // 0 — yakshanba

// faol va'da: { sana, summa, natija, yozildi } (portfel x.vada shaklida)
const vadaFaol = (v, bugun) => !!(v && v.natija === 'Вадада' && v.sana >= bugun);

// grafik: jadval [{sana, summa, kum}] (sana bo'yicha tartiblangan), tolangan — 03 AB; dan sanasidan boshlab birinchi to'lanmagan qator
function grafikKeyingi(jadval, tolangan, asosiy, dan) {
  for (const j of jadval || []) {
    if (!(j.kum > tolangan + 1000) || j.sana < dan) continue;
    const jami = Math.max(0, Math.min(j.kum - tolangan, asosiy > 0 ? asosiy : j.kum - tolangan));   // shu sanagacha grafik bo'yicha jami (oldingi muddati o'tgan + navbatdagi)
    return { sana: j.sana, summa: Math.max(0, Math.min(j.summa, j.kum - tolangan, asosiy > 0 ? asosiy : j.summa)), jami };
  }
  return null;
}

// bugungi eslatma (yoki dushanba kuni — yakshanbadan qolgani). o: { vada, jadval, tolangan, asosiy, grafik (true — grafik eslatmasi undiruvchiga kerak), kechaBajarildi }
// Qaytaradi: { manba: 'vada'|'grafik'|'birga', kun, sana, summa, kochdi, vada?: {sana, summa}, jami? } yoki null.
//   birga: sana/summa — grafik bo'yicha (sana gacha jami), vada — va'da; kun — grafik kunigacha qolgan kun
function bugungi(o, bugun) {
  const dush = hafta(bugun) === 1, kecha = kunQosh(bugun, -1), kech = dush && !o.kechaBajarildi;
  const tekshir = (sana, yozildi) => {
    const k = farq(bugun, sana);
    if (ESL_KUN.indexOf(k) >= 0 && yozildi !== bugun) return { kun: k, kochdi: false };
    // dushanba: yakshanba kungi eslatma bajarilmagan bo'lsa — bugun qayta (yakshanba kuni k+1 edi)
    if (kech && ESL_KUN.indexOf(k + 1) >= 0 && (!yozildi || yozildi < kecha)) return { kun: k + 1, kochdi: true };
    return null;
  };
  const vf = vadaFaol(o.vada, kech ? kecha : bugun) ? o.vada : null;
  const g0 = grafikKeyingi(o.jadval, o.tolangan, o.asosiy, kech ? kecha : bugun), g = g0 && g0.summa > 1000 ? g0 : null;
  const yopadi = !!(vf && g && vf.summa >= g.jami - 1000 && vf.sana <= g.sana);
  const vK = vf ? tekshir(vf.sana, vf.yozildi) : null, gK = g ? tekshir(g.sana, '') : null;
  const gYaqin = g && !yopadi && farq(bugun, g.sana) >= (kech ? -1 : 0) && farq(bugun, g.sana) <= 3;
  if (vf && !yopadi && gYaqin && (vK || (gK && o.grafik))) {
    const t = gK || { kun: Math.max(0, farq(bugun, g.sana)), kochdi: !!(vK && vK.kochdi) };
    return { manba: 'birga', kun: t.kun, kochdi: !!(t.kochdi || (vK && vK.kochdi && !gK)), sana: g.sana, summa: g.jami, vada: { sana: vf.sana, summa: vf.summa } };
  }
  if (vK) return Object.assign({ manba: 'vada', sana: vf.sana, summa: vf.summa }, vK);
  if (vf || !o.grafik || !gK) return null;   // faol va'da grafikni yopadi / grafik — botda
  return Object.assign({ manba: 'grafik', sana: g.sana, summa: g.summa, jami: g.jami }, gK);
}

// SMS 3 kunlik qoidasidan istisno «eslatma oynasi»: faol va'da yoki navbatdagi oylik — bugundan 0..3 kun ichida (dushanba — kechagi ham)
function smsOyna(o, bugun) {
  const dan = hafta(bugun) === 1 ? kunQosh(bugun, -1) : bugun, gacha = kunQosh(bugun, 3);
  if (vadaFaol(o.vada, dan)) return o.vada.sana <= gacha;
  const g = grafikKeyingi(o.jadval, o.tolangan, o.asosiy, dan);
  return !!(g && g.summa > 1000 && g.sana <= gacha);
}

const KUN_MATN = k => k === 0 ? 'BUGUN' : k + ' kundan keyin';
module.exports = { ESL_KUN, vadaFaol, grafikKeyingi, bugungi, smsOyna, KUN_MATN, farq, kunQosh, hafta };
