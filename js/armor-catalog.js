/* armor-catalog.js — Armor Collection: conjuntos, piezas y fichas */
import { A, esc, icon, slotIcon, eleIcon, monsterIcon, rarColor, rarBadge, vBadge, RANK_ES, RES_COLORS, slotCount } from "./app.js";
import { bindTips, monsterRows } from "./tooltip.js";

const SLOTS = ["head", "chest", "arms", "waist", "legs"];
let setMeta = new Map();   // id -> {cls, gender, skills:Set, names:string}
let filtered = [];

function buildMeta() {
  for (const s of A.data.sets) {
    const pieces = SLOTS.map(sl => s.pieces[sl] != null
      ? A.data.piecesByKey.get(`${sl}:${s.pieces[sl]}`) : null).filter(Boolean);
    const clsSet = new Set(pieces.map(p => p.cls));
    const genSet = new Set(pieces.map(p => p.gender));
    const skills = new Set();
    for (const p of pieces) for (const sk of p.sk) skills.add(sk[1] || sk[0]);
    setMeta.set(s.id, {
      cls: clsSet.size === 1 ? [...clsSet][0] : "A",
      gender: genSet.size === 1 ? [...genSet][0] : 2,
      skills,
      monsters: new Set(s.monsters || []),
      names: (s.name + " " + (s.nameEs || "") + " " + pieces.map(p => p.name + " " + p.nameEs).join(" ")).toLowerCase(),
      pieces,
    });
  }
}

/* ── filtros ── */
export function applyArmorFilters(f) {
  const q = f.name?.toLowerCase() || "";
  filtered = A.data.sets.filter(s => {
    const m = setMeta.get(s.id);
    if (q && !m.names.includes(q)) return false;
    if (f.rank && s.rank !== f.rank) return false;
    if (f.rarity && s.rarity !== +f.rarity) return false;
    if (f.cls && m.cls !== f.cls) return false;
    if (f.gender !== "" && f.gender != null && m.gender !== +f.gender) return false;
    if (f.monster && !m.monsters.has(+f.monster)) return false;
    if (f.skill && !m.skills.has(f.skill)) return false;
    return true;
  });
  renderSetList();
  document.getElementById("a-count").textContent =
    `${filtered.length} de ${A.data.sets.length} conjuntos`;
}

function renderSetList() {
  const list = document.getElementById("set-list");
  list.innerHTML = filtered.map(s => {
    const m = setMeta.get(s.id);
    return `<button class="set-row${s.id === A.state.aSet ? " active" : ""}" data-id="${s.id}">
      <span class="rar-strip" style="background:${rarColor(s.rarity)}"></span>
      <span class="set-name">${esc(s.nameEs || s.name)}</span>
      <span class="set-meta">
        <span class="mini-chip rank-${s.rank}">${s.rank}</span>
        <span class="mini-chip">${m.cls}</span>
        <span class="mini-chip" title="${m.gender === 2 ? "Ambos géneros" : m.gender === 0 ? "Masculino" : "Femenino"}">${m.gender === 2 ? "M/F" : m.gender === 0 ? "M" : "F"}</span>
      </span>
    </button>`;
  }).join("");
  list.querySelectorAll(".set-row").forEach(b =>
    b.addEventListener("click", () => selectSet(+b.dataset.id)));
}

/* ── selección de conjunto ── */
export function selectSet(id, slot = null) {
  const s = A.data.sets.find(x => x.id === id);
  if (!s) return;
  A.state.aSet = id;
  const m = setMeta.get(id);
  const firstSlot = slot && s.pieces[slot] != null ? slot
    : SLOTS.find(sl => s.pieces[sl] != null) || "head";
  A.state.aSlot = firstSlot;

  document.querySelectorAll(".set-row").forEach(b =>
    b.classList.toggle("active", +b.dataset.id === id));
  document.querySelector(`.set-row[data-id="${id}"]`)?.scrollIntoView({ block: "nearest" });

  const CLS_ES = { B: "Espadachín", G: "Artillero", A: "Espadachín / Artillero" };
  const GEN_ES = { 0: "Masculino", 1: "Femenino", 2: "Ambos géneros" };
  const header = document.getElementById("set-header");
  header.innerHTML = `
    <div class="set-title">${esc(s.nameEs || s.name)}</div>
    <div class="set-title-en">${esc(s.name)}${s.nameEs ? "" : " · nombre ES no disponible"}</div>
    <div class="set-chips">
      ${rarBadge(s.rarity)}
      <span class="chip gold">${RANK_ES[s.rank]}</span>
      <span class="chip">${CLS_ES[m.cls]}</span>
      <span class="chip">${GEN_ES[m.gender]}</span>
      <span class="chip">${m.pieces.length}/5 piezas</span>
      ${vBadge(s.nameEs ? "DERIVED" : "MISSING")}
    </div>
    ${s.monsters?.length ? `<div class="set-chips monsters">${s.monsters.map(id => {
      const mo = A.data.monstersById.get(id);
      return mo ? `<span class="chip monster" title="Monstruo de origen">${monsterIcon(id)}${esc(mo.nameEs || mo.name)}</span>` : "";
    }).join("")}${s.deviant ? `<span class="chip deviant">Mutado</span>` : ""}</div>` : ""}
    <div class="set-rule"></div>`;
  header.classList.remove("swap"); void header.offsetWidth; header.classList.add("swap");

  renderPieceStrip(s);
  renderSummary(s, m);
  renderPieceDetails(s, firstSlot);
}

function renderPieceStrip(s) {
  const strip = document.getElementById("piece-strip");
  const SLOT_ES = A.data.piecesMeta.slotEs;
  strip.innerHTML = SLOTS.map(sl => {
    const sid = s.pieces[sl];
    if (sid == null) {
      return `<div class="piece-card missing">
        <span class="pc-slot">${SLOT_ES[sl]}</span>
        <div class="pc-icon">${slotIcon(sl)}</div>
        <span class="pc-missing-txt">Este conjunto no tiene ${SLOT_ES[sl].toLowerCase()}</span>
      </div>`;
    }
    const p = A.data.piecesByKey.get(`${sl}:${sid}`);
    return `<button class="piece-card${sl === A.state.aSlot ? " active" : ""}" data-slot="${sl}">
      <span class="pc-rar" style="background:${rarColor(p.rarity)}"></span>
      <span class="pc-slot">${SLOT_ES[sl]}</span>
      <div class="pc-icon">${slotIcon(sl)}</div>
      <span class="pc-name">${esc(p.nameEs || p.name)}</span>
      <span class="pc-def">Def ${p.def[0]}–${p.def[1]} · ${"◯".repeat(p.deco) || "sin ranuras"}</span>
    </button>`;
  }).join("");
  strip.classList.remove("swap"); void strip.offsetWidth; strip.classList.add("swap");
  strip.querySelectorAll(".piece-card[data-slot]").forEach(b =>
    b.addEventListener("click", () => {
      A.state.aSlot = b.dataset.slot;
      strip.querySelectorAll(".piece-card").forEach(c =>
        c.classList.toggle("active", c.dataset.slot === b.dataset.slot));
      renderPieceDetails(s, b.dataset.slot);
    }));
}

const signed = n => n > 0 ? `+${n}` : String(n);

function setSkills(pieces) {
  const skills = new Map();
  const copies = pieces.filter(p => p.sk.some(([en]) => en === "Torso Up")).length;
  for (const p of pieces) for (const [en, es, pts] of p.sk) {
    if (!skills.has(en)) skills.set(en, { en, label: es || en, total: 0 });
    skills.get(en).total += pts * (p.slot === "chest" ? 1 + copies : 1);
  }
  return [...skills.values()].sort((a, b) => b.total - a.total);
}

function renderSkillGuide({ en, label, total }) {
  const torso = en === "Torso Up";
  const levels = A.data.skillLevels[en] || [];
  // Solo cuenta el mayor nivel alcanzado en la dirección del total.
  const reached = levels.filter(({ points }) => points > 0 ? total >= points : total <= points);
  const current = reached.reduce((best, row) =>
    !best || Math.abs(row.points) > Math.abs(best.points) ? row : best, null);
  return `<article class="skill-guide-card">
    <header><h3>${esc(label)}</h3><span>${torso ? "Sin umbral" : `${signed(total)} pts`}</span></header>
    ${torso ? `<p>Cada pieza con Torso+ copia los puntos de habilidad de la pechera. El total ya incluye esas copias.</p>` :
      levels.map(row => {
        const active = row === current;
        const missing = row.points - total;
        const status = active ? "Nivel alcanzado" : row.points > 0 && missing > 0
          ? `Falta${missing === 1 ? "" : "n"} ${missing} ${missing === 1 ? "punto" : "puntos"}` : "";
        return `<div class="guide-tier${active ? " reached" : ""}">
          <span class="guide-points${row.points < 0 ? " neg" : ""}">${signed(row.points)}</span>
          <div><strong>${esc(row.name)}</strong>${status ? `<small>${status}</small>` : ""}
            <p>${esc(row.description)}</p></div>
        </div>`;
      }).join("") || "<p>Sin niveles documentados.</p>"}
  </article>`;
}

function renderSummary(s, m) {
  const ps = m.pieces;
  const defBase = ps.reduce((a, p) => a + p.def[0], 0);
  const defMax = ps.reduce((a, p) => a + p.def[1], 0);
  const res = [0, 0, 0, 0, 0];
  for (const p of ps) p.res.forEach((v, i) => res[i] += v);
  const skills = setSkills(ps);
  const RES_ES = A.data.piecesMeta.resEs;
  const sum = document.getElementById("set-summary");
  sum.innerHTML = `
    <div class="section-rule">Resumen del conjunto (${ps.length} piezas)</div>
    <div class="sum-grid">
      <div class="sum-box"><div class="k">Defensa total</div>
        <div class="v">${defBase} <small>→</small> ${defMax}</div></div>
      <div class="sum-box"><div class="k">Resistencias totales</div>
        <div class="res-sum">${res.map((v, i) =>
          `<span class="rs">${eleIcon(RES_ES[i]) || `<span class="dot" style="background:${RES_COLORS[i]}"></span>`}${v > 0 ? "+" : ""}${v}</span>`).join("")}</div></div>
      <div class="sum-box"><div class="k">Ranuras de decoración</div>
        <div class="v">${ps.reduce((a, p) => a + p.deco, 0)}</div></div>
    </div>
    <div class="section-rule">Puntos de habilidad acumulados</div>
    <div class="skill-sum">${skills.map(({ en, label, total }) =>
      `<span class="sk-chip${total < 0 ? " neg" : ""}">${esc(label)}${en === "Torso Up" ? "" : ` <b>${signed(total)}</b>`}</span>`).join("") || "<span style='color:var(--text-faint)'>Sin habilidades</span>"}</div>
    ${skills.length ? `<div class="section-rule">Efectos y umbrales de activación</div>
      <div class="skill-guide">${skills.map(renderSkillGuide).join("")}</div>
      <p class="guide-note">Niveles según los puntos de las piezas, sin adornos, talismán ni bonificaciones de otras habilidades.${s.deviant ? " Las habilidades de alma también requieren mejorar las piezas al nivel correspondiente." : ""}</p>` : ""}`;
  sum.classList.remove("swap"); void sum.offsetWidth; sum.classList.add("swap");
}

/* ── ficha de pieza ── */
function renderPieceDetails(s, slot) {
  const box = document.getElementById("piece-details");
  const sid = s.pieces[slot];
  if (sid == null) {
    box.innerHTML = `<div class="empty-state">${slotIcon(slot, "sicon big")}<p>Este conjunto no incluye pieza de ${A.data.piecesMeta.slotEs[slot].toLowerCase()}.</p></div>`;
    return;
  }
  const p = A.data.piecesByKey.get(`${slot}:${sid}`);
  const RES_ES = A.data.piecesMeta.resEs;
  const maxLv = p.lv.length;
  const maxDef = Math.max(...p.lv);
  const curve = p.lv.map(v =>
    `<span style="height:${Math.max(8, v / maxDef * 100)}%" title="Nv ${p.lv.indexOf(v) + 1}: ${v}"></span>`).join("");

  box.innerHTML = `
    <div class="pd-head">
      <div class="pd-icon">${slotIcon(slot)}</div>
      <div>
        <div class="pd-name">${esc(p.nameEs || p.name)}</div>
        <div class="pd-name-en">${esc(p.name)}${p.nameJa ? ` · ${esc(p.nameJa)}` : ""}</div>
        <div class="pd-chips">
          ${rarBadge(p.rarity)}
          <span class="chip">${RANK_ES[p.rank]}</span>
          <span class="chip">${{ B: "Espadachín", G: "Artillero", A: "Ambos" }[p.cls]}</span>
          <span class="chip">${{ 0: "Masculino", 1: "Femenino", 2: "Ambos" }[p.gender]}</span>
          ${vBadge(p.v)}
        </div>
      </div>
    </div>
    <div class="section-rule">Defensa</div>
    <div class="stat-grid">
      <div class="stat-cell"><div class="k">Base</div><div class="v">${p.def[0]}</div></div>
      <div class="stat-cell"><div class="k">Máxima (Nv ${maxLv})</div><div class="v">${p.def[1]}</div></div>
    </div>
    <div class="def-curve">${curve}</div>
    <div class="def-lv-labels"><span>Nv 1</span><span>Nv ${maxLv}</span></div>
    <div class="section-rule">Resistencias elementales</div>
    <div class="res-grid">${p.res.map((v, i) =>
      `<div class="res-cell">${eleIcon(RES_ES[i]) || `<div class="dot" style="background:${RES_COLORS[i]}"></div>`}
        <div class="rv ${v > 0 ? "pos" : v < 0 ? "neg" : "zero"}">${v > 0 ? "+" : ""}${v}</div>
        <div class="rk">${RES_ES[i]}</div></div>`).join("")}</div>
    <div class="section-rule">Ranuras de decoración</div>
    <div class="slots-line">${p.deco > 0
      ? Array.from({ length: p.deco }, () => `<span class="slot-ico filled"></span>`).join("") + `<span>${p.deco}</span>`
      : `<span style="color:var(--text-faint)">Ninguna</span>`}</div>
    <div class="section-rule">Habilidades</div>
    <div class="skill-list">${p.sk.length ? p.sk.map(([en, es, pts]) =>
      `<div class="skill-row"><span class="sk-n">${esc(es || en)}${es ? `<small>${esc(en)}</small>` : ""}</span>
        <span class="sk-p${pts < 0 ? " neg" : ""}">${pts > 0 ? "+" : ""}${pts}</span></div>`).join("")
      : `<div style="color:var(--text-faint);font-size:12px">Sin habilidades</div>`}</div>`;
  box.classList.remove("swap"); void box.offsetWidth; box.classList.add("swap");
}

export function selectSetByPiece(slot, sid) {
  const s = A.data.sets.find(x => x.pieces[slot] === sid);
  if (s) selectSet(s.id, slot);
}

/* ── tooltips de procedencia ── */
function setTip(el) {
  const s = A.data.sets.find(x => x.id === +el.dataset.id);
  if (!s) return "";
  return `<div class="tip-head">${slotIcon("chest", "tip-wicon")}
      <div><div class="tip-title">${esc(s.nameEs || s.name)}</div>
      <div class="tip-sub">${esc(s.name)} · R${s.rarity} · ${RANK_ES[s.rank]}${s.deviant ? " · Mutado" : ""}</div></div></div>
    ${monsterRows(s.monsters) || `<div class="tip-none">Sin monstruo de origen registrado.</div>`}`;
}
function pieceTip(el) {
  const s = A.data.sets.find(x => x.id === A.state.aSet);
  if (!s) return "";
  const sl = el.dataset.slot;
  const p = A.data.piecesByKey.get(`${sl}:${s.pieces[sl]}`);
  if (!p) return "";
  return `<div class="tip-head">${slotIcon(sl, "tip-wicon")}
      <div><div class="tip-title">${esc(p.nameEs || p.name)}</div>
      <div class="tip-sub">${esc(p.name)} · R${p.rarity}</div></div></div>
    ${monsterRows(s.monsters) || `<div class="tip-none">Sin monstruo de origen registrado.</div>`}`;
}

export function init() {
  buildMeta();
  bindTips(document.getElementById("set-list"), ".set-row", setTip);
  bindTips(document.getElementById("piece-strip"), ".piece-card[data-slot]", pieceTip);
  const rarSel = document.getElementById("af-rarity");
  for (let r = 1; r <= 11; r++) rarSel.insertAdjacentHTML("beforeend", `<option value="${r}">Rareza ${r}</option>`);
  const skillSel = document.getElementById("af-skill");
  const allSkills = new Set();
  for (const p of A.data.pieces) for (const sk of p.sk) allSkills.add(sk[1] || sk[0]);
  [...allSkills].sort((a, b) => a.localeCompare(b, "es")).forEach(s =>
    skillSel.insertAdjacentHTML("beforeend", `<option value="${esc(s)}">${esc(s)}</option>`));
  const monSel = document.getElementById("af-monster");
  [...A.data.monsters].sort((a, b) => (a.nameEs || a.name).localeCompare(b.nameEs || b.name, "es"))
    .forEach(mo => monSel.insertAdjacentHTML("beforeend",
      `<option value="${mo.id}">${esc(mo.nameEs || mo.name)}</option>`));

  filtered = A.data.sets;
  renderSetList();
  document.getElementById("a-count").textContent = `${filtered.length} conjuntos`;

  A.hooks.selectSet = selectSet;
  A.hooks.selectSetByPiece = selectSetByPiece;
  A.hooks.applyArmorFilters = applyArmorFilters;
}