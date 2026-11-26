// Stage 14 — pruebas de optimización real de builds especializadas.
// Verifica: perfiles oficiales (RAW/elemental, sin híbridos), sinergia
// Maza + Crítico elemental, Ojo crítico como fuente de afinidad, coste de
// Element Coating, conservación del elemento natural en builds RAW y
// alineación C4 `!` con C3.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

import {
  offensivePriority, runProfileComparison, OFFICIAL_PROFILES, HYBRID_PROFILE,
} from "../js/bow-build-comparison.js";
import {
  optimizeBowBuild, resolveBowBuildRequirements, getTalismanOptions,
} from "../js/bow-build-optimizer.js";
import { buildBowSkillRequirements } from "../js/bow-build-feasibility.js";
import { calculateBowBuildVolley, skillPointsFromOptimizerBuild } from "../js/bow-build-damage.js";
import { makeWeaponCandidates, parseHitzones, CHARGE_ELEMENT } from "../js/bow-balance-sim.js";
import { reconstructLines } from "../tools/bow-specialization-audit.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const readJson = p => JSON.parse(readFileSync(resolve(root, p), "utf8"));

const armorData = readJson("data/armor/pieces.json");
const decorations = readJson("data/armor/decorations.json");
const talismanSkills = readJson("data/armor/talisman-skills.json");
const skillLevels = readJson("data/armor/skill-levels.json");
const bowData = readJson("data/weapons/bow.json");
const hitzoneData = parseHitzones(readFileSync(resolve(root, "tools/data-hitzones.js"), "utf8"));

// ---------- 1. Perfiles oficiales: RAW y elemental, sin híbridos ----------

test("Stage 14: los perfiles oficiales son solo RAW y elemental", () => {
  assert.deepEqual([...OFFICIAL_PROFILES], ["raw", "elemental"]);
  assert.equal(HYBRID_PROFILE.legacy, true, "el híbrido se marca como legado");
  assert.equal(OFFICIAL_PROFILES.includes("hybrid"), false, "híbrido no es oficial");
});

test("Stage 14: la prioridad elemental incluye Ojo crítico (Expert) como fuente de afinidad", () => {
  const priority = offensivePriority("elemental", "Rapid", "Water");
  assert.ok(priority.includes("Expert"), "Expert debe estar en la prioridad elemental");
  // Expert debe aparecer antes del shot skill: su valor es afinidad para Crítico elemental
  const expertIdx = priority.indexOf("Expert");
  const shotIdx = priority.indexOf("Normal Up");
  assert.ok(expertIdx < shotIdx, "Expert se valora antes que el potenciador de flecha");
  // Critical Up no debe recibir prioridad elemental (no mejora el multiplicador elemental)
  assert.ok(priority.indexOf("Critical Up") > expertIdx, "Critical Up no se prioriza en elemental");
});

test("Stage 14: la prioridad RAW mantiene las habilidades físicas y Power C+", () => {
  const priority = offensivePriority("raw", "Spread", null);
  assert.ok(priority.includes("Pellet Up"));
  assert.ok(priority.includes("Power C+"));
  assert.ok(priority.includes("Attack"));
});

// ---------- 2. Sinergia Maza + Crítico elemental ----------

test("Stage 14: Maza aporta afinidad cuando el hitzone físico es débil (≥45)", () => {
  // Parte con shotHz=45 (umbral de Maza) y affinity 0.
  const part = [0, "Head", 50, 50, 45, 10, 10, 10, 10, 10, 100, 100];
  const weapon = {
    name: "Test", rawDisplay: 200, affinity: 0, elements: [{ type: "Water", display: 30 }],
    chargeSlot: 3, chargeType: "Rapid", chargeLevel: 3,
    rawMotionValues: [25, 25, 25, 25], coatings: ["Element Coating 2"],
  };
  const withStriker = calculateBowBuildVolley(weapon, part, { Tenderizer: 10 });
  const withoutStriker = calculateBowBuildVolley(weapon, part, {});
  assert.equal(withStriker.affinity, 50, "Maza +50 cuando shotHz ≥ 45");
  assert.equal(withoutStriker.affinity, 0, "sin Maza no hay +50");
});

test("Stage 14: la afinidad de Maza alimenta Crítico elemental", () => {
  const part = [0, "Head", 50, 50, 45, 10, 10, 10, 10, 10, 100, 100];
  const weapon = {
    name: "Test", rawDisplay: 200, affinity: 0, elements: [{ type: "Water", display: 30 }],
    chargeSlot: 3, chargeType: "Rapid", chargeLevel: 3,
    rawMotionValues: [25, 25, 25, 25], coatings: ["Element Coating 2"],
  };
  const withStrikerAndCrit = calculateBowBuildVolley(weapon, part, { Tenderizer: 10, "Crit Element": 10 });
  const withStrikerNoCrit = calculateBowBuildVolley(weapon, part, { Tenderizer: 10 });
  // El daño elemental con Crítico elemental y afinidad 50 debe superar al sin Crítico elemental
  assert.ok(withStrikerAndCrit.elementalDamage > withStrikerNoCrit.elementalDamage,
    "Crítico elemental activado debe aumentar el daño elemental");
  assert.ok(withStrikerAndCrit.elementalDamage > 0);
});

test("Stage 14: Ojo crítico (Expert) aumenta la afinidad y alimenta Crítico elemental", () => {
  const part = [0, "Head", 50, 50, 30, 10, 10, 10, 10, 10, 100, 100];
  const weapon = {
    name: "Test", rawDisplay: 200, affinity: 0, elements: [{ type: "Water", display: 30 }],
    chargeSlot: 3, chargeType: "Rapid", chargeLevel: 3,
    rawMotionValues: [25, 25, 25, 25], coatings: ["Element Coating 2"],
  };
  const withExpert = calculateBowBuildVolley(weapon, part, { Expert: 20, "Crit Element": 10 });
  const withoutExpert = calculateBowBuildVolley(weapon, part, { "Crit Element": 10 });
  assert.ok(withExpert.affinity > withoutExpert.affinity, "Expert suma afinidad");
  assert.ok(withExpert.elementalDamage > withoutExpert.elementalDamage,
    "La afinidad de Expert alimenta Crítico elemental");
});

test("Stage 14: Maza depende del hitzone físico, no del elemental", () => {
  // Parte con shotHz=30 (<45, condición física no cumplida) pero elementHz alto.
  const part = [0, "Head", 50, 50, 30, 40, 10, 10, 10, 10, 100, 100];
  const weapon = {
    name: "Test", rawDisplay: 200, affinity: 0, elements: [{ type: "Water", display: 30 }],
    chargeSlot: 3, chargeType: "Rapid", chargeLevel: 3,
    rawMotionValues: [25, 25, 25, 25], coatings: ["Element Coating 2"],
  };
  const result = calculateBowBuildVolley(weapon, part, { Tenderizer: 10 });
  assert.equal(result.affinity, 0, "sin condición física de Maza, no hay +50 de afinidad");
});

// ---------- 3. Coste de Element Coating ----------

test("Stage 14: Element Coating II requiere Elem C+ +15 y se contabiliza como coste", () => {
  const req = buildBowSkillRequirements({
    profile: "elemental", shotType: "Rapid", element: "Water", elementCoatingLevel: "II",
  });
  assert.equal(req["Elem C+"], 15, "Elem C+ +15 para desbloquear Element Coating 2");
  assert.equal(req.Elemental, 10);
  assert.equal(req["Water Atk"], 15);
  assert.equal(req["Crit Element"], 10);
});

test("Stage 14: Power Coating II requiere Power C+ +15 (RAW)", () => {
  const req = buildBowSkillRequirements({
    profile: "raw", shotType: "Rapid", powerCoatingLevel: "II",
  });
  assert.equal(req["Power C+"], 15);
  assert.equal(req.Attack, 20);
});

// ---------- 4. Conservación del elemento natural en builds RAW ----------

test("Stage 14: un build RAW conserva el elemento natural de su arco", () => {
  // Arco con elemento natural pequeño (RAW especializado): el simulador suma
  // ese daño elemental real; no se suprima artificialmente.
  const candidates = makeWeaponCandidates(bowData, { loadUpPolicy: "match-c3" });
  const rawBow = candidates.find(w => w.elements.length === 1 && w.elements[0].display > 0
    && w.elements[0].display < 20 && w.rank === "G" && w.chargeType === "Rapid");
  assert.ok(rawBow, "existe un arco RAW de G con elemento natural <20");
  const part = [0, "Head", 50, 50, 45, 20, 10, 10, 10, 10, 100, 100];
  const result = calculateBowBuildVolley(rawBow, part, { Attack: 20, Expert: 15, Tenderizer: 10, "Critical Up": 10, "Normal Up": 10 });
  assert.ok(result.elementalDamage > 0, "el elemento natural se conserva en el daño total");
  assert.ok(result.rawDamage > 0);
});

// ---------- 5. Talismán verificado solo con evidencia real ----------

test("Stage 14: los talismánes verificados requieren par evidenciado (valor+espacios)", () => {
  const targets = ["Water Atk", "Crit Element"];
  const verified = getTalismanOptions(talismanSkills, targets, "verified");
  // Sin evidencia de pares (valor × espacios), ningún talismán con habilidades
  // se confirma. Los talismánes vacíos (sin habilidades) son legales por sí
  // mismos y no requieren evidencia de par.
  const confirmedWithSkills = verified.filter(o => o.confirmed && o.sk.length > 0);
  assert.equal(confirmedWithSkills.length, 0, "sin evidencia de par, confirmados con habilidades = 0");
  // Existen candidatos no confirmados (valores de puntos del catálogo)
  const candidatesWithSkills = verified.filter(o => o.sk.length > 0);
  assert.ok(candidatesWithSkills.length > 0, "existen candidatos no confirmados");
});

// ---------- 6. C4 `!` alineada con C3 ----------

test("Stage 14: toda carga C4 con `!` se alinea con el tipo de C3", () => {
  const lines = reconstructLines(bowData);
  let checked = 0;
  for (const line of lines) {
    for (const rec of line.levelRecords) {
      const cn = rec.chargesNormalized;
      if (cn[3] && cn[3].endsWith("!")) {
        const c3Type = cn[2].split(" ")[0];
        const c4Type = cn[3].split(" ")[0];
        assert.equal(c4Type, c3Type, `C4 ! alineada con C3 en ${line.treeName} L${rec.localLevel}`);
        checked++;
      }
    }
  }
  assert.ok(checked > 0, "existe al menos una carga C4 ! alineada");
});

// ---------- 7. Builds completos por rango y género ----------

test("Stage 14: el optimizer produce builds legales por rango y género", () => {
  for (const rank of ["LR", "HR", "G"]) {
    for (const gender of ["male", "female"]) {
      const req = buildBowSkillRequirements({ profile: "elemental", shotType: "Rapid", element: "Water" });
      const result = optimizeBowBuild({
        armorData, decorations, talismanSkills, skillLevels, requirements: req,
        rank, gender, weaponSlots: 0, talismanPolicy: "verified", topBuilds: 1,
      });
      const build = result.builds[0];
      assert.ok(build, `build elemental ${rank}/${gender}`);
      assert.ok(Array.isArray(build.armor) && build.armor.length === 5, "cinco piezas de armadura");
      assert.ok(Array.isArray(build.jewelsBySlot.weapon) || Array.isArray(build.jewelsBySlot.head), "joyas por ranura");
    }
  }
});

// ---------- 8. Ausencia de híbridos en comparaciones oficiales ----------

test("Stage 14: runProfileComparison solo produce perfiles oficiales", () => {
  // Arco elemental de G (Elizabeth atenta, tree 104, nivel 3)
  const tree = bowData.trees.find(t => Number(t.id) === 104);
  const level = tree.levels.find(lv => Number(lv.lv) === 3);
  const charges = (level.x?.charges || []);
  const slot = charges.findIndex(c => c.startsWith("Spread"));
  const out = runProfileComparison({
    armorData, decorations, talismanSkills, skillLevels, bowData,
    treeId: 104, level: 3, chargeSlot: slot + 1, shotType: "Spread",
    coatingPolicy: "low-cost", rank: "G", genders: ["male"],
    activeSkillBudget: 3, talismanPolicy: "verified", allowNegatives: false,
  });
  for (const comparison of out.comparisons) {
    assert.ok(["raw", "elemental"].includes(comparison.profile),
      `perfil oficial: ${comparison.profile}`);
    assert.notEqual(comparison.profile, "hybrid", "no hay perfil híbrido en oficiales");
  }
});
