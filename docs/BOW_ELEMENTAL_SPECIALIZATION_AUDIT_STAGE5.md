# Auditoría de especialización elemental del arco — Etapa 5

Estado: investigación y escenarios de balance. **No se han cambiado las estadísticas de los arcos, las cargas, los MV ni los parámetros del juego.** Abanico conserva exactamente sus valores originales.

## 1. Separar correctamente RAW y elemento

El daño físico de una flecha y el daño elemental no usan los mismos factores.

**Componente físico (esquema):**

`RAW real × afinidad física × habilidad del tipo de flecha × multiplicador RAW de carga × distancia crítica × revestimiento de potencia × MV físico × hitzone de disparo`

**Componente elemental (esquema):**

`elemento real tras habilidades × crítico elemental (si está activo) × multiplicador elemental de carga × revestimiento elemental × número de impactos × hitzone elemental`

La guía de arco de MHGen separa ambas fórmulas: el MV físico aparece en RAW, pero no en la fórmula elemental; el elemento se aplica por impacto. Como comprobación más específica de MHXX, la calculadora comunitaria Kuroyonhon también presenta fórmulas separadas: la física del arco contiene MV, tipo de flecha, carga, distancia y coating de potencia; la elemental contiene valor elemental, multiplicador de carga, coating elemental, Crítico elemental y hitzone, sin MV físico ni el modificador específico de Power Shot que aparece en la fórmula RAW. La guía de MHGen advierte que parte de sus fórmulas proceden de MH4U, así que se usa como referencia secundaria y no como prueba oficial. Fuentes: https://www.kuroyonhon.com/mhxx/d/dame.php y https://laxgg.blogspot.com/p/mhgen-damage-calculation-motion-values.html.

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

Los impactos de Perforante solo cuentan si realmente atraviesan y conectan con zonas del monstruo. En Salva y Abanico los impactos también pueden repartirse entre zonas diferentes. La simulación tendrá que distinguir impactos teóricos de impactos efectivos. En el arco Salva existe además un bug comunitariamente documentado en MHXX/GU: algunas flechas que coinciden en el mismo frame pueden no registrarse, con una pérdida de hasta ~10 %; el simulador permite probar una fiabilidad de 0,90 como sensibilidad, pero la línea base usa 1,00 porque no se ha validado la pérdida efectiva de cada carga.

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

El cálculo actual del Builder usa los efectos de referencia: elemento específico +1 = ×1,05 y +4; elemento específico +2 = ×1,10 y +6; Ataque elemental general = ×1,10. Cuando se combinan las bonificaciones porcentuales positivas, aplica un límite conjunto de +20 % y conserva el +6 plano del nivel específico +2. Crítico elemental de arco aumenta un 35 % el elemento en impactos críticos (×1,35 en ese impacto). Potenciador crítico, en cambio, potencia el crítico físico, no el elemento. Son efectos de sistemas distintos; no se deben sumar como si todos multiplicaran el daño total. Referencias: https://laxgg.blogspot.com/p/mhgen-armour-skills.html y https://mhgu.kiranico.com/skill/47ab4.

La guía de MHGen observa que los aumentos de elemento suelen aportar solo unos pocos puntos a la descarga y resultan menos atractivos que las habilidades de crítico/RAW para el arco. Esa es precisamente la desventaja que la revisión debe corregir, pero sin convertir las habilidades elementales en una mejora descontrolada para todas las armas.



### Coste real de desbloquear los coatings

- `Elem C+` a +10 habilita Element Coat I y a +15 habilita todos los niveles.
- `Power C+` a +10 habilita Power Coat I y a +15 habilita todos los niveles.
- `Ammo Saver` puede devolver ocasionalmente un revestimiento. Kiranico no publica una probabilidad; el 20 % aparece en fuentes comunitarias secundarias y solo debe modelarse como escenario de sensibilidad, nunca como valor base.

Esto significa que no basta con comparar ×1,50 contra ×1,50. Hay que comparar también el coste en puntos de habilidad y los usos disponibles.

El catálogo del Builder confirma la disponibilidad real de esta habilidad: `Elem C+` está registrado en `data/armor/skill-levels.json` y `data/armor/talisman-skills.json`, y tiene dos joyas (`+1` por 1 ranura y `+3` por 2). No aparece en ninguna pieza de armadura del catálogo, por lo que alcanzar +15 requiere combinar puntos de talismán y/o joyas; no se debe inventar una pieza que lo otorgue. `Power C+`, en cambio, aparece en ocho piezas además de talismán y joyas. El simulador cobra +15 puntos y una línea adicional cuando el arco no trae Element Coat II / Power Coat II de forma nativa. Referencias MHGU: https://mhgu.kiranico.com/skill/48364 y https://mhgu.kiranico.com/skill/40554. Guía de arco: https://laxgg.blogspot.com/p/mhgen-armour-skills.html.


### Cuánto aportan ya las habilidades elementales al componente elemental

Con la combinación positiva actual documentada en el Builder (tope porcentual conjunto de +20 % y +6 planos del elemento específico +2), el valor mostrado pasa de `E` a `1,20 × E + 6`. Crítico elemental de arco es ×1,35 en impactos críticos; con afinidad estable del 50 % equivale a ×1,175 medio en el componente elemental, y con 80 % equivale a ×1,28.

| Elemento base mostrado | Solo habilidades elementales (+20 % y +6) | Con Crítico elemental a 50 % afinidad | Con Crítico elemental a 80 % afinidad |
|---:|---:|---:|---:|
| 20 | ×1,50 | ×1,76 | ×1,92 |
| 30 | ×1,40 | ×1,65 | ×1,79 |
| 40 | ×1,35 | ×1,59 | ×1,73 |
| 60 | ×1,30 | ×1,53 | ×1,66 |

Esto es el crecimiento del **componente elemental**, no del daño total del disparo. El físico sigue sumándose aparte y puede ser una fracción muy grande del resultado. También muestra que el +6 plano pesa mucho más en LR/HR con elemento base bajo que en un arco con 60 de elemento.

Para estimar duración durante 200 disparos, se deben incluir también las combinaciones: Power Coat II dispone de 50 + 20 unidades combinadas; Element Coat II, 20 + 10. Kiranico describe Ammo Saver únicamente como una devolución ocasional y no especifica una tasa. La tabla usa un 20 % de retorno como hipótesis secundaria; el simulador nuevo lo deja en 0 % por defecto y permite introducir 0.2 solo para una prueba de sensibilidad.

| Build benchmark | Stock esperado | Cobertura de 200 disparos | Multiplicador medio del componente |
|---|---:|---:|---:|
| RAW · Power Coat II + Ammo Saver | 87,5 | 43,75 % | ×1,219 |
| Element Core · Element Coat II sin Ammo Saver | 30 | 15 % | ×1,075 |
| Element Core · Element Coat II capacidad 50, sin Ammo Saver | 60 | 30 % | ×1,150 |
| Element Full · Element Coat II + Ammo Saver | 37,5 | 18,75 % | ×1,094 |
| Element Full · Element Coat II capacidad 50 + Ammo Saver | 75 | 37,5 % | ×1,188 |

Estos promedios solo modelan la disponibilidad del revestimiento. No descuentan el tiempo de combinar/cambiar, no garantizan esa cantidad exacta y no son una medición de DPS. La diferencia de acceso a revestimientos introduce una desventaja sostenida en la build elemental; subir capacidad a 50 reduce parte de esa brecha, pero no transforma por sí solo el componente elemental en daño físico equivalente. Fuentes de capacidad y combinaciones: Yet Another Weapon Guide, secciones Power/Element Coating. Kiranico solo confirma que Ammo Saver devuelve revestimientos ocasionalmente: https://mhgu.kiranico.com/skill.

**Decisión provisional sobre las habilidades:** no voy a inflar todavía los porcentajes de las habilidades elementales globales. El paquete actual ya puede multiplicar aproximadamente ×1,5 el componente elemental en un arco de E=20, antes de coatings y hitzones. Primero aislaremos el problema de especialización del arco (RAW base, coating compatible y multiplicador de carga). Si después de eso el elemento no cumple la ventana de rendimiento, entonces se prueba un ajuste adicional de habilidad y se mide su impacto colateral en las demás armas.



### Nota de corrección para las cifras de Ammo Saver

Los porcentajes del cuadro anterior con Ammo Saver son un **escenario hipotético al 20 %**, no una cifra confirmada por Kiranico. El simulador Stage 5 no aplica devolución de forma predeterminada. Para reproducir esa hipótesis se usa `--ammo-saver-return-rate 0.2`; para la línea base se omite el parámetro o se deja en `0`.

## 6. Auditoría del catálogo actual: coating híbrido

Fuente: `data/weapons/bow.json`, SHA `ec48bf9390a2eaa1123bfdea11b76bb359483b3b`.

El catálogo contiene 107 segmentos de línea en 59 familias raíz. Hay 78 segmentos sin hijos, pero los segmentos padre conservan su propia continuidad hasta su último nivel: cada uno de los 107 segmentos tiene un extremo de línea que se debe incluir en la comparación. La clasificación por el último nivel de esos 107 segmentos es:
- 55 líneas elementales naturales (Fuego, Agua, Rayo, Hielo o Dragón).
- 46 líneas RAW / sin elemento natural.
- 6 líneas de Explosión.

Por rango final:
- LR: 22 elementales, 18 RAW y 2 Explosión.
- HR: 19 elementales, 17 RAW y 1 Explosión.
- G: 14 elementales, 11 RAW y 3 Explosión.

Entre las 55 líneas elementales, 51 permiten algún Power Coating, 46 algún Element Coating y 43 permiten ambos grupos. En sus niveles finales, 35 tienen Power Coating 2, 35 Element Coating 2 y 24 tienen ambos niveles II. Entre las 46 líneas RAW, 39 permiten algún Power Coating, ninguna permite Element Coating y 31 tienen Power Coating 2. Estas cifras miden compatibilidad del extremo de línea; el informe también registra si un coating aparece en niveles anteriores de cada ruta.

Cuatro familias raíz contienen líneas de identidades distintas:
- Arco petrificado: líneas elementales y RAW.
- Arco de cazador: líneas elementales y RAW.
- Arco recio de cazador: líneas elementales, RAW y Explosión.
- Arco gastado: líneas elementales y RAW.

**Corrección de interpretación:** los valores 55 elementales, 46 RAW y 6 Explosión sí corresponden a los 107 extremos de línea del catálogo. El recuento alternativo de 78 representa solo los segmentos sin hijos en el grafo y no debe usarse como número total de líneas finales. La auditoría completa, los linajes, los estados de coating y los 674 slots Recargando (441 desalineados con su carga anterior) están documentados en [BOW_BRANCH_PROGRESSION_AUDIT_STAGE5.md](BOW_BRANCH_PROGRESSION_AUDIT_STAGE5.md).

**Dirección de diseño para revisar por línea:** preservar las bifurcaciones existentes. En cada línea elemental final, revisar coating, RAW y elemento a través de toda su progresión; en cada línea RAW, mantener un camino físico claro. No se eliminará ni convertirá automáticamente una línea alternativa en híbrida.

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

## 8. Herramienta reproducible de escenarios

Los slots marcados `!` requieren Recargando. Una auditoría del catálogo completo encontró 674 slots `!`: 233 ya coinciden con el tipo anterior y 441 no lo hacen.

| Rango | Slots `!` | Coinciden | Necesitan alinear el tipo |
|---|---:|---:|---:|
| LR | 286 | 99 | 187 |
| HR | 170 | 53 | 117 |
| G | 218 | 81 | 137 |
| **Total** | **674** | **233** | **441** |

De los 674 slots, 656 son slot 4 (C4) y 18 son slot 3. El simulador normaliza esos 441 casos solo en memoria para aplicar la regla ya acordada (conserva nivel y `!`, cambia solo el tipo al de la carga anterior), y reporta tanto el cargo fuente como el normalizado. No se ha escrito ningún cambio en `bow.json`; la corrección permanente sigue pendiente de una revisión y una etapa de datos separada.

Se añadió `tools/bow-elemental-scenarios.mjs` y su prueba `tests/bow-elemental-scenarios.test.mjs`. La herramienta recorre los niveles elementales de `bow.json`, calcula los cuatro tipos de flecha y slots C1–C4, y compara tres escenarios elementales (base, A y B). Evalúa secuencias con estilos `none`, Guild, Adepto, Valor, Striker, Alquimia y Aéreo: Guild/Adepto incluyen un Power Shot; Valor, dos (el segundo con ×1,30 RAW); los otros estilos no. El primer Power Shot aumenta una carga; si ya se alcanzó la mayor carga disponible, repite esa carga. El seguimiento usa el slot siguiente y requiere Recargando si el slot lleva `!`. Para Valor se separan `powerShotUseRate` y `valorStateUptime`, de modo que no se presupone que el estado Valor esté activo toda la cacería. Hay cuatro perfiles sintéticos de hitzone: favorable (disparo 45 / elemento 30), medio (45 / 15), pobre (45 / 5) y zona elemental sin Maza (35 / 30).

Los paquetes comparados son benchmarks explícitos, no builds óptimas garantizadas. RAW y Elemental Core comparten Ataque +3, Ojo crítico +3, Maza y potenciador del tipo de flecha. RAW añade Potenciador crítico y Ahorramunic.; Elemental Core los cambia por Crítico elemental y el elemento específico +2, sin Ahorramunic. para mantener seis líneas principales y un coste de umbral cercano. Elemental Full añade Ahorramunic. y Elemental +1 como dos líneas adicionales. Ambos lados pagan el coste umbral de Power C+ / Elem C+ cuando la compatibilidad natural no incluye el revestimiento II, así como Recargando en una carga `!`. El reporte muestra líneas de habilidad y suma de umbrales; esta suma es un indicador comparativo, no una equivalencia exacta de ranuras de armadura.

El modo sintético compara el mismo arco con build RAW y elemental. `runMonsterMatrix` con `--hitzones=RUTA --monster-summary` lee localmente el archivo `hitzones.js` de MHGU-Monster-Info, recorre la primera tabla de los 93 monstruos grandes y elige el mejor arco RAW y el mejor arco elemental de todo el catálogo por parte y rango (LR/HR/G). No se copia esa base externa al repositorio. Ambos modos incluyen Power Shot según estilo y tasas configurables; el valor por defecto 1 para uso de Power Shot y uptime de Valor es una cota teórica, no una media medida. Todos los impactos teóricos se suponen conectados a la misma parte; en Perforante y Abanico es una cota optimista. No incluye artes, defensa del monstruo ni redondeo por impacto. Por eso no es DPS y no puede aprobar por sí solo un rebalance. Los comandos y límites quedan documentados en `BOW_ELEMENTAL_SIMULATOR_STAGE5.md`.



### Separación de los modificadores del Power Shot

El simulador trata `TrueShot Up ×1,20` y el segundo Power Shot de Valor `×1,30` como modificadores del componente físico RAW. La calculadora comunitaria MHXX separa la fórmula física del arco (incluye el modificador de剛連射 / Power Shot) y la fórmula elemental (incluye carga, coating elemental, Crítico elemental y hitzone, sin el modificador de Power Shot). Esto sustenta no aplicar esos factores al elemento. Fuente: https://www.kuroyonhon.com/mhxx/d/dame.php (fórmulas de daño en las líneas mostradas por la herramienta). La guía de habilidades de MHGen también especifica TrueShot Up como multiplicador RAW ×1,20 para Arc/Power Shot: https://laxgg.blogspot.com/p/mhgen-armour-skills.html.

## 9. Qué puede editarse con seguridad y qué falta localizar

La documentación de modding para el archivo de parámetros del arco `w10` enumera duración de Haste Rain/Blade Wire, modificadores de Power Shots de Valor, generación de gauge y multiplicadores RAW de Arc Shot. No documenta ahí el multiplicador elemental de las flechas normales ni los multiplicadores elementales C1–C4.

Referencia: https://github-wiki-see.page/m/RTHKKona/MHGU-Modding/wiki/Weapon-Parameter-Modding

El mod MHGU Rebalanced indica que el «ailment modifier» afecta tanto elemento como estados, pero su apartado de arco no documenta un cambio de ese modificador para las flechas normales; sí aumenta la capacidad de los revestimientos elementales y modifica otros parámetros propios del arco. Por tanto, **no se debe escribir a offsets desconocidos ni asumir que el valor de MV físico controla el elemento**. Antes de cambiar un modificador de impacto hay que localizar su tabla/estructura concreta y comprobar que afecta a elemento sin alterar indebidamente RAW o estados.

## 10. Protocolo de simulación y validación

Cada build debe compararse con un presupuesto comparable de habilidades, no con armas desnudas:
1. Build RAW: Attack, afinidad/Punto débil, Potenciador crítico, habilidad del tipo de flecha y uso sostenible de Power Coat.
2. Build elemental: Ataque elemental + habilidad del elemento, Crítico elemental cuando compense, acceso/revestimiento elemental y habilidad del tipo de flecha solo para el componente físico.

El simulador ya añade `skillCostComparison` para cada ganador por monstruo y `skillCostDelta` en el resumen, con los puntos y líneas usados por el perfil elemental y su referencia RAW. El perfil `elementalHybridLowCost` toma como denominador `rawLowCost`, pero esa política de coating no iguala por sí sola el coste total de habilidades. Es una auditoría de umbrales, no un set final con armadura, joyas y talismán optimizados.
3. Mismo nivel de carga, tipo de flecha, zona física y zona elemental cuando la geometría lo permita.
4. Contabilizar número realista de impactos, coating disponible y duración de cada coating.
5. Hitzones separados; 66 de los 93 monstruos grandes de la fuente tienen varias tablas paralelas sin etiqueta confirmada. Se utilizará la primera tabla como línea de base y no se etiquetarán las otras como enfurecido/roto sin prueba.
6. Ejecutar la matriz por LR, HR y G, y comprobar continuidad de cada familia y ramas.

Objetivo de rendimiento acordado:
- Debilidad alta: build elemental cerca de +10 % frente a RAW.
- Debilidad media: elemental en paridad o ligeramente por encima.
- Debilidad pobre: RAW debe conservar ventaja clara.

Los ratios y recuentos de victoria que aparecen en las matrices son índices teóricos por parte, no una medición de DPS real ni una aprobación de nuevos valores. La matriz de hitzones usa la primera tabla disponible y supone que los impactos teóricos conectan la misma parte. Aunque ahora se informan diferencias de puntos/líneas, todavía falta optimizar builds reales con armaduras, talismanes y joyas bajo presupuestos equivalentes, y validar distribución de impactos/tiempos dentro del juego.

## 11. Abanico preservado

Abanico queda exactamente como en MHXX. No se cambian MVs, multiplicadores, estadísticas RAW/elemento, cargas ni habilidades. Se utilizarán sus parámetros actuales en las pruebas generales, sin una meta de daño adicional específica.
