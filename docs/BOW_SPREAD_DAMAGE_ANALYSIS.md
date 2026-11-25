# Análisis del daño de Abanico — MHXX / MHGU

Estado: criterio de balance documentado para la Etapa 5. No se modifican MVs del juego ni las estadísticas de armas en este documento.

## Decisión de diseño

Abanico debe ofrecer una recompensa de daño ligeramente superior a Salva y Perforante cuando el jugador mantiene una ejecución eficaz a corta distancia. Esa ventaja compensa el riesgo de colocarse cerca del monstruo y la dificultad de permanecer en su distancia crítica.

**Objetivo de balance práctico:** en escenarios comparables y con una ejecución buena, Abanico debe quedar aproximadamente un 5% por encima del mejor perfil alternativo en daño físico sostenido. Es una meta de ajuste, no un multiplicador adicional que se aplique automáticamente.

No se debe confundir:
- Daño teórico de una descarga con todas las flechas conectando la misma zona.
- Daño real de una descarga, donde las flechas de Abanico se dispersan horizontalmente y pueden tocar distintas zonas, fallar o alcanzar hitzones menos favorables.
- Daño sostenido durante una cacería, donde también importan posicionamiento, ventanas de ataque, evasiones y tiempo sin atacar.

## Qué ya compensa a Abanico

### 1. Suma de valores de movimiento físicos por descarga

Los valores de movimiento recopilados para MHXX/MHGen son:

| Nivel | Salva | Perforante | Abanico | Pesada |
|---|---:|---:|---:|---:|
| Lv1 | 12 | 15 (3 × 5) | 13 (4+5+4) | 11 |
| Lv2 | 16 (12+4) | 16 (4 × 4) | 16 (5+6+5) | 14 |
| Lv3 | 19 (12+4+3) | 20 (5 × 4) | 23 (4+5+5+5+4) | 17 |
| Lv4 | 21 (12+4+3+2) | 20 (5 × 4) | 24 (4+5+6+5+4) | 19 |
| Lv5 | 22 (12+4+3+3) | 20 (5 × 4) | 26 (5+5+6+5+5) | 20 |

La suma es un techo de movimiento físico por descarga si conectan todos los impactos. No representa el daño garantizado: cada flecha puede golpear un hitzone distinto.

### 2. La habilidad de tipo de flecha ya diferencia Abanico

Los modificadores de daño RAW recogidos para MHXX son:

| Habilidad | Multiplicador RAW |
|---|---:|
| Salva / Normal Up | ×1,10 |
| Perforante / Pierce Up | ×1,10 |
| Abanico / Pellet Up | ×1,30 |
| Pesada / Heavy Up | ×1,10 |

Al multiplicar los valores anteriores por la habilidad de tipo correspondiente, el potencial teórico queda así:

| Nivel | Salva ×1,10 | Perforante ×1,10 | Abanico ×1,30 | Pesada ×1,10 |
|---|---:|---:|---:|---:|
| Lv1 | 13,2 | 16,5 | 16,9 | 12,1 |
| Lv2 | 17,6 | 17,6 | 20,8 | 15,4 |
| Lv3 | 20,9 | 22,0 | 29,9 | 18,7 |
| Lv4 | 23,1 | 22,0 | 31,2 | 20,9 |
| Lv5 | 24,2 | 22,0 | 33,8 | 22,0 |

Estas cifras son valores normalizados de movimiento (MV agregado × modificador de tipo), no puntos de daño observados. Suponen el mismo RAW, la misma carga, afinidad, distancia, coating y hitzone, y que todos los impactos llegan a una única zona equivalente. Es un techo útil para detectar exceso de daño, no un DPS real.

**Lectura:** si todos los impactos de Abanico pudieran concentrarse en una misma zona, su potencial ya sería mucho mayor que «ligeramente superior» desde Lv2, especialmente en Lv3–Lv5. No debemos sumar encima otro multiplicador universal hasta medir cuántos impactos conectan y qué zonas alcanzan.

## La distancia de Abanico

La distancia crítica del arco es un multiplicador RAW, no una bonificación elemental. La referencia de mecánicas consultada la describe como ×1,50 RAW en su ventana óptima y sitúa la ventana de Abanico más cerca del monstruo que las de Salva y Perforante. Estar todavía más cerca no concede daño gratis: salir de la distancia crítica puede reducir el resultado.

Por tanto, el riesgo de Abanico proviene del posicionamiento requerido, la proximidad a los ataques del monstruo y la dificultad de mantener todos los impactos en zonas útiles. El sistema no debe simular que «estar en melee» añade automáticamente un multiplicador.

## Elemento y número de impactos

El MV físico no multiplica el elemento. El daño elemental se aplica por impacto, junto con el multiplicador elemental de carga y el hitzone elemental.

| Nivel | Salva: impactos | Perforante: impactos potenciales | Abanico: impactos | Pesada: impactos |
|---|---:|---:|---:|---:|
| Lv1 | 1 | 3 | 3 | 1 |
| Lv2 | 2 | 4 | 3 | 1 |
| Lv3 | 3 | 5 | 5 | 1 |
| Lv4 | 4 | 5 | 5 | 1 |
| Lv5 | 4 | 5 | 5 | 1 |

Perforante aplica elemento por cada impacto de su recorrido. Abanico no necesita una bonificación elemental de tipo de flecha para competir: desde Lv3 ya tiene cinco impactos elementales potenciales por descarga. La cantidad efectiva depende del tamaño, el ángulo y el recorrido sobre el monstruo.

## Regla de balance que se aplicará

1. **No añadir un ×1,10 global a Abanico.** Ya tiene ×1,30 en Pellet/Abanico Up y MV agregado elevado.
2. **No subir automáticamente el RAW base de todos los arcos Abanico.** Eso también haría rentable una build física en arcos cuyo objetivo sea elemental.
3. **Calibrar una ventaja real aproximada de +5% en daño sostenido** sobre el mejor perfil alternativo, después de aplicar impactos útiles, hitzones y posicionamiento.
4. **En builds elementales**, Abanico puede aprovechar sus cinco impactos para competir en elemento, pero no se vuelve híbrido: mantiene el RAW base inferior de la familia elemental y su ventaja depende de habilidades elementales.
5. **En builds RAW**, el extra debe venir principalmente de MV, habilidad Pellet/Abanico Up y una ventana de uso más peligrosa. La ventaja final no debe crecer sin control respecto a Salva/Perforante.
6. El modelo de simulación separará los perfiles:
   - Salva: concentra impactos sobre una zona débil.
   - Perforante: aprovecha cuerpos largos y varias zonas útiles en línea.
   - Abanico: reparte impactos horizontalmente a corta distancia.
   - Pesada: un impacto alto, identidad física y capacidad de flinch/rotura.
7. Revisar Lv1 y Lv2 por separado: el perfil no presenta la misma ventaja relativa en toda su progresión.

## Consecuencia para la matriz de pruebas

Para cada monstruo no se asumirá que todos los impactos tienen el mismo hitzone. Se necesitarán, por separado:
- Daño por impacto a hitzone de referencia.
- Número esperado de impactos útiles por descarga.
- Distribución de los impactos entre zonas físicas/elementales.
- Proporción del tiempo de ataque dentro de la distancia crítica.
- Tiempo de ataque perdido por evasión/recolocación (solo cuando haya datos o un escenario explícito).

Mientras no exista evidencia sobre dispersión/impactos reales por monstruo, se reportará un rango de eficiencia (conservador/medio/óptimo), no una cifra ficticia de DPS exacto.

## Fuentes

- [MHXX Bow Charge Levels and Modifiers](https://es.scribd.com/document/706766576/MHXX-BW-MVs) — valores de carga, MV, distancia crítica y modificadores de tipo específicos de MHXX.
- [Laxaria — MHGen Damage Calculation & Motion Values](https://laxgg.blogspot.com/p/mhgen-damage-calculation-motion-values.html) — separación de RAW y elemento, multiplicadores de carga y MV. El autor declara que parte de los datos proviene de MH4U y que asume que se conservan en MHGen.
- [Laxaria — MH4U Bow Compendium](https://laxgg.blogspot.com/p/laxarias-bow-compendium.html) — comportamiento y distancia crítica de los perfiles; referencia mecánica, no prueba directa de cada hitbox de MHXX.
- [MHGU — Pellet Up (Kiranico)](https://mhgu.kiranico.com/skill/48a64) — confirma que Pellet/Spread Up afecta a flechas Abanico.
- [MHGU Skill Details](https://www.scribd.com/document/1013447337/MHGU-Skill-Details) — recoge ×1,30 para Spread y ×1,10 para Rapid/Pierce/Heavy.
- [Capcom — Bow Official Web Manual](https://game.capcom.com/manual/MH_Gen/en/page-123.html) — describe que Spread abre horizontalmente y que la carga eleva el daño.
