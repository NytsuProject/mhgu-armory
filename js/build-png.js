import { A, RANK_ES } from './app.js';
import { equipmentSlots, freeSlots, setSkills } from './builder-model.js';
import { combatStats } from './combat-stats.js';
import { signed, builderSkillState } from './skill-guide.js';

// Ficha independiente del tamaño de pantalla, el scroll y los desplegables.
export async function buildPng(build) {
  const canvas = document.createElement('canvas');
  const W = 960, ctx = canvas.getContext('2d');
  const ops = []; let y = 0;
  const rect = (x, top, w, h, color) => ops.push(() => { ctx.fillStyle = color; ctx.fillRect(x, top, w, h); });
  function line(value, x, size, bold = false, color = '#392a1c', width = W - x - 40) {
    const font = `${bold ? 'bold ' : ''}${size}px sans-serif`;
    ctx.font = font;
    // Los nombres personalizados pueden ser largos, incluso sin espacios.
    let text = '';
    function commit() {
      const str = text.trimEnd(), baseline = y + size;
      ops.push(() => { ctx.font = font; ctx.fillStyle = color; ctx.fillText(str, x, baseline); });
      y += size + 7; text = '';
    }
    for (const word of String(value).split(/\s+/)) {
      if (text && ctx.measureText(text + word).width > width) commit();
      for (const ch of word) {
        if (ctx.measureText(text + ch).width > width) commit();
        text += ch;
      }
      text += ' ';
    }
    commit();
  }
  function band(title) {
    y += 14; rect(24, y, W - 48, 38, '#684929'); y += 5;
    line(title, 40, 21, true, '#fff3d2'); y += 14;
  }
  const images = new Map();
  function icon(path, top) {
    if (!images.has(path)) {
      const img = new Image(); img.crossOrigin = 'anonymous'; images.set(path, img); img.src = path;
    }
    ops.push(() => { const img = images.get(path); if (img.naturalWidth) ctx.drawImage(img, 43, top + 4, 42, 42); });
  }
  rect(0, 0, W, 100, '#372819'); y = 16;
  line('MHGU ARMORY   /   TALLER MANUAL', 40, 16, true, '#f1cc7d');
  line('Ficha de equipo', 40, 39, true, '#fff4dc'); y = 109;
  const entries = equipmentSlots.map(s => build[s]);
  const pieces = entries.map(e => e.piece).filter(Boolean);
  const armor = pieces.filter(p => !['weapon','talisman'].includes(p.slot));
  const w = build.weapon.piece;
  line(`${armor.length}/5 piezas   ·   Defensa base ${armor.reduce((n,p) => n+p.def[0],w?.defense || 0)}   ·   Ranuras libres ${entries.reduce((n,e) => n+freeSlots(e),0)}`, 40, 19, true);
  line(A.data.piecesMeta.resEs.map((name,i) => `${name} ${signed(armor.reduce((n,p) => n+p.res[i],0))}`).join('   ·   '), 40, 17);
  const pointList = sk => sk.map(([en,es,n]) => `${es || en}${en === 'Torso Up' ? '' : ' '+signed(n)}`).join(' · ');
  band('01   /   Equipo y engarces');
  for (const slot of equipmentSlots) {
    const entry = build[slot], p = entry.piece, charm = slot === 'talisman', weapon = slot === 'weapon';
    y += 5; const top = y;
    rect(36, top, 55, 53, '#4c3927');
    const suffix = p ? (p.rarity >= 11 ? '_rX' : `_r${p.rarity}`) : '';
    icon(weapon ? `assets/weapons/classes/${p?.slug || 'great_sword'}${suffix}.png` : charm ? 'assets/icons/items/talisman.png' : `assets/armor/slots/${slot}${suffix}.png`, top);
    line(weapon ? 'ARMA' : charm ? 'TALISMÁN' : A.data.piecesMeta.slotEs[slot].toUpperCase(), 104, 15, true, '#70512f');
    line(p ? p.nameEs || p.name : 'Sin equipar', 104, 23, true);
    if (p) {
      const info = weapon ? `Nivel ${p.lv} · R${p.rarity}` : charm ? (pointList(p.sk) || 'Sin habilidades base')
        : `R${p.rarity} · ${RANK_ES[p.rank]} · ${ {B:'Espadachín',G:'Artillero',A:'Ambas clases'}[p.cls] } · Def. ${p.def.join('–')}`;
      line(`${info}   |   Ranuras: ${freeSlots(entry)} libres de ${p.deco}`, 104, 17);
      if (!charm && p.sk.length) line(`Pieza: ${pointList(p.sk)}`, 104, 16);
      if (!entry.jewels.length) line(`Joyas: ${p.deco ? 'ninguna equipada' : 'sin ranuras'}`, 104, 17);
      for (const j of entry.jewels) line(`Joya: ${j.name}  (${j.cost} ${j.cost === 1 ? 'ranura' : 'ranuras'})  ·  ${pointList(j.sk)}`, 116, 18);
    }
    y += 8; rect(36, y, W-72, 1, '#c3ae85'); y += 5;
  }
  const skills = setSkills(pieces, Object.fromEntries(equipmentSlots.map(s => [s,build[s].jewels])));
  if (w) {
    const r=combatStats(w,skills);
    band('02   /   Ficha del arma');
    line(`${w.name} · Nivel ${w.lv}`,40,21,true);
    line(`Ataque físico ${r.raw} (arma: ${w.raw})   ·   Afinidad base ${r.affinity}   ·   Potencial ${r.potential}`,40,18,true);
    line(`Elemento / estado: ${r.attributes.join(' · ') || 'Ninguno'}`,40,18);
    for (const text of [...r.fixed,...r.conditions]) line(text,40,17);
  }
  band(`${w ? '03' : '02'}   /   Habilidades resultantes`);
  if (!skills.length) line('Sin puntos de habilidad.', 40, 19);
  for (const skill of skills) {
    const {torso,active,status} = builderSkillState(skill);
    line(`${skill.label}${torso ? '' : '  '+signed(skill.total)+' pts'}   ·   ${status}`, 40, 19, !!active, active ? (skill.total < 0 ? '#8d3026' : '#305733') : '#392a1c');
  }
  y += 18;
  canvas.width = W; canvas.height = y;
  ctx.fillStyle = '#f4e6c3'; ctx.fillRect(0,0,W,y);
  await Promise.all([...images.values()].map(img => img.decode().catch(() => {})));
  ops.forEach(draw => draw());
  return new Promise((resolve,reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('PNG no disponible')), 'image/png'));
}
