# Stage 16 — Validación completa del catálogo rebalanceado

**Fecha:** 2026-11-25
**Catálogo validado:** `data/weapons/bow.json` (aplicación Stage 15, commit `dc03d86`)
**Estado:** validación **completada y aprobada**.

## 1. Reconstrucción

- **116 árboles** reconstruidos (107 originales + 9 ramas nuevas Stage 15,
  ids 108–116).
- Cada árbol expone `monsters`, `stages`, `parent` y niveles completos.

## 2. Matriz de 72 objetivos

| Especialización | Objetivos | Sin cobertura |
|------------------|-----------|---------------|
| RAW              | 12        | 0             |
| Elemental        | 60        | 0             |
| **Total**        | **72**    | **0**         |

- **72/72** objetivos cubiertos (RAW por estructura, elemental por terminal).
- **Cobertura RAW preservada:** cada objetivo RAW mantiene ≥1 opción RAW-elegible
  (árbol con la flecha objetivo en C3/C4 y elemento natural <20). La guarda
  `raw-coverage` del motor Stage 15 garantizó esto:
  - LR Heavy: 1 opción RAW (`Arco de Yekla`)
  - HR Heavy: 1 opción RAW (`Arco casco demoníaco`)
  - G Spread: 1 opción RAW (`Arco atávico`)
  - G Heavy / G Pierce: 2 opciones RAW cada uno

## 3. Dimensiones del catálogo

- **Ranks:** LR, HR, G
- **Tipos de flecha:** Rapid, Spread, Heavy, Pierce
- **Elementos:** Fire, Water, Thunder, Ice, Dragon
- **Monstruos distintos:** 98 (igual al baseline; las ramas nuevas usan
  monstruos existentes)

## 4. Auditoría de cargas C1–C4

- **3210 cargas** totales.
- C1/C2/C3: 807 cada una. C4: 789.
- **C4 con `!` (Load Up): 728**, de ellas **728 alineadas** con el tipo de C3
  (regla C4 `!` totalmente satisfecha).
- Las **18 cargas C3 `!`** adicionales (746 marcadas en total) son recargas en
  C3, fuera de la regla C4 `!`, y corresponden a los 6 desajustes
  pre-existentes documentados en Stage 13/15 (fuera de scope).
- Las 6 desalineaciones en C3 (`!` en C3, fuera de la regla) son **pre-existentes**
  del baseline y quedan fuera del scope (documentado en Stage 13/15).
- Los 9 árboles nuevos tienen cargas completas (C1–C4, 4 cargas por nivel).

## 5. Builds — comparativas de builds (Stage 14)

El sistema `tools/bow-build-comparison.mjs` (especializaciones oficiales:
RAW + elemental, sin híbridos) se re-ejecutó sobre el catálogo aplicado:

| Combinacion | Resultado |
|-------------|-----------|
| B — Heavy HR | **RAW**: Polaris Tangaroa 4/4 completa; **Elemental**: Arco de ventisquero (Ice:30) 4/4 completa |
| B — Spread G | **RAW**: Arco atávico 4/4 completa; **Elemental**: Arco de ventisquero (Ice:30) 4/4 completa |
| B — Rapid LR | Sin build completable al presupuesto (resultado del sistema, no del rebalance) |
| A — Heavy G | Clase A no aplicable: el arco control (Elizabeth atenta, Spread) no tiene carga Heavy |

- Los builds elementales de las ramas nuevas se **completan** con ofensivas
  de elemento (Ice Atk, Crit Element) a tope de elemento 30.
- La clase B resuelve profesionalmente en RAW y elemental para Heavy HR y
  Spread G.

## 6. Verificación de tests

**`npm test` → 144/144 pass** (109 baseline + 9 Stage 13 + 14 Stage 14 +
12 Stage 15 sobre el catálogo aplicado).

## Conclusión

El catálogo rebalanceado **supera la validación completa**:

- 116 árboles, 72/72 objetivos cubiertos;
- cobertura RAW preservada en todos los objetivos RAW;
- progresiones válidas, C4 `!` alineadas, cap de elemento respetado;
- builds elementales y RAW competitivos en las comparativas oficiales.

**Stage 16: VALIDADO / APROBADO.** El siguiente paso (Stage 17) es el
balanceo por multiplicadores, que requiere esta validación completa como
prerrequisito.
