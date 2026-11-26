#!/usr/bin/env node
// Stage 12: fair comparison of RAW, Elemental and Hybrid bow builds.
//
// Class A (controlled): one fixed bow + one shot type for all three profiles,
// isolating the skill-config contribution.
// Class B (optimized per specialization): each profile picks its best available
// bow for the shot type and rank (LR/HR/G), respecting catalog, charges,
// coverages and real coatings. `!` (C4) charges are INCLUDED so C4-with-Loading
// performance can be studied; Loading is a mandatory non-offensive requirement
// and never counts toward the offensive budget.
//
// Search limit (declared): bow selection is a two-stage search.
//   1. Screening: every eligible bow is ranked by an analytic damage estimate
//      (representative skill points over the average large-monster hitzones).
//   2. Shortlist: the top `--selection-limit` candidates by screening score are
//      optimized and evaluated by REAL matrix damage; the best is selected.
// The full catalog is never optimizer-evaluated; the limit is recorded in the
// artifact (screening.totalEligible, screening.shortlistSize, screening.criterion).
//
// Builds that do not complete the offensive budget are marked `comparable:
// false` and excluded from the official ratios.

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import {
  parseHitzones, CHARGE_RAW, CHARGE_ELEMENT, SHOT_MVS, SHOT_TYPE_UP,
  BOW_DISPLAY_RAW_MULTIPLIER,
} from "../js/bow-balance-sim.js";
import { simulateBowBuildHitzoneMatrix, simulateBuildsAcrossWeapons, meanBuildDamage } from "../js/bow-build-damage.js";
import { runProfileComparison, offensivePriority, offensiveSkillsActivated } from "../js/bow-build-comparison.js";
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
const ELEMENTS = Object.keys(BOW_ELEMENT_SKILLS);

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

function rankFromRarity(rarity) {
  const value = Number(rarity || 0);
  if (value >= 8) return "G";
  if (value >= 4) return "HR";
  return "LR";
}

// Average large-monster shotHz and per-element elementHz, used by the screening
// estimate so all bows are scored on the same representative hitzone mix.
function screeningContext(hitzoneData) {
  const monsters = hitzoneData.monsters.filter(m => m.large && m.tables?.[0]?.length);
  let shotSum = 0, shotCount = 0;
  const elemSum = Object.fromEntries(ELEMENTS.map(e => [e, 0]));
  for (const monster of monsters) for (const part of monster.tables[0]) {
    shotSum += Number(part[4] || 0); shotCount++;
    for (const [idx, element] of Object.entries(ELEMENTS)) {
      elemSum[element] += Number(part[5 + Number(idx)] || 0);
    }
  }
  return {
    avgShotHz: shotCount ? shotSum / shotCount : 45,
    avgElementHz: Object.fromEntries(Object.entries(elemSum).map(([e, s]) => [e, shotCount ? s / shotCount : 20])),
  };
}

// Analytic per-volley damage estimate for a bow + charge, using representative
// skill points and the average hitzone mix. Deterministic and comparable across
// bows; used only to prune the catalog to a shortlist (the shortlist is then
// evaluated by real matrix damage).
function screeningScore({ weapon, chargeSlot, shotType, element, profile, ctx }) {
  const slot = chargeSlot - 1;
  const charges = parseCharges(weapon);
  const charge = charges[slot];
  if (!charge) return null;
  const mv = SHOT_MVS[shotType]?.[charge.level] || [];
  const mvTotal = mv.reduce((a, b) => a + b, 0);
  const shotUp = SHOT_TYPE_UP[shotType] || 1;
  const repAttack = profile === "raw" || profile === "hybrid" ? 20 : 0;
  const repCrit = profile === "raw" ? 1.40 : 1.35;
  const trueRaw = Number(weapon.raw || 0) / BOW_DISPLAY_RAW_MULTIPLIER + repAttack;
  const rawPerVolley = trueRaw * CHARGE_RAW[slot] * 1.5 * (mvTotal / 100)
    * (ctx.avgShotHz / 100) * shotUp * repCrit;
  const elemEntry = profile === "raw" ? null : findElement(weapon);
  const elemValue = elemEntry ? Number(elemEntry[2]) : 0;
  const elemHz = elemEntry ? ctx.avgElementHz[elemEntry[1]] : 0;
  const elemPerVolley = elemEntry
    ? (elemValue / 10) * CHARGE_ELEMENT[slot] * mv.length * (elemHz / 100) * 1.35
    : 0;
  return rawPerVolley + elemPerVolley;
}

// Enumerate ALL eligible bows for a shot type and rank, INCLUDING `!` (C4)
// charges. Each candidate keeps its highest charge of the requested shot type
// (preferring a non-`!` charge only as a tie-break on level).
function enumerateProfileCandidates(bowData, shotType, requireElement, bowRank = "G", preferredChargeSlot = null, preferredElement = null) {
  const candidates = [];
  for (const tree of bowData.trees) {
    for (const level of tree.levels || []) {
      const rank = rankFromRarity(level.rar);
      if (rank !== bowRank) continue;
      const charges = parseCharges(level);
      const slots = charges.map((c, i) => ({ ...c, slot: i + 1 }))
        .filter(c => c.type === shotType);
      if (!slots.length) continue;
      const element = findElement(level);
      if (requireElement && !element) continue;
      if (requireElement && preferredElement && element[1] !== preferredElement) continue;
      // If a preferred charge slot is requested (e.g. C1 for early-progression
      // study), the bow must HAVE that slot; bows lacking it are skipped so the
      // study is restricted to bows that actually use the requested charge.
      let bestSlot;
      if (preferredChargeSlot) {
        bestSlot = slots.find(c => c.slot === preferredChargeSlot) || null;
        if (!bestSlot) continue;
      } else {
        bestSlot = slots.slice().sort((a, b) => b.level - a.level || Number(a.requiresLoadUp) - Number(b.requiresLoadUp))[0];
      }
      const raw = Number(level.raw || 0);
      const elemValue = element ? Number(element[2]) : 0;
      candidates.push({
        treeId: Number(tree.id), level: Number(level.lv), chargeSlot: bestSlot.slot,
        shotType, element, weapon: level, rank, rarity: Number(level.rar || 0),
        raw, elemValue, requiresLoadUp: bestSlot.requiresLoadUp,
        weaponSpec: { treeId: Number(tree.id), level: Number(level.lv), chargeSlot: bestSlot.slot, rank, shotType, name: level.nEs || level.n },
      });
    }
  }
  return candidates;
}

/**
 * Class-B bow selection for one profile. Screening ranks ALL eligible bows by
 * an analytic estimate; the top `selectionLimit` form the shortlist. Each
 * shortlist bow is optimized (completability probe) and, when completable,
 * evaluated by real mean damage; the best is selected. If no shortlist bow
 * completes the budget, the profile is marked non-comparable.
 */
function selectProfileBow({ armorData, decorations, talismanSkills, skillLevels, bowData, hitzoneData, shotType, requireElement, profile, budget, talismanPolicy, bowRank = "G", selectionLimit = 16, preferredChargeSlot = null, preferredElement = null }) {
  const ctx = screeningContext(hitzoneData);
  const candidates = enumerateProfileCandidates(bowData, shotType, requireElement, bowRank, preferredChargeSlot, preferredElement);
  if (!candidates.length) {
    return { bow: null, note: "No hay arco " + bowRank + " con esa carga." + (requireElement ? " y elemento." : ""), screening: { totalEligible: 0, shortlistSize: 0 } };
  }
  for (const candidate of candidates) {
    candidate.screening = screeningScore({
      weapon: candidate.weapon, chargeSlot: candidate.chargeSlot, shotType,
      element: candidate.element?.[1] || null, profile, ctx,
    });
  }
  const sorted = candidates.slice().sort((a, b) => (b.screening || 0) - (a.screening || 0) || b.raw - a.raw);
  const shortlist = sorted.slice(0, Math.max(1, Number(selectionLimit) || 16));
  const completable = [], incomplete = [];
  for (const candidate of shortlist) {
    const probe = runProfileComparison({
      armorData, decorations, talismanSkills, skillLevels, bowData,
      treeId: candidate.treeId, level: candidate.level, chargeSlot: candidate.chargeSlot,
      shotType, coatingPolicy: "low-cost", rank: bowRank, genders: ["male"],
      activeSkillBudget: budget, talismanPolicy, allowNegatives: false,
      beamWidth: 80, topBuilds: 1, topTalismansPerArmor: 3,
      profiles: [profile],
    });
    const build = probe.comparisons[0]?.builds?.[0];
    if (build && build.complete) completable.push({ ...candidate, build });
    else incomplete.push({ ...candidate, build });
  }
  const pool = completable;
  for (const candidate of pool) {
    candidate.damage = meanBuildDamage({
      bowData, build: candidate.build, profile,
      weapon: candidate.weaponSpec, hitzoneData,
      style: "guild", missionShots: 200, elementCap: 30,
    });
  }
  pool.sort((a, b) => b.damage - a.damage || (b.screening || 0) - (a.screening || 0));
  const bow = pool[0] || null;
  return {
    bow, completable: completable.length, incomplete: incomplete.length,
    shortlistSize: shortlist.length, screening: {
      totalEligible: candidates.length, shortlistSize: shortlist.length,
      criterion: "analytic damage estimate (representative skill points over average large-monster hitzones); shortlist then evaluated by real matrix damage",
    },
  };
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

function runClassB({ armorData, decorations, talismanSkills, skillLevels, bowData, hitzoneData, shotType, budget, switchShots, out, talismanPolicy, bowRank = "G", selectionLimit = 16, preferredChargeSlot = null, preferredElementArg = null, includeLegacyHybrid = false }) {
  const profiles = [
    { profile: "raw", requireElement: false },
    { profile: "elemental", requireElement: true },
  ];
  // El perfil híbrido es LEGADO y queda fuera del sistema oficial. Solo se
  // incluye bajo bandera explícita para compatibilidad histórica.
  if (includeLegacyHybrid) {
    profiles.push({ profile: "hybrid", requireElement: true, legacy: true });
  }
  const selected = [];
  const allBuilds = [];
  for (const { profile, requireElement } of profiles) {
    // El perfil elemental oficial puede restringirse a un elemento concreto
    // (--element) para las matrices por elemento.
    const preferredElement = profile === "elemental" ? preferredElementArg : null;
    const { bow, note, completable, incomplete, shortlistSize, screening } = selectProfileBow({
      preferredChargeSlot, preferredElement,
      armorData, decorations, talismanSkills, skillLevels, bowData, hitzoneData,
      shotType, requireElement, profile, budget, talismanPolicy, bowRank, selectionLimit,
    });
    const entry = { profile, shotType, budget, switchShots, screening, selection: { completable, incomplete, shortlistSize } };
    if (!bow) {
      selected.push({ ...entry, bow: null, comparable: false, note: note || "No hay arco." });
      continue;
    }
    // Final build for the selected bow, full beam, both genders.
    const buildOutput = runProfileComparison({
      armorData, decorations, talismanSkills, skillLevels, bowData,
      treeId: bow.treeId, level: bow.level, chargeSlot: bow.chargeSlot, shotType,
      coatingPolicy: "low-cost", rank: bowRank, genders: ["male", "female"],
      activeSkillBudget: budget, talismanPolicy, allowNegatives: false,
      beamWidth: 300, profiles: [profile],
    });
    const builds = [];
    let comparable = false;
    for (const comparison of buildOutput.comparisons) {
      const build = comparison.builds?.[0];
      if (!build) continue;
      const isComparable = Boolean(build.complete);
      comparable = comparable || isComparable;
      const priority = offensivePriority(profile, shotType, bow.element?.[1] || null);
      const entry2 = {
        id: comparison.profile + "/" + comparison.gender,
        profile: comparison.profile, gender: comparison.gender,
        build, comparable: isComparable,
        offensiveSkillsActivated: offensiveSkillsActivated(build, skillLevels, priority),
        weapon: bow.weaponSpec,
      };
      builds.push(entry2);
      allBuilds.push(entry2);
    }
    selected.push({
      ...entry,
      bow: { treeId: bow.treeId, level: bow.level, name: bow.weapon.nEs, chargeSlot: bow.chargeSlot, raw: bow.raw, element: bow.element, damage: bow.damage, requiresLoadUp: bow.requiresLoadUp },
      comparable,
      builds,
    });
  }
  const matrix = allBuilds.length
    ? simulateBuildsAcrossWeapons({
        bowData, builds: allBuilds, hitzoneData, style: "guild",
        missionShots: 200, coatingSwitchShots: switchShots, elementCap: 30,
      })
    : {
        metadata: { model: "no comparable builds", note: "Ningún perfil completó el presupuesto ofensivo a este rango/presupuesto: matriz vacía, ratios no disponibles." },
        summary: [], rows: [],
      };
  return { class: "B", shotType, budget, switchShots, bowRank, profiles: selected, matrix };
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
  const budget = Number(args.budget || 4);
  const switchShots = Number(args["switch-shots"] || 0);
  const classArg = args.class || "both";
  if (!["a", "b", "both"].includes(classArg)) throw new Error("--class debe ser a, b o both.");
  const talismanPolicy = args["talisman-policy"] || "verified";
  if (!["max", "legal", "conservative", "verified"].includes(talismanPolicy)) {
    throw new Error("--talisman-policy debe ser max, legal, conservative o verified.");
  }
  const bowRank = args["bow-rank"] || "G";
  if (!["LR", "HR", "G"].includes(bowRank)) throw new Error("--bow-rank debe ser LR, HR o G.");
  const selectionLimit = Number(args["selection-limit"] || 16);
  const preferredChargeSlot = args["preferred-charge-slot"] != null ? Number(args["preferred-charge-slot"]) : null;
  const includeLegacyHybrid = Boolean(args["include-legacy-hybrid"]);
  const preferredElementArg = args.element || null;
  const out = resolve(args.out || "tools/out/stage12/bow-build-comparison.json");
  if (!SHOT_TYPES.includes(shotType)) throw new Error("shot-type debe ser Spread, Pierce, Rapid o Heavy.");

  const payload = {
    model: "MHGU bow build fair comparison stage 12",
    generatedAt: new Date().toISOString(),
    shotType, budget, switchShots, elementCap: 30, talismanPolicy, bowRank,
    selectionLimit,
    theoretical: talismanPolicy === "max",
    ...(classArg === "b" ? {} : { classA: runClassA({ armorData, decorations, talismanSkills, skillLevels, bowData, hitzoneData, shotType, budget, switchShots, out, talismanPolicy }) }),
    ...(classArg === "a" ? {} : { classB: runClassB({ armorData, decorations, talismanSkills, skillLevels, bowData, hitzoneData, shotType, budget, switchShots, out, talismanPolicy, bowRank, selectionLimit, preferredChargeSlot, preferredElementArg, includeLegacyHybrid }) }),
  };
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, JSON.stringify(payload, null, 2) + "\n", "utf8");
  console.log("MHGU bow build fair comparison (stage 14, especializaciones oficiales)");
  console.log("shot type=" + shotType + " | budget=" + budget + " | bow rank=" + bowRank + " | talismans=" + talismanPolicy + (talismanPolicy === "max" ? " (TEÓRICO)" : "") + " | shortlist=" + selectionLimit + (preferredChargeSlot ? " | carga preferida=C" + preferredChargeSlot : "") + (preferredElementArg ? " | elemento=" + preferredElementArg : ""));
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
  if (payload.classB) {
  for (const row of payload.classB.profiles) {
    console.log("  B " + row.profile + ": " + (row.bow ? row.bow.name + " (slot " + row.bow.chargeSlot + (row.bow.requiresLoadUp ? ", C4!)" : "") + ")" : row.note) + (row.comparable ? "" : " [NO COMPARABLE]"));
    for (const c of row.builds || []) {
      const b = c.build;
      console.log("    " + c.profile + "/" + c.gender + ": " + (b ? b.activatedSkills + "/" + b.targetSkillCount + (b.complete ? " completa" : " parcial") + " ofensivas=" + (c.offensiveSkillsActivated || []).map(s => s.skill).join(",") : "sin build"));
    }
  }
  }
  console.log("Informe JSON: " + out);
}
try { main(); } catch (error) { console.error("Error: " + error.message); process.exitCode = 1; }
