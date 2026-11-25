# Auditoría de ramas y progresión del arco — etapa 5

Esta auditoría reconstruye las rutas reales del catálogo a partir de los enlaces parent de data/weapons/bow.json. **Los 107 registros de árbol son segmentos, no 107 armas finales ni 107 familias.** Una familia puede bifurcarse en varias ramas y reutilizar niveles de su árbol padre.

La herramienta de auditoría es js/bow-branch-audit.js; su ejecutable es tools/bow-branch-audit.mjs. Solo lee el catálogo y genera un informe. No edita bow.json.

## Topología reconstruida

| Medida | Resultado |
|---|---:|
| Segmentos de árbol | 107 |
| Registros de nivel del catálogo | 735 |
| Familias raíz | 59 |
| Ramas terminales | 78 |

Para cada rama terminal se reconstruye la ruta completa: los niveles del árbol padre hasta el nivel exacto donde ocurre la bifurcación, más todos los niveles de cada segmento descendiente. Así se evita contar como progresión niveles del árbol padre que ya no pertenecen a esa rama.

## Clasificación de las ramas terminales

La clasificación se hace por el arma final de cada rama, no por cada segmento intermedio.

| Identidad final | Ramas |
|---|---:|
| Elementales naturales (Fuego, Agua, Rayo, Hielo o Dragón) | 41 |
| RAW / sin elemento elemental natural | 33 |
| Explosión | 4 |
| **Total** | **78** |

Por rango final:

| Rango | Elementales | RAW | Explosión |
|---|---:|---:|---:|
| LR | 10 | 9 | 1 |
| HR | 17 | 13 | 0 |
| G | 14 | 11 | 3 |

**Corrección de interpretación:** los recuentos previos de 55 ramas elementales, 6 de Explosión y 46 sin elemento estaban basados en segmentos/ramas intermedias del catálogo, no en las 78 ramas terminales reconstruidas. Para definir la especialización final se debe usar la tabla terminal de esta auditoría. Los segmentos intermedios se conservan para estudiar la progresión, pero no se deben contar como ramas finales independientes.

## Revestimientos en las armas finales

Compatibilidad de las 41 ramas elementales en su último nivel:

| Compatibilidad final | Ramas |
|---|---:|
| Power Coating 2 | 28 |
| Element Coating 2 | 26 |
| Ambos niveles II en el mismo arco | 19 |

En las 33 ramas RAW finales, 24 conservan Power Coating 2 y ninguna tiene Element Coating 2. Las cuatro ramas de Explosión son excepciones pequeñas y deben revisarse manualmente.

Además del estado final, el informe guarda coatingEver: registra si cada coating apareció en algún nivel anterior de la ruta. Esto distingue una rama que gana o pierde compatibilidad durante LR → HR → G de otra que nunca tuvo ese acceso. La disponibilidad de coating en un nivel concreto debe evaluarse con la entrada de ese nivel, no con el dato del arma final.

La conclusión no es retirar automáticamente todo coating cruzado: primero se revisa cada familia y cada bifurcación. El objetivo de diseño sigue siendo que la build elemental dependa principalmente del coating elemental y de la inversión de habilidades elementales, y la build RAW del coating de potencia y las habilidades físicas.

## Auditoría de Recargando / Load Up (!)

En los 735 registros del catálogo se localizaron:

| Medida | Resultado |
|---|---:|
| Cargas marcadas ! | 674 |
| Marcadas cuyo tipo ya coincide con la carga anterior | 233 |
| Marcadas cuyo tipo no coincide y requiere normalización | 441 |

Por posición:

| Slot | Marcadas | Requieren cambio de tipo |
|---|---:|---:|
| C3 | 18 | 18 |
| C4 | 656 | 423 |
| **Total** | **674** | **441** |

La proyección acordada para el rebalance es uniforme: cada carga marcada ! hereda únicamente el **tipo de flecha del slot inmediatamente anterior**; conserva su nivel de carga y el marcador !. En consecuencia, C4 coincide con C3. El auditor muestra tanto el valor original como la forma normalizada para cada caso.

Esta es una propuesta de datos en memoria para revisar las familias. **No cambia bow.json ni el juego.** Abanico sigue usando sus tipos, niveles, MV, valores RAW y elemento originales; no se ha añadido ningún multiplicador ni compensación.

## Uso local

Desde la raíz del repositorio, con Node.js 18 o posterior:

    # Resumen de la topología y de Recargando
    npm run bow:audit -- --summary

    # Informe completo, con 78 rutas y los 441 casos detallados
    npm run bow:audit -- --out=tools/out/bow-branch-audit-stage5.json

El informe JSON incluye, por cada rama, la familia raíz, la lista de segmentos y niveles heredados, la identidad final, la rareza/rango, el historial de roles, RAW/afinidad/elemento, disponibilidad de coatings y las cargas originales/normalizadas de todos los niveles de la ruta.

## Validación automática

GitHub Actions ejecuta pruebas unitarias de reconstrucción de rutas, truncamiento de padres y normalización de !. También comprueba la topología del catálogo real (107 segmentos, 735 niveles, 59 familias, 78 ramas terminales) y los 674 marcadores / 441 diferencias de tipo. El informe de la rama se adjunta al artifact bow-balance-stage5-results.

## Siguiente fase de balance

Esta auditoría permite trabajar por rama terminal y progresión en vez de asignar un único rol a un segmento compartido. Todavía no aprueba cambios de estadísticas. Antes de modificar los 735 niveles, cada rama elemental deberá contrastarse contra ramas RAW disponibles en el mismo rango y con presupuestos de habilidad comparables, respetando el tipo de flecha de cada carga y el coste real de Recargando/coatings.
