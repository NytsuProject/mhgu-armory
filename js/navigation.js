/* navigation.js — enrutado entre vistas y apertura profunda de armas/conjuntos */
import { A } from "./app.js";

const VIEWS = ["cover", "weapons", "armor", "builder"];

export function showView(name) {
  A.state.view = name;
  for (const v of VIEWS) {
    document.getElementById("view-" + v).classList.toggle("hidden", v !== name);
  }
  document.querySelectorAll("#mainnav button").forEach(b =>
    b.classList.toggle("active", b.dataset.nav === name));
  if (name === "builder") A.hooks.openBuilder();
  if (name === "weapons" && !A.state.wClass) {
    A.hooks.loadClass?.("great_sword");
  }
  if (name === "armor" && !A.state.aSet) {
    A.hooks.selectSet?.(A.data.sets[0]?.id);
  }
}

export async function openWeapon(slug, treeId, level = null) {
  showView("weapons");
  await A.hooks.loadClass(slug);
  A.hooks.selectTree(treeId, level);
  A.hooks.focusNode(treeId);
}

export async function openArmor(setId, slot = null) {
  showView("armor");
  A.hooks.selectSet(setId, slot);
}

export function init() {
  document.querySelectorAll("[data-nav]").forEach(b =>
    b.addEventListener("click", () => showView(b.dataset.nav)));
}