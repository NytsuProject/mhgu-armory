/* filters.js — filtros de armas y armaduras */
import { A } from "./app.js";

const ELEMENTS = ["Fuego", "Agua", "Rayo", "Hielo", "Dragón",
                  "Veneno", "Parálisis", "Sueño", "Explosión"];

function weaponFilterState() {
  return {
    name: document.getElementById("wf-name").value.trim(),
    rarity: document.getElementById("wf-rarity").value,
    element: document.getElementById("wf-element").value,
    affinity: document.getElementById("wf-affinity").value,
    arc: document.getElementById("wf-arc").value,
    shot: document.getElementById("wf-shot").value,
    shotLu: document.getElementById("wf-shot-lu").checked,
  };
}
function armorFilterState() {
  return {
    name: document.getElementById("af-name").value.trim(),
    rank: document.getElementById("af-rank").value,
    rarity: document.getElementById("af-rarity").value,
    cls: document.getElementById("af-cls").value,
    gender: document.getElementById("af-gender").value,
    monster: document.getElementById("af-monster").value,
    skill: document.getElementById("af-skill").value,
  };
}

const applyW = () => A.hooks.applyWeaponFilters?.(weaponFilterState());
const applyA = () => A.hooks.applyArmorFilters?.(armorFilterState());

export function init() {
  const eleSel = document.getElementById("wf-element");
  for (const e of ELEMENTS) eleSel.insertAdjacentHTML("beforeend", `<option value="${e}">${e}</option>`);

  let t = null;
  document.getElementById("wf-name").addEventListener("input", () => {
    clearTimeout(t); t = setTimeout(applyW, 160);
  });
  for (const id of ["wf-rarity", "wf-element", "wf-affinity", "wf-arc", "wf-shot", "wf-shot-lu"])
    document.getElementById(id).addEventListener("change", applyW);
  document.getElementById("wf-clear").addEventListener("click", () => {
    document.getElementById("wf-name").value = "";
    for (const id of ["wf-rarity", "wf-element", "wf-affinity", "wf-arc", "wf-shot"])
      document.getElementById(id).value = "";
    document.getElementById("wf-shot-lu").checked = false;
    applyW();
  });

  let t2 = null;
  document.getElementById("af-name").addEventListener("input", () => {
    clearTimeout(t2); t2 = setTimeout(applyA, 160);
  });
  for (const id of ["af-rank", "af-rarity", "af-cls", "af-gender", "af-monster", "af-skill"])
    document.getElementById(id).addEventListener("change", applyA);
  document.getElementById("af-clear").addEventListener("click", () => {
    document.getElementById("af-name").value = "";
    for (const id of ["af-rank", "af-rarity", "af-cls", "af-gender", "af-monster", "af-skill"])
      document.getElementById(id).value = "";
    applyA();
  });

  A.hooks.onClassLoaded = slug => {
    const bow = slug === "bow";
    document.getElementById("wf-bow").hidden = !bow;
    if (!bow) {
      document.getElementById("wf-arc").value = "";
      document.getElementById("wf-shot").value = "";
      document.getElementById("wf-shot-lu").checked = false;
    }
    applyW();
  };
  A.hooks.setArmorNameFilter = q => {
    document.getElementById("af-name").value = q;
    applyA();
  };
  A.hooks.setArmorMonsterFilter = id => {
    document.getElementById("af-monster").value = String(id);
    applyA();
  };
}