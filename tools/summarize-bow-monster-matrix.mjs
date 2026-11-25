#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const input = process.argv[2];
const output = process.argv[3];
if (!input) throw new Error("Usage: node tools/summarize-bow-monster-matrix.mjs <matrix.json> [summary.json]");

const report = JSON.parse(readFileSync(resolve(input), "utf8"));
const profiles = [
  ["elementalFocused", "Element Focus · 5 skills"],
  ["elementalFocused50", "Element Focus · Element Coat 50 · 5 skills"],
  ["elementalLite", "Element Core"],
  ["elementalFull", "Element Full"],
  ["elementalLite50", "Element Core · Element Coat 50"],
  ["elementalFull50", "Element Full · Element Coat 50"],
  ["elementalHybrid", "Element Full · Element Coat II → Power Coat II"],
  ["elementalHybrid50", "Element Full · Element Coat 50 → Power Coat II"],
  ["elementalHybridLowCost", "Element Full · native/low-cost Element Coat I/II → Power Coat I/II"],
  ["elementalHybridLowCost50", "Element Full · Element Coat 50 · low-cost Power Coat"],
];
const scenarios = ["base", "A", "B"];
const shotTypes = ["Rapid", "Pierce", "Spread", "Heavy"];
const ranks = report.metadata.ranks || ["LR", "HR", "G"];

const median = values => {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
};
const average = values => values.length
  ? values.reduce((sum, value) => sum + value, 0) / values.length
  : null;

function summarizeGroup({ rank, scenario, profile, label, shotType, chosen, partChosen }) {
  const ratios = chosen.map(item => item.value.vsRaw);
  const partRatios = partChosen.map(item => item.value.vsRaw);
  const band = (predicate) => {
    const items = chosen.filter(item => predicate(item.value.elementHz));
    const values = items.map(item => item.value.vsRaw);
    return {
      count: values.length,
      meanRatio: average(values),
      medianRatio: median(values),
      wins: values.filter(value => value > 1).length,
    };
  };
  return {
    rank, scenario, profile, label, shotType,
    matchups: ratios.length,
    meanRatio: average(ratios),
    medianRatio: median(ratios),
    elementalWins: ratios.filter(value => value > 1).length,
    monstersWithAnyElementalPartWin: new Set(partChosen.filter(item => item.value.vsRaw > 1).map(item => item.monster)).size,
    partMatchups: partRatios.length,
    partMeanRatio: average(partRatios),
    partMedianRatio: median(partRatios),
    partWins: partRatios.filter(value => value > 1).length,
    partFavorable25Plus: (() => {
      const items = partChosen.filter(item => item.value.elementHz >= 25);
      const values = items.map(item => item.value.vsRaw);
      return { count: values.length, meanRatio: average(values), medianRatio: median(values), wins: values.filter(value => value > 1).length };
    })(),
    favorable25Plus: band(value => value >= 25),
    medium15To24: band(value => value >= 15 && value < 25),
    poor10OrLess: band(value => value <= 10),
    candidates: chosen.map(item => ({
      monster: item.monster,
      elementalWeapon: item.value.weapon,
      elementalTree: item.value.tree,
      elementalLevel: item.value.level,
      elementalCharge: item.value.charge,
      elementalPart: item.value.part,
      elementalHz: item.value.elementHz,
      rawWeapon: item.value.rawWeapon || null,
      rawTree: item.value.rawTree ?? null,
      rawLevel: item.value.rawLevel ?? null,
      rawCharge: item.value.rawCharge || null,
      rawPart: item.value.rawPart || null,
      ratio: item.value.vsRaw,
    })),
  };
}

const rows = [];
for (const rank of ranks) {
  const monsters = report.results.filter(row => row.rank === rank);
  for (const scenario of scenarios) {
    for (const [key, label] of profiles) {
      const all = monsters.map(monster => ({
        monster: monster.monster,
        value: monster.scenarios?.[scenario]?.[key] || null,
      })).filter(item => Number.isFinite(item.value?.vsRaw));
      const allParts = monsters.flatMap(monster => (monster.partStats?.scenarios?.[scenario]?.[key] || []).map(stat => ({
        monster: monster.monster,
        part: stat.part,
        value: { vsRaw: stat.ratio, elementHz: stat.elementHz },
      }))).filter(item => Number.isFinite(item.value?.vsRaw));
      rows.push(summarizeGroup({
        rank, scenario, profile: key, label, shotType: "ALL",
        chosen: all,
        partChosen: allParts,
      }));

      for (const shotType of shotTypes) {
        const chosen = monsters.map(monster => ({
          monster: monster.monster,
          value: monster.byShotType?.[shotType]?.[scenario]?.[key] || null,
        })).filter(item => Number.isFinite(item.value?.vsRaw));
        const typeParts = monsters.flatMap(monster => (monster.partStats?.byShotType?.[shotType]?.[scenario]?.[key] || []).map(stat => ({
          monster: monster.monster,
          part: stat.part,
          value: { vsRaw: stat.ratio, elementHz: stat.elementHz },
        }))).filter(item => Number.isFinite(item.value?.vsRaw));
        rows.push(summarizeGroup({
          rank, scenario, profile: key, label, shotType,
          chosen,
          partChosen: typeParts,
        }));
      }
    }
  }
}

const result = {
  source: resolve(input),
  metadata: report.metadata,
  note: "ALL compares the best candidates across all shot types. A named shotType compares the best elemental and RAW candidates restricted to that same type. Each ratio is paired on the same monster part. Top-level means use each monster's best-ratio part; partMeanRatio and partWins aggregate every evaluated part. Ratio above 1 means the elemental candidate's theoretical mission average exceeds the RAW candidate on that exact part. This is not measured hunt DPS.",
  rows,
};
const json = JSON.stringify(result, null, 2) + "\n";
if (output) writeFileSync(resolve(output), json, "utf8");
process.stdout.write(json);
