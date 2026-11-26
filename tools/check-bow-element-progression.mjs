#!/usr/bin/env node
// Stage 11, problema 7: auditoría de la progresión elemental del catálogo de
// arcos tras dejar las 55 líneas terminales elementales en 30.
//
// Comprueba que:
//   1. ningún registro de nivel supera el tope 30;
//   2. las 55 líneas terminales elementales están en 30;
//   3. dentro de cada árbol, ningún nivel superior lleva menos elemento que un
//      nivel inferior del mismo árbol (inversión de progresión);
//   4. los saltos elementales entre niveles consecutivos del mismo árbol se
//      mantienen en márgenes razonables (<= 10).
//
// Emite JSON + CSV para que la revisión sea reproducible.

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

const ELEMENT_CAP = 30;
const MAX_STEP = 10;

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

function elementOf(level) {
  const ele = level.ele;
  if (!Array.isArray(ele) || !ele.length) return null;
  return { type: ele[0]?.[1] || ele[0]?.[0] || null, value: Number(ele[0]?.[2] || 0) };
}

function main() {
  const args = readArgs(process.argv);
  const bowData = JSON.parse(readFileSync(resolve(args.bows || "data/weapons/bow.json"), "utf8"));
  const out = resolve(args.out || "tools/out/stage11/bow-element-progression.json");
  const csv = resolve(args.csv || "tools/out/stage11/bow-element-progression.csv");

  const records = [];
  const issues = [];
  let finalsEle = 0;
  let levelsWithElement = 0;
  let maxValue = 0;

  for (const tree of bowData.trees) {
    const levels = (tree.levels || []).slice().sort((a, b) => Number(a.lv) - Number(b.lv));
    for (const level of levels) {
      const element = elementOf(level);
      if (!element) continue;
      levelsWithElement++;
      maxValue = Math.max(maxValue, element.value);
      const isFinal = levels.length > 1 && Number(level.lv) === Number(levels[levels.length - 1].lv);
      const record = {
        treeId: Number(tree.id),
        tree: tree.nameEs || tree.name,
        level: Number(level.lv),
        maxLevel: Number(tree.maxLevel ?? levels.length),
        rarity: Number(level.rar || 0),
        name: level.nEs || level.n,
        isFinal,
        elementType: element.type,
        elementValue: element.value,
      };
      records.push(record);
      if (element.value > ELEMENT_CAP) {
        issues.push({ kind: "over-cap", ...record, message: "Elemento " + element.value + " supera el tope " + ELEMENT_CAP });
      }
      if (isFinal) {
        // Los 6 arcos Explosión (Blast) quedan aparte de la pasada elemental:
        // no se tocan ni se cuentan como finales elementales.
        if (element.type !== "Blast") {
          finalsEle++;
          if (element.value !== ELEMENT_CAP) {
            issues.push({ kind: "final-not-30", ...record, message: "Final elemental no está en 30 (tiene " + element.value + ")" });
          }
        } else {
          issues.push({ kind: "final-blast", ...record, message: "Final Explosión sin cambios (queda aparte de la pasada elemental)" });
        }
      }
    }
    // Inversiones y saltos entre niveles consecutivos del mismo árbol.
    for (let i = 0; i + 1 < levels.length; i++) {
      const lower = elementOf(levels[i]);
      const upper = elementOf(levels[i + 1]);
      if (!lower || !upper) continue;
      if (upper.value < lower.value) {
        issues.push({
          kind: "inversion",
          treeId: Number(tree.id), tree: tree.nameEs || tree.name,
          level: Number(levels[i].lv), nextLevel: Number(levels[i + 1].lv),
          elementType: upper.type, elementValue: lower.value, nextElementValue: upper.value,
          message: "Progresión invertida: nivel " + levels[i + 1].lv + " (" + upper.value + ") < nivel " + levels[i].lv + " (" + lower.value + ")",
        });
      }
      const step = upper.value - lower.value;
      if (step > MAX_STEP) {
        issues.push({
          kind: "big-step",
          treeId: Number(tree.id), tree: tree.nameEs || tree.name,
          level: Number(levels[i].lv), nextLevel: Number(levels[i + 1].lv),
          elementType: upper.type, elementValue: lower.value, nextElementValue: upper.value, step,
          message: "Salto elemental " + step + " entre niveles " + levels[i].lv + " y " + levels[i + 1].lv,
        });
      }
    }
  }

  const payload = {
    model: "MHGU bow elemental progression audit stage 11",
    generatedAt: new Date().toISOString(),
    elementCap: ELEMENT_CAP,
    maxStep: MAX_STEP,
    levelsWithElement,
    finalsEle,
    maxElementValue: maxValue,
    issuesCount: issues.length,
    issues,
  };
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, JSON.stringify(payload, null, 2) + "\n", "utf8");

  const header = "treeId,tree,level,maxLevel,rarity,name,isFinal,elementType,elementValue";
  writeFileSync(csv, header + "\n" + records.map(r => [
    r.treeId, JSON.stringify(r.tree), r.level, r.maxLevel, r.rarity,
    JSON.stringify(r.name), r.isFinal, r.elementType, r.elementValue,
  ].join(",")).join("\n") + "\n", "utf8");

  console.log("MHGU bow elemental progression audit (stage 11)");
  console.log("registros con elemento: " + levelsWithElement + " | finales elementales: " + finalsEle + " | elemento máximo: " + maxValue);
  console.log("problemas detectados: " + issues.length);
  for (const issue of issues.slice(0, 40)) {
    console.log("  [" + issue.kind + "] " + issue.message);
  }
  if (issues.length > 40) console.log("  ... y " + (issues.length - 40) + " más");
  console.log("JSON: " + out);
  console.log("CSV: " + csv);
}

const isDirectRun = process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href;
if (isDirectRun) {
  try { main(); } catch (error) { console.error("Error: " + error.message); process.exitCode = 1; }
}
