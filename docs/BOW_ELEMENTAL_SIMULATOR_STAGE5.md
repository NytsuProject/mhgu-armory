# Simulador de escenarios RAW vs elemental — Etapa 5

Estado: herramienta de investigación, no modificador del juego. Lee `data/weapons/bow.json`; no cambia el catálogo ni los parámetros de MHXX. Abanico se conserva con sus MV y multiplicadores originales.

## Cómo ejecutarlo

Desde la raíz del repositorio, con Node.js 18 o posterior:

```bash
# Resumen por rango, elemento, tipo de flecha y matchup sintético
node tools/bow-elemental-scenarios.mjs --summary --style=guild

# CSV detallado de todos los niveles elementales y sus cargas
node tools/bow-elemental-scenarios.mjs --csv=tools/out/bow-elemental-scenarios.csv

# Sensibilidad de Salva al bug que puede perder impactos simultáneos
node tools/bow-elemental-scenarios.mjs --summary --style=valor --rapid-reliability=0.90

# Contraste sin devolución de revestimientos; 200 disparos de referencia
node tools/bow-elemental-scenarios.mjs --summary --style=none --ammo-saver-chance=0 --mission-shots=200

# Recalcular la capacidad actual suponiendo una capacidad modificada a 50
node tools/bow-elemental-scenarios.mjs --summary --style=valor --valor-uptime=0.60 --power-shot-use-rate=0.75 --element-coat-capacity=50

# Añadir TrueShot Up al paquete de habilidades y al modificador RAW del Power Shot
node tools/bow-elemental-scenarios.mjs --summary --style=valor --true-shot-up
```

Opciones:
- `--summary`: imprime un JSON resumido.
- `--csv=RUTA`: escribe las filas detalladas en CSV (por defecto, `tools/out/bow-elemental-scenarios.csv`).
- `--mission-shots=N`: número de descargas de referencia para la disponibilidad de revestimientos (por defecto 200).
- `--ammo-saver-chance=0.20`: escenario opcional de probabilidad de devolver el revestimiento. Por defecto 0 (sin devolución asumida); al introducir un valor mayor que cero, Ammo Saver se considera equipado y su coste se suma al paquete.
- `--element-coat-capacity=20`: capacidad usada como línea base de Element Coat II; el reporte compara también la propuesta de 50.
- `--rapid-reliability=1`: fiabilidad supuesta de impactos de Salva. 0,90 sirve como escenario de sensibilidad, no como medición comprobada por carga.
- `--no-load-up`: omite las cargas marcadas `!`; por defecto se incluyen con Recargando activo.
- `--style=none|guild|adept|valor|striker|alchemy|aerial`: estilo a simular. Por defecto `guild`. Guild/Adepto generan un Power Shot; Valor genera dos; Striker/Alquimia/Aéreo no generan Power Shot.
- `--power-shot-use-rate=1`: fracción esperada de oportunidades en las que se dispara el Power Shot (0–1). Por defecto 1 es una cota de uso ideal, no una tasa real de cacería.
- `--valor-uptime=1`: proporción de la cacería en la que se mantiene el estado Valor (0–1). Solo afecta al estilo Valor; no es una cifra medida. Por defecto 1 representa el techo máximo.
- `--true-shot-up`: incluye el coste de habilidad +10 y aplica ×1,20 al componente RAW de cada Power Shot. La guía de datos MHXX lista ×1,20; se deja como supuesto separado a validar in-game.

## Qué compara

La herramienta recorre cada nivel de cada segmento del árbol de arco, no solamente los niveles finales. Separa LR/HR/G con la regla del proyecto (rareza 1–3 / 4–7 / 8–11). Para cada nivel con Fuego, Agua, Rayo, Hielo o Dragón, revisa cada slot de carga, calcula el MV físico, el número de impactos elementales y evalúa cuatro perfiles de hitzone:

| Perfil | Hitzone de disparo | Hitzone elemental | Interpretación |
|---|---:|---:|---|
| Favorable | 45 | 30 | Buen punto físico y debilidad elemental alta |
| Media | 45 | 15 | Buen punto físico y debilidad elemental media |
| Pobre | 45 | 5 | Buen punto físico y debilidad elemental baja |
| Elemental sin punto débil | 35 | 30 | Hitzone elemental alta sin activar Maza |

Estos perfiles son sintéticos, no monstruos. Todos los impactos teóricos se asignan a una misma parte. Es una cota alta especialmente para Perforante, cuyas cinco conexiones pueden cruzar hitzones diferentes, y para Abanico, cuyas flechas se distribuyen en abanico.


## Comparación real por hitzones de monstruos

La herramienta también puede leer un dump de hitzones externo, sin copiarlo ni redistribuirlo dentro de este repositorio. Fuente de datos utilizada en el proyecto de investigación: [ArmoredRaven17/MHGU-Monster-Info](https://github.com/ArmoredRaven17/MHGU-Monster-Info), que documenta su extracción desde los archivos `dt_tune` del RomFS y la cobertura de 93 monstruos grandes.

Descarga su archivo `docs/data/hitzones.js` a una ubicación local (por ejemplo, `../MHGU-Monster-Info/docs/data/hitzones.js`) y ejecuta:

```bash
# Resumen JSON: un resultado por monstruo y rango
node tools/bow-elemental-scenarios.mjs --hitzones=../MHGU-Monster-Info/docs/data/hitzones.js --monster-summary

# CSV por monstruo y rango
node tools/bow-elemental-scenarios.mjs --hitzones=../MHGU-Monster-Info/docs/data/hitzones.js --monster-csv=tools/out/bow-elemental-monster-matchups.csv

# Incluir además una prueba conservadora de fiabilidad para Salva
node tools/bow-elemental-scenarios.mjs --hitzones=../MHGU-Monster-Info/docs/data/hitzones.js --monster-summary --rapid-reliability=0.90
```

Este modo evalúa los niveles de **todo el catálogo**, incluidos arcos RAW y elementales. Para cada monstruo usa solo la primera tabla de hitzones (66 monstruos tienen tablas paralelas sin etiqueta verificada), recorre cada parte y selecciona por separado el mayor índice RAW y el mayor índice elemental dentro de cada rango (LR/HR/G). En cada arma, las flechas teóricas siguen suponiéndose conectadas a la misma parte. El arco elemental se compara con el mejor arco RAW del catálogo para esa parte/monstruo/rango, no solo contra su propio RAW.

Además de la comparación global que permite que gane cualquier tipo de flecha, cada matchup ahora incluye submatrices independientes para **Rapid, Pierce, Spread y Heavy**. Dentro de cada submatriz, el mejor arco RAW y el mejor elemental están obligados a usar el mismo tipo de flecha. Esto evita que un tipo dominante oculte la brecha real de los demás y permite estudiar Salva, Perforante, Abanico y Pesada sin alterar sus parámetros. Abanico se calcula con sus datos originales.

La comparación también se empareja por **la misma parte del monstruo**. Para cada parte se buscan el mejor candidato RAW y el mejor elemental con el mismo tipo de flecha; la relación elemental/RAW se calcula usando ese par. El resultado por monstruo selecciona la parte con la relación más favorable al elemento, pero conserva el desglose de todas las partes. El resumen incluye dos métricas distintas: la mejor relación por monstruo y la distribución de relaciones sobre todas las partes. No se divide el mejor daño elemental de una parte entre el mejor RAW de otra.

El modo de hitzones ofrece cuatro resultados elementales: Elemental Core/Full con capacidad Element Coat actual y Elemental Core/Full con capacidad 50. La build RAW incluye el daño elemental innato del propio arco, pero no Element Coat ni las habilidades elementales. Esto evita regalarle al lado RAW un arco con elemento sin contabilizar su pequeña contribución, y permite descubrir si una build física sigue ganando con un arco elemental.

La fuente externa advierte que los nombres de partes solo están confirmados para algunos monstruos; donde no hay nombre, el archivo conserva índices. La herramienta usa el nombre publicado o un fallback `Parte N`, no intenta inferir si una tabla corresponde a enfurecido, roto u otro estado. No se descarga la fuente automáticamente: el usuario conserva control sobre los archivos externos y su licencia.


## Power Shot y estilos de caza

El modo de secuencia ya no compara solo la flecha primaria. Para Guild/Adepto suma un Power Shot; para Valor suma Power Shot + Valor Power Shot; Striker, Alquimia y Aéreo quedan como estilos sin Power Shot. El seguimiento usa la carga del slot inmediatamente siguiente (por ejemplo, un disparo C3 puede seguirse con C4). Si el slot siguiente está marcado `!` y Recargando no está activo, el Power Shot repite el disparo principal; si está activo, utiliza la carga desbloqueada.

La regla del proyecto para Load Up se aplica antes de calcular el seguimiento: se conserva el Lv y `!`, y el tipo de flecha del slot marcado se alinea con el inmediatamente anterior. En el catálogo actual 441 de 674 slots marcados `!` no cumplen esa regla; el simulador los normaliza en memoria y guarda en la salida el texto original del catálogo. **No modifica `bow.json`.**

Cada descarga primaria se trata como una secuencia de una o varias voleas. La frecuencia de Power Shot es configurable; el valor 1 representa uso en cada oportunidad y debe considerarse techo optimista. El número de voleas por secuencia también aumenta el consumo esperado de coatings: Power Coat II y Element Coat II se promedian sobre todos los proyectiles de la secuencia, no solo sobre el disparo primario.

El segundo Valor Power Shot repite el mismo nivel de carga del primero y usa ×1,30 en el componente RAW, según la hoja de datos comunitaria de MHXX. TrueShot Up se modela como ×1,20 RAW para cada Power Shot y suma un umbral de habilidad; Kiranico confirma que potencia Power Shot/Arc Shot, pero la fuente consultada no desglosa con precisión su componente elemental. **Por prudencia, ambos modificadores se aplican al componente físico RAW del modelo y quedan como supuestos de trabajo, no como verificación in-game del desglose elemental.** Si se demuestra que afectan también al elemento, se activará ese factor en ambos componentes y se volverá a calcular la matriz.

Referencias: [manual oficial de Capcom sobre Power Shot](https://game.capcom.com/manual/MH_Gen/en-UK/page-123.html), [Yet Another Weapon Guide — estilos y secuencias](https://docs.google.com/document/d/1vuDNCYYhNvSPHMqPwoC2cyjF-qcuXztYsipi9jUZHa0/mobilebasic), [Kiranico — lista de habilidades MHGU](https://mhgu.kiranico.com/skill), [datos comunitarios MHXX Bow MV/Modifiers](https://es.scribd.com/document/706766576/MHXX-BW-MVs).



### Valor no debe asumirse activo durante toda la cacería

El estilo Valor añade dos Power Shots en la secuencia, pero solo mientras está activo el estado Valor. Para no tratar la barra como si estuviera al 100 % todo el tiempo, el simulador separa dos factores: `powerShotUseRate` (probabilidad de aprovechar la oportunidad de disparo) y `valorStateUptime` (fracción de la cacería en estado Valor). La tasa efectiva de seguimiento en Valor es el producto de ambos. Prueba sensibilidades de 0,4 / 0,6 / 0,8 / 1,0 en `--valor-uptime`; no interpretes 1,0 como rendimiento medio de un jugador.

El Power Shot normal sube un nivel respecto al disparo cargado anterior. Si se está en la carga máxima disponible, repite ese nivel; sus tipo de flecha y MV siguen la carga resultante. La guía de mecánicas de arco de MHGen documenta Guild/Adepto y esta regla; el manual oficial de MHXX describe剛射 (Power Shot) como acción propia del arco, pero la división exacta de estilos se contrasta con la guía comunitaria y los parámetros de estilo de MHGU. Para Guild/Adepto hay un Power Shot; para Valor el archivo de parámetros `w10` expone dos modificadores independientes. La guía de datos MHXX los recoge como `1` y `1,3` para el primer/segundo Power Shot de Valor. 

El modelo aplica `TrueShot Up ×1,20` y el segundo Power Shot de Valor `×1,30` al **componente RAW**; no los multiplica al elemento. Esto coincide con las fórmulas y notas comunitarias que identifican esos modificadores como físicos. Las cifras se conservan como hipótesis documentadas hasta confirmar su aplicación exacta en MHXX retail. Las duraciones de carga, gasto de stamina y ritmo real de animación no están incluidos: por tanto, ningún resultado se llama DPS.

## Paquetes de habilidades comparados

Las dos bases comparten Ojo crítico +3 (+30 % afinidad), Maza (+50 % si hitzone de disparo ≥45), Ataque +3 (+20 ataque mostrado) y el potenciador del tipo de flecha. La carga marcada `!` se activa con Recargando en ambos paquetes.

**RAW de referencia (cinco líneas principales, sin Ammo Saver):** Ataque +3, Ojo crítico +3, Maza, Potenciador crítico (crítico físico ×1,40) y potenciador del tipo de flecha. Usa Power Coat II; si no está disponible de forma natural, el coste incluye Power C+ a +15. Ammo Saver es una sensibilidad opcional, no parte de la línea base.

**Element Focus (cinco líneas principales, presupuesto comparable):** Ataque +3, Ojo crítico +3, Maza, Crítico elemental (×1,35 en críticos de arco) y elemento específico +2 (+10 % y +6 planos). No lleva Potenciador crítico ni potenciador del tipo de flecha. Usa Element Coat II y, si no está disponible de forma natural, incluye Elem C+ a +15. Su coste es 75 puntos / 5 líneas, frente a 70 / 5 de RAW. Al renunciar al potenciador del tipo de flecha, pierde parte del componente físico, pero mantiene los mismos multiplicadores elementales que Core.

**Elemental Core (seis líneas principales):** Ataque +3, Ojo crítico +3, Maza, potenciador del tipo de flecha, Crítico elemental (×1,35 en críticos de arco) y elemento específico +2 (+10 % y +6 planos). No lleva Potenciador crítico ni Ahorramunic.; usa Element Coat II y, si no está disponible de forma natural, incluye Elem C+ a +15. Su suma de umbrales es 85 puntos antes de C+/Recargando, frente a 70 de RAW; tiene una línea principal adicional y 15 puntos más.

**Elemental Full (paquete ampliado):** añade Elemental +1 (+10 % general) a Elemental Core. Tiene una línea adicional (siete en total) y suma 95 puntos antes de C+/Recargando. En el modelo del Builder las bonificaciones porcentuales positivas general y específica se suman hasta +20 %, y se conserva el +6 plano; el elemento mostrado se redondea hacia abajo antes del cálculo.

Los costes reportados son umbrales de activación sumados y número de líneas de habilidad. RAW base = 70 puntos / 5 líneas; Element Focus = 75 / 5; Element Core = 85 / 6; Element Full = 95 / 7, antes de C+ y Recargando. Si Ammo Saver se activa con `--ammo-saver-chance=0.20`, RAW pasa a 80 / 6 y Element Full a 105 / 8; Element Core no lo equipa. No se presenta el 20 % como dato verificado: Kiranico solo habla de devolución ocasional. No equivalen exactamente a huecos de joya ni demuestran que exista un set concreto con ese reparto. Los paquetes son benchmarks explícitos para entender las diferencias, no builds in-game probadas; los costes de desbloqueo C+ y Recargando se informan por separado.

## Fórmulas y límites

**RAW:** el índice suma MV físicos por cada flecha, multiplica por RAW verdadero (ataque mostrado del arco / 1,2), multiplicador RAW de carga, distancia crítica ×1,5, potenciador del tipo de flecha, hitzone de disparo, afinidad promedio con Potenciador crítico y revestimiento Power Coat II ×1,5. Power Coat II multiplica **solo el componente físico**; el elemento innato del arco se suma aparte y no recibe ese ×1,5.

**Element Focus:** conserva el elemento de Element Core, Crítico elemental, carga y coating, pero no aplica `SHOT_UP` al componente físico. Esto da una comparación con cinco líneas principales frente a las cinco de RAW; el coste de Elem C+ y Recargando sigue contabilizándose aparte.

**Elemento:** el elemento verdadero (valor mostrado /10) se multiplica por elemento tras habilidades, multiplicador elemental de carga, hitzone elemental, número de impactos y afinidad promedio cuando Crítico elemental está activo. El revestimiento Element Coat II aplica ×1,5. Los MV físicos no se utilizan en el componente elemental.

En el JSON completo, cada fila de monstruo contiene `parts`, con los candidatos RAW/elementales emparejados en cada parte y sus resultados por tipo de flecha; `scenarios` y `byShotType` resumen por monstruo la parte con la mayor relación elemental/RAW. Una relación mayor que 1 significa que la build elemental gana en esa parte concreta bajo los supuestos del modelo; no significa que el DPS real de la cacería sea mayor.

El modelo usa los MV publicados para MHXX/MHGen:
- Salva Lv1–5: 12 / 12+4 / 12+4+3 / 12+4+3+2 / 12+4+3+3; por tanto tiene 1, 2, 3, 4 y **4** flechas.
- Perforante: 3, 4, 5, 5, 5 impactos.
- Abanico: 3, 3, 5, 5, 5 impactos.
- Pesada: 1 impacto por nivel.

Los modificadores de carga elemental de base, A y B son los definidos en `docs/BOW_ELEMENTAL_REBALANCE_STAGE5.md`. Cuando se prueba A o B, el cambio se aplica tanto al elemento innato de la build RAW como a la build elemental: el multiplicador del juego es global, no un bonus exclusivo de la build.

**Coatings durante 200 disparos:** el modelo incluye Power Coat II (50 + 20 de combinaciones), Element Coat II actual (20 + 10) y la propuesta de Element Coat II de capacidad 50 (50 + 10). La línea base no asume devolución por Ammo Saver: se usan stocks sin dividir por una probabilidad no verificada. En la sensibilidad, Ammo Saver se equipa explícitamente y se aplica la tasa introducida por CLI a RAW y Elemental Full; Element Core no lo lleva. El modelo pondera los disparos con y sin revestimiento; no cuenta el tiempo de recarga/combinar ni asegura el número exacto de usos.

## Qué no afirma esta herramienta

- No calcula DPS ni daño final exacto del juego: conserva decimales y no aplica redondeo por cada impacto, defensa global, enfurecimiento ni variaciones de hitzone entre impactos.
- No simula el ciclo de carga, coste real de stamina, animaciones ni ventanas de apertura. Las tasas de uso de Power Shot y uptime de Valor son entradas estimadas; el valor 1 es techo teórico. No incluye Hunter Arts ni tiempos reales de cacería.
- El modo sintético compara el mismo arco con builds distintas. El modo `--hitzones=... --monster-summary` sí compara el mejor RAW de todo el catálogo contra el mejor elemento por monstruo, parte y rango, usando solo la primera tabla de hitzones.
- No decide todavía qué multiplicador A/B debe aplicarse. Solo mide escenarios que después se validarán contra hitzones reales, progresión y pruebas in-game.
- No cambia `bow.json`, el Builder ni los parámetros de MHXX.

## Fuentes de trabajo

- [MHXX Bow Charge Levels and Modifiers](https://es.scribd.com/document/706766576/MHXX-BW-MVs) — valores recopilados para MHXX.
- [Laxaria — MHGen Bow Damage Calculation & Motion Values](https://laxgg.blogspot.com/p/mhgen-damage-calculation-motion-values.html) — fórmulas y MV; el propio autor advierte que parte de las fórmulas proviene de MH4U y se asume que permanece igual en MHGen.
- [Yet Another Weapon Guide — Bow, Coating Compendium](https://docs.google.com/document/d/1vuDNCYYhNvSPHMqPwoC2cyjF-qcuXztYsipi9jUZHa0/mobilebasic) — capacidad y combinaciones de los revestimientos, además de mecánicas de estilo.
- [Kiranico MHGU — Elem C+](https://mhgu.kiranico.com/skill/48364) y [Power C+](https://mhgu.kiranico.com/skill/40554) — umbrales de +10 / +15 para desbloquear revestimientos.
- [MHXX: Crítico elemental](https://game8.jp/mh-xx/831012) — Bow ×1,35 en críticos elementales.
- [MHGU: Ammo Saver](https://mhgu.kiranico.com/skill/43ae4) — habilita la devolución ocasional de revestimientos. No se toma una tasa exacta como dato base; 20 % es una sensibilidad comunitaria y se activa explícitamente.
- [Rapid Bow Bug explanation](https://www.reddit.com/r/MonsterHunter/comments/1brwdus) — la guía de arco de MHGU describe la pérdida potencial de impactos que coinciden en un frame; se trata como sensibilidad, no como corrección fija.
