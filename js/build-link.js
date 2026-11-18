import { equipmentSlots, newBuild, equip, equipTalisman, equipWeapon, socket } from './builder-model.js';

// Orden fijo del formato v1: casco, pechera, brazos, cintura, piernas, talismán.
// Solo se transportan elecciones; las estadísticas se recalculan con el catálogo local.
export function buildHash(build) {
  const data = equipmentSlots.map(slot => {
    const {piece: p, jewels} = build[slot];
    if (!p) return null;
    const item = slot === 'weapon' ? [p.slug,p.tree,p.lv] : slot === 'talisman' ? {name: p.name, deco: p.deco, skills: p.sk.map(([en,,pts]) => [en, pts])} : p.sid;
    return [item, jewels.map(j => j.id)];
  });
  const version = build.weapon.piece ? 2 : 1;
  if (version === 1) data.pop();
  const bytes = new TextEncoder().encode(JSON.stringify(data));
  return `#builder=v${version}.` + btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

const check = ok => { if (!ok) throw new Error('Enlace de equipo no válido'); };
export function decodeBuild(hash) {
  check(hash.length <= 4096 && /^#builder=v[12]\.[A-Za-z0-9_-]+$/.test(hash));
  const raw = atob(hash.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'));
  const data = JSON.parse(new TextDecoder('utf-8', {fatal: true}).decode(Uint8Array.from(raw, c => c.charCodeAt(0))));
  check(Array.isArray(data) && data.length === (hash.startsWith('#builder=v2.') ? 7 : 6));
  return data;
}
export function restoreBuild(hash, piecesByKey, decorations, catalog, lookupWeapon) {
  const data = decodeBuild(hash);
  const build = newBuild();
  data.forEach((row, i) => {
    if (row === null) return;
    check(Array.isArray(row) && row.length === 2);
    const [item, ids] = row, slot = equipmentSlots[i];
    if (slot === 'weapon') {
      check(Array.isArray(item) && item.length===3 && typeof item[0]==='string' && item.slice(1).every(Number.isInteger));
      const w=lookupWeapon?.(...item);
      check(w && equipWeapon(build,w));
    } else if (slot === 'talisman') {
      check(typeof item?.name === 'string' && item.name.length <= 60 && Array.isArray(item.skills)
        && item.skills.every(s => Array.isArray(s) && s.length === 2 && typeof s[0] === 'string'));
      check(!equipTalisman(build, item, catalog));
    } else {
      check(Number.isInteger(item) && equip(build, slot, piecesByKey.get(`${slot}:${item}`)));
    }
    check(Array.isArray(ids) && ids.length <= 3);
    for (const id of ids) check(socket(build[slot], decorations.find(j => j.id === id)));
  });
  return build;
}
