#!/usr/bin/env node
// Agrega los 12 artefactos de clase B (cmp-<shot>-<rank>-b4.json) + la
// comparación C4 + la sensibilidad de multiplicadores en un resumen combinado
// con CSVs reproducibles para la fase 12.
//
// Ratio base = elemental/RAW con los multiplicadores C1-C4 actuales
// (0.70 / 0.85 / 1.00 / 1.125). No se modifican los datos: solo se resume.

import { readFileSync, writeFileSync, mkdirSync, readdirSync } from "node:fs";
import { resolve, dirname } from "node:path";

const OUT = resolve("tools/out/stage12");

function readJson(p) { return JSON.parse(readFileSync(p, "utf8")); }

function main() {
  const files = readdirSync(OUT)
    .filter(f => /^cmp-.*-b4\.json$/.test(f))
    .sort();
  if (files.length !== 12) {
    console.warn("AVISO: se esperan 12 artefactos cmp-*-b4.json, se encontraron " + files.length);
  }
  const segments = [];
  for (const f of files) {
    const j = readJson(resolve(OUT, f));
    const b = j.classB;
    const m = b.matrix;
    const isC1 = /-c1-b4\.json$/.test(f);
    const seg = {
      shot: j.shotType, rank: j.bowRank, budget: b.budget, charge: isC1 ? "C1" : "C3/C4",
      file: f,
      comparable: b.profiles.filter(p => p.comparable).length,
      bows: b.profiles.map(p => (p.bow?.name || "-") + "(" + p.profile + ")").join(" | "),
    };
    // Per-band elemental/RAW ratio from the matrix summary.
    for (const g of m.summary || []) {
      if (g.target !== "elemental/male" || g.reference !== "raw/male") continue;
      seg.bandRatios = seg.bandRatios || {};
      // summary groups are per band in the driver; recompute bands from rows if needed.
    }
    // Recompute bands from rows directly (robust to summary shape).
    const rows = m.rows || [];
    const elem = rows.map(r => r.byBuild?.["elemental/male"]).filter(Boolean);
    const raw = rows.map(r => r.byBuild?.["raw/male"]).filter(Boolean);
    const ratios = [];
    for (let i = 0; i < rows.length; i++) {
      const e = elem[i], r = raw[i];
      if (e && r && r.totalDamage > 0) ratios.push(e.totalDamage / r.totalDamage);
    }
    seg.elemRawRatioMean = ratios.length ? ratios.reduce((a, b) => a + b, 0) / ratios.length : null;
    seg.partsCompared = ratios.length;
    // Per-element split: element value of the elemental bow.
    const elP = b.profiles.find(p => p.profile === "elemental");
    seg.element = elP?.bow?.element?.[1] || null;
    seg.bowName = elP?.bow?.name || null;
    // Wins: elemental > raw per part.
    let wins = 0;
    for (let i = 0; i < rows.length; i++) {
      const e = elem[i], r = raw[i];
      if (e && r && e.totalDamage > r.totalDamage) wins++;
    }
    seg.partWins = wins;
    segments.push(seg);
  }

  // C4 summary.
  const c4 = readJson(resolve(OUT, "c4-comparison.json"));
  const c4Rows = (c4.results || []).map(r => ({
    shot: r.shotType, rank: r.bowRank, bow: r.bow, budget: r.budgetUsed,
    element: r.element,
    c3ElemRaw: r.elementalC3Raw?.meanRatioAllParts ?? null,
    c4ElemRaw: r.elementalC4Raw?.meanRatioAllParts ?? null,
    c4VsC3: r.c4VsC3ElementalDamage,
    loading: r.loadingActive, comparable: r.c4Comparable,
    offensive: (r.offensiveSkillsActivated || []).join(","),
  }));

  // Multiplier sensitivity summary (baseline ratios + proposal).
  const sens = readJson(resolve(OUT, "multiplier-sensitivity.json"));
  const proposal = sens.proposal || {};

  const payload = {
    model: "MHGU bow stage 12 aggregation",
    generatedAt: new Date().toISOString(),
    note: "Resumen combinado de los 12 artefactos de clase B (ratios base), la comparación C3/C4 con Recargando y la sensibilidad de multiplicadores. No se modifican datos definitivos.",
    segments,
    c4: c4Rows,
    proposal,
  };

  mkdirSync(OUT, { recursive: true });
  writeFileSync(resolve(OUT, "stage12-summary.json"), JSON.stringify(payload, null, 2) + "\n", "utf8");

  // CSV: segment ratios.
  const csv = [
    "shot,rank,charge,budget,bow,element,comparable,partsCompared,elemRawRatioMean,partWins",
    ...segments.map(s => [
      s.shot, s.rank, s.charge, s.budget, s.bowName, s.element, s.comparable, s.partsCompared,
      s.elemRawRatioMean != null ? s.elemRawRatioMean.toFixed(4) : "", s.partWins,
    ].join(",")),
  ].join("\n") + "\n";
  writeFileSync(resolve(OUT, "stage12-ratios.csv"), csv, "utf8");

  // CSV: C4.
  const c4csv = [
    "shot,rank,bow,element,budgetUsed,elemC3Raw,elemC4Raw,c4VsC3,loadingActive,comparable,offensiveSkills",
    ...c4Rows.map(r => [
      r.shot, r.rank, r.bow, r.element, r.budget,
      r.c3ElemRaw != null ? r.c3ElemRaw.toFixed(4) : "",
      r.c4ElemRaw != null ? r.c4ElemRaw.toFixed(4) : "",
      r.c4VsC3 != null ? r.c4VsC3.toFixed(4) : "",
      r.loading ? "sí" : "no", r.comparable ? "sí" : "no", r.offensive,
    ].join(",")),
  ].join("\n") + "\n";
  writeFileSync(resolve(OUT, "stage12-c4.csv"), c4csv, "utf8");

  // Console summary.
  console.log("segmentos procesados:", segments.length);
  console.log("ratio elem/RAW base por segmento:");
  for (const s of segments) {
    console.log("  " + s.shot + "|" + s.rank + " b" + s.budget + " [" + s.charge + "] " + (s.bowName || "-")
      + " [" + (s.element || "-") + "] ratio=" + (s.elemRawRatioMean != null ? s.elemRawRatioMean.toFixed(3) : "n/a")
      + " venc=" + s.partWins + "/" + s.partsCompared);
  }
  console.log("C4 comparables:", c4Rows.filter(r => r.comparable).length + "/" + c4Rows.length);
  for (const r of c4Rows.filter(x => x.comparable)) {
    console.log("  " + r.shot + "|" + r.rank + " b" + r.budget + " " + r.bow
      + " C3=" + (r.c3ElemRaw != null ? r.c3ElemRaw.toFixed(3) : "n/a")
      + " C4=" + (r.c4ElemRaw != null ? r.c4ElemRaw.toFixed(3) : "n/a")
      + " C4/C3=" + (r.c4VsC3 != null ? r.c4VsC3.toFixed(3) : "n/a"));
  }
  console.log("JSON: " + resolve(OUT, "stage12-summary.json"));
  console.log("CSV:  " + resolve(OUT, "stage12-ratios.csv"));
  console.log("CSV:  " + resolve(OUT, "stage12-c4.csv"));
}

try { main(); } catch (error) { console.error("Error: " + error.message); process.exitCode = 1; }
