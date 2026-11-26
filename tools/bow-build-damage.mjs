#!/usr/bin/env node
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { parseHitzones } from "../js/bow-balance-sim.js";
import { simulateBowBuildHitzoneMatrix } from "../js/bow-build-damage.js";

function readArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i++) {
    const token = argv[i];
    if (!token.startsWith("--")) throw new Error("Argumento inesperado: " + token);
    const body = token.slice(2), equals = body.indexOf("=");
    if (equals >= 0) {
      const key = body.slice(0, equals), value = body.slice(equals + 1);
      if (!key || !value) throw new Error("Argumento inválido: " + token);
      args[key] = value;
    } else {
      const value = argv[i + 1];
      if (!value || value.startsWith("--")) throw new Error("Falta el valor de --" + body);
      args[body] = value; i++;
    }
  }
  return args;
}
const readJson = path => JSON.parse(readFileSync(resolve(path), "utf8"));

function main() {
  const args = readArgs(process.argv);
  if (!args.builds || !args.hitzones) {
    throw new Error("Uso: node tools/bow-build-damage.mjs --builds optimizer.json --hitzones hitzones.js [--style guild] [--mission-shots 200] [--coating-switch-shots 0]");
  }
  const buildOutput = readJson(args.builds);
  const bowData = readJson(args.bows || "data/weapons/bow.json");
  const hitzoneData = parseHitzones(readFileSync(resolve(args.hitzones), "utf8"));
  const result = simulateBowBuildHitzoneMatrix({
    bowData, buildOutput, hitzoneData,
    style: args.style || "guild",
    missionShots: Number(args["mission-shots"] || 200),
    coatingSwitchShots: Number(args["coating-switch-shots"] || 0),
    elementCap: args["element-cap"] === undefined ? null : Number(args["element-cap"]),
  });
  const outputPath = resolve(args.out || "tools/out/bow-build-damage-stage9.json");
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, JSON.stringify(result, null, 2) + "\n", "utf8");
  console.log("MHGU actual bow build damage comparison");
  console.log(result.metadata.weapon.name + " | " + result.metadata.weapon.rank
    + " | " + result.metadata.weapon.charge.effectiveType + " Lv" + result.metadata.weapon.charge.level
    + " | " + result.metadata.monsterCount + " monstruos | " + result.metadata.partRows + " partes");
  for (const row of result.summary) {
    console.log(row.target + " vs " + row.reference
      + ": ratio medio partes=" + row.meanRatioAllParts?.toFixed(3)
      + " | partes ganadas=" + row.partWins + "/" + row.partsCompared
      + " | monstruos con alguna parte ganadora=" + row.monstersWithAtLeastOneWinningPart + "/" + row.monstersCompared
      + " | media de mejor parte=" + row.meanBestPartRatioPerMonster?.toFixed(3));
  }
  console.log("Informe JSON: " + outputPath);
}
try { main(); } catch (error) { console.error("Error: " + error.message); process.exitCode = 1; }
