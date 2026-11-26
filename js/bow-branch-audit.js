// Branch-aware bow catalogue audit. Read-only: never mutates bow.json.
export const ELEMENTAL_TYPES = new Set(["Fire", "Water", "Thunder", "Ice", "Dragon"]);

export function rankFromRarity(rarity) {
  if (rarity >= 1 && rarity <= 3) return "LR";
  if (rarity >= 4 && rarity <= 7) return "HR";
  if (rarity >= 8 && rarity <= 11) return "G";
  return "Unknown";
}

export function parseCharge(value) {
  const match = /^(Rapid|Pierce|Spread|Heavy) Lv([1-5])(!)?$/.exec(String(value || ""));
  if (!match) return null;
  return { type: match[1], level: Number(match[2]), requiresLoadUp: Boolean(match[3]) };
}

export function normalizeLoadUpCharge(charges, index) {
  const original = charges[index];
  const parsed = parseCharge(original);
  if (!parsed || !parsed.requiresLoadUp || index <= 0) return original;
  const previous = parseCharge(charges[index - 1]);
  if (!previous) return original;
  return previous.type + " Lv" + parsed.level + "!";
}

function getElement(level) {
  const row = (level.ele || []).find(entry =>
    entry && (ELEMENTAL_TYPES.has(entry[1]) || entry[1] === "Blast")
  );
  return row ? { label: row[0], type: row[1], value: Number(row[2] || 0) } : null;
}

function getRole(level) {
  const element = getElement(level);
  if (element && ELEMENTAL_TYPES.has(element.type)) return "elemental";
  if (element && element.type === "Blast") return "blast";
  return "raw";
}

function buildTreeGraph(trees) {
  const byId = new Map(trees.map(tree => [tree.id, tree]));
  const children = new Map();
  for (const tree of trees) {
    if (!tree.parent) continue;
    const parentId = tree.parent[0];
    if (!byId.has(parentId)) {
      throw new Error("Tree " + tree.id + " references missing parent " + parentId + ".");
    }
    if (!children.has(parentId)) children.set(parentId, []);
    children.get(parentId).push(tree.id);
  }

  function pathFor(treeId, visiting = new Set()) {
    if (visiting.has(treeId)) throw new Error("Cycle detected at tree " + treeId + ".");
    const tree = byId.get(treeId);
    if (!tree) throw new Error("Unknown tree " + treeId + ".");
    const next = new Set(visiting);
    next.add(treeId);

    if (!tree.parent) {
      return [{ tree, endLevel: (tree.levels || []).length }];
    }

    const parentId = tree.parent[0];
    const parentLevel = Number(tree.parent[1]);
    const path = pathFor(parentId, next);
    const last = path[path.length - 1];
    path[path.length - 1] = { tree: last.tree, endLevel: parentLevel };
    path.push({ tree, endLevel: (tree.levels || []).length });
    return path;
  }

  const leaves = trees.filter(tree => !children.has(tree.id) && !tree.dummy);
  return { byId, children, leaves, pathFor };
}

function projectState(tree, level, pathIndex) {
  const sourceCharges = [...(level.x?.charges || [])];
  const normalizedCharges = sourceCharges.map((_, index) =>
    normalizeLoadUpCharge(sourceCharges, index)
  );
  const loadUpRows = [];

  sourceCharges.forEach((sourceCharge, index) => {
    const parsed = parseCharge(sourceCharge);
    if (!parsed || !parsed.requiresLoadUp) return;
    const previousCharge = sourceCharges[index - 1] || null;
    const previous = index > 0 ? parseCharge(previousCharge) : null;
    const normalized = normalizedCharges[index];
    loadUpRows.push({
      slot: index + 1,
      sourceCharge,
      previousCharge,
      normalizedCharge: normalized,
      mismatch: normalized !== sourceCharge,
      previousType: previous?.type || null,
      sourceType: parsed.type
    });
  });

  const rarity = Number(level.rar ?? tree.rarity);
  const coatings = [...(level.x?.coatings || [])];
  return {
    treeId: tree.id,
    treeName: tree.nameEs || tree.name,
    localLevel: Number(level.lv),
    pathIndex,
    name: level.nEs || level.n || tree.nameEs || tree.name,
    rarity,
    rank: rankFromRarity(rarity),
    role: getRole(level),
    rawDisplay: Number(level.raw || 0),
    affinity: Number(level.aff || 0),
    element: getElement(level),
    coatings,
    hasPowerCoating2: coatings.includes("Power Coating 2"),
    hasElementCoating2: coatings.includes("Element Coating 2"),
    hasBothLevel2Coatings: coatings.includes("Power Coating 2") && coatings.includes("Element Coating 2"),
    sourceCharges,
    normalizedCharges,
    loadUpRows
  };
}

export function auditBowBranches(database) {
  const trees = (database.trees || []).filter(tree => !tree.dummy);
  const graph = buildTreeGraph(trees);
  const branches = [];
  const mismatchRows = [];
  const markedBySlot = {};
  const mismatchesBySlot = {};
  const roleCounts = {};
  const roleByFinalRank = {};
  const uniqueLevels = new Set();
  let totalLevelRecords = 0;
  let markedLoadUp = 0;

  for (const tree of trees) {
    for (const level of tree.levels || []) {
      totalLevelRecords++;
      uniqueLevels.add(String(tree.id) + ":" + String(level.lv));
      const charges = level.x?.charges || [];
      charges.forEach((charge, index) => {
        const parsed = parseCharge(charge);
        if (!parsed || !parsed.requiresLoadUp) return;
        markedLoadUp++;
        const slot = String(index + 1);
        markedBySlot[slot] = (markedBySlot[slot] || 0) + 1;
        const normalized = normalizeLoadUpCharge(charges, index);
        if (normalized === charge) return;

        mismatchesBySlot[slot] = (mismatchesBySlot[slot] || 0) + 1;
        mismatchRows.push({
          treeId: tree.id,
          treeName: tree.nameEs || tree.name,
          localLevel: Number(level.lv),
          levelName: level.nEs || level.n,
          rarity: Number(level.rar ?? tree.rarity),
          rank: rankFromRarity(Number(level.rar ?? tree.rarity)),
          slot: index + 1,
          sourceCharge: charge,
          previousCharge: charges[index - 1] || null,
          normalizedCharge: normalized
        });
      });
    }
  }

  // Every rendered segment is a line with its own endpoint level, even when
  // that segment also has outgoing child branches. A leaf-only traversal
  // would silently discard the continuation of parent lines.
  for (const line of trees) {
    const segments = graph.pathFor(line.id);
    const pathStates = [];
    let pathIndex = 0;

    for (const segment of segments) {
      const levels = (segment.tree.levels || [])
        .filter(level => Number(level.lv) <= Number(segment.endLevel))
        .sort((a, b) => Number(a.lv) - Number(b.lv));
      for (const level of levels) {
        pathStates.push(projectState(segment.tree, level, pathIndex++));
      }
    }

    if (!pathStates.length) continue;
    const finalState = pathStates[pathStates.length - 1];
    const root = segments[0].tree;
    const progressionRanks = [...new Set(pathStates.map(state => state.rank))];
    const progressionRoles = [...new Set(pathStates.map(state => state.role))];
    const coatingEver = {
      powerCoating2: pathStates.some(state => state.hasPowerCoating2),
      elementCoating2: pathStates.some(state => state.hasElementCoating2),
      bothAtSameStage: pathStates.some(state => state.hasBothLevel2Coatings)
    };
    const finalCoatings = {
      powerCoating2: finalState.hasPowerCoating2,
      elementCoating2: finalState.hasElementCoating2,
      bothAtSameStage: finalState.hasBothLevel2Coatings
    };
    const rankCounts = pathStates.reduce((out, state) => {
      out[state.rank] = (out[state.rank] || 0) + 1;
      return out;
    }, {});

    const branch = {
      rootTreeId: root.id,
      rootName: root.nameEs || root.name,
      leafTreeId: line.id,
      branchName: finalState.name,
      role: finalState.role,
      finalRank: finalState.rank,
      finalRarity: finalState.rarity,
      finalRawDisplay: finalState.rawDisplay,
      finalAffinity: finalState.affinity,
      finalElement: finalState.element,
      segments: segments.map(segment => ({
        treeId: segment.tree.id,
        treeName: segment.tree.nameEs || segment.tree.name,
        throughLocalLevel: segment.endLevel
      })),
      progressionLevels: pathStates.length,
      progressionRanks,
      progressionRankCounts: rankCounts,
      roleTransitions: progressionRoles.length > 1 ? progressionRoles : [],
      minRawDisplay: Math.min(...pathStates.map(state => state.rawDisplay)),
      maxRawDisplay: Math.max(...pathStates.map(state => state.rawDisplay)),
      maxElementDisplay: Math.max(0, ...pathStates.map(state => state.element?.value || 0)),
      coatingEver,
      finalCoatings,
      loadUpMarked: pathStates.reduce((sum, state) => sum + state.loadUpRows.length, 0),
      loadUpMismatches: pathStates.reduce((sum, state) =>
        sum + state.loadUpRows.filter(row => row.mismatch).length, 0),
      pathStates,
      chargeProfiles: pathStates.map(state => ({
        treeId: state.treeId,
        treeName: state.treeName,
        localLevel: state.localLevel,
        rank: state.rank,
        charges: state.sourceCharges,
        normalizedCharges: state.normalizedCharges
      }))
    };

    branches.push(branch);
    roleCounts[branch.role] = (roleCounts[branch.role] || 0) + 1;
    if (!roleByFinalRank[branch.finalRank]) roleByFinalRank[branch.finalRank] = {};
    roleByFinalRank[branch.finalRank][branch.role] =
      (roleByFinalRank[branch.finalRank][branch.role] || 0) + 1;
  }

  branches.sort((a, b) =>
    a.rootName.localeCompare(b.rootName, "es") ||
    a.branchName.localeCompare(b.branchName, "es")
  );

  return {
    metadata: {
      weaponClass: database.labelEs || database.label || "Bow",
      segmentCount: trees.length,
      totalLevelRecords,
      uniqueLevelRecords: uniqueLevels.size,
      rootFamilyCount: trees.filter(tree => !tree.parent).length,
      lineEndpointCount: trees.length,
      graphLeafSegmentCount: graph.leaves.length,
      terminalBranchCount: trees.length,
      branchRoles: roleCounts,
      branchRolesByFinalRank: roleByFinalRank,
      loadUp: {
        marked: markedLoadUp,
        mismatches: mismatchRows.length,
        alreadyMatching: markedLoadUp - mismatchRows.length,
        markedBySlot,
        mismatchesBySlot
      }
    },
    branches,
    loadUpMismatches: mismatchRows
  };
}
