#!/usr/bin/env node
/**
 * Etapa 10: rebalance elemental acotado del arco.
 *
 * Aplica (o informa) las dos decisiones de catálogo acordadas —tope de
 * elemento natural 30 y normalización C4 de Recargando— y resuelve la
 * propuesta de valores elementales para las 55 líneas terminales
 * elementales frente a las 46 RAW del mismo rango.
 *
 * Modos:
 *   (sin flags)          informe de los cambios de catálogo, sin escribir.
 *   --apply              aplica tope + normalización C4 a bow.json.
 *   --proposal           calcula la propuesta y escribe JSON/CSV en tools/out.
 *   --apply-proposal     aplica tope + normalización C4 + propuesta a bow.json
 *                        y escribe los artefactos de la propuesta.
 *
 * La propuesta se evalúa con el modelo de escenarios de la etapa 5
 * (Elemental Full vs RAW, estilo Guild, tercera carga) y se limita por las
 * ventanas de diseño: +10% en hitzones favorables, paridad o ligeramente
 * por encima en medias, ventaja clara para RAW en pobres.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  MATCHUP_PROFILES,
  ELEMENT_CAP,
  alignLoadUpC4Types,
  capNaturalElement,
  proposeElementalRebalance,
} from "../js/bow-elemental-rebalance.js";
import { calculateSequence } from "./bow-elemental-scenarios.mjs";

const here = dirname(fileURLToPath(import.meta.url));

function makeRatioEvaluator() {
  return (line, elementValue, matchup) => {
    const profile = MATCHUP_PROFILES[matchup];
    if (!profile) throw new Error("Matchup no reconocido: " + matchup);
    const weapon = {
      raw: line.raw,
      aff: line.affinity,
      ele: [[line.element.label, line.element.type, elementValue]],
      x: { charges: line.normalizedCharges, coatings: line.coatings },
    };
    const row = calculateSequence({
      weapon,
      charge: line.normalizedCharges[2],
      matchup: profile,
      slotIndex: 2,
      loadUp: true,
      style: "guild",
      powerShotUseRate: 1,
      missionShots: 200,
    });
    return row.fullMissionVsRaw;
  };
}

function writeProposalArtifacts(proposal, outDir) {
  mkdirSync(outDir, { recursive: true });
  const jsonPath = resolve(outDir, "bow-elemental-rebalance-proposal.json");
  writeFileSync(jsonPath, JSON.stringify(proposal, null, 2) + "\n", "utf8");
  const header = [
    "rank", "rootName", "branchName", "raw", "elementType", "elementCurrent",
    "elementProposed", "changed", "flag", "c3Type", "c3Level", "c3RequiresLoadUp",
    "coatings", "slots", "ratioFavCurrent", "ratioMedCurrent", "ratioPoorCurrent",
    "ratioFavProposed", "ratioMedProposed", "ratioPoorProposed",
    "rawPeersCount", "rawPeersMaxRaw", "rawPeersMaxRawName",
  ];
  const quote = value => {
    const text = typeof value === "object" ? JSON.stringify(value) : String(value ?? "");
    return /[",\n]/.test(text) ? '"' + text.replaceAll('"', '""') + '"' : text;
  };
  const csv = [
    header.join(","),
    ...proposal.proposals.map(row => header.map(key => {
      let value = row[key];
      if (key === "elementCurrent") value = row.element?.value ?? "";
      if (key === "elementProposed") value = row.proposed;
      if (key === "elementType") value = row.element?.type ?? "";
      if (key === "coatings") value = (row.coatings || []).join(" | ");
      return quote(value);
    }).join(",")),
  ].join("\n");
  const csvPath = resolve(outDir, "bow-elemental-rebalance-proposal.csv");
  writeFileSync(csvPath, csv + "\n", "utf8");
  return { jsonPath, csvPath };
}

function printCatalogChanges(capChanges, alignChanges) {
  console.log("Tope de elemento natural 30: " + capChanges.length + " registros afectados.");
  for (const change of capChanges) {
    console.log(`  ${change.treeName} Lv${change.localLevel} (${change.name}): ` +
      `${change.element} ${change.from} -> ${change.to}`);
  }
  console.log("Normalización C4 de Recargando: " + alignChanges.length + " cargas alineadas.");
  const byPair = new Map();
  for (const change of alignChanges) {
    const key = change.from.replace(/ Lv[0-9]+!$/, "") + " -> " +
      change.to.replace(/ Lv[0-9]+!$/, "");
    byPair.set(key, (byPair.get(key) || 0) + 1);
  }
  for (const [pair, count] of [...byPair.entries()].sort()) {
    console.log("  " + pair + ": " + count);
  }
}

function printProposal(proposal) {
  console.log("Propuesta elemental: " + proposal.metadata.elementalFinals +
    " finales (" + proposal.metadata.changed + " con cambios) frente a " +
    proposal.metadata.rawFinals + " finales RAW y " + proposal.metadata.blastFinals +
    " Explosión.");
  console.log(["rango", "línea", "RAW", "elem", "nuevo", "bandera",
    "fav", "med", "poor"].join(" | "));
  for (const row of proposal.proposals) {
    console.log([
      row.rank,
      row.branchName,
      row.raw,
      row.element?.value,
      row.proposed,
      row.flag,
      row.proposedRatios.favorable.toFixed(3),
      row.proposedRatios.medium.toFixed(3),
      row.proposedRatios.poor.toFixed(3),
    ].join(" | "));
  }
}

function main() {
  const args = process.argv.slice(2);
  const bowsArg = args.find(arg => arg.startsWith("--bows="));
  const bowsPath = resolve(bowsArg ? bowsArg.slice(7) : "data/weapons/bow.json");
  const outArg = args.find(arg => arg.startsWith("--out="));
  const outDir = outArg ? resolve(outArg.slice(6)) : resolve(here, "out");
  const apply = args.includes("--apply") || args.includes("--apply-proposal");
  const proposalMode = args.includes("--proposal") || args.includes("--apply-proposal");
  const applyProposal = args.includes("--apply-proposal");

  const database = JSON.parse(readFileSync(bowsPath, "utf8"));
  const capped = capNaturalElement(database, ELEMENT_CAP);
  const aligned = alignLoadUpC4Types(capped.database);
  printCatalogChanges(capped.changes, aligned.changes);

  let proposal = null;
  if (proposalMode) {
    proposal = proposeElementalRebalance(aligned.database, makeRatioEvaluator());
    const artifacts = writeProposalArtifacts(proposal, outDir);
    printProposal(proposal);
    console.log("Artefactos: " + artifacts.jsonPath);
    console.log("Artefactos: " + artifacts.csvPath);
  }

  if (apply) {
    let target = aligned.database;
    if (applyProposal) {
      target = JSON.parse(JSON.stringify(aligned.database));
      for (const proposalRow of proposal.proposals) {
        if (!proposalRow.changed) continue;
        const tree = target.trees.find(entry => entry.id === proposalRow.treeId);
        if (!tree) throw new Error("Árbol faltante: " + proposalRow.treeId);
        const level = tree.levels.find(entry => Number(entry.lv) === proposalRow.localLevel);
        if (!level) throw new Error("Nivel faltante en árbol " + proposalRow.treeId);
        const row = (level.ele || []).find(entry => entry && entry[1] === proposalRow.element.type);
        if (!row) throw new Error("Registro elemental faltante en " + proposalRow.branchName);
        row[2] = proposalRow.proposed;
      }
    }
    // The weapon catalogues are minified single-line JSON; keep that format.
    writeFileSync(bowsPath, JSON.stringify(target), "utf8");
    console.log("bow.json escrito: " + bowsPath);
  } else if (!proposalMode) {
    console.log("Nada escrito. Pasa --apply para aplicar tope + normalización C4, " +
      "o --proposal para calcular la propuesta.");
  }
}

try {
  main();
} catch (error) {
  console.error("Error: " + error.message);
  process.exitCode = 1;
}
