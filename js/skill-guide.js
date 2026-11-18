import { A, esc } from "./app.js";

export const signed = n => n > 0 ? `+${n}` : String(n);
const torsoDescription = 'Cada pieza con Torso+ copia los puntos de habilidad de la pechera. El total ya incluye esas copias.';

function currentLevel(levels, total) {
  return levels.filter(({ points }) => points > 0 ? total >= points : total <= points)
    .reduce((best, row) => !best || Math.abs(row.points) > Math.abs(best.points) ? row : best, null);
}

function tiers(levels, total, current) {
  return levels.map(row => {
    const active = row === current;
    const missing = row.points - total;
    const status = active ? 'Nivel alcanzado' : row.points > 0 && missing > 0
      ? `Falta${missing === 1 ? '' : 'n'} ${missing} ${missing === 1 ? 'punto' : 'puntos'}` : '';
    return `<div class="guide-tier${active ? ' reached' : ''}">
      <span class="guide-points${row.points < 0 ? ' neg' : ''}">${signed(row.points)}</span>
      <div><strong>${esc(row.name)}</strong>${status ? `<small>${status}</small>` : ''}
        <p>${esc(row.description)}</p></div>
    </div>`;
  }).join('');
}

// La colección sigue siendo una referencia completa de todos los niveles.
export function renderSkillGuide({ en, label, total }) {
  const torso = en === 'Torso Up';
  const levels = A.data.skillLevels[en] || [];
  return `<article class="skill-guide-card">
    <header><h3>${esc(label)}</h3><span>${torso ? 'Sin umbral' : `${signed(total)} pts`}</span></header>
    ${torso ? `<p>${torsoDescription}</p>` : tiers(levels, total, currentLevel(levels, total)) || '<p>Sin niveles documentados.</p>'}
  </article>`;
}

// En el taller interesa el estado actual, no los efectos del signo opuesto.
export function builderSkillState({ en, total }) {
  const torso = en === 'Torso Up';
  const levels = (A.data.skillLevels[en] || []).filter(l => Math.sign(l.points) === Math.sign(total));
  const active = currentLevel(levels, total);
  const first = levels.reduce((best, l) => !best || Math.abs(l.points) < Math.abs(best.points) ? l : best, null);
  const status = torso ? 'Efecto por pieza' : active ? `${total < 0 ? 'Penalización' : 'Activa'}: ${active.name}`
    : !total ? 'Sin efecto' : first ? `Sin activar · umbral ${signed(first.points)}`
    : `Sin efecto ${total < 0 ? 'negativo' : 'positivo'}`;
  return { torso, levels, active, status };
}

export function renderBuilderSkill(skill) {
  const { label, total } = skill;
  const { torso, levels, active, status } = builderSkillState(skill);
  const heading = `<strong>${esc(label)}</strong><b>${torso ? 'Especial' : `${signed(total)} pts`}</b><small>${esc(status)}</small>`;
  const state = active || torso ? (total < 0 ? ' penalty' : ' active') : '';
  return levels.length || torso ? `<details class="skill-guide-card b-skill${state}">
    <summary>${heading}</summary>${torso ? `<p>${torsoDescription}</p>` : tiers(levels, total, active)}</details>`
    : `<div class="skill-guide-card b-skill"><div class="b-inert">${heading}</div></div>`;
}
