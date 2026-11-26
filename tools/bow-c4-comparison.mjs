#!/usr/bin/env node
// Stage 12, parte B: comparación real C3 vs C4 (`!`) con Recargando.
//
// Para cada tipo de disparo y rango, se elige un arco elemental representativo
// que tenga una carga C4 marcada `!`. Con el MISMO arco y builds controladas se
// compara:
//   - C3 (carga 3, sin Recargando) frente a C4 (carga 4 `!`, con Recargando).
//   - la ratio elemental/RAW en C3 y en C4.
//   - el ratio C4/C3 de daño (efecto de desbloquear C4 pagando Recargando).
//
// Recargando es utilidad, no ofensiva: se añade como requisito obligatorio cuando
// el arma lo necesita, no consume puesto del presupuesto ofensivo y su coste en
// espacios/habilidades se contabiliza. Se mantiene la regla C4 alineada a C3
// (misma flecha, nivel y marcador) y las 6 excepciones C3 intactas.

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import {
  parseHitzones, CHARGE_RAW, CHARGE_ELEMENT, SHOT_MVS, SHOT_TYPE_UP,
  BOW_DISPLAY_RAW_MULTIPLIER,
} from "../js/bow-balance-sim.js";
import { simulateBowBuildHitzoneMatrix } from "../js/bow-build-damage.js";
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

function buildBowForC4(bowData, shotType, bowRank) {
  // Best elemental bow of the rank that has a C4 `!` charge, by analytic score.
  let best = null, bestScore = -1;
  for (const tree of bowData.trees) {
    for (const level of tree.levels || []) {
      if (rankFromRarity(level.rar) !== bowRank) continue;
      const element = findElement(level);
      if (!element) continue;
      const charges = parseCharges(level);
      const c3 = charges[2], c4 = charges[3];
      if (!c3 || !c4 || !c4.requiresLoadUp) continue;
      // After C4 alignment, C4 uses C3's arrow type; require the C3 to be the shot type.
      if (c3.type !== shotType) continue;
      const mv = SHOT_MVS[shotType]?.[c4.level] || [];
      const mvTotal = mv.reduce((a, b) => a + b, 0);
      const trueRaw = Number(level.raw || 0) / BOW_DISPLAY_RAW_MULTIPLIER;
      const rawScore = trueRaw * CHARGE_RAW[3] * 1.5 * (mvTotal / 100) * 0.45 * (SHOT_TYPE_UP[shotType] || 1);
      const elemScore = (Number(element[2]) / 10) * CHARGE_ELEMENT[3] * mv.length * 0.20 * 1.35;
      const score = rawScore + elemScore;
      if (score > bestScore) { bestScore = score; best = { treeId: Number(tree.id), level: Number(level.lv), weapon: level, c3Slot: 3, c4Slot: 4, element, score }; }
    }
  }
  return best;
}

// Find the highest budget <= maxBudget at which the C3 build COMPLETES for the
// chosen bow/rank. The C3 build is the controlled reference: it must be complete
// for the elem/raw baseline to be valid. The same budget is then used for the C4
// build (C4 may still be incomplete because Loading consumes space; that is the
// finding, not a crash). Returns { budget, comparison }.
function findCompletableC3Budget(bowDataFull, armorData, decorations, talismanSkills, skillLevels, chosen, shotType, bowRank, maxBudget) {
  for (let b = maxBudget; b >= 1; b--) {
    const out2 = runProfileComparison({
      armorData, decorations, talismanSkills, skillLevels, bowData: bowDataFull,
      treeId: chosen.treeId, level: chosen.level, chargeSlot: chosen.c3Slot, shotType,
      coatingPolicy: "low-cost", rank: bowRank, genders: ["male"],
      activeSkillBudget: b, talismanPolicy: "verified", allowNegatives: false,
      beamWidth: 300, topBuilds: 1, profiles: ["raw", "elemental"],
    });
    const elBuild = out2.comparisons.find(c => c.profile === "elemental")?.builds?.[0];
    if (elBuild && elBuild.complete) return { budget: b, comparison: out2 };
  }
  return { budget: maxBudget, comparison: null };
}

function matrixRatios(matrix, targetId, referenceId) {
  const group = (matrix.summary || []).find(g => g.target === targetId && g.reference === referenceId);
  return group ? { meanRatioAllParts: group.meanRatioAllParts, meanBestPartRatioPerMonster: group.meanBestPartRatioPerMonster, partWins: group.partWins, partsCompared: group.partsCompared } : null;
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

  const budget = Number(args.budget || 4);
  const talismanPolicy = args["talisman-policy"] || "verified";
  const ranks = (args.ranks || "LR,HR,G").split(",").map(s => s.trim()).filter(Boolean);
  const out = resolve(args.out || "tools/out/stage12/c4-comparison.json");
  const csv = resolve(args.csv || "tools/out/stage12/c4-comparison.csv");

  const rows = [];
  const payload = {
    model: "MHGU bow C3 vs C4 (Loading) comparison stage 12",
    generatedAt: new Date().toISOString(),
    budget, talismanPolicy, elementCap: 30,
    note: "Recargando es utilidad: requisito obligatorio, no cuenta en el presupuesto ofensivo. C4 `!` alineado a C3 (misma flecha, nivel y marcador).",
    results: [],
  };

  for (const shotType of SHOT_TYPES) {
    for (const bowRank of ranks) {
      const chosen = buildBowForC4(bowData, shotType, bowRank);
      if (!chosen) {
        rows.push([shotType, bowRank, "", "", "sin arco C4", "", "", "", "", ""]);
        continue;
      }
      // The C3 build is the controlled reference and must be COMPLETE for its
      // elem/raw baseline to be valid. Use the highest budget (<= maxBudget) at
      // which C3 completes, then apply the SAME budget to C4 so the comparison is
      // controlled (same bow, same offensive budget; C4 additionally needs Loading).
      const c3 = findCompletableC3Budget(bowData, armorData, decorations, talismanSkills, skillLevels, chosen, shotType, bowRank, budget);
      const effBudget = c3.budget;
      if (!c3.comparison) {
        // No budget at which the C3 build completes: no controlled baseline exists.
        rows.push([shotType, bowRank, chosen.weapon.nEs || chosen.weapon.n, chosen.element[1],
          "C4!", "", "", "", "no", "sin C3 completable"]);
        console.log(shotType + " " + bowRank + ": " + (chosen.weapon.nEs || chosen.weapon.n)
          + " | C3 no completable en ningun presupuesto <= " + budget + ": no comparable");
        continue;
      }
      const builds = {};
      builds["c3"] = c3.comparison;
      const c4Out = runProfileComparison({
        armorData, decorations, talismanSkills, skillLevels, bowData,
        treeId: chosen.treeId, level: chosen.level, chargeSlot: 4, shotType,
        coatingPolicy: "low-cost", rank: bowRank, genders: ["male"],
        activeSkillBudget: effBudget, talismanPolicy, allowNegatives: false,
        beamWidth: 300, topBuilds: 1, profiles: ["raw", "elemental"],
      });
      builds["c4"] = c4Out;
      // Build C4 may be incomplete (Loading not activated). A `!` charge cannot
      // be simulated without Loading +10, so guard the matrix computation: if the
      // elemental C4 build is not complete or lacks Loading, leave the C4 matrix
      // empty (ratios null, c4Comparable=false) instead of crashing.
      const emptyMatrix = () => ({
        metadata: { model: "no comparable builds", note: "Build C4 incompleta o sin Recargando: matriz vacía, ratios no disponibles." },
        summary: [], rows: [],
      });
      const matrices = {};
      for (const key of Object.keys(builds)) {
        const elBuild = builds[key].comparisons.find(c => c.profile === "elemental")?.builds?.[0];
        const canSim = !(key === "c4" && elBuild && (!elBuild.complete || !elBuild.activeSkills.includes("Loading")));
        matrices[key] = canSim
          ? simulateBowBuildHitzoneMatrix({
              bowData, buildOutput: builds[key], hitzoneData, style: "guild",
              missionShots: 200, elementCap: 30,
            })
          : emptyMatrix();
      }
      const elemC3 = matrixRatios(matrices["c3"], "elemental/male", "raw/male");
      const elemC4 = matrixRatios(matrices["c4"], "elemental/male", "raw/male");
      // C4 vs C3 elemental damage ratio: same bow, same budget, elemental build.
      let c4vsC3 = null;
      const r0 = matrices["c3"].rows[0], r1 = matrices["c4"].rows[0];
      if (r0 && r1) {
        const a = r1.byBuild["elemental/male"]?.totalDamage, b = r0.byBuild["elemental/male"]?.totalDamage;
        c4vsC3 = b > 0 ? a / b : null;
      }
      const elemBuildC4 = builds["c4"].comparisons.find(c => c.profile === "elemental").builds[0];
      const loadingActive = elemBuildC4.activeSkills.includes("Loading");
      const offensive = offensiveSkillsActivated(elemBuildC4, skillLevels, offensivePriority("elemental", shotType, chosen.element[1]));
      const result = {
        shotType, bowRank, bow: chosen.weapon.nEs || chosen.weapon.n,
        treeId: chosen.treeId, level: chosen.level, element: chosen.element[1],
        c3Slot: chosen.c3Slot, c4Slot: chosen.c4Slot,
        budgetUsed: effBudget, maxBudgetRequested: budget,
        c4RequiresLoadUp: true, loadingActive,
        offensiveSkillsActivated: offensive.map(s => s.skill),
        elementalC3Raw: elemC3, elementalC4Raw: elemC4,
        c4VsC3ElementalDamage: c4vsC3,
        c4Complete: elemBuildC4.complete,
        c4Comparable: Boolean(elemBuildC4.complete),
        c4Note: elemBuildC4.complete
          ? "C4 completable a presupuesto " + effBudget + " con Recargando (presupuesto C3 completable)."
          : "C4 NO completable a presupuesto " + effBudget + " (el C3 completa a este presupuesto, el C4 no): Recargando consume espacio y la build queda incompleta (no comparable).",
        c4Build: {
          activatedSkills: elemBuildC4.activeSkills, targetSkillCount: elemBuildC4.targetSkillCount,
          offensiveSkillCount: elemBuildC4.offensiveSkillCount, activatedOffensiveSkills: elemBuildC4.activatedOffensiveSkills,
          jewelSocketsUsed: elemBuildC4.jewelSocketsUsed, jewelSocketsFree: elemBuildC4.jewelSocketsFree,
          complete: elemBuildC4.complete,
        },
      };
      payload.results.push(result);
      rows.push([
        shotType, bowRank, chosen.weapon.nEs || chosen.weapon.n, chosen.element[1],
        "C4!", (elemC4?.meanRatioAllParts ?? "").toFixed ? Number(elemC4?.meanRatioAllParts).toFixed(3) : "",
        Number(elemC3?.meanRatioAllParts ?? 0).toFixed(3),
        c4vsC3 != null ? c4vsC3.toFixed(3) : "",
        loadingActive ? "sí" : "no",
        offensive.map(s => s.skill).join(","),
      ]);
      console.log(shotType + " " + bowRank + ": " + (chosen.weapon.nEs || chosen.weapon.n)
        + " [b" + effBudget + "]"
        + " | elem/raw C3=" + (elemC3?.meanRatioAllParts ?? "n/a")
        + " C4=" + (elemC4?.meanRatioAllParts ?? "n/a")
        + " | C4/C3=" + (c4vsC3 != null ? c4vsC3.toFixed(3) : "n/a")
        + " | Loading=" + (loadingActive ? "sí" : "no")
        + " | C4=" + (elemBuildC4.complete ? "comparable" : "incompleto/no comparable"));
    }
  }

  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, JSON.stringify(payload, null, 2) + "\n", "utf8");
  const header = "shotType,bowRank,bow,element,variant,elemC4Raw,elemC3Raw,c4VsC3,loadingActive,offensiveSkills";
  writeFileSync(csv, header + "\n" + rows.map(r => r.map(v => {
    const s = v == null ? "" : String(v);
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }).join(",")).join("\n") + "\n", "utf8");
  console.log("JSON: " + out);
  console.log("CSV: " + csv);
}
try { main(); } catch (error) { console.error("Error: " + error.message); process.exitCode = 1; }
