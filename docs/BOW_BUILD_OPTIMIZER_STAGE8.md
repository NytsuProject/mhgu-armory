# Optimizador de builds reales del arco — etapa 8

Esta fase transforma los paquetes de habilidades de las etapas anteriores en builds legales de equipo. Lee los catálogos existentes de armaduras, joyas, talismanes, habilidades y arcos. No modifica estadísticas ni aplica cambios al juego.

## Restricciones modeladas

- Cinco piezas de armadura con rango correcto.
- Para arco, las cuatro piezas corporales deben ser artillero (G) o universales (A). El casco admite también piezas de espadachín (B), igual que el constructor del proyecto.
- Búsquedas masculina y femenina separadas; las piezas unisex se permiten en ambas.
- Un talismán, con hasta dos habilidades distintas y puntos disponibles en `talisman-skills.json`.
- Joyas reales de coste 1–3, colocadas en una pieza individual con capacidad suficiente. No se usa una suma global ficticia de ranuras.
- Ranuras propias del arco.
- Umbrales de activación consultados en `skill-levels.json`.
- Recargando cuando la carga seleccionada lo exige.
- Revestimientos nativos y coste real de desbloquear nivel I o II con Power C+ / Elem C+.

## Perfiles

- `raw`: Ataque, Experto, Maza, Potenciador crítico y habilidad del tipo de flecha, más el acceso a Power Coat según el arco.
- `elemental`: Elemental, Ataque del elemento, Crítico elemental, Maza y habilidad del tipo de flecha, más Element Coat.
- `hybrid`: paquete elemental más acceso a Power Coat, modelando Element Coat → Power Coat.

La política `low-cost` conserva coatings nativos I/II y solo desbloquea nivel I cuando no existe ninguno. `max` busca nivel II y añade +15 cuando falta. `native` no desbloquea revestimientos.

## Ejecución

Ejemplo con Elizabeth atenta (árbol 104, nivel 3), carga 3 y dos ranuras:

```bash
node tools/bow-build-optimizer.mjs --weapon-tree 104 --weapon-level 3 --charge-slot 3 --profile all --rank G --gender both --coating-policy low-cost --beam-width 700
```

Opciones principales: `--weapon-tree`, `--weapon-level`, `--charge-slot 1..4`, `--profile raw|elemental|hybrid|all`, `--coating-policy native|low-cost|max`, `--rank LR|HR|G`, `--gender male|female|both`, `--beam-width N` y `--top-builds N`.

## Interpretación y límites

Cada resultado incluye las cinco piezas, el talismán, la distribución exacta de joyas, puntos finales, habilidades activadas/faltantes, habilidades negativas activadas y ranuras libres/usadas.

La búsqueda es un beam search acotado seguido de selección de talismán y colocación iterativa de joyas. Respeta las restricciones anteriores y solo devuelve builds físicamente montables, pero no garantiza un óptimo matemático global. Se puede aumentar `--beam-width` y contrastar las mejores soluciones encontradas.

Esta etapa todavía no aprueba multiplicadores A/B, cap 30 ni nuevos valores elementales. La siguiente fase debe calcular el daño con las habilidades realmente activadas en cada build y comparar RAW, elemental e híbrido bajo el mismo arco, carga, tipo de flecha y ranuras. Abanico conserva intactos sus MV, modificador y estadísticas.
