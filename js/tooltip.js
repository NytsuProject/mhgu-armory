/* tooltip.js — tooltips flotantes con procedencia (monstruos, materiales) */
import { A, esc, monsterIcon } from "./app.js";

let tip = null;

function place(x, y) {
  const pad = 16;
  const r = tip.getBoundingClientRect();
  let left = x + 18, top = y + 16;
  if (left + r.width > innerWidth - pad) left = x - r.width - 14;
  if (top + r.height > innerHeight - pad) top = y - r.height - 12;
  tip.style.left = Math.min(Math.max(pad, left), Math.max(pad, innerWidth - r.width - pad)) + "px";
  tip.style.top = Math.min(Math.max(pad, top), Math.max(pad, innerHeight - r.height - pad)) + "px";
}

export function showTip(html, x, y) {
  if (!html) return;
  tip.innerHTML = html;
  tip.classList.remove("hidden");
  place(x, y);
}
export function hideTip() { tip?.classList.add("hidden"); }

export function monsterRows(ids, label = "Monstruo de origen") {
  if (!ids || !ids.length) return "";
  const rows = ids.map(id => {
    const m = A.data.monstersById.get(id);
    if (!m) return "";
    return `<div class="tip-mon">${monsterIcon(id)}
      <span>${esc(m.nameEs || m.name)}</span>
      ${m.deviant ? "<em>Mutado</em>" : ""}</div>`;
  }).join("");
  return `<div class="tip-label">${esc(label)}</div><div class="tip-monsters">${rows}</div>`;
}

export function bindTips(root, selector, build) {
  root.addEventListener("pointerover", e => {
    const el = e.target.closest(selector);
    if (!el || !root.contains(el)) { hideTip(); return; }
    const html = build(el);
    if (html) showTip(html, e.clientX, e.clientY); else hideTip();
  });
  root.addEventListener("pointermove", e => {
    if (tip.classList.contains("hidden")) return;
    if (!e.target.closest(selector)) { hideTip(); return; }
    place(e.clientX, e.clientY);
  });
  root.addEventListener("pointerout", e => {
    const el = e.target.closest(selector);
    if (el && !el.contains(e.relatedTarget)) hideTip();
  });
  root.addEventListener("pointerdown", hideTip);
  root.addEventListener("scroll", hideTip, true);
}

export function initTooltip() {
  tip = document.createElement("div");
  tip.id = "tooltip";
  tip.className = "hidden";
  document.body.appendChild(tip);
}