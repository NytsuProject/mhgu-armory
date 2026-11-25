#!/usr/bin/env node
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import {
  auditBowBuildSkillAvailability,
  summarizeBowWeaponCatalog,
} from "../js/bow-build-feasibility.js";

function readArgs(argv) {
  const args = {};
  for (let index = 2; index < argv.length; index++) {
    const key = argv[index];
    if (!key.startsWith("--")) throw new Error("Argumento inesperado: " + key);
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) throw new Error("Falta el valor de " + key);
    args[key.slice(2)] = value;
    index++;
  }
  return args;
}

function main() {
  const args = readArgs(process.argv);
  const rank = args.rank || "G";
  const armorDir = resolve(args["armor-dir"] || "data/armor");
  const bowsPath = resolve(args.bows || "data/weapons/bow.json");
  const outputPath = resolve(args.out || "tools/out/bow-build-feasibility-stage7.json");

  const armorData = JSON.parse(readFileSync(resolve(armorDir, "pieces.json"), "utf8"));
  const decorations = JSON.parse(readFileSync(resolve(armorDir, "decorations.json"), "utf8"));
  const talismanSkills = JSON.parse(readFileSync(resolve(armorDir, "talisman-skills.json"), "utf8"));
  const skillLevels = JSON.parse(readFileSync(resolve(armorDir, "skill-levels.json"), "utf8"));
  const bowData = JSON.parse(readFileSync(bowsPath, "utf8"));

  const result = auditBowBuildSkillAvailability({
    armorData, decorations, talismanSkills, skillLevels, rank,
  });
  result.weaponCatalog = summarizeBowWeaponCatalog(bowData);
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, JSON.stringify(result, null, 2) + "\n", "utf8");

  console.log("MHGU bow build skill-source audit");
  console.log("Rango de armadura: " + rank);
  console.log("Piezas artillero/ambos: " + result.metadata.eligibleGunnerArmorPieces);
  console.log("Joyas: " + result.metadata.decorations + " | habilidades de talismán: " + result.metadata.talismanSkillEntries);
  console.log("Arcos: " + result.weaponCatalog.levelRecords + " niveles en " + result.weaponCatalog.treeSegments + " segmentos");
  for (const [skill, data] of Object.entries(result.skillAvailability)) {
    const best = Math.max(0, ...data.targets.map(target =>
      Math.max(0, ...Object.values(target.armor.bySlot).map(slot => slot.maxPoints))));
    console.log(skill + ": " + data.targets.map(target =>
      target.targetPoints + "p (" + target.armor.pieceCount + " piezas; mejor pieza +" + target.armor.bestPieces[0]?.points + ")"
    ).join(" / ") + " | mejor pieza +" + best);
  }
  console.log("Informe JSON: " + outputPath);
}

try {
  main();
} catch (error) {
  console.error("Error: " + error.message);
  process.exitCode = 1;
}
