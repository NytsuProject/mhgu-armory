# Simulador de escenarios RAW vs elemental — Etapa 5

Estado: herramienta de investigación, no modificador del juego. Lee `data/weapons/bow.json`; no cambia el catálogo ni los parámetros de MHXX. Abanico se conserva con sus MV y multiplicadores originales.

## Cómo ejecutarlo

Desde la raíz del repositorio, con Node.js 18 o posterior:

```bash
# Resumen por rango, elemento, tipo de flecha y matchup sintético
node tools/bow-elemental-scenarios.mjs --summary

# CSV detallado de todos los niveles elementales y sus cargas
node tools/bow-elemental-scenarios.mjs --csv=tools/out/bow-elemental-scenarios.csv

# Sensibilidad de Salva al bug que puede perder impactos simultáneos
node tools/bow-elemental-scenarios.mjs --summary --rapid-reliability=0.90

# Contraste sin devolución de revestimientos; 200 disparos de referencia
node tools/bow-elemental-scenarios.mjs --summary --ammo-saver-chance=0 --mission-shots=200

# Recalcular la capacidad actual suponiendo una capacidad modificada a 50
node tools/bow-elemental-scenarios.mjs --summary --element-coat-capacity=50
```

Opciones:
- `--summary`: imprime un JSON resumido.
- `--csv=RUTA`: escribe las filas detalladas en CSV (por defecto, `tools/out/bow-elemental-scenarios.csv`).
- `--mission-shots=N`: número de descargas de referencia para la disponibilidad de revestimientos (por defecto 200).
- `--ammo-saver-chance=0.20`: probabilidad de no consumir el revestimiento al disparar. Por defecto 0,20.
- `--element-coat-capacity=20`: capacidad actual de Element Coat II; el reporte compara también la propuesta de 50.
- `--rapid-reliability=1`: fiabilidad supuesta de impactos de Salva. 0,90 sirve como escenario de sensibilidad, no como medición comprobada por carga.
- `--no-load-up`: omite las cargas marcadas `!`; por defecto se incluyen con Recargando activo.

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

El resultado tiene cinco opciones elementales: Core/Full con capacidad Element Coat actual y Core/Full con capacidad 50 (además de la variante Lite/Saver que se informa en el resumen sintético). La build RAW incluye el daño elemental innato del propio arco, pero no Element Coat ni las habilidades elementales. Esto evita regalarle al lado RAW un arco con elemento sin contabilizar su pequeña contribución, y permite descubrir si una build física sigue ganando con un arco elemental.

La fuente externa advierte que los nombres de partes solo están confirmados para algunos monstruos; donde no hay nombre, el archivo conserva índices. La herramienta usa el nombre publicado o un fallback `Parte N`, no intenta inferir si una tabla corresponde a enfurecido, roto u otro estado. No se descarga la fuente automáticamente: el usuario conserva control sobre los archivos externos y su licencia.

## Paquetes de habilidades comparados

Las dos bases comparten Ojo crítico +3 (+30 % afinidad), Maza (+50 % si hitzone de disparo ≥45), Ataque +3 (+20 ataque mostrado) y el potenciador del tipo de flecha. La carga marcada `!` se activa con Recargando en ambos paquetes.

**RAW de referencia (seis líneas principales):** Ataque +3, Ojo crítico +3, Maza, Potenciador crítico (crítico físico ×1,40), potenciador del tipo de flecha y Ahorramunic. Usa Power Coat II; si no está disponible de forma natural, el coste incluye Power C+ a +15.

**Elemental Core (seis líneas principales, comparación de presupuesto):** Ataque +3, Ojo crítico +3, Maza, potenciador del tipo de flecha, Crítico elemental (×1,35 en críticos de arco) y elemento específico +2 (+10 % y +6 planos). No lleva Potenciador crítico ni Ahorramunic.; usa Element Coat II y, si no está disponible de forma natural, incluye Elem C+ a +15. Su suma de umbrales es 85 puntos antes de C+/Recargando, frente a 80 de RAW; ambos tienen seis líneas principales.

**Elemental Full (paquete ampliado):** añade Ahorramunic. y Elemental +1 (+10 % general) a Elemental Core. Tiene dos líneas adicionales (ocho en total) y suma 105 puntos antes de C+/Recargando. En el modelo del Builder las bonificaciones porcentuales positivas general y específica se suman hasta +20 %, y se conserva el +6 plano; el elemento mostrado se redondea hacia abajo antes del cálculo.

Los costes reportados son umbrales de activación sumados y número de líneas de habilidad. No equivalen exactamente a huecos de joya ni demuestran que exista un set concreto con ese reparto. Los paquetes son benchmarks explícitos para entender las diferencias, no builds in-game probadas; los costes de desbloqueo C+ y Recargando se informan por separado.

## Fórmulas y límites

**RAW:** el índice suma MV físicos por cada flecha, multiplica por RAW verdadero (ataque mostrado del arco / 1,2), multiplicador RAW de carga, distancia crítica ×1,5, potenciador del tipo de flecha, hitzone de disparo, afinidad promedio con Potenciador crítico y revestimiento Power Coat II ×1,5.

**Elemento:** el elemento verdadero (valor mostrado /10) se multiplica por elemento tras habilidades, multiplicador elemental de carga, hitzone elemental, número de impactos y afinidad promedio cuando Crítico elemental está activo. El revestimiento Element Coat II aplica ×1,5. Los MV físicos no se utilizan en el componente elemental.

El modelo usa los MV publicados para MHXX/MHGen:
- Salva Lv1–5: 12 / 12+4 / 12+4+3 / 12+4+3+2 / 12+4+3+3; por tanto tiene 1, 2, 3, 4 y **4** flechas.
- Perforante: 3, 4, 5, 5, 5 impactos.
- Abanico: 3, 3, 5, 5, 5 impactos.
- Pesada: 1 impacto por nivel.

Los modificadores de carga elemental de base, A y B son los definidos en `docs/BOW_ELEMENTAL_REBALANCE_STAGE5.md`. Cuando se prueba A o B, el cambio se aplica tanto al elemento innato de la build RAW como a la build elemental: el multiplicador del juego es global, no un bonus exclusivo de la build.

**Coatings durante 200 disparos:** el modelo incluye Power Coat II (50 + 20 de combinaciones), Element Coat II actual (20 + 10) y la propuesta de Element Coat II de capacidad 50 (50 + 10). Con Ahorramunic al 20 %, el uso esperado se calcula como stock / 0,8. El modelo pondera los disparos con y sin revestimiento; no cuenta el tiempo de recarga/combinar ni asegura el número exacto de usos.

## Qué no afirma esta herramienta

- No calcula DPS ni daño final exacto del juego: conserva decimales y no aplica redondeo por cada impacto, defensa global, enfurecimiento ni variaciones de hitzone entre impactos.
- No incluye Power Shot, que puede representar una parte importante del daño real, ni estilos, artes, Valor, stamina, tiempos de carga, animaciones o ventanas de ataque.
- El modo sintético compara el mismo arco con builds distintas. El modo `--hitzones=... --monster-summary` sí compara el mejor RAW de todo el catálogo contra el mejor elemento por monstruo, parte y rango, usando solo la primera tabla de hitzones.
- No decide todavía qué multiplicador A/B debe aplicarse. Solo mide escenarios que después se validarán contra hitzones reales, progresión y pruebas in-game.
- No cambia `bow.json`, el Builder ni los parámetros de MHXX.

## Fuentes de trabajo

- [MHXX Bow Charge Levels and Modifiers](https://es.scribd.com/document/706766576/MHXX-BW-MVs) — valores recopilados para MHXX.
- [Laxaria — MHGen Bow Damage Calculation & Motion Values](https://laxgg.blogspot.com/p/mhgen-damage-calculation-motion-values.html) — fórmulas y MV; el propio autor advierte que parte de las fórmulas proviene de MH4U y se asume que permanece igual en MHGen.
- [Yet Another Weapon Guide — Bow, Coating Compendium](https://docs.google.com/document/d/1vuDNCYYhNvSPHMqPwoC2cyjF-qcuXztYsipi9jUZHa0/mobilebasic) — capacidad y combinaciones de los revestimientos, además de mecánicas de estilo.
- [Kiranico MHGU — Elem C+](https://mhgu.kiranico.com/skill/48364) y [Power C+](https://mhgu.kiranico.com/skill/40554) — umbrales de +10 / +15 para desbloquear revestimientos.
- [MHXX: Crítico elemental](https://game8.jp/mh-xx/831012) — Bow ×1,35 en críticos elementales.
- [MHGU: Ammo Saver](https://mhgu.kiranico.com/skill/43ae4) — habilita la devolución ocasional de revestimientos; la estimación de 20 % procede de la guía comunitaria MHGU Skill Details y se deja parametrizable.
- [Rapid Bow Bug explanation](https://www.reddit.com/r/MonsterHunter/comments/1brwdus) — la guía de arco de MHGU describe la pérdida potencial de impactos que coinciden en un frame; se trata como sensibilidad, no como corrección fija.
