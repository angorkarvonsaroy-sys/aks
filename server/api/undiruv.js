// AKS TIZIM — undiruv bo'limining O'QIYDIGAN qismi serverda (Undiruv.gs v26.3): undBoshlang (portfel).
'use strict';
const S = require('./sessiya');
const P = require('../lib/portfel');

const UND_CHORA = ['Телефон', 'Ташриф (манзилига бориб)', 'Офисда суҳбат', 'СМС/Телеграм'];
const UND_NATIJA = ['Боғланилди', 'Боғланиб бўлмади', 'Тўлашдан бош тортди'];

async function undBoshlang([kodSes]) {
  const u = await S.ruxsat(kodSes, 'undiruv'); const adm = u.admin;
  const R = await P.undPortfel(x => adm || x.undiruvchi === u.fish, u.kod);
  const portfellar = adm ? [...new Set(R.royxat.map(x => x.undiruvchi).filter(Boolean))].sort() : [];
  return { royxat: R.royxat, bugun: R.bugun, admin: adm, fish: u.fish, portfellar, chora: UND_CHORA, natija: UND_NATIJA, jimKun: P.UND_JIM_KUN };
}

module.exports = { undBoshlang };
