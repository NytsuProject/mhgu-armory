#!/usr/bin/env node
// Stage 11: fair comparison of RAW, Elemental and Hybrid bow builds.
//
// Class A (controlled): one fixed bow + one shot type for all three profiles,
// isolating the skill-config contribution.
// Class B (optimized per specialization): each profile picks its best available
// G-rank bow for the shot type, respecting catalog, charges, coverages and
// real coatings.
//
// Runs optimizeBowBuild at an equal activated-skill budget and feeds the
// resulting builds into simulateBowBuildHitzoneMatrix over the vendored 93
// monster hitzones. Outputs a JSON artifact consumed by the report generator.

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { parseHitzones } from "../js/bow-balance-sim.js";
import { simulateBowBuildHitzoneMatrix } from "../js/bow-build-damage.js";
import { runProfileComparison, offensivePriority } from "../js/bow-build-comparison.js";
import { BOW_ELEMENT_SKILLS } from "../js/bow-build-feasibility.js";

function readArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i++) {
    const token = argv[i];
    if (!token.startsWith("--")) throw new Error("Argumento inesperado: " + token);
    const body = token.slice(2), equals = body.indexOf("=");
    if (equals >= 0) {
      args[body.slice(0, equals)] = body.slice(equals + 1);
    } else {
      const value = argv[i + 1];
      if (!value || value.startsWith("--")) throw new Error("Falta el valor de --" + body);
      args[body] = value; i++;
    }
  }
  return args;
}
const readJson = path => JSON.parse(readFileSync(resolve(path), "utf8"));

const SHOT_TYPES = ["Spread", "Pierce", "Rapid", "Heavy"];

function parseCharges(weapon) {
  return (weapon.x?.charges || []).map(value => {
    const m = /^(Rapid|Pierce|Spread|Heavy) Lv([1-5])(!)?$/.exec(value || "");
    if (!m) return null;
    return { type: m[1], level: Number(m[2]), requiresLoadUp: Boolean(m[3]) };
  }).filter(Boolean);
}

function findElement(weapon) {
  return (weapon.ele || []).find(row => BOW_ELEMENT_SKILLS[row?.[1]]) || null;
}

// Best G-rank bow for a shot type. For elemental/hybrid profiles the bow must
// carry an elemental charge. Ranking uses catalog raw display (plus element
// value for elemental/hybrid) as a deterministic, documented criterion; it is
// not a guarantee of optimal in-game damage.
function selectBestBow(bowData, shotType, requireElement) {
  const candidates = [];
  for (const tree of bowData.trees) {
    for (const level of tree.levels || []) {
      const rank = Number(level.rar || 0) >= 8 ? "G" : (Number(level.rar || 0) >= 4 ? "HR" : "LR");
      if (rank !== "G") continue;
      const charges = parseCharges(level);
      const slots = charges.map((c, i) => ({ ...c, slot: i + 1 }))
        .filter(c => c.type === shotType);
      if (!slots.length) continue;
      const element = findElement(level);
      if (requireElement && !element) continue;
      // Prefer a charge without the `!` marker (no Load Up requirement): a `!`
      // charge demands the non-offensive Loading skill, which breaks the equal
      // offensive-skill budget. Fall back only when the shot type has none.
      const noLoadUp = slots.filter(c => !c.requiresLoadUp);
      const bestSlot = (noLoadUp.length ? noLoadUp : slots).reduce((a, b) => (b.level > a.level ? b : a));
      const raw = Number(level.raw || 0);
      const elemValue = element ? Number(element[2]) : 0;
      const score = requireElement ? raw + elemValue * 2 : raw;
      candidates.push({ treeId: Number(tree.id), level: Number(level.lv), chargeSlot: bestSlot.slot, shotType, element, weapon: level, rank, rarity: Number(level.rar || 0), raw, elemValue, score });
    }
  }
  if (!candidates.length) return null;
  candidates.sort((a, b) => b.score - a.score || b.raw - a.raw);
  return candidates[0];
}

function runClassA({ armorData, decorations, talismanSkills, skillLevels, bowData, hitzoneData, shotType, budget, switchShots, out }) {
  // Controlled class: one fixed bow (Elizabeth atenta, tree 104, level 3) and
  // one shot type. Spread is the control shot type (never modified).
  const treeId = 104, level = 3;
  const tree = bowData.trees.find(row => Number(row.id) === treeId);
  const weapon = tree.levels.find(row => Number(row.lv) === level);
  const charges = parseCharges(weapon);
  const slot = charges.findIndex(c => c.type === shotType);
  if (slot < 0) throw new Error("El arco control no tiene carga " + shotType);
  const buildOutput = runProfileComparison({
    armorData, decorations, talismanSkills, skillLevels, bowData,
    treeId, level, chargeSlot: slot + 1, shotType, coatingPolicy: "low-cost",
    rank: "G", genders: ["male", "female"], activeSkillBudget: budget,
    talismanPolicy: "max", allowNegatives: false, beamWidth: 300,
  });
  const matrix = simulateBowBuildHitzoneMatrix({
    bowData, buildOutput, hitzoneData, style: "guild",
    missionShots: 200, coatingSwitchShots: switchShots, elementCap: 30,
  });
  return {
    class: "A", shotType, budget, switchShots,
    bow: { treeId, level, name: weapon.nEs, chargeSlot: slot + 1 },
    builds: buildOutput.comparisons,
    matrix,
  };
}

function selectBestBowCompletable({ armorData, decorations, talismanSkills, skillLevels, bowData, shotType, requireElement, profile, budget }) {
  // Enumerate candidate G bows for the shot type, then keep only those whose
  // optimized build can actually complete the budget. Among completable bows,
  // rank by catalog score (raw display, plus element value for elemental/hybrid).
  // If none completes, fall back to the best-ranked bow and flag it.
  const candidates = [];
  for (const tree of bowData.trees) {
    for (const level of tree.levels || []) {
      const rank = Number(level.rar || 0) >= 8 ? "G" : (Number(level.rar || 0) >= 4 ? "HR" : "LR");
      if (rank !== "G") continue;
      const charges = parseCharges(level);
      const slots = charges.map((c, i) => ({ ...c, slot: i + 1 }))
        .filter(c => c.type === shotType);
      if (!slots.length) continue;
      const element = findElement(level);
      if (requireElement && !element) continue;
      // Prefer a charge without the `!` marker (no Load Up requirement): a `!`
      // charge demands the non-offensive Loading skill, which breaks the equal
      // offensive-skill budget. Fall back only when the shot type has none.
      const noLoadUp = slots.filter(c => !c.requiresLoadUp);
      const bestSlot = (noLoadUp.length ? noLoadUp : slots).reduce((a, b) => (b.level > a.level ? b : a));
      const raw = Number(level.raw || 0);
      const elemValue = element ? Number(element[2]) : 0;
      const score = requireElement ? raw + elemValue * 2 : raw;
      candidates.push({ treeId: Number(tree.id), level: Number(level.lv), chargeSlot: bestSlot.slot, shotType, element, weapon: level, rank, rarity: Number(level.rar || 0), raw, elemValue, score });
    }
  }
  if (!candidates.length) return { bow: null, note: "No hay arco G con esa carga" + (requireElement ? " y elemento" : "") + "." };
  const completable = [];
  const incomplete = [];
  for (const candidate of candidates) {
    const probe = runProfileComparison({
      armorData, decorations, talismanSkills, skillLevels, bowData,
      treeId: candidate.treeId, level: candidate.level, chargeSlot: candidate.chargeSlot,
      shotType, coatingPolicy: "low-cost", rank: "G", genders: ["male"],
      activeSkillBudget: budget, talismanPolicy: "max", allowNegatives: false,
      beamWidth: 80, topBuilds: 1, topTalismansPerArmor: 3,
      profiles: [profile],
    });
    const build = probe.comparisons[0]?.builds?.[0];
    if (build && build.complete) completable.push(candidate);
    else incomplete.push(candidate);
  }
  const pool = completable.length ? completable : incomplete;
  pool.sort((a, b) => b.score - a.score || b.raw - a.raw);
  const bow = pool[0];
  return { bow, completable: completable.length, incomplete: incomplete.length };
}

function runClassB({ armorData, decorations, talismanSkills, skillLevels, bowData, hitzoneData, shotType, budget, switchShots, out }) {
  const profiles = [
    { profile: "raw", requireElement: false },
    { profile: "elemental", requireElement: true },
    { profile: "hybrid", requireElement: true },
  ];
  const results = [];
  for (const { profile, requireElement } of profiles) {
    const { bow, note, completable, incomplete } = selectBestBowCompletable({
      armorData, decorations, talismanSkills, skillLevels, bowData,
      shotType, requireElement, profile, budget,
    });
    if (!bow) {
      results.push({ profile, shotType, budget, switchShots, bow: null, note: note || "No hay arco G con esa carga." });
      continue;
    }
    const buildOutput = runProfileComparison({
      armorData, decorations, talismanSkills, skillLevels, bowData,
      treeId: bow.treeId, level: bow.level, chargeSlot: bow.chargeSlot, shotType,
      coatingPolicy: "low-cost", rank: "G", genders: ["male", "female"],
      activeSkillBudget: budget, talismanPolicy: "max", allowNegatives: false,
      beamWidth: 300,
    });
    const matrix = simulateBowBuildHitzoneMatrix({
      bowData, buildOutput, hitzoneData, style: "guild",
      missionShots: 200, coatingSwitchShots: switchShots, elementCap: 30,
    });
    results.push({
      profile, shotType, budget, switchShots,
      bow: { treeId: bow.treeId, level: bow.level, name: bow.weapon.nEs, chargeSlot: bow.chargeSlot, raw: bow.raw, element: bow.element },
      selection: { completable, incomplete, completed: completable > 0 },
      builds: buildOutput.comparisons,
      matrix,
    });
  }
  return { class: "B", shotType, budget, switchShots, profiles: results };
}

function main() {
  const args = readArgs(process.argv);
  const armorDir = resolve(args["armor-dir"] || "data/armor");
  const armorData = readJson(resolve(armorDir, "pieces.json"));
  const decorations = readJson(resolve(armorDir, "decorations.json"));
  const talismanSkills = readJson(resolve(armorDir, "talisman-skills.json"));
  const skillLevels = readJson(resolve(armorDir, "skill-levels.json"));
  const bowData = readJson(args.bows || "data/weapons/bow.json");
  const hitzoneData = parseHitzones(readFileSync(resolve(args.hitzones || "tools/data-hitzones.js"), "utf8"));

  const shotType = args["shot-type"] || "Spread";
  const budget = Number(args.budget || 5);
  const switchShots = Number(args["switch-shots"] || 0);
  const classArg = args.class || "both";
  if (!["a", "b", "both"].includes(classArg)) throw new Error("--class debe ser a, b o both.");
  const out = resolve(args.out || "tools/out/stage11/bow-build-comparison.json");
  if (!SHOT_TYPES.includes(shotType)) throw new Error("shot-type debe ser Spread, Pierce, Rapid o Heavy.");

  const payload = {
    model: "MHGU bow build fair comparison stage 11",
    generatedAt: new Date().toISOString(),
    shotType, budget, switchShots, elementCap: 30,
    ...(classArg === "b" ? {} : { classA: runClassA({ armorData, decorations, talismanSkills, skillLevels, bowData, hitzoneData, shotType, budget, switchShots, out }) }),
    ...(classArg === "a" ? {} : { classB: runClassB({ armorData, decorations, talismanSkills, skillLevels, bowData, hitzoneData, shotType, budget, switchShots, out }) }),
  };
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, JSON.stringify(payload, null, 2) + "\n", "utf8");
  console.log("MHGU bow build fair comparison (stage 11)");
  console.log("shot type=" + shotType + " | budget=" + budget + " | switch shots=" + switchShots);
  if (payload.classA) {
    console.log("clase A: arco fijo tree 104 lv3 | arco=" + payload.classA.bow.name);
    for (const row of payload.classA.builds) {
      const b = row.builds?.[0];
      console.log("  A " + row.profile + "/" + row.gender + ": " + (b ? b.activatedSkills + "/" + b.targetSkillCount + (b.complete ? " completa" : " parcial") : "sin build"));
    }
  }
  for (const row of payload.classB.profiles) {
    console.log("  B " + row.profile + ": " + (row.bow ? row.bow.name + " (slot " + row.bow.chargeSlot + ")" : row.note));
    for (const c of row.builds || []) {
      const b = c.builds?.[0];
      console.log("    " + c.profile + "/" + c.gender + ": " + (b ? b.activatedSkills + "/" + b.targetSkillCount + (b.complete ? " completa" : " parcial") : "sin build"));
    }
  }
  if (payload.classA?.matrix) {
    for (const group of payload.classA.matrix.summary) {
      console.log("ratio A " + group.target + " vs " + group.reference + ": " + group.meanRatioAllParts?.toFixed(3) + " (todas partes) / " + group.meanBestPartRatioPerMonster?.toFixed(3) + " (mejor parte)");
    }
  }
  console.log("Informe JSON: " + out);
}
try { main(); } catch (error) { console.error("Error: " + error.message); process.exitCode = 1; }
