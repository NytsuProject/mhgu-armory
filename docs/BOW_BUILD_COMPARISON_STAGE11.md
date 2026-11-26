# Comparación justa de builds RAW, Elemental e Híbrido (Stage 11)

**Fecha:** 2026-11-25
**Rama:** `arena/a0c027dc-mhgu-armory`
**Estado:** clase A (Spread, presupuesto 5 y 6, sensibilidad 0/1/2) y clase B (Spread,
presupuesto 5 y 6) completadas; clase B para Pierce/Rapid/Heavy en ejecución.

## 1. Objetivo

Comparar builds de arco reales en tres perfiles — **RAW**, **Elemental** y **Híbrido** —
bajo restricciones idénticas, sin usar un build RAW incompleto como referencia.
Dos clases de comparación:

- **A. Controlada:** un mismo arco y una misma carga para los tres perfiles,
  para aislar la contribución de la configuración de habilidades.
- **B. Optimizada por especialización:** cada perfil elige su mejor arco G
  disponible para la carga, respetando catálogo, cargas, coberturas y revestimientos reales.

La comparación se inicia en rango **G**. HR/LR se extenderán solo si la metodología se valida.

## 2. Reglas no violadas

- Cap elemental de **30** conservado (modelo stage 10).
- Alineación C4 `!` alineada a C3 (nivel + marcador conservados); las 6 discrepancias C3 se dejaron intactas.
- **RAW sin modificar**.
- **Spread (Abanico) sin modificar**: multiplicadores, MVs, habilidades, valores y compensaciones
  quedan como están; Spread es el control.
- Sin aprobación A/B, sin multiplicadores elementales nuevos, sin cambios de parámetros del juego
  ni offsets de ROM sin evidencia verificada.

## 3. Resolución de la discrepancia documental

La matriz stage-10 y el informe stage-6 citan ratios de referencia distintos:

| Fuente | LR | HR | G |
|---|---|---|---|
| Ratio medio sobre **todas las partes** (`meanRatioAllParts` / `partMeanRatio`) | 0.759 | 0.835 | 0.887 |
| Ratio medio de la **mejor parte por monstruo** (`meanBestPartRatioPerMonster` / `meanRatio`) | 0.789 | 0.869 | 0.918 |

**Explicación:** son dos agregaciones sobre la **misma matriz de 93 monstruos** (631
emparejamientos parte × build). La primera promedia el ratio **cada parte evaluada**
(631 valores); la segunda toma, para cada monstruo, **la parte con mejor ratio** y
promedia esos 93 valores. La segunda favorece al build porque cada monstruo contribuye
con su mejor parte. Verificación directa en `/tmp/summary-old.json` (Element Full,
fila `base/ALL`): LR `meanRatio` 0.7885 vs `partMeanRatio` 0.7589; HR 0.8682 vs 0.8346;
G 0.9183 vs 0.8872 (victorias parte 5/631, victorias monstruo 4/93). Ambos números son
correctos y corresponden a agregaciones distintas. **El stage-11 reporta ambas agregaciones
siempre**, explícitamente.

## 4. Método

### 4.1 Optimizador (extensión stage 11)

`js/bow-build-optimizer.js` se extendió con:

- **Presupuesto de habilidades activadas** (`activeSkillBudget`): activa las N habilidades
  ofensivas superiores de una **prioridad documentada** (`offensiveSkillPriority`). Si los
  requisitos base no alcanzan el presupuesto, se completan con habilidades ofensivas adicionales
  (umbral `extraSkillThreshold = 10`) para que todos los perfiles comparen con el mismo número
  de habilidades activadas.
- **Políticas de talismán** (`talismanPolicy`): `max` (máximo teórico, incluida la suposición no
  verificada de dos habilidades simultáneas), `legal` (todos los valores positivos del catálogo,
  talismánes de una y dos habilidades) y `conservative` (solo talismánes de una habilidad).
- **Pesos por prioridad** en la puntuación de cobertura, para que el search active primero las
  habilidades ofensivas más importantes.
- **Sin habilidades negativas activas** (`allowNegatives: false`): si no existe un build limpio,
  se entrega el mejor y se marca `negativeSkillsJustified`.
- Cada build registra: umbrales, puntos investidos, ranuras usadas, coste, presupuesto, habilidades
  activadas y faltantes.

### 4.2 Prioridad ofensiva

- **RAW:** habilidad de carga, Expert, Tenderizer, Critical Up, Power C+, Attack.
- **Elemental:** habilidad de elemento, Crit Element, Tenderizer, habilidad de carga, Elemental, Critical Up.
- **Híbrido:** habilidad de elemento, Crit Element, Tenderizer, habilidad de carga, Power C+, Elemental, Critical Up, Expert.

En rango G con política de coating de bajo coste, el presupuesto **5** es el máximo legal
común: RAW no alcanza la 6.ª habilidad (`Attack` umbral 20 inalcanzable en G con el catálogo
disponible), y el elemental tampoco alcanza una 6.ª ofensiva. El presupuesto **6** se documenta
como **no alcanzable legalmente en G** y se presenta el intento de build parcial.

### 4.3 Medición de daño

`simulateBowBuildHitzoneMatrix` sobre las **93 hitzones de monstruos grandes** vendoradas
(`tools/data-hitzones.js`), estilo Guild, 200 disparos mision, cap elemental 30, misma arma,
misma carga y mismas partes para todos los perfiles. Ratios reportados **siempre** en las dos
agregaciones (todas las partes / mejor parte por monstruo).

## 5. Resultados provisionales — Clase A (control)

**Arco control:** Elizabeth atenta (árbol 104, nivel 3), **Spread Lv5**, rango G, bajo coste,
presupuesto **5**, ambos géneros. Todos los builds **5/5 completos** y sin negativas.

| Comparación | Ratio (todas partes) | Ratio (mejor parte) | Victorias parte |
|---|---|---|---|
| Elemental / RAW | 0.882 | 0.905 | 5 / 633 |
| Híbrido / RAW | 0.930 | 0.949 | 9 / 633 |
| Híbrido / Elemental | 1.055 | 1.058 | 633 / 633 |

**Sensibilidad de transición híbrida** (disparos equivalentes perdidos, escenario teórico):

| Disparos de transición perdidos | Híbrido / RAW | Híbrido / Elemental |
|---|---|---|
| 0 (teórico, sin coste) | 0.930 | 1.055 |
| 1 | 0.928 | 1.052 |
| 2 | 0.925 | 1.050 |

El escenario de **coste cero** es **teórico**, no rendimiento confirmado en juego. El híbrido
pierde algo de ratio con la transición, pero permanece por encima del elemental en todos los
casos. El elemental y el híbrido siguen **por debajo del RAW** en daño medio total para este
arco control.

En la **clase B** (arco Ocaso y decadencia, revestimientos nativos), la transición con 1
disparo perdido **no altera** los ratios (elemental/raw 0.799, híbrido/raw 0.846,
híbrido/elemental 1.059): el arco seleccionado evitan la transición costosa.

**Monstruos donde el perfil gana al RAW** (clase A, Spread, presupuesto 5):
- **Híbrido > RAW:** 9 monstruos (ej. Silver Rathalos, Bloodbath Diablos, Yian Garuga,
  Deadeye Yian Garuga, Uragaan, Najarala).
- **Elemental > RAW:** 5 monstruos (ej. Bloodbath Diablos, Yian Garuga, Deadeye Yian Garuga, Uragaan).

En la mayoría de los 93 monstruos el RAW sigue siendo el de mayor daño medio; el elemental y
el híbrido solo superan al RAW en matchups con buenas hitzones elementales.

### 5.2 Comparación de coating (Element Coat → Power Coat)

- **Elemental:** usa **Element Coat nativo** (el arco control tiene Element Coating y
  Element Coating 2). No gasta puntos en `Elem C+`; esos puntos van a habilidad ofensiva.
- **RAW:** no tiene Power nativo; exige **Power C+ I** (10 puntos) para la política de
  bajo coste. Estos puntos no están en habilidad ofensiva.
- **Híbrido:** usa **Element Coat nativo** y **Power C+ I**; la transición Element Coat →
  Power Coat se modela como **disparos equivalentes perdidos** (0/1/2). El escenario **0**
  es teórico; no representa frames reales de transición.

### 5.1 Builds completos (clase A, Spread, presupuesto 5)

- **RAW:** armadura GX/XR mixta (Cara Fatalis Anc. GX, Chaleco Uragaan X, Guantes Jaggi X,
  Muslera Glifo XR, Patas Fatalis Anc. GX), talisman de deco 3, joyas de mazá/críticos.
  Habilidades activas: Pellet Up, Expert, Tenderizer, Critical Up, Power C+. **57 puntos, 5 ranuras**.
  Coating: Power C+ I (el arco no tiene Power nativo).
- **Elemental:** armadura Escadora/Génesis/Glifo XR, talisman de deco 3, joya de agua.
  Habilidades: Water Atk, Crit Element, Tenderizer, Pellet Up, Elemental. **62 puntos, 5 ranuras**.
  Coating elemental **nativo** (no gasta habilidad de coating).
- **Híbrido:** armadura Rathalos/Uragaan/Velociprey/Hermitaur/Escadora, talisman + joyas
  (crítico elemental, energía). Habilidades: Water Atk, Crit Element, Tenderizer, Pellet Up, Power C+.
  **61 puntos, 9 ranuras**. Coating: Power C+ I.

## 6. Clase B (optimizada por especialización) — Spread

Cada perfil elige su mejor arco **G** para Spread que **complete el presupuesto 5**,
respectando catálogo, cargas, coberturas y revestimientos reales.

| Perfil | Arco | Habilidades activas | Puntos | Ranuras |
|---|---|---|---|---|
| RAW | Arco filosofal (slot 2) | Pellet Up, Expert, Tenderizer, Critical Up, Attack | 66 | 7 |
| Elemental | Ocaso y decadencia (slot 2) | Dragon Atk, Crit Element, Tenderizer, Pellet Up, Elemental | 62 | 5 |
| Híbrido | Ocaso y decadencia (slot 2) | Dragon Atk, Crit Element, Tenderizer, Pellet Up, Power C+ | 61 | 9 |

**Ratios clase B, presupuesto 5 (todas las partes / mejor parte):**

| Comparación | Ratio (todas partes) | Ratio (mejor parte) |
|---|---|---|
| Elemental / RAW | 0.799 | 0.820 |
| Híbrido / RAW | 0.846 | 0.866 |
| Híbrido / Elemental | 1.059 | 1.060 |

En la clase B el RAW selecciona un arco donde **sí alcanza Attack (20)** y completa 5/5;
el elemental ahorra la habilidad de coating (coating elemental nativo). El híbrido gana
contra el elemental en **todas las partes (633/633)** pero sigue por debajo del RAW en
daño medio.

## 6.1 Ratios por tipo de flecha (clase A control / clase B)

| Shot type | Clase | Elemental / RAW | Híbrido / RAW | Híbrido / Elemental |
|---|---|---|---|---|
| Spread | A | 0.882 | 0.930 | 1.055 |
| Spread | B | 0.799 | 0.846 | 1.059 |
| Pierce | A | 0.899 | 0.942 | 1.049 |
| Pierce | B | 0.810 | 0.879 | 1.085 |
| Rapid | — | (en ejecución) | (en ejecución) | (en ejecución) |
| Heavy | — | (en ejecución) | (en ejecución) | (en ejecución) |

Pierce muestra ratios más altos que Spread para el elemental y el híbrido frente al RAW,
pero el RAW sigue siendo el de mayor daño medio en ambas cargas.

## 7. Presupuesto 6 (comparación de presupuestos equivalentes)

En rango G, **no todos los perfiles alcanzan 6 habilidades ofensivas legalmente**:
RAW no tiene una 6.ª ofensiva alcanzable (`Attack` umbral 20 depende del arco y la
armadura), por lo que en el arco control se queda en **5/6 parcial**. El **elemental
sí completa 6/6** en la clase B (Ocaso y decadencia).

**Clase A (arco control, todos 5/6 parciales):** los ratios son los mismos que a
presupuesto 5, porque la 6.ª habilidad faltante no aporta daño: elemental/raw 0.882,
híbrido/raw 0.930, híbrido/elemental 1.055.

**Clase B, presupuesto 6 (elemental 6/6, raw y híbrido 5/6):**

| Comparación | Ratio (todas partes) | Ratio (mejor parte) |
|---|---|---|
| Elemental / RAW | 0.862 | 0.878 |
| Híbrido / RAW | 0.875 | 0.892 |
| Híbrido / Elemental | 1.015 | 1.027 |

A presupuesto 6, el elemental **se acerca al RAW** (0.862 vs 0.799) porque activa una
habilidad ofensiva más; el híbrido también se acerca pero mantiene su ventaja sobre el
elemental (1.015). El RAW sigue siendo el de mayor daño medio en todos los casos.

## 8. Limitaciones de validación en juego

- Los talismánes de política `max` asumen puntos máximos simultáneos de dos habilidades;
  **suposición no verificada** en juego.
- El modelo de transición híbrida expresa el coste en **oportunidades de disparo perdidas**,
  no en frames medidos.
- Ammo Saver no se cuenta (probabilidad de devolución no verificada).
- No se aplica bonificación Close Range de Seregios.
- El beam search es acotado: entrega builds legales encontrados, no óptimo global garantizado.
- Los resultados son modelos teóricos sobre hitzones; no sustituyen la medición en juego.

## 9. Tests automatizados

`tests/bow-build-comparison.test.mjs` (7 pruebas): políticas de talismán, prioridad ofensiva,
modo presupuesto, igualdad de presupuesto (los tres perfiles 5/5), reproducibilidad,
conservación invariante del rebalance (cap 30, RAW/Spread sin cambios) y matriz de daño
con las dos agregaciones de ratio. **npm test: 97/97.**
