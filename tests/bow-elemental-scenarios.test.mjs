import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ELEMENT_CHARGE, calculateShot, parseCharge, rankFromRarity, runMatrix, runMonsterMatrix,
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
  assert.equal(nativeCoatings.skillCosts.raw.points, 80);
  assert.equal(nativeCoatings.skillCosts.elementLite.points, 85);
  assert.equal(nativeCoatings.skillCosts.elementFull.points, 105);
  const noCoatings = calculateShot({
    weapon: { ...weapon, x: { ...weapon.x, coatings: [] } },
    charge: 'Rapid Lv4', matchup, slotIndex: 2,
  });
  assert.equal(noCoatings.skillCosts.raw.powerUnlock, 15);
  assert.equal(noCoatings.skillCosts.elementLite.elementUnlock, 15);
});

test('matrix enumerates every elemental slot and synthetic matchup', () => {
  const database = {
    trees: [{
      id: 1, name: 'Test Bow', rarity: 8,
      levels: [{
        lv: 1, rar: 8, nEs: 'Arco de prueba', raw: 240, aff: 0,
        ele: [['Hielo', 'Ice', 33]],
        x: { charges: ['Rapid Lv2', 'Rapid Lv3', 'Rapid Lv4', 'Rapid Lv5!'],
          coatings: ['Power Coating 2', 'Element Coating 2'] },
      }],
    }],
  };
  const { rows, summary } = runMatrix(database);
  assert.equal(rows.length, 16); // four slots × four matchup profiles
  assert.equal(rows.filter(row => row.slot === 4).length, 4);
  assert.ok(rows.every(row => row.rank === 'G'));
  assert.equal(summary.length, 4); // one group per matchup
  assert.ok(summary.every(row => row.bestLite.skillCosts.raw.points === 80));
});

test('rejects invalid coating-uptime probabilities', () => {
  assert.throws(() => calculateShot({
    weapon, charge: 'Rapid Lv4', matchup, ammoSaverChance: 1,
  }), /ammoSaverChance/);
});

test('real hitzone matrix compares catalogue RAW and elemental candidates by monster and rank', () => {
  const database = {
    trees: [
      {
        id: 1, name: 'Raw Test Bow', rarity: 8,
        levels: [{
          lv: 1, rar: 8, nEs: 'Arco RAW de prueba', raw: 360, aff: 0,
          x: { charges: ['Rapid Lv2', 'Rapid Lv3', 'Rapid Lv4', 'Rapid Lv5!'],
            coatings: ['Power Coating 2'] },
        }],
      },
      {
        id: 2, name: 'Element Test Bow', rarity: 8,
        levels: [{
          lv: 1, rar: 8, nEs: 'Arco de hielo de prueba', raw: 240, aff: 0,
          ele: [['Hielo', 'Ice', 45]],
          x: { charges: ['Rapid Lv2', 'Rapid Lv3', 'Rapid Lv4', 'Rapid Lv5!'],
            coatings: ['Element Coating 2'] },
        }],
      },
    ],
  };
  const monsterData = {
    monsters: [{
      name: 'Monstruo de prueba', large: true,
      tables: [[
        [0, 'Cabeza', 65, 65, 45, 0, 0, 0, 0, 30, 100, 100],
        [1, 'Ala', 20, 20, 20, 0, 0, 0, 0, 45, 0, 100],
      ]],
    }],
  };
  const result = runMonsterMatrix(database, monsterData, { includeLoadUp: true });
  assert.equal(result.metadata.largeMonsters, 1);
  assert.equal(result.results.length, 3);
  const g = result.results.find(row => row.rank === 'G');
  assert.equal(g.monster, 'Monstruo de prueba');
  assert.equal(g.partsEvaluated, 2);
  assert.ok(g.scenarios.base.raw);
  assert.ok(g.scenarios.base.elementalFull);
  assert.equal(g.scenarios.base.elementalFull.element, 'Ice');
  assert.equal(g.scenarios.base.elementalFull50.vsRaw > 0, true);
});
