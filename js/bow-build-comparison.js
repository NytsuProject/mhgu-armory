// Stage 11: fair comparison of RAW, Elemental and Hybrid bow builds.
//
// Pure helpers shared by the batch driver: offensive-skill priority order per
// profile and shot type, weapon-record construction for the damage matrix, and
// profile-comparison orchestration over optimizeBowBuild.
//
// Rules honoured here:
// - The elemental cap (30) and all damage/coating models stay untouched.
// - No new elemental multipliers, no game-param or ROM-offset changes.
// - Spread is never modified and is used as the control shot type.
// - Talisman policies separate legal, theoretical-max and conservative options.

import { optimizeBowBuild, resolveBowBuildRequirements } from "./bow-build-optimizer.js";
import { BOW_SHOT_SKILLS, BOW_ELEMENT_SKILLS } from "./bow-build-feasibility.js";

/**
 * Offensive-skill priority order for a profile + shot type + element.
 * The first N entries are activated when activeSkillBudget = N. Extra skills
 * beyond the requirement set are appended so profiles with fewer base
 * requirements can still reach the same budget.
 */
export function offensivePriority(profile, shotType, element) {
  if (!BOW_SHOT_SKILLS[shotType]) throw new Error("Tipo de flecha no válido: " + shotType);
  const shotSkill = BOW_SHOT_SKILLS[shotType];
  if (profile === "raw") {
    return [shotSkill, "Expert", "Tenderizer", "Critical Up", "Power C+", "Attack"];
  }
  if (profile === "elemental") {
    const elementSkill = BOW_ELEMENT_SKILLS[element];
    if (!elementSkill) throw new Error("Elemento no válido para perfil elemental: " + element);
    return [elementSkill, "Crit Element", "Tenderizer", shotSkill, "Elemental", "Critical Up"];
  }
  if (profile === "hybrid") {
    const elementSkill = BOW_ELEMENT_SKILLS[element];
    if (!elementSkill) throw new Error("Elemento no válido para perfil híbrido: " + element);
    return [elementSkill, "Crit Element", "Tenderizer", shotSkill, "Power C+", "Elemental", "Critical Up", "Expert"];
  }
  throw new Error("Perfil no válido: " + profile);
}

/**
 * Build the `buildOutput` object consumed by simulateBowBuildHitzoneMatrix.
 * `comparisons` holds one entry per profile+gender with the optimizer result.
 */
export function buildWeaponRecord({ treeId, treeName, level, weapon, rank, rarity, shotType, chargeSlot, element, weaponSlots, comparisons }) {
  return {
    weapon: {
      treeId, treeName, level, name: weapon.nEs || weapon.n,
      rank, rarity: Number(rarity || 0), raw: Number(weapon.raw || 0),
      affinity: Number(weapon.aff || 0),
      element: element ? { type: element[1], name: element[0], value: Number(element[2]) } : null,
      charge: { slot: chargeSlot, effectiveType: shotType },
      coatings: weapon.x?.coatings || [], weaponSlots,
    },
    comparisons,
  };
}

/**
 * Optimize all three profiles for one weapon + shot type + budget and gender.
 * Returns the buildOutput ready for simulateBowBuildHitzoneMatrix.
 */
export function runProfileComparison({
  armorData, decorations, talismanSkills, skillLevels, bowData,
  treeId, level, chargeSlot, shotType, coatingPolicy = "low-cost",
  rank = "G", genders = ["male", "female"],
  activeSkillBudget = 5, talismanPolicy = "max", allowNegatives = true,
  beamWidth = 300, topBuilds = 1, topTalismansPerArmor = 3,
  profiles = ["raw", "elemental", "hybrid"],
}) {
  const tree = bowData.trees.find(row => Number(row.id) === Number(treeId));
  if (!tree) throw new Error("Árbol de arcos no encontrado: " + treeId);
  const weapon = tree.levels.find(row => Number(row.lv) === Number(level));
  if (!weapon) throw new Error("Nivel del arco no encontrado: " + level);
  const charges = (weapon.x?.charges || []).map(value => {
    const m = /^(Rapid|Pierce|Spread|Heavy) Lv([1-5])(!)?$/.exec(value || "");
    if (!m) return null;
    return { type: m[1], level: Number(m[2]), requiresLoadUp: Boolean(m[3]) };
  }).filter(Boolean);
  const selected = charges[Number(chargeSlot) - 1];
  if (!selected) throw new Error("La carga seleccionada no existe: " + chargeSlot);
  const previous = Number(chargeSlot) > 1 ? charges[Number(chargeSlot) - 2] : null;
  const effectiveType = selected.requiresLoadUp && previous ? previous.type : selected.type;
  const element = (weapon.ele || []).find(row => BOW_ELEMENT_SKILLS[row?.[1]]);
  const rarity = Number(weapon.rar || 0);
  const rankResolved = rank || (rarity >= 8 ? "G" : rarity >= 4 ? "HR" : "LR");
  const weaponSlots = [...String(weapon.slots || "")].filter(ch => ch === "◯").length;

  const comparisons = [];
  for (const profile of profiles) {
    if (profile !== "raw" && !element) {
      // No elemental bow: record an explicit empty comparison so the matrix
      // reports the limitation instead of silently dropping the profile.
      comparisons.push({ profile, gender: null, builds: [], note: "El arco no tiene elemento; perfil no evaluable." });
      continue;
    }
    const resolved = resolveBowBuildRequirements({
      weapon, profile, shotType: effectiveType,
      element: element?.[1] || null, loadUp: selected.requiresLoadUp,
      coatingPolicy,
    });
    for (const gender of genders) {
      const result = optimizeBowBuild({
        armorData, decorations, talismanSkills, skillLevels,
        requirements: resolved.requirements, rank: rankResolved, gender,
        weaponSlots, weaponName: weapon.nEs || weapon.n,
        beamWidth, topBuilds, topTalismansPerArmor,
        activeSkillBudget, offensiveSkillPriority: offensivePriority(profile, effectiveType, element?.[1]),
        talismanPolicy, allowNegatives,
      });
      comparisons.push({
        profile, gender, coatingPolicy, coatingUnlocks: resolved.coatingUnlocks,
        budget: result.metadata.budget,
        ...result,
      });
    }
  }
  return buildWeaponRecord({
    treeId, treeName: tree.nameEs || tree.name, level: Number(level), weapon,
    rank: rankResolved, rarity, shotType: effectiveType, chargeSlot: Number(chargeSlot),
    element, weaponSlots, comparisons,
  });
}
