# Rebalance elemental del arco — Etapa 5
Estado: investigación y corrección de cálculo visual del Builder. No contiene todavía cambios a las estadísticas de los 735 niveles ni a los parámetros del juego.

## Objetivo de diseño

Separar de verdad las especializaciones:
- Arco RAW: RAW superior y escalado principal con Ataque, afinidad, crítico físico, revestimiento de potencia y potenciador del tipo de flecha.
- Arco elemental: RAW menor, elemento suficiente y escalado principal con multiplicadores elementales, revestimiento elemental y Crítico elemental.
- La comparación final será entre builds completas con un presupuesto de habilidades comparable. Objetivo orientativo: la build elemental puede superar en torno al 10% a la build RAW en matchups favorables; ante debilidades medias debe quedar cerca de la igualdad o ligeramente por encima. No se fuerza ventaja en hitzones elementales pobres.

## Fórmula y factores que sí afectan al elemento

Modelo de trabajo para un impacto elemental del arco:

`elemento real × multiplicador de carga × modificadores elementales × hitzone elemental`

El daño total de una descarga suma los impactos que conectan. La afinidad solo modifica el elemento cuando está activa la habilidad Crítico elemental. El MV físico de la flecha no multiplica el daño elemental.

### Multiplicadores recopilados para MHXX

| Factor | Valor de referencia | Alcance |
|---|---:|---|
| Carga 1 | ×0,70 elemento | Por impacto |
| Carga 2 | ×0,85 elemento | Por impacto |
| Carga 3 | ×1,00 elemento | Por impacto |
| Carga 4 | ×1,125 elemento | Por impacto |
| Revestimiento elemental I | ×1,35 elemento | Mientras está aplicado |
| Revestimiento elemental II | ×1,50 elemento | Mientras está aplicado |
| Crítico elemental | ×1,35 en arco | En impactos críticos; no es Crítico potente |
| Element Atk Up | +10% | Elemento |
| Potenciador elemental específico +1 | +5% y +4 planos | Solo ese elemento |
| Potenciador elemental específico +2 | +10% y +6 planos | Solo ese elemento |

La referencia comunitaria consultada indica que la parte porcentual de los potenciadores elementales se limita a +20%; las bonificaciones planas se añaden igualmente. Este límite debe contrastarse en juego antes de cerrar el rebalance.

### Carga y progresión de flechas

El número de proyectiles/impactos potenciales por nivel explica una parte importante del daño elemental. Valores recopilados:

| Tipo | Lv1 | Lv2 | Lv3 | Lv4 | Lv5 |
|---|---:|---:|---:|---:|---:|
| Salva / Rapid | 1 | 2 | 3 | 4 | 4 |
| Perforante / Pierce | 3 | 4 | 5 | 5 | 5 |
| Abanico / Spread | 3 | 3 | 5 | 5 | 5 |
| Pesada / Heavy | 1 | 1 | 1 | 1 | 1 |

Estos valores son impactos potenciales de la descarga, no Motion Values elementales. Cada impacto usa el multiplicador elemental de la carga; los MV 12/4/3/etc. pertenecen al componente físico. El número efectivo debe contar solo impactos que realmente conecten con el monstruo.

### Por qué no vamos a tocar el MV para aumentar elemento

Subir el MV físico potencia RAW, no el elemento por impacto. Hacerlo para solucionar el elemento reforzaría también las builds físicas y podría empeorar justamente el desequilibrio que se intenta corregir. Para elevar el rendimiento elemental hay que estudiar carga elemental, número de impactos conectados, hitzones elementales, revestimientos y habilidades elementales.

## Revisión de habilidades y revestimientos

- Element Atk Up (+10%) y el potenciador específico del elemento (+5% o +10% y bonificación plana) sí son multiplicadores distintos.
- Crítico elemental del arco aporta +35% al elemento en impactos críticos. Potenciador crítico solo modifica el crítico físico.
- Revestimiento elemental I/II aporta ×1,35/×1,50 al elemento.
- Elem C+ permite Elem Coat I desde +10 y todos los niveles desde +15. Su coste de habilidad debe incluirse al comparar builds.
- Revestimiento de potencia I/II afecta RAW, no elemento. Su acceso en arcos elementales se debe evaluar como alternativa de uso, no como bonificación elemental.
- Los potenciadores Rapid/Pierce/Spread/Heavy modifican el componente físico; no deben contarse como multiplicadores elementales.

## Auditoría de datos del catálogo

Fuente: `data/weapons/bow.json`, SHA `ec48bf9390a2eaa1123bfdea11b76bb359483b3b`.

- 107 árboles, 735 niveles.
- En las armas finales: 55 árboles con Fuego/Agua/Rayo/Hielo/Dragón; 6 con Explosión; 46 sin elemento/estado.
- De los 55 árboles con elemento real, 51 admiten algún revestimiento de potencia y 46 algún revestimiento elemental; 43 tienen compatibilidad con ambos grupos. Esto no los convierte automáticamente en híbridos, porque los revestimientos se alternan y tienen cargas limitadas. Sí obliga a comparar la build RAW y la elemental sobre el mismo arco.
- 24 de los 55 árboles elementales tienen Power Coating 2 y Element Coating 2 en la lista de compatibilidad final.

## Primera hipótesis de prueba para cargas

No se cambia ningún multiplicador del juego en esta etapa. La línea base a comparar es:

- Base actual: C1 0,70 / C2 0,85 / C3 1,00 / C4 1,125.
- Candidato moderado A: C1 0,70 / C2 0,90 / C3 1,05 / C4 1,25.
- Candidato B: C1 0,70 / C2 0,95 / C3 1,10 / C4 1,30.

A y B son escenarios para simulación, no valores aprobados. Deben medirse por cada perfil de flecha, por hits conectados, hitzones y tiempo de uso real de los revestimientos. En particular, Pesada no puede heredar automáticamente la misma conclusión que Salva, Perforante y Abanico, porque aporta muchos menos impactos elementales por descarga.

## Corrección de cálculo visual incluida en esta rama

`js/combat-stats.js` antes calculaba Element Atk Up (+10%) y Elemento +2 (+10%) multiplicando ambos: ×1,10 × ×1,10 = ×1,21. Con el tope porcentual documentado, la combinación positiva debe ser ×1,20, y el +6 plano del potenciador específico se conserva.

Esta corrección afecta a la cifra de elemento que muestra el Builder cuando se equipa el conjunto de habilidades. No modifica armas, daño real del juego ni estadísticas de `bow.json`.

## Abanico: parámetros originales preservados

Abanico queda fuera de los cambios de balance de esta etapa. Se conservan sus Motion Values, multiplicador Pellet/Abanico Up, RAW, elemento y cargas exactamente como en MHXX. En las simulaciones se utilizarán sus parámetros originales para contabilizar impactos e hitzones, sin asignarle una meta de ventaja adicional ni aplicar multiplicadores nuevos. Referencia descriptiva: [BOW_SPREAD_DAMAGE_ANALYSIS.md](BOW_SPREAD_DAMAGE_ANALYSIS.md).

## Pendiente de validación antes de tocar los 735 niveles

1. Contrastar en juego los multiplicadores de carga y el tope de buffs.
2. Medir el daño por impacto con y sin coating; aplicar redondeo por impacto.
3. Calcular builds RAW y elementales con coste de habilidades equivalente, incluyendo la disponibilidad/consumo de revestimientos.
4. Repetir por perfil de flecha y por elemento sobre los 93 monstruos grandes; no asumir que el mejor hitzone físico y el elemental están en la misma parte.
5. Ajustar progresión LR → HR → G por familia y rama, sin escalar niveles de forma lineal ni alterar el tipo de flecha salvo las reglas de Recargando ya acordadas.

## Fuentes consultadas

- [MHXX Bow Charge Levels and Modifiers](https://es.scribd.com/document/706766576/MHXX-BW-MVs) — tabla comunitaria de cargas, impactos, MV y revestimientos.
- [Kiranico MHXX — Elemental](https://mhxx.kiranico.com/en/skill/4a8e4) — habilidad Element Atk Up.
- [Kiranico MHGU — Elem C+](https://mhgu.kiranico.com/skill/48364) — desbloqueo de revestimientos elementales.
- [MHGU Skill Details](https://www.scribd.com/document/1013447337/MHGU-Skill-Details) — tiers elementales, Crítico elemental y habilidades de tipo de flecha.
- [Laxaria — MHGen Bow Damage Calculation](https://laxgg.blogspot.com/p/mhgen-damage-calculation-motion-values.html) — separación entre daño físico y elemental; advierte que parte de sus valores deriva de MH4U/MHGen, por lo que no se trata como fórmula oficial confirmada de MHXX.


## Auditoría de especialización

La investigación de fórmulas, impactos, coatings, habilidades y separación RAW/elemental está en [BOW_ELEMENTAL_SPECIALIZATION_AUDIT_STAGE5.md](BOW_ELEMENTAL_SPECIALIZATION_AUDIT_STAGE5.md). Incluye la corrección de Salva Lv5 (cuatro impactos) y la regla de preservar Abanico sin cambios. La herramienta reproducible de escenarios y su modo de comparación contra hitzones reales de 93 monstruos se documentan en [BOW_ELEMENTAL_SIMULATOR_STAGE5.md](BOW_ELEMENTAL_SIMULATOR_STAGE5.md).
