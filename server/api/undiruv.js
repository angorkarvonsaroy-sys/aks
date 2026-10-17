// AKS TIZIM — undiruv bo'limining O'QIYDIGAN qismi serverda (Undiruv.gs v26.3): undBoshlang (portfel).
'use strict';
const S = require('./sessiya');
const P = require('../lib/portfel');
const U = require('../lib/undiruv_yordam');
const J = require('../lib/jurnallar');

const UND_CHORA = ['Телефон', 'Ташриф (манзилига бориб)', 'Офисда суҳбат', 'СМС/Телеграм'];
const UND_NATIJA = ['Боғланилди', 'Боғланиб бўлмади', 'Тўлашдан бош тортди'];

async function undBoshlang([kodSes]) {
  const u = await S.ruxsat(kodSes, 'undiruv'); const adm = u.admin;
  const R = await P.undPortfel(x => adm || x.undiruvchi === u.fish, u.kod);
  const portfellar = adm ? [...new Set(R.royxat.map(x => x.undiruvchi).filter(Boolean))].sort() : [];
  return { royxat: R.royxat, bugun: R.bugun, admin: adm, fish: u.fish, portfellar, chora: UND_CHORA, natija: UND_NATIJA, jimKun: P.UND_JIM_KUN };
}

// mijoz kartasi: jurnal tarixi + oxirgi 10 to'lov (Undiruv.gs undMijoz)
async function undMijoz([kodSes, no]) {
  const u = await S.ruxsat(kodSes, 'undiruv');
  const x = (await U.undShartnomalar()).find(z => z.no === String(no));
  if (!x || (!u.admin && x.undiruvchi !== u.fish)) throw new S.Xato('Bu shartnoma sizning portfelingizda emas.');
  const tarix = (await J.undJurnal()).filter(j => j.no === x.no).reverse()
    .map(j => ({ sana: j.sana, chora: j.chora, natija: j.natija, mazmun: j.mazmun, vadaSana: j.vadaSana, vadaSumma: j.vadaSumma, vadaNatija: j.vadaNatija, kim: j.kim, hujjat: j.hujjat }));
  const tolov = (await U.undTolovlar()).filter(t => t.no === x.no).slice(-10).reverse();
  return { tarix, tolov };
}

module.exports = { undBoshlang, undMijoz };
