import test from "node:test";
import assert from "node:assert/strict";
import {
  calculateBowBuildMissionDamage, calculateBowBuildVolley, elementalDisplayValue,
  simulateBowBuildHitzoneMatrix, skillPointsFromOptimizerBuild,
} from "../js/bow-build-damage.js";

const weapon = {
  name: "Elizabeth atenta", treeId: 104, level: 3, rawDisplay: 250, affinity: 0,
  elements: [{ type: "Water", display: 30 }],
  coatings: ["Element Coating", "Element Coating 2"],
  chargeSlot: 3, chargeType: "Spread", chargeLevel: 5, rawMotionValues: [5, 5, 6, 5, 5],
  requiresLoadUp: false,
};
const part = [0, "Head", 90, 90, 45, 0, 30, 0, 0, 0];
const fullSkills = { Elemental: 10, "Water Atk": 15, "Crit Element": 10, Tenderizer: 10, "Pellet Up": 10 };
const partialSkills = { Elemental: 10, "Water Atk": 10, "Crit Element": 10, Tenderizer: 10, "Pellet Up": 10, "Power C+": 10 };

test("Elemental and specific element skills stack additively to the 20% cap and preserve flat bonus", () => {
  assert.equal(elementalDisplayValue(30, "Water", fullSkills), 42);
  assert.equal(elementalDisplayValue(30, "Water", partialSkills), 38);
  assert.equal(elementalDisplayValue(30, "Water", { "Water Atk": 15 }), 39);
  assert.equal(elementalDisplayValue(30, "Water", { Elemental: 10 }), 33);
});

test("real skill points affect the actual bow volley, affinity and shot-type bonus", () => {
  const full = calculateBowBuildVolley(weapon, part, fullSkills);
  const partial = calculateBowBuildVolley(weapon, part, partialSkills);
  assert.equal(full.affinity, 50);
  assert.equal(full.shotUp, 1.30);
  assert.equal(full.effectiveElementValue, 42);
  assert.equal(partial.effectiveElementValue, 38);
  assert.ok(full.elementalDamage > partial.elementalDamage);
  assert.ok(Math.abs(full.elementalDamage / partial.elementalDamage - 42 / 38) < 1e-12);
});

test("build skill reconstruction honours Torso Up and decorations in their own slots", () => {
  const totals = skillPointsFromOptimizerBuild({
    armor: [
      { slot: "chest", skills: [["Attack", "Ataque", 3]] },
      { slot: "arms", skills: [["Torso Up", "Torso+", 0]] },
      { slot: "head", skills: [["Water Atk", "Atq. agua", 2]] },
    ],
    talisman: { skills: [["Water Atk", "Atq. agua", 4]] },
    jewelsBySlot: {
      chest: [{ cost: 1, skills: [["Attack", "Ataque", 1]] }],
      head: [{ cost: 1, skills: [["Water Atk", "Atq. agua", 1]] }],
    },
  });
  assert.equal(totals.Attack, 8);
  assert.equal(totals["Water Atk"], 7);
});

test("hybrid uses Element Coat first and Power Coat second; switch penalty loses a whole volley", () => {
  const sequence = [{ candidate: weapon }, { candidate: weapon }];
  const hybridBuild = { armor: [], talisman: { skills: [["Power C+", "Rev. potencia", 10]] }, jewelsBySlot: {} };
  const noSwitch = calculateBowBuildMissionDamage({
    weapon, build: hybridBuild, profile: "hybrid", part, volleyCandidates: sequence,
    missionShots: 200, coatingSwitchShots: 0,
  });
  const withSwitch = calculateBowBuildMissionDamage({
    weapon, build: hybridBuild, profile: "hybrid", part, volleyCandidates: sequence,
    missionShots: 200, coatingSwitchShots: 1,
  });
  assert.equal(withSwitch.coatings.elementTier, 2);
  assert.equal(withSwitch.coatings.powerTier, 1);
  assert.equal(withSwitch.coatings.elementExpectedShots, 30);
  assert.equal(withSwitch.coatings.powerExpectedShots, 70);
  assert.equal(withSwitch.coatings.switchShots, 1);
  assert.ok(withSwitch.totalDamagePerSequence < noSwitch.totalDamagePerSequence);
});

test("raw, elemental and hybrid coat different components only", () => {
  const sequence = [{ candidate: weapon }, { candidate: weapon }];
  const raw = calculateBowBuildMissionDamage({
    weapon, build: { armor: [], talisman: { skills: [["Power C+", "Rev. potencia", 10]] }, jewelsBySlot: {} },
    profile: "raw", part, volleyCandidates: sequence,
  });
  const elemental = calculateBowBuildMissionDamage({
    weapon, build: { armor: [], talisman: null, jewelsBySlot: {} },
    profile: "elemental", part, volleyCandidates: sequence,
  });
  assert.equal(raw.coatings.powerTier, 1);
  assert.equal(raw.coatings.elementTier, 0);
  assert.equal(elemental.coatings.powerTier, 0);
  assert.equal(elemental.coatings.elementTier, 2);
  assert.ok(raw.rawDamagePerSequence > elemental.rawDamagePerSequence);
  assert.ok(elemental.elementalDamagePerSequence > raw.elementalDamagePerSequence);
});

test("same weapon, charge and part are paired for the monster hitzone matrix", () => {
  const bowData = {
    class: "bow",
    trees: [{
      id: 104, rarity: 9,
      levels: [{
        lv: 3, rar: 9, nEs: "Elizabeth atenta", raw: 250, aff: 0,
        ele: [["Agua", "Water", 30]],
        x: { charges: ["Spread Lv3", "Spread Lv4", "Spread Lv5", "Pierce Lv5!"], coatings: ["Element Coating", "Element Coating 2"] },
      }],
    }],
  };
  const build = { armor: [], talisman: null, jewelsBySlot: {}, complete: true, activatedSkills: 0, targetSkillCount: 0 };
  const buildOutput = {
    weapon: { treeId: 104, level: 3, charge: { slot: 3, level: 5, effectiveType: "Spread" } },
    comparisons: [
      { profile: "raw", gender: "male", builds: [build] },
      { profile: "elemental", gender: "male", builds: [build] },
      { profile: "hybrid", gender: "male", builds: [build] },
    ],
  };
  const hitzones = { monsters: [{ name: "Monster test", large: true, tables: [[[0, "Head", 90, 90, 45, 0, 30, 0, 0, 0]]] }] };
  const result = simulateBowBuildHitzoneMatrix({ bowData, buildOutput, hitzoneData: hitzones });
  assert.equal(result.metadata.monsterCount, 1);
  assert.equal(result.metadata.partRows, 1);
  assert.equal(result.summary.length, 3);
  assert.ok(result.rows[0].byBuild["raw/male"].totalDamage > 0);
});
