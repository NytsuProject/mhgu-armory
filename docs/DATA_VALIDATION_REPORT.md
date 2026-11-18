# DATA_VALIDATION_REPORT.md — MHGU ARMORY

Fecha: 2026-11-17 · Datos generados por `tools/build_weapons.py` y `tools/build_armor.py`
(reproducibles; informes crudos en `tools/out/weapons_build_report.json` y
`tools/out/armor_build_report.json`).

Estados usados en los datos:

- **VERIFIED**: comprobado contra una fuente autoritativa (tablas del juego del
  usuario, MHGU 1.4.0) o contrastado con dos fuentes independientes.
- **PARTIAL / UNVERIFIED**: presente en una fuente secundaria sin contraste completo.
- **MISSING**: información ausente; no se inventa ningún dato.
- **DERIVED**: calculado a partir de datos oficiales con regla documentada
  (p. ej. nombre ES de un conjunto, rango por rareza).

---

## 1. Armas

| Métrica | Valor |
|---|---|
| Clases de arma | **14 / 14** |
| Árboles de mejora (nodos de árbol) | **1,592** |
| Niveles de arma (nodos del grafo) | **10,911** |
| Conexiones totales | **10,117** |
| — mejoras consecutivas (nivel N → N+1) | 9,319 |
| — bifurcaciones (árbol hijo → árbol padre) | **798** |
| Árboles raíz (forja directa) | 794 |
| Nombres ES verificados (mhgu.db, MIT) | **10,877 / 10,911 (99.7 %)** |
| Niveles sin nombre ES | 34 (todos placeholders «(DUMMY)», ver §1.3) |
| Errores de linaje | **0** |
| Árboles con monstruo de origen (§1.7) | **1,479 / 1,592 (92.9 %)** |
| — de ellos, árboles de monstruo mutado | 201 |

### 1.1 Por clase

| Clase | Árboles | Niveles | ES |
|---|---|---|---|
| Gran espada | 136 | 958 | 958 |
| Espada larga | 126 | 875 | 865 |
| Espada y escudo | 128 | 877 | 872 |
| Espadas dobles | 125 | 844 | 839 |
| Martillo | 131 | 885 | 885 |
| Cornamusa | 111 | 801 | 796 |
| Lanza | 126 | 857 | 857 |
| Lanza pistola | 114 | 809 | 809 |
| Hacha espada | 109 | 769 | 765 |
| Hacha cargada | 80 | 533 | 528 |
| Glaive insecto | 82 | 547 | 547 |
| Ballesta ligera | 109 | 703 | 703 |
| Ballesta pesada | 108 | 718 | 718 |
| Arco | 107 | 735 | 735 |

### 1.2 Validación de conexiones (cuádruple contraste)

1. **mhgu.db (MIT)**: cada nivel con `lv > 1` debe tener como padre el nivel
   anterior de su árbol, y cada raíz de bifurcación el nivel de desbloqueo del
   árbol padre (`weapons.parent_id`). **10,877 / 10,877 comprobaciones OK, 0 fallos.**
2. **Scrimas/MHGU-Save-editor `data/weapon-tree.csv`** (extraído de
   `weaponNNBaseData` del RomFS; GPL-3.0, usado solo como contraste, sin copiar
   código): **798 / 798 aristas idénticas** (hijo, padre, nivel de desbloqueo),
   tras alinear el orden interno de clases del juego
   (GS=0, SnS=1, Martillo=2, Lanza=3, HBG=4, LBG=6, LS=7, SA=8, GL=9, Bow=10,
   DB=11, HH=12, IG=13, CB=14). La distribución de niveles de desbloqueo
   coincide exactamente: {1:85, 2:250, 3:301, 4:79, 5:59, 6:20, 7:3, 8:1}.
3. Las bifurcaciones conservan el **nivel de desbloqueo** del padre: una rama
   sigue disponible desde ese nivel en adelante (no se cierra al subir de
   nivel), tal como exige la mecánica real del juego.
4. **Tablas del juego del usuario (autoritativas, MHGU 1.4.0)**: decodificación
   directa de `weaponNNBaseData.wNNd` (últimos 10 B = 5 pares `[u8 nivel, u8
   hijo]` = bifurcaciones con nivel de desbloqueo) y `weaponNNLevelData.wNNd`
   (+4 árbol, +5 nivel, ranuras en el byte propio de cada clase).
   **798 / 798 bifurcaciones y 9,319 / 9,319 mejoras consecutivas idénticas**,
   nivel por nivel y árbol por árbol (`tools/verify_weapon_lineage.py`,
   informe en `tools/out/weapon_lineage_verify.json`). Ver §1.8.

### 1.3 Placeholders «(DUMMY)»

34 niveles de 7 árboles (espada larga 10, espada y escudo 5, espadas dobles 5,
cornamusa 5, hacha espada 4, hacha cargada 5) son entradas «(DUMMY)» exclusivas
de MHXX (evento japonés) que existen en las fuentes pero no tienen nombre ES
oficial. Se **conservan** marcados `dummy: true` y `es: "MISSING"`; no se
eliminan ni se inventan nombres. La interfaz los muestra como «Sin datos ES».

### 1.4 Campos específicos por clase (niveles con el campo)

| Campo | Niveles | Clases |
|---|---|---|
| `x.phial` (tipo de vial) | 1,302 | Hacha espada (769) + Hacha cargada (533) |
| `x.shell` (bombardeo) | 809 | Lanza pistola |
| `x.notes` (notas) + melodías | 801 | Cornamusa (melodías en `songs` por árbol) |
| `x.arc`, `x.charges`, `x.coatings` | 735 | Arco |
| `x.siege` (disparo agachado) | 718 | Ballesta pesada |
| `x.rapidFire` (disparo rápido) | 626 | Ballesta ligera |
| `x.kinsect` | 547 | Glaive insecto |
| `x.ammo`, `x.internal`, `x.stats` | 1,421 | Ballestas (703 + 718) |
| `sh` (afilado, 3 bandas × 7 colores) | todos los niveles cuerpo a cuerpo | — |

Ningún campo impropio aparece en una clase que no le corresponde (comprobado
por el pipeline: los extras solo se emiten para su clase).

### 1.6 Cargas de arco marcadas «!» en la fuente

Los JSON del tracker marcan con un «!» final las cargas que solo otorga la
habilidad **Load Up** (comentario documentado en `docs/app.js` del tracker,
MIT). El nombre ES oficial de esa habilidad es **Recargando**: verificado por
índice en las GMD del juego (`skillTypeData_eng.gmd[134] = "Loading"` ↔
`skillTypeData_spa.gmd[134] = "Recargando"`, descripción: incrementa la
capacidad de munición, revestimientos y ataque cargado de los arcos), que
coincide con `skill_trees` de mhgu.db. La interfaz muestra la etiqueta
«Recargando» en lugar del «!» críptico; no se añade ninguna carga inexistente.

### 1.7 Vínculo arma–monstruo (tooltips y ficha de arma)

Método, por orden de prioridad y todo con evidencia local:

1. **Categorías de puntos de material** de `weaponProcessW<NN>.wpd` del dump
   del usuario (registro de 32 B por nivel; @16 = categoría N → ítem
   `(30<<16)|N` de mhgu.db, «HR Rathalos Materials»). Se toma la **unión por
   árbol** de las categorías de todos sus niveles y se casa con `monsters`
   mediante las mismas reglas y alias verificados del §2.7.
2. **Fallback por nombres de material** (JSON de materiales del tracker, MIT)
   **solo cuando el árbol no tiene ninguna categoría** en el wpd: los nombres
   de material que contienen un nombre de monstruo aportan el origen. Esto
   etiqueta líneas genéricas evolucionadas con materiales de monstruo (p. ej.
   Hoja petrificada → Arzuros/Conga/Jaggi/Larinoth) sin sobre-etiquetar líneas
   que ya tienen categoría propia (un arma de Rathalos Plateado que consume
   «Rathalos Mantle» no recibe a Rathalos a secas).

Cobertura por clase (árboles con monstruo / totales): gran espada 126/136,
espada larga 116/126, espada y escudo 115/128, espadas dobles 112/125,
martillo 122/131, cornamusa 105/111, lanza 115/126, lanza pistola 107/114,
hacha espada 102/109, hacha cargada 73/80, glaive insecto 79/82,
ballesta ligera 104/109, ballesta pesada 101/108, arco 102/107.
**Total 1,479/1,592; 201 árboles marcados `deviant`** (vía `monsters.class=='2'`).

Los 113 árboles restantes quedan **sin etiqueta** (mineral/hueso genéricos sin
materiales de monstruo en sus recetas); la interfaz lo declara explícitamente
(«Materiales genéricos: sin monstruo de origen») en lugar de inventar un
origen. El campo se publica como `monsters: [ids]` + `deviant: bool` por árbol.

### 1.5 Procedencia de las stats de arma

Nombres y stats por nivel: Kiranico MHGU a través de los JSON committeados de
mhgu-collection-tracker (MIT el código; datos de Kiranico sin licencia formal,
atribución por cortesía según su NOTICE.md). Linaje y nombres ES/JA: mhgu.db
(MIT). **No se ha mezclado ningún dato de MH Rise/World/otros títulos**: las
fuentes usadas son exclusivas de MHGU/MHXX.

---

### 1.8 Completitud y árboles sin monstruo (contraste directo con el juego)

`tools/verify_weapon_lineage.py` decodifica las tablas del dump del usuario y
compara **todo** el grafo publicado, no solo las armas de monstruo:

| Comprobación contra `weaponNNBaseData` / `weaponNNLevelData` | Resultado |
|---|---|
| Árboles reales del juego presentes en ARMORY | **1,592 / 1,592** (0 ausentes, 0 inventados) |
| Registros del juego no publicados | 14 = 1 placeholder vacío «(Ninguna)» por clase (1 nivel, sin hijos, sin nombre de arma); no es equipamiento |
| Niveles publicados | **10,911 / 10,911** (10,925 del juego − 14 placeholders) |
| Conjunto de niveles por árbol (1..N contiguo) | 1,592 / 1,592 árboles idénticos |
| Bifurcaciones (hijo, padre, nivel de desbloqueo) | **798 / 798** |
| Mejoras consecutivas N → N+1 | **9,319 / 9,319**, 0 fallos |
| Ranuras de decoración por nivel | **10,911 / 10,911** (byte de ranuras: último en cuerpo a cuerpo, +10 en ballestas, +12 en arco) |
| Nivel del primer renombre del árbol (byte 9 de BaseData) | **1,585 / 1,585** árboles no DUMMY |
| `weapons.parent_id` de mhgu.db reconstruido desde ARMORY | **10,877 / 10,877**, 0 fallos |
| Aristas del CSV de Scrimas | **798 / 798** |

Partición por origen (el linaje se verifica **igual** en ambos grupos):

| Grupo | Árboles | Niveles | Bifurcaciones OK | Consecutivas OK |
|---|---|---|---|---|
| Con monstruo de origen (grande o pequeño) | 1,479 | 10,162 | 762 / 762 | 8,683 / 8,683 |
| **Sin monstruo** (mineral, hueso, planta, evento, forja genérica) | **113** | **749** | **36 / 36** | **636 / 636** |

Los 113 árboles sin etiqueta de monstruo **sí están publicados y verificados**:
p. ej. gran espada «Filo Yukumo», «Gran espada oxidada», «Defensora», «Hoja de
obsidiana», «Alabarda», «Mezclador de queso»; espada y escudo «Cuchillo de
cazador», «Tabar de hueso», «Pico de hueso», «Cuchillo de cocina»; martillo
«Martillo oxidado», «Martillo de guerra», «Jamón enorme», «Rey calabaza».
Sus materiales son genéricos (mineral/hueso/planta) o de evento, por eso no
llevan etiqueta de monstruo; su linaje de crafteo se comprobó con el mismo
rigor que el de las armas de monstruo. Las categorías de material del juego
incluyen también monstruos **pequeños** (Jaggi, Conga, Larinoth, Arzuros…), no
solo grandes: p. ej. «Hoja petrificada» → Arzuros/Conga/Jaggi/Larinoth.

## 2. Armaduras

| Métrica | Valor |
|---|---|
| Piezas de cazador | **5,637** |
| — Casco / Pechera / Brazales / Faja / Grebas | 1,163 / 1,148 / 1,117 / 1,073 / 1,136 |
| Piezas VERIFIED contra tablas del juego | **5,637 / 5,637 (100 %)** |
| Discrepancias de stats vs juego | **0** |
| Nombres ES oficiales (GMD spa del juego) | **5,637 / 5,637 (100 %)** |
| Habilidades con nombre ES (mhgu.db) | 100 % (0 puntos sin traducir) |
| Conjuntos (`armor_families`, mhgu.db) | **1,242** |
| — completos (5 piezas) | 1,036 |
| — parciales legítimos del juego | 206 (ver §2.3) |
| Nombre ES de conjunto DERIVADO | 1,197 |
| Nombre ES de conjunto MISSING | 45 |
| Piezas no publicadas conservadas aparte | 195 (`data/armor/unreleased.json`) |

### 2.1 Verificación independiente

Cada pieza se decodificó **de nuevo** desde `armorSeriesData.asd` (1,287 × 127 B)
+ `armorBuildData.abd` del dump del usuario (MHGU 1.4.0), con el layout
documentado en el script MIT del tracker, y se comparó campo a campo con los
stats del tracker: rareza, defensa base y máxima (curva de mejora), 5
resistencias, ranuras de decoración, habilidades y puntos, tipo B/G.
**Resultado: 0 discrepancias en 5,637 piezas.**

### 2.2 Género: discrepancia resuelta

- Convención de las fuentes: juego `r[13]=male, r[14]=female`; mhgu.db
  `0=femenino, 1=masculino, 2=ambos`; catálogo Kiranico `0=masc, 1=fem, 2=ambos`.
- **58 piezas** tenían género erróneo en el catálogo Kiranico (p. ej. Gammoth
  Helm/Cap: catálogo=femenino, juego y mhgu.db=masculino). Se exportó el género
  de los **bits del juego** (fuente autoritativa). mhgu.db coincide con el juego
  en el 100 % de las piezas (`dbGenderMismatch: 0`).
- Distribución final: 4,535 ambos, 588 femenino, 514 masculino.
- Tipo: 2,761 Espadachín (B), 2,761 Artillero (G), 115 ambos (A).

### 2.3 Conjuntos parciales (206)

Son conjuntos que **en el propio juego no tienen las 5 piezas**: p. ej. Maccao
LR solo Brazales+Grebas, Konchu solo Casco+Brazales, «Bullfango Mask» solo
Casco, cinturones solo Faja. `armor_families` de mhgu.db codifica exactamente
qué piezas existen; no es un error de datos. Distribución: 82 de 1 pieza,
50 de 2, 21 de 3, 53 de 4.

### 2.4 Piezas no publicadas (195, conservadas en `unreleased.json`)

Existen en las tablas del juego pero no son equipamiento obtenible (ausentes de
Kiranico y de mhgu.db):

- **154** placeholders «DUMMY».
- **40** variantes no publicadas: versiones femeninas de Gammoth / Gammoth S /
  Gammoth X / Gourmew (las publicadas son masculinas; p. ej. sid 696/697
  «Casco/Gorro de Gammoth» con bit female=1, frente a 160/161 publicados con
  bit male=1).
- **1** hueco vacío («(Ninguna)», faja sid 862).

Se conservan con sus stats y evidencia por procedencia; no forman parte del
catálogo navegable ni se presentan como fabricables.

### 2.5 Rangos (DERIVED con evidencia)

Rareza 1–3 → **Rango bajo** (901 piezas), 4–7 → **Rango alto** (2,238, sets «S»),
8–11 → **Rango G** (2,498, sets «X»/«GX»/desviantes). Evidencia: Leather S →
rareza 4, Bherna X → 8, Redhelm (desviante) → 11.

### 2.6 Nombres ES de conjunto

DERIVED: secuencia común de tokens de los nombres ES oficiales de las piezas
(p. ej. «Casco de Rathalos» + «Malla de Rathalos» → «Rathalos»). 45 conjuntos
sin secuencia común quedan `nameEsStatus: "MISSING"` y la interfaz muestra el
nombre EN original; no se inventan traducciones.

### 2.7 Vínculo conjunto–monstruo (filtro «Monstruo» y buscador)

| Métrica | Valor |
|---|---|
| Monstruos en `data/armor/monsters.json` (mhgu.db, MIT) | **129** |
| Conjuntos con monstruo de origen asignado | **1,178 / 1,242 (94.8 %)** |
| Categorías de material sin correspondencia | **0** |
| Conjuntos sin monstruo (lista en el informe crudo) | 64 |

Método (por orden de prioridad, todo con evidencia local):

1. **Categorías de puntos de material** de `armorProcessA00.apd` (@22) y de las
   recetas `armorCreateA0{0..4}.acrd`: la categoría N es el ítem
   `(30<<16)|N` de mhgu.db, con nombre EN del tipo «HR Teostra Materials».
   Se extrae el núcleo del nombre y se casa con `monsters.name` (exacto, o
   prefijo único para deviantes: «Hellblade» → Hellblade Glavenus). Alias
   documentados y verificados contra `monsters`: `S.Rathalos`→Silver Rathalos,
   `S. Magala`→Shagaru Magala, `Fatalis (Crimson)`→Crimson Fatalis,
   `Fatalis (Old)`→Old Fatalis, `Rathian (Any)`→Rathian, `Rathalos (Any)`→Rathalos.
2. **Nombres de material** de las recetas (apd + acrd) que contienen el nombre
   EN/ES del monstruo; para nombres con guion se admite el tronco
   («Lao-Shan Lung» → «Lao-Shan» en «Lao-Shan Shard»). Se descartan coincidencias
   contenidas en otra más larga («Gore Magala» dentro de «Chaotic Gore Magala»).
3. **Herencia estructural**: variantes del mismo conjunto base (sufijos
   S/X/GX/XR/R/U/Z/EX) y piezas emparejadas por género (`pair` del catálogo)
   heredan el monstruo del conjunto ya etiquetado.

Los 64 conjuntos restantes no reciben etiqueta: en su mayoría son conjuntos
**no monstruosos** (mineral/hueso/planta/insecto con materiales de nombre
genérico: Chainmail, Alloy, Edel, Melahoa, pendientes, plumas…) y eventos o
colaboraciones (Varia Suit, Zero Suit, Hylian, Chakra, Ancient, Master's…).
Se documentan además **Kaiserin** (conjunto de Lunastra, «Soberana» en ES;
Lunastra no existe en la tabla `monsters` de mhgu.db, por lo que no puede
etiquetarse desde esa fuente) y **Yaksha/Carnage** (materiales con nombre
propio sin el nombre del monstruo). Algunos eventos usan materiales de
monstruo como coste genérico del juego; no se afirma origen monstruoso para
ellos. No se inventan vínculos: quedan sin etiqueta y el filtro «Monstruo»
simplemente no los incluye.

El campo `deviant` de cada conjunto proviene de `monsters.class == '2'`
(mhgu.db), no de heurísticas de nombre.

### 2.8 Iconos del juego en la interfaz (v2)

| Asset | Archivos | Fuente | Cobertura |
|---|---|---|---|
| Clases de arma × rareza (`_r1.._r10`, `_rX`) | 168 | tracker MIT, `docs/assets/icons` (extraídos del juego) | 14/14 clases; todos los sufijos referenciados por los datos existen (comprobado por pipeline) |
| Ranuras de armadura | 5 | tracker MIT, `icon_armor_<slot>` | 5/5 |
| Elementos/estados | 9 | MHGUDB-iOS MIT, `icons_monster_info` | 9/9 (Fuego…Explosión) |
| Monstruos (`<id>.webp`) | 125 | Fandom `MHGU-<Name> Icon.png` | 125/129; sin icono: Fatalis, Alatreon, Crimson Fatalis, Old Fatalis (se omite el glifo, nunca un roto) |

Comprobación de integridad: para cada árbol de los 14 JSON se resolvió el
sufijo de rareza de su nivel final y se verificó que el PNG existe en disco
(0 faltantes); en navegador, los 20 URLs únicos de icono del árbol de gran
espada y los 17 de la vista de armaduras devuelven HTTP 200.

---

## 3. Resumen de integridad

| Comprobación | Resultado |
|---|---|
| 14 clases presentes | ✅ |
| IDs únicos por (clase, árbol, nivel) | ✅ (pipeline) |
| Sin armas inventadas | ✅ (todo proviene de las fuentes) |
| Conexiones completas y verificadas | ✅ 10,117 (798/798 aristas = CSV del juego = BaseData del juego; 9,319/9,319 consecutivas) |
| Completitud de árboles y niveles vs tablas del juego | ✅ 1,592/1,592 árboles y 10,911/10,911 niveles (§1.8); 14 placeholders vacíos excluidos |
| Armas sin monstruo incluidas y verificadas | ✅ 113 árboles / 749 niveles / 36 bifurcaciones / 636 consecutivas, 0 fallos |
| Ranuras de decoración por nivel vs juego | ✅ 10,911/10,911 |
| Bifurcaciones persistentes con nivel de desbloqueo | ✅ |
| Sin datos de otros Monster Hunter | ✅ |
| Todas las piezas con sus stats correctos | ✅ 5,637/5,637 vs juego |
| Variantes diferenciadas (B/G, género, rango, desviantes) | ✅ |
| Habilidades y puntos correctos | ✅ vs asd del juego |
| Datos ausentes marcados, no inventados | ✅ (34 niveles DUMMY, 45 nombres de set) |
| Vínculo arma–monstruo con evidencia (wpd del juego) | ✅ 1,479/1,592; 113 sin etiqueta declarada |
| Iconos referenciados existen en disco y se sirven | ✅ 0 faltantes / 0 HTTP 404 |

## 3b. Verificación de interfaz v2 (navegador real, 127.0.0.1:8765)

- Aristas del árbol **rectas** (codos ortogonales `H/V/H`), badge «Nv N» sobre
  el tramo horizontal del hijo; zoom, arrastre, contraer/expandir, «Expandir
  todo», centrar y filtros siguen operativos tras el cambio (136 nodos GS,
  127 atenuados con filtro Fuego, colapso y expansión correctos).
- Iconos reales de clase (teñidos por rareza) en lista de clases, título,
  nodos del árbol, ficha de arma, buscador y portada; iconos de elemento en
  nodos, ficha y resistencias de armadura; iconos de ranura en tarjetas y ficha
  de pieza; iconos de monstruo en chips de conjunto, tooltips y buscador.
- Tooltips al pasar el ratón: nodo de arma (nombre ES/EN, rareza, monstruos de
  origen con icono y marca «Mutado»), fila de conjunto y tarjeta de pieza;
  aparecen junto al cursor, se re-posicionan dentro del viewport y se ocultan
  al salir, al hacer clic o al hacer scroll. Caso comprobado: Brillaspada
  Rathalos → Rathalos Plateado; Hoja petrificada → Arzuros/Conga/Jaggi/Larinoth.
- Ficha de arma muestra bloque «Monstruo / materiales de origen» (Helioespada
  Rathlord → Rathalos Plateado) y elemento con icono (Fuego 60).
- Buscador «rathalos»: 4 grupos (Armas/Conjuntos/Piezas/Monstruos), 20
  resultados, todos con icono real y HTTP 200.
- **0 errores de consola** y 0 assets rotos en todas las vistas comprobadas.

## 3c. Corrección de selección por clic real (bug reportado) y verificación con input fiable

**Síntoma reportado:** al hacer clic con el ratón en un nodo del árbol, el panel
derecho seguía mostrando «Selecciona un arma del árbol…» (sin stats).

**Causa raíz:** `viewport.setPointerCapture(pointerId)` se llamaba en
`pointerdown`. La captura de puntero redirige el `pointerup` — y los `click` /
`dblclick` derivados — al propio viewport, de modo que
`e.target.closest(".wnode")` devolvía `null` y ningún clic real seleccionaba.
Las pruebas anteriores usaban `dispatchEvent` sintético sobre el nodo, que
ignora la captura y por eso enmascaraban el fallo (presente desde v1).

**Corrección (`js/weapon-tree.js`):** la captura se difiere hasta superar el
umbral de arrastre (`|dx|+|dy| > 4`); un clic simple conserva el nodo como
target natural y selecciona en `pointerup`. Se añadió `pointercancel` para
resetear el estado de arrastre. El paneo sigue capturando una vez en movimiento
(arrastre fluido sin perder el puntero fuera del lienzo).

**Accesibilidad de teclado añadida:** cada nodo es `role="treeitem"`
`tabindex="0"` con `aria-label` y `aria-selected`; cada botón de contraer es
`role="button"` `tabindex="0"`. Enter/Espacio seleccionan el nodo o alternan el
colapso; `:focus-visible` dibuja el borde dorado.

**Verificación con input real del navegador (no sintético), gran espada:**

| Acción real | Resultado observado |
|---|---|
| Hover sobre nodo «Hoja petrificada» | tooltip visible dentro del viewport: Arzuros/Conga/Jaggi/Larinoth |
| Arrastre nodo → panel de clases | transform cambia (paneo), **sin** selección parásita; clase `dragging` se limpia al soltar |
| Clic en nodo «Defensora» | selecciona (id 8) y renderiza ficha: Bastión, Ataque 350, Afinidad 0 %, Def +40, Nv 1–9 |
| Doble clic en nodo con ramas | colapsa: 136 → 127 nodos, badge «+9» |
| Clic «Expandir todo» | restaura 136 nodos |
| Foco de teclado + Enter en nodo 11 | selecciona, `aria-selected="true"`, ficha «Espada de eltalita» Ataque 360 |
| Clic en nodo a zoom normal (0.85) | ficha «Hoja docta» Ataque 320 + monstruos de origen con icono |
| Consola | **0 mensajes / 0 errores** en toda la secuencia |

## 4. Limitaciones conocidas

1. Stats de arma de Kiranico (vía tracker): sin licencia formal; atribución en
   `DATA_SOURCES.md`. El pipeline del tracker que los generó no es públicamente
   reproducible (input `mhgu-editor` privado); se partió de sus JSON committeados.
2. mhgu.db es de 2018: podría faltar contenido de evento posterior; el contraste
   con las tablas del juego del usuario (v1.4.0) no mostró diferencias en
   armaduras ni en linaje de armas.
3. Nombres ES de arma: 34 niveles DUMMY sin traducción (MHXX-exclusivos).
4. Iconos del juego (clases, ranuras, elementos, monstruos): copia local
   personal con atribución, **no redistribuible** tal cual (ver DATA_SOURCES.md
   §Licencias). 4 monstruos sin icono disponible en la wiki (Fatalis, Alatreon,
   Crimson Fatalis, Old Fatalis): la interfaz omite el glifo en esos casos.
5. La tabla `monsters` de mhgu.db (129 entradas) no incluye a Lunastra; su
   conjunto (Kaiserin / «Soberana») existe en la interfaz pero sin etiqueta de
   monstruo ni entrada en el filtro «Monstruo» (§2.7).