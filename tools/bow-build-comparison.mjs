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
import { simulateBowBuildHitzoneMatrix, simulateBuildsAcrossWeapons, meanBuildDamage } from "../js/bow-build-damage.js";
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

function runClassA({ armorData, decorations, talismanSkills, skillLevels, bowData, hitzoneData, shotType, budget, switchShots, out, talismanPolicy }) {
  // Controlled class: one fixed bow (Elizabeth atenta, tree 104, level 3) and
  // one shot type. Spread is the control shot type (never modified).
  const treeId = 104, level = 3;
  const tree = bowData.trees.find(row => Number(row.id) === treeId);
  const weapon = tree.levels.find(row => Number(row.lv) === level);
  const charges = parseCharges(weapon);
  const slot = charges.findIndex(c => c.type === shotType);
  if (slot < 0) {
    return {
      class: "A", shotType, budget, switchShots,
      bow: null, note: "El arco control (Elizabeth atenta, tree 104 lv3) no tiene carga " + shotType + ": clase A no aplicable.",
    };
  }
  const buildOutput = runProfileComparison({
    armorData, decorations, talismanSkills, skillLevels, bowData,
    treeId, level, chargeSlot: slot + 1, shotType, coatingPolicy: "low-cost",
    rank: "G", genders: ["male", "female"], activeSkillBudget: budget,
    talismanPolicy, allowNegatives: false, beamWidth: 300,
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

// Rango por rareza del catálogo: G >= 8, HR 4..7, LR < 4.
function rankFromRarity(rarity) {
  const value = Number(rarity || 0);
  if (value >= 8) return "G";
  if (value >= 4) return "HR";
  return "LR";
}

// Enumerate candidate bows for a shot type and bow rank (LR/HR/G). Only
// non-`!` charges are considered: a `!` charge demands the non-offensive
// Loading skill, which breaks the equal offensive-skill budget. For each bow,
// take its highest non-`!` charge of the requested shot type.
function enumerateProfileCandidates(bowData, shotType, requireElement, bowRank = "G") {
  const candidates = [];
  for (const tree of bowData.trees) {
    for (const level of tree.levels || []) {
      const rank = rankFromRarity(level.rar);
      if (rank !== bowRank) continue;
      const charges = parseCharges(level);
      const slots = charges.map((c, i) => ({ ...c, slot: i + 1 }))
        .filter(c => c.type === shotType && !c.requiresLoadUp);
      if (!slots.length) continue;
      const element = findElement(level);
      if (requireElement && !element) continue;
      const bestSlot = slots.reduce((a, b) => (b.level > a.level ? b : a));
      const raw = Number(level.raw || 0);
      const elemValue = element ? Number(element[2]) : 0;
      const score = requireElement ? raw + elemValue * 2 : raw;
      candidates.push({
        treeId: Number(tree.id), level: Number(level.lv), chargeSlot: bestSlot.slot,
        shotType, element, weapon: level, rank, rarity: Number(level.rar || 0),
        raw, elemValue, score,
        weaponSpec: { treeId: Number(tree.id), level: Number(level.lv), chargeSlot: bestSlot.slot, rank, shotType, name: level.nEs || level.n },
      });
    }
  }
  return candidates;
}

/**
 * Class-B bow selection for one profile. Candidates are pruned to those whose
 * optimized build completes the budget, the top candidates by catalog score
 * are evaluated by REAL mean damage over the 93-monster matrix, and the best
 * is selected. Each profile therefore picks its own bow by actual damage.
 */
function selectProfileBow({ armorData, decorations, talismanSkills, skillLevels, bowData, hitzoneData, shotType, requireElement, profile, budget, talismanPolicy, bowRank = "G", topCandidates = 4, probeLimit = 12 }) {
  const candidates = enumerateProfileCandidates(bowData, shotType, requireElement, bowRank);
  if (!candidates.length) {
    return { bow: null, note: "No hay arco G con esa carga (sin Recargando)" + (requireElement ? " y elemento" : "") + "." };
  }
  // Probe completability only for the best-ranked candidates by catalog score:
  // the optimizer run is the expensive step, and the low-score bows are not
  // going to win a real-damage comparison anyway.
  const sorted = [...candidates].sort((a, b) => b.score - a.score || b.raw - a.raw);
  const probed = sorted.slice(0, Math.max(1, Number(probeLimit) || 12));
  const completable = [], incomplete = [];
  for (const candidate of probed) {
    const probe = runProfileComparison({
      armorData, decorations, talismanSkills, skillLevels, bowData,
      treeId: candidate.treeId, level: candidate.level, chargeSlot: candidate.chargeSlot,
      shotType, coatingPolicy: "low-cost", rank: "G", genders: ["male"],
      activeSkillBudget: budget, talismanPolicy, allowNegatives: false,
      beamWidth: 80, topBuilds: 1, topTalismansPerArmor: 3,
      profiles: [profile],
    });
    const build = probe.comparisons[0]?.builds?.[0];
    if (build && build.complete) completable.push({ ...candidate, build });
    else incomplete.push({ ...candidate, build });
  }
  const pool = completable.length ? completable : incomplete;
  pool.sort((a, b) => b.score - a.score || b.raw - a.raw);
  const evaluated = pool.slice(0, Math.max(1, Number(topCandidates) || 4));
  for (const candidate of evaluated) {
    candidate.damage = meanBuildDamage({
      bowData, build: candidate.build, profile,
      weapon: candidate.weaponSpec, hitzoneData,
      style: "guild", missionShots: 200, elementCap: 30,
    });
  }
  evaluated.sort((a, b) => b.damage - a.damage || b.score - a.score);
  const bow = evaluated[0];
  return { bow, completable: completable.length, incomplete: incomplete.length, probed: probed.length, evaluated };
}

function runClassB({ armorData, decorations, talismanSkills, skillLevels, bowData, hitzoneData, shotType, budget, switchShots, out, talismanPolicy, bowRank = "G", topCandidates = 4 }) {
  const profiles = [
    { profile: "raw", requireElement: false },
    { profile: "elemental", requireElement: true },
    { profile: "hybrid", requireElement: true },
  ];
  const selected = [];
  const allBuilds = [];
  for (const { profile, requireElement } of profiles) {
    const { bow, note, completable, incomplete, probed, evaluated } = selectProfileBow({
      armorData, decorations, talismanSkills, skillLevels, bowData, hitzoneData,
      shotType, requireElement, profile, budget, talismanPolicy, bowRank, topCandidates,
    });
    if (!bow) {
      selected.push({ profile, shotType, budget, switchShots, bow: null, note: note || "No hay arco G con esa carga." });
      continue;
    }
    // Final build for the selected bow, full beam, both genders.
    const buildOutput = runProfileComparison({
      armorData, decorations, talismanSkills, skillLevels, bowData,
      treeId: bow.treeId, level: bow.level, chargeSlot: bow.chargeSlot, shotType,
      coatingPolicy: "low-cost", rank: "G", genders: ["male", "female"],
      activeSkillBudget: budget, talismanPolicy, allowNegatives: false,
      beamWidth: 300, profiles: [profile],
    });
    const builds = [];
    for (const comparison of buildOutput.comparisons) {
      const build = comparison.builds?.[0];
      if (!build) continue;
      const entry = {
        id: comparison.profile + "/" + comparison.gender,
        profile: comparison.profile, gender: comparison.gender,
        build, weapon: bow.weaponSpec,
      };
      builds.push(entry);
      allBuilds.push(entry);
    }
    selected.push({
      profile, shotType, budget, switchShots,
      bow: { treeId: bow.treeId, level: bow.level, name: bow.weapon.nEs, chargeSlot: bow.chargeSlot, raw: bow.raw, element: bow.element, damage: bow.damage },
      selection: { completable, incomplete, probed, completed: completable > 0, evaluated: evaluated.map(e => ({ name: e.weapon.nEs, damage: e.damage, raw: e.raw, elemValue: e.elemValue })) },
      builds: buildOutput.comparisons,
    });
  }
  const matrix = simulateBuildsAcrossWeapons({
    bowData, builds: allBuilds, hitzoneData, style: "guild",
    missionShots: 200, coatingSwitchShots: switchShots, elementCap: 30,
  });
  return { class: "B", shotType, budget, switchShots, profiles: selected, matrix };
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
  const talismanPolicy = args["talisman-policy"] || "conservative";
  if (!["max", "legal", "conservative"].includes(talismanPolicy)) {
    throw new Error("--talisman-policy debe ser max, legal o conservative.");
  }
  const bowRank = args["bow-rank"] || "G";
  if (!["LR", "HR", "G"].includes(bowRank)) throw new Error("--bow-rank debe ser LR, HR o G.");
  const out = resolve(args.out || "tools/out/stage11/bow-build-comparison.json");
  if (!SHOT_TYPES.includes(shotType)) throw new Error("shot-type debe ser Spread, Pierce, Rapid o Heavy.");

  const payload = {
    model: "MHGU bow build fair comparison stage 11",
    generatedAt: new Date().toISOString(),
    shotType, budget, switchShots, elementCap: 30, talismanPolicy, bowRank,
    theoretical: talismanPolicy === "max",
    ...(classArg === "b" ? {} : { classA: runClassA({ armorData, decorations, talismanSkills, skillLevels, bowData, hitzoneData, shotType, budget, switchShots, out, talismanPolicy }) }),
    ...(classArg === "a" ? {} : { classB: runClassB({ armorData, decorations, talismanSkills, skillLevels, bowData, hitzoneData, shotType, budget, switchShots, out, talismanPolicy, bowRank }) }),
  };
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, JSON.stringify(payload, null, 2) + "\n", "utf8");
  console.log("MHGU bow build fair comparison (stage 11)");
  console.log("shot type=" + shotType + " | budget=" + budget + " | switch shots=" + switchShots + " | bow rank=" + bowRank + " | talismans=" + talismanPolicy + (talismanPolicy === "max" ? " (TEÓRICO, no es build legal confirmado)" : " (confirmado legal)"));
  if (payload.classA) {
    if (!payload.classA.matrix) {
      console.log("clase A: " + (payload.classA.note || "no disponible"));
    } else {
      console.log("clase A: arco fijo tree 104 lv3 | arco=" + payload.classA.bow.name);
      for (const row of payload.classA.builds) {
        const b = row.builds?.[0];
        console.log("  A " + row.profile + "/" + row.gender + ": " + (b ? b.activatedSkills + "/" + b.targetSkillCount + (b.complete ? " completa" : " parcial") : "sin build"));
      }
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
