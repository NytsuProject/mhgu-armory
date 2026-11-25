# Simulador de balance elemental del arco — etapa 5

Este documento describe el modelo reproducible en `js/bow-balance-sim.js` y su ejecutable `tools/bow-balance-sim.mjs`.

**No es un mod del juego y no modifica el catálogo de armas.** Es un modelo comparativo de daño por descarga para evaluar las decisiones de balance antes de tocar las armas o los parámetros de MHXX.

## Ejecutar localmente

Node.js 18 o posterior.

En PowerShell, desde la raíz del repositorio:

```powershell
New-Item -ItemType Directory -Force data/research | Out-Null
Invoke-WebRequest -Uri "https://raw.githubusercontent.com/ArmoredRaven17/MHGU-Monster-Info/2553eb6627fbf73803d83bf10f2deb619b7f4a03/docs/data/hitzones.js" -OutFile "data/research/mhgu-hitzones.js"
node tools/bow-balance-sim.mjs --hitzones data/research/mhgu-hitzones.js --out tools/out/bow-balance-stage5.json --load-up-policy match-c3 --shots-per-stack 100 --skill-budgets 5,6,7
```

También se puede ejecutar `npm run bow:balance -- --hitzones data/research/mhgu-hitzones.js`.

La matriz devuelve JSON con:
- `summary`: medias/medianas por rango, tipo de flecha, escenario y presupuesto de habilidades.
- `matchups`: mejor candidato RAW y elemental por monstruo, en la primera tabla de hitzones.
- `sameWeapon`: comparación normalizada RAW/elemental usando la misma arma y una hitzone neutral artificial (disparo 45, cinco elementos 20).
- `meta`: supuestos, perfiles, política de Load Up y cantidad de armas procesadas por rango.

## Perfiles normalizados

Ambos paquetes tienen cinco habilidades ofensivas activas. Esto es una comparación normalizada por cantidad de efectos activos, **no una búsqueda de armadura completa ni una equivalencia exacta de puntos de habilidad**.

| Perfil RAW | Perfil elemental |
|---|---|
| Ataque +3 (+20 true RAW) | Ataque elemental general +10 |
| Experto +2 (+20 afinidad) | Elemento específico +2 |
| Maza / WEX (+50 afinidad en shot HZ ≥45) | Maza / WEX (+50 afinidad en shot HZ ≥45) |
| Potenciador crítico (crítico físico ×1,40) | Crítico elemental (×1,35 en críticos positivos) |
| Potenciador del tipo de flecha | Potenciador del tipo de flecha (solo físico) |

Los umbrales nominales suman 65 puntos para RAW y 55 para elemental. No se comparan esos totales como si los puntos de árboles distintos fuesen una moneda intercambiable: se muestran para transparencia y una posterior integración con piezas, joyas y talismanes reales.

El RAW mostrado del arco se convierte a true RAW dividiendo por 1,2; Attack +3 se aplica después como +20 true RAW. Esta conversión y varias fórmulas de arco proceden de guías MH4U/MHGen que deben contrastarse contra MHXX antes de usarse como prueba final. Fuente: https://laxgg.blogspot.com/p/mh4u-bow-damage-calculation-and-motion.html.

El perfil elemental aumenta el elemento mostrado mediante la combinación general/específica documentada en el Builder: hasta +20 % y +6 planos. Crítico elemental usa ×1,35 en impactos críticos positivos del arco. Referencias: https://mhgu.kiranico.com/skill/47ab4 y https://www.reddit.com/r/MHGU/comments/vrpnkw (esta última es fuente comunitaria).

## Cargas, MVs e impactos

Multiplicadores por slot de carga:

| Slot | RAW | Elemento |
|---|---:|---:|
| C1 | ×0,40 | ×0,70 |
| C2 | ×1,00 | ×0,85 |
| C3 | ×1,50 | ×1,00 |
| C4 | ×1,70 | ×1,125 |

Los MVs físicos se suman para el RAW. El elemento se calcula aparte, por impacto, con hitzone elemental y modificador de carga; **el MV físico nunca multiplica el elemento**.

Además del valor actual, la matriz ejecuta los dos candidatos de prueba:

| Escenario | C1 | C2 | C3 | C4 |
|---|---:|---:|---:|---:|
| Actual | 0,70 | 0,85 | 1,00 | 1,125 |
| A | 0,70 | 0,90 | 1,05 | 1,25 |
| B | 0,70 | 0,95 | 1,10 | 1,30 |

Los tres escenarios se cruzan con los tres escenarios de revestimiento y los tres presupuestos por defecto, así que se puede distinguir cuánto aporta cambiar la carga elemental de cuánto aporta dar más disponibilidad al coating. A y B siguen siendo hipótesis; ninguna se ha aplicado a armas ni a parámetros del juego. Se pueden seleccionar con `--charge-scenarios base,A,B` o ejecutar uno solo para aislarlo.


Se corrigió Salva Lv5 a cuatro flechas (12+4+3+3, 22 MV total). Perforante cuenta 3/4/5/5/5 impactos; Abanico 3/3/5/5/5; Pesada uno. Las tablas de MVs se basan en la guía de MHGen: https://laxgg.blogspot.com/p/mhgen-damage-calculation-motion-values.html. Son referencia de fórmula antigua, no confirmación binaria de todos los valores internos de MHXX.

### Load Up y C4

- `current`: conserva el tipo de flecha marcado para C4 en el catálogo.
- `match-c3` (valor por defecto): para una C4 marcada `!`, copia únicamente el tipo de flecha de C3; conserva el nivel de C4 y su multiplicador de carga. Es una **proyección de la regla solicitada para el rebalance**, no un cambio del JSON.
- C4 `!` añade un efecto activo adicional al presupuesto para representar el coste de Recargando / Load Up (+10).

## Revestimientos y coste de habilidades

Escenarios:
1. `uncoated`: sin revestimientos.
2. `native-single-stack`: mejor revestimiento nativo del tipo correspondiente.
3. `unlocked-II-single-stack`: Nivel II; si no está en el arco, añade una habilidad activa de C+ +15 al presupuesto.

| Revestimiento | Multiplicador | Capacidad por pila |
|---|---:|---:|
| Potencia I | ×1,35 RAW | 50 |
| Potencia II | ×1,50 RAW | 50 |
| Elemental I | ×1,35 elemento | 20 |
| Elemental II | ×1,50 elemento | 20 |

El modelo promedia el efecto sobre `--shots-per-stack` descargas (100 por defecto): una pila de 50 Power Coat II sobre 100 descargas produce ×1,25 de media en RAW; una pila de 20 Element Coat II produce ×1,10 de media en elemento. Se consume una unidad por descarga, no por flecha/impacto. El cálculo no incluye combinaciones ni reabastecimiento: para evaluar más consumibles se cambia `--shots-per-stack` y se amplía el modelo explícitamente, no se asume disponibilidad infinita.

Ammo Saver está desactivado por defecto. Kiranico solo dice que devuelve revestimientos ocasionalmente, sin publicar una probabilidad. El 20 % es una hipótesis comunitaria secundaria; se puede estudiar opcionalmente con `--ammo-saver-return-rate 0.2`, y en ese caso se añade una habilidad activa al presupuesto solo si el perfil realmente usa revestimiento.

Los coatings elementales están documentados como ×1,35/×1,50 y capacidad 20: https://laxgg.blogspot.com/p/mhgen-bow-mechanics.html. Kiranico confirma Elem C+ +10 para Nivel 1 y +15 para todos los niveles: https://mhgu.kiranico.com/skill/48364. El mod comunitario MHGU Rebalanced también usa capacidad 50 para Element Coat como propuesta de balance, no como dato del juego original: https://github.com/Potobc/MHGU-Rebalanced-Mod.

## Hitzones y límites

La matriz usa solo la **primera tabla** de cada monstruo grande. La fuente externa registra 93 monstruos grandes y 66 con tablas paralelas sin etiquetar; no atribuye esas tablas a enfurecido, roto o estados concretos: https://github.com/ArmoredRaven17/MHGU-Monster-Info.

Para cada descarga, el modelo supone que todas las flechas o ticks conectan con la misma parte seleccionada. Es un límite superior optimista; especialmente poco realista para Perforante y Abanico, donde los impactos pueden atravesar o dispersarse por varias partes. La matriz no calcula cadencia, tiempo de carga, gasto de resistencia, frecuencia de impactos reales, cambios de posición, modificadores defensivos de misión ni DPS por segundo.

Por ello:
- No se debe aprobar un multiplicador por una única fila ganadora.
- Una victoria teórica no equivale a una recomendación de build real.
- Los umbrales hitzone ≥25 (favorable), 15–24 (media) y ≤10 (pobre) solo agrupan el informe; son etiquetas analíticas, no categorías oficiales del juego.
- Antes del balance definitivo se debe añadir una secuencia de zonas por impacto, comprobar in-game las fórmulas críticas y contrastar la progresión por familia.

## Pruebas

`tests/bow-balance-sim.test.mjs` comprueba:
- separación de RAW y elemento;
- que un coating solo modifica su componente correspondiente;
- MVs e impactos de todos los tipos, incluida Salva Lv5;
- multiplicadores por slot de carga;
- proyección C4→tipo C3 manteniendo Lv;
- capacidad y promedio de revestimientos;
- coste extra de Load Up, C+ y Ammo Saver;
- separación LR/HR/G y parsing del hitzone global.

GitHub Actions ejecuta `npm test`, el smoke test del catálogo y la matriz contra un snapshot fijo de hitzones extraído del repositorio de referencia. El snapshot se fija por commit para evitar que cambios ajenos alteren silenciosamente los resultados.
