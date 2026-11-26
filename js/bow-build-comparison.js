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
import { skillPointsFromOptimizerBuild } from "./bow-build-damage.js";

/**
 * Offensive-skill taxonomy.
 *
 * A skill counts toward the "offensive skill budget" when it directly multiplies
 * or enables the damage a bow deal in a mission. The budget is the number of
 * such skills activated, and it is defined identically for RAW, Elemental and
 * Hybrid so the three profiles are compared at equal offensive firepower.
 *
 * Coating multiplier skills (Power C+, Elemental) DO count: they multiply the
 * raw / elemental damage of every shot, exactly like Attack or elementAtk. The
 * earlier report text that excluded Power C+ from the offensive budget was
 * wrong and is corrected here.
 *
 * Non-offensive (utility / defensive) skills are excluded from the budget:
 * Loading (charge speed), Ammo Saver (ammo economy), and resistances. They may
 * still be required to use a `!` charge, but they are never counted as offensive.
 */
export const OFFENSIVE_SKILL_REASONS = Object.freeze({
  Attack: "Multiplica el RAW de display del arco (daño físico base).",
  Expert: "Afinidad + y, con Crit Up, multiplica el daño crítico.",
  Tenderizer: "Multiplica el daño contra partes débiles (hitzone debilidad).",
  "Critical Up": "Aumenta la probabilidad de golpe crítico (daño medio).",
  "Crit Element": "Aumenta la probabilidad de golpe crítico elemental.",
  "Power C+": "Multiplicador de revestimiento Potencia: multiplica el daño físico de cada disparo.",
  Elemental: "Multiplicador de revestimiento Elemental: multiplica el daño elemental de cada disparo.",
  "Pellet Up": "Multiplicador de Abanico: multiplica el daño de cada perdigón.",
  "Normal Up": "Multiplicador de Rapid: multiplica el daño de Rapid.",
  "Pierce Up": "Multiplicador de Pierce: multiplica el daño de Pierce.",
  "Heavy Up": "Multiplicador de Heavy: multiplica el daño de Heavy.",
  "Fire Atk": "Multiplicador de elemento Fuego: multiplica el daño elemental.",
  "Water Atk": "Multiplicador de elemento Agua: multiplica el daño elemental.",
  "Thunder Atk": "Multiplicador de elemento Rayo: multiplica el daño elemental.",
  "Ice Atk": "Multiplicador de elemento Hielo: multiplica el daño elemental.",
  "Dragon Atk": "Multiplicador de elemento Dragon: multiplica el daño elemental.",
});

const SHOT_SKILL_BY_TYPE = Object.freeze({
  Rapid: "Normal Up", Pierce: "Pierce Up", Spread: "Pellet Up", Heavy: "Heavy Up",
});

/** True when a skill directly multiplies or enables bow damage (see taxonomy). */
export function isOffensive(skill) {
  return Object.prototype.hasOwnProperty.call(OFFENSIVE_SKILL_REASONS, skill);
}

/**
 * Activation threshold for a skill: the lowest positive point value in the
 * skill-level catalog. Skills absent from the catalog default to 10 points.
 */
export function skillActivationThreshold(skill, skillLevels = {}) {
  const levels = skillLevels?.[skill];
  if (!Array.isArray(levels) || !levels.length) return 10;
  const positive = levels.map(row => Number(row?.points)).filter(n => Number.isFinite(n) && n > 0);
  return positive.length ? Math.min(...positive) : 10;
}

/**
 * Every offensive skill ACTUALLY activated by a build, reading the real skill
 * points from the five armor pieces + talisman + decorations (not just the
 * budgeted requirement set). This also detects offensive skills activated
 * incidentally, beyond those explicitly budgeted.
 *
 * Returns [{ skill, points, threshold }], sorted by the documented priority
 * order when `priority` is given.
 */
export function offensiveSkillsActivated(build, skillLevels = {}, priority = null) {
  if (!build) return [];
  const points = skillPointsFromOptimizerBuild(build);
  // Review EVERY offensive skill in OFFENSIVE_SKILL_REASONS, not just those in
  // the priority list. The priority list only ORDERS the result; it must not
  // exclude offensive skills that are activated incidentally by the build but
  // were not part of the budgeted top-N set.
  const prioritySet = new Set(Array.isArray(priority) ? priority : []);
  const rankFor = skill => {
    const idx = Array.isArray(priority) ? priority.indexOf(skill) : -1;
    return idx >= 0 ? idx : Object.keys(OFFENSIVE_SKILL_REASONS).indexOf(skill);
  };
  const activated = [];
  for (const skill of Object.keys(OFFENSIVE_SKILL_REASONS)) {
    if (!isOffensive(skill)) continue;
    const value = Number(points[skill] || 0);
    const threshold = skillActivationThreshold(skill, skillLevels);
    if (value >= threshold) activated.push({ skill, points: value, threshold, inPriority: prioritySet.has(skill) });
  }
  activated.sort((a, b) => rankFor(a.skill) - rankFor(b.skill));
  return activated;
}

/**
 * Perfil híbrido: LEGADO. No es una especialización oficial del proyecto.
 * Se conserva únicamente por compatibilidad histórica de la API; todas las
 * comparaciones, matrices y recomendaciones oficiales usan solo «raw» o
 * «elemental». No se usa en el sistema oficial de specializaciones.
 */
export const HYBRID_PROFILE = Object.freeze({ id: "hybrid", legacy: true });

/**
 * Offensive-skill priority order for a profile + shot type + element.
 * The first N entries are activated when activeSkillBudget = N. Every entry is
 * an offensive skill (see OFFENSIVE_SKILL_REASONS); coating multipliers Power C+
 * and Elemental are included because they multiply damage per shot.
 */
export function offensivePriority(profile, shotType, element) {
  if (!BOW_SHOT_SKILLS[shotType]) throw new Error("Tipo de flecha no válido: " + shotType);
  const shotSkill = SHOT_SKILL_BY_TYPE[shotType];
  if (!shotSkill) throw new Error("Tipo de flecha sin habilidad ofensiva: " + shotType);
  if (profile === "raw") {
    // RAW: shot multiplier first, then physical multipliers, then Attack (high
    // threshold, often the first skill that cannot be reached in G).
    return [shotSkill, "Expert", "Tenderizer", "Critical Up", "Power C+", "Attack"];
  }
  if (profile === "elemental") {
    const elementSkill = BOW_ELEMENT_SKILLS[element];
    if (!elementSkill) throw new Error("Elemento no válido para perfil elemental: " + element);
    // Elemental: elemental damage multipliers first. Expert (Ojo crítico) es
    // una fuente de afinidad que alimenta el multiplicador de Crítico
    // elemental, por lo que se valora como candidata de afinidad.
    return [elementSkill, "Crit Element", "Tenderizer", "Expert", shotSkill, "Elemental", "Critical Up"];
  }
  if (profile === HYBRID_PROFILE.id || profile === "hybrid") {
    const elementSkill = BOW_ELEMENT_SKILLS[element];
    if (!elementSkill) throw new Error("Elemento no válido para perfil híbrido: " + element);
    // Hybrid: elemental multipliers, then shot multiplier, then physical
    // coating multiplier and the remaining physical multipliers.
    return [elementSkill, "Crit Element", "Tenderizer", shotSkill, "Power C+", "Elemental", "Critical Up", "Expert"];
  }
  throw new Error("Perfil no válido: " + profile);
}

/**
 * Conjunto oficial de perfiles de especialización. El híbrido NO es una
 * especialización oficial: queda fuera de todas las comparaciones oficiales.
 */
export const OFFICIAL_PROFILES = Object.freeze(["raw", "elemental"]);

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
  profiles = ["raw", "elemental"],
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
