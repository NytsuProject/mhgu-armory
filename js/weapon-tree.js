/* weapon-tree.js — rejilla de herrería del juego: una fila por línea, casillas por nivel */
import { A, esc, classIcon, eleIconPath, hasGameIcons, rarColor, ELE_COLORS, ARC_ES, SHOT_ES, loadWeaponClass } from "./app.js";
import { bindTips, monsterRows } from "./tooltip.js";

/* geometría de la rejilla (como la pantalla de herrería de MHGU) */
const TS = 44;                 // lado de la casilla de arma
const COLP = 54;               // paso entre columnas (niveles)
const ROWP = 52;               // paso entre filas (líneas de mejora)
const LABELW = 176;            // ancho de la placa de nombre de línea
const MARGIN = 14;
const GAPX = (COLP - TS) / 2, GAPY = (ROWP - TS) / 2;
const GRIDX = MARGIN + LABELW + 10;

/* tinte oscuro de la casilla según rareza (el icono encima es la silueta coloreada) */
const TILE_TINT = {
  1: "#3c3c46", 2: "#43304e", 3: "#4a4416", 4: "#4e2c38", 5: "#2c442c", 6: "#203a52",
  7: "#4e2020", 8: "#164444", 9: "#4e3416", 10: "#4e1c34", 11: "#3c164e",
};
const tileTint = r => TILE_TINT[Math.min(11, Math.max(1, r))] || TILE_TINT[1];

let svg, world, viewport;
let view = { x: 0, y: 0, k: 1 };
let layout = new Map();      // id -> {row, base, x, y}
let bounds = { w: 0, h: 0 };
let rows = 0, maxCol = 0;
let collapsed = new Set();
let current = null;          // datos de la clase cargada
let filterMatch = null;      // Set de ids que pasan filtros (null = sin filtro)

const trunc = (s, n) => (s && s.length > n ? s.slice(0, n - 1) + "…" : s || "");
const tileX = (pos, lv) => pos.x + (lv - 1) * COLP;
const tileY = pos => pos.y + GAPY;
const rowCY = pos => pos.y + ROWP / 2;

/* ── layout: una fila por línea en preorden DFS; columna base = rama del padre ── */
function computeLayout() {
  layout = new Map();
  rows = 0; maxCol = 0;
  const place = (t, base) => {
    layout.set(t.id, { row: rows, base, x: GRIDX + base * COLP, y: MARGIN + rows * ROWP });
    rows++;
    maxCol = Math.max(maxCol, base + t.maxLevel);
    if (collapsed.has(t.id)) return;
    for (const k of current.children.get(t.id) || []) place(k, base + k.parent[1]);
  };
  for (const r of current.trees.filter(t => !t.parent)) place(r, 0);
  bounds = { w: GRIDX + maxCol * COLP + MARGIN, h: MARGIN * 2 + rows * ROWP };
}

/* ── render SVG ── */
function render() {
  const grid = [], labels = [], edges = [], nodes = [];
  const visible = id => {
    let t = current.byId.get(id);
    while (t && t.parent) {
      if (collapsed.has(t.parent[0])) return false;
      t = current.byId.get(t.parent[0]);
    }
    return true;
  };

  /* rejilla de fondo: bandas alternas + líneas de columna + separador de placas */
  for (let r = 0; r < rows; r++) {
    grid.push(`<rect class="grid-band${r % 2 ? " alt" : ""}" x="0" y="${MARGIN + r * ROWP}" width="${bounds.w}" height="${ROWP}"/>`);
  }
  grid.push(`<rect id="sel-band" class="grid-band sel" x="0" y="0" width="${bounds.w}" height="${ROWP}" visibility="hidden"/>`);
  for (let c = 0; c <= maxCol; c++) {
    const x = GRIDX + c * COLP - GAPX;
    grid.push(`<line class="grid-line" x1="${x}" y1="${MARGIN}" x2="${x}" y2="${bounds.h - MARGIN}"/>`);
  }
  grid.push(`<line class="grid-sep" x1="${GRIDX - GAPX - 4}" y1="${MARGIN}" x2="${GRIDX - GAPX - 4}" y2="${bounds.h - MARGIN}"/>`);

  for (const t of current.trees) {
    if (!visible(t.id)) continue;
    const pos = layout.get(t.id);
    const hasKids = current.children.has(t.id);
    const isCollapsed = collapsed.has(t.id);
    const name = t.nameEs || t.name;
    const nameMax = hasKids ? (isCollapsed ? 14 : 18) : 22;
    const hiddenN = isCollapsed ? countDescendants(t.id) : 0;
    const ry = pos.y + (ROWP - 34) / 2;

    labels.push(`<g class="wrow" data-id="${t.id}" transform="translate(${MARGIN},${ry})"
        tabindex="0" role="button" aria-label="${esc(name)}">
      <rect class="row-plaque" width="${LABELW}" height="34" rx="3"/>
      <rect class="row-bar ${t.parent ? "branch" : "root"}" width="4" height="34" rx="1"/>
      <text class="row-diamond" x="12" y="21">◆</text>
      <text class="row-name" x="24" y="21">${esc(trunc(name, nameMax))}</text>
      ${isCollapsed ? `<text class="hidden-count" x="${LABELW - 24}" y="21" text-anchor="end">+${hiddenN}</text>` : ""}
      ${hasKids ? `<g class="collapse-btn" data-id="${t.id}" transform="translate(${LABELW - 12},17)"
          tabindex="0" role="button" aria-label="${isCollapsed ? "Expandir" : "Contraer"} rama">
          <circle r="8"/><text y="3.5" text-anchor="middle">${isCollapsed ? "+" : "−"}</text>
        </g>` : ""}
    </g>`);

    /* conector horizontal entre las casillas de la misma línea */
    if (t.maxLevel > 1) {
      const cy = rowCY(pos);
      edges.push(`<path class="wline" data-id="${t.id}"
        d="M${tileX(pos, 1) + TS / 2},${cy} H${tileX(pos, t.maxLevel) + TS / 2}"/>`);
    }

    /* codo ortogonal padre→hijo con badge de nivel de desbloqueo */
    if (t.parent) {
      const p = layout.get(t.parent[0]);
      if (p) {
        const lv = t.parent[1];
        const px = tileX(p, lv) + TS / 2, py = tileY(p) + TS;
        const cy = rowCY(pos), cx = pos.x;
        const bx = (px + cx) / 2;
        edges.push(`<path class="wedge" data-child="${t.id}" data-parent="${t.parent[0]}" data-lv="${lv}"
            d="M${px},${py} V${cy} H${cx}"/>
          <g class="edge-lv-g" data-child="${t.id}">
            <rect class="edge-lv-bg" x="${bx - 15}" y="${cy - 8}" width="30" height="15" rx="3"/>
            <text class="edge-lv" x="${bx}" y="${cy + 3.5}" text-anchor="middle">Nv ${lv}</text>
          </g>`);
      }
    }

    /* casillas por nivel */
    for (let lv = 1; lv <= t.maxLevel; lv++) {
      const l = t.levels[lv - 1];
      const x = tileX(pos, lv), y = tileY(pos);
      const ele = (l.ele || [])[0];
      const eleBadge = ele ? (eleIconPath(ele[0])
        ? `<rect class="tile-ele-bg" x="${TS - 15}" y="-4" width="16" height="16" rx="3"/>
           <image class="tile-ele" href="${eleIconPath(ele[0])}" x="${TS - 14}" y="-3" width="14" height="14"/>`
        : `<rect class="tile-ele-bg" x="${TS - 15}" y="-4" width="16" height="16" rx="3"/>
           <circle cx="${TS - 7}" cy="4" r="5" fill="${ELE_COLORS[ele[0]] || "#888"}"/>`) : "";
      const forge = (!t.parent && lv === 1)
        ? `<rect class="tile-forge-bg" x="-4" y="-4" width="14" height="14" rx="2"/>
           <path class="tile-forge-ic" transform="translate(-4,-4)" d="M2,3 h9 v3 h-4 v6 h-2 v-6 h-3 z"/>` : "";
      nodes.push(`<g class="wnode${t.dummy ? " dummy" : ""}" data-id="${t.id}" data-lv="${lv}"
          transform="translate(${x},${y})" tabindex="0" role="treeitem"
          aria-label="${esc(name)} nivel ${lv}">
        <rect class="tile-box" width="${TS}" height="${TS}" rx="6" fill="${tileTint(l.rar)}"/>
        ${hasGameIcons()
          ? `<image class="tile-icon" href="assets/weapons/classes/${current.class}${l.rar >= 11 ? "_rX" : `_r${l.rar}`}.png"
              x="7" y="6" width="30" height="30"/>`
          : `<use class="tile-icon glyph" href="#i-${current.class}" x="7" y="6" width="30" height="30" style="color:${rarColor(l.rar)}"/>`}
        <text class="tile-lv" x="4" y="${TS - 4}">${lv}</text>
        ${eleBadge}${forge}
        <rect class="tile-ring" x="-3" y="-3" width="${TS + 6}" height="${TS + 6}" rx="8"/>
      </g>`);
    }
  }

  svg.innerHTML = `
    <defs>
      <linearGradient id="rowPlaque" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#9a7a4e"/><stop offset="1" stop-color="#7a5a34"/>
      </linearGradient>
      <linearGradient id="rowPlaqueSel" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#ffd75e"/><stop offset="1" stop-color="#d8a828"/>
      </linearGradient>
    </defs>
    <g id="tree-world">${grid.join("")}${edges.join("")}${labels.join("")}${nodes.join("")}</g>`;
  world = svg.querySelector("#tree-world");
  applyView();
  refreshHighlights();
}

function countDescendants(id) {
  let n = 0;
  const walk = i => { for (const k of current.children.get(i) || []) { n++; walk(k.id); } };
  walk(id);
  return n;
}

/* ── zoom / pan ── */
function applyView() {
  world?.setAttribute("transform", `translate(${view.x},${view.y}) scale(${view.k})`);
}
function zoomAt(mx, my, factor) {
  const k = Math.min(2.6, Math.max(0.06, view.k * factor));
  const f = k / view.k;
  view.x = mx - (mx - view.x) * f;
  view.y = my - (my - view.y) * f;
  view.k = k;
  applyView();
}
function fitTree() {
  const r = viewport.getBoundingClientRect();
  const k = Math.min((r.width - 30) / bounds.w, (r.height - 30) / bounds.h, 1.1);
  view.k = Math.max(0.06, k);
  view.x = (r.width - bounds.w * view.k) / 2;
  view.y = Math.max(14, (r.height - bounds.h * view.k) / 2);
  svg.classList.add("smooth");
  applyView();
  setTimeout(() => svg.classList.remove("smooth"), 280);
}
function initialView() {
  view.k = 1; view.x = 0; view.y = 0;
  applyView();
}
function focusNode(id) {
  const p = layout.get(id);
  if (!p) return;
  const lv = A.state.wLevel || 1;
  const r = viewport.getBoundingClientRect();
  if (view.k < 0.55) view.k = 1;
  view.x = r.width / 2 - (tileX(p, lv) + TS / 2) * view.k;
  view.y = r.height / 2 - rowCY(p) * view.k;
  svg.classList.add("smooth");
  applyView();
  setTimeout(() => svg.classList.remove("smooth"), 280);
}

/* ── selección y resaltado ── */
function refreshHighlights() {
  if (!world) return;
  const sel = A.state.wTree, selLv = A.state.wLevel;
  const path = new Map();          // id -> nivel máximo resaltado en esa línea
  const childEdges = new Set();
  if (sel != null) {
    let t = current.byId.get(sel), limit = selLv;
    while (t) {
      path.set(t.id, limit);
      if (!t.parent) break;
      limit = t.parent[1];
      t = current.byId.get(t.parent[0]);
    }
    for (const k of current.children.get(sel) || []) childEdges.add(k.id);
  }
  world.querySelectorAll(".wnode").forEach(g => {
    const id = +g.dataset.id, lv = +g.dataset.lv;
    const isSel = id === sel && lv === selLv;
    g.classList.toggle("selected", isSel);
    g.setAttribute("aria-selected", isSel ? "true" : "false");
    g.classList.toggle("on-path", !isSel && path.has(id) && lv <= path.get(id));
    g.classList.toggle("dimmed", filterMatch != null && !filterMatch.has(id));
  });
  world.querySelectorAll(".wrow").forEach(g => {
    const id = +g.dataset.id;
    g.classList.toggle("selected", id === sel);
    g.classList.toggle("dimmed", filterMatch != null && !filterMatch.has(id));
  });
  const band = world.querySelector("#sel-band");
  if (band) {
    const p = sel != null ? layout.get(sel) : null;
    if (p) { band.setAttribute("y", p.y); band.setAttribute("visibility", "visible"); }
    else band.setAttribute("visibility", "hidden");
  }
  world.querySelectorAll(".wline").forEach(p => {
    const id = +p.dataset.id;
    p.classList.toggle("on-path", path.has(id));
    p.classList.toggle("dimmed", filterMatch != null && !filterMatch.has(id));
  });
  world.querySelectorAll(".wedge").forEach(p => {
    const child = +p.dataset.child, parent = +p.dataset.parent, need = +p.dataset.lv;
    const onPath = (path.has(child) && path.has(parent)) || childEdges.has(child);
    p.classList.toggle("on-path", onPath);
    p.classList.toggle("locked", !onPath && sel != null && need > selLv);
    p.classList.toggle("dimmed", filterMatch != null && !filterMatch.has(child));
  });
  world.querySelectorAll(".edge-lv-g").forEach(g => {
    const child = +g.dataset.child;
    const t = world.querySelector(`.wedge[data-child="${child}"]`);
    g.querySelector(".edge-lv").classList.toggle("on-path", t?.classList.contains("on-path"));
    g.style.opacity = t?.classList.contains("dimmed") ? 0.18 : 1;
  });
}

export function selectTree(id, level = null) {
  const t = current?.byId.get(id);
  if (!t) return;
  // si la línea está bajo una rama contraída, expandirla para que la casilla exista
  let changed = false, p = t;
  while (p && p.parent) {
    if (collapsed.has(p.parent[0])) { collapsed.delete(p.parent[0]); changed = true; }
    p = current.byId.get(p.parent[0]);
  }
  if (changed) { computeLayout(); render(); }
  A.state.wTree = id;
  A.state.wLevel = level || t.maxLevel;
  refreshHighlights();
  A.hooks.renderWeaponDetails(t, A.state.wLevel);
}

/* ── filtros ── */
export function applyWeaponFilters(f) {
  if (!current) return;
  const active = f.name || f.rarity || f.element || f.affinity || f.arc || f.shot;
  if (!active) { filterMatch = null; refreshHighlights(); updateCount(); return; }
  const [rmin, rmax] = f.rarity ? f.rarity.split("-").map(Number) : [0, 99];
  const q = f.name?.toLowerCase() || "";
  filterMatch = new Set();
  for (const t of current.trees) {
    let ok = true;
    if (q) ok = t.levels.some(l => (l.nEs || "").toLowerCase().includes(q) || l.n.toLowerCase().includes(q));
    if (ok && f.rarity) ok = t.levels.some(l => l.rar >= rmin && l.rar <= rmax);
    if (ok && f.element) ok = t.levels.some(l => (l.ele || []).some(e => e[0] === f.element));
    if (ok && f.affinity) ok = t.levels.some(l =>
      f.affinity === "pos" ? l.aff > 0 : f.affinity === "neg" ? l.aff < 0 : l.aff === 0);
    // arco: el tiro de arco es constante por árbol; la flecha se busca en las cargas
    // de cualquier nivel. "!" = carga que solo otorga Recargando (Load Up).
    if (ok && f.arc) ok = t.levels.some(l => l.x?.arc === f.arc);
    if (ok && f.shot) ok = t.levels.some(l => (l.x?.charges || []).some(c =>
      c.split(" ")[0] === f.shot && (f.shotLu || !c.endsWith("!"))));
    if (ok) filterMatch.add(t.id);
  }
  refreshHighlights();
  updateCount();
}
function updateCount() {
  const el = document.getElementById("w-count");
  if (!current) { el.textContent = ""; return; }
  el.textContent = filterMatch != null
    ? `${filterMatch.size} de ${current.trees.length} líneas coinciden`
    : `${current.trees.length} líneas · ${current.trees.reduce((s, t) => s + t.levels.length, 0)} armas`;
}

/* ── carga de clase ── */
export async function loadClass(slug) {
  current = await loadWeaponClass(slug);
  A.state.wClass = slug;
  A.state.wTree = null;
  collapsed = new Set();
  document.querySelectorAll(".class-btn").forEach(b =>
    b.classList.toggle("active", b.dataset.slug === slug));
  const cat = A.data.categories.find(c => c.slug === slug);
  document.getElementById("w-class-title").innerHTML =
    `${classIcon(slug)} ${esc(cat.labelEs)} <small>${cat.label}</small>`;
  computeLayout();
  render();
  initialView();
  updateCount();
  A.hooks.clearWeaponDetails?.();
  A.hooks.onClassLoaded?.(slug);
}

/* ── tooltip de casilla: procedencia del arma de ese nivel ── */
function nodeTip(el) {
  const t = current?.byId.get(+el.dataset.id);
  if (!t) return "";
  const lv = +el.dataset.lv || t.maxLevel;
  const l = t.levels[lv - 1] || t.levels[t.levels.length - 1];
  const name = l.nEs || t.nameEs || t.name;
  const mons = monsterRows(t.monsters, "Monstruo / materiales de origen");
  let bow = "";
  if (current.class === "bow") {
    const arc = t.levels.find(x => x.x?.arc)?.x.arc;
    const order = ["Rapid", "Pierce", "Spread", "Heavy"];
    const present = new Set(t.levels.flatMap(x => (x.x?.charges || [])
      .filter(c => !c.endsWith("!")).map(c => c.split(" ")[0])));
    const shots = order.filter(s => present.has(s)).map(s => SHOT_ES[s] || s);
    bow = `<div class="tip-bow"><span class="k">Tiro de arco</span> ${esc(ARC_ES[arc] || arc || "—")}` +
      (shots.length ? ` · <span class="k">Flechas</span> ${esc(shots.join(", "))}` : "") + `</div>`;
  }
  return `<div class="tip-head">${classIcon(current.class, l.rar, "tip-wicon")}
      <div><div class="tip-title">${esc(name)}</div>
      <div class="tip-sub">${esc(t.name)} · Nv ${lv} · R${l.rar}${t.deviant ? " · Mutado" : ""}</div></div></div>
    ${bow}
    ${mons || `<div class="tip-none">Materiales genéricos (mineral / hueso): sin monstruo de origen.</div>`}`;
}

/* ── init ── */
export function init() {
  svg = document.getElementById("tree-svg");
  viewport = document.getElementById("tree-viewport");

  const list = document.getElementById("class-list");
  list.innerHTML = A.data.categories.map(c =>
    `<button class="class-btn" data-slug="${c.slug}">${classIcon(c.slug)}
      <span>${esc(c.labelEs)}</span><span class="cnt">${c.trees}</span></button>`).join("");
  list.querySelectorAll(".class-btn").forEach(b =>
    b.addEventListener("click", () => loadClass(b.dataset.slug)));
  bindTips(list, ".class-btn", el => {
    const c = A.data.categories.find(x => x.slug === el.dataset.slug);
    return c ? `<div class="tip-title">${esc(c.labelEs)}</div>
      <div class="tip-sub">${esc(c.label)} · ${c.trees} líneas</div>` : "";
  });
  bindTips(viewport, ".wnode", nodeTip);

  viewport.addEventListener("wheel", e => {
    e.preventDefault();
    const r = viewport.getBoundingClientRect();
    zoomAt(e.clientX - r.left, e.clientY - r.top, Math.exp(-e.deltaY * 0.0016));
  }, { passive: false });

  let drag = null;
  viewport.addEventListener("pointerdown", e => {
    if (e.target.closest(".collapse-btn")) return;
    drag = { x: e.clientX, y: e.clientY, vx: view.x, vy: view.y, moved: false, id: e.pointerId };
  });
  viewport.addEventListener("pointermove", e => {
    if (!drag) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if (!drag.moved && Math.abs(dx) + Math.abs(dy) > 4) {
      // capturar solo al iniciar el paneo: un clic simple debe conservar la casilla como target
      drag.moved = true;
      viewport.setPointerCapture(drag.id);
      viewport.classList.add("dragging");
    }
    if (!drag.moved) return;
    view.x = drag.vx + dx; view.y = drag.vy + dy;
    applyView();
  });
  viewport.addEventListener("pointerup", e => {
    viewport.classList.remove("dragging");
    if (drag && !drag.moved && !e.target.closest(".collapse-btn")) {
      const g = e.target.closest(".wnode");
      if (g) selectTree(+g.dataset.id, +g.dataset.lv);
      else {
        const r = e.target.closest(".wrow");
        if (r) selectTree(+r.dataset.id);
      }
    }
    drag = null;
  });
  viewport.addEventListener("pointercancel", () => {
    viewport.classList.remove("dragging");
    drag = null;
  });
  viewport.addEventListener("keydown", e => {
    if (e.key !== "Enter" && e.key !== " ") return;
    const btn = e.target.closest(".collapse-btn");
    if (btn) {
      e.preventDefault();
      toggleCollapse(+btn.dataset.id);
      return;
    }
    const g = e.target.closest(".wnode");
    if (g) {
      e.preventDefault();
      selectTree(+g.dataset.id, +g.dataset.lv);
      return;
    }
    const r = e.target.closest(".wrow");
    if (r) { e.preventDefault(); selectTree(+r.dataset.id); }
  });
  viewport.addEventListener("dblclick", e => {
    if (e.target.closest(".collapse-btn")) return;
    const g = e.target.closest(".wnode") || e.target.closest(".wrow");
    if (!g) return;
    toggleCollapse(+g.dataset.id);
  });
  svg.addEventListener("click", e => {
    const btn = e.target.closest(".collapse-btn");
    if (!btn) return;
    e.stopPropagation();
    toggleCollapse(+btn.dataset.id);
  });

  document.getElementById("wt-zoomin").addEventListener("click", () => {
    const r = viewport.getBoundingClientRect();
    zoomAt(r.width / 2, r.height / 2, 1.3);
  });
  document.getElementById("wt-zoomout").addEventListener("click", () => {
    const r = viewport.getBoundingClientRect();
    zoomAt(r.width / 2, r.height / 2, 1 / 1.3);
  });
  document.getElementById("wt-center").addEventListener("click", fitTree);
  document.getElementById("wt-expand").addEventListener("click", () => {
    collapsed = new Set();
    if (current) { computeLayout(); render(); }
  });

  A.hooks.loadClass = loadClass;
  A.hooks.selectTree = selectTree;
  A.hooks.focusNode = focusNode;
  A.hooks.applyWeaponFilters = applyWeaponFilters;
  A.hooks.refreshHighlights = refreshHighlights;
}

function toggleCollapse(id) {
  if (!current.children.has(id)) return;
  collapsed.has(id) ? collapsed.delete(id) : collapsed.add(id);
  computeLayout(); render();
}