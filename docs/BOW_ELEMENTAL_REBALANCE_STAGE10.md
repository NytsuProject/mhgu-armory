# Rebalance elemental del arco — Etapa 10 (implementación acotada)

Estado: **cambios de catálogo y propuesta aplicados** a `data/weapons/bow.json`.
Esta etapa pasa de la investigación a la primera iteración de rebalance
recomendada por el [informe general de 2026-11-25](../Informe_rebalance_elemental_arco_MHGU_2026-11-25.md):
aplica las dos decisiones de catálogo ya claras y ajusta el elemento por
líneas terminales usando las matrices como control. No añade capas de
simulación nuevas.

## 1. Qué se aplicó

### 1.1 Decisión de catálogo: tope de elemento natural 30

Se limita a **30** el elemento natural mostrado en los registros de nivel
que lo superan. El tope se aplica a la **base** (elemento mostrado del
catálogo); después se calculan las habilidades como hasta ahora. RAW, MV
físicos, cargas, coatings, ranuras, afinidad, defensa y elementos no
naturales (Explosión y estados) no cambian.

- **30 registros de nivel** superaban 30 y quedan limitados a 30
  (LR 15, HR 6, G 9).
- Los **7 registros exactamente en 30** no se tocan.
- **11 líneas terminales** elementales se veían afectadas; su progresión
  queda para revisión en la hoja de salida (§2).
- La suma total de elemento natural del catálogo pasa de 6.865 a 6.586
  (−4,06 %) con el tope solo; tras la propuesta de §1.3 sube a 6.971.

### 1.2 Decisión de catálogo: normalización C4 de Recargando

Cuando la **cuarta carga** requiere Recargando (`!`), su tipo de flecha
se alinea con el de la **tercera carga**. Se conserva el nivel de la
carga y la marca `!`; solo se alinea el tipo. Las cargas C3 marcadas
(18) y las 6 C3 desalineadas con C2 **no se tocan** con esta regla.

- **435 cargas C4** se alinearon permanentemente en `bow.json`.
- **Corrección de cifra frente al informe general:** el informe apuntó 423
  registros C4. La cifra correcta es **435**. El total de cargas `!`
  desalineadas es 441 = **6 C3** + **435 C4**; el informe restó los 18
  cargos C3 marcados (no los 6 C3 realmente desalineados) para obtener
  423. La regla acordada afecta a los 435 C4, que es lo que se aplica.
- Tras el cambio, la auditoría de ramas vuelve a reportar 674 cargas
  marcadas, **6 desalineaciones** (las C3, que la regla deja intactas) y
  668 ya alineadas.

### 1.3 Pasada de balance por los 55 finales elementales

Después de las dos decisiones de catálogo, se hizo una sola pasada de
balance por las **55 líneas terminales elementales**, emparejadas con las
**46 finales RAW** del mismo rango (los 6 Explosión quedan aparte y sin
cambios). El ajuste cae únicamente sobre el **valor elemental** de las
ramas que quedan por debajo del objetivo: no se tocan MV físicos ni buffs
universales.

**Método.** Para cada final, la ratio de referencia es la del paquete
Elemental Full frente al paquete RAW del **mismo arco**, en la tercera
carga, estilo Guild y matchup favorable (shotHz 45, hitzone elemental
30) del modelo de la etapa 5. La ratio es lineal en el valor de elemento,
así que se resuelve por interpolación el valor que alcanza la meta de
diseño y se limita por las ventanas documentadas:

| Ventana | Meta / límite |
|---|---:|
| Hitzone favorable | ratio 1,10 (aproximadamente +10 % frente a RAW) |
| Hitzone media | paridad o ligeramente por encima; límite 1,08 |
| Hitzone pobre | ventaja clara para RAW; límite 0,95 |

El valor propuesto nunca baja del valor actual (post-tope), nunca supera
el tope 30 y nunca se pasa de las ventanas de media y pobre. La
evaluación se hace con el modelo de daño de `tools/bow-elemental-scenarios.mjs`
(Elemental Full vs RAW, tercera carga, Guild, 200 disparos, coatings
nativos).

**Resultado.**

- **42 de los 55 finales** suben su elemento hasta **30**, que es el
  límite que deja el tope 30 acordado: la ratio favorable objetivo
  (1,10) necesitaría valores superiores a 30 para la inmensa mayoría de
  las ramas, así que el tope es la restricción que ata primero.
- **13 finales** ya estaban en 30 (11 por el tope y 2 que ya tenían 30);
  no cambian (`cap-bound`).
- **Ninguna rama se pasa de la ventana**: ninguna ratio media ni pobre
  supera su límite tras la propuesta.
- Al cerrar la iteración, **todos los finales elementales quedan en
  30**. Esto no es una subida uniforme aplicada sin análisis: es la
  consecuencia de resolver cada rama por separado contra la meta de
  diseño con el tope 30 como ceiling. La brecha residual frente al +10 %
  es la finding ya documentada de la etapa 6: el valor de elemento por
  sí solo no cierra la brecha, por lo que A/B, Element Coat 50 y
  parámetros elementales de carga **quedan sin aprobar**, tal como
  recomendaba el informe.

Ratio media (Elemental Full / RAW, matchup favorable) por rango, antes
(post-tope) y después de la propuesta:

| Rango | Finales | Favorable antes → después | Media antes → después | Pobre antes → después |
|---|---:|---:|---:|---:|
| LR | 22 | 0,875 → 0,880 | 0,856 → 0,858 | 0,842 → 0,843 |
| HR | 19 | 0,868 → 0,877 | 0,852 → 0,856 | 0,840 → 0,842 |
| G | 14 | 0,866 → 0,872 | 0,851 → 0,854 | 0,840 → 0,841 |
| **Total** | **55** | **0,870 → 0,877** | 0,853 → 0,856 | 0,841 → 0,842 |

La mejora agregada es modesta por la razón expuesta arriba; el valor de
la iteración está en fijar el tope, alinear el catálogo y dejar una
hoja de salida auditable con la que controlar la siguiente iteración.

## 2. Hoja de salida

La hoja completa por línea está en los artefactos generados por
`tools/bow-elemental-rebalance.mjs --proposal`:

- `tools/out/bow-elemental-rebalance-proposal.json` — datos completos.
- `tools/out/bow-elemental-rebalance-proposal.csv` — una fila por final.

Cada fila da, para cada línea elemental: rango, familia raíz, nombre del
final, **RAW actual**, **elemento actual**, **elemento propuesto**,
bandera (`target` / `cap` / `medium-window` / `poor-window` /
`in-window` / `cap-bound`), tipo y nivel de la tercera carga,
requisito de Recargando, **coatings nativos**, ranuras, número de
escalaones de progresión, ratios actuales y propuestas (favorable /
media / pobre), y el contexto de los **finales RAW del mismo rango**
(cantidad y máximo RAW). Los 42 cambios aplicados son los resaltados
con `changed: true`.

## 3. Qué no se tocó

- **RAW**: 0 cambios en las 735 entradas (verificado campo a campo en
  la prueba de linaje).
- **Abanico**: MV, Pellet Up, RAW, elemento y cargas sin cambios. La
  normalización C4 es la regla de catálogo acordada para cargas `!`; no
  altera MV, Pellet Up, RAW ni elemento.
- Coatings, ranuras, afinidad, defensa, tiro de arco, tipos y niveles de
  carga (salvo el tipo C4 de la regla anterior), bifurcaciones, padres
  y niveles de cada árbol.
- Escenarios A/B, Element Coat 50 y parámetros elementales de carga:
  sin cambios; la evidencia de la etapa 6 no los justifica como solución.

## 4. Cómo se aplica y se comprueba

```bash
# Informe de los cambios de catálogo (sin escribir)
node tools/bow-elemental-rebalance.mjs
# Aplicar solo las dos decisiones de catálogo
node tools/bow-elemental-rebalance.mjs --apply
# Calcular la propuesta (artefactos JSON/CSV en tools/out)
node tools/bow-elemental-rebalance.mjs --proposal
# Aplicar tope + normalización C4 + propuesta
node tools/bow-elemental-rebalance.mjs --apply-proposal
```

El módulo `js/bow-elemental-rebalance.js` contiene las funciones puras
(tope, normalización C4, inventario de finales, solver de propuesta);
el CLI es el único que escribe `bow.json`, y lo hace en el formato
minificado de un solo línea del resto de catálogos de armas.

**Pruebas** (`tests/bow-elemental-rebalance.test.mjs`, incluida en
`npm test`):

- el tope toca solo los 30 registros naturales sobre 30 y es idempotente;
- la normalización C4 conserva nivel y `!`, solo cambia el tipo, deja
  las C3 intactas y es idempotente;
- el inventario real mantiene 55/46/6 y el catálogo final no tiene
  elemento natural sobre 30 ni C4 desalineadas (solo las 6 C3);
- un recorrido campo a campo de las 735 entradas comprueba que RAW,
  afinidad, defensa, ranuras, coatings, tiro y cargas (salvo el tipo C4)
  y el linaje no cambian;
- el solver solo sube, respeta el tope y las ventanas, y cubre los 55
  finales con contexto RAW del mismo rango;
- el evaluador real reproduce la referencia de la etapa 9 para
  **Elizabeth atenta** (Water 30, Abanico Lv5, RAW 250): ratio favorable
  0,876, dentro de la banda del 0,8794 medido sobre los 93 monstruos.

`npm test` pasa con **90 pruebas**. El workflow de GitHub Actions
(`node-tests.yml`) actualiza la esperada de desalineaciones de Recargando
(441 → 6) y añade una paso que comprueba que el tope y la normalización
ya están aplicados.

## 5. Validación con la matriz Guild de 93 monstruos (ya ejecutada)

Se ejecutó `runMonsterMatrix` (estilo Guild, 200 disparos, primera tabla
de hitzones de los 93 monstruos grandes) sobre el catálogo **anterior**
(sin tope, sin propuesta) y sobre el catálogo **nuevo** (tope + propuesta
aplicados), y se comparó por rango, perfil y tipo de flecha. La ejecución
sobre el catálogo anterior reproduce exactamente la línea base de la
etapa 6 (Element Full, media por parte: LR 0,759 / HR 0,835 / G 0,887),
lo que confirma que la comparativa es válida.

Ratio media (Elemental / RAW) por rango y perfil, antes → después:

| Rango | Perfil | Tipo | Antes → Después |
|---|---|---|---:|
| LR | Element Full | todos | 0,789 → 0,824 |
| HR | Element Full | todos | 0,869 → 0,901 |
| G | Element Full | todos | 0,918 → 0,930 |
| LR | Híbrido máx | todos | 0,852 → 0,887 |
| HR | Híbrido máx | todos | 0,941 → 0,972 |
| G | Híbrido máx | todos | 0,991 → **1,002** |
| LR | Híbrido económico | todos | 0,870 → 0,904 |
| HR | Híbrido económico | todos | 0,920 → 0,955 |
| G | Híbrido económico | todos | 0,987 → 0,999 |

- El híbrido máximo cruza la **paridad en G** (1,002) y el híbrido
  económico en HR-Perforante (1,014) tras el cambio.
- La mejora es consistente por tipo de flecha: Perforante es la que
  más sube (+0,026 a +0,038), seguida de Abanico y Salva; **Pesada**
  apenas se mueve (+0,002), como se esperaba por su único impacto por
  descarga. En G-Pesada la ratio baja 0,001 por cambio de candidato
  ganador, sin traspasar ninguna ventana.
- **Ninguna rama se pasa de la ventana**: no hay correcciones por rama
  necesarias tras esta iteración.

## 6. Validación pendiente (siguiente iteración)

1. Comparar builds reales con presupuesto de habilidades equivalente
   (el RAW de referencia de la etapa 9 estaba incompleto); la matriz
   aquí es un índice teórico por parte, no DPS.
2. Validar en juego los multiplicadores de carga y el tope de buffs
   antes de considerar cualquier parámetro elemental de carga.
3. Revisar la progresión de los árboles cuyas etapas intermedias
   quedan por debajo del nuevo valor del final (la hoja de salida
   apunta los niveles de cada línea).
