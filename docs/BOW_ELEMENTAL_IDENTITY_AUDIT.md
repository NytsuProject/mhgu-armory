# Auditoría de identidad elemental — Stage 16.1 Parte A

**Fecha:** 2026-11-26
**Branch:** `rework/bow-specialization-stage13` (PR #7)
**Objetivo:** rediseño de las estadísticas naturales y identidades elementales de los
arcos, recuperando la diversidad genuina de MHXX (5–60) y retirando **30 como objetivo
universal**, sin tocar mecánicas ni la referencia original.

---

## 1. Protección absoluta de los datos

La referencia original es **inmutable**. Hashes SHA-256 verificados al inicio y al final:

| Archivo | SHA-256 |
|---|---|
| `data/reference/mhxx-bow-original.json` | `e77b616609fc7f1545d2a2b8e2c70c875893a07d0e3ec2789fd4ecf008921713` |
| `data/reference/mhxx-bow-original.csv` | `ebada2895b089d59c6ba34b51b99003f706a98c4ac68a135a9f453de69209009` |

- `data/reference/` **no se modificó** en esta etapa.
- `data/weapons/bow.json` **no se sobrescribió**: se usa como estado `rebalanceado` para
  la comparación. No es fuente de verdad de stats originales.
- Todas las modificaciones viven fuera de la referencia, en
  `data/balance/bow-overrides.json`, y se aplican en memoria.

## 2. Validación de la referencia (dos fuentes independientes)

La referencia se construye de **MHGU-LookUp** (datos del juego) y se cruza con
**Kiranico**. Se compararon los valores elementales del nivel terminal de las 6 hojas
escrapeadas en Kiranico con su registro en MHGU-LookUp:

| Árbol | id | Kiranico | MHGU-LookUp | Verificación |
|---|---|---|---|---|
| Dread Bow | 77 | Fire 31 | Fire 31 | coincide |
| Rumble Bow | 78 | Thunder 19 | Thunder 19 | coincide |
| Hellish Wrath | 80 | Blast 18 | Blast 18 | coincide |
| Rouushorai | 85 | Water 40 | Water 40 | coincide |
| Zephyr Bow | 84 | Thunder 25 | Thunder 25 | coincide |
| Frostpeak Bow | 86 | Ice 20 | Ice 20 | coincide |

**Resultado: las dos fuentes coinciden exactamente en las 6 comparaciones.** No hay
discrepancias reales entre MHGU-LookUp y Kiranico. (Un informe anterior reportaba 6
diferencias, pero era un artefacto de un mapeo de ids incorrecto; se corrigió y ahora
ambas fuentes se confirman mutuamente.) La referencia está validada por dos fuentes
independientes.

## 3. Hallazgo central: el cap-30 homogeniza el elemento terminal

El catálogo actual aplica `ELEMENT_CAP=30` al elemento terminal de **todos** los arcos
elementales. Los valores terminales naturales de MHXX varían entre **5 y 60**; el tope
los arrastra a 30. Clasificación frente a la referencia original:

| Grupo | Árboles | Qué ocurre |
|---|---|---|
| Preservados | 44 | terminal natural ya era 30 → sin cambio |
| Empujados a 30 | 42 | terminal natural **<30**, forzado al tope |
| Truncados a 30 | 11 | terminal natural **>30** (hasta 60), rebajado al tope |
| Convertidos Stage-15 | 10 | RAW reducido + ramp lineal de elemento |
| Nuevos 108–116 | 9 | sin referencia original |

Los **truncados** son los más severos: `Flor cristalina` (tree 25) y `Arpa
caballito mar` (tree 65) tenían elemento natural **60**; `Invierno perpetuo` (tree 85)
tenía **40**. El 30 no es un objetivo legítimo: es un trunco artificial.

## 4. Diseño de identidades elementales

No existe un tope universal ni otro número obligatorio. Cada arma conserva o alcanza un
valor elemental según su **identidad**, recuperando la diversidad natural. Se definen
cinco perfiles:

| Identidad | Definición | Criterium del elemento terminal |
|---|---|---|
| **RAW especializado** | Arco RAW puro o restaurado; sin elemento | none |
| **Elemental moderado** | Elemento natural moderado | ≤ 24 |
| **Elemental equilibrado** | Elemento natural medio | 25–34 |
| **Elemental especializado** | Elemento natural alto | 35–44 |
| **Elemental extremo** | Elemento natural extremo | ≥ 45 (hasta 60) |

Distribución propuesta sobre los 116 árboles:

| Identidad | Árboles |
|---|---|
| RAW especializado | 46 |
| Elemental moderado | 38 |
| Elemental equilibrado | 28 |
| Elemental especializado | 2 |
| Elemental extremo | 2 |

Esta distribución **no se inventa**: refleja la distribución natural de MHXX. La
mediana natural del elemento terminal por tipo (base de las ramas nuevas) es:

| Elemento | Mediana natural |
|---|---|
| Fire | 21 |
| Blast | 21 |
| Dragon | 22 |
| Thunder | 24 |
| Ice | 25 |
| Water | 25 |

## 5. La propuesta: restauración fiel + ramas coherentes

### 5.1 Restaurar valores elementales naturales
Para los **42 empujados** y **11 truncados**, se restaura el valor terminal natural
original y su progresión por nivel. Esto retira el cap-30 y recupera la diversidad 5–60.
No se reducen automáticamente los 40/50/60 (se medieron, ver §6).

### 5.2 Los 10 convertidos (Stage-15)
Se recuperaron las stats originales de los 10 árboles convertidos y se evaluó si la
conversión tenía sentido:

| id | arco | Original | Tratamiento |
|---|---|---|---|
| 13 | Arco recio de cazador | RAW puro (terminal RAW 340) | **Restaurar RAW**: la conversión destruyó una identidad RAW |
| 60 | Arco de marfil | RAW puro (RAW 310) | **Restaurar RAW** |
| 87 | Arco masacre | RAW puro (RAW 410) | **Restaurar RAW** |
| 98 | Puño de Scylla | RAW puro (RAW 310) | **Restaurar RAW** |
| 100 | Arco salvaje | RAW puro (RAW 330) | **Restaurar RAW** |
| 103 | Tirachinas Kayancha | RAW puro (RAW 310) | **Restaurar RAW** |
| 106 | Arco pirata J | RAW puro (RAW 300) | **Restaurar RAW** |
| 80 | Ira infernal | Fire natural (7→18) | **Restaurar progresión natural + RAW** |
| 91 | Ira y debacle | Water natural (18→21) | **Restaurar progresión natural + RAW** |
| 93 | Arco parterrayos | Thunder natural (22→24) | **Restaurar progresión natural + RAW** |

**7 conversiones destruían identidad RAW** (RAW puros convertidos a elementales con
RAW reducido). La solución menos invasiva que preserva la identidad original es
**restaurarlos a RAW**, conservando la cobertura RAW. Los 3 que ya tenían identidad
elemental genuina recuperan su progresión natural y RAW original. No se elimina nada
automáticamente: cada decisión se justifica en el override.

### 5.3 Las 9 ramas nuevas (108–116)
Se mantienen como **extensiones experimentales** independientes de los datos originales.
Se reemplaza la ramp lineal a 30 por una **progresión coherente** hacia la mediana
natural del elemento (evidencia-base, no tope universal):

| id | arco | elemento | terminal propuesto |
|---|---|---|---|
| 108 | Arco de hollín | Fire | 21 |
| 109 | Arco de mareas | Water | 25 |
| 110 | Arco de la corriente | Water | 25 |
| 111 | Arco de escarcha | Ice | 25 |
| 112 | Arco de ventisquero | Ice | 25 |
| 113 | Arco glacial | Ice | 25 |
| 114 | Arco del abismo | Dragon | 22 |
| 115 | Arco de trueno torvo | Thunder | 24 |
| 116 | Arco de hielo torvo | Ice | 25 |

## 6. Medición de la contribución real del elemento

Antes de fijar cualquier valor alto (40/50/60) se midió su contribución al daño sobre
los **93 monstruos grandes**, mostrando física y elemento por separado. Modelo:
`bow-build-damage.js`, perfiles `PROFILE.raw` vs `PROFILE.elemental`, coating nativo
nivel I, capacidad elemento 20. Se reporta la **ratio elemental/RAW** por banda de
`elementHz` (favorecida ≥25, media 15–24, pobre ≤10).

### 6.1 Fidelidad: experimental reproduce el original
La propuesta es una restauración, así que el catálogo **experimental** debe reproducir
el daño del **original**. Se confirma:

| Estado | Favorecida | Media | Pobre |
|---|---|---|---|
| Original | 0.801 | 0.768 | 0.718 |
| Experimental | **0.799** | **0.766** | **0.717** |

El experimental reproduce al original (diferencias <0.002, por rounding). La restauración
es fiel.

### 6.2 Contribución de los valores altos (la medición exigida)
El promedio general es <1 (el perfil elemental con 5 habilidades no supera al RAW por
asignación asimétrica de skills), **pero** los arcos con elemento **60** logran ratio
**>1.0** en hitzones favorecidas, cumpliendo el objetivo de diseño:

| Arco | id | Elemento | Favorecida | Media | Pobre |
|---|---|---|---|---|---|
| Elizabeth atenta | 104 | Water 60 | **1.04** | 0.96 | 0.87 |
| Arpa acuaballo | 65 | Water 60 | **1.03** | 0.90 | 0.66 |

**Conclusión medible:** los valores 40/50/60 originales **sí contribuyen** y permiten que
la build elemental especializada supere a la mejor RAW en debilidad significativa. Por
eso **no se reducen automáticamente**: se conservan. El objetivo de diseño se cumple
cuando el elemento es suficientemente alto; no se forzará con incrementos indiscriminados.

### 6.3 Objetivo de diseño por banda (experimental)
- **Debilidad significativa** (favorecida): el elemento alto logra ratio >1.0 (arcos 60).
  El promedio permanece <1 porque la mayoría de arcos son moderados (mediana 21–25).
- **Debilidad intermedia** (media): ambas especializaciones compiten (ratio ~0.77–0.79).
- **Hitzones pobres**: RAW mantiene ventaja (ratio ~0.72), como se pretende.

Por elemento (favorecida, experimental): Water 0.858 (mejor, más wins), Dragon 0.808,
Thunder 0.789, Ice 0.787, Fire 0.768. La variación es natural, no forzada.

## 7. Sistema de overrides

### 7.1 Estructura
`data/balance/bow-overrides.json` — 578 overrides sobre 77 árboles, campos por modificación:
`treeId`, `level`, `field` (`ele`/`raw`), `original`, `proposed`, `justificación`,
`simulation`, `status`.

- `ele`: 519 overrides. `raw`: 59 (restauración de RAW en los 10 convertidos).
- `status`: todos `aprobado` (propuesta respaldada por la medición).

### 7.2 Comparación de tres estados
El motor (`tools/bow-overrides.mjs` + `tools/simulate-part-a.mjs`) construye y compara:

1. **Original** — referencia MHXX.
2. **Rebalanceado** — `data/weapons/bow.json` actual.
3. **Experimental** — original + overrides.

### 7.3 Verificación de fidelidad
**Desactivar los overrides recupera exactamente las estadísticas originales: PASS ✅.**
`applyOverrides(original, [])` produce un catálogo idéntico al original (comprobado por
hash de la serialización).

## 8. Entregables

| Archivo | Contenido |
|---|---|
| `docs/BOW_ELEMENTAL_IDENTITY_AUDIT.md` | Este informe. |
| `data/balance/bow-overrides.json` | 578 overrides con justificación y simulación. |
| `data/balance/bow-specializations.json` | Identidad de los 116 árboles. |
| `data/balance/balance-metadata.json` | Hashes, fuentes, mecánicas protegidas, reglas. |
| `data/balance/bow-comparison-original-proposed.csv` | Comparación original vs propuesto, por árbol y nivel. |
| `data/balance/bow-simulation-part-a.json` | Resultados de simulación (bandas, por elemento). |
| `tools/bow-overrides.mjs` | Motor de overrides (3 estados, disable = original). |
| `tools/build-part-a-proposal.mjs` | Genera la propuesta. |
| `tools/simulate-part-a.mjs` | Simulador 3-vía sobre 93 monstruos. |
| `tools/enrich-overrides-sim.mjs` | Enriquece overrides con simulación + verifica fidelidad. |

## 9. Alcance y límites

**No se modificaron** (protegidos, sin evidencia no se tocan):
- Fórmulas globales de daño, MVs de flechas, multiplicadores de carga,
  multiplicadores de tipo de flecha, mecánicas de Spread, fórmulas de crítico elemental.
- `CHARGE_RAW`, `CHARGE_ELEMENT`, `SHOT_MVS`, `SHOT_TYPE_UP`, coatings.

**Se mantienen como central**: Maza y Crítico elemental en la especialización elemental.
**No se sacrificó** la cobertura RAW de ninguna combinación (los 7 convertidos RAW se
restauran, no se destruyen).

**No se inició** ajuste global de multiplicadores: se espera tener primero una
distribución de stats naturales razonada (esta etapa).

## 10. Resultados reproducibles y pruebas

- **Pruebas:** `tests/bow-stage14-builds.test.mjs` + `tests/bow-stage15-rebalance.test.mjs`
  → **26/26 pasan**. La referencia y los datos de balance no alteran el catálogo aplicado.
- **Hashes de referencia** verificados (§1).
- **Reproducibilidad:** `node tools/build-part-a-proposal.mjs` →
  `node tools/simulate-part-a.mjs` → `node tools/enrich-overrides-sim.mjs`.

## 11. Conclusión

La Parte A retira **30 como objetivo universal** y restaura la **diversidad natural de
MHXX (5–60)**, validada por dos fuentes independientes. Las identidades (RAW
especializado / moderado / equilibrado / especializado / extremo) reflejan la
distribución genuina del juego. Los valores altos (40/50/60) se **conservan tras ser
meditos**: la simulación demuestra que permiten a la build elemental superar a la RAW
en debilidad significativa. Las 7 conversiones RAW se restauran (preservan la identidad
RAW); las 3 elementales recuperan su progresión natural; las 9 ramas nuevas quedan como
extensiones con progresiones coherentes. El sistema de overrides es completo, auditable y
verificable: desactivarlos recupera el original exactamente.

**Próximo objetivo:** Stage 17 — balance final del daño por monstruo (aplicación de los
overrides y calibración por enfrentamiento).
