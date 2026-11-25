import test from "node:test";
import assert from "node:assert/strict";
import {
  auditBowBranches,
  normalizeLoadUpCharge,
  parseCharge
} from "../js/bow-branch-audit.js";

test("builds complete parent paths and truncates each parent at the branch level", () => {
  const data = {
    labelEs: "Arco",
    trees: [
      {
        id: 1, nameEs: "Raíz", rarity: 1, parent: null,
        levels: [
          { lv: 1, nEs: "Raíz 1", raw: 100, rar: 1, x: { charges: ["Rapid Lv2", "Rapid Lv3", "Rapid Lv4", "Rapid Lv4!"] } },
          { lv: 2, nEs: "Raíz 2", raw: 120, rar: 2, x: { charges: ["Rapid Lv2", "Rapid Lv3", "Rapid Lv4", "Rapid Lv4!"] } },
          { lv: 3, nEs: "Raíz 3", raw: 140, rar: 3, x: { charges: ["Rapid Lv2", "Rapid Lv3", "Rapid Lv4", "Rapid Lv4!"] } }
        ]
      },
      {
        id: 2, nameEs: "Rama fuego", rarity: 4, parent: [1, 1],
        levels: [
          { lv: 1, nEs: "Fuego I", raw: 130, rar: 4, ele: [["Fuego", "Fire", 20]], x: { charges: ["Rapid Lv2", "Rapid Lv3", "Rapid Lv4", "Spread Lv4!"], coatings: ["Element Coating 2"] } },
          { lv: 2, nEs: "Fuego II", raw: 180, rar: 8, ele: [["Fuego", "Fire", 40]], x: { charges: ["Rapid Lv2", "Rapid Lv3", "Rapid Lv4", "Spread Lv4!"], coatings: ["Element Coating 2"] } }
        ]
      },
      {
        id: 3, nameEs: "Rama RAW", rarity: 4, parent: [1, 2],
        levels: [
          { lv: 1, nEs: "RAW I", raw: 200, rar: 4, x: { charges: ["Spread Lv2", "Spread Lv3!", "Spread Lv4", "Spread Lv4!"], coatings: ["Power Coating 2"] } }
        ]
      }
    ]
  };

  const report = auditBowBranches(data);
  assert.equal(report.metadata.segmentCount, 3);
  assert.equal(report.metadata.rootFamilyCount, 1);
  assert.equal(report.metadata.terminalBranchCount, 2);

  const fire = report.branches.find(row => row.branchName === "Fuego II");
  assert.equal(fire.progressionLevels, 3);
  assert.deepEqual(
    fire.segments.map(row => [row.treeId, row.throughLocalLevel]),
    [[1, 1], [2, 2]]
  );
  assert.equal(fire.role, "elemental");
  assert.equal(fire.finalRank, "G");

  const raw = report.branches.find(row => row.branchName === "RAW I");
  assert.equal(raw.progressionLevels, 3);
  assert.equal(raw.role, "raw");
});

test("counts Load Up mismatches and preserves charge level and marker", () => {
  const charges = ["Rapid Lv2", "Spread Lv3!", "Pierce Lv4", "Heavy Lv5!"];
  assert.equal(normalizeLoadUpCharge(charges, 1), "Rapid Lv3!");
  assert.equal(normalizeLoadUpCharge(charges, 3), "Pierce Lv5!");
  assert.deepEqual(parseCharge("Rapid Lv3!"), {
    type: "Rapid", level: 3, requiresLoadUp: true
  });

  const report = auditBowBranches({
    trees: [{
      id: 1, name: "Bow", rarity: 1, parent: null,
      levels: [{ lv: 1, raw: 100, rar: 1, x: { charges } }]
    }]
  });
  assert.equal(report.metadata.loadUp.marked, 2);
  assert.equal(report.metadata.loadUp.mismatches, 2);
  assert.equal(report.metadata.loadUp.markedBySlot["2"], 1);
  assert.equal(report.metadata.loadUp.markedBySlot["4"], 1);
  assert.deepEqual(charges, ["Rapid Lv2", "Spread Lv3!", "Pierce Lv4", "Heavy Lv5!"]);
});

test("classifies elemental, blast and raw terminal branches separately", () => {
  const data = {
    trees: [
      { id: 1, name: "Fire", rarity: 1, levels: [{ lv: 1, raw: 100, rar: 3, ele: [["Fire", "Fire", 30]] }] },
      { id: 2, name: "Blast", rarity: 1, levels: [{ lv: 1, raw: 100, rar: 4, ele: [["Blast", "Blast", 20]] }] },
      { id: 3, name: "Plain", rarity: 1, levels: [{ lv: 1, raw: 110, rar: 8 }] }
    ]
  };
  const report = auditBowBranches(data);
  assert.deepEqual(report.metadata.branchRoles, {
    elemental: 1, blast: 1, raw: 1
  });
  assert.deepEqual(report.metadata.branchRolesByFinalRank, {
    LR: { elemental: 1 },
    HR: { blast: 1 },
    G: { raw: 1 }
  });
});
