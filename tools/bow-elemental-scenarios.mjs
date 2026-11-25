#!/usr/bin/env node
/**
 * Stage 5 bow elemental scenario simulator.
 *
 * Produces an INDEX (not exact in-game DPS): damage components are evaluated
 * before per-hit rounding, defense modifiers, actual projectile spread,
 * Power Shot follow-ups, hunter-style effects and real hunt uptime.
 *
 * Input: ../data/weapons/bow.json
 * Output: JSON summary by rank / element / shot type / matchup profile,
 *         or CSV detail for every elemental weapon level and charge slot.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

export const RAW_CHARGE = [0.4, 1.0, 1.5, 1.7];
export const ELEMENT_CHARGE = {
  base: [0.70, 0.85, 1.00, 1.125],
  A:    [0.70, 0.90, 1.05, 1.25],
  B:    [0.70, 0.95, 1.10, 1.30],
};
export const ELEMENTS = ['Fire', 'Water', 'Thunder', 'Ice', 'Dragon'];
export const ELEMENT_LABELS = {
  Fire: 'Fuego', Water: 'Agua', Thunder: 'Rayo', Ice: 'Hielo', Dragon: 'Dragón',
};
export const SHOT_MV = {
  Rapid: {
    1: [12], 2: [12, 4], 3: [12, 4, 3], 4: [12, 4, 3, 2], 5: [12, 4, 3, 3],
  },
  Pierce: {
    1: [5, 5, 5], 2: [4, 4, 4, 4], 3: [4, 4, 4, 4, 4],
    4: [4, 4, 4, 4, 4], 5: [4, 4, 4, 4, 4],
  },
  Spread: {
    1: [4, 5, 4], 2: [5, 6, 5], 3: [4, 5, 5, 5, 4],
    4: [4, 5, 6, 5, 4], 5: [5, 5, 6, 5, 5],
  },
  Heavy: { 1: [11], 2: [14], 3: [17], 4: [19], 5: [20] },
};
export const MATCHUPS = [
  { id: 'favorable', label: 'Favorable', shotHz: 45, elementHz: 30 },
  { id: 'medium', label: 'Medium', shotHz: 45, elementHz: 15 },
  { id: 'poor', label: 'Poor', shotHz: 45, elementHz: 5 },
  { id: 'elemental_nonweakspot', label: 'Elemental zone / no WEX', shotHz: 35, elementHz: 30 },
];

const SHOT_UP = { Rapid: 1.10, Pierce: 1.10, Spread: 1.30, Heavy: 1.10 };
const ELEMENT_INDEX = { Fire: 5, Water: 6, Thunder: 7, Ice: 8, Dragon: 9 };
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const sum = values => values.reduce((a, b) => a + b, 0);
const round = (v, digits = 4) => Number(v.toFixed(digits));

export function rankFromRarity(rarity) {
  return rarity <= 3 ? 'LR' : rarity <= 7 ? 'HR' : 'G';
}

export function parseCharge(value) {
  const match = /^(Rapid|Pierce|Spread|Heavy) Lv([1-5])(!)?$/.exec(value || '');
  if (!match) return null;
  return { type: match[1], level: Number(match[2]), requiresLoadUp: Boolean(match[3]) };
}

export function normalizeLoadUpCharge(charges, index) {
  const original = charges[index];
  const parsed = parseCharge(original);
  if (!parsed?.requiresLoadUp || index <= 0) return original;
  const previous = parseCharge(charges[index - 1]);
  if (!previous || previous.type === parsed.type) return original;
  // Preserve the Load Up arrow level and marker; only align its arrow type
  // with the immediately preceding charge, per the project's rule.
  return `${previous.type} Lv${parsed.level}!`;
}

export function loadUpDiagnostics(database) {
  const result = { marked: 0, alreadyMatching: 0, normalized: 0, bySlot: {} };
  for (const tree of database.trees || []) {
    for (const level of tree.levels || []) {
      const charges = level.x?.charges || [];
      for (const [index, sourceCharge] of charges.entries()) {
        const parsed = parseCharge(sourceCharge);
        if (!parsed?.requiresLoadUp) continue;
        result.marked += 1;
        const slot = String(index + 1);
        result.bySlot[slot] = (result.bySlot[slot] || 0) + 1;
        if (normalizeLoadUpCharge(charges, index) !== sourceCharge) result.normalized += 1;
        else result.alreadyMatching += 1;
      }
    }
  }
  return result;
}

export function elementOf(level) {
  const row = (level.ele || []).find((entry) => ELEMENTS.includes(entry[1]));
  return row ? { label: row[0], type: row[1], value: row[2] } : null;
}

function hasCoating(level, name) {
  return (level.x?.coatings || []).includes(name);
}

function expectedCriticalMultiplier(affinityPct, positiveCritMultiplier) {
  const affinity = clamp(affinityPct, -100, 100) / 100;
  return affinity >= 0
    ? 1 + affinity * (positiveCritMultiplier - 1)
    : 1 + Math.abs(affinity) * (0.75 - 1);
}

function elementAffinityMultiplier(affinityPct, criticalElement) {
  if (!criticalElement) return 1;
  return 1 + Math.max(0, clamp(affinityPct, -100, 100)) / 100 * 0.35;
}

function shotAffinity(weapon, shotHz) {
  const expert3 = 30;
  const weaknessExploit = shotHz >= 45 ? 50 : 0;
  return clamp((weapon.aff || 0) + expert3 + weaknessExploit, -100, 100);
}

function skillCost(weapon, requiresLoadUp, trueShotUp = false, ammoSaverEnabled = false) {
  const nativePower2 = hasCoating(weapon, 'Power Coating 2');
  const nativePower1 = hasCoating(weapon, 'Power Coating');
  const nativeElement2 = hasCoating(weapon, 'Element Coating 2');
  const nativeElement1 = hasCoating(weapon, 'Element Coating');
  const powerUnlock = nativePower2 ? 0 : 15;
  const elementUnlock = nativeElement2 ? 0 : 15;
  // Budget-friendly path: retain native Lv. II, otherwise use native Lv. I,
  // and unlock only Lv. I (+10) when the bow has neither level natively.
  const lowCostPowerUnlock = nativePower2 || nativePower1 ? 0 : 10;
  const lowCostElementUnlock = nativeElement2 || nativeElement1 ? 0 : 10;
  const loadUp = requiresLoadUp ? 10 : 0;
  const raw = {
    points: 20 + 20 + 10 + 10 + 10 + (ammoSaverEnabled ? 10 : 0) + powerUnlock + loadUp,
    skills: 5 + Number(ammoSaverEnabled) + Number(!nativePower2) + Number(requiresLoadUp),
    powerUnlock, loadUp,
  };
  // Element Focus matches the five main skill lines of RAW by dropping shot-type Up.
  const elementFocused = {
    points: 20 + 20 + 10 + 10 + 15 + elementUnlock + loadUp,
    skills: 5 + Number(!nativeElement2) + Number(requiresLoadUp),
    elementUnlock, loadUp,
  };
  // Element Core retains shot-type Up and spends one extra line on Element +2.
  const elementLite = {
    points: 20 + 20 + 10 + 10 + 10 + 15 + elementUnlock + loadUp,
    skills: 6 + Number(!nativeElement2) + Number(requiresLoadUp),
    elementUnlock, loadUp,
  };
  // Full adds general Elemental +1; Ammo Saver is an optional extra skill line only when enabled.
  const elementFull = {
    points: elementLite.points + 10 + (ammoSaverEnabled ? 10 : 0),
    skills: elementLite.skills + 1 + Number(ammoSaverEnabled),
    elementUnlock, loadUp,
  };
  // Hybrid coating package: exhaust Element Coat II first, then use Power Coat II.
  // Power C+ is an extra +15 / skill line only when the bow lacks native Power II.
  const elementHybrid = {
    points: elementFull.points + powerUnlock,
    skills: elementFull.skills + Number(!nativePower2),
    elementUnlock, powerUnlock, loadUp,
  };
  const elementHybridLowCost = {
    points: elementFull.points - elementUnlock
      + lowCostElementUnlock + lowCostPowerUnlock,
    skills: elementFull.skills - Number(!nativeElement2)
      + Number(lowCostElementUnlock > 0) + Number(lowCostPowerUnlock > 0),
    elementUnlock: lowCostElementUnlock,
    powerUnlock: lowCostPowerUnlock,
    elementCoatingLevel: nativeElement2 ? 2 : 1,
    powerCoatingLevel: nativePower2 ? 2 : 1,
    loadUp,
  };
  if (trueShotUp) {
    for (const build of [raw, elementLite, elementFull, elementHybrid, elementHybridLowCost]) {
      build.points += 10;
      build.skills += 1;
    }
  }
  return { raw, elementFocused, elementLite, elementFull, elementHybrid, elementHybridLowCost };
}

/**
 * Calculates one charge's unrounded damage index under three explicit skill
 * packages. All theoretical arrows / Pierce contacts are assumed to hit the
 * same requested part. This is deliberately an upper-bound comparison.
 */
export function calculateShot(options) {
  const {
    weapon, charge, matchup, elementCharge = ELEMENT_CHARGE.base,
    rapidReliability = 1, missionShots = 200, ammoSaverChance = 0,
    ammoSaverEnabled = ammoSaverChance > 0,
    elementCoatingCapacity = 20, elementCap = null, loadUp = false, slotIndex = 2,
    coatingSwitchShots = 0, loadUpForPackage, trueShotUp = false, rawShotMultiplier = 1,
  } = options;
  const parsed = parseCharge(charge);
  const element = elementOf(weapon);
  const effectiveElementValue = element
    ? Math.min(element.value, elementCap ?? Number.POSITIVE_INFINITY) : 0;
  if (!parsed) return null;
  if (parsed.requiresLoadUp && !loadUp) return null;
  if (!Number.isInteger(slotIndex) || slotIndex < 0 || slotIndex > 3) {
    throw new RangeError('slotIndex must be an integer from 0 to 3.');
  }
  if (!Number.isFinite(missionShots) || missionShots <= 0) {
    throw new RangeError('missionShots must be greater than zero.');
  }
  if (!Number.isFinite(ammoSaverChance) || ammoSaverChance < 0 || ammoSaverChance >= 1) {
    throw new RangeError('ammoSaverChance must be between 0 (inclusive) and 1 (exclusive).');
  }
  if (!Number.isFinite(elementCoatingCapacity) || elementCoatingCapacity < 0) {
    throw new RangeError('elementCoatingCapacity must be zero or greater.');
  }
  if (elementCap !== null && elementCap !== undefined
      && (!Number.isFinite(elementCap) || elementCap < 0)) {
    throw new RangeError('elementCap must be zero or greater when supplied.');
  }
  if (!Number.isFinite(coatingSwitchShots) || coatingSwitchShots < 0) {
    throw new RangeError('coatingSwitchShots must be zero or greater.');
  }
  if (!Number.isFinite(rapidReliability) || rapidReliability < 0 || rapidReliability > 1) {
    throw new RangeError('rapidReliability must be between 0 and 1.');
  }
  if (!Array.isArray(elementCharge) || !Number.isFinite(elementCharge[slotIndex])) {
    throw new TypeError('elementCharge must contain a multiplier for each charge slot.');
  }

  const shot = parsed.type;
  const shotLevel = parsed.level;
  const mvs = SHOT_MV[shot][shotLevel];
  const arrowHits = mvs.length;
  const mvSum = sum(mvs);
  const affinity = shotAffinity(weapon, matchup.shotHz);
  const shotUp = SHOT_UP[shot];
  const rawCharge = RAW_CHARGE[slotIndex];
  const eleCharge = elementCharge[slotIndex];
  const distance = 1.5;
  const reliability = shot === 'Rapid' ? clamp(rapidReliability, 0, 1) : 1;
  const weaponCoatings = weapon.x?.coatings || [];
  const hasPower2 = weaponCoatings.includes('Power Coating 2');
  const hasPower1 = weaponCoatings.includes('Power Coating');
  const hasElement2 = weaponCoatings.includes('Element Coating 2');
  const hasElement1 = weaponCoatings.includes('Element Coating');
  const skillCosts = skillCost(weapon, loadUpForPackage ?? parsed.requiresLoadUp, trueShotUp, ammoSaverEnabled);
  const activeAmmoSaverChance = ammoSaverEnabled ? ammoSaverChance : 0;

  // MH bow display values: displayed RAW / 1.2; displayed element / 10.
  const rawTrue = (weapon.raw + 20) / 1.2; // Attack +3 package.
  const rawCrit = expectedCriticalMultiplier(affinity, 1.40); // Critical Boost.
  const normalCrit = expectedCriticalMultiplier(affinity, 1.25);
  const physicalBase = (rawTrue * rawCharge * distance * shotUp
    * (mvSum / 100) * (matchup.shotHz / 100) * reliability * rawShotMultiplier);
  const physicalElemBuildBase = (rawTrue * rawCharge * distance * shotUp
    * (mvSum / 100) * (matchup.shotHz / 100) * reliability * rawShotMultiplier);
  const rawNoCoat = physicalBase * rawCrit;
  const rawPowerCoated = rawNoCoat * 1.50;
  const rawBuildBaseElement = element ? (effectiveElementValue / 10) * eleCharge
    * (matchup.elementHz / 100) * arrowHits * reliability : 0;
  const rawBuildNoCoat = rawNoCoat + rawBuildBaseElement;
  const rawBuildPowerCoated = rawPowerCoated + rawBuildBaseElement;

  const elemPhysicalNoCoat = physicalElemBuildBase * normalCrit;
  // Element Focus drops shot-type Up from the physical component, but keeps the same elemental skills.
  const elemFocusedPhysicalNoCoat = (physicalElemBuildBase / shotUp) * normalCrit;
  const elemLiteValue = element ? Math.floor(effectiveElementValue * 1.10 + 6) : 0;
  const elemFullValue = element ? Math.floor(effectiveElementValue * 1.20 + 6) : 0;
  const elemCrit = elementAffinityMultiplier(affinity, true);
  const elementalPerValue = (value) => (value / 10) * eleCharge
    * elemCrit * (matchup.elementHz / 100) * arrowHits * reliability;
  const elemFocusedNoCoat = elementalPerValue(elemLiteValue);
  const elemLiteNoCoat = elementalPerValue(elemLiteValue);
  const elemFullNoCoat = elementalPerValue(elemFullValue);
  const elemFocusedCoated = elemFocusedNoCoat * 1.50;
  const elemLiteCoated = elemLiteNoCoat * 1.50;
  const elemFullCoated = elemFullNoCoat * 1.50;

  const expectedUses = (capacity, combineBonus, saverChance) =>
    (capacity + combineBonus) / (1 - saverChance);
  const uptime = (uses) => clamp(uses / missionShots, 0, 1);
  const powerUses = expectedUses(50, 20, activeAmmoSaverChance);
  const elementUsesCoreNow = expectedUses(elementCoatingCapacity, 10, 0);
  const elementUsesCoreProposed = expectedUses(50, 10, 0);
  const elementUsesFullNow = expectedUses(elementCoatingCapacity, 10, activeAmmoSaverChance);
  const elementUsesFullProposed = expectedUses(50, 10, activeAmmoSaverChance);
  const missionAverage = (base, coated, ratio) => base + (coated - base) * ratio;
  const rawMissionAverage = missionAverage(rawBuildNoCoat, rawBuildPowerCoated, uptime(powerUses));
  // Element Focus uses Core's element skills, but has no shot-type Up on its physical component.
  const focusedMissionNow = missionAverage(elemFocusedPhysicalNoCoat + elemFocusedNoCoat,
    elemFocusedPhysicalNoCoat + elemFocusedCoated, uptime(elementUsesCoreNow));
  const focusedMissionProposed = missionAverage(elemFocusedPhysicalNoCoat + elemFocusedNoCoat,
    elemFocusedPhysicalNoCoat + elemFocusedCoated, uptime(elementUsesCoreProposed));
  // Element Core omits Ammo Saver; Full adds one general elemental skill and optionally Ammo Saver.
  const liteMissionNow = missionAverage(elemPhysicalNoCoat + elemLiteNoCoat,
    elemPhysicalNoCoat + elemLiteCoated, uptime(elementUsesCoreNow));
  const liteMissionProposed = missionAverage(elemPhysicalNoCoat + elemLiteNoCoat,
    elemPhysicalNoCoat + elemLiteCoated, uptime(elementUsesCoreProposed));
  const fullMissionNow = missionAverage(elemPhysicalNoCoat + elemFullNoCoat,
    elemPhysicalNoCoat + elemFullCoated, uptime(elementUsesFullNow));
  const fullMissionProposed = missionAverage(elemPhysicalNoCoat + elemFullNoCoat,
    elemPhysicalNoCoat + elemFullCoated, uptime(elementUsesFullProposed));

  // Sequential coating loadout: Element Coat II first, then Power Coat II.
  // The switch cost is an explicit number of shot-equivalents, not an assumed
  // animation duration. Power Coat boosts only the physical component.
  const sequentialHybridAverage = (elementBase, elementCoated, elementUses, powerCoatingMultiplier = 1.50) => {
    const elementShots = Math.min(elementUses, missionShots);
    const switchShots = elementShots > 0 && powerUses > 0 && elementShots < missionShots
      ? Math.min(coatingSwitchShots, missionShots - elementShots) : 0;
    const powerShots = Math.min(powerUses,
      Math.max(0, missionShots - elementShots - switchShots));
    // A switch shot-equivalent is a missed attack window: remove its entire
    // uncoated baseline as well as the coating coverage that cannot be used.
    const activeShotShare = (missionShots - switchShots) / missionShots;
    const damage = (elemPhysicalNoCoat + elementBase) * activeShotShare
      + (elementCoated - elementBase) * (elementShots / missionShots)
      + (elemPhysicalNoCoat * (powerCoatingMultiplier - 1)) * (powerShots / missionShots);
    return { damage, elementShots, powerShots, switchShots, activeShotShare };
  };
  const hybridCurrent = sequentialHybridAverage(elemFullNoCoat,
    elemFullCoated, elementUsesFullNow);
  const hybridCapacity50 = sequentialHybridAverage(elemFullNoCoat,
    elemFullCoated, elementUsesFullProposed);
  const lowCostElementMultiplier = hasElement2 ? 1.50 : 1.35;
  const lowCostPowerMultiplier = hasPower2 ? 1.50 : 1.35;
  const lowCostElementCoated = elemFullNoCoat * lowCostElementMultiplier;
  const hybridLowCostCurrent = sequentialHybridAverage(elemFullNoCoat,
    lowCostElementCoated, elementUsesFullNow, lowCostPowerMultiplier);
  const hybridLowCostCapacity50 = sequentialHybridAverage(elemFullNoCoat,
    lowCostElementCoated, elementUsesFullProposed, lowCostPowerMultiplier);

  return {
    shotType: shot, shotLevel, slot: slotIndex + 1, charge,
    requiresLoadUp: parsed.requiresLoadUp,
    arrowHits, mvSum, affinity, element: element?.type || null,
    elementValue: element?.value || 0, effectiveElementValue,
    elementCap: elementCap ?? null,
    shotHz: matchup.shotHz, elementHz: matchup.elementHz,
    rawPhysicalNoCoat: round(rawNoCoat),
    rawPhysicalPowerCoated: round(rawNoCoat * 1.50),
    rawElementNoCoat: round(rawBuildBaseElement),
    rawIndexNoCoat: round(rawBuildNoCoat),
    elementPhysicalNoCoat: round(elemPhysicalNoCoat),
    elementFocusedPhysicalNoCoat: round(elemFocusedPhysicalNoCoat),
    elementFocusedElementNoCoat: round(elemFocusedNoCoat),
    elementFocusedElementCoated: round(elemFocusedCoated),
    elementLiteElementNoCoat: round(elemLiteNoCoat),
    elementLiteElementCoated: round(elemLiteCoated),
    elementFullElementNoCoat: round(elemFullNoCoat),
    elementFullElementCoated: round(elemFullCoated),
    rawIndexPowerCoated: round(rawBuildPowerCoated),
    elementFocusedNoCoatBase: round(elemFocusedPhysicalNoCoat + elemFocusedNoCoat),
    elementFocusedCoatedBase: round(elemFocusedPhysicalNoCoat + elemFocusedCoated),
    elementLiteNoCoatBase: round(elemPhysicalNoCoat + elemLiteNoCoat),
    elementLiteCoatedBase: round(elemPhysicalNoCoat + elemLiteCoated),
    elementFullNoCoatBase: round(elemPhysicalNoCoat + elemFullNoCoat),
    elementFullCoatedBase: round(elemPhysicalNoCoat + elemFullCoated),
    liteVsRawCoated: round((elemPhysicalNoCoat + elemLiteCoated) / rawBuildPowerCoated),
    fullVsRawCoated: round((elemPhysicalNoCoat + elemFullCoated) / rawBuildPowerCoated),
    rawMissionAverage: round(rawMissionAverage),
    elementFocusedMissionCurrent: round(focusedMissionNow),
    elementFocusedMissionCapacity50: round(focusedMissionProposed),
    elementLiteMissionCurrent: round(liteMissionNow),
    elementLiteMissionCapacity50: round(liteMissionProposed),
    elementFullMissionCurrent: round(fullMissionNow),
    elementFullMissionCapacity50: round(fullMissionProposed),
    elementHybridMissionCurrent: round(hybridCurrent.damage),
    elementHybridMissionCapacity50: round(hybridCapacity50.damage),
    elementHybridLowCostMissionCurrent: round(hybridLowCostCurrent.damage),
    elementHybridLowCostMissionCapacity50: round(hybridLowCostCapacity50.damage),
    focusedMissionVsRaw: round(focusedMissionNow / rawMissionAverage),
    focusedCapacity50VsRaw: round(focusedMissionProposed / rawMissionAverage),
    liteMissionVsRaw: round(liteMissionNow / rawMissionAverage),
    liteCapacity50VsRaw: round(liteMissionProposed / rawMissionAverage),
    fullMissionVsRaw: round(fullMissionNow / rawMissionAverage),
    fullCapacity50VsRaw: round(fullMissionProposed / rawMissionAverage),
    elementHybridMissionVsRaw: round(hybridCurrent.damage / rawMissionAverage),
    elementHybridCapacity50VsRaw: round(hybridCapacity50.damage / rawMissionAverage),
    elementHybridLowCostMissionVsRaw: round(hybridLowCostCurrent.damage / rawMissionAverage),
    elementHybridLowCostCapacity50VsRaw: round(hybridLowCostCapacity50.damage / rawMissionAverage),
    coatings: {
      nativePower1: hasPower1, nativePower2: hasPower2,
      nativeElement1: hasElement1, nativeElement2: hasElement2,
      lowCostElementCoatingLevel: skillCosts.elementHybridLowCost.elementCoatingLevel,
      lowCostPowerCoatingLevel: skillCosts.elementHybridLowCost.powerCoatingLevel,
      lowCostElementMultiplier,
      lowCostPowerMultiplier,
      powerSkillPoints: skillCosts.raw.powerUnlock,
      elementSkillPoints: skillCosts.elementLite.elementUnlock,
      powerExpectedUses: round(powerUses),
      elementCoreExpectedUsesCurrent: round(elementUsesCoreNow),
      elementCoreExpectedUsesCapacity50: round(elementUsesCoreProposed),
      elementFullExpectedUsesCurrent: round(elementUsesFullNow),
      elementFullExpectedUsesCapacity50: round(elementUsesFullProposed),
      powerUptime: round(uptime(powerUses)),
      elementCoreUptimeCurrent: round(uptime(elementUsesCoreNow)),
      elementCoreUptimeCapacity50: round(uptime(elementUsesCoreProposed)),
      elementFullUptimeCurrent: round(uptime(elementUsesFullNow)),
      elementFullUptimeCapacity50: round(uptime(elementUsesFullProposed)),
      hybridPowerExpectedUses: round(powerUses),
      hybridCurrentElementShots: round(hybridCurrent.elementShots),
      hybridCurrentPowerShots: round(hybridCurrent.powerShots),
      hybridCurrentSwitchShots: round(hybridCurrent.switchShots),
      hybridCurrentActiveShotShare: round(hybridCurrent.activeShotShare),
      hybridCapacity50ElementShots: round(hybridCapacity50.elementShots),
      hybridCapacity50PowerShots: round(hybridCapacity50.powerShots),
      hybridCapacity50SwitchShots: round(hybridCapacity50.switchShots),
      hybridCapacity50ActiveShotShare: round(hybridCapacity50.activeShotShare),
      hybridLowCostCurrentElementShots: round(hybridLowCostCurrent.elementShots),
      hybridLowCostCurrentPowerShots: round(hybridLowCostCurrent.powerShots),
      hybridLowCostCurrentSwitchShots: round(hybridLowCostCurrent.switchShots),
      hybridLowCostCurrentActiveShotShare: round(hybridLowCostCurrent.activeShotShare),
      hybridLowCostCapacity50ElementShots: round(hybridLowCostCapacity50.elementShots),
      hybridLowCostCapacity50PowerShots: round(hybridLowCostCapacity50.powerShots),
      hybridLowCostCapacity50SwitchShots: round(hybridLowCostCapacity50.switchShots),
      hybridLowCostCapacity50ActiveShotShare: round(hybridLowCostCapacity50.activeShotShare),
      coatingSwitchShots,
      missionShots,
      ammoSaverChance: activeAmmoSaverChance,
      ammoSaverEnabled,
    },
    skillCosts,
    sensitivity: shot === 'Rapid' ? { rapidReliability: reliability } : null,
    assumptions: 'unrounded damage index; all theoretical hits same part; no Power Shot / style / defense / hit-by-hit HZ distribution',
  };
}

export function calculateSequence(options) {
  const {
    weapon, charge, slotIndex = 2, style = 'none', loadUp = false,
    powerShotUseRate = 1, valorStateUptime = 1, trueShotUp = false, missionShots = 200,
    ...damageOptions
  } = options;
  const supportedStyles = new Set(['none', 'guild', 'adept', 'valor', 'striker', 'alchemy', 'aerial']);
  if (!supportedStyles.has(style)) throw new RangeError('Unsupported bow style: ' + style);
  if (!Number.isFinite(powerShotUseRate) || powerShotUseRate < 0 || powerShotUseRate > 1) {
    throw new RangeError('powerShotUseRate must be between 0 and 1.');
  }
  if (!Number.isFinite(valorStateUptime) || valorStateUptime < 0 || valorStateUptime > 1) {
    throw new RangeError('valorStateUptime must be between 0 and 1.');
  }
  const main = parseCharge(charge);
  if (!main) return null;
  if (main.requiresLoadUp && !loadUp) return null;

  const powerShotCount = style === 'valor' ? 2
    : (style === 'guild' || style === 'adept') ? 1 : 0;
  const effectivePowerShotUseRate = style === 'valor'
    ? powerShotUseRate * valorStateUptime : powerShotUseRate;
  const chargeSlots = (weapon.x?.charges || []).map((value, index, all) =>
    normalizeLoadUpCharge(all, index));
  let powerCharge = charge;
  let powerSlotIndex = slotIndex;
  let powerRequiresLoadUp = main.requiresLoadUp;
  if (powerShotCount && effectivePowerShotUseRate > 0) {
    const nextIndex = slotIndex + 1;
    const nextCharge = chargeSlots[nextIndex];
    const nextParsed = parseCharge(nextCharge);
    if (nextParsed && (!nextParsed.requiresLoadUp || loadUp)) {
      powerCharge = nextCharge;
      powerSlotIndex = nextIndex;
      powerRequiresLoadUp = nextParsed.requiresLoadUp;
    }
  }
  const sequenceRequiresLoadUp = main.requiresLoadUp
    || (effectivePowerShotUseRate > 0 && powerRequiresLoadUp);
  const activeTrueShotUp = trueShotUp && powerShotCount > 0 && effectivePowerShotUseRate > 0;
  const expectedVolleys = 1 + effectivePowerShotUseRate * powerShotCount;
  const effectiveMissionShots = missionShots * expectedVolleys;
  const shared = {
    ...damageOptions, weapon, matchup: options.matchup, loadUp,
    missionShots: effectiveMissionShots,
    loadUpForPackage: sequenceRequiresLoadUp,
    trueShotUp: activeTrueShotUp,
  };
  const primary = calculateShot({
    ...shared, charge, slotIndex, rawShotMultiplier: 1,
  });
  if (!primary) return null;

  const shots = [{ role: 'primary', weight: 1, multiplier: 1, row: primary }];
  if (powerShotCount && effectivePowerShotUseRate > 0) {
    const firstPowerMultiplier = activeTrueShotUp ? 1.20 : 1;
    const power1 = calculateShot({
      ...shared, charge: powerCharge, slotIndex: powerSlotIndex,
      rawShotMultiplier: firstPowerMultiplier,
    });
    if (power1) shots.push({
      role: 'powerShot', weight: effectivePowerShotUseRate,
      multiplier: firstPowerMultiplier, row: power1,
    });
    if (style === 'valor') {
      const secondMultiplier = firstPowerMultiplier * 1.30;
      const power2 = calculateShot({
        ...shared, charge: powerCharge, slotIndex: powerSlotIndex,
        rawShotMultiplier: secondMultiplier,
      });
      if (power2) shots.push({
        role: 'valorPowerShot', weight: effectivePowerShotUseRate,
        multiplier: secondMultiplier, row: power2,
      });
    }
  }

  const add = key => round(sum(shots.map(shot => shot.row[key] * shot.weight)));
  const rawMissionAverage = add('rawMissionAverage');
  const focusedMission = add('elementFocusedMissionCurrent');
  const focusedMission50 = add('elementFocusedMissionCapacity50');
  const liteMission = add('elementLiteMissionCurrent');
  const liteMission50 = add('elementLiteMissionCapacity50');
  const fullMission = add('elementFullMissionCurrent');
  const fullMission50 = add('elementFullMissionCapacity50');
  const hybridMission = add('elementHybridMissionCurrent');
  const hybridMission50 = add('elementHybridMissionCapacity50');
  const hybridLowCostMission = add('elementHybridLowCostMissionCurrent');
  const hybridLowCostMission50 = add('elementHybridLowCostMissionCapacity50');
  const rawIndex = add('rawIndexNoCoat');
  const rawCoated = add('rawIndexPowerCoated');
  return {
    ...primary,
    style,
    powerShotCount,
    powerShotUseRate,
    valorStateUptime,
    effectivePowerShotUseRate,
    expectedVolleysPerSequence: round(expectedVolleys),
    powerShotCharge: effectivePowerShotUseRate > 0 ? powerCharge : null,
    powerShotSlot: effectivePowerShotUseRate > 0 ? powerSlotIndex + 1 : null,
    powerShotRequiresLoadUp: effectivePowerShotUseRate > 0 ? powerRequiresLoadUp : false,
    sequenceRequiresLoadUp,
    trueShotUp: activeTrueShotUp,
    rawIndexNoCoat: rawIndex,
    rawIndexPowerCoated: rawCoated,
    rawMissionAverage,
    elementFocusedMissionCurrent: focusedMission,
    elementFocusedMissionCapacity50: focusedMission50,
    elementLiteMissionCurrent: liteMission,
    elementLiteMissionCapacity50: liteMission50,
    elementFullMissionCurrent: fullMission,
    elementFullMissionCapacity50: fullMission50,
    elementHybridMissionCurrent: hybridMission,
    elementHybridMissionCapacity50: hybridMission50,
    elementHybridLowCostMissionCurrent: hybridLowCostMission,
    elementHybridLowCostMissionCapacity50: hybridLowCostMission50,
    focusedMissionVsRaw: round(focusedMission / rawMissionAverage),
    focusedCapacity50VsRaw: round(focusedMission50 / rawMissionAverage),
    liteMissionVsRaw: round(liteMission / rawMissionAverage),
    liteCapacity50VsRaw: round(liteMission50 / rawMissionAverage),
    fullMissionVsRaw: round(fullMission / rawMissionAverage),
    fullCapacity50VsRaw: round(fullMission50 / rawMissionAverage),
    elementHybridMissionVsRaw: round(hybridMission / rawMissionAverage),
    elementHybridCapacity50VsRaw: round(hybridMission50 / rawMissionAverage),
    elementHybridLowCostMissionVsRaw: round(hybridLowCostMission / rawMissionAverage),
    elementHybridLowCostCapacity50VsRaw: round(hybridLowCostMission50 / rawMissionAverage),
    arrowHits: round(sum(shots.map(shot => shot.row.arrowHits * shot.weight))),
    mvSum: round(sum(shots.map(shot => shot.row.mvSum * shot.weight))),
    skillCosts: primary.skillCosts,
    coatings: {
      ...primary.coatings,
      missionShots,
      expectedVolleysPerSequence: round(expectedVolleys),
      effectiveMissionVolleys: round(effectiveMissionShots),
    },
    breakdown: shots.map(shot => ({
      role: shot.role, weight: shot.weight, charge: shot.row.charge,
      slot: shot.row.slot, arrowHits: shot.row.arrowHits,
      mvSum: shot.row.mvSum, rawMultiplier: shot.multiplier,
    })),
    assumptions: 'sequence index; expected Power Shot frequency; all theoretical hits share same part; no frame-by-frame hit distribution',
  };
}

function weaponRows(trees, options = {}) {
  const rows = [];
  for (const tree of trees) {
    for (const level of tree.levels || []) {
      const element = elementOf(level);
      if (!element) continue;
      const weapon = { ...level, x: level.x || {}, aff: level.aff || 0 };
      const rarity = level.rar ?? tree.rarity;
      const chargeSlots = level.x?.charges || [];
      for (const [slotIndex, sourceCharge] of chargeSlots.entries()) {
        const charge = normalizeLoadUpCharge(chargeSlots, slotIndex);
        const parsed = parseCharge(charge);
        if (!parsed) continue;
        if (parsed.requiresLoadUp && !options.includeLoadUp) continue;
        for (const matchup of MATCHUPS) {
          const base = calculateSequence({
            weapon, charge, matchup, slotIndex, loadUp: options.includeLoadUp,
            elementCharge: ELEMENT_CHARGE.base,
            elementCap: options.elementCap ?? null,
            missionShots: options.missionShots ?? 200,
            ammoSaverChance: options.ammoSaverChance ?? 0,
            ammoSaverEnabled: options.ammoSaverEnabled ?? (options.ammoSaverChance > 0),
            elementCoatingCapacity: options.elementCoatingCapacity ?? 20,
            coatingSwitchShots: options.coatingSwitchShots ?? 0,
            rapidReliability: options.rapidReliability ?? 1,
            style: options.style ?? 'guild',
            powerShotUseRate: options.powerShotUseRate ?? 1,
            valorStateUptime: options.valorStateUptime ?? 1,
            trueShotUp: options.trueShotUp ?? false,
          });
          if (!base) continue;
          const scenarioA = calculateSequence({
            weapon, charge, matchup, slotIndex, loadUp: options.includeLoadUp,
            elementCharge: ELEMENT_CHARGE.A,
            elementCap: options.elementCap ?? null,
            missionShots: options.missionShots ?? 200,
            ammoSaverChance: options.ammoSaverChance ?? 0,
            ammoSaverEnabled: options.ammoSaverEnabled ?? (options.ammoSaverChance > 0),
            elementCoatingCapacity: options.elementCoatingCapacity ?? 20,
            coatingSwitchShots: options.coatingSwitchShots ?? 0,
            rapidReliability: options.rapidReliability ?? 1,
            style: options.style ?? 'guild',
            powerShotUseRate: options.powerShotUseRate ?? 1,
            valorStateUptime: options.valorStateUptime ?? 1,
            trueShotUp: options.trueShotUp ?? false,
          });
          const scenarioB = calculateSequence({
            weapon, charge, matchup, slotIndex, loadUp: options.includeLoadUp,
            elementCharge: ELEMENT_CHARGE.B,
            elementCap: options.elementCap ?? null,
            missionShots: options.missionShots ?? 200,
            ammoSaverChance: options.ammoSaverChance ?? 0,
            ammoSaverEnabled: options.ammoSaverEnabled ?? (options.ammoSaverChance > 0),
            elementCoatingCapacity: options.elementCoatingCapacity ?? 20,
            coatingSwitchShots: options.coatingSwitchShots ?? 0,
            rapidReliability: options.rapidReliability ?? 1,
            style: options.style ?? 'guild',
            powerShotUseRate: options.powerShotUseRate ?? 1,
            valorStateUptime: options.valorStateUptime ?? 1,
            trueShotUp: options.trueShotUp ?? false,
          });
          rows.push({
            rank: rankFromRarity(rarity), rarity, treeId: tree.id, treeName: tree.nameEs || tree.name,
            weaponName: level.nEs || level.n, level: level.lv,
            raw: level.raw, affinity: level.aff || 0,
            ...base,
            catalogueCharge: sourceCharge,
            loadUpTypeCorrected: charge !== sourceCharge,
            A_liteMissionVsRaw: scenarioA.liteMissionVsRaw,
            A_fullMissionVsRaw: scenarioA.fullMissionVsRaw,
            B_liteMissionVsRaw: scenarioB.liteMissionVsRaw,
            B_fullMissionVsRaw: scenarioB.fullMissionVsRaw,
            A_hybridMissionVsRaw: scenarioA.elementHybridMissionVsRaw,
            B_hybridMissionVsRaw: scenarioB.elementHybridMissionVsRaw,
            A_hybridPowerShots: scenarioA.coatings.hybridCurrentPowerShots,
            B_hybridPowerShots: scenarioB.coatings.hybridCurrentPowerShots,
            A_hybridSwitchShots: scenarioA.coatings.hybridCurrentSwitchShots,
            B_hybridSwitchShots: scenarioB.coatings.hybridCurrentSwitchShots,
            A_hybridLowCostPowerShots: scenarioA.coatings.hybridLowCostCurrentPowerShots,
            B_hybridLowCostPowerShots: scenarioB.coatings.hybridLowCostCurrentPowerShots,
            A_hybridLowCostSwitchShots: scenarioA.coatings.hybridLowCostCurrentSwitchShots,
            B_hybridLowCostSwitchShots: scenarioB.coatings.hybridLowCostCurrentSwitchShots,
            A_hybridLowCostMissionVsRaw: scenarioA.elementHybridLowCostMissionVsRaw,
            B_hybridLowCostMissionVsRaw: scenarioB.elementHybridLowCostMissionVsRaw,
            A_liteCapacity50VsRaw: scenarioA.liteCapacity50VsRaw,
            A_fullCapacity50VsRaw: scenarioA.fullCapacity50VsRaw,
            B_liteCapacity50VsRaw: scenarioB.liteCapacity50VsRaw,
            B_fullCapacity50VsRaw: scenarioB.fullCapacity50VsRaw,
            A_hybridCapacity50VsRaw: scenarioA.elementHybridCapacity50VsRaw,
            B_hybridCapacity50VsRaw: scenarioB.elementHybridCapacity50VsRaw,
            A_hybridLowCostCapacity50VsRaw: scenarioA.elementHybridLowCostCapacity50VsRaw,
            B_hybridLowCostCapacity50VsRaw: scenarioB.elementHybridLowCostCapacity50VsRaw,
          });
        }
      }
    }
  }
  return rows;
}

function allWeaponCharges(database, options = {}) {
  const candidates = [];
  for (const tree of database.trees || []) {
    for (const level of tree.levels || []) {
      const weapon = { ...level, x: level.x || {}, aff: level.aff || 0 };
      const rarity = level.rar ?? tree.rarity;
      const chargeSlots = level.x?.charges || [];
      for (const [slotIndex, sourceCharge] of chargeSlots.entries()) {
        const charge = normalizeLoadUpCharge(chargeSlots, slotIndex);
        const parsed = parseCharge(charge);
        if (!parsed || (parsed.requiresLoadUp && !options.includeLoadUp)) continue;
        candidates.push({
          rank: rankFromRarity(rarity), rarity, treeId: tree.id,
          treeName: tree.nameEs || tree.name, weaponName: level.nEs || level.n,
          level: level.lv, weapon, charge, sourceCharge, loadUpTypeCorrected: charge !== sourceCharge, slotIndex,
        });
      }
    }
  }
  return candidates;
}

/**
 * Compare catalogue-wide best RAW and elemental bows against every part in
 * the first hitzone table of each large monster. The hitzone data are supplied
 * by the caller; only decoded numeric values are consumed.
 *
 * All arrows / Pierce contacts are still assumed to hit the same part, so
 * this remains an optimistic damage index, not measured hunt DPS.
 */
export function runMonsterMatrix(database, monsterData, options = {}) {
  const candidates = allWeaponCharges(database, {
    includeLoadUp: options.includeLoadUp ?? true,
  });
  const candidatesByRank = Object.fromEntries(["LR", "HR", "G"].map(rank => [
    rank,
    candidates.filter(candidate => candidate.rank === rank)
  ]));
  const scenarios = [
    { id: "base", multipliers: ELEMENT_CHARGE.base },
    { id: "A", multipliers: ELEMENT_CHARGE.A },
    { id: "B", multipliers: ELEMENT_CHARGE.B },
  ];
  const shotTypes = ["Rapid", "Pierce", "Spread", "Heavy"];
  const profileKeys = ["elementalFocused", "elementalFocused50", "elementalLite", "elementalFull", "elementalLite50", "elementalFull50", "elementalHybrid", "elementalHybrid50", "elementalHybridLowCost", "elementalHybridLowCost50"];
  const byRankMonster = [];
  const largeMonsters = (monsterData.monsters || []).filter(monster => monster.large);

  const makeBestSet = () => Object.fromEntries(scenarios.map(({ id }) => [id, {
    raw: null,
    elementalFocused: null,
    elementalFocused50: null,
    elementalLite: null,
    elementalFull: null,
    elementalLite50: null,
    elementalFull50: null,
    elementalHybrid: null,
    elementalHybrid50: null,
    elementalHybridLowCost: null,
    elementalHybridLowCost50: null,
  }]));

  const finalizeBestSet = (bestSet) => {
    for (const scenario of scenarios) {
      const result = bestSet[scenario.id];
      const rawDamage = result.raw?.damage || 0;
      for (const key of profileKeys) {
        const selected = result[key];
        result[key] = selected && rawDamage > 0
          ? {
            ...selected,
            vsRaw: round(selected.damage / rawDamage),
            rawWeapon: result.raw.weapon,
            rawTree: result.raw.tree,
            rawLevel: result.raw.level,
            rawCharge: result.raw.charge,
            rawPart: result.raw.part,
            rawDamage: result.raw.damage,
          }
          : selected ? { ...selected, vsRaw: null } : null;
      }
    }
  };

  const recordCandidate = (current, row, info) => {
    if (!current.raw || row.rawMissionAverage > current.raw.damage) {
      current.raw = { ...info, damage: row.rawMissionAverage };
    }
    if (!row.element || row.elementHz <= 0) return;
    const choices = [
      ["elementalFocused", row.elementFocusedMissionCurrent],
      ["elementalFocused50", row.elementFocusedMissionCapacity50],
      ["elementalLite", row.elementLiteMissionCurrent],
      ["elementalFull", row.elementFullMissionCurrent],
      ["elementalLite50", row.elementLiteMissionCapacity50],
      ["elementalFull50", row.elementFullMissionCapacity50],
      ["elementalHybrid", row.elementHybridMissionCurrent],
      ["elementalHybrid50", row.elementHybridMissionCapacity50],
      ["elementalHybridLowCost", row.elementHybridLowCostMissionCurrent],
      ["elementalHybridLowCost50", row.elementHybridLowCostMissionCapacity50],
    ];
    for (const [key, damage] of choices) {
      if (!current[key] || damage > current[key].damage) {
        current[key] = { ...info, damage };
      }
    }
  };

  const chooseBestComparison = (partRows, scenarioId, key) => {
    const eligible = partRows
      .map(partRow => partRow.scenarios[scenarioId][key])
      .filter(row => Number.isFinite(row?.vsRaw));
    if (!eligible.length) return null;
    return eligible.reduce((best, row) => !best || row.vsRaw > best.vsRaw ? row : best, null);
  };

  const chooseBestRaw = (partRows, scenarioId) => {
    const eligible = partRows
      .map(partRow => partRow.scenarios[scenarioId].raw)
      .filter(row => Number.isFinite(row?.damage));
    if (!eligible.length) return null;
    return eligible.reduce((best, row) => !best || row.damage > best.damage ? row : best, null);
  };

  for (const rank of ["LR", "HR", "G"]) {
    for (const monster of largeMonsters) {
      const parts = monster.tables?.[0] || [];
      const partRows = [];

      for (const [partIndex, part] of parts.entries()) {
        const shotHz = Number(part[4]) || 0;
        const partName = part[1] || ("Parte " + (part[0] ?? partIndex));
        const best = makeBestSet();
        const bestByShotType = Object.fromEntries(
          shotTypes.map(type => [type, makeBestSet()])
        );

        for (const candidate of candidatesByRank[rank]) {
          const element = elementOf(candidate.weapon);
          const elementHz = element ? (Number(part[ELEMENT_INDEX[element.type]]) || 0) : 0;
          const matchup = { shotHz, elementHz };

          for (const scenario of scenarios) {
            const row = calculateSequence({
              weapon: candidate.weapon,
              charge: candidate.charge,
              matchup,
              slotIndex: candidate.slotIndex,
              loadUp: options.includeLoadUp ?? true,
              elementCharge: scenario.multipliers,
              missionShots: options.missionShots ?? 200,
              ammoSaverChance: options.ammoSaverChance ?? 0,
              ammoSaverEnabled: options.ammoSaverEnabled ?? (options.ammoSaverChance > 0),
              elementCoatingCapacity: options.elementCoatingCapacity ?? 20,
              coatingSwitchShots: options.coatingSwitchShots ?? 0,
              rapidReliability: options.rapidReliability ?? 1,
              style: options.style ?? "guild",
              powerShotUseRate: options.powerShotUseRate ?? 1,
              valorStateUptime: options.valorStateUptime ?? 1,
              trueShotUp: options.trueShotUp ?? false,
              elementCap: options.elementCap ?? null,
            });
            if (!row) continue;

            const info = {
              weapon: candidate.weaponName,
              tree: candidate.treeId,
              level: candidate.level,
              charge: candidate.charge,
              catalogueCharge: candidate.sourceCharge,
              loadUpTypeCorrected: candidate.loadUpTypeCorrected,
              slot: candidate.slotIndex + 1,
              shotType: row.shotType,
              shotLevel: row.shotLevel,
              part: partName,
              partIndex,
              style: row.style,
              powerShotCount: row.powerShotCount,
              powerShotUseRate: row.powerShotUseRate,
              valorStateUptime: row.valorStateUptime,
              effectivePowerShotUseRate: row.effectivePowerShotUseRate,
              powerShotCharge: row.powerShotCharge,
              powerShotSlot: row.powerShotSlot,
              breakdown: row.breakdown,
              shotHz,
              elementHz: element ? elementHz : 0,
              element: element?.type || null,
              catalogElementValue: row.elementValue,
              effectiveElementValue: row.effectiveElementValue,
              elementCap: row.elementCap,
              skillCosts: row.skillCosts,
            };

            recordCandidate(best[scenario.id], row, info);
            recordCandidate(bestByShotType[row.shotType][scenario.id], row, info);
          }
        }

        finalizeBestSet(best);
        for (const type of shotTypes) finalizeBestSet(bestByShotType[type]);
        partRows.push({
          partIndex,
          part: partName,
          shotHz,
          scenarios: best,
          byShotType: bestByShotType,
        });
      }

      // The summary winner for each profile is selected by elemental/RAW ratio
      // only after both candidates have been evaluated on the exact same part.
      // The full part breakdown remains available for analysis and auditing.
      const best = makeBestSet();
      const bestByShotType = Object.fromEntries(
        shotTypes.map(type => [type, makeBestSet()])
      );

      for (const scenario of scenarios) {
        best[scenario.id].raw = chooseBestRaw(partRows, scenario.id);
        for (const key of profileKeys) {
          best[scenario.id][key] = chooseBestComparison(partRows, scenario.id, key);
        }

        for (const type of shotTypes) {
          const typedRows = partRows.map(partRow => ({
            scenarios: partRow.byShotType[type],
          }));
          bestByShotType[type][scenario.id].raw = chooseBestRaw(typedRows, scenario.id);
          for (const key of profileKeys) {
            bestByShotType[type][scenario.id][key] = chooseBestComparison(typedRows, scenario.id, key);
          }
        }
      }

      // Keep the full per-part ratio distribution compact. Serializing every
      // candidate row (all skill fields, volleys and breakdowns) for every part
      // made the JSON exceed Node's maximum string length in CI.
      const makePartStatSet = () => Object.fromEntries(
        scenarios.map(({ id }) => [id, Object.fromEntries(profileKeys.map(key => [key, []]))])
      );
      const partStats = {
        scenarios: makePartStatSet(),
        byShotType: Object.fromEntries(shotTypes.map(type => [type, makePartStatSet()])),
      };
      const collectPartStats = (target, partRow, selector) => {
        for (const scenario of scenarios) {
          for (const key of profileKeys) {
            const selected = selector(partRow, scenario.id, key);
            if (!Number.isFinite(selected?.vsRaw)) continue;
            target[scenario.id][key].push({
              part: partRow.part,
              elementHz: selected.elementHz,
              ratio: selected.vsRaw,
            });
          }
        }
      };
      for (const partRow of partRows) {
        collectPartStats(partStats.scenarios, partRow,
          (row, scenarioId, key) => row.scenarios[scenarioId][key]);
        for (const type of shotTypes) {
          collectPartStats(partStats.byShotType[type], partRow,
            (row, scenarioId, key) => row.byShotType[type][scenarioId][key]);
        }
      }

      byRankMonster.push({
        rank,
        monster: monster.name,
        tablesAvailable: monster.tables?.length || 0,
        partsEvaluated: parts.length,
        scenarios: best,
        byShotType: bestByShotType,
        partStats,
      });
    }
  }

  return {
    metadata: {
      largeMonsters: largeMonsters.length,
      candidates: candidates.length,
      loadUpDiagnostics: loadUpDiagnostics(database),
      ranks: ["LR", "HR", "G"],
      shotTypes,
      hitzoneTable: "first table only; parallel tables remain unlabelled",
      options: {
        includeLoadUp: options.includeLoadUp ?? true,
        missionShots: options.missionShots ?? 200,
        ammoSaverChance: options.ammoSaverChance ?? 0,
        ammoSaverEnabled: options.ammoSaverEnabled ?? (options.ammoSaverChance > 0),
        elementCoatingCapacity: options.elementCoatingCapacity ?? 20,
        coatingSwitchShots: options.coatingSwitchShots ?? 0,
        rapidReliability: options.rapidReliability ?? 1,
        style: options.style ?? "guild",
        powerShotUseRate: options.powerShotUseRate ?? 1,
        valorStateUptime: options.valorStateUptime ?? 1,
        trueShotUp: options.trueShotUp ?? false,
        elementCap: options.elementCap ?? null,
      },
      note: "Each ratio compares RAW and elemental winners on the same monster part. The per-monster summary selects the part with the highest elemental-to-RAW ratio; full part-level results are retained. Theoretical hits share that part; not actual DPS.",
    },
    results: byRankMonster,
  };
}
function bestBy(rows, valueKey) {
  return rows.reduce((best, row) => !best || row[valueKey] > best[valueKey] ? row : best, null);
}

export function summarizeRows(rows) {
  const groups = new Map();
  for (const row of rows) {
    const key = [row.rank, row.element, row.shotType, row.matchupId].join('|');
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }
  const out = [];
  for (const group of groups.values()) {
    const first = group[0];
    const bLite = bestBy(group, 'liteMissionVsRaw');
    const bFull = bestBy(group, 'fullMissionVsRaw');
    const bHybrid = bestBy(group, 'elementHybridMissionVsRaw');
    const bHybridLowCost = bestBy(group, 'elementHybridLowCostMissionVsRaw');
    const bA = bestBy(group, 'A_fullMissionVsRaw');
    const bB = bestBy(group, 'B_fullMissionVsRaw');
    const bHybridA = bestBy(group, 'A_hybridMissionVsRaw');
    const bHybridB = bestBy(group, 'B_hybridMissionVsRaw');
    const bA50 = bestBy(group, 'A_fullCapacity50VsRaw');
    const bB50 = bestBy(group, 'B_fullCapacity50VsRaw');
    const bHybridA50 = bestBy(group, 'A_hybridCapacity50VsRaw');
    const bHybridB50 = bestBy(group, 'B_hybridCapacity50VsRaw');
    const bHybridLowCostA = bestBy(group, 'A_hybridLowCostMissionVsRaw');
    const bHybridLowCostB = bestBy(group, 'B_hybridLowCostMissionVsRaw');
    out.push({
      rank: first.rank, element: first.element, shotType: first.shotType, matchup: first.matchup,
      style: first.style, powerShotCount: first.powerShotCount,
      powerShotUseRate: first.powerShotUseRate,
      valorStateUptime: first.valorStateUptime,
      candidates: group.length,
      bestLite: bLite ? { weapon: bLite.weaponName, lv: bLite.level, slot: bLite.slot,
        ratioCurrent: bLite.liteMissionVsRaw, skillCosts: bLite.skillCosts } : null,
      bestFull: bFull ? { weapon: bFull.weaponName, lv: bFull.level, slot: bFull.slot,
        ratioCurrent: bFull.fullMissionVsRaw, skillCosts: bFull.skillCosts } : null,
      bestHybrid: bHybrid ? { weapon: bHybrid.weaponName, lv: bHybrid.level, slot: bHybrid.slot,
        ratioCurrent: bHybrid.elementHybridMissionVsRaw, skillCosts: bHybrid.skillCosts.elementHybrid } : null,
      bestHybridLowCost: bHybridLowCost ? { weapon: bHybridLowCost.weaponName, lv: bHybridLowCost.level,
        slot: bHybridLowCost.slot, ratioCurrent: bHybridLowCost.elementHybridLowCostMissionVsRaw,
        skillCosts: bHybridLowCost.skillCosts.elementHybridLowCost } : null,
      bestScenarioA: bA ? { weapon: bA.weaponName, lv: bA.level, slot: bA.slot,
        ratio: bA.A_fullMissionVsRaw, skillCosts: bA.skillCosts } : null,
      bestScenarioB: bB ? { weapon: bB.weaponName, lv: bB.level, slot: bB.slot,
        ratio: bB.B_fullMissionVsRaw, skillCosts: bB.skillCosts } : null,
      bestScenarioAHybrid: bHybridA ? { weapon: bHybridA.weaponName, lv: bHybridA.level, slot: bHybridA.slot,
        ratio: bHybridA.A_hybridMissionVsRaw, skillCosts: bHybridA.skillCosts.elementHybrid } : null,
      bestScenarioBHybrid: bHybridB ? { weapon: bHybridB.weaponName, lv: bHybridB.level, slot: bHybridB.slot,
        ratio: bHybridB.B_hybridMissionVsRaw, skillCosts: bHybridB.skillCosts.elementHybrid } : null,
      bestScenarioALowCostHybrid: bHybridLowCostA ? { weapon: bHybridLowCostA.weaponName, lv: bHybridLowCostA.level,
        slot: bHybridLowCostA.slot, ratio: bHybridLowCostA.A_hybridLowCostMissionVsRaw,
        skillCosts: bHybridLowCostA.skillCosts.elementHybridLowCost } : null,
      bestScenarioBLowCostHybrid: bHybridLowCostB ? { weapon: bHybridLowCostB.weaponName, lv: bHybridLowCostB.level,
        slot: bHybridLowCostB.slot, ratio: bHybridLowCostB.B_hybridLowCostMissionVsRaw,
        skillCosts: bHybridLowCostB.skillCosts.elementHybridLowCost } : null,
      bestFullCapacity50: bestBy(group, 'fullCapacity50VsRaw')
        ? bestBy(group, 'fullCapacity50VsRaw').fullCapacity50VsRaw : null,
      bestScenarioACapacity50: bA50 ? bA50.A_fullCapacity50VsRaw : null,
      bestScenarioBCapacity50: bB50 ? bB50.B_fullCapacity50VsRaw : null,
      bestHybridCapacity50: bestBy(group, 'elementHybridCapacity50VsRaw')
        ? bestBy(group, 'elementHybridCapacity50VsRaw').elementHybridCapacity50VsRaw : null,
      bestScenarioAHybridCapacity50: bHybridA50 ? bHybridA50.A_hybridCapacity50VsRaw : null,
      bestScenarioBHybridCapacity50: bHybridB50 ? bHybridB50.B_hybridCapacity50VsRaw : null,
      bestHybridLowCostCapacity50: bestBy(group, 'elementHybridLowCostCapacity50VsRaw')
        ? bestBy(group, 'elementHybridLowCostCapacity50VsRaw').elementHybridLowCostCapacity50VsRaw : null,
    });
  }
  return out.sort((a, b) => a.rank.localeCompare(b.rank)
    || a.element.localeCompare(b.element)
    || a.shotType.localeCompare(b.shotType)
    || a.matchup.localeCompare(b.matchup));
}

export function runMatrix(database, options = {}) {
  const rows = weaponRows(database.trees || [], { includeLoadUp: options.includeLoadUp ?? true, ...options });
  // Keep matchup metadata on rows for grouping and export.
  for (const row of rows) {
    const match = MATCHUPS.find(x => x.shotHz === row.shotHz && x.elementHz === row.elementHz);
    row.matchupId = match?.id || 'custom';
    row.matchup = match?.label || 'Custom';
  }
  return { rows, summary: summarizeRows(rows) };
}

function csv(rows) {
  if (!rows.length) return '';
  const headers = Object.keys(rows[0]);
  const quote = (v) => {
    const value = typeof v === 'object' ? JSON.stringify(v) : String(v ?? '');
    return /[",\n]/.test(value) ? '"' + value.replaceAll('"', '""') + '"' : value;
  };
  return [headers.join(','), ...rows.map(row => headers.map(h => quote(row[h])).join(','))].join('\n');
}

const here = path.dirname(fileURLToPath(import.meta.url));
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const input = path.resolve(here, '../data/weapons/bow.json');
  const database = JSON.parse(readFileSync(input, 'utf8'));
  const readNumber = (prefix, fallback) => {
    const raw = args.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
    if (raw === undefined) return fallback;
    const value = Number(raw);
    return Number.isFinite(value) ? value : fallback;
  };
  const options = {
    includeLoadUp: !args.includes('--no-load-up'),
    missionShots: readNumber('--mission-shots=', 200),
    rapidReliability: readNumber('--rapid-reliability=', 1),
    ammoSaverChance: readNumber('--ammo-saver-chance=', 0),
    ammoSaverEnabled: args.includes('--ammo-saver') || readNumber('--ammo-saver-chance=', 0) > 0,
    elementCoatingCapacity: readNumber('--element-coat-capacity=', 20),
    coatingSwitchShots: readNumber('--coating-switch-shots=', 0),
    powerShotUseRate: readNumber('--power-shot-use-rate=', 1),
    valorStateUptime: readNumber('--valor-uptime=', 1),
    style: args.find((arg) => arg.startsWith('--style='))?.slice(8) || 'guild',
    trueShotUp: args.includes('--true-shot-up'),
  };
  const elementCapArg = args.find((arg) => arg.startsWith('--element-cap='));
  if (elementCapArg) {
    const cap = Number(elementCapArg.slice('--element-cap='.length));
    if (!Number.isFinite(cap) || cap < 0) throw new Error('--element-cap must be zero or greater.');
    options.elementCap = cap;
  }
  const hitzonesPath = args.find((arg) => arg.startsWith('--hitzones='))?.slice(11);
  if (hitzonesPath) {
    const source = readFileSync(path.resolve(hitzonesPath), 'utf8').trim();
    let monsterData;
    try {
      monsterData = JSON.parse(source);
    } catch {
      const assignment = 'window.MONSTER_DATA =';
      const start = source.indexOf(assignment);
      const end = source.lastIndexOf(';');
      if (start < 0) throw new Error('Hitzone file must be JSON or expose window.MONSTER_DATA = JSON.');
      monsterData = JSON.parse(source.slice(start + assignment.length, end > start ? end : undefined).trim());
    }
    const result = runMonsterMatrix(database, monsterData, options);
    if (args.includes('--monster-summary')) {
      process.stdout.write(JSON.stringify(result, null, 2) + '\n');
    } else {
      const out = args.find(a => a.startsWith('--monster-csv='))?.slice(14)
        || path.resolve(here, 'out/bow-elemental-monster-matchups.csv');
      mkdirSync(path.dirname(out), { recursive: true });
      writeFileSync(out, csv(result.results));
      process.stdout.write('Monster CSV written: ' + out + '\nRows: ' + result.results.length + '\n');
    }
  } else {
    const { rows, summary } = runMatrix(database, options);
    if (args.includes('--summary')) {
      process.stdout.write(JSON.stringify({
        metadata: {
          weaponLevels: rows.length,
          elementalLevels: database.trees.reduce((n, t) => n + (t.levels || []).filter(elementOf).length, 0),
          loadUpDiagnostics: loadUpDiagnostics(database),
          ranks: ['LR', 'HR', 'G'],
          matchups: MATCHUPS,
          options,
          note: 'Index comparison, not exact DPS. See docs/BOW_ELEMENTAL_SIMULATOR_STAGE5.md.',
        },
        summary,
      }, null, 2) + '\n');
    } else {
      const out = args.find(a => a.startsWith('--csv='))?.slice(6)
        || path.resolve(here, 'out/bow-elemental-scenarios.csv');
      mkdirSync(path.dirname(out), { recursive: true });
      writeFileSync(out, csv(rows));
      process.stdout.write('CSV written: ' + out + '\nRows: ' + rows.length + '\n');
    }
  }
}
