import test from "node:test";
import assert from "node:assert/strict";
import {
  CHARGE_ELEMENT, CHARGE_RAW, PROFILE, SHOT_MVS,
  averageCoatingMultiplier, calculateVolley, makeWeaponCandidates,
  parseCharge, parseHitzones, rankForRarity, simulateBowBalance
} from "../js/bow-balance-sim.js";

const makeBow = () => ({
  class: "bow",
  trees: [
    {
      id: 1, nameEs: "Arco RAW", rarity: 1,
      levels: [{
        lv: 1, nEs: "Arco RAW LR", raw: 360, aff: 0, rar: 3,
        x: { charges: ["Rapid Lv3", "Rapid Lv3", "Rapid Lv3", "Pierce Lv4!"], coatings: ["Power Coating 2"] }
      }]
    },
    {
      id: 2, nameEs: "Arco de fuego", rarity: 1,
      levels: [{
        lv: 1, nEs: "Arco de fuego LR", raw: 300, aff: 0, rar: 3,
        ele: [["Fuego", "Fire", 40]],
        x: { charges: ["Rapid Lv3", "Rapid Lv3", "Rapid Lv3", "Heavy Lv4!"], coatings: ["Power Coating 2", "Element Coating 2"] }
      }]
    },
    {
      id: 3, nameEs: "Arco RAW G", rarity: 8,
      levels: [{
        lv: 1, nEs: "Arco RAW G", raw: 420, aff: 0, rar: 8,
        x: { charges: ["Rapid Lv3", "Rapid Lv3", "Rapid Lv3", "Rapid Lv4!"], coatings: ["Power Coating 2"] }
      }]
    }
  ]
});
const hitzoneData = {
  monsters: [{
    name: "Monster test",
    large: true,
    tables: [[
      [0, "Head", 90, 90, 50, 25, 15, 10, 20, 5, 100, 100],
      [1, "Body", 40, 40, 30, 10, 10, 10, 10, 5, 0, 0]
    ]]
  }]
};
const part = hitzoneData.monsters[0].tables[0][0];

test("charge slots and rarity produce the expected rank buckets", () => {
  assert.equal(rankForRarity(1), "LR");
  assert.equal(rankForRarity(3), "LR");
  assert.equal(rankForRarity(4), "HR");
  assert.equal(rankForRarity(7), "HR");
  assert.equal(rankForRarity(8), "G");
  assert.equal(rankForRarity(11), "G");
  assert.equal(rankForRarity(12), null);
  assert.deepEqual(parseCharge("Rapid Lv5"), { type: "Rapid", level: 5, requiresLoadUp: false });
  assert.deepEqual(parseCharge("Pierce Lv4!"), { type: "Pierce", level: 4, requiresLoadUp: true });
  assert.equal(parseCharge("Spread 4"), null);
});

test("MV and impact counts are separated correctly, including Rapid Lv5 = 4 arrows", () => {
  assert.deepEqual(SHOT_MVS.Rapid[5], [12, 4, 3, 3]);
  assert.equal(SHOT_MVS.Rapid[5].length, 4);
  assert.equal(SHOT_MVS.Pierce[5].length, 5);
  assert.equal(SHOT_MVS.Spread[5].length, 5);
  assert.equal(SHOT_MVS.Heavy[5].length, 1);
  assert.equal(SHOT_MVS.Rapid[5].reduce((a, b) => a + b, 0), 22);
});

test("charge multipliers are charge-slot multipliers, separate from arrow level", () => {
  assert.deepEqual(CHARGE_RAW, [0.4, 1, 1.5, 1.7]);
  assert.deepEqual(CHARGE_ELEMENT, [0.7, 0.85, 1, 1.125]);
});

test("Load Up fourth charge can be projected to C3 arrow type without changing its level", () => {
  const bow = makeBow();
  const current = makeWeaponCandidates(bow, { loadUpPolicy: "current" });
  const projected = makeWeaponCandidates(bow, { loadUpPolicy: "match-c3" });
  const currentC4 = current.find(w => w.treeId === 2 && w.chargeSlot === 4);
  const projectedC4 = projected.find(w => w.treeId === 2 && w.chargeSlot === 4);
  assert.equal(currentC4.chargeType, "Heavy");
  assert.equal(projectedC4.chargeType, "Rapid");
  assert.equal(projectedC4.chargeLevel, 4);
  assert.equal(projectedC4.requiresLoadUp, true);
  assert.equal(projectedC4.projectedLoadUpType, true);
});

test("element damage does not depend on physical MV values", () => {
  const weapon = makeWeaponCandidates(makeBow()).find(w => w.treeId === 2 && w.chargeSlot === 3);
  const changedMVs = { ...weapon, rawMotionValues: [100, 100, 100] };
  const a = calculateVolley(weapon, part, { profile: PROFILE.elemental, coatingMode: "none", elementCoatingMode: "none" });
  const b = calculateVolley(changedMVs, part, { profile: PROFILE.elemental, coatingMode: "none", elementCoatingMode: "none" });
  assert.equal(a.elementalDamage, b.elementalDamage);
  assert.notEqual(a.rawDamage, b.rawDamage);
});

test("element coating affects only elemental damage, not RAW", () => {
  const weapon = makeWeaponCandidates(makeBow()).find(w => w.treeId === 2 && w.chargeSlot === 3);
  const none = calculateVolley(weapon, part, { profile: PROFILE.elemental, coatingMode: "none", elementCoatingMode: "none" });
  const coated = calculateVolley(weapon, part, { profile: PROFILE.elemental, coatingMode: "native", elementCoatingMode: "native" });
  assert.equal(none.rawDamage, coated.rawDamage);
  assert.ok(coated.elementalDamage > none.elementalDamage);
});

test("Power coating affects only RAW, not the elemental component", () => {
  const weapon = makeWeaponCandidates(makeBow()).find(w => w.treeId === 2 && w.chargeSlot === 3);
  const none = calculateVolley(weapon, part, { profile: PROFILE.raw, coatingMode: "none", elementCoatingMode: "none" });
  const coated = calculateVolley(weapon, part, { profile: PROFILE.raw, coatingMode: "native", elementCoatingMode: "native" });
  assert.ok(coated.rawDamage > none.rawDamage);
  assert.equal(coated.elementalDamage, none.elementalDamage);
});

test("one stack over 100 volleys gives separate 50-use Power and 20-use Element Coat averages", () => {
  const powerII = { multiplier: 1.5, capacity: 50 };
  const elementII = { multiplier: 1.5, capacity: 20 };
  assert.equal(averageCoatingMultiplier(powerII, 100), 1.25);
  assert.equal(averageCoatingMultiplier(elementII, 100), 1.10);
  assert.equal(averageCoatingMultiplier(elementII, 100, 0.2), 1.125);
});


test("hitzone source accepts the external MHGU window global format", () => {
  const parsed = parseHitzones('window.MONSTER_DATA = {"version":2,"monsters":[{"name":"Rathian","large":true,"tables":[[[0,"Head",90,80,70,0,15,15,20,35,100,100]]]}]};');
  assert.equal(parsed.monsters[0].name, "Rathian");
  assert.equal(parsed.monsters[0].tables[0][0][4], 70);
});

test("unlocking missing coating II and Load Up are charged as extra skill slots", () => {
  const bow = makeWeaponCandidates(makeBow(), { loadUpPolicy: "match-c3" })
    .find(w => w.treeId === 2 && w.chargeSlot === 4);
  const result = calculateVolley(bow, part, {
    profile: PROFILE.elemental,
    coatingMode: "none",
    elementCoatingMode: "unlock-II"
  });
  assert.equal(result.loadUpSkillSlots, 1);
  assert.equal(result.coatingSkillSlots, 0); // this test bow has native Element Coating II
  assert.equal(result.totalSkillSlots, 6);
  const noCoatingBow = { ...bow, coatings: [] };
  const unlock = calculateVolley(noCoatingBow, part, {
    profile: PROFILE.elemental,
    coatingMode: "none",
    elementCoatingMode: "unlock-II"
  });
  assert.equal(unlock.coatingSkillSlots, 1);
  assert.equal(unlock.totalSkillSlots, 7);
});

test("simulation separates LR and G, reports hitzone assumptions and normalized budgets", () => {
  const result = simulateBowBalance(makeBow(), hitzoneData, {
    loadUpPolicy: "match-c3",
    shotsPerStack: 100,
    skillBudgets: [5, 6]
  });
  assert.equal(result.meta.monsterCount, 1);
  assert.ok(result.meta.weaponsByRank.LR > 0);
  assert.ok(result.meta.weaponsByRank.G > 0);
  const lr = result.matchups.find(row => row.rank === "LR" && row.shotType === "Rapid" && row.scenario === "uncoated" && row.skillBudget === 5);
  const g = result.matchups.find(row => row.rank === "G" && row.shotType === "Rapid" && row.scenario === "uncoated" && row.skillBudget === 5);
  assert.ok(lr?.rawBest);
  assert.ok(lr?.elementBest);
  assert.ok(g?.rawBest);
  assert.equal(lr.firstHitzoneTableOnly, true);
  assert.equal(lr.assumesEveryArrowHitsSamePart, true);
  assert.equal(result.meta.loadUpPolicy, "match-c3");
});
