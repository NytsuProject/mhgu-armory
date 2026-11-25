import test from "node:test";
import assert from "node:assert/strict";
import {
  auditBowBuildSkillAvailability,
  buildBowSkillRequirements,
  makeBowSkillPackages,
  summarizeBowWeaponCatalog,
} from "../js/bow-build-feasibility.js";

const skillLevels = {
  Attack: [{ points: 20 }],
  Expert: [{ points: 15 }],
  Tenderizer: [{ points: 10 }],
  "Critical Up": [{ points: 10 }],
  "Normal Up": [{ points: 10 }],
  "Pierce Up": [{ points: 10 }],
  "Pellet Up": [{ points: 10 }],
  "Heavy Up": [{ points: 10 }],
  Elemental: [{ points: 10 }],
  "Fire Atk": [{ points: 15 }],
  "Water Atk": [{ points: 15 }],
  "Thunder Atk": [{ points: 15 }],
  "Ice Atk": [{ points: 15 }],
  "Dragon Atk": [{ points: 15 }],
  "Crit Element": [{ points: 10 }],
  "Power C+": [{ points: 10 }, { points: 15 }],
  "Elem C+": [{ points: 10 }, { points: 15 }],
  Loading: [{ points: 10 }],
  "Ammo Saver": [{ points: 10 }],
};

test("RAW and elemental profiles use the actual bow skill thresholds", () => {
  const raw = buildBowSkillRequirements({
    profile: "raw", shotType: "Rapid", powerCoatingLevel: "II", loadUp: true,
  });
  assert.deepEqual(raw, {
    Attack: 20, Expert: 15, Tenderizer: 10, "Critical Up": 10,
    "Normal Up": 10, "Power C+": 15, Loading: 10,
  });

  const elemental = buildBowSkillRequirements({
    profile: "elemental", element: "Fire", shotType: "Spread",
    elementCoatingLevel: "II", powerCoatingLevel: "I", ammoSaver: true,
  });
  assert.deepEqual(elemental, {
    Elemental: 10, "Fire Atk": 15, "Crit Element": 10, Tenderizer: 10,
    "Elem C+": 15, "Pellet Up": 10, "Power C+": 10, "Ammo Saver": 10,
  });
});

test("all four arrow types map to their in-game type-up skills", () => {
  const packages = makeBowSkillPackages();
  for (const [shotType, skill] of Object.entries({
    Rapid: "Normal Up", Pierce: "Pierce Up", Spread: "Pellet Up", Heavy: "Heavy Up",
  })) {
    const raw = packages.find(row => row.profile === "raw" && row.shotType === shotType);
    assert.equal(raw.requirements[skill], 10);
  }
  assert.ok(packages.some(row => row.id === "element-hybrid-low-water-spread"));
});

test("invalid profile, shot type, element and coating levels are rejected", () => {
  assert.throws(() => buildBowSkillRequirements({ profile: "rawr", shotType: "Rapid" }));
  assert.throws(() => buildBowSkillRequirements({ profile: "raw", shotType: "Spreadish" }));
  assert.throws(() => buildBowSkillRequirements({ profile: "elemental", shotType: "Rapid" }));
  assert.throws(() => buildBowSkillRequirements({
    profile: "elemental", element: "Fire", shotType: "Rapid", elementCoatingLevel: "III",
  }));
});

test("availability audit filters rank and class, and reports armor, jewels and charm slots", () => {
  const result = auditBowBuildSkillAvailability({
    armorData: {
      pieces: {
        1: { slot: "head", rank: "G", cls: "G", gender: 2, deco: 1, nameEs: "Gorro de prueba", sk: [["Attack", "Ataque", 12]] },
        2: { slot: "arms", rank: "G", cls: "B", gender: 2, deco: 2, nameEs: "Brazales espada", sk: [["Attack", "Ataque", 20]] },
        3: { slot: "waist", rank: "HR", cls: "G", gender: 2, deco: 2, nameEs: "Faja alta", sk: [["Attack", "Ataque", 20]] },
      },
    },
    decorations: [
      { id: 1, name: "Joya de prueba", cost: 2, sk: [["Attack", "Ataque", 5], ["Defense", "Defensa", -1]] },
    ],
    talismanSkills: [{
      en: "Attack", points: [[1, 2, 3, 4], [-2, -1, 1, 2, 3, 8]],
    }],
    skillLevels,
    rank: "G",
  });
  const attack = result.skillAvailability.Attack.targets.find(row => row.targetPoints === 20);
  assert.equal(result.metadata.eligibleGunnerArmorPieces, 1);
  assert.equal(result.packages.length, 68);
  assert.equal(attack.armor.pieceCount, 1);
  assert.equal(attack.armor.bySlot.head.maxPoints, 12);
  assert.equal(attack.armor.piecesAtThreshold, 0);
  assert.equal(attack.decorations.options[0].points, 5);
  assert.equal(attack.decorations.options[0].otherSkills[0].skill, "Defense");
  assert.equal(attack.talisman.primaryMax, 4);
  assert.equal(attack.talisman.secondaryMax, 8);
  assert.equal(attack.talisman.secondaryCanReachThreshold, false);
  assert.ok(result.skillAvailability.Loading);
  assert.ok(result.skillAvailability["Ammo Saver"]);
});

test("audit rejects requested thresholds that are not real skill activations", () => {
  assert.throws(() => auditBowBuildSkillAvailability({
    armorData: { pieces: {} }, decorations: [], talismanSkills: [],
    skillLevels: { ...skillLevels, Attack: [{ points: 15 }] },
  }), /no coincide con skill-levels/);
});

test("bow weapon catalog summary counts rank levels, coatings and sockets", () => {
  const result = summarizeBowWeaponCatalog({
    trees: [{
      id: 1,
      rarity: 8,
      levels: [
        { lv: 1, rar: 8, slots: "◯◯—", ele: [["Fuego", "Fire", 32]], x: { coatings: ["Power Coating 2", "Element Coating 2"] } },
        { lv: 2, rar: 7, slots: "―――", x: { coatings: ["Power Coating"] } },
      ],
    }],
  });
  assert.equal(result.treeSegments, 1);
  assert.equal(result.levelRecords, 2);
  assert.equal(result.ranks.G.elementalRecords, 1);
  assert.equal(result.ranks.G.elementAbove30, 1);
  assert.equal(result.ranks.G.bothElementIIAndPowerII, 1);
  assert.equal(result.ranks.G.weaponSlots[2].levels, 1);
  assert.equal(result.ranks.HR.nativePowerI, 1);
});
