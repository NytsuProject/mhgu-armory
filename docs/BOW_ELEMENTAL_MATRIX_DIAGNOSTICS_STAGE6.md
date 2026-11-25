# Diagnóstico de la matriz elemental completa — etapa 6

Estado: línea base reproducible completada. Este documento recoge la matriz Guild y Valor ejecutada contra las hitzones de los 93 monstruos grandes. Los resultados son índices comparativos teóricos; no son DPS ni una medición en juego.

## Ejecución de referencia

- GitHub Actions: [run #80 — línea base sin cambio de coatings](https://github.com/NytsuProject/mhgu-armory/actions/runs/45652008067).
- GitHub Actions: [run #111 — matriz híbrida completa, exitosa](https://github.com/NytsuProject/mhgu-armory/actions/runs/45657032192).
- Commit de la matriz híbrida: `2a60950450feb8035b791d344f810f81e0abea5c`.
- Artifact híbrido: `bow-balance-stage5-results`, contiene Guild, Guild con cap 30, Valor, auditoría de ramas y resumen del catálogo. Incluye Element Coat → Power Coat II; la variante económica I/II se añadió después y está en validación separada.
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

## Nueva lectura: cambiar de Element Coat a Power Coat

El segundo escenario completo modeló una misión de 200 disparos en dos fases: agotar primero Element Coat II (20 + 10 combinables) y cambiar después a Power Coat II (50 + 20). El coating elemental aumenta el componente elemental ×1,50; el coating de poder aumenta el físico ×1,50. No se aplican ambos al mismo disparo. El cambio se fijó a **0 disparos equivalentes perdidos** para medir el techo máximo; no significa que la transición in-game sea instantánea ni gratuita en tiempo.

### Guild: Element Full frente al híbrido máximo

| Rango | Element Full ratio | Híbrido Element II → Power II | Híbrido con Element Coat 50 | Híbrido en hitzones elementales ≥25 | Partes que ganan: Full → híbrido |
|---|---:|---:|---:|---:|---:|
| LR | 0,759 | 0,823 | 0,824 | 0,854 | 0 → 2 / 631 |
| HR | 0,835 | 0,906 | 0,907 | 0,932 | 0 → 4 / 631 |
| G | 0,887 | 0,961 | 0,963 | 0,975 | 5 → 34 / 631 |

El efecto es consistente: el relevo de coating eleva el índice por partes entre 6,4 y 7,4 puntos porcentuales, según rango. En G, el resumen por monstruo encuentra al menos una parte favorable al híbrido en 25 de los 93 monstruos grandes, frente a 4 con Element Full. Esto no significa que el híbrido supere RAW en todas las partes: su media total G queda todavía en 0,961 y su media en partes con hitzone elemental ≥25 en 0,975.

Aumentar Element Coat de 20 a 50 aporta mucho menos que permitir el relevo a Power Coat: el híbrido G sube de 0,961 a 0,963; HR de 0,906 a 0,907 y LR de 0,823 a 0,824. La prioridad de investigación pasa a ser el coste real de cambio y la posibilidad de tener Power Coat II, no elevar sin más la capacidad elemental.

### Valor: la misma secuencia, con dos Power Shots

| Rango | Element Full ratio | Híbrido Element II → Power II | Híbrido en hitzones elementales ≥25 | Partes que ganan: Full → híbrido |
|---|---:|---:|---:|---:|
| LR | 0,777 | 0,821 | 0,847 | 0 → 2 / 631 |
| HR | 0,855 | 0,903 | 0,926 | 0 → 3 / 631 |
| G | 0,908 | 0,959 | 0,971 | 5 → 22 / 631 |

Valor se mantiene como límite superior: uptime 1,0 y Power Shot usado en cada oportunidad. Aun así, el híbrido eleva el ratio G de 0,908 a 0,959 sin alcanzar paridad media con RAW.

### Capacidad 50 y límite elemental 30

La matriz Guild con `--element-cap=30` reproduce casi el mismo orden y los mismos valores agregados del híbrido máximo. La caída del ratio híbrido al aplicar el cap es prácticamente nula en LR, de aproximadamente 0,0003 en HR y nula a tres decimales en G. Esto indica que las armas/candidatos que ganan la comparación no dependen, en promedio, de los valores naturales superiores a 30 para que funcione el relevo de coatings. No significa que el cap sea inocuo para cada rama individual; sí que no invalida la conclusión de esta matriz.

### Coste de habilidades: no confundir el techo con una build barata

El híbrido máximo conserva Element Full y añade Power C+ a +15 puntos y una línea adicional cuando el arco no trae Power Coat II de fábrica. Si tampoco tiene Element Coat II, el paquete elemental ya incorpora Elem C+ a +15. Es una inversión de habilidades relevante y desigual entre armas.

Por eso el híbrido máximo no debe ser la única variante que usemos para decidir el balance. La siguiente variante económica conserva el nivel II cuando es nativo, usa nivel I si el arco lo ofrece y desbloquea solo nivel I con +10 cuando no tiene coating nativo. Los multiplicadores de nivel I son ×1,35 frente a ×1,50 de nivel II. Su matriz todavía debe validarse por separado antes de comparar sus ganadores y costes reales.

### Qué significa para el rebalance

1. No aprobar todavía aumentos grandes de valores elementales base: el relevo de coating explica una parte importante de la brecha observada en el primer análisis.
2. Mantener la variante de Element Coat 50 como sensibilidad, no como solución principal: su ganancia adicional es pequeña frente a usar Power Coat después.
3. Comparar el híbrido máximo y el económico con presupuestos de habilidad equiparables; el híbrido máximo puede gastar +15 puntos en Power C+ por arma.
4. Medir en juego los segundos/frames de cambiar y aplicar coating, los menús y la oportunidad perdida. Hasta esa medición, `--coating-switch-shots=0` es un techo y 1–2 son solo sensibilidades.
5. No cambiar Abanico ni sus valores. Los resultados por tipo siguen siendo una matriz teórica por parte; la dispersión de las flechas y el riesgo de combate cercano no se simulan aquí.

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

En el resumen por monstruo (mejor parte de cada monstruo, no el agregado de todas sus partes), Elemental Full solo supera a RAW en cuatro matchups G: Yian Garuga y Deadeye Yian Garuga (ratio 1,073), Uragaan (1,043) y Bloodbath Diablos (1,009). En los cuatro, el candidato elemental elegido es **Elizabeth atenta**, Agua 30, con **Abanico Lv5!**. Son resultados de sus datos actuales, no de una compensación nueva. Se dejan tal cual: no se modifica Abanico, su MV ni su multiplicador.

## Decisiones de trabajo después de la matriz

1. Mantener intactos los valores base originales por ahora y medir el cap 30 como escenario aparte. El inventario mostró que el cap reduciría el total de los valores naturales un 4,06 %, pero afectaría a 11 de las 55 líneas terminales.
2. No aprobar A ni B como solución final: la mejora observada en la línea base es demasiado pequeña frente a la diferencia que debe cerrarse.
3. No tratar la capacidad 50 de Element Coat como solución completa: en esta matriz la mejora agregada es pequeña.
4. La secuencia Element Coat → Power Coat ya está modelada y mejora de forma sustancial el índice elemental. Antes de convertirla en una premisa de balance, validar el coste real de transición y comparar la versión máxima con la económica.
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
