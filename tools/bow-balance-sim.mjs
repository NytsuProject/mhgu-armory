#!/usr/bin/env node
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { parseHitzones, simulateBowBalance } from "../js/bow-balance-sim.js";

function readArgs(argv) {
  const result = {};
  for (let i = 2; i < argv.length; i++) {
    const key = argv[i];
    if (!key.startsWith("--")) throw new Error("Argumento inesperado: " + key);
    const name = key.slice(2);
    const value = argv[i + 1];
    if (!value || value.startsWith("--")) throw new Error("Falta el valor de --" + name);
    result[name] = value;
    i++;
  }
  return result;
}

function main() {
  const args = readArgs(process.argv);
  if (!args.hitzones) {
    throw new Error(
      "Uso: node tools/bow-balance-sim.mjs --hitzones ruta/al/hitzones.js " +
      "[--bows data/weapons/bow.json] [--out tools/out/bow-balance-stage5.json] " +
      "[--load-up-policy match-c3|current] [--shots-per-stack 100] " +
      "[--ammo-saver-return-rate 0] [--skill-budgets 5,6,7]"
    );
  }
  const bowsPath = resolve(args.bows || "data/weapons/bow.json");
  const hitzonesPath = resolve(args.hitzones);
  const outputPath = resolve(args.out || "tools/out/bow-balance-stage5.json");
  const bowData = JSON.parse(readFileSync(bowsPath, "utf8"));
  const hitzoneData = parseHitzones(readFileSync(hitzonesPath, "utf8"));
  const budgets = args["skill-budgets"]
    ? args["skill-budgets"].split(",").map(Number)
    : [5, 6, 7];
  if (budgets.some(value => !Number.isInteger(value) || value < 1)) {
    throw new Error("--skill-budgets debe ser una lista de enteros positivos, por ejemplo 5,6,7.");
  }
  const result = simulateBowBalance(bowData, hitzoneData, {
    loadUpPolicy: args["load-up-policy"] || "match-c3",
    shotsPerStack: Number(args["shots-per-stack"] || 100),
    ammoSaverReturnRate: Number(args["ammo-saver-return-rate"] || 0),
    skillBudgets: budgets
  });
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, JSON.stringify(result, null, 2) + "\n", "utf8");

  console.log("MHXX bow balance simulation");
  console.log("Monstruos grandes: " + result.meta.monsterCount);
  console.log("Arcos por rango: " + JSON.stringify(result.meta.weaponsByRank));
  console.log("Política Load Up: " + result.meta.loadUpPolicy);
  console.log("Disparos por pila: " + result.meta.shotsPerStack);
  console.log("");
  for (const row of result.summary) {
    console.log([
      row.rank,
      row.shotType,
      row.scenario,
      "presupuesto " + row.skillBudget,
      row.matchups + " matchups",
      "elemental gana " + row.elementalWins,
      "ratio medio " + row.meanElementToRawRatio.toFixed(3)
    ].join(" | "));
  }
  console.log("\nInforme JSON: " + outputPath);
}

try {
  main();
} catch (error) {
  console.error("Error: " + error.message);
  process.exitCode = 1;
}
