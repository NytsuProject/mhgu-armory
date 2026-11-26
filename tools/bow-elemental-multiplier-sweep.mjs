#!/usr/bin/env node
// Stage 12, parte C: barrido de sensibilidad de los multiplicadores elementales
// de las cargas (C1..C4).
//
// Modelo actual: C1 x0.70 / C2 x0.85 / C3 x1.00 / C4 x1.125.
// El barrido modifica UN multiplicador a la vez (los demás mantienen el valor
// base) y evalúa la ratio elemental/RAW (y híbrido/RAW) sobre los 93 monstruos
// grandes, agregada por:
//   - rango (LR/HR/G), elemento, tipo de disparo, carga (C1..C4),
//   - banda de hitzone elemental (favorable/media/pobre).
// Luego se combinan solo los candidatos prometedores en una propuesta.
//
// Los builds y arcos provienen de los artefactos de clase B (cmp-*.json): cada
// perfil ya usa su propio arco y su propia carga. El daño elemental de un build
// que usa la carga k se escala por (m / multiplicador_base[k]); el daño RAW
// no cambia. Se reportan victorias por parte y por monstruo, no solo el promedio.

import { readFileSync, writeFileSync, mkdirSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { CHARGE_ELEMENT, ELEMENTS } from "../js/bow-balance-sim.js";
import { bandFor } from "./summarize-bow-build-comparison.mjs";

function readJson(path) { return JSON.parse(readFileSync(resolve(path), "utf8")); }

const BASELINE = CHARGE_ELEMENT.slice(); // [0.70, 0.85, 1.00, 1.125]
const GRID = [];
for (let m = 0.70; m <= 1.50 + 1e-9; m += 0.05) GRID.push(Math.round(m * 100) / 100);

const DESIGN = { favorable: 1.10, mediumMax: 1.08, poorMax: 0.95 };

function aggregate(values) {
  if (!values.length) return { count: 0, mean: null, wins: 0 };
  const sum = values.reduce((a, b) => a + b, 0);
  return { count: values.length, mean: sum / values.length, wins: values.filter(v => v > 1).length };
}

function main() {
  const outDir = resolve("tools/out/stage12");
  const files = readdirSync(outDir).filter(f => /^cmp-.*-b4\.json$/.test(f)).sort();
  if (!files.length) throw new Error("No hay artefactos cmp-*.json en " + outDir + ". Ejecuta primero el driver de clase B.");

  // Extract per-artifact build info and per-row damage.
  const artifacts = files.map(file => {
    const j = readJson(resolve(outDir, file));
    const matrix = j.classB?.matrix;
    if (!matrix) return null;
    const weapons = matrix.metadata.weapons || {};
    const rows = matrix.rows || [];
    return {
      shotType: j.shotType, bowRank: j.bowRank, budget: j.budget,
      weapons, rows,
      elemCharge: weapons["elemental/male"] ? Number(weapons["elemental/male"].chargeSlot) - 1 : null,
    };
  }).filter(Boolean);

  // sensitivity[shot][rank][charge][band][m] = aggregate
  const sensitivity = {};
  const perShotRank = {}; // for monster/part wins at chosen m

  for (const art of artifacts) {
    const key = art.shotType + "|" + art.bowRank;
    sensitivity[key] = sensitivity[key] || {};
    perShotRank[key] = perShotRank[key] || { rows: art.rows, weapons: art.weapons };
    for (let k = 0; k < 4; k++) {
      sensitivity[key][k] = sensitivity[key][k] || { favorable: {}, medium: {}, poor: {}, all: {} };
      for (const m of GRID) {
        const ratios = { favorable: [], medium: [], poor: [], all: [] };
        for (const row of art.rows) {
          const elem = row.byBuild["elemental/male"];
          const raw = row.byBuild["raw/male"];
          if (!elem || !raw || !raw.totalDamage) continue;
          const elemWeapon = art.weapons["elemental/male"];
          const usesCharge = elemWeapon && Number(elemWeapon.chargeSlot) - 1 === k;
          const elemScale = usesCharge ? m / BASELINE[k] : 1;
          const elemTotal = elem.rawDamage + elem.elementalDamage * elemScale;
          const ratio = raw.totalDamage > 0 ? elemTotal / raw.totalDamage : null;
          if (ratio == null) continue;
          const hz = elem.elementHz || 0;
          const band = elemWeapon?.elementType ? bandFor(hz) : "all";
          ratios[band].push(ratio);
          ratios.all.push(ratio);
        }
        for (const band of Object.keys(ratios)) {
          sensitivity[key][k][band][m] = aggregate(ratios[band]);
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
            : band === "medium" ? agg.mean >= 1.0 && agg.mean <= DESIGN.mediumMax
              : agg.mean <= DESIGN.poorMax;
          if (ok) {
            if (!targets[k][band]) targets[k][band] = { m, seen: 1 };
            else targets[k][band].seen++;
          }
        }
      }
    }
    // Choose the m with the most segment agreement for each band.
    for (const band of ["favorable", "medium", "poor"]) {
      const best = Object.entries(sensitivity).flatMap(([key]) => {
        const bucket = sensitivity[key][k]?.[band] || {};
        return GRID.map(m => ({ key, m, agg: bucket[m] })).filter(x => x.agg && x.agg.mean != null);
      });
      // pick m maximizing the number of segments satisfying the target
      const score = {};
      for (const { m, agg } of best) {
        const ok = band === "favorable" ? agg.mean >= DESIGN.favorable
          : band === "medium" ? agg.mean >= 1.0 && agg.mean <= DESIGN.mediumMax
            : agg.mean <= DESIGN.poorMax;
        if (ok) score[m] = (score[m] || 0) + 1;
      }
      let bestM = null, bestCount = -1;
      for (const [m, c] of Object.entries(score)) if (c > bestCount) { bestCount = c; bestM = Number(m); }
      if (bestM != null) targets[k][band] = { m: bestM, segments: bestCount };
    }
  }

  // Combine promising candidates: one multiplier per charge. For each charge k,
  // consider only the segments whose elemental build USES charge k. A candidate m
  // is valid when, across those segments, the poor-band ratio stays <= 0.95 and
  // the medium-band ratio stays <= 1.08. Among valid m, pick the one whose mean
  // favorable-band ratio is CLOSEST to the +10% target (ratio ~ 1.10), NOT the
  // unbounded maximum: this avoids inflating the elemental value beyond the
  // design goal. If no m is fully valid, pick the m with the fewest violations.
  const proposal = {};
  for (let k = 0; k < 4; k++) {
    const segKeys = artifacts.filter(a => a.elemCharge === k).map(a => a.shotType + "|" + a.bowRank);
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
        if (medium && medium.mean != null) { if (medium.mean > DESIGN.mediumMax) { mediumOk = false; viol++; } }
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
      // No fully valid m: minimize violations, then maximize favorable.
      let minViol = Math.min(...Object.values(violations));
      const tied = GRID.filter(m => violations[m] === minViol);
      chosen = tied.reduce((a, m) => {
        const favA = sensitivity[segKeys[0]]?.[k]?.favorable?.[a]?.mean ?? -1;
        const favM = sensitivity[segKeys[0]]?.[k]?.favorable?.[m]?.mean ?? -1;
        return favM > favA ? m : a;
      }, tied[0]);
      chosen = { m: chosen, favMean: -1, viol: minViol, partial: true };
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
        ? "Sin builds elementales observados en esta carga: se mantiene el valor base (sin evidencia de sensibilidad)."
        : chosen.partial
          ? "Sin m totalmente válido: se elige el m con menos violaciones de ventana."
          : (chosen.favMean >= DESIGN.favorable
            ? "m válido que alcanza o supera el objetivo +10% favorable."
            : "m válido más cercano al objetivo +10% (objetivo NO alcanzado por multiplicadores solos)."),
    };
  }

  // Evaluate the proposal (combined) per segment: recompute with all four
  // multipliers set to the candidate values.
  const proposalEval = {};
  for (const art of artifacts) {
    const key = art.shotType + "|" + art.bowRank;
    proposalEval[key] = proposalEval[key] || { favorable: [], medium: [], poor: [], all: [], monsterWins: 0, partsCompared: 0 };
    const monsterWins = new Set();
    for (const row of art.rows) {
      const elem = row.byBuild["elemental/male"], raw = row.byBuild["raw/male"];
      if (!elem || !raw || !raw.totalDamage) continue;
      const elemWeapon = art.weapons["elemental/male"];
      const k = elemWeapon ? Number(elemWeapon.chargeSlot) - 1 : 0;
      const m = proposal["C" + (k + 1)].candidate;
      const elemTotal = elem.rawDamage + elem.elementalDamage * (m / BASELINE[k]);
      const ratio = raw.totalDamage > 0 ? elemTotal / raw.totalDamage : null;
      if (ratio == null) continue;
      const band = elemWeapon?.elementType ? bandFor(elem.elementHz || 0) : "all";
      proposalEval[key][band].push(ratio);
      proposalEval[key].all.push(ratio);
      proposalEval[key].partsCompared++;
      if (ratio > 1) monsterWins.add(row.monster);
    }
    proposalEval[key].monsterWins = monsterWins.size;
    for (const band of Object.keys(proposalEval[key])) {
      if (Array.isArray(proposalEval[key][band])) proposalEval[key][band] = aggregate(proposalEval[key][band]);
    }
  }

  const payload = {
    model: "MHGU bow elemental charge-multiplier sensitivity stage 12",
    generatedAt: new Date().toISOString(),
    baselineMultipliers: BASELINE,
    grid: GRID,
    designTargets: DESIGN,
    searchLimit: "one multiplier varied at a time; all other charges keep the baseline value",
    targets,
    proposal,
    proposalEvaluation: proposalEval,
    sensitivity,
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
  console.log("CSV: " + resolve(outDir, "multiplier-sensitivity.csv"));
}
try { main(); } catch (error) { console.error("Error: " + error.message); process.exitCode = 1; }
