import test from 'node:test';
import assert from 'node:assert/strict';
import { newBuild, equip, equipTalisman, socket } from '../js/builder-model.js';
import { buildHash, restoreBuild } from '../js/build-link.js';

const pieces = new Map(['head','chest','arms','waist','legs'].map(slot => [`${slot}:1`, { slot, sid:1, cls:'B', gender:2, deco:2, sk:[] }]));
const jewels = [{id:1,cost:1,sk:[]}, {id:2,cost:2,sk:[]}];
const catalog = [{en:'Attack',es:'Ataque',points:[[1,2],[]]}, {en:'Expert',es:'Experto',points:[[],[-4,3]]}];
const restore = hash => restoreBuild(hash,pieces,jewels,catalog);
const hash = rows => '#builder=v1.' + Buffer.from(JSON.stringify(rows)).toString('base64url');

test('enlace autónomo: equipo parcial o completo, joyas repetidas y talismán Unicode', () => {
  const b = newBuild();
  for (const p of pieces.values()) {
    equip(b,p.slot,p); socket(b[p.slot],jewels[0]); socket(b[p.slot],jewels[0]);
    assert.deepEqual(restore(buildHash(b)),b);
  }
  assert.equal(equipTalisman(b,{name:'Dragón 🐉 & luz',skills:[['Attack',2],['Expert',-4]],deco:3},catalog),'');
  socket(b.talisman,jewels[1]); assert.deepEqual(restore(buildHash(b)),b);
});

test('enlaces inválidos no permiten saltarse el catálogo, los límites ni la versión', () => {
  for (const h of ['#builder=v2.a','#builder=v1.!',hash([]),hash([[999,[]],null,null,null,null,null]),
    hash([[1,[2,1]],null,null,null,null,null]),hash([[1,[50]],null,null,null,null,null]),
    hash([null,null,null,null,null,[{name:'x',deco:4,skills:[]},[]]])]) assert.throws(()=>restore(h));
});
