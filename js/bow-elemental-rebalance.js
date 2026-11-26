// Etapa 10: rebalance elemental acotado del arco.
//
// Implementa las dos decisiones de catálogo ya acordadas y el modelo de
// propuesta por línea terminal. Las funciones son puras: devuelven una copia
// del catálogo modificada y la lista de cambios; nada muta bow.json por
// sí mismo. El CLI en tools/bow-elemental-rebalance.mjs es el único que
// escribe datos.
//
// Decisión 1 — tope de elemento natural: el elemento mostrado del catálogo
// no supera 30. Se aplica a la base, antes de calcular habilidades; RAW,
// MV, cargas, coatings y elementos no naturales (Explosión/estados) no
// cambian.
//
// Decisión 2 — normalización C4 de Recargando: cuando la cuarta carga
// requiere Recargando (`!`), su tipo de flecha se alinea con la tercera
// carga. Se conserva el nivel de la carga y la marca `!`; solo se alinea
// el tipo. Las cargas C3 marcadas no se tocan con esta regla.
import { auditBowBranches, ELEMENTAL_TYPES, parseCharge } from "./bow-branch-audit.js";

export const ELEMENT_CAP = 30;

// Ventanas de diseño documentadas para la pasada de balance. La meta es que
// la build elemental ronde +10% frente a RAW en hitzones elementales
// favorables, quede en paridad o ligeramente por encima en hitzones medias y
// deje ventaja clara a RAW en hitzones pobres.
export const REBALANCE_WINDOWS = {
  favorableTarget: 1.10,
  favorableMin: 1.05,
  mediumMin: 0.98,
  mediumMax: 1.08,
  poorMax: 0.95,
};

export const MATCHUP_PROFILES = {
  favorable: { shotHz: 45, elementHz: 30 },
  medium: { shotHz: 45, elementHz: 15 },
  poor: { shotHz: 45, elementHz: 5 },
};

function cloneDatabase(database) {
  return JSON.parse(JSON.stringify(database));
}

function naturalElementRow(level) {
  return (level.ele || []).find(row =>
    row && ELEMENTAL_TYPES.has(row[1])
  ) || null;
}

/**
 * Aplica el tope al elemento natural mostrado. Devuelve una copia del
 * catálogo y los registros afectados (solo los que superan el tope).
 */
export function capNaturalElement(database, cap = ELEMENT_CAP) {
  if (!Number.isInteger(cap) || cap < 0) {
    throw new RangeError("El tope de elemento debe ser un entero no negativo.");
  }
  const next = cloneDatabase(database);
  const changes = [];
  for (const tree of next.trees || []) {
    for (const level of tree.levels || []) {
      const row = naturalElementRow(level);
      if (!row) continue;
      const value = Number(row[2]);
      if (!Number.isFinite(value) || value <= cap) continue;
      const previous = value;
      row[2] = cap;
      changes.push({
        treeId: tree.id,
        treeName: tree.nameEs || tree.name,
        localLevel: Number(level.lv),
        name: level.nEs || level.n,
        element: row[1],
        from: previous,
        to: cap,
      });
    }
  }
  return { database: next, changes };
}

/**
 * Alinea el tipo de la cuarta carga marcada `!` con el de la tercera.
 * Devuelve una copia del catálogo y los cargos reescritos.
 */
export function alignLoadUpC4Types(database) {
  const next = cloneDatabase(database);
  const changes = [];
  for (const tree of next.trees || []) {
    for (const level of tree.levels || []) {
      const charges = level.x?.charges;
      if (!Array.isArray(charges) || charges.length < 4) continue;
      const c3 = parseCharge(charges[2]);
      const c4 = parseCharge(charges[3]);
      if (!c3 || !c4 || !c4.requiresLoadUp) continue;
      if (c4.type === c3.type) continue;
      const rewritten = `${c3.type} Lv${c4.level}!`;
      const previous = charges[3];
      charges[3] = rewritten;
      changes.push({
        treeId: tree.id,
        treeName: tree.nameEs || tree.name,
        localLevel: Number(level.lv),
        name: level.nEs || level.n,
        slot: 4,
        from: previous,
        to: rewritten,
      });
    }
  }
  return { database: next, changes };
}

function levelLookup(database) {
  const map = new Map();
  for (const tree of database.trees || []) {
    for (const level of tree.levels || []) {
      map.set(tree.id + ":" + Number(level.lv), { tree, level });
    }
  }
  return map;
}

/**
 * Inventario de las 107 líneas terminales (55 elementales, 46 RAW, 6
 * Explosión) con la información que pide la hoja de salida: RAW actual,
 * elemento actual, coatings nativos, tipo/carga de la tercera carga,
 * ranuras y rango.
 */
export function terminalLineInventory(database) {
  const audit = auditBowBranches(database);
  const lookup = levelLookup(database);
  const lines = [];
  for (const branch of audit.branches) {
    const lastState = branch.pathStates[branch.pathStates.length - 1];
    const segments = branch.segments;
    const lastSegment = segments[segments.length - 1];
    const entry = lookup.get(lastSegment.treeId + ":" + lastSegment.throughLocalLevel);
    const level = entry?.level || {};
    const charges = level.x?.charges || [];
    const normalized = charges.map((charge, index) => {
      const parsed = parseCharge(charge);
      if (!parsed || !parsed.requiresLoadUp || index === 0) return charge;
      const previous = parseCharge(charges[index - 1]);
      return previous && previous.type !== parsed.type
        ? `${previous.type} Lv${parsed.level}!`
        : charge;
    });
    const c3 = parseCharge(normalized[2]);
    lines.push({
      treeId: branch.leafTreeId,
      rootTreeId: branch.rootTreeId,
      rootName: branch.rootName,
      branchName: branch.branchName,
      role: branch.role,
      localLevel: lastSegment.throughLocalLevel,
      rank: branch.finalRank,
      rarity: branch.finalRarity,
      raw: branch.finalRawDisplay,
      affinity: branch.finalAffinity,
      element: branch.finalElement
        ? { label: branch.finalElement.label, type: branch.finalElement.type, value: branch.finalElement.value }
        : null,
      coatings: [...(level.x?.coatings || [])],
      charges,
      normalizedCharges: normalized,
      c3Type: c3?.type || null,
      c3Level: c3?.level || null,
      c3RequiresLoadUp: Boolean(c3?.requiresLoadUp),
      slots: level.slots ?? null,
      progressionLevels: branch.progressionLevels,
    });
  }
  return {
    elemental: lines.filter(line => line.role === "elemental"),
    raw: lines.filter(line => line.role === "raw"),
    blast: lines.filter(line => line.role === "blast"),
  };
}

function ratioAt(evaluateRatio, line, elementValue, matchup) {
  const ratio = evaluateRatio(line, elementValue, matchup);
  if (!Number.isFinite(ratio)) {
    throw new Error("El evaluador de ratio no devolvió un número para " +
      line.branchName + " en el matchup " + matchup);
  }
  return ratio;
}

/**
 * Resuelve el valor elemental propuesto para una línea terminal a partir de
 * un evaluador de ratio `evaluateRatio(line, elementValue, matchup)`.
 *
 * La ratio es lineal en el valor de elemento, así que se resuelve por
 * interpolación entre el valor actual (post-tope) y un valor de prueba, y
 * luego se limita por las ventanas de diseño: nunca baja del valor actual,
 * nunca supera el tope 30, y no se pasa de la ventana de hitzones medias
 * ni pobres. Devuelve el valor redondeado y las ratios resultantes.
 */
export function solveElementValue(line, evaluateRatio, options = {}) {
  const cap = options.cap ?? ELEMENT_CAP;
  const windows = options.windows ?? REBALANCE_WINDOWS;
  if (!line.element) return null;
  const current = Math.min(line.element.value, cap);
  const probeValue = Math.min(cap, current + 10);
  const matchups = ["favorable", "medium", "poor"];
  const currentRatios = {};
  for (const matchup of matchups) {
    currentRatios[matchup] = ratioAt(evaluateRatio, line, current, matchup);
  }
  const inWindow = currentRatios.favorable >= windows.favorableMin;
  if (inWindow || probeValue === current) {
    return {
      current,
      proposed: current,
      changed: false,
      flag: inWindow ? "in-window" : "cap-bound",
      currentRatios,
      proposedRatios: { ...currentRatios },
    };
  }

  const probeRatios = {};
  for (const matchup of matchups) {
    probeRatios[matchup] = ratioAt(evaluateRatio, line, probeValue, matchup);
  }
  const interpolate = (fromValue, fromRatio, toValue, toRatio, targetRatio) => {
    if (toRatio === fromRatio) return fromValue;
    return fromValue + (targetRatio - fromRatio) * (toValue - fromValue) / (toRatio - fromRatio);
  };
  const bounds = {
    favorable: interpolate(current, currentRatios.favorable, probeValue, probeRatios.favorable, windows.favorableTarget),
    medium: interpolate(current, currentRatios.medium, probeValue, probeRatios.medium, windows.mediumMax),
    poor: interpolate(current, currentRatios.poor, probeValue, probeRatios.poor, windows.poorMax),
  };
  // The binding constraint is the smallest of the three solved values and
  // the hard cap; ties keep the earlier candidate (cap first).
  const candidates = [
    { key: "cap", value: cap },
    { key: "favorable", value: bounds.favorable },
    { key: "medium", value: bounds.medium },
    { key: "poor", value: bounds.poor },
  ];
  const binding = candidates.reduce(
    (best, candidate) => candidate.value < best.value - 1e-9 ? candidate : best,
    candidates[0]
  );
  const flag = binding.key === "cap" ? "cap"
    : binding.key === "favorable" ? "target"
    : binding.key + "-window";
  let proposed = Math.min(cap, bounds.favorable, bounds.medium, bounds.poor);
  proposed = Math.max(current, Math.round(proposed));
  proposed = Math.min(cap, Math.max(current, proposed));

  const proposedRatios = {};
  for (const matchup of matchups) {
    proposedRatios[matchup] = ratioAt(evaluateRatio, line, proposed, matchup);
  }
  return {
    current,
    proposed,
    changed: proposed !== current,
    flag,
    currentRatios,
    proposedRatios,
    bounds,
  };
}

/**
 * Propuesta completa para las líneas elementales: resuelve cada final y
 * agrega el contexto de los finales RAW del mismo rango.
 */
export function proposeElementalRebalance(database, evaluateRatio, options = {}) {
  const cap = options.cap ?? ELEMENT_CAP;
  const inventory = terminalLineInventory(database);
  const rawByRank = new Map();
  for (const line of inventory.raw) {
    if (!rawByRank.has(line.rank)) rawByRank.set(line.rank, []);
    rawByRank.get(line.rank).push(line);
  }
  const proposals = [];
  for (const line of inventory.elemental) {
    const solution = solveElementValue(line, evaluateRatio, { cap, windows: options.windows });
    const peers = rawByRank.get(line.rank) || [];
    const bestRawPeer = peers.reduce((best, peer) =>
      !best || peer.raw > best.raw ? peer : best, null);
    proposals.push({
      treeId: line.treeId,
      localLevel: line.localLevel,
      rootName: line.rootName,
      branchName: line.branchName,
      rank: line.rank,
      rarity: line.rarity,
      raw: line.raw,
      element: line.element,
      coatings: line.coatings,
      c3Type: line.c3Type,
      c3Level: line.c3Level,
      c3RequiresLoadUp: line.c3RequiresLoadUp,
      slots: line.slots,
      progressionLevels: line.progressionLevels,
      rawPeers: {
        count: peers.length,
        maxRaw: bestRawPeer?.raw ?? null,
        maxRawName: bestRawPeer?.branchName ?? null,
      },
      ...solution,
    });
  }
  return {
    metadata: {
      elementCap: cap,
      windows: options.windows ?? REBALANCE_WINDOWS,
      elementalFinals: proposals.length,
      rawFinals: inventory.raw.length,
      blastFinals: inventory.blast.length,
      changed: proposals.filter(proposal => proposal.changed).length,
    },
    proposals,
  };
}
