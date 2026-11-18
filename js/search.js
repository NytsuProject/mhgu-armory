/* search.js — buscador global (armas, conjuntos, piezas, monstruos) */
import { A, esc, icon, classIcon, slotIcon, monsterIcon, rarColor, loadSearchIndex, loadWeaponClass } from "./app.js";
import { openWeapon, openArmor, showView } from "./navigation.js";

const norm = s => (s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
let results = [];
let kbdIndex = -1;

function matchName(names, q) {
  return names.find(n => norm(n).includes(q));
}

async function doSearch(raw) {
  const box = document.getElementById("gs-results");
  const q = norm(raw.trim());
  if (q.length < 2) { box.classList.add("hidden"); results = []; return; }
  const idx = await loadSearchIndex();
  results = [];

  const push = (group, items) => { if (items.length) results.push({ group, items }); };

  const w = [];
  for (const e of idx.weapons) {
    const hit = matchName(e.e, q) || matchName(e.n, q);
    if (hit) w.push({ kind: "w", e, hit });
    if (w.length >= 8) break;
  }
  push("Armas", w);

  const a = [];
  for (const e of idx.sets) {
    const hit = matchName([e.e || "", e.n], q);
    if (hit) a.push({ kind: "a", e, hit });
    if (a.length >= 6) break;
  }
  push("Conjuntos", a);

  const p = [];
  for (const e of idx.pieces) {
    const hit = matchName([e.e || "", e.n], q);
    if (hit) p.push({ kind: "p", e, hit });
    if (p.length >= 6) break;
  }
  push("Piezas", p);

  const m = [];
  for (const e of idx.monsters) {
    const hit = matchName([e.e || "", e.n], q);
    if (hit) m.push({ kind: "m", e, hit });
    if (m.length >= 4) break;
  }
  push("Monstruos", m);

  kbdIndex = -1;
  renderResults();
}

function renderResults() {
  const box = document.getElementById("gs-results");
  if (!results.length) {
    box.innerHTML = `<div class="gs-empty">Sin resultados.</div>`;
    box.classList.remove("hidden");
    return;
  }
  const SLOT_ES = A.data.piecesMeta.slotEs;
  const classLabel = slug => A.data.categories.find(c => c.slug === slug)?.labelEs || slug;
  let flat = 0;
  box.innerHTML = results.map(g => `
    <div class="gs-group">${g.group}</div>
    ${g.items.map(it => {
      const i = flat++;
      let icHtml = icon("anvil"), main = "", sub = "";
      if (it.kind === "w") { icHtml = classIcon(it.e.c); main = it.hit; sub = classLabel(it.e.c); }
      if (it.kind === "a") { icHtml = slotIcon("chest"); main = it.hit; sub = `R${it.e.r}`; }
      if (it.kind === "p") { icHtml = slotIcon(it.e.s); main = it.hit; sub = SLOT_ES[it.e.s]; }
      if (it.kind === "m") { icHtml = monsterIcon(it.e.id); main = it.hit; sub = "filtrar armaduras"; }
      const r = it.e.r;
      return `<button class="gs-item" data-i="${i}">
        ${icHtml}
        ${r ? `<span class="rar-dot" style="background:${rarColor(r)}"></span>` : ""}
        <span>${esc(main)}</span><span class="sub">${esc(sub)}</span>
      </button>`;
    }).join("")}`).join("");
  box.classList.remove("hidden");
  box.querySelectorAll(".gs-item").forEach(b =>
    b.addEventListener("click", () => openResult(+b.dataset.i)));
}

function flatResults() { return results.flatMap(g => g.items); }

async function openResult(i) {
  const it = flatResults()[i];
  if (!it) return;
  closeResults();
  document.getElementById("gs-input").value = "";
  if (it.kind === "w") {
    const d = await loadWeaponClass(it.e.c);
    const t = d.byId.get(it.e.id);
    const q = norm(it.hit);
    const lvl = t.levels.find(l => norm(l.nEs || "").includes(q) || norm(l.n).includes(q));
    await openWeapon(it.e.c, it.e.id, lvl ? lvl.lv : null);
  } else if (it.kind === "a") {
    await openArmor(it.e.id);
  } else if (it.kind === "p") {
    showView("armor");
    A.hooks.selectSetByPiece(it.e.s, it.e.id);
  } else if (it.kind === "m") {
    showView("armor");
    A.hooks.setArmorMonsterFilter(it.e.id);
  }
}

function closeResults() {
  document.getElementById("gs-results").classList.add("hidden");
  kbdIndex = -1;
}

export function init() {
  const input = document.getElementById("gs-input");
  let timer = null;
  input.addEventListener("input", () => {
    clearTimeout(timer);
    timer = setTimeout(() => doSearch(input.value), 140);
  });
  input.addEventListener("focus", () => { if (input.value.trim().length >= 2) doSearch(input.value); });
  input.addEventListener("keydown", e => {
    const items = document.querySelectorAll("#gs-results .gs-item");
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!items.length) return;
      kbdIndex = e.key === "ArrowDown"
        ? (kbdIndex + 1) % items.length
        : (kbdIndex - 1 + items.length) % items.length;
      items.forEach((b, i) => b.classList.toggle("kbd", i === kbdIndex));
      items[kbdIndex].scrollIntoView({ block: "nearest" });
    } else if (e.key === "Enter") {
      e.preventDefault();
      openResult(kbdIndex >= 0 ? kbdIndex : 0);
    } else if (e.key === "Escape") {
      closeResults();
      input.blur();
    }
  });
  document.addEventListener("click", e => {
    if (!e.target.closest("#global-search")) closeResults();
  });
}