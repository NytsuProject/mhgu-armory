# Daño de builds reales del arco — etapa 9

Esta fase calcula el daño esperado de las builds que realmente encontró el optimizador de armaduras. Usa el mismo arco, carga, estilo, secuencia y parte del monstruo para RAW, elemental e híbrido. No modifica el catálogo ni el juego.

## Fórmulas elementales por habilidad

Ataque del elemento +1 aporta +5% y +4 planos; +2 aporta +10% y +6 planos. Elemental +1 aporta +10% general. Los porcentajes se suman hasta un máximo combinado de +20%; el bono plano específico se conserva. La fórmula usada es:

`floor(elementoBase × min(1.20, 1 + bonoEspecífico + bonoGeneral) + bonoPlano)`

Por tanto, un arco con Agua 30 y Agua +2 más Elemental +1 calcula `floor(30 × 1.20 + 6) = 42`. Con Agua +1 más Elemental +1 calcula `floor(30 × 1.15 + 4) = 38`. Así se representa el nivel que la build realmente activó, en lugar de dar siempre +2 al perfil elemental.

Fuentes:
- [Kiranico — Agua +1/+2](https://mhgu.kiranico.com/skill/48764)
- [Kiranico — Elemental +1](https://mhgu.kiranico.com/skill/4a8e)
- [MHGU Skill Details — valores específicos y límite porcentual](https://www.scribd.com/document/1013447337/MHGU-Skill-Details)
- [Discusión comunitaria sobre el límite combinado del 20%](https://www.reddit.com/r/MHGU/comments/vrpnkw)

## Qué habilidades usa realmente

La herramienta reconstruye todos los puntos de cada set a partir de las piezas, talismán y joyas devueltos por el optimizador, reutilizando la regla de Torso Up y Talismán doble del constructor. Aplica únicamente las habilidades que la build ha activado: Ataque, Experto, Maza, Potenciador crítico, Crítico elemental y el potenciador de tipo de flecha correspondiente.

## Revestimientos y secuencia

- Power Coat I/II: ×1,35/×1,50 al componente RAW; se modelan 50 usos por pila más una combinación (+20).
- Element Coat I/II: ×1,35/×1,50 al componente elemental; se modelan 20 usos por pila más una combinación (+10).
- Híbrido: Element Coat primero y Power Coat después. `coatingSwitchShots` resta oportunidades completas de ataque; cero es la línea base y 1–2 son sensibilidades, no frames medidos.
- Estilo Guild: descarga principal más un Power Shot. Si la carga siguiente requiere Recargando y la build no lo tiene, el Power Shot repite la carga principal.
- Ammo Saver y la bonificación especial Close Range de Seregios no se contabilizan en esta etapa.

## Comparación por hitzones

Usa la primera tabla de hitzones de los 93 monstruos grandes, conserva el desglose por parte y empareja RAW, elemental e híbrido sobre la misma parte. Devuelve medias sobre todas las partes y medias de la mejor parte por monstruo.

Sigue siendo un índice teórico por descarga/secuencia: no simula la dispersión de las flechas de Abanico, las zonas atravesadas por Perforante, los frames, la cadencia real, la resistencia o el movimiento. Abanico conserva sus MV y modificador originales.

## Ejecución

```bash
node tools/bow-build-damage.mjs --builds tools/out/bow-build-optimizer-stage8.json --hitzones data/research/mhgu-hitzones.js --style guild --mission-shots 200 --coating-switch-shots 0
```

El informe contiene puntos reales por habilidad, componentes RAW/elemental, fases de coating, ratios emparejados por parte y agregados por monstruo. No es un medidor in-game ni una prueba de DPS por segundo.

## Decisiones preservadas

- No se modifican los 735 registros de `data/weapons/bow.json`.
- Las cargas A/B y cap 30 siguen siendo escenarios no aprobados.
- Abanico conserva sus MV, multiplicador y estadísticas.
