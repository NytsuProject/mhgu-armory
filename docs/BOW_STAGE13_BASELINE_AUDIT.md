# Stage 13 — Auditoría base y matriz de cobertura de especialización RAW / elemental

Fecha: 2026-11-25. Rama: `rework/bow-specialization-stage13` (base `main` = `1753a13`).

## 1. Objetivo de esta etapa

Reconstruir la base de datos de arcos sin tocar estadísticas definitivas y establecer
una matriz oficial de **72 objetivos** de especialización:

- **RAW**: 4 tipos de flecha (Rapid, Pierce, Spread, Heavy) × 3 rangos (LR, HR, G) = **12 objetivos**.
- **Elemental**: 5 elementos (Fire, Water, Thunder, Ice, Dragon) × 4 tipos de flecha × 3 rangos = **60 objetivos**.

La cobertura significa que existe una **opción competitiva** para esa función, no solo
un registro en el catálogo. Esta etapa solo reconstruye y mide la base; la optimización
de builds y el rebalance de catálogo llegan en etapas posteriores.

## 2. Estado de `main`

- `main` = `1753a13` («Merge branch 'arena/a0c027dc-mhgu-armory'»).
- Contiene el trabajo Stage 10–12 integrado: tope de elemento natural 30,
  normalización C4 de Recargando, comparación C3/C4, sweep de multiplicadores,
  tests Stage 12 y workflow `bow-stage12.yml`.
- Suite de pruebas: **109/109** al inicio de la etapa; **118/118** tras añadir las
  pruebas de esta etapa.

## 3. Reconstrucción del catálogo

Fuente: `data/weapons/bow.json` (107 árboles, 735 registros de nivel). Herramienta:
`tools/bow-specialization-audit.mjs` (read-only). Reutiliza `parseCharge`,
`rankFromRarity`, `normalizeLoadUpCharge` y `ELEMENTAL_TYPES` de `js/bow-branch-audit.js`.

Topología:

- **107 líneas** reconstruidas (59 raíces sin padre, 48 ramas con padre).
- **735 registros de nivel** únicos.
- Líneas por rango de aparición: **LR 42, HR 37, G 28**.
- **21 líneas** tienen progresión multi-rango en el mismo camino (LR→HR),
  identificadas por `js/bow-branch-audit.js` (`progressionRankCounts`).
- **55 terminales elementales** (elemento natural ≥ 20) y **52 terminales RAW**.

Datos registrados por nivel y línea (ver `tools/out/stage13/bow-specialization-lines.{json,csv}`):

- Árbol de origen, rama (padre), nivel local, rango y rareza.
- RAW, afinidad, ranuras.
- Elemento natural (tipo y valor) y rol inferido (raw / elemental).
- Revestimientos (Power, Element, Exhaust, estado, Blast…).
- Las 4 cargas (C1–C4) crudas y normalizadas, tipos de flecha por carga y
  tipos de flecha principales (C3/C4).
- Estado terminal de la línea y progresión de rangos.

## 4. Matriz de cobertura (72 objetivos)

Herramienta: `tools/bow-specialization-audit.mjs`.
Salida: `tools/out/stage13/bow-specialization-coverage.{json,csv}`.

Definiciones (explicitas, sin umbrales arbitrarios):

- **Cobertura estructural**: existe al menos un nivel del catálogo en ese rango con
  ese tipo de flecha (y elemento natural ≥ 20 para los elementales).
- **Cobertura terminal**: existe al menos un nivel final de línea en ese rango con ese
  tipo de flecha **entre las cargas principales C3/C4 normalizadas**
  (regla de Recargando) y elemento natural ≥ 20.

### 4.1 Objetivos RAW (12)

**Cobertura estructural: 12/12.** Cada combinación rango × tipo de flecha tiene al
menos un nivel del catálogo. RAW no tiene objetivos sin cobertura estructural.
La cobertura terminal RAW se documentará en Stage 16 con builds reales.

### 4.2 Objetivos elementales (60)

- **6 combinaciones sin cobertura estructural** (no existe ningún nivel en ese rango
  con ese elemento y tipo de flecha):

| Rango | Elemento | Flecha |
|-------|----------|--------|
| LR | Water | Heavy |
| LR | Thunder | Heavy |
| HR | Fire | Heavy |
| HR | Thunder | Spread |
| G | Ice | Spread |
| G | Dragon | Heavy |

- **19 combinaciones sin cobertura terminal** (no existe nivel final de línea en ese
  rango con ese elemento ≥ 20 y ese tipo de flecha entre C3/C4 normalizadas):

| Rango | Elemento | Flecha |
|-------|----------|--------|
| LR | Water | Heavy |
| LR | Thunder | Heavy |
| LR | Ice | Spread |
| LR | Ice | Heavy |
| HR | Fire | Rapid |
| HR | Fire | Heavy |
| HR | Water | Heavy |
| HR | Thunder | Rapid |
| HR | Thunder | Spread |
| G | Fire | Rapid |
| G | Water | Rapid |
| G | Water | Pierce |
| G | Thunder | Spread |
| G | Thunder | Heavy |
| G | Ice | Rapid |
| G | Ice | Spread |
| G | Ice | Heavy |
| G | Dragon | Pierce |
| G | Dragon | Heavy |

**Nota metodológica:** el objetivo inicial mencionaba 21 combinaciones sin cobertura
terminal. Con la definición rigurosa documentada arriba el conteo es **19**; los
desajustes entre 19 y 21 dependen de si se cuentan cargas C2/C4 sin Recargando o
simplificaciones de carga. Se registra el conteo real y verificable (19) y no se
inventa un número. Los 6 objetivos sin cobertura estructural son un subconjunto
de los 19 sin cobertura terminal y son los candidatos prioritarios a resolver en
Stage 15 (rebalance del catálogo).

## 5. Candidatas a re-especialización

`tools/out/stage13/bow-specialization-candidates.json` — **43 candidatas**, con las
señales detectadas:

- `elemento_natural_sin_coating_elemental`: terminal elemental (≥20) sin Element
  Coating nativo (necesitaría `Elem C+` o rebalance).
- `elemento_natural_en_linea_raw`: elemento natural alto en una línea cuyo rol
  predominante es RAW (identidad dudosa).
- `raw_con_power_coating2`: terminal RAW con Power Coating 2 (identidad RAW clara,
  sirve como referencia de RAW especializado).

Esta lista es la base para Stage 15; no implica que las armas ya estén modificadas.

## 6. Limitaciones del simulador actual

Documentadas en `js/bow-build-damage.js` (`assumptions`) y `js/bow-balance-sim.js`:

1. **Impactos asignados a una misma parte**: cada descarga teórica se asigna a la
   misma parte del monstruo. No reproduce el recorrido de Pierce ni la distribución
   de perdigones de Spread.
2. **Primera tabla de hitzones**: solo se usa `monster.tables[0]`.
3. **Capacidad de coating**: pilas de 70 Power Coat / 30 Element Coat, sin reabastecimiento.
4. **Ammo Saver no se cuenta**: su probabilidad de devolución no está verificada.
5. **Coste de transición híbrida**: expresado en oportunidades de disparo perdidas,
   no en frames medidos.
6. **Sin bonificación Close Range de Seregios** en esta etapa.

**Mejora pendiente (Stage 16):** escenarios explícitos (conservador, medio, favorable)
para Pierce y Spread en lugar de un único escenario teórico. No se inventarán
porcentajes de impacto; se generarán escenarios distintos y se etiquetarán claramente.

## 7. Reglas de carga auditadas

- C4 con `!` (Recargando): su tipo de disparo se alinea con C3 (normalización
  `match-c3` aplicada en toda la auditoría). Nivel de C4 y marca `!` conservados.
- **6 registros** con C3 marcado `!` que no se tocan con la regla (el estado actual
  del catálogo deja esos C3 como están; se documenta, no se oculta).
- Recargando +10 es un coste real del equipo, no una habilidad ofensiva.

## 8. Constantes y mecánicas protegidas (no tocadas en esta etapa)

- `CHARGE_RAW = [0.4, 1.0, 1.5, 1.7]`
- `CHARGE_ELEMENT = [0.70, 0.85, 1.0, 1.125]`
- `SHOT_MVS`, `SHOT_TYPE_UP`, fórmulas de crítico y elemental, valores de coatings.
- Tope de elemento natural 30 (referencia inicial, a estudiar en Stage 17).
- Abanico (Spread): conservado en objetivos de cobertura con sus MVs.

## 9. Articulaciones y decisiones para etapas posteriores

- **Stage 14** (optimización de builds): retirar perfiles híbridos de resultados
  oficiales, corregir prioridades/costes, mantener Maza + Crítico elemental,
  añadir Ojo crítico como candidata de afinidad, corregir el coste de Element Coating,
  talismanes solo con legalidad demostrada.
- **Stage 15** (rebalance del catálogo): priorizar los 6 objetivos sin cobertura
  estructural y los 19 sin cobertura terminal; proponer cambios de RAW y elemento
  natural con evidencia de simulación.
- **Stage 16** (validación): reejecutar los 72 objetivos y los 93 monstruos.
- **Stage 17** (multiplicadores): solo tras validar armas y builds.

## 10. Entregables de esta etapa

| Archivo | Contenido |
|---------|-----------|
| `tools/bow-specialization-audit.mjs` | Auditoría base y matriz de cobertura |
| `tests/bow-stage13-audit.test.mjs` | 9 pruebas (líneas, 72 objetivos, cobertura, no híbridos) |
| `tools/out/stage13/bow-specialization-lines.{json,csv}` | Inventario de 107 líneas |
| `tools/out/stage13/bow-specialization-coverage.{json,csv}` | Matriz de 72 objetivos |
| `tools/out/stage13/bow-specialization-uncovered.json` | Combinaciones sin cobertura |
| `tools/out/stage13/bow-specialization-candidates.json` | 43 candidatas a especialización |
| `.github/workflows/bow-specialization.yml` | CI: push a main, PR a main, workflow_dispatch |
| `docs/BOW_STAGE13_BASELINE_AUDIT.md` | Este informe |

## 11. Estado de las pruebas

- `node --test tests/bow-stage13-audit.test.mjs` → **9/9**.
- `npm test` (suite completa) → **118/118**.

No se ha modificado `data/weapons/bow.json` ni ninguna constante de balance en
esta etapa.
