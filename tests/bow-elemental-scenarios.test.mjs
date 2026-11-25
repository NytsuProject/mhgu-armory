import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ELEMENT_CHARGE, calculateShot, parseCharge, rankFromRarity,
} from '../tools/bow-elemental-scenarios.mjs';

const weapon = {
  raw: 240,
  aff: 0,
  ele: [['Hielo', 'Ice', 33]],
  x: {
    charges: ['Rapid Lv2', 'Rapid Lv3', 'Rapid Lv4', 'Rapid Lv5!'],
    coatings: ['Power Coating 2', 'Element Coating 2'],
  },
};
const matchup = { id: 'favorable', label: 'Favorable', shotHz: 45, elementHz: 30 };

test('parses charge level and Load Up marker separately', () => {
  assert.deepEqual(parseCharge('Spread Lv5!'), {
    type: 'Spread', level: 5, requiresLoadUp: true,
  });
  assert.equal(parseCharge('Rapid Lv4').requiresLoadUp, false);
  assert.equal(parseCharge('Rapid Lv6'), null);
});

test('maps rarities to LR / HR / G', () => {
  assert.equal(rankFromRarity(3), 'LR');
  assert.equal(rankFromRarity(4), 'HR');
  assert.equal(rankFromRarity(8), 'G');
});

test('Rapid Lv5 has four arrows / 22 total physical MV', () => {
  const row = calculateShot({
    weapon, charge: 'Rapid Lv5!', matchup, slotIndex: 3, loadUp: true,
  });
  assert.equal(row.arrowHits, 4);
  assert.equal(row.mvSum, 22);
  assert.equal(row.slot, 4);
});

test('Load Up-only charge is excluded when the skill is absent', () => {
  assert.equal(calculateShot({
    weapon, charge: 'Rapid Lv5!', matchup, slotIndex: 3, loadUp: false,
  }), null);
});

test('global charge scenarios affect uncoated elemental damage in both builds', () => {
  const base = calculateShot({
    weapon, charge: 'Rapid Lv4', matchup, slotIndex: 2,
    elementCharge: ELEMENT_CHARGE.base,
  });
  const a = calculateShot({
    weapon, charge: 'Rapid Lv4', matchup, slotIndex: 2,
    elementCharge: ELEMENT_CHARGE.A,
  });
  assert.ok(a.rawIndexNoCoat > base.rawIndexNoCoat);
  assert.ok(a.elementFullCoatedBase > base.elementFullCoatedBase);
});

test('element build uses elemental coating and distinct skill package costs', () => {
  const nativeCoatings = calculateShot({
    weapon, charge: 'Rapid Lv4', matchup, slotIndex: 2,
  });
  assert.equal(nativeCoatings.skillCosts.raw.powerUnlock, 0);
  assert.equal(nativeCoatings.skillCosts.elementLite.elementUnlock, 0);
  assert.ok(nativeCoatings.skillCosts.elementFull.points
    > nativeCoatings.skillCosts.elementLite.points);
  const noCoatings = calculateShot({
    weapon: { ...weapon, x: { ...weapon.x, coatings: [] } },
    charge: 'Rapid Lv4', matchup, slotIndex: 2,
  });
  assert.equal(noCoatings.skillCosts.raw.powerUnlock, 15);
  assert.equal(noCoatings.skillCosts.elementLite.elementUnlock, 15);
});
