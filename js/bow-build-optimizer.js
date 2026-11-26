import { setSkills } from "./builder-model.js";
import { buildBowSkillRequirements } from "./bow-build-feasibility.js";

const SLOTS = ["head", "chest", "arms", "waist", "legs"];
const SHOTS = { Rapid: "Normal Up", Pierce: "Pierce Up", Spread: "Pellet Up", Heavy: "Heavy Up" };

const maxPositive = values => Math.max(0, ...(values || []).map(Number).filter(n => Number.isFinite(n) && n > 0));
const mapSkills = rows => {
  const out = {};
  for (const [skill, , points] of rows || []) out[skill] = (out[skill] || 0) + Number(points || 0);
  return out;
};
const emptyJewels = () => Object.fromEntries([...SLOTS, "talisman", "weapon"].map(slot => [slot, []]));

function nativeCoatings(weapon) {
  const list = weapon?.x?.coatings || [];
  return {
    powerI: list.includes("Power Coating"),
    powerII: list.includes("Power Coating 2"),
    elementI: list.includes("Element Coating"),
    elementII: list.includes("Element Coating 2"),
  };
}
function unlockLevel(policy, hasI, hasII) {
  if (policy === "native") return "none";
  if (policy === "low-cost" && (hasI || hasII)) return "none";
  if (policy === "max" && hasII) return "none";
  return policy === "low-cost" ? "I" : "II";
}

export function resolveBowBuildRequirements({
  weapon, profile, shotType, element = null, loadUp = false,
  ammoSaver = false, coatingPolicy = "low-cost",
} = {}) {
  if (!weapon?.x) throw new Error("Arco no válido.");
  if (!["raw", "elemental", "hybrid"].includes(profile)) throw new Error("Perfil no válido.");
  if (!SHOTS[shotType]) throw new Error("Tipo de flecha no válido: " + shotType);
  if (!["native", "low-cost", "max"].includes(coatingPolicy)) throw new Error("Política de coating no válida.");
  const native = nativeCoatings(weapon);
  const usesPower = profile === "raw" || profile === "hybrid";
  const usesElement = profile === "elemental" || profile === "hybrid";
  const powerCoatingLevel = usesPower ? unlockLevel(coatingPolicy, native.powerI, native.powerII) : "none";
  const elementCoatingLevel = usesElement ? unlockLevel(coatingPolicy, native.elementI, native.elementII) : "none";
  const requirements = buildBowSkillRequirements({
    profile: profile === "raw" ? "raw" : "elemental",
    shotType,
    element: usesElement ? element : null,
    powerCoatingLevel,
    elementCoatingLevel,
    loadUp,
    ammoSaver,
  });
  return {
    requirements, profile, coatingPolicy, native,
    coatingUnlocks: { power: powerCoatingLevel, element: elementCoatingLevel },
  };
}

function normalizeGender(gender) {
  if (gender === 0 || gender === "male" || gender === "M") return 0;
  if (gender === 1 || gender === "female" || gender === "F") return 1;
  throw new Error("Ejecuta una búsqueda por género: male o female.");
}
function compatiblePiece(piece, rank, slot, gender) {
  if (piece.rank !== rank || piece.slot !== slot) return false;
  if (piece.gender !== 2 && piece.gender !== gender) return false;
  // Bow users may use either helmet class; all other armor must be Gunner or All.
  if (slot !== "head" && piece.cls !== "G" && piece.cls !== "A") return false;
  return true;
}
function positiveValues(values) {
  return [...new Set((values || []).map(Number).filter(n => Number.isFinite(n) && n > 0))]
    .sort((a, b) => a - b);
}

/**
 * Talisman catalog policies.
 * - "max": theoretical-max performance — each skill carries its catalog maximum
 *   positive points, including two skills on one charm. This assumes the best
 *   points of both skills are simultaneously craftable; flagged as an
 *   unverified assumption, not measured in-game.
 * - "legal": catalog-possible — every positive point value present in the
 *   catalog is enumerated (single-skill and two-skill combinations). Two-skill
 *   charms are assumed craftable for any catalog pair; this is a catalog
 *   possibility, not per-pair in-game evidence.
 * - "conservative": single-skill charms only (no two-skill assumption), any
 *   positive catalog value, deco 0-3.
 * - "verified": evidence-backed subset — single-skill charms only, restricted
 *   to point values actually present in the catalog for that skill. No
 *   two-skill combination is declared legal without per-pair evidence.
 */
export function getTalismanOptions(talismanSkills, targetSkills, policy = "max") {
  if (!["max", "legal", "conservative", "verified"].includes(policy)) {
    throw new Error("Política de talismán no válida: " + policy);
  }
  const lookup = new Map(talismanSkills.map(row => [row.en, row]));
  const keys = targetSkills.filter(skill => lookup.has(skill));
  const options = new Map();
  const add = (deco, skills) => {
    const key = deco + ":" + skills.map(row => row[0] + "=" + row[2]).join(",");
    if (!options.has(key)) options.set(key, { slot: "talisman", name: "Talismán optimizado", deco, sk: skills });
  };
  for (let deco = 1; deco <= 3; deco++) add(deco, []);
  for (const skill of keys) {
    const row = lookup.get(skill);
    const values = policy === "max" ? [maxPositive(row.points?.[0])].filter(Boolean)
      : positiveValues(row.points?.[0]);
    for (const points of values) for (let deco = 0; deco <= 3; deco++) {
      add(deco, [[skill, row.es || skill, points]]);
    }
  }
  if (policy === "conservative" || policy === "verified") return [...options.values()];
  for (const first of keys) for (const second of keys) {
    if (first === second) continue;
    const a = lookup.get(first), b = lookup.get(second);
    const v1 = policy === "max" ? [maxPositive(a.points?.[0])].filter(Boolean)
      : positiveValues(a.points?.[0]);
    const v2 = policy === "max" ? [maxPositive(b.points?.[1])].filter(Boolean)
      : positiveValues(b.points?.[1]);
    for (const p1 of v1) for (const p2 of v2) for (let deco = 0; deco <= 3; deco++) {
      add(deco, [[first, a.es || first, p1], [second, b.es || second, p2]]);
    }
  }
  return [...options.values()];
}
function summarizeSkills(rows, requirements, skillLevels, weights = null) {
  const totals = new Map(rows.map(row => [row.en, Number(row.total || 0)]));
  const target = Object.entries(requirements).map(([skill, threshold]) => {
    const points = totals.get(skill) || 0;
    return { skill, points, threshold, active: points >= threshold, progress: Math.max(0, Math.min(1, points / threshold)) };
  });
  const negativeSkills = [];
  for (const [skill, levels] of Object.entries(skillLevels)) {
    const negatives = (levels || []).map(row => Number(row.points)).filter(n => n < 0);
    if (!negatives.length) continue;
    const threshold = Math.max(...negatives), points = totals.get(skill) || 0;
    if (points <= threshold) negativeSkills.push({ skill, points, threshold });
  }
  const activatedSkills = target.filter(row => row.active).length;
  const weightAt = i => weights && weights[target[i].skill] !== undefined ? weights[target[i].skill] : 1;
  const coverage = target.reduce((sum, row, i) => sum + weightAt(i) * row.progress, 0);
  const weightSum = target.reduce((sum, row, i) => sum + weightAt(i), 0) || 1;
  return {
    target, activatedSkills, targetSkillCount: target.length,
    coverage: target.length ? coverage / weightSum : 0,
    negativeSkills,
    score: activatedSkills * 10 + coverage - negativeSkills.length * 2.5,
  };
}
function buildPieces(armor, talisman, weaponSlots, weaponName) {
  return [...armor, ...(talisman ? [talisman] : []), {
    slot: "weapon", name: weaponName || "Arco", deco: weaponSlots, sk: [],
  }];
}
function evaluate(armor, talisman, weaponSlots, weaponName, jewelsBySlot, requirements, skillLevels, weights = null) {
  const skills = setSkills(buildPieces(armor, talisman, weaponSlots, weaponName), jewelsBySlot);
  return { skills, summary: summarizeSkills(skills, requirements, skillLevels, weights) };
}
function partialVector(state, requirements) {
  return Object.keys(requirements).map(skill =>
    (state.other[skill] || 0) + (state.chest[skill] || 0) * (1 + state.torsoUp));
}
function partialScore(state, requirements) {
  const keys = Object.keys(requirements), values = partialVector(state, requirements);
  return values.reduce((sum, points, i) => sum + Math.max(0, Math.min(1, points / requirements[keys[i]])), 0)
    + state.caps.reduce((sum, cap) => sum + cap, 0) * 0.018;
}
function stateKey(state, requirements) {
  const keys = Object.keys(requirements);
  const effective = partialVector(state, requirements).map((n, i) => Math.max(-20, Math.min(requirements[keys[i]] * 2, n)));
  return [
    effective.join(","),
    keys.map(skill => state.chest[skill] || 0).join(","),
    state.torsoUp,
    state.caps.join(","),
  ].join("|");
}
function makeArmorBeam(armorData, requirements, rank, gender, beamWidth) {
  const groups = Object.fromEntries(SLOTS.map(slot => {
    const rows = Object.entries(armorData.pieces).map(([id, piece]) => ({ ...piece, id: Number(id) }))
      .filter(piece => compatiblePiece(piece, rank, slot, gender));
    rows.sort((a, b) => {
      const score = piece => {
        const points = mapSkills(piece.sk);
        return Object.entries(requirements).reduce((sum, [skill, threshold]) =>
          sum + Math.max(0, Math.min(1, (points[skill] || 0) / threshold)), 0)
          + Number(piece.deco || 0) * 0.018;
      };
      return score(b) - score(a);
    });
    return [slot, rows];
  }));
  for (const slot of SLOTS) if (!groups[slot].length) throw new Error("No hay piezas compatibles para " + slot + ".");
  let beam = [{ armor: [], other: {}, chest: {}, torsoUp: 0, caps: [] }];
  const statesPerSlot = [];
  for (const slot of SLOTS) {
    const next = new Map();
    for (const state of beam) for (const piece of groups[slot]) {
      const points = mapSkills(piece.sk);
      const other = { ...state.other }, chest = { ...state.chest };
      const target = slot === "chest" ? chest : other;
      for (const skill of Object.keys(requirements)) if (points[skill]) target[skill] = (target[skill] || 0) + points[skill];
      const candidate = {
        armor: [...state.armor, piece], other, chest,
        torsoUp: state.torsoUp + Number((piece.sk || []).some(row => row[0] === "Torso Up")),
        caps: [...state.caps, Number(piece.deco || 0)],
      };
      const key = stateKey(candidate, requirements), old = next.get(key);
      if (!old || partialScore(candidate, requirements) > partialScore(old, requirements)) next.set(key, candidate);
    }
    beam = [...next.values()].sort((a, b) => partialScore(b, requirements) - partialScore(a, requirements)).slice(0, beamWidth);
    statesPerSlot.push({ slot, compatiblePieces: groups[slot].length, retainedStates: beam.length });
  }
  return { beam, statesPerSlot, compatiblePiecesBySlot: Object.fromEntries(SLOTS.map(slot => [slot, groups[slot].length])) };
}
function totalSockets(armor, talisman, weaponSlots) {
  return armor.reduce((sum, piece) => sum + Number(piece.deco || 0), 0)
    + Number(talisman?.deco || 0) + weaponSlots;
}
function getContainers(armor, talisman, weaponSlots) {
  return [
    ...armor.map(piece => ({ slot: piece.slot, capacity: Number(piece.deco || 0) })),
    ...(talisman ? [{ slot: "talisman", capacity: Number(talisman.deco || 0) }] : []),
    ...(weaponSlots ? [{ slot: "weapon", capacity: weaponSlots }] : []),
  ].filter(row => row.capacity > 0);
}
function jewelCandidatesFor(decorations, requirements) {
  const allowed = new Set([...Object.keys(requirements), "Secret Arts", "Talisman Boost"]);
  return decorations.filter(jewel => Number.isInteger(Number(jewel.cost)) && Number(jewel.cost) >= 1 && Number(jewel.cost) <= 3
    && (jewel.sk || []).some(([skill, , points]) => allowed.has(skill) && Number(points) > 0));
}
function allocateJewels({ armor, talisman, weaponSlots, weaponName, decorations, requirements, skillLevels, weights = null }) {
  const containers = getContainers(armor, talisman, weaponSlots), jewelsBySlot = emptyJewels();
  let current = evaluate(armor, talisman, weaponSlots, weaponName, jewelsBySlot, requirements, skillLevels, weights);
  let usedSockets = 0;
  const maxIterations = containers.reduce((sum, row) => sum + row.capacity, 0);
  for (let iteration = 0; iteration < maxIterations; iteration++) {
    let best = null;
    for (const jewel of decorations) for (const container of containers) {
      const cost = Number(jewel.cost);
      const used = jewelsBySlot[container.slot].reduce((sum, row) => sum + Number(row.cost), 0);
      if (container.capacity - used < cost) continue;
      jewelsBySlot[container.slot].push(jewel);
      const trial = evaluate(armor, talisman, weaponSlots, weaponName, jewelsBySlot, requirements, skillLevels, weights);
      jewelsBySlot[container.slot].pop();
      const delta = trial.summary.score - current.summary.score, efficiency = delta / cost;
      if (delta > 1e-7 && (!best || efficiency > best.efficiency + 1e-9 ||
        (Math.abs(efficiency - best.efficiency) <= 1e-9 && cost < best.cost))) {
        best = { jewel, container, cost, efficiency, trial };
      }
    }
    if (!best) break;
    jewelsBySlot[best.container.slot].push(best.jewel);
    usedSockets += best.cost;
    current = best.trial;
  }
  const freeSockets = containers.reduce((sum, row) => {
    const used = jewelsBySlot[row.slot].reduce((n, jewel) => n + Number(jewel.cost), 0);
    return sum + row.capacity - used;
  }, 0);
  return { jewelsBySlot, usedSockets, freeSockets, ...current };
}

export function buildSignature(build) {
  const armor = build.armor.map(piece => piece.id).join("-");
  const charm = build.talisman ? build.talisman.deco + ":" + build.talisman.skills.map(row => row[0] + "=" + row[2]).join(",") : "none";
  const jewels = Object.entries(build.jewelsBySlot).map(([slot, rows]) => slot + ":" + rows.map(row => row.id).join(",")).join("|");
  return armor + "/" + charm + "/" + jewels;
}

export function optimizeBowBuild({
  armorData, decorations, talismanSkills, skillLevels, requirements,
  rank = "G", gender = "male", weaponSlots = 0, weaponName = "Arco",
  beamWidth = 700, topBuilds = 3, topTalismansPerArmor = 3,
  activeSkillBudget = null, offensiveSkillPriority = null,
  talismanPolicy = "max", allowNegatives = true, extraSkillThreshold = 10,
} = {}) {
  if (!armorData?.pieces || !Array.isArray(decorations) || !Array.isArray(talismanSkills)
    || !skillLevels || !requirements || !Object.keys(requirements).length) {
    throw new Error("Faltan catálogos o requisitos de habilidades.");
  }
  if (!["LR", "HR", "G"].includes(rank)) throw new Error("Rango no válido.");
  const genderId = normalizeGender(gender);
  if (!Number.isInteger(weaponSlots) || weaponSlots < 0 || weaponSlots > 3) throw new Error("weaponSlots debe ser de 0 a 3.");
  if (!["max", "legal", "conservative", "verified"].includes(talismanPolicy)) {
    throw new Error("Política de talismán no válida: " + talismanPolicy);
  }
  const width = Math.max(50, Math.min(5000, Number(beamWidth) || 700));

  // Budget mode: activate the top-N OFFENSIVE skills of the documented priority
  // order. Non-offensive mandatory requirements (e.g. Loading for a `!` charge,
  // Ammo Saver, coating unlocks) are ALWAYS kept in the optimized set and must
  // be active for the build to be complete, but they are NOT counted toward the
  // offensive budget: the budget is the number of offensive skills activated.
  // If the offensive requirement set does not reach the budget, the remaining
  // offensive slots are filled with extra offensive skills from the priority
  // list (using extraSkillThreshold points) so every profile can be compared at
  // an equal offensive-skill budget.
  let budgetedRequirements = requirements;
  let budgetMeta = {
    budget: null, budgetedSkills: Object.keys(requirements),
    mandatorySkills: [], unbudgetedSkills: [], offensiveSkillCount: Object.keys(requirements).length,
  };
  if (activeSkillBudget !== null && activeSkillBudget !== undefined) {
    const budget = Number(activeSkillBudget);
    const extraThreshold = Number(extraSkillThreshold) || 10;
    if (!Number.isInteger(budget) || budget < 1) throw new Error("activeSkillBudget debe ser un entero positivo.");
    const priority = Array.isArray(offensiveSkillPriority) ? offensiveSkillPriority : Object.keys(requirements);
    const ordered = priority.filter(skill => requirements[skill] !== undefined);
    const extra = priority.filter(skill => requirements[skill] === undefined && !ordered.includes(skill));
    if (ordered.length + extra.length < budget) throw new Error("Presupuesto " + budget + " mayor que habilidades ofensivas disponibles (requisitos + prioridad): " + (ordered.length + extra.length));
    const offensiveKeys = [...ordered, ...extra].slice(0, budget);
    // Offensive skills define the set of skills considered for the budget.
    const offensiveSkillSet = new Set(priority);
    // Mandatory, NON-offensive requirements stay in the optimized set and must
    // be active for the build to be complete/legal (Loading for a `!` charge,
    // Ammo Saver, coating unlocks such as Elem C+). They are never counted as
    // offensive budget slots. Offensive skills outside the top-N budget are NOT
    // mandatory: they may be activated incidentally but are not required.
    const mandatoryKeys = Object.keys(requirements)
      .filter(skill => !offensiveKeys.includes(skill) && !offensiveSkillSet.has(skill));
    budgetedRequirements = Object.fromEntries([
      ...offensiveKeys.map(skill => [skill, requirements[skill] !== undefined ? requirements[skill] : extraThreshold]),
      ...mandatoryKeys.map(skill => [skill, requirements[skill]]),
    ]);
    budgetMeta = {
      budget,
      budgetedSkills: offensiveKeys,
      mandatorySkills: mandatoryKeys,
      unbudgetedSkills: Object.keys(requirements)
        .filter(skill => !offensiveKeys.includes(skill) && !mandatoryKeys.includes(skill)),
      priorityOrder: priority,
      extraSkills: offensiveKeys.filter(skill => requirements[skill] === undefined),
      extraSkillThreshold: extraThreshold,
      offensiveSkillCount: offensiveKeys.length,
    };
  }

  const armorSearch = makeArmorBeam(armorData, budgetedRequirements, rank, genderId, width);
  // Budget weights: higher-priority skills get higher coverage weight, so the
  // search activates the most important offensive skills first.
  const weights = budgetMeta.budget
    ? Object.fromEntries(budgetMeta.priorityOrder
        .filter(skill => budgetMeta.budgetedSkills.includes(skill))
        .map((skill, i) => [skill, budgetMeta.budget - i]))
    : null;
  const charms = getTalismanOptions(talismanSkills, Object.keys(budgetedRequirements), talismanPolicy);
  const candidates = [];
  let talismanCandidatesTested = 0;
  for (const state of armorSearch.beam) {
    const scored = [];
    for (const charm of charms) {
      talismanCandidatesTested++;
      const talisman = charm.sk.length || charm.deco ? charm : null;
      const base = evaluate(state.armor, talisman, weaponSlots, weaponName, emptyJewels(), budgetedRequirements, skillLevels, weights);
      scored.push({
        armor: state.armor,
        talisman,
        score: base.summary.score + totalSockets(state.armor, talisman, weaponSlots) * 0.002,
      });
    }
    scored.sort((a, b) => b.score - a.score);
    candidates.push(...scored.slice(0, topTalismansPerArmor));
  }
  const jewels = jewelCandidatesFor(decorations, budgetedRequirements);
  const results = [];
  for (const candidate of candidates) {
    const allocation = allocateJewels({
      armor: candidate.armor, talisman: candidate.talisman, weaponSlots, weaponName,
      decorations: jewels, requirements: budgetedRequirements, skillLevels, weights,
    });
    const target = allocation.summary.target;
    const budgetedPoints = budgetMeta.budgetedSkills.reduce((sum, skill) => {
      const row = target.find(entry => entry.skill === skill);
      return sum + (row?.points || 0);
    }, 0);
    const build = {
      armor: candidate.armor.map(piece => ({
        id: piece.id, slot: piece.slot, name: piece.nameEs || piece.name,
        cls: piece.cls, gender: piece.gender, defense: piece.def?.[1] ?? null,
        deco: Number(piece.deco || 0), skills: piece.sk,
      })),
      talisman: candidate.talisman ? {
        name: candidate.talisman.name, deco: candidate.talisman.deco, skills: candidate.talisman.sk,
      } : null,
      weapon: { name: weaponName, deco: weaponSlots },
      jewelsBySlot: Object.fromEntries(Object.entries(allocation.jewelsBySlot).map(([slot, rows]) => [
        slot, rows.map(row => ({ id: row.id, name: row.name, cost: row.cost, skills: row.sk })),
      ])),
      skillPoints: target,
      activeSkills: target.filter(row => row.active).map(row => row.skill),
      missingSkills: target.filter(row => !row.active).map(row => ({ skill: row.skill, points: row.points, needed: row.threshold - row.points })),
      negativeSkills: allocation.summary.negativeSkills,
      activatedSkills: allocation.summary.activatedSkills,
      targetSkillCount: allocation.summary.targetSkillCount,
      // Offensive-budget accounting: mandatory non-offensive skills are optimized
      // and required for completeness, but never counted as offensive budget.
      offensiveSkills: budgetMeta.budgetedSkills,
      mandatorySkills: budgetMeta.mandatorySkills,
      offensiveSkillCount: budgetMeta.budget ? budgetMeta.budgetedSkills.length : target.length,
      activatedOffensiveSkills: budgetMeta.budget
        ? budgetMeta.budgetedSkills.filter(skill => target.find(row => row.skill === skill)?.active).length
        : allocation.summary.activatedSkills,
      coverage: allocation.summary.coverage,
      complete: allocation.summary.activatedSkills === allocation.summary.targetSkillCount,
      jewelSocketsUsed: allocation.usedSockets,
      jewelSocketsFree: allocation.freeSockets,
      score: allocation.summary.score,
      thresholds: Object.fromEntries(Object.entries(budgetedRequirements)),
      investedPoints: budgetedPoints,
      slotsUsed: allocation.usedSockets,
      cost: allocation.usedSockets,
      budget: budgetMeta,
    };
    results.push(build);
  }
  results.sort((a, b) => Number(b.complete) - Number(a.complete)
    || b.activatedSkills - a.activatedSkills
    || b.coverage - a.coverage
    || a.negativeSkills.length - b.negativeSkills.length
    || b.jewelSocketsFree - a.jewelSocketsFree);
  let pool = results;
  let negativeFallback = null;
  if (!allowNegatives) {
    const clean = results.filter(build => build.negativeSkills.length === 0);
    if (clean.length) pool = clean;
    else {
      negativeFallback = results[0];
      negativeFallback.negativeSkillsJustified = true;
      pool = [negativeFallback];
    }
  }
  const unique = [], seen = new Set();
  for (const build of pool) {
    const key = buildSignature(build);
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(build);
    if (unique.length >= topBuilds) break;
  }
  return {
    metadata: {
      model: "MHGU bow real armor build optimizer v2",
      rank, gender: genderId === 0 ? "male" : "female", weaponSlots, beamWidth: width,
      talismanPolicy, allowNegatives,
      retainedArmorStatesBySlot: armorSearch.statesPerSlot,
      compatibleArmorPiecesBySlot: armorSearch.compatiblePiecesBySlot,
      talismanCandidatesTested, candidateBuildsEvaluated: candidates.length,
      jewelCandidates: jewels.length,
      budget: budgetMeta,
      searchMethod: "bounded beam search + legal talisman options + iterative jewel placement",
      globalOptimumGuaranteed: false,
      notes: [
        "El casco admite piezas B, G o A; pecho, brazos, cintura y piernas requieren G o A para un arco.",
        "Cada joya se coloca en una ranura individual con capacidad suficiente.",
        "Las piezas unisex se permiten en búsquedas masculinas y femeninas; no se mezclan piezas de ambos géneros.",
        "El beam search es acotado: entrega builds legales encontradas, no una prueba matemática de óptimo global.",
        talismanPolicy === "max"
          ? "Política de talismán max: puntos máximos de ambas habilidades a la vez; suposición no verificada en juego."
          : talismanPolicy === "legal"
            ? "Política de talismán legal: todos los valores positivos presentes en el catálogo, talismánes de una y dos habilidades (posibilidad de catálogo, no evidencia por pares en juego)."
            : talismanPolicy === "verified"
              ? "Política de talismán verificada: solo talismánes de una habilidad con valores presentes en el catálogo; sin combinaciones de dos habilidades sin evidencia."
              : "Política de talismán conservadora: solo talismánes de una habilidad.",
      ],
    },
    requirements: budgetedRequirements, builds: unique,
  };
}
