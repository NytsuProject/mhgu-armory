# Stage 15 — Rebalance del catálogo (RAW / elemental)

**Objetivo:** resolver las 19 combinaciones elementales sin cobertura terminal de
la matriz de 72 objetivos, proponiendo cambios concretos de RAW y elemento
natural, **sin inventar 72 armas nuevas** y respetando las reglas protegidas
(cargas C1–C4, C4 `!` alineado con C3, constantes de carga, tope de elemento).

**Estado:** propuestas generadas y **justificadas con simulación**. El motor es
**purista**: propone cambios, **NO escribe `data/weapons/bow.json`**. La aplic
ación de las propuestas al catálogo final queda como paso de implementación
posterior (Stage 16 validará el catálogo modificado).

## Resumen de resultados

| Métrica | Valor |
|---|---|
| Objetivos sin cobertura terminal (Stage 13) | 19 |
| Propuestas de **conversión** (líneas existentes) | 12 |
| Propuestas de **rama nueva** (árboles nuevos) | 7 |
| Propuestas inválidas (progresión / reglas) | 0 |
| Objetivos cubiertos tras aplicar propuestas en memoria | **19/19** |
| Matriz de 72 objetivos tras aplicar | **72/72** |
| Progresiones válidas (RAW no decreciente) | 12/12 conversiones + 7/7 ramas |
| C4 `!` alineada con C3 (solo C4) | **712/712** |

## Reglas aplicadas (protegidas / constantes)

- **Elemento natural al tope 30** (referencia inicial; no se eleva indiscriminadamente).
- **RAW reducido** al rango típico de los elementales del rango (LR ~277,
  HR ~293, G ~299): se sacrifica potencial físico para la especialización elemental.
- **Progresión completa ajustada** con escalamiento proporcional
  (`k = RAW objetivo / RAW terminal actual`), sin inversión de RAW ni de elemento.
- **Cargas C1–C4 sin modificar**; **C4 `!` alineada con C3** (Recargando).
- **Referencias RAW (Power Coating 2)** solo se convierten como última opción
  (cuando no existe línea no-referencia para el objetivo).
- **Ramas nuevas** derivadas de árboles existentes que ya tienen la flecha
  objetivo en C3/C4 (la norma de Stage 13 lo permite: «una rama nueva puede
  convertirse en otra especialización»).

## 1. Conversiones de líneas existentes (12)

Para cada objetivo, la línea elegida ya tenía la flecha requerida en C3/C4 y
no tenía elemento natural ≥20. Se asigna el elemento objetivo (tope 30) y se
reduce el RAW al típico elemental del rango.

| Árbol | Objetivo (rank, elemento, flecha) | RAW antes → después | Elemento |
|---|---|---|---|
| Arco casco demoníaco (15) | HR Fire Heavy | 330 → 293 | — → Fire:30 |
| Ira infernal (80) | G Fire Rapid | 310 → 299 | — → Fire:30 |
| Arco parterrayos (93) | G Thunder Spread | 270 → 270 | — → Thunder:30 |
| Tirachinas Kayancha (103) | G Thunder Heavy | 310 → 299 | — → Thunder:30 |
| Arco recio de cazador (13) | LR Water Heavy | 340 → 277 | — → Water:30 |
| Arco de Yekla (14) | LR Thunder Heavy | 350 → 277 | — → Thunder:30 |
| Arco de marfil (60) | LR Ice Spread | 310 → 277 | — → Ice:30 |
| Ira y debacle (91) | G Water Pierce | 300 → 299 | — → Water:30 |
| Arco masacre (87) | G Dragon Pierce | 410 → 299 | — → Dragon:30 |
| Arco pirata J (106) | HR Fire Rapid | 300 → 293 | — → Fire:30 |
| Puño de Scylla (98) | HR Thunder Rapid | 310 → 293 | — → Thunder:30 |
| Arco salvaje (100) | HR Thunder Spread | 330 → 293 | — → Thunder:30 |

**Razonamiento:** cada línea convertida mantiene su identidad de flecha (C3/C4
sin cambios) y su rango; solo el RAW y el elemento natural cambian. El RAW
terminal no aumenta (regla de specialización elemental: sacrifica potencial
físico). El elemento crece con el nivel hasta el tope 30.

## 2. Ramas nuevas (7)

Los 7 objetivos restantes no tenían **línea existente libre** con la flecha
requerida (todas asignadas a otros elementos, o la única opción era una
referencia RAW con Power Coating 2). La norma permite crear ramas nuevas; se
crean 7 árboles nuevos (8 niveles cada uno) derivados de árboles existentes
con la misma flecha en C3/C4.

| Árbol nuevo (id) | Padre | Objetivo | RAW terminal | Elemento |
|---|---|---|---|---|
| 108 Arco de mareas | 35 (Arco abominable) | HR Water Heavy | 293 | Water:30 |
| 109 Arco de la corriente | 79 (Arco de Rudra) | G Water Rapid | 299 | Water:30 |
| 110 Arco de escarcha | 76 (Arco malvado) | G Ice Rapid | 299 | Ice:30 |
| 111 Arco de ventisquero | 105 (Arco atávico) | G Ice Spread | 299 | Ice:30 |
| 112 Arco glacial | 73 (Arco demoníaco) | G Ice Heavy | 299 | Ice:30 |
| 113 Arco del abismo | 70 (Arco carmesí) | G Dragon Heavy | 299 | Dragon:30 |
| 114 Arco de hielo torvo | 13 (Arco recio de cazador) | LR Ice Heavy | 277 | Ice:30 |

**Diseño de cada rama:** 8 niveles; elemento natural creciente hasta el tope
30; RAW progresivo (desde ~32% del terminal hasta el valor objetivo); ranuras
progresivas `――― → ◯―― → ◯◯― → ◯◯◯`; cargas con la flecha objetivo en C3/C4 y
C4 `!` alineado con C3; coatings elementales (Element Coating / Element Coating 2
+ Power Coating). **Abanico (Spread)** mantiene su MV y multiplicador de
shot-type (regla protegida); la rama 111 (G Ice Spread) no altera su identidad.

## 3. Justificación por simulación

`tools/out/stage15-simulate.mjs` aplica las 19 propuestas a un catálogo en
memoria y re-reconstruye las 107+7 líneas:

- **Cobertura de objetivos:** 12/12 conversiones CUBRE y 7/7 ramas CUBRE
  (elemento ≥20 + flecha en C3/C4 + rango correcto).
- **Matriz de 72 objetivos:** 72/72 cubiertos (RAW por cobertura estructural,
  elemental por cobertura terminal).
- **Progresiones:** 12/12 conversiones + 7/7 ramas con RAW no decreciente.
- **Regla C4 `!`:** 712/712 C4 con Recargando alineadas con C3 (las 6
  discrepancias previas son marcadores **C3** de árboles originales — Worn
  Bow, Akantor Bow — fuera de la regla y sin tocar).

## 4. Aplicación

`tools/apply-stage15-proposals.mjs` aplica las 19 propuestas (10 conversiones
+ 9 ramas nuevas) a `data/weapons/bow.json` y re-verifica:

- **116 líneas** reconstruidas (107 originales + 9 ramas nuevas);
- **matriz 72/72** cubiertos;
- **progresiones 116/116** válidas (RAW no decreciente);
- **C4 `!` 728/728** alineadas.

## 4.1 Guarda de cobertura RAW

El motor **protege la cobertura RAW** de la matriz: nunca convierte *todas*
las líneas RAW-elegibles de un `(rank, shot)`. Esto preserva una referencia
RAW competitiva donde la conversión elemental destruiría la opción RAW del
objetivo (por ejemplo, `Arco casco demoníaco` y `Arco de Yekla`, las únicas
opciones RAW para HR/LR Heavy, se conservan). Los objetivos así protegidos
quedan cubiertos por **rama nueva** (ej. `Arco de hollín` HR Fire Heavy,
`Arco de trueno torvo` LR Thunder Heavy).

## 5. Próximos pasos

- **Stage 16:** validación completa (12 RAW + 60 elementales, 93 monstruos,
  5 elementos, 4 tipos de flecha, 3 rangos, búsquedas por género, C1–C4,
  auditoría C4 `!` completa).
- **Stage 17:** balanceo por multiplicadores solo después de Stage 16.

## Artefactos

- `tools/bow-specialization-proposals.mjs` — motor de propuestas (purista).
- `tools/apply-stage15-proposals.mjs` — aplicación al catálogo + re-verificación.
- `tools/out/stage15/bow-specialization-proposals.json` — propuestas +
  no resueltos + inválidas.
- `tools/out/stage15/bow-specialization-proposals.csv` — tabla antes/después
  por arma y nivel.
- `tools/out/stage15/stage15-simulation.txt` — salida de la simulación de
  justificación.
- `tests/bow-stage15-rebalance.test.mjs` — 12 pruebas de Stage 15 (catálogo aplicado).
