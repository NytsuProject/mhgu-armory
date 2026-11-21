import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { thirdChargeType } from '../js/bow-charges.js';

const { trees } = JSON.parse(readFileSync(new URL('../data/weapons/bow.json', import.meta.url)));

test('solo cuenta la tercera posición, no las otras cargas ni el Lv de la flecha', () => {
  const level = {x: {charges: ['Rapid Lv3', 'Pierce Lv3', 'Heavy Lv1', 'Spread Lv3!']}};
  assert.equal(thirdChargeType(level), 'Heavy');
  assert.equal(thirdChargeType(level, true), 'Heavy');
  assert.equal(thirdChargeType({x: {charges: ['Rapid Lv3', 'Heavy Lv3']}}), null);
});

test('Recargando habilita la tercera carga bloqueada, nunca una carga distinta', () => {
  const akantor = trees.find(t => t.name === 'Akantor Bow').levels[0];
  assert.equal(thirdChargeType(akantor), null);
  assert.equal(thirdChargeType(akantor, true), 'Rapid');
  const petrified = trees.find(t => t.name === 'Petrified Bow').levels[0];
  assert.equal(thirdChargeType(petrified, true), 'Rapid'); // Abanico es la cuarta.
});
