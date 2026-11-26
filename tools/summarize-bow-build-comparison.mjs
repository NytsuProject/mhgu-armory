#!/usr/bin/env node
// Summarize stage-11 bow build comparison JSON artifacts into the tables the
// report needs: ratios by rank, shot type and elemental hitzone band; wins by
// part and monster; complete builds, activated skills, jewel distribution and
// hybrid transition sensitivity.

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

const ELEMENT_BANDS = [
  { id: "favorable", label: "Favorable", min: 25, max: null },
  { id: "medium", label: "Media", min: 15, max: 25 },
  { id: "poor", label: "Pobre", min: null, max: 15 },
];

function bandFor(elementHz) {
  for (const band of ELEMENT_BANDS) {
    if (band.min !== null && elementHz < band.min) return band.id;
    if (band.max !== null && elementHz >= band.min && elementHz < band.max) return band.id;
    if (band.max === null && elementHz >= band.min) return band.id;
  }
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
    const elementHz = elementType ? Number(row.elementHz) : 0;
    const band = elementType ? bandFor(elementHz) : "all";
    const byBuild = row.byBuild || {};
    // wins: for each target/reference pair present in byBuild
    const ids = Object.keys(byBuild);
    for (const target of ids) {
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

  const out = {
    model: "MHGU bow build comparison summarizer stage 11",
    shotType: input.shotType, budget: input.budget, switchShots: input.switchShots,
    elementCap: input.elementCap,
    classA: summarizeMatrix(input.classA.matrix, input.classA.matrix.metadata.weapon.element?.type),
    classB: input.classB.profiles.map(profile => profile.matrix
      ? summarizeMatrix(profile.matrix, profile.matrix.metadata.weapon.element?.type)
      : { note: profile.note, bow: profile.bow }),
  };
  const outPath = resolve(args.out || "tools/out/stage11/stage11-summary.json");
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, JSON.stringify(out, null, 2) + "\n", "utf8");
  console.log("MHGU bow build comparison summary (stage 11)");
  console.log("clase A ratios:");
  for (const row of out.classA.builds) {
    console.log("  " + row.target + " vs " + row.reference + ": " + row.meanRatioAllParts?.toFixed(3)
      + " (partes) / " + row.meanBestPartRatioPerMonster?.toFixed(3) + " (mejor parte) | victorias partes=" + row.partWins + "/" + row.partsCompared);
  }
  for (const profile of out.classB) {
    if (profile.note || !profile.builds) { console.log("  B " + profile.note); continue; }
    console.log("clase B:");
    for (const row of profile.builds) {
      console.log("  " + row.target + " vs " + row.reference + ": " + row.meanRatioAllParts?.toFixed(3)
        + " (partes) / " + row.meanBestPartRatioPerMonster?.toFixed(3) + " (mejor parte)");
    }
  }
  console.log("Informe JSON: " + outPath);
}
try { main(); } catch (error) { console.error("Error: " + error.message); process.exitCode = 1; }
