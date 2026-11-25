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
function getTalismanOptions(talismanSkills, targetSkills) {
  const lookup = new Map(talismanSkills.map(row => [row.en, row]));
  const keys = targetSkills.filter(skill => lookup.has(skill));
  const options = new Map();
  const add = (deco, skills) => {
    const key = deco + ":" + skills.map(row => row[0] + "=" + row[2]).join(",");
    if (!options.has(key)) options.set(key, { slot: "talisman", name: "Talismán optimizado", deco, sk: skills });
  };
  for (let deco = 1; deco <= 3; deco++) add(deco, []);
  for (const skill of keys) {
    const row = lookup.get(skill), points = maxPositive(row.points?.[0]);
    if (points) for (let deco = 0; deco <= 3; deco++) add(deco, [[skill, row.es || skill, points]]);
  }
  for (const first of keys) for (const second of keys) {
    if (first === second) continue;
    const a = lookup.get(first), b = lookup.get(second);
    const p1 = maxPositive(a.points?.[0]), p2 = maxPositive(b.points?.[1]);
    if (p1 && p2) for (let deco = 0; deco <= 3; deco++) {
      add(deco, [[first, a.es || first, p1], [second, b.es || second, p2]]);
    }
  }
  return [...options.values()];
}
function summarizeSkills(rows, requirements, skillLevels) {
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
  const coverage = target.reduce((sum, row) => sum + row.progress, 0);
  return {
    target, activatedSkills, targetSkillCount: target.length,
    coverage: target.length ? coverage / target.length : 0,
    negativeSkills,
    score: activatedSkills * 10 + coverage - negativeSkills.length * 2.5,
  };
}
function buildPieces(armor, talisman, weaponSlots, weaponName) {
  return [...armor, ...(talisman ? [talisman] : []), {
    slot: "weapon", name: weaponName || "Arco", deco: weaponSlots, sk: [],
  }];
}
function evaluate(armor, talisman, weaponSlots, weaponName, jewelsBySlot, requirements, skillLevels) {
  const skills = setSkills(buildPieces(armor, talisman, weaponSlots, weaponName), jewelsBySlot);
  return { skills, summary: summarizeSkills(skills, requirements, skillLevels) };
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
function allocateJewels({ armor, talisman, weaponSlots, weaponName, decorations, requirements, skillLevels }) {
  const containers = getContainers(armor, talisman, weaponSlots), jewelsBySlot = emptyJewels();
  let current = evaluate(armor, talisman, weaponSlots, weaponName, jewelsBySlot, requirements, skillLevels);
  let usedSockets = 0;
  const maxIterations = containers.reduce((sum, row) => sum + row.capacity, 0);
  for (let iteration = 0; iteration < maxIterations; iteration++) {
    let best = null;
    for (const jewel of decorations) for (const container of containers) {
      const cost = Number(jewel.cost);
      const used = jewelsBySlot[container.slot].reduce((sum, row) => sum + Number(row.cost), 0);
      if (container.capacity - used < cost) continue;
      jewelsBySlot[container.slot].push(jewel);
      const trial = evaluate(armor, talisman, weaponSlots, weaponName, jewelsBySlot, requirements, skillLevels);
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

function buildSignature(build) {
  const armor = build.armor.map(piece => piece.id).join("-");
  const charm = build.talisman ? build.talisman.deco + ":" + build.talisman.skills.map(row => row[0] + "=" + row[2]).join(",") : "none";
  const jewels = Object.entries(build.jewelsBySlot).map(([slot, rows]) => slot + ":" + rows.map(row => row.id).join(",")).join("|");
  return armor + "/" + charm + "/" + jewels;
}

export function optimizeBowBuild({
  armorData, decorations, talismanSkills, skillLevels, requirements,
  rank = "G", gender = "male", weaponSlots = 0, weaponName = "Arco",
  beamWidth = 700, topBuilds = 3, topTalismansPerArmor = 3,
} = {}) {
  if (!armorData?.pieces || !Array.isArray(decorations) || !Array.isArray(talismanSkills)
    || !skillLevels || !requirements || !Object.keys(requirements).length) {
    throw new Error("Faltan catálogos o requisitos de habilidades.");
  }
  if (!["LR", "HR", "G"].includes(rank)) throw new Error("Rango no válido.");
  const genderId = normalizeGender(gender);
  if (!Number.isInteger(weaponSlots) || weaponSlots < 0 || weaponSlots > 3) throw new Error("weaponSlots debe ser de 0 a 3.");
  const width = Math.max(50, Math.min(5000, Number(beamWidth) || 700));
  const armorSearch = makeArmorBeam(armorData, requirements, rank, genderId, width);
  const charms = getTalismanOptions(talismanSkills, Object.keys(requirements));
  const candidates = [];
  let talismanCandidatesTested = 0;
  for (const state of armorSearch.beam) {
    const scored = [];
    for (const charm of charms) {
      talismanCandidatesTested++;
      const talisman = charm.sk.length || charm.deco ? charm : null;
      const base = evaluate(state.armor, talisman, weaponSlots, weaponName, emptyJewels(), requirements, skillLevels);
      scored.push({
        armor: state.armor,
        talisman,
        score: base.summary.score + totalSockets(state.armor, talisman, weaponSlots) * 0.002,
      });
    }
    scored.sort((a, b) => b.score - a.score);
    candidates.push(...scored.slice(0, topTalismansPerArmor));
  }
  const jewels = jewelCandidatesFor(decorations, requirements);
  const results = [];
  for (const candidate of candidates) {
    const allocation = allocateJewels({
      armor: candidate.armor, talisman: candidate.talisman, weaponSlots, weaponName,
      decorations: jewels, requirements, skillLevels,
    });
    const target = allocation.summary.target;
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
      coverage: allocation.summary.coverage,
      complete: allocation.summary.activatedSkills === allocation.summary.targetSkillCount,
      jewelSocketsUsed: allocation.usedSockets,
      jewelSocketsFree: allocation.freeSockets,
      score: allocation.summary.score,
    };
    results.push(build);
  }
  results.sort((a, b) => Number(b.complete) - Number(a.complete)
    || b.activatedSkills - a.activatedSkills
    || b.coverage - a.coverage
    || a.negativeSkills.length - b.negativeSkills.length
    || b.jewelSocketsFree - a.jewelSocketsFree);
  const unique = [], seen = new Set();
  for (const build of results) {
    const key = buildSignature(build);
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(build);
    if (unique.length >= topBuilds) break;
  }
  return {
    metadata: {
      model: "MHGU bow real armor build optimizer v1",
      rank, gender: genderId === 0 ? "male" : "female", weaponSlots, beamWidth: width,
      retainedArmorStatesBySlot: armorSearch.statesPerSlot,
      compatibleArmorPiecesBySlot: armorSearch.compatiblePiecesBySlot,
      talismanCandidatesTested, candidateBuildsEvaluated: candidates.length,
      jewelCandidates: jewels.length,
      searchMethod: "bounded beam search + legal talisman options + iterative jewel placement",
      globalOptimumGuaranteed: false,
      notes: [
        "El casco admite piezas B, G o A; pecho, brazos, cintura y piernas requieren G o A para un arco.",
        "Cada joya se coloca en una ranura individual con capacidad suficiente.",
        "Las piezas unisex se permiten en búsquedas masculinas y femeninas; no se mezclan piezas de ambos géneros.",
        "El beam search es acotado: entrega builds legales encontradas, no una prueba matemática de óptimo global.",
      ],
    },
    requirements, builds: unique,
  };
}
