# Stage 14 — Sistema de builds especializadas (RAW / elemental)

Fecha: 2026-11-25. Rama: `rework/bow-specialization-stage13`. Base: `main` = `1753a13`.

## 1. Objetivo

Convertir el sistema de builds en uno capaz de diseñar y validar
**especializaciones reales** (RAW físico y elemental) para todas las etapas de
progresión, midiendo el **daño final real**, no solo el número de habilidades
activadas. El perfil **híbrido se retira de los resultados oficiales**.

## 2. Cambios de arquitectura

### 2.1 Perfiles oficiales (sin híbridos)

- `js/bow-build-comparison.js`:
  - `OFFICIAL_PROFILES = ["raw", "elemental"]` — el conjunto oficial.
  - `HYBRID_PROFILE = { id: "hybrid", legacy: true }` — marcado como **legado**,
    fuera del sistema oficial. Se conserva solo por compatibilidad histórica.
  - `runProfileComparison` ahora produce solo perfiles oficiales.
- `tools/bow-build-comparison.mjs`:
  - `runClassB` evaluar solo `raw` y `elemental`.
  - El perfil híbrido solo aparece con `--include-legacy-hybrid` (compatibilidad).
- `js/bow-build-feasibility.js`:
  - Los paquetes `element-hybrid-*` llevan `legacy: true`.

### 2.2 Prioridades y sinergia de habilidades

- **Prioridad elemental**: `[elementSkill, "Crit Element", "Tenderizer",
  "Expert", shotSkill, "Elemental", "Critical Up"]`.
  - `Expert` (Ojo crítico) es una **fuente de afinidad** que alimenta el
    multiplicador de Crítico elemental.
  - `Critical Up` **no** se prioriza en elemental: no mejora el multiplicador
    elemental (la fórmula del juego no lo justifica). Solo valor para el
    componente físico, si corresponde.
- **Prioridad RAW**: `[shotSkill, "Expert", "Tenderizer", "Critical Up",
  "Power C+", "Attack"]` — habilidades físicas y Power C+.

### 2.3 Sinergia Maza + Crítico elemental

El simulador (`js/bow-build-damage.js`, `calculateBowBuildVolley`) ya calcula:

- Afinidad = afinidad del arma + Ojo crítico + **Maza (+50)** cuando el
  **hitzone físico ≥ 45** (no el elemental).
- `elementalCriticalMultiplier(affinity, Crit Element)` — la afinidad (incluida
  la de Maza y Ojo crítico) alimenta el multiplicador crítico elemental.
- Maza no se elimina de las builds elementales.

### 2.4 Coste de Element Coating

- `Elem C+ +15` se exige para desbloquear **Element Coating 2** y se contabiliza
  como coste real en `buildBowSkillRequirements` (no se oculta).
- `Power C+ +15` para **Power Coating 2** en builds RAW.
- Los unlocks de coating son **costes reales**, no cuentan como habilidad ofensiva
  pero sí aparecen en los requisitos y en el gasto de puntos del equipo.

### 2.5 Talismánes con legalidad demostrable

- Política `verified`: un talismán solo se marca `confirmed` cuando el par
  (valor de puntos × espacios) está **probado por una fuente real**.
- El catálogo de puntos (`data/armor/talisman-skills.json`) solo demuestra que
  un **valor de puntos** existe; no demuestra el par con espacios. Así que, sin
  evidencia de par, los talismánes son **candidato no confirmado** (no se
  declaran legales sin evidencia).
- Los talismánes vacíos (sin habilidades) son legales por sí mismos.

### 2.6 Selección por rango y género

- `runProfileComparison` y `optimizeBowBuild` se ejecutan por rango (LR/HR/G)
  y género (masculino/femenino) con piezas de armadura reales, joyas por
  ranura y talismán con política elegida.
- El driver `--element` filtra el perfil elemental a un elemento concreto para
  las matrices oficiales por elemento.

## 3. Verificación (pruebas automatizadas)

`tests/bow-stage14-builds.test.mjs` — **14 pruebas**:

1. Perfiles oficiales son solo RAW y elemental; híbrido marcado legado.
2. Prioridad elemental incluye Ojo crítico como fuente de afinidad; Critical Up
   no se prioriza en elemental.
3. Prioridad RAW mantiene habilidades físicas y Power C+.
4. Maza aporta +50 de afinidad cuando el hitzone físico ≥ 45.
5. La afinidad de Maza alimenta Crítico elemental (daño elemental mayor).
6. Ojo crítico aumenta la afinidad y alimenta Crítico elemental.
7. Maza depende del **hitzone físico**, no del elemental.
8. Element Coating II requiere Elem C+ +15 (coste visible).
9. Power Coating II requiere Power C+ +15 (RAW).
10. Un build RAW conserva el elemento natural de su arco (daño real).
11. Talismán `verified` requiere par evidenciado; sin él, candidato no confirmado.
12. Toda carga C4 con `!` se alinea con el tipo de C3 (regla protegida).
13. El optimizer produce builds legales por rango y género (5 piezas, joyas).
14. `runProfileComparison` solo produce perfiles oficiales (sin híbridos).

Resultados: `node --test tests/bow-stage14-builds.test.mjs` → **14/14**.
Suite completa `npm test` → **132/132**.

## 4. Matriz oficial generada

`tools/bow-build-comparison.mjs` genera las matrices oficiales (JSON en
`tools/out/stage14/`):

- **12 RAW**: 4 tipos de flecha × 3 rangos (LR/HR/G), presupuesto max
  completable por rango (LR/HR = 3, G = 4; Heavy G = 3).
- **20 elementales G**: 5 elementos × 4 tipos de flecha, presupuesto 3, con
  `--element` para restringir el perfil a un elemento concreto.

Los artifacts están en `tools/out/` (gitignored) y se publican como artefactos
de GitHub Actions (`bow-specialization.yml`, job `stage14-official-matrices`).

## 5. Lo que NO se modificó

- `CHARGE_RAW`, `CHARGE_ELEMENT`, `SHOT_MVS`, `SHOT_TYPE_UP`, fórmulas de
  crítico/elemental, valores de coatings.
- C1–C4, RAW, Spread (Abanico), motion values, elementos naturales.
- `data/weapons/bow.json` — sin cambios (el rebalance llega en Stage 15).

## 6. Entregables

| Archivo | Contenido |
|---------|-----------|
| `js/bow-build-comparison.js` | Perfiles oficiales, prioridades, sinergia |
| `js/bow-build-feasibility.js` | Paquetes híbridos marcados legado |
| `tools/bow-build-comparison.mjs` | Driver oficial (sin híbridos; `--element`, `--include-legacy-hybrid`) |
| `tests/bow-stage14-builds.test.mjs` | 14 pruebas del sistema de builds |
| `docs/BOW_STAGE14_BUILD_SYSTEM.md` | Este informe |
| `.github/workflows/bow-specialization.yml` | CI con matrices oficiales |
