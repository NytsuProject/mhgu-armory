# Auditoría de especialización elemental del arco — Etapa 5

Estado: investigación y escenarios de balance. **No se han cambiado las estadísticas de los arcos, las cargas, los MV ni los parámetros del juego.** Abanico conserva exactamente sus valores originales.

## 1. Separar correctamente RAW y elemento

El daño físico de una flecha y el daño elemental no usan los mismos factores.

**Componente físico (esquema):**

`RAW real × afinidad física × habilidad del tipo de flecha × multiplicador RAW de carga × distancia crítica × revestimiento de potencia × MV físico × hitzone de disparo`

**Componente elemental (esquema):**

`elemento real tras habilidades × crítico elemental (si está activo) × multiplicador elemental de carga × revestimiento elemental × número de impactos × hitzone elemental`

La guía de arco de MHGen separa explícitamente ambas fórmulas: el MV físico aparece en RAW, pero no en la fórmula elemental; el elemento se aplica por impacto. La propia guía aclara que buena parte de sus fórmulas procede de MH4U y asume que no cambiaron en MHGen. Por ello se usa como base comparativa, no como prueba oficial de todos los detalles internos de MHXX. Referencia: https://laxgg.blogspot.com/p/mhgen-damage-calculation-motion-values.html

**Consecuencia para el mod:** subir los Motion Values físicos no es una herramienta apropiada para arreglar el elemento. Haría más fuertes las builds RAW y reforzaría precisamente el camino híbrido que queremos evitar. El elemento debe mejorar a través de los modificadores elementales, impactos, revestimientos, habilidades y la separación de estadísticas de las familias de armas.

## 2. Multiplicadores actuales de carga

| Carga | Multiplicador RAW | Multiplicador elemental |
|---|---:|---:|
| C1 | ×0,40 | ×0,70 |
| C2 | ×1,00 | ×0,85 |
| C3 | ×1,50 | ×1,00 |
| C4 | ×1,70 | ×1,125 |

El salto elemental entre C3 y C4 es solo del 12,5 %, mientras que el salto RAW es del 13,3 % aproximadamente (1,50 a 1,70). C4 no ofrece hoy una gran recompensa elemental relativa. Fuente comparativa: guía de arco anterior; validar en MHXX antes de aplicar.

Los candidatos que se probarán, sin aprobarlos todavía, son:

| Carga | Base | Escenario A | Escenario B |
|---|---:|---:|---:|
| C1 | 0,70 | 0,70 | 0,70 |
| C2 | 0,85 | 0,90 | 0,95 |
| C3 | 1,00 | 1,05 | 1,10 |
| C4 | 1,125 | 1,25 | 1,30 |

A y B son hipótesis de simulación, no cambios aprobados. C1 se deja quieta para no convertir la carga inicial en una opción de daño elemental sin coste. Se probará cuánto aportan A y B al daño total por perfil y rango; si no alcanzan el objetivo de especialización, habrá que estudiar otro mecanismo en lugar de inflar el elemento base.

## 3. Número de impactos elementales por descarga

Cada flecha o impacto de Perforante puede aplicar el elemento. El MV de esa flecha no determina cuánto elemento hace.

| Tipo | Lv1 | Lv2 | Lv3 | Lv4 | Lv5 |
|---|---:|---:|---:|---:|---:|
| Salva / Rapid | 1 | 2 | 3 | 4 | 4 |
| Perforante / Pierce | 3 | 4 | 5 | 5 | 5 |
| Abanico / Spread | 3 | 3 | 5 | 5 | 5 |
| Pesada / Heavy | 1 | 1 | 1 | 1 | 1 |

**Corrección importante:** Salva Lv5 tiene cuatro flechas, no cinco. En la tabla física el MV total de Salva Lv5 es 22, repartido en cuatro flechas (12+4+3+3). No se debe convertir ese 22 en un multiplicador elemental.

Los impactos de Perforante solo cuentan si realmente atraviesan y conectan con zonas del monstruo. En Salva y Abanico los impactos también pueden repartirse entre zonas diferentes. La simulación tendrá que distinguir impactos teóricos de impactos efectivos.

Fuente de referencia de valores y fórmula: https://laxgg.blogspot.com/p/mhgen-damage-calculation-motion-values.html

## 4. La desigualdad de los revestimientos es una palanca prioritaria

| Revestimiento | Multiplicador elemental/RAW | Capacidad documentada |
|---|---:|---:|
| Potencia I | ×1,35 RAW | 50 |
| Potencia II | ×1,50 RAW | 50 |
| Elemental I | ×1,35 elemento | 20 |
| Elemental II | ×1,50 elemento | 20 |

El revestimiento elemental alcanza el mismo multiplicador máximo por impacto que Potencia II, pero dispone de bastante menos munición. Eso reduce su contribución sostenida durante una cacería. El mod comunitario MHGU Rebalanced aumenta la capacidad de Elemental I y II de 20 a 50, lo que demuestra que este límite puede editarse mediante un mod. No implica que debamos copiar el resto de sus cambios: https://github.com/Potobc/MHGU-Rebalanced-Mod

**Prueba prioritaria:** mantener ×1,35/×1,50 y comparar capacidad 20 frente a 50. Esto aumenta la disponibilidad del camino elemental sin elevar el valor elemental de las armas. Se medirá también el coste de habilidad para desbloquear los revestimientos; no se asumirá que el jugador los tiene gratis.

## 5. Las habilidades no pagan igual el coste de especialización

La build física del arco acumula varias ventajas independientes:
- Punto débil aumenta afinidad al golpear zonas físicas adecuadas.
- Potenciador crítico mejora el crítico físico.
- Ataque aumenta el RAW.
- La habilidad de tipo de flecha potencia el componente físico: Salva/Perforante/Pesada y Abanico tienen sus propios valores.

La build elemental necesita invertir en:
- Ataque elemental general y la habilidad específica de Fuego/Agua/Rayo/Hielo/Dragón.
- Crítico elemental para que la afinidad también aumente el elemento.
- Acceso y capacidad de los revestimientos elementales.
- La habilidad del tipo de flecha seguirá siendo útil para su componente físico, pero no debe contarse como multiplicador elemental.

El cálculo actual del Builder aplica un límite conjunto de +20 % a las bonificaciones porcentuales positivas de Ataque elemental general y elemento específico, conservando el +6 plano del nivel +2. Crítico elemental para arco se documenta como ×1,35 en impactos críticos. Potenciador crítico, en cambio, potencia el crítico físico, no el elemento. Son efectos de sistemas distintos; no se deben sumar como si todos multiplicaran el daño total.

La guía de MHGen observa que los aumentos de elemento suelen aportar solo unos pocos puntos a la descarga y resultan menos atractivos que las habilidades de crítico/RAW para el arco. Esa es precisamente la desventaja que la revisión debe corregir, pero sin convertir las habilidades elementales en una mejora descontrolada para todas las armas.



### Coste real de desbloquear los coatings

- `Elem C+` a +10 habilita Element Coat I y a +15 habilita todos los niveles.
- `Power C+` a +10 habilita Power Coat I y a +15 habilita todos los niveles.
- `Ammo Saver` puede evitar consumir un coating ocasionalmente (20 % según la guía), por lo que debe incluirse al modelar la duración efectiva.

Esto significa que no basta con comparar ×1,50 contra ×1,50. Hay que comparar también el coste en puntos de habilidad y los usos disponibles. Referencias MHGU: https://mhgu.kiranico.com/skill/48364 y https://mhgu.kiranico.com/skill/40554. Guía de arco: https://laxgg.blogspot.com/p/mhgen-armour-skills.html.


### Cuánto aportan ya las habilidades elementales al componente elemental

Con la combinación positiva actual documentada en el Builder (tope porcentual conjunto de +20 % y +6 planos del elemento específico +2), el valor mostrado pasa de `E` a `1,20 × E + 6`. Crítico elemental de arco es ×1,35 en impactos críticos; con afinidad estable del 50 % equivale a ×1,175 medio en el componente elemental, y con 80 % equivale a ×1,28.

| Elemento base mostrado | Solo habilidades elementales (+20 % y +6) | Con Crítico elemental a 50 % afinidad | Con Crítico elemental a 80 % afinidad |
|---:|---:|---:|---:|
| 20 | ×1,50 | ×1,76 | ×1,92 |
| 30 | ×1,40 | ×1,65 | ×1,79 |
| 40 | ×1,35 | ×1,59 | ×1,73 |
| 60 | ×1,30 | ×1,53 | ×1,66 |

Esto es el crecimiento del **componente elemental**, no del daño total del disparo. El físico sigue sumándose aparte y puede ser una fracción muy grande del resultado. También muestra que el +6 plano pesa mucho más en LR/HR con elemento base bajo que en un arco con 60 de elemento.

Para estimar duración de Element Coat II durante los primeros 200 impactos: sin Ammo Saver, capacidad 20 da una media idealizada de ×1,05 sobre el total de impactos; capacidad 50 da ×1,125. Si Ammo Saver evita el consumo en 20 % de los usos, la expectativa teórica pasa aproximadamente a ×1,063 y ×1,156 respectivamente. Son promedios de disponibilidad, no DPS medido; en cacería real influyen cambios de coating, tiempo de recarga y pérdida de impactos.

**Decisión provisional sobre las habilidades:** no voy a inflar todavía los porcentajes de las habilidades elementales globales. El paquete actual ya puede multiplicar aproximadamente ×1,5 el componente elemental en un arco de E=20, antes de coatings y hitzones. Primero aislaremos el problema de especialización del arco (RAW base, coating compatible y multiplicador de carga). Si después de eso el elemento no cumple la ventana de rendimiento, entonces se prueba un ajuste adicional de habilidad y se mide su impacto colateral en las demás armas.

## 6. Auditoría del catálogo actual: coating híbrido

Fuente: `data/weapons/bow.json`, SHA `ec48bf9390a2eaa1123bfdea11b76bb359483b3b`.

En los 55 árboles cuyo nivel final tiene Fuego, Agua, Rayo, Hielo o Dragón:
- 51 permiten algún revestimiento de Potencia.
- 46 permiten algún revestimiento Elemental.
- 43 permiten ambos grupos.
- 35 tienen Potencia II y 35 tienen Elemental II.

Por rango, contando niveles con elemento:
- LR: 159 niveles elementales; 129 tienen ambos grupos de revestimientos.
- HR: 101 niveles elementales; 77 tienen ambos grupos.
- G: 108 niveles elementales; 65 tienen ambos grupos.

Esto confirma que muchas familias elementales conservan acceso al camino físico. Por sí solo, un revestimiento no determina la build, pero la combinación de RAW competitivo + Power Coat II + elemento + Element Coat facilita el híbrido.

**Dirección de diseño para revisar por familia:** las ramas definidas como elementales deben priorizar Element Coating I/II y no tener Power Coating II como opción dominante; las ramas RAW deben priorizar Power Coating I/II y no tener Element Coating como ruta equivalente. No se aplicará automáticamente a todo el catálogo: primero se clasifican familias completas y se revisan sus bifurcaciones y progresión LR→HR→G. Las familias excepcionales se marcan para revisión manual.


### Linaje completo: no mezclar ramas alternativas

El parent graph del catálogo contiene 107 segmentos conectados en 59 familias. Entre los 107 segmentos finales hay 55 con elemento natural, 46 RAW y 6 Explosión. Los 55 finales elementales se distribuyen en 22 LR, 19 HR y 14 G.

Solo cuatro familias conectadas contienen ramas finales elementales y también ramas finales RAW; una de esas cuatro tiene además una rama de Explosión. Cuatro familias conectadas tienen más de un elemento natural en sus ramas finales. Esto es bueno para el diseño: no hace falta convertir una familia entera en híbrida. Se pueden conservar ramas alternativas con identidad propia desde el punto de bifurcación, mientras cada rama elemental termina en un arco RAW deliberadamente secundario y cada rama RAW mantiene el elemento irrelevante.

Familias mixtas que requieren una revisión de sus bifurcaciones: Arco petrificado, Arco de cazador, Arco recio de cazador y Arco gastado. No se cambiarán sus padres ni se eliminarán ramas; el objetivo es equilibrar la progresión y coating de cada rama sin contaminar su identidad.

## 7. Cobertura de debilidades elementales en los monstruos grandes

Cruce preliminar de la primera tabla de hitzones de cada uno de los 93 monstruos grandes: partes con hitzone de disparo ≥45 (umbral relevante para Weakness Exploit) y hitzone elemental ≥20.

| Elemento | Monstruos con alguna parte que cumple ambos umbrales |
|---|---:|
| Fuego | 33/93 |
| Agua | 18/93 |
| Rayo | 20/93 |
| Hielo | 32/93 |
| Dragón | 13/93 |

No significa que cada arco de ese elemento sea automáticamente bueno en esos monstruos: el arma debe tener ese elemento, la carga/tipo debe conectar de forma fiable y las hitzones deben coincidir en la parte atacada. Esta tabla solo mide que existe una zona simultáneamente útil para físico y elemento. La fuente de hitzones advierte que 66 de los 93 monstruos tienen varias tablas paralelas sin etiquetar; para esta cobertura se ha utilizado solamente la primera tabla de cada monstruo para no atribuir estados no verificados.

## 8. Qué puede editarse con seguridad y qué falta localizar

La documentación de modding para el archivo de parámetros del arco `w10` enumera duración de Haste Rain/Blade Wire, modificadores de Power Shots de Valor, generación de gauge y multiplicadores RAW de Arc Shot. No documenta ahí el multiplicador elemental de las flechas normales ni los multiplicadores elementales C1–C4.

Referencia: https://github-wiki-see.page/m/RTHKKona/MHGU-Modding/wiki/Weapon-Parameter-Modding

El mod MHGU Rebalanced indica que el «ailment modifier» afecta tanto elemento como estados, pero su apartado de arco no documenta un cambio de ese modificador para las flechas normales; sí aumenta la capacidad de los revestimientos elementales y modifica otros parámetros propios del arco. Por tanto, **no se debe escribir a offsets desconocidos ni asumir que el valor de MV físico controla el elemento**. Antes de cambiar un modificador de impacto hay que localizar su tabla/estructura concreta y comprobar que afecta a elemento sin alterar indebidamente RAW o estados.

## 9. Protocolo de simulación y validación

Cada build se comparará con un presupuesto comparable de habilidades, no con armas desnudas:
1. Build RAW: Attack, afinidad/Punto débil, Potenciador crítico, habilidad del tipo de flecha y uso sostenible de Power Coat.
2. Build elemental: Ataque elemental + habilidad del elemento, Crítico elemental cuando compense, acceso/revestimiento elemental y habilidad del tipo de flecha solo para el componente físico.
3. Mismo nivel de carga, tipo de flecha, zona física y zona elemental cuando la geometría lo permita.
4. Contabilizar número realista de impactos, coating disponible y duración de cada coating.
5. Hitzones separados; 66 de los 93 monstruos grandes de la fuente tienen varias tablas paralelas sin etiqueta confirmada. Se utilizará la primera tabla como línea de base y no se etiquetarán las otras como enfurecido/roto sin prueba.
6. Ejecutar la matriz por LR, HR y G, y comprobar continuidad de cada familia y ramas.

Objetivo de rendimiento acordado:
- Debilidad alta: build elemental cerca de +10 % frente a RAW.
- Debilidad media: elemental en paridad o ligeramente por encima.
- Debilidad pobre: RAW debe conservar ventaja clara.

No se publican porcentajes de victoria de una simulación hasta modelar correctamente los presupuestos de habilidad, acceso a coatings, impactos efectivos y las tablas múltiples de hitzones. Las comparaciones preliminares simplificadas no son una medición de DPS real y no se usarán para aprobar valores.

## 10. Abanico preservado

Abanico queda exactamente como en MHXX. No se cambian MVs, multiplicadores, estadísticas RAW/elemento, cargas ni habilidades. Se utilizarán sus parámetros actuales en las pruebas generales, sin una meta de daño adicional específica.
