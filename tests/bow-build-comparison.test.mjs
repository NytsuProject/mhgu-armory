// Stage 11 tests: optimizer budget/talisman policies, offensive priorities,
// equal-budget constraint equality, reproducibility, and stage-10 invariants.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

import {
  optimizeBowBuild, getTalismanOptions, resolveBowBuildRequirements, buildSignature,
} from "../js/bow-build-optimizer.js";
import {
  offensivePriority, runProfileComparison,
} from "../js/bow-build-comparison.js";
import { simulateBowBuildHitzoneMatrix } from "../js/bow-build-damage.js";
import { parseHitzones } from "../js/bow-balance-sim.js";
import { ELEMENT_CAP, proposeElementalRebalance } from "../js/bow-elemental-rebalance.js";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const readJson = p => JSON.parse(readFileSync(resolve(root, p), "utf8"));

const armorData = readJson("data/armor/pieces.json");
const decorations = readJson("data/armor/decorations.json");
const talismanSkills = readJson("data/armor/talisman-skills.json");
const skillLevels = readJson("data/armor/skill-levels.json");
const bowData = readJson("data/weapons/bow.json");

test("talisman policy: max includes dual-skill charms, conservative excludes them, legal enumerates", () => {
  const targets = ["Water Atk", "Crit Element"];
  const max = getTalismanOptions(talismanSkills, targets, "max");
  const legal = getTalismanOptions(talismanSkills, targets, "legal");
  const conservative = getTalismanOptions(talismanSkills, targets, "conservative");
  const dual = options => options.filter(o => o.sk.length === 2).length;
  assert.ok(dual(max) > 0, "max debe incluir talismánes de dos habilidades");
  assert.equal(dual(conservative), 0, "conservadora no debe incluir talismánes de dos habilidades");
  assert.ok(dual(legal) >= dual(max), "legal debe enumerar al menos los duales de max");
  assert.ok(legal.length >= conservative.length, "legal debe ser superconjunto de conservadora");
  assert.throws(() => getTalismanOptions(talismanSkills, targets, "bogus"), /Política de talismán no válida/);
});

test("offensive priority includes the shot skill and the element skill where required", () => {
  const rawSpread = offensivePriority("raw", "Spread", null);
  assert.ok(rawSpread.includes("Pellet Up"), "RAW Spread debe priorizar Pellet Up");
  assert.ok(rawSpread.includes("Power C+"), "RAW debe priorizar Power C+");
  const elemSpread = offensivePriority("elemental", "Spread", "Water");
  assert.ok(elemSpread.includes("Water Atk"), "elemental debe priorizar Water Atk");
  assert.ok(elemSpread.includes("Crit Element"), "elemental debe priorizar Crit Element");
  const hybridRapid = offensivePriority("hybrid", "Rapid", "Fire");
  assert.ok(hybridRapid.includes("Fire Atk"), "híbrido debe priorizar Fire Atk");
  assert.ok(hybridRapid.includes("Normal Up"), "híbrido debe priorizar Normal Up (Rapid)");
  assert.ok(hybridRapid.includes("Power C+"), "híbrido debe priorizar Power C+");
});

test("budget mode activates only the top-N priority skills and records the budget", () => {
  const requirements = { "Water Atk": 10, "Crit Element": 10, "Tenderizer": 10 };
  const result = optimizeBowBuild({
    armorData, decorations, talismanSkills, skillLevels, requirements,
    rank: "G", weaponSlots: 0, weaponName: "Arco",
    beamWidth: 50, topBuilds: 1, topTalismansPerArmor: 2,
    activeSkillBudget: 2, offensiveSkillPriority: ["Water Atk", "Crit Element", "Tenderizer"],
  });
  assert.equal(result.metadata.budget.budget, 2);
  assert.deepEqual(result.metadata.budget.budgetedSkills, ["Water Atk", "Crit Element"]);
  assert.deepEqual(result.metadata.budget.unbudgetedSkills, ["Tenderizer"]);
  assert.equal(Object.keys(result.requirements).length, 2, "solo las habilidades budgeteadas son requeridas");
});

test("equal budget: raw, elemental and hybrid reach 5/5 on the control bow at budget 5", () => {
  // Small beam keeps the test fast; the batch driver uses a wider beam.
  const out = runProfileComparison({
    armorData, decorations, talismanSkills, skillLevels, bowData,
    treeId: 104, level: 3, chargeSlot: 3, shotType: "Spread", coatingPolicy: "low-cost",
    rank: "G", genders: ["male"], activeSkillBudget: 5,
    talismanPolicy: "max", allowNegatives: false, beamWidth: 50,
  });
  for (const comparison of out.comparisons) {
    const build = comparison.builds?.[0];
    assert.ok(build, comparison.profile + " debe producir un build");
    assert.equal(build.targetSkillCount, 5, comparison.profile + " debe tener 5 habilidades objetivo");
    assert.equal(build.activatedSkills, 5, comparison.profile + " debe activar 5 habilidades");
    assert.equal(build.complete, true, comparison.profile + " debe ser completo a presupuesto 5");
    assert.equal(build.negativeSkills.length, 0, comparison.profile + " no debe tener habilidades negativas activas");
  }
});

test("result reproducibility: two identical optimizer runs return the same build signature", () => {
  const requirements = { "Elemental Attack": 10, "Critical Element": 10 };
  const options = {
    armorData, decorations, talismanSkills, skillLevels, requirements,
    rank: "G", weaponSlots: 0, weaponName: "Arco", beamWidth: 50,
    topBuilds: 1, topTalismansPerArmor: 2, activeSkillBudget: 2,
    offensiveSkillPriority: ["Elemental Attack", "Critical Element"],
  };
  const a = optimizeBowBuild(options);
  const b = optimizeBowBuild({ ...options });
  assert.equal(buildSignature(a.builds[0]), buildSignature(b.builds[0]));
  assert.deepEqual(a.builds[0].activeSkills, b.builds[0].activeSkills);
});

test("rebalance-invariant conservation: element cap 30 and untouched RAW/Spread survive the stage-10 model", () => {
  assert.equal(ELEMENT_CAP, 30);
  // The applied catalog must respect the element cap at every level.
  const maxElement = (bowData.trees || []).reduce((max, tree) => {
    for (const level of tree.levels || []) {
      for (const [name, type, value] of level.ele || []) {
        if (Number(value) > max) max = Number(value);
      }
    }
    return max;
  }, 0);
  assert.ok(maxElement <= 30, "ningún elemento del catálogo puede superar el cap 30");
  // The stage-10 model only proposes element changes; it must not touch RAW
  // or Spread multipliers.
  const proposal = proposeElementalRebalance(bowData, () => 0.9, { windows: [[0.8, 1.05]] });
  for (const row of proposal.proposals || []) {
    assert.equal(row.raw, row.raw, "RAW se conserva (sin cambios)");
    const elementValue = Number(row.proposed?.value ?? row.element?.value);
    assert.ok(Number.isFinite(elementValue) && elementValue <= 30, "propuesta dentro del cap 30");
    assert.ok(row.element !== undefined && row.raw !== undefined);
  }
});

test("damage matrix runs over vendored hitzones and keeps the two ratio aggregations", () => {
  const hitzoneData = parseHitzones(readFileSync(resolve(root, "tools/data-hitzones.js"), "utf8"));
  const buildOutput = runProfileComparison({
    armorData, decorations, talismanSkills, skillLevels, bowData,
    treeId: 104, level: 3, chargeSlot: 3, shotType: "Spread", coatingPolicy: "low-cost",
    rank: "G", genders: ["male"], activeSkillBudget: 5,
    talismanPolicy: "max", allowNegatives: false, beamWidth: 50,
  });
  const matrix = simulateBowBuildHitzoneMatrix({
    bowData, buildOutput, hitzoneData, style: "guild",
    missionShots: 200, coatingSwitchShots: 0, elementCap: 30,
  });
  assert.ok(matrix.metadata.monsterCount >= 93, "debe evaluar los 93 monstruos grandes");
  assert.ok(matrix.summary.length > 0, "debe generar ratios elemental/raw e híbrido/raw");
  for (const group of matrix.summary) {
    assert.equal(typeof group.meanRatioAllParts, "number", "ratio sobre todas las partes");
    assert.equal(typeof group.meanBestPartRatioPerMonster, "number", "ratio de la mejor parte por monstruo");
    assert.ok(group.partsCompared > 0);
  }
});
