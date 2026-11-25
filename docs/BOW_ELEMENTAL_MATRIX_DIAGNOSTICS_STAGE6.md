# Diagnóstico de la matriz elemental completa — etapa 6

Estado: línea base reproducible completada. Este documento recoge la matriz Guild y Valor ejecutada contra las hitzones de los 93 monstruos grandes. Los resultados son índices comparativos teóricos; no son DPS ni una medición en juego.

## Ejecución de referencia

- GitHub Actions: [run #80 — completo y exitoso](https://github.com/NytsuProject/mhgu-armory/actions/runs/45652008067).
- Commit evaluado: `b4de60e4502ae6cc3589e9d95a1969eea19697ed`.
- Artifact: `bow-balance-stage5-results`, contiene la matriz completa de Guild, Valor y sus resúmenes.
- Fuente de hitzones fijada en el workflow: 93 monstruos grandes; se usa la primera tabla, que deja 631 comparaciones de partes por rango. Las 66 segundas tablas paralelas no se han etiquetado como estados concretos.
- Opciones: Recargando normalizado en memoria; 200 disparos de misión; sin Ammo Saver; 20 unidades base de Element Coat; Power Shot frecuencia 1; Valor uptime 1.0. Este último es un techo teórico optimista, no una estimación de uso medio.

La matriz empareja el mejor candidato elemental y el mejor RAW en la misma parte, rango y grupo de tipo de flecha. Todos los impactos posibles se asignan a la misma parte. La comparación favorece al arma elemental al permitir seleccionar el mejor candidato por parte, pero no reproduce la distribución real de proyectiles ni el ciclo de una cacería.

## Resultado principal: Guild, Elemental Full

Elemental Full mantiene el potenciador del tipo de flecha, incorpora Crítico elemental y las dos mejoras elementales del paquete. Aun así, su índice de daño medio por parte frente al mejor RAW queda por debajo de 1 en los tres rangos.

| Rango | Base: ratio elemental/RAW | Escenario A | Escenario B | Elemental gana en partes (base) | Partes favorables HZ elemental ≥25 (ratio base) |
|---|---:|---:|---:|---:|---:|
| LR | 0,759 | 0,762 | 0,763 | 0 / 631 | 0,791 |
| HR | 0,835 | 0,838 | 0,839 | 0 / 631 | 0,862 |
| G | 0,887 | 0,890 | 0,891 | 5 / 631 | 0,903 |

Una relación 0,759 equivale a que el índice elemental es aproximadamente 24,1 % inferior al RAW emparejado en ese agregado; 0,887 equivale a 11,3 % inferior. Incluso en G, donde se acerca más, solo 5 de 631 comparaciones de partes superan a RAW. En LR y HR no hay ninguna victoria de Elemental Full en las partes evaluadas.

El grupo favorable restringido a hitzones elementales ≥25 tampoco alcanza 1 en promedio: 0,791 LR, 0,862 HR y 0,903 G. Por tanto, la diferencia no se explica únicamente por comparar contra zonas elementales pobres.

## Los escenarios A/B y más capacidad de coating no bastan por sí solos

En Elemental Full, pasar de la carga base a B solo sube el ratio agregado:
- LR: 0,759 → 0,763.
- HR: 0,835 → 0,839.
- G: 0,887 → 0,891.

La propuesta de Element Coat con capacidad 50 (más las 10 unidades de combinación modeladas) también aporta poco en esta línea base:
- Guild LR: 0,759 → 0,760.
- Guild HR: 0,835 → 0,836.
- Guild G: 0,887 → 0,889.

Esto no demuestra que A/B o la capacidad 50 sean inútiles. Sí demuestra que **no son suficientes por separado** para alcanzar la meta de diseño de aproximadamente +10 % en hitzones favorables. No se deben aprobar multiplicadores de carga mucho más altos sin identificar primero qué componente del modelo deja a la build elemental tan atrás.

## Valor es un techo, no un caso medio

Valor usa dos Power Shots y la ejecución configuró uptime 1.0. En Elemental Full, los ratios agregados fueron 0,777 LR, 0,855 HR y 0,908 G. El mejor resultado se acerca a la paridad en G, pero continúa por debajo de 1; además, supone el estado Valor activo y el aprovechamiento de Power Shot en cada oportunidad. No se debe tratar como rendimiento esperado de una cacería normal.

## Diferencia entre los paquetes elementales

Element Focus sacrifica el potenciador del tipo de flecha en su componente físico para mantener solo cinco líneas principales; su rendimiento es mucho peor. En Guild, sus ratios agregados base son 0,588 LR, 0,648 HR y 0,691 G. Element Core y Element Full, que conservan el potenciador del tipo de flecha, funcionan mejor. Esto respalda mantener la habilidad del tipo de flecha en la build elemental cuando el presupuesto de habilidades lo permite.

Las cifras de los paquetes son benchmarks de habilidades, no sets reales optimizados pieza por pieza. Element Full utiliza más líneas/puntos de habilidad que el paquete RAW de referencia; por ello esta matriz no constituye todavía una comparación de armaduras con slots idénticos. El resultado es una señal fuerte de desventaja, pero la fase de aprobación debe incluir un optimizador de builds o una comparación de presupuestos realmente equivalentes.

## Diferencias por tipo de flecha (Guild, Elemental Full, base)

Ratio medio de todas las partes del tipo, seguido del ratio en las partes con hitzone elemental ≥25:

| Rango | Salva / Rapid | Perforante / Pierce | Abanico / Spread | Pesada / Heavy |
|---|---:|---:|---:|---:|
| LR | 0,831 / 0,872 | 0,825 / 0,865 | 0,759 / 0,791 | 0,827 / 0,823 |
| HR | 0,824 / 0,872 | 0,846 / 0,875 | 0,835 / 0,862 | 0,873 / 0,874 |
| G | 0,793 / 0,835 | 0,814 / 0,855 | 0,887 / 0,903 | 0,852 / 0,855 |

Estos valores no se utilizan para justificar una compensación de Abanico. Se mantiene la decisión de conservar sus MV, multiplicadores y estadísticas originales. La tabla sirve para señalar que la brecha elemental depende del perfil de flecha y del rango; no se debe aplicar una corrección uniforme antes de desglosar las causas.

## Decisiones de trabajo después de la matriz

1. Mantener intactos los valores base originales por ahora y medir el cap 30 como escenario aparte. El inventario mostró que el cap reduciría el total de los valores naturales un 4,06 %, pero afectaría a 11 de las 55 líneas terminales.
2. No aprobar A ni B como solución final: la mejora observada en la línea base es demasiado pequeña frente a la diferencia que debe cerrarse.
3. No tratar la capacidad 50 de Element Coat como solución completa: en esta matriz la mejora agregada es pequeña.
4. Revisar el reparto del coating a lo largo de una misión: Elemental y Power Coating no tienen la misma capacidad, y un modelo más realista debe declarar explícitamente si permite cambiar de revestimiento cuando se agota el Element Coat y cómo cobra el tiempo de cambio.
5. Optimizar builds con presupuestos reales comparables de habilidades/ranuras antes de convertir índices en cambios de stats.
6. Desglosar por elemento, tipo, rango y familias con RAW/elemento extremo. La progresión compartida y las bifurcaciones deben mantenerse; no se escalan los 735 niveles linealmente.
7. Repetir el resultado con el cap 30 en la matriz Guild y comparar con esta línea base. No usar la media global para ocultar ramas concretas.

## Límites y cautelas

- No es DPS: no incluye tiempos de carga/animación, stamina, desplazamiento de la dispersión, impactos que no conectan, distribución de impactos en zonas distintas, daño por hit redondeado ni defensas/fases del monstruo.
- La primera tabla de hitzones es la única usada; las tablas paralelas no etiquetadas quedan fuera.
- Frecuencia de Power Shot 1.0 y Valor uptime 1.0 son máximos teóricos.
- Ammo Saver está apagado porque no hay probabilidad de devolución fiable.
- Los multiplicadores A/B son hipótesis en el simulador, no valores del juego aprobados.
- Abanico no recibe multiplicador adicional ni ajuste de daño por riesgo de combate cercano en esta etapa; permanece exactamente según el acuerdo previo.
- No se han modificado los 735 registros de `data/weapons/bow.json`.
