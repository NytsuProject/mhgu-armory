// Stage 15 — pruebas de rebalance del catálogo (propias, puristas).
// Verifica:
//   - el motor de propuestas genera 12 conversiones + 7 ramas nuevas para los
//     19 objetivos sin cobertura terminal, 0 inválidas;
//   - aplicar las propuestas en memoria cubre los 72 objetivos;
//   - progresiones válidas (RAW no decreciente, elemento creciente al tope 30);
//   - C4 `!` alineada con C3 en conversiones y ramas nuevas;
//   - no se convierten referencias RAW (Power Coating 2) si hay alternativa;
//   - el motor es purista: NO toca data/weapons/bow.json;
//   - las ramas nuevas heredan la flecha objetivo en C3/C4 y rango correcto.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

import {
  reconstructLines, buildCoverageMatrix,
} from "../tools/bow-specialization-audit.mjs";
import {
  ELEMENT_CAP,
  proposeLineConversion, proposeNewBranch,
  uncoveredTerminalObjectives, matchObjectivesToLines,
  validateProposal, validateBranchProposal,
  BRANCH_SPECS, BRANCH_TARGET_RAW,
} from "../tools/bow-specialization-proposals.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const readJson = p => JSON.parse(readFileSync(resolve(root, p), "utf8"));

const bowData = readJson("data/weapons/bow.json");
const bowBefore = JSON.stringify(bowData);

// ---------- helpers ----------

function applyProposalsInMemory(bow, lines) {
  const { assignments, unresolved } = matchObjectivesToLines(lines, uncoveredTerminalObjectives(lines));
  const treesById = new Map(bow.trees.filter(t => !t.dummy).map(t => [Number(t.id), t]));
  const applied = [];
  for (const { objective, candidate } of assignments) {
    const proposal = proposeLineConversion(lines, candidate, objective.element, objective.rank);
    const tree = treesById.get(proposal.treeId);
    for (const lv of proposal.levelPlan) {
      const level = tree.levels.find(row => Number(row.lv) === lv.localLevel);
      if (!level) continue;
      level.raw = lv.after.raw;
      level.ele = [[lv.after.element.type, lv.after.element.type, lv.after.element.value]];
    }
    proposal.objective = objective;
    applied.push(proposal);
  }
  const branchProposals = [];
  let nextBranchId = Math.max(0, ...bow.trees.filter(t => !t.dummy).map(t => Number(t.id))) + 1;
  for (const u of unresolved) {
    const spec = BRANCH_SPECS.find(sp =>
      sp.objective.rank === u.objective.rank && sp.objective.element === u.objective.element && sp.objective.shot === u.objective.shot);
    if (!spec) continue;
    const proposal = proposeNewBranch(lines, bow, spec, nextBranchId);
    proposal.objective = u.objective;
    bow.trees.push(proposal.tree);
    branchProposals.push(proposal);
    nextBranchId++;
  }
  return { applied, branchProposals };
}

// ---------- 1. Cobertura inicial y asignación ----------

test("Stage 15: hay 19 objetivos sin cobertura terminal y el motor asigna los 19", () => {
  const lines = reconstructLines(bowData);
  const objectives = uncoveredTerminalObjectives(lines);
  assert.equal(objectives.length, 19);
  const { assignments, unresolved } = matchObjectivesToLines(lines, objectives);
  assert.equal(assignments.length, 12, "12 conversiones de líneas existentes");
  assert.equal(unresolved.length, 7, "7 objetivos sin línea libre");
});

test("Stage 15: cada conversión se valida (elemento creciente, RAW no invertido, tope 30)", () => {
  const lines = reconstructLines(bowData);
  const { assignments } = matchObjectivesToLines(lines, uncoveredTerminalObjectives(lines));
  for (const { objective, candidate } of assignments) {
    const proposal = proposeLineConversion(lines, candidate, objective.element, objective.rank);
    const validation = validateProposal(proposal);
    assert.equal(validation.ok, true, `${proposal.treeName}: ${validation.errors.join("; ")}`);
    // el terminal alcanza el tope de elemento
    assert.equal(proposal.terminalAfter.element.value, ELEMENT_CAP);
    // el RAW terminal no aumenta
    assert.ok(proposal.terminalAfter.raw <= proposal.terminalBefore.raw);
  }
});

test("Stage 15: las referencias RAW (Power Coating 2) solo se convierten como última opción", () => {
  const lines = reconstructLines(bowData);
  const { assignments } = matchObjectivesToLines(lines, uncoveredTerminalObjectives(lines));
  const rawRefs = assignments.filter(({ candidate }) => candidate.terminal.coatings.includes("Power Coating 2"));
  // Ninguna conversión elegida debe ser una referencia RAW si para su objetivo
  // existía al menos una línea no-referencia libre en el pool.
  for (const { objective, candidate } of rawRefs) {
    const pool = lines.filter(l => {
      const t = l.terminal;
      if (!t || t.rank !== objective.rank) return false;
      if (!t.mainChargeTypes.includes(objective.shot)) return false;
      if (t.element && t.element.value >= 20) return false;
      if (t.element && t.element.type === objective.element) return false;
      return true;
    });
    const nonRef = pool.filter(l => !l.terminal.coatings.includes("Power Coating 2"));
    // si hay líneas no-referencia, la referencia no debe ser la elegida
    assert.equal(nonRef.length, 0,
      `${candidate.treeName} es referencia RAW pero existían ${nonRef.length} líneas no-referencia para ${objective.rank} ${objective.element} ${objective.shot}`);
  }
});

// ---------- 2. Ramas nuevas ----------

test("Stage 15: las 7 ramas nuevas se generan y validan (C4 ! alineado, elemento al tope)", () => {
  const lines = reconstructLines(bowData);
  const { unresolved } = matchObjectivesToLines(lines, uncoveredTerminalObjectives(lines));
  let nextId = 108;
  for (const u of unresolved) {
    const spec = BRANCH_SPECS.find(sp =>
      sp.objective.rank === u.objective.rank && sp.objective.element === u.objective.element && sp.objective.shot === u.objective.shot);
    assert.ok(spec, `especificación para ${u.objective.rank} ${u.objective.element} ${u.objective.shot}`);
    const proposal = proposeNewBranch(lines, bowData, spec, nextId++);
    const validation = validateBranchProposal(proposal);
    assert.equal(validation.ok, true, `${proposal.treeName}: ${validation.errors.join("; ")}`);
    assert.equal(proposal.terminalAfter.element.value, ELEMENT_CAP);
    assert.equal(proposal.terminalAfter.raw, BRANCH_TARGET_RAW[u.objective.rank]);
    // la flecha objetivo está en C3/C4
    const terminal = proposal.tree.levels[proposal.tree.levels.length - 1];
    const c3 = terminal.x.charges[2], c4 = terminal.x.charges[3];
    assert.ok(c3.startsWith(u.objective.shot), `C3 debe ser ${u.objective.shot}`);
    assert.ok(c4.startsWith(u.objective.shot), `C4 debe ser ${u.objective.shot}`);
    assert.ok(c4.endsWith("!"), "C4 tiene Recargando");
  }
});

test("Stage 15: cada rama nueva cubre su objetivo (rank, elemento ≥20, flecha en C3/C4)", () => {
  const lines = reconstructLines(bowData);
  const bow = JSON.parse(JSON.stringify(bowData));
  const { branchProposals } = applyProposalsInMemory(bow, lines);
  const afterLines = reconstructLines(bow);
  for (const p of branchProposals) {
    const line = afterLines.find(l => l.treeId === p.treeId);
    assert.ok(line, `rama ${p.treeName} presente en el catálogo`);
    const t = line.terminal;
    assert.equal(t.element.type, p.objective.element);
    assert.ok(t.element.value >= 20);
    assert.ok(t.mainChargeTypes.includes(p.objective.shot));
    assert.equal(t.rank, p.objective.rank);
  }
});

// ---------- 3. Cobertura total de 72 objetivos ----------

test("Stage 15: aplicar propuestas en memoria cubre los 72 objetivos", () => {
  const lines = reconstructLines(bowData);
  const bow = JSON.parse(JSON.stringify(bowData));
  const { applied, branchProposals } = applyProposalsInMemory(bow, lines);
  assert.equal(applied.length, 12);
  assert.equal(branchProposals.length, 7);
  const afterLines = reconstructLines(bow);
  const matrix = buildCoverageMatrix(afterLines);
  const uncovered = matrix.filter(o => o.specialization === "raw" ? !o.coveredStructural : !o.coveredTerminal);
  assert.equal(uncovered.length, 0, `sin cobertura: ${uncovered.map(o => `${o.specialization} ${o.rank} ${o.element || "-"} ${o.shot}`).join(", ")}`);
});

// ---------- 4. Progresiones y reglas protegidas ----------

test("Stage 15: todas las progresiones (conversciones + ramas) son válidas (RAW no decreciente)", () => {
  const lines = reconstructLines(bowData);
  const bow = JSON.parse(JSON.stringify(bowData));
  const { applied, branchProposals } = applyProposalsInMemory(bow, lines);
  const treesById = new Map(bow.trees.filter(t => !t.dummy).map(t => [Number(t.id), t]));
  for (const p of applied) {
    const levels = [...treesById.get(p.treeId).levels].sort((a, b) => a.lv - b.lv);
    for (let i = 1; i < levels.length; i++) {
      assert.ok(levels[i].raw >= levels[i - 1].raw, `RAW invertido en ${p.treeName} L${levels[i].lv}`);
    }
  }
  for (const p of branchProposals) {
    const levels = [...p.tree.levels].sort((a, b) => a.lv - b.lv);
    for (let i = 1; i < levels.length; i++) {
      assert.ok(levels[i].raw >= levels[i - 1].raw, `RAW invertido en ${p.treeName} L${levels[i].lv}`);
    }
  }
});

test("Stage 15: C4 ! alineada con C3 en todo el catálogo tras aplicar propuestas", () => {
  const lines = reconstructLines(bowData);
  const bow = JSON.parse(JSON.stringify(bowData));
  applyProposalsInMemory(bow, lines);
  let total = 0, ok = 0;
  for (const tree of bow.trees.filter(t => !t.dummy)) {
    for (const level of tree.levels) {
      const charges = level.x?.charges || [];
      if (charges[3] && charges[3].endsWith("!")) {
        total++;
        const prevType = charges[2]?.split(" ")[0];
        const curType = charges[3].split(" ")[0];
        if (prevType && prevType === curType) ok++;
      }
    }
  }
  assert.ok(total > 0, "hay C4 con Recargando en el catálogo");
  assert.equal(ok, total, "todas las C4 ! están alineadas con C3");
});

// ---------- 5. Purismo: no se toca bow.json ----------

test("Stage 15: el motor de propuestas es purista (no modifica bow.json)", () => {
  const lines = reconstructLines(bowData);
  const bow = JSON.parse(JSON.stringify(bowData));
  applyProposalsInMemory(bow, lines);
  // bow.json en disco no cambia
  assert.equal(JSON.stringify(readJson("data/weapons/bow.json")), bowBefore);
});

test("Stage 15: la matriz de cobertura inicial tiene 19 objetivos elementales sin cobertura terminal", () => {
  const lines = reconstructLines(bowData);
  const matrix = buildCoverageMatrix(lines);
  const uncoveredElemental = matrix.filter(o => o.specialization === "elemental" && !o.coveredTerminal);
  assert.equal(uncoveredElemental.length, 19);
  const uncoveredRaw = matrix.filter(o => o.specialization === "raw" && !o.coveredStructural);
  assert.equal(uncoveredRaw.length, 0, "RAW tiene cobertura estructural completa");
});
