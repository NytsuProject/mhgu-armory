/* app.js — núcleo: estado, carga de datos, utilidades compartidas */

export const A = {
  data: { categories: null, weapons: {}, sets: null, pieces: null,
          piecesByKey: null, searchIndex: null },
  state: { view: "cover", wClass: null, wTree: null, wLevel: 1,
           aSet: null, aSlot: "head" },
  hooks: {},          // registrados por cada módulo
  els: {},
};

export const RAR_COLORS = {
  1: "#e0e0e0", 2: "#c0a0dc", 3: "#d4cc00", 4: "#d87090", 5: "#48b448",
  6: "#3888e8", 7: "#d43838", 8: "#20b8b8", 9: "#e88030", 10: "#ff50a0", 11: "#cc00ff",
};
export const rarColor = r => RAR_COLORS[r] || "#9d8f74";

export const ELE_COLORS = {
  Fuego: "#e8603c", Agua: "#4aa3e8", Rayo: "#e8d24a", Hielo: "#9adcf0",
  Dragón: "#a05ae8", Veneno: "#b06ae0", Parálisis: "#e8c84a", Sueño: "#7ab8e8",
  Explosión: "#e89050",
};
export const RES_COLORS = ["#e8603c", "#4aa3e8", "#e8d24a", "#9adcf0", "#a05ae8"];
export const NOTE_COLORS = {
  White: "#f0f0f0", Red: "#e05038", Orange: "#e89030", Yellow: "#e8d040",
  Green: "#58b858", Blue: "#4888e8", "Sky Blue": "#60c8e8", Purple: "#a058d8",
};
export const NOTE_ES = {
  White: "Blanca", Red: "Roja", Orange: "Naranja", Yellow: "Amarilla",
  Green: "Verde", Blue: "Azul", "Sky Blue": "Celeste", Purple: "Púrpura",
};
export const SHARP_COLORS = ["#e04038", "#e89030", "#e8d040", "#58b858", "#4888e8", "#f0f0f0", "#b06ae8"];
export const SHARP_ES = ["Rojo", "Naranja", "Amarillo", "Verde", "Azul", "Blanco", "Púrpura"];

/* Arco — terminología ES OFICIAL del juego (VERIFIED: HN_WeaponControlsMsg_spa.gmd,
   índices alineados con la versión eng). Tiro de arco = arc; tipo de flecha = carga. */
export const ARC_ES = { Focus: "Foco", Wide: "Amplio", Blast: "Ráfaga" };
export const SHOT_ES = { Rapid: "Salva", Pierce: "Perforante", Spread: "Abanico", Heavy: "Pesada" };

export const esc = s => String(s ?? "").replace(/[&<>"']/g,
  c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

export const icon = (id, cls = "ic") => `<svg class="${cls}"><use href="#i-${id}"/></svg>`;

/* iconos reales extraídos del juego (ver docs/DATA_SOURCES.md) */
const ELE_ICON = {
  Fuego: "fire", Agua: "water", Rayo: "thunder", Hielo: "ice", Dragón: "dragon",
  Veneno: "poison", Parálisis: "paralysis", Sueño: "sleep", Explosión: "blast",
};
/* Iconos del juego incluidos como referencia fan comunitaria sin ánimo de lucro
   (© Capcom, sin afiliación; ver docs/README.md). Los glifos SVG propios solo
   actúan como red de seguridad si algún asset faltara en el despliegue. */
let gameIcons = true;
export const hasGameIcons = () => gameIcons;
export async function probeGameIcons() {
  try { gameIcons = (await fetch("assets/weapons/classes/great_sword.png", { method: "HEAD" })).ok; }
  catch { gameIcons = false; }
}
const glyph = (id, cls, extra = "") =>
  `<svg class="${cls} glyph${extra ? " " + extra : ""}"><use href="#i-${id}"/></svg>`;
export const classIcon = (slug, rar = null, cls = "wicon") => {
  if (!gameIcons) return glyph(slug, cls);
  const suf = rar == null ? "" : rar >= 11 ? "_rX" : `_r${rar}`;
  return `<img class="${cls}" src="assets/weapons/classes/${slug}${suf}.png" alt="" loading="lazy">`;
};
export const eleIcon = (es, cls = "eicon") => {
  if (!ELE_ICON[es]) return "";
  if (!gameIcons) return glyph("el-" + ELE_ICON[es], cls, "ele-" + ELE_ICON[es]);
  return `<img class="${cls}" src="assets/icons/elements/${ELE_ICON[es]}.png" alt="${esc(es)}" loading="lazy">`;
};
export const eleIconPath = es => (gameIcons && ELE_ICON[es]) ? `assets/icons/elements/${ELE_ICON[es]}.png` : null;
export const slotIcon = (slot, cls = "sicon") =>
  gameIcons ? `<img class="${cls}" src="assets/armor/slots/${slot}.png" alt="" loading="lazy">` : glyph(slot, cls);
export const monsterIcon = (id, cls = "micon") =>
  gameIcons ? `<img class="${cls}" src="assets/monsters/${id}.webp" alt="" loading="lazy" onerror="this.remove()">` : glyph("monster", cls);

export const slotCount = s => (s || "").split("").filter(c => c === "◯").length;

export const rankOf = r => r <= 3 ? "LR" : r <= 7 ? "HR" : "G";
export const RANK_ES = { LR: "Rango bajo", HR: "Rango alto", G: "Rango G" };

export function rarBadge(r) {
  return `<span class="rar-badge" style="background:${rarColor(r)}">R${r}</span>`;
}
export function vBadge(v) {
  const es = { VERIFIED: "VERIFICADO", PARTIAL: "PARCIAL", UNVERIFIED: "SIN VERIFICAR",
               MISSING: "SIN DATOS", DERIVED: "DERIVADO" };
  return `<span class="v-badge v-${v}">${es[v] || v}</span>`;
}

export async function fetchJSON(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`${path}: ${res.status}`);
  return res.json();
}

export async function loadCoreData() {
  const [cats, sets, pieces, monsters] = await Promise.all([
    fetchJSON("data/weapon-categories.json"),
    fetchJSON("data/armor/sets.json"),
    fetchJSON("data/armor/pieces.json"),
    fetchJSON("data/armor/monsters.json"),
  ]);
  A.data.categories = cats.classes;
  A.data.sets = sets.sets;
  A.data.piecesMeta = pieces;
  A.data.pieces = pieces.pieces;
  A.data.piecesByKey = new Map(pieces.pieces.map(p => [`${p.slot}:${p.sid}`, p]));
  A.data.monsters = monsters.monsters;
  A.data.monstersById = new Map(monsters.monsters.map(m => [m.id, m]));
}

export async function loadWeaponClass(slug) {
  if (A.data.weapons[slug]) return A.data.weapons[slug];
  const cat = A.data.categories.find(c => c.slug === slug);
  const d = await fetchJSON("data/" + cat.file);
  d.byId = new Map(d.trees.map(t => [t.id, t]));
  d.children = new Map();
  for (const t of d.trees) {
    if (t.parent) {
      const pid = t.parent[0];
      if (!d.children.has(pid)) d.children.set(pid, []);
      d.children.get(pid).push(t);
    }
  }
  for (const [, kids] of d.children) kids.sort((a, b) => (a.order || a.id) - (b.order || b.id));
  A.data.weapons[slug] = d;
  return d;
}

export async function loadSearchIndex() {
  if (!A.data.searchIndex) A.data.searchIndex = await fetchJSON("data/search-index.json");
  return A.data.searchIndex;
}

/* ── arranque ── */
async function boot() {
  const [sprite] = await Promise.all([
    fetch("assets/icons/sprite.svg").then(r => r.text()),
    probeGameIcons(),
  ]);
  document.getElementById("sprite-holder").innerHTML = sprite;

  await loadCoreData();

  const nav = await import("./navigation.js");
  const tree = await import("./weapon-tree.js");
  const details = await import("./weapon-details.js");
  const armor = await import("./armor-catalog.js");
  const search = await import("./search.js");
  const filters = await import("./filters.js");
  const tooltip = await import("./tooltip.js");

  tooltip.initTooltip();
  nav.init();
  tree.init();
  details.init();
  armor.init();
  search.init();
  filters.init();

  nav.showView("cover");
}

boot().catch(err => {
  document.body.insertAdjacentHTML("beforeend",
    `<div style="position:fixed;inset:auto 12px 12px 12px;padding:12px;background:#3a1510;border:1px solid #b04434;color:#e8c0b0;border-radius:4px;z-index:999">
      Error al iniciar MHGU ARMORY: ${esc(err.message)}. Sirve la carpeta con un servidor estático
      (p. ej. <code>python -m http.server</code>) y recarga.</div>`);
  console.error(err);
});