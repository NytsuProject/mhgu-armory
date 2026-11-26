// Genera la propuesta de Parte A (Stage 16.1): identidades elementales y
// overrides. Construye:
//   - data/balance/bow-overrides.json
//   - data/balance/bow-specializations.json
//   - data/balance/balance-metadata.json
//   - data/balance/bow-comparison-original-proposed.csv
//
// Estrategia (evidenciada por la auditoría):
//   1. Restaurar los valores elementales NATURALES originales de MHXX para todos
//      los arcos elementales (retira el cap-30 y recupera diversidad 5-60).
//   2. Restaurar la identidad RAW de los 7 convertidos que eran RAW puros
//      (13,60,87,98,100,103,106): eliminar la ramp artificial y el RAW reducido.
//   3. Restaurar la progresión natural + RAW original de los 3 convertidos que
//      ya tenían identidad elemental genuina (80,91,93).
//   4. 44 preservados: sin cambios (ya coinciden con el original).
//   5. 9 ramas nuevas (108-116): extensiones experimentales; progresión coherente
//      con la mediana NATURAL de cada elemento (evidencia-base, no 30 universal).
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  ROOT, loadReference, loadRebalanced, buildOriginalCatalog,
  applyOverrides, writeJson, normalizeElement,
} from "./bow-overrides.mjs";

const NEW_BRANCHES = new Set(Array.from({ length: 9 }, (_, i) => 108 + i));
const ELEM_LABEL = { Fire: "Fuego", Water: "Agua", Thunder: "Rayo", Ice: "Hielo", Dragon: "Dragón", Blast: "Explosión" };
// Los 10 convertidos en Stage-15.
const CONVERTED = [13, 60, 80, 87, 91, 93, 98, 100, 103, 106];
// De los 10, los que originalmente eran RAW puros (sin elemento).
const CONVERTED_RAW_ONLY = [13, 60, 87, 98, 100, 103, 106];
// Los que ya tenían elemento natural genuino.
const CONVERTED_HAD_ELEM = [80, 91, 93];

const reference = loadReference();
const rebalanced = loadRebalanced();
const original = buildOriginalCatalog(reference, rebalanced);

const origBy = new Map(original.trees.map(t => [Number(t.id), t]));

// Mediana natural del elemento terminal por tipo (evidencia-base para ramas nuevas).
function median(values) {
  const s = [...values].filter(Number.isFinite).sort((a, b) => a - b);
  if (!s.length) return null;
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : Math.round((s[mid - 1] + s[mid]) / 2);
}
const elemMedian = {};
for (const t of original.trees) {
  if (NEW_BRANCHES.has(Number(t.id))) continue;
  const last = (t.levels || [])[t.levels.length - 1];
  const ele = normalizeElement(last?.ele)[0];
  if (ele) {
    (elemMedian[ele[1]] = elemMedian[ele[1]] || []).push(Number(ele[2]));
  }
}
for (const k of Object.keys(elemMedian)) elemMedian[k] = median(elemMedian[k]);

// ---- Clasificación de identidad y generación de overrides ----
const overrides = [];
const specializations = [];
const identityCounts = {};

function classifyIdentity(terminalEle) {
  if (terminalEle === null || terminalEle === undefined) return "raw-especializado";
  if (terminalEle <= 24) return "elemental-moderado";
  if (terminalEle <= 34) return "elemental-equilibrado";
  if (terminalEle <= 44) return "elemental-especializado";
  return "elemental-extremo";
}

for (const t of original.trees) {
  const tid = Number(t.id);
  const isNew = NEW_BRANCHES.has(tid);
  const levels = t.levels || [];
  const last = levels[levels.length - 1];
  const origEle = normalizeElement(last?.ele)[0];
  const origTerminalEle = origEle ? Number(origEle[2]) : null;
  const elemType = origEle ? origEle[1] : null;

  // Calcular el elemento propuesto para cada nivel.
  const proposals = [];
  let justification;
  if (isNew) {
    // Rama experimental: progresión coherente con la mediana natural del elemento.
    const type = elemType || t.element;
    const target = elemMedian[type] || 25;
    const label = ELEM_LABEL[type];
    const maxlv = levels.length;
    for (const lv of levels) {
      // ramp natural suave (no lineal a tope 30): progresión creciente al target.
      const frac = lv.lv / maxlv;
      const val = Math.max(3, Math.round(target * (0.25 + 0.75 * frac)));
      proposals.push({ lv: lv.lv, ele: [[label, type, val]] });
    }
    justification = `Rama experimental sin original. Progresión coherente hacia la mediana natural del elemento ${type} (${target}) en los arcos originales; no se impone el tope 30 universal.`;
  } else if (CONVERTED_RAW_ONLY.includes(tid)) {
    // Restaurar identidad RAW: eliminar elemento artificial y RAW original.
    for (const lv of levels) {
      proposals.push({ lv: lv.lv, ele: [] });
    }
    justification = `Conversión Stage-15 destruyó una identidad RAW original (arco RAW puro). Se restaura la identidad RAW: se elimina la ramp elemental artificial y se recupera el RAW original, preservando la cobertura RAW.`;
  } else if (CONVERTED_HAD_ELEM.includes(tid)) {
    // Restaurar progresión natural + RAW original.
    for (const lv of levels) {
      proposals.push({ lv: lv.lv, ele: normalizeElement(
        (reference.trees.find(x => Number(x.id) === tid)?.levels.find(x => x.lv === lv.lv)?.ele)
      ) });
    }
    justification = `Conversión Stage-15 reemplaza la progresión elemental natural genuina por una ramp lineal a 30 y reduce RAW. Se restaura la progresión natural original y el RAW original.`;
  } else if (origTerminalEle !== null) {
    // Elemental: restaurar valores naturales originales (retira cap-30).
    for (const lv of levels) {
      proposals.push({ lv: lv.lv, ele: normalizeElement(
        (reference.trees.find(x => Number(x.id) === tid)?.levels.find(x => x.lv === lv.lv)?.ele)
      ) });
    }
    const wasCapped = last.ele && normalizeElement(last.ele)[0] && Number(normalizeElement(last.ele)[0][2]) === 30
      && origTerminalEle !== 30;
    justification = wasCapped
      ? `El cap-30 homogeneizaba el elemento terminal (orig ${origTerminalEle}) a 30. Se restaura el valor natural original (${origTerminalEle}) y su progresión, retirando el tope universal.`
      : `Elemento terminal natural ya era ${origTerminalEle}; se conserva la progresión original (sin cambio neto frente al catálogo).`;
  } else {
    // RAW puro sin conversión: sin cambios.
    for (const lv of levels) proposals.push({ lv: lv.lv, ele: [] });
    justification = "Arco RAW original sin elemento: identidad RAW-especializada, sin cambios.";
  }

  // Generar overrides para TODOS los árboles que la propuesta toca (registro
  // completo y auditable). Cuando la propuesta es restaurar el original,
  // original == propuesto (se registra igual, con justificación y simulación).
  const touched = !isNew ? (origTerminalEle !== null || CONVERTED.includes(tid)) : true;
  for (const p of proposals) {
    if (!touched && CONVERTED_RAW_ONLY.includes(tid) === false && origTerminalEle === null) continue;
    const origEleRow = normalizeElement(
      (origBy.get(tid)?.levels.find(l => Number(l.lv) === p.lv)?.ele) || []
    );
    const ov = {
      treeId: tid, level: p.lv, field: "ele",
      original: JSON.stringify(origEleRow),
      proposed: JSON.stringify(normalizeElement(p.ele)),
      justification,
      status: "propuesto",
      simulation: null, // se llena en la etapa de simulación
    };
    overrides.push(ov);
  }

  // RAW: restaurar original solo en los convertidos.
  if (CONVERTED.includes(tid)) {
    for (const lv of levels) {
      const origRaw = Number(lv.raw);
      // el original ya tiene raw original; el catálogo actual lo redujo.
      // Se registra un override de raw si el catálogo actual difiere.
      const curRaw = Number((rebalanced.trees.find(x => Number(x.id) === tid)
        ?.levels.find(x => Number(x.lv) === lv.lv)?.raw) ?? origRaw);
      if (curRaw !== origRaw) {
        overrides.push({
          treeId: tid, level: lv.lv, field: "raw",
          original: origRaw, proposed: origRaw,
          justification: "Restauración del RAW original del convertido Stage-15 (el catálogo había reducido RAW en todos los niveles).",
          status: "propuesto", simulation: null,
        });
      }
    }
  }

  // Especialización.
  let identity;
  if (isNew) {
    identity = elemType ? (elemMedian[elemType] >= 45 ? "elemental-extremo"
      : elemMedian[elemType] >= 35 ? "elemental-especializado"
      : elemMedian[elemType] >= 25 ? "elemental-equilibrado" : "elemental-moderado") : "raw-especializado";
  } else {
    const propTerminal = proposals[proposals.length - 1].ele;
    const propVal = Array.isArray(propTerminal) && propTerminal.length ? Number(propTerminal[0][2]) : null;
    identity = classifyIdentity(propVal);
  }
  identityCounts[identity] = (identityCounts[identity] || 0) + 1;
  specializations.push({
    treeId: tid,
    nameEs: t.nameEs,
    identity,
    element: elemType,
    originalTerminalElement: origTerminalEle,
    proposedTerminalElement: (() => {
      const p = proposals[proposals.length - 1].ele;
      return Array.isArray(p) && p.length ? Number(p[0][2]) : null;
    })(),
    isNewBranch: isNew,
    converted: CONVERTED.includes(tid),
  });
}

// ---- Metadata ----
import { createHash } from "node:crypto";
function sha256(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}
const metadata = {
  stage: "16.1-parte-a",
  generatedAt: new Date().toISOString(),
  branch: "rework/bow-specialization-stage13",
  referenceHashes: {
    json: sha256(join(ROOT, "data/reference/mhxx-bow-original.json")),
    csv: sha256(join(ROOT, "data/reference/mhxx-bow-original.csv")),
  },
  sources: ["MHGU-LookUp (master)", "Kiranico MHXX /en/yumi"],
  protected: [
    "data/reference/mhxx-bow-original.json",
    "data/reference/mhxx-bow-original.csv",
    "data/weapons/bow.json (no se sobrescribe; se usa como estado 'rebalanceado')",
  ],
  protectedMechanics: [
    "CHARGE_RAW", "CHARGE_ELEMENT", "SHOT_MVS", "SHOT_TYPE_UP",
    "fórmulas de daño físico/afinidad/crítico elemental", "coatings", "mecánicas de Spread",
  ],
  elementMedianNatural: elemMedian,
  identityCounts,
  overrideCount: overrides.length,
  designRule: "No existe un tope de elemento universal. Cada arma conserva/alcanza un valor elemental según su identidad, recuperando la diversidad natural MHXX (5-60).",
};

writeJson(join(ROOT, "data/balance/bow-overrides.json"), {
  version: 1,
  description: "Overrides de Parte A: restauración de valores elementales naturales y identidades. Desactivar (lista vacía) recupera el catalogo original exacto.",
  overrides,
});
writeJson(join(ROOT, "data/balance/bow-specializations.json"), {
  version: 1,
  identities: {
    "raw-especializado": "Arco RAW puro o restaurado; sin elemento. Enfoque en RAW y cobertura.",
    "elemental-moderado": "Elemento natural moderado (terminal ~<=24).",
    "elemental-equilibrado": "Elemento natural medio (terminal ~25-34).",
    "elemental-especializado": "Elemento natural alto (terminal ~35-44).",
    "elemental-extremo": "Elemento natural extremo (terminal >=45, hasta 60).",
  },
  trees: specializations,
});
writeJson(join(ROOT, "data/balance/balance-metadata.json"), metadata);

// ---- CSV comparación original vs propuesta ----
const csvRows = [["treeId", "name_es", "level", "stat", "original", "proposed", "identity", "justification"]];
for (const sp of specializations) {
  const t = origBy.get(sp.treeId);
  for (const lv of t.levels) {
    const origEle = normalizeElement(lv.ele)[0];
    const ov = overrides.find(o => o.treeId === sp.treeId && o.level === lv.lv && o.field === "ele");
    const propEle = ov ? JSON.parse(ov.proposed)[0] : origEle;
    csvRows.push([sp.treeId, sp.nameEs, lv.lv, "ele",
      origEle ? origEle[2] : "", propEle ? propEle[2] : "", sp.identity, "ele"]);
    const rawOv = overrides.find(o => o.treeId === sp.treeId && o.level === lv.lv && o.field === "raw");
    if (rawOv) {
      csvRows.push([sp.treeId, sp.nameEs, lv.lv, "raw", rawOv.original, rawOv.proposed, sp.identity, rawOv.justification]);
    }
  }
}
const csvPath = join(ROOT, "data/balance/bow-comparison-original-proposed.csv");
mkdirSync(dirname(csvPath), { recursive: true });
writeFileSync(csvPath, csvRows.map(r => r.join(";")).join("\n") + "\n", "utf8");

console.log("Propuesta Parte A generada.");
console.log("Overrides:", overrides.length, "| árboles:", specializations.length);
console.log("Identidades:", JSON.stringify(identityCounts));
console.log("Mediana natural por elemento:", JSON.stringify(elemMedian));
console.log("CSV:", csvPath);
