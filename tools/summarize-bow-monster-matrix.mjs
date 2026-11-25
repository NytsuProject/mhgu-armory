#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const input = process.argv[2];
const output = process.argv[3];
if (!input) throw new Error("Usage: node tools/summarize-bow-monster-matrix.mjs <matrix.json> [summary.json]");

const report = JSON.parse(readFileSync(resolve(input), "utf8"));
const profiles = [
  ["elementalLite", "Element Core"],
  ["elementalFull", "Element Full"],
  ["elementalLite50", "Element Core · Element Coat 50"],
  ["elementalFull50", "Element Full · Element Coat 50"],
];
const scenarios = ["base", "A", "B"];
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

const rows = [];
for (const rank of ranks) {
  const monsters = report.results.filter(row => row.rank === rank);
  for (const scenario of scenarios) {
    for (const [key, label] of profiles) {
      const chosen = monsters.map(monster => ({
        monster: monster.monster,
        value: monster.scenarios?.[scenario]?.[key] || null,
      })).filter(item => Number.isFinite(item.value?.vsRaw));
      const ratios = chosen.map(item => item.value.vsRaw);
      for (const shotType of ["Rapid", "Pierce", "Spread", "Heavy"]) {
        const group = chosen.filter(item => item.value.shotType === shotType);
        const groupRatios = group.map(item => item.value.vsRaw);
        rows.push({
          rank, scenario, profile: key, label, shotType,
          matchups: group.length,
          meanRatio: average(groupRatios),
          medianRatio: median(groupRatios),
          elementalWins: groupRatios.filter(value => value > 1).length,
          meanRatioAllTypes: shotType === "Rapid" ? average(ratios) : undefined,
          favorable25Plus: (() => {
            const items = group.filter(item => item.value.elementHz >= 25);
            const values = items.map(item => item.value.vsRaw);
            return { count: items.length, meanRatio: average(values), wins: values.filter(value => value > 1).length };
          })(),
          medium15To24: (() => {
            const items = group.filter(item => item.value.elementHz >= 15 && item.value.elementHz < 25);
            const values = items.map(item => item.value.vsRaw);
            return { count: items.length, meanRatio: average(values), wins: values.filter(value => value > 1).length };
          })(),
          poor10OrLess: (() => {
            const items = group.filter(item => item.value.elementHz <= 10);
            const values = items.map(item => item.value.vsRaw);
            return { count: items.length, meanRatio: average(values), wins: values.filter(value => value > 1).length };
          })(),
        });
      }
      rows.push({
        rank, scenario, profile: key, label, shotType: "ALL",
        matchups: ratios.length,
        meanRatio: average(ratios),
        medianRatio: median(ratios),
        elementalWins: ratios.filter(value => value > 1).length,
        favorable25Plus: (() => {
          const items = chosen.filter(item => item.value.elementHz >= 25);
          const values = items.map(item => item.value.vsRaw);
          return { count: items.length, meanRatio: average(values), wins: values.filter(value => value > 1).length };
        })(),
        medium15To24: (() => {
          const items = chosen.filter(item => item.value.elementHz >= 15 && item.value.elementHz < 25);
          const values = items.map(item => item.value.vsRaw);
          return { count: items.length, meanRatio: average(values), wins: values.filter(value => value > 1).length };
        })(),
        poor10OrLess: (() => {
          const items = chosen.filter(item => item.value.elementHz <= 10);
          const values = items.map(item => item.value.vsRaw);
          return { count: items.length, meanRatio: average(values), wins: values.filter(value => value > 1).length };
        })(),
      });
    }
  }
}

const result = {
  source: resolve(input),
  metadata: report.metadata,
  note: "A ratio above 1 means the best elemental candidate's theoretical same-part mission average exceeds the best RAW candidate. This is not measured hunt DPS.",
  rows,
};
const json = JSON.stringify(result, null, 2) + "\n";
if (output) writeFileSync(resolve(output), json, "utf8");
process.stdout.write(json);
