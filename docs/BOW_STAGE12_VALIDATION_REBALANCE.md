# Validación final de builds y rebalance de multiplicadores elementales (Stage 12)

**Fecha:** 2026-11-26
**Rama:** `arena/a0c027dc-mhgu-armory`
**Estado:** correcciones de stage-11 aplicadas y re-probadas; comparación C3/C4
corregida; barrido de sensibilidad corregido (multiplicador por carga en la
secuencia); propuesta; 109/109 pruebas pasan; CI con artefactos. **No hay merge a
`main`**. Los datos definitivos de multiplicadores **no se modifican**.

## 1. Objetivo

Validar finalmente los builds de arco elementales y estudiar el rebalance de los
**multiplicadores elementales de las cargas** (C1–C4), sin inflar artificialmente
los valores elementales base. Objetivo de diseño: ≈**+10% de daño elemental en
hitzones favorables**, paridad o ligera ventaja en medias, mantener ventaja RAW
en pobres. **No aprobar automáticamente** escenarios que no alcancen el objetivo.

## 2. Reglas no violadas (conservación)

- **RAW sin modificar**; MVs físicos y multiplicadores específicos de Spread sin tocar.
- **Spread (Abanico) es el control**: sus multiplicadores/MVs/habilidades/compensaciones
  no se modifican. Su efecto se muestra **separadamente**.
- **Pellet Up** y compensaciones propias de Spread sin modificar.
- Cap elemental natural **30** conservado.
- Alineación C4 `!` a C3 (misma flecha, nivel y marcador); **6 excepciones C3** intactas.
- **Loading/Recargando = utilidad**: requisito obligatorio, **no consume presupuesto
  ofensivo**; su coste adicional se contabiliza en espacios/habilidades/build.
- **No se modifican datos definitivos** de multiplicadores, RAW, Abanico, MVs ni
  elementos naturales. Sin cambios de ROM sin evidencia verificada.

## 3. Correcciones de Stage 11 (A) — aplicadas y re-probadas

| # | Corrección | Estado |
|---|---|---|
| A1 | Clase B pasa `bowRank` al optimizador; 12 matrices con armaduras del rango. | ✅ |
| A2 | Selección de arcos en dos etapas: todos los candidatos elegibles (incluido `!`), shortlist de 16, clasificados por daño real. | ✅ |
| A3 | Builds incompletos llevan `comparable`; se excluyen de ratios oficiales. | ✅ |
| A4 | `offensiveSkillsActivated()` verifica **todas** `OFFENSIVE_SKILL_REASONS`; la prioridad solo ordena. | ✅ corregido |
| A5 | Talismanes `verified`: solo habilidad única; el par (puntos × espacios) se marca **candidato no confirmado** cuando el catálogo solo demuestra el valor de puntos. | ✅ corregido |

Presupuesto ofensivo máximo **completable legalmente**: LR/HR=3, G=4.

## 4. Comparación C3/C4 con Recargando (B) — corregida

`tools/bow-c4-comparison.mjs`. **Corrección:** el ratio C4/C3 se recalcula sobre
**todas las partes coincidentes** de los 93 monstruos (no `rows[0]`), con
promedio de daño elemental, promedio de daño total y victorias por monstruo.
Presupuesto = máximo donde el **C3** completa (baseline controlado).

**Resultado: 3/12 C4 completables.** C4/C3 = **1.125** (ratio exacto de carga
C4/C3 = 1.125/1.00), constante porque el arco y la build ofensiva son idénticos
y solo cambia la carga.

| Disparo | Rango | Pres. | Arco (elemento) | meanElem C3 | meanElem C4 | meanTotal C3 | meanTotal C4 | C4/C3 | victorias monstruo |
|---|---|---|---|---|---|---|---|---|---|
| Rapid | HR | 3 | Anomalía absoluta (Agua) | 2.899 | 3.262 | 88.94 | 100.78 | **1.125** | 73/93 |
| Rapid | G | 4 | Orcus Sagittus (Rayo) | 3.045 | 3.425 | 94.83 | 112.40 | **1.125** | 83/93 |
| Heavy | G | 3 | Firmamento lejano (Agua) | 0.725 | 0.815 | 82.67 | 93.69 | **1.125** | 73/93 |

- **9/12 C4 incompletos** (Recargando consume espacio): `c4Comparable=false`.
- **Selección C4:** es una **selección representativa** (mejor arco elemental del
  rango con carga `!`C4, por puntuación analítica RAW+elemento + shortlist de
  completabilidad). **No** es un porcentaje de viabilidad de todos los arcos C4.

## 5. Matriz de sensibilidad de multiplicadores (C) — corregida

`tools/bow-elemental-multiplier-sweep.mjs`. **Corrección:** no se escala el
elemento agregado con una sola cifra. Se **re-ejecuta la simulación de daño con
`chargeElementMultipliers`** (array de 4), de modo que cada carga de la secuencia
Guild aplica su propio multiplicador. Barrido un multiplicador a la vez
(0.70–1.50 × C1–C4) sobre **23 artefactos** (12 clase B + 11 C1 progresión), 93
monstruos, desglosado por LR/HR/G, 5 elementos, 4 tipos, bandas favorable/media/
pobre.

**Banda media exige [1.00, 1.08]; pobre ≤ 0.95.**

**Hallazgo:** el objetivo +10% favorable **se alcanza en algunos segmentos**
(Pierce G favorable=1.148, Pierce HR=1.061, Pierce LR=0.952 a m=1.5), pero **no
en todos**. Los multiplicadores son un mecanismo parcial.

Propuesta (m más cercano al objetivo, sujeto a ventanas):

| Carga | Base | Propuesta | Favorable medio | Estado |
|---|---|---|---|---|
| C1 | 0.70 | **1.50** | 0.870 | Objetivo NO alcanzado; m válido más cercano (evidencia C1 progresión) |
| C2 | 0.85 | **1.50** | 0.748 | Objetivo NO alcanzado; m válido más cercano |
| C3 | 1.00 | **1.50** | 0.859 | Objetivo NO alcanzado; m válido más cercano |
| C4 | 1.125 | **1.50** | 0.868 | Objetivo NO alcanzado; m válido más cercano |

**C1 se estudia con progresión temprana** (arcos con carga C1, `--preferred-charge-slot
1`): ya no se concluye "sin evidencia", sino que hay ratios C1 reales. Aun así,
m=1.5 no alcanza 1.10 en el promedio favorable.

**No aprobación automática:** la propuesta es el límite superior válido; no
cumple el objetivo en la mayoría de segmentos y **no se aprueba como solución
completa**. Recomendación: entrar por el valor elemental base/MVs o revisar el
objetivo. Datos definitivos sin modificar.

## 6. Criterios aclarados (feedback punto 6)

- **Selección de arco por género:** el driver construye builds masculino y
  femenino por perfil; los ratios se reportan por género.
- **Referencia RAW:** el perfil **RAW** se refiere a builds de **daño físico**;
  admite arcos con elemento natural (el elemento no se usa en el perfil RAW),
  pero la referencia es el daño físico del arco, no su elemento.
- **Desglose por elemento:** `multiplier-sensitivity-by-element.csv` separa
  Fuego/Agua/Rayo/Hielo/Dragón.
- **C1:** progresión temprana con arcos de carga C1 (sec 5).

## 7. Entregables

1. **Stage 11 corregida** para los tres rangos. ✅
2. **Comparación C3/C4 con Recargando** corregida. ✅
3. **Matriz de sensibilidad** corregida. ✅
4. **Propuesta C1–C4** con razones y efectos. ✅
5. **Builds y CSV/JSON** (`tools/out/stage12/`), publicados como **artefactos de
   CI** (`.github/workflows/bow-stage12.yml`). ✅
6. **Informe Stage 12.** ✅

## 8. Pruebas y CI

- **109/109** pruebas pasan (`npm test`), incluida `tests/bow-stage12-validation.test.mjs`
  (C4/C3 multi-parte, independencia de los 4 multiplicadores, Loading obligatorio,
  conservación RAW/Spread, `offensiveSkillsActivated`).
- **CI:** workflow `bow-stage12.yml` se activa en `pull_request` a `main` **y** a
  `balance/bow-elemental-stage5`, y en push a la rama. Genera los 23 artifacts,
  corre el sweep y sube JSON/CSV como artefacto.

## 9. Limitaciones

- Presupuesto ofensivo máximo completable: LR/HR=3, G=4.
- C4 `!` frecuentemente incompleto (3/12); comparación controlada solo donde
  completa.
- Sweep de **un multiplicador a la vez**; combinaciones óptimas no se exploran
  exhaustivamente.
- Objetivo +10% favorable no alcanzable en todos los segmentos por este mecanismo.
- Talismanes `verified`: el par (puntos × espacios) es **candidato no confirmado**
  (el catálogo solo demuestra el valor de puntos).

## 10. Reproducción

```bash
# 12 matrices clase B (LR/HR=3, G=4)
node tools/bow-build-comparison.mjs --shot-type <shot> --budget <3|4> --class b \
  --talisman-policy verified --bow-rank <LR|HR|G> --selection-limit 16 \
  --out tools/out/stage12/cmp-<shot>-<rank>-b4.json

# C1 progresión
node tools/bow-build-comparison.mjs --shot-type <shot> --budget <2|3> --class b \
  --talisman-policy verified --bow-rank <LR|HR|G> --selection-limit 16 \
  --preferred-charge-slot 1 --out tools/out/stage12/cmp-<shot>-<rank>-c1-b4.json

node tools/bow-c4-comparison.mjs --budget 4 --ranks LR,HR,G
node tools/bow-elemental-multiplier-sweep.mjs
node tools/aggregate-stage12.mjs
npm test
```
