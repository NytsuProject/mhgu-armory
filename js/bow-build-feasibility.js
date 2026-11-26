export const BOW_SHOT_SKILLS = Object.freeze({
  Rapid: "Normal Up",
  Pierce: "Pierce Up",
  Spread: "Pellet Up",
  Heavy: "Heavy Up",
});

export const BOW_ELEMENT_SKILLS = Object.freeze({
  Fire: "Fire Atk",
  Water: "Water Atk",
  Thunder: "Thunder Atk",
  Ice: "Ice Atk",
  Dragon: "Dragon Atk",
});

const ARMOR_SLOTS = ["head", "chest", "arms", "waist", "legs"];
const GUNNER_CLASSES = new Set(["G", "A"]);
const COATING_LEVELS = new Set(["none", "I", "II"]);

function coatingSkill(level, skill) {
  if (!COATING_LEVELS.has(level)) {
    throw new Error("Nivel de revestimiento no válido: " + level);
  }
  if (level === "none") return null;
  return [skill, level === "II" ? 15 : 10];
}

function addRequirement(targets, skill, points) {
  if (targets[skill] !== undefined && targets[skill] !== points) {
    throw new Error("Requisito duplicado incompatible para " + skill);
  }
  targets[skill] = points;
}

/**
 * Returns actual MHGU skill activation thresholds for a bow loadout.
 * Coating levels mean the bow does not have that coating natively.
 */
export function buildBowSkillRequirements(options = {}) {
  const {
    profile,
    shotType,
    element = null,
    powerCoatingLevel = "none",
    elementCoatingLevel = "none",
    loadUp = false,
    ammoSaver = false,
  } = options;

  if (profile !== "raw" && profile !== "elemental") {
    throw new Error("profile debe ser raw o elemental.");
  }
  const shotSkill = BOW_SHOT_SKILLS[shotType];
  if (!shotSkill) throw new Error("Tipo de flecha no válido: " + shotType);

  const targets = {};
  if (profile === "raw") {
    addRequirement(targets, "Attack", 20);
    addRequirement(targets, "Expert", 15);
    addRequirement(targets, "Tenderizer", 10);
    addRequirement(targets, "Critical Up", 10);
  } else {
    const elementSkill = BOW_ELEMENT_SKILLS[element];
    if (!elementSkill) throw new Error("Elemento no válido: " + element);
    addRequirement(targets, "Elemental", 10);
    addRequirement(targets, elementSkill, 15);
    addRequirement(targets, "Crit Element", 10);
    addRequirement(targets, "Tenderizer", 10);
    const elementCoating = coatingSkill(elementCoatingLevel, "Elem C+");
    if (elementCoating) addRequirement(targets, ...elementCoating);
  }

  addRequirement(targets, shotSkill, 10);
  const powerCoating = coatingSkill(powerCoatingLevel, "Power C+");
  if (powerCoating) addRequirement(targets, ...powerCoating);
  if (loadUp) addRequirement(targets, "Loading", 10);
  if (ammoSaver) addRequirement(targets, "Ammo Saver", 10);

  return targets;
}

export function makeBowSkillPackages() {
  const shotTypes = Object.keys(BOW_SHOT_SKILLS);
  const elements = Object.keys(BOW_ELEMENT_SKILLS);
  const packages = [];

  for (const shotType of shotTypes) {
    packages.push({
      id: "raw-native-" + shotType.toLowerCase(),
      label: "RAW · " + shotType + " · revestimientos nativos",
      profile: "raw",
      shotType,
      element: null,
      requirements: buildBowSkillRequirements({ profile: "raw", shotType }),
    });
    packages.push({
      id: "raw-power-ii-" + shotType.toLowerCase(),
      label: "RAW · " + shotType + " · desbloquear Potencia II",
      profile: "raw",
      shotType,
      element: null,
      requirements: buildBowSkillRequirements({
        profile: "raw", shotType, powerCoatingLevel: "II",
      }),
    });

    for (const element of elements) {
      packages.push({
        id: "element-full-" + element.toLowerCase() + "-" + shotType.toLowerCase(),
        label: "Elemental · " + element + " · " + shotType + " · coating elemental II",
        profile: "elemental",
        shotType,
        element,
        requirements: buildBowSkillRequirements({
          profile: "elemental", shotType, element, elementCoatingLevel: "II",
        }),
      });
      packages.push({
        id: "element-hybrid-" + element.toLowerCase() + "-" + shotType.toLowerCase(),
        label: "Híbrida · " + element + " · " + shotType + " · ambos coatings II",
        profile: "elemental",
        legacy: true,
        shotType,
        element,
        requirements: buildBowSkillRequirements({
          profile: "elemental", shotType, element,
          elementCoatingLevel: "II", powerCoatingLevel: "II",
        }),
      });
      packages.push({
        id: "element-hybrid-low-" + element.toLowerCase() + "-" + shotType.toLowerCase(),
        label: "Híbrida económica · " + element + " · " + shotType + " · ambos coatings I",
        profile: "elemental",
        legacy: true,
        shotType,
        element,
        requirements: buildBowSkillRequirements({
          profile: "elemental", shotType, element,
          elementCoatingLevel: "I", powerCoatingLevel: "I",
        }),
      });
    }
  }
  return packages;
}

function skillPoints(rows, skill) {
  return (rows || []).reduce((sum, row) => sum + (row?.[0] === skill ? Number(row[2] || 0) : 0), 0);
}

function positiveValues(values) {
  return [...new Set((values || []).map(Number).filter(value => Number.isFinite(value) && value > 0))]
    .sort((a, b) => a - b);
}

function sourceCoverage(skill, threshold, armorPieces, decorations, talismanSkills) {
  const matchingPieces = armorPieces
    .map(piece => ({ piece, points: skillPoints(piece.sk, skill) }))
    .filter(row => row.points > 0);
  const perSlot = Object.fromEntries(ARMOR_SLOTS.map(slot => {
    const rows = matchingPieces.filter(row => row.piece.slot === slot);
    const best = [...rows].sort((a, b) => b.points - a.points)[0];
    return [slot, {
      pieces: rows.length,
      piecesAtThreshold: rows.filter(row => row.points >= threshold).length,
      maxPoints: best?.points || 0,
      bestPiece: best ? {
        id: best.piece.id,
        name: best.piece.nameEs || best.piece.name,
        points: best.points,
        deco: Number(best.piece.deco || 0),
        cls: best.piece.cls,
        gender: best.piece.gender,
      } : null,
    }];
  }));

  const jewels = (decorations || [])
    .map(jewel => ({
      id: jewel.id,
      name: jewel.name,
      cost: jewel.cost,
      points: skillPoints(jewel.sk, skill),
      otherSkills: (jewel.sk || [])
        .filter(row => row[0] !== skill)
        .map(row => ({ skill: row[0], points: Number(row[2] || 0) })),
    }))
    .filter(jewel => jewel.points !== 0)
    .sort((a, b) => b.points - a.points || a.cost - b.cost);

  const talisman = (talismanSkills || []).find(row => row.en === skill);
  const primaryValues = positiveValues(talisman?.points?.[0]);
  const secondaryValues = positiveValues(talisman?.points?.[1]);

  return {
    skill,
    targetPoints: threshold,
    armor: {
      pieceCount: matchingPieces.length,
      piecesAtThreshold: matchingPieces.filter(row => row.points >= threshold).length,
      bySlot: perSlot,
      bestPieces: matchingPieces
        .sort((a, b) => b.points - a.points)
        .slice(0, 5)
        .map(({ piece, points }) => ({
          id: piece.id,
          name: piece.nameEs || piece.name,
          slot: piece.slot,
          points,
          deco: Number(piece.deco || 0),
          cls: piece.cls,
          gender: piece.gender,
        })),
    },
    decorations: {
      count: jewels.length,
      singleJewelAtThreshold: jewels.filter(jewel => jewel.points >= threshold).length,
      options: jewels,
    },
    talisman: {
      available: Boolean(talisman),
      primaryValues,
      secondaryValues,
      primaryMax: primaryValues.at(-1) || 0,
      secondaryMax: secondaryValues.at(-1) || 0,
      primaryCanReachThreshold: primaryValues.some(value => value >= threshold),
      secondaryCanReachThreshold: secondaryValues.some(value => value >= threshold),
    },
  };
}

export function auditBowBuildSkillAvailability({
  armorData,
  decorations,
  talismanSkills,
  skillLevels,
  rank = "G",
} = {}) {
  if (!armorData?.pieces || !Array.isArray(decorations) ||
      !Array.isArray(talismanSkills) || !skillLevels) {
    throw new Error("Faltan datos de armaduras, joyas, talismanes o niveles de habilidad.");
  }
  if (!["LR", "HR", "G"].includes(rank)) throw new Error("Rango no válido: " + rank);

  const armorPieces = Object.entries(armorData.pieces)
    .map(([id, piece]) => ({ id: Number(id), ...piece }))
    .filter(piece => piece.rank === rank && (piece.slot === "head" || GUNNER_CLASSES.has(piece.cls)));

  const packages = makeBowSkillPackages();
  const optionalRequirements = buildBowSkillRequirements({
    profile: "raw", shotType: "Rapid", loadUp: true, ammoSaver: true,
  });
  const targetsBySkill = new Map();
  for (const loadout of packages) {
    for (const [skill, points] of Object.entries(loadout.requirements)) {
      if (!targetsBySkill.has(skill)) targetsBySkill.set(skill, new Set());
      targetsBySkill.get(skill).add(points);
    }
  }

  for (const skill of ["Loading", "Ammo Saver"]) {
    if (!targetsBySkill.has(skill)) targetsBySkill.set(skill, new Set());
    targetsBySkill.get(skill).add(optionalRequirements[skill]);
  }

  const skillAvailability = {};
  for (const [skill, thresholds] of [...targetsBySkill.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    const availableThresholds = (skillLevels[skill] || []).map(row => Number(row.points));
    const audits = [...thresholds].sort((a, b) => a - b).map(threshold => {
      const isRealThreshold = availableThresholds.includes(threshold);
      if (!isRealThreshold) {
        throw new Error("El umbral " + threshold + " de " + skill + " no coincide con skill-levels.json.");
      }
      return sourceCoverage(skill, threshold, armorPieces, decorations, talismanSkills);
    });
    skillAvailability[skill] = {
      activationThresholds: availableThresholds,
      targets: audits,
    };
  }

  const packagesWithTotals = packages.map(loadout => ({
    ...loadout,
    skillCount: Object.keys(loadout.requirements).length,
    thresholdPointSum: Object.values(loadout.requirements).reduce((sum, value) => sum + value, 0),
  }));

  return {
    metadata: {
      model: "MHGU bow skill-source availability audit v2",
      rank,
      eligibleBowArmorPieces: armorPieces.length,
      decorations: decorations.length,
      talismanSkillEntries: talismanSkills.length,
      armorClassPolicy: "Head: Blademaster (B), Gunner (G) or All (A); body: Gunner (G) or All (A)",
      armorRankPolicy: "Only armor rows matching the selected rank are included",
      buildStatus: "Source availability audit only; it does not claim a complete five-piece build is feasible.",
    },
    packages: packagesWithTotals,
    skillAvailability,
  };
}

export function summarizeBowWeaponCatalog(bowData) {
  if (!Array.isArray(bowData?.trees)) throw new Error("Catálogo de arcos no válido.");
  const rows = [];
  for (const tree of bowData.trees) {
    for (const level of tree.levels || []) {
      const rarity = Number(level.rar ?? tree.rarity);
      const rank = rarity >= 1 && rarity <= 3 ? "LR"
        : rarity >= 4 && rarity <= 7 ? "HR"
        : rarity >= 8 && rarity <= 11 ? "G" : null;
      if (!rank) continue;
      const coatings = level.x?.coatings || [];
      const element = (level.ele || []).find(row => BOW_ELEMENT_SKILLS[row?.[1]]);
      const slots = [...String(level.slots || "")].filter(char => char === "◯").length;
      rows.push({
        treeId: tree.id,
        level: Number(level.lv),
        rank,
        element: element?.[1] || null,
        elementValue: element ? Number(element[2] || 0) : 0,
        powerI: coatings.includes("Power Coating"),
        powerII: coatings.includes("Power Coating 2"),
        elementI: coatings.includes("Element Coating"),
        elementII: coatings.includes("Element Coating 2"),
        slots,
      });
    }
  }

  const ranks = {};
  for (const rank of ["LR", "HR", "G"]) {
    const selected = rows.filter(row => row.rank === rank);
    ranks[rank] = {
      levelRecords: selected.length,
      elementalRecords: selected.filter(row => row.element).length,
      elements: Object.fromEntries(Object.keys(BOW_ELEMENT_SKILLS).map(element => [
        element, selected.filter(row => row.element === element).length,
      ])),
      nativePowerI: selected.filter(row => row.powerI).length,
      nativePowerII: selected.filter(row => row.powerII).length,
      nativeElementI: selected.filter(row => row.elementI).length,
      nativeElementII: selected.filter(row => row.elementII).length,
      bothElementIIAndPowerII: selected.filter(row => row.elementII && row.powerII).length,
      weaponSlots: [0, 1, 2, 3].map(count => ({
        count,
        levels: selected.filter(row => row.slots === count).length,
      })),
      elementAbove30: selected.filter(row => row.element && row.elementValue > 30).length,
    };
  }
  return {
    treeSegments: bowData.trees.length,
    levelRecords: rows.length,
    ranks,
  };
}
