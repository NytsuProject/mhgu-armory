import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  ELEMENT_CAP,
  MATCHUP_PROFILES,
  REBALANCE_WINDOWS,
  alignLoadUpC4Types,
  capNaturalElement,
  proposeElementalRebalance,
  solveElementValue,
  terminalLineInventory,
} from '../js/bow-elemental-rebalance.js';
import { auditBowBranches } from '../js/bow-branch-audit.js';
import { calculateSequence } from '../tools/bow-elemental-scenarios.mjs';

const realDatabase = JSON.parse(readFileSync('data/weapons/bow.json', 'utf8'));

function syntheticDatabase() {
  return {
    class: 'bow',
    label: 'Bow',
    labelEs: 'Arco',
    trees: [
      {
        id: 1, name: 'Petrified Bow', nameEs: 'Arco petrificado', rarity: 1,
        levels: [
          {
            lv: 8, n: 'Sophos Bow', nEs: 'Arco docto', raw: 240, aff: 0, def: 0,
            slots: '―――', rar: 1,
            ele: [['Rayo', 'Thunder', 34]],
            x: {
              arc: 'Focus',
              charges: ['Rapid Lv2', 'Rapid Lv3', 'Rapid Lv4', 'Spread Lv4!'],
              coatings: ['Power Coating 2', 'Element Coating 2'],
            },
          },
          {
            lv: 9, n: 'Sophos Bow', nEs: 'Arco docto', raw: 260, aff: 0, def: 0,
            slots: '―――', rar: 1,
            ele: [['Rayo', 'Thunder', 30]],
            x: {
              arc: 'Focus',
              charges: ['Rapid Lv2', 'Rapid Lv3', 'Rapid Lv4', 'Rapid Lv4!'],
              coatings: ['Power Coating 2', 'Element Coating 2'],
            },
          },
          {
            lv: 10, n: 'Raw Branch', nEs: 'Rama RAW', raw: 280, aff: 0, def: 0,
            slots: '―――', rar: 1,
            x: {
              arc: 'Focus',
              charges: ['Rapid Lv2', 'Rapid Lv3', 'Pierce Lv4', 'Heavy Lv5!'],
              coatings: ['Power Coating 2'],
            },
          },
        ],
      },
    ],
    provenance: {},
  };
}

test('element cap touches only natural elements above the cap', () => {
  const { database, changes } = capNaturalElement(syntheticDatabase(), 30);
  assert.equal(changes.length, 1);
  assert.deepEqual(changes[0], {
    treeId: 1, treeName: 'Arco petrificado', localLevel: 8,
    name: 'Arco docto', element: 'Thunder', from: 34, to: 30,
  });
  const level8 = database.trees[0].levels[0];
  assert.equal(level8.ele[0][2], 30);
  // The record already at the cap and the RAW record stay untouched.
  assert.equal(database.trees[0].levels[1].ele[0][2], 30);
  assert.equal(database.trees[0].levels[2].raw, 280);
  assert.equal(database.trees[0].levels[2].ele, undefined);
  // RAW, charges and coatings of the capped record are preserved.
  assert.equal(level8.raw, 240);
  assert.deepEqual(level8.x.charges, ['Rapid Lv2', 'Rapid Lv3', 'Rapid Lv4', 'Spread Lv4!']);
});

test('element cap never lowers values at or below the cap', () => {
  const database = syntheticDatabase();
  const { changes } = capNaturalElement(database, 30);
  assert.equal(changes.length, 1);
  // Re-applying is a no-op (idempotent).
  const again = capNaturalElement(capNaturalElement(database, 30).database, 30);
  assert.equal(again.changes.length, 0);
});

test('C4 Load Up alignment preserves level and marker and leaves C3 untouched', () => {
  const database = syntheticDatabase();
  const { database: next, changes } = alignLoadUpC4Types(database);
  assert.equal(changes.length, 2);
  assert.deepEqual(changes[0], {
    treeId: 1, treeName: 'Arco petrificado', localLevel: 8,
    name: 'Arco docto', slot: 4,
    from: 'Spread Lv4!', to: 'Rapid Lv4!',
  });
  assert.deepEqual(changes[1], {
    treeId: 1, treeName: 'Arco petrificado', localLevel: 10,
    name: 'Rama RAW', slot: 4,
    from: 'Heavy Lv5!', to: 'Pierce Lv5!',
  });
  const level8 = next.trees[0].levels[0];
  assert.deepEqual(level8.x.charges, ['Rapid Lv2', 'Rapid Lv3', 'Rapid Lv4', 'Rapid Lv4!']);
  // The RAW branch C4 also gets aligned; C3 charges never change.
  const level10 = next.trees[0].levels[2];
  assert.equal(level10.x.charges[3], 'Pierce Lv5!');
  assert.equal(level10.x.charges[2], 'Pierce Lv4');
  // Re-applying is a no-op.
  assert.equal(alignLoadUpC4Types(next).changes.length, 0);
});

test('C4 alignment skips charges that already match and unmarked charges', () => {
  const database = {
    trees: [{
      id: 1, name: 'T', nameEs: 'T', rarity: 1,
      levels: [{
        lv: 1, n: 'A', nEs: 'A', raw: 100, rar: 1,
        x: { charges: ['Rapid Lv2', 'Rapid Lv3', 'Rapid Lv4', 'Rapid Lv5!'] },
      }],
    }],
  };
  const { changes } = alignLoadUpC4Types(database);
  assert.equal(changes.length, 0);
});

test('terminal inventory splits the real catalogue into 74/39/3 endpoints', () => {
  // Stage 15 rebalance: 10 líneas convertidas a elementales + 9 ramas nuevas.
  const inventory = terminalLineInventory(realDatabase);
  assert.equal(inventory.elemental.length, 74);
  assert.equal(inventory.raw.length, 39);
  assert.equal(inventory.blast.length, 3);
  assert.equal(inventory.elemental.length + inventory.raw.length + inventory.blast.length, 116);
  for (const line of inventory.elemental) {
    assert.ok(line.element, 'elemental final must carry an element');
    assert.ok(['Fire', 'Water', 'Thunder', 'Ice', 'Dragon'].includes(line.element.type));
    assert.ok(line.c3Type, 'elemental final must carry a third charge');
  }
  for (const line of inventory.raw) {
    assert.equal(line.element, null);
  }
});

test('real catalogue ends with no natural element above the cap and aligned C4 charges', () => {
  const capped = capNaturalElement(realDatabase, ELEMENT_CAP);
  assert.equal(capped.changes.length, 0, 'the catalogue must already respect the element cap');
  for (const tree of realDatabase.trees) {
    for (const level of tree.levels) {
      for (const row of level.ele || []) {
        if (['Fire', 'Water', 'Thunder', 'Ice', 'Dragon'].includes(row[1])) {
          assert.ok(row[2] <= ELEMENT_CAP, `${tree.name} Lv${level.lv} exceeds the cap`);
        }
      }
    }
  }
  const aligned = alignLoadUpC4Types(realDatabase);
  assert.equal(aligned.changes.length, 0, 'the catalogue must already have aligned C4 charges');
  const audit = auditBowBranches(realDatabase);
  assert.equal(audit.metadata.loadUp.marked, 746);
  assert.equal(audit.metadata.loadUp.mismatches, 6, 'only the six C3 mismatches remain');
  assert.equal(audit.metadata.loadUp.alreadyMatching, 740);
  assert.deepEqual(audit.metadata.loadUp.mismatchesBySlot, { '3': 6 });
});

test('real catalogue keeps RAW, lineage and charge structure through the transforms', () => {
  const before = JSON.parse(JSON.stringify(realDatabase));
  const capped = capNaturalElement(before, ELEMENT_CAP);
  const aligned = alignLoadUpC4Types(capped.database);
  const after = aligned.database;
  assert.equal(after.trees.length, before.trees.length);
  for (let i = 0; i < before.trees.length; i++) {
    const treeBefore = before.trees[i];
    const treeAfter = after.trees[i];
    assert.equal(treeAfter.id, treeBefore.id);
    assert.deepEqual(treeAfter.parent, treeBefore.parent);
    assert.equal(treeAfter.levels.length, treeBefore.levels.length);
    for (let j = 0; j < treeBefore.levels.length; j++) {
      const lvBefore = treeBefore.levels[j];
      const lvAfter = treeAfter.levels[j];
      assert.equal(lvAfter.lv, lvBefore.lv);
      assert.equal(lvAfter.raw, lvBefore.raw, 'RAW must never change');
      assert.equal(lvAfter.aff, lvBefore.aff, 'affinity must never change');
      assert.equal(lvAfter.def, lvBefore.def, 'defense must never change');
      assert.equal(lvAfter.slots, lvBefore.slots, 'slots must never change');
      assert.deepEqual(lvAfter.x.coatings, lvBefore.x.coatings, 'coatings must never change');
      assert.deepEqual(lvAfter.x.arc, lvBefore.x.arc, 'shot type must never change');
      assert.equal(lvAfter.x.charges.length, lvBefore.x.charges.length);
      for (let k = 0; k < lvBefore.x.charges.length; k++) {
        const chargeBefore = lvBefore.x.charges[k];
        const chargeAfter = lvAfter.x.charges[k];
        if (k === 3 && chargeBefore.endsWith('!')) {
          // Only the C4 arrow type may change; level and marker are preserved.
          const beforeMatch = /^(Rapid|Pierce|Spread|Heavy) Lv([1-5])!$/.exec(chargeBefore);
          const afterMatch = /^(Rapid|Pierce|Spread|Heavy) Lv([1-5])!$/.exec(chargeAfter);
          assert.ok(beforeMatch && afterMatch, 'C4 charges keep their level and marker');
          assert.equal(afterMatch[2], beforeMatch[2], 'C4 charge level is preserved');
          const c3Type = /^(Rapid|Pierce|Spread|Heavy) /.exec(lvBefore.x.charges[2])[1];
          assert.equal(afterMatch[1], c3Type, 'C4 type aligns with C3');
        } else {
          assert.equal(chargeAfter, chargeBefore, 'only C4 Load Up types change');
        }
      }
    }
  }
});

test('solveElementValue only raises, never exceeds the cap, and respects the windows', () => {
  const line = {
    treeId: 1, branchName: 'Test', rank: 'G', raw: 300, affinity: 0,
    element: { label: 'Agua', type: 'Water', value: 20 },
    coatings: ['Element Coating 2'],
    normalizedCharges: ['Rapid Lv2', 'Rapid Lv3', 'Spread Lv4', 'Spread Lv5!'],
  };
  // Synthetic evaluator: linear ratios per matchup, as the damage model is.
  const evaluateRatio = (_line, elementValue, matchup) => {
    if (matchup === 'favorable') return 0.70 + 0.013 * elementValue;
    if (matchup === 'medium') return 0.85 + 0.004 * elementValue;
    return 0.80 + 0.004 * elementValue;
  };
  const solution = solveElementValue(line, evaluateRatio, { cap: 30 });
  assert.equal(solution.current, 20);
  // The favorable target needs element ~30.8; the cap binds first.
  assert.equal(solution.proposed, 30);
  assert.equal(solution.flag, 'cap');
  assert.equal(solution.changed, true);
  // A line already in the favorable window does not change.
  const inWindowLine = { ...line, element: { ...line.element, value: 30 } };
  const inWindow = solveElementValue(inWindowLine, evaluateRatio, { cap: 30 });
  // At element 30 the favorable synthetic ratio is 1.09, already in window.
  assert.equal(inWindow.proposed, 30);
  assert.equal(inWindow.flag, 'in-window');
  assert.equal(inWindow.changed, false);
});

test('solveElementValue limits the raise when the medium window would be exceeded', () => {
  const line = {
    treeId: 1, branchName: 'Test', rank: 'G', raw: 300, affinity: 0,
    element: { label: 'Agua', type: 'Water', value: 10 },
    coatings: ['Element Coating 2'],
    normalizedCharges: ['Rapid Lv2', 'Rapid Lv3', 'Spread Lv4', 'Spread Lv5!'],
  };
  // Favorable needs element 12 for 1.10; medium hits its 1.08 ceiling first.
  const evaluateRatio = (_line, elementValue, matchup) => {
    if (matchup === 'favorable') return 0.50 + 0.05 * elementValue;
    if (matchup === 'medium') return 0.30 + 0.07 * elementValue;
    return 0.20 + 0.05 * elementValue;
  };
  const solution = solveElementValue(line, evaluateRatio, { cap: 30 });
  assert.equal(solution.proposed, 11);
  assert.equal(solution.flag, 'medium-window');
  assert.ok(solution.proposedRatios.medium <= REBALANCE_WINDOWS.mediumMax + 1e-9);
  assert.ok(solution.proposedRatios.poor <= REBALANCE_WINDOWS.poorMax + 1e-9);
});

test('proposal covers the 74 elemental finals with peer RAW context', () => {
  // Evaluator that returns a fixed ratio so the proposal is deterministic.
  const evaluateRatio = () => 0.85;
  const proposal = proposeElementalRebalance(realDatabase, evaluateRatio);
  assert.equal(proposal.metadata.elementalFinals, 74);
  assert.equal(proposal.metadata.rawFinals, 39);
  assert.equal(proposal.metadata.blastFinals, 3);
  assert.equal(proposal.proposals.length, 74);
  for (const row of proposal.proposals) {
    assert.ok(row.proposed >= row.current, 'proposals never lower the element');
    assert.ok(row.proposed <= ELEMENT_CAP, 'proposals never exceed the cap');
    assert.ok(Number.isInteger(row.proposed));
    assert.ok(row.rawPeers.count > 0, 'each line pairs with same-rank RAW finals');
    assert.ok(['target', 'cap', 'medium-window', 'poor-window', 'in-window', 'cap-bound'].includes(row.flag));
  }
  const ranks = new Set(proposal.proposals.map(row => row.rank));
  assert.deepEqual([...ranks].sort(), ['G', 'HR', 'LR']);
});

test('the real evaluator keeps the stage-9 reference ratio for Elizabeth atenta', () => {
  // Elizabeth atenta: Water 30, Spread Lv5, RAW 250 — the bow used by the
  // stage 9 GitHub Actions test. The same-weapon favorable ratio must stay
  // near the 0.8794 measured on the 93-monster matrix.
  const inventory = terminalLineInventory(realDatabase);
  const line = inventory.elemental.find(entry => entry.branchName === 'Elizabeth atenta');
  assert.ok(line, 'Elizabeth atenta must be an elemental final');
  const evaluateRatio = (target, elementValue, matchup) => {
    const weapon = {
      raw: target.raw,
      aff: target.affinity,
      ele: [[target.element.label, target.element.type, elementValue]],
      x: { charges: target.normalizedCharges, coatings: target.coatings },
    };
    return calculateSequence({
      weapon,
      charge: target.normalizedCharges[2],
      matchup: MATCHUP_PROFILES[matchup],
      slotIndex: 2,
      loadUp: true,
      style: 'guild',
      powerShotUseRate: 1,
      missionShots: 200,
    }).fullMissionVsRaw;
  };
  const solution = solveElementValue(line, evaluateRatio, { cap: ELEMENT_CAP });
  assert.ok(solution.currentRatios.favorable > 0.85);
  assert.ok(solution.currentRatios.favorable < 0.90);
  // Already at the cap: the proposal must not change it.
  assert.equal(line.element.value, 30);
  assert.equal(solution.changed, false);
  assert.equal(solution.flag, 'cap-bound');
});
