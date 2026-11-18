# MHGU ARMORY

Enciclopedia visual local de **Monster Hunter Generations Ultimate**: los 14
árboles de mejora de armas de cazador y toda la armadura (rangos bajo, alto y
G, deviantes, variantes Espadachín/Artillero y de género). Aplicación web
estática: HTML5 + CSS3 + JS moderno (módulos ES) + SVG + JSON. Sin backend, sin
APIs externas en ejecución, sin lectura de guardados ni del juego.

## Ejecutar

Cualquier servidor estático sirve. Por ejemplo, desde esta carpeta:

```bash
python -m http.server 8765 --bind 127.0.0.1
```

y abrir <http://127.0.0.1:8765/>. No funciona con `file://` (los módulos ES y
`fetch` de JSON requieren HTTP). Navegador moderno (Chrome/Edge/Firefox).

## Qué hay dentro

- **Portada** con acceso a las dos salas: Weapon Forge y Armor Collection.
- **Weapon Forge**: 1,592 árboles / 10,911 niveles de arma en una rejilla SVG
  calcada de la herrería del juego: una fila por línea de mejora (placa de
  nombre a la izquierda, verde = forja directa / roja = bifurcación) y una
  casilla cuadrada por nivel (icono de rareza, número de nivel y badge de
  elemento). Rueda = zoom al cursor, arrastrar = pan, clic en casilla =
  seleccionar ese nivel, doble clic = contraer/expandir rama, botones de zoom,
  «Centrar» y «Expandir todo». Las bifurcaciones muestran su nivel de
  desbloqueo y permanecen disponibles (atenuadas/bloqueadas según el nivel
  activo). La línea seleccionada se marca con placa dorada, banda dorada y
  anillo azul en la casilla. Panel derecho inmediato: nombre ES/EN, rareza,
  rango, ataque, afinidad, defensa, ranuras, afilado (3 bandas × 7 colores),
  elemento y despertar, y los extras de cada clase (melodías de cornamusa con
  notas, bombardeo de lanza pistola, viales de hacha espada/cargada, kinsecto
  del glaive, cargas/revestimientos/tiro de arco, munición/recarga/retroceso/
  desviación/disparo rápido/agachado/interna de ballestas) y línea de
  evolución navegable. Filtros: nombre, rareza, elemento, afinidad y, en la
  clase **Arco**, tiro de arco (Foco / Amplio / Ráfaga) y tipo de flecha
  (Salva / Perforante / Abanico / Pesada), con una casilla para incluir las
  cargas que solo otorga la habilidad **Recargando** (Load Up). El tooltip de
  cada nodo de arco muestra su tiro de arco y sus flechas innatas.
- **Armor Collection**: 1,242 conjuntos / 5,637 piezas. Selector de tres
  paneles: lista de conjuntos con filtros (nombre, rango, rareza, tipo,
  género, monstruo, habilidad), cinco piezas del conjunto con sus ausencias
  legítimas marcadas, resumen (defensa total, resistencias, ranuras, puntos
  de habilidad acumulados) y detalle de pieza (curva de defensa, resistencias,
  ranuras, habilidades ES/EN con puntos). **No es un constructor de builds**:
  solo consulta.
- **Buscador global** (barra superior): armas, conjuntos, piezas y monstruos,
  con navegación por teclado (↑/↓/Enter/Esc). Un resultado de monstruo abre
  Armor Collection filtrado por ese monstruo.

Los datos ausentes se marcan (VERIFIED / DERIVED / MISSING / DUMMY); no se
inventan armas, conexiones ni traducciones. Ver `DATA_VALIDATION_REPORT.md`.

## Estructura

```
index.html            portada + las dos vistas
css/                  main, weapons, armor, animations
js/                   app (núcleo/estado), navigation, weapon-tree,
                      weapon-details, armor-catalog, search, filters
data/                 weapon-categories.json, weapons/<14 clases>.json,
                      armor/{pieces,sets,unreleased,monsters}.json,
                      search-index.json
assets/               iconos del juego (clases, ranuras, elementos, monstruos)
                      + sprite SVG propio de glifos estructurales
tools/                build_weapons.py, build_armor.py, build_search_index.py
tools/out/            informes crudos de generación
docs/                 DATA_SOURCES.md, DATA_VALIDATION_REPORT.md, README.md
```

Los datos viven separados del código y se regeneran con los scripts de
`tools/` (fuentes y licencias en `DATA_SOURCES.md`). La investigación de
repositorios previa está en `../research/` y `../DATA_SOURCES.md`.

## Datos y validación (resumen)

- Armas: 14/14 clases, 10,117 conexiones; linaje contrastado con mhgu.db
  (10,877/10,877), con el CSV de Scrimas (798/798) y **directamente con las
  tablas del juego** `weaponNNBaseData`/`LevelData` (798/798 bifurcaciones,
  9,319/9,319 mejoras, 10,911/10,911 niveles y ranuras; 1,592/1,592 árboles).
  Incluye las 113 líneas **sin monstruo** (mineral/hueso/planta/evento),
  verificadas con el mismo rigor (§1.8 del informe).
- Armaduras: 5,637/5,637 piezas verificadas campo a campo contra las tablas
  del juego del usuario (MHGU 1.4.0); 100 % nombres ES oficiales del juego.
- 195 piezas no publicadas conservadas aparte en `unreleased.json`.
- Vínculo conjunto–monstruo: 1,178/1,242 conjuntos etiquetados desde las
  categorías de material del juego; el resto son conjuntos no monstruosos o
  casos documentados (p. ej. Lunastra no existe en `monsters` de mhgu.db).
- Vínculo arma–monstruo: 1,479/1,592 árboles desde `weaponProcessW*.wpd` del
  juego (201 mutados); tooltips al pasar el ratón sobre nodos, conjuntos y
  piezas con el monstruo de origen y su icono.
- Iconos del juego incluidos como referencia fan comunitaria: 14 clases ×
  12 rarezas, 5 ranuras de armadura, 9 elementos/estados y 125/129 monstruos
  (Fandom). Aristas del árbol rectas (codos ortogonales). Glifos SVG propios
  como red de seguridad si algún asset faltara.
- Diseño visual calcado de la pantalla de herrería de MHGU: paneles de
  pergamino enmarcados en madera, placas de madera para títulos y nombres de
  línea, tipografía monoespaciada, etiquetas de stats en azul, selección
  dorada con anillo azul, chips negros y scrollbars de madera. La rejilla de
  armas usa una fila por línea y una casilla por nivel, como en el juego.

## Licencias y aviso fan

Este es un **proyecto fan de ayuda a la comunidad, sin ánimo de lucro**. No
genera ingresos, no muestra publicidad y no está afiliado, respaldado ni
patrocinado por Capcom. *Monster Hunter Generations Ultimate* y todos sus
recursos (nombres, datos, iconos de clases, ranuras, elementos y monstruos)
son propiedad de **© Capcom Co., Ltd.**

- Código y datos de terceros usados con atribución (MIT: tracker, mhgu.db,
  weapon-trees; GPL-3.0 solo como contraste de hechos, sin código copiado).
- Los hechos numéricos y nombres del juego se publican como referencia
  comunitaria. Los iconos del juego se incluyen en copia local con la misma
  finalidad de referencia fan, no comercial, reconociendo la propiedad de
  Capcom. Si Capcom o cualquier titular lo solicita, se retirarán de inmediato.
- Los glifos estructurales en SVG (`assets/icons/sprite.svg`) son obra propia.

Detalle de fuentes y licencias en `DATA_SOURCES.md`.