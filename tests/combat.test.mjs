import test from 'node:test';
import assert from 'node:assert/strict';
import {combatStats} from '../js/combat-stats.js';
import {weaponPiece, equipWeapon, newBuild, equip, socket} from '../js/builder-model.js';
import {buildHash,restoreBuild} from '../js/build-link.js';
import {readFileSync} from 'node:fs';
const db=JSON.parse(readFileSync(new URL('../data/weapons/great-sword.json',import.meta.url)));
const weapon=weaponPiece(db.class,db.trees[0],db.trees[0].levels.at(-1));
const calc=(pts,w=weapon)=>combatStats(w,Object.entries(pts).map(([en,total])=>({en,total})));

test('base, umbrales, zona débil, rendimientos negativos y tope',()=>{
  assert.equal(calc({Expert:9,Tenderizer:9}).potential,'0%');
  const r=calc({Attack:15,Expert:15,Tenderizer:10}); assert.equal(r.raw,335); assert.equal(r.affinity,'20%');assert.equal(r.potential,'70%');
  assert.equal(calc({Brutality:10,Expert:15,Tenderizer:10}).potential,'70%');
  assert.equal(calc({Expert:-10,Attack:-10}).raw,315);assert.equal(calc({Expert:-10}).affinity,'-5%');
  assert.equal(calc({Tenderizer:10,'Crit Draw':10}).potential,'100%');
  assert.equal(calc({Spirit:15,'Gloves Off':15}).potential,'50%');
});
test('elemento doble, estado no elemental y afinidad caótica separada',()=>{
  const w={...weapon,ele:[['Fuego','Fire',20],['Parálisis','Paralysis',10]]};
  assert.deepEqual(calc({'Fire Atk':15},w).attributes,['Fuego 28 (arma: 20)','Parálisis 10']);
  assert.deepEqual(calc({Elemental:10,'Fire Atk':15},w).attributes,['Fuego 30 (arma: 20)','Parálisis 10']);
  const c=calc({}, {...weapon,tree:123});assert.equal(c.affinity,'-45% / 20%');assert.equal(c.potential,'80%');
});
test('arma compartida: clase, árbol, nivel, ranuras locales y compatibilidad con armadura',()=>{
  const b=newBuild(),j={id:1,cost:3,sk:[]};assert.ok(equipWeapon(b,weapon)); assert.ok(socket(b.weapon,j));
  assert.equal(equip(b,'chest',{slot:'chest',cls:'G',gender:2}),false);
  assert.deepEqual(restoreBuild(buildHash(b),new Map(),[j],[],(slug,id,lv)=>slug===weapon.slug && id===weapon.tree && lv===weapon.lv && weapon),b);
  assert.equal(equipWeapon(b,weaponPiece(db.class,db.trees[0],db.trees[0].levels[0])),true);assert.equal(b.weapon.jewels.length,0);
});
