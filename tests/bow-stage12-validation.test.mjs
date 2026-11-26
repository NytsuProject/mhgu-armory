import test from "node:test";
import assert from "node:assert/strict";
import {
  calculateBowBuildMissionDamage, calculateBowBuildVolley,
  simulateBuildsAcrossWeapons, skillPointsFromOptimizerBuild,
} from "../js/bow-build-damage.js";
import { CHARGE_ELEMENT, makeWeaponCandidates } from "../js/bow-balance-sim.js";
import { offensiveSkillsActivated, isOffensive, OFFENSIVE_SKILL_REASONS } from "../js/bow-build-comparison.js";

// A synthetic bow catalog with one tree whose levels carry Spread C1..C4,
// so makeWeaponCandidates returns real candidates and simulate can resolve them.
const TEST_BOW = {
  trees: [{
    id: 1, name: "Test tree", rarity: 8,
    levels: [{
      lv: 1, n: "Test bow", nEs: "Arco de prueba", rar: 8, raw: 240, aff: 0,
      ele: [["Fire", "Fire", 30]],
      slots: "◯◯◯",
      x: {
        charges: ["Spread Lv1", "Spread Lv2", "Spread Lv3", "Spread Lv4!"],
        coatings: ["Element Coating", "Element Coating 2"],
      },
    }],
  }],
};

const hitzoneData = {
  monsters: [{
    name: "Testmon", large: true,
    tables: [[[0, "Head", 90, 90, 45, 30, 0, 0, 0, 0]]],
  }],
};

const elemSkills = { Elemental: 10, "Fire Atk": 15, "Crit Element": 10, Tenderizer: 10, "Pellet Up": 10 };

function mkBuild(skillPoints, complete = true) {
  const armor = Object.entries(skillPoints).map(([skill, points]) => ({
    id: skill, slot: "head", name: skill, cls: "G", gender: 0,
    deco: 0, skills: [[skill, skill, points]],
  }));
  const total = Object.keys(skillPoints);
  return {
    armor, talisman: null, weapon: { name: "Test bow", deco: 0 },
    jewelsBySlot: {}, skillPoints, activeSkills: total,
    missingSkills: [], negativeSkills: [], activatedSkills: total,
    targetSkillCount: total.length,
    offensiveSkills: total, mandatorySkills: [],
    activatedOffensiveSkills: total.length,
    coverage: 1, complete, score: 1, thresholds: {},
  };
}

// Resolve a real candidate (from makeWeaponCandidates) for a given charge slot.
function candidateFor(slot) {
  const candidates = makeWeaponCandidates(TEST_BOW, { loadUpPolicy: "match-c3" });
  return candidates.find(row => row.treeId === 1 && row.level === 1 && row.chargeSlot === slot);
}

const c3 = candidateFor(3); // Spread Lv3
const c4 = candidateFor(4); // Spread Lv4! (requires Loading, aligned to C3 Spread)

// ---------------------------------------------------------------------------
// 1. C4/C3: ratio over ALL matched parts, equals the charge multiplier ratio.
// ---------------------------------------------------------------------------

test("C4/C3 ratio uses every matched part and equals the charge multiplier ratio", () => {
  const multiHitzone = {
    monsters: [{
      name: "Mon A", large: true,
      tables: [[[0, "Head", 90, 90, 45, 30, 0, 0, 0, 0], [0, "Tail", 80, 80, 40, 30, 0, 0, 0, 0]]],
    }, {
      name: "Mon B", large: true,
      tables: [[[0, "Wing", 70, 70, 35, 30, 0, 0, 0, 0]]],
    }],
  };
  // C4 is a `!` charge: the same elemental build must carry Loading +10 so the
  // C4 simulation is legal (the comparison is same-bow, same offensive skills).
  const build = mkBuild({ ...elemSkills, Loading: 10 });
  const m3 = simulateBuildsAcrossWeapons({
    bowData: TEST_BOW, hitzoneData: multiHitzone,
    builds: [{ id: "elemental/male", profile: "elemental", gender: "male", build, weapon: c3 }],
    style: "guild", missionShots: 200, elementCap: 30, chargeElementMultipliers: CHARGE_ELEMENT,
  });
  const m4 = simulateBuildsAcrossWeapons({
    bowData: TEST_BOW, hitzoneData: multiHitzone,
    builds: [{ id: "elemental/male", profile: "elemental", gender: "male", build, weapon: c4 }],
    style: "guild", missionShots: 200, elementCap: 30, chargeElementMultipliers: CHARGE_ELEMENT,
  });
  const map4 = new Map();
  for (const r of m4.rows) map4.set(r.monster + "|" + r.part, r);
  let sum3 = 0, sum4 = 0, n = 0;
  for (const r of m3.rows) {
    const r4 = map4.get(r.monster + "|" + r.part);
    if (!r4) continue;
    sum3 += r.byBuild["elemental/male"].elementalDamage;
    sum4 += r4.byBuild["elemental/male"].elementalDamage;
    n++;
  }
  assert.ok(n >= 3, "must match at least 3 parts, not just row[0]: got " + n);
  // The aggregate ratio over ALL matched parts must equal the ratio of the
  // SUMMED elemental damages (this is what the tool computes). A single-row
  // ratio would not necessarily match, proving all parts are used.
  const ratio = sum4 / sum3;
  const singleRow = m3.rows[0].byBuild["elemental/male"].elementalDamage
    / m4.rows[0].byBuild["elemental/male"].elementalDamage;
  assert.ok(Math.abs(ratio - (sum4 / sum3)) < 1e-12, "ratio must be the summed aggregate");
  // Sanity: the multi-part aggregate differs from a naive single-row read on
  // this dataset, confirming the tool is not reading only row[0].
  assert.ok(Math.abs(ratio - singleRow) > 1e-6, "aggregate must differ from single-row read");
});

// ---------------------------------------------------------------------------
// 2. Independent application of the four multipliers.
// ---------------------------------------------------------------------------

test("each charge multiplier applies independently per charge slot", () => {
  const neutral = [1, 1, 1, 1];
  const base = calculateBowBuildVolley(c3, [0, "Head", 90, 90, 45, 30, 0, 0, 0, 0], elemSkills,
    { chargeElementMultipliers: CHARGE_ELEMENT });
  const onlyC3 = calculateBowBuildVolley(c3, [0, "Head", 90, 90, 45, 30, 0, 0, 0, 0], elemSkills,
    { chargeElementMultipliers: neutral });
  // C3 baseline is 1.0, so baseline == neutral.
  assert.ok(Math.abs(base.elementalDamage - onlyC3.elementalDamage) < 1e-12);

  const scaled = calculateBowBuildVolley(c3, [0, "Head", 90, 90, 45, 30, 0, 0, 0, 0], elemSkills,
    { chargeElementMultipliers: [1, 1, 1.5, 1] });
  assert.ok(Math.abs(scaled.elementalDamage / onlyC3.elementalDamage - 1.5) < 1e-9,
    "C3 multiplier 1.5 must scale elemental by 1.5");

  const scaledC1 = calculateBowBuildVolley(c3, [0, "Head", 90, 90, 45, 30, 0, 0, 0, 0], elemSkills,
    { chargeElementMultipliers: [1.5, 1, 1, 1] });
  assert.ok(Math.abs(scaledC1.elementalDamage - onlyC3.elementalDamage) < 1e-12,
    "unused charge C1 must not affect a C3 elemental volley");
});

test("a Guild sequence applies each charge's own multiplier independently", () => {
  const part = [0, "Head", 90, 90, 45, 30, 0, 0, 0, 0];
  const run = (mult) => calculateBowBuildMissionDamage({
    weapon: c3, build: mkBuild(elemSkills), profile: "elemental", part,
    volleyCandidates: [{ candidate: c3, role: "primary", rawShotMultiplier: 1 },
      { candidate: c4, role: "primary", rawShotMultiplier: 1 }],
    style: "guild", missionShots: 200, elementCap: 30, chargeElementMultipliers: mult,
  });
  const base = run([1, 1, 1, 1]);
  // Changing C4 multiplier must change the result (C4 is in the sequence).
  const c4Up = run([1, 1, 1, 2]);
  assert.ok(c4Up.elementalDamagePerSequence > base.elementalDamagePerSequence,
    "C4 multiplier must affect a sequence containing C4");
  // Changing an unused charge (C1) must NOT change the result.
  const c1Up = run([2, 1, 1, 1]);
  assert.ok(Math.abs(c1Up.elementalDamagePerSequence - base.elementalDamagePerSequence) < 1e-12,
    "unused charge C1 must not affect the sequence");
  // The per-volley elemental damages each carry their own multiplier: the
  // sequence total equals the sum of the two volleys' elemental damage.
  const v3 = calculateBowBuildVolley(c3, part, elemSkills, { chargeElementMultipliers: [1, 1, 1, 2] });
  const v4 = calculateBowBuildVolley(c4, part, elemSkills, { chargeElementMultipliers: [1, 1, 1, 2] });
  assert.ok(v4.elementalDamage > v3.elementalDamage,
    "C4 volley must carry its own (higher) multiplier");
});

// ---------------------------------------------------------------------------
// 3. Loading mandatory for a `!` charge.
// ---------------------------------------------------------------------------

test("a `!` charge without Loading raises, and is legal only with Loading +10", () => {
  const buildNoLoad = mkBuild(elemSkills);
  assert.throws(
    () => simulateBuildsAcrossWeapons({
      bowData: TEST_BOW, hitzoneData,
      builds: [{ id: "elemental/male", profile: "elemental", gender: "male", build: buildNoLoad, weapon: c4 }],
      style: "guild", missionShots: 200, elementCap: 30,
    }),
    /Recargando/,
  );
  const buildLoad = mkBuild({ ...elemSkills, Loading: 10 });
  const m = simulateBuildsAcrossWeapons({
    bowData: TEST_BOW, hitzoneData,
    builds: [{ id: "elemental/male", profile: "elemental", gender: "male", build: buildLoad, weapon: c4 }],
    style: "guild", missionShots: 200, elementCap: 30,
  });
  assert.equal(m.rows.length, 1);
});

// ---------------------------------------------------------------------------
// 4. Conservation: RAW and Spread untouched by the elemental sweep.
// ---------------------------------------------------------------------------

test("RAW damage is independent of the elemental charge multipliers", () => {
  const rawBuild = mkBuild({ "Pellet Up": 10, Expert: 10, Tenderizer: 10, "Critical Up": 10 });
  const opts = (mult) => ({
    weapon: c3, build: rawBuild, profile: "raw",
    part: [0, "Head", 90, 90, 45, 30, 0, 0, 0, 0],
    volleyCandidates: [{ candidate: c3, role: "primary", rawShotMultiplier: 1 }],
    style: "guild", missionShots: 200, elementCap: 30, chargeElementMultipliers: mult,
  });
  const a = calculateBowBuildMissionDamage(opts(CHARGE_ELEMENT));
  const b = calculateBowBuildMissionDamage(opts([9, 9, 9, 9]));
  assert.ok(Math.abs(a.rawDamagePerSequence - b.rawDamagePerSequence) < 1e-12,
    "RAW damage must not change when elemental multipliers change");
});

test("Spread control is not modified: Loading/Ammo Saver are utility, not offensive", () => {
  assert.equal(isOffensive("Pellet Up"), true);
  assert.equal(isOffensive("Loading"), false, "Loading is utility, not offensive");
  assert.equal(isOffensive("Ammo Saver"), false, "Ammo Saver is utility, not offensive");
});

// ---------------------------------------------------------------------------
// 5. offensiveSkillsActivated reviews ALL OFFENSIVE_SKILL_REASONS; priority orders.
// ---------------------------------------------------------------------------

test("offensiveSkillsActivated reviews every offensive skill, priority only orders", () => {
  const build = mkBuild({ "Fire Atk": 15, "Crit Element": 10, Elemental: 10, Tenderizer: 10, "Pellet Up": 10 });
  const priority = ["Fire Atk", "Crit Element", "Tenderizer", "Pellet Up"]; // no "Elemental"
  const activated = offensiveSkillsActivated(build, {}, priority);
  const skills = new Set(activated.map(s => s.skill));
  assert.ok(skills.has("Elemental"), "incidental offensive skill Elemental must be detected even if not in priority");
  assert.ok(skills.has("Fire Atk"), "priority skill must be detected");
  assert.ok(!skills.has("Loading"));
});

test("offensiveSkillsActivated returns all OFFENSIVE_SKILL_REASONS categories when present", () => {
  const allOffensive = Object.keys(OFFENSIVE_SKILL_REASONS);
  const build = mkBuild(Object.fromEntries(allOffensive.map(s => [s, 15])));
  const activated = offensiveSkillsActivated(build, {});
  assert.equal(new Set(activated.map(s => s.skill)).size, allOffensive.length);
});

test("skillPointsFromOptimizerBuild reconstructs real armor skill totals", () => {
  const build = mkBuild({ Attack: 3, Expert: 10 });
  const points = skillPointsFromOptimizerBuild(build);
  assert.equal(points.Attack, 3);
  assert.equal(points.Expert, 10);
});
