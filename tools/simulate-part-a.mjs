// Simulación de Parte A: mide la contribución real del elemento restaurado
// frente al cap-30, y verifica el objetivo de diseño sobre los 93 monstruos
// grandes. Compara tres estados: original, rebalanceado, experimental.
//
// Para cada arco elemental (nivel terminal) calcula la descarga RAW vs la
// descarga elemental (perfiles PROFILE) sobre cada hitzone, y agrupa por bandas
// de elementHz (favorecida >=25, media 15-24, pobre <=10).
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  makeWeaponCandidates, calculateVolley, PROFILE, parseHitzones, ELEMENTS,
} from "../js/bow-balance-sim.js";
import {
  ROOT, loadReference, loadRebalanced, buildOriginalCatalog,
  applyOverrides, loadOverrides, writeJson,
} from "./bow-overrides.mjs";

const reference = loadReference();
const rebalanced = loadRebalanced();
const original = buildOriginalCatalog(reference, rebalanced);
const overrides = loadOverrides(join(ROOT, "data/balance/bow-overrides.json"));
const experimental = applyOverrides(original, overrides);

const hitzoneRaw = readFileSync(join(ROOT, "tools/data-hitzones.js"), "utf8");
const hitzones = parseHitzones(hitzoneRaw);
const monsters = hitzones.monsters.filter(m => m.large && m.tables?.[0]?.length);

// Bandas de elementHz
function band(hz) {
  if (hz >= 25) return "favorecida";
  if (hz >= 15) return "media";
  if (hz <= 10) return "pobre";
  return "intermedia";
}

// Para un catálogo, mide la ratio elemental/RAW por banda y por arco.
function measureCatalog(catalog, label) {
  const candidates = makeWeaponCandidates(catalog, { loadUpPolicy: "match-c3" });
  // Arcos elementales en nivel terminal (maxLevel del árbol).
  const byTree = new Map(catalog.trees.map(t => [Number(t.id), t]));
  const rows = [];
  const bandStats = { favorecida: [], media: [], intermedia: [], pobre: [] };
  const bandByElement = {};
  for (const tree of catalog.trees) {
    if (tree.levels?.length && tree.levels[tree.levels.length - 1].ele?.length) {
      const tid = Number(tree.id);
      const terminalLv = tree.levels[tree.levels.length - 1].lv;
      const main = candidates.find(w => w.treeId === tid && w.level === terminalLv);
      if (!main || !main.elements.length) continue;
      const elemType = main.elements[0].type;
      const shared = { coatingMode: "native", elementCoatingMode: "native", elementCoatingCapacity: 20 };
      for (const monster of monsters) {
        for (const part of monster.tables[0]) {
          const shotHz = Number(part[4] || 0);
          const elementHz = elemType ? Number(part[5 + ELEMENTS[elemType]] || 0) : 0;
          const raw = calculateVolley(main, part, { ...shared, profile: PROFILE.raw });
          const ele = calculateVolley(main, part, { ...shared, profile: PROFILE.elemental });
          if (raw.totalDamage <= 0) continue;
          const ratio = ele.totalDamage / raw.totalDamage;
          const b = band(elementHz);
          bandStats[b].push(ratio);
          (bandByElement[elemType] = bandByElement[elemType] || {})[b] = bandByElement[elemType][b] || [];
          bandByElement[elemType][b].push(ratio);
          rows.push({ treeId: tid, name: main.name, element: elemType, elementHz, band: b, ratio });
        }
      }
    }
  }
  const summarize = arr => arr.length
    ? { count: arr.length, meanRatio: arr.reduce((s, v) => s + v, 0) / arr.length,
        wins: arr.filter(v => v > 1).length } : { count: 0, meanRatio: null, wins: 0 };
  return {
    label,
    catalog: label,
    bandSummary: Object.fromEntries(Object.entries(bandStats).map(([k, v]) => [k, summarize(v)])),
    bandByElement: Object.fromEntries(Object.entries(bandByElement).map(([k, v]) =>
      [k, Object.fromEntries(Object.entries(v).map(([kk, vv]) => [kk, summarize(vv)]))])),
    rows,
  };
}

const orig = measureCatalog(original, "original");
const reb = measureCatalog(rebalanced, "rebalanceado");
const exp = measureCatalog(experimental, "experimental");

// Ratio experimental vs rebalanceado por banda (efecto de restaurar valores).
function bandRatio(a, b) {
  const key = Object.keys(a.bandSummary)[0];
  return Object.fromEntries(Object.keys(a.bandSummary).map(k => [k, {
    reb: a.bandSummary[k].meanRatio, exp: b.bandSummary[k].meanRatio,
  }]));
}

const result = {
  stage: "16.1-parte-a-simulacion",
  generatedAt: new Date().toISOString(),
  monsterCount: monsters.length,
  bandDefinition: { favorecida: "elementHz >= 25", media: "15-24", intermedia: "11-14", pobre: "<= 10" },
  profiles: {
    raw: "RAW optimizado (Ataque+, Experto, Maza, Crit, ShotUp)",
    elemental: "Elemental optimizado (Elemental, Atk-elemento+, Crítico elemental, Maza, ShotUp)",
  },
  original: { bandSummary: orig.bandSummary },
  rebalanceado: { bandSummary: reb.bandSummary },
  experimental: { bandSummary: exp.bandSummary, rows: exp.rows },
  experimentalVsRebalanced: bandRatio(reb, exp),
  byElementExperimental: exp.bandByElement,
  designGoalCheck: {
    "favorecida (elemental debe superar RAW)": exp.bandSummary.favorecida,
    "media (deben competir)": exp.bandSummary.media,
    "pobre (RAW puede ganar)": exp.bandSummary.pobre,
  },
  assumptions: [
    "Descarga teórica por hitzone; coating nativo nivel I, capacidad elemento 20.",
    "Perfiles PROFILE fijos (5 habilidades ofensivas); no es DPS cronológico.",
    "Miden los valores elementales restaurados frente al cap-30 del catálogo.",
  ],
};

writeJson(join(ROOT, "data/balance/bow-simulation-part-a.json"), result);

console.log("=== Simulación Parte A (ratio elemental/RAW por banda) ===\n");
for (const st of ["original", "rebalanceado", "experimental"]) {
  const s = result[st].bandSummary;
  console.log(`[${st}]`);
  for (const [b, v] of Object.entries(s)) {
    console.log(`  ${b}: n=${v.count} mean=${v.meanRatio === null ? "—" : v.meanRatio.toFixed(3)} elemental-wins=${v.wins}`);
  }
}
console.log("\n=== Efecto experimental vs rebalanceado (restauración) ===");
for (const [b, v] of Object.entries(result.experimentalVsRebalanced)) {
  console.log(`  ${b}: reb=${v.reb.toFixed(3)} -> exp=${v.exp.toFixed(3)}`);
}
