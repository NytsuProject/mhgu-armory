#!/usr/bin/env node
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { optimizeBowBuild, resolveBowBuildRequirements } from "../js/bow-build-optimizer.js";

const args = {};
for (let i = 2; i < process.argv.length; i++) {
  const key = process.argv[i];
  if (!key.startsWith("--") || !process.argv[i + 1] || process.argv[i + 1].startsWith("--")) {
    throw new Error("Argumento inválido: " + key);
  }
  args[key.slice(2)] = process.argv[++i];
}
const readJson = path => JSON.parse(readFileSync(resolve(path), "utf8"));
function rankForRarity(value) { return value >= 8 ? "G" : value >= 4 ? "HR" : "LR"; }
function parseCharge(value) {
  const m = /^(Rapid|Pierce|Spread|Heavy) Lv([1-5])(!)?$/.exec(value || "");
  return m ? { type: m[1], level: Number(m[2]), requiresLoadUp: Boolean(m[3]) } : null;
}
function main() {
  const armorDir = resolve(args["armor-dir"] || "data/armor");
  const bows = readJson(args.bows || "data/weapons/bow.json");
  const armorData = readJson(resolve(armorDir, "pieces.json"));
  const decorations = readJson(resolve(armorDir, "decorations.json"));
  const talismanSkills = readJson(resolve(armorDir, "talisman-skills.json"));
  const skillLevels = readJson(resolve(armorDir, "skill-levels.json"));
  const treeId = Number(args["weapon-tree"]), levelNo = Number(args["weapon-level"]);
  if (!Number.isInteger(treeId) || !Number.isInteger(levelNo)) throw new Error("Indica --weapon-tree ID y --weapon-level NIVEL.");
  const tree = bows.trees.find(row => Number(row.id) === treeId);
  const weapon = tree?.levels?.find(row => Number(row.lv) === levelNo);
  if (!weapon) throw new Error("No se encontró ese arco y nivel.");
  const chargeSlot = Number(args["charge-slot"] || 3);
  if (!Number.isInteger(chargeSlot) || chargeSlot < 1 || chargeSlot > 4) throw new Error("--charge-slot debe ser de 1 a 4.");
  const charges = (weapon.x?.charges || []).map(parseCharge);
  const selected = charges[chargeSlot - 1];
  if (!selected) throw new Error("La carga seleccionada no existe.");
  const previous = chargeSlot > 1 ? charges[chargeSlot - 2] : null;
  const shotType = selected.requiresLoadUp && previous ? previous.type : selected.type;
  const element = (weapon.ele || []).find(row => ["Fire", "Water", "Thunder", "Ice", "Dragon"].includes(row[1]));
  const profileArg = args.profile || "all";
  const profiles = profileArg === "all" ? ["raw", "elemental", "hybrid"] : profileArg.split(",");
  for (const profile of profiles) {
    if (!["raw", "elemental", "hybrid"].includes(profile)) throw new Error("Perfil no válido: " + profile);
    if (profile !== "raw" && !element) throw new Error("El arco no tiene elemento para " + profile + ".");
  }
  const rank = args.rank || rankForRarity(Number(weapon.rar));
  const genderArg = args.gender || "both";
  const genders = genderArg === "both" ? ["male", "female"] : [genderArg];
  if (genders.some(g => !["male", "female"].includes(g))) throw new Error("gender debe ser male, female o both.");
  const weaponSlots = [...String(weapon.slots || "")].filter(ch => ch === "◯").length;
  const coatingPolicy = args["coating-policy"] || "low-cost";
  const output = {
    weapon: {
      treeId, treeName: tree.nameEs || tree.name, level: levelNo, name: weapon.nEs || weapon.n,
      rank, rarity: Number(weapon.rar), raw: Number(weapon.raw || 0), affinity: Number(weapon.aff || 0),
      element: element ? { type: element[1], name: element[0], value: Number(element[2]) } : null,
      charge: { slot: chargeSlot, ...selected, effectiveType: shotType },
      coatings: weapon.x?.coatings || [], weaponSlots,
    },
    comparisons: [],
  };
  for (const profile of profiles) {
    const resolved = resolveBowBuildRequirements({
      weapon, profile, shotType, element: element?.[1] || null,
      loadUp: selected.requiresLoadUp,
      ammoSaver: args["ammo-saver"] === "true",
      coatingPolicy,
    });
    for (const gender of genders) {
      const result = optimizeBowBuild({
        armorData, decorations, talismanSkills, skillLevels,
        requirements: resolved.requirements, rank, gender, weaponSlots,
        weaponName: weapon.nEs || weapon.n,
        beamWidth: Number(args["beam-width"] || 700),
        topBuilds: Number(args["top-builds"] || 3),
      });
      output.comparisons.push({ profile, gender, coatingPolicy, coatingUnlocks: resolved.coatingUnlocks, ...result });
    }
  }
  const out = resolve(args.out || "tools/out/bow-build-optimizer-stage8.json");
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, JSON.stringify(output, null, 2) + "\n", "utf8");
  console.log("MHGU Bow real-build optimizer");
  console.log(output.weapon.name + " | " + rank + " | " + shotType + " Lv" + selected.level + " | " + weaponSlots + " ranuras");
  for (const row of output.comparisons) {
    const best = row.builds[0];
    console.log(row.profile + "/" + row.gender + ": "
      + (best ? best.activatedSkills + "/" + best.targetSkillCount + " habilidades; " + (best.complete ? "completa" : "parcial") : "sin build"));
  }
  console.log("Informe: " + out);
}
try { main(); } catch (error) { console.error("Error: " + error.message); process.exitCode = 1; }
