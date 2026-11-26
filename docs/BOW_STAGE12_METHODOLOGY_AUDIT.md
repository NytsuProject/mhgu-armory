# Auditoría metodológica del rebalance elemental del arco — Stage 12

**Base revisada:** `balance/bow-elemental-stage5` en `e47b970` (Stage 11 integrado).  
**Alcance:** corregir la validez de la comparación RAW / Elemental / Híbrida antes de usarla para aprobar nuevas estadísticas.  
**Estado:** un error de rango corregido; otras limitaciones quedan registradas y bloquean la aprobación final de las cifras Stage 11.

## 1. Corrección aplicada: rango de armadura en clase B

El selector de clase B ya filtraba los arcos por el rango pedido, pero las dos llamadas a `runProfileComparison()` —sondeo del candidato y construcción final— tenían `rank: "G"` fijo.

Consecuencia: una ejecución LR o HR elegía un arco LR/HR, pero optimizaba su armadura con piezas G. Eso invalida la lectura de progresión por rango y puede hacer que las builds LR/HR parezcan más completas u ofensivas de lo que serían en ese punto del juego.

**Corrección Stage 12:** ambas llamadas usan `rank: bowRank`. Se añadió una prueba de regresión sobre el driver para evitar que el selector vuelva a fijar el rango G. El artefacto de selección incorpora ahora:
- `candidateCount`: cantidad total de niveles de arco elegibles para rango/tipo.
- `probed`: candidatos cuyo build se sondeó.
- `searchExhaustive`: indica si se sondeó el universo completo.

Las filas históricas LR/HR de Stage 11 quedan marcadas como provisionales y deben regenerarse. La comparación G no tiene este error de rango, pero conserva las limitaciones siguientes.

## 2. Limitaciones encontradas que siguen pendientes

### 2.1 La búsqueda del mejor arco no es exhaustiva

`enumerateProfileCandidates()` reúne los niveles de arco elegibles, pero `selectProfileBow()` ordena el universo por una puntuación de catálogo (`RAW` para RAW; `RAW + 2 × elemento` para Elemental/Híbrido), sondea como máximo 12 y evalúa daño de como máximo 4 candidatos.

Por tanto, el resultado es **el mejor entre los candidatos evaluados**, no necesariamente el mejor arco disponible del rango. El heurístico no incluye de forma suficiente afinidad, coating nativo, ranuras, nivel/tipo de carga, distribución de hitzones ni el set legal final. La cobertura queda visible en el JSON desde esta etapa; no se declara óptimo global.

### 2.2 Selección masculina aplicada también a la build femenina

El arco se selecciona usando un sondeo masculino. Después se construyen builds masculina y femenina para ese mismo arco. Esto no demuestra que el arma ganadora para un set masculino también sea la mejor para un set femenino. La selección futura debe hacerse por género o demostrar que las clasificaciones coinciden.

### 2.3 La comparación excluye las cargas marcadas `!`

El selector conserva solo cargas que no requieren Recargando. Así, la comparación Stage 11 no mide el beneficio de C4 ni valida la normalización C4→C3 aplicada en Stage 10. Las cargas `!` se excluyeron para no mezclar Recargando con el presupuesto ofensivo.

La solución correcta no es contar Recargando como ofensiva: debe registrarse como **coste de utilidad obligatorio** fuera del número de habilidades ofensivas, pero dentro de los requisitos reales de la build, sus puntos, joyas y ranuras. Después se comparan C3 y C4 con presupuestos ofensivos iguales y se muestra el coste adicional de Recargando.

### 2.4 Cuatro habilidades ofensivas no equivalen a inversión idéntica

El presupuesto actual iguala el número de habilidades ofensivas activadas. No iguala necesariamente:
- puntos requeridos y puntos excedentes;
- cantidad y coste de joyas;
- ranuras consumidas en armadura, talismán y arco;
- coste de Elem C+ / Power C+ y de Recargando;
- habilidades ofensivas alternativas que cada perfil deja fuera.

El presupuesto 4 es un control útil de cantidad de efectos, pero no debe describirse como igualdad económica perfecta. Las salidas futuras deben comparar coste total y mostrar puntos/ranuras restantes, además del conteo de habilidades.

### 2.5 La matriz de daño sigue siendo una estimación por parte, no DPS de cacería

El modelo usa la primera tabla disponible de 93 monstruos grandes. Para cada fila asigna todos los impactos posibles de una descarga a la misma parte. Esto no representa:
- la dispersión real de Abanico;
- el recorrido de Perforante por varias hitzones;
- flechas de Salva que pueden alcanzar zonas distintas o no registrarse;
- tamaño, orientación, movimiento y ventanas de ataque del monstruo.

El modelo sirve como comparación controlada por parte y como diagnóstico de límites, no como DPS medido. La ejecución usa Guild, 200 disparos, `coatingSwitchShots=0` y una frecuencia de Power Shot ideal de 1. Estos supuestos deben permanecer visibles y someterse a sensibilidad antes de convertir ratios en daño real de cacería.

### 2.6 La progresión tiene saltos grandes todavía

La auditoría Stage 11 encontró 23 saltos elementales superiores a 10, con máximo 18, aunque no encontró inversiones ni valores por encima de 30. El auditor de Stage 11 comprueba niveles consecutivos dentro de cada segmento, pero la auditoría siguiente debe reconstruir también los linajes entre segmentos padre/hijo. Se deben suavizar los tramos intermedios sin alterar padres, bifurcaciones, identidad elemental ni el cap 30.

### 2.7 Artefactos no persistidos en Git

Los JSON y CSV Stage 11 se escriben bajo `tools/out/`, carpeta excluida por `.gitignore`. El workflow actual tampoco adjunta esos 12 resultados Stage 11: adjunta artefactos de la matriz anterior. El reporte en Markdown no sustituye los JSON completos. La etapa de reproducibilidad debe ejecutar la matriz corregida en Actions y subir un artefacto descargable con selección de armas, builds, ratios por parte/banda y auditoría de progresión.

## 3. Reglas de balance que siguen vigentes

- Tope del elemento natural de catálogo: **30**.
- Los 55 finales elementales permanecen en **30** hasta que la nueva matriz demuestre que el ajuste de intermedios es necesario.
- Las seis líneas Explosión siguen fuera de la pasada elemental.
- No elevar todavía los multiplicadores de carga elemental ni la capacidad de Element Coat.
- No tocar RAW, Motion Values ni multiplicadores de los tipos de flecha.
- **Abanico permanece exactamente intacto**: sin bonus compensatorio, sin cambios de MV, RAW, elemento ni cargas.
- Mantener el tipo de C4 alineado con C3 cuando C4 requiere Recargando; no alterar el nivel ni el marcador `!`.

## 4. Secuencia correcta para cerrar el rebalance

1. Regenerar las comparaciones LR/HR/G con el rango de armadura correcto.
2. Encontrar el presupuesto ofensivo común máximo por rango y tipo de flecha; no asumir que el presupuesto 4 de G vale también para LR/HR. Excluir o etiquetar explícitamente builds incompletas.
3. Ampliar/justificar el shortlist de arcos y registrar cobertura, o ejecutar una selección exhaustiva optimizada por perfil y género.
4. Añadir comparación C3/C4 con Recargando como coste de utilidad obligatorio, separado del presupuesto ofensivo.
5. Publicar coste real de puntos, ranuras, joyas y talismán para RAW/Elemental/Híbrido.
6. Adjuntar los 12 JSON y CSV reproducibles de Stage 11 corregido como artefacto de GitHub Actions.
7. Revisar los saltos de progresión por linaje; después, revisar matchups por monstruo, elemento, rango y tipo de flecha.
8. Solo entonces decidir si se necesitan nuevos multiplicadores elementales. Cualquier candidato debe superar pruebas por hitzone favorable/media/pobre y no crear dominancia universal.

**Conclusión:** Stage 10 deja aplicadas decisiones acotadas y reversibles de catálogo. Stage 11 mejoró la comparación de builds, pero su tabla LR/HR estaba afectada por un rango de armadura incorrecto y su selección de arcos sigue siendo aproximada. Stage 12 prioriza validar el método; no se debe ajustar más el elemento base ni cambiar parámetros de combate hasta cerrar estas correcciones.
