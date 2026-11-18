/* Estado independiente de la interfaz. Las ranuras nunca se comparten. */
export const slots = ['head', 'chest', 'arms', 'waist', 'legs'];
export const equipmentSlots = [...slots, 'talisman', 'weapon'];
export const newBuild = () => Object.fromEntries(equipmentSlots.map(slot => [slot, { piece: null, jewels: [] }]));
export const freeSlots = entry => (entry.piece?.deco ?? 0) - entry.jewels.reduce((n, j) => n + j.cost, 0);
export const canSocket = (entry, jewel) => !!entry?.piece && Number.isInteger(jewel?.cost)
  && jewel.cost >= 1 && jewel.cost <= 3 && jewel.cost <= freeSlots(entry);
export function socket(entry, jewel) {
  if (!canSocket(entry, jewel)) return false;
  entry.jewels.push(jewel);
  return true;
}

export function unsocket(entry, index) {
  if (!Number.isInteger(index) || index < 0 || index >= entry.jewels.length) return false;
  entry.jewels.splice(index, 1);
  return true;
}

export function canEquip(build, slot, piece) {
  if (!slots.includes(slot) || piece?.slot !== slot) return false;
  if (slot !== 'head' && piece.cls !== 'A' && build.weapon.piece && build.weapon.piece.cls !== piece.cls) return false;
  return slots.every(other => {
    const p = build[other].piece;
    if (!p || other === slot) return true;
    // Ambos tipos de cazador pueden llevar cascos de espadachín o de artillero.
    return (p.gender === 2 || piece.gender === 2 || p.gender === piece.gender)
      && (slot === 'head' || other === 'head' || p.cls === 'A' || piece.cls === 'A' || p.cls === piece.cls);
  });
}
export function weaponPiece(slug, tree, l) {
  return {slot:'weapon', slug, tree:tree.id, lv:l.lv, name:l.nEs || l.n, rarity:l.rar, raw:l.raw,
    aff:l.aff, ele:l.ele || [], defense:l.def, deco:[...l.slots].filter(c=>c==='◯').length, sk:[],
    cls:['bow','light_bowgun','heavy_bowgun'].includes(slug)?'G':'B'};
}
export function equipWeapon(build, w) {
  if (w && slots.some(s => s !== 'head' && build[s].piece && !['A',w.cls].includes(build[s].piece.cls))) return false;
  const old=build.weapon.piece;
  if (!old || !w || old.slug!==w.slug || old.tree!==w.tree || old.lv!==w.lv) build.weapon={piece:w,jewels:[]};
  return true;
}
export function equip(build, slot, piece) {
  if (!slots.includes(slot) || (piece !== null && !canEquip(build, slot, piece))) return false;
  if (piece !== build[slot].piece) build[slot] = { piece, jewels: [] };
  return true;
}

// Una edición conserva las joyas. Para reducir la capacidad, hay que retirar
// primero las que ya no cabrían. Quitar el talismán sí vacía todo ese puesto.
export function equipTalisman(build, draft, catalog) {
  const entry = build.talisman;
  if (!draft) { build.talisman = {piece: null, jewels: []}; return ''; }
  const {name, deco, skills} = draft;
  if (!Number.isInteger(deco) || deco < 0 || deco > 3) return 'Selecciona entre 0 y 3 ranuras.';
  if (deco < entry.jewels.reduce((n, j) => n + j.cost, 0)) return 'Retira primero las joyas que no caben en el nuevo número de ranuras.';
  if (!Array.isArray(skills) || skills.length > 2 || (!skills.length && !deco)) return 'Añade una habilidad o al menos una ranura.';
  const sk = [];
  for (const [i, [en, pts]] of skills.entries()) {
    if (sk.some(row => row[0] === en)) return 'Las dos habilidades deben ser distintas.';
    const row = catalog.find(r => r.en === en);
    if (!row?.points[i].includes(pts)) return 'Revisa los puntos de cada habilidad.';
    sk.push([en, row.es, pts]);
  }
  entry.piece = {slot: 'talisman', name: name.trim() || 'Mi talismán', deco, sk};
  return '';
}

export function setSkills(pieces, jewelsBySlot = null) {
  const skills = new Map();
  const copies = pieces.filter(p => p.sk.some(([en]) => en === 'Torso Up')).length;
  function add(p, multiplier) {
    const rows = [...p.sk, ...(jewelsBySlot?.[p.slot] || []).flatMap(j => j.sk)];
    for (const [en, es, pts] of rows) {
      if (!skills.has(en)) skills.set(en, { en, label: es || en, total: 0 });
      skills.get(en).total += pts * multiplier;
    }
  }
  for (const p of pieces) if (p.slot !== 'talisman') add(p, p.slot === 'chest' ? 1 + copies : 1);
  const talisman = pieces.find(p => p.slot === 'talisman');
  // La colección muestra puntos base; en el builder calcular también Habilidad +2.
  const extra = jewelsBySlot && skills.get('Secret Arts')?.total >= 10 ? 2 : 0;
  if (talisman) add(talisman, (skills.get('Talisman Boost')?.total || 0) + extra >= 10 ? 2 : 1);
  if (extra) for (const row of skills.values()) if (row.total !== 0) row.total += extra;
  return [...skills.values()].sort((a, b) => b.total - a.total);
}
