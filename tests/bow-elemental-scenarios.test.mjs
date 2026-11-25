import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ELEMENT_CHARGE, calculateShot, calculateSequence, loadUpDiagnostics, normalizeLoadUpCharge, parseCharge, rankFromRarity, runMatrix, runMonsterMatrix,
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

test('optional element cap clamps catalogue element before elemental skills and innate hybrid damage', () => {
  const uncapped = calculateShot({
    weapon, charge: 'Rapid Lv4', matchup, slotIndex: 2,
  });
  const capped = calculateShot({
    weapon, charge: 'Rapid Lv4', matchup, slotIndex: 2, elementCap: 30,
  });
  assert.equal(uncapped.elementValue, 33);
  assert.equal(uncapped.effectiveElementValue, 33);
  assert.equal(uncapped.elementCap, null);
  assert.equal(capped.elementValue, 33); // source/catalogue value remains visible
  assert.equal(capped.effectiveElementValue, 30);
  assert.equal(capped.elementCap, 30);
  assert.equal(capped.rawElementNoCoat, Number((uncapped.rawElementNoCoat * 30 / 33).toFixed(4)));
  assert.equal(capped.elementFullElementNoCoat, Number((uncapped.elementFullElementNoCoat * 42 / 45).toFixed(4)));
  assert.equal(capped.rawPhysicalNoCoat, uncapped.rawPhysicalNoCoat);
  assert.equal(capped.elementPhysicalNoCoat, uncapped.elementPhysicalNoCoat);
  assert.throws(() => calculateShot({
    weapon, charge: 'Rapid Lv4', matchup, slotIndex: 2, elementCap: -1,
  }), /elementCap/);
});


test("Power Coating multiplies only the physical component of a hybrid bow shot", () => {
  const row = calculateShot({
    weapon, charge: 'Rapid Lv4', matchup, slotIndex: 2,
    ammoSaverChance: 0,
  });
  assert.ok(row.rawPhysicalNoCoat > 0);
  assert.ok(row.rawElementNoCoat > 0);
  assert.equal(row.rawPhysicalPowerCoated, Number((row.rawPhysicalNoCoat * 1.5).toFixed(4)));
  assert.equal(
    Number((row.rawIndexPowerCoated - row.rawIndexNoCoat).toFixed(4)),
    Number((row.rawPhysicalNoCoat * 0.5).toFixed(4))
  );
  assert.equal(row.rawElementNoCoat, Number((row.rawIndexNoCoat - row.rawPhysicalNoCoat).toFixed(4)));
});

test("Ammo Saver is off by default because no exact MHGU return rate is verified", () => {
  const row = calculateShot({
    weapon, charge: 'Rapid Lv4', matchup, slotIndex: 2,
  });
  assert.equal(row.coatings.ammoSaverChance, 0);
  assert.equal(row.coatings.elementFullExpectedUsesCurrent, 30);
  assert.equal(row.coatings.elementFullExpectedUsesCapacity50, 60);
});


test("enabling Ammo Saver adds its point cost to the relevant builds and models its return rate", () => {
  const row = calculateShot({
    weapon, charge: 'Rapid Lv4', matchup, slotIndex: 2,
    ammoSaverChance: 0.20,
  });
  assert.equal(row.coatings.ammoSaverEnabled, true);
  assert.equal(row.coatings.ammoSaverChance, 0.20);
  assert.equal(row.skillCosts.raw.points, 80);
  assert.equal(row.skillCosts.raw.skills, 6);
  assert.equal(row.skillCosts.elementFull.points, 105);
  assert.equal(row.skillCosts.elementFull.skills, 8);
  assert.equal(row.coatings.powerExpectedUses, 87.5);
  assert.equal(row.coatings.elementFullExpectedUsesCurrent, 37.5);
  assert.equal(row.coatings.elementFullExpectedUsesCapacity50, 75);
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

test('Element Focus matches RAW on five main skill lines without shot-type boost', () => {
  const row = calculateShot({
    weapon, charge: 'Rapid Lv4', matchup, slotIndex: 2,
  });
  assert.equal(row.skillCosts.raw.skills, 5);
  assert.equal(row.skillCosts.raw.points, 70);
  assert.equal(row.skillCosts.elementFocused.skills, 5);
  assert.equal(row.skillCosts.elementFocused.points, 75);
  assert.equal(row.skillCosts.elementFocused.elementUnlock, 0);
  assert.equal(row.elementFocusedElementNoCoat, row.elementLiteElementNoCoat);
  assert.ok(row.elementFocusedPhysicalNoCoat < row.elementPhysicalNoCoat);
  assert.ok(row.elementFocusedMissionCurrent < row.elementLiteMissionCurrent);
});

test('element build uses elemental coating and distinct skill package costs', () => {
  const nativeCoatings = calculateShot({
    weapon, charge: 'Rapid Lv4', matchup, slotIndex: 2,
  });
  assert.equal(nativeCoatings.skillCosts.raw.powerUnlock, 0);
  assert.equal(nativeCoatings.skillCosts.elementLite.elementUnlock, 0);
  assert.equal(nativeCoatings.skillCosts.raw.points, 70);
  assert.equal(nativeCoatings.skillCosts.raw.skills, 5);
  assert.equal(nativeCoatings.skillCosts.elementLite.points, 85);
  assert.equal(nativeCoatings.skillCosts.elementFull.points, 95);
  assert.equal(nativeCoatings.skillCosts.elementFull.skills, 7);
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
  assert.ok(summary.every(row => row.bestLite.skillCosts.raw.points >= 70));
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
        [0, 'Cabeza', 65, 65, 45, 0, 0, 0, 30, 0, 100, 100],
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
  // Only the head has an Ice hitzone; the wing's Dragon 45 does not
  // qualify for this Ice bow's elemental matchup distribution.
  assert.equal(g.partStats.scenarios.base.elementalFull.length, 1);
  assert.deepEqual(
    g.partStats.scenarios.base.elementalFull.map(stat => stat.part),
    ['Cabeza'],
  );
  assert.ok(g.partStats.byShotType.Rapid.base.elementalFull.length > 0);
  assert.equal(g.parts, undefined);
  assert.ok(g.scenarios.base.raw);
  assert.ok(g.scenarios.base.elementalFocused);
  assert.ok(g.scenarios.base.elementalFull);
  // The winning slot uses C4! and includes the additional Load Up line (+10).
  assert.equal(g.scenarios.base.elementalFocused.skillCosts.elementFocused.skills, 6);
  assert.equal(g.scenarios.base.elementalFocused.skillCosts.elementFocused.points, 85);
  assert.ok(g.scenarios.base.elementalFocused.damage > 0);
  assert.ok(g.byShotType.Rapid.base.elementalFocused);
  assert.equal(g.byShotType.Rapid.base.elementalFocused.shotType, "Rapid");
  assert.equal(g.scenarios.base.elementalFull.element, 'Ice');
  assert.equal(g.scenarios.base.elementalFull.style, 'guild');
  assert.equal(g.scenarios.base.elementalFull.powerShotCount, 1);
  assert.equal(g.scenarios.base.elementalFull50.vsRaw > 0, true);
  assert.ok(g.byShotType.Rapid.base.raw);
  assert.ok(g.byShotType.Rapid.base.elementalFull);
  assert.equal(g.byShotType.Rapid.base.raw.shotType, "Rapid");
  assert.equal(g.byShotType.Rapid.base.elementalFull.shotType, "Rapid");
  assert.equal(g.byShotType.Rapid.base.elementalFull.rawPart, g.byShotType.Rapid.base.elementalFull.part);
  assert.equal(g.byShotType.Rapid.base.elementalFull.rawTree > 0, true);
  assert.equal(
    g.byShotType.Rapid.base.elementalFull.vsRaw,
    Number((g.byShotType.Rapid.base.elementalFull.damage / g.byShotType.Rapid.base.elementalFull.rawDamage).toFixed(4))
  );
  assert.equal(g.byShotType.Spread.base.raw, null);
  assert.equal(g.byShotType.Spread.base.elementalFull, null);
  const noSaverRawCost = g.scenarios.base.raw.skillCosts.raw.points;
  const noSaverFullCost = g.scenarios.base.elementalFull.skillCosts.elementFull.points;
  const saver = runMonsterMatrix(database, monsterData, {
    includeLoadUp: true, ammoSaverChance: 0.20,
  });
  const saverG = saver.results.find(row => row.rank === 'G');
  assert.equal(saver.metadata.options.ammoSaverEnabled, true);
  assert.equal(saverG.scenarios.base.raw.skillCosts.raw.points, noSaverRawCost + 10);
  assert.equal(saverG.scenarios.base.elementalFull.skillCosts.elementFull.points, noSaverFullCost + 10);

  const valor = runMonsterMatrix(database, monsterData, { includeLoadUp: true, style: 'valor' });
  const valorG = valor.results.find(row => row.rank === 'G');
  assert.equal(valorG.scenarios.base.elementalFull.style, 'valor');
  assert.equal(valorG.scenarios.base.elementalFull.powerShotCount, 2);
});

test('Load Up charge keeps its level but follows the preceding arrow type', () => {
  const charges = ['Rapid Lv3', 'Rapid Lv4', 'Spread Lv5!'];
  assert.equal(normalizeLoadUpCharge(charges, 2), 'Rapid Lv5!');
  assert.deepEqual(parseCharge(normalizeLoadUpCharge(charges, 2)), {
    type: 'Rapid', level: 5, requiresLoadUp: true,
  });
  assert.equal(normalizeLoadUpCharge(['Pierce Lv4', 'Pierce Lv5!'], 1), 'Pierce Lv5!');
});

test('Load Up diagnostics counts catalogue mismatches without mutating source charges', () => {
  const charges = ['Rapid Lv3', 'Spread Lv4!'];
  const database = { trees: [{ id: 1, levels: [{ x: { charges } }] }] };
  assert.deepEqual(loadUpDiagnostics(database), {
    marked: 1, alreadyMatching: 0, normalized: 1, bySlot: { '2': 1 },
  });
  assert.deepEqual(charges, ['Rapid Lv3', 'Spread Lv4!']);
});

test('Guild Power Shot follows the next charge and Load Up type normalization', () => {
  const bow = {
    ...weapon,
    x: {
      charges: ['Rapid Lv2', 'Rapid Lv3', 'Rapid Lv4', 'Spread Lv5!'],
      coatings: ['Power Coating 2', 'Element Coating 2'],
    },
  };
  const withLoadUp = calculateSequence({
    weapon: bow, charge: 'Rapid Lv4', slotIndex: 2, matchup,
    style: 'guild', loadUp: true,
  });
  assert.equal(withLoadUp.powerShotCount, 1);
  assert.equal(withLoadUp.powerShotSlot, 4);
  assert.equal(withLoadUp.powerShotCharge, 'Rapid Lv5!');
  assert.equal(withLoadUp.sequenceRequiresLoadUp, true);
  assert.equal(withLoadUp.skillCosts.raw.loadUp, 10);
  assert.deepEqual(withLoadUp.breakdown.map(x => x.role), ['primary', 'powerShot']);

  const withoutLoadUp = calculateSequence({
    weapon: bow, charge: 'Rapid Lv4', slotIndex: 2, matchup,
    style: 'guild', loadUp: false,
  });
  assert.equal(withoutLoadUp.powerShotSlot, 3);
  assert.equal(withoutLoadUp.powerShotCharge, 'Rapid Lv4');
  assert.equal(withoutLoadUp.sequenceRequiresLoadUp, false);
  assert.equal(withoutLoadUp.skillCosts.raw.loadUp, 0);
});

test('Valor sequence adds a second Power Shot and its raw-only modifier', () => {
  const guild = calculateSequence({
    weapon, charge: 'Rapid Lv4', slotIndex: 2, matchup, style: 'guild',
  });
  const valor = calculateSequence({
    weapon, charge: 'Rapid Lv4', slotIndex: 2, matchup, style: 'valor',
  });
  assert.equal(valor.powerShotCount, 2);
  assert.equal(valor.expectedVolleysPerSequence, 3);
  assert.equal(valor.coatings.effectiveMissionVolleys, 600);
  assert.deepEqual(valor.breakdown.map(x => x.role), [
    'primary', 'powerShot', 'valorPowerShot',
  ]);
  assert.equal(valor.breakdown[2].rawMultiplier, 1.30);
  assert.ok(valor.rawMissionAverage > guild.rawMissionAverage);
  assert.ok(valor.elementFullMissionCurrent > guild.elementFullMissionCurrent);
});

test('TrueShot Up adds its skill cost and affects Power Shot raw, not elemental charge', () => {
  const standard = calculateSequence({
    weapon, charge: 'Rapid Lv4', slotIndex: 2, matchup, style: 'guild',
  });
  const boosted = calculateSequence({
    weapon, charge: 'Rapid Lv4', slotIndex: 2, matchup, style: 'guild',
    trueShotUp: true,
  });
  assert.equal(boosted.skillCosts.raw.points, standard.skillCosts.raw.points + 10);
  assert.equal(boosted.skillCosts.raw.skills, standard.skillCosts.raw.skills + 1);
  assert.ok(boosted.rawMissionAverage > standard.rawMissionAverage);
  assert.ok(boosted.elementFullMissionCurrent > standard.elementFullMissionCurrent);
});

test('styles without Power Shot retain one-volley sequences', () => {
  for (const style of ['none', 'striker', 'alchemy', 'aerial']) {
    const result = calculateSequence({
      weapon, charge: 'Rapid Lv4', slotIndex: 2, matchup, style,
    });
    assert.equal(result.powerShotCount, 0);
    assert.equal(result.expectedVolleysPerSequence, 1);
    assert.equal(result.breakdown.length, 1);
  }
});

test('Valor state uptime scales both follow-up shots and coating consumption', () => {
  const fullValor = calculateSequence({
    weapon, charge: 'Rapid Lv4', slotIndex: 2, matchup,
    style: 'valor', powerShotUseRate: 1, valorStateUptime: 1,
  });
  const halfValor = calculateSequence({
    weapon, charge: 'Rapid Lv4', slotIndex: 2, matchup,
    style: 'valor', powerShotUseRate: 1, valorStateUptime: 0.5,
  });
  const noValor = calculateSequence({
    weapon, charge: 'Rapid Lv4', slotIndex: 2, matchup,
    style: 'valor', powerShotUseRate: 1, valorStateUptime: 0,
  });
  assert.equal(fullValor.expectedVolleysPerSequence, 3);
  assert.equal(halfValor.expectedVolleysPerSequence, 2);
  assert.equal(halfValor.effectivePowerShotUseRate, 0.5);
  assert.equal(noValor.expectedVolleysPerSequence, 1);
  assert.equal(noValor.powerShotSlot, null);
  assert.equal(noValor.sequenceRequiresLoadUp, false);
  assert.ok(fullValor.rawMissionAverage > halfValor.rawMissionAverage);
  assert.ok(halfValor.rawMissionAverage > noValor.rawMissionAverage);
});
