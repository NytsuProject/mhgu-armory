import test from "node:test";
import assert from "node:assert/strict";
import { optimizeBowBuild, resolveBowBuildRequirements } from "../js/bow-build-optimizer.js";

const armorData = { pieces: {
  1: { id: 1, slot: "head", name: "Helm", nameEs: "Casco", rank: "G", cls: "B", gender: 0, deco: 1, def: [1, 10], sk: [["Attack", "Ataque", 10]] },
  2: { id: 2, slot: "chest", name: "Chest", nameEs: "Pechera", rank: "G", cls: "G", gender: 0, deco: 2, def: [1, 10], sk: [["Normal Up", "Salva+", 10]] },
  3: { id: 3, slot: "arms", name: "Arms", nameEs: "Brazales", rank: "G", cls: "A", gender: 2, deco: 1, def: [1, 10], sk: [["Tenderizer", "Maza", 10]] },
  4: { id: 4, slot: "waist", name: "Waist", nameEs: "Faja", rank: "G", cls: "G", gender: 0, deco: 1, def: [1, 10], sk: [["Expert", "Experto", 15]] },
  5: { id: 5, slot: "legs", name: "Legs", nameEs: "Grebas", rank: "G", cls: "G", gender: 0, deco: 1, def: [1, 10], sk: [["Critical Up", "Crítico", 10]] },
  6: { id: 6, slot: "head", name: "Female helm", nameEs: "Casco femenino", rank: "G", cls: "G", gender: 1, deco: 3, def: [1, 10], sk: [["Attack", "Ataque", 20]] },
  7: { id: 7, slot: "chest", name: "Blademaster chest", nameEs: "Pechera espada", rank: "G", cls: "B", gender: 0, deco: 3, def: [1, 10], sk: [["Attack", "Ataque", 20]] },
} };
const skillLevels = {
  Attack: [{ points: 10 }, { points: 15 }, { points: -10 }],
  Expert: [{ points: 15 }, { points: -10 }],
  Tenderizer: [{ points: 10 }],
  "Critical Up": [{ points: 10 }],
  "Normal Up": [{ points: 10 }],
  "Power C+": [{ points: 10 }, { points: 15 }],
  "Elem C+": [{ points: 10 }, { points: 15 }],
};

test("finds a legal complete build, accepts a Blademaster helm, and places jewels within each container", () => {
  const result = optimizeBowBuild({
    armorData, decorations: [{ id: 10, name: "Attack Jewel", cost: 1, sk: [["Attack", "Ataque", 5]] }],
    talismanSkills: [], skillLevels,
    requirements: { Attack: 15, Expert: 15, Tenderizer: 10, "Critical Up": 10, "Normal Up": 10 },
    rank: "G", gender: "male", weaponSlots: 1, beamWidth: 100, topBuilds: 1,
  });
  const best = result.builds[0];
  assert.equal(best.complete, true);
  assert.equal(best.armor.length, 5);
  assert.equal(best.armor.find(piece => piece.slot === "head").cls, "B");
  assert.ok(best.jewelSocketsUsed >= 1);
  for (const [slot, jewels] of Object.entries(best.jewelsBySlot)) {
    const capacity = slot === "weapon" ? 1
      : slot === "talisman" ? (best.talisman?.deco || 0)
      : best.armor.find(piece => piece.slot === slot)?.deco || 0;
    assert.ok(jewels.reduce((sum, jewel) => sum + jewel.cost, 0) <= capacity, slot + " overflow");
  }
});

test("never mixes male and female armor pieces in one build", () => {
  const result = optimizeBowBuild({
    armorData, decorations: [], talismanSkills: [], skillLevels,
    requirements: { Attack: 10 }, rank: "G", gender: "male", beamWidth: 100, topBuilds: 1,
  });
  assert.ok(result.builds[0].armor.every(piece => piece.gender === 0 || piece.gender === 2));
});

test("bow body armor requires Gunner or All class while either helmet class is accepted", () => {
  const result = optimizeBowBuild({
    armorData, decorations: [], talismanSkills: [], skillLevels,
    requirements: { Attack: 10 }, rank: "G", gender: "male", beamWidth: 100, topBuilds: 1,
  });
  assert.ok(result.builds[0].armor.filter(piece => piece.slot !== "head")
    .every(piece => piece.cls === "G" || piece.cls === "A"));
});

test("native coatings are free to use; missing levels receive the correct unlock threshold", () => {
  const weapon = { x: { coatings: ["Power Coating 2", "Element Coating"] } };
  const raw = resolveBowBuildRequirements({ weapon, profile: "raw", shotType: "Rapid", coatingPolicy: "low-cost" });
  assert.equal(raw.requirements["Power C+"], undefined);
  const hybridLow = resolveBowBuildRequirements({ weapon, profile: "hybrid", shotType: "Rapid", element: "Water", coatingPolicy: "low-cost" });
  assert.equal(hybridLow.requirements["Elem C+"], undefined);
  assert.equal(hybridLow.requirements["Power C+"], undefined);
  const hybridMax = resolveBowBuildRequirements({ weapon, profile: "hybrid", shotType: "Rapid", element: "Water", coatingPolicy: "max" });
  assert.equal(hybridMax.requirements["Elem C+"], 15);
  assert.equal(hybridMax.requirements["Power C+"], undefined);
});

test("Load Up is charged as a real skill requirement", () => {
  const result = resolveBowBuildRequirements({
    weapon: { x: { coatings: [] } }, profile: "raw", shotType: "Rapid", loadUp: true,
  });
  assert.equal(result.requirements.Loading, 10);
});
