import { setSkills } from "./builder-model.js";
import {
  BOW_DISPLAY_RAW_MULTIPLIER, CHARGE_RAW, CHARGE_ELEMENT, ELEMENTS,
  SHOT_MVS, SHOT_TYPE_UP, makeWeaponCandidates,
} from "./bow-balance-sim.js";

const ELEMENT_SKILLS = {
  Fire: "Fire Atk", Water: "Water Atk", Thunder: "Thunder Atk",
  Ice: "Ice Atk", Dragon: "Dragon Atk",
};
const SHOT_SKILLS = {
  Rapid: "Normal Up", Pierce: "Pierce Up", Spread: "Pellet Up", Heavy: "Heavy Up",
};
const num = value => Number.isFinite(Number(value)) ? Number(value) : 0;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const sum = values => values.reduce((total, value) => total + value, 0);

export function skillPointsFromOptimizerBuild(build) {
  if (!build || !Array.isArray(build.armor)) throw new Error("Build de armadura no válido.");
  const pieces = build.armor.map(piece => ({ slot: piece.slot, sk: piece.skills || [] }));
  if (build.talisman) pieces.push({ slot: "talisman", sk: build.talisman.skills || [] });
  pieces.push({ slot: "weapon", sk: [] });
  const jewelsBySlot = Object.fromEntries(Object.entries(build.jewelsBySlot || {}).map(([slot, jewels]) => [
    slot, jewels.map(jewel => ({ cost: Number(jewel.cost), sk: jewel.skills || [] })),
  ]));
  return Object.fromEntries(setSkills(pieces, jewelsBySlot).map(row => [row.en, Number(row.total || 0)]));
}

/**
 * MHGU combines the percentage bonuses up to +20%; the elemental-specific
 * skill keeps its flat +4 / +6. Elemental +10 contributes +10% to the cap.
 */
export function elementalDisplayValue(displayElement, element, skillPoints = {}, elementCap = null) {
  const base = Math.max(0, num(displayElement));
  const capped = elementCap === null || elementCap === undefined
    ? base : Math.min(base, Math.max(0, num(elementCap)));
  const specificPoints = num(skillPoints[ELEMENT_SKILLS[element]]);
  const specificPercent = specificPoints >= 15 ? 0.10 : specificPoints >= 10 ? 0.05 : 0;
  const specificFlat = specificPoints >= 15 ? 6 : specificPoints >= 10 ? 4 : 0;
  const generalPercent = num(skillPoints.Elemental) >= 10 ? 0.10 : 0;
  const combinedMultiplier = Math.min(1.20, 1 + specificPercent + generalPercent);
  return Math.floor(capped * combinedMultiplier + specificFlat + 1e-8);
}

function attackBonus(points) {
  if (points >= 20) return 20;
  if (points >= 15) return 15;
  if (points >= 10) return 10;
  if (points <= -20) return -20;
  if (points <= -15) return -15;
  if (points <= -10) return -10;
  return 0;
}
function expertBonus(points) {
  if (points >= 20) return 30;
  if (points >= 15) return 20;
  if (points >= 10) return 10;
  if (points <= -20) return -15;
  if (points <= -15) return -10;
  if (points <= -10) return -5;
  return 0;
}
function physicalCriticalMultiplier(affinity, criticalBoost) {
  const rate = affinity / 100;
  if (rate < 0) return 1 + rate * 0.25;
  return 1 + rate * ((criticalBoost ? 1.40 : 1.25) - 1);
}
function elementalCriticalMultiplier(affinity, criticalElement) {
  return !criticalElement || affinity <= 0 ? 1 : 1 + affinity / 100 * 0.35;
}
function coatingTier(weapon, skillPoints, type) {
  const coatings = weapon.coatings || [];
  const nativeI = type === "Power" ? coatings.includes("Power Coating") : coatings.includes("Element Coating");
  const nativeII = type === "Power" ? coatings.includes("Power Coating 2") : coatings.includes("Element Coating 2");
  if (nativeII) return 2;
  if (nativeI) return 1;
  const points = num(skillPoints[type === "Power" ? "Power C+" : "Elem C+"]);
  return points >= 15 ? 2 : points >= 10 ? 1 : 0;
}
function coatingMultiplier(tier) {
  return tier === 2 ? 1.50 : tier === 1 ? 1.35 : 1;
}

export function calculateBowBuildVolley(weapon, part, skillPoints = {}, options = {}) {
  if (!weapon || !part) throw new Error("Arco y parte del monstruo son obligatorios.");
  const slotIndex = Number(weapon.chargeSlot) - 1;
  if (!Number.isInteger(slotIndex) || slotIndex < 0 || slotIndex > 3) throw new RangeError("La carga debe estar entre 1 y 4.");
  const type = weapon.chargeType;
  const level = Number(weapon.chargeLevel);
  const motionValues = weapon.rawMotionValues?.length ? weapon.rawMotionValues : SHOT_MVS[type]?.[level];
  if (!motionValues?.length) throw new Error("No hay valores de movimiento para la carga seleccionada.");

  const shotHz = num(part[4]);
  const elementEntry = weapon.elements?.[0] || null;
  const elementType = elementEntry?.type || null;
  const elementIndex = elementType ? ELEMENTS[elementType] : undefined;
  const elementHz = elementIndex === undefined ? 0 : num(part[5 + elementIndex]);
  const catalogElementValue = num(elementEntry?.display);
  const effectiveElementValue = elementEntry
    ? elementalDisplayValue(catalogElementValue, elementType, skillPoints, options.elementCap) : 0;

  const affinity = clamp(
    num(weapon.affinity) + expertBonus(num(skillPoints.Expert))
      + (num(skillPoints.Tenderizer) >= 10 && shotHz >= 45 ? 50 : 0),
    -100, 100,
  );
  const attack = attackBonus(num(skillPoints.Attack));
  const trueRaw = num(weapon.rawDisplay) / BOW_DISPLAY_RAW_MULTIPLIER + attack;
  const shotSkill = SHOT_SKILLS[type];
  const shotUp = num(skillPoints[shotSkill]) >= 10 ? SHOT_TYPE_UP[type] : 1;
  const motionValueTotal = sum(motionValues);
  const rawShotMultiplier = Number.isFinite(options.rawShotMultiplier) ? options.rawShotMultiplier : 1;
  const rawDamage = trueRaw * CHARGE_RAW[slotIndex] * 1.5 * (motionValueTotal / 100)
    * (shotHz / 100) * shotUp
    * physicalCriticalMultiplier(affinity, num(skillPoints["Critical Up"]) >= 10)
    * rawShotMultiplier;
  const elementalDamage = elementEntry
    ? (effectiveElementValue / 10) * CHARGE_ELEMENT[slotIndex] * motionValues.length
      * (elementHz / 100)
      * elementalCriticalMultiplier(affinity, num(skillPoints["Crit Element"]) >= 10)
    : 0;

  return {
    weapon: weapon.name, chargeSlot: weapon.chargeSlot, chargeType: type, chargeLevel: level,
    hitCount: motionValues.length, motionValueTotal, shotHz,
    element: elementType, catalogElementValue, effectiveElementValue, elementHz,
    affinity, attackBonus: attack, shotUp,
    rawDamage, elementalDamage, totalDamage: rawDamage + elementalDamage,
  };
}

function sequenceForBow(candidates, mainCandidate, skillPoints, style) {
  if (!["none", "guild", "valor"].includes(style)) throw new Error("style debe ser none, guild o valor.");
  if (mainCandidate.requiresLoadUp && num(skillPoints.Loading) < 10) {
    throw new Error("La carga seleccionada requiere Recargando +10.");
  }
  if (style === "none") return [{ candidate: mainCandidate, role: "primary", rawShotMultiplier: 1 }];
  const next = candidates.find(row => row.treeId === mainCandidate.treeId
    && row.level === mainCandidate.level && row.chargeSlot === mainCandidate.chargeSlot + 1);
  const follow = next && (!next.requiresLoadUp || num(skillPoints.Loading) >= 10) ? next : mainCandidate;
  const sequence = [
    { candidate: mainCandidate, role: "primary", rawShotMultiplier: 1 },
    { candidate: follow, role: "powerShot", rawShotMultiplier: 1 },
  ];
  if (style === "valor") sequence.push({ candidate: follow, role: "valorPowerShot", rawShotMultiplier: 1.30 });
  return sequence;
}

export function calculateBowBuildMissionDamage({
  weapon, build, profile, part, volleyCandidates = null,
  style = "guild", missionShots = 200, coatingSwitchShots = 0, elementCap = null,
} = {}) {
  if (!["raw", "elemental", "hybrid"].includes(profile)) throw new Error("Perfil RAW, elemental o hybrid obligatorio.");
  if (!Number.isFinite(missionShots) || missionShots <= 0) throw new RangeError("missionShots debe ser positivo.");
  if (!Number.isFinite(coatingSwitchShots) || coatingSwitchShots < 0) throw new RangeError("coatingSwitchShots debe ser cero o mayor.");

  const skillPoints = skillPointsFromOptimizerBuild(build);
  const sequence = volleyCandidates || [{ candidate: weapon, role: "primary", rawShotMultiplier: 1 }];
  if (!Array.isArray(sequence) || !sequence.length) throw new Error("La secuencia de disparos está vacía.");
  const volleys = sequence.map(entry => calculateBowBuildVolley(
    entry.candidate || entry, part, skillPoints,
    { elementCap, rawShotMultiplier: entry.rawShotMultiplier || 1 },
  ));
  const average = key => sum(volleys.map(row => row[key])) / volleys.length;
  const rawBase = average("rawDamage"), elementBase = average("elementalDamage");
  const totalVolleyOpportunities = missionShots * volleys.length;
  const usesPower = profile === "raw" || profile === "hybrid";
  const usesElement = profile === "elemental" || profile === "hybrid";
  const powerTier = usesPower ? coatingTier(weapon, skillPoints, "Power") : 0;
  const elementTier = usesElement ? coatingTier(weapon, skillPoints, "Element") : 0;
  const powerMultiplier = coatingMultiplier(powerTier), elementMultiplier = coatingMultiplier(elementTier);
  const powerCapacity = powerTier ? 70 : 0; // 50 + 20 combinables.
  const elementCapacity = elementTier ? 30 : 0; // 20 + 10 combinables.
  let elementShots = 0, powerShots = 0, switchShots = 0;

  if (profile === "raw") powerShots = Math.min(powerCapacity, totalVolleyOpportunities);
  else if (profile === "elemental") elementShots = Math.min(elementCapacity, totalVolleyOpportunities);
  else {
    elementShots = Math.min(elementCapacity, totalVolleyOpportunities);
    const remaining = Math.max(0, totalVolleyOpportunities - elementShots);
    switchShots = elementShots > 0 && powerTier > 0 && remaining > 0
      ? Math.min(coatingSwitchShots, remaining) : 0;
    powerShots = Math.min(powerCapacity, Math.max(0, remaining - switchShots));
  }

  const switchShare = switchShots / totalVolleyOpportunities;
  const elementShare = elementShots / totalVolleyOpportunities;
  const powerShare = powerShots / totalVolleyOpportunities;
  const finalRawPerVolley = rawBase * (1 - switchShare) + rawBase * (powerMultiplier - 1) * powerShare;
  const finalElementPerVolley = elementBase * (1 - switchShare) + elementBase * (elementMultiplier - 1) * elementShare;
  const volleyCount = volleys.length;
  return {
    profile, style, skillPoints,
    skillStatus: {
      attackBonus: attackBonus(num(skillPoints.Attack)),
      expertAffinity: expertBonus(num(skillPoints.Expert)),
      weaknessExploit: num(skillPoints.Tenderizer) >= 10,
      criticalBoost: num(skillPoints["Critical Up"]) >= 10,
      criticalElement: num(skillPoints["Crit Element"]) >= 10,
      loading: num(skillPoints.Loading) >= 10,
    },
    volleys, expectedVolleysPerSequence: volleyCount, missionShots,
    rawDamagePerVolley: finalRawPerVolley,
    elementalDamagePerVolley: finalElementPerVolley,
    totalDamagePerVolley: finalRawPerVolley + finalElementPerVolley,
    rawDamagePerSequence: finalRawPerVolley * volleyCount,
    elementalDamagePerSequence: finalElementPerVolley * volleyCount,
    totalDamagePerSequence: (finalRawPerVolley + finalElementPerVolley) * volleyCount,
    coatings: {
      powerTier, powerMultiplier, powerExpectedShots: powerShots,
      elementTier, elementMultiplier, elementExpectedShots: elementShots,
      switchShots, totalVolleyOpportunities, powerCapacity, elementCapacity,
    },
    assumptions: [
      "Los impactos teóricos de cada descarga se asignan a la misma parte del monstruo.",
      "La combinación permite una pila de 70 Power Coat o 30 Element Coat; no se asume reabastecimiento.",
      "Ammo Saver no se cuenta porque su probabilidad exacta de devolución no está verificada.",
      "El coste de transición híbrida se expresa en oportunidades de disparo perdidas, no en frames medidos.",
      "No se aplica bonificación especial de Close Range de Seregios en esta etapa.",
    ],
  };
}

function ratio(a, b) { return b > 0 ? a / b : null; }
function averageOrNull(values) { return values.length ? sum(values) / values.length : null; }

export function simulateBowBuildHitzoneMatrix({
  bowData, buildOutput, hitzoneData, style = "guild",
  missionShots = 200, coatingSwitchShots = 0, elementCap = null,
} = {}) {
  if (!Array.isArray(buildOutput?.comparisons) || !buildOutput.weapon) {
    throw new Error("El archivo de builds no contiene comparaciones ni arma.");
  }
  if (!Array.isArray(hitzoneData?.monsters)) throw new Error("Matriz de hitzones inválida.");
  const treeId = Number(buildOutput.weapon.treeId), level = Number(buildOutput.weapon.level);
  const chargeSlot = Number(buildOutput.weapon.charge?.slot);
  const candidates = makeWeaponCandidates(bowData, { loadUpPolicy: "match-c3" })
    .filter(row => row.treeId === treeId && row.level === level);
  const main = candidates.find(row => row.chargeSlot === chargeSlot);
  if (!main) throw new Error("No se encontró la carga elegida en el catálogo del arco.");

  const comparisons = buildOutput.comparisons.map(comparison => {
    const build = comparison.builds?.[0];
    if (!build) return null;
    const skillPoints = skillPointsFromOptimizerBuild(build);
    return {
      id: comparison.profile + "/" + comparison.gender,
      profile: comparison.profile, gender: comparison.gender,
      build, skillPoints,
      sequence: sequenceForBow(candidates, main, skillPoints, style),
    };
  }).filter(Boolean);

  const monsters = hitzoneData.monsters.filter(monster => monster.large && monster.tables?.[0]?.length);
  const rows = [];
  for (const monster of monsters) for (const part of monster.tables[0]) {
    const byBuild = {};
    for (const comparison of comparisons) {
      const result = calculateBowBuildMissionDamage({
        weapon: main, build: comparison.build, profile: comparison.profile, part,
        volleyCandidates: comparison.sequence, style, missionShots, coatingSwitchShots, elementCap,
      });
      byBuild[comparison.id] = {
        totalDamage: result.totalDamagePerSequence,
        rawDamage: result.rawDamagePerSequence,
        elementalDamage: result.elementalDamagePerSequence,
        complete: comparison.build.complete,
        activatedSkills: comparison.build.activatedSkills,
        targetSkillCount: comparison.build.targetSkillCount,
        coatings: result.coatings,
      };
    }
    rows.push({
      monster: monster.name, part: part[1] || ("Parte " + part[0]), shotHz: num(part[4]),
      elementHz: main.elements?.[0] ? num(part[5 + ELEMENTS[main.elements[0].type]]) : 0,
      byBuild,
    });
  }

  const groups = [];
  const genders = [...new Set(comparisons.map(row => row.gender))];
  for (const gender of genders) for (const [targetProfile, referenceProfile] of [
    ["elemental", "raw"], ["hybrid", "raw"], ["hybrid", "elemental"],
  ]) {
    const targetId = targetProfile + "/" + gender, referenceId = referenceProfile + "/" + gender;
    if (!comparisons.some(row => row.id === targetId) || !comparisons.some(row => row.id === referenceId)) continue;
    const ratios = [], bestByMonster = new Map();
    for (const row of rows) {
      const value = ratio(row.byBuild[targetId]?.totalDamage, row.byBuild[referenceId]?.totalDamage);
      if (value === null) continue;
      ratios.push(value);
      const old = bestByMonster.get(row.monster);
      if (!old || value > old.ratio) bestByMonster.set(row.monster, { ratio: value, part: row.part });
    }
    const bestRatios = [...bestByMonster.values()].map(row => row.ratio);
    groups.push({
      target: targetId, reference: referenceId,
      meanRatioAllParts: averageOrNull(ratios), partsCompared: ratios.length,
      partWins: ratios.filter(value => value > 1).length,
      monstersCompared: bestByMonster.size,
      monstersWithAtLeastOneWinningPart: bestRatios.filter(value => value > 1).length,
      meanBestPartRatioPerMonster: averageOrNull(bestRatios),
      bestPartByMonster: Object.fromEntries(bestByMonster.entries()),
    });
  }

  return {
    metadata: {
      model: "MHGU actual bow build damage comparison v1",
      weapon: buildOutput.weapon, style, missionShots, coatingSwitchShots, elementCap,
      monsterCount: monsters.length, partRows: rows.length, firstHitzoneTableOnly: true,
      sameWeaponAndChargeForEveryBuild: true,
      armorBuildsCompared: comparisons.map(row => ({
        id: row.id, complete: row.build.complete,
        activatedSkills: row.build.activatedSkills, targetSkillCount: row.build.targetSkillCount,
      })),
      globalOptimumGuaranteed: false,
    },
    buildSkillPoints: Object.fromEntries(comparisons.map(row => [row.id, row.skillPoints])),
    summary: groups, rows,
  };
}
