#!/usr/bin/env node
// Stage 12, parte C: barrido de sensibilidad de los multiplicadores elementales
// de las cargas (C1..C4).
//
// Modelo actual: C1 x0.70 / C2 x0.85 / C3 x1.00 / C4 x1.125.
// El barrido modifica UN multiplicador a la vez (los demás mantienen el valor
// base) y evalúa la ratio elemental/RAW sobre los 93 monstruos grandes.
//
// CORRECCIÓN (stage 12 feedback): NO se escala el elemento agregado con una
// única cifra. Se RE-EJECUTA la simulación de daño con `chargeElementMultipliers`
// (array de 4, uno por carga) de modo que cada carga de la secuencia Guild
// aplique su propio multiplicador. La secuencia puede contener más de una
// carga; el simulador ya aplica chargeElementMultipliers[slotIndex] por voltaje.
//
// Se desglosa por rango (LR/HR/G), elemento (Fuego/Agua/Rayo/Hielo/Dragón),
// tipo de disparo, carga (C1..C4) y banda de hitzone elemental
// (favorable/media/pobre). Luego se combinan los candidatos en una propuesta.

import { readFileSync, writeFileSync, mkdirSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { CHARGE_ELEMENT, parseHitzones } from "../js/bow-balance-sim.js";
import { simulateBuildsAcrossWeapons } from "../js/bow-build-damage.js";
import { bandFor } from "./summarize-bow-build-comparison.mjs";

function readJson(path) { return JSON.parse(readFileSync(resolve(path), "utf8")); }

const BASELINE = CHARGE_ELEMENT.slice(); // [0.70, 0.85, 1.00, 1.125]
const GRID = [];
for (let m = 0.70; m <= 1.50 + 1e-9; m += 0.05) GRID.push(Math.round(m * 100) / 100);

const DESIGN = { favorable: 1.10, mediumMin: 1.00, mediumMax: 1.08, poorMax: 0.95 };

function average(values) {
  if (!values.length) return -1;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function aggregate(values) {
  if (!values.length) return { count: 0, mean: null, wins: 0 };
  const sum = values.reduce((a, b) => a + b, 0);
  return { count: values.length, mean: sum / values.length, wins: values.filter(v => v > 1).length };
}

// Carga los builds raw+elemental de un artifact para re-simular con distintos
// chargeElementMultipliers. Devuelve { builds, elementType, shotType, rank }.
function loadBuilds(j) {
  const b = j.classB;
  const builds = [];
  for (const p of b.profiles) {
    if (!["raw", "elemental"].includes(p.profile)) continue;
    for (const e of p.builds) {
      if (!e.comparable) continue;
      builds.push({ id: e.id, profile: e.profile, gender: e.gender, build: e.build, weapon: e.weapon });
    }
  }
  const elemWeapon = b.matrix.metadata.weapons?.["elemental/male"] || {};
  return {
    builds,
    elementType: elemWeapon.elementType || null,
    shotType: j.shotType,
    rank: j.bowRank,
  };
}

// Simula un artifact con un conjunto de multiplicadores y devuelve los rows
// con { monster, part, elementHz, ratio } ya calculados.
function simulateWith(data, bowData, hitzoneData, multipliers) {
  const matrix = simulateBuildsAcrossWeapons({
    bowData, builds: data.builds, hitzoneData, style: "guild",
    missionShots: 200, elementCap: 30, chargeElementMultipliers: multipliers,
  });
  const rows = [];
  for (const row of matrix.rows || []) {
    const elem = row.byBuild?.["elemental/male"], raw = row.byBuild?.["raw/male"];
    if (!elem || !raw || !raw.totalDamage || !elem.totalDamage) continue;
    rows.push({
      monster: row.monster, part: row.part,
      ratio: elem.totalDamage / raw.totalDamage,
      elementHz: row.elementHz || elem.elementHz || 0,
    });
  }
  return rows;
}

function main() {
  const outDir = resolve("tools/out/stage12");
  const bowData = readJson("data/weapons/bow.json");
  const hitzoneData = parseHitzones(readFileSync(resolve("tools/data-hitzones.js"), "utf8"));

  const files = readdirSync(outDir)
    .filter(f => /^cmp-.*-b4\.json$/.test(f))
    .sort();
  if (!files.length) throw new Error("No hay artefactos cmp-*.json en " + outDir + ". Ejecuta primero el driver de clase B.");

  const artifacts = files.map(file => {
    const j = readJson(resolve(outDir, file));
    if (!j.classB?.matrix) return null;
    return { ...loadBuilds(j), file };
  }).filter(Boolean);

  // sensitivity[shot][rank][charge][band][m] = aggregate
  // Also sensitivityByElement[shot][rank][charge][element][band][m]
  const sensitivity = {};
  const sensitivityByElement = {};

  // sensitivity[shot|rank][charge][band][m] accumulates ratios across ALL
  // artifacts sharing a key (regular + C1 progresion), each contributing its
  // own rows. A build only changes when its own charge multiplier changes.
  const acc = {}; // key -> charge -> band -> m -> []
  for (const art of artifacts) {
    const key = art.shotType + "|" + art.rank;
    for (let k = 0; k < 4; k++) {
      acc[key] = acc[key] || {};
      acc[key][k] = acc[key][k] || { favorable: {}, medium: {}, poor: {}, all: {} };
      for (const m of GRID) {
        const multipliers = BASELINE.slice();
        multipliers[k] = m;
        const rows = simulateWith(art, bowData, hitzoneData, multipliers);
        for (const row of rows) {
          const band = art.elementType ? bandFor(row.elementHz) : "all";
          (acc[key][k][band][m] = acc[key][k][band][m] || []).push(row.ratio);
          (acc[key][k].all[m] = acc[key][k].all[m] || []).push(row.ratio);
          const elem = art.elementType || "SinElemento";
          acc[key][k]["_byElem_" + elem] = acc[key][k]["_byElem_" + elem] || { favorable: {}, medium: {}, poor: {}, all: {} };
          const ebucket = acc[key][k]["_byElem_" + elem];
          (ebucket[band][m] = ebucket[band][m] || []).push(row.ratio);
          (ebucket.all[m] = ebucket.all[m] || []).push(row.ratio);
        }
      }
    }
  }
  for (const key of Object.keys(acc)) {
    sensitivity[key] = sensitivity[key] || {};
    sensitivityByElement[key] = sensitivityByElement[key] || {};
    for (let k = 0; k < 4; k++) {
      sensitivity[key][k] = sensitivity[key][k] || { favorable: {}, medium: {}, poor: {}, all: {} };
      sensitivityByElement[key][k] = sensitivityByElement[key][k] || {};
      for (const [band, bucket] of Object.entries(acc[key][k])) {
        if (band.startsWith("_byElem_")) continue;
        for (const m of GRID) {
          if (bucket[m]) sensitivity[key][k][band][m] = aggregate(bucket[m]);
        }
      }
      for (const [ebKey, ebucket] of Object.entries(acc[key][k])) {
        if (!ebKey.startsWith("_byElem_")) continue;
        const elem = ebKey.slice("_byElem_".length);
        sensitivityByElement[key][k][elem] = sensitivityByElement[key][k][elem] || { favorable: {}, medium: {}, poor: {}, all: {} };
        for (const [band, bucket] of Object.entries(ebucket)) {
          for (const m of GRID) {
            if (bucket[m]) sensitivityByElement[key][k][elem][band][m] = aggregate(bucket[m]);
          }
        }
      }
    }
  }

  // Find, per charge and band, the grid m closest to the design target.
  const targets = {};
  for (let k = 0; k < 4; k++) {
    targets[k] = { favorable: null, medium: null, poor: null };
    for (const key of Object.keys(sensitivity)) {
      for (const band of ["favorable", "medium", "poor"]) {
        const bucket = sensitivity[key][k]?.[band];
        if (!bucket) continue;
        for (const m of GRID) {
          const agg = bucket[m];
          if (!agg || agg.mean == null) continue;
          const ok = band === "favorable" ? agg.mean >= DESIGN.favorable
            : band === "medium" ? agg.mean >= DESIGN.mediumMin && agg.mean <= DESIGN.mediumMax
              : agg.mean <= DESIGN.poorMax;
          if (ok) {
            if (!targets[k][band]) targets[k][band] = { m, seen: 1 };
            else targets[k][band].seen++;
          }
        }
      }
    }
  }

  // Combine promising candidates: one multiplier per charge. For each charge k,
  // consider only the segments whose elemental build USES charge k. A candidate m
  // is valid when, across those segments, the poor-band ratio stays <= 0.95 and
  // the medium-band ratio stays within [1.00, 1.08]. Among valid m, pick the one
  // whose mean favorable-band ratio is CLOSEST to the +10% target (ratio ~ 1.10),
  // NOT the unbounded maximum: this avoids inflating the elemental value beyond
  // the design goal. If no m is fully valid, pick the m with the fewest violations.
  const proposal = {};
  for (let k = 0; k < 4; k++) {
    const segKeys = artifacts.filter(a => {
      // Which charge does the elemental build use? Re-derive from weapon.
      const el = a.builds.find(x => x.profile === "elemental");
      return el && Number(el.weapon.chargeSlot) - 1 === k;
    }).map(a => a.shotType + "|" + a.rank);
    const valid = [];
    const violations = {};
    for (const m of GRID) {
      let poorOk = true, mediumOk = true, viol = 0;
      let favSum = 0, favN = 0;
      for (const key of segKeys) {
        const poor = sensitivity[key]?.[k]?.poor?.[m];
        const medium = sensitivity[key]?.[k]?.medium?.[m];
        const fav = sensitivity[key]?.[k]?.favorable?.[m];
        if (poor && poor.mean != null) { if (poor.mean > DESIGN.poorMax) { poorOk = false; viol++; } }
        if (medium && medium.mean != null) {
          if (medium.mean < DESIGN.mediumMin || medium.mean > DESIGN.mediumMax) { mediumOk = false; viol++; }
        }
        if (fav && fav.mean != null) { favSum += fav.mean; favN++; }
      }
      if (poorOk && mediumOk) valid.push({ m, favMean: favN ? favSum / favN : -1, viol });
      violations[m] = viol;
    }
    let chosen;
    if (valid.length) {
      chosen = valid.reduce((a, b) =>
        Math.abs(b.favMean - DESIGN.favorable) < Math.abs(a.favMean - DESIGN.favorable) ? b : a);
    } else {
      let minViol = Math.min(...Object.values(violations));
      const tied = GRID.filter(m => violations[m] === minViol);
      // Among the least-violating m, pick the one whose mean favorable ratio is
      // highest (closest to the target), and record its real favorable mean.
      chosen = tied.reduce((a, m) => {
        const favA = segKeys.length
          ? average(segKeys.map(key => sensitivity[key]?.[k]?.favorable?.[a]?.mean).filter(v => v != null))
          : -1;
        const favM = segKeys.length
          ? average(segKeys.map(key => sensitivity[key]?.[k]?.favorable?.[m]?.mean).filter(v => v != null))
          : -1;
        return favM > favA ? m : a;
      }, tied[0]);
      const chosenFav = segKeys.length
        ? average(segKeys.map(key => sensitivity[key]?.[k]?.favorable?.[chosen]?.mean).filter(v => v != null))
        : -1;
      chosen = { m: chosen, favMean: chosenFav, viol: minViol, partial: true };
    }
    proposal["C" + (k + 1)] = {
      baseline: BASELINE[k],
      candidate: chosen.m,
      favorableMeanAtCandidate: chosen.favMean,
      favorableTarget: DESIGN.favorable,
      distanceFromTarget: chosen.favMean >= 0 ? Math.abs(chosen.favMean - DESIGN.favorable) : null,
      segmentsConsidered: segKeys,
      valid: !chosen.partial,
      violations: chosen.viol,
      note: segKeys.length === 0
        ? "Sin builds elementales que usen esta carga en la muestra de clase B. Ver estudio de progresión C1 aparte."
        : chosen.partial
          ? "Sin m totalmente válido: se elige el m con menos violaciones de ventana."
          : (chosen.favMean >= DESIGN.favorable
            ? "m válido que alcanza o supera el objetivo +10% favorable."
            : "m válido más cercano al objetivo +10% (objetivo NO alcanzado por multiplicadores solos)."),
    };
  }

  // Evaluate the proposal (combined) per segment: recompute with all four
  // multipliers set to the candidate values (correct per-charge application).
  const proposalEval = {};
  for (const art of artifacts) {
    const key = art.shotType + "|" + art.rank;
    // Accumulate raw arrays across all artifacts for this key before aggregating.
    const fresh = { favorable: [], medium: [], poor: [], all: [], monsterWins: new Set(), partsCompared: 0 };
    proposalEval[key] = proposalEval[key] || fresh;
    const multipliers = BASELINE.slice();
    for (let k = 0; k < 4; k++) multipliers[k] = proposal["C" + (k + 1)].candidate;
    const rows = simulateWith(art, bowData, hitzoneData, multipliers);
    for (const row of rows) {
      const band = art.elementType ? bandFor(row.elementHz) : "all";
      proposalEval[key][band].push(row.ratio);
      proposalEval[key].all.push(row.ratio);
      proposalEval[key].partsCompared++;
      if (row.ratio > 1) proposalEval[key].monsterWins.add(row.monster);
    }
  }
  for (const key of Object.keys(proposalEval)) {
    const e = proposalEval[key];
    e.monsterWins = e.monsterWins.size;
    for (const band of ["favorable", "medium", "poor", "all"]) {
      if (Array.isArray(e[band])) e[band] = aggregate(e[band]);
    }
  }

  const payload = {
    model: "MHGU bow elemental charge-multiplier sensitivity stage 12",
    generatedAt: new Date().toISOString(),
    baselineMultipliers: BASELINE,
    grid: GRID,
    designTargets: DESIGN,
    searchLimit: "one multiplier varied at a time; all other charges keep the baseline value; damage re-simulated with chargeElementMultipliers per charge in the Guild sequence",
    targets,
    proposal,
    proposalEvaluation: proposalEval,
    sensitivity,
    sensitivityByElement,
  };
  mkdirSync(outDir, { recursive: true });
  writeFileSync(resolve(outDir, "multiplier-sensitivity.json"), JSON.stringify(payload, null, 2) + "\n", "utf8");

  // CSV: one row per (shot, rank, charge, band, m) mean ratio.
  const csvRows = [];
  for (const key of Object.keys(sensitivity)) {
    const [shot, rank] = key.split("|");
    for (let k = 0; k < 4; k++) {
      for (const band of ["favorable", "medium", "poor", "all"]) {
        const bucket = sensitivity[key][k][band];
        for (const m of GRID) {
          const agg = bucket[m];
          if (!agg || agg.mean == null) continue;
          csvRows.push([shot, rank, "C" + (k + 1), band, m, agg.mean.toFixed(4), agg.count, agg.wins]);
        }
      }
    }
  }
  const header = "shotType,bowRank,charge,band,multiplier,meanRatio,count,partWins";
  writeFileSync(resolve(outDir, "multiplier-sensitivity.csv"), header + "\n"
    + csvRows.map(r => r.map(v => { const s = String(v); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }).join(",")).join("\n") + "\n", "utf8");

  // CSV: desglose por elemento.
  const elCsvRows = [];
  for (const key of Object.keys(sensitivityByElement)) {
    const [shot, rank] = key.split("|");
    for (let k = 0; k < 4; k++) {
      for (const [elem, bands] of Object.entries(sensitivityByElement[key][k])) {
        for (const band of ["favorable", "medium", "poor", "all"]) {
          for (const m of GRID) {
            const agg = bands[band]?.[m];
            if (!agg || agg.mean == null) continue;
            elCsvRows.push([shot, rank, "C" + (k + 1), elem, band, m, agg.mean.toFixed(4), agg.count, agg.wins]);
          }
        }
      }
    }
  }
  writeFileSync(resolve(outDir, "multiplier-sensitivity-by-element.csv"),
    "shotType,bowRank,charge,element,band,multiplier,meanRatio,count,partWins\n"
    + elCsvRows.map(r => r.map(v => { const s = String(v); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }).join(",")).join("\n") + "\n", "utf8");

  console.log("MHGU bow elemental multiplier sensitivity (stage 12)");
  console.log("artefactos procesados: " + artifacts.length + " | rejilla: " + GRID.length + " valores x 4 cargas");
  console.log("propuesta combinada:");
  for (const [c, p] of Object.entries(proposal)) {
    console.log("  " + c + ": base=" + p.baseline + " -> candidato=" + p.candidate
      + " (favorable medio=" + (p.favorableMeanAtCandidate != null ? p.favorableMeanAtCandidate.toFixed(3) : "n/a")
      + ", valido=" + p.valid + ", violaciones=" + p.violations + ")");
  }
  console.log("evaluación de la propuesta por segmento (ratio elemental/RAW):");
  for (const key of Object.keys(proposalEval)) {
    const e = proposalEval[key];
    console.log("  " + key + ": favorable=" + (e.favorable.mean ?? "n/a") + " media=" + (e.medium.mean ?? "n/a")
      + " pobre=" + (e.poor.mean ?? "n/a") + " | victorias monstruo=" + e.monsterWins + "/" + (e.partsCompared > 0 ? 93 : 0));
  }
  console.log("JSON: " + resolve(outDir, "multiplier-sensitivity.json"));
  console.log("CSV:  " + resolve(outDir, "multiplier-sensitivity.csv"));
  console.log("CSV:  " + resolve(outDir, "multiplier-sensitivity-by-element.csv"));
}
try { main(); } catch (error) { console.error("Error: " + error.message); process.exitCode = 1; }
