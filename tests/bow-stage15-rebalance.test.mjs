// Stage 15 — pruebas del rebalance del catálogo aplicado (RAW / elemental).
// El catálogo data/weapons/bow.json ya incluye las 10 conversiones y las 9
// ramas nuevas propuestas. Verifica:
//   - 116 líneas reconstruidas (107 originales + 9 ramas nuevas);
//   - la matriz de 72 objetivos está totalmente cubierta;
//   - cobertura RAW preservada (cada objetivo RAW mantiene ≥1 opción RAW);
//   - progresiones válidas (RAW no decreciente, elemento creciente al tope 30);
//   - C4 `!` alineada con C3;
//   - los 10 árboles convertidos tienen elemento natural al tope 30 y RAW
//     reducido (no aumentado);
//   - las 9 ramas nuevas cubren sus objetivos (rank, elemento ≥20, flecha);
//   - no queda objetivo elemental sin cobertura terminal.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

import {
  reconstructLines, buildCoverageMatrix,
} from "../tools/bow-specialization-audit.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const readJson = p => JSON.parse(readFileSync(resolve(root, p), "utf8"));

const bowData = readJson("data/weapons/bow.json");
const lines = reconstructLines(bowData);
const matrix = buildCoverageMatrix(lines);

// Árboles convertidos (Stage 15): id -> elemento objetivo
const CONVERTED = {
  80: "Fire", 93: "Thunder", 103: "Thunder",
  60: "Ice", 91: "Water", 87: "Dragon",
  106: "Fire", 98: "Thunder", 100: "Thunder",
  13: "Water",
};
// RAW objetivo de referencia (documentado en el reporte Stage 15)
const RAW_REF = {
  80: 310, 93: 270, 103: 310, 60: 310, 91: 300, 87: 410,
  106: 300, 98: 310, 100: 330, 13: 340,
};
const EXPECTED_SHOT = {
  80: "Rapid", 93: "Spread", 103: "Heavy",
  60: "Spread", 91: "Pierce", 87: "Pierce",
  106: "Rapid", 98: "Rapid", 100: "Spread",
  13: "Heavy",
};

// Ramas nuevas: id -> objetivo
const BRANCHES = [
  { id: 108, name: "Arco de hollín", rank: "HR", element: "Fire", shot: "Heavy" },
  { id: 109, name: "Arco de mareas", rank: "HR", element: "Water", shot: "Heavy" },
  { id: 110, name: "Arco de la corriente", rank: "G", element: "Water", shot: "Rapid" },
  { id: 111, name: "Arco de escarcha", rank: "G", element: "Ice", shot: "Rapid" },
  { id: 112, name: "Arco de ventisquero", rank: "G", element: "Ice", shot: "Spread" },
  { id: 113, name: "Arco glacial", rank: "G", element: "Ice", shot: "Heavy" },
  { id: 114, name: "Arco del abismo", rank: "G", element: "Dragon", shot: "Heavy" },
  { id: 115, name: "Arco de trueno torvo", rank: "LR", element: "Thunder", shot: "Heavy" },
  { id: 116, name: "Arco de hielo torvo", rank: "LR", element: "Ice", shot: "Heavy" },
];

// ---------- 1. Reconstrucción ----------

test("Stage 15: se reconstruyen 116 líneas (107 originales + 9 ramas nuevas)", () => {
  assert.equal(lines.length, 116);
  for (const b of BRANCHES) {
    const line = lines.find(l => l.treeId === b.id);
    assert.ok(line, `rama ${b.id} presente`);
    assert.ok(line.parent, `rama ${b.id} tiene padre`);
  }
});

// ---------- 2. Cobertura de 72 objetivos ----------

test("Stage 15: la matriz de 72 objetivos está totalmente cubierta", () => {
  assert.equal(matrix.length, 72);
  const uncovered = matrix.filter(o => o.specialization === "raw" ? !o.coveredStructural : !o.coveredTerminal);
  assert.equal(uncovered.length, 0, `sin cobertura: ${uncovered.map(o => `${o.specialization} ${o.rank} ${o.element || "-"} ${o.shot}`).join(", ")}`);
});

test("Stage 15: ningún objetivo elemental queda sin cobertura terminal", () => {
  const uncoveredEle = matrix.filter(o => o.specialization === "elemental" && !o.coveredTerminal);
  assert.equal(uncoveredEle.length, 0);
});

test("Stage 15: cada objetivo RAW mantiene al menos una opción RAW-elegible", () => {
  // Cobertura RAW real: árbol con la flecha en C3/C4 y elemento natural <20.
  for (const rank of ["LR", "HR", "G"]) {
    for (const shot of ["Rapid", "Pierce", "Spread", "Heavy"]) {
      const rawOpts = lines.filter(l =>
        l.terminal.rank === rank
        && l.terminal.mainChargeTypes.includes(shot)
        && (!l.terminal.element || l.terminal.element.value < 20));
      assert.ok(rawOpts.length >= 1, `RAW ${rank} ${shot} sin opción RAW (${rawOpts.length})`);
    }
  }
});

// ---------- 3. Árboles convertidos ----------

test("Stage 15: los 10 árboles convertidos tienen elemento al tope 30 y RAW no aumentado", () => {
  for (const [idStr, element] of Object.entries(CONVERTED)) {
    const id = Number(idStr);
    const line = lines.find(l => l.treeId === id);
    assert.ok(line, `árbol ${id} presente`);
    const t = line.terminal;
    assert.equal(t.element.type, element, `árbol ${id} es ${element}`);
    assert.equal(t.element.value, 30, `árbol ${id} elemento al tope 30`);
    assert.ok(t.raw <= RAW_REF[id], `RAW de ${line.treeName} no aumenta (${t.raw} ≤ ${RAW_REF[id]})`);
  }
});

test("Stage 15: los árboles convertidos mantienen la flecha objetivo en C3/C4", () => {
  for (const [idStr, shot] of Object.entries(EXPECTED_SHOT)) {
    const line = lines.find(l => l.treeId === Number(idStr));
    assert.ok(line.terminal.mainChargeTypes.includes(shot), `árbol ${idStr} tiene ${shot} en C3/C4`);
  }
});

// ---------- 4. Ramas nuevas ----------

test("Stage 15: las 9 ramas nuevas cubren sus objetivos (rank, elemento, flecha)", () => {
  for (const exp of BRANCHES) {
    const line = lines.find(l => l.treeId === exp.id);
    assert.ok(line, `rama ${exp.id} presente`);
    const t = line.terminal;
    assert.equal(t.element.type, exp.element);
    assert.ok(t.element.value >= 20);
    assert.equal(t.element.value, 30, `rama ${exp.id} elemento al tope 30`);
    assert.ok(t.mainChargeTypes.includes(exp.shot), `rama ${exp.id} tiene ${exp.shot} en C3/C4`);
    assert.equal(t.rank, exp.rank);
  }
});

test("Stage 15: las ramas nuevas tienen C4 ! alineada con C3 en todos sus niveles", () => {
  for (const b of BRANCHES) {
    const tree = bowData.trees.find(t => Number(t.id) === b.id);
    assert.ok(tree, `árbol ${b.id} presente`);
    for (const level of tree.levels) {
      const charges = level.x.charges;
      assert.ok(charges[3].endsWith("!"), `C4 con Recargando en ${b.id} L${level.lv}`);
      const c3Type = charges[2].split(" ")[0];
      const c4Type = charges[3].split(" ")[0];
      assert.equal(c4Type, c3Type, `C4 ! alineado con C3 en ${b.id} L${level.lv}`);
    }
  }
});

// ---------- 5. Progresiones y reglas protegidas ----------

test("Stage 15: todas las progresiones son válidas (RAW no decreciente)", () => {
  for (const tree of bowData.trees.filter(t => !t.dummy)) {
    const levels = [...tree.levels].sort((a, b) => a.lv - b.lv);
    for (let i = 1; i < levels.length; i++) {
      assert.ok(levels[i].raw >= levels[i - 1].raw,
        `RAW invertido en ${tree.nameEs} L${levels[i].lv} (${levels[i].raw} < ${levels[i - 1].raw})`);
    }
  }
});

test("Stage 15: el elemento natural no supera el cap 30 y crece sin inversión", () => {
  for (const tree of bowData.trees.filter(t => !t.dummy)) {
    const levels = [...tree.levels].sort((a, b) => a.lv - b.lv);
    for (let i = 0; i < levels.length; i++) {
      for (const row of levels[i].ele || []) {
        if (["Fire", "Water", "Thunder", "Ice", "Dragon"].includes(row[1])) {
          assert.ok(row[2] <= 30, `${tree.nameEs} L${levels[i].lv} supera el cap`);
        }
      }
      if (i + 1 < levels.length) {
        const cur = levels[i].ele?.[0];
        const next = levels[i + 1].ele?.[0];
        if (cur && next && ["Fire", "Water", "Thunder", "Ice", "Dragon"].includes(cur[1])
          && ["Fire", "Water", "Thunder", "Ice", "Dragon"].includes(next[1])) {
          assert.ok(next[2] >= cur[2], `inversión de elemento en ${tree.nameEs} L${levels[i + 1].lv}`);
        }
      }
    }
  }
});

test("Stage 15: C4 ! alineada con C3 en todo el catálogo", () => {
  let total = 0, ok = 0;
  for (const tree of bowData.trees.filter(t => !t.dummy)) {
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
  assert.ok(total > 0);
  assert.equal(ok, total, "todas las C4 ! están alineadas con C3");
});

test("Stage 15: las cargas C1-C4 de las ramas nuevas respetan el formato y la flecha objetivo", () => {
  for (const b of BRANCHES) {
    const tree = bowData.trees.find(t => Number(t.id) === b.id);
    for (const level of tree.levels) {
      const charges = level.x.charges;
      assert.equal(charges.length, 4);
      assert.ok(charges[2].startsWith(b.shot), `C3 = ${b.shot} en ${b.id} L${level.lv}`);
      assert.ok(charges[3].startsWith(b.shot), `C4 = ${b.shot} en ${b.id} L${level.lv}`);
    }
  }
});
