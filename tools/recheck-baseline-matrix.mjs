#!/usr/bin/env node
// Re-confirma la línea base de la matriz teórica con el catálogo previo al
// stage 10, para explicar la discrepancia entre partMeanRatio (0.759/0.835/0.887)
// y meanRatio (0.789/0.869/0.918). Escribe /tmp/matrix-old.json y /tmp/summary-old.json.
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseHitzones } from "../js/bow-balance-sim.js";
import { runMonsterMatrix } from "./bow-elemental-scenarios.mjs";

const bowBefore = JSON.parse(readFileSync("/tmp/bow-before.json", "utf8"));
const monsterData = parseHitzones(readFileSync("/tmp/mhgu-hitzones.js", "utf8"));

const report = runMonsterMatrix(bowBefore, monsterData, {
  missionShots: 200,
  style: "guild",
  elementCap: 30,
});
writeFileSync("/tmp/matrix-old.json", JSON.stringify(report));
console.log("matrix-old written:", report.results.length, "rank-monster rows");
