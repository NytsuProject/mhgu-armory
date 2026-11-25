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

function skillCost(weapon, requiresLoadUp) {
  const nativePower2 = hasCoating(weapon, 'Power Coating 2');
  const nativeElement2 = hasCoating(weapon, 'Element Coating 2');
  const powerUnlock = nativePower2 ? 0 : 15;
  const elementUnlock = nativeElement2 ? 0 : 15;
  const loadUp = requiresLoadUp ? 10 : 0;
  const raw = {
    points: 20 + 20 + 10 + 10 + 10 + 10 + powerUnlock + loadUp,
    skills: 6 + Number(!nativePower2) + Number(requiresLoadUp),
    powerUnlock, loadUp,
  };
  // Element Core keeps the same six core skill lines as RAW and retains Attack +3.
  // It trades Critical Boost / Ammo Saver for Critical Element / element +2.
  const elementLite = {
    points: 20 + 20 + 10 + 10 + 10 + 15 + elementUnlock + loadUp,
    skills: 6 + Number(!nativeElement2) + Number(requiresLoadUp),
    elementUnlock, loadUp,
  };
  // Full adds Ammo Saver and general Elemental +1 (two extra skill lines).
  const elementFull = {
    points: elementLite.points + 10 + 10,
    skills: elementLite.skills + 2,
    elementUnlock, loadUp,
  };
  return { raw, elementLite, elementFull };
}

/**
 * Calculates one charge's unrounded damage index under three explicit skill
 * packages. All theoretical arrows / Pierce contacts are assumed to hit the
 * same requested part. This is deliberately an upper-bound comparison.
 */
export function calculateShot(options) {
  const {
    weapon, charge, matchup, elementCharge = ELEMENT_CHARGE.base,
    rapidReliability = 1, missionShots = 200, ammoSaverChance = 0.20,
    elementCoatingCapacity = 20, loadUp = false, slotIndex = 2,
  } = options;
  const parsed = parseCharge(charge);
  const element = elementOf(weapon);
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
  const hasElement2 = weaponCoatings.includes('Element Coating 2');
  const skillCosts = skillCost(weapon, parsed.requiresLoadUp);

  // MH bow display values: displayed RAW / 1.2; displayed element / 10.
  const rawTrue = (weapon.raw + 20) / 1.2; // Attack +3 package.
  const rawCrit = expectedCriticalMultiplier(affinity, 1.40); // Critical Boost.
  const normalCrit = expectedCriticalMultiplier(affinity, 1.25);
  const physicalBase = (rawTrue * rawCharge * distance * shotUp
    * (mvSum / 100) * (matchup.shotHz / 100) * reliability);
  const physicalElemBuildBase = (rawTrue * rawCharge * distance * shotUp
    * (mvSum / 100) * (matchup.shotHz / 100) * reliability);
  const rawNoCoat = physicalBase * rawCrit;
  const rawPowerCoated = rawNoCoat * 1.50;
  const rawBuildBaseElement = element ? (element.value / 10) * eleCharge
    * (matchup.elementHz / 100) * arrowHits * reliability : 0;
  const rawBuildNoCoat = rawNoCoat + rawBuildBaseElement;
  const rawBuildPowerCoated = rawPowerCoated + rawBuildBaseElement;

  const elemPhysicalNoCoat = physicalElemBuildBase * normalCrit;
  const elemLiteValue = element ? Math.floor(element.value * 1.10 + 6) : 0;
  const elemFullValue = element ? Math.floor(element.value * 1.20 + 6) : 0;
  const elemCrit = elementAffinityMultiplier(affinity, true);
  const elementalPerValue = (value) => (value / 10) * eleCharge
    * elemCrit * (matchup.elementHz / 100) * arrowHits * reliability;
  const elemLiteNoCoat = elementalPerValue(elemLiteValue);
  const elemFullNoCoat = elementalPerValue(elemFullValue);
  const elemLiteCoated = elemLiteNoCoat * 1.50;
  const elemFullCoated = elemFullNoCoat * 1.50;

  const expectedUses = (capacity, combineBonus, saverChance) =>
    (capacity + combineBonus) / (1 - saverChance);
  const uptime = (uses) => clamp(uses / missionShots, 0, 1);
  const powerUses = expectedUses(50, 20, ammoSaverChance);
  const elementUsesCoreNow = expectedUses(elementCoatingCapacity, 10, 0);
  const elementUsesCoreProposed = expectedUses(50, 10, 0);
  const elementUsesFullNow = expectedUses(elementCoatingCapacity, 10, ammoSaverChance);
  const elementUsesFullProposed = expectedUses(50, 10, ammoSaverChance);
  const missionAverage = (base, coated, ratio) => base + (coated - base) * ratio;
  const rawMissionAverage = missionAverage(rawBuildNoCoat, rawBuildPowerCoated, uptime(powerUses));
  // Element Core has Attack +3 but no Ammo Saver; Full adds Ammo Saver and Elemental +1.
  const liteMissionNow = missionAverage(elemPhysicalNoCoat + elemLiteNoCoat,
    elemPhysicalNoCoat + elemLiteCoated, uptime(elementUsesCoreNow));
  const liteMissionProposed = missionAverage(elemPhysicalNoCoat + elemLiteNoCoat,
    elemPhysicalNoCoat + elemLiteCoated, uptime(elementUsesCoreProposed));
  const fullMissionNow = missionAverage(elemPhysicalNoCoat + elemFullNoCoat,
    elemPhysicalNoCoat + elemFullCoated, uptime(elementUsesFullNow));
  const fullMissionProposed = missionAverage(elemPhysicalNoCoat + elemFullNoCoat,
    elemPhysicalNoCoat + elemFullCoated, uptime(elementUsesFullProposed));

  return {
    shotType: shot, shotLevel, slot: slotIndex + 1, charge,
    requiresLoadUp: parsed.requiresLoadUp,
    arrowHits, mvSum, affinity, element: element?.type || null, elementValue: element?.value || 0,
    shotHz: matchup.shotHz, elementHz: matchup.elementHz,
    rawIndexNoCoat: round(rawBuildNoCoat),
    rawIndexPowerCoated: round(rawBuildPowerCoated),
    elementLiteNoCoatBase: round(elemPhysicalNoCoat + elemLiteNoCoat),
    elementLiteCoatedBase: round(elemPhysicalNoCoat + elemLiteCoated),
    elementFullNoCoatBase: round(elemPhysicalNoCoat + elemFullNoCoat),
    elementFullCoatedBase: round(elemPhysicalNoCoat + elemFullCoated),
    liteVsRawCoated: round((elemPhysicalNoCoat + elemLiteCoated) / rawBuildPowerCoated),
    fullVsRawCoated: round((elemPhysicalNoCoat + elemFullCoated) / rawBuildPowerCoated),
    rawMissionAverage: round(rawMissionAverage),
    elementLiteMissionCurrent: round(liteMissionNow),
    elementLiteMissionCapacity50: round(liteMissionProposed),
    elementFullMissionCurrent: round(fullMissionNow),
    elementFullMissionCapacity50: round(fullMissionProposed),
    liteMissionVsRaw: round(liteMissionNow / rawMissionAverage),
    liteCapacity50VsRaw: round(liteMissionProposed / rawMissionAverage),
    fullMissionVsRaw: round(fullMissionNow / rawMissionAverage),
    fullCapacity50VsRaw: round(fullMissionProposed / rawMissionAverage),
    coatings: {
      nativePower2: hasPower2, nativeElement2: hasElement2,
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
      missionShots,
      ammoSaverChance,
    },
    skillCosts,
    sensitivity: shot === 'Rapid' ? { rapidReliability: reliability } : null,
    assumptions: 'unrounded damage index; all theoretical hits same part; no Power Shot / style / defense / hit-by-hit HZ distribution',
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
      for (const [slotIndex, charge] of (level.x?.charges || []).entries()) {
        const parsed = parseCharge(charge);
        if (!parsed) continue;
        if (parsed.requiresLoadUp && !options.includeLoadUp) continue;
        for (const matchup of MATCHUPS) {
          const base = calculateShot({
            weapon, charge, matchup, slotIndex, loadUp: options.includeLoadUp,
            elementCharge: ELEMENT_CHARGE.base,
            missionShots: options.missionShots ?? 200,
            ammoSaverChance: options.ammoSaverChance ?? 0.20,
            elementCoatingCapacity: options.elementCoatingCapacity ?? 20,
            rapidReliability: options.rapidReliability ?? 1,
          });
          if (!base) continue;
          const scenarioA = calculateShot({
            weapon, charge, matchup, slotIndex, loadUp: options.includeLoadUp,
            elementCharge: ELEMENT_CHARGE.A,
            missionShots: options.missionShots ?? 200,
            ammoSaverChance: options.ammoSaverChance ?? 0.20,
            elementCoatingCapacity: options.elementCoatingCapacity ?? 20,
            rapidReliability: options.rapidReliability ?? 1,
          });
          const scenarioB = calculateShot({
            weapon, charge, matchup, slotIndex, loadUp: options.includeLoadUp,
            elementCharge: ELEMENT_CHARGE.B,
            missionShots: options.missionShots ?? 200,
            ammoSaverChance: options.ammoSaverChance ?? 0.20,
            elementCoatingCapacity: options.elementCoatingCapacity ?? 20,
            rapidReliability: options.rapidReliability ?? 1,
          });
          rows.push({
            rank: rankFromRarity(rarity), rarity, treeId: tree.id, treeName: tree.nameEs || tree.name,
            weaponName: level.nEs || level.n, level: level.lv,
            raw: level.raw, affinity: level.aff || 0,
            ...base,
            A_liteMissionVsRaw: scenarioA.liteMissionVsRaw,
            A_fullMissionVsRaw: scenarioA.fullMissionVsRaw,
            B_liteMissionVsRaw: scenarioB.liteMissionVsRaw,
            B_fullMissionVsRaw: scenarioB.fullMissionVsRaw,
            A_liteCapacity50VsRaw: scenarioA.liteCapacity50VsRaw,
            A_fullCapacity50VsRaw: scenarioA.fullCapacity50VsRaw,
            B_liteCapacity50VsRaw: scenarioB.liteCapacity50VsRaw,
            B_fullCapacity50VsRaw: scenarioB.fullCapacity50VsRaw,
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
      for (const [slotIndex, charge] of (level.x?.charges || []).entries()) {
        const parsed = parseCharge(charge);
        if (!parsed || (parsed.requiresLoadUp && !options.includeLoadUp)) continue;
        candidates.push({
          rank: rankFromRarity(rarity), rarity, treeId: tree.id,
          treeName: tree.nameEs || tree.name, weaponName: level.nEs || level.n,
          level: level.lv, weapon, charge, slotIndex,
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
  const scenarios = [
    { id: 'base', multipliers: ELEMENT_CHARGE.base },
    { id: 'A', multipliers: ELEMENT_CHARGE.A },
    { id: 'B', multipliers: ELEMENT_CHARGE.B },
  ];
  const byRankMonster = [];
  const largeMonsters = (monsterData.monsters || []).filter((monster) => monster.large);

  for (const rank of ['LR', 'HR', 'G']) {
    for (const monster of largeMonsters) {
      const parts = monster.tables?.[0] || [];
      let best = Object.fromEntries(scenarios.map(({ id }) => [id, {
        raw: null, elementalLite: null, elementalFull: null,
        elementalLite50: null, elementalFull50: null,
      }]));
      for (const part of parts) {
        const shotHz = Number(part[4]) || 0;
        for (const candidate of candidates) {
          if (candidate.rank !== rank) continue;
          const element = elementOf(candidate.weapon);
          const elementHz = element ? (Number(part[ELEMENT_INDEX[element.type]]) || 0) : 0;
          const matchup = { shotHz, elementHz };
          for (const scenario of scenarios) {
            const row = calculateShot({
              weapon: candidate.weapon, charge: candidate.charge, matchup,
              slotIndex: candidate.slotIndex, loadUp: options.includeLoadUp ?? true,
              elementCharge: scenario.multipliers,
              missionShots: options.missionShots ?? 200,
              ammoSaverChance: options.ammoSaverChance ?? 0.20,
              elementCoatingCapacity: options.elementCoatingCapacity ?? 20,
              rapidReliability: options.rapidReliability ?? 1,
            });
            if (!row) continue;
            const info = {
              weapon: candidate.weaponName, tree: candidate.treeId,
              level: candidate.level, charge: candidate.charge,
              slot: candidate.slotIndex + 1, shotType: row.shotType,
              shotLevel: row.shotLevel, part: part[1] || `Parte ${part[0]}`,
              shotHz, elementHz: element ? elementHz : 0,
              element: element?.type || null,
            };
            const current = best[scenario.id];
            if (!current.raw || row.rawMissionAverage > current.raw.damage) {
              current.raw = { ...info, damage: row.rawMissionAverage };
            }
            if (element && elementHz > 0) {
              const choices = [
                ['elementalLite', row.elementLiteMissionCurrent],
                ['elementalFull', row.elementFullMissionCurrent],
                ['elementalLite50', row.elementLiteMissionCapacity50],
                ['elementalFull50', row.elementFullMissionCapacity50],
              ];
              for (const [key, damage] of choices) {
                if (!current[key] || damage > current[key].damage) {
                  current[key] = { ...info, damage };
                }
              }
            }
          }
        }
      }
      for (const scenario of scenarios) {
        const result = best[scenario.id];
        const rawDamage = result.raw?.damage || 0;
        for (const key of ['elementalLite', 'elementalFull', 'elementalLite50', 'elementalFull50']) {
          result[key] = result[key] && rawDamage > 0
            ? { ...result[key], vsRaw: round(result[key].damage / rawDamage) }
            : result[key] ? { ...result[key], vsRaw: null } : null;
        }
      }
      byRankMonster.push({
        rank, monster: monster.name, tablesAvailable: monster.tables?.length || 0,
        partsEvaluated: parts.length, scenarios: best,
      });
    }
  }
  return {
    metadata: {
      largeMonsters: largeMonsters.length,
      candidates: candidates.length,
      ranks: ['LR', 'HR', 'G'],
      hitzoneTable: 'first table only; parallel tables remain unlabelled',
      options: {
        includeLoadUp: options.includeLoadUp ?? true,
        missionShots: options.missionShots ?? 200,
        ammoSaverChance: options.ammoSaverChance ?? 0.20,
        elementCoatingCapacity: options.elementCoatingCapacity ?? 20,
        rapidReliability: options.rapidReliability ?? 1,
      },
      note: 'Catalogue-wide best same-part damage index; theoretical hits share one part; not actual DPS.',
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
    const bA = bestBy(group, 'A_fullMissionVsRaw');
    const bB = bestBy(group, 'B_fullMissionVsRaw');
    const bA50 = bestBy(group, 'A_fullCapacity50VsRaw');
    const bB50 = bestBy(group, 'B_fullCapacity50VsRaw');
    out.push({
      rank: first.rank, element: first.element, shotType: first.shotType, matchup: first.matchup,
      candidates: group.length,
      bestLite: bLite ? { weapon: bLite.weaponName, lv: bLite.level, slot: bLite.slot,
        ratioCurrent: bLite.liteMissionVsRaw, skillCosts: bLite.skillCosts } : null,
      bestFull: bFull ? { weapon: bFull.weaponName, lv: bFull.level, slot: bFull.slot,
        ratioCurrent: bFull.fullMissionVsRaw, skillCosts: bFull.skillCosts } : null,
      bestScenarioA: bA ? { weapon: bA.weaponName, lv: bA.level, slot: bA.slot,
        ratio: bA.A_fullMissionVsRaw, skillCosts: bA.skillCosts } : null,
      bestScenarioB: bB ? { weapon: bB.weaponName, lv: bB.level, slot: bB.slot,
        ratio: bB.B_fullMissionVsRaw, skillCosts: bB.skillCosts } : null,
      bestFullCapacity50: bestBy(group, 'fullCapacity50VsRaw')
        ? bestBy(group, 'fullCapacity50VsRaw').fullCapacity50VsRaw : null,
      bestScenarioACapacity50: bA50 ? bA50.A_fullCapacity50VsRaw : null,
      bestScenarioBCapacity50: bB50 ? bB50.B_fullCapacity50VsRaw : null,
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
    ammoSaverChance: readNumber('--ammo-saver-chance=', 0.20),
    elementCoatingCapacity: readNumber('--element-coat-capacity=', 20),
  };
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
