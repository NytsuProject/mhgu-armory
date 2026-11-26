// Motor de overrides para el rediseño elemental (Stage 16.1 - Parte A).
//
// Genera tres catálogos en formato compatible con makeWeaponCandidates():
//   - original     : stats MHXX originales (de la referencia, inmutable)
//   - rebalanceado : catálogo actual (data/weapons/bow.json)
//   - experimental : referencia + overrides propuestos (Parte A)
//
// Desactivar overrides (lista vacía) recupera exactamente `original`.
// Todo vive fuera de la referencia; la referencia nunca se muta.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

// Normalización: la referencia guarda `ele` como [label, tipo, valor] o null y
// coatings con nombres propios. El catálogo usa [[label,tipo,valor]] y nombres
// estándar. makeWeaponCandidates espera el formato del catálogo.
const ELEMENTS = { Fire: 0, Water: 1, Thunder: 2, Ice: 3, Dragon: 4 };

export function normalizeElement(ele) {
  if (!ele) return [];
  if (Array.isArray(ele) && ele.length === 3 && !Array.isArray(ele[0])) {
    return [ele]; // ya es una fila plana
  }
  if (Array.isArray(ele) && Array.isArray(ele[0])) return ele; // ya es [[]]
  return [];
}

const COATING_MAP = {
  "Power Coating Lv1": "Power Coating",
  "Power Coating Lv2": "Power Coating 2",
  "Element Coating Lv1": "Element Coating",
  "Element Coating Lv2": "Element Coating 2",
  "C.Range Coating": "Close Range Coating",
  "Close Range Coating": "Close Range Coating",
};

export function normalizeCoatings(list) {
  return (list || []).map(c => COATING_MAP[c] ?? c);
}

// Construye un árbol original en formato del catálogo a partir de la referencia,
// conservando la estructura (nombres, cargas, slots, rareza, coatings) del
// catálogo actual y sustituyendo raw/aff/def/ele por los valores originales.
export function buildOriginalCatalog(reference, rebalanced) {
  const curBy = new Map((rebalanced.trees || []).filter(t => !t.dummy).map(t => [Number(t.id), t]));
  const trees = (reference.trees || []).map(refTree => {
    const cur = curBy.get(Number(refTree.id));
    const levels = (refTree.levels || []).map(rlv => {
      const clv = (cur?.levels || []).find(l => Number(l.lv) === Number(rlv.lv)) || {};
      return {
        lv: Number(rlv.lv),
        n: clv.n ?? rlv.n,
        nEs: clv.nEs ?? rlv.nEs,
        raw: Number(rlv.raw),
        aff: Number(rlv.aff),
        def: Number(rlv.def),
        slots: clv.slots ?? rlv.slots,
        rar: clv.rar ?? rlv.rar,
        x: {
          arc: clv.x?.arc ?? rlv.x?.arc,
          charges: clv.x?.charges ?? rlv.x?.charges ?? [],
          coatings: normalizeCoatings(clv.x?.coatings ?? rlv.x?.coatings),
          boost: rlv.x?.boost ?? clv.x?.boost ?? [],
        },
        ele: normalizeElement(rlv.ele),
      };
    });
    return {
      id: Number(refTree.id),
      name: cur?.name ?? refTree.name,
      nameEs: cur?.nameEs ?? refTree.nameEs,
      rarity: cur?.rarity ?? refTree.rarity,
      finalName: cur?.finalName ?? refTree.finalName,
      finalNameEs: cur?.finalNameEs,
      maxLevel: Number(refTree.maxLevel),
      parent: cur?.parent ?? (refTree.parent ? [refTree.parent[0], refTree.parent[1]] : null),
      levels,
    };
  });
  // Árboles nuevos (108-116): no tienen referencia; se construyen del actual.
  for (const t of (rebalanced.trees || []).filter(t => !t.dummy && Number(t.id) >= 108)) {
    trees.push(JSON.parse(JSON.stringify({
      ...t,
      levels: t.levels.map(l => ({ ...l, ele: normalizeElement(l.ele) })),
    })));
  }
  return { version: 1, trees };
}

export function loadReference() {
  return JSON.parse(readFileSync(join(ROOT, "data/reference/mhxx-bow-original.json"), "utf8"));
}

export function loadRebalanced() {
  return JSON.parse(readFileSync(join(ROOT, "data/weapons/bow.json"), "utf8"));
}

// Aplica un conjunto de overrides a un catálogo original. Cada override:
//   { treeId, level, field: "raw"|"aff"|"def"|"ele", value, ...}
// Devuelve una copia con los cambios aplicados.
export function applyOverrides(catalog, overrides) {
  const next = JSON.parse(JSON.stringify(catalog));
  const byTree = new Map(next.trees.map(t => [Number(t.id), t]));
  for (const ov of overrides) {
    const tree = byTree.get(Number(ov.treeId));
    if (!tree) continue;
    const level = (tree.levels || []).find(l => Number(l.lv) === Number(ov.level));
    if (!level) continue;
    if (ov.field === "ele") {
      const raw = ov.proposed !== undefined ? ov.proposed : ov.value;
      level.ele = normalizeElement(typeof raw === "string" ? JSON.parse(raw) : raw);
    } else if (ov.field in level) {
      const raw = ov.proposed !== undefined ? ov.proposed : ov.value;
      level[ov.field] = Number(raw);
    }
  }
  return next;
}

export function loadOverrides(path) {
  try {
    return JSON.parse(readFileSync(path, "utf8")).overrides || [];
  } catch {
    return [];
  }
}

export function writeJson(path, data) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(data, null, 2) + "\n", "utf8");
}

export { ROOT, ELEMENTS };
