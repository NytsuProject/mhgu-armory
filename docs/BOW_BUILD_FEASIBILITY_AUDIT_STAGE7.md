# Auditoría de disponibilidad de habilidades del arco — etapa 7

Estado: inventario reproducible de las fuentes reales de habilidades para builds de arco. **No cambia el daño, las estadísticas de armas ni el juego.** Su propósito es preparar una comparación de builds con armaduras, joyas, talismanes y ranuras reales.

## Por qué esta fase es necesaria

Las matrices de las etapas anteriores comparaban paquetes abstractos de habilidades y contabilizaban sus umbrales de puntos y líneas. Eso permitió localizar la diferencia de rendimiento entre RAW y elemental, pero no demostraba que ambos paquetes pudieran montarse en una armadura real ni que tuvieran el mismo coste de ranuras.

El repositorio ya contiene el catálogo de armaduras, joyas, niveles de habilidades, talismanes y espacios de arma. Esta auditoría los consulta directamente para que la siguiente fase no use habilidades hipotéticas.

## Qué añade

- Construye los umbrales de habilidad por perfil RAW/elemental y por tipo de flecha usando los identificadores reales del juego.
- Separa el perfil elemental completo del híbrido Element Coat → Power Coat, y distingue desbloqueos de coating I (+10) y II (+15).
- Incluye opcionalmente Recargando (+10) y Ahorramunic. (+10).
- Cuenta las piezas de artillero y universales del rango elegido; informa cuántas piezas de cada ranura tienen cada habilidad, sus mejores aportes, las joyas válidas y los puntos de talismán en primer/segundo atributo.
- Resume los 735 niveles del catálogo de arco por rango, elemento, coatings nativos y ranuras de arma.

La auditoría valida cada umbral contra `data/armor/skill-levels.json`. Esto evita que el modelo invente umbrales que no estén presentes en los datos de MHGU.

## Ejecución

```bash
node tools/bow-build-feasibility-audit.mjs --rank G --out tools/out/bow-build-feasibility-stage7.json
```

También queda disponible:

```bash
npm run bow:build-audit
```

Se puede consultar otro rango con `--rank LR` o `--rank HR`.

## Hallazgo que debe guiar la siguiente fase

El inventario preliminar de rango G detecta una disponibilidad muy desigual. Por ejemplo, Power C+ solo aparece en cuatro piezas de armadura G para artillero/universal y su mejor aporte individual es +4; Elem C+ no aparece en ninguna pieza de armadura G. Por tanto, tratar esos desbloqueos como si fueran habilidades baratas y siempre accesibles puede sesgar el resultado híbrido. Deben resolverse a través de joyas/talismán y sus ranuras reales.

La disponibilidad individual de una pieza no demuestra que se pueda completar un set entero. El informe lo deja explícito: es una auditoría de fuentes, no un optimizador de cinco piezas. La siguiente fase debe usar sus datos para buscar sets legales completos (clase, sexo, cinco ranuras, ranuras de joyas, talismán de dos habilidades y ranuras del arco) y comparar RAW/elemental bajo el mismo presupuesto real. Hasta entonces no se aprueban multiplicadores A/B, valores base nuevos ni un tope universal de elemento.

## Decisiones preservadas

- Los 735 registros de `data/weapons/bow.json` no se modifican.
- El cap 30 sigue siendo un escenario de análisis, no una edición al catálogo.
- Las cargas A/B siguen siendo hipótesis, no parámetros aprobados.
- Abanico conserva intactos MV, modificador Pellet Up, RAW, elemento y cargas.
- Load Up sigue normalizándose solo en la simulación: el tipo de una carga marcada hereda el tipo de la carga inmediatamente anterior y conserva su nivel.

