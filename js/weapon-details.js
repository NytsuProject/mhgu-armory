/* weapon-details.js — panel derecho: estadísticas por nivel y rasgos de clase */
import { A, brandIcon, esc, icon, classIcon, eleIcon, rarColor, rarBadge, vBadge, rankOf, RANK_ES,
         ELE_COLORS, NOTE_COLORS, NOTE_ES, SHARP_COLORS, SHARP_ES, ARC_ES, SHOT_ES, slotCount } from "./app.js";
import { monsterRows } from "./tooltip.js";

/* Terminología ES estándar de la saga (DERIVED; los nombres propios se conservan).
   ARC_ES / SHOT_ES (arco) son oficiales del juego y viven en app.js. */
const PHIAL_ES = { Impact: "Impacto", Element: "Elemental", Power: "Poder",
  Dragon: "Dragón", Exhaust: "Fatiga", Poison: "Veneno", Paralysis: "Parálisis" };
const SHELL_ES = { Normal: "Normal", Long: "Largo", Wide: "Difusión" };
const COAT_ES = { "Power Coating": "Rev. de poder", "Close Range Coating": "Rev. corto alcance",
  "Poison Coating": "Rev. veneno", "Paralysis Coating": "Rev. parálisis",
  "Sleep Coating": "Rev. sueño", "Exhaust Coating": "Rev. fatiga",
  "Blast Coating": "Rev. explosión", "Element Coating": "Rev. elemental" };
const AMMO_ES = { "Normal S": "Normal", "Pierce S": "Perforante", "Pellet S": "Perdigones",
  "Crag S": "Explosiva", "Clust S": "Racimo", "Recover S": "Recuperadora",
  "Poison S": "Venenosa", "Paralysis S": "Paralizante", "Sleep S": "Somnífera",
  "Exhaust S": "Fatigante", "Flaming S": "Ígnea", "Water S": "Acuosa",
  "Freeze S": "Gélida", "Thunder S": "Eléctrica", "Dragon S": "Dracónica",
  "Slicing S": "Cortante", "Stone S": "Pétrea", "Tranq S": "Tranquilizante",
  "Paint S": "Marcadora", "Demon S": "Demoníaca", "Armor S": "Blindada",
  "Wyvern S": "Wyverniana", "Blast S": "Explosiva" };
const RELOAD_ES = { "V. Slow": "Muy lenta", "Bel.Avg": "Bajo la media", Average: "Media",
  "Abv.Avg": "Sobre la media", "V. Fast": "Muy rápida" };
const RECOIL_ES = { Low: "Bajo", Some: "Ligero", "Avg.": "Medio", High: "Alto" };
const DEV_ES = { "(None)": "(Ninguna)", "L Mild": "Izq. leve", "R Mild": "Der. leve",
  "LR Mild": "Izq./Der. leve", "L Severe": "Izq. severa", "R Severe": "Der. severa",
  "LR Severe": "Izq./Der. severa" };
const KIN_ES = { Cutting: "Corte", Blunt: "Contundente" };

const ammoEs = a => AMMO_ES[a] || a;
const coatEs = c => {
  const m = /^(.*?)( 2)?$/.exec(c);
  return (COAT_ES[m[1]] || m[1]) + (m[2] ? " 2" : "");
};
const chargeHTML = s => {
  const m = /^(\w+) Lv(\d+)(!?)$/.exec(s);
  const base = `${SHOT_ES[m[1]] || m[1]} Nv${m[2]}`;
  // "!" en la fuente = carga que solo otorga la habilidad Load Up (ES oficial: Recargando)
  return esc(base) + (m[3]
    ? ` <span class="lu-tag" title="Carga adicional solo con la habilidad Recargando (Load Up)">Recargando</span>`
    : "");
};

function sharpnessHTML(sh) {
  if (!sh) return "";
  const labels = ["Afilado", "Afilado +1", "Afilado +2"];
  return `<div class="sharpness"><div class="section-rule">Afilado</div>` +
    sh.map((band, i) => {
      const segs = band.map((v, ci) => v > 0
        ? `<span style="width:${v * 1.7}px;background:${SHARP_COLORS[ci]}" title="${SHARP_ES[ci]} ${v}"></span>`
        : "").join("");
      return `<div class="sharp-row"><span class="band">${labels[i]}</span><div class="sharp-bar">${segs}</div></div>`;
    }).join("") + `</div>`;
}

function slotsHTML(slots) {
  const n = slotCount(slots);
  const total = (slots || "").length || 3;
  let dots = "";
  for (let i = 0; i < total; i++) dots += `<span class="slot-ico ${i < n ? "filled" : "empty"}"></span>`;
  return `<div class="slots-line"><span style="color:var(--text-dim)">Ranuras</span> ${dots}
    <span style="color:var(--text-faint);font-size:11px">${n > 0 ? n : "ninguna"}</span></div>`;
}

function extrasHTML(t, l) {
  const x = l.x;
  if (!x) return "";
  const out = [];
  const block = (title, inner) =>
    out.push(`<div class="x-block"><div class="x-title">${title}</div>${inner}</div>`);

  if (x.phial) {
    const m = /^(\w+)(?: (\d+))?$/.exec(x.phial);
    block("Tipo de vial", `<div class="x-row"><span>${PHIAL_ES[m[1]] || m[1]}${m[2] ? ` <span style="color:var(--text-faint)">(${m[2]})</span>` : ""}</span></div>`);
  }
  if (x.shell) {
    const m = /^(\w+) Lv(\d+)$/.exec(x.shell);
    block("Bombardeo", `<div class="x-row"><span>${SHELL_ES[m[1]] || m[1]}</span><span class="k">Nivel ${m[2]}</span></div>`);
  }
  if (x.notes) {
    const code = x.notes.map(c => c === "Sky Blue" ? "C" : c[0]).join("");
    const pills = x.notes.map(c =>
      `<span class="note-pill" style="background:${NOTE_COLORS[c]}" title="${NOTE_ES[c]}"></span>`).join("");
    const songs = (A.data.weapons.hunting_horn?.songs || {})[code] || [];
    const songRows = songs.map(s =>
      `<div class="song-row"><span class="song-n">${esc(s.ne || s.n)}</span>
        <div class="song-e">${esc((s.ee || s.e).join(" · "))}</div>
        <div class="song-e">Duración ${esc(s.d)} s · Extensión ${esc(s.x)} s</div></div>`).join("");
    block("Notas y melodías", `<div class="note-pills">${pills}</div>${songRows}`);
  }
  if (x.kinsect) {
    const k = x.kinsect;
    block("Kinsecto", `
      <div class="x-row"><span>${esc(k.name)}</span><span class="k">${KIN_ES[k.type] || k.type}</span></div>
      <div class="x-row"><span class="k">Poder</span><span>${k.power}</span></div>
      <div class="x-row"><span class="k">Peso</span><span>${k.weight}</span></div>
      <div class="x-row"><span class="k">Velocidad</span><span>${k.speed}</span></div>`);
  }
  if (x.arc || x.charges || x.coatings) {
    let inner = "";
    if (x.arc) inner += `<div class="x-row"><span class="k">Tiro de arco</span><span>${ARC_ES[x.arc] || x.arc}</span></div>`;
    if (x.charges) inner += `<div class="x-row" style="display:block"><span class="k">Cargas</span><div style="margin-top:3px">${x.charges.map(c => `<div>${chargeHTML(c)}</div>`).join("")}</div></div>`;
    if (x.coatings) inner += `<div class="x-row" style="display:block"><span class="k">Revestimientos</span><div style="margin-top:3px">${x.coatings.map(c => `<div>${esc(coatEs(c))}</div>`).join("")}</div></div>`;
    block("Arco", inner);
  }
  if (x.stats) {
    block("Disparo", `
      <div class="x-row"><span class="k">Recarga</span><span>${RELOAD_ES[x.stats.reload] || x.stats.reload}</span></div>
      <div class="x-row"><span class="k">Retroceso</span><span>${RECOIL_ES[x.stats.recoil] || x.stats.recoil}</span></div>
      <div class="x-row"><span class="k">Desviación</span><span>${DEV_ES[x.stats.deviation] || x.stats.deviation}</span></div>`);
  }
  if (x.ammo) {
    const rows = Object.entries(x.ammo).map(([a, caps]) =>
      `<tr><td>${esc(ammoEs(a))}</td><td>${caps.join(" / ")}</td></tr>`).join("");
    block("Munición compatible", `<table class="ammo-table"><tr><th>Munición</th><th>Capacidad por nivel</th></tr>${rows}</table>`);
  }
  if (x.rapidFire) {
    const rows = x.rapidFire.map(r =>
      `<tr><td>${esc(ammoEs(r.ammo))}</td><td>${r.cap}</td><td>${r.power}%</td><td>${esc(r.wait)}</td></tr>`).join("");
    block("Disparo rápido", `<table class="ammo-table"><tr><th>Munición</th><th>Disparos</th><th>Potencia</th><th>Espera</th></tr>${rows}</table>`);
  }
  if (x.siege) {
    const rows = x.siege.map(r =>
      `<tr><td>${esc(ammoEs(r.ammo))}</td><td>${r.capacity}</td></tr>`).join("");
    block("Disparo agachado", `<table class="ammo-table"><tr><th>Munición</th><th>Capacidad</th></tr>${rows}</table>`);
  }
  if (x.internal) {
    const rows = x.internal.map(r =>
      `<tr><td>${esc(ammoEs(r.ammo))}</td><td>${r.cap}</td><td>${r.total}</td></tr>`).join("");
    block("Munición interna", `<table class="ammo-table"><tr><th>Munición</th><th>Cap.</th><th>Total</th></tr>${rows}</table>`);
  }
  return out.join("");
}

function lineageHTML(t) {
  const d = A.data.weapons[A.state.wClass];
  const out = [];
  if (t.parent) {
    const p = d.byId.get(t.parent[0]);
    if (p) out.push(`
      <div class="lin-kind">Evoluciona desde</div>
      <button class="lin-btn" data-tree="${p.id}" data-lv="${t.parent[1]}">
        ${icon("chevron")}<span class="rar-dot" style="background:${rarColor(p.levels[Math.min(t.parent[1], p.maxLevel) - 1].rar)}"></span>
        <span>${esc(p.nameEs || p.name)}</span>
        <span class="lv-req">alcanzar Nv ${t.parent[1]}</span>
      </button>`);
  } else {
    out.push(`<div class="lin-kind">Origen</div>
      <div class="lin-btn" style="cursor:default">${brandIcon()}<span>Forja directa (sin arma previa)</span></div>`);
  }
  const kids = d.children.get(t.id) || [];
  if (kids.length) {
    out.push(`<div class="lin-kind" style="margin-top:10px">Bifurcaciones / mejoras (${kids.length})</div>`);
    for (const k of kids) {
      out.push(`<button class="lin-btn" data-tree="${k.id}">
        ${icon("branch")}<span class="rar-dot" style="background:${rarColor(k.levels[k.levels.length - 1].rar)}"></span>
        <span>${esc(k.nameEs || k.name)}</span>
        <span class="lv-req">desde Nv ${k.parent[1]}</span>
      </button>`);
    }
  } else {
    out.push(`<div class="lin-kind" style="margin-top:10px">Arma final de esta línea</div>`);
  }
  return `<div class="lineage"><div class="section-rule">Línea de evolución</div>${out.join("")}</div>`;
}

export function renderWeaponDetails(t, lv) {
  const l = t.levels.find(x => x.lv === lv) || t.levels[t.levels.length - 1];
  const box = document.getElementById("weapon-details");
  const name = l.nEs || t.nameEs || l.n;
  const rename = t.stages.some(([slv]) => slv === l.lv);
  const eleHTML = (l.ele || []).map(e =>
    `<div class="ele-line">${eleIcon(e[0]) || `<span class="ele-dot" style="background:${ELE_COLORS[e[0]] || "#888"}"></span>`}
      <span>${esc(e[0])} ${e[2]}</span>${e[3] ? `<span class="awaken">(despertar)</span>` : ""}</div>`).join("");
  const monsHTML = t.monsters?.length
    ? `<div class="wd-monsters">${monsterRows(t.monsters, "Monstruo / materiales de origen")}</div>`
    : `<div class="wd-monsters"><div class="tip-none">Materiales genéricos (mineral / hueso): sin monstruo de origen.</div></div>`;

  box.innerHTML = `
    <div class="wd-head">
      <div class="wd-icon">${classIcon(A.state.wClass, l.rar)}</div>
      <div>
        <div class="wd-name">${esc(name)}</div>
        <div class="wd-name-en">${esc(l.n)}${l.nJa ? "" : ""}</div>
        <div class="wd-chips">
          ${rarBadge(l.rar)}
          <span class="chip">${RANK_ES[rankOf(l.rar)]}</span>
          ${vBadge(t.es === "VERIFIED" ? "VERIFIED" : t.es)}
          ${t.dummy ? `<span class="chip" style="color:#e08080">DUMMY · MHXX</span>` : ""}
        </div>
      </div>
    </div>
    <div class="level-strip">
      <span class="lv-label">Nivel</span>
      ${t.levels.map(x => `<button class="lv-btn${x.lv === l.lv ? " active" : ""}${t.stages.some(([s]) => s === x.lv) ? " rename" : ""}"
        data-lv="${x.lv}" title="${esc(x.nEs || x.n)}">${x.lv}</button>`).join("")}
    </div>
    <div class="stat-grid" style="margin-top:10px">
      <div class="stat-cell"><div class="k">Ataque</div><div class="v">${l.raw}</div></div>
      <div class="stat-cell"><div class="k">Afinidad</div><div class="v">${l.aff > 0 ? "+" : ""}${l.aff}<small>%</small></div></div>
      ${l.def ? `<div class="stat-cell"><div class="k">Defensa extra</div><div class="v">+${l.def}</div></div>` : ""}
      <div class="stat-cell"><div class="k">Rareza</div><div class="v" style="color:${rarColor(l.rar)}">${l.rar}</div></div>
    </div>
    ${eleHTML}
    ${monsHTML}
    ${slotsHTML(l.slots)}
    ${sharpnessHTML(l.sh)}
    ${extrasHTML(t, l)}
    ${lineageHTML(t)}`;

  box.classList.remove("swap"); void box.offsetWidth; box.classList.add("swap");
  box.querySelectorAll(".lv-btn").forEach(b => b.addEventListener("click", () => {
    A.state.wLevel = +b.dataset.lv;
    renderWeaponDetails(t, A.state.wLevel);
    A.hooks.refreshHighlights?.();
  }));
  box.querySelectorAll(".lin-btn[data-tree]").forEach(b => b.addEventListener("click", () => {
    const id = +b.dataset.tree;
    A.hooks.selectTree(id, b.dataset.lv ? +b.dataset.lv : null);
    A.hooks.focusNode(id);
  }));
}

export function clearWeaponDetails() {
  document.getElementById("weapon-details").innerHTML = `
    <div class="empty-state">${brandIcon("ic big")}
      <p>Selecciona un arma del árbol para ver sus estadísticas y características.</p>
    </div>`;
}

export function init() {
  A.hooks.renderWeaponDetails = renderWeaponDetails;
  A.hooks.clearWeaponDetails = clearWeaponDetails;
}