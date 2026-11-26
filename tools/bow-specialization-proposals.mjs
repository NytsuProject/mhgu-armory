#!/usr/bin/env node
// Stage 15 — Propuestas de rebalance del catálogo (RAW / elemental).
//
// Propone cambios de RAW y elemento natural para resolver las combinaciones
// sin cobertura terminal, sin inventar armas nuevas: se aprovechan líneas
// existentes que ya tienen el tipo de flecha requerido en C3/C4 y se les
// asigna la especialización correspondiente.
//
// El proceso es purista: NO escribe data/weapons/bow.json. Genera una tabla
// antes/después por arma y nivel (JSON + CSV) y un informe justificativo.
//
// Reglas aplicadas:
//   - No se cambia el tipo elemental de un arma ni se inventa una propiedad
//     sin fuente justificativa.
//   - Las cargas (C1–C4) y su comportamiento NO se modifican: solo se asignan
//     elementos/RAW a líneas que ya tienen la flecha requerida.
//   - C4 `!` se mantiene alineada con C3 (regla protegida).
//   - No se generan valores absurdos: el elemento se fija al tope 30 (referencia
//     inicial) y el RAW se reduce a un rango razonable de elementales del rango.
//   - Se ajusta la progresión completa (niveles inferiores progresivos).
//   - Las líneas RAW de referencia (Power Coating 2, identidad RAW clara) no
//     se convierten en elementales cuando hay alternativa.

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { reconstructLines, SHOT_TYPES, ELEMENT_TYPES, RANKS } from "./bow-specialization-audit.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));

export const ELEMENT_CAP = 30;

/** Líneas cuyo terminal tiene un elemento natural (cualquier valor). */
function withElement(line) {
  return Boolean(line.terminal?.element);
}

/** ¿La línea es una referencia RAW clara (Power Coating 2 terminal)? */
function isRawReference(line) {
  return Boolean(line.terminal?.coatings?.includes("Power Coating 2"));
}

/**
 * ¿La línea es elegible como opción RAW para su (rank, shot)?
 * Elemento natural ausente o < 20 (no es un elemental especializado).
 */
function isRawEligible(line) {
  const t = line.terminal;
  if (!t) return false;
  return !t.element || t.element.value < 20;
}

/**
 * Guarda de cobertura RAW: para cada (rank, shot), nunca convertir TODAS las
 * líneas RAW-elegibles. Se reserva al menos una como opción RAW competitiva
 * (la matriz de 72 objetivos exige cobertura RAW, no solo elemental).
 * Devuelve { total, used } donde `used` se incrementa al asignar una
 * conversión de una línea RAW-elegible.
 */
function rawEligibilityIndex(lines) {
  const total = new Map(); // `${rank}|${shot}` -> count
  for (const line of lines) {
    const t = line.terminal;
    if (!t || !isRawEligible(line)) continue;
    for (const shot of t.mainChargeTypes) {
      const k = `${t.rank}|${shot}`;
      total.set(k, (total.get(k) || 0) + 1);
    }
  }
  return total;
}

/** ¿Convertir esta línea dejaría 0 opciones RAW para su (rank, shot)? */
function wouldDestroyRawCoverage(rawIndex, usedRaw, rank, shot, line) {
  if (!isRawEligible(line)) return false;
  const k = `${rank}|${shot}`;
  const total = rawIndex.get(k) || 0;
  if (total === 0) return false;
  return (usedRaw.get(k) || 0) + 1 >= total;
}

/** RAW típico de los elementales del rango (media de terminales elementales). */
function typicalElementalRaw(lines, rank) {
  const vals = lines
    .filter(l => l.terminal && l.terminal.rank === rank && withElement(l) && l.terminal.element.value >= 20)
    .map(l => l.terminal.raw);
  if (!vals.length) return null;
  return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
}

/**
 * Para un objetivo (rank, element, shot) sin cobertura terminal, busca la
 * línea candidato a convertir: tiene la flecha en C3/C4, no tiene elemento
 * natural ≥20, y no es una referencia RAW (Power Coating 2) si hay alternativa.
 * Devuelve la mejor candidata o null.
 */
export function findConversionCandidate(lines, rank, element, shot) {
  const candidates = lines.filter(line => {
    const t = line.terminal;
    if (!t || t.rank !== rank) return false;
    if (!t.mainChargeTypes.includes(shot)) return false;
    if (t.element && t.element.value >= 20) return false;
    // No convertir una línea que ya tiene el elemento objetivo (no tiene sentido).
    if (t.element && t.element.type === element) return false;
    return true;
  });
  if (!candidates.length) return null;
  // Preferencia: líneas sin Element Coating 2 (que no sean hybrid-capacidad) y
  // sin Power Coating 2 (no destruir referencias RAW) si hay alternativa.
  const nonRef = candidates.filter(c => !isRawReference(c));
  const pool = nonRef.length ? nonRef : candidates;
  // Orden: menos RAW actual (menos potencial físico a sacrificar), luego más
  // ranuras (más flexibilidad).
  return pool.slice().sort((a, b) => a.terminal.raw - b.terminal.raw)[0];
}

/**
 * Valida que una propuesta de conversión respeta la progresión:
 *   - el elemento natural crece con el nivel (sin inversión);
 *   - el RAW no crece en la conversión (no se sube artificialmente);
 *   - la conversión no supera el tope de elemento.
 * Devuelve { ok, errors }.
 */
export function validateProposal(proposal) {
  const errors = [];
  const plan = proposal.levelPlan;
  for (let i = 1; i < plan.length; i++) {
    const prev = plan[i - 1].after, cur = plan[i].after;
    if (cur.element.value < prev.element.value) {
      errors.push(`inversión de elemento en ${proposal.treeName} L${plan[i].localLevel}: ${prev.element.value} → ${cur.element.value}`);
    }
    if (cur.raw < prev.raw) {
      errors.push(`RAW no monótono (inversión) en ${proposal.treeName} L${plan[i].localLevel}: ${prev.raw} → ${cur.raw}`);
    }
  }
  if (plan.some(lv => lv.after.element.value > ELEMENT_CAP)) {
    errors.push(`elemento por encima del tope ${ELEMENT_CAP} en ${proposal.treeName}`);
  }
  // El terminal no debe tener más RAW que antes (conversión a elemental).
  if (proposal.terminalAfter.raw > proposal.terminalBefore.raw) {
    errors.push(`RAW terminal no reducido en ${proposal.treeName}`);
  }
  return { ok: errors.length === 0, errors };
}

/**
 * Propuesta de cambio para una línea: elemento natural (tipo, valor al tope)
 * y RAW reducido a un valor razonable para elemental del rango.
 * Se ajusta la progresión completa: los niveles inferiores reciben el elemento
 * progresivamente (sin inversión), y su RAW se reduce de forma gradual.
 */
export function proposeLineConversion(lines, line, element, rank) {
  const current = line.terminal;
  const typical = typicalElementalRaw(lines, rank);
  // RAW objetivo: como máximo el RAW típico de elementales del rango; nunca
  // superior al RAW actual (se sacrifica potencial físico).
  const targetRaw = Math.min(current.raw, typical ?? current.raw - 40);
  const rawDelta = targetRaw - current.raw;
  // Progresión de elementos: niveles inferiores reciben valores crecientes que
  // terminan en ELEMENT_CAP, sin superar el valor del nivel superior.
  const levelPlan = [];
  const levels = line.levelRecords;
  for (let i = 0; i < levels.length; i++) {
    const rec = levels[i];
    const frac = levels.length === 1 ? 1 : (i + 1) / levels.length;
    const value = Math.max(0, Math.round(ELEMENT_CAP * frac));
    // RAW: escalamiento proporcional (k = RAW terminal objetivo / RAW terminal
    // actual). Todos los niveles se reducen con el mismo factor, lo que
    // mantiene la progresión creciente original sin inversión.
    const k = current.raw > 0 ? targetRaw / current.raw : 1;
    const rawValue = Math.max(0, Math.round(rec.raw * k));
    levelPlan.push({
      localLevel: rec.localLevel,
      before: { raw: rec.raw, element: rec.element ? { type: rec.element.type, value: rec.element.value } : null },
      after: { raw: rawValue, element: { type: element, value } },
    });
  }
  return {
    treeId: line.treeId,
    treeName: line.treeName,
    terminalRank: rank,
    terminalBefore: { raw: current.raw, element: current.element },
    terminalAfter: { raw: targetRaw, element: { type: element, value: ELEMENT_CAP } },
    rationale: `Se especializa como ${element}: elemento natural al tope ${ELEMENT_CAP} y RAW reducido a ${targetRaw} (potencial físico sacrificado para la especialización elemental).`,
    levelPlan,
  };
}

/** Objetivos sin cobertura terminal (definición de Stage 13). */
export function uncoveredTerminalObjectives(lines) {
  // Recalcular la cobertura terminal aquí para no depender del artifact.
  const ELEMENTS = ELEMENT_TYPES;
  const terminalCover = new Map(); // rank|element|shot -> count
  for (const line of lines) {
    const t = line.terminal;
    if (!t || !t.element || t.element.value < 20) continue;
    for (const shot of t.mainChargeTypes) {
      const k = `${t.rank}|${t.element.type}|${shot}`;
      terminalCover.set(k, (terminalCover.get(k) || 0) + 1);
    }
  }
  const uncovered = [];
  for (const rank of RANKS) for (const element of ELEMENTS) for (const shot of SHOT_TYPES) {
    if (!terminalCover.get(`${rank}|${element}|${shot}`)) uncovered.push({ rank, element, shot });
  }
  return uncovered;
}

function csvEscape(value) {
  if (value === null || value === undefined) return "";
  const s = String(value);
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

/**
 * Emparejamiento: cada línea se convierte en UN solo elemento. Un árbol no
 * puede especializarse en varios elementos a la vez, así que se asignan las
 * líneas candidatas a objetivos uno a uno (greedy: objetivos con menos
 * candidatos primero, que son los más restrictivos).
 */
export function matchObjectivesToLines(lines, objectives) {
  const used = new Set();
  const assignments = [];
  const unresolved = [];

  // Índice de elegibilidad RAW por (rank, shot) y reserva de cobertura.
  const rawIndex = rawEligibilityIndex(lines);
  const usedRaw = new Map(); // `${rank}|${shot}` -> conversiones RAW-elegibles

  // Para cada objetivo, listar líneas candidatas base (sin reutilizar).
  // La guarda de cobertura RAW se aplica en el momento de la asignación
  // (depende de las conversiones ya realizadas).
  const pools = objectives.map(obj => {
    const all = lines.filter(line => {
      const t = line.terminal;
      if (!t || t.rank !== obj.rank) return false;
      if (!t.mainChargeTypes.includes(obj.shot)) return false;
      if (t.element && t.element.value >= 20) return false;
      if (t.element && t.element.type === obj.element) return false;
      return true;
    });
    const nonRef = all.filter(c => !isRawReference(c));
    return (nonRef.length ? nonRef : all)
      .slice()
      .sort((a, b) => a.terminal.raw - b.terminal.raw);
  });

  // Ordenar objetivos por número de candidatos (más restrictivos primero).
  const order = objectives.map((_, i) => i).sort((a, b) => pools[a].length - pools[b].length);
  for (const idx of order) {
    const obj = objectives[idx];
    const pool = pools[idx].filter(line => !used.has(line.treeId)
      && !wouldDestroyRawCoverage(rawIndex, usedRaw, obj.rank, obj.shot, line));
    if (!pool.length) {
      // Registrar las opciones que existían (todas ya usadas) para documentar
      // por qué queda sin solución.
      const options = pools[idx].map(line => ({
        treeId: line.treeId, treeName: line.treeName, raw: line.terminal.raw,
        powerCoating2: line.terminal.coatings.includes("Power Coating 2"),
      }));
      unresolved.push({
        objective: obj,
        reason: "todas las líneas con esa flecha en C3/C4 ya se asignaron a otros elementos (un árbol no puede ser varios elementos); convertir alguna exigiría destruir una referencia RAW o añadir una línea nueva",
        options,
      });
      continue;
    }
    const candidate = pool[0];
    used.add(candidate.treeId);
    if (isRawEligible(candidate)) {
      const k = `${obj.rank}|${obj.shot}`;
      usedRaw.set(k, (usedRaw.get(k) || 0) + 1);
    }
    assignments.push({ objective: obj, candidate });
  }
  return { assignments, unresolved };
}

/** RAW objetivo para una rama nueva (elemental) del rango. */
export const BRANCH_TARGET_RAW = { LR: 277, HR: 293, G: 299 };

const ELEMENT_LABELS = { Fire: "Fuego", Water: "Agua", Thunder: "Rayo", Ice: "Hielo", Dragon: "Dragón" };

/**
 * Especificaciones de las 7 ramas nuevas propuestas (Stage 15).
 * Cada rama deriva de un árbol existente que ya tiene la flecha objetivo en
 * C3/C4; la rama es un árbol nuevo (identidad elemental propia).
 */
export const BRANCH_SPECS = [
  {
    objective: { rank: "HR", element: "Fire", shot: "Heavy" },
    parentTreeId: 53, parentLevel: 1,
    nameEs: "Arco de hollín", name: "Ember Bow",
    finalNameEs: "Arco de hollín abrasador", finalName: "Scorching Ember Bow",
    rarity: 7, arc: "Focus",
    rationale: "Rama nueva especializada en Fire: elemento natural al tope 30 y RAW típico de elemental HR, con Heavy en C3/C4. La única línea RAW HR Heavy (Arco casco demoníaco) se conserva como referencia RAW (guarda de cobertura).",
  },
  {
    objective: { rank: "HR", element: "Water", shot: "Heavy" },
    parentTreeId: 35, parentLevel: 1,
    nameEs: "Arco de mareas", name: "Tidal Bow",
    finalNameEs: "Arco de mareas furioso", finalName: "Furious Tidal Bow",
    rarity: 5, arc: "Focus",
    rationale: "Rama nueva especializada en Water: elemento natural al tope 30 y RAW típico de elemental HR, con Heavy en C3/C4 (herencia de cargas del padre).",
  },
  {
    objective: { rank: "G", element: "Water", shot: "Rapid" },
    parentTreeId: 79, parentLevel: 1,
    nameEs: "Arco de la corriente", name: "Current Bow",
    finalNameEs: "Arco de la corriente furiosa", finalName: "Furious Current Bow",
    rarity: 11, arc: "Blast",
    rationale: "Rama nueva especializada en Water: elemento natural al tope 30 y RAW típico de elemental G, con Rapid en C3/C4.",
  },
  {
    objective: { rank: "G", element: "Ice", shot: "Rapid" },
    parentTreeId: 76, parentLevel: 1,
    nameEs: "Arco de escarcha", name: "Frost Bow",
    finalNameEs: "Arco de escarcha glacial", finalName: "Glacial Frost Bow",
    rarity: 11, arc: "Blast",
    rationale: "Rama nueva especializada en Ice: elemento natural al tope 30 y RAW típico de elemental G, con Rapid en C3/C4.",
  },
  {
    objective: { rank: "G", element: "Ice", shot: "Spread" },
    parentTreeId: 105, parentLevel: 1,
    nameEs: "Arco de ventisquero", name: "Blizzard Bow",
    finalNameEs: "Arco de ventisquero eterno", finalName: "Eternal Blizzard Bow",
    rarity: 8, arc: "Wide",
    rationale: "Rama nueva especializada en Ice: elemento natural al tope 30 y RAW típico de elemental G, con Spread en C3/C4. Abanico (Spread) mantiene su MV y multiplicador (regla protegida).",
  },
  {
    objective: { rank: "G", element: "Ice", shot: "Heavy" },
    parentTreeId: 73, parentLevel: 1,
    nameEs: "Arco glacial", name: "Glacial Bow",
    finalNameEs: "Arco glacial absoluto", finalName: "Absolute Glacial Bow",
    rarity: 11, arc: "Blast",
    rationale: "Rama nueva especializada en Ice: elemento natural al tope 30 y RAW típico de elemental G, con Heavy en C3/C4.",
  },
  {
    objective: { rank: "G", element: "Dragon", shot: "Heavy" },
    parentTreeId: 70, parentLevel: 1,
    nameEs: "Arco del abismo", name: "Abyss Bow",
    finalNameEs: "Arco del abismo dragón", finalName: "Dragon Abyss Bow",
    rarity: 11, arc: "Blast",
    rationale: "Rama nueva especializada en Dragon: elemento natural al tope 30 y RAW típico de elemental G, con Heavy en C3/C4.",
  },
  {
    objective: { rank: "LR", element: "Water", shot: "Heavy" },
    parentTreeId: 50, parentLevel: 1,
    nameEs: "Arco de oleaje torvo", name: "Grimsurf Bow",
    finalNameEs: "Arco de oleaje eterno", finalName: "Eternal Grimsurf Bow",
    rarity: 3, arc: "Wide",
    rationale: "Rama nueva especializada en Water: elemento natural al tope 30 y RAW típico de elemental LR, con Heavy en C3/C4. Se conserva al menos una línea RAW LR Heavy (guarda de cobertura).",
  },
  {
    objective: { rank: "LR", element: "Thunder", shot: "Heavy" },
    parentTreeId: 22, parentLevel: 1,
    nameEs: "Arco de trueno torvo", name: "Grimthunder Bow",
    finalNameEs: "Arco de trueno eterno", finalName: "Eternal Grimthunder Bow",
    rarity: 3, arc: "Wide",
    rationale: "Rama nueva especializada en Thunder: elemento natural al tope 30 y RAW típico de elemental LR, con Heavy en C3/C4. Se conserva al menos una línea RAW LR Heavy (guarda de cobertura).",
  },
  {
    objective: { rank: "LR", element: "Ice", shot: "Heavy" },
    parentTreeId: 13, parentLevel: 1,
    nameEs: "Arco de hielo torvo", name: "Grimfrost Bow",
    finalNameEs: "Arco de hielo eterno", finalName: "Eternal Grimfrost Bow",
    rarity: 1, arc: "Blast",
    rationale: "Rama nueva especializada en Ice: elemento natural al tope 30 y RAW típico de elemental LR, con Heavy en C3/C4.",
  },
];

/** Nivel de carga para el nivel i (1..n) de una rama nueva. */
function chargeLevelFor(i, n) {
  return 1 + Math.round(3 * (i - 1) / Math.max(1, n - 1));
}

/** Cargas C1-C4 con la flecha objetivo en C3/C4 y C4 `!` alineado con C3. */
function buildBranchCharges(shot, i, n) {
  const base = chargeLevelFor(i, n);
  const main = Math.min(5, base + 1);
  if (shot === "Heavy") return [`Rapid Lv${base}`, `Pierce Lv${base}`, `Heavy Lv${main}`, `Heavy Lv${main}!`];
  if (shot === "Rapid") return [`Rapid Lv${base}`, `Rapid Lv${base}`, `Rapid Lv${main}`, `Rapid Lv${main}!`];
  return [`Spread Lv${base}`, `Spread Lv${base}`, `Spread Lv${main}`, `Spread Lv${main}!`];
}

/** Ranuras progresivas: ――― → ◯―― → ◯◯― → ◯◯◯. */
function buildBranchSlots(i, n) {
  if (i <= 2) return "―――";
  if (i <= 4) return "◯――";
  if (i <= 6) return "◯◯―";
  return "◯◯◯";
}

/** Coatings: elemental con Power Coating en los niveles altos. */
function buildBranchCoatings(i, n) {
  const early = ["Element Coating", "Power Coating", "Poison Coating", "Paralysis Coating"];
  const late = ["Element Coating 2", "Power Coating 2", "Poison Coating", "Paralysis Coating"];
  return i <= Math.floor(n / 2) ? early : late;
}

/**
 * Propuesta de rama nueva: árbol completo (8 niveles) con elemento natural al
 * tope 30, RAW típico de elemental del rango, la flecha objetivo en C3/C4 y
 * C4 `!` alineado con C3. NO escribe bow.json: devuelve el árbol proposed.
 */
export function proposeNewBranch(lines, bowData, spec, branchId) {
  const { objective, parentTreeId, parentLevel, nameEs, name, finalNameEs, finalName, rarity, arc, rationale } = spec;
  const n = 8;
  const targetRaw = BRANCH_TARGET_RAW[objective.rank];
  const parentTree = (bowData.trees || []).find(t => Number(t.id) === parentTreeId && !t.dummy);
  const monsters = parentTree && Array.isArray(parentTree.monsters) ? parentTree.monsters : [];
  const levelPlan = [];
  const levels = [];
  for (let i = 1; i <= n; i++) {
    const frac = (i - 1) / Math.max(1, n - 1);
    const raw = Math.round(targetRaw * (0.32 + 0.68 * frac));
    const eleValue = Math.max(1, Math.round(ELEMENT_CAP * i / n));
    const level = {
      lv: i,
      n: name,
      nEs: nameEs,
      raw,
      aff: 0,
      def: 0,
      slots: buildBranchSlots(i, n),
      rar: rarity,
      ele: [[ELEMENT_LABELS[objective.element], objective.element, eleValue]],
      x: {
        arc,
        charges: buildBranchCharges(objective.shot, i, n),
        coatings: buildBranchCoatings(i, n),
      },
    };
    levels.push(level);
    levelPlan.push({
      localLevel: i,
      before: null,
      after: { raw, element: { type: objective.element, value: eleValue } },
    });
  }
  const tree = {
    id: branchId,
    name, nameEs,
    rarity,
    order: branchId,
    finalName, finalNameEs,
    maxLevel: n,
    stages: [[Math.floor(n / 2) + 1, name], [n, finalName]],
    parent: [parentTreeId, parentLevel],
    es: "PROPUESTA",
    dummy: false,
    monsters,
    deviant: false,
    levels,
  };
  return {
    type: "new_branch",
    treeId: branchId,
    treeName: nameEs,
    terminalRank: objective.rank,
    terminalBefore: null,
    terminalAfter: { raw: targetRaw, element: { type: objective.element, value: ELEMENT_CAP } },
    rationale,
    levelPlan,
    tree,
  };
}

/**
 * Valida una propuesta de rama nueva:
 *   - elemento crece con el nivel y terminal al tope 30;
 *   - RAW monótono (sin inversión);
 *   - C4 `!` alineado con C3 en todos los niveles.
 */
export function validateBranchProposal(proposal) {
  const errors = [];
  const plan = proposal.levelPlan;
  for (let i = 1; i < plan.length; i++) {
    const prev = plan[i - 1].after, cur = plan[i].after;
    if (cur.element.value < prev.element.value) {
      errors.push(`inversión de elemento en ${proposal.treeName} L${plan[i].localLevel}: ${prev.element.value} → ${cur.element.value}`);
    }
    if (cur.raw < prev.raw) {
      errors.push(`RAW no monótono (inversión) en ${proposal.treeName} L${plan[i].localLevel}: ${prev.raw} → ${cur.raw}`);
    }
  }
  if (plan.some(lv => lv.after.element.value > ELEMENT_CAP)) {
    errors.push(`elemento por encima del tope ${ELEMENT_CAP} en ${proposal.treeName}`);
  }
  if (proposal.terminalAfter.element.value !== ELEMENT_CAP) {
    errors.push(`elemento terminal sin tope en ${proposal.treeName}`);
  }
  const tree = proposal.tree;
  for (const lv of tree.levels) {
    const charges = lv.x.charges;
    for (let i = 0; i < charges.length; i++) {
      if (charges[i].endsWith("!")) {
        const prevType = charges[i - 1]?.split(" ")[0];
        const curType = charges[i].split(" ")[0];
        if (!(prevType && prevType === curType)) {
          errors.push(`C4 ! no alineado con C3 en ${proposal.treeName} L${lv.lv}: ${charges[i - 1]} → ${charges[i]}`);
        }
      }
    }
  }
  return { ok: errors.length === 0, errors };
}

function main() {
  const bowPath = resolve("data/weapons/bow.json");
  const outDir = resolve("tools/out/stage15");
  const bowData = JSON.parse(readFileSync(bowPath, "utf8"));
  const lines = reconstructLines(bowData);

  const objectives = uncoveredTerminalObjectives(lines);
  const { assignments, unresolved } = matchObjectivesToLines(lines, objectives);
  const proposals = [];
  const branchProposals = [];
  const invalid = [];
  for (const { objective, candidate } of assignments) {
    const proposal = proposeLineConversion(lines, candidate, objective.element, objective.rank);
    proposal.objective = objective;
    const validation = validateProposal(proposal);
    if (validation.ok) {
      proposal.validation = validation;
      proposals.push(proposal);
    } else {
      invalid.push({ proposal, validation });
    }
  }

  // Ramas nuevas para los objetivos sin solución (no hay línea existente
  // libre con la flecha requerida): árbol nuevo derivado de un árbol
  // existente con la misma flecha en C3/C4.
  let nextBranchId = Math.max(0, ...bowData.trees.filter(t => !t.dummy).map(t => Number(t.id))) + 1;
  for (const u of unresolved) {
    const spec = BRANCH_SPECS.find(sp =>
      sp.objective.rank === u.objective.rank && sp.objective.element === u.objective.element && sp.objective.shot === u.objective.shot);
    if (!spec) continue;
    const proposal = proposeNewBranch(lines, bowData, spec, nextBranchId);
    proposal.objective = u.objective;
    const validation = validateBranchProposal(proposal);
    if (validation.ok) {
      proposal.validation = validation;
      branchProposals.push(proposal);
    } else {
      invalid.push({ proposal, validation });
    }
    nextBranchId++;
  }

  mkdirSync(outDir, { recursive: true });

  // 1. JSON de propuestas
  writeFileSync(resolve(outDir, "bow-specialization-proposals.json"),
    JSON.stringify({
      metadata: {
        uncoveredCount: objectives.length,
        proposalsCount: proposals.length,
        branchProposalsCount: branchProposals.length,
        unresolvedCount: unresolved.length,
      invalidCount: invalid.length,
        rules: [
          "elemento natural al tope 30 (referencia inicial)",
          "RAW reducido al rango típico de elementales del rango",
          "progresión completa ajustada sin inversión",
          "cargas C1-C4 sin modificar; C4 ! alineada con C3",
          "líneas RAW de referencia (Power Coating 2) no convertidas si hay alternativa",
        ],
      },
      proposals,
      branchProposals,
      unresolved,
      invalid,
    }, null, 2));

  // 2. CSV de tabla antes/después por arma y nivel
  const csvRows = [];
  for (const p of proposals) {
    for (const lv of p.levelPlan) {
      csvRows.push([
        p.treeId, p.treeName, p.objective.rank, p.objective.element, p.objective.shot,
        lv.localLevel,
        lv.before.raw, lv.before.element ? lv.before.element.type + ":" + lv.before.element.value : "",
        lv.after.raw, lv.after.element.type + ":" + lv.after.element.value,
        p.rationale,
      ].map(csvEscape).join(","));
    }
  }
  for (const p of branchProposals) {
    for (const lv of p.levelPlan) {
      csvRows.push([
        p.treeId, p.treeName, p.objective.rank, p.objective.element, p.objective.shot,
        lv.localLevel,
        "", "",
        lv.after.raw, lv.after.element.type + ":" + lv.after.element.value,
        p.rationale,
      ].map(csvEscape).join(","));
    }
  }
  const header = [
    "tree_id", "tree_name", "objective_rank", "objective_element", "objective_shot",
    "local_level", "before_raw", "before_element", "after_raw", "after_element", "rationale",
  ].join(",");
  writeFileSync(resolve(outDir, "bow-specialization-proposals.csv"),
    [header, ...csvRows].join("\n"));

  // 3. Resumen por consola
  console.log(`Stage 15 — propuestas de rebalance del catálogo`);
  console.log(`Objetivos sin cobertura terminal: ${objectives.length}`);
  console.log(`Propuestas de conversión generadas: ${proposals.length}`);
  console.log(`Propuestas de rama nueva: ${branchProposals.length}`);
  console.log(`Sin solución (cargas protegidas): ${unresolved.length}`);
  console.log(`Propuestas inválidas (progresión): ${invalid.length}`);
  for (const inv of invalid) console.log(`  - ${inv.proposal.treeName}: ${inv.validation.errors.join("; ")}`);
  for (const u of unresolved) console.log(`  - ${u.objective.rank} ${u.objective.element} ${u.objective.shot}: ${u.reason}`);
  for (const p of proposals) {
    const t = p.terminalBefore;
    console.log(`  ${p.treeName} (${p.objective.rank} ${p.objective.element} ${p.objective.shot}): RAW ${t.raw}→${p.terminalAfter.raw}, elemento ${t.element ? t.element.type + ":" + t.element.value : "—"}→${p.terminalAfter.element.type}:${p.terminalAfter.element.value}`);
  }
  for (const p of branchProposals) {
    console.log(`  [rama nueva] ${p.treeName} (${p.objective.rank} ${p.objective.element} ${p.objective.shot}): RAW —→${p.terminalAfter.raw}, elemento —→${p.terminalAfter.element.type}:${p.terminalAfter.element.value} (árbol ${p.treeId}, padre ${p.tree.parent[0]})`);
  }
  const convertedTrees = new Set(proposals.map(p => p.treeId));
  console.log(`Líneas convertidas (una por elemento): ${convertedTrees.size}`);
  console.log(`Generados: ${outDir}/bow-specialization-proposals.{json,csv}`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
