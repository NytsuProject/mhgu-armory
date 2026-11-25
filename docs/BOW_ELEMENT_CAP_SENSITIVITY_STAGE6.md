# Auditoría del límite elemental 30 — etapa 6

Estado: herramienta de sensibilidad añadida. **No se ha aplicado el límite a `data/weapons/bow.json` ni a las estadísticas del juego.** El simulador conserva el valor original por defecto; `--element-cap=30` permite probar el acuerdo de no superar 30 de elemento mostrado sin destruir todavía los datos fuente.

## 1. Inventario del catálogo actual

Fuente: `data/weapons/bow.json`, SHA `ec48bf9390a2eaa1123bfdea11b76bb359483b3b`.

El catálogo contiene 735 registros de nivel en 107 segmentos de árbol. Al recorrer el campo `ele` aparecen 406 entradas; 368 corresponden a los cinco elementos naturales del arco (Fuego, Agua, Rayo, Hielo y Dragón), y 38 son otros tipos que no entran en este cálculo elemental.

| Rango | Registros elementales naturales | Sobre 30 | Exactamente 30 | Máximo actual | Media actual |
|---|---:|---:|---:|---:|---:|
| LR | 159 | 15 | 5 | 60 | 20,23 |
| HR | 101 | 6 | 1 | 60 | 17,37 |
| G | 108 | 9 | 1 | 40 | 17,54 |
| **Total** | **368** | **30** | **7** | **60** | — |

Un tope global de 30 afectaría al 8,2 % de los registros de nivel elementales, pero su impacto no se distribuye uniformemente: **11 de las 55 líneas terminales elementales naturales superan 30**. Los valores más extremos son:

| Arco terminal | Elemento | Valor actual | RAW mostrado | Rango |
|---|---|---:|---:|---|
| Aliento celestial | Hielo | 60 | 140 | LR |
| Arpa acuaballo | Agua | 60 | 70 | HR |
| Victoria laureada | Dragón | 35 | 300 | G |
| Firmamento lejano | Agua | 40 | 330 | G |

También hay etapas intermedias de esas líneas con 31–56 de elemento. Por eso un límite no se puede valorar mirando solo las armas G: cambiaría la progresión LR/HR y los escalones de mejora que conducen al arma final.

## 2. Qué hace ahora `--element-cap=30`

El simulador admite el parámetro opcional en `calculateShot`, `runMatrix` y `runMonsterMatrix`:

```bash
node tools/bow-elemental-scenarios.mjs --element-cap=30 --summary
node tools/bow-elemental-scenarios.mjs --hitzones=data/research/mhgu-hitzones.js --style=guild --element-cap=30 --monster-summary
```

- Se limita solo el elemento natural mostrado del arma: `effectiveElementValue = min(valor de catálogo, límite)`.
- La build elemental calcula sus habilidades porcentuales y el +6 plano después de aplicar el límite.
- El elemento innato de una build física/híbrida también usa el valor limitado; así el experimento no regala elemento a la build RAW.
- RAW físico, afinidad, MV, multiplicadores físicos, tipo y nivel de flecha, cargas, Power Coat y Element Coat no cambian.
- El informe conserva tanto `catalogElementValue` como `effectiveElementValue`, además de `elementCap`, para auditar qué valores fueron limitados.

Sin el parámetro, el simulador usa el elemento original del catálogo. El cap es una variable de experimento, no una modificación silenciosa ni una decisión de balance aplicada.

## 3. Por qué se prueba antes de editar los arcos

La auditoría Stage 5 mostró que el elemento no debe resolverse subiendo indiscriminadamente las cifras base. Primero se aíslan los modificadores elementales de carga, crítico elemental, coatings e impactos. El cap 30 debe probarse junto a esos escenarios, porque puede reducir mucho los arcos que hoy compensan RAW bajo con elemento muy alto.

La matriz sigue usando la primera tabla de hitzones de 93 monstruos grandes. Sus resultados son índices teóricos: todos los impactos posibles se asignan a la misma parte, sin redondeo por impacto, cadencia, stamina ni distribución real de proyectiles. No son DPS medido ni justifican por sí solos editar los 735 niveles.

## 4. Pruebas y siguiente decisión

Se añadió una prueba unitaria que verifica que el cap:
1. conserva visible el valor de catálogo original;
2. limita a 30 el valor efectivo antes de aplicar habilidades;
3. limita el elemento innato y el componente elemental, pero no el daño físico;
4. se transmite a la matriz por monstruo y queda registrado en sus metadatos;
5. rechaza límites negativos.

Siguiente paso: ejecutar la matriz completa de 93 monstruos con y sin cap 30, comparar LR/HR/G y los cuatro tipos de flecha, y solo entonces decidir si conviene aplicar el límite a todas las ramas o conservar excepciones justificadas por progresión. No se modifica Abanico ni se aprueba todavía A/B como multiplicadores definitivos.
