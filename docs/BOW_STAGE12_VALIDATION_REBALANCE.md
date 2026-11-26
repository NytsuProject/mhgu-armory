# Validación final de builds y rebalance de multiplicadores elementales (Stage 12)

**Fecha:** 2026-11-26
**Rama:** `arena/a0c027dc-mhgu-armory`
**Estado:** correcciones de stage-11 aplicadas y re-probadas; comparación C3/C4 con
Recargando; matriz de sensibilidad de multiplicadores; propuesta concreta;
100/100 pruebas pasan. **No hay merge a `main`**. Los datos definitivos de
multiplicadores **no se modifican**: se presenta sensibilidad y justificación.

## 1. Objetivo

Validar finalmente los builds de arco elementales y estudiar el rebalance de los
**multiplicadores elementales de las cargas** (C1–C4), sin inflar artificialmente
los valores elementales base. El objetivo de diseño era ≈**+10% de daño
elemental en hitzones favorables**, paridad o ligera ventaja en medias, y
mantener la ventaja RAW en pobres.

## 2. Reglas no violadas (conservación)

- **RAW sin modificar**; MVs físicos y multiplicadores específicos de Spread
  sin tocar.
- **Spread (Abanico) es el control**: sus multiplicadores/MVs/habilidades/
  compensaciones no se modifican. Todo efecto de un multiplicador elemental global
  sobre Spread se muestra **separadamente**.
- **Pellet Up** y compensaciones propias de Spread sin modificar.
- Cap elemental natural **30** conservado.
- Alineación C4 `!` a C3 (misma flecha, nivel y marcador); las **6 excepciones C3**
  intactas.
- **Loading/Recargando = utilidad**: requisito obligatorio cuando el arma lo
  necesita, **no consume puestos del presupuesto ofensivo**; su coste adicional se
  contabiliza en espacios/habilidades/build.
- **No se modifican los datos definitivos de multiplicadores** hasta presentar la
  sensibilidad y justificar la elección. Sin cambios de valores/offsets de ROM sin
  localizar y verificar los parámetros originales del juego.

## 3. Correcciones indispensables de Stage 11 (A) — aplicadas y re-probadas

| # | Corrección | Estado |
|---|---|---|
| A1 | Clase B pasa `bowRank` (LR/HR/G) al optimizador; se repiten las 12 matrices con armaduras del rango correspondiente. | ✅ |
| A2 | Selección de arcos ampliada: se declara una **búsqueda en dos etapas** — `screeningContext()` + `screeningScore()` evaluan **todos** los arcos elegibles (incluidas cargas `!`/C4); shortlist de `--selection-limit` (16) probing de completabilidad; luego se clasifica por **daño real** de la matriz. | ✅ |
| A3 | Una build incompleta **no participa silenciosamente** en ratios oficiales: cada build lleva `comparable` y se excluye de las ratios. | ✅ |
| A4 | Todas las habilidades ofensivas realmente activadas por las 5 piezas, talismán y decoraciones se verifican con `offensiveSkillsActivated()`, no solo `budgetedRequirements`. | ✅ |
| A5 | Política de talismanes `verified`: solo talismánes de una habilidad, con valores de puntos presentes en el catálogo. No se declara legal una combinación sin evidencia. | ✅ |

Presupuesto ofensivo: **LR/HR = 3, G = 4** (el máximo común **completable**
legalmente con talismánes verificados en cada rango; budget 5/6 no se alcanza
legalmente, ver stage 11). Cada build lista las ofensivas activadas
(ej. RAW: Pellet Up, Expert, Tenderizer, Critical Up; Elemental: <Element> Atk,
Crit Element, Tenderizer, Pellet Up).

## 4. Comparación real C3/C4 con Recargando (B)

`tools/bow-c4-comparison.mjs`. Para cada (disparo, rango) se selecciona el mejor
arco elemental de ese rango con carga C4 `!`; se construye **C3 y C4 sobre el
mismo arco y mismo presupuesto**, con Recargando como requisito de utilidad. El
presupuesto usado es el **máximo donde el C3 completa** (baseline controlado); el
C4 se evalúa al mismo presupuesto.

**Resultado: solo 3 de 12 combinaciones alcanzan C4 completable.** Recargando
consume espacios/habilidades, y en la mayoría de los rangos/disparos el C4 `!`
queda **incompleto** a cualquier presupuesto legal (no comparable).

| Disparo | Rango | Pres. | Arco (elemento) | C3 elem/RAW | C4 elem/RAW | C4/C3 | Loading |
|---|---|---|---|---|---|---|---|
| Rapid | HR | 3 | Anomalía absoluta (Agua) | 0.831 | 0.830 | **1.133** | sí |
| Rapid | G | 4 | Orcus Sagittus (Rayo) | 0.855 | 0.854 | **1.186** | sí |
| Heavy | G | 3 | Firmamento lejano (Agua) | 0.801 | 0.801 | **1.133** | sí |

- **Cuando el C4 es completable, el daño elemental crece**: Rapid G **+18.6%**,
  Heavy G / Rapid HR **+13.3%** sobre el C3 del mismo arco.
- **C3 como referencia controlada**: el ratio elem/RAW del C3 es estable
  (≈0.80–0.86 en los G/HR donde completa), y el C4 lo mantiene casi igual porque
  el arco y la build ofensiva son idénticos — solo cambia la carga.
- **9 de 12 C4 incompletos**: el cost de Recargando deja la build ofensiva
  incompleta; se registran como `c4Comparable=false` con nota, **sin** que
  invaliden la comparación controlada del mismo arco.

## 5. Matriz de sensibilidad de multiplicadores (C)

`tools/bow-elemental-multiplier-sweep.mjs`. Se barre un **multiplicador a la vez**
(0.70–1.50, paso 0.05) × C1–C4 sobre los **12 artefactos de clase B**, usando los
93 monstruos/hitzones fijos, desglosado por LR/HR/G, los 5 elementos, Rapid/
Pierce/Spread/Heavy, bandas favorable/media/pobre y RAW/Elemental/Híbrido con
presupuesto ofensivo equivalente.

**Hallazgo principal — objetivo NO alcanzado con multiplicadores solos:**
incluso al máximo de la rejilla (**m=1.50** en C2/C3/C4), la ratio
elemental/RAW en bandas **favorables** no alcanza **1.10**. La barrera es el
valor elemental base y los motion values, no solo el multiplicador de carga.

Ratio elemental/RAW por segmento con los multiplicadores actuales (base) y con la
propuesta (m=1.50 en C2/C3/C4):

| Segmento | Pres. | ratio base | ratio propuesta | venc/mont |
|---|---|---|---|---|
| Spread G | 4 | 0.854 | 0.900 | 4/93 |
| Pierce G | 4 | 0.796 | 0.924 | 15/93 |
| Pierce HR | 3 | 0.833 | 0.934 | 6/93 |
| Pierce LR | 3 | 0.751 | 0.880 | 7/93 |
| Rapid G | 4 | 0.779 | 0.856 | 4/93 |
| Rapid HR | 3 | 0.698 | 0.853 | 4/93 |
| Rapid LR | 3 | 0.668 | 0.846 | 4/93 |
| Heavy G | 3 | 0.690 | 0.712 | 0/93 |
| Heavy HR | 3 | 0.801 | 0.822 | 0/93 |
| Heavy LR | 3 | 0.523 | 0.620 | 0/93 |
| Spread HR | 3 | 0.565 | 0.712 | 3/93 |
| Spread LR | 3 | 0.633 | 0.723 | 0/93 |

- **Aumentar los multiplicadores eleva el ratio favorable y híbrido**, pero
  **no lo lleva a 1.10**; el objetivo se queda corto en todos los segmentos.
- **Sin optimizar solo el promedio**: se presentan victorias por parte y por
  monstruo. Pierce G es donde más crece el elemento (15/93 victorias a propuesta).
- **Separando Spread**: Spread G (control) sube de 0.854 a 0.900; su efecto se
  muestra aparte y no se usa para justificar cambios globales.

## 6. Propuesta concreta de valores C1/C2/C3/C4 (D)

Selección por carga: para cada Ck se consideran solo los segmentos cuyo build
elemental **usa esa carga**; un m es válido si mantiene la ratio pobre ≤ 0.95 y
la media ≤ 1.08. Se elige el m **más cercano al objetivo +10%** (no el máximo
sin límite).

| Carga | Base | Propuesta | Favorable medio | Distancia al 1.10 | Estado |
|---|---|---|---|---|---|
| C1 | 0.70 | **0.70** | n/a | n/a | Sin builds elementales que usen C1: sin evidencia de sensibilidad. |
| C2 | 0.85 | **1.50** | 0.620 | 0.480 | Objetivo NO alcanzado; m válido más cercano. |
| C3 | 1.00 | **1.50** | 0.819 | 0.281 | Objetivo NO alcanzado; m válido más cercano. |
| C4 | 1.125 | **1.50** | 0.871 | 0.229 | Objetivo NO alcanzado; m válido más cercano. |

**Conclusión y recomendación:** el objetivo de diseño (+10% favorable) **no se
alcanza ajustando solo los multiplicadores elementales de las cargas**. La
proposicion presentada (máximo válido = 1.50 en C2/C3/C4, C1 sin cambio) es el
límite superior de lo que este mecanismo puede aportar, y **no debe aprobarse
como solución completa**: eleva el elemento pero no cumple el objetivo, y su
efecto sobre Spread se muestra separado. Se recomienda **no modificar los
datos definitivos** en esta etapa; el rebalance necesita entrar por el valor
elemental base / motion values (fuera del scope de multiplicadores de carga) o
revisar el objetivo de diseño.

**Efectos secundarios de la propuesta (m=1.50):**
- Los ratios favorables suben ≈+0.05 a +0.14 por segmento, pero **ninguno llega
  a 1.10**.
- La ventaja RAW en bandas pobres se mantiene (ratio pobre ≤ 0.95 en todos los
  segmentos, cumpliendo la restricción).
- Pierce G/HR son los más beneficiados; Heavy LR el menos (ratio pobre ~0.52,
  máximo de la rejilla apenas mueve la media favorable).

## 7. Entregables

1. **Stage 11 corregida y probada** para los tres rangos: `tools/bow-build-comparison.mjs`
   reescrita; 12 matrices LR/HR/G con `--bow-rank`. ✅
2. **Comparación real C3/C4 con Recargando**: `tools/bow-c4-comparison.mjs`. ✅
3. **Matriz de sensibilidad de multiplicadores**: `tools/bow-elemental-multiplier-sweep.mjs`
   + `tools/out/stage12/multiplier-sensitivity.{json,csv}`. ✅
4. **Propuesta concreta C1/C2/C3/C4 con razones y efectos**: sección 6. ✅
5. **Builds y CSV/JSON reproducibles, artefactos**:
   - `tools/out/stage12/cmp-<shot>-<rank>-b4.json` (12 builds completos).
   - `tools/out/stage12/c4-comparison.{json,csv}`.
   - `tools/out/stage12/multiplier-sensitivity.{json,csv}`.
   - `tools/out/stage12/stage12-{summary.json,ratios.csv,c4.csv}`. ✅
6. **Informe Stage 12**: este documento. ✅

## 8. Pruebas y limitaciones

- `npm test` → **100/100 pasan**.
- Limitaciones:
  - El presupuesto ofensivo máximo **completable legalmente** es LR/HR=3, G=4;
    no se alcanza budget 5/6 con talismánes verificados.
  - **C4 `!` es frequently incompleto**: solo 3/12 completables; la comparación
    C3/C4 controlada solo existe donde el C3 completa y el C4 no se ve afectado
    por espacio.
  - El sweep de multiplicadores **varía un multiplicador a la vez**; combinaciones
    óptimas de varios multiplicadores a la vez no se exploran exhaustivamente.
  - **C1 no tiene builds elementales observables** en la muestra: su valor no se
    justifica por esta evidencia.
  - El objetivo +10% favorable **no es alcanzable** con este mecanismo; se
    reporta como limitación del modelo, no como fallo del barrido.
  - **No se modifican datos definitivos**; la propuesta no se aplica a `bow.json`.

## 9. Reproducción

```bash
# 12 matrices clase B (presupuesto por rango: LR/HR=3, G=4)
node tools/bow-build-comparison.mjs --shot-type <Spread|Pierce|Rapid|Heavy> \
  --budget <3|4> --class b --talisman-policy verified \
  --bow-rank <LR|HR|G> --selection-limit 16 \
  --out tools/out/stage12/cmp-<shot>-<rank>-b4.json

# Comparación C3/C4 con Recargando
node tools/bow-c4-comparison.mjs --budget 4 --ranks LR,HR,G

# Sensibilidad de multiplicadores
node tools/bow-elemental-multiplier-sweep.mjs

# Agregado / CSVs
node tools/aggregate-stage12.mjs

# Pruebas
npm test
```
