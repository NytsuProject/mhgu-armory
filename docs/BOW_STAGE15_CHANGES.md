# Informe de cambios: arcos antes y después del rebalance (Stage 15)

**Fecha:** 2026-11-25
**Catálogo comparado:** `data/weapons/bow.json` antes del Stage 15 (baseline
`1753a13`) vs después de la aplicación (commit `dc03d86`).

## Resumen global

| Indicador | Antes (baseline) | Después (Stage 15) |
|-----------|------------------|--------------------|
| Árboles | 107 | **116** (+9 ramas nuevas) |
| Objetivos cubiertos (matriz 72) | 53/72 | **72/72** |
| Árboles convertidos a elementales | 0 | **10** |
| Ramas nuevas | 0 | **9** |
| Split inventario terminal | 55 elemental / 49 raw / 3 blast | **74 elemental / 39 raw / 3 blast** |
| C4 `!` alineadas | 656/656 | **728/728** |

**Filosofía del rebalance:** los arcos que no cubrían objetivos elementales
(sin línea terminal con el elemento natural ≥20) se especializan:
- **Conversión:** se asigna un elemento natural al tope (30) y se reduce el
  RAW al rango típico de los arcos elementales del mismo rango (potencial
  físico sacrificado para la especialización elemental).
- **Rama nueva:** cuando no hay línea existente libre para convertir (o
  convertirla destruiría la cobertura RAW del objetivo), se añade un árbol
  nuevo heredero de un árbol padre, con progresión propia.

## 1. Árboles convertidos (10) — antes vs después

### 13 · Arco recio de cazador → Arco recio de cazador (Water)
| Nivel | Nombre | RAW antes | RAW después | Elemento antes | Elemento después |
|-------|--------|-----------|-------------|----------------|------------------|
| L1 | Arco recio de cazador | 90 | **73** | — | Water:3 |
| L2 | Arco recio de cazador | 100 | **81** | — | Water:5 |
| L3 | Arco recio de cazador | 110 | **90** | — | Water:8 |
| L4 | Arco recio de cazador | 120 | **98** | — | Water:11 |
| L5 | Arco recio de cazador | 140 | **114** | — | Water:14 |
| L6 | Arco recio de cazador | 160 | **130** | — | Water:16 |
| L7 | Arco recio de cazador | 200 | **163** | — | Water:19 |
| L8 | Arco orgullo cazador | 220 | **179** | — | Water:22 |
| L9 | Arco orgullo cazador | 250 | **204** | — | Water:25 |
| L10 | Arco orgullo cazador | 280 | **228** | — | Water:27 |
| L11 | Arco astucia cazador | 340 | **277** | — | Water:30 |

**Objetivo cubierto:** LR Water Heavy (C3/C4 Heavy).

### 60 · Arco de marfil → Arco de marfil (Ice)
| Nivel | Nombre | RAW antes | RAW después | Elemento |
|-------|--------|-----------|-------------|----------|
| L1 | Arco de marfil | 130 | **116** | — → Ice:4 |
| L2 | Arco de marfil | 150 | **134** | — → Ice:9 |
| L3 | Arco de marfil | 170 | **152** | — → Ice:13 |
| L4 | Arco helado | 190 | **170** | — → Ice:17 |
| L5 | Arco helado | 220 | **197** | — → Ice:21 |
| L6 | Arco helado | 250 | **223** | — → Ice:26 |
| L7 | Solsticio helado | 310 | **277** | — → Ice:30 |

**Objetivo cubierto:** LR Ice Spread (C3/C4 Spread).

### 80 · Ira infernal → Ira infernal (Fire)
| Nivel | Nombre | RAW antes | RAW después | Elemento |
|-------|--------|-----------|-------------|----------|
| L1 | Ira infernal | 170 | **164** | — → Fire:2 |
| L2 | Ira infernal | 170 | **164** | — → Fire:4 |
| L3 | Ira infernal | 180 | **174** | — → Fire:6 |
| L4 | Ira infernal | 180 | **174** | — → Fire:8 |
| L5 | Ira infernal | 190 | **183** | — → Fire:10 |
| L6 | Ira infernal | 190 | **183** | — → Fire:12 |
| L7 | Ira infernal | 200 | **193** | — → Fire:14 |
| L8 | Ira infernal | 200 | **193** | — → Fire:16 |
| L9 | Ira infernal | 220 | **212** | — → Fire:18 |
| L10 | Orgullo infernal | 220 | **212** | — → Fire:20 |
| L11 | Orgullo infernal | 270 | **260** | — → Fire:22 |
| L12 | Orgullo infernal | 280 | **270** | — → Fire:24 |
| L13 | Orgullo infernal | 290 | **280** | — → Fire:26 |
| L14 | Orgullo infernal | 300 | **289** | — → Fire:28 |
| L15 | Virtud infernal | 310 | **299** | — → Fire:30 |

**Objetivo cubierto:** G Fire Rapid (C3/C4 Rapid).

### 87 · Arco masacre → Arco masacre (Dragon)
| Nivel | Nombre | RAW antes | RAW después | Elemento |
|-------|--------|-----------|-------------|----------|
| L1 | Arco masacre | 370 | **270** | — → Dragon:6 |
| L2 | Arco masacre | 380 | **277** | — → Dragon:12 |
| L3 | Frenesí masacre | 390 | **284** | — → Dragon:18 |
| L4 | Frenesí masacre | 400 | **292** | — → Dragon:24 |
| L5 | Houyi | 410 | **299** | — → Dragon:30 |

**Objetivo cubierto:** G Dragon Pierce (C3/C4 Pierce).

### 91 · Ira y debacle → Ira y debacle (Water)
| Nivel | Nombre | RAW antes | RAW después | Elemento |
|-------|--------|-----------|-------------|----------|
| L1 | Ira y debacle | 270 | **269** | — → Water:10 |
| L2 | Furia y catástrofe | 280 | **279** | — → Water:20 |
| L3 | Cólera y maldad | 300 | **299** | — → Water:30 |

**Objetivo cubierto:** G Water Pierce (C3/C4 Pierce).

### 93 · Arco parterrayos → Arco parterrayos (Thunder)
| Nivel | Nombre | RAW antes | RAW después | Elemento |
|-------|--------|-----------|-------------|----------|
| L1 | Arco parterrayos | 220 | **220** | — → Thunder:10 |
| L2 | Acometida parterrayos | 250 | **250** | — → Thunder:20 |
| L3 | Dilución parterrayos | 270 | **270** | — → Thunder:30 |

**Objetivo cubierto:** G Thunder Spread (C3/C4 Spread). **RAW sin cambios**
(370→270 era la única conversión que ya estaba a rango elemental).

### 98 · Puño de Scylla → Puño de Scylla (Thunder)
| Nivel | Nombre | RAW antes | RAW después | Elemento |
|-------|--------|-----------|-------------|----------|
| L1 | Puño de Scylla | 180 | **170** | — → Thunder:5 |
| L2 | Puño de Scylla | 190 | **180** | — → Thunder:10 |
| L3 | Nershock | 200 | **189** | — → Thunder:15 |
| L4 | Nershock | 260 | **246** | — → Thunder:20 |
| L5 | Nershock | 290 | **274** | — → Thunder:25 |
| L6 | Nerscopio sombrío | 310 | **293** | — → Thunder:30 |

**Objetivo cubierto:** HR Thunder Rapid (C3/C4 Rapid).

### 100 · Arco salvaje → Arco salvaje (Thunder)
| Nivel | Nombre | RAW antes | RAW después | Elemento |
|-------|--------|-----------|-------------|----------|
| L1 | Arco salvaje | 150 | **133** | — → Thunder:6 |
| L2 | Arco salvaje | 170 | **151** | — → Thunder:12 |
| L3 | Falde bosque salvaje | 210 | **186** | — → Thunder:18 |
| L4 | Falde bosque salvaje | 240 | **213** | — → Thunder:24 |
| L5 | Falderol bosque salvaje | 330 | **293** | — → Thunder:30 |

**Objetivo cubierto:** HR Thunder Spread (C3/C4 Spread).

### 103 · Tirachinas Kayancha → Tirachinas Kayancha (Thunder)
| Nivel | Nombre | RAW antes | RAW después | Elemento |
|-------|--------|-----------|-------------|----------|
| L1 | Tirachinas Kayancha | 280 | **270** | — → Thunder:10 |
| L2 | Tirachinas Kayachacha | 290 | **280** | — → Thunder:20 |
| L3 | Kayachachan Shakalaka | 310 | **299** | — → Thunder:30 |

**Objetivo cubierto:** G Thunder Heavy (C3/C4 Heavy).

### 106 · Arco pirata J → Arco pirata J (Fire)
| Nivel | Nombre | RAW antes | RAW después | Elemento |
|-------|--------|-----------|-------------|----------|
| L1 | Arco pirata J | 170 | **166** | — → Fire:8 |
| L2 | Arco de bucanero J | 200 | **195** | — → Fire:15 |
| L3 | Arco de bucanero J | 280 | **273** | — → Fire:23 |
| L4 | Arco de rey pirata J | 300 | **293** | — → Fire:30 |

**Objetivo cubierto:** HR Fire Rapid (C3/C4 Rapid).

## 2. Ramas nuevas (9) — árboles añadidos

Cada rama nueva es un árbol de 8 niveles, heredero de un padre, con
elemento natural al tope 30, RAW típico de elemental y la flecha objetivo
en C3/C4.

### 108 · Arco de hollín (Fire, HR Heavy) — padre: Rayo archibestial (53)
| Nivel | RAW | Elemento | C3/C4 |
|-------|-----|----------|-------|
| L1 | 94 | Fire:4 | Heavy Lv2 / Heavy Lv2! |
| L2 | 122 | Fire:8 | Heavy Lv2 / Heavy Lv2! |
| L3 | 151 | Fire:11 | Heavy Lv3 / Heavy Lv3! |
| L4 | 179 | Fire:15 | Heavy Lv3 / Heavy Lv3! |
| L5 | 208 | Fire:19 | Heavy Lv4 / Heavy Lv4! |
| L6 | 236 | Fire:23 | Heavy Lv4 / Heavy Lv4! |
| L7 | 265 | Fire:26 | Heavy Lv5 / Heavy Lv5! |
| L8 | 293 | Fire:30 | Heavy Lv5 / Heavy Lv5! |

### 109 · Arco de mareas (Water, HR Heavy) — padre: Arco de Gore Magallanes (35)
| Nivel | RAW | Elemento | C3/C4 |
|-------|-----|----------|-------|
| L1 | 94 | Water:4 | Heavy Lv2 / Heavy Lv2! |
| L2 | 122 | Water:8 | Heavy Lv2 / Heavy Lv2! |
| L3 | 151 | Water:11 | Heavy Lv3 / Heavy Lv3! |
| L4 | 179 | Water:15 | Heavy Lv3 / Heavy Lv3! |
| L5 | 208 | Water:19 | Heavy Lv4 / Heavy Lv4! |
| L6 | 236 | Water:23 | Heavy Lv4 / Heavy Lv4! |
| L7 | 265 | Water:26 | Heavy Lv5 / Heavy Lv5! |
| L8 | 293 | Water:30 | Heavy Lv5 / Heavy Lv5! |

### 110 · Arco de la corriente (Water, G Rapid) — padre: Arco áurico (79)
| Nivel | RAW | Elemento | C3/C4 |
|-------|-----|----------|-------|
| L1 | 96 | Water:4 | Rapid Lv2 / Rapid Lv2! |
| L2 | 125 | Water:8 | Rapid Lv2 / Rapid Lv2! |
| L3 | 154 | Water:11 | Rapid Lv3 / Rapid Lv3! |
| L4 | 183 | Water:15 | Rapid Lv3 / Rapid Lv3! |
| L5 | 212 | Water:19 | Rapid Lv4 / Rapid Lv4! |
| L6 | 241 | Water:23 | Rapid Lv4 / Rapid Lv4! |
| L7 | 270 | Water:26 | Rapid Lv5 / Rapid Lv5! |
| L8 | 299 | Water:30 | Rapid Lv5 / Rapid Lv5! |

### 111 · Arco de escarcha (Ice, G Rapid) — padre: Arco glacial (76)
| Nivel | RAW | Elemento | C3/C4 |
|-------|-----|----------|-------|
| L1 | 96 | Ice:4 | Rapid Lv2 / Rapid Lv2! |
| L2 | 125 | Ice:8 | Rapid Lv2 / Rapid Lv2! |
| L3 | 154 | Ice:11 | Rapid Lv3 / Rapid Lv3! |
| L4 | 183 | Ice:15 | Rapid Lv3 / Rapid Lv3! |
| L5 | 212 | Ice:19 | Rapid Lv4 / Rapid Lv4! |
| L6 | 241 | Ice:23 | Rapid Lv4 / Rapid Lv4! |
| L7 | 270 | Ice:26 | Rapid Lv5 / Rapid Lv5! |
| L8 | 299 | Ice:30 | Rapid Lv5 / Rapid Lv5! |

### 112 · Arco de ventisquero (Ice, G Spread) — padre: Arco atávico (105)
| Nivel | RAW | Elemento | C3/C4 |
|-------|-----|----------|-------|
| L1 | 96 | Ice:4 | Spread Lv2 / Spread Lv2! |
| L2 | 125 | Ice:8 | Spread Lv2 / Spread Lv2! |
| L3 | 154 | Ice:11 | Spread Lv3 / Spread Lv3! |
| L4 | 183 | Ice:15 | Spread Lv3 / Spread Lv3! |
| L5 | 212 | Ice:19 | Spread Lv4 / Spread Lv4! |
| L6 | 241 | Ice:23 | Spread Lv4 / Spread Lv4! |
| L7 | 270 | Ice:26 | Spread Lv5 / Spread Lv5! |
| L8 | 299 | Ice:30 | Spread Lv5 / Spread Lv5! |

### 113 · Arco glacial (Ice, G Heavy) — padre: Arco demoníaco (73)
| Nivel | RAW | Elemento | C3/C4 |
|-------|-----|----------|-------|
| L1 | 96 | Ice:4 | Heavy Lv2 / Heavy Lv2! |
| L2 | 125 | Ice:8 | Heavy Lv2 / Heavy Lv2! |
| L3 | 154 | Ice:11 | Heavy Lv3 / Heavy Lv3! |
| L4 | 183 | Ice:15 | Heavy Lv3 / Heavy Lv3! |
| L5 | 212 | Ice:19 | Heavy Lv4 / Heavy Lv4! |
| L6 | 241 | Ice:23 | Heavy Lv4 / Heavy Lv4! |
| L7 | 270 | Ice:26 | Heavy Lv5 / Heavy Lv5! |
| L8 | 299 | Ice:30 | Heavy Lv5 / Heavy Lv5! |

### 114 · Arco del abismo (Dragon, G Heavy) — padre: Arco carmesí (70)
| Nivel | RAW | Elemento | C3/C4 |
|-------|-----|----------|-------|
| L1 | 96 | Dragon:4 | Heavy Lv2 / Heavy Lv2! |
| L2 | 125 | Dragon:8 | Heavy Lv2 / Heavy Lv2! |
| L3 | 154 | Dragon:11 | Heavy Lv3 / Heavy Lv3! |
| L4 | 183 | Dragon:15 | Heavy Lv3 / Heavy Lv3! |
| L5 | 212 | Dragon:19 | Heavy Lv4 / Heavy Lv4! |
| L6 | 241 | Dragon:23 | Heavy Lv4 / Heavy Lv4! |
| L7 | 270 | Dragon:26 | Heavy Lv5 / Heavy Lv5! |
| L8 | 299 | Dragon:30 | Heavy Lv5 / Heavy Lv5! |

### 115 · Arco de trueno torvo (Thunder, LR Heavy) — padre: Cordel metálico (22)
| Nivel | RAW | Elemento | C3/C4 |
|-------|-----|----------|-------|
| L1 | 89 | Thunder:4 | Heavy Lv2 / Heavy Lv2! |
| L2 | 116 | Thunder:8 | Heavy Lv2 / Heavy Lv2! |
| L3 | 142 | Thunder:11 | Heavy Lv3 / Heavy Lv3! |
| L4 | 169 | Thunder:15 | Heavy Lv3 / Heavy Lv3! |
| L5 | 196 | Thunder:19 | Heavy Lv4 / Heavy Lv4! |
| L6 | 223 | Thunder:23 | Heavy Lv4 / Heavy Lv4! |
| L7 | 250 | Thunder:26 | Heavy Lv5 / Heavy Lv5! |
| L8 | 277 | Thunder:30 | Heavy Lv5 / Heavy Lv5! |

### 116 · Arco de hielo torvo (Ice, LR Heavy) — padre: Arco recio de cazador (13)
| Nivel | RAW | Elemento | C3/C4 |
|-------|-----|----------|-------|
| L1 | 89 | Ice:4 | Heavy Lv2 / Heavy Lv2! |
| L2 | 116 | Ice:8 | Heavy Lv2 / Heavy Lv2! |
| L3 | 142 | Ice:11 | Heavy Lv3 / Heavy Lv3! |
| L4 | 169 | Ice:15 | Heavy Lv3 / Heavy Lv3! |
| L5 | 196 | Ice:19 | Heavy Lv4 / Heavy Lv4! |
| L6 | 223 | Ice:23 | Heavy Lv4 / Heavy Lv4! |
| L7 | 250 | Ice:26 | Heavy Lv5 / Heavy Lv5! |
| L8 | 277 | Ice:30 | Heavy Lv5 / Heavy Lv5! |

## 3. Arcos sin cambios

Los **97 árboles restantes** (107 baseline − 10 convertidos) mantienen
exactamente sus valores de RAW, elemento, cargas y coatings. Las opciones
RAW-elegibles (ej. Arco de Yekla LR Heavy, Arco casco demoníaco HR Heavy,
Arco atávico G Spread) se conservan deliberadamente como referencias RAW
competitivas por la **guarda de cobertura RAW**.

## 4. Validación de las modificaciones

- **Matriz 72/72** cubiertos (antes 53/72).
- **Cobertura RAW preservada:** cada objetivo RAW mantiene ≥1 opción RAW.
- **Progresiones válidas:** RAW no decreciente en todos los árboles
  (116/116).
- **Elemento:** crece con el nivel, no supera el cap 30, sin inversión.
- **C4 `!`:** 728/728 alineadas con C3.
- **Tests:** `npm test` → **144/144 pass**.

## Archivos de referencia

- `data/weapons/bow.json` — catálogo rebalanceado.
- `docs/BOW_STAGE15_REBALANCE.md` — propostas, motor y guarda.
- `docs/BOW_STAGE16_VALIDATION.md` — validación completa.
- `tools/apply-stage15-proposals.mjs` — aplicación + re-verificación.
