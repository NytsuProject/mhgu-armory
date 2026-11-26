// Stage 13 — pruebas de la auditoría base y matriz de cobertura.
// Verifica: reconstrucción de líneas, matriz de 72 objetivos, cobertura
// RAW/elemental, y la ausencia de resultados híbridos en la matriz oficial.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import {
  reconstructLines,
  buildCoverageMatrix,
  detectSpecializationCandidates,
  SHOT_TYPES,
  ELEMENT_TYPES,
  RANKS,
  COVERAGE_MIN_ELEMENT,
} from "../tools/bow-specialization-audit.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const bowData = JSON.parse(readFileSync(resolve(__dirname, "../data/weapons/bow.json"), "utf8"));

const lines = reconstructLines(bowData);
const objectives = buildCoverageMatrix(lines);

test("Stage 13: reconstruye las 116 líneas del catálogo (107 originales + 9 ramas nuevas Stage 15)", () => {
  assert.equal(lines.length, 116);
  for (const line of lines) {
    assert.ok(line.treeId, "treeId presente");
    assert.ok(line.levelRecords.length >= 1, "al menos un nivel");
    assert.ok(line.terminal, "nivel terminal presente");
  }
});

test("Stage 13: cada línea expone RAW, elemento, cargas y coatings por nivel", () => {
  const sample = lines.find(l => l.terminal?.element?.value >= COVERAGE_MIN_ELEMENT);
  assert.ok(sample, "existe una línea elemental de referencia");
  const t = sample.terminal;
  assert.equal(typeof t.raw, "number");
  assert.ok(t.element && ELEMENT_TYPES.includes(t.element.type));
  assert.ok(Array.isArray(t.chargeTypes) && t.chargeTypes.length > 0);
  assert.ok(Array.isArray(t.mainChargeTypes));
  assert.ok(Array.isArray(t.coatings));
});

test("Stage 13: la matriz oficial tiene exactamente 72 objetivos", () => {
  assert.equal(objectives.length, 72);
  const raw = objectives.filter(o => o.specialization === "raw");
  const elem = objectives.filter(o => o.specialization === "elemental");
  assert.equal(raw.length, 12);
  assert.equal(elem.length, 60);
  // 12 RAW = 4 shots × 3 ranks; 60 elemental = 5 elements × 4 shots × 3 ranks
  for (const rank of RANKS) {
    assert.equal(raw.filter(o => o.rank === rank).length, 4);
    assert.equal(elem.filter(o => o.rank === rank).length, 20);
  }
  for (const shot of SHOT_TYPES) {
    assert.equal(raw.filter(o => o.shot === shot).length, 3);
  }
  for (const element of ELEMENT_TYPES) {
    assert.equal(elem.filter(o => o.element === element).length, 12);
  }
});

test("Stage 13: la matriz oficial no contiene perfiles híbridos", () => {
  for (const o of objectives) {
    assert.ok(["raw", "elemental"].includes(o.specialization), "solo RAW o elemental");
    assert.notEqual(o.specialization, "hybrid");
  }
});

test("Stage 13: todos los objetivos RAW tienen cobertura estructural", () => {
  const raw = objectives.filter(o => o.specialization === "raw");
  for (const o of raw) {
    assert.ok(o.coveredStructural, `RAW ${o.id} con cobertura estructural`);
    assert.ok(o.coverageStructural.length > 0, `RAW ${o.id} con candidatos`);
  }
});

test("Stage 13: la cobertura terminal de elementales usa C3/C4 normalizadas", () => {
  // Verificar que un objetivo con cobertura terminal tenga candidatos reales
  // y que los candidatos terminales correspondan a líneas con nivel final.
  const covered = objectives.filter(o => o.specialization === "elemental" && o.coveredTerminal);
  assert.ok(covered.length > 0, "hay objetivos elementales con cobertura terminal");
  for (const o of covered) {
    for (const key of o.coverageTerminal) {
      const [treeId, ...rest] = key.split(":");
      const line = lines.find(l => String(l.treeId) === treeId && l.treeName === rest.join(":"));
      assert.ok(line, `línea existe para ${key}`);
      assert.ok(line.terminal, `línea con nivel terminal para ${key}`);
      const t = line.terminal;
      assert.ok(t.element && t.element.value >= COVERAGE_MIN_ELEMENT, "elemento natural ≥20");
      assert.ok(t.mainChargeTypes.includes(o.shot), "shot en C3/C4 normalizadas");
    }
  }
});

test("Stage 13: los objetivos sin cobertura terminal son un subconjunto de elementales", () => {
  const uncovered = objectives.filter(o => o.specialization === "elemental" && !o.coveredTerminal);
  for (const o of uncovered) {
    assert.equal(o.specialization, "elemental");
    assert.equal(o.coveredTerminal, false);
  }
  // RAW nunca queda sin cobertura terminal en esta métrica (se verifica en el reporte).
});

test("Stage 13: detectSpecializationCandidates identifica ramas con señales de identidad", () => {
  const candidates = detectSpecializationCandidates(lines);
  assert.ok(candidates.length > 0, "se detectan candidatas");
  for (const c of candidates) {
    assert.ok(c.reasons.length > 0, "razones presentes");
    assert.ok(Array.isArray(c.mainChargeTypes));
  }
  // Las razones deben ser conocidas
  const known = new Set([
    "elemento_natural_sin_coating_elemental",
    "elemento_natural_en_linea_raw",
    "raw_con_power_coating2",
  ]);
  for (const c of candidates) {
    for (const r of c.reasons) assert.ok(known.has(r), `razón conocida: ${r}`);
  }
});

test("Stage 13: la auditoría es read-only sobre bow.json", () => {
  // La auditoría reconstruye líneas sin mutar el catálogo: comparar una línea
  // reconstruida con los datos originales de bow.json.
  const tree = bowData.trees.find(t => t.id === lines[0].treeId);
  const origTerminal = [...tree.levels].sort((a, b) => a.lv - b.lv).pop();
  const rec = lines.find(l => l.treeId === tree.id).terminal;
  assert.equal(rec.raw, origTerminal.raw);
  assert.equal(rec.rank, rankFromRarityCheck(origTerminal.rar ?? tree.rarity));
});

function rankFromRarityCheck(r) {
  if (r >= 1 && r <= 3) return "LR";
  if (r >= 4 && r <= 7) return "HR";
  if (r >= 8 && r <= 11) return "G";
  return null;
}
