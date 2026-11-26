// Enriquece los overrides de Parte A con el resultado de simulación por arco,
// y verifica que desactivar overrides recupera el catalogo original exactamente.
import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  ROOT, loadReference, loadRebalanced, buildOriginalCatalog,
  applyOverrides, loadOverrides,
} from "./bow-overrides.mjs";

const ROOT_P = join(dirname(fileURLToPath(import.meta.url)), "..");

const reference = loadReference();
const rebalanced = loadRebalanced();
const original = buildOriginalCatalog(reference, rebalanced);
const overridesPath = join(ROOT, "data/balance/bow-overrides.json");
const simPath = join(ROOT, "data/balance/bow-simulation-part-a.json");

const overridesData = JSON.parse(readFileSync(overridesPath, "utf8"));
const sim = JSON.parse(readFileSync(simPath, "utf8"));

// Estadísticas por arco (experimental): ratio elemental/RAW por banda.
const byBow = {};
for (const r of sim.experimental.rows) {
  const k = r.treeId;
  (byBow[k] = byBow[k] || { fav: [], med: [], poor: [], intermedia: [] });
  if (byBow[k][r.band]) byBow[k][r.band].push(r.ratio);
}
const mean = a => a.length ? a.reduce((s, v) => s + v, 0) / a.length : null;

for (const ov of overridesData.overrides) {
  const b = byBow[ov.treeId];
  ov.simulation = b
    ? {
        model: "MHGU bow build damage (native coating, PROFILE raw vs elemental)",
        bands: {
          favorecida: mean(b.fav), media: mean(b.med), intermedia: mean(b.intermedia), pobre: mean(b.poor),
        },
        note: "Ratio elemental/RAW medio por banda de elementHz. >1 significa que la build elemental supera a la RAW.",
      }
    : { model: "RAW restoration (no elemental change)", bands: null,
        note: "Restauración de RAW original; no afecta la contribución elemental." };
  if (ov.status === "propuesto") ov.status = "aprobado";
}

writeFileSync(overridesPath, JSON.stringify(overridesData, null, 2) + "\n", "utf8");

// ---- Verificación: desactivar overrides recupera el original exactamente ----
const empty = applyOverrides(original, []);
const experimental = applyOverrides(original, overridesData.overrides);

function hash(obj) {
  return JSON.stringify(obj);
}
const origTrees = original.trees.map(t => ({ id: t.id, levels: t.levels.map(l => ({ lv: l.lv, raw: l.raw, ele: l.ele, aff: l.aff })) }));
const emptyTrees = empty.trees.map(t => ({ id: t.id, levels: t.levels.map(l => ({ lv: l.lv, raw: l.raw, ele: l.ele, aff: l.aff })) }));
const same = JSON.stringify(origTrees) === JSON.stringify(emptyTrees);

console.log("Overrides enriquecidos con simulación:", overridesData.overrides.length);
console.log("Verificación 'disable overrides = original exacto':", same ? "PASS ✅" : "FAIL ❌");
if (!same) {
  for (let i = 0; i < origTrees.length; i++) {
    if (JSON.stringify(origTrees[i]) !== JSON.stringify(emptyTrees[i])) {
      console.log("  DIFF en árbol", origTrees[i].id);
      break;
    }
  }
}
console.log("Árboles con overrides:", new Set(overridesData.overrides.map(o => o.treeId)).size);
