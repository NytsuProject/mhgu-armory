import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { slots, newBuild, equip, equipTalisman, socket, unsocket, freeSlots, setSkills } from '../js/builder-model.js';

const data = name => JSON.parse(readFileSync(new URL(`../data/armor/${name}.json`, import.meta.url)));
const jewels = data('decorations');
const piece = (slot, deco, fields = {}) => ({ slot, deco, gender: 2, cls: 'A', sk: [], ...fields });
const jewel = cost => jewels.find(j => j.cost === cost);

test('catálogo: todos los costes y árboles representados, sin IDs duplicados', () => {
  const levels = data('skill-levels');
  assert.equal(new Set(jewels.map(j => j.id)).size, 242);
  assert.deepEqual([1, 2, 3].map(c => jewels.filter(j => j.cost === c).length), [156, 46, 40]);
  for (const j of jewels) for (const [en, , pts] of j.sk) assert.ok(levels[en]?.length && Number.isInteger(pts));
});

test('capacidad local: las 242 joyas con cada capacidad (0–3) y ocupación posible', () => {
  for (const slot of slots) for (let cap = 0; cap <= 3; cap++) for (let used = 0; used <= cap; used++) {
    for (const j of jewels) {
      const entry = { piece: piece(slot, cap), jewels: Array(used).fill(jewel(1)) };
      const fits = j.cost <= cap - used;
      assert.equal(socket(entry, j), fits);
      assert.equal(freeSlots(entry), cap - used - (fits ? j.cost : 0));
    }
  }
});

test('sin pieza no se engarza; dos huecos separados no admiten una joya doble', () => {
  const b = newBuild();
  assert.equal(socket(b.head, jewel(1)), false);
  equip(b, 'head', piece('head', 1)); equip(b, 'chest', piece('chest', 1));
  assert.equal(socket(b.head, jewel(2)), false);
  assert.equal(socket(b.chest, jewel(2)), false);
});

test('al quitar joyas se libera espacio; al cambiar pieza solo se retiran sus joyas', () => {
  const b = newBuild();
  equip(b, 'head', piece('head', 3)); equip(b, 'legs', piece('legs', 1));
  socket(b.legs, jewel(1)); socket(b.head, jewel(2)); socket(b.head, jewel(1));
  assert.equal(freeSlots(b.head), 0);
  assert.equal(unsocket(b.head, -1), false);
  assert.equal(unsocket(b.head, 0), true); assert.equal(freeSlots(b.head), 2);
  equip(b, 'head', piece('head', 0)); assert.equal(b.head.jewels.length, 0);
  assert.equal(b.legs.jewels.length, 1);
});

test('Torso+ copia puntos positivos y negativos de pechera y joyas, no los del resto', () => {
  const ps = [piece('chest', 2, {sk: [['Poison', 'Veneno', 2]]}),
    piece('legs', 0, {sk: [['Torso Up', 'Torso+', 0]]}), piece('head', 1)];
  const rows = setSkills(ps, {chest: [jewels[1]], head: [jewels[0]]});
  assert.equal(rows.find(s => s.en === 'Poison').total, (2 + 3) * 2 + 1);
  assert.equal(rows.find(s => s.en === 'Stun').total, -3);
});

test('las piezas deben ser compatibles con el puesto, clase y género de las demás', () => {
  const b = newBuild(); equip(b, 'legs', piece('legs', 1, {cls: 'B', gender: 0}));
  assert.equal(equip(b, 'chest', piece('chest', 1, {cls: 'G'})), false);
  assert.equal(equip(b, 'head', piece('head', 1, {gender: 1})), false);
  assert.equal(equip(b, 'waist', piece('head', 1)), false);
  assert.equal(equip(b, 'head', piece('head', 1, {cls: 'G'})), true);
});

const charmTrees = data('talisman-skills');
const charm = {name: 'Talismán de prueba', deco: 2, skills: [['Tenderizer', 6], ['Expert', -3]]};

test('talismán manual: uno por equipo, puntos firmados por posición, máximo dos árboles distintos', () => {
  const b = newBuild();
  assert.equal(equipTalisman(b, charm, charmTrees), '');
  assert.deepEqual(b.talisman.piece.sk, [['Tenderizer', 'Maza', 6], ['Expert', 'Experto', -3]]);
  const previous = b.talisman.piece;
  for (const changes of [{deco: 4}, {deco: -1}, {skills: [['Attack', 99]]}, {skills: [['Expert', -3]]},
    {skills: [['Expert', 1], ['Expert', 2]]}, {skills: [...charm.skills, ['Attack', 1]]}]) {
    assert.ok(equipTalisman(b, {...charm, ...changes}, charmTrees)); assert.equal(b.talisman.piece, previous);
  }
  assert.ok(socket(b.talisman, jewel(2))); assert.equal(socket(b.talisman, jewel(1)), false);
  assert.ok(equipTalisman(b, {...charm, deco: 1}, charmTrees)); assert.equal(b.talisman.piece, previous);
  assert.equal(equipTalisman(b, {...charm, deco: 3}, charmTrees), ''); assert.equal(freeSlots(b.talisman), 1);
  equipTalisman(b, null); assert.equal(b.talisman.piece, null); assert.deepEqual(b.talisman.jewels, []);
});

test('los puntos del accesorio y sus joyas solo se duplican con Talismán doble, no con Torso+', () => {
  const b = newBuild(); equipTalisman(b, charm, charmTrees); socket(b.talisman, jewel(2));
  const torso = piece('legs', 0, {sk: [['Torso Up', 'Torso+', 0]]});
  for (const pts of [9, 10]) {
    const result = setSkills([b.talisman.piece, torso, piece('head', 0, {sk: [['Talisman Boost', 'Mejora de talismán', pts]]})], {talisman: b.talisman.jewels});
    const m = pts === 10 ? 2 : 1;
    for (const [en, base] of [['Tenderizer', 6], ['Expert', -3], ['Poison', 3], ['Stun', -1]]) {
      assert.equal(result.find(s => s.en === en).total, base * m);
    }
  }
});
