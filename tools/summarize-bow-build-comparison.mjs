#!/usr/bin/env node
// Summarize stage-11 bow build comparison JSON artifacts into the tables the
// report needs: ratios by rank, shot type and elemental hitzone band; wins by
// part and monster; complete builds, activated skills, jewel distribution and
// hybrid transition sensitivity.

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

// Elemental hitzone bands, aligned to the stage-10 convention:
// favorable >= 25, medium 15..24, poor < 15. A value below 15 is poor; a value
// from 15 up to 24 is medium; 25 and above is favorable.
const ELEMENT_BANDS = [
  { id: "favorable", label: "Favorable", min: 25, max: null },
  { id: "medium", label: "Media", min: 15, max: 25 },
  { id: "poor", label: "Pobre", min: null, max: 15 },
];

export function bandFor(elementHz) {
  const value = Number(elementHz);
  if (value >= 25) return "favorable";
  if (value >= 15) return "medium";
  return "poor";
}

function summarizeMatrix(matrix, elementType) {
  const rows = matrix.rows || [];
  const weaponRank = matrix.metadata?.weapon?.rank || "ALL";
  const shotType = matrix.metadata?.weapon?.charge?.effectiveType || "ALL";
  const byRank = new Map(), byBand = new Map(), byShot = new Map();
  const partWins = new Map(), monsterWins = new Map(), monsterPartWins = new Map();
  const builds = [];
  for (const group of matrix.summary || []) {
    builds.push({
      target: group.target, reference: group.reference,
      meanRatioAllParts: group.meanRatioAllParts,
      meanBestPartRatioPerMonster: group.meanBestPartRatioPerMonster,
      partWins: group.partWins, partsCompared: group.partsCompared,
      monstersCompared: group.monstersCompared,
      monstersWithAtLeastOneWinningPart: group.monstersWithAtLeastOneWinningPart,
    });
  }
  for (const row of rows) {
    const byBuild = row.byBuild || {};
    // wins: for each target/reference pair present in byBuild. The elemental
    // band is classified from the TARGET build's element hitzone (each build
    // may carry a different element in class B).
    const ids = Object.keys(byBuild);
    for (const target of ids) {
      const targetHz = byBuild[target]?.elementHz;
      const targetElement = byBuild[target]?.elementType;
      const band = targetElement ? bandFor(targetHz) : "all";
      for (const reference of ids) {
        if (target === reference) continue;
        const tv = byBuild[target]?.totalDamage, rv = byBuild[reference]?.totalDamage;
        if (tv == null || rv == null || rv <= 0) continue;
        const ratio = tv / rv;
        const key = target + "|" + reference;
        pushBucket(byRank, weaponRank, key, ratio);
        pushBucket(byBand, band, key, ratio);
        pushBucket(byShot, shotType, key, ratio);
        if (ratio > 1) {
          partWins.set(key, (partWins.get(key) || 0) + 1);
          const m = monsterWins.get(key) || new Set();
          m.add(row.monster);
          monsterWins.set(key, m);
          const mp = monsterPartWins.get(key) || new Map();
          mp.set(row.monster, (mp.get(row.monster) || 0) + 1);
          monsterPartWins.set(key, mp);
        }
      }
    }
  }
  return {
    builds: builds.filter(Boolean),
    byRank: flatten(byRank),
    byBand: flatten(byBand),
    byShot: flatten(byShot),
    partWins: Object.fromEntries(partWins),
    monsterWins: Object.fromEntries([...monsterWins.entries()].map(([k, v]) => [k, [...v].length])),
    monsterPartWins: Object.fromEntries([...monsterPartWins.entries()].map(([k, v]) => [k, Object.fromEntries(v)])),
  };
}

function pushBucket(map, key, sub, value) {
  if (!map.has(key)) map.set(key, new Map());
  const subMap = map.get(key);
  if (!subMap.has(sub)) subMap.set(sub, []);
  subMap.get(sub).push(value);
}
function flatten(map) {
  const out = [];
  for (const [group, subMap] of map) {
    for (const [sub, values] of subMap) {
      out.push({
        group, sub, count: values.length,
        mean: values.reduce((a, b) => a + b, 0) / values.length,
        wins: values.filter(v => v > 1).length,
      });
    }
  }
  return out.sort((a, b) => a.group.localeCompare(b.group) || a.sub.localeCompare(b.sub));
}

function main() {
  const args = {};
  for (let i = 2; i < process.argv.length; i++) {
    const token = process.argv[i];
    if (!token.startsWith("--")) throw new Error("Argumento inesperado: " + token);
    const body = token.slice(2), equals = body.indexOf("=");
    if (equals >= 0) args[body.slice(0, equals)] = body.slice(equals + 1);
    else { args[body] = process.argv[i + 1]; i++; }
  }
  if (!args.input) throw new Error("Uso: node tools/summarize-bow-build-comparison.mjs --input <comparison.json> [--out <summary.json>] [--rank-table <rank.json>]");
  const input = JSON.parse(readFileSync(resolve(args.input), "utf8"));
  const rankTable = args["rank-table"] ? JSON.parse(readFileSync(resolve(args["rank-table"]), "utf8")) : null;

  const classBProfiles = input.classB.profiles.map(profile => ({
    profile: profile.profile,
    bow: profile.bow ? { name: profile.bow.name, chargeSlot: profile.bow.chargeSlot, raw: profile.bow.raw, element: profile.bow.element, damage: profile.bow.damage } : profile.bow,
    note: profile.note,
    builds: (profile.builds || []).map(c => ({ profile: c.profile, gender: c.gender, activatedSkills: c.builds?.[0]?.activatedSkills, complete: c.builds?.[0]?.complete })),
  }));
  const out = {
    model: "MHGU bow build comparison summarizer stage 11",
    shotType: input.shotType, budget: input.budget, switchShots: input.switchShots,
    elementCap: input.elementCap, talismanPolicy: input.talismanPolicy,
    theoretical: input.theoretical,
    classA: input.classA
      ? (input.classA.matrix
        ? summarizeMatrix(input.classA.matrix, input.classA.matrix.metadata.weapon.element?.type)
        : { note: input.classA.note, bow: input.classA.bow })
      : { note: "clase A no ejecutada (--class b)" },
    classB: {
      profiles: classBProfiles,
      ...(input.classB.matrix
        ? summarizeMatrix(input.classB.matrix, input.classB.matrix.metadata.weapon?.element?.type)
        : { note: "sin matriz comparada" }),
    },
  };
  const outPath = resolve(args.out || "tools/out/stage11/stage11-summary.json");
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, JSON.stringify(out, null, 2) + "\n", "utf8");
  console.log("MHGU bow build comparison summary (stage 11)");
  console.log("talismans=" + out.talismanPolicy + (out.theoretical ? " (TEÓRICO)" : " (confirmado)"));
  console.log("clase A ratios:");
  for (const row of out.classA.builds || []) {
    console.log("  " + row.target + " vs " + row.reference + ": " + row.meanRatioAllParts?.toFixed(3)
      + " (partes) / " + row.meanBestPartRatioPerMonster?.toFixed(3) + " (mejor parte) | victorias partes=" + row.partWins + "/" + row.partsCompared);
  }
  if (!out.classA.builds) console.log("  " + out.classA.note);
  console.log("clase B (cada perfil con su propio arco):");
  for (const profile of out.classB.profiles) {
    console.log("  " + profile.profile + ": " + (profile.bow?.name || profile.note || "sin arco"));
  }
  if (out.classB.builds) {
    for (const row of out.classB.builds) {
      console.log("  B " + row.target + " vs " + row.reference + ": " + row.meanRatioAllParts?.toFixed(3)
        + " (partes) / " + row.meanBestPartRatioPerMonster?.toFixed(3) + " (mejor parte)");
    }
  }
  console.log("Informe JSON: " + outPath);
}
const isDirectRun = process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href;
if (isDirectRun) {
  try { main(); } catch (error) { console.error("Error: " + error.message); process.exitCode = 1; }
}
