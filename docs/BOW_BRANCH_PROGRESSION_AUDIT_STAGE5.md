# Auditoría de líneas, ramas y progresión del arco — etapa 5

Esta auditoría reconstruye las rutas reales del catálogo a partir de los enlaces parent de data/weapons/bow.json. **Los 107 registros de árbol son segmentos de línea, no 107 familias independientes.** Una familia puede contener varias líneas conectadas y cada segmento puede tener hijos que parten de un nivel anterior.

Hay una distinción importante para contar armas finales: cuando un segmento padre tiene una rama hija, **la línea original del padre no desaparece**. La interfaz del árbol sigue mostrando todos sus niveles hasta el último. Por eso se deben contar los extremos de los 107 segmentos, y no solamente los 78 nodos que no tienen hijos en el grafo.

La herramienta de auditoría es js/bow-branch-audit.js; su ejecutable es tools/bow-branch-audit.mjs. Solo lee el catálogo y genera un informe. No edita bow.json.

## Topología reconstruida

| Medida | Resultado |
|---|---:|
| Segmentos / líneas de árbol | 107 |
| Registros de nivel del catálogo | 735 |
| Familias raíz | 59 |
| Segmentos sin hijos en el grafo | 78 |
| Extremos de línea que se deben auditar como armas finales | 107 |

Para el extremo de cada segmento se reconstruye su linaje completo: los niveles del árbol padre hasta el nivel exacto donde comienza el enlace, los niveles de los segmentos intermedios hasta sus respectivos enlaces y todos los niveles del segmento actual. Además, cada segmento padre se conserva como una línea independiente hasta su propio último nivel. Esto evita dos errores opuestos: perder la continuación del padre o duplicar en una rama hija los niveles del padre posteriores a la bifurcación.

## Clasificación por extremo de línea

La clasificación se hace por el arma del último nivel de cada uno de los 107 segmentos.

| Identidad final | Extremos de línea |
|---|---:|
| Elementales naturales (Fuego, Agua, Rayo, Hielo o Dragón) | 55 |
| RAW / sin elemento elemental natural | 46 |
| Explosión | 6 |
| **Total** | **107** |

Por rareza/rango del último nivel:

| Rango | Elementales | RAW | Explosión |
|---|---:|---:|---:|
| LR | 22 | 18 | 2 |
| HR | 19 | 17 | 1 |
| G | 14 | 11 | 3 |

Estos son extremos de segmentos de línea, no 107 familias. El árbol continúa representando sus segmentos enlazados y sus bifurcaciones.

## Revestimientos en los extremos de línea

Compatibilidad en los 55 extremos elementales:

| Compatibilidad final | Extremos |
|---|---:|
| Cualquier Power Coating | 51 |
| Cualquier Element Coating | 46 |
| Ambos grupos | 43 |
| Power Coating 2 | 35 |
| Element Coating 2 | 35 |
| Ambos niveles II en el mismo arco | 24 |

En los 46 extremos RAW, 39 permiten algún Power Coating y ninguno permite Element Coating; 31 permiten Power Coating 2. Las seis líneas de Explosión tienen cinco con algún revestimiento de cada grupo, tres con Power Coating 2, cuatro con Element Coating 2 y tres con ambos niveles II. Esas ramas requieren revisión manual para decidir si deben tratarse como identidad física, elemental o estado.

El informe también guarda coatingEver: registra si un coating apareció en algún nivel anterior de la ruta. Esto permite distinguir un arma que obtiene o pierde compatibilidad durante LR → HR → G de otra que nunca tuvo ese acceso. La disponibilidad de coating en un nivel concreto debe evaluarse con la entrada de ese nivel, no con el dato del extremo final.

## Familias con bifurcaciones de identidad

Cuatro familias raíz contienen extremos de línea de más de una identidad:
- Arco petrificado: ramas elementales y RAW.
- Arco de cazador: ramas elementales y RAW.
- Arco recio de cazador: ramas elementales, RAW y Explosión.
- Arco gastado: ramas elementales y RAW.

La existencia de identidades distintas dentro de una familia no obliga a convertir toda la familia en un híbrido. Las ramas separadas deben conservar su propósito propio desde el nivel donde se bifurcan. El equilibrio debe revisar tanto el extremo final como los niveles que comparten antes de la bifurcación.

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

Por rango, las diferencias son:
- LR: 286 cargas marcadas; 187 desalineadas.
- HR: 170 cargas marcadas; 117 desalineadas.
- G: 218 cargas marcadas; 137 desalineadas.

La regla acordada para el rebalance es uniforme: cada carga marcada ! hereda únicamente el **tipo de flecha del slot inmediatamente anterior**; conserva su nivel de carga y el marcador !. En consecuencia, C4 coincide con C3. El auditor muestra tanto el valor original como la forma normalizada para cada caso.

Esta es una propuesta de datos en memoria para revisar las familias. **No cambia bow.json ni el juego.** Abanico sigue usando sus tipos, niveles, MV, valores RAW y elemento originales; no se ha añadido ningún multiplicador ni compensación.

## Uso local

Desde la raíz del repositorio, con Node.js 18 o posterior:

    # Resumen de la topología y de Recargando
    npm run bow:audit -- --summary

    # Informe completo, con linajes y los 441 casos detallados
    npm run bow:audit -- --out=tools/out/bow-branch-audit-stage5.json

El informe JSON incluye, por cada extremo de línea, la familia raíz, la lista de segmentos y niveles heredados, la identidad final, la rareza/rango, el historial de roles, RAW/afinidad/elemento, disponibilidad de coatings y las cargas originales/normalizadas de todos los niveles de la ruta.

## Validación automática

GitHub Actions ejecuta pruebas unitarias de reconstrucción de rutas, truncamiento de padres y normalización de !. También comprueba la topología del catálogo real (107 segmentos, 735 niveles, 59 familias, 78 segmentos sin hijos y 107 extremos de línea) y los 674 marcadores / 441 diferencias de tipo. El informe se adjunta al artifact bow-balance-stage5-results.

## Siguiente fase de balance

Esta auditoría permite revisar cada línea terminal y sus bifurcaciones sin confundir segmentos con familias o eliminar la continuación del árbol padre. Todavía no aprueba cambios de estadísticas. Antes de modificar los 735 niveles, cada línea elemental deberá contrastarse contra líneas RAW disponibles en el mismo rango y con presupuestos de habilidad comparables, respetando el tipo de flecha de cada carga y el coste real de Recargando/coatings.
