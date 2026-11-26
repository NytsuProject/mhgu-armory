# Comparación justa de builds RAW, Elemental e Híbrido (Stage 11 — corregido)

**Fecha:** 2026-11-25
**Rama:** `arena/a0c027dc-mhgu-armory`
**Estado:** las 7 correcciones de stage-11 están aplicadas, re-verificadas y
generadas. 12 comparaciones completas (Spread/Pierce/Rapid/Heavy × LR/HR/G),
con talismánes conservadores y opciones verificadas. Auditoría de progresión
elemental completa. 100/100 pruebas pasan.

> **Aviso de revisión posterior (Stage 12): resultados provisionales.** La revisión del selector encontró que las comparaciones de clase B para LR y HR estaban construyendo las armaduras con rango G, aunque los arcos candidatos sí se filtraban por LR/HR. Ese error ya está corregido en el driver; por tanto, las filas LR/HR de las tablas siguientes no son válidas como comparaciones de progresión por rango hasta regenerarlas. Además, el selector solo sondea los 12 candidatos mejor puntuados por un heurístico de catálogo y calcula daño real para un máximo de 4; no demuestra que haya encontrado el mejor arco de todo el catálogo. Los artefactos futuros registrarán el tamaño del universo y si la búsqueda fue exhaustiva. No se han cambiado las estadísticas de armas ni se deben usar estas cifras para aprobar nuevos multiplicadores.

## 1. Objetivo

Comparar builds de arco reales en tres perfiles — **RAW**, **Elemental** y
**Híbrido** — bajo restricciones idénticas, sin usar un build RAW incompleto
como referencia. Dos clases de comparación:

- **A. Controlada:** un mismo arco y una misma carga para los tres perfiles,
  para aislar la contribución de la configuración de habilidades. Solo aplica
  donde el arco control (Elizabeth atenta, árbol 104 lv3) tiene la carga:
  **Spread** y **Pierce**. Rapid y Heavy no tienen control de clase A.
- **B. Optimizada por especialización:** **cada perfil selecciona su propio
  arco** para la carga y el rango (LR/HR/G), usando **daño real contra la
  matriz de monstruos**, no un heurístico de catálogo.

## 2. Reglas no violadas

- Cap elemental de **30** conservado (modelo stage 10).
- Alineación C4 `!` alineada a C3 (nivel + marcador conservados); las **6
  discrepancias C3** se dejaron intactas.
- **RAW sin modificar**.
- **Spread (Abanico) sin modificar**: multiplicadores, MVs, habilidades,
  valores y compensaciones quedan como están; Spread es el control.
- Sin aprobación A/B, sin multiplicadores elementales nuevos, sin cambios de
  parámetros del juego ni offsets de ROM sin evidencia verificada.

## 3. Correcciones aplicadas a stage 11

### 3.1 `bandFor()` (problema 1)

`tools/summarize-bow-build-comparison.mjs` `bandFor()` reescrita con umbrales
explícitos alineados al convenio stage-10:

| Valor de hitzone elemental | Banda |
|---|---|
| ≥ 25 | favorable |
| 15 – 24 | media |
| < 15 | pobre |

Antes, la primera condición devolvía "favorable" para todo valor < 25 y las
bandas media/pobre nunca se alcanzaban. Prueba con 0, 5, 10, 14, 15, 20, 24,
25, 30, 35 y 100 añadida; pasa.

### 3.2 Clase B: cada perfil con su propio arco (problema 2)

La clase B ya **no** compara los tres perfiles sobre un mismo arco seleccionado.
Ahora, para cada perfil (RAW, Elemental, Híbrido), se:

1. enumeran los arcos del rango solicitado (LR/HR/G) con carga del tipo de
   disparo y **sin marca `!`** (un carga `!` exige la habilidad no ofensiva
   Recargando, que rompe el presupuesto ofensivo igualado);
2. se descartan los arcos que no pueden completar el presupuesto con talismánes
   verificados;
3. los candidatos restantes se evalúan por **daño medio real** sobre la matriz
   de 93 hitzones de monstruos grandes (`meanBuildDamage`), y
4. cada perfil queda con **su propio arco**, el de mayor daño real.

La comparación cruzada (elemental/raw, híbrido/raw, híbrido/elemental) se
realiza con `simulateBuildsAcrossWeapons()` emparellando monstruos y partes
entre builds que pueden usar arcos distintos. La banda elemental se clasifica
de cada build objetivo con su propio `elementHz`/`elementType`.

### 3.3 Presupuesto ofensivo (problema 3)

Definición exacta y aplicada a los tres perfiles: una habilidad es **ofensiva**
si multiplica el daño por disparo o es una habilidad de disparo. Se documenta
por habilidad (`OFFENSIVE_SKILL_REASONS` en `js/bow-build-comparison.js`):

| Habilidad | ¿Ofensiva? | Justificación |
|---|---|---|
| Ataque (Attack) / Atk de tipo | sí | multiplica el daño físico |
| Experto (Expert) | sí | modifica la afinidad de daño físico |
| Tenderizado (Tenderizer) | sí | multiplica el daño por hits |
| Crit Up | sí | multiplica el daño crítico |
| Crit Element | sí | multiplica el daño elemental crítico |
| **Power C+** | **sí** | **multiplica el daño por disparo** (coating y bonus) |
| **Elemental** | **sí** | **multiplica el daño elemental por disparo** |
| Pellet Up / Normal Up / Pierce Up / Heavy Up | sí | habilidad de disparo: más hits por disparo |
| Recargando (Loading), Ahorro de munición | no | no multiplican el daño por disparo |

`isOffensive()` se usa para construir la prioridad ofensiva de cada perfil;
**Power C+** y **Elemental** ya aparecen en la prioridad de RAW/Elemental/Híbrido
y se compten en el presupuesto. Prueba añadida: Power C+ y Elemental son
ofensivos; Recargando y Ahorro de munición no; todas las entradas de prioridad
de los 3 perfiles × 4 tipos de disparo son ofensivas.

### 3.4 Talismánes conservadores y verificados (problema 4)

- **Política por defecto: `conservative`** (talismánes de una habilidad, sin
  asumir dos habilidades simultáneas). Es un build **confirmado legal**.
- **`legal`** (todas las opciones positivas del catálogo, talismánes de una y
  dos habilidades) se ejecutó como control: en Spread G, presupuesto 4, los
  ratios son **idénticos** a la política conservadora.
- **`max`** se mantiene **solo como escenario teórico**; nunca como build legal
  confirmado. El artefacto marca `theoretical: true` para esa política.

**Presupuesto:** con talismánes conservadores el presupuesto **4** es el
máximo común alcanzable en G para Spread; el **5** no completa para ningún
perfil (4/5) y el **6** tampoco. Las comparaciones oficiales usarán presupuesto
**4**, que completan los tres perfiles.

### 3.5 Reproductibilidad (problema 5)

Se generan JSON, CSV y resúmenes (no solo tablas):

- `tools/out/stage11/cmp-{shot}-{rank}-b4.json` — 12 artefactos completos
  (builds, selección del arco, matriz de ratios).
- `tools/out/stage11/summary-{shot}-{rank}-b4.json` — resúmenes
  (ratios por rango, banda y tipo de disparo; victorias).
- `tools/out/stage11/stage11-comparison-ratios.csv` — ratios de las 12
  comparaciones.
- `tools/out/stage11/stage11-comparison-by-band.csv` — ratios por banda
  elemental (favorable/media/pobre).
- `tools/out/stage11/stage11-builds.csv` — builds seleccionados por perfil.
- `tools/out/stage11/bow-element-progression.{json,csv}` — auditoría de
  progresión elemental (problema 7).

### 3.6 Completitud por tipo de disparo y rango (problema 6)

- **Spread, Pierce, Rapid, Heavy**: completadas en **G**, con control de clase
  A para Spread/Pierce y solo clase B para Rapid/Heavy (el arco control no tiene
  carga Rapid ni Heavy).
- **LR y HR**: completadas para los cuatro tipos de disparo una vez validada
  la metodología en G.

### 3.7 Auditoría de progresión elemental (problema 7)

`tools/check-bow-element-progression.mjs` revisa el catálogo tras dejar las 55
líneas terminales elementales en 30:

- **55 finales elementales**, **todos en 30**; los **6 finales Explosión
  (Blast)** quedan aparte y sin cambios.
- **0 inversiones de progresión**: ningún nivel superior lleva menos elemento
  que un nivel inferior del mismo árbol.
- **0 registros por encima del cap 30**; elemento máximo = 30.
- **23 saltos grandes (> 10)** entre niveles consecutivos, todos en árboles
  elementales no-Blast, con **salto máximo 18**: son saltos previos que conectan
  los niveles intermedios con el final a 30. No constituyen una inversión ni un
  exceso de cap; se documentan como finding para la próxima fase de rebalance de
  multiplicadores elementales.

## 4. Método

### 4.1 Optimizador

`js/bow-build-optimizer.js` provee el presupuesto de habilidades activadas,
las políticas de talismán (`max`/`legal`/`conservative`), sin negativas
activas, y pesos por prioridad ofensiva.

### 4.2 Medición de daño

`js/bow-build-damage.js` sobre las **93 hitzones de monstruos grandes**
vendoradas (`tools/data-hitzones.js`), estilo Guild, 200 disparos mision, cap
elemental 30. Clase A usa `simulateBowBuildHitzoneMatrix` (misma arma); clase B
usa `simulateBuildsAcrossWeapons` (cada build con su arma). Ratios reportados
siempre en las dos agregaciones:

- **todas las partes** (`meanRatioAllParts`): cada parte evaluada contribuye.
- **mejor parte por monstruo** (`meanBestPartRatioPerMonster`): cada monstruo
  contribuye con su parte de mejor ratio (favorece al target).

## 5. Resultados

### 5.1 Clase A (control, arco Elizabeth atenta, presupuesto 4, talismánes conservadores)

| Disparo | Elemental / RAW | Híbrido / RAW | Híbrido / Elemental |
|---|---:|---:|---:|
| Spread (todas partes / mejor parte) | 0.931 / 0.950 | 0.931 / 0.950 | 1.000 / 1.000 |
| Pierce (todas partes / mejor parte) | 0.944 / 0.972 | 0.944 / 0.972 | 1.000 / 1.000 |

Rapid y Heavy no tienen clase A (el arco control no dispone de esas cargas).

### 5.2 Clase B — cada perfil con su propio arco (presupuesto 4, talismánes conservadores)

Ratio **todas las partes** (mismo valor para ambos géneros):

| Disparo | Rango | Elemental / RAW | Híbrido / RAW | Híbrido / Elemental |
|---|---|---:|---:|---:|
| Spread | LR | 0.324 | 0.350 | 1.081 |
| Spread | HR | 0.859 | 0.910 | 1.059 |
| Spread | G | 1.009 | 1.094 | 1.084 |
| Pierce | LR | 0.791 | 0.856 | 1.083 |
| Pierce | HR | 0.939 | 0.993 | 1.058 |
| Pierce | G | 0.796 | 0.841 | 1.058 |
| Rapid | LR | 0.810 | 0.879 | 1.086 |
| Rapid | HR | 1.018 | 1.078 | 1.059 |
| Rapid | G | 0.672 | 0.728 | 1.084 |
| Heavy | LR | 0.867 | 0.942 | 1.087 |
| Heavy | HR | 0.935 | 1.016 | 1.087 |
| Heavy | G | 1.101 | 1.197 | 1.087 |

**Interpretación.** El ratio Elemental/RAW depende de la cadencia y del arco
seleccionado: Heavy y Spread favorecen al elemental, mientras Rapid y Pierce —con
más disparos y menor impacto por elemento— lo ponen por debajo del RAW. El ratio
**Híbrido/Elemental se mantiene en 1.06–1.09** en todos los tipos de disparo y
rangos, lo cual es coherente: el híbrido añade daño físico al build elemental.
Los arcos seleccionados por cada perfil se registran en los artefactos
(`selection.evaluated`).

### 5.3 Control con talismánes `legal` (Spread G, presupuesto 4)

Los ratios de clase A y clase B son **idénticos** a los de la política
conservadora; los builds completan 4/4. Esto verifica que la política conservadora
no altera los resultados frente a las opciones verificadas del catálogo.

## 6. Artefactos y re-ejecución

```bash
# Comparación (cada tipo de disparo y rango)
node tools/bow-build-comparison.mjs --shot-type Spread --budget 4 --class both \
  --talisman-policy conservative --bow-rank G \
  --out tools/out/stage11/cmp-spread-g-b4.json

# Resumen + CSV
node tools/summarize-bow-build-comparison.mjs \
  --input tools/out/stage11/cmp-spread-g-b4.json \
  --out tools/out/stage11/summary-spread-g-b4.json
node tools/export-bow-build-comparison-csv.mjs

# Auditoría de progresión elemental
node tools/check-bow-element-progression.mjs
```

Pruebas: `npm test` (100/100).
