// Pure MHXX bow damage model for reproducible balance comparisons.
// This is a comparative model, not an in-game frame-accurate DPS calculator.
export const BOW_DISPLAY_RAW_MULTIPLIER = 1.2;
export const CRITICAL_DISTANCE_MULTIPLIER = 1.5;
export const CHARGE_RAW = [0.4, 1.0, 1.5, 1.7];
export const CHARGE_ELEMENT = [0.70, 0.85, 1.0, 1.125];
export const ELEMENT_CHARGE_SCENARIOS = {
  base: { label: "Actual", multipliers: CHARGE_ELEMENT },
  A: { label: "Escenario A", multipliers: [0.70, 0.90, 1.05, 1.25] },
  B: { label: "Escenario B", multipliers: [0.70, 0.95, 1.10, 1.30] }
};
export const ELEMENTS = { Fire: 0, Water: 1, Thunder: 2, Ice: 3, Dragon: 4 };
export const SHOT_MVS = {
  Rapid: { 1: [12], 2: [12, 4], 3: [12, 4, 3], 4: [12, 4, 3, 2], 5: [12, 4, 3, 3] },
  Pierce: { 1: [5, 5, 5], 2: [4, 4, 4, 4], 3: [4, 4, 4, 4, 4], 4: [4, 4, 4, 4, 4], 5: [4, 4, 4, 4, 4] },
  Spread: { 1: [4, 5, 4], 2: [5, 6, 5], 3: [4, 5, 5, 5, 4], 4: [4, 5, 6, 5, 4], 5: [5, 5, 6, 5, 5] },
  Heavy: { 1: [11], 2: [14], 3: [17], 4: [19], 5: [20] }
};
export const SHOT_TYPE_UP = { Rapid: 1.10, Pierce: 1.10, Spread: 1.30, Heavy: 1.10 };
export const PROFILE = {
  raw: {
    id: "raw",
    label: "RAW optimizado (normalizado)",
    activeSkills: ["Ataque +3", "Experto +2", "Maza", "Potenciador crítico", "Potenciador del tipo de flecha"],
    skillCount: 5,
    nominalThresholdPoints: 65,
    attackTrueRaw: 20,
    expertAffinity: 20,
    weaknessExploit: true,
    criticalBoost: true,
    elementalSkills: false,
    criticalElement: false
  },
  elemental: {
    id: "elemental",
    label: "Elemental optimizado (normalizado)",
    activeSkills: ["Ataque elemental", "Ataque del elemento +2", "Crítico elemental", "Maza", "Potenciador del tipo de flecha"],
    skillCount: 5,
    nominalThresholdPoints: 55,
    attackTrueRaw: 0,
    expertAffinity: 0,
    weaknessExploit: true,
    criticalBoost: false,
    elementalSkills: true,
    criticalElement: true
  }
};
const COATING = {
  raw: {
    i: { name: "Power Coating", multiplier: 1.35, capacity: 50 },
    ii: { name: "Power Coating 2", multiplier: 1.50, capacity: 50 },
    skill: "Power C+"
  },
  elemental: {
    i: { name: "Element Coating", multiplier: 1.35, capacity: 20 },
    ii: { name: "Element Coating 2", multiplier: 1.50, capacity: 20 },
    skill: "Elem C+"
  }
};

export function rankForRarity(rarity) {
  if (rarity >= 1 && rarity <= 3) return "LR";
  if (rarity >= 4 && rarity <= 7) return "HR";
  if (rarity >= 8 && rarity <= 11) return "G";
  return null;
}

export function parseCharge(value) {
  const match = /^(Rapid|Pierce|Spread|Heavy) Lv([1-5])(!)?$/.exec(String(value || ""));
  if (!match) return null;
  return { type: match[1], level: Number(match[2]), requiresLoadUp: Boolean(match[3]) };
}

export function parseHitzones(source) {
  if (typeof source !== "string") return source;
  const trimmed = source.trim();
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) return JSON.parse(trimmed);
  const marker = "window.MONSTER_DATA";
  const at = trimmed.indexOf(marker);
  if (at < 0) throw new Error("No encuentro window.MONSTER_DATA en el archivo de hitzones.");
  const equals = trimmed.indexOf("=", at);
  const end = trimmed.lastIndexOf(";");
  if (equals < 0) throw new Error("El archivo de hitzones no contiene una asignación válida.");
  const json = trimmed.slice(equals + 1, end > equals ? end : undefined).trim();
  return JSON.parse(json);
}

export function makeWeaponCandidates(bowData, options = {}) {
  const loadUpPolicy = options.loadUpPolicy || "match-c3";
  if (!["current", "match-c3"].includes(loadUpPolicy)) throw new Error("loadUpPolicy debe ser current o match-c3.");
  const result = [];
  for (const tree of bowData.trees || []) {
    for (const level of tree.levels || []) {
      const rank = rankForRarity(Number(level.rar ?? tree.rarity));
      if (!rank) continue;
      const parsed = (level.x?.charges || []).map(parseCharge);
      const c3 = parsed[2];
      for (let index = 0; index < parsed.length; index++) {
        const charge = parsed[index];
        if (!charge) continue;
        let type = charge.type;
        const previousCharge = index > 0 ? parsed[index - 1] : null;
        const projectedLoadUpType = loadUpPolicy === "match-c3" && charge.requiresLoadUp && previousCharge?.type;
        if (projectedLoadUpType) type = previousCharge.type;
        result.push({
          treeId: tree.id,
          treeName: level.nEs || tree.finalNameEs || tree.nameEs || tree.name || ("Árbol " + tree.id),
          name: level.nEs || level.n || tree.nameEs || tree.name || ("Árbol " + tree.id),
          level: Number(level.lv),
          rarity: Number(level.rar ?? tree.rarity),
          rank,
          rawDisplay: Number(level.raw || 0),
          affinity: Number(level.aff || 0),
          elements: (level.ele || []).filter(row => row && ELEMENTS[row[1] ?? row.en] !== undefined).map(row => ({
            label: row[0],
            type: row[1] ?? row.en,
            display: Number(row[2] ?? row.value ?? 0)
          })),
          coatings: [...(level.x?.coatings || [])],
          chargeSlot: index + 1,
          chargeType: type,
          chargeLevel: charge.level,
          requiresLoadUp: charge.requiresLoadUp,
          projectedLoadUpType: Boolean(projectedLoadUpType),
          rawMotionValues: SHOT_MVS[type]?.[charge.level] || [],
          cls: "G"
        });
      }
    }
  }
  return result;
}

function clampAffinity(value) {
  return Math.max(-100, Math.min(100, value));
}

export function affinityForProfile(weapon, part, profile) {
  let value = Number(weapon.affinity || 0) + (profile.expertAffinity || 0);
  if (profile.weaknessExploit && Number(part[4] || 0) >= 45) value += 50;
  return clampAffinity(value);
}

function expectedPhysicalCrit(affinity, criticalBoost) {
  const rate = affinity / 100;
  if (rate < 0) return 1 + rate * 0.25;
  return 1 + rate * ((criticalBoost ? 1.40 : 1.25) - 1);
}

function elementWithSkills(displayElement, enabled) {
  if (!enabled) return displayElement / 10;
  // Elemental +10 and element-specific +2: +20% combined cap, plus +6 flat.
  return Math.floor(displayElement * 1.20 + 6 + 1e-8) / 10;
}

function coatingForWeapon(weapon, profile, mode) {
  const group = profile.id === "raw" ? COATING.raw : COATING.elemental;
  if (mode === "none") return { label: "Sin revestimiento", multiplier: 1, capacity: 0, extraSkillSlots: 0, item: null };
  const hasI = weapon.coatings.includes(group.i.name);
  const hasII = weapon.coatings.includes(group.ii.name);
  if (mode === "native") {
    if (hasII) return { label: group.ii.name, multiplier: group.ii.multiplier, capacity: group.ii.capacity, extraSkillSlots: 0, item: group.ii.name };
    if (hasI) return { label: group.i.name, multiplier: group.i.multiplier, capacity: group.i.capacity, extraSkillSlots: 0, item: group.i.name };
    return { label: "No compatible nativo", multiplier: 1, capacity: 0, extraSkillSlots: 0, item: null };
  }
  if (mode === "unlock-II") {
    if (hasII) return { label: group.ii.name + " (nativo)", multiplier: group.ii.multiplier, capacity: group.ii.capacity, extraSkillSlots: 0, item: group.ii.name };
    return { label: group.ii.name + " (requiere " + group.skill + " +15)", multiplier: group.ii.multiplier, capacity: group.ii.capacity, extraSkillSlots: 1, item: group.ii.name };
  }
  throw new Error("Modo de revestimiento no reconocido: " + mode);
}

export function averageCoatingMultiplier(coating, shotsPerStack = 100, returnRate = 0) {
  if (!coating || !coating.capacity || !coating.multiplier || shotsPerStack <= 0) return 1;
  const rate = Math.max(0, Math.min(0.95, Number(returnRate) || 0));
  const expectedUses = coating.capacity / (1 - rate);
  const uptime = Math.min(1, expectedUses / shotsPerStack);
  return 1 + (coating.multiplier - 1) * uptime;
}

export function calculateVolley(weapon, part, options = {}) {
  const profile = typeof options.profile === "string" ? PROFILE[options.profile] : options.profile;
  if (!profile) throw new Error("Perfil RAW o elemental obligatorio.");
  const type = weapon.chargeType;
  const shotLevel = weapon.chargeLevel;
  const mv = weapon.rawMotionValues?.length ? weapon.rawMotionValues : SHOT_MVS[type]?.[shotLevel];
  if (!mv?.length) throw new Error("No hay MV para " + type + " Lv" + shotLevel + ".");
  const slot = weapon.chargeSlot;
  const chargeRaw = CHARGE_RAW[slot - 1];
  const chargeElement = (options.chargeElementMultipliers || CHARGE_ELEMENT)[slot - 1];
  const shotHz = Number(part[4] || 0);
  const elementEntry = weapon.elements?.[0] || null;
  const elementIndex = elementEntry ? ELEMENTS[elementEntry.type] : null;
  const elementHz = elementIndex === null ? 0 : Number(part[5 + elementIndex] || 0);
  const affinity = affinityForProfile(weapon, part, profile);
  const trueRaw = weapon.rawDisplay / BOW_DISPLAY_RAW_MULTIPLIER + (profile.attackTrueRaw || 0);
  const rawCoating = profile.id === "raw"
    ? coatingForWeapon(weapon, PROFILE.raw, options.coatingMode || "none")
    : { label: "No aplica", multiplier: 1, capacity: 0, extraSkillSlots: 0, item: null };
  const rawCoatingFactor = averageCoatingMultiplier(rawCoating, options.shotsPerStack || 100, options.ammoSaverReturnRate || 0);
  const rawCritFactor = expectedPhysicalCrit(affinity, profile.criticalBoost);
  const shotUp = SHOT_TYPE_UP[type] || 1;
  const rawMotionTotal = mv.reduce((sum, value) => sum + value, 0) / 100;
  const rawDamage = trueRaw * chargeRaw * (options.distanceFactor ?? CRITICAL_DISTANCE_MULTIPLIER)
    * rawMotionTotal * (shotHz / 100) * shotUp * rawCritFactor * rawCoatingFactor;

  const trueElement = elementEntry ? elementWithSkills(elementEntry.display, profile.elementalSkills) : 0;
  let elementCoating = profile.id === "elemental"
    ? coatingForWeapon(weapon, PROFILE.elemental, options.elementCoatingMode || "none")
    : { label: "No aplica", multiplier: 1, capacity: 0, extraSkillSlots: 0, item: null };
  if (profile.id === "elemental" && Number.isFinite(options.elementCoatingCapacity)) {
    elementCoating = { ...elementCoating, capacity: options.elementCoatingCapacity };
  }
  const elementCoatingFactor = averageCoatingMultiplier(elementCoating, options.shotsPerStack || 100, options.ammoSaverReturnRate || 0);
  const criticalElementFactor = profile.criticalElement ? 1 + Math.max(0, affinity) / 100 * 0.35 : 1;
  const elementalHits = mv.length;
  const elementalDamage = trueElement * chargeElement * elementalHits * (elementHz / 100)
    * criticalElementFactor * elementCoatingFactor;

  const loadUpSkillSlots = weapon.requiresLoadUp ? 1 : 0;
  const coatingSkillSlots = profile.id === "raw" ? rawCoating.extraSkillSlots : elementCoating.extraSkillSlots;
  const activeCoatingCapacity = profile.id === "raw" ? rawCoating.capacity : elementCoating.capacity;
  const ammoSaverSkillSlots = activeCoatingCapacity > 0 && (options.ammoSaverReturnRate || 0) > 0 ? 1 : 0;
  return {
    profile: profile.id,
    weapon: weapon.name,
    treeId: weapon.treeId,
    level: weapon.level,
    rarity: weapon.rarity,
    rank: weapon.rank,
    shotType: type,
    shotLevel,
    chargeSlot: slot,
    requiresLoadUp: weapon.requiresLoadUp,
    projectedLoadUpType: weapon.projectedLoadUpType,
    part: part[1] || ("Parte " + part[0]),
    shotHz,
    element: elementEntry?.type || null,
    elementHz,
    hitCount: elementalHits,
    rawMotionTotal,
    affinity,
    rawDamage,
    elementalDamage,
    totalDamage: rawDamage + elementalDamage,
    coating: profile.id === "raw" ? rawCoating.label : elementCoating.label,
    coatingFactor: profile.id === "raw" ? rawCoatingFactor : elementCoatingFactor,
    coatingSkillSlots,
    loadUpSkillSlots,
    ammoSaverSkillSlots,
    totalSkillSlots: profile.skillCount + loadUpSkillSlots + coatingSkillSlots + ammoSaverSkillSlots,
    nominalThresholdPoints: profile.nominalThresholdPoints
  };
}

function better(a, b) {
  return !b || a.totalDamage > b.totalDamage;
}

function bestForWeaponAndPart(weapon, part, profile, options) {
  return calculateVolley(weapon, part, { ...options, profile });
}

export function simulateBowBalance(bowData, hitzoneData, options = {}) {
  const loadUpPolicy = options.loadUpPolicy || "match-c3";
  const weapons = makeWeaponCandidates(bowData, { loadUpPolicy });
  const monsters = (hitzoneData.monsters || []).filter(monster => monster.large);
  const ranks = ["LR", "HR", "G"];
  const shotTypes = ["Rapid", "Pierce", "Spread", "Heavy"];
  const coatingScenarios = [
    { id: "uncoated", label: "Sin revestimientos", coatingMode: "none", elementCoatingMode: "none", elementCoatingCapacity: null },
    { id: "native-single-stack", label: "Revestimientos nativos, elemento capacidad 20", coatingMode: "native", elementCoatingMode: "native", elementCoatingCapacity: 20 },
    { id: "native-element-50", label: "Revestimientos nativos, elemento capacidad 50", coatingMode: "native", elementCoatingMode: "native", elementCoatingCapacity: 50 },
    { id: "unlocked-II-single-stack", label: "Nivel II desbloqueado, elemento capacidad 20", coatingMode: "unlock-II", elementCoatingMode: "unlock-II", elementCoatingCapacity: 20 },
    { id: "unlocked-II-element-50", label: "Nivel II desbloqueado, elemento capacidad 50", coatingMode: "unlock-II", elementCoatingMode: "unlock-II", elementCoatingCapacity: 50 }
  ];
  const chargeScenarioIds = options.chargeScenarios || ["base", "A", "B"];
  for (const id of chargeScenarioIds) {
    if (!ELEMENT_CHARGE_SCENARIOS[id]) throw new Error("Escenario elemental de carga no reconocido: " + id);
  }
  const shotsPerStack = Number(options.shotsPerStack || 100);
  const returnRate = Number(options.ammoSaverReturnRate || 0);
  const budgets = options.skillBudgets || [5, 6, 7];
  const matchups = [];
  const sameWeapon = [];
  const summary = [];

  for (const rank of ranks) {
    for (const shotType of shotTypes) {
      const inRank = weapons.filter(w => w.rank === rank && w.chargeType === shotType);
      for (const chargeScenarioId of chargeScenarioIds) {
        const chargeScenario = ELEMENT_CHARGE_SCENARIOS[chargeScenarioId];
        for (const monster of monsters) {
          const parts = monster.tables?.[0] || [];
          if (!parts.length) continue;
          for (const coatingScenario of coatingScenarios) {
            const evaluated = [];
            for (const weapon of inRank) {
              for (const part of parts) {
                const shared = {
                  coatingMode: coatingScenario.coatingMode,
                  elementCoatingMode: coatingScenario.elementCoatingMode,
                  shotsPerStack,
                  ammoSaverReturnRate: returnRate,
                  chargeElementMultipliers: chargeScenario.multipliers,
                  elementCoatingCapacity: coatingScenario.elementCoatingCapacity
                };
                const raw = bestForWeaponAndPart(weapon, part, PROFILE.raw, shared);
                const element = weapon.elements.length
                  ? bestForWeaponAndPart(weapon, part, PROFILE.elemental, shared)
                  : null;
                evaluated.push({ raw, element });
              }
            }
            for (const budget of budgets) {
              const rawRows = evaluated.map(row => row.raw).filter(row => row.totalSkillSlots <= budget);
              const elementRows = evaluated.map(row => row.element).filter(row => row && row.totalSkillSlots <= budget);
              const bestRaw = rawRows.reduce((best, row) => better(row, best) ? row : best, null);
              const bestElement = elementRows.reduce((best, row) => better(row, best) ? row : best, null);
              if (!bestRaw && !bestElement) continue;
              const ratio = bestRaw && bestElement ? bestElement.totalDamage / Math.max(bestRaw.totalDamage, 1e-9) : null;
              matchups.push({
                rank,
                shotType,
                monster: monster.name,
                chargeScenario: chargeScenarioId,
                coatingScenario: coatingScenario.id,
                skillBudget: budget,
                firstHitzoneTableOnly: true,
                assumesEveryArrowHitsSamePart: true,
                rawBest: bestRaw,
                elementBest: bestElement,
                elementalToRawRatio: ratio,
                elementalAdvantagePercent: ratio === null ? null : (ratio - 1) * 100
              });
            }
          }
        }
      }
    }
  }

  // Same-weapon comparison isolates loadout choice from differences between weapon stats.
  for (const rank of ranks) {
    for (const shotType of shotTypes) {
      const sameRank = inRankWeapons(weapons, rank, shotType).filter(w => w.elements.length);
      for (const chargeScenarioId of chargeScenarioIds) {
        const chargeScenario = ELEMENT_CHARGE_SCENARIOS[chargeScenarioId];
        for (const weapon of sameRank) {
          const part = [0, "neutral", 0, 0, 45, 20, 20, 20, 20, 20];
          const shared = { coatingMode: "none", elementCoatingMode: "none", chargeElementMultipliers: chargeScenario.multipliers };
          const raw = calculateVolley(weapon, part, { ...shared, profile: PROFILE.raw });
          const element = calculateVolley(weapon, part, { ...shared, profile: PROFILE.elemental });
          sameWeapon.push({
            rank,
            shotType,
            chargeScenario: chargeScenarioId,
            treeId: weapon.treeId,
            weapon: weapon.name,
            level: weapon.level,
            requiresLoadUp: weapon.requiresLoadUp,
            skillSlots: raw.totalSkillSlots,
            neutralReferencePart: true,
            rawProfileDamage: raw.totalDamage,
            elementalProfileDamage: element.totalDamage,
            elementalToRawRatio: element.totalDamage / Math.max(raw.totalDamage, 1e-9)
          });
        }
      }
    }
  }

  for (const rank of ranks) {
    for (const shotType of shotTypes) {
      for (const chargeScenarioId of chargeScenarioIds) {
        for (const coatingScenario of coatingScenarios) {
          for (const budget of budgets) {
            const rows = matchups.filter(m =>
              m.rank === rank &&
              m.shotType === shotType &&
              m.chargeScenario === chargeScenarioId &&
              m.coatingScenario === coatingScenario.id &&
              m.skillBudget === budget &&
              m.elementalToRawRatio !== null
            );
            if (!rows.length) continue;
            const ratios = rows.map(row => row.elementalToRawRatio).sort((a, b) => a - b);
            const mean = ratios.reduce((sum, value) => sum + value, 0) / ratios.length;
            const favorable = rows.filter(row => (row.elementBest?.elementHz || 0) >= 25);
            const medium = rows.filter(row => (row.elementBest?.elementHz || 0) >= 15 && (row.elementBest?.elementHz || 0) < 25);
            const poor = rows.filter(row => (row.elementBest?.elementHz || 0) <= 10);
            const average = list => list.length ? list.reduce((sum, row) => sum + row.elementalToRawRatio, 0) / list.length : null;
            summary.push({
              rank,
              shotType,
              chargeScenario: chargeScenarioId,
              coatingScenario: coatingScenario.id,
              skillBudget: budget,
              matchups: rows.length,
              elementalWins: rows.filter(row => row.elementalToRawRatio > 1).length,
              meanElementToRawRatio: mean,
              medianElementToRawRatio: ratios[Math.floor(ratios.length / 2)],
              favorable25Plus: { count: favorable.length, meanRatio: average(favorable), elementalWins: favorable.filter(row => row.elementalToRawRatio > 1).length },
              medium15To24: { count: medium.length, meanRatio: average(medium), elementalWins: medium.filter(row => row.elementalToRawRatio > 1).length },
              poor10OrLess: { count: poor.length, meanRatio: average(poor), elementalWins: poor.filter(row => row.elementalToRawRatio > 1).length }
            });
          }
        }
      }
    }
  }

  return {
    meta: {
      model: "MHXX bow comparison model v1",
      generatedAt: new Date().toISOString(),
      loadUpPolicy,
      monsterCount: monsters.length,
      weaponsByRank: Object.fromEntries(ranks.map(rank => [rank, [...new Set(weapons.filter(w => w.rank === rank).map(w => w.treeId + ":" + w.level))].length])),
      shotsPerStack,
      ammoSaverReturnRate: returnRate,
      firstHitzoneTableOnly: true,
      profiles: Object.values(PROFILE).map(profile => ({
        id: profile.id,
        label: profile.label,
        activeSkills: profile.activeSkills,
        activeSkillCount: profile.skillCount,
        nominalThresholdPoints: profile.nominalThresholdPoints
      })),
      elementChargeScenarios: chargeScenarioIds.map(id => ({
        id,
        label: ELEMENT_CHARGE_SCENARIOS[id].label,
        multipliers: ELEMENT_CHARGE_SCENARIOS[id].multipliers
      })),
      assumptions: [
        "Los paquetes comparados tienen cinco habilidades ofensivas activas; sus puntos umbral nominales (RAW 65, elemental 55) no equivalen a una optimización completa de armadura ni son directamente comparables entre árboles de habilidad.",
        "Attack +3 se aplica como +20 de true RAW; el RAW mostrado del arco se divide por el multiplicador de clase 1,2.",
        "Cada flecha de una descarga se supone que conecta con la misma parte seleccionada; es un límite superior optimista, especialmente para Perforante y Abanico.",
        "Se usa solo la primera tabla de hitzones; las tablas paralelas no se etiquetan como estados.",
        "La distancia crítica se fija en ×1,5 para ambos perfiles y no se calcula cadencia, tiempo de carga, resistencia ni DPS.",
        "El daño se calcula por descarga teórica; no incluye modificadores defensivos de misión, comida, objetos, técnicas de caza ni cambios de estado.",
        "Las bonificaciones de elemento del paquete elemental son +20% combinados con +6 planos; Crítico elemental es ×1,35 solo en críticos positivos.",
        "Cada coating consume una unidad por descarga, no por flecha/impacto. La capacidad se promedia sobre shotsPerStack disparos y no contempla crafteo/refill.",
        "El escenario unlocked-II asume que Power C+ / Elem C+ +15 permite usar el revestimiento II y suma una habilidad adicional cuando no es nativo.",
        "Ammo Saver queda desactivado por defecto: su probabilidad exacta de devolución no se asume."
      ],
      coatingScenarios: coatingScenarios.map(({ id, label }) => ({ id, label }))
    },
    summary,
    matchups,
    sameWeapon
  };
}
function inRankWeapons(weapons, rank, shotType) {
  return weapons.filter(weapon => weapon.rank === rank && weapon.chargeType === shotType);
}
