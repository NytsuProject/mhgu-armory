# Auditoría de la base de referencia original de arcos MHXX

**Fecha:** 2026-11-26  
**Branch:** `rework/bow-specialization-stage13`  
**Objetivo:** recuperar una base de referencia fiel de los arcos MHXX originales (antes de la rework) y documentar su relación con el catálogo actual **sin modificar** `data/weapons/bow.json`.

## Fuentes

| Fuente | Uso | Conclusión |
|---|---|---|
| **MHGU-LookUp** (`ArmoredRaven17/MHGU-LookUp`, branch `master`; `public/data/weapons/w10.json`) | **Prioritaria**: datos leídos de las tablas del juego | 107 árboles, 735 niveles; elemento natural por nivel (`ele`), rango 5–60; 61 árboles con elemento, 46 sin él.
| **Kiranico** (`mhxx.kiranico.com/en/yumi`) | **Cruz**: tabla completa escrapeada (21 chunks) | Mismas formas y evoluciones; se comparan las hojas y se registran ambas fuentes.
| **Repo baseline** (`tools/out/stage15/bow-baseline.json`) | Referencia interna pre-Stage-15 | Coincide con MHGU-LookUp; usada para la comparación de cambios.

**Decisión de fiabilidad:** MHGU-LookUp y Kiranico se extraen de la misma tabla del juego; donde difieren se registran **ambos valores** y se marca el registro para verificación adicional. No se elige arbitrariamente.

## Inventario recuperado

- Árboles: **107** (todos los árboles originales MHXX).
- Niveles: **735**.
- Con elemento natural: **61**; sin elemento (RAW puro): **46**.
- Rango de valores elementales: **5–60** (progresión natural por árbol, no un tope universal).

## Entregables

- `data/reference/mhxx-bow-original.json` — registro normalizado (árbol + niveles: RAW, elemento, afinidad, defensa, slots, Arc Shot, C1–C4, coatings, boost, parent/children).
- `data/reference/mhxx-bow-original.csv` — CSV reproducible (una fila por arma y nivel), con nombre ES de la rama actual para facilitar la comparación.

## Encontrado clave: `ELEMENT_CAP=30` homogeniza el elemento terminal

El catálogo actual aplica un tope de elemento **30 en el nivel terminal de TODOS los arcos elementales**. Los valores terminales naturales de MHXX varían mucho (5–60); el tope los arrastra a 30. Esto es la evidencia concreta de que **30 no es un objetivo universal legítimo**, sino un trunco artificial de la progresión natural. Se clasifican cuatro grupos.

## Clasificación: catálogo actual vs referencia original

- **Preservados** (terminal natural ya era 30; el cap no cambia nada): **44** árboles.
- **Empujados a 30** (terminal natural <30, forzado al tope): **42** árboles.
- **Truncados a 30** (terminal natural >30, rebajado al tope): **11** árboles.
- **Convertidos Stage-15** (RAW reducido + ramp lineal de elemento): **10** árboles.
- **Nuevos** (108–116, sin referencia original): **9**.

### Convertidos RAW → elemento (Stage 15)

| id | arco | terminal lv | RAW orig → act | elemento orig → act | niveles |
|---|---|---|---|---|---|
| 13 | Arco recio de cazador | 11 | 340 → 277 | None → 30 | 11 |
| 60 | Arco de marfil | 7 | 310 → 277 | None → 30 | 7 |
| 80 | Ira infernal | 15 | 310 → 299 | 18 → 30 | 15 |
| 87 | Arco masacre | 5 | 410 → 299 | None → 30 | 5 |
| 91 | Ira y debacle | 3 | 300 → 299 | 21 → 30 | 3 |
| 93 | Arco parterrayos | 3 | 270 → 270 | 24 → 30 | 3 |
| 98 | Puño de Scylla | 6 | 310 → 293 | None → 30 | 6 |
| 100 | Arco salvaje | 5 | 330 → 293 | None → 30 | 5 |
| 103 | Tirachinas Kayancha | 3 | 310 → 299 | None → 30 | 3 |
| 106 | Arco pirata J | 4 | 300 → 293 | None → 30 | 4 |

En estos árboles Stage-15 redujo el RAW en **todos** los niveles y aplicó una ramp lineal del elemento (`≈30·lv/maxlv`) que no coincide con la progresión natural original.

### Empujados a 30 (terminal natural <30)

| id | arco | elemento terminal orig → act |
|---|---|---|
| 3 | Retumbar usurpador | 24 → 30 |
| 8 | Calígine | 18 → 30 |
| 11 | Arco de Daimyo | 26 → 30 |
| 16 | Arco de prominencia | 22 → 30 |
| 17 | Ira de la reina | 19 → 30 |
| 18 | Multiarco tipo 64 | 24 → 30 |
| 22 | Cordel metálico | 15 → 30 |
| 26 | Llamas azules | 25 → 30 |
| 27 | Llamas heladas | 18 → 30 |
| 28 | Arco Khezu | 26 → 30 |
| 31 | Arco Kut-Ku | 25 → 30 |
| 35 | Arco abominable | 12 → 30 |
| 36 | Arco esponja | 24 → 30 |
| 37 | Lanzarrayos | 14 → 30 |
| 39 | Pata de ángel | 16 → 30 |
| 40 | Arco de acero gélido | 25 → 30 |
| 42 | Arco de relámpago | 28 → 30 |
| 43 | Arco de gigante | 28 → 30 |
| 45 | Ira de ceniza | 26 → 30 |
| 46 | Visión de desaliento | 22 → 30 |
| 47 | Secuestrador | 15 → 30 |
| 51 | Pájaro estrella polar | 18 → 30 |
| 52 | Arco rayo bestial | 22 → 30 |
| 53 | Rayo archibestial | 20 → 30 |
| 54 | Hiperión | 18 → 30 |
| 56 | Arco Akantor | 24 → 30 |
| 57 | Arco Ukanlos | 13 → 30 |
| 58 | Arco de Alatreon | 26 → 30 |
| 59 | Tormenta nocturna | 14 → 30 |
| 61 | Arco de ónice | 20 → 30 |
| 71 | Arco de Herm. Pétreo | 17 → 30 |
| 72 | Fulgor real | 17 → 30 |
| 75 | Arco de Grobo | 18 → 30 |
| 78 | Arco retumbante | 19 → 30 |
| 83 | Arco ala plata | 18 → 30 |
| 84 | Arco Zephra | 25 → 30 |
| 86 | Arco Glacial | 20 → 30 |
| 89 | Arco dragón de tierra | 26 → 30 |
| 90 | Choque y desolación | 25 → 30 |
| 94 | Gewinn/Pérdida | 22 → 30 |
| 97 | Cresta de hielo | 20 → 30 |
| 101 | Choque del déspota | 21 → 30 |

**42 árboles.** El elemento terminal natural (<30) fue elevado al tope 30.

### Truncados a 30 (terminal natural >30)

| id | arco | elemento terminal orig → act |
|---|---|---|
| 4 | Arko Nulo amarillo | 34 → 30 |
| 5 | Arko Nulo blanco | 33 → 30 |
| 6 | Arco sónico | 33 → 30 |
| 25 | Flor cristalina | 60 → 30 |
| 34 | Arco de piel de Blango | 32 → 30 |
| 44 | Lluvia bendita | 32 → 30 |
| 55 | Selene Lunarrota | 32 → 30 |
| 65 | Arpa caballito mar | 60 → 30 |
| 77 | Arco del terror | 31 → 30 |
| 85 | Invierno perpetuo | 40 → 30 |
| 92 | Victoria gloriosa | 35 → 30 |

**11 árboles.** El elemento terminal natural (>30, hasta 60) fue rebajado al tope 30. Estos son los casos más severos: la referencia original muestra valores genuinos hasta 60.

### Árboles nuevos sin referencia (Stage 15: 108–116)

| id | nombre | elemento |
|---|---|---|
| 108 | Arco de hollín | ['Fuego', 'Fire', 30] |
| 109 | Arco de mareas | ['Agua', 'Water', 30] |
| 110 | Arco de la corriente | ['Agua', 'Water', 30] |
| 111 | Arco de escarcha | ['Hielo', 'Ice', 30] |
| 112 | Arco de ventisquero | ['Hielo', 'Ice', 30] |
| 113 | Arco glacial | ['Hielo', 'Ice', 30] |
| 114 | Arco del abismo | ['Dragón', 'Dragon', 30] |
| 115 | Arco de trueno torvo | ['Rayo', 'Thunder', 30] |
| 116 | Arco de hielo torvo | ['Hielo', 'Ice', 30] |

**9 árboles.** Carecen de referencia original; se documentan como extensiones de rama (parent→child) y **no** se les sustituyen valores inventados.

### Árboles sin referencia en MHGU-LookUp

Ninguno: todos los árboles del catálogo actual (excepto los 9 nuevos) coinciden en id con la referencia.

## Reducciones de RAW

Ningún árbol fuera de los 10 convertidos tiene RAW reducido: el RAW actual coincide con la referencia original.

## Diferencias Kiranico vs MHGU-LookUp

**Ninguna diferencia**: Kiranico y MHGU-LookUp coinciden en los valores elementales de las hojas comparadas.

## Encajes estructurales

Todos los árboles originales coincidieron en `maxLevel` entre referencia y catálogo actual.

## Límites de la recuperación

- La referencia es **MHGU-LookUp** (datos del juego) cruzada con Kiranico; no se confía en `main` ni en informes previos como fuente de stats originales.
- Los árboles nuevos **108–116** no tienen referencia original: se documentan como extensiones y quedan fuera de la comparación de valores.
- No se aplicó tope 30 ni rebalance en la referencia: se conservan los valores naturales 5–60.
- Las cargas C1–C4 se conservan como la fuente; el `!` de C4 es una anotación del catálogo actual, no de la fuente original.
- Los nombres ES se toman del catálogo actual por id; no se inventan.

## Conclusión

La base de referencia **fiel** está recuperada y documentada. El hallazgo central es que `ELEMENT_CAP=30` homogeniza el elemento terminal de todos los arcos elementales, arrastrando a 30 una progresión natural que en MHXX varía entre **5 y 60** (44 preservados, 42 empujados, 11 truncados, hasta 60 en Flor cristalina / Arpa caballito mar). La Parte A del Stage 16.1 debe retirar el 30 como objetivo universal y restaurar la diversidad natural, sin imponer otro límite arbitrario. Las conversiones Stage-15 (10 árboles, RAW reducido + ramp lineal) son el otro punto a justificar o revertir.
