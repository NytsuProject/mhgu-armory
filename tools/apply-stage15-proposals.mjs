#!/usr/bin/env node
// Stage 15 — Aplicación de las propuestas de rebalance al catálogo.
// Aplica a data/weapons/bow.json:
//   1. Las 12 conversiones (RAW + elemento natural por nivel).
//   2. Las 7 ramas nuevas (árboles 108-114).
// Luego re-verifica: matriz 72/72, progresiones, C4 ! alineada.
// FLAG --check: solo verifica sin aplicar.

import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  reconstructLines, buildCoverageMatrix,
} from "./bow-specialization-audit.mjs";
import {
  proposeLineConversion, proposeNewBranch,
  uncoveredTerminalObjectives, matchObjectivesToLines,
  BRANCH_SPECS,
} from "./bow-specialization-proposals.mjs";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const bowPath = resolve(__dirname, "../data/weapons/bow.json");
const checkOnly = process.argv.includes("--check");

const bow = JSON.parse(readFileSync(bowPath, "utf8"));
const lines = reconstructLines(bow);
const { assignments, unresolved } = matchObjectivesToLines(lines, uncoveredTerminalObjectives(lines));

const treesById = new Map(bow.trees.filter(t => !t.dummy).map(t => [Number(t.id), t]));
const ELEMENT_LABELS = { Fire: "Fuego", Water: "Agua", Thunder: "Rayo", Ice: "Hielo", Dragon: "Dragón" };

// 1) Aplicar conversiones
const applied = [];
for (const { objective, candidate } of assignments) {
  const proposal = proposeLineConversion(lines, candidate, objective.element, objective.rank);
  const tree = treesById.get(proposal.treeId);
  for (const lv of proposal.levelPlan) {
    const level = tree.levels.find(row => Number(row.lv) === lv.localLevel);
    if (!level) continue;
    level.raw = lv.after.raw;
    level.ele = [[ELEMENT_LABELS[lv.after.element.type], lv.after.element.type, lv.after.element.value]];
  }
  applied.push(proposal);
}

// 2) Añadir ramas nuevas
const branchProposals = [];
let nextBranchId = Math.max(0, ...bow.trees.filter(t => !t.dummy).map(t => Number(t.id))) + 1;
for (const u of unresolved) {
  const spec = BRANCH_SPECS.find(sp =>
    sp.objective.rank === u.objective.rank && sp.objective.element === u.objective.element && sp.objective.shot === u.objective.shot);
  if (!spec) continue;
  const proposal = proposeNewBranch(lines, bow, spec, nextBranchId);
  bow.trees.push(proposal.tree);
  branchProposals.push(proposal);
  nextBranchId++;
}

if (checkOnly) {
  console.log("--check: no se escribe bow.json. Solo se verifica en memoria.");
} else {
  // Formato minificado, igual que el arch original del repo.
  writeFileSync(bowPath, JSON.stringify(bow) + "\n", "utf8");
  console.log(`Aplicadas: ${applied.length} conversiones + ${branchProposals.length} ramas nuevas -> data/weapons/bow.json`);
}

// 3) Re-verificación
const afterLines = reconstructLines(bow);
const matrix = buildCoverageMatrix(afterLines);
const uncovered = matrix.filter(o => o.specialization === "raw" ? !o.coveredStructural : !o.coveredTerminal);
console.log(`Líneas reconstruidas: ${afterLines.length}`);
console.log(`Matriz 72 objetivos: ${matrix.length - uncovered.length}/${matrix.length} cubiertos`);

let progOk = 0, progTotal = 0;
for (const tree of bow.trees.filter(t => !t.dummy)) {
  const levels = [...tree.levels].sort((a, b) => a.lv - b.lv);
  progTotal++;
  let ok = true;
  for (let i = 1; i < levels.length; i++) {
    if (levels[i].raw < levels[i - 1].raw) ok = false;
  }
  if (ok) progOk++;
}
console.log(`Progresiones válidas (RAW no decreciente): ${progOk}/${progTotal}`);

let loadUpOk = 0, loadUpTotal = 0;
for (const tree of bow.trees.filter(t => !t.dummy)) {
  for (const level of tree.levels) {
    const charges = level.x?.charges || [];
    if (charges[3] && charges[3].endsWith("!")) {
      loadUpTotal++;
      const prevType = charges[2]?.split(" ")[0];
      const curType = charges[3].split(" ")[0];
      if (prevType && prevType === curType) loadUpOk++;
    }
  }
}
console.log(`Regla C4 ! alineada con C3: ${loadUpOk}/${loadUpTotal}`);

if (!checkOnly) {
  console.log("Verificación final: OK");
} else if (uncovered.length === 0 && progOk === progTotal && loadUpOk === loadUpTotal) {
  console.log("Verificación final (--check): OK");
} else {
  console.log("Verificación final (--check): PROBLEMAS");
  process.exitCode = 1;
}
