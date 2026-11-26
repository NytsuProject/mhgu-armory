#!/usr/bin/env node
// Stage 13 — Auditoría base y matriz de cobertura de especialización RAW / elemental.
//
// Reconstruye las 107 líneas del catálogo de arcos (sin modificar bow.json) y
// produce una matriz oficial de 72 objetivos:
//   RAW:     4 tipos de flecha × 3 rangos = 12 objetivos.
//   Elemental: 5 elementos × 4 tipos de flecha × 3 rangos = 60 objetivos.
//
// Dos métricas de cobertura por objetivo:
//   - estructural: existe al menos un NIVEL del catálogo en ese rango con ese
//     tipo de flecha (y elemento natural para los elementales).
//   - terminal:    existe al menos un NIVEL FINAL de línea en ese rango con ese
//     tipo de flecha (y elemento natural) entre sus cargas principales
//     (C3/C4 normalizadas con la regla de Recargando).
//
// Emite JSON y CSV reproducibles, además de un resumen por consola.
// Read-only: nunca escribe data/weapons/bow.json.

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseCharge, rankFromRarity, normalizeLoadUpCharge, ELEMENTAL_TYPES } from "../js/bow-branch-audit.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

export const SHOT_TYPES = Object.freeze(["Rapid", "Pierce", "Spread", "Heavy"]);
export const ELEMENT_TYPES = Object.freeze(["Fire", "Water", "Thunder", "Ice", "Dragon"]);
export const RANKS = Object.freeze(["LR", "HR", "G"]);

export const COVERAGE_MIN_ELEMENT = 20; // umbral documentado para «elemento considerable»

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

function naturalElement(level) {
  const row = (level.ele || []).find(r => r && ELEMENTAL_TYPES.has(r[1]));
  if (!row) return null;
  return { label: row[0], type: row[1], value: Number(row[2] || 0) };
}

function rankOfLevel(level, tree) {
  return rankFromRarity(Number(level.rar ?? tree.rarity));
}

function normalizedCharges(level) {
  const raw = level.x?.charges || [];
  return raw.map((c, i) => normalizeLoadUpCharge(raw, i));
}

/** Tipos de flecha disponibles entre las cargas indicadas (normalizadas). */
function shotTypesInSlots(level, slots) {
  const cn = normalizedCharges(level);
  const out = new Set();
  for (const i of slots) {
    const p = parseCharge(cn[i]);
    if (p) out.add(p.type);
  }
  return [...out];
}

/** Reconstrucción completa de las 107 líneas del catálogo. */
export function reconstructLines(bowData) {
  const trees = (bowData.trees || []).filter(tree => !tree.dummy);
  const lines = trees.map(tree => {
    const levels = [...(tree.levels || [])]
      .filter(lv => Number.isFinite(Number(lv.lv)))
      .sort((a, b) => Number(a.lv) - Number(b.lv));
    const levelRecords = levels.map(level => {
      const ele = naturalElement(level);
      return {
        localLevel: Number(level.lv),
        name: level.nEs || level.n,
        rarity: Number(level.rar ?? tree.rarity),
        rank: rankOfLevel(level, tree),
        raw: Number(level.raw || 0),
        affinity: Number(level.aff || 0),
        slots: level.slots ?? null,
        element: ele,
        role: ele ? "elemental" : "raw",
        coatings: [...(level.x?.coatings || [])],
        chargesRaw: [...(level.x?.charges || [])],
        chargesNormalized: normalizedCharges(level),
        chargeTypes: shotTypesInSlots(level, [0, 1, 2, 3]),
        mainChargeTypes: shotTypesInSlots(level, [2, 3]),
      };
    });
    const terminal = levelRecords[levelRecords.length - 1] || null;
    const firstRank = levelRecords[0]?.rank || null;
    const progressionRanks = [...new Set(levelRecords.map(r => r.rank))];
    return {
      treeId: tree.id,
      treeName: tree.nameEs || tree.name,
      finalName: tree.finalNameEs || tree.finalName || null,
      maxLevel: levels.length,
      parent: tree.parent ? { treeId: tree.parent[0], localLevel: Number(tree.parent[1]) } : null,
      firstRank,
      terminalRank: terminal?.rank || null,
      progressionRanks,
      levelCount: levelRecords.length,
      levelRecords,
      terminal,
    };
  });
  return lines;
}

/** Matriz de 72 objetivos y su cobertura. */
export function buildCoverageMatrix(lines, options = {}) {
  const minElement = options.minElement ?? COVERAGE_MIN_ELEMENT;
  const mainSlots = [2, 3]; // C3/C4 normalizadas: cargas principales

  // índices de cobertura
  const structural = new Map();   // `${rank}|${shot}`        -> [lineKey...]
  const terminalEle = new Map();   // `${rank}|${ele}|${shot}` -> [lineKey...]
  for (const line of lines) {
    const key = `${line.treeId}:${line.treeName}`;
    for (const rec of line.levelRecords) {
      if (!rec.rank) continue;
      for (const shot of rec.chargeTypes) {
        const k = `${rec.rank}|${shot}`;
        if (!structural.has(k)) structural.set(k, []);
        structural.get(k).push(`${key} L${rec.localLevel}`);
      }
      if (rec.element && rec.element.value >= minElement) {
        for (const shot of rec.chargeTypes) {
          const k = `${rec.rank}|${rec.element.type}|${shot}`;
          if (!structural.has(k)) structural.set(k, []);
          structural.get(k).push(`${key} L${rec.localLevel}`);
        }
      }
    }
    if (line.terminal && line.terminal.element && line.terminal.element.value >= minElement) {
      for (const shot of line.terminal.mainChargeTypes) {
        const k = `${line.terminal.rank}|${line.terminal.element.type}|${shot}`;
        if (!terminalEle.has(k)) terminalEle.set(k, []);
        terminalEle.get(k).push(key);
      }
    }
  }

  const objectives = [];
  for (const rank of RANKS) {
    for (const shot of SHOT_TYPES) {
      const covered = structural.get(`${rank}|${shot}`) || [];
      objectives.push({
        id: `raw-${rank}-${shot.toLowerCase()}`,
        specialization: "raw",
        rank,
        shot,
        element: null,
        coveredStructural: covered.length > 0,
        coverageStructural: covered,
        coveredTerminal: null,
        coverageTerminal: [],
      });
    }
    for (const element of ELEMENT_TYPES) {
      for (const shot of SHOT_TYPES) {
        const st = structural.get(`${rank}|${element}|${shot}`) || [];
        const te = terminalEle.get(`${rank}|${element}|${shot}`) || [];
        objectives.push({
          id: `elemental-${rank}-${element.toLowerCase()}-${shot.toLowerCase()}`,
          specialization: "elemental",
          rank,
          shot,
          element,
          coveredStructural: st.length > 0,
          coverageStructural: st,
          coveredTerminal: te.length > 0,
          coverageTerminal: te,
        });
      }
    }
  }
  return objectives;
}

/** Candidatas a re-especialización: ramas con alguna señal de identidad débil. */
export function detectSpecializationCandidates(lines) {
  const candidates = [];
  for (const line of lines) {
    const t = line.terminal;
    if (!t) continue;
    const reasons = [];
    if (t.element && t.element.value >= COVERAGE_MIN_ELEMENT) {
      // elemental natural sin revestimiento elemental: candidata a especialización elemental
      if (!t.coatings.includes("Element Coating") && !t.coatings.includes("Element Coating 2")) {
        reasons.push("elemento_natural_sin_coating_elemental");
      }
      // elemento natural alto en una línea RAW (rol raw) — señal de identidad dudosa
      if (line.levelRecords.every(r => !r.element || r.element.value < COVERAGE_MIN_ELEMENT)) {
        reasons.push("elemento_natural_en_linea_raw");
      }
    }
    if (!t.element || t.element.value < COVERAGE_MIN_ELEMENT) {
      // línea RAW con Power Coating 2: identidad RAW clara
      if (t.coatings.includes("Power Coating 2")) {
        reasons.push("raw_con_power_coating2");
      }
    }
    if (reasons.length) {
      candidates.push({
        treeId: line.treeId,
        treeName: line.treeName,
        terminalRank: t.rank,
        terminalRaw: t.raw,
        terminalElement: t.element,
        mainChargeTypes: t.mainChargeTypes,
        coatings: t.coatings,
        reasons,
      });
    }
  }
  return candidates;
}

function csvEscape(value) {
  if (value === null || value === undefined) return "";
  const s = String(value);
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

function main() {
  const args = readArgs(process.argv);
  const bowPath = resolve(args.bow || "data/weapons/bow.json");
  const outDir = resolve(args.out || "tools/out/stage13");
  const bowData = JSON.parse(readFileSync(bowPath, "utf8"));

  const lines = reconstructLines(bowData);
  const objectives = buildCoverageMatrix(lines);
  const candidates = detectSpecializationCandidates(lines);

  const uncoveredTerminal = objectives.filter(o => o.specialization === "elemental" && !o.coveredTerminal);
  const uncoveredStructural = objectives.filter(o => !o.coveredStructural);

  mkdirSync(outDir, { recursive: true });

  // 1. Inventario de líneas (CSV + JSON)
  writeFileSync(
    resolve(outDir, "bow-specialization-lines.json"),
    JSON.stringify({ metadata: { lineCount: lines.length, source: bowPath }, lines }, null, 2)
  );
  const linesCsv = [
    "tree_id", "tree_name", "terminal_rank", "terminal_raw", "terminal_element_type",
    "terminal_element_value", "terminal_affinity", "terminal_slots", "first_rank",
    "progression_ranks", "coating_power2", "coating_element", "coating_element2",
    "main_charge_types", "level_count",
  ];
  const linesRows = lines.map(line => {
    const t = line.terminal;
    return [
      line.treeId, line.treeName, t?.rank, t?.raw, t?.element?.type, t?.element?.value,
      t?.affinity, t?.slots, line.firstRank, line.progressionRanks.join("|"),
      t?.coatings.includes("Power Coating 2"), t?.coatings.includes("Element Coating"),
      t?.coatings.includes("Element Coating 2"), t?.mainChargeTypes.join("|"),
      line.levelCount,
    ].map(csvEscape).join(",");
  });
  writeFileSync(resolve(outDir, "bow-specialization-lines.csv"), [linesCsv.join(","), ...linesRows].join("\n"));

  // 2. Matriz de cobertura (CSV + JSON)
  writeFileSync(
    resolve(outDir, "bow-specialization-coverage.json"),
    JSON.stringify({
      metadata: {
        objectiveCount: objectives.length,
        rawObjectives: objectives.filter(o => o.specialization === "raw").length,
        elementalObjectives: objectives.filter(o => o.specialization === "elemental").length,
        uncoveredStructural: uncoveredStructural.map(o => o.id),
        uncoveredTerminalElemental: uncoveredTerminal.map(o => o.id),
        definitions: {
          structural: "al menos un nivel del catálogo en el rango con ese tipo de flecha (y elemento natural ≥20 para elementales)",
          terminal: "al menos un nivel final de línea en el rango con ese tipo de flecha entre C3/C4 normalizadas (y elemento natural ≥20)",
        },
      },
      objectives,
    }, null, 2)
  );
  const covCsv = [
    "objective_id", "specialization", "rank", "shot", "element",
    "covered_structural", "structural_candidates", "covered_terminal", "terminal_candidates",
  ];
  const covRows = objectives.map(o => [
    o.id, o.specialization, o.rank, o.shot, o.element ?? "",
    o.coveredStructural, o.coverageStructural.join(" | "), o.coveredTerminal, o.coverageTerminal.join(" | "),
  ].map(csvEscape).join(","));
  writeFileSync(resolve(outDir, "bow-specialization-coverage.csv"), [covCsv.join(","), ...covRows].join("\n"));

  // 3. Combinaciones sin cobertura
  writeFileSync(
    resolve(outDir, "bow-specialization-uncovered.json"),
    JSON.stringify({ uncoveredStructural, uncoveredTerminalElemental: uncoveredTerminal }, null, 2)
  );

  // 4. Candidatas a especialización
  writeFileSync(
    resolve(outDir, "bow-specialization-candidates.json"),
    JSON.stringify({ metadata: { candidateCount: candidates.length }, candidates }, null, 2)
  );

  // Resumen por consola
  console.log(`Stage 13 — auditoría de especialización`);
  console.log(`Líneas reconstruidas: ${lines.length} (${lines.filter(l => !l.parent).length} raíz, ${lines.filter(l => l.parent).length} rama)`);
  console.log(`Objetivos: ${objectives.length} (${objectives.filter(o => o.specialization === "raw").length} RAW, ${objectives.filter(o => o.specialization === "elemental").length} elemental)`);
  console.log(`RAW: cobertura estructural completa: ${objectives.filter(o => o.specialization === "raw" && o.coveredStructural).length}/12`);
  console.log(`Elemental sin cobertura estructural: ${uncoveredStructural.length}`);
  for (const o of uncoveredStructural) console.log(`  - ${o.id}`);
  console.log(`Elemental sin cobertura terminal: ${uncoveredTerminal.length}`);
  for (const o of uncoveredTerminal) console.log(`  - ${o.id}`);
  console.log(`Candidatas a especialización detectadas: ${candidates.length}`);
  console.log(`Generados: ${outDir}/bow-specialization-{lines,coverage,uncovered,candidates}.{json,csv}`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
