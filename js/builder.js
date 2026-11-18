import { A, esc, fetchJSON, slotIcon, eleIcon, classIcon, loadWeaponClass, rarBadge, RANK_ES } from './app.js';
import { slots, equipmentSlots, equipTalisman, equipWeapon, weaponPiece, newBuild, freeSlots, canSocket, socket, unsocket, canEquip, equip, setSkills } from './builder-model.js';
import { renderBuilderSkill, signed } from './skill-guide.js';

import { initTalismanEditor } from './talisman-editor.js';

import { combatStats } from './combat-stats.js';
import { buildHash, decodeBuild, restoreBuild } from './build-link.js';
import { buildPng } from './build-png.js';

const $ = id => document.getElementById(id);
const build = newBuild();
let jewels, charmCatalog, loading, picker, limit, openTalisman, lastHash;
const label = slot => slot === 'weapon' ? 'Arma' : slot === 'talisman' ? 'Talismán' : A.data.piecesMeta.slotEs[slot];
const skillText = sk => sk.map(([en, es, pts]) => `${es || en}${pts ? ' ' + signed(pts) : ''}`).join(' · ');
const normalize = str => str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const costText = n => `${n} ${n === 1 ? 'ranura' : 'ranuras'}`;

// El PNG conserva su relieve; el tinte procede de items.icon_color, no del coste.
const jewelIcon = j => `<span class="b-jewel-icon" aria-hidden="true" style="--jewel-tint:${j?.tint || '#ffffff'}"></span>`;
const bookIcon = '<img class="b-book" src="assets/icons/items/book.png" alt="">';

function weaponReport(w, skills) {
  if (!w) return '';
  const r = combatStats(w,skills);
  return `<h2 class="section-rule">Ficha del arma · Nv. ${w.lv}</h2><section class="b-combat"><h3>${esc(w.name)}</h3>
    <div class="b-metrics"><div><b>${r.raw}</b><small>Ataque físico</small></div><div><b>${r.affinity}</b><small>Afinidad base</small></div><div><b>${r.potential}</b><small>Afinidad potencial</small></div></div>
    <p>Elemento / estado: <strong>${esc(r.attributes.join(' · ') || 'Ninguno')}</strong></p>
    <p>Arma sin habilidades: ${w.raw} de ataque y ${r.nativeAffinity} de afinidad. La base incorpora efectos fijos; el potencial exige cumplir las condiciones.</p>
    ${r.fixed.concat(r.conditions).map(text => `<p>• ${esc(text)}</p>`).join('')}
    <small>Ataque del arma, no daño por golpe. No incluye comida, objetos, artes ni mejoras externas. Los multiplicadores por golpe se indican aparte, sin sumarlos al ataque fijo.</small></section>`;
}
function lookupWeapon(slug, id, lv) {
  const tree=A.data.weapons[slug]?.byId?.get(id), l=tree?.levels.find(x=>x.lv===lv);
  return l && !tree.dummy ? weaponPiece(slug,tree,l) : null;
}
function render() {
  const empty = !equipmentSlots.some(slot => build[slot].piece);
  $('b-share').disabled = $('b-png').disabled = empty;
  $('b-link-field').hidden = true;
  $('b-export-status').textContent = '';
  const pieces = slots.map(slot => build[slot].piece).filter(Boolean);
  $('b-pieces').innerHTML = ['weapon', ...slots, 'talisman'].map((slot, i) => {
    const entry = build[slot], p = entry.piece, free = freeSlots(entry);
    const charm = slot === 'talisman', weapon = slot === 'weapon';
    return `${charm || weapon ? `<h2 class="section-rule">${label(slot)}</h2>` : ''}<article class="b-piece"><div class="b-piece-head">
      <div class="b-emblem">${weapon ? classIcon(p?.slug || 'great_sword',p?.rarity,'sicon') : charm ? '<img class="sicon" src="assets/icons/items/talisman.png" alt="">' : slotIcon(slot, 'sicon', p?.rarity)}</div><div class="b-piece-info"><div class="b-kicker">${weapon ? 'Herrería' : charm ? 'Accesorio' : `0${i}`} / ${label(slot)}</div>
        <h3>${p ? esc(p.nameEs || p.name) : 'Sin equipar'}</h3>
        ${p && weapon ? `<small>${rarBadge(p.rarity)} · Nivel ${p.lv}</small>` : p && charm ? `<small>${esc(skillText(p.sk)) || 'Sin habilidades base'}</small>` : p ? `<small>${rarBadge(p.rarity)} &nbsp; ${p.rank} · Def. ${p.def.join('–')}</small>` : ''}</div>
      <button data-slot="${slot}" data-action="${weapon ? 'weapon' : charm ? 'talisman' : 'piece'}" ${charm && !openTalisman ? 'disabled' : ''}>${weapon ? (p ? 'Cambiar' : '+ Elegir arma') : charm ? (p ? 'Editar' : '+ Añadir talismán') : p ? 'Cambiar' : '+ Elegir pieza'}</button>
      ${p ? `<button data-slot="${slot}" data-action="clear" aria-label="Quitar ${label(slot)}">×</button>` : ''}</div>
      ${p ? `<div class="b-inlay"><div class="b-sockets"><span class="b-socket-track" aria-hidden="true">${'<i class="slot-ico filled"></i>'.repeat(p.deco - free)}${'<i class="slot-ico empty"></i>'.repeat(free)}</span>
        ${p.deco ? `${free} de ${p.deco} libres` : 'Sin ranuras'}
        ${free && jewels ? `<button data-action="jewel" data-slot="${slot}">${jewelIcon()} Añadir joya</button>` : ''}</div>
        ${entry.jewels.map((j, n) => `<button class="b-gem" data-action="remove" data-slot="${slot}" data-index="${n}" aria-label="Quitar ${esc(j.name)} de ${label(slot)}">${jewelIcon(j)} ${esc(j.name)} · ${costText(j.cost)} ×</button>`).join('')}</div>` : ''}
    </article>`;
  }).join('');
  const metrics = [[`${pieces.length}/5`, 'Piezas'], [pieces.reduce((n,p) => n + p.def[0], build.weapon.piece?.defense || 0), 'Defensa base'],
    [equipmentSlots.reduce((n,s) => n + freeSlots(build[s]), 0), 'Ranuras libres']];
  const equipped = equipmentSlots.map(s => build[s].piece).filter(Boolean);
  const skills = setSkills(equipped, Object.fromEntries(equipmentSlots.map(s => [s, build[s].jewels])));
  $('b-summary').innerHTML = `<div class="b-metrics">${metrics.map(([v,k]) => `<div><b>${v}</b><small>${k}</small></div>`).join('')}</div>
    ${pieces.length ? `<div class="b-res">${A.data.piecesMeta.resEs.map((name,i) => `<span>${eleIcon(name)}${signed(pieces.reduce((n,p) => n + p.res[i], 0))}</span>`).join('')}</div>` : ''}
    ${weaponReport(build.weapon.piece,skills)}
    ${equipped.length ? `<h2 class="section-rule">Joyas por pieza</h2><dl class="b-socket-list">${equipmentSlots.filter(s=>build[s].piece).map(s=>`<div><dt>${label(s)}</dt><dd>${esc(build[s].jewels.map(j=>j.name).join(' · ') || (build[s].piece.deco ? 'Sin joyas' : 'Sin ranuras'))}</dd></div>`).join('')}</dl>` : ''}
    <h2 class="section-rule">${bookIcon}Resumen de habilidades</h2>${skills.length ? `<div class="b-guides">${skills.map(renderBuilderSkill).join('')}</div>
      <details class="guide-note b-calculation"><summary>Cómo se calculan los puntos</summary><p>Se suman las piezas, el arma, el talismán y sus joyas. Torso+ copia la pechera; Talismán doble multiplica los puntos del accesorio y sus joyas. Habilidad +2 se aplica después del talismán. No se incluyen bonificaciones externas. Las habilidades de alma requieren el nivel de mejora correspondiente.</p></details>` :
      `<div class="b-empty">${bookIcon}<b>${equipped.length ? 'Sin puntos de habilidad' : 'Tu equipo está por montar'}</b><p>${equipped.length ? 'Añade otra pieza o una joya para sumar puntos.' : 'Elige tu primera pieza. Aquí verás sus puntos, sus efectos y los umbrales pendientes.'}</p></div>`}`;
}

function showOptions() {
  const { slot, type } = picker, isPiece = type === 'piece';
  const q = normalize($('b-search').value.trim());
  if (type === 'weapon') {
    const slug=$('b-weapon-class').value, data=A.data.weapons[slug];
    if (!data) return;
    const rows=data.trees.filter(t=>!t.dummy).flatMap(t=>t.levels.filter(l=>!q || normalize(`${t.name} ${t.nameEs} ${l.n} ${l.nEs}`).includes(q)).map(l=>[t,l]));
    $('b-count').textContent=`${rows.length} niveles · Selecciona el nivel exacto`;
    $('b-options').innerHTML=rows.slice(0,limit).map(([t,l])=>`<button class="b-option" data-tree="${t.id}" data-level="${l.lv}"><span class="b-option-emblem">${classIcon(slug,l.rar,'sicon')}</span><span class="b-option-title"><strong>${esc(l.nEs || l.n)}</strong><small>Nv. ${l.lv} · Ataque ${l.raw}</small></span>${rarBadge(l.rar)}</button>`).join('') || '<p>No hay resultados.</p>';
    if(rows.length>limit) $('b-options').insertAdjacentHTML('beforeend','<button data-more>Mostrar más</button>');
    return;
  }
  const cls = $('b-categories').querySelector('[name="b-class"]:checked').value;
  const rank = $('b-categories').querySelector('[name="b-rank"]:checked').value;
  const options = (isPiece ? A.data.pieces : jewels).filter(o => {
    if (isPiece && (o.rank !== rank || (o.cls !== cls && o.cls !== 'A'))) return false;
    if (isPiece ? !canEquip(build, slot, o) : !canSocket(build[slot], o)) return false;
    return !q || normalize(`${o.name} ${o.nameEs || ''} ${skillText(o.sk)}`).includes(q);
  });
  $('b-count').textContent = `${options.length} ${isPiece ? 'piezas compatibles' : 'joyas compatibles'} · ${isPiece ? `${label(slot)} · ${RANK_ES[rank]}` : costText(freeSlots(build[slot])) + ' libres'}`;
  $('b-options').innerHTML = options.slice(0, limit).map(o => `<button class="b-option" data-id="${isPiece ? o.sid : o.id}">
    <span class="b-option-emblem">${isPiece ? slotIcon(slot, "sicon", o.rarity) : jewelIcon(o)}</span>
    <span class="b-option-title"><strong>${esc(o.nameEs || o.name)}</strong><small>${esc(skillText(o.sk)) || 'Sin habilidades'}</small></span>
    <span>${isPiece ? `${rarBadge(o.rarity)} · ` : ''}${costText(isPiece ? o.deco : o.cost)}</span></button>`).join('')
    + (!options.length ? `<p>${isPiece ? 'No hay piezas compatibles. Prueba otro tipo, rango o búsqueda.' : 'No hay joyas compatibles con esa búsqueda.'}</p>` : '')
    + (options.length > limit ? '<button data-more>Mostrar más</button>' : '');
}

async function loadPickerWeapons() {
  const slug=$('b-weapon-class').value;
  $('b-options').replaceChildren(); $('b-count').textContent='Cargando armas…';
  try { await loadWeaponClass(slug); if(picker.type==='weapon' && slug===$('b-weapon-class').value) showOptions(); }
  catch { if(picker.type==='weapon') $('b-count').textContent='No se pudo cargar la clase. Vuelve a seleccionarla.'; }
}
function openPicker(slot, type) {
  picker = { slot, type }; limit = 60;
  $('b-picker-title').textContent = `${type === 'weapon' ? 'Elegir arma y nivel' : type === 'piece' ? 'Elegir pieza' : 'Engarzar joya'} · ${label(slot)}`;
  $('b-weapon-filter').hidden = type !== 'weapon';
  if (type === 'weapon' && build.weapon.piece) $('b-weapon-class').value=build.weapon.piece.slug;
  $('b-categories').hidden = type !== 'piece';
  if (type === 'piece') {
    const p = build[slot].piece;
    const otherBodyClass = slots.filter(s => s !== slot && s !== 'head')
      .map(s => build[s].piece?.cls).find(c => c && c !== 'A');
    const cls = p && p.cls !== 'A' ? p.cls : slot !== 'head' && otherBodyClass;
    if (cls) $('b-categories').querySelector(`[name="b-class"][value="${cls}"]`).checked = true;
    if (p) $('b-categories').querySelector(`[name="b-rank"][value="${p.rank}"]`).checked = true;
  }
  $('b-search').value = '';
  if(type==='weapon') loadPickerWeapons(); else showOptions(); $('b-picker').showModal();
  $('b-options').scrollTop = 0; $('b-search').focus();
}

async function readSharedLink() {
  const hash = location.hash;
  if (hash === lastHash) return;
  lastHash = hash;
  if (!hash.startsWith('#builder=')) return;
  try {
    const slug=decodeBuild(hash)[6]?.[0]?.[0];
    if (slug) {
      if (!A.data.categories.some(c=>c.slug===slug)) throw new Error('Clase desconocida');
      await loadWeaponClass(slug);
      if (hash!==location.hash) return;
    }
    Object.assign(build, restoreBuild(hash, A.data.piecesByKey, jewels, charmCatalog, lookupWeapon));
    render();
    $('b-export-status').textContent = 'Equipo compartido cargado. Puedes editar tu copia.';
  } catch {
    $('b-export-status').textContent = 'No se pudo abrir ese enlace: está incompleto o no es compatible. El equipo no se ha modificado.';
  }
}

async function openBuilder() {
  if (jewels) return readSharedLink();
  if (loading) return;
  loading = true;
  $('b-status').textContent = 'Abriendo el taller…';
  try {
    const [decorations, catalog] = await Promise.all(['decorations', 'talisman-skills'].map(name => fetchJSON(`data/armor/${name}.json`)));
    openTalisman = initTalismanEditor(build, catalog, () => {
      render(); $('b-pieces').querySelector('[data-action="talisman"]').focus();
    });
    jewels = decorations; charmCatalog = catalog;
    $('b-status').textContent = ''; render(); readSharedLink();
  } catch {
    render();
    $('b-status').innerHTML = 'No se pudieron cargar los catálogos de joyas y talismanes. <button id="b-retry">Reintentar</button>';
    $('b-retry').onclick = openBuilder;
  } finally { loading = false; }
}

export function init() {
  A.hooks.openBuilder = openBuilder;
  $('b-weapon-class').innerHTML=A.data.categories.map(c=>`<option value="${c.slug}">${esc(c.labelEs)}</option>`).join('');
  $('b-weapon-class').onchange=()=>{limit=60;loadPickerWeapons();};
  $('b-share').onclick = async () => {
    const url = new URL(location.href);
    url.hash = buildHash(build);
    $('b-link-field').hidden = false;
    $('b-share-url').value = url.href;
    try {
      await navigator.clipboard.writeText(url.href);
      $('b-export-status').textContent = 'Enlace copiado. Incluye el arma, la armadura, el talismán y sus joyas.';
    } catch {
      $('b-share-url').focus(); $('b-share-url').select();
      $('b-export-status').textContent = 'Copia el enlace seleccionado para compartir tu equipo.';
    }
  };
  // El iframe o el navegador móvil pueden bloquear descargas programáticas.
  // Mantener la imagen y un enlace real hasta cerrar, incluso si a.click() no descarga.
  const imageDialog = $('b-image-dialog'), save = $('b-image-save'), preview = $('b-image-preview');
  let imageUrl;
  $('b-image-close').onclick = () => imageDialog.close();
  imageDialog.addEventListener('close', () => {
    preview.removeAttribute('src'); save.removeAttribute('href');
    if (imageUrl) URL.revokeObjectURL(imageUrl);
    imageUrl = null;
  });
  $('b-png').onclick = async () => {
    $('b-png').disabled = true;
    $('b-export-status').textContent = 'Preparando la imagen…';
    try {
      imageUrl = URL.createObjectURL(await buildPng(build));
      save.href = preview.src = imageUrl;
      imageDialog.showModal();
      $('b-export-status').textContent = 'Imagen preparada.';
      save.click();
    } catch {
      $('b-export-status').textContent = 'No se pudo generar la imagen. Inténtalo de nuevo.';
    } finally {
      $('b-png').disabled = !equipmentSlots.some(slot => build[slot].piece);
    }
  };
  $('b-pieces').addEventListener('click', e => {
    const b = e.target.closest('button[data-slot]'); if (!b) return;
    const { action, slot, index } = b.dataset;
    if (action === 'talisman') return openTalisman();
    if (['piece','weapon','jewel'].includes(action)) return openPicker(slot, action);
    if (action === 'clear') {
      if (slot === 'talisman') equipTalisman(build, null);
      else if(slot==='weapon') equipWeapon(build,null);
      else equip(build, slot, null);
    }
    if (action === 'remove') unsocket(build[slot], Number(index));
    render();
    $('b-pieces').querySelector(`[data-slot="${slot}"]`).focus();
  });
  const refilter = () => { limit = 60; showOptions(); $('b-options').scrollTop = 0; };
  $('b-search').addEventListener('input', refilter);
  $('b-categories').addEventListener('change', refilter);
  $('b-close').onclick = () => $('b-picker').close();
  $('b-options').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.hasAttribute('data-more')) { limit += 60; showOptions(); return; }
    const { slot, type } = picker;
    const ok = type === 'weapon' ? equipWeapon(build,lookupWeapon($('b-weapon-class').value,+b.dataset.tree,+b.dataset.level)) : type === 'piece' ? equip(build, slot, A.data.piecesByKey.get(`${slot}:${b.dataset.id}`))
      : socket(build[slot], jewels.find(j => j.id === Number(b.dataset.id)));
    if (!ok) { showOptions(); if(type==='weapon') $('b-count').textContent='Arma incompatible con la armadura equipada. Cambia las piezas de clase exclusiva.'; return; }
    $('b-picker').close(); render();
    const list = $('b-pieces');
    (list.querySelector(`[data-slot="${slot}"][data-action="${type}"]`) ||
      list.querySelector(`[data-slot="${slot}"]`)).focus();
  });
}
