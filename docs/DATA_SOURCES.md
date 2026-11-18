# DATA_SOURCES.md — MHGU ARMORY

Enciclopedia visual local de armas y armaduras de Monster Hunter Generations
Ultimate. Este documento registra la procedencia de todos los datos incluidos
en `data/` y las condiciones de uso de cada fuente. Investigación completa de
repositorios (commits, licencias, pipelines) en `../DATA_SOURCES.md` (HITO 1).

## Fuentes utilizadas y papel de cada una

### 1. Tablas del juego del usuario (fuente autoritativa, solo lectura)

`C:\GU\Windows-MHGURecomp\data\romfs\nativeNX\` (MHGU 1.4.0, dump propio del
usuario para MHGURecomp):

- `table/armorSeriesData.asd` (1,287 × 127 B) + `table/armorBuildData.abd`:
  stats de armadura, género, tipo B/G, resistencias, ranuras, habilidades.
  Verificación independiente de las 5,637 piezas (0 discrepancias).
- `table/armorProcessA00.apd` (5,162 × 38 B) y `table/armorCreateA0{0..4}.acrd`
  (n × 42 B): categorías de puntos de material y materiales de receta por
  serie. Único uso: **vínculo conjunto–monstruo** (§2.7 del informe); las
  recetas como tal no se publican (fuera de alcance).
- `table/weaponProcessW<NN>.wpd` (32 B por registro y nivel; @0 u16 árbol,
  @2 u16 nivel, @16 u16 categoría de puntos de material, @18 u16 cantidad):
  **vínculo arma–monstruo** (§1.7 del informe). Mapa de clases verificado por
  conteo de registros: GS=00, SnS=01, Martillo=02, Lanza=03, HBG=04, LBG=06,
  LS=07, SA=08, GL=09, Arco=10, DB=11, HH=12, IG=13, CB=14 (no existe 05).
  Las recetas como tal no se publican (fuera de alcance).
- `table/weapon<NN>BaseData.wNNd` (33–34 B por árbol; @9 nivel del primer
  renombre, @11 rareza−1, últimos 10 B = 5 pares `[u8 nivel, u8 árbol hijo]` =
  bifurcaciones con nivel de desbloqueo) y `table/weapon<NN>LevelData.wNNd`
  (@4 árbol, @5 nivel; ranuras en el último byte en cuerpo a cuerpo, +10 en
  ballestas, +12 en arco): **verificación de completitud y linaje** de los
  1,592 árboles / 10,911 niveles (§1.8 del informe), incluidas las armas sin
  monstruo. El registro 0 de cada clase es un placeholder vacío «(Ninguna)».
- `spa/table/weapon<NN>MsgData_spa.gmd`: 6 cadenas por árbol (nombre base,
  descripción, nombre final, descripción, nombre definitivo, descripción);
  contraste de nombres ES por árbol en la verificación de linaje.
- `spa/table/armorSeriesData_spa.gmd`: **nombres oficiales en español** de las
  piezas (100 % de cobertura).
- `eng/table/skillTypeData_eng.gmd` + `spa/table/skillTypeData_spa.gmd`:
  contraste por índice para el nombre ES oficial de la habilidad Load Up
  («Recargando», índice 134 en ambas).
- `spa/table/HN_WeaponControlsMsg_spa.gmd` + `eng/table/HN_WeaponControlsMsg_eng.gmd`:
  terminología ES **oficial** del arco por índice alineado. Índice 6704 (tipos
  de flecha): Rapid→**Salva**, Pierce→**Perforante**, Spread→**Abanico**,
  Heavy→**Pesada**. Índice 6714 (tiro de arco / carga potente): Focus→**Foco**,
  Wide→**Amplio**, Blast→**Ráfaga**. Usada en los filtros de arco, el panel de
  detalles y el tooltip de nodo (`ARC_ES`/`SHOT_ES` en `js/app.js`).
- Formato de tabla: f32 versión + u32 count + registros de ancho fijo; GMD:
  cabecera `GMD\0` + tabla de offsets + blob UTF-8 separado por NUL. Layouts de
  armadura documentados en el script MIT del tracker (fuente 2); layouts de
  arma derivados de la documentación de Scrimas (fuente 4, solo hechos) y
  comprobados al 100 % contra los datos publicados por
  `tools/verify_weapon_lineage.py`. No se copió código GPL.

**No se redistribuye ningún archivo del juego.** Solo se publican los datos
numéricos y los nombres (hechos), en `data/armor/`. Los archivos originales
permanecen en la instalación del usuario.

### 2. ArmoredRaven17/mhgu-collection-tracker (MIT el código)

Clon de análisis en `../research/mhgu-collection-tracker/` (commit `53a5ff0`).

- `docs/data/catalog.js`: catálogo de 1,592 árboles de arma y 5,637 piezas.
- `docs/data/stats/<clase>.json`: 10,911 niveles con stats por clase
  (afilado, viales, bombardeo, notas, munición, cargas, revestimientos…).
- `docs/data/stats/armor_<slot>.json`: stats de armadura extraídos de tablas
  del juego por `scripts/build-armor-data.mjs` (MIT).
- `docs/data/materials/<clase>.json`: campo `parents` (linaje de bifurcaciones
  con nivel de desbloqueo). **Las recetas/materiales NO se incluyen** en
  ARMORY (fuera de alcance por definición del proyecto).
- `docs/data/hh_songs.json`: melodías de cornamusa.
- `docs/assets/icons/icon_<clase>[_r1.._r10|_rX].png` e
  `icon_armor_<slot>[_rN].png`: **iconos extraídos del juego** (silueta de cada
  clase de arma teñida por rareza, y piezas de armadura por ranura). Copiados a
  `assets/weapons/classes/<clase>[_rN|_rX].png` (168 archivos) y
  `assets/armor/slots/<slot>.png` (5; `chest` ← `icon_armor_body`). El sufijo de
  rareza sigue la regla del propio tracker (`r >= 11 → _rX`).

Procedencia interna (su `NOTICE.md`): stats/nombres de arma ← Kiranico MHGU
(sin licencia formal, atribución por cortesía); stats de armadura ← tablas del
juego; materiales ← mhgu.db. El pipeline de armas lee un repo privado
(`mhgu-editor`), por lo que se partió de los JSON committeados.

### 3. JoeLago/MHGUDB-iOS — `mhgu.db` (MIT, © 2014 DavianCorp)

Clon en `../research/MHGUDB-iOS/` (commit `a91a02b`, 2018-12-09), basado en
gatheringhallstudios/MHGenDatabase. Usado para:

- `items.name_es` / `name_ja`: nombres ES/JA de armas (10,877 niveles, 99.7 %).
- `weapons.parent_id`: verificación de linaje nivel a nivel (0 errores).
- `armor_families`: los 1,242 conjuntos y sus piezas.
- `skill_trees.name_es`: nombres ES de habilidades (100 %).
- `skills` + `skill_trees`: umbrales de puntos, nombres y descripciones ES de cada nivel para las habilidades de armadura. Regenerar `data/armor/skill-levels.json` con `python tools/build_skill_levels.py ruta/a/mhgu.db`. Torso+ copia los puntos de la pechera y no tiene umbral numérico.
- `armor.gender` / `hunter_type`: contraste de género (coincide con el juego
  en el 100 % de las piezas).
- `monsters` (129): lista de monstruos del buscador y del filtro «Monstruo»
  (`data/armor/monsters.json`), con `name_es` y `class` ('2' = desviante).
- `items` con `_id` en `(30<<16)|N`: nombres de las categorías de puntos de
  material («HR Teostra Materials»), puente del vínculo conjunto–monstruo y
  arma–monstruo.
- `MHGUDB/Assets/icons_monster_info/{Fire,Water,Thunder,Ice,Dragon,Poison,
  Paralysis,Sleep,Blastblight}.png`: **iconos de elemento/estado extraídos del
  juego**, copiados a `assets/icons/elements/{fire,water,thunder,ice,dragon,
  poison,paralysis,sleep,blast}.png` (9 archivos).

### 4. Scrimas/MHGU-Save-editor (GPL-3.0) — solo contraste, sin código

Clon en `../research/MHGU-Save-editor/` (commit `bf55b7f`). Su
`data/weapon-tree.csv` (798 aristas extraídas de `weaponNNBaseData` del RomFS)
se usó como **contraste independiente**: las 798 bifurcaciones de ARMORY
coinciden arista a arista (hijo, padre, nivel de desbloqueo). No se copió ni
enlazó código GPL; solo se compararon hechos (datos fácticos).

### 5. Kiranico MHGU (mhgu.kiranico.com) — contraste indirecto

No se scrapeó durante este proyecto ni se depende de él en ejecución. Sus
datos llegan a través de los JSON del tracker (fuente 2). Atribución por
cortesía; sin licencia formal declarada.

### 6. ArmoredRaven17/mhgu-weapon-trees (MIT) — referencia técnica

Clon en `../research/mhgu-weapon-trees/`. Referencia de representación de
árboles (nodos, bifurcaciones, zoom/pan). No se copiaron sus datos ni sus
iconos extraídos del juego.

### 7. Monster Hunter Wiki (Fandom) — iconos de monstruo

`monsterhunter.fandom.com`, ficheros `File:MHGU-<Name> Icon.png` (iconos de
monstruo extraídos del juego y publicados por la wiki). URLs resueltas con la
API pública (`api.php?action=query&prop=imageinfo`) y descargadas con curl
(User-Agent de navegador + Referer de la wiki; el servidor entrega WebP).
Copiados a `assets/monsters/<id>.webp` con el id de `monsters` de mhgu.db:
**125 de 129** monstruos. Sin icono: Fatalis (13), Alatreon (50), Crimson
Fatalis (269), Old Fatalis (525) — la interfaz omite el icono en esos casos
(`onerror`), nunca muestra un roto. Manifiesto de ids con icono:
`tools/out/monster_icons.json`. Uso local personal con atribución a la wiki y a
Capcom; no hay publicación ni redistribución del proyecto.

## Datos derivados (reglas documentadas)

- **Rango de armadura**: rareza 1–3 = LR, 4–7 = HR, 8–11 = G (evidencia: sets
  S/X y desviantes; ver DATA_VALIDATION_REPORT.md §2.5).
- **Nombre ES de conjunto**: secuencia común de tokens de los nombres ES
  oficiales de sus piezas; marcado DERIVED (1,197) o MISSING (45).
- **Género**: bits del juego (autoritativo); 58 errores del catálogo Kiranico
  corregidos y registrados en `tools/out/armor_build_report.json`.
- **Traducciones de elementos/estados**: terminología estándar ES de la saga
  (Fuego, Agua, Rayo, Hielo, Dragón, Veneno, Parálisis, Sueño, Explosión).
- **Vínculo conjunto–monstruo**: categorías de puntos de material del juego
  (apd/acrd) casadas con `monsters` de mhgu.db; fallback por nombres de
  material y herencia por variante/pareja de género. Reglas, alias y cobertura
  (1,178/1,242) en DATA_VALIDATION_REPORT.md §2.7.
- **Vínculo arma–monstruo**: unión por árbol de las categorías de puntos de
  material de `weaponProcessW<NN>.wpd` (todos los niveles); fallback por
  nombres de material del tracker **solo si el árbol no tiene ninguna
  categoría** (evita sobre-etiquetar, p. ej. un arma de Rathalos Plateado que
  usa «Rathalos Mantle»). Cobertura 1,479/1,592 y método completo en
  DATA_VALIDATION_REPORT.md §1.7. Se muestra en tooltips y en la ficha de arma.
- **Cargas de arco «!»**: la fuente marca con «!» la carga exclusiva de la
  habilidad Load Up; se muestra como etiqueta «Recargando» (nombre ES oficial
  verificado por índice en las GMD del juego).

## Licencias y redistribución

| Recurso | Licencia | Uso en ARMORY |
|---|---|---|
| Código tracker / weapon-trees | MIT | Referencia; datos JSON reutilizados con atribución |
| mhgu.db | MIT | Nombres, linaje, conjuntos, habilidades (atribución) |
| Scrimas / Cotto | GPL-3.0 | Solo hechos como contraste; **sin código** |
| Kiranico | sin licencia formal | Atribución por cortesía (vía tracker) |
| Tablas/GMD del juego | © Capcom | **No redistribuidas**; solo hechos numéricos y nombres |
| Iconos de arma/armadura/elemento (tracker MIT, MHGUDB-iOS MIT) | assets extraídos del juego, © Capcom | Copia local personal con atribución; sin publicación |
| Iconos de monstruo (Fandom) | © Capcom / wiki CC BY-SA | Copia local personal con atribución; sin publicación |

La interfaz combina iconografía SVG propia (glifos estructurales: yunque,
lupa, chevrons…) con los iconos del juego listados arriba, usados en copia
local personal. **El proyecto no se publica ni redistribuye**: si llegara a
publicarse, deben retirarse los assets derivados de Capcom o sustituirse por
iconografía propia, y respetar CC BY-SA en los de la wiki.

## Reproducción

```bash
python -X utf8 tools/build_weapons.py   # requiere research/ (clones) + mhgu.db
python -X utf8 tools/build_armor.py     # requiere además las tablas del juego en C:/GU/...
python -X utf8 tools/build_search_index.py  # índice del buscador global
python -X utf8 tools/verify_weapon_lineage.py  # re-verifica linaje/completitud vs tablas del juego
```

Salidas: `data/weapons/*.json`, `data/weapon-categories.json`,
`data/armor/{pieces,sets,unreleased,monsters}.json`, `data/search-index.json`,
informes en `tools/out/`.

Los iconos (`assets/weapons/classes/`, `assets/armor/slots/`,
`assets/icons/elements/`, `assets/monsters/`) ya están copiados en el proyecto;
su procedencia y renombrado quedan documentados en §2, §3 y §7. No se requiere
red para ejecutar la aplicación: todo se sirve en local.