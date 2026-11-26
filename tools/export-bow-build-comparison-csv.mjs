#!/usr/bin/env node
// Stage 11, problema 5: exporta los resultados de las 12 comparaciones
// (Spread/Pierce/Rapid/Heavy x LR/HR/G) a CSV, para que los resultados
// sean reproductibles y auditables sin depender solo de las tablas del
// informe.

import { readFileSync, writeFileSync, mkdirSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

const OUT_DIR = resolve("tools/out/stage11");

function csvRow(values) {
  return values.map(v => {
    const s = v == null ? "" : String(v);
    if (/[",\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
    return s;
  }).join(",");
}

function readJson(p) {
  return JSON.parse(readFileSync(resolve(p), "utf8"));
}

const files = readdirSync(OUT_DIR)
  .filter(f => /^cmp-.*-b4\.json$/.test(f))
  .sort();

const ratioRows = [];
const bandRows = [];
const buildRows = [];

for (const file of files) {
  const j = readJson(resolve(OUT_DIR, file));
  const shot = j.shotType;
  const rank = j.bowRank;
  const budget = j.budget;

  if (j.classA?.matrix) {
    for (const g of j.classA.matrix.summary) {
      ratioRows.push([shot, rank, "A", budget, g.target, g.reference,
        round(g.meanRatioAllParts), round(g.meanBestPartRatioPerMonster), g.partsCompared, g.partWins, g.monstersCompared, g.monstersWithAtLeastOneWinningPart]);
    }
  }

  if (j.classB?.matrix) {
    for (const p of j.classB.profiles) {
      for (const c of (p.builds || [])) {
        const b = c.builds?.[0];
        buildRows.push([shot, rank, "B", p.profile, c.gender, p.bow?.name || "", round(p.bow?.damage),
          b?.activatedSkills ?? "", b?.complete ? "completa" : "parcial", b?.targetSkillCount ?? ""]);
      }
    }
    for (const g of j.classB.matrix.summary) {
      ratioRows.push([shot, rank, "B", budget, g.target, g.reference,
        round(g.meanRatioAllParts), round(g.meanBestPartRatioPerMonster), g.partsCompared, g.partWins, g.monstersCompared, g.monstersWithAtLeastOneWinningPart]);
    }
    const summary = readJson(resolve(OUT_DIR, file.replace(/^cmp-/, "summary-").replace(/\.json$/, ".json")));
    if (summary?.classB?.byBand) {
      for (const row of summary.classB.byBand) {
        // `sub` es "target|reference"; se ignoran las comparaciones cruzadas
        // entre géneros (solo se compara igual género contra igual género).
        const [target, reference] = String(row.sub).split("|");
        if (!target || !reference) continue;
        const [tg, tr] = target.split("/"), [rg, rr] = reference.split("/");
        if (tg !== rg) continue;
        bandRows.push([shot, rank, "B", budget, row.group, target, reference,
          round(row.mean), row.count, row.wins]);
      }
    }
  }
}

function round(v) {
  return v == null ? "" : Number(v.toFixed(4));
}

const ratioPath = resolve(OUT_DIR, "stage11-comparison-ratios.csv");
const bandPath = resolve(OUT_DIR, "stage11-comparison-by-band.csv");
const buildPath = resolve(OUT_DIR, "stage11-builds.csv");

writeFileSync(ratioPath, csvRow(["shotType", "bowRank", "class", "budget", "target", "reference", "meanRatioAllParts", "meanBestPartRatioPerMonster", "partsCompared", "partWins", "monstersCompared", "monstersWithAtLeastOneWinningPart"]) + "\n"
  + ratioRows.map(r => csvRow(r)).join("\n") + "\n", "utf8");
writeFileSync(bandPath, csvRow(["shotType", "bowRank", "class", "budget", "band", "target", "reference", "meanRatio", "count", "wins"]) + "\n"
  + bandRows.map(r => csvRow(r)).join("\n") + "\n", "utf8");
writeFileSync(buildPath, csvRow(["shotType", "bowRank", "class", "profile", "gender", "bow", "meanDamage", "activatedSkills", "complete", "targetSkillCount"]) + "\n"
  + buildRows.map(r => csvRow(r)).join("\n") + "\n", "utf8");

console.log("MHGU bow build comparison CSV export (stage 11)");
console.log("comparaciones procesadas: " + files.length);
console.log("filas ratios: " + ratioRows.length + " -> " + ratioPath);
console.log("filas por banda: " + bandRows.length + " -> " + bandPath);
console.log("filas builds: " + buildRows.length + " -> " + buildPath);
